import type { DisplaySnapshot } from './contracts.js';
import type { DisplayObservation } from './display.js';
import type { HostStatus } from './host.js';
import { id, parseContestants, parseRoundContext, positive, record, requireGame } from './validation.js';

export const LIVE_PROTOCOL = 'ntm.game.v1';
export const LIVE_PATH = '/api/game/live';
export const LIVE_LIMITS = { clientBytes: 16 * 1024, serverBytes: 64 * 1024, clients: 5, helloMs: 3000, staleMs: 3000, heartbeatMs: 1000, backlogBytes: 1024 * 1024, shutdownMs: 2000 } as const;
export type LiveHello = { type: 'hello'; protocolVersion: 1; serverEpoch: string; token: string; connectionId: string } & (
  | { role: 'host'; sessionId: string | null }
  | { role: 'display'; sessionId: string; displayId: string }
);
interface ConnectionTag { protocolVersion: 1; serverEpoch: string; connectionSequence: number }
export type LiveReady = { roundId: string | null; imageKey: string | null; decoded: boolean; clock: { nonce: string; rttMs: number } | null };
export type LiveClientMessage = LiveHello | (ConnectionTag & (
  | { type: 'clock_probe'; nonce: string }
  | { type: 'heartbeat_ack'; nonce: string }
  | ({ type: 'display_ready' } & LiveReady)
));
export type DisplayLiveState = Pick<DisplayObservation, 'snapshot' | 'asset'>;
export type LiveSnapshot = ConnectionTag & { sequence: number; sessionId: string | null; stateVersion: number; serverMonoMs: number } & (
  | { type: 'snapshot' | 'ready_status'; role: 'host'; state: HostStatus }
  | { type: 'snapshot'; role: 'display'; state: DisplayLiveState }
);
export type LiveServerMessage = LiveSnapshot | (ConnectionTag & (
  | { type: 'clock'; nonce: string; serverMonoMs: number }
  | { type: 'heartbeat'; nonce: string }
  | { type: 'error'; code: string; message: string; terminal: boolean }
));
export function nonnegative(value: unknown): number {
  requireGame(typeof value === 'number' && Number.isFinite(value) && value >= 0, 'validation', 'Invalid numeric observation'); return value;
}
export function parseLiveClient(input: unknown): LiveClientMessage {
  const value = record(input, ['type', 'protocolVersion', 'serverEpoch', 'connectionSequence', 'role', 'token', 'connectionId', 'sessionId', 'displayId', 'nonce', 'roundId', 'imageKey', 'decoded', 'clock']);
  requireGame(value.protocolVersion === 1, 'validation', 'Unsupported live protocol'); const serverEpoch = id(value.serverEpoch);
  if (value.type === 'hello') {
    record(input, ['type', 'protocolVersion', 'serverEpoch', 'role', 'token', 'connectionId', 'sessionId', 'displayId']);
    requireGame(typeof value.token === 'string' && /^[a-f0-9]{64}$/.test(value.token), 'validation', 'Invalid capability');
    const base = { type: 'hello' as const, protocolVersion: 1 as const, serverEpoch, token: value.token, connectionId: id(value.connectionId) };
    if (value.role === 'host') {
      requireGame(value.displayId === undefined, 'validation', 'Invalid host hello');
      return { ...base, role: 'host', sessionId: value.sessionId === null ? null : id(value.sessionId) };
    }
    requireGame(value.role === 'display', 'validation', 'Invalid live role');
    return { ...base, role: 'display', sessionId: id(value.sessionId), displayId: id(value.displayId) };
  }
  const base = { protocolVersion: 1 as const, serverEpoch, connectionSequence: positive(value.connectionSequence) };
  if (value.type === 'clock_probe' || value.type === 'heartbeat_ack') {
    record(input, ['type', 'protocolVersion', 'serverEpoch', 'connectionSequence', 'nonce']);
    return { ...base, type: value.type, nonce: id(value.nonce) };
  }
  requireGame(value.type === 'display_ready', 'validation', 'Unsupported live message');
  record(input, ['type', 'protocolVersion', 'serverEpoch', 'connectionSequence', 'roundId', 'imageKey', 'decoded', 'clock']);
  requireGame(typeof value.decoded === 'boolean', 'validation', 'Invalid readiness');
  let clock: LiveReady['clock'] = null;
  if (value.clock !== null) {
    const sample = record(value.clock, ['nonce', 'rttMs']); const rttMs = nonnegative(sample.rttMs);
    requireGame(rttMs <= 60_000, 'validation', 'Invalid clock RTT'); clock = { nonce: id(sample.nonce), rttMs };
  }
  return { ...base, type: 'display_ready', roundId: value.roundId === null ? null : id(value.roundId), imageKey: value.imageKey === null ? null : id(value.imageKey), decoded: value.decoded, clock };
}

