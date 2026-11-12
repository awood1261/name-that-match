# Studio Mode — approved Milestone 5 implementation plan

Status: owner-approved implementation sequence for existing Game Experience MVP tasks 6.1–6.6. Approval followed the Milestone 4 closeout and architecture review. The approved change's D9–D11 and GD-03–06 remain authoritative; no game rules or later-milestone scope change.

This records the Milestone 5 plan and its intermediate HTTP transport. Milestone 6 subsequently replaces polling; see [current Studio operation](studio-mode.md) and [Road/real-time operation](road-mode.md).

## Architecture and boundaries

Keep the existing Node game service, SQLite ledger, classifier, pinned images, HTTP commands and bounded snapshot polling. Host and contestant remain separate React roots: the application shell owns host administration; `/display/:sessionId` owns the capability-authenticated, read-only public presentation. Reuse existing clock synchronization, image decoding, primary readiness, loss detection and explicit recovery. Fullscreen and preview guides are local presentation preferences, never game commands.

| Component | Responsibility and styling boundary |
|---|---|
| Existing `HostDisplayPanel` and `ContestantJoin` | Register/designate a display, show connection/readiness, launch an existing link and preserve QR/copy/manual joining. Keep host styling in `HostPage.module.css` and join styling in `ContestantJoin.module.css`. |
| Existing `ContestantDisplay` | Select public phase content and enforce stale/covered states. Its CSS Module owns the outer viewport and decorative background. Keep networking in `useContestantDisplay`. |
| Proposed `ContestantStage` | Own logical stage geometry and resize measurement only; its CSS Module centers/scales the stage and renders optional guides. No service, timer authority or scoring logic. |
| Proposed display controls | Small local fullscreen/guide controls with a colocated CSS Module, visible focus and understandable failure feedback. Keep controls outside essential filmed content; avoid an unnecessary general window-management abstraction. |
| Existing `Countdown`, `ResultPresentation`, `GameScoreboard` | Render authoritative public information. Preserve their focused responsibilities and CSS Modules; scope logical-stage typography to contestant presentation so host/admin layouts do not change. |

No additional package, router, framework or global state store is proposed. Use existing tokens, semantic CSS Modules and standard CSS. No Tailwind, remote assets, speculative window-management permissions or duplicated game engine.

## Launch, fullscreen and composition

Create/register the link through the existing action, then offer **Open contestant display** on that valid link. Launch synchronously from the explicit click with `noopener,noreferrer`; do not await registration before opening, auto-open on mount or register another display on every launch. Always retain manual URL/QR fallback and connection status. A null `window.open` return is not proof of blocking when noopener is enabled; do not weaken opener isolation to obtain a handle. See the [HTML window-open algorithm](https://html.spec.whatwg.org/multipage/nav-history-apis.html#dom-open).

The operator manually moves the viewer to the TV/monitor. A separate gesture in the viewer requests native fullscreen, handles rejection/unavailability, observes fullscreen changes and permits normal browser exit. Fullscreen is optional; gameplay must continue in a normal window. The [Fullscreen standard](https://fullscreen.spec.whatwg.org/#dom-element-requestfullscreen) requires user activation for this flow.

Use a 1080×960 logical essential stage, uniformly scaled by `min(availableWidth / 1080, availableHeight / 960)` after safe padding. Keep scaled outer dimensions consistent with the visual transform, with one scoped scale custom property and cleaned-up resize observation. Dark gutters are decorative. Image fitting uses `object-fit: contain`, including 476×360 and 1920×1080 sources. Guides default off.

Logo, contestant/turn/tier, clue, timer, answer and totals must stay within the essential stage. Test solo and two-contestant states, long metadata, TV/laptop/portrait/landscape/narrow windows and reduced motion. Use bounded logical typography and wrapping rather than viewport-sized type multiplied by stage scale. The filmed answer/score panel must not require scrolling. Preserve honest partial dates and public-answer privacy. Preview any responsible truncation on the host as required by D10; report a specification conflict before narrowing required answer content or validation limits.

## Dependencies and risks

- **WebSockets:** no dependency for Milestone 5. Keep current HTTP observation/command contracts. Milestone 6 replaces observation with one shared Studio/Road adapter; it requires separate direct `ws`/declaration approval. Do not use a second engine or BroadcastChannel shortcut.
- **Current layout debt:** the existing maximum-size responsive grid is not a uniformly scaled stage. Existing viewport-based text and scrollable result styling need focused contestant-only changes.
- **Text limits:** participant descriptions allow 1,000 characters and other answer fields up to 500. Extreme valid strings and small windows can conflict with legibility; test early, preserve stored values and avoid silent schema/rule changes.
- **Browser/platform differences:** popup/fullscreen policies and monitor placement need physical review. Background tabs can delay frames; authoritative deadlines remain unchanged and catch up rather than granting extra time.
- **Viewer lifecycle:** preserve primary/secondary distinction, readiness and explicit resume. Reopening/replacing a capability must respect existing connection-generation handling and the four-viewer limit; process restarts require fresh credentials.
- **Server load:** synchronous image/hash work can delay the event loop. Measure concurrent library/import traffic on disposable data before claiming filming readiness; do not add an unapproved cache/refactor or extend deadlines.

## Sequence and acceptance

1. **6.1:** explicit launch/fallback and viewer fullscreen; test opener isolation, no automatic registration/session creation, failure feedback and primary close/reload.
2. **6.2:** stage geometry and scoped phase/score/result layouts; check image ratios, long content and 1920×1080, 1366×768, 768×1024, 1024×768 and narrow viewports.
3. **6.3:** keyboard/focus/status review, minimum 44px host targets, text beyond color and reduced motion. Avoid per-frame announcements and mandatory audio.
4. **6.4:** run the built application with separate host/viewer windows under disposable library reads/imports; record actual observation delays and deadline catch-up. Run regression checks.
5. **6.5:** update production setup, operation, architecture, backup/upgrade/recovery guidance against actual commands and paths.
6. **6.6:** run the milestone checkpoint; record performed hardware checks separately from explicit deferrals and stop for review before Road/WebSockets.

Manual acceptance checklist:

- Open deliberately, move to a real TV/monitor, enter/exit fullscreen and exercise blocked-popup/unavailable-fullscreen fallback. Record browser, resolution and viewing distance (including a practical 2–3m check).
- Verify host answers/controls remain private, the viewer stays read-only and only the designated ready primary permits reveal. Close/reload it and explicitly recover without automatic resume.
- Review every phase, both image ratios, long text, solo/two-player scoreboards, clean default output and optional guides. Essential content must fit without clipping/scrolling.
- Use keyboard navigation and visible focus; review reduced motion, errors and touch target sizes.
- Play all three tiers, late judgment, explicit contestant switching, winner/tie, End/New and restart. Observe concurrent import/read load without changing scoring, reveal gates or the ten-second limit.
- Disconnect external internet while retaining the required local connection and repeat the workflow. Record actual results; simulated requests or viewport emulation do not certify this check.
- Keep Android/local-Wi-Fi interruption and final Road certification with Milestone 6. Do not complete archived Photo Library acceptance deferrals through this checklist.
