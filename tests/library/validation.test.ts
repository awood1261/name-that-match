import { describe, expect, it } from 'vitest';
import { DIFFICULTIES, DIFFICULTY_DETAILS, OBSCURITIES, OBSCURITY_DETAILS, REVIEW_STATUSES } from '../../shared/src/library';
import {
  DomainValidationError, EMPTY_MATCH, isDifficulty, isObscurity, isPartialDate,
  isReviewStatus, missingMatchFields, parseMatchChanges, parseScreenshotChanges, requireId, requireRevision,
} from '../../server/src/library/validation';

describe('library classifications and domain validation', () => {
  it('defines exactly the approved classifications and point meanings', () => {
    expect(DIFFICULTIES).toEqual(['easy', 'medium', 'hard']);
    expect(Object.values(DIFFICULTY_DETAILS).map((entry) => entry.label)).toEqual(['Easy', 'Medium', 'Hard']);
    expect(OBSCURITIES).toEqual(['low', 'medium', 'high']);
    expect(REVIEW_STATUSES).toEqual(['pending', 'approved', 'rejected']);
    for (const value of DIFFICULTIES) expect(isDifficulty(value)).toBe(true);
    for (const value of OBSCURITIES) {
      expect(isObscurity(value)).toBe(true);
      expect(OBSCURITY_DETAILS[value].definition.length).toBeGreaterThan(30);
    }
    for (const value of REVIEW_STATUSES) expect(isReviewStatus(value)).toBe(true);
    for (const value of [null, undefined, '', 'invalid', 'unknown', 1, {}, []]) {
      expect(isDifficulty(value)).toBe(false); expect(isObscurity(value)).toBe(false); expect(isReviewStatus(value)).toBe(false);
    }
  });

  it.each(['0001', '2026', '9999', '2026-11', '2026-11-06', '2000-02-29', '2024-02-29'])('accepts canonical partial/full date %s', (date) => {
    expect(isPartialDate(date)).toBe(true);
    expect(parseMatchChanges({ matchDate: ` ${date} ` })).toEqual({ matchDate: date });
  });
  it.each(['0000', '10000', '26', '2026-1', '2026-00', '2026-13', '2026-02-29', '1900-02-29', '2026-04-31', '2026-01-00', '2026-01-32', '2026-11-06T00:00:00Z'])('rejects invalid date %s without inventing components', (date) => {
    expect(isPartialDate(date)).toBe(false);
    expect(() => parseMatchChanges({ matchDate: date })).toThrow(DomainValidationError);
  });
  it.each(['Cody Rhodes vs Roman Reigns', 'The Young Bucks vs FTR', 'Kenny Omega vs PAC vs Orange Cassidy', 'Team A vs Team B'])('accepts participant description %s', (participantDescription) => {
    expect(parseMatchChanges({ participantDescription })).toEqual({ participantDescription });
  });
  it('normalizes text, supports incomplete drafts, and derives only identifying completeness', () => {
    expect(parseMatchChanges({ promotion: '  Example  Promotion  ', event: '', matchDate: '', notes: '\tLine one\nLine two  ' }))
      .toEqual({ promotion: 'Example  Promotion', event: null, matchDate: null, notes: 'Line one\nLine two' });
    expect(missingMatchFields(EMPTY_MATCH)).toEqual(['participantDescription', 'promotion', 'event']);
    const identified = { ...EMPTY_MATCH, ...parseMatchChanges({ participantDescription: 'A vs B', promotion: 'P', event: 'E' }) };
    expect(missingMatchFields(identified)).toEqual([]);
    expect(identified.matchDate).toBeNull(); expect(identified.obscurity).toBeNull();
    expect(parseScreenshotChanges({ difficulty: null, matchId: null, notes: '  ' })).toEqual({ difficulty: null, matchId: null, notes: null });
  });
  it('enforces field bounds and control-character policy without stripping bad input', () => {
    expect(() => parseMatchChanges({ participantDescription: 'x'.repeat(1001) })).toThrow(DomainValidationError);
    expect(() => parseMatchChanges({ promotion: 'x'.repeat(501) })).toThrow(DomainValidationError);
    expect(() => parseMatchChanges({ notes: 'x'.repeat(10001) })).toThrow(DomainValidationError);
    expect(parseMatchChanges({ participantDescription: '🥇'.repeat(1000) }).participantDescription).toHaveLength(2000);
    for (const value of ['\0evil', 'trailing\n', '\tbefore', '\u0085']) {
      expect(() => parseMatchChanges({ event: value })).toThrow(DomainValidationError);
    }
    expect(() => parseScreenshotChanges({ notes: 'note\r\n' })).toThrow(DomainValidationError);
  });
  it('rejects unknown fields, invalid enums and implicit undefined rather than overwriting', () => {
    for (const value of [null, [], 2, { event: undefined }, { obscure: 'low' }, { obscurity: 'legendary' }, { obscurity: 'iconic' }, { obscurity: 'familiar' }, { obscurity: 'obscure' }]) {
      expect(() => parseMatchChanges(value)).toThrow(DomainValidationError);
    }
    for (const value of [{ difficulty: 1 }, { reviewStatus: 'approved' }, { provenance: {} }, { matchId: '../outside' }, { notes: undefined }]) {
      expect(() => parseScreenshotChanges(value)).toThrow(DomainValidationError);
    }
    for (const obscurity of OBSCURITIES) expect(parseMatchChanges({ obscurity })).toEqual({ obscurity });
    for (const difficulty of DIFFICULTIES) expect(parseScreenshotChanges({ difficulty })).toEqual({ difficulty });
    expect(parseMatchChanges({ obscurity: null })).toEqual({ obscurity: null });
  });
  it('validates UUIDs/revisions and exposes field-level errors', () => {
    for (const revision of [0, -1, 1.2, Infinity, NaN, '1', Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => requireRevision(revision)).toThrow(DomainValidationError);
    }
    expect(requireRevision(1)).toBe(1);
    expect(() => requireId('capture-id')).toThrow(DomainValidationError);
    try { parseMatchChanges({ obscurity: 'invalid' }); }
    catch (error) { expect((error as DomainValidationError).fieldErrors).toEqual({ obscurity: 'Unsupported obscurity' }); }
  });
});
