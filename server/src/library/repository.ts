import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import type Database from 'better-sqlite3';
import type { CaptureMetadataV1 } from '../../../shared/src/capture.js';
import type { Match, Screenshot, ScreenshotChanges, ReviewStatus } from '../../../shared/src/library.js';
import {
  ANSWER_FIELDS, EMPTY_MATCH, invalid, knownFields, object, parseMatchChanges,
  parseScreenshotChanges, requireId, requireRevision, isReviewStatus,
} from './validation.js';

export class RecordNotFoundError extends Error {
  constructor(public readonly recordType: 'match' | 'screenshot', public readonly id: string) {
    super(`${recordType} not found`);
    this.name = 'RecordNotFoundError';
  }
}
export class RevisionConflictError extends Error {
  constructor(public readonly recordType: 'match' | 'screenshot', public readonly id: string, public readonly currentRevision: number) {
    super(`${recordType} revision conflict`);
    this.name = 'RevisionConflictError';
  }
}

export interface StoredScreenshot extends Screenshot { imagePath: string }
export interface CommittedScreenshotInput {
  /** Import will reserve this UUID before file finalization; omitted IDs are generated. */
  id?: string;
  provenance: CaptureMetadataV1;
  originalMetadataJson: string;
  image: Screenshot['image'];
}

const matchSelect = `SELECT id, participant_description AS participantDescription, promotion, event,
  match_date AS matchDate, obscurity, stipulation, championship_info AS championshipInfo, notes,
  created_at AS createdAt, updated_at AS updatedAt, revision FROM matches`;
interface ScreenshotRow extends Omit<Screenshot, 'provenance' | 'image'> {
  imagePath: string; sha256: string; width: number; height: number; byteSize: number;
}
const screenshotSelect = `SELECT id, match_id AS matchId, original_metadata_json AS originalMetadataJson,
  image_path AS imagePath, image_sha256 AS sha256, image_width AS width, image_height AS height,
  image_byte_size AS byteSize, difficulty, review_status AS reviewStatus, notes,
  created_at AS createdAt, updated_at AS updatedAt, revision FROM screenshots`;

function checkRevision(recordType: 'match' | 'screenshot', record: { id: string; revision: number }, expected: number): void {
  if (record.revision !== expected) throw new RevisionConflictError(recordType, record.id, record.revision);
}

