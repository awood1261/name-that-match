import { LIVE_LIMITS, LIVE_PATH, LIVE_PROTOCOL, parseLiveServer, type LiveClientMessage, type LiveHello, type LiveReady, type LiveSnapshot } from '../../../shared/src/game/live';
import { clientId } from '../ids';
import { GameApiError } from './api';
import { DisplayClock } from './clock';

export type LiveJoin = Omit<Extract<LiveHello, { role: 'host' }>, 'connectionId'> | Omit<Extract<LiveHello, { role: 'display' }>, 'connectionId'>;
export interface LiveTiming { synchronized: boolean; serverNow: number | null }
export interface LiveCallbacks {
  snapshot: (value: LiveSnapshot, timing: LiveTiming) => void;
  unavailable: (error: Error, terminal: boolean) => void;
  reset?: () => void;
}

/** One owned observation channel for both roles/modes. It never sends a game command. */
export function openGameLive(join: LiveJoin, callbacks: LiveCallbacks) {
  let stopped = false; let terminal = false; let socket: WebSocket | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null; let retry = 0; let attempt = 0;
  let interval: ReturnType<typeof setInterval> | null = null;
  let connectionSequence = 0; let sequence = -1; let current: LiveSnapshot | null = null;
  let clock = new DisplayClock(); let lastSeen = 0; let openedAt = 0;
  let synchronized = false;
  let pendingProbe: { nonce: string; sentAt: number } | null = null;
  let proof: LiveReady['clock'] = null;
  let readiness: Omit<LiveReady, 'clock'> = { roundId: null, imageKey: null, decoded: false };
  const tag = () => ({ protocolVersion: 1 as const, serverEpoch: join.serverEpoch, connectionSequence });
  function send(message: LiveClientMessage) {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  }
  function ready() { if (join.role === 'display' && connectionSequence) send({ ...tag(), type: 'display_ready', ...readiness, clock: proof }); }
  function emit() {
    if (current) { const serverNow = clock.serverNow(performance.now()); callbacks.snapshot(current, { synchronized: synchronized && serverNow !== null, serverNow }); }
  }
  function reconnect(error: Error, fatal = false) {
    if (stopped || terminal) return;
    terminal = fatal; const old = socket; socket = null; ++attempt;
    if (interval) clearInterval(interval); interval = null;
    old?.close(); callbacks.unavailable(error, fatal); callbacks.reset?.();
    current = null; connectionSequence = 0; sequence = -1; proof = null; pendingProbe = null; clock = new DisplayClock(); synchronized = false;
    readiness = { roundId: null, imageKey: null, decoded: false };
    if (!fatal) {
      const delay = Math.min(5000, 250 * 2 ** Math.min(retry++, 5)) + Math.floor(Math.random() * 100);
      timer = setTimeout(connect, Math.min(5000, delay));
    }
  }
  function probe() {
    if (!connectionSequence || pendingProbe) return;
    pendingProbe = { nonce: clientId(), sentAt: performance.now() }; send({ ...tag(), type: 'clock_probe', nonce: pendingProbe.nonce });
  }
  function connect() {
    if (stopped || terminal) return;
    const ownAttempt = ++attempt; connectionSequence = 0; openedAt = lastSeen = performance.now();
    const url = new URL(LIVE_PATH, location.origin); url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    let owned: WebSocket;
    try { owned = new WebSocket(url, LIVE_PROTOCOL); socket = owned; }
    catch { reconnect(new Error('Live connection unavailable. Waiting to reconnect.')); return; }
    const active = () => !stopped && !terminal && socket === owned && attempt === ownAttempt;
    owned.onopen = () => { if (active()) send({ ...join, connectionId: clientId() }); };
    owned.onmessage = (event) => {
      if (!active()) return;
      try {
        if (typeof event.data !== 'string' || new TextEncoder().encode(event.data).length > LIVE_LIMITS.serverBytes) throw new Error('Invalid live frame');
        const frame = parseLiveServer(JSON.parse(event.data));
        if (frame.serverEpoch !== join.serverEpoch) { reconnect(new GameApiError({ code: 'SERVER_EPOCH_CHANGED', message: 'Server restarted. Reclaim host control or ask for a fresh contestant link.' }, 409), true); return; }
        if (connectionSequence && frame.connectionSequence !== connectionSequence) return;
        if (frame.type === 'error') { reconnect(new GameApiError({ code: frame.code, message: frame.message }, frame.terminal ? 401 : 503), frame.terminal); return; }
        if (!connectionSequence && frame.type !== 'snapshot') throw new Error('Initial snapshot required');
        if (frame.type === 'snapshot' || frame.type === 'ready_status') {
          if (frame.role !== join.role || (join.role === 'display' && frame.sessionId !== join.sessionId)) throw new Error('Wrong live role/session');
          if (frame.sequence <= sequence || (current?.sessionId === frame.sessionId && frame.stateVersion < current.stateVersion)) return;
          lastSeen = performance.now();
          // Equal revisions may refresh timing/readiness, never rewrite the domain snapshot.
          if (current?.sessionId === frame.sessionId && current.stateVersion === frame.stateVersion) {
            if (frame.role === 'host' && current.role === 'host') frame.state.snapshot = current.state.snapshot;
            if (frame.role === 'display' && current.role === 'display') {
              const before = current.state.snapshot; const after = frame.state.snapshot;
              frame.state.snapshot = before.phase === 'guessing' && after.phase === 'guessing' ? { ...before, remainingMs: after.remainingMs } : before;
            }
          }
          const first = !connectionSequence;
          connectionSequence = frame.connectionSequence; sequence = frame.sequence; current = frame; retry = 0; emit(); if (first) probe();
        } else if (frame.type === 'heartbeat') { lastSeen = performance.now(); send({ ...tag(), type: 'heartbeat_ack', nonce: frame.nonce }); }
        else if (frame.type === 'clock' && frame.nonce === pendingProbe?.nonce) {
          const now = lastSeen = performance.now(); proof = { nonce: frame.nonce, rttMs: now - pendingProbe.sentAt };
          synchronized = clock.observe(frame, pendingProbe.sentAt, now); pendingProbe = null; ready(); emit();
        }
      } catch { reconnect(new Error('Live synchronization was invalid. Reload or retry the current game connection.'), true); }
    };
    owned.onclose = (event) => {
      if (!active()) return;
      const replaced = event.reason === 'Live connection replaced';
      reconnect(new Error(replaced ? 'This display connection was replaced. Rejoin deliberately from the host.' : 'Live connection lost. Waiting to reconnect.'), replaced || event.code === 1009);
    };
    owned.onerror = () => { if (active()) reconnect(new Error('Live connection unavailable. Waiting to reconnect.')); };
    let lastProbe = 0;
    interval = setInterval(() => {
      if (!active()) return;
      const now = performance.now();
      if (now - lastSeen > LIVE_LIMITS.staleMs || (now - openedAt > LIVE_LIMITS.staleMs && join.role === 'display' && clock.serverNow(now) === null)) {
        reconnect(new Error('Live synchronization is stale. Clue covered while reconnecting.')); return;
      }
      if (now - lastProbe >= LIVE_LIMITS.heartbeatMs) { lastProbe = now; probe(); }
    }, 100);
  }
  timer = setTimeout(connect, 0);
  return {
    ready(value: Omit<LiveReady, 'clock'>) { readiness = value; ready(); },
    close() {
      stopped = true; ++attempt;
      if (timer) clearTimeout(timer); if (interval) clearInterval(interval);
      const old = socket; socket = null;
      if (old) { old.onopen = null; old.onmessage = null; old.onclose = null; old.onerror = null; old.close(); }
      current = null; pendingProbe = null; proof = null;
    },
  };
}
