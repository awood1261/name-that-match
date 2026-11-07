import type { CaptureMetadataV1 } from './capture.js';

export const DIFFICULTIES = ['squash', 'competitive', 'deathmatch'] as const;
export type Difficulty = typeof DIFFICULTIES[number];
export const DIFFICULTY_DETAILS = {
  squash: { label: 'Squash Match', points: 1 },
  competitive: { label: 'Competitive Match', points: 2 },
  deathmatch: { label: 'Deathmatch', points: 3 },
} as const;

export const OBSCURITIES = ['iconic', 'familiar', 'obscure'] as const;
export type Obscurity = typeof OBSCURITIES[number];
export const OBSCURITY_DETAILS = {
  iconic: { label: 'Iconic', definition: 'A widely recognized match that a broad wrestling audience is likely to know.' },
  familiar: { label: 'Familiar', definition: 'A recognizable match for fans familiar with its wrestlers, promotion, or era.' },
  obscure: { label: 'Obscure', definition: 'A match primarily recognizable to dedicated fans with deeper wrestling knowledge.' },
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

/** Domain data only; filesystem references and future HTTP/eligibility projections are separate. */
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
