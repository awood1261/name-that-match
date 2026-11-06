import { execFile } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestResources, listen } from '../helpers/resources';

const execute = promisify(execFile);

describe('executable startup failures', () => {
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
});
