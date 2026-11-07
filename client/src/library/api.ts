import type { ApiFailure, BatchStatus, ImportConfirmation, ImportItem, ScreenshotList, SelectionManifest } from '../../../shared/src/imports';
export class LibraryApiError extends Error {
  constructor(readonly detail: ApiFailure, readonly status: number) { super(detail.message); }
}
/** getRandomValues also works on explicitly configured HTTP LAN origins. */
export function confirmationId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
async function request<T>(url: string, signal: AbortSignal, method = 'GET', payload?: unknown, binary = false): Promise<T> {
  const response = await fetch(url, { method, signal, headers: method === 'GET' ? undefined : {
    'X-Name-That-Match': 'library', 'Content-Type': binary ? 'image/png' : 'application/json',
  }, body: payload === undefined ? undefined : binary ? payload as Blob : JSON.stringify(payload) });
  const result = await response.json();
  if (!response.ok) throw new LibraryApiError(result.error ?? { code: 'REQUEST_FAILED', message: 'Library request failed.' }, response.status);
  return result.data as T;
}
export const libraryApi = {
  recent: (signal: AbortSignal) => request<Array<Omit<BatchStatus, 'items'>>>('/api/imports', signal),
  status: (id: string, signal: AbortSignal) => request<BatchStatus>(`/api/imports/${id}`, signal),
  create: (manifest: SelectionManifest, signal: AbortSignal) => request<BatchStatus>('/api/imports', signal, 'POST', manifest),
  upload: (url: string, file: File, signal: AbortSignal) => request<ImportItem>(url, signal, 'PUT', file, true),
  preview: (batch: BatchStatus, signal: AbortSignal) => request<BatchStatus>(`/api/imports/${batch.id}/preview`, signal, 'POST', { expectedRevision: batch.revision }),
  confirm: (id: string, value: ImportConfirmation, signal: AbortSignal) => request<BatchStatus>(`/api/imports/${id}/confirm`, signal, 'POST', value),
  unassigned: (signal: AbortSignal) => request<ScreenshotList>('/api/screenshots?matchId=unassigned', signal),
};
