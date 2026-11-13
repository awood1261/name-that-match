## Purpose

Control the filmed round lifecycle with a server-owned thirty-second window, explicit host adjudication, safe interruptions and reliable command outcomes shared by both production modes.

## ADDED Requirements

### Requirement: GR-01 Explicit authoritative progression
The game SHALL expose explicit between-round, preparing, ready, guessing, paused, awaiting-judgment, adjudicated, answer-revealed and interrupted phases within an active session. Only allowed commands SHALL advance a phase. Rendering, animation completion, reconnecting and browser timers SHALL not adjudicate or advance a round. Each attempt SHALL have stable session/round identities, an immutable assigned contestantId and a monotonic state revision. The authoritative session SHALL separately retain activeContestantId; round progression SHALL not automatically change that selection.

#### Scenario: Normal round
- **WHEN** the host prepares eligible content, waits for readiness, reveals it, judges, reveals the answer and advances
- **THEN** the server moves through the defined phases in order without exposing the answer early or starting the next round automatically

#### Scenario: Invalid transition
- **WHEN** a client tries to reveal before ready, judge an unexposed round, advance an unresolved round or mutate a completed session
- **THEN** the command fails without hidden state, score or repeat-history changes

### Requirement: GR-02 Atomic reveal and thirty-second timer
Reveal and start SHALL be one host operation after the selected image is validated and decoded by the designated display. It SHALL commit exposure and an authoritative thirty-second deadline together. Server elapsed time SHALL determine expiration independently of delayed timer callbacks or client clock changes. Cosmetic shuffle effects SHALL finish before this window and SHALL not expose unused real screenshots.

#### Scenario: Ready reveal
- **WHEN** the host reveals a ready round with the current display acknowledgment
- **THEN** the preloaded image becomes visible, the match becomes used and one thirty-second deadline starts

#### Scenario: Delayed callback or client drift
- **WHEN** the host command arrives at or after the deadline even if a server timeout callback has not executed
- **THEN** expiration is settled first and an ordinary in-window correct command cannot bypass it

### Requirement: GR-03 Correct, incorrect and expired attempts
A correct in-window judgment SHALL stop the timer and resolve the round for its base points. An incorrect judgment SHALL end the attempt immediately for zero points, without allowing more guesses in that attempt. Expiration SHALL close guessing and enter awaiting-judgment with zero time and no automatic points; answer visibility SHALL remain host-controlled.

#### Scenario: Incorrect during countdown
- **WHEN** the host marks the answer incorrect with a current valid command
- **THEN** the attempt ends for zero points even if time remains

#### Scenario: Deadline reached
- **WHEN** the authoritative thirty-second window expires
- **THEN** further guesses are closed and the host must explicitly confirm no credit or use the approved pre-buzzer judgment action

### Requirement: GR-04 Explicit pre-buzzer judgment after expiration
While awaiting judgment, the host SHALL be able to explicitly attest that the contestant answered correctly before the buzzer and award the same base points once. This SHALL be a distinct action from ordinary Correct and SHALL record that the decision was entered after expiry. It SHALL not restart the clock, accept post-buzzer guesses automatically, alter tier points or undo an already resolved outcome.

#### Scenario: Host clicks after a timely verbal answer
- **WHEN** the timer has expired and the host explicitly confirms a correct answer spoken before the buzzer
- **THEN** the round resolves for its base points with that attestation recorded

#### Scenario: No timely correct answer
- **WHEN** the host confirms timeout/no credit
- **THEN** the round resolves with zero points and cannot later receive another judgment

### Requirement: GR-05 Approved pause and resume controls
Under approved P3, the MVP SHALL permit host pause while guessing, preserving the server-calculated remainder and covering the screenshot on contestant displays. Resume SHALL require a connected, synchronized, decoded primary display and an explicit host action. It SHALL use the saved remainder rather than grant another thirty seconds. A pause arriving after expiry SHALL not restore guessing time.

