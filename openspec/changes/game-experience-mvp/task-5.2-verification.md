# Task 5.2 — Scoreboard and final totals

## Scope and acceptance

The owner's request to begin after task 5.1 manual acceptance authorizes task 5.2. Only this task is implemented at this checkpoint. Tasks 5.3 onward remain open; no automatic progression, End/New Game controls, new dependencies, schema migrations or scoring rules were added.

The shared server projections now publish sorted ledger totals and each contestant's latest visible resolved outcome from the complete attempt history. Stable roster order breaks display ordering among equal totals without claiming a winner during play. Host totals include saved judgments immediately; active contestant snapshots include only revealed results. Completed snapshots expose complete totals and server-selected winner IDs, including solo and zero-score ties. Exposed turn identity excludes cancelled unseen preparations and has no fixed round quota.

A shared read-only CSS Module scoreboard renders these values in the host view, between rounds on the contestant display, alongside revealed results, and as final totals. Public guessing/covered/adjudicated screens preserve their privacy and image/timer presentation. The current active contestant and historical round owner remain distinct. Final totals suppress the active marker.

Host polling previously queried only nonterminal current sessions, which would erase a completed scoreboard. The host now remembers the last observed session ID in tab storage and uses the existing session-read endpoint when there is no current session. It restores only completed sessions; invalid/missing observations are cleared. A current session takes priority. This is read-only recovery, not a new session-selection or lifecycle workflow.

## Files

- Shared contracts/projections: `shared/src/game/contracts.ts`, `projections.ts`.
- Presentation: new `client/src/game/GameScoreboard.tsx` and `.module.css`; existing `HostPage.tsx`, `ContestantDisplay.tsx`, and `HostRoundControls.tsx`.
- Completed observation: `client/src/game/api.ts`, `useGameHost.ts`.
- Tests: new `tests/game/scoreboard.test.ts`, `tests/client/scoreboard.test.tsx`; extended host/display component tests.
- Current documentation: README, `docs/game-host.md`, this record, task tracking, and an appended owner acceptance note in the prior task's record. Prior checkpoint claims remain historical.

## Executed verification

- `npm test`: **561 tests passed across 36 files**. New coverage includes all 1/2/3-point awards, incorrect/timeout/skip/void zero outcomes, stable ties, all-zero and solo winners, actual turn ownership, more than three attempts, cancelled unseen preparation, concealed latest outcomes, full-history summaries despite bounded host history, SQLite reopen, rendering, and host/display reload recovery. Existing import and API suites passed.
- `npm run typecheck`: passed.
- `npm run lint`: passed, zero warnings.
- `npm run build`: passed, client and server outputs generated successfully.
- `openspec validate game-experience-mvp --strict`: passed.
- `openspec validate --all --strict`: **5 items passed, 0 failed**.
- `git diff --check`: passed. Tracking checks found no tracked `dist/`, `build/`, `data/` or SQLite database/WAL/SHM files.

Built production browser verification used headless Chrome, a separate host and contestant tab, allocated loopback port, disposable SQLite/assets and browser profile. Correct Deathmatch awards appeared as three points; incorrect stayed zero. Public DOM/payload concealed judgment until Reveal Result. The scoreboard/latest outcome appeared after reveal and persisted after viewer reload, simulated network reconnect, and server restart with a fresh join link. The ledger contained one correct award and no incorrect award. Reduced-motion/static restoration, frozen answers, and existing clue/reveal controls passed. Scoreboard bounds and page overflow checks passed at 1366×768, 768×1024 and 1080×1920; the 1920×1080 screenshot was visually inspected. Application requests stayed local. Temporary resources were cleaned and original capture bytes were unchanged.

Browser evidence: `/private/tmp/ntm-scoreboard-browser.log`, `/private/tmp/ntm-scoreboard-correct-landscape.png`, `/private/tmp/ntm-scoreboard-correct-portrait.png`, `/private/tmp/ntm-scoreboard-incorrect-reduced.png`. Full test evidence: `/private/tmp/ntm-scoreboard-all.log`. These temporary artifacts are not committed project assets.

Multi-turn/final states are verified in automated domain, persistence and component tests. End/Advance controls are not yet exposed, so a complete manually operated game is not claimed. Physical TV/tablet, viewing distance and physical external-internet disconnection remain separate acceptance tasks.

## Owner verification and archive assessment

Using a disposable data root, create a head-to-head setup and check initial shared zero ranks. Start, connect a primary viewer, prepare and reveal a screenshot, then judge: the private host board updates while the contestant waits. Reveal Result and compare totals, latest outcome and turn ownership. Reload/reconnect the viewer and check that scores do not change. Repeat alternative outcomes/tiers in disposable sessions as needed. See `docs/game-host.md` for full operation and origin configuration.

Task 5.2 is complete; progress is **24/42**, with 18 later tasks open. Stop before 5.3 for review. The foundation, hardening and Match Library changes are already archived. The sole active game change remains incomplete, so nothing is eligible to archive and no capability synchronization/archive was performed. Changes are left uncommitted for review.

## Subsequent owner acceptance

The owner confirmed task 5.2 manual verification and authorized the next task. This records scoreboard acceptance and task 5.3 authorization; it does not complete later tasks or authorize archiving the incomplete game change. The original checkpoint evidence above is retained.
