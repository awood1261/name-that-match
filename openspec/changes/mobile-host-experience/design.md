## Context

See `proposal.md` for motivation and `specs/mobile-host-controls/spec.md` for MH-01–06. Owner preference: normally portrait phone host, separate laptop contestant display. This is a proposed presentation change; implementation and layout approval are separate gates.

Observed implementation:

- `HostPage.tsx` mounts `useGameHost` once. Display setup, full `GameScoreboard`, completion controls, session selection and tier cards precede the round card. Error/pending recovery is at page top. The private answer is collapsed. This explains the repeated long scroll between readiness, commands and recovery.
- `HostPage.module.css` stacks two-column panels and three tier cards at 768px and makes action buttons full width. Targets already have 44px minimum height; responsive stacking alone does not change information priority.
- `HostRoundControls` already maps phases to commands and uses the existing `Countdown`; `HostDisplayPanel` owns local link/request state and imports the large `ContestantJoin` UI. They share the page CSS Module.
- `App` has a large logo/navigation/one-time health badge and defaults to System. The health badge is not live game readiness. App navigation already invokes the host's leave guard.
- `tests/client/game-host.test.tsx` and `host-round-controls.test.tsx` cover command gating, setup, ownership, advancement, pending receipts, End/New and guarded navigation. Real socket suites own transport/recovery conformance. No mobile layout certification follows from jsdom.

The active gameplay change is implemented (65/65 tasks) but not archived; its later refinements define 30 seconds, held clues and Easy/Medium/Hard labels. The contestant visual change has remaining acceptance gates. This proposal neither closes those gates nor copies gameplay requirements into a competing specification. The new capability adds host presentation constraints only.

## Goals / Non-Goals

**Goals:** Use the existing authoritative projections to make routine filming actions and their blockers easy to find on a portrait phone. Keep supporting operations usable without moving them ahead of each round. Review layout states before changing code.

**Non-Goals:** Transport/lease/receipt redesign, polling, browser-local authority, new game phases, rules, dependencies or schema; contestant scene and admin redesign. No new automatic LAN configuration or promise that localhost works from another device. Existing explicit window/fullscreen gestures remain.

## Decisions

### D1 — One mounted host owner, presentation children

Retain `useGameHost` in `HostPage` and its existing command gate (`credential`, connected, not busy/pending, permitted action). Derive display information from the same snapshot; round identity uses `round.contestantId`. Pass observations/callbacks into children. Do not fork mobile/desktop trees or create a second hook/subscription. Reordering is insufficient alone because supporting panels would still dominate; a separate mobile route/store would duplicate lifecycle and recovery work.

Keep existing functional boundaries and add only focused presentation boundaries where needed:

| Component / module | Responsibility |
| --- | --- |
| `HostPage` / `HostPage.module.css` | Ordered layout, setup/terminal branch, compact identity/totals, expandable support sections, existing navigation guard. |
| `HostRoundControls` / proposed `HostRoundControls.module.css` | Single phase action group, authoritative timing display, sticky mobile actions and exceptional round options. |
| Proposed `HostRecoveryPanel` / `HostRecoveryPanel.module.css` | Render existing connection/error/pending/readiness messages and applicable callbacks adjacent to actions; no requests, timers or decision authority of its own. |
| `HostDisplayPanel`, `ContestantJoin` | Existing display registration/LAN/QR/open workflow; keep mounted under native expandable content so link/request state survives toggles. Retain existing owned styles unless a concrete local style needs moving. |
| `GameScoreboard` / its existing CSS Module | Full existing ledger in Score details and final results. A compact host summary reads the same projected totals; it does not calculate scores. |
| `App` / `App.module.css` | Play-scoped compact phone header/navigation. Keep library/System presentation unchanged. |

Avoid extracting an all-purpose panel or new state container. Share existing tokens; introduce only meaningful reusable token values if required. Semantic CSS classes/data attributes express phase and warning states; no inline layout system or utility framework.

### D2 — Stable round console and phase map

Use one logical console before support sections; compact heading shows phase, owner or active contestant, tier/points and live connection/primary status. Show concise private participants/promotion/event when the host projection supplies them; wrap long text and offer full optional metadata/filming preview in details. Do not move or disclose this information to the viewer.

| Phase | Primary work | Secondary work |
| --- | --- | --- |
| No session / Setup | Existing roster form, Save/Create, Start | Display connection once session exists; discard confirmation |
| Between rounds | Explicit contestant selector; compact three tier choices/counts; Prepare | Refresh availability with freshness explanation |
| Preparing | Preparation progress / applicable recovery | Cancel preparation |
| Ready | Readiness and Reveal & start | Cancel; candidate revalidation warning and explicit refresh |
| Guessing | Countdown; large Correct / Incorrect, separate Pause | Round options for existing Skip/Void reason/action |
| Paused | Saved remainder, blocker explanation, Resume | Round options; connection setup |
| Awaiting judgment | Explicit correct-before-buzzer attestation; Confirm timeout | Round options |
| Interrupted | Existing explanation and Void interrupted round | Connection recovery |
| Adjudicated | Saved outcome/points; Reveal Result | Existing void exception allows Advance |
| Answer revealed | Advance | Saved result and compact scores |
| Completed / Discarded | Existing final result and confirmed New game | Display/session information |

