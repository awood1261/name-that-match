# Capture import engine

The server engine lives in `server/src/library/imports/`. Use `getImportEngine(storageSession)` to share coordination for a database connection. It accepts selection manifests and binary chunk streams; it cannot scan an arbitrary source directory. Milestone 3 exposes it through `/api/imports` and **Image Library → Import captures**, plus committed screenshot listing/images. Ordinary tests use authored fixtures and disposable data roots, never Downloads or the installed application dataset. See [README configuration](../README.md#configuration) for local Vite and trusted-LAN origins.

Programmatic sequence: `createBatch(manifest)`, await `uploadImage(batchId, itemId, chunks)` for each valid pair, `preview(batchId, currentRevision)`, `confirm(batchId, {requestId, previewToken, items})`, then await/catch `processBatch(batchId)`. Read `status(batchId)` for durable outcomes and effective limits. Confirmation records intent before processing. Reusing the same request UUID/body returns existing progress even during processing or after restart; changed decisions require a refreshed preview and new UUID. A confirmation is never inferred from staged bytes.

Run only **one server process per data root**. In-memory coordination belongs to that authority. Independent processes sharing the same staging directory are unsupported.

## Resource limits

All settings are optional positive safe integer environment variables, validated during storage initialization. Invalid values reject startup and release the database connection. Defaults:

| Environment variable | Default |
|---|---:|
| `NAME_THAT_MATCH_MAX_IMAGE_BYTES` | 33,554,432 (32 MiB) |
| `NAME_THAT_MATCH_MAX_IMAGE_PIXELS` | 16,777,216 |
| `NAME_THAT_MATCH_MAX_DECOMPRESSED_BYTES` | 83,886,080 (80 MiB) |
| `NAME_THAT_MATCH_MAX_METADATA_BYTES` | 65,536 (64 KiB) |
| `NAME_THAT_MATCH_MAX_JSON_BYTES` | 16,777,216 (16 MiB) |
| `NAME_THAT_MATCH_MAX_IMPORT_ITEMS` | 256 |
| `NAME_THAT_MATCH_MAX_BATCH_BYTES` | 1,073,741,824 (1 GiB) |
| `NAME_THAT_MATCH_MAX_UPLOADS` | 2 per batch |
| `NAME_THAT_MATCH_STAGING_RETENTION_DAYS` | 7 |

Selection manifests are also capped at 1,024 file descriptors. Metadata permits depth 32 and 8,192 JSON values, including inert preserved extra fields. Large sidecars may require smaller batches even below image limits. Changing limits can affect recovery of previously staged files; restore compatible limits before retrying them.

Only static, noninterlaced 8-bit RGB/RGBA PNGs are accepted. Validation checks chunk order, bounds, CRCs, complete zlib input, exact scanline length and filter types, dimensions, pixel and inflation limits, and terminal IEND. Unsupported encodings are reported explicitly. Uploads stream to owned `.part` files with declared-byte reservations and actual-byte enforcement. Validation processes one bounded image at a time; it does not decode a whole batch into memory. PNG bytes are never transformed.

## Identity, durability, and recovery

Capture identity is `(source platform, capture ID)`, independently of source video and editorial match identity. Metadata comparison ignores object-key order and JSON whitespace only; extra-field differences remain meaningful. Original JSON text and SHA-256 of original PNG bytes are preserved. Identical capture identity/content is a duplicate; changed identity content/provenance conflicts. Equal image bytes under distinct capture IDs default to skip and require explicit `keepDuplicate` for the current observed duplicate set. Similar-looking byte-distinct images are separate content.

Owned paths are generated from UUIDs under `staging/<batchId>/` and `screenshots/`. Original filenames are selection labels only. Managed writes reject traversal, links and nonregular files. Final files use exclusive creation, file flush/close and integrity checks. A short SQLite transaction inserts the screenshot and result together only after finalization. Imported screenshots start unassigned, unrated and pending; no match is created automatically.

Storage initialization reconciles persisted work after migrations and before listening. Interrupted uploads require re-upload; staged/validating/ready items are revalidated without confirmation. Confirmed/finalizing/finalized items retain their intended UUIDs. Valid owned finals are reused. Only a recorded, unreferenced partial final matching a prefix of its intact staged source can be quarantined before retry. Unexpected bytes are retained for review. Missing committed assets are not recreated by importing again. These guarantees cover process interruptions; the engine does not make filesystem operations and SQLite one atomic transaction or promise recovery from arbitrary disk corruption.

Results are disjoint imported/duplicate/skipped/failed counts plus remaining work; ignored files are counted separately. Item errors and batch storage/cleanup errors are sanitized. Storage-wide failures stop processing; startup rejects readiness when recovery cannot access storage. A malformed individual capture can fail while unrelated valid items complete. Retry after correcting storage, re-upload when requested, refresh preview, and use a new confirmation key. Successful results and immutable receipts remain intact. The dialog retains the same confirmation key/body when retrying a lost response. Recent imports restores durable status after closing/reopening; polling stops on completion, closure or disconnection. Re-select missing PNGs to resume uploads; corrected metadata belongs in a new batch. Browser-local preview URLs are revoked when replaced or closed. Server shutdown stops between item commits, leaving remaining intent for startup recovery.

## Staging retention and maintenance

Startup and idle operations expire inactive unconfirmed batches after the retention period. Expiry is persisted before cleanup, and restart resumes interrupted cleanup. Only recorded owned staging/partial paths are removed. Completed staging may be cleaned immediately. Result/provenance rows and committed screenshot files remain. Confirmed failed work is retained for retry and can consume disk space indefinitely.

The engine's read-only `maintenance()` returns retained staging bytes and unknown-entry diagnostics. Its scan stops at 4,096 entries and reports at most 20 unknown entries; `truncated` signals an incomplete scan. It does not follow directory links. Unknown files, including quarantined evidence, remain untouched. This is currently a programmatic diagnostic, not an administrative screen or cleanup utility.

For deliberately abandoned confirmed work:

1. Stop the server, watchers and all other writers. Follow the [consistent whole-data-root backup procedure](local-storage.md#backup-and-restore) before maintenance.
2. Inspect the exact batch/item rows in `import_batches` and `import_items`. Confirm that the work is abandoned, all paths are generated relative paths for those UUIDs, and the proposed cleanup is entirely within that batch's staging directory.
3. Check `screenshots.image_path` and the item's `result_screenshot_id`, `final_path`, `screenshot_id`, state and receipts. Verify that each proposed staging file has no committed screenshot reference. Preserve database rows, receipts and provenance. Never remove a committed asset or sweep `screenshots/`.
4. Remove only individually verified, abandoned owned staging bytes. Preserve unknown files or quarantine evidence until their ownership and purpose are understood. Never touch capture source directories. If a retained uncommitted item is used again, it will need its original PNG re-uploaded and a fresh preview/confirmation.
5. Restart and inspect durable status/maintenance diagnostics. Retain the backup. No automated deletion of screenshot records or generic cleanup utility is provided.

Focused verification: `npm test -- --run tests/imports tests/server/library-http.test.ts tests/client`. See the active change's milestone verification records for actual check results. The basic screenshot listing exposes committed metadata and current asset status. [Match management](match-management.md) adds explicit association endpoints; [classification and individual review](classification.md) add nullable visual ratings, derived tiers, eligibility and counts without changing capture metadata or import defaults.
