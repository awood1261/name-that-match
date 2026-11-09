import { describe, expect, it } from 'vitest';
import { DisplayClock, countdownSeconds } from '../../client/src/game/clock';
describe('display monotonic clock estimation', () => {
  it('uses recent lowest-RTT midpoint samples, rejects slow/invalid samples and expires estimates', () => {
    const clock = new DisplayClock(); expect(clock.serverNow(0)).toBeNull();
    expect(clock.observe({ nonce: 'a', serverMonoMs: 110 }, 0, 20)).toBe(true); expect(clock.serverNow(50)).toBe(150);
    clock.observe({ nonce: 'b', serverMonoMs: 999 }, 100, 300); expect(clock.serverNow(300)).toBe(400);
    expect(clock.observe({ nonce: 'c', serverMonoMs: 20 }, 0, 501)).toBe(false);
    expect(clock.observe({ nonce: 'c', serverMonoMs: NaN }, 0, 10)).toBe(false);
    expect(clock.serverNow(3400)).toBeNull();
  });
  it.each([[10000, 10], [9999, 10], [9000, 9], [1, 1], [0, 0], [-99, 0]])('ceil/clamps %i milliseconds to %i', (ms, seconds) => { expect(countdownSeconds(ms)).toBe(seconds); });
});
