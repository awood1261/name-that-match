# Task 5.1 — Host-controlled result and answer reveal

## Scope and approved refinement

The owner reviewed Milestone 3 and authorized **task 5.1 only**, explicitly approving specification reconciliation before implementation. This is task 5.1 within the repository's Milestone 4, not authorization for the entire milestone. The existing `game-experience-mvp` change remains active and unarchived.

Earlier Milestone 3 immediately displayed an adjudicated outcome. The approved refinement now separates private judgment from public presentation: the contestant waits in a concealed state until the host selects **Reveal Result**. Existing historical milestone reports remain unchanged.

Updated planning artifacts: proposal, design, tasks, and the game-round, game-display, game-session and game-synchronization deltas. GR-07/GD-02 specify the result gate, result treatments and recovery; GS-06/GN-06 clarify private committed scores versus concealed public projections. The task breakdown covers contracts/projections, host action, presentation, tests and this checkpoint. Strict validation passed before implementation and after completion.

## Implemented behavior

1. Correct/Incorrect, late pre-buzzer credit, timeout and Skip/Void continue through the existing judgment service. Outcomes, awards, immutable contestant ownership and exposed-match history commit exactly as before. The private host sees the saved result/points immediately.
2. Public `adjudicated` snapshots omit outcome, award and answer. Their scores withhold only the current round's unrevealed score increment; previously revealed scores remain intact. The DOM shows a covered **Waiting for the host** state without a clue, result or identity. This is a server projection, not private data hidden by CSS.
3. **Reveal Result** sends existing `REVEAL_ANSWER` through the current host capability/revision/receipt lane. The unchanged engine commits `adjudicated → answer_revealed`. No new command name, phase, migration, score calculation or transport was introduced. The reveal publishes the existing outcome/award and frozen answer together; it never creates another award or restarts time.
4. The contestant presents prominent green **CORRECT!** or red **INCORRECT!**, the authoritative earned points and frozen participant/team description, promotion/event and known date precision. Stipulation/championship fields appear when present. Null metadata is omitted; dates are not expanded or inferred. Timeout/void keep distinct zero-point labels.
5. Correct uses a finite 600ms scale/upward entrance; Incorrect uses a distinct finite horizontal entrance. Only the result text transforms, within the existing bounded panel. Both use existing color/font/spacing tokens and semantic CSS Modules. Reduced motion disables entrance animation. There is no audio.
6. An observed connected transition into revealed state may animate, including when rapid judgment/reveal causes polling to skip the brief adjudicated snapshot. Initial load, refresh or reconnection into an already revealed state restores it statically. Animation is cosmetic and cannot score, reveal, advance or become another game authority.
7. Existing HTTP polling, snapshot ordering, controller leases, viewer-role restrictions and request reconciliation are retained. New IDs for an already performed reveal conflict; retries of the accepted ID return the receipt/current state, including after restart. Changed library metadata does not change the saved result/answer.

Completed-session final totals still use the full authoritative ledger, including when a host ends without revealing the last answer. Existing void-before-Advance rules are preserved; no Advance/End/New Game UI is implemented here.

## Actual verification

| Check | Result |
|---|---|
| `npm test` | **534 passed, 34 files**, final run 25.74 seconds |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed, zero warnings |
| `npm run build` | Passed; client 64 modules and production Node output |
| Strict change validation | Passed |
| Whole-project strict OpenSpec validation | 5 passed, 0 failed |
| Git diff/new-file whitespace and tracking/scope audit | Passed; no generated/runtime data, dependencies, migrations, pure engine, main specs or archived changes modified/tracked |

There are **21 additional tests**: two domain projection/final-total cases, four HTTP cases (including three outcome variants), two contestant display recovery/polling cases, two host-control cases and eleven result/metadata presentation cases. Existing tests were also updated for the deliberately concealed adjudicated contract. The full suite retains timing, scoring, classifier, import, persistence, health/static-serving and recovery coverage.

Coverage includes: no outcome/award/answer/current score leak before reveal; correct private scores and preservation of earlier public totals; host-only/early/stale command rejection; once-only awards and duplicate reveal receipts across restart; frozen answers after library edits; Correct 1/2/3, Incorrect 0, timeout/void 0; full/year-month/year/missing dates; optional editorial fields; escaped participant text; accessible host action/disabled state; hidden adjudication; explicit result transition; refresh/reconnect without animation replay; rapid judgment/reveal under polling. Development typechecks caught unvalidated branded dates in test fixtures; these now use the existing runtime partial-date guard. No test/type/build failure remains.

### Built-browser checks executed

