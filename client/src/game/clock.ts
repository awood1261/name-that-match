import type { ClockSample } from '../../../shared/src/game/display';

/** Browser monotonic estimates, never game transitions. Keep only recent bounded samples. */
export class DisplayClock {
  private samples: Array<{ offset: number; rtt: number; receivedAt: number }> = [];
  observe(sample: ClockSample, sentAt: number, receivedAt: number): boolean {
    const rtt = receivedAt - sentAt;
    this.samples = this.samples.filter((s) => receivedAt - s.receivedAt <= 3000);
    if (!Number.isFinite(sample.serverMonoMs) || rtt < 0 || rtt > 500) return false;
    this.samples.push({ offset: sample.serverMonoMs - (sentAt + receivedAt) / 2, rtt, receivedAt });
    this.samples = this.samples.slice(-8); return true;
  }
  serverNow(now: number): number | null {
    const best = this.samples.filter((s) => now - s.receivedAt <= 3000).sort((a, b) => a.rtt - b.rtt)[0];
    return best ? now + best.offset : null;
  }
}
export const countdownSeconds = (remainingMs: number) => Math.ceil(Math.max(0, remainingMs) / 1000);
