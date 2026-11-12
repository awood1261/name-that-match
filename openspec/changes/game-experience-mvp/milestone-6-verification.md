# Milestone 6 — Road Mode and WebSocket checkpoint

Implementation checkpoint: 2026-11-12. Scope is tasks 7.1–7.8 of `game-experience-mvp`, following owner acceptance of Studio Mode and explicit approval of pinned production `ws` 8.22.2 and development-only `@types/ws` 8.18.2. No new game rules, database migration, separate Road engine, framework or styling changes.

## Implementation and acceptance evidence

| Tasks / criteria | Evidence |
|---|---|
| 7.1; D2/D9 | Both approved direct dependencies are pinned in the manifest/lockfile. Production resolves `ws` without jsdom; no optional native WebSocket addons or compression. Built server and executable startup tests exercise real sockets. |
| 7.2; GN-05/06 | Existing HTTP listener owns `/api/game/live`. Exact path/no query, Origin, subprotocol, bounded HELLO and role validation precede observation. Real socket tests reject foreign/missing/null Origin, invalid capabilities/epochs/roles, binary/malformed/oversized frames, game commands and stale generations. Public allowlists reject private context/answers/outcomes before reveal. |
| 7.3; GN-01–04/07 | Complete host/public observations carry protocol, epoch, session, revision, connection generation and sequence. `ready_status` contains a complete host observation. Shared browser adapter rejects stale/wrong-role messages, refreshes clock proof, covers loss, resets image readiness and reconnects with capped backoff. No Resume, judgment or other game command is replayed by reconnect. |
| 7.4; GN-01 | Both existing host and contestant hooks use one adapter. HTTP remains the only command/receipt lane; periodic production HTTP status/lease polling is removed. Existing component interaction fixtures, game engine/service tests, real HTTP-plus-WS conformance and built host/viewer games pass. The polling helper in component tests is only fixture delivery, not a production fallback. |
| 7.5; GN-05/06/09, GD-07 | Scoped Vite socket proxy preserves original Origin. An actual Vite frontend plus built Node backend test passes HTML, proxied HTTP setup and public WS snapshot, with foreign upgrade Origin still rejected. Loopback remains the default. Existing QR/LAN logic remains; `docs/road-mode.md` explains deliberate binding/exact frontend origins and offline startup. |
| 7.6; GN-04/08 | Socket subscriptions, heartbeats, close jobs and readiness generations are owned and cleaned. Tests cover failed startup, slow/open peers, primary/host loss, storage fault latching, observer failure after accepted commit, bounded shutdown and clean database reopen. CLI SIGINT/SIGTERM uses the same normal close path; a real SIGTERM child-process test preserves a known paused remainder and exits successfully. |
| 7.7; GN-02–08 | Controlled stale/high-RTT samples, out-of-order/old connection responses, dropped application observations, primary/secondary/host disconnect and reconnect are automated. Real built-browser runs drop accepted judgment and Pause HTTP responses and resolve receipts without duplicate effects. Server kill/restart distinguishes known paused recovery from unknown running interruption. Two-display socket tests preserve deadlines, scoring, no-repeat history and role isolation. |
| 7.8; D11 | Automated/local-browser results and the complete owner manual checklist are recorded below and in `docs/road-mode.md`. Physical-device, external-internet-disconnected and prolonged filming checks are explicitly deferred, not passed. Stop for owner review; no archive or Photo Library task changes. |

Bounds: five sockets including unauthenticated connections; three-second HELLO/liveness/stale-clock budgets; one-second heartbeat/probes; existing 500ms readiness RTT limit; incoming 16KiB/outgoing 64KiB JSON; one latest pending full snapshot; 1MiB queued-byte cap; persistently blocked peers close after three seconds; 30 incoming frames/second; two-second shutdown grace. Deterministic backpressure tests verify coalescing and timer cleanup even with responsive heartbeats. These bounds do not guarantee latency on an arbitrary physical network.

## Integrated built-browser and proxy runs

Runs used allocated loopback ports, disposable SQLite/assets, isolated Chrome profiles and owned server/frontend processes. No operational data or original captures were modified; resources were cleaned.

