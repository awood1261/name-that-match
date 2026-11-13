import type http from 'node:http';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { WebSocket, WebSocketServer, type RawData } from 'ws';
import { LIVE_LIMITS, LIVE_PATH, LIVE_PROTOCOL, parseLiveClient, type LiveHello, type LiveServerMessage, type LiveSnapshot } from '../../../shared/src/game/live.js';
import { GameError } from '../../../shared/src/game/validation.js';
import { HttpError } from '../library/http/protocol.js';
import type { createGameHttp } from './http.js';

type Bridge = ReturnType<typeof createGameHttp>['live'];
interface Client {
  socket: WebSocket; hello: LiveHello | null; generation: number; wireGeneration: number;
  lastAck: number; lastPong: number; heartbeat: string | null; closing: boolean;
  sending: boolean; pending: string | null; blockedAt: number | null;
  frameWindow: number; frames: number; helloTimer: ReturnType<typeof setTimeout>;
  lastRevision: number; lastSession: string | null; lastReadiness: string;
}

/** Bounded observation adapter only. Game commands remain on the HTTP service. */
export function attachGameLive(server: http.Server, origins: Set<string>, bridge: Bridge) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: LIVE_LIMITS.clientBytes, perMessageDeflate: false, handleProtocols: () => LIVE_PROTOCOL });
  const clients = new Set<Client>(); const owners = new Map<string, Client>();
  let stopped = false; let scheduled = false; let sequence = 0; let generation = 0;
  let shutdown: ReturnType<typeof setTimeout> | null = null;
  const key = (hello: LiveHello) => hello.role === 'host' ? 'host' : hello.displayId;
  const tag = (client: Client) => ({ protocolVersion: 1 as const, serverEpoch: bridge.serverEpoch, connectionSequence: client.wireGeneration || 1 });
  function finish(client: Client) {
    client.closing = true; clients.delete(client); clearTimeout(client.helloTimer); client.pending = null;
    if (client.hello && owners.get(key(client.hello)) === client) {
      owners.delete(key(client.hello));
      try { bridge.disconnected(client.hello, client.generation); } catch { /* Storage failure stays latched in the service. */ }
    }
    if (stopped && !clients.size && shutdown) { clearTimeout(shutdown); shutdown = null; }
  }
  function close(client: Client, code = 1008, reason = 'Live connection ended') {
    if (client.closing) return; client.closing = true; client.pending = null;
    // Release logical ownership at detection, not after an unresponsive peer's close reply.
    finish(client); client.socket.close(code, reason);
    const terminate = setTimeout(() => client.socket.terminate(), LIVE_LIMITS.shutdownMs); terminate.unref();
    client.socket.once('close', () => clearTimeout(terminate));
  }
  function fail(client: Client, error: unknown) {
    const known = error instanceof HttpError || error instanceof GameError;
    const code = error instanceof HttpError ? error.code : error instanceof GameError ? error.code.toUpperCase() : 'GAME_UNAVAILABLE';
    const terminal = error instanceof HttpError ? error.status < 500 : error instanceof GameError ? error.code !== 'unavailable' : false;
    const message = code === 'SERVER_EPOCH_CHANGED' ? 'Server restarted. Reclaim host control or request a fresh display link.'
      : terminal ? 'Live access changed or the message was invalid. Rejoin using the current game link.' : 'Local game storage is unavailable. Review recovery before further commands.';
    if (client.socket.readyState === WebSocket.OPEN) client.socket.send(JSON.stringify({ ...tag(client), type: 'error', code: known ? code : 'GAME_UNAVAILABLE', message, terminal }));
    close(client, terminal ? 1008 : 1011);
  }
  function send(client: Client, value: LiveServerMessage) {
    if (stopped || client.closing || client.socket.readyState !== WebSocket.OPEN) return;
    const data = JSON.stringify(value);
    if (Buffer.byteLength(data) > LIVE_LIMITS.serverBytes) { close(client, 1009, 'Snapshot exceeds live limit'); return; }
    if (client.socket.bufferedAmount + Buffer.byteLength(data) > LIVE_LIMITS.backlogBytes) { close(client, 1008, 'Live reader is too slow'); return; }
    if ((value.type === 'snapshot' || value.type === 'ready_status') && (client.sending || client.socket.bufferedAmount > 0)) {
      client.pending = data; client.blockedAt ??= performance.now(); return;
    }
    client.sending = true;
    client.socket.send(data, (error) => {
      client.sending = false;
      if (error) { close(client, 1011, 'Live write failed'); return; }
      if (client.closing || stopped) return;
      if (client.pending && client.socket.bufferedAmount === 0) {
        const pending = client.pending; client.pending = null; client.blockedAt = null;
        send(client, JSON.parse(pending) as LiveServerMessage);
      }
    });
  }
  function publish(client: Client) {
    if (!client.hello || client.closing) return;
    try {
      const observation = bridge.observe(client.hello);
      if (observation.role === 'host') {
        const snapshot = observation.state.snapshot;
        if (snapshot) client.hello.sessionId = snapshot.session.id;
        const readiness = JSON.stringify(observation.state.primaryDisplay);
        const type = client.lastRevision === (snapshot?.session.stateVersion ?? 0) && client.lastSession === (snapshot?.session.id ?? null) && readiness !== client.lastReadiness ? 'ready_status' : 'snapshot';
        client.lastRevision = snapshot?.session.stateVersion ?? 0; client.lastSession = snapshot?.session.id ?? null; client.lastReadiness = readiness;
        send(client, { ...tag(client), type, role: 'host', sequence: ++sequence, sessionId: snapshot?.session.id ?? null,
          stateVersion: snapshot?.session.stateVersion ?? 0, serverMonoMs: observation.serverMonoMs, state: observation.state });
      } else {
        const snapshot = observation.state.snapshot;
        const frame: LiveSnapshot = { ...tag(client), type: 'snapshot', role: 'display', sequence: ++sequence, sessionId: snapshot.sessionId,
          stateVersion: snapshot.stateVersion, serverMonoMs: observation.serverMonoMs, state: observation.state };
        send(client, frame);
      }
    } catch (error) { fail(client, error); }
  }
  function changed() {
    if (scheduled || stopped) return; scheduled = true;
    queueMicrotask(() => { scheduled = false; if (!stopped) for (const client of [...clients]) publish(client); });
  }
  const unsubscribe = bridge.subscribe(changed);
  function receive(client: Client, data: RawData, binary: boolean) {
    if (client.closing || stopped) return;
    try {
      const bytes = Array.isArray(data) ? Buffer.concat(data) : Buffer.isBuffer(data) ? data : Buffer.from(data);
      if (binary || bytes.length > LIVE_LIMITS.clientBytes) throw new Error('Invalid frame');
      const now = performance.now();
      if (now - client.frameWindow >= 1000) { client.frameWindow = now; client.frames = 0; }
      if (++client.frames > 30) throw new Error('Frame rate exceeded');
      const message = parseLiveClient(JSON.parse(bytes.toString()));
      if (!client.hello) {
        if (message.type !== 'hello') throw new Error('HELLO required');
        client.generation = bridge.connect(message); client.wireGeneration = message.role === 'display' ? client.generation : ++generation;
        client.hello = message; clearTimeout(client.helloTimer);
        const previous = owners.get(key(message)); owners.set(key(message), client);
        if (previous) close(previous, 1000, 'Live connection replaced');
        client.lastAck = now; publish(client); changed(); return;
      }
      if (message.type === 'hello' || message.serverEpoch !== bridge.serverEpoch || message.connectionSequence !== client.wireGeneration) throw new Error('Invalid connection generation');
      if (message.type === 'heartbeat_ack') {
        if (message.nonce !== client.heartbeat) throw new Error('Invalid heartbeat');
        bridge.acknowledge(client.hello); client.lastAck = now; client.heartbeat = null;
      } else if (message.type === 'clock_probe') {
        const sample = bridge.probe(client.hello, message.nonce);
        send(client, { ...tag(client), type: 'clock', ...sample });
      } else {
        const { roundId, imageKey, decoded, clock } = message;
        bridge.ready(client.hello, client.generation, { roundId, imageKey, decoded, clock });
      }
    } catch (error) { fail(client, error instanceof HttpError || error instanceof GameError ? error : new HttpError(400, 'INVALID_LIVE_MESSAGE', 'Invalid live message.')); }
  }
  wss.on('connection', (socket) => {
    const now = performance.now();
    const client: Client = { socket, hello: null, generation: 0, wireGeneration: 0, lastAck: now, lastPong: now, heartbeat: null,
      closing: false, sending: false, pending: null, blockedAt: null, frameWindow: now, frames: 0,
      lastRevision: -1, lastSession: null, lastReadiness: '',
      helloTimer: setTimeout(() => close(client, 1008, 'HELLO timed out'), LIVE_LIMITS.helloMs) };
    client.helloTimer.unref(); clients.add(client);
    socket.on('message', (data, binary) => receive(client, data, binary));
    socket.on('pong', () => { client.lastPong = performance.now(); });
    socket.on('close', () => finish(client));
    socket.on('error', () => close(client, 1008, 'Invalid or unavailable live connection'));
  });
  const heartbeat = setInterval(() => {
    const now = performance.now();
    for (const client of [...clients]) {
      if (!client.hello) continue;
      if (now - client.lastAck >= LIVE_LIMITS.staleMs || now - client.lastPong >= LIVE_LIMITS.staleMs) { close(client, 1008, 'Live heartbeat expired'); continue; }
      if (client.socket.bufferedAmount > 0 || client.pending) client.blockedAt ??= now; else client.blockedAt = null;
      if (client.socket.bufferedAmount > LIVE_LIMITS.backlogBytes || (client.blockedAt !== null && now - client.blockedAt >= LIVE_LIMITS.staleMs)) { close(client, 1008, 'Live reader is too slow'); continue; }
      client.socket.ping();
      if (!client.heartbeat) { client.heartbeat = randomUUID(); send(client, { ...tag(client), type: 'heartbeat', nonce: client.heartbeat }); }
      publish(client);
    }
  }, LIVE_LIMITS.heartbeatMs); heartbeat.unref();
  const onUpgrade = (request: http.IncomingMessage, socket: import('node:stream').Duplex, head: Buffer) => {
    let valid = false;
    try { const url = new URL(request.url ?? '', 'http://local.invalid'); valid = url.pathname === LIVE_PATH && !url.search && request.url === LIVE_PATH; } catch { /* Reject malformed paths before upgrade. */ }
    const status = stopped || wss.clients.size >= LIVE_LIMITS.clients ? 503 : !valid ? 404 : !request.headers.origin || !origins.has(request.headers.origin) || request.headers['sec-websocket-protocol'] !== LIVE_PROTOCOL ? 403 : 0;
    if (status) { socket.end(`HTTP/1.1 ${status} Rejected\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`); return; }
    socket.on('error', () => {});
    try { wss.handleUpgrade(request, socket, head, ws => wss.emit('connection', ws, request)); } catch { socket.destroy(); }
  };
  server.on('upgrade', onUpgrade);
  wss.on('error', () => { for (const client of [...clients]) close(client, 1011, 'Live transport unavailable'); });
  return {
    stop(immediate = false) {
      if (stopped) { if (immediate) for (const socket of wss.clients) socket.terminate(); return; }
      stopped = true; unsubscribe(); clearInterval(heartbeat); server.off('upgrade', onUpgrade);
      for (const client of [...clients]) close(client, 1001, 'Server shutting down');
      if (immediate) for (const socket of wss.clients) socket.terminate();
      else if (wss.clients.size) { shutdown = setTimeout(() => { for (const socket of wss.clients) socket.terminate(); shutdown = null; }, LIVE_LIMITS.shutdownMs); shutdown.unref(); }
      wss.close();
    },
  };
}
