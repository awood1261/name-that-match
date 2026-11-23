## Why

Selecting Match currently shuffles a fixed set of cards and settles on a yellow Medium illustration for every round. The final card should confirm the tier the contestant chose verbally and the host committed when preparing the match.

## What Changes

- Use `design-comps/Wrestling Match Difficulty Selector.png` as the primary visual reference for the existing contestant Selecting Match scene. Retain its branding, dark arena, purple accents, scanning panel and checklist.
- Show Easy, Medium and Hard with their existing illustrations and green, yellow and red colors. Run a deterministic shuffle, decelerate, and center the public round's committed tier.
- Apply a brief tier-colored border transition, one glow pulse, a localized card flash and a subtle radial spill. Keep the neighboring cards visible during the impact, then fade them out. Hold the selected card in its stable centered state while the host is preparing or waiting to reveal.
- Keep reduced-motion and restored views still and readable. Preserve host-controlled Reveal, countdown timing, readiness checks and spoiler protection. An accepted Reveal interrupts the animation immediately.
- Keep Choose Your Match, match selection rules, screenshot eligibility, scoring, and other screens outside the refinement. Reuse bundled assets and the current animation stack.

## Capabilities

### New Capabilities

- `contestant-selection-animation` specifies the authoritative target, shuffle progression, settled presentation and interruption behavior.

### Modified Capabilities

None of the materialized main specs change. This follow-up supersedes the fixed yellow center and looping emphasis in the active `contestant-display-visual-experience` change's CV-03. Its phase, pacing and spoiler protections still apply. The design describes how to reconcile the two changes before spec synchronization.

## Impact

Planned changes are limited to contestant presentation, scoped CSS Modules and tokens, focused tests and operator guidance. The validated public round snapshot already carries the requested tier. The plan uses the existing protocol, server authority, database and game command paths.
