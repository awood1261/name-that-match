## Context

See proposal.md for motivation and `specs/contestant-display-visuals/spec.md` for CV-01–10 acceptance. Baseline is commit `4bba8b0` after the completed 46-task `game-experience-mvp` implementation. The working tree was clean before this planning change. Existing MVP evidence is historical and retains its physical-device deferrals; the owner's recent phone-host/laptop-display test established operation after explicit pending-command review, not full Road acceptance.

### Inspected comp inventory

All five files under `design-comps/screen-updates/` were opened and visually inspected. Filenames are opaque identifiers, so preserve this mapping:

| Filename | Screen / observed composition | Scope |
|---|---|---|
| `B2BED88D-F924-4518-8914-21058B532602.png` | Choose Your Match: centered horizontal logo, italic heading flanked by purple slashes, three green/yellow/red rounded heavy-frame cards, white wrestler/grappling/skull art, angled colored point badges | Primary |
| `0B139A38-269C-4521-B2E9-627CAEAE358F.png` | Selecting Match: logo/italic title, seven perspective cards with yellow center and purple sides, lower left scan panel/bar, lower right four-step checklist | Primary |
| `6B6C3FBD-151A-4DF6-B309-37002D200F81.png` | Screenshot/countdown: logo, dominant yellow-frame Rock/Austin example, angled bottom ROUND 03 / COMPETITIVE MATCH / 00:10 strip with purple separators | Primary; picture/numbers are examples, never hardcoded game data |
| `1C862D7C-A93D-41FE-89BA-3C38E2742F70.png` | Correct: dimmed example clue, green frame/check/brush underline, large CORRECT!, +2 POINTS | Reference only; no result redesign |
| `785D5517-AC79-448A-A1D8-578ABFB078BF.png` | Incorrect: dimmed clue, red frame/cross/brush underline, large INCORRECT! | Reference only; no result redesign |

### Existing implementation and gaps

`ContestantDisplay.tsx` currently combines local credential/phase interpretation, logo/contestant/tier headings and a generic flex composition. Setup/between-round labels are Waiting for the host / Choose your challenge; between rounds renders `GameScoreboard` inside a large framed clue region. Preparing/Ready use the same empty region and covered explanatory copy. Guessing renders the contained local image inside purple framing with a separate large two-digit timer. It has no comp tier cards, carousel, scanning scene, compact round strip or MM:SS format.

`ContestantStage.tsx` and its CSS Module uniformly fit a 1080 × 960 stage via a resize observer and a single scale custom property; its guide currently outlines that whole stage. `DisplayControls` owns optional user-gesture fullscreen and guides outside the stage. `useContestantDisplay` owns shared live observations, staleness, authenticated HTTP Blob/decode, readiness and remaining-time interpolation; it is reused without networking changes. `Countdown` already computes the monotonic ceiling/clamped count and uses `aria-live=off`. `ResultPresentation` and `GameScoreboard` have dedicated CSS Modules and must keep their existing result/final behavior.

Public projections already expose phase, contestants, selected tier, roundId, turnOrdinal, turnsExposed and appropriate remainingMs. They do not expose tier pool availability, speculative host tier selection or private metadata before result reveal. Preload/decode of selected image bytes is an existing authenticated readiness feature; this change prevents visual mounting before Reveal rather than pretending the bytes are absent from an authorized viewer's memory. No transport contract is required for this plan.

Only `public/images/name-that-match-horizontal-logo.png` and `public/favicon.ico` are standalone runtime assets. No source illustrations or local font files exist (inventory includes WOFF/WOFF2/TTF/OTF). The five comps are flattened references, not runtime assets.

## Goals / Non-Goals

**Goals:** faithful comp hierarchy across the three specified phases; spoiler-free bounded anticipation; dominant unmodified clue; exact existing timer semantics; clear component/style boundaries; offline assets; measurable responsive/accessibility acceptance.

The later owner-approved held-clue section records the implemented result baseline. Approved D9 below explicitly refines correct-result composition only; original baseline observations and verification remain historical.

**Non-Goals:** any server/shared domain/live-contract/persistence change, game rule or selection change, new package dependency/animation library, host control or pending-command redesign, scoreboard feature, incorrect/timeout/void or final-game redesign, sound, random library previews, asset extraction from full-screen comps or automatic reveal/progression. Archive is a later explicit action after acceptance.

