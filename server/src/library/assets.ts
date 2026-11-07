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
export function publicScreenshot(storage: StorageSession, record: StoredScreenshot): ScreenshotSummary {
  const { imagePath, originalMetadataJson, ...publicRecord } = record;
  void imagePath; void originalMetadataJson;
  return { ...publicRecord, image: { ...record.image, url: `/api/screenshots/${record.id}/image` }, assetStatus: assessAsset(storage, record).status };
}
export function listScreenshots(storage: StorageSession, query: URLSearchParams) {
  const where: string[] = []; const values: string[] = [];
  for (const key of query.keys()) if (!['matchId', 'difficulty', 'review'].includes(key) || query.getAll(key).length !== 1) throw new HttpError(400, 'INVALID_QUERY', 'Unsupported or repeated screenshot query.');
  const matchId = query.get('matchId');
  if (matchId !== null) {
    if (matchId === 'unassigned') where.push('match_id IS NULL');
    else { requireId(matchId, 'matchId'); where.push('match_id=?'); values.push(matchId); }
  }
  for (const [key, column, allowed] of [['difficulty', 'difficulty', [...DIFFICULTIES, 'unrated']], ['review', 'review_status', REVIEW_STATUSES]] as const) {
    const filter = query.get(key); if (filter === null) continue;
    const terms = filter.split(',');
    if (!terms.length || terms.some((term) => !(allowed as readonly string[]).includes(term)) || new Set(terms).size !== terms.length) throw new HttpError(400, 'INVALID_QUERY', `Invalid ${key} filter.`);
    where.push(`(${terms.map((term) => term === 'unrated' ? `${column} IS NULL` : `${column}=?`).join(' OR ')})`);
    values.push(...terms.filter((term) => term !== 'unrated'));
  }
  const rows = storage.db.prepare(`SELECT id FROM screenshots ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY captured_at ASC,id ASC`).all(...values) as Array<{ id: string }>;
  const repository = createLibraryRepository(storage.db);
  const screenshots: ScreenshotSummary[] = rows.map(({ id }) => {
    return publicScreenshot(storage, repository.getScreenshot(id));
  });
  return { screenshots, matchedCount: screenshots.length, asOf: new Date().toISOString() };
}
