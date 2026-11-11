import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGameHttp } from '../../server/src/game/http';
import { initializeStorage, type StorageSession } from '../../server/src/storage';
import { createTestResources, listen } from '../helpers/resources';
import { setup } from './fixtures';
import type { ControllerCredential } from '../../shared/src/game/host';

describe('host-only LAN origin HTTP observation', () => {
  let resources: ReturnType<typeof createTestResources>; let storage: StorageSession; let game: ReturnType<typeof createGameHttp>;
  let base: string; let owner: ControllerCredential; let detect: ReturnType<typeof vi.fn>;
  const uiOrigin = 'http://localhost:5173'; const lanOrigin = 'http://192.0.2.10:5173';
  beforeEach(async () => {
    resources = createTestResources(); storage = resources.storage(initializeStorage({ dataDir: resources.root })); detect = vi.fn().mockResolvedValue('192.0.2.10');
    game = createGameHttp(storage, new Set([uiOrigin, lanOrigin]), { now: () => 0 }, { detect });
    const server = resources.server(http.createServer((req, res) => { void game.handle(req, res, new URL(req.url!, uiOrigin)); })); server.on('close', () => game.stop()); base = await listen(server);
    owner = (await request('/control-lease', {})).data;
  });
  afterEach(async () => { await resources.cleanup(); });
  async function request(route: string, payload?: unknown, custom: Record<string, string> = {}, token = owner?.token) {
    const response = await fetch(base + '/api/game' + route, { method: payload === undefined ? 'GET' : 'POST', headers: {
      ...(token ? { Authorization: `Bearer ${token}`, 'X-Name-That-Match-Epoch': owner.serverEpoch } : {}),
      ...(payload === undefined ? {} : { Origin: uiOrigin, 'X-Name-That-Match': 'game', 'Content-Type': 'application/json' }), ...custom,
    }, body: payload === undefined ? undefined : JSON.stringify(payload) });
    return { status: response.status, ...(await response.json()) };
  }
  it('detects only on demand and does not mutate a session, primary or display registrations', async () => {
    const session = (await request('/sessions', setup())).data.status.snapshot.session;
    const viewer = (await request(`/sessions/${session.id}/displays`, { primary: true })).data;
    const before = (await request('/current')).data;
    await request('/current'); expect(detect).not.toHaveBeenCalled();
    const observed = await request('/display-origin', { uiOrigin }); expect(observed.status).toBe(200); expect(observed.data).toMatchObject({ ready: true, origin: lanOrigin, source: 'detected' });
    const after = (await request('/current')).data; expect(after.snapshot).toEqual(before.snapshot); expect(after.primaryDisplay).toEqual(before.primaryDisplay);
    expect(JSON.stringify(observed)).not.toContain(owner.token); expect(JSON.stringify(observed)).not.toContain(viewer.token);
    expect(storage.db.prepare('SELECT count(*) n FROM game_sessions').get()).toEqual({ n: 1 }); expect(detect).toHaveBeenCalledOnce();
    expect((await request('/display-origin', { uiOrigin, manualOrigin: lanOrigin })).data.source).toBe('manual'); expect(detect).toHaveBeenCalledOnce();
  });
  it('requires the controller, epoch, exact browser origin and header, ignoring forwarded origins', async () => {
    const input = { uiOrigin };
    expect((await request('/display-origin', input, {}, '')).status).toBe(401);
    expect((await request('/display-origin', input, { 'X-Name-That-Match-Epoch': randomUUID() })).status).toBe(409);
    expect((await request('/display-origin', input, { Origin: 'https://foreign.invalid', 'X-Forwarded-Host': 'localhost:5173' })).status).toBe(403);
    expect((await request('/display-origin', input, { 'X-Name-That-Match': '' })).status).toBe(403);
    expect((await request('/display-origin', { uiOrigin: lanOrigin })).status).toBe(403);
    const session = (await request('/sessions', setup())).data.status.snapshot.session;
    const viewer = (await request(`/sessions/${session.id}/displays`, {})).data;
    expect((await request('/display-origin', input, {}, viewer.token)).status).toBe(401); expect(detect).not.toHaveBeenCalled();
  });
  it('preserves exact allowlists and returns actionable config/detection failures', async () => {
    expect((await request('/display-origin', { uiOrigin, manualOrigin: 'http://192.0.2.11:5173' })).data).toMatchObject({ ready: false, code: 'ORIGIN_NOT_ALLOWED' });
    expect((await request('/display-origin', { uiOrigin, manualOrigin: 'http://127.0.0.1:5173' })).status).toBe(400);
    detect.mockRejectedValue(new Error('stderr secret')); const result = await request('/display-origin', { uiOrigin });
    expect(result.data).toMatchObject({ ready: false, code: 'DETECTION_UNAVAILABLE' }); expect(JSON.stringify(result)).not.toContain('secret');
    expect((await request('/display-origin')).status).toBe(405);
  });
  it('aborts owned lookup work on shutdown and closes its response without hanging', async () => {
    let started!: () => void; const ready = new Promise<void>((resolve) => { started = resolve; }); let signal!: AbortSignal;
    detect.mockImplementation((input: AbortSignal) => { signal = input; started(); return new Promise((_resolve, reject) => input.addEventListener('abort', () => reject(new Error('cancelled')), { once: true })); });
    const pending = request('/display-origin', { uiOrigin }).catch(() => null); await ready;
    expect((await request('/display-origin', { uiOrigin })).status).toBe(409);
    game.stop(); await pending; expect(signal.aborted).toBe(true);
  });
  it('cancels the child observation when the client disconnects', async () => {
    let started!: () => void; const ready = new Promise<void>((resolve) => { started = resolve; }); let signal!: AbortSignal;
    detect.mockImplementation((input: AbortSignal) => { signal = input; started(); return new Promise((_resolve, reject) => input.addEventListener('abort', () => reject(new Error('cancelled')), { once: true })); });
    const controller = new AbortController(); const pending = fetch(base + '/api/game/display-origin', { method: 'POST', signal: controller.signal, headers: { Authorization: `Bearer ${owner.token}`, 'X-Name-That-Match-Epoch': owner.serverEpoch, Origin: uiOrigin, 'X-Name-That-Match': 'game', 'Content-Type': 'application/json' }, body: JSON.stringify({ uiOrigin }) }).catch(() => null);
    await ready; controller.abort(); await pending; await vi.waitFor(() => expect(signal.aborted).toBe(true));
  });
});
