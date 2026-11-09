## Purpose

Control the filmed round lifecycle with a server-owned ten-second window, explicit host adjudication, safe interruptions and reliable command outcomes shared by both production modes.

## ADDED Requirements

### Requirement: GR-01 Explicit authoritative progression
The game SHALL expose explicit between-round, preparing, ready, guessing, paused, awaiting-judgment, adjudicated, answer-revealed and interrupted phases within an active session. Only allowed commands SHALL advance a phase. Rendering, animation completion, reconnecting and browser timers SHALL not adjudicate or advance a round. Each attempt SHALL have stable session/round identities, an immutable assigned contestantId and a monotonic state revision. The authoritative session SHALL separately retain activeContestantId; round progression SHALL not automatically change that selection.

#### Scenario: Normal round
- **WHEN** the host prepares eligible content, waits for readiness, reveals it, judges, reveals the answer and advances
- **THEN** the server moves through the defined phases in order without exposing the answer early or starting the next round automatically

#### Scenario: Invalid transition
- **WHEN** a client tries to reveal before ready, judge an unexposed round, advance an unresolved round or mutate a completed session
- **THEN** the command fails without hidden state, score or repeat-history changes

### Requirement: GR-02 Atomic reveal and ten-second timer
Reveal and start SHALL be one host operation after the selected image is validated and decoded by the designated display. It SHALL commit exposure and an authoritative ten-second deadline together. Server elapsed time SHALL determine expiration independently of delayed timer callbacks or client clock changes. Cosmetic shuffle effects SHALL finish before this window and SHALL not expose unused real screenshots.

#### Scenario: Ready reveal
- **WHEN** the host reveals a ready round with the current display acknowledgment
- **THEN** the image becomes public, the match becomes used and one ten-second deadline starts

#### Scenario: Delayed callback or client drift
- **WHEN** the host command arrives at or after the deadline even if a server timeout callback has not executed
- **THEN** expiration is settled first and an ordinary in-window correct command cannot bypass it

### Requirement: GR-03 Correct, incorrect and expired attempts
A correct in-window judgment SHALL stop the timer and resolve the round for its base points. An incorrect judgment SHALL end the attempt immediately for zero points, without allowing more guesses in that attempt. Expiration SHALL close guessing and enter awaiting-judgment with zero time and no automatic points; answer visibility SHALL remain host-controlled.

#### Scenario: Incorrect during countdown
- **WHEN** the host marks the answer incorrect with a current valid command
- **THEN** the attempt ends for zero points even if time remains

#### Scenario: Deadline reached
- **WHEN** the authoritative ten-second window expires
- **THEN** further guesses are closed and the host must explicitly confirm no credit or use the approved pre-buzzer judgment action

### Requirement: GR-04 Explicit pre-buzzer judgment after expiration
While awaiting judgment, the host SHALL be able to explicitly attest that the contestant answered correctly before the buzzer and award the same base points once. This SHALL be a distinct action from ordinary Correct and SHALL record that the decision was entered after expiry. It SHALL not restart the clock, accept post-buzzer guesses automatically, alter tier points or undo an already resolved outcome.

#### Scenario: Host clicks after a timely verbal answer
- **WHEN** the timer has expired and the host explicitly confirms a correct answer spoken before the buzzer
- **THEN** the round resolves for its base points with that attestation recorded

#### Scenario: No timely correct answer
- **WHEN** the host confirms timeout/no credit
- **THEN** the round resolves with zero points and cannot later receive another judgment

### Requirement: GR-05 Proposed pause and resume policy
The proposed MVP SHALL permit host pause while guessing, preserving the server-calculated remainder and covering the screenshot on contestant displays. Resume SHALL require a connected, synchronized, decoded primary display and an explicit host action. It SHALL use the saved remainder rather than grant another ten seconds. A pause arriving after expiry SHALL not restore guessing time.

#### Scenario: Pause and resume
- **WHEN** the host pauses with four seconds remaining and later resumes after readiness is restored
- **THEN** the image is covered while paused and only the preserved remainder is available after resume

### Requirement: GR-06 Proposed cancel, skip and restart policy
Cancelling preparation before exposure SHALL release the reservation without consuming a match or turn. Cancelling/skipping after exposure SHALL void the turn for zero points while retaining screenshot/match use history. Replaying an exposed screenshot with a fresh timer SHALL not be offered. A replacement SHALL be a new eligible unseen draw; no action SHALL erase committed points under the guise of cancellation.

#### Scenario: Cancel before reveal
- **WHEN** an unexposed ready/preparing attempt is cancelled
- **THEN** it returns to between-round state with the same active contestant and no consumed match

#### Scenario: Skip after reveal
- **WHEN** the host deliberately skips an exposed unresolved attempt
- **THEN** it records a void zero-point turn and that match cannot be redrawn in the session

### Requirement: GR-07 Outcome, answer reveal and advance
Judgment feedback and answer reveal SHALL be distinct host-controlled steps. The answer SHALL include the pinned participant/promotion/event fields and only the known precision of optional metadata. Advancing SHALL require answer reveal or an explicitly voided turn and SHALL clear the public round image/answer without resetting scores or used history or changing activeContestantId or historical round contestantId. Ending a game SHALL also be allowed from a resolved round without forcing an answer reveal.

#### Scenario: Show the answer
- **WHEN** the host reveals a resolved round's answer
- **THEN** contestant displays show the saved answer snapshot rather than infer it from a video title or invent a date

### Requirement: GR-08 Stale and duplicate command safety
Host commands SHALL identify their intended session, applicable round, expected state revision and unique command identity. A retry with the same identity/content SHALL return the recorded result plus current state without repeating effects. Reusing an identity for different content SHALL conflict. Stale revisions, wrong rounds and invalid payloads SHALL leave prior outcomes intact. Unknown delivery after reconnect SHALL be resolved explicitly rather than blindly replayed.

#### Scenario: Competing host tabs
- **WHEN** two host requests attempt to judge or advance from the same revision
- **THEN** at most one applicable mutation commits and the other receives conflict/current-state information

#### Scenario: Old acknowledgment arrives
- **WHEN** a response to a previously accepted command arrives after a newer snapshot
- **THEN** the UI does not roll back to the receipt's historical revision or duplicate its score
