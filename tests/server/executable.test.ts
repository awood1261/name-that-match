import { execFile, spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestResources, listen } from '../helpers/resources';
import { initializeStorage, closeStorage } from '../../server/src/storage';
import { eligibleCapture } from '../game/host-fixtures';
import { setup } from '../game/fixtures';
import type { ControllerCredential } from '../../shared/src/game/host';

const execute = promisify(execFile);

describe('executable startup and signal shutdown', () => {
  let resources: ReturnType<typeof createTestResources>;
  beforeEach(() => { resources = createTestResources(); });
  afterEach(async () => { await resources.cleanup(); });

  async function expectFailedStart(dataDir: string, port: number) {
    try {
      await execute(process.execPath, ['--import', 'tsx', 'server/src/index.ts'], {
        env: { ...process.env, NAME_THAT_MATCH_DATA_DIR: dataDir,
          NAME_THAT_MATCH_HOST: '127.0.0.1', NAME_THAT_MATCH_PORT: String(port) },
        timeout: 3000,
      });
      throw new Error('Expected startup to fail');
    } catch (error) {
      const failure = error as Error & { code?: number; killed?: boolean; stderr?: string };
      expect(failure.killed).toBe(false);
      expect(failure.code).toBe(1);
      expect(failure.stderr).toContain('Unable to start Name That Match server:');
      expect(failure.stderr).not.toMatch(/UnhandledPromiseRejection|triggerUncaughtException/);
      return failure.stderr;
    }
  }

  it('reports an occupied port and exits unsuccessfully', async () => {
    const blocker = resources.server(http.createServer());
    await listen(blocker);
    const address = blocker.address();
    if (!address || typeof address === 'string') throw new Error('Missing TCP address');
    expect(await expectFailedStart(resources.root, address.port)).toContain('EADDRINUSE');
    expect(blocker.listening).toBe(true);
  });

  it('reports invalid storage and exits unsuccessfully', async () => {
    const invalid = path.join(resources.root, 'not-a-directory');
    fs.writeFileSync(invalid, 'keep');
    expect(await expectFailedStart(invalid, 3001)).toContain('not a directory');
    expect(fs.readFileSync(invalid, 'utf8')).toBe('keep');
  });
  it('gracefully stops a running game on SIGTERM and preserves its known remainder', async () => {
    const seed = initializeStorage({ dataDir: resources.root }); eligibleCapture(seed); closeStorage(seed);
    const reservation = resources.server(http.createServer()); await listen(reservation); const address = reservation.address();
    if (!address || typeof address === 'string') throw new Error('Missing reserved port'); await new Promise<void>(resolve => reservation.close(() => resolve()));
    const origin = `http://127.0.0.1:${address.port}`;
    const child = spawn(process.execPath, ['--import', 'tsx', 'server/src/index.ts'], { env: { ...process.env, NAME_THAT_MATCH_DATA_DIR: resources.root,
      NAME_THAT_MATCH_PORT: String(address.port), NAME_THAT_MATCH_HOST: '127.0.0.1', NAME_THAT_MATCH_UI_ORIGINS: origin }, stdio: ['ignore', 'pipe', 'pipe'] });
    const exit = new Promise<{ code: number | null; signal: string | null }>((resolve, reject) => { child.once('exit', (code, signal) => resolve({ code, signal })); child.once('error', reject); });
    let output = ''; let errors = ''; child.stdout.on('data', chunk => { output += chunk; }); child.stderr.on('data', chunk => { errors += chunk; });
    try {
      for (let i = 0; i < 200 && !output.includes('server listening'); i++) await new Promise(resolve => setTimeout(resolve, 10));
      expect(output).toContain('server listening');
      const post = async (route: string, input: unknown, credential?: ControllerCredential) => {
        const response = await fetch(origin + '/api/game' + route, { method: 'POST', headers: { Origin: origin, 'X-Name-That-Match': 'game', 'Content-Type': 'application/json',
          ...(credential ? { Authorization: `Bearer ${credential.token}`, 'X-Name-That-Match-Epoch': credential.serverEpoch } : {}) }, body: JSON.stringify(input) });
        expect(response.ok).toBe(true); return (await response.json()).data;
      };
      const owner: ControllerCredential = await post('/control-lease', {}); const input = setup(1); let state = (await post('/sessions', input, owner)).status;
      const command = async (type: string, payload = {}) => {
        const response = await post(`/sessions/${input.sessionId}/commands`, { protocolVersion: 1, commandId: randomUUID(), sessionId: input.sessionId,
          expectedStateVersion: state.snapshot.session.stateVersion, type, payload, ...(!['START', 'PREPARE'].includes(type) && state.snapshot.session.currentRoundId ? { roundId: state.snapshot.session.currentRoundId } : {}) }, owner); state = response.status;
      };
      await command('START'); const viewer = await post(`/sessions/${input.sessionId}/displays`, { primary: true }, owner); await command('PREPARE', { roundId: randomUUID(), tier: 'squash' });
      for (let i = 0; i < 100 && state.snapshot.currentRound.phase !== 'ready'; i++) {
        await new Promise(resolve => setTimeout(resolve, 10)); const response = await fetch(origin + '/api/game/current', { headers: { Authorization: `Bearer ${owner!.token}`, 'X-Name-That-Match-Epoch': owner!.serverEpoch } }); state = (await response.json()).data;
      }
      expect(state.snapshot.currentRound.phase).toBe('ready'); const connectionId = randomUUID(); const route = `/sessions/${input.sessionId}/displays/${viewer.displayId}/status`;
      const first = await post(route, { type: 'connect', connectionId }, viewer); const roundId = state.snapshot.currentRound.id;
      await post(route, { type: 'status', connectionId, connectionSequence: first.connectionSequence, roundId, imageKey: roundId, decoded: true, clock: { nonce: first.sample.nonce, rttMs: 0 } }, viewer);
      state = (await (await fetch(origin + '/api/game/current', { headers: { Authorization: `Bearer ${owner!.token}`, 'X-Name-That-Match-Epoch': owner!.serverEpoch } })).json()).data;
      await command('REVEAL_AND_START'); expect(state.snapshot.currentRound.phase).toBe('guessing');
      const stoppedAt = performance.now(); child.kill('SIGTERM'); expect(await exit).toEqual({ code: 0, signal: null }); expect(performance.now() - stoppedAt).toBeLessThan(3000);
      expect(errors).not.toMatch(/Unhandled|uncaught/i);
      const restored = initializeStorage({ dataDir: resources.root });
      try {
        const round = restored.db.prepare('SELECT phase,remaining_ms FROM game_rounds').get() as { phase: string; remaining_ms: number };
        expect(round.phase).toBe('paused'); expect(round.remaining_ms).toBeGreaterThan(0); expect(round.remaining_ms).toBeLessThanOrEqual(10_000);
        expect(restored.db.prepare('SELECT count(*) n FROM game_score_events').get()).toEqual({ n: 0 });
      } finally { closeStorage(restored); }
    } finally { if (child.exitCode === null && child.signalCode === null) { child.kill('SIGKILL'); await exit; } }
  }, 10_000);
});
