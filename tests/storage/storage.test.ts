import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  initializeStorage,
  resolveDataDirectory,
} from '../../server/src/storage';
import { createTestResources } from '../helpers/resources';
import { getConfiguredHost, getConfiguredPort } from '../../server/src/index';

describe('storage configuration and initialization', () => {
  let resources: ReturnType<typeof createTestResources>;
  beforeEach(() => { resources = createTestResources(); });
  afterEach(async () => {
    try { await resources.cleanup(); }
    finally { vi.unstubAllEnvs(); }
  });
  function createTempDirectory() {
    return fs.mkdtempSync(path.join(resources.root, 'storage-'));
  }
  function openStorage(dataDir: string) {
    return resources.storage(initializeStorage({ dataDir }));
  }

  it('resolves the configured data directory from the environment override', () => {
    const expected = createTempDirectory();
    vi.stubEnv('NAME_THAT_MATCH_DATA_DIR', expected);

    expect(resolveDataDirectory()).toBe(expected);
  });

  it('preserves host/port defaults and explicit port zero', () => {
    vi.stubEnv('NAME_THAT_MATCH_HOST', undefined);
    vi.stubEnv('NAME_THAT_MATCH_PORT', undefined);
    vi.stubEnv('PORT', undefined);
    expect(getConfiguredHost()).toBe('127.0.0.1');
    expect(getConfiguredPort()).toBe(3001);
    expect(getConfiguredPort(0)).toBe(0);
  });

  it('resolves the configured host and port for local network binding', () => {
    vi.stubEnv('NAME_THAT_MATCH_HOST', '0.0.0.0');
    vi.stubEnv('NAME_THAT_MATCH_PORT', '4200');

    expect(getConfiguredHost()).toBe('0.0.0.0');
    expect(getConfiguredPort()).toBe(4200);
  });

  it('initializes a SQLite database and screenshot directory without creating feature tables', () => {
    const root = createTempDirectory();
    const session = openStorage(root);

    expect(fs.existsSync(path.join(root, 'library.sqlite'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'screenshots'))).toBe(true);

    const tables = session.db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all() as Array<{ name: string }>;

    expect(tables.some((entry) => entry.name === 'matches' || entry.name === 'screenshots')).toBe(false);
  });

  it('is idempotent and closes both sessions before cleanup', async () => {
    const root = createTempDirectory();
    const first = openStorage(root);
    const second = openStorage(root);
    expect(first.db.open).toBe(true);
    expect(second.db.open).toBe(true);
    await resources.cleanup();
    expect(first.db.open).toBe(false);
    expect(second.db.open).toBe(false);
    expect(fs.existsSync(resources.root)).toBe(false);
  });

  it('fails clearly when the storage path is invalid or is not a directory', () => {
    const root = createTempDirectory();
    const invalidPath = path.join(root, 'invalid-storage-path');
    fs.writeFileSync(invalidPath, 'not a directory');

    expect(() => initializeStorage({ dataDir: invalidPath })).toThrow(/not a directory|invalid/i);
  });
});
