import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createServer } from '../../server/src/index';

describe('server health endpoint', () => {
  let server: ReturnType<typeof createServer>;
  const port = 3456;

  beforeEach(async () => {
    server = createServer(port);
    await new Promise<void>((resolve) => {
      server.listen(port, '127.0.0.1', () => resolve());
    });
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  });

  it('returns a valid health payload at /health', async () => {
    const response = await fetch(`http://127.0.0.1:${port}/health`);
    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(payload).toMatchObject({
      status: 'ok',
      service: 'name-that-match-server',
    });
    expect(typeof payload.timestamp).toBe('string');
  });

  it('returns a valid health payload at /api/health', async () => {
    const response = await fetch(`http://127.0.0.1:${port}/api/health`);
    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(payload.status).toBe('ok');
    expect(payload.service).toBe('name-that-match-server');
  });
});
