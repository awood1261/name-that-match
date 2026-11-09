import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { ContestantDisplay } from '../../client/src/game/ContestantDisplay';
import { Countdown } from '../../client/src/game/Countdown';
import { displayApi, gameApi, GameApiError } from '../../client/src/game/api';
import type { DisplayObservation } from '../../shared/src/game/display';
import type { DisplaySnapshot } from '../../shared/src/game/contracts';
import { isPartialDate } from '../../server/src/library/validation';

const sessionId = randomUUID(); const roundId = randomUUID(); const contestantId = randomUUID();
const credential = { token: 'a'.repeat(64), serverEpoch: randomUUID(), displayId: randomUUID() };
const base = { protocolVersion: 1 as const, sessionId, stateVersion: 2, activeContestantId: contestantId, contestants: [{ id: contestantId, name: 'Contestant One' }], scores: [], turnsExposed: 0 };
const round = { ...base, roundId, contestantId, requestedTier: 'deathmatch' as const, turnOrdinal: 1 };
const date: unknown = '2024-08'; if (!isPartialDate(date)) throw new Error('Invalid test date');
const answer = { participantDescription: 'Alpha vs Beta', promotion: 'Fixture Wrestling', event: 'Winter Event', matchDate: date, stipulation: null, championshipInfo: null };
let phase: DisplaySnapshot; let sequence: number; let decode: () => Promise<void>;
let createUrl: ReturnType<typeof vi.fn>; let revokeUrl: ReturnType<typeof vi.fn>;
function observation(): DisplayObservation {
  return { protocolVersion: 1, serverEpoch: credential.serverEpoch, sequence: ++sequence, connectionSequence: 1,
    snapshot: phase, sample: { nonce: randomUUID(), serverMonoMs: performance.now() },
    asset: ['ready', 'guessing', 'paused'].includes(phase.phase) ? { roundId, imageKey: roundId } : null };
}
beforeEach(() => {
  sessionStorage.clear(); history.replaceState(null, '', `/display/${sessionId}#${new URLSearchParams({ token: credential.token, epoch: credential.serverEpoch, display: credential.displayId })}`);
  phase = { ...round, phase: 'ready', imageKey: roundId }; sequence = 0; decode = async () => {};
  createUrl = vi.fn(() => 'blob:opaque-clue'); revokeUrl = vi.fn();
  vi.stubGlobal('URL', class extends URL { static createObjectURL = createUrl; static revokeObjectURL = revokeUrl; });
  vi.stubGlobal('Image', class { src = ''; decode() { return decode(); } });
  vi.spyOn(displayApi, 'status').mockImplementation(async () => observation());
  vi.spyOn(displayApi, 'image').mockResolvedValue(new Blob(['image'], { type: 'image/png' }));
  vi.spyOn(gameApi, 'claim'); vi.spyOn(gameApi, 'command');
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); history.replaceState(null, '', '/'); });

