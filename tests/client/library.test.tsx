import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { BatchStatus, ImportItem, ScreenshotSummary } from '../../shared/src/imports';
import { ImportDialog } from '../../client/src/library/ImportDialog';
import { MatchLibraryPage } from '../../client/src/library/MatchLibraryPage';
import { libraryApi, confirmationId } from '../../client/src/library/api';
import { scanSelection } from '../../client/src/library/selection';
import { DEFAULT_IMPORT_LIMITS } from '../../server/src/library/imports/limits';
const item: ImportItem = { id: '00000000-0000-4000-8000-000000000001', ordinal: 0, candidateLabel: 'video/sample.json', state: 'ready', retryable: false,
  result: null, screenshotId: null, classification: 'valid', issues: [], duplicateOf: [], defaultAction: 'import', uploadUrl: '/upload', error: null };
function batch(items = [item], status = 'preview_ready'): BatchStatus {
  return { id: '00000000-0000-4000-8000-000000000002', sourceLabel: 'Browser-selected captures', status, revision: 2, createdAt: '2026-11-06T12:00:00Z', completedAt: null,
    previewToken: 'snapshot', limits: { ...DEFAULT_IMPORT_LIMITS }, items, ignored: [{ label: '.DS_Store', reason: 'harmless' }],
    counts: { imported: 0, duplicate: 0, skipped: 0, failed: 0, remaining: items.length }, classificationCounts: { valid: 1 }, error: null };
}
function files(folder = false) {
  const json = new File(['{ "original": true }\n'], 'sample.json', { type: 'application/json' });
  const png = new File(['PNG'], 'sample.png', { type: 'image/png' });
  if (folder) for (const file of [json, png]) Object.defineProperty(file, 'webkitRelativePath', { value: `video/${file.name}` });
  return [json, png];
}
beforeEach(() => {
  vi.spyOn(libraryApi, 'recent').mockResolvedValue([]);
  vi.spyOn(libraryApi, 'status').mockResolvedValue(batch());
  vi.spyOn(libraryApi, 'create').mockResolvedValue(batch([{ ...item, state: 'awaiting_upload' }], 'uploading'));
  vi.spyOn(libraryApi, 'upload').mockResolvedValue({ ...item, state: 'staged' });
  vi.spyOn(libraryApi, 'preview').mockResolvedValue(batch());
  vi.spyOn(libraryApi, 'confirm').mockResolvedValue({ ...batch([{ ...item, state: 'committed', result: 'imported', screenshotId: 'saved' }], 'completed'), counts: { imported: 1, duplicate: 0, skipped: 0, failed: 0, remaining: 0 } });
  vi.spyOn(libraryApi, 'unassigned').mockResolvedValue({ screenshots: [], matchedCount: 0, asOf: '' });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

it.each([false, true])('scans literal original metadata and relative context (folder=%s)', async (folder) => {
  const selected = files(folder); const result = await scanSelection(selected, new AbortController().signal);
  expect(result.manifest.files[0].metadataText).toBe('{ "original": true }\n');
  expect(result.manifest.files[0].relativePath).toBe(folder ? 'video/sample.json' : 'sample.json');
  expect(result.images.get(folder ? 'video/sample.png' : 'sample.png')?.[0]).toBe(selected[1]);
});
it.each(['Choose capture files', 'Choose capture folder'])('uploads and previews through %s without automatic confirmation', async (picker) => {
  render(<ImportDialog onClose={vi.fn()} onImported={vi.fn()} />);
  expect(screen.getByText(/this browser device/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(picker), { target: { files: files(picker.includes('folder')) } });
  await screen.findByRole('button', { name: 'Confirm selected imports' });
  expect(libraryApi.create).toHaveBeenCalledOnce(); expect(libraryApi.upload).toHaveBeenCalledOnce();
  expect(libraryApi.preview).toHaveBeenCalledOnce(); expect(libraryApi.confirm).not.toHaveBeenCalled();
  expect(screen.getByText('Effective import limits')).toBeInTheDocument();
  expect(screen.getByText('.DS_Store: harmless')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Confirm selected imports' }));
  await screen.findByRole('button', { name: 'View unassigned screenshots' });
  expect(vi.mocked(libraryApi.confirm).mock.calls[0][1].items[0].action).toBe('import');
});
it('defaults duplicates to skip, blocks invalid candidates, and requires an individual keep decision', async () => {
  const duplicate = { ...item, classification: 'image_duplicate' as const, defaultAction: 'skip' as const, duplicateOf: ['existing'] };
  const invalid = { ...item, id: 'invalid', state: 'invalid', classification: 'invalid' as const, issues: [{ code: 'BAD', message: 'Metadata is invalid' }] };
  vi.mocked(libraryApi.preview).mockResolvedValue(batch([duplicate, invalid]));
  render(<ImportDialog onClose={vi.fn()} onImported={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('Choose capture files'), { target: { files: files() } });
  const decision = await screen.findByRole('combobox'); expect(decision).toHaveValue('skip');
  expect(screen.getAllByRole('combobox')).toHaveLength(1); expect(screen.getByText('Metadata is invalid')).toBeInTheDocument();
  fireEvent.change(decision, { target: { value: 'keepDuplicate' } }); fireEvent.click(screen.getByRole('button', { name: 'Confirm selected imports' }));
  await waitFor(() => expect(libraryApi.confirm).toHaveBeenCalledOnce());
  expect(vi.mocked(libraryApi.confirm).mock.calls[0][1].items).toEqual([{ itemId: item.id, action: 'keepDuplicate' }]);
});
it('reuses the same confirmation key/body after a lost response', async () => {
  vi.mocked(libraryApi.confirm).mockRejectedValueOnce(new Error('Lost response'));
  render(<ImportDialog onClose={vi.fn()} onImported={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('Choose capture files'), { target: { files: files() } });
  fireEvent.click(await screen.findByRole('button', { name: 'Confirm selected imports' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Lost response');
  fireEvent.click(screen.getByRole('button', { name: 'Retry same confirmation' }));
  await screen.findByRole('button', { name: 'View unassigned screenshots' });
  expect(vi.mocked(libraryApi.confirm).mock.calls[0][1]).toEqual(vi.mocked(libraryApi.confirm).mock.calls[1][1]);
});
it('resumes a recent batch, polls only active progress, and stops on completion', async () => {
  vi.useFakeTimers(); const active = batch([{ ...item, state: 'confirmed' }], 'confirming');
  vi.mocked(libraryApi.recent).mockResolvedValue([active]);
  vi.mocked(libraryApi.status).mockResolvedValueOnce(active).mockResolvedValueOnce({ ...active, status: 'completed', counts: { imported: 1, duplicate: 0, skipped: 0, failed: 0, remaining: 0 } });
  const view = render(<ImportDialog onClose={vi.fn()} onImported={vi.fn()} />);
  await act(async () => {});
  fireEvent.click(screen.getByRole('button', { name: /Browser-selected captures/ })); await act(async () => {});
  await act(() => vi.advanceTimersByTimeAsync(500)); expect(libraryApi.status).toHaveBeenCalledTimes(2);
  await act(() => vi.advanceTimersByTimeAsync(2000)); expect(libraryApi.status).toHaveBeenCalledTimes(2);
  view.unmount(); await act(() => vi.advanceTimersByTimeAsync(1000)); expect(libraryApi.status).toHaveBeenCalledTimes(2);
});
it('stops polling on disconnection and shows restart/resume guidance', async () => {
  vi.useFakeTimers(); const active = batch([{ ...item, state: 'confirmed' }], 'confirming');
  vi.mocked(libraryApi.recent).mockResolvedValue([active]); vi.mocked(libraryApi.status).mockResolvedValueOnce(active).mockRejectedValue(new Error('offline'));
  render(<ImportDialog onClose={vi.fn()} onImported={vi.fn()} />); await act(async () => {});
  fireEvent.click(screen.getByRole('button', { name: /Browser-selected captures/ })); await act(async () => {});
  await act(() => vi.advanceTimersByTimeAsync(500)); expect(screen.getByRole('alert')).toHaveTextContent(/Connection lost/);
  await act(() => vi.advanceTimersByTimeAsync(2000)); expect(libraryApi.status).toHaveBeenCalledTimes(2);
});
it('traps focus, cancels with Escape semantics, aborts requests, and returns focus to the trigger', async () => {
  const trigger = document.createElement('button'); document.body.append(trigger); trigger.focus(); const close = vi.fn();
  const view = render(<ImportDialog onClose={close} onImported={vi.fn()} />);
  await act(async () => {});
  const dialog = screen.getByRole('dialog'); const first = within(dialog).getByRole('button', { name: 'Close' });
  expect(first).toHaveFocus(); fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
  expect(screen.getByText('Recent imports')).toHaveFocus();
  fireEvent.keyDown(dialog, { key: 'Escape' }); expect(close).toHaveBeenCalledOnce();
  fireEvent(dialog, new Event('cancel', { cancelable: true })); expect(close).toHaveBeenCalledTimes(2);
  const signal = vi.mocked(libraryApi.recent).mock.calls[0][0]; view.unmount(); expect(signal.aborted).toBe(true); expect(trigger).toHaveFocus(); trigger.remove();
});
it('renders loading/empty/error queue states and refreshes after import navigation', async () => {
  render(<MatchLibraryPage />); expect(screen.getByRole('status')).toHaveTextContent('Loading');
  await screen.findByText(/No unassigned screenshots yet/);
  vi.mocked(libraryApi.unassigned).mockRejectedValueOnce(new Error('offline'));
  fireEvent.click(screen.getByRole('button', { name: 'Reload screenshots' })); expect(await screen.findByRole('alert')).toHaveTextContent(/local server/);
  fireEvent.click(screen.getByRole('button', { name: 'Import captures' }));
  fireEvent.change(screen.getByLabelText('Choose capture files'), { target: { files: files() } });
  fireEvent.click(await screen.findByRole('button', { name: 'Confirm selected imports' }));
  fireEvent.click(await screen.findByRole('button', { name: 'View unassigned screenshots' }));
  await waitFor(() => expect(libraryApi.unassigned).toHaveBeenCalledTimes(3)); expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
it('keeps screenshot geometry, provenance, and unavailable-image feedback in the basic queue', async () => {
  const record = { id: 'saved', provenance: { captureId: 'sample', source: { videoId: 'abcdefghijk' }, capture: { playbackSeconds: 42, capturedAt: '2026-11-06' } },
    image: { width: 476, height: 360, url: '/api/screenshots/saved/image' }, difficulty: null, reviewStatus: 'pending', assetStatus: 'available' } as ScreenshotSummary;
  vi.mocked(libraryApi.unassigned).mockResolvedValue({ screenshots: [record], matchedCount: 1, asOf: '' }); render(<MatchLibraryPage />);
  const image = await screen.findByRole('img'); expect(image).toHaveAttribute('width', '476'); expect(image).toHaveAttribute('height', '360');
  expect(screen.getByText('Unassigned · unrated · pending')).toBeInTheDocument(); fireEvent.error(image); expect(screen.getByText(/Image unavailable/)).toBeInTheDocument();
});
it('generates confirmation UUIDs on HTTP origins without crypto.randomUUID', () => {
  expect(confirmationId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});
it('reuploads a missing file into the resumed batch without creating a replacement batch', async () => {
  const failed = batch([{ ...item, state: 'failed', retryable: true, error: { code: 'UPLOAD_REQUIRED', message: 'Re-upload original' } }], 'failed');
  vi.mocked(libraryApi.recent).mockResolvedValue([failed]); vi.mocked(libraryApi.status).mockResolvedValue(failed);
  render(<ImportDialog onClose={vi.fn()} onImported={vi.fn()} />);
  fireEvent.click(await screen.findByRole('button', { name: /Browser-selected captures/ }));
  fireEvent.change(await screen.findByLabelText('Re-select missing capture files'), { target: { files: files() } });
  await screen.findByRole('button', { name: 'Confirm selected imports' });
  expect(libraryApi.upload).toHaveBeenCalledOnce(); expect(libraryApi.create).not.toHaveBeenCalled();
});
it('stops active polling immediately when the dialog unmounts', async () => {
  vi.useFakeTimers(); const active = batch([{ ...item, state: 'confirmed' }], 'confirming');
  vi.mocked(libraryApi.recent).mockResolvedValue([active]); vi.mocked(libraryApi.status).mockResolvedValue(active);
  const view = render(<ImportDialog onClose={vi.fn()} onImported={vi.fn()} />); await act(async () => {});
  fireEvent.click(screen.getByRole('button', { name: /Browser-selected captures/ })); await act(async () => {});
  await act(() => vi.advanceTimersByTimeAsync(500)); expect(libraryApi.status).toHaveBeenCalledTimes(2);
  view.unmount(); await act(() => vi.advanceTimersByTimeAsync(2000)); expect(libraryApi.status).toHaveBeenCalledTimes(2);
});
it('preserves Unicode and BOM text exactly and rejects invalid UTF-8 sidecars', async () => {
  const text = '\ufeff{ "title": "é🔥" }\r\n';
  const result = await scanSelection([new File([text], 'sample.json')], new AbortController().signal);
  expect(result.manifest.files[0].metadataText).toBe(text);
  await expect(scanSelection([new File([new Uint8Array([255])], 'bad.json')], new AbortController().signal)).rejects.toThrow(/UTF-8/);
});
it('creates browser-local previews and revokes their URLs on dialog closure', async () => {
  const revoke = vi.fn(); const create = vi.fn().mockReturnValue('blob:fixture-preview');
  vi.stubGlobal('URL', class extends URL { static createObjectURL = create; static revokeObjectURL = revoke; });
  const view = render(<ImportDialog onClose={vi.fn()} onImported={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('Choose capture files'), { target: { files: files() } });
  expect(await screen.findByRole('img', { name: 'Local preview of video/sample.json' })).toHaveAttribute('src', 'blob:fixture-preview');
  expect(create).toHaveBeenCalledOnce(); view.unmount(); expect(revoke).toHaveBeenCalledWith('blob:fixture-preview');
});
