import type http from 'node:http';
import type { MatchFields, ReviewStatus } from '../../../../shared/src/library.js';
import type { StorageSession } from '../../storage.js';
import { createLibraryRepository } from '../repository.js';
import { DomainValidationError, EMPTY_MATCH, knownFields, object, requireId, requireRevision } from '../validation.js';
import { catalog, matchList } from '../catalog.js';
import { assessAsset, publicScreenshot } from '../assets.js';
import { body, HttpError, HttpFieldError, json } from './protocol.js';

function matchWrite<T>(operation: () => T): T {
  try { return operation(); }
  catch (error) { if (error instanceof DomainValidationError) throw new HttpFieldError(error.fieldErrors); throw error; }
}
export async function matchRoutes(req: http.IncomingMessage, res: http.ServerResponse, url: URL, storage: StorageSession, limit: number) {
  const path = decodeURIComponent(url.pathname); const repository = createLibraryRepository(storage.db);
  const write = <T,>(operation: () => T): T => matchWrite(() => storage.db.transaction(operation).immediate());
  if (path === '/api/matches') {
    if (req.method === 'GET') {
      json(res, 200, { data: matchList(storage, url.searchParams) });
    } else {
      const fields = object(await body(req, limit)); knownFields(fields, Object.keys(EMPTY_MATCH));
      const data = write(() => {
        const record = repository.createMatch(fields);
        return catalog(storage).matches.find((match) => match.id === record.id)!;
      });
      json(res, 201, { data });
    }
  } else if (path.startsWith('/api/matches/')) {
    const id = requireId(path.split('/')[3]); const input = object(await body(req, limit));
    knownFields(input, ['expectedRevision', 'changes']); requireRevision(input.expectedRevision);
    const changes = object(input.changes); knownFields(changes, Object.keys(EMPTY_MATCH));
    const data = write(() => {
      const result = repository.updateMatch(id, input.expectedRevision as number, changes as Partial<MatchFields>);
      return { ...result, match: catalog(storage).matches.find((match) => match.id === result.match.id)! };
    });
    json(res, 200, { data });
  } else if (path === '/api/screenshots/assignments') {
    const input = object(await body(req, limit)); knownFields(input, ['targetMatchId', 'expectedMatchRevision', 'screenshots']);
    const targetId = requireId(input.targetMatchId, 'targetMatchId'); const revision = requireRevision(input.expectedMatchRevision, 'expectedMatchRevision');
    const screenshots = storage.db.transaction(() => repository.assignScreenshots(targetId, revision, input.screenshots).map((record) => publicScreenshot(storage, record))).immediate();
    json(res, 200, { data: { screenshots } });
  } else {
    const id = requireId(path.split('/')[3]); const input = object(await body(req, limit));
    knownFields(input, ['expectedRevision', 'changes', 'reviewStatus', 'expectedMatchRevision']); requireRevision(input.expectedRevision);
    if ('expectedMatchRevision' in input) requireRevision(input.expectedMatchRevision, 'expectedMatchRevision');
    if ('reviewStatus' in input) {
      if ('changes' in input) throw new HttpError(400, 'INVALID_REQUEST', 'Review and editing must be separate requests.');
      const assetStatus = assessAsset(storage, repository.getScreenshot(id)).status;
      const data = write(() => {
        const record = repository.reviewScreenshot(id, input.expectedRevision as number, input.reviewStatus as ReviewStatus, input.expectedMatchRevision as number | undefined,
        (current, parent) => {
          const reasons = publicScreenshot(storage, current, parent, assetStatus).eligibility.reasons.filter((reason) => !['pending_review', 'rejected_review'].includes(reason));
          if (reasons.length) throw new HttpFieldError({ reviewStatus: `Cannot approve: ${reasons.join(', ')}` });
        });
        return publicScreenshot(storage, record, undefined, assetStatus);
      });
      json(res, 200, { data }); return;
    }
    const changes = object(input.changes); knownFields(changes, ['matchId', 'difficulty', 'notes']);
    if ('matchId' in changes && changes.matchId !== null) requireId(changes.matchId, 'matchId');
    if (changes.matchId !== undefined && changes.matchId !== null) requireRevision(input.expectedMatchRevision, 'expectedMatchRevision');
    if (req.method !== 'PATCH') throw new HttpError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed.', 'PATCH');
    const data = write(() => publicScreenshot(storage, repository.updateScreenshot(id, input.expectedRevision as number, changes, input.expectedMatchRevision as number | undefined)));
    json(res, 200, { data });
  }
}
