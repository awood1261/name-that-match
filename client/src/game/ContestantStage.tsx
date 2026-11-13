import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import styles from './ContestantStage.module.css';

/** Geometry only; timing and phase ownership stay with the existing display hook. */
export function ContestantStage({ children, guides, visual = false }: { children: ReactNode; guides: boolean; visual?: boolean }) {
  const viewport = useRef<HTMLDivElement>(null); const stage = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const [layout, setLayout] = useState<'legacy' | 'landscape' | 'compact'>(visual ? 'landscape' : 'legacy');
  useLayoutEffect(() => {
    const container = viewport.current!;
    const measure = () => {
      const compact = visual && container.clientWidth < container.clientHeight;
      const width = visual && !compact ? 1920 : 1080;
      const height = visual ? compact ? 1440 : 1080 : 960;
      setLayout(visual ? compact ? 'compact' : 'landscape' : 'legacy');
      setScale(Math.max(0, Math.min(container.clientWidth / width, container.clientHeight / height)));
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(container); window.addEventListener('resize', measure);
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
  }, [visual]);
  return <div className={styles.viewport} ref={viewport}>
    <div className={styles.stage} ref={stage} data-contestant-stage data-guides={guides} data-layout={layout} data-visual-scene={visual ? '' : undefined} style={{ '--stage-scale': scale } as CSSProperties}>
      {children}
    </div>
  </div>;
}
