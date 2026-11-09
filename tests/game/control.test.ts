import { describe, expect, it, vi } from 'vitest';
import { GameControl } from '../../server/src/game/control';
describe('process controller lease', () => {
  it('claims exclusively, renews, releases and rejects old generations', () => {
    let now = 0; const lost = vi.fn(); const control = new GameControl('epoch', lost, () => now); const first = control.claim();
    expect(first.token).toMatch(/^[a-f0-9]{64}$/); expect(() => control.claim()).toThrow(/Another host/);
    now = 2000; control.renew(first.token); now = 4000; control.tick(); expect(lost).not.toHaveBeenCalled();
    control.release(first.token); const second = control.claim(); expect(second.generation).toBe(first.generation + 1);
    expect(() => control.authorize(first.token)).toThrow(); expect(control.authorize(second.token)).toBe('host');
  });
  it('notifies loss at 3s without awarding/advancing and expires control at 10s', () => {
    let now = 0; const lost = vi.fn(); const control = new GameControl('epoch', lost, () => now); const first = control.claim();
    now = 3000; control.tick(); control.tick(); expect(lost).toHaveBeenCalledTimes(1);
    now = 10_000; const next = control.claim(); expect(next.token).not.toBe(first.token); expect(() => control.renew(first.token)).toThrow();
  });
  it('binds read-only capabilities to their session and clears all secrets on close', () => {
    const control = new GameControl('epoch', () => {}); const host = control.claim(); const viewer = control.viewer(host.token, 'session');
    expect(control.authorize(viewer, 'session')).toBe('display'); expect(() => control.authorize(viewer, 'other')).toThrow();
    expect(() => control.renew(viewer)).toThrow(); control.close(); expect(() => control.authorize(viewer, 'session')).toThrow(); expect(() => control.authorize(host.token)).toThrow();
  });
});
