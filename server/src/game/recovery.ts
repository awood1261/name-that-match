import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import { currentRound, transition } from '../../../shared/src/game/engine.js';
import type { GameState, TransitionContext } from '../../../shared/src/game/contracts.js';
import { GameRepository } from './repository.js';

/** Called at startup, before a game service can publish or mutate recovered state. */
export function recoverGameSessions(db: Database.Database, nowIso = new Date().toISOString()): GameState | null {
  const repo = new GameRepository(db); const state = repo.current();
  if (!state) return null;
  const round = currentRound(state);
  const env: TransitionContext = { nowIso, nowMonoMs: 0, clock: null, hasEligibleMatches: false, primaryReady: false, candidateCurrent: false, awardId: randomUUID() };
  if (state.status !== 'active' || (round?.phase !== 'guessing' && round?.phase !== 'preparing')) return state;
  const next = transition(state, { type: round.phase === 'guessing' ? 'RECOVER_RUNNING' : 'RECOVER_PREPARING' }, env);
  repo.commit(state, next);
  return repo.load(next.id);
}
