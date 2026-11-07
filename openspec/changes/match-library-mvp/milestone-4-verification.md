# Milestone 4 verification — Match management

Verified 2026-11-06. Scope is tasks 4.1–4.7 only. Milestones 5–7 remain unchecked and unimplemented. The change stays active and is not archived.

## Review and baseline

Reviewed AGENTS.md, the change proposal/design/tasks, four capability deltas, all three earlier verification records, change metadata, the actual repository/validation/import/HTTP/client/CSS code, Git status and recent history. Milestone 3 is committed at `1e0c0da`; the working tree was clean. All its tasks were checked. Actual baseline checks passed: 239 tests in 16 files, typecheck, lint, production build, change strict OpenSpec and whole-project strict validation. The user's initial manual UI verification is recorded in the conversation; physical Android/Wi-Fi and later full-library acceptance were not claimed. No blocking baseline gap was found.

D8 explicitly provides “Create Match followed by explicit assignment.” Keeping the selected screenshots while opening/saving a match therefore fits the approved design. No planning adjustment was needed. Saving the new match never assigns anything; the operator explicitly chooses it as target and saves the association separately.

## Delivered scope

- Match list/create/update HTTP boundaries, strict bounded JSON, field validation, generated identity, expected revisions, normalized no-ops and atomic approval invalidation results. Empty/incomplete drafts, flexible participants, unknown/partial dates and independent obscurity/editorial fields persist through the existing repository.
- Individual screenshot assignment/unassignment/reassignment and all-or-none assignment of 1–256 unique members to one existing target, validating member and target revisions. Source provenance, difficulty and image references are preserved. Material changes apply the already approved invalidation rules.
- Default Matches view, basic match selection/cards, controlled inspector, explicit Save/Cancel, unknown/incomplete indicators and linked field feedback. This is the basic projection from D9; richer filtering/counts/full eligibility remain later work.
- Queue and match-screenshot checkboxes, bounded select-all, existing-target picker and Create match for selection. Selection and independent assignment target survive match creation/save/cancel/clean inspector closure. A saved match can be explicitly used as target, then assigned with a separate save.
- Independent match/association drafts and Save/Discard/Stay protection for affected selection/view/editor/in-app navigation. Failed saves retain drafts. Closing only the match inspector preserves the independent assignment draft. Browser unload uses the supported native prompt, without persistent draft storage or a force-close guarantee.
- Match conflicts retain the draft and show current server fields. Reload/discard or explicit comparison/reconciliation is required before using a current revision; no automatic overwrite/retry. Assignment conflicts retain all members and target, show current records/revisions, and require explicit review before retry. Save-and-continue can save both affected drafts, including this operator's known target-revision update.
- CSS Modules/tokens, semantic native controls, keyboard selection, visible focus, dialog trapping/Escape/return, field descriptions, separate tablet inspector and source-preserving image containment. Import remains available and its regression suite passes.

No schema migration, dependency, framework, Tailwind, gameplay, WebSocket, automatic source-video grouping, difficulty editor or review/approval control was added. The backend rejects screenshot difficulty/notes/review mutation forms at this milestone. Tests seed approval/difficulty internally only to verify required invalidation.

## Files

New:

- `shared/src/matches.ts`: basic match/read/write contracts.
- `server/src/library/http/matches.ts`: match and assignment handlers over existing transactions.
- `client/src/library/match-draft.ts`: form/payload normalization and dirty comparisons.
- `client/src/library/useMatchWorkspace.ts`: independent drafts, requests, selection, revisions and scoped navigation guards.
- `client/src/library/MatchInspector.tsx`: match fields, field feedback, explicit reconciliation and saves.
- `client/src/library/AssignmentPanel.tsx`: target/selection management and assignment conflict comparison.
- `client/src/library/UnsavedChangesDialog.tsx`: accessible Save/Discard/Stay decision.
- `tests/server/match-management.test.ts`: 24 HTTP integration cases.
- `tests/client/match-management.test.tsx`: 19 workspace/guard/concurrency cases.
- `docs/match-management.md`: operation, HTTP scope and detailed manual verification.
- This record.

Modified:

- `server/src/library/http/dispatcher.ts`, `protocol.ts`: route registration, semantic field status and match/member revision diagnostics.
- `server/src/library/assets.ts`: shared public screenshot projection for list and assignment responses.
- `shared/src/imports.ts`: structured match/member conflict context.
- `client/src/library/api.ts`: narrow match/assignment helpers.
- `client/src/library/MatchLibraryPage.tsx`, `Library.module.css`: basic match browsing, selection, inspector composition and focus/responsive states.
- `client/src/App.tsx`: guard library-to-System navigation before unmounting drafts.
- `tests/client/App.test.tsx`, `tests/client/library.test.tsx`: approved default Matches view and unchanged import/queue regressions.
- `README.md`, `docs/local-storage.md`, `docs/import-engine.md`: current delivered behavior and links.
- `tasks.md`: only Milestone 4 completion tracking added.

