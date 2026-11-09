import { describe, expect, it } from 'vitest';
import { classify, eligiblePool, selectCandidate, GAME_TIER_DETAILS, type GameTier } from '../../shared/src/classification';
import { DIFFICULTIES, OBSCURITIES, type Obscurity, type Difficulty } from '../../shared/src/library';
const expected: GameTier[] = ['squash', 'squash', 'competitive', 'competitive', 'competitive', 'competitive', 'competitive', 'deathmatch', 'deathmatch'];
describe('approved classification and future pool helpers', () => {
  it('implements exactly all nine cells and base points', () => {
    const actual = OBSCURITIES.flatMap((obscurity) => DIFFICULTIES.map((difficulty) => classify(obscurity, difficulty)));
    expect(actual.map((result) => result.tier)).toEqual(expected);
    expect(actual.map((result) => result.points)).toEqual([1, 1, 2, 2, 2, 2, 2, 3, 3]);
    for (const result of actual) expect(result.points).toBe(GAME_TIER_DETAILS[result.tier!].points);
    expect(['squash', 'competitive', 'deathmatch'].map((tier) => actual.filter((result) => result.tier === tier).length)).toEqual([2, 5, 2]);
  });
  it('leaves missing inputs unclassified and rejects invalid runtime values even alongside null', () => {
    for (const obscurity of [...OBSCURITIES, null]) expect(classify(obscurity, null)).toEqual({ tier: null, points: null });
    for (const difficulty of DIFFICULTIES) expect(classify(null, difficulty)).toEqual({ tier: null, points: null });
    for (const value of ['iconic', '', undefined, 1]) expect(() => classify(value as Obscurity, null)).toThrow();
    for (const value of ['squash', '', undefined, 1]) expect(() => classify(null, value as Difficulty)).toThrow();
  });
  it('filters by current eligibility and tier independently of random selection', () => {
    const records = expected.map((tier, index) => ({ index, classification: { tier, points: GAME_TIER_DETAILS[tier].points }, eligibility: { eligible: index !== 0 } }));
    const pool = eligiblePool(records, 'squash'); expect(pool.map((item) => item.index)).toEqual([1]);
    expect(selectCandidate(pool, 0)).toBe(pool[0]); expect(selectCandidate(records, 0.999999)).toBe(records.at(-1));
    expect(selectCandidate([], 0)).toBeNull();
    for (const sample of [-1, 1, NaN, Infinity]) expect(() => selectCandidate([], sample)).toThrow();
    expect(() => eligiblePool(records, 'easy' as GameTier)).toThrow();
  });
});
