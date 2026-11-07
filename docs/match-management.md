# Match management (Milestone 4)

The library opens in Matches. Match cards use explicit participant/promotion/event metadata, show unknown fields and incomplete status, and open the match inspector. Unassigned screenshots remains available beside Matches. Import is unchanged; source videos and capture folders never become matches automatically.

## Select captures, create a match, and assign

1. Open Unassigned screenshots. Select individual checkboxes or Select all screenshots (at most 256 per assignment).
2. Choose an existing Target match, or Create match for selection. Creating a match retains the selection and any independent assignment draft.
3. Enter match details and Save match. Participants is free text for singles, teams or multi-person matches. Promotion and event complete the identifying metadata; missing fields are allowed in an incomplete draft. Date / year accepts `YYYY`, `YYYY-MM`, `YYYY-MM-DD`, or unset. Unknown components are never invented. Obscurity is unset, Iconic, Familiar or Obscure; its definitions are available beside the form and it does not change screenshot difficulty or points.
4. For a newly created match, choose Use this match for selected screenshots, then Back to screenshots. Review Target match and Save assignment. These are separate writes: creating/saving the match does not assign anything. The selection remains available after closing the clean inspector.
5. Select the saved match in Matches to inspect its associated screenshots. Select one and choose another target to reassign, or Unassigned (remove association) to return it to the queue. Multi-assignment targets one existing match; bulk unassignment/review/rating/deletion is not offered.

Incomplete matches can receive screenshots. Assignment does not rate or approve them. Source metadata and managed PNG files remain unchanged. Parent/screenshot revisions are checked together; multi-assignment commits all members or none. Material association or answer changes invalidate recorded approvals according to the approved rules; obscurity/notes changes do not.

## Independent drafts and conflicts

Match edits and the selected screenshots' target are separate drafts. Save match and Cancel match changes affect only the match editor. Save assignment affects only the association draft. Navigation that would discard work offers Save and continue, Discard and continue or Stay; a failed save prevents leaving. Closing the inspector protects its match draft while retaining the independent selection/target. Browser close/reload uses the supported native unsaved-work prompt; force-close recovery of unsaved drafts is not promised or persisted.

A 409 conflict never overwrites or automatically retries against newer revisions. Match conflicts display current server fields next to the retained draft. Either Reload server values to discard local edits, or compare/merge the draft, acknowledge the comparison and Use reviewed server revision before saving again. Assignment conflicts preserve every selected member and the desired target. Compare current associations/revisions, then explicitly Use reviewed selection and target revisions and Save assignment. Missing members are not silently removed to create a partial assignment. If current records cannot be loaded, the existing draft remains available.

## HTTP scope

All mutations use the existing JSON/body bounds, exact origin policy and `X-Name-That-Match: library` header described in README. The new routes are:

- `GET/POST /api/matches`: deterministic basic match list or create, including an explicit empty draft.
- `PATCH /api/matches/:id`: expected revision, editable match changes, normalized no-op handling and atomic approval invalidation results.
- `PATCH /api/screenshots/:id`: expected screenshot revision and `changes.matchId` only in this milestone, plus target match revision for nonnull assignment.
- `POST /api/screenshots/assignments`: 1–256 unique screenshot IDs/revisions, one target match and its expected revision.

The minimal match projection includes completeness/missing fields; richer search/filter/counts and full eligibility belong to later milestones. No difficulty/notes/review screenshot PATCH form is accepted yet. Match field validation returns 422 with field errors; malformed fields/IDs/revisions and unknown input fields return 400. Stale revisions return 409 with current revision context, missing records 404, and storage/unexpected failures remain sanitized.

## Manual verification

Use the already imported screenshots or a disposable data root with authored fixtures. Keep the same configured data root when checking restart persistence.

1. Select several unassigned screenshots, create a match, fill identifying fields and a partial date, and save. Confirm that every checkbox remains selected and no association was created yet. Explicitly choose the new target and save the assignment.
2. Open Matches and the saved match. Check fields and associated screenshots. Cancel an edit and verify the stored value remains unchanged; save another edit and reload it.
3. Create/save an incomplete draft and try each obscurity value and unset. Verify that existing screenshot difficulty/review values do not change merely because obscurity changes.
4. Reassign one screenshot to another match, then unassign it. Verify the queue and both matches refresh correctly, with source provenance intact.
5. Make a match edit and attempt to change view, close its inspector or switch to System. Exercise Stay, Discard and Save; test a failed save without losing the draft. Choose an assignment target and test the same protection while retaining independent match edits.
6. In two tabs, edit the same match. Save tab B, then tab A. Check the conflict, preserved draft/current server comparison and deliberate reconciliation. Repeat with tab A holding a screenshot selection while tab B changes one association or its target match; no selected subset should commit on the stale attempt.
7. Use keyboard Tab/Space/Enter, inspect visible focus and named controls, and repeat at tablet width. At narrow widths the inspector replaces the browsing area; Back to screenshots returns to the retained selection.
8. Stop/restart the server with the same root. Verify saved match IDs, fields, partial dates and associations remain.

Automated coverage and actual browser evidence are recorded in the active change's Milestone 4 verification record. Physical Android/Wi-Fi, full review/eligibility and real-collection acceptance remain later checks.
