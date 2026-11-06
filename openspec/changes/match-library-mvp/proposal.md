## Why

Name That Match needs an offline administrative library to turn Chrome extension captures into identified, individually reviewed screenshots suitable for future gameplay. The completed foundation and hardening work provide reliable local HTTP, SQLite, filesystem storage, styling, and isolated verification, but no import or library workflows.

## What Changes

- Import browser-selected version 1 PNG/JSON pairs through staged uploads, server validation, duplicate preview, explicit confirmation, durable per-item recovery, and repeat-safe results without altering originals.
- Create and edit incomplete or identified wrestling matches; assign, reassign, and multi-assign screenshots without deriving match identity from source videos.
- Maintain screenshot-level difficulty and pending/approved/rejected review independently of match-level iconic/familiar/obscure classification. Invalidate approval on material edits and derive eligibility with explicit reasons.
- Add Matches and Unassigned Screenshots views, a shared inspector, explicit saves, stale-edit protection, search/filter semantics, authoritative counts, and accessible desktop/tablet layouts following the library comp.
- Introduce four SQLite tables with ordered transactional migrations and revisions, narrow HTTP contracts, and safe serving of committed managed images.
- Update the foundation capability's foundation-only scope wording so separately specified library behavior and migrations are permitted; preserve its health, startup, storage, backup, offline, and styling guarantees.

Out of scope: gameplay screens/selection/scoring/timers/sessions; WebSockets and Studio/Road synchronization; automated match identification; YouTube APIs or online lookups; cloud storage; image enhancement or generated thumbnails; roster/promotion management; bulk rating/approval/rejection/deletion; screenshot trash/deletion; automated backups; advanced search/virtualization/pagination frameworks; generic job queues; other capture platforms; arbitrary server-path import. No new framework or dependencies are planned; Tailwind is prohibited.

## Capabilities

### New Capabilities

- `capture-import`: Versioned capture ingestion, validation, duplicates, original preservation, staging, confirmation, recovery, and import results.
- `match-library`: Match identity/metadata, persistence/migrations, assignments, revisions, browsing/filtering/counts, HTTP boundaries, and administrative presentation.
- `screenshot-review`: Screenshot difficulty, match obscurity, individual review transitions, approval invalidation, and derived eligibility.

### Modified Capabilities

- `application-foundation`: Permit approved feature integration and migrations without preserving obsolete foundation-phase prohibitions on library behavior or tables.

## Impact

Implementation will extend existing `client/`, `server/`, `shared/`, `tests/`, and current operational documentation using native Node HTTP, React, strict TypeScript, SQLite, CSS Modules, and existing tokens. The configured data root gains managed staging and library metadata; existing captures and archived changes remain untouched. Seven independently verified milestones each end at a review checkpoint. This request creates planning artifacts only; implementation requires separate approval, starting with Milestone 1.
