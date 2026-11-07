# Milestone 1 verification

Milestone 1 only is implemented. Tasks 1.1–1.8 are complete; Milestones 2–7 remain unimplemented and require separate authorization. The change is not archived or committed by the agent.

## Delivered files and responsibilities

| Files | Responsibility |
|---|---|
| `shared/src/capture.ts` | JSON-safe capture v1 types only; no capture import or file validator |
| `shared/src/library.ts` | Match/screenshot domain contracts, partial-date type, classification values, labels, point meanings and obscurity definitions |
| `server/src/library/validation.ts` | Editable-field validation, normalization, calendar-correct partial dates, identifying completeness, UUID/revision validation and typed field errors |
| `server/src/library/migrations.ts` | Version 1 schema, constraints/indexes, transactional version migration and unsupported/unexpected schema errors |
| `server/src/library/repository.ts` | Match create/read/update, internal committed screenshot SQL insertion/read, screenshot edits, atomic assignments, revision checks and material-change invalidation |
| `server/src/storage.ts` | Apply approved migrations within the existing connection setup/failure cleanup path |
| `tests/library/fixtures.ts` | Independently authored metadata-only fixtures; no PNG processing or real captures |
| `tests/library/{validation,migrations,constraints,repository}.test.ts` | Domain, database, migration and persistence regression tests |
| `tests/storage/storage.test.ts` | Update the foundation-only table expectation to the approved four-table schema |

## Schema and migration behavior

Version 1 creates `matches`, `screenshots`, `import_batches`, and `import_items` as strict SQLite tables. It enforces primary keys, foreign keys with restricted referenced deletion, unique platform/capture identity and managed image paths, unique batch ordinals, enum checks, positive integer sizes/dimensions/revisions, finite nonnegative playback, SHA-256 shape, and appropriate JSON shapes. An approved screenshot cannot have a null match or difficulty. Image hashes are indexed and deliberately nonunique. Explicit indexes cover screenshot match/hash and batch/item state queries.

Initialization upgrades an empty foundation version-0 database once, retains the same database file/assets, preserves WAL/NORMAL/foreign-key settings, and leaves version-1 data intact on repeated opens. SQL and user_version updates occur transactionally. Unsupported newer versions and unexpected version-0 objects fail without recreating the database. Failed migrations roll back and close the connection. The internal-object filter uses literal-prefix GLOB semantics; a similarly named user table such as `sqlitex_data` is not mistaken for SQLite internals.

## Persistence and review boundaries

IDs are generated independently of video/capture identity. Original JSON text and provenance remain immutable through editorial operations. Managed references are portable and generated; no files are read or copied by repository operations. Match drafts may be incomplete, with unknown fields null. Partial dates retain their actual precision.

Updates require current revisions even for normalized no-ops. No-ops preserve timestamps/revisions; actual changes increment revisions. Multi-assignment validates every member/target before writes and is transactional. Material screenshot edits and the six specified answer-bearing match fields invalidate only affected approved reviews; notes/obscurity preserve them. Failure-injection tests prove rollback of both invalidation and multi-assignment, and separate-connection tests prove stale editor rejection.

The committed-screenshot insert is an internal SQL primitive for the future validated import commit transaction, not an HTTP endpoint or import workflow. Approval entry points, capture-file validation, image/hash verification against bytes, eligibility, staging/recovery processing, and UI remain later milestones. Import tables contain structure only.

## Executed checks

| Check | Result |
|---|---|
| `npm test` | 101 tests passed across 12 files, including 80 new library tests |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed with zero warnings |
| `npm run build` | Passed: client bundle and compiled server/shared modules |
| `openspec validate match-library-mvp --type change --strict` | Passed |
| `openspec validate --all --strict` | 2 passed, 0 failed |
| `git diff --check` | Passed |
| Tracking/scope audit | No generated/runtime files tracked; no client, HTTP entry-point, dependency, or archived-spec changes |

Before interruption, the full suite passed 100 tests. On resumption the source files were verified intact; final review added the user-table-prefix migration regression and the final full suite passed 101 tests. Earlier typecheck issues in test annotations and a lint complaint about control-character regexes were corrected. The final implementation uses explicit character-code checks without weakening lint rules. Localhost integration tests ran with permission outside the sandbox; storage fixtures remained disposable and isolated.

## Manual verification instructions

No manual browser or disconnected-network check was performed. There is no new UI in this milestone.

For a manual data-layer check, first run `npm run build`. From the repository root, execute this shell command:

```bash
node --input-type=module <<'JS'
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { initializeStorage, closeStorage } from './build/server/src/storage.js';
import { createLibraryRepository } from './build/server/src/library/repository.js';
const reviewRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ntm-m1-review-'));
let session = initializeStorage({ dataDir: reviewRoot });
try {
  const repository = createLibraryRepository(session.db);
  const draft = repository.createMatch({ participantDescription: 'Team A vs Team B', matchDate: '2026-11' });
  console.log('Temporary review data:', reviewRoot);
  console.log('Schema version:', session.db.pragma('user_version', { simple: true }));
  console.log(session.db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all());
  closeStorage(session);
  session = initializeStorage({ dataDir: reviewRoot });
  console.log('Persisted draft:', createLibraryRepository(session.db).getMatch(draft.id));
} finally {
  closeStorage(session);
}
JS
```

Expected: schema version 1, four feature tables, and the same draft ID/revision with `2026-11` and null unknown metadata after reopening. Inspect or remove only that newly printed temporary directory when finished. Do not substitute real application storage or Downloads captures for this check.

## Scope, deviations, and review status

No specification deviations or unresolved Milestone 1 contradictions. No new dependencies, endpoints, UI, PNG processing, image copying, import services, gameplay, or WebSockets. Extension sources and original captures were not modified or used as test inputs. Main capability synchronization and later operational-documentation completion remain governed by the approved change plan; archived history is untouched.

Implementation remains an uncommitted working-tree change for review. Stop here before Milestone 2.
