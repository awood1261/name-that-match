import { useEffect, useRef, useState } from 'react';
import { GAME_TIER_DETAILS } from '../../../shared/src/classification';
import { Countdown } from './Countdown';
import { ContestantStage } from './ContestantStage';
import { DisplayControls } from './DisplayControls';
import { readDisplayJoin, useContestantDisplay } from './useContestantDisplay';
import { ResultPresentation } from './ResultPresentation';
import { GameScoreboard } from './GameScoreboard';
import { ChooseMatch } from './ChooseMatch';
import { SelectingMatch } from './SelectingMatch';
import { ScreenshotRound } from './ScreenshotRound';
import { LIVE_LIMITS } from '../../../shared/src/game/live';
import '../styles/contestant-fonts.css';
import styles from './ContestantDisplay.module.css';

export function ContestantDisplay({ sessionId }: { sessionId: string }) {
  const [guides, setGuides] = useState(false);
  const [credential, setCredential] = useState(() => readDisplayJoin(sessionId));
  useEffect(() => {
    const join = () => { if (new URLSearchParams(location.hash.slice(1)).has('token')) setCredential(readDisplayJoin(sessionId)); };
    window.addEventListener('hashchange', join); return () => window.removeEventListener('hashchange', join);
  }, [sessionId]);
  const display = useContestantDisplay(sessionId, credential); const snapshot = display.value?.snapshot;
  const phase = snapshot?.phase;
  const [recoveryExpired, setRecoveryExpired] = useState(false);
  useEffect(() => {
    if (!display.recovering) { setRecoveryExpired(false); return; }
    // Presentation grace only; never restart it for repeated failed reconnects.
    const timer = setTimeout(() => setRecoveryExpired(true), LIVE_LIMITS.staleMs);
    return () => clearTimeout(timer);
  }, [display.recovering]);
  // These scenes contain no clue or answer and do not need a synchronized clock.
  // Brief automatic recovery can keep them, but terminal/image/prolonged errors cannot.
  const untimedScene = !!credential && (!display.error || (display.recovering && !recoveryExpired)) && ['setup', 'between_rounds', 'preparing', 'ready'].includes(phase ?? '');
  const covered = display.stale && !untimedScene;
  const previous = useRef<{ roundId: string | null; phase: string | undefined }>({ roundId: null, phase: undefined });
  const [animateResult, setAnimateResult] = useState(false);
  const [selectionIntro, setSelectionIntro] = useState(false);
  const roundId = snapshot && 'roundId' in snapshot ? snapshot.roundId : null;
  useEffect(() => {
    const entrance = !display.stale && phase === 'answer_revealed' && previous.current.roundId === roundId && previous.current.phase !== undefined && previous.current.phase !== 'answer_revealed';
    const selecting = phase === 'preparing' || phase === 'ready';
    if (covered || !selecting) setSelectionIntro(false);
    else if (previous.current.roundId !== roundId || !['preparing', 'ready'].includes(previous.current.phase ?? '')) {
      setSelectionIntro(previous.current.phase === 'setup' || previous.current.phase === 'between_rounds');
    }
    previous.current = { roundId, phase: covered ? undefined : phase };
    setAnimateResult(entrance);
    if (!entrance) return;
    const timer = setTimeout(() => setAnimateResult(false), 650); return () => clearTimeout(timer);
  }, [phase, roundId, display.stale, covered]);
  const ownerId = snapshot && 'contestantId' in snapshot ? snapshot.contestantId : snapshot?.activeContestantId;
  const contestant = phase === 'completed' ? undefined : snapshot?.contestants.find((c) => c.id === ownerId)?.name;
  const tier = snapshot && 'requestedTier' in snapshot ? GAME_TIER_DETAILS[snapshot.requestedTier].label : null;
  const labels = { setup: 'Waiting for the host', between_rounds: 'Choose your challenge', discarded: 'Setup closed', completed: 'Game complete', preparing: 'Preparing your challenge', ready: 'Ready · waiting for reveal', guessing: 'Name that match!', paused: 'Paused', awaiting_judgment: 'Time up', interrupted: 'Round interrupted', adjudicated: 'Waiting for the host', answer_revealed: 'Result revealed' };
  const label = !credential ? 'Display link required' : display.stale ? display.error ? 'Display unavailable' : 'Connecting display' : (phase ? labels[phase] : 'Waiting for session');
  const visible = !display.stale && phase === 'guessing' && !!display.imageUrl;
  const visual = !covered && credential && snapshot && (!display.error || untimedScene || snapshot.phase === 'answer_revealed') ? snapshot.phase === 'setup' || snapshot.phase === 'between_rounds' ? <ChooseMatch />
    : snapshot.phase === 'preparing' || snapshot.phase === 'ready' ? <SelectingMatch key={snapshot.roundId} intro={selectionIntro} />
    : ['guessing', 'awaiting_judgment', 'adjudicated'].includes(snapshot.phase) && 'turnOrdinal' in snapshot && snapshot.turnOrdinal !== null && 'remainingMs' in snapshot && display.imageUrl ? <ScreenshotRound imageUrl={display.imageUrl} turnOrdinal={snapshot.turnOrdinal} tier={snapshot.requestedTier} remaining={snapshot.remainingMs === null ? null : display.remaining} running={snapshot.phase === 'guessing'} onImageError={display.retry} /> : snapshot.phase === 'answer_revealed' ? <ResultPresentation result={snapshot} animate={animateResult} imageUrl={display.imageUrl} onImageError={display.retry} /> : null : null;
  return <main className={styles.display}>
    <DisplayControls guides={guides} onGuides={setGuides} />
    <ContestantStage guides={guides} visual={!!visual}>{visual ?? <div className={styles.composition} data-phase={display.stale ? 'connecting' : phase}>
      <img className={styles.logo} src="/images/name-that-match-horizontal-logo.png" alt="Name That Match" />
      <header className={styles.heading} hidden={!contestant && !tier}>{snapshot && 'turnOrdinal' in snapshot && snapshot.turnOrdinal !== null && <p>Turn {snapshot.turnOrdinal}</p>}{contestant && <p>{contestant}</p>}{tier && <p className={styles.tier}>{tier}</p>}</header>
      <h1 className={styles.status} aria-live="polite">{label}</h1>
      <section className={styles.clue} aria-label={phase === 'completed' ? 'Final game results' : phase === 'between_rounds' ? 'Game scoreboard' : 'Match screenshot'}>
        {!display.stale && snapshot && (snapshot.phase === 'between_rounds' || snapshot.phase === 'completed') ? <GameScoreboard scores={snapshot.scores} activeContestantId={snapshot.activeContestantId} turnsExposed={snapshot.turnsExposed} stage winnerIds={snapshot.phase === 'completed' ? snapshot.winnerIds : undefined} />
          : !display.stale && snapshot?.phase === 'answer_revealed' ? <ResultPresentation key={snapshot.roundId} result={snapshot} animate={animateResult} />
          : visible ? <img src={display.imageUrl!} alt="Current wrestling match clue" onError={display.retry} /> : <p>{!credential ? 'Ask the host for a contestant display link.' : display.error ?? (['adjudicated', 'awaiting_judgment'].includes(phase ?? '') ? display.value?.asset ? 'Loading screenshot…' : 'Screenshot unavailable. Waiting for the host.' : phase === 'paused' ? 'Waiting for host resume' : phase === 'awaiting_judgment' ? 'Guessing has ended' : 'The screenshot stays hidden until the host reveals it.')}</p>}
      </section>
      {snapshot && 'remainingMs' in snapshot && snapshot.remainingMs !== null && !display.stale && <div className={styles.timer}><Countdown remainingMs={display.remaining.ms} observedAt={display.remaining.at} running={phase === 'guessing'} /></div>}
      {!display.stale && snapshot?.phase === 'answer_revealed' && <GameScoreboard scores={snapshot.scores} activeContestantId={snapshot.activeContestantId} turnsExposed={snapshot.turnsExposed}
        stage currentTurn={snapshot.turnOrdinal !== null ? { turnOrdinal: snapshot.turnOrdinal, contestantId: snapshot.contestantId } : null} compact />}
      {display.error && credential && <button className={styles.retry} onClick={display.retry}>Retry display connection</button>}
    </div>}</ContestantStage>
  </main>;
}
