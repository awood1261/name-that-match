import { useEffect, useRef, useState } from 'react';
import { OBSCURITIES, OBSCURITY_DETAILS } from '../../../shared/src/library';
import { MATCH_LABELS } from './match-draft';
import type { MatchWorkspace } from './useMatchWorkspace';
import styles from './Library.module.css';
export function MatchInspector({ workspace: w }: { workspace: MatchWorkspace }) {
  const heading = useRef<HTMLHeadingElement>(null); const [reviewed, setReviewed] = useState(false);
  const currentMatch = w.editor?.current;
  useEffect(() => { const trigger = document.activeElement as HTMLElement | null; return () => { if (trigger?.isConnected) trigger.focus(); }; }, []);
  useEffect(() => { heading.current?.focus(); setReviewed(false); }, [w.editor?.base?.id, currentMatch]);
  const editor = w.editor; if (!editor) return null;
  return <aside className={styles.inspector} aria-labelledby="match-editor-title">
    <div className={styles.heading}><h2 ref={heading} tabIndex={-1} id="match-editor-title">{editor.base ? 'Edit match' : 'Create match'}</h2><button disabled={w.busy} onClick={w.closeEditor}>Back to screenshots</button></div>
    <p>Participants, promotion and event identify a complete match. Missing values can be saved as an incomplete draft.</p>
    {w.selected.length > 0 && <p>{w.selected.length} screenshots remain selected. Save the match, then explicitly assign them.</p>}
    {editor.error && <p role="alert" className={styles.error}>{editor.error}</p>}
    {editor.current && <section className={styles.conflict} aria-label="Current server match">
      <h3>Current server values · revision {editor.current.revision}</h3>
      <dl>{Object.entries(MATCH_LABELS).map(([field, label]) => <div key={field}><dt>{label}</dt><dd>{String(editor.current![field as keyof typeof MATCH_LABELS] ?? 'Unknown')}</dd></div>)}</dl>
      <label><input type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} /> I compared my draft with the current server values</label>
      <div className={styles.actions}><button disabled={w.busy} onClick={() => w.reloadMatch(false)}>Reload server values</button><button disabled={!reviewed || w.busy} onClick={() => w.reloadMatch(true)}>Use reviewed server revision</button></div>
      <p>Your draft is kept until you explicitly reload it. Using the reviewed revision does not save automatically.</p>
    </section>}
    {editor.error && !editor.current && <button disabled={w.busy} onClick={() => void w.reloadConflict()}>Load current server match</button>}
    <form className={styles.matchForm} onSubmit={(event) => { event.preventDefault(); void w.saveMatch(); }} noValidate>
      {Object.entries(MATCH_LABELS).map(([name, label]) => {
        const field = name as keyof typeof MATCH_LABELS; const errorId = `match-${field}-error`;
        return <div className={styles.matchField} key={field}><label htmlFor={`match-${field}`}>{label}</label>
          {field === 'obscurity' ? <select id={`match-${field}`} disabled={w.busy} value={editor.draft[field]} aria-invalid={Boolean(editor.errors[field])} aria-describedby={`${editor.errors[field] ? errorId + ' ' : ''}obscurity-help`} onChange={(event) => w.changeMatch(field, event.target.value)}>
            <option value="">Unknown / unset</option>{OBSCURITIES.map((value) => <option key={value} value={value}>{OBSCURITY_DETAILS[value].label}</option>)}
          </select> : field === 'notes' || field === 'participantDescription' ? <textarea id={`match-${field}`} disabled={w.busy} rows={field === 'notes' ? 4 : 2} value={editor.draft[field]} aria-invalid={Boolean(editor.errors[field])} aria-describedby={editor.errors[field] ? errorId : undefined} onChange={(event) => w.changeMatch(field, event.target.value)} />
            : <input id={`match-${field}`} disabled={w.busy} type="text" value={editor.draft[field]} placeholder={field === 'matchDate' ? 'YYYY, YYYY-MM or YYYY-MM-DD' : 'Unknown'} aria-invalid={Boolean(editor.errors[field])} aria-describedby={editor.errors[field] ? errorId : undefined} onChange={(event) => w.changeMatch(field, event.target.value)} />}
          {editor.errors[field] && <p id={errorId} className={styles.error}>{editor.errors[field]}</p>}
        </div>;
      })}
      <details id="obscurity-help"><summary>About match obscurity</summary>{OBSCURITIES.map((value) => <p key={value}><strong>{OBSCURITY_DETAILS[value].label}:</strong> {OBSCURITY_DETAILS[value].definition}</p>)}<p>Match obscurity is independent of each screenshot's difficulty and points.</p></details>
      <div className={styles.actions}><button className={styles.primary} disabled={w.busy || Boolean(editor.current)} type="submit">Save match</button><button type="button" disabled={w.busy} onClick={w.cancelMatch}>Cancel match changes</button></div>
    </form>
    {editor.base && w.selected.length > 0 && <button disabled={w.busy || w.matchDirty} onClick={() => w.chooseTarget(editor.base!.id)}>Use this match for selected screenshots</button>}
  </aside>;
}
