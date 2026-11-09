import { GAME_TIERS, classify, type GameTier } from '../classification.js';
import { DIFFICULTIES, OBSCURITIES, type PartialDate } from '../library.js';
import type { CommandEnvelope, Contestant, CreateGame, HostIntent, RoundContext } from './contracts.js';

export class GameError extends Error {
  constructor(public readonly code: 'validation' | 'conflict' | 'invalid_transition' | 'empty_pool' | 'not_ready' | 'unavailable' | 'limit' | 'not_found', message: string) {
    super(message); this.name = 'GameError';
  }
}
export function requireGame(condition: unknown, code: GameError['code'], message: string): asserts condition {
  if (!condition) throw new GameError(code, message);
}
export function record(input: unknown, fields: readonly string[]): Record<string, unknown> {
  requireGame(input && typeof input === 'object' && !Array.isArray(input), 'validation', 'Expected an object');
  const obj = input as Record<string, unknown>;
  requireGame(Object.keys(obj).every((key) => fields.includes(key)), 'validation', 'Unknown field');
  return obj;
}
export function id(input: unknown): string {
  requireGame(typeof input === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(input), 'validation', 'Expected a canonical UUID');
  return input;
}
export function positive(input: unknown): number {
  requireGame(typeof input === 'number' && Number.isSafeInteger(input) && input > 0, 'validation', 'Expected a positive safe integer');
  return input;
}
export function text(input: unknown, limit: number): string {
  requireGame(typeof input === 'string', 'validation', 'Expected text');
  const clean = input.trim();
  requireGame(clean.length && Array.from(clean).length <= limit && Array.from(input).every((char) => { const code = char.codePointAt(0)!; return code >= 32 && (code < 127 || code > 159); }), 'validation', 'Invalid text');
  return clean;
}
export function parseContestants(input: unknown, selected: unknown): { contestants: Contestant[]; activeContestantId: string } {
  requireGame(Array.isArray(input) && input.length >= 1 && input.length <= 2, 'validation', 'Expected one or two contestants');
  const contestants = input.map((value) => {
    const row = record(value, ['id', 'name']); return { id: id(row.id), name: text(row.name, 60) };
  });
  requireGame(new Set(contestants.map((p) => p.id)).size === contestants.length && new Set(contestants.map((p) => p.name.toLowerCase())).size === contestants.length, 'validation', 'Contestants must be distinct');
  const activeContestantId = id(selected);
  requireGame(contestants.some((p) => p.id === activeContestantId), 'validation', 'Selected contestant is not in this session');
  return { contestants, activeContestantId };
}
function tier(input: unknown): GameTier {
  requireGame(GAME_TIERS.some((t) => t === input), 'validation', 'Invalid requested tier'); return input as GameTier;
}
export function parseIntent(input: unknown): HostIntent {
  const base = record(input, ['type', 'contestants', 'activeContestantId', 'contestantId', 'roundId', 'tier', 'reason']);
  switch (base.type) {
    case 'CONFIGURE_SETUP': {
      const value = record(input, ['type', 'contestants', 'activeContestantId']); return { type: base.type, ...parseContestants(value.contestants, value.activeContestantId) };
    }
    case 'SELECT_CONTESTANT': record(input, ['type', 'contestantId']); return { type: base.type, contestantId: id(base.contestantId) };
    case 'PREPARE': record(input, ['type', 'roundId', 'tier']); return { type: base.type, roundId: id(base.roundId), tier: tier(base.tier) };
    case 'VOID_EXPOSED':
      record(input, ['type', 'reason']); requireGame(base.reason === 'skip' || base.reason === 'void', 'validation', 'Invalid void reason'); return { type: base.type, reason: base.reason };
    case 'START': case 'DISCARD_SETUP': case 'REVEAL_AND_START': case 'CORRECT': case 'INCORRECT':
    case 'CORRECT_BEFORE_BUZZER': case 'CONFIRM_TIMEOUT': case 'PAUSE': case 'RESUME':
    case 'CANCEL_UNEXPOSED': case 'VOID_INTERRUPTED': case 'REVEAL_ANSWER': case 'ADVANCE': case 'END_GAME':
      record(input, ['type']); return { type: base.type };
    default: throw new GameError('validation', 'Unknown host command');
  }
}
export function parseCommand(input: unknown): CommandEnvelope {
  const value = record(input, ['protocolVersion', 'commandId', 'sessionId', 'roundId', 'expectedStateVersion', 'type', 'payload']);
  requireGame(value.protocolVersion === 1, 'validation', 'Unsupported protocol');
  const payload = record(value.payload, ['contestants', 'activeContestantId', 'contestantId', 'roundId', 'tier', 'reason']);
  const { type, ...parsed } = parseIntent({ ...payload, type: value.type });
  return { protocolVersion: 1, commandId: id(value.commandId), sessionId: id(value.sessionId), expectedStateVersion: positive(value.expectedStateVersion),
    ...(value.roundId === undefined ? {} : { roundId: id(value.roundId) }), type, payload: parsed } as CommandEnvelope;
}
export function parseCreateGame(input: unknown): CreateGame {
  const value = record(input, ['protocolVersion', 'commandId', 'sessionId', 'contestants', 'activeContestantId']);
  requireGame(value.protocolVersion === 1, 'validation', 'Unsupported protocol');
  return { protocolVersion: 1, commandId: id(value.commandId), sessionId: id(value.sessionId), ...parseContestants(value.contestants, value.activeContestantId) };
}
function nullable(input: unknown, limit: number): string | null { return input === null ? null : text(input, limit); }
function partialDate(input: unknown): PartialDate | null {
  if (input === null) return null;
  requireGame(typeof input === 'string' && /^\d{4}(?:-\d{2}(?:-\d{2})?)?$/.test(input), 'validation', 'Invalid partial date');
  const [y, m, d] = input.split('-').map(Number);
  const days = [31, y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  requireGame(y >= 1 && y <= 9999 && (m === undefined || (m >= 1 && m <= 12)) && (d === undefined || (d >= 1 && d <= days[m - 1])), 'validation', 'Invalid partial date');
  return input as PartialDate;
}
export function parseRoundContext(input: unknown): RoundContext {
  const v = record(input, ['screenshotId', 'matchId', 'screenshotRevision', 'matchRevision', 'image', 'answer', 'obscurity', 'difficulty', 'rulesVersion']);
  const image = record(v.image, ['sha256', 'width', 'height', 'byteSize']);
  requireGame(typeof image.sha256 === 'string' && /^[a-f0-9]{64}$/.test(image.sha256), 'validation', 'Invalid image identity');
  const a = record(v.answer, ['participantDescription', 'promotion', 'event', 'matchDate', 'stipulation', 'championshipInfo']);
  requireGame(OBSCURITIES.some((x) => x === v.obscurity) && DIFFICULTIES.some((x) => x === v.difficulty) && v.rulesVersion === 1, 'validation', 'Unsupported classification/rules');
  const result: RoundContext = {
    screenshotId: id(v.screenshotId), matchId: id(v.matchId), screenshotRevision: positive(v.screenshotRevision), matchRevision: positive(v.matchRevision),
    image: { sha256: image.sha256, width: positive(image.width), height: positive(image.height), byteSize: positive(image.byteSize) },
    answer: { participantDescription: text(a.participantDescription, 1000), promotion: text(a.promotion, 500), event: text(a.event, 500), matchDate: partialDate(a.matchDate), stipulation: nullable(a.stipulation, 500), championshipInfo: nullable(a.championshipInfo, 500) },
    obscurity: v.obscurity as RoundContext['obscurity'], difficulty: v.difficulty as RoundContext['difficulty'], rulesVersion: 1,
  };
  classify(result.obscurity, result.difficulty);
  return result;
}
