import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ScreenshotRound } from '../../client/src/game/ScreenshotRound';
import { GAME_TIERS, GAME_TIER_DETAILS } from '../../shared/src/classification';
import { Countdown } from '../../client/src/game/Countdown';

afterEach(() => { cleanup(); vi.useRealTimers(); });
it.each(GAME_TIERS)('renders actual round/tier and the contained clue without identity for %s', (tier) => {
  const onImageError = vi.fn();
  render(<ScreenshotRound imageUrl="blob:opaque" turnOrdinal={3} tier={tier} remaining={{ ms: 30000, at: performance.now() }} onImageError={onImageError} />);
  expect(screen.getByText('ROUND 03')).toBeInTheDocument();
  expect(screen.getByText(GAME_TIER_DETAILS[tier].label)).toBeInTheDocument();
  expect(screen.getByRole('timer')).toHaveTextContent('00:30');
  expect(screen.getByRole('timer')).toHaveAttribute('aria-live', 'off');
  const image = screen.getByAltText('Current wrestling match clue'); expect(image).toHaveAttribute('src', 'blob:opaque');
  fireEvent.error(image); expect(onImageError).toHaveBeenCalledOnce();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
it('formats current remaining time, marks final seconds without another clock, clamps zero and preserves 100+ rounds', async () => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'performance'] });
  const at = performance.now();
  const view = render(<ScreenshotRound imageUrl="blob:opaque" turnOrdinal={103} tier="competitive" remaining={{ ms: 2300, at }} onImageError={() => {}} />);
  expect(screen.getByText('ROUND 103')).toBeInTheDocument(); expect(screen.getByRole('timer')).toHaveTextContent('00:03');
  expect(screen.getByRole('timer')).toHaveAttribute('data-urgent', 'true');
  await act(async () => { vi.advanceTimersByTime(3000); }); expect(screen.getByRole('timer')).toHaveTextContent('00:00');
  view.unmount(); expect(vi.getTimerCount()).toBe(0);
});
it('keeps clock-format pause frozen and uses only a supplied remainder when resumed', async () => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'performance'] });
  const view = render(<Countdown remainingMs={4500} observedAt={performance.now()} running={false} format="clock" />);
  await act(async () => { vi.advanceTimersByTime(10000); }); expect(screen.getByRole('timer')).toHaveTextContent('00:05');
  view.rerender(<Countdown remainingMs={4500} observedAt={performance.now()} running format="clock" />);
  await act(async () => { vi.advanceTimersByTime(1000); }); expect(screen.getByRole('timer')).toHaveTextContent('00:04');
  view.unmount(); expect(vi.getTimerCount()).toBe(0);
});