## Decisions

### D1 — Public phase mapping, not a new game machine

Keep authoritative interpretation at `ContestantDisplay`; an exhaustive small presentation mapping/helper may be introduced only to keep branching testable. Do not store a second phase in React or add transition timers that decide game progression. Every render first applies missing credential/stale/error priority.

| Observed public state | Presentation | Transition / recovery |
|---|---|---|
| No credential, no snapshot, stale/disconnected | Existing distinct join/connecting/error cover and Retry | Never show stale clue or hold it for an exit animation |
| `setup`, `between_rounds` | Choose Your Match | Host tier dropdown changes do not affect this; cancellation/failure's public between-rounds returns here |
| `preparing`, `ready` | Selecting Match | Same scene across both phases; real ready/decoded status stays on host; no minimum hold before Reveal |
| `guessing` plus decoded image and current synchronization | Screenshot/countdown | Read only actual round and interpolated remaining time; fresh/refresh entry skips intro animation |
| Guessing with missing/failed image | Existing image unavailable/loading cover | Never use a decorative image as a gameplay substitute or bypass readiness |
| `paused`, `awaiting_judgment`, `interrupted`, `adjudicated` | Existing respective covered phase | No new result/metadata, no screenshot exit crossfade |
| `answer_revealed`, `completed`, `discarded` | Existing result/score/final/closed presentation | Preserve current 1080 × 960 composition and result animation semantics |

Actual round label comes from public `turnOrdinal` during guessing, padded to at least two digits without truncating 100+. Cancelled preparations do not increment it. Do not use session attempts, a local increment or `turnsExposed + 1`. Existing read-only contestant rules remain.

Alternative: model Selecting as a persisted state or add tier-selection observations. Rejected: unnecessary network/game changes when Preparing/Ready and current public data already express the desired pacing.

### D2 — Focused presentation components and CSS ownership

Names below are proposed paths colocated under the existing `client/src/game/` convention; tests remain under `tests/client/` as established.

| Component / file | Responsibility | CSS Module boundary |
|---|---|---|
| Existing `ContestantDisplay.tsx` | Select safe public scene; keep credential/error/result lifecycle; choose stage variant; compose existing controls | `ContestantDisplay.module.css`: outer display and existing legacy composition; new modifiers scoped to targeted screens |
| Existing `ContestantStage.tsx` | Geometry/resize measurement only; named landscape/compact/legacy variants; optional centered guide | `ContestantStage.module.css`: logical dimensions, single uniform scale, clipping of decoration and guide overlay; no business state |
| New `ChooseMatch.tsx` | Semantic list of three fixed tiers using `GAME_TIER_DETAILS`; reviewed local illustrations, label and point badge | `ChooseMatch.module.css`: card grid/compact rows, tier borders, angled badges and heading accents |
| New `SelectingMatch.tsx` | Bounded decorative art/checklist/scan composition; presentation entrance flag from observed transition | `SelectingMatch.module.css`: limited transforms/opacity, static depth/glow, scan/checklist sequence and reduced motion |
| New `ScreenshotRound.tsx` | Existing image URL, actual turn ordinal/tier, existing remaining/time observation; contained image and strip | `ScreenshotRound.module.css`: yellow clue frame, strip, separators, responsive type and urgency treatment |
| Existing `Countdown.tsx` | One existing interpolation loop; optional clock-format output with default seconds format preserved for host/legacy users | No new authority or second interval; clock mode exposes urgency based on its already computed remaining seconds |
| Existing `DisplayControls`, `ResultPresentation`, `GameScoreboard` | Reuse unchanged controls and result/final renderers | Their CSS Modules remain isolated; new screen styles must not leak into host/admin or legacy results |

Logo placement is owned by each screen composition, using the same local source; no generic theme/rendering framework is needed. Fixed-size illustrative SVGs have explicit viewBox, deterministic IDs if any, no scripts/external references and decorative accessible treatment; surrounding text carries meaning.

Alternative: expand the monolithic phase JSX/CSS or introduce global presentation state/context. Rejected: hard to test/scopingly style; no shared business state is needed.

### D3 — Reviewed offline assets and typography

