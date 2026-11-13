# Game Experience Milestone 1

This document records the Milestone 1 checkpoint: domain engine, clock/service boundary and SQLite persistence. Later milestones add host HTTP/setup/preparation, the read-only contestant display, live judgments, full-game progression and Studio presentation; see [current host operation](game-host.md) and [Studio setup](studio-mode.md). Both modes now share [WebSocket observations and HTTP commands](road-mode.md). Historical Milestone 1 evidence below is unchanged.

## Storage and upgrade

Startup now supports global SQLite schema 5. Schema 5 adds a nullable bounded immutable stopped countdown to judgments, preserving legacy unknown time. Schema 4 widens only game-round timing CHECK constraints to 30,000ms with transactional rebuild/preserved rows, indexes, triggers and FK verification; saved pauses are not extended. Schema 3 remains the historical foundation migration below. It adds five STRICT tables: `game_sessions`, `game_contestants`, `game_rounds`, `game_score_events` and `game_command_receipts`. Existing schema-1 classification mapping still runs once; schema-2 values, revisions, provenance and image paths are not rewritten by migration 3. Normal existing import reconciliation still runs on startup independently of migration.

Use the [stopped-writer whole-root backup](local-storage.md#backup-and-restore) before starting against an operational dataset. Keep original captures and the backup unchanged. Unsupported newer schemas are rejected without recreation. A failed migration rolls back DDL/version changes. To revert, use compatible previous code with a complete pre-upgrade backup restored to a separate root; do not point older code at schema 5.

No new library tier column is stored. Each round snapshots the approved classification inputs and derives its 1/2/3 award using the existing shared classifier. A committed award is historical fact. Changing library metadata later cannot reassign its contestant or recalculate its points.

## Domain and service

`shared/src/game/` contains transport-free contracts, runtime validation, transitions, selection and explicit role projections. `server/src/game/` owns transactions, receipts, the injected monotonic deadline/scheduler and startup recovery. The historical `library/migrations.ts` module registers the global ordered migrations; versions 1 and 2 retain their existing behavior.

One or two contestants are supported. The host explicitly switches contestants between rounds; Advance keeps the same contestant. Each attempt captures its own immutable contestant ID at Prepare. The source video is not a match identity. Exposure blocks the whole match, screenshot ID and exact image hash across all contestants and tiers for that session. Cancellation before exposure releases the candidate and retains the cancelled attempt, without a filmed turn or award.

The service accepts versioned UUID commands with expected state revisions, records durable receipts and publishes accepted state only after commit. A retry uses the same command ID and business content, including its original expected revision. Resolve its stored receipt/current state rather than inventing a second command ID. A changed payload under the same ID conflicts. Score events are unique by round and tied to that round's contestant. Reveal and Advance do not award points.

The game service uses trusted server observation ports for eligibility, current candidate/image and primary readiness. They default to false; a browser cannot override them in a command. Milestone 1 did not implement those adapters or authorization/network routes. Milestones 2–3 now supply real library observations, HTTP/leases and decoded-image/clock/connection readiness. Operational code must use one game service/server per data root and close the service before closing its SQLite connection.

## Timer and recovery

The guessing window is 10,000 monotonic milliseconds. Server callbacks and every command/read catch up expiration; delayed callbacks cannot extend the deadline. Pause preserves the actual remainder and Resume uses it. Incorrect ends immediately with zero; ordinary Correct is only valid before expiry. After expiry, explicit Correct before buzzer attests to a timely spoken answer; Confirm timeout gives zero. No same-round restart, undo, retroactive score edit or bonus exists.

Skip and Void are one zero-point transition, distinguished by a recorded reason. They retain exposure and do not automatically Advance. Pause/Resume may be repeated while time remains; command retries do not repeat their effects.

On startup, running rounds become Interrupted and require explicit voiding. Pending preparation becomes a retained cancelled attempt. An unexposed Ready round stays covered and must pass fresh candidate/readiness checks before Reveal. A committed paused remainder can resume only after fresh readiness and an explicit host action. Missing/changed clue bytes are reported through the trusted adapter; they cannot erase an already committed award or pinned answer. Awaiting judgment stays at zero; judgments/receipts/totals and selected contestant survive reopen. Graceful service close checkpoints a known remainder and cancels its timer. There is no automatic new round or countdown restart.

SQLite uses the existing WAL/NORMAL settings. Supported process recovery does not promise that the final acknowledged transaction survives sudden OS/power loss. Snapshot DTOs are the milestone-1 domain foundation; bounded network frames, leases, clock probes and real readiness/liveness adapters are later milestones.

## Verify this checkpoint

Run against disposable test data:

```bash
npx vitest run tests/game
npm test
npm run typecheck
npm run lint
npm run build
openspec validate game-experience-mvp --type change --strict
openspec validate --all --strict
```

The game suites create their own temporary roots, close connections/services, cancel timers and remove fixtures. They exercise state transitions, all nine matrix cells, visibility boundaries, retries/CAS, migration rollback, ownership, resource cleanup and recovery. They never discover Downloads or process original captures.

For a manual schema inspection, create a disposable root and use the built modules (after `npm run build`). In a Node `--input-type=module` session:

```javascript
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { initializeStorage, closeStorage } from './build/server/src/storage.js';
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ntm-game-check-'));
const storage = initializeStorage({ dataDir: root });
try {
  console.log(storage.db.pragma('user_version', { simple: true })); // 3
  console.log(storage.db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all()); // 9 tables
  console.log(storage.db.pragma('foreign_key_check')); // []
  console.log(storage.db.pragma('integrity_check')); // integrity_check: ok
} finally {
  closeStorage(storage);
  fs.rmSync(root, { recursive: true, force: true }); // only the newly created disposable root
}
```

Review service recovery and late-judgment behavior through `tests/game/service.test.ts`; the [current host checklist](game-host.md#manual-acceptance) covers setup, the contestant tab and live countdown/judgment UI. Full-game progression and Photo Library hardware/offline acceptance remain deferred.
