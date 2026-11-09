import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import type { CommandResult, GameState, InternalIntent, RoundContext, RunningClock, TransitionContext } from '../../../shared/src/game/contracts.js';
import { createState, currentRound, transition } from '../../../shared/src/game/engine.js';
import { displaySnapshot, hostSnapshot } from '../../../shared/src/game/projections.js';
import { GameError, parseCommand, parseCreateGame, parseIntent, parseRoundContext, requireGame } from '../../../shared/src/game/validation.js';
import { GameRepository, fingerprint } from './repository.js';
import { recoverGameSessions } from './recovery.js';

export interface GameServiceOptions {
  now?: () => number; wallNow?: () => string;
  schedule?: (callback: () => void, delayMs: number) => () => void;
  /** Trusted server observations, never host command fields. M2/M3 supply real adapters. */
  hasEligibleMatches?: () => boolean;
  candidateCurrent?: (context: RoundContext, purpose: 'prepare' | 'reveal' | 'resume') => boolean;
  primaryReady?: (roundId: string, context: RoundContext) => boolean;
}
const owners = new WeakSet<object>();
const defaultSchedule: NonNullable<GameServiceOptions['schedule']> = (callback, delayMs) => {
  const timer = setTimeout(callback, delayMs); timer.unref(); return () => clearTimeout(timer);
};
/** One authority per open connection; no HTTP, UI, file work or socket ownership here. */
export class GameService {
  private clock: RunningClock | null = null;
  private cancelTimer: (() => void) | null = null;
  private stopped = false;
  private failed = false;
  private readonly now: () => number;
  private readonly wallNow: () => string;
  private readonly schedule: NonNullable<GameServiceOptions['schedule']>;
  constructor(readonly repository: GameRepository, private readonly options: GameServiceOptions = {}) {
    requireGame(!owners.has(repository.database), 'conflict', 'A game service already owns this connection');
    this.now = options.now ?? (() => performance.now()); this.wallNow = options.wallNow ?? (() => new Date().toISOString());
    this.schedule = options.schedule ?? defaultSchedule;
    recoverGameSessions(repository.database, this.wallNow()); owners.add(repository.database);
  }
  private ensureAvailable() {
    requireGame(!this.stopped && !this.failed && this.repository.database.open, 'unavailable', 'Game service requires recovery');
  }
  private storageAction<T>(action: () => T): T {
    try { return action(); } catch (error) {
      if (!(error instanceof GameError) || error.code === 'unavailable') { this.failed = true; this.clearClock(); throw new GameError('unavailable', 'Game storage failed; review recovery before further commands'); }
      throw error;
    }
  }
  private clearClock() { this.cancelTimer?.(); this.cancelTimer = null; this.clock = null; }
  private env(state: GameState, intent: { type: string; context?: RoundContext }): TransitionContext {
    const round = currentRound(state);
    const context = intent.context ?? (round && 'context' in round ? round.context : null);
    const purpose = intent.type === 'PREPARE_SUCCEEDED' ? 'prepare' : intent.type === 'RESUME' ? 'resume' : 'reveal';
    const needsCandidate = ['PREPARE_SUCCEEDED', 'REVEAL_AND_START', 'RESUME'].includes(intent.type);
    const hasEligibleMatches = intent.type === 'START' ? this.options.hasEligibleMatches?.() ?? false : false;
    const candidateCurrent = needsCandidate && context ? this.options.candidateCurrent?.(context, purpose) ?? false : false;
    const primaryReady = ['REVEAL_AND_START', 'RESUME'].includes(intent.type) && round && context ? this.options.primaryReady?.(round.id, context) ?? false : false;
    // Validate/decode observations before sampling the start time, so preparation work
    // cannot consume the ten-second guessing window. Judgments perform no such I/O.
    return { nowMonoMs: this.now(), nowIso: this.wallNow(), clock: this.clock, awardId: randomUUID(), hasEligibleMatches, candidateCurrent, primaryReady };
  }
  private reconcileClock(state: GameState, atMono: number) {
    const round = currentRound(state);
    if (state.status !== 'active' || round?.phase !== 'guessing') { this.clearClock(); return; }
    if (this.clock?.roundId === round.id && this.clock.timerGeneration === round.timerGeneration) return;
    this.clearClock();
    const clock: RunningClock = { roundId: round.id, timerGeneration: round.timerGeneration, startedAtMonoMs: atMono, deadlineMonoMs: atMono + round.windowMs };
    this.clock = clock;
    this.scheduleExpiry(clock);
  }
  private scheduleExpiry(clock: RunningClock): void {
    this.cancelTimer?.();
    this.cancelTimer = this.schedule(() => {
      if (this.clock !== clock || this.stopped || this.failed) return;
      if (this.now() < clock.deadlineMonoMs) { this.scheduleExpiry(clock); return; }
      try { this.settleDue(); } catch { /* storageAction() latched failure: no unhandled timer rejection or invented success. */ }
    }, Math.max(1, clock.deadlineMonoMs - this.now()));
  }
  private settleDue(): void {
    if (!this.clock || this.now() < this.clock.deadlineMonoMs) return;
    const state = this.storageAction(() => this.repository.current()); const round = state ? currentRound(state) : null;
    if (!state || round?.phase !== 'guessing' || round.id !== this.clock.roundId || round.timerGeneration !== this.clock.timerGeneration) { this.clearClock(); return; }
    const intent = { type: 'EXPIRE' as const, timerGeneration: round.timerGeneration }; const env = this.env(state, intent);
    const next = transition(state, intent, env);
    this.storageAction(() => this.repository.commit(state, next)); this.reconcileClock(next, env.nowMonoMs);
  }
  create(input: unknown): CommandResult {
    this.ensureAvailable(); this.settleDue(); const parsed = parseCreateGame(input); const hash = fingerprint(parsed);
    const existing = this.storageAction(() => this.repository.receipt(parsed.commandId));
    if (existing) {
      requireGame(existing.fingerprint === hash && existing.receipt.sessionId === parsed.sessionId, 'conflict', 'Command identity has different content');
      return { receipt: existing.receipt, replayed: true, state: this.storageAction(() => this.repository.load(parsed.sessionId)) };
    }
    // Validate before entering persistence; createState does not touch operational library data.
    createState(parsed, this.wallNow());
    const result = this.storageAction(() => this.repository.create(parsed, this.wallNow())); return { ...result, replayed: false };
  }
  execute(input: unknown): CommandResult {
    this.ensureAvailable(); const command = parseCommand(input); this.settleDue();
    const hash = fingerprint(command); const receipt = this.storageAction(() => this.repository.receipt(command.commandId));
    if (receipt) {
      requireGame(receipt.fingerprint === hash && receipt.receipt.sessionId === command.sessionId, 'conflict', 'Command identity has different content');
      return { receipt: receipt.receipt, replayed: true, state: this.storageAction(() => this.repository.load(command.sessionId)) };
    }
    const state = this.storageAction(() => this.repository.load(command.sessionId));
    requireGame(command.expectedStateVersion === state.stateVersion, 'conflict', 'Stale game revision');
    // Session commands target no round; all in-attempt intents must name their round.
    const intent = parseIntent({ ...command.payload, type: command.type });
    const sessionIntent = ['CONFIGURE_SETUP', 'START', 'DISCARD_SETUP', 'SELECT_CONTESTANT', 'PREPARE'].includes(intent.type);
    requireGame(sessionIntent ? command.roundId === undefined : command.roundId === state.currentRoundId || (intent.type === 'END_GAME' && command.roundId === undefined && state.currentRoundId === null), 'conflict', 'Wrong round identity');
    const env = this.env(state, intent); const next = transition(state, intent, env);
    const accepted = this.storageAction(() => this.repository.commit(state, next, { commandId: command.commandId, roundId: command.roundId ?? (intent.type === 'PREPARE' ? intent.roundId : null), fingerprint: hash }));
    requireGame(accepted, 'unavailable', 'Missing command receipt'); this.reconcileClock(next, env.nowMonoMs);
    return { receipt: accepted, replayed: false, state: this.storageAction(() => this.repository.load(next.id)) };
  }
  /** Trusted, guarded internal events; future adapters own I/O and liveness detection. */
  private internal(sessionId: string, roundId: string, expectedVersion: number, intent: InternalIntent): boolean {
    this.ensureAvailable(); this.settleDue(); const state = this.storageAction(() => this.repository.load(sessionId));
    if (state.stateVersion !== expectedVersion || state.currentRoundId !== roundId) return false;
    const env = this.env(state, intent); const next = transition(state, intent, env);
    this.storageAction(() => this.repository.commit(state, next)); this.reconcileClock(next, env.nowMonoMs); return true;
  }
  completePreparation(sessionId: string, roundId: string, expectedVersion: number, context: unknown): boolean {
    return this.internal(sessionId, roundId, expectedVersion, { type: 'PREPARE_SUCCEEDED', context: parseRoundContext(context) });
  }
  failPreparation(sessionId: string, roundId: string, expectedVersion: number): boolean {
    return this.internal(sessionId, roundId, expectedVersion, { type: 'PREPARE_FAILED' });
  }
  connectionLost(sessionId: string, roundId: string, expectedVersion: number, reason: 'primary-display' | 'host-connection'): boolean {
    return this.internal(sessionId, roundId, expectedVersion, { type: 'CONNECTION_LOST', reason });
  }
  interruptImage(sessionId: string, roundId: string, expectedVersion: number): boolean {
    return this.internal(sessionId, roundId, expectedVersion, { type: 'INTERRUPT_IMAGE' });
  }
  state(sessionId: string): GameState { this.ensureAvailable(); this.settleDue(); return this.storageAction(() => this.repository.load(sessionId)); }
  snapshot(sessionId: string, role: 'host' | 'display') {
    const state = this.state(sessionId); return role === 'host' ? hostSnapshot(state) : displaySnapshot(state, this.clock, this.now());
  }
  observation(sessionId: string) {
    const state = this.state(sessionId); const serverMonoMs = this.now();
    return { state, snapshot: displaySnapshot(state, this.clock, serverMonoMs), serverMonoMs };
  }
  close(): void {
    if (this.stopped) return;
    try {
      if (!this.failed && this.repository.database.open) {
        this.settleDue(); const state = this.storageAction(() => this.repository.current()); const round = state ? currentRound(state) : null;
        if (state && round?.phase === 'guessing') {
          const intent = { type: 'PAUSE' as const }; const env = this.env(state, intent);
          this.storageAction(() => this.repository.commit(state, transition(state, intent, env)));
        }
      }
    } finally { this.clearClock(); this.stopped = true; owners.delete(this.repository.database); }
  }
}
