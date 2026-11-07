import type { Screenshot } from './library.js';

export type ImportAction = 'import' | 'keepDuplicate' | 'skip';
export interface ImportLimits {
  imageBytes: number; imagePixels: number; decompressedBytes: number; metadataBytes: number;
  jsonBytes: number; items: number; batchBytes: number; uploads: number; retentionDays: number;
}
export interface ImportItem {
  id: string; ordinal: number; candidateLabel: string; state: string; retryable: boolean;
  result: 'imported' | 'duplicate' | 'skipped' | 'failed' | null; screenshotId: string | null;
  classification: 'valid' | 'already_imported' | 'image_duplicate' | 'invalid' | 'identity_conflict' | 'upload_required' | null;
  issues: Array<{ code: string; message: string; field?: string }>; duplicateOf: string[];
  defaultAction: ImportAction | null; uploadUrl: string | null; error: { code: string; message: string | null } | null;
}
export interface BatchStatus {
  id: string; sourceLabel: string; status: string; revision: number; createdAt: string;
  completedAt: string | null; previewToken: string | null; limits: ImportLimits; items: ImportItem[];
  ignored: Array<{ label: string; reason: string }>;
  counts: { imported: number; duplicate: number; skipped: number; failed: number; remaining: number };
  classificationCounts: Record<string, number>;
  error: { code: string; message: string | null; retryable: boolean } | null;
}
export interface ImportConfirmation { requestId: string; previewToken: string; items: Array<{ itemId: string; action: ImportAction }> }
export interface SelectionManifest {
  sourceLabel: string;
  files: Array<{ clientFileId: string; relativePath: string; byteSize: number; metadataText?: string }>;
}
/** Minimal committed read projection for Milestone 3. Review/eligibility is added in Milestone 5. */
export interface ScreenshotSummary extends Omit<Screenshot, 'originalMetadataJson' | 'image'> {
  image: Screenshot['image'] & { url: string };
  assetStatus: 'available' | 'missing' | 'corrupt' | 'unavailable';
}
export interface ScreenshotList { screenshots: ScreenshotSummary[]; matchedCount: number; asOf: string }
export interface ApiFailure { code: string; message: string; retryable?: boolean; fieldErrors?: Record<string, string>; currentRevision?: number; currentMatchRevision?: number; itemId?: string }
