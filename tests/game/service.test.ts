import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { currentRound, phase } from '../../shared/src/game/engine';
import { scoreboard, winnerIds } from '../../shared/src/game/projections';
import { GameService } from '../../server/src/game/service';
import { GameRepository } from '../../server/src/game/repository';
import { envelope, serviceFixture, setup } from './fixtures';

const fixtures: ReturnType<typeof serviceFixture>[] = [];
function fixture(options: Parameters<typeof serviceFixture>[0] = {}) { const f = serviceFixture(options); fixtures.push(f); return f; }
afterEach(async () => { vi.restoreAllMocks(); for (const f of fixtures.splice(0)) await f.cleanup(); });

describe('transactional game service', () => {
  it('reopens independent completed/new games with separate scores and reusable match history, preserving library rows', () => {
    const f = fixture(); f.ready(); const candidate = currentRound(f.state)!;
    if (!('context' in candidate) || !candidate.context) throw new Error('No candidate');
    f.command({ type: 'REVEAL_AND_START' }); f.command({ type: 'CORRECT' }); f.command({ type: 'END_GAME' }); const old = f.state;
    const library = f.storage.db.prepare('SELECT id,revision,match_id,image_path FROM screenshots').all();
    const created = f.service.create(setup(1)); let next = f.service.execute(envelope(created.state, { type: 'START' })).state;
    f.reopen(); expect(f.state).toEqual(old); expect(f.service.repository.current()?.id).toBe(next.id);
    next = f.service.state(next.id); expect(next.rounds).toEqual([]); expect(next.awards).toEqual([]);
    next = f.service.execute(envelope(next, { type: 'PREPARE', roundId: randomUUID(), tier: 'squash' })).state;
    expect(f.service.completePreparation(next.id, next.currentRoundId!, next.stateVersion, candidate.context)).toBe(true);
    for (const type of ['REVEAL_AND_START', 'CORRECT', 'END_GAME'] as const) next = f.service.execute(envelope(f.service.state(next.id), { type })).state;
    f.reopen(); expect(f.state).toEqual(old); expect(f.service.state(next.id)).toEqual(next); expect(scoreboard(next)[0].total).toBe(1);
    expect(f.service.repository.current()).toBeNull(); expect(f.storage.db.prepare('SELECT id,revision,match_id,image_path FROM screenshots').all()).toEqual(library);
    expect(f.storage.db.prepare('SELECT count(*) n FROM game_sessions').get()).toEqual({ n: 2 }); expect(f.storage.db.prepare('SELECT count(*) n FROM game_score_events').get()).toEqual({ n: 2 });
  });
  it('creates/setup-edits idempotently and blocks a second unfinished game or authority', () => {
    const f = fixture(); const other = setup();
    expect(() => f.service.create(other)).toThrow(/nonterminal/);
    expect(() => new GameService(new GameRepository(f.storage.db))).toThrow(/already owns/);
    const input = setup(1); const update = envelope(f.state, { type: 'CONFIGURE_SETUP', contestants: input.contestants, activeContestantId: input.activeContestantId });
    const first = f.service.execute(update); expect(first.state.contestants).toHaveLength(1);
    expect(f.service.execute(update)).toMatchObject({ replayed: true, receipt: first.receipt });
    expect(() => f.service.execute({ ...update, payload: { ...update.payload, activeContestantId: randomUUID() } })).toThrow();
  });
  it('can discard setup then create a fresh solo session, retry creation and preserve old history', () => {
    const f = fixture(); const old = f.command({ type: 'DISCARD_SETUP' }); const input = setup(1);
    const created = f.service.create(input); expect(f.service.create(input)).toMatchObject({ replayed: true, receipt: created.receipt });
    expect(created.state.id).not.toBe(old.id); expect(created.state.awards).toEqual([]);
    expect(f.service.repository.load(old.id).status).toBe('discarded');
  });
  it('fails closed without eligible-content and primary-readiness observations', () => {
    const f = fixture({ hasEligibleMatches: () => false }); expect(() => f.command({ type: 'START' })).toThrow(/eligible/);
    const g = fixture({ primaryReady: () => false }); g.ready(); expect(() => g.command({ type: 'REVEAL_AND_START' })).toThrow(/not ready/);
    expect(phase(g.state)).toBe('ready'); expect(g.state.nextTurnOrdinal).toBe(1);
  });
  it('validates revisions/round IDs and ignores stale preparation completion', () => {
    const f = fixture(); f.command({ type: 'START' }); const stale = envelope(f.state, { type: 'SELECT_CONTESTANT', contestantId: f.state.contestants[1].id });
    f.command({ type: 'PREPARE', roundId: randomUUID(), tier: 'squash' });
    expect(() => f.service.execute(stale)).toThrow(/Stale/);
    const pending = f.state; const context = f.candidate(); f.command({ type: 'CANCEL_UNEXPOSED' });
    expect(f.service.completePreparation(pending.id, pending.currentRoundId!, pending.stateVersion, context)).toBe(false);
    expect(f.state.rounds[0]).toMatchObject({ phase: 'cancelled', cancelReason: 'host' });
    f.ready(context);
    expect(() => f.service.execute({ ...envelope(f.state, { type: 'REVEAL_AND_START' }), roundId: randomUUID() })).toThrow(/Wrong round/);
  });
  it('rejects changing the active contestant during an attempt and freezes score ownership after switching', () => {
    const f = fixture(); const owner = f.state.activeContestantId; const next = f.state.contestants[1].id;
    f.ready(); expect(() => f.command({ type: 'SELECT_CONTESTANT', contestantId: next })).toThrow();
    f.command({ type: 'REVEAL_AND_START' }); const correct = envelope(f.state, { type: 'CORRECT' }); const awarded = f.service.execute(correct);
    expect(awarded.state.awards[0]).toMatchObject({ contestantId: owner, points: 1 });
    f.command({ type: 'REVEAL_ANSWER' }); f.command({ type: 'ADVANCE' }); expect(f.state.activeContestantId).toBe(owner);
    f.command({ type: 'SELECT_CONTESTANT', contestantId: next });
    const replay = f.service.execute(correct); expect(replay.replayed).toBe(true); expect(replay.state.activeContestantId).toBe(next);
    expect(scoreboard(replay.state).map((row) => [row.contestantId, row.total])).toEqual([[owner, 1], [next, 0]]);
    expect(f.storage.db.prepare('SELECT count(*) AS n FROM game_score_events').get()).toEqual({ n: 1 });
    expect(() => f.service.execute({ ...correct, payload: {}, type: 'INCORRECT' })).toThrow(/different content/);
  });
  it('settles expiry before commands despite a delayed timeout callback and supports distinct late judgment', () => {
    const f = fixture(); f.ready(); f.command({ type: 'REVEAL_AND_START' }); const ordinary = envelope(f.state, { type: 'CORRECT' });
    f.setTime(10_000); expect(() => f.service.execute(ordinary)).toThrow(/Stale/);
    expect(phase(f.state)).toBe('awaiting_judgment'); expect(f.state.awards).toEqual([]);
    f.command({ type: 'CORRECT_BEFORE_BUZZER' }); expect(currentRound(f.state)).toMatchObject({ outcome: 'correct', lateEntry: true, award: 1 });
    expect(f.scheduled.every((job) => job.cancelled)).toBe(true);
  });
  it('starts time only after trusted pre-exposure observations and does no image work on judgment', () => {
    let observe = () => {}; const observation = vi.fn(() => { observe(); return true; });
    const f = fixture({ candidateCurrent: observation }); f.ready(); observe = () => f.setTime(6000);
    f.command({ type: 'REVEAL_AND_START' }); expect(f.service.snapshot(f.state.id, 'display')).toMatchObject({ remainingMs: 10_000 });
    const calls = observation.mock.calls.length; f.setTime(15_999); f.command({ type: 'CORRECT' });
    expect(observation).toHaveBeenCalledTimes(calls); expect(f.state.awards).toHaveLength(1);
  });
  it('latches a timer read failure and leaves recovery-required state without an unhandled callback', () => {
    const f = fixture(); f.ready(); f.command({ type: 'REVEAL_AND_START' });
    vi.spyOn(f.service.repository, 'current').mockImplementationOnce(() => { throw new Error('read failure'); });
    f.setTime(10_000); expect(() => f.scheduled[0].callback()).not.toThrow(); expect(f.scheduled[0].cancelled).toBe(true);
    expect(() => f.service.state(randomUUID())).toThrow(/recovery/);
  });
  it('reschedules an early callback and expires at the actual monotonic deadline', () => {
    const f = fixture(); f.ready(); f.command({ type: 'REVEAL_AND_START' });
    f.setTime(9999); f.scheduled[0].callback(); expect(f.scheduled).toHaveLength(2);
    expect(phase(f.state)).toBe('guessing'); f.setTime(10_000); f.scheduled[1].callback(); expect(phase(f.state)).toBe('awaiting_judgment');
  });
  it('allows only one of two different judgment identities from the same revision', () => {
    const f = fixture(); f.ready(); f.command({ type: 'REVEAL_AND_START' });
    const correct = envelope(f.state, { type: 'CORRECT' }); const incorrect = envelope(f.state, { type: 'INCORRECT' });
    f.service.execute(correct); expect(() => f.service.execute(incorrect)).toThrow(/Stale/); expect(f.state.awards).toHaveLength(1);
  });
  it('retains failed preparation as cancelled without consuming exposure or changing contestants', () => {
    const f = fixture(); f.command({ type: 'START' }); f.command({ type: 'PREPARE', roundId: randomUUID(), tier: 'squash' });
    const state = f.state; f.service.failPreparation(state.id, state.currentRoundId!, state.stateVersion);
    expect(f.state.rounds[0]).toMatchObject({ phase: 'cancelled', cancelReason: 'preparation-failed' }); expect(f.state.nextTurnOrdinal).toBe(1); expect(f.state.activeContestantId).toBe(state.activeContestantId);
  });
  it('accepts correct at 9999ms, regardless of wall-clock jumps', () => {
    const f = fixture(); f.ready(); f.command({ type: 'REVEAL_AND_START' }); f.setTime(9999); f.setWall('1990-01-01T00:00:00.000Z');
    f.command({ type: 'CORRECT' }); expect(f.state.awards).toHaveLength(1);
  });
  it('ends incorrect immediately and never scores an already resolved round', () => {
    const f = fixture(); f.ready(); f.command({ type: 'REVEAL_AND_START' }); f.setTime(200); f.command({ type: 'INCORRECT' });
    expect(currentRound(f.state)).toMatchObject({ outcome: 'incorrect', award: 0 }); expect(() => f.command({ type: 'CORRECT' })).toThrow();
    f.command({ type: 'END_GAME' }); expect(winnerIds(f.state)).toHaveLength(2); expect(f.state.awards).toEqual([]);
  });
  it('preserves remaining time through repeated pause/resume and ignores replaced timer callbacks', () => {
    const f = fixture(); f.ready(); f.command({ type: 'REVEAL_AND_START' }); const firstJob = f.scheduled[0];
    f.setTime(6000); f.command({ type: 'PAUSE' }); expect(currentRound(f.state)).toMatchObject({ remainingMs: 4000 });
    f.setTime(100_000); f.command({ type: 'RESUME' }); firstJob.callback(); expect(phase(f.state)).toBe('guessing');
    f.setTime(101_000); f.command({ type: 'PAUSE' }); expect(currentRound(f.state)).toMatchObject({ remainingMs: 3000 });
    f.setTime(200_000); f.command({ type: 'RESUME' }); f.setTime(202_999); expect(f.service.snapshot(f.state.id, 'display')).toMatchObject({ phase: 'guessing', remainingMs: 1 });
    f.setTime(203_000); f.scheduled.at(-1)!.callback(); expect(phase(f.state)).toBe('awaiting_judgment');
  });
  it('pauses at detected loss with consumed detection time and gives expiry priority', () => {
    const f = fixture(); f.ready(); f.command({ type: 'REVEAL_AND_START' }); f.setTime(3000);
    const state = f.state; expect(f.service.connectionLost(state.id, state.currentRoundId!, state.stateVersion, 'primary-display')).toBe(true);
    expect(currentRound(f.state)).toMatchObject({ remainingMs: 7000, pauseReason: 'primary-display' });
    f.command({ type: 'RESUME' }); const running = f.state; f.setTime(10_001);
    expect(f.service.connectionLost(running.id, running.currentRoundId!, running.stateVersion, 'host-connection')).toBe(false);
    expect(phase(f.state)).toBe('awaiting_judgment'); expect(f.state.awards).toEqual([]);
  });
  it.each(['skip', 'void'] as const)('retains one zero-point %s receipt and exposed exclusion across reopen', (reason) => {
    const f = fixture(); f.ready(); f.command({ type: 'REVEAL_AND_START' }); const command = envelope(f.state, { type: 'VOID_EXPOSED', reason });
    f.service.execute(command); f.service.execute(command); f.command({ type: 'ADVANCE' });
    const before = f.state; f.reopen(); expect(f.state).toEqual(before);
    expect(f.service.execute(command).replayed).toBe(true); expect(f.state.rounds[0]).toMatchObject({ outcome: 'void', voidReason: reason });
    expect(f.state.awards).toEqual([]);
  });
  it('rejects candidate changes before reveal but later editorial edits cannot rescore pinned context', () => {
    let valid = true; const f = fixture({ candidateCurrent: () => valid }); f.ready(); valid = false;
    expect(() => f.command({ type: 'REVEAL_AND_START' })).toThrow(/changed/);
    valid = true; f.command({ type: 'REVEAL_AND_START' }); valid = false;
    f.command({ type: 'CORRECT' }); expect(f.state.awards[0].points).toBe(1);
  });
});

