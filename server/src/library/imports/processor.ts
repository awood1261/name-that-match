import fs from 'node:fs';
import { createLibraryRepository } from '../repository.js';
import { validateCapture } from './capture-validation.js';
import { ImportError, ImportInterruption, importFailure, storageUnavailable, type ItemRow, type Checkpoint, type Receipt } from './contracts.js';
import { existingIdentity, existingImages, matchingCapture } from './duplicates.js';
import { ImportFiles } from './files.js';
import type { ImportLimits } from './limits.js';
import { ImportStore } from './persistence.js';
import { validatePng } from './png.js';

export class ImportProcessor {
  constructor(readonly store: ImportStore, readonly files: ImportFiles, readonly limits: ImportLimits, readonly checkpoint: Checkpoint) {}
  read(item: ItemRow, relative: string) {
    const metadata = validateCapture(item.original_metadata_json!, this.limits);
    let bytes: Buffer;
    try { bytes = this.files.read(relative, this.limits.imageBytes); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new ImportError('UPLOAD_REQUIRED', 'Managed image bytes are missing; re-upload the original PNG and refresh preview.', true);
      throw error;
    }
    const image = validatePng(bytes, this.limits);
    if (image.width !== metadata.image.width || image.height !== metadata.image.height) throw new ImportError('DIMENSION_MISMATCH', 'PNG dimensions disagree with capture metadata.');
    if (item.image_byte_size !== image.byteSize) throw new ImportError('SIZE_MISMATCH', 'Image bytes disagree with the selected file size.');
    if (item.image_sha256 && item.image_sha256 !== image.sha256) throw new ImportError('IMAGE_HASH_MISMATCH', 'Managed bytes changed after validation.');
    return { bytes, image, metadata };
  }
  validate(item: ItemRow): ItemRow {
    if (item.state === 'failed') item = this.store.move(item, 'staged', { error_code: null, error_message: null, result_kind: null });
    if (item.state === 'staged' || item.state === 'ready') item = this.store.move(item, 'validating');
    if (item.state !== 'validating') return item;
    this.checkpoint('during_validation', item.id);
    try {
      const { image } = this.read(item, item.staging_path!);
      return this.store.move(item, 'ready', { image_sha256: image.sha256, image_width: image.width, image_height: image.height,
        result_kind: null, error_code: null, error_message: null, retryable: 0, validation_issues_json: '[]' });
    } catch (error) {
      if (error instanceof ImportInterruption) throw error;
      if (storageUnavailable(error)) throw importFailure(error);
      const failure = importFailure(error);
      if (failure.retryable) return this.store.fail(item, failure);
      return this.store.move(item, 'invalid', { result_kind: 'failed', error_code: failure.code, error_message: failure.message,
        retryable: 0, validation_issues_json: JSON.stringify([{ code: failure.code, message: failure.message }]) });
    }
  }
  cleanup(item: ItemRow): void {
    if (item.staging_path && ['committed', 'duplicate', 'skipped'].includes(item.state)) {
      this.files.remove(item.staging_path);
    }
  }
  private acknowledged(item: ItemRow): Set<string> {
    const batch = this.store.batch(item.batch_id);
    const receipts = JSON.parse(batch.confirmation_receipts_json) as Record<string, Receipt>;
    const references = receipts[item.confirmation_key!]?.duplicates[item.id] ?? [];
    const acknowledged = new Set<string>();
    for (const reference of references) {
      if (reference.startsWith('item:')) {
        const other = this.store.item(item.batch_id, reference.slice(5));
        if (other.result_screenshot_id) acknowledged.add(other.result_screenshot_id);
      } else acknowledged.add(reference);
    }
    return acknowledged;
  }
  private checkDuplicates(item: ItemRow): string | undefined {
    const identity = existingIdentity(this.store, item);
    if (identity) {
      if (!matchingCapture(identity, item)) throw new ImportError('IDENTITY_CONFLICT', 'Capture identity has different committed content or provenance.');
      return identity.id;
    }
    const duplicates = existingImages(this.store, item);
    if (duplicates.some((id) => !this.acknowledged(item).has(id))) throw new ImportError('PREVIEW_CHANGED', 'New duplicate content was committed; refresh preview and decide again.', true);
    if (duplicates.length && item.confirmed_decision !== 'keepDuplicate') throw new ImportError('PREVIEW_CHANGED', 'Duplicate image requires explicit retention.', true);
    return undefined;
  }
  private finalize(item: ItemRow): ItemRow {
    const destination = item.final_path!;
    if (item.state === 'confirmed') {
      if (this.files.exists(destination) && !['finalizing', 'finalized'].includes(item.resume_state ?? '')) {
        throw new ImportError('FINALIZATION_CONFLICT', 'An unexpected destination already exists.');
      }
      item = this.store.move(item, 'finalizing', { resume_state: 'finalizing' });
      this.checkpoint('after_finalizing', item.id);
    }
    if (item.state !== 'finalizing') return item;
    if (this.files.exists(destination)) {
      try { this.read(item, destination); }
      catch (error) {
        // Only the recorded interrupted finalizing attempt with intact staged source may be quarantined.
        if (this.store.db.prepare('SELECT id FROM screenshots WHERE image_path=?').get(destination)) throw new ImportError('FINALIZATION_CONFLICT', 'Destination is already referenced.');
        if (!(error instanceof ImportError) || !['INVALID_PNG', 'SIZE_MISMATCH', 'IMAGE_HASH_MISMATCH', 'DIMENSION_MISMATCH'].includes(error.code)) throw error;
        const source = this.read(item, item.staging_path!).bytes;
        const partial = this.files.read(destination, this.limits.imageBytes);
        if (partial.length >= source.length || !partial.equals(source.subarray(0, partial.length))) {
          throw new ImportError('FINALIZATION_CONFLICT', 'Unexpected destination bytes retained for review.');
        }
        const quarantine = item.staging_path!.replace(/\.png$/, '.quarantine');
        if (this.files.exists(quarantine)) this.files.remove(destination);
        else this.files.quarantineFinal(destination, quarantine);
      }
    }
    if (!this.files.exists(destination)) {
      const { bytes } = this.read(item, item.staging_path!);
      let descriptor: number;
      try { descriptor = this.files.openNew(destination); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new ImportError('FINALIZATION_CONFLICT', 'Unexpected destination; nothing overwritten.');
        throw error;
      }
      try {
        this.files.writeAll(descriptor, bytes.subarray(0, 32));
        this.checkpoint('during_final_copy', item.id);
        for (let offset = 32; offset < bytes.length; offset += 65536) this.files.writeAll(descriptor, bytes.subarray(offset, offset + 65536));
        fs.fsyncSync(descriptor);
      } finally { fs.closeSync(descriptor); }
      this.checkpoint('after_final_file', item.id);
    }
    this.read(item, destination);
    item = this.store.move(item, 'finalized', { resume_state: 'finalized' });
    this.checkpoint('after_finalized', item.id);
    return item;
  }
  process(original: ItemRow): void {
    let item = original;
    try {
      if (item.state === 'failed' && item.retryable && item.confirmation_key) {
        const state = item.resume_state;
        if (!state || !['confirmed', 'finalizing', 'finalized'].includes(state)) return;
        item = this.store.move(item, state, { result_kind: null, error_code: null, error_message: null });
      }
      if (!['confirmed', 'finalizing', 'finalized'].includes(item.state)) return;
      if (item.confirmed_decision === 'skip') {
        const identity = existingIdentity(this.store, item);
        const duplicate = identity && matchingCapture(identity, item) ? identity.id : existingImages(this.store, item)[0];
        item = this.store.move(item, duplicate ? 'duplicate' : 'skipped', { result_kind: duplicate ? 'duplicate' : 'skipped', result_screenshot_id: duplicate ?? null });
        this.cleanup(item); return;
      }
      if (!this.files.exists(item.staging_path!) && !this.files.exists(item.final_path!)) {
        throw new ImportError('UPLOAD_REQUIRED', 'Managed image bytes are missing; re-upload the original PNG, refresh preview, and confirm again.', true);
      }
      const duplicate = this.checkDuplicates(item);
      if (duplicate) {
        item = this.store.move(item, 'duplicate', { result_kind: 'duplicate', result_screenshot_id: duplicate });
        this.cleanup(item); return;
      }
      item = this.finalize(item);
      const validated = this.read(item, item.final_path!);
      this.checkpoint('before_commit', item.id);
      this.store.db.transaction(() => {
        const existing = this.checkDuplicates(item);
        if (existing) item = this.store.move(item, 'duplicate', { result_kind: 'duplicate', result_screenshot_id: existing });
        else {
          const record = createLibraryRepository(this.store.db).insertCommittedScreenshot({ id: item.screenshot_id!,
            provenance: validated.metadata, originalMetadataJson: item.original_metadata_json!, image: validated.image });
          this.checkpoint('after_insert', item.id);
          item = this.store.move(item, 'committed', { result_kind: 'imported', result_screenshot_id: record.id, resume_state: null, retryable: 0 });
        }
      }).immediate();
      this.checkpoint('after_commit', item.id);
      this.cleanup(item);
    } catch (error) {
      if (error instanceof ImportInterruption) throw error;
      const fresh = this.store.item(item.batch_id, item.id);
      if (['committed', 'duplicate', 'skipped'].includes(fresh.state)) {
        this.store.touch(item.batch_id, { last_error_code: 'CLEANUP_FAILED', last_error_message: 'Owned staging cleanup needs retry.', retryable: 1 });
        if (storageUnavailable(error)) throw importFailure(error);
        return;
      } // A cleanup error cannot undo a durable result.
      const failure = importFailure(error);
      this.store.fail(fresh, failure);
      if (storageUnavailable(error)) throw failure;
    }
  }
}
