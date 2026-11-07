import type { Match, MatchFields } from './library.js';
/** Basic Milestone 4 projection. Association counts and eligibility arrive with richer browsing. */
export interface MatchSummary extends Match {
  complete: boolean;
  missingFields: Array<'participantDescription' | 'promotion' | 'event'>;
}
export interface MatchList { matches: MatchSummary[]; matchedCount: number; asOf: string }
export type MatchInput = Omit<MatchFields, 'matchDate'> & { matchDate: string | null };
export interface MatchUpdate { match: MatchSummary; invalidatedScreenshots: Array<{ id: string; revision: number }> }
export interface MatchPatch { expectedRevision: number; changes: Partial<MatchFields> }
