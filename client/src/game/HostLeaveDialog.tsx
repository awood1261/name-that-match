import { useEffect, useRef } from 'react';
import styles from './HostPage.module.css';

export function HostLeaveDialog({ busy, blocked, guessing, error, onStay, onLeave }: {
  busy: boolean; blocked: boolean; guessing: boolean; error: string; onStay: () => void; onLeave: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null; const dialog = ref.current!;
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
    dialog.querySelector<HTMLButtonElement>('[data-stay]')?.focus();
    return () => { if (typeof dialog.close === 'function') dialog.close(); trigger?.focus(); };
  }, []);
  return <dialog ref={ref} className={styles.leaveDialog} aria-labelledby="host-leave-title" onCancel={(event) => { event.preventDefault(); if (!busy) onStay(); }} onKeyDown={(event) => {
    if (event.key === 'Escape') { event.preventDefault(); if (!busy) onStay(); }
    if (event.key === 'Tab') {
      const buttons = Array.from(ref.current!.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
      if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons[buttons.length - 1]?.focus(); }
      else if (!event.shiftKey && document.activeElement === buttons[buttons.length - 1]) { event.preventDefault(); buttons[0]?.focus(); }
    }
  }}>
    <h2 id="host-leave-title">Leave game host?</h2>
    <p>{guessing ? 'Stay to keep hosting, or pause the round before leaving. The server preserves only its actual remaining time.' : 'The round is no longer guessing. The server state will be checked before leaving.'}</p>
    {blocked && <p>Stay to reconnect or review the pending command receipt before leaving. Navigation cannot resolve an uncertain request.</p>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <div className={styles.actions}><button type="button" data-stay disabled={busy} onClick={onStay}>Stay</button>
      <button type="button" className={styles.primary} disabled={busy || blocked} onClick={onLeave}>{guessing ? 'Pause and leave' : 'Leave'}</button></div>
  </dialog>;
}
