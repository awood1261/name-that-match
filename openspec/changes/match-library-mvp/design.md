## Context

See `proposal.md` for the proposed 2026-11-08 classification revision. This remains a planning-only update; source, database and current application behavior are unchanged until approval.

- The actual implementation through tasks 1.1–4.7 is committed at `837c01f`. Imports, durable recovery, match cards/editing, partial dates, independent assignment drafts, revision conflicts and responsive inspector already work. Reuse `MatchLibraryPage`, `MatchInspector`, `AssignmentPanel`, `useMatchWorkspace`, `api.ts`, existing CSS Modules and repository transactions.
- `shared/src/library.ts` currently conflates screenshot difficulty with the direct point tier (`squash|competitive|deathmatch`) and stores match obscurity as `iconic|familiar|obscure`. The new policy replaces these with two input enums and a separate calculated tier. It is a deliberate breaking contract/migration, not cosmetic label changes.
- Schema 1 has four STRICT tables, CHECK constraints, foreign keys, WAL/NORMAL settings and ordered transactional initialization. `import_items.result_screenshot_id` references screenshots, so enum migration must preserve all dependent rows/constraints. No tier/count column is needed.
- Native HTTP currently exposes imports, matches, assignments, basic screenshot lists/images, health and static assets. Screenshot PATCH accepts association only; match GET rejects search/filter queries. There is no difficulty editor, review UI, eligibility evaluator, statistics, shared matrix or selection helper yet.
- `MatchSummary`/`ScreenshotSummary` are intentionally minimal projections. Extend them coherently rather than introduce a competing library model. `assets.ts` already performs bounded exact-byte assessment, but its `unavailable` result must become a clear 503 in eligibility/statistics rather than a false count.
- Baseline is clean and tests rerun 2026-11-08 pass 282 cases in 18 files. Earlier verification records are historical; checked tasks retain their original enum/behavior descriptions and are not relabeled as implementation of this revision.
- The library comp is a visual reference. Keep current compact match cards/navigation/inspector; add small search/filter/count/progress controls rather than a new CMS/dashboard. Raw capture IDs, long source titles and timestamps can move to secondary provenance within the selected screenshot inspector.
- User confirmed retention of explicit review, participant/promotion/event completeness and valid-image eligibility gates alongside the new classification matrix. Current AGENTS.md still describes the earlier rule; an approved implementation must update those durable product rules before changing behavior. No archived/main capability history is rewritten here.

### Capture evidence and ownership

Read-only producer sources: `/Users/alexwood/Dev/name-that-match-capture/name-that-match-capture/src/metadata.ts` (version, shape, generator, validator), `src/storage.ts` (separate downloads and `uniquify`), and `src/content.ts`/`background.ts` (canvas PNG and source provenance). The exporter runtime enforces version 1 and method `video-frame-capture`; its TypeScript `schemaVersion: number`/`method: string` declarations are looser than that runtime contract. Its filename/URL safety checks are also looser than importer requirements. Do not import these source modules into the app or change the producer.

Prior exploration found 12 video directories, 60 valid complete pairs, 59 unique PNG contents, one identical-image pair, and approximately 94.16 MiB of PNGs. Observed images were noninterlaced 8-bit RGBA, dimensions 476×360 through 1920×1080. All metadata was v1, with title present although optional. These are evidence for proportional defaults, not fixed counts, match counts, supported-resolution lists, or permanent acceptance fixtures. External captures and the producer stay read-only throughout planning and implementation acceptance.

## Goals / Non-Goals

**Goals:** A complete local administration path; explicit independent identities and review decisions; bounded uploads; recoverable file/SQL coordination; revisions across tabs/devices; small focused modules and verifiable milestones; exact independent input classification, honest statistics and prepared eligible pools.

**Non-Goals:** See proposal exclusions. In particular, no automatic match grouping, normalized roster, external metadata lookup, live collaboration/authentication system, general job infrastructure, live gameplay (pure preparation helpers are in scope), new server framework, new dependencies, or image transformation service. This document describes future implementation, not code delivered in the planning phase.

## Decisions

### D1. Capability ownership and module boundaries

Requirement references in tasks use CI-* (`capture-import`), ML-* (`match-library`), SR-* (`screenshot-review`), and F-shell/F-storage (the two modified foundation requirements).

- `shared/src/library.ts`, `shared/src/capture.ts`, existing HTTP contracts and a focused `shared/src/classification.ts`: JSON-safe types/constants and the single pure matrix classifier. Add small pure pool-filter/random-index helpers for future callers; no session state or browser authority over game selection. Do not expand the health payload or pull Node modules into browser bundles.
- Focused server modules under `server/src/library/`: schema migrations, repositories/transactions, request/domain validation, capture/PNG validation, import coordination/recovery, asset access, and review/eligibility. Split along actual responsibilities; do not create class hierarchies or generic service/repository frameworks.
- A small library HTTP dispatcher handles `/api/...`, method checks, bounded body readers, origin checks, and sanitized errors before existing SPA dispatch. Reuse the existing storage session; browser never opens SQLite or reads server paths.
- React uses local state and small fetch helpers. Keep dirty drafts separate from server records and derived eligibility. API requests are ordinary HTTP; no WebSockets, global state package, or router dependency is required. Keep System status available and use the existing Image Library navigation action to open this experience.
- Follow existing `tests/` conventions for tests and colocate component CSS Modules with components. No unrelated App refactor or global CSS overhaul.

Alternatives rejected: Express/global state/ORM/job framework add infrastructure without a demonstrated need; direct extension-source imports couple two separately deployed repositories.

### D2. Domain records and validation

Internal IDs are Node-generated UUIDs represented as text. Capture identity is `(source_platform, capture_id)`; it is immutable and distinct from screenshot ID. Video ID identifies footage provenance only. There is no unique match signature or unique video-to-match mapping.

Normalize editable text by trimming outer whitespace and mapping empty strings to null; preserve interior formatting. Dates are null or canonical `YYYY`, `YYYY-MM`, `YYYY-MM-DD`, with actual calendar validation, years 0001–9999, and no invented components. Normalize before change detection. Participant description is free text supporting named wrestlers, team names, and multi-person descriptions. Completeness requires participant description, promotion, and event; other metadata is optional.

Field limits: participant description 1000 characters; promotion/event/stipulation/championship information 500 each; editorial notes 10000; source label 255; search text 200. Reject control/NUL characters except newline/tab in editorial notes. Unknown editable API fields are rejected rather than silently ignored; unknown supported-version capture fields are preserved as inert JSON. No HTML is interpreted and no source URL is fetched.

#### SQLite model

Migration 1 historically introduced exactly four feature tables and remains unchanged. The schema-2 target retains the same tables/columns and changes only input enum constraints/values through D10. All timestamps are server-written UTC ISO strings, except immutable producer `captured_at`, whose original text is retained alongside raw metadata. All editable records start at revision 1.