Owner selected faithful local SVG recreations of victorious wrestler, grappling pair and barbed-wire skull, with review before integration. Plan standalone assets under `public/images/contestant/`; do not create them in this planning turn. An isolated contact sheet/preview and comparison against the Choose comp are implementation evidence, followed by an explicit integration gate. No emoji, generic icon substitutions or traced full-screen background is acceptable. If faithful art cannot be achieved, stop for owner direction rather than silently substitute.

The owner's final refinement supersedes fallback-only typography: self-host Barlow Condensed in `public/fonts/barlow-condensed/` using the minimum four Latin WOFF2 faces: 900 italic for major headings, 800 italic for card headings and information-strip labels, 900 upright for countdown, and 700 upright for supporting labels (600 is unnecessary). Compare the real loaded faces against current Arial Black/Segoe UI and the comp at an isolated Phase A preview before screen integration. Barlow's narrow heavy italic letterforms approximate the comp more closely; it is not a claim of the comp's exact original typeface.

Retain upstream SIL Open Font License and provenance/checksums; no runtime Google Fonts CSS or external requests. `@font-face` declarations use explicit local URLs/weights/styles, `font-display: swap` and the official Latin unicode range. Use contestant-specific CSS custom properties/fallbacks with explicit role weight/style, not repeated family literals or global font replacement. Supply the reusable font stylesheet during Phase A but leave it unimported by the application until Phase B. The isolated review page loads it directly. Unsupported scripts use existing offline fallbacks; no extra subset or synthetic weight is requested. Phase B reserves geometry and verifies slow/failed font fallback and successful load without disruptive shifts. Phase A tests local font fetch/render with all external HTTP blocked; physical internet-disconnected acceptance remains separately required. Font acquisition is approved; adding npm packages is not.

For the shuffle, reuse these non-identifying illustrations in abstract wrestling/ring card compositions made from CSS; no photographic library/previous-round imagery, sampled comp wrestler photos or hidden candidate. This preserves the carousel visual language without real identities. Alternative prior-exposed images is permitted by the request but rejected here to avoid repeat/spoiler confusion and extra data ownership.

### D4 — Decorative motion, bounds and privacy

Proposed intro budget: 2.4 seconds, independent of readiness. Seven bounded decorative cards in landscape (at most three in compact view), center yellow and static side perspective/depth. Use transform/opacity movement in short staggered passes, not per-frame React updates, animated blur or moving expensive box-shadows. The scan fill advances cosmetically over that intro. Checklist activation occurs at 0, 0.6, 1.2 and 1.8 seconds; final Selecting stays active. Limit each pass to an initial finite sequence; afterward retain continuous subtle center-card/selection-indicator opacity emphasis on a slow three-second cycle. The center frame glow remains static to avoid costly shadow animation; no restarting checklist or fake percentage. This sustained waiting activity is explicitly approved and never gates Reveal.

The visual scan is not an ARIA progressbar and never displays measured percentages. Provide a non-intrusive accessible description such as “Match selection presentation; waiting for host reveal.” Hide repetitive decorative art/checklist from assistive output while retaining one semantic state heading. Documentation explains the theatrical checklist is not recognition/analysis; do not add fake promises to normal host status.

Intro plays only on an observed connected Choose→Preparing/Ready transition keyed to roundId. Preparing→Ready, same-revision updates and asset decode do not restart it. Initial load/reconnect into Preparing/Ready renders the settled scene. A briefly skipped Preparing observation does not prevent Ready entry. Cosmetic entrance tracking is not a game state machine. CSS owns the finite sequence; React only supplies initial/settled entry treatment and existing phase changes. Dispose any one-shot cosmetic jobs on exit. Reduced motion renders settled art/checklist immediately and removes continuous movement/pulse/entrance transforms; it remains a fully styled static selection presentation.

Scene entrances use at most 180ms opacity/short transform, but never animate clue reveal opacity from zero or gate actual countdown. Once guessing arrives, the decoded screenshot and authoritative time appear in that render; do not wait for carousel completion, crossfade the old selected image, reset a clock or retain clue exit layers. On cover, judgment, pause or stale state, remove the clue immediately. No new game mutations, randomness, authoritative timers/schedulers, socket subscriptions, image prefetches or visibility/readiness owner.

