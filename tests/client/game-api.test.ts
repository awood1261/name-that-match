import { afterEach, describe, expect, it, vi } from 'vitest';
import { gameApi } from '../../client/src/game/api';

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
const owner = { token: 'a'.repeat(64), serverEpoch: 'epoch', generation: 1 };
function stalledFetch() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation((_url, input) => new Promise((_resolve, reject) => {
    const signal = input!.signal!; if (signal.aborted) reject(new Error('aborted'));
    else signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
  }));
}
describe('bounded game request lifetime', () => {
  it('bounds a stalled request at three seconds without a blind retry', async () => {
    vi.useFakeTimers(); const fetch = stalledFetch(); const pending = gameApi.current(owner, new AbortController().signal); const rejected = expect(pending).rejects.toThrow('aborted');
    await vi.advanceTimersByTimeAsync(3000); await rejected; expect(fetch).toHaveBeenCalledOnce(); expect(fetch.mock.calls[0][1]!.signal!.aborted).toBe(true); expect(vi.getTimerCount()).toBe(0);
  });
  it('cancels on view lifetime abort and releases the request timeout', async () => {
    vi.useFakeTimers(); stalledFetch(); const controller = new AbortController(); const pending = gameApi.current(owner, controller.signal); const rejected = expect(pending).rejects.toThrow('aborted');
    controller.abort(); await rejected; expect(vi.getTimerCount()).toBe(0);
  });
});
