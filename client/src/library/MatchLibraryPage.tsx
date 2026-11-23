import { Fragment, useEffect, useRef, useState } from 'react';
import { GAME_TIERS, GAME_TIER_DETAILS } from '../../../shared/src/classification';
import { LibraryFilters } from './LibraryFilters';
import { ScreenshotInspector } from './ScreenshotInspector';
import { ScreenshotCollection } from './ScreenshotCollection';
import { ImportDialog } from './ImportDialog';
import { MatchInspector } from './MatchInspector';
import { UnsavedChangesDialog } from './UnsavedChangesDialog';
import { useMatchWorkspace, type NavigationGuard } from './useMatchWorkspace';
import { MatchesTable, type MatchSort } from './MatchesTable';
import { ReviewQueue } from './ReviewQueue';
import styles from './Library.module.css';

const views = [['review', 'Review Queue'], ['matches', 'Matches'], ['overview', 'Overview']] as const;

export function MatchLibraryPage({ registerNavigationGuard }: { registerNavigationGuard?: (guard: NavigationGuard | null) => void }) {
  const w = useMatchWorkspace(registerNavigationGuard);
  const [showImport, setShowImport] = useState(false);
  const [sort, setSort] = useState<MatchSort | null>(null);
  const previousSelectionCount = useRef(0);
  const selection = w.browseMatchId ?? (w.intake ? 'intake' : null);
  const previousGroup = useRef<string | null>(null);
  useEffect(() => {
    if (selection !== previousGroup.current) {
      if (selection || !document.activeElement?.closest('[aria-label="Library filters"]')) {
        const previous = previousGroup.current;
        const returnTarget = previous === 'intake' ? 'queue-intake' : `queue-group-${previous}`;
        const queueTarget = w.view === 'review' && !selection
          ? document.getElementById(returnTarget) ?? document.getElementById('review-queue-title') : null;
        (queueTarget ?? document.getElementById(selection ? 'match-collection-title' : 'library-title'))?.focus();
      }
      previousGroup.current = selection;
    }
  }, [selection, w.view]);
  useEffect(() => {
    if (previousSelectionCount.current && !w.selected.length && !document.activeElement?.closest('[aria-label="Library filters"]')) {
      document.getElementById(w.editor ? 'match-editor-title' : selection ? 'match-collection-title' : 'library-title')?.focus();
    }
    previousSelectionCount.current = w.selected.length;
  }, [w.selected.length, w.editor, selection]);
  const editors = <>
    {w.showScreenshot && w.screenshotEditor && <ScreenshotInspector workspace={w} reviewLayout={w.view === 'review' && !w.intake} />}
    {w.editor && <div hidden={Boolean(w.showScreenshot && w.screenshotEditor)}><MatchInspector workspace={w} />
      {w.screenshotEditor && <button onClick={w.revealScreenshot}>Return to screenshot draft</button>}</div>}
  </>;

  return <section className={styles.library} aria-labelledby="library-title">
    <header className={styles.heading}>
      <h2 tabIndex={-1} id="library-title">Image Library</h2>
      <div className={styles.actions}>
        <button disabled={w.busy} onClick={w.refresh}>Reload screenshots</button>
        <button disabled={w.busy} onClick={w.newMatch}>Create match</button>
        <button disabled={w.busy} className={styles.primary} onClick={() => setShowImport(true)}>Import captures</button>
      </div>
    </header>
    <nav className={styles.libraryViews} aria-label="Library views">{views.map(([view, label]) =>
      <button key={view} disabled={w.busy} aria-current={w.view === view ? 'page' : undefined} onClick={() => w.switchView(view)}>{label}</button>)}</nav>
    {w.loading && <p role="status">Loading screenshots…</p>}
    {w.error && <p role="alert" className={styles.error}>{w.error}</p>}
    {w.notice && <p role="status">{w.notice}</p>}
    {w.view === 'review' && <ReviewQueue workspace={w} editors={editors} />}
    {w.view === 'overview' && <>
      <section aria-label="Entire library statistics" className={styles.statistics}><h3>Entire library</h3>
        {w.statisticsError ? <p role="alert">{w.statisticsError}</p> : w.statistics ? <dl>
          <div><dt>Matches</dt><dd>{w.statistics.totalMatches}</dd></div><div><dt>Screenshots</dt><dd>{w.statistics.totalScreenshots}</dd></div>
          <div><dt>Fully classified</dt><dd>{w.statistics.fullyClassifiedScreenshots}</dd></div>
          <div><dt>Awaiting classification</dt><dd>{w.statistics.awaitingClassificationScreenshots}</dd></div>
          {GAME_TIERS.map((tier) => <Fragment key={tier}><div><dt>Classified {GAME_TIER_DETAILS[tier].label}</dt><dd>{w.statistics!.classifiedByTier[tier]}</dd></div>
            <div><dt>Eligible {GAME_TIER_DETAILS[tier].label}</dt><dd>{w.statistics!.eligibleByTier[tier]}</dd></div></Fragment>)}
        </dl> : <p role="status">Loading statistics…</p>}
        <p>Fully classified means obscurity and visual difficulty are set. Gameplay also requires approval, complete match details and a valid image. Pending or rejected screenshots are excluded from eligible totals.</p>
      </section>
      {editors}
    </>}
    {w.view === 'matches' && <>
      <button disabled={w.busy} onClick={w.openIntake}>Unassigned Intake</button>
      <LibraryFilters query={w.filters} matchView change={w.changeFilters} />
      <div className={styles.workspace} data-inspecting={Boolean(w.editor || w.screenshotEditor)}>
        <div className={styles.browser}>
          {!w.browseMatchId && !w.loading && !w.error && <>
            <h3>Match results</h3>
            {!w.matches.length ? <p>No matches found. Clear filters, import captures or create a match.</p> : <MatchesTable matches={w.matches} filtered={w.hasScreenshotFilters} busy={w.busy} sort={sort} onSort={setSort} onOpen={w.openMatch} />}
          </>}
          {w.browsedMatch && <>
            <section className={styles.collectionHeading} aria-labelledby="match-collection-title">
              <p className={styles.kicker}>Selected match · screenshots</p>
              <h3 id="match-collection-title" tabIndex={-1}>{w.browsedMatch.participantDescription ?? 'Untitled match'}</h3>
              <p>{w.browsedMatch.promotion ?? 'Unknown promotion'} · {w.browsedMatch.event ?? 'Unknown event'}</p>
              <p>{w.hasScreenshotFilters ? 'Only screenshots matching the active visual difficulty, review and game tier filters are shown.' : 'All screenshots for this match are shown. No screenshot filters are active.'}</p>
              <div className={styles.actions}><button disabled={w.busy} onClick={w.editBrowsedMatch}>Edit match details</button><button disabled={w.busy} onClick={w.backToResults}>Back to match results</button></div>
            </section>
            {!w.loading && !w.error && <ScreenshotCollection workspace={w} />}
          </>}
        </div>
        <div className={styles.inspectors}>{editors}</div>
      </div>
    </>}
    {showImport && <ImportDialog onClose={() => { setShowImport(false); w.refresh(); }} onImported={() => { setShowImport(false); w.refresh(); w.openIntake(); }} />}
    {w.pending && <UnsavedChangesDialog busy={w.busy} error={w.pending.error} onSave={() => void w.saveAndLeave()} onDiscard={w.discardAndLeave} onStay={w.stay} />}
  </section>;
}
