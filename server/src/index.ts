import http from 'node:http';
import { isHealthResponse, type HealthResponse } from '../../shared/src/health';
import { closeStorage, initializeStorage, type StorageOptions, type StorageSession } from './storage';

export const DEFAULT_PORT = 3001;

export interface ServerOptions extends StorageOptions {
  port?: number;
}

export function createHealthResponse(): HealthResponse {
  return {
    status: 'ok',
    service: 'name-that-match-server',
    timestamp: new Date().toISOString(),
  };
}

export function createServer(port = DEFAULT_PORT, options: StorageOptions = {}) {
  const storage = initializeStorage(options);
  const server = http.createServer((req, res) => {
    const requestUrl = req.url ?? '/';

    if (requestUrl === '/health' || requestUrl === '/api/health') {
      const payload = createHealthResponse();
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(JSON.stringify(payload));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  server.on('listening', () => {
    console.log(`Name That Match server listening on http://localhost:${port}`);
    console.log(`Storage initialized at ${storage.rootDir}`);
  });

  server.on('error', (error) => {
    closeStorage(storage);
    console.error('Server error:', error);
  });

  server.on('close', () => {
    closeStorage(storage);
  });

  return server;
}

export function startServer(port = DEFAULT_PORT, options: StorageOptions = {}) {
  return new Promise<http.Server>((resolve) => {
    const server = createServer(port, options);
    server.listen(port, '0.0.0.0', () => resolve(server));
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void startServer(DEFAULT_PORT);
}

export { isHealthResponse };
export type { StorageSession };
