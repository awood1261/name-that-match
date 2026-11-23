import { useEffect, useState, type CSSProperties } from 'react';
import { GAME_TIERS, GAME_TIER_DETAILS, type GameTier } from '../../../shared/src/classification';
import scene from './ContestantScene.module.css';
import styles from './SelectingMatch.module.css';

const illustrations: Record<GameTier, string> = {
  squash: 'squash-match', competitive: 'competitive-match', deathmatch: 'deathmatch',
};
const offsets = [-3, -2, -1, 0, 1, 2, 3];
const leadInOffsets = [-14, -13, -12, -11, -10, -9, -8, -7, -6, -5, -4];
const steps = ['IDENTIFYING WRESTLERS', 'ANALYZING EVENT', 'DETERMINING DIFFICULTY', 'SELECTING MATCH...'];
const shufflingMs = 900;
const deceleratingMs = 550;
const lockMs = 200;
const impactMs = 400;
const timeline = [
  { phase: 'shuffling', until: shufflingMs },
  { phase: 'decelerating', until: shufflingMs + deceleratingMs },
  { phase: 'locked', until: shufflingMs + deceleratingMs + lockMs },
  { phase: 'impact', until: shufflingMs + deceleratingMs + lockMs + impactMs },
] as const;
type SelectionPhase = typeof timeline[number]['phase'] | 'complete';
const timingStyle = {
  '--shuffle-duration': `${shufflingMs}ms`,
  '--deceleration-duration': `${deceleratingMs}ms`,
  '--lock-duration': `${lockMs}ms`,
  '--impact-duration': `${impactMs}ms`,
} as CSSProperties;
const motionQuery = '(prefers-reduced-motion: reduce)';

function useSelectionPhase(intro: boolean): SelectionPhase {
  const [phase, setPhase] = useState<SelectionPhase>(() =>
    intro && !window.matchMedia?.(motionQuery).matches ? 'shuffling' : 'complete');

  useEffect(() => {
    if (!intro) return;
    const preference = window.matchMedia?.(motionQuery);
    if (preference?.matches) {
      setPhase('complete');
      return;
    }
    const start = performance.now();
    let timer: number | undefined;
    function update() {
      window.clearTimeout(timer);
      const elapsed = performance.now() - start;
      const current = timeline.find(entry => elapsed < entry.until);
      setPhase(current?.phase ?? 'complete');
      if (current) timer = window.setTimeout(update, current.until - elapsed);
      else stop();
    }
    function resumeVisible() {
      if (!document.hidden) update();
    }
    function settleForReducedMotion(event: MediaQueryListEvent) {
      if (!event.matches) return;
      stop();
      setPhase('complete');
    }
    function stop() {
      window.clearTimeout(timer);
      preference?.removeEventListener('change', settleForReducedMotion);
      document.removeEventListener('visibilitychange', resumeVisible);
    }
    preference?.addEventListener('change', settleForReducedMotion);
    document.addEventListener('visibilitychange', resumeVisible);
    update();
    return stop;
  }, [intro]);

  return intro ? phase : 'complete';
}

/** Theatrical local artwork only: neither a clue preview nor actual analysis. */
export function SelectingMatch({ intro, tier }: { intro: boolean; tier: GameTier }) {
  const phase = useSelectionPhase(intro);
  const moving = phase === 'shuffling' || phase === 'decelerating';
  const targetIndex = GAME_TIERS.indexOf(tier);
  return <section className={`${scene.scene} ${styles.selecting}`} data-intro={intro} data-selection-phase={phase} data-selected-tier={tier}
    style={timingStyle} aria-labelledby="selecting-match-title">
    <img className={scene.logo} src="/images/name-that-match-horizontal-logo.png" alt="Name That Match" />
    <h1 className={scene.title} id="selecting-match-title">SELECTING MATCH...</h1>
    <p className={scene.srOnly}>Match selection presentation; waiting for host reveal. The animation does not perform wrestler recognition or metadata analysis.</p>
    <div className={styles.carousel}>
      <div className={styles.reel}>{(moving ? [...leadInOffsets, ...offsets] : offsets).map(offset => {
        const tierCount = GAME_TIERS.length;
        const cardTier = GAME_TIERS[((targetIndex + offset) % tierCount + tierCount) % tierCount];
        const selected = offset === 0 && !moving;
        const leadIn = offset < -3;
        return <div className={leadIn ? `${styles.card} ${styles.leadIn}` : styles.card}
          style={leadIn ? { '--lead-in-slot': offset } as CSSProperties : undefined}
          data-offset={offset} data-tier={cardTier} data-center={selected} aria-hidden={!selected} key={offset}>
          <img src={`/images/contestant/${illustrations[cardTier]}.svg`} alt="" draggable={false} width={400} height={300} />
          <p className={styles.label}>{selected && <span className={scene.srOnly}>Selected difficulty: </span>}{GAME_TIER_DETAILS[cardTier].label.toUpperCase()}</p>
        </div>;
      })}</div>
    </div>
    <div className={styles.processing} aria-hidden="true">
      <div className={styles.scan}>
        <div className={styles.scanHeading}><span className={styles.magnifier} />SCANNING MATCH DATA</div>
        <div className={styles.track}><div className={styles.fill} /></div>
      </div>
      <ol className={styles.checklist}>{steps.map((step) => <li key={step}><span className={styles.stepIcon} />{step}</li>)}</ol>
    </div>
  </section>;
}
