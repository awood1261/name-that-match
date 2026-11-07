import type http from 'node:http';
import type { ApiFailure } from '../../../../shared/src/imports.js';
import { DomainValidationError } from '../validation.js';
import { RecordNotFoundError, RevisionConflictError } from '../repository.js';
import { ImportError, storageUnavailable } from '../imports/contracts.js';

export class HttpError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly allow?: string) { super(message); }
}
export function json(res: http.ServerResponse, status: number, body: unknown, headers: http.OutgoingHttpHeaders = {}) {
  if (res.destroyed || res.writableEnded) return;
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers });
  res.end(JSON.stringify(body));
}
export function errorResponse(res: http.ServerResponse, error: unknown) {
  let status = 500; let detail: ApiFailure = { code: 'INTERNAL_ERROR', message: 'Unable to complete the library request.' }; let allow: string | undefined;
  if (error instanceof HttpError) { status = error.status; detail = { code: error.code, message: error.message }; allow = error.allow; }
  else if (error instanceof DomainValidationError) { status = 400; detail = { code: 'INVALID_REQUEST', message: error.message, fieldErrors: error.fieldErrors }; }
  else if (error instanceof RecordNotFoundError) { status = 404; detail = { code: 'NOT_FOUND', message: 'Screenshot not found.' }; }
  else if (error instanceof RevisionConflictError) { status = 409; detail = { code: 'REVISION_CONFLICT', message: 'Record changed; reload before retrying.', currentRevision: error.currentRevision }; }
  else if (error instanceof ImportError) {
    status = error.code === 'NOT_FOUND' ? 404 : error.code === 'STAGING_EXPIRED' ? 410
      : ['IMAGE_TOO_LARGE', 'BODY_TOO_LARGE', 'BATCH_TOO_LARGE', 'ITEM_LIMIT', 'METADATA_TOO_LARGE'].includes(error.code) ? 413
      : /CONFLICT|BUSY|PREVIEW_CHANGED|DUPLICATE_DECISION_REQUIRED|INVALID_STATE/.test(error.code) ? 409
      : ['IMPORT_IO_FAILED', 'IMPORT_STORAGE_UNAVAILABLE', 'UNSAFE_STORAGE'].includes(error.code) ? 503
      : ['INVALID_CONFIRMATION', 'INVALID_MANIFEST', 'INVALID_UPLOAD', 'UNSAFE_PATH', 'REQUEST_ABORTED'].includes(error.code) ? 400 : 422;
    detail = { code: error.code, message: error.message, retryable: error.retryable };
  } else if (storageUnavailable(error)) { status = 503; detail = { code: 'STORAGE_UNAVAILABLE', message: 'Local library storage is unavailable.', retryable: true }; }
  json(res, status, { error: detail }, allow ? { Allow: allow } : {});
}
export function requestUrl(raw: string): URL {
  try {
    const path = raw.split('?')[0]; const decoded = decodeURIComponent(path);
    if (!path.startsWith('/') || path.startsWith('//') || /%2f|%5c/i.test(path) || decoded.includes('\\')
      || Array.from(decoded).some((c) => c.charCodeAt(0) < 32) || decoded.split('/').some((part) => part === '.' || part === '..')) throw new Error('path');
    return new URL(raw, 'http://localhost');
  } catch { throw new HttpError(400, 'INVALID_URL', 'Invalid request URL or path.'); }
}
export function media(req: http.IncomingMessage, expected: string) {
  if (req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== expected) throw new HttpError(415, 'UNSUPPORTED_MEDIA_TYPE', `Expected ${expected}.`);
}
export async function* chunks(req: http.IncomingMessage, limit: number): AsyncGenerator<Buffer> {
  const declared = req.headers['content-length'];
  if (declared && Number(declared) > limit) throw new ImportError('BODY_TOO_LARGE', 'Request exceeds its byte limit.');
  let total = 0;
  try {
    for await (const bytes of req.iterator({ destroyOnReturn: false })) {
      const chunk = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
      total += chunk.length;
      if (total > limit) throw new ImportError('BODY_TOO_LARGE', 'Request exceeds its byte limit.');
      yield chunk;
    }
    if (!req.complete) throw new ImportError('REQUEST_ABORTED', 'Upload interrupted; retry from byte zero.', true);
  } catch (error) {
    if (req.aborted) throw new ImportError('REQUEST_ABORTED', 'Upload interrupted; retry from byte zero.', true);
    throw error;
  }
}
export async function body(req: http.IncomingMessage, limit: number): Promise<unknown> {
  media(req, 'application/json'); const parts: Buffer[] = [];
  for await (const chunk of chunks(req, limit)) parts.push(chunk);
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(Buffer.concat(parts))); }
  catch { throw new HttpError(400, 'INVALID_JSON', 'Request must contain valid JSON.'); }
}
export function configuredOrigins(production: boolean): Set<string> {
  const configured = process.env.NAME_THAT_MATCH_UI_ORIGINS;
  const origins = configured === undefined ? ['http://localhost:3001', 'http://127.0.0.1:3001',
    ...(!production ? ['http://localhost:5173', 'http://127.0.0.1:5173'] : [])] : configured.split(',').map((value) => value.trim());
  for (const origin of origins) {
    let url: URL;
    try { url = new URL(origin); } catch { throw new Error('Invalid NAME_THAT_MATCH_UI_ORIGINS: use exact HTTP origins.'); }
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin || url.username || url.password) throw new Error('Invalid NAME_THAT_MATCH_UI_ORIGINS: use exact HTTP origins.');
  }
  return new Set(origins);
}
export function mutationPolicy(req: http.IncomingMessage, origins: Set<string>) {
  const origin = req.headers.origin;
  if ((origin !== undefined && !origins.has(origin)) || req.method === 'OPTIONS') throw new HttpError(403, 'ORIGIN_REJECTED', 'Use the configured local application origin.');
  if (req.headers['x-name-that-match'] !== 'library') throw new HttpError(403, 'LIBRARY_HEADER_REQUIRED', 'Library mutation header is required.');
}
