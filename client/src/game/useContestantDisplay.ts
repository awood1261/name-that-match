import { useEffect, useState } from 'react';
import type { DisplayCredential } from '../../../shared/src/game/display';
import { displayApi } from './api';
import { openGameLive } from './live';
import type { DisplayLiveState } from '../../../shared/src/game/live';

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
  const [value, setValue] = useState<DisplayLiveState | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null); const [stale, setStale] = useState(true);
  const [remaining, setRemaining] = useState({ ms: 0, at: 0 }); const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!credential) return;
    let stopped = false; let imageKey: string | null = null; let blobUrl: string | null = null; let decoded = false;
    let imageController: AbortController | null = null; let imageFailure: string | null = null;
    setValue(null); setStale(true); setError(null); setImageUrl(null);
    const report = () => live.ready({ roundId: imageKey, imageKey, decoded });
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
        blobUrl = candidateUrl; candidateUrl = null; decoded = true; imageFailure = null; setImageUrl(blobUrl); report();
      } catch {
        if (!stopped && imageController === request) { decoded = false; imageFailure = 'Image unavailable or could not decode. Ask the host to cancel or review the clue.'; setError(imageFailure); report(); }
      } finally { clearTimeout(timeout); if (candidateUrl) URL.revokeObjectURL(candidateUrl); }
    }
    const live = openGameLive({ type: 'hello', protocolVersion: 1, role: 'display', token: credential.token, serverEpoch: credential.serverEpoch, displayId: credential.displayId, sessionId }, {
      snapshot(frame, timing) {
        if (stopped || frame.role !== 'display') return;
        const next = frame.state;
        setValue(next); setStale(!timing.synchronized); setError(imageFailure);
        const nextKey = next.asset?.imageKey ?? null;
        if (nextKey !== imageKey) { clearImage(); imageKey = nextKey; report(); if (next.asset) void loadImage(next.asset.roundId); }
        const ms = 'remainingMs' in next.snapshot ? next.snapshot.remainingMs ?? 0 : 0;
        setRemaining({ ms: Math.max(0, ms - (next.snapshot.phase === 'guessing' && timing.serverNow !== null ? Math.max(0, timing.serverNow - frame.serverMonoMs) : 0)), at: performance.now() });
      },
      unavailable(failure) { if (!stopped) { setStale(true); setError(failure.message); } },
      reset() { clearImage(); imageKey = null; },
    });
    return () => { stopped = true; live.close(); clearImage(); };

  }, [sessionId, credential, retry]);
  return { value, imageUrl, error, stale, remaining, retry: () => setRetry((n) => n + 1) };
}
