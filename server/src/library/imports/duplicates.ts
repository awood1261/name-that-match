import type { ItemRow, PreviewItem } from './contracts.js';
import { sameMetadata } from './capture-validation.js';
import { ImportStore } from './persistence.js';

export interface ExistingCapture { id: string; original_metadata_json: string; image_sha256: string }
export function existingIdentity(store: ImportStore, item: ItemRow): ExistingCapture | undefined {
  return store.db.prepare<[string | null, string | null], ExistingCapture>('SELECT id,original_metadata_json,image_sha256 FROM screenshots WHERE source_platform=? AND capture_id=?').get(item.source_platform, item.capture_id);
}
export function existingImages(store: ImportStore, item: ItemRow): string[] {
  return (store.db.prepare('SELECT id FROM screenshots WHERE image_sha256=? ORDER BY id').all(item.image_sha256) as Array<{ id: string }>).map((row) => row.id);
}
export function matchingCapture(existing: ExistingCapture, item: ItemRow): boolean {
  return existing.image_sha256 === item.image_sha256 && item.original_metadata_json !== null && sameMetadata(existing.original_metadata_json, item.original_metadata_json);
}
export function classify(store: ImportStore, rows: ItemRow[]): PreviewItem[] {
  return rows.map((item, index) => {
    const issues = JSON.parse(item.validation_issues_json) as PreviewItem['issues'];
    const base = { id: item.id, issues, duplicateOf: [] as string[], defaultAction: 'skip' as PreviewItem['defaultAction'] };
    if (['committed', 'duplicate', 'skipped'].includes(item.state)) return { ...base, classification: null, defaultAction: null };
    if (!['ready', 'confirmed', 'finalizing', 'finalized'].includes(item.state)) {
      return { ...base, classification: item.state === 'conflict' || item.error_code === 'IDENTITY_CONFLICT' ? 'identity_conflict' : ['invalid', 'expired'].includes(item.state) ? 'invalid' : 'upload_required' };
    }
    const identity = existingIdentity(store, item);
    if (identity) return matchingCapture(identity, item)
      ? { ...base, classification: 'already_imported', duplicateOf: [identity.id] }
      : { ...base, classification: 'identity_conflict', issues: [{ code: 'IDENTITY_CONFLICT', message: 'Capture identity already has different content or provenance.' }] };
    const sameIdentity = rows.filter((other) => other.id !== item.id && other.source_platform === item.source_platform && other.capture_id === item.capture_id && other.image_sha256);
    if (sameIdentity.some((other) => other.image_sha256 !== item.image_sha256 || !sameMetadata(other.original_metadata_json!, item.original_metadata_json!))) {
      return { ...base, classification: 'identity_conflict', issues: [{ code: 'IDENTITY_CONFLICT', message: 'Conflicting capture identities within this batch.' }] };
    }
    const earlierIdentity = rows.slice(0, index).find((other) => other.source_platform === item.source_platform && other.capture_id === item.capture_id && other.image_sha256);
    if (earlierIdentity) return { ...base, classification: 'already_imported', duplicateOf: [`item:${earlierIdentity.id}`] };
    const duplicates = [...existingImages(store, item), ...rows.slice(0, index).filter((other) => other.image_sha256 === item.image_sha256 && other.capture_id !== item.capture_id).map((other) => `item:${other.id}`)].sort();
    return duplicates.length ? { ...base, classification: 'image_duplicate', duplicateOf: duplicates }
      : { ...base, classification: 'valid', defaultAction: 'import' };
  });
}
