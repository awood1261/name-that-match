import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import type { BatchRow, Candidate, ItemRow, ItemState, Issue } from './contracts.js';
import { ImportError } from './contracts.js';

const transitions: Record<ItemState, ItemState[]> = {
  awaiting_upload: ['uploading', 'failed', 'expired'], uploading: ['staged', 'failed', 'expired'],
  staged: ['validating', 'failed', 'expired'], validating: ['ready', 'invalid', 'failed', 'expired'],
  ready: ['validating', 'confirmed', 'skipped', 'duplicate', 'conflict', 'invalid', 'failed', 'expired'],
  confirmed: ['finalizing', 'duplicate', 'skipped', 'conflict', 'failed'],
  finalizing: ['finalized', 'failed'], finalized: ['committed', 'duplicate', 'conflict', 'failed'],
  failed: ['awaiting_upload', 'uploading', 'staged', 'validating', 'ready', 'confirmed', 'finalizing', 'finalized', 'expired'],
  committed: [], invalid: ['expired'], duplicate: [], skipped: [], conflict: ['expired'], expired: [],
};
export class ImportStore {
  constructor(readonly db: Database.Database) {}
  batch(id: string): BatchRow {
    const batch = this.db.prepare<[string], BatchRow>('SELECT * FROM import_batches WHERE id=?').get(id);
    if (!batch) throw new ImportError('NOT_FOUND', 'Import batch not found.');
    return batch;
  }
  items(batchId: string): ItemRow[] { return this.db.prepare<[string], ItemRow>('SELECT * FROM import_items WHERE batch_id=? ORDER BY ordinal,id').all(batchId); }
  item(batchId: string, itemId: string): ItemRow {
    const item = this.db.prepare<[string, string], ItemRow>('SELECT * FROM import_items WHERE batch_id=? AND id=?').get(batchId, itemId);
    if (!item) throw new ImportError('NOT_FOUND', 'Import item not found.');
    return item;
  }
  touch(id: string, patch: Partial<BatchRow> = {}): void {
    const fields = { updated_at: new Date().toISOString(), preview_token: null, ...patch };
    const keys = Object.keys(fields) as Array<keyof typeof fields>;
    this.db.prepare(`UPDATE import_batches SET ${keys.map((key) => `${key}=@${key}`).join(',')}, revision=revision+1 WHERE id=@id`).run({ ...fields, id });
  }
  move(item: ItemRow, state: ItemState, patch: Partial<ItemRow> = {}): ItemRow {
    if (item.state !== state && !transitions[item.state].includes(state)) throw new ImportError('INVALID_STATE', `Cannot transition ${item.state} to ${state}.`);
    const fields = { ...patch, state, updated_at: new Date().toISOString() };
    const keys = Object.keys(fields) as Array<keyof typeof fields>;
    const changed = this.db.prepare(`UPDATE import_items SET ${keys.map((key) => `${key}=@${key}`).join(',')} WHERE id=@id AND state=@previous`).run({ ...fields, id: item.id, previous: item.state });
    if (changed.changes !== 1) throw new ImportError('STATE_CONFLICT', 'Import state changed; reload status.');
    this.touch(item.batch_id);
    return this.item(item.batch_id, item.id);
  }
  fail(item: ItemRow, error: ImportError): ItemRow {
    const issues: Issue[] = [{ code: error.code, message: error.message }];
    return this.move(item, 'failed', { resume_state: item.state === 'failed' ? item.resume_state : item.state,
      error_code: error.code, error_message: error.message, retryable: error.retryable ? 1 : 0,
      result_kind: 'failed', validation_issues_json: JSON.stringify(issues) });
  }
  create(sourceLabel: string, candidates: Candidate[], ignored: unknown[]): string {
    const batchId = randomUUID(); const now = new Date().toISOString();
    this.db.transaction(() => {
      this.db.prepare('INSERT INTO import_batches (id,source_label,created_at,updated_at,ignored_files_json) VALUES (?,?,?,?,?)').run(batchId, sourceLabel, now, now, JSON.stringify(ignored));
      for (const [ordinal, candidate] of candidates.entries()) {
        const id = randomUUID(); let original: string | null = null;
        if (candidate.metadataText !== null) {
          try { const parsed: unknown = JSON.parse(candidate.metadataText); if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) original = candidate.metadataText; } catch { /* Invalid originals remain outside app; diagnostics are retained. */ }
        }
        this.db.prepare(`INSERT INTO import_items (id,batch_id,ordinal,candidate_label,original_metadata_json,source_platform,capture_id,
          validation_issues_json,staging_path,image_byte_size,state,result_kind,error_code,error_message,created_at,updated_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, batchId, ordinal, candidate.label, original,
          candidate.metadata?.source.platform ?? null, candidate.metadata?.captureId ?? null,
          JSON.stringify(candidate.issues), candidate.issues.length ? null : `staging/${batchId}/${id}.png`, candidate.byteSize,
          candidate.issues.length ? 'invalid' : 'awaiting_upload', candidate.issues.length ? 'failed' : null,
          candidate.issues[0]?.code ?? null, candidate.issues[0]?.message ?? null, now, now);
      }
    }).immediate();
    return batchId;
  }
  summarize(id: string): void {
    const items = this.items(id); const successes = items.some((item) => ['imported', 'duplicate'].includes(item.result_kind ?? ''));
    const failures = items.some((item) => item.result_kind === 'failed');
    const remaining = items.some((item) => !item.result_kind);
    const status = remaining ? 'interrupted' : failures ? successes ? 'partial_success' : 'failed' : 'completed';
    this.touch(id, { status, completed_at: remaining ? null : new Date().toISOString() });
  }
}
