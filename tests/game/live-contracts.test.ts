import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { parseLiveClient, parseLiveServer, type LiveSnapshot } from '../../shared/src/game/live';
import { displaySnapshot } from '../../shared/src/game/projections';
import { context, pureGame } from './fixtures';

const epoch = randomUUID(); const tag = { protocolVersion: 1, serverEpoch: epoch, connectionSequence: 1 };
const hello = { type: 'hello', protocolVersion: 1, serverEpoch: epoch, connectionId: randomUUID(), role: 'display', sessionId: randomUUID(), displayId: randomUUID(), token: 'a'.repeat(64) };
describe('live runtime message contracts', () => {
  it('accepts the two explicit roles and bounded observation messages', () => {
    expect(parseLiveClient(hello)).toEqual(hello);
    const { displayId, ...host } = hello; expect(parseLiveClient(hello)).toHaveProperty('displayId', displayId); expect(parseLiveClient({ ...host, role: 'host', sessionId: null })).toHaveProperty('role', 'host');
    expect(parseLiveClient({ ...tag, type: 'clock_probe', nonce: randomUUID() }).type).toBe('clock_probe');
    expect(parseLiveClient({ ...tag, type: 'display_ready', roundId: null, imageKey: null, decoded: false, clock: null }).type).toBe('display_ready');
  });
  it.each([
    { ...hello, role: 'administrator' }, { ...hello, protocolVersion: 2 }, { ...hello, token: 'short' }, { ...hello, sourcePath: '/capture' },
    { ...tag, type: 'CORRECT' }, { ...tag, type: 'heartbeat_ack', nonce: 'old' }, { ...tag, type: 'clock_probe', nonce: randomUUID(), connectionSequence: 0 },
    { ...tag, type: 'display_ready', roundId: null, imageKey: null, decoded: true, clock: { nonce: randomUUID(), rttMs: Infinity } },
    { ...tag, type: 'display_ready', roundId: null, imageKey: 'https://foreign.example/image', decoded: true, clock: null },
  ])('rejects unsupported identity/shape/role/command fields %#', input => { expect(() => parseLiveClient(input)).toThrow(); });
  it('accepts every exercised public phase without permitting pre-reveal answer/outcome fields', () => {
    const game = pureGame(); let sequence = 0;
    const frame = (): LiveSnapshot => { const snapshot = displaySnapshot(game.state, game.clock, game.env().nowMonoMs); return { ...tag, protocolVersion: 1, type: 'snapshot', role: 'display', sequence: ++sequence,
      sessionId: snapshot.sessionId, stateVersion: snapshot.stateVersion, serverMonoMs: game.env().nowMonoMs, state: { snapshot, asset: null } }; };
    const check = () => expect(parseLiveServer(frame()).type).toBe('snapshot');
    check(); game.step({ type: 'START' }); check(); game.step({ type: 'PREPARE', roundId: randomUUID(), tier: 'squash' }); check();
    game.step({ type: 'PREPARE_SUCCEEDED', context: context() }); check(); game.step({ type: 'REVEAL_AND_START' }); check(); game.step({ type: 'PAUSE' }); check();
    game.step({ type: 'RESUME' }); game.setTime(10_000); game.step({ type: 'EXPIRE', timerGeneration: game.clock!.timerGeneration }); check(); game.step({ type: 'CORRECT_BEFORE_BUZZER' }); check();
    for (const field of ['answer', 'outcome', 'award', 'context', 'originalFilename']) {
      const value = frame(); if (value.role !== 'display') throw new Error('fixture'); Object.assign(value.state.snapshot, { [field]: 'private' }); expect(() => parseLiveServer(value)).toThrow();
    }
    game.step({ type: 'REVEAL_ANSWER' }); check(); game.step({ type: 'ADVANCE' }); check(); game.step({ type: 'END_GAME' }); check();
  });
});
