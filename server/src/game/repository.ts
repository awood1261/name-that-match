import { createHash } from 'node:crypto';
import type Database from 'better-sqlite3';
import type { Award, Contestant, CreateGame, GameState, Receipt, Round } from '../../../shared/src/game/contracts.js';
import { MAX_GAME_COMMANDS } from '../../../shared/src/game/contracts.js';
import { createState } from '../../../shared/src/game/engine.js';
import { parseRoundContext, requireGame } from '../../../shared/src/game/validation.js';

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const row = value as Record<string, unknown>;
    return `{${Object.keys(row).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(row[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
export function fingerprint(value: unknown): string { return createHash('sha256').update(canonicalJson(value)).digest('hex'); }
interface SessionRow {
  id: string; status: GameState['status']; rules_version: 1; state_version: number;
  active_contestant_id: string; current_round_id: string | null; next_attempt_ordinal: number;
  next_turn_ordinal: number; created_at: string; updated_at: string; completed_at: string | null;
}
interface RoundRow {
  id: string; session_id: string; contestant_id: string; ordinal: number; requested_tier: Round['requestedTier'];
  phase: Round['phase']; context_json: string | null; screenshot_id: string | null; match_id: string | null; image_sha256: string | null;
  stopped_remaining_ms: number | null;
  timer_generation: number; window_ms: number | null; remaining_ms: number | null;
  pause_reason: 'host' | 'primary-display' | 'host-connection' | null; exposed_at: string | null; turn_ordinal: number | null;
  outcome: 'correct' | 'incorrect' | 'timeout' | 'void' | null; award: 0 | 1 | 2 | 3 | null; late_entry: number;
  void_reason: 'skip' | 'void' | 'interrupted' | null; cancel_reason: 'host' | 'preparation-failed' | 'recovery' | null; judged_at: string | null; created_at: string;
}
interface ReceiptRow { command_id: string; session_id: string; round_id: string | null; accepted_version: number; fingerprint: string }
export interface StoredReceipt { receipt: Receipt; fingerprint: string }
function roundRow(sessionId: string, round: Round): RoundRow {
  const context = 'context' in round && round.context ? parseRoundContext(round.context) : null;
  return { id: round.id, session_id: sessionId, contestant_id: round.contestantId, ordinal: round.ordinal, requested_tier: round.requestedTier,
    stopped_remaining_ms: 'stoppedRemainingMs' in round ? round.stoppedRemainingMs ?? null : null,
    phase: round.phase, context_json: context ? canonicalJson(context) : null, screenshot_id: context?.screenshotId ?? null, match_id: context?.matchId ?? null, image_sha256: context?.image.sha256 ?? null,
    timer_generation: round.timerGeneration, window_ms: round.phase === 'guessing' ? round.windowMs : null,
    remaining_ms: round.phase === 'paused' ? round.remainingMs : null, pause_reason: round.phase === 'paused' ? round.pauseReason : null,
    exposed_at: 'exposedAt' in round ? round.exposedAt : null, turn_ordinal: 'turnOrdinal' in round ? round.turnOrdinal : null,
    outcome: 'outcome' in round ? round.outcome : null, award: 'award' in round ? round.award : null,
    late_entry: 'lateEntry' in round && round.lateEntry ? 1 : 0, void_reason: 'voidReason' in round ? round.voidReason : null,
    cancel_reason: round.phase === 'cancelled' ? round.cancelReason : null, judged_at: 'judgedAt' in round ? round.judgedAt : null, created_at: round.createdAt };
}
function readRound(row: RoundRow): Round {
  const base = { id: row.id, contestantId: row.contestant_id, ordinal: row.ordinal, requestedTier: row.requested_tier, createdAt: row.created_at, timerGeneration: row.timer_generation };
  if (row.phase === 'preparing') return { ...base, phase: 'preparing' };
  const context = row.context_json === null ? null : parseRoundContext(JSON.parse(row.context_json));
  if (row.phase === 'cancelled') {
    requireGame(row.cancel_reason, 'unavailable', 'Invalid cancelled history'); return { ...base, phase: 'cancelled', context, cancelReason: row.cancel_reason };
  }
  requireGame(context, 'unavailable', 'Missing round context');
  if (row.phase === 'ready') return { ...base, phase: 'ready', context };
  requireGame(row.exposed_at && row.turn_ordinal, 'unavailable', 'Missing exposure history');
  const exposed = { ...base, context, exposedAt: row.exposed_at, turnOrdinal: row.turn_ordinal };
  switch (row.phase) {
    case 'guessing': requireGame(row.window_ms, 'unavailable', 'Missing running window'); return { ...exposed, phase: 'guessing', windowMs: row.window_ms };
    case 'paused': requireGame(row.remaining_ms && row.pause_reason, 'unavailable', 'Missing paused remainder'); return { ...exposed, phase: 'paused', remainingMs: row.remaining_ms, pauseReason: row.pause_reason };
    case 'awaiting_judgment': case 'interrupted': return { ...exposed, phase: row.phase };
    case 'adjudicated': case 'answer_revealed':
      requireGame(row.outcome && row.award !== null && row.judged_at, 'unavailable', 'Missing judgment');
      return { ...exposed, phase: row.phase, outcome: row.outcome, award: row.award, lateEntry: row.late_entry === 1, voidReason: row.void_reason, judgedAt: row.judged_at, ...(row.stopped_remaining_ms === null ? {} : { stoppedRemainingMs: row.stopped_remaining_ms }) };
  }
}
export class GameRepository {
  constructor(readonly database: Database.Database) {}
  current(): GameState | null {
    return this.database.transaction(() => {
      const row = this.database.prepare("SELECT id FROM game_sessions WHERE status IN ('setup','active')").get() as { id: string } | undefined;
      return row ? this.loadRows(row.id) : null;
    })();
  }
  load(sessionId: string): GameState { return this.database.transaction(() => this.loadRows(sessionId))(); }
  private loadRows(sessionId: string): GameState {
    const row = this.database.prepare('SELECT * FROM game_sessions WHERE id=?').get(sessionId) as SessionRow | undefined;
    requireGame(row, 'not_found', 'Game not found');
    const contestants = this.database.prepare('SELECT id,name FROM game_contestants WHERE session_id=? ORDER BY ordinal').all(sessionId) as Contestant[];
    const rounds = (this.database.prepare('SELECT * FROM game_rounds WHERE session_id=? ORDER BY ordinal').all(sessionId) as RoundRow[]).map(readRound);
    const awards = this.database.prepare('SELECT id,round_id AS roundId,contestant_id AS contestantId,amount AS points,created_at AS createdAt FROM game_score_events WHERE session_id=? ORDER BY rowid').all(sessionId) as Award[];
    return { id: row.id, status: row.status, rulesVersion: row.rules_version, stateVersion: row.state_version, activeContestantId: row.active_contestant_id,
      currentRoundId: row.current_round_id, nextAttemptOrdinal: row.next_attempt_ordinal, nextTurnOrdinal: row.next_turn_ordinal,
      contestants, rounds, awards, createdAt: row.created_at, updatedAt: row.updated_at, ...(row.completed_at === null ? {} : { completedAt: row.completed_at }) } as GameState;
  }
  receipt(commandId: string): StoredReceipt | null {
    const row = this.database.prepare('SELECT * FROM game_command_receipts WHERE command_id=?').get(commandId) as ReceiptRow | undefined;
    return row ? { receipt: { commandId: row.command_id, sessionId: row.session_id, roundId: row.round_id, acceptedVersion: row.accepted_version }, fingerprint: row.fingerprint } : null;
  }
  private writeReceipt(receipt: Receipt, hash: string, now: string): void {
    this.database.prepare('INSERT INTO game_command_receipts(command_id,session_id,round_id,fingerprint,accepted_version,created_at) VALUES(?,?,?,?,?,?)')
      .run(receipt.commandId, receipt.sessionId, receipt.roundId, hash, receipt.acceptedVersion, now);
  }
  create(input: CreateGame, now: string): { state: GameState; receipt: Receipt } {
    return this.database.transaction(() => {
      requireGame(!this.current(), 'conflict', 'A game is already nonterminal');
      const state = createState(input, now);
      this.database.prepare('INSERT INTO game_sessions(id,status,rules_version,state_version,next_attempt_ordinal,next_turn_ordinal,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)')
        .run(state.id, 'setup', 1, 1, 1, 1, now, now);
      this.writeContestants(state);
      this.database.prepare('UPDATE game_sessions SET active_contestant_id=? WHERE id=?').run(state.activeContestantId, state.id);
      const receipt = { commandId: input.commandId, sessionId: state.id, roundId: null, acceptedVersion: 1 };
      this.writeReceipt(receipt, fingerprint(input), now);
      return { state, receipt };
    }).immediate();
  }
  private writeContestants(state: GameState): void {
    this.database.prepare('DELETE FROM game_contestants WHERE session_id=?').run(state.id);
    const stmt = this.database.prepare('INSERT INTO game_contestants(id,session_id,name,name_key,ordinal) VALUES(?,?,?,?,?)');
    state.contestants.forEach((p, ordinal) => stmt.run(p.id, state.id, p.name, p.name.toLowerCase(), ordinal));
  }
  commit(previous: GameState, next: GameState, accepted?: { commandId: string; roundId: string | null; fingerprint: string }): Receipt | null {
    return this.database.transaction(() => {
      requireGame(next.id === previous.id && next.stateVersion === previous.stateVersion + 1, 'conflict', 'Invalid game revision');
      const version = this.database.prepare('SELECT state_version FROM game_sessions WHERE id=?').get(previous.id) as { state_version: number } | undefined;
      requireGame(version?.state_version === previous.stateVersion, 'conflict', 'Stale game revision');
      if (accepted) {
        const count = this.database.prepare('SELECT count(*) AS n FROM game_command_receipts WHERE session_id=?').get(next.id) as { n: number };
        requireGame(count.n < MAX_GAME_COMMANDS, 'limit', 'Session command limit reached');
      }
      if (canonicalJson(previous.contestants) !== canonicalJson(next.contestants)) {
        requireGame(previous.status === 'setup' && next.status === 'setup', 'invalid_transition', 'Roster is fixed after Start');
        this.database.prepare('UPDATE game_sessions SET active_contestant_id=NULL WHERE id=?').run(next.id);
        this.writeContestants(next);
      }
      const known = new Map(previous.rounds.map((r) => [r.id, canonicalJson(roundRow(next.id, r))]));
      for (const round of next.rounds) {
        const row = roundRow(next.id, round);
        if (known.get(round.id) === canonicalJson(row)) continue;
        const columns = Object.keys(row);
        this.database.prepare(`INSERT INTO game_rounds(${columns.join(',')}) VALUES(${columns.map((k) => `@${k}`).join(',')}) ON CONFLICT(id) DO UPDATE SET ${columns.filter((k) => k !== 'id').map((k) => `${k}=excluded.${k}`).join(',')}`).run(row);
      }
      for (const award of next.awards) {
        if (previous.awards.some((a) => a.id === award.id)) continue;
        this.database.prepare('INSERT INTO game_score_events(id,session_id,round_id,contestant_id,amount,created_at) VALUES(?,?,?,?,?,?)')
          .run(award.id, next.id, award.roundId, award.contestantId, award.points, award.createdAt);
      }
      const updated = this.database.prepare('UPDATE game_sessions SET status=?,state_version=?,active_contestant_id=?,current_round_id=?,next_attempt_ordinal=?,next_turn_ordinal=?,updated_at=?,completed_at=? WHERE id=? AND state_version=?')
        .run(next.status, next.stateVersion, next.activeContestantId, next.currentRoundId, next.nextAttemptOrdinal, next.nextTurnOrdinal, next.updatedAt, 'completedAt' in next ? next.completedAt : null, next.id, previous.stateVersion);
      requireGame(updated.changes === 1, 'conflict', 'Stale game revision');
      if (!accepted) return null;
      const receipt = { commandId: accepted.commandId, sessionId: next.id, roundId: accepted.roundId, acceptedVersion: next.stateVersion };
      this.writeReceipt(receipt, accepted.fingerprint, next.updatedAt); return receipt;
    }).immediate();
  }
}
