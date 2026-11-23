## MODIFIED Requirements

### Requirement: SR-04 Material-change approval invalidation
An approved screenshot SHALL become pending when its actual association changes, including unassignment. Changes to parent participant description, promotion, event, match date, stipulation or championship information SHALL reset associated approved screenshots and advance their revisions atomically with the match write. Visual difficulty changes, including clearing the rating, SHALL preserve the saved review status. Screenshot notes, match notes and obscurity-only edits SHALL preserve review status. Changes to match notes or obscurity alone SHALL preserve associated screenshot revisions. Obscurity still changes derived classification under SR-02. Normalized no-ops SHALL preserve revisions and reviews. Editing SHALL never grant approval.

#### Scenario: Visual difficulty changes
- **WHEN** an approved screenshot's saved visual difficulty changes to another valid rating
- **THEN** the new input and screenshot revision commit together with its approval preserved
- **AND** the saved tier, points and eligibility reflect the current inputs and prerequisites

#### Scenario: Approved difficulty is cleared
- **WHEN** the operator clears the saved difficulty of an approved screenshot
- **THEN** it remains approved, becomes unrated and unclassified, and is ineligible with the missing-difficulty reason
- **AND** assigning a valid rating again restores eligibility if the other prerequisites hold, with approval preserved throughout

#### Scenario: Answer identity changes
- **WHEN** any named identifying or answer metadata field changes
- **THEN** match updates and resets of all and only associated approved screenshots commit atomically

#### Scenario: Association changes
- **WHEN** an approved screenshot is assigned to a different match or unassigned
- **THEN** its association change and reset to pending commit atomically

#### Scenario: Editorial or parent classification changes
- **WHEN** only notes or match obscurity change, or a normalized no-op is submitted
- **THEN** the review and revision preservation rules apply
- **AND** an obscurity change still affects the calculated tier without a screenshot-row rewrite

## ADDED Requirements

### Requirement: SR-09 Same-group review advancement
Within Review Queue, a confirmed approval or rejection SHALL advance to the next pending screenshot in the selected group when one exists. The target SHALL follow the group's stable screenshot order, wrapping within the group if needed. Advancement SHALL exclude the just-reviewed screenshot and SHALL stay in the selected group. Classification saves and Mark Pending SHALL leave selection in place. A failed or conflicted review SHALL leave the current screenshot selected for reconciliation.

#### Scenario: Decision advances within a group
- **WHEN** an operator approves or rejects a screenshot successfully and the group contains another pending screenshot
- **THEN** the workspace selects the next pending screenshot in that group, updates the preview and announces the change with visible keyboard focus

#### Scenario: Last pending item is resolved
- **WHEN** the operator successfully resolves the last pending screenshot in the selected group
- **THEN** the reviewed screenshot and the group completion state remain visible
- **AND** the operator can return to the updated queue or show completed groups

#### Scenario: Save fails or selection was stale
- **WHEN** a review request fails or conflicts with a newer record
- **THEN** selection remains on the same screenshot and the interface reports the problem without claiming success or advancing