describe('durable recovery and cleanup', () => {
  it('restores active selection, old round ownership, committed judgment and receipt after crash', () => {
    const f = fixture(); f.ready(); f.command({ type: 'REVEAL_AND_START' }); const judgment = envelope(f.state, { type: 'CORRECT' }); f.service.execute(judgment);
    f.command({ type: 'REVEAL_ANSWER' }); f.command({ type: 'ADVANCE' }); f.command({ type: 'SELECT_CONTESTANT', contestantId: f.state.contestants[1].id });
    const before = f.state; f.reopen(true); expect(f.state).toEqual(before); expect(f.service.execute(judgment).replayed).toBe(true);
  });
  it('recovers running time as covered interrupted/void-only with match still exposed', () => {
    const f = fixture(); f.ready(); f.command({ type: 'REVEAL_AND_START' }); f.setTime(1000); const id = f.state.currentRoundId;
    f.reopen(true); expect(currentRound(f.state)).toMatchObject({ id, phase: 'interrupted', turnOrdinal: 1 });
    expect(f.service.snapshot(f.state.id, 'display')).toMatchObject({ phase: 'interrupted' });
    expect(() => f.command({ type: 'RESUME' })).toThrow(); expect(() => f.command({ type: 'CORRECT_BEFORE_BUZZER' })).toThrow();
    f.command({ type: 'VOID_INTERRUPTED' }); expect(currentRound(f.state)).toMatchObject({ voidReason: 'interrupted', award: 0 });
  });
  it('restores a known paused remainder requiring fresh explicit resume', () => {
    const f = fixture(); f.ready(); f.command({ type: 'REVEAL_AND_START' }); f.setTime(6000); f.command({ type: 'PAUSE' });
    f.reopen(true); expect(currentRound(f.state)).toMatchObject({ phase: 'paused', remainingMs: 4000 });
    f.setTime(100_000); f.command({ type: 'RESUME' }); f.setTime(104_000); expect(phase(f.state)).toBe('awaiting_judgment');
  });
  it('recovers pending preparation as cancelled, ready as covered and expired judgment as zero-time', () => {
    const f = fixture(); f.command({ type: 'START' }); f.command({ type: 'PREPARE', roundId: randomUUID(), tier: 'squash' });
    f.reopen(true); expect(phase(f.state)).toBe('between_rounds'); expect(f.state.rounds[0]).toMatchObject({ phase: 'cancelled', cancelReason: 'recovery' });
    f.ready(); f.reopen(true); expect(phase(f.state)).toBe('ready'); expect(f.service.snapshot(f.state.id, 'display')).not.toHaveProperty('answer');
    f.command({ type: 'REVEAL_AND_START' }); f.setTime(10_000); expect(phase(f.state)).toBe('awaiting_judgment');
    f.reopen(true); expect(phase(f.state)).toBe('awaiting_judgment'); f.command({ type: 'CONFIRM_TIMEOUT' }); expect(f.state.awards).toEqual([]);
  });
  it('unavailable clue can interrupt paused recovery without erasing an already committed score', () => {
    const f = fixture(); f.ready(); f.command({ type: 'REVEAL_AND_START' }); f.command({ type: 'PAUSE' }); const paused = f.state;
    f.service.interruptImage(paused.id, paused.currentRoundId!, paused.stateVersion); expect(phase(f.state)).toBe('interrupted'); f.command({ type: 'VOID_INTERRUPTED' });
    f.command({ type: 'ADVANCE' }); f.ready(f.candidate('b'.repeat(64))); f.command({ type: 'REVEAL_AND_START' }); f.command({ type: 'CORRECT' });
    const scored = f.state; expect(() => f.service.interruptImage(scored.id, scored.currentRoundId!, scored.stateVersion)).toThrow();
    f.reopen(true); expect(f.state.awards).toEqual(scored.awards);
  });
  it('rolls back an award when receipt persistence fails and blocks mutations until recovery', () => {
    const f = fixture(); f.ready(); f.command({ type: 'REVEAL_AND_START' }); const before = f.state;
    f.storage.db.exec("CREATE TRIGGER injected_receipt_failure BEFORE INSERT ON game_command_receipts BEGIN SELECT RAISE(ABORT,'injected failure'); END");
    expect(() => f.service.execute(envelope(before, { type: 'CORRECT' }))).toThrow(/storage failed/);
    expect(f.service.repository.load(before.id)).toEqual(before); expect(f.storage.db.prepare('SELECT count(*) AS n FROM game_score_events').get()).toEqual({ n: 0 });
    expect(() => f.command({ type: 'CORRECT' })).toThrow(/recovery/);
    f.storage.db.exec('DROP TRIGGER injected_receipt_failure'); f.reopen(true); expect(phase(f.state)).toBe('interrupted');
  });
  it('resolves a lost response after commit through the stored receipt without duplicate points', () => {
    const f = fixture(); f.ready(); f.command({ type: 'REVEAL_AND_START' }); const command = envelope(f.state, { type: 'CORRECT' });
    const commit = f.service.repository.commit.bind(f.service.repository);
    vi.spyOn(f.service.repository, 'commit').mockImplementationOnce((...args) => { commit(...args); throw new Error('lost after commit'); });
    expect(() => f.service.execute(command)).toThrow(/storage failed/); f.reopen(true);
    expect(f.service.execute(command).replayed).toBe(true); expect(f.state.awards).toHaveLength(1);
  });
  it('handles timer write failure without unhandled callback errors or publishing success', () => {
    const f = fixture(); f.ready(); f.command({ type: 'REVEAL_AND_START' });
    vi.spyOn(f.service.repository, 'commit').mockImplementationOnce(() => { throw new Error('disk failure'); });
    f.setTime(10_000); expect(() => f.scheduled[0].callback()).not.toThrow(); expect(() => f.service.state(f.state.id)).toThrow();
    expect(f.scheduled[0].cancelled).toBe(true);
  });
  it('checkpoints graceful shutdown, cancels owned resources, closes storage and cleans temporary files', async () => {
    const f = fixture(); f.ready(); f.command({ type: 'REVEAL_AND_START' }); f.setTime(3000); const id = f.state.id;
    f.service.close(); f.service.close(); expect(f.scheduled.every((job) => job.cancelled)).toBe(true);
    expect(f.service.repository.load(id).rounds.at(-1)).toMatchObject({ phase: 'paused', remainingMs: 7000 });
    await f.cleanup(); expect(f.storage.db.open).toBe(false); const fs = await import('node:fs'); expect(fs.existsSync(f.resources.root)).toBe(false);
  });
});
