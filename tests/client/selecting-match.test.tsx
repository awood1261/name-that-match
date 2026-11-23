import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SelectingMatch } from '../../client/src/game/SelectingMatch';

beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

function selection() {
  return screen.getByRole('region', { name: 'SELECTING MATCH...' });
}

function phase() {
  return selection().getAttribute('data-selection-phase');
}

function advance(ms: number) {
  act(() => vi.advanceTimersByTime(ms));
}

it.each([
  ['squash', 'EASY', 'squash-match'],
  ['competitive', 'MEDIUM', 'competitive-match'],
  ['deathmatch', 'HARD', 'deathmatch'],
] as const)('locks %s in the center through impact and the settled hold', (tier, label, art) => {
  const view = render(<SelectingMatch tier={tier} intro />);
  expect(phase()).toBe('shuffling');
  expect(selection().querySelector('[data-center="true"]')).toBeNull();
  const movingCards = selection().querySelectorAll('img[src^="/images/contestant/"]');
  expect(movingCards).toHaveLength(18);
  advance(899);
  expect(phase()).toBe('shuffling');
  advance(1);
  expect(phase()).toBe('decelerating');
  advance(550);
  expect(phase()).toBe('locked');
  const center = selection().querySelector('[data-center="true"]');
  expect(selection().querySelectorAll('img[src^="/images/contestant/"]')).toHaveLength(7);
  expect(center).toHaveAttribute('data-tier', tier);
  expect(center).toHaveAttribute('data-offset', '0');
  expect(center).toHaveTextContent(label);
  expect(center?.querySelector('img')).toHaveAttribute('src', `/images/contestant/${art}.svg`);
  view.rerender(<SelectingMatch tier={tier} intro />);
  advance(200);
  expect(phase()).toBe('impact');
  expect(selection().querySelector('[data-center="true"]')).toBe(center);
  advance(400);
  expect(phase()).toBe('complete');
  expect(selection().querySelector('[data-center="true"]')).toBe(center);
  advance(5000);
  expect(phase()).toBe('complete');
  expect(vi.getTimerCount()).toBe(0);
});

it('restores a settled theatrical scene with generic local art and no live clue or measured progress', () => {
  render(<SelectingMatch tier="deathmatch" intro={false} />);
  expect(phase()).toBe('complete');
  expect(selection().querySelector('[data-center="true"]')).toHaveTextContent('Selected difficulty: HARD');
  expect(screen.getByText(/does not perform wrestler recognition/)).toBeInTheDocument();
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  expect(screen.queryByRole('timer')).not.toBeInTheDocument();
  expect(screen.queryByAltText('Current wrestling match clue')).not.toBeInTheDocument();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  expect(screen.getByText('IDENTIFYING WRESTLERS')).toBeInTheDocument();
  expect(screen.getByText('ANALYZING EVENT')).toBeInTheDocument();
  expect(screen.getByText('DETERMINING DIFFICULTY')).toBeInTheDocument();
  expect(vi.getTimerCount()).toBe(0);
});

it('skips expired visual phases when a callback runs late', () => {
  vi.spyOn(performance, 'now').mockReturnValueOnce(100).mockReturnValue(100);
  render(<SelectingMatch tier="squash" intro />);
  expect(phase()).toBe('shuffling');
  vi.mocked(performance.now).mockReturnValue(2550);
  advance(900);
  expect(phase()).toBe('complete');
  expect(selection().querySelector('[data-center="true"]')).toHaveAttribute('data-tier', 'squash');
  expect(vi.getTimerCount()).toBe(0);
});

it('releases timed work on round replacement and unmount', () => {
  const view = render(<SelectingMatch key="one" tier="squash" intro />);
  advance(900);
  expect(phase()).toBe('decelerating');
  view.rerender(<SelectingMatch key="two" tier="competitive" intro />);
  expect(phase()).toBe('shuffling');
  expect(vi.getTimerCount()).toBe(1);
  view.unmount();
  expect(vi.getTimerCount()).toBe(0);
});

it('settles immediately for reduced motion on entry or when toggled mid-intro', () => {
  const preference = Object.assign(new EventTarget(), { matches: true });
  vi.stubGlobal('matchMedia', vi.fn(() => preference));
  const view = render(<SelectingMatch key="one" tier="squash" intro />);
  expect(phase()).toBe('complete');
  expect(vi.getTimerCount()).toBe(0);

  preference.matches = false;
  view.rerender(<SelectingMatch key="two" tier="deathmatch" intro />);
  advance(1650);
  expect(phase()).toBe('impact');
  preference.matches = true;
  act(() => { preference.dispatchEvent(Object.assign(new Event('change'), { matches: true })); });
  expect(phase()).toBe('complete');
  expect(vi.getTimerCount()).toBe(0);
  preference.matches = false;
  act(() => { preference.dispatchEvent(Object.assign(new Event('change'), { matches: false })); });
  expect(phase()).toBe('complete');
});
