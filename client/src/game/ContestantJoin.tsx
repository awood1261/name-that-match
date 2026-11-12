import { useCallback, useEffect, useRef, useState } from 'react';
import type { ControllerCredential } from '../../../shared/src/game/host';
import type { DisplayOriginObservation } from '../../../shared/src/game/join';
import { gameApi, GameApiError } from './api';
import { contestantQr, withDisplayOrigin } from './qr';
import styles from './ContestantJoin.module.css';

/** Address/QR observations never register a viewer or issue a game command. */
export function ContestantJoin({ localLink, credential, disabled }: { localLink: string; credential: ControllerCredential; disabled: boolean }) {
  const [observation, setObservation] = useState<DisplayOriginObservation | null>(null);
  const [manualOrigin, setManualOrigin] = useState(''); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(''); const [qr, setQr] = useState<{ url: string; image: string } | null>(null);
  const [launchNotice, setLaunchNotice] = useState('');
  const request = useRef<AbortController | null>(null); const generation = useRef(0);
  const link = observation?.ready ? withDisplayOrigin(localLink, observation.origin) : localLink;
  const observe = useCallback(async (refresh: boolean, manual?: string) => {
    request.current?.abort(); const controller = request.current = new AbortController(); const current = ++generation.current;
    const timeout = setTimeout(() => controller.abort(), 2500);
    setBusy(true); setError(''); setObservation(null); setQr(null);
    try {
      const next = await gameApi.displayOrigin(credential, { uiOrigin: location.origin, refresh, ...(manual ? { manualOrigin: manual } : {}) }, controller.signal);
      if (!controller.signal.aborted && generation.current === current) setObservation(next);
    } catch (failure) { if (generation.current === current) setError(failure instanceof GameApiError ? failure.message : 'LAN address could not be checked. Refresh or enter a configured manual origin; the local-tab link still works.'); }
    finally { clearTimeout(timeout); if (generation.current === current) setBusy(false); }
  }, [credential]);
  const cancel = useCallback(() => { generation.current++; request.current?.abort(); }, []);
  useEffect(() => {
    const timer = setTimeout(() => { void observe(false); }, 0);
    return () => { clearTimeout(timer); cancel(); };
  }, [observe, cancel]);
  useEffect(() => {
    let current = true; setQr(null);
    if (observation?.ready) void contestantQr(link).then((image) => { if (current) setQr({ url: link, image }); }).catch(() => { if (current) setError('QR generation failed. Copy the contestant display link instead.'); });
    return () => { current = false; };
  }, [link, observation]);
  return <section className={styles.join} aria-label="Contestant joining">
    <button type="button" disabled={disabled} onClick={() => {
      try {
        window.open(localLink, '_blank', 'noopener,noreferrer');
        setLaunchNotice('Open requested. If no window appeared, allow popups or copy the link below into a separate tab. Move the viewer to your display and choose Enter fullscreen there. Connection status determines readiness.');
      } catch { setLaunchNotice('The browser could not open the display. Copy the link below into a separate tab.'); }
    }}>Open contestant display</button>
    {launchNotice && <p role="status">{launchNotice}</p>}
    <label>Contestant display link<input readOnly value={link} onFocus={(event) => event.target.select()} /></label>
    <p role="status">{busy ? 'Checking LAN address…' : observation?.message ?? 'Local-tab link. LAN access has not been verified.'}</p>
    <p>{observation?.ready ? 'Scan with the other device on the same local Wi-Fi, or copy this read-only link.' : 'Local tab only: this fallback is not advertised for another device.'}</p>
    {observation?.ready && qr?.url === link && <img className={styles.qr} src={qr.image} alt="QR code for the contestant display link" />}
    {observation?.ready && !qr && !error && <p role="status">Generating QR code…</p>}
    <div className={styles.controls}>
      <button type="button" disabled={disabled || busy} onClick={() => { void observe(true); }}>Refresh LAN address</button>
      <form onSubmit={(event) => { event.preventDefault(); void observe(false, manualOrigin.trim()); }}>
        <label>Manual LAN origin<input type="url" placeholder="http://192.168.1.50:5173" value={manualOrigin} onChange={(event) => setManualOrigin(event.target.value)} disabled={disabled || busy} required /></label>
        <button type="submit" disabled={disabled || busy || !manualOrigin.trim()}>Use manual origin</button>
      </form>
    </div>
    {error && <p role="alert">{error}</p>}
  </section>;
}
