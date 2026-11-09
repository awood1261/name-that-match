import type { DisplaySnapshot, GameState, HostSnapshot, Round, RunningClock, ScoreRow } from './contracts.js';
import { currentRound } from './engine.js';

export function scoreboard(state: GameState): ScoreRow[] {
  return state.contestants.map((p) => ({ contestantId: p.id, name: p.name, total: state.awards.filter((a) => a.contestantId === p.id).reduce((sum, a) => sum + a.points, 0) }))
    .sort((a, b) => b.total - a.total);
}
export function winnerIds(state: GameState): string[] {
  const rows = scoreboard(state); return rows.filter((row) => row.total === rows[0]?.total).map((row) => row.contestantId);
}
export function hostSnapshot(state: GameState): HostSnapshot {
  const { rounds } = state;
  const session: HostSnapshot['session'] = {
    id: state.id, status: state.status, stateVersion: state.stateVersion, rulesVersion: state.rulesVersion,
    activeContestantId: state.activeContestantId, currentRoundId: state.currentRoundId,
    contestants: state.contestants, nextAttemptOrdinal: state.nextAttemptOrdinal, nextTurnOrdinal: state.nextTurnOrdinal,
    createdAt: state.createdAt, updatedAt: state.updatedAt, ...('completedAt' in state ? { completedAt: state.completedAt } : {}),
  };
  const round = currentRound(state);
  const history = rounds.filter((r) => r.id !== round?.id);
  // Current clue plus at most three historical rounds; totals use the complete ledger.
  // Never put the full aggregate/receipt history on the future wire projection.
  const snapshot: HostSnapshot = { protocolVersion: 1, role: 'host', session,
    currentRound: round, recentRounds: history.slice(-3), historyTruncated: history.length > 3, scores: scoreboard(state) };
  return JSON.parse(JSON.stringify(snapshot)) as HostSnapshot;
}
function publicRound(round: Round) {
  return { roundId: round.id, contestantId: round.contestantId, requestedTier: round.requestedTier, turnOrdinal: 'turnOrdinal' in round ? round.turnOrdinal : null };
}
/** Constructed allowlist, never a private-object spread or hidden-by-CSS projection. */
export function displaySnapshot(state: GameState, clock: RunningClock | null, nowMonoMs: number): DisplaySnapshot {
  const round = currentRound(state);
  // Judgment is committed privately. Withhold its score change as well as the
  // result fields until the host's explicit result/answer reveal.
  const publicState = state.status === 'active' && round?.phase === 'adjudicated'
    ? { ...state, awards: state.awards.filter((award) => award.roundId !== round.id) } : state;
  const base = { protocolVersion: 1 as const, sessionId: state.id, stateVersion: state.stateVersion, activeContestantId: state.activeContestantId,
    contestants: state.contestants.map((p) => ({ id: p.id, name: p.name })), scores: scoreboard(publicState) };
  if (state.status === 'completed') return { ...base, phase: 'completed', winnerIds: winnerIds(state) };
  if (state.status !== 'active') return { ...base, phase: state.status };
  if (!round) return { ...base, phase: 'between_rounds' };
  const view = { ...base, ...publicRound(round) };
  switch (round.phase) {
    case 'preparing': return { ...view, phase: 'preparing' };
    case 'ready': return { ...view, phase: 'ready', imageKey: round.id };
    case 'guessing':
      if (!clock || clock.roundId !== round.id || clock.timerGeneration !== round.timerGeneration) return { ...view, phase: 'interrupted', remainingMs: 0 };
      return { ...view, phase: 'guessing', imageKey: round.id, remainingMs: Math.max(0, clock.deadlineMonoMs - nowMonoMs) };
    case 'paused': return { ...view, phase: 'paused', remainingMs: round.remainingMs };
    case 'awaiting_judgment': case 'interrupted': return { ...view, phase: round.phase, remainingMs: 0 };
    case 'adjudicated': return { ...view, phase: 'adjudicated' };
    case 'answer_revealed': return { ...view, phase: 'answer_revealed', outcome: round.outcome, award: round.award, answer: { ...round.context.answer } };
    case 'cancelled': return { ...base, phase: 'between_rounds' };
  }
}
