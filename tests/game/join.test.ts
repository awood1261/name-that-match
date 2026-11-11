import { execFile } from 'node:child_process';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { detectLanAddress, observeDisplayOrigin, parseDisplayOriginInput, usableIPv4 } from '../../server/src/game/join';

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>(); const execute = vi.fn();
  return { ...actual, default: { ...actual, execFile: execute }, execFile: execute };
});
afterEach(() => { vi.resetAllMocks(); });
const local = 'http://localhost:5173'; const lan = 'http://192.0.2.10:5173';
const origins = new Set([local, lan, 'http://192.0.2.11:5173', 'https://192.0.2.10:8443']);

describe('bounded en0 adapter', () => {
  it('executes the fixed command with timeout, output, kill and cancellation bounds', async () => {
    vi.mocked(execFile).mockImplementation((...args: unknown[]) => { (args[3] as (error: null, stdout: string) => void)(null, '192.0.2.10\n'); return {} as ReturnType<typeof execFile>; });
    const signal = new AbortController().signal; expect(await detectLanAddress(signal, 'darwin')).toBe('192.0.2.10');
    expect(execFile).toHaveBeenCalledWith('/usr/sbin/ipconfig', ['getifaddr', 'en0'], expect.objectContaining({ timeout: 1500, maxBuffer: 1024, signal, killSignal: 'SIGKILL', encoding: 'utf8' }), expect.any(Function));
  });
  it.each(['', '127.0.0.1', '0.0.0.0', '192.0.2.10\n192.0.2.11', 'bad output', '224.0.0.1'])('rejects invalid output %s', async (stdout) => {
    vi.mocked(execFile).mockImplementation((...args: unknown[]) => { (args[3] as (error: null, stdout: string) => void)(null, stdout); return {} as ReturnType<typeof execFile>; });
    await expect(detectLanAddress(new AbortController().signal, 'darwin')).rejects.toThrow('unavailable');
  });
  it.each(['ENOENT', 'ETIMEDOUT', 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER', 'ABORT_ERR', 'exit 1'])('sanitizes %s instead of surfacing process output', async (code) => {
    vi.mocked(execFile).mockImplementation((...args: unknown[]) => { (args[3] as (error: Error, stdout: string) => void)(new Error(code), 'secret process output'); return {} as ReturnType<typeof execFile>; });
    await expect(detectLanAddress(new AbortController().signal, 'darwin')).rejects.toThrow('Address detection unavailable.');
  });
  it('does not spawn on unsupported platforms or an already cancelled request', async () => {
    const controller = new AbortController(); await expect(detectLanAddress(controller.signal, 'linux')).rejects.toThrow();
    controller.abort(); await expect(detectLanAddress(controller.signal, 'darwin')).rejects.toThrow(); expect(execFile).not.toHaveBeenCalled();
  });
});
describe('LAN origin observations and guards', () => {
  it('replaces only the hostname and keeps the configured development UI port', async () => {
    const detect = vi.fn().mockResolvedValue('192.0.2.10');
    expect(await observeDisplayOrigin({ uiOrigin: local }, origins, { detect }, new AbortController().signal)).toMatchObject({ ready: true, origin: lan, source: 'detected' });
    expect(detect).toHaveBeenCalledOnce(); expect([...origins]).toEqual([local, lan, 'http://192.0.2.11:5173', 'https://192.0.2.10:8443']);
  });
  it('retains a configured LAN UI origin, then detects only when explicitly refreshed', async () => {
    const detect = vi.fn().mockResolvedValue('192.0.2.11'); const signal = new AbortController().signal;
    expect(await observeDisplayOrigin({ uiOrigin: lan }, origins, { detect }, signal)).toMatchObject({ ready: true, origin: lan, source: 'current' }); expect(detect).not.toHaveBeenCalled();
    expect(await observeDisplayOrigin({ uiOrigin: lan, refresh: true }, origins, { detect }, signal)).toMatchObject({ ready: true, origin: 'http://192.0.2.11:5173', source: 'detected' });
  });
  it('does not silently replace an unrelated hostname', async () => {
    const detect = vi.fn(); const uiOrigin = 'http://laptop.local:5173';
    expect(await observeDisplayOrigin({ uiOrigin }, new Set([uiOrigin]), { detect }, new AbortController().signal)).toMatchObject({ ready: false }); expect(detect).not.toHaveBeenCalled();
  });
  it('supports an explicit configured alternate origin/port without discovery or downgrading HTTPS', async () => {
    const detect = vi.fn(); const signal = new AbortController().signal;
    expect(await observeDisplayOrigin(parseDisplayOriginInput({ uiOrigin: local, manualOrigin: 'https://192.0.2.10:8443' }), origins, { detect, production: true, host: '0.0.0.0' }, signal)).toMatchObject({ ready: true, origin: 'https://192.0.2.10:8443', source: 'manual' }); expect(detect).not.toHaveBeenCalled();
  });
  it.each(['0.0.0.0', '::', '192.0.2.10'])('accepts deliberate production binding %s while preserving its port', async (host) => {
    const allowed = new Set(['http://localhost:8000', 'http://192.0.2.10:8000']);
    expect(await observeDisplayOrigin({ uiOrigin: 'http://localhost:8000' }, allowed, { production: true, host, detect: async () => '192.0.2.10' }, new AbortController().signal)).toMatchObject({ ready: true, origin: 'http://192.0.2.10:8000' });
  });
  it('refuses unconfigured addresses and loopback-only production without changing permissions', async () => {
    const signal = new AbortController().signal; const detect = async () => '192.0.2.10';
    expect(await observeDisplayOrigin({ uiOrigin: local }, new Set([local]), { detect }, signal)).toMatchObject({ ready: false, code: 'ORIGIN_NOT_ALLOWED', origin: lan });
    expect(await observeDisplayOrigin({ uiOrigin: local }, origins, { detect, production: true, host: '127.0.0.1' }, signal)).toMatchObject({ ready: false, code: 'LISTENER_LOCAL_ONLY' });
    await expect(observeDisplayOrigin({ uiOrigin: 'https://foreign.invalid' }, origins, { detect }, signal)).rejects.toThrow('configured');
  });
  it('sanitizes detection failure and ignores completion after cancellation', async () => {
    const controller = new AbortController(); const input = { uiOrigin: local };
    expect(await observeDisplayOrigin(input, origins, { detect: async () => { throw new Error('process secrets'); } }, controller.signal)).toMatchObject({ ready: false, origin: null, code: 'DETECTION_UNAVAILABLE' });
    expect(await observeDisplayOrigin(input, origins, { detect: async () => { controller.abort(); return '192.0.2.10'; } }, controller.signal)).toMatchObject({ ready: false, origin: null });
  });
  it.each(['http://localhost:5173', 'http://127.1:5173', 'http://0.0.0.0:5173', 'http://224.0.0.1', 'http://192.0.2.10/path', 'http://192.0.2.10/', 'http://192.0.2.10?x=1', 'http://192.0.2.10#x', 'http://user:password@192.0.2.10', 'javascript:alert(1)', 'http://192.0.2.10;touch x', 'http://[::1]:5173'])('rejects malformed/unusable manual origin %s', (manualOrigin) => {
    expect(() => parseDisplayOriginInput({ uiOrigin: local, manualOrigin })).toThrow();
  });
  it('rejects malformed request fields and bounds, accepting only usable addresses', () => {
    for (const input of [null, [], { uiOrigin: local, refresh: 'yes' }, { uiOrigin: local, command: 'anything' }, { uiOrigin: 'x'.repeat(257) }]) expect(() => parseDisplayOriginInput(input)).toThrow();
    expect(usableIPv4('255.255.255.255')).toBe(false); expect(usableIPv4('192.0.2.10')).toBe(true);
  });
});
