import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import styles from './ContestantStage.module.css';

/** Geometry only; timing and phase ownership stay with the existing display hook. */
export function ContestantStage({ children, guides }: { children: ReactNode; guides: boolean }) {
  const viewport = useRef<HTMLDivElement>(null); const stage = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  useLayoutEffect(() => {
    const container = viewport.current!; const content = stage.current!;
    const measure = () => {
      if (!content.offsetWidth || !content.offsetHeight) return;
      setScale(Math.max(0, Math.min(container.clientWidth / content.offsetWidth, container.clientHeight / content.offsetHeight)));
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(container); window.addEventListener('resize', measure);
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
  }, []);
  return <div className={styles.viewport} ref={viewport}>
    <div className={styles.stage} ref={stage} data-contestant-stage data-guides={guides} style={{ '--stage-scale': scale } as CSSProperties}>
      {children}
    </div>
  </div>;
}
