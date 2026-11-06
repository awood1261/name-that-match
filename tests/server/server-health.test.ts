import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createServer } from '../../server/src/index';
import { createTestResources, listen } from '../helpers/resources';

describe('server health endpoint', () => {
  let resources: ReturnType<typeof createTestResources>;
  let baseUrl: string;

  beforeEach(async () => {
    resources = createTestResources();
    const server = resources.server(createServer(0, { dataDir: resources.root }));
    baseUrl = await listen(server);
  });

  afterEach(async () => {
    try {
      await resources.cleanup();
    } finally {
      vi.unstubAllEnvs();
      vi.restoreAllMocks();
    }
  });

  it.each(['/health', '/api/health'])('returns the existing health payload at %s', async (endpoint) => {
    const response = await fetch(`${baseUrl}${endpoint}`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toMatchObject({
      status: 'ok', service: 'name-that-match-server', timestamp: expect.any(String),
    });
  });
});
