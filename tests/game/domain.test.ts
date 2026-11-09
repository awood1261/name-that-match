import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { classify } from '../../shared/src/classification';
import { DIFFICULTIES, OBSCURITIES } from '../../shared/src/library';
import { currentRound, createState, phase, transition } from '../../shared/src/game/engine';
import { displaySnapshot, hostSnapshot, scoreboard, winnerIds } from '../../shared/src/game/projections';
import { chooseCandidate, unseenPool, type GameCandidate } from '../../shared/src/game/selection';
import { parseCommand, parseCreateGame, parseIntent, parseRoundContext } from '../../shared/src/game/validation';
import type { HostIntent, Round } from '../../shared/src/game/contracts';
import { context, envelope, NOW, pureGame, setup } from './fixtures';

describe('game runtime contracts', () => {
  it.each([1, 2])('accepts %i contestants', (n) => expect(parseCreateGame(setup(n)).contestants).toHaveLength(n));
  it.each([0, 3, 8])('rejects %i contestants', (n) => expect(() => parseCreateGame(setup(n))).toThrow());
  it.each([null, {}, 'solo', [{ id: randomUUID(), name: '' }]])('rejects malformed roster %j', (contestants) => {
    expect(() => parseCreateGame({ ...setup(), contestants })).toThrow();
  });
  it('rejects duplicate identities/names, invalid IDs and Unicode name overflow', () => {
    const input = setup();
    expect(() => parseCreateGame({ ...input, activeContestantId: randomUUID() })).toThrow();
    expect(() => parseCreateGame({ ...input, contestants: [input.contestants[0], input.contestants[0]] })).toThrow();
    expect(() => parseCreateGame({ ...input, contestants: [{ ...input.contestants[0], name: ' Alex ' }, { ...input.contestants[1], name: 'alex' }] })).toThrow();
    expect(() => parseCreateGame({ ...input, contestants: [{ ...input.contestants[0], name: '😀'.repeat(61) }] })).toThrow();
    expect(parseCreateGame({ ...input, contestants: [{ ...input.contestants[0], name: '😀'.repeat(60) }] }).contestants[0].name).toHaveLength(120);
    expect(() => parseCreateGame({ ...input, sessionId: 'bad' })).toThrow();
  });
  it.each([
    { protocolVersion: 2 }, { expectedStateVersion: 0 }, { expectedStateVersion: 1.5 }, { expectedStateVersion: Infinity },
    { expectedStateVersion: Number.MAX_SAFE_INTEGER + 1 }, { commandId: 'bad' }, { secret: 'no' }, { type: 'RESTART' },
    { payload: { points: 99 } }, { payload: { type: 'CORRECT' } }, { payload: null }, { roundId: null },
  ])('rejects invalid command envelope %j', (patch) => {
    const state = createState(setup(), NOW); const command = envelope(state, { type: 'START' });
    expect(() => parseCommand({ ...command, ...patch })).toThrow();
  });
  it('validates exact command fields and no internal events on the host lane', () => {
    for (const type of ['EXPIRE', 'PREPARE_SUCCEEDED', 'RECOVER_RUNNING', 'NEW_GAME', 'BONUS', 'UNDO']) expect(() => parseIntent({ type })).toThrow();
    expect(() => parseIntent({ type: 'VOID_EXPOSED', reason: 'interrupted' })).toThrow();
    expect(() => parseIntent({ type: 'PREPARE', roundId: randomUUID(), tier: 'easy' })).toThrow();
    expect(() => parseIntent({ type: 'START', contestantId: randomUUID() })).toThrow();
  });
  it.each([null, '2024', '2024-02', '2024-02-29'])('preserves partial/unknown date %s', (matchDate) => {
    const input = context(); expect(parseRoundContext({ ...input, answer: { ...input.answer, matchDate } }).answer.matchDate).toBe(matchDate);
  });
  it.each(['2023-02-29', '0000', '2024-13', '2024-04-31', 'yesterday'])('rejects invalid answer date %s', (matchDate) => {
    const input = context(); expect(() => parseRoundContext({ ...input, answer: { ...input.answer, matchDate } })).toThrow();
  });
  it('rejects unknown provenance/answer fields and invalid context inputs', () => {
    const input = context();
    for (const patch of [{ obscurity: null }, { difficulty: 'squash' }, { rulesVersion: 2 }, { matchRevision: 0 }, { sourceTitle: 'secret' }, { image: { ...input.image, sha256: 'bad' } }, { answer: { ...input.answer, promotion: '' } }]) {
      expect(() => parseRoundContext({ ...input, ...patch })).toThrow();
    }
  });
});

