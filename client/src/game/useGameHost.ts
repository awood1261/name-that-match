import { useCallback, useEffect, useRef, useState } from 'react';
import type { CommandEnvelope, CreateGame, HostIntent } from '../../../shared/src/game/contracts';
import type { ControllerCredential, HostStatus } from '../../../shared/src/game/host';
import { id, parseCommand } from '../../../shared/src/game/validation';
import { clientId } from '../ids';
import { gameApi, GameApiError } from './api';
import { openGameLive } from './live';

const CONTROL_KEY = 'ntm.game.controller'; const PENDING_KEY = 'ntm.game.pending'; const OBSERVED_SESSION_KEY = 'ntm.game.observedSession';
type Pending = { kind: 'create'; input: CreateGame } | { kind: 'command'; input: CommandEnvelope };
function saved<T>(key: string): T | null { try { const value = sessionStorage.getItem(key); return value ? JSON.parse(value) as T : null; } catch { return null; } }
function store(key: string, value: unknown) { try { if (value === null) sessionStorage.removeItem(key); else sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* Current-tab operation remains available; no persistent secret in server history. */ } }
const message = (error: unknown) => error instanceof Error ? error.message : 'Unable to contact the local game server.';

/** Keep final totals visible using the existing read endpoint, without creating/resuming a game. */
async function observedStatus(owner: ControllerCredential, signal: AbortSignal, refresh = false): Promise<HostStatus> {
  const current = await gameApi.current(owner, signal, refresh);
  if (current.snapshot) return current;
  let sessionId: string;
  try { sessionId = id(saved<unknown>(OBSERVED_SESSION_KEY)); }
  catch { store(OBSERVED_SESSION_KEY, null); return current; }
  try {
    const previous = await gameApi.session(owner, sessionId, signal);
    if (previous.snapshot?.session.status === 'completed') return previous;
  } catch (failure) { if (!(failure instanceof GameApiError) || failure.status !== 404) throw failure; }
  store(OBSERVED_SESSION_KEY, null); return current;
}

