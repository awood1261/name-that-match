import { useEffect, useRef, useState } from 'react';
import type { ScreenshotSummary } from '../../../shared/src/imports';
import { ImportDialog } from './ImportDialog';
import { MatchInspector } from './MatchInspector';
import { AssignmentPanel } from './AssignmentPanel';
import { UnsavedChangesDialog } from './UnsavedChangesDialog';
import { useMatchWorkspace, type NavigationGuard } from './useMatchWorkspace';
import styles from './Library.module.css';
import { MATCH_LABELS } from './match-draft';

function ScreenshotCard({ record, checked, disabled, onSelect }: { record: ScreenshotSummary; checked: boolean; disabled: boolean; onSelect: () => void }) {
  const [failed, setFailed] = useState(false);
  return <article className={styles.card} data-selected={checked}>
    <label className={styles.selection}><input type="checkbox" checked={checked} disabled={disabled} onChange={onSelect} /> Select {record.provenance.captureId}</label>
    {record.assetStatus === 'available' && !failed
      ? <img src={record.image.url} width={record.image.width} height={record.image.height} alt={`Capture ${record.provenance.captureId}`} loading="lazy" onError={() => setFailed(true)} />
      : <p className={styles.error}>Image {failed ? 'unavailable' : record.assetStatus}. Restore the original managed image and reload.</p>}
    <h3>{record.provenance.captureId}</h3><p>{record.matchId ? 'Assigned' : 'Unassigned'} · {record.difficulty ?? 'unrated'} · {record.reviewStatus}</p>
    <dl><dt>Source video</dt><dd>{record.provenance.source.title ?? record.provenance.source.videoId}</dd><dt>Playback</dt><dd>{record.provenance.capture.playbackSeconds} seconds</dd><dt>Captured</dt><dd>{record.provenance.capture.capturedAt}</dd></dl>
  </article>;
}
export function MatchLibraryPage({ registerNavigationGuard }: { registerNavigationGuard?: (guard: NavigationGuard | null) => void }) {
  const w = useMatchWorkspace(registerNavigationGuard); const [showImport, setShowImport] = useState(false);
  const previousSelectionCount = useRef(0);
  useEffect(() => {
    if (previousSelectionCount.current && !w.selected.length) document.getElementById(w.editor ? 'match-editor-title' : 'library-title')?.focus();
    previousSelectionCount.current = w.selected.length;
  }, [w.selected.length, w.editor]);
  return <section className={styles.library} aria-labelledby="library-title">
    <header className={styles.heading}><div><p className={styles.kicker}>Image Library</p><h2 tabIndex={-1} id="library-title">{w.view === 'matches' ? 'Matches' : 'Unassigned screenshots'}</h2></div>
      <div className={styles.actions}><button disabled={w.busy} onClick={w.refresh}>Reload screenshots</button><button disabled={w.busy} onClick={w.newMatch}>Create match</button><button disabled={w.busy} className={styles.primary} onClick={() => setShowImport(true)}>Import captures</button></div></header>
    <nav className={styles.actions} aria-label="Library views"><button disabled={w.busy} aria-current={w.view === 'matches' ? 'page' : undefined} onClick={() => w.switchView('matches')}>Matches</button><button disabled={w.busy} aria-current={w.view === 'unassigned' ? 'page' : undefined} onClick={() => w.switchView('unassigned')}>Unassigned screenshots</button></nav>
    <p>New imports are unassigned, unrated and pending.</p>
    {w.loading && <p role="status">Loading screenshots…</p>}{w.error && <p role="alert" className={styles.error}>{w.error}</p>}{w.notice && <p role="status">{w.notice}</p>}
    <div className={styles.workspace} data-inspecting={Boolean(w.editor)}>
      <div className={styles.browser}>
        {w.view === 'matches' && !w.loading && !w.error && <>
          {!w.matches.length ? <p>No matches yet. Import captures and create a match to organize them.</p> : <div className={styles.grid}>{w.matches.map((match) => <button className={styles.matchCard} aria-pressed={w.browseMatchId === match.id} key={match.id} disabled={w.busy} onClick={() => w.openMatch(match)}>
            <strong>{match.participantDescription ?? 'Untitled match'}</strong><span>{match.promotion ?? 'Unknown promotion'} · {match.event ?? 'Unknown event'}</span><span>{match.matchDate ?? 'Unknown date'} · {match.obscurity ?? 'Unknown obscurity'}</span><span>{match.complete ? 'Identified' : `Incomplete: ${match.missingFields.map((field) => MATCH_LABELS[field]).join(', ')}`}</span>
          </button>)}</div>}
        </>}
        <AssignmentPanel workspace={w} />
        {!w.loading && !w.error && (w.view === 'unassigned' || w.browseMatchId) && <>
          <p role="status">{w.records.length} {w.view === 'unassigned' ? 'unassigned' : 'associated'} screenshot{w.records.length === 1 ? '' : 's'}</p>
          <div className={styles.actions}><button disabled={w.busy || !w.records.length || w.records.length > 256} onClick={w.selectAll}>Select all screenshots</button></div>
          {w.records.length > 256 && <p>Select up to 256 screenshots for one assignment.</p>}
          {w.records.length ? <div className={styles.grid}>{w.records.map((record) => <ScreenshotCard key={`${record.id}-${record.revision}`} record={record} checked={w.selected.some((item) => item.id === record.id)} disabled={w.busy} onSelect={() => w.toggle(record)} />)}</div>
            : <p>{w.view === 'unassigned' ? 'No unassigned screenshots yet. Import PNG/JSON capture pairs to get started.' : 'No screenshots assigned to this match yet. Select captures in Unassigned screenshots to assign them.'}</p>}
        </>}
      </div>
      {w.editor && <MatchInspector workspace={w} />}
    </div>
    {showImport && <ImportDialog onClose={() => { setShowImport(false); w.refresh(); }} onImported={() => { setShowImport(false); w.refresh(); w.switchView('unassigned'); }} />}
    {w.pending && <UnsavedChangesDialog busy={w.busy} error={w.pending.error} onSave={() => void w.saveAndLeave()} onDiscard={w.discardAndLeave} onStay={w.stay} />}
  </section>;
}