The SQLite repository, schema, original capture files, extension and archived history remain unchanged.

## Actual automated verification

| Check | Result |
|---|---|
| Baseline `npm test -- --silent` | PASS — 239 tests, 16 files |
| Final `npm test -- --silent` | PASS — 282 tests, 18 files; 43 new cases |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS — zero warnings |
| `npm run build` | PASS — Vite client and TypeScript server |
| `openspec validate match-library-mvp --strict` | PASS |
| `openspec validate --all --strict` | PASS — 2 items, zero failures |
| `git diff --check` | PASS |
| Tracked artifacts and dependencies | No tracked build/data/database artifacts; package manifests and lock unchanged |

HTTP coverage includes incomplete/identified metadata, all obscurity values/unset, year/month/day precision and leap validation, semantic field feedback, malformed/unknown fields, future screenshot mutation rejection, stale/no-op updates, single assignment/reassignment/unassignment, cross-video/same-video relationships, bounded unique multi-assignment, stale/missing members/targets, actual mid-transaction rollback, approval invalidation and stale screenshot edits, origin/header protection and stop/reopen persistence.

Client coverage includes default view, draft creation/edit/cancel, partial dates/editorial fields/obscurity, retained selection across creation and explicit later association, existing target and single reassignment/unassignment, independent saves/cancels, field names/descriptions/errors, Save/Discard/Stay across affected views/selections/editor/System, failed saves, native unload registration/removal, stale match and selection comparison/reload/reconciliation, both-draft save ordering and current target revisions. Existing import validation, duplicate/durability, image/HTTP, navigation and dialog regressions ran in the full suite.

Development verification caught a field-error label association issue and test-query typing/lint issues; these were fixed and rerun. No failing checks remain.

## Actual Chrome verification

Ran automated Chrome through CDP against the built production application, with a separate temporary browser profile and application root. Two independently authored fixture pairs were imported, explicitly retaining the second byte-identical image. No original collection or normal application storage was used.

Verified in the actual browser:

1. Both selected screenshots survive Create match for selection and Save match. Before explicit assignment, both associations remain null. Use this match/Back/Save assignment associates them with the saved match, still unrated/pending.
2. Partial date `2024-02`, obscurity `familiar`, identity and notes persist. Save/Discard/Stay works during System/view navigation; Stay keeps the draft and Save persists before leaving.
3. A competing HTTP edit produces a UI conflict without losing draft text. The current server fields can be compared, merged and explicitly acknowledged before retrying with their revision; both intended changes persist.
4. Keyboard Space selects a screenshot. Single unassignment returns it to the queue. Stop/restart preserves the match, edited metadata, one remaining association and one unassigned screenshot.
5. At 1440px, document width is 1440px and inspector width 380px. At 768px, document width is 768px and inspector width 670px; browsing is hidden in the dedicated inspector view, with no horizontal overflow. Back restores browsing/selection. Unsaved dialog initially focuses Stay.
6. Original temporary fixture-pair names/checksums are unchanged; no nonlocal page dependency requests were observed.

Screenshots/report remain outside source control at:

`/var/folders/fz/n886xxg177nd7nkz0b56r_9h0000gn/T/ntm-m4-browser-BjvMpr/`

The temporary server, profile, application data and fixture copies were stopped/removed after checking; the evidence PNGs/report remain. A verification-script text-case assumption was corrected during the browser run. This is real Chrome automation, not a physical Android/Wi-Fi test, hand-operated native picker or disconnected-network/real-collection acceptance.

## Review gate

No approved-design deviation was necessary. Match creation and association are separate explicit saves, not a combined transaction or inferred grouping. Richer cards/search/filter/counts, full screenshot inspector/review/eligibility and collection acceptance remain in Milestones 5–7. Existing trusted-LAN/single-server and backup guidance still applies.

Manual steps are in `docs/match-management.md`: select existing unassigned captures, create/save a match while retaining selection, use it as target, explicitly save assignment, inspect/edit/cancel/reassign/unassign, test two-tab conflicts and unsaved navigation, then restart using the same data root.

All tasks 4.1–4.7 are complete with evidence. Stop for review before Milestone 5. Do not archive.
