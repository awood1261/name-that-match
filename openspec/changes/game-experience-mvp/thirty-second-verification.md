# Thirty-second guessing window verification — 2026-11-12

Owner requested extending guessing from 10 to 30 seconds. Tasks 8.1–8.6 implement that narrow refinement. No scoring, classification, readiness, controller lease, heartbeat or protocol-shape changes; no archive or commit.

## Implementation and compatibility

The shared standard window is 30,000ms; host and public WebSocket timing validators use it. Reveal starts a full window, including future rounds of existing sessions. Pause/Resume retains elapsed time. The transactional schema-4 migration rebuilds only the round timing bounds, preserving rows, indexes, triggers, foreign keys, receipts and score events. Historical schema-3 creation remains unchanged. Legacy pauses retain their saved remainders; running-crash recovery still interrupts rather than resetting a round. Older binaries cannot open schema 4; use the existing stopped-writer whole-root backup/restore guidance.

## Executed checks

- `npm test`: 49 files, 721 tests passed. Includes 29,999/30,000ms boundaries, old five-second pause preservation, migrated data/index/trigger equality, rollback after injected rebuild failure, fresh/repeated initialization, unsupported versions, API/live snapshots, scoring, restart/reconnect, UI timer and executable lifecycle.
- `npm run typecheck`, `npm run lint`, `npm run build`: passed.
- Strict OpenSpec validation: game-experience-mvp, contestant-display-visual-experience and whole-project validation passed; whole project 6 items, zero failures.
- Production Chrome smoke against disposable SQLite/screenshots and allocated loopback port: contestant initially showed 00:30, showed 00:19 after 10.5 seconds, paused with 18,908ms remaining, resumed and scored once. Temporary browser profile, database and fixtures removed. This is a local browser check, not physical TV/tablet or disconnected-network certification.
- `git diff --check`: passed. No tracked dist/build/database files. No operational data modified.

Initial regression failures exposed old ten-second expectations, a TypeScript target incompatibility and a test heartbeat loop exceeding the unchanged frame-rate cap. Corrected test expectations/clock steps and compatible string escaping; the final checks above passed.

## Manual verification

1. Follow docs/local-storage.md stopped-writer whole-root backup guidance before upgrading operational data. Restart the updated server and reload host and contestant views. Reclaim host control and create/connect a fresh primary display link after restart.
2. Prepare an eligible screenshot, wait for primary readiness, then Reveal & start. Confirm the contestant starts at 00:30 and still permits guessing after ten seconds.
3. Pause partway through, wait, then Resume. Confirm it resumes the saved remainder rather than restarting at thirty.
4. Let a round reach zero. Confirm it awaits host judgment and preserves existing correct-before-buzzer and result/answer reveal controls. Verify a correct answer still awards the selected tier points once.
5. Existing paused legacy rounds intentionally retain their old saved remainder. Use a newly revealed round to verify the full thirty seconds.

Previously deferred physical-device/offline checks remain deferred; visual-change task status and historical verification records are unchanged.
