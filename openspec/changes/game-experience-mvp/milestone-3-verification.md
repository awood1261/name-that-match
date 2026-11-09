# Game Experience MVP — Milestone 3 verification

## Authorization and scope

The owner's Milestone 3 request records Milestone 2 manual acceptance and authorizes **tasks 4.1–4.7 only**. Previous tasks 1.1, 2.1–2.8 and 3.1–3.6 remain complete. The checkpoint brings progress to **22/42 tasks**, with all Milestone 4–6 tasks still unchecked. The change remains active and unarchived.

The approved engine, ten-second window, classification matrix, scoring/ownership rules, SQLite schema and dependencies were preserved. No product decision or specification behavior was changed. The implementation-authorization note records this milestone's scope without rewriting historical approvals or verification reports.

## Implemented

- Isolated `/display/:sessionId` React root, without the administrative shell or host controls. Official local logo/favicon, tokens, CSS Modules, native controls, responsive landscape/portrait presentation and a prominent countdown are reused. Portrait puts the contained screenshot above the timer near the top; full uniform reel-safe staging remains task 6.2.
- Host-created read-only capability links, manually pasted into another tab. Tokens travel in the fragment, are removed from the address bar and stored only in that viewer tab's session storage. A fresh fragment pasted into the same tab explicitly rebinds after restart. Automatic popup/fullscreen handling remains Milestone 5.
- Host-only primary designation between rounds/while paused. Extra viewers do not gate or pause a round. If a carried-over M2 session is Ready without a primary, cancel the unseen preparation, register the primary and prepare again.
- Authenticated opaque current-round image fetch into a Blob, asynchronous decode while covered, tagged readiness and object-URL/request cleanup. The clue image is absent from the rendered Ready DOM. No source filename, match/screenshot library ID, capture provenance, answer or host capability is sent in the pre-answer public projection. Ready preload is explicitly permitted by the approved specification; preload is not visible exposure.
- Process epoch, server sequence, state revision and per-display connection generations prevent old observations from unlocking readiness or overwriting newer state. Runtime reports are bounded/validated and session/capability-bound. Displays can report synchronization observations but cannot issue host commands.
- Echoed one-use clock samples, client monotonic midpoint estimation, recent lowest-RTT selection, sample-age/RTT gates (3 seconds/500ms), ceiling/zero clamping and 200ms live HTTP polling. The display never expires, scores or advances the authoritative round. Countdown updates are not live-announced each frame; phase/outcome changes are announced. No animation is required, including with reduced motion.
- Host Reveal & start, Correct, Incorrect, Pause/Resume, one reasoned Skip/Void action, explicit Correct-before-buzzer versus Confirm-timeout actions and interrupted-round void. Existing revisions, immutable round ownership, durable receipts and once-only scoring remain authoritative. Private pinned answers remain available only in the host view throughout the attempt. No scoreboard or answer-reveal/progression UI was added.
- Host/primary loss pauses at detection with the actual remainder, or expiry wins if already due. Secondary loss does not pause. Reloading the primary replaces its connection and pauses running play; rejoin/decode alone never resumes it. The viewer covers on failed synchronization or a gap over 3 seconds.
- Graceful shutdown retains a known pause; process-crash recovery remains interrupted/void-only. Paused restoration verifies the original bytes while preserving frozen metadata; missing/changed clues become interrupted rather than receive a new timer. Already committed outcomes remain intact. Shutdown disposes display observations, timers, requests, jobs, capabilities and buffers.

## API and architecture

The existing single HTTP command/service/repository lane remains unchanged in ownership. New display observations are control-plane inputs, not client game transitions.

| Route | Added behavior |
|---|---|
| `POST /api/game/sessions/:id/displays` | Host registers a viewer capability with optional explicit primary designation, or designates an existing display |
| `POST /api/game/sessions/:id/displays/:displayId/status` | Viewer-only connection/readiness/liveness and echoed-clock reports; returns an ordered allowlisted public snapshot and fresh clock sample |
| `GET /api/game/sessions/:id/rounds/:roundId/image` | Role-authenticated current pinned PNG bytes, no source-bearing filename, `Cache-Control: no-store` |
| Existing host observation/commands | Authoritative timing, display feedback and state-derived live actions; no readiness override in a command |

