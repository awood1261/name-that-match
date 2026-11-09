# Match Library classification continuation — verification

Date: 2026-11-08 (America/New_York). The user approved the revised proposal/design, D10 legacy mapping, retained approval/complete-match/image gates, and tasks 4.8–4.25. Original tasks 1.1–4.7 and their verification descriptions remain historical evidence. No archive or group-7 acceptance is authorized.

## Delivered scope

- Independent nullable match Low/Medium/High and screenshot Easy/Medium/Hard classifications, with one shared pure exhaustive classifier and separate read-only derived tier/point contracts.
- Transactional schema-2 migration preserving the original migration-1 SQL, all four tables, identities, relationships, raw provenance, reviews, import receipts, files, constraints and indexes. Mapped nonnull rows advance revision/timestamp; null rows remain unchanged. FK enforcement is disabled outside the rebuild transaction, checked before commit, and restored. Failure/overflow rollback and reopen are tested.
- Screenshot edit/review PATCH forms with expected revisions, parent-revision approval checks, complete metadata and available-image prerequisites. Mutations and their projections run transactionally so projection/storage failures do not commit misleading failed writes. Difficulty/association edits reset approved review; notes/no-ops and parent obscurity follow the approved preservation rules.
- Coherent saved classification/asset/eligibility projections; global statistics and full per-match counts; NFC/case-insensitive literal search, AND/OR filters and same-screenshot predicates; independent unassigned filters and optional provenance grouping.
- Existing cards/import/explicit assignment retained. Individual inspector supports contained preview, thumbnails/Previous/Next, difficulty/notes, Save/Cancel, explicit review, field feedback, stale reconciliation, independent match/image/assignment drafts and navigation/unload guards. Saved parent changes refresh tiers/statistics without child writes.
- Independently testable pure pool filtering and random-index selection only. No gameplay action, session, scoring engine, answer validation, bonus execution, WebSockets, new dependency, framework, source capture changes or image transformations.
- Current AGENTS/README/storage/import/match guidance updated, with migration mapping, backup/rollback precautions and future host-judged correctness. Existing archived records and earlier verification records remain untouched.

## Automated verification

| Command | Actual result |
|---|---|
| `npm test -- --silent` (`npm test` with reporter verbosity reduced) | 300 tests passed across 21 files |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed, no warnings |
| `npm run build` | Passed; Vite client and TypeScript server output |
| `openspec validate match-library-mvp --type change --strict` | Passed |
| `openspec validate --all --strict` | 2 items passed, 0 failed |
| `git diff --check` | Passed |

New coverage: three classifier/pool tests, three legacy migration tests, five HTTP/catalog tests and seven component workflow tests (18 additional cases). Existing enum fixtures/assertions now target canonical inputs while the static `tests/fixtures/library-schema-1.sql` preserves the old schema for migration verification. Existing health, startup/shutdown, production static, PNG/metadata validation, import interruption/recovery/idempotency/original preservation, repository invalidation and assignment regressions passed.

Tests include all nine explicit tier/point combinations, null/invalid/legacy inputs, legacy enum mapping, null-row preservation, mapped revisions, custom indexes, incoming import-result FKs/receipts, repeated initialization/reopen, rollback and revision overflow. They cover parent propagation without child mutation, approved/pending/rejected differences, material-versus-editorial/no-op edits, stale parent/screenshot requests, missing/corrupt/restored assets, storage uncertainty, global count invariants, literal NFC `%`/`_` searches and same-screenshot filters. The operation-bound fixture contains 301 matches and 301 screenshots with equal hashes at distinct paths, including an intentionally missing file; each committed asset is assessed once per catalog observation. This demonstrates correctness/read bounds, not a performance guarantee for hundreds of full-resolution images.

Earlier verification iterations caught obsolete enum/endpoint assertions, a fixture URL-resolution assumption, an assignment status regression introduced by error wrapping, and ambiguous component queries; each was corrected before the final passing suite. No failures are excluded from the final suite.

## Production Chrome verification

Executed built production application and headless installed Google Chrome against a new disposable data root, using copied authored fixture PNG/JSON pairs. Local CDP drove actual controls and folder selection; no browser automation dependency was added to the project. Browser runner: `/private/tmp/ntm-classification-browser.cjs` (session-local evidence, not an application utility).

Final evidence root: `/var/folders/fz/n886xxg177nd7nkz0b56r_9h0000gn/T/ntm-classification-browser-Ob0Oh3/` contains `report.json` and desktop/tablet/geometry PNG evidence. Processes were stopped and owned temporary data, captures and browser profile removed; reports/screenshots remain for review. The authoring fixture sources and their checksums were unchanged.

Passed actual browser checks:

