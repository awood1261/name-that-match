# Classification and individual review

The library retains match cards, explicit assignments and original capture provenance. Use **Search and filters** to find participant descriptions, promotions or events literally (case insensitive, Unicode NFC; `%` and `_` are ordinary characters). Filter groups combine with AND; selected values in a group combine with OR. Screenshot difficulty/review/tier conditions must all match one screenshot. Match identification and classification incompleteness have separate filters. Changing search/filters returns to results and clears the previous collection/editor/selection only after Save/Discard/Stay protection. **Back to match results** retains the current filters. Collection headings explicitly identify the selected match and explain that only matching screenshots are shown, with visible and full-match counts. The unassigned queue has its own filters and optional provenance-only source-video grouping.

Open a result card to view its explicitly named matching screenshot collection, then choose **Edit match details** to edit nullable **Low / Medium / High** obscurity, describing recognition of the match itself. Open **Review screenshot** to edit nullable **Easy / Medium / Hard** visual difficulty and notes, with explicit Save/Cancel. Navigate via thumbnails or Previous/Next. These drafts and assignment remain independent. Saved tiers/points are read-only and never stored. Game tier names are Easy / Medium / Hard (1/2/3 points); they are derived separately from the visual difficulty inputs in the column headings below:

| Obscurity | Easy | Medium | Hard |
|---|---|---|---|
| Low | Easy / 1 | Easy / 1 | Medium / 2 |
| Medium | Medium / 2 | Medium / 2 | Medium / 2 |
| High | Medium / 2 | Hard / 3 | Hard / 3 |

Missing either input or a match leaves the screenshot unclassified. A difficulty rating alone does not have points. Saving parent obscurity recalculates derived values without rewriting child ratings/reviews/revisions. Editing an approved screenshot's difficulty or association resets it to pending, even if its resulting tier stays the same. Actual answer-field edits reset associated approved reviews atomically. Notes preserve review; normalized no-op edits preserve revisions.

**Approve screenshot**, **Reject screenshot**, and **Mark pending** are individual explicit actions. Approval needs a match with participants, promotion and event, both classification inputs, a verified available image, and current screenshot/parent revisions. Optional dates remain optional. Save or cancel image drafts before review. Failed/stale requests retain the draft; compare current values and explicitly reload or acknowledge the newer revision before retrying. Navigation offers Save/Discard/Stay; browser unload prompts depend on browser support.

Filtered result cards show the matching screenshot count out of the full total. Their approved/eligible/awaiting figures are labeled Full match totals. **Entire library** statistics stay global when filters change. Fully classified means associated with both valid inputs, regardless of review, identity completeness or image health. Awaiting equals all committed screenshots minus fully classified. Eligible counts additionally require approval, complete identification and a valid image. Rejected records remain in totals; staged imports do not. Missing/corrupt images exclude eligibility without erasing approval. Storage uncertainty reports an error rather than invented zero counts. Each response reassesses relevant files; there is no permanent availability cache.

The theoretical matrix has 2/5/2 cells per tier. Actual library counts come from SQLite and current assets, and no quota or weighting is enforced. Pure pool filtering/random-index helpers prepare future gameplay only; no game selection action, timer, score ledger, or session is added. The host will judge verbal wrestler/match identification. Event/year are not required for basic correctness; surprise follow-ups and discretionary bonuses remain future host decisions and do not change this matrix.

## Migration

Before first starting this build against schema-1 data, stop all writers and close every connection. Follow the [whole-root WAL-safe backup procedure](local-storage.md#backup-and-restore), including screenshots, retained staging and remaining sidecars. Verify the unchanged source/backup inventory and checksums. An automated backup utility is not included.

Startup upgrades the existing database in place to schema 2 using a transactional table rebuild. `iconic/familiar/obscure` map to `low/medium/high`; old screenshot `squash/competitive/deathmatch` ratings map to visual `easy/medium/hard`. Null remains null. This preserves qualitative order, **not old tier or point equivalence**: old deathmatch + iconic becomes Hard + Low, hence Medium / 2.

IDs, associations, raw capture JSON, file paths/hashes, import receipts and review values remain intact. Only mapped nonnull rows advance revision/timestamp. No image/source files change. Capture metadata's own schemaVersion remains 1. Old input names are rejected after migration; reload open browser editors. Constraints/indexes and incoming result foreign keys survive; enforcement is restored after rebuild. Failures roll back without database recreation; unsafe revision overflow and newer unsupported schemas stop startup clearly. Repeated opens do not remap values.

To roll back the app version, use compatible old code with a verified pre-upgrade backup restored to a separate root. Do not attempt an in-place reverse mapping or mix sidecars from different datasets.

## Manual checks

1. Back up existing data before upgrade, or use a fresh disposable root: `NAME_THAT_MATCH_DATA_DIR=/absolute/disposable/root npm run prod` after `npm run build`.
2. Import authored pairs; verify pending/unassigned/unrated defaults, then create a match and explicitly assign several screenshots.
3. Set match obscurity Low. Rate two images Easy and Hard; save independently. Check Easy / 1 and Medium / 2. Approve one and compare fully-classified versus eligible counts.
4. Change obscurity to High: the same inputs now show Medium / 2 and Hard / 3 without changing screenshot reviews. Clear obscurity and verify unclassified/ineligible behavior.
5. Edit difficulty on an approved screenshot: confirm pending review. Test notes-only changes, rejection, pending, missing metadata, and restoring images using disposable copies only.
6. Search/filter without changing global counts; check literal `%`/`_`, unset values, source grouping and empty results. Try two stale editors and Save/Discard/Stay for match, image and assignment drafts.
7. Use keyboard navigation and a 768px viewport. Verify contained portrait/landscape previews, thumbnail navigation, focus and usable controls. Restart with the same root and confirm persistence.

The Match Library MVP change is [archived](../openspec/changes/archive/2026-11-08-match-library-mvp/archive-summary.md). Its seven optional group-7 acceptance checks remain explicitly deferred. Prior milestone verification records describe their historical input model; this document describes the approved continuation. Physical Android, Wi-Fi and real-collection acceptance require their separate review gate.

## Game tier name update

Displayed game tiers are Easy (1 point), Medium (2 points) and Hard (3 points), replacing Squash Match, Competitive Match and Deathmatch. The matrix, colors, illustrations and points are unchanged. Existing protocol/storage keys remain `squash`, `competitive` and `deathmatch` so saved rounds/filters remain compatible; this label update requires no database migration or metadata changes. Visual difficulty remains an independent input; an Easy visual rating can produce a Medium game tier depending on match obscurity.
