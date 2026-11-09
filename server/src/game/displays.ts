import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import type { ClockSample, DisplayReport, PrimaryDisplayStatus } from '../../../shared/src/game/display.js';
import { id, record } from '../../../shared/src/game/validation.js';
import { HttpError } from '../library/http/protocol.js';

interface Viewer {
  id: string; token: string; sessionId: string; connectionId: string | null; generation: number;
  previous: Set<string>; lastSeen: number; decodedRound: string | null; clockAt: number;
  sample: ClockSample | null; notified: boolean;
}
const bad = () => new HttpError(400, 'INVALID_DISPLAY_STATUS', 'Invalid display readiness or clock observation.');
export function parseDisplayReport(input: unknown): DisplayReport {
  const value = record(input, ['type', 'connectionId', 'connectionSequence', 'roundId', 'imageKey', 'decoded', 'clock']);
  const connectionId = id(value.connectionId);
  if (value.type === 'connect') {
    record(input, ['type', 'connectionId']); return { type: 'connect', connectionId };
  }
  if (value.type !== 'status' || !Number.isSafeInteger(value.connectionSequence) || (value.connectionSequence as number) < 1 || typeof value.decoded !== 'boolean') throw bad();
  const roundId = value.roundId === null ? null : id(value.roundId); const imageKey = value.imageKey === null ? null : id(value.imageKey);
  let clock: { nonce: string; rttMs: number } | null = null;
  if (value.clock !== null) {
    const sample = record(value.clock, ['nonce', 'rttMs']);
    if (typeof sample.rttMs !== 'number' || !Number.isFinite(sample.rttMs) || sample.rttMs < 0 || sample.rttMs > 60_000) throw bad();
    clock = { nonce: id(sample.nonce), rttMs: sample.rttMs };
  }
  return { type: 'status', connectionId, connectionSequence: value.connectionSequence as number, roundId, imageKey, decoded: value.decoded, clock };
}

/** Readiness/liveness observations only; all game transitions remain in GameService. */
export class GameDisplays {
  private viewers = new Map<string, Viewer>();
  private primary = new Map<string, string>();
  constructor(private readonly lost: (sessionId: string) => void, readonly now = () => performance.now()) {}
  add(sessionId: string, token: string): string {
    const displayId = randomUUID();
    this.viewers.set(displayId, { id: displayId, token, sessionId, connectionId: null, generation: 0, previous: new Set(), lastSeen: -Infinity, decodedRound: null, clockAt: -Infinity, sample: null, notified: false });
    return displayId;
  }
  designate(sessionId: string, displayId: string): void {
    const viewer = this.viewers.get(displayId);
    if (!viewer || viewer.sessionId !== sessionId) throw new HttpError(404, 'DISPLAY_NOT_FOUND', 'Display not found.');
    this.primary.set(sessionId, displayId);
  }
  private viewer(sessionId: string, displayId: string, token: string): Viewer {
    const viewer = this.viewers.get(displayId);
    if (!viewer || viewer.sessionId !== sessionId || viewer.token !== token) throw new HttpError(403, 'DISPLAY_REQUIRED', 'Use this display’s own join capability.');
    return viewer;
  }
  report(sessionId: string, displayId: string, token: string, report: DisplayReport, currentImage: string | null): { connectionSequence: number; sample: ClockSample } {
    const viewer = this.viewer(sessionId, displayId, token); const at = this.now();
    if (report.type === 'connect') {
      if (viewer.connectionId !== report.connectionId) {
        if (viewer.previous.has(report.connectionId)) throw new HttpError(409, 'OLD_CONNECTION', 'This display connection was replaced. Rejoin deliberately.');
        if (viewer.previous.size >= 64) throw new HttpError(409, 'CONNECTION_LIMIT', 'Create a fresh display link.');
        if (this.primary.get(sessionId) === displayId && viewer.connectionId) this.lost(sessionId);
        viewer.previous.add(report.connectionId); viewer.connectionId = report.connectionId; viewer.generation++;
        viewer.decodedRound = null; viewer.clockAt = -Infinity;
      }
    } else {
      if (viewer.connectionId !== report.connectionId || viewer.generation !== report.connectionSequence) throw new HttpError(409, 'OLD_CONNECTION', 'This display connection was replaced.');
      const synchronized = report.clock && viewer.sample?.nonce === report.clock.nonce && at - viewer.sample.serverMonoMs <= 3000 && report.clock.rttMs <= 500;
      viewer.clockAt = synchronized ? at : -Infinity;
      viewer.decodedRound = report.decoded && report.roundId === currentImage && report.imageKey === currentImage ? currentImage : null;
    }
    viewer.lastSeen = at; viewer.notified = false;
    if (report.type === 'status' && currentImage && this.primary.get(sessionId) === displayId && !this.ready(sessionId, currentImage)) this.lost(sessionId);
    viewer.sample = { nonce: randomUUID(), serverMonoMs: this.now() };
    return { connectionSequence: viewer.generation, sample: viewer.sample };
  }
  tick(): void {
    for (const viewer of this.viewers.values()) {
      if (!viewer.notified && viewer.connectionId && this.now() - viewer.lastSeen >= 3000) {
        viewer.notified = true; viewer.decodedRound = null; viewer.clockAt = -Infinity;
        if (this.primary.get(viewer.sessionId) === viewer.id) this.lost(viewer.sessionId);
      }
    }
  }
  ready(sessionId: string, roundId: string): boolean {
    const viewer = this.viewers.get(this.primary.get(sessionId) ?? '');
    return !!viewer && this.now() - viewer.lastSeen < 3000 && this.now() - viewer.clockAt <= 3000 && viewer.decodedRound === roundId;
  }
  status(sessionId: string, roundId: string | null): PrimaryDisplayStatus {
    const displayId = this.primary.get(sessionId); const ready = !!roundId && this.ready(sessionId, roundId);
    return { ready, ...(displayId ? { displayId } : {}), message: ready ? 'Primary display decoded and synchronized. Ready for host action.' : 'Connect the designated primary display and wait for image decode and clock synchronization.',
      displays: [...this.viewers.values()].filter((v) => v.sessionId === sessionId).map((v) => ({ displayId: v.id, primary: v.id === displayId, connected: this.now() - v.lastSeen < 3000, ready: !!roundId && this.readyFor(v, roundId) })) };
  }
  private readyFor(viewer: Viewer, roundId: string): boolean { return this.now() - viewer.lastSeen < 3000 && this.now() - viewer.clockAt <= 3000 && viewer.decodedRound === roundId; }
  close(): void { this.viewers.clear(); this.primary.clear(); }
}
