## Tasks

### 1. Bootstrap the minimal app shell
- Create the initial Vite + React + TypeScript project structure.
- Add the minimal root layout, app shell, and branding scaffolding inspired by the approved design references.
- Keep the shell visual-only and avoid future gameplay flows, timers, or result screens.

### 2. Configure TypeScript, linting, and test scaffolding
- Add strict TypeScript configuration for the project.
- Configure ESLint and a minimal test runner setup.
- Verify compatibility with Node.js 20 and the local development environment.
- Prepare the baseline for unit, component, and integration testing.

### 3. Create the minimal server bootstrap
- Add a minimal Node.js HTTP server entry point.
- Define the local runtime boundary and app startup contract.
- Keep the server intentionally small and local-only.
- Do not add gameplay, scoring, or socket-event logic beyond a basic health/startup handshake.

### 4. Define only the foundation contracts
- Add the smallest set of shared TypeScript contracts required for startup and local runtime communication.
- Keep contracts limited to configuration, startup state, and basic health/boot information.
- Defer detailed game state, match metadata, screenshot metadata, and WebSocket contracts to future feature-specific changes.

### 5. Initialize SQLite and local data storage
- Set a predictable application data directory outside source code and build output.
- Initialize SQLite for the foundation layer without creating premature Match Library tables.
- Ensure the setup is capable of future local metadata storage while remaining intentionally minimal.
- Document backup and portability expectations for the local data directory.

### 6. Implement the shell styling system
- Create centralized design tokens from the design references.
- Use CSS Modules for component-specific styling and semantic class names.
- Add responsive layout rules, accessible focus states, and reduced-motion support.
- Prohibit Tailwind CSS and utility-first styling.

### 7. Add client/server communication tests
- Add a contract-level test proving the client and server can exchange a minimal boot or health payload.
- Verify the connection is local-only and does not depend on internet connectivity.
- Keep the communication test at the minimal foundation boundary and avoid product-specific logic.

### 8. Add persistence and startup verification tests
- Add a database initialization test covering local SQLite setup and data directory creation.
- Add a startup test for the production build path and local runtime configuration.
- Add an offline operation test to confirm the app does not require external network access.
- Capture explicit acceptance for startup behavior in both development and production flows.

### 9. Document development and production workflows
- Define a development startup path using the local data directory.
- Define a production startup path for filming or local presentation use.
- Document Studio and Road mode expectations without implementing those flows.
- Include instructions for safe backup and portability of the local data directory.

### 10. Validate the foundation change
- Run the OpenSpec validation workflow.
- Confirm the architecture remains minimal, testable, and scoped to the foundation only.
- Confirm implementation is ready to proceed only after review and approval of the specification.

## Completion criteria

- The foundation stays intentionally minimal and avoids premature abstraction.
- No gameplay, Match Library, round, stopwatch, or scoring implementation is included.
- The app shell and design tokens are based on the approved design references without implementing future screens.
- SQLite and local data storage are initialized in a safe, configurable way without creating premature feature tables.
- The project includes explicit acceptance coverage for client/server communication, database init, offline operation, and startup behavior.
- The design remains local-first, offline-safe, and compatible with Node.js 20 in the current environment.
