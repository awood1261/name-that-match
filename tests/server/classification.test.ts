import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createServer } from '../../server/src/index';
import { initializeStorage, type StorageSession } from '../../server/src/storage';
import { createLibraryRepository } from '../../server/src/library/repository';
import { validatePng } from '../../server/src/library/imports/png';
import { DEFAULT_IMPORT_LIMITS } from '../../server/src/library/imports/limits';
import { getImportEngine } from '../../server/src/library/imports/engine';
import { statistics, matchList } from '../../server/src/library/catalog';
import { eligiblePool } from '../../shared/src/classification';
import type { ScreenshotSummary } from '../../shared/src/imports';
import { createTestResources, listen } from '../helpers/resources';
import { capture, png } from '../imports/fixtures';
describe('classification, review and library observations', () => {
  let resources: ReturnType<typeof createTestResources>; let storage: StorageSession; let base: string;
  beforeEach(async () => { resources = createTestResources(); storage = resources.storage(initializeStorage({ dataDir: resources.root })); base = await listen(resources.server(createServer(0, { dataDir: resources.root }))); });
  afterEach(async () => { vi.restoreAllMocks(); await resources.cleanup(); });
  const request = async (route: string, payload?: unknown) => {
    const response = await fetch(base + route, payload === undefined ? {} : { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'X-Name-That-Match': 'library' }, body: JSON.stringify(payload) });
    return { status: response.status, ...(await response.json()) };
  };
  function fixture(fields = {}) {
    const repo = createLibraryRepository(storage.db); const match = repo.createMatch({ participantDescription: 'A vs B', promotion: 'P', event: 'E', obscurity: 'low', ...fields });
    const metadata = capture(randomUUID()).metadata; const image = repo.insertCommittedScreenshot({ provenance: metadata, originalMetadataJson: JSON.stringify(metadata), image: validatePng(png, { ...DEFAULT_IMPORT_LIMITS }) });
    fs.writeFileSync(path.join(storage.rootDir, image.imagePath), png);
    const assigned = repo.updateScreenshot(image.id, image.revision, { matchId: match.id, difficulty: 'easy' }, match.revision);
    return { repo, match, image: assigned };
  }
  async function readImage(id: string): Promise<ScreenshotSummary> { return (await request('/api/screenshots')).data.screenshots.find((record: ScreenshotSummary) => record.id === id); }
  const review = (record: ScreenshotSummary, status: string) => request(`/api/screenshots/${record.id}`, { expectedRevision: record.revision, expectedMatchRevision: record.matchRevision ?? undefined, reviewStatus: status });
  it('derives all nine combinations, distinguishes classification from eligibility and refreshes parent changes without child writes', async () => {
    const { repo, match, image } = fixture();
    let parent = match;
    const expected = ['squash', 'squash', 'competitive', 'competitive', 'competitive', 'competitive', 'competitive', 'deathmatch', 'deathmatch']; let index = 0;
    for (const obscurity of ['low', 'medium', 'high']) {
      parent = repo.updateMatch(parent.id, parent.revision, { obscurity }).match;
      for (const difficulty of ['easy', 'medium', 'hard']) {
        const current = repo.getScreenshot(image.id); repo.updateScreenshot(current.id, current.revision, { difficulty });
        const record = await readImage(image.id); expect(record.classification).toMatchObject({ complete: true, tier: expected[index++] });
        expect(record.eligibility).toEqual({ eligible: false, reasons: ['pending_review'] });
      }
    }
    let record = await readImage(image.id); expect((await review(record, 'approved')).status).toBe(200); record = await readImage(image.id);
    const before = repo.getScreenshot(image.id); parent = repo.updateMatch(parent.id, parent.revision, { obscurity: 'low' }).match;
    expect(repo.getScreenshot(image.id)).toEqual(before); expect((await readImage(image.id)).classification).toMatchObject({ tier: 'competitive', points: 2 });
    expect((await review(record, 'approved')).status).toBe(409);
    parent = repo.updateMatch(parent.id, parent.revision, { obscurity: null }).match;
    const unset = await readImage(image.id); expect(unset.reviewStatus).toBe('approved'); expect(unset.eligibility.reasons).toEqual(['obscurity_unset']);
    expect(unset.classification.tier).toBeNull(); expect(eligiblePool([unset], 'competitive')).toEqual([]);
  });
  it('checks review prerequisites, material/notes/no-op edits, stale writes and explicit pending/rejected states', async () => {
    const { repo, match, image } = fixture({ event: null }); let record = await readImage(image.id);
    expect((await review(record, 'approved')).status).toBe(422);
    const parent = repo.updateMatch(match.id, match.revision, { event: 'E' }).match; record = await readImage(image.id);
    expect((await review(record, 'approved')).status).toBe(200); record = await readImage(image.id);
    const edit = async (changes: object, current = record) => request(`/api/screenshots/${image.id}`, { expectedRevision: current.revision, changes });
    const notes = await edit({ notes: 'note' }); expect(notes.data.reviewStatus).toBe('approved');
    expect((await edit({ notes: 'again' })).status).toBe(409); record = notes.data;
    expect((await edit({ notes: 'note' })).data.revision).toBe(record.revision);
    const changed = await edit({ difficulty: 'medium' }); expect(changed.data.reviewStatus).toBe('pending'); expect(changed.data.classification.tier).toBe('squash');
    record = changed.data; expect((await review(record, 'rejected')).data.reviewStatus).toBe('rejected'); record = await readImage(image.id);
    expect((await review(record, 'pending')).data.reviewStatus).toBe('pending'); record = await readImage(image.id);
    for (const difficulty of [null, 'squash', 'invalid']) {
      const result = await edit({ difficulty }); expect(result.status).toBe(difficulty === null ? 200 : 422);
      if (difficulty === null) { record = result.data; expect((await review(record, 'approved')).status).toBe(422); }
    }
    expect((await edit({ tier: 'deathmatch' })).status).toBe(400);
    expect((await request(`/api/screenshots/${image.id}`, { expectedRevision: record.revision, expectedMatchRevision: parent.revision, changes: {}, reviewStatus: 'approved' })).status).toBe(400);
  });
  it('reports actual global totals, reassesses missing/corrupt/restored assets, and never invents zero on I/O uncertainty', async () => {
    const { image } = fixture(); const record = await readImage(image.id); await review(record, 'approved');
    const stats = () => request('/api/library/statistics');
    expect((await stats()).data).toMatchObject({ totalMatches: 1, totalScreenshots: 1, fullyClassifiedScreenshots: 1, awaitingClassificationScreenshots: 0, eligibleByTier: { squash: 1, competitive: 0, deathmatch: 0 } });
    const file = path.join(storage.rootDir, image.imagePath); fs.unlinkSync(file);
    expect((await review(await readImage(image.id), 'approved')).status).toBe(422);
    expect((await stats()).data.eligibleByTier.squash).toBe(0); expect((await stats()).data.fullyClassifiedScreenshots).toBe(1);
    fs.writeFileSync(file, 'corrupt'); expect((await readImage(image.id)).eligibility.reasons).toEqual(['image_corrupt']);
    fs.writeFileSync(file, png); expect((await stats()).data.eligibleByTier.squash).toBe(1);
    const error = Object.assign(new Error('unavailable'), { code: 'EIO' });
    vi.spyOn(getImportEngine(storage).files, 'read').mockImplementation(() => { throw error; });
    // Direct observation uses this connection's engine and must fail, never return made-up counts.
    expect(() => statistics(storage)).toThrow(/unavailable/);
  });
  it('combines screenshot filters on one row and keeps global/card counts independent of literal Unicode search', async () => {
    const { repo, match, image } = fixture({ participantDescription: 'Café 100%_ vs B' });
    let first = await readImage(image.id); await review(first, 'approved');
    const second = fixture().image; repo.updateScreenshot(second.id, second.revision, { matchId: match.id, difficulty: 'hard' }, match.revision);
    expect((await request('/api/matches?difficulty=hard&review=approved')).data.matches).toHaveLength(0);
    const found = (await request('/api/matches?q=CAFE%CC%81%20100%25_&difficulty=easy&review=approved&tier=squash')).data;
    expect(found.matches).toHaveLength(1); expect(found.matches[0]).toMatchObject({ screenshotCount: 2, matchingScreenshotCount: 1, approvedCount: 1, eligibleCount: 1 });
    const subset = (await request(`/api/screenshots?matchId=${match.id}&difficulty=easy&review=approved&tier=squash`)).data;
    expect(found.matches[0].matchingScreenshotCount).toBe(subset.matchedCount);
    expect((await request('/api/matches')).data.matches.find((row: { id: string }) => row.id === match.id)).toMatchObject({ screenshotCount: 2, matchingScreenshotCount: 2 });
    expect((await request('/api/matches?q=absent')).data.matches).toHaveLength(0);
    expect((await request('/api/library/statistics')).data.totalMatches).toBe(2);
    for (const query of ['tier=easy', 'q=a&q=b', 'classificationIncomplete=false', 'surprise=yes']) expect((await request(`/api/matches?${query}`)).status).toBe(400);
    first = await readImage(image.id); const reopened = resources.storage(initializeStorage({ dataDir: resources.root }));
    expect(createLibraryRepository(reopened.db).getScreenshot(image.id)).toMatchObject({ difficulty: first.difficulty, reviewStatus: 'approved', matchId: match.id });
  });
  it('scales observations to hundreds of matches with one bounded asset read per committed screenshot', () => {
    const { repo } = fixture();
    for (let index = 0; index < 300; index++) {
      const parent = repo.createMatch({ participantDescription: `Draft ${index}` });
      const metadata = capture(randomUUID()).metadata;
      const record = repo.insertCommittedScreenshot({ provenance: metadata, originalMetadataJson: JSON.stringify(metadata), image: validatePng(png, { ...DEFAULT_IMPORT_LIMITS }) });
      repo.updateScreenshot(record.id, record.revision, { matchId: parent.id }, parent.revision);
      // Equal hashes at distinct paths must never share a permanent availability result.
      if (index !== 17) fs.writeFileSync(path.join(storage.rootDir, record.imagePath), png);
    }
    const read = vi.spyOn(getImportEngine(storage).files, 'read');
    const result = matchList(storage, new URLSearchParams('classificationIncomplete=true'));
    expect(result.matchedCount).toBe(300); expect(read).toHaveBeenCalledTimes(301);
    expect(statistics(storage).totalMatches).toBe(301);
  });
});