describe('selection and session repeat invariants', () => {
  const candidate = (): GameCandidate => ({ context: context(), capturedAt: NOW, reviewStatus: 'approved', associated: true, imageAvailable: true });
  it('uses every existing classification cell and exact pool choice', () => {
    const state = createState(setup(), NOW);
    for (const obscurity of OBSCURITIES) for (const difficulty of DIFFICULTIES) {
      const row = candidate(); row.context = { ...row.context!, obscurity, difficulty }; const tier = classify(obscurity, difficulty).tier!;
      expect(chooseCandidate([row], state, tier, 0)?.context).toEqual(row.context);
      expect(chooseCandidate([row], state, tier === 'squash' ? 'deathmatch' : 'squash', 0)).toBeNull();
    }
  });
  it('filters pending/rejected/unassigned/missing/incomplete content without copying provenance', () => {
    const state = createState(setup(), NOW); const valid = candidate();
    const rows: GameCandidate[] = [valid, { ...candidate(), reviewStatus: 'pending' }, { ...candidate(), reviewStatus: 'rejected' }, { ...candidate(), associated: false }, { ...candidate(), imageAvailable: false }, { ...candidate(), context: null }];
    expect(unseenPool(rows, state, 'squash')).toHaveLength(1);
    expect(chooseCandidate([], state, 'squash', 0)).toBeNull();
    expect(() => chooseCandidate(rows, state, 'squash', 1)).toThrow();
  });
  it('is stable by captured time/ID, reproducible and selects screenshot rows uniformly', () => {
    const state = createState(setup(), NOW); const rows = [candidate(), candidate(), candidate()]; rows[1].capturedAt = '2020';
    const sorted = unseenPool(rows, state, 'squash');
    expect(sorted[0].context.screenshotId).toBe(rows[1].context!.screenshotId);
    expect(chooseCandidate(rows, state, 'squash', 0)).toEqual(sorted[0]);
    expect(chooseCandidate(rows.reverse(), state, 'squash', 0.5)).toEqual(sorted[1]);
    expect(chooseCandidate(rows, state, 'squash', 0.999)).toEqual(sorted[2]);
  });
  it('reserves without burning and excludes exposed match, image identity and exact content separately', () => {
    const game = pureGame(); const chosen = context(); game.ready(chosen);
    const row = candidate(); row.context = chosen;
    expect(unseenPool([row], game.state, 'squash')).toHaveLength(1);
    game.step({ type: 'CANCEL_UNEXPOSED' }); expect(unseenPool([row], game.state, 'squash')).toHaveLength(1);
    game.ready(chosen); game.step({ type: 'REVEAL_AND_START' }); game.step({ type: 'VOID_EXPOSED', reason: 'skip' }); game.step({ type: 'ADVANCE' });
    const sameMatch = candidate(); sameMatch.context = { ...context(), matchId: chosen.matchId, image: { ...chosen.image, sha256: 'b'.repeat(64) } };
    const sameImage = candidate(); sameImage.context = { ...context(), screenshotId: chosen.screenshotId, image: { ...chosen.image, sha256: 'c'.repeat(64) } };
    const sameHash = candidate(); const distinct = candidate(); distinct.context = { ...context(), image: { ...chosen.image, sha256: 'd'.repeat(64) } };
    expect(unseenPool([sameMatch, sameImage, sameHash, distinct], game.state, 'squash').map((r) => r.context)).toEqual([distinct.context]);
    const snapshot = JSON.stringify(game.state); expect(chooseCandidate([sameMatch], game.state, 'squash', 0)).toBeNull(); expect(JSON.stringify(game.state)).toBe(snapshot);
  });
});

