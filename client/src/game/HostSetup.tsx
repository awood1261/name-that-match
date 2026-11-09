import { useEffect, useState, type FormEvent } from 'react';
import type { HostSnapshot } from '../../../shared/src/game/contracts';
import styles from './HostPage.module.css';

export function HostSetup({ session, disabled, onSave, onDirty }: {
  session: HostSnapshot['session'] | null; disabled: boolean; onSave: (names: string[], startingIndex: number) => void; onDirty: (dirty: boolean) => void;
}) {
  const [count, setCount] = useState(session?.contestants.length ?? 1);
  const [names, setNames] = useState([session?.contestants[0]?.name ?? '', session?.contestants[1]?.name ?? '']);
  const [startingIndex, setStartingIndex] = useState(session ? Math.max(0, session.contestants.findIndex((p) => p.id === session.activeContestantId)) : 0);
  const [errors, setErrors] = useState<Record<number, string>>({});
  const dirty = !!session && (JSON.stringify(names.slice(0, count)) !== JSON.stringify(session.contestants.map((p) => p.name))
    || session.contestants[startingIndex]?.id !== session.activeContestantId);
  useEffect(() => { onDirty(dirty); return () => onDirty(false); }, [dirty, onDirty]);
  function submit(event: FormEvent) {
    event.preventDefault();
    const clean = names.slice(0, count).map((name) => name.trim()); const nextErrors: Record<number, string> = {};
    clean.forEach((name, i) => {
      if (!name || Array.from(name).length > 60) nextErrors[i] = 'Enter a name of 1–60 characters.';
      if (clean.some((other, j) => i !== j && other.toLowerCase() === name.toLowerCase())) nextErrors[i] = 'Use a distinct name for each contestant.';
    });
    setErrors(nextErrors); if (!Object.keys(nextErrors).length) onSave(clean, startingIndex);
  }
  return <form onSubmit={submit} className={styles.card} aria-label="Session setup">
    <h3>{session ? 'Edit setup' : 'Create a game session'}</h3>
    <p>Solo or head-to-head. You control who plays each round.</p>
    <fieldset disabled={disabled} className={styles.formFields}>
      <legend className={styles.visuallyHidden}>Contestants</legend>
      <label htmlFor="game-contestant-count">Number of contestants</label>
      <select id="game-contestant-count" value={count} onChange={(e) => { const value = Number(e.target.value); setCount(value); if (startingIndex >= value) setStartingIndex(0); }}>
        <option value={1}>1 — Solo</option><option value={2}>2 — Head-to-head</option>
      </select>
      {names.slice(0, count).map((name, i) => <div key={i} className={styles.field}>
        <label htmlFor={`game-name-${i}`}>Contestant {i + 1} name</label>
        <input id={`game-name-${i}`} value={name} required autoComplete="off" aria-invalid={!!errors[i]} aria-describedby={errors[i] ? `game-name-error-${i}` : undefined}
          onChange={(e) => setNames((current) => current.map((value, index) => index === i ? e.target.value : value))} />
        {errors[i] && <p id={`game-name-error-${i}`} className={styles.error}>{errors[i]}</p>}
      </div>)}
      <label htmlFor="game-starting-contestant">Starting contestant</label>
      <select id="game-starting-contestant" value={startingIndex} onChange={(e) => setStartingIndex(Number(e.target.value))}>
        {names.slice(0, count).map((name, i) => <option value={i} key={i}>{name.trim() || `Contestant ${i + 1}`}</option>)}
      </select>
      <button className={styles.primary} type="submit">{session ? 'Save setup' : 'Create session'}</button>
    </fieldset>
  </form>;
}
