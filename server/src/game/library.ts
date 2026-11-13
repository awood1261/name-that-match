import { randomInt } from 'node:crypto';
import type { StorageSession } from '../storage.js';
import { catalog, catalogAsync } from '../library/catalog.js';
import { assessAsset, publicScreenshot } from '../library/assets.js';
import { RecordNotFoundError, createLibraryRepository } from '../library/repository.js';
import { classify, GAME_TIERS, type GameTier } from '../../../shared/src/classification.js';
import type { GameState, RoundContext } from '../../../shared/src/game/contracts.js';
import type { GameAvailability } from '../../../shared/src/game/host.js';
import { unseenPool, type GameCandidate } from '../../../shared/src/game/selection.js';
import { parseRoundContext } from '../../../shared/src/game/validation.js';
import { canonicalJson } from './repository.js';
import { HttpError } from '../library/http/protocol.js';

export class GameLibrary {
  private cache: { key: string; candidates: GameCandidate[]; asOf: string } | null = null;
  private assessment: Promise<boolean> | null = null;
  private assessmentError: unknown = null;
  private stopped = false;
  private pinned: { sessionId: string; roundId: string; context: RoundContext; bytes: Buffer } | null = null;
  constructor(private readonly storage: StorageSession, private readonly drawIndex = (length: number) => randomInt(length)) {}
  private revisionKey() {
    const revisions = this.storage.db.prepare("SELECT 'm' AS kind,id,revision FROM matches UNION ALL SELECT 's',id,revision FROM screenshots ORDER BY kind,id").all();
    return JSON.stringify(revisions);
  }
  private observations(fresh: boolean) {
    const key = this.revisionKey();
    if (!fresh && this.cache?.key === key) return this.cache;
    return this.capture(key, catalog(this.storage));
  }
  private capture(key: string, observed: ReturnType<typeof catalog>) {
    const parents = new Map(observed.matches.map((m) => [m.id, m]));
    const candidates: GameCandidate[] = [];
    for (const shot of observed.screenshots) {
      if (!shot.eligibility.eligible || !shot.matchId) continue;
      const match = parents.get(shot.matchId)!;
      const context = parseRoundContext({ screenshotId: shot.id, matchId: match.id, screenshotRevision: shot.revision, matchRevision: match.revision,
        image: { sha256: shot.image.sha256, width: shot.image.width, height: shot.image.height, byteSize: shot.image.byteSize },
        answer: { participantDescription: match.participantDescription, promotion: match.promotion, event: match.event, matchDate: match.matchDate, stipulation: match.stipulation, championshipInfo: match.championshipInfo },
        obscurity: match.obscurity, difficulty: shot.difficulty, rulesVersion: 1 });
      candidates.push({ context, capturedAt: shot.provenance.capture.capturedAt, reviewStatus: shot.reviewStatus, associated: true, imageAvailable: true });
    }
    this.cache = { key, candidates, asOf: observed.asOf }; return this.cache;
  }
  /** One owned scan; HTTP callers await it while live observations keep their last complete asOf. */
  refresh(fresh = false): Promise<boolean> {
    if (this.stopped || !this.storage.db.open) return Promise.reject(new HttpError(503, 'GAME_UNAVAILABLE', 'Library assessment stopped.'));
    const key = this.revisionKey();
    if (this.assessment) return this.assessment;
    if (!fresh && !this.assessmentError && this.cache?.key === key) return Promise.resolve(false);
    this.assessment = (async () => {
      try {
        const observed = await catalogAsync(this.storage, () => this.stopped);
        if (this.stopped || !this.storage.db.open) throw new HttpError(503, 'GAME_UNAVAILABLE', 'Library assessment stopped.');
        if (this.revisionKey() !== key) throw new HttpError(409, 'LIBRARY_CHANGED', 'Library changed during assessment. Refresh and try again.');
        this.capture(key, observed); this.assessmentError = null; return true;
      } catch (error) { this.assessmentError = error; throw error; }
      finally { this.assessment = null; }
    })();
    return this.assessment;
  }
  cachedAvailability(state: GameState | null): GameAvailability {
    // A concurrent edit invalidates the new scan, not the last complete asOf.
    // The next observation retries; storage failures still surface explicitly.
    if (this.assessmentError && !(this.cache && this.assessmentError instanceof HttpError && this.assessmentError.code === 'LIBRARY_CHANGED')) throw this.assessmentError;
    if (!this.cache) throw new HttpError(503, 'GAME_UNAVAILABLE', 'Library assessment is still in progress.');
    return this.counts(state, this.cache);
  }
  availability(state: GameState | null, fresh = false): GameAvailability {
    const observed = this.observations(fresh);
    return this.counts(state, observed);
  }
  private counts(state: GameState | null, observed: { candidates: GameCandidate[]; asOf: string }): GameAvailability {
    const usedState = state ?? { rounds: [] };
    const tiers = { squash: { screenshots: 0, matches: 0 }, competitive: { screenshots: 0, matches: 0 }, deathmatch: { screenshots: 0, matches: 0 } };
    const all = new Set<string>();
    for (const tier of GAME_TIERS) {
      const pool = unseenPool(observed.candidates, usedState, tier);
      tiers[tier] = { screenshots: pool.length, matches: new Set(pool.map((c) => c.context.matchId)).size };
      for (const row of pool) all.add(row.context.matchId);
    }
    return { tiers, distinctMatches: all.size, asOf: observed.asOf };
  }
  select(state: GameState, tier: GameTier, fresh = true): RoundContext {
    const observed = fresh ? this.observations(true) : this.cache;
    if (!observed || this.assessmentError) throw new HttpError(503, 'GAME_UNAVAILABLE', 'Refresh the library before preparing.');
    const pool = unseenPool(observed.candidates, state, tier);
    if (!pool.length) throw new HttpError(422, 'EMPTY_POOL', 'No eligible unseen screenshots in this tier. Choose another tier or refresh after reviewing the library.');
    const index = this.drawIndex(pool.length);
    if (!Number.isSafeInteger(index) || index < 0 || index >= pool.length) throw new HttpError(503, 'SELECTION_UNAVAILABLE', 'Unable to select a candidate.');
    return pool[index].context;
  }
  private inspect(context: RoundContext, frozen: boolean) {
    const repo = createLibraryRepository(this.storage.db);
    let shot: ReturnType<typeof repo.getScreenshot>;
    try { shot = repo.getScreenshot(context.screenshotId); } catch (error) { if (error instanceof RecordNotFoundError) return null; throw error; }
    const asset = assessAsset(this.storage, shot);
    if (asset.status === 'unavailable') throw new HttpError(503, 'STORAGE_UNAVAILABLE', 'Screenshot storage is unavailable.');
    if (asset.status !== 'available' || !asset.bytes || canonicalJson(shot.image) !== canonicalJson(context.image)) return null;
    if (!frozen) {
      if (shot.matchId !== context.matchId || shot.revision !== context.screenshotRevision) return null;
      const parent = repo.getMatch(context.matchId);
      if (parent.revision !== context.matchRevision || !publicScreenshot(this.storage, shot, parent, asset.status).eligibility.eligible
        || classify(parent.obscurity, shot.difficulty).tier !== classify(context.obscurity, context.difficulty).tier) return null;
    }
    return asset.bytes;
  }
  pin(sessionId: string, roundId: string, context: RoundContext): void {
    const bytes = this.inspect(context, false);
    if (!bytes) throw new HttpError(409, 'CANDIDATE_CHANGED', 'The selected screenshot changed or became unavailable. Cancel preparation and try again.');
    this.pinned = { sessionId, roundId, context, bytes };
  }
  restore(sessionId: string, roundId: string, context: RoundContext): boolean {
    const bytes = this.inspect(context, true);
    if (!bytes) return false;
    this.pinned = { sessionId, roundId, context, bytes }; return true;
  }
  bytes(sessionId: string, roundId: string): Buffer | null {
    return this.pinned?.sessionId === sessionId && this.pinned.roundId === roundId ? this.pinned.bytes : null;
  }
  current(context: RoundContext, purpose: 'prepare' | 'reveal' | 'resume'): boolean {
    const bytes = this.inspect(context, purpose === 'resume');
    if (!bytes) return false;
    return !!this.pinned && canonicalJson(this.pinned.context) === canonicalJson(context);
  }
  /** Polling checks metadata only; file integrity is always checked on actual preparation/reveal. */
  metadataCurrent(context: RoundContext): boolean {
    try {
      const repo = createLibraryRepository(this.storage.db); const shot = repo.getScreenshot(context.screenshotId); const match = repo.getMatch(context.matchId);
      return shot.revision === context.screenshotRevision && shot.matchId === context.matchId && match.revision === context.matchRevision;
    } catch { return false; }
  }
  release(): void { this.pinned = null; }
  close(): void { this.stopped = true; this.release(); }
  get pinnedBytes(): number { return this.pinned?.bytes.length ?? 0; }
}