- Full game: separate host/viewer windows; primary readiness, four exposed turns with unique matches across Squash/Competitive/Deathmatch, consecutive same-contestant turns, late correct credit, explicit result reveal, keyboard Advance, host/viewer reload, tier exhaustion, End/winner, saved final after restart, new zero-score setup/tie and old viewer retaining its old result. Alex/Jordan totals were 2/5 with exactly four score events. An accepted late judgment response was deliberately dropped; receipt review recovered it once. Observed **9 WebSocket channels, 0 display-status polling requests, 4 current-state HTTP reads, 1 HTTP lease renewal** (entry/recovery), and **0 external application requests**.
- Navigation/recovery: Stay/Escape, dropped accepted Pause response with pending navigation blocked until receipt reconciliation, library dirty-state Stay/Discard, return paused, actual child-process kill/restart, known saved remainder and unknown-running Interrupted/void-only recovery. Two exposed turns, zero awards; no automatic Resume/scoring; zero external application requests.
- Actual Vite proxy: HTML and proxied HTTP/WS snapshots passed; exact original frontend Origin preserved, foreign Origin rejected, default backend loopback and disposable ports verified.

Temporary diagnostics: `/private/tmp/ntm-m6-browser.cjs` / `.log`, `ntm-m6-recovery.cjs` / `.log`, `ntm-m6-proxy.cjs` / `.log`. These are executed diagnostic harnesses, not permanent npm scripts. Durable coverage is in `tests/client/game-live.test.ts`, `tests/game/live-http.test.ts`, `live-bounds.test.ts`, `live-contracts.test.ts`, service/executable tests and existing regression suites.

## Automated checks

- `npm test`: **707 passed in 46 files**, including unit, component, HTTP/WS integration, SQLite/import regressions and executable lifecycle tests. Final log: `/private/tmp/ntm-m6-all.log`.
- `npm run typecheck`: passed.
- `npm run lint`: passed, zero warnings.
- `npm run build`: passed; client and server output. Log: `/private/tmp/ntm-m6-build.log`.
- `openspec validate game-experience-mvp --type change --strict`: passed.
- `openspec validate --all --strict`: **5 passed, 0 failed**; repeated after tracking closeout.
- `git diff --check`: passed. Tracked-file audit found no generated `dist/`/`build/`, runtime `data/`, SQLite/database/WAL/SHM files. Archived history and main capability specs are unchanged.
- Production dependency audit: **zero vulnerabilities**. Installation also reported 13 existing development-tooling audit findings (10 moderate, one high, two critical); no unrelated force upgrades were attempted.

Final review caught a test assertion expecting the initial storage-failure wording instead of the subsequent recovery-latch wording, a union-property type assertion and a test declaration lint issue. These were corrected; the final full suite and all checks above passed afterward.

## Manual acceptance and release limitations

Follow [Road Mode operation](../../../docs/road-mode.md) and [Studio operation](../../../docs/studio-mode.md). For each actual check, record device/browser, resolution, network, viewing distance and outcome:

1. Laptop host plus Android on local Wi-Fi: open/scan the primary URL before preparation, confirm decoded/synchronized readiness, Reveal/countdown/judgment/explicit result and matching scores; touch and fullscreen behavior.
2. Drop/rejoin primary Wi-Fi and host connectivity during guessing; confirm pause or expiry at detection, covered stale content, fresh decode/clock proof and explicit Resume with saved remainder. Secondary loss must not pause play.
3. Exercise all tiers, missing/exhausted eligible content, late/zero judgments, explicit contestant switching, repeated games, ties, End/New and saved results after restart. Use receipt review for uncertain commands.
4. Recheck Studio external display launch/fullscreen, keyboard, reduced motion, real screenshot clarity at intended viewing distance, reel crop and prolonged gameplay with representative library traffic.
5. Physically disconnect external internet while retaining local networking. Start the already installed/built app and complete a game without downloads or remote dependencies.

**Not performed:** physical Android/tablet QR camera scan, actual local-Wi-Fi loss/rejoin, actual TV viewing-distance/camera crop, prolonged real collection sessions and external internet physically disconnected. Local automated transport/browser evidence is narrower. The owner's earlier Studio manual acceptance is preserved without inventing device details. Archived Photo Library acceptance deferrals remain unchanged. D11/task 7.8 allow explicit hardware deferrals at this implementation review checkpoint; this is not physical Road release certification.

Tasks 7.1–7.8 complete the implementation checkpoint with the explicit physical deferrals above; all 46 tracked tasks are complete. No archive, main-spec synchronization, commit or push is part of this checkpoint. The working tree contains the transport implementation, its tests, the approved dependency manifests and current operation/evidence documentation; it remains uncommitted. Review the working tree and owner manual results before further closeout.
