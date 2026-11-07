import {
  DIFFICULTIES, OBSCURITIES, REVIEW_STATUSES,
  type Difficulty, type MatchFields, type Obscurity, type PartialDate,
  type ReviewStatus, type ScreenshotChanges,
} from '../../../shared/src/library.js';

export class DomainValidationError extends Error {
  constructor(public readonly fieldErrors: Record<string, string>) {
    super('Invalid library data');
    this.name = 'DomainValidationError';
  }
}

export function invalid(field: string, message: string): never {
  throw new DomainValidationError({ [field]: message });
}

export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid('record', 'Expected an object');
  return value as Record<string, unknown>;
}

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

export function knownFields(value: Record<string, unknown>, fields: readonly string[]): void {
  for (const key of Object.keys(value)) if (!fields.includes(key)) invalid(key, 'Unknown field');
}

export function isDifficulty(value: unknown): value is Difficulty {
  return DIFFICULTIES.some((entry) => entry === value);
}
export function isObscurity(value: unknown): value is Obscurity {
  return OBSCURITIES.some((entry) => entry === value);
}
export function isReviewStatus(value: unknown): value is ReviewStatus {
  return REVIEW_STATUSES.some((entry) => entry === value);
}

export function requireId(value: unknown, field = 'id'): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    invalid(field, 'Expected a UUID');
  }
  return value;
}

export function requireRevision(value: unknown, field = 'expectedRevision'): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) invalid(field, 'Expected a positive safe integer');
  return value;
}

export function nullableText(value: unknown, field: string, limit: number, notes = false): string | null {
  if (value === null) return null;
  if (typeof value !== 'string') invalid(field, 'Expected text or null');
  // Notes permit LF and TAB, but never other control characters, even at the edges.
  for (const character of value) {
    const code = character.charCodeAt(0);
    const control = code < 0x20 || (code >= 0x7f && code <= 0x9f);
    if (control && !(notes && (character === '\n' || character === '\t'))) {
      invalid(field, 'Control characters are not allowed');
    }
  }
  const normalized = value.trim();
  if (Array.from(normalized).length > limit) invalid(field, `Maximum ${limit} characters`);
  return normalized || null;
}

export function isPartialDate(value: unknown): value is PartialDate {
  if (typeof value !== 'string' || !/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1 || year > 9999) return false;
  if (month === undefined) return true;
  if (month < 1 || month > 12) return false;
  if (day === undefined) return true;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day >= 1 && day <= days[month - 1];
}

export const EMPTY_MATCH: Readonly<MatchFields> = Object.freeze({
  participantDescription: null, promotion: null, event: null, matchDate: null,
  obscurity: null, stipulation: null, championshipInfo: null, notes: null,
});
export const ANSWER_FIELDS = ['participantDescription', 'promotion', 'event', 'matchDate', 'stipulation', 'championshipInfo'] as const;
export const IDENTIFYING_FIELDS = ['participantDescription', 'promotion', 'event'] as const;

export function missingMatchFields(match: MatchFields): Array<typeof IDENTIFYING_FIELDS[number]> {
  return IDENTIFYING_FIELDS.filter((field) => !match[field]?.trim());
}

export function parseMatchChanges(value: unknown): Partial<MatchFields> {
  const input = object(value);
  knownFields(input, Object.keys(EMPTY_MATCH));
  const result: Partial<MatchFields> = {};
  for (const field of ['participantDescription', 'promotion', 'event', 'stipulation', 'championshipInfo', 'notes'] as const) {
    if (hasOwn(input, field)) {
      result[field] = nullableText(input[field], field, field === 'notes' ? 10000 : field === 'participantDescription' ? 1000 : 500, field === 'notes');
    }
  }
  if (hasOwn(input, 'matchDate')) {
    const date = nullableText(input.matchDate, 'matchDate', 10);
    if (date !== null && !isPartialDate(date)) invalid('matchDate', 'Expected a valid YYYY, YYYY-MM, or YYYY-MM-DD');
    result.matchDate = date;
  }
  if (hasOwn(input, 'obscurity')) {
    if (input.obscurity !== null && !isObscurity(input.obscurity)) invalid('obscurity', 'Unsupported obscurity');
    result.obscurity = input.obscurity;
  }
  return result;
}

export function parseScreenshotChanges(value: unknown): ScreenshotChanges {
  const input = object(value);
  knownFields(input, ['matchId', 'difficulty', 'notes']);
  const result: ScreenshotChanges = {};
  if (hasOwn(input, 'matchId')) result.matchId = input.matchId === null ? null : requireId(input.matchId, 'matchId');
  if (hasOwn(input, 'difficulty')) {
    if (input.difficulty !== null && !isDifficulty(input.difficulty)) invalid('difficulty', 'Unsupported difficulty');
    result.difficulty = input.difficulty;
  }
  if (hasOwn(input, 'notes')) result.notes = nullableText(input.notes, 'notes', 10000, true);
  return result;
}
