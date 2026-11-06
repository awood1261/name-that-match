## Why

The project needs a durable local-first foundation before any game logic can be built. The current repository is empty aside from OpenSpec scaffolding, and the approved architecture requires a single-source app with a React client, a local Node server, shared TypeScript contracts, SQLite-backed metadata, and offline-safe local assets. This foundation must support both a Studio setup and a Road setup without branching the authoritative game logic.

## What Changes

- Bootstrap a Vite + React + TypeScript application shell in a single repository.
- Add a minimal local Node.js server for future authoritative game state, local persistence, and local networking readiness.
- Define shared TypeScript contracts for game state, match metadata, screenshot metadata, and WebSocket payloads.
- Configure strict TypeScript and automated linting/testing for the app foundation.
- Define a local SQLite storage layer and a filesystem-backed screenshot asset directory with backup and portability guidance.
- Establish CSS Modules, global design tokens, semantic naming, accessible states, and reduced-motion support.
- Document a minimal application shell informed by the approved design references without implementing gameplay logic.
- Add development and production startup scripts appropriate for a local-only wrestling trivia app.
- Explicitly exclude gameplay, scoring, rounds, contestant flows, and later Match Library workflows from this change.

## Capabilities

### New Capabilities
- `application-foundation`: Establishes the local-first app shell, server foundation, shared contracts, persistence model, and UI styling system for the Name That Match application.

### Modified Capabilities
- None.

## Impact

- Affects the repository root structure and all future app code.
- Introduces the initial Vite client, Node server, and shared TypeScript boundaries.
- Sets the persistence and backup model for local screenshot assets and metadata.
- Creates the visual language and shell structure for the wrestling game screens without implementing gameplay behavior.
- Establishes the baseline for later Match Library, gameplay, and synced multi-device features.
