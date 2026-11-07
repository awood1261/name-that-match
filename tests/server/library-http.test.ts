import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createServer } from '../../server/src/index';
import { initializeStorage, type StorageSession } from '../../server/src/storage';
import { createTestResources, listen } from '../helpers/resources';
import { capture, manifest, png, customPng } from '../imports/fixtures';
import type { BatchStatus } from '../../shared/src/imports';
import { CaptureImportEngine } from '../../server/src/library/imports/engine';
import { createLibraryRepository } from '../../server/src/library/repository';
import { validatePng } from '../../server/src/library/imports/png';
import { DEFAULT_IMPORT_LIMITS } from '../../server/src/library/imports/limits';
import { ImportInterruption } from '../../server/src/library/imports/contracts';

const headers = { 'Content-Type': 'application/json', 'X-Name-That-Match': 'library' };
describe('library HTTP contracts', () => {
  let resources: ReturnType<typeof createTestResources>; let storage: StorageSession; let base: string; let server: http.Server;
  beforeEach(async () => {
    resources = createTestResources(); storage = resources.storage(initializeStorage({ dataDir: resources.root }));
    fs.mkdirSync(path.join(resources.root, 'dist')); fs.writeFileSync(path.join(resources.root, 'dist/index.html'), '<html>SPA</html>');
    server = resources.server(createServer(0, { dataDir: resources.root, production: true, staticDir: path.join(resources.root, 'dist') }));
    base = await listen(server);
  });
  afterEach(async () => { vi.restoreAllMocks(); vi.unstubAllEnvs(); await resources.cleanup(); });
  const post = (route: string, value: unknown, extra = {}) => fetch(base + route, { method: 'POST', headers: { ...headers, ...extra }, body: JSON.stringify(value) });
  async function create(items = [capture()]) { return (await (await post('/api/imports', manifest(items))).json()).data as BatchStatus; }
  async function stage(items = [capture()]) {
    const batch = await create(items);
    for (const item of batch.items) if (item.uploadUrl) {
      const source = items.find((entry) => `${entry.directory}/${entry.metadata.captureId}.json` === item.candidateLabel)!;
      expect((await fetch(base + item.uploadUrl, { method: 'PUT', headers: { ...headers, 'Content-Type': 'image/png' }, body: source.bytes })).status).toBe(200);
    }
    const current = (await (await fetch(base + `/api/imports/${batch.id}`)).json()).data;
    return (await (await post(`/api/imports/${batch.id}/preview`, { expectedRevision: current.revision })).json()).data as BatchStatus;
  }
  async function finish(batch: BatchStatus) {
    const request = { requestId: randomUUID(), previewToken: batch.previewToken, items: batch.items.filter((item) => item.state === 'ready').map((item) => ({ itemId: item.id, action: item.defaultAction })) };
    const response = await post(`/api/imports/${batch.id}/confirm`, request); expect(response.status).toBe(202);
    let current: BatchStatus = (await response.json()).data;
    for (let n = 0; n < 30 && (current.counts.remaining || current.status === 'confirming'); n++) current = (await (await fetch(base + `/api/imports/${batch.id}`)).json()).data;
    expect(current.counts.remaining).toBe(0); return { current, request };
  }
  it('imports through preview/confirmation, serves the committed image and replays results without exposing disk paths', async () => {
    const batch = await stage();
    expect((await (await fetch(base + '/api/screenshots?matchId=unassigned')).json()).data.matchedCount).toBe(0);
    expect(batch.classificationCounts).toEqual({ valid: 1 });
    const { current, request } = await finish(batch);
    expect(current.counts.imported).toBe(1);
    const list = (await (await fetch(base + '/api/screenshots?matchId=unassigned&difficulty=unrated&review=pending')).json()).data;
    expect(list.screenshots[0]).toMatchObject({ matchId: null, difficulty: null, reviewStatus: 'pending', assetStatus: 'available' });
    expect(JSON.stringify([list, current])).not.toMatch(/staging\/|imagePath|final_path|library.sqlite/);
    expect(JSON.stringify([list, current])).not.toContain(resources.root);
    const image = await fetch(base + list.screenshots[0].image.url);
    expect(image.headers.get('content-type')).toBe('image/png'); expect(image.headers.get('cache-control')).toBe('no-store');
    expect(image.headers.get('x-content-type-options')).toBe('nosniff'); expect(Buffer.from(await image.arrayBuffer())).toEqual(png);
    const head = await fetch(base + list.screenshots[0].image.url, { method: 'HEAD' });
    expect(head.headers.get('content-length')).toBe(String(png.length)); expect((await head.arrayBuffer()).byteLength).toBe(0);
    expect((await post(`/api/imports/${batch.id}/confirm`, request)).status).toBe(200);
    expect((await post(`/api/imports/${batch.id}/confirm`, { ...request, items: [] })).status).toBe(409);
    expect((await (await fetch(base + '/api/imports')).json()).data[0].id).toBe(batch.id);
    expect(storage.db.prepare('SELECT count(*) AS n FROM screenshots').get()).toEqual({ n: 1 });
  });
  it.each([
    ['/api/missing', 'GET', 404], ['/api/imports/not-a-uuid', 'GET', 400], ['/api/imports', 'DELETE', 405],
    ['/api/screenshots?unexpected=1', 'GET', 400], ['/api/screenshots?review=invalid', 'GET', 400],
    ['/api/screenshots?review=pending&review=rejected', 'GET', 400], ['/api/imports?limit=20', 'GET', 400],
    [`/api/imports/${randomUUID()}`, 'GET', 404], ['/api/imports/%ZZ', 'GET', 400],
  ])('returns JSON before SPA fallback for %s %s', async (route, method, status) => {
    const response = await fetch(base + route, { method }); expect(response.status).toBe(status);
    expect(response.headers.get('content-type')).toMatch(/application\/json/); expect((await response.json()).error.code).toBeTruthy();
    if (status === 405) expect(response.headers.get('allow')).toBe('GET, POST');
  });
  it('rejects malformed JSON, unknown fields and incorrect request media types', async () => {
    expect((await fetch(base + '/api/imports', { method: 'POST', headers, body: '{bad' })).status).toBe(400);
    expect((await post('/api/imports', { ...manifest([capture()]), serverPath: '/secret' })).status).toBe(400);
    expect((await post('/api/imports', manifest([capture()]), { 'Content-Type': 'text/plain' })).status).toBe(415);
    const batch = await create();
    expect((await fetch(base + batch.items[0].uploadUrl, { method: 'PUT', headers, body: png })).status).toBe(415);
    expect((await post(`/api/imports/${batch.id}/preview`, { expectedRevision: 999 })).status).toBe(409);
  });
  it.each(['https://evil.example', 'null', 'http://localhost:3001.evil.example', 'http://127.0.0.1:5173'])('rejects foreign production origin %s before side effects', async (origin) => {
    const response = await post('/api/imports', manifest([capture()]), { Origin: origin });
    expect(response.status).toBe(403); expect(response.headers.get('access-control-allow-origin')).toBeNull();
    expect(storage.db.prepare('SELECT count(*) AS n FROM import_batches').get()).toEqual({ n: 0 });
  });
  it('requires custom header and rejects preflight while preserving health CORS', async () => {
    expect((await fetch(base + '/api/imports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status).toBe(403);
    const preflight = await fetch(base + '/api/imports', { method: 'OPTIONS', headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'POST' } });
    expect(preflight.status).toBe(403); expect(preflight.headers.get('access-control-allow-origin')).toBeNull();
    expect((await fetch(base + '/api/health')).headers.get('access-control-allow-origin')).toBe('*');
    expect((await post('/api/imports', manifest([capture()]), { Origin: 'http://localhost:3001' })).status).toBe(201);
  });
  it('returns partial results and blocks corrupt PNGs without blocking unrelated pairs', async () => {
    const { current } = await finish(await stage([capture('valid'), capture('bad', Buffer.from('not PNG'))]));
    expect(current.status).toBe('partial_success'); expect(current.counts).toMatchObject({ imported: 1, failed: 1 });
  });
  it('handles duplicate default skip and explicit keep through HTTP', async () => {
    await finish(await stage([capture('first')]));
    const duplicate = await stage([capture('second')]); expect(duplicate.items[0].classification).toBe('image_duplicate');
    const skipped = await finish(duplicate); expect(skipped.current.counts.duplicate).toBe(1);
    const kept = await stage([capture('third')]);
    const response = await post(`/api/imports/${kept.id}/confirm`, { requestId: randomUUID(), previewToken: kept.previewToken, items: [{ itemId: kept.items[0].id, action: 'keepDuplicate' }] });
    expect(response.status).toBe(202);
    for (let n = 0; n < 10; n++) await fetch(base + `/api/imports/${kept.id}`);
    expect(storage.db.prepare('SELECT count(*) AS n FROM screenshots').get()).toEqual({ n: 2 });
  });
  it('rejects expired confirmation/upload with re-selection guidance', async () => {
    const batch = await stage(); storage.db.prepare("UPDATE import_batches SET updated_at='2000-01-01T00:00:00Z' WHERE id=?").run(batch.id);
    expect((await post(`/api/imports/${batch.id}/confirm`, { requestId: randomUUID(), previewToken: batch.previewToken, items: [] })).status).toBe(410);
    expect((await fetch(base + batch.items[0].uploadUrl, { method: 'PUT', headers: { ...headers, 'Content-Type': 'image/png' }, body: png })).status).toBe(410);
  });
  it.each(['missing', 'corrupt', 'symlink', 'substituted'])('does not serve a %s committed asset or change its review', async (problem) => {
    const { current } = await finish(await stage()); const id = current.items[0].screenshotId!;
    const image = path.join(resources.root, 'screenshots', `${id}.png`);
    if (problem !== 'substituted') fs.unlinkSync(image);
    if (problem === 'corrupt') fs.writeFileSync(image, 'broken');
    if (problem === 'symlink') { const outside = path.join(resources.root, 'external.png'); fs.writeFileSync(outside, png); fs.symlinkSync(outside, image); }
    if (problem === 'substituted') fs.writeFileSync(image, customPng({ raw: Buffer.from([0, 0, 255, 0, 255, 0, 0, 0, 255]) }));
    const response = await fetch(base + `/api/screenshots/${id}/image`); expect(response.status).toBe(problem === 'missing' ? 404 : 422);
    const list = (await (await fetch(base + '/api/screenshots')).json()).data;
    expect(list.screenshots[0]).toMatchObject({ assetStatus: problem === 'missing' ? 'missing' : 'corrupt', reviewStatus: 'pending' });
  });
  it('serves only committed IDs and rejects persisted path escapes', async () => {
    const batch = await stage(); expect((await fetch(base + `/api/screenshots/${batch.items[0].id}/image`)).status).toBe(404);
    expect((await fetch(base + `/api/imports/${batch.id}/items/${batch.items[0].id}/image`)).status).toBe(405);
    expect((await fetch(base + '/api/screenshots/%2e%2e%2Fsecret/image')).status).toBe(400);
    const record = createLibraryRepository(storage.db).insertCommittedScreenshot({ provenance: capture().metadata, originalMetadataJson: JSON.stringify(capture().metadata), image: validatePng(png, { ...DEFAULT_IMPORT_LIMITS }) });
    storage.db.pragma('ignore_check_constraints=ON'); storage.db.prepare("UPDATE screenshots SET image_path='../outside.png' WHERE id=?").run(record.id); storage.db.pragma('ignore_check_constraints=OFF');
    expect((await fetch(base + `/api/screenshots/${record.id}/image`)).status).toBe(422);
  });
  it('accepts explicit Vite development and configured LAN origins without trusting forwarding headers', async () => {
    const dev = await listen(resources.server(createServer(0, { dataDir: resources.root, production: false })));
    expect((await fetch(dev + '/api/imports', { method: 'POST', headers: { ...headers, Origin: 'http://localhost:5173' }, body: JSON.stringify(manifest([capture()])) })).status).toBe(201);
    vi.stubEnv('NAME_THAT_MATCH_UI_ORIGINS', 'http://192.168.1.50:3001');
    const lan = await listen(resources.server(createServer(0, { dataDir: resources.root, production: true })));
    expect((await fetch(lan + '/api/imports', { method: 'POST', headers: { ...headers, Origin: 'http://192.168.1.50:3001' }, body: JSON.stringify(manifest([capture()])) })).status).toBe(201);
    expect((await fetch(lan + '/api/imports', { method: 'POST', headers: { ...headers, Origin: 'https://evil.example', 'X-Forwarded-Host': 'evil.example' }, body: '{}' })).status).toBe(403);
  });
  it.each(['*', 'null', 'file:///tmp', 'http://localhost:3001/path', 'http://user:pass@localhost:3001', ''])('rejects invalid origin configuration %s before startup', (origin) => {
    vi.stubEnv('NAME_THAT_MATCH_UI_ORIGINS', origin);
    expect(() => createServer(0, { dataDir: path.join(resources.root, 'unused') })).toThrow(/UI_ORIGINS/);
    expect(fs.existsSync(path.join(resources.root, 'unused'))).toBe(false);
  });
  it('enforces actual chunked body and binary limits with structured 413 responses', async () => {
    vi.stubEnv('NAME_THAT_MATCH_MAX_JSON_BYTES', '128'); vi.stubEnv('NAME_THAT_MATCH_MAX_IMAGE_BYTES', '128');
    const limited = await listen(resources.server(createServer(0, { dataDir: resources.root })));
    const response = await new Promise<{ status: number; body: string }>((resolve, reject) => {
      const req = http.request(limited + '/api/imports', { method: 'POST', headers }, (res) => {
        let body = ''; res.on('data', (data) => { body += data; }); res.on('end', () => resolve({ status: res.statusCode!, body }));
      }); req.on('error', reject); req.write(' '.repeat(80)); req.write(' '.repeat(80)); req.end();
    });
    expect(response.status).toBe(413); expect(JSON.parse(response.body).error.code).toBe('BODY_TOO_LARGE');
    const batch = await create();
    expect((await fetch(limited + batch.items[0].uploadUrl, { method: 'PUT', headers: { ...headers, 'Content-Type': 'image/png' }, body: Buffer.alloc(256) })).status).toBe(413);
  });
  it('records an aborted upload as retryable and accepts a full re-upload', async () => {
    const batch = await create();
    const req = http.request(base + batch.items[0].uploadUrl, { method: 'PUT', headers: { ...headers, 'Content-Type': 'image/png', 'Content-Length': String(png.length) } });
    req.on('error', () => {}); req.write(png.subarray(0, 12));
    for (let n = 0; n < 100; n++) {
      await new Promise<void>((resolve) => setTimeout(resolve, 2));
      if ((storage.db.prepare('SELECT state FROM import_items WHERE id=?').get(batch.items[0].id) as { state: string }).state === 'uploading') break;
    }
    req.destroy(); let current: BatchStatus = batch;
    for (let n = 0; n < 50 && current.items[0].state !== 'failed'; n++) current = (await (await fetch(base + `/api/imports/${batch.id}`)).json()).data;
    expect(current.items[0]).toMatchObject({ state: 'failed', retryable: true, error: { code: 'REQUEST_ABORTED' } });
    expect((await fetch(base + current.items[0].uploadUrl, { method: 'PUT', headers: { ...headers, 'Content-Type': 'image/png' }, body: png })).status).toBe(200);
  });
  it('sanitizes unexpected failures and storage errors', async () => {
    vi.spyOn(CaptureImportEngine.prototype, 'createBatch').mockImplementationOnce(() => { throw new Error('SQL secret /absolute/private/path'); });
    const response = await post('/api/imports', manifest([capture()])); expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toMatch(/secret|absolute|private/);
    const { current } = await finish(await stage());
    const original = fs.openSync;
    vi.spyOn(fs, 'openSync').mockImplementation((...args) => {
      if (String(args[0]).includes('/screenshots/')) throw Object.assign(new Error('secret location'), { code: 'EACCES' });
      return original(...args);
    });
    const image = await fetch(base + `/api/screenshots/${current.items[0].screenshotId}/image`); expect(image.status).toBe(503);
    expect(JSON.stringify(await image.json())).not.toContain('secret');
  });
  it('limits and deterministically sorts recent summaries without returning item bodies', async () => {
    for (let n = 0; n < 22; n++) await create([capture(`capture-${n}`)]);
    const data = (await (await fetch(base + '/api/imports')).json()).data;
    expect(data).toHaveLength(20); expect(data.every((row: object) => !('items' in row))).toBe(true);
    expect(data.map((row: { createdAt: string }) => row.createdAt)).toEqual(data.map((row: { createdAt: string }) => row.createdAt).sort().reverse());
  });
  it('recovers a confirmation whose response was interrupted and replays its original receipt after restart', async () => {
    const batch = await stage(); const request = { requestId: randomUUID(), previewToken: batch.previewToken, items: [{ itemId: batch.items[0].id, action: 'import' }] };
    const spy = vi.spyOn(CaptureImportEngine.prototype, 'checkpoint').mockImplementation((point) => { if (point === 'after_confirmation') throw new ImportInterruption(); });
    expect((await post(`/api/imports/${batch.id}/confirm`, request)).status).toBe(500);
    const intended = (storage.db.prepare('SELECT screenshot_id FROM import_items WHERE id=?').get(batch.items[0].id) as { screenshot_id: string }).screenshot_id;
    expect(storage.db.prepare('SELECT count(*) AS n FROM screenshots').get()).toEqual({ n: 0 });
    spy.mockRestore(); await new Promise<void>((resolve) => server.close(() => resolve()));
    base = await listen(resources.server(createServer(0, { dataDir: resources.root, production: true })));
    const response = await post(`/api/imports/${batch.id}/confirm`, request); expect(response.status).toBe(200);
    expect((await response.json()).data.items[0].screenshotId).toBe(intended);
    expect(storage.db.prepare('SELECT count(*) AS n FROM screenshots').get()).toEqual({ n: 1 });
  });
});
