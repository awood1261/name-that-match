# match-library Specification

## Purpose

Maintain independent wrestling match and screenshot records in a portable offline library, with safe persistence, explicit editing and assignment, consistent browsing, and accessible administration.

## Requirements

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
The system SHALL persist matches, committed screenshots, import batches, and import items locally with foreign keys, identity/path uniqueness, validated dimensions/size/playback, revisions, and classification constraints for nullable Low/Medium/High match obscurity and Easy/Medium/Hard visual difficulty. Image hashes SHALL be indexed without global uniqueness. Match deletion while referenced SHALL be restricted even though deletion UI is out of scope. Ordered transactional migrations SHALL preserve the configured data root, WAL and foreign-key settings, and existing data; failed migrations and unsupported newer schemas SHALL fail clearly without database recreation.

#### Scenario: Initialize and reopen library storage
- **WHEN** an existing foundation store is initialized for the library and later reopened
- **THEN** the approved schema is applied once, existing data survives, and repeated initialization does not duplicate or erase records

#### Scenario: Migration failure or newer schema
- **WHEN** a migration fails or a database advertises a newer unsupported schema
- **THEN** startup fails clearly, incomplete migration changes are rolled back, connections are released, and original data is not replaced

#### Scenario: Invalid persistence relationships
- **WHEN** an operation would violate capture identity/path uniqueness, enum/value constraints, a match foreign key, or referenced-match deletion restrictions
- **THEN** persistence rejects the operation without partially committing it

#### Scenario: Upgrade legacy classification values safely
- **WHEN** a version-1 library is upgraded to the revised classification model
- **THEN** the explicit reviewed legacy-to-new mapping is applied once with IDs, relationships, provenance, reviews and import receipts preserved
- **AND** no tier is persisted, no source/image files are modified, and a failed migration rolls back without replacing the database

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
The Matches view SHALL support case-insensitive literal substring search across participant description, promotion, and event, Low/Medium/High/unset obscurity filters, screenshot visual difficulty/review/calculated-tier filters, incomplete-identification filtering and incomplete-classification filtering. Filter groups SHALL combine with AND and selected values within a group with OR. Screenshot difficulty, review and tier predicates SHALL be satisfied by the same screenshot. Incomplete classification SHALL mean unset match obscurity, zero associated screenshots, or at least one associated screenshot with unset visual difficulty; it SHALL remain distinct from incomplete identifying metadata. Unset classifications SHALL be selectable. Unassigned browsing SHALL support source grouping, difficulty and review filters; match-only search/filters SHALL not incorrectly classify unassigned screenshots.

#### Scenario: Same screenshot satisfies combined filters
- **WHEN** a match contains one approved Easy screenshot and one pending Hard screenshot and the filters request approved plus Hard
- **THEN** the match does not match unless a single associated screenshot satisfies both requested groups

#### Scenario: Combined search, unset fields, and no results
- **WHEN** text and multiple filter groups are applied
- **THEN** results follow the declared literal AND/OR semantics, preserve unknown values explicitly, and display a clear no-results state with a reset action

#### Scenario: Result cards open their matching screenshot subset
- **WHEN** an operator opens a match returned by visual difficulty, review or calculated-tier filters
- **THEN** its collection, thumbnails, sequential navigation and Select all include only screenshots satisfying every active screenshot filter group on the same row
- **AND** the collection labels the visible count against the full associated screenshot count while card totals and global statistics remain unfiltered
- **AND** no screenshot filters means all associated screenshots, and edits that remove the final matching image show an explicit empty-filter result without silently clearing filters

### Requirement: ML-07 Authoritative counts and deterministic browsing
The system SHALL provide Matches and Unassigned Screenshots views with deterministic ordering. Match cards SHALL show participant description, promotion, event, known date, obscurity, total screenshot count, approved count, eligible count, awaiting-classification count and separate identification/classification incomplete indicators. Counts SHALL derive from authoritative records; approved and eligible SHALL remain distinct. Card total/approved/eligible/awaiting counts SHALL describe all committed screenshots of that match even when filters determine which cards appear. When screenshot filters are active, each card SHALL additionally lead with the number satisfying all active screenshot predicates, labeled as matching out of the full total. Other counters SHALL be explicitly labeled full-match totals; with no screenshot filters the matching count equals the full count. Existing compact cards and explicit card-to-match navigation SHALL be preserved; minimal search, filter and count additions SHALL NOT require a new dashboard layout or CMS features.

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

