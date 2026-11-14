# Mobile host experience — implementation verification

Date: 2026-11-13. Branch: `feature/host-ui-updates`. Owner approved the interactive layouts and implementation after their review. Application changes implement the approved MH-01–06 presentation requirements; no gameplay, schema, HTTP, WebSocket, classification or dependency changes were introduced.

## Delivered behavior and files

- `client/src/game/HostPage.tsx` and its CSS Module: one mounted host owner, round-first console, immutable round owner/tier/points, compact projected totals, visible private answer with expandable complete metadata/filming preview, phase-specific contestant/tier selection, mounted supporting sections and phase focus restoration. Full scoreboard/final totals use the existing projection/component.
- `HostRoundControls.tsx` and new `HostRoundControls.module.css`: existing phase commands and countdown, separated routine judgment versus Skip/Void, one safe-area-aware action surface with layout-only resize observation and normal-flow fallback. Held-key suppression is scoped to action buttons so normal repeated typing remains available in name fields.
- New `HostRecoveryPanel.tsx` and its CSS Module: existing error/notice, connection/busy/pending, readiness/revalidation and explicit receipt/reconnect controls adjacent to affected actions. A ready primary never bypasses pending/host-loss gates. No automatic retry, dismissal, command replay or takeover.
- `client/src/App.tsx` and its CSS Module: compact Play-only phone chrome and Menu, preserving one navigation tree and guarded departure. The shell health label distinguishes server reachability from live game readiness. Library/System chrome remains unchanged.
- `tests/client/game-host.test.tsx` and `host-round-controls.test.tsx`: updated assertions for phase-specific presentation and seven additional regression tests covering hierarchy/totals, mounted link/QR/request retention, simultaneous blockers, explicit display disclosure, phase/heartbeat/held-key focus, text/viewport sizing cleanup and ordinary name input.
- `docs/game-host.md`: console/disclosure/recovery operation and physical acceptance guidance. `design-comps/host-controls-review/` retains the approved standalone sample wireframes and review evidence; it is not production UI.

The single `useGameHost` and shared HTTP/WebSocket adapters are unchanged. Match-level repeat exclusion, classification/points, 30-second deadlines, once-only judgments, frozen clues, separate result reveal, explicit contestant selection, permissions, End/New confirmations and navigation protection are preserved. No new full turn-history feature was added; Score details retains the existing complete scoreboard presentation (projected totals and latest outcomes).

## Automated checks

| Check | Actual result |
| --- | --- |
| `npm test` | 49 files, **756 tests passed**; unit, component and integration suites included |
| Host-focused coverage in the full run | `game-host.test.tsx`: 54; `host-round-controls.test.tsx`: 13; all passed |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed, zero warnings |
| `npm run build` | Passed; 164 client modules; Vite and server TypeScript build completed |
| `npx openspec validate mobile-host-experience --type change --strict` | Passed |
| `npx openspec validate --all --strict` | 7 items passed, 0 failed |
| `git diff --check` | Passed |
| Tracking audit | No tracked files in `dist`, `build`, `data`; no tracked SQLite/database/WAL/SHM files from the checked patterns |

The first sandboxed full-suite attempt could not bind localhost integration ports (`listen EPERM`). The authorized final run passed. No failed environment run was counted as a successful check. Temporary output logs are in `/private/tmp/ntm-mobile-all-authorized.log`, `/private/tmp/ntm-mobile-browser.log` and `/private/tmp/ntm-mobile-metrics.json`; these are session-local evidence, not required project inputs.

## Production-browser acceptance

Ran a temporary Chrome DevTools harness against the production build on an allocated loopback port with a newly created disposable fixture library. The harness used existing packages, real HTTP commands/receipts, the real WebSocket adapter and a separate authenticated contestant target. No original captures or real application database were read or mutated. Server/browser/storage resources and the temporary fixture root were closed/removed afterward.

Executed 55 layout observations (11 states × five viewports): 320 × 568, 390 × 844, 430 × 932, 844 × 390 and 1280 × 800. States: between rounds, Ready, Guessing, Paused, pending judgment receipt, revealed result, disconnected host, long-metadata Ready, expired round, final totals and fresh setup. All had no horizontal page overflow; primary action targets were at least 50px tall. Short-height layouts used normal flow. At 390 × 844 the sampled primary action bottoms were:

