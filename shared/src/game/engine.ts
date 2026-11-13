import { classify } from '../classification.js';
import {
  GUESSING_WINDOW_MS, MAX_GAME_TURNS,
  type GameState, type HostIntent, type InternalIntent, type Judgment, type Round, type TransitionContext, type CreateGame,
} from './contracts.js';
import { parseContestants, parseRoundContext, requireGame } from './validation.js';
import { exposedHistory } from './selection.js';

export function currentRound(state: GameState): Round | null {
  return state.rounds.find((r) => r.id === state.currentRoundId) ?? null;
}
export function phase(state: GameState): string { return state.status === 'active' ? currentRound(state)?.phase ?? 'between_rounds' : state.status; }
export function createState(input: CreateGame, nowIso: string): GameState {
  return { id: input.sessionId, stateVersion: 1, rulesVersion: 1, ...parseContestants(input.contestants, input.activeContestantId),
    status: 'setup', currentRoundId: null, rounds: [], awards: [], nextAttemptOrdinal: 1, nextTurnOrdinal: 1, createdAt: nowIso, updatedAt: nowIso };
}
export function transition(state: GameState, intent: HostIntent | InternalIntent, env: TransitionContext): GameState {
  const active = state.status === 'active'; const round = currentRound(state); const between = active && !round;
  const check = (condition: unknown) => requireGame(condition, 'invalid_transition', `Cannot ${intent.type} during ${phase(state)}`);
  requireGame(Number.isFinite(env.nowMonoMs) && env.nowMonoMs >= 0, 'validation', 'Invalid monotonic time');
  let next = { ...state, rounds: [...state.rounds], awards: [...state.awards] } as GameState;
  const replace = (value: Round) => { next.rounds = next.rounds.map((r) => r.id === value.id ? value : r); };
  const remaining = () => {
    requireGame(round?.phase === 'guessing' && env.clock?.roundId === round.id && env.clock.timerGeneration === round.timerGeneration, 'conflict', 'No current running clock');
    return Math.max(0, env.clock.deadlineMonoMs - env.nowMonoMs);
  };
  const adjudicate = (outcome: Judgment['outcome'], lateEntry = false, voidReason: Judgment['voidReason'] = null) => {
    requireGame(round && 'exposedAt' in round, 'invalid_transition', 'Round is not exposed');
    const points = classify(round.context.obscurity, round.context.difficulty).points!;
    const award = outcome === 'correct' ? points : 0;
    const stoppedRemainingMs = round.phase === 'guessing' ? remaining() : round.phase === 'paused' ? round.remainingMs : round.phase === 'awaiting_judgment' ? 0 : undefined;
    replace({ ...round, phase: 'adjudicated', outcome, award, lateEntry, voidReason, judgedAt: env.nowIso, ...(stoppedRemainingMs === undefined ? {} : { stoppedRemainingMs }) });
    if (award) next.awards.push({ id: env.awardId, roundId: round.id, contestantId: round.contestantId, points: award, createdAt: env.nowIso });
  };
  switch (intent.type) {
    case 'CONFIGURE_SETUP':
      check(state.status === 'setup'); next = { ...next, ...parseContestants(intent.contestants, intent.activeContestantId) }; break;
    case 'START':
      check(state.status === 'setup'); requireGame(env.hasEligibleMatches, 'empty_pool', 'No currently eligible matches'); next = { ...next, status: 'active' }; break;
    case 'DISCARD_SETUP':
      check(state.status === 'setup'); next = { ...next, status: 'discarded', currentRoundId: null, completedAt: env.nowIso }; break;
    case 'SELECT_CONTESTANT':
      check(between); requireGame(state.contestants.some((p) => p.id === intent.contestantId), 'validation', 'Contestant is not in this session'); next.activeContestantId = intent.contestantId; break;
    case 'PREPARE':
      check(between); requireGame(state.nextTurnOrdinal <= MAX_GAME_TURNS, 'limit', 'Session turn limit reached');
      requireGame(!state.rounds.some((r) => r.id === intent.roundId), 'conflict', 'Round identity already used');
      next.currentRoundId = intent.roundId;
      next.rounds.push({ id: intent.roundId, contestantId: state.activeContestantId, ordinal: state.nextAttemptOrdinal, requestedTier: intent.tier, createdAt: env.nowIso, timerGeneration: 0, phase: 'preparing' });
      next.nextAttemptOrdinal++; break;
    case 'PREPARE_SUCCEEDED': {
      check(active && round?.phase === 'preparing'); requireGame(round?.phase === 'preparing', 'invalid_transition', 'Not preparing');
      const context = parseRoundContext(intent.context); const used = exposedHistory(state);
      requireGame(classify(context.obscurity, context.difficulty).tier === round.requestedTier, 'conflict', 'Candidate does not match requested tier');
      requireGame(!used.matchIds.has(context.matchId) && !used.screenshotIds.has(context.screenshotId) && !used.hashes.has(context.image.sha256), 'conflict', 'Candidate was already exposed');
      requireGame(env.candidateCurrent, 'conflict', 'Candidate observation is stale');
      replace({ ...round, phase: 'ready', context }); break;
    }
    case 'CANCEL_UNEXPOSED': case 'PREPARE_FAILED': case 'RECOVER_PREPARING':
      check(active && (round?.phase === 'preparing' || (intent.type === 'CANCEL_UNEXPOSED' && round?.phase === 'ready')));
      requireGame(round && (round.phase === 'preparing' || round.phase === 'ready'), 'invalid_transition', 'Not unexposed');
      replace({ ...round, phase: 'cancelled', context: round.phase === 'ready' ? round.context : null, cancelReason: intent.type === 'RECOVER_PREPARING' ? 'recovery' : intent.type === 'PREPARE_FAILED' ? 'preparation-failed' : 'host' }); next.currentRoundId = null; break;
    case 'REVEAL_AND_START': {
      check(active && round?.phase === 'ready'); requireGame(round?.phase === 'ready', 'invalid_transition', 'Not ready');
      requireGame(env.primaryReady, 'not_ready', 'Primary display is not ready'); requireGame(env.candidateCurrent, 'conflict', 'Candidate changed before exposure');
      const used = exposedHistory(state);
      requireGame(!used.matchIds.has(round.context.matchId) && !used.screenshotIds.has(round.context.screenshotId) && !used.hashes.has(round.context.image.sha256), 'conflict', 'Candidate was already exposed');
      replace({ ...round, phase: 'guessing', windowMs: GUESSING_WINDOW_MS, exposedAt: env.nowIso, turnOrdinal: state.nextTurnOrdinal, timerGeneration: round.timerGeneration + 1 }); next.nextTurnOrdinal++; break;
    }
    case 'PAUSE': case 'CONNECTION_LOST': {
      check(active && round?.phase === 'guessing'); requireGame(round?.phase === 'guessing', 'invalid_transition', 'Not guessing');
      const ms = remaining();
      if (ms === 0) replace({ ...round, phase: 'awaiting_judgment' });
      else replace({ ...round, phase: 'paused', remainingMs: ms, pauseReason: intent.type === 'PAUSE' ? 'host' : intent.reason, timerGeneration: round.timerGeneration + 1 });
      break;
    }
    case 'RESUME':
      check(active && round?.phase === 'paused'); requireGame(round?.phase === 'paused', 'invalid_transition', 'Not paused');
      requireGame(env.primaryReady, 'not_ready', 'Primary display is not ready'); requireGame(env.candidateCurrent, 'unavailable', 'Pinned image is unavailable');
      replace({ ...round, phase: 'guessing', windowMs: round.remainingMs, timerGeneration: round.timerGeneration + 1 }); break;
    case 'EXPIRE':
      check(active && round?.phase === 'guessing'); requireGame(round?.phase === 'guessing' && round.timerGeneration === intent.timerGeneration && remaining() === 0, 'conflict', 'Stale or premature timer event');
      replace({ ...round, phase: 'awaiting_judgment' }); break;
    case 'CORRECT': case 'INCORRECT':
      check(active && round?.phase === 'guessing'); requireGame(remaining() > 0, 'invalid_transition', 'Guessing window expired'); adjudicate(intent.type === 'CORRECT' ? 'correct' : 'incorrect'); break;
    case 'CORRECT_BEFORE_BUZZER': case 'CONFIRM_TIMEOUT':
      check(active && round?.phase === 'awaiting_judgment'); adjudicate(intent.type === 'CORRECT_BEFORE_BUZZER' ? 'correct' : 'timeout', intent.type === 'CORRECT_BEFORE_BUZZER'); break;
    case 'VOID_EXPOSED':
      check(active && round && ['guessing', 'paused', 'awaiting_judgment'].includes(round.phase)); adjudicate('void', false, intent.reason); break;
    case 'VOID_INTERRUPTED':
      check(active && round?.phase === 'interrupted'); adjudicate('void', false, 'interrupted'); break;
    case 'RECOVER_RUNNING': case 'INTERRUPT_IMAGE':
      check(active && round && (round.phase === 'guessing' || (intent.type === 'INTERRUPT_IMAGE' && round.phase === 'paused')));
      requireGame(round && 'exposedAt' in round, 'invalid_transition', 'Not exposed'); replace({ ...round, phase: 'interrupted', timerGeneration: round.timerGeneration + 1 }); break;
    case 'REVEAL_ANSWER':
      check(active && round?.phase === 'adjudicated'); requireGame(round?.phase === 'adjudicated', 'invalid_transition', 'Not adjudicated'); replace({ ...round, phase: 'answer_revealed' }); break;
    case 'ADVANCE':
      check(active && round && (round.phase === 'answer_revealed' || (round.phase === 'adjudicated' && round.outcome === 'void'))); next.currentRoundId = null; break;
    case 'END_GAME':
      check(active && (!round || round.phase === 'adjudicated' || round.phase === 'answer_revealed')); next = { ...next, status: 'completed', completedAt: env.nowIso }; break;
    default: { const exhaustive: never = intent; return exhaustive; }
  }
  requireGame(Number.isSafeInteger(state.stateVersion + 1), 'limit', 'State revision exhausted');
  next.stateVersion = state.stateVersion + 1; next.updatedAt = env.nowIso;
  return next;
}
