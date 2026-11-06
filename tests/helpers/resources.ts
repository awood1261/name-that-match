import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type http from 'node:http';
import { closeStorage, type StorageSession } from '../../server/src/storage';

/** Resources belong to one test; never remove an operator-configured directory. */
export function createTestResources() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ntm-test-'));
  const servers: http.Server[] = [];
  const sessions: StorageSession[] = [];
  return {
    root,
    server<T extends http.Server>(server: T): T {
      servers.push(server);
      return server;
    },
    storage(session: StorageSession): StorageSession {
      sessions.push(session);
      return session;
    },
    async cleanup() {
      const errors: unknown[] = [];
      for (const server of servers.reverse()) {
        try {
          // close also emits 'close' for an unstarted server, releasing its storage.
          await new Promise<void>((resolve, reject) => {
            server.close((error?: NodeJS.ErrnoException) => {
              if (error && error.code !== 'ERR_SERVER_NOT_RUNNING') reject(error);
              else resolve();
            });
          });
        } catch (error) {
          errors.push(error);
        }
      }
      for (const session of sessions) closeStorage(session);
      try {
        fs.rmSync(root, { recursive: true, force: true });
      } catch (error) {
        errors.push(error);
      }
      if (errors.length) throw errors[0];
    },
  };
}

export async function listen(server: http.Server): Promise<string> {
  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => {
      server.off('listening', onListening);
      reject(error);
    };
    const onListening = () => {
      server.off('error', onError);
      resolve();
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(0, '127.0.0.1');
  });
  return serverUrl(server);
}

export function serverUrl(server: http.Server): string {
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected a listening TCP server');
  return `http://127.0.0.1:${address.port}`;
}
