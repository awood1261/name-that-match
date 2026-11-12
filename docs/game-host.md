# Game host

Open **Play** from the application navigation. Setup, hidden preparation, a separate read-only contestant display, authoritative countdown, judgment/pause controls, **Reveal Result**, scoreboard, progression and confirmed End/New Game are available. Studio adds explicit **Open contestant display**, optional viewer fullscreen and a uniformly scaled reel-safe stage; see [Studio operation and manual acceptance](studio-mode.md). Opening is always operator-driven. Both modes now use the shared WebSocket observation adapter with HTTP commands; see [Road setup and real-time recovery](road-mode.md). Use disposable test data for acceptance runs.

## Setup and preparation

1. Open Play. The view claims host control or restores this tab's current control. Opening it does not create or start a game. Another controlling host produces a busy message rather than a takeover.
2. Choose **1 — Solo** or **2 — Head-to-head**, enter distinct names (1–60 Unicode characters), choose the starting contestant and select **Create session**. The setup is persisted. You can edit it with **Save setup** or explicitly **Discard setup** before starting. Unsaved setup edits disable Start; save them first. In-progress local form edits are not themselves persisted.
3. Select **Start game**. At least one currently eligible match is required. The roster is fixed after Start. A capacity warning does not enforce equal turns or a fixed number of rounds.
4. Between rounds, use **Switch contestant** to explicitly select the active contestant. That selection persists until changed. It cannot reassign existing round ownership and is disabled while preparing/ready.
5. Choose **Squash Match — 1 point**, **Competitive Match — 2 points** or **Deathmatch — 3 points**. These request a pool derived by the existing obscurity × visual-difficulty matrix; they do not edit screenshot classifications.
6. Review eligible screenshot and distinct-match counts. A match can contribute multiple images or appear in several tier pools. These are current candidate counts, not a guaranteed number of future rounds. **Refresh availability** explicitly reassesses local assets. Normal observations reuse assessments until library record revisions change; actual Prepare always reassesses files and eligibility.
7. Select **Prepare screenshot**. The server chooses uniformly among eligible unseen screenshot rows, validates the selected PNG/record revisions and pins only that current image in memory. Preparing changes to **Screenshot ready · hidden**. No screenshot is displayed, no countdown starts, no match is marked exposed and no points are awarded. The private host answer can be inspected independently of the contestant result reveal.
8. **Cancel preparation** releases the hidden candidate and returns between rounds with the same contestant. The cancelled attempt remains in history, but the same match may be prepared again because it was never exposed.

An empty selected tier disables Prepare with an explanation. If content changes after the counts were assessed, the server returns an explicit empty-pool/stale-candidate error; refresh or review the library and deliberately prepare again. There is no automatic fallback tier or grouping by video. Pending/rejected, incomplete, unassigned, unrated or invalid/missing images are excluded. Uncertain storage produces an error, not invented zero counts.

Image Library shows both **classified** and **eligible** totals for each tier. A classified Deathmatch screenshot can still be pending review and unavailable to Play. Open its match, select **Review screenshot** and explicitly approve it after checking its saved metadata and image. Play additionally excludes matches or identical image content already exposed in the current game, so its remaining availability can be lower than whole-library eligibility. The Unassigned screenshots view is a queue; zero entries does not mean the library is empty. Assigned captures are under Matches.

## Connect a contestant and run an attempt

1. **Before preparing**, select **Create contestant display link**, leaving **Use new link as the primary display** checked. Copy the read-only link into a separate tab. This manual join is the current workflow; it does not automatically open a window. If an existing Milestone 2 session is already Ready, select **Cancel preparation** first, create the primary link, then prepare again.
2. The viewer removes the join fragment from the address bar and retains its own capability in tab session storage. It renders no administrative shell or host controls. Keep the original link available for deliberately rejoining another tab. Links are process-local; a server restart needs a fresh link.
3. Prepare an eligible tier. The display fetches/decodes the current clue into a Blob while keeping it out of the rendered page. **Ready** remains covered. Wait for **Primary display decoded and synchronized**. Missing/failed images or excessive/stale clock observations block reveal. Extra viewers do not gate the round; only the host can designate a primary between rounds or while paused.
4. Select **Reveal & start**. The server commits exposure and the 10,000ms deadline together. The image appears with a large countdown. The host sees authoritative timing and can select **Correct**, **Incorrect** or **Pause**. Incorrect ends the attempt immediately for zero. Correct commits the frozen tier's base points once; it does not reveal the answer or advance.
5. Pause covers the clue and freezes its actual remaining time. Wait for primary readiness, then explicitly **Resume**; it never grants a new ten seconds. **Skip / Void** records zero with the chosen reason and retains exposed-match history.
6. At zero, guessing ends and **Time up** appears. **Confirm timeout · no credit** resolves zero. **Correct before buzzer — I confirm a timely answer** is a separate explicit attestation for an answer spoken before expiry; ordinary Correct cannot be used after expiry. No client timer awards points.
7. After judgment, the contestant sees **Waiting for the host** with no clue, result, points or match identity. The host sees the saved judgment/points immediately. Take time for the reaction/suspense, then select **Reveal Result**. Correct shows a green CORRECT! treatment and its committed points; Incorrect shows red INCORRECT! and zero. Timeout and void keep distinct zero-point labels. Frozen participants, promotion/event and known date/stipulation/championship fields appear together; unknown fields are omitted.

