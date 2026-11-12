## Purpose

Run durable local wrestling trivia sessions with explicit contestants, fresh eligible screenshot selection, repeat prevention, authoritative scores and host-controlled completion.

## ADDED Requirements

### Requirement: GS-01 Explicit session setup
The host SHALL be able to create a setup session, configure contestants and their order, select a starting contestant, and explicitly start the game. Setup SHALL permit correction before start; a started game's roster SHALL remain fixed. Under approved P1, the MVP SHALL accept exactly one contestant for solo or two for head-to-head and SHALL reject all other counts and malformed contestant lists. Tournament/bracket functionality SHALL be out of scope. The retained proposed technical defaults SHALL permit one nonterminal session with distinct bounded validated names and no external accounts. Discarding setup SHALL not delete the library or award scores.

#### Scenario: Start a configured game
- **WHEN** the host starts a valid setup session with at least one eligible match available
- **THEN** it becomes active between rounds with the selected contestant and zero totals
- **AND** starting or reloading another tab does not silently replace it

#### Scenario: Solo and head-to-head counts
- **WHEN** a host submits otherwise valid setups containing one or two contestants
- **THEN** both supported configurations can start without tournament configuration or automatic rotation

#### Scenario: Invalid contestant counts
- **WHEN** setup contains zero, three or more contestants, a non-list value or malformed contestant entries
- **THEN** runtime validation rejects it without creating or partially updating the session

#### Scenario: Invalid or insufficient setup
- **WHEN** names/order/starting contestant are invalid, another session is nonterminal, or no eligible match exists
- **THEN** the request fails clearly without creating a partially started game
- **AND** limited per-tier or per-contestant capacity is explained without inventing eligible content

### Requirement: GS-02 Existing classification and eligibility compatibility
Game preparation SHALL use the approved nine-cell obscurity/visual-difficulty matrix and existing approval, complete participant/promotion/event, association and valid-image gates. Optional dates SHALL stay optional. Selection SHALL use saved server observations, not UI drafts or cached library counters. Current classification values and original capture provenance SHALL not be converted or rewritten for gameplay.

#### Scenario: Prepare from mixed library content
- **WHEN** the library contains approved/eligible, pending, rejected, unassigned, incomplete, unrated or unavailable images
- **THEN** only currently eligible screenshots of the selected calculated tier enter preparation
- **AND** the 1/2/3 points come from the shared classification rule

#### Scenario: Uncertain storage
- **WHEN** current asset readiness cannot be established
- **THEN** preparation reports a storage failure rather than an empty pool or fabricated valid candidate

### Requirement: GS-03 Random selection without session repeats
Selection SHALL choose uniformly among eligible unseen screenshot candidates of the requested tier, with independently testable randomness and deterministic candidate ordering. A match exposed once SHALL be excluded for the entire session across all screenshots, contestants and tiers. Exposed screenshot identities SHALL also be excluded. Under recommended P4, exact previously exposed image content SHALL not reappear under another retained capture identity using saved SHA-256 and bounded selected-file verification during preparation, without image processing on the countdown/judgment path. This safeguard SHALL be distinct from already approved match-level exposure protection. No source-video uniqueness, tier quotas, weighting, automatic fallback or perceptual matching SHALL be added.

#### Scenario: Multiple screenshots for one match
- **WHEN** one screenshot is exposed and that match has other eligible screenshots, including other tiers or source videos
- **THEN** none of those screenshots can be drawn again in this session
- **AND** distinct matches from the same video remain selectable

#### Scenario: Exact duplicate under different identities
- **WHEN** a candidate belongs to a different match/capture ID but its saved and verified SHA-256 equals previously exposed content
- **THEN** recommended P4 excludes it without treating shared video identity as a duplicate or hashing images during the countdown

#### Scenario: Empty or exhausted tier
- **WHEN** a tier has no eligible unseen candidate
- **THEN** no round is silently substituted and no seen sets, turn or score change
- **AND** the host can explicitly choose another available tier or end the game

#### Scenario: Reproducible selection
- **WHEN** a test supplies the same ordered candidate observation, used sets and random sample
- **THEN** selection returns the same candidate without requiring production randomness to be predictable

### Requirement: GS-04 Reservation and immutable round context
A prepared candidate SHALL be reserved within the active session and revalidated before exposure. Preparing/Ready SHALL keep the clue covered on contestant displays; preload/decode SHALL not mark exposure. Exposure SHALL be committed only by accepted screenshot Reveal & start. The round SHALL retain its selected contestant, screenshot/match identities, image identity and answer/classification input snapshot. Its contestantId SHALL be copied from the session activeContestantId at attempt creation and SHALL remain immutable through preparation, exposure, adjudication and history. After exposure, saved library edits SHALL not change the round's answer, base points or already earned score. Future selections SHALL use fresh library data. Session use history SHALL be committed before exposure is published.

#### Scenario: Cancel a covered prepared clue
- **WHEN** an image has preloaded in Ready and the host cancels before screenshot Reveal & start
- **THEN** the cancelled attempt/owner/receipt remain in history, no match is exposed or blocked by that attempt, and no visible turn or score is consumed

#### Scenario: Library changes before reveal
- **WHEN** a selected asset, review, association or relevant record revision changes before exposure
- **THEN** reveal is blocked with an actionable reason and no different candidate or answer is silently substituted

#### Scenario: Library changes after exposure
- **WHEN** an exposed match's metadata or classifications change in the library
- **THEN** the current round and score history retain their pinned context while subsequent preparations observe the edits