#### Scenario: Pause and resume
- **WHEN** the host pauses with four seconds remaining and later resumes after readiness is restored
- **THEN** the image is covered while paused and only the preserved remainder is available after resume

#### Scenario: Pause at the deadline
- **WHEN** a Pause request arrives at or after the authoritative deadline even if its timer callback is delayed
- **THEN** expiry is settled first and no paused remainder or fresh guessing window is created

### Requirement: GR-06 Approved cancel, skip, void and no-restart controls
Under approved P3, cancelling preparation before exposure SHALL release the reservation without consuming a match or turn. Voiding/skipping an unresolved exposed attempt SHALL use one canonical zero-point void transition, with reason skip for a passed clue or void for an invalid/abandoned attempt, while retaining screenshot/match use history and immutable round ownership. Neither action SHALL automatically Advance. Cancelling, voiding and skipping SHALL retain historical attempts, exposure flags, reasons and accepted receipts rather than delete them. Replaying an exposed screenshot with a fresh timer SHALL not be offered. A replacement SHALL be a new eligible unseen draw; no action SHALL erase committed points under the guise of cancellation.

#### Scenario: Cancel before reveal
- **WHEN** an unexposed ready/preparing attempt is cancelled
- **THEN** it returns to between-round state with the same active contestant and no consumed match

#### Scenario: Void and Skip share finalization
- **WHEN** the host chooses either Void or Skip on an unresolved exposed round and retries that command
- **THEN** one zero-point void outcome with its reason is retained, the match stays blocked and there is no duplicate score, turn or automatic Advance

#### Scenario: No same-round restart
- **WHEN** the host requests a fresh timer for a prepared/exposed or resolved round
- **THEN** restart is rejected without changing its history or awarding points; supported Resume uses only a paused remainder

#### Scenario: Skip after reveal
- **WHEN** the host deliberately skips an exposed unresolved attempt
- **THEN** it records a void zero-point turn and that match cannot be redrawn in the session

### Requirement: GR-07 Outcome, answer reveal and advance
Under the owner-approved task 5.1 refinement of P9, judgment and contestant result presentation SHALL be separate host-controlled steps. Judgment SHALL commit the existing outcome/award once and enter concealed adjudicated state. Only a subsequent host **Reveal Result** action, using the existing `REVEAL_ANSWER` command and `answer_revealed` phase, SHALL publish the outcome, earned points and frozen answer together. Screenshot Reveal & start remains a different action. The public adjudicated projection SHALL omit outcome, award, answer and the current round's score increment; private host state SHALL retain the actual committed judgment/totals. Reveal Result and Advance SHALL never create score awards or reapply a judgment. The answer SHALL include the pinned participant/promotion/event fields and only the known precision of optional date/stipulation/championship metadata. Advancing SHALL still require result/answer reveal or an explicitly voided turn and SHALL clear the public round image/answer without resetting scores or used history or changing activeContestantId or historical round contestantId. Ending a game SHALL still be allowed from a resolved round without forcing a reveal; final completion totals remain authoritative.

#### Scenario: Show the answer
- **WHEN** the host explicitly selects Reveal Result after a valid judgment
- **THEN** contestant displays show the saved outcome, earned points and answer snapshot together rather than infer metadata from a video title or invent a date

#### Scenario: Conceal judgment until presentation
- **WHEN** Correct, Incorrect, pre-buzzer credit, timeout confirmation or Skip/Void resolves the attempt
- **THEN** the server preserves the existing scoring, ownership and repeat-history effects exactly once
- **AND** the contestant sees a neutral covered waiting state with no dramatic result, match identity, outcome/award fields or current-round score increment until Reveal Result

#### Scenario: Recover before or after result reveal
- **WHEN** a contestant refreshes or reconnects in adjudicated or answer-revealed state
- **THEN** the server restores respectively the exposed clue with saved stopped timer and concealed result, or the already revealed frozen result/answer without scoring, replaying a reveal command or automatically starting an entrance animation

