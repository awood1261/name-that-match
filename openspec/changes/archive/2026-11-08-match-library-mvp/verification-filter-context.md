# Manual-review correction: filter and editing context

Date: 2026-11-08. Requested during the classification continuation's manual review; tracked as task 4.26 in the existing change. This is a focused correction to ML-06/07/10/11 administration behavior. No next milestone, archive, database migration or new dependency is included.

## Confirmed issue

Changing match search/filters reloaded result cards while retaining the previous `browseMatchId`, screenshot records and independent editor. This could place a Jericho/HOOK result next to a Baker/Rosa editor and collection. Opening a result also entered metadata editing implicitly. Full-collection versus filtered-result scope lacked the distinction required by D8.

## Corrected workflow

- Search/filters control match results. A changed query returns to results and clears the old collection, editor and screenshot selection only after protecting dirty match/image/assignment work with Save/Discard/Stay. Failed saves keep the query and draft unchanged. New loading states avoid briefly presenting old results under a new filter; aborted/delayed image responses cannot restore the previous context.
- A result opens a separately named full screenshot collection, with parent promotion/event and an explicit explanation that result filters do not hide members of this collection. Result cards are hidden while that collection is open.
- Edit match details explicitly opens metadata for the selected match; the editor identifies that match. Back to screenshots closes metadata independently; Back to match results protects drafts and retains the filters.
- Unassigned filters keep their own state. Existing import, assignment and separate draft saves remain intact. Collection navigation focuses its heading; typing filter/search changes keeps focus on the active control.

No tier matrix, search matching, association, review, persistence or eligibility policy changed. The collection still contains all associated images as specified; the correction makes its scope and editing actions explicit.

## Verification

- `npm test -- --silent`: **307 tests passed across 21 files**, including existing import/HTTP/storage/migration/classification regressions.
- Seven new component cases cover separate collection/edit entry, filter retention on Back, excluded-context cleanup, aborted late image responses, each dirty draft type, Save/Discard/Stay, failed/successful guard saves and search focus preservation.
- Existing reassignment verification now explicitly returns to result browsing before choosing another match.
- `npm run typecheck`, `npm run lint`, `npm run build`: passed.
- `openspec validate match-library-mvp --type change --strict`: passed.
- `openspec validate --all --strict`: 2 passed, 0 failed.
- `git diff --check`: passed. Tracking audit found no generated build/runtime databases. Existing uncommitted implementation/planning changes were retained.

Production headless Google Chrome verified the reported scenario using two authored fixture matches and copied fixture captures in a new disposable root. Selecting Low removed the unrelated Baker/Rosa editor/collection and left the expected Jericho/HOOK result. The card opened a named collection without a metadata form; Edit match details then loaded the intended match. Dirty filter changes offered Stay/Discard, retained or discarded the draft correctly, and Back retained filters. Keyboard Space opened the collection with heading focus. At desktop 1440px and tablet 768px, document widths matched the viewport, with no horizontal overflow. Tablet explicit-editor opening/closing passed. Original fixture checksums were unchanged.

Evidence: `/var/folders/fz/n886xxg177nd7nkz0b56r_9h0000gn/T/ntm-filter-context-browser-ITqA45/` (`report.json`, desktop/tablet collection and explicit-editor screenshots). Runner: `/private/tmp/ntm-filter-context-browser.cjs`. Processes were stopped; owned temporary data, copied captures and browser profile were cleaned, leaving reports/screenshots. No operational app root or real source collection was accessed. Viewport emulation is not physical Android/Wi-Fi verification.

## Files touched by this correction

- `client/src/library/useMatchWorkspace.ts`: guarded context reset, selected-match identity, explicit metadata action and response/loading safety.
- `client/src/library/MatchLibraryPage.tsx`: separate result/collection display, named context, editing/back actions and focus.
- `client/src/library/LibraryFilters.tsx`: filter scope/help and accessible filter region.
- `client/src/library/MatchInspector.tsx`: explicit edited-match identity.
- `client/src/library/Library.module.css`: small token-based collection separator.
- `tests/client/match-management.test.tsx`: new regression cases and explicit editing/navigation in existing flows.
- `docs/classification.md`, `docs/match-management.md`: corrected navigation and filter scope.
- Active `design.md`, match-library delta and `tasks.md`: manual-review interaction clarification and task tracking.
- This record and a link from the earlier continuation record.

## Repeat manually

1. Save existing drafts and fully refresh the app to load the updated bundle.
2. Open one match, explicitly edit its metadata, then choose a filter that excludes it. Verify results contain no retained editor or old screenshot collection.
3. Repeat with dirty match notes, screenshot notes or assignment target. Try Stay, Discard and Save; simulate a failed save and confirm the filter stays unchanged.
4. Open a result. Confirm its collection title and full-collection explanation, then use Edit match details and verify the same match's fields. Return to results and confirm filters remain selected.

Task 4.26 is complete; change progress is 52/59. Group-7 acceptance remains unchecked and the change remains unarchived. Stop for review.

## Subsequent screenshot-filter refinement

The user's next review requested matching screenshot subsets rather than full collections. Task 4.27 supersedes the full-collection scope above while retaining explicit editing and dirty guards. See [screenshot subset verification](verification-screenshot-subsets.md) for the updated behavior and 309-test result.
