import type { DisplaySnapshot } from '../../../shared/src/game/contracts';
import { stageAnswer } from './stageText';
import styles from './ResultPresentation.module.css';

export function ResultPresentation({ result, animate }: { result: Extract<DisplaySnapshot, { phase: 'answer_revealed' }>; animate: boolean }) {
  const titles = { correct: 'CORRECT!', incorrect: 'INCORRECT!', timeout: 'TIME UP', void: 'ROUND VOIDED' };
  const answer = stageAnswer(result.answer);
  const dense = [answer.participantDescription, answer.promotion, answer.event, answer.stipulation, answer.championshipInfo].join('').length > 220;
  return <section className={styles.result} data-density={dense ? 'compact' : 'comfortable'} data-outcome={result.outcome} data-animate={animate} aria-label="Revealed result and match" aria-live="polite">
    <h2 className={styles.outcome}>{titles[result.outcome]}</h2>
    <p className={styles.points}>{result.award} {result.award === 1 ? 'POINT' : 'POINTS'} EARNED</p>
    <div className={styles.answer}>
      <h3>{answer.participantDescription}</h3>
      <p>{[answer.promotion, answer.event].filter(Boolean).join(' · ')}</p>
      {answer.matchDate && <p><time dateTime={answer.matchDate}>{answer.matchDate}</time></p>}
      {(answer.stipulation || answer.championshipInfo) && <dl className={styles.details}>
        {answer.stipulation && <div><dt>Stipulation</dt><dd>{answer.stipulation}</dd></div>}
        {answer.championshipInfo && <div><dt>Championship</dt><dd>{answer.championshipInfo}</dd></div>}
      </dl>}
    </div>
  </section>;
}
