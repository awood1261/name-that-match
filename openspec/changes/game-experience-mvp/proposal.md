## Why

The approved Photo Library and official branding are implemented, but Play is still disabled and the application cannot run a filmed game. A shared, server-authoritative game experience is needed for a laptop/TV and for a laptop/Android tablet on local Wi-Fi, without external internet.

## What Changes

- Add session setup for the approved 1–2 named contestants (solo or head-to-head), active-contestant/tier selection, fresh eligible-pool selection, durable rounds and host-controlled completion with scores, winner or tie. Approved P2 makes contestant selection host-controlled: provide a convenient Switch contestant action between rounds, retain the selection until explicitly changed, and never automatically alternate after a round. Freeze each round's contestant ownership at preparation so later selections cannot redirect scores.
- Preserve the exact shared obscurity/visual-difficulty matrix, approval/complete-match/image gates and original captures. No classification conversion is needed on the current schema-2 dataset.
- Enforce the owner's confirmed rules: no repeat match within a session; an incorrect judgment ends the attempt for zero points; the host ends a game manually; the host may explicitly credit an answer spoken before the buzzer after time expires.
- Add an explicit typed round machine with an authoritative 10-second clock, idempotent revisioned commands, once-only scoring, answer reveal and controlled progression. Approved P3 adds host pause/resume using preserved time, zero-point Skip/Void with retained exposed history, and no same-round restart. P4–P9 remain recommendations as distinguished from confirmed overlapping rules in design D2; automatic disconnect/crash recovery and detailed exposure/reveal policies still require final approval.
- Separate the host dashboard from a read-only contestant display, using the official logo, existing tokens/CSS Modules and a centered 1080 × 960 logical reel-safe stage. Comps guide presentation, not scoring, ranking or workflow rules.
- Owner-approved task 5.1 refinement: judgment commits privately, then a separate host **Reveal Result** action presents the outcome, earned points and frozen match identity together. Reuse `REVEAL_ANSWER` / `answer_revealed`; conceal the current outcome, award and resulting score change in the contestant projection until that action. Reveal never scores again. Correct/Incorrect use brief green/red treatments with reduced-motion alternatives; no sound or progression is added.
- Support Studio windows and Road tablet through the same engine, projections, round identities and clock. Introduce WebSocket snapshots/reconnection for both modes in the final transport milestone; intermediate local polling is explicitly temporary.
- Owner-approved LAN join refinement: detect the laptop's current IPv4 address with server-side `ipconfig getifaddr en0` on macOS when creating or explicitly refreshing a contestant link. Replace a loopback hostname while preserving the UI scheme/port, session path and complete viewer-only join fragment. Show a locally generated offline QR code beside the copyable device URL, with detection/configuration errors and an explicit manual origin override. Preserve deliberate LAN binding, exact-origin checks, existing primary-display rules and the current polling transport; no cloud QR/pairing service or automatic game action.
- Add compatible schema-3 game persistence, without rewriting earlier migrations or library data. Save input/answer snapshots and adjudication history so library edits do not change previously earned scores.
- Recommend deferring bonus scoring, undo and retroactive score editing under P8 pending final approval; no speculative extension framework. Keep bonus scoring disabled/out of scope unless separately approved. No automatic answer grading, cloud services, roster management, recording/export, tournament rules or arbitrary score editor.

## Capabilities

### New Capabilities

- `game-session`: Setup, eligibility/selection, session repeat prevention, contestant turns, scores, completion and durable recovery.
- `game-round`: Round progression, timer authority, manual adjudication, late host judgment, exposure/cancellation semantics and duplicate/stale-command protection.
- `game-display`: Host/display separation, phase-specific presentation, Studio windows, accessible offline QR/copyable LAN joining, branding and reel-safe composition.
- `game-synchronization`: Role-specific local transport, initial synchronization, display readiness, clock estimation, disconnect/reconnect, bounded LAN-origin discovery/configuration, trusted-LAN controls and bounded shutdown.

### Modified Capabilities

