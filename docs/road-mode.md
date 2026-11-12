# Road Mode and real-time operation

Studio and Road use the same host controls, contestant display, Node game authority and SQLite session. Host commands and receipt review use HTTP; one shared WebSocket adapter carries observations, readiness, clocks and liveness. The contestant URL/QR still opens an ordinary read-only web page. Its [visual screens](contestant-visuals.md) use the same authoritative public phases and existing clock, with locally bundled typography/illustrations. That page derives its socket URL from its own origin. There is no separate Road game engine or scoring system.

## Prepare and start

Use Node 20/npm 10 and install the locked dependencies while installation access is available. Before upgrading operational data, stop every writer and follow the [whole-root WAL-safe backup procedure](local-storage.md#backup-and-restore). Schema remains 3; this transport milestone adds no migration.

```bash
npm ci
npm run build
```

For an attached TV and two windows on the laptop, `npm run prod` remains loopback-only at `http://localhost:3001`. See [Studio operation](studio-mode.md).

For a separate device, identify the laptop's current LAN IPv4 address. On macOS the existing detector uses `ipconfig getifaddr en0`; another interface/platform uses the existing manual origin workflow. Set the actual address in the exact allowed origins and deliberately bind to the LAN. For example, **replace `192.168.1.50` with your laptop's address**:

```bash
NAME_THAT_MATCH_HOST=0.0.0.0 \
NAME_THAT_MATCH_UI_ORIGINS=http://localhost:3001,http://127.0.0.1:3001,http://192.168.1.50:3001 \
npm run prod
```

Keep `NAME_THAT_MATCH_DATA_DIR` consistent across starts; run one server per data root. The built UI, logo, favicon, QR encoder and images load locally. Dependencies must already be installed and the build present for offline use. The same listener/port serves HTTP and WebSockets. Custom ports require matching exact UI origins.

1. Open Play on the laptop. Create/restore the session and review names, contestant selection and eligible tier counts.
2. Before preparation, create the contestant link with **Use new link as the primary display** checked. Scan the offline QR or copy the configured device URL on the other device.
3. Keep both devices on a reachable local network. Check laptop firewall/port access and Wi-Fi client isolation if joining fails. A configured origin or rendered QR is not proof of reachability.
4. On the viewer, choose optional fullscreen through its own gesture. Wait for **Primary · Connected · Decoded and synchronized** on the host, then prepare/reveal as usual. Only the designated primary gates Reveal/Resume; an extra viewer remains secondary.
5. After an IP change, explicitly refresh/apply the LAN address and reopen the updated URL on the device. Refreshing recomposes the same viewer capability; it does not move an already open page to a new IP or change primary designation. A server restart requires a fresh capability/link.

The current process retains its existing four-viewer-registration limit. Open/reconnect/QR refresh do not allocate another registration. Close unused windows; at most five sockets, including connections awaiting HELLO, are admitted. A full set can temporarily refuse an additional/replacement connection until a slot closes. Reusing the same display link replaces its earlier connection; the earlier page stops reconnecting until deliberately rejoined.

## Synchronization and failure behavior

`/api/game/live` requires the exact configured browser Origin and the `ntm.game.v1` subprotocol. Credentials travel in the validated HELLO message, never the socket URL/query. Both roles receive complete, bounded projections tagged with protocol, epoch, connection generation, session, revision and message order. Public frames omit hidden answers and current unrevealed outcomes/awards. Host readiness updates use `ready_status` with a complete host observation, not a partial game-state patch.

Messages are limited to HELLO, clock probes, image readiness and heartbeat acknowledgments; gameplay commands stay on the existing validated HTTP lane. No socket frame can judge, select contestants, Reveal, Resume or Advance. There is no production HTTP polling fallback or second subscription owning game liveness. Explicit HTTP reads remain for entry/recovery, Refresh availability and uncertain-request/receipt review.

| Bound | Behavior |
|---|---|
| HELLO | Three seconds to authenticate; unsupported roles/protocol/shape fail before effects. |
| Application/native heartbeat | One-second checks; loss detected after three seconds without valid liveness. |
| Clock/readiness | Existing three-second sample age and 500ms RTT budget; epoch/round/image/generation must match. |
| Reconnect | Capped exponential retry from 250ms to 5s with bounded jitter; full resynchronization and fresh decode. No automatic game command replay or Resume. |
| Payloads | Incoming JSON up to 16KiB; full outgoing projections up to 64KiB. PNG bytes remain authenticated HTTP Blob loads. |
| Backpressure | Keep one latest queued snapshot, cap queued bytes at 1MiB, end persistently blocked readers after three seconds. Incoming traffic is bounded to 30 frames/second per socket. |
| Shutdown | Stop accepting work, close owned streams and force slow sockets/HTTP connections within the two-second grace budget before releasing storage. |

When the primary or host connection is lost during guessing, the server pauses at detection with actual remaining time, or settles expiry if already due. Detection delay consumes elapsed time. The viewer covers stale content. Reconnection alone never resumes, scores or prepares a clue; wait for readiness and explicitly Resume. Secondary loss does not pause the primary game. High RTT, stale clock or decode failure keeps the primary unready rather than granting extra time.

An uncertain HTTP judgment remains pending even when the socket reports a newer state. Use **Check command status**, review the accepted receipt/current snapshot and retry only deliberately when offered. The existing command identity/revision guards prevent duplicate awards. A socket reconnect never resends that judgment.

For a normal command-line stop, SIGINT/Ctrl-C or SIGTERM uses the bounded `server.close()` path and persists a known pause when storage permits. Wait for exit before reopening the same root. A process kill/power loss during an unknown running window recovers Interrupted/void-only; it cannot supply a new ten seconds. A known committed pause and completed results retain their stored state. Server restarts invalidate capabilities/clock epochs: reclaim host control, request a fresh primary link and review recovery. Storage faults latch mutations and report unavailable rather than publish invented success.

This is trusted-LAN coordination, not account authentication or anti-cheat security. Existing library administration APIs remain available to trusted LAN readers. No cloud service, external font/CDN, TLS provisioning, camera permission or optional WebSocket native addon/compression was added. SQLite WAL/NORMAL power-loss limitations and whole-root backup requirements remain unchanged.

## Development proxy

`npm run dev` keeps the existing Vite UI at port 5173 and backend at 3001. The scoped `/api/game/live` proxy forwards sockets to the same backend and preserves the original browser Origin (`changeOrigin: false`); the existing `/api` HTTP proxy is unchanged. Configure exact frontend LAN origins using the **frontend** port when deliberately testing a LAN device. If changing the backend port, both proxy targets must match it. Production serves the built app directly and needs no Vite proxy.

## Manual acceptance and release limits

Use disposable data for interruption/fault experiments. Record device/browser, local network, screen resolution and actual outcome for each performed check:

- Laptop host plus Android on local Wi-Fi: scan/open the configured primary URL, decode, Reveal, judge, Reveal Result and compare scores. Check touch, fullscreen, contained images and readable reel-safe content.
- Drop/rejoin primary Wi-Fi during guessing, reload the primary and interrupt host connectivity. Confirm pause or expiry, cover, fresh readiness and explicit Resume with only the saved remainder. Disconnect a secondary and confirm it does not pause play.
- Exercise ordinary/late/zero judgments, consecutive same-contestant turns, explicit switching, multiple games, ties, End/New, empty/exhausted tiers and saved results after restart. Check pending receipt recovery without replay/double awards.
- Verify Studio launch/fullscreen/keyboard/reduced motion after the transport change. Run prolonged games at the intended viewing distance and with representative real screenshots/library activity.
- Disconnect external internet while retaining the required local network. Start the already installed/built app and play through completion without downloads or remote requests.

Automated local sockets, controlled latency, desktop browser runs and zero observed external requests are narrower evidence than physical Android/Wi-Fi/internet-disconnection testing. Unperformed hardware/offline/prolonged checks stay deferred in the [Milestone 6 verification record](../openspec/changes/game-experience-mvp/milestone-6-verification.md). Archived Photo Library real-collection/device deferrals remain separate. Stop for owner review before archive.