Headless Chrome drove the real built production application with separate host/viewer tabs, a fresh profile, allocated port and **two independently created disposable fixture data roots**. No operational collection or original captures were modified.

Passed:

- Correct judgment remained concealed in both viewer DOM and authenticated public snapshot while the host held the result.
- Explicit Reveal Result displayed a green 3-point Deathmatch result with the original frozen match/date/editorial metadata after a later library edit.
- A real computed success entrance was observed. The red Incorrect presentation showed zero points, and Chrome's emulated `prefers-reduced-motion: reduce` produced computed `animation-name: none` during reveal.
- Refresh, simulated network disconnect/reconnect, and server restart/fresh same-tab join restored the revealed result statically.
- Layouts stayed within 1920×1080, 1366×768, 768×1024 and 1080×1920 viewports; landscape/portrait/red captures were visually inspected.
- SQLite contained one score event in the correct fixture and zero in the incorrect fixture. Original fixture bytes remained unchanged. Zero external HTTP requests were observed.

Evidence outside source control: `/private/tmp/ntm-result-tests.log`, `/private/tmp/ntm-result-build.log`, `/private/tmp/ntm-result-browser.log`, `/private/tmp/ntm-result-correct-landscape.png`, `/private/tmp/ntm-result-correct-portrait.png`, `/private/tmp/ntm-result-incorrect-reduced.png`. Chrome/server/connections and disposable roots/profile were cleaned up. This is actual desktop browser/viewport verification, not physical TV/Android, viewing-distance or external-internet-disconnection certification.

## Manual owner acceptance

1. Start normally and open Play plus the dedicated contestant URL. Before Prepare, create/designate a primary as described in `docs/game-host.md`.
2. Prepare, wait for decode/synchronization and select Reveal & start. Mark Correct or Incorrect.
3. Wait deliberately: the host should show its saved judgment/points; the contestant must show a covered neutral waiting state, no correct/incorrect treatment, points or identity.
4. Select **Reveal Result**. Check green Correct with the committed tier award, or red Incorrect with zero, plus saved participants/promotion/event/date and any known editorial fields. Check no result is inferred from a source video title.
5. Refresh before reveal (still concealed) and after reveal (same static result). Simulate a viewer disconnect/reconnect. Enable reduced motion and check the same readable result without an entrance.
6. Use separate disposable runs for alternate outcomes; next-round and End/New Game controls are not present yet. Do not delete operational data to reset a test.

Following a server restart, resolved/revealed rounds need a fresh viewer capability. Uncheck **Use new link as the primary display** when creating a read-only result-viewing link: existing primary-designation rules remain restricted to between rounds/paused, and a primary is not needed to observe the saved result. Pasting the fresh link into the same viewer tab restores the saved phase.

## Files changed

Runtime:

- `shared/src/game/contracts.ts`
- `shared/src/game/projections.ts`
- `server/src/game/http.ts`
- `client/src/game/HostRoundControls.tsx`
- `client/src/game/ContestantDisplay.tsx`
- New `client/src/game/ResultPresentation.tsx`
- New `client/src/game/ResultPresentation.module.css`

Tests:

- `tests/game/domain.test.ts`
- `tests/game/display-http.test.ts`
- `tests/client/host-round-controls.test.tsx`
- `tests/client/contestant-display.test.tsx`
- New `tests/client/result-presentation.test.tsx`

Documentation/planning:

- `README.md`, `docs/game-host.md`
- This change's `proposal.md`, `design.md`, `tasks.md`
- This change's game-round, game-display, game-session and game-synchronization specification deltas
- This new verification record

## Remaining limits and completion

Task 5.1 acceptance criteria are satisfied by the evidence above. No unresolved product/architectural decision or deviation from the revised approved specification remains. The public adjudicated wire shape was intentionally narrowed; deploy client and server together through the normal local build/restart workflow. Database/schema/score history are unchanged.

Physical device and full filming acceptance remain deferred to their existing tasks. Scoreboard, next-round progression, End/New Game UI, Studio launching, WebSockets/Road integration, bonuses/leaderboards, sound and dependencies were not added. Existing trusted-LAN security and four viewer-capability limits remain unchanged.

Only **5.1** is newly checked: **23/42 complete**, 19 remaining. Tasks **5.2 onward remain unchecked**. Stop for owner review; do not archive or proceed automatically. All changes remain uncommitted.

## Subsequent owner acceptance

The owner confirmed that the secondary-device origin configuration worked and that task 5.1 manual validation was complete. The earlier checkpoint above is retained as historical evidence. The subsequent request to begin authorizes task 5.2; it does not complete the remaining game change or make it eligible for archive.
