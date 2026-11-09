# Milestone 1 verification — 2026-11-09

Scope: approved Game Experience foundation only. Owner approved the consolidated plan and subsequently authorized beginning Milestone 1. Task 1.1 and 2.1–2.8 are complete: 9/42 total tasks. Milestones 2–6 remain unchecked; this change is not archived.

## Implemented

- Shared strict TypeScript contracts/runtime validation for one/two contestants, exact command payloads/protocol/UUID/revision bounds, immutable answer/classification context and partial dates.
- Pure transition rules and session selection/repeat protection around the unchanged library matrix. Host-controlled contestant selection; immutable round owners; canonical zero-point Skip/Void reasons; retained pre-exposure cancellations; explicit answer/Advance/end and no automatic rotation.
- Explicit private/public allowlists. Host totals use the full ledger while history is bounded to the current round plus three earlier attempts. Public phases omit private identifiers/answers/provenance until explicit answer reveal.
- Injected monotonic deadline/scheduler, early callback rescheduling, delayed callback catch-up, pause remainder, distinct post-expiry pre-buzzer judgment and stale event guards. Observation checks finish before the start-time sample; countdown/judgment performs no image work.
- Additive schema 3 through the existing global migration registration. Five STRICT game tables, ownership FKs, one active/setup session, unique exposure/match/hash identities, per-round awards, revision/CAS checks, immutable history and command receipts. Preserve the original version-1/2 mapping and schema-2 library metadata.
- Transactional create/load/current/commit/receipt operations, role projections, service lifecycle, once-only scoring and recoverable storage failures. Startup recovers unknown running time to interrupted; pending preparation becomes retained cancellation; Ready/paused recovery remains covered and needs future real observations plus explicit host action.

No HTTP endpoints, client UI, actual library/display observation adapters, file processing, WebSocket dependency/runtime or controller leases were implemented. Trusted observation ports default to false; tests use explicit disposable fixtures. The operational server does not instantiate a game service until a later approved milestone. Storage schema/recovery initialization is integrated now.

## Executed checks

| Check | Actual result |
|---|---|
| `npx vitest run tests/game` | 103 passed, 3 files (50 domain, 27 service, 26 storage) |
| `npm test` | 413 passed, 24 files; includes existing import, library, API, health, lifecycle and production-static regressions |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed, zero warnings |
| `npm run build` | Passed: TypeScript checks, Vite client bundle and Node server output |
| `openspec validate game-experience-mvp --type change --strict` | Passed |
| `openspec validate --all --strict` | 5 passed, 0 failed |
| `git diff --check` and new-file whitespace audit | Passed |
| Git tracking/scope audit | No generated build outputs or local database files tracked; dependencies, client, classifier, main specifications and archives unchanged |

The first sandboxed full-suite attempt could not bind loopback ports (`listen EPERM`); it was rerun with the approved permission outside that restriction. Final full-suite result above passed. Early development checks found/fixed an ES2020-incompatible test helper, a lint control-character regex and an import-reconciliation fixture assumption. These are not unresolved failures.

## Acceptance coverage

- Every existing classification cell; eligible/ineligible and empty pools; stable injected sampling; match/screenshot/exact-hash exclusions; reservation release versus exposure burn.
- All host commands across active phases; invalid command shapes/counts; full/partial/unknown dates; covered/public/private data; bounded host history; solo/head-to-head totals and ties.
- Correct/incorrect/timeout/late judgment; pause/resume cycles; 9,999/10,000ms boundaries; wall-clock jumps; early/delayed/stale timer callbacks; competing judgments; stale selections/preparation completions; no score on Reveal/Advance.
- Fresh/repeated/legacy/populated database migration; newer-version rejection; DDL rollback; FK/unique/check/immutability enforcement; schema-2 record preservation; CAS across connections.
- Reopen after selection/scoring/cancel/void; running crash, known pause, preparation/Ready/awaiting-judgment recovery; unavailable clues cannot erase committed scores; lost responses after commit; receipt failure before commit; timer read/write failure; bounded resource cleanup.

## Disposable database inspection performed

Using built Node modules and a newly generated temporary root only:

1. Created a schema-2 fixture with an existing High-obscurity match at revision 1.
2. Initialized storage: schema 3, nine tables, `foreign_key_check=[]`, `integrity_check=ok`.
3. Confirmed the original match values and revision stayed unchanged.
4. Created a solo setup through GameService, closed service/SQLite, reopened and verified contestant selection and revision persisted.
5. Closed all resources, removed only that generated root and verified its removal.

No operational dataset, original capture collection or browser gameplay was used. No TV, Android or external-internet-disconnected acceptance is claimed; deferred Photo Library acceptance remains unchanged.

## Review and manual verification

See `docs/game-foundation.md` for commands and an isolated database inspection snippet. Play remains disabled, so no visible gameplay workflow can be manually tested yet. Before running this build against operational data, follow the stopped-writer whole-root backup procedure; startup now upgrades through schema 3. Rollback requires compatible prior code plus a complete pre-upgrade backup restored to a separate root.

No known scope deviation or unresolved implementation failure. Existing WAL/NORMAL sudden-power-loss limitations and the one-server/service-per-data-root operating contract remain. Future adapters must supply real eligibility/image/readiness observations; M1's trusted test ports are not a browser/API bypass.

Stop for Milestone 1 review. Do not begin Milestone 2 or archive without the owner's request.

## Files changed

- `README.md`
- `docs/game-foundation.md`
- `docs/local-storage.md`
- `openspec/changes/game-experience-mvp/design.md`
- `openspec/changes/game-experience-mvp/milestone-1-verification.md`
- `openspec/changes/game-experience-mvp/tasks.md`
- `server/src/game/migrations.ts`
- `server/src/game/recovery.ts`
- `server/src/game/repository.ts`
- `server/src/game/service.ts`
- `server/src/library/migrations.ts`
- `server/src/storage.ts`
- `shared/src/game/contracts.ts`
- `shared/src/game/engine.ts`
- `shared/src/game/projections.ts`
- `shared/src/game/selection.ts`
- `shared/src/game/validation.ts`
- `tests/game/domain.test.ts`
- `tests/game/fixtures.ts`
- `tests/game/service.test.ts`
- `tests/game/storage.test.ts`
- `tests/library/migrations.test.ts`
- `tests/storage/storage.test.ts`
