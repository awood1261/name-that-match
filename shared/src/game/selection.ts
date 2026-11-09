import { classify, eligiblePool, selectCandidate, type GameTier } from '../classification.js';
import type { GameState, RoundContext } from './contracts.js';
import { parseRoundContext, requireGame } from './validation.js';

/** Observations are supplied by the server library adapter; no I/O in this module. */
export interface GameCandidate {
  context: RoundContext | null; capturedAt: string;
  reviewStatus: 'pending' | 'approved' | 'rejected'; associated: boolean; imageAvailable: boolean;
}
export function exposedHistory(state: Pick<GameState, 'rounds'>) {
  const rounds = state.rounds.filter((round) => 'exposedAt' in round);
  return { matchIds: new Set(rounds.map((r) => 'context' in r && r.context ? r.context.matchId : '')),
    screenshotIds: new Set(rounds.map((r) => 'context' in r && r.context ? r.context.screenshotId : '')),
    hashes: new Set(rounds.map((r) => 'context' in r && r.context ? r.context.image.sha256 : '')) };
}
export interface EligibleGameCandidate extends GameCandidate { context: RoundContext }
export function unseenPool(candidates: readonly GameCandidate[], state: Pick<GameState, 'rounds'>, tier: GameTier): EligibleGameCandidate[] {
  const used = exposedHistory(state);
  const assessed = candidates.flatMap((candidate) => {
    if (!candidate.context || candidate.reviewStatus !== 'approved' || !candidate.associated || !candidate.imageAvailable) return [];
    const context = parseRoundContext(candidate.context);
    return [{ ...candidate, context, classification: classify(context.obscurity, context.difficulty),
      eligibility: { eligible: candidate.reviewStatus === 'approved' && candidate.associated && candidate.imageAvailable } }];
  });
  const seenIds = new Set<string>();
  const pool = eligiblePool(assessed, tier).filter((c) => {
    requireGame(!seenIds.has(c.context.screenshotId), 'validation', 'Duplicate candidate observation');
    seenIds.add(c.context.screenshotId);
    return !used.matchIds.has(c.context.matchId) && !used.screenshotIds.has(c.context.screenshotId) && !used.hashes.has(c.context.image.sha256);
  });
  return pool.sort((a, b) => a.capturedAt < b.capturedAt ? -1 : a.capturedAt > b.capturedAt ? 1 : a.context.screenshotId < b.context.screenshotId ? -1 : a.context.screenshotId > b.context.screenshotId ? 1 : 0);
}
export function chooseCandidate(candidates: readonly GameCandidate[], state: Pick<GameState, 'rounds'>, tier: GameTier, sample: number): EligibleGameCandidate | null {
  return selectCandidate(unseenPool(candidates, state, tier), sample);
}
