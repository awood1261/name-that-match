# Correct Match result refinement — verification

Implementation/verification recorded 2026-11-18 on `feature/reveal-screen-ui-updates`. The owner approved CV-13–15/design D9 and implementation with “spec looks good and you can proceed.” This record covers tasks 11.1–11.6; physical task 11.7 remains open.

Exact inspected design reference:

`/Users/alexwood/Dev/name-that-match/design-comps/reveal-improvements/Correct Match_ Dusty Rhodes vs. Honky Tonk Man.png`

## Delivered behavior and boundaries

- A focused `CorrectResult.tsx` / `CorrectResult.module.css` implements the correct-only composition through the existing `ResultPresentation` entry point. The actual authenticated clue remains the dimmed, contained background; green success frame/check/underline, CORRECT!, contrasting match panel, committed earned-points banner and round-owner/projected-total strip are independently rendered semantic content. Reference example values and the flattened comp are not runtime inputs.
- Names and promotion/event wrap before a fallback is selected. Layout-only overflow measurement uses the existing frame and local font-load/resize observation; it never changes game state or stored answers. Only overflowing content becomes an explicitly labeled Unicode-safe summary. Repeated equal-content public snapshots do not recreate fitting observation. Ordinary long singles and four-/six-person names remain complete in tested layouts, including failed/slow local fonts.
- `ContestantDisplay` offers native **Full match details** outside the scaled stage only for a synchronized revealed correct result. Opening it shows the complete frozen answer and optional fields in readable normal document flow; closing/advancing/staleness removes that presentation. No command is sent. The panel shows the known year; details preserve exact known date precision and unknown dates remain absent.
- `DisplayControls` has a correct-result-only compact icon variant, retaining named 44px targets, focus, guide pressed state, explicit fullscreen/exit/refusal behavior and local presentation preferences. Existing controls for other scenes are unchanged.
- Other outcomes and final screens retain their existing renderers/styles. Server authority, score calculation/ownership, totals, 30-second timing, held clue/zero/frozen remainder, explicit Reveal Result/Advance, public privacy, readiness/recovery, HTTP/WebSocket contracts, persistence and import behavior remain unchanged. No schema, dependency, original-capture or application-data changes.
- Local logo/Barlow fonts, semantic CSS Modules and contestant tokens are reused. Only the correct-image opacity token was added to the centralized sheet. The shared `stageAnswer` helper and its legacy truncation are unchanged.

Changed implementation: `client/src/game/CorrectResult.tsx`, its CSS Module, `ResultPresentation.tsx`, `ContestantDisplay.tsx` and CSS Module, `DisplayControls.tsx` and CSS Module, and `client/src/styles/tokens.css`. Tests changed in `result-presentation.test.tsx`, `contestant-display.test.tsx` and `studio-display.test.tsx`. Current operation guidance is in `docs/studio-mode.md`; proposal/design/spec/tasks record the approved refinement. No server/shared/package files changed.

## Automated checks

| Check | Actual result |
| --- | --- |
| `npm test` | **763 passed, 49 files** on the final complete run |
| Focused coverage within that run | Result presentation 20; contestant display 22; Studio display 7 — all passed |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed, zero warnings |
| `npm run build` | Passed; 166 Vite modules and server TypeScript build |
| `openspec validate contestant-display-visual-experience --type change --strict` | Passed |
| `openspec validate game-experience-mvp --type change --strict` | Passed |
| `openspec validate --all --strict` | 7 items passed, 0 failed |
| `git diff --check` | Passed |
| Tracked build/data audit | No tracked `dist/`, `build/`, `data/`, SQLite/database/WAL/SHM files from checked patterns |

Coverage includes awards 1/2/3 and singular/plural, solo/head-to-head, round owner versus a different active selection, already-committed totals without adding the award again, partial/missing dates, escaped/flexible participant descriptions, complete multi-person identification, measured maximum-content fallback, explicit disclosure/privacy, normal input and existing readiness/scoring/reconnect/import regressions. The default and compact fullscreen controls retain gesture/refusal/focus coverage.

One intermediate full-suite run reported four 5-second timeouts in existing import/navigation tests (reported wall durations around 36–37 seconds). An earlier 762-test run passed; after the added solo test, the final **763-test rerun passed without application code changes between the failed and successful runs**. Cause was not established; do not label the timeouts fixed by this UI work. The failed output is preserved separately at `/private/tmp/ntm-correct-all-timeouts.log`; final output is `/private/tmp/ntm-correct-all.log`. These logs are session-local evidence, not required runtime/project inputs.

## Production-browser acceptance

Ran a temporary Chrome DevTools harness against the production build, an allocated loopback port and disposable SQLite/image fixtures. It drove real session/prepare/reveal/judgment/result/End commands through the existing HTTP lane and real contestant WebSocket observations. Hidden judgments retained the clue without result/answer before explicit Reveal Result. Separate fixture cases exercised 1/2/3-point awards and preserved totals. Browser/server/database resources and temporary fixture roots were closed/removed; no real library or original capture was mutated.

The server correctly refused a fifth display capability in an initial harness attempt. Final cases were split into two disposable processes within the existing four-capability limit; no server limit or readiness bypass was introduced.

**63 layout observations passed** across 1920×1080, 1366×768, 1024×768, 1024×600, 768×1024, 375×667 and 390×844:

