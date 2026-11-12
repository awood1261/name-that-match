# Milestone 5 — Studio Mode integration

## Authorization and boundaries

The owner accepted the Milestone 4 closeout and Studio implementation plan, then approved proceeding with Milestone 5. This implements tasks 6.1–6.6 only. The active change remains unarchived; tasks 7.x and dependency approval remain future work. Earlier approval/checkpoint paragraphs are historical, not authorization for later milestones.

The authoritative Node service, classification matrix, ten-second window, 1/2/3-point awards, host-controlled contestant/round ownership, answer reveal gate, SQLite schema 3, HTTP polling, readiness and recovery rules are unchanged. No dependency, endpoint, transport, migration or original-capture change was introduced.

## Implementation and acceptance mapping

| Tasks / criteria | Implemented behavior and evidence |
|---|---|
| 6.1; GD-03/07, GN-04 | Existing `ContestantJoin` offers explicit Open contestant display against the existing local registration. It synchronously uses `noopener,noreferrer`, retains the QR/device URL and supplies manual fallback without treating a null handle as proof of blocking. No automatic popup, registration, game or timer creation. Browser verification opens the actual window and checks `window.opener === null`. Primary close/reopen retains the round and pause, requires new decode/clock readiness and an explicit host Resume. |
| 6.1; optional fullscreen | New `DisplayControls` owns viewer-local fullscreen and optional guide state only. Native enter/exit exercised in headless Chrome; component tests cover gesture-only entry, browser exit events, unsupported/rejected entry, busy state and focus. Controls are outside the filmed stage and have no host command capability. |
| 6.2; GD-04/05 | New `ContestantStage` measures available space with owned ResizeObserver/resize cleanup and applies a single scale variable to a fixed 1080×960 logical stage. Stage dimensions/outline are centralized scoped tokens. CSS Modules own the viewport, geometry, phase layout, controls, result and scoreboard separately. Guide overlay defaults off. Images retain `object-fit: contain`. |
| 6.2; long text and score layouts | Results use bounded Unicode-safe excerpts and a denser text treatment for long metadata, preserving the frozen answer/date. Host Private host answer retains the full fields and shows the same filming-text preview. Contestant-only scoreboard styling preserves host/admin presentation, full contestant names, server totals and actual turns. No scrolling filmed result panel or viewport-based double scaling. |
| 6.3; GD-05/06 | Named keyboard-focusable controls, visible focus, 44px host/local control targets, pressed guide state, explicit error/status text, non-color-only outcomes, cosmetic reduced-motion-safe entrances and unchanged non-live countdown semantics. Focused interaction tests and built screenshots/phase geometry were reviewed. No required audio or per-frame announcements. |
| 6.4; GR-02, GN-06/08 | Two actual built-browser runs exercise separate host/viewer windows, local static assets, live games, readiness, pause/rejoin, results and concurrent disposable library/import HTTP traffic. Measured limits are below. Existing startup, health, static, import, persistence and recovery regressions remain in the full suite. |
| 6.5 | `docs/studio-mode.md` documents production/development startup, default loopback Studio use, deliberate LAN joining, monitor placement, fullscreen/fallback, text preview, backup/upgrade/recovery and manual acceptance. README, game-host, game-foundation introduction and AGENTS point to current operation without rewriting archived evidence. |
| 6.6 | Automated checkpoint results and hardware/offline deferrals recorded here. Request owner review before Milestone 6; no claim of physical filming or Road certification. |

Filming limits are 120 Unicode characters for participants, 64 each for promotion/event and 80 each for optional stipulation/championship, with whitespace normalized and an ellipsis when shortened. The host preview uses the same formatter; stored values, private full answer and date precision stay intact. Extreme valid names/metadata were tested rather than lowering domain validation limits.

## Built-browser results and measured limits

Disposable Node production server, allocated loopback port, temporary SQLite/assets/profile and real Chrome targets; no operational data or original captures touched. PNG fixtures are synthetic valid 476×360 and 1920×1080 images. Both runs verify isolated explicit opening, native fullscreen enter/exit, clean/guide state, primary close/reopen and explicit Resume, concealed readiness, result reveal, Advance, End/New, solo/two-contestant results and no external application HTTP requests.

