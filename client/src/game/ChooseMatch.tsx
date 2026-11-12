import { GAME_TIERS, GAME_TIER_DETAILS } from '../../../shared/src/classification';
import scene from './ContestantScene.module.css';
import styles from './ChooseMatch.module.css';

export function ChooseMatch() {
  return <section className={`${scene.scene} ${scene.entrance} ${styles.choose}`} aria-labelledby="choose-match-title">
    <img className={scene.logo} src="/images/name-that-match-horizontal-logo.png" alt="Name That Match" />
    <h1 className={scene.title} id="choose-match-title">CHOOSE YOUR MATCH</h1>
    <ul className={styles.cards} aria-label="Match difficulty tiers">
      {GAME_TIERS.map((tier) => <li className={styles.card} data-tier={tier} key={tier}>
        <img className={styles.illustration} src={`/images/contestant/${tier === 'squash' ? 'squash-match' : tier === 'competitive' ? 'competitive-match' : 'deathmatch'}.svg`} alt="" aria-hidden="true" draggable={false} width={400} height={300} />
        <h2 className={styles.label}>{GAME_TIER_DETAILS[tier].label.split(' ').map((word) => <span key={word}>{word}</span>)}</h2>
        <p className={styles.points}>{GAME_TIER_DETAILS[tier].points} {GAME_TIER_DETAILS[tier].points === 1 ? 'POINT' : 'POINTS'}</p>
      </li>)}
    </ul>
  </section>;
}
