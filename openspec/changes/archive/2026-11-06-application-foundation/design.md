## Purpose

This change defines the minimum viable foundation for Name That Match. It establishes the application shell, local persistence model, runtime boundaries, and visual tokens required before gameplay, Match Library features, and full synchronized play are implemented.

## Architectural principles

1. Keep the architecture minimal. The foundation must not invent service layers, domain abstractions, or feature-specific module hierarchies that are not needed for bootstrapping the app.
2. Separate the presentation layer from the local runtime authority without over-engineering the system.
3. Keep shared contracts intentionally small and only include the minimum required to support bootstrapping, persistence, and local client/server communication.
4. Defer detailed game state, match, screenshot, and WebSocket contracts to the feature-specific specifications that will use them.
5. Keep all app data local and portable, with predictable storage behavior and no cloud dependency.

## Architecture

### Repository structure

The recommended structure is intentionally compact:

- `client/` for the React application shell and presentation layer
- `server/` for the local Node.js runtime and request/response bootstrap
- `shared/` for the minimal contracts needed by the foundation
- `tests/` for unit, component, integration, and system-level checks
- `data/` for local runtime data outside source control and build output
- `docs/` for environment and operations guidance

This is sufficient for a single, local-first application. No monorepo, package workspaces, or abstract service infrastructure should be introduced in this phase.

### Runtime boundaries

- The client handles the application shell, layout, and screen structure.
- The Node server provides the local runtime boundary, bootstrap services, and future state authority.
- The shared layer is limited to minimal contracts required by the foundation, such as local configuration, boot status, and local communication health checks.
- WebSocket support is part of the future architecture, but the foundation does not implement real synchronized gameplay or a broad message schema.

### Local-first data model

The system is designed for offline-first use and local-device operation:

- SQLite is used to initialize metadata storage and future app state tables.
- The local filesystem stores screenshot PNG files and imported source assets.
- The application uses a configurable data directory that is resolved from environment or defaults, rather than hard-coded runtime paths.
- No Match Library tables or game-domain tables are created in this foundation phase.
- Database and screenshot files are treated as a portable local dataset that can be backed up as a directory tree.

## Data directory and configuration contract

A predictable, configurable local data directory is required for both development and production use.

Recommended properties:
- Default root: `./data/local`
- Override via environment variable, such as `NAME_THAT_MATCH_DATA_DIR`
- Ensure the directory is created during initialization when absent
- Keep the directory separate from source files, build output, and temporary caches

This avoids brittle assumptions about the runtime machine and keeps startup behavior consistent across Studio and Road mode setups.

## Design references reviewed

The design components in `design-comps/` are treated as visual references only. They inform the shell structure and visual language; they do not expand the feature scope of this change.

### Design patterns observed

1. `00CE997D-1254-403F-A4DB-7604960EFC0C.PNG`
   - Dark arena presentation, neon purple lighting, and strong stage-style branding.
   - Establishes the project’s general visual identity and champion presentation mood.

2. `122CF989-63D3-4943-9D0E-CA6C78ACA68F.PNG`
   - Shows a challenge/reveal rhythm and strong event-state framing.
   - Useful for the shell layout and transition states.

3. `575F3CFE-1CE3-4B4A-A16A-6019994EBF0C.PNG`
   - Demonstrates selection-card patterns and a dark patterned background.
   - Relevant to future game and library surfaces, but not implemented here.

4. `5D88B9D9-C4CF-4DC2-9E45-83B1E9FE6000.PNG`
   - Shows scoreboard-like result cards and bold typography.
   - Useful as a visual precedent for status and result shell components.

5. `989C475C-D7F3-4085-A2AA-5F04BF4C8974.PNG`
   - Defines a result-state presentation pattern for success/failure messaging.
   - Useful for future answer-state styling.

6. `9BD6879B-FE7A-44E5-A0EF-17B21F59F03A.PNG`
   - Emphasizes a centered challenge composition and the usage of strong, branded callouts.
   - Useful as a reference for the initial shell content block.

7. `CA849EE2-D22F-4608-9D00-31E5B7C452B7.PNG`
   - Strongest reference for the visual system: punchy accents, dark base palette, and scoreboard-style framing.
   - This is the primary inspiration for the design tokens and shell styling.

