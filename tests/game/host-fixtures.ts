import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { StorageSession } from '../../server/src/storage';
import { createLibraryRepository } from '../../server/src/library/repository';
import { validatePng } from '../../server/src/library/imports/png';
import { DEFAULT_IMPORT_LIMITS } from '../../server/src/library/imports/limits';
import { capture, png } from '../imports/fixtures';
import type { Obscurity, VisualDifficulty } from '../../shared/src/library';
export function eligibleCapture(storage: StorageSession, options: { obscurity?: Obscurity; difficulty?: VisualDifficulty; bytes?: Buffer; matchId?: string; approved?: boolean } = {}) {
  const repo = createLibraryRepository(storage.db);
  const match = options.matchId ? repo.getMatch(options.matchId) : repo.createMatch({ participantDescription: 'Alpha vs Beta', promotion: 'Local Wrestling', event: 'Fixture Show', obscurity: options.obscurity ?? 'low' });
  const bytes = options.bytes ?? png; const image = validatePng(bytes, { ...DEFAULT_IMPORT_LIMITS });
  const metadata = capture(randomUUID()).metadata; metadata.image.width = image.width; metadata.image.height = image.height;
  let shot = repo.insertCommittedScreenshot({ provenance: metadata, originalMetadataJson: JSON.stringify(metadata), image });
  fs.writeFileSync(path.join(storage.rootDir, shot.imagePath), bytes);
  shot = repo.updateScreenshot(shot.id, shot.revision, { matchId: match.id, difficulty: options.difficulty ?? 'easy' }, match.revision);
  if (options.approved !== false) {
    storage.db.prepare("UPDATE screenshots SET review_status='approved',revision=revision+1 WHERE id=?").run(shot.id); shot = repo.getScreenshot(shot.id);
  }
  return { repo, match, shot, bytes };
}
