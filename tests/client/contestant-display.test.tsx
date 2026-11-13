import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { ContestantDisplay } from '../../client/src/game/ContestantDisplay';
import { Countdown } from '../../client/src/game/Countdown';
import { displayApi, gameApi, GameApiError } from '../../client/src/game/api';
import type { DisplayObservation } from '../../shared/src/game/display';
import type { DisplaySnapshot } from '../../shared/src/game/contracts';
import { isPartialDate } from '../../server/src/library/validation';
import { mockGameLive } from './mock-game-live';
import { openGameLive, type LiveCallbacks } from '../../client/src/game/live';

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
    asset: ['ready', 'guessing', 'paused', 'awaiting_judgment', 'adjudicated', 'answer_revealed'].includes(phase.phase) ? { roundId, imageKey: roundId } : null };
}
beforeEach(() => {
  mockGameLive();
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
  it('keeps untimed choice/selection visible during clock synchronization without bypassing clue or recovery gates', async () => {
    let callbacks!: LiveCallbacks; let finishDecode!: () => void;
    const ready = vi.fn(); const close = vi.fn();
    decode = () => new Promise(resolve => { finishDecode = resolve; });
    vi.mocked(openGameLive).mockImplementation((_join, value) => { callbacks = value; return { ready, close }; });
    phase = { ...base, phase: 'between_rounds' };
    const view = render(<ContestantDisplay sessionId={sessionId} />);
    const send = async (synchronized: boolean) => {
      const next = observation();
      await act(async () => callbacks.snapshot({ type: 'snapshot', role: 'display', protocolVersion: 1, serverEpoch: credential.serverEpoch,
        connectionSequence: 1, sequence: next.sequence, sessionId, stateVersion: phase.stateVersion, serverMonoMs: performance.now(),
        state: { snapshot: phase, asset: next.asset } }, { synchronized, serverNow: synchronized ? performance.now() : null }));
    };
    await send(true); expect(screen.getByRole('heading', { name: 'CHOOSE YOUR MATCH' })).toBeInTheDocument();
    await send(false); expect(screen.getByRole('heading', { name: 'CHOOSE YOUR MATCH' })).toBeInTheDocument();
    phase = { ...round, stateVersion: 3, phase: 'preparing' }; await send(false);
    expect(screen.getByRole('heading', { name: 'SELECTING MATCH...' })).toBeInTheDocument();
    expect(document.querySelector('[data-intro]')).toHaveAttribute('data-intro', 'true');
    phase = { ...round, stateVersion: 4, phase: 'ready', imageKey: roundId }; await send(false);
    await waitFor(() => expect(finishDecode).toBeTypeOf('function'));
    expect(screen.getByRole('heading', { name: 'SELECTING MATCH...' })).toBeInTheDocument();
    expect(ready).toHaveBeenCalledWith({ roundId, imageKey: roundId, decoded: false });
    await send(true); await send(false); await send(true);
    expect(document.querySelector('[data-intro]')).toHaveAttribute('data-intro', 'true');
    expect(screen.queryByText(/Connecting display|Ready · waiting for reveal|synchronization/i)).not.toBeInTheDocument();
    expect(screen.queryByAltText('Current wrestling match clue')).not.toBeInTheDocument();
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
    await act(async () => { finishDecode(); });
    expect(screen.getByRole('heading', { name: 'SELECTING MATCH...' })).toBeInTheDocument();
    phase = { ...round, stateVersion: 5, phase: 'guessing', imageKey: roundId, remainingMs: 5000 }; await send(false);
    expect(screen.queryByAltText('Current wrestling match clue')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Connecting display' })).toBeInTheDocument();
    await send(true); expect(screen.getByAltText('Current wrestling match clue')).toBeInTheDocument();
    await act(async () => { callbacks.unavailable(new Error('Connection lost'), false); callbacks.reset?.(); });
    expect(screen.queryByRole('heading', { name: 'SELECTING MATCH...' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Display unavailable' })).toBeInTheDocument();
    expect(gameApi.command).not.toHaveBeenCalled(); view.unmount(); expect(close).toHaveBeenCalledOnce();
  });
  it.each(['between_rounds', 'preparing', 'ready'] as const)('keeps %s through brief recovery but bounds repeated failures and shows terminal errors', async stage => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    let callbacks!: LiveCallbacks; const close = vi.fn();
    vi.mocked(openGameLive).mockImplementation((_join, value) => { callbacks = value; return { ready: vi.fn(), close }; });
    phase = stage === 'between_rounds' ? { ...base, phase: stage } : stage === 'preparing' ? { ...round, phase: stage } : { ...round, phase: stage, imageKey: roundId };
    const view = render(<ContestantDisplay sessionId={sessionId} />);
    const send = async () => {
      const next = observation();
      await act(async () => callbacks.snapshot({ type: 'snapshot', role: 'display', protocolVersion: 1, serverEpoch: credential.serverEpoch,
        connectionSequence: 1, sequence: next.sequence, sessionId, stateVersion: phase.stateVersion, serverMonoMs: performance.now(),
        state: { snapshot: phase, asset: next.asset } }, { synchronized: true, serverNow: performance.now() }));
    };
    const title = stage === 'between_rounds' ? 'CHOOSE YOUR MATCH' : 'SELECTING MATCH...';
    await send();
    await act(async () => { callbacks.unavailable(new Error('Connection lost'), false); callbacks.reset?.(); });
    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Display unavailable' })).not.toBeInTheDocument();
    expect(screen.queryByAltText('Current wrestling match clue')).not.toBeInTheDocument(); expect(screen.queryByRole('timer')).not.toBeInTheDocument();
    await act(async () => { vi.advanceTimersByTime(1000); callbacks.unavailable(new Error('Another failed reconnect'), false); });
    await act(async () => { vi.advanceTimersByTime(1999); }); expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    await act(async () => { vi.advanceTimersByTime(1); }); expect(screen.getByRole('heading', { name: 'Display unavailable' })).toBeInTheDocument();
    await send(); expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    await act(async () => { callbacks.unavailable(new Error('A new brief interruption'), false); callbacks.reset?.(); });
    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    await act(async () => { vi.advanceTimersByTime(1000); }); await send();
    await act(async () => { callbacks.unavailable(new Error('Fresh display link required'), true); callbacks.reset?.(); });
    expect(screen.getByRole('heading', { name: 'Display unavailable' })).toBeInTheDocument();
    expect(screen.getByText('Fresh display link required')).toBeInTheDocument();
    expect(gameApi.command).not.toHaveBeenCalled(); view.unmount(); expect(close).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0);
  });
  it('keeps choice until preparation, preserves the intro through Ready and reveals without waiting for cosmetic completion', async () => {
    phase = { ...base, phase: 'between_rounds' };
    render(<ContestantDisplay sessionId={sessionId} />);
    await screen.findByRole('heading', { name: 'CHOOSE YOUR MATCH' });
    expect(screen.queryByRole('region', { name: 'Scoreboard' })).not.toBeInTheDocument();
    // Host tier input is not a public mutation; another waiting snapshot does not advance the viewer.
    phase = { ...base, phase: 'between_rounds', stateVersion: 3 };
    await waitFor(() => expect(displayApi.status).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('heading', { name: 'CHOOSE YOUR MATCH' })).toBeInTheDocument();
    phase = { ...round, stateVersion: 4, phase: 'preparing' };
    await screen.findByRole('heading', { name: 'SELECTING MATCH...' });
    await waitFor(() => expect(document.querySelector('[data-intro]')).toHaveAttribute('data-intro', 'true'));
    phase = { ...round, stateVersion: 5, phase: 'ready', imageKey: roundId };
    await waitFor(() => expect(createUrl).toHaveBeenCalled());
    expect(document.querySelector('[data-intro]')).toHaveAttribute('data-intro', 'true');
    expect(screen.queryByAltText('Current wrestling match clue')).not.toBeInTheDocument();
    phase = { ...round, stateVersion: 6, phase: 'guessing', imageKey: roundId, remainingMs: 2300 };
    await screen.findByAltText('Current wrestling match clue'); expect(screen.getByRole('timer')).toHaveTextContent('00:03');
    expect(screen.queryByRole('heading', { name: 'SELECTING MATCH...' })).not.toBeInTheDocument();
    expect(document.querySelector('[data-visual-scene]')).toBeInTheDocument();
    expect(gameApi.command).not.toHaveBeenCalled();
  });
  it('restores selection settled after refresh or loss, and returns to choice on cancellation/failure', async () => {
    render(<ContestantDisplay sessionId={sessionId} />); await screen.findByRole('heading', { name: 'SELECTING MATCH...' });
    expect(document.querySelector('[data-intro]')).toHaveAttribute('data-intro', 'false');
    const observed = vi.mocked(displayApi.status).mock.calls.length;
    vi.mocked(displayApi.status).mockRejectedValueOnce(new TypeError('connection lost'));
    await waitFor(() => expect(vi.mocked(displayApi.status).mock.calls.length).toBeGreaterThan(observed));
    expect(screen.queryByRole('heading', { name: 'Display unavailable' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'SELECTING MATCH...' })).toBeInTheDocument();
    await waitFor(() => expect(createUrl).toHaveBeenCalledTimes(2));
    expect(document.querySelector('[data-intro]')).toHaveAttribute('data-intro', 'false');
    phase = { ...base, stateVersion: 4, phase: 'between_rounds' };
    await screen.findByRole('heading', { name: 'CHOOSE YOUR MATCH' });
    expect(screen.queryByAltText('Current wrestling match clue')).not.toBeInTheDocument();
    expect(gameApi.command).not.toHaveBeenCalled();
  });
  it('decodes a prepared clue while keeping it out of the DOM and strips join secrets from the URL', async () => {
    const view = render(<ContestantDisplay sessionId={sessionId} />); await screen.findByRole('heading', { name: 'SELECTING MATCH...' });
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
    render(<ContestantDisplay sessionId={sessionId} />); await screen.findByAltText('Current wrestling match clue'); expect(screen.getByRole('timer')).toHaveTextContent('00:00');
    expect(displayApi.image).toHaveBeenCalledOnce();
    phase = { ...round, stateVersion: 3, phase: 'adjudicated', remainingMs: 0 };
    await waitFor(() => expect(screen.getByRole('timer')).toHaveTextContent('00:00')); expect(screen.getByAltText('Current wrestling match clue')).toBeInTheDocument();
    expect(screen.queryByText('CORRECT!')).not.toBeInTheDocument(); expect(document.body.innerHTML).not.toContain('Alpha');
    phase = { ...round, stateVersion: 4, phase: 'answer_revealed', outcome: 'correct', award: 3, answer };
    await screen.findByRole('heading', { name: 'CORRECT!' }); expect(screen.getByText('+3 POINTS EARNED')).toBeInTheDocument(); expect(screen.getByText('Alpha vs Beta')).toBeInTheDocument();
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
  it('animates a connected reveal even when observations skip the brief adjudicated snapshot', async () => {
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
    render(<ContestantDisplay sessionId={sessionId} />); await screen.findByRole('heading', { name: 'SELECTING MATCH...' });
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
  it('shows choice between turns, keeps current judgment concealed, then publishes revealed totals', async () => {
    const zero = [{ contestantId, name: 'Contestant One', total: 0 }];
    phase = { ...base, phase: 'between_rounds', scores: zero };
    render(<ContestantDisplay sessionId={sessionId} />); await screen.findByRole('heading', { name: 'CHOOSE YOUR MATCH' }); expect(screen.queryByRole('region', { name: 'Scoreboard' })).not.toBeInTheDocument();
    phase = { ...round, stateVersion: 3, phase: 'adjudicated', remainingMs: 0, scores: zero, turnsExposed: 1 };
    await screen.findByRole('heading', { name: 'Waiting for the host' }); expect(screen.queryByRole('region', { name: 'Scoreboard' })).not.toBeInTheDocument(); expect(document.body.textContent).not.toContain('Correct');
    phase = { ...round, stateVersion: 4, phase: 'answer_revealed', outcome: 'correct', award: 3, answer, turnsExposed: 1,
      scores: [{ contestantId, name: 'Contestant One', total: 3, lastOutcome: { outcome: 'correct', award: 3, turnOrdinal: 1 } }] };
    const board = await screen.findByRole('region', { name: 'Scoreboard' }); expect(within(board).getByRole('listitem')).toHaveTextContent('3 points'); expect(within(board).getByText('Turn 1: Correct · 3 points')).toBeInTheDocument();
    expect(gameApi.command).not.toHaveBeenCalled();
  });
  it('restores final ties without showing an active player, missing winner or reset controls', async () => {
    const b = randomUUID(); phase = { ...base, phase: 'completed', turnsExposed: 8, contestants: [{ id: contestantId, name: 'Alex' }, { id: b, name: 'Jordan' }],
      scores: [{ contestantId, name: 'Alex', total: 5 }, { contestantId: b, name: 'Jordan', total: 5 }], winnerIds: [contestantId, b] };
    const view = render(<ContestantDisplay sessionId={sessionId} />); await screen.findByRole('region', { name: 'Final totals' }); expect(screen.getByText('Tie: Alex & Jordan')).toHaveAttribute('role', 'status');
    expect(screen.getAllByText('Tied 1')).toHaveLength(2); expect(screen.queryByText('Active contestant')).not.toBeInTheDocument(); expect(screen.queryByRole('button', { name: /Correct|Advance|End game|Start game/ })).not.toBeInTheDocument();
    view.unmount(); render(<ContestantDisplay sessionId={sessionId} />); await screen.findByRole('region', { name: 'Final totals' });
    expect(screen.getByText('Exposed turns: 8')).toBeInTheDocument(); expect(displayApi.image).not.toHaveBeenCalled(); expect(gameApi.command).not.toHaveBeenCalled();
  });
});
