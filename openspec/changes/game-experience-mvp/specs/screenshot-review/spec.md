## MODIFIED Requirements

### Requirement: SR-02 Match obscurity classification
Match obscurity SHALL be unset (`null`) or Low (`low`), Medium (`medium`) or High (`high`). Low describes a widely recognizable or historically prominent match; Medium describes a match knowledgeable fans may recognize but that is not universally familiar; High describes an obscure match requiring deeper wrestling knowledge. This input SHALL belong to the match and remain separate from screenshot visual clues. A saved obscurity change SHALL recalculate associated screenshots' game tiers, points, eligibility reasons and tier pools on subsequent reads without manually updating their difficulty, association, review or revisions.

#### Scenario: Change the parent classification
- **WHEN** a host changes a match from Low to High while an associated approved screenshot has Medium visual difficulty
- **THEN** its derived tier changes from Easy/1 point to Hard/3 points
- **AND** the screenshot's visual difficulty, review, provenance and revision remain unchanged

#### Scenario: Unset parent classification
- **WHEN** match obscurity is cleared
- **THEN** associated screenshots become unclassified and ineligible without losing their saved visual difficulty or review


### Requirement: SR-07 Exact calculated game tiers and points
The system SHALL use one shared pure classification rule over match obscurity and screenshot visual difficulty. It SHALL apply this exact matrix and return Easy (`squash`)/1 point, Medium (`competitive`)/2 points or Hard (`deathmatch`)/3 points:

| Match obscurity | Easy | Medium | Hard |
|---|---|---|---|
| Low | Easy | Easy | Medium |
| Medium | Medium | Medium | Medium |
| High | Medium | Hard | Hard |

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

