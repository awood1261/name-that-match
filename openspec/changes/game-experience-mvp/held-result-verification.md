# Held screenshot and result feedback verification — 2026-11-12

The owner approved retaining the exposed screenshot after Correct/Incorrect/expiry, freezing the timer until Reveal Result, and supplied the green/red result references. This refines GR-10/GD-02 and CV-12; scoring, eligibility, round ownership, 30-second window, late-before-buzzer judgment, Pause/stale covers, explicit Reveal/Advance/End and the existing HTTP/WebSocket authority remain.

## Implementation

- Shared contracts, transition/projection and live runtime guards now carry the authoritative stopped remainder. Public adjudication still excludes outcome, award, answer and the current score increment. Guessing alone interpolates time; expiry/late judgments use zero. Old judgments with unknown time show Time unavailable rather than a fabricated remainder.
- Game migration/repository and the global migration runner add schema 5 nullable bounded stopped_remaining_ms and an immutability trigger. Existing schema/data/history remain; migration rollback and fresh/repeated initialization are tested. No files/captures are moved. Follow the current stopped-root backup guidance before operational upgrade; older binaries cannot open schema 5.
- The existing HTTP/live current-round asset path retains the frozen image through awaiting judgment, adjudicated and answer-revealed. Startup restores validated original bytes for a current held/revealed round. Missing/changed bytes yield a fallback, not a replacement or score change. Advance clears access to the old current image.
- ScreenshotRound and ContestantDisplay hold the exposed scene and freeze/zero its timer. ResultPresentation composes the actual contained image, dimming, independent SVG check/cross, green/red glowing frame, live outcome/earned points, frozen answer details and compact scoreboard. Timeout remains TIME UP; void stays distinct. CSS Modules and centralized tokens reuse local Barlow/logo assets. No reference PNG is shipped as a screen/background, no dependencies added. Existing local fonts/simple SVG approximate the reference brush lettering/art; these are not pixel-identical raster copies.
- Current README/storage/host/Studio/Road/visual docs and both active OpenSpec artifacts are updated. Earlier terminal-link work remains intact and uncommitted.

## Actual verification

- npm test: 49 files, **739 tests passed**. New coverage includes exact fractional stopped time, correct/incorrect privacy, zero timeout/late credit, legacy unknown timing, schema-4-to-5 rollback, bounded/immutable saved time, reopen, current image byte identity through viewer/server restart, missing-image fallback, Advance invalidation, live runtime guards, frozen rendering and independent dynamic image/result composition. Existing socket/recovery/library/import/lifecycle tests also passed.
- npm run typecheck, npm run lint, npm run build: passed. git diff --check passed. Strict validation of both active changes and whole project passed (6 items, zero failures).
- Built Chrome host/viewer run on disposable data: Correct and Incorrect held the same image at 00:29; a real thirty-second expiry held it at 00:00 through Confirm timeout; Deathmatch awarded +3 once. Viewer reload preserved stopped time and restored revealed feedback without a new judgment. Four rounds created exactly two award events. Zero external runtime requests observed.
- 36 measured compositions across 1920×1080, 1366×768, 1024×768, 1024×600, 768×1024 and 375×667 passed stage/viewport containment, text/SVG geometry, image containment and overflow checks. Scenes: held clue, correct, incorrect, timeout, correct with long metadata and restored reduced-motion result. Production screenshots were visually inspected against the supplied hierarchy/colors. Disposable profile, DB and generated fixture assets were removed. Temporary browser evidence: /private/tmp/ntm-held-metrics.json and /private/tmp/ntm-held-*.png.
- Initial browser checks caught decorative underline overflow (spacing corrected) and stale test control labels/geometry-settlement timing (harness corrected). The final browser run and all final checks passed. A historical migration fixture initially left foreign keys enabled around the schema-4 rebuild; corrected to mirror the runner's transaction/FK protocol. Production migration remained unchanged.

## Manual review

1. Use the documented stopped-writer whole-root backup, then restart the updated server/reload both views. Reclaim control and generate a fresh contestant link; the terminal-link shortcut remains available.
2. Prepare/reveal a clue. Press Correct with time remaining: the same picture/round/tier stays up with frozen MM:SS. Wait several seconds and reload the viewer; time stays frozen and outcome/answer/points remain hidden.
3. Reveal Result: check green frame/check/CORRECT!/actual tier points, original dimmed image, answer details and score. Advance to the next round.
4. Repeat Incorrect: frozen time until Reveal Result, then red frame/cross/INCORRECT!/zero.
5. Let a round expire: image stays visible at 00:00. Confirm timeout then Reveal Result: red TIME UP/zero. Late correct uses the existing explicit timely-answer confirmation and also preserves zero on the held timer.
6. Check actual phone-host/laptop-viewer/fullscreen, reconnect covers, intended viewing distance, representative wide/non-wide screenshots and reduced motion. A center crop is not guaranteed to preserve all landscape content.

Physical phone/tablet/TV, disconnected-internet and filming/crop acceptance have not been performed by the agent; existing visual tasks 7.2, 7.3, 8.1 and 8.2 remain open. Nothing archived, committed or pushed; no operational data modified or generated build/database files tracked.
