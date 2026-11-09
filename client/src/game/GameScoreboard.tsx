import { useId } from 'react';
import type { ScoreRow } from '../../../shared/src/game/contracts';
import styles from './GameScoreboard.module.css';

const outcomes = { correct: 'Correct', incorrect: 'Incorrect', timeout: 'Timeout', void: 'Void / Skip' };

export function GameScoreboard({ scores, activeContestantId, turnsExposed, currentTurn, winnerIds, compact = false, privateView = false }: {
  scores: ScoreRow[]; activeContestantId: string; turnsExposed: number;
  currentTurn?: { turnOrdinal: number; contestantId: string } | null;
  winnerIds?: string[]; compact?: boolean; privateView?: boolean;
}) {
  const titleId = useId(); const final = winnerIds !== undefined;
  const winners = scores.filter((row) => winnerIds?.includes(row.contestantId)).map((row) => row.name);
  const owner = scores.find((row) => row.contestantId === currentTurn?.contestantId);
  return <section className={styles.scoreboard} data-compact={compact} aria-labelledby={titleId}>
    <header className={styles.heading}><h3 id={titleId}>{final ? 'Final totals' : 'Scoreboard'}</h3>
      <p>{currentTurn && !final ? `Turn ${currentTurn.turnOrdinal} · ${owner?.name ?? ''}` : `Exposed turns: ${turnsExposed}`}</p>
    </header>
    {final && <p className={styles.winner} role="status">{winners.length > 1 ? 'Tie' : 'Winner'}: {winners.join(' & ')}</p>}
    <ol className={styles.rows}>
      {scores.map((row) => {
        // Rank is presentation of the server's sorted rows; never recalculate totals.
        const rank = scores.findIndex((other) => other.total === row.total) + 1;
        const tied = scores.filter((other) => other.total === row.total).length > 1;
        return <li key={row.contestantId} value={rank} className={styles.row} data-active={!final && row.contestantId === activeContestantId}>
          <div className={styles.identity}><span className={styles.rank}>{tied ? `Tied ${rank}` : `Rank ${rank}`}</span><strong className={styles.name}>{row.name}</strong>
            {!final && row.contestantId === activeContestantId && <span className={styles.active}>Active contestant</span>}
          </div>
          <p className={styles.total}>{row.total} <span>{row.total === 1 ? 'point' : 'points'}</span></p>
          <p className={styles.latest}>{row.lastOutcome ? `Turn ${row.lastOutcome.turnOrdinal}: ${outcomes[row.lastOutcome.outcome]} · ${row.lastOutcome.award} ${row.lastOutcome.award === 1 ? 'point' : 'points'}` : privateView ? 'No saved result yet' : 'No revealed result yet'}</p>
        </li>;
      })}
    </ol>
    {!final && <p className={styles.caption}>{privateView ? 'Host totals include saved judgments.' : 'Scores and results update when the host reveals them.'}</p>}
  </section>;
}