- Folder import, preview, explicit duplicate retention/confirmation, two imported captures and retained selection while creating/saving a match; assignment remained a separate explicit action.
- Independent Hard and Easy screenshot saves under Low obscurity displayed Competitive/2 and Squash/1. Unrated approval was disabled; explicit approval enabled eligibility. Global fully-classified/awaiting/eligible totals reflected actual saved records.
- Saving High parent obscurity changed derived tiers and eligible counts without changing the already-approved child's revision, rating or review. Literal no-result search did not filter global statistics.
- Dirty screenshot navigation offered Save/Discard/Stay; initial guard focus was Stay, and Stay retained the draft. Keyboard Space opened the screenshot inspector. Thumbnail and sequential navigation remained available.
- Two actual browser tabs edited one screenshot. The stale save retained tab A's draft, displayed current server values, required deliberate comparison/revision reconciliation, then persisted the intended edit.
- Desktop 1440px and tablet 768px layouts had document widths of 1440 and 768 respectively, with no horizontal page overflow. Visible inspector buttons measured at least 44px high. The preview used `object-fit: contain`; inspector heading focus was observed on opening. Reduced-motion preference was emulated.
- Synthetic layout images had actual natural dimensions 476×360 and 1920×1080. At 768px viewport their preview boxes measured 636×481 and 636×357.75, respectively, with containment and no page overflow.
- Production server stop/restart retained identities, classifications, reviews, associations and eligible counts. Browser page network observations contained zero nonlocal runtime requests.

Browser harness retries corrected waits for React's asynchronous loading/DOM replacement and keyboard focus settling; these were harness timing failures. The final full run passed, including both tabs and geometry checks.

Limits: no physical Android/TV or real Wi-Fi device was tested, no external-network disconnect was forced, and no real capture collection was read/imported. Desktop viewport emulation and observed absence of external page dependencies do not imply physical-device/offline acceptance. Those remain in group 7. The operational data root was not opened or migrated; users must first follow the stopped-writer whole-root backup procedure.

## Maintainability, risks and review

Classification is owned by `shared/src/classification.ts`; server projections reuse it. There is no SQL CASE/UI matrix copy, tier column or manual tier field. Catalog snapshots/response-scoped file assessment preserve explicit missing/corrupt versus uncertain storage semantics. Derived-tier filters recheck all screenshot predicates on one row after projection; SQLite literal search and correlated EXISTS implement the approved query semantics. HTTP validates mutation forms before using repository/CAS operations, and existing import responsibilities remain separate.

Per-request PNG integrity hashing is intentionally not replaced by a permanent cache; full-resolution library growth should be measured before separately approving thumbnails/pagination/cache work. SQLite/file observations cannot be atomically locked together against external filesystem changes. Legacy ordinal mapping intentionally does not preserve former fixed points. Old browser editors must reload after upgrade; rollback requires compatible code and a complete pre-upgrade backup in a separate root.

No specified behavior was dropped or expanded into gameplay. Group-7 rows stay unchecked. Tasks 4.8–4.25 complete the authorized continuation only; expected change progress is 51/58. Review before any further milestone or archive.

## Manual verification

Follow [classification manual checks](../../../docs/classification.md#manual-checks), starting with backup/migration precautions, then import/assignment, Low/High matrix checks, explicit review, statistics/search, draft guards/conflicts and restart. Use disposable managed copies for missing/corrupt-image exercises; never alter original captures.

## Files and Git audit

The working tree remains uncommitted. The five planning artifacts were already modified by the approved planning turn; implementation extends those changes. No package or lockfile changes. No tracked `build/`, `dist/`, runtime data/staging, SQLite databases/sidecars or TypeScript build-info artifacts. The historical SQL fixture is required source test data, not a runtime database. No original capture/design PNGs or archived verification files changed.

- `AGENTS.md`
- `README.md`
- `client/src/library/Library.module.css`
- `client/src/library/MatchInspector.tsx`
- `client/src/library/MatchLibraryPage.tsx`
- `client/src/library/api.ts`
- `client/src/library/useMatchWorkspace.ts`
- `docs/import-engine.md`
- `docs/local-storage.md`
- `docs/match-management.md`
- `openspec/changes/match-library-mvp/design.md`
- `openspec/changes/match-library-mvp/proposal.md`
- `openspec/changes/match-library-mvp/specs/match-library/spec.md`
- `openspec/changes/match-library-mvp/specs/screenshot-review/spec.md`
- `openspec/changes/match-library-mvp/tasks.md`
- `server/src/library/assets.ts`
- `server/src/library/http/dispatcher.ts`
- `server/src/library/http/matches.ts`
- `server/src/library/migrations.ts`
- `server/src/library/repository.ts`
- `shared/src/imports.ts`
- `shared/src/library.ts`
- `shared/src/matches.ts`
- `tests/client/library.test.tsx`
- `tests/client/match-management.test.tsx`
- `tests/library/constraints.test.ts`
- `tests/library/migrations.test.ts`
- `tests/library/repository.test.ts`
- `tests/library/validation.test.ts`
- `tests/server/match-management.test.ts`
- `client/src/library/LibraryFilters.tsx`
- `client/src/library/ScreenshotInspector.tsx`
- `docs/classification.md`
- `openspec/changes/match-library-mvp/verification-classification-continuation.md`
- `server/src/library/catalog.ts`
- `shared/src/classification.ts`
- `tests/fixtures/library-schema-1.sql`
- `tests/library/classification-migration.test.ts`
- `tests/server/classification.test.ts`
- `tests/shared/classification.test.ts`

## Subsequent manual-review correction

The filter/editor context issue reported after initial verification is addressed by task 4.26. See [filter-context verification](verification-filter-context.md) for the corrected interaction, 307-test result, production-browser evidence and current 52/59 progress. The earlier 51/58 record above remains the historical continuation checkpoint.
