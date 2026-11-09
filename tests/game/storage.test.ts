import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeStorage } from '../../server/src/storage';
import { applyLibraryMigrations, LIBRARY_SCHEMA_VERSION } from '../../server/src/library/migrations';
import { GameRepository } from '../../server/src/game/repository';
import { createLibraryRepository } from '../../server/src/library/repository';
import { createTestResources } from '../helpers/resources';
import { screenshotInput } from '../library/fixtures';
import { envelope, NOW, serviceFixture, setup } from './fixtures';

const gameTables = ['game_command_receipts', 'game_contestants', 'game_rounds', 'game_score_events', 'game_sessions'];
const fixtures: ReturnType<typeof serviceFixture>[] = [];
function fixture() { const f = serviceFixture(); fixtures.push(f); return f; }
afterEach(async () => { vi.restoreAllMocks(); for (const f of fixtures.splice(0)) await f.cleanup(); });

describe('global schema 3 game migration', () => {
  let resources: ReturnType<typeof createTestResources>;
  let rawConnections: Database.Database[];
  beforeEach(() => { resources = createTestResources(); rawConnections = []; });
  afterEach(async () => {
    try { for (const db of rawConnections) if (db.open) db.close(); } finally { await resources.cleanup(); }
  });
  function open() { return resources.storage(initializeStorage({ dataDir: resources.root })); }
  function legacy(version: 1 | 2) {
    const db = new Database(path.join(resources.root, 'library.sqlite')); rawConnections.push(db);
    let schema = fs.readFileSync(path.resolve('tests/fixtures/library-schema-1.sql'), 'utf8');
    if (version === 2) for (const [old, next] of [['iconic', 'low'], ['familiar', 'medium'], ['obscure', 'high'], ['squash', 'easy'], ['competitive', 'medium'], ['deathmatch', 'hard']]) schema = schema.split(`'${old}'`).join(`'${next}'`);
    db.exec(schema); db.pragma(`user_version=${version}`); db.pragma('foreign_keys=ON'); return db;
  }
  it('creates exactly five STRICT game tables, stable indexes, pragmas and an empty session on fresh/repeated startup', () => {
    const first = open(); const tables = first.db.prepare("SELECT name,strict FROM pragma_table_list WHERE name LIKE 'game_%' ORDER BY name").all();
    expect(tables).toEqual(gameTables.map((name) => ({ name, strict: 1 })));
    expect(first.db.pragma('user_version', { simple: true })).toBe(3);
    expect(first.db.pragma('foreign_keys', { simple: true })).toBe(1); expect(first.db.pragma('journal_mode', { simple: true })).toBe('wal');
    expect(first.db.pragma('synchronous', { simple: true })).toBe(1); expect(new GameRepository(first.db).current()).toBeNull();
    const schema = first.db.prepare("SELECT name,sql FROM sqlite_master WHERE name LIKE 'game_%' ORDER BY name").all(); first.db.close();
    expect(open().db.prepare("SELECT name,sql FROM sqlite_master WHERE name LIKE 'game_%' ORDER BY name").all()).toEqual(schema);
  });
  it('upgrades populated schema 2 without reclassifying, changing revisions, imports, receipts or files', () => {
    const db = legacy(2); const repo = createLibraryRepository(db);
    const match = repo.createMatch({ participantDescription: 'Kept match', promotion: 'Kept promotion', event: 'Kept event', obscurity: 'high' });
    const shot = repo.insertCommittedScreenshot(screenshotInput('keep'));
    repo.updateScreenshot(shot.id, shot.revision, { matchId: match.id, difficulty: 'hard' }, match.revision);
    db.exec("INSERT INTO import_batches(id,source_label,status,created_at,updated_at,confirmation_receipts_json) VALUES('batch','kept','completed','old','old','{\"kept\":true}')");
    const library = ['matches', 'screenshots', 'import_batches', 'import_items'].map((table) => db.prepare(`SELECT * FROM ${table}`).all());
    fs.mkdirSync(path.join(resources.root, 'screenshots')); fs.writeFileSync(path.join(resources.root, 'screenshots', 'kept.txt'), 'unchanged');
    applyLibraryMigrations(db);
    expect(['matches', 'screenshots', 'import_batches', 'import_items'].map((table) => db.prepare(`SELECT * FROM ${table}`).all())).toEqual(library);
    const inode = fs.statSync(path.join(resources.root, 'library.sqlite')).ino; db.close(); const upgraded = open();
    // Existing import startup recovery can reconcile batch timestamps; the migration itself preserved every column above.
    expect(['matches', 'screenshots'].map((table) => upgraded.db.prepare(`SELECT * FROM ${table}`).all())).toEqual(library.slice(0, 2));
    expect(upgraded.db.prepare('SELECT confirmation_receipts_json FROM import_batches').get()).toEqual({ confirmation_receipts_json: '{"kept":true}' });
    expect(fs.statSync(upgraded.dbPath).ino).toBe(inode); expect(fs.readFileSync(path.join(resources.root, 'screenshots', 'kept.txt'), 'utf8')).toBe('unchanged');
    expect(upgraded.db.pragma('foreign_key_check')).toEqual([]);
  });
  it('retains the existing supported schema-1 mapping on the way to 3', () => {
    const db = legacy(1); db.exec("INSERT INTO matches(id,obscurity,created_at,updated_at) VALUES('legacy','iconic','old','old')"); db.close();
    const storage = open(); expect(storage.db.pragma('user_version', { simple: true })).toBe(3);
    expect(storage.db.prepare("SELECT obscurity,revision FROM matches WHERE id='legacy'").get()).toEqual({ obscurity: 'low', revision: 2 });
  });
  it('rejects unsupported newer versions without mutation', () => {
    const db = legacy(2); db.pragma(`user_version=${LIBRARY_SCHEMA_VERSION + 1}`); db.close();
    expect(open).toThrow(/Unsupported database schema/);
    const inspect = new Database(path.join(resources.root, 'library.sqlite'));
    try { expect(inspect.pragma('user_version', { simple: true })).toBe(LIBRARY_SCHEMA_VERSION + 1); expect(inspect.prepare("SELECT name FROM sqlite_master WHERE name LIKE 'game_%'").all()).toEqual([]); } finally { inspect.close(); }
  });
  it('rolls back a failure after game DDL without touching populated schema-2 data, and retries safely', () => {
    const db = legacy(2); db.exec("INSERT INTO matches(id,obscurity,created_at,updated_at) VALUES('kept','high','old','old')");
    const exec = db.exec.bind(db); vi.spyOn(db, 'exec').mockImplementationOnce((sql) => { exec(sql); throw new Error('injected game DDL failure'); });
    expect(() => applyLibraryMigrations(db)).toThrow(/injected/); expect(db.pragma('user_version', { simple: true })).toBe(2);
    expect(db.prepare("SELECT obscurity,revision FROM matches WHERE id='kept'").get()).toEqual({ obscurity: 'high', revision: 1 });
    expect(db.prepare("SELECT name FROM sqlite_master WHERE name LIKE 'game_%'").all()).toEqual([]); expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
    vi.restoreAllMocks(); applyLibraryMigrations(db); expect(db.pragma('user_version', { simple: true })).toBe(3); db.close();
  });
});

