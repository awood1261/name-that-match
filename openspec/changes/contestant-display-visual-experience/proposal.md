## Why

The functional Game Experience MVP still presents generic covered panels and a between-round scoreboard rather than the approved wrestling game-show compositions. This change gives tier choice, hidden preparation and screenshot/countdown their own faithful visual treatments while preserving server authority and the completed game flow.

## What Changes

- Recreate the three specified screens from `design-comps/screen-updates` using independently responsive HTML/CSS and the existing local logo; no full-screen comp backgrounds.
- Render informational green/yellow/red tier cards with fixed 1/2/3-point labels; host tier selection alone does not advance the public screen.
- Render a spoiler-free, purely theatrical selection carousel/checklist through Preparing and Ready; only accepted host Reveal starts the clue/countdown.
- Give guessing a dominant contained screenshot, yellow frame and compact actual-round/tier/MM:SS strip with non-flashing urgency.
- Use the owner-selected 16:9 landscape stage with the centered 1080 × 960 guide; adapt narrow screens without promising a center crop retains the complete screenshot. This explicitly replaces the earlier full-containment crop guarantee for these three screens only.
- Plan faithful local SVG recreations of the three comp illustrations, reviewed before integration; self-host Barlow Condensed WOFF2 (900 italic headings, 800 italic card/strip labels, 900 upright countdown, 700 upright supporting labels), retaining the font license and offline fallbacks. No package dependency or runtime font CDN is proposed.
- Preserve read-only roles, existing cover/error/reconnect behavior, result/final presentations, fullscreen gestures, scoring, selection, exposure tracking, network contracts and persistence.

## Capabilities

### New Capabilities

- `contestant-display-visuals`: Comp-based choose/selecting/guessing presentations, state mappings, illustrative assets, animation, responsive geometry, privacy and acceptance requirements.

### Modified Capabilities

None of the currently materialized capabilities under `openspec/specs/` changes. The approved `game-display` capability still lives in the unarchived `game-experience-mvp` change. This visual capability explicitly refines GD-02's waiting/preparation/guessing content and supersedes GD-04's crop guarantee for those screens; other GD requirements remain applicable. See design D8 for the prerequisite reconciliation at closeout. Do not create a duplicate `game-display` capability, alter historical MVP evidence or archive either change during planning.

## Impact

Client presentation, contestant-only tokens, reviewed local SVG assets, focused component/browser tests and current operation documentation. Existing `ContestantDisplay`, `ContestantStage`, `Countdown`, display controls and their CSS boundaries are reused; small choose/selecting/clue components are justified. No server/shared domain or transport change, migration, library change, result redesign, host-control cleanup, external imagery, audio or new package. Planning artifacts require explicit owner approval before implementation; illustration review is a further integration gate. Physical device, offline and filming acceptance must be recorded as actually performed or still open.

## Implementation approval and refinements

The owner explicitly approved implementation with the final refinement request on 2026-11-12. Update/validate planning first, then perform Phase A only: evaluate/bundle the approved local font and prepare the three SVG illustrations. Stop for explicit artwork approval before illustration integration or later screen work. Selecting retains continuous low-intensity activity after its approved 2.4-second intro, with a static reduced-motion alternative and no Reveal gate. The earlier fallback-only font decision is superseded by self-hosted Barlow Condensed.

## Owner-approved result refinement — 2026-11-12

Extend the implemented visuals with held-clue/frozen-time presentation and dynamic green/red revealed feedback based on the two additional screen-updates references specified in design.md. This explicitly authorizes result polish previously excluded; upstream GR-10 owns stopped time and image lifecycle. Retain explicit Reveal Result, frozen answer/score information and all physical acceptance deferrals.
