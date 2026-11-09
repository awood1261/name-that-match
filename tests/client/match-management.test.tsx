import { classify } from '../../shared/src/classification';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MatchSummary } from '../../shared/src/matches';
import type { ScreenshotSummary } from '../../shared/src/imports';
import { MatchLibraryPage } from '../../client/src/library/MatchLibraryPage';
import { LibraryApiError, libraryApi, matchApi, reviewApi } from '../../client/src/library/api';
import App from '../../client/src/App';
const matchId = '00000000-0000-4000-8000-000000000010';
function match(fields: Partial<MatchSummary> = {}): MatchSummary {
  return { id: matchId, participantDescription: 'A vs B', promotion: 'Promotion', event: 'Event', matchDate: null, obscurity: null, stipulation: null, championshipInfo: null, notes: null,
    createdAt: '2026-11-06T00:00:00Z', updatedAt: '2026-11-06T00:00:00Z', revision: 1, matchingScreenshotCount: 0, screenshotCount: 0, approvedCount: 0, eligibleCount: 0, awaitingClassificationCount: 0, classificationIncomplete: true, complete: true, missingFields: [], ...fields };
}
function image(id: string): ScreenshotSummary {
  return { id, matchId: null, provenance: { schemaVersion: 1, captureId: id, source: { platform: 'youtube', videoId: 'abcdefghijk', canonicalUrl: 'https://www.youtube.com/watch?v=abcdefghijk' }, capture: { playbackSeconds: 42, capturedAt: '2026-11-06T00:00:00Z', method: 'video-frame-capture' }, image: { filename: `${id}.png`, width: 2, height: 1, format: 'png' } },
    image: { url: `/api/screenshots/${id}/image`, width: 2, height: 1, byteSize: 70, sha256: '0'.repeat(64) }, difficulty: null, notes: null, reviewStatus: 'pending', revision: 1, createdAt: '', updatedAt: '', assetStatus: 'available', classification: { complete: false, tier: null, points: null }, eligibility: { eligible: false, reasons: ['unassigned', 'unrated', 'pending_review'] }, matchRevision: null };
}
function filteredImages(records: ScreenshotSummary[], query = '') {
  const filters = new URLSearchParams(query);
  return records.filter((record) => {
    const tier = classify(matches.find((match) => match.id === record.matchId)?.obscurity ?? null, record.difficulty).tier;
    return [['difficulty', record.difficulty ?? 'unrated'], ['review', record.reviewStatus], ['tier', tier ?? 'unclassified']].every(([key, value]) => !filters.has(key) || filters.get(key)!.split(',').includes(value));
  });
}
let matches: MatchSummary[]; let images: ScreenshotSummary[];
beforeEach(() => {
  vi.spyOn(reviewApi, 'statistics').mockResolvedValue({ totalMatches: 1, totalScreenshots: 2, fullyClassifiedScreenshots: 0, awaitingClassificationScreenshots: 2, classifiedByTier: { squash: 0, competitive: 0, deathmatch: 0 }, eligibleByTier: { squash: 0, competitive: 0, deathmatch: 0 }, asOf: '' });
  matches = [match()]; images = [image('first'), image('second')];
  vi.spyOn(matchApi, 'list').mockImplementation(async (_signal, query = '') => ({ matches: matches.map((match) => ({ ...match, matchingScreenshotCount: filteredImages(images.filter((record) => record.matchId === match.id), query).length, screenshotCount: images.filter((record) => record.matchId === match.id).length })), matchedCount: matches.length, asOf: '' }));
  vi.spyOn(libraryApi, 'unassigned').mockImplementation(async () => ({ screenshots: images.filter((record) => !record.matchId), matchedCount: images.filter((record) => !record.matchId).length, asOf: '' }));
  vi.spyOn(matchApi, 'screenshots').mockImplementation(async (id, _signal, query = '') => ({ screenshots: filteredImages(id ? images.filter((record) => record.matchId === id) : images, query), matchedCount: images.length, asOf: '' }));
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
async function openExisting() { fireEvent.click(await screen.findByRole('button', { name: /^A vs B/ })); fireEvent.click(await screen.findByRole('button', { name: 'Edit match details' })); await screen.findByRole('heading', { name: 'Edit match' }); }
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
  it.each(['low', 'medium', 'high'])('edits partial dates, flexible participants, editorial fields and %s obscurity without screenshot edits', async (obscurity) => {
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
    fireEvent.click(screen.getByRole('button', { name: 'Back to match results' }));
    fireEvent.click(await screen.findByRole('button', { name: /^Other match/ })); fireEvent.click(await screen.findByRole('checkbox', { name: 'Select first' }));
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

describe('individual screenshot classification and review', () => {
  beforeEach(() => {
    matches = [match({ obscurity: 'low' })];
    images = images.map((record) => ({ ...record, matchId, matchRevision: 1 }));
    const project = (record: ScreenshotSummary): ScreenshotSummary => {
      const parent = matches.find((item) => item.id === record.matchId);
      const classification = classify(parent?.obscurity ?? null, record.difficulty);
      const reasons = [...(!parent ? ['unassigned'] : parent.obscurity === null ? ['obscurity_unset'] : []), ...(record.difficulty === null ? ['unrated'] : []), ...(record.reviewStatus !== 'approved' ? [`${record.reviewStatus}_review`] : [])];
      return { ...record, matchRevision: parent?.revision ?? null, classification: { ...classification, complete: classification.tier !== null }, eligibility: { eligible: !reasons.length, reasons } };
    };
    vi.mocked(matchApi.screenshots).mockImplementation(async (_id, _signal, query = '') => ({ screenshots: filteredImages(images.map(project), query), matchedCount: images.length, asOf: '' }));
    vi.spyOn(reviewApi, 'edit').mockImplementation(async (base, changes) => {
      const record = project({ ...base, ...changes, revision: base.revision + 1, reviewStatus: changes.difficulty !== base.difficulty && base.reviewStatus === 'approved' ? 'pending' : base.reviewStatus });
      images = images.map((item) => item.id === record.id ? record : item); return record;
    });
    vi.spyOn(reviewApi, 'review').mockImplementation(async (base, reviewStatus) => {
      const record = project({ ...base, reviewStatus, revision: base.revision + 1 }); images = images.map((item) => item.id === record.id ? record : item); return record;
    });
  });
  const openReview = async () => { await openExisting(); fireEvent.click(await screen.findByRole('button', { name: 'Review capture first' })); await screen.findByRole('heading', { name: 'Review screenshot' }); };
  it('saves independent difficulty/notes with read-only tier, explicit review and separate match drafts', async () => {
    render(<MatchLibraryPage />); await openExisting(); change('Match notes', 'Keep match draft');
    fireEvent.click(await screen.findByRole('button', { name: 'Review capture first' }));
    expect(screen.getByRole('button', { name: 'Approve screenshot' })).toBeDisabled();
    change('Screenshot difficulty', 'hard'); change('Screenshot notes', 'Image clues');
    expect(reviewApi.edit).not.toHaveBeenCalled(); expect(within(screen.getByRole('complementary', { name: 'Review screenshot' })).getByText('Unclassified', { exact: true })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save screenshot' }));
    await waitFor(() => expect(reviewApi.edit).toHaveBeenCalledOnce());
    expect(await screen.findByText('Competitive Match · 2 points')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Approve screenshot' }));
    await screen.findByText(/Review: approved/); expect(reviewApi.review).toHaveBeenCalledWith(expect.objectContaining({ difficulty: 'hard', matchRevision: 1 }), 'approved', expect.any(AbortSignal));
    expect(matchApi.update).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Back to collection' })); expect(screen.getByLabelText('Match notes')).toHaveValue('Keep match draft');
  });
  it('guards screenshot navigation and retains failed saves, then allows deliberate discard', async () => {
    render(<MatchLibraryPage />); await openReview(); change('Screenshot notes', 'Unsaved');
    fireEvent.click(screen.getByRole('button', { name: 'Next screenshot' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument(); fireEvent.click(screen.getByRole('button', { name: 'Stay' }));
    expect(screen.getByLabelText('Screenshot notes')).toHaveValue('Unsaved');
    vi.mocked(reviewApi.edit).mockRejectedValueOnce(new LibraryApiError({ code: 'INVALID_REQUEST', message: 'Notes invalid', fieldErrors: { notes: 'Too long' } }, 422));
    fireEvent.click(screen.getByRole('button', { name: 'Next screenshot' })); fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }));
    await screen.findByText('Screenshot save failed. Your draft is retained.'); expect(screen.getByLabelText('Screenshot notes')).toHaveValue('Unsaved');
    fireEvent.click(screen.getByRole('button', { name: 'Discard and continue' }));
    expect(await screen.findByAltText('Selected capture second')).toBeInTheDocument(); expect(screen.getByLabelText('Screenshot notes')).toHaveValue('');
  });
  it('keeps stale screenshot drafts and requires deliberate revision reconciliation', async () => {
    render(<MatchLibraryPage />); await openReview(); change('Screenshot difficulty', 'easy');
    images[0] = { ...images[0], revision: 2, notes: 'Other editor' };
    vi.mocked(reviewApi.edit).mockRejectedValueOnce(new LibraryApiError({ code: 'REVISION_CONFLICT', message: 'Stale', currentRevision: 2 }, 409));
    fireEvent.click(screen.getByRole('button', { name: 'Save screenshot' }));
    await screen.findByRole('region', { name: 'Current server screenshot' });
    expect(screen.getByLabelText('Screenshot difficulty')).toHaveValue('easy'); expect(screen.getByRole('button', { name: 'Use reviewed screenshot revision' })).toBeDisabled();
    fireEvent.click(screen.getByLabelText('I compared the current server values')); fireEvent.click(screen.getByRole('button', { name: 'Use reviewed screenshot revision' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save screenshot' }));
    await screen.findByText('Squash Match · 1 point'); expect(vi.mocked(reviewApi.edit).mock.calls[1][0].revision).toBe(2);
  });
  it('refreshes saved projections after parent obscurity changes and supports cancel/review states without rating other screenshots', async () => {
    images[0] = { ...images[0], difficulty: 'hard' };
    render(<MatchLibraryPage />); await openReview(); expect(screen.getByText('Competitive Match · 2 points')).toBeInTheDocument();
    change('Screenshot difficulty', 'easy'); fireEvent.click(screen.getByRole('button', { name: 'Cancel screenshot changes' })); expect(screen.getByLabelText('Screenshot difficulty')).toHaveValue('hard');
    fireEvent.click(screen.getByRole('button', { name: 'Back to collection' })); change('Match obscurity', 'high'); save(); await waitFor(() => expect(matchApi.update).toHaveBeenCalledOnce());
    fireEvent.click(await screen.findByRole('button', { name: 'Review capture first' })); await screen.findByText('Deathmatch · 3 points');
    fireEvent.click(screen.getByRole('button', { name: 'Reject screenshot' })); await screen.findByText(/Review: rejected/);
    fireEvent.click(screen.getByRole('button', { name: 'Mark pending' })); await screen.findByText(/Review: pending/);
    expect(images[1].difficulty).toBeNull(); expect(reviewApi.edit).not.toHaveBeenCalled();
  });
  it('preserves screenshot drafts while creating/canceling a new match', async () => {
    render(<MatchLibraryPage />); await openReview(); change('Screenshot notes', 'Keep screenshot draft');
    fireEvent.click(screen.getByRole('button', { name: 'Create match' }));
    expect(screen.getByRole('heading', { name: 'Create match' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel match changes' }));
    expect(screen.getByLabelText('Screenshot notes')).toHaveValue('Keep screenshot draft');
  });
  it('saves match, screenshot and assignment drafts deliberately before a view change', async () => {
    render(<MatchLibraryPage />); await openExisting(); change('Match notes', 'Match draft');
    fireEvent.click(await screen.findByLabelText('Select first')); change('Target match', 'unassigned');
    fireEvent.click(screen.getByRole('button', { name: 'Review capture first' })); change('Screenshot difficulty', 'easy');
    fireEvent.click(screen.getByRole('button', { name: 'Unassigned screenshots' })); fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }));
    await screen.findByRole('heading', { name: 'Unassigned screenshots' });
    expect(matchApi.update).toHaveBeenCalledOnce(); expect(reviewApi.edit).toHaveBeenCalledOnce(); expect(matchApi.assign).toHaveBeenCalledOnce();
    expect(vi.mocked(matchApi.assign).mock.calls[0][0][0].revision).toBe(2);
    expect(images[0]).toMatchObject({ difficulty: 'easy', matchId: null });
  });
  it('keeps global statistics and view-specific filters separate', async () => {
    vi.mocked(reviewApi.statistics).mockResolvedValue({ totalMatches: 4, totalScreenshots: 24, fullyClassifiedScreenshots: 24, awaitingClassificationScreenshots: 0, classifiedByTier: { squash: 3, competitive: 7, deathmatch: 14 }, eligibleByTier: { squash: 3, competitive: 6, deathmatch: 0 }, asOf: '' });
    render(<MatchLibraryPage />); await screen.findByRole('button', { name: /^A vs B/ });
    fireEvent.click(screen.getByText('Search and filters')); change('Search matches', '100%_');
    fireEvent.click(within(screen.getByRole('group', { name: 'Filter obscurity' })).getByLabelText('Low'));
    await waitFor(() => expect(matchApi.list).toHaveBeenLastCalledWith(expect.any(AbortSignal), 'q=100%25_&obscurity=low'));
    fireEvent.click(screen.getByRole('button', { name: 'Unassigned screenshots' })); await waitFor(() => expect(libraryApi.unassigned).toHaveBeenLastCalledWith(expect.any(AbortSignal), ''));
    fireEvent.click(screen.getByRole('button', { name: 'Matches' })); await waitFor(() => expect(screen.getByLabelText('Search matches')).toHaveValue('100%_'));
    expect(within(screen.getByRole('region', { name: 'Entire library statistics' })).getByText('Fully classified')).toBeInTheDocument();
    const totals = within(screen.getByRole('region', { name: 'Entire library statistics' }));
    expect(totals.getByText('Screenshots').nextElementSibling).toHaveTextContent('24');
    expect(totals.getByText('Classified Deathmatch').nextElementSibling).toHaveTextContent('14');
    expect(totals.getByText('Eligible Deathmatch').nextElementSibling).toHaveTextContent('0');
    expect(totals.getByText(/Pending or rejected screenshots are excluded/)).toBeInTheDocument();
    images = []; fireEvent.click(screen.getByRole('button', { name: 'Unassigned screenshots' }));
    await screen.findByText('0 unassigned screenshots');
    expect(screen.getByText(/Assigned screenshots are available in Matches/)).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('group', { name: 'Filter review' })).getByLabelText('pending'));
    await screen.findByText(/No unassigned screenshots match the active filters/);
    expect(totals.getByText('Screenshots').nextElementSibling).toHaveTextContent('24');
  });
  it('uses the same difficulty/review/tier subset for selection, thumbnails and navigation', async () => {
    images = [{ ...images[0], difficulty: 'easy', reviewStatus: 'approved' }, { ...images[1], difficulty: 'medium', reviewStatus: 'approved' }, { ...image('third'), matchId, difficulty: 'easy', matchRevision: 1 }];
    vi.mocked(reviewApi.statistics).mockResolvedValue({ totalMatches: 1, totalScreenshots: 3, fullyClassifiedScreenshots: 3, awaitingClassificationScreenshots: 0, classifiedByTier: { squash: 3, competitive: 0, deathmatch: 0 }, eligibleByTier: { squash: 2, competitive: 0, deathmatch: 0 }, asOf: '' });
    render(<MatchLibraryPage />); await screen.findByRole('button', { name: /^A vs B/ }); fireEvent.click(screen.getByText('Search and filters'));
    for (const [group, label] of [['Filter visual difficulty', 'Easy'], ['Filter review', 'approved'], ['Filter game tier', 'Squash Match']]) fireEvent.click(within(screen.getByRole('group', { name: group })).getByLabelText(label));
    fireEvent.click(await screen.findByRole('button', { name: /^A vs B/ })); await screen.findByText('Showing 1 of 3 screenshots');
    expect(matchApi.screenshots).toHaveBeenCalledWith(matchId, expect.any(AbortSignal), 'difficulty=easy&review=approved&tier=squash');
    fireEvent.click(screen.getByRole('button', { name: 'Select all screenshots' })); expect(screen.getByRole('checkbox', { name: 'Select first' })).toBeChecked(); expect(screen.queryByRole('checkbox', { name: 'Select second' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Review capture first' }));
    expect(screen.getByRole('button', { name: 'Previous screenshot' })).toBeDisabled(); expect(screen.getByRole('button', { name: 'Next screenshot' })).toBeDisabled(); expect(within(screen.getByRole('navigation', { name: 'Screenshot thumbnails' })).getAllByRole('button')).toHaveLength(1);
    expect(within(screen.getByRole('region', { name: 'Entire library statistics' })).getByText('Screenshots').nextElementSibling).toHaveTextContent('3');
  });
  it('removes saved nonmatching images, preserves other drafts and shows empty results with current full counts', async () => {
    images[0].difficulty = 'easy'; images[1].difficulty = 'hard';
    vi.mocked(matchApi.list).mockImplementation(async (_signal, query = '') => {
      const result = matches.map((match) => ({ ...match, screenshotCount: images.filter((record) => record.matchId === match.id).length })).filter((match) => !query || filteredImages(images.filter((record) => record.matchId === match.id), query).length > 0);
      return { matches: result, matchedCount: result.length, asOf: '' };
    });
    render(<MatchLibraryPage />); await screen.findByRole('button', { name: /^A vs B/ }); fireEvent.click(screen.getByText('Search and filters')); fireEvent.click(within(screen.getByRole('group', { name: 'Filter game tier' })).getByLabelText('Squash Match'));
    fireEvent.click(await screen.findByRole('button', { name: /^A vs B/ })); await screen.findByText('Showing 1 of 2 screenshots'); fireEvent.click(screen.getByRole('button', { name: 'Edit match details' })); change('Match notes', 'Keep independent match draft');
    fireEvent.click(screen.getByRole('button', { name: 'Review capture first' })); change('Screenshot difficulty', 'hard'); fireEvent.click(screen.getByRole('button', { name: 'Save screenshot' }));
    await screen.findByText('No screenshots match the active filters. Change or clear the filters to see more screenshots.'); expect(screen.getByText('Showing 0 of 2 screenshots')).toBeInTheDocument();
    expect(screen.getByLabelText('Match notes')).toHaveValue('Keep independent match draft'); expect(within(screen.getByRole('group', { name: 'Filter game tier' })).getByLabelText('Squash Match')).toBeChecked(); expect(matchApi.update).not.toHaveBeenCalled();
    expect(vi.mocked(matchApi.list).mock.calls.some((args) => args.length === 1)).toBe(true);
  });

});

describe('match result and editing context separation', () => {
  const filterLow = () => fireEvent.click(within(screen.getByRole('group', { name: 'Filter obscurity' })).getByLabelText('Low'));
  const filters = () => fireEvent.click(screen.getByText('Search and filters'));
  const lowCheckbox = () => within(screen.getByRole('group', { name: 'Filter obscurity' })).getByLabelText('Low');
  it('opens a named filtered collection separately from metadata editing and retains filters on Back', async () => {
    images = images.map((record, index) => ({ ...record, matchId, difficulty: index ? 'hard' : 'easy' }));
    render(<MatchLibraryPage />); await screen.findByRole('button', { name: /^A vs B/ }); filters(); filterLow();
    fireEvent.click(within(screen.getByRole('group', { name: 'Filter visual difficulty' })).getByLabelText('Hard'));
    await waitFor(() => expect(matchApi.list).toHaveBeenLastCalledWith(expect.any(AbortSignal), 'obscurity=low&difficulty=hard'));
    fireEvent.click(await screen.findByRole('button', { name: /^A vs B/ }));
    expect(await screen.findByRole('heading', { name: 'A vs B' })).toHaveFocus();
    expect(screen.queryByRole('heading', { name: 'Edit match' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Match results' })).not.toBeInTheDocument();
    expect(screen.getByText(/Only screenshots matching the active/)).toBeInTheDocument();
    await screen.findByText('Showing 1 of 2 screenshots'); expect(screen.queryByRole('checkbox', { name: 'Select first' })).not.toBeInTheDocument(); expect(screen.getByRole('checkbox', { name: 'Select second' })).toBeInTheDocument();
    expect(matchApi.screenshots).toHaveBeenCalledWith(matchId, expect.any(AbortSignal), 'difficulty=hard');
    fireEvent.click(screen.getByRole('button', { name: 'Edit match details' })); expect(screen.getByText('Editing match: A vs B')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back to screenshots' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back to match results' }));
    await screen.findByRole('heading', { name: 'Match results' }); expect(lowCheckbox()).toBeChecked();
    expect(within(screen.getByRole('group', { name: 'Filter visual difficulty' })).getByLabelText('Hard')).toBeChecked();
    expect(screen.queryByRole('checkbox', { name: 'Select first' })).not.toBeInTheDocument();
  });
  it('clears an excluded editor and collection, and ignores their delayed screenshot response', async () => {
    matches = [match({ obscurity: 'low' }), match({ id: 'other', participantDescription: 'Other match', obscurity: 'medium' })];
    vi.mocked(matchApi.list).mockImplementation(async (_signal, query = '') => {
      const filtered = new URLSearchParams(query).has('obscurity') ? matches.filter((item) => item.obscurity === 'low') : matches;
      return { matches: filtered, matchedCount: filtered.length, asOf: '' };
    });
    let resolveImages!: (result: { screenshots: ScreenshotSummary[]; matchedCount: number; asOf: string }) => void;
    vi.mocked(matchApi.screenshots).mockImplementationOnce(() => new Promise((resolve) => { resolveImages = resolve; }));
    render(<MatchLibraryPage />); fireEvent.click(await screen.findByRole('button', { name: /^Other match/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit match details' })); expect(screen.getByLabelText('Participants')).toHaveValue('Other match');
    filters(); filterLow();
    await screen.findByRole('button', { name: /^A vs B/ }); expect(screen.queryByLabelText('Participants')).not.toBeInTheDocument(); expect(screen.queryByRole('heading', { name: 'Other match' })).not.toBeInTheDocument();
    expect(vi.mocked(matchApi.screenshots).mock.calls[0][1].aborted).toBe(true);
    await act(async () => resolveImages({ screenshots: [{ ...image('late-other'), matchId: 'other' }], matchedCount: 1, asOf: '' }));
    expect(screen.queryByRole('checkbox', { name: 'Select late-other' })).not.toBeInTheDocument(); expect(screen.queryByRole('button', { name: /^Other match/ })).not.toBeInTheDocument();
  });
  it.each(['match', 'screenshot', 'assignment'] as const)('guards dirty %s work before filtering; Stay retains it and Discard clears the prior context', async (kind) => {
    images[0].matchId = matchId;
    render(<MatchLibraryPage />); await openExisting();
    if (kind === 'match') change('Match notes', 'Keep this draft');
    if (kind === 'screenshot') { fireEvent.click(await screen.findByRole('button', { name: 'Review capture first' })); change('Screenshot notes', 'Keep this draft'); }
    if (kind === 'assignment') { fireEvent.click(await screen.findByRole('checkbox', { name: 'Select first' })); change('Target match', 'unassigned'); }
    filters(); filterLow(); fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Stay' }));
    expect(lowCheckbox()).not.toBeChecked();
    expect(screen.getByLabelText(kind === 'match' ? 'Match notes' : kind === 'screenshot' ? 'Screenshot notes' : 'Target match')).toHaveValue(kind === 'assignment' ? 'unassigned' : 'Keep this draft');
    filterLow(); fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Discard and continue' }));
    await screen.findByRole('heading', { name: 'Match results' }); expect(lowCheckbox()).toBeChecked();
    expect(screen.queryByLabelText('Participants')).not.toBeInTheDocument(); expect(screen.queryByLabelText('Screenshot notes')).not.toBeInTheDocument(); expect(screen.queryByLabelText('Target match')).not.toBeInTheDocument();
    expect(matchApi.update).not.toHaveBeenCalled(); expect(matchApi.assign).not.toHaveBeenCalled();
  });
  it('keeps search focus while clearing a clean screenshot selection and collection', async () => {
    images[0].matchId = matchId;
    render(<MatchLibraryPage />); await openExisting();
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Select first' })); filters();
    const search = screen.getByLabelText('Search matches'); search.focus();
    fireEvent.change(search, { target: { value: 'A' } });
    await screen.findByRole('heading', { name: 'Match results' });
    expect(search).toHaveFocus(); expect(search).toHaveValue('A');
    expect(screen.queryByLabelText('Target match')).not.toBeInTheDocument(); expect(screen.queryByLabelText('Participants')).not.toBeInTheDocument();
  });
  it('does not apply a filter when saving fails, then applies it after an explicit successful save', async () => {
    render(<MatchLibraryPage />); await openExisting(); change('Event', 'Saved before filtering'); filters();
    vi.mocked(matchApi.update).mockRejectedValueOnce(new Error('offline'));
    filterLow(); fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Save and continue' }));
    await screen.findByText('Match save failed. Stay to review the retained draft.'); expect(lowCheckbox()).not.toBeChecked(); expect(screen.getByLabelText('Event')).toHaveValue('Saved before filtering');
    fireEvent.click(screen.getByRole('button', { name: 'Stay' })); filterLow(); fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Save and continue' }));
    await screen.findByRole('heading', { name: 'Match results' }); expect(lowCheckbox()).toBeChecked(); expect(matches[0].event).toBe('Saved before filtering'); expect(screen.queryByLabelText('Event')).not.toBeInTheDocument();
  });
});

it('shows matching screenshot counts on filtered cards and labels other counts as full-match totals', async () => {
  matches = [match({ obscurity: 'medium', approvedCount: 5, eligibleCount: 5 })];
  images = Array.from({ length: 5 }, (_, index) => ({ ...image(`capture-${index}`), matchId, difficulty: (index < 3 ? 'medium' : 'easy') as ScreenshotSummary['difficulty'], reviewStatus: 'approved' as const }));
  render(<MatchLibraryPage />); await screen.findByRole('button', { name: /^A vs B/ }); fireEvent.click(screen.getByText('Search and filters'));
  fireEvent.click(within(screen.getByRole('group', { name: 'Filter visual difficulty' })).getByLabelText('Medium'));
  const card = await screen.findByRole('button', { name: /3 matching screenshots of 5 total/ });
  expect(within(card).getByText('Full match totals: 5 approved · 5 eligible · 0 awaiting classification')).toBeInTheDocument();
  fireEvent.click(card); await screen.findByText('Showing 3 of 5 screenshots');
  fireEvent.click(screen.getByRole('button', { name: 'Back to match results' })); await screen.findByRole('button', { name: /3 matching screenshots of 5 total/ });
  fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
  const unfiltered = await screen.findByRole('button', { name: /^A vs B/ }); expect(within(unfiltered).getByText('5 screenshots')).toBeInTheDocument(); expect(within(unfiltered).queryByText(/matching screenshots/)).not.toBeInTheDocument();
});
