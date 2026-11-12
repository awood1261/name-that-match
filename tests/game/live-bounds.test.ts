// @vitest-environment node
import http from 'node:http';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { performance } from 'node:perf_hooks';
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HostStatus } from '../../shared/src/game/host';
import { LIVE_LIMITS } from '../../shared/src/game/live';

const fixtures = vi.hoisted(() => ({ servers: [] as unknown[] }));
vi.mock('ws', async () => {
  const events = await import('node:events');
  class Socket extends events.EventEmitter {
    static OPEN = 1; readyState = 1; bufferedAmount = 0; frames: string[] = []; writes: Array<(error?: Error) => void> = [];
    hold = false; code = 0; reason = ''; terminated = false;
    send(data: string, callback?: (error?: Error) => void) {
      this.frames.push(data); const frame = JSON.parse(data);
      if (frame.type === 'heartbeat') this.emit('message', Buffer.from(JSON.stringify({ type: 'heartbeat_ack', protocolVersion: 1, serverEpoch: frame.serverEpoch, connectionSequence: frame.connectionSequence, nonce: frame.nonce })), false);
      if (callback) { if (this.hold) this.writes.push(callback); else queueMicrotask(() => callback()); }
    }
    ping() { this.emit('pong'); }
    close(code: number, reason: string) { this.code = code; this.reason = reason; this.readyState = 2; }
    terminate() { this.terminated = true; this.readyState = 3; this.emit('close'); }
  }
  class Server extends events.EventEmitter {
    clients = new Set<Socket>();
    constructor() { super(); fixtures.servers.push(this); }
    handleUpgrade(_req: unknown, _socket: unknown, _head: unknown, callback: (socket: Socket) => void) { const socket = new Socket(); this.clients.add(socket); socket.on('close', () => this.clients.delete(socket)); callback(socket); }
    close() {}
  }
  return { WebSocket: Socket, WebSocketServer: Server };
});
import { attachGameLive } from '../../server/src/game/live';

interface FakePeer extends EventEmitter {
  readyState: number; bufferedAmount: number; frames: string[]; writes: Array<(error?: Error) => void>;
  hold: boolean; code: number; reason: string; terminated: boolean;
}
let adapter: ReturnType<typeof attachGameLive>; let server: http.Server; let peer: FakePeer;
let notify: () => void; let status: HostStatus; const disconnected = vi.fn(); const unsubscribe = vi.fn(); const epoch = randomUUID();
beforeEach(async () => {
  vi.useFakeTimers(); vi.setSystemTime(0); vi.spyOn(performance, 'now').mockImplementation(() => Date.now()); fixtures.servers.length = 0;
  status = { protocolVersion: 1, sequence: 1, serverEpoch: epoch, snapshot: null, allowedActions: [], candidateValid: false, preparationError: null,
    primaryDisplay: { ready: false, message: 'Connect a display.' }, availability: { distinctMatches: 0, asOf: '', tiers: { squash: { screenshots: 0, matches: 0 }, competitive: { screenshots: 0, matches: 0 }, deathmatch: { screenshots: 0, matches: 0 } } } };
  server = http.createServer();
  adapter = attachGameLive(server, new Set(['http://localhost']), { serverEpoch: epoch, subscribe(fn) { notify = fn; return unsubscribe; },
    connect: () => 0, observe: () => ({ role: 'host', state: { ...status, sequence: status.sequence++ }, serverMonoMs: performance.now() }),
    probe: (_hello, nonce) => ({ nonce, serverMonoMs: performance.now() }), acknowledge() {}, ready: () => ({ connectionSequence: 1, sample: { nonce: randomUUID(), serverMonoMs: 0 } }), disconnected,
  });
  server.emit('upgrade', { url: '/api/game/live', headers: { origin: 'http://localhost', 'sec-websocket-protocol': 'ntm.game.v1' } }, new PassThrough(), Buffer.alloc(0));
  const wss = fixtures.servers[0] as { clients: Set<FakePeer> }; peer = [...wss.clients][0];
  peer.emit('message', Buffer.from(JSON.stringify({ type: 'hello', role: 'host', protocolVersion: 1, serverEpoch: epoch, token: 'a'.repeat(64), connectionId: randomUUID(), sessionId: null })), false);
  await Promise.resolve(); await Promise.resolve();
});
afterEach(() => { adapter.stop(true); vi.restoreAllMocks(); vi.useRealTimers(); disconnected.mockClear(); unsubscribe.mockClear(); });
const snapshots = () => peer.frames.map(s => JSON.parse(s) as { type: string; sequence: number }).filter(f => ['snapshot', 'ready_status'].includes(f.type));
describe('bounded live writer ownership', () => {
  it('coalesces backlogged snapshots to one latest full observation', async () => {
    peer.hold = true; notify(); await Promise.resolve();
    const sent = snapshots().length;
    for (let i = 0; i < 100; i++) { notify(); await Promise.resolve(); }
    expect(snapshots()).toHaveLength(sent);
    peer.writes.shift()!(); await Promise.resolve(); expect(snapshots()).toHaveLength(sent + 1);
    expect(snapshots().slice(-1)[0].sequence).toBeGreaterThan(100);
  });
  it('closes a peer over the byte budget and bounds unresponsive close termination', async () => {
    peer.bufferedAmount = LIVE_LIMITS.backlogBytes + 1; notify(); await Promise.resolve();
    expect(peer.code).toBe(1008); expect(disconnected).toHaveBeenCalledOnce(); await vi.advanceTimersByTimeAsync(2000); expect(peer.terminated).toBe(true);
  });
  it('closes a persistently blocked writer even when native and application heartbeats respond', async () => {
    peer.bufferedAmount = 100; notify(); await Promise.resolve(); await vi.advanceTimersByTimeAsync(3100);
    expect(peer.code).toBe(1008); expect(peer.reason).toBe('Live reader is too slow'); expect(disconnected).toHaveBeenCalledOnce();
  });
  it('rejects an oversized server projection instead of publishing partial private state', async () => {
    status.preparationError = 'x'.repeat(LIVE_LIMITS.serverBytes); notify(); await Promise.resolve();
    expect(peer.code).toBe(1009); expect(snapshots().every(frame => JSON.stringify(frame).length <= LIVE_LIMITS.serverBytes)).toBe(true);
  });
  it('unsubscribes and clears heartbeat/close jobs on immediate shutdown', () => {
    adapter.stop(true); expect(unsubscribe).toHaveBeenCalledOnce(); expect(peer.terminated).toBe(true); expect(vi.getTimerCount()).toBe(0);
  });
});
