import fs from 'node:fs';
import path from 'node:path';
import { deflateSync } from 'node:zlib';
import { pngCrc } from '../../server/src/library/imports/png';
import type { CaptureMetadataV1 } from '../../shared/src/capture';
export const png = fs.readFileSync(path.resolve('tests/fixtures/captures/sample.png'));
export function capture(id = 'sample', bytes = png, directory = id) {
  const metadata = JSON.parse(fs.readFileSync(path.resolve('tests/fixtures/captures/sample.json'), 'utf8')) as CaptureMetadataV1;
  metadata.captureId = id; metadata.image.filename = `${id}.png`;
  return { metadata, bytes, directory };
}
export function manifest(captures: ReturnType<typeof capture>[]) {
  return { sourceLabel: 'Selected captures', files: captures.flatMap((item, i) => [
    { clientFileId: `${i}-json`, relativePath: `${item.directory}/${item.metadata.captureId}.json`, byteSize: 600, metadataText: JSON.stringify(item.metadata, null, 2) },
    { clientFileId: `${i}-png`, relativePath: `${item.directory}/${item.metadata.captureId}.png`, byteSize: item.bytes.length },
  ]) };
}
export function chunk(name: string, data: Buffer): Buffer {
  const prefix = Buffer.alloc(8); prefix.writeUInt32BE(data.length); prefix.write(name, 4, 'latin1');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(pngCrc(Buffer.concat([Buffer.from(name, 'latin1'), data])));
  return Buffer.concat([prefix, data, crc]);
}
export function customPng(options: { width?: number; height?: number; color?: number; depth?: number; interlace?: number; raw?: Buffer; trailingCompressed?: Buffer } = {}) {
  const header = Buffer.alloc(13); header.writeUInt32BE(options.width ?? 2); header.writeUInt32BE(options.height ?? 1, 4);
  header[8] = options.depth ?? 8; header[9] = options.color ?? 6; header[12] = options.interlace ?? 0;
  return Buffer.concat([png.subarray(0, 8), chunk('IHDR', header), chunk('IDAT', Buffer.concat([deflateSync(options.raw ?? Buffer.from([0, 255, 0, 0, 255, 0, 0, 255, 255])), options.trailingCompressed ?? Buffer.alloc(0)])), chunk('IEND', Buffer.alloc(0))]);
}
