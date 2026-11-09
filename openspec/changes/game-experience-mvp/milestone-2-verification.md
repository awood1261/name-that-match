# Game Experience MVP — Milestone 2 verification

## Scope and authorization

The owner's Milestone 2 request states that Milestone 1 is complete and manually verified, and authorizes **tasks 3.1–3.6**, following completed tasks 1.1 and 2.1–2.8. Those six tasks are implemented and verified below. Milestone 3 and subsequent work remain unchecked and unstarted. This change is not archived.

The existing approved decisions and capability deltas were followed. No new product decision, classification change, migration, dependency or architecture change was introduced. The authorization note in design.md records the new milestone gate; it does not revise gameplay rules.

## Implemented capabilities

- Play now provides solo/head-to-head setup, field validation, explicit save/discard before Start, dirty-setup Start protection, and restoration of the saved session. Opening Play does not create or start a game.
- The host explicitly selects the contestant between attempts. No automatic rotation occurs. Preparing/Ready disable switching; existing rounds retain their assigned contestant.
- Three requested tier controls show the established 1/2/3-point values. Availability distinguishes screenshot rows from distinct wrestling matches. Counts represent the latest asset assessment, not a promised round quota.
- Selection reuses the existing library classifier and eligibility gates. It samples uniformly among eligible unseen screenshot rows with Node's randomInt, retaining deterministic ordering and injected randomness for tests. Exposed match/hash exclusions are applied across contestants and tiers; source videos are not match identities.
- Prepare freshly reassesses eligibility/assets and validates/pins one bounded current image. It commits Preparing, then guarded completion enters Ready while hidden. Preparation never exposes the image, starts a clock, or awards points. Cancel retains the owner, releases the buffer and does not consume an unexposed match. Replaying an older Cancel cannot release a newer candidate.
- No primary display exists yet: Reveal remains disabled and the server readiness gate cannot be overridden through a request. Private host answer details are separate from any future public answer reveal.
- Native HTTP routes use the existing authoritative service/repository, runtime validation, bounded JSON, exact mutation-origin/custom-header checks, process epochs, bearer capabilities, revision checks and durable command receipts. Existing library/health/static behavior is preserved.
- Controller claim/renew/release is exclusive: loss detection at 3 seconds, expiry at 10 seconds, explicit reclaim rather than force takeover. Host polling is bounded and cancelled on unmount, rejects stale responses and disables mutations on transport loss. React StrictMode does not double-claim. Unknown acknowledgments retain the original command and require receipt/state review before explicit same-payload retry.
- Server shutdown clears polling/liveness work, deferred preparation, service timers, capabilities and the pinned buffer before storage closes. Reload/restart restores the session and revalidates a Ready candidate without revealing it.