### D5 — Reveal composition and one countdown

Landscape proportions track the reveal comp: shallow centered logo zone, dominant flexible clue zone and compact lower strip. Use thick yellow framing and rounded corners from contestant-only tokens, black letterboxing and `object-fit: contain`; border/clip must not crop pixels. Round and tier labels are dynamic, no identifying metadata or persistent scoreboard. Existing result/final renderer remains reachable after judgment/Reveal Result.

Extend `Countdown` with an optional `format="clock"`, defaulting to its current seconds rendering. Format its already computed clamped/ceiling seconds as `MM:SS`, retaining its monotonic observations, single 50ms presentation interval, role/accessible seconds label and `aria-live=off`. In clock mode its existing computed value can provide steady urgency styling and an accessible final-seconds label at <=3 seconds. No second clock in ScreenshotRound, CSS countdown, extra server probe or local expiry transition. Host countdown output remains unchanged. Alternative a separately ticking round strip is rejected because it duplicates timer ownership.

### D6 — Landscape stage, compact layout and explicit crop limitation

Owner chose 16:9 landscape composition with the existing centered 1080 × 960 guide and narrow-screen adaptation. For the targeted scenes use a 1920 × 1080 logical landscape stage, uniformly fitted to available width/height. The guide occupies centered x=420..1500, y=60..1020; default off and outside interaction. This changes the previous full-stage crop guarantee explicitly, not by silently widening the old safe stage.

Keep the source screenshot fully contained in the entire clue frame. A center crop of a wide screenshot necessarily loses side content; describe the guide as a framing reference for these scenes, not a certificate that every clue/card survives cropping. Center the tier/timer and keep priority text near the guide where practical, but never distort, crop or reduce the full clue solely to make an impossible crop guarantee. Filming acceptance must inspect actual 9:16 edits; a 1080 × 960 guide itself is not a 9:16 crop.

For available viewport aspect ratio below 1, use a named 1080 × 1440 compact composition, uniformly fitted once. Three choose cards become stacked horizontal cards with illustration/label/badge within each; selection reduces to three cards and stacks scan/checklist; strip wraps into stable explicit rows while preserving timer prominence. Guide remains centered 1080 × 960, so its meaning does not silently change. No per-device fork, scrolling filmed panel or viewport-sized text multiplied by a second scale. Reuse resize measurement to select geometry by the available container, handling toolbar/fullscreen dimensions rather than user-agent guesses; clean measurement ownership on unmount. Legacy phases retain 1080 × 960, so their existing typography/result layouts are not redesigned. A geometry change on actual phase transition is intentional; no jitter/reflow within a countdown.

Centralize additive contestant-only custom properties under `[data-contestant-stage]` in `tokens.css`: true black surface, strong white, comp neon green/yellow/red/purple, frame widths/radii, display type sizes and scene motion durations. Do not globally redefine admin success/error/font tokens. Existing optional stage dimensions continue to be semantic variant properties. Borders/glows are restrained/static; text/badges communicate tier independently of color and meet contrast expectations. No Tailwind, inline layout logic, !important or selector leakage.

Verify 1920×1080, 1366×768, 1024×768, 1024×600, 768×1024 and 375×667 with controls visible/fullscreen where supported. Check dimensions, screenshot containment, all cards, round 100+, tier text, no overflow, focus and reduced motion. Controls remain reachable outside filmed stage; fullscreen is optional/user-gesture and existing opener isolation remains intact.

### D7 — Availability, faults and verification ownership

No public pool information exists. Preserve the current host's exact eligible screenshot/distinct-match counts, empty/exhausted messages and disabled Prepare rules. Choose cards describe tiers, not live availability; do not add unavailable badges, private status fetches or socket changes. If a later product decision needs public availability it is a separate explicit contract approval.

Keep existing `useContestantDisplay`, live/clock/readiness and server behavior. Test missing credentials, decode failure, stale/high-RTT connection, refresh, existing pause/resume, expiry and pending-command recovery as regressions. The recent phone issue was an unresolved command safety gate, not a display asset defect; this visual scope does not change that gate or host UI.

