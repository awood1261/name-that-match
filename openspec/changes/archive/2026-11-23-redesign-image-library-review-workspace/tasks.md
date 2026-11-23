## 1. Persistence and review behavior

- [x] 1.1 Add the schema 5-to-6 migration for approved screenshots with null difficulty. Verify migration and reopen on a fixture with linked import receipts and game rounds, preserved screenshot rows and asset references, intact indexes and constraints, and clean foreign-key checks. Verify fresh and legacy startup and rollback on injected migration failure.
- [x] 1.2 Preserve pending, approved and rejected status on rating changes and clears through the existing edit request. Verify tier, points, eligible counts and Play availability update through valid rating changes, clearing and restoration. Verify review still requires a separate request and that invalid approval, stale writes, no-ops, answer changes and reassignments retain their existing safeguards.

## 2. Compact Matches view

- [x] 2.1 Add server-derived pending and asset issue summaries. Verify approved and eligible counts remain distinct and filtered results report their matching subset alongside full-match counts.
- [x] 2.2 Connect the Matches tab shown in `design-comps/image-library-ui-update.png` to a compact searchable and sortable table. Verify stable sorting, same-screenshot filter semantics, explicit match edit access, retained filters on return, and access to all assignment targets.

## 3. Review Queue and Overview

- [x] 3.1 Add a compact server queue summary and selected-group reads. Verify one catalog assessment supplies the queue statistics per observation, no unopened group receives a screenshot collection payload, and cancellation, revision changes and storage uncertainty produce coherent results or explicit errors.
- [x] 3.2 Build the Review Queue, Matches and Overview navigation, summary strip and match-group queue from `design-comps/image-library-ui-update.png`. Verify the default view, pinned intake, deterministic pending order, completed groups, distinct ready and review indicators, and whole-library Overview statistics.
- [x] 3.3 Connect import results to Unassigned Intake and reuse the assignment controls. Verify optional source grouping, assignment to existing and newly saved matches, and draft protection without changing durable import confirmation or originals.
- [x] 3.4 Build the match information and eligibility panels, thumbnail rail, large preview, and screenshot review controls from `design-comps/image-library-ui-update.png`. Verify separate match and screenshot saves, independent review actions, disabled approval with actionable blockers, saved tier and points, and missing-image handling.
- [x] 3.5 Implement confirmed same-group advancement for approval and rejection. Verify pending-only progression with within-group wrap, last-item completion, usable focus and announcements, stable selection during rating saves and Mark Pending, and no advancement on failed, uncertain or conflicting writes.

## 4. Verification and review

- [x] 4.1 Manually compare the built UI with `design-comps/image-library-ui-update.png` at desktop, tablet landscape and tablet portrait sizes. Record layout hierarchy, spacing, typography, colors, controls, image presentation and responsive adaptations. Verify no horizontal page scrolling, keyboard and touch access, visible focus and announcements, and usability with long metadata and large screenshot sets. Record viewport and physical-device evidence separately.
- [x] 4.2 Verify representative catalog load during local game observation and exercise import, assignment, classification, approval, rejection and reopening on a disposable data root with the local server reachable and the internet disconnected. Record collection size, observed latency, and any unperformed checks.
- [x] 4.3 Update library operation and storage docs for review navigation, rating and approval behavior, schema 6, and backup/rollback. Verify the workflow against the built application and the documented whole-root restore procedure.
- [x] 4.4 Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and strict OpenSpec validation. Record results, deviations and outstanding manual checks for owner review.
