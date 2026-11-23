import { useState, type ReactNode } from 'react';
import { GAME_TIERS } from '../../../shared/src/classification';
import { OBSCURITY_DETAILS } from '../../../shared/src/library';
import type { MatchSummary } from '../../../shared/src/matches';
import { LibraryFilters } from './LibraryFilters';
import { MATCH_LABELS } from './match-draft';
import { ScreenshotCollection } from './ScreenshotCollection';
import type { MatchWorkspace } from './useMatchWorkspace';
import library from './Library.module.css';
import styles from './ReviewQueue.module.css';

function groupStatus(match: MatchSummary) {
  if (!match.complete) return 'Needs match information';
  if (match.assetIssueCount) return 'Image issues';
  if (!match.screenshotCount) return 'No screenshots';
  if (match.classificationIncomplete) return 'Needs classification';
  if (match.pendingCount) return 'Pending review';
  return match.eligibleCount ? 'Gameplay ready' : 'Review complete';
}

function MatchInformation({ match, edit, busy }: { match: MatchSummary; edit: () => void; busy: boolean }) {
  return <div className={styles.matchInformation}>
    <section className={styles.panel} aria-labelledby="review-match-info">
      <div className={styles.panelHeading}>
        <h4 id="review-match-info">Match Information</h4>
        <button disabled={busy} onClick={edit}>Edit match details</button>
      </div>
      <dl className={styles.metadata}>
        <div><dt>Promotion</dt><dd>{match.promotion ?? 'Missing'}</dd></div>
        <div><dt>Event</dt><dd>{match.event ?? 'Missing'}</dd></div>
        <div><dt>Date</dt><dd>{match.matchDate ?? 'Unknown'}</dd></div>
        <div><dt>Obscurity</dt><dd>{match.obscurity ? OBSCURITY_DETAILS[match.obscurity].label : 'Unset'}</dd></div>
      </dl>
    </section>
    <section className={styles.panel} aria-labelledby="review-match-eligibility">
      <h4 id="review-match-eligibility">Gameplay Eligibility</h4>
      <ul className={styles.checks}>
        <li>{match.complete ? 'Identifying details complete' : `Missing ${match.missingFields.map(field => MATCH_LABELS[field].toLowerCase()).join(', ')}`}</li>
        <li>{match.obscurity ? `Obscurity set (${OBSCURITY_DETAILS[match.obscurity].label})` : 'Set match obscurity'}</li>
        {match.awaitingClassificationCount > 0 && <li>{match.awaitingClassificationCount} awaiting classification</li>}
        {match.assetIssueCount > 0 && <li>{match.assetIssueCount} with image issues</li>}
        <li>{match.approvedCount} approved · {match.eligibleCount} of {match.screenshotCount} eligible</li>
      </ul>
    </section>
  </div>;
}