Reveal Result uses the existing `REVEAL_ANSWER` command and durable `answer_revealed` phase. It never judges again or awards another score. The public projection withholds the current round's score increment until this reveal; private host totals remain authoritative immediately. A brief connected entrance is cosmetic, finite and disabled with reduced motion. Refresh/reconnection restores the already revealed result statically, without replaying the entrance or a host command. A judgment that has not been revealed stays concealed after refresh.

After a server restart, create a fresh display link. In a resolved/revealed round, uncheck **Use new link as the primary display** to create a read-only secondary link: primary designation remains restricted to between rounds/paused. A primary is not required just to view the saved result. Paste the fresh link into the contestant tab; it restores the saved concealed/revealed phase.

The primary and host loss threshold is 3 seconds, checked by the server's one-second liveness sweep and on requests. Detection consumes elapsed time; an already-due deadline expires instead of refunding time. The viewer covers on a failed request or a synchronization gap over 3 seconds. Reconnection never resumes automatically. Reloading the primary during guessing creates a new connection generation and pauses at detection; fresh decode/synchronization and host Resume are required. Losing a secondary display does not pause.

On a graceful server stop a known running remainder is paused. After an unknown running crash the restored round is Interrupted and can only be explicitly voided. A known pause survives restart with the same remainder if its original managed bytes validate; missing/changed bytes become Interrupted. Reclaim host control and create a fresh primary link while paused. Pasting it into the same viewer tab also rebinds; no manual database reset is needed. Already committed judgments are retained.

Counts, readiness and clock observations use the shared WebSocket channel. Committed state changes and readiness notifications push complete projections; one-second heartbeat observations refresh liveness and timing. Explicit entry/recovery/refresh/receipt reads remain HTTP, without a recurring status-poll loop. Clock readiness requires a recent echoed server nonce, reported round trip no greater than 500ms and current image/connection identity. Browser countdown interpolation uses monotonic time and clamps at zero; it cannot extend the server deadline. Measured transport/paint latency can reduce the perceived answer window. Physical frame simultaneity and Road certification are not claimed.

## Scoreboard and final totals

The host scoreboard uses the complete server score ledger, updates immediately after judgment, and shows the explicitly selected active contestant. The contestant scoreboard appears between rounds and alongside a revealed result. Its totals and latest outcomes exclude unrevealed judgments during play. Ready/guessing/paused and concealed-result screens do not add a scoreboard over the clue or disclose the new result.

Rows are sorted by descending score; tied scores retain roster order and share a rank. Each contestant has their latest visible outcome, committed award and actual global turn number. Turns count exposed attempts, including zero-point outcomes, rather than cancelled hidden preparations. There is no three-round quota or automatic contestant rotation.

Completed sessions show final totals and the server's winner or tied winners, including zero-score ties and solo games. The host retains the last observed completed session across live observations/reload; an actual current session takes priority. Select End game from between rounds or a resolved round, confirm, and review the final totals. New game creates a separate editable setup; it never resets or deletes a saved game or the library.

For manual verification with the currently available UI, create a head-to-head setup and confirm zero totals/shared ranks. Start a round and judge it: host totals/latest outcome update immediately, while the contestant waits without disclosure. Select Reveal Result and confirm the same committed points and turn identity appear on the contestant scoreboard. Reload/reconnect and confirm totals stay unchanged. Advance explicitly to test additional rounds and tiers. Use End game/New game for an independent session; use a disposable data directory for acceptance runs.

