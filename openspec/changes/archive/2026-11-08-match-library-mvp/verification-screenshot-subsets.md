# Screenshot subset filtering — manual-review follow-up

Date: 2026-11-08. The user explicitly requested that opening a matching match card display only its screenshots satisfying the active screenshot filters, superseding the full-collection presentation from task 4.26. Task 4.27 implements this refinement in the existing change; group 7 remains separately opt-in.

## Behavior and implementation

- Match cards still qualify using the approved match predicates and same-screenshot difficulty/review/tier predicates. Their full association counts and global statistics remain unfiltered.
- Opening a match forwards only active `difficulty`, `review` and `tier` groups, together with `matchId`, to the existing server-authoritative screenshot endpoint. Search/obscurity/incomplete match predicates are not leaked into that endpoint. There is no new endpoint or duplicate client classifier/filter matrix.
- The collection labels `Showing N of M screenshots` and explains whether screenshot filters are active. Thumbnails, Previous/Next and Select all operate on the returned subset.
- Saving an edit refreshes membership. Clean images that no longer match leave navigation; independent dirty drafts remain protected. Zero matching images yield a clearly labeled empty result with filters retained. If the parent drops out of match results, its unfiltered summary is retrieved to keep the parent identity/full count current.
- With no screenshot filters, all images are returned. Existing explicit metadata editing, Back/filter retention, stale-response protection, Save/Discard/Stay, import and assignment behavior are retained.

Changed implementation files: `client/src/library/api.ts`, `useMatchWorkspace.ts`, `MatchLibraryPage.tsx`, and `LibraryFilters.tsx`. Updated the active proposal/design/match-library delta/tasks, current classification/match-management documentation, and component tests. No server logic, database schema, image/source files or dependencies changed.

## Actual verification

- `npm test -- --silent`: **309 tests passed, 21 files**. Existing import, health, static serving, migration, persistence, concurrency and classification regressions passed.
- New component cases cover combined difficulty/review/tier subset selection, thumbnail/navigation bounds, unchanged global totals, saved images leaving the subset, empty results and independent dirty match drafts. The earlier full-collection regression now verifies a filtered subset and that match-only parameters are omitted from screenshot queries.
- `npm run typecheck`, `npm run lint`, `npm run build`: passed.
- Strict change validation and whole-project OpenSpec validation: passed (2 items, 0 failed).
- `git diff --check` and tracked build/database audit: clean. Unrelated existing working-tree changes retained; no commit/archive performed.

Production headless Chrome imported two authored fixture captures into a disposable data root and assigned them to one Low-obscurity match. Easy and Hard inputs produced Squash and Competitive respectively. A Squash filter opened exactly one of the two screenshots. Select all selected only that image; thumbnails and Previous/Next stayed within the subset. Saving its difficulty as Hard removed the final matching image and displayed `Showing 0 of 2 screenshots`, retaining the Squash filter. Clearing filters and reopening restored both images. Global totals stayed unfiltered, the 768px viewport had no horizontal overflow, previews used containment, and original fixture checksums were unchanged.

Evidence: `/var/folders/fz/n886xxg177nd7nkz0b56r_9h0000gn/T/ntm-subset-browser-3l8j5d/` (`report.json`, desktop/tablet subset and empty-result screenshots). Runner: `/private/tmp/ntm-subset-browser.cjs`. Processes stopped and owned temporary data, captures and browser profile cleaned. No real application data or source capture collection was accessed. Tablet viewport emulation does not constitute physical Android/Wi-Fi acceptance.

## Repeat manually

Save outstanding drafts and fully refresh the updated app. Select Squash Match, then open a matching card: only Squash screenshots should appear, with visible/full counts. Try combined visual-difficulty/review filters, Select all and thumbnail navigation. Save a rating that removes an image from the filter and verify refreshed/empty results. Clear filters and reopen to see all images. Match metadata editing remains an explicit separate action.

Task 4.27 complete: progress 53/60, seven group-7 tasks still unchecked. The change remains unarchived; stop for review.

## Follow-up: result-card count clarity (task 4.28)

The next manual review identified that result cards still led with full screenshot totals even though opening them displayed the matching subset. Result cards now lead with `N matching screenshots of M total` whenever screenshot filters are active. The server computes the additive `matchingScreenshotCount` from the same observation and same-row predicate used for card qualification, without another asset scan or stored counter. Other figures explicitly say `Full match totals`; global statistics remain unfiltered. Without screenshot filters, the normal total screenshot count is shown.

Changed shared match projection, server catalog, result-card presentation, current classification guidance and active design/spec/tasks. HTTP verification compares the matching count against the actual screenshot listing and confirms unfiltered totals; a component regression exercises a three-of-five result card, opening its three-image subset, Back, and clearing filters. All **310 tests across 21 files**, typecheck, lint, production build, strict change/whole-project OpenSpec validation and whitespace audit passed. No new browser verification was performed for this count-only follow-up; the subset browser evidence above remains its earlier checkpoint. No schema, dependencies or original image data changed. Restart the local server and fully refresh the browser to load the new projection/UI.

Task 4.28 complete; current progress 54/61, seven group-7 tasks still unchecked. No archive or next milestone.

## User manual-review acceptance — 2026-11-08

After confirming the corrected result-card counts, the user reported: “okay manual verification looks good.” Record this as user acceptance of the current library implementation and manual-review corrections through task 4.28, including screenshot subset filtering and matching-versus-total card counts.

The user did not enumerate additional devices, fault-injection exercises or offline checks, so this acceptance does not establish completion of the separate group-7 real-collection acceptance plan. Group 7 remains unchecked; progress stays 54/61. No additional implementation, commit or archive is authorized by this review confirmation.
