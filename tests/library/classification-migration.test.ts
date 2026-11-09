import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestResources } from '../helpers/resources';
import { initializeStorage } from '../../server/src/storage';
import { applyLibraryMigrations } from '../../server/src/library/migrations';
import { createLibraryRepository } from '../../server/src/library/repository';
import { screenshotInput } from './fixtures';
const legacySchema = fs.readFileSync(path.resolve('tests/fixtures/library-schema-1.sql'), 'utf8');
describe('schema 2 preserves legacy data', () => {
  let resources: ReturnType<typeof createTestResources>; let db: Database.Database;
  beforeEach(() => { resources = createTestResources(); db = new Database(path.join(resources.root, 'library.sqlite')); db.pragma('foreign_keys=ON'); db.exec(legacySchema); db.pragma('user_version=1'); });
  afterEach(async () => { vi.restoreAllMocks(); if (db.open) db.close(); await resources.cleanup(); });
  function populate() {
    const repo = createLibraryRepository(db); const match = repo.createMatch({ participantDescription: 'A vs B', promotion: 'P', event: 'E' });
    const image = repo.insertCommittedScreenshot(screenshotInput('legacy'));
    db.prepare("UPDATE matches SET obscurity='iconic' WHERE id=?").run(match.id);
    db.prepare("UPDATE screenshots SET match_id=?, difficulty='deathmatch', review_status='approved' WHERE id=?").run(match.id, image.id);
    db.exec("INSERT INTO import_batches(id,source_label,created_at,updated_at,confirmation_receipts_json) VALUES('batch','old','before','before','{\"receipt\":true}')");
    db.prepare("INSERT INTO import_items(id,batch_id,ordinal,candidate_label,result_screenshot_id,created_at,updated_at) VALUES('item','batch',0,'old',?,'before','before')").run(image.id);
    fs.writeFileSync(path.join(resources.root, 'screenshots-original.txt'), 'untouched');
    return { repo, match, image };
  }
  it('maps all enum values once, preserves reviews, provenance and incoming foreign keys across reopen', () => {
    const { repo, match, image } = populate(); const draft = repo.createMatch();
    for (const [index, old] of ['familiar', 'obscure'].entries()) db.prepare('INSERT INTO matches(id,obscurity,created_at,updated_at) VALUES(?,?,?,?)').run(`extra${index}`, old, 'before', 'before');
    const otherShots = ['squash', 'competitive', null].map((difficulty, index) => {
      const record = repo.insertCommittedScreenshot(screenshotInput(`legacy-extra-${index}`));
      db.prepare('UPDATE screenshots SET difficulty=? WHERE id=?').run(difficulty, record.id); return record;
    });
    db.exec('CREATE INDEX legacy_custom_obscurity ON matches(obscurity)');
    applyLibraryMigrations(db);
    expect(otherShots.map((record) => repo.getScreenshot(record.id).difficulty)).toEqual(['easy', 'medium', null]);
    expect(otherShots.map((record) => repo.getScreenshot(record.id).revision)).toEqual([2, 2, 1]);
    expect(db.prepare("SELECT name FROM sqlite_master WHERE name='legacy_custom_obscurity'").get()).toBeTruthy();
    expect(repo.getMatch(match.id)).toMatchObject({ obscurity: 'low', revision: 2, createdAt: match.createdAt });
    expect(repo.getMatch(draft.id)).toEqual(draft);
    expect(repo.getScreenshot(image.id)).toMatchObject({ difficulty: 'hard', matchId: match.id, revision: 2, reviewStatus: 'approved', originalMetadataJson: image.originalMetadataJson, imagePath: image.imagePath });
    expect(db.prepare('SELECT obscurity FROM matches WHERE id LIKE ? ORDER BY id').all('extra%')).toEqual([{ obscurity: 'medium' }, { obscurity: 'high' }]);
    expect(db.prepare('SELECT result_screenshot_id FROM import_items').get()).toEqual({ result_screenshot_id: image.id });
    expect(db.pragma('foreign_key_check')).toEqual([]); expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
    expect(() => db.prepare('DELETE FROM matches WHERE id=?').run(match.id)).toThrow();
    const snapshot = repo.getScreenshot(image.id); applyLibraryMigrations(db); expect(repo.getScreenshot(image.id)).toEqual(snapshot);
    db.close(); const storage = resources.storage(initializeStorage({ dataDir: resources.root }));
    expect(createLibraryRepository(storage.db).getScreenshot(image.id)).toEqual(snapshot);
    expect(storage.db.prepare('SELECT confirmation_receipts_json FROM import_batches').get()).toEqual({ confirmation_receipts_json: '{"receipt":true}' });
    expect(fs.readFileSync(path.join(resources.root, 'screenshots-original.txt'), 'utf8')).toBe('untouched');
  });
  it('rejects revision overflow with full rollback and restores foreign key enforcement', () => {
    const { match } = populate(); db.prepare('UPDATE matches SET revision=? WHERE id=?').run(Number.MAX_SAFE_INTEGER, match.id);
    expect(() => applyLibraryMigrations(db)).toThrow();
    expect(db.pragma('user_version', { simple: true })).toBe(1); expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
    expect(db.prepare('SELECT obscurity FROM matches WHERE id=?').get(match.id)).toEqual({ obscurity: 'iconic' });
  });
  it('rolls back after a table rebuild failure without losing old rows or receipts', () => {
    const { match } = populate(); const exec = db.exec.bind(db);
    vi.spyOn(db, 'exec').mockImplementation((sql) => { const result = exec(sql); if (sql.includes('ALTER TABLE screenshots_next')) throw new Error('injected rebuild failure'); return result; });
    expect(() => applyLibraryMigrations(db)).toThrow('injected rebuild failure');
    expect(db.pragma('user_version', { simple: true })).toBe(1); expect(db.pragma('foreign_key_check')).toEqual([]);
    expect(db.prepare('SELECT obscurity FROM matches WHERE id=?').get(match.id)).toEqual({ obscurity: 'iconic' });
    expect(db.prepare('SELECT COUNT(*) AS count FROM import_items').get()).toEqual({ count: 1 });
    expect(db.prepare("SELECT name FROM sqlite_master WHERE name LIKE '%_next'").all()).toEqual([]);
  });
});
