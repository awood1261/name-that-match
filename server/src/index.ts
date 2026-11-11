import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { isHealthResponse, type HealthResponse } from '../../shared/src/health.js';
import { closeStorage, initializeStorage, type StorageOptions, type StorageSession } from './storage.js';
import { createGameHttp } from './game/http.js';
import { createLibraryHttp } from './library/http/dispatcher.js';
import { configuredOrigins, errorResponse, requestUrl as parseRequestUrl } from './library/http/protocol.js';

export const DEFAULT_PORT = 3001;
export const DEFAULT_HOST = '127.0.0.1';

export interface ServerOptions extends StorageOptions {
  port?: number;
  host?: string;
  production?: boolean;
  staticDir?: string;
}

export function getConfiguredHost(hostOverride?: string): string {
  return hostOverride ?? process.env.NAME_THAT_MATCH_HOST ?? DEFAULT_HOST;
}

export function getConfiguredPort(portOverride?: number): number {
  const envPort = Number(process.env.NAME_THAT_MATCH_PORT ?? process.env.PORT ?? DEFAULT_PORT);
  if (Number.isFinite(envPort) && envPort > 0) {
    return portOverride ?? envPort;
  }
  return portOverride ?? DEFAULT_PORT;
}

export function createHealthResponse(): HealthResponse {
  return {
    status: 'ok',
    service: 'name-that-match-server',
    timestamp: new Date().toISOString(),
  };
}

function getContentType(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();

  switch (extension) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.js':
      return 'application/javascript; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.svg':
      return 'image/svg+xml';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.ico':
      return 'image/x-icon';
    default:
      return 'application/octet-stream';
  }
}

function resolveStaticPath(staticDir: string, requestPath: string): string {
  const cleanPath = requestPath === '/' ? '/index.html' : requestPath;
  const candidate = path.resolve(staticDir, `.${cleanPath}`);

  if (!candidate.startsWith(path.resolve(staticDir))) {
    return path.join(staticDir, 'index.html');
  }

  return candidate;
}

function serveStaticAsset(res: http.ServerResponse, staticDir: string, requestPath: string): boolean {
  try {
    const filePath = resolveStaticPath(staticDir, requestPath);
    const indexFile = path.join(staticDir, 'index.html');
    const isIndexFallback = requestPath === '/' || requestPath === '';

    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      if (fs.existsSync(indexFile) && fs.statSync(indexFile).isFile()) {
        const html = fs.readFileSync(indexFile);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
        return true;
      }

      if (isIndexFallback) {
        throw new Error('Production build assets are missing. Run npm run build first.');
      }

      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Static asset not found' }));
      return true;
    }

    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': getContentType(filePath) });
    res.end(content);
    return true;
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unable to load static asset',
      }),
    );
    return true;
  }
}

export function createServer(port = DEFAULT_PORT, options: ServerOptions = {}) {
  const resolvedHost = getConfiguredHost(options.host);
  const resolvedPort = getConfiguredPort(port ?? options.port);
  const productionMode = Boolean(
    options.production ?? (process.argv.includes('--production') || process.env.NODE_ENV === 'production'),
  );
  const origins = configuredOrigins(productionMode);
  const storage = initializeStorage(options);
  const library = createLibraryHttp(storage, origins);
  let game: ReturnType<typeof createGameHttp>;
  try { game = createGameHttp(storage, origins, {}, { production: productionMode, host: resolvedHost }); }
  catch (error) { library.stop(); closeStorage(storage); throw error; }
  let storageReleased = false;
  const releaseStorage = () => {
    if (!storageReleased) {
      storageReleased = true;
      try { game.stop(); }
      finally { library.stop(); closeStorage(storage); }
    }
  };
  const staticDir = options.staticDir ?? (productionMode ? path.resolve(process.cwd(), 'dist') : undefined);

  const server = http.createServer((req, res) => {
    const requestUrl = req.url ?? '/';
    let url: URL;
    try { url = parseRequestUrl(requestUrl); }
    catch (error) { errorResponse(res, error); return; }

    if (url.pathname === '/health' || url.pathname === '/api/health') {
      const payload = createHealthResponse();
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(JSON.stringify(payload));
      return;
    }

    if (decodeURIComponent(url.pathname) === '/api/game' || decodeURIComponent(url.pathname).startsWith('/api/game/')) {
      void game.handle(req, res, url).catch((error: unknown) => errorResponse(res, error));
      return;
    }

    if (decodeURIComponent(url.pathname) === '/api' || decodeURIComponent(url.pathname).startsWith('/api/')) {
      void library.handle(req, res, url).catch((error: unknown) => errorResponse(res, error));
      return;
    }

    if (productionMode && staticDir) {
      if (req.method && req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
      }

      if (serveStaticAsset(res, staticDir, url.pathname)) {
        return;
      }
    }

    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  server.on('listening', () => {
    const address = server.address();
    const boundPort = address && typeof address !== 'string' ? address.port : resolvedPort;
    console.log(`Name That Match server listening on http://${resolvedHost}:${boundPort}`);
    console.log(`Storage initialized at ${storage.rootDir}`);
    if (productionMode) {
      console.log(`Production static assets served from ${staticDir}`);
    }
  });

  server.on('error', (error) => {
    releaseStorage();
    // Startup callers receive the error; report errors without a startup listener here.
    if (server.listenerCount('error') === 1) console.error('Server error:', error);
  });

  server.on('close', () => {
    releaseStorage();
  });

  return server;
}

export function startServer(port = DEFAULT_PORT, options: ServerOptions = {}) {
  return new Promise<http.Server>((resolve, reject) => {
    const server = createServer(port, options);
    const resolvedHost = getConfiguredHost(options.host);
    const resolvedPort = getConfiguredPort(port ?? options.port);
    const removeStartupListeners = () => {
      server.off('error', onError);
      server.off('listening', onListening);
    };
    const onError = (error: Error) => {
      removeStartupListeners();
      reject(error);
    };
    const onListening = () => {
      removeStartupListeners();
      resolve(server);
    };
    server.once('error', onError);
    server.once('listening', onListening);
    try {
      server.listen(resolvedPort, resolvedHost);
    } catch (error) {
      // Use the same release and rejection path for synchronous listen errors.
      server.emit('error', error);
    }
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const productionMode = process.argv.includes('--production') || process.env.NODE_ENV === 'production';
  const host = getConfiguredHost();
  const port = getConfiguredPort();

  void startServer(port, {
    host,
    production: productionMode,
  }).catch((error: unknown) => {
    console.error('Unable to start Name That Match server:', error);
    process.exitCode = 1;
  });
}

export { isHealthResponse };
export type { StorageSession };
