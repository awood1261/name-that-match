## Why

The working foundation has startup failure paths that leave callers waiting, HTTP tests that can touch application data, and an unclosed test database connection. Correct these reliability gaps and the repository/documentation drift before adding feature data or workflows.

## What Changes

- Reject failed server starts, handle rejected starts at the executable entry point, and release startup resources without changing successful startup, HTTP behavior, or normal server closure.
- Isolate server/storage tests with temporary data roots, OS-assigned ports, bounded failure assertions, and reliable cleanup of sockets, SQLite connections, environment overrides, and temporary files.
- Stop tracking generated `build/` JavaScript and source maps using index-only removal; ignore generated output and local SQLite files without deleting working files or user data.
- Correct current capability normative wording and placeholder Purpose, README validation commands, and current design-reference documentation. Record differences from archived guidance without editing the archive.
- Document an offline, stopped-writer SQLite WAL and screenshot backup/restore procedure; implement no backup utility.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `application-foundation`: Define deterministic startup failure and cleanup, isolated verification, generated-output/data tracking rules, accurate current documentation, and consistent local backup guidance. Preserve existing shell, storage configuration, and HTTP contracts.

## Impact

Future implementation is limited to `server/src/index.ts`, narrowly necessary storage lifecycle handling in `server/src/storage.ts`, foundation tests and small test helpers, `.gitignore` and tracked generated entries, README/current docs, and the current foundation specification. No new dependencies, frameworks, architecture, styling, Match Library, gameplay, or WebSocket work. Default host/port/data paths and existing successful behavior remain unchanged. This proposal creates planning artifacts only; implementation requires approval.
