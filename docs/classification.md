# Classification and individual review

Use **Search and filters** in the sortable **Matches** table to find participant descriptions, promotions or events literally (case insensitive, Unicode NFC; `%` and `_` are ordinary characters). Filter groups combine with AND; selected values in a group combine with OR. Screenshot difficulty/review/tier conditions must all match one screenshot. Match identification and classification incompleteness have separate filters. Changing search/filters returns to results and clears the previous collection/editor/selection only after Save/Discard/Stay protection. **Back to match results** retains the current filters. Collection headings explicitly identify the selected match and explain that only matching screenshots are shown, with visible and full-match counts. Unassigned Intake has its own filters and optional source-video grouping, which leaves assignments untouched.

Open a match in **Review Queue** and choose **Edit match details** to edit nullable **Low / Medium / High** obscurity. Use the large preview, thumbnails, or Previous/Next to inspect its screenshots. Choose **Easy / Medium / Hard** or **Unrated** and select **Save classification**. Match, screenshot, and assignment drafts remain independent. Saved game tiers and points are read-only and use this matrix.

| Obscurity | Easy | Medium | Hard |
|---|---|---|---|
| Low | Easy / 1 | Easy / 1 | Medium / 2 |
| Medium | Medium / 2 | Medium / 2 | Medium / 2 |
| High | Medium / 2 | Hard / 3 | Hard / 3 |

Missing either input or a match leaves the screenshot unclassified. A difficulty rating alone does not have points. Saving parent obscurity recalculates derived values without rewriting child ratings/reviews/revisions. Changing or clearing difficulty preserves the review status. An approved unrated screenshot is ineligible until it has a valid rating and meets the other eligibility requirements. Actual association changes and parent answer-field edits reset affected approvals to pending. Notes preserve review and normalized no-op edits preserve revisions.

**Approve**, **Reject**, and **Mark pending** are individual explicit actions. In Review Queue, confirmed approval or rejection advances to the next pending screenshot in the current group. The reviewed capture stays selected when the group has no pending screenshots left. Approval needs a match with participants, promotion and event, both classification inputs, a verified available image, and current screenshot/parent revisions. Optional dates remain optional. Save or cancel image drafts before review. Failed/stale requests retain the draft; compare current values and explicitly reload or acknowledge the newer revision before retrying. Navigation offers Save/Discard/Stay; browser unload prompts depend on browser support.

Filtered table rows show the matching screenshot count out of the full total. Approved, eligible, and awaiting-classification counts describe the whole match. **Overview** statistics stay global when filters change. Fully classified means associated with both valid inputs, regardless of review, identity completeness or image health. Awaiting equals all committed screenshots minus fully classified. Eligible counts additionally require approval, complete identification and a valid image. Rejected records remain in totals; staged imports do not. Missing/corrupt images exclude eligibility without erasing approval. Storage uncertainty reports an error rather than invented zero counts. Each response reassesses relevant files; there is no permanent availability cache.

The theoretical matrix has 2/5/2 cells per tier. Actual library counts come from SQLite and current assets, and no quota or weighting is enforced. Pure pool filtering/random-index helpers prepare future gameplay only; no game selection action, timer, score ledger, or session is added. The host will judge verbal wrestler/match identification. Event/year are not required for basic correctness; surprise follow-ups and discretionary bonuses remain future host decisions and do not change this matrix.

## Migration

Schema 6 allows an approved screenshot to have an unset difficulty. It retains the association requirement and preserves existing reviews, records, and file references. Before upgrading a collection, use the [whole-root backup and restore procedure](local-storage.md#backup-and-restore).

Before first starting this build against schema-1 data, stop all writers and close every connection. Follow the [whole-root WAL-safe backup procedure](local-storage.md#backup-and-restore), including screenshots, retained staging and remaining sidecars. Verify the unchanged source/backup inventory and checksums. An automated backup utility is not included.

On the way to the current schema, the schema 1-to-2 step maps the earlier labels in a transactional table rebuild. `iconic/familiar/obscure` map to `low/medium/high`; old screenshot `squash/competitive/deathmatch` ratings map to visual `easy/medium/hard`. Null remains null. This preserves qualitative order, **not old tier or point equivalence**: old deathmatch + iconic becomes Hard + Low, hence Medium / 2.

IDs, associations, raw capture JSON, file paths/hashes, import receipts and review values remain intact. Only mapped nonnull rows advance revision/timestamp. No image/source files change. Capture metadata's own schemaVersion remains 1. Old input names are rejected after migration; reload open browser editors. Constraints/indexes and incoming result foreign keys survive; enforcement is restored after rebuild. Failures roll back without database recreation; unsafe revision overflow and newer unsupported schemas stop startup clearly. Repeated opens do not remap values.

To roll back the app version, use compatible old code with a verified pre-upgrade backup restored to a separate root. Do not attempt an in-place reverse mapping or mix sidecars from different datasets.

## Manual checks

1. Back up existing data before upgrade, or use a fresh disposable root: `NAME_THAT_MATCH_DATA_DIR=/absolute/disposable/root npm run prod` after `npm run build`.
2. Import authored pairs; verify pending/unassigned/unrated defaults, then create a match and explicitly assign several screenshots.
3. Set match obscurity Low. Rate two images Easy and Hard; save independently. Check Easy / 1 and Medium / 2. Approve one and compare fully-classified versus eligible counts.
4. Change obscurity to High: the same inputs now show Medium / 2 and Hard / 3 without changing screenshot reviews. Clear obscurity and verify unclassified/ineligible behavior.
5. Change and clear difficulty on an approved screenshot. Confirm approval is preserved, clearing blocks eligibility, and restoring the rating restores eligibility if there are no other blockers. Test notes-only changes, rejection, pending, missing metadata, and restoring images using disposable copies only.
6. Search/filter without changing global counts; check literal `%`/`_`, unset values, source grouping and empty results. Try two stale editors and Save/Discard/Stay for match, image and assignment drafts.
7. Use keyboard navigation and a 768px viewport. Verify contained portrait/landscape previews, thumbnail navigation, focus and usable controls. Restart with the same root and confirm persistence.

The Match Library MVP change is [archived](../openspec/changes/archive/2026-11-08-match-library-mvp/archive-summary.md). Its seven optional group-7 acceptance checks remain explicitly deferred. Prior milestone verification records describe their historical input model; this document describes the approved continuation. Physical Android, Wi-Fi and real-collection acceptance require their separate review gate.

## Game tier name update

Displayed game tiers are Easy (1 point), Medium (2 points) and Hard (3 points), replacing Squash Match, Competitive Match and Deathmatch. The matrix, colors, illustrations and points are unchanged. Existing protocol/storage keys remain `squash`, `competitive` and `deathmatch` so saved rounds/filters remain compatible; this label update requires no database migration or metadata changes. Visual difficulty remains an independent input; an Easy visual rating can produce a Medium game tier depending on match obscurity.
