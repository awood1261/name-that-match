## Purpose

Maintain independent wrestling match and screenshot records in a portable offline library, with safe persistence, explicit editing and assignment, consistent browsing, and accessible administration.

## ADDED Requirements

### Requirement: ML-01 Independent match and screenshot identities
The system SHALL give matches and screenshots stable generated identities independent of capture IDs and source video IDs. A screenshot SHALL belong to zero or one match; a match SHALL support multiple screenshots, including different source videos and difficulties. A source video SHALL support screenshots assigned to different matches. Draft matches and unassigned screenshots SHALL be retained without inferred associations.

#### Scenario: Source video and match identities differ
- **WHEN** screenshots from one video are assigned to different matches or screenshots from different videos are assigned to one match
- **THEN** both relationships persist without unique-video or one-video-one-match restrictions

### Requirement: ML-02 Flexible match metadata and incomplete drafts
The system SHALL allow explicit creation and editing of participant description, promotion, event, optional partial date, obscurity, stipulation, championship information, and editorial notes. Participant description SHALL support singles, teams, and multi-person matches without roster management. Only nonempty participant description, promotion, and event SHALL determine identifying completeness. Unknown fields SHALL remain unset; valid dates SHALL support year, year-month, or full-date precision without invented components.

#### Scenario: Create or edit an incomplete match
- **WHEN** an operator saves a draft with missing identifying fields, an unset date/obscurity, or a valid partial date
- **THEN** it persists and displays explicit incomplete indicators without fabricating values
- **AND** it cannot make a screenshot eligible until all required identifying fields are present

#### Scenario: Invalid match data
- **WHEN** a match update contains an invalid date, unsupported enum, oversized field, or invalid revision
- **THEN** it fails with field feedback and leaves the previous match and screenshot reviews unchanged

### Requirement: ML-03 Durable constrained persistence and migrations
The system SHALL persist matches, committed screenshots, import batches, and import items locally with foreign keys, identity/path uniqueness, validated dimensions/size/playback, revisions, and classification constraints. Image hashes SHALL be indexed without global uniqueness. Match deletion while referenced SHALL be restricted even though deletion UI is out of scope. Ordered transactional migrations SHALL preserve the configured data root, WAL and foreign-key settings, and existing data; failed migrations and unsupported newer schemas SHALL fail clearly without database recreation.

#### Scenario: Initialize and reopen library storage
- **WHEN** an existing foundation store is initialized for the library and later reopened
- **THEN** the approved schema is applied once, existing data survives, and repeated initialization does not duplicate or erase records

#### Scenario: Migration failure or newer schema
- **WHEN** a migration fails or a database advertises a newer unsupported schema
- **THEN** startup fails clearly, incomplete migration changes are rolled back, connections are released, and original data is not replaced

#### Scenario: Invalid persistence relationships
- **WHEN** an operation would violate capture identity/path uniqueness, enum/value constraints, a match foreign key, or referenced-match deletion restrictions
- **THEN** persistence rejects the operation without partially committing it

### Requirement: ML-04 Explicit single and multiple assignment
The system SHALL support assigning, unassigning, and reassigning screenshots explicitly, and assigning multiple selected screenshots to one existing match. Multi-assignment SHALL validate the target and every selected revision before any write and commit all changes or none. Assignment SHALL preserve immutable capture provenance and apply screenshot-review invalidation rules.

#### Scenario: Assign or reassign screenshots
- **WHEN** an operator selects an existing target match and saves one or multiple screenshot assignments with current revisions
- **THEN** each selected screenshot belongs to that match, prior associations are replaced, and required approval invalidation is committed atomically

#### Scenario: Invalid multi-assignment member
- **WHEN** any selected screenshot is missing, stale, or invalid, or the target match changed
- **THEN** the complete assignment fails and none of the selected screenshots are changed

### Requirement: ML-05 Revision-based editing and atomic invalidation
Every editable match and screenshot SHALL have a positive revision. Updates SHALL require expected revisions, reject stale updates without overwrite, and increment changed records. Match edits and associated review invalidations SHALL commit together, including revisions for affected screenshots. Unchanged normalized values SHALL not invalidate approvals or increment record revisions. Approval SHALL also require the current parent-match revision.

#### Scenario: Competing editors
- **WHEN** one tab/device saves after another editor has changed the same record or approval's parent match
- **THEN** the stale request returns a conflict with current revisions and does not overwrite data
- **AND** the UI preserves its draft and permits deliberate reload and retry

#### Scenario: Material match edit and screenshot edit race
- **WHEN** answer-identifying match data changes while another editor holds an approved screenshot draft
- **THEN** match changes, review resets, and screenshot revision increments are atomic and the stale screenshot save conflicts

### Requirement: ML-06 Search and filter semantics
The Matches view SHALL support case-insensitive literal substring search across participant description, promotion, and event, obscurity filters, screenshot difficulty/review filters, and incomplete-match filtering. Filter groups SHALL combine with AND and selected values within a group with OR. Difficulty and review predicates SHALL be satisfied by the same screenshot. Unset classifications SHALL be selectable. Unassigned browsing SHALL support source grouping, difficulty and review filters; match-only search/filters SHALL not incorrectly classify unassigned screenshots.

#### Scenario: Same screenshot satisfies combined filters
- **WHEN** a match contains one approved squash screenshot and one pending deathmatch screenshot and the filters request approved plus deathmatch
- **THEN** the match does not match unless a single associated screenshot satisfies both requested groups

#### Scenario: Combined search, unset fields, and no results
- **WHEN** text and multiple filter groups are applied
- **THEN** results follow the declared literal AND/OR semantics, preserve unknown values explicitly, and display a clear no-results state with a reset action

