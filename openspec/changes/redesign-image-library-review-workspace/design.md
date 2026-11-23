## Context

`MatchLibraryPage` and `useMatchWorkspace` currently coordinate the Matches card grid, Unassigned screenshots, and one active screenshot inspector. The existing HTTP APIs own writes, validation and derived eligibility. Match and screenshot data live in schema 5 SQLite storage, and both import receipt items and saved game rounds reference screenshot IDs. The source files for the visual design and scope are `design-comps/image-library-ui-update.png` and [the proposal](proposal.md).

## Goals / Non-Goals

- Keep match and screenshot review in one workspace with independent drafts, explicit assignment and review actions, and predictable navigation.
- Use a single local server authority for classification, eligibility and persistence. Keep the app usable on installed offline builds and the current trusted LAN setup.
- Keep import staging, confirmation, recovery and assignment contracts intact. Bulk classification, bulk approval, capture deletion, gameplay and contestant display work remain outside this change.

## Decisions

### Build the desktop hierarchy with existing editors and tokens

Use React and strict TypeScript. Keep the application shell and extend its Image Library view with Review Queue, Matches and Overview. Keep view, group and screenshot selection under the existing workspace navigation guard. Give the library a page-specific responsive width so the desktop preview can use the available space beyond the current content cap. Use colocated CSS Modules for layout and state styles and reuse the centralized palette, typography, spacing, radius and focus conventions. The comp establishes high-contrast black and purple panels, yellow primary actions, purple selection outlines, and text-labeled review and issue indicators. Use the same local typography and semantic controls across branches of the responsive layout.

| Region in `design-comps/image-library-ui-update.png` | Implementation |
| --- | --- |
| Header and tabs | Reuse Reload Screenshots, Create Match and Import Captures. Make Review Queue active by default. Put the existing searchable library in Matches and detailed whole-library statistics in Overview. |
| Summary strip | Show the count of displayed associated groups, the pending count across the queue's displayed groups including intake, and the whole-library eligible screenshot count. Label each scope. Use the queue order helper text to explain intake first, then pending newest-first. |
| Left queue | Pin intake and render compact buttons with a group thumbnail where available, identity, screenshot counts and a text issue or readiness label. Default to pending decisions and expose Show Completed. Sort pending matches by descending match record creation time, then ascending stable ID. Append groups without pending decisions in the same order when shown. Keep the group open when its final pending decision is resolved and update its completion state. |
| Match information and eligibility | Show identity, promotion, event, partial date and obscurity once for the selected group. Use `MatchInspector` for editing. Present identifying and classification blockers, counts, and asset issues using server projections. Expose the impact of answer-field and association changes where those edits are made. |
| Screenshot area | Reuse the inspector's contained preview, selection and Previous/Next behavior. Show numbered thumbnails and the position within the group. Present Easy/Medium/Hard as a labeled choice, retain Unrated, and provide a distinct classification save. Keep screenshot notes and provenance accessible. Show a saved tier and points, a review-status label, and eligibility or blockers. Approval is disabled when prerequisites fail and remains server-validated on write. |

On desktop, use a two-column queue and workspace. Inside the workspace, place match information beside eligibility and give the preview the largest share of the screenshot area. Place thumbnails beside the preview and review controls beside it where space allows. On tablet landscape, retain queue and workspace columns where the content fits and move controls below the preview before it becomes cramped. On tablet portrait, use a single-column selected-group view with an explicit Back to queue action and a thumbnail strip that can scroll inside its panel. Wrap navigation and actions, preserve image aspect ratio, and keep the page free of horizontal scrolling. Use a compact responsive table with named headers and sort controls. Allow columns to wrap or stack secondary fields with their labels at narrow widths while preserving access to all essential data and actions.

Use labels and visible focus for keyboard and touch use. Announce successful saves, selection changes and errors. Keep existing Save/Discard/Stay protection across view, group, screenshot and filter changes that would lose drafts. Preserve group and screenshot IDs across breakpoint changes. Restore focus when exiting editors or returning to the queue. After auto-advance, focus a stable heading or the new selected item and announce its position.

### Keep server projections authoritative and limit image work

Extend the server-derived summaries with pending and asset issue counts where needed. Build a compact queue read from one assessment per observation and omit per-screenshot payloads for unopened groups. Reuse the classification and asset assessment helpers for readiness and global statistics. Use the selected-group screenshot read for details, with lazy thumbnails and only the selected large preview. Reuse cooperative catalog assessment for new potentially expensive scans, with cancellation and a revision consistency check before publishing results. Keep asset assessment current and surface storage uncertainty explicitly. Preserve the existing game observation and command paths.

Reuse the existing search/filter contract for Matches. Sort the returned compact rows in the client for this increment, with deterministic ID ties and unknown dates last in either direction. Keep the full assignment target list independent from the filtered or sorted table. Use representative large fixtures to measure whether pagination needs a separate change.

### Advance only from a confirmed review outcome in the current group

Use stable group and screenshot IDs and the server's capture-time/ID order. After a successful approval or rejection in Review Queue, reconcile with the current group and select the first remaining pending item after the reviewed item, wrapping within the group. Use Approve & Next when another pending target is visible and Approve otherwise. Preserve a valid selection when a response arrives late or a group drops out of pending results. Classification save and Mark Pending keep the current selection. When the group has no next target, keep the reviewed screenshot visible and show completion. A failed or uncertain response keeps the current item and requires existing conflict or reload handling before retry. Preserve the filtered collection behavior when entering through Matches.

### Preserve review on classification edits

Keep the separate edit and review requests to the existing screenshot PATCH route. Remove difficulty changes from the repository's approval-reset predicate, preserving invalidation on actual association and parent answer-field changes. A valid rating or Unrated increments the screenshot revision on a real edit and preserves all review states. Recompute tier, points and eligibility through the existing projection. An approved, unrated screenshot will be ineligible. A later rating can restore eligibility when the remaining prerequisites are met. Keep the explicit approval action's existing asset, association, metadata, classification and revision guards.

## Risks / Trade-offs

- **Shared server responsiveness.** The existing library may assess managed PNGs multiple times during a refresh. Fetch group details on demand, reuse one queue assessment for its summary counts, and check representative image sizes with game observations running. Keep the existing fail-closed behavior for unavailable storage.
- **Comp examples.** Illustrative counts, data and example tier values are visual guidance. For instance, High obscurity and Easy visual difficulty yield Medium and two points. The missing event in the comp would block approval.
- **Changing group membership.** Filters, assignment and successful decisions can remove rows from queue results. Retain selected identifiers, ignore obsolete reads, and test final-item, cross-tab edits and import handoff cases.
- **SQLite dependencies.** The replacement screenshots table needs the same name, columns, indexes, uniqueness checks, match relationship, and incoming links from import items and game rounds.

## Migration Plan

Add a transactional schema 5-to-6 step using the existing migration entry point and its foreign-key verification. Rebuild the screenshots table with its approved-association check intact and allow approved rows with null difficulty. Copy every column unchanged, including provenance, hashes, revisions, timestamps, paths and review states. Recreate the existing indexes and verify relationships before advancing `user_version`. Preserve the earlier migrations for fresh and legacy starts. Verify successful reopen, migration failure rollback, existing game and import references, and the eligible-to-ineligible-to-eligible lifecycle on disposable fixtures.

Before opening an operational collection with the upgrade, stop writers and take a whole-root WAL-safe backup per `docs/local-storage.md`. Verify on a restored copy first. Roll back with compatible code and the pre-upgrade backup restored to a separate root. Source captures and managed PNGs retain their bytes and paths throughout.
