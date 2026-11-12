import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContestantJoin } from '../../client/src/game/ContestantJoin';
import { HostDisplayPanel } from '../../client/src/game/HostDisplayPanel';
import { gameApi, GameApiError } from '../../client/src/game/api';
import * as qr from '../../client/src/game/qr';
import { hostSnapshot } from '../../shared/src/game/projections';
import { pureGame } from '../game/fixtures';
import type { HostStatus } from '../../shared/src/game/host';
import type { DisplayOriginObservation } from '../../shared/src/game/join';

const credential = { token: 'a'.repeat(64), generation: 1, serverEpoch: randomUUID() };
const fragment = new URLSearchParams({ display: randomUUID(), token: 'b'.repeat(64), epoch: credential.serverEpoch }).toString();
const localLink = `${location.origin}/display/${randomUUID()}#${fragment}`;
const origin = 'http://192.0.2.10:5173'; const ready = { ready: true as const, origin, source: 'detected' as const, message: 'LAN origin is configured.' };
beforeEach(() => { vi.spyOn(gameApi, 'displayOrigin').mockResolvedValue(ready); });
afterEach(() => { vi.restoreAllMocks(); });
describe('offline contestant join controls', () => {
  it('renders matching QR/link with the complete viewer-only fragment and accessible manual/refresh controls', async () => {
    render(<ContestantJoin localLink={localLink} credential={credential} disabled={false} />);
    const image = await screen.findByRole('img', { name: 'QR code for the contestant display link' });
    expect(image.getAttribute('src')).toMatch(/^data:image\/svg\+xml/); const link = screen.getByLabelText('Contestant display link') as HTMLInputElement;
    expect(link.value).toBe(qr.withDisplayOrigin(localLink, origin)); expect(new URL(link.value).hash).toBe('#' + fragment); expect(link.value).not.toContain(credential.token);
    fireEvent.focus(link); expect(link.selectionEnd).toBe(link.value.length);
    const button = screen.getByRole('button', { name: 'Refresh LAN address' }); button.focus(); expect(button).toHaveFocus(); fireEvent.click(button);
    await waitFor(() => expect(gameApi.displayOrigin).toHaveBeenCalledTimes(2)); expect(vi.mocked(gameApi.displayOrigin).mock.calls[1][1]).toMatchObject({ refresh: true });
  });
  it('shows local copy fallback/config errors without advertising a device QR', async () => {
    vi.mocked(gameApi.displayOrigin).mockResolvedValue({ ready: false, origin, source: 'detected', code: 'ORIGIN_NOT_ALLOWED', message: 'Add the origin to NAME_THAT_MATCH_UI_ORIGINS.' });
    render(<ContestantJoin localLink={localLink} credential={credential} disabled={false} />);
    await screen.findByText(/Add the origin/); expect(screen.getByLabelText('Contestant display link')).toHaveValue(localLink); expect(screen.queryByRole('img')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Manual LAN origin'), { target: { value: origin } });
    vi.mocked(gameApi.displayOrigin).mockResolvedValue({ ...ready, source: 'manual' }); fireEvent.submit(screen.getByRole('button', { name: 'Use manual origin' }).closest('form')!);
    await screen.findByRole('img'); expect(vi.mocked(gameApi.displayOrigin).mock.calls[1][1]).toMatchObject({ manualOrigin: origin });
  });
  it('keeps the device link when QR generation fails', async () => {
    vi.spyOn(qr, 'contestantQr').mockRejectedValue(new Error('encoder failed'));
    render(<ContestantJoin localLink={localLink} credential={credential} disabled={false} />);
    await screen.findByRole('alert'); expect(screen.getByLabelText('Contestant display link')).toHaveValue(qr.withDisplayOrigin(localLink, origin)); expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
  it('clears old QR during refresh and refuses stale asynchronous output after a changed origin', async () => {
    let finish!: (image: string) => void;
    vi.spyOn(qr, 'contestantQr').mockReturnValueOnce(new Promise((resolve) => { finish = resolve; })).mockResolvedValue('data:image/svg+xml,new');
    render(<ContestantJoin localLink={localLink} credential={credential} disabled={false} />); await screen.findByText('Generating QR code…');
    vi.mocked(gameApi.displayOrigin).mockResolvedValue({ ...ready, origin: 'http://192.0.2.11:5173' }); fireEvent.click(screen.getByRole('button', { name: 'Refresh LAN address' }));
    await screen.findByRole('img'); await act(async () => { finish('data:image/svg+xml,old'); });
    expect(screen.getByRole('img')).toHaveAttribute('src', 'data:image/svg+xml,new'); expect(screen.getByLabelText('Contestant display link')).toHaveValue(qr.withDisplayOrigin(localLink, 'http://192.0.2.11:5173'));
  });
  it('cancels observations on unmount and ignores late responses', async () => {
    let finish!: (value: DisplayOriginObservation) => void; vi.mocked(gameApi.displayOrigin).mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const view = render(<ContestantJoin localLink={localLink} credential={credential} disabled={false} />);
    await waitFor(() => expect(gameApi.displayOrigin).toHaveBeenCalledOnce());
    const signal = vi.mocked(gameApi.displayOrigin).mock.calls[0][2]; view.unmount(); expect(signal.aborted).toBe(true); await act(async () => { finish(ready); });
  });
  it('reports invalid manual configuration and preserves the local fallback', async () => {
    vi.mocked(gameApi.displayOrigin).mockRejectedValue(new GameApiError({ code: 'INVALID_DISPLAY_ORIGIN', message: 'Use a usable LAN IPv4 address.' }, 400));
    render(<ContestantJoin localLink={localLink} credential={credential} disabled={false} />); await screen.findByText('Use a usable LAN IPv4 address.');
    expect(screen.getByLabelText('Contestant display link')).toHaveValue(localLink); expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
  it('refreshes the same registered viewer without primary changes or commands', async () => {
    const game = pureGame(); const viewer = { token: 'b'.repeat(64), serverEpoch: credential.serverEpoch, displayId: randomUUID() };
    const register = vi.spyOn(gameApi, 'registerDisplay').mockResolvedValue(viewer); const designate = vi.spyOn(gameApi, 'designateDisplay'); const command = vi.spyOn(gameApi, 'command');
    const status: HostStatus = { protocolVersion: 1, sequence: 1, serverEpoch: credential.serverEpoch, snapshot: hostSnapshot(game.state), allowedActions: [], candidateValid: false, primaryDisplay: { ready: false, message: 'Connect a display.' }, preparationError: null, availability: { tiers: { squash: { screenshots: 0, matches: 0 }, competitive: { screenshots: 0, matches: 0 }, deathmatch: { screenshots: 0, matches: 0 } }, distinctMatches: 0, asOf: '' } };
    render(<HostDisplayPanel credential={credential} status={status} disabled={false} refresh={async () => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Create contestant display link' })); await screen.findByRole('img');
    fireEvent.click(screen.getByRole('button', { name: 'Refresh LAN address' })); await waitFor(() => expect(gameApi.displayOrigin).toHaveBeenCalledTimes(2));
    expect(register).toHaveBeenCalledOnce(); expect(designate).not.toHaveBeenCalled(); expect(command).not.toHaveBeenCalled();
  });
  it('opens the existing local viewer only on a gesture, with opener isolation and a null-handle fallback', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const register = vi.spyOn(gameApi, 'registerDisplay'); const command = vi.spyOn(gameApi, 'command');
    render(<ContestantJoin localLink={localLink} credential={credential} disabled={false} />);
    await screen.findByRole('img'); expect(open).not.toHaveBeenCalled();
    const button = screen.getByRole('button', { name: 'Open contestant display' }); button.focus(); expect(button).toHaveFocus(); fireEvent.click(button);
    expect(open).toHaveBeenCalledWith(localLink, '_blank', 'noopener,noreferrer'); await screen.findByText(/If no window appeared/);
    expect(register).not.toHaveBeenCalled(); expect(command).not.toHaveBeenCalled(); expect(screen.getByLabelText('Contestant display link')).toHaveValue(qr.withDisplayOrigin(localLink, origin));
    open.mockImplementation(() => { throw new Error('blocked'); }); fireEvent.click(button); await screen.findByText(/browser could not open the display/);
  });
});
