# Contestant visual screens

The three updated screens follow `design-comps/screen-updates`, with the existing public server state, local assets, HTTP image preload and shared WebSocket observation adapter. Game rules, readiness, thirty-second deadlines, scoring, receipts and match-repeat prevention are unchanged. Setup/host operation remains in [game host](game-host.md), [Studio](studio-mode.md) and [Road](road-mode.md).

## Sequence and controls

- **Choose Your Match** appears during setup and between rounds. Green Squash / 1 point, yellow Competitive / 2 points and red Deathmatch / 3 points cards are informational. Each illustration is a separate local SVG image element; headings and points remain real HTML text. Contestants choose verbally, and the host retains tier availability/exhaustion feedback. Choosing a tier on the host does not advance this screen.
- **Selecting Match** appears after accepted Prepare, continuing through Preparing and Ready until host Reveal. The carousel uses approved generic wrestling illustrations, never the selected clue, previous clues or library previews. The scan/checklist is theatrical, not recognition or real metadata processing. A finite 2.4s intro settles into restrained continuous center emphasis. Ready/repeated observations do not restart it; refresh/reconnect restores a settled presentation. Reduced motion removes the movement/continuous pulse.
- **Screenshot/countdown** appears on accepted Reveal with the actual exposed round number, selected tier and authoritative remaining time formatted as MM:SS. Canceled preparations do not increment the displayed round. The full image is contained without cropping or stretching. Final-three-second underline/color is cosmetic; no extra timer or automatic judgment exists. Reveal does not wait for an animation or font load.

Pause, expiry, stale connection and judgment immediately cover/remove the clue. Existing explicit Reveal Result, scoreboards, final totals and recovery behavior remain intact. No new controller or viewer interaction is added. Fullscreen/guide controls stay outside the filmed stage, use existing gestures and remain optional. Uncertain host commands still require explicit receipt/status review; this visual change does not remove that safety gate.

## Fonts, images and offline behavior

Barlow Condensed WOFF2 is bundled locally: 900 italic headings, 800 italic card/strip labels, 900 upright timer and 700 upright support. The four Latin files total 91,404 bytes; [license and provenance](../public/fonts/barlow-condensed/README.md) are included. No Google Fonts stylesheet/font CDN or extra package is used at runtime. Missing/slow local font files use metric-adjusted local bold/italic fallbacks; fixed layout rows reserve content space. Other scripts use installed fallbacks. Host/admin and legacy result typography keep their existing tokens.

Assets must already be installed/built for offline operation. Use the existing build/start commands and configured data root; no database migration or operational-data reset is needed. Browser external-request blocking is narrower evidence than physically disconnected internet, which remains a separate check. Restore a prior client build to roll back presentation; game storage/transport is unchanged.

## Layout and filming

Choose, Selecting and guessing use a uniformly fitted 1920×1080 landscape stage. If available space is taller than wide, a 1080×1440 compact layout stacks the cards, scan/checklist and strip appropriately. Legacy covered/result/final states keep their original 1080×960 layout. Switching geometry at a phase boundary is intentional; there is no countdown-time relayout unless the operator changes the viewport/orientation.

**Safe-area guides** default off. In the new scenes the centered 1080×960 outline is a framing reference, not a guarantee that all landscape content survives a center crop. A 1080×960 reference is not itself a 9:16 crop. Preserve the complete clue on the actual display; do not shrink/distort it to pretend otherwise. Review intended camera placement or edited vertical crop using representative screenshots. Side portions of a wide image and outer choice cards can be excluded by that crop. Legacy results retain their earlier essential-content safe-stage behavior.

## Manual acceptance

Record actual device/browser/resolution/network, viewing distance and outcome:

1. Laptop contestant + phone host: Choose remains while selecting a tier; Prepare enters Selecting; Reveal is available only after existing primary readiness and no pending command. Reveal can interrupt the intro; cancel returns Choose. Test several consecutive rounds and all available tiers.
2. Check dynamic round/tier/00:10, countdown catch-up, pause/resume remainder, refresh/reconnect, timeout/late judgment, explicit result reveal, Advance and existing final totals. No stale image or hidden answer may flash.
3. Compare logo, black surface, colors, card silhouettes/text, carousel/checklist, image frame and strip against the three comps. Review both wide/non-wide source images, large turn numbers, no overlap/scrolling and timer readability.
4. Check fullscreen enter/exit, keyboard/focus, guides on/off, portrait/landscape and reduced motion. Typography/images must remain readable if font files fail; ordinary gameplay never waits on fonts or decoration.
5. On an actual TV at filming distance and Android landscape tablet, review clarity, motion smoothness, touch/fullscreen and prolonged play. Exercise local Wi-Fi interruption/rejoin and physically disconnect external internet while preserving local networking.
6. Film or edit a representative 9:16 clip, checking clue readability, tier/time visibility and the documented crop limitations. Do not treat viewport screenshots as camera acceptance.

The active `contestant-display-visual-experience` verification record distinguishes executed desktop/browser checks from outstanding physical acceptance. Earlier Game Experience/Photo Library deferrals remain separate. No archive is implied by this guide.
