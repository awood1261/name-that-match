# Preparation transition flicker fix — 2026-11-13

Small correction to existing CV-02/03/04/09 behavior, permitted by AGENTS.md small-bug-fix guidance; no new feature, specification rule, milestone or architecture. A healthy snapshot with pending/rejected clock synchronization previously set the shared stale flag and unnecessarily replaced non-sensitive Choose/Selecting scenes with Connecting display.

ContestantDisplay now keeps setup/between-round cards and preparing/ready Selecting Match mounted when there is no actual connection/image error, independent of clock readiness. Selection intro state survives routine clock proof changes. The clue, countdown, held/revealed result and actual failure recovery remain covered under the original synchronization rules. No server, networking, timing, scoring, readiness gate, artwork or CSS changes.

Verification:

- Focused display/live tests: 30 passed. New component regression drives synchronized/unsynchronized choice→Preparing→Ready, delayed image decode and repeated clock changes; confirms no intermediate synchronization screen or image/timer/command leak, keeps unsynchronized guessing covered, and preserves genuine connection-error recovery and cleanup.
- npm test: 740 tests passed in 49 files. npm run typecheck, npm run lint and npm run build passed. Strict whole-project OpenSpec validation passed all six items; git diff --check passed. No generated build/database files tracked.
- Built Chrome with disposable DB/assets and real local HTTP/WebSocket host/viewer: injected a 650ms clock-message delay. Mutation observation recorded only CHOOSE YOUR MATCH → SELECTING MATCH... during preparation; the selected image stayed out of the DOM until explicit host Reveal, which then displayed the synchronized clue/countdown. Temporary profile/database/fixtures cleaned. No physical phone/Wi-Fi or offline certification claimed.

Changed files: client/src/game/ContestantDisplay.tsx; tests/client/contestant-display.test.tsx; docs/contestant-visuals.md; this evidence record. Existing physical/closeout tasks remain open. Nothing archived/committed/pushed and no operational data modified.

Manual check: reload the contestant page, choose a tier on the host and press Prepare screenshot. The cards should go straight to Selecting Match and stay there until Reveal & start. Verify the image remains hidden before Reveal. A real lost connection still shows its recovery cover.

## Follow-up: brief Display Unavailable — 2026-11-13

The owner still observed a brief Display Unavailable title. The initial fix covered pending clock proof, not recoverable error callbacks. The display hook now exposes the existing transport's recoverable-versus-terminal distinction. Only non-identifying choice/selection scenes get a three-second presentation grace during automatic recovery; repeated failures do not reset the grace. Fresh snapshots clear it. Terminal/image errors and exposed/paused/held/revealed gameplay retain their existing immediate safety/recovery behavior. The timer affects artwork visibility only; it does not own liveness, mark the viewer ready, reset a game timer or send commands. The exact cause of the owner's physical-device interruption has not been diagnosed.

Final verification: 33 focused display/live tests passed; 743 tests passed across 49 files. Typecheck, lint, build and strict whole-project OpenSpec validation passed; git diff --check passed. Added cases cover choice/Preparing/Ready, repeated failures bounded at 3,000ms, successful recovery/new interruption, terminal errors, hidden clues and cleanup. Updated the earlier selection-recovery expectation to preserve Selecting Match during a brief recoverable loss.

A production Chrome run deliberately closed the real contestant WebSocket on its first preparation snapshot. Automatic reconnect succeeded and recorded only CHOOSE YOUR MATCH → SELECTING MATCH... before explicit Reveal. No intermediate Display Unavailable, clue, countdown or automatic host command was rendered. Temporary browser profile/database/fixture files were cleaned. Initial fault-injection harness attempts had a reload race and a syntax error; corrected before the successful final run. No physical phone/network/offline acceptance claimed.

The three-second presentation grace is the only additional behavior; no server/network authority or readiness changes. Changed implementation also includes client/src/game/useContestantDisplay.ts. All earlier uncommitted work remains; no archive/commit/push. Manual check: reload the contestant page and repeat Prepare; short automatic reconnects should retain the cards/Selecting scene, while a sustained failure still shows recovery after three seconds.
