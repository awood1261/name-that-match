import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MatchSummary } from '../../shared/src/matches';
import type { ScreenshotSummary } from '../../shared/src/imports';
import { MatchLibraryPage } from '../../client/src/library/MatchLibraryPage';
import { LibraryApiError, libraryApi, matchApi } from '../../client/src/library/api';
import App from '../../client/src/App';
const matchId = '00000000-0000-4000-8000-000000000010';
function match(fields: Partial<MatchSummary> = {}): MatchSummary {
  return { id: matchId, participantDescription: 'A vs B', promotion: 'Promotion', event: 'Event', matchDate: null, obscurity: null, stipulation: null, championshipInfo: null, notes: null,
    createdAt: '2026-11-06T00:00:00Z', updatedAt: '2026-11-06T00:00:00Z', revision: 1, complete: true, missingFields: [], ...fields };
}
function image(id: string): ScreenshotSummary {
  return { id, matchId: null, provenance: { schemaVersion: 1, captureId: id, source: { platform: 'youtube', videoId: 'abcdefghijk', canonicalUrl: 'https://www.youtube.com/watch?v=abcdefghijk' }, capture: { playbackSeconds: 42, capturedAt: '2026-11-06T00:00:00Z', method: 'video-frame-capture' }, image: { filename: `${id}.png`, width: 2, height: 1, format: 'png' } },
    image: { url: `/api/screenshots/${id}/image`, width: 2, height: 1, byteSize: 70, sha256: '0'.repeat(64) }, difficulty: null, notes: null, reviewStatus: 'pending', revision: 1, createdAt: '', updatedAt: '', assetStatus: 'available' };
}
let matches: MatchSummary[]; let images: ScreenshotSummary[];
beforeEach(() => {
  matches = [match()]; images = [image('first'), image('second')];
  vi.spyOn(matchApi, 'list').mockImplementation(async () => ({ matches: [...matches], matchedCount: matches.length, asOf: '' }));
  vi.spyOn(libraryApi, 'unassigned').mockImplementation(async () => ({ screenshots: images.filter((record) => !record.matchId), matchedCount: images.filter((record) => !record.matchId).length, asOf: '' }));
  vi.spyOn(matchApi, 'screenshots').mockImplementation(async (id) => ({ screenshots: id ? images.filter((record) => record.matchId === id) : images, matchedCount: images.length, asOf: '' }));
  vi.spyOn(matchApi, 'create').mockImplementation(async (fields) => {
    const missingFields = (['participantDescription', 'promotion', 'event'] as const).filter((key) => !fields[key]);
    const result = match({ ...fields, matchDate: fields.matchDate as MatchSummary['matchDate'], id: 'created', complete: !missingFields.length, missingFields }); matches.push(result); return result;
  });
  vi.spyOn(matchApi, 'update').mockImplementation(async (base, fields) => {
    const result = match({ ...base, ...fields, matchDate: fields.matchDate as MatchSummary['matchDate'], revision: base.revision + 1 }); matches = matches.map((item) => item.id === result.id ? result : item); return { match: result, invalidatedScreenshots: [] };
  });
  vi.spyOn(matchApi, 'assign').mockImplementation(async (members, target) => {
    const result = members.map((record) => ({ ...record, matchId: target?.id ?? null, revision: record.revision + 1 }));
    images = images.map((record) => result.find((item) => item.id === record.id) ?? record); return result;
  });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function queue() {
  fireEvent.click(screen.getByRole('button', { name: 'Unassigned screenshots' })); await screen.findByText('2 unassigned screenshots');
}
async function openExisting() { fireEvent.click(await screen.findByRole('button', { name: /^A vs B/ })); await screen.findByRole('heading', { name: 'Edit match' }); }
const change = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label, { exact: true }), { target: { value } });
const save = () => fireEvent.click(screen.getByRole('button', { name: 'Save match' }));

