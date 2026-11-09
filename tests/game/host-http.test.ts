import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createServer } from '../../server/src/index';
import { initializeStorage, type StorageSession } from '../../server/src/storage';
import { createTestResources, listen } from '../helpers/resources';
import { eligibleCapture } from './host-fixtures';
import { setup } from './fixtures';
import type { ControllerCredential, HostStatus } from '../../shared/src/game/host';

const origin = 'http://localhost:3001';
describe('host game HTTP integration', () => {
  let resources: ReturnType<typeof createTestResources>; let storage: StorageSession; let server: http.Server;
  let base: string; let credential: ControllerCredential;
  beforeEach(async () => {
    resources = createTestResources(); storage = resources.storage(initializeStorage({ dataDir: resources.root }));
    server = resources.server(createServer(0, { dataDir: resources.root, production: true })); base = await listen(server);
    credential = (await request('/control-lease', {})).data;
  });
  afterEach(async () => { await resources.cleanup(); });
  async function request(route: string, payload?: unknown, custom: Record<string, string> = {}, method?: string) {
    const response = await fetch(base + '/api/game' + route, { method: method ?? (payload === undefined ? 'GET' : 'POST'), headers: {
      ...(credential ? { Authorization: `Bearer ${credential.token}`, 'X-Name-That-Match-Epoch': credential.serverEpoch } : {}),
      ...(payload === undefined ? {} : { Origin: origin, 'X-Name-That-Match': 'game', 'Content-Type': 'application/json' }), ...custom,
    }, body: payload === undefined ? undefined : JSON.stringify(payload) });
    return { status: response.status, ...(await response.json()) };
  }
  async function create(count = 2) { return (await request('/sessions', setup(count))).data.status as HostStatus; }
  async function current() { return (await request('/current')).data as HostStatus; }
  function command(status: HostStatus, type: string, payload = {}, commandId = randomUUID()) {
    const session = status.snapshot!.session;
    return { protocolVersion: 1, commandId, sessionId: session.id, expectedStateVersion: session.stateVersion, type, payload,
      ...(!['START', 'DISCARD_SETUP', 'CONFIGURE_SETUP', 'SELECT_CONTESTANT', 'PREPARE'].includes(type) && session.currentRoundId ? { roundId: session.currentRoundId } : {}) };
  }
  async function send(status: HostStatus, type: string, payload = {}) { return request(`/sessions/${status.snapshot!.session.id}/commands`, command(status, type, payload)); }
  async function untilReady(sessionId: string): Promise<HostStatus> {
    for (let i = 0; i < 30; i++) { const result = (await request(`/sessions/${sessionId}`)).data as HostStatus; if (result.snapshot?.currentRound?.phase === 'ready') return result; await new Promise((resolve) => setTimeout(resolve, 10)); }
    throw new Error('Candidate did not become ready');
  }
  it.each([1, 2])('creates and restores %i contestant setup with durable idempotent creation', async (count) => {
    const input = setup(count); const first = await request('/sessions', input); expect(first.status).toBe(201);
    const retry = await request('/sessions', input); expect(retry.status).toBe(200); expect(retry.data.replayed).toBe(true);
    expect(retry.data.receipt).toEqual(first.data.receipt); expect((await current()).snapshot?.session.contestants).toHaveLength(count);
    expect(storage.db.prepare('SELECT count(*) AS n FROM game_sessions').get()).toEqual({ n: 1 });
  });
  it.each([0, 3])('rejects %i contestants without partial persistence', async (count) => {
    expect((await request('/sessions', setup(count))).status).toBe(400);
    expect(storage.db.prepare('SELECT count(*) AS n FROM game_sessions').get()).toEqual({ n: 0 });
  });
  it('rejects invalid names, unknown fields and duplicate nonterminal sessions', async () => {
    const input = setup(); input.contestants[1].name = input.contestants[0].name;
    expect((await request('/sessions', input)).status).toBe(400); expect((await request('/sessions', { ...setup(), points: 99 })).status).toBe(400);
    await create(); expect((await request('/sessions', setup())).status).toBe(409);
  });
  it('starts only with real eligible content and switches contestants explicitly between rounds', async () => {
    let state = await create(); expect((await send(state, 'START')).status).toBe(422);
    eligibleCapture(storage); state = (await send(await current(), 'START')).data.status;
    const b = state.snapshot!.session.contestants[1].id; const selected = await send(state, 'SELECT_CONTESTANT', { contestantId: b });
    expect(selected.status).toBe(200); expect(selected.data.status.snapshot.session.activeContestantId).toBe(b);
    expect((await send(selected.data.status, 'SELECT_CONTESTANT', { contestantId: randomUUID() })).status).toBe(400);
  });
  it('prepares an actual verified image without exposure, countdown or contestant switching', async () => {
    const fixture = eligibleCapture(storage); let state = await create(); state = (await send(state, 'START')).data.status;
    const prepared = await send(state, 'PREPARE', { roundId: randomUUID(), tier: 'squash' }); expect(prepared.status).toBe(202);
    state = await untilReady(state.snapshot!.session.id); expect(state.snapshot!.currentRound).toMatchObject({ phase: 'ready', context: { screenshotId: fixture.shot.id } });
    expect(state.primaryDisplay.ready).toBe(false); expect(state.allowedActions).toEqual(['CANCEL_UNEXPOSED']);
    expect((await send(state, 'REVEAL_AND_START')).status).toBe(422);
    expect((await send(state, 'SELECT_CONTESTANT', { contestantId: state.snapshot!.session.contestants[1].id })).status).toBe(409);
    expect(storage.db.prepare('SELECT exposed_at,turn_ordinal FROM game_rounds').get()).toEqual({ exposed_at: null, turn_ordinal: null });
    expect(storage.db.prepare('SELECT count(*) AS n FROM game_score_events').get()).toEqual({ n: 0 });
  });
  it('cancels and prepares again without burning a match, moving ownership or creating duplicate retries', async () => {
    eligibleCapture(storage); let state = await create(); state = (await send(state, 'START')).data.status;
    const input = command(state, 'PREPARE', { roundId: randomUUID(), tier: 'squash' }); const route = `/sessions/${state.snapshot!.session.id}/commands`;
    await request(route, input); await untilReady(state.snapshot!.session.id);
    const retry = await request(route, input); expect(retry.data.replayed).toBe(true);
    state = retry.data.status; const owner = state.snapshot!.currentRound!.contestantId;
    const cancel = command(state, 'CANCEL_UNEXPOSED'); state = (await request(route, cancel)).data.status; expect(state.snapshot!.session.activeContestantId).toBe(owner);
    expect((await send(state, 'PREPARE', { roundId: randomUUID(), tier: 'squash' })).status).toBe(202);
    state = await untilReady(state.snapshot!.session.id); expect(state.snapshot!.currentRound!.contestantId).toBe(owner);
    const replayedCancel = await request(route, cancel); expect(replayedCancel.data.replayed).toBe(true); expect(replayedCancel.data.status.candidateValid).toBe(true);
    expect(storage.db.prepare('SELECT count(*) AS n FROM game_rounds').get()).toEqual({ n: 2 });
  });
  it('filters requested tiers and returns recoverable empty-pool errors without recording a turn', async () => {
    eligibleCapture(storage, { obscurity: 'high', difficulty: 'hard' }); let state = await create(); state = (await send(state, 'START')).data.status;
    const failed = await send(state, 'PREPARE', { roundId: randomUUID(), tier: 'squash' }); expect(failed).toMatchObject({ status: 422, error: { code: 'EMPTY_POOL' } });
    expect(storage.db.prepare('SELECT count(*) AS n FROM game_rounds').get()).toEqual({ n: 0 });
    expect((await send(await current(), 'PREPARE', { roundId: randomUUID(), tier: 'deathmatch' })).status).toBe(202);
  });
  it('resolves accepted receipts, rejects changed content and returns current revision for stale writes', async () => {
    eligibleCapture(storage); let state = await create(); const input = command(state, 'START'); const path = `/sessions/${state.snapshot!.session.id}/commands`;
    const first = await request(path, input); expect(first.status).toBe(200);
    const receipt = await request(`${path}/${input.commandId}`); expect(receipt.data.receipt).toEqual(first.data.receipt);
    expect((await request(path, { ...input, type: 'DISCARD_SETUP' })).status).toBe(409);
    expect(await request(path, { ...input, commandId: randomUUID() })).toMatchObject({ status: 409, error: { currentRevision: first.data.status.snapshot.session.stateVersion } });
    state = await current(); expect((await request(`${path}/${randomUUID()}`)).status).toBe(404); expect(state.snapshot!.session.status).toBe('active');
  });
  it('protects origin/header, bearer roles, epochs, bounded JSON and methods', async () => {
    expect((await request('/control-lease', {}, { Origin: 'http://foreign.test' })).status).toBe(403);
    expect((await request('/control-lease', {}, { 'X-Name-That-Match': 'library' })).status).toBe(403);
    expect((await request('/current', undefined, { Authorization: '' })).status).toBe(401);
    expect((await request('/current', undefined, { 'X-Name-That-Match-Epoch': randomUUID() })).status).toBe(409);
    expect((await request('/sessions', { padding: 'x'.repeat(17 * 1024) })).status).toBe(413);
    expect((await request('/current', {}, {}, 'POST')).status).toBe(405);
    expect((await request('/current?invented=true')).status).toBe(400);
    expect((await request('/sessions/invalid')).status).toBe(400);
    expect((await request(`/sessions/${randomUUID()}/displays/extra`, {})).status).toBe(404);
  });
  it('keeps other hosts busy, supports release/reclaim and rejects old controller tokens', async () => {
    expect((await request('/control-lease', {}))).toMatchObject({ status: 409, error: { code: 'HOST_BUSY' } });
    expect((await request('/control-lease/renew', {})).status).toBe(200);
    expect((await request('/control-lease/release', {})).status).toBe(200); const old = credential;
    credential = (await request('/control-lease', {})).data; expect(credential.generation).toBeGreaterThan(old.generation);
    expect((await request('/current', undefined, { Authorization: `Bearer ${old.token}` })).status).toBe(401);
  });
  it('returns a read-only public snapshot without answer metadata and rejects display commands', async () => {
    eligibleCapture(storage); let state = await create(); state = (await send(state, 'START')).data.status;
    await send(state, 'PREPARE', { roundId: randomUUID(), tier: 'squash' }); state = await untilReady(state.snapshot!.session.id);
    const path = `/sessions/${state.snapshot!.session.id}`; const viewer = (await request(path + '/displays', {})).data.token;
    const publicView = await request(path, undefined, { Authorization: `Bearer ${viewer}` }); const serialized = JSON.stringify(publicView);
    expect(publicView.data.snapshot.phase).toBe('ready'); expect(serialized).not.toContain('Alpha vs Beta'); expect(serialized).not.toContain('Fixture Show'); expect(serialized).not.toContain(credential.token);
    expect((await request(path + '/commands', command(state, 'CANCEL_UNEXPOSED'), { Authorization: `Bearer ${viewer}` })).status).toBe(403);
    expect((await request(`/sessions/${randomUUID()}`, undefined, { Authorization: `Bearer ${viewer}` })).status).toBe(401);
  });
  it('reports a prepared metadata change and fresh availability without exposing or substituting another image', async () => {
    const fixture = eligibleCapture(storage); let state = await create(); state = (await send(state, 'START')).data.status;
    await send(state, 'PREPARE', { roundId: randomUUID(), tier: 'squash' }); state = await untilReady(state.snapshot!.session.id);
    fixture.repo.updateMatch(fixture.match.id, fixture.match.revision, { event: 'Changed' });
    state = await current(); expect(state.candidateValid).toBe(false); expect(state.availability.distinctMatches).toBe(0);
    expect(state.snapshot!.currentRound?.phase).toBe('ready'); expect((await send(state, 'REVEAL_AND_START')).status).toBe(422);
  });
  it('restores ready sessions with fresh validation after a server restart and invalidates old process secrets', async () => {
    eligibleCapture(storage); let state = await create(); state = (await send(state, 'START')).data.status;
    await send(state, 'PREPARE', { roundId: randomUUID(), tier: 'squash' }); state = await untilReady(state.snapshot!.session.id);
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    server = resources.server(createServer(0, { dataDir: resources.root, production: true })); base = await listen(server);
    expect((await request('/current')).status).toBe(401); const oldEpoch = credential.serverEpoch; credential = (await request('/control-lease', {})).data;
    const restored = await current(); expect(credential.serverEpoch).not.toBe(oldEpoch); expect(restored.snapshot!.session.id).toBe(state.snapshot!.session.id);
    expect(restored.snapshot!.currentRound?.phase).toBe('ready'); expect(restored.candidateValid).toBe(true); expect(restored.primaryDisplay.ready).toBe(false);
  });
  it('keeps health and library endpoints intact', async () => {
    const health = await fetch(base + '/api/health'); expect(health.headers.get('access-control-allow-origin')).toBe('*'); expect((await health.json()).status).toBe('ok');
    const response = await fetch(base + '/api/matches'); expect(response.status).toBe(200); expect((await response.json()).data.matches).toEqual([]);
  });
});
