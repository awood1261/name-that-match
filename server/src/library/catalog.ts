import type { Match } from '../../../shared/src/library.js';
import { OBSCURITIES, DIFFICULTIES, REVIEW_STATUSES } from '../../../shared/src/library.js';
import type { MatchSummary } from '../../../shared/src/matches.js';
import type { ScreenshotSummary } from '../../../shared/src/imports.js';
import type { LibraryStatistics } from '../../../shared/src/classification.js';
import type { StorageSession } from '../storage.js';
import { createLibraryRepository } from './repository.js';
import { missingMatchFields } from './validation.js';
import { filterValues, publicScreenshot, screenshotFilter } from './assets.js';
import { HttpError } from './http/protocol.js';

/** One synchronous SQLite snapshot and one asset assessment per screenshot in this response. */
export function catalog(storage: StorageSession) {
  return storage.db.transaction(() => {
    const repo = createLibraryRepository(storage.db);
    const matches = (storage.db.prepare('SELECT id FROM matches ORDER BY created_at DESC,id ASC').all() as Array<{ id: string }>).map(({ id }) => repo.getMatch(id));
    const parents = new Map(matches.map((match) => [match.id, match]));
    const screenshots = (storage.db.prepare('SELECT id FROM screenshots ORDER BY captured_at ASC,id ASC').all() as Array<{ id: string }>).map(({ id }) => {
      const record = repo.getScreenshot(id); return publicScreenshot(storage, record, record.matchId ? parents.get(record.matchId)! : null);
    });
    const byMatch = new Map<string, ScreenshotSummary[]>();
    for (const record of screenshots) if (record.matchId) { const items = byMatch.get(record.matchId) ?? []; items.push(record); byMatch.set(record.matchId, items); }
    return { matches: matches.map((match) => matchSummary(match, byMatch.get(match.id) ?? [])), screenshots, asOf: new Date().toISOString() };
  })();
}
export function matchSummary(match: Match, screenshots: ScreenshotSummary[]): MatchSummary {
  const missingFields = missingMatchFields(match);
  const awaitingClassificationCount = screenshots.filter((record) => !record.classification.complete).length;
  return { ...match, complete: !missingFields.length, missingFields, screenshotCount: screenshots.length, matchingScreenshotCount: screenshots.length,
    approvedCount: screenshots.filter((record) => record.reviewStatus === 'approved').length,
    eligibleCount: screenshots.filter((record) => record.eligibility.eligible).length, awaitingClassificationCount,
    classificationIncomplete: match.obscurity === null || !screenshots.length || awaitingClassificationCount > 0 };
}
function filteredMatches(storage: StorageSession, query: URLSearchParams) {
  const allowed = ['q', 'obscurity', 'difficulty', 'review', 'tier', 'incomplete', 'classificationIncomplete'];
  for (const key of query.keys()) if (!allowed.includes(key) || query.getAll(key).length !== 1) throw new HttpError(400, 'INVALID_QUERY', 'Unsupported or repeated match query.');
  const q = query.get('q') ?? '';
  if (Array.from(q).length > 1000 || Array.from(q).some((character) => character.charCodeAt(0) < 32 || (character.charCodeAt(0) >= 127 && character.charCodeAt(0) <= 159))) throw new HttpError(400, 'INVALID_QUERY', 'Search is too long or contains control characters.');
  const normalize = (value: string) => value.normalize('NFC').toLowerCase();
  const obscurity = filterValues(query, 'obscurity', [...OBSCURITIES, 'unset']);
  for (const key of ['incomplete', 'classificationIncomplete']) if (query.has(key) && query.get(key) !== 'true') throw new HttpError(400, 'INVALID_QUERY', `Invalid ${key} filter.`);
  const matchesScreenshot = screenshotFilter(query); const hasScreenshotFilter = ['difficulty', 'review', 'tier'].some((key) => query.has(key));
  storage.db.function('library_normalize', { deterministic: true }, (value: unknown) => typeof value === 'string' ? normalize(value) : '');
  const predicates: string[] = []; const values: string[] = [];
  if (q) {
    predicates.push('(instr(library_normalize(participant_description), ?) > 0 OR instr(library_normalize(promotion), ?) > 0 OR instr(library_normalize(event), ?) > 0)');
    values.push(normalize(q), normalize(q), normalize(q));
  }
  const screenshotPredicates: string[] = [];
  for (const [key, column, allowed] of [['difficulty', 'difficulty', [...DIFFICULTIES, 'unrated']], ['review', 'review_status', REVIEW_STATUSES]] as const) {
    const terms = filterValues(query, key, allowed);
    if (terms.length) {
      screenshotPredicates.push(`(${terms.map((term) => term === 'unrated' ? `${column} IS NULL` : `${column}=?`).join(' OR ')})`);
      values.push(...terms.filter((term) => term !== 'unrated'));
    }
  }
  if (screenshotPredicates.length) predicates.push(`EXISTS (SELECT 1 FROM screenshots WHERE match_id=matches.id AND ${screenshotPredicates.join(' AND ')})`);
  const candidates = predicates.length ? new Set((storage.db.prepare(`SELECT id FROM matches WHERE ${predicates.join(' AND ')}`).all(...values) as Array<{ id: string }>).map(({ id }) => id)) : null;
  const data = catalog(storage);
  const associated = new Map<string, ScreenshotSummary[]>();
  for (const screenshot of data.screenshots) if (screenshot.matchId) { const rows = associated.get(screenshot.matchId) ?? []; rows.push(screenshot); associated.set(screenshot.matchId, rows); }
  const matches = data.matches.map((match) => ({ ...match, matchingScreenshotCount: (associated.get(match.id) ?? []).filter(matchesScreenshot).length })).filter((match) => (!candidates || candidates.has(match.id))
    && (!obscurity.length || obscurity.includes(match.obscurity ?? 'unset')) && (!query.has('incomplete') || !match.complete)
    && (!query.has('classificationIncomplete') || match.classificationIncomplete)
    && (!hasScreenshotFilter || match.matchingScreenshotCount > 0));
  return { matches, matchedCount: matches.length, asOf: data.asOf };
}
export function statistics(storage: StorageSession): LibraryStatistics {
  const data = catalog(storage); const classifiedByTier = { squash: 0, competitive: 0, deathmatch: 0 }; const eligibleByTier = { ...classifiedByTier };
  let fullyClassifiedScreenshots = 0;
  for (const record of data.screenshots) if (record.classification.tier) {
    fullyClassifiedScreenshots++; classifiedByTier[record.classification.tier]++;
    if (record.eligibility.eligible) eligibleByTier[record.classification.tier]++;
  }
  return { totalMatches: data.matches.length, totalScreenshots: data.screenshots.length, fullyClassifiedScreenshots,
    awaitingClassificationScreenshots: data.screenshots.length - fullyClassifiedScreenshots, classifiedByTier, eligibleByTier, asOf: data.asOf };
}

export function matchList(storage: StorageSession, query: URLSearchParams) {
  return storage.db.transaction(() => filteredMatches(storage, query))();
}
