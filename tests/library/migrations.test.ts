import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeStorage } from '../../server/src/storage';
import { createTestResources } from '../helpers/resources';
import { LIBRARY_SCHEMA_VERSION } from '../../server/src/library/migrations';

describe('library schema migration lifecycle', () => {
  let resources: ReturnType<typeof createTestResources>;
  beforeEach(() => { resources = createTestResources(); });
  afterEach(async () => { vi.restoreAllMocks(); await resources.cleanup(); });
  function open() { return resources.storage(initializeStorage({ dataDir: resources.root })); }
  function raw<T>(run: (db: Database.Database) => T): T {
    const db = new Database(path.join(resources.root, 'library.sqlite'));
    try { return run(db); } finally { db.close(); }
  }
  const tables = ['import_batches', 'import_items', 'matches', 'screenshots'];
  it('initializes the four-table schema and configured pragmas on a fresh database', () => {
    const { db } = open();
    expect(db.pragma('user_version', { simple: true })).toBe(LIBRARY_SCHEMA_VERSION);
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
    expect(db.pragma('journal_mode', { simple: true })).toBe('wal');
    expect(db.pragma('synchronous', { simple: true })).toBe(1);
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'game_%' ORDER BY name").all()).toEqual(tables.map((name) => ({ name })));
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'game_%' ORDER BY name").all())
      .toEqual(['import_items_batch_state', 'screenshots_image_sha256', 'screenshots_match_id'].map((name) => ({ name })));
  });
  it('upgrades an existing empty foundation store without replacing its file or screenshot assets', () => {
    raw((db) => { db.pragma('journal_mode = WAL'); db.pragma('application_id = 1234'); });
    const file = path.join(resources.root, 'library.sqlite'); const inode = fs.statSync(file).ino;
    const assets = path.join(resources.root, 'screenshots'); fs.mkdirSync(assets);
    fs.writeFileSync(path.join(assets, 'keep.txt'), 'existing asset');
    const { db } = open();
    expect(db.pragma('user_version', { simple: true })).toBe(LIBRARY_SCHEMA_VERSION);
    expect(db.pragma('application_id', { simple: true })).toBe(1234);
    expect(fs.statSync(file).ino).toBe(inode);
    expect(fs.readFileSync(path.join(assets, 'keep.txt'), 'utf8')).toBe('existing asset');
  });
  it('is repeatable and retains data across close/reopen', () => {
    const first = open();
    first.db.prepare("INSERT INTO matches (id,participant_description,created_at,updated_at) VALUES ('kept','A vs B','before','before')").run();
    first.db.close();
    const second = open();
    expect(second.db.prepare('SELECT id, participant_description FROM matches').all()).toEqual([{ id: 'kept', participant_description: 'A vs B' }]);
    expect(second.db.pragma('user_version', { simple: true })).toBe(LIBRARY_SCHEMA_VERSION);
  });
  it.each([0, LIBRARY_SCHEMA_VERSION + 1])('rejects unexpected version %i objects without losing existing rows', (version) => {
    raw((db) => { db.exec("CREATE TABLE existing_data (value TEXT); INSERT INTO existing_data VALUES ('preserve')"); db.pragma(`user_version = ${version}`); });
    const close = vi.spyOn(Database.prototype, 'close');
    expect(open).toThrow(version ? /Unsupported database schema/ : /Unexpected objects/);
    expect(close).toHaveBeenCalledTimes(1);
    expect(close.mock.instances[0].open).toBe(false);
    raw((db) => {
      expect(db.pragma('user_version', { simple: true })).toBe(version);
      expect(db.prepare('SELECT value FROM existing_data').all()).toEqual([{ value: 'preserve' }]);
    });
  });
  it('does not mistake similarly named user tables for SQLite internal objects', () => {
    raw((db) => { db.exec("CREATE TABLE sqlitex_data (value TEXT); INSERT INTO sqlitex_data VALUES ('preserve')"); });
    expect(open).toThrow(/Unexpected objects/);
    raw((db) => {
      expect(db.pragma('user_version', { simple: true })).toBe(0);
      expect(db.prepare('SELECT value FROM sqlitex_data').all()).toEqual([{ value: 'preserve' }]);
      expect(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()).toEqual([{ name: 'sqlitex_data' }]);
    });
  });
  it('rolls back migration SQL and version changes on failure, closes storage, and can retry', () => {
    raw((db) => { db.pragma('application_id = 4321'); });
    const exec = Database.prototype.exec;
    vi.spyOn(Database.prototype, 'exec').mockImplementationOnce(function (this: Database.Database, sql: string) {
      exec.call(this, sql);
      this.pragma('user_version = 1');
      throw new Error('injected failure after schema creation');
    });
    const close = vi.spyOn(Database.prototype, 'close');
    expect(open).toThrow(/injected failure/);
    expect(close.mock.instances[0].open).toBe(false);
    raw((db) => {
      expect(db.pragma('user_version', { simple: true })).toBe(0);
      expect(db.pragma('application_id', { simple: true })).toBe(4321);
      expect(db.prepare("SELECT name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'").all()).toEqual([]);
    });
    expect(open().db.pragma('user_version', { simple: true })).toBe(LIBRARY_SCHEMA_VERSION);
  });
});
