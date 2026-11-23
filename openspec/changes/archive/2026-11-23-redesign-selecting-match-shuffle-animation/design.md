## Context

`client/src/game/SelectingMatch.tsx` renders seven fixed artwork slots. Index 3 always contains the Medium illustration. `SelectingMatch.module.css` offsets, scales and fades those slots with a 2,400 ms CSS shuffle and a looping yellow center glow. The current effect has no random selection, JavaScript animation timer or tier input. CSS limits movement to no-preference motion. Its static path still has the same fixed center.

`client/src/game/HostPage.tsx` submits the host's tier and a new round ID with `PREPARE`. `shared/src/game/engine.ts` records the accepted choice as `round.requestedTier` and verifies that the prepared candidate matches it. `shared/src/game/projections.ts` already exposes the round ID and requested tier for both Preparing and Ready. `client/src/game/useContestantDisplay.ts` receives those snapshots over the shared WebSocket adapter and owns decode, readiness and clock synchronization. `ContestantDisplay.tsx` currently decides whether the selection intro should play and keys Selecting Match by round ID.

The primary landscape reference is `design-comps/Wrestling Match Difficulty Selector.png`. The image shows the impact moment with Medium centered and its neighbors still visible. Use the same composition for Easy and Hard when selected. The scan panel and checklist remain theatrical.

## Goals / Non-Goals

- Center the committed tier exactly and keep the selected card readable through a bounded impact and final hold.
- Reuse the existing offline rendering stack, public snapshot and uniformly scaled stage.
- Limit the change to presentation. Host input, tier rules, candidate selection, decode/readiness, Reveal, countdown, scoring, and other screens retain their existing responsibilities.

## Decisions

### Drive the scene from the accepted public round

Pass the typed `requestedTier` to `SelectingMatch` as read-only input. Use the existing round identity for both the scene and its local visual lifecycle. Track whether a new round arrived from a live choice scene or was restored into Preparing or Ready. Initialize those paths as shuffle or complete, respectively, before the scene is visibly painted. Preparing to Ready for the same round preserves the component instance and its timeline. Host controls, selection commands, receipts, storage and the observation protocol already supply everything this requires.

### Use a bounded presentation timeline

Use a small typed local presentation state with `shuffling`, `decelerating`, `locked`, `impact` and `complete`. Choose card positions deterministically from the shared tier order and the requested target. Position the locked card on the carousel axis with zero horizontal offset and rotation, bring it forward, and keep it stable for the rest of the scene. The suggested boundaries are elapsed times from the start of a live intro.

| Phase | Target time | Treatment |
| --- | --- | --- |
| Shuffling | 0–900 ms | Run a repeated strip of generic tier cards right to left with motion blur. A bounded set of extra cards provides the lead-in. |
| Decelerating | 900–1,450 ms | Continue in the same direction as speed and blur decrease. The strip ends with the target exactly on the carousel axis. |
| Locked | 1,450–1,650 ms | Center and slightly enlarge the selected card. Keep the surrounding cards visible. |
| Impact | 1,650–2,050 ms | Transition to the tier-colored border. Pulse its glow once, flash the card surface briefly, and show subtle radial spill behind the card. Keep the label legible and the neighbors visible. |
| Complete | From roughly 2,050 ms | Briefly fade the surrounding cards after impact. Keep the selected card centered with a steady border and no repeating effect. Hold until the public phase changes. |

Use a single local timing owner with a monotonic start time and cancellable phase callbacks. CSS Modules own interpolation and effects, using explicit phase and tier attributes and timing values derived from the same timeline. Do not depend on an animation completion event to progress or on server elapsed time for decoration. If a browser suspends a tab past the impact window, settle directly when it resumes. Cancel scheduled work on unmount, round replacement and loss of the selection scene. Reduced motion settles immediately, including when enabled mid-sequence.

The travel and braking keyframes share a boundary offset and remain applied together across both moving phases. Extra lead-in cards are mounted only while the strip moves. The card that reaches the center stays in place from lock through the final hold.

### Preserve Reveal and the existing recovery paths

Ready may arrive before the animation ends. In that case continue the animation while the clue remains covered. If an accepted Reveal arrives mid-animation, switch immediately to the existing reveal/countdown path. If the animation ends first, hold its centered tier through Preparing or Ready without suggesting that the image has been decoded or a match is available.

| Event | Selecting Match behavior |
| --- | --- |
| Repeated Prepare request, delayed or lost response | Only a newly observed accepted round after a live choice arms an intro. Duplicated observations and host receipt recovery for the same round leave the timeline in place. |
| Host reconnects while the viewer stays connected | Keep the current round and presentation. A changed authoritative phase still takes effect immediately. |
| Viewer refresh, reconnect or session restoration | Show the settled tier of a restored Preparing or Ready round. Skip the impact. If the viewer briefly retains an untimed selection during reconnect, settle it and obey the existing recovery grace limit. |
| Preparation cancelled or failed | Follow the public phase back to Choose Your Match. If the viewer receives a display or image error, use the existing cover and retry message. The public state does not distinguish failed preparation from cancellation after returning between rounds. |
| Round changes or selection disappears | Release its timers and pending callbacks. A newly accepted attempt after a live choice can animate independently. |

### Keep styles and assets within the selection scene

Keep the logo, local type, shared contestant geometry and compact upper-right controls. Reuse the three artwork files in `public/images/contestant/` and `GAME_TIER_DETAILS` for English tier labels. Retain scoped `SelectingMatch.module.css` for card slots, colored borders, flash, glow, radial spill and the scan/checklist layout. Reuse the centralized contestant green, yellow, red, purple and black tokens. Keep shuffle durations local to this scene so other scenes retain their existing motion. Use semantic text for the selected tier and hide duplicate moving cards, scan meter and checklist from assistive announcements. The flash is a single brief localized change in luminance, with no high-contrast full-screen flash. Use the comp's visible hierarchy rather than its flattened bitmap as the screen.

Use the existing landscape and compact stage variants, with the scan/checklist side by side in landscape and reflowed in portrait. Reserve room inside the carousel for the selected card and its effects. Peripheral cards can leave the frame while shuffling. Keep the central icon and label inside the guide where practical and record real crop tests separately from viewport checks.

## Risks / Trade-offs

- **Ready can arrive during impact.** The host's Reveal has priority. The final impact is visible when the selecting scene remains on screen long enough to reach it.
- **A settled tier could be mistaken for readiness.** Keep the Selecting Match screen and host-wait context until the public phase changes. The scan and checklist report no real progress.
- **Existing baseline wording.** The active `contestant-display-visual-experience` change now directs CV-03 to the `contestant-selection-animation` capability for the tier-centered intro and stable hold. It keeps the existing phase and host pacing requirements, CV-04 spoiler prevention and CV-17 controls. The updated wording is ready for review before any specification synchronization.

## Open Questions

- Tune the exact deceleration curve, glow intensity and fade duration during visual verification within the planned two-second sequence. The committed tier, one-time impact and host control do not depend on that tuning.
