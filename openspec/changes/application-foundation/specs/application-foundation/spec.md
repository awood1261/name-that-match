# Application Foundation

## Requirement 1: Local-first project shell

The system shall provide a single-repository React + Vite + TypeScript application shell that serves as the client foundation for future game and library features.

### Acceptance criteria
- The repository contains a minimal client application layout.
- The frontend uses React, Vite, and strict TypeScript.
- The app is organized into separate client, server, shared, and test areas.
- No game logic or Match Library behavior is implemented in this capability.

## Requirement 2: Local server runtime

The system shall include a minimal Node.js server capable of hosting the local app and preparing for authoritative state ownership without implementing gameplay behavior.

### Acceptance criteria
- The server runs locally and does not depend on internet connectivity.
- The server provides a minimal runtime boundary for future app state and local networking.
- The foundation is ready for future WebSocket-based synchronization without forcing that functionality into this change.

## Requirement 3: Shared contracts

The system shall define shared TypeScript contracts that represent the stable data model used across the client and local server.

### Acceptance criteria
- Shared app contracts cover core data types, future match metadata, and message payload structures.
- The contract layer is minimal and intentionally avoids speculative abstractions.
- Shared model definitions are usable by future gameplay and Match Library work.

## Requirement 4: Local persistence and backup strategy

The system shall define a local persistence scheme using SQLite for metadata and the filesystem for image assets, with explicit backup and portability guidance.

### Acceptance criteria
- Application metadata is stored in local SQLite storage.
- Screenshot PNGs and imported source metadata are stored outside source code and build output.
- The design documents backup, restore, and portability expectations.
- The persistence model supports offline and local-network operation.

## Requirement 5: Styling and shell presentation

The system shall define a consistent design system using CSS Modules, standard CSS, and CSS custom properties informed by the approved design references.

### Acceptance criteria
- The app shell follows the dark, neon wrestling identity captured in the design reference files.
- The system includes accessible focus states, semantic class names, and reduced-motion support.
- The styling system is intentionally scoped to the shell and foundational presentation rather than gameplay logic.

## Requirement 6: Testing, linting, and tooling

The system shall define automated quality gates for TypeScript, unit tests, component tests, and linting.

### Acceptance criteria
- The project includes baseline linting and testing configuration.
- The toolchain is compatible with the local Node.js and macOS environment.
- The test setup is sufficient for future growth without overbuilding.

## Requirement 7: Development and production startup

The system shall define local development and production startup flows suitable for a private, offline-first game app.

### Acceptance criteria
- The project includes scripts for local development and production builds.
- The environment is designed for local presentation and filming without internet dependency.
- Startup procedures clearly distinguish development use from local presentation use.

## Scope exclusions

This capability does not include:

- Match Library imports and editing workflows
- Match difficulty or obscurity assignment
- Gameplay, scoring, or timer logic
- Contestant game screens
- Studio/Road mode user journeys
- Full WebSocket synchronization
- Tailwind or utility-first styling frameworks

## Design intent

This capability establishes the architectural foundation for later features while deliberately excluding the game engine and data-entry features that belong to separate changes.