- `application-foundation`: Permit separately approved gameplay contracts/runtime/views while retaining minimal foundation responsibilities and unchanged health, startup, storage, backup and styling guarantees. Existing shell/runtime exclusions need explicit reconciliation.

P9 now covers host-controlled answer reveal and advancement. The earlier atomic screenshot Reveal & start recommendation remains explicitly pending in GR-02/design D6; it is distinct from revealing the answer.

The library/capture/review main specs and archived `match-library-mvp` remain unchanged. New session rules consume library observations; they do not expand the archived library's scope or claim its deferred acceptance checks passed.

## Impact

Future implementation touches `shared/src/game/`, `server/src/game/`, client game views, minimal server dispatch/lifecycle and Vite proxy configuration, schema migration registration, tests and current operational docs. No implementation or dependency installation is authorized by this planning turn.

A direct production `ws` dependency and TypeScript declarations are proposed for milestone 6, subject to explicit dependency approval; the installed `ws` is currently only a jsdom transitive development dependency. Use the browser's native WebSocket and no new React state framework. Process-restart recovery is in scope; power-loss durability under existing SQLite WAL/NORMAL remains a disclosed limitation.

The QR/LAN refinement is a separate incremental checkpoint (tasks 5.3a.1–5.3a.4), independent of End/New Game and the later Studio/WebSocket milestones. The owner approved updating all affected planning artifacts; this request does not authorize implementation, install a QR encoder, or complete device acceptance. Any new QR package, declarations or test decoder requires explicit package approval before installation. Keep QR generation local and avoid building a bespoke encoding framework.

Formal Photo Library real-collection/device/offline acceptance was deferred by the owner. It is not a prerequisite to writing this plan and is not marked complete. Game release/device verification must independently record what actually runs. Every implementation milestone ends at review; no automatic next milestone or archive.

## Owner-approved countdown refinement — 2026-11-12

The owner requests changing the standard guessing window from 10 to 30 seconds. This explicitly supersedes the former ten-second duration for newly revealed rounds, including future rounds of an existing session. Preserve server-owned timing, scoring, late judgment, primary readiness, pause/recovery, host leases and match use history. A paused legacy round retains its actual saved remainder; a running crash still becomes interrupted. No duration selector or retroactive history rewrite. Schema 4 widens only the game-round timing CHECK constraints through the existing transactional migration mechanism. Historical milestone verification remains evidence of the former duration, not current operation.

## Owner-requested terminal display link — 2026-11-12

Print each newly registered read-only contestant display URL in the Node server terminal so a phone host can transfer it to the laptop viewer without email. This explicitly permits the display credential in that one terminal message; host credentials, answers and automatic request/snapshot logging remain excluded. No new endpoint, dependency, persistence or gameplay change.

## Owner-approved held clue and result reference refinement — 2026-11-12

Keep the exposed screenshot and round strip visible after Correct/Incorrect, with the authoritative judgment-time remainder frozen, and after expiry at 00:00. Continue concealing the outcome/award/answer until explicit Reveal Result. Recreate the owner-supplied green correct and red incorrect/timeout references with dynamic components over the actual clue, not flattened reference images; retain frozen answer details, scores, explicit progression and all game rules. Persist stopped time and restore the image on refresh/restart without new scoring.

## Owner-approved tier names — 2026-11-13

Rename displayed game tiers throughout contestant/host/library UI and current operation guidance: Squash Match → Easy, Competitive Match → Medium, Deathmatch → Hard. Preserve 1/2/3 points, classifier/matrix, illustrations/colors and saved game compatibility. This is a display-name change, not a change to wrestling-match types, screenshot visual difficulty, protocol identifiers or SQLite schema.

## Preparation and host recovery stall correction — 2026-11-13

Investigate/fix preparation and receipt-recovery failures with larger image collections. Read-only measurement of the owner's 81 managed PNGs (~129MiB) took ~3.1s, exceeding current 3s request/liveness bounds. Preserve full validation, one server authority, fresh eligible selection, immutable receipts, timers and saved state. Use cooperative asynchronous catalog assessments, cached live observations with explicit as-of time, and bounded HTTP request lifetimes appropriate to validation work. No dependency, schema, game-rule or endpoint changes.
