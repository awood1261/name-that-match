import { inflateSync } from 'node:zlib';
import { ImportError } from './contracts.js';
import type { ImportLimits } from './limits.js';
import { digest } from './capture-validation.js';

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
export function pngCrc(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function pngError(message: string): never { throw new ImportError('INVALID_PNG', message); }
export function validatePng(bytes: Buffer, limits: ImportLimits) {
  if (bytes.length > limits.imageBytes) throw new ImportError('IMAGE_TOO_LARGE', 'PNG exceeds the image byte limit.');
  if (!bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) pngError('Missing PNG signature.');
  let offset = 8; let width = 0; let height = 0; let channels = 0; let ended = false; let dataEnded = false;
  let sawHeader = false; let sawData = false; let sawPalette = false;
  const data: Buffer[] = [];
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) pngError('Truncated PNG chunk.');
    const size = bytes.readUInt32BE(offset); const end = offset + size + 12;
    if (end > bytes.length) pngError('Truncated PNG payload.');
    const name = bytes.toString('latin1', offset + 4, offset + 8);
    if (!/^[A-Za-z]{4}$/.test(name) || name[2] !== name[2].toUpperCase()) pngError('Invalid PNG chunk type.');
    if (pngCrc(bytes.subarray(offset + 4, end - 4)) !== bytes.readUInt32BE(end - 4)) pngError('PNG CRC mismatch.');
    const payload = bytes.subarray(offset + 8, end - 4);
    if (!sawHeader && name !== 'IHDR') pngError('IHDR must be first.');
    if (name === 'IHDR') {
      if (sawHeader || size !== 13) pngError('Invalid IHDR.');
      width = payload.readUInt32BE(0); height = payload.readUInt32BE(4);
      if (!width || !height || width > 0x7fffffff || height > 0x7fffffff) pngError('Invalid dimensions.');
      if (payload[8] !== 8 || ![2, 6].includes(payload[9]) || payload[10] || payload[11] || payload[12]) {
        throw new ImportError('UNSUPPORTED_PNG', 'Only static noninterlaced 8-bit RGB/RGBA PNGs are supported.');
      }
      channels = payload[9] === 2 ? 3 : 4;
      if (width * height > limits.imagePixels || (width * channels + 1) * height > limits.decompressedBytes) {
        throw new ImportError('PIXEL_LIMIT', 'PNG pixels or decompressed data exceed limits.');
      }
      sawHeader = true;
    } else if (name === 'IDAT') {
      if (dataEnded) pngError('IDAT chunks must be contiguous.');
      sawData = true; data.push(payload);
    } else {
      if (sawData) dataEnded = true;
      if (name === 'IEND') {
        if (size || !sawData) pngError('Invalid IEND.');
        ended = true; offset = end; break;
      }
      if (name === 'PLTE') {
        if (sawPalette || sawData || !size || size % 3 || size > 768) pngError('Invalid PLTE.');
        sawPalette = true;
      } else if (['acTL', 'fcTL', 'fdAT'].includes(name)) throw new ImportError('UNSUPPORTED_PNG', 'Animated PNGs are not supported.');
      else if (name[0] === name[0].toUpperCase()) pngError('Unknown critical PNG chunk.');
    }
    offset = end;
  }
  if (!ended || offset !== bytes.length) pngError('Missing IEND or trailing PNG data.');
  const compressed = Buffer.concat(data);
  let inflated: Buffer;
  try {
    // Node's info=true returns this shape; the installed Node 20 typings only declare Buffer.
    const result = inflateSync(compressed, { maxOutputLength: limits.decompressedBytes, info: true }) as unknown as { buffer: Buffer; engine: { bytesWritten: number } };
    if (result.engine.bytesWritten !== compressed.length) pngError('Trailing compressed PNG data.');
    inflated = result.buffer;
  } catch (error) {
    if (error instanceof ImportError) throw error;
    pngError('Invalid or excessive compressed PNG data.');
  }
  const stride = width * channels + 1;
  if (inflated.length !== stride * height) pngError('PNG scanline size mismatch.');
  for (let row = 0; row < height; row++) if (inflated[row * stride] > 4) pngError('Invalid PNG scanline filter.');
  return { width, height, byteSize: bytes.length, sha256: digest(bytes) };
}
