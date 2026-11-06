## Tasks

### 1. Bootstrap application shell
- Create the initial Vite + React + TypeScript project structure.
- Set the base package scripts for development, testing, build, and preview.
- Establish a minimal root layout that matches the branded app shell inspired by the design references.
- Confirm the shell is visual-only and does not implement gameplay flows.

### 2. Configure TypeScript and toolchain
- Add strict TypeScript configuration.
- Configure ESLint and testing support.
- Add a minimal test runner setup for unit and component testing.
- Confirm compatibility with the local Node.js 20 / macOS Monterey environment.

### 3. Establish server and runtime boundaries
- Create a minimal Node.js HTTP server entry point.
- Add a simple local app bootstrap for future authoritative state ownership.
- Define a minimal request/response boundary for client-server readiness.
- Keep the server intentionally small and local-only.

### 4. Define shared contracts
- Add TypeScript models for matches, screenshots, and basic app state.
- Add message contracts for local communication and future WebSocket payloads.
- Keep contracts deliberately narrow and stable for later feature expansion.

### 5. Configure persistence and data directories
- Set up a local data directory outside source code and build output.
- Define SQLite storage for metadata and local review state.
- Define filesystem handling for screenshot PNG files.
- Document backup and portability rules for local restore.

### 6. Define CSS system and shell styling
- Create centralized design tokens.
- Implement CSS Modules for shell components.
- Add basic global styling, responsive spacing, and reduced-motion support.
- Ensure all styles are compatible with the approved neon wrestling visual references.

### 7. Document local operation and deploy-readiness
- Define the local development workflow.
- Define the production start path for filming or local presentation.
- Document local network expectations for Studio and Road mode.
- Explicitly note that full synchronization is for a future change.

### 8. Verification and acceptance
- Run the project validation workflow for the OpenSpec change.
- Confirm the specification captures the approved architecture and explicitly excludes future gameplay features.
- Confirm the change is ready for downstream implementation only after design review.

## Completion criteria

- The foundation is documented and approved as an architectural baseline.
- No gameplay or Match Library implementation is included in the change.
- The shell and persistence decisions are sufficient for the next implementation phase.
- The project remains local-first and portable without unnecessary complexity.
