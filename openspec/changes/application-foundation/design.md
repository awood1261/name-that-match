## Purpose

This change defines the architecture and styling foundation for Name That Match without implementing game logic. It establishes the minimal shell, local persistence strategy, runtime separation, and UI language needed before the Match Library and later gameplay systems are developed.

## Architecture

### Repository structure

The recommended structure is intentionally small and keeps the system understandable:

- `client/` for the React application and presentation layer
- `server/` for the local Node.js authority and runtime services
- `shared/` for TypeScript contracts and shared domain types
- `tests/` for unit, component, and integration coverage
- `data/` for local application data that must remain outside source control and build output
- `docs/` for operational notes and local backup guidance

This is sufficient because the project is a single local-first app with a future local network synchronization model. There is no need for monorepo tooling, package workspaces, or extra abstraction layers in the foundation stage.

### Runtime boundaries

- The React client handles UI, routing shells, and screens.
- The Node server owns the authoritative app state in the future and will host local persistence and import flows.
- The shared TypeScript layer defines contracts consumed by both sides.
- WebSockets are part of the architecture for future synchronized gameplay, but the foundation does not implement full synchronization behavior yet.

### Local-first data model

The initial design treats the app as local-only and offline-first:

- SQLite stores normalized metadata, review state, and library records.
- Local filesystem storage holds screenshot PNG files and any imported source metadata.
- A configurable local data directory isolates application data from code and build artifacts.
- Database and screenshot files are copied as a unit for safe backup and portable restoration.

## Design references reviewed

The design components in `design-comps/` are treated as visual references only. They inform the shell structure and visual language, not the scope of functionality in this change.

### Design patterns observed

1. `00CE997D-1254-403F-A4DB-7604960EFC0C.PNG`
   - Main arena presentation with neon lighting, purple/black stage styling, and bold stylized title treatment.
   - Establishes the project’s visual identity and the general “TV show” presentation mood.

2. `122CF989-63D3-4943-9D0E-CA6C78ACA68F.PNG`
   - Demonstrates the loading / shuffle / challenge flow and the visual rhythm of a round reveal.
   - Informs the idea of a branded “searching” state and a clear transition to game challenge presentation.

3. `575F3CFE-1CE3-4B4A-A16A-6019994EBF0C.PNG`
   - Shows the match type selection pattern with category cards, bright borders, and a patterned dark background.
   - Relevant to future gameplay selection screens even though this change does not implement match-type gameplay flows.

4. `5D88B9D9-C4CF-4DC2-9E45-83B1E9FE6000.PNG`
   - Shows the final score and result layouts with bold ranking blocks and a large title treatment.
   - Useful as a reference for scoreboard and status shell components in the app foundation.

5. `989C475C-D7F3-4085-A2AA-5F04BF4C8974.PNG`
   - Defines the “correct answer” / “incorrect answer” presentation pattern and the result card structure.
   - Informs how future result states can be styled and announced.

6. `9BD6879B-FE7A-44E5-A0EF-17B21F59F03A.PNG`
   - Depicts a “random match” challenge card with a large question mark and shuffle CTA.
   - Helps motivate the shell and centered “challenge reveal” composition.

7. `CA849EE2-D22F-4608-9D00-31E5B7C452B7.PNG`
   - Defines the scoreboard pattern, the match-type palette, and the branded dark arena look.
   - Strongest reference for the visual system and shell styling.

## Visual and interaction language

The design system should be informed by these references but intentionally limited to the shell and visual foundation.

### Styling constraints

- Use CSS Modules for component scoping.
- Use standard CSS with native nesting where appropriate.
- Use CSS custom properties for design tokens.
- Use semantic class names that reflect intent, not implementation details.
- Include accessible focus states and visible keyboard interactions.
- Include reduced-motion support for animated backgrounds and transitions.
- Keep layouts responsive for laptop and tablet use.
- Maintain the branded visual language: dark arena background, neon purple and yellow accents, sharp boxed borders, and oversized text.

### Initial app shell

The foundation should define a basic shell with:

- top-level branded header area
- stage-like dark background treatment
- centered content region with a fixed safe area for local presentation
- generic panel/card containers for future gameplay and library views
- spacing and border patterns aligned with the design references
- placeholder states for future library, game, and result screens

This is a shell only. It should not implement score flow, timer logic, game rounds, or contestant-facing screens.

## Technical decisions and tradeoffs

### Client and server separation

Single repository with separate directories is enough for this stage. A single server keeps the state authority simple without prematurely introducing monorepo complexity or microservice boundaries.

### SQLite + filesystem

SQLite is preferred for metadata and state because it supports atomic updates and local portability. Filesystem storage is appropriate for PNG screenshots and metadata imports because the application is local-first and offline-capable.

### No Tailwind

Tailwind and utility-first CSS are explicitly prohibited by project requirements, and the design references are better served by explicit design tokens and CSS Modules.

### Offline and local-network readiness

The foundation should assume no internet and no cloud backend. All app data remains on the local machine or local Wi-Fi network, which fits the Studio and Road mode requirements.

## Scope exclusions

This change does not include:

- Match Library imports or editing workflows
- Match difficulty assignment or obscurity tracking
- Game engine logic or scoring
- Round timers or challenge delivery logic
- Contestant interactive game screens
- Full WebSocket synchronization flows
- Studio/Road mode user flows
- Any feature that depends on the game system being complete

## Acceptance criteria

- The repository includes a minimal but coherent client/server/shared structure.
- The selected design references are documented as visual inspiration and applied to the shell language.
- The foundation establishes strict TypeScript, local app data conventions, and runtime boundaries.
- The app is designed for offline-first local operation with no cloud dependency.
- The persistence and backup strategy is documented and compatible with local screenshot import workflows.
- The shell and styling system are ready for future gameplay and Match Library features without implementing them here.
