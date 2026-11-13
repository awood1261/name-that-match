import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ResultPresentation } from '../../client/src/game/ResultPresentation';
import { context, pureGame } from '../game/fixtures';
import { displaySnapshot } from '../../shared/src/game/projections';
import type { Answer } from '../../shared/src/game/contracts';
import { isPartialDate } from '../../server/src/library/validation';

function result(outcome: 'correct' | 'incorrect' | 'timeout' | 'void', award: number, answer: Answer = context().answer) {
  const game = pureGame(); game.ready(); game.step({ type: 'REVEAL_AND_START' }); game.step({ type: 'CORRECT' }); game.step({ type: 'REVEAL_ANSWER' });
  const snapshot = displaySnapshot(game.state, null, 0); if (snapshot.phase !== 'answer_revealed') throw new Error('Missing result');
  return { ...snapshot, outcome, award, answer };
}
describe('authoritative revealed result presentation', () => {
  it.each([['correct', 1, 'CORRECT!'], ['correct', 2, 'CORRECT!'], ['correct', 3, 'CORRECT!'], ['incorrect', 0, 'INCORRECT!'], ['timeout', 0, 'TIME UP'], ['void', 0, 'ROUND VOIDED']] as const)('presents %s with its committed %i points', (outcome, award, heading) => {
    render(<ResultPresentation result={result(outcome, award)} animate={false} />);
    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument(); expect(screen.getByText(`${outcome === 'correct' ? '+' : ''}${award} ${award === 1 ? 'POINT' : 'POINTS'} EARNED`)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Revealed result and match' })).toHaveAttribute('data-outcome', outcome); expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
  it.each([null, '2024', '2024-08', '2024-08-25'] as const)('preserves exact known date precision %s without invented metadata', (matchDate) => {
    const date: unknown = matchDate; if (date !== null && !isPartialDate(date)) throw new Error('Invalid test date');
    const answer = { ...context().answer, matchDate: date, stipulation: null, championshipInfo: null };
    const view = render(<ResultPresentation result={result('correct', 3, answer)} animate={false} />);
    expect(screen.getByText(answer.participantDescription)).toBeInTheDocument(); expect(screen.getByText(`${answer.promotion} · ${answer.event}`)).toBeInTheDocument();
    if (matchDate) expect(view.container.querySelector('time')).toHaveAttribute('datetime', matchDate); else expect(view.container.querySelector('time')).toBeNull();
    expect(screen.queryByText('Stipulation')).not.toBeInTheDocument(); expect(screen.queryByText('Championship')).not.toBeInTheDocument(); expect(view.container.textContent).not.toMatch(/Unknown|undefined|null/);
  });
  it('renders the frozen flexible team description and optional editorial metadata as text', () => {
    const answer = { ...context().answer, participantDescription: '<Team A> vs Team B & Team C', stipulation: 'Steel cage', championshipInfo: 'World title' };
    const view = render(<ResultPresentation result={result('incorrect', 0, answer)} animate={false} />);
    expect(screen.getByText(answer.participantDescription)).toBeInTheDocument(); expect(screen.getByText('Steel cage')).toBeInTheDocument(); expect(screen.getByText('World title')).toBeInTheDocument(); expect(view.container.querySelector('team')).toBeNull();
  });
});

it.each(['correct', 'incorrect', 'timeout'] as const)('composes %s over the actual clue with independent feedback and preserved answer/scores', outcome => {
  const onImageError = vi.fn(); const view = render(<ResultPresentation result={result(outcome, outcome === 'correct' ? 2 : 0)} animate={false} imageUrl="blob:actual-clue" onImageError={onImageError} />);
  const image = screen.getByAltText('Revealed wrestling match clue'); expect(image).toHaveAttribute('src', 'blob:actual-clue');
  expect(view.container.querySelector('svg circle')).toBeInTheDocument(); expect(view.container.querySelector('svg path')).toBeInTheDocument();
  expect(screen.getByText(context().answer.participantDescription)).toBeInTheDocument(); expect(screen.getByRole('region', { name: 'Scoreboard' })).toBeInTheDocument();
  fireEvent.error(image); expect(onImageError).toHaveBeenCalledOnce(); expect(view.container.innerHTML).not.toContain('design-comps');
});
it('keeps a revealed answer accessible with an explicit missing-image fallback', () => {
  render(<ResultPresentation result={result('incorrect', 0)} animate={false} imageUrl={null} />);
  expect(screen.getByText('Screenshot unavailable')).toBeInTheDocument(); expect(screen.getByText(context().answer.participantDescription)).toBeInTheDocument();
});
