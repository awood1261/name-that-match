import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createServer } from '../../server/src/index';
import { initializeStorage, type StorageSession } from '../../server/src/storage';
import { createLibraryRepository } from '../../server/src/library/repository';
import { validatePng } from '../../server/src/library/imports/png';
import { DEFAULT_IMPORT_LIMITS } from '../../server/src/library/imports/limits';
import { createTestResources, listen } from '../helpers/resources';
import { capture, png } from '../imports/fixtures';
import type { MatchSummary } from '../../shared/src/matches';
import type { ScreenshotSummary } from '../../shared/src/imports';

const headers = { 'Content-Type': 'application/json', 'X-Name-That-Match': 'library' };
describe('match management HTTP', () => {
  let resources: ReturnType<typeof createTestResources>; let storage: StorageSession; let server: http.Server; let base: string;
  beforeEach(async () => {
    resources = createTestResources(); storage = resources.storage(initializeStorage({ dataDir: resources.root }));
    server = resources.server(createServer(0, { dataDir: resources.root })); base = await listen(server);
  });
  afterEach(async () => { vi.restoreAllMocks(); await resources.cleanup(); });
  const request = (route: string, value: unknown, method = 'POST', extra = {}) => fetch(base + route, { method, headers: { ...headers, ...extra }, body: JSON.stringify(value) });
  async function create(fields = {}): Promise<MatchSummary> { const response = await request('/api/matches', fields); expect(response.status).toBe(201); return (await response.json()).data; }
  async function patch(match: MatchSummary, changes: object) { return request(`/api/matches/${match.id}`, { expectedRevision: match.revision, changes }, 'PATCH'); }
  function screenshot(id = randomUUID(), videoId = 'abcdefghijk') {
    const metadata = capture(id).metadata;
    metadata.source.videoId = videoId; metadata.source.canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const record = createLibraryRepository(storage.db).insertCommittedScreenshot({ provenance: metadata, originalMetadataJson: JSON.stringify(metadata), image: validatePng(png, { ...DEFAULT_IMPORT_LIMITS }) });
    fs.writeFileSync(path.join(storage.rootDir, record.imagePath), png); return record;
  }
  const assign = (match: MatchSummary, records: Array<{ id: string; revision: number }>, revision = match.revision) => request('/api/screenshots/assignments', { targetMatchId: match.id, expectedMatchRevision: revision, screenshots: records.map((record) => ({ id: record.id, expectedRevision: record.revision })) });
  it('creates empty drafts and explicitly reports missing identity fields', async () => {
    const match = await create(); expect(match).toMatchObject({ participantDescription: null, promotion: null, event: null, matchDate: null, obscurity: null, revision: 1, complete: false });
    expect(match.missingFields).toEqual(['participantDescription', 'promotion', 'event']);
    expect((await (await fetch(base + '/api/matches')).json()).data).toMatchObject({ matchedCount: 1, matches: [match] });
  });
  it.each(['2024', '2024-02', '2024-02-29'])('persists partial date %s without invented components', async (matchDate) => {
    const match = await create({ participantDescription: 'Team A & Team B vs. Team C', promotion: 'Local Wrestling', event: 'Summer Show', matchDate });
    expect(match).toMatchObject({ matchDate, complete: true });
    const response = await patch(match, { event: 'Updated event', stipulation: 'Tag match', championshipInfo: 'Tag titles', notes: 'Editorial\nnotes' });
    expect(response.status).toBe(200); expect((await response.json()).data.match).toMatchObject({ matchDate, event: 'Updated event', revision: 2 });
  });
  it.each(['iconic', 'familiar', 'obscure', null])('keeps obscurity %s independent of screenshot difficulty/review', async (obscurity) => {
    const match = await create(); const image = screenshot(); await assign(match, [image]);
    storage.db.prepare("UPDATE screenshots SET difficulty='deathmatch',review_status='approved' WHERE id=?").run(image.id);
    const response = await patch(match, { obscurity }); expect(response.status).toBe(200);
    expect(storage.db.prepare('SELECT difficulty,review_status,revision FROM screenshots WHERE id=?').get(image.id)).toEqual({ difficulty: 'deathmatch', review_status: 'approved', revision: 2 });
  });
  it.each([['matchDate', '2023-02-29'], ['matchDate', '2024-13'], ['obscurity', 'legendary'], ['promotion', 'x'.repeat(501)], ['event', 'bad\0value']])('returns field feedback for invalid %s', async (field, value) => {
    const match = await create(); const response = await patch(match, { [field]: value }); expect(response.status).toBe(422);
    expect((await response.json()).error.fieldErrors[field]).toBeTruthy();
    expect(createLibraryRepository(storage.db).getMatch(match.id).revision).toBe(1);
  });
  it('rejects unknown fields, invalid revisions, absent records, unsupported methods and unapproved screenshot edits', async () => {
    expect((await request('/api/matches', { difficulty: 'squash' })).status).toBe(400);
    const match = await create(); const record = screenshot();
    expect((await request(`/api/matches/${match.id}`, { expectedRevision: 0, changes: {} }, 'PATCH')).status).toBe(400);
    expect((await request(`/api/matches/${randomUUID()}`, { expectedRevision: 1, changes: {} }, 'PATCH')).status).toBe(404);
    for (const changes of [{ difficulty: 'squash' }, { notes: 'future' }, { reviewStatus: 'approved' }]) expect((await request(`/api/screenshots/${record.id}`, { expectedRevision: 1, changes }, 'PATCH')).status).toBe(400);
    expect((await request(`/api/screenshots/${record.id}`, { expectedRevision: 1, reviewStatus: 'approved' }, 'PATCH')).status).toBe(400);
    const wrong = await fetch(base + `/api/matches/${match.id}`); expect(wrong.status).toBe(405); expect(wrong.headers.get('allow')).toBe('PATCH');
    expect((await fetch(base + '/api/matches?q=not-yet')).status).toBe(400);
  });
  it('rejects stale match updates and preserves no-op revisions and timestamps', async () => {
    const match = await create({ participantDescription: '  Wrestler A vs. Wrestler B  ' });
    const noOp = (await (await patch(match, { participantDescription: ' Wrestler A vs. Wrestler B ' })).json()).data;
    expect(noOp.match.revision).toBe(1); expect(noOp.match.updatedAt).toBe(match.updatedAt);
    await patch(match, { promotion: 'Promotion' });
    const stale = await patch(match, { event: 'Stale editor event' }); expect(stale.status).toBe(409);
    expect((await stale.json()).error).toMatchObject({ currentRevision: 2, currentMatchRevision: 2 });
    expect(createLibraryRepository(storage.db).getMatch(match.id).event).toBeNull();
  });
  it('assigns, reassigns and unassigns a single screenshot while preserving provenance', async () => {
    const first = await create(); const second = await create(); const original = screenshot(); let revision = 1;
    for (const matchId of [first.id, second.id, null]) {
      const response = await request(`/api/screenshots/${original.id}`, { expectedRevision: revision, changes: { matchId }, ...(matchId ? { expectedMatchRevision: 1 } : {}) }, 'PATCH');
      expect(response.status).toBe(200); const record: ScreenshotSummary = (await response.json()).data;
      expect(record).toMatchObject({ matchId, provenance: original.provenance, difficulty: null, reviewStatus: 'pending', revision: ++revision });
      expect(JSON.stringify(record)).not.toContain('imagePath');
    }
    expect((await (await fetch(base + '/api/screenshots?matchId=unassigned')).json()).data.matchedCount).toBe(1);
  });
  it('assigns several videos to one incomplete match, and one video across matches', async () => {
    const first = await create(); const second = await create(); const a = screenshot(); const b = screenshot(randomUUID(), 'different01'); const c = screenshot();
    const response = await assign(first, [a, b, c]); expect(response.status).toBe(200); const records = (await response.json()).data.screenshots;
    expect(records.map((record: ScreenshotSummary) => record.matchId)).toEqual([first.id, first.id, first.id]);
    expect((await assign(second, [records[0]])).status).toBe(200);
    expect((await (await fetch(base + `/api/screenshots?matchId=${first.id}`)).json()).data.matchedCount).toBe(2);
  });
  it('validates every selected member and parent revision before any assignment writes', async () => {
    const match = await create(); const a = screenshot(); const b = screenshot();
    for (const selection of [[a, { ...b, revision: 2 }], [a, { ...b, id: randomUUID() }], [a, a]]) {
      expect((await assign(match, selection)).status).toBe(selection[1].id === a.id ? 400 : selection[1].revision === 2 ? 409 : 404);
      expect(createLibraryRepository(storage.db).getScreenshot(a.id).matchId).toBeNull();
    }
    expect((await assign(match, [a, b], 2)).status).toBe(409);
    expect((await assign(match, [])).status).toBe(400);
    expect((await assign(match, Array.from({ length: 257 }, () => a))).status).toBe(400);
    expect((await request('/api/screenshots/assignments', { targetMatchId: match.id, expectedMatchRevision: 1, screenshots: [{ id: a.id, expectedRevision: 1 }], reviewStatus: 'approved' })).status).toBe(400);
  });
  it('invalidates approved associations atomically and rejects a stale screenshot editor', async () => {
    const match = await create({ participantDescription: 'A vs B', promotion: 'P', event: 'E' }); const image = screenshot(); await assign(match, [image]);
    storage.db.prepare("UPDATE screenshots SET difficulty='competitive',review_status='approved' WHERE id=?").run(image.id);
    const response = await patch(match, { event: 'New event' }); const data = (await response.json()).data;
    expect(data.invalidatedScreenshots).toEqual([{ id: image.id, revision: 3 }]);
    expect((await request(`/api/screenshots/${image.id}`, { expectedRevision: 2, changes: { matchId: null } }, 'PATCH')).status).toBe(409);
    expect(createLibraryRepository(storage.db).getScreenshot(image.id)).toMatchObject({ matchId: match.id, reviewStatus: 'pending', revision: 3 });
  });
  it('rolls back both match writes and approval resets if the transaction fails', async () => {
    const match = await create(); const image = screenshot(); await assign(match, [image]);
    storage.db.prepare("UPDATE screenshots SET difficulty='squash',review_status='approved' WHERE id=?").run(image.id);
    storage.db.exec("CREATE TRIGGER fail_review BEFORE UPDATE ON screenshots BEGIN SELECT RAISE(ABORT,'test failure'); END");
    expect((await patch(match, { event: 'Must roll back' })).status).toBe(500);
    expect(createLibraryRepository(storage.db).getMatch(match.id)).toMatchObject({ event: null, revision: 1 });
    expect(createLibraryRepository(storage.db).getScreenshot(image.id).reviewStatus).toBe('approved');
  });
  it('preserves matches and assignments after stopping and reopening the server', async () => {
    const match = await create({ participantDescription: 'A & B vs C & D', matchDate: '1999-03', obscurity: 'obscure' }); const image = screenshot(); await assign(match, [image]);
    await new Promise<void>((resolve) => server.close(() => resolve()));
    base = await listen(resources.server(createServer(0, { dataDir: resources.root })));
    expect((await (await fetch(base + '/api/matches')).json()).data.matches[0]).toMatchObject({ id: match.id, matchDate: '1999-03', obscurity: 'obscure' });
    expect((await (await fetch(base + `/api/screenshots?matchId=${match.id}`)).json()).data.screenshots[0].id).toBe(image.id);
  });
  it('applies origin/header protection to all new mutations before side effects', async () => {
    const match = await create();
    expect((await request('/api/matches', {}, 'POST', { Origin: 'https://foreign.example' })).status).toBe(403);
    expect((await request(`/api/matches/${match.id}`, { expectedRevision: 1, changes: { event: 'bad' } }, 'PATCH', { Origin: 'null' })).status).toBe(403);
    const record = screenshot();
    expect((await request('/api/screenshots/assignments', {}, 'POST', { Origin: 'https://foreign.example' })).status).toBe(403);
    expect((await fetch(base + `/api/screenshots/${record.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status).toBe(403);
    expect(createLibraryRepository(storage.db).getMatch(match.id).revision).toBe(1); expect(createLibraryRepository(storage.db).getScreenshot(record.id).matchId).toBeNull();
  });
  it('resets approval on reassignment and unassignment without changing difficulty or provenance', async () => {
    const a = await create(); const b = await create(); const record = screenshot(); await assign(a, [record]);
    storage.db.prepare("UPDATE screenshots SET difficulty='deathmatch',review_status='approved' WHERE id=?").run(record.id);
    const moved = (await (await request(`/api/screenshots/${record.id}`, { expectedRevision: 2, changes: { matchId: b.id }, expectedMatchRevision: 1 }, 'PATCH')).json()).data;
    expect(moved).toMatchObject({ matchId: b.id, difficulty: 'deathmatch', reviewStatus: 'pending', revision: 3, provenance: record.provenance });
    storage.db.prepare("UPDATE screenshots SET review_status='approved' WHERE id=?").run(record.id);
    const removed = (await (await request(`/api/screenshots/${record.id}`, { expectedRevision: 3, changes: { matchId: null } }, 'PATCH')).json()).data;
    expect(removed).toMatchObject({ matchId: null, difficulty: 'deathmatch', reviewStatus: 'pending', revision: 4, provenance: record.provenance });
  });
  it('rolls back earlier multi-assignment writes when a later SQL write fails', async () => {
    const match = await create(); const a = screenshot(); const b = screenshot();
    storage.db.exec(`CREATE TRIGGER fail_second BEFORE UPDATE ON screenshots WHEN OLD.id='${b.id}' BEGIN SELECT RAISE(ABORT,'injected failure'); END`);
    expect((await assign(match, [a, b])).status).toBe(500);
    expect(createLibraryRepository(storage.db).getScreenshot(a.id)).toMatchObject({ matchId: null, revision: 1 });
    expect(createLibraryRepository(storage.db).getScreenshot(b.id)).toMatchObject({ matchId: null, revision: 1 });
  });
});
