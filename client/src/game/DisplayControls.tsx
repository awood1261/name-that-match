import { useEffect, useRef, useState } from 'react';
import styles from './DisplayControls.module.css';

/** Presentation preferences only. This component has no game command capability. */
export function DisplayControls({ guides, onGuides }: { guides: boolean; onGuides: (value: boolean) => void }) {
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
    <button type="button" disabled={busy} onClick={() => { void toggle(); }}>{fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}</button>
    <button type="button" aria-pressed={guides} onClick={() => onGuides(!guides)}>Safe-area guides</button>
    <p role="status">{notice || 'Move this window to your display. Fullscreen is optional; Escape exits fullscreen.'}</p>
  </aside>;
}