| Case | Observations / result |
| --- | --- |
| Normal singles, 1 point | 7; full identity, dynamic year and correct points/total |
| Long singles, 2 points, non-wide image | 7; full identifying names, containment |
| Four-person, 3 points | 7; complete multiline participant description |
| Six-person | 7; complete multiline description |
| Six-person with failed local WOFF2 requests | 7; full names and readable offline fallback |
| Six-person with 800ms delayed local WOFF2 requests | 7; full names, stable result and remeasurement |
| Maximum Latin fields | 7; labeled summary with complete local details |
| Maximum non-Latin fields | 7; Unicode-safe summary and complete local details |
| Missing date | 7; no invented year; subsequent image failure preserved readable result |

All recorded layouts had no horizontal document overflow or unintended result text clipping; decorative italic/underline overhang was distinguished from clipped text. Utility targets measured at least 44×44 CSS pixels. At 375px width, the minimum measured transformed participant font size was **15.96 CSS pixels**, exceeding the 14px target. Only the maximum-length Latin/non-Latin cases required summaries; routine singles/team descriptions remained complete. Representative landscape and phone screenshots were visually inspected against the comp hierarchy. Fixture images were synthetic valid wide/non-wide PNGs, so actual wrestling-photo brightness/fidelity still needs real-collection/device review.

Additional checks opened full details and compared the full frozen participant text, verified details are outside the stage, restored correct results after refresh with no mandatory entrance, applied reduced motion, enlarged root text to 200% with closed/open details, and blocked the image endpoint to verify explicit image fallback. The completed main/tail runs reported **0 runtime exceptions and 0 external application HTTP requests**. Native controls/component checks cover keyboard operation; these viewport checks do not certify physical touch/browser behavior.

Temporary harness/metrics: `/private/tmp/ntm-correct-browser.cjs`, `/private/tmp/ntm-correct-metrics-main.json`, `/private/tmp/ntm-correct-metrics-tail.json`; logs `/private/tmp/ntm-correct-browser.log` and `/private/tmp/ntm-correct-tail.log`. They are disposable session artifacts; no harness or generated screenshot was added to runtime/build inputs.

## Manual acceptance still required

Task 11.7 and existing 7.2/7.3 remain unchecked. No real laptop fullscreen, television viewing-distance, Android touch/performance, phone, physical Wi-Fi/internet-disconnection or filming acceptance was performed in this session. The following extends those checklists; record each actual device/browser/outcome separately:

1. Between rounds, refresh the host/contestant pages. If the server restarted, follow existing fresh-link/reclaim instructions. Prepare and reveal a known eligible screenshot; judge Correct and confirm the exposed clue/frozen timer remains until **Reveal Result**.
2. Reveal the result. Compare CORRECT!, actual wrestling photo, prominent names/promotion/event/year, earned 1/2/3 points and the round owner's saved total. Check solo/head-to-head and ensure no duplicate award or automatic Advance.
3. Check long singles, teams, four-/six-person names and long event metadata. For a summary, open **Full match details** and verify every frozen field/date; close it for the clean composition. Test portrait, landscape and enlarged text without unreadably shrinking names or covering controls.
4. Operate compact fullscreen/guide buttons by keyboard and touch; verify labels/focus, explicit entry/Escape, refusal fallback and guide default off. Inspect TV text at the actual filming distance, Android performance and real phone browser safe areas.
5. Refresh/reconnect a revealed result and confirm the same score/identity without replay or auto-progression. Exercise image/font fallback on disposable data and compare incorrect/timeout/void/final scenes for regression.
6. Test local Wi-Fi without external internet and actual vertical filming/crop with guides on/off. The guide does not guarantee a complete crop of the image or match panel. Record unperformed checks as open rather than certifying them from viewport evidence.

## Status and limitations

Tasks **11.1–11.6 complete**; **11.7 open**. Overall visual change: **30/35 tasks complete**, with earlier physical/closeout/archive dependencies unchanged. No scope deviations: the correct-only component is a focused presentation boundary delegated from ResultPresentation, not another renderer/state system. Device/photo acceptance and intermittent test-timeout investigation remain distinct limitations. No archive, commit or push performed.


## Owner-requested championship line — 2026-11-18

Task 11.8 implements the owner's request to put a known championship directly beneath promotion/event/year. It reads only the frozen answer's `championshipInfo`, omits null/empty/whitespace-only values and leaves complete metadata in Full match details. Championship content participates in density and fitting rechecks. With a championship present, decorative space is reduced to preserve readable names and keep the headline clear of the identity panel. For exceptionally large text, measured summaries tighten progressively only while content still overflows; names are not shrunk to unreadability and complete original text remains in the local disclosure. Other outcomes, scoring, timing and reveal behavior are unchanged.

Verification: **769 tests passed in 49 files**; typecheck, lint, production build, strict change and whole-project OpenSpec validation, and `git diff --check` passed. Six new focused cases cover line placement/immutable data, null/empty/blank values, long titles and progressive overflow fitting. The existing entrance assertion now explicitly waits for its cosmetic effect instead of assuming heading presence means the effect has already run; it still verifies entrance and completion.

Re-ran **63 production-browser layout observations** with the added championship line, including missing/delayed fonts and 500-character Latin/non-Latin championships. The harness now also asserts no headline/identity-panel overlap and a visible championship row. All passed after fitting adjustments; normal and multi-person names remain complete. Full details preserve complete title data for abbreviated cases. These are the same viewport/disposable-fixture checks described above, not physical-device certification.

Manual follow-up: prepare a new round from a match with championship metadata, judge Correct, then Reveal Result. Confirm the title is below show/year. Repeat without a championship and check no blank row, then use a long title and Full match details on a narrow viewport. Prior staged work was preserved; follow-up edits were not staged, committed or pushed. Current visual task progress is **31/36**; physical/closeout tasks remain open.
