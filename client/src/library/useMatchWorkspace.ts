import type { Difficulty, ReviewStatus } from '../../../shared/src/library';
import type { LibraryStatistics } from '../../../shared/src/classification';
import { useEffect, useRef, useState } from 'react';
import type { ApiFailure, ScreenshotSummary } from '../../../shared/src/imports';
import type { MatchSummary, MatchUpdate } from '../../../shared/src/matches';
import { LibraryApiError, libraryApi, matchApi, reviewApi, screenshotFilterQuery } from './api';
import { draftChanged, draftFor, matchPayload, type MatchDraft } from './match-draft';

type Scope = 'all' | 'match' | 'assignment' | 'screenshot';
export type NavigationGuard = (action: () => void) => void;
export interface MatchEditor { base: MatchSummary | null; draft: MatchDraft; errors: Record<string, string>; error: string; current?: MatchSummary }
export function useMatchWorkspace(registerGuard?: (guard: NavigationGuard | null) => void) {
  const [showScreenshot, setShowScreenshot] = useState(false);
  const [screenshotEditor, setScreenshotEditor] = useState<{ base: ScreenshotSummary; difficulty: string; notes: string; error: string; errors: Record<string, string>; current?: ScreenshotSummary } | null>(null);
  const [statistics, setStatistics] = useState<LibraryStatistics | null>(null);
  const [statisticsError, setStatisticsError] = useState('');
  const [unassignedFilters, setUnassignedFilters] = useState('');
  const [filters, setFilters] = useState('');
  const screenshotDirty = Boolean(screenshotEditor && (screenshotEditor.difficulty !== (screenshotEditor.base.difficulty ?? '') || screenshotEditor.notes !== (screenshotEditor.base.notes ?? '')));
  const [view, setView] = useState<'matches' | 'unassigned'>('matches');
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [browsedMatch, setBrowsedMatch] = useState<MatchSummary | null>(null);
  const browseMatchId = browsedMatch?.id ?? null;
  const [records, setRecords] = useState<ScreenshotSummary[]>([]);
  const [editor, setEditor] = useState<MatchEditor | null>(null);
  const [selected, setSelected] = useState<ScreenshotSummary[]>([]);
  const [target, setTarget] = useState<{ id: string; revision: number } | 'unassigned' | null>(null);
  const [assignmentCurrent, setAssignmentCurrent] = useState<{ records: ScreenshotSummary[]; matches: MatchSummary[] } | null>(null);
  const [assignmentError, setAssignmentError] = useState('');
  const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(true); const [reload, setReload] = useState(0);
  const [pending, setPending] = useState<{ action: () => void; scope: Scope; error: string } | null>(null);
  const controller = useRef(new AbortController());
  const matchDirty = Boolean(editor && draftChanged(editor.draft, editor.base));
  const assignmentDirty = Boolean(target && selected.some((record) => record.matchId !== (target === 'unassigned' ? null : target.id)));
  useEffect(() => { const current = controller.current = new AbortController(); return () => current.abort(); }, []);
  useEffect(() => {
    const request = new AbortController(); setLoading(true); setError('');
    const query = view === 'unassigned' ? libraryApi.unassigned(request.signal, unassignedFilters) : browseMatchId
      ? matchApi.screenshots(browseMatchId, request.signal, screenshotFilterQuery(filters)) : Promise.resolve({ screenshots: [] as ScreenshotSummary[] });
    void Promise.all([matchApi.list(request.signal, view === 'matches' ? filters : ''), query]).then(async ([result, images]) => {
      let parent = browseMatchId ? result.matches.find((match) => match.id === browseMatchId) : undefined;
      if (browseMatchId && !parent && !request.signal.aborted) parent = (await matchApi.list(request.signal)).matches.find((match) => match.id === browseMatchId);
      if (!request.signal.aborted) { setMatches(result.matches); setRecords(images.screenshots);
        setBrowsedMatch((current) => current?.id === browseMatchId ? parent ?? current : current);
        setScreenshotEditor((state) => {
          const fresh = images.screenshots.find((record) => record.id === state?.base.id) ?? images.screenshots[0];
          if (!state || state.difficulty !== (state.base.difficulty ?? '') || state.notes !== (state.base.notes ?? '')) return state;
          if (!fresh) return null;
          return { base: fresh, difficulty: fresh.difficulty ?? '', notes: fresh.notes ?? '', error: '', errors: {} };
        }); }
    }).catch(() => { if (!request.signal.aborted) setError('Cannot load the library. Check the local server and reload.'); })
      .finally(() => { if (!request.signal.aborted) setLoading(false); });
    void reviewApi.statistics(request.signal).then((data) => { if (!request.signal.aborted) { setStatistics(data); setStatisticsError(''); } })
      .catch(() => { if (!request.signal.aborted) { setStatistics(null); setStatisticsError('Statistics unavailable. Reload to retry.'); } });
    return () => request.abort();
  }, [view, browseMatchId, reload, filters, unassignedFilters]);
  useEffect(() => {
    if (!matchDirty && !assignmentDirty && !screenshotDirty) return;
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', unload); return () => window.removeEventListener('beforeunload', unload);
  }, [matchDirty, assignmentDirty, screenshotDirty]);
  function navigate(action: () => void, scope: Scope = 'all') {
    if (busy) return;
    if (((scope === 'all' || scope === 'match') && matchDirty) || ((scope === 'all' || scope === 'assignment') && assignmentDirty) || ((scope === 'all' || scope === 'screenshot') && screenshotDirty)) setPending({ action, scope, error: '' });
    else action();
  }
  useEffect(() => {
    registerGuard?.((action) => navigate(action)); return () => registerGuard?.(null);
  });
  const refresh = () => setReload((value) => value + 1);
  const failure = (value: unknown): ApiFailure => value instanceof LibraryApiError ? value.detail : { code: 'REQUEST_FAILED', message: 'Cannot save changes. Check the local server and retry; your draft is retained.' };
  async function saveMatch(): Promise<MatchUpdate | null> {
    if (!editor) return null;
    setBusy(true); setEditor((value) => value && { ...value, error: '', errors: {} });
    try {
      const result = editor.base ? await matchApi.update(editor.base, matchPayload(editor.draft), controller.current.signal)
        : { match: await matchApi.create(matchPayload(editor.draft), controller.current.signal), invalidatedScreenshots: [] };
      if (controller.current.signal.aborted) return null;
      setEditor({ base: result.match, draft: draftFor(result.match), errors: {}, error: '' });
      setBrowsedMatch((current) => current?.id === result.match.id ? result.match : current);
      setMatches((items) => [result.match, ...items.filter((item) => item.id !== result.match.id)].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id)));
      setNotice(`Match saved.${selected.length ? ` ${selected.length} screenshots remain selected; assignment is a separate save.` : ''}`); refresh(); return result;
    } catch (value) {
      if (controller.current.signal.aborted) return null;
      const detail = failure(value); let current: MatchSummary | undefined;
      if (detail.code === 'REVISION_CONFLICT' && editor.base) {
        try { current = (await matchApi.list(controller.current.signal)).matches.find((match) => match.id === editor.base!.id); } catch { /* Keep the original draft and revision. */ }
      }
      if (controller.current.signal.aborted) return null;
      setEditor((state) => state && { ...state, error: detail.code === 'REVISION_CONFLICT' ? 'This match changed elsewhere. Your draft is retained. Load and compare the current server values before retrying.' : detail.message, errors: detail.fieldErrors ?? {}, current });
      return null;
    } finally { if (!controller.current.signal.aborted) setBusy(false); }
  }
  async function saveAssignment(ownMatchUpdate?: MatchUpdate | null, ownScreenshot?: ScreenshotSummary | null): Promise<boolean> {
    if (!target || !selected.length || (target === 'unassigned' && selected.length !== 1)) { setAssignmentError('Choose one target match, or a single screenshot to unassign.'); return false; }
    setBusy(true); setAssignmentError('');
    let expectedTarget = target === 'unassigned' ? null : target;
    // Save All may follow this operator's successful match write; only its known invalidations are advanced.
    if (ownMatchUpdate && expectedTarget?.id === ownMatchUpdate.match.id && expectedTarget.revision === ownMatchUpdate.match.revision - 1) expectedTarget = ownMatchUpdate.match;
    const members = selected.map((record) => {
      if (ownScreenshot?.id === record.id) return ownScreenshot;
      const invalidation = ownMatchUpdate?.invalidatedScreenshots.find((item) => item.id === record.id && item.revision === record.revision + 1);
      return invalidation ? { ...record, revision: invalidation.revision } : record;
    });
    try {
      await matchApi.assign(members, expectedTarget, controller.current.signal);
      if (controller.current.signal.aborted) return false;
      setSelected([]); setTarget(null); setAssignmentCurrent(null); setNotice(`${members.length} screenshot${members.length === 1 ? '' : 's'} ${expectedTarget ? 'assigned' : 'unassigned'}.`); refresh(); return true;
    } catch (value) {
      if (controller.current.signal.aborted) return false;
      const detail = failure(value);
      setAssignmentError(detail.code === 'REVISION_CONFLICT' ? 'A selected screenshot or target match changed. Nothing was assigned. Your selection and target are retained; compare the current records before retrying.' : detail.message);
      if (detail.code === 'REVISION_CONFLICT') {
        try {
          const [images, result] = await Promise.all([matchApi.screenshots(null, controller.current.signal), matchApi.list(controller.current.signal)]);
          if (!controller.current.signal.aborted) setAssignmentCurrent({ records: images.screenshots, matches: result.matches });
        } catch { if (!controller.current.signal.aborted) setAssignmentError('Current records could not be loaded. Your selection is retained; reconnect and retry.'); }
      }
      return false;
    } finally { if (!controller.current.signal.aborted) setBusy(false); }
  }
  async function saveAndLeave() {
    if (!pending) return;
    const write = (pending.scope === 'all' || pending.scope === 'match') && matchDirty ? await saveMatch() : null;
    if ((pending.scope === 'all' || pending.scope === 'match') && matchDirty && !write) { setPending({ ...pending, error: 'Match save failed. Stay to review the retained draft.' }); return; }
    const needsScreenshotSave = (pending.scope === 'all' || pending.scope === 'screenshot') && screenshotDirty;
    const shotWrite = needsScreenshotSave ? await saveScreenshot(undefined, write) : null;
    if (needsScreenshotSave && !shotWrite) { setPending({ ...pending, error: 'Screenshot save failed. Your draft is retained.' }); return; }
    if ((pending.scope === 'all' || pending.scope === 'assignment') && assignmentDirty && !await saveAssignment(write, shotWrite)) { setPending({ ...pending, error: 'Assignment save failed. Stay to review the retained selection.' }); return; }
    setPending(null); pending.action();
  }
  function discardAndLeave() {
    if (!pending) return;
    if (pending.scope === 'all' || pending.scope === 'match') setEditor(null);
    if (pending.scope === 'all' || pending.scope === 'screenshot') setScreenshotEditor(null);
    if (pending.scope === 'all' || pending.scope === 'assignment') { setTarget(null); setAssignmentError(''); setAssignmentCurrent(null); }
    setPending(null); pending.action();
  }
  function clearWorkspace() {
    setBrowsedMatch(null); setRecords([]); setEditor(null); setScreenshotEditor(null); setShowScreenshot(false);
    setSelected([]); setTarget(null); setAssignmentCurrent(null); setAssignmentError(''); setNotice('');
  }
  function switchView(next: typeof view) {
    navigate(() => { clearWorkspace(); setView(next); });
  }
  function changeFilters(value: string) {
    if (value === (view === 'matches' ? filters : unassignedFilters)) return;
    navigate(() => {
      setLoading(true); clearWorkspace();
      if (view === 'matches') setFilters(value); else setUnassignedFilters(value);
    });
  }
  function openMatch(match: MatchSummary) {
    navigate(() => { setLoading(true); clearWorkspace(); setView('matches'); setBrowsedMatch(match); });
  }
  function editBrowsedMatch() {
    if (!browsedMatch) return;
    navigate(() => { setShowScreenshot(false); setEditor({ base: browsedMatch, draft: draftFor(browsedMatch), error: '', errors: {} }); }, 'match');
  }
  function toggle(record: ScreenshotSummary) {
    const checking = !selected.some((item) => item.id === record.id);
    const change = () => {
      if (checking && target === 'unassigned') setTarget(null);
      setSelected((items) => !checking ? items.filter((item) => item.id !== record.id) : items.some((item) => item.id === record.id) ? items : items.length < 256 ? [...items, record] : items);
      if (selected.length >= 256 && !selected.some((item) => item.id === record.id)) setAssignmentError('Select at most 256 screenshots.');
    };
    navigate(change, 'assignment');
  }
  function reviewAssignment() {
    if (!assignmentCurrent) return;
    const current = selected.map((item) => assignmentCurrent.records.find((record) => record.id === item.id));
    const match = target && target !== 'unassigned' ? assignmentCurrent.matches.find((match) => match.id === target.id) : null;
    if (current.some((item) => !item) || (target && target !== 'unassigned' && !match)) { setAssignmentError('A selected record no longer exists. Keep this draft or explicitly discard the unavailable selection.'); return; }
    setSelected(current as ScreenshotSummary[]); if (match) setTarget({ id: match.id, revision: match.revision });
    setMatches(assignmentCurrent.matches); setAssignmentCurrent(null); setAssignmentError('');
  }
  async function saveScreenshot(reviewStatus?: ReviewStatus, ownMatchUpdate?: MatchUpdate | null): Promise<ScreenshotSummary | null> {
    if (!screenshotEditor) return null;
    if (reviewStatus && screenshotDirty) { setScreenshotEditor({ ...screenshotEditor, error: 'Save or cancel screenshot changes before review.' }); return null; }
    const ownInvalidation = ownMatchUpdate?.invalidatedScreenshots.find((item) => item.id === screenshotEditor.base.id && item.revision === screenshotEditor.base.revision + 1);
    const base = { ...screenshotEditor.base,
      revision: ownInvalidation?.revision ?? screenshotEditor.base.revision,
      matchRevision: ownMatchUpdate?.match.id === screenshotEditor.base.matchId && ownMatchUpdate.match.revision === (screenshotEditor.base.matchRevision ?? 0) + 1 ? ownMatchUpdate.match.revision : screenshotEditor.base.matchRevision };
    setBusy(true);
    try {
      const record = reviewStatus ? await reviewApi.review(base, reviewStatus, controller.current.signal)
        : await reviewApi.edit(base, { difficulty: (screenshotEditor.difficulty || null) as Difficulty | null, notes: screenshotEditor.notes || null }, controller.current.signal);
      if (controller.current.signal.aborted) return null;
      setScreenshotEditor({ base: record, difficulty: record.difficulty ?? '', notes: record.notes ?? '', error: '', errors: {} });
      setSelected((items) => items.map((item) => item.id === record.id ? record : item));
      setNotice(reviewStatus ? `Screenshot marked ${reviewStatus}.` : 'Screenshot saved.'); refresh(); return record;
    } catch (value) {
      const detail = failure(value); let current: ScreenshotSummary | undefined;
      if (detail.code === 'REVISION_CONFLICT') {
        try { current = (await matchApi.screenshots(null, controller.current.signal)).screenshots.find((record) => record.id === screenshotEditor.base.id); } catch { /* Retain draft. */ }
      }
      if (!controller.current.signal.aborted) setScreenshotEditor((state) => state && { ...state, error: detail.code === 'REVISION_CONFLICT' ? 'Screenshot or match changed elsewhere. Compare current server values; your draft is retained.' : detail.message, errors: detail.fieldErrors ?? {}, current });
      return null;
    } finally { if (!controller.current.signal.aborted) setBusy(false); }
  }
  return { hasScreenshotFilters: Boolean(screenshotFilterQuery(filters)), showScreenshot, revealScreenshot: () => setShowScreenshot(true), screenshotEditor, screenshotDirty, statistics, statisticsError, filters: view === 'matches' ? filters : unassignedFilters,
    changeFilters, browsedMatch, editBrowsedMatch, backToResults: () => navigate(() => { setLoading(true); clearWorkspace(); }),
    openScreenshot: (record: ScreenshotSummary) => navigate(() => { setShowScreenshot(true); setScreenshotEditor({ base: record, difficulty: record.difficulty ?? '', notes: record.notes ?? '', error: '', errors: {} }); }, 'screenshot'),
    closeScreenshot: () => navigate(() => setScreenshotEditor(null), 'screenshot'),
    changeScreenshot: (field: 'difficulty' | 'notes', value: string) => setScreenshotEditor((state) => state && { ...state, [field]: value }),
    cancelScreenshot: () => setScreenshotEditor((state) => state && { base: state.current ?? state.base, difficulty: (state.current ?? state.base).difficulty ?? '', notes: (state.current ?? state.base).notes ?? '', error: '', errors: {} }),
    reloadScreenshot: (keepDraft: boolean) => setScreenshotEditor((state) => state?.current ? { base: state.current, difficulty: keepDraft ? state.difficulty : state.current.difficulty ?? '', notes: keepDraft ? state.notes : state.current.notes ?? '', error: '', errors: {} } : state),
    saveScreenshot, view, matches, browseMatchId, records, editor, selected, target, assignmentCurrent, assignmentError, error, notice, busy, loading, pending, matchDirty, assignmentDirty,
    refresh, switchView, openMatch, toggle, saveMatch, saveAssignment, saveAndLeave, discardAndLeave, reviewAssignment,
    stay: () => setPending(null),
    newMatch: () => navigate(() => { setShowScreenshot(false); setEditor({ base: null, draft: draftFor(), errors: {}, error: '' }); }, 'match'),
    closeEditor: () => navigate(() => { setEditor(null); setShowScreenshot(true); }, 'match'),
    cancelMatch: () => { if (!editor?.base) setShowScreenshot(true); setEditor((state) => state?.base ? { base: state.current ?? state.base, draft: draftFor(state.current ?? state.base), errors: {}, error: '' } : null); },
    changeMatch: (field: keyof MatchDraft, value: string) => setEditor((state) => state && { ...state, draft: { ...state.draft, [field]: value } }),
    reloadMatch: (keepDraft: boolean) => setEditor((state) => state?.current ? { base: state.current, draft: keepDraft ? state.draft : draftFor(state.current), errors: {}, error: '' } : state),
    reloadConflict: async () => { if (!editor?.base) return; try { const current = (await matchApi.list(controller.current.signal)).matches.find((match) => match.id === editor.base!.id); setEditor((state) => state && { ...state, current }); } catch { /* Existing error and draft remain. */ } },
    chooseTarget: (id: string) => { const match = matches.find((match) => match.id === id); setTarget(id === 'unassigned' ? 'unassigned' : match ? { id: match.id, revision: match.revision } : null); setAssignmentError(''); setAssignmentCurrent(null); },
    selectAll: () => navigate(() => { if (records.length > 256) { setAssignmentError('Select at most 256 screenshots.'); return; } setSelected(records); setTarget(null); }, 'assignment'),
    clearSelection: () => navigate(() => { setSelected([]); setTarget(null); setAssignmentError(''); setAssignmentCurrent(null); }, 'assignment'),
  };
}
export type MatchWorkspace = ReturnType<typeof useMatchWorkspace>;
