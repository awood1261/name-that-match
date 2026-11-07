import type { MatchWorkspace } from './useMatchWorkspace';
import styles from './Library.module.css';
export function AssignmentPanel({ workspace: w }: { workspace: MatchWorkspace }) {
  if (!w.selected.length) return null;
  return <section className={styles.assignment} aria-labelledby="assignment-title">
    <h3 id="assignment-title">Assign selected screenshots</h3><p>{w.selected.length} selected · assignment saves separately from match details.</p>
    <label htmlFor="assignment-target">Target match</label>
    <select id="assignment-target" disabled={w.busy} value={w.target === 'unassigned' ? 'unassigned' : w.target?.id ?? ''} onChange={(event) => w.chooseTarget(event.target.value)}>
      <option value="">Choose a match</option>{w.selected.length === 1 && <option value="unassigned">Unassigned (remove association)</option>}
      {w.matches.map((match) => <option key={match.id} value={match.id}>{match.participantDescription ?? 'Untitled match'} · {match.promotion ?? 'Unknown promotion'} · {match.event ?? 'Unknown event'}{match.complete ? '' : ' (incomplete)'}</option>)}
    </select>
    <div className={styles.actions}><button className={styles.primary} disabled={w.busy || !w.target || Boolean(w.assignmentCurrent)} onClick={() => void w.saveAssignment()}>Save assignment</button><button disabled={w.busy} onClick={w.newMatch}>Create match for selection</button><button disabled={w.busy} onClick={w.clearSelection}>Clear selection</button></div>
    {w.assignmentError && <p role="alert" className={styles.error}>{w.assignmentError}</p>}
    {w.assignmentCurrent && <section className={styles.conflict} aria-label="Current assignment records"><h4>Compare current records</h4>
      <ul>{w.selected.map((record) => { const current = w.assignmentCurrent!.records.find((item) => item.id === record.id); return <li key={record.id}>{record.provenance.captureId}: selected revision {record.revision}, current {current?.revision ?? 'missing'}; current match {w.matches.find((match) => match.id === current?.matchId)?.participantDescription ?? current?.matchId ?? 'unassigned'}; review {current?.reviewStatus ?? 'unknown'}</li>; })}</ul>
      {w.target && w.target !== 'unassigned' && <p>Target revision: selected {w.target.revision}, current {w.assignmentCurrent.matches.find((match) => match.id === (w.target && w.target !== 'unassigned' ? w.target.id : ''))?.revision ?? 'missing'}</p>}
      <button disabled={w.busy} onClick={w.reviewAssignment}>Use reviewed selection and target revisions</button><p>This keeps the desired target and does not assign automatically.</p>
    </section>}
  </section>;
}
