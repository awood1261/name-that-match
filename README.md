# Name That Match

Name That Match is a local-first wrestling trivia application built with React, Vite, and a local Node server. The current application supports capture import, match management and screenshot assignment alongside the foundation's system status, portable storage, and design tokens.

## Overview

- React + TypeScript shell, capture import dialog and unassigned screenshot queue
- Local Node.js HTTP server for imports, committed images, health and production static serving
- SQLite-backed match, screenshot and durable import metadata with migrations
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

Before starting this version against existing data, follow the [stopped-writer whole-root backup procedure](docs/local-storage.md#backup-and-restore). Startup upgrades supported stores through schema 3: the existing schema-1→2 classification mapping is unchanged, and schema 3 adds game persistence. See [classification mapping](docs/classification.md#migration) and [Game Experience Milestone 1, verification and rollback](docs/game-foundation.md). Game Experience Milestone 2 enables host setup and hidden preparation; contestant displays and live countdown controls remain deferred. See [host operation and manual acceptance](docs/game-host.md).

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
NAME_THAT_MATCH_HOST=0.0.0.0 NAME_THAT_MATCH_UI_ORIGINS='http://localhost:3001,http://127.0.0.1:3001,http://192.168.1.50:3001' npm run prod
```

This should only be used in trusted environments. Exposing the local server to a Wi‑Fi network can allow other devices on that network to reach the app if the machine is configured to accept external connections. The server is not a remote admin interface and should remain local-first.

Replace the example IP with the laptop's actual address. `NAME_THAT_MATCH_UI_ORIGINS` is a comma-separated list of exact HTTP(S) origins, without paths or wildcards. Production defaults allow `http://localhost:3001` and `http://127.0.0.1:3001`; development also explicitly allows their port-5173 Vite origins. Set the list deliberately for different ports, Vite preview, or tablet access. Mutation requests require the application's custom header and an allowed browser Origin; this prevents foreign browser writes but does not authenticate programs on the LAN. Forwarded headers never extend the list. Health CORS remains unchanged.

## Capture import

Open **Image Library → Import captures**. Choose a folder or multiple PNG/JSON pairs on the current browser device. Review validation, ignored files and duplicate decisions, then explicitly confirm. New screenshots are unassigned, unrated and pending; use **View unassigned screenshots** to inspect the imported copies. Open **Review screenshot** to assign Easy/Medium/Hard visual difficulty, save, then explicitly approve when all prerequisites are met.

Closing the dialog keeps durable server progress. Reopen **Recent imports** to resume; interrupted uploads can re-select missing files, while changed metadata requires a new selection/batch. Original captures are preserved. See [limits, recovery and staging maintenance](docs/import-engine.md). Run only one server process per data root.

## Game host

Open **Play** to create a solo or head-to-head session, explicitly select the active contestant and prepare a verified screenshot from a derived game tier. Preparation stays hidden and does not start time or consume a match. Reveal requires a contestant display, which is deferred to the next milestone. Host leases, authoritative revisions and command receipts protect concurrent/retried requests. See [host operation, recovery and manual acceptance](docs/game-host.md).

## Match management

Image Library opens in **Matches**. Use **Unassigned screenshots** to select up to 256 captures and choose an existing target match. **Create match for selection** keeps those screenshots selected while you save a new match; **Use this match for selected screenshots**, **Back to screenshots**, and **Save assignment** finish the explicit association. Saving a match never assigns screenshots automatically.

Incomplete match drafts and year/year-month/full dates are supported. Match obscurity (Low/Medium/High) and visual difficulty (Easy/Medium/Hard) are independent nullable inputs; together they derive read-only game tiers and points. The library shows global progress, eligible-tier counts, search and filters. Match details and assignment have separate saves; unsaved navigation offers Save, Discard or Stay. Stale revisions retain the draft and selection for deliberate comparison with current records. See [match management and manual verification](docs/match-management.md) and [classification, eligibility and migration](docs/classification.md).

## Local storage

The project stores local runtime files outside source control and build output:

```text
data/
  library.sqlite
  screenshots/
  staging/
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
openspec validate --specs --strict
openspec validate --all --strict
```

The OpenSpec commands validate the current capability specifications. Match Library MVP is archived; see its [archive checkpoint and deferred acceptance work](openspec/changes/archive/2026-11-08-match-library-mvp/archive-summary.md). For an active change, use `openspec validate <change-name> --type change --strict` with the installed CLI. Foundation hardening is archived; see its [verification record](openspec/changes/archive/2026-11-06-foundation-hardening/verification.md). See [foundation review](docs/foundation-review.md) for historical discrepancies, design references, and verification limits.

## Troubleshooting

- If the app cannot serve the built client, run `npm run build` before `npm run prod`.
- If the database directory is not writable, verify the configured data path and file permissions.
- If the server cannot bind to the requested port, check whether the port is already in use or whether the host binding is restricted.
- If the health endpoint fails, confirm the server is running on the expected host and port.

## Backup considerations

Follow the [stopped-writer backup and restore procedure](docs/local-storage.md#backup-and-restore). It preserves the complete SQLite WAL dataset and screenshots together. Copying a live `library.sqlite` file alone is not a complete backup. No automated or live backup utility is provided.
