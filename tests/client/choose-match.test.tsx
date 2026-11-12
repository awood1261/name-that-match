import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { ChooseMatch } from '../../client/src/game/ChooseMatch';

afterEach(cleanup);
it('renders three informational cards with independent approved SVG elements and semantic labels/points', () => {
  render(<ChooseMatch />);
  expect(screen.getByRole('heading', { name: 'CHOOSE YOUR MATCH' })).toBeInTheDocument();
  const cards = within(screen.getByRole('list', { name: 'Match difficulty tiers' })).getAllByRole('listitem');
  for (const [index, label] of ['Squash Match', 'Competitive Match', 'Deathmatch'].entries()) {
    expect(within(cards[index]).getByRole('heading', { name: label })).toBeInTheDocument();
    expect(cards[index].querySelector('img')).toHaveAttribute('src', `/images/contestant/${['squash-match', 'competitive-match', 'deathmatch'][index]}.svg`);
    expect(within(cards[index]).getByText(`${index + 1} ${index === 0 ? 'POINT' : 'POINTS'}`)).toBeInTheDocument();
    expect(cards[index]).not.toHaveAttribute('tabindex');
  }
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  expect(screen.queryByText(/available|unavailable/i)).not.toBeInTheDocument();
  expect(screen.queryByRole('timer')).not.toBeInTheDocument();
});
