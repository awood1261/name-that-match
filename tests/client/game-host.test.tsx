import { StrictMode } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HostPage } from '../../client/src/game/HostPage';
import { gameApi, GameApiError } from '../../client/src/game/api';
import { createState, currentRound, phase, transition } from '../../shared/src/game/engine';
import { hostSnapshot } from '../../shared/src/game/projections';
import type { CommandEnvelope, GameState, HostIntent } from '../../shared/src/game/contracts';
import type { HostStatus } from '../../shared/src/game/host';
import { context, NOW, setup, pureGame } from '../game/fixtures';
import { randomUUID } from 'node:crypto';

let state: GameState | null; let sequence: number;
const credential = { token: 'a'.repeat(64), serverEpoch: randomUUID(), generation: 1 };
function status(): HostStatus {
  const p = state ? phase(state) : null; const round = state && currentRound(state);
  return { protocolVersion: 1, serverEpoch: credential.serverEpoch, sequence: ++sequence, snapshot: state ? hostSnapshot(state) : null,
    availability: { tiers: { squash: { screenshots: 2, matches: 1 }, competitive: { screenshots: 0, matches: 0 }, deathmatch: { screenshots: 0, matches: 0 } }, distinctMatches: 1, asOf: NOW },
    allowedActions: p === 'setup' ? ['CONFIGURE_SETUP', 'START', 'DISCARD_SETUP'] : p === 'between_rounds' ? ['SELECT_CONTESTANT', 'PREPARE', 'END_GAME'] : p === 'ready' || p === 'preparing' ? ['CANCEL_UNEXPOSED'] : p === 'answer_revealed' ? ['ADVANCE', 'END_GAME'] : p === 'adjudicated' ? ['REVEAL_ANSWER', 'END_GAME', ...(round?.phase === 'adjudicated' && round.outcome === 'void' ? ['ADVANCE' as const] : [])] : [],
    candidateValid: true, primaryDisplay: { ready: false, message: 'A connected contestant display is required.' }, preparationError: null };
}
const env = () => ({ nowMonoMs: 0, nowIso: NOW, clock: null, primaryReady: false, candidateCurrent: true, hasEligibleMatches: true, awardId: randomUUID() });
function apply(command: CommandEnvelope) {
  const intent = { ...command.payload, type: command.type } as HostIntent;
  state = transition(state!, intent, env());
  const response = { receipt: { commandId: command.commandId, sessionId: state.id, roundId: state.currentRoundId, acceptedVersion: state.stateVersion }, replayed: false, status: status() };
  if (command.type === 'PREPARE') {
    const candidate = context(); candidate.image.sha256 = randomUUID().replace(/-/g, '') + '0'.repeat(32);
    state = transition(state, { type: 'PREPARE_SUCCEEDED', context: candidate }, env());
  }
  return response;
}
beforeEach(() => {
  sessionStorage.clear(); state = null; sequence = 0;
  vi.spyOn(gameApi, 'claim').mockResolvedValue(credential); vi.spyOn(gameApi, 'renew').mockResolvedValue({ serverEpoch: credential.serverEpoch });
  vi.spyOn(gameApi, 'current').mockImplementation(async () => status()); vi.spyOn(gameApi, 'release').mockResolvedValue({});
  vi.spyOn(gameApi, 'create').mockImplementation(async (_owner, input) => {
    state = createState(input, NOW); return { receipt: { commandId: input.commandId, sessionId: input.sessionId, roundId: null, acceptedVersion: 1 }, replayed: false, status: status() };
  });
  vi.spyOn(gameApi, 'command').mockImplementation(async (_owner, input) => apply(input));
});
afterEach(() => { vi.restoreAllMocks(); sessionStorage.clear(); });
async function openSetup() { render(<HostPage />); await screen.findByRole('button', { name: 'Create session' }); }
async function createSession(two = false) {
  await openSetup(); if (two) fireEvent.change(screen.getByLabelText('Number of contestants'), { target: { value: '2' } });
  fireEvent.change(screen.getByLabelText('Contestant 1 name'), { target: { value: 'Alex' } });
  if (two) fireEvent.change(screen.getByLabelText('Contestant 2 name'), { target: { value: 'Jordan' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create session' })); await screen.findByRole('button', { name: 'Start game' });
}

describe('host setup and preparation UI', () => {
  it('shows initial connection loading with no premature create/mutation', async () => {
    let finish!: (value: typeof credential) => void; vi.mocked(gameApi.claim).mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    render(<HostPage />); expect(screen.getByText('Connecting to game server…')).toBeInTheDocument(); expect(gameApi.create).not.toHaveBeenCalled();
    await waitFor(() => expect(gameApi.claim).toHaveBeenCalledTimes(1)); finish(credential); await screen.findByRole('button', { name: 'Create session' });
  });
  it('does not orphan a controller lease during React StrictMode effect replay', async () => {
    render(<StrictMode><HostPage /></StrictMode>); await screen.findByRole('button', { name: 'Create session' });
    expect(gameApi.claim).toHaveBeenCalledTimes(1); expect(gameApi.create).not.toHaveBeenCalled();
  });
  it.each([false, true])('creates a %s head-to-head configuration without automatic start', async (two) => {
    await createSession(two); expect(gameApi.create).toHaveBeenCalledTimes(1); expect(state!.contestants).toHaveLength(two ? 2 : 1);
    expect(state!.status).toBe('setup'); expect(gameApi.command).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Start game' })); await waitFor(() => expect(state!.status).toBe('active'));
  });
  it('validates whitespace, oversized and duplicate names before sending a request', async () => {
    await openSetup(); fireEvent.change(screen.getByLabelText('Number of contestants'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Contestant 1 name'), { target: { value: 'Same' } }); fireEvent.change(screen.getByLabelText('Contestant 2 name'), { target: { value: ' same ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create session' })); expect(screen.getAllByText('Use a distinct name for each contestant.')).toHaveLength(2); expect(gameApi.create).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Contestant 1 name'), { target: { value: ' '.repeat(5) } });
    fireEvent.click(screen.getByRole('button', { name: 'Create session' })); expect(screen.getByText('Enter a name of 1–60 characters.')).toBeInTheDocument();
  });
  it('blocks Start while setup edits remain unsaved and saves explicitly', async () => {
    await createSession(); fireEvent.change(screen.getByLabelText('Contestant 1 name'), { target: { value: 'Updated' } });
    expect(screen.getByRole('button', { name: 'Start game' })).toBeDisabled(); fireEvent.click(screen.getByRole('button', { name: 'Save setup' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start game' })).toBeEnabled()); expect(state!.contestants[0].name).toBe('Updated');
  });
  it('uses server-backed switching, disables it during preparation, keeps Reveal gated and releases without starting time', async () => {
    await createSession(true); fireEvent.click(screen.getByRole('button', { name: 'Start game' })); await screen.findByText('Between rounds');
    const selector = screen.getByLabelText('Switch contestant'); selector.focus(); expect(selector).toHaveFocus();
    fireEvent.change(selector, { target: { value: state!.contestants[1].id } }); await screen.findByText('Active contestant: Jordan');
    fireEvent.click(screen.getByRole('button', { name: 'Prepare screenshot' })); await screen.findByText('Preparing screenshot');
    expect(screen.getByLabelText('Switch contestant')).toBeDisabled();
    await screen.findByText('Screenshot ready · hidden', {}, { timeout: 2000 }); expect(screen.getByRole('button', { name: 'Reveal & start' })).toBeDisabled();
    expect(currentRound(state!)?.contestantId).toBe(state!.contestants[1].id); expect(currentRound(state!)?.phase).toBe('ready'); expect(state!.awards).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel preparation' })); await screen.findByText('Between rounds'); expect(screen.getByText('Active contestant: Jordan')).toBeInTheDocument();
  });
  it('shows distinct-match counts and empty tiers without changing library classification', async () => {
    await createSession(); fireEvent.click(screen.getByRole('button', { name: 'Start game' })); await screen.findByText('Between rounds');
    fireEvent.click(screen.getByRole('radio', { name: /Competitive Match/ }));
    expect(screen.getByText(/No eligible unseen screenshots in this tier/)).toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Prepare screenshot' })).toBeDisabled();
    expect(screen.getByText('2 eligible screenshots · 1 distinct match')).toBeInTheDocument();
  });
  it('prevents duplicate create commands while a request is in flight', async () => {
    let finish!: (value: Awaited<ReturnType<typeof gameApi.create>>) => void;
    vi.mocked(gameApi.create).mockReturnValue(new Promise((resolve) => { finish = resolve; })); await openSetup();
    fireEvent.change(screen.getByLabelText('Contestant 1 name'), { target: { value: 'Alex' } });
    const create = screen.getByRole('button', { name: 'Create session' }); fireEvent.click(create); fireEvent.click(create); expect(gameApi.create).toHaveBeenCalledTimes(1); expect(create).toBeDisabled();
    const input = vi.mocked(gameApi.create).mock.calls[0][1]; state = createState(input, NOW);
    finish({ receipt: { commandId: input.commandId, sessionId: input.sessionId, roundId: null, acceptedVersion: 1 }, replayed: false, status: status() }); await screen.findByRole('button', { name: 'Start game' });
  });
  it('shows host-busy errors and offers deliberate recovery without auto creating a game', async () => {
    vi.mocked(gameApi.claim).mockRejectedValue(new GameApiError({ code: 'HOST_BUSY', message: 'Another host has control.' }, 409));
    render(<HostPage />); expect(await screen.findByRole('alert')).toHaveTextContent('Another host has control.'); expect(gameApi.create).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Take host control / reconnect' })).toBeEnabled();
  });
  it('holds an uncertain creation and checks its receipt before permitting further commands', async () => {
    vi.mocked(gameApi.create).mockRejectedValue(new TypeError('network failed')); await openSetup();
    fireEvent.change(screen.getByLabelText('Contestant 1 name'), { target: { value: 'Alex' } }); fireEvent.click(screen.getByRole('button', { name: 'Create session' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('outcome is unknown'); expect(screen.getByRole('button', { name: 'Dismiss request after review' })).toBeDisabled();
    const input = vi.mocked(gameApi.create).mock.calls[0][1]; state = createState(input, NOW);
    vi.spyOn(gameApi, 'receipt').mockResolvedValue({ receipt: { commandId: input.commandId, sessionId: input.sessionId, roundId: null, acceptedVersion: 1 }, status: status() });
    fireEvent.click(screen.getByRole('button', { name: 'Check command status' })); await screen.findByRole('button', { name: 'Start game' });
    expect(screen.queryByRole('button', { name: 'Check command status' })).not.toBeInTheDocument(); expect(gameApi.create).toHaveBeenCalledTimes(1);
  });
  it('deliberately retries the exact original creation only after receipt and current-state review', async () => {
    vi.mocked(gameApi.create).mockRejectedValueOnce(new TypeError('response lost')); await openSetup();
    fireEvent.change(screen.getByLabelText('Contestant 1 name'), { target: { value: 'Alex' } }); fireEvent.click(screen.getByRole('button', { name: 'Create session' }));
    await screen.findByRole('alert'); const original = vi.mocked(gameApi.create).mock.calls[0][1];
    vi.spyOn(gameApi, 'receipt').mockRejectedValue(new GameApiError({ code: 'RECEIPT_NOT_FOUND', message: 'No receipt' }, 404));
    fireEvent.click(screen.getByRole('button', { name: 'Check command status' })); await screen.findByRole('button', { name: 'Retry original request' });
    fireEvent.click(screen.getByRole('button', { name: 'Retry original request' })); await screen.findByRole('button', { name: 'Start game' });
    expect(gameApi.create).toHaveBeenCalledTimes(2); expect(vi.mocked(gameApi.create).mock.calls[1][1]).toEqual(original);
  });
  it('ignores an older in-flight poll after a command returns a newer revision', async () => {
    const timers = vi.spyOn(globalThis, 'setTimeout');
    await createSession(); let finish!: (value: HostStatus) => void; let old!: HostStatus;
    vi.mocked(gameApi.current).mockImplementationOnce(() => { old = status(); return new Promise((resolve) => { finish = resolve; }); });
    // Trigger the registered poll directly: its 1s period equals waitFor's default
    // timeout, making a wall-clock wait race under concurrent suite load.
    const poll = timers.mock.calls.find(([, delay]) => delay === 200)?.[0];
    expect(poll).toBeTypeOf('function');
    await act(async () => { if (typeof poll === 'function') poll(); });
    expect(finish).toBeTypeOf('function');
    fireEvent.click(screen.getByRole('button', { name: 'Start game' })); await screen.findByText('Between rounds');
    await act(async () => { finish(old); }); expect(screen.getByText('Between rounds')).toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'Save setup' })).not.toBeInTheDocument();
  });
  it('reports revision conflict and reloads current state without blindly replaying the command', async () => {
    await createSession(); vi.mocked(gameApi.command).mockRejectedValueOnce(new GameApiError({ code: 'CONFLICT', message: 'Stale game revision' }, 409));
    fireEvent.click(screen.getByRole('button', { name: 'Start game' })); expect(await screen.findByRole('alert')).toHaveTextContent('Stale game revision');
    expect(gameApi.command).toHaveBeenCalledTimes(1); expect(state!.status).toBe('setup');
  });
  it('shows the immutable prepared tier after reopening instead of a local default tier', async () => {
    state = createState(setup(1), NOW); state = transition(state, { type: 'START' }, env());
    state = transition(state, { type: 'PREPARE', roundId: randomUUID(), tier: 'deathmatch' }, env());
    state = transition(state, { type: 'PREPARE_SUCCEEDED', context: { ...context(), obscurity: 'high', difficulty: 'hard' } }, env());
    render(<HostPage />); await screen.findByText('Screenshot ready · hidden');
    expect(screen.getByRole('radio', { name: /Deathmatch/ })).toBeChecked(); expect(screen.getByRole('radio', { name: /Squash Match/ })).not.toBeChecked();
  });
  it('restores existing sessions and ignores late responses after leaving the view', async () => {
    state = createState(setup(1), NOW); state.contestants[0].name = 'Restored'; sessionStorage.setItem('ntm.game.controller', JSON.stringify(credential));
    const view = render(<HostPage />); await screen.findByText('Active contestant: Restored'); expect(gameApi.create).not.toHaveBeenCalled(); expect(gameApi.claim).not.toHaveBeenCalled();
    view.unmount(); expect(vi.mocked(gameApi.current).mock.calls[0][1].aborted).toBe(true);
  });
  it('shows saved host totals immediately before the contestant result reveal', async () => {
    const game = pureGame(); game.ready(); game.step({ type: 'REVEAL_AND_START' }); game.step({ type: 'CORRECT' }); state = game.state;
    render(<HostPage />); const board = await screen.findByRole('region', { name: 'Scoreboard' });
    expect(within(board).getAllByRole('listitem')[0]).toHaveTextContent('1 point'); expect(within(board).getByText('Turn 1: Correct · 1 point')).toBeInTheDocument();
    expect(gameApi.command).not.toHaveBeenCalled();
  });
  it('keeps final totals visible through polling and reload using only the existing session read', async () => {
    const game = pureGame(); game.ready(); game.step({ type: 'REVEAL_AND_START' }); game.step({ type: 'CORRECT' }); game.step({ type: 'END_GAME' }); state = game.state;
    sessionStorage.setItem('ntm.game.observedSession', JSON.stringify(state.id));
    vi.mocked(gameApi.current).mockImplementation(async () => ({ ...status(), snapshot: null }));
    vi.spyOn(gameApi, 'session').mockImplementation(async () => status());
    const view = render(<HostPage />); await screen.findByRole('region', { name: 'Final totals' });
    expect(screen.getByText('Winner: Contestant 1')).toBeInTheDocument(); expect(screen.getByText('Game complete')).toBeInTheDocument();
    await waitFor(() => expect(gameApi.session).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('region', { name: 'Final totals' })).toHaveTextContent('1 point');
    view.unmount(); render(<HostPage />); await screen.findByRole('region', { name: 'Final totals' });
    expect(gameApi.create).not.toHaveBeenCalled(); expect(gameApi.command).not.toHaveBeenCalled(); expect(screen.getByRole('button', { name: 'New game' })).toBeEnabled();
  });
  it('discards a missing or invalid completed-session observation', async () => {
    const session = vi.spyOn(gameApi, 'session').mockRejectedValue(new GameApiError({ code: 'NOT_FOUND', message: 'Session not found.' }, 404));
    sessionStorage.setItem('ntm.game.observedSession', JSON.stringify(randomUUID()));
    const view = render(<HostPage />); await screen.findByRole('button', { name: 'Create session' }); expect(session).toHaveBeenCalledOnce();
    expect(sessionStorage.getItem('ntm.game.observedSession')).toBeNull(); view.unmount();
    sessionStorage.setItem('ntm.game.observedSession', JSON.stringify('invalid'));
    render(<HostPage />); await screen.findByRole('button', { name: 'Create session' }); expect(session).toHaveBeenCalledOnce(); expect(gameApi.create).not.toHaveBeenCalled();
  });
});

describe('explicit round progression', () => {
  function resolved(outcome: 'correct' | 'incorrect' | 'timeout' | 'void' = 'correct', revealed = true, deathmatch = false) {
    const game = pureGame(); const candidate = context();
    if (deathmatch) { candidate.obscurity = 'high'; candidate.difficulty = 'hard'; }
    game.step({ type: 'START' }); game.step({ type: 'PREPARE', roundId: randomUUID(), tier: deathmatch ? 'deathmatch' : 'squash' });
    game.step({ type: 'PREPARE_SUCCEEDED', context: candidate }); game.step({ type: 'REVEAL_AND_START' });
    if (outcome === 'timeout') { game.setTime(10000); game.step({ type: 'EXPIRE', timerGeneration: currentRound(game.state)!.timerGeneration }); game.step({ type: 'CONFIRM_TIMEOUT' }); }
    else game.step(outcome === 'void' ? { type: 'VOID_EXPOSED', reason: 'skip' } : { type: outcome === 'correct' ? 'CORRECT' : 'INCORRECT' });
    if (revealed) game.step({ type: 'REVEAL_ANSWER' }); state = game.state;
  }
  it('advances only explicitly, retains selection/scores, and switches only future preparations', async () => {
    resolved(); const [a, b] = state!.contestants.map((p) => p.id); const original = structuredClone(state!.rounds[0]);
    render(<HostPage />); const advance = await screen.findByRole('button', { name: 'Advance' });
    expect(screen.getByLabelText('Switch contestant')).toBeDisabled(); expect(gameApi.command).not.toHaveBeenCalled();
    advance.focus(); expect(advance).toHaveFocus(); fireEvent.click(advance); fireEvent.click(advance);
    await screen.findByText('Between rounds');
    expect(gameApi.command).toHaveBeenCalledTimes(1); expect(vi.mocked(gameApi.command).mock.calls[0][1]).toMatchObject({ type: 'ADVANCE', roundId: original.id });
    expect(state!.activeContestantId).toBe(a); expect(state!.awards).toHaveLength(1); expect(state!.rounds[0]).toEqual(original);
    expect(screen.getByLabelText('Switch contestant')).toBeEnabled(); expect(screen.queryByRole('button', { name: 'Advance' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Prepare screenshot' })); await screen.findByText('Screenshot ready · hidden', {}, { timeout: 2000 });
    expect(currentRound(state!)?.contestantId).toBe(a); expect(state!.nextTurnOrdinal).toBe(2);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel preparation' })); await screen.findByText('Between rounds');
    const control = screen.getByLabelText('Switch contestant'); control.focus(); expect(control).toHaveFocus();
    fireEvent.change(control, { target: { value: b } }); await waitFor(() => expect(state!.activeContestantId).toBe(b));
    fireEvent.click(screen.getByRole('button', { name: 'Prepare screenshot' })); await screen.findByText('Screenshot ready · hidden', {}, { timeout: 2000 });
    expect(currentRound(state!)?.contestantId).toBe(b); expect(screen.getByLabelText('Switch contestant')).toBeDisabled();
    expect(state!.rounds[0]).toEqual(original); expect(state!.nextTurnOrdinal).toBe(2); expect(state!.awards[0].contestantId).toBe(a);
  });
  it.each(['correct', 'incorrect', 'timeout', 'void'] as const)('requires Reveal Result before Advance except an explicit %s void', async (outcome) => {
    resolved(outcome, false); render(<HostPage />); await screen.findByRole('button', { name: 'Reveal Result' });
    if (outcome === 'void') expect(screen.getByRole('button', { name: 'Advance' })).toBeEnabled();
    else expect(screen.queryByRole('button', { name: 'Advance' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Switch contestant')).toBeDisabled(); expect(gameApi.command).not.toHaveBeenCalled();
  });
  it('retains the restored previous tier, explains exhaustion and requires an explicit different tier', async () => {
    resolved('correct', true, true); render(<HostPage />); await screen.findByRole('button', { name: 'Advance' });
    fireEvent.click(screen.getByRole('button', { name: 'Advance' })); await screen.findByText('Between rounds');
    expect(screen.getByRole('radio', { name: /Deathmatch/ })).toBeChecked(); expect(screen.getByRole('button', { name: 'Prepare screenshot' })).toBeDisabled();
    expect(screen.getByText(/No eligible unseen screenshots in this tier/)).toBeInTheDocument(); expect(gameApi.command).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('radio', { name: /Squash Match/ })); fireEvent.click(screen.getByRole('button', { name: 'Prepare screenshot' }));
    await screen.findByText('Screenshot ready · hidden', {}, { timeout: 2000 });
    expect(currentRound(state!)?.requestedTier).toBe('squash'); expect(vi.mocked(gameApi.command).mock.calls[1][1]).toMatchObject({ type: 'PREPARE', payload: { tier: 'squash' } });
  });
  it('blocks further progression on a lost Advance acknowledgment and reconciles its receipt', async () => {
    resolved(); let receipt: ReturnType<typeof apply>;
    vi.mocked(gameApi.command).mockImplementationOnce(async (_owner, input) => { receipt = apply(input); throw new TypeError('Response lost'); });
    vi.spyOn(gameApi, 'receipt').mockImplementation(async () => ({ ...receipt!, status: status() }));
    render(<HostPage />); fireEvent.click(await screen.findByRole('button', { name: 'Advance' }));
    await screen.findByText(/The request outcome is unknown/); expect(screen.getByLabelText('Switch contestant')).toBeDisabled(); expect(screen.getByRole('button', { name: 'Prepare screenshot' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Check command status' })); await screen.findByText('The previous command was accepted. Current state restored.');
    expect(screen.getByLabelText('Switch contestant')).toBeEnabled(); expect(gameApi.command).toHaveBeenCalledTimes(1); expect(state!.awards).toHaveLength(1);
  });
});

describe('manual completion and independent new games', () => {
  function finished(count = 2) {
    const game = pureGame(); if (count === 1) game.step({ type: 'CONFIGURE_SETUP', contestants: [game.state.contestants[0]], activeContestantId: game.state.contestants[0].id });
    game.step({ type: 'START' }); game.step({ type: 'END_GAME' }); state = game.state;
  }
  it('requires confirmation to end, then shows zero-score tied winners and hides live controls', async () => {
    const game = pureGame(); game.step({ type: 'START' }); state = game.state;
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false); render(<HostPage />);
    const end = await screen.findByRole('button', { name: 'End game' }); end.focus(); expect(end).toHaveFocus(); fireEvent.click(end);
    expect(gameApi.command).not.toHaveBeenCalled(); expect(state!.status).toBe('active'); confirm.mockReturnValue(true); fireEvent.click(end); fireEvent.click(end);
    await screen.findByRole('region', { name: 'Final totals' }); expect(gameApi.command).toHaveBeenCalledTimes(1);
    expect(state!.status).toBe('completed'); expect(screen.getByRole('region', { name: 'Final totals' })).toHaveTextContent('Tie: Contestant 1 & Contestant 2');
    for (const label of ['End game', 'Prepare screenshot', 'Advance', 'Reveal Result']) expect(screen.queryByRole('button', { name: label })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Switch contestant')).not.toBeInTheDocument(); expect(screen.getByRole('button', { name: 'New game' })).toBeEnabled();
  });
  it('prevents End game during an unresolved attempt and explains cancellation', async () => {
    const game = pureGame(); game.ready(); state = game.state;
    const confirm = vi.spyOn(window, 'confirm'); render(<HostPage />); const end = await screen.findByRole('button', { name: 'End game' });
    expect(end).toBeDisabled(); fireEvent.click(end); expect(confirm).not.toHaveBeenCalled(); expect(gameApi.command).not.toHaveBeenCalled(); expect(screen.getByText('Cancel preparation before ending the game.')).toBeInTheDocument();
  });
  it.each([false, true])('allows ending a saved judgment with result reveal=%s without scoring again', async (revealed) => {
    const game = pureGame(); game.ready(); game.step({ type: 'REVEAL_AND_START' }); game.step({ type: 'CORRECT' }); if (revealed) game.step({ type: 'REVEAL_ANSWER' }); state = game.state;
    const awards = structuredClone(state.awards); vi.spyOn(window, 'confirm').mockReturnValue(true); render(<HostPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'End game' })); await screen.findByRole('region', { name: 'Final totals' });
    expect(state!.awards).toEqual(awards); expect(screen.getByRole('region', { name: 'Final totals' })).toHaveTextContent('Winner: Contestant 1');
  });
  it.each([1, 2])('creates a fresh %i-contestant setup only after New game confirmation, with editable names and no automatic start', async (count) => {
    finished(count); const previous = structuredClone(state!); const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<HostPage />); const start = await screen.findByRole('button', { name: 'New game' }); start.focus(); expect(start).toHaveFocus(); fireEvent.click(start);
    expect(gameApi.create).not.toHaveBeenCalled(); expect(state!.id).toBe(previous.id); confirm.mockReturnValue(true); fireEvent.click(start); fireEvent.click(start);
    await screen.findByRole('button', { name: 'Start game' }); expect(gameApi.create).toHaveBeenCalledTimes(1); expect(gameApi.command).not.toHaveBeenCalled();
    expect(state!.id).not.toBe(previous.id); expect(state!.status).toBe('setup'); expect(state!.rounds).toEqual([]); expect(state!.awards).toEqual([]); expect(state!.nextTurnOrdinal).toBe(1);
    expect(state!.contestants.map((p) => p.name)).toEqual(previous.contestants.map((p) => p.name)); expect(state!.contestants.every((p) => !previous.contestants.some((q) => q.id === p.id))).toBe(true);
    expect(screen.getByLabelText('Contestant 1 name')).toHaveValue(previous.contestants[0].name); expect(previous.status).toBe('completed');
  });
  it('blocks duplicate lifecycle commands and resolves a lost End game acknowledgment by receipt', async () => {
    const game = pureGame(); game.step({ type: 'START' }); state = game.state; let receipt: ReturnType<typeof apply>;
    vi.spyOn(window, 'confirm').mockReturnValue(true); vi.mocked(gameApi.command).mockImplementationOnce(async (_owner, input) => { receipt = apply(input); throw new TypeError('Lost response'); });
    vi.spyOn(gameApi, 'receipt').mockImplementation(async () => ({ ...receipt!, status: status() })); render(<HostPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'End game' })); await screen.findByText(/The request outcome is unknown/);
    const next = await screen.findByRole('button', { name: 'New game' }); expect(next).toBeDisabled(); fireEvent.click(next); expect(gameApi.create).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Check command status' })); await screen.findByText('The previous command was accepted. Current state restored.');
    expect(next).toBeEnabled(); expect(gameApi.command).toHaveBeenCalledTimes(1);
  });
  it('reconciles an accepted New game creation after a lost response without creating a second setup', async () => {
    finished(); vi.spyOn(window, 'confirm').mockReturnValue(true); let input: Parameters<typeof gameApi.create>[1];
    vi.mocked(gameApi.create).mockImplementationOnce(async (_owner, value) => { input = value; state = createState(value, NOW); throw new TypeError('Lost response'); });
    vi.spyOn(gameApi, 'receipt').mockImplementation(async () => ({ receipt: { commandId: input!.commandId, sessionId: input!.sessionId, roundId: null, acceptedVersion: 1 }, status: status() }));
    render(<HostPage />); fireEvent.click(await screen.findByRole('button', { name: 'New game' })); await screen.findByText(/The request outcome is unknown/);
    fireEvent.click(screen.getByRole('button', { name: 'Check command status' })); await screen.findByText('The previous command was accepted. Current state restored.');
    expect(gameApi.create).toHaveBeenCalledOnce(); expect(state!.id).toBe(input!.sessionId); expect(state!.status).toBe('setup'); expect(gameApi.command).not.toHaveBeenCalled();
  });
  it('keeps completed totals on rejected creation and offers a deliberate retry after missing receipt review', async () => {
    finished(); const completed = state!; vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(gameApi.current).mockImplementation(async () => ({ ...status(), snapshot: null })); vi.spyOn(gameApi, 'session').mockImplementation(async () => status());
    sessionStorage.setItem('ntm.game.observedSession', JSON.stringify(completed.id));
    vi.mocked(gameApi.create).mockRejectedValueOnce(new TypeError('Delivery unknown'));
    vi.spyOn(gameApi, 'receipt').mockRejectedValue(new GameApiError({ code: 'NOT_FOUND', message: 'No receipt.' }, 404));
    render(<HostPage />); fireEvent.click(await screen.findByRole('button', { name: 'New game' })); await screen.findByText(/The request outcome is unknown/);
    fireEvent.click(screen.getByRole('button', { name: 'Check command status' })); await screen.findByText(/No accepted receipt was found/);
    expect(screen.getByRole('region', { name: 'Final totals' })).toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Retry original request' })).toBeEnabled(); expect(state).toBe(completed);
  });
  it('keeps the observed completed session when a New game request is explicitly rejected', async () => {
    finished(); const completed = state!; vi.spyOn(window, 'confirm').mockReturnValue(true);
    sessionStorage.setItem('ntm.game.observedSession', JSON.stringify(completed.id));
    vi.mocked(gameApi.current).mockImplementation(async () => ({ ...status(), snapshot: null })); vi.spyOn(gameApi, 'session').mockImplementation(async () => status());
    vi.mocked(gameApi.create).mockRejectedValue(new GameApiError({ code: 'CONFLICT', message: 'New setup could not be created.' }, 409));
    render(<HostPage />); fireEvent.click(await screen.findByRole('button', { name: 'New game' })); await screen.findByText('New setup could not be created.');
    expect(screen.getByRole('region', { name: 'Final totals' })).toBeInTheDocument(); expect(screen.getByRole('button', { name: 'New game' })).toBeEnabled(); expect(state).toBe(completed);
  });
});