export function useGameHost() {
  const [status, setStatus] = useState<HostStatus | null>(null);
  const [credential, setCredential] = useState<ControllerCredential | null>(null);
  const [connected, setConnected] = useState(false); const transportLost = useRef(false);
  const [released, setReleased] = useState(false);
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null); const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(() => saved(PENDING_KEY)); const [retryable, setRetryable] = useState(false); const [reviewedPending, setReviewedPending] = useState(false);
  const active = useRef(false); const lifetime = useRef(new AbortController()); const currentCredential = useRef<ControllerCredential | null>(null);
  const latest = useRef<HostStatus | null>(null); const mutation = useRef(false);
  const savePending = (value: Pending | null) => { store(PENDING_KEY, value); if (active.current) setPending(value); };
  const accept = useCallback((value: HostStatus, owner: ControllerCredential) => {
    if (!active.current || currentCredential.current !== owner || value.serverEpoch !== owner.serverEpoch) return;
    const before = latest.current;
    if (before && before.serverEpoch === value.serverEpoch && (before.sequence > value.sequence
      || (before.snapshot?.session.id === value.snapshot?.session.id && (before.snapshot?.session.stateVersion ?? 0) > (value.snapshot?.session.stateVersion ?? 0)))) return;
    latest.current = value; setStatus(value); setConnected(true);
    store(OBSERVED_SESSION_KEY, value.snapshot && value.snapshot.session.status !== 'discarded' ? value.snapshot.session.id : null);
    if (transportLost.current && !saved(PENDING_KEY)) setError(null); transportLost.current = false;
  }, []);
  const controlError = useCallback((failure: unknown, owner: ControllerCredential) => {
    if (!active.current || currentCredential.current !== owner) return;
    setError(message(failure));
    if (!(failure instanceof GameApiError) || failure.status >= 500 || [401, 403].includes(failure.status)) { setConnected(false); transportLost.current = true; }
    if (failure instanceof GameApiError && (failure.status === 401 || failure.status === 403 || failure.detail.code === 'SERVER_EPOCH_CHANGED')) {
      currentCredential.current = null; setCredential(null); store(CONTROL_KEY, null);
    }
  }, []);
  const connect = useCallback(async () => {
    if (mutation.current) return; mutation.current = true; setLoading(true); setError(null); setNotice(null);
    const life = lifetime.current; const signal = life.signal;
    try {
      let owner = saved<ControllerCredential>(CONTROL_KEY);
      if (owner) {
        try { await gameApi.renew(owner, signal); }
        catch (failure) { if (!(failure instanceof GameApiError) || failure.status !== 401) throw failure; owner = null; store(CONTROL_KEY, null); }
      }
      if (!owner) owner = await gameApi.claim(signal);
      if (!active.current || lifetime.current !== life) return;
      currentCredential.current = owner; setReleased(false); store(CONTROL_KEY, owner); latest.current = null;
      const restored = await observedStatus(owner, signal); accept(restored, owner);
      if (!active.current || lifetime.current !== life) return;
      setCredential(owner);
      if (restored.snapshot) {
        const phase = restored.snapshot.currentRound?.phase;
        setNotice(phase === 'interrupted' ? 'Recovered interrupted round. Its unknown remaining time cannot restart; explicitly void it.'
          : phase === 'paused' ? 'Recovered paused round. Its saved remainder is preserved; reconnect the primary display and explicitly Resume.'
          : 'Recovered saved game. Review its current state before continuing; no round or score was replayed.');
      }
      if (saved(PENDING_KEY)) setError('A previous request has an uncertain outcome. Check command status before sending another command.');
    } catch (failure) { if (active.current && lifetime.current === life && !signal.aborted) setError(message(failure)); }
    finally { if (lifetime.current === life) { mutation.current = false; if (active.current) setLoading(false); } }
  }, [accept]);
  useEffect(() => {
    active.current = true; lifetime.current = new AbortController(); mutation.current = false;
    const timer = setTimeout(() => { void connect(); }, 0);
    return () => { clearTimeout(timer); active.current = false; lifetime.current.abort(); currentCredential.current = null; };
  }, [connect]);
  useEffect(() => {
    if (!credential) return;
    const life = lifetime.current;
    const observed = latest.current?.snapshot?.session.id ?? saved<string>(OBSERVED_SESSION_KEY);
    const live = openGameLive({ type: 'hello', protocolVersion: 1, role: 'host', token: credential.token, serverEpoch: credential.serverEpoch, sessionId: observed }, {
      snapshot(frame) { if (frame.role === 'host') accept(frame.state, credential); },
      unavailable(failure) {
        if (!active.current || lifetime.current !== life || currentCredential.current !== credential) return;
        setConnected(false); transportLost.current = true; controlError(failure, credential);
      },
    });
    return () => live.close();
  }, [credential, accept, controlError]);

  async function send(request: Pending): Promise<boolean> {
    const owner = currentCredential.current; const life = lifetime.current;
    if (!owner || mutation.current) return false;
    mutation.current = true; setBusy(true); setError(null); setNotice(null); setRetryable(false); setReviewedPending(false); savePending(request);
    try {
      const response = request.kind === 'create' ? await gameApi.create(owner, request.input, lifetime.current.signal) : await gameApi.command(owner, request.input, lifetime.current.signal);
      if (!active.current || lifetime.current !== life || currentCredential.current !== owner) return false;
      accept(response.status, owner); savePending(null); setNotice(request.kind === 'create' ? 'Session created. Review the setup, then start when ready.' : 'Command saved.');
      return true;
    } catch (failure) {
      if (!active.current || lifetime.current !== life || life.signal.aborted || currentCredential.current !== owner) return false;
      if (failure instanceof GameApiError && failure.status < 500) {
        if (![401, 403].includes(failure.status) && failure.detail.code !== 'SERVER_EPOCH_CHANGED') savePending(null);
        controlError(failure, owner);
        try { accept(await observedStatus(owner, lifetime.current.signal), owner); } catch { /* original error stays visible */ }
      } else setError('The request outcome is unknown. Check command status before retrying.');
    } finally { if (lifetime.current === life) { mutation.current = false; if (active.current) setBusy(false); } }
    return false;
  }
  function command(intent: HostIntent) {
    if (pending || !latest.current?.snapshot || mutation.current) return Promise.resolve(false);
    const session = latest.current.snapshot.session; const { type, ...payload } = intent;
    const isSession = ['CONFIGURE_SETUP', 'START', 'DISCARD_SETUP', 'SELECT_CONTESTANT', 'PREPARE'].includes(type);
    const input = parseCommand({ protocolVersion: 1, commandId: clientId(), sessionId: session.id, expectedStateVersion: session.stateVersion, type, payload,
      ...(!isSession && session.currentRoundId ? { roundId: session.currentRoundId } : {}) });
    return send({ kind: 'command', input });
  }
  function setup(names: string[], startingIndex: number) {
    if (pending || mutation.current) return;
    const contestants = names.map((name, i) => ({ id: latest.current?.snapshot?.session.contestants[i]?.id ?? clientId(), name }));
    const activeContestantId = contestants[startingIndex].id;
    if (latest.current?.snapshot) command({ type: 'CONFIGURE_SETUP', contestants, activeContestantId });
    else void send({ kind: 'create', input: { protocolVersion: 1, commandId: clientId(), sessionId: clientId(), contestants, activeContestantId } });
  }
  function newGame() {
    const previous = latest.current?.snapshot?.session;
    if (pending || mutation.current || !connected || !previous || !['completed', 'discarded'].includes(previous.status)) return;
    const contestants = previous.contestants.map((p) => ({ id: clientId(), name: p.name }));
    const startingIndex = Math.max(0, previous.contestants.findIndex((p) => p.id === previous.activeContestantId));
    void send({ kind: 'create', input: { protocolVersion: 1, commandId: clientId(), sessionId: clientId(), contestants, activeContestantId: contestants[startingIndex].id } });
  }
  async function checkPending() {
    const owner = currentCredential.current; const life = lifetime.current; if (!owner || !pending || mutation.current) return;
    mutation.current = true; setBusy(true); setRetryable(false);
    try {
      const response = await gameApi.receipt(owner, pending.input.sessionId, pending.input.commandId, lifetime.current.signal);
      if (!active.current || lifetime.current !== life || currentCredential.current !== owner) return;
      accept(response.status, owner);
      const value = await observedStatus(owner, life.signal);
      if (!active.current || lifetime.current !== life || currentCredential.current !== owner) return;
      accept(value, owner); savePending(null); setError(null); setNotice('The previous command was accepted. Current state restored.');
    } catch (failure) {
      if (!active.current || lifetime.current !== life || life.signal.aborted || currentCredential.current !== owner) return;
      if (failure instanceof GameApiError && failure.status === 404) {
        try {
          const value = await observedStatus(owner, lifetime.current.signal);
          if (!active.current || lifetime.current !== life || currentCredential.current !== owner) return;
          accept(value, owner);
          const safe = pending.kind === 'create' ? !value.snapshot || ['completed', 'discarded'].includes(value.snapshot.session.status) : value.snapshot?.session.id === pending.input.sessionId && value.snapshot.session.stateVersion === pending.input.expectedStateVersion;
          setReviewedPending(true); setRetryable(safe); setError(safe ? 'No accepted receipt was found. Review current state, then deliberately retry the original request.' : 'No receipt found and state changed. Keep the current session; dismiss this request after review.');
        } catch (error) { controlError(error, owner); }
      } else controlError(failure, owner);
    } finally { if (lifetime.current === life) { mutation.current = false; if (active.current) setBusy(false); } }
  }
  async function prepareToLeave(): Promise<boolean> {
    const owner = currentCredential.current; const life = lifetime.current;
    if (!owner || mutation.current || saved(PENDING_KEY)) return false;
    mutation.current = true; setBusy(true);
    try {
      const value = await observedStatus(owner, life.signal);
      if (!active.current || lifetime.current !== life || currentCredential.current !== owner) return false;
      accept(value, owner);
    } catch (failure) { controlError(failure, owner); return false; }
    finally { if (lifetime.current === life) { mutation.current = false; if (active.current) setBusy(false); } }
    if (latest.current?.snapshot?.session.status === 'active' && latest.current.snapshot.currentRound?.phase === 'guessing') {
      if (!await command({ type: 'PAUSE' })) return false;
    }
    return active.current && lifetime.current === life && currentCredential.current === owner && !saved(PENDING_KEY)
      && latest.current?.snapshot?.currentRound?.phase !== 'guessing';
  }
  async function refresh() {
    const owner = currentCredential.current; const life = lifetime.current; if (!owner || mutation.current) return;
    mutation.current = true; setBusy(true);
    try { accept(await observedStatus(owner, lifetime.current.signal, true), owner); setError(null); }
    catch (failure) { controlError(failure, owner); }
    finally { if (lifetime.current === life) { mutation.current = false; if (active.current) setBusy(false); } }
  }
  async function release() {
    const owner = currentCredential.current; const life = lifetime.current; if (!owner || mutation.current || pending) return;
    mutation.current = true; setBusy(true);
    try { await gameApi.release(owner, lifetime.current.signal); store(CONTROL_KEY, null); currentCredential.current = null; setCredential(null); setReleased(true); setNotice('Host control released.'); }
    catch (failure) { controlError(failure, owner); }
    finally { if (lifetime.current === life) { mutation.current = false; if (active.current) setBusy(false); } }
  }
  return { status, credential, connected, released, loading, busy, error, notice, pending: !!pending, retryable, setup, newGame, command, connect, refresh, release, prepareToLeave,
    checkPending, reviewedPending, retry: () => { if (pending && retryable) void send(pending); }, dismissPending: () => { if (!reviewedPending) return; savePending(null); setRetryable(false); setError(null); } };
}
