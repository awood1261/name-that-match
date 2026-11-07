import { describe, expect, it } from 'vitest';
import { validateCapture, sameMetadata } from '../../server/src/library/imports/capture-validation';
import { DEFAULT_IMPORT_LIMITS, importLimits } from '../../server/src/library/imports/limits';
import { discoverManifest, safeSelectionPath } from '../../server/src/library/imports/manifest';
import { validatePng, pngCrc } from '../../server/src/library/imports/png';
import { capture, chunk, customPng, manifest, png } from './fixtures';
const limits = { ...DEFAULT_IMPORT_LIMITS };

describe('capture and selection validation', () => {
  it('accepts the authored v1 fixture, optional title, preserved extra fields and original text', () => {
    const original = manifest([capture()]).files[0].metadataText!;
    expect(validateCapture(original, limits)).toMatchObject({ schemaVersion: 1, extensionField: { retained: true } });
    const withTitle = capture(); withTitle.metadata.source.title = 'Source footage';
    expect(validateCapture(JSON.stringify(withTitle.metadata), limits).source.title).toBe('Source footage');
    expect(sameMetadata(original, JSON.stringify(JSON.parse(original)))).toBe(true);
    expect(sameMetadata(original, JSON.stringify(withTitle.metadata))).toBe(false);
  });
  it.each([
    ['schemaVersion', 2], ['captureId', '../unsafe'], ['source', null], ['image', []], ['capture', null],
  ])('rejects malformed root field %s', (field, value) => {
    const metadata = { ...capture().metadata, [field]: value };
    expect(() => validateCapture(JSON.stringify(metadata), limits)).toThrow();
  });
  it.each([
    ['source', 'platform', 'other'], ['source', 'videoId', 'short'], ['source', 'title', ''],
    ['source', 'canonicalUrl', 'https://www.youtube.com/watch?v=different01'],
    ['source', 'canonicalUrl', 'http://www.youtube.com/watch?v=abcdefghijk'],
    ['source', 'canonicalUrl', 'https://evil.example/watch?v=abcdefghijk'],
    ['source', 'canonicalUrl', 'https://www.youtube.com/watch?v=abcdefghijk&v=abcdefghijk'],
    ['capture', 'playbackSeconds', -1], ['capture', 'capturedAt', '2026-02-30T12:00:00Z'],
    ['capture', 'capturedAt', '2026-11-06T25:00:00Z'], ['capture', 'capturedAt', 'yesterday'],
    ['capture', 'method', 'tab-capture'], ['image', 'filename', 'sample (1).png'],
    ['image', 'format', 'jpg'], ['image', 'width', 0], ['image', 'height', 1.5],
  ])('rejects invalid %s.%s', (parent, field, value) => {
    const metadata = JSON.parse(JSON.stringify(capture().metadata)); metadata[parent][field] = value;
    expect(() => validateCapture(JSON.stringify(metadata), limits)).toThrow();
    delete metadata[parent][field];
    if (!(parent === 'source' && field === 'title')) expect(() => validateCapture(JSON.stringify(metadata), limits)).toThrow();
  });
  it('bounds JSON size/depth/value count and nonfinite numbers including unknown fields', () => {
    const text = JSON.stringify(capture().metadata);
    expect(() => validateCapture(text, { ...limits, metadataBytes: 10 })).toThrow(/byte limit/);
    expect(() => validateCapture('{bad', limits)).toThrow(/valid JSON/);
    expect(() => validateCapture(text.replace('42.25', '1e999'), limits)).toThrow();
    let nested: unknown = {};
    for (let i = 0; i < 34; i++) nested = { nested };
    expect(() => validateCapture(JSON.stringify({ ...capture().metadata, nested }), limits)).toThrow();
    expect(() => validateCapture(JSON.stringify({ ...capture().metadata, many: Array(8200).fill(0) }), limits)).toThrow();
  });
  it.each(['../outside.png', '/absolute.png', 'C:/capture.png', 'a\\b.png', 'a//b.png', './a.png', 'a/../b.png', 'a/\0b.png'])('rejects unsafe path %s', (name) => {
    expect(safeSelectionPath(name)).toBe(false);
  });
  it('pairs parent/video/flat selection contexts and reports ignored files', () => {
    for (const directory of ['NameThatMatch/abcdefghijk', 'abcdefghijk', '']) {
      const selection = manifest([capture()]);
      for (const file of selection.files) file.relativePath = (directory ? directory + '/' : '') + file.relativePath.split('/').pop();
      const result = discoverManifest(selection, limits);
      expect(result.candidates[0].issues).toEqual([]);
    }
    const selection = manifest([capture()]);
    selection.files.push({ clientFileId: 'extra', relativePath: '.DS_Store', byteSize: 1 });
    selection.files.push({ clientFileId: 'other', relativePath: 'notes.txt', byteSize: 1 });
    expect(discoverManifest(selection, limits).ignored.map((item) => item.reason)).toEqual(['harmless', 'unsupported_type']);
  });
  it('reports missing partners, filename collisions, malformed metadata and unsafe paths per item', () => {
    const selection = manifest([capture()]);
    expect(discoverManifest({ ...selection, files: [selection.files[0]] }, limits).candidates[0].issues[0].code).toBe('MISSING_PNG');
    expect(discoverManifest({ ...selection, files: [selection.files[1]] }, limits).candidates[0].issues[0].code).toBe('MISSING_JSON');
    const duplicate = { ...selection.files[1], clientFileId: 'duplicate' };
    expect(discoverManifest({ ...selection, files: [...selection.files, duplicate] }, limits).candidates[0].issues[0].code).toBe('AMBIGUOUS_PAIR');
    selection.files[0].metadataText = '{}';
    expect(discoverManifest(selection, limits).candidates[0].issues.length).toBeGreaterThan(0);
    selection.files[1].relativePath = '../outside.png';
    expect(discoverManifest(selection, limits).candidates.some((item) => item.issues[0]?.code === 'UNSAFE_PATH')).toBe(true);
  });
  it('rejects collision-renamed JSON basenames and batch/item/body limits', () => {
    const selection = manifest([capture()]);
    for (const file of selection.files) file.relativePath = file.relativePath.replace('sample.', 'sample (1).');
    expect(discoverManifest(selection, limits).candidates[0].issues.some((item) => item.code === 'FILENAME_MISMATCH')).toBe(true);
    expect(() => discoverManifest(manifest([capture()]), { ...limits, batchBytes: 1 })).toThrow(/batch limit/);
    expect(() => discoverManifest(manifest([capture('one'), capture('two')]), { ...limits, items: 1 })).toThrow();
    expect(() => discoverManifest(manifest([capture()]), { ...limits, jsonBytes: 1 })).toThrow();
  });
  it('validates and applies environment limits', () => {
    expect(importLimits({ NAME_THAT_MATCH_MAX_IMAGE_BYTES: '123' }).imageBytes).toBe(123);
    for (const value of ['0', '-1', '1.5', 'NaN', '9007199254740992']) expect(() => importLimits({ NAME_THAT_MATCH_MAX_IMPORT_ITEMS: value })).toThrow();
  });
  it('rejects missing required root fields and preserves inert prototype-like extra keys', () => {
    for (const key of ['schemaVersion', 'captureId', 'source', 'capture', 'image']) {
      const value: Record<string, unknown> = { ...capture().metadata }; delete value[key];
      expect(() => validateCapture(JSON.stringify(value), limits)).toThrow();
    }
    const text = JSON.stringify(capture().metadata).replace('"schemaVersion":1', '"__proto__":{"polluted":true},"schemaVersion":1');
    expect(Object.prototype.hasOwnProperty.call(validateCapture(text, limits), '__proto__')).toBe(true);
    expect(Object.prototype.hasOwnProperty.call({}, 'polluted')).toBe(false);
  });
  it('blocks empty/oversized PNG descriptors and rejects invalid manifest identities and controls', () => {
    for (const size of [0, limits.imageBytes + 1]) {
      const selection = manifest([capture()]); selection.files[1].byteSize = size;
      expect(discoverManifest(selection, limits).candidates[0].issues[0].code).toBe('IMAGE_TOO_LARGE');
    }
    const selection = manifest([capture()]); selection.files[1].clientFileId = selection.files[0].clientFileId;
    expect(() => discoverManifest(selection, limits)).toThrow();
    expect(() => discoverManifest({ ...manifest([capture()]), sourceLabel: 'bad\0label' }, limits)).toThrow();
  });
});

