import { useCallback, useEffect, useRef, useState } from 'react';
import type { CommandEnvelope, CreateGame, HostIntent } from '../../../shared/src/game/contracts';
import type { ControllerCredential, HostStatus } from '../../../shared/src/game/host';
import { parseCommand } from '../../../shared/src/game/validation';
import { clientId } from '../ids';
import { gameApi, GameApiError } from './api';

const CONTROL_KEY = 'ntm.game.controller'; const PENDING_KEY = 'ntm.game.pending';
type Pending = { kind: 'create'; input: CreateGame } | { kind: 'command'; input: CommandEnvelope };
function saved<T>(key: string): T | null { try { const value = sessionStorage.getItem(key); return value ? JSON.parse(value) as T : null; } catch { return null; } }
function store(key: string, value: unknown) { try { if (value === null) sessionStorage.removeItem(key); else sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* Current-tab operation remains available; no persistent secret in server history. */ } }
const message = (error: unknown) => error instanceof Error ? error.message : 'Unable to contact the local game server.';

export function useGameHost() {
  const [status, setStatus] = useState<HostStatus | null>(null);
  const [credential, setCredential] = useState<ControllerCredential | null>(null);
  const [connected, setConnected] = useState(false); const transportLost = useRef(false);
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
    if (mutation.current) return; mutation.current = true; setLoading(true); setError(null);
    const life = lifetime.current; const signal = life.signal;
    try {
      let owner = saved<ControllerCredential>(CONTROL_KEY);
      if (owner) {
        try { await gameApi.renew(owner, signal); }
        catch (failure) { if (!(failure instanceof GameApiError) || failure.status !== 401) throw failure; owner = null; store(CONTROL_KEY, null); }
      }
      if (!owner) owner = await gameApi.claim(signal);
      if (!active.current || lifetime.current !== life) return;
      currentCredential.current = owner; setCredential(owner); store(CONTROL_KEY, owner); latest.current = null;
      accept(await gameApi.current(owner, signal), owner);
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
    let stopped = false; let timer: ReturnType<typeof setTimeout>; let renewal = false; let reading = false;
    const pollingLife = new AbortController(); const signal = pollingLife.signal;
    const read = async () => {
      if (stopped || reading) return;
      reading = true;
      try { accept(await gameApi.current(credential, signal), credential); }
      catch (failure) { if (!signal.aborted) controlError(failure, credential); }
      finally {
        reading = false;
        if (!stopped) timer = setTimeout(() => { void read(); }, latest.current?.snapshot?.currentRound?.phase === 'preparing' ? 200 : 1000);
      }
    };
    timer = setTimeout(() => { void read(); }, 200);
    const heartbeat = setInterval(() => {
      if (renewal) return; renewal = true;
      void gameApi.renew(credential, signal).catch((failure) => { if (!signal.aborted) controlError(failure, credential); }).finally(() => { renewal = false; });
    }, 1000);
    return () => { stopped = true; pollingLife.abort(); clearTimeout(timer); clearInterval(heartbeat); };
  }, [credential, accept, controlError]);
  async function send(request: Pending) {
    const owner = currentCredential.current; const life = lifetime.current;
    if (!owner || mutation.current) return;
    mutation.current = true; setBusy(true); setError(null); setNotice(null); setRetryable(false); setReviewedPending(false); savePending(request);
    try {
      const response = request.kind === 'create' ? await gameApi.create(owner, request.input, lifetime.current.signal) : await gameApi.command(owner, request.input, lifetime.current.signal);
      if (!active.current || lifetime.current !== life || currentCredential.current !== owner) return;
      accept(response.status, owner); savePending(null); setNotice(request.kind === 'create' ? 'Session created. Review the setup, then start when ready.' : 'Command saved.');
    } catch (failure) {
      if (!active.current || lifetime.current !== life || life.signal.aborted) return;
      if (failure instanceof GameApiError && failure.status < 500) {
        if (![401, 403].includes(failure.status) && failure.detail.code !== 'SERVER_EPOCH_CHANGED') savePending(null);
        controlError(failure, owner);
        try { accept(await gameApi.current(owner, lifetime.current.signal), owner); } catch { /* original error stays visible */ }
      } else setError('The request outcome is unknown. Check command status before retrying.');
    } finally { if (lifetime.current === life) { mutation.current = false; if (active.current) setBusy(false); } }
  }
  function command(intent: HostIntent) {
    if (pending || !latest.current?.snapshot || mutation.current) return;
    const session = latest.current.snapshot.session; const { type, ...payload } = intent;
    const isSession = ['CONFIGURE_SETUP', 'START', 'DISCARD_SETUP', 'SELECT_CONTESTANT', 'PREPARE'].includes(type);
    const input = parseCommand({ protocolVersion: 1, commandId: clientId(), sessionId: session.id, expectedStateVersion: session.stateVersion, type, payload,
      ...(!isSession && session.currentRoundId ? { roundId: session.currentRoundId } : {}) });
    void send({ kind: 'command', input });
  }
  function setup(names: string[], startingIndex: number) {
    if (pending || mutation.current) return;
    const contestants = names.map((name, i) => ({ id: latest.current?.snapshot?.session.contestants[i]?.id ?? clientId(), name }));
    const activeContestantId = contestants[startingIndex].id;
    if (latest.current?.snapshot) command({ type: 'CONFIGURE_SETUP', contestants, activeContestantId });
    else void send({ kind: 'create', input: { protocolVersion: 1, commandId: clientId(), sessionId: clientId(), contestants, activeContestantId } });
  }
  async function checkPending() {
    const owner = currentCredential.current; const life = lifetime.current; if (!owner || !pending || mutation.current) return;
    mutation.current = true; setBusy(true); setRetryable(false);
    try {
      const response = await gameApi.receipt(owner, pending.input.sessionId, pending.input.commandId, lifetime.current.signal);
      accept(response.status, owner); savePending(null); setError(null); setNotice('The previous command was accepted. Current state restored.');
    } catch (failure) {
      if (failure instanceof GameApiError && failure.status === 404) {
        try {
          const value = await gameApi.current(owner, lifetime.current.signal); accept(value, owner);
          const safe = pending.kind === 'create' ? !value.snapshot : value.snapshot?.session.id === pending.input.sessionId && value.snapshot.session.stateVersion === pending.input.expectedStateVersion;
          setReviewedPending(true); setRetryable(safe); setError(safe ? 'No accepted receipt was found. Review current state, then deliberately retry the original request.' : 'No receipt found and state changed. Keep the current session; dismiss this request after review.');
        } catch (error) { controlError(error, owner); }
      } else controlError(failure, owner);
    } finally { if (lifetime.current === life) { mutation.current = false; if (active.current) setBusy(false); } }
  }
  async function refresh() {
    const owner = currentCredential.current; const life = lifetime.current; if (!owner || mutation.current) return;
    mutation.current = true; setBusy(true);
    try { accept(await gameApi.current(owner, lifetime.current.signal, true), owner); setError(null); }
    catch (failure) { controlError(failure, owner); }
    finally { if (lifetime.current === life) { mutation.current = false; if (active.current) setBusy(false); } }
  }
  async function release() {
    const owner = currentCredential.current; const life = lifetime.current; if (!owner || mutation.current || pending) return;
    mutation.current = true; setBusy(true);
    try { await gameApi.release(owner, lifetime.current.signal); store(CONTROL_KEY, null); currentCredential.current = null; setCredential(null); setNotice('Host control released.'); }
    catch (failure) { controlError(failure, owner); }
    finally { if (lifetime.current === life) { mutation.current = false; if (active.current) setBusy(false); } }
  }
  return { status, credential, connected, loading, busy, error, notice, pending: !!pending, retryable, setup, command, connect, refresh, release,
    checkPending, reviewedPending, retry: () => { if (pending && retryable) void send(pending); }, dismissPending: () => { if (!reviewedPending) return; savePending(null); setRetryable(false); setError(null); } };
}