export function ReviewQueue({ workspace: w, editors }: { workspace: MatchWorkspace; editors: ReactNode }) {
  const [groupSources, setGroupSources] = useState(false);
  const pending = w.queue?.groups.filter(group => group.pendingCount > 0) ?? [];
  const completed = w.queue?.groups.filter(group => group.pendingCount === 0) ?? [];
  const groups = w.showCompleted ? [...pending, ...completed] : pending;
  const pendingCount = (w.queue?.intake.pendingCount ?? 0) + groups.reduce((total, group) => total + group.pendingCount, 0);
  const statistics = w.queue?.statistics;
  const ready = statistics && GAME_TIERS.reduce((total, tier) => total + statistics.eligibleByTier[tier], 0);
  const match = w.browsedMatch;
  const selected = Boolean(match || w.intake);

  return <>
    {w.queueError && <p role="alert" className={library.error}>{w.queueError}</p>}
    {!w.queue && !w.queueError && <p role="status">Loading review queue…</p>}
    {w.queue && !w.queueError && <div className={styles.summary}>
      <dl aria-label="Review Queue summary">
        <div><dt>Match groups shown</dt><dd>{groups.length}</dd></div>
        <div><dt>Screenshots to review in queue</dt><dd>{pendingCount}</dd></div>
        <div><dt>Gameplay ready in library</dt><dd>{ready}</dd></div>
      </dl>
      <p>Intake first, then pending matches (newest first)</p>
    </div>}
    <div className={styles.layout} data-selected={selected}>
      <section className={styles.queue} aria-labelledby="review-queue-title">
        <h3 id="review-queue-title" tabIndex={-1}>Review Queue</h3>
        <ul className={styles.groups}>
          <li>
            <button id="queue-intake" className={styles.group} aria-pressed={w.intake} disabled={w.busy} onClick={w.openIntake}>
              <span><strong>Unassigned Intake</strong><small>{w.queue ? `${w.queue.intake.screenshotCount} screenshots · Assign to a match` : 'Assign screenshots to a match'}</small></span>
              <span className={styles.badge} data-tone="warning" aria-hidden="true">Intake</span>
            </button>
          </li>
          {groups.map(group => <li key={group.id}>
            <button id={`queue-group-${group.id}`} className={styles.group} aria-pressed={group.id === match?.id} disabled={w.busy} onClick={() => w.openMatch(group)}>
              {group.thumbnailUrl && <img src={group.thumbnailUrl} alt="" loading="lazy" />}
              <span><strong className={styles.groupName} title={group.participantDescription ?? undefined}>{group.participantDescription ?? 'Untitled match'}</strong>
                <small className={styles.groupMetadata}>{group.promotion ?? 'Unknown promotion'} · {group.matchDate ?? 'Unknown date'}</small>
                <small>{group.screenshotCount} screenshots · {group.pendingCount} pending · {group.eligibleCount} eligible</small>
              </span>
              <span className={styles.badge} data-tone={group.eligibleCount && !group.pendingCount && !group.assetIssueCount && !group.classificationIncomplete ? 'ready' : 'warning'}>{groupStatus(group)}</span>
            </button>
          </li>)}
        </ul>
        {w.queue && !w.queueError && !pending.length && <p>No matches awaiting a review decision.</p>}
        <label className={library.selection}><input type="checkbox" checked={w.showCompleted} onChange={event => w.setShowCompleted(event.target.checked)} /> Show Completed{w.queue && ` (${completed.length})`}</label>
      </section>
      <section className={styles.detail} aria-label="Review workspace" data-open={selected || Boolean(w.editor)}>
        {w.intake && <>
          <div className={styles.panelHeading}><h3 id="match-collection-title" tabIndex={-1}>Unassigned Intake</h3>
            <button disabled={w.busy} onClick={w.backToResults}>Back to queue</button>
          </div>
          <LibraryFilters query={w.filters} matchView={false} change={w.changeFilters} />
          {!w.loading && !w.error && <ScreenshotCollection workspace={w} grouping={{ enabled: groupSources, setEnabled: setGroupSources }} />}
        </>}
        {match && <>
          <div className={styles.panelHeading}>
            <h3 id="match-collection-title" tabIndex={-1}>{match.participantDescription ?? 'Untitled match'}</h3>
            <span className={styles.badge}>{groupStatus(match)}</span>
            <span>{match.screenshotCount} screenshots · {match.eligibleCount} eligible</span>
            <button disabled={w.busy} onClick={w.backToResults}>Back to queue</button>
          </div>
          <MatchInformation match={match} edit={w.editBrowsedMatch} busy={w.busy} />
          {!w.loading && !w.error && !w.records.length && <p>No screenshots assigned to this match yet.</p>}
        </>}
        {!selected && !w.editor && <p>Select Unassigned Intake or a match to review screenshots.</p>}
        {editors}
        {match && !w.loading && !w.error && w.records.length > 0 && <details className={styles.assignment}>
          <summary>Manage screenshot assignments</summary><ScreenshotCollection workspace={w} />
        </details>}
      </section>
    </div>
  </>;
}