describe('SQLite game constraints and optimistic persistence', () => {
  it.each([
    ['requested_tier', 'easy'], ['phase', 'invented'], ['timer_generation', -1], ['timer_generation', 0.5],
    ['ordinal', 0], ['ordinal', Number.MAX_SAFE_INTEGER + 1], ['contestant_id', randomUUID()], ['session_id', randomUUID()],
    ['context_json', '[]'], ['context_json', '{broken'], ['award', 1], ['remaining_ms', 12_000], ['exposed_at', NOW], ['late_entry', 2],
  ])('rejects invalid round %s=%s', (column, value) => {
    const f = fixture(); const state = f.state;
    const fields: Record<string, unknown> = { id: randomUUID(), session_id: state.id, contestant_id: state.activeContestantId, ordinal: 1, requested_tier: 'squash', phase: 'preparing', timer_generation: 0, created_at: NOW, [column]: value };
    expect(() => f.storage.db.prepare(`INSERT INTO game_rounds(${Object.keys(fields).join(',')}) VALUES(${Object.keys(fields).map((k) => `@${k}`).join(',')})`).run(fields)).toThrow();
    expect(f.storage.db.prepare('SELECT count(*) AS n FROM game_rounds').get()).toEqual({ n: 0 });
  });
  it('enforces contestant bounds, uniqueness and cross-session ownership', () => {
    const f = fixture(); const state = f.state; const insert = f.storage.db.prepare('INSERT INTO game_contestants(id,session_id,name,name_key,ordinal) VALUES(?,?,?,?,?)');
    expect(() => insert.run(randomUUID(), state.id, 'third', 'third', 2)).toThrow();
    expect(() => insert.run(randomUUID(), state.id, 'duplicate', 'duplicate', 0)).toThrow();
    expect(() => f.storage.db.prepare('UPDATE game_contestants SET name_key=? WHERE id=?').run(state.contestants[0].name.toLowerCase(), state.contestants[1].id)).toThrow();
    f.command({ type: 'DISCARD_SETUP' }); const next = f.service.create(setup()).state;
    expect(() => f.storage.db.prepare('UPDATE game_sessions SET active_contestant_id=? WHERE id=?').run(state.activeContestantId, next.id)).toThrow(/FOREIGN KEY/);
    expect(() => f.storage.db.prepare("INSERT INTO game_rounds(id,session_id,contestant_id,ordinal,requested_tier,phase,timer_generation,created_at) VALUES(?,?,?,1,'squash','preparing',0,?)").run(randomUUID(), next.id, state.activeContestantId, NOW)).toThrow(/FOREIGN KEY/);
  });
  it('enforces immutable owners/context/awards/receipts and score ownership at the database boundary', () => {
    const f = fixture(); f.ready(); f.command({ type: 'REVEAL_AND_START' }); f.command({ type: 'CORRECT' }); const state = f.state; const round = state.rounds[0];
    expect(() => f.storage.db.prepare('UPDATE game_rounds SET contestant_id=? WHERE id=?').run(state.contestants[1].id, round.id)).toThrow(/immutable/);
    expect(() => f.storage.db.prepare("UPDATE game_rounds SET context_json='{}' WHERE id=?").run(round.id)).toThrow();
    expect(() => f.storage.db.prepare('UPDATE game_rounds SET award=3 WHERE id=?').run(round.id)).toThrow();
    expect(() => f.storage.db.prepare('DELETE FROM game_rounds WHERE id=?').run(round.id)).toThrow();
    expect(() => f.storage.db.exec('UPDATE game_score_events SET amount=2')).toThrow(); expect(() => f.storage.db.exec('DELETE FROM game_score_events')).toThrow();
    expect(() => f.storage.db.exec('DELETE FROM game_command_receipts')).toThrow(); expect(() => f.storage.db.exec('UPDATE game_command_receipts SET accepted_version=999')).toThrow();
    expect(() => f.storage.db.prepare('INSERT INTO game_score_events(id,session_id,round_id,contestant_id,amount,created_at) VALUES(?,?,?,?,1,?)').run(randomUUID(), state.id, round.id, state.contestants[1].id, NOW)).toThrow();
    expect(() => f.storage.db.prepare('DELETE FROM matches WHERE id=?').run('context' in round ? round.context?.matchId : '')).toThrow();
  });
  it.each(['match_id', 'screenshot_id', 'image_sha256'])('independently prevents repeated exposed %s rows', (column) => {
    const f = fixture(); f.ready(); f.command({ type: 'REVEAL_AND_START' }); f.command({ type: 'VOID_EXPOSED', reason: 'skip' });
    const row = f.storage.db.prepare('SELECT * FROM game_rounds').get() as Record<string, unknown>;
    // Duplicate only the tested identity; adjust frozen JSON to agree with its scalar references.
    const other = f.candidate('b'.repeat(64)); const ctx = { ...other, ...(column === 'match_id' ? { matchId: row.match_id } : column === 'screenshot_id' ? { screenshotId: row.screenshot_id } : { image: { ...other.image, sha256: row.image_sha256 } }) };
    const copy = { ...row, id: randomUUID(), ordinal: 2, turn_ordinal: 2, screenshot_id: ctx.screenshotId, match_id: ctx.matchId, image_sha256: ctx.image.sha256, context_json: JSON.stringify(ctx) };
    const columns = Object.keys(copy); expect(() => f.storage.db.prepare(`INSERT INTO game_rounds(${columns.join(',')}) VALUES(${columns.map((k) => `@${k}`).join(',')})`).run(copy)).toThrow(/UNIQUE/);
  });
  it('rejects stale repository writes from another connection without changing accepted state', () => {
    const f = fixture(); const stale = f.state; const other = new Database(f.storage.dbPath); other.pragma('foreign_keys=ON');
    try {
      const reader = new GameRepository(other); expect(reader.load(stale.id)).toEqual(stale);
      f.command({ type: 'START' }); expect(() => reader.commit(stale, { ...stale, stateVersion: stale.stateVersion + 1 })).toThrow(/Stale/);
      expect(reader.load(stale.id).status).toBe('active');
    } finally { other.close(); }
  });
  it('rejects a reused command ID with changed content and keeps all receipts across reopen', () => {
    const f = fixture(); const command = envelope(f.state, { type: 'START' }); f.service.execute(command); f.reopen(true);
    expect(f.service.execute(command).replayed).toBe(true);
    expect(() => f.service.execute({ ...command, type: 'DISCARD_SETUP' })).toThrow(/different content/);
  });
});