| State | Bottom of action area, rounded upward |
| --- | --- |
| Between rounds | 836px |
| Ready | 617px |
| Guessing | 740px |
| Paused | 777px |
| Pending receipt | 836px |
| Revealed | 743px |
| Disconnected | 836px |
| Long-metadata Ready | 665px |
| Expired | 824px |

Fresh setup intentionally permits scrolling through its form; disabled tier/preparation controls follow the setup actions. Arbitrarily long recovery text is scrollable rather than guaranteed to fit one viewport.

Additional performed checks:

- Head-to-head setup/start, explicit tier/contestant choice, primary link creation/opening, decode/readiness and Reveal; actual image appeared in the contestant target.
- Collapsing/reopening Display connection retained the exact registered viewer URL. Component tests also verified the same QR DOM node and in-flight registration signal survive toggles.
- Compact Menu → System prompted Stay / Pause-and-leave. Stay restored focus to System; acknowledged Pause-and-leave departed, and returning to Play restored Paused with no automatic Resume.
- Dropped an accepted Correct HTTP response at the response stage while live observations continued. New commands stayed blocked; explicit Check command status restored the accepted outcome before Reveal Result, with no second judgment.
- Paused and simulated host network loss with Chrome network emulation. Resume was blocked while disconnected, then became available after recovery; reconnect alone did not resume.
- Played Correct and Incorrect rounds, explicit result reveal/Advance and contestant switching; ran a real 30-second Hard attempt through expiry and explicit no-credit confirmation.
- Opened long frozen answer fields (1000-character participants, 500-character promotion/event); 200-percent root text at four viewports remained horizontally contained with normal-flow actions. Reduced-motion mode retained operation.
- Confirmed End game/final totals and independent New game with copied editable names; navigated to Image Library and System without Play chrome leaking into them.
- Final harness reported **0 runtime exceptions and 0 external application HTTP requests**. A 390 × 844 production Guessing capture was visually inspected separately.

Browser harness corrections were kept separate from product behavior: selectors use source text rather than CSS-transformed text, and layout measurements bring the host target to the foreground so Chrome delivers resize observations. An intermediate browser run overlapping the CPU-heavy full suite paused a timed attempt under existing liveness protection; the final isolated browser run passed. No readiness/RTT/heartbeat limit was relaxed and no automatic Resume was added. The final ordinary-input key-repeat refinement was covered by the final 756-test run and rebuilt; the layout/transport browser evidence is unchanged by that input-only refinement.

## Remaining physical acceptance — task 4.3 OPEN

No real phone/browser, device keyboard/safe-area, Wi-Fi interruption or external-internet-disconnected acceptance was performed in this implementation session. Viewport, loopback, network-emulation and no-external-request evidence do not certify physical Road/Studio/offline operation, and do not close deferrals in other changes.

On the real configured LAN, use the phone as host and laptop as primary contestant display:

1. Refresh Play on the phone. Create/start a game, expand Display connection, and open its primary link on the laptop. Collapse/reopen details and confirm the link is retained.
2. In portrait, select contestant/tier, Prepare, wait for readiness and Reveal. Check timer, readable private answer, Correct/Incorrect/Pause reachability and the separate Reveal Result/Advance steps.
3. Exercise Pause/Resume, a full timeout and the explicit correct-before-buzzer attestation; inspect Round options and all three supporting sections. Verify switching affects future rounds only.
4. Use Menu during guessing: Stay, then Pause-and-leave, then return to Paused. Check actual keyboard/focus, enlarged text, landscape, browser chrome and bottom safe area without covered controls.
5. Briefly interrupt the host connection on disposable gameplay. Confirm adjacent messages, blocked actions, no auto-resume and explicit receipt review if a request becomes uncertain. Do not blindly replay commands.
6. Confirm End/New, final scores and retained library data. Record phone/browser/version, network and actual results; leave unperformed cases deferred.

## Closeout status

15 of 16 tasks are complete. Task 4.3 remains unchecked pending physical owner acceptance. No archive, commit or push performed. No new product-scope deviation; the small action-surface helper lives with HostRoundControls to share layout observation across preparation and round phases without duplicating controls or adding a state/transport abstraction.
