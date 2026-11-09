import { classify, GAME_TIERS } from '../../../shared/src/classification.js';
import type { Match } from '../../../shared/src/library.js';
import { missingMatchFields } from './validation.js';
import type { ScreenshotSummary } from '../../../shared/src/imports.js';
import type { StorageSession } from '../storage.js';
import { getImportEngine } from './imports/engine.js';
import { validatePng } from './imports/png.js';
import { storageUnavailable } from './imports/contracts.js';
import { createLibraryRepository, type StoredScreenshot } from './repository.js';
import { DIFFICULTIES, REVIEW_STATUSES } from '../../../shared/src/library.js';
import { HttpError } from './http/protocol.js';
import { requireId } from './validation.js';

export function assessAsset(storage: StorageSession, record: StoredScreenshot): { status: ScreenshotSummary['assetStatus']; bytes?: Buffer } {
  try {
    if (record.imagePath !== `screenshots/${record.id}.png`) return { status: 'corrupt' };
    const engine = getImportEngine(storage);
    const bytes = engine.files.read(record.imagePath, engine.limits.imageBytes);
    const image = validatePng(bytes, engine.limits);
    return image.sha256 === record.image.sha256 && image.byteSize === record.image.byteSize
      && image.width === record.image.width && image.height === record.image.height ? { status: 'available', bytes } : { status: 'corrupt' };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { status: 'missing' };
    if (storageUnavailable(error)) return { status: 'unavailable' };
    return { status: 'corrupt' };
  }
}
export function imageBytes(storage: StorageSession, id: string): Buffer {
  const result = assessAsset(storage, createLibraryRepository(storage.db).getScreenshot(id));
  if (result.status !== 'available') throw new HttpError(result.status === 'missing' ? 404 : result.status === 'unavailable' ? 503 : 422,
    `ASSET_${result.status.toUpperCase()}`, `Screenshot image is ${result.status}.`);
  return result.bytes!;
}
export function publicScreenshot(storage: StorageSession, record: StoredScreenshot, parent?: Match | null, assessedStatus?: ScreenshotSummary['assetStatus']): ScreenshotSummary {
  const match = parent === undefined ? record.matchId ? createLibraryRepository(storage.db).getMatch(record.matchId) : null : parent;
  const assetStatus = assessedStatus ?? assessAsset(storage, record).status;
  if (assetStatus === 'unavailable') throw new HttpError(503, 'STORAGE_UNAVAILABLE', 'Screenshot storage is unavailable.');
  const classification = classify(match?.obscurity ?? null, record.difficulty);
  const reasons: string[] = [];
  if (assetStatus !== 'available') reasons.push(`image_${assetStatus}`);
  if (!match) reasons.push('unassigned');
  else {
    reasons.push(...missingMatchFields(match).map((field) => `missing_${field}`));
    if (match.obscurity === null) reasons.push('obscurity_unset');
  }
  if (record.difficulty === null) reasons.push('unrated');
  if (record.reviewStatus !== 'approved') reasons.push(`${record.reviewStatus}_review`);
  const { imagePath, originalMetadataJson, ...publicRecord } = record;
  void imagePath; void originalMetadataJson;
  return { ...publicRecord, image: { ...record.image, url: `/api/screenshots/${record.id}/image` }, assetStatus,
    classification: { ...classification, complete: classification.tier !== null },
    eligibility: { eligible: reasons.length === 0, reasons }, matchRevision: match?.revision ?? null };
}
export function listScreenshots(storage: StorageSession, query: URLSearchParams) {
  for (const key of query.keys()) if (!['matchId', 'difficulty', 'review', 'tier'].includes(key) || query.getAll(key).length !== 1) throw new HttpError(400, 'INVALID_QUERY', 'Unsupported or repeated screenshot query.');
  const matchId = query.get('matchId');
  if (matchId !== null && matchId !== 'unassigned') requireId(matchId, 'matchId');
  const predicate = screenshotFilter(query);
  return storage.db.transaction(() => {
    const rows = storage.db.prepare(`SELECT id FROM screenshots ${matchId === null ? '' : matchId === 'unassigned' ? 'WHERE match_id IS NULL' : 'WHERE match_id=?'} ORDER BY captured_at ASC,id ASC`).all(...(matchId && matchId !== 'unassigned' ? [matchId] : [])) as Array<{ id: string }>;
    const repository = createLibraryRepository(storage.db);
    const screenshots = rows.map(({ id }) => publicScreenshot(storage, repository.getScreenshot(id))).filter(predicate);
    return { screenshots, matchedCount: screenshots.length, asOf: new Date().toISOString() };
  })();
}
export function filterValues(query: URLSearchParams, key: string, allowed: readonly string[]): string[] {
  const raw = query.get(key); if (raw === null) return [];
  const terms = raw.split(',');
  if (query.getAll(key).length !== 1 || terms.some((term) => !allowed.includes(term)) || new Set(terms).size !== terms.length) throw new HttpError(400, 'INVALID_QUERY', `Invalid ${key} filter.`);
  return terms;
}
export function screenshotFilter(query: URLSearchParams): (record: ScreenshotSummary) => boolean {
  const difficulty = filterValues(query, 'difficulty', [...DIFFICULTIES, 'unrated']);
  const review = filterValues(query, 'review', REVIEW_STATUSES);
  const tier = filterValues(query, 'tier', [...GAME_TIERS, 'unclassified']);
  return (record) => (!difficulty.length || difficulty.includes(record.difficulty ?? 'unrated'))
    && (!review.length || review.includes(record.reviewStatus)) && (!tier.length || tier.includes(record.classification.tier ?? 'unclassified'));
}