Automated: targeted scene/mapping/Countdown tests plus existing client/live/domain/API/privacy/import suites. Component tests assert behavior/roles/public fields, not animation delay completion or CSS-module hashes. Real browser checks measure containment/no overflow, inspect reduced motion, screenshot fidelity and cleanup. Verify hidden clue has no rendered image/background layer during selection even while authenticated preload exists. Full commands: npm test/typecheck/lint/build, strict new change, strict existing MVP and whole-project OpenSpec validation, git diff/tracking audit. Physical checklist below is separate evidence, never inferred from viewport emulation.

### D8 — Upstream specification ordering and review gates

`game-experience-mvp` remains unarchived; `openspec/specs/game-display` does not yet exist. Introduce only `contestant-display-visuals` now, with CV-07 explicitly declaring the narrow GD-04 override and CV-02 the between-round content refinement. Do not invent duplicate main capabilities or edit the completed MVP's artifacts/evidence during this work. All other GD-02/03/05/06/07, GR, GS and GN requirements remain.

Before visual archive, the owner must separately authorize upstream MVP archive/sync or an explicit coordinated sync. Once `game-display` is materialized, reconcile its GD-02/GD-04 current wording to reference the approved three-scene visual capability: three scenes use landscape/compact geometry plus a framing-only guide; legacy/result phases retain the original safe stage. Replace GD-04's unconditional entire-clue center-crop scenario with this scoped distinction, preserving full-image containment on the actual display and legacy essential-content guarantees. Review/strict-validate that current-spec reconciliation before archiving this change. This is an explicit closeout dependency, not permission to archive/sync now or rewrite historical records. If upstream closeout is not authorized, report this archive blocker; implementation review can still occur.

Planning approval is required before code/assets. The approved SVG recreation approach still has an owner asset-review gate before integration. Physical acceptance must be performed, or remain open pending explicit owner disposition of that named check; unlike the earlier MVP checkpoint, this plan does not silently mark the whole final acceptance task complete on a list of deferrals. No archive without a separate request.

## Risks / Trade-offs

- [Landscape fidelity versus crop] → Owner-selected landscape takes priority for these scenes; centered guide retained without promising whole-image crop safety. Physical filming/crop review is required.
- [Legacy result geometry differs from new scenes] → Keep results intact as requested; test the intentional phase-to-phase fit change and avoid layout shifts within guessing.
- [Missing source art / exact comp typeface] → Reviewed faithful local SVGs and approved self-hosted Barlow Condensed approximation; no generic substitutions, runtime CDN or package dependency.
- [Decorative checklist implies recognition] → Generic art, accessible theatrical description, no real progress semantics or runtime analysis claims.
- [Animation delays clocks/readiness on budget tablets] → Bounded card count/static filters, transform/opacity only, settled/reduced-motion fallback; no waiting gate on Reveal or independent timer.
- [Private image appears in a transition] → No prepared image mounted before guessing and immediate removal on cover/exit; reuse existing safe adapter.
- [Global token/Countdown change affects host/results] → Additive stage-only tokens and opt-in formatting with default-output regression tests.
- [Two active changes and overlapping display requirements] → Explicit refinement/override and upstream synchronization dependency in D8; no silent archive ordering.

## Migration Plan

No database, transport or package dependency migration. Local font assets/notices are bundled with the Vite public directory. After proposal/design approval, prepare/review local assets, then implement the scoped components/geometry/formatting and tests. Build with installed dependencies, using disposable local data for browser/recovery checks. Rollback is the prior client/assets build with unchanged server/data; do not reset sessions or modify original captures. Preserve `NAME_THAT_MATCH_DATA_DIR` and existing WAL-safe backup guidance. Update current Studio/Road operation and crop guidance after implemented behavior is verified; do not rewrite prior milestone evidence.

## Acceptance checklist and review

Record device/browser/resolution/network/viewing distance and actual outcomes for: laptop contestant/fullscreen; external TV readability; Android landscape touch/performance; phone host + laptop contestant; local Wi-Fi with external internet physically disconnected; 9:16 filming/crop with guides on/off; wide and non-wide real screenshots; consecutive rounds/cancellation; pause/resume, refresh and disconnect/reconnect. Compare the three updated screens with their exact comps; validate timer visibility, image clarity, motion smoothness, no unintended shifts/scrolling, contrast/focus and reduced motion. Results/finals must remain unchanged. Unperformed physical checks remain open with their limitations; owner disposition is required before final acceptance/archival.

