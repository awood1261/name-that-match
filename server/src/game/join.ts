import { execFile } from 'node:child_process';
import { isIP } from 'node:net';
import type { DisplayOriginInput, DisplayOriginObservation, DisplayOriginSource } from '../../../shared/src/game/join.js';
import { HttpError } from '../library/http/protocol.js';
import { record } from '../../../shared/src/game/validation.js';

export function usableIPv4(value: string): boolean {
  return isIP(value) === 4 && ![0, 127].includes(Number(value.split('.')[0])) && Number(value.split('.')[0]) < 224;
}
function exactOrigin(value: unknown): URL {
  if (typeof value !== 'string' || value.length > 256) throw new HttpError(400, 'INVALID_DISPLAY_ORIGIN', 'Use an exact HTTP(S) origin, without credentials, path, query or fragment.');
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== value || url.username || url.password) throw new Error();
    return url;
  } catch { throw new HttpError(400, 'INVALID_DISPLAY_ORIGIN', 'Use an exact HTTP(S) origin, without credentials, path, query or fragment.'); }
}
export function parseDisplayOriginInput(input: unknown): DisplayOriginInput {
  const value = record(input, ['uiOrigin', 'manualOrigin', 'refresh']); exactOrigin(value.uiOrigin);
  if (value.manualOrigin !== undefined && !usableIPv4(exactOrigin(value.manualOrigin).hostname)) throw new HttpError(400, 'INVALID_DISPLAY_ORIGIN', 'The manual origin must use a usable LAN IPv4 address, not localhost or an unspecified address.');
  if (value.refresh !== undefined && typeof value.refresh !== 'boolean') throw new HttpError(400, 'INVALID_DISPLAY_ORIGIN', 'Invalid refresh flag.');
  return value as unknown as DisplayOriginInput;
}
/** Fixed executable/arguments, bounded output/time and no shell; never part of startup/polling. */
export function detectLanAddress(signal: AbortSignal, platform = process.platform): Promise<string> {
  if (platform !== 'darwin' || signal.aborted) return Promise.reject(new Error('Address detection unavailable.'));
  return new Promise((resolve, reject) => {
    execFile('/usr/sbin/ipconfig', ['getifaddr', 'en0'], { encoding: 'utf8', timeout: 1500, maxBuffer: 1024, killSignal: 'SIGKILL', signal }, (error, stdout) => {
      const address = stdout.trim();
      if (error || signal.aborted || !usableIPv4(address)) reject(new Error('Address detection unavailable.'));
      else resolve(address);
    });
  });
}
export interface DisplayOriginOptions {
  production?: boolean; host?: string;
  detect?: (signal: AbortSignal) => Promise<string>;
}
export async function observeDisplayOrigin(input: DisplayOriginInput, origins: Set<string>, options: DisplayOriginOptions, signal: AbortSignal): Promise<DisplayOriginObservation> {
  if (!origins.has(input.uiOrigin)) throw new HttpError(403, 'ORIGIN_REJECTED', 'Use the configured local application origin.');
  const url = exactOrigin(input.uiOrigin); let source: DisplayOriginSource;
  if (input.manualOrigin) { url.href = exactOrigin(input.manualOrigin).href; source = 'manual'; }
  else if (!input.refresh && usableIPv4(url.hostname)) source = 'current';
  else {
    const loopback = ['localhost', '[::1]'].includes(url.hostname) || (isIP(url.hostname) === 4 && Number(url.hostname.split('.')[0]) === 127);
    if (!loopback && !usableIPv4(url.hostname)) return { ready: false, origin: null, source: null, code: 'DETECTION_UNAVAILABLE', message: 'Use a configured manual LAN IPv4 origin for this hostname. Automatic replacement is limited to loopback or refreshed LAN IPv4 origins.' };
    try {
      const address = await (options.detect ?? detectLanAddress)(signal);
      if (signal.aborted || !usableIPv4(address)) throw new Error();
      url.hostname = address; source = 'detected';
    } catch {
      return { ready: false, origin: null, source: null, code: 'DETECTION_UNAVAILABLE', message: 'Could not detect the en0 LAN address. Use a manual LAN origin, or refresh after connecting Wi-Fi. Local-tab joining still works.' };
    }
  }
  const origin = url.origin;
  if (!origins.has(origin)) return { ready: false, origin, source, code: 'ORIGIN_NOT_ALLOWED', message: `Add ${origin} to NAME_THAT_MATCH_UI_ORIGINS alongside your host origin, then restart the server. No permissions were changed.` };
  if (options.production && !['0.0.0.0', '::', url.hostname].includes(options.host ?? '127.0.0.1')) return { ready: false, origin, source, code: 'LISTENER_LOCAL_ONLY', message: 'For LAN access, start production with NAME_THAT_MATCH_HOST=0.0.0.0 (or this LAN address), then restart. Localhost-only binding cannot serve another device.' };
  return { ready: true, origin, source, message: 'LAN origin is configured. Connect the other device to the same local Wi-Fi; firewall and device reachability still need checking.' };
}