| Table | Columns and constraints |
|---|---|
| `matches` | `id TEXT PRIMARY KEY`; nullable `participant_description`, `promotion`, `event`, `match_date`, `obscurity`, `stipulation`, `championship_info`, `notes`; `created_at`, `updated_at TEXT NOT NULL`; `revision INTEGER NOT NULL CHECK(revision > 0)` |
| `screenshots` | `id TEXT PRIMARY KEY`; nullable `match_id REFERENCES matches(id) ON DELETE RESTRICT`; required `capture_id`, `source_platform`, `source_video_id`, `source_url`; nullable `source_title`; required `playback_seconds REAL`, `captured_at`, `capture_method`, `schema_version`, `original_metadata_json`; required `image_path`, `image_sha256`, `image_width`, `image_height`, `image_byte_size`; nullable `difficulty`, `notes`; `review_status` default `pending`; required creation/update timestamps and positive revision |
| `import_batches` | `id TEXT PRIMARY KEY`; required `source_label`, `status`, `created_at`, `updated_at`; nullable `completed_at`, `preview_token`; positive `revision`; `confirmation_receipts_json TEXT NOT NULL` initially `{}`; `ignored_files_json TEXT NOT NULL` initially `[]`; last sanitized batch error/retryability |
| `import_items` | `id TEXT PRIMARY KEY`; `batch_id REFERENCES import_batches(id) ON DELETE RESTRICT`; required stable ordinal and sanitized candidate label; nullable raw `original_metadata_json`, source/capture identity until validated; validation issues JSON; nullable owned `staging_path`, `final_path`, intended `screenshot_id`; nullable validated hash/dimensions/byte size; `state`, `resume_state`, confirmed decision and confirmation key; result kind/error/retryability; nullable `result_screenshot_id REFERENCES screenshots(id) ON DELETE RESTRICT`; required timestamps |

Schema-2 checks: obscurity null or `low|medium|high`; visual difficulty null or `easy|medium|hard`; review `pending|approved|rejected`; source platform `youtube`; schema version 1; method `video-frame-capture`; positive integer dimensions/byte size; playback finite and >=0; lowercase 64-hex hash; valid JSON in JSON columns. Application runtime validates full dates, finite numbers, exact metadata shape, and cross-record/asset conditions; SQL constraints are a second boundary, not a replacement.

Unique constraints: screenshot `(source_platform,capture_id)`, screenshot `image_path`, and import item `(batch_id,ordinal)`. A local SQL check prohibits approved screenshot rows with null match or difficulty. Do not constrain duplicate image hashes or repeated video IDs. Index screenshot `match_id` and `image_sha256`, and import item `(batch_id,state)`. Add filter indexes only if representative query checks justify them; no full-text index or redundant eligibility/count columns. Retain per-item receipts/provenance even when candidates are skipped. Metadata is a few hundred bytes in the observed collection; no separate sources/assets table is needed.

The four-table schema and import processing already ship in completed milestones. Repository tests may seed representative screenshot rows in isolated fixtures; this is not a production direct-import shortcut. The proposed continuation exposes approval only after complete matrix/metadata/asset/revision checks exist. Original capture metadata schemaVersion remains 1; it is independent of database user_version 2.

### D3. Capture contract, pairing, and bounded PNG checks

The application-owned contract is exactly:

```ts
interface CaptureMetadataV1 {
  schemaVersion: 1;
  captureId: string;
  source: { platform: 'youtube'; videoId: string; canonicalUrl: string; title?: string };
  capture: { playbackSeconds: number; capturedAt: string; method: 'video-frame-capture' };
  image: { filename: string; width: number; height: number; format: 'png' };
}
```

Keep original UTF-8 JSON text in SQL, including additional fields. Parse safely as data; never merge unknown keys into runtime options/objects or render them as HTML. Required fields are validated before trusting candidate identity; optional title, when present, must be nonblank text. Capture timestamp must be a real UTC ISO timestamp; playback must be a finite nonnegative JSON number, with no arbitrary video-duration bound. Capture time is not match date.

Treat capture ID as a bounded opaque safe basename component (1–128 ASCII letters/digits/underscore/hyphen), not as a timestamp to parse or an internal path. Require video IDs matching the existing standard YouTube identifier format, HTTPS `/watch` on `youtube.com` or `www.youtube.com`, exactly one `v` equal to metadata video ID, no credentials/fragment/other query parameters. Preserve the original URL, and construct display links only from the validated video ID and fixed HTTPS YouTube base. Existing producer output meets these checks; unsupported schema versions cannot be inferred into v1.

Pair using each JSON's capture ID and exact `image.filename == captureId + '.png'` in the same selected relative directory; require JSON basename `captureId + '.json'`. The selected root may be the parent collection, a video directory, or a flat multi-file selection. Directory names are context, not authoritative identity. Reject absolute/drive/UNC paths, `.`/`..` components, backslashes, NUL, basename separators, repeated/ambiguous relative paths, and collision-renamed mismatches. Known `.DS_Store` is counted and ignored. Unsupported files are reported as ignored; missing partners become blocked candidates. Do not rename originals to make a pair work.

#### Resource policy

The native HTTP layer streams binary requests into generated `.part` paths and stops at caps; it never buffers a batch or base64-encodes PNGs. File count and byte reservations are enforced for concurrent uploads, not just trusted from Content-Length. Limit JPEG/other content even if named `.png`.

| Policy | Default | Configuration |
|---|---:|---|
| PNG bytes | 32 MiB per image | `NAME_THAT_MATCH_MAX_IMAGE_BYTES` |
| Pixels | 16,777,216 | `NAME_THAT_MATCH_MAX_IMAGE_PIXELS` |
| Inflated PNG scanline bytes | 80 MiB | `NAME_THAT_MATCH_MAX_DECOMPRESSED_BYTES` |
| Original metadata bytes | 64 KiB per item | `NAME_THAT_MATCH_MAX_METADATA_BYTES` |
| JSON API body | 16 MiB | `NAME_THAT_MATCH_MAX_JSON_BYTES` |
| Batch candidates | 256 | `NAME_THAT_MATCH_MAX_IMPORT_ITEMS` |
| Batch image bytes | 1 GiB | `NAME_THAT_MATCH_MAX_BATCH_BYTES` |
| Simultaneous uploads | 2 per batch | `NAME_THAT_MATCH_MAX_UPLOADS` |
| Inactive staging retention | 7 days | `NAME_THAT_MATCH_STAGING_RETENTION_DAYS` |

Validate positive integer configuration at startup and document effective limits. The JSON body cap is independent: a batch with very large sidecars may need splitting even below image/item limits. Fail explicitly; do not silently omit items. Expose effective public limits to the import dialog through batch creation/status contracts. Bound JSON parsing with byte limits, a maximum nesting depth of 32, and at most 8192 total JSON values; reject nonfinite numeric values anywhere, including additional fields. Preserved unknown content stays inert.

