# Milestone 2 verification — Import validation and durability

Verified on 2026-11-06. Scope is tasks 2.1–2.10 only. Milestones 3–7 remain unimplemented and unchecked. The change remains active.

## Baseline

Before implementation, all eight Milestone 1 tasks were checked and the domain contracts, four-table migration, repositories and tests were inspected. Actual baseline checks passed: 101 tests across 12 files, typecheck, lint, build, and whole-project strict OpenSpec validation. No disposable-database manual script was required.

## Delivered files

| File | Responsibility |
|---|---|
| `server/src/library/imports/contracts.ts` | Internal import types, sanitized failures, fault checkpoints |
| `server/src/library/imports/limits.ts` | Defaults and startup-validated environment settings |
| `server/src/library/imports/capture-validation.ts` | App-owned v1 validation, canonical metadata comparison, SHA-256 |
| `server/src/library/imports/manifest.ts` | Safe relative selection descriptors, exact pairing, ignored files and reservations |
| `server/src/library/imports/png.ts` | Bounded static RGB/RGBA PNG validation |
| `server/src/library/imports/files.ts` | Managed file ownership, exclusive writes, bounded reads and maintenance inventory |
| `server/src/library/imports/persistence.ts` | Batch/item persistence, state transitions and result summaries |
| `server/src/library/imports/duplicates.ts` | Identity and exact-image preview classification |
| `server/src/library/imports/processor.ts` | Validation, finalization, transactional screenshot commit and per-item recovery |
| `server/src/library/imports/engine.ts` | Streaming uploads, previews, receipts, coordination, expiry and startup reconciliation |
| `server/src/storage.ts` | Reconciliation after migrations, before returning ready storage |
| `tests/fixtures/captures/sample.json`, `sample.png`, `README.md` | Independently authored v1/tiny PNG fixture and provenance |
| `tests/imports/fixtures.ts` | Controlled in-memory fixture variants |
| `tests/imports/validation.test.ts` | 48 validation/resource-policy tests |
| `tests/imports/engine.test.ts` | 36 persistence, duplication, interruption, retry and cleanup tests |
| `docs/import-engine.md` | Programmatic sequence, limits, PNG policy, recovery and stopped-server maintenance |
| `docs/local-storage.md` | Current schema/staging overview and engine-documentation link |
| `openspec/changes/match-library-mvp/tasks.md` | Only Milestone 2 completion tracking added |
| This file | Verification evidence and limits |

No schema migration, dependency, HTTP route, React screen, gameplay, WebSocket or extension change was added. The existing four tables and Milestone 1 screenshot insert operation are reused. No real capture collection or normal application dataset was imported.

## Automated coverage

- Metadata: supported v1 shape, absent/present optional title, required fields, source/video/URL agreement, safe capture identity and filenames, UTC capture/playback values, immutable extra fields, JSON size/depth/value bounds and inert prototype-like keys.
- Selection: parent/video/flat contexts, exact same-directory pairs, missing/ambiguous/renamed pairs, traversal/absolute/drive/backslash/NUL rejection, ignored extras, manifest/item/image/batch reservations and actual upload lengths.
- PNG: independently authored RGBA fixture, RGB variant, independent CRC vector, signatures/chunk bounds/order/CRCs, contiguous IDAT and terminal IEND, complete compressed stream, scanline length/filter types, dimensions, byte/pixel/inflation caps and unsupported encodings.
- Duplicates: existing and same-batch identities, changed bytes/provenance/extra fields, reordered keys/JSON whitespace, equal image hashes under distinct IDs, default skip and explicit keep, byte-distinct images, changed preview/duplicate sets and overlapping batches.
- Durable workflow: no screenshot before confirmation, raw JSON preservation, generated paths, pending/unrated/unassigned defaults, no inferred matches, revision/preview checks, receipt replay during processing/after restart, changed-body conflict, stable reserved screenshot IDs and disjoint partial-result counts.
- Interruption checkpoints: after durable confirmation; after writing `.part`; after staging rename; during validation; after recording finalizing; during partial final copy; after final-file flush; after finalized; before SQL commit; after screenshot insertion inside the transaction; after commit; after durable expiry before cleanup.
- Recovery: actual SQLite trigger-induced insert failure rolls back; startup completes intact persisted intent; owned partial final is quarantined; missing staged/both managed copies request re-upload; missing committed asset is not recreated; unexpected files/links are preserved; cleanup failure preserves committed results and retries at restart; invalid configuration and storage-wide recovery failure reject startup; ENOSPC stops processing with sanitized diagnostics.
- Resource/source preservation: temporary roots and connection cleanup, two-upload cap/overlap locks, active/confirmed retention, resumed expired cleanup, unknown-file/link diagnostics without following them, and original fixture-pair SHA-256/name comparison before and after import.

## Actual final commands

| Check | Result |
|---|---|
| `npm test` | PASS — 185 tests, 14 files (101 existing + 84 import tests) |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS — zero warnings |
| `npm run build` | PASS — Vite client and TypeScript server |
| `openspec validate match-library-mvp --strict` | PASS |
| `openspec validate --all --strict` | PASS — 2 items, zero failures |
| `git diff --check` | PASS |
| Tracked artifact/database audit | No tracked `build/`, `dist/`, `data/`, `*.sqlite*` or `*.db` files |
| Ignore audit | `dist/index.html`, `build/server/src/index.js`, `data/library.sqlite` ignored |

During development, tests caught cross-realm Buffer validation, nonretryable upload-size failures, active confirmation replay and interrupted-expiry cleanup gaps; these were corrected and rerun. A test used an API outside the current TypeScript library target; the compatible replacement passed final typecheck/build. No failing final checks remain.

## Limits and review gate

No approved-behavior deviation was required. Only one server process may own a data root. Confirmed failed work and quarantine evidence can retain disk space; the bounded maintenance diagnostic and stopped-server procedure document handling. Resource limits bound individual synchronous PNG validation; arbitrary power loss/disk corruption cannot make disk and SQL atomic. HTTP/UI validation, browser/device checks and opt-in real-collection acceptance belong to later milestones and were not performed or claimed here.

For a focused repeat, run `npm test -- --run tests/imports`. This creates only disposable test storage; there is no new browser interaction to test at this milestone. Stop for review before Milestone 3; do not archive.
