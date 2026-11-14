# Mobile host layout review

Open [review.html](review.html) in a browser, directly from disk. No server, installation or internet connection is required:

```bash
open design-comps/host-controls-review/review.html
```

This standalone design artifact uses sample data. It never connects to the application, stores a credential or sends a game command. Its timer is static. Select the state/viewport above the preview; expand Menu, Display connection, Score details, Game options and optional answer details inside it. Action buttons report that they are samples. QR and device URLs are deliberately placeholders.

## Proposed layouts

| View | Main work | Requirement |
| --- | --- | --- |
| Between rounds | Contestant, Easy/Medium/Hard counts, Prepare, Refresh | MH-01/02 |
| Ready | Private answer, primary readiness, Reveal & start, Cancel | MH-02/03 |
| Guessing | Timer, private answer, Correct/Incorrect, separate Pause | MH-01/02/05 |
| Time expired | Zero timer, explicit before-buzzer credit, Confirm timeout | MH-02 |
| Connection + pending request | Simultaneous host/receipt blockers beside disabled Reveal, explicit recovery | MH-03 |
| Paused | Preserved remainder, readiness, explicit Resume | MH-02 |
| Judgment saved | Private saved result and separate Reveal Result | MH-02 |
| Result revealed | Saved public result and explicit Advance | MH-02 |
| Supporting sections | Links/QR/LAN, full scores, End/release below or alongside console | MH-04/06 |

On desktop the same console sits beside supporting sections. In portrait the sections follow it. The single action area uses sticky placement with a normal-flow short-screen/enlarged-text fallback. Final styling belongs in the application's CSS Modules; this isolated review artifact uses plain CSS and imports the existing token sheet.

## Review evidence — 2026-11-13

- Headless Chrome loaded the local file and logo for all eight states at 320 × 568, 390 × 844, 430 × 932, 844 × 390 and 1280 × 800 (40 combinations).
- No horizontal document overflow in those sample states. Primary action buttons measured at least 50px tall.
- At 390 × 844, the bottom of the primary action area was within the initial viewport for every sample state: Between 745px, Ready 593px, Guessing 638px, Expired 690px, Recovery 834px, Paused 613px, Saved 670px and Revealed 617px (rounded upward). This does not guarantee an arbitrary long error or answer fits without scrolling.
- Enlarged-text Guessing at 1280 × 800 rendered 32px base text, no horizontal overflow, and normal-flow actions. This sample check is narrower than the implementation's required text/zoom and keyboard matrix.
- Visually inspected the 390 × 844 Guessing capture: timer/answer/judgment precede Round options and supporting sections.

These checks verify the review artifact only. Actual command gating, focus transitions, navigation protection, sticky scrolling under mobile browser chrome, physical phone safe areas/keyboard, reconnect/receipt behavior and real game integration remain implementation acceptance work. The wireframe does not simulate state transitions or certify accessibility.

## Approval gate

The owner approved these layouts and application implementation on 2026-11-13 (“I approve”). Tasks 1.1 and 1.2 record that approval. These sample previews remain design references; application/device acceptance is recorded separately in the OpenSpec change. See [the OpenSpec plan](../../openspec/changes/mobile-host-experience/design.md).