Use Node buffers/zlib for static PNG validation with signature, IHDR/chunk bounds/order, required/unknown-critical chunks, CRC, complete IDAT stream, supported color/depth/interlace, exact inflated length, scanline filter validity, terminal IEND, and no trailing malformed data. Initially accept static noninterlaced 8-bit RGB/RGBA (including all observed captures), explicitly report unsupported PNG encodings, and enforce both pixel and inflation caps before/during decompression. Browser decoding is useful UI feedback but not server authority. No image transformation or perceptual hashing is needed. SHA-256 is over original PNG bytes; byte-different PNGs are not automatically duplicates. No new image dependency is proposed.

### D4. Browser selection, duplicate preview, and identity

Use directory `<input type=file webkitdirectory>` plus separate multiple-file input. The user chooses a source on their current browser device; no absolute path is sent to request a server scan. Read small sidecars and build a manifest; send their original text and sanitized relative candidate labels. Server creates item IDs and upload URLs, then the client uploads PNG bytes with concurrency bounded to effective limits. Every new byte upload and changed batch preview invalidates the current preview token.

Duplication compares normalized immutable known provenance fields (version, capture ID, platform/video/URL/title, capture playback/time/method, declared filename/dimensions/format), original image bytes, and supported-version extra metadata as parsed JSON. Ignore object-key order and JSON whitespace only; do not ignore meaningful unknown-field differences. Preserve raw original text. Explicitly missing optional title differs from a supplied title. There is no silent metadata refresh on reimport.

Order candidates deterministically by normalized selection-relative label and item ID; the first of otherwise new byte-identical candidates is default-import and later identities default-skip. Same capture identity repeated identically within a batch creates one screenshot and duplicate references for other candidates. Same identity with differing immutable metadata/hash blocks all conflicting candidates of that identity within that batch. Against committed records, the existing record always wins and differing candidates conflict. Unique SQL constraints resolve concurrent attempts without overwriting.

Preview classifies each item: `valid`, `already_imported`, `image_duplicate`, `invalid`, `identity_conflict`, or `upload_required`, with structured issues/default action. The `import` confirmation action is allowed only for a current valid nonduplicate candidate; `keepDuplicate` is allowed only for a different capture identity with equal PNG hash and an acknowledged current duplicate set. `skip` records the operator choice without importing. Explicit keep is offered only for different capture identities with equal PNG hashes. Recheck uniqueness and duplicate hashes at confirmation and immediately before each commit. If a new hash duplicate appears after preview and no explicit keep for that observed duplicate set exists, stop that item for refreshed preview rather than importing it silently. An idempotent already-imported item is outcome `duplicate`, not `imported`.

### D5. Durable import state and filesystem coordination

Use import-specific coordination only: one live operation per batch, serial confirmation within a batch, two bounded upload streams by default, SQLite write transactions across batches. Short SQL transactions contain no awaited file I/O. Durable item state is authoritative; in-memory locks prevent overlap within this single server but do not substitute for restart reconciliation. No worker daemon or general job framework. One application server process owns a data root; multiple tabs/devices connect to that authority. Running independent server processes against the same managed staging root is unsupported and must be documented.

```text
awaiting_upload --> uploading --> staged --> validating --> ready
                         |            |          |           |
                         v            v          v           v
                       failed       failed     invalid    confirmed
                                                             |
                                                             v
                                                        finalizing
                                                             |
                                                             v
                                                         finalized
                                                             |
                                                             v
                                                         committed

ready --> duplicate | skipped | conflict
confirmed/finalizing/finalized --> failed (with resume_state)
unconfirmed inactive staging --> expired
```

The internal state `committed` maps to public result `imported`. `invalid`/`conflict` map to failed results with nonretryable issues until source/decisions are corrected; `failed` carries retryability and a resume point. New requests do not mutate immutable metadata of existing items: corrected metadata creates a new batch. Incomplete bytes may be re-uploaded for the same item.

1. Batch creation transaction inserts item ownership, ordinal, raw metadata, and generated staging locations; it does not create screenshots. Missing-pair records can exist without upload slots.
2. Persist `uploading`; stream into `staging/<batchId>/<itemId>.part` using exclusive creation, enforce limits/reservations, flush/close, and rename within staging to `<itemId>.png`. Record staged completion. On validation, compare actual file/hash/dimensions to metadata, persist structured outcome, and generate an opaque preview token for a stable preview snapshot.
3. Confirmation transaction validates the preview token, decisions and duplicate acknowledgement, persists an immutable request receipt and item confirmation intent with stable intended UUID and relative final path `screenshots/<screenshotId>.png`. Do this before file finalization. No screenshot row exists yet.
4. Persist `finalizing`. Create the final path without clobbering an existing destination, copy from validated staged bytes using exclusive creation, flush and close, then persist `finalized`. Recheck hash/size. If a matching owned final file already exists, reuse it. Never replace a committed asset or silently overwrite differing bytes.
5. In one transaction, recheck identity/duplicate rules and insert the unassigned/unrated/pending screenshot with original provenance, set item `committed` with its resulting screenshot ID, and update batch progress/receipt. If uniqueness now resolves to an identical existing record, record `duplicate`; a conflict remains a failed item. Recheck exact final bytes before exposing them. Cleanup removes only owned now-unneeded staging bytes after durable commit.

A crash during an exclusive copy can leave a partial uncommitted final file. Reconciliation checks persisted `finalizing` ownership and intended path, no screenshot reference, and validated staged source. It can quarantine that proven-owned incomplete attempt under the item's managed staging directory before retrying finalization; it must never overwrite an unexpected file or a path referenced by a screenshot. If ownership/integrity cannot be proven, fail with `FINALIZATION_CONFLICT` for operator review and retain evidence. This avoids pretending a raw rename or database transaction makes disk and SQL atomic.

#### Restart rules

| Durable state / observed files | Recovery |
|---|---|
| `uploading`, incomplete `.part` | Mark retryable upload-required; remove only identified owned partial upload before re-upload |
| `staged`/`validating` | Validate existing staged bytes again; no confirmation inferred |
| `ready`, no confirmed intent | Restore preview; require explicit confirmation |
| `confirmed` | Recheck duplicates and finalize only the previously confirmed item |
| `finalizing`, valid matching final | Record finalized and continue commit |
| `finalizing`, proven owned partial plus valid stage | Quarantine partial and retry as above |
| `finalized`, no screenshot | Validate and transactionally finish insertion or classify duplicate/conflict |
| `committed` plus screenshot | Return original result; missing/corrupt committed file is an asset-health problem, not a new import |
| Missing both staged/final bytes | Mark retryable re-upload-required; do not fabricate a successful result |

Run reconciliation after migrations and before serving library mutations, with bounded work and per-item failures. Storage-wide recovery failure rejects readiness/startup clearly; a corrupt single item does not destroy or block unrelated valid library records. Completed import results remain after restart.

#### Receipts, retries, batch status, and cleanup

