import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createServer } from '../../server/src/index';

describe('production static serving', () => {
  let tempRoot = '';
  let server: ReturnType<typeof createServer> | undefined;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ntm-prod-'));
    const distDir = path.join(tempRoot, 'dist');
    fs.mkdirSync(distDir, { recursive: true });
    fs.writeFileSync(path.join(distDir, 'index.html'), '<!doctype html><html><body><h1>Production shell</h1></body></html>');
    fs.writeFileSync(path.join(distDir, 'asset.js'), 'console.log("asset");');
  });

  afterEach(async () => {
    const activeServer = server;

    if (activeServer) {
      await new Promise<void>((resolve, reject) => {
        activeServer.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    }

    server = undefined;

    if (tempRoot) {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('serves the built app and health endpoint from the same origin', async () => {
    server = createServer(3567, {
      production: true,
      staticDir: path.join(tempRoot, 'dist'),
      host: '127.0.0.1',
      dataDir: path.join(tempRoot, 'data'),
    });

    await new Promise<void>((resolve) => {
      server!.listen(3567, '127.0.0.1', () => resolve());
    });

    const rootResponse = await fetch('http://127.0.0.1:3567/');
    expect(rootResponse.status).toBe(200);
    expect(await rootResponse.text()).toContain('Production shell');

    const healthResponse = await fetch('http://127.0.0.1:3567/api/health');
    expect(healthResponse.status).toBe(200);
    expect(await healthResponse.json()).toMatchObject({ status: 'ok' });
  });
});
