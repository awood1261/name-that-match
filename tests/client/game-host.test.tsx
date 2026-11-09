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
  const p = state ? phase(state) : null;
  return { protocolVersion: 1, serverEpoch: credential.serverEpoch, sequence: ++sequence, snapshot: state ? hostSnapshot(state) : null,
    availability: { tiers: { squash: { screenshots: 2, matches: 1 }, competitive: { screenshots: 0, matches: 0 }, deathmatch: { screenshots: 0, matches: 0 } }, distinctMatches: 1, asOf: NOW },
    allowedActions: p === 'setup' ? ['CONFIGURE_SETUP', 'START', 'DISCARD_SETUP'] : p === 'between_rounds' ? ['SELECT_CONTESTANT', 'PREPARE'] : p === 'ready' || p === 'preparing' ? ['CANCEL_UNEXPOSED'] : [],
    candidateValid: true, primaryDisplay: { ready: false, message: 'A connected contestant display is required.' }, preparationError: null };
}
const env = () => ({ nowMonoMs: 0, nowIso: NOW, clock: null, primaryReady: false, candidateCurrent: true, hasEligibleMatches: true, awardId: randomUUID() });
function apply(command: CommandEnvelope) {
  const intent = { ...command.payload, type: command.type } as HostIntent;
  state = transition(state!, intent, env());
  const response = { receipt: { commandId: command.commandId, sessionId: state.id, roundId: state.currentRoundId, acceptedVersion: state.stateVersion }, replayed: false, status: status() };
  if (command.type === 'PREPARE') state = transition(state, { type: 'PREPARE_SUCCEEDED', context: context() }, env());
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
    expect(gameApi.create).not.toHaveBeenCalled(); expect(gameApi.command).not.toHaveBeenCalled(); expect(screen.queryByRole('button', { name: 'New game' })).not.toBeInTheDocument();
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
