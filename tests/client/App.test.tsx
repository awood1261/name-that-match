import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../client/src/App';

describe('application shell', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 'ok',
          service: 'name-that-match-server',
          timestamp: '2026-11-06T00:00:00.000Z',
        }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the core shell branding and connected status', async () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: /name that match/i })).toBeInTheDocument();
    expect(screen.getByText(/local server/i)).toBeInTheDocument();
    expect(await screen.findByText(/connected/i)).toBeInTheDocument();
  });
});
