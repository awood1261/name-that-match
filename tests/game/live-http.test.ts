// @vitest-environment node
import http from 'node:http';
import net from 'node:net';
import { randomUUID } from 'node:crypto';
import { WebSocket } from 'ws';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { attachGameLive } from '../../server/src/game/live';
import { createGameHttp } from '../../server/src/game/http';
import { createServer } from '../../server/src/index';
import { initializeStorage, type StorageSession } from '../../server/src/storage';
import { LIVE_PROTOCOL, parseLiveServer, type LiveHello, type LiveServerMessage, type LiveSnapshot } from '../../shared/src/game/live';
import type { HostStatus, ControllerCredential } from '../../shared/src/game/host';
import type { DisplayCredential } from '../../shared/src/game/display';
import { createTestResources, listen } from '../helpers/resources';
import { eligibleCapture } from './host-fixtures';
import { setup } from './fixtures';

const origin = 'http://localhost:3001';
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function until<T>(read: () => T | undefined): Promise<T> {
  for (let i = 0; i < 250; i++) { const value = read(); if (value !== undefined) return value; await sleep(10); }
  throw new Error('Timed out waiting for live observation');
}
describe('real local WebSocket game adapter', () => {
  let resources: ReturnType<typeof createTestResources>; let storage: StorageSession; let game: ReturnType<typeof createGameHttp>;
  let live: ReturnType<typeof attachGameLive>; let base: string; let owner: ControllerCredential; let status: HostStatus; let viewer: DisplayCredential; let now: number;
  const sockets: WebSocket[] = [];
  beforeEach(async () => {
    resources = createTestResources(); storage = resources.storage(initializeStorage({ dataDir: resources.root })); now = 0;
    eligibleCapture(storage); eligibleCapture(storage, { approved: false });
    game = createGameHttp(storage, new Set([origin]), { now: () => now });
    const server = resources.server(http.createServer((req, res) => { void game.handle(req, res, new URL(req.url!, origin)); }));
    live = attachGameLive(server, new Set([origin]), game.live); server.on('close', () => game.stop()); base = await listen(server);
    owner = (await request('/control-lease', {}, undefined)).data;
    status = (await request('/sessions', setup())).data.status;
    viewer = (await request(`/sessions/${status.snapshot!.session.id}/displays`, { primary: true })).data;
  });
  afterEach(async () => { vi.restoreAllMocks(); for (const socket of sockets.splice(0)) socket.terminate(); live.stop(true); await resources.cleanup(); });
  async function request(route: string, payload?: unknown, credential: ControllerCredential | undefined = owner) {
    const response = await fetch(base + '/api/game' + route, { method: payload === undefined ? 'GET' : 'POST', headers: {
      Origin: origin, 'X-Name-That-Match': 'game', 'Content-Type': 'application/json',
      ...(credential ? { Authorization: `Bearer ${credential.token}`, 'X-Name-That-Match-Epoch': credential.serverEpoch } : {}),
    }, body: payload === undefined ? undefined : JSON.stringify(payload) });
    return { status: response.status, ...(await response.json()) };
  }
  const sessionId = () => status.snapshot!.session.id;
  async function current() { status = (await request('/current')).data; return status; }
  async function command(type: string, payload = {}, saved?: unknown) {
    await current(); const input = saved ?? { protocolVersion: 1, commandId: randomUUID(), sessionId: sessionId(), expectedStateVersion: status.snapshot!.session.stateVersion,
      type, payload, ...(!['START', 'PREPARE'].includes(type) && status.snapshot!.session.currentRoundId ? { roundId: status.snapshot!.session.currentRoundId } : {}) };
    const result = await request(`/sessions/${sessionId()}/commands`, input); if (result.data?.status) status = result.data.status;
    return { ...result, input };
  }
  function hello(role?: 'display'): Extract<LiveHello, { role: 'display' }>;
  function hello(role: 'host'): Extract<LiveHello, { role: 'host' }>;
  function hello(role: 'host' | 'display' = 'display'): LiveHello { return role === 'host'
    ? { type: 'hello', protocolVersion: 1, role, token: owner.token, serverEpoch: owner.serverEpoch, connectionId: randomUUID(), sessionId: sessionId() }
    : { type: 'hello', protocolVersion: 1, role, ...viewer, connectionId: randomUUID(), sessionId: sessionId() }; }
  async function connect(join: LiveHello = hello(), automatic = true) {
    const ws = new WebSocket(base.replace('http:', 'ws:') + '/api/game/live', LIVE_PROTOCOL, { origin }); sockets.push(ws);
    const frames: LiveServerMessage[] = []; let snapshot: LiveSnapshot | undefined;
    ws.on('error', () => {});
    ws.on('message', bytes => {
      const frame = parseLiveServer(JSON.parse(bytes.toString())); frames.push(frame); if (frame.type === 'snapshot' || frame.type === 'ready_status') snapshot = frame;
      if (automatic && frame.type === 'heartbeat') ws.send(JSON.stringify({ protocolVersion: 1, serverEpoch: frame.serverEpoch, connectionSequence: frame.connectionSequence, type: 'heartbeat_ack', nonce: frame.nonce }));
    });
    await new Promise<void>((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); }); ws.send(JSON.stringify(join));
    await until(() => snapshot ?? frames.find(f => f.type === 'error'));
    const tag = () => ({ protocolVersion: 1, serverEpoch: join.serverEpoch, connectionSequence: snapshot!.connectionSequence });
    return { ws, frames, get snapshot() { return snapshot!; },
      send(value: Record<string, unknown>) { ws.send(JSON.stringify({ ...tag(), ...value })); },
      async ready(rttMs = 0, decoded = true) {
        await until(() => snapshot?.role === 'display' && snapshot.state.asset ? true : undefined);
        const nonce = randomUUID(); ws.send(JSON.stringify({ ...tag(), type: 'clock_probe', nonce }));
        await until(() => frames.find(f => f.type === 'clock' && f.nonce === nonce));
        const view = snapshot!.role === 'display' ? snapshot!.state.snapshot : null; const roundId = view && 'roundId' in view ? view.roundId : null;
        ws.send(JSON.stringify({ ...tag(), type: 'display_ready', roundId, imageKey: roundId, decoded, clock: { nonce, rttMs } }));
        await sleep(15);
      },
    };
  }
  async function prepare() {
    await command('START'); await command('PREPARE', { roundId: randomUUID(), tier: 'squash' });
    await until(() => { const r = storage.db.prepare('SELECT phase FROM game_rounds ORDER BY ordinal DESC LIMIT 1').get() as { phase: string }; return r.phase === 'ready' ? true : undefined; }); await current();
  }
  it('sends complete private/public projections and commits score once through HTTP while pushing concealed/revealed states', async () => {
    const host = await connect(hello('host')); const primary = await connect(); await prepare();
    await until(() => primary.snapshot.role === 'display' && primary.snapshot.state.snapshot.phase === 'ready' ? true : undefined);
    expect(JSON.stringify(primary.frames)).not.toContain('Alpha vs Beta'); expect(JSON.stringify(primary.frames)).not.toContain(owner.token);
    expect((await command('REVEAL_AND_START')).status).toBe(422); await primary.ready();
    await until(() => host.frames.find(f => f.type === 'ready_status' && f.role === 'host' && f.state.primaryDisplay.ready));
    expect((await command('REVEAL_AND_START')).status).toBe(200);
    const judged = await command('CORRECT'); expect(judged.status).toBe(200);
    await until(() => primary.snapshot.role === 'display' && primary.snapshot.state.snapshot.phase === 'adjudicated' ? true : undefined);
    expect(JSON.stringify(primary.snapshot)).not.toMatch(/Alpha vs Beta|"award"|"outcome"/);
    expect(host.snapshot.role).toBe('host'); expect(JSON.stringify(host.frames)).toContain('Alpha vs Beta');
    await command('REVEAL_ANSWER'); await until(() => primary.snapshot.role === 'display' && primary.snapshot.state.snapshot.phase === 'answer_revealed' ? true : undefined);
    expect(JSON.stringify(primary.snapshot)).toContain('Alpha vs Beta'); expect((await command('CORRECT', {}, judged.input)).data.replayed).toBe(true);
    expect(storage.db.prepare('SELECT count(*) n FROM game_score_events').get()).toEqual({ n: 1 });
  });
  it.each([undefined, 'null', 'https://foreign.example'])('rejects upgrade Origin %s without game effects', async (badOrigin) => {
    const ws = new WebSocket(base.replace('http:', 'ws:') + '/api/game/live', LIVE_PROTOCOL, { ...(badOrigin ? { origin: badOrigin } : {}) }); sockets.push(ws); ws.on('error', () => {});
    const code = await new Promise<number>(resolve => ws.once('unexpected-response', (_request, response) => { response.resume(); resolve(response.statusCode!); }));
    expect(code).toBe(403); expect(storage.db.prepare('SELECT count(*) n FROM game_rounds').get()).toEqual({ n: 0 });
  });
  it('rejects unsupported protocol, credential-bearing query and non-game paths before upgrade', async () => {
    for (const [route, protocol, expected] of [['/api/game/live', 'other', 403], ['/api/game/live?token=secret', LIVE_PROTOCOL, 404], ['/health', LIVE_PROTOCOL, 404]] as const) {
      const ws = new WebSocket(base.replace('http:', 'ws:') + route, protocol, { origin }); sockets.push(ws); ws.on('error', () => {});
      expect(await new Promise<number>(resolve => ws.once('unexpected-response', (_req, res) => { res.resume(); resolve(res.statusCode!); }))).toBe(expected);
    }
  });
  it.each(['bad-token', 'wrong-role', 'old-epoch'])('rejects %s HELLO with sanitized failure', async kind => {
    const join = hello(); if (kind === 'bad-token') join.token = 'c'.repeat(64); if (kind === 'old-epoch') join.serverEpoch = randomUUID();
    const invalid = kind === 'wrong-role' ? { ...hello('host'), token: viewer.token } : join;
    const client = await connect(invalid); const error = client.frames.find(f => f.type === 'error'); expect(error).toBeDefined();
    expect(JSON.stringify(error)).not.toContain(resources.root); expect(JSON.stringify(error)).not.toContain(owner.token);
  });
  it.each(['command', 'binary', 'json', 'oversize', 'old-generation'])('rejects %s frames without score or state mutation', async kind => {
    const client = await connect(); const before = status.snapshot!.session.stateVersion;
    const closed = new Promise<number>(resolve => client.ws.once('close', resolve));
    if (kind === 'binary') client.ws.send(Buffer.from('{}'));
    else if (kind === 'json') client.ws.send('{');
    else if (kind === 'oversize') client.ws.send('x'.repeat(16 * 1024 + 1));
    else client.send(kind === 'command' ? { type: 'CORRECT' } : { type: 'clock_probe', nonce: randomUUID(), connectionSequence: 999 });
    expect([1008, 1009]).toContain(await closed); expect((await current()).snapshot!.session.stateVersion).toBe(before);
    expect(storage.db.prepare('SELECT count(*) n FROM game_score_events').get()).toEqual({ n: 0 });
  });
  it('keeps secondary loss harmless, pauses on primary loss and requires fresh decode plus explicit Resume', async () => {
    const primary = await connect(); const extra = (await request(`/sessions/${sessionId()}/displays`, { primary: false })).data as DisplayCredential;
    const secondary = await connect({ ...hello(), ...extra }); await prepare(); await primary.ready(); await command('REVEAL_AND_START');
    secondary.ws.terminate(); await sleep(30); expect((await current()).snapshot!.currentRound?.phase).toBe('guessing');
    now = 2000; primary.ws.terminate(); await until(() => { const r = storage.db.prepare('SELECT phase FROM game_rounds').get() as { phase: string }; return r.phase === 'paused' ? true : undefined; });
    const recovered = await connect(); expect((await current()).snapshot!.currentRound).toMatchObject({ phase: 'paused', remainingMs: 28000 });
    expect((await command('RESUME')).status).toBe(422); await recovered.ready(); expect((await command('RESUME')).status).toBe(200);
    expect((await current()).snapshot!.currentRound).toMatchObject({ phase: 'guessing', windowMs: 28000 });
  });
  it('replaces a connection without letting its old close clear the new readiness generation', async () => {
    const first = await connect(); const second = await connect(); await until(() => first.ws.readyState === WebSocket.CLOSED ? true : undefined);
    expect(second.snapshot.connectionSequence).toBeGreaterThan(first.snapshot.connectionSequence);
    await prepare(); await second.ready(); expect((await current()).primaryDisplay.ready).toBe(true); expect((await command('REVEAL_AND_START')).status).toBe(200);
  });
  it('pauses on host loss and reconnects as observations only, without replaying judgment or Resume', async () => {
    const host = await connect(hello('host')); const primary = await connect(); await prepare(); await primary.ready(); await command('REVEAL_AND_START'); now = 1200;
    host.ws.terminate(); await sleep(30); const next = await connect(hello('host'));
    expect(next.snapshot.role === 'host' && next.snapshot.state.snapshot?.currentRound).toMatchObject({ phase: 'paused', remainingMs: 28800 });
    expect(storage.db.prepare('SELECT count(*) n FROM game_score_events').get()).toEqual({ n: 0 });
  });
  it('refuses stale round/image proof and another display identity without bypassing the primary gate', async () => {
    const primary = await connect(); await prepare();
    primary.send({ type: 'display_ready', roundId: randomUUID(), imageKey: randomUUID(), decoded: true, clock: null }); await sleep(15);
    expect((await command('REVEAL_AND_START')).status).toBe(422);
    const other = (await request(`/sessions/${sessionId()}/displays`, { primary: false })).data as DisplayCredential;
    const bad = await connect({ ...hello(), displayId: other.displayId }); expect(bad.frames.some(f => f.type === 'error')).toBe(true);
    await primary.ready(); expect((await command('REVEAL_AND_START')).status).toBe(200);
  });
  it('publishes sanitized storage failure instead of a score/success snapshot and latches mutations', async () => {
    const primary = await connect(); await prepare(); await primary.ready(); await command('REVEAL_AND_START'); await current();
    const input = { protocolVersion: 1, commandId: randomUUID(), sessionId: sessionId(), roundId: status.snapshot!.session.currentRoundId,
      expectedStateVersion: status.snapshot!.session.stateVersion, type: 'CORRECT', payload: {} };
    const prepareSql = vi.spyOn(storage.db, 'prepare').mockImplementation(() => { throw new Error('SQL/private/path/secret'); });
    const response = await request(`/sessions/${sessionId()}/commands`, input); expect(response.status).toBe(503);
    const error = await until(() => primary.frames.find(f => f.type === 'error')); expect(JSON.stringify(error)).not.toMatch(/SQL|private\/path|secret/);
    prepareSql.mockRestore(); expect(storage.db.prepare('SELECT count(*) n FROM game_score_events').get()).toEqual({ n: 0 }); expect((await request('/current')).status).toBe(503);
  });
  it('covers high RTT and stale readiness, preserving elapsed time rather than restarting', async () => {
    const primary = await connect(); await prepare(); await primary.ready(); await command('REVEAL_AND_START'); now = 1500;
    await primary.ready(501); expect((await current()).snapshot!.currentRound).toMatchObject({ phase: 'paused', remainingMs: 28500 });
    expect((await command('RESUME')).status).toBe(422); await primary.ready(); expect((await command('RESUME')).status).toBe(200);
  });
  it('preserves expiry precedence when loss is detected after the deadline', async () => {
    const primary = await connect(); await prepare(); await primary.ready(); await command('REVEAL_AND_START');
    for (let step = 1; step <= 10; step++) { now = step * 2900; await request('/control-lease/renew', {}); await primary.ready(); }
    now = 30_000; primary.ws.terminate();
    await sleep(30); expect((await current()).snapshot!.currentRound?.phase).toBe('awaiting_judgment'); expect((await command('CORRECT')).status).toBe(409);
  });
  it('bounds a missing HELLO', async () => {
    const ws = new WebSocket(base.replace('http:', 'ws:') + '/api/game/live', LIVE_PROTOCOL, { origin }); sockets.push(ws); ws.on('error', () => {});
    const started = performance.now(); expect(await new Promise<number>(resolve => ws.once('close', resolve))).toBe(1008); expect(performance.now() - started).toBeLessThan(4500);
  });
  it('caps open sockets while they await HELLO', async () => {
    for (let i = 0; i < 5; i++) {
      const ws = new WebSocket(base.replace('http:', 'ws:') + '/api/game/live', LIVE_PROTOCOL, { origin }); sockets.push(ws); ws.on('error', () => {});
      await new Promise<void>(resolve => ws.once('open', resolve));
    }
    const extra = new WebSocket(base.replace('http:', 'ws:') + '/api/game/live', LIVE_PROTOCOL, { origin }); sockets.push(extra); extra.on('error', () => {});
    expect(await new Promise<number>(resolve => extra.once('unexpected-response', (_req, res) => { res.resume(); resolve(res.statusCode!); }))).toBe(503);
  });
});

describe('production socket shutdown ownership', () => {
  it('bounds shutdown with open and unresponsive sockets, releases storage and reopens the dataset', async () => {
    const resources = createTestResources(); const peers: net.Socket[] = [];
    try {
      const server = resources.server(createServer(0, { dataDir: resources.root })); const base = await listen(server); const port = new URL(base).port;
      const peer = net.connect(Number(port), '127.0.0.1'); peers.push(peer); peer.on('error', () => {});
      await new Promise<void>(resolve => peer.once('connect', resolve));
      peer.write('GET /api/game/live HTTP/1.1\r\nHost: localhost\r\nOrigin: http://localhost:5173\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Protocol: ntm.game.v1\r\n\r\n');
      await new Promise<void>(resolve => peer.once('data', () => resolve()));
      const started = performance.now(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); expect(performance.now() - started).toBeLessThan(3000);
      const reopened = initializeStorage({ dataDir: resources.root }); expect(reopened.db.pragma('integrity_check', { simple: true })).toBe('ok'); reopened.db.close();
    } finally { for (const peer of peers) peer.destroy(); await resources.cleanup(); }
  });
});
