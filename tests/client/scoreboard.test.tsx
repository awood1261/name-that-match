import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GameScoreboard } from '../../client/src/game/GameScoreboard';
import type { ScoreRow } from '../../shared/src/game/contracts';

const scores: ScoreRow[] = [{ contestantId: 'b', name: 'Jordan', total: 5, lastOutcome: { outcome: 'correct', award: 3, turnOrdinal: 7 } }, { contestantId: 'a', name: 'Alex', total: 2, lastOutcome: { outcome: 'incorrect', award: 0, turnOrdinal: 6 } }];
describe('scoreboard and final totals', () => {
  it('renders authoritative sorted totals, active selection and actual global turn', () => {
    render(<GameScoreboard scores={scores} activeContestantId="b" turnsExposed={7} currentTurn={{ turnOrdinal: 7, contestantId: 'b' }} privateView />);
    const rows = screen.getAllByRole('listitem'); expect(rows[0]).toHaveTextContent('Jordan'); expect(rows[0]).toHaveTextContent('Rank 1'); expect(rows[0]).toHaveTextContent('5 points'); expect(rows[0]).toHaveTextContent('Active contestant');
    expect(rows[1]).toHaveTextContent('Rank 2'); expect(rows[1]).toHaveTextContent('Turn 6: Incorrect · 0 points'); expect(screen.getByText('Turn 7 · Jordan')).toBeInTheDocument(); expect(screen.queryByText(/of 3/)).not.toBeInTheDocument(); expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
  it.each([0, 3])('keeps tied %i-point contestants in server order with equal rank and no invented winner', (total) => {
    render(<GameScoreboard scores={[{ contestantId: 'a', name: 'Alex', total }, { contestantId: 'b', name: 'Jordan', total }]} activeContestantId="a" turnsExposed={2} />);
    const rows = screen.getAllByRole('listitem'); expect(rows[0]).toHaveTextContent('Alex'); expect(rows[1]).toHaveTextContent('Jordan'); expect(screen.getAllByText('Tied 1')).toHaveLength(2); expect(screen.queryByText(/Winner:/)).not.toBeInTheDocument();
  });
  it('identifies every tied final leader with immutable final totals', () => {
    render(<GameScoreboard scores={[{ contestantId: 'a', name: 'Alex', total: 0 }, { contestantId: 'b', name: 'Jordan', total: 0 }]} activeContestantId="b" turnsExposed={0} winnerIds={['a', 'b']} />);
    expect(screen.getByRole('region', { name: 'Final totals' })).toBeInTheDocument(); expect(screen.getByRole('status')).toHaveTextContent('Tie: Alex & Jordan'); expect(screen.getByText('Exposed turns: 0')).toBeInTheDocument(); expect(screen.queryByText('Active contestant')).not.toBeInTheDocument(); expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
  it('supports solo zero-score completion and a distinct head-to-head winner', () => {
    const view = render(<GameScoreboard scores={[{ contestantId: 'a', name: 'Solo', total: 0 }]} activeContestantId="a" turnsExposed={1} winnerIds={['a']} />);
    expect(screen.getByRole('status')).toHaveTextContent('Winner: Solo'); expect(screen.getAllByRole('listitem')).toHaveLength(1);
    view.rerender(<GameScoreboard scores={scores} activeContestantId="a" turnsExposed={7} winnerIds={['b']} />); expect(screen.getByRole('status')).toHaveTextContent('Winner: Jordan');
  });
  it.each(['correct', 'incorrect', 'timeout', 'void'] as const)('uses the server-provided latest %s outcome without awarding or editing points', (outcome) => {
    render(<GameScoreboard scores={[{ contestantId: 'a', name: 'Alex', total: 4, lastOutcome: { outcome, award: outcome === 'correct' ? 2 : 0, turnOrdinal: 12 } }]} activeContestantId="a" turnsExposed={12} compact />);
    const row = within(screen.getByRole('listitem')); expect(row.getByText('4', { exact: false })).toHaveTextContent('4 points'); expect(screen.getByText(/Turn 12:/)).toHaveTextContent(outcome === 'void' ? 'Void / Skip' : outcome[0].toUpperCase() + outcome.slice(1)); expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
  it('renders long names safely and labels an initial score without fabricated round results', () => {
    const name = '<Alex & Jordan> '.repeat(4);
    const view = render(<GameScoreboard scores={[{ contestantId: 'a', name, total: 0 }]} activeContestantId="a" turnsExposed={0} />);
    expect(screen.getByText(name.trim())).toBeInTheDocument(); expect(view.container.querySelector('alex')).toBeNull(); expect(screen.getByText('No revealed result yet')).toBeInTheDocument(); expect(screen.queryByText(/Turn 1:/)).not.toBeInTheDocument();
  });
});
