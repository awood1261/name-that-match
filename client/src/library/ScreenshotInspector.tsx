import { useEffect, useRef, useState } from 'react';
import { DIFFICULTIES, DIFFICULTY_DETAILS } from '../../../shared/src/library';
import { GAME_TIER_DETAILS } from '../../../shared/src/classification';
import type { ScreenshotSummary } from '../../../shared/src/imports';
import type { MatchWorkspace } from './useMatchWorkspace';
import styles from './Library.module.css';
import review from './ScreenshotReview.module.css';

const blockerLabels: Record<string, string> = {
  unassigned: 'Assign this screenshot to a match',
  missing_participantDescription: 'Add match participants',
  missing_promotion: 'Add the promotion',
  missing_event: 'Add the event',
  obscurity_unset: 'Set match obscurity',
  unrated: 'Save a visual difficulty rating',
  image_missing: 'Restore the missing image',
  image_corrupt: 'Restore the original image',
  pending_review: 'Pending review',
  rejected_review: 'Rejected',
};

export function ScreenshotInspector({ workspace: w, reviewLayout = false }: { workspace: MatchWorkspace; reviewLayout?: boolean }) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [compared, setCompared] = useState(false);
  const [failedPreview, setFailedPreview] = useState<ScreenshotSummary | null>(null);
  const editor = w.screenshotEditor;
  const currentRecord = editor?.current;

  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    return () => { if (trigger?.isConnected) trigger.focus(); };
  }, []);
  useEffect(() => { heading.current?.focus(); setCompared(false); }, [editor?.base.id, currentRecord]);
  if (!editor) return null;

  const record = editor.base;
  const position = w.records.findIndex(item => item.id === record.id);
  const tier = record.classification.tier;
  const reasons = record.eligibility.reasons;
  const blockers = reasons.filter(reason => reason !== 'pending_review' && reason !== 'rejected_review');
  const brokenPreview = failedPreview === record;
  const approvalBlocked = w.busy || w.screenshotDirty || Boolean(editor.current) || blockers.length > 0 || brokenPreview;
  const status = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected' }[record.reviewStatus];
  const notesField = <div className={styles.matchField}>
    <label htmlFor="screenshot-notes">Screenshot notes</label>
    <textarea id="screenshot-notes" value={editor.notes} disabled={w.busy} aria-invalid={Boolean(editor.errors.notes)} aria-describedby={editor.errors.notes ? 'screenshot-notes-error' : undefined} onChange={(event) => w.changeScreenshot('notes', event.target.value)} />
    {editor.errors.notes && <p id="screenshot-notes-error" className={styles.error}>{editor.errors.notes}</p>}
  </div>;

  return <aside className={reviewLayout ? review.workspace : styles.inspector} aria-labelledby="screenshot-editor-title">
    <div className={styles.heading}>
      <h2 className={reviewLayout ? review.sectionTitle : undefined} tabIndex={-1} ref={heading} id="screenshot-editor-title">{reviewLayout ? `Screenshots (${w.records.length})` : 'Review screenshot'}</h2>
      {!reviewLayout && <button disabled={w.busy} onClick={w.closeScreenshot}>Back to collection</button>}
      <nav className={reviewLayout ? review.navigation : styles.actions} aria-label="Screenshot navigation">
        <button disabled={w.busy || position <= 0} aria-label="Previous screenshot" onClick={() => w.openScreenshot(w.records[position - 1])}>{reviewLayout ? '‹' : 'Previous screenshot'}</button>
        <span>{position >= 0 ? `${position + 1} of ${w.records.length}` : 'Outside the current collection'}</span>
        <button disabled={w.busy || position < 0 || position >= w.records.length - 1} aria-label="Next screenshot" onClick={() => w.openScreenshot(w.records[position + 1])}>{reviewLayout ? '›' : 'Next screenshot'}</button>
      </nav>
    </div>
    <div className={reviewLayout ? review.content : undefined}>
      <nav className={reviewLayout ? review.thumbnails : styles.thumbnails} aria-label="Screenshot thumbnails">
        {w.records.map((item, index) => <button key={item.id} disabled={w.busy} aria-pressed={record.id === item.id} aria-label={`Open capture ${item.provenance.captureId}`} onClick={() => w.openScreenshot(item)}>
          {item.assetStatus === 'available' ? <img src={item.image.url} width={item.image.width} height={item.image.height} loading="lazy" alt="" /> : <span>Image unavailable</span>}
          {reviewLayout && <span aria-hidden="true">{index + 1}</span>}
        </button>)}
      </nav>
      <div className={reviewLayout ? review.image : undefined}>
        {record.assetStatus === 'available' && !brokenPreview
          ? <img className={styles.preview} src={record.image.url} width={record.image.width} height={record.image.height} alt={`Selected capture ${record.provenance.captureId}`} onError={() => setFailedPreview(record)} />
          : <p className={styles.error}>Image {brokenPreview ? 'unavailable' : record.assetStatus}. Restore the original managed image and reload.</p>}
      </div>
      <div className={reviewLayout ? review.controls : undefined}>
        {reviewLayout && <h3>Screenshot Review</h3>}
        <p className={review.status} data-status={record.reviewStatus}>Review: {reviewLayout ? status : record.reviewStatus}</p>
        <p>{record.eligibility.eligible ? 'Eligible for gameplay.' : `Not eligible: ${(reviewLayout ? reasons.map(reason => blockerLabels[reason] ?? reason) : reasons).join(', ')}.`}</p>
        {editor.error && <p role="alert" className={styles.error}>{editor.error}</p>}
        {editor.current && <section className={styles.conflict} aria-label="Current server screenshot">
          <p>Current revision {editor.current.revision}: difficulty {editor.current.difficulty ?? 'unrated'}, notes {editor.current.notes ?? 'none'}, review {editor.current.reviewStatus}, match {editor.current.matchId ?? 'unassigned'}.</p>
          <label className={styles.selection}><input type="checkbox" checked={compared} onChange={(event) => setCompared(event.target.checked)} /> I compared the current server values</label>
          <div className={styles.actions}><button onClick={() => w.reloadScreenshot(false)} disabled={w.busy}>Reload screenshot values</button><button onClick={() => w.reloadScreenshot(true)} disabled={w.busy || !compared}>Use reviewed screenshot revision</button></div>
        </section>}
        <form className={styles.matchForm} noValidate onSubmit={(event) => { event.preventDefault(); void w.saveScreenshot(); }}>
          {reviewLayout ? <fieldset className={review.ratings} aria-describedby="screenshot-difficulty-help" disabled={w.busy}>
            <legend>Visual Difficulty</legend>
            {[...DIFFICULTIES, ''].map(value => <label key={value}>
              <input type="radio" name="visual-difficulty" value={value} checked={editor.difficulty === value} onChange={() => w.changeScreenshot('difficulty', value)} />
              <span>{value ? DIFFICULTY_DETAILS[value as typeof DIFFICULTIES[number]].label : 'Unrated'}</span>
            </label>)}
          </fieldset> : <div className={styles.matchField}>
            <label htmlFor="screenshot-difficulty">Screenshot difficulty</label>
            <select id="screenshot-difficulty" disabled={w.busy} value={editor.difficulty} aria-invalid={Boolean(editor.errors.difficulty)} aria-describedby="screenshot-difficulty-help" onChange={(event) => w.changeScreenshot('difficulty', event.target.value)}>
              <option value="">Unrated / unset</option>{DIFFICULTIES.map(difficulty => <option key={difficulty} value={difficulty}>{DIFFICULTY_DETAILS[difficulty].label}</option>)}
            </select>
          </div>}
          <p id="screenshot-difficulty-help" className={review.help}>{editor.errors.difficulty ?? (editor.difficulty ? DIFFICULTY_DETAILS[editor.difficulty as typeof DIFFICULTIES[number]].definition : 'No difficulty assigned.')}</p>
          {reviewLayout ? <details open={editor.errors.notes ? true : undefined}><summary>Notes</summary>{notesField}</details> : notesField}
          <div className={styles.actions}>
            <button type="submit" className={reviewLayout ? undefined : styles.primary} disabled={w.busy || Boolean(editor.current) || (reviewLayout && !w.screenshotDirty)}>{reviewLayout ? 'Save classification' : 'Save screenshot'}</button>
            <button type="button" onClick={w.cancelScreenshot} disabled={w.busy || (reviewLayout && !w.screenshotDirty && !editor.current)}>Cancel screenshot changes</button>
          </div>
        </form>
        <div className={styles.actions} aria-label="Individual screenshot review">
          <button className={review.reject} disabled={w.busy || w.screenshotDirty || Boolean(editor.current) || (reviewLayout && record.reviewStatus === 'rejected')} onClick={() => void w.saveScreenshot('rejected')}>{reviewLayout ? 'Reject' : 'Reject screenshot'}</button>
          <button disabled={w.busy || w.screenshotDirty || Boolean(editor.current) || (reviewLayout && record.reviewStatus === 'pending')} onClick={() => void w.saveScreenshot('pending')}>Mark pending</button>
          <button className={reviewLayout ? styles.primary : undefined} disabled={approvalBlocked || (reviewLayout && record.reviewStatus === 'approved')} onClick={() => void w.saveScreenshot('approved')}>{reviewLayout ? (w.records.some(item => item.id !== record.id && item.reviewStatus === 'pending') ? 'Approve & Next' : 'Approve') : 'Approve screenshot'}</button>
        </div>
        {editor.errors.reviewStatus && <p role="alert" className={styles.error}>{editor.errors.reviewStatus}</p>}
        <p>{reviewLayout ? 'Derived Game Tier' : 'Saved game tier'}: <strong>{tier ? `${GAME_TIER_DETAILS[tier].label} · ${record.classification.points} point${record.classification.points === 1 ? '' : 's'}` : 'Unclassified'}</strong></p>
        {w.screenshotDirty && <p className={styles.muted}>Save difficulty or notes separately before review.</p>}
        <details><summary>Capture provenance</summary><dl><dt>Capture</dt><dd>{record.provenance.captureId}</dd><dt>Source video</dt><dd>{record.provenance.source.title ?? record.provenance.source.videoId}</dd><dt>Playback</dt><dd>{record.provenance.capture.playbackSeconds} seconds</dd><dt>Captured</dt><dd>{record.provenance.capture.capturedAt}</dd></dl></details>
      </div>
    </div>
  </aside>;
}
