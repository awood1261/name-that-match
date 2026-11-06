## 1. Isolate existing foundation tests

- [x] 1.1 Give every server/storage test a uniquely owned temporary data root, explicitly pass it to initialization, and restore environment overrides with Vitest tooling; verify tests leave a sentinel operator-data directory unchanged and restore pre-existing environment values.
- [x] 1.2 Replace fixed healthy-server ports with loopback port `0` and derive URLs from the bound address; verify health and production integration tests pass without relying on ports 3456 or 3567.
- [x] 1.3 Track and close every SQLite session, including both repeated-initialization sessions, and close servers before removing temporary roots even when setup/assertions fail; verify captured handles are closed, sockets stop listening, and owned directories are removed in controlled failure cases.

## 2. Harden startup and storage lifecycle

- [x] 2.1 Settle `startServer()` on listening or emitted/synchronous failure, removing startup-only listeners afterward; verify a blocker server on an OS-assigned port causes bounded rejection with `EADDRINUSE`, while successful port-0 startup resolves to a listening server.
- [x] 2.2 Guard storage release across failed startup and normal closure, and close database handles if post-open initialization fails; verify mocked configuration failure, synchronous listen failure, emitted listen failure, and normal closure release acquired handles without duplicate-close errors.
- [x] 2.3 Catch executable startup rejection and report an unsuccessful exit without an unhandled rejection; verify child-process failure checks for both occupied-port and invalid-storage startup terminate within a bounded deadline, with temporary roots and all blocker/child resources cleaned up.
- [x] 2.4 Preserve successful startup, configuration defaults, error reporting, and existing request behavior; verify start/close integration tests, actual allocated-port reporting, both `/health` and `/api/health` payloads, and production HTML/JavaScript content types and bodies at one origin.

## 3. Stop tracking generated output and protect local data

- [x] 3.1 Add `/build/` and SQLite main/sidecar ignore rules while retaining existing exclusions; verify `git check-ignore --no-index` covers build output, default data, and representative database/WAL/SHM/journal files under an in-repository override.
- [x] 3.2 Inspect the six tracked compiler outputs and remove only those entries from the index with working files retained; verify source files remain tracked, local outputs still exist, and no user data was deleted or modified.
- [x] 3.3 After a production build, audit `git ls-files` for `build/`, `dist/`, `data/`, and SQLite main/sidecar patterns across all paths; verify no matching generated/runtime files are tracked and no generated output appears as new untracked files.

## 4. Reconcile current specifications and documentation

- [x] 4.1 Apply the complete modified/added requirement blocks from this delta to the current `application-foundation` capability and replace its placeholder Purpose with the text in design decision 4; verify all prior scenarios remain and `openspec validate application-foundation --type spec --strict` passes without warnings.
- [x] 4.2 Update README validation instructions for current capabilities versus active changes using the installed CLI; verify both documented commands execute successfully in the implemented state.
- [x] 4.3 Add and link `docs/foundation-review.md` with full filenames for all eight comps and explicit corrections to archived directory, contract-scope, and verification descriptions; verify the inventory against images, distinguish administrative/contestant references, and confirm no archived files changed.
- [x] 4.4 Replace vague backup guidance with the stopped-writer backup/restore procedure in `docs/local-storage.md` and link it from README; review it against SQLite's official WAL/backup guidance and verify it addresses writer shutdown, sidecar preservation, screenshots, incomplete copies, separate restore roots, integrity checks, and the absence of live-backup support.
- [x] 4.5 Rehearse the documented copy/restore procedure using only a disposable WAL database and screenshot fixture; verify committed fixture content, `PRAGMA integrity_check`, matching screenshot checksums, and preservation of the original fixture. Record results without implementing a backup utility or using installed user data.

## 5. Complete integrated verification and report

- [x] 5.1 Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`; record actual results, including lifecycle, cleanup, SQLite, health, and static-serving coverage, and do not claim browser/disconnected-network verification unless performed.
- [x] 5.2 Run `openspec validate foundation-hardening --type change --strict` and `openspec validate --all --strict`; verify both pass after current-capability synchronization and record output.
- [x] 5.3 Smoke-test the compiled production entry point after building with a temporary data root and a verified available loopback endpoint; verify local HTML/assets and health responses, stop the process, clean only owned resources, and repeat the tracking audit after checks.
- [x] 5.4 Review the final diff for focused scope, preserved sources/data, and untouched archive; report files, behavior, task evidence, deviations, and remaining verification limits. Stop for review without starting Match Library or archiving this change.