### Requirement: GS-05 Contestant turn control
Under approved P2, the host SHALL explicitly select the active contestant through a convenient Switch contestant action between rounds. Authoritative session activeContestantId and round contestantId SHALL represent selection and ownership separately. The selected contestant SHALL stay active until the host explicitly changes it; advancing or resolving a round SHALL not automatically alternate contestants. Selection changes SHALL be rejected outside between-round state and SHALL never reassign an existing round or score. The current contestant and chosen tier SHALL be visible. Unexposed cancellation SHALL keep the contestant and turn number unchanged. A skipped or cancelled exposed turn SHALL remain recorded as a zero-point turn.

#### Scenario: Keep the contestant across consecutive rounds
- **WHEN** a host advances a resolved turn and prepares another without selecting a different contestant
- **THEN** the same contestant remains active and owns the new round without any automatic alternation

#### Scenario: Explicitly switch contestants
- **WHEN** the host uses Switch contestant between rounds to select another contestant in this session
- **THEN** the server records that selection and uses it for subsequent attempts
- **AND** prior round owners, outcomes and scores remain unchanged

#### Scenario: Prevent reassignment during an attempt
- **WHEN** a host requests a contestant change while an attempt is preparing, ready, guessing, paused, awaiting judgment, adjudicated, answer-revealed or interrupted
- **THEN** the request fails without changing selection, round owner, deadline, outcome or scores
- **AND** the host must first cancel the unexposed attempt or resolve and advance the exposed round

#### Scenario: Recover explicit contestant state
- **WHEN** a session is reopened after the host switched contestants between rounds
- **THEN** its last committed activeContestantId and every historical round contestantId are separately preserved without reassignment

### Requirement: GS-06 Once-only score totals
A correct host judgment SHALL award exactly the frozen round tier's 1/2/3 base points once to that round's immutable contestantId, never to a later session activeContestantId. Incorrect, timeout and void outcomes SHALL award zero. Totals SHALL derive from committed outcomes/awards and SHALL not be editable client fields. Rankings SHALL sort descending by total and preserve equal-score ties; setup order SHALL only stabilize display order. The proposed MVP SHALL have no bonus execution, score override or adjudication undo.

#### Scenario: Repeated correct command
- **WHEN** the same accepted judgment is retried or another command tries to score a resolved round
- **THEN** no additional points are awarded and the original receipt or explicit conflict is returned

#### Scenario: Committed award before filmed result reveal
- **WHEN** a correct judgment is committed but the host has not selected Reveal Result
- **THEN** host totals and persisted awards include it immediately while the public contestant projection withholds that round's score increment and outcome
- **AND** Reveal Result publishes the existing award without adding another score event or changing rankings/ownership rules

#### Scenario: Score ownership after a later selection
- **WHEN** a judgment for contestant A committed, the host advanced and selected contestant B, and the original judgment is retried or its receipt arrives late
- **THEN** the original award still belongs only to A, B receives none of those points, and no additional award occurs

#### Scenario: Host judges a verbal answer
- **WHEN** the host accepts identification of the wrestlers and match
- **THEN** no automatic event/year requirement or text matching overrides the judgment
- **AND** optional verbal follow-ups do not create bonus points

### Requirement: GS-07 Manual completion and fresh-game reset
The host SHALL explicitly end an active game from between-turn or resolved-round states. Unresolved work SHALL require deliberate resolution or cancellation first. Completion SHALL publish final scores and every contestant tied for the highest total, or the sole winner. Restart/reset SHALL create a new session identity with zero totals and empty used sets, preserving the previous session and library. Completed sessions SHALL not accept further scoring.

#### Scenario: Winner or tie
- **WHEN** the host ends a started game
- **THEN** final totals determine the winner or all tied leaders without an invented tiebreaker or automatic fixed-round limit

#### Scenario: Start again
- **WHEN** the host starts a new game after completion
- **THEN** the prior result remains intact and repeat-prevention history belongs to the new session only

### Requirement: GS-08 Durable recovery and compatible storage
Session setup, transitions, used history, outcomes, awards and accepted command receipts SHALL survive supported process restarts. Failed writes SHALL leave the last committed game intact and SHALL not publish success or points. Approved migrations SHALL preserve library records, earlier migrations, asset paths and original captures; unsupported newer stores SHALL fail clearly without recreation. Unknown elapsed time after a crash SHALL not be turned into a fresh guessing window.

#### Scenario: Restart after a score commit
- **WHEN** the server restarts after accepting a judgment but before its response reaches the host
- **THEN** the committed outcome and totals are restored and resolving that command cannot score it again

#### Scenario: Recover a known pause
- **WHEN** the server restarts from a committed paused remainder and its pinned clue remains valid
- **THEN** recommended P6 restores a covered paused round with the same owner and used history, requiring fresh readiness and explicit Resume without resetting time

#### Scenario: Restart during preparation
- **WHEN** the server restarts after accepting Prepare but before committing Ready
- **THEN** recommended P6 retains a cancelled unexposed attempt/receipt, restores between-round selection and consumes no match, visible turn or score

#### Scenario: Restart with a covered Ready round
- **WHEN** the server restores an unexposed Ready round
- **THEN** recommended P6 requires candidate/image revalidation, fresh decode and explicit host screenshot Reveal before exposure; invalid content must be cancelled rather than substituted

#### Scenario: Missing clue after a committed judgment
- **WHEN** image bytes are unavailable after a scored round is recovered
- **THEN** the committed outcome, answer snapshot, contestant ownership and award remain intact while image availability is reported separately

#### Scenario: Restart during a running window
- **WHEN** the server restarts with Guessing as the last committed phase and without a trustworthy persisted paused remainder
- **THEN** the exposed round becomes interrupted, the display covers the image, and the host must deliberately void it under the proposed recovery policy
- **AND** the match stays used and no automatic full-duration restart or point award occurs