### Requirement: ML-07 Authoritative counts and deterministic browsing
The system SHALL provide Matches and Unassigned Screenshots views with deterministic ordering. Match cards SHALL show participant description, promotion, event, known date, obscurity, total screenshot count, approved count, eligible count, and incomplete indicators. Counts SHALL derive from authoritative records; approved and eligible SHALL remain distinct. Card counts SHALL describe all committed screenshots of that match even when filters determine which cards appear.

#### Scenario: Counts differ from eligibility
- **WHEN** a match has approved screenshots whose images are missing or corrupt
- **THEN** approved counts retain the recorded review totals, eligible counts exclude unavailable/invalid assets, and the UI explains the difference

#### Scenario: Stable order and unassigned grouping
- **WHEN** a result list is refreshed without record changes
- **THEN** match order, screenshot order, and optional source-video grouping remain deterministic and grouping creates no match association

### Requirement: ML-08 Validated HTTP and trusted-LAN boundary
Library and import endpoints SHALL use runtime-validated bounded requests, structured JSON errors, revision conflicts, and sanitized storage diagnostics. Invalid API paths/methods and managed-image failures SHALL resolve before SPA fallback rather than return HTML success. Mutation requests SHALL be protected against foreign browser origins without adding authentication; operation remains limited to a trusted local machine/network.

#### Scenario: Invalid request or unavailable storage
- **WHEN** a request is malformed, unsupported, oversized, stale, references a missing record, or encounters unavailable storage
- **THEN** the documented HTTP status and structured error are returned without exposing SQL or absolute filesystem paths
- **AND** failed writes leave records and reviews unchanged

#### Scenario: Cross-origin browser mutation
- **WHEN** a foreign-origin browser submits a library mutation or upload
- **THEN** it is rejected before side effects and receives no permissive mutation CORS policy

#### Scenario: API route precedes static fallback
- **WHEN** a missing library API or image route is requested in production
- **THEN** it returns its API/image error instead of the application's HTML document

### Requirement: ML-09 Safe committed-image serving
The system SHALL serve images by committed screenshot identity only, resolve generated managed relative references under the configured data root, reject traversal/symlinks escaping owned storage, and preserve image aspect ratio. Staging files and arbitrary filesystem paths SHALL not be publicly served. Missing and corrupt committed assets SHALL return explicit errors and ineligibility reasons without altering recorded review state.

#### Scenario: Valid or unavailable committed image
- **WHEN** a committed screenshot image is requested
- **THEN** valid PNG bytes are served with the correct media type, or a missing/corrupt asset returns a documented error
- **AND** staged files cannot be obtained through that route

#### Scenario: Path traversal attempt
- **WHEN** an image request or persisted path attempts to escape managed storage
- **THEN** no external file bytes are served and the request fails safely

### Requirement: ML-10 Inspector editing and unsaved-change protection
The administrative interface SHALL support match creation/editing and screenshot editing in one inspector-based experience, with independently saveable drafts, explicit Save/Cancel or Discard controls, field validation, provenance, thumbnail navigation, assignment, review actions, and return to the unassigned queue. Selection/view changes that would discard drafts SHALL offer Save, Discard, or Stay. Failed and stale saves SHALL preserve drafts; stale retry SHALL require deliberate reconciliation, not automatic overwrite.

#### Scenario: Match and screenshot drafts are independent
- **WHEN** an operator saves or cancels one editor while another draft is dirty
- **THEN** only the intended draft changes and the other draft remains available

#### Scenario: Navigate with unsaved edits
- **WHEN** changing match, screenshot, primary view, or closing the inspector would discard unsaved work
- **THEN** the operator can save, discard, or remain, and failures keep the draft visible

#### Scenario: Individual and multi-assignment controls
- **WHEN** an operator creates a match, changes assignments, or navigates screenshots
- **THEN** selection, target match, pending changes, validation, and resulting review state are clear without introducing disconnected editors or bulk review controls

### Requirement: ML-11 Responsive accessible administrative presentation
The interface SHALL use the existing dark/yellow/purple visual direction, CSS Modules, standard CSS, semantic names, and existing tokens without Tailwind or unrelated global styling changes. Desktop browsing/navigation and inspector SHALL adapt to a dedicated tablet inspector view/panel. Keyboard navigation, accessible names, visible focus, validation/status announcements, usable touch targets, reduced-motion support, and image containment SHALL be provided. Empty, loading, no-results, success, and error states SHALL be explicit and not rely on color alone.

#### Scenario: Keyboard and tablet operation
- **WHEN** the operator imports, selects, edits, assigns, and reviews using a keyboard or tablet
- **THEN** all controls are named and reachable, focus is retained/restored appropriately, targets remain usable, and the inspector does not compress three desktop columns into the tablet viewport

#### Scenario: Loading, validation, and motion preferences
- **WHEN** data is loading, operations fail, validation changes, or reduced motion is requested
- **THEN** status is communicated accessibly, drafts remain usable, nonessential animation is suppressed, and screenshot geometry remains intact

### Requirement: ML-12 Offline operation and bounded feature scope
The complete administrative workflow SHALL operate using the local server, SQLite, and managed files without internet APIs, fonts, CDNs, or remote metadata. It SHALL preserve existing health/startup/storage guarantees and stop at library preparation rather than implement gameplay, synchronization, or deferred management features.

#### Scenario: Local offline administration
- **WHEN** external internet access is unavailable but the browser can reach the local server
- **THEN** importing browser-local captures, editing, assignment, review, browsing, and image display still work without contacting YouTube or other external services

#### Scenario: Milestone review boundary
- **WHEN** an implementation milestone is verified
- **THEN** evidence and completion criteria are reported and work stops for review before beginning the next milestone or archiving
