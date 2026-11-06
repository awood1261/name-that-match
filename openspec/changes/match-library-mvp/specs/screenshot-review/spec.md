## Purpose

Prepare individual screenshots for future gameplay through independent difficulty and match obscurity classifications, explicit editorial review, material-change invalidation, and server-derived eligibility.

## ADDED Requirements

### Requirement: SR-01 Screenshot difficulty classification
Each screenshot SHALL support unrated (`null`), Squash Match (`squash`, 1 point), Competitive Match (`competitive`, 2 points), or Deathmatch (`deathmatch`, 3 points). Screenshots of one match SHALL support different difficulties. The library SHALL store/display classification and its established point meaning without implementing a scoring engine or changing point values.

#### Scenario: Independent screenshot ratings
- **WHEN** two screenshots of the same match receive different supported difficulties or one remains unrated
- **THEN** each retains its own classification and displayed point meaning, with no match-wide difficulty assignment

#### Scenario: Invalid difficulty
- **WHEN** an update supplies any other difficulty
- **THEN** validation rejects it without changing the screenshot

### Requirement: SR-02 Match obscurity classification
Match obscurity SHALL be nullable and otherwise exactly Iconic (`iconic`), Familiar (`familiar`), or Obscure (`obscure`). Iconic means widely recognized by a broad wrestling audience; Familiar means recognizable to fans of its wrestlers, promotion, or era; Obscure means primarily recognizable to dedicated fans with deeper wrestling knowledge. Obscurity SHALL NOT automatically affect screenshot difficulty, points, approval, or eligibility and SHALL have no numeric scoring or extra categories.

#### Scenario: Change editorial obscurity
- **WHEN** a match's obscurity changes or is unset
- **THEN** its screenshots retain difficulty and review status, established points remain unchanged, and eligibility does not require obscurity

### Requirement: SR-03 Explicit individual review
Each screenshot SHALL have pending, approved, or rejected review status. Imports SHALL start unassigned, unrated, and pending. An operator SHALL explicitly approve/reject each screenshot individually; rejected screenshots and provenance SHALL remain stored. Approval SHALL be refused unless the asset is committed/valid/available, association exists, difficulty is set, and the parent match has identifying metadata. Bulk rating, approval, rejection, and deletion SHALL not be offered.

#### Scenario: Review a prepared screenshot
- **WHEN** an operator approves an individually selected valid screenshot with an identified parent match and difficulty
- **THEN** it becomes approved using current screenshot and parent revisions

#### Scenario: Refuse premature approval
- **WHEN** an unassigned, unrated, insufficiently identified, missing-image, or corrupt-image screenshot is approved
- **THEN** the action fails with explicit blocking reasons and its existing status is preserved

#### Scenario: Reject or reconsider
- **WHEN** the operator individually rejects a screenshot or later explicitly sets it pending or approves it after meeting prerequisites
- **THEN** the chosen valid transition is recorded without deleting its image or provenance

### Requirement: SR-04 Material-change approval invalidation
An approved screenshot SHALL become pending when its difficulty or assigned match actually changes, including unrating/unassignment. Changing its parent match's participant description, promotion, event, match date, stipulation, or championship information SHALL reset associated approved screenshots to pending in the same transaction as the match edit and increment their revisions. Changes only to screenshot notes, match notes, or match obscurity SHALL preserve review. Normalized no-op edits SHALL preserve review and revision. Nonapproved screenshots SHALL not acquire approval through edits.

#### Scenario: Screenshot material edit
- **WHEN** an approved screenshot's difficulty or association changes
- **THEN** the changed fields and pending status commit together and reapproval requires a subsequent explicit individual action

#### Scenario: Parent answer metadata changes
- **WHEN** any named answer-identifying match field changes
- **THEN** all and only associated approved screenshots reset to pending atomically, including when the match becomes incomplete

#### Scenario: Editorial-only or unchanged edits
- **WHEN** only notes or obscurity change, or a submitted value equals the stored normalized value
- **THEN** approval is preserved, and a wholly unchanged record retains its revision

### Requirement: SR-05 Derived eligibility and explanations
The server SHALL derive eligibility from all of: committed managed image available and valid; assigned existing match; nonempty participant description, promotion, and event; set difficulty; approved review. Date and obscurity SHALL not be required. Eligibility SHALL not be independently editable or persisted as a redundant authoritative boolean. Administrative responses SHALL include deterministic blocking reasons for missing/corrupt images, unassigned screenshots, incomplete match fields, unrated difficulty, pending review, and rejection.

#### Scenario: All prerequisites met
- **WHEN** every required condition is true, even with date and obscurity unset
- **THEN** the screenshot is administratively eligible with no blocking reasons

#### Scenario: Any prerequisite fails
- **WHEN** one or more required conditions is false
- **THEN** eligibility is false with all applicable deterministic reasons and no gameplay selection or scoring is performed

### Requirement: SR-06 Asset availability after approval
Changes to managed-image availability or validity SHALL affect eligibility and image responses without rewriting review history. Asset assessment SHALL not trust import-time validation forever or a stale approval flag. Restoring an unchanged valid asset SHALL clear its asset-related reasons, while substituted bytes SHALL be treated as corrupt relative to the committed content hash.

#### Scenario: Approved image missing or modified
- **WHEN** a previously approved image disappears, becomes invalid, or differs from its committed hash
- **THEN** it remains recorded as approved but is ineligible and cannot be served as a valid image

#### Scenario: Restore original asset
- **WHEN** the original valid bytes are restored and all other prerequisites still hold
- **THEN** eligibility is recalculated and asset-related blockers clear without an automatic review-state change
