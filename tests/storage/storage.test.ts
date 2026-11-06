import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  closeStorage,
  initializeStorage,
  resolveDataDirectory,
} from '../../server/src/storage';

describe('storage configuration and initialization', () => {
  const createdPaths: string[] = [];

  afterEach(() => {
    for (const item of createdPaths) {
      if (fs.existsSync(item)) {
        fs.rmSync(item, { recursive: true, force: true });
      }
    }

    createdPaths.length = 0;
    delete process.env.NAME_THAT_MATCH_DATA_DIR;
  });

  function createTempDirectory() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ntm-storage-'));
    createdPaths.push(dir);
    return dir;
  }

  it('resolves the configured data directory from the environment override', () => {
    const expected = createTempDirectory();
    process.env.NAME_THAT_MATCH_DATA_DIR = expected;

    expect(resolveDataDirectory()).toBe(expected);
  });

  it('initializes a SQLite database and screenshot directory without creating feature tables', () => {
    const root = createTempDirectory();
    const session = initializeStorage({ dataDir: root });

    expect(fs.existsSync(path.join(root, 'library.sqlite'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'screenshots'))).toBe(true);

    const tables = session.db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all() as Array<{ name: string }>;

    expect(tables.some((entry) => entry.name === 'matches' || entry.name === 'screenshots')).toBe(false);

    closeStorage(session);
  });

  it('is idempotent when the same data directory is initialized repeatedly', () => {
    const root = createTempDirectory();
    const first = initializeStorage({ dataDir: root });
    expect(() => initializeStorage({ dataDir: root })).not.toThrow();

    closeStorage(first);
  });

  it('fails clearly when the storage path is invalid or is not a directory', () => {
    const root = createTempDirectory();
    const invalidPath = path.join(root, 'invalid-storage-path');
    fs.writeFileSync(invalidPath, 'not a directory');

    expect(() => initializeStorage({ dataDir: invalidPath })).toThrow(/not a directory|invalid/i);
  });
});