No unresolved product choice is delegated to implementation. Exact SVG fidelity and physical evidence are explicit review/verification gates, not authorization to replace the approved design or claim unperformed checks.

## Owner implementation authorization

The final refinement request approves this architecture and mappings with local Barlow Condensed and continuous restrained waiting motion. Phase A is authorized after artifact validation. Stop at the SVG artwork review checkpoint; no illustration integration, Phase B screen foundations, result redesign or archive is authorized before that approval. The 21-task plan is expanded to 23 tasks by explicit font acquisition/preview and later font-load regression tasks; all additional work is within the requested typography scope.

## Illustration integration approval

The owner approved all three Phase A illustrations, conditional on component-level integration: each tier card renders an independent local SVG image element alongside semantic heading/points text, never a background image or flattened card. Approved source files are the three SVGs in `design-comps/asset-review/contestant-display-visual-experience/`; runtime copies will live under `public/images/contestant/`. This approval releases the Phase A gate and authorizes the remaining scoped implementation/verification phases. Physical acceptance and upstream sync/archive remain separate gates. A small shared CSS Module may own repeated scene logo/title spacing; each new screen retains its own CSS Module and focused tests.

### Implemented font fallback refinement

Blocked-font browser testing exposed wrapping with the wide Arial Black fallback. The contestant-only fallback family now maps existing local bold/italic fonts with a 60% size adjustment and explicit vertical metrics to approximate the condensed advance widths. It adds no downloadable face/dependency and keeps original host/admin fallback families intact. Fixed scene rows reserve layout during font swap; verify both blocked and delayed local fonts across target viewports.

## Owner-approved held clue and result references — 2026-11-12

Use 1C862D7C-A93D-41FE-89BA-3C38E2742F70.png for correct feedback and 785D5517-AC79-448A-A1D8-578ABFB078BF.png for incorrect/timeout under design-comps/screen-updates. These references are reviewed, not runtime assets. Extend ScreenshotRound with explicit running/frozen/unknown presentation; keep it for awaiting judgment/adjudicated, preserving the 16:9/compact stage. Existing Pause/interrupted/stale covers remain. Behind Reveal Result only, compose actual contained clue + dimming, semantic check/cross SVG, green/red glowing frame, bold italic outcome, dynamic earned points and existing frozen answer details/score summary. Timeout says TIME UP; void stays distinct. Use local Barlow/logo and CSS Modules/tokens, no dependencies. GR-10 supplies authoritative persisted stopped time and image lifecycle. Legacy missing time is unavailable; image failure keeps result/answer accessible with an explicit fallback. Geometry/reduced-motion checks include both image ratios and long metadata; physical deferrals and archive gates stay open.

## Owner-approved tier names — 2026-11-13

Choose cards and screenshot strips use the shared labels Easy / Medium / Hard. Preserve the reviewed SVG illustrations byte-for-byte, their existing filenames, colors/data-tier hooks and 1/2/3 points. Original comps remain visual references; their old tier words are historical and superseded. No layout/animation/classification change. Existing component and host/library tests must verify the new accessible labels; physical acceptance/closeout gates remain open.


## D9 — Approved Correct Match result-screen refinement — 2026-11-14

### Scope and exact visual reference

`/Users/alexwood/Dev/name-that-match/design-comps/reveal-improvements/Correct Match_ Dusty Rhodes vs. Honky Tonk Man.png`

The PNG was opened and visually inspected on 2026-11-14. It is a 16:9 flattened visual reference, not a runtime asset or a functional rule source. The active change already includes held-clue/green-red result presentation under CV-12 and completed tasks 9.1–9.3. This explicit approved scope update adds CV-13–15 and tasks 11.1–11.7 for revealed correct results. The comp and CV-13–15/D9 specification/implementation are owner-approved as of 2026-11-14 (“spec looks good and you can proceed”). No new change is created while this active result-capable change exists.

For correct results, D9 supersedes the older `1C862D7C-A93D-41FE-89BA-3C38E2742F70.png` composition and the earlier D2/D6 instruction to leave result visuals unchanged, under the recorded owner approval. It does not replace CV-12's held-clue rules, red/void treatments, D6's existing landscape/compact geometry and crop limitations, or any completed/final screen. Do not alter previous evidence to suggest the new design was already implemented or tested.

