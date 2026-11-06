import { describe, expect, it } from 'vitest';
import { isHealthResponse, type HealthResponse } from '../../shared/src/health';

describe('shared health contract', () => {
  it('accepts a valid health response', () => {
    const payload: HealthResponse = {
      status: 'ok',
      service: 'name-that-match-server',
      timestamp: '2026-11-06T00:00:00.000Z',
    };

    expect(isHealthResponse(payload)).toBe(true);
  });

  it('rejects invalid payloads', () => {
    expect(isHealthResponse({ status: 'error', service: 'server' })).toBe(false);
    expect(isHealthResponse({ status: 'ok', service: '' })).toBe(false);
    expect(isHealthResponse(null)).toBe(false);
  });
});
