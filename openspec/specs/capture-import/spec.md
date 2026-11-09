# capture-import Specification

## Purpose

Import versioned Chrome extension capture pairs into portable local storage with explicit validation, duplicate decisions, original preservation, and recoverable per-item confirmation.

## Requirements

### Requirement: CI-01 Browser-selected capture sources
The system SHALL accept a parent capture directory, one source-video directory, or multiple PNG/JSON files selected on the browser device, using directory input with a multiple-file fallback. It SHALL explain device locality, require no File System Access API, and accept no arbitrary server-side absolute-path import.

#### Scenario: Directory and file selection
- **WHEN** an operator selects any supported source, including a directory containing multiple video folders
- **THEN** the selected files are discovered using relative selection context and uploaded to application-owned staging
- **AND** the UI explains that selection reads the browser device, which can differ from the server laptop

#### Scenario: Directory picker unavailable
- **WHEN** directory input is unavailable on the browser
- **THEN** multiple-file selection remains usable without requiring `showDirectoryPicker()`

### Requirement: CI-02 Capture v1 validation and provenance
The server SHALL validate version 1 capture metadata against the documented contract before import, require all fields except source title, retain the original JSON text and safe unknown fields unchanged, and preserve source video identity, URL, playback position, capture time, method, and image declarations as provenance. Unsupported versions SHALL be reported, never guessed or silently converted. Metadata SHALL NOT create match records or populate match answers automatically.

#### Scenario: Valid capture with optional or additional metadata
- **WHEN** a complete v1 pair has valid fields, including a missing optional title or additional JSON fields
- **THEN** it validates and original metadata is preserved without executing or interpreting unknown fields
- **AND** no match is inferred from video ID, source title, or capture time

#### Scenario: Invalid metadata
- **WHEN** a candidate has an unsupported version, missing required field, invalid capture timestamp, nonfinite or negative playback value, wrong platform/method, or inconsistent canonical URL and video ID
- **THEN** preview identifies the item and validation reason and confirmation cannot import it

### Requirement: CI-03 Exact safe pair discovery
The server SHALL require an unambiguous JSON and PNG pair with a shared capture-ID stem, exact declared PNG basename, and safe filenames and relative selection paths. It SHALL reject traversal, absolute paths, separators inside basenames, duplicate ambiguous paths, and collision-renamed pairs that no longer agree. Known harmless `.DS_Store` files SHALL be ignored and counted; other unsupported files SHALL be reported as ignored without being imported.

#### Scenario: Missing or ambiguous pair
- **WHEN** a PNG or JSON partner is absent or several files could satisfy the same declared pair
- **THEN** the candidate is blocked with a missing-pair or ambiguous-pair error instead of selecting an arbitrary file

#### Scenario: Unsafe path
- **WHEN** filenames, selection paths, or metadata attempt traversal or absolute-path addressing
- **THEN** the item is rejected without reading or writing outside owned storage

#### Scenario: Harmless extra file
- **WHEN** selected directories contain `.DS_Store` or unsupported file types
- **THEN** preview reports ignored counts and valid unrelated pairs remain importable

### Requirement: CI-04 Bounded PNG validation
The server SHALL validate actual PNG content, structure, integrity, supported encoding, and dimensions rather than trusting extensions, MIME, or client claims. File size, decoded pixel/decompression bounds, batch size, and request limits SHALL be configurable and documented, enforced during upload and validation. Invalid, truncated, oversized, or dimension-mismatched images SHALL be blocked without altering originals or exposing incomplete images.

#### Scenario: Invalid image data
- **WHEN** a PNG is corrupt, truncated, uses unsupported encoding, or disagrees with its declared dimensions
- **THEN** preview reports a specific validation failure and no screenshot is committed

#### Scenario: Excessive resource use
- **WHEN** request bytes, file size, pixel count, or decompression output exceeds configured bounds
- **THEN** processing stops within those bounds and reports the appropriate size/validation error without unbounded buffering

### Requirement: CI-05 Duplicate identity and content policy
The server SHALL use source platform plus capture ID as capture identity and a cryptographic image-content hash for exact duplicates, within a batch and against committed screenshots. Unchanged capture identity/content/provenance SHALL be already imported; identity with changed content or provenance SHALL conflict without overwrite. Different capture identities with identical PNG bytes SHALL warn and skip by default, with explicit retention as separate screenshots permitted. Image hashes SHALL NOT be globally unique. Visually similar but byte-different files SHALL NOT automatically be duplicates.

#### Scenario: Repeat or conflicting identity
- **WHEN** a candidate repeats an existing capture identity
- **THEN** identical content and provenance resolve to the existing screenshot without another screenshot row
- **AND** different content or provenance produces an item conflict without modifying that screenshot