Each confirmation request supplies a UUID `requestId`, preview token, and sorted item decisions. Persist a receipt in the batch's `confirmation_receipts_json`: request hash, immutable decisions/acknowledged duplicate sets, timestamps, and progress association. This avoids a fifth table for the small bounded batch. Repeated key/same body returns current durable outcomes before preview-token expiry checks; changed body returns 409. Retry failed items after refreshed preview with a new key; successful items keep original identities/results. A new candidate import requires a new batch if metadata changes. The confirm handler returns 202 after recording intent; an import-specific asynchronous loop advances selected items, while status polling reports progress. Await/catch its errors and stop cleanly on storage failure; restart uses durable intent.

Public batch states: `uploading`, `validating`, `preview_ready`, `confirming`, `completed`, `partial_success`, `failed`, `interrupted`, `expired`. Browser-local states add `no_selection` and `scanning`. Item result categories are disjoint `imported|duplicate|skipped|failed`; `ignored` counts files outside candidate items separately. Before terminal completion return a separate remaining count. Completed means no failed or remaining items, including an intentionally all-skipped batch. Partial success means imported/duplicate results plus failures. Failed means failures with no imported/duplicate results. Interrupted means unfinished retryable work after interruption; it does not erase successful results. Refresh can recover the batch by its ID; report recent batch summaries through status discovery, with no access to original absolute paths.

At startup and between idle operations, expire unconfirmed batches with no live operation after the configured retention period. Persist expired state before deleting only their manifest-owned staged bytes. Do not expire confirmed/finalizing work before reconciliation or remove committed assets. Successfully committed/duplicate/skipped item staging can be cleaned immediately after recording results. Failed confirmed items are retained for retry; document their disk usage and an explicit stopped-server maintenance procedure that verifies no committed reference before clearing abandoned owned staging. Do not implement screenshot deletion, sweep the screenshots directory, or touch source captures. Unknown files remain untouched and are reported as maintenance diagnostics. Keep result/provenance rows after staging cleanup.

### D6. HTTP contracts and security

Use native Node HTTP, JSON (`application/json`) for contracts, and raw `image/png` for uploads. All API responses use `{data: ...}` on success or `{error:{code,message,fieldErrors?,itemId?,retryable?,currentRevision?,currentMatchRevision?}}` on failure. IDs are validated UUIDs, revisions positive safe integers, enums exact, and unknown request/query fields are rejected. `null` explicitly clears an editable optional field; omitted PATCH fields are unchanged. Client never supplies managed paths, hashes, review side effects, creation timestamps, or eligibility.

#### JSON record schemas

- `MatchRecord`: `id`, `participantDescription`, `promotion`, `event`, `matchDate`, `obscurity`, `stipulation`, `championshipInfo`, `notes` (nullable text/enums as D2); `createdAt`, `updatedAt`, `revision`; derived `complete`, `missingFields[]`, `screenshotCount`, `approvedCount`, `eligibleCount`, `awaitingClassificationCount`, `classificationIncomplete`, `matchingScreenshotCount` (all associated screenshots without screenshot filters; otherwise same-row filtered count).
- `ScreenshotRecord`: `id`, nullable `matchId`; `provenance` (parsed preserved v1 metadata); actual `image:{width,height,byteSize,sha256,url}` where URL is the ID-based API URL, never a disk reference; nullable `difficulty`, `notes`; `reviewStatus`, timestamps, revision; derived `assetStatus`, `eligibility:{eligible,reasons[]}` and nullable `matchRevision`, `classification:{complete,tier,points}` (unclassified uses null tier/points). Managed disk references are persistence-only.
- `ImportItem`: `id`, `ordinal`, `candidateLabel`, `state`, nullable `classification`, validation `issues:[{code,field?,message}]`, `retryable`, nullable `defaultAction`, `duplicateOf` committed screenshot IDs or same-batch candidate IDs, nullable `uploadUrl`, resulting `screenshotId`, and public result kind. No staging/final paths are returned.
- `BatchStatus`: `id`, source label, public status, revision, nullable preview token, timestamps, effective limits, items, ignored file counts/reasons, `counts:{imported,duplicate,skipped,failed,remaining}`, sanitized last error. Preview also supplies classification counts separately from final outcome counts.

| Method/path | Request | Response and semantics |
|---|---|---|
| `POST /api/imports` | `{sourceLabel,files:[{clientFileId,relativePath,byteSize,metadataText?}]}`; metadataText required for JSON descriptors; no PNG bytes | 201 `BatchStatus`; server pairs manifest entries, creates valid upload slots and blocked orphan/ambiguous items, counts ignored files; manifests bounded to 1024 selected file descriptors and configured item/body caps |
| `PUT /api/imports/:batchId/items/:itemId/image` | Raw PNG bytes, `Content-Type: image/png`; declared size is advisory, actual bytes enforced | 200 updated `ImportItem`; re-upload of identical finished bytes is idempotent; differing finished bytes conflict; partial uploads can be retried from byte zero; no chunk-resume protocol |
| `POST /api/imports/:batchId/preview` | `{expectedRevision}` | 200 `BatchStatus` after bounded validation; missing uploads yield actionable item errors; revision mismatch 409; preview token binds current validated decisions/duplicate set |
| `POST /api/imports/:batchId/confirm` | `{requestId,previewToken,items:[{itemId,action:'import'|'keepDuplicate'|'skip'}]}` | 202 `BatchStatus` once durable intent exists; replay same key/body returns 200 or 202 current status; new keep decisions must match current preview; different key/body can retry failed items after refreshed preview |
| `GET /api/imports` | No query parameters | 200 recent batch summaries ordered creation descending then ID, at most 20; permits restart recovery discovery without source paths |
| `GET /api/imports/:batchId` | None | 200 `BatchStatus`; includes post-restart outcomes and expiry/re-upload guidance |
| `GET /api/matches` | Optional `q`, comma-separated `obscurity`, `difficulty`, `review`, `tier`, `incomplete=true`, `classificationIncomplete=true` | 200 `{matches:MatchRecord[],matchedCount,asOf}`; deterministic sorting and D8 filtering |
| `POST /api/matches` | Match editable fields only; empty object creates an explicit incomplete draft | 201 `MatchRecord` |
| `PATCH /api/matches/:id` | `{expectedRevision,changes:{...editable match fields}}` | 200 `{match:MatchRecord,invalidatedScreenshots:[{id,revision}]}`; atomic match update/review resets |
| `GET /api/screenshots` | Optional `matchId` (UUID or `unassigned`), `difficulty`, `review`, `tier`; default all committed; no arbitrary path | 200 `{screenshots:ScreenshotRecord[],matchedCount,asOf}`; sufficient detail for inspector and thumbnails |
| `PATCH /api/screenshots/:id` | Edit: `{expectedRevision,changes:{matchId?,difficulty?,notes?},expectedMatchRevision?}`; OR review: `{expectedRevision,reviewStatus,expectedMatchRevision?}` | 200 `ScreenshotRecord`; assignment requires target revision when nonnull; approval requires current parent revision; review and material-edit forms cannot be combined |
| `POST /api/screenshots/assignments` | `{targetMatchId,expectedMatchRevision,screenshots:[{id,expectedRevision}]}`; 1–256 unique IDs | 200 `{screenshots:ScreenshotRecord[]}`; target must exist, all revisions current; all-or-none assignment; no bulk review fields |
| `GET /api/library/statistics` | No query parameters | 200 global `LibraryStatistics` from D11, independent of match filters; unavailable storage 503 |
| `GET/HEAD /api/screenshots/:id/image` | None | 200 original validated PNG, `Content-Type: image/png`, `X-Content-Type-Options: nosniff`, `Cache-Control: no-store`; HEAD returns matching headers without body |

