import { useEffect, useState } from 'react';
import { GAME_TIERS, GAME_TIER_DETAILS, type GameTier } from '../../../shared/src/classification';
import { clientId } from '../ids';
import { useGameHost } from './useGameHost';
import { HostSetup } from './HostSetup';
import { HostDisplayPanel } from './HostDisplayPanel';
import { HostRoundControls } from './HostRoundControls';
import { GameScoreboard } from './GameScoreboard';
import styles from './HostPage.module.css';

export function HostPage() {
  const host = useGameHost(); const [tier, setTier] = useState<GameTier>('squash'); const [setupDirty, setSetupDirty] = useState(false);
  const snapshot = host.status?.snapshot; const session = snapshot?.session ?? null; const round = snapshot?.currentRound;
  const requestedTier = round?.requestedTier;
  // Retain the observed round's tier across Advance/Cancel, including after reload.
  useEffect(() => { if (requestedTier) setTier(requestedTier); }, [requestedTier]);
  const can = (action: string) => !!host.credential && host.connected && !host.busy && !host.pending && !!host.status?.allowedActions.some((a) => a === action);
  const active = session?.contestants.find((p) => p.id === session.activeContestantId);
  const unexposed = round?.phase === 'preparing' || round?.phase === 'ready';
  const roundOwner = session?.contestants.find((p) => p.id === round?.contestantId);
  const stateLabel = !session ? 'No session' : session.status === 'completed' ? 'Game complete' : session.status === 'setup' ? 'Setup' : round?.phase === 'preparing' ? 'Preparing screenshot'
    : round?.phase === 'ready' ? 'Screenshot ready · hidden' : session.status === 'active' && !round ? 'Between rounds' : round?.phase.split('_').join(' ') ?? session.status;
  return <section className={styles.host} aria-labelledby="game-host-title">
    <header className={styles.header}><div><p className={styles.kicker}>Play · host controls</p><h2 id="game-host-title">Game host</h2></div>
      {host.credential && <button type="button" disabled={host.busy || host.pending} onClick={() => { void host.release(); }}>Release host control</button>}
    </header>
    <p className={styles.state} role="status">{host.loading ? 'Connecting to game server…' : host.busy ? 'Saving command…' : stateLabel}</p>
    {host.error && <p role="alert" className={styles.error}>{host.error}</p>}
    {host.notice && <p role="status" className={styles.success}>{host.notice}</p>}
    {host.pending && <div className={styles.card}>
      <p>A previous command needs review. New commands are blocked until its outcome is resolved.</p>
      <button type="button" disabled={host.busy || !host.credential} onClick={() => { void host.checkPending(); }}>Check command status</button>
      {host.retryable && <button type="button" disabled={host.busy} onClick={host.retry}>Retry original request</button>}
      <button type="button" disabled={host.busy || !host.reviewedPending} onClick={host.dismissPending}>Dismiss request after review</button>
    </div>}
    {!host.loading && !host.credential && <button type="button" className={styles.primary} onClick={() => { void host.connect(); }}>Take host control / reconnect</button>}
    {host.credential && host.status && <>
      {session && <HostDisplayPanel key={`${session.id}:${host.credential!.serverEpoch}`} credential={host.credential!} status={host.status} disabled={host.busy || host.pending || !host.connected} refresh={host.refresh} />}
      {snapshot && session?.status !== 'discarded' && <GameScoreboard scores={snapshot.scores} activeContestantId={snapshot.session.activeContestantId}
        turnsExposed={snapshot.session.nextTurnOrdinal - 1} currentTurn={round && 'turnOrdinal' in round ? { turnOrdinal: round.turnOrdinal, contestantId: round.contestantId } : null}
        winnerIds={snapshot.winnerIds} privateView />}
      <div className={styles.grid}>
        {(!session || session.status === 'setup') && <HostSetup key={session ? `${session.id}:${session.stateVersion}` : 'new'} session={session} disabled={host.busy || host.pending} onSave={host.setup} onDirty={setSetupDirty} />}
        {session && <section className={styles.card} aria-labelledby="game-session-title">
          <h3 id="game-session-title">Current session</h3><p className={styles.sessionId}>Session {session.id}</p>
          <p><strong>Active contestant: {active?.name}</strong></p>
          <label htmlFor="game-active-contestant">Switch contestant</label>
          <select id="game-active-contestant" value={session.activeContestantId} disabled={!can('SELECT_CONTESTANT')}
            onChange={(event) => host.command({ type: 'SELECT_CONTESTANT', contestantId: event.target.value })}>
            {session.contestants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <p>{session.status === 'setup' ? 'Choose the starting contestant in setup.' : round ? unexposed ? 'Cancel the unexposed preparation before changing contestants.' : 'This round keeps its original contestant. Switching is available between rounds.' : 'The selected contestant stays active until you change this selection.'}</p>
          {session.status === 'setup' && <div className={styles.actions}>
            <button type="button" className={styles.primary} disabled={!can('START') || setupDirty} onClick={() => host.command({ type: 'START' })}>Start game</button>
            <button type="button" disabled={!can('DISCARD_SETUP')} onClick={() => { if (window.confirm('Discard this setup? Your Image Library will be kept.')) host.command({ type: 'DISCARD_SETUP' }); }}>Discard setup</button>
          </div>}
          {session.status === 'setup' && setupDirty && <p>Save setup before starting the game.</p>}
          {session.status === 'setup' && !host.status.availability.distinctMatches && <p>No eligible matches are available. Approve and classify screenshots in Image Library, then refresh availability.</p>}
          {host.status.availability.distinctMatches < session.contestants.length && host.status.availability.distinctMatches > 0 && <p className={styles.warning}>There are fewer distinct eligible matches than contestants. Equal turns are not guaranteed.</p>}
        </section>}
      </div>
      <section className={styles.card} aria-labelledby="game-tier-title">
        <div className={styles.header}><h3 id="game-tier-title">Choose a game tier</h3><button type="button" disabled={host.busy} onClick={() => { void host.refresh(); }}>Refresh availability</button></div>
        <fieldset className={styles.tiers} disabled={!can('PREPARE')}><legend>Requested tier</legend>
          {GAME_TIERS.map((value) => <label className={styles.tier} key={value}>
            <input type="radio" name="game-tier" value={value} checked={(round?.requestedTier ?? tier) === value} onChange={() => setTier(value)} />
            <strong>{GAME_TIER_DETAILS[value].label} — {GAME_TIER_DETAILS[value].points} {GAME_TIER_DETAILS[value].points === 1 ? 'point' : 'points'}</strong>
            <span>{host.status!.availability.tiers[value].screenshots} eligible {host.status!.availability.tiers[value].screenshots === 1 ? 'screenshot' : 'screenshots'} · {host.status!.availability.tiers[value].matches} distinct {host.status!.availability.tiers[value].matches === 1 ? 'match' : 'matches'}</span>
          </label>)}
        </fieldset>
        <p>Available this game: approved screenshots with complete match details, both classifications and a valid image. Matches or identical images already shown in this game are excluded. Classified screenshots still pending review are not eligible.</p>
        <p>Counts reflect the last server assessment. After library changes, use Refresh availability. Matches can appear in more than one tier; counts are not a guaranteed number of rounds.</p>
        {session?.status === 'active' && !round && host.status.availability.tiers[tier].screenshots === 0 && <p className={styles.warning}>No eligible unseen screenshots in this tier. Choose another tier or review the library.</p>}
        <button className={styles.primary} type="button" disabled={!can('PREPARE') || !host.status.availability.tiers[tier].screenshots}
          onClick={() => host.command({ type: 'PREPARE', roundId: clientId(), tier })}>Prepare screenshot</button>
      </section>
      {round && <section className={styles.card} aria-labelledby="game-round-title">
        <h3 id="game-round-title">{round.phase === 'preparing' ? 'Preparing a verified screenshot…' : unexposed ? 'Prepared round' : 'Current round'}</h3>
        <p>Assigned contestant: <strong>{roundOwner?.name}</strong> · {GAME_TIER_DETAILS[round.requestedTier].label}</p>
        <p>{unexposed ? 'The screenshot remains hidden. Preparation does not start the countdown or consume a match.' : 'This exposed round retains its history and contestant. The server controls its time and outcome.'}</p>
        {round.phase === 'ready' && <><p className={styles.cover}>Screenshot stays hidden until Reveal</p>
          {!host.status.candidateValid && <p className={styles.warning}>The prepared record changed or needs revalidation. Cancel and prepare again.</p>}
        </>}
        {'context' in round && round.context && <details><summary>Private host answer</summary><p>{round.context.answer.participantDescription} · {round.context.answer.promotion} · {round.context.answer.event}</p></details>}
        {unexposed && <button type="button" disabled={!can('CANCEL_UNEXPOSED')} onClick={() => host.command({ type: 'CANCEL_UNEXPOSED' })}>Cancel preparation</button>}
        <HostRoundControls status={host.status} can={can} command={host.command} />
      </section>}
      {host.status.preparationError && <p role="alert" className={styles.error}>{host.status.preparationError}</p>}
    </>}
  </section>;
}
