# Selecting Match shuffle verification

Verified November 23, 2026 on macOS with Node 20, Vitest and a headless Chrome production build. The browser used a disposable local data root with an eligible fixture for each tier.

## Production viewport comparison

Compared captured impact and settled frames with [the approved comp](../../../../design-comps/Wrestling%20Match%20Difficulty%20Selector.png). The layout retains the logo, central card hierarchy, colored tier borders, purple framing, scan panel and checklist. It uses the bundled illustrations, CSS arena lighting and a localized radial spill. The portrait adaptation places the scan panel above the checklist and gives neighboring tier labels more room during impact. Compact presentation controls remain in their existing upper-right row.

| Viewport | Tier outcomes | Settled center difference | Approximate on-screen icon height |
| --- | --- | --- | --- |
| 1920 × 1080 | Easy, Medium, Hard | Less than 1 CSS px | 171 px |
| 1024 × 768 | Easy, Medium, Hard | Less than 1 CSS px | 97 px |
| 768 × 1024 | Easy, Medium, Hard | Less than 1 CSS px | 178 px |
| 375 × 667 | Easy, Medium, Hard | Less than 1 CSS px | 90 px |

All 12 observations showed the expected green, yellow or red border, neighbors present during impact and hidden after the fade, a contained target card and no horizontal page scrolling. The browser measured the target center against the carousel bounds. The production run also verified a repeated Prepare receipt, host control release and re-claim, a viewer reload into the settled card, cancellation back to Choose Your Match, reduced motion without impact and an accepted Reveal during the shuffle. It checked for hidden clue imagery and fixture answer text during selection.

## Automated checks

- `npm test -- --silent` passed 793 tests in 49 files. Focused selection tests cover all five phases, all three tiers, delayed callbacks, timer cleanup, and reduced motion on entry and during impact. Contestant tests cover slow Preparing, early Ready, repeated observations, cancellation/recovery, decoded clue concealment and an accepted guessing snapshot during impact.
- `npm run typecheck`, `npm run lint` and `npm run build` passed.
- `openspec validate --all --strict` passed all eight items. CV-03 now references the new selection capability and retains existing phase, Reveal and scan semantics. CV-04 and CV-17 continue to govern spoiler protection and compact controls. `git diff --check` passed.

## Physical acceptance still open

Task 3.4 remains open for laptop and TV Studio viewing, Android Road touch and portrait/landscape use, actual local Wi-Fi with external internet disconnected, and representative recording crops. The Chrome layouts and local WebSocket exercise are viewport and integration evidence only.

## Follow-up from the owner’s screen recording

The recording showed the same visible fan repeatedly changing direction before lock. The revised CSS moves a longer tier-card strip from right to left and uses the same position at the shuffle-to-braking boundary. Blur recedes during braking. The extra cards are removed at lock, and the selected card, impact and hold use the existing phase timings.

On the production build, Chrome sampled 39 frames at 1920 × 1080 and 68 at 375 × 667 without a reversal across either moving phase. The sampled travel exceeded 3,500 logical pixels in both cases. Moving-card blur started at 8 px and dropped below 0.06 px near lock. The selected card still settled within 1 CSS pixel of the carousel center for all three tiers at all four reference sizes. The 41 focused tests, production build with typecheck, lint and strict OpenSpec validation passed.

## Archive checkpoint

The owner approved the revised motion and requested archival on November 23, 2026. The approved requirements were synchronized into the main contestant selection animation spec. Nine of ten tasks were complete at archive. Physical Studio and Road acceptance remains deferred with task 3.4 unchecked.