`files` is a selection manifest, not a filesystem locator. All JSON sidecar text is uploaded as bounded literal text inside JSON rather than normalized/rebuilt by the browser. An orphan PNG needs no metadataText and appears as an invalid pair, not a silently dropped file. Client-side scanning is convenience only; the server independently validates and pairs descriptors. Do not reserve large memory based on supplied byteSize.

Status codes: 400 malformed JSON, fields/IDs/query shape; 403 origin/header policy; 404 unknown record/route or absent asset; 405 unsupported method with Allow; 409 revision/identity/idempotency/busy/changed-preview conflict; 410 expired upload/confirmation requiring a new selection; 413 actual byte/body/batch-size limits; 415 wrong request media type; 422 semantic field/PNG/approval failure, including corrupt committed assets; 503 storage unavailable/recovery not ready; 500 sanitized unexpected failures. Item validation errors normally appear inside a 200 preview or final batch result; a bad candidate is not a transport error for the entire manifest. Mutating no-op updates still check expected revisions and return current records without increments.

#### Same-origin mutation policy

Require a non-simple `X-Name-That-Match: library` header on all mutations, including binary uploads. If Origin is present it must exactly match a configured UI origin; reject `null` and foreign origins before reading the body or writing files. Requests without Origin are accepted only with the required custom header and expected media type (nonbrowser tools on trusted hosts). Do not emit Access-Control-Allow-Origin on mutation/library endpoints or approve foreign preflights. The existing health endpoint's CORS behavior stays unchanged. This prevents cross-site browser form/fetch writes; it does not authenticate LAN programs that can forge headers.

Use explicit server configuration `NAME_THAT_MATCH_UI_ORIGINS` (comma-separated validated HTTP origins, no wildcards). Default production origins are `http://localhost:3001` and `http://127.0.0.1:3001`; configured nondefault host/port and LAN origins must be documented/set deliberately. Development adds the local Vite origin explicitly in dev configuration, because proxy `changeOrigin` rewrites Host while the browser Origin remains port 5173. Never trust arbitrary Origin, Forwarded, or X-Forwarded-* values to extend the allowlist. Test localhost development, production, and configured laptop-IP tablet access. Do not introduce authentication or claim this boundary protects an untrusted LAN.

#### Managed image access

Look up committed screenshot IDs; derive final relative paths solely from stored generated references. Reject traversal, absolute paths, symlinks, and a resolved path outside the real configured managed directory; containment uses path-segment boundaries, not string-prefix alone. Open/read through a safe file handle and verify the exact bytes that will be served. Staging has no public image route; import preview uses candidate labels and browser-local previews. Use original-size image URLs with browser lazy loading; no generated thumbnails. Handle invalid API URL encoding/path syntax with structured errors before SPA fallback.

### D7. Review, eligibility, and concurrency

Classification inputs are nullable match obscurity `low|medium|high` and screenshot visual difficulty `easy|medium|hard`. Only the derived game-tier enum `squash|competitive|deathmatch` has 1/2/3 points, through the single classifier in D10. A rating has no standalone point value. Labels/definitions come from pure shared constants; UI/API modules never recreate the lookup table.

Any review state can explicitly become pending/rejected. Approval requires every eligibility prerequisite except already being approved, including both classification inputs and current screenshot/parent revisions. Keep separate edit/review payloads: a material edit cannot simultaneously approve. No bulk rating/review/deletion is exposed.

| Actual saved change | Result |
|---|---|
| Screenshot visual difficulty, including null | If approved, pending; increment changed screenshot revision once; derive its tier from current parent |
| Screenshot association, including null | If approved, pending; increment once; derive from the new parent or return unclassified |
| Match participants/promotion/event/date/stipulation/championship information | Atomic parent write and resets/revision increments of associated approved screenshots |
| Match obscurity, including null | Increment parent revision only; keep screenshot input/review/revision untouched; all affected saved projections, counts and fresh pools use the new matrix result |
| Screenshot notes or match notes | Preserve review; increment only the edited changed record |
| Normalized no-op | Preserve timestamps/revisions/review after checking expected revisions |
| Asset disappears/corrupts/restores | Preserve review/history; reassess eligibility and image response |

Changing obscurity to unset can make an approved screenshot ineligible without clearing its review; restoring a valid obscurity recalculates its tier/readiness without manual screenshot edits. Difficulty changes still require explicit reapproval. Match obscurity is not an answer field or an automatic approval action. An incomplete target can receive screenshots but cannot support approval. Date is optional for eligibility, although changing a saved date is a material answer edit.

Use existing short transactions/CAS revisions. Approval checks the current asset then rechecks screenshot and parent revisions in its immediate write transaction. Single/multi-assignment retain their current atomic checks. A concurrent parent obscurity change advances its revision so stale approval/assignment conflicts even though child rows were not rewritten. Keep independent notes/difficulty/match/assignment drafts and existing deliberate conflict reconciliation.

Fixed blocker order: (1) `image_missing` or `image_corrupt`; (2) `unassigned`, or missing parent participant/promotion/event reasons; (3) `obscurity_unset` for an associated parent, then `unrated` visual difficulty; (4) `pending_review` or `rejected_review`. Unassigned content does not fabricate missing-parent-field/obscurity blockers; it is still unclassified and can independently be unrated. Storage I/O uncertainty is 503, not an image-missing claim or fabricated zero pool. Eligibility is true only with no blockers. Classification completion uses only valid association plus the two inputs; it does not require approval, identifying completeness or asset availability.

Read a coherent record snapshot, assess each relevant owned image once per response and derive projection/card/global counts from that same observation. No permanent import-time availability cache or stored tier is authoritative. External file changes can affect the next response; SQL and filesystem observations are not one atomic transaction. Preserve bounded reads and original-byte integrity checks. UI derived values describe saved server records, not an unsaved local draft; refresh affected cards/screenshots/statistics after successful writes without discarding other drafts.

### D8. Browsing, inspector, and presentation

Desktop: retain header/navigation and a readable navigation/filter column, central match grid or unassigned screenshot grid, and inspector where already useful; keep the delivered compact card/dashboard composition. Add a small search/filter toolbar and wrapping statistics strip, not a decorative new layout. Activate Image Library without changing unrelated Play/Settings behavior; existing System status remains reachable. Default library view is Matches. Empty library points to Import Captures and Create Match. Initial selected match/screenshot is explicit, not silently switched while a draft is dirty.

