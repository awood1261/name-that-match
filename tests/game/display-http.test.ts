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
  it('keeps Ready covered in the public projection and requires actual decoded primary readiness', async () => {
    await prepare(); await connect();
    expect(observation.snapshot.phase).toBe('ready'); expect(observation.asset?.imageKey).toBe(state.snapshot!.session.currentRoundId);
    const serialized = JSON.stringify(observation);
    for (const value of ['Alpha', 'Beta', 'Local Wrestling', 'Fixture Show', 'screenshotId', 'matchId', 'sha256', 'provenance', owner.token]) expect(serialized).not.toContain(value);
    expect((await command('REVEAL_AND_START')).status).toBe(422);
    await report(false); await current(); expect(state.primaryDisplay.ready).toBe(false);
    await report(); await current(); expect(state.primaryDisplay.ready).toBe(true);
    const result = await command('REVEAL_AND_START'); expect(result.status).toBe(200); expect(state.timing?.remainingMs).toBe(10000);
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
    await reveal(); now = 1500; await command('PAUSE'); expect(state.timing?.remainingMs).toBe(8500);
    await report(); expect(observation.snapshot).toMatchObject({ phase: 'paused', remainingMs: 8500 });
    const previous = state.snapshot!.session.stateVersion;
    await current(); expect(state.snapshot!.currentRound?.phase).toBe('paused');
    expect((await command('RESUME')).status).toBe(200); expect(state.timing?.remainingMs).toBe(8500);
    const stale = { protocolVersion: 1, commandId: randomUUID(), sessionId: state.snapshot!.session.id, roundId: state.snapshot!.session.currentRoundId, expectedStateVersion: previous, type: 'CORRECT', payload: {} };
    expect((await command('CORRECT', {}, stale)).status).toBe(409);
    now = 2000; await current(); expect(state.timing?.remainingMs).toBe(8000);
  });
  it.each(['CORRECT', 'INCORRECT', 'VOID_EXPOSED'])('commits %s exactly once without answer reveal or advancement', async (type) => {
    await reveal(); const result = await command(type, type === 'VOID_EXPOSED' ? { reason: 'skip' } : {});
    expect(result.status).toBe(200); expect((await command(type, {}, result.envelope)).data.replayed).toBe(true);
    await report(); expect(observation.snapshot.phase).toBe('adjudicated'); expect(JSON.stringify(observation)).not.toContain('Alpha');
    expect(storage.db.prepare('SELECT COUNT(*) n FROM game_score_events').get()).toEqual({ n: type === 'CORRECT' ? 1 : 0 });
  });
  it('settles expiry before late ordinary Correct and permits distinct pre-buzzer attestation once', async () => {
    await reveal(); now = 10000; await report(); expect(observation.snapshot.phase).toBe('awaiting_judgment');
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
    expect(observation.snapshot).toMatchObject({ phase: 'paused', remainingMs: 9500 });
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
    expect(state.snapshot!.currentRound).toMatchObject({ phase: 'paused', remainingMs: 8800 }); expect(state.primaryDisplay.ready).toBe(false);
    if (!('context' in round) || !round.context) throw new Error('No context');
    game.stop(); fs.unlinkSync(path.join(storage.rootDir, `screenshots/${round.context.screenshotId}.png`));
    game = createGameHttp(storage, new Set(['http://localhost:3001']), { now: () => now });
    owner = (await request('/control-lease', {})).data; await current(); expect(state.snapshot!.currentRound?.phase).toBe('interrupted');
  });
});
