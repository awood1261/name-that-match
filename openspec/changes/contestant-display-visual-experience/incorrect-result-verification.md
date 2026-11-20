# Incorrect and expired result follow-up — 2026-11-19

## Scope and implementation

Owner request: “that looks good, I would like the same treatment on the incorrect and time expired screens.” Proposal/D10/CV-16 explicitly extend the approved Correct Match composition to these two revealed outcomes. This supersedes the earlier correct-only exclusion without changing historical verification.

Renamed the focused CorrectResult component/CSS Module to MatchResult, sharing the existing layout and measured text fitting across correct/incorrect/timeout. Red cross, underline, frame and banner distinguish INCORRECT! and TIME UP from the green correct result. Both retain the authoritative zero award, frozen identity, optional championship immediately beneath show/year, contained actual image, immutable round-owner/projected-total strip, accessible full details and compact utilities. Void/final presentation, server/shared code, game rules, clocks, contracts and dependencies are unchanged. Existing staged changes were preserved; this follow-up was not staged, committed or archived.

## Executed checks

- Focused result/display/Studio components: 64 tests passed across 3 files (`/private/tmp/ntm-red-focused.log`). Covers all outcomes/awards, championship present/absent/blank/long, unchanged frozen data, round owner/totals, pre-reveal privacy, full disclosure and restored incorrect/timeout results.
- Full `npm test`: 778 tests passed across 49 files (`/private/tmp/ntm-red-all.log`). Includes existing game/domain, HTTP, SQLite, live synchronization, timer, import and host regressions.
- `npm run typecheck`, `npm run lint`, `npm run build`: passed; production build transformed 166 modules.
- Strict validation: contestant-display-visual-experience, game-experience-mvp and whole project passed (7 items, 0 failed).
- `git diff --check`: passed. Git tracking check found no tracked dist/build output or SQLite/database/WAL/SHM files.

## Production browser observations

Disposable production HTTP/WebSocket service and SQLite dataset, headless Chromium and synthetic valid PNGs; no operator database or original captures used. Temporary resources cleaned after both runs. Harness: `/private/tmp/ntm-red-browser.cjs`; logs `/private/tmp/ntm-red-browser.log` and `/private/tmp/ntm-red-tail.log`; metrics `/private/tmp/ntm-red-metrics-main.json` and `/private/tmp/ntm-red-metrics-tail.json`.

63 responsive observations passed: 7 timeout and 56 incorrect observations. Reference viewports: 1920×1080, 1366×768, 1024×768, 1024×600, 768×1024, 375×667, 390×844. Fixtures cover normal/long singles, four-/six-person names, maximum Latin/non-Latin fields and championships, missing date, wide/non-wide images, failed/delayed local fonts, reduced motion, image failure, local full-details/200-percent text presentation and restored results. Checked stage containment, no horizontal overflow or headline/panel overlap, full routine names, championship presence, readable name size (at least 14 CSS pixels at 375px), 44px utility targets and full frozen detail access. Visually inspected the captured 375px timeout result.

The normal fixture waited through the actual 30-second window, asserted 00:00, confirmed timeout, asserted no revealed result before Reveal Result, then verified TIME UP and 0 POINTS EARNED. Other fixtures used actual Incorrect and Reveal Result commands. Both runs reported zero browser errors and zero external HTTP requests. Synthetic browser checks do not certify real screenshot fidelity, physical devices or disconnected-internet operation.

## Manual review still required

1. Prepare/reveal a round, mark Incorrect, confirm the clue stays at its stopped timer until Reveal Result; then verify red INCORRECT!, zero points, show/year/championship and unchanged contestant total.
2. Let a round expire; verify the clue stays at 00:00, then confirm timeout and Reveal Result. Verify TIME UP with the same identity/championship treatment and zero points.
3. Test matches with and without championship metadata and long/multi-person names. Expand Full match details; refresh/reconnect and check unchanged result/totals. Check phone portrait, tablet rotation and laptop fullscreen/guide controls.
4. Existing physical acceptance task 11.7 now includes all three result outcomes. Actual TV viewing distance, Android touch/performance, phone, Wi-Fi with external internet disconnected and filming/crop checks remain open where not individually recorded. Existing tasks 7.2/7.3/8.1/8.2 remain open. No automatic archive.