describe('isolated contestant stage and image lifecycle', () => {
  it('decodes a prepared clue while keeping it out of the DOM and strips join secrets from the URL', async () => {
    const view = render(<ContestantDisplay sessionId={sessionId} />); await screen.findByRole('heading', { name: 'Ready · waiting for reveal' });
    await waitFor(() => expect(createUrl).toHaveBeenCalledOnce());
    expect(screen.queryByAltText('Current wrestling match clue')).not.toBeInTheDocument();
    expect(location.hash).toBe(''); expect(document.body.innerHTML).not.toContain(credential.token);
    expect(screen.queryByRole('button', { name: 'Correct' })).not.toBeInTheDocument(); expect(gameApi.claim).not.toHaveBeenCalled(); expect(gameApi.command).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toContain('Image Library');
    view.unmount(); expect(revokeUrl).toHaveBeenCalledWith('blob:opaque-clue');
  });
  it('reports not-ready until asynchronous decode finishes, then shows the clue only while guessing', async () => {
    let finish!: () => void; decode = () => new Promise((resolve) => { finish = resolve; });
    render(<ContestantDisplay sessionId={sessionId} />); await waitFor(() => expect(finish).toBeTypeOf('function'));
    await waitFor(() => expect(vi.mocked(displayApi.status).mock.calls.some(([, , report]) => report.type === 'status' && !report.decoded)).toBe(true));
    await act(async () => { finish(); });
    phase = { ...round, stateVersion: 3, phase: 'guessing', imageKey: roundId, remainingMs: 6000 };
    expect(await screen.findByAltText('Current wrestling match clue')).toHaveAttribute('src', 'blob:opaque-clue');
    expect(screen.getByRole('timer')).toHaveAttribute('aria-live', 'off');
    phase = { ...round, stateVersion: 4, phase: 'paused', remainingMs: 4500 };
    await screen.findByRole('heading', { name: 'Paused' }); expect(screen.queryByAltText('Current wrestling match clue')).not.toBeInTheDocument();
    expect(screen.getByRole('timer')).toHaveTextContent('05');
  });
  it('covers and reports missing/decode-failed images without submitting a judgment', async () => {
    decode = async () => { throw new Error('decode failed'); };
    render(<ContestantDisplay sessionId={sessionId} />); await screen.findByText(/Image unavailable or could not decode/);
    expect(screen.queryByAltText('Current wrestling match clue')).not.toBeInTheDocument();
    await waitFor(() => expect(vi.mocked(displayApi.status).mock.calls.some(([, , report]) => report.type === 'status' && !report.decoded)).toBe(true));
    expect(gameApi.command).not.toHaveBeenCalled();
  });
  it('renders expiry then conceals judgment until the host reveals the result and answer', async () => {
    phase = { ...round, phase: 'awaiting_judgment', remainingMs: 0 };
    render(<ContestantDisplay sessionId={sessionId} />); await screen.findByRole('heading', { name: 'Time up' }); expect(screen.getByRole('timer')).toHaveTextContent('00');
    expect(displayApi.image).not.toHaveBeenCalled();
    phase = { ...round, stateVersion: 3, phase: 'adjudicated' };
    await screen.findByRole('heading', { name: 'Waiting for the host' }); expect(screen.queryByRole('timer')).not.toBeInTheDocument();
    expect(screen.queryByText('CORRECT!')).not.toBeInTheDocument(); expect(document.body.innerHTML).not.toContain('Alpha');
    phase = { ...round, stateVersion: 4, phase: 'answer_revealed', outcome: 'correct', award: 3, answer };
    await screen.findByRole('heading', { name: 'CORRECT!' }); expect(screen.getByText('3 POINTS EARNED')).toBeInTheDocument(); expect(screen.getByText('Alpha vs Beta')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Revealed result and match' })).toHaveAttribute('data-animate', 'true');
    await waitFor(() => expect(screen.getByRole('region', { name: 'Revealed result and match' })).toHaveAttribute('data-animate', 'false'));
    expect(gameApi.command).not.toHaveBeenCalled();
  });
  it('restores an already revealed result statically after refresh and reconnect', async () => {
    phase = { ...round, phase: 'answer_revealed', outcome: 'incorrect', award: 0, answer };
    const view = render(<ContestantDisplay sessionId={sessionId} />); await screen.findByRole('heading', { name: 'INCORRECT!' });
    expect(screen.getByRole('region', { name: 'Revealed result and match' })).toHaveAttribute('data-animate', 'false');
    view.unmount(); render(<ContestantDisplay sessionId={sessionId} />); await screen.findByRole('heading', { name: 'INCORRECT!' });
    expect(screen.getByText('0 POINTS EARNED')).toBeInTheDocument(); expect(screen.getByText('2024-08')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Revealed result and match' })).toHaveAttribute('data-animate', 'false');
    vi.mocked(displayApi.status).mockRejectedValueOnce(new TypeError('connection lost'));
    await screen.findByRole('heading', { name: 'Display unavailable' }); expect(screen.queryByText('Alpha vs Beta')).not.toBeInTheDocument();
    await screen.findByRole('heading', { name: 'INCORRECT!' }); expect(screen.getByRole('region', { name: 'Revealed result and match' })).toHaveAttribute('data-animate', 'false');
    expect(gameApi.command).not.toHaveBeenCalled();
  });
  it('animates a connected reveal even when polling skips the brief adjudicated snapshot', async () => {
    phase = { ...round, phase: 'guessing', imageKey: roundId, remainingMs: 5000 };
    render(<ContestantDisplay sessionId={sessionId} />); await screen.findByAltText('Current wrestling match clue');
    phase = { ...round, stateVersion: 4, phase: 'answer_revealed', outcome: 'correct', award: 3, answer };
    await screen.findByRole('heading', { name: 'CORRECT!' }); expect(screen.getByRole('region', { name: 'Revealed result and match' })).toHaveAttribute('data-animate', 'true');
    expect(gameApi.command).not.toHaveBeenCalled();
  });
  it('restores the current remaining window rather than ten seconds on reload', async () => {
    phase = { ...round, phase: 'guessing', remainingMs: 2300, imageKey: roundId };
    const view = render(<ContestantDisplay sessionId={sessionId} />); await screen.findByAltText('Current wrestling match clue'); expect(screen.getByRole('timer')).toHaveTextContent('03');
    view.unmount(); render(<ContestantDisplay sessionId={sessionId} />); await screen.findByAltText('Current wrestling match clue'); expect(screen.getByRole('timer')).toHaveTextContent('03');
    expect(vi.mocked(displayApi.status).mock.calls.filter(([, , report]) => report.type === 'connect')).toHaveLength(2);
  });
  it('covers immediately on request failure and requires a fresh link after an epoch change', async () => {
    phase = { ...round, phase: 'guessing', remainingMs: 5000, imageKey: roundId };
    render(<ContestantDisplay sessionId={sessionId} />); await screen.findByAltText('Current wrestling match clue');
    vi.mocked(displayApi.status).mockRejectedValueOnce(new GameApiError({ code: 'SERVER_EPOCH_CHANGED', message: 'Server restarted. Ask the host for a fresh display link.' }, 409));
    await screen.findByText(/Server restarted/); expect(screen.queryByAltText('Current wrestling match clue')).not.toBeInTheDocument();
    expect(revokeUrl).toHaveBeenCalled();
  });
  it('ignores responses from a disposed root and revokes its decoded image', async () => {
    let finish!: (o: DisplayObservation) => void;
    vi.mocked(displayApi.status).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const view = render(<ContestantDisplay sessionId={sessionId} />); await waitFor(() => expect(finish).toBeTypeOf('function')); view.unmount();
    await act(async () => { finish(observation()); }); expect(displayApi.image).not.toHaveBeenCalled();
  });
  it('accepts a fresh join fragment in the same tab after server restart', async () => {
    render(<ContestantDisplay sessionId={sessionId} />); await screen.findByRole('heading', { name: 'Ready · waiting for reveal' });
    const next = { ...credential, token: 'b'.repeat(64), serverEpoch: randomUUID(), displayId: randomUUID() };
    vi.mocked(displayApi.status).mockImplementation(async () => ({ ...observation(), serverEpoch: next.serverEpoch }));
    await act(async () => {
      history.replaceState(null, '', `/display/${sessionId}#${new URLSearchParams({ token: next.token, epoch: next.serverEpoch, display: next.displayId })}`);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    await waitFor(() => expect(vi.mocked(displayApi.status).mock.calls.some(([owner, , report]) => owner.token === next.token && report.type === 'connect')).toBe(true));
    expect(location.hash).toBe(''); expect(document.body.innerHTML).not.toContain(next.token);
  });
  it('shows join-link and missing-session errors without administrative controls', async () => {
    history.replaceState(null, '', '/'); render(<ContestantDisplay sessionId={sessionId} />); expect(screen.getByRole('heading', { name: 'Display link required' })).toBeInTheDocument(); expect(displayApi.status).not.toHaveBeenCalled();
  });
  it('reports a missing session and offers a read-only reconnect action', async () => {
    vi.mocked(displayApi.status).mockRejectedValue(new GameApiError({ code: 'NOT_FOUND', message: 'Session not found.' }, 404));
    render(<ContestantDisplay sessionId={sessionId} />); await screen.findByText('Session not found.');
    fireEvent.click(screen.getByRole('button', { name: 'Retry display connection' })); await waitFor(() => expect(displayApi.status).toHaveBeenCalledTimes(2)); expect(gameApi.command).not.toHaveBeenCalled();
  });
});
describe('countdown presentation', () => {
  it('interpolates monotonically, clamps zero, freezes pause, and never announces every tick', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'performance'] }); const at = performance.now();
    const view = render(<Countdown remainingMs={1500} running observedAt={at} />); expect(screen.getByRole('timer')).toHaveTextContent('02');
    await act(async () => { vi.advanceTimersByTime(1000); }); expect(screen.getByRole('timer')).toHaveTextContent('01');
    await act(async () => { vi.advanceTimersByTime(1000); }); expect(screen.getByRole('timer')).toHaveTextContent('00');
    view.rerender(<Countdown remainingMs={2500} running={false} observedAt={performance.now()} />);
    await act(async () => { vi.advanceTimersByTime(10000); }); expect(screen.getByRole('timer')).toHaveTextContent('03'); expect(screen.getByRole('timer')).toHaveAttribute('aria-live', 'off');
  });
});

