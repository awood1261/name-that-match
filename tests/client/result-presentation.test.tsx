import { fireEvent, render, screen, within } from '@testing-library/react';
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
    expect(screen.getByText(answer.participantDescription)).toBeInTheDocument(); expect(view.container.textContent).not.toContain('Steel cage'); expect(screen.getByText('World title')).toBeInTheDocument(); expect(view.container.querySelector('team')).toBeNull();
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

it.each(['correct', 'incorrect', 'timeout'] as const)('places a known championship directly beneath show/year without changing frozen metadata for %s', (outcome) => {
  const answer = { ...context().answer, championshipInfo: 'World Heavyweight Championship' };
  render(<ResultPresentation result={result(outcome, outcome === 'correct' ? 2 : 0, answer)} animate={false} />);
  const championship = screen.getByText(answer.championshipInfo);
  expect(championship.previousElementSibling).toHaveTextContent(`${answer.promotion} · ${answer.event}`);
  expect(answer.championshipInfo).toBe('World Heavyweight Championship');
});

it.each(['correct', 'incorrect', 'timeout'] as const)('omits absent/blank championships for %s', (outcome) => {
  for (const championshipInfo of [null, '', '   ']) {
  const view = render(<ResultPresentation result={result(outcome, outcome === 'correct' ? 1 : 0, { ...context().answer, championshipInfo })} animate={false} />);
  expect(view.container.querySelector('[class*="championship"]')).toBeNull(); view.unmount();
  }
});

it.each(['correct', 'incorrect', 'timeout'] as const)('includes long championship text in the measured %s summary', (outcome) => {
  const championship = 'Championship '.repeat(35);
  const height = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(300);
  const scroll = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function(this: HTMLElement) { return this.querySelector('[class*=abbreviated]') ? 300 : 1000; });
  try {
    const answer = { ...context().answer, championshipInfo: championship };
    const view = render(<ResultPresentation result={result(outcome, outcome === 'correct' ? 1 : 0, answer)} animate={false} />);
    expect(view.container.querySelector('[class*="championship"]')?.textContent).toHaveLength(64);
    expect(screen.getByText('Summary · Full match details below')).toBeInTheDocument();
    expect(answer.championshipInfo).toBe(championship);
  } finally { height.mockRestore(); scroll.mockRestore(); }
});

it.each(['correct', 'incorrect', 'timeout'] as const)('uses the immutable round owner and projected total for %s', (outcome) => {
  const value = result(outcome, outcome === 'correct' ? 3 : 0); const owner = value.contestants[0]; const other = value.contestants[1];
  render(<ResultPresentation result={{ ...value, contestantId: owner.id, activeContestantId: other.id, scores: [{ contestantId: owner.id, name: owner.name, total: 7 }, { contestantId: other.id, name: other.name, total: 11 }] }} animate={false} />);
  const board = screen.getByRole('region', { name: 'Scoreboard' }); expect(board).toHaveTextContent(owner.name); expect(board).toHaveTextContent('7 POINTS'); expect(board).toHaveTextContent(`${other.name} · 11 points`);
  expect(within(board).queryByText('10 POINTS')).not.toBeInTheDocument(); expect(value.award).toBe(outcome === 'correct' ? 3 : 0);
});

it('keeps the correct-result strip compact for a solo contestant without a fabricated opponent', () => {
  const value = result('correct', 1); const owner = value.contestants[0];
  render(<ResultPresentation result={{ ...value, contestants: [owner], activeContestantId: owner.id, contestantId: owner.id, scores: [{ contestantId: owner.id, name: owner.name, total: 1 }] }} animate={false} />);
  const board = screen.getByRole('region', { name: 'Scoreboard' });
  expect(board).toHaveTextContent(owner.name); expect(board).toHaveTextContent('Total score1 POINT'); expect(board.textContent).not.toContain(value.contestants[1].name);
});

it.each([4, 6])('wraps the complete %i-person answer beyond the former 120-character excerpt', (count) => {
  const name = Array.from({ length: count }, (_, i) => `Professional Wrestler Number ${i + 1}`).join(' & ');
  expect(name.length).toBeGreaterThan(120);
  const answer = { ...context().answer, participantDescription: name };
  render(<ResultPresentation result={result('correct', 2, answer)} animate={false} />);
  expect(screen.getByRole('heading', { name })).toHaveTextContent(name); expect(answer.participantDescription).toBe(name);
});

it('marks a maximum-size summary only after measured overflow and leaves the frozen data untouched', () => {
  const answer = { ...context().answer, participantDescription: '🤼'.repeat(500), promotion: 'P'.repeat(500), event: 'E'.repeat(500) };
  const height = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(300);
  const scroll = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function(this: HTMLElement) { return this.querySelector('[class*=abbreviated]') ? 300 : 1000; });
  try {
    render(<ResultPresentation result={result('correct', 1, answer)} animate={false} />);
    expect(screen.getByText('Summary · Full match details below')).toBeInTheDocument();
    expect(Array.from(screen.getAllByRole('heading')[1].textContent!)).toHaveLength(160);
    expect(answer.participantDescription).toBe('🤼'.repeat(500));
  } finally { height.mockRestore(); scroll.mockRestore(); }
});


it('tightens only an overflowing summary until it fits without shrinking name text or changing metadata', () => {
  const answer = { ...context().answer, participantDescription: '界'.repeat(1000), championshipInfo: '界'.repeat(500) };
  const height = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(300);
  const scroll = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function(this: HTMLElement) {
    return Array.from(this.querySelector('h3')?.textContent ?? answer.participantDescription).length <= 24 ? 300 : 1000;
  });
  try {
    render(<ResultPresentation result={result('correct', 1, answer)} animate={false} />);
    expect(Array.from(screen.getAllByRole('heading')[1].textContent!)).toHaveLength(24);
    expect(screen.getByText('Summary · Full match details below')).toBeInTheDocument();
    expect(answer.participantDescription).toHaveLength(1000); expect(answer.championshipInfo).toHaveLength(500);
  } finally { height.mockRestore(); scroll.mockRestore(); }
});