## QR code and LAN joining

**Create contestant display link** registers the existing read-only viewer and automatically checks the laptop address. On macOS, the server runs `ipconfig getifaddr en0` once for this action. When the LAN origin is configured, the panel shows a copyable device URL and its matching offline QR code. Scan it with the other device's normal camera/browser on the same local Wi-Fi. The QR is generated locally, includes the full viewer join fragment and never contains host-control credentials. No camera permission in this application or external QR service is needed.

For a host opened on localhost, discovery changes only the link's hostname and keeps the actual UI port. Vite development normally uses 5173; production normally uses 3001. The code does not change the server's listener or permitted origins for you. Configure them deliberately, keeping your host origin in the list too.

For production on macOS, stop the running server, build, then use the current address:

```bash
npm run build
NTM_LAN_IP="$(ipconfig getifaddr en0)"
NAME_THAT_MATCH_HOST=0.0.0.0 NAME_THAT_MATCH_UI_ORIGINS="http://localhost:3001,http://127.0.0.1:3001,http://${NTM_LAN_IP}:3001" npm run prod
```

Verify that the address command returned a usable address before starting. For development, Vite already binds to all interfaces and proxies to the loopback Node server:

```bash
NTM_LAN_IP="$(ipconfig getifaddr en0)"
NAME_THAT_MATCH_UI_ORIGINS="http://localhost:3001,http://127.0.0.1:3001,http://localhost:5173,http://127.0.0.1:5173,http://${NTM_LAN_IP}:5173" npm run dev
```

Adjust these exact origins to your actual configured ports. QR generation does not enable HTTPS/TLS. Successful detection/configuration does not prove firewall or Wi-Fi reachability. Both devices need to reach the laptop on the local network; external internet is unnecessary after installation/build.

**Refresh LAN address** reruns detection and updates the URL/QR for the same viewer without changing the primary or game. If the network address changes, add its new exact origin to the startup configuration and restart when needed; server restart requires a fresh display link under the existing join rules. An old scanned address is not redirected automatically.

For another interface, a non-macOS host, or missing en0, enter a complete configured IPv4 origin in **Manual LAN origin** and select **Use manual origin**. The field supports an explicitly chosen port. Unconfigured origins, localhost overrides, paths, query strings and credentials are rejected. Correct the displayed configuration issue rather than relaxing origin validation. A detection/configuration failure retains a link for a local browser tab, clearly labeled local-only, and suppresses the device QR. A QR rendering failure retains the configured device link for copying. Refresh clears outdated QR output before recomputing it.

Primary registration/designation remains restricted as described above; address refresh does not create extra viewers. Scanning stays read-only and never prepares/reveals/scores or bypasses readiness. After a server restart, create a fresh viewer capability; on a resolved round, uncheck primary designation to create the secondary link used for saved-result viewing. Physical phone/tablet scanning and complete Road Mode acceptance are separate checks, not implied by desktop QR decoding.

## Advance and choose the next challenge

After Reveal Result, select **Advance** when ready. It clears the prior clue/answer from the contestant display and returns to the between-round scoreboard. Saved scores, latest revealed outcomes and used-match history remain intact. Advance does not switch contestants, select another tier, prepare another screenshot or start a timer.

The same contestant stays selected for consecutive rounds until you explicitly use **Switch contestant** between rounds. That control affects only future attempts; earlier round owners and scores never move. Switching is disabled during preparation, Ready, guessing, pause, judgment and revealed-result presentation. Cancel an unseen preparation or resolve and Advance an exposed round before switching.

The previous round's tier stays selected after Advance, including when you reloaded the host during the round. Choose another tier explicitly if desired. An exhausted tier disables Prepare and explains why; the app does not substitute another tier. Each exposed match is excluded across all contestants and tiers. Cancelling hidden preparation does not consume a visible turn or block that match.

An explicitly voided/skipped round also offers Advance before Reveal Result, as the approved exception. Choosing it keeps the void's zero-point turn and exposure history without showing its concealed result/answer. If you want to present that result, select Reveal Result first.

Manual checks: play two successive rounds without switching, then Advance and explicitly switch contestants for a third. Confirm scores remain with each round's owner, turn numbers advance only on exposure, and the old result/image disappear on Advance. Change tiers before Prepare, check exhausted-tier feedback and no repeats, and reload between rounds to verify selection/totals persist. Use Tab and Enter to reach/activate Advance and the native contestant/tier controls. Lost responses still require **Check command status**; do not issue a second command to guess whether Advance succeeded.

