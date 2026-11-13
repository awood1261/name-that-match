import type { DisplaySnapshot } from '../../../shared/src/game/contracts';
import { stageAnswer } from './stageText';
import { GameScoreboard } from './GameScoreboard';
import scene from './ContestantScene.module.css';
import styles from './ResultPresentation.module.css';

export function ResultPresentation({ result, animate, imageUrl = null, onImageError }: { result: Extract<DisplaySnapshot, { phase: 'answer_revealed' }>; animate: boolean; imageUrl?: string | null; onImageError?: () => void }) {
  const titles = { correct: 'CORRECT!', incorrect: 'INCORRECT!', timeout: 'TIME UP', void: 'ROUND VOIDED' };
  const answer = stageAnswer(result.answer);
  const dense = [answer.participantDescription, answer.promotion, answer.event, answer.stipulation, answer.championshipInfo].join('').length > 220;
  return <section className={`${scene.scene} ${styles.result}`} data-density={dense ? 'compact' : 'comfortable'} data-outcome={result.outcome} data-animate={animate} aria-label="Revealed result and match" aria-live="polite">
    <img className={`${scene.logo} ${styles.logo}`} src="/images/name-that-match-horizontal-logo.png" alt="Name That Match" />
    <div className={styles.feedback}>
      {imageUrl ? <img className={styles.image} src={imageUrl} alt="Revealed wrestling match clue" onError={onImageError} /> : <p className={styles.unavailable}>Screenshot unavailable</p>}
      <div className={styles.judgment}>
        <svg className={styles.icon} viewBox="0 0 120 120" aria-hidden="true" focusable="false">
          <circle cx="60" cy="60" r="50" />
          {result.outcome === 'correct' ? <path d="M30 60 50 80 90 37" /> : <path d="m38 38 44 44 m0-44-44 44" />}
        </svg>
        <h2 className={styles.outcome}>{titles[result.outcome]}</h2>
      </div>
    </div>
    <p className={styles.points}>{result.outcome === 'correct' ? '+' : ''}{result.award} {result.award === 1 ? 'POINT' : 'POINTS'} EARNED</p>
    <div className={styles.answer}>
      <h3>{answer.participantDescription}</h3>
      <p>{[answer.promotion, answer.event].filter(Boolean).join(' · ')}</p>
      {answer.matchDate && <p><time dateTime={answer.matchDate}>{answer.matchDate}</time></p>}
      {(answer.stipulation || answer.championshipInfo) && <dl className={styles.details}>
        {answer.stipulation && <div><dt>Stipulation</dt><dd>{answer.stipulation}</dd></div>}
        {answer.championshipInfo && <div><dt>Championship</dt><dd>{answer.championshipInfo}</dd></div>}
      </dl>}
    </div>
    <GameScoreboard scores={result.scores} activeContestantId={result.activeContestantId} turnsExposed={result.turnsExposed} stage compact
      currentTurn={result.turnOrdinal === null ? null : { turnOrdinal: result.turnOrdinal, contestantId: result.contestantId }} />
  </section>;
}
