import type http from 'node:http';
import { randomUUID } from 'node:crypto';
import { setImmediate as defer, clearImmediate } from 'node:timers';
import { ImportError } from '../library/imports/contracts.js';
import type { StorageSession } from '../storage.js';
import { body, errorResponse, HttpError, json } from '../library/http/protocol.js';
import { GameError, id, parseCommand, parseCreateGame, record } from '../../../shared/src/game/validation.js';
import { currentRound, phase } from '../../../shared/src/game/engine.js';
import { hostSnapshot, displaySnapshot } from '../../../shared/src/game/projections.js';
import type { HostStatus } from '../../../shared/src/game/host.js';
import type { GameState, HostIntent, RoundContext } from '../../../shared/src/game/contracts.js';
import { GameRepository } from './repository.js';
import { GameService } from './service.js';
import { GameControl } from './control.js';
import { GameLibrary } from './library.js';

export function createGameHttp(storage: StorageSession, origins: Set<string>) {
  const repo = new GameRepository(storage.db); const library = new GameLibrary(storage); const serverEpoch = randomUUID();
  let stopped = false; let sequence = 0; let preparationError: string | null = null;
  const jobs = new Map<string, ReturnType<typeof defer>>();
  const service = new GameService(repo, {
    hasEligibleMatches: () => library.availability(repo.current(), true).distinctMatches > 0,
    candidateCurrent: (context, purpose) => library.current(context, purpose),
    // M2 has no display readiness adapter. Host payloads cannot override this gate.
    primaryReady: () => false,
  });
  const control = new GameControl(serverEpoch, () => {
    const state = repo.current(); const round = state && currentRound(state);
    if (state && round?.phase === 'guessing') service.connectionLost(state.id, round.id, state.stateVersion, 'host-connection');
  });
  const recovered = repo.current(); const recoveredRound = recovered && currentRound(recovered);
  if (recovered && recoveredRound?.phase === 'ready') {
    try { library.pin(recovered.id, recoveredRound.id, recoveredRound.context); }
    catch { preparationError = 'The restored candidate needs review. Cancel preparation and try again.'; }
  }
  const heartbeat = setInterval(() => { try { if (!stopped) control.tick(); } catch { /* Storage failures remain explicit on the next host request. */ } }, 1000);
  heartbeat.unref();
  function status(state: GameState | null, fresh = false): HostStatus {
    const lastRound = state?.rounds[state.rounds.length - 1];
    const round = state && currentRound(state); const availability = library.availability(state, fresh);
    let allowedActions: HostIntent['type'][] = [];
    if (!state) allowedActions = [];
    else if (state.status === 'setup') allowedActions = ['CONFIGURE_SETUP', 'DISCARD_SETUP', ...(availability.distinctMatches ? ['START' as const] : [])];
    else if (phase(state) === 'between_rounds') allowedActions = ['SELECT_CONTESTANT', 'PREPARE', 'END_GAME'];
    else if (round?.phase === 'ready' || round?.phase === 'preparing') allowedActions = ['CANCEL_UNEXPOSED'];
    return { protocolVersion: 1, serverEpoch, sequence: ++sequence, snapshot: state ? hostSnapshot(state) : null, availability, allowedActions,
      candidateValid: !!round && round.phase === 'ready' && library.metadataCurrent(round.context) && library.pinnedBytes > 0,
      primaryDisplay: { ready: false, message: 'A connected, synchronized contestant display is required. You can prepare or cancel; live display controls are not available yet.' },
      preparationError: preparationError ?? (lastRound?.phase === 'cancelled' && lastRound.cancelReason === 'preparation-failed' ? 'The last preparation failed. Refresh availability and prepare another candidate.' : null) };
  }
  function processPreparation(state: GameState, context: RoundContext): void {
    const round = currentRound(state)!;
    if (jobs.has(round.id) || round.phase !== 'preparing') return;
    jobs.set(round.id, defer(() => {
      jobs.delete(round.id); if (stopped || !storage.db.open) return;
      try {
        const current = service.state(state.id);
        if (current.stateVersion !== state.stateVersion || current.currentRoundId !== round.id) return;
        library.pin(state.id, round.id, context);
        if (!service.completePreparation(state.id, round.id, state.stateVersion, context)) library.release();
      } catch {
        library.release(); preparationError = 'The selected screenshot changed or could not be verified. Refresh availability and try again.';
        try { service.failPreparation(state.id, round.id, state.stateVersion); } catch { /* The service blocks unsafe mutations on storage failure. */ }
      }
    }));
  }
  const token = (req: http.IncomingMessage) => /^Bearer ([a-f0-9]{64})$/.exec(req.headers.authorization ?? '')?.[1];
  function access(req: http.IncomingMessage, sessionId?: string, hostOnly = true): string {
    const role = control.authorize(token(req), sessionId);
    if (hostOnly && role !== 'host') throw new HttpError(403, 'HOST_REQUIRED', 'Contestant displays are read-only.');
    if (req.headers['x-name-that-match-epoch'] !== serverEpoch) throw new HttpError(409, 'SERVER_EPOCH_CHANGED', 'The server restarted. Reclaim control and review the recovered session.');
    return role;
  }
  const lifecycle = {
    stop() {
      if (stopped) return; stopped = true; clearInterval(heartbeat);
      for (const job of jobs.values()) clearImmediate(job); jobs.clear();
      try { service.close(); } finally { library.release(); control.close(); }
    },
    async handle(req: http.IncomingMessage, res: http.ServerResponse, url: URL) {
      let requestSession: string | undefined; let authorizedHost = false;
      try {
        if (stopped || !storage.db.open) throw new HttpError(503, 'GAME_UNAVAILABLE', 'Game storage is shutting down.');
        const origin = req.headers.origin;
        if ((origin !== undefined && !origins.has(origin)) || req.method === 'OPTIONS') throw new HttpError(403, 'ORIGIN_REJECTED', 'Use the configured local application origin.');
        if (req.method !== 'GET' && (!origin || !origins.has(origin) || req.headers['x-name-that-match'] !== 'game')) throw new HttpError(403, 'GAME_HEADER_REQUIRED', 'Use the game application origin and mutation header.');
        const route = decodeURIComponent(url.pathname); const session = route.match(/^\/api\/game\/sessions\/([^/]+)(?:\/(commands|displays)(?:\/([^/]+))?)?$/);
        if (session) requestSession = id(session[1]);
        if (session?.[2] === 'displays' && session[3]) throw new HttpError(404, 'NOT_FOUND', 'Game route not found.');
        const lease = /^\/api\/game\/control-lease(?:\/(renew|release))?$/.exec(route);
        const methods = lease ? ['POST'] : route === '/api/game/current' ? ['GET'] : route === '/api/game/sessions' ? ['POST']
          : session ? session[2] === 'commands' ? session[3] ? ['GET'] : ['POST'] : session[2] === 'displays' ? ['POST'] : ['GET'] : [];
        if (!methods.length) throw new HttpError(404, 'NOT_FOUND', 'Game route not found.');
        if (!methods.includes(req.method ?? '')) throw new HttpError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed.', methods.join(', '));
        const refresh = route === '/api/game/current' && url.searchParams.get('refresh') === 'true';
        if ([...url.searchParams].length && !(refresh && [...url.searchParams].length === 1)) throw new HttpError(400, 'INVALID_QUERY', 'Unsupported game query.');
        if (lease && !lease[1]) {
          record(await body(req, 16 * 1024), []); json(res, 200, { data: control.claim() }); return;
        }
        const role = access(req, requestSession, !session || !!session[2]); authorizedHost = role === 'host';
        if (lease) {
          record(await body(req, 16 * 1024), []); access(req);
          if (lease[1] === 'renew') control.renew(token(req)!); else control.release(token(req)!);
          json(res, 200, { data: { serverEpoch, released: lease[1] === 'release' } }); return;
        }
        if (req.method === 'GET') {
          if (route === '/api/game/current') json(res, 200, { data: status(repo.current(), refresh) });
          else if (session?.[3]) {
            const receipt = repo.receipt(id(session[3]));
            if (!receipt || receipt.receipt.sessionId !== requestSession) throw new HttpError(404, 'RECEIPT_NOT_FOUND', 'No accepted receipt found. Review current state before deliberately retrying the original request.');
            json(res, 200, { data: { receipt: receipt.receipt, status: status(service.state(requestSession!)) } });
          } else {
            const state = service.state(requestSession!);
            json(res, 200, { data: role === 'host' ? status(state) : { protocolVersion: 1, serverEpoch, sequence: ++sequence, snapshot: displaySnapshot(state, null, 0) } });
          }
          return;
        }
        const input = await body(req, 16 * 1024); access(req, requestSession);
        if (route === '/api/game/sessions') {
          const parsed = parseCreateGame(input); requestSession = parsed.sessionId;
          const result = service.create(parsed); if (!result.replayed) preparationError = null;
          json(res, result.replayed ? 200 : 201, { data: { receipt: result.receipt, replayed: result.replayed, status: status(result.state) } }); return;
        }
        if (session?.[2] === 'displays') {
          record(input, []); service.state(requestSession!);
          const capability = control.viewer(token(req)!, requestSession!);
          json(res, 201, { data: { token: capability, serverEpoch } }); return;
        }
        const command = parseCommand(input);
        if (command.sessionId !== requestSession) throw new HttpError(400, 'SESSION_MISMATCH', 'Command session does not match its URL.');
        // M2 exposes preparation and the existing domain lane; no browser can supply readiness.
        let selected: RoundContext | null = null;
        if (command.type === 'PREPARE' && !repo.receipt(command.commandId)) {
          const state = service.state(command.sessionId);
          if (state.stateVersion !== command.expectedStateVersion || phase(state) !== 'between_rounds') {
            service.execute(command); // use the domain's own revision/phase error
          }
          selected = library.select(state, command.payload.tier); access(req, requestSession);
        }
        const result = service.execute(command);
        if (command.type === 'PREPARE' && selected && !result.replayed) { preparationError = null; processPreparation(result.state, selected); }
        if (!result.replayed && (command.type === 'CANCEL_UNEXPOSED' || command.type === 'END_GAME' || command.type === 'DISCARD_SETUP')) { library.release(); preparationError = null; }
        json(res, command.type === 'PREPARE' && !result.replayed ? 202 : 200, { data: { receipt: result.receipt, replayed: result.replayed, status: status(result.state) } });
      } catch (error) {
        if (!req.complete) { res.setHeader('Connection', 'close'); req.resume(); }
        if (error instanceof GameError) {
          const codes = { validation: 400, conflict: 409, invalid_transition: 409, empty_pool: 422, not_ready: 422, unavailable: 503, limit: 409, not_found: 404 };
          let currentRevision: number | undefined;
          if (authorizedHost && requestSession && error.code === 'conflict') { try { currentRevision = repo.load(requestSession).stateVersion; } catch { /* no private data in failure */ } }
          json(res, codes[error.code], { error: { code: error.code.toUpperCase(), message: error.message === 'Stale game revision' ? 'The session changed. Review the refreshed state before retrying.' : error.message, ...(currentRevision ? { currentRevision } : {}) } });
        } else errorResponse(res, error instanceof HttpError || error instanceof ImportError ? error : new HttpError(503, 'GAME_UNAVAILABLE', 'Local game storage or assets are unavailable. Review the session before retrying.'));
      }
    },
  };
  return lifecycle;
}
