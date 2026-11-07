import { useEffect, useState } from 'react';
import { isHealthResponse, type HealthResponse } from '../../shared/src/health';
import styles from './App.module.css';
import { MatchLibraryPage } from './library/MatchLibraryPage';

const EMPTY_HEALTH: HealthResponse = {
  status: 'ok',
  service: 'not-connected',
  timestamp: new Date().toISOString(),
};

const navItems = ['Play', 'Image Library', 'Game Settings', 'System'];

function App() {
  const [health, setHealth] = useState<HealthResponse>(EMPTY_HEALTH);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('System');

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const response = await fetch('/api/health');
        const payload = await response.json();

        if (response.ok && isHealthResponse(payload)) {
          setHealth(payload);
          setConnected(true);
        } else {
          setConnected(false);
          setHealth(EMPTY_HEALTH);
        }
      } catch {
        setConnected(false);
        setHealth(EMPTY_HEALTH);
      } finally {
        setLoading(false);
      }
    };

    void fetchHealth();
  }, []);

  return (
    <main className={styles.appShell}>
      <header className={styles.topBar}>
        <div className={styles.brandBlock}>
          <span className={styles.brandFrame} aria-hidden="true" />
          <div className={styles.brandCopy}>
            <h1 className={styles.brand}>Name That <span>Match</span></h1>
            <p className={styles.tagline}>THE WRESTLING GUESSING GAME</p>
          </div>
        </div>

        <nav className={styles.nav} aria-label="Primary navigation">
          {navItems.map((item) => (
            <button key={item} type="button" className={styles.navButton}
              disabled={item === 'Play' || item === 'Game Settings'}
              aria-current={view === item ? 'page' : undefined} onClick={() => setView(item)}>
              {item}
            </button>
          ))}
        </nav>

        <div className={styles.statusBadge} aria-live="polite">
          <span className={connected ? styles.statusDotOnline : styles.statusDotOffline} aria-hidden="true" />
          <span>{connected ? 'Local ready' : 'Offline'}</span>
        </div>
      </header>

      {view === 'Image Library' ? <MatchLibraryPage /> : <section className={styles.panel} aria-live="polite">
        <div className={styles.panelHeader}>
          <p className={styles.kicker}>Local server</p>
          <h2>System status</h2>
        </div>

        <div className={styles.statusGrid}>
          <div className={styles.statusCard}>
            <span className={styles.label}>Connection</span>
            {loading ? (
              <strong className={styles.statusValue}>Checking…</strong>
            ) : connected ? (
              <strong className={styles.statusValueOnline}>Connected</strong>
            ) : (
              <strong className={styles.statusValueOffline}>Server unavailable</strong>
            )}
          </div>

          <div className={styles.statusCard}>
            <span className={styles.label}>Runtime</span>
            <strong className={styles.statusValue}>
              {connected ? health.service : 'Awaiting response'}
            </strong>
          </div>
        </div>

        <p className={styles.meta}>
          {connected
            ? `Last heartbeat: ${new Date(health.timestamp).toLocaleTimeString()}`
            : 'Waiting for the local Node server to respond before the shell can finish booting.'}
        </p>
      </section>}
    </main>
  );
}

export default App;
