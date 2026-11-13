# Contestant visual screens

The contestant screens follow `design-comps/screen-updates`, with the existing public server state, local assets, HTTP image preload and shared WebSocket observation adapter. Game rules, readiness, thirty-second deadlines, scoring, receipts and match-repeat prevention are unchanged. Setup/host operation remains in [game host](game-host.md), [Studio](studio-mode.md) and [Road](road-mode.md).

## Sequence and controls

- **Choose Your Match** appears during setup and between rounds. Green Squash / 1 point, yellow Competitive / 2 points and red Deathmatch / 3 points cards are informational. Each illustration is a separate local SVG image element; headings and points remain real HTML text. Contestants choose verbally, and the host retains tier availability/exhaustion feedback. Choosing a tier on the host does not advance this screen.
- **Selecting Match** appears after accepted Prepare, continuing through Preparing and Ready until host Reveal. The carousel uses approved generic wrestling illustrations, never the selected clue, previous clues or library previews. The scan/checklist is theatrical, not recognition or real metadata processing. A finite 2.4s intro settles into restrained continuous center emphasis. Ready/repeated observations do not restart it; refresh/reconnect restores a settled presentation. Reduced motion removes the movement/continuous pulse.
- **Screenshot/countdown** appears on accepted Reveal with the actual exposed round number, selected tier and authoritative remaining time formatted as MM:SS. Canceled preparations do not increment the displayed round. The full image is contained without cropping or stretching. Final-three-second underline/color is cosmetic; no extra timer or automatic judgment exists. Reveal does not wait for an animation or font load.

Pause/interruption/stale connection cover the clue. Expiry and judgment retain it with frozen time under the refinement below. Existing explicit Reveal Result, scoreboards, final totals and recovery behavior remain intact. No new controller or viewer interaction is added. Fullscreen/guide controls stay outside the filmed stage, use existing gestures and remain optional. Uncertain host commands still require explicit receipt/status review; this visual change does not remove that safety gate.

## Fonts, images and offline behavior

Barlow Condensed WOFF2 is bundled locally: 900 italic headings, 800 italic card/strip labels, 900 upright timer and 700 upright support. The four Latin files total 91,404 bytes; [license and provenance](../public/fonts/barlow-condensed/README.md) are included. No Google Fonts stylesheet/font CDN or extra package is used at runtime. Missing/slow local font files use metric-adjusted local bold/italic fallbacks; fixed layout rows reserve content space. Other scripts use installed fallbacks. Host/admin typography keeps its existing tokens; revealed feedback reuses the local contestant font faces.

Assets must already be installed/built for offline operation. Use the existing build/start commands and configured data root; schema 5 adds saved stopped timing; follow the stopped-root backup guidance before upgrade. No operational-data reset is needed. Browser external-request blocking is narrower evidence than physically disconnected internet, which remains a separate check. Rollback requires compatible code and the complete pre-upgrade backup; older binaries cannot open schema 5.

## Layout and filming

Choose, Selecting, guessing, held clues and revealed feedback use a uniformly fitted 1920×1080 landscape stage. If available space is taller than wide, a 1080×1440 compact layout stacks the cards, scan/checklist and strip appropriately. Legacy covered/final states keep their original 1080×960 layout. Switching geometry at a phase boundary is intentional; there is no countdown-time relayout unless the operator changes the viewport/orientation.

**Safe-area guides** default off. In the new scenes the centered 1080×960 outline is a framing reference, not a guarantee that all landscape content survives a center crop. A 1080×960 reference is not itself a 9:16 crop. Preserve the complete clue on the actual display; do not shrink/distort it to pretend otherwise. Review intended camera placement or edited vertical crop using representative screenshots. Side portions of a wide image and outer choice cards can be excluded by that crop. Final results retain their earlier essential-content safe-stage behavior; the new revealed feedback shares the landscape/compact crop limitations.

## Manual acceptance

Record actual device/browser/resolution/network, viewing distance and outcome:

1. Laptop contestant + phone host: Choose remains while selecting a tier; Prepare enters Selecting; Reveal is available only after existing primary readiness and no pending command. Reveal can interrupt the intro; cancel returns Choose. Test several consecutive rounds and all available tiers.
2. Check dynamic round/tier/00:10, countdown catch-up, pause/resume remainder, refresh/reconnect, timeout/late judgment, explicit result reveal, Advance and existing final totals. No stale image or hidden answer may flash.
3. Compare logo, black surface, colors, card silhouettes/text, carousel/checklist, image frame and strip against the three comps. Review both wide/non-wide source images, large turn numbers, no overlap/scrolling and timer readability.
4. Check fullscreen enter/exit, keyboard/focus, guides on/off, portrait/landscape and reduced motion. Typography/images must remain readable if font files fail; ordinary gameplay never waits on fonts or decoration.
5. On an actual TV at filming distance and Android landscape tablet, review clarity, motion smoothness, touch/fullscreen and prolonged play. Exercise local Wi-Fi interruption/rejoin and physically disconnect external internet while preserving local networking.
6. Film or edit a representative 9:16 clip, checking clue readability, tier/time visibility and the documented crop limitations. Do not treat viewport screenshots as camera acceptance.

The active `contestant-display-visual-experience` verification record distinguishes executed desktop/browser checks from outstanding physical acceptance. Earlier Game Experience/Photo Library deferrals remain separate. No archive is implied by this guide.

## Held clues and revealed feedback

Awaiting judgment and concealed adjudication reuse the screenshot scene: the current image remains contained and its timer freezes at the saved remainder or zero. Legacy unknown stopped time is labeled Time unavailable. Outcome/points/answer appear only on host Reveal Result. The revealed green correct/check/earned-points scene follows `1C862D7C-A93D-41FE-89BA-3C38E2742F70.png`; red incorrect/timeout/cross follows `785D5517-AC79-448A-A1D8-578ABFB078BF.png`, both in `design-comps/screen-updates/`. The actual clue image is dimmed beneath independently rendered SVG/text/frame, with real dynamic points, frozen answer details and a compact scoreboard. Existing local Barlow faces approximate the reference lettering; no flattened comp image or new font dependency is used. These feedback scenes use the same landscape/compact geometry and guide/crop limitations. Pause/interruption/stale covers and final-result behavior are unchanged.
