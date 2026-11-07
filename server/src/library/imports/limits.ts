import { ImportError } from './contracts.js';

export const DEFAULT_IMPORT_LIMITS = {
  imageBytes: 32 * 1024 * 1024, imagePixels: 16777216, decompressedBytes: 80 * 1024 * 1024,
  metadataBytes: 64 * 1024, jsonBytes: 16 * 1024 * 1024, items: 256,
  batchBytes: 1024 * 1024 * 1024, uploads: 2, retentionDays: 7,
} as const;
export type ImportLimits = { -readonly [K in keyof typeof DEFAULT_IMPORT_LIMITS]: number };
const envKeys: Record<keyof ImportLimits, string> = {
  imageBytes: 'MAX_IMAGE_BYTES', imagePixels: 'MAX_IMAGE_PIXELS', decompressedBytes: 'MAX_DECOMPRESSED_BYTES',
  metadataBytes: 'MAX_METADATA_BYTES', jsonBytes: 'MAX_JSON_BYTES', items: 'MAX_IMPORT_ITEMS', batchBytes: 'MAX_BATCH_BYTES',
  uploads: 'MAX_UPLOADS', retentionDays: 'STAGING_RETENTION_DAYS',
};
export function importLimits(env: NodeJS.ProcessEnv = process.env): ImportLimits {
  const limits: ImportLimits = { ...DEFAULT_IMPORT_LIMITS };
  for (const key of Object.keys(limits) as Array<keyof ImportLimits>) {
    const text = env[`NAME_THAT_MATCH_${envKeys[key]}`];
    if (text !== undefined) {
      if (!/^[1-9]\d*$/.test(text) || !Number.isSafeInteger(Number(text))) throw new ImportError('INVALID_CONFIG', `Invalid import limit: NAME_THAT_MATCH_${envKeys[key]}`);
      limits[key] = Number(text);
    }
  }
  return limits;
}
