import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createServer, startServer } from '../../server/src/index';
import * as storage from '../../server/src/storage';
import { createTestResources, listen, serverUrl } from '../helpers/resources';

describe('server lifecycle and test isolation', () => {
  let resources: ReturnType<typeof createTestResources>;
  beforeEach(() => { resources = createTestResources(); });
  afterEach(async () => {
    try { await resources.cleanup(); }
    finally { vi.restoreAllMocks(); vi.unstubAllEnvs(); }
  });

  it('rejects an occupied port and closes only the failed attempt storage', async () => {
    const blocker = resources.server(http.createServer());
    await listen(blocker);
    const address = blocker.address();
    if (!address || typeof address === 'string') throw new Error('Missing address');
    const initialize = vi.spyOn(storage, 'initializeStorage');
    const closing = vi.spyOn(storage, 'closeStorage');
    await expect(startServer(address.port, { dataDir: resources.root }))
      .rejects.toMatchObject({ code: 'EADDRINUSE' });
    const session = initialize.mock.results[0].value as storage.StorageSession;
    expect(session.db.open).toBe(false);
    expect(closing).toHaveBeenCalledTimes(1);
    expect(blocker.listening).toBe(true);
  }, 2000);

  it('rejects a synchronous listen failure and releases its connection', async () => {
    const initialize = vi.spyOn(storage, 'initializeStorage');
    const error = new Error('synchronous listen failure');
    vi.spyOn(http.Server.prototype, 'listen').mockImplementationOnce(() => { throw error; });
    await expect(startServer(0, { dataDir: resources.root })).rejects.toBe(error);
    expect((initialize.mock.results[0].value as storage.StorageSession).db.open).toBe(false);
  }, 2000);

  it('rejects invalid storage without starting a listener', async () => {
    const invalid = path.join(resources.root, 'file');
    fs.writeFileSync(invalid, 'not a directory');
    await expect(startServer(0, { dataDir: invalid })).rejects.toThrow(/not a directory/);
  });

  it('starts on an allocated port, removes startup listeners, and closes storage once', async () => {
    const initialize = vi.spyOn(storage, 'initializeStorage');
    const closing = vi.spyOn(storage, 'closeStorage');
    const log = vi.spyOn(console, 'log');
    const server = resources.server(await startServer(0, { dataDir: resources.root }));
    expect(server.listening).toBe(true);
    // Node also installs its own HTTP connection-tracking listener.
    expect(server.listeners('listening').map((listener) => listener.name)).not.toContain('onListening');
    expect(server.listenerCount('error')).toBe(1);
    expect(log).toHaveBeenCalledWith(`Name That Match server listening on ${serverUrl(server)}`);
    await resources.cleanup();
    expect(server.listening).toBe(false);
    expect((initialize.mock.results[0].value as storage.StorageSession).db.open).toBe(false);
    expect(closing).toHaveBeenCalledTimes(1);
  });

  it('cleans acquired resources after assertion failure without touching operator data', async () => {
    const sentinel = path.join(resources.root, 'operator');
    fs.mkdirSync(sentinel);
    fs.writeFileSync(path.join(sentinel, 'keep.txt'), 'unchanged');
    const original = process.env.NAME_THAT_MATCH_DATA_DIR;
    // Pretend this was the operator value before fixture overrides.
    process.env.NAME_THAT_MATCH_DATA_DIR = sentinel;
    const initialize = vi.spyOn(storage, 'initializeStorage');
    const fixture = createTestResources();
    const session = fixture.storage(storage.initializeStorage({ dataDir: fixture.root }));
    let server: http.Server | undefined;
    try {
      await expect((async () => {
        try {
          server = fixture.server(createServer(0, { dataDir: fixture.root }));
          vi.stubEnv('NAME_THAT_MATCH_DATA_DIR', fixture.root);
          await listen(server);
          expect(server.listening).toBe(true);
          expect('controlled assertion failure').toBe('success');
        } finally {
          try { await fixture.cleanup(); }
          finally { vi.unstubAllEnvs(); }
        }
      })()).rejects.toThrow(/controlled assertion failure/);
      expect(session.db.open).toBe(false);
      for (const result of initialize.mock.results) {
        if (result.type === 'return') expect((result.value as storage.StorageSession).db.open).toBe(false);
      }
      expect(server?.listening).toBe(false);
      expect(fs.existsSync(fixture.root)).toBe(false);
      expect(process.env.NAME_THAT_MATCH_DATA_DIR).toBe(sentinel);
      expect(fs.readdirSync(sentinel)).toEqual(['keep.txt']);
      expect(fs.readFileSync(path.join(sentinel, 'keep.txt'), 'utf8')).toBe('unchanged');
    } finally {
      if (original === undefined) delete process.env.NAME_THAT_MATCH_DATA_DIR;
      else process.env.NAME_THAT_MATCH_DATA_DIR = original;
      await fixture.cleanup();
    }
  });

  it('releases an unstarted server during partial setup cleanup', async () => {
    const initialize = vi.spyOn(storage, 'initializeStorage');
    resources.server(createServer(0, { dataDir: resources.root }));
    await resources.cleanup();
    expect((initialize.mock.results[0].value as storage.StorageSession).db.open).toBe(false);
    expect(fs.existsSync(resources.root)).toBe(false);
  });
});
