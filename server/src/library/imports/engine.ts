import fs from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { setImmediate } from 'node:timers/promises';
import type Database from 'better-sqlite3';
import { knownFields, object, requireId, requireRevision } from '../validation.js';
import { canonicalJson, digest } from './capture-validation.js';
import { ImportError, ImportInterruption, importFailure, storageUnavailable, type Confirmation, type Receipt } from './contracts.js';
import { classify } from './duplicates.js';
import { ImportFiles } from './files.js';
import { discoverManifest } from './manifest.js';
import { importLimits, type ImportLimits } from './limits.js';
import { ImportStore } from './persistence.js';
import { ImportProcessor } from './processor.js';

export interface ImportContext { db: Database.Database; rootDir: string }
export class CaptureImportEngine {
  readonly store: ImportStore;
  readonly files: ImportFiles;
  readonly limits: ImportLimits;
  private readonly processor: ImportProcessor;
  private readonly uploading = new Map<string, Set<string>>();
  private readonly processing = new Set<string>();
  constructor(context: ImportContext) {
    this.store = new ImportStore(context.db); this.files = new ImportFiles(context.rootDir); this.limits = importLimits();
    this.processor = new ImportProcessor(this.store, this.files, this.limits, (point, id) => this.checkpoint(point, id));
  }
  /** Deterministic durability checkpoints; no caller-supplied input invokes executable code. */
  checkpoint(point: string, itemId: string): void { void point; void itemId; }
  private available(batchId: string, idle = true) {
    requireId(batchId);
    this.expireInactive();
    const batch = this.store.batch(batchId);
    if (batch.status === 'expired') throw new ImportError('STAGING_EXPIRED', 'This preview expired; select files into a new batch.');
    if (this.processing.has(batchId) || (idle && this.uploading.get(batchId)?.size)) throw new ImportError('IMPORT_BUSY', 'An import operation is already active.', true);
    return batch;
  }
  createBatch(input: unknown) {
    this.expireInactive();
    const manifest = discoverManifest(input, this.limits);
    const id = this.store.create(manifest.sourceLabel, manifest.candidates, manifest.ignored);
    return this.status(id);
  }
  status(batchId: string) {
    requireId(batchId);
    const batch = this.store.batch(batchId); const rows = this.store.items(batchId); const preview = classify(this.store, rows);
    const counts = { imported: 0, duplicate: 0, skipped: 0, failed: 0, remaining: 0 };
    for (const row of rows) { if (row.result_kind) counts[row.result_kind]++; else counts.remaining++; }
    return { id: batch.id, sourceLabel: batch.source_label, status: batch.status, revision: batch.revision,
      createdAt: batch.created_at, completedAt: batch.completed_at, previewToken: batch.preview_token,
      error: batch.last_error_code ? { code: batch.last_error_code, message: batch.last_error_message, retryable: Boolean(batch.retryable) } : null,
      limits: { ...this.limits }, ignored: JSON.parse(batch.ignored_files_json) as Array<{ label: string; reason: string }>, counts,
      items: rows.map((row, index) => ({ ordinal: row.ordinal, candidateLabel: row.candidate_label,
        state: row.state, retryable: Boolean(row.retryable), result: row.result_kind, screenshotId: row.result_screenshot_id,
        error: row.error_code ? { code: row.error_code, message: row.error_message } : null,
        ...preview[index], uploadRelativePath: row.staging_path ? row.candidate_label.replace(/\.json$/, '.png') : null })),
    };
  }
  maintenance() {
    const rows = this.store.db.prepare<[], { staging_path: string | null }>('SELECT staging_path FROM import_items').all();
    return this.files.inspectStaging(new Set(rows.flatMap((row) => row.staging_path
      ? [row.staging_path, row.staging_path.replace(/\.png$/, '.part')] : [])));
  }
  async uploadImage(batchId: string, itemId: string, source: AsyncIterable<Uint8Array> | Iterable<Uint8Array>) {
    this.available(batchId, false); requireId(itemId);
    const uploads = this.uploading.get(batchId) ?? new Set<string>();
    if (uploads.has(itemId) || uploads.size >= this.limits.uploads) throw new ImportError('UPLOAD_BUSY', 'Upload concurrency limit reached.', true);
    let item = this.store.item(batchId, itemId);
    if (!item.staging_path || !(item.state === 'awaiting_upload' || item.state === 'staged' || item.state === 'ready' || (item.state === 'failed' && item.retryable))) throw new ImportError('INVALID_STATE', 'This item cannot accept an image upload.');
    const partial = item.staging_path.replace(/\.png$/, '.part');
    uploads.add(itemId); this.uploading.set(batchId, uploads);
    let descriptor: number | undefined; let created = false;
    try {
      // Repeated complete uploads must have exactly the validated original bytes, never overwrite.
      const existing = this.files.exists(item.staging_path) ? this.files.read(item.staging_path, this.limits.imageBytes) : null;
      if (!existing) {
        if (this.files.exists(partial)) throw new ImportError('FINALIZATION_CONFLICT', 'Unexpected partial upload; nothing overwritten.');
        item = this.store.move(item, 'uploading', { error_code: null, error_message: null, result_kind: null });
        descriptor = this.files.openNew(partial); created = true;
      }
      let total = 0; const hash = createHash('sha256');
      for await (const bytes of source) {
        if (!Buffer.isBuffer(bytes) && !(bytes instanceof Uint8Array)) throw new ImportError('INVALID_UPLOAD', 'Expected binary PNG chunks.');
        total += bytes.byteLength;
        if (total > this.limits.imageBytes) throw new ImportError('IMAGE_TOO_LARGE', 'Upload exceeds its image limit.');
        if (total > item.image_byte_size!) throw new ImportError('SIZE_MISMATCH', 'Upload exceeds its reserved file size; re-upload the selected PNG.', true);
        hash.update(bytes);
        if (descriptor !== undefined) this.files.writeAll(descriptor, bytes);
      }
      if (total !== item.image_byte_size) throw new ImportError('SIZE_MISMATCH', 'Upload size does not match selected file; re-upload the selected PNG.', true);
      if (existing) {
        if (hash.digest('hex') !== digest(existing)) throw new ImportError('UPLOAD_CONFLICT', 'Different bytes cannot replace a completed upload.');
      } else {
        fs.fsyncSync(descriptor!); fs.closeSync(descriptor!); descriptor = undefined;
        this.checkpoint('after_upload_part', item.id);
        this.files.renameStage(partial, item.staging_path!);
        this.checkpoint('after_staged_file', item.id);
        this.store.move(item, 'staged', { validation_issues_json: '[]', retryable: 0, result_kind: null });
      }
      this.store.touch(batchId, { status: 'uploading' });
      return this.status(batchId).items.find((entry) => entry.id === itemId)!;
    } catch (error) {
      if (descriptor !== undefined) fs.closeSync(descriptor);
      if (error instanceof ImportInterruption) throw error;
      if (created && this.files.exists(partial)) this.files.remove(partial);
      // Existing staged bytes and preview survive a conflicting repeated upload.
      if (!['ready', 'staged'].includes(item.state)) this.store.fail(this.store.item(batchId, itemId), importFailure(error));
      throw importFailure(error);
    } finally {
      uploads.delete(itemId); if (!uploads.size) this.uploading.delete(batchId);
    }
  }
  private snapshot(batchId: string) { return classify(this.store, this.store.items(batchId)); }
  preview(batchId: string, expectedRevision: number) {
    const batch = this.available(batchId); requireRevision(expectedRevision);
    if (batch.revision !== expectedRevision) throw new ImportError('REVISION_CONFLICT', 'Batch revision changed.');
    if (this.store.items(batchId).some((item) => ['confirmed', 'finalizing', 'finalized'].includes(item.state))) throw new ImportError('IMPORT_BUSY', 'Previously confirmed work must finish or recover before preview.', true);
    this.store.touch(batchId, { status: 'validating' });
    for (let item of this.store.items(batchId)) {
      if (item.state === 'failed' && item.retryable && item.staging_path && this.files.exists(item.staging_path)) {
        item = this.store.move(item, 'staged', { result_kind: null, error_code: null, error_message: null });
      }
      if (['staged', 'validating', 'ready'].includes(item.state)) this.processor.validate(item);
      else if (item.state === 'awaiting_upload') this.store.fail(item, new ImportError('UPLOAD_REQUIRED', 'PNG bytes must be uploaded before importing.', true));
    }
    for (const preview of this.snapshot(batchId)) {
      if (preview.classification === 'identity_conflict') {
        const item = this.store.item(batchId, preview.id);
        if (item.state === 'ready') this.store.move(item, 'conflict', { result_kind: 'failed', retryable: 0, error_code: 'IDENTITY_CONFLICT',
          error_message: preview.issues[0].message, validation_issues_json: JSON.stringify(preview.issues) });
      }
    }
    const token = digest(canonicalJson(this.snapshot(batchId)));
    this.store.touch(batchId, { status: 'preview_ready', preview_token: token });
    return this.status(batchId);
  }
  confirm(batchId: string, value: unknown) {
    requireId(batchId);
    const batch = this.store.batch(batchId); const input = object(value);
    knownFields(input, ['requestId', 'previewToken', 'items']); requireId(input.requestId, 'requestId');
    if (typeof input.previewToken !== 'string' || !Array.isArray(input.items) || input.items.length > this.limits.items) throw new ImportError('INVALID_CONFIRMATION', 'Invalid confirmation payload.');
    const decisions = input.items.map((value) => {
      const choice = object(value); knownFields(choice, ['itemId', 'action']); requireId(choice.itemId, 'itemId');
      if (!['import', 'keepDuplicate', 'skip'].includes(String(choice.action))) throw new ImportError('INVALID_CONFIRMATION', 'Unsupported import decision.');
      return { itemId: choice.itemId as string, action: choice.action as Confirmation['items'][number]['action'] };
    }).sort((a, b) => a.itemId < b.itemId ? -1 : 1);
    if (new Set(decisions.map((entry) => entry.itemId)).size !== decisions.length) throw new ImportError('INVALID_CONFIRMATION', 'Repeated item decision.');
    const requestId = input.requestId as string; const hash = digest(canonicalJson({ previewToken: input.previewToken, items: decisions }));
    const receipts = JSON.parse(batch.confirmation_receipts_json) as Record<string, Receipt>;
    if (receipts[requestId]) {
      if (receipts[requestId].hash !== hash) throw new ImportError('IDEMPOTENCY_CONFLICT', 'Confirmation key was already used with different decisions.');
      return this.status(batchId);
    }
    this.available(batchId);
    const snapshot = this.snapshot(batchId);
    if (!batch.preview_token || batch.preview_token !== input.previewToken || digest(canonicalJson(snapshot)) !== input.previewToken) throw new ImportError('PREVIEW_CHANGED', 'Preview changed; review it again.', true);
    for (const decision of decisions) {
      const preview = snapshot.find((item) => item.id === decision.itemId);
      const row = this.store.item(batchId, decision.itemId);
      if (!preview || row.state !== 'ready') throw new ImportError('INVALID_CONFIRMATION', 'Only validated ready items can receive decisions.');
      if (decision.action === 'import' && preview.classification !== 'valid') throw new ImportError('DUPLICATE_DECISION_REQUIRED', 'This item is not a new nonduplicate capture.');
      if (decision.action === 'keepDuplicate' && preview.classification !== 'image_duplicate') throw new ImportError('INVALID_CONFIRMATION', 'Only distinct capture identities can retain a duplicate image.');
    }
    this.store.db.transaction(() => {
      receipts[requestId] = { hash, decisions, duplicates: Object.fromEntries(snapshot.map((item) => [item.id, item.duplicateOf])), createdAt: new Date().toISOString() };
      this.store.touch(batchId, { confirmation_receipts_json: JSON.stringify(receipts), status: 'confirming', completed_at: null });
      for (const row of this.store.items(batchId).filter((item) => item.state === 'ready')) {
        const action = decisions.find((entry) => entry.itemId === row.id)?.action ?? 'skip';
        const id = row.screenshot_id ?? randomUUID();
        this.store.move(row, 'confirmed', { confirmed_decision: action, confirmation_key: requestId,
          screenshot_id: id, final_path: `screenshots/${id}.png`, result_kind: null, retryable: 0 });
      }
    }).immediate();
    this.checkpoint('after_confirmation', batchId);
    return this.status(batchId);
  }
  async processBatch(batchId: string) {
    this.available(batchId); this.processing.add(batchId);
    try {
      // Imports precede skipped duplicate results, so candidate references can resolve to real records.
      const items = this.store.items(batchId).sort((a, b) => Number(a.confirmed_decision === 'skip') - Number(b.confirmed_decision === 'skip') || a.ordinal - b.ordinal);
      for (const item of items) { this.processor.process(item); await setImmediate(); }
      this.store.summarize(batchId);
      return this.status(batchId);
    } catch (error) {
      const failure = importFailure(error);
      this.store.touch(batchId, { status: 'interrupted', last_error_code: failure.code, last_error_message: failure.message, retryable: 1 });
      throw error instanceof ImportInterruption ? error : failure;
    } finally { this.processing.delete(batchId); }
  }
  expireInactive(now = Date.now()): void {
    for (const batch of this.store.db.prepare<[], import('./contracts.js').BatchRow>('SELECT * FROM import_batches').all()) {
      if (batch.status === 'expired') { this.cleanupExpired(batch.id); continue; }
      if (this.processing.has(batch.id) || this.uploading.get(batch.id)?.size
        || Object.keys(JSON.parse(batch.confirmation_receipts_json)).length || now - Date.parse(batch.updated_at) < this.limits.retentionDays * 86400000) continue;
      const rows = this.store.items(batch.id);
      this.store.db.transaction(() => {
        for (const item of rows) if (!['committed', 'duplicate', 'skipped', 'expired'].includes(item.state)) this.store.move(item, 'expired', { result_kind: 'failed', retryable: 0, error_code: 'STAGING_EXPIRED', error_message: 'Select original files into a new batch.' });
        this.store.touch(batch.id, { status: 'expired' });
      }).immediate();
      this.checkpoint('after_expiry', batch.id);
      this.cleanupExpired(batch.id);
    }
  }
  private cleanupExpired(batchId: string): void {
    for (const item of this.store.items(batchId)) {
      if (item.state !== 'expired' || !item.staging_path) continue;
      try {
        this.files.remove(item.staging_path);
        this.files.remove(item.staging_path.replace(/\.png$/, '.part'));
      } catch (error) {
        if (storageUnavailable(error)) throw importFailure(error);
        this.store.touch(batchId, { status: 'expired', last_error_code: 'CLEANUP_FAILED', last_error_message: 'Owned expired staging cleanup needs operator review.', retryable: 1 });
      }
    }
  }
  recover(): void {
    this.expireInactive();
    const batches = this.store.db.prepare<[], import('./contracts.js').BatchRow>("SELECT * FROM import_batches WHERE status!='expired' ORDER BY created_at,id").all();
    for (const batch of batches) {
      const rows = this.store.items(batch.id).sort((a, b) => Number(a.confirmed_decision === 'skip') - Number(b.confirmed_decision === 'skip') || a.ordinal - b.ordinal);
      for (let item of rows) {
        try {
          if (['committed', 'duplicate', 'skipped'].includes(item.state)) { this.processor.cleanup(item); continue; }
          if (item.state === 'uploading') {
            if (item.staging_path && this.files.exists(item.staging_path)) item = this.store.move(item, 'staged');
            else {
              if (item.staging_path) this.files.remove(item.staging_path.replace(/\.png$/, '.part'));
              this.store.fail(item, new ImportError('UPLOAD_REQUIRED', 'Interrupted upload requires re-upload.', true)); continue;
            }
          }
          if (['staged', 'validating', 'ready'].includes(item.state)) this.processor.validate(item);
          else this.processor.process(item);
        } catch (error) {
          if (error instanceof ImportInterruption) throw error;
          if (storageUnavailable(error)) throw importFailure(error);
          const fresh = this.store.item(batch.id, item.id);
          if (['committed', 'duplicate', 'skipped'].includes(fresh.state)) {
            this.store.touch(batch.id, { last_error_code: 'CLEANUP_FAILED', last_error_message: 'Owned staging cleanup needs retry.', retryable: 1 });
          }
          if (!['committed', 'duplicate', 'skipped', 'expired', 'invalid', 'conflict'].includes(fresh.state)) this.store.fail(fresh, importFailure(error));
        }
      }
      if (this.store.items(batch.id).some((item) => item.state === 'ready')) {
        this.store.touch(batch.id, { status: 'preview_ready', preview_token: digest(canonicalJson(this.snapshot(batch.id))) });
      } else if (Object.keys(JSON.parse(batch.confirmation_receipts_json)).length) this.store.summarize(batch.id);
    }
  }
}
const engines = new WeakMap<Database.Database, CaptureImportEngine>();
export function getImportEngine(context: ImportContext): CaptureImportEngine {
  let engine = engines.get(context.db);
  if (!engine) { engine = new CaptureImportEngine(context); engines.set(context.db, engine); }
  return engine;
}
