## Context

See `proposal.md` for motivation. Review of the current implementation confirms:

| Finding | Evidence and qualification |
|---|---|
| Listen failure can leave startup pending | `startServer()` supplies only a resolve callback. `createServer()` logs the emitted error and closes storage but cannot reject the startup promise. A pending promise alone need not keep Node alive; the confirmed defect is that callers waiting on it do not receive failure. |
| Rejected executable startup is unhandled | The entry point discards `startServer()` with `void`. Synchronous exceptions inside its promise executor already reject, but there is no entry-point catch. |
| Fixed-port tests and real data access | Health tests bind 3456 and call `createServer(port)` without a data override. Production tests bind 3567 but already use a temporary data root. |
| Incomplete cleanup | The second session in the repeated-initialization test is discarded, not closed. Other sessions close only after successful assertions. Production cleanup skips directory removal if server closure rejects. Environment cleanup deletes overrides rather than restoring previous values. |
| Partial initialization can retain a handle | Storage opens SQLite before executing pragmas; an exception during configuration has no local close path. The plan adds narrowly scoped failure cleanup, without changing database settings. |
| Generated files are tracked | Commit `bc18ea5` first adds six files under `build/`. `tsconfig.server.json` emits these JavaScript and source-map files; `.gitignore` omits `build/`. History establishes how they entered tracking, not the author's intent. Production instructions explicitly build before running. |
| Runtime databases are not tracked today | `git ls-files build data` lists only the six generated files. `data/` is already ignored, but a database under another in-repository override is not covered by a database-specific rule. |
| Current spec/documentation drift | Eight requirements use lowercase `shall`, producing strict-validation warnings; Purpose is a placeholder; README validates the archived change as an active change. Current storage uses `./data`, while archived design recommends `./data/local`. |
| Archived records need qualification, not rewriting | The proposal asks for broad domain contracts while design/tasks/current capability defer them. Checked tasks claim explicit offline coverage; current HTTP/static tests do not simulate disconnected operation, and the static test uses fixtures rather than the compiled executable. Some archived comp descriptions are wrong and omit the library comp. |
| Backup guidance is incomplete | Storage enables WAL. README/storage docs say to copy database and screenshots together but do not require stopped writers or preserve pending WAL content. They defer a consistent procedure; they do not explicitly claim that a live main-file copy is safe. |

No current documentation outside the archive provides a full comp inventory. Add one in current docs rather than editing the archived design. No source, current capability, README, or archive changes occur during this proposal phase.

## Goals / Non-Goals

**Goals:** Make failure delivery and resource ownership explicit inside existing functions; make foundation tests independent of installed data and fixed ports; make source tracking and operator guidance accurate.

**Non-Goals:** No new lifecycle framework, API endpoints, schemas, dependencies, backup utility, gameplay, library, WebSockets, styling, signal-management redesign, data migration, or change to successful request handling. Missing dedicated offline coverage is recorded accurately rather than expanding this change into a network-simulation project.

## Decisions

### 1. Settle startup on listening or failure

Keep the existing server factory and promise-returning start interface. Register one-shot startup listeners before `listen()`. Resolve only after listening; reject the original error for emitted listen failures or synchronous setup/listen exceptions. Remove startup-only listeners on settlement. Do not replace failure handling with a timeout or add retries.

Use one small, guarded storage-release path for failed starts and normal server `close` so the same connection is not closed twice. If storage initialization fails after opening a database, close that partially initialized handle before propagating the error. Keep the server's existing error reporting and shutdown semantics; avoid duplicate startup error messages where possible. The executable catches rejected startup, reports the failure, and sets an unsuccessful exit code after releasing owned resources rather than force-exiting before cleanup.

Preserve defaults (`127.0.0.1`, 3001, `./data`), environment support, and successful health/static behavior. Honor explicit programmatic port `0` for OS allocation, retain existing positional-port use, and do not broaden configuration precedence changes. Report the actual bound port when available. A general configuration API redesign or new graceful signal handling would expand scope and is rejected.

### 2. Give tests ownership of every resource

Use `mkdtemp` roots for every server/storage test. Pass `dataDir` explicitly even if operator environment variables point elsewhere. Bind loopback port `0`, then read `server.address()`; never reserve a port and release it before using it. A listen-failure test intentionally holds an OS-assigned port with a separate blocker server, then starts the subject on that port and expects `EADDRINUSE` within a bounded assertion.

Track resources as soon as they are acquired. Always close all acquired sessions and servers before removing their own temporary roots, including assertion failures and partial setup. Treat an unstarted server separately so teardown does not call `close()` as though it were listening. Use `try/finally` and existing Vitest environment/mock restoration; restore pre-existing values rather than deleting them. Small local test helpers are acceptable; a generalized fixture framework is not needed.

Test cleanup directly with a controlled failure inside an owned fixture: afterward assert the server is no longer listening, captured SQLite handles are closed, environment is restored, and the temporary root is gone. Do not rely on Unix allowing deletion of open database files as evidence of connection closure. A sentinel directory outside the fixture root proves operator data is untouched; never use real installed data as the test fixture.

### 3. Remove only generated index entries

Add a root-anchored `/build/` ignore rule and SQLite main/sidecar patterns (`*.sqlite`, `*.sqlite3`, `*.db` and corresponding `-wal`, `-shm`, `-journal` names). Preserve existing `dist` and `data/` exclusions. Inspect tracked paths before any index change. Remove the six verified generated entries using index-only removal, leaving their working files and all TypeScript sources intact. Do not delete local output or runtime data, and do not rewrite history.