All commands remain explicit. Keep one DOM action instance per command rather than duplicating desktop and fixed mobile controls. Retain disabled-button semantics and connect the group's blocker explanation with `aria-describedby`. Unknown server phase/permissions must fail closed rather than inventing a fallback action.

### D3 — Recovery in the same work area

Place a visible recovery block directly above phase actions, independent of collapsed support sections. Reuse existing error/notice, pending/check/retry/dismiss callbacks and primary message. Show simultaneous blockers (for example host disconnected plus pending command plus unready primary); do not replace them with a single optimistic Ready label. The server-provided readiness message is sufficient when there is no more specific gate. Generic non-round errors remain visible in setup/final branches.

Reconnect is an explicit control when applicable, receipt review stays explicit, reviewed retry/dismiss remains conditional. Preserve current pending state on rotation/unmount/navigation. Expanding display details helps fix readiness but never bypasses designation permissions. Do not change HTTP timeout, heartbeat, lease or command retry semantics to simplify the UI.

### D4 — Reachable actions and less chrome

Use a single-column phone layout through the existing 768px breakpoint; expand to a round-first main column with supporting details beside/below on wide screens. In active Play only, reduce logo/chrome spacing and put existing navigation behind a named expandable menu on phones. Preserve visible Play identity; label the shell's health status as server reachability rather than live-game readiness. Keep System as the existing entry view; no routing/deep-link change.

Put the phase action group in a bottom-sticky region within the console with a solid token surface and `env(safe-area-inset-bottom)` padding. Reserve layout space; never overlay other controls. Use the 44px minimum target with generous judgment spacing. At short heights (initial design: 600px or less), enlarged text or any verified occlusion case, use normal flow; avoid fixed viewport sizing and dependencies on mobile browser chrome. Responsive tests must demonstrate the fallback rather than assume media queries certify an on-screen keyboard.

Focus follows DOM order. If a phase change removes the focused action, focus the new console heading once; live heartbeat updates never steal focus. Native details/summary supports keyboard disclosure. Keep confirmation dialogs, Stay / Pause-and-leave and beforeunload behavior. Do not announce every countdown tick or move a replacement action under a held key; require a new deliberate activation.

### D5 — Review and verification gates

Before implementation, provide reviewable portrait wireframes for between-rounds, Ready, Guessing, expiry and pending/disconnected recovery, plus support-section placement and desktop fallback. These are host layouts, not reinterpretations of contestant comps. Keep local brand/colors and CSS architecture. Obtain owner layout approval before apply.

Extend existing behavioral client tests for MH-01–06, including retained QR state on collapse, duplicate action prevention, explicit pending recovery, keyboard focus and navigation guards. Use disposable fixtures for real-browser runs at 320 × 568, 390 × 844, 430 × 932, 844 × 390 and 1280 × 800; exercise 200 percent text/zoom and long names/metadata. Record computed target/overflow/focus/sticky observations rather than treating jsdom as layout evidence. Use the existing browser verification approach without adding a browser framework dependency.

Physical acceptance: phone as host and laptop as primary on the same configured LAN, actual safe areas/browser chrome/keyboard, repeated rounds, disconnection and receipt review, explicit Resume, End/New and full support access. Record actual device/browser and observations. If unavailable, record deferred and keep the acceptance task open. Local viewports do not certify physical Road/TV/offline operation or close previous changes' deferrals.

## Risks / Trade-offs

- Sticky controls can consume short-screen space or cover content → normal-flow fallback, safe-area padding and measured focus/keyboard checks.
- Collapsing supporting content can hide a blocker or destroy local link state → readiness summary and recovery stay visible; keep panel mounted; test toggling during a request.
- Reordering/phase changes can lose focus or produce accidental repeat actions → one control instance, meaningful focus restoration, tests for rapid/repeated activation and held-key transitions.
- Compact totals may diverge from full ledger → consume the same snapshot, preserve round owner and private-vs-public score rules; no local scoring.
- Play-specific header affects shared shell → scope to Play, retain navigation guards and test library/System regressions.
- Existing active specs have historical wording/refinements → reference their current contracts; do not revise archived history, synchronize prematurely or change transport/scoring in this change.

## Migration Plan

No data/API migration or dependency installation. After layout approval, implement presentation incrementally against existing tests, verify production/browser/device flows, and document results. Rollback restores the prior host components/styles and Play-scoped chrome while preserving all server data, commands, timers and saved sessions. Archive only on explicit owner request after performed acceptance checks; no automatic closure of the other active changes.
