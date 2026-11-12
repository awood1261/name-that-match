import { useEffect, useState } from 'react';
import { countdownSeconds } from './clock';

export function Countdown({ remainingMs, running, observedAt = performance.now(), format = 'seconds' }: { remainingMs: number; running: boolean; observedAt?: number; format?: 'seconds' | 'clock' }) {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    setNow(performance.now()); if (!running) return;
    const timer = setInterval(() => setNow(performance.now()), 50); return () => clearInterval(timer);
  }, [remainingMs, running, observedAt]);
  const seconds = countdownSeconds(remainingMs - (running ? Math.max(0, now - observedAt) : 0));
  const text = format === 'clock' ? `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}` : seconds.toString().padStart(2, '0');
  return <span role="timer" aria-live="off" data-urgent={format === 'clock' && seconds <= 3} aria-label={`${seconds} seconds remaining${format === 'clock' && seconds <= 3 ? '; final seconds' : ''}`}>{text}</span>;
}
