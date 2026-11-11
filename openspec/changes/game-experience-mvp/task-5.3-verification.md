# Task 5.3 — Explicit round progression

## Authorization and implementation

The owner confirmed task 5.2 manual verification and authorized the next task. This checkpoint implements only 5.3 against GS-03/05, GR-06/07 and design D4–5. No new product decision, dependency, endpoint, schema migration, classifier or scoring-engine change was needed. Tasks 5.4 onward remain open.

- The HTTP host status advertises `ADVANCE` for an active session's answer-revealed round or explicitly adjudicated void. Other unresolved or concealed non-void rounds do not offer it. Existing server command/revision/receipt validation remains authoritative.
- Host round controls expose an explicit **Advance** button with an explanation. It clears the current round from presentation and returns between rounds without automatic preparation, timer start, contestant rotation or score changes. A void can advance without revealing its answer, as already specified; other outcomes require Reveal Result.
- Existing Switch contestant and tier controls become usable between rounds. Historical round ownership remains immutable. Observing a saved round retains its requested tier locally across Advance/Cancel, including after reopening Play during that round. An empty tier stays selected with explicit feedback; no automatic fallback is introduced.
- An accepted Advance releases the old pinned bytes and preparation message. Replaying its receipt does not release a subsequently prepared clue.
- Current README/host documentation describes the multi-round workflow and pending End/New Game controls. An acceptance note was appended to the prior verification record without rewriting its historical evidence.

Implementation files: `client/src/game/HostPage.tsx`, `HostRoundControls.tsx`, `server/src/game/http.ts`. Tests: `tests/client/game-host.test.tsx`, `host-round-controls.test.tsx`, `tests/game/display-http.test.ts`. Other edits are README, `docs/game-host.md`, task tracking and the two task verification records.

## Executed checks

- `npm test`: **570 tests passed across 36 files**, including existing import/library regressions.
- `npm run typecheck`: passed, including a final repeat after test updates.
- `npm run lint`: passed with zero warnings, including a final repeat after test updates.
- `npm run build`: passed for both client and server.
- `openspec validate game-experience-mvp --strict`: passed.
- `openspec validate --all --strict`: **5 items passed, 0 failed**.
- `git diff --check`: passed. Tracking checks found no generated `dist/`, `build/`, runtime `data/` or SQLite database/WAL/SHM files tracked.

Focused component tests exercise explicit Advance, duplicate-click blocking, owner/score preservation, disabled in-attempt switching, cancellation without consuming another turn, restored tier/exhaustion, and a lost Advance acknowledgment resolved through the existing receipt flow. Control tests verify authoritative permission disabling. HTTP integration plays four turns across all three tiers, retains one contestant for the first two and explicitly switches for the next two, verifies used-match exclusion across tiers, read-only viewer refusal, early/new stale Advance rejection, idempotent replay after the next clue is pinned, removal of old image/answer access, and persisted selection/scores/use history after service recreation. A separate void scenario verifies the approved pre-reveal Advance exception and retained zero/exposure history. Existing exhaustive domain and persistence tests also passed.

The first full test run found one historical assertion that Advance did not exist after reveal; it was updated for this newly authorized behavior. An initial component run also exposed a mock that reused the same image hash for every preparation; fresh fixture hashes corrected that test setup without changing production repeat protection. The final full suite passed.

## Built-browser verification

Headless Chrome exercised the production build with separate host/contestant tabs, an allocated loopback port, disposable library/SQLite/profile and unchanged source captures. Four exposed rounds spanned Squash, Squash, Competitive and Deathmatch, with two consecutive turns for Alex and two after an explicit switch to Jordan. Final between-round totals were Alex 2, Jordan 5, from exactly four score events. Hidden cancellation consumed no visible turn. Keyboard Tab/Space activated Advance; the contestant returned to its scoreboard without the prior image or answer. Viewer reload, reopening Play after host reload, retained Deathmatch selection, disabled exhausted-tier Prepare and no automatic fallback passed. Application requests remained local and temporary resources were cleaned.

Harness corrections included waiting for the host's current Ready revision before cancellation, using exact phase assertions, disabling inactive headless-tab throttling, and reopening Play after reload (the application initially lands on System). No production readiness bypass was added. Evidence: `/private/tmp/ntm-advance-browser.log`, `/private/tmp/ntm-advance-between-rounds.png` (visually inspected at 1366×768), `/private/tmp/ntm-advance-all.log`. Temporary evidence is outside source control.

Physical TV/tablet, full Studio/Road/offline certification and final lifecycle acceptance remain their existing later tasks. This checkpoint does not claim owner manual acceptance of 5.3 or a manually completed game.

## Manual verification

1. Open Play on the existing revealed round and select **Advance**. Confirm the display returns to the scoreboard, old clue/answer disappear, totals remain unchanged and the same contestant stays selected.
2. Prepare/reveal/judge/reveal another round without switching. Confirm the same contestant owns it and receives its points.
3. Advance, explicitly switch contestants, choose a tier and prepare. Earlier scores must stay with their original owner; switching remains disabled during the attempt.
4. Cancel a hidden preparation and verify the next exposed turn has no numbering gap. Previously exposed matches must not recur across contestants or tiers.
5. After advancing, verify the previous tier stays selected. Select an exhausted tier: Prepare must be disabled with an explanation and no fallback. Check Tab/Space or Enter operation of controls.

End Game and New Game remain task 5.4. Preserve operational data rather than deleting a database to simulate reset. Stop for review before 5.4. Progress after this task is **25/42 complete**, 17 remaining; do not archive the incomplete change. Changes remain uncommitted.
