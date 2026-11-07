import type { CaptureMetadataV1 } from '../../../../shared/src/capture.js';

export class ImportError extends Error {
  constructor(public readonly code: string, message: string, public readonly retryable = false) {
    super(message); this.name = 'ImportError';
  }
}
/** Test/instrumentation checkpoints model abrupt termination without running compensating writes. */
export class ImportInterruption extends Error {}
export type Checkpoint = (point: string, itemId: string) => void;
export interface Issue { code: string; message: string; field?: string }
export type ItemState = 'awaiting_upload' | 'uploading' | 'staged' | 'validating' | 'ready' | 'confirmed' | 'finalizing' | 'finalized' | 'committed' | 'invalid' | 'duplicate' | 'skipped' | 'conflict' | 'failed' | 'expired';
export type Action = 'import' | 'keepDuplicate' | 'skip';
export type ResultKind = 'imported' | 'duplicate' | 'skipped' | 'failed';
export type Classification = 'valid' | 'already_imported' | 'image_duplicate' | 'invalid' | 'identity_conflict' | 'upload_required';
export interface ManifestFile { clientFileId: string; relativePath: string; byteSize: number; metadataText?: string }
export interface Candidate { label: string; metadataText: string | null; metadata: CaptureMetadataV1 | null; byteSize: number | null; issues: Issue[] }
export interface Decision { itemId: string; action: Action }
export interface Confirmation { requestId: string; previewToken: string; items: Decision[] }
export interface PreviewItem { id: string; classification: Classification | null; duplicateOf: string[]; defaultAction: Action | null; issues: Issue[] }
export interface Receipt { hash: string; decisions: Decision[]; duplicates: Record<string, string[]>; createdAt: string }
export interface BatchRow {
  id: string; source_label: string; status: string; revision: number; created_at: string; updated_at: string;
  completed_at: string | null; preview_token: string | null; confirmation_receipts_json: string;
  ignored_files_json: string; last_error_code: string | null; last_error_message: string | null; retryable: number;
}
export interface ItemRow {
  id: string; batch_id: string; ordinal: number; candidate_label: string; original_metadata_json: string | null;
  source_platform: 'youtube' | null; capture_id: string | null; validation_issues_json: string;
  staging_path: string | null; final_path: string | null; screenshot_id: string | null;
  image_sha256: string | null; image_width: number | null; image_height: number | null; image_byte_size: number | null;
  state: ItemState; resume_state: ItemState | null; confirmed_decision: Action | null; confirmation_key: string | null;
  result_kind: ResultKind | null; error_code: string | null; error_message: string | null; retryable: number;
  result_screenshot_id: string | null; created_at: string; updated_at: string;
}
export function importFailure(error: unknown): ImportError {
  if (error instanceof ImportError) return error;
  if (storageUnavailable(error)) return new ImportError('IMPORT_STORAGE_UNAVAILABLE', 'Import storage is unavailable; stop and check disk space and permissions before retrying.', true);
  return new ImportError('IMPORT_IO_FAILED', 'Import storage operation failed; retry after checking local storage.', true);
}
export function storageUnavailable(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code ?? '';
  return ['IMPORT_STORAGE_UNAVAILABLE', 'ENOSPC', 'EDQUOT', 'EROFS', 'EACCES', 'EPERM', 'EMFILE', 'ENFILE', 'EIO'].includes(code)
    || /^(SQLITE_FULL|SQLITE_IOERR|SQLITE_READONLY|SQLITE_CANTOPEN)/.test(code);
}
