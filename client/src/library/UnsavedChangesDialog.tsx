import { useEffect, useRef } from 'react';
import styles from './Library.module.css';
export function UnsavedChangesDialog({ busy, error, onSave, onDiscard, onStay }: { busy: boolean; error: string; onSave: () => void; onDiscard: () => void; onStay: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null; const dialog = ref.current!;
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
    dialog.querySelector<HTMLButtonElement>('[data-stay]')?.focus();
    return () => { if (typeof dialog.close === 'function') dialog.close(); trigger?.focus(); };
  }, []);
  return <dialog ref={ref} className={styles.dialog} aria-labelledby="unsaved-title" onCancel={(event) => { event.preventDefault(); if (!busy) onStay(); }} onKeyDown={(event) => {
    if (event.key === 'Escape') { event.preventDefault(); if (!busy) onStay(); }
    if (event.key === 'Tab') {
      const buttons = Array.from(ref.current!.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
      if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons[buttons.length - 1]?.focus(); }
      else if (!event.shiftKey && document.activeElement === buttons[buttons.length - 1]) { event.preventDefault(); buttons[0]?.focus(); }
    }
  }}>
    <h2 id="unsaved-title">Unsaved changes</h2><p>Save the affected drafts before continuing, discard them, or stay here.</p>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <div className={styles.actions}><button disabled={busy} className={styles.primary} onClick={onSave}>Save and continue</button><button disabled={busy} onClick={onDiscard}>Discard and continue</button><button data-stay disabled={busy} onClick={onStay}>Stay</button></div>
  </dialog>;
}