Match cards display all ML-07 fields, with em-dash/Unknown labels for unset values and explicit incomplete badges. Total/approved/eligible/awaiting-classification counts cover all committed associated screenshots, independent of filters. Identification incompleteness and classification incompleteness are separate. Selecting a card opens a separately titled collection containing only its screenshots matching the active difficulty/review/tier groups. Match-level search/obscurity/incomplete filters select cards but are not sent as screenshot query parameters. The client forwards only the three screenshot filter groups to the existing GET /api/screenshots endpoint with matchId, reusing its runtime validation, current classification and same-row AND/OR behavior. Match metadata opens only through an explicit Edit match details action; selecting a card does not automatically open the metadata form. Result cards and the selected collection are separate browsing contexts, with Back to match results retaining filters. Changing filters returns to results and clears the previous collection/edit/selection context only after Save/Discard/Stay protection for all dirty drafts. The collection shows “Showing N of M screenshots”, with M taken from the authoritative full-match summary. Thumbnails, sequential navigation and Select all use the returned subset. Without screenshot filters all images are shown. Saved edits refresh the subset; if the current saved image no longer matches, the existing inspector moves to an available matching neighbor or closes while preserving independent dirty drafts. If no images match, show an explicit filtered-empty state and keep filters. If the selected match drops out of the filtered match list after an edit, retrieve its unfiltered summary to keep metadata and full counts current. This interaction clarification follows manual-review feedback on 2026-11-08. Do not add large card covers simply to imitate the comp; keep cards compact and open their existing associated screenshot collection. Original-size lazy images stay in the collection/inspector. Do not implement manual cover selection, grid/list toggles, trash, promotions management, or example comp counts as data.

Unassigned view supports user-selectable source-video grouping using preserved titles/IDs strictly as provenance labels; grouping never creates matches or assigns screenshots. It offers selection, individual assignment/review, bounded multi-selection assignment to one existing match, and Create Match followed by explicit assignment. Store view-specific filters independently: participant/promotion/event search, obscurity, identifying-incomplete and classification-incomplete filters apply only to Matches and are not invisibly applied to unassigned captures. Visual difficulty and review apply in either view; tier filtering uses calculated saved classifications and cannot make unassigned content eligible. Return-to-queue retains filters and moves to an available neighbor after a successful assignment, unless a draft requires confirmation.

Search normalizes NFC and Unicode lowercase, then matches a literal substring in participant description, promotion, or event (OR across fields). Register a small deterministic SQLite normalization function using JavaScript text normalization; use bound query parameters and literal substring logic so `%`/`_` are not wildcards. Do not remove accents, tokenize/stem, call external services, or add full-text indexes. Filters: OR within each nonempty group, AND across groups/search/incomplete. Query sentinels `unset` for obscurity and `unrated` for visual difficulty represent null, not extra stored categories. Screenshot difficulty plus review filters use one correlated EXISTS over the same associated row. No screenshot filter means zero-screenshot matches remain visible; an active screenshot filter excludes them. Identifying incomplete means at least one of the three required identity fields is absent. Classification incomplete means parent obscurity unset, no associated screenshots, or any associated screenshot visually unrated. `tier` values use calculated tiers (or `unclassified` for null); do not duplicate the matrix in SQL CASE expressions. Filter derived tiers after the shared projection using the same screenshot as other active screenshot predicates.

Sort matches `created_at DESC, id ASC`; sort unassigned and match screenshots `captured_at ASC, id ASC`; sort video groups by video ID with screenshots in that order. No implicit order by obscurity/difficulty/eligibility, and no pagination/virtualization framework. Filtered result count is separate from each card's full association counts. Results and counts refresh after successful writes or a deliberate reload; no background polling is required for library editing. Import progress alone polls while active and stops on completion, dialog closure, or disconnection with resume guidance.

#### Component responsibilities

| Component | Responsibility |
|---|---|
| `MatchLibraryPage` | View, selection, request state, refresh, draft-navigation guard |
| `LibraryNavigation`, `LibraryFilters` | Matches/unassigned, explicit query state, reset actions |
| `MatchGrid`, `MatchCard` | Data presentation, selection, counts/incomplete labels |
| `MatchInspector` | Explicit new/edit match draft, field errors, independent Save/Cancel |
| `ScreenshotPreview`, `ScreenshotThumbnailStrip` | Contained image, provenance, selected screenshot, next/previous navigation |
| `ScreenshotReviewControls` | Independent Easy/Medium/Hard difficulty/notes draft, assignment, explicit review and blockers; read-only saved game tier/points |
| `LibraryStatistics` | Compact labeled global counts from the statistics API; never theoretical quotas or filtered-card counts |
| `ImportDialog` | Device-local selection, upload/validation state, duplicate decisions, confirmation, progress/results, retry/recent-batch access |

These are responsibility boundaries; combine trivial wrappers instead of inventing component layers. Keep network helpers small and prevent stale responses from changing a newer selection using request cancellation/identity checks. Match and screenshot drafts have separate dirty flags and revisions. Save errors/conflicts preserve text. Selection, primary view, inspector closure, or in-app navigation that would discard drafts offers Save/Discard/Stay; failed save stays. Browser close/reload gets the platform unsaved-work prompt where supported; a web app cannot guarantee recovery after force-close. Do not introduce persistent draft storage or imply that guarantee.

#### Responsive CSS and accessibility

Use existing `client/src/styles/tokens.css` colors, spacing, typography, focus, and motion foundations. Add only required component CSS Modules and semantic tokens if repeated component values demonstrate a need. Dark/black surfaces, yellow primary actions, purple framing, readable labels, and success/error text/icons follow the comp; editorial controls take priority over glow effects. No Tailwind, utility framework, remote assets/fonts, excessive inline styles, or unrelated global changes.

At widths where three columns no longer fit (initial component breakpoint 1100 CSS px), show browsing with collapsible filters and open the inspector in a dedicated view/panel with a Back control. At 768px tablet width the layout must not overflow or compress three columns. Large image view uses contain and intrinsic dimensions, never crop; inspect at least the observed 476×360 and 1920×1080 examples. Use at least 44×44 CSS px touch targets for primary actions/navigation.

Semantic headings/forms/labels/buttons, real selection controls, visible focus, and text/icons in addition to color are required. Thumbnail controls have descriptive accessible names, selected state, and keyboard activation. Import dialog traps focus, is dismissible while retaining resumable server progress, and returns focus to its trigger; Save/Discard/Stay is also keyboard-operable. Inspector view changes move focus to its heading/Back control and return focus to the selected card on exit. Field errors are associated with inputs and announced; import/save state uses restrained polite announcements, failures alert, and repeated progress updates do not flood screen readers. Reduced motion removes nonessential transitions; no arena animation is needed. Studio laptop and Road laptop/tablet use the same administrative components/classifier at their viewport widths; this does not implement contestant displays or synchronization. Keep capture IDs/full UTC timestamps/source titles in secondary provenance rather than dominate every card; derived tier labels/points and unclassified reasons remain primary in the selected image view.

