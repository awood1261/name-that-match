import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { initializeStorage, type StorageSession } from '../../server/src/storage';
import { createLibraryRepository, RecordNotFoundError, RevisionConflictError } from '../../server/src/library/repository';
import { DomainValidationError } from '../../server/src/library/validation';
import { createTestResources } from '../helpers/resources';
import { screenshotInput } from './fixtures';

describe('library persistence and transactions', () => {
  let resources: ReturnType<typeof createTestResources>;
  let session: StorageSession;
  let repo: ReturnType<typeof createLibraryRepository>;
  beforeEach(() => {
    resources = createTestResources();
    session = resources.storage(initializeStorage({ dataDir: resources.root }));
    repo = createLibraryRepository(session.db);
  });
  afterEach(async () => { await resources.cleanup(); });
  function identified() { return repo.createMatch({ participantDescription: 'A vs B', promotion: 'P', event: 'E' }); }
  function shot(captureId: string = randomUUID(), videoId = 'abcdefghijk') { return repo.insertCommittedScreenshot(screenshotInput(captureId, videoId)); }
  // Only tests seed review states directly. Production approval requires later asset/review checks.
  function reviewed(matchId: string, reviewStatus: 'approved' | 'pending' | 'rejected' = 'approved') {
    const initial = shot();
    repo.updateScreenshot(initial.id, 1, { matchId, difficulty: 'medium' }, repo.getMatch(matchId).revision);
    session.db.prepare('UPDATE screenshots SET review_status=?, revision=revision+1 WHERE id=?').run(reviewStatus, initial.id);
    return repo.getScreenshot(initial.id);
  }

  it('creates normalized drafts and identified matches with independent generated IDs/timestamps', () => {
    const draft = repo.createMatch();
    expect(draft).toMatchObject({ participantDescription: null, promotion: null, event: null, obscurity: null, matchDate: null, revision: 1 });
    expect(draft.createdAt).toBe(draft.updatedAt);
    expect(Number.isNaN(Date.parse(draft.createdAt))).toBe(false);
    const first = repo.createMatch({ participantDescription: ' Team A vs Team B ', matchDate: '2026-11' });
    const second = repo.createMatch({ participantDescription: 'Team A vs Team B' });
    expect(first.id).not.toBe(second.id);
    expect(first.participantDescription).toBe('Team A vs Team B');
    expect(first.matchDate).toBe('2026-11');
  });

  it('preserves exact metadata and portable path, allows identical hashes, and defaults to unassigned/unrated/pending', () => {
    const input = screenshotInput('capture-one');
    const first = repo.insertCommittedScreenshot(input);
    const second = shot('capture-two');
    expect(first).toMatchObject({ matchId: null, difficulty: null, reviewStatus: 'pending', revision: 1, notes: null });
    expect(first.originalMetadataJson).toBe(input.originalMetadataJson);
    expect(first.provenance).toEqual(input.provenance);
    expect(first.imagePath).toBe(`screenshots/${first.id}.png`);
    expect(first.id).not.toBe(first.provenance.captureId);
    expect(first.image.sha256).toBe(second.image.sha256);
    expect(() => repo.insertCommittedScreenshot(input)).toThrow(/UNIQUE/);
    expect(repo.getScreenshot(first.id)).toEqual(first);
    expect(session.db.prepare('SELECT count(*) AS n FROM screenshots').get()).toEqual({ n: 2 });
  });

  it('persists matches, partial dates, screenshot fields and immutable provenance across reopen', () => {
    const match = repo.createMatch({ participantDescription: 'A & B vs C & D', promotion: 'P', event: 'E', matchDate: '2000-02-29', obscurity: 'medium' });
    const original = shot();
    const associated = repo.updateScreenshot(original.id, 1, { matchId: match.id, difficulty: 'hard', notes: 'kept' }, 1);
    session.db.close();
    session = resources.storage(initializeStorage({ dataDir: resources.root }));
    repo = createLibraryRepository(session.db);
    expect(repo.getMatch(match.id)).toEqual(match);
    expect(repo.getScreenshot(original.id)).toEqual(associated);
    expect(associated.originalMetadataJson).toBe(original.originalMetadataJson);
  });

  it('supports one video split across matches and one match containing multiple videos', () => {
    const a = identified(); const b = identified();
    const x = shot('x', 'videoSame01'); const y = shot('y', 'videoSame01'); const z = shot('z', 'videoOther1');
    repo.updateScreenshot(x.id, 1, { matchId: a.id, difficulty: 'easy' }, 1);
    repo.updateScreenshot(y.id, 1, { matchId: b.id, difficulty: 'hard' }, 1);
    repo.updateScreenshot(z.id, 1, { matchId: a.id }, 1);
    expect(repo.getScreenshot(x.id).matchId).toBe(a.id);
    expect(repo.getScreenshot(y.id).matchId).toBe(b.id);
    expect(repo.getScreenshot(z.id).matchId).toBe(a.id);
    expect(repo.getScreenshot(x.id).difficulty).not.toBe(repo.getScreenshot(y.id).difficulty);
  });

  it('checks revisions even for no-ops, rejects invalid drafts and preserves existing data', () => {
    const match = identified(); const original = shot();
    expect(repo.updateMatch(match.id, 1, { participantDescription: ' A vs B ' }).match).toEqual(match);
    expect(repo.updateScreenshot(original.id, 1, { notes: '' })).toEqual(original);
    expect(() => repo.updateMatch(match.id, 2, {})).toThrow(RevisionConflictError);
    expect(() => repo.updateScreenshot(original.id, 2, {})).toThrow(RevisionConflictError);
    expect(() => repo.updateMatch(match.id, 1, { matchDate: '2023-02-29' })).toThrow(DomainValidationError);
    expect(repo.getMatch(match.id)).toEqual(match);
    const updated = repo.updateMatch(match.id, 1, { notes: 'editor' }).match;
    expect(updated.revision).toBe(2); expect(updated.createdAt).toBe(match.createdAt);
    try { repo.updateMatch(match.id, 1, {}); }
    catch (error) { expect(error).toMatchObject({ currentRevision: 2, recordType: 'match' }); }
    expect(() => repo.getMatch(randomUUID())).toThrow(RecordNotFoundError);
  });

  it('detects stale edits from an independent database connection', () => {
    const match = identified();
    const otherSession = resources.storage(initializeStorage({ dataDir: resources.root }));
    const otherEditor = createLibraryRepository(otherSession.db);
    const snapshot = otherEditor.getMatch(match.id);
    repo.updateMatch(match.id, 1, { event: 'Changed elsewhere' });
    expect(() => otherEditor.updateMatch(match.id, snapshot.revision, { notes: 'stale' })).toThrow(RevisionConflictError);
    expect(otherEditor.getMatch(match.id)).toMatchObject({ event: 'Changed elsewhere', notes: null, revision: 2 });
  });

  it('never exposes approval or provenance editing through milestone-one writes', () => {
    const original = shot();
    for (const changes of [{ reviewStatus: 'approved' }, { provenance: {} }, { imagePath: '../outside' }, { captureId: 'other' }]) {
      expect(() => repo.updateScreenshot(original.id, 1, changes)).toThrow(DomainValidationError);
    }
    expect(repo.getScreenshot(original.id)).toEqual(original);
    const input = screenshotInput('invalid-provenance');
    expect(() => repo.insertCommittedScreenshot({ ...input, originalMetadataJson: '{}' })).toThrow(DomainValidationError);
    expect(() => repo.insertCommittedScreenshot({ ...input, image: { ...input.image, width: 0 } })).toThrow(DomainValidationError);
  });

  it.each(['participantDescription', 'promotion', 'event', 'matchDate', 'stipulation', 'championshipInfo'] as const)('invalidates only approved associated screenshots for %s and makes stale editors conflict', (field) => {
    const match = identified(); const other = identified();
    const approved = reviewed(match.id); const alsoApproved = reviewed(match.id); const pending = reviewed(match.id, 'pending'); const rejected = reviewed(match.id, 'rejected'); const outside = reviewed(other.id);
    const updated = repo.updateMatch(match.id, 1, { [field]: field === 'matchDate' ? '2026' : 'new value' });
    expect(updated.match.revision).toBe(2);
    expect(updated.invalidatedScreenshots).toHaveLength(2);
    expect(updated.invalidatedScreenshots).toEqual(expect.arrayContaining([
      { id: approved.id, revision: approved.revision + 1 }, { id: alsoApproved.id, revision: alsoApproved.revision + 1 },
    ]));
    expect(repo.getScreenshot(alsoApproved.id)).toMatchObject({ reviewStatus: 'pending', revision: alsoApproved.revision + 1 });
    expect(repo.getScreenshot(approved.id)).toMatchObject({ reviewStatus: 'pending', revision: approved.revision + 1 });
    expect(repo.getScreenshot(pending.id)).toEqual(pending); expect(repo.getScreenshot(rejected.id)).toEqual(rejected);
    expect(repo.getScreenshot(outside.id)).toEqual(outside);
    expect(() => repo.updateScreenshot(approved.id, approved.revision, { notes: 'stale' })).toThrow(RevisionConflictError);
  });

  it('invalidates when required metadata is cleared, but not for notes/obscurity or normalized no-ops', () => {
    const match = identified(); const approved = reviewed(match.id);
    expect(repo.updateMatch(match.id, 1, { notes: 'editor', obscurity: 'high' }).invalidatedScreenshots).toEqual([]);
    expect(repo.getScreenshot(approved.id)).toEqual(approved);
    expect(repo.updateScreenshot(approved.id, approved.revision, { matchId: match.id, difficulty: approved.difficulty }, 2)).toEqual(approved);
    const note = repo.updateScreenshot(approved.id, approved.revision, { notes: ' screenshot note ' });
    expect(note.reviewStatus).toBe('approved'); expect(note.revision).toBe(approved.revision + 1);
    expect(repo.updateScreenshot(note.id, note.revision, { notes: 'screenshot note' })).toEqual(note);
    repo.updateMatch(match.id, 2, { participantDescription: null });
    expect(repo.getScreenshot(note.id).reviewStatus).toBe('pending');
  });

  it.each(['difficulty', 'unrate', 'reassign', 'unassign'] as const)('resets approval when a screenshot material edit is %s', (action) => {
    const match = identified(); const target = identified(); const approved = reviewed(match.id);
    const changes = action === 'difficulty' ? { difficulty: 'hard' }
      : action === 'unrate' ? { difficulty: null } : { matchId: action === 'reassign' ? target.id : null };
    const changed = repo.updateScreenshot(approved.id, approved.revision, changes, 1);
    expect(changed.reviewStatus).toBe('pending'); expect(changed.revision).toBe(approved.revision + 1);
    expect(changed.provenance).toEqual(approved.provenance); expect(changed.originalMetadataJson).toBe(approved.originalMetadataJson);
  });

  it('preserves pending/rejected state on material edits and approves nothing', () => {
    const match = identified();
    for (const state of ['pending', 'rejected'] as const) {
      const initial = reviewed(match.id, state);
      expect(repo.updateScreenshot(initial.id, initial.revision, { matchId: null, difficulty: null }).reviewStatus).toBe(state);
    }
  });

  it('multi-assigns all selected screenshots and preserves no-op revisions', () => {
    const a = identified(); const b = identified(); const first = reviewed(a.id); const second = shot();
    const selected = [{ id: first.id, expectedRevision: first.revision }, { id: second.id, expectedRevision: second.revision }];
    const result = repo.assignScreenshots(b.id, 1, selected);
    expect(result.map((record) => record.matchId)).toEqual([b.id, b.id]);
    expect(result.map((record) => record.reviewStatus)).toEqual(['pending', 'pending']);
    expect(repo.assignScreenshots(b.id, 1, result.map((record) => ({ id: record.id, expectedRevision: record.revision })))).toEqual(result);
  });

  it('rejects every invalid/stale member and target before multi-assignment without partial writes', () => {
    const target = identified(); const first = shot(); const second = shot();
    const good = { id: first.id, expectedRevision: 1 };
    for (const members of [[good, { id: second.id, expectedRevision: 2 }], [good, { id: randomUUID(), expectedRevision: 1 }]]) {
      expect(() => repo.assignScreenshots(target.id, 1, members)).toThrow();
      expect(repo.getScreenshot(first.id)).toEqual(first);
    }
    expect(() => repo.assignScreenshots(target.id, 2, [good])).toThrow(RevisionConflictError);
    expect(() => repo.assignScreenshots(randomUUID(), 1, [good])).toThrow(RecordNotFoundError);
    expect(() => repo.assignScreenshots(target.id, 1, [good, good])).toThrow(DomainValidationError);
    expect(() => repo.assignScreenshots(target.id, 1, [])).toThrow(DomainValidationError);
    expect(() => repo.assignScreenshots(target.id, 1, Array(257).fill(good))).toThrow(DomainValidationError);
    expect(() => repo.updateScreenshot(first.id, 1, { matchId: target.id }, 2)).toThrow(RevisionConflictError);
    expect(() => repo.updateScreenshot(first.id, 1, { matchId: target.id })).toThrow(DomainValidationError);
    expect(repo.getScreenshot(first.id)).toEqual(first); expect(repo.getScreenshot(second.id)).toEqual(second);
  });

  it('rolls back a match edit if associated review invalidation fails', () => {
    const match = identified(); const first = reviewed(match.id); const second = reviewed(match.id);
    session.db.exec(`CREATE TRIGGER reject_review BEFORE UPDATE ON screenshots BEGIN SELECT RAISE(ABORT, 'injected review failure'); END`);
    expect(() => repo.updateMatch(match.id, 1, { event: 'changed' })).toThrow(/injected review failure/);
    expect(repo.getMatch(match.id)).toEqual(match);
    expect(repo.getScreenshot(first.id)).toEqual(first); expect(repo.getScreenshot(second.id)).toEqual(second);
  });

  it('rolls back an earlier member if a later assignment fails during the transaction', () => {
    const target = identified(); const first = shot(); const second = shot();
    session.db.exec(`CREATE TRIGGER reject_second BEFORE UPDATE ON screenshots WHEN OLD.id='${second.id}' BEGIN SELECT RAISE(ABORT, 'injected assignment failure'); END`);
    expect(() => repo.assignScreenshots(target.id, 1, [{ id: first.id, expectedRevision: 1 }, { id: second.id, expectedRevision: 1 }])).toThrow(/injected assignment failure/);
    expect(repo.getScreenshot(first.id)).toEqual(first); expect(repo.getScreenshot(second.id)).toEqual(second);
  });
});
