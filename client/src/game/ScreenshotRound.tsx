import { GAME_TIER_DETAILS, type GameTier } from '../../../shared/src/classification';
import { Countdown } from './Countdown';
import scene from './ContestantScene.module.css';
import styles from './ScreenshotRound.module.css';

export function ScreenshotRound({ imageUrl, turnOrdinal, tier, remaining, onImageError }: { imageUrl: string; turnOrdinal: number; tier: GameTier; remaining: { ms: number; at: number }; onImageError: () => void }) {
  return <section className={`${scene.scene} ${styles.round}`} aria-label="Screenshot and countdown">
    <img className={scene.logo} src="/images/name-that-match-horizontal-logo.png" alt="Name That Match" />
    <h1 className={scene.srOnly}>Name that match!</h1>
    <div className={styles.clue}><img src={imageUrl} alt="Current wrestling match clue" onError={onImageError} /></div>
    <div className={styles.strip}>
      <p className={styles.ordinal}>ROUND {turnOrdinal.toString().padStart(2, '0')}</p>
      <p className={styles.tier}>{GAME_TIER_DETAILS[tier].label}</p>
      <div className={styles.timer}><Countdown remainingMs={remaining.ms} observedAt={remaining.at} running format="clock" /></div>
    </div>
  </section>;
}
