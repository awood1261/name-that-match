import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HostRoundControls } from '../../client/src/game/HostRoundControls';
import { hostSnapshot } from '../../shared/src/game/projections';
import type { HostStatus } from '../../shared/src/game/host';
import type { HostIntent, Round } from '../../shared/src/game/contracts';
import { pureGame } from '../game/fixtures';

function status(phase: Round['phase']): HostStatus {
  const game = pureGame(); game.ready();
  if (phase !== 'ready') game.step({ type: 'REVEAL_AND_START' });
  if (phase === 'paused') game.step({ type: 'PAUSE' });
  if (phase === 'awaiting_judgment') { game.setTime(10000); game.step({ type: 'EXPIRE', timerGeneration: game.state.rounds[0].timerGeneration }); }
  if (phase === 'interrupted') game.step({ type: 'RECOVER_RUNNING' });
  if (phase === 'adjudicated' || phase === 'answer_revealed') game.step({ type: 'CORRECT' });
  if (phase === 'answer_revealed') game.step({ type: 'REVEAL_ANSWER' });
  return { protocolVersion: 1, serverEpoch: 'epoch', sequence: 1, snapshot: hostSnapshot(game.state), availability: { tiers: { squash: { screenshots: 0, matches: 0 }, competitive: { screenshots: 0, matches: 0 }, deathmatch: { screenshots: 0, matches: 0 } }, distinctMatches: 0, asOf: '' },
    allowedActions: [], candidateValid: true, primaryDisplay: { ready: true, message: 'Primary ready.' }, preparationError: null, timing: { serverMonoMs: 0, remainingMs: 5000 } };
}
describe('host live round intents', () => {
  it.each([
    ['ready', 'Reveal & start', 'REVEAL_AND_START'], ['guessing', 'Correct', 'CORRECT'], ['guessing', 'Incorrect', 'INCORRECT'], ['guessing', 'Pause', 'PAUSE'],
    ['paused', 'Resume', 'RESUME'], ['awaiting_judgment', 'Correct before buzzer — I confirm a timely answer', 'CORRECT_BEFORE_BUZZER'],
    ['awaiting_judgment', 'Confirm timeout · no credit', 'CONFIRM_TIMEOUT'], ['interrupted', 'Void interrupted round', 'VOID_INTERRUPTED'],
    ['adjudicated', 'Reveal Result', 'REVEAL_ANSWER'],
  ] as const)('offers only %s phase intent %s through the existing command lane', (phase, label, type) => {
    const command = vi.fn(); render(<HostRoundControls status={status(phase)} can={(action) => action === type} command={command} />);
    const button = screen.getByRole('button', { name: label }); button.focus(); expect(button).toHaveFocus(); fireEvent.click(button);
    expect(command).toHaveBeenCalledOnce(); expect(command).toHaveBeenCalledWith({ type });
    expect(screen.queryByRole('button', { name: 'Reveal answer' })).not.toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'Advance' })).not.toBeInTheDocument();
  });
  it('keeps controls disabled when the authoritative status refuses the action', () => {
    const command = vi.fn(); render(<HostRoundControls status={status('ready')} can={() => false} command={command} />);
    const reveal = screen.getByRole('button', { name: 'Reveal & start' }); expect(reveal).toBeDisabled(); fireEvent.click(reveal); expect(command).not.toHaveBeenCalled();
  });
  it('uses one explicit void intent with the chosen reason', () => {
    const command = vi.fn<(intent: HostIntent) => void>(); render(<HostRoundControls status={status('guessing')} can={() => true} command={command} />);
    fireEvent.change(screen.getByLabelText('Skip / Void reason'), { target: { value: 'void' } }); fireEvent.click(screen.getByRole('button', { name: 'Skip / Void · zero points' }));
    expect(command).toHaveBeenCalledOnce(); expect(command).toHaveBeenCalledWith({ type: 'VOID_EXPOSED', reason: 'void' });
  });
  it('requires permission for Reveal Result and removes the action once revealed', () => {
    const command = vi.fn(); const view = render(<HostRoundControls status={status('adjudicated')} can={() => false} command={command} />);
    expect(screen.getByRole('button', { name: 'Reveal Result' })).toBeDisabled(); fireEvent.click(screen.getByRole('button', { name: 'Reveal Result' })); expect(command).not.toHaveBeenCalled();
    view.rerender(<HostRoundControls status={status('answer_revealed')} can={() => true} command={command} />);
    expect(screen.queryByRole('button', { name: 'Reveal Result' })).not.toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'Advance' })).not.toBeInTheDocument();
  });
});
