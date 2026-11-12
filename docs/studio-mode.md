# Studio Mode operation

Studio uses a laptop host and a separate contestant browser window on a TV or monitor. Both observe the same local Node game service and SQLite session. The contestant has read-only game access; its fullscreen and guide controls affect presentation only. Studio and Road now share the WebSocket observation/readiness/clock adapter, with commands and receipts on HTTP. See [real-time operation, recovery and Road acceptance](road-mode.md). Physical certification remains separately recorded.

## Start the installed production app

From the repository root, with dependencies already installed:

```bash
npm run build
npm run prod
```

Open `http://localhost:3001`. This serves the built UI, logo, favicon and screenshot bytes locally. Keep the server terminal running. The default loopback listener is sufficient for two windows on the same laptop, including an attached TV; Studio does not require LAN exposure or IP discovery. Development uses `npm run dev` and `http://localhost:5173` instead.

Use the same configured `NAME_THAT_MATCH_DATA_DIR` on every start. It defaults to `./data`, resolved from the server's working directory. Run one server per data root. Changing the root or working directory can open a different collection. Custom ports and LAN devices need the exact bind/origin configuration in [game host joining guidance](game-host.md); Open contestant display uses the local host-window origin while the QR/copy field preserves the separately configured device origin.

Before upgrading existing data, stop all writers/watchers and follow the [whole-root WAL-safe backup procedure](local-storage.md#backup-and-restore), including screenshot files and any sidecars. Current schema is 4; the timer refinement widens game-round timing checks while preserving old pauses/history. Restore to a separate root, verify integrity/assets and use compatible code for rollback. Do not copy only a live database, delete sidecars or reset operational data to troubleshoot presentation.

## Set up the external display

1. Open **Play**, create or restore a game, and review the contestant roster. Use **Create contestant display link** with **Use new link as the primary display** checked before preparing a clue.
2. Select **Open contestant display**. This opens the existing read-only registration; it does not create a game or register another viewer. If no window appears, allow popups or copy the displayed link into a separate tab. A browser may choose a tab rather than a separate window; move that tab into its own window manually.
3. Move the contestant window onto the TV/monitor. In that window select **Enter fullscreen**. Fullscreen requires this local gesture; if it is refused or unavailable, use the normal window. **Exit fullscreen** or the browser's Escape behavior returns to windowed mode.
4. Keep host controls on the laptop. Wait for the primary connection to decode and synchronize before **Reveal & start**. A connected secondary viewer does not satisfy the primary gate. Designate the correct primary between rounds or while paused; cancel an unexposed preparation first if necessary.
5. Leave **Safe-area guides** off for clean filming. Choose/Selecting/guessing use the full landscape composition with a centered 1080×960 framing reference; this guide does not promise a vertical crop preserves the entire image or every card. Narrow screens adapt to a compact composition. Legacy pause/result/final screens retain the original 1080×960 stage. All stages scale uniformly, and the actual display contains the complete screenshot without stretching/cropping. See [contestant visual screens and filming limits](contestant-visuals.md).

The public display shows only the current public phase and host-revealed results. It never contains host commands, private pre-reveal answers, capture source filenames or the QR credential panel. Preserve this separation when placing the windows.

## Filming text and layout

Use **Private host answer → Filming answer text preview** to inspect the exact text prepared for the contestant reveal. Long stored metadata is shortened with an ellipsis for filming: participants up to 120 Unicode characters, promotion/event 64 each and optional stipulation/championship 80 each. Whitespace is normalized for presentation. The full frozen private answer, saved library data, date precision and scoring remain unchanged. Review the preview before filming long entries.

Solo/two-player scoreboards, results and answers retain the legacy logical stage. Choose, Selecting and screenshot/countdown use the approved landscape or compact stage described in [contestant visual screens](contestant-visuals.md). Neither composition becomes a scrolling filmed panel. Check actual readability at the intended TV size and viewing distance; viewport automation cannot establish this. Keyboard focus remains visible, local buttons have accessible names, guide state is announced, reduced motion removes result entrances and the timer does not announce every frame. Sound is not required.

## Recovery and finishing

- Closing/reloading the primary uses the existing loss policy: the server pauses at detection with actual remaining time, or expires if already due. Reopen the existing link, wait for fresh decoding/synchronization and explicitly **Resume**. Rejoining never grants a fresh thirty seconds or resumes automatically. Avoid opening the same primary link in competing windows; a new connection replaces the earlier generation.
- During guessing, navigate from Play with **Pause and leave** for acknowledged pause; **Stay** leaves play running. Returning stays paused. Resolve uncertain requests through **Check command status** rather than blindly repeating a judgment.
- A process restart expires credentials. Reclaim host control, create a fresh primary link for an unresolved game and inspect the recovered state. A known paused remainder is recoverable; unknown running crash time becomes Interrupted/void-only. Completed scores remain saved. See [host recovery](game-host.md).
- **End game** requires a resolved/between-round state. **New game** creates a separate setup; Start is explicit and old viewers remain on the old game's result. Create a fresh display registration for the new game. The existing process-wide four-registration limit still applies; Open, address refresh and QR generation do not allocate registrations.

## Manual acceptance still to perform

Record actual browser, display resolution, TV/monitor, viewing distance and outcomes:

- Move a separately opened viewer to the real monitor; enter/exit fullscreen and exercise popup/manual-link fallback. Confirm private host content stays off the TV.
- Review all phases, both representative image ratios, long-text previews, solo/two-player scores and clean/guided composition. Check the centered crop, readable timer/answers, focus and reduced motion at the intended distance (including a practical 2–3m check).
- Close/reload the primary while guessing; verify cover, preserved pause or expiry, readiness and explicit Resume. Check Stay/Pause-and-leave and uncertain-command recovery.
- Complete multiple rounds across tiers, host-controlled switching, late credit, winner/tie and End/New Game. Verify saved results/recovery after restart on disposable data first.
- Disconnect external internet while keeping the required local connection, then repeat preparation through completion. Run the already built app; no download should be needed.

Studio implementation checks and their measured limits are recorded in `openspec/changes/game-experience-mvp/milestone-5-verification.md`; WebSocket/Studio regression evidence is in `milestone-6-verification.md` in the same change. Native fullscreen in desktop Chrome and emulated viewport checks do not certify a physical TV, camera crop, Android tablet, Wi-Fi interruption or actual internet disconnection. Those checks remain explicitly deferred until performed. Archived Photo Library collection/device deferrals are unchanged.
