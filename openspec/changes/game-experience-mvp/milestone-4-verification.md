# Milestone 4 — Integrated acceptance and closeout

## Scope and owner verification

The owner reported manual acceptance of task 5.5's Stay, Pause-and-leave and return-to-paused workflows, following earlier acceptance of result reveal, progression and End/New Game. The owner then authorized task 5.6's integrated checkpoint and review of the Studio plan, explicitly withholding Milestone 5 implementation approval.

Reviewed the proposal, design, tasks and five capability deltas against the current host/display, HTTP, persistence, timing and CSS implementation. Baseline: clean working tree at `bae0400`. This checkpoint changes only evidence, task tracking and a proposed Studio implementation plan. No application code, dependency, schema, game rule or archived history changes.

## Acceptance evidence

| Criteria | Actual verification |
|---|---|
| GS-05 explicit contestant ownership | Disposable built-browser game: Alex takes two consecutive turns, then the host explicitly selects Jordan for two more. In-attempt switching is disabled; SQLite round owners remain Alex/Alex/Jordan/Jordan. Keyboard Tab/Space Advance preserves the active contestant and tier. Domain/API suites cover rejected switches and replay after later selection. |
| GS-06 once-only awards and totals | All three tiers exercised, yielding Alex 2 and Jordan 5 from exactly four committed score events. Result reveal, Advance and refresh do not add awards. Domain/storage/API tests cover stale/duplicate commands, zero outcomes, ties and owner consistency. |
| GS-07 End/New lifecycle | Confirmed End publishes winner Jordan to host/viewer. After reopening the fixture server/storage, saved totals remain. New Game creates a different UUID in setup with zero exposed turns; Start is separate. The old viewer retains its old game's result. Ending the new game without exposure publishes the Alex/Jordan zero-score tie. Old sessions and four matches/five screenshots remain stored. |
| GS-08 durable recovery | Integrated run reopens completed state and creates a fresh independent game. Separate production child-process run kills/restarts the server while paused and while guessing: acknowledged remainder survives; unknown running time becomes Interrupted/void-only, never a new guessing window. Storage/migration/fault and HTTP receipt tests pass. |
| GR-07 reveal and progression | Real ten-second expiry followed by explicit Correct before buzzer; other turns use Correct. Contestant judgment stays concealed until Reveal Result; Advance clears clue/result and never auto-prepares or switches. Host/viewer refresh exercised. Existing API/component tests cover partial/missing frozen metadata, incorrect/timeout/void and reveal privacy/idempotency. |
| GR-08 uncertain delivery/navigation | Response interception drops a PAUSE acknowledgment after commit. Navigation remains blocked; explicit Check command status reconciles without replay. Stay/Escape leaves the running attempt unchanged. Confirmed Pause-and-leave navigates; return remains paused. Library unsaved Stay/Discard behavior is exercised unchanged. Owner additionally performed the specified navigation manual checks. |
| Repeat prevention and cancellation | Hidden preparation cancellation consumes no exposed turn. Four distinct matches are consumed across contestants and tiers; a second screenshot of a used match does not become a fifth round. Exhausted tiers disable Prepare without fallback. Domain/service/API fixtures cover classifier and exclusion boundaries. |
| Existing import and foundation regressions | Full suite includes import validation, durability/recovery, HTTP/UI/library behavior, SQLite migration, startup/listen failure, shutdown, health and production static-serving tests. |

The integrated browser checks are scripted headless Chrome interactions with actual built UI controls, not a claim of hands-on TV/tablet testing. They use disposable SQLite/assets/browser profiles, allocated loopback ports and fixture PNG copies. No operational library or original captures are modified. The recovery run uses actual separate Node process termination/restart. Both runs observed zero external application HTTP requests; this does not prove internet-disconnected operation.

## Checks actually executed

- `npm test`: **646 tests passed in 41 files**, including unit, component, API integration, storage and import regressions.
- `npm run typecheck`: passed.
- `npm run lint`: passed with zero warnings.
- `npm run build`: passed for client and server.
- `openspec validate game-experience-mvp --type change --strict`: passed.
- `openspec validate --all --strict`: **5 passed, 0 failed**.
- `git diff --check`: passed.
- Git tracking audit: no `dist/`, `build/`, runtime `data/`, SQLite database/WAL/SHM artifacts tracked; no capture or application files changed by this checkpoint.
- Integrated production browser game and independent navigation/crash/receipt browser run: passed. Four score events in the multi-game fixture; two exposed zero-award turns in the recovery fixture. Temporary resources cleaned.

Local diagnostic artifacts: `/private/tmp/ntm-milestone4-tests.log`, `/private/tmp/ntm-m4-acceptance.log`, `/private/tmp/ntm-m4-recovery.log`, `/private/tmp/ntm-m4-zero-tie.png`. Browser harnesses are `/private/tmp/ntm-m4-acceptance.cjs` and `/private/tmp/ntm-navigation-browser.cjs`; these are temporary diagnostics rather than additions to the supported test runner. Durable automated coverage remains under `tests/`. The initial combined harness stalled; diagnostic calls were bounded and fixture shutdown was made explicit before the final run. No production workaround or readiness bypass was introduced.

## Unperformed physical acceptance

| Check | Status / owning milestone |
|---|---|
| Real TV/monitor placement, native fullscreen, popup policy and viewing-distance legibility | Not performed in this checkpoint; Studio tasks 6.1–6.3/6.6. Fullscreen/launcher are not implemented yet. |
| Physical phone/tablet QR scanning and same-Wi-Fi reachability | Not certified here; existing 5.3a physical deferral remains, with Road verification in 7.8. |
| Android tablet, local-Wi-Fi interruption/reconnection, prolonged games | Not performed; Road tasks 7.7/7.8. |
| External internet disconnected while the needed local connection remains | Not performed; Studio 6.6 and final Road 7.8. Zero observed external requests is narrower evidence. |
| Actual filming/reel-safe readability and concurrent import-load latency | Not certified by M4's browser viewport; Studio 6.2/6.4/6.6. |
| Archived Photo Library real-collection acceptance deferrals | Unchanged; not completed by gameplay fixtures. |

These are explicit later-milestone checks under D11, not missing M4 gameplay/navigation implementation. No deferred check is marked passed.

## Closeout

Task **5.6 is complete** based on executed integrated/regression evidence and the owner's supplied manual acceptance. Milestone 4 tasks 5.1–5.6 (including separate 5.3a checkpoint) are closed for review. Progress is **32/46 tasks complete**, with 14 Studio/Road tasks remaining. The Game Experience MVP change stays active and unarchived; no incomplete capability deltas are synchronized into main specs.

Studio tasks 6.1–6.6 remain unchecked. Proposed implementation responsibilities, risks, sequence and manual checklist are in `docs/studio-mode-plan.md`. Stop for owner approval before any Milestone 5 implementation.