#### Scenario: Repeated Reveal and Advance do not score
- **WHEN** the host reveals an adjudicated answer and advances, retries accepted commands, or sends new commands for an already completed transition
- **THEN** accepted retries return receipts, inapplicable new commands conflict, and scores and round ownership never change
- **AND** Advance preserves activeContestantId and never prepares or starts a round automatically

### Requirement: GR-08 Stale and duplicate command safety
Host commands SHALL identify their intended session, applicable round, expected state revision and unique command identity. A retry with the same identity/content SHALL return the recorded result plus current state without repeating effects. Reusing an identity for different content SHALL conflict. Stale revisions, wrong rounds and invalid payloads SHALL leave prior outcomes intact. Unknown delivery after reconnect SHALL be resolved explicitly rather than blindly replayed.

#### Scenario: Competing host tabs
- **WHEN** two host requests attempt to judge or advance from the same revision
- **THEN** at most one applicable mutation commits and the other receives conflict/current-state information

#### Scenario: Old acknowledgment arrives
- **WHEN** a response to a previously accepted command arrives after a newer snapshot
- **THEN** the UI does not roll back to the receipt's historical revision or duplicate its score

### Requirement: GR-09 Thirty-second duration upgrade preserves existing records
Newly revealed rounds SHALL use a standard 30,000ms server-owned guessing window. Saved paused remainders and completed history SHALL remain unchanged by upgrade; future new rounds in an existing session SHALL use the new duration. The storage upgrade SHALL preserve records, indexes, triggers and foreign-key enforcement transactionally and SHALL reject durations above 30,000ms. Failure SHALL roll back data, schema and version without exposing partial success. Existing classification/scoring, controller lease, liveness and command semantics SHALL remain unchanged.

#### Scenario: Thirty-second boundary
- **WHEN** a new round is revealed
- **THEN** host and contestant observe 30 seconds initially, ordinary correct judgment is eligible at 29,999ms and expiration wins at 30,000ms
- **AND** cosmetic clocks do not extend that deadline

#### Scenario: Legacy saved pause
- **WHEN** a version-3 game with a saved five-second pause is upgraded and resumed explicitly after readiness
- **THEN** its remainder is still five seconds rather than thirty and earlier awards/receipts/library records remain unchanged

#### Scenario: Failed timing migration
- **WHEN** migration fails after replacement-table or drop/rename work
- **THEN** the old schema version, rows, indexes, triggers and foreign-key enforcement remain recoverable without data loss

### Requirement: GR-10 Hold the exposed clue and stopped countdown
The server SHALL preserve the exact judgment-time remaining duration for new Correct/Incorrect judgments and zero for expiry/late-before-buzzer judgments. The synchronized contestant SHALL retain the same exposed screenshot and strip in awaiting-judgment/adjudicated, freezing time rather than running another clock. Outcome, points and answer SHALL remain concealed until explicit Reveal Result. Paused/interrupted/stale covers and existing scoring/Advance/End rules SHALL remain unchanged. Saved stopped time and current frozen image SHALL restore across refresh/reconnect/restart without scoring again. Schema 5 SHALL add bounded nullable immutable stopped timing transactionally; legacy judgments with unknown stopped time SHALL remain unknown rather than invent a remainder. Missing/changed images SHALL show an honest fallback without changing judgment/history.

#### Scenario: Host judges with time left
- **WHEN** Correct or Incorrect is accepted with 23,500ms left
- **THEN** the same clue remains with a frozen 00:24 countdown through observations, refresh and restart
- **AND** neither judgment nor award/answer is publicly disclosed before Reveal Result

#### Scenario: Time expires
- **WHEN** the thirty-second guessing deadline expires
- **THEN** the same clue remains at 00:00 while awaiting judgment and after Confirm timeout or Correct before buzzer
- **AND** no further ordinary guesses, automatic result reveal, restart or duplicate award occurs

#### Scenario: Existing judgment or unavailable asset
- **WHEN** an old judgment has no recorded stopped duration or its frozen asset cannot be validated
- **THEN** unknown time or unavailable image is represented honestly without fabricated timing, substituted image or changed scores
