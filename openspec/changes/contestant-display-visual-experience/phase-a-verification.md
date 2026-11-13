# Phase A — assets and typography

Checkpoint: 2026-11-12, baseline `4bba8b0`. Owner approved implementation with final refinements, limited to Phase A before explicit SVG illustration review. No screen integration, server/shared contract, game rule, timer, persistence, dependency-manifest or completed-MVP change.

## Planning refinements

Proposal, design, visual capability and tasks now record self-hosted Barlow Condensed, exact face usages, local font license/fallback/offline acceptance, continuous restrained selection waiting emphasis after the approved 2.4s intro, immediate Reveal and full-stage/framing-guide distinction. Two explicit font tasks expand the plan from 21 to **23**: 1.4 acquisition/preview and 2.3 later scoped integration/loading regression. Owner approval does not satisfy illustration acceptance; 1.3 stays unchecked.

## Font inventory, evaluation and acquisition

At baseline no WOFF/WOFF2/TTF/OTF font assets existed. The display used Arial Black/Segoe UI fallback stacks. The original comps contain flattened lettering/illustrations only. Barlow Condensed was evaluated in an isolated loaded-browser comparison against existing typography and the Choose comp. Its narrow heavy italic shapes are a closer approximation without stretching text or using image headings; it is not claimed to be the comp's exact font.

Four unmodified Google-served **Latin WOFF2** files, **91,404 bytes total**, are bundled under `public/fonts/barlow-condensed/`:

| Weight / style | Intended role |
|---|---|
| 900 italic | Major headings |
| 800 italic | Difficulty-card and round/tier labels |
| 900 normal | Upright countdown |
| 700 normal | Supporting labels; avoids an unnecessary 600 face |

The upstream SIL Open Font License is retained as `OFL.txt`. `provenance.json` records exact acquisition/source URLs, bytes, retrieval date and SHA-256; binary WOFF2 signatures and every checksum were verified. No extra subset/package was installed. Google Fonts URLs are acquisition provenance only, not runtime references.

`client/src/styles/contestant-fonts.css` supplies local `@font-face` declarations with explicit styles/weights, official Latin unicode ranges, `font-display: swap` and reusable contestant typography tokens/fallbacks. It is **not imported by the application** in Phase A. The isolated review uses it directly; Phase B owns application integration and slow/failed font/layout-shift tests. Other scripts fall back to installed fonts, rather than downloading additional subsets.

## Proposed illustrations and review page

`design-comps/asset-review/contestant-display-visual-experience/` contains three newly authored 400×300 SVGs:

- Squash: flexing victorious wrestler over a prone opponent, with green emphasis rays.
- Competitive: braced mirrored wrestlers with interlocked arms in a tie-up.
- Deathmatch: skull with eye/nose/teeth cutouts inside double-strand barbed wire.

All were visually compared with `B2BED88D-F924-4518-8914-21058B532602.png`. They preserve subject/pose, silhouette contrast and visual weight; anatomy, hands/facial details and barbs are simplified vector interpretations. Owner review decides whether revisions are needed. No emoji, generic UI icon library, actual clue/photo, external image, embedded font, script or full-comp background was used. XML checks verified viewBox, no scripts/foreignObject/image/event handlers and only the internal `#wrestler` reference.

`review.html` / `review.css` is an isolated static illustration/typography contact sheet, not a new game screen/component or final responsive implementation. `artwork-preview.png` and `typography-preview.png` were captured from the actual local browser page and visually inspected. The folder README links all assets and explains how to open it through the existing Vite origin. These assets stay outside `public/` pending approval; Vite's production output does not publish the review page or SVGs.

## Browser and automated verification

An isolated allocated loopback HTTP server served only repository review/font assets; desktop headless Chrome used a disposable profile, no application database or game API. External HTTP requests were intercepted/blocked. All four declared faces reached loaded state, with exactly four local WOFF2 requests, three decoded SVGs, no horizontal page overflow at the 1600px review viewport and **zero external application requests**. A deliberate external request was blocked as a control check. Barlow's CHOOSE YOUR MATCH sample measured about 386px versus 650px in the previous stack at the same 52px size. The saved comparison shows 900 italic, 800 italic, 900 upright and 700 upright, plus unsupported-script fallback text. No claim of Android or physical internet disconnection follows from this desktop check.

- `npm test`: **707 passed in 46 files**; existing unit/component/API/socket/persistence/import regressions. Log: `/private/tmp/ntm-visual-phase-a-tests.log`.
- `npm run typecheck`: passed.
- `npm run lint`: passed, zero warnings.
- `npm run build`: passed, client and server. Log: `/private/tmp/ntm-visual-phase-a-build.log`. Application CSS/JS hashes remain the same as the pre-Phase-A build, consistent with no screen/style import integration. All four font binaries/license are present in built local assets.
- Final strict visual-change validation passed; strict existing MVP validation passed; whole-project strict validation passed **6 items, 0 failures**, after task tracking updates.
- `git diff --check`: passed. No dependency manifest, application entrypoint/component, server/shared implementation, main capability or archived file changed. No generated build/database files are added to tracking.

Temporary browser diagnostic: `/private/tmp/ntm-visual-assets.cjs` and `.log`; it is an executed asset review harness, not a supported app/npm command. A recapture initially read Chrome's debugging-port marker before its numeric port was written; the harness now waits for a valid port, and the final rerun passed. The review logo URL was also normalized to the Vite-served `/images/` path before final capture. Browser/profile/server resources were cleaned. The saved previews and manifest are durable review evidence.

## Review gate and remaining work

Tasks **1.1, 1.2 and 1.4** are complete: **3/23**. **1.3 requires explicit owner illustration approval.** No Phase B–G task is complete, and no illustration/typography is integrated into game screens. Required review is all three proposed illustrations, individually or in card context; request revisions or approve them before integration. The overall font/proposal approval is not that artwork approval.

External TV, Android, real Wi-Fi/offline, filming/reel crop, prolonged game sessions and application font-loading layout acceptance remain unperformed/open. This asset browser check does not close earlier MVP/Photo Library deferrals. No archive, commit or push performed.