### Observed hierarchy and data binding

| Priority / region | Observed design and intended dynamic presentation |
| --- | --- |
| Brand / utility chrome | Local horizontal logo above the main frame; restrained fullscreen and guide icons at the upper right. Controls are operator utilities outside the scaled filmed content. |
| Primary outcome | Oversized white condensed italic **CORRECT!**, green circular check, brush underline and green/white success frame/glow. Text and check convey success independently of color. |
| Match identity | Large dark, yellow-bordered angled panel over the lower image region. THE MATCH WAS is secondary green text; wrestler/team description is dominant white; promotion/event/known year form a distinct supporting line. |
| Earned points | High-contrast green banner with dark text, e.g. +1 POINT EARNED. Use the committed `award`, singular/plural and actual 1/2/3-point values. |
| Contestant and total | Compact yellow-bordered bottom strip: round owner's name, purple separator and that contestant's committed total. The comp's STRIPES / 10 POINTS are examples. |
| Background | The actual revealed wrestling image remains recognizable behind the outcome and identification panel, dimmed enough to support contrast. Preserve source ratio/containment; do not crop it to reproduce the photographed comp. |

Use only the already revealed public snapshot: `answer`, `contestantId`, contestants/scores and committed `award`. The owner/total comes from the round's contestant identity, not a possibly different future active contestant. A two-contestant session retains access to both existing projected totals in a subordinate compact row or existing read-only score details; this is not a new score ledger/history feature. Date presentation derives the known year from the frozen partial date; omit unknown year and preserve full known precision in details. Do not infer a date/promotion/event from the reference filename, screenshot or source video. Optional stipulation remains available in full details. Under the owner-requested 2026-11-18 refinement, a known championship appears on its own subordinate line immediately below promotion/event/year; omit missing/blank values. Include it in density/refit measurement and apply the existing measured-overflow summary when needed, retaining complete championship text in Full match details. No parsing, title inference or game-rule change.

### Component and styling responsibilities

- `ResultPresentation.tsx` delegates to focused `CorrectResult.tsx` / `CorrectResult.module.css`; the existing result CSS Module retains other outcomes. Scope the new arrangement to `outcome === 'correct'`; compose real image, semantic success headline/check, identification panel, earned banner and compact round-owner strip. Reuse the existing local logo, Barlow faces, SVG/CSS motifs and image-error fallback. Keep final/incorrect/timeout/void presentation and private/public score rules intact.
- `ContestantDisplay.tsx` / its CSS Module: retain the existing reveal/staleness/credential gate and public observation adapter; compose optional local full-match details outside the filmed stage if needed. No extra public phase, mutation, subscription, visibility/readiness owner or countdown.
- `DisplayControls.tsx` / its CSS Module: a correct-result-specific compact visual variant for local fullscreen/guide utilities. Small icons retain accessible names, visible focus, pressed state and at least 44 × 44 CSS-pixel targets outside stage scaling. Preserve explicit fullscreen gestures, Escape and refusal messages; no automatic fullscreen or hidden controls on focus.
- `ContestantStage` remains geometry-only with the existing one-scale landscape/compact variants and centered guide; no device-specific renderer or second text scale. Add only reusable contestant-scoped tokens to `tokens.css`; no global host/admin overrides, Tailwind, inline styling system or new dependency.
- `stageAnswer` currently truncates participants to 120 characters. Do not silently apply that old limit to the new primary correct-result panel or change the shared helper for other scenes. Use a correct-result-specific presentation policy that preserves full frozen data and the full-detail fallback described below.

### Responsive and long-content policy

Use the existing 1920 × 1080 landscape and 1080 × 1440 compact compositions, uniformly fitted from available dimensions; keep the 1080 × 960 guide optional/default-off. On laptops/TVs/landscape Android, preserve the image-backed outcome → identification → points → score hierarchy. In portrait Android/phone layouts, reduce decorative check/logo/headline space first, allocate more height to the multiline identity, then stack promotion/event/year and contestant/total rows as necessary. No clipped banners, overlapping chrome, hidden names or horizontal page overflow. Image stays contained in its available background region. A central recording crop still cannot promise the complete screenshot or every identity panel survives; document actual filming checks.

