import { LibraryFilters } from './LibraryFilters';
import { ScreenshotInspector } from './ScreenshotInspector';
import { GAME_TIERS, GAME_TIER_DETAILS } from '../../../shared/src/classification';
import { DIFFICULTY_DETAILS, OBSCURITY_DETAILS } from '../../../shared/src/library';
import { Fragment, useEffect, useRef, useState } from 'react';
import type { ScreenshotSummary } from '../../../shared/src/imports';
import { ImportDialog } from './ImportDialog';
import { MatchInspector } from './MatchInspector';
import { AssignmentPanel } from './AssignmentPanel';
import { UnsavedChangesDialog } from './UnsavedChangesDialog';
import { useMatchWorkspace, type NavigationGuard } from './useMatchWorkspace';
import styles from './Library.module.css';
import { MATCH_LABELS } from './match-draft';

function ScreenshotCard({ record, checked, disabled, onSelect, onOpen }: { record: ScreenshotSummary; checked: boolean; disabled: boolean; onSelect: () => void; onOpen: () => void }) {
  const [failed, setFailed] = useState(false);
  return <article className={styles.card} data-selected={checked}>
    <label className={styles.selection}><input type="checkbox" checked={checked} disabled={disabled} onChange={onSelect} /> Select {record.provenance.captureId}</label>
    {record.assetStatus === 'available' && !failed
      ? <img src={record.image.url} width={record.image.width} height={record.image.height} alt={`Capture ${record.provenance.captureId}`} loading="lazy" onError={() => setFailed(true)} />
      : <p className={styles.error}>Image {failed ? 'unavailable' : record.assetStatus}. Restore the original managed image and reload.</p>}
    <button onClick={onOpen} disabled={disabled} aria-label={`Review capture ${record.provenance.captureId}`}>Review screenshot</button><p>{record.matchId ? 'Assigned' : 'Unassigned'} · {record.difficulty ? DIFFICULTY_DETAILS[record.difficulty].label : 'unrated'} · {record.reviewStatus}</p>
    <details><summary>Capture provenance</summary><dl><dt>Source video</dt><dd>{record.provenance.source.title ?? record.provenance.source.videoId}</dd><dt>Playback</dt><dd>{record.provenance.capture.playbackSeconds} seconds</dd><dt>Captured</dt><dd>{record.provenance.capture.capturedAt}</dd></dl></details>
  </article>;
}
export function MatchLibraryPage({ registerNavigationGuard }: { registerNavigationGuard?: (guard: NavigationGuard | null) => void }) {
  const w = useMatchWorkspace(registerNavigationGuard); const [showImport, setShowImport] = useState(false); const [groupSources, setGroupSources] = useState(false);
  const previousSelectionCount = useRef(0);
  const previousMatchId = useRef<string | null>(null);
  useEffect(() => {
    if (w.browseMatchId !== previousMatchId.current) {
      if (w.browseMatchId || !document.activeElement?.closest('[aria-label="Library filters"]')) document.getElementById(w.browseMatchId ? 'match-collection-title' : 'library-title')?.focus();
      previousMatchId.current = w.browseMatchId;
    }
  }, [w.browseMatchId]);
  useEffect(() => {
    if (previousSelectionCount.current && !w.selected.length && !document.activeElement?.closest('[aria-label="Library filters"]')) document.getElementById(w.editor ? 'match-editor-title' : 'library-title')?.focus();
    previousSelectionCount.current = w.selected.length;
  }, [w.selected.length, w.editor]);
  return <section className={styles.library} aria-labelledby="library-title">
    <header className={styles.heading}><div><p className={styles.kicker}>Image Library</p><h2 tabIndex={-1} id="library-title">{w.view === 'matches' ? 'Matches' : 'Unassigned screenshots'}</h2></div>
      <div className={styles.actions}><button disabled={w.busy} onClick={w.refresh}>Reload screenshots</button><button disabled={w.busy} onClick={w.newMatch}>Create match</button><button disabled={w.busy} className={styles.primary} onClick={() => setShowImport(true)}>Import captures</button></div></header>
    <nav className={styles.actions} aria-label="Library views"><button disabled={w.busy} aria-current={w.view === 'matches' ? 'page' : undefined} onClick={() => w.switchView('matches')}>Matches</button><button disabled={w.busy} aria-current={w.view === 'unassigned' ? 'page' : undefined} onClick={() => w.switchView('unassigned')}>Unassigned screenshots</button></nav>
    <p>New imports are unassigned, unrated and pending.</p>
    {w.loading && <p role="status">Loading screenshots…</p>}{w.error && <p role="alert" className={styles.error}>{w.error}</p>}{w.notice && <p role="status">{w.notice}</p>}
    <section aria-label="Entire library statistics" className={styles.statistics}><h3>Entire library</h3>
      {w.statisticsError ? <p role="alert">{w.statisticsError}</p> : w.statistics ? <dl>
        <div><dt>Matches</dt><dd>{w.statistics.totalMatches}</dd></div><div><dt>Screenshots</dt><dd>{w.statistics.totalScreenshots}</dd></div><div><dt>Fully classified</dt><dd>{w.statistics.fullyClassifiedScreenshots}</dd></div><div><dt>Awaiting classification</dt><dd>{w.statistics.awaitingClassificationScreenshots}</dd></div>
        {GAME_TIERS.map((tier) => <div key={tier}><dt>Eligible {GAME_TIER_DETAILS[tier].label}</dt><dd>{w.statistics!.eligibleByTier[tier]}</dd></div>)}
      </dl> : <p role="status">Loading statistics…</p>}
    </section>
    <LibraryFilters query={w.filters} matchView={w.view === 'matches'} change={w.changeFilters} />
    <div className={styles.workspace} data-inspecting={Boolean(w.editor || w.screenshotEditor)}>
      <div className={styles.browser}>
        {w.view === 'matches' && !w.browseMatchId && !w.loading && !w.error && <>
          <h3>Match results</h3>
          {!w.matches.length ? <p>No matches found. Clear filters, import captures or create a match.</p> : <div className={styles.grid}>{w.matches.map((match) => <button className={styles.matchCard} aria-pressed={w.browseMatchId === match.id} key={match.id} disabled={w.busy} onClick={() => w.openMatch(match)}>
            <strong>{match.participantDescription ?? 'Untitled match'}</strong><span>{match.promotion ?? 'Unknown promotion'} · {match.event ?? 'Unknown event'}</span><span>{match.matchDate ?? 'Unknown date'} · {match.obscurity ? OBSCURITY_DETAILS[match.obscurity].label : 'Unknown obscurity'}</span><span>{match.complete ? 'Identified' : `Incomplete: ${match.missingFields.map((field) => MATCH_LABELS[field]).join(', ')}`}</span><span>{w.hasScreenshotFilters ? `${match.matchingScreenshotCount} matching screenshot${match.matchingScreenshotCount === 1 ? '' : 's'} of ${match.screenshotCount} total` : `${match.screenshotCount} screenshot${match.screenshotCount === 1 ? '' : 's'}`}</span><span>Full match totals: {match.approvedCount} approved · {match.eligibleCount} eligible · {match.awaitingClassificationCount} awaiting classification</span><span>{match.classificationIncomplete ? 'Classification incomplete' : 'Classification complete'}</span>
          </button>)}</div>}
        </>}
        {w.view === 'matches' && w.browsedMatch && <section className={styles.collectionHeading} aria-labelledby="match-collection-title">
          <p className={styles.kicker}>Selected match · screenshots</p>
          <h3 id="match-collection-title" tabIndex={-1}>{w.browsedMatch.participantDescription ?? 'Untitled match'}</h3>
          <p>{w.browsedMatch.promotion ?? 'Unknown promotion'} · {w.browsedMatch.event ?? 'Unknown event'}</p>
          <p>{w.hasScreenshotFilters ? 'Only screenshots matching the active visual difficulty, review and game tier filters are shown.' : 'All screenshots for this match are shown. No screenshot filters are active.'}</p>
          <div className={styles.actions}><button disabled={w.busy} onClick={w.editBrowsedMatch}>Edit match details</button><button disabled={w.busy} onClick={w.backToResults}>Back to match results</button></div>
        </section>}
        <AssignmentPanel workspace={w} />
        {!w.loading && !w.error && (w.view === 'unassigned' || w.browseMatchId) && <>
          <p role="status">{w.view === 'unassigned' ? `${w.records.length} unassigned screenshot${w.records.length === 1 ? '' : 's'}` : `Showing ${w.records.length} of ${w.browsedMatch?.screenshotCount ?? 0} screenshots`}</p>
          <div className={styles.actions}>{w.view === 'unassigned' && <label className={styles.selection}><input type="checkbox" checked={groupSources} onChange={(event) => setGroupSources(event.target.checked)} />Group by source video (provenance only)</label>}<button disabled={w.busy || !w.records.length || w.records.length > 256} onClick={w.selectAll}>Select all screenshots</button></div>
          {w.records.length > 256 && <p>Select up to 256 screenshots for one assignment.</p>}
          {w.records.length ? <div className={styles.grid}>{[...w.records].sort((a, b) => w.view === 'unassigned' && groupSources ? a.provenance.source.videoId.localeCompare(b.provenance.source.videoId) || a.provenance.capture.capturedAt.localeCompare(b.provenance.capture.capturedAt) : 0).map((record, index, rows) => <Fragment key={record.id}>{w.view === 'unassigned' && groupSources && (index === 0 || rows[index - 1].provenance.source.videoId !== record.provenance.source.videoId) && <h3 className={styles.sourceHeading}>Source video: {record.provenance.source.title ?? record.provenance.source.videoId}</h3>}<ScreenshotCard key={`${record.id}-${record.revision}`} record={record} checked={w.selected.some((item) => item.id === record.id)} disabled={w.busy} onSelect={() => w.toggle(record)} onOpen={() => w.openScreenshot(record)} /></Fragment>)}</div>
            : <p>{w.view === 'unassigned' ? 'No unassigned screenshots yet. Import PNG/JSON capture pairs to get started.' : w.hasScreenshotFilters ? 'No screenshots match the active filters. Change or clear the filters to see more screenshots.' : 'No screenshots assigned to this match yet. Select captures in Unassigned screenshots to assign them.'}</p>}
        </>}
      </div>
      <div className={styles.inspectors}>{w.showScreenshot && w.screenshotEditor && <ScreenshotInspector workspace={w} />}{w.editor && <div hidden={Boolean(w.showScreenshot && w.screenshotEditor)}><MatchInspector workspace={w} />{w.screenshotEditor && <button onClick={w.revealScreenshot}>Return to screenshot draft</button>}</div>}</div>
    </div>
    {showImport && <ImportDialog onClose={() => { setShowImport(false); w.refresh(); }} onImported={() => { setShowImport(false); w.refresh(); w.switchView('unassigned'); }} />}
    {w.pending && <UnsavedChangesDialog busy={w.busy} error={w.pending.error} onSave={() => void w.saveAndLeave()} onDiscard={w.discardAndLeave} onStay={w.stay} />}
  </section>;
}
