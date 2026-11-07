# Milestone 3 verification — Import API and interface

Verified 2026-11-06. Scope: tasks 3.1–3.8 only. Milestones 1–2 were committed at the start; the baseline suite was rerun and passed all 185 tests. The working tree was clean before implementation. No change is archived and no Milestone 4–7 task is completed.

## Delivered behavior

- Native HTTP import create/upload/preview/confirm/status/recent endpoints, bounded literal JSON/binary readers, UUID/revision/query validation and sanitized errors before SPA fallback. Effective limits, classification counts, ignored files and disjoint outcomes are public; managed disk paths are not.
- Mutation header and exact configured-origin protection, including uploads and rejected preflights. Defaults explicitly include local Vite origins in development and port-3001 loopback origins in production. Invalid configuration rejects startup before storage acquisition. Health CORS is preserved.
- Confirmation returns recorded intent and schedules an import-specific asynchronous loop. Replays retain the original key/body/results. Shutdown stops between item commits before SQLite closes; remaining confirmed intent recovers at startup. No generic queue or worker framework was added.
- Minimal committed screenshot listing (unassigned/match, difficulty and review predicates), deterministic ordering, current asset status and safe ID-based GET/HEAD image serving. Exact PNG bytes/hash/dimensions are checked before serving, with no-store/nosniff headers. Missing, substituted, corrupt and linked assets return explicit errors without changing review state. This milestone intentionally supplies the basic read projection from D9; match editing, review and full eligibility projections remain in later milestones.
- Image Library navigation alongside System status, folder/multiple-file inputs, device-local explanation, literal UTF-8 metadata preservation, streaming File uploads, validation preview, individual duplicate choices and explicit confirmation. Browser-local previews are shown only for validated ready items and object URLs are revoked on replacement/closure.
- Durable progress/results, same-request retry after lost response, recent-batch resume, missing-file re-selection, failed-item retry, stopped polling on completion/disconnection/closure, and navigation into the basic unassigned queue. Imports remain unassigned, unrated and pending. No matches are inferred.
- CSS Modules and existing tokens, semantic controls, visible focus, native dialog/focus trap/Escape dismissal/focus return, status/error announcements, contained images and usable tablet layout. Confirmation UUIDs use getRandomValues so configured HTTP LAN origins do not depend on secure-context-only randomUUID.

## File inventory

New:

- `shared/src/imports.ts`: browser-safe HTTP contracts and the milestone's minimal committed screenshot projection.
- `server/src/library/http/protocol.ts`: request/body/media/origin policy and structured errors.
- `server/src/library/http/dispatcher.ts`: import/read routes and bounded lifecycle coordination.
- `server/src/library/assets.ts`: committed asset validation and basic screenshot queries/projections.
- `client/src/library/api.ts`: small fetch helpers and confirmation IDs.
- `client/src/library/selection.ts`: folder/flat manifest construction and exact UTF-8 sidecar reading.
- `client/src/library/ImportDialog.tsx`: import selection, decisions, progress and resume.
- `client/src/library/MatchLibraryPage.tsx`: basic unassigned queue and request lifecycle.
- `client/src/library/Library.module.css`: component styling and responsive containment.
- `tests/server/library-http.test.ts`: 36 API integration cases.
- `tests/client/library.test.tsx`: 16 scanner/dialog/queue interaction cases.
- This verification record.

Modified:

- `server/src/index.ts`: configured origins and library dispatch before SPA; shutdown coordination.
- `server/src/library/imports/engine.ts`: optional shutdown signal, checked between commits.
- `client/src/App.tsx`, `App.module.css`: Image Library/System navigation, current state and 44px targets.
- `tests/client/App.test.tsx`: navigation verification.
- `tests/imports/engine.test.ts`: shutdown/remaining-intent recovery verification.
- `README.md`, `docs/import-engine.md`, `docs/local-storage.md`: delivered flow, origins, storage and recovery guidance.
- `openspec/changes/match-library-mvp/tasks.md`: only Milestone 3 completion tracking added.

No dependencies, migrations, extension files, original captures, gameplay, WebSockets, new framework or utility CSS were introduced. Ordinary tests use fixtures and owned temporary roots; the original collection was not imported.

## Automated checks