Wrap at natural spaces/team separators, keep all competitors distinguishable and allow a multiline participant panel before reducing type. Test long singles names, team names and four-/six-person descriptions beyond the current 120-character excerpt, plus long promotions/events. At phone reference sizes, primary identification must remain readable (target at least 14 CSS pixels for names at 375 × 667), not shrink until it technically fits. Do not automatically scroll, rotate or animate names, or rely on hover/title/ARIA-only hidden text.

For the maximum supported metadata (1000-character participants; 500-character promotion/event and optional fields), a fixed non-scrolling filmed stage cannot guarantee full readable prose. Use an explicitly marked bounded summary only when wrapping/readable sizing cannot fit, with a visible, keyboard/touch-accessible **Full match details** disclosure outside the scaled filmed stage. It exposes the complete already-revealed frozen answer as readable normal-flow text. This local disclosure sends no game command, changes no timing/score, remains available on narrow screens and does not alter unrevealed privacy. Routine long/multi-person acceptance fixtures must show their full identifying names in the main panel; the maximum-length fallback cannot be a substitute for that requirement. Confirm the exact density breakpoints/line budget against rendered fixtures during implementation.

### Invariants and acceptance

No green outcome, answer identity, earned award or changed score appears before the existing host **Reveal Result** (`answer_revealed`). Ordinary adjudication/expiry continues to hold the clue and frozen/zero countdown without result disclosure. Render stored score totals; never add the award locally or recalculate scores from the comp. Refresh/reconnect restores committed data without scoring, replaying a required entrance, auto-advancing or resuming. Reduced motion is static; image/font failure keeps readable result information and an explicit image fallback. Use local assets/fonts and no runtime internet.

Browser comparison matrix: 1920 × 1080 TV-sized viewport, 1366 × 768 laptop, 1024 × 768 and 1024 × 600 Android-sized landscape, 768 × 1024 portrait tablet, and 375 × 667 plus 390 × 844 phone-sized viewports. Include solo/head-to-head, awards 1/2/3, long names/multi-person/maximum fields, partial/missing dates, failed image/fonts, reduced motion, 200-percent text/zoom, guides/fullscreen and restoration. Measure actual name legibility/overflow/control targets, not just DOM presence. Run the existing npm test/typecheck/lint/build and strict change/upstream/whole-project validation. Separate physical laptop/TV viewing distance/Android touch/phone/Wi-Fi/offline/filming outcomes from local viewport evidence in still-open 7.2/7.3 and new task 11.7. No implementation or physical check is marked passed by this planning update.

## D10 — Owner-approved incorrect and expired result extension — 2026-11-18

The owner explicitly requested the same treatment for incorrect and time-expired screens. This supersedes D9’s correct-only component boundary and the incorrect/timeout visual exclusions above; historical evidence and completed tasks remain intact. Use the hierarchy of `/Users/alexwood/Dev/name-that-match/design-comps/reveal-improvements/Correct Match_ Dusty Rhodes vs. Honky Tonk Man.png` with existing red feedback from `design-comps/screen-updates/785D5517-AC79-448A-A1D8-578ABFB078BF.png`.

Generalize CorrectResult into MatchResult.tsx/MatchResult.module.css for correct, incorrect and timeout, retaining one layout and measured Unicode-safe text-fitting policy. Outcome data attributes select local green/red accents and semantic check/cross. Incorrect says INCORRECT!, timeout says TIME UP; both display their authoritative 0 POINTS EARNED without a plus prefix. Keep the yellow identity panel, frozen show/year and optional championship beneath it, immutable round-owner/projected totals, actual contained image, accessible full-details disclosure and compact controls. Extend CV-14/15 responsive/offline requirements to both outcomes, including long names/championships at laptop, TV, Android and phone reference sizes.

No result content appears before explicit Reveal Result. Expiry holds the clue at zero until the existing timeout judgment and reveal steps. Incorrect holds the clue at its stopped time until reveal. Do not change server/shared contracts, scoring, clocks, transport, readiness, phase transitions, void or final screens. Extend physical acceptance 11.7 to all three result outcomes; never infer device acceptance from viewport tests.
