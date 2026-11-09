import type { CaptureMetadataV1 } from './capture.js';

export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export type VisualDifficulty = typeof DIFFICULTIES[number];
export type Difficulty = VisualDifficulty;
export const DIFFICULTY_DETAILS = {
  easy: { label: 'Easy', definition: 'Clear visual clues make identification straightforward.' },
  medium: { label: 'Medium', definition: 'Some recognizable clues require additional knowledge.' },
  hard: { label: 'Hard', definition: 'Limited, misleading or ambiguous visual clues.' },
} as const;
export const OBSCURITIES = ['low', 'medium', 'high'] as const;
export type Obscurity = typeof OBSCURITIES[number];
export const OBSCURITY_DETAILS = {
  low: { label: 'Low', definition: 'A widely recognizable or historically prominent match.' },
  medium: { label: 'Medium', definition: 'Knowledgeable fans may recognize this match.' },
  high: { label: 'High', definition: 'An obscure match requiring deeper wrestling knowledge.' },
} as const;

export const REVIEW_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type ReviewStatus = typeof REVIEW_STATUSES[number];

/** Validated canonical YYYY, YYYY-MM, or YYYY-MM-DD; unknown precision is never invented. */
declare const partialDateBrand: unique symbol;
export type PartialDate = string & { readonly [partialDateBrand]: true };

export interface MatchFields {
  participantDescription: string | null;
  promotion: string | null;
  event: string | null;
  matchDate: PartialDate | null;
  obscurity: Obscurity | null;
  stipulation: string | null;
  championshipInfo: string | null;
  notes: string | null;
}

export interface Match extends MatchFields {
  id: string;
  createdAt: string;
  updatedAt: string;
  revision: number;
}

export interface ScreenshotChanges {
  matchId?: string | null;
  difficulty?: Difficulty | null;
  notes?: string | null;
}

/** Domain data only; filesystem references and HTTP/eligibility projections are separate. */
export interface Screenshot {
  id: string;
  matchId: string | null;
  provenance: CaptureMetadataV1;
  originalMetadataJson: string;
  image: { sha256: string; width: number; height: number; byteSize: number };
  difficulty: Difficulty | null;
  reviewStatus: ReviewStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  revision: number;
}
