import { DIFFICULTIES, DIFFICULTY_DETAILS, OBSCURITIES, OBSCURITY_DETAILS, REVIEW_STATUSES } from '../../../shared/src/library';
import { GAME_TIERS, GAME_TIER_DETAILS } from '../../../shared/src/classification';
import styles from './Library.module.css';
export function LibraryFilters({ query, matchView, change }: { query: string; matchView: boolean; change: (query: string) => void }) {
  const parameters = new URLSearchParams(query);
  function set(key: string, value: string) { const next = new URLSearchParams(query); if (value) next.set(key, value); else next.delete(key); change(next.toString()); }
  const groups = [
    ...(matchView ? [{ key: 'obscurity', label: 'Filter obscurity', values: [...OBSCURITIES.map((value) => ({ value, label: OBSCURITY_DETAILS[value].label })), { value: 'unset', label: 'Unset' }] }] : []),
    { key: 'difficulty', label: 'Filter visual difficulty', values: [...DIFFICULTIES.map((value) => ({ value, label: DIFFICULTY_DETAILS[value].label })), { value: 'unrated', label: 'Unrated' }] },
    { key: 'review', label: 'Filter review', values: REVIEW_STATUSES.map((value) => ({ value, label: value })) },
    { key: 'tier', label: 'Filter game tier', values: [...GAME_TIERS.map((value) => ({ value, label: GAME_TIER_DETAILS[value].label })), { value: 'unclassified', label: 'Unclassified' }] },
  ];
  return <details className={styles.filters} aria-label="Library filters"><summary>Search and filters</summary><p>{matchView ? 'These filters choose matching matches. Opening a match shows only screenshots matching the visual difficulty, review and game tier filters. Changing filters returns to results.' : 'These filters apply to unassigned screenshots.'}</p><div className={styles.filterFields}>
    {matchView && <label>Search matches<input type="search" maxLength={1000} value={parameters.get('q') ?? ''} onChange={(event) => set('q', event.target.value)} placeholder="Participants, promotion or event" /></label>}
    {groups.map((group) => <fieldset key={group.key}><legend>{group.label}</legend>{group.values.map(({ value, label }) => <label className={styles.selection} key={value}><input type="checkbox" checked={(parameters.get(group.key)?.split(',') ?? []).includes(value)} onChange={(event) => { const values = new Set(parameters.get(group.key)?.split(',') ?? []); if (event.target.checked) values.add(value); else values.delete(value); set(group.key, [...values].join(',')); }} />{label}</label>)}</fieldset>)}
    {matchView && <>{[['incomplete', 'Incomplete identifying metadata'], ['classificationIncomplete', 'Incomplete classification']].map(([key, label]) => <label className={styles.selection} key={key}><input type="checkbox" checked={parameters.has(key)} onChange={(event) => set(key, event.target.checked ? 'true' : '')} />{label}</label>)}</>}
    <button type="button" onClick={() => change('')}>Clear filters</button>
  </div></details>;
}
