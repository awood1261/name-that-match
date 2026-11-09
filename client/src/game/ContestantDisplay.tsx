import { useEffect, useState } from 'react';
import { GAME_TIER_DETAILS } from '../../../shared/src/classification';
import { Countdown } from './Countdown';
import { readDisplayJoin, useContestantDisplay } from './useContestantDisplay';
import styles from './ContestantDisplay.module.css';

export function ContestantDisplay({ sessionId }: { sessionId: string }) {
  const [credential, setCredential] = useState(() => readDisplayJoin(sessionId));
  useEffect(() => {
    const join = () => { if (new URLSearchParams(location.hash.slice(1)).has('token')) setCredential(readDisplayJoin(sessionId)); };
    window.addEventListener('hashchange', join); return () => window.removeEventListener('hashchange', join);
  }, [sessionId]);
  const display = useContestantDisplay(sessionId, credential); const snapshot = display.value?.snapshot;
  const phase = snapshot?.phase;
  const ownerId = snapshot && 'contestantId' in snapshot ? snapshot.contestantId : snapshot?.activeContestantId;
  const contestant = snapshot?.contestants.find((c) => c.id === ownerId)?.name;
  const tier = snapshot && 'requestedTier' in snapshot ? GAME_TIER_DETAILS[snapshot.requestedTier].label : null;
  const labels = { setup: 'Waiting for the host', between_rounds: 'Choose your challenge', discarded: 'Setup closed', completed: 'Game complete', preparing: 'Preparing your challenge', ready: 'Ready · waiting for reveal', guessing: 'Name that match!', paused: 'Paused', awaiting_judgment: 'Time up', interrupted: 'Round interrupted', adjudicated: 'Round complete', answer_revealed: 'Round complete' };
  const feedback = snapshot && snapshot.phase === 'adjudicated' ? snapshot.outcome === 'correct' ? 'Correct!' : snapshot.outcome === 'incorrect' ? 'Incorrect' : snapshot.outcome === 'timeout' ? 'Time up · no credit' : 'Round skipped / void' : null;
  const label = !credential ? 'Display link required' : display.stale ? display.error ? 'Display unavailable' : 'Connecting display' : feedback ?? (phase ? labels[phase] : 'Waiting for session');
  const visible = !display.stale && phase === 'guessing' && !!display.imageUrl;
  return <main className={styles.display}>
    <div className={styles.stage} data-phase={display.stale ? 'connecting' : phase}>
      <img className={styles.logo} src="/images/name-that-match-horizontal-logo.png" alt="Name That Match" />
      <header className={styles.heading}>{contestant && <p>{contestant}</p>}{tier && <p className={styles.tier}>{tier}</p>}</header>
      <h1 className={styles.status} aria-live="polite">{label}</h1>
      <section className={styles.clue} aria-label="Match screenshot">
        {visible ? <img src={display.imageUrl!} alt="Current wrestling match clue" onError={display.retry} /> : <p>{!credential ? 'Ask the host for a contestant display link.' : display.error ?? (phase === 'paused' ? 'Waiting for host resume' : phase === 'awaiting_judgment' ? 'Guessing has ended' : 'The screenshot stays hidden until the host reveals it.')}</p>}
      </section>
      {snapshot && 'remainingMs' in snapshot && !display.stale && <div className={styles.timer}><Countdown remainingMs={display.remaining.ms} observedAt={display.remaining.at} running={phase === 'guessing'} /></div>}
      {display.error && credential && <button className={styles.retry} onClick={display.retry}>Retry display connection</button>}
    </div>
  </main>;
}
