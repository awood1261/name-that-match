import path from 'node:path';
import { knownFields, object } from '../validation.js';
import { ImportError, type Candidate, type Issue, type ManifestFile } from './contracts.js';
import { validateCapture } from './capture-validation.js';
import type { ImportLimits } from './limits.js';

export function safeSelectionPath(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 4096
    && !value.startsWith('/') && !/[\\:]/.test(value) && !Array.from(value).some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127)
    && value.split('/').every((part) => part !== '' && part !== '.' && part !== '..');
}
function issue(code: string, message: string): Issue { return { code, message }; }
export function discoverManifest(input: unknown, limits: ImportLimits) {
  if (Buffer.byteLength(JSON.stringify(input) ?? '') > limits.jsonBytes) throw new ImportError('BODY_TOO_LARGE', 'Selection manifest is too large.');
  const root = object(input); knownFields(root, ['sourceLabel', 'files']);
  if (typeof root.sourceLabel !== 'string' || !root.sourceLabel.trim() || Array.from(root.sourceLabel).length > 255
    || Array.from(root.sourceLabel).some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127)) throw new ImportError('INVALID_MANIFEST', 'Invalid source label.');
  if (!Array.isArray(root.files) || !root.files.length || root.files.length > 1024) throw new ImportError('ITEM_LIMIT', 'Select 1–1024 file descriptors.');
  const files: ManifestFile[] = []; const candidates: Candidate[] = []; const ignored: Array<{ label: string; reason: string }> = [];
  const clientIds = new Set<string>();
  for (const [index, entry] of root.files.entries()) {
    const file = object(entry); knownFields(file, ['clientFileId', 'relativePath', 'byteSize', 'metadataText']);
    if (typeof file.clientFileId !== 'string' || !file.clientFileId || clientIds.has(file.clientFileId)
      || !Number.isSafeInteger(file.byteSize) || Number(file.byteSize) < 0) throw new ImportError('INVALID_MANIFEST', 'Invalid file descriptor identity or size.');
    clientIds.add(file.clientFileId);
    if (!safeSelectionPath(file.relativePath)) {
      candidates.push({ label: `Unsafe selection ${index + 1}`, metadataText: null, metadata: null, byteSize: null, issues: [issue('UNSAFE_PATH', 'Unsafe selected filename or relative path.')] });
      continue;
    }
    files.push({ ...file, relativePath: file.relativePath.normalize('NFC') } as unknown as ManifestFile);
  }
  const byPath = new Map<string, ManifestFile[]>();
  for (const file of files) byPath.set(file.relativePath, [...(byPath.get(file.relativePath) ?? []), file]);
  const usedPng = new Set<string>();
  for (const file of files.filter((f) => f.relativePath.endsWith('.json')).sort((a, b) => a.relativePath < b.relativePath ? -1 : a.relativePath > b.relativePath ? 1 : 0)) {
    const errors: Issue[] = []; let metadata: Candidate['metadata'] = null;
    if (typeof file.metadataText !== 'string') errors.push(issue('MISSING_METADATA', 'JSON descriptor requires original metadata text.'));
    else {
      try { metadata = validateCapture(file.metadataText, limits); }
      catch (error) {
        const failure = error instanceof ImportError ? error : new ImportError('INVALID_METADATA', 'Invalid capture metadata.');
        errors.push(issue(failure.code, failure.message));
      }
    }
    const expectedPng = file.relativePath.slice(0, -5) + '.png';
    const partners = byPath.get(expectedPng) ?? [];
    usedPng.add(expectedPng);
    if ((byPath.get(file.relativePath)?.length ?? 0) !== 1 || partners.length > 1) errors.push(issue('AMBIGUOUS_PAIR', 'Repeated selection paths cannot be paired unambiguously.'));
    if (!partners.length) errors.push(issue('MISSING_PNG', 'Capture JSON has no matching PNG.'));
    if (metadata && (path.posix.basename(file.relativePath) !== `${metadata.captureId}.json`
      || path.posix.basename(expectedPng) !== metadata.image.filename)) errors.push(issue('FILENAME_MISMATCH', 'Capture ID and PNG/JSON filenames disagree.'));
    const size = partners[0]?.byteSize ?? null;
    if (size !== null && (size === 0 || size > limits.imageBytes)) errors.push(issue('IMAGE_TOO_LARGE', 'PNG size must be positive and within the configured limit.'));
    candidates.push({ label: file.relativePath, metadataText: typeof file.metadataText === 'string' ? file.metadataText : null,
      metadata, byteSize: size && size <= limits.imageBytes ? size : null, issues: errors });
  }
  for (const file of files) {
    if (file.relativePath.endsWith('.png')) {
      if (!usedPng.has(file.relativePath)) candidates.push({ label: file.relativePath, metadataText: null, metadata: null, byteSize: null,
        issues: [issue('MISSING_JSON', 'PNG has no matching capture JSON.')] });
    } else if (!file.relativePath.endsWith('.json')) ignored.push({ label: file.relativePath, reason: path.posix.basename(file.relativePath) === '.DS_Store' ? 'harmless' : 'unsupported_type' });
  }
  if (candidates.length > limits.items) throw new ImportError('ITEM_LIMIT', 'Too many capture candidates.');
  // Reserve declared image bytes up front, once per selected PNG. Actual uploads cannot exceed their reservation.
  const bytes = files.filter((f) => f.relativePath.endsWith('.png')).reduce((total, f) => total + f.byteSize, 0);
  if (!Number.isSafeInteger(bytes) || bytes > limits.batchBytes) throw new ImportError('BATCH_TOO_LARGE', 'Selected image bytes exceed the batch limit.');
  return { sourceLabel: root.sourceLabel.trim(), candidates, ignored };
}