describe('contestant scoreboard visibility and recovery', () => {
  it('shows between-turn totals, keeps current judgment concealed, then publishes revealed totals', async () => {
    const zero = [{ contestantId, name: 'Contestant One', total: 0 }];
    phase = { ...base, phase: 'between_rounds', scores: zero };
    render(<ContestantDisplay sessionId={sessionId} />); await screen.findByRole('region', { name: 'Scoreboard' }); expect(screen.getByText('Exposed turns: 0')).toBeInTheDocument();
    phase = { ...round, stateVersion: 3, phase: 'adjudicated', scores: zero, turnsExposed: 1 };
    await screen.findByRole('heading', { name: 'Waiting for the host' }); expect(screen.queryByRole('region', { name: 'Scoreboard' })).not.toBeInTheDocument(); expect(document.body.textContent).not.toContain('Correct');
    phase = { ...round, stateVersion: 4, phase: 'answer_revealed', outcome: 'correct', award: 3, answer, turnsExposed: 1,
      scores: [{ contestantId, name: 'Contestant One', total: 3, lastOutcome: { outcome: 'correct', award: 3, turnOrdinal: 1 } }] };
    const board = await screen.findByRole('region', { name: 'Scoreboard' }); expect(within(board).getByRole('listitem')).toHaveTextContent('3 points'); expect(within(board).getByText('Turn 1: Correct · 3 points')).toBeInTheDocument();
    expect(gameApi.command).not.toHaveBeenCalled();
  });
  it('restores final ties without showing an active player, missing winner or reset controls', async () => {
    const b = randomUUID(); phase = { ...base, phase: 'completed', turnsExposed: 8, contestants: [{ id: contestantId, name: 'Alex' }, { id: b, name: 'Jordan' }],
      scores: [{ contestantId, name: 'Alex', total: 5 }, { contestantId: b, name: 'Jordan', total: 5 }], winnerIds: [contestantId, b] };
    const view = render(<ContestantDisplay sessionId={sessionId} />); await screen.findByRole('region', { name: 'Final totals' }); expect(screen.getByRole('status')).toHaveTextContent('Tie: Alex & Jordan');
    expect(screen.getAllByText('Tied 1')).toHaveLength(2); expect(screen.queryByText('Active contestant')).not.toBeInTheDocument(); expect(screen.queryByRole('button')).not.toBeInTheDocument();
    view.unmount(); render(<ContestantDisplay sessionId={sessionId} />); await screen.findByRole('region', { name: 'Final totals' });
    expect(screen.getByText('Exposed turns: 8')).toBeInTheDocument(); expect(displayApi.image).not.toHaveBeenCalled(); expect(gameApi.command).not.toHaveBeenCalled();
  });
});
