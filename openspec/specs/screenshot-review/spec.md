# screenshot-review Specification

## Purpose

Prepare individual wrestling screenshots through independent match obscurity and visual difficulty inputs, the approved derived game-tier matrix, explicit host review and current asset-based eligibility.

## Requirements

### Requirement: SR-01 Independent screenshot visual difficulty
Each screenshot SHALL support unset (`null`), Easy (`easy`), Medium (`medium`) or Hard (`hard`) visual difficulty. Easy describes clear identifying visual clues; Medium describes some recognizable clues requiring additional knowledge; Hard describes limited, misleading or ambiguous clues. Faces, attire, arena, branding, belts and other context can inform this editorial input. Difficulty SHALL be editable individually without recreating, moving or reassociating the screenshot. It SHALL NOT itself be a game tier or carry a fixed point value.

#### Scenario: Different images of one match
- **WHEN** screenshots associated with the same match are given different visual difficulty inputs or remain unset
- **THEN** each persists its own input and unchanged provenance/association
- **AND** its resulting game tier is calculated independently under SR-07

#### Scenario: Invalid or legacy difficulty input
- **WHEN** a mutation contains an unsupported visual difficulty or legacy direct-tier value
- **THEN** it is rejected with field feedback without a partial save

### Requirement: SR-02 Match obscurity classification
Match obscurity SHALL be unset (`null`) or Low (`low`), Medium (`medium`) or High (`high`). Low describes a widely recognizable or historically prominent match; Medium describes a match knowledgeable fans may recognize but that is not universally familiar; High describes an obscure match requiring deeper wrestling knowledge. This input SHALL belong to the match and remain separate from screenshot visual clues. A saved obscurity change SHALL recalculate associated screenshots' game tiers, points, eligibility reasons and tier pools on subsequent reads without manually updating their difficulty, association, review or revisions.

#### Scenario: Change the parent classification
- **WHEN** a host changes a match from Low to High while an associated approved screenshot has Medium visual difficulty
- **THEN** its derived tier changes from Squash Match/1 point to Deathmatch/3 points
- **AND** the screenshot's visual difficulty, review, provenance and revision remain unchanged

#### Scenario: Unset parent classification
- **WHEN** match obscurity is cleared
- **THEN** associated screenshots become unclassified and ineligible without losing their saved visual difficulty or review

### Requirement: SR-03 Explicit individual review
Each screenshot SHALL retain pending, approved or rejected review. Imports SHALL start unassigned, visually unrated and pending. Approval SHALL be explicit and individual and SHALL require a valid available committed image, an associated existing match with participant description/promotion/event, both classification inputs and current screenshot/parent revisions. Rejected images and provenance SHALL remain stored. Bulk difficulty/review/deletion controls SHALL NOT be offered.

#### Scenario: Approve prepared content
- **WHEN** a host explicitly approves an individually selected screenshot meeting all prerequisites with current revisions
- **THEN** it becomes approved, exposes the calculated tier and can enter that tier's eligible pool

#### Scenario: Refuse premature approval
- **WHEN** any asset, association, identifying field or classification prerequisite is absent
- **THEN** approval fails with explicit blocking reasons and leaves existing review and data unchanged

#### Scenario: Reject or reconsider
- **WHEN** the host individually chooses pending or rejected, or approves after meeting all prerequisites
- **THEN** the supported explicit transition persists without deleting provenance or files

### Requirement: SR-04 Material-change approval invalidation
An approved screenshot SHALL become pending when its actual visual difficulty or association changes, including clearing either. Changes to parent participant description, promotion, event, match date, stipulation or championship information SHALL reset associated approved screenshots and advance their revisions atomically with the match write. Screenshot notes, match notes and obscurity-only changes SHALL preserve screenshot reviews/revisions. Obscurity still changes derived classification under SR-02. Normalized no-ops SHALL preserve revisions/reviews; nonapproved screenshots SHALL never acquire approval through editing.

#### Scenario: Visual difficulty changes
- **WHEN** an approved screenshot's saved visual difficulty changes
- **THEN** the input, pending review and screenshot revision commit together
- **AND** its calculated tier updates even if the changed input maps to the same tier as before

#### Scenario: Answer identity changes
- **WHEN** any named identifying/answer metadata field changes
- **THEN** match updates and resets of all and only associated approved screenshots commit atomically

