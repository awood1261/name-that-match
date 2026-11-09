## Purpose

Run durable local wrestling trivia sessions with explicit contestants, fresh eligible screenshot selection, repeat prevention, authoritative scores and host-controlled completion.

## ADDED Requirements

### Requirement: GS-01 Explicit session setup
The host SHALL be able to create a setup session, configure contestants and their order, select a starting contestant, and explicitly start the game. Setup SHALL permit correction before start; a started game's roster SHALL remain fixed. The proposed MVP SHALL permit one nonterminal session and one to eight distinct named contestants, with bounded validated names and no external accounts. Discarding setup SHALL not delete the library or award scores.

#### Scenario: Start a configured game
- **WHEN** the host starts a valid setup session with at least one eligible match available
- **THEN** it becomes active between rounds with the selected contestant and zero totals
- **AND** starting or reloading another tab does not silently replace it

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
Selection SHALL choose uniformly among eligible unseen screenshot candidates of the requested tier, with independently testable randomness and deterministic candidate ordering. A match exposed once SHALL be excluded for the entire session across all screenshots, contestants and tiers. Exposed screenshot identities SHALL also be excluded. Under the proposed duplicate-content safeguard, exact previously exposed image content SHALL not reappear under another retained capture identity. No source-video uniqueness, tier quotas, weighting, automatic fallback or perceptual matching SHALL be added.

#### Scenario: Multiple screenshots for one match
- **WHEN** one screenshot is exposed and that match has other eligible screenshots, including other tiers or source videos
- **THEN** none of those screenshots can be drawn again in this session
- **AND** distinct matches from the same video remain selectable

#### Scenario: Empty or exhausted tier
- **WHEN** a tier has no eligible unseen candidate
- **THEN** no round is silently substituted and no seen sets, turn or score change
- **AND** the host can explicitly choose another available tier or end the game

#### Scenario: Reproducible selection
- **WHEN** a test supplies the same ordered candidate observation, used sets and random sample
- **THEN** selection returns the same candidate without requiring production randomness to be predictable

### Requirement: GS-04 Reservation and immutable round context
A prepared candidate SHALL be reserved within the active session and revalidated before exposure. The round SHALL retain its selected contestant, screenshot/match identities, image identity and answer/classification input snapshot. After exposure, saved library edits SHALL not change the round's answer, base points or already earned score. Future selections SHALL use fresh library data. Session use history SHALL be committed before exposure is published.

#### Scenario: Library changes before reveal
- **WHEN** a selected asset, review, association or relevant record revision changes before exposure
- **THEN** reveal is blocked with an actionable reason and no different candidate or answer is silently substituted

#### Scenario: Library changes after exposure
- **WHEN** an exposed match's metadata or classifications change in the library
- **THEN** the current round and score history retain their pinned context while subsequent preparations observe the edits

### Requirement: GS-05 Contestant turn control
The current contestant and chosen tier SHALL be visible. Under the proposed progression policy, advancing a resolved exposed turn SHALL suggest the next contestant cyclically in setup order, with explicit host override only between turns. Unexposed cancellation SHALL keep the contestant and turn number unchanged. A skipped or cancelled exposed turn SHALL remain recorded as a zero-point turn.

#### Scenario: Alternate contestants
- **WHEN** the host advances after a completed exposed turn
- **THEN** the next contestant is selected in order, including wraparound, without automatically starting a new timer

### Requirement: GS-06 Once-only score totals
A correct host judgment SHALL award exactly the frozen round tier's 1/2/3 base points once. Incorrect, timeout and void outcomes SHALL award zero. Totals SHALL derive from committed outcomes/awards and SHALL not be editable client fields. Rankings SHALL sort descending by total and preserve equal-score ties; setup order SHALL only stabilize display order. The proposed MVP SHALL have no bonus execution, score override or adjudication undo.

#### Scenario: Repeated correct command
- **WHEN** the same accepted judgment is retried or another command tries to score a resolved round
- **THEN** no additional points are awarded and the original receipt or explicit conflict is returned

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

#### Scenario: Restart during a running window
- **WHEN** the server restarts without a trustworthy persisted paused remainder
- **THEN** the exposed round becomes interrupted, the display covers the image, and the host must deliberately void it under the proposed recovery policy
- **AND** the match stays used and no automatic ten-second restart or point award occurs
