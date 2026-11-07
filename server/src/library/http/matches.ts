import type http from 'node:http';
import type { Match, MatchFields } from '../../../../shared/src/library.js';
import type { MatchSummary } from '../../../../shared/src/matches.js';
import type { StorageSession } from '../../storage.js';
import { createLibraryRepository } from '../repository.js';
import { DomainValidationError, EMPTY_MATCH, knownFields, missingMatchFields, object, requireId, requireRevision } from '../validation.js';
import { publicScreenshot } from '../assets.js';
import { body, HttpError, HttpFieldError, json } from './protocol.js';

function summary(match: Match): MatchSummary {
  const missingFields = missingMatchFields(match); return { ...match, complete: missingFields.length === 0, missingFields };
}
function matchWrite<T>(operation: () => T): T {
  try { return operation(); }
  catch (error) { if (error instanceof DomainValidationError) throw new HttpFieldError(error.fieldErrors); throw error; }
}
export async function matchRoutes(req: http.IncomingMessage, res: http.ServerResponse, url: URL, storage: StorageSession, limit: number) {
  const path = decodeURIComponent(url.pathname); const repository = createLibraryRepository(storage.db);
  if (path === '/api/matches') {
    if (req.method === 'GET') {
      const rows = storage.db.prepare('SELECT id FROM matches ORDER BY created_at DESC,id ASC').all() as Array<{ id: string }>;
      const matches = rows.map(({ id }) => summary(repository.getMatch(id)));
      json(res, 200, { data: { matches, matchedCount: matches.length, asOf: new Date().toISOString() } });
    } else {
      const fields = object(await body(req, limit)); knownFields(fields, Object.keys(EMPTY_MATCH));
      json(res, 201, { data: summary(matchWrite(() => repository.createMatch(fields))) });
    }
  } else if (path.startsWith('/api/matches/')) {
    const id = requireId(path.split('/')[3]); const input = object(await body(req, limit));
    knownFields(input, ['expectedRevision', 'changes']); requireRevision(input.expectedRevision);
    const changes = object(input.changes); knownFields(changes, Object.keys(EMPTY_MATCH));
    const result = matchWrite(() => repository.updateMatch(id, input.expectedRevision as number, changes as Partial<MatchFields>));
    json(res, 200, { data: { ...result, match: summary(result.match) } });
  } else if (path === '/api/screenshots/assignments') {
    const input = object(await body(req, limit)); knownFields(input, ['targetMatchId', 'expectedMatchRevision', 'screenshots']);
    const records = repository.assignScreenshots(requireId(input.targetMatchId, 'targetMatchId'), requireRevision(input.expectedMatchRevision, 'expectedMatchRevision'), input.screenshots);
    json(res, 200, { data: { screenshots: records.map((record) => publicScreenshot(storage, record)) } });
  } else {
    const id = requireId(path.split('/')[3]); const input = object(await body(req, limit));
    knownFields(input, ['expectedRevision', 'changes', 'expectedMatchRevision']); requireRevision(input.expectedRevision);
    if ('expectedMatchRevision' in input) requireRevision(input.expectedMatchRevision, 'expectedMatchRevision');
    const changes = object(input.changes); knownFields(changes, ['matchId']);
    if ('matchId' in changes && changes.matchId !== null) requireId(changes.matchId, 'matchId');
    if (changes.matchId !== undefined && changes.matchId !== null) requireRevision(input.expectedMatchRevision, 'expectedMatchRevision');
    // Difficulty, notes and review changes have no public entry point in Milestone 4.
    if (req.method !== 'PATCH') throw new HttpError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed.', 'PATCH');
    const record = repository.updateScreenshot(id, input.expectedRevision as number, changes, input.expectedMatchRevision as number | undefined);
    json(res, 200, { data: publicScreenshot(storage, record) });
  }
}
