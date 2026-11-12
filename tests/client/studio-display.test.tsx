import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DisplayControls } from '../../client/src/game/DisplayControls';
import { ContestantStage } from '../../client/src/game/ContestantStage';
import { stageAnswer } from '../../client/src/game/stageText';

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('Studio presentation controls', () => {
  it('requests fullscreen only from a gesture, tracks browser exit and toggles optional guides', async () => {
    const enter = vi.fn().mockResolvedValue(undefined); const exit = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(document.documentElement, 'requestFullscreen', { configurable: true, value: enter });
    Object.defineProperty(document, 'exitFullscreen', { configurable: true, value: exit });
    const guides = vi.fn(); const view = render(<DisplayControls guides={false} onGuides={guides} />);
    expect(enter).not.toHaveBeenCalled();
    const button = screen.getByRole('button', { name: 'Enter fullscreen' }); button.focus(); expect(button).toHaveFocus(); fireEvent.click(button);
    await waitFor(() => expect(enter).toHaveBeenCalledOnce());
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: document.documentElement });
    fireEvent(document, new Event('fullscreenchange'));
    fireEvent.click(screen.getByRole('button', { name: 'Exit fullscreen' })); await waitFor(() => expect(exit).toHaveBeenCalledOnce());
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: null }); fireEvent(document, new Event('fullscreenchange'));
    expect(screen.getByRole('button', { name: 'Enter fullscreen' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Safe-area guides', pressed: false })); expect(guides).toHaveBeenCalledWith(true);
    view.rerender(<DisplayControls guides onGuides={guides} />); expect(screen.getByRole('button', { name: 'Safe-area guides', pressed: true })).toBeInTheDocument();
  });
  it.each(['unsupported', 'rejected'])('keeps a normal window usable when fullscreen is %s', async (mode) => {
    Object.defineProperty(document.documentElement, 'requestFullscreen', { configurable: true, value: mode === 'unsupported' ? undefined : vi.fn().mockRejectedValue(new Error('refused')) });
    render(<DisplayControls guides={false} onGuides={() => {}} />); fireEvent.click(screen.getByRole('button', { name: 'Enter fullscreen' }));
    await screen.findByText(/Fullscreen is unavailable or was refused/); expect(screen.getByRole('button', { name: 'Enter fullscreen' })).toBeEnabled();
  });
  it('uniformly fits both stage dimensions on resize and disconnects its measurement observer', () => {
    let resize!: () => void; const disconnect = vi.fn();
    vi.stubGlobal('ResizeObserver', class { constructor(callback: () => void) { resize = callback; } observe() {} disconnect = disconnect; });
    const width = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(1080);
    const height = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(960);
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1366);
    const availableHeight = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(700);
    const view = render(<ContestantStage guides={false}><p>Clue</p></ContestantStage>);
    const stage = document.querySelector('[data-contestant-stage]') as HTMLElement;
    expect(Number(stage.style.getPropertyValue('--stage-scale'))).toBeCloseTo(700 / 960); expect(stage).toHaveAttribute('data-guides', 'false');
    availableHeight.mockReturnValue(2000); act(() => resize()); expect(Number(stage.style.getPropertyValue('--stage-scale'))).toBeCloseTo(1366 / 1080);
    width.mockReturnValue(0); height.mockReturnValue(0); act(() => resize()); expect(stage.style.getPropertyValue('--stage-scale')).not.toBe('Infinity');
    view.unmount(); expect(disconnect).toHaveBeenCalledOnce();
  });
  it('bounds filming text without splitting Unicode or changing frozen metadata/date precision', () => {
    const answer = { participantDescription: '🤼'.repeat(150), promotion: 'p'.repeat(500), event: 'e'.repeat(500), matchDate: null, stipulation: 's'.repeat(500), championshipInfo: 'c'.repeat(500) };
    const original = { ...answer }; const preview = stageAnswer(answer);
    expect(Array.from(preview.participantDescription)).toHaveLength(120); expect(preview.participantDescription).toMatch(/🤼…$/u);
    expect(preview.promotion).toHaveLength(64); expect(preview.stipulation).toHaveLength(80); expect(preview.matchDate).toBeNull(); expect(answer).toEqual(original);
    expect(stageAnswer({ ...answer, participantDescription: 'Alpha vs Beta', promotion: 'AEW', event: 'All In', stipulation: null }).participantDescription).toBe('Alpha vs Beta');
  });
  it('selects landscape/compact geometry from available space and restores unchanged legacy geometry', () => {
    let resize!: () => void; const disconnect = vi.fn();
    vi.stubGlobal('ResizeObserver', class { constructor(callback: () => void) { resize = callback; } observe() {} disconnect = disconnect; });
    const width = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1920);
    const height = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(1080);
    const view = render(<ContestantStage guides visual><p>Visual scene</p></ContestantStage>);
    const stage = document.querySelector('[data-contestant-stage]') as HTMLElement;
    expect(stage).toHaveAttribute('data-layout', 'landscape'); expect(stage).toHaveAttribute('data-visual-scene');
    expect(Number(stage.style.getPropertyValue('--stage-scale'))).toBe(1);
    width.mockReturnValue(375); height.mockReturnValue(600); act(() => resize());
    expect(stage).toHaveAttribute('data-layout', 'compact'); expect(Number(stage.style.getPropertyValue('--stage-scale'))).toBeCloseTo(375 / 1080);
    view.rerender(<ContestantStage guides={false}><p>Existing result</p></ContestantStage>);
    expect(stage).toHaveAttribute('data-layout', 'legacy'); expect(stage).not.toHaveAttribute('data-visual-scene');
    expect(stage).toHaveAttribute('data-guides', 'false'); view.unmount(); expect(disconnect).toHaveBeenCalledTimes(2);
  });
});
