## ADDED Requirements

### Requirement: ML-16 Default match-grouped Review Queue
Opening Image Library SHALL show Review Queue with navigation to Matches and Overview. The queue SHALL pin Unassigned Intake first, followed by associated match groups with pending screenshot decisions. Pending groups SHALL default to newest match record first, with a stable tie-breaker. Groups without pending decisions SHALL remain accessible through Show Completed and Matches. Review completion, identifying completeness, classification, asset availability and gameplay eligibility SHALL be distinguishable. Rejection resolves a pending decision. An approved screenshot with a blocker SHALL retain its approval and expose its outstanding issue.

#### Scenario: Prioritized work and completed access
- **WHEN** the library contains unassigned captures, matches with pending screenshots and matches without pending decisions
- **THEN** the queue shows intake first and orders pending match groups deterministically
- **AND** the operator can show completed groups and revisit their screenshots, review states and issues

#### Scenario: Intake after import
- **WHEN** the operator follows the import result link to view unassigned screenshots
- **THEN** Review Queue opens Unassigned Intake, where unassigned committed captures can be inspected and explicitly assigned to an existing or newly created match
- **AND** source-video grouping remains optional and does not assign captures

#### Scenario: Review a selected match
- **WHEN** the operator selects a match group
- **THEN** the workspace shows the match identity, metadata, obscurity, screenshot counts and applicable eligibility issues once for the group
- **AND** match fields remain editable through the match editor, while the selected screenshot has its own preview, thumbnail and sequential navigation, difficulty, review state and eligibility

#### Scenario: Review summary and Overview
- **WHEN** a queue or table filter changes
- **THEN** the queue labels its associated groups and pending screenshots by their displayed scope and the gameplay-ready total identifies its whole-library scope
- **AND** Overview continues to show the whole-library statistics independently of view filters

## MODIFIED Requirements

### Requirement: ML-06 Search and filter semantics
The Matches view SHALL support case-insensitive literal substring search across participant description, promotion, and event, Low/Medium/High/unset obscurity filters, screenshot visual difficulty/review/calculated-tier filters, incomplete-identification filtering and incomplete-classification filtering. Filter groups SHALL combine with AND and selected values within a group with OR. Screenshot difficulty, review and tier predicates SHALL be satisfied by the same screenshot. Incomplete classification SHALL mean unset match obscurity, zero associated screenshots, or at least one associated screenshot with unset visual difficulty. It SHALL remain distinct from incomplete identifying metadata. Unset classifications SHALL be selectable. Unassigned browsing SHALL support source grouping, difficulty and review filters. Match-only search and filters SHALL apply only to associated matches.

#### Scenario: Same screenshot satisfies combined filters
- **WHEN** a match contains one approved Easy screenshot and one pending Hard screenshot and the filters request approved plus Hard
- **THEN** the match does not match unless a single associated screenshot satisfies both requested groups

#### Scenario: Combined search, unset fields, and no results
- **WHEN** text and multiple filter groups are applied
- **THEN** results follow the declared literal AND/OR semantics, preserve unknown values explicitly, and display a clear no-results state with a reset action

#### Scenario: Result cards open their matching screenshot subset
- **WHEN** an operator opens a match returned by visual difficulty, review or calculated-tier filters
- **THEN** its collection, thumbnails, sequential navigation and Select all include only screenshots satisfying every active screenshot filter group on the same row
- **AND** the collection labels the visible count against the full associated screenshot count while full-match totals and global statistics remain unfiltered
- **AND** no screenshot filters means all associated screenshots, and edits that remove the final matching image show an explicit empty-filter result without silently clearing filters

### Requirement: ML-07 Authoritative counts and deterministic browsing
The Matches view SHALL show a compact table with explicit access to match details and editing. Rows SHALL show participants, promotion, event, known date, obscurity, total screenshot count, approved count, eligible count, and awaiting-classification count. The table SHALL identify incomplete match details, incomplete classification, pending decisions and asset issues where applicable. Full-match totals SHALL describe all committed screenshots of that match even when filters determine which rows appear. With screenshot filters active, rows SHALL also show the matching count out of the full total. The table SHALL default to newest match record first and allow sorting by participants, promotion, date, screenshot count and eligible count with a stable tie-breaker. Matches, screenshots and unassigned source groups SHALL have deterministic ordering.

#### Scenario: Counts differ from eligibility
- **WHEN** a match has approved screenshots whose images are missing, corrupt or otherwise blocked from gameplay
- **THEN** its approved total reflects the recorded reviews, its eligible total excludes blocked screenshots, and the workspace explains applicable blockers

#### Scenario: Stable order and unassigned grouping
- **WHEN** a result list is refreshed without record changes
- **THEN** the selected match sort, screenshot order and optional source-video grouping remain deterministic
- **AND** grouping creates no match association

#### Scenario: Sort a filtered table
- **WHEN** the operator sorts by a supported column with filters active
- **THEN** the table reorders the matching matches, communicates the sort direction and leaves search, filters, and count meanings intact

### Requirement: ML-11 Responsive accessible administrative presentation
The interface SHALL use the existing dark, yellow and purple visual direction, CSS Modules, standard CSS, semantic names and existing tokens. Tailwind CSS and unrelated global styling changes are out of scope. The desktop Review Queue SHALL present the group list beside a workspace with match information, eligibility, screenshot navigation, a large contained preview and dedicated review controls. The workspace SHALL adapt to tablet landscape and portrait while preserving the same functionality without horizontal page scrolling. Keyboard navigation, accessible names, visible focus, validation and status announcements, usable touch targets, reduced-motion support and image containment SHALL be provided. Empty, loading, no-results, success and error states SHALL be explicit and SHALL use text labels alongside status colors.

#### Scenario: Keyboard and tablet operation
- **WHEN** the operator imports, selects, edits, assigns and reviews using a keyboard or tablet
- **THEN** all controls are named and reachable, focus is retained or restored appropriately, and targets remain usable
- **AND** the layout preserves a usable preview and review controls at both tablet orientations

#### Scenario: Loading, validation, and motion preferences
- **WHEN** data is loading, operations fail, validation changes or reduced motion is requested
- **THEN** status is communicated accessibly, drafts remain usable, nonessential animation is suppressed and screenshot geometry remains intact
