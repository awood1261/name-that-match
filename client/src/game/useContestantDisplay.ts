import { useEffect, useState } from 'react';
import type { DisplayCredential, DisplayObservation, DisplayReport } from '../../../shared/src/game/display';
import { clientId } from '../ids';
import { displayApi, GameApiError } from './api';
import { DisplayClock } from './clock';

export async function decodeClue(url: string, signal: AbortSignal): Promise<void> {
  const image = new Image(); image.src = url;
  await new Promise<void>((resolve, reject) => {
    const abort = () => { signal.removeEventListener('abort', abort); image.src = ''; reject(new Error('Image decode cancelled.')); };
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
    else image.decode().then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

export function readDisplayJoin(sessionId: string): DisplayCredential | null {
  const key = `ntm.display.${sessionId}`;
  try {
    const fragment = new URLSearchParams(location.hash.slice(1));
    const candidate = fragment.has('token') ? { token: fragment.get('token'), serverEpoch: fragment.get('epoch'), displayId: fragment.get('display') } : JSON.parse(sessionStorage.getItem(key) ?? 'null');
    if (fragment.has('token')) history.replaceState(null, '', location.pathname);
    if (!candidate || !/^[a-f0-9]{64}$/.test(candidate.token) || !/^[0-9a-f-]{36}$/.test(candidate.serverEpoch) || !/^[0-9a-f-]{36}$/.test(candidate.displayId)) return null;
    sessionStorage.setItem(key, JSON.stringify(candidate)); return candidate;
  } catch { return null; }
}

export function useContestantDisplay(sessionId: string, credential: DisplayCredential | null) {
  const [value, setValue] = useState<DisplayObservation | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null); const [stale, setStale] = useState(true);
  const [remaining, setRemaining] = useState({ ms: 0, at: 0 }); const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!credential) return;
    let stopped = false; let terminal = false; let connectionSequence = 0; let sequence = -1; let version = -1;
    let lastSeen = -Infinity; let current: DisplayObservation | null = null;
    let clockProof: { nonce: string; rttMs: number } | null = null;
    let imageKey: string | null = null; let blobUrl: string | null = null; let decoded = false;
    let imageController: AbortController | null = null; let imageFailure: string | null = null;
    let requestController: AbortController | null = null;
    const clock = new DisplayClock(); const connectionId = clientId();
    let timer: ReturnType<typeof setTimeout>;
    setValue(null); setStale(true); setError(null); setImageUrl(null);
    function clearImage() {
      imageController?.abort(); imageController = null; decoded = false; imageFailure = null;
      if (blobUrl) URL.revokeObjectURL(blobUrl); blobUrl = null; setImageUrl(null);
    }
    async function loadImage(roundId: string) {
      const request = imageController = new AbortController(); const timeout = setTimeout(() => request.abort(), 3000);
      let candidateUrl: string | null = null;
      try {
        const blob = await displayApi.image(credential!, sessionId, roundId, request.signal);
        if (stopped || imageController !== request) return;
        candidateUrl = URL.createObjectURL(blob); await decodeClue(candidateUrl, request.signal);
        if (stopped || request.signal.aborted || imageController !== request || imageKey !== roundId) return;
        blobUrl = candidateUrl; candidateUrl = null; decoded = true; imageFailure = null; setImageUrl(blobUrl);
      } catch {
        if (!stopped && imageController === request) { decoded = false; imageFailure = 'Image unavailable or could not decode. Ask the host to cancel or review the clue.'; setError(imageFailure); }
      } finally { clearTimeout(timeout); if (candidateUrl) URL.revokeObjectURL(candidateUrl); }
    }
    async function poll() {
      if (stopped || terminal) return;
      const request = requestController = new AbortController(); const timeout = setTimeout(() => request.abort(), 3000);
      const sentAt = performance.now();
      const report: DisplayReport = connectionSequence === 0 ? { type: 'connect', connectionId }
        : { type: 'status', connectionId, connectionSequence, roundId: imageKey, imageKey, decoded, clock: clockProof };
      try {
        const next = await displayApi.status(credential!, sessionId, report, request.signal); const receivedAt = performance.now();
        if (stopped || request.signal.aborted) return;
        if (next.serverEpoch !== credential!.serverEpoch) throw new GameApiError({ code: 'SERVER_EPOCH_CHANGED', message: 'Server restarted. Ask the host for a fresh display link.' }, 409);
        if (next.protocolVersion !== 1 || next.snapshot.sessionId !== sessionId || next.sequence < sequence || next.snapshot.stateVersion < version || (connectionSequence && next.connectionSequence !== connectionSequence)) throw new Error('Display synchronization changed. Rejoin using the host link.');
        connectionSequence = next.connectionSequence; sequence = next.sequence; version = next.snapshot.stateVersion;
        const synchronized = clock.observe(next.sample, sentAt, receivedAt);
        clockProof = { nonce: next.sample.nonce, rttMs: receivedAt - sentAt };
        lastSeen = receivedAt; current = next; setValue(next); setStale(!synchronized); setError(imageFailure);
        const nextKey = next.asset?.imageKey ?? null;
        if (nextKey !== imageKey) { clearImage(); imageKey = nextKey; if (next.asset) void loadImage(next.asset.roundId); }
        const serverNow = clock.serverNow(receivedAt);
        const ms = 'remainingMs' in next.snapshot ? next.snapshot.remainingMs : 0;
        setRemaining({ ms: Math.max(0, ms - (next.snapshot.phase === 'guessing' && serverNow !== null ? Math.max(0, serverNow - next.sample.serverMonoMs) : 0)), at: receivedAt });
      } catch (failure) {
        if (stopped) return;
        setStale(true); setError(failure instanceof GameApiError && failure.status === 401 ? 'Display access expired. Ask the host for a fresh contestant display link.' : failure instanceof Error ? failure.message : 'Display disconnected. Waiting for the local server.');
        if (failure instanceof GameApiError && [401, 403, 404, 409].includes(failure.status)) { terminal = true; clearImage(); }
      } finally {
        clearTimeout(timeout);
        if (!stopped && !terminal) timer = setTimeout(() => { void poll(); }, current && ['ready', 'guessing', 'paused', 'awaiting_judgment'].includes(current.snapshot.phase) ? 200 : 1000);
      }
    }
    timer = setTimeout(() => { void poll(); }, 0);
    const watch = setInterval(() => { if (performance.now() - lastSeen > 3000 || clock.serverNow(performance.now()) === null) setStale(true); }, 100);
    return () => { stopped = true; clearTimeout(timer); clearInterval(watch); requestController?.abort(); clearImage(); };
  }, [sessionId, credential, retry]);
  return { value, imageUrl, error, stale, remaining, retry: () => setRetry((n) => n + 1) };
}
