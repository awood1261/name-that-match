import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { SelectingMatch } from '../../client/src/game/SelectingMatch';

afterEach(cleanup);
it('restores a settled theatrical scene with generic local art and no live clue or measured progress', () => {
  const view = render(<SelectingMatch intro={false} />);
  expect(screen.getByRole('heading', { name: 'SELECTING MATCH...' })).toBeInTheDocument();
  expect(screen.getByText(/does not perform wrestler recognition/)).toBeInTheDocument();
  const images = [...view.container.querySelectorAll('img')].filter(i => i.alt !== 'Name That Match');
  expect(images).toHaveLength(7);
  expect(images.every(i => /^\/images\/contestant\/(squash-match|competitive-match|deathmatch)\.svg$/.test(i.getAttribute('src')!))).toBe(true);
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  expect(screen.queryByRole('timer')).not.toBeInTheDocument();
  expect(screen.queryByAltText('Current wrestling match clue')).not.toBeInTheDocument();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  view.rerender(<SelectingMatch intro />);
  expect(screen.getByText('IDENTIFYING WRESTLERS')).toBeInTheDocument();
  expect(screen.getByText('ANALYZING EVENT')).toBeInTheDocument();
  expect(screen.getByText('DETERMINING DIFFICULTY')).toBeInTheDocument();
});
