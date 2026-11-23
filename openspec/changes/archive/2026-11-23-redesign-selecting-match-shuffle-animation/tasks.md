## 1. Authoritative input and presentation lifecycle

- [x] 1.1 Wire the public round's typed requested tier and round identity into the Selecting Match scene. Verify Easy, Medium and Hard cases, ignored uncommitted input, and identical target and timeline across Preparing, Ready and repeated snapshots.
- [x] 1.2 Add the local shuffle, deceleration, lock, impact and complete phases. Verify deterministic transitions, suspension or delayed-callback catch-up, stable final state, cleanup at unmount or replacement, and immediate settlement for reduced motion including a preference change.
- [x] 1.3 Verify viewer refresh, viewer and host reconnection, session restoration, duplicate or delayed preparation commands, cancellation and failure using contestant integration tests. Confirm a resumed round skips impact and a genuine new preparation animates its own tier.

## 2. Carousel and visual treatment

- [x] 2.1 Implement the layout and deterministic centered-card movement with CSS Modules and bundled tier assets using `design-comps/Wrestling Match Difficulty Selector.png`. Verify exact center alignment, readable Easy/Medium/Hard text and icons, and retained logo, scan panel and checklist in landscape and portrait.
- [x] 2.2 Apply the one-time border color transition, glow pulse, localized background flash and radial spill from `design-comps/Wrestling Match Difficulty Selector.png`. Verify green/yellow/red mappings, neighbors visible during impact, their subsequent fade, and the selected card remaining readable and stable in the hold and reduced-motion variants.

## 3. Verification and review

- [x] 3.1 Regress host pacing, preparation and spoiler protection in the existing tests. Verify fast and slow Ready, Reveal during shuffle or impact, independent decode/clock readiness, no clue or answer in the scene, decorative progress semantics, and no change to game commands or countdown.
- [x] 3.2 Compare the production build with `design-comps/Wrestling Match Difficulty Selector.png` at 1920 × 1080, 1024 × 768, 768 × 1024 and 375 × 667. Record centering, tier treatment, motion/settlement, readable labels, compact controls, no horizontal overflow, and the visual result of the reduced-motion setting.
- [x] 3.3 Update Studio and Road guidance for the settled tier, recovery and local reveal workflow. Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` and strict OpenSpec validation. Record results and any manual steps still pending at implementation review.
- [ ] 3.4 Perform and record physical Studio laptop and TV and Road Android tablet acceptance in supported portrait and landscape orientations. Check touch, viewing distance, local Wi-Fi with external internet disconnected, and representative recording crops separately from viewport observations. Leave unperformed checks explicit.
- [x] 3.5 Before synchronization or archive, reconcile the active contestant visual change's CV-03 fixed yellow center and looping emphasis with this refinement. Verify both approved contracts preserve host pacing, spoiler protection and compact controls, then report acceptance for owner review.
