## Why

The approved Photo Library and official branding are implemented, but Play is still disabled and the application cannot run a filmed game. A shared, server-authoritative game experience is needed for a laptop/TV and for a laptop/Android tablet on local Wi-Fi, without external internet.

## What Changes

- Add session setup for the approved 1–2 named contestants (solo or head-to-head), active-contestant/tier selection, fresh eligible-pool selection, durable rounds and host-controlled completion with scores, winner or tie. Approved P2 makes contestant selection host-controlled: provide a convenient Switch contestant action between rounds, retain the selection until explicitly changed, and never automatically alternate after a round. Freeze each round's contestant ownership at preparation so later selections cannot redirect scores.
- Preserve the exact shared obscurity/visual-difficulty matrix, approval/complete-match/image gates and original captures. No classification conversion is needed on the current schema-2 dataset.
- Enforce the owner's confirmed rules: no repeat match within a session; an incorrect judgment ends the attempt for zero points; the host ends a game manually; the host may explicitly credit an answer spoken before the buzzer after time expires.
- Add an explicit typed round machine with an authoritative 10-second clock, idempotent revisioned commands, once-only scoring, answer reveal and controlled progression. Approved P3 adds host pause/resume using preserved time, zero-point Skip/Void with retained exposed history, and no same-round restart. P4–P9 remain recommendations as distinguished from confirmed overlapping rules in design D2; automatic disconnect/crash recovery and detailed exposure/reveal policies still require final approval.
- Separate the host dashboard from a read-only contestant display, using the official logo, existing tokens/CSS Modules and a centered 1080 × 960 logical reel-safe stage. Comps guide presentation, not scoring, ranking or workflow rules.
- Support Studio windows and Road tablet through the same engine, projections, round identities and clock. Introduce WebSocket snapshots/reconnection for both modes in the final transport milestone; intermediate local polling is explicitly temporary.
- Add compatible schema-3 game persistence, without rewriting earlier migrations or library data. Save input/answer snapshots and adjudication history so library edits do not change previously earned scores.
- Recommend deferring bonus scoring, undo and retroactive score editing under P8 pending final approval; no speculative extension framework. Keep bonus scoring disabled/out of scope unless separately approved. No automatic answer grading, cloud services, roster management, recording/export, tournament rules or arbitrary score editor.

## Capabilities

### New Capabilities

- `game-session`: Setup, eligibility/selection, session repeat prevention, contestant turns, scores, completion and durable recovery.
- `game-round`: Round progression, timer authority, manual adjudication, late host judgment, exposure/cancellation semantics and duplicate/stale-command protection.
- `game-display`: Host/display separation, phase-specific presentation, Studio windows, accessibility, branding and reel-safe composition.
- `game-synchronization`: Role-specific local transport, initial synchronization, display readiness, clock estimation, disconnect/reconnect, trusted-LAN controls and bounded shutdown.

### Modified Capabilities

- `application-foundation`: Permit separately approved gameplay contracts/runtime/views while retaining minimal foundation responsibilities and unchanged health, startup, storage, backup and styling guarantees. Existing shell/runtime exclusions need explicit reconciliation.

P9 now covers host-controlled answer reveal and advancement. The earlier atomic screenshot Reveal & start recommendation remains explicitly pending in GR-02/design D6; it is distinct from revealing the answer.

The library/capture/review main specs and archived `match-library-mvp` remain unchanged. New session rules consume library observations; they do not expand the archived library's scope or claim its deferred acceptance checks passed.

## Impact

Future implementation touches `shared/src/game/`, `server/src/game/`, client game views, minimal server dispatch/lifecycle and Vite proxy configuration, schema migration registration, tests and current operational docs. No implementation or dependency installation is authorized by this planning turn.

A direct production `ws` dependency and TypeScript declarations are proposed for milestone 6, subject to explicit dependency approval; the installed `ws` is currently only a jsdom transitive development dependency. Use the browser's native WebSocket and no new React state framework. Process-restart recovery is in scope; power-loss durability under existing SQLite WAL/NORMAL remains a disclosed limitation.

Formal Photo Library real-collection/device/offline acceptance was deferred by the owner. It is not a prerequisite to writing this plan and is not marked complete. Game release/device verification must independently record what actually runs. Every implementation milestone ends at review; no automatic next milestone or archive.