`GameDisplays` owns process-local observations, `GameService` owns deadlines/transitions, `GameLibrary` owns current verified bytes, shared contracts describe wire data, and client clock/transport hooks only render observations and send permitted intent. Dependency-free runtime clock/scheduler injection supports deterministic HTTP tests; it is not exposed through HTTP. No WebSocket or additional framework/library was installed.

## Tests and executed checks

| Check | Actual result |
|---|---|
| `npm test` | **513 passed, 33 files**, final run 35.15 seconds |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed, zero warnings |
| `npm run build` | Passed; Vite 62 modules plus production Node output |
| `openspec validate game-experience-mvp --type change --strict` | Passed |
| `openspec validate --all --strict` | Passed, 5 items, zero failures |
| `git diff --check` and new-file whitespace audit | Passed |
| Tracking/scope audit | No generated output/runtime database/captures tracked; dependencies, classifier, pure game engine, migrations, main specs and archives unchanged |

**58 added tests:** 16 display-registry/runtime tests, 14 HTTP integration tests, 7 clock tests, 11 contestant/countdown tests and 10 host live-control tests. These cover decoded versus unexposed images, real image bytes/privacy, invalid readiness/nonces/RTT/generations, controller/viewer boundaries, Reveal/Cancel, pause/remainder, expiry-first races, ordinary versus late judgment, once-only awards, primary versus secondary/host loss, stale commands, changed Ready records, missing paused clues, restart/epoch recovery, same-tab fresh joins, cleanup, accessible controls and silent countdown updates. Existing health/static/import/library/migration/persistence regressions are included in the full suite.

Development checks caught and corrected: fresh-link same-document navigation retaining an obsolete viewer capability; heading semantics being overridden by a status role; a test fixture allowing host liveness to expire while intending to test primary loss; jsdom Blob-URL cleanup ordering/fake monotonic clock setup; an unsupported Vitest assertion helper; and an expected 422 where candidate revision conflicts correctly return 409. Final results above include those corrections; no known test failure remains.

## Executed two-tab browser scenarios

Headless Chrome drove the **built production application**, using a fresh profile, allocated local port, temporary data root and synthetic color-bar PNG fixtures. No operational collection was used or modified.

Passed: host setup and manual primary-link join; actual PNG fetch/Blob/decode; hidden Ready; readiness-gated Reveal; visible countdown; frozen pause; preserved-time Resume; display reload pausing play; simulated primary network loss/cover/recovery; server restart while paused; fresh-link rebind in the same tab; expiry; explicit pre-buzzer credit; and absence of private answers in the contestant DOM. Final SQLite inspection found **one exposed/adjudicated round and one award**. Original fixture bytes were unchanged. Zero external HTTP requests were observed.

Viewport/containment checks passed at **1920×1080**, **1080×1920**, **1366×768**, **768×1024** and **320×568**; page dimensions stayed within each viewport and the timer remained visible. Landscape and portrait captures were visually inspected. Native semantic host buttons received focus in interaction tests. Physical keyboard/TV/tablet checks remain owner acceptance, not claims inferred from browser emulation.

On the final local run, the harness observed about **168ms** from the Reveal click to the clue appearing in the viewer DOM, and Time up about **57ms** beyond the saved remaining interval after Resume. These are coarse CDP observations including 50ms harness polling, not physical paint guarantees, universal latency limits or concurrent-import benchmarks. Network delay consumes the server window. Heavy library/import load measurement remains later task 6.4.

Evidence outside source control:

- `/private/tmp/ntm-game-m3-tests.log`
- `/private/tmp/ntm-game-m3-build.log`
- `/private/tmp/ntm-game-m3-browser.log`
- `/private/tmp/ntm-game-m3-landscape.png`
- `/private/tmp/ntm-game-m3-portrait.png`

