import { useEffect, useState } from 'react';
import type { ScreenshotSummary } from '../../../shared/src/imports';
import { libraryApi } from './api';
import { ImportDialog } from './ImportDialog';
import styles from './Library.module.css';

function ScreenshotCard({ record }: { record: ScreenshotSummary }) {
  const [failed, setFailed] = useState(false);
  return <article className={styles.card}>
    {record.assetStatus === 'available' && !failed
      ? <img src={record.image.url} width={record.image.width} height={record.image.height} alt={`Capture ${record.provenance.captureId}`} loading="lazy" onError={() => setFailed(true)} />
      : <p className={styles.error}>Image {failed ? 'unavailable' : record.assetStatus}. Restore the original managed image and reload.</p>}
    <h3>{record.provenance.captureId}</h3>
    <p>Unassigned · {record.difficulty ?? 'unrated'} · {record.reviewStatus}</p>
    <dl><dt>Source video</dt><dd>{record.provenance.source.title ?? record.provenance.source.videoId}</dd>
      <dt>Playback</dt><dd>{record.provenance.capture.playbackSeconds} seconds</dd>
      <dt>Captured</dt><dd>{record.provenance.capture.capturedAt}</dd></dl>
  </article>;
}
export function MatchLibraryPage() {
  const [showImport, setShowImport] = useState(false);
  const [records, setRecords] = useState<ScreenshotSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    void libraryApi.unassigned(controller.signal).then((result) => {
      if (!controller.signal.aborted) setRecords(result.screenshots);
    }).catch(() => {
      if (!controller.signal.aborted) setError('Cannot load screenshots. Check the local server and reload.');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [reload]);
  return <section className={styles.library} aria-labelledby="library-title">
    <header className={styles.heading}><div><p className={styles.kicker}>Image Library</p><h2 id="library-title">Unassigned screenshots</h2></div>
      <div className={styles.actions}><button onClick={() => setReload((value) => value + 1)}>Reload screenshots</button><button className={styles.primary} onClick={() => setShowImport(true)}>Import captures</button></div></header>
    <p>New imports are unassigned, unrated and pending.</p>
    {loading && <p role="status">Loading screenshots…</p>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {!loading && !error && <><p role="status">{records.length} unassigned screenshot{records.length === 1 ? '' : 's'}</p>
      {records.length ? <div className={styles.grid}>{records.map((record) => <ScreenshotCard key={`${record.id}-${reload}`} record={record} />)}</div>
        : <p>No unassigned screenshots yet. Import PNG/JSON capture pairs to get started.</p>}</>}
    {showImport && <ImportDialog onClose={() => { setShowImport(false); setReload((value) => value + 1); }} onImported={() => { setShowImport(false); setReload((value) => value + 1); }} />}
  </section>;
}