describe('match management workspace', () => {
  it('starts in Matches, creates an incomplete draft and keeps unknown fields unset', async () => {
    render(<MatchLibraryPage />); expect(screen.getByRole('heading', { name: 'Matches' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Create match' })); save();
    await waitFor(() => expect(matchApi.create).toHaveBeenCalledOnce());
    expect(vi.mocked(matchApi.create).mock.calls[0][0]).toEqual({ participantDescription: null, promotion: null, event: null, matchDate: null, obscurity: null, stipulation: null, championshipInfo: null, notes: null });
    expect(await screen.findByText(/Incomplete: Participants, Promotion, Event/)).toBeInTheDocument();
  });
  it.each(['iconic', 'familiar', 'obscure'])('edits partial dates, flexible participants, editorial fields and %s obscurity without screenshot edits', async (obscurity) => {
    render(<MatchLibraryPage />); await openExisting();
    change('Participants', 'Team A & Team B vs Team C'); change('Date / year', '1997-03'); change('Match obscurity', obscurity); change('Stipulation', 'Tag team'); change('Championship information', 'Tag titles'); change('Match notes', 'Editorial notes'); save();
    await waitFor(() => expect(matchApi.update).toHaveBeenCalledOnce());
    expect(vi.mocked(matchApi.update).mock.calls[0][1]).toMatchObject({ participantDescription: 'Team A & Team B vs Team C', matchDate: '1997-03', obscurity, stipulation: 'Tag team', championshipInfo: 'Tag titles', notes: 'Editorial notes' });
    expect(matchApi.assign).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /Approve|Reject/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Screenshot difficulty')).not.toBeInTheDocument();
  });
  it('preserves multiple selected screenshots through new match creation and requires a separate assignment save', async () => {
    render(<MatchLibraryPage />); await queue(); fireEvent.click(screen.getByRole('button', { name: 'Select all screenshots' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create match for selection' }));
    expect(screen.getByText('2 screenshots remain selected. Save the match, then explicitly assign them.')).toBeInTheDocument();
    change('Participants', 'New match'); change('Promotion', 'P'); change('Event', 'E'); save();
    await screen.findByRole('button', { name: 'Use this match for selected screenshots' }); expect(matchApi.assign).not.toHaveBeenCalled();
    expect(screen.getByRole('checkbox', { name: 'Select first' })).toBeChecked(); expect(screen.getByRole('checkbox', { name: 'Select second' })).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Use this match for selected screenshots' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back to screenshots' })); expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Target match')).toHaveValue('created');
    fireEvent.click(screen.getByRole('button', { name: 'Save assignment' }));
    await waitFor(() => expect(matchApi.assign).toHaveBeenCalledOnce());
    expect(vi.mocked(matchApi.assign).mock.calls[0][0].map((record) => record.id)).toEqual(['first', 'second']);
    expect(vi.mocked(matchApi.assign).mock.calls[0][1]).toMatchObject({ id: 'created', revision: 1 });
    await screen.findByText('0 unassigned screenshots'); expect(images.every((record) => record.matchId === 'created')).toBe(true);
  });
  it('assigns to an existing match and offers individual unassignment and reassignment', async () => {
    images[0].matchId = matchId; matches.push(match({ id: 'other', participantDescription: 'Other match' }));
    render(<MatchLibraryPage />); await openExisting();
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Select first' })); change('Target match', 'other');
    fireEvent.click(screen.getByRole('button', { name: 'Save assignment' })); await waitFor(() => expect(images[0].matchId).toBe('other'));
    fireEvent.click(screen.getByRole('button', { name: /^Other match/ })); fireEvent.click(await screen.findByRole('checkbox', { name: 'Select first' }));
    change('Target match', 'unassigned'); fireEvent.click(screen.getByRole('button', { name: 'Save assignment' }));
    await waitFor(() => expect(images[0].matchId).toBeNull()); expect(vi.mocked(matchApi.assign).mock.calls[1][1]).toBeNull();
  });
  it('retains drafts and associates server field validation with its control', async () => {
    vi.mocked(matchApi.update).mockRejectedValueOnce(new LibraryApiError({ code: 'INVALID_REQUEST', message: 'Invalid library data', fieldErrors: { matchDate: 'Invalid partial date' } }, 422));
    render(<MatchLibraryPage />); await openExisting(); change('Date / year', 'bad date'); save();
    expect(await screen.findByText('Invalid partial date')).toBeInTheDocument();
    expect(screen.getByLabelText('Date / year')).toHaveValue('bad date'); expect(screen.getByLabelText('Date / year')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Date / year')).toHaveAccessibleDescription('Invalid partial date');
    change('Date / year', '2024'); save(); await waitFor(() => expect(matchApi.update).toHaveBeenCalledTimes(2));
  });
  it('keeps screenshot assignment and match drafts independent through save and cancel', async () => {
    render(<MatchLibraryPage />); await queue(); fireEvent.click(screen.getByRole('checkbox', { name: 'Select first' })); change('Target match', matchId);
    fireEvent.click(screen.getByRole('button', { name: 'Create match for selection' })); change('Participants', 'Unsaved match draft');
    fireEvent.click(screen.getByRole('button', { name: 'Save assignment' })); await waitFor(() => expect(matchApi.assign).toHaveBeenCalledOnce());
    expect(screen.getByLabelText('Participants')).toHaveValue('Unsaved match draft'); expect(matchApi.create).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel match changes' })); expect(screen.queryByRole('heading', { name: 'Create match' })).not.toBeInTheDocument();
    expect(images[0].matchId).toBe(matchId);
  });
  it('offers Save/Discard/Stay for view changes and cancels without writing', async () => {
    render(<MatchLibraryPage />); await openExisting(); change('Event', 'Unsaved event');
    fireEvent.click(screen.getByRole('button', { name: 'Unassigned screenshots' }));
    let dialog = await screen.findByRole('dialog', { name: 'Unsaved changes' }); expect(within(dialog).getByRole('button', { name: 'Stay' })).toHaveFocus();
    fireEvent.keyDown(dialog, { key: 'Escape' }); expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); expect(screen.getByLabelText('Event')).toHaveValue('Unsaved event');
    fireEvent.click(screen.getByRole('button', { name: 'Unassigned screenshots' })); dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Discard and continue' })); await screen.findByText('2 unassigned screenshots'); expect(matchApi.update).not.toHaveBeenCalled();
  });
  it('saves affected drafts before navigating and stays when a save fails', async () => {
    render(<MatchLibraryPage />); await openExisting(); change('Event', 'Save before leaving');
    vi.mocked(matchApi.update).mockRejectedValueOnce(new Error('offline'));
    fireEvent.click(screen.getByRole('button', { name: 'Back to screenshots' })); fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Save and continue' }));
    expect(await within(screen.getByRole('dialog')).findByRole('alert')).toHaveTextContent('Match save failed');
    fireEvent.click(screen.getByRole('button', { name: 'Stay' })); expect(screen.getByLabelText('Event')).toHaveValue('Save before leaving');
    fireEvent.click(screen.getByRole('button', { name: 'Back to screenshots' })); fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Save and continue' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Edit match' })).not.toBeInTheDocument());
    expect(matchApi.update).toHaveBeenCalledTimes(2);
  });
  it('loads competing match values and requires deliberate comparison before retry with the current revision', async () => {
    render(<MatchLibraryPage />); await openExisting(); change('Event', 'My event');
    matches = [match({ event: 'Other editor event', revision: 2 })];
    vi.mocked(matchApi.update).mockRejectedValueOnce(new LibraryApiError({ code: 'REVISION_CONFLICT', message: 'Conflict', currentRevision: 2 }, 409)); save();
    expect(await screen.findByRole('region', { name: 'Current server match' })).toHaveTextContent('Other editor event');
    expect(screen.getByLabelText('Event')).toHaveValue('My event'); expect(screen.getByRole('button', { name: 'Save match' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Use reviewed server revision' })).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: 'I compared my draft with the current server values' }));
    fireEvent.click(screen.getByRole('button', { name: 'Use reviewed server revision' })); expect(matchApi.update).toHaveBeenCalledOnce(); save();
    await waitFor(() => expect(matchApi.update).toHaveBeenCalledTimes(2));
    expect(vi.mocked(matchApi.update).mock.calls[1][0].revision).toBe(2); expect(vi.mocked(matchApi.update).mock.calls[1][1].event).toBe('My event');
  });
  it('retains all selected members and target on a stale assignment and reloads revisions only explicitly', async () => {
    render(<MatchLibraryPage />); await queue(); fireEvent.click(screen.getByRole('button', { name: 'Select all screenshots' })); change('Target match', matchId);
    images = images.map((record) => ({ ...record, revision: 2 })); matches = [match({ revision: 2 })];
    vi.mocked(matchApi.assign).mockRejectedValueOnce(new LibraryApiError({ code: 'REVISION_CONFLICT', message: 'Conflict' }, 409)); fireEvent.click(screen.getByRole('button', { name: 'Save assignment' }));
    await screen.findByRole('region', { name: 'Current assignment records' }); expect(screen.getByRole('checkbox', { name: 'Select first' })).toBeChecked(); expect(screen.getByLabelText('Target match')).toHaveValue(matchId);
    expect(screen.getByRole('button', { name: 'Save assignment' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Use reviewed selection and target revisions' })); expect(matchApi.assign).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Save assignment' })); await waitFor(() => expect(matchApi.assign).toHaveBeenCalledTimes(2));
    expect(vi.mocked(matchApi.assign).mock.calls[1][0].every((record) => record.revision === 2)).toBe(true); expect(vi.mocked(matchApi.assign).mock.calls[1][1]).toMatchObject({ revision: 2 });
  });
  it('guards in-app System navigation and enables the supported browser unload prompt for dirty work', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'ok', service: 'name-that-match-server', timestamp: '2026-11-06T00:00:00Z' }) }));
    render(<App />); fireEvent.click(screen.getByRole('button', { name: 'Image Library' })); await openExisting(); change('Event', 'Keep me');
    const event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event); expect(event.defaultPrevented).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'System' })); fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Stay' }));
    expect(screen.getByLabelText('Event')).toHaveValue('Keep me');
    fireEvent.click(screen.getByRole('button', { name: 'System' })); fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Discard and continue' }));
    expect(await screen.findByRole('heading', { name: 'System status' })).toBeInTheDocument();
    const cleanEvent = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(cleanEvent); expect(cleanEvent.defaultPrevented).toBe(false);
  });
  it('preserves an assignment draft when cancelling only match edits', async () => {
    render(<MatchLibraryPage />); await queue(); fireEvent.click(screen.getByRole('checkbox', { name: 'Select first' })); change('Target match', matchId);
    fireEvent.click(screen.getByRole('button', { name: 'Create match for selection' })); change('Participants', 'Discard only these fields');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel match changes' }));
    expect(screen.getByLabelText('Target match')).toHaveValue(matchId); expect(screen.getByRole('checkbox', { name: 'Select first' })).toBeChecked(); expect(matchApi.assign).not.toHaveBeenCalled();
  });
  it('saves both affected drafts before a guarded view change', async () => {
    images[0].matchId = matchId; matches.push(match({ id: 'other', participantDescription: 'Other target' }));
    render(<MatchLibraryPage />); await openExisting(); fireEvent.click(await screen.findByRole('checkbox', { name: 'Select first' }));
    change('Target match', 'other'); change('Event', 'Match draft');
    fireEvent.click(screen.getByRole('button', { name: 'Unassigned screenshots' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Save and continue' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(matchApi.update).toHaveBeenCalledOnce(); expect(matchApi.assign).toHaveBeenCalledOnce();
    expect(matches.find((item) => item.id === matchId)?.event).toBe('Match draft'); expect(images[0].matchId).toBe('other');
    expect(screen.getByRole('heading', { name: 'Unassigned screenshots' })).toBeInTheDocument();
  });
  it('guards changes to an assignment selection without discarding an independent match draft', async () => {
    render(<MatchLibraryPage />); await queue(); fireEvent.click(screen.getByRole('button', { name: 'Select all screenshots' })); change('Target match', matchId);
    fireEvent.click(screen.getByRole('button', { name: 'Create match for selection' })); change('Participants', 'Independent draft');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select second' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Stay' }));
    expect(screen.getByRole('checkbox', { name: 'Select second' })).toBeChecked();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select second' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Discard and continue' }));
    expect(screen.getByRole('checkbox', { name: 'Select first' })).toBeChecked(); expect(screen.getByRole('checkbox', { name: 'Select second' })).not.toBeChecked();
    expect(screen.getByLabelText('Target match')).toHaveValue(''); expect(screen.getByLabelText('Participants')).toHaveValue('Independent draft');
    expect(matchApi.assign).not.toHaveBeenCalled(); expect(matchApi.create).not.toHaveBeenCalled();
  });
  it('saves only the match draft when closing its inspector, retaining the assignment draft', async () => {
    images[0].matchId = matchId; matches.push(match({ id: 'other', participantDescription: 'Other target' }));
    render(<MatchLibraryPage />); await openExisting(); fireEvent.click(await screen.findByRole('checkbox', { name: 'Select first' })); change('Target match', 'other'); change('Event', 'Changed');
    fireEvent.click(screen.getByRole('button', { name: 'Back to screenshots' })); fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Save and continue' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Edit match' })).not.toBeInTheDocument());
    expect(matchApi.update).toHaveBeenCalledOnce(); expect(matchApi.assign).not.toHaveBeenCalled(); expect(screen.getByLabelText('Target match')).toHaveValue('other');
  });
  it('can explicitly discard a stale match draft by reloading server values without saving', async () => {
    render(<MatchLibraryPage />); await openExisting(); change('Event', 'My unsaved event');
    matches = [match({ event: 'Current server event', revision: 2 })]; vi.mocked(matchApi.update).mockRejectedValueOnce(new LibraryApiError({ code: 'REVISION_CONFLICT', message: 'Conflict' }, 409)); save();
    fireEvent.click(await screen.findByRole('button', { name: 'Reload server values' }));
    expect(screen.getByLabelText('Event')).toHaveValue('Current server event'); expect(matchApi.update).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Back to screenshots' })); expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('uses this operator\'s newly saved target revision when Save and continue saves both drafts', async () => {
    render(<MatchLibraryPage />); await queue(); fireEvent.click(screen.getByRole('button', { name: 'Select all screenshots' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create match for selection' })); change('Participants', 'New target'); save();
    fireEvent.click(await screen.findByRole('button', { name: 'Use this match for selected screenshots' })); change('Event', 'Save this target edit too');
    fireEvent.click(screen.getByRole('button', { name: 'Unassigned screenshots' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Save and continue' }));
    await waitFor(() => expect(matchApi.assign).toHaveBeenCalledOnce());
    expect(vi.mocked(matchApi.assign).mock.calls[0][1]).toMatchObject({ id: 'created', revision: 2 });
    expect(vi.mocked(matchApi.assign).mock.calls[0][0]).toHaveLength(2); await screen.findByText('0 unassigned screenshots');
  });
});
