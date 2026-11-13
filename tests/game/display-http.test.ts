import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGameHttp } from '../../server/src/game/http';
import { initializeStorage, type StorageSession } from '../../server/src/storage';
import { createTestResources, listen } from '../helpers/resources';
import { eligibleCapture } from './host-fixtures';
import { setup } from './fixtures';
import { customPng } from '../imports/fixtures';
import type { GameTier } from '../../shared/src/classification';
import type { ControllerCredential, HostStatus } from '../../shared/src/game/host';
import type { DisplayCredential, DisplayObservation } from '../../shared/src/game/display';

describe('contestant HTTP readiness, timing and recovery', () => {
  let resources: ReturnType<typeof createTestResources>; let storage: StorageSession; let game: ReturnType<typeof createGameHttp>;
  let base: string; let now: number; let owner: ControllerCredential; let state: HostStatus; let viewer: DisplayCredential;
  let observation: DisplayObservation; let connectionId: string;
  beforeEach(async () => {
    resources = createTestResources(); storage = resources.storage(initializeStorage({ dataDir: resources.root })); now = 0;
    game = createGameHttp(storage, new Set(['http://localhost:3001']), { now: () => now });
    const server = resources.server(http.createServer((req, res) => { void game.handle(req, res, new URL(req.url!, 'http://localhost:3001')); })); server.on('close', () => game.stop()); base = await listen(server);
    owner = (await request('/control-lease', {})).data;
    eligibleCapture(storage); state = (await request('/sessions', setup())).data.status;
    viewer = (await request(`/sessions/${state.snapshot!.session.id}/displays`, { primary: true })).data;
    connectionId = randomUUID();
  });
  afterEach(async () => { await resources.cleanup(); });
  async function request(route: string, payload?: unknown, credential: { token: string; serverEpoch: string } | undefined = owner) {
    const response = await fetch(base + '/api/game' + route, { method: payload === undefined ? 'GET' : 'POST', headers: {
      ...(credential ? { Authorization: `Bearer ${credential.token}`, 'X-Name-That-Match-Epoch': credential.serverEpoch } : {}),
      ...(payload === undefined ? {} : { Origin: 'http://localhost:3001', 'X-Name-That-Match': 'game', 'Content-Type': 'application/json' }),
    }, body: payload === undefined ? undefined : JSON.stringify(payload) });
    return { status: response.status, ...(await response.json()) };
  }
  const sessionPath = () => `/sessions/${state.snapshot!.session.id}`;
  async function current() { state = (await request('/current')).data; return state; }
  async function command(type: string, payload = {}, input?: unknown) {
    const envelope = input ?? { protocolVersion: 1, commandId: randomUUID(), sessionId: state.snapshot!.session.id,
      expectedStateVersion: state.snapshot!.session.stateVersion, type, payload,
      ...(!['START', 'PREPARE'].includes(type) && state.snapshot!.session.currentRoundId ? { roundId: state.snapshot!.session.currentRoundId } : {}) };
    const result = await request(sessionPath() + '/commands', envelope);
    if (result.data?.status) state = result.data.status;
    return { ...result, envelope };
  }
  async function prepare() {
    await command('START'); await command('PREPARE', { roundId: randomUUID(), tier: 'squash' });
    for (let i = 0; i < 30 && state.snapshot!.currentRound?.phase !== 'ready'; i++) { await new Promise((r) => setTimeout(r, 5)); await current(); }
    expect(state.snapshot!.currentRound?.phase).toBe('ready');
  }
  async function connect(target = viewer, id = connectionId) {
    const result = await request(sessionPath() + `/displays/${target.displayId}/status`, { type: 'connect', connectionId: id }, target);
    if (target === viewer) observation = result.data;
    return result;
  }
  async function report(decoded = true, overrides = {}) {
    const result = await request(sessionPath() + `/displays/${viewer.displayId}/status`, { type: 'status', connectionId,
      connectionSequence: observation.connectionSequence, roundId: state.snapshot!.session.currentRoundId, imageKey: state.snapshot!.session.currentRoundId,
      decoded, clock: { nonce: observation.sample.nonce, rttMs: 20 }, ...overrides }, viewer);
    if (result.data) observation = result.data;
    return result;
  }
  async function reveal() { await prepare(); await connect(); await report(); await current(); expect((await command('REVEAL_AND_START')).status).toBe(200); }
  it.each(['CORRECT', 'INCORRECT'] as const)('holds the same image and stopped timer for %s across viewer/server refresh and reveal', async type => {
    await reveal(); now = 1500; const judged = await command(type); expect(judged.status).toBe(200);
    await report(); expect(observation.snapshot).toMatchObject({ phase: 'adjudicated', remainingMs: 28500 }); expect(observation.asset?.imageKey).toBe(state.snapshot!.session.currentRoundId);
    expect(JSON.stringify(observation)).not.toMatch(/Private Wrestler|Alpha|"outcome"|"award"|"answer"/);
    const image = async () => fetch(base + '/api/game' + sessionPath() + `/rounds/${state.snapshot!.session.currentRoundId}/image`, { headers: { Authorization: `Bearer ${viewer.token}`, 'X-Name-That-Match-Epoch': viewer.serverEpoch } });
    const before = await image(); expect(before.status).toBe(200); const bytes = Buffer.from(await before.arrayBuffer());
    connectionId = randomUUID(); await connect(); await report(); expect(observation.snapshot).toMatchObject({ remainingMs: 28500 });
    game.stop(); game = createGameHttp(storage, new Set(['http://localhost:3001']), { now: () => now });
    owner = (await request('/control-lease', {})).data; await current(); viewer = (await request(sessionPath() + '/displays', {})).data; connectionId = randomUUID(); await connect(); await report();
    expect(observation.snapshot).toMatchObject({ phase: 'adjudicated', remainingMs: 28500 }); expect(observation.asset).not.toBeNull();
    const restored = await image(); expect(restored.status).toBe(200); expect(Buffer.from(await restored.arrayBuffer())).toEqual(bytes);
    await command('REVEAL_ANSWER'); await report(); expect(observation.snapshot).toMatchObject({ phase: 'answer_revealed', outcome: type === 'CORRECT' ? 'correct' : 'incorrect' }); expect(observation.asset).not.toBeNull();
    expect(storage.db.prepare('SELECT count(*) n FROM game_score_events').get()).toEqual({ n: type === 'CORRECT' ? 1 : 0 });
    const staleImagePath = sessionPath() + `/rounds/${state.snapshot!.session.currentRoundId}/image`; await command('ADVANCE'); await report(); expect(observation.asset).toBeNull();
    const stale = await fetch(base + '/api/game' + staleImagePath, { headers: { Authorization: `Bearer ${viewer.token}`, 'X-Name-That-Match-Epoch': viewer.serverEpoch } }); expect(stale.status).toBe(404);
  });
  it('restores an unavailable judged image as a fallback without losing saved time or revealing the answer', async () => {
    await reveal(); now = 1000; await command('INCORRECT'); const id = state.snapshot!.session.currentRoundId;
    const file = storage.db.prepare('SELECT image_path FROM screenshots LIMIT 1').get() as { image_path: string }; fs.unlinkSync(path.join(storage.rootDir, file.image_path));
    game.stop(); game = createGameHttp(storage, new Set(['http://localhost:3001']), { now: () => now }); owner = (await request('/control-lease', {})).data; await current();
    viewer = (await request(sessionPath() + '/displays', {})).data; connectionId = randomUUID(); await connect(); await report();
    expect(observation.snapshot).toMatchObject({ phase: 'adjudicated', remainingMs: 29000 }); expect(observation.asset).toBeNull();
    await command('REVEAL_ANSWER'); await report(); expect(observation.snapshot).toMatchObject({ phase: 'answer_revealed', outcome: 'incorrect' });
    expect(state.snapshot!.session.currentRoundId).toBe(id); expect(storage.db.prepare('SELECT count(*) n FROM game_score_events').get()).toEqual({ n: 0 });
  });
  it.each([false, true])('ends resolved rounds with reveal=%s and preserves final scores across new setup and restart', async (revealed) => {
    await reveal(); const oldSessionId = state.snapshot!.session.id; const oldViewer = viewer;
    const libraryBefore = storage.db.prepare('SELECT id,revision,review_status,image_path FROM screenshots').all();
    await command('CORRECT'); if (revealed) await command('REVEAL_ANSWER');
    expect(state.allowedActions).toContain('END_GAME'); const saved = await command('END_GAME'); expect(saved.status).toBe(200);
    expect((await command('END_GAME', {}, saved.envelope)).data.replayed).toBe(true);
    const finished = state.snapshot!; expect(finished.session.status).toBe('completed'); expect(state.allowedActions).toEqual([]);
    await report(); expect(observation.snapshot).toMatchObject({ phase: 'completed', scores: [{ total: 1 }, { total: 0 }], winnerIds: [finished.session.contestants[0].id] });
    expect((await command('CORRECT')).status).toBe(409); expect((await command('ADVANCE')).status).toBe(409);
    expect((await request('/current')).data.snapshot).toBeNull();
    const input = setup(1); const created = await request('/sessions', input); expect(created.status).toBe(201); state = created.data.status;
    expect(state.snapshot!.session.id).not.toBe(oldSessionId); expect(state.snapshot!.currentRound).toBeNull(); expect(state.snapshot!.scores[0].total).toBe(0); expect(state.availability.distinctMatches).toBe(1);
    expect((await request(`/sessions/${oldSessionId}`, undefined, oldViewer)).data.snapshot).toMatchObject({ phase: 'completed', scores: [{ total: 1 }, { total: 0 }] });
    expect((await request('/sessions', input)).data.replayed).toBe(true); expect(storage.db.prepare('SELECT COUNT(*) n FROM game_sessions').get()).toEqual({ n: 2 });
    // Replaying a prior End receipt cannot complete or clear the new session.
    expect((await request(`/sessions/${oldSessionId}/commands`, saved.envelope)).data.replayed).toBe(true);
    await current(); expect(state.snapshot!.session.id).toBe(input.sessionId); expect(state.snapshot!.session.status).toBe('setup');
    expect((await command('START')).status).toBe(200); expect((await command('PREPARE', { roundId: randomUUID(), tier: 'squash' })).status).toBe(202);
    for (let n = 0; n < 30 && state.snapshot!.currentRound?.phase !== 'ready'; n++) { await new Promise((r) => setTimeout(r, 5)); await current(); }
    expect(state.snapshot!.currentRound?.phase).toBe('ready'); expect(state.snapshot!.currentRound).toMatchObject({ context: { screenshotId: libraryBefore[0] && (libraryBefore[0] as { id: string }).id } });
    await command('CANCEL_UNEXPOSED'); game.stop(); game = createGameHttp(storage, new Set(['http://localhost:3001']), { now: () => now });
    owner = (await request('/control-lease', {})).data; await current(); expect(state.snapshot!.session.id).toBe(input.sessionId); expect(state.snapshot!.scores[0].total).toBe(0);
    expect((await request(`/sessions/${oldSessionId}`)).data.snapshot).toEqual(finished); expect((await request(`/sessions/${oldSessionId}/commands/${saved.envelope.commandId}`)).data.receipt).toEqual(saved.data.receipt);
    expect(storage.db.prepare('SELECT id,revision,review_status,image_path FROM screenshots').all()).toEqual(libraryBefore);
    expect(storage.db.prepare('SELECT COUNT(*) n FROM game_score_events').get()).toEqual({ n: 1 });
  });
  it('publishes all zero-score tied winners and refuses ending unresolved work or viewer lifecycle mutations', async () => {
    const original = state.snapshot!; expect((await command('END_GAME')).status).toBe(409);
    await prepare(); expect(state.allowedActions).not.toContain('END_GAME'); expect((await command('END_GAME')).status).toBe(409);
    await connect(); await report(); await current(); await command('REVEAL_AND_START');
    expect((await command('END_GAME')).status).toBe(409);
    await command('PAUSE'); expect((await command('END_GAME')).status).toBe(409);
    await report(); await current(); await command('RESUME'); now = 30000; await report();
    owner = (await request('/control-lease', {})).data; await current(); expect((await command('END_GAME')).status).toBe(409);
    await command('CONFIRM_TIMEOUT');
    expect((await request(sessionPath() + '/commands', { type: 'END_GAME' }, viewer)).status).toBe(403);
    expect((await request('/sessions', setup(), viewer)).status).not.toBe(201);
    const ended = await command('END_GAME'); expect(ended.status).toBe(200); await report();
    expect(observation.snapshot).toMatchObject({ phase: 'completed', winnerIds: original.session.contestants.map((p) => p.id), scores: [{ total: 0 }, { total: 0 }] });
    expect(state.allowedActions).toEqual([]);
  });
  it('runs explicit consecutive turns, tier changes and switching with durable match exclusion and replay-safe Advance', async () => {
    const [a, b] = state.snapshot!.session.contestants.map((p) => p.id);
    await reveal(); const first = state.snapshot!.currentRound!;
    if (!('context' in first) || !first.context) throw new Error('Missing candidate');
    eligibleCapture(storage, { matchId: first.context.matchId, difficulty: 'hard', bytes: customPng() });
    eligibleCapture(storage, { bytes: customPng({ raw: Buffer.from([0, 12, 0, 0, 255, 0, 0, 255, 255]) }) });
    eligibleCapture(storage, { obscurity: 'medium', bytes: customPng({ raw: Buffer.from([0, 24, 0, 0, 255, 0, 0, 255, 255]) }) });
    eligibleCapture(storage, { obscurity: 'high', difficulty: 'hard', bytes: customPng({ raw: Buffer.from([0, 36, 0, 0, 255, 0, 0, 255, 255]) }) });
    let previousAdvance: unknown; const matched = new Set<string>();
    for (const [index, tier] of (['squash', 'squash', 'competitive', 'deathmatch'] as GameTier[]).entries()) {
      if (index > 0) {
        if (index === 2) expect((await command('SELECT_CONTESTANT', { contestantId: b })).status).toBe(200);
        expect((await command('PREPARE', { roundId: randomUUID(), tier })).status).toBe(202);
        for (let n = 0; n < 30 && state.snapshot!.currentRound?.phase !== 'ready'; n++) { await new Promise((r) => setTimeout(r, 5)); await current(); }
        expect(state.snapshot!.currentRound?.phase).toBe('ready');
        const roundId = state.snapshot!.session.currentRoundId;
        expect((await command('ADVANCE', {}, previousAdvance)).data.replayed).toBe(true);
        expect(state.snapshot!.session.currentRoundId).toBe(roundId); expect(state.candidateValid).toBe(true);
        await report(); await current(); expect((await command('REVEAL_AND_START')).status).toBe(200);
      }
      const round = state.snapshot!.currentRound!;
      if (!('context' in round) || !round.context) throw new Error('Missing candidate');
      expect(matched.has(round.context.matchId)).toBe(false); matched.add(round.context.matchId);
      expect(round).toMatchObject({ contestantId: index < 2 ? a : b, turnOrdinal: index + 1 });
      expect((await command('SELECT_CONTESTANT', { contestantId: index < 2 ? b : a })).status).toBe(409);
      expect((await command('ADVANCE')).status).toBe(409);
      await command('CORRECT'); expect(state.allowedActions).not.toContain('ADVANCE');
      expect((await command('ADVANCE')).status).toBe(409);
      await command('REVEAL_ANSWER'); expect(state.allowedActions).toContain('ADVANCE');
      const imagePath = sessionPath() + `/rounds/${round.id}/image`;
      expect((await request(sessionPath() + '/commands', { type: 'ADVANCE' }, viewer)).status).toBe(403);
      const saved = await command('ADVANCE'); previousAdvance = saved.envelope; expect(saved.status).toBe(200);
      expect(state.snapshot!.session.activeContestantId).toBe(index < 2 ? a : b);
      expect(state.snapshot!.currentRound).toBeNull(); expect(state.allowedActions).toContain('SELECT_CONTESTANT');
      await report(); expect(observation.snapshot).toMatchObject({ phase: 'between_rounds', turnsExposed: index + 1 });
      expect(observation.snapshot).not.toHaveProperty('answer'); expect(observation.snapshot).not.toHaveProperty('imageKey');
      expect((await request(imagePath, undefined, viewer)).status).toBe(404);
      expect((await command('ADVANCE')).status).toBe(409);
      if (index === 0) expect(state.availability.tiers).toMatchObject({ squash: { screenshots: 1 }, competitive: { screenshots: 1 }, deathmatch: { screenshots: 1 } });
    }
    expect(state.availability.distinctMatches).toBe(0); expect(state.snapshot!.scores.map((s) => [s.contestantId, s.total])).toEqual([[b, 5], [a, 2]]);
    expect((await command('PREPARE', { roundId: randomUUID(), tier: 'deathmatch' })).status).toBe(422);
    game.stop(); game = createGameHttp(storage, new Set(['http://localhost:3001']), { now: () => now });
    owner = (await request('/control-lease', {})).data; await current();
    expect(state.snapshot!.session.activeContestantId).toBe(b); expect(state.snapshot!.session.nextTurnOrdinal).toBe(5); expect(state.availability.distinctMatches).toBe(0);
    expect((await command('ADVANCE', {}, previousAdvance)).data.replayed).toBe(true);
    expect(storage.db.prepare('SELECT contestant_id FROM game_rounds ORDER BY ordinal').all()).toEqual([a, a, b, b].map((contestant_id) => ({ contestant_id })));
    expect(storage.db.prepare('SELECT COUNT(*) n FROM game_score_events').get()).toEqual({ n: 4 });
  });
  it('offers explicit Advance after void without requiring answer reveal, retaining zero and used history', async () => {
    await reveal(); await command('VOID_EXPOSED', { reason: 'skip' }); expect(state.allowedActions).toContain('ADVANCE');
    const ownerId = state.snapshot!.session.activeContestantId; await command('ADVANCE'); await report();
    expect(observation.snapshot).toMatchObject({ phase: 'between_rounds', turnsExposed: 1, activeContestantId: ownerId });
    expect(observation.snapshot.scores.every((s) => s.total === 0 && !s.lastOutcome)).toBe(true); expect(state.availability.distinctMatches).toBe(0);
    expect(storage.db.prepare('SELECT phase,outcome FROM game_rounds').get()).toEqual({ phase: 'adjudicated', outcome: 'void' });
  });
  it('keeps Ready covered in the public projection and requires actual decoded primary readiness', async () => {
    await prepare(); await connect();
    expect(observation.snapshot.phase).toBe('ready'); expect(observation.asset?.imageKey).toBe(state.snapshot!.session.currentRoundId);
    const serialized = JSON.stringify(observation);
    for (const value of ['Alpha', 'Beta', 'Local Wrestling', 'Fixture Show', 'screenshotId', 'matchId', 'sha256', 'provenance', owner.token]) expect(serialized).not.toContain(value);
    expect((await command('REVEAL_AND_START')).status).toBe(422);
    await report(false); await current(); expect(state.primaryDisplay.ready).toBe(false);
    await report(); await current(); expect(state.primaryDisplay.ready).toBe(true);
    const result = await command('REVEAL_AND_START'); expect(result.status).toBe(200); expect(state.timing?.remainingMs).toBe(30000);
    await report(); expect(observation.snapshot.phase).toBe('guessing');
    expect(storage.db.prepare('SELECT COUNT(*) n FROM game_rounds WHERE exposed_at IS NOT NULL').get()).toEqual({ n: 1 });
  });
  it('serves only authenticated current pinned bytes with no filename/cache metadata', async () => {
    await prepare(); const url = base + '/api/game' + sessionPath() + `/rounds/${state.snapshot!.session.currentRoundId}/image`;
    expect((await fetch(url)).status).toBe(401);
    const response = await fetch(url, { headers: { Authorization: `Bearer ${viewer.token}`, 'X-Name-That-Match-Epoch': viewer.serverEpoch } });
    expect(response.status).toBe(200); expect(response.headers.get('content-type')).toBe('image/png'); expect(response.headers.get('cache-control')).toBe('no-store'); expect(response.headers.has('content-disposition')).toBe(false);
    expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(0);
    await command('CANCEL_UNEXPOSED'); expect((await fetch(url, { headers: { Authorization: `Bearer ${viewer.token}`, 'X-Name-That-Match-Epoch': viewer.serverEpoch } })).status).toBe(404);
  });
  it('preserves paused time, covers it, requires explicit resume and rejects stale commands', async () => {
    await reveal(); now = 1500; await command('PAUSE'); expect(state.timing?.remainingMs).toBe(28500);
    await report(); expect(observation.snapshot).toMatchObject({ phase: 'paused', remainingMs: 28500 });
    const previous = state.snapshot!.session.stateVersion;
    await current(); expect(state.snapshot!.currentRound?.phase).toBe('paused');
    expect((await command('RESUME')).status).toBe(200); expect(state.timing?.remainingMs).toBe(28500);
    const stale = { protocolVersion: 1, commandId: randomUUID(), sessionId: state.snapshot!.session.id, roundId: state.snapshot!.session.currentRoundId, expectedStateVersion: previous, type: 'CORRECT', payload: {} };
    expect((await command('CORRECT', {}, stale)).status).toBe(409);
    now = 2000; await current(); expect(state.timing?.remainingMs).toBe(28000);
  });
  it.each(['CORRECT', 'INCORRECT', 'VOID_EXPOSED'])('commits %s exactly once without answer reveal or advancement', async (type) => {
    await reveal(); const result = await command(type, type === 'VOID_EXPOSED' ? { reason: 'skip' } : {});
    expect(result.status).toBe(200); expect((await command(type, {}, result.envelope)).data.replayed).toBe(true);
    await report(); expect(observation.snapshot.phase).toBe('adjudicated'); expect(JSON.stringify(observation)).not.toContain('Alpha');
    expect(observation.snapshot).not.toHaveProperty('outcome'); expect(observation.snapshot).not.toHaveProperty('award'); expect(observation.snapshot.scores.every((s) => s.total === 0)).toBe(true);
    expect(storage.db.prepare('SELECT COUNT(*) n FROM game_score_events').get()).toEqual({ n: type === 'CORRECT' ? 1 : 0 });
  });
  it.each(['CORRECT', 'INCORRECT', 'VOID_EXPOSED'])('reveals %s only by host command, preserving frozen metadata and once-only scores', async (type) => {
    await reveal(); await command(type, type === 'VOID_EXPOSED' ? { reason: 'void' } : {}); await report();
    expect(observation.snapshot.phase).toBe('adjudicated'); expect(state.allowedActions).toContain('REVEAL_ANSWER');
    expect((await request(sessionPath() + '/commands', { type: 'REVEAL_ANSWER' }, viewer)).status).toBe(403);
    const frozen = state.snapshot!.currentRound!;
    if (!('context' in frozen) || !frozen.context) throw new Error('Missing frozen answer');
    storage.db.prepare("UPDATE matches SET participant_description='Edited later',event='Changed event',obscurity='high',revision=revision+1 WHERE id=?").run(frozen.context.matchId);
    const result = await command('REVEAL_ANSWER'); expect(result.status).toBe(200);
    const retry = await command('REVEAL_ANSWER', {}, result.envelope); expect(retry.status).toBe(200); expect(retry.data.replayed).toBe(true);
    expect((await command('REVEAL_ANSWER')).status).toBe(409);
    await report(); expect(observation.snapshot).toMatchObject({ phase: 'answer_revealed', outcome: type === 'CORRECT' ? 'correct' : type === 'INCORRECT' ? 'incorrect' : 'void', award: type === 'CORRECT' ? 1 : 0,
      answer: { participantDescription: 'Alpha vs Beta', event: 'Fixture Show', promotion: 'Local Wrestling' } });
    expect(JSON.stringify(observation.snapshot)).not.toContain('Edited later');
    expect(storage.db.prepare('SELECT COUNT(*) n FROM game_score_events').get()).toEqual({ n: type === 'CORRECT' ? 1 : 0 });
    connectionId = randomUUID(); await connect(); expect(observation.snapshot.phase).toBe('answer_revealed');
    game.stop(); game = createGameHttp(storage, new Set(['http://localhost:3001']), { now: () => now });
    owner = (await request('/control-lease', {})).data; await current();
    expect(state.snapshot!.currentRound?.phase).toBe('answer_revealed');
    expect((await command('REVEAL_ANSWER', {}, result.envelope)).data.replayed).toBe(true);
    viewer = (await request(sessionPath() + '/displays', {})).data; connectionId = randomUUID(); await connect();
    expect(observation.snapshot).toMatchObject({ phase: 'answer_revealed', answer: frozen.context.answer });
    expect(storage.db.prepare('SELECT COUNT(*) n FROM game_score_events').get()).toEqual({ n: type === 'CORRECT' ? 1 : 0 });
  });
  it('rejects early and stale result reveals without changing the saved judgment', async () => {
    await prepare(); expect((await command('REVEAL_ANSWER')).status).toBe(409);
    await connect(); await report(); await current(); await command('REVEAL_AND_START');
    const previous = state.snapshot!.session.stateVersion;
    await command('CORRECT');
    const stale = { protocolVersion: 1, commandId: randomUUID(), sessionId: state.snapshot!.session.id, roundId: state.snapshot!.session.currentRoundId, expectedStateVersion: previous, type: 'REVEAL_ANSWER', payload: {} };
    expect((await command('REVEAL_ANSWER', {}, stale)).status).toBe(409); await report(); expect(observation.snapshot.phase).toBe('adjudicated');
    expect(storage.db.prepare('SELECT COUNT(*) n FROM game_score_events').get()).toEqual({ n: 1 });
  });
  it('settles expiry before late ordinary Correct and permits distinct pre-buzzer attestation once', async () => {
    await reveal(); now = 30000; await report(); expect(observation.snapshot.phase).toBe('awaiting_judgment');
    owner = (await request('/control-lease', {})).data; await current();
    expect((await command('CORRECT')).status).toBe(409);
    const result = await command('CORRECT_BEFORE_BUZZER'); expect(result.status).toBe(200);
    expect(state.snapshot!.currentRound).toMatchObject({ phase: 'adjudicated', lateEntry: true, award: 1 });
    expect((await command('CORRECT_BEFORE_BUZZER', {}, result.envelope)).data.replayed).toBe(true);
  });
  it('pauses on primary loss, but secondary loss does not affect time', async () => {
    const extra = (await request(sessionPath() + '/displays', {})).data as DisplayCredential;
    await connect(extra, randomUUID()); await reveal(); now = 2000; await report(); await request('/control-lease/renew', {});
    now = 3001; await report(); await current(); expect(state.snapshot!.currentRound?.phase).toBe('guessing');
    now = 4000; await request('/control-lease/renew', {}); now = 5100; await request('/control-lease/renew', {}); now = 6102; await current();
    expect(state.snapshot!.currentRound).toMatchObject({ phase: 'paused', pauseReason: 'primary-display' });
    await connect(); await report(); await current(); expect(state.snapshot!.currentRound?.phase).toBe('paused');
  });
  it('pauses on host loss while a primary remains current', async () => {
    await reveal(); now = 2000; await report(); now = 3100; await report();
    await current(); expect(state.snapshot!.currentRound).toMatchObject({ phase: 'paused', pauseReason: 'host-connection' });
  });
  it('reload replaces the primary connection and covers instead of starting a new window', async () => {
    await reveal(); now = 500; connectionId = randomUUID(); await connect();
    expect(observation.snapshot).toMatchObject({ phase: 'paused', remainingMs: 29500 });
    await report(); await current(); expect(state.snapshot!.currentRound?.phase).toBe('paused');
  });
  it('refuses viewer mutations, wrong capabilities, stale epochs and primary changes during attempts', async () => {
    await prepare(); await connect();
    expect((await request(sessionPath() + '/commands', { type: 'CORRECT' }, viewer)).status).toBe(403);
    expect((await request(sessionPath() + `/displays/${randomUUID()}/status`, { type: 'connect', connectionId }, viewer)).status).toBe(403);
    expect((await request(sessionPath() + `/displays/${viewer.displayId}/status`, { type: 'connect', connectionId }, { ...viewer, serverEpoch: randomUUID() })).status).toBe(409);
    expect((await request(sessionPath() + '/displays', { displayId: viewer.displayId })).status).toBe(409);
    expect((await request(`/sessions/${randomUUID()}`, undefined, viewer)).status).toBe(401);
  });
  it('blocks a changed Ready record, and interrupts a missing paused clue instead of resetting it', async () => {
    await reveal(); await command('PAUSE'); await report();
    const round = state.snapshot!.currentRound!; if (!('context' in round) || !round.context) throw new Error('No context');
    fs.unlinkSync(path.join(storage.rootDir, `screenshots/${round.context.screenshotId}.png`));
    expect((await command('RESUME')).status).toBe(422); await current(); expect(state.snapshot!.currentRound?.phase).toBe('interrupted');
    expect((await command('VOID_INTERRUPTED')).status).toBe(200);
  });
  it('rejects a changed Ready classification without exposing or replacing its candidate', async () => {
    await prepare(); await connect(); await report();
    const round = state.snapshot!.currentRound!; if (!('context' in round) || !round.context) throw new Error('No context');
    storage.db.prepare("UPDATE screenshots SET review_status='pending',difficulty='hard',revision=revision+1 WHERE id=?").run(round.context.screenshotId);
    await current(); expect(state.candidateValid).toBe(false); expect((await command('REVEAL_AND_START')).status).toBe(409);
    expect(state.snapshot!.currentRound?.id).toBe(round.id);
    expect(storage.db.prepare('SELECT COUNT(*) n FROM game_rounds WHERE exposed_at IS NOT NULL').get()).toEqual({ n: 0 });
  });
  it('reopens paused state with the same remainder and fresh credentials; a missing clue becomes interrupted', async () => {
    await reveal(); now = 1200; await command('PAUSE'); const round = state.snapshot!.currentRound!;
    game.stop(); game = createGameHttp(storage, new Set(['http://localhost:3001']), { now: () => now });
    expect((await request('/current')).status).toBe(401); owner = (await request('/control-lease', {})).data; await current();
    expect(state.snapshot!.currentRound).toMatchObject({ phase: 'paused', remainingMs: 28800 }); expect(state.primaryDisplay.ready).toBe(false);
    if (!('context' in round) || !round.context) throw new Error('No context');
    game.stop(); fs.unlinkSync(path.join(storage.rootDir, `screenshots/${round.context.screenshotId}.png`));
    game = createGameHttp(storage, new Set(['http://localhost:3001']), { now: () => now });
    owner = (await request('/control-lease', {})).data; await current(); expect(state.snapshot!.currentRound?.phase).toBe('interrupted');
  });
});
