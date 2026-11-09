import { DIFFICULTIES, OBSCURITIES, type Obscurity, type VisualDifficulty } from './library.js';

export const GAME_TIERS = ['squash', 'competitive', 'deathmatch'] as const;
export type GameTier = typeof GAME_TIERS[number];
export const GAME_TIER_DETAILS = {
  squash: { label: 'Squash Match', points: 1 },
  competitive: { label: 'Competitive Match', points: 2 },
  deathmatch: { label: 'Deathmatch', points: 3 },
} as const;
export type Classification = { tier: GameTier; points: 1 | 2 | 3 } | { tier: null; points: null };
const matrix: Readonly<Record<Obscurity, Readonly<Record<VisualDifficulty, GameTier>>>> = {
  low: { easy: 'squash', medium: 'squash', hard: 'competitive' },
  medium: { easy: 'competitive', medium: 'competitive', hard: 'competitive' },
  high: { easy: 'competitive', medium: 'deathmatch', hard: 'deathmatch' },
};
export function classify(obscurity: Obscurity | null, difficulty: VisualDifficulty | null): Classification {
  if (obscurity !== null && !OBSCURITIES.includes(obscurity)) throw new Error('Invalid match obscurity');
  if (difficulty !== null && !DIFFICULTIES.includes(difficulty)) throw new Error('Invalid visual difficulty');
  if (obscurity === null || difficulty === null) return { tier: null, points: null };
  const tier = matrix[obscurity][difficulty];
  return { tier, points: GAME_TIER_DETAILS[tier].points };
}
export interface AssessedCandidate { classification: Classification; eligibility: { eligible: boolean } }
export function eligiblePool<T extends AssessedCandidate>(records: readonly T[], tier: GameTier): T[] {
  if (!GAME_TIERS.includes(tier)) throw new Error('Invalid game tier');
  return records.filter((record) => record.eligibility.eligible && record.classification.tier === tier);
}
export function selectCandidate<T>(pool: readonly T[], unitSample: number): T | null {
  if (!Number.isFinite(unitSample) || unitSample < 0 || unitSample >= 1) throw new Error('Expected a finite sample in [0,1)');
  return pool.length ? pool[Math.floor(unitSample * pool.length)] : null;
}
export interface LibraryStatistics {
  totalMatches: number; totalScreenshots: number; fullyClassifiedScreenshots: number; awaitingClassificationScreenshots: number;
  classifiedByTier: Record<GameTier, number>; eligibleByTier: Record<GameTier, number>; asOf: string;
}
