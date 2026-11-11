# Task 5.4 — Confirmed End Game and New Game

## Authorization and implementation

The owner accepted checkpoint 5.3a manual verification and explicitly approved task 5.4. This checkpoint implements GS-07/08 and design D4/D7 through the existing END_GAME command, session-creation endpoint and receipt/revision machinery. No new endpoint, command, dependency, schema migration, game rule or automatic rotation was added. Stop before task 5.5; no archive or full Milestone 4 acceptance is claimed.

- The host provides a confirmed **End game** action for active games between rounds or after judgment/result reveal. It is disabled during unresolved preparation/guessing/pause/awaiting judgment/interruption with an explanation to cancel or resolve/void first. Cancellation of the confirmation issues no command. A saved unrevealed judgment may end the game; final totals intentionally include its committed points under the approved specification.
- The server advertises END_GAME for resolved active rounds and returns no allowed game actions for completed/discarded sessions. Final host presentation suppresses old round, preparation and contestant-switch controls while showing authoritative saved totals/winners.
- Confirmed **New game** uses the existing creation lane with fresh command/session/contestant IDs, zero scores, no rounds and independent used history. Names and last active selection are copied as editable setup defaults; Start remains a separate action. Previous records/library rows are preserved, not reset or deleted.
- Existing polling/observed-session recovery preserves completed results across reload and controller/process recovery. Lifecycle rejection and missing-receipt review now use the existing observed-session read helper so completed totals do not disappear when no nonterminal session exists. Retry after a reviewed missing creation receipt remains deliberate; accepted lost responses resolve through receipts without a second creation/end.
- Existing contestant links stay bound to their old session and continue displaying its final result. A new session needs a fresh display link/QR/primary registration. Process-restart capability expiry and the existing process-wide four-viewer-capability bound remain unchanged; this checkpoint does not add viewer history management or a session archive browser.

## Files

- `client/src/game/HostPage.tsx`: confirmed lifecycle actions, explanations and terminal-state presentation using existing semantic panels/styles and native confirmation conventions.
- `client/src/game/useGameHost.ts`: fresh setup creation and focused terminal-observation/receipt recovery.
- `server/src/game/http.ts`: authoritative action availability for end/terminal phases.
- `tests/client/game-host.test.tsx`, `tests/game/display-http.test.ts`, `tests/game/service.test.ts`: lifecycle interaction, HTTP, idempotency, persistence and library preservation coverage.
- README, `docs/game-host.md`, active design authorization/task tracking, prior checkpoint acceptance note and this verification record.

Baseline working tree was clean at commit `48685e9`. Changes are left uncommitted for review. No original capture or operational data was modified.

## Actual verification

- `npm test`: **633 tests passed across 40 files**, including existing library/import, QR/LAN, readiness, startup, static-serving and game regressions. The final run includes the new SQLite-close-and-reopen test.
- `npm run typecheck`: passed, including a final repeat after the new persistence test.
- `npm run lint`: passed with zero warnings, including the final repeat.
- `npm run build`: passed for client and server.
- `openspec validate game-experience-mvp --strict`: passed.
- `openspec validate --all --strict`: **5 items passed, 0 failed**.
- `git diff --check`: passed. Tracking checks found no tracked generated build/dist/runtime-data or SQLite database/WAL/SHM files.

Added coverage verifies confirmation cancellation, duplicate-click blocking, unresolved End refusal/explanations, ending both revealed and unrevealed judgments, zero-score ties/solo, fresh UUIDs/rosters/defaults and no automatic start. Lost End/New acknowledgments reconcile existing receipts; a missing creation receipt permits deliberate original-request retry after current-state review, and a rejected New game preserves the completed observation. Existing tests verify replay/fault guards and every allowed/forbidden domain transition.

HTTP tests preserve final scores and old public views across new setup and service recreation, reselect previously exposed content in the independent new session, replay prior End/creation receipts without completing or duplicating the new game, refuse viewer lifecycle mutations, preserve library records, and remove terminal action permissions. A separate service test closes/reopens SQLite twice and verifies both independent completed histories, scores and unchanged screenshot rows.

## Production browser verification

Headless Chrome used the built application, separate host/contestant tabs, allocated loopback port and disposable SQLite/assets/browser profile. It exercised three real saved sessions:

1. Head-to-head: cancel End once, verify unresolved Ready disables End, judge Correct, then End before Reveal Result. Both views show Alex as winner with one committed award and no extra scoring. Final host controls exclude Advance/Prepare/Reveal/Switch.
2. Reload host/viewer; restart the server; reclaim control and use a fresh secondary link to restore the old final result. Cancel New once, then confirm a separate setup. Review copied names, explicitly edit to solo, save and Start; the old viewer still shows the previous final while the new viewer observes the new game. End at zero and verify the solo winner.
3. Confirm another New game, edit/save to head-to-head, explicitly Start and End between rounds. Both views show the all-zero tie. Three completed sessions remain saved with exactly the original single score award.

Application requests remained local. The final tie screenshot at 1366×768 was visually inspected; temporary profile/data were cleaned. Evidence: `/private/tmp/ntm-end-browser.log`, `/private/tmp/ntm-end-winner.png`, `/private/tmp/ntm-end-zero-tie.png`, `/private/tmp/ntm-end-all.log`, `/private/tmp/ntm-end-storage.log`. No physical TV/tablet, viewing-distance or physical external-internet-disconnected acceptance was performed in this task. No dependencies were installed or changed.

## Owner manual verification

1. Between rounds, select **End game** and cancel once; confirm the current game remains active. Then confirm End and compare final totals/winner or tie in host and contestant views.
2. Reload Play and the contestant page; verify the saved final persists. For a server restart, reclaim host control and create a fresh secondary display link to view that resolved final, as documented.
3. Select **New game**, cancel once, then confirm. Check the new setup has zero scores, copied editable names and a different session ID. Save any edits and explicitly Start.
4. Create/open a fresh primary contestant link/QR for the new game; the old page should remain on the previous final. Previously exposed matches are available again in the new session, subject to current eligibility.
5. Check solo zero-score completion, a head-to-head zero tie and disabled End on a prepared unresolved clue. Never delete a database or reset old scores to start another game.

See `docs/game-host.md` for configuration, primary designation, restart and lost-response operation. Task 5.4 is complete: **30/46 total**, 16 remaining. Stop for review before navigation/recovery task 5.5 and the full milestone checkpoint 5.6. The active change remains incomplete and is not archived.

## Subsequent owner acceptance

The owner confirmed that ending and creating a new game work, then approved starting task 5.5. This records manual acceptance of 5.4 and implementation authorization for 5.5 only. The original evidence and remaining review/milestone gates above remain historical.
