import scene from './ContestantScene.module.css';
import styles from './SelectingMatch.module.css';

const cards = ['squash-match', 'competitive-match', 'deathmatch', 'competitive-match', 'squash-match', 'deathmatch', 'competitive-match'];
const steps = ['IDENTIFYING WRESTLERS', 'ANALYZING EVENT', 'DETERMINING DIFFICULTY', 'SELECTING MATCH...'];

/** Theatrical local artwork only: neither a clue preview nor actual analysis. */
export function SelectingMatch({ intro }: { intro: boolean }) {
  return <section className={`${scene.scene} ${styles.selecting}`} data-intro={intro} aria-labelledby="selecting-match-title">
    <img className={scene.logo} src="/images/name-that-match-horizontal-logo.png" alt="Name That Match" />
    <h1 className={scene.title} id="selecting-match-title">SELECTING MATCH...</h1>
    <p className={scene.srOnly}>Match selection presentation; waiting for host reveal. The animation does not perform wrestler recognition or metadata analysis.</p>
    <div className={styles.carousel} aria-hidden="true">
      {cards.map((art, index) => <div className={styles.card} data-center={index === 3} key={index}>
        <img src={`/images/contestant/${art}.svg`} alt="" draggable={false} width={400} height={300} />
      </div>)}
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
