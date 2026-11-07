import type { MatchInput, MatchSummary } from '../../../shared/src/matches';
import type { MatchFields, Obscurity } from '../../../shared/src/library';
export type MatchDraft = Record<keyof MatchFields, string>;
export const MATCH_LABELS = { participantDescription: 'Participants', promotion: 'Promotion', event: 'Event', matchDate: 'Date / year', obscurity: 'Match obscurity', stipulation: 'Stipulation', championshipInfo: 'Championship information', notes: 'Match notes' } as const;
export function draftFor(match?: MatchSummary | null): MatchDraft {
  return Object.fromEntries(Object.keys(MATCH_LABELS).map((key) => [key, match?.[key as keyof MatchFields] ?? ''])) as MatchDraft;
}
export function matchPayload(draft: MatchDraft): MatchInput {
  return { participantDescription: draft.participantDescription.trim() || null, promotion: draft.promotion.trim() || null,
    event: draft.event.trim() || null, matchDate: draft.matchDate.trim() || null, obscurity: draft.obscurity as Obscurity || null,
    stipulation: draft.stipulation.trim() || null, championshipInfo: draft.championshipInfo.trim() || null, notes: draft.notes.trim() || null };
}
export function draftChanged(draft: MatchDraft, base?: MatchSummary | null) {
  return !base || JSON.stringify(matchPayload(draft)) !== JSON.stringify(matchPayload(draftFor(base)));
}