1. **Timed run:** 55 phase/viewport measurements, with the display held at a fixed size during each ten-second window. Reveal-to-visible observation: **175.1ms / 70.6ms**; expiry observed **89.5ms / 244.1ms** after the ten-second interval. Includes timeout confirmation and explicit late correct credit. Concurrent traffic: **62 confirmed fixture batches** (initial import and subsequent duplicate handling), three parallel library reads per cycle; read-group mean **41.8ms**, maximum **58.1ms**; maximum observed viewer clock RTT **40ms**.
2. **Unique-import/layout run:** **65 phase/viewport measurements**, including both clue ratios during guessing, maximal answer fields with a complete date, 60-character names, reduced motion, ready/covered hierarchy, result, incorrect after recovery and solo/two-player final boards. Every layout checks uniform stage ratio, viewport fit, page overflow, essential-element bounds and result content containment/no scroll. **28 distinct fixture PNG imports committed** while three parallel library reads ran per cycle; read-group mean **54.1ms**, maximum **69.7ms**; maximum observed viewer clock RTT **15.4ms**. This run judges early for layout coverage; its inherited `expired-*` measurement labels are still guessing-state measurements, not expiry evidence. Actual expiry/layout evidence belongs to the timed run.

Viewports: 1920×1080, 1366×768, 768×1024, 1024×768 and 375×667. Native fullscreen passed in desktop headless Chrome, not on a physical TV/tablet. Screenshots of ready, long result, incorrect and final states were inspected. Source clues are synthetic solid-color fixtures; this establishes geometry/containment, not real wrestling-image clarity at filming distance.

Initial harness runs exposed a compact-heading overflow and insufficient space for worst-case result copy; both were corrected through contestant-scoped wrapping, bounded typography and removal of duplicated compact-caption/owner text (owner remains in the stage header and score row). Harness fixes included fresh import revision reads and waits for actual enabled host actions rather than explanatory text. Earlier combined resize/stress runs reached the existing safety pause with 3–4 seconds preserved; they are not counted as uninterrupted timing passes. The final fixed-viewport and unique-import/layout runs passed without such an unexpected pause. No clock/readiness guard was relaxed. The measured local load is not a guarantee of physical-device latency or arbitrary sustained import throughput.

Temporary diagnostics: `/private/tmp/ntm-studio-browser.cjs`, `ntm-studio-browser.log`, `ntm-studio-metrics.json`, `ntm-studio-layout.cjs`, `ntm-studio-layout.log`, `ntm-studio-layout-metrics.json` and `ntm-studio-*-wide.png`. These temporary browser diagnostics are not supported npm scripts; durable automated coverage remains in `tests/`. Owned browser/server/storage resources were cleaned.

## Automated checks

- `npm test`: **653 passed in 42 files**. Includes unit, component, API integration, SQLite, import and foundation regressions.
- `npm run typecheck`: passed.
- `npm run lint`: passed, zero warnings.
- `npm run build`: passed (client and server).
- Strict change validation and whole-project validation: passed; final tracking-only validation repeated at closeout.
- `git diff --check`: passed. No generated `dist/`/`build/`, runtime data or SQLite database/WAL/SHM files tracked; original captures and archived history unchanged.

Dedicated Studio coverage adds fullscreen failure/change events, guide/focus behavior, scale/measurement cleanup, Unicode-safe immutable previews, full host answer versus preview, isolated explicit launch and manual/null-handle fallback. Existing contestant tests now distinguish allowed local presentation buttons from prohibited game commands. Logs: `/private/tmp/ntm-studio-tests.log`, `ntm-studio-build.log` and `ntm-studio-final-focused.log` (76 focused tests passed before the final full suite).

## Physical and release verification still deferred

- Actual laptop plus TV/monitor placement, fullscreen/browser popup policy, 2–3m viewing-distance readability and camera/reel crop: **not performed**. Desktop window/viewport/native API evidence is narrower.
- External internet physically disconnected while the required local connection remains: **not performed**. Zero external application requests does not certify this.
- Physical phone/tablet QR scan, Android touch/fullscreen and local-Wi-Fi interruption/prolonged Road games: **not performed**; retain QR deferrals and tasks 7.7/7.8.
- Real collection/image legibility and archived Photo Library acceptance deferrals: unchanged; synthetic fixtures do not complete them.

Tasks 6.6/D11 explicitly permit honest physical deferrals. This checkpoint can be reviewed as implemented Studio integration with those release limitations; it is not a claim of filmed/physical production readiness. Follow `docs/studio-mode.md` for the owner manual checklist.

## Closeout and review gate

Tasks **6.1–6.6 are complete** with the physical deferrals above explicitly retained. Final strict validation: `openspec validate game-experience-mvp --type change --strict` passed; `openspec validate --all --strict` passed **5 items, 0 failures**. Progress is **38/46 complete**, with eight Milestone 6 tasks remaining unchecked. No archive or main-spec synchronization is performed. Stop for owner manual review/approval before Road/WebSocket work.

Implementation files are the new `ContestantStage`/`DisplayControls` components and CSS Modules, `stageText.ts`, existing contestant/join/score/result/host components and styles, scoped design tokens, Studio component/host/join/display tests, current operation documentation and the active change's design/task/evidence files. Server/shared domain code and dependency manifests are unchanged. Existing staged Milestone 4 evidence is preserved; this checkpoint does not commit, push or alter staging.
