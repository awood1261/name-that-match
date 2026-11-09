## Why

Status 2026-11-08: the user approved this revised proposal, design, and legacy mapping for tasks 4.8–4.25. Delivery evidence is in [classification continuation verification](verification-classification-continuation.md); group 7 remains separately opt-in.

The delivered local library already imports captures, manages matches and preserves explicit screenshot associations. The host now needs independent visual difficulty and match obscurity inputs, automatic game tiers, individual review and trustworthy classification progress without rebuilding those working workflows.

This proposal revises only the remaining plan on 2026-11-08. Implementation through the original Match Management milestone (tasks 1.1–4.7, commit `837c01f`) remains the baseline. The request titled “Milestone 4: Media Library & Difficulty Classification” is a proposed continuation of that milestone, not a claim that the extension is implemented or approved to implement.

## What Changes

- Preserve capture import/recovery, match cards, match editing, incomplete drafts, independent saves, explicit single/multi-assignment, revision conflicts and offline local storage.
- **BREAKING:** Replace match obscurity inputs with nullable `low|medium|high` and screenshot visual difficulty inputs with nullable `easy|medium|hard`. A proposed schema-2 migration explicitly maps legacy values; it does not rewrite migration 1 or silently accept legacy values in new mutation requests.
- Derive read-only `squash|competitive|deathmatch` game tiers and 1/2/3 points from the exact approved nine-cell matrix. Missing inputs remain unclassified. One shared pure classifier owns these rules; no tier/points column, manually editable tier, quotas or weights.
- Complete individual screenshot difficulty/notes/review controls within the existing inspector experience. Match obscurity updates automatically change derived tiers without editing associated screenshots.
- Retain explicit approval, complete participant/promotion/event metadata and current valid-image checks as additional eligibility gates, confirmed by the user on 2026-11-08. Classification completion and gameplay eligibility are separate states.
- Apply active screenshot difficulty/review/tier filters inside opened match collections, with visible/full counts, matching-only navigation and selection, as requested during manual review.
- Add global totals/classification progress/eligible-tier counts, compact per-match counts, literal match search, obscurity and incomplete-classification filters. Keep existing card layout and avoid a dashboard redesign or a larger CMS.
- Add independently testable eligible-pool filtering and pure random-index selection support for later gameplay. No gameplay endpoint/UI, game/session state, timer, score ledger or Studio/Road networking is introduced.
- Document future host-judged correctness and discretionary follow-ups/bonuses without implementing grading or bonus scoring.

## Capabilities

### New Capabilities

These capabilities are still additions of this active, unarchived change; they are not yet main specs:

- `capture-import`: Preserve the existing versioned import, provenance, staging/recovery, duplicate and original-preservation contract; no producer or capture-format changes.
- `match-library`: Preserve delivered management and add classification-aware persistence migration, minimal search/filter/counts, statistics and selection preparation.
- `screenshot-review`: Revised input classifications, the exact derived-tier matrix, independent editorial review, eligibility and asset health.

### Modified Capabilities

- `application-foundation`: Existing deltas continue permitting separately approved library integration/migrations while preserving startup/health/storage/backup/offline/styling guarantees. No new foundation behavior is added by this revision.

## Impact

Extend the existing React/local-state/CSS Modules client, native Node HTTP, SQLite repository and shared TypeScript contracts. No dependency, framework, cloud service, utility CSS or image transformation is planned. Schema 2 requires a stopped-writer backup and transactional migration; capture IDs, match IDs, associations, provenance, images and import receipts survive.

The legacy enum mapping and changed derived tiers are reviewable migration decisions (D10). Existing verification records and completed task descriptions remain historical evidence. Pending review and minimal browsing work are consolidated into the proposed task-4 continuation; remaining opt-in collection acceptance stays separate. Current code, AGENTS.md product rules and current operational documentation are changed only after implementation approval. No archive is authorized by planning approval.

Out of scope: full gameplay or random-selection UI/API, scoring execution, automatic answer validation, bonus scoring, sessions/repeat-match rules, WebSockets/synchronization, roster/promotion management, deletion/trash, bulk rating/review, automated backups, generic jobs, perceptual hashing, pagination/virtualization/full-text frameworks and arbitrary server-path import.
