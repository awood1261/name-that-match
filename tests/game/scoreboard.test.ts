import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { classify } from '../../shared/src/classification';
import { currentRound } from '../../shared/src/game/engine';
import { displaySnapshot, hostSnapshot, scoreboard, winnerIds } from '../../shared/src/game/projections';
import { context, pureGame, serviceFixture } from './fixtures';
import type { Obscurity, VisualDifficulty } from '../../shared/src/library';

function attempt(game: ReturnType<typeof pureGame>, obscurity: Obscurity = 'low', difficulty: VisualDifficulty = 'easy') {
  if (game.state.status === 'setup') game.step({ type: 'START' });
  const candidate = { ...context(), obscurity, difficulty }; candidate.image.sha256 = randomUUID().replace(/-/g, '') + 'a'.repeat(32);
  game.step({ type: 'PREPARE', roundId: randomUUID(), tier: classify(obscurity, difficulty).tier! });
  game.step({ type: 'PREPARE_SUCCEEDED', context: candidate }); game.step({ type: 'REVEAL_AND_START' });
}
function revealAndAdvance(game: ReturnType<typeof pureGame>) { game.step({ type: 'REVEAL_ANSWER' }); game.step({ type: 'ADVANCE' }); }

describe('authoritative scoreboard observations', () => {
  it('starts at stable zero ties with no invented turn or result', () => {
    const game = pureGame(); const rows = scoreboard(game.state);
    expect(rows.map((row) => row.contestantId)).toEqual(game.state.contestants.map((p) => p.id)); expect(rows.every((row) => row.total === 0 && !row.lastOutcome)).toBe(true);
    expect(displaySnapshot(game.state, null, 0).turnsExposed).toBe(0); expect(hostSnapshot(game.state).winnerIds).toBeUndefined();
  });
  it.each([['low', 'easy', 1], ['low', 'hard', 2], ['high', 'hard', 3]] as const)('awards %s/%s %i points to the immutable owner and reveals them only on host presentation', (obscurity, difficulty, points) => {
    const game = pureGame(); game.step({ type: 'START' }); const b = game.state.contestants[1].id; game.step({ type: 'SELECT_CONTESTANT', contestantId: b });
    attempt(game, obscurity, difficulty); game.step({ type: 'CORRECT' });
    expect(scoreboard(game.state)[0]).toMatchObject({ contestantId: b, total: points, lastOutcome: { outcome: 'correct', award: points, turnOrdinal: 1 } });
    const covered = displaySnapshot(game.state, null, 0); expect(covered.scores.every((row) => row.total === 0 && !row.lastOutcome)).toBe(true);
    game.step({ type: 'REVEAL_ANSWER' }); expect(displaySnapshot(game.state, null, 0).scores[0]).toMatchObject({ contestantId: b, total: points, lastOutcome: { award: points, turnOrdinal: 1 } });
  });
  it.each(['incorrect', 'timeout', 'skip', 'void'] as const)('retains a %s zero outcome with its real exposed turn', (outcome) => {
    const game = pureGame(); attempt(game);
    if (outcome === 'timeout') { game.setTime(game.clock!.deadlineMonoMs); game.step({ type: 'EXPIRE', timerGeneration: currentRound(game.state)!.timerGeneration }); game.step({ type: 'CONFIRM_TIMEOUT' }); }
    else if (outcome === 'incorrect') game.step({ type: 'INCORRECT' });
    else game.step({ type: 'VOID_EXPOSED', reason: outcome });
    expect(game.state.awards).toHaveLength(0); expect(scoreboard(game.state)[0].lastOutcome).toMatchObject({ outcome: outcome === 'skip' ? 'void' : outcome, award: 0, turnOrdinal: 1 });
    expect(displaySnapshot(game.state, null, 0).scores.every((r) => !r.lastOutcome)).toBe(true);
    game.step({ type: 'REVEAL_ANSWER' }); expect(displaySnapshot(game.state, null, 0).scores[0].lastOutcome?.award).toBe(0);
  });
  it('preserves stable nonzero ties, prior public results and all tied final leaders', () => {
    const game = pureGame(); const [a, b] = game.state.contestants.map((p) => p.id);
    game.step({ type: 'START' }); game.step({ type: 'SELECT_CONTESTANT', contestantId: b }); attempt(game, 'low', 'hard'); game.step({ type: 'CORRECT' }); revealAndAdvance(game);
    expect(scoreboard(game.state)[0].contestantId).toBe(b);
    game.step({ type: 'SELECT_CONTESTANT', contestantId: a }); attempt(game, 'low', 'hard'); game.step({ type: 'CORRECT' });
    expect(displaySnapshot(game.state, null, 0).scores[0].contestantId).toBe(b); expect(scoreboard(game.state).map((r) => r.contestantId)).toEqual([a, b]);
    game.step({ type: 'REVEAL_ANSWER' }); game.step({ type: 'END_GAME' });
    expect(hostSnapshot(game.state).winnerIds).toEqual([a, b]); const publicView = displaySnapshot(game.state, null, 0);
    expect(publicView).toMatchObject({ phase: 'completed', turnsExposed: 2, winnerIds: [a, b], scores: [{ total: 2 }, { total: 2 }] });
  });
  it('finds each contestant’s latest result beyond bounded host history, with no three-turn quota', () => {
    const game = pureGame(); const [a, b] = game.state.contestants.map((p) => p.id);
    game.step({ type: 'START' }); game.step({ type: 'SELECT_CONTESTANT', contestantId: b }); attempt(game); game.step({ type: 'CORRECT' }); revealAndAdvance(game);
    game.step({ type: 'SELECT_CONTESTANT', contestantId: a });
    for (let n = 0; n < 5; n++) { attempt(game); game.step({ type: 'INCORRECT' }); revealAndAdvance(game); }
    const host = hostSnapshot(game.state); expect(host.historyTruncated).toBe(true); expect(host.recentRounds.every((r) => r.contestantId === a)).toBe(true);
    expect(host.scores.find((r) => r.contestantId === b)?.lastOutcome).toEqual({ outcome: 'correct', award: 1, turnOrdinal: 1 });
    expect(host.scores.find((r) => r.contestantId === a)?.lastOutcome?.turnOrdinal).toBe(6); expect(displaySnapshot(game.state, null, 0).turnsExposed).toBe(6); expect(game.state.activeContestantId).toBe(a);
  });
  it('does not count cancelled unseen attempts or publish skipped unrevealed outcomes after Advance', () => {
    const game = pureGame(); game.ready(); game.step({ type: 'CANCEL_UNEXPOSED' }); expect(displaySnapshot(game.state, null, 0).turnsExposed).toBe(0);
    attempt(game); game.step({ type: 'VOID_EXPOSED', reason: 'skip' }); game.step({ type: 'ADVANCE' });
    expect(game.state.rounds).toHaveLength(2); expect(displaySnapshot(game.state, null, 0)).toMatchObject({ phase: 'between_rounds', turnsExposed: 1 });
    expect(displaySnapshot(game.state, null, 0).scores.every((r) => !r.lastOutcome)).toBe(true); expect(scoreboard(game.state)[0].lastOutcome?.turnOrdinal).toBe(1);
  });
  it('restores final totals, latest outcomes and winner IDs from SQLite after reopen', async () => {
    const f = serviceFixture();
    try {
      f.ready(); f.command({ type: 'REVEAL_AND_START' }); f.command({ type: 'CORRECT' }); f.command({ type: 'REVEAL_ANSWER' }); f.command({ type: 'END_GAME' });
      const before = hostSnapshot(f.state); const publicBefore = displaySnapshot(f.state, null, 0);
      f.reopen(); expect(hostSnapshot(f.state)).toEqual(before); expect(displaySnapshot(f.state, null, 0)).toEqual(publicBefore);
      expect(winnerIds(f.state)).toHaveLength(1); expect(f.state.awards).toHaveLength(1);
    } finally { await f.cleanup(); }
  });
});
