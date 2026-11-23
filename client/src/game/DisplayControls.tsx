import { useEffect, useId, useRef, useState } from 'react';
import styles from './DisplayControls.module.css';

/** Presentation preferences only. This component has no game command capability. */
export function DisplayControls({ guides, onGuides }: { guides: boolean; onGuides: (value: boolean) => void }) {
  const helpId = useId();
  const [fullscreen, setFullscreen] = useState(false);
  const [notice, setNotice] = useState(''); const [busy, setBusy] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    const changed = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', changed); changed();
    return () => { mounted.current = false; document.removeEventListener('fullscreenchange', changed); };
  }, []);
  async function toggle() {
    if (busy) return;
    setBusy(true); setNotice('');
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      else throw new Error('Fullscreen unavailable');
    } catch { if (mounted.current) setNotice('Fullscreen is unavailable or was refused. Keep using this window; move it to the display manually.'); }
    finally { if (mounted.current) setBusy(false); }
  }
  return <aside className={styles.controls} aria-label="Display presentation controls">
    <button type="button" disabled={busy} aria-describedby={helpId} onClick={() => { void toggle(); }}>
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5" /></svg>
      <span className={styles.visuallyHidden}>{fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}</span>
    </button>
    <button type="button" aria-pressed={guides} onClick={() => onGuides(!guides)}>
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 3H3v4m14-4h4v4M3 17v4h4m10 0h4v-4M12 8v8m-4-4h8" /></svg>
      <span className={styles.visuallyHidden}>Safe-area guides</span>
    </button>
    <p id={helpId} role="status" className={notice ? undefined : styles.visuallyHidden}>{notice || 'Move this window to your display. Fullscreen is optional; Escape exits fullscreen.'}</p>
  </aside>;
}
