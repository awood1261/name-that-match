# Game host — Milestone 2

Open **Play** from the application navigation. This milestone supports session setup and hidden screenshot preparation. Contestant displays, countdown controls, scoreboard/answer presentation, Studio windows and Road WebSockets are later milestones. Reveal is intentionally disabled until a real connected display is ready.

## Setup and preparation

1. Open Play. The view claims host control or restores this tab's current control. Opening it does not create or start a game. Another controlling host produces a busy message rather than a takeover.
2. Choose **1 — Solo** or **2 — Head-to-head**, enter distinct names (1–60 Unicode characters), choose the starting contestant and select **Create session**. The setup is persisted. You can edit it with **Save setup** or explicitly **Discard setup** before starting. Unsaved setup edits disable Start; save them first. In-progress local form edits are not themselves persisted.
3. Select **Start game**. At least one currently eligible match is required. The roster is fixed after Start. A capacity warning does not enforce equal turns or a fixed number of rounds.
4. Between rounds, use **Switch contestant** to explicitly select the active contestant. That selection persists until changed. It cannot reassign existing round ownership and is disabled while preparing/ready.
5. Choose **Squash Match — 1 point**, **Competitive Match — 2 points** or **Deathmatch — 3 points**. These request a pool derived by the existing obscurity × visual-difficulty matrix; they do not edit screenshot classifications.
6. Review eligible screenshot and distinct-match counts. A match can contribute multiple images or appear in several tier pools. These are current candidate counts, not a guaranteed number of future rounds. **Refresh availability** explicitly reassesses local assets. Normal polling reuses assessments until library record revisions change; actual Prepare always reassesses files and eligibility.
7. Select **Prepare screenshot**. The server chooses uniformly among eligible unseen screenshot rows, validates the selected PNG/record revisions and pins only that current image in memory. Preparing changes to **Screenshot ready · hidden**. No screenshot is displayed, no countdown starts, no match is marked exposed and no points are awarded. The private host answer can be inspected independently of any future contestant answer-reveal action.
8. **Cancel preparation** releases the hidden candidate and returns between rounds with the same contestant. The cancelled attempt remains in history, but the same match may be prepared again because it was never exposed.

An empty selected tier disables Prepare with an explanation. If content changes after the counts were assessed, the server returns an explicit empty-pool/stale-candidate error; refresh or review the library and deliberately prepare again. There is no automatic fallback tier or grouping by video. Pending/rejected, incomplete, unassigned, unrated or invalid/missing images are excluded. Uncertain storage produces an error, not invented zero counts.

Image Library shows both **classified** and **eligible** totals for each tier. A classified Deathmatch screenshot can still be pending review and unavailable to Play. Open its match, select **Review screenshot** and explicitly approve it after checking its saved metadata and image. Play additionally excludes matches or identical image content already exposed in the current game, so its remaining availability can be lower than whole-library eligibility. The Unassigned screenshots view is a queue; zero entries does not mean the library is empty. Assigned captures are under Matches.

## Host control and request recovery

- The current controller renews while Play is open. **Release host control** permits another tab/device to claim. Leaving Play stops renewals; control becomes claimable after 10 seconds without renewal. A host-liveness loss is detected after 3 seconds; it never awards points or advances a round. There is no force-takeover of an actively renewed lease.
- Reloading/reopening Play restores the existing session rather than creating a duplicate. After a server restart, process credentials expire; use **Take host control / reconnect** and review the restored state. A Ready candidate is revalidated and remains hidden. If its image/metadata changed, cancel preparation and explicitly try again.
- Mutations are serialized in the host view. Revision conflicts refresh authoritative state and show an error; they are not blindly replayed.
- A lost response shows an uncertain-request panel and blocks new commands. Use **Check command status**. An accepted receipt restores the current state. If no receipt exists, the client checks current state before offering **Retry original request**, preserving the same command/session/round IDs and original revision. If state changed, deliberately dismiss only after that review; do not manufacture a second command to guess whether the first succeeded.
- Sessions, attempts, owner IDs and receipts live in SQLite; controller/viewer capabilities are process-local and never stored in game history. This is trusted-LAN coordination, not account authentication or an anti-cheat sandbox. Existing library administration remains reachable under its existing policy.

The native HTTP adapter exposes the existing M1 command lane plus private/public role snapshots and receipt lookup. Read-only viewer capabilities provide protocol groundwork; they do not implement a contestant page, image endpoint, readiness acknowledgment, countdown or display join workflow. No network request can supply a readiness override in this milestone. There is no End-game/scoreboard UI yet; continue the existing started session rather than deleting data to reset it. New-game completion controls belong to later approved work.

## Manual acceptance

Use an already backed-up collection or a disposable configured data root. Start normally with `npm run dev` (or `npm run build` then `npm run prod`). Do not overwrite or delete an operational database to test setup.

- Open Play with no session: verify that merely opening it does not create a game.
- Create a solo setup, check its name/start selection and reload persistence. Before Start, discard it and create a two-contestant setup to verify both configurations without changing a started roster.
- Try duplicate/blank names; verify actionable feedback and no saved invalid session. Edit a saved setup and verify Start is disabled until Save setup.
- Start with approved eligible content. Switch the active contestant and verify it stays selected.
- Confirm three tier labels/point values and separate screenshot/match counts. Choose an empty tier and verify Prepare is disabled with an explanation.
- Prepare a populated tier: verify Ready/hidden, disabled contestant switching, disabled Reveal with its display-required explanation and no visible timer/image/score controls.
- Cancel: verify the same contestant remains active and capacity is not consumed. Prepare again, then reload/restart and check the same persisted session/owner/hidden Ready state.
- Open Play in a separate fresh tab: verify host-busy handling. Release control in the first tab; explicitly claim it in the second and verify no new session was created.
- Use keyboard focus, native select/radio keys and Enter/Space on buttons. Check visible focus and readable controls at laptop and tablet widths, without horizontal overflow. This does not certify an actual tablet or Road Mode.
- Revisit Image Library and confirm existing import, editing, classification, approval and filtering workflows still work.

Automated verification: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `openspec validate game-experience-mvp --type change --strict`, `openspec validate --all --strict`, and `git diff --check`. See the change's milestone-2 verification record for actual executed results and browser-check limits.
