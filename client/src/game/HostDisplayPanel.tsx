import { useEffect, useRef, useState } from 'react';
import type { ControllerCredential, HostStatus } from '../../../shared/src/game/host';
import { gameApi, GAME_REQUEST_TIMEOUT_MS } from './api';
import { ContestantJoin } from './ContestantJoin';
import styles from './HostPage.module.css';

export function HostDisplayPanel({ credential, status, disabled, refresh }: { credential: ControllerCredential; status: HostStatus; disabled: boolean; refresh: () => Promise<void> }) {
  const session = status.snapshot?.session;
  const [primary, setPrimary] = useState(true); const [link, setLink] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const round = status.snapshot?.currentRound;
  const canDesignate = !round || round.phase === 'paused';
  async function register() {
    if (!session || busy) return; setBusy(true); setError('');
    const controller = request.current = new AbortController(); const timeout = setTimeout(() => controller.abort(), GAME_REQUEST_TIMEOUT_MS);
    try {
      const viewer = await gameApi.registerDisplay(credential, session.id, primary, controller.signal);
      if (controller.signal.aborted) return;
      setLink(`${location.origin}/display/${session.id}#${new URLSearchParams({ display: viewer.displayId, token: viewer.token, epoch: viewer.serverEpoch })}`);
      await refresh();
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Cannot register display.'); }
    finally { clearTimeout(timeout); setBusy(false); }
  }
  async function designate(displayId: string) {
    if (!session || busy) return; setBusy(true); setError('');
    const controller = request.current = new AbortController(); const timeout = setTimeout(() => controller.abort(), GAME_REQUEST_TIMEOUT_MS);
    try { await gameApi.designateDisplay(credential, session.id, displayId, controller.signal); await refresh(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Cannot designate display.'); }
    finally { clearTimeout(timeout); setBusy(false); }
  }
  return <section className={styles.card} aria-labelledby="display-connection-title"><h3 id="display-connection-title">Contestant display connection</h3>
    <p role="status">{status.primaryDisplay.message}</p>
    <label className={styles.connectionToggle}><input type="checkbox" checked={primary} disabled={disabled || busy} onChange={(e) => setPrimary(e.target.checked)} /> Use new link as the primary display</label>
    <button type="button" disabled={disabled || busy || !session || (primary && !canDesignate)} onClick={() => { void register(); }}>Create contestant display link</button>
    {!canDesignate && <p>Cancel preparation, or pause an exposed round, before changing the primary display.</p>}
    {link && <ContestantJoin key={link} localLink={link} credential={credential} disabled={disabled || busy} />}
    {status.primaryDisplay.displays?.map((display, i) => <p key={display.displayId}>Display {i + 1} · {display.primary ? 'Primary' : 'Secondary'} · {display.connected ? 'Connected' : 'Disconnected'} · {display.ready ? 'Decoded and synchronized' : 'Not ready'} {!display.primary && <button disabled={disabled || busy || !canDesignate} onClick={() => { void designate(display.displayId); }}>Make display {i + 1} primary</button>}</p>)}
    {error && <p role="alert">{error}</p>}
  </section>;
}