/** Framing is checked on both sides. Public payload validation additionally rejects private fields. */
export function parseLiveServer(input: unknown): LiveServerMessage {
  const v = record(input, ['type', 'protocolVersion', 'serverEpoch', 'connectionSequence', 'sequence', 'sessionId', 'stateVersion', 'serverMonoMs', 'role', 'state', 'nonce', 'code', 'message', 'terminal']);
  requireGame(v.protocolVersion === 1, 'validation', 'Unsupported live protocol'); id(v.serverEpoch); positive(v.connectionSequence);
  if (v.type === 'clock') {
    record(input, ['type', 'protocolVersion', 'serverEpoch', 'connectionSequence', 'nonce', 'serverMonoMs']); id(v.nonce); nonnegative(v.serverMonoMs);
  } else if (v.type === 'heartbeat') {
    record(input, ['type', 'protocolVersion', 'serverEpoch', 'connectionSequence', 'nonce']); id(v.nonce);
  } else if (v.type === 'error') {
    record(input, ['type', 'protocolVersion', 'serverEpoch', 'connectionSequence', 'code', 'message', 'terminal']);
    requireGame(typeof v.code === 'string' && v.code.length <= 64 && typeof v.message === 'string' && v.message.length <= 300 && typeof v.terminal === 'boolean', 'validation', 'Invalid live error');
  } else {
    requireGame(v.type === 'snapshot' || v.type === 'ready_status', 'validation', 'Unsupported live frame');
    record(input, ['type', 'protocolVersion', 'serverEpoch', 'connectionSequence', 'sequence', 'sessionId', 'stateVersion', 'serverMonoMs', 'role', 'state']);
    positive(v.sequence); requireGame(Number.isSafeInteger(v.stateVersion), 'validation', 'Invalid revision'); nonnegative(v.stateVersion); nonnegative(v.serverMonoMs);
    if (v.sessionId !== null) id(v.sessionId);
    if (v.role === 'display') {
      requireGame(v.type === 'snapshot', 'validation', 'Readiness status is host-only');
      const state = record(v.state, ['snapshot', 'asset']); validateDisplaySnapshot(state.snapshot);
      const snapshot = state.snapshot as DisplaySnapshot;
      requireGame(v.sessionId === snapshot.sessionId && v.stateVersion === snapshot.stateVersion, 'validation', 'Snapshot identity mismatch');
      if (state.asset !== null) { const asset = record(state.asset, ['roundId', 'imageKey']); id(asset.roundId); id(asset.imageKey); requireGame('roundId' in snapshot && asset.roundId === snapshot.roundId && asset.imageKey === snapshot.roundId, 'validation', 'Invalid asset identity'); }
    } else {
      requireGame(v.role === 'host', 'validation', 'Invalid snapshot role');
      const state = record(v.state, ['protocolVersion', 'serverEpoch', 'sequence', 'snapshot', 'availability', 'allowedActions', 'candidateValid', 'primaryDisplay', 'timing', 'preparationError']);
      requireGame(state.protocolVersion === 1 && state.serverEpoch === v.serverEpoch && Number.isSafeInteger(state.sequence) && typeof state.candidateValid === 'boolean' && Array.isArray(state.allowedActions) && state.allowedActions.every(a => typeof a === 'string'), 'validation', 'Invalid host observation');
      const primary = record(state.primaryDisplay, ['ready', 'message', 'displayId', 'displays']);
      requireGame(typeof primary.ready === 'boolean' && typeof primary.message === 'string' && primary.message.length <= 500, 'validation', 'Invalid readiness status');
      if (primary.displayId !== undefined) id(primary.displayId);
      if (primary.displays !== undefined) {
        requireGame(Array.isArray(primary.displays) && primary.displays.length <= 4, 'validation', 'Invalid display list');
        for (const item of primary.displays) { const d = record(item, ['displayId', 'primary', 'connected', 'ready']); id(d.displayId); requireGame(['primary', 'connected', 'ready'].every(k => typeof d[k] === 'boolean'), 'validation', 'Invalid display state'); }
      }
      requireGame(state.preparationError === null || (typeof state.preparationError === 'string' && state.preparationError.length <= 500), 'validation', 'Invalid preparation error');
      const availability = record(state.availability, ['tiers', 'distinctMatches', 'asOf']); nonnegative(availability.distinctMatches);
      const tiers = record(availability.tiers, ['squash', 'competitive', 'deathmatch']);
      for (const tier of ['squash', 'competitive', 'deathmatch']) { const counts = record(tiers[tier], ['screenshots', 'matches']); nonnegative(counts.screenshots); nonnegative(counts.matches); }
      if (state.timing !== null && state.timing !== undefined) { const timing = record(state.timing, ['serverMonoMs', 'remainingMs']); nonnegative(timing.serverMonoMs); nonnegative(timing.remainingMs); }
      if (state.snapshot === null) requireGame(v.sessionId === null && v.stateVersion === 0, 'validation', 'Invalid empty snapshot');
      else {
        const s = record(state.snapshot, ['protocolVersion', 'role', 'session', 'currentRound', 'recentRounds', 'historyTruncated', 'scores', 'winnerIds']);
        const session = record(s.session, ['id', 'status', 'stateVersion', 'rulesVersion', 'activeContestantId', 'currentRoundId', 'contestants', 'nextAttemptOrdinal', 'nextTurnOrdinal', 'createdAt', 'updatedAt', 'completedAt']);
        requireGame(session.id === v.sessionId && session.stateVersion === v.stateVersion && session.rulesVersion === 1 && s.role === 'host' && s.protocolVersion === 1 && Array.isArray(s.recentRounds) && s.recentRounds.length <= 3 && typeof s.historyTruncated === 'boolean' && ['setup', 'active', 'completed', 'discarded'].includes(session.status as string), 'validation', 'Invalid host snapshot');
        id(session.id); positive(session.stateVersion); parseContestants(session.contestants, session.activeContestantId); if (session.currentRoundId !== null) id(session.currentRoundId); positive(session.nextTurnOrdinal); positive(session.nextAttemptOrdinal);
        requireGame(typeof session.createdAt === 'string' && typeof session.updatedAt === 'string', 'validation', 'Invalid session timestamps');
        validateScores(s.scores);
        for (const round of [s.currentRound, ...s.recentRounds]) if (round !== null) validateHostRound(round);
        if (s.winnerIds !== undefined) { requireGame(Array.isArray(s.winnerIds) && s.winnerIds.length >= 1 && s.winnerIds.length <= 2, 'validation', 'Invalid winners'); s.winnerIds.forEach(id); }
      }
    }
  }
  return input as LiveServerMessage;
}
const PHASES = ['preparing', 'ready', 'guessing', 'paused', 'awaiting_judgment', 'interrupted', 'adjudicated', 'answer_revealed', 'cancelled'];
function validateHostRound(input: unknown) {
  const r = record(input, ['id', 'contestantId', 'ordinal', 'requestedTier', 'createdAt', 'timerGeneration', 'phase', 'context', 'turnOrdinal', 'exposedAt', 'windowMs', 'remainingMs', 'pauseReason', 'outcome', 'award', 'lateEntry', 'voidReason', 'judgedAt', 'cancelReason']);
  requireGame(PHASES.includes(r.phase as string), 'validation', 'Invalid round'); id(r.id); id(r.contestantId); positive(r.ordinal);
  requireGame(['squash', 'competitive', 'deathmatch'].includes(r.requestedTier as string) && typeof r.createdAt === 'string' && Number.isSafeInteger(r.timerGeneration), 'validation', 'Invalid round fields'); nonnegative(r.timerGeneration);
  if (r.phase !== 'preparing' && !(r.phase === 'cancelled' && r.context === null)) parseRoundContext(r.context);
  if (r.phase === 'guessing' || r.phase === 'paused') { const ms = nonnegative(r.phase === 'guessing' ? r.windowMs : r.remainingMs); requireGame(ms <= 10_000, 'validation', 'Invalid round time'); }
  if (r.phase === 'adjudicated' || r.phase === 'answer_revealed') { validateOutcome(r); requireGame(typeof r.lateEntry === 'boolean' && typeof r.judgedAt === 'string', 'validation', 'Invalid judgment'); }
  if (r.turnOrdinal !== undefined) positive(r.turnOrdinal);
}
function validateRoster(input: unknown) {
  requireGame(Array.isArray(input) && input.length >= 1 && input.length <= 2, 'validation', 'Invalid roster');
  for (const item of input) { const p = record(item, ['id', 'name']); id(p.id); requireGame(typeof p.name === 'string' && Array.from(p.name).length <= 60, 'validation', 'Invalid contestant'); }
}
function validateScores(input: unknown) {
  requireGame(Array.isArray(input) && input.length <= 2, 'validation', 'Invalid scores');
  for (const item of input) {
    const row = record(item, ['contestantId', 'name', 'total', 'lastOutcome']); id(row.contestantId); requireGame(typeof row.name === 'string' && Number.isSafeInteger(row.total), 'validation', 'Invalid score'); nonnegative(row.total);
    if (row.lastOutcome !== undefined) { const last = record(row.lastOutcome, ['outcome', 'award', 'turnOrdinal']); validateOutcome(last); positive(last.turnOrdinal); }
  }
}
function validateOutcome(value: Record<string, unknown>) {
  requireGame(['correct', 'incorrect', 'timeout', 'void'].includes(value.outcome as string) && [0, 1, 2, 3].includes(value.award as number), 'validation', 'Invalid outcome');
}
function validateDisplaySnapshot(input: unknown) {
  const v = record(input, ['protocolVersion', 'sessionId', 'stateVersion', 'activeContestantId', 'contestants', 'scores', 'turnsExposed', 'phase', 'winnerIds', 'roundId', 'contestantId', 'requestedTier', 'turnOrdinal', 'imageKey', 'remainingMs', 'outcome', 'award', 'answer']);
  requireGame(v.protocolVersion === 1, 'validation', 'Invalid projection'); id(v.sessionId); positive(v.stateVersion); id(v.activeContestantId); validateRoster(v.contestants); validateScores(v.scores); nonnegative(v.turnsExposed);
  const base = ['protocolVersion', 'sessionId', 'stateVersion', 'activeContestantId', 'contestants', 'scores', 'turnsExposed', 'phase'];
  if (['setup', 'between_rounds', 'discarded'].includes(v.phase as string)) { record(input, base); return; }
  if (v.phase === 'completed') { record(input, [...base, 'winnerIds']); requireGame(Array.isArray(v.winnerIds) && v.winnerIds.length >= 1 && v.winnerIds.length <= 2, 'validation', 'Invalid winners'); v.winnerIds.forEach(id); return; }
  requireGame(PHASES.includes(v.phase as string) && v.phase !== 'cancelled', 'validation', 'Invalid public phase');
  id(v.roundId); id(v.contestantId); requireGame(['squash', 'competitive', 'deathmatch'].includes(v.requestedTier as string), 'validation', 'Invalid tier'); if (v.turnOrdinal !== null) positive(v.turnOrdinal);
  const round = [...base, 'roundId', 'contestantId', 'requestedTier', 'turnOrdinal'];
  if (v.phase === 'answer_revealed') {
    record(input, [...round, 'outcome', 'award', 'answer']); validateOutcome(v);
    const answer = record(v.answer, ['participantDescription', 'promotion', 'event', 'matchDate', 'stipulation', 'championshipInfo']);
    for (const key of ['participantDescription', 'promotion', 'event']) requireGame(typeof answer[key] === 'string' && (answer[key] as string).length <= 4000, 'validation', 'Invalid answer');
    for (const key of ['matchDate', 'stipulation', 'championshipInfo']) requireGame(answer[key] === null || (typeof answer[key] === 'string' && (answer[key] as string).length <= 2000), 'validation', 'Invalid answer');
  } else {
    const timed = ['guessing', 'paused', 'awaiting_judgment', 'interrupted'].includes(v.phase as string); const image = ['ready', 'guessing'].includes(v.phase as string);
    record(input, [...round, ...(timed ? ['remainingMs'] : []), ...(image ? ['imageKey'] : [])]);
    if (timed) { const remaining = nonnegative(v.remainingMs); requireGame(remaining <= 10_000, 'validation', 'Invalid remaining time'); }
    if (image) requireGame(id(v.imageKey) === v.roundId, 'validation', 'Invalid image identity');
  }
}