describe('bounded static PNG validation', () => {
  it('validates the independently authored fixture and known CRC vector', () => {
    expect(pngCrc(Buffer.from('123456789'))).toBe(0xcbf43926);
    expect(validatePng(png, limits)).toMatchObject({ width: 2, height: 1, byteSize: png.length });
    expect(validatePng(customPng({ color: 2, raw: Buffer.from([0, 255, 0, 0, 0, 0, 255]) }), limits).width).toBe(2);
  });
  it.each([Buffer.from('not a PNG'), png.subarray(0, 30), Buffer.concat([png, Buffer.from('tail')]), Buffer.from(png).fill(0, 24, 25), customPng({ raw: Buffer.from([5, 0, 0, 0, 0, 0, 0, 0, 0]) }), customPng({ raw: Buffer.from([0]) }), customPng({ trailingCompressed: Buffer.from('tail') })])('rejects damaged, malformed or trailing data', (bytes) => {
    expect(() => validatePng(bytes, limits)).toThrow();
  });
  it('rejects unsupported depth/color/interlace/animation and unknown critical chunks', () => {
    for (const options of [{ depth: 16 }, { color: 3 }, { interlace: 1 }]) expect(() => validatePng(customPng(options), limits)).toThrow(/supported/);
    for (const type of ['acTL', 'WHAT']) {
      const bytes = Buffer.concat([png.subarray(0, 33), chunk(type, Buffer.alloc(0)), png.subarray(33)]);
      expect(() => validatePng(bytes, limits)).toThrow();
    }
  });
  it('enforces actual byte, pixel and inflated length bounds', () => {
    expect(() => validatePng(png, { ...limits, imageBytes: 10 })).toThrow(/byte limit/);
    expect(() => validatePng(png, { ...limits, imagePixels: 1 })).toThrow(/limits/);
    expect(() => validatePng(png, { ...limits, decompressedBytes: 8 })).toThrow(/limits/);
    expect(() => validatePng(customPng({ raw: Buffer.alloc(1000000) }), { ...limits, decompressedBytes: 100 })).toThrow();
  });
  it('enforces header/end ordering and contiguous complete IDAT data', () => {
    const signature = png.subarray(0, 8); const header = png.subarray(8, 33); const image = png.subarray(33, -12); const end = chunk('IEND', Buffer.alloc(0));
    for (const bytes of [
      Buffer.concat([signature, image, header, end]), Buffer.concat([signature, header, header, image, end]),
      Buffer.concat([signature, header, end]), Buffer.concat([signature, header, image]),
      Buffer.concat([signature, header, image, chunk('tEXt', Buffer.from('key\0value')), image, end]),
    ]) expect(() => validatePng(bytes, limits)).toThrow();
  });
});