Verify `git ls-files` contains no files under generated output roots or matching runtime database patterns. Check representative override database paths with `git check-ignore --no-index`. Rebuild and confirm output is recreated and ignored. Adding ignore rules alone cannot untrack existing entries; physically deleting files is unnecessary.

### 4. Correct current guidance and preserve historical records

The delta copies all eight existing requirements in full, capitalizes normative SHALL without dropping scenarios, and extends only relevant startup, backup, and verification behavior. During approved implementation, replace the main capability Purpose with: “Defines the minimal offline-first application shell, local server boundary, portable SQLite and screenshot storage, and verification conventions used before feature-specific library and gameplay changes.” Purpose is not represented by a delta operation, so apply it directly to the current capability at that stage. No main-spec edit is made during planning.

Update README to distinguish `openspec validate application-foundation --type spec --strict` from `openspec validate foundation-hardening --type change --strict` while the change is active. Use the installed CLI; do not require a network download for validation.

Add `docs/foundation-review.md`, linked from README, with the verified discrepancies above and this accurate inventory (use full filenames in the document):

| Filename prefix | Reference |
|---|---|
| `00CE997D` | Shuffling/selection progress |
| `122CF989` | Incorrect answer and reveal |
| `575F3CFE` | Challenge timer and centered 1080 × 960 reel-safe guidance |
| `5D88B9D9` | Correct answer and match details |
| `989C475C` | Screenshot difficulty selection and points |
| `9BD6879B` | Scoreboard |
| `CA849EE2` | Random-match placeholder and shuffle |
| `Neon Wrestling Match Library.png` | Administrative import, filtering, match editing, and screenshot review reference |

The first seven are contestant/game presentation references. Example counts, rankings, fields, and controls do not approve new functionality. Record actual verification limits without retroactively changing archived task checkmarks or descriptions. Current guidance retains the implemented `./data` path and narrow health contract; there is no storage migration or domain-contract expansion.

### 5. Document backups with all writers stopped

Choose a manual, offline procedure because the foundation has no content writes or snapshot coordination. README links to the canonical steps in `docs/local-storage.md`:

1. Identify the configured data root and stop every app instance, development watcher that may restart the server, and external SQLite tool or screenshot writer. Confirm processes/connections are closed and files will stay unchanged throughout copying. If this cannot be established, do not take a raw filesystem backup.
2. Copy the entire quiescent data root to a new backup destination outside the source root, including screenshots and any remaining `library.sqlite-wal`, `library.sqlite-shm`, or journal files. Preserve their pairing and names. Never delete sidecars to make the dataset look clean. A clean last close normally checkpoints WAL, but absence of sidecars is not a prerequisite for preserving an unchanged complete dataset.
3. Mark interrupted copies incomplete. Keep the original and previous known-good backup. Verify file inventory/checksums against the unchanged source before declaring success, and keep the app stopped until that consistency check finishes.
4. Restore into a separate writable directory while all writers remain stopped. On that restored copy, use SQLite to recover/open it and run `PRAGMA integrity_check`; verify screenshots and relative asset paths, then start with the restored data-directory override. Preserve the original dataset and avoid merging a restored database with stale destination sidecars. Verification may create sidecars on the restored copy; do not modify the backup itself.

Explain that database integrity alone does not validate matching screenshots. Future live backups would require a SQLite-supported snapshot mechanism plus coordinated filesystem consistency, separately approved. Do not implement this now or assume SQLite transactions cover image copies.

Technical basis: [SQLite backup/corruption guidance](https://sqlite.org/howtocorrupt.html#backup_or_restore_while_a_transaction_is_active) and [SQLite WAL file guidance](https://sqlite.org/wal.html#the_wal_file). These support preserving WAL content and avoiding copies during transactions. The stopped-writer procedure additionally keeps screenshot files consistent with the database.

## Risks / Trade-offs

- More lifecycle listeners can double-clean resources or hide errors → use one guarded owner, remove startup listeners after settlement, and assert original errors and handle closure.
- Port failure tests can be flaky → retain the blocker socket until rejection, use loopback OS-assigned ports, and bound waits; no arbitrary sleeps.
- Temporary cleanup can mask an original assertion failure → attempt all teardown steps, retain useful failure evidence, and test teardown itself.
- Broad database ignore patterns could hide future intentional fixtures → use temporary/generated databases now; require a deliberate reviewed exception if a future fixture is needed.
- Generated index removals appear as deletions in a diff → record that working files are retained and verify source builds still succeed.
- A raw directory copy is safe only while every writer is stopped → state the precondition explicitly; no claim of live-backup support. Do not add graceful-shutdown infrastructure just for this guidance.
- Current main capability still warns during planning → strict change validation must pass now; main-spec strict success is an implementation acceptance gate, not a claimed result today.

## Migration Plan

After approval, implement and verify the small task groups below. No runtime data migration occurs. Existing datasets, configuration, and HTTP contracts remain valid. Rebuild before production startup, as already documented. If code must be rolled back, revert only hardening edits; leave runtime datasets untouched. Generated files can always be rebuilt from retained sources. Preserve archived OpenSpec files throughout, and archive this change only when separately requested after verification.