### D9. Migrations, verification, and milestone dependencies

Keep historical migration 1 intact. After approval, add the ordered schema-1-to-2 enum migration in D10; fresh foundation stores run 0->1->2. Repeated current opens are no-ops; unknown/newer schemas and failed upgrades reject startup with connection cleanup, without database recreation. Keep WAL/NORMAL/foreign keys, configured storage paths, stopped-writer backups and durable import recovery before readiness.

Completed milestones 1–4.7 remain legacy implementation history, with their original categories. The request named Milestone 4 now proposes a classification continuation at task 4.8 onward. Previously pending screenshot-review and minimal browsing work is consolidated into that continuation, avoiding duplicate implementation tasks or a second change for the same library. Placeholder milestone-5/6 headings explain that consolidation; opt-in real-collection acceptance remains group 7 and needs separate approval. A matrix approval is not approval to implement the plan or run real-collection acceptance.

Every approval group ends in evidence and a review gate. No live gameplay, random-selection API/UI, game sessions, score events or synchronization are included. Full gameplay requires a later change. Do not archive until implementation/acceptance are complete and archive is requested.

#### Verification contract

Use existing tests/helpers, temporary storage, allocated ports, environment restoration, and closed handles. Ordinary tests must not discover/use Downloads or initialize real application data. A representative independently authored v1 JSON plus a tiny valid PNG fixture is sufficient in source control; do not commit SQLite data or bulk real footage. Producer compatibility is checked against its documented contract, not runtime imports from that repo. Fake browser File objects cover folder context and multiple-file fallback; real browser acceptance verifies picker behavior.

Fault injection must cover writes interrupted during upload, final copy, and SQL commit both before/after transaction completion, server restart, duplicate races, changed preview, idempotent replay, failed retry, original checksums, unsafe path/symlink attempts, cleanup ownership, and no uncommitted-image exposure. Repositories cover constraints/revisions, partial dates, incomplete drafts, cross-video associations and multi-assignment rollback. Review tests are a table of every material/editorial field and all eligibility reasons; counters use the same fixtures. HTTP covers all documented statuses, bounded bodies, origin/preflight policies, configured dev/LAN origins, and missing routes before SPA fallback. UI interactions cover every primary flow, dirty drafts/conflicts, no results/loading/errors, keyboard focus and tablet behavior.

Run relevant focused tests while implementing; at each milestone checkpoint run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `openspec validate match-library-mvp --type change --strict`, and `openspec validate --all --strict`. Do not repeatedly rerun checks without a changed implementation or unresolved failure. Audit Git tracking after build/tests for generated output, staging, runtime databases and sidecars. The foundation delta remains a delta until intentionally synchronized during implementation completion/archive; no current capability is rewritten in this planning task.

#### Optional real-collection acceptance (Milestone 7)

1. Select a newly created disposable application data root; back up real application data separately if needed, and never point this check at it. Capture a read-only inventory and checksums of selected original PNG/JSON files. Record actual current pair/duplicate counts rather than assume the prior 60/59 sample remains unchanged.
2. Build and start production using that disposable root. Select the real source through the laptop browser. Verify supported sources, scan/progress, limits, ignored files, exact pairing, preview and default duplicate choices. Confirm valid candidates, inspect per-item outcomes and pending/unassigned/unrated defaults; verify every original name/checksum remains unchanged.
3. Reimport the selection and explicitly keep an identical-image/different-ID candidate in a controlled trial. Verify existing identities remain stable, duplicates/conflicts behave as specified, and no auto-created matches appear.
4. Create drafts/identified matches; test screenshots from one video split across matches and screenshots from different videos sharing one match; multi-assign, reassign, unrate, approve/reject, change each answer/editorial field, and inspect eligibility/count changes. Test unsaved edits and stale edits in two tabs/devices.
5. Stop/restart after import and after controlled interruption of a disposable confirmation; verify reconciliation/idempotent retry, partial results and persistence, missing/corrupt image diagnostics on disposable copies, and no incomplete image exposure. Recheck original checksums.
6. Verify 768px tablet and desktop layouts, keyboard/focus/announcements, all observed aspect ratios, and local operation with external internet disabled while maintaining local server access. Record actual device/browser and limitations; do not claim TV/tablet or offline checks that were not performed.
7. Stop all processes, review results, and clean only the owned disposable destination. Retain evidence and the original collection. Update README/current docs with workflows, limits, recovery, trusted LAN, and backups. Stop for final review; no automatic archiving or next feature.

### D10. Proposed classification contract and schema-2 migration

The classifier accepts typed, runtime-validated `Obscurity | null` and `VisualDifficulty | null` and returns `{tier:GameTier,points:1|2|3}` or `{tier:null,points:null}` when either valid input is missing. Reject unsupported nonnull inputs even when the other input is null. Keep one exhaustive readonly lookup and a separate immutable game-tier/point-label constant. The exact table is SR-07: Low Easy/Medium -> squash, Low Hard -> competitive; all Medium -> competitive; High Easy -> competitive, High Medium/Hard -> deathmatch. Exhaustive tests assert all nine cells, points, missing values and invalid runtime inputs. No numerical obscurity, additional tiers or editability of calculated outputs.

Migration mapping approved by the user on 2026-11-08 with the revised proposal/design:

| Schema-1 input | Schema-2 input |
|---|---|
| Match `iconic` / `familiar` / `obscure` | `low` / `medium` / `high` respectively |
| Screenshot `squash` / `competitive` / `deathmatch` | visual `easy` / `medium` / `hard` respectively |
| Either unset | remains null |

This maps the prior qualitative order, not the old fixed points. A mapped screenshot can land in a different game tier under the new matrix (for example, legacy deathmatch + iconic becomes Hard + Low -> Competitive/2). Do not silently claim old tier/score equivalence. Preserve IDs, associations, immutable raw capture JSON/provenance, file/hash references, creation times, review values and all import rows/receipts. No PNG copies/moves/transforms or source writes. Bump revision and updatedAt only on rows whose nonnull classification value changes, rejecting revision overflow safely; do not rewrite child screenshots merely because the parent value is mapped. Retained approval never bypasses new obscurity/eligibility checks.

CHECK enum changes require a standard SQLite table rebuild. Plan it before code: take a verified stopped-writer whole-root backup; capture/disable foreign-key enforcement only on the startup migration connection and outside BEGIN, then rebuild/copy/map the affected tables, preserving dependent references (including import result links), all indexes/uniqueness/STRICT constraints and rows. Run `foreign_key_check` inside the transaction before setting user_version=2/commit; restore and verify enforcement afterward. A transaction-time `PRAGMA foreign_keys=OFF` has no effect and is not an acceptable shortcut. Roll back on copy/check/injected failure and close failed startup connections; never delete/replace data to force an upgrade. Tests cover populated import receipts/result links, repeated/fresh/foundation opens, null/mapped rows, integrity/FKs, unsupported newer versions and failures at rebuild boundaries. Review flags are preserved; their new eligibility is derived, not assumed.