## End a game and start another

Select **End game** between rounds or after saving a judgment, then confirm. Cancel dismisses the confirmation without a command. End is disabled during preparing, Ready, guessing, pause, awaiting judgment or interruption, with instructions to cancel hidden preparation or resolve/void an exposed attempt first. It does not automatically void a clue or change a judgment.

Completion publishes all committed totals and the winner or all tied leaders. This includes a saved correct award even if you have not selected Reveal Result yet; the confirmation area explains this. A started head-to-head game can end tied at zero; solo identifies its sole winner, including at zero. Final games have no scoring/Advance/preparation/contestant-switch controls. Reload Play (reopen Play if the shell lands on System) to restore the observed final; after a server restart, reclaim host control first.

Select **New game**, then confirm, to create a new setup with fresh session/contestant/command IDs, zero scores, no attempts and empty used-match/image history. Contestant names and the last active selection are copied as editable setup defaults. Review names/count/starting contestant, save changes if needed, then explicitly select Start game. Confirmation cancel creates nothing; a lost response uses the existing Check command status/receipt flow before another request. Starting the next game never starts automatically or rewrites the completed result.

Existing contestant pages keep showing the previous session's final result. Create a fresh primary display link/QR for the new session and open it on the contestant device before preparing. Do not re-scan the old session's link expecting it to switch games. Process-local viewer capabilities still expire on server restart; for viewing an old resolved result after restart, uncheck primary designation when creating its fresh secondary link as described above. The existing process-wide four-viewer-capability limit is unchanged; this checkpoint adds no display-history management.

For manual acceptance, cancel each confirmation once and confirm no state change. End a scored game and compare host/device totals, reload/restart and restore its saved final, then create a new game and confirm fresh setup/zero scores with the library intact. Run a solo zero-score completion and a head-to-head zero-score tie. Verify End stays disabled on a prepared unresolved clue. Physical-device/full milestone acceptance remains separate from automated browser checks.

## Leaving Play and recovered games

During guessing, choosing another application section opens **Leave game host?**. **Stay** is focused by default; Stay or Escape closes the dialog without pausing, changing scores or navigating. **Pause and leave** first checks current server state and sends the existing PAUSE command if the round is still guessing. The destination opens only after a confirmed non-guessing state. If time expired meanwhile, the server retains expiry/awaiting judgment; no fresh time or automatic judgment is granted.

A saving or uncertain command also protects navigation. A failed/lost PAUSE response keeps you on Play, with the destination blocked. Select Stay, reconnect if needed, and use **Check command status** to inspect the receipt/current state. Resolve or deliberately review/retry/dismiss through that panel; navigation never retries for you. A known paused/resolved game can be left without another pause; returning restores its committed state and does not Resume automatically. A successful explicit Release host control already invokes the server's pause/loss path and permits leaving after its acknowledgment.

Browser reload/close uses the supported generic unsaved-work prompt during guessing or an in-flight/uncertain command. Browsers do not allow reliable custom Stay/Pause buttons or asynchronous pause acknowledgment during unload. Cancel that prompt and use in-app Pause and leave for confirmed navigation. If the browser actually closes or disconnects, the existing server liveness policy pauses at detection or settles expiry, consuming elapsed time rather than refunding it.

Reopening Play reports a recovered saved game. A known paused round keeps only its saved remainder and requires fresh primary readiness plus explicit Resume. After an unknown running process crash it is Interrupted and must be explicitly voided; it cannot restart or Resume an invented window. Recovery never replays a judgment, automatically advances or changes ownership. Old process credentials are replaced by explicit host recovery; a stored uncertain request remains blocked until receipt review under the fresh credentials.

Game HTTP observations/commands now have a three-second request bound. A write that times out remains uncertain, not rejected or automatically retried. Receipt review also reads the actual current session, so an old accepted receipt cannot replace a newer game's view. Late responses from an unmounted/replaced view cannot clear the next view's stored pending request. Image Library retains its existing Save/Discard/Stay and browser-unload protection independently of Play.

## Host control and request recovery

