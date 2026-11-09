import { useEffect, useState } from 'react';
import { countdownSeconds } from './clock';

export function Countdown({ remainingMs, running, observedAt = performance.now() }: { remainingMs: number; running: boolean; observedAt?: number }) {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    setNow(performance.now()); if (!running) return;
    const timer = setInterval(() => setNow(performance.now()), 50); return () => clearInterval(timer);
  }, [remainingMs, running, observedAt]);
  const seconds = countdownSeconds(remainingMs - (running ? Math.max(0, now - observedAt) : 0));
  return <span role="timer" aria-live="off" aria-label={`${seconds} seconds remaining`}>{seconds.toString().padStart(2, '0')}</span>;
}