#### Scenario: Editorial or parent classification changes
- **WHEN** only notes or match obscurity change, or a normalized no-op is submitted
- **THEN** the review preservation rules hold
- **AND** an obscurity change still affects the calculated tier without a screenshot-row rewrite

### Requirement: SR-05 Derived gameplay eligibility and explanations
A screenshot SHALL be eligible only if its committed image is currently available/valid, it belongs to an existing match with nonempty participant description/promotion/event, both valid classification inputs are present and review is approved. The calculated tier SHALL determine which eligible pool it belongs to. Date SHALL remain optional. Eligibility/tier SHALL NOT be independently editable or persisted as redundant authoritative values. Responses SHALL report all applicable deterministic blockers, distinguishing classification completion from review, metadata and asset readiness. Storage uncertainty SHALL fail explicitly rather than claim availability or publish misleading eligible totals.

#### Scenario: Fully classified but not approved
- **WHEN** both inputs are set but review is pending or rejected
- **THEN** the screenshot has a calculated tier and counts as fully classified
- **AND** it is excluded from eligible tier counts/pools with its review blocker

#### Scenario: All prerequisites met
- **WHEN** all prerequisites hold with date unset
- **THEN** eligibility is true with no blockers and the screenshot belongs only to its calculated tier

#### Scenario: Missing classifications or other prerequisites
- **WHEN** association, obscurity, visual difficulty or another prerequisite is absent
- **THEN** eligibility is false with applicable reasons
- **AND** no default classification or automatic approval is assumed

### Requirement: SR-06 Asset availability after approval
Asset availability/integrity SHALL be checked against the committed content hash when producing relevant eligibility/image responses, not trusted forever from import time. Missing, corrupt or substituted bytes SHALL remove an image from eligible pools without rewriting review history. Restoring its unchanged valid bytes SHALL clear asset blockers on the next assessment. Staging SHALL never participate in library statistics or selection pools.

#### Scenario: Approved asset changes
- **WHEN** an approved screenshot disappears, is corrupt or differs from its committed hash
- **THEN** it remains recorded as approved but is ineligible and is not served as a valid image

#### Scenario: Original bytes are restored
- **WHEN** unchanged valid bytes are restored and other prerequisites hold
- **THEN** eligibility returns without an automatic review transition

### Requirement: SR-07 Exact calculated game tiers and points
The system SHALL use one shared pure classification rule over match obscurity and screenshot visual difficulty. It SHALL apply this exact matrix and return Squash Match (`squash`)/1 point, Competitive Match (`competitive`)/2 points or Deathmatch (`deathmatch`)/3 points:

| Match obscurity | Easy | Medium | Hard |
|---|---|---|---|
| Low | Squash Match | Squash Match | Competitive Match |
| Medium | Competitive Match | Competitive Match | Competitive Match |
| High | Competitive Match | Deathmatch | Deathmatch |

Tier and points SHALL be read-only derived information. Missing either input SHALL return an unclassified result with no tier/points. Unsupported inputs SHALL be rejected rather than guessed. UI, API and future modes SHALL share this rule without reimplementing the matrix. The 2/9, 5/9 and 2/9 theoretical combination frequencies SHALL NOT be treated as actual library counts, quotas or selection weights.

#### Scenario: All nine combinations
- **WHEN** each valid pair is classified
- **THEN** the exact table's tier and corresponding 1/2/3 points are returned

#### Scenario: Missing or invalid input
- **WHEN** either valid input is unset, or a nonnull input is unsupported
- **THEN** missing input produces unclassified/null tier/null points and unsupported input produces a validation error

#### Scenario: Manual tier writes
- **WHEN** a caller attempts to set a derived tier or point value through an editable request
- **THEN** the mutation is rejected without changes

### Requirement: SR-08 Read-only classification presentation
The match screenshot collection and selected screenshot inspector SHALL show saved visual difficulty, calculated tier/points and classification/eligibility blockers distinctly. Saving either classification input SHALL refresh affected derived displays/counts while preserving independent drafts and explicit review transitions. Pending unsaved values SHALL NOT be represented as the saved eligible pool.

#### Scenario: Saved edits refresh derived values
- **WHEN** a match obscurity or individual difficulty save succeeds
- **THEN** affected saved classifications and counts refresh using server-authoritative records
- **AND** unrelated drafts remain available and the host cannot manually select a game tier
