import { OBSCURITY_DETAILS } from '../../../shared/src/library';
import type { MatchSummary } from '../../../shared/src/matches';
import { MATCH_LABELS } from './match-draft';
import styles from './MatchesTable.module.css';

const columns = [
  ['participantDescription', 'Participants'],
  ['promotion', 'Promotion'],
  ['matchDate', 'Date'],
  ['screenshotCount', 'Screenshots'],
  ['eligibleCount', 'Eligible'],
] as const;
type SortKey = typeof columns[number][0];
export type MatchSort = { key: SortKey; direction: 'ascending' | 'descending' };
const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

function compare(left: MatchSummary, right: MatchSummary, sort: MatchSort) {
  const a = left[sort.key]; const b = right[sort.key];
  if (a === null || b === null) return Number(a === null) - Number(b === null) || left.id.localeCompare(right.id);
  const result = typeof a === 'number' && typeof b === 'number' ? a - b : collator.compare(String(a), String(b));
  return result * (sort.direction === 'ascending' ? 1 : -1) || left.id.localeCompare(right.id);
}

type Props = {
  matches: MatchSummary[];
  filtered: boolean;
  busy: boolean;
  sort: MatchSort | null;
  onSort: (value: MatchSort) => void;
  onOpen: (match: MatchSummary) => void;
};

export function MatchesTable({ matches, filtered, busy, sort, onSort, onOpen }: Props) {
  const rows = sort ? [...matches].sort((a, b) => compare(a, b, sort)) : matches;
  return <table className={styles.table} aria-label="Matches" role="table">
    <thead role="rowgroup"><tr role="row">{columns.map(([key, label]) => <th key={key} scope="col" role="columnheader" aria-sort={sort?.key === key ? sort.direction : undefined}>
      <button type="button" disabled={busy} onClick={() => onSort({ key, direction: sort?.key === key && sort.direction === 'ascending' ? 'descending' : 'ascending' })}>{label}{sort?.key === key && <span aria-hidden="true"> {sort.direction === 'ascending' ? '↑' : '↓'}</span>}</button>
    </th>)}<th scope="col" role="columnheader">Outstanding issues</th></tr></thead>
    <tbody role="rowgroup">{rows.map((match) => <tr key={match.id} role="row">
      <td role="cell"><button type="button" disabled={busy} onClick={() => onOpen(match)}>{match.participantDescription ?? 'Untitled match'}</button>
        <small>{match.obscurity ? OBSCURITY_DETAILS[match.obscurity].label + ' obscurity' : 'Obscurity unset'}</small></td>
      <td role="cell"><span>{match.promotion ?? 'Unknown promotion'}</span><small>{match.event ?? 'Unknown event'}</small></td>
      <td role="cell"><span className={styles.narrowLabel}>Date </span>{match.matchDate ?? 'Unknown date'}</td>
      <td role="cell">{filtered ? `${match.matchingScreenshotCount} matching screenshot${match.matchingScreenshotCount === 1 ? '' : 's'} of ${match.screenshotCount} total` : `${match.screenshotCount} screenshot${match.screenshotCount === 1 ? '' : 's'}`}
        <small>{match.approvedCount} approved</small></td>
      <td role="cell">{match.eligibleCount} eligible</td>
      <td role="cell">
        {!match.complete && <span>Incomplete: {match.missingFields.map((field) => MATCH_LABELS[field]).join(', ')}</span>}
        {match.pendingCount > 0 && <span>{match.pendingCount} pending</span>}
        {match.assetIssueCount > 0 && <span>{match.assetIssueCount} image {match.assetIssueCount === 1 ? 'issue' : 'issues'}</span>}
        {match.classificationIncomplete && <span>Classification incomplete</span>}
        <small>{match.awaitingClassificationCount} awaiting classification</small>
      </td>
    </tr>)}</tbody>
  </table>;
}
