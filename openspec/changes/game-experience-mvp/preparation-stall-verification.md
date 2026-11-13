# Preparation and host recovery stall — 2026-11-13

The owner reported loading-screen recovery followed by host Live access changed/message invalid, repeated reconnect and aborted receipt fetches. Earlier contestant-only changes did not address the server's collection work.

## Finding and correction

A read-only scan of the operational collection found 81 valid screenshots (~129MiB); existing synchronous validation took ~3,100ms, exceeding the three-second HTTP deadline and preventing live heartbeat processing throughout that scan. It demonstrates a real blocking failure path; the exact error code from the owner's phone was not captured.

The game catalog now snapshots metadata briefly, releases the SQLite transaction, validates one bounded image at a time and yields between images. Full PNG/hash/eligibility checks remain. Concurrent scans coalesce; metadata revision races reject mixed assessments and leave only an explicitly dated last-complete live count snapshot until reassessment. Storage uncertainty remains an error, not fabricated empty counts. Shutdown stops outstanding work before DB closure. Fresh Start/Prepare/Refresh await validation and recheck authorization/revision. Selected pinned bytes are still validated before exposure. No worker/runtime/dependency, schema, endpoint or scoring changes.

HTTP/host display registration use a bounded ten-second lifetime. View unmount still aborts; uncertain writes still require explicit receipt review. Receipt reads join in-flight validation rather than prematurely reporting an unfinished request absent. No blind replay/dismissal was added. Live storage 5xx failures are now correctly recoverable rather than being mislabeled as invalid host access; genuine access/protocol errors remain terminal. Live liveness/control expiry/RTT constraints and the thirty-second guessing window are unchanged. Earlier uncommitted visual-recovery work is preserved.

## Actual results

- Final npm test: **749 passed, 49 files**. New cases verify coalesced cold/warm scans, no SQLite transaction across await, metadata changes, explicit I/O error/retry, shutdown cancellation and timeout/lifetime abort. A real socket test simulates >3s of bounded per-image CPU work while host clocks/heartbeats continue, aborts the original Prepare response, then resolves its receipt with exactly one attempt and zero scores. Another verifies storage 5xx does not discard a valid host capability.
- npm run typecheck, npm run lint, npm run build: passed. Strict active-change and whole-project OpenSpec checks passed. git diff --check passed; no build/database files tracked.
- Built Chrome host/viewer against a disposable SQLite backup and copied managed screenshots from the 81-image dataset: Prepare completed in **3,549ms**, with no reconnect/pending-command loop. Explicit availability refresh during guessing took **3,525ms**; the round remained guessing and revealed/scored normally. Captured live error frames: **zero**. Original database was opened read-only for backup/inspection; source PNGs were read/copied without modification. Temporary DB, copies and browser profile were cleaned. No phone/physical Wi-Fi/offline certification implied.
- Initial newly added revision test accidentally edited an answer field (correctly invalidating review), then compared a repository result wrapper incorrectly; fixtures corrected to use notes and returned match.revision. The final full suite passed.

Scope: synchronous PNG work remains bounded per image; unrelated administrative catalog routes retain their existing implementation. HTTP requests remain bounded even for a much larger/slow collection, and uncertain outcomes must still be reviewed by receipt. No game/data reset performed.

## Manual recovery

1. Restart with the existing LAN-enabled startup/origin configuration. Reload the phone host, reclaim control and use Check command status if a pending command is shown.
2. If a saved unexposed Ready round exists after restart, cancel its preparation before registering a fresh primary display; old epoch links cannot be reused. Scores and exposed-match history stay intact.
3. Create/open the fresh primary link on the laptop, choose a tier and Prepare. Allow several seconds for complete validation; Selecting Match should then wait for explicit Reveal without host access errors.
4. Reveal, judge and Reveal Result; check current scores and continuation. Genuine network loss retains existing explicit recovery/receipt review.

No archive/commit/push. Existing physical acceptance and visual closeout gates remain open.
