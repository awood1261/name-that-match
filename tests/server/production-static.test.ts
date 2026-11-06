import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createServer } from '../../server/src/index';
import { createTestResources, listen } from '../helpers/resources';

describe('production static serving', () => {
  let resources: ReturnType<typeof createTestResources>;
  let baseUrl: string;

  beforeEach(async () => {
    resources = createTestResources();
    const distDir = path.join(resources.root, 'dist');
    fs.mkdirSync(distDir);
    fs.writeFileSync(path.join(distDir, 'index.html'), '<!doctype html><h1>Production shell</h1>');
    fs.writeFileSync(path.join(distDir, 'asset.js'), 'console.log("asset");');
    const server = resources.server(createServer(0, {
      production: true, staticDir: distDir, host: '127.0.0.1',
      dataDir: path.join(resources.root, 'data'),
    }));
    baseUrl = await listen(server);
  });

  afterEach(async () => { await resources.cleanup(); });

  it('serves HTML, JavaScript, and health at one origin', async () => {
    const root = await fetch(`${baseUrl}/`);
    expect(root.status).toBe(200);
    expect(root.headers.get('content-type')).toContain('text/html');
    expect(await root.text()).toContain('Production shell');
    const asset = await fetch(`${baseUrl}/asset.js`);
    expect(asset.status).toBe(200);
    expect(asset.headers.get('content-type')).toContain('application/javascript');
    expect(await asset.text()).toBe('console.log("asset");');
    const health = await fetch(`${baseUrl}/api/health`);
    expect(health.status).toBe(200);
    expect(await health.json()).toMatchObject({ status: 'ok' });
  });
});
