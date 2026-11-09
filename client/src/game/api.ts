import type { CommandEnvelope, CreateGame, Receipt } from '../../../shared/src/game/contracts';
import type { ControllerCredential, GameApiFailure, HostCommandResponse, HostStatus } from '../../../shared/src/game/host';
export class GameApiError extends Error {
  constructor(readonly detail: GameApiFailure, readonly status: number) { super(detail.message); }
}
async function request<T>(path: string, signal: AbortSignal, credential?: ControllerCredential, payload?: unknown): Promise<T> {
  const response = await fetch(`/api/game${path}`, { signal, method: payload === undefined ? 'GET' : 'POST', headers: {
    ...(credential ? { Authorization: `Bearer ${credential.token}`, 'X-Name-That-Match-Epoch': credential.serverEpoch } : {}),
    ...(payload === undefined ? {} : { 'Content-Type': 'application/json', 'X-Name-That-Match': 'game' }),
  }, body: payload === undefined ? undefined : JSON.stringify(payload) });
  const result = await response.json();
  if (!response.ok) throw new GameApiError(result.error ?? { code: 'GAME_REQUEST_FAILED', message: 'Game request failed.' }, response.status);
  return result.data as T;
}
export const gameApi = {
  claim: (signal: AbortSignal) => request<ControllerCredential>('/control-lease', signal, undefined, {}),
  renew: (credential: ControllerCredential, signal: AbortSignal) => request<{ serverEpoch: string }>('/control-lease/renew', signal, credential, {}),
  release: (credential: ControllerCredential, signal: AbortSignal) => request('/control-lease/release', signal, credential, {}),
  current: (credential: ControllerCredential, signal: AbortSignal, refresh = false) => request<HostStatus>(`/current${refresh ? '?refresh=true' : ''}`, signal, credential),
  create: (credential: ControllerCredential, input: CreateGame, signal: AbortSignal) => request<HostCommandResponse>('/sessions', signal, credential, input),
  command: (credential: ControllerCredential, input: CommandEnvelope, signal: AbortSignal) => request<HostCommandResponse>(`/sessions/${input.sessionId}/commands`, signal, credential, input),
  receipt: (credential: ControllerCredential, sessionId: string, commandId: string, signal: AbortSignal) => request<{ receipt: Receipt; status: HostStatus }>(`/sessions/${sessionId}/commands/${commandId}`, signal, credential),
};
