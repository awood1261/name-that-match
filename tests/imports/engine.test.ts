import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeStorage, type StorageSession } from '../../server/src/storage';
import { getImportEngine, type CaptureImportEngine } from '../../server/src/library/imports/engine';
import { ImportInterruption } from '../../server/src/library/imports/contracts';
import { createTestResources } from '../helpers/resources';
import { capture, customPng, manifest, png } from './fixtures';

describe('capture import engine durability', () => {
  let resources: ReturnType<typeof createTestResources>;
  let session: StorageSession;
  let engine: CaptureImportEngine;
  beforeEach(() => {
    resources = createTestResources(); session = resources.storage(initializeStorage({ dataDir: resources.root })); engine = getImportEngine(session);
  });
  afterEach(async () => { vi.restoreAllMocks(); vi.unstubAllEnvs(); await resources.cleanup(); });
  function count() { return (session.db.prepare('SELECT count(*) AS n FROM screenshots').get() as { n: number }).n; }
  function restart() {
    vi.restoreAllMocks(); session.db.close();
    session = resources.storage(initializeStorage({ dataDir: resources.root })); engine = getImportEngine(session);
  }
  async function staged(captures = [capture()]) {
    const created = engine.createBatch(manifest(captures));
    for (const item of created.items) {
      const selected = captures.find((entry) => `${entry.directory}/${entry.metadata.captureId}.json` === item.candidateLabel)!;
      if (item.state === 'awaiting_upload') await engine.uploadImage(created.id, item.id, [selected.bytes]);
    }
    return engine.status(created.id);
  }
  function preview(batchId: string) { return engine.preview(batchId, engine.status(batchId).revision); }
  function confirmation(batchId: string, action?: 'keepDuplicate') {
    const current = preview(batchId);
    return { requestId: randomUUID(), previewToken: current.previewToken!, items: current.items.filter((item) => item.state === 'ready').map((item) => ({
      itemId: item.id, action: item.classification === 'valid' ? 'import' as const : item.classification === 'image_duplicate' && action ? action : 'skip' as const,
    })) };
  }
  async function imported(captures = [capture()], keep?: 'keepDuplicate') {
    const batch = await staged(captures); const request = confirmation(batch.id, keep);
    engine.confirm(batch.id, request); await engine.processBatch(batch.id); return { batchId: batch.id, request, status: engine.status(batch.id) };
  }
  function interrupt(point: string) {
    let fired = false;
    vi.spyOn(engine, 'checkpoint').mockImplementation((name) => { if (name === point && !fired) { fired = true; throw new ImportInterruption(point); } });
  }

  it('imports a fixture, preserves exact metadata, keeps matches empty, and replays confirmation after restart', async () => {
    const result = await imported();
    expect(result.status.counts).toEqual({ imported: 1, duplicate: 0, skipped: 0, failed: 0, remaining: 0 });
    expect(result.status.items[0].classification).toBeNull();
    const record = session.db.prepare('SELECT * FROM screenshots').get() as Record<string, unknown>;
    expect(record).toMatchObject({ match_id: null, difficulty: null, review_status: 'pending', original_metadata_json: manifest([capture()]).files[0].metadataText });
    expect(fs.readFileSync(path.join(resources.root, record.image_path as string))).toEqual(png);
    expect(session.db.prepare('SELECT count(*) AS n FROM matches').get()).toEqual({ n: 0 });
    restart(); engine.confirm(result.batchId, result.request);
    expect(count()).toBe(1);
    expect(engine.status(result.batchId).items[0].screenshotId).toBe(result.status.items[0].screenshotId);
    expect(() => engine.confirm(result.batchId, { ...result.request, items: [] })).toThrow(/different decisions/);
  });
  it('treats repeated identity as already imported and rejects changed provenance/content without overwrite', async () => {
    await imported();
    const again = await imported(); expect(again.status.counts.duplicate).toBe(1); expect(count()).toBe(1);
    for (const variant of ['metadata', 'bytes']) {
      const item = capture();
      if (variant === 'metadata') item.metadata.source.title = 'changed source';
      else item.bytes = customPng({ raw: Buffer.from([0, 0, 255, 0, 255, 0, 0, 0, 255]) });
      const batch = await staged([item]); const view = preview(batch.id);
      expect(view.items[0].classification).toBe('identity_conflict');
      engine.confirm(batch.id, { requestId: randomUUID(), previewToken: view.previewToken!, items: [] });
      await engine.processBatch(batch.id); expect(count()).toBe(1);
    }
  });
  it('skips exact image duplicates by default and retains separate captures only explicitly', async () => {
    await imported([capture('first')]);
    const skipped = await imported([capture('second')]); expect(skipped.status.counts.duplicate).toBe(1); expect(count()).toBe(1);
    const kept = await imported([capture('second')], 'keepDuplicate'); expect(kept.status.counts.imported).toBe(1); expect(count()).toBe(2);
    const distinct = capture('third', customPng({ raw: Buffer.from([0, 0, 255, 0, 255, 0, 0, 255, 255]) }));
    expect((await imported([distinct])).status.counts.imported).toBe(1); expect(count()).toBe(3);
  });
  it('handles identical identities and image duplicates within a batch and blocks all conflicting identities', async () => {
    const identical = [capture('same', png, 'one'), capture('same', png, 'two')];
    expect((await imported(identical)).status.counts).toMatchObject({ imported: 1, duplicate: 1 });
    const first = capture('new', png, 'one'); const second = capture('new', png, 'two'); second.metadata.capture.playbackSeconds = 99;
    const batch = await staged([first, second]);
    expect(preview(batch.id).items.map((item) => item.classification)).toEqual(['identity_conflict', 'identity_conflict']);
    expect(count()).toBe(1);
    const retained = await imported([capture('x'), capture('y')], 'keepDuplicate');
    expect(retained.status.counts.imported).toBe(2); expect(count()).toBe(3);
  });
  it('requires refreshed duplicate decisions after another batch commits', async () => {
    const pending = await staged([capture('later')]); const request = confirmation(pending.id);
    await imported([capture('earlier')]);
    expect(() => engine.confirm(pending.id, request)).toThrow(/Preview changed/);
    const newRequest = confirmation(pending.id, 'keepDuplicate'); engine.confirm(pending.id, newRequest);
    await engine.processBatch(pending.id); expect(count()).toBe(2);
  });
  it('rechecks duplicate changes after confirmation and retries explicitly without losing successes', async () => {
    const waiting = await staged([capture('waiting')]); const original = confirmation(waiting.id); engine.confirm(waiting.id, original);
    await imported([capture('other')]);
    await engine.processBatch(waiting.id);
    expect(engine.status(waiting.id).items[0].error?.code).toBe('PREVIEW_CHANGED'); expect(count()).toBe(1);
    const retry = confirmation(waiting.id, 'keepDuplicate'); engine.confirm(waiting.id, retry); await engine.processBatch(waiting.id);
    expect(count()).toBe(2);
  });
  it('reports dimension/PNG failures individually and completes unrelated valid items', async () => {
    const wrong = capture('wrong'); wrong.metadata.image.width = 3;
    const corrupt = capture('corrupt', Buffer.from('not png'));
    const result = await imported([capture('good'), wrong, corrupt]);
    expect(result.status.status).toBe('partial_success'); expect(result.status.counts).toMatchObject({ imported: 1, failed: 2 });
    expect(result.status.items.map((item) => item.error?.code)).toContain('DIMENSION_MISMATCH'); expect(count()).toBe(1);
  });

  it.each(['after_upload_part', 'after_staged_file'])('recovers interruption at %s and permits re-upload without exposing rows', async (point) => {
    const batch = engine.createBatch(manifest([capture()])); interrupt(point);
    await expect(engine.uploadImage(batch.id, batch.items[0].id, [png])).rejects.toBeInstanceOf(ImportInterruption);
    expect(count()).toBe(0); restart();
    if (engine.status(batch.id).items[0].state === 'failed') await engine.uploadImage(batch.id, batch.items[0].id, [png]);
    const request = confirmation(batch.id); engine.confirm(batch.id, request); await engine.processBatch(batch.id);
    expect(count()).toBe(1);
  });
  it('recovers interrupted validation without inferring confirmation', async () => {
    const batch = await staged(); interrupt('during_validation');
    expect(() => preview(batch.id)).toThrow(ImportInterruption); restart();
    expect(engine.status(batch.id).items[0].state).toBe('ready'); expect(count()).toBe(0);
  });
  it.each(['after_finalizing', 'during_final_copy', 'after_final_file', 'after_finalized', 'before_commit', 'after_insert', 'after_commit'])('reconciles persisted intent after %s', async (point) => {
    const batch = await staged(); const request = confirmation(batch.id); engine.confirm(batch.id, request); interrupt(point);
    await expect(engine.processBatch(batch.id)).rejects.toBeInstanceOf(ImportInterruption);
    expect(count()).toBe(point === 'after_commit' ? 1 : 0);
    restart(); expect(count()).toBe(1);
    engine.confirm(batch.id, request); await engine.processBatch(batch.id);
    expect(count()).toBe(1); expect(engine.status(batch.id).counts.imported).toBe(1);
  });
  it('retains already committed results after interrupted reporting and does not recreate a missing committed image', async () => {
    const result = await imported(); const row = session.db.prepare('SELECT image_path FROM screenshots').get() as { image_path: string };
    fs.unlinkSync(path.join(resources.root, row.image_path)); restart();
    expect(count()).toBe(1); expect(fs.existsSync(path.join(resources.root, row.image_path))).toBe(false);
    expect(engine.status(result.batchId).items[0].result).toBe('imported');
  });
  it('preserves unexpected final bytes and follows neither staging nor image symlinks', async () => {
    const batch = await staged(); engine.confirm(batch.id, confirmation(batch.id));
    const row = engine.store.items(batch.id)[0]; fs.writeFileSync(path.join(resources.root, row.final_path!), 'unrelated');
    await engine.processBatch(batch.id); expect(count()).toBe(0);
    expect(fs.readFileSync(path.join(resources.root, row.final_path!), 'utf8')).toBe('unrelated');
    expect(engine.status(batch.id).items[0].error?.code).toBe('FINALIZATION_CONFLICT');
    const outside = path.join(resources.root, 'outside.txt'); fs.writeFileSync(outside, 'keep');
    const next = engine.createBatch(manifest([capture('symlink')])); const item = engine.store.items(next.id)[0];
    const full = engine.files.resolve(item.staging_path!); fs.symlinkSync(outside, full);
    await expect(engine.uploadImage(next.id, item.id, [png])).rejects.toThrow(); expect(fs.readFileSync(outside, 'utf8')).toBe('keep');
  });
  it('cleans only expired unconfirmed staged files and retains confirmed failed work, sources and unknown files', async () => {
    const batch = await staged(); const row = engine.store.items(batch.id)[0];
    const original = path.join(resources.root, 'source.png'); fs.writeFileSync(original, png);
    const unknown = path.join(resources.root, 'staging', batch.id, 'unrelated.txt'); fs.writeFileSync(unknown, 'keep');
    session.db.prepare("UPDATE import_batches SET updated_at='2000-01-01T00:00:00Z' WHERE id=?").run(batch.id);
    engine.expireInactive();
    expect(engine.status(batch.id).status).toBe('expired'); expect(fs.existsSync(path.join(resources.root, row.staging_path!))).toBe(false);
    expect(fs.readFileSync(original)).toEqual(png); expect(fs.readFileSync(unknown, 'utf8')).toBe('keep');
    expect(() => engine.confirm(batch.id, { requestId: randomUUID(), previewToken: '', items: [] })).toThrow(/expired/);
    const active = await staged([capture('retain')]); engine.confirm(active.id, confirmation(active.id));
    session.db.prepare("UPDATE import_batches SET updated_at='2000-01-01T00:00:00Z' WHERE id=?").run(active.id);
    engine.expireInactive(); expect(engine.status(active.id).status).toBe('confirming');
  });
  it('enforces actual upload length, repeated upload identity, valid transitions and busy locks', async () => {
    const batch = engine.createBatch(manifest([capture()])); const itemId = batch.items[0].id;
    await expect(engine.uploadImage(batch.id, itemId, [Buffer.alloc(png.length + 1)])).rejects.toThrow(/reserved/);
    await engine.uploadImage(batch.id, itemId, [png]);
    await engine.uploadImage(batch.id, itemId, [png]);
    await expect(engine.uploadImage(batch.id, itemId, [Buffer.alloc(png.length)])).rejects.toThrow(/Different bytes/);
    const row = engine.store.items(batch.id)[0]; expect(() => engine.store.move(row, 'committed')).toThrow(/transition/);
    let release!: () => void; const gate = new Promise<void>((resolve) => { release = resolve; });
    async function* slow() { await gate; yield png; }
    const operation = engine.uploadImage(batch.id, itemId, slow());
    await expect(engine.uploadImage(batch.id, itemId, [png])).rejects.toThrow(/concurrency/);
    expect(() => preview(batch.id)).toThrow(/active/); release(); await operation;
  });
  it('reads an original through a stream without changing its bytes or name', async () => {
    const originals = path.join(resources.root, 'originals'); fs.mkdirSync(originals);
    const source = path.join(originals, 'sample.png'); fs.writeFileSync(source, png);
    const sidecar = path.join(originals, 'sample.json');
    const selection = manifest([capture()]); fs.writeFileSync(sidecar, selection.files[0].metadataText!);
    const checksum = (file: string) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    const before = [checksum(source), checksum(sidecar)];
    selection.files[0].metadataText = fs.readFileSync(sidecar, 'utf8');
    const batch = engine.createBatch(selection);
    await engine.uploadImage(batch.id, batch.items[0].id, fs.createReadStream(source));
    engine.confirm(batch.id, confirmation(batch.id)); await engine.processBatch(batch.id);
    expect(fs.readFileSync(source)).toEqual(png); expect(count()).toBe(1);
    expect([checksum(source), checksum(sidecar)]).toEqual(before);
    expect(fs.readdirSync(originals).sort()).toEqual(['sample.json', 'sample.png']);
  });
  it('replays the durable receipt while processing is active and rejects overlapping new work', async () => {
    const batch = await staged(); const request = confirmation(batch.id); engine.confirm(batch.id, request);
    const processing = engine.processBatch(batch.id);
    expect(engine.confirm(batch.id, request).id).toBe(batch.id);
    expect(() => engine.confirm(batch.id, { ...request, requestId: randomUUID() })).toThrow(/active/);
    await expect(engine.processBatch(batch.id)).rejects.toThrow(/active/);
    await processing; expect(count()).toBe(1);
  });
  it('resumes cleanup interrupted after expiry was persisted', async () => {
    const batch = await staged(); const row = engine.store.items(batch.id)[0];
    session.db.prepare("UPDATE import_batches SET updated_at='2000-01-01T00:00:00Z' WHERE id=?").run(batch.id);
    interrupt('after_expiry'); expect(() => engine.expireInactive()).toThrow(ImportInterruption);
    expect(fs.existsSync(path.join(resources.root, row.staging_path!))).toBe(true);
    restart(); expect(engine.status(batch.id).status).toBe('expired');
    expect(fs.existsSync(path.join(resources.root, row.staging_path!))).toBe(false);
  });
  it('requires re-upload when both managed copies disappear and preserves the reserved screenshot ID', async () => {
    const batch = await staged(); engine.confirm(batch.id, confirmation(batch.id));
    const item = engine.store.items(batch.id)[0]; fs.unlinkSync(path.join(resources.root, item.staging_path!));
    restart(); expect(engine.status(batch.id).items[0]).toMatchObject({ retryable: true, error: { code: 'UPLOAD_REQUIRED' } });
    expect(count()).toBe(0);
    await engine.uploadImage(batch.id, item.id, [png]); engine.confirm(batch.id, confirmation(batch.id)); await engine.processBatch(batch.id);
    expect(engine.status(batch.id).items[0].screenshotId).toBe(item.screenshot_id); expect(count()).toBe(1);
  });
  it('rolls back an actual SQLite insert failure and retries the intact finalized image', async () => {
    const batch = await staged(); engine.confirm(batch.id, confirmation(batch.id));
    session.db.exec("CREATE TRIGGER reject_fixture BEFORE INSERT ON screenshots BEGIN SELECT RAISE(ABORT, 'injected failure'); END");
    await engine.processBatch(batch.id); expect(count()).toBe(0);
    expect(engine.status(batch.id).items[0]).toMatchObject({ state: 'failed', retryable: true });
    session.db.exec('DROP TRIGGER reject_fixture'); restart();
    expect(count()).toBe(1); expect(engine.status(batch.id).counts.imported).toBe(1);
  });
  it('records storage-wide failure, stops processing, and reconciles after storage becomes available', async () => {
    const batch = await staged([capture('one'), capture('two')]); engine.confirm(batch.id, confirmation(batch.id, 'keepDuplicate'));
    vi.spyOn(engine.files, 'openNew').mockImplementation(() => { throw Object.assign(new Error('secret absolute path'), { code: 'ENOSPC' }); });
    await expect(engine.processBatch(batch.id)).rejects.toMatchObject({ code: 'IMPORT_STORAGE_UNAVAILABLE' });
    expect(count()).toBe(0); expect(engine.status(batch.id).error).toMatchObject({ code: 'IMPORT_STORAGE_UNAVAILABLE', retryable: true });
    expect(JSON.stringify(engine.status(batch.id))).not.toContain('secret absolute path');
    restart(); expect(count()).toBe(2);
  });
  it('rejects startup on storage-wide recovery failure and releases the database', async () => {
    const batch = await staged(); engine.confirm(batch.id, confirmation(batch.id));
    session.db.close();
    const spy = vi.spyOn(fs, 'openSync').mockImplementation(() => { throw Object.assign(new Error('unavailable'), { code: 'EACCES' }); });
    expect(() => initializeStorage({ dataDir: resources.root })).toThrow(/storage is unavailable/);
    spy.mockRestore(); restart(); expect(count()).toBe(1);
  });
  it('reports unknown staging evidence without following or deleting it and retains failed confirmed bytes', async () => {
    const batch = await staged(); engine.confirm(batch.id, confirmation(batch.id));
    const row = engine.store.items(batch.id)[0]; fs.writeFileSync(path.join(resources.root, row.final_path!), 'unexpected');
    await engine.processBatch(batch.id);
    const unknown = path.join(resources.root, 'staging', batch.id, 'notes.txt'); fs.writeFileSync(unknown, 'keep');
    const target = path.join(resources.root, 'not-owned'); fs.mkdirSync(target); fs.writeFileSync(path.join(target, 'secret'), 'keep');
    fs.symlinkSync(target, path.join(resources.root, 'staging', batch.id, 'external'));
    const report = engine.maintenance(); expect(report.retainedBytes).toBe(png.length);
    expect(report.diagnostics.map((entry) => entry.label)).toEqual(expect.arrayContaining([`staging/${batch.id}/notes.txt`, `staging/${batch.id}/external`]));
    expect(report.scanned).toBeLessThan(10); restart();
    expect(fs.readFileSync(unknown, 'utf8')).toBe('keep'); expect(fs.readFileSync(path.join(target, 'secret'), 'utf8')).toBe('keep');
    expect(fs.existsSync(path.join(resources.root, row.staging_path!))).toBe(true);
  });
  it('limits concurrent uploads and retains active batches during expiry', async () => {
    const batch = engine.createBatch(manifest([capture('one'), capture('two'), capture('three')]));
    let release!: () => void; const gate = new Promise<void>((resolve) => { release = resolve; });
    async function* slow() { await gate; yield png; }
    const first = engine.uploadImage(batch.id, batch.items[0].id, slow()); const second = engine.uploadImage(batch.id, batch.items[1].id, slow());
    await expect(engine.uploadImage(batch.id, batch.items[2].id, [png])).rejects.toThrow(/concurrency/);
    engine.expireInactive(Date.now() + 9 * 86400000); expect(engine.status(batch.id).status).not.toBe('expired');
    release(); await Promise.all([first, second]); expect(count()).toBe(0);
  });
  it('compares reordered metadata semantically while preserving raw original text and extra fields', async () => {
    await imported(); const source = capture(); const selection = manifest([source]);
    const metadata = source.metadata;
    selection.files[0].metadataText = JSON.stringify(Object.fromEntries(Object.entries(metadata).reverse()), null, 4);
    const batch = engine.createBatch(selection); await engine.uploadImage(batch.id, batch.items[0].id, [png]);
    expect(preview(batch.id).items[0].classification).toBe('already_imported');
    const changed = capture(); changed.metadata.extensionField = { retained: false };
    const conflict = await staged([changed]); expect(preview(conflict.id).items[0].classification).toBe('identity_conflict');
    expect(count()).toBe(1);
  });
  it('resumes persisted confirmation when the confirmation response was interrupted', async () => {
    const batch = await staged(); const request = confirmation(batch.id); interrupt('after_confirmation');
    expect(() => engine.confirm(batch.id, request)).toThrow(ImportInterruption); expect(count()).toBe(0);
    const intended = engine.store.items(batch.id)[0].screenshot_id; restart();
    expect(engine.confirm(batch.id, request).items[0].screenshotId).toBe(intended); expect(count()).toBe(1);
  });
  it('resolves overlapping batches with the same capture identity without duplicate rows', async () => {
    const first = await staged(); const second = await staged();
    engine.confirm(first.id, confirmation(first.id)); engine.confirm(second.id, confirmation(second.id));
    await Promise.all([engine.processBatch(first.id), engine.processBatch(second.id)]);
    expect(count()).toBe(1);
    expect([engine.status(first.id).counts.imported, engine.status(second.id).counts.duplicate]).toEqual([1, 1]);
  });
  it('preserves committed results when cleanup fails and retries only owned cleanup at restart', async () => {
    const batch = await staged(); engine.confirm(batch.id, confirmation(batch.id));
    vi.spyOn(engine.files, 'remove').mockImplementationOnce(() => { throw new Error('cleanup failed'); });
    await engine.processBatch(batch.id);
    expect(count()).toBe(1); expect(engine.status(batch.id).error?.code).toBe('CLEANUP_FAILED');
    const row = engine.store.items(batch.id)[0]; expect(fs.existsSync(path.join(resources.root, row.staging_path!))).toBe(true);
    restart(); expect(count()).toBe(1); expect(fs.existsSync(path.join(resources.root, row.staging_path!))).toBe(false);
  });
  it('validates import configuration at startup without replacing existing data', async () => {
    await imported(); session.db.close(); vi.stubEnv('NAME_THAT_MATCH_MAX_IMAGE_BYTES', 'invalid');
    expect(() => initializeStorage({ dataDir: resources.root })).toThrow(/Invalid import limit/);
    vi.unstubAllEnvs(); restart(); expect(count()).toBe(1);
  });
  it('reports missing unconfirmed staged bytes as retryable re-upload work', async () => {
    const batch = await staged(); const item = engine.store.items(batch.id)[0];
    fs.unlinkSync(path.join(resources.root, item.staging_path!)); restart();
    expect(engine.status(batch.id).items[0]).toMatchObject({ retryable: true, error: { code: 'UPLOAD_REQUIRED' } });
    expect(count()).toBe(0); await engine.uploadImage(batch.id, item.id, [png]);
    expect(preview(batch.id).items[0].classification).toBe('valid'); expect(count()).toBe(0);
  });
});
