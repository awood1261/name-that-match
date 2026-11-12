import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openGameLive } from '../../client/src/game/live';
import { gameApi } from '../../client/src/game/api';
import { displaySnapshot } from '../../shared/src/game/projections';
import type { LiveSnapshot } from '../../shared/src/game/live';
import { pureGame } from '../game/fixtures';

class FakeSocket {
  static OPEN = 1; static instances: FakeSocket[] = [];
  readyState = 0; sent: string[] = [];
  onopen: ((event: Event) => void) | null = null; onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null; onclose: ((event: CloseEvent) => void) | null = null;
  constructor(readonly url: URL, readonly protocol: string) { FakeSocket.instances.push(this); }
  send(data: string) { this.sent.push(data); }
  close() { this.readyState = 3; this.onclose?.({ code: 1000, reason: '' } as CloseEvent); }
  open() { this.readyState = 1; this.onopen?.(new Event('open')); }
  receive(value: unknown) { this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(value) })); }
  messages() { return this.sent.map(s => JSON.parse(s) as Record<string, unknown>); }
}
const game = pureGame(); const state = displaySnapshot(game.state, null, 0);
const join = { type: 'hello' as const, protocolVersion: 1 as const, role: 'display' as const, serverEpoch: randomUUID(), displayId: randomUUID(), token: 'a'.repeat(64), sessionId: state.sessionId };
const handles: Array<ReturnType<typeof openGameLive>> = [];
let now: number;
const snapshot = (sequence = 1, connectionSequence = 1): LiveSnapshot => ({ type: 'snapshot', protocolVersion: 1, serverEpoch: join.serverEpoch, role: 'display',
  sequence, connectionSequence, sessionId: state.sessionId, stateVersion: state.stateVersion, serverMonoMs: 100, state: { snapshot: { ...state }, asset: null } });
