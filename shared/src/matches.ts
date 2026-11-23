import type { Match, MatchFields } from './library.js';
import type { LibraryStatistics } from './classification.js';
/** Saved match with authoritative identification, classification and association counts. */
export interface MatchSummary extends Match {
  matchingScreenshotCount: number;
  screenshotCount: number; approvedCount: number; eligibleCount: number; awaitingClassificationCount: number; classificationIncomplete: boolean;
  pendingCount: number;
  assetIssueCount: number;
  complete: boolean;
  missingFields: Array<'participantDescription' | 'promotion' | 'event'>;
}
export interface MatchList { matches: MatchSummary[]; matchedCount: number; asOf: string }
export interface ReviewQueueSummary {
  groups: Array<MatchSummary & { thumbnailUrl: string | null }>;
  intake: { screenshotCount: number; pendingCount: number };
  statistics: LibraryStatistics;
}
export type MatchInput = Omit<MatchFields, 'matchDate'> & { matchDate: string | null };
export interface MatchUpdate { match: MatchSummary; invalidatedScreenshots: Array<{ id: string; revision: number }> }
export interface MatchPatch { expectedRevision: number; changes: Partial<MatchFields> }
