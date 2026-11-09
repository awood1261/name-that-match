import type { ApiFailure, BatchStatus, ImportConfirmation, ImportItem, ScreenshotList, SelectionManifest } from '../../../shared/src/imports';
export class LibraryApiError extends Error {
  constructor(readonly detail: ApiFailure, readonly status: number) { super(detail.message); }
}
export { clientId as confirmationId } from '../ids';
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
  unassigned: (signal: AbortSignal, query = '') => request<ScreenshotList>(`/api/screenshots?matchId=unassigned${query ? `&${query}` : ''}`, signal),
};

import type { MatchInput, MatchList, MatchSummary, MatchUpdate } from '../../../shared/src/matches';
import type { ScreenshotSummary } from '../../../shared/src/imports';
export const matchApi = {
  list: (signal: AbortSignal, query = '') => request<MatchList>(`/api/matches${query ? `?${query}` : ''}`, signal),
  create: (fields: MatchInput, signal: AbortSignal) => request<MatchSummary>('/api/matches', signal, 'POST', fields),
  update: (match: MatchSummary, fields: MatchInput, signal: AbortSignal) => request<MatchUpdate>(`/api/matches/${match.id}`, signal, 'PATCH', { expectedRevision: match.revision, changes: fields }),
  screenshots: (matchId: string | null, signal: AbortSignal, query = '') => { const params = new URLSearchParams(screenshotFilterQuery(query)); if (matchId) params.set('matchId', matchId); return request<ScreenshotList>(`/api/screenshots${params.size ? `?${params}` : ''}`, signal); },
  assign: (records: ScreenshotSummary[], target: { id: string; revision: number } | null, signal: AbortSignal) => target
    ? request<{ screenshots: ScreenshotSummary[] }>('/api/screenshots/assignments', signal, 'POST', { targetMatchId: target.id, expectedMatchRevision: target.revision, screenshots: records.map((item) => ({ id: item.id, expectedRevision: item.revision })) }).then((result) => result.screenshots)
    : request<ScreenshotSummary>(`/api/screenshots/${records[0].id}`, signal, 'PATCH', { expectedRevision: records[0].revision, changes: { matchId: null } }).then((result) => [result]),
};

import type { Difficulty, ReviewStatus } from '../../../shared/src/library';
import type { LibraryStatistics } from '../../../shared/src/classification';
export const reviewApi = {
  statistics: (signal: AbortSignal) => request<LibraryStatistics>('/api/library/statistics', signal),
  edit: (record: ScreenshotSummary, changes: { difficulty: Difficulty | null; notes: string | null }, signal: AbortSignal) =>
    request<ScreenshotSummary>(`/api/screenshots/${record.id}`, signal, 'PATCH', { expectedRevision: record.revision, changes }),
  review: (record: ScreenshotSummary, reviewStatus: ReviewStatus, signal: AbortSignal) =>
    request<ScreenshotSummary>(`/api/screenshots/${record.id}`, signal, 'PATCH', { expectedRevision: record.revision, expectedMatchRevision: record.matchRevision ?? undefined, reviewStatus }),
};

/** Match-only filters must never leak into the screenshot listing contract. */
export function screenshotFilterQuery(query: string): string {
  const source = new URLSearchParams(query); const result = new URLSearchParams();
  for (const key of ['difficulty', 'review', 'tier']) { const value = source.get(key); if (value !== null) result.set(key, value); }
  return result.toString();
}