#### Scenario: Filter changes cannot retain an unrelated editing context
- **WHEN** the operator changes search or filters while a different match collection or editor is open
- **THEN** Save/Discard/Stay protects dirty match, screenshot and assignment drafts before the change takes effect
- **AND** applying the change returns to match results without the old editor or screenshot selection
- **AND** opening a result shows a named collection restricted to its matching screenshots, with a separate explicit action to edit that match's metadata

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


### Requirement: ML-13 Database-derived classification statistics
The library SHALL show global total matches, total committed screenshots, fully classified screenshots, screenshots awaiting classification and eligible counts for Squash Match, Competitive Match and Deathmatch. Fully classified SHALL require an existing association and both valid classification inputs, independently of review, metadata completeness and asset readiness. Awaiting classification SHALL equal total committed screenshots minus fully classified. Eligible counts SHALL additionally apply SR-05/SR-06. Counts SHALL be derived from one coherent observation of current records/assets, include retained rejected screenshots in appropriate totals, exclude staging, and remain global when dashboard filters change. No theoretical nine-cell percentage SHALL be substituted for actual data.

#### Scenario: Classification and eligibility differ
- **WHEN** some fully classified screenshots are pending, rejected, missing images or associated with incomplete identifying metadata
- **THEN** they contribute to fully classified totals and calculated-tier distribution but not eligible tier totals

#### Scenario: Parent or screenshot classification changes
- **WHEN** either classification input is saved or cleared
- **THEN** statistics and corresponding eligible pools reflect the revised derived tiers on refresh without manual per-screenshot tier updates

#### Scenario: Empty library or uncertain storage
- **WHEN** the library is empty or current asset readiness cannot be established due to storage errors
- **THEN** an empty library returns zero counts without divide-by-zero percentages, and uncertain storage returns an explicit failure instead of fabricated eligible totals

### Requirement: ML-14 Eligible tier pools and testable random selection support
Preparation logic SHALL filter a fresh server-assessed screenshot observation into a pool containing only eligible screenshots of the requested calculated tier. Pool filtering and random-index selection SHALL be independently testable and SHALL NOT weight matches, enforce a theoretical distribution, fetch remote metadata or manage session history. Selecting from an empty pool SHALL return an explicit no-candidate result. Supplied randomness SHALL be validated and SHALL select only a member of the supplied eligible pool. No live selection endpoint or gameplay interface SHALL be added by this library scope.

#### Scenario: Select only the requested eligible tier
- **WHEN** a mixed library observation is filtered for one tier and selection is evaluated across valid random samples
- **THEN** every possible returned screenshot is eligible and belongs to that tier
- **AND** unclassified, rejected, pending, incomplete-match and invalid-image screenshots are excluded

#### Scenario: Empty or invalid pool request
- **WHEN** the requested tier has no eligible screenshots or the tier/randomness input is invalid
- **THEN** an empty eligible pool produces a no-candidate result and invalid input is rejected without falling back to another tier

#### Scenario: Classification edit changes the next observation
- **WHEN** a parent obscurity or screenshot difficulty changes
- **THEN** filtering a refreshed observation uses the new calculated tier and no persisted or stale tier quota controls membership

### Requirement: ML-15 Host-controlled future scoring boundary
Library preparation SHALL expose the calculated tier and its base 1/2/3 points without judging answers. Future correctness SHALL belong to the host's interpretation of verbal wrestler/match identification; event/year SHALL NOT be automatic basic-correctness requirements. Optional verbal follow-ups and any discretionary bonus SHALL NOT alter classification inputs, the matrix or base-tier point mapping. Automatic answer validation and bonus-scoring execution SHALL remain outside this change.

#### Scenario: Prepare a classified screenshot
- **WHEN** a screenshot's tier and points are projected or it is chosen from a prepared pool
- **THEN** no correctness decision or bonus is calculated from its participants, event, year, title or an answer string
