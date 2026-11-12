import { vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import * as transport from '../../client/src/game/live';
import { displayApi, gameApi, GameApiError } from '../../client/src/game/api';
import type { DisplayReport } from '../../shared/src/game/display';
import type { LiveReady, LiveSnapshot } from '../../shared/src/game/live';

/** Existing component fixtures drive a fake observation channel, not a production HTTP fallback.
 * Real socket behavior has independent protocol, client-adapter and local socket integration tests. */
export function mockGameLive() {
  vi.spyOn(transport, 'openGameLive').mockImplementation((join, callbacks) => {
    let stopped = false; let terminal = false; let timer: ReturnType<typeof setTimeout>;
    let connected = false; let sequence = 0; let lastSession = join.sessionId;
    let readiness: Omit<LiveReady, 'clock'> = { roundId: null, imageKey: null, decoded: false };
    const lifetime = new AbortController(); const connectionId = randomUUID();
    async function observe() {
      if (stopped || terminal) return;
      try {
        let frame: LiveSnapshot;
        if (join.role === 'host') {
          const owner = { token: join.token, serverEpoch: join.serverEpoch, generation: 1 };
          let status = await gameApi.current(owner, lifetime.signal);
          if (!status.snapshot && lastSession) status = await gameApi.session(owner, lastSession, lifetime.signal);
          if (status.snapshot) lastSession = status.snapshot.session.id;
          frame = { type: 'snapshot', role: 'host', protocolVersion: 1, serverEpoch: status.serverEpoch, connectionSequence: 1, sequence: ++sequence,
            sessionId: status.snapshot?.session.id ?? null, stateVersion: status.snapshot?.session.stateVersion ?? 0, serverMonoMs: performance.now(), state: status };
        } else {
          const report: DisplayReport = !connected ? { type: 'connect', connectionId } : { type: 'status', connectionId, connectionSequence: 1, ...readiness, clock: null };
          const next = await displayApi.status({ token: join.token, serverEpoch: join.serverEpoch, displayId: join.displayId }, join.sessionId, report, lifetime.signal);
          if (next.serverEpoch !== join.serverEpoch) throw new GameApiError({ code: 'SERVER_EPOCH_CHANGED', message: 'Server restarted. Ask for a fresh display link.' }, 409);
          connected = true;
          frame = { type: 'snapshot', role: 'display', protocolVersion: 1, serverEpoch: next.serverEpoch, connectionSequence: next.connectionSequence, sequence: next.sequence,
            sessionId: next.snapshot.sessionId, stateVersion: next.snapshot.stateVersion, serverMonoMs: next.sample.serverMonoMs, state: { snapshot: next.snapshot, asset: next.asset } };
        }
        if (!stopped) callbacks.snapshot(frame, { synchronized: true, serverNow: frame.serverMonoMs });
      } catch (error) {
        if (stopped) return;
        terminal = error instanceof GameApiError && [401, 403, 404, 409].includes(error.status);
        callbacks.unavailable(error as Error, terminal); callbacks.reset?.(); readiness = { roundId: null, imageKey: null, decoded: false };
      } finally { if (!stopped && !terminal) timer = setTimeout(() => { void observe(); }, 200); }
    }
    timer = setTimeout(() => { void observe(); }, 0);
    return { ready(value) { readiness = value; }, close() { stopped = true; lifetime.abort(); clearTimeout(timer); } };
  });
}
