import type http from 'node:http';
import { randomUUID } from 'node:crypto';
import { setImmediate as defer, clearImmediate } from 'node:timers';
import { ImportError } from '../library/imports/contracts.js';
import type { StorageSession } from '../storage.js';
import { body, errorResponse, HttpError, json } from '../library/http/protocol.js';
import { GameError, id, parseCommand, parseCreateGame, record } from '../../../shared/src/game/validation.js';
import { currentRound, phase } from '../../../shared/src/game/engine.js';
import { hostSnapshot } from '../../../shared/src/game/projections.js';
import type { HostStatus } from '../../../shared/src/game/host.js';
import type { GameState, HostIntent, RoundContext } from '../../../shared/src/game/contracts.js';
import { GameRepository } from './repository.js';
import { GameService, type GameServiceOptions } from './service.js';
import { GameControl } from './control.js';
import { GameLibrary } from './library.js';
import { GameDisplays, parseDisplayReport } from './displays.js';

export function createGameHttp(storage: StorageSession, origins: Set<string>, runtime: Pick<GameServiceOptions, 'now' | 'schedule'> = {}) {
  const repo = new GameRepository(storage.db); const library = new GameLibrary(storage); const serverEpoch = randomUUID();
  let stopped = false; let sequence = 0; let preparationError: string | null = null;
  const jobs = new Map<string, ReturnType<typeof defer>>();
  const displays = new GameDisplays((sessionId) => {
    const state = service.state(sessionId); const round = currentRound(state);
    if (round?.phase === 'guessing') service.connectionLost(state.id, round.id, state.stateVersion, 'primary-display');
  }, runtime.now);
  const service = new GameService(repo, {
    ...runtime,
    hasEligibleMatches: () => library.availability(repo.current(), true).distinctMatches > 0,
    candidateCurrent: (context, purpose) => library.current(context, purpose),
    primaryReady: (roundId) => { const state = repo.current(); return !!state && displays.ready(state.id, roundId); },
  });
  const control = new GameControl(serverEpoch, () => {
    const state = repo.current(); const round = state && currentRound(state);
    if (state && round?.phase === 'guessing') service.connectionLost(state.id, round.id, state.stateVersion, 'host-connection');
  }, runtime.now);
  const recovered = repo.current(); const recoveredRound = recovered && currentRound(recovered);
  if (recovered && recoveredRound?.phase === 'ready') {
    try { library.pin(recovered.id, recoveredRound.id, recoveredRound.context); }
    catch { preparationError = 'The restored candidate needs review. Cancel preparation and try again.'; }
  }
  if (recovered && recoveredRound?.phase === 'paused') {
    try { if (!library.restore(recovered.id, recoveredRound.id, recoveredRound.context)) service.interruptImage(recovered.id, recoveredRound.id, recovered.stateVersion); }
    catch { preparationError = 'The paused clue could not be revalidated. Review local storage before continuing.'; }
  }
  const heartbeat = setInterval(() => { try { if (!stopped) { control.tick(); displays.tick(); } } catch { /* Storage failures remain explicit on the next host request. */ } }, 1000);
  heartbeat.unref();
  function status(state: GameState | null, fresh = false): HostStatus {
    if (state) state = service.state(state.id);
    const availability = library.availability(state, fresh);
    const observation = state ? service.observation(state.id) : null;
    if (observation) state = observation.state;
    const lastRound = state?.rounds[state.rounds.length - 1];
    const round = state && currentRound(state);
    let allowedActions: HostIntent['type'][] = [];
    if (!state) allowedActions = [];
    else if (state.status === 'setup') allowedActions = ['CONFIGURE_SETUP', 'DISCARD_SETUP', ...(availability.distinctMatches ? ['START' as const] : [])];
    else if (phase(state) === 'between_rounds') allowedActions = ['SELECT_CONTESTANT', 'PREPARE', 'END_GAME'];
    else if (round?.phase === 'ready' || round?.phase === 'preparing') allowedActions = ['CANCEL_UNEXPOSED'];
    const primaryDisplay = state ? displays.status(state.id, round?.id ?? null) : displays.status('', null);
    const candidateValid = !!round && round.phase === 'ready' && library.metadataCurrent(round.context) && library.pinnedBytes > 0;
    if (round?.phase === 'ready' && candidateValid && primaryDisplay.ready) allowedActions.push('REVEAL_AND_START');
    if (round?.phase === 'guessing') allowedActions = ['CORRECT', 'INCORRECT', 'PAUSE', 'VOID_EXPOSED'];
    if (round?.phase === 'paused') allowedActions = ['VOID_EXPOSED', ...(primaryDisplay.ready ? ['RESUME' as const] : [])];
    if (round?.phase === 'awaiting_judgment') allowedActions = ['CORRECT_BEFORE_BUZZER', 'CONFIRM_TIMEOUT', 'VOID_EXPOSED'];
    if (round?.phase === 'interrupted') allowedActions = ['VOID_INTERRUPTED'];
    if (round?.phase === 'adjudicated') allowedActions = ['REVEAL_ANSWER'];
    if (state?.status === 'active' && (round?.phase === 'answer_revealed' || (round?.phase === 'adjudicated' && round.outcome === 'void'))) allowedActions.push('ADVANCE');
    return { protocolVersion: 1, serverEpoch, sequence: ++sequence, snapshot: state ? hostSnapshot(state) : null, availability, allowedActions,
      candidateValid, primaryDisplay,
      timing: observation && 'remainingMs' in observation.snapshot ? { serverMonoMs: observation.serverMonoMs, remainingMs: observation.snapshot.remainingMs } : null,
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
      try { service.close(); } finally { library.release(); control.close(); displays.close(); }
    },
    async handle(req: http.IncomingMessage, res: http.ServerResponse, url: URL) {
      let requestSession: string | undefined; let authorizedHost = false;
      try {
        if (stopped || !storage.db.open) throw new HttpError(503, 'GAME_UNAVAILABLE', 'Game storage is shutting down.');
        const origin = req.headers.origin;
        if ((origin !== undefined && !origins.has(origin)) || req.method === 'OPTIONS') throw new HttpError(403, 'ORIGIN_REJECTED', 'Use the configured local application origin.');
        if (req.method !== 'GET' && (!origin || !origins.has(origin) || req.headers['x-name-that-match'] !== 'game')) throw new HttpError(403, 'GAME_HEADER_REQUIRED', 'Use the game application origin and mutation header.');
        const route = decodeURIComponent(url.pathname);
        const displayStatus = route.match(/^\/api\/game\/sessions\/([^/]+)\/displays\/([^/]+)\/status$/);
        const imageRoute = route.match(/^\/api\/game\/sessions\/([^/]+)\/rounds\/([^/]+)\/image$/);
        const session = route.match(/^\/api\/game\/sessions\/([^/]+)(?:\/(commands|displays)(?:\/([^/]+))?)?$/);
        if (session) requestSession = id(session[1]);
        if (displayStatus || imageRoute) requestSession = id((displayStatus ?? imageRoute)![1]);
        if (session?.[2] === 'displays' && session[3]) throw new HttpError(404, 'NOT_FOUND', 'Game route not found.');
        const lease = /^\/api\/game\/control-lease(?:\/(renew|release))?$/.exec(route);
        const methods = displayStatus ? ['POST'] : imageRoute ? ['GET'] : lease ? ['POST'] : route === '/api/game/current' ? ['GET'] : route === '/api/game/sessions' ? ['POST']
          : session ? session[2] === 'commands' ? session[3] ? ['GET'] : ['POST'] : session[2] === 'displays' ? ['POST'] : ['GET'] : [];
        if (!methods.length) throw new HttpError(404, 'NOT_FOUND', 'Game route not found.');
        if (!methods.includes(req.method ?? '')) throw new HttpError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed.', methods.join(', '));
        const refresh = route === '/api/game/current' && url.searchParams.get('refresh') === 'true';
        if ([...url.searchParams].length && !(refresh && [...url.searchParams].length === 1)) throw new HttpError(400, 'INVALID_QUERY', 'Unsupported game query.');
        if (lease && !lease[1]) {
          record(await body(req, 16 * 1024), []); json(res, 200, { data: control.claim() }); return;
        }
        const role = access(req, requestSession, !(displayStatus || imageRoute) && (!session || !!session[2])); authorizedHost = role === 'host';
        displays.tick();
        if (displayStatus) {
          if (role !== 'display') throw new HttpError(403, 'DISPLAY_REQUIRED', 'Use a read-only display capability.');
          const report = parseDisplayReport(await body(req, 16 * 1024)); access(req, requestSession, false);
          const state = service.state(requestSession!); const round = currentRound(state);
          const asset = round && ['ready', 'guessing', 'paused'].includes(round.phase) && library.bytes(state.id, round.id) ? { roundId: round.id, imageKey: round.id } : null;
          const transport = displays.report(state.id, id(displayStatus[2]), token(req)!, report, asset?.imageKey ?? null);
          const observation = service.observation(state.id);
          json(res, 200, { data: { protocolVersion: 1, serverEpoch, sequence: ++sequence, ...transport, sample: { ...transport.sample, serverMonoMs: observation.serverMonoMs }, snapshot: observation.snapshot, asset } }); return;
        }
        if (imageRoute) {
          const state = service.state(requestSession!); const roundId = id(imageRoute[2]); const round = currentRound(state);
          if (!round || round.id !== roundId || !['ready', 'guessing', 'paused'].includes(round.phase)) throw new HttpError(404, 'IMAGE_NOT_AVAILABLE', 'No current clue is available for preload.');
          const bytes = library.bytes(state.id, roundId);
          if (!bytes) throw new HttpError(422, 'IMAGE_UNAVAILABLE', 'The current clue is unavailable.');
          res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': bytes.length, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(bytes); return;
        }
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
            json(res, 200, { data: role === 'host' ? status(state) : { protocolVersion: 1, serverEpoch, sequence: ++sequence, snapshot: service.snapshot(state.id, 'display') } });
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
          const values = record(input, ['primary', 'displayId']); const state = service.state(requestSession!); const round = currentRound(state);
          if (values.primary !== undefined && typeof values.primary !== 'boolean') throw new GameError('validation', 'Invalid primary designation');
          if ((values.primary || values.displayId) && round && round.phase !== 'paused') throw new HttpError(409, 'PRIMARY_CHANGE_BLOCKED', 'Designate the primary between rounds or while paused. Cancel preparation first.');
          if (values.displayId) { displays.designate(state.id, id(values.displayId)); json(res, 200, { data: status(state) }); return; }
          const capability = control.viewer(token(req)!, requestSession!);
          const displayId = displays.add(state.id, capability);
          if (values.primary) displays.designate(state.id, displayId);
          json(res, 201, { data: { token: capability, serverEpoch, displayId } }); return;
        }
        const command = parseCommand(input);
        if (command.sessionId !== requestSession) throw new HttpError(400, 'SESSION_MISMATCH', 'Command session does not match its URL.');
        // M2 exposes preparation and the existing domain lane; no browser can supply readiness.
        let selected: RoundContext | null = null;
        if (command.type === 'RESUME' && !repo.receipt(command.commandId)) {
          const state = service.state(command.sessionId); const round = currentRound(state);
          if (state.stateVersion === command.expectedStateVersion && round?.phase === 'paused' && !library.current(round.context, 'resume')) {
            service.interruptImage(state.id, round.id, state.stateVersion); library.release();
            throw new HttpError(422, 'CLUE_UNAVAILABLE', 'The paused clue changed or is unavailable. This interrupted round must be voided.');
          }
        }
        if (command.type === 'PREPARE' && !repo.receipt(command.commandId)) {
          const state = service.state(command.sessionId);
          if (state.stateVersion !== command.expectedStateVersion || phase(state) !== 'between_rounds') {
            service.execute(command); // use the domain's own revision/phase error
          }
          selected = library.select(state, command.payload.tier); access(req, requestSession);
        }
        const result = service.execute(command);
        if (command.type === 'PREPARE' && selected && !result.replayed) { preparationError = null; processPreparation(result.state, selected); }
        if (!result.replayed && (command.type === 'ADVANCE' || command.type === 'CANCEL_UNEXPOSED' || command.type === 'END_GAME' || command.type === 'DISCARD_SETUP')) { library.release(); preparationError = null; }
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