export function createLibraryRepository(db: Database.Database) {
  function getMatch(id: string): Match {
    requireId(id);
    const row = db.prepare<[string], Match>(`${matchSelect} WHERE id = ?`).get(id);
    if (!row) throw new RecordNotFoundError('match', id);
    return row;
  }
  function getScreenshot(id: string): StoredScreenshot {
    requireId(id);
    const row = db.prepare<[string], ScreenshotRow>(`${screenshotSelect} WHERE id = ?`).get(id);
    if (!row) throw new RecordNotFoundError('screenshot', id);
    const { sha256, width, height, byteSize, ...record } = row;
    return { ...record, provenance: JSON.parse(row.originalMetadataJson) as CaptureMetadataV1, image: { sha256, width, height, byteSize } };
  }
  function createMatch(input: unknown = {}): Match {
    const fields = { ...EMPTY_MATCH, ...parseMatchChanges(input) };
    const id = randomUUID();
    const timestamp = new Date().toISOString();
    db.prepare(`INSERT INTO matches (id, participant_description, promotion, event, match_date,
      obscurity, stipulation, championship_info, notes, created_at, updated_at, revision)
      VALUES (@id, @participantDescription, @promotion, @event, @matchDate, @obscurity,
      @stipulation, @championshipInfo, @notes, @timestamp, @timestamp, 1)`)
      .run({ id, timestamp, ...fields });
    return getMatch(id);
  }
  function updateMatch(id: string, expectedRevision: number, input: unknown) {
    requireId(id); requireRevision(expectedRevision);
    const changes = parseMatchChanges(input);
    return db.transaction(() => {
      const current = getMatch(id);
      checkRevision('match', current, expectedRevision);
      const changed = Object.keys(changes).some((field) => changes[field as keyof typeof changes] !== current[field as keyof Match]);
      if (!changed) return { match: current, invalidatedScreenshots: [] as Array<{ id: string; revision: number }> };
      const material = ANSWER_FIELDS.some((field) => field in changes && changes[field] !== current[field]);
      const updated = { ...current, ...changes, updatedAt: new Date().toISOString(), expectedRevision };
      db.prepare(`UPDATE matches SET participant_description=@participantDescription, promotion=@promotion,
        event=@event, match_date=@matchDate, obscurity=@obscurity, stipulation=@stipulation,
        championship_info=@championshipInfo, notes=@notes, updated_at=@updatedAt, revision=revision+1
        WHERE id=@id AND revision=@expectedRevision`).run(updated);
      const invalidatedScreenshots = material
        ? db.prepare(`UPDATE screenshots SET review_status='pending', revision=revision+1, updated_at=?
            WHERE match_id=? AND review_status='approved' RETURNING id, revision`)
          .all(updated.updatedAt, id) as Array<{ id: string; revision: number }>
        : [];
      return { match: getMatch(id), invalidatedScreenshots };
    }).immediate();
  }

  /** Internal SQL primitive only. The future import service must validate provenance/assets and
   * coordinate file finalization before using this in its commit transaction. No files or approvals. */
  function insertCommittedScreenshot(input: CommittedScreenshotInput): StoredScreenshot {
    const id = input.id === undefined ? randomUUID() : requireId(input.id);
    const metadata = input.provenance;
    let original: unknown;
    try { original = JSON.parse(input.originalMetadataJson); }
    catch { invalid('originalMetadataJson', 'Expected original JSON metadata'); }
    if (!isDeepStrictEqual(original, metadata)) invalid('originalMetadataJson', 'Must match supplied immutable provenance');
    if (!/^[0-9a-f]{64}$/.test(input.image.sha256)) invalid('image.sha256', 'Expected lowercase SHA-256');
    for (const field of ['width', 'height', 'byteSize'] as const) {
      if (!Number.isSafeInteger(input.image[field]) || input.image[field] <= 0) invalid(`image.${field}`, 'Expected a positive safe integer');
    }
    if (input.image.width !== metadata.image.width || input.image.height !== metadata.image.height) {
      invalid('image', 'Dimensions must agree with provenance');
    }
    if (!Number.isFinite(metadata.capture.playbackSeconds) || metadata.capture.playbackSeconds < 0) invalid('playbackSeconds', 'Expected finite nonnegative seconds');
    const timestamp = new Date().toISOString();
    db.prepare(`INSERT INTO screenshots (id, capture_id, source_platform, source_video_id, source_url,
      source_title, playback_seconds, captured_at, capture_method, schema_version, original_metadata_json,
      image_path, image_sha256, image_width, image_height, image_byte_size, created_at, updated_at)
      VALUES (@id, @captureId, @platform, @videoId, @url, @title, @playback, @capturedAt, @method,
        @schemaVersion, @original, @path, @hash, @width, @height, @byteSize, @timestamp, @timestamp)`)
      .run({ id, captureId: metadata.captureId, platform: metadata.source.platform,
        videoId: metadata.source.videoId, url: metadata.source.canonicalUrl, title: metadata.source.title ?? null,
        playback: metadata.capture.playbackSeconds, capturedAt: metadata.capture.capturedAt,
        method: metadata.capture.method, schemaVersion: metadata.schemaVersion,
        original: input.originalMetadataJson, path: `screenshots/${id}.png`, hash: input.image.sha256,
        width: input.image.width, height: input.image.height, byteSize: input.image.byteSize, timestamp });
    return getScreenshot(id);
  }

  function saveScreenshot(current: StoredScreenshot, changes: ScreenshotChanges): StoredScreenshot {
    const material = (changes.matchId !== undefined && changes.matchId !== current.matchId)
      || (changes.difficulty !== undefined && changes.difficulty !== current.difficulty);
    const next = { ...current, ...changes };
    if (next.matchId === current.matchId && next.difficulty === current.difficulty && next.notes === current.notes) return current;
    db.prepare(`UPDATE screenshots SET match_id=?, difficulty=?, notes=?, review_status=?,
      updated_at=?, revision=revision+1 WHERE id=? AND revision=?`)
      .run(next.matchId, next.difficulty, next.notes, material && current.reviewStatus === 'approved' ? 'pending' : current.reviewStatus,
        new Date().toISOString(), current.id, current.revision);
    return getScreenshot(current.id);
  }
  function updateScreenshot(id: string, expectedRevision: number, input: unknown, expectedMatchRevision?: number): StoredScreenshot {
    requireId(id); requireRevision(expectedRevision);
    const changes = parseScreenshotChanges(input);
    if (changes.matchId !== undefined && changes.matchId !== null) requireRevision(expectedMatchRevision, 'expectedMatchRevision');
    return db.transaction(() => {
      const current = getScreenshot(id);
      checkRevision('screenshot', current, expectedRevision);
      if (changes.matchId !== undefined && changes.matchId !== null) {
        checkRevision('match', getMatch(changes.matchId), expectedMatchRevision!);
      }
      return saveScreenshot(current, changes);
    }).immediate();
  }
  function assignScreenshots(targetMatchId: string, expectedMatchRevision: number, input: unknown): StoredScreenshot[] {
    requireId(targetMatchId, 'targetMatchId'); requireRevision(expectedMatchRevision, 'expectedMatchRevision');
    if (!Array.isArray(input) || input.length < 1 || input.length > 256) invalid('screenshots', 'Select 1–256 screenshots');
    const selections = input.map((entry) => {
      const selection = object(entry);
      knownFields(selection, ['id', 'expectedRevision']);
      return { id: requireId(selection.id), revision: requireRevision(selection.expectedRevision) };
    });
    if (new Set(selections.map((entry) => entry.id)).size !== selections.length) invalid('screenshots', 'Duplicate screenshot selection');
    return db.transaction(() => {
      checkRevision('match', getMatch(targetMatchId), expectedMatchRevision);
      // Validate every member before the first write; the transaction also protects later failures.
      const records = selections.map((entry) => {
        const current = getScreenshot(entry.id);
        checkRevision('screenshot', current, entry.revision);
        return current;
      });
      return records.map((record) => saveScreenshot(record, { matchId: targetMatchId }));
    }).immediate();
  }
  function reviewScreenshot(id: string, expectedRevision: number, reviewStatus: ReviewStatus, expectedMatchRevision: number | undefined,
    validateApproval: (record: StoredScreenshot, parent: Match) => void): StoredScreenshot {
    requireId(id); requireRevision(expectedRevision);
    if (!isReviewStatus(reviewStatus)) invalid('reviewStatus', 'Unsupported review status');
    return db.transaction(() => {
      const current = getScreenshot(id); checkRevision('screenshot', current, expectedRevision);
      if (reviewStatus === 'approved') {
        if (!current.matchId) invalid('reviewStatus', 'Assign a complete classified match before approval.');
        const parent = getMatch(current.matchId);
        checkRevision('match', parent, requireRevision(expectedMatchRevision, 'expectedMatchRevision'));
        validateApproval(current, parent);
      }
      if (reviewStatus !== current.reviewStatus) db.prepare('UPDATE screenshots SET review_status=?, revision=revision+1, updated_at=? WHERE id=? AND revision=?')
        .run(reviewStatus, new Date().toISOString(), id, expectedRevision);
      return getScreenshot(id);
    }).immediate();
  }
  return { createMatch, getMatch, updateMatch, getScreenshot, insertCommittedScreenshot, updateScreenshot, assignScreenshots, reviewScreenshot };
}
