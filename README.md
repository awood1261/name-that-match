# Name That Match

Name That Match is a local-first wrestling trivia application foundation built with React, Vite, and a local Node server. The project is intentionally focused on a scalable local foundation: an app shell, local persistence, browser-safe static serving, and reusable design tokens.

## Overview

- React + TypeScript client shell for the foundation UI
- Local Node.js server for health checks and production static serving
- SQLite-backed local metadata initialization without feature tables yet
- Configurable local data directory for SQLite and screenshot assets
- Offline-safe startup with no cloud dependency

## Requirements

- Node.js 20.x
- npm 10.x

## Development startup

```bash
npm install
npm run dev
```

This starts:

- the Vite client at http://localhost:5173
- the local server at http://localhost:3001

## Production startup

Build the client and server first:

```bash
npm run build
```

Then start the production server:

```bash
npm run prod
```

The production server serves the built client from the local `dist` directory and keeps the health endpoint available at the same origin:

- http://localhost:3001/
- http://localhost:3001/api/health

## Configuration

The application uses a predictable local data directory:

- override: `NAME_THAT_MATCH_DATA_DIR`
- default: `./data`

Network binding can be configured explicitly:

- `NAME_THAT_MATCH_HOST` (default: `127.0.0.1`)
- `NAME_THAT_MATCH_PORT` (default: `3001`)

To expose the app on the local Wi‑Fi network intentionally, set:

```bash
NAME_THAT_MATCH_HOST=0.0.0.0 npm run prod
```

This should only be used in trusted environments. Exposing the local server to a Wi‑Fi network can allow other devices on that network to reach the app if the machine is configured to accept external connections. The server is not a remote admin interface and should remain local-first.

## Local storage

The project stores local runtime files outside source control and build output:

```text
data/
  library.sqlite
  screenshots/
```

This keeps SQLite and screenshot assets portable and avoids source-control churn.

## Offline operation

The app does not rely on external runtime APIs, fonts, or image CDNs. After dependencies are installed and the client has been built, the app can run without internet connectivity as long as the local machine can serve its own bundled assets.

## Testing

```bash
npm test
npm run typecheck
npm run lint
npm run build
openspec validate application-foundation --type spec --strict
openspec validate foundation-hardening --type change --strict
```

The first OpenSpec command validates the current capability; the second validates the active hardening change. Use the installed OpenSpec CLI. See [foundation review](docs/foundation-review.md) for historical discrepancies, design references, and verification limits.

## Troubleshooting

- If the app cannot serve the built client, run `npm run build` before `npm run prod`.
- If the database directory is not writable, verify the configured data path and file permissions.
- If the server cannot bind to the requested port, check whether the port is already in use or whether the host binding is restricted.
- If the health endpoint fails, confirm the server is running on the expected host and port.

## Backup considerations

Follow the [stopped-writer backup and restore procedure](docs/local-storage.md#backup-and-restore). It preserves the complete SQLite WAL dataset and screenshots together. Copying a live `library.sqlite` file alone is not a complete backup. No automated or live backup utility is provided.