- The current controller renews while Play is open. **Release host control** permits another tab/device to claim. Leaving Play stops renewals; control becomes claimable after 10 seconds without renewal. A host-liveness loss is detected after 3 seconds; it never awards points or advances a round. There is no force-takeover of an actively renewed lease.
- Reloading/reopening Play restores the existing session rather than creating a duplicate. After a server restart, process credentials expire; use **Take host control / reconnect** and review the restored state. A Ready candidate is revalidated and remains hidden. If its image/metadata changed, cancel preparation and explicitly try again.
- Mutations are serialized in the host view. Revision conflicts refresh authoritative state and show an error; they are not blindly replayed.
- A lost response shows an uncertain-request panel and blocks new commands. Use **Check command status**. An accepted receipt restores the current state. If no receipt exists, the client checks current state before offering **Retry original request**, preserving the same command/session/round IDs and original revision. If state changed, deliberately dismiss only after that review; do not manufacture a second command to guess whether the first succeeded.
- Sessions, attempts, owner IDs and receipts live in SQLite; controller/viewer capabilities are process-local and never stored in game history. This is trusted-LAN coordination, not account authentication or an anti-cheat sandbox. Existing library administration remains reachable under its existing policy.

The native HTTP adapter exposes the existing M1 command lane plus private/public snapshots and receipt lookup. Display status accepts only connection/readiness/clock observations, and the opaque current-round image route requires a role capability. Host commands cannot override readiness. End game commits final results; New game uses the existing session-creation endpoint with a fresh identity. Preserve saved data rather than deleting a database to reset play. Use a separate disposable data root for independent acceptance runs.

## Manual acceptance

Use an already backed-up collection or a disposable configured data root. Start normally with `npm run dev` (or `npm run build` then `npm run prod`). Do not overwrite or delete an operational database to test setup.

- Open Play with no session: verify that merely opening it does not create a game.
- Create a solo setup, check its name/start selection and reload persistence. Before Start, discard it and create a two-contestant setup to verify both configurations without changing a started roster.
- Try duplicate/blank names; verify actionable feedback and no saved invalid session. Edit a saved setup and verify Start is disabled until Save setup.
- Start with approved eligible content. Switch the active contestant and verify it stays selected.
- Confirm three tier labels/point values and separate screenshot/match counts. Choose an empty tier and verify Prepare is disabled with an explanation.
- Create a primary display link before preparing and paste it into a separate tab. Prepare a populated tier: verify Ready/hidden and disabled contestant switching. Reveal stays disabled until that display decodes/synchronizes; then it enables without exposing the clue early.
- Reveal: check the clue appears only in the contestant tab and the countdown starts at the authoritative window. Pause: check clue coverage and frozen time. Resume: verify only the saved remainder is available.
- Reload or disconnect the primary during guessing: verify pause/cover or expiry, and explicit readiness-gated Resume. Check an extra viewer cannot submit host commands or cause a pause when only it disconnects.
- Let time expire: check Time up/zero and the distinct late-judgment versus no-credit actions. On separate disposable runs check Correct, Incorrect and Skip/Void. Each outcome is saved once with no automatic answer reveal or progression.
- After judging, wait: the contestant must remain concealed while the host sees the saved outcome. Select Reveal Result and check the appropriate treatment, committed points and frozen metadata. Reload before/after reveal and check concealed/static-revealed restoration. Enable reduced motion and confirm the same result without an entrance. The contestant scoreboard appears with the revealed result; Advance becomes available, with no automatic progression.
- Restart while paused: reclaim host control, create a fresh primary link and paste it into the same contestant tab. Check rebind/readiness, the same round and preserved remainder, followed by explicit Resume. No fresh ten-second window is offered.
- Cancel: verify the same contestant remains active and capacity is not consumed. Prepare again, then reload/restart and check the same persisted session/owner/hidden Ready state.
- Open Play in a separate fresh tab: verify host-busy handling. Release control in the first tab; explicitly claim it in the second and verify no new session was created.
- Use keyboard focus, native select/radio keys and Enter/Space on buttons. Check visible focus and readable controls at laptop and tablet widths, without horizontal overflow. This does not certify an actual tablet or Road Mode.
- Revisit Image Library and confirm existing import, editing, classification, approval and filtering workflows still work.

Automated verification: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `openspec validate game-experience-mvp --type change --strict`, `openspec validate --all --strict`, and `git diff --check`. See the change's task-5.5 verification record for current navigation/recovery results and browser-check limits. Historical task/milestone evidence is retained. Physical Android/TV, viewing-distance, external-internet-disconnection and full-game acceptance remain separate checks.
