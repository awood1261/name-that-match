import { useEffect, useRef, useState } from 'react';
import { DIFFICULTIES, DIFFICULTY_DETAILS } from '../../../shared/src/library';
import { GAME_TIER_DETAILS } from '../../../shared/src/classification';
import type { MatchWorkspace } from './useMatchWorkspace';
import styles from './Library.module.css';

export function ScreenshotInspector({ workspace: w }: { workspace: MatchWorkspace }) {
  const heading = useRef<HTMLHeadingElement>(null); const [compared, setCompared] = useState(false);
  const editor = w.screenshotEditor;
  const currentRecord = editor?.current;
  useEffect(() => { const trigger = document.activeElement as HTMLElement | null; return () => { if (trigger?.isConnected) trigger.focus(); }; }, []);
  useEffect(() => { heading.current?.focus(); setCompared(false); }, [editor?.base.id, currentRecord]);
  if (!editor) return null;
  const position = w.records.findIndex((record) => record.id === editor.base.id);
  const record = editor.base; const tier = record.classification.tier;
  const blockers = record.eligibility.reasons.filter((reason) => !['pending_review', 'rejected_review'].includes(reason));
  return <aside className={styles.inspector} aria-labelledby="screenshot-editor-title">
    <div className={styles.heading}><h2 tabIndex={-1} ref={heading} id="screenshot-editor-title">Review screenshot</h2><button disabled={w.busy} onClick={w.closeScreenshot}>Back to collection</button></div>
    <nav className={styles.actions} aria-label="Screenshot navigation"><button disabled={w.busy || position <= 0} onClick={() => w.openScreenshot(w.records[position - 1])}>Previous screenshot</button><span>{position + 1} of {w.records.length}</span><button disabled={w.busy || position < 0 || position >= w.records.length - 1} onClick={() => w.openScreenshot(w.records[position + 1])}>Next screenshot</button></nav>
    <nav className={styles.thumbnails} aria-label="Screenshot thumbnails">{w.records.map((item) => <button key={item.id} disabled={w.busy} aria-pressed={record.id === item.id} aria-label={`Open capture ${item.provenance.captureId}`} onClick={() => w.openScreenshot(item)}><img src={item.image.url} width={item.image.width} height={item.image.height} loading="lazy" alt="" /></button>)}</nav>
    <img className={styles.preview} src={record.image.url} width={record.image.width} height={record.image.height} alt={`Selected capture ${record.provenance.captureId}`} />
    <p>Saved game tier: <strong>{tier ? `${GAME_TIER_DETAILS[tier].label} · ${record.classification.points} point${record.classification.points === 1 ? '' : 's'}` : 'Unclassified'}</strong></p>
    <p>Review: {record.reviewStatus}. {record.eligibility.eligible ? 'Eligible for gameplay.' : `Not eligible: ${record.eligibility.reasons.join(', ')}.`}</p>
    <p className={styles.muted}>Tier and readiness describe saved values. Save visual difficulty separately before review.</p>
    {editor.error && <p role="alert" className={styles.error}>{editor.error}</p>}
    {editor.current && <section className={styles.conflict} aria-label="Current server screenshot">
      <p>Current revision {editor.current.revision}: difficulty {editor.current.difficulty ?? 'unrated'}, notes {editor.current.notes ?? 'none'}, review {editor.current.reviewStatus}, match {editor.current.matchId ?? 'unassigned'}.</p>
      <label className={styles.selection}><input type="checkbox" checked={compared} onChange={(event) => setCompared(event.target.checked)} /> I compared the current server values</label>
      <div className={styles.actions}><button onClick={() => w.reloadScreenshot(false)} disabled={w.busy}>Reload screenshot values</button><button onClick={() => w.reloadScreenshot(true)} disabled={w.busy || !compared}>Use reviewed screenshot revision</button></div>
    </section>}
    <form className={styles.matchForm} noValidate onSubmit={(event) => { event.preventDefault(); void w.saveScreenshot(); }}>
      <div className={styles.matchField}><label htmlFor="screenshot-difficulty">Screenshot difficulty</label><select id="screenshot-difficulty" disabled={w.busy} value={editor.difficulty} aria-invalid={Boolean(editor.errors.difficulty)} aria-describedby="screenshot-difficulty-help" onChange={(event) => w.changeScreenshot('difficulty', event.target.value)}>
        <option value="">Unrated / unset</option>{DIFFICULTIES.map((difficulty) => <option key={difficulty} value={difficulty}>{DIFFICULTY_DETAILS[difficulty].label}</option>)}
      </select><p id="screenshot-difficulty-help">{editor.errors.difficulty ?? (editor.difficulty ? DIFFICULTY_DETAILS[editor.difficulty as typeof DIFFICULTIES[number]].definition : 'No difficulty assigned.')}</p></div>
      <div className={styles.matchField}><label htmlFor="screenshot-notes">Screenshot notes</label><textarea id="screenshot-notes" value={editor.notes} disabled={w.busy} aria-invalid={Boolean(editor.errors.notes)} aria-describedby={editor.errors.notes ? 'screenshot-notes-error' : undefined} onChange={(event) => w.changeScreenshot('notes', event.target.value)} />{editor.errors.notes && <p id="screenshot-notes-error" className={styles.error}>{editor.errors.notes}</p>}</div>
      <div className={styles.actions}><button type="submit" className={styles.primary} disabled={w.busy || Boolean(editor.current)}>Save screenshot</button><button type="button" onClick={w.cancelScreenshot} disabled={w.busy}>Cancel screenshot changes</button></div>
    </form>
    <div className={styles.actions} aria-label="Individual screenshot review"><button disabled={w.busy || w.screenshotDirty || Boolean(editor.current) || blockers.length > 0} onClick={() => void w.saveScreenshot('approved')}>Approve screenshot</button><button disabled={w.busy || w.screenshotDirty || Boolean(editor.current)} onClick={() => void w.saveScreenshot('rejected')}>Reject screenshot</button><button disabled={w.busy || w.screenshotDirty || Boolean(editor.current)} onClick={() => void w.saveScreenshot('pending')}>Mark pending</button></div>
    {editor.errors.reviewStatus && <p role="alert" className={styles.error}>{editor.errors.reviewStatus}</p>}
    <details><summary>Capture provenance</summary><dl><dt>Capture</dt><dd>{record.provenance.captureId}</dd><dt>Source video</dt><dd>{record.provenance.source.title ?? record.provenance.source.videoId}</dd><dt>Playback</dt><dd>{record.provenance.capture.playbackSeconds} seconds</dd><dt>Captured</dt><dd>{record.provenance.capture.capturedAt}</dd></dl></details>
  </aside>;
}
