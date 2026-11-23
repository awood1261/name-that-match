import { Fragment, useState } from 'react';
import { DIFFICULTY_DETAILS } from '../../../shared/src/library';
import type { ScreenshotSummary } from '../../../shared/src/imports';
import { AssignmentPanel } from './AssignmentPanel';
import type { MatchWorkspace } from './useMatchWorkspace';
import styles from './Library.module.css';

type ScreenshotCardProps = {
  record: ScreenshotSummary;
  checked: boolean;
  disabled: boolean;
  onSelect: () => void;
  onOpen: () => void;
};

function ScreenshotCard({ record, checked, disabled, onSelect, onOpen }: ScreenshotCardProps) {
  const [failed, setFailed] = useState(false);
  const { captureId, source, capture } = record.provenance;
  return <article className={styles.card} data-selected={checked}>
    <label className={styles.selection}><input type="checkbox" checked={checked} disabled={disabled} onChange={onSelect} /> Select {captureId}</label>
    {record.assetStatus === 'available' && !failed
      ? <img src={record.image.url} width={record.image.width} height={record.image.height} alt={`Capture ${captureId}`} loading="lazy" onError={() => setFailed(true)} />
      : <p className={styles.error}>Image {failed ? 'unavailable' : record.assetStatus}. Restore the original managed image and reload.</p>}
    <button onClick={onOpen} disabled={disabled} aria-label={`Review capture ${captureId}`}>Review screenshot</button>
    <p>{record.matchId ? 'Assigned' : 'Unassigned'} · {record.difficulty ? DIFFICULTY_DETAILS[record.difficulty].label : 'unrated'} · {record.reviewStatus}</p>
    <details><summary>Capture provenance</summary><dl>
      <dt>Source video</dt><dd>{source.title ?? source.videoId}</dd>
      <dt>Playback</dt><dd>{capture.playbackSeconds} seconds</dd>
      <dt>Captured</dt><dd>{capture.capturedAt}</dd>
    </dl></details>
  </article>;
}

function emptyMessage(w: MatchWorkspace) {
  if (w.intake) return w.filters
    ? 'No unassigned screenshots match the active filters. Clear filters to check the full unassigned queue.'
    : 'No unassigned screenshots. Assigned screenshots are available in Matches. Import captures to add more.';
  return w.hasScreenshotFilters
    ? 'No screenshots match the active filters. Change or clear the filters to see more screenshots.'
    : 'No screenshots assigned to this match yet. Select captures in Unassigned Intake to assign them.';
}

type CollectionProps = {
  workspace: MatchWorkspace;
  grouping?: { enabled: boolean; setEnabled: (enabled: boolean) => void };
};

export function ScreenshotCollection({ workspace: w, grouping }: CollectionProps) {
  const records = grouping?.enabled ? [...w.records].sort((a, b) => a.provenance.source.videoId.localeCompare(b.provenance.source.videoId)
    || a.provenance.capture.capturedAt.localeCompare(b.provenance.capture.capturedAt)) : w.records;
  const total = records.length;
  const selected = new Set(w.selected.map(record => record.id));
  return <>
    <AssignmentPanel workspace={w} />
    <p role="status">{w.intake ? `${total} unassigned screenshot${total === 1 ? '' : 's'}` : `Showing ${total} of ${w.browsedMatch?.screenshotCount ?? 0} screenshots`}</p>
    <div className={styles.actions}>
      {grouping && <label className={styles.selection}>
        <input type="checkbox" checked={grouping.enabled} onChange={event => grouping.setEnabled(event.target.checked)} />Group by source video (provenance only)
      </label>}
      <button disabled={w.busy || total === 0 || total > 256} onClick={w.selectAll}>Select all screenshots</button>
    </div>
    {total > 256 && <p>Select up to 256 screenshots for one assignment.</p>}
    {total ? <div className={styles.grid}>{records.map((record, index) => {
      const source = record.provenance.source;
      const newGroup = grouping?.enabled && records[index - 1]?.provenance.source.videoId !== source.videoId;
      return <Fragment key={record.id}>
        {newGroup && <h3 className={styles.sourceHeading}>Source video: {source.title ?? source.videoId}</h3>}
        <ScreenshotCard key={record.revision} record={record} checked={selected.has(record.id)} disabled={w.busy}
          onSelect={() => w.toggle(record)} onOpen={() => w.openScreenshot(record)} />
      </Fragment>;
    })}</div> : <p>{emptyMessage(w)}</p>}
  </>;
}
