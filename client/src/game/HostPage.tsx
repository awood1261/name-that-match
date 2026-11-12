import { useEffect, useState } from 'react';
import { GAME_TIERS, GAME_TIER_DETAILS, type GameTier } from '../../../shared/src/classification';
import { clientId } from '../ids';
import { useGameHost } from './useGameHost';
import { HostSetup } from './HostSetup';
import { HostDisplayPanel } from './HostDisplayPanel';
import { HostRoundControls } from './HostRoundControls';
import { GameScoreboard } from './GameScoreboard';
import { stageAnswer } from './stageText';
import { HostLeaveDialog } from './HostLeaveDialog';
import type { NavigationGuard } from '../library/useMatchWorkspace';
import styles from './HostPage.module.css';

export function HostPage({ registerNavigationGuard }: { registerNavigationGuard?: (guard: NavigationGuard | null) => void }) {
  const host = useGameHost(); const [tier, setTier] = useState<GameTier>('squash'); const [setupDirty, setSetupDirty] = useState(false);
  const [destination, setDestination] = useState<(() => void) | null>(null); const [leaving, setLeaving] = useState(false); const [leaveError, setLeaveError] = useState('');
  const snapshot = host.status?.snapshot; const session = snapshot?.session ?? null; const round = snapshot?.currentRound;
  const requestedTier = round?.requestedTier;
  const answer = round && 'context' in round ? round.context?.answer : undefined;
  const preview = answer ? stageAnswer(answer) : undefined;
  // Retain the observed round's tier across Advance/Cancel, including after reload.
  useEffect(() => { if (requestedTier) setTier(requestedTier); }, [requestedTier]);
  const can = (action: string) => !!host.credential && host.connected && !host.busy && !host.pending && !!host.status?.allowedActions.some((a) => a === action);
  const active = session?.contestants.find((p) => p.id === session.activeContestantId);
  const unexposed = round?.phase === 'preparing' || round?.phase === 'ready';
  const roundOwner = session?.contestants.find((p) => p.id === round?.contestantId);
  const terminal = session?.status === 'completed' || session?.status === 'discarded';
  const guessing = session?.status === 'active' && round?.phase === 'guessing';
  const protectNavigation = (guessing && !host.released) || host.busy || host.pending;
  useEffect(() => {
    registerNavigationGuard?.((action) => { if (protectNavigation) { setLeaveError(''); setDestination(() => action); } else action(); });
    return () => registerNavigationGuard?.(null);
  });
  useEffect(() => {
    if (!protectNavigation) return;
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', unload); return () => window.removeEventListener('beforeunload', unload);
  }, [protectNavigation]);
  async function leave() {
    if (leaving || !destination) return; setLeaving(true); setLeaveError('');
    try {
      if (await host.prepareToLeave()) { const action = destination; setDestination(null); action(); }
      else setLeaveError('Stay on Play to review the current state or check the pending command receipt, then try leaving again.');
    } finally { setLeaving(false); }
  }
  const stateLabel = !session ? 'No session' : session.status === 'completed' ? 'Game complete' : session.status === 'setup' ? 'Setup' : round?.phase === 'preparing' ? 'Preparing screenshot'
    : round?.phase === 'ready' ? 'Screenshot ready · hidden' : session.status === 'active' && !round ? 'Between rounds' : round?.phase.split('_').join(' ') ?? session.status;
  return <section className={styles.host} aria-labelledby="game-host-title">
    <header className={styles.header}><div><p className={styles.kicker}>Play · host controls</p><h2 id="game-host-title">Game host</h2></div>
      {host.credential && <button type="button" disabled={host.busy || host.pending} onClick={() => { void host.release(); }}>Release host control</button>}
    </header>
    <p className={styles.state} role="status">{host.loading ? 'Connecting to game server…' : host.busy ? 'Saving command…' : stateLabel}</p>
    {host.error && <p role="alert" className={styles.error}>{host.error}</p>}
    {host.notice && <p role="status" className={styles.success}>{host.notice}</p>}
    {destination && <HostLeaveDialog busy={leaving} blocked={host.busy || host.pending || !host.connected || !host.credential} guessing={guessing}
      error={leaveError || host.error || ''} onStay={() => setDestination(null)} onLeave={() => { void leave(); }} />}
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
      {session?.status === 'active' && <section className={styles.card} aria-label="Game completion">
        <button type="button" disabled={!can('END_GAME')} onClick={() => { if (window.confirm('End this game and show final totals? This cannot be undone. Your results and Image Library will be kept.')) host.command({ type: 'END_GAME' }); }}>End game</button>
        <p>{can('END_GAME') ? 'End when you are ready. Final totals include every saved judgment, even if its result has not been revealed.' : unexposed ? 'Cancel preparation before ending the game.' : round && !['adjudicated', 'answer_revealed'].includes(round.phase) ? 'Resolve or void the current attempt before ending the game.' : 'Reconnect and resolve any pending request before ending the game.'}</p>
      </section>}
      {terminal && <section className={styles.card} aria-label="Completed game">
        <p>Session {session.id} · {session.status === 'completed' ? 'Final results are saved.' : 'Setup discarded.'}</p>
        <p>New game creates a separate setup with zero scores and no used matches. Contestant names are copied for review; starting the next game is a separate action.</p>
        <p>Existing contestant displays stay with this session. Create a fresh display link for the next game.</p>
        <button type="button" className={styles.primary} disabled={host.busy || host.pending || !host.connected} onClick={() => { if (window.confirm('Create a new game setup? This keeps the previous result and Image Library, with fresh scores and used-match history.')) { setTier('squash'); host.newGame(); } }}>New game</button>
      </section>}
      <div className={styles.grid}>
        {(!session || session.status === 'setup') && <HostSetup key={session ? `${session.id}:${session.stateVersion}` : 'new'} session={session} disabled={host.busy || host.pending} onSave={host.setup} onDirty={setSetupDirty} />}
        {session && !terminal && <section className={styles.card} aria-labelledby="game-session-title">
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
      {!terminal && <section className={styles.card} aria-labelledby="game-tier-title">
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
      </section>}
      {round && !terminal && <section className={styles.card} aria-labelledby="game-round-title">
        <h3 id="game-round-title">{round.phase === 'preparing' ? 'Preparing a verified screenshot…' : unexposed ? 'Prepared round' : 'Current round'}</h3>
        <p>Assigned contestant: <strong>{roundOwner?.name}</strong> · {GAME_TIER_DETAILS[round.requestedTier].label}</p>
        <p>{unexposed ? 'The screenshot remains hidden. Preparation does not start the countdown or consume a match.' : 'This exposed round retains its history and contestant. The server controls its time and outcome.'}</p>
        {round.phase === 'ready' && <><p className={styles.cover}>Screenshot stays hidden until Reveal</p>
          {!host.status.candidateValid && <p className={styles.warning}>The prepared record changed or needs revalidation. Cancel and prepare again.</p>}
        </>}
        {answer && preview && <details><summary>Private host answer</summary><p>{answer.participantDescription} · {answer.promotion} · {answer.event}</p>
          {answer.matchDate && <p>{answer.matchDate}</p>}{answer.stipulation && <p>Stipulation: {answer.stipulation}</p>}{answer.championshipInfo && <p>Championship: {answer.championshipInfo}</p>}
          <section aria-label="Filming answer text preview"><h4>Filming answer text preview</h4><p>Long text is shortened with an ellipsis on the contestant display. The saved answer above stays unchanged.</p>
            <p>{preview.participantDescription}</p><p>{preview.promotion} · {preview.event}</p>
            {answer.matchDate && <p>{answer.matchDate}</p>}
            {answer.stipulation && <p>Stipulation: {preview.stipulation}</p>}
            {answer.championshipInfo && <p>Championship: {preview.championshipInfo}</p>}
          </section></details>}
        {unexposed && <button type="button" disabled={!can('CANCEL_UNEXPOSED')} onClick={() => host.command({ type: 'CANCEL_UNEXPOSED' })}>Cancel preparation</button>}
        <HostRoundControls status={host.status} can={can} command={host.command} />
      </section>}
      {host.status.preparationError && <p role="alert" className={styles.error}>{host.status.preparationError}</p>}
    </>}
  </section>;
}