#### Scenario: Identical content under different identities
- **WHEN** two capture identities have equal image hashes, including candidates in one batch
- **THEN** preview identifies the duplicate and defaults the later candidate to skip
- **AND** an explicit keep decision permits a separate screenshot and its original provenance

#### Scenario: Concurrent import changes duplicate classification
- **WHEN** committed data changes after preview but before confirmation
- **THEN** duplicate decisions are checked again and newly detected duplicates require a fresh explicit keep decision rather than silent retention

### Requirement: CI-06 Preview and explicit confirmation
The system SHALL distinguish selection, scanning/uploading, validating, preview-ready, confirming, completed, partial-success, failed, and interrupted/retryable states. Preview SHALL show valid items, duplicates, ignored files, errors, and default decisions. Only explicitly confirmed valid items SHALL become screenshots, initially unassigned, unrated, and pending. Staged files SHALL NOT appear in library browsing or committed-image serving.

#### Scenario: Confirm a mixed batch
- **WHEN** the operator confirms selected valid candidates in a preview with other invalid, duplicate, or deselected items
- **THEN** only confirmed valid items are committed, with individual outcomes and disjoint imported/duplicate/skipped/failed counts
- **AND** the UI provides navigation to the unassigned queue

#### Scenario: Preview without confirmation
- **WHEN** validation finishes but the operator does not confirm
- **THEN** no screenshot or match is created and uploaded files remain staging only

### Requirement: CI-07 Durable import and restart recovery
The system SHALL durably record per-item staging, validation, confirmation intent, finalization, and commit progress sufficient to reconcile process interruption. Filesystem operations SHALL NOT be assumed atomic with database transactions. After restart it SHALL recognize committed results, resume previously confirmed work safely, and request re-upload where bytes are incomplete, without exposing partial library records or repeating imports.

#### Scenario: Interrupted staging
- **WHEN** upload or staging validation is interrupted
- **THEN** recovery distinguishes incomplete bytes from valid staged data, reports retryability, and imports nothing without confirmation

#### Scenario: Interrupted finalization or commit
- **WHEN** interruption occurs before/after final file creation or before/after database commit
- **THEN** reconciliation checks owned files and persisted identity/hash/intent, completes or reports the item safely, and never creates duplicate screenshot rows
- **AND** uncommitted images remain unavailable through the library API

### Requirement: CI-08 Idempotent confirmation and retry
Confirmations SHALL have persisted request identity and immutable request content. Repeating the same confirmation SHALL return its existing progress/results; reusing its key with different decisions SHALL conflict. Retrying failed items SHALL preserve successful outcomes and stable intended screenshot identities. A lost response SHALL NOT cause an additional import.

#### Scenario: Lost response and retry
- **WHEN** an operator retries confirmation after losing the response or reconnects after restart
- **THEN** completed items retain their original result and remaining confirmed items can progress without new duplicates

#### Scenario: Changed confirmation under an existing key
- **WHEN** the same confirmation key is submitted with different decisions
- **THEN** the server returns a conflict and does not apply the changed request

### Requirement: CI-09 Original preservation and owned cleanup
The system SHALL copy selected content into application-managed storage using generated filenames and relative references. It SHALL never rename, move, alter, or delete external captures. Cleanup SHALL identify abandoned staging through persisted ownership and age/status, avoid active/committing work, retain committed assets and results, and never sweep unrelated or external paths.

#### Scenario: Import, failure, and cleanup preserve sources
- **WHEN** valid or invalid candidates are processed, retried, or cleaned up
- **THEN** original PNG/JSON bytes and names remain unchanged
- **AND** cleanup affects only identified application-owned uncommitted staging and cannot delete committed screenshots

#### Scenario: Abandoned preview expires
- **WHEN** an unconfirmed staging batch exceeds the documented retention period and has no active operation
- **THEN** its owned staged bytes can be removed, its status explains expiry, and import requires re-selection/re-upload rather than silently confirming expired bytes

### Requirement: CI-10 Durable import results and diagnostics
The system SHALL expose batch and per-item status, validation issues, duplicate references, retryability, and aggregate outcomes after refresh/restart. Expected item failures SHALL allow unrelated selected items to succeed; storage-wide failures SHALL stop processing predictably with sanitized errors and durable retry information.

#### Scenario: Partial success or unavailable storage
- **WHEN** some items fail validation/finalization or storage becomes unavailable
- **THEN** the UI retains completed outcomes, explains failed/retryable items and aggregate state, and does not claim the entire batch succeeded
