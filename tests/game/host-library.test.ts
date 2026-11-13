import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameLibrary } from '../../server/src/game/library';
import { initializeStorage, type StorageSession } from '../../server/src/storage';
import { createTestResources } from '../helpers/resources';
import { createState } from '../../shared/src/game/engine';
import { setup, NOW, pureGame } from './fixtures';
import { eligibleCapture } from './host-fixtures';
import { getImportEngine } from '../../server/src/library/imports/engine';
import { customPng } from '../imports/fixtures';
import { DIFFICULTIES, OBSCURITIES } from '../../shared/src/library';
import { classify } from '../../shared/src/classification';

describe('real library game observations', () => {
  let resources: ReturnType<typeof createTestResources>; let storage: StorageSession;
  beforeEach(() => { resources = createTestResources(); storage = resources.storage(initializeStorage({ dataDir: resources.root })); });
  afterEach(async () => { vi.restoreAllMocks(); await resources.cleanup(); });
  it('selects every matrix cell using actual approved library records and valid local PNGs', () => {
    for (const obscurity of OBSCURITIES) for (const difficulty of DIFFICULTIES) eligibleCapture(storage, { obscurity, difficulty });
    const lib = new GameLibrary(storage, () => 0); const state = createState(setup(), NOW);
    expect(lib.availability(state)).toMatchObject({ tiers: { squash: { screenshots: 2, matches: 2 }, competitive: { screenshots: 5, matches: 5 }, deathmatch: { screenshots: 2, matches: 2 } }, distinctMatches: 9 });
    for (const tier of ['squash', 'competitive', 'deathmatch'] as const) { const selected = lib.select(state, tier); expect(classify(selected.obscurity, selected.difficulty).tier).toBe(tier); }
  });
  it('coalesces yielding assessments without holding a SQLite transaction or fabricating cold counts', async () => {
    eligibleCapture(storage); eligibleCapture(storage);
    const lib = new GameLibrary(storage); expect(() => lib.cachedAvailability(null)).toThrow(/progress/);
    const first = lib.refresh(); expect(lib.refresh(true)).toBe(first);
    expect(storage.db.inTransaction).toBe(false); expect(await first).toBe(true);
    expect(lib.cachedAvailability(null).distinctMatches).toBe(2); expect(await lib.refresh()).toBe(false);
    const fresh = lib.refresh(true); expect(lib.refresh()).toBe(fresh);
    expect(lib.cachedAvailability(null).distinctMatches).toBe(2); await fresh;
  });
  it('rejects metadata changes during assessment and retries rather than publishing mixed candidates', async () => {
    const capture = eligibleCapture(storage); const lib = new GameLibrary(storage); await lib.refresh();
    const before = lib.cachedAvailability(null);
    const scan = lib.refresh(true); const changed = capture.repo.updateMatch(capture.match.id, capture.match.revision, { notes: 'Changed during scan' });
    await expect(scan).rejects.toThrow(/changed during/); expect(lib.cachedAvailability(null)).toEqual(before);
    await lib.refresh(); expect(lib.select(createState(setup(), NOW), 'squash', false).matchRevision).toBe(changed.match.revision);
  });
  it('stops pending assessment before accessing a closed database and preserves explicit I/O failures', async () => {
    eligibleCapture(storage); const lib = new GameLibrary(storage); const scan = lib.refresh(); lib.close(); storage.db.close();
    await expect(scan).rejects.toThrow(/stopped/); await expect(lib.refresh()).rejects.toThrow(/stopped/);
  });
  it('reports storage uncertainty without replacing a previous complete assessment with empty counts', async () => {
    eligibleCapture(storage); const lib = new GameLibrary(storage); await lib.refresh();
    const read = vi.spyOn(getImportEngine(storage).files, 'read').mockImplementation(() => { throw Object.assign(new Error('I/O'), { code: 'EIO' }); });
    await expect(lib.refresh(true)).rejects.toThrow(/unavailable/); expect(() => lib.cachedAvailability(null)).toThrow(/unavailable/);
    read.mockRestore(); await lib.refresh(); expect(lib.cachedAvailability(null).distinctMatches).toBe(1);
  });
  it('counts screenshot and distinct match capacity separately and uses injected unbiased candidate indices', () => {
    const first = eligibleCapture(storage); const second = eligibleCapture(storage, { matchId: first.match.id }); const last = eligibleCapture(storage);
    const draw = vi.fn((length: number) => length - 1); const lib = new GameLibrary(storage, draw); const state = createState(setup(), NOW);
    expect(lib.availability(state).tiers.squash).toEqual({ screenshots: 3, matches: 2 });
    const observed = lib.select(state, 'squash'); expect(draw).toHaveBeenCalledWith(3);
    expect(observed.screenshotId).toBe([first.shot.id, second.shot.id, last.shot.id].sort()[2]); expect(observed.answer.event).toBe('Fixture Show');
  });
  it('excludes pending, incomplete, unassigned, missing and corrupt assets and reports empty pools explicitly', () => {
    eligibleCapture(storage, { approved: false }); const incomplete = eligibleCapture(storage); incomplete.repo.updateMatch(incomplete.match.id, incomplete.match.revision, { event: null });
    const unassigned = eligibleCapture(storage); unassigned.repo.updateScreenshot(unassigned.shot.id, unassigned.shot.revision, { matchId: null });
    const missing = eligibleCapture(storage); fs.unlinkSync(path.join(storage.rootDir, missing.shot.imagePath));
    const corrupt = eligibleCapture(storage); fs.writeFileSync(path.join(storage.rootDir, corrupt.shot.imagePath), 'broken');
    const lib = new GameLibrary(storage); expect(lib.availability(null).distinctMatches).toBe(0);
    expect(() => lib.select(createState(setup(), NOW), 'squash')).toThrow(/No eligible/);
  });
  it('distinguishes unavailable storage from an empty pool', () => {
    eligibleCapture(storage); vi.spyOn(getImportEngine(storage).files, 'read').mockImplementation(() => { throw Object.assign(new Error('I/O'), { code: 'EIO' }); });
    expect(() => new GameLibrary(storage).availability(null, true)).toThrow(/unavailable/);
  });
  it('does not burn prepared/cancelled candidates but excludes all exposed match IDs and duplicate content', () => {
    const first = eligibleCapture(storage); eligibleCapture(storage, { matchId: first.match.id }); eligibleCapture(storage);
    const separate = eligibleCapture(storage, { bytes: customPng({ raw: Buffer.from([0, 1, 2, 3, 255, 0, 0, 255, 255]) }) });
    const lib = new GameLibrary(storage, () => 0); const game = pureGame(); const selected = lib.select(game.state, 'squash');
    // Choose the fixture with the shared original hash regardless of UUID ordering.
    const chosen = { ...selected, image: first.shot.image, screenshotId: first.shot.id, matchId: first.match.id, screenshotRevision: first.shot.revision, matchRevision: first.match.revision };
    game.ready(chosen); expect(lib.availability(game.state).tiers.squash.screenshots).toBe(4);
    game.step({ type: 'CANCEL_UNEXPOSED' }); game.ready(chosen); game.step({ type: 'REVEAL_AND_START' });
    expect(lib.select(game.state, 'squash').screenshotId).toBe(separate.shot.id);
    expect(lib.availability(game.state).tiers.squash).toEqual({ screenshots: 1, matches: 1 });
  });
  it('revalidates record revisions, pins bounded bytes, releases them and preserves original files', () => {
    const fixture = eligibleCapture(storage); const lib = new GameLibrary(storage); const context = lib.select(createState(setup(), NOW), 'squash');
    const original = fs.readFileSync(path.join(storage.rootDir, fixture.shot.imagePath)); lib.pin('session', 'round', context);
    expect(lib.pinnedBytes).toBe(original.length); expect(lib.current(context, 'prepare')).toBe(true);
    fixture.repo.updateMatch(fixture.match.id, fixture.match.revision, { notes: 'changed' });
    expect(lib.current(context, 'reveal')).toBe(false); expect(lib.metadataCurrent(context)).toBe(false);
    expect(lib.current(context, 'resume')).toBe(true); lib.release(); expect(lib.pinnedBytes).toBe(0);
    expect(fs.readFileSync(path.join(storage.rootDir, fixture.shot.imagePath))).toEqual(original);
  });
  it('rechecks files on fresh selection despite cached availability and rejects asset changes before pin', () => {
    const fixture = eligibleCapture(storage); const lib = new GameLibrary(storage); const state = createState(setup(), NOW);
    const candidate = lib.select(state, 'squash'); fs.writeFileSync(path.join(storage.rootDir, fixture.shot.imagePath), 'changed');
    expect(() => lib.pin(state.id, 'round', candidate)).toThrow(/changed/); expect(lib.availability(state, true).distinctMatches).toBe(0);
  });
});
