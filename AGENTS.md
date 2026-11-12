# Name That Match — Agent Instructions

## Project and references

Private, portable, offline-first wrestling screenshot trivia for filming at events and schools. Prioritize reliability, maintainability, and efficient filming workflows. Planned environments: Studio Mode (laptop and TV) and Road Mode (laptop and Android tablet over local Wi-Fi).

Read `README.md` for setup, `docs/local-storage.md` for storage, and relevant `openspec/` artifacts for intended behavior. Inspect actual code, Git status, recent history, and existing instructions before editing. Preserve unrelated user changes. Verify current status: the foundation and Match Library MVP are archived; further features and gameplay require separate approved changes. See the Match Library archive summary for deferred real-collection/device acceptance checks.

For current gameplay operation/architecture, read `docs/game-host.md` and `docs/studio-mode.md`. Host and read-only contestant roots share the authoritative server via HTTP polling until the separately approved WebSocket milestone. Preserve explicit launch/fullscreen gestures and the uniformly scaled logical contestant stage; never treat viewport tests as physical TV/tablet or offline certification.

## OpenSpec workflow

- Meaningful features, architectural changes, and refactors require an approved change: explore → specify requirements and acceptance criteria → design → tasks → implement → verify → archive and synchronize specs.
- Inspect existing capabilities and active changes first. Do not duplicate changes or propose abstractions before reviewing the implementation.
- Follow approved tasks incrementally. Update planning artifacts when requirements change; never silently change an approved specification or expand scope.
- Stop at requested review gates and architectural decisions requiring approval. Do not begin the next milestone or archive unless requested. Archive only after implementation and verification are complete.
- Small bug fixes and documentation corrections may proceed directly when they do not change specified behavior or architecture.

## Architecture

Use the existing React, strict TypeScript, Vite, Node.js, SQLite, and Vitest stack. New frameworks, databases, state libraries, build systems, or external runtime requirements require a documented need and approval.

- `client/`: React presentation, administration, contestant displays, and interaction. Keep business rules outside components; never access SQLite or the filesystem from the browser.
- `server/`: HTTP, persistence, filesystem operations, and future authoritative game state. Maintain one server authority. Validate untrusted API requests and future WebSocket messages at runtime.
- `shared/`: focused client/server contracts and domain types. Avoid speculative schemas, duplication, circular dependencies, and oversized modules.
- `tests/`: automated verification following existing repository conventions.
- Keep networking, presentation, business rules, and persistence separate. WebSockets are planned for synchronization; use ordinary HTTP where sufficient.

## Product rules

- Standard answer window: 10 seconds.
- Match obscurity (Low/Medium/High) and screenshot visual difficulty (Easy/Medium/Hard) are independent nullable inputs. The approved matrix in `shared/src/classification.ts` derives Squash Match = 1 point, Competitive Match = 2 points, or Deathmatch = 3 points; never store or manually edit derived tiers.
- Gameplay eligibility additionally requires explicit approval, complete identifying match metadata, and a valid available image. The host judges verbal answers; event/year are not required for basic correctness. Future discretionary bonuses do not change the matrix.
- A match may have multiple screenshots with different difficulties. A source video may contain multiple matches.
- Unrated or unapproved screenshots are ineligible for gameplay. Prevent repeat matches within a session according to the future approved gameplay spec.
- Do not invent game rules or treat visual references as functional approval.

## Local data and offline operation

- SQLite holds metadata; the local filesystem holds screenshots. Honor the configured data root, use relative asset references, and keep runtime data out of Git and build output.
- Do not modify or delete original Chrome extension captures during import. Validate imported files, metadata, filenames, and paths.
- Design predictable recovery for interruptions and partial failures. Database transactions do not cover filesystem writes.
- Establish a consistent SQLite backup strategy with the screenshot dataset before introducing metadata writes or imports. Do not assume copying a live database file is sufficient.
- Gameplay must work without internet. Cloud services, remote fonts, CDNs, and external runtime dependencies require explicit approval.

## Styling, design, and accessibility

- Tailwind CSS and utility-first CSS frameworks are prohibited: do not install, configure, recommend, or generate them.
- Use colocated CSS Modules, standard CSS, semantic class names, and centralized custom properties in `client/src/styles/tokens.css`. Limit global CSS to foundations; use native nesting and cascade layers where useful.
- Avoid excessive inline styles, `!important`, deep nesting, excessive specificity, duplicated design values, and styling logic hidden in JSX. Represent states with semantic classes or data attributes.
- Review `design-comps/` directly. Preserve dark surfaces, yellow actions, purple accents, high contrast, angular panels, and green/red feedback. Define behavior and acceptance criteria before implementing a comp.
- Administration emphasizes readable, efficient workflows. Contestant screens emphasize legible timers, high-impact presentation, and the planned centered 1080 × 960 reel-safe area.
- Provide semantic HTML, keyboard navigation, visible focus, accessible names and status announcements, sufficient contrast, responsive desktop/tablet layouts, touch-friendly controls, reduced-motion support, and clear loading/empty/success/error states. Never rely on color alone.

## Verification and reporting

- Use existing npm scripts and relevant automated tests. For implementation changes, run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` as appropriate to scope. Validate changed OpenSpec artifacts; use `--type spec` for archived capabilities.
- Cover affected business rules, component interactions, API validation, SQLite persistence, import recovery, and offline operation. Future gameplay needs scoring, timers, selection, state transitions, synchronization, and reconnection coverage.
- Report actual results and failures. Never claim unexecuted tests or browser checks, or complete OpenSpec tasks without evidence. Review maintainability and architecture as well as test results.
- After implementation, report changed files, behavior, checks and results, completed tasks, spec deviations, remaining risks, and manual verification steps. Keep detailed setup and operational documentation in the referenced files.