## Visual and interaction language

The design system should be informed by these references but intentionally limited to the shell and visual foundation.

### Styling constraints

- Use CSS Modules for component scoping.
- Use standard CSS with native nesting where appropriate.
- Use CSS custom properties for design tokens.
- Use semantic class names that reflect intent, not implementation details.
- Include accessible focus states and visible keyboard interactions.
- Include reduced-motion support for animated or pulsing UI states.
- Keep layouts responsive for laptop and tablet use.
- Maintain the branded visual language: dark arena background, neon purple/yellow accents, sharp borders, and oversized text.
- Do not introduce Tailwind CSS or any utility-first styling framework.

### Initial app shell

The foundation defines a minimal shell with:

- top-level branded header area
- dark stage-like background treatment
- centered content region with a safe presentation area
- generic card and panel containers for future gameplay and library screens
- spacing and border patterns aligned to the approved reference comps
- placeholder states for library, game, and result surfaces without implementing them

This shell must not implement score flow, timers, rounds, contestant screens, or game logic.

## Technical decisions and tradeoffs

### Minimal architecture

A single repository with a small client/server/shared split is sufficient at this stage. This keeps the system understandable and avoids premature abstraction, package workspaces, or infrastructure complexity.

### Shared contracts

Only the minimum contracts required by the foundation should be created. The design should avoid detailed domain contracts for gameplay, match metadata, screenshots, or WebSocket payloads until those features are planned in their own specifications.

### SQLite + filesystem

SQLite is preferred for the metadata layer because it supports safe local initialization and future transactional writes. Filesystem storage is used for PNG assets and imported artifacts because the app is local-first and offline-capable.

### Data directory configuration

The foundation must use a predictable directory strategy with environment-driven overrides. This makes local development, production startup, and filming workflows consistent while keeping all app data outside the repository source tree.

### Offline and local-network readiness

The foundation assumes no internet connectivity and no cloud backend. Local app state remains on the machine or on the private local Wi-Fi network, which fits both Studio and Road mode requirements.

### Runtime compatibility

The project should target Node.js 20 LTS and align with the actual local runtime used in development. The current environment is Node.js 20.19.6 with npm 10.8.2, which is compatible with Vite and modern TypeScript tooling.

## Scope exclusions

This change does not include:

- Match Library import or editing workflows
- Match difficulty or obscurity assignment
- Game engine logic or scoring
- Round timers or challenge delivery logic
- Contestant interactive game screens
- Full WebSocket synchronization flows
- Studio/Road mode user flows
- Any feature that depends on the game system being complete

## Acceptance criteria

- The repository includes a minimal but coherent client/server/shared structure.
- The design references are documented as visual inspiration and inform the shell language.
- The foundation uses strict TypeScript, local app data conventions, and minimal shared contracts.
- The app is designed for offline-first local operation with no cloud dependency.
- The persistence strategy is documented and compatible with local screenshot workflows and safe local backup.
- The shell and styling system are ready for future gameplay and Match Library features without implementing them here.
- Accessibility requirements are defined for keyboard navigation, focus states, and reduced motion.
- The foundation includes responsive behavior expectations for laptop and tablet presentation.
- A predictable local data directory is required for both development and production startup.

## Acceptance scenarios

### Scenario 1: Minimal boot
When the app starts, a minimal client shell and local server bootstrap should be available without any gameplay state or Match Library feature behavior.

### Scenario 2: Local data directory
When the runtime starts without an override, the app should resolve to a predictable local data directory under the project or configured local storage root; when an override is provided, that directory should be used instead.

### Scenario 3: Offline operation
When the machine has no internet access, the application should still load from local files and local runtime resources without cloud dependencies.

### Scenario 4: Accessibility
When a user navigates the shell with a keyboard, visible focus states and semantic interactions must be available and not rely on color alone.

### Scenario 5: Reduced motion
When reduced motion is enabled in the operating system or browser, the app must avoid non-essential animation and keep the shell readable and stable.

### Scenario 6: Runtime compatibility
When the app is started in the current local environment, the Node.js runtime version must remain within the supported LTS range and the toolchain must remain compatible with the development machine.
