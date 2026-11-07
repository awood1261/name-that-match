import { createHash } from 'node:crypto';
import type { CaptureMetadataV1 } from '../../../../shared/src/capture.js';
import { isPartialDate } from '../validation.js';
import { ImportError } from './contracts.js';
import type { ImportLimits } from './limits.js';

function requireValue(condition: unknown, field: string): asserts condition {
  if (!condition) throw new ImportError('INVALID_METADATA', `Invalid capture field: ${field}`);
}
function record(value: unknown, field: string): Record<string, unknown> {
  requireValue(value !== null && typeof value === 'object' && !Array.isArray(value), field);
  return value as Record<string, unknown>;
}
function boundedJson(value: unknown, depth = 0, count = { value: 0 }): void {
  requireValue(depth <= 32 && ++count.value <= 8192, 'JSON complexity');
  if (typeof value === 'number') requireValue(Number.isFinite(value), 'JSON number');
  if (value !== null && typeof value === 'object') {
    for (const entry of Object.values(value)) boundedJson(entry, depth + 1, count);
  }
}
export function validateCapture(text: string, limits: ImportLimits): CaptureMetadataV1 {
  if (Buffer.byteLength(text, 'utf8') > limits.metadataBytes) throw new ImportError('METADATA_TOO_LARGE', 'Metadata exceeds its byte limit.');
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new ImportError('INVALID_JSON', 'Metadata is not valid JSON.'); }
  boundedJson(parsed);
  const root = record(parsed, 'metadata');
  if (root.schemaVersion !== 1) throw new ImportError('UNSUPPORTED_SCHEMA', 'Only capture schema version 1 is supported.');
  requireValue(typeof root.captureId === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(root.captureId), 'captureId');
  const source = record(root.source, 'source'); const capture = record(root.capture, 'capture'); const image = record(root.image, 'image');
  requireValue(source.platform === 'youtube', 'source.platform');
  requireValue(typeof source.videoId === 'string' && /^[A-Za-z0-9_-]{11}$/.test(source.videoId), 'source.videoId');
  requireValue(typeof source.canonicalUrl === 'string', 'source.canonicalUrl');
  let url: URL;
  try { url = new URL(source.canonicalUrl); } catch { throw new ImportError('INVALID_METADATA', 'Invalid canonical URL.'); }
  requireValue(url.protocol === 'https:' && ['youtube.com', 'www.youtube.com'].includes(url.hostname)
    && !url.port && !url.username && !url.password && !url.hash && url.pathname === '/watch'
    && [...url.searchParams].length === 1 && url.searchParams.get('v') === source.videoId, 'source.canonicalUrl');
  requireValue(source.title === undefined || (typeof source.title === 'string' && source.title.trim()), 'source.title');
  requireValue(typeof capture.playbackSeconds === 'number' && Number.isFinite(capture.playbackSeconds) && capture.playbackSeconds >= 0, 'capture.playbackSeconds');
  requireValue(typeof capture.capturedAt === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(capture.capturedAt), 'capture.capturedAt');
  requireValue(isPartialDate(capture.capturedAt.slice(0, 10)) && Number.isFinite(Date.parse(capture.capturedAt))
    && new Date(capture.capturedAt).toISOString().slice(0, 19) === capture.capturedAt.slice(0, 19), 'capture.capturedAt');
  requireValue(capture.method === 'video-frame-capture', 'capture.method');
  requireValue(image.filename === `${root.captureId}.png` && image.format === 'png', 'image.filename/format');
  requireValue(Number.isSafeInteger(image.width) && Number(image.width) > 0 && Number.isSafeInteger(image.height) && Number(image.height) > 0, 'image.dimensions');
  return parsed as CaptureMetadataV1;
}
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(',')}}`;
}
export function digest(value: string | Uint8Array): string { return createHash('sha256').update(value).digest('hex'); }
export function sameMetadata(a: string, b: string): boolean { return canonicalJson(JSON.parse(a)) === canonicalJson(JSON.parse(b)); }
