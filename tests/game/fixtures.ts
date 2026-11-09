import { randomUUID } from 'node:crypto';
import type { CommandEnvelope, CreateGame, GameState, HostIntent, RoundContext, RunningClock, TransitionContext } from '../../shared/src/game/contracts';
import { createState, currentRound, transition } from '../../shared/src/game/engine';
import { parseCommand } from '../../shared/src/game/validation';
import { createLibraryRepository } from '../../server/src/library/repository';
import { GameRepository } from '../../server/src/game/repository';
import { GameService, type GameServiceOptions } from '../../server/src/game/service';
import { initializeStorage } from '../../server/src/storage';
import { createTestResources } from '../helpers/resources';
import { screenshotInput } from '../library/fixtures';

export const NOW = '2026-11-08T12:00:00.000Z';
export function setup(count = 2): CreateGame {
  const contestants = Array.from({ length: count }, (_, i) => ({ id: randomUUID(), name: `Contestant ${i + 1}` }));
  return { protocolVersion: 1, commandId: randomUUID(), sessionId: randomUUID(), contestants, activeContestantId: contestants[0]?.id ?? randomUUID() };
}
export function context(): RoundContext {
  return { screenshotId: randomUUID(), matchId: randomUUID(), screenshotRevision: 1, matchRevision: 1,
    image: { sha256: 'a'.repeat(64), width: 640, height: 360, byteSize: 100 },
    answer: { participantDescription: 'Private Wrestler A vs B', promotion: 'Private Promotion', event: 'Private Event', matchDate: null, stipulation: null, championshipInfo: null },
    obscurity: 'low', difficulty: 'easy', rulesVersion: 1 };
}
export function envelope(state: GameState, intent: HostIntent, commandId = randomUUID()): CommandEnvelope {
  const { type, ...payload } = intent;
  const sessionIntent = ['CONFIGURE_SETUP', 'START', 'DISCARD_SETUP', 'SELECT_CONTESTANT', 'PREPARE'].includes(type);
  return parseCommand({ protocolVersion: 1, commandId, sessionId: state.id, expectedStateVersion: state.stateVersion,
    ...(!sessionIntent && state.currentRoundId ? { roundId: state.currentRoundId } : {}), type, payload });
}
export function pureGame() {
  let state = createState(setup(), NOW); let time = 0; let clock: RunningClock | null = null;
  const env = (): TransitionContext => ({ nowIso: NOW, nowMonoMs: time, clock, hasEligibleMatches: true, primaryReady: true, candidateCurrent: true, awardId: randomUUID() });
  return {
    get state() { return state; }, get clock() { return clock; }, env,
    setTime(value: number) { time = value; },
    step(intent: Parameters<typeof transition>[1]) {
      state = transition(state, intent, env()); const round = currentRound(state);
      if (round?.phase === 'guessing') {
        if (!clock || clock.roundId !== round.id || clock.timerGeneration !== round.timerGeneration) clock = { roundId: round.id, timerGeneration: round.timerGeneration, startedAtMonoMs: time, deadlineMonoMs: time + round.windowMs };
      } else clock = null;
      return state;
    },
    ready(candidate = context()) {
      if (state.status === 'setup') this.step({ type: 'START' });
      this.step({ type: 'PREPARE', roundId: randomUUID(), tier: 'squash' }); this.step({ type: 'PREPARE_SUCCEEDED', context: candidate });
    },
  };
}
export function serviceFixture(options: GameServiceOptions = {}) {
  const resources = createTestResources(); let storage = resources.storage(initializeStorage({ dataDir: resources.root }));
  let time = 0; let wall = NOW;
  const scheduled: Array<{ callback: () => void; cancelled: boolean }> = [];
  const services: GameService[] = [];
  const ports: GameServiceOptions = { now: () => time, wallNow: () => wall, hasEligibleMatches: () => true, candidateCurrent: () => true, primaryReady: () => true,
    schedule(callback) { const job = { callback, cancelled: false }; scheduled.push(job); return () => { job.cancelled = true; }; }, ...options };
  let service = new GameService(new GameRepository(storage.db), ports); services.push(service);
  let state = service.create(setup()).state;
  const fixture = {
    resources, scheduled,
    get storage() { return storage; }, get service() { return service; }, get state() { return service.state(state.id); },
    setTime(ms: number) { time = ms; }, setWall(value: string) { wall = value; },
    command(intent: HostIntent) { state = service.execute(envelope(service.state(state.id), intent)).state; return state; },
    candidate(hash = 'a'.repeat(64)): RoundContext {
      const repo = createLibraryRepository(storage.db);
      const match = repo.createMatch({ participantDescription: 'Private Wrestler A vs B', promotion: 'Private Promotion', event: 'Private Event', obscurity: 'low' });
      const input = screenshotInput(randomUUID()); input.image.sha256 = hash;
      const shot = repo.insertCommittedScreenshot(input);
      const saved = repo.updateScreenshot(shot.id, shot.revision, { matchId: match.id, difficulty: 'easy' }, match.revision);
      // A domain observation supplied by the trusted fixture port, no file processing or real library access.
      return { ...context(), matchId: match.id, screenshotId: shot.id, screenshotRevision: saved.revision, matchRevision: match.revision, image: input.image };
    },
    ready(candidate?: RoundContext) {
      if (this.state.status === 'setup') this.command({ type: 'START' });
      this.command({ type: 'PREPARE', roundId: randomUUID(), tier: 'squash' }); const current = this.state;
      service.completePreparation(current.id, current.currentRoundId!, current.stateVersion, candidate ?? this.candidate()); return this.state;
    },
    reopen(crash = false) {
      if (!crash) service.close();
      storage.db.close();
      if (crash) service.close();
      storage = resources.storage(initializeStorage({ dataDir: resources.root }));
      service = new GameService(new GameRepository(storage.db), ports); services.push(service); return this.state;
    },
    async cleanup() {
      try { for (const owned of services) owned.close(); } finally { await resources.cleanup(); }
    },
  };
  return fixture;
}