const tag = { protocolVersion: 1, serverEpoch: join.serverEpoch, connectionSequence: 1 };
beforeEach(() => { now = 0; vi.useFakeTimers(); vi.spyOn(performance, 'now').mockImplementation(() => now); vi.stubGlobal('WebSocket', FakeSocket); FakeSocket.instances = []; });
afterEach(() => { for (const handle of handles.splice(0)) handle.close(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
async function start() {
  const callbacks = { snapshot: vi.fn(), unavailable: vi.fn(), reset: vi.fn() }; const handle = openGameLive(join, callbacks); handles.push(handle);
  await vi.advanceTimersByTimeAsync(0); const ws = FakeSocket.instances[0]; ws.open(); return { callbacks, handle, ws };
}
async function advance(ms: number) { now += ms; await vi.advanceTimersByTimeAsync(ms); }
describe('shared browser live observation adapter', () => {
  it('puts credentials only in HELLO, obtains an initial snapshot and explicit clock proof before readiness', async () => {
    const { ws, handle, callbacks } = await start(); expect(ws.url.pathname).toBe('/api/game/live'); expect(ws.url.search).toBe(''); expect(ws.protocol).toBe('ntm.game.v1');
    expect(ws.messages()[0]).toMatchObject(join); ws.receive(snapshot()); expect(callbacks.snapshot.mock.lastCall?.[1].synchronized).toBe(false);
    const probe = ws.messages().find(m => m.type === 'clock_probe')!; ws.receive({ ...tag, type: 'clock', nonce: probe.nonce, serverMonoMs: 100 });
    expect(callbacks.snapshot.mock.lastCall?.[1].synchronized).toBe(true);
    handle.ready({ roundId: null, imageKey: null, decoded: false }); expect(ws.messages().at(-1)).toMatchObject({ type: 'display_ready', clock: { nonce: probe.nonce, rttMs: 0 } });
    const nonce = randomUUID(); ws.receive({ ...tag, type: 'heartbeat', nonce }); expect(ws.messages().at(-1)).toMatchObject({ type: 'heartbeat_ack', nonce });
  });
  it('discards lower sequence/revision and old-connection responses and freezes equal-revision domain state', async () => {
    const { ws, callbacks } = await start(); ws.receive(snapshot(3)); const count = callbacks.snapshot.mock.calls.length;
    ws.receive(snapshot(2)); ws.receive(snapshot(4, 99)); expect(callbacks.snapshot).toHaveBeenCalledTimes(count);
    const same = snapshot(5); if (same.role !== 'display') throw new Error('fixture'); same.state.snapshot = { ...state, contestants: [{ ...state.contestants[0], name: 'Changed without revision' }] };
    ws.receive(same); expect(callbacks.snapshot.mock.lastCall?.[0].state.snapshot.contestants).toEqual(state.contestants);
    const old = snapshot(6); old.stateVersion = 0; if (old.role === 'display') old.state.snapshot.stateVersion = 0;
    // Invalid revisions are rejected before rendering; a valid older revision is tested below.
    const newer = snapshot(6); newer.stateVersion = 3; if (newer.role === 'display') newer.state.snapshot.stateVersion = 3; ws.receive(newer);
    const before = callbacks.snapshot.mock.calls.length; ws.receive(snapshot(7)); expect(callbacks.snapshot).toHaveBeenCalledTimes(before);
  });
  it('covers connection loss, backs off, clears readiness and never replays a game command', async () => {
    const command = vi.spyOn(gameApi, 'command'); const { ws, callbacks } = await start(); ws.receive(snapshot()); const firstHello = ws.messages()[0];
    ws.onerror?.(); expect(callbacks.unavailable).toHaveBeenCalledOnce(); expect(callbacks.reset).toHaveBeenCalledOnce();
    expect(FakeSocket.instances).toHaveLength(1); await advance(400); expect(FakeSocket.instances).toHaveLength(2);
    const next = FakeSocket.instances[1]; next.open(); expect(next.messages()[0].connectionId).not.toBe(firstHello.connectionId); next.receive(snapshot(1, 2));
    expect(next.messages().some(m => m.type === 'display_ready' && m.decoded)).toBe(false); expect(command).not.toHaveBeenCalled();
    const calls = callbacks.snapshot.mock.calls.length; ws.receive(snapshot(999)); expect(callbacks.snapshot).toHaveBeenCalledTimes(calls);
  });
  it('covers stale observation streams and stale clocks instead of extending time', async () => {
    const { ws, callbacks } = await start(); ws.receive(snapshot()); await advance(3100);
    expect(callbacks.unavailable).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('stale') }), false); expect(callbacks.reset).toHaveBeenCalled();
  });
  it('rejects high RTT as unsynchronized without inventing a better clock or sending mutations', async () => {
    const { ws, callbacks } = await start(); ws.receive(snapshot()); const probe = ws.messages().find(m => m.type === 'clock_probe')!;
    await advance(501); ws.receive({ ...tag, type: 'clock', nonce: probe.nonce, serverMonoMs: 200 });
    expect(callbacks.snapshot.mock.lastCall?.[1].synchronized).toBe(false); expect(ws.messages().at(-1)).toMatchObject({ type: 'display_ready', clock: { rttMs: 501 } });
  });
  it('terminates old epochs and replacement connections without reconnect loops', async () => {
    const { ws, callbacks } = await start(); ws.receive({ ...snapshot(), serverEpoch: randomUUID() });
    expect(callbacks.unavailable.mock.lastCall?.[1]).toBe(true); await advance(20_000); expect(FakeSocket.instances).toHaveLength(1);
  });
  it('keeps a deliberately replaced viewer closed until the operator rejoins', async () => {
    const { ws, callbacks } = await start(); ws.receive(snapshot()); ws.onclose?.({ code: 1000, reason: 'Live connection replaced' } as CloseEvent);
    expect(callbacks.unavailable.mock.lastCall?.[1]).toBe(true); await advance(20_000); expect(FakeSocket.instances).toHaveLength(1);
  });
  it.each(['private-payload', 'wrong-role', 'oversize', 'unsupported'])('rejects %s frames before rendering', async kind => {
    const { ws, callbacks } = await start(); const frame = snapshot();
    if (kind === 'private-payload' && frame.role === 'display') Object.assign(frame.state.snapshot, { context: { private: 'answer' } });
    else if (kind === 'wrong-role') Object.assign(frame, { role: 'host' });
    else if (kind === 'oversize') Object.assign(frame, { padding: 'x'.repeat(64 * 1024) });
    else Object.assign(frame, { protocolVersion: 2 });
    ws.receive(frame); expect(callbacks.snapshot).not.toHaveBeenCalled(); expect(callbacks.unavailable.mock.lastCall?.[1]).toBe(true);
  });
  it('cleans retry/clock/watch timers and ignores late messages after close', async () => {
    const { ws, handle, callbacks } = await start(); ws.receive(snapshot()); const calls = callbacks.snapshot.mock.calls.length;
    handle.close(); expect(vi.getTimerCount()).toBe(0); ws.receive(snapshot(10)); expect(callbacks.snapshot).toHaveBeenCalledTimes(calls);
  });
});