New writes use only canonical schema-2 input values. Reject legacy values in API mutations after upgrade rather than maintain two ambiguous vocabularies. Old open editors must reload/reconcile; mapped-row revisions and current parent checks prevent silent stale writes. Update current docs and AGENTS.md during approved implementation; retain prior verification records and completed checked tasks as historical evidence. Downgrade uses a verified pre-upgrade backup with compatible code in a separate root, never in-place reverse guessing.

Alternatives rejected: keeping old tier names as new visual-difficulty storage hides the distinction; persisting a derived tier risks stale data; resetting all ratings discards existing work; a second parallel library implementation duplicates state and workflows. If the proposed legacy mapping is rejected at review, change this migration plan before any implementation, not silently during apply.

### D11. Statistics, minimal browsing and future selection support

Extend the existing native dispatcher with `GET /api/library/statistics` (no query parameters), envelope `{data:LibraryStatistics}` and existing error/origin/cache policy. Fields: `totalMatches`, `totalScreenshots`, `fullyClassifiedScreenshots`, `awaitingClassificationScreenshots`, `classifiedByTier:{squash,competitive,deathmatch}`, `eligibleByTier:{squash,competitive,deathmatch}`, `asOf`. All counts are nonnegative integers; classifiedByTier sums to fullyClassified; awaiting equals total minus fullyClassified; eligibleByTier sums to at most fullyClassified. Count committed screenshots only, including rejected rows in totals. A fully classified row needs its match and both inputs; approval, identity completeness and asset readiness determine eligibility separately. Expected missing/corrupt files exclude eligibility while preserving classification. An uncertain asset assessment fails eligible statistics with 503 instead of reporting false zero counts. No percentages are required in the first UI; do not show theoretical 22.2/55.6/22.2 as actual distribution.

Global statistics are explicitly labeled Entire library and unaffected by current search/filters. Match card total/approved/eligible/awaiting counts describe full associations. Filtered matchedCount remains separate. Assess each committed asset once in a response-scoped observation keyed by screenshot identity/path; do not let equal hashes at different paths hide a missing file. Use existing snapshots and bounded file helpers, not a new ORM/cache/job layer. Test representative hundreds-of-match fixtures for correctness/operation bounds before proposing pagination, new indexes, thumbnails or virtualization. Backend per-response asset hashing is known technical debt to measure, not permission to make an unverified permanent availability cache.

Minimal controls: literal participant-description/promotion/event search already defined in D8 (the participant description supplies the displayed match name), Low/Medium/High/unset obscurity and identifying/classification incomplete filters, plus the previously specified screenshot visual difficulty/review/tier groups. Reuse current cards and selected-match navigation; no alternate CMS layout, grid/list toggle, promotional records or bulk review. Counterexample tests ensure difficulty/review/tier predicates refer to one screenshot.

Prepare eligible pools from a fresh server-assessed projection using shared classification and SR-05 gates. A pure pool filter takes the requested valid tier and authoritative records; a separate pure selector takes that pool and a supplied finite unit sample in [0,1), chooses floor(sample * pool.length), and returns null for an empty pool (invalid inputs are rejected). Future server callers may supply randomness and request fresh observations; no selection endpoint/button/session is added now. Uniform sampling is over eligible screenshots, with no category quotas, weighting, fallback to another tier or invented repeat-match policy. Tests exercise all nine cells, mixed readiness, empty pools, invalid samples, deterministic boundary samples and fresh membership after either input changes. Both future operating modes import these same shared rules; networking remains separate.

Future host scoring contract: the host interprets verbal wrestler/match identification; event/year are not required for basic correctness despite being useful/required library identity metadata. The host may ask surprise event/year questions or award discretionary bonuses in later gameplay, but none modifies the matrix/base 1/2/3 points. Do not implement answer comparison, bonus calculation, score storage, game selection UI or a full gameplay interface in this continuation.

## Risks / Trade-offs

- Native upload/PNG parsing must be bounded and correct → stream byte limits, validate CRC/structure/inflation, explicitly reject unsupported encoding, and use adversarial fixtures; request approval if a future dependency becomes necessary rather than silently adding one.
- Separate filesystem/SQL commits can leave partial destinations → durable ownership/intent, exclusive final creation, reconciliation/quarantine, no exposure before commit, and fault injection at every boundary.
- Same-origin controls do not authenticate malicious LAN clients → custom header/origin checks protect browser cross-site writes only; explicit trusted-LAN configuration/documentation, no unapproved authentication system.
- Origin allowlists can break Vite proxy or tablet use → documented exact UI origin configuration and integration checks for ports/hosts.
- Captures can have byte-identical images with different provenance → nonunique hash index, explicit retention, no automatic match identity or silent overwrite.
- Enum renaming can change derived points and invalidate old clients -> explicit reviewed mapping, schema-2 transaction/FK checks, backups, mapped-row revisions, legacy-input rejection and no claim of score preservation.
- Per-response asset validation reads more bytes than cached thumbnails → low concurrency/bounded reads are acceptable for the observed collection; measure growth before adding caches/thumbnail infrastructure.
- Preview state can become stale through other imports/editors → preview token, duplicate recheck, record revisions, and clear refreshed decisions.
- Confirmed failed staging can consume disk → expose retained state/usage, clean proven-owned completed/unconfirmed-expired staging, and document stopped-server maintenance rather than broad deletion.
- Flexible participant text is less structured for future wrestler filtering → fulfills the approved MVP; preserve manual descriptions and defer normalization until a separate approved need.
- Browser directory support and close prompts vary → multiple-file fallback, explicit device-local explanation, in-app dirty guards, actual tablet/manual verification, no unsupported force-close guarantee.

## Migration Plan

The planning-only revision and D10 mapping were approved on 2026-11-08 for tasks 4.8–4.25. Update durable/current documentation, require a consistent stopped-writer backup before upgrading existing operational data, verify classification/review/statistics/helpers and the complete import/management regression suite, and stop at the continuation review gate. See verification-classification-continuation.md for delivery evidence. Group 7 real-collection checks are a later opt-in approval. Do not rewrite existing captures, committed history or main capability specs during this planning task; do not archive now.

## Approval decisions and remaining risks

The matrix is supplied as approved product policy; explicit approval/complete metadata/valid-image gates were confirmed on 2026-11-08. Parent obscurity changes preserve screenshot input/review/revision while changing derived tier/readiness, consistent with no manual per-image updates. The migration ordinal mapping, task consolidation and minimal UI/API additions were approved with these artifacts on 2026-11-08. No blocking question is deferred into coding. Any different migration semantics or broader gameplay/UI requirement must update this plan before apply.

Manual-review count clarification (task 4.28): result cards lead with N matching screenshots of M total when screenshot filters are active. The server calculates matchingScreenshotCount from the same response observation and screenshot predicate used to qualify matches. Full-match approved/eligible/awaiting counters are explicitly labeled and global statistics remain unchanged.
