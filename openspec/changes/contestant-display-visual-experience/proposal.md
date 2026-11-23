## Why

The functional Game Experience MVP still presents generic covered panels and a between-round scoreboard rather than the approved wrestling game-show compositions. This change gives tier choice, hidden preparation and screenshot/countdown their own faithful visual treatments while preserving server authority and the completed game flow.

## What Changes

- Recreate the three specified screens from `design-comps/screen-updates` using independently responsive HTML/CSS and the existing local logo; no full-screen comp backgrounds.
- Render informational green/yellow/red tier cards with fixed 1/2/3-point labels; host tier selection alone does not advance the public screen.
- Render a spoiler-free, purely theatrical selection carousel/checklist through Preparing and Ready; only accepted host Reveal starts the clue/countdown.
- Give guessing a dominant contained screenshot, yellow frame and compact actual-round/tier/MM:SS strip with non-flashing urgency.
- Use the owner-selected 16:9 landscape stage with the centered 1080 × 960 guide; adapt narrow screens without promising a center crop retains the complete screenshot. This explicitly replaces the earlier full-containment crop guarantee for these three screens only.
- Plan faithful local SVG recreations of the three comp illustrations, reviewed before integration; self-host Barlow Condensed WOFF2 (900 italic headings, 800 italic card/strip labels, 900 upright countdown, 700 upright supporting labels), retaining the font license and offline fallbacks. No package dependency or runtime font CDN is proposed.
- Preserve read-only roles, existing cover/error/reconnect behavior, result/final game behavior and fullscreen gestures; the approved Correct Match composition below is an explicit presentation exception, preserving scoring, selection, exposure tracking, network contracts and persistence.

## Capabilities

### New Capabilities

- `contestant-display-visuals`: Comp-based choose/selecting/guessing presentations, state mappings, illustrative assets, animation, responsive geometry, privacy and acceptance requirements.

### Modified Capabilities

None of the currently materialized capabilities under `openspec/specs/` changes. The approved `game-display` capability still lives in the unarchived `game-experience-mvp` change. This visual capability explicitly refines GD-02's waiting/preparation/guessing content and supersedes GD-04's crop guarantee for those screens; other GD requirements remain applicable. See design D8 for the prerequisite reconciliation at closeout. Do not create a duplicate `game-display` capability, alter historical MVP evidence or archive either change during planning.

## Impact

Client presentation, contestant-only tokens, reviewed local SVG assets, focused component/browser tests and current operation documentation. Existing `ContestantDisplay`, `ContestantStage`, `Countdown`, display controls and their CSS boundaries are reused; small choose/selecting/clue components are justified. No server/shared domain or transport change, migration, library change, host-control cleanup, external imagery, audio or new package. The approved Correct Match result composition below is a scoped presentation addition; void and completed-game layouts remain excluded; the owner-approved follow-up below extends it to incorrect/timeout. Planning artifacts require explicit owner approval before implementation; illustration review is a further integration gate. Physical device, offline and filming acceptance must be recorded as actually performed or still open.

## Implementation approval and refinements

The owner explicitly approved implementation with the final refinement request on 2026-11-12. Update/validate planning first, then perform Phase A only: evaluate/bundle the approved local font and prepare the three SVG illustrations. Stop for explicit artwork approval before illustration integration or later screen work. Selecting retains continuous low-intensity activity after its approved 2.4-second intro, with a static reduced-motion alternative and no Reveal gate. The earlier fallback-only font decision is superseded by self-hosted Barlow Condensed.

## Owner-approved result refinement — 2026-11-12

Extend the implemented visuals with held-clue/frozen-time presentation and dynamic green/red revealed feedback based on the two additional screen-updates references specified in design.md. This explicitly authorizes result polish previously excluded; upstream GR-10 owns stopped time and image lifecycle. Retain explicit Reveal Result, frozen answer/score information and all physical acceptance deferrals.

## Owner-approved tier names — 2026-11-13

Use Easy / Medium / Hard in all contestant tier text instead of the match-type-sounding names. Existing 1/2/3 points, illustrations, colors and behavior remain. Original comp text is superseded by the owner-approved name mapping; upstream GD-08 provides the shared mapping.


## Approved scope update — Correct Match result composition — 2026-11-14

**Approval:** the owner approved CV-13–15/design D9 and authorized implementation with “spec looks good and you can proceed” on 2026-11-14. This explicitly extends the active change's result-feedback scope; physical checks still require actual evidence. Existing completed tasks and remaining physical/closeout gates are preserved.

Exact approved visual reference: `/Users/alexwood/Dev/name-that-match/design-comps/reveal-improvements/Correct Match_ Dusty Rhodes vs. Honky Tonk Man.png`.

Refine only revealed **correct** results: large white italic CORRECT! with green check/underline/glow, prominent yellow-bordered match-identification panel (wrestlers, promotion, event and known year), high-contrast green earned-points banner, compact contestant/total-score strip and unobtrusive local fullscreen/safe-area controls. Retain the actual wrestling screenshot behind independent semantic content; never ship the flattened comp as the result background or hardcode its example names, +1 or 10-point total.

Add laptop/TV/Android/phone acceptance, multiline long/multi-person identification and a readable full-details fallback for metadata that exceeds the fixed stage. Preserve frozen answer data, round-owner scoring, committed totals, explicit Reveal Result, read-only roles, countdown/phase/recovery behavior, offline assets and CSS Modules. This supersedes the earlier correct-result visual reference/layout under the recorded owner approval; other outcome and final screens retain their current treatment. CV-13–15 are additive requirements in the existing `contestant-display-visuals` delta, not a duplicate capability or another game-state specification.


## Owner-requested championship line — 2026-11-18

The owner requested displaying a known championship underneath the show/year in the correct-result identity panel. Use the frozen `championshipInfo` only; omit missing/blank values and preserve full text in Full match details when the existing measured-overflow summary is needed. This is a presentation-only refinement of the approved scope, with no scoring/reveal or other-outcome change.

## Owner-approved incorrect and expired result extension — 2026-11-18

The owner requested the same treatment on incorrect and time-expired screens. Extend the approved Correct Match hierarchy, optional championship row, responsive full-details fallback and compact utilities to revealed incorrect/timeout results. Use red cross/underline/glow with distinct INCORRECT! and TIME UP headlines and the committed zero-point award. Supersedes the earlier correct-only exclusion for these two outcomes; void/final layouts and all authoritative behavior remain unchanged.

## Owner-requested compact contestant controls — 2026-11-23

Use the existing compact fullscreen and safe-area guide icons at the top right throughout the contestant view, including connection and recovery screens, all round phases, and final results. Keep the controls outside the scaled stage, with their existing accessibility and local fullscreen and guide behavior.

## Owner-approved Selecting Match shuffle refinement

The `redesign-selecting-match-shuffle-animation` change supersedes the original fixed yellow center and continuous waiting pulse. The owner-approved tier mapping and existing Reveal gates still apply.
