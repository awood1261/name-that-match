import type http from 'node:http';
import { setImmediate } from 'node:timers/promises';
import type { BatchStatus, ImportItem } from '../../../../shared/src/imports.js';
import type { StorageSession } from '../../storage.js';
import { getImportEngine } from '../imports/engine.js';
import { knownFields, object, requireId, requireRevision } from '../validation.js';
import { imageBytes, listScreenshots } from '../assets.js';
import { body, chunks, errorResponse, HttpError, json, media, mutationPolicy } from './protocol.js';
import { statistics } from '../catalog.js';
import { matchRoutes } from './matches.js';

export function createLibraryHttp(storage: StorageSession, origins: Set<string>) {
  const engine = getImportEngine(storage); const active = new Map<string, Promise<void>>(); const shutdown = new AbortController();
  const projectItem = (batchId: string, item: ReturnType<typeof engine.status>['items'][number]): ImportItem => {
    const { uploadRelativePath, ...record } = item;
    const uploadable = Boolean(uploadRelativePath) && (['awaiting_upload', 'staged', 'ready'].includes(item.state) || (item.state === 'failed' && item.retryable));
    return { ...record, uploadUrl: uploadable
      ? `/api/imports/${batchId}/items/${item.id}/image` : null };
  };
  const projectBatch = (batchId: string): BatchStatus => {
    const batch = engine.status(batchId); const classificationCounts: Record<string, number> = {};
    for (const item of batch.items) if (item.classification) classificationCounts[item.classification] = (classificationCounts[item.classification] ?? 0) + 1;
    return { ...batch, items: batch.items.map((item) => projectItem(batchId, item)), classificationCounts };
  };
  function process(batchId: string) {
    if (shutdown.signal.aborted || active.has(batchId)) return;
    const work = setImmediate().then(() => {
      if (!shutdown.signal.aborted) return engine.processBatch(batchId, shutdown.signal);
    }).then(() => {}, () => {
      // The engine persists per-item/batch errors. Never leak SQL/paths or leave a rejected task.
    }).finally(() => active.delete(batchId));
    active.set(batchId, work);
  }
  return {
    stop() { shutdown.abort(); },
    async handle(req: http.IncomingMessage, res: http.ServerResponse, url: URL) {
      try {
        if (shutdown.signal.aborted || !storage.db.open) throw new HttpError(503, 'STORAGE_UNAVAILABLE', 'Library storage is shutting down.');
        const path = decodeURIComponent(url.pathname);
        const batchRoute = path.match(/^\/api\/imports\/([^/]+)(?:\/(preview|confirm))?$/);
        const uploadRoute = path.match(/^\/api\/imports\/([^/]+)\/items\/([^/]+)\/image$/);
        const imageRoute = path.match(/^\/api\/screenshots\/([^/]+)\/image$/);
        const matchRoute = /^\/api\/matches\/[^/]+$/.test(path);
        const assignmentRoute = path === '/api/screenshots/assignments';
        const screenshotEdit = !assignmentRoute && /^\/api\/screenshots\/[^/]+$/.test(path);
        const methods = path === '/api/imports' ? ['GET', 'POST'] : batchRoute ? batchRoute[2] ? ['POST'] : ['GET']
          : uploadRoute ? ['PUT'] : imageRoute ? ['GET', 'HEAD'] : path === '/api/screenshots' ? ['GET']
          : path === '/api/library/statistics' ? ['GET'] : path === '/api/matches' ? ['GET', 'POST'] : matchRoute || screenshotEdit ? ['PATCH'] : assignmentRoute ? ['POST'] : [];
        if (req.method === 'OPTIONS') mutationPolicy(req, origins);
        if (!methods.length) throw new HttpError(404, 'NOT_FOUND', 'Library route not found.');
        if (!methods.includes(req.method ?? '')) throw new HttpError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed.', methods.join(', '));
        if (!['GET', 'HEAD'].includes(req.method!)) mutationPolicy(req, origins);
        if (path !== '/api/screenshots' && !(path === '/api/matches' && req.method === 'GET') && [...url.searchParams].length) throw new HttpError(400, 'INVALID_QUERY', 'This route accepts no query parameters.');
        if (path === '/api/matches' || matchRoute || screenshotEdit || assignmentRoute) {
          await matchRoutes(req, res, url, storage, engine.limits.jsonBytes);
        } else if (path === '/api/library/statistics') {
          json(res, 200, { data: statistics(storage) });
        } else if (path === '/api/imports') {
          if (req.method === 'POST') {
            const batch = engine.createBatch(await body(req, engine.limits.jsonBytes)); json(res, 201, { data: projectBatch(batch.id) });
          } else {
            const ids = storage.db.prepare('SELECT id FROM import_batches ORDER BY created_at DESC,id ASC LIMIT 20').all() as Array<{ id: string }>;
            json(res, 200, { data: ids.map(({ id }) => {
              const { items, ...summary } = projectBatch(id); void items; return summary;
            }) });
          }
        } else if (uploadRoute) {
          requireId(uploadRoute[1], 'batchId'); requireId(uploadRoute[2], 'itemId'); media(req, 'image/png');
          const item = await engine.uploadImage(uploadRoute[1], uploadRoute[2], chunks(req, engine.limits.imageBytes));
          json(res, 200, { data: projectItem(uploadRoute[1], item) });
        } else if (batchRoute) {
          const id = requireId(batchRoute[1], 'batchId');
          if (batchRoute[2] === 'preview') {
            const input = object(await body(req, engine.limits.jsonBytes)); knownFields(input, ['expectedRevision']);
            engine.preview(id, requireRevision(input.expectedRevision)); json(res, 200, { data: projectBatch(id) });
          } else if (batchRoute[2] === 'confirm') {
            engine.confirm(id, await body(req, engine.limits.jsonBytes));
            json(res, ['completed', 'partial_success', 'failed'].includes(engine.status(id).status) ? 200 : 202, { data: projectBatch(id) });
            process(id);
          } else json(res, 200, { data: projectBatch(id) });
        } else if (imageRoute) {
          const bytes = imageBytes(storage, requireId(imageRoute[1]));
          res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': bytes.length, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
          res.end(req.method === 'HEAD' ? undefined : bytes);
        } else json(res, 200, { data: listScreenshots(storage, url.searchParams) });
      } catch (error) {
        // Keep an oversized/failed request from being reused; do not buffer the remaining body.
        if (!req.complete) { res.setHeader('Connection', 'close'); req.resume(); }
        errorResponse(res, error);
      }
    },
  };
}
