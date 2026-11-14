import type { ReactNode } from 'react';
import type { useGameHost } from './useGameHost';
import styles from './HostRecoveryPanel.module.css';

type RecoveryHost = Pick<ReturnType<typeof useGameHost>, 'loading' | 'busy' | 'connected' | 'credential' | 'pending' | 'error' | 'notice' | 'retryable' | 'reviewedPending' | 'connect' | 'checkPending' | 'retry' | 'dismissPending'>;

/** Presentation only: all recovery decisions and requests remain in useGameHost. */
export function HostRecoveryPanel({ host, children }: { host: RecoveryHost; children?: ReactNode }) {
  return <div id="game-command-blockers" className={styles.recovery} aria-label="Game connection and command status">
    {host.loading ? <p role="status">Connecting to game server…</p> : !host.connected && host.credential ? <p role="status" className={styles.warning}>Host live connection lost. Waiting to reconnect.</p> : null}
    {host.busy && <p role="status">Saving command…</p>}
    {host.error && <p role="alert" className={styles.error}>{host.error}</p>}
    {host.notice && <p role="status" className={styles.notice}>{host.notice}</p>}
    {children}
    {host.pending && <>
      <p className={styles.warning}>A previous command needs review. New commands are blocked until its outcome is resolved.</p>
      <button type="button" disabled={host.busy || !host.credential} onClick={() => { void host.checkPending(); }}>Check command status</button>
      {host.retryable && <button type="button" disabled={host.busy} onClick={host.retry}>Retry original request</button>}
      <button type="button" disabled={host.busy || !host.reviewedPending} onClick={host.dismissPending}>Dismiss request after review</button>
    </>}
    {!host.loading && (!host.credential || !host.connected) && <button type="button" disabled={host.busy} onClick={() => { void host.connect(); }}>Take host control / reconnect</button>}
  </div>;
}
