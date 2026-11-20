import { useLayoutEffect, useRef, useState } from 'react';
import type { DisplaySnapshot } from '../../../shared/src/game/contracts';
import scene from './ContestantScene.module.css';
import styles from './MatchResult.module.css';

type RevealedResult = Extract<DisplaySnapshot, { phase: 'answer_revealed' }>;

function summary(value: string, length: number) {
  const letters = Array.from(value.replace(/\s+/gu, ' ').trim());
  return letters.length > length ? letters.slice(0, length - 1).join('') + '…' : letters.join('');
}

/** Revealed public data only. Text fitting never changes the frozen answer or game. */
export function MatchResult({ result, animate, imageUrl, onImageError }: {
  result: RevealedResult; animate: boolean; imageUrl: string | null; onImageError?: () => void;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const [summaryLevel, setSummaryLevel] = useState(0);
  const abbreviated = summaryLevel > 0;
  const limits = [{ names: 160, metadata: 64, championship: 64 }, { names: 80, metadata: 32, championship: 32 }, { names: 24, metadata: 16, championship: 16 }][summaryLevel - 1];
  const [measurement, setMeasurement] = useState(0);
  const answer = result.answer;
  const championship = answer.championshipInfo?.trim() || null;
  const dense = answer.participantDescription.length + answer.promotion.length + answer.event.length + (championship?.length ?? 0) > 150;
  useLayoutEffect(() => {
    const recheck = () => { setSummaryLevel(0); setMeasurement((value) => value + 1); };
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(recheck);
    observer?.observe(frame.current!);
    document.fonts?.addEventListener('loadingdone', recheck);
    recheck();
    return () => { observer?.disconnect(); document.fonts?.removeEventListener('loadingdone', recheck); };
  }, [answer.participantDescription, answer.promotion, answer.event, championship, result.roundId]);
  useLayoutEffect(() => {
    const element = frame.current;
    if (summaryLevel < 3 && element && element.clientHeight > 0 && element.scrollHeight > element.clientHeight + 1) setSummaryLevel((level) => level + 1);
  }, [summaryLevel, measurement]);
  const owner = result.contestants.find((contestant) => contestant.id === result.contestantId);
  const total = result.scores.find((score) => score.contestantId === result.contestantId);
  const others = result.scores.filter((score) => score.contestantId !== result.contestantId);
  const year = answer.matchDate?.slice(0, 4);
  return <section className={`${scene.scene} ${styles.result}`} data-outcome={result.outcome} data-animate={animate} data-championship={!!championship} data-density={dense ? 'dense' : 'comfortable'} data-abbreviated={abbreviated} aria-label="Revealed result and match" aria-live="polite">
    <img className={`${scene.logo} ${styles.logo}`} src="/images/name-that-match-horizontal-logo.png" alt="Name That Match" />
    <div ref={frame} className={styles.frame}>
      {imageUrl ? <img className={styles.image} src={imageUrl} alt="Revealed wrestling match clue" onError={onImageError} /> : <p className={styles.unavailable}>Screenshot unavailable</p>}
      <div className={styles.judgment}>
        <svg className={styles.check} viewBox="0 0 120 120" aria-hidden="true" focusable="false"><circle cx="60" cy="60" r="50" /><path d={result.outcome === 'correct' ? 'M30 60 50 80 90 37' : 'm38 38 44 44 m0-44-44 44'} /></svg>
        <h2>{result.outcome === 'correct' ? 'CORRECT!' : result.outcome === 'incorrect' ? 'INCORRECT!' : 'TIME UP'}</h2>
      </div>
      <div className={styles.identification}>
        <p className={styles.introduction}>The match was</p>
        <h3>{limits ? summary(answer.participantDescription, limits.names) : answer.participantDescription}</h3>
        <p className={styles.metadata}>{limits ? summary(answer.promotion, limits.metadata) : answer.promotion} · {limits ? summary(answer.event, limits.metadata) : answer.event}{year && <> <time dateTime={answer.matchDate!}>{year}</time></>}</p>
        {championship && <p className={styles.championship}>{limits ? summary(championship, limits.championship) : championship}</p>}
        {abbreviated && <p className={styles.abbreviated}>Summary · Full match details below</p>}
      </div>
    </div>
    <p className={styles.points}>{result.outcome === 'correct' ? '+' : ''}{result.award} {result.award === 1 ? 'POINT' : 'POINTS'} EARNED</p>
    <section className={styles.scores} aria-label="Scoreboard">
      <div className={styles.ownerStrip}><p><span>Contestant</span><strong>{owner?.name ?? total?.name}</strong></p><p><span>Total score</span><strong>{total?.total ?? '—'} {total?.total === 1 ? 'POINT' : 'POINTS'}</strong></p></div>
      {others.length > 0 && <p className={styles.otherScores}>{others.map((score) => <span key={score.contestantId}>{score.name} · {score.total} {score.total === 1 ? 'point' : 'points'}</span>)}</p>}
    </section>
  </section>;
}
