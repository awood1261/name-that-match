import { useEffect, useState } from 'react';
import { isHealthResponse, type HealthResponse } from '../../shared/src/health';
import styles from './App.module.css';

const EMPTY_HEALTH: HealthResponse = {
  status: 'ok',
  service: 'not-connected',
  timestamp: new Date().toISOString(),
};

function App() {
  const [health, setHealth] = useState<HealthResponse>(EMPTY_HEALTH);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);

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
      <section className={styles.stage} aria-live="polite">
        <header className={styles.header}>
          <span className={styles.kicker}>Local foundation</span>
          <h1>Name That Match</h1>
        </header>

        <div className={styles.statusPanel}>
          <p className={styles.label}>Local server</p>
          {loading ? (
            <p className={styles.status}>Checking connection…</p>
          ) : connected ? (
            <p className={styles.statusConnected}>Connected</p>
          ) : (
            <p className={styles.statusOffline}>Server unavailable</p>
          )}
          <p className={styles.meta}>
            {connected
              ? `${health.service} • ${new Date(health.timestamp).toLocaleTimeString()}`
              : 'Waiting for the local Node server to respond.'}
          </p>
        </div>
      </section>
    </main>
  );
}

export default App;
