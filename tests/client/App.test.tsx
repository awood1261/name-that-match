import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../client/src/App';
import { libraryApi, matchApi } from '../../client/src/library/api';

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
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders the core shell branding and connected status', async () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: /name that match/i })).toBeInTheDocument();
    expect(screen.getByText(/local server/i)).toBeInTheDocument();
    expect(await screen.findByText(/connected/i)).toBeInTheDocument();
  });
  it('opens Image Library and returns to System without exposing later workflows', async () => {
    vi.spyOn(libraryApi, 'unassigned').mockResolvedValue({ screenshots: [], matchedCount: 0, asOf: '' });
    vi.spyOn(matchApi, 'list').mockResolvedValue({ matches: [], matchedCount: 0, asOf: '' });
    render(<App />); await screen.findByText(/connected/i);
    fireEvent.click(screen.getByRole('button', { name: 'Image Library' }));
    expect(await screen.findByRole('heading', { name: 'Matches' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Image Library' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Play' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'System' }));
    expect(screen.getByRole('heading', { name: 'System status' })).toBeInTheDocument();
  });
});
