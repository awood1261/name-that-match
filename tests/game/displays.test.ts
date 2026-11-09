import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { GameDisplays, parseDisplayReport } from '../../server/src/game/displays';

function fixture() {
  let now = 100; const lost = vi.fn(); const displays = new GameDisplays(lost, () => now);
  const session = randomUUID(); const token = 'a'.repeat(64); const viewer = displays.add(session, token); displays.designate(session, viewer);
  const connectionId = randomUUID(); const roundId = randomUUID();
  const first = displays.report(session, viewer, token, { type: 'connect', connectionId }, roundId);
  function ready(rttMs = 20, overrides = {}) {
    return displays.report(session, viewer, token, { type: 'status', connectionId, connectionSequence: first.connectionSequence, roundId, imageKey: roundId, decoded: true, clock: { nonce: first.sample.nonce, rttMs }, ...overrides }, roundId);
  }
  return { displays, lost, session, viewer, token, connectionId, roundId, first, ready, advance: (ms: number) => { now += ms; } };
}
describe('display readiness and connection generations', () => {
  it('requires host designation plus fresh decoded-image and echoed bounded clock observations', () => {
    const f = fixture(); expect(f.displays.ready(f.session, f.roundId)).toBe(false);
    f.ready(); expect(f.displays.ready(f.session, f.roundId)).toBe(true);
    expect(f.displays.ready(f.session, randomUUID())).toBe(false);
    f.advance(3001); f.displays.tick(); f.displays.tick(); expect(f.lost).toHaveBeenCalledOnce(); expect(f.displays.ready(f.session, f.roundId)).toBe(false);
  });
  it.each([{ decoded: false }, { imageKey: randomUUID() }, { roundId: randomUUID() }, { clock: null }, { clock: { nonce: randomUUID(), rttMs: 2 } }, { clock: { nonce: randomUUID(), rttMs: 501 } }])('rejects an invalid readiness observation %j', (overrides) => {
    const f = fixture(); f.ready(20, overrides); expect(f.displays.ready(f.session, f.roundId)).toBe(false);
  });
  it('rejects a matching nonce with excessive RTT or stale age', () => {
    const f = fixture(); f.ready(501); expect(f.displays.ready(f.session, f.roundId)).toBe(false);
    const old = fixture(); old.advance(3001); old.ready(); expect(old.displays.ready(old.session, old.roundId)).toBe(false);
  });
  it('does not let a secondary loss pause the primary and never auto-resumes on return', () => {
    const f = fixture(); f.ready(); const secondary = f.displays.add(f.session, 'b'.repeat(64));
    f.displays.report(f.session, secondary, 'b'.repeat(64), { type: 'connect', connectionId: randomUUID() }, f.roundId);
    f.advance(2000); const proof = f.displays.report(f.session, f.viewer, f.token, { type: 'connect', connectionId: f.connectionId }, f.roundId);
    f.advance(1001); f.displays.report(f.session, f.viewer, f.token, { type: 'status', connectionId: f.connectionId, connectionSequence: proof.connectionSequence, roundId: f.roundId, imageKey: f.roundId, decoded: true, clock: { nonce: proof.sample.nonce, rttMs: 20 } }, f.roundId);
    f.displays.tick(); expect(f.lost).not.toHaveBeenCalled();
  });
  it('replaces a connection once, rejects delayed old connect/status, and clears readiness', () => {
    const f = fixture(); f.ready();
    const next = f.displays.report(f.session, f.viewer, f.token, { type: 'connect', connectionId: randomUUID() }, f.roundId);
    expect(next.connectionSequence).toBe(2); expect(f.lost).toHaveBeenCalledOnce(); expect(f.displays.ready(f.session, f.roundId)).toBe(false);
    expect(() => f.ready()).toThrow(/replaced/);
    expect(() => f.displays.report(f.session, f.viewer, f.token, { type: 'connect', connectionId: f.connectionId }, f.roundId)).toThrow(/replaced/);
  });
  it('enforces capability/session binding and cleanup', () => {
    const f = fixture(); expect(() => f.displays.report(f.session, f.viewer, 'wrong', { type: 'connect', connectionId: f.connectionId }, f.roundId)).toThrow(/capability/);
    expect(() => f.displays.designate(randomUUID(), f.viewer)).toThrow(/not found/);
    f.displays.close(); expect(f.displays.status(f.session, f.roundId).displays).toEqual([]);
  });
  it.each([{}, { type: 'connect', connectionId: 'bad' }, { type: 'connect', connectionId: randomUUID(), decoded: true }, { type: 'status', connectionId: randomUUID(), connectionSequence: 0 }, { type: 'CORRECT', connectionId: randomUUID() }])('rejects invalid runtime report %j', (input) => {
    expect(() => parseDisplayReport(input)).toThrow();
  });
});
