import type { CommandEnvelope, CreateGame, Receipt } from '../../../shared/src/game/contracts';
import type { ControllerCredential, GameApiFailure, HostCommandResponse, HostStatus } from '../../../shared/src/game/host';
import type { DisplayCredential, DisplayObservation, DisplayReport } from '../../../shared/src/game/display';
import type { DisplayOriginInput, DisplayOriginObservation } from '../../../shared/src/game/join';
export class GameApiError extends Error {
  constructor(readonly detail: GameApiFailure, readonly status: number) { super(detail.message); }
}
async function request<T>(path: string, signal: AbortSignal, credential?: Pick<ControllerCredential, 'token' | 'serverEpoch'>, payload?: unknown): Promise<T> {
  const response = await fetch(`/api/game${path}`, { signal, method: payload === undefined ? 'GET' : 'POST', headers: {
    ...(credential ? { Authorization: `Bearer ${credential.token}`, 'X-Name-That-Match-Epoch': credential.serverEpoch } : {}),
    ...(payload === undefined ? {} : { 'Content-Type': 'application/json', 'X-Name-That-Match': 'game' }),
  }, body: payload === undefined ? undefined : JSON.stringify(payload) });
  const result = await response.json();
  if (!response.ok) throw new GameApiError(result.error ?? { code: 'GAME_REQUEST_FAILED', message: 'Game request failed.' }, response.status);
  return result.data as T;
}
export const gameApi = {
  displayOrigin: (credential: ControllerCredential, input: DisplayOriginInput, signal: AbortSignal) => request<DisplayOriginObservation>('/display-origin', signal, credential, input),
  claim: (signal: AbortSignal) => request<ControllerCredential>('/control-lease', signal, undefined, {}),
  renew: (credential: ControllerCredential, signal: AbortSignal) => request<{ serverEpoch: string }>('/control-lease/renew', signal, credential, {}),
  release: (credential: ControllerCredential, signal: AbortSignal) => request('/control-lease/release', signal, credential, {}),
  current: (credential: ControllerCredential, signal: AbortSignal, refresh = false) => request<HostStatus>(`/current${refresh ? '?refresh=true' : ''}`, signal, credential),
  session: (credential: ControllerCredential, sessionId: string, signal: AbortSignal) => request<HostStatus>(`/sessions/${sessionId}`, signal, credential),
  create: (credential: ControllerCredential, input: CreateGame, signal: AbortSignal) => request<HostCommandResponse>('/sessions', signal, credential, input),
  command: (credential: ControllerCredential, input: CommandEnvelope, signal: AbortSignal) => request<HostCommandResponse>(`/sessions/${input.sessionId}/commands`, signal, credential, input),
  receipt: (credential: ControllerCredential, sessionId: string, commandId: string, signal: AbortSignal) => request<{ receipt: Receipt; status: HostStatus }>(`/sessions/${sessionId}/commands/${commandId}`, signal, credential),
  registerDisplay: (credential: ControllerCredential, sessionId: string, primary: boolean, signal: AbortSignal) => request<DisplayCredential>(`/sessions/${sessionId}/displays`, signal, credential, { primary }),
  designateDisplay: (credential: ControllerCredential, sessionId: string, displayId: string, signal: AbortSignal) => request<HostStatus>(`/sessions/${sessionId}/displays`, signal, credential, { displayId }),
};
export const displayApi = {
  status: (credential: DisplayCredential, sessionId: string, report: DisplayReport, signal: AbortSignal) => request<DisplayObservation>(`/sessions/${sessionId}/displays/${credential.displayId}/status`, signal, credential, report),
  async image(credential: DisplayCredential, sessionId: string, roundId: string, signal: AbortSignal): Promise<Blob> {
    const response = await fetch(`/api/game/sessions/${sessionId}/rounds/${roundId}/image`, { signal, cache: 'no-store', headers: { Authorization: `Bearer ${credential.token}`, 'X-Name-That-Match-Epoch': credential.serverEpoch } });
    if (!response.ok) throw new Error('The selected image is unavailable. Ask the host to review the candidate.');
    return response.blob();
  },
};
