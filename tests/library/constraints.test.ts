import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { initializeStorage, type StorageSession } from '../../server/src/storage';
import { createLibraryRepository } from '../../server/src/library/repository';
import { createTestResources } from '../helpers/resources';
import { screenshotInput } from './fixtures';

describe('SQLite library constraints', () => {
  let resources: ReturnType<typeof createTestResources>;
  let session: StorageSession;
  let repo: ReturnType<typeof createLibraryRepository>;
  beforeEach(() => {
    resources = createTestResources(); session = resources.storage(initializeStorage({ dataDir: resources.root }));
    repo = createLibraryRepository(session.db);
  });
  afterEach(async () => { await resources.cleanup(); });

  it.each([
    ['difficulty', 'squash'], ['review_status', 'ready'], ['image_width', 0], ['image_height', -1],
    ['image_byte_size', 0], ['image_width', 1.5], ['playback_seconds', -1], ['playback_seconds', Infinity],
    ['schema_version', 2], ['capture_method', 'tab-capture'], ['source_platform', 'other'],
    ['image_sha256', 'A'.repeat(64)], ['image_sha256', 'short'], ['original_metadata_json', '{bad'],
    ['original_metadata_json', '[]'], ['revision', 0], ['revision', 1.5], ['revision', Number.MAX_SAFE_INTEGER + 1],
    ['image_path', '/absolute.png'], ['match_id', 'missing'],
  ])('rejects invalid screenshot %s = %s', (column, value) => {
    const record = repo.insertCommittedScreenshot(screenshotInput('one'));
    expect(() => session.db.prepare(`UPDATE screenshots SET ${column}=? WHERE id=?`).run(value, record.id)).toThrow();
    expect(repo.getScreenshot(record.id)).toEqual(record);
  });

  it('enforces classification/nullability, nonunique hashes and restricted match deletion', () => {
    const match = repo.createMatch(); const record = repo.insertCommittedScreenshot(screenshotInput('one'));
    expect(() => session.db.prepare("UPDATE matches SET obscurity='legendary' WHERE id=?").run(match.id)).toThrow();
    for (const obscurity of ['low', 'medium', 'high', null]) session.db.prepare('UPDATE matches SET obscurity=? WHERE id=?').run(obscurity, match.id);
    expect(() => session.db.prepare("UPDATE screenshots SET review_status='approved' WHERE id=?").run(record.id)).toThrow();
    repo.updateScreenshot(record.id, 1, { matchId: match.id }, 1);
    expect(() => session.db.prepare("UPDATE screenshots SET review_status='approved' WHERE id=?").run(record.id)).toThrow();
    for (const difficulty of ['easy', 'medium', 'hard', null]) session.db.prepare('UPDATE screenshots SET difficulty=? WHERE id=?').run(difficulty, record.id);
    for (const status of ['pending', 'rejected']) session.db.prepare('UPDATE screenshots SET review_status=? WHERE id=?').run(status, record.id);
    session.db.prepare("UPDATE screenshots SET difficulty='easy', review_status='approved' WHERE id=?").run(record.id);
    expect(() => session.db.prepare('DELETE FROM matches WHERE id=?').run(match.id)).toThrow(/FOREIGN KEY/);
    const other = repo.insertCommittedScreenshot(screenshotInput('two'));
    expect(other.image.sha256).toBe(record.image.sha256);
    expect(() => session.db.prepare('UPDATE screenshots SET image_path=? WHERE id=?').run(record.imagePath, other.id)).toThrow();
  });

  it('enforces import storage ownership, states, JSON and foreign keys without processing imports', () => {
    const batch = randomUUID(); const item = randomUUID(); const now = new Date().toISOString();
    session.db.prepare('INSERT INTO import_batches (id,source_label,created_at,updated_at) VALUES (?,?,?,?)').run(batch, 'test selection', now, now);
    const insert = session.db.prepare('INSERT INTO import_items (id,batch_id,ordinal,candidate_label,created_at,updated_at) VALUES (?,?,?,?,?,?)');
    insert.run(item, batch, 0, 'capture.json', now, now);
    expect(() => insert.run(randomUUID(), 'missing', 1, 'candidate', now, now)).toThrow(/FOREIGN KEY/);
    expect(() => insert.run(randomUUID(), batch, 0, 'duplicate ordinal', now, now)).toThrow(/UNIQUE/);
    expect(() => session.db.prepare('DELETE FROM import_batches WHERE id=?').run(batch)).toThrow(/FOREIGN KEY/);
    for (const [column, value] of [['state', 'invented'], ['resume_state', 'invented'], ['confirmed_decision', 'approve'], ['result_kind', 'done'], ['validation_issues_json', '{}'], ['original_metadata_json', '{bad'], ['image_width', 0], ['retryable', 2], ['result_screenshot_id', 'missing']]) {
      expect(() => session.db.prepare(`UPDATE import_items SET ${column}=? WHERE id=?`).run(value, item)).toThrow();
    }
    for (const [column, value] of [['status', 'invented'], ['revision', 0], ['confirmation_receipts_json', '[]'], ['ignored_files_json', '{}'], ['retryable', 2]]) {
      expect(() => session.db.prepare(`UPDATE import_batches SET ${column}=? WHERE id=?`).run(value, batch)).toThrow();
    }
    const shot = repo.insertCommittedScreenshot(screenshotInput('result'));
    session.db.prepare('UPDATE import_items SET result_screenshot_id=? WHERE id=?').run(shot.id, item);
    expect(() => session.db.prepare('DELETE FROM screenshots WHERE id=?').run(shot.id)).toThrow(/FOREIGN KEY/);
  });
});
