# Task 5.5 — Host navigation and recovery

## Scope and authorization

The owner confirmed End/New Game manual acceptance and approved beginning task 5.5 only. This implements the approved GS-08, GR-08, GN-07 and D6/D10 navigation/recovery behavior. No server command, endpoint, schema, scoring rule, dependency, WebSocket or milestone scope was added. The active change remains incomplete; no archive or task 5.6 acceptance is performed.

Baseline was a clean working tree at `5184e6b`. Existing library guard implementation is unchanged. Changes are uncommitted for owner review.

## Implementation and files

- `client/src/App.tsx`: the existing active-view navigation guard now applies to Play as well as Image Library. No router or new global state framework is introduced.
- `client/src/game/HostPage.tsx`, `HostLeaveDialog.tsx`, `HostPage.module.css`: live guessing and in-flight/uncertain work protect navigation. The accessible dialog defaults to Stay, supports Escape/focus restoration/trapping, and offers Pause and leave or Leave after the round stops. Navigation remains blocked on failed/unknown pause delivery; Stay permits reconnect/receipt review. Browser unload uses the supported generic warning, not an unreliable asynchronous pause promise.
- `client/src/game/useGameHost.ts`: re-read authoritative state before leaving; send the existing PAUSE only if still guessing; leave only after a confirmed non-guessing state. Expiry/conflict does not restart timing or trigger judgment. Pending/busy requests prevent this path. Returning/reconnecting explicitly identifies saved, paused or interrupted recovery without Resume, Void or scoring side effects. A known acknowledged host release permits leaving. Receipt recovery reads actual current state after finding a receipt and guards lifetime/controller identity before clearing stored pending work, preventing late unmounted responses from affecting the next view.
- `client/src/game/api.ts`: game requests have a three-second cancellation bound, composed with the caller's lifetime signal and cleaned in finally. A timed-out write remains uncertain and is not automatically retried. This uses the existing request/observation convention and makes stalled-response recovery reachable.
- `tests/client/game-host.test.tsx`, new `game-api.test.ts`: shell/dialog/keyboard/focus/unload, pause/expiry/conflict/lost response, fresh-process credential/receipt recovery, safe released/paused navigation, late-response isolation and request-bound tests.
- README, `docs/game-host.md`, active design authorization/task tracking, prior manual acceptance note and this record document the checkpoint. Archived records are untouched.

Only client navigation/reconciliation wiring changes; the existing server remains authoritative for timers, preserved remainder, liveness loss, crash disposition and once-only scoring. Library Save/Discard/Stay and its beforeunload behavior remain independent. A browser reload/close cannot display custom pause actions or guarantee an async acknowledgment; use the in-app dialog for confirmed pause. If the browser actually disconnects, existing server liveness detection consumes elapsed time before pause/expiry.

## Checks actually executed

- `npm test`: **646 tests passed across 41 files**. Includes existing library unsaved navigation, import/QR, API, SQLite, timer/receipt and startup/static-serving regressions.
- `npm run typecheck`: passed, including final repeat after the last recovery test.
- `npm run lint`: passed with zero warnings, including the final repeat.
- `npm run build`: passed for client/server.
- `openspec validate game-experience-mvp --strict`: passed.
- `openspec validate --all --strict`: **5 items passed, 0 failed**.
- `git diff --check`: passed. Tracking checks found no generated build/dist/runtime data or SQLite database/WAL/SHM files tracked.

The added tests cover Stay/Escape without a pause, confirmed pause preserving 9,000ms in controlled-clock fixtures, no automatic Resume on return, expiry before navigation with no judgment, conflict/lost-pause refusal, explicit receipt review, recovered paused/interrupted views, acknowledged release, late receipt isolation after unmount, and a committed lost judgment recovered under fresh process credentials without rescoring. Independent API tests verify three-second timeout/caller cancellation and cleanup without retries. The initial shell focus assertion required explicitly focusing the clicked navigation button in the fireEvent fixture; final checks pass.

## Built-browser evidence

Production browser verification used separate host/contestant tabs, allocated loopback port, disposable SQLite/assets/profile and a separate Node server process. It exercised:

1. Guessing → attempt navigation → Stay/Escape: host remains and no pause is issued.
2. Intercept and drop the PAUSE response **after the server commits it**: the host stays on Play, pending receipt blocks navigation, and explicit Check command status restores the accepted pause without replay. The contestant is covered.
3. Navigate to Image Library while paused, create an unsaved draft, attempt Play, Stay and verify draft retention, then Discard and continue. The original saved pause remainder is unchanged on return.
4. SIGKILL the server while paused, restart and reclaim control: restore the exact persisted remainder, create a fresh primary link, re-decode and explicitly Resume.
5. SIGKILL the server while guessing, restart and reclaim: recover Interrupted/void-only with original turn ownership/exposure and zero awards. A fresh secondary viewer remains covered; explicit Void records zero.
6. Advance after that void, designate the connected display primary between rounds, prepare/reveal another clue and use an acknowledged Pause and leave. The shell reaches System only after the round is paused; returning Play stays paused without Resume.

Two exposed turns and zero score events remain; no external application HTTP requests occurred. Child servers, browser profile and temporary data were cleaned. The dialog screenshot was visually inspected. Evidence: `/private/tmp/ntm-navigation-browser.log`, `/private/tmp/ntm-navigation-dialog.png`, `/private/tmp/ntm-navigation-recovery.png`, `/private/tmp/ntm-navigation-all.log`. The first harness recovery attempt needed to wait for the host controls to remount; reconnect now also clears obsolete recovery notice text while loading. No production readiness bypass/test hook was introduced.

These are disposable desktop/browser/process checks. Physical TV/tablet, external-internet-disconnected operation and full milestone acceptance remain separate; no such physical test is claimed here.

## Manual verification

1. During guessing, choose System or Image Library. Stay/Escape should leave the round running without navigation. Try again and select Pause and leave: the contestant covers, the saved remainder is preserved and the selected section opens only after acknowledgment.
2. Return to Play: it must remain paused. Wait for primary readiness and explicitly Resume; no fresh ten-second window is offered.
3. In Image Library edit a match without saving, navigate away and check its existing Stay/Save/Discard behavior remains intact.
4. A lost/failed request must keep you on Play. Choose Stay, reconnect if needed, then Check command status and review current state before any deliberate retry/dismissal. Do not infer failure from a timeout or send a second judgment.
5. For restart/crash scenarios use disposable data: a known pause restores its remainder; unknown running crash restores Interrupted and requires Void. Rejoining never resumes or scores automatically. Browser reload/close has only the standard warning; cancel and use in-app navigation when you need confirmed pause.

Task 5.5 is complete: **31/46 total**, 15 remaining. Stop for owner review before task 5.6; do not archive or automatically start the milestone checkpoint.

## Subsequent owner acceptance and checkpoint

The owner subsequently confirmed manual verification of Stay, Pause-and-leave and return-to-paused, and authorized task 5.6. The integrated Milestone 4 results and remaining physical-device deferrals are recorded in `milestone-4-verification.md`. The earlier task-specific evidence above is retained as history; Studio implementation still requires separate approval.
