## Why

Large match cards make it harder to find and process imported captures as the library grows. A match-grouped review workspace keeps identification, classification, and review in context while making outstanding work easy to find.

## What Changes

- Open Image Library in Review Queue, with Unassigned Intake pinned above matches that need review and completed groups available on demand. Use `design-comps/image-library-ui-update.png` as the primary visual reference for the desktop queue and review workspace.
- Show match information and obscurity once per group. Keep a large screenshot preview, thumbnail navigation, and separate difficulty and review controls. Advance after confirmed approval or rejection when the current group has another screenshot awaiting review.
- Preserve approval when saving or clearing visual difficulty. An approved unrated screenshot is ineligible. Keep the existing approval gate, association and answer-edit invalidation, and derived tier matrix.
- Replace match cards with a compact searchable, sortable table. Put detailed whole-library statistics in Overview.
- Preserve local capture import and assignment, installed offline operation, and existing match, screenshot, import, approval, and game records. Bulk classification and bulk approval remain deferred.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `match-library` gains the default review workspace, a sortable Matches table, and Overview.
- `screenshot-review` gains approval-preserving difficulty edits and same-group advancement after a review decision.

## Impact

Changes affect the React and TypeScript library UI and CSS Modules, library HTTP reads and writes, SQLite migration, tests, and library operation docs. The schema change allows an approved screenshot to have an unset difficulty while retaining the association constraint. The migration preserves committed image references and bytes, the existing history, and review states.