Chrome, server, SQLite connections and the disposable profile/data root were cleaned up. These checks simulate network interruption; they do not certify actual Android local Wi-Fi, a TV at viewing distance or physically disconnecting external internet.

## Manual owner acceptance

See `docs/game-host.md` for full operation/recovery details. Use a backed-up collection or a disposable configured data root. Do not delete operational data to reset an acceptance run. After adjudication this checkpoint has no next-round or End/New Game UI, so use separate disposable roots to test independent outcomes.

1. Run `npm run dev` (or build then `npm run prod`). Open Play and restore/create a session. Before Prepare, create a primary display link and paste it into a separate browser tab. Cancel any carried-over unseen M2 preparation first if necessary.
2. Prepare an eligible tier. Verify the contestant sees a covered Ready screen with contestant/tier, no clue or answer, and Reveal is blocked until decode/synchronization is acknowledged.
3. Reveal. Check the clue appears and countdown runs; Pause covers/fixes the time, and explicit Resume uses only that remainder. Check keyboard focus, native controls, readable timing and portrait/landscape layout.
4. Reload/disconnect the primary during guessing. Confirm pause/cover or expiry, fresh readiness and explicit Resume. A secondary's disconnect must not pause a healthy primary.
5. Restart while paused. Reclaim host control, create a fresh primary link and paste it into the same viewer tab. Verify the same round/owner/remainder; no new ten-second window. A running crash is instead Interrupted/void-only.
6. Let the countdown expire and deliberately choose timeout/no credit or timely-before-buzzer credit. On independent disposable runs check in-window Correct/Incorrect and Skip/Void. Confirm one outcome, no early answer reveal, no automatic contestant rotation or progression.
7. Revisit Image Library and verify existing import/classification/approval/edit/filter behavior. Physically check TV/tablet/offline operation when hardware is available.

## Files added

- `shared/src/game/display.ts`
- `server/src/game/displays.ts`
- `client/src/game/ContestantDisplay.tsx`
- `client/src/game/ContestantDisplay.module.css`
- `client/src/game/useContestantDisplay.ts`
- `client/src/game/clock.ts`
- `client/src/game/Countdown.tsx`
- `client/src/game/HostDisplayPanel.tsx`
- `client/src/game/HostRoundControls.tsx`
- `tests/game/displays.test.ts`
- `tests/game/display-http.test.ts`
- `tests/client/game-clock.test.ts`
- `tests/client/contestant-display.test.tsx`
- `tests/client/host-round-controls.test.tsx`
- This verification record.

## Files modified

- `client/src/main.tsx`
- `client/src/game/HostPage.tsx`
- `client/src/game/HostPage.module.css`
- `client/src/game/useGameHost.ts`
- `client/src/game/api.ts`
- `shared/src/game/host.ts`
- `server/src/game/http.ts`
- `server/src/game/library.ts`
- `server/src/game/service.ts`
- `README.md`
- `docs/game-host.md`
- `docs/game-foundation.md`
- This change's `design.md` (authorization evidence) and `tasks.md`.

## Limitations and next gate

No specification deviation or unresolved product decision was identified. Readiness depends on trusted browser decode/clock observations, not adversarial proof. Capabilities coordinate trusted local clients; existing library APIs remain under their existing policy. Up to four process-local viewer links are supported. One process must own the data root. SQLite WAL/NORMAL power-loss limitations remain unchanged.

Deferred: scoreboard, answer Reveal, Advance/next round, End/New Game UI and live-host navigation prompts (Milestone 4); automatic Studio window/fullscreen, complete uniform 1080×960 safe-stage treatment and load/physical acceptance (Milestone 5); WebSockets/Road transport and its separate dependency approval (Milestone 6). Do not claim this single-attempt checkpoint is a completed filmed game or complete deferred Photo Library acceptance.

**Stop for Milestone 3 review. Milestone 4 has not started; do not archive.** Working tree changes are uncommitted.