| Command/check | Actual result |
|---|---|
| Baseline `npm test` | PASS — 185 tests / 14 files |
| `npm test -- --silent` | PASS — 239 tests / 16 files (54 additional cases) |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS — zero warnings |
| `npm run build` | PASS — Vite client and compiled Node server |
| `openspec validate match-library-mvp --strict` | PASS |
| `openspec validate --all --strict` | PASS — 2 items / zero failures |
| `git diff --check` | PASS |
| Artifact/dependency audit | No tracked build output/local database files; package manifests/lock unchanged |

API verification covers every applicable D6 status (400, 403, 404, 405 with Allow, 409, 410, 413, 415, 422, 500, 503), malformed requests/URLs, unknown/repeated queries, actual chunked limits, aborted upload recovery, missing mutation headers, foreign/null origins and preflights, development/LAN origins and spoofed forwarding headers, no permissive library CORS, representative import, partial success, default duplicates/explicit keep, stale preview, receipt replay/changed-body conflict, confirmation-response interruption plus restart, recent-summary bounds/order, and committed-image headers/availability/containment.

Client verification covers folder/flat File selection, unchanged sidecar whitespace/Unicode/BOM and invalid UTF-8 rejection, no automatic confirmation, effective-limit display, invalid and ignored items, default skip/explicit keep, cached lost-response confirmation, resumed missing-file upload without another batch, progress completion/disconnection/unmount, dialog keyboard focus/cancel/return, object URL cleanup, queue loading/empty/error/image-failure states and reload/navigation. The shutdown test closes SQLite between committed items and confirms startup finishes remaining intent without duplicating results.

Development checks caught test-event compatibility, a final-status polling race and focus/dismissal gaps. They were corrected and the affected checks rerun; there are no outstanding failures.

## Actual Chrome verification

An automated headless Chrome run exercised the built production app and the actual Vite changeOrigin proxy, using disposable application storage and a separate browser profile. These were stopped/removed after verification; only screenshots and a JSON evidence report remain outside the repository:

`/var/folders/fz/n886xxg177nd7nkz0b56r_9h0000gn/T/ntm-m3-browser-bQoA7y/`

Observed:

- 1440px desktop: document width 1440px, no horizontal overflow; image object-fit contain.
- 768px tablet viewport: document width 768px, no horizontal overflow; dialog width 730px. Enabled primary navigation/actions measured 44px high.
- Initial focus Close; Shift+Tab wrap to Recent imports; Escape dismissed the dialog and focus returned to Import captures.
- Multiple-file input imported the authored pair only after confirmation; unassigned image loaded through its committed URL. Folder input retained `captures/sample.json` context and recognized the reimport as already imported.
- The actual development proxy successfully performed selection/upload/preview under its explicitly allowed browser origin, while Host was rewritten by changeOrigin.
- No nonlocal page dependency requests were observed. Original fixture PNG/JSON SHA-256 values matched before/after.
- JSON SHA-256: `f0b07d52aeeeb66e442bc65bfdc87ded2b6e46bae56c62ba324818ac1f15c04d`.
- PNG SHA-256: `6fe8b897998e41db82f635c2bc1ee3c552369debf7fe862f043f6c6feb2bb60b`.

This was real browser execution through CDP, not a hand-operated OS file picker or physical Android/Wi-Fi test. No physically disconnected-network, real-collection or full later-inspector acceptance is claimed. The final limits-details text additionally lists pixel, inflation and JSON request caps; the production build and focused UI checks cover that copy change.

## Review and repeat

For a disposable manual review, start development with a fresh root:

```bash
NAME_THAT_MATCH_DATA_DIR="$(mktemp -d)" npm run dev
```

Open `http://localhost:5173`, choose Image Library → Import captures, and select `tests/fixtures/captures/` or its PNG/JSON pair. Verify preview creates no queue entry, confirm, then View unassigned screenshots. Reimport to inspect default duplicate handling; close/reopen Recent imports to resume status; return to System. Stop the server before discarding only that disposable root. Source fixtures stay unchanged.

Remaining approved work is match management/assignments, individual review/eligibility, richer browsing/counts, full inspector responsiveness/accessibility and real-collection acceptance. Single-process-per-root and trusted-LAN restrictions remain; failed confirmed staging can retain disk space as documented. No approved-behavior deviation was needed. Stop for review before Milestone 4; do not archive.
