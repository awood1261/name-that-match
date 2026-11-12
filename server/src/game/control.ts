import { randomBytes } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { HttpError } from '../library/http/protocol.js';
import type { ControllerCredential } from '../../../shared/src/game/host.js';

/** Process-local capabilities coordinate trusted LAN clients; they do not authenticate people. */
export class GameControl {
  private controller: { token: string; renewedAt: number; generation: number } | null = null;
  private generation = 0;
  private lossNotified = false;
  private viewers = new Map<string, string>();
  constructor(readonly serverEpoch: string, private readonly lost: () => void, private readonly now = () => performance.now()) {}
  tick(): void {
    if (!this.controller) return;
    const age = this.now() - this.controller.renewedAt;
    if (age >= 3000 && !this.lossNotified) { this.lossNotified = true; this.lost(); }
    if (age >= 10_000) this.controller = null;
  }
  claim(): ControllerCredential {
    this.tick();
    if (this.controller) throw new HttpError(409, 'HOST_BUSY', 'Another host has control. Release it there, or wait for its lease to expire and explicitly retry.');
    this.controller = { token: randomBytes(32).toString('hex'), renewedAt: this.now(), generation: ++this.generation }; this.lossNotified = false;
    return { token: this.controller.token, serverEpoch: this.serverEpoch, generation: this.controller.generation };
  }
  authorize(token: string | undefined, sessionId?: string): 'host' | 'display' {
    this.tick();
    if (token && this.controller?.token === token) return 'host';
    if (token && sessionId && this.viewers.get(token) === sessionId) return 'display';
    throw new HttpError(401, 'CONTROL_REQUIRED', 'Host control expired or is unavailable. Reclaim control and review the restored session.');
  }
  renew(token: string): void {
    if (this.authorize(token) !== 'host') throw new HttpError(403, 'HOST_REQUIRED', 'Host control is required.');
    this.controller!.renewedAt = this.now(); this.lossNotified = false;
  }
  release(token: string): void {
    this.authorize(token); this.lost(); this.controller = null; this.lossNotified = false;
  }
  disconnected(token: string): void {
    if (this.controller?.token !== token || this.lossNotified) return;
    this.lossNotified = true; this.lost();
  }
  viewer(token: string, sessionId: string): string {
    this.authorize(token);
    if (this.viewers.size >= 4) throw new HttpError(409, 'DISPLAY_LIMIT', 'This process already has four display capabilities.');
    const value = randomBytes(32).toString('hex'); this.viewers.set(value, sessionId); return value;
  }
  close(): void { this.controller = null; this.viewers.clear(); }
}