describe('pure authoritative transitions and projections', () => {
  it('keeps ownership and contestant selection across consecutive turns until an explicit switch', () => {
    const game = pureGame(); const a = game.state.activeContestantId; const b = game.state.contestants[1].id;
    game.ready(); game.step({ type: 'REVEAL_AND_START' }); game.step({ type: 'CORRECT' }); game.step({ type: 'REVEAL_ANSWER' }); game.step({ type: 'ADVANCE' });
    expect(game.state.activeContestantId).toBe(a);
    game.step({ type: 'SELECT_CONTESTANT', contestantId: b });
    expect(game.state.rounds[0].contestantId).toBe(a); expect(scoreboard(game.state).find((p) => p.contestantId === a)?.total).toBe(1);
    expect(scoreboard(game.state).find((p) => p.contestantId === b)?.total).toBe(0);
  });
  it('awards the exact shared base points for every matrix cell without changing inputs', () => {
    for (const obscurity of OBSCURITIES) for (const difficulty of DIFFICULTIES) {
      const game = pureGame(); const candidate = { ...context(), obscurity, difficulty };
      const expected = classify(obscurity, difficulty); game.step({ type: 'START' });
      game.step({ type: 'PREPARE', roundId: randomUUID(), tier: expected.tier! });
      game.step({ type: 'PREPARE_SUCCEEDED', context: candidate }); game.step({ type: 'REVEAL_AND_START' }); game.step({ type: 'CORRECT' });
      expect(game.state.awards[0].points).toBe(expected.points); expect(currentRound(game.state)).toMatchObject({ award: expected.points });
    }
  });
  it('refuses new turns at the resource cap without changing the session', () => {
    const game = pureGame(); game.step({ type: 'START' }); const state = { ...game.state, nextTurnOrdinal: 1001 };
    expect(() => transition(state, { type: 'PREPARE', roundId: randomUUID(), tier: 'squash' }, game.env())).toThrow(/limit/);
    expect(state.rounds).toEqual([]);
  });
  it('does not score Reveal, Advance, incorrect or timeout; supports explicit late entry only after expiry', () => {
    const game = pureGame(); game.ready(); game.step({ type: 'REVEAL_AND_START' }); game.setTime(10_000);
    expect(() => game.step({ type: 'CORRECT' })).toThrow();
    game.step({ type: 'EXPIRE', timerGeneration: currentRound(game.state)!.timerGeneration });
    expect(game.state.awards).toHaveLength(0); game.step({ type: 'CORRECT_BEFORE_BUZZER' });
    expect(currentRound(game.state)).toMatchObject({ outcome: 'correct', award: 1, lateEntry: true });
    expect(() => game.step({ type: 'CORRECT_BEFORE_BUZZER' })).toThrow();
    game.step({ type: 'REVEAL_ANSWER' }); game.step({ type: 'ADVANCE' }); expect(game.state.awards).toHaveLength(1);
  });
  it.each(['skip', 'void'] as const)('retains %s as zero-point exposed history with no auto-advance', (reason) => {
    const game = pureGame(); game.ready(); game.step({ type: 'REVEAL_AND_START' }); game.step({ type: 'VOID_EXPOSED', reason });
    expect(currentRound(game.state)).toMatchObject({ phase: 'adjudicated', outcome: 'void', award: 0, voidReason: reason });
    expect(game.state.awards).toHaveLength(0); expect(game.state.nextTurnOrdinal).toBe(2); game.step({ type: 'ADVANCE' }); expect(game.state.rounds).toHaveLength(1);
  });
  it('freezes remainder across pauses and rejects expired pause/stale timer generation', () => {
    const game = pureGame(); game.ready(); game.step({ type: 'REVEAL_AND_START' }); const generation = currentRound(game.state)!.timerGeneration;
    game.setTime(6000); game.step({ type: 'PAUSE' }); expect(currentRound(game.state)).toMatchObject({ remainingMs: 4000 });
    game.setTime(100_000); game.step({ type: 'RESUME' }); expect(game.clock?.deadlineMonoMs).toBe(104_000);
    expect(() => game.step({ type: 'EXPIRE', timerGeneration: generation })).toThrow();
    game.setTime(104_000); game.step({ type: 'PAUSE' }); expect(phase(game.state)).toBe('awaiting_judgment');
  });
  it('separates private/public data at every phase and only reveals pinned answer explicitly', () => {
    const game = pureGame(); const candidate = context(); game.ready(candidate);
    for (const action of [null, { type: 'REVEAL_AND_START' }, { type: 'PAUSE' }, { type: 'RESUME' }, { type: 'CORRECT' }] as const) {
      if (action) game.step(action);
      const serialized = JSON.stringify(displaySnapshot(game.state, game.clock, game.env().nowMonoMs));
      for (const secret of [candidate.answer.participantDescription, candidate.answer.promotion, candidate.answer.event, candidate.matchId, candidate.screenshotId, candidate.image.sha256]) expect(serialized).not.toContain(secret);
    }
    game.step({ type: 'REVEAL_ANSWER' }); const display = displaySnapshot(game.state, null, 0);
    expect(display).toMatchObject({ phase: 'answer_revealed', answer: candidate.answer });
    const host = hostSnapshot(game.state); host.session.contestants[0].name = 'mutated'; expect(game.state.contestants[0].name).not.toBe('mutated');
  });
  it('withholds only the current unrevealed judgment and score change, retaining private and earlier revealed scores', () => {
    const game = pureGame(); game.ready(); game.step({ type: 'REVEAL_AND_START' }); game.step({ type: 'CORRECT' });
    const concealed = displaySnapshot(game.state, null, 0);
    expect(concealed.phase).toBe('adjudicated'); expect(concealed).not.toHaveProperty('outcome'); expect(concealed).not.toHaveProperty('award'); expect(concealed).not.toHaveProperty('answer');
    expect(concealed.scores.every((s) => s.total === 0)).toBe(true); expect(hostSnapshot(game.state).scores[0].total).toBe(1); expect(game.state.awards).toHaveLength(1);
    game.step({ type: 'REVEAL_ANSWER' }); expect(displaySnapshot(game.state, null, 0).scores[0].total).toBe(1);
    game.step({ type: 'ADVANCE' }); const next = context(); next.image.sha256 = 'b'.repeat(64);
    game.ready(next); game.step({ type: 'REVEAL_AND_START' }); game.step({ type: 'CORRECT' });
    expect(displaySnapshot(game.state, null, 0).scores[0].total).toBe(1); expect(hostSnapshot(game.state).scores[0].total).toBe(2);
    game.step({ type: 'REVEAL_ANSWER' }); expect(displaySnapshot(game.state, null, 0).scores[0].total).toBe(2); expect(game.state.awards).toHaveLength(2);
  });
  it('keeps final completion totals authoritative even when the last judged answer was not revealed', () => {
    const game = pureGame(); game.ready(); game.step({ type: 'REVEAL_AND_START' }); game.step({ type: 'CORRECT' }); game.step({ type: 'END_GAME' });
    expect(displaySnapshot(game.state, null, 0)).toMatchObject({ phase: 'completed', scores: [{ total: 1 }, { total: 0 }] });
  });
  it('bounds private recent history while retaining totals from the full immutable ledger', () => {
    const game = pureGame(); game.step({ type: 'START' });
    for (let i = 0; i < 5; i++) {
      const c = context(); c.image.sha256 = String(i + 1).repeat(64);
      game.ready(c); game.step({ type: 'REVEAL_AND_START' }); game.step({ type: 'CORRECT' }); game.step({ type: 'REVEAL_ANSWER' }); game.step({ type: 'ADVANCE' });
    }
    const host = hostSnapshot(game.state); expect(host.recentRounds).toHaveLength(3); expect(host.historyTruncated).toBe(true);
    expect(host.scores[0].total).toBe(5); expect(host.session).not.toHaveProperty('awards'); expect(host.session).not.toHaveProperty('rounds');
  });
  it('completes a zero-score tie manually and rejects further mutations; a new game has clean history', () => {
    const game = pureGame(); game.step({ type: 'START' }); game.step({ type: 'END_GAME' });
    expect(winnerIds(game.state)).toHaveLength(2); expect(displaySnapshot(game.state, null, 0).phase).toBe('completed');
    expect(() => game.step({ type: 'PREPARE', roundId: randomUUID(), tier: 'squash' })).toThrow();
    expect(createState(setup(1), NOW)).toMatchObject({ rounds: [], awards: [], stateVersion: 1, nextTurnOrdinal: 1 });
  });
  it('requires readiness/current candidate, does not mutate inputs and discards invalid phase commands', () => {
    const game = pureGame(); game.ready(); const before = JSON.stringify(game.state);
    expect(() => transition(game.state, { type: 'REVEAL_AND_START' }, { ...game.env(), primaryReady: false })).toThrow();
    expect(() => transition(game.state, { type: 'REVEAL_AND_START' }, { ...game.env(), candidateCurrent: false })).toThrow();
    expect(JSON.stringify(game.state)).toBe(before);
    expect(() => game.step({ type: 'SELECT_CONTESTANT', contestantId: game.state.contestants[1].id })).toThrow();
  });
  it('enforces the allowed host-command matrix in every active phase', () => {
    const intents: HostIntent[] = [
      { type: 'SELECT_CONTESTANT', contestantId: randomUUID() }, { type: 'PREPARE', roundId: randomUUID(), tier: 'squash' },
      { type: 'REVEAL_AND_START' }, { type: 'CORRECT' }, { type: 'INCORRECT' }, { type: 'CORRECT_BEFORE_BUZZER' }, { type: 'CONFIRM_TIMEOUT' },
      { type: 'PAUSE' }, { type: 'RESUME' }, { type: 'CANCEL_UNEXPOSED' }, { type: 'VOID_EXPOSED', reason: 'void' },
      { type: 'VOID_INTERRUPTED' }, { type: 'REVEAL_ANSWER' }, { type: 'ADVANCE' }, { type: 'END_GAME' },
    ];
    const allowed: Record<string, string[]> = {
      between_rounds: ['SELECT_CONTESTANT', 'PREPARE', 'END_GAME'], preparing: ['CANCEL_UNEXPOSED'], ready: ['REVEAL_AND_START', 'CANCEL_UNEXPOSED'],
      guessing: ['CORRECT', 'INCORRECT', 'PAUSE', 'VOID_EXPOSED'], paused: ['RESUME', 'VOID_EXPOSED'], awaiting_judgment: ['CORRECT_BEFORE_BUZZER', 'CONFIRM_TIMEOUT', 'VOID_EXPOSED'],
      interrupted: ['VOID_INTERRUPTED'], adjudicated: ['REVEAL_ANSWER', 'END_GAME'], answer_revealed: ['ADVANCE', 'END_GAME'],
    };
    for (const target of Object.keys(allowed)) {
      const game = pureGame(); game.step({ type: 'START' });
      if (target !== 'between_rounds') game.step({ type: 'PREPARE', roundId: randomUUID(), tier: 'squash' });
      if (!['between_rounds', 'preparing'].includes(target)) game.step({ type: 'PREPARE_SUCCEEDED', context: context() });
      if (!['between_rounds', 'preparing', 'ready'].includes(target)) game.step({ type: 'REVEAL_AND_START' });
      if (target === 'paused') game.step({ type: 'PAUSE' });
      if (target === 'awaiting_judgment') { game.setTime(10_000); game.step({ type: 'EXPIRE', timerGeneration: currentRound(game.state)!.timerGeneration }); }
      if (target === 'interrupted') game.step({ type: 'RECOVER_RUNNING' });
      if (target === 'adjudicated' || target === 'answer_revealed') game.step({ type: 'CORRECT' });
      if (target === 'answer_revealed') game.step({ type: 'REVEAL_ANSWER' });
      expect(phase(game.state)).toBe(target);
      for (let intent of intents) {
        if (intent.type === 'SELECT_CONTESTANT') intent = { ...intent, contestantId: game.state.contestants[1].id };
        const apply = () => transition(game.state, intent, game.env());
        if (allowed[target].includes(intent.type)) expect(apply).not.toThrow(); else expect(apply).toThrow();
      }
    }
  });
  it('retains the captured answer rather than referencing later input mutations', () => {
    const game = pureGame(); const captured = context(); game.ready(captured); captured.answer.event = 'changed';
    expect((currentRound(game.state) as Extract<Round, { phase: 'ready' }>).context.answer.event).toBe('Private Event');
  });
});
