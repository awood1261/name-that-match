import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { HostStatus } from '../../../shared/src/game/host';
import type { HostIntent } from '../../../shared/src/game/contracts';
import { Countdown } from './Countdown';
import pageStyles from './HostPage.module.css';
import styles from './HostRoundControls.module.css';

export function HostRoundControls({ status, can, command, children }: { status: HostStatus; can: (type: string) => boolean; command: (intent: HostIntent) => void; children?: ReactNode }) {
  const round = status.snapshot?.currentRound;
  const timing = useMemo(() => status.timing ? { ...status.timing, observedAt: performance.now() } : null, [status.timing]);
  const [reason, setReason] = useState<'skip' | 'void'>('skip');
  if (!round) return null;
  return <section className={styles.round} aria-label="Live round controls">
    {timing && <div className={styles.timer}><Countdown remainingMs={timing.remainingMs} running={round.phase === 'guessing'} observedAt={timing.observedAt} format="clock" /><small>Authoritative round time{round.phase === 'paused' ? ' · paused' : ''}</small></div>}
    {children}
    <HostActionArea>
    {round.phase === 'ready' && <button type="button" className={pageStyles.primary} disabled={!can('REVEAL_AND_START')} aria-describedby="game-command-blockers" onClick={() => command({ type: 'REVEAL_AND_START' })}>Reveal & start</button>}
    {round.phase === 'guessing' && <><div className={styles.judgments}>
      <button disabled={!can('CORRECT')} onClick={() => command({ type: 'CORRECT' })}>Correct</button>
      <button disabled={!can('INCORRECT')} onClick={() => command({ type: 'INCORRECT' })}>Incorrect</button>
      </div><button disabled={!can('PAUSE')} onClick={() => command({ type: 'PAUSE' })}>Pause</button></>}
    {round.phase === 'paused' && <><p>Clue covered. Resume uses only the preserved time.</p><button disabled={!can('RESUME')} onClick={() => command({ type: 'RESUME' })}>Resume</button></>}
    {round.phase === 'awaiting_judgment' && <><p role="status">Time up. Guessing has ended. Confirm whether an answer was spoken before the buzzer.</p><div className={styles.optionFields}>
      <button disabled={!can('CORRECT_BEFORE_BUZZER')} onClick={() => command({ type: 'CORRECT_BEFORE_BUZZER' })}>Correct before buzzer — I confirm a timely answer</button>
      <button disabled={!can('CONFIRM_TIMEOUT')} onClick={() => command({ type: 'CONFIRM_TIMEOUT' })}>Confirm timeout · no credit</button>
    </div></>}
    {round.phase === 'interrupted' && <><p role="status">This interrupted round cannot restart. Void it while preserving its exposure history.</p><button disabled={!can('VOID_INTERRUPTED')} onClick={() => command({ type: 'VOID_INTERRUPTED' })}>Void interrupted round</button></>}
    {round.phase === 'adjudicated' && <><p role="status">Judgment saved: {round.outcome} · {round.award} {round.award === 1 ? 'point' : 'points'}. The contestant is waiting; result and match identity remain concealed.</p>
      <button type="button" className={pageStyles.primary} disabled={!can('REVEAL_ANSWER')} onClick={() => command({ type: 'REVEAL_ANSWER' })}>Reveal Result</button></>}
    {round.phase === 'answer_revealed' && <p role="status">Result and match identity revealed. Advance when ready to choose the next challenge.</p>}
    {(round.phase === 'answer_revealed' || (round.phase === 'adjudicated' && round.outcome === 'void')) && <>
      <p>Advance keeps the selected contestant and saved scores. Between rounds, you can switch contestants or choose another tier. It does not prepare or reveal another screenshot.</p>
      <button type="button" className={pageStyles.primary} disabled={!can('ADVANCE')} onClick={() => command({ type: 'ADVANCE' })}>Advance</button>
    </>}
    {(round.phase === 'preparing' || round.phase === 'ready') && <button type="button" disabled={!can('CANCEL_UNEXPOSED')} onClick={() => command({ type: 'CANCEL_UNEXPOSED' })}>Cancel preparation</button>}
    </HostActionArea>
    {['guessing', 'paused', 'awaiting_judgment'].includes(round.phase) && <details className={styles.options}><summary>Round options · Skip / Void</summary><div className={styles.optionFields}>
      <label>Skip / Void reason<select value={reason} disabled={!can('VOID_EXPOSED')} onChange={(e) => setReason(e.target.value as 'skip' | 'void')}><option value="skip">Skip · contestant passed</option><option value="void">Void · invalid or abandoned clue</option></select></label>
      <button disabled={!can('VOID_EXPOSED')} onClick={() => command({ type: 'VOID_EXPOSED', reason })}>Skip / Void · zero points</button>
    </div></details>}

  </section>;
}

/** One action surface; sizing observes presentation only, never game timing. */
export function HostActionArea({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [flow, setFlow] = useState(true);
  useLayoutEffect(() => {
    const element = ref.current!;
    const measure = () => {
      const height = window.visualViewport?.height ?? window.innerHeight;
      setFlow(height <= 600 || element.offsetHeight > height * 0.4 || parseFloat(getComputedStyle(element).fontSize) > 20);
    };
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    // Text-size changes can alter the surrounding console while action content
    // retains its minimum height. Observe the document's layout as well.
    observer?.observe(element); observer?.observe(document.documentElement); measure();
    window.addEventListener('resize', measure); window.visualViewport?.addEventListener('resize', measure);
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); window.visualViewport?.removeEventListener('resize', measure); };
  }, []);
  return <div ref={ref} className={styles.actionArea} data-flow={flow} data-host-actions aria-describedby="game-command-blockers">{children}</div>;
}