## API surface

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/game/control-lease` | Claim exclusive control |
| POST | `/api/game/control-lease/renew` | Renew current control |
| POST | `/api/game/control-lease/release` | Explicitly release control |
| GET | `/api/game/current` | Private authoritative state/availability; optional `?refresh=true` reassesses assets |
| POST | `/api/game/sessions` | Idempotent session creation |
| GET | `/api/game/sessions/:sessionId` | Role-projected session observation |
| POST | `/api/game/sessions/:sessionId/commands` | Existing validated M1 command lane |
| GET | `/api/game/sessions/:sessionId/commands/:commandId` | Receipt reconciliation |
| POST | `/api/game/sessions/:sessionId/displays` | Host-minted read-only capability groundwork |

Viewer capability/projection support satisfies task 3.2's role boundary only. There is no contestant page, clue-image route, display join/readiness flow, countdown UI, scoreboard, live judging UI, Studio launcher or WebSocket implementation. The existing domain command lane is exposed without duplicating its rules in React; unavailable readiness-dependent transitions still fail on the server.

## Files added or modified

Added:

- `shared/src/game/host.ts`: host observation/control contracts.
- `server/src/game/control.ts`, `library.ts`, `http.ts`: lease, library-selection and HTTP adapters.
- `client/src/ids.ts`: extracted existing browser-safe UUID helper.
- `client/src/game/api.ts`, `useGameHost.ts`, `HostSetup.tsx`, `HostPage.tsx`, `HostPage.module.css`: host transport, lifecycle and presentation.
- `tests/game/host-fixtures.ts`, `control.test.ts`, `host-library.test.ts`, `host-http.test.ts`; `tests/client/game-host.test.tsx`: isolated fixtures and behavior tests.
- `docs/game-host.md` and this verification record.

Modified:

- `server/src/index.ts`: game dispatch and lifecycle integration.
- `shared/src/game/selection.ts`: narrow selection parameter typing without changing the algorithm.
- `client/src/App.tsx`, `client/src/library/api.ts`, `tests/client/App.test.tsx`: enable Play and reuse the UUID helper.
- `README.md`, `docs/game-foundation.md`: current operation and milestone context.
- This change's `design.md` and `tasks.md`: authorization/checkpoint evidence only.

## Automated results

| Check | Actual result |
|---|---|
| `npm test` | **455 passed, 28 files**; final full run completed in 20.16 seconds |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed, zero warnings |
| `npm run build` | Passed; client assets and production server compiled |
| `openspec validate game-experience-mvp --type change --strict` | Passed |
| `openspec validate --all --strict` | Passed, 5 items, zero failures |
| `git diff --check` and new-file whitespace audit | Passed |
| Git tracking/scope audit | No tracked generated build output, local database or runtime capture data; dependencies, classifier, migrations, main specs and archived changes unchanged |

There are **42 new tests**: controller 3, real-library selection 7, HTTP 16, host UI 16. They cover the nine matrix combinations, approved/complete/valid gates, missing/corrupt assets versus storage failure, empty pools, match/hash exclusions, pin/revision checks, immutable ownership, lease loss/reclaim, read-only capabilities, origin/header/epoch rejection, bounded bodies, stale revisions, duplicate commands and lost acknowledgments, preparation/cancellation, reload, async response ordering and StrictMode cleanup. Existing persistence/import/library/static/health tests remain in the full suite.

An earlier final-suite attempt stalled for 2,579.84 seconds and ended with two 5-second test timeouts plus 56 Vitest worker RPC timeouts. Its log was retained at `/private/tmp/ntm-game-m2-worker-timeout.log`. Without changing code or increasing timeouts, the full rerun passed all 455 tests with no worker errors. The environment stall's cause was not established. Final successful output is `/private/tmp/ntm-game-m2-tests.log`. Intermediate development failures in payload-error mapping and UI assertions were corrected before the final run.

## Executed browser verification

Headless Chrome exercised the **built production application** with a disposable data root, allocated port, fresh browser profile and three synthetic eligible captures belonging to two matches. No operational collection or original captures were used.

Passed: solo setup/discard; two-contestant setup/Start; native contestant-control focus and selection change; Space-key activation of Prepare; empty-tier feedback; hidden Ready; Cancel preserving owner/capacity; reload preserving session, candidate and the prepared Deathmatch radio value; second-tab busy/release/reclaim; server restart/reconnect restoring the hidden candidate; 768×1024 layout without horizontal overflow. Desktop and tablet-width captures were inspected. Database inspection found **zero exposed rounds and zero awards**; fixture image hashes were unchanged. No external HTTP requests were observed. Browser, server, database and temporary fixtures/profile were cleaned up.

Browser evidence: `/private/tmp/ntm-game-m2-browser.log`, `/private/tmp/ntm-game-m2-desktop.png`, `/private/tmp/ntm-game-m2-tablet-width.png`. The local CDP harness used existing tooling outside the repository; no browser-testing dependency was added.

Native select arrow-key automation was inconclusive in this macOS/CDP environment; the harness verified focus and dispatched the standard change event for selection. Button Space activation was a real CDP key event. This is not a claim of physical-keyboard dropdown acceptance. Full native dropdown keyboard behavior, physical Android/TV checks and physically disconnecting external internet remain owner acceptance checks. Observing zero external requests is not equivalent to performing a network-disconnection test.

## Manual owner acceptance

See `docs/game-host.md` for setup, command-recovery details and the complete checklist. Use a backed-up collection or disposable configured data root; never delete an operational database to reset a test.

1. Run `npm run dev`; open **Play**. Verify no automatic game creation. Create/reload/discard a solo setup before Start, then create a two-contestant setup. Check blank/duplicate names and saved-versus-unsaved setup behavior.
2. Start with eligible library content. Switch contestant explicitly, choose a tier and compare screenshot versus distinct-match counts. Check that an empty tier explains why Prepare is disabled.
3. Prepare a populated tier. Confirm hidden Ready, correct requested tier, fixed owner, disabled switching and disabled Reveal with its display-required explanation. There must be no clue, countdown or award.
4. Cancel and prepare again. Confirm the contestant stays selected and the unseen match remains available. Reload and restart the server; reclaim control if prompted and verify the same session/owner/hidden candidate.
5. Open a fresh tab, observe host-busy, release in the first tab and explicitly claim in the second. Check keyboard focus/native select/radio keys and Enter/Space buttons. Recheck Image Library workflows.

## Limits and next gate

This is a host-only checkpoint, not a playable filmed game. Readiness-dependent gameplay remains blocked. Capabilities coordinate trusted local clients and are not account authentication; existing library APIs are unchanged. One process must own the configured data root. Unstarted local form edits are not restart-persistent. File changes outside database writes are reassessed on explicit Refresh and actual Prepare, rather than rehashing every image on each poll.

No specification deviations or unresolved product decisions were identified for this milestone. Physical-device/offline acceptance is honestly deferred. **Stop for Milestone 2 owner review; Milestone 3 has not started.**
