import { useEffect, useRef, useState } from 'react';
import type { BatchStatus, ImportAction, ImportConfirmation } from '../../../shared/src/imports';
import { confirmationId, libraryApi } from './api';
import { scanSelection } from './selection';
import styles from './Library.module.css';

interface Props { onClose: () => void; onImported: () => void }
export function ImportDialog({ onClose, onImported }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const controller = useRef(new AbortController());
  const images = useRef(new Map<string, File[]>());
  const pendingConfirmation = useRef<ImportConfirmation | null>(null);
  const [batch, setBatch] = useState<BatchStatus | null>(null);
  const [recent, setRecent] = useState<Array<Omit<BatchStatus, 'items'>>>([]);
  const [phase, setPhase] = useState('no_selection');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [choices, setChoices] = useState<Record<string, ImportAction>>({});
  const [localImages, setLocalImages] = useState(new Map<string, File[]>());
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const signal = () => controller.current.signal;
  const receive = (value: BatchStatus) => {
    if (signal().aborted) return;
    setBatch(value); setPhase(value.status);
    setChoices(Object.fromEntries(value.items.map((item) => [item.id, item.defaultAction ?? 'skip'])));
  };
  useEffect(() => {
    const urls: Record<string, string> = {};
    if (typeof URL.createObjectURL === 'function') {
      for (const [path, files] of localImages) if (files.length === 1) urls[path] = URL.createObjectURL(files[0]);
    }
    setPreviewUrls(urls);
    return () => { for (const url of Object.values(urls)) URL.revokeObjectURL(url); };
  }, [localImages]);
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    const current = controller.current = new AbortController();
    const element = dialog.current!;
    if (typeof element.showModal === 'function') element.showModal();
    else element.setAttribute('open', '');
    element.querySelector<HTMLButtonElement>('button')?.focus();
    void libraryApi.recent(current.signal).then((value) => { if (!current.signal.aborted) setRecent(value); }).catch(() => { if (!current.signal.aborted) setError('Recent imports unavailable. Reconnect to the local server and reopen this dialog.'); });
    return () => { current.abort(); if (typeof element.close === 'function') element.close(); trigger?.focus(); };
  }, []);
  useEffect(() => {
    if (!batch || batch.status !== 'confirming' || phase === 'disconnected') return;
    const timer = window.setTimeout(() => {
      void libraryApi.status(batch.id, controller.current.signal).then((value) => {
        if (!controller.current.signal.aborted) { setBatch(value); setPhase(value.status); }
      }).catch(() => {
        if (!controller.current.signal.aborted) { setPhase('disconnected'); setError('Connection lost. Close and reopen to resume this import from Recent imports.'); }
      });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [batch, phase]);
  async function run(operation: () => Promise<void>) {
    setBusy(true); setError('');
    try { await operation(); }
    catch (failure) { if (!signal().aborted) { setPhase('interrupted'); setError(failure instanceof Error ? failure.message : 'Import failed. Reconnect and retry.'); } }
    finally { if (!signal().aborted) setBusy(false); }
  }
  async function prepare(files: File[]) {
    await run(async () => {
      pendingConfirmation.current = null; setPhase('scanning'); setBatch(null);
      const selection = await scanSelection(files, signal()); images.current = selection.images; setLocalImages(selection.images);
      const created = await libraryApi.create(selection.manifest, signal()); receive(created);
      await uploadAndPreview(created);
    });
  }
  async function uploadAndPreview(current: BatchStatus) {
    setPhase('uploading'); const queue = current.items.filter((item) => item.uploadUrl && ['awaiting_upload', 'failed'].includes(item.state));
    const failures: string[] = [];
    async function uploadNext() {
      let item;
      while ((item = queue.shift())) {
        const path = item.candidateLabel.replace(/\.json$/, '.png'); const source = images.current.get(path) ?? images.current.get(path.split('/').pop()!);
        if (!source || source.length !== 1) continue;
        try { await libraryApi.upload(item.uploadUrl!, source[0], controller.current.signal); }
        catch (failure) { if (controller.current.signal.aborted) throw failure; failures.push(failure instanceof Error ? failure.message : 'Image upload failed.'); }
      }
    }
    await Promise.all(Array.from({ length: Math.min(current.limits.uploads, queue.length) }, uploadNext));
    setPhase('validating');
    receive(await libraryApi.preview(await libraryApi.status(current.id, signal()), signal()));
    if (failures.length) setError(`${failures.length} upload(s) failed: ${failures[0]}`);
  }
  async function confirm() {
    if (!batch?.previewToken) return;
    await run(async () => {
      const request = pendingConfirmation.current ?? { requestId: confirmationId(), previewToken: batch.previewToken!,
        items: batch.items.filter((item) => item.state === 'ready').map((item) => ({ itemId: item.id, action: choices[item.id] ?? 'skip' })) };
      pendingConfirmation.current = request; setPhase('confirming');
      receive(await libraryApi.confirm(batch.id, request, signal()));
    });
  }
  function trap(event: React.KeyboardEvent<HTMLDialogElement>) {
    if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }
    if (event.key !== 'Tab') return;
    const controls = Array.from(dialog.current!.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href],summary')).filter((element) => {
      const closedDetails = element.closest('details:not([open])');
      return !element.hidden && (!closedDetails || element === closedDetails.querySelector('summary'));
    });
    const first = controls[0]; const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="import-title" onKeyDown={trap} onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <header className={styles.heading}><h2 id="import-title">Import captures</h2><button type="button" onClick={onClose}>Close</button></header>
    <p>Select captures on <strong>this browser device</strong>. On a tablet this reads the tablet, while imported copies are stored on the server laptop. Originals stay unchanged.</p>
    <div className={styles.actions}>
      <label className={styles.picker}>Choose folder<input aria-label="Choose capture folder" type="file" multiple {...{ webkitdirectory: '' }} disabled={busy} onChange={(event) => { const files = Array.from(event.target.files ?? []); event.target.value = ''; void prepare(files); }} /></label>
      <label className={styles.picker}>Choose files<input aria-label="Choose capture files" type="file" multiple disabled={busy} onChange={(event) => { const files = Array.from(event.target.files ?? []); event.target.value = ''; void prepare(files); }} /></label>
    </div>
    <p className={styles.muted}>Choose a parent folder, a video folder, or PNG/JSON pairs. Use Choose files if folder selection is unavailable.</p>
    <p role="status">{phase.replace(/_/g, ' ')}</p>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {batch && <>
      <p>Batch: {batch.id}</p>
      <details><summary>Effective import limits</summary><p>{batch.limits.items} candidates · {batch.limits.imageBytes.toLocaleString()} bytes per PNG · {batch.limits.imagePixels.toLocaleString()} pixels · {batch.limits.decompressedBytes.toLocaleString()} inflated PNG bytes · {batch.limits.batchBytes.toLocaleString()} bytes per batch · {batch.limits.metadataBytes.toLocaleString()} metadata bytes · {batch.limits.jsonBytes.toLocaleString()} JSON request bytes · {batch.limits.uploads} simultaneous uploads · {batch.limits.retentionDays} days before inactive preview expiry.</p></details>
      <p>{batch.counts.imported} imported · {batch.counts.duplicate} duplicate · {batch.counts.skipped} skipped · {batch.counts.failed} failed · {batch.counts.remaining} remaining · {batch.ignored.length} ignored files</p>
      {batch.ignored.length > 0 && <details><summary>Ignored files</summary><ul>{batch.ignored.map((item, index) => <li key={index}>{item.label}: {item.reason}</li>)}</ul></details>}
      {batch.error && <p className={styles.error}>{batch.error.message}</p>}
      <ul className={styles.items}>{batch.items.map((item) => {
        const path = item.candidateLabel.replace(/\.json$/, '.png');
        const previewUrl = item.state === 'ready' ? previewUrls[path] ?? previewUrls[path.split('/').pop()!] : undefined;
        return <li key={item.id}>
        <strong>{item.candidateLabel}</strong><p>{item.result ?? item.classification ?? item.state}</p>
        {previewUrl && <img className={styles.localPreview} src={previewUrl}
          alt={`Local preview of ${item.candidateLabel}`} loading="lazy" />}
        {item.duplicateOf.length > 0 && <p>Duplicate of: {item.duplicateOf.join(', ')}</p>}
        {item.issues.map((issue, index) => <p key={index} className={styles.error}>{issue.message}</p>)}
        {item.error && !item.issues.some((issue) => issue.code === item.error?.code) && <p className={styles.error}>{item.error.message}</p>}
        {item.retryable && <p>Retry available. If bytes are missing, select the original pair again below.</p>}
        {item.state === 'ready' && batch.status === 'preview_ready' && <label>Decision for {item.candidateLabel}<select value={choices[item.id] ?? 'skip'} disabled={busy || Boolean(pendingConfirmation.current)} onChange={(event) => setChoices({ ...choices, [item.id]: event.target.value as ImportAction })}>
          {item.classification === 'valid' && <option value="import">Import</option>}
          {item.classification === 'image_duplicate' && <option value="keepDuplicate">Keep identical image as a separate capture</option>}
          <option value="skip">Skip</option>
        </select></label>}
      </li>; })}</ul>
      {batch.status === 'preview_ready' && <button className={styles.primary} disabled={busy} onClick={() => void confirm()}>{pendingConfirmation.current ? 'Retry same confirmation' : 'Confirm selected imports'}</button>}
      {batch.status !== 'expired' && batch.items.some((item) => item.retryable || ['awaiting_upload', 'staged', 'ready', 'validating'].includes(item.state)) && <div className={styles.actions}>
        <button disabled={busy || batch.status === 'confirming'} onClick={() => void run(async () => { pendingConfirmation.current = null; await uploadAndPreview(await libraryApi.status(batch.id, signal())); })}>Refresh preview / retry</button>
        <label className={styles.picker}>Re-select missing files<input aria-label="Re-select missing capture files" type="file" multiple disabled={busy || batch.status === 'confirming'} onChange={(event) => {
          const files = Array.from(event.target.files ?? []); event.target.value = '';
          void run(async () => { pendingConfirmation.current = null; images.current = (await scanSelection(files, signal())).images; setLocalImages(images.current); await uploadAndPreview(await libraryApi.status(batch.id, signal())); });
        }} /></label>
      </div>}
      {batch.counts.imported + batch.counts.duplicate > 0 && <button className={styles.primary} onClick={onImported}>View unassigned screenshots</button>}
      <p className={styles.muted}>Imported screenshots remain unassigned, unrated and pending. Closing keeps server progress available under Recent imports.</p>
    </>}
    <details open={!batch}><summary>Recent imports</summary>{recent.length ? <ul>{recent.map((item) => <li key={item.id}><button disabled={busy} onClick={() => void run(async () => { pendingConfirmation.current = null; images.current = new Map(); setLocalImages(images.current); receive(await libraryApi.status(item.id, signal())); })}>{item.sourceLabel} · {item.status.replace(/_/g, ' ')} · {new Date(item.createdAt).toLocaleString()}</button></li>)}</ul> : <p>No recent imports.</p>}</details>
  </dialog>;
}
