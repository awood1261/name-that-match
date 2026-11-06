## Tasks

### 1. Bootstrap the minimal app shell
- [x] Create the initial Vite + React + TypeScript project structure.
- [x] Add the minimal root layout, app shell, and branding scaffolding inspired by the approved design references.
- [x] Keep the shell visual-only and avoid future gameplay flows, timers, or result screens.

### 2. Configure TypeScript, linting, and test scaffolding
- [x] Add strict TypeScript configuration for the project.
- [x] Configure ESLint and a minimal test runner setup.
- [x] Verify compatibility with Node.js 20 and the local development environment.
- [x] Prepare the baseline for unit, component, and integration testing.

### 3. Create the minimal server bootstrap
- [x] Add a minimal Node.js HTTP server entry point.
- [x] Define the local runtime boundary and app startup contract.
- [x] Keep the server intentionally small and local-only.
- [x] Do not add gameplay, scoring, or socket-event logic beyond a basic health/startup handshake.

### 4. Define only the foundation contracts
- [x] Add the smallest set of shared TypeScript contracts required for startup and local runtime communication.
- [x] Keep contracts limited to configuration, startup state, and basic health/boot information.
- [x] Defer detailed game state, match metadata, screenshot metadata, and WebSocket contracts to future feature-specific changes.

### 5. Initialize SQLite and local data storage
- [x] Set a predictable application data directory outside source code and build output.
- [x] Initialize SQLite for the foundation layer without creating premature Match Library tables.
- [x] Ensure the setup is capable of future local metadata storage while remaining intentionally minimal.
- [x] Document backup and portability expectations for the local data directory.

### 6. Implement the shell styling system
- [x] Create centralized design tokens from the design references.
- [x] Use CSS Modules for component-specific styling and semantic class names.
- [x] Add responsive layout rules, accessible focus states, and reduced-motion support.
- [x] Prohibit Tailwind CSS and utility-first styling.

### 7. Add client/server communication tests
- [x] Add a contract-level test proving the client and server can exchange a minimal boot or health payload.
- [x] Verify the connection is local-only and does not depend on internet connectivity.
- [x] Keep the communication test at the minimal foundation boundary and avoid product-specific logic.

### 8. Add persistence and startup verification tests
- [x] Add a database initialization test covering local SQLite setup and data directory creation.
- [x] Add a startup test for the production build path and local runtime configuration.
- [x] Add an offline operation test to confirm the app does not require external network access.
- [x] Capture explicit acceptance for startup behavior in both development and production flows.

### 9. Document development and production workflows
- [x] Define a development startup path using the local data directory.
- [x] Define a production startup path for filming or local presentation use.
- [x] Document Studio and Road mode expectations without implementing those flows.
- [x] Include instructions for safe backup and portability of the local data directory.

### 10. Validate the foundation change
- [x] Run the OpenSpec validation workflow.
- [x] Confirm the architecture remains minimal, testable, and scoped to the foundation only.
- [x] Confirm implementation is ready to proceed only after review and approval of the specification.

## Completion criteria

- The foundation stays intentionally minimal and avoids premature abstraction.
- No gameplay, Match Library, round, stopwatch, or scoring implementation is included.
- The app shell and design tokens are based on the approved design references without implementing future screens.
- SQLite and local data storage are initialized in a safe, configurable way without creating premature feature tables.
- The project includes explicit acceptance coverage for client/server communication, database init, offline operation, and startup behavior.
- The design remains local-first, offline-safe, and compatible with Node.js 20 in the current environment.
