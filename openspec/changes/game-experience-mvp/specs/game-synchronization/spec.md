## Purpose

Synchronize host and contestant views over local HTTP and WebSockets with one authoritative session, bounded messages, reliable clock observations and explicit reconnect behavior.

## ADDED Requirements

### Requirement: GN-01 One authority across transports and modes
The local Node server SHALL own transitions, clocks, used sets, adjudication and scores for both modes. Recommended P5/P6 specify interruption/recovery choices; the authoritative-server/read-only-role boundary does not depend on display availability. Host commands SHALL use one validated command service. Studio windows and Road devices SHALL consume the same versioned public/host projections and timing semantics. A browser-local store or inter-window message SHALL not become authoritative.

#### Scenario: Studio and Road observe one round
- **WHEN** two displays connect to the same session through supported local transports
- **THEN** session/round identities, phase, deadline and scores agree without separate game engines

### Requirement: GN-02 Initial snapshots and ordering
Each connection SHALL receive a complete role-appropriate snapshot before rendering gameplay. State messages SHALL identify protocol version, server epoch, session, state revision and connection ordering. Older snapshots/old-connection responses SHALL not overwrite newer state; reconnect SHALL obtain current state instead of relying on missed incremental events.

#### Scenario: Reload during a round
- **WHEN** the display reloads or reconnects
- **THEN** it resumes the current authoritative phase and remaining time, never a new full-duration window or new score

### Requirement: GN-03 Display readiness and clock estimation
The designated primary display SHALL confirm its selected round image has decoded and its clock observation is sufficiently current before reveal/resume. Viewers SHALL interpolate countdowns from server timing observations and local monotonic elapsed time, not award points, extend deadlines or expire the server round. Server restart SHALL invalidate old clock epochs and readiness acknowledgments.

#### Scenario: Unsynchronized display
- **WHEN** readiness or clock quality is absent, stale or belongs to another round/connection
- **THEN** reveal/resume is disabled with an actionable host status

### Requirement: GN-04 Proposed interruption policy
Primary-display or controller-liveness loss during guessing SHALL automatically pause at server detection with the actual remaining time and SHALL require explicit host resume after readiness returns. Reaching the deadline before detection SHALL produce expiry, not a time refund. Secondary viewer loss SHALL not pause the game. A stale disconnected viewer SHALL cover the image and reconnect without submitting game mutations.

#### Scenario: Wi-Fi interruption
- **WHEN** the primary tablet disconnects during guessing
- **THEN** the server preserves its detected remainder or settles expiry, the host sees the interruption, and reconnect alone does not resume or score

#### Scenario: Secondary display disconnects
- **WHEN** a secondary viewer disconnects while the designated primary remains ready
- **THEN** the recommended policy leaves the server deadline unchanged and creates no score, answer reveal or Advance

#### Scenario: Controller disconnects
- **WHEN** controller liveness expires during guessing while the primary display remains connected
- **THEN** the round pauses at detection or expires if already due, and a recovered controller must review state and explicitly resume

### Requirement: GN-05 WebSocket role and transport validation
The proposed real-time transport SHALL validate allowed local UI origins at upgrade, supported protocol, message type/shape/size and role permissions before side effects. Display connections SHALL accept only synchronization, readiness and liveness messages; host commands SHALL remain subject to controller lease and revision checks. Oversized/malformed/unsupported messages and excessive slow-client backlog SHALL be rejected or disconnected predictably.

#### Scenario: Typed message runtime validation
- **WHEN** a client submits a payload violating shared message discriminants, bounds or its read-only role
- **THEN** runtime validation rejects it before domain effects even if a TypeScript caller claims it has the expected type

#### Scenario: Display attempts a host command
- **WHEN** a display socket submits a game mutation or an unapproved origin attempts an upgrade
- **THEN** it is rejected without state/score changes or secret host data

### Requirement: GN-06 Offline local assets and hidden answers
Static UI, branding and committed game image bytes SHALL load from the laptop without cloud APIs/fonts/CDNs. Public round assets SHALL expose no original filenames, source titles or private answer metadata in URLs, DOM, accessibility labels or pre-reveal projections. Game synchronization SHALL not imply authentication or anti-cheat protection for the existing trusted-LAN library administration API.

#### Scenario: Local Wi-Fi without external internet
- **WHEN** external internet is disconnected but the tablet can reach the laptop
- **THEN** a built, already installed application can prepare, display, judge and complete games using local assets and transport

#### Scenario: Unrevealed judgment privacy
- **WHEN** a contestant receives an adjudicated snapshot before the host's Reveal Result action
- **THEN** its allowlisted HTTP snapshot and DOM omit the current outcome, earned award, resulting score increment and answer identity
- **AND** host capabilities and private judgment data are never sent to the contestant for concealment by CSS

### Requirement: GN-07 Controller coordination and explicit recovery
Only the current controller lease SHALL mutate a session. Another host tab SHALL observe a busy/read-only state unless deliberate recovery transfers control. Lease possession SHALL not be claimed to authenticate people on an untrusted network. After uncertain command delivery or server restart, the host SHALL review current snapshot/receipt state before deliberate retry or recovery.

#### Scenario: Lost scoring response
- **WHEN** a host does not know whether its Correct request committed
- **THEN** it can resolve the command receipt and current state without blindly issuing another score

### Requirement: GN-08 Bounded shutdown and storage failures
Game timers, read-only streams, controller leases and in-flight operations SHALL be released predictably on normal shutdown and failed startup without indefinite waits or unhandled rejections. State and score publications SHALL follow successful persistence. Storage failure SHALL block further game mutations and communicate recovery requirements without inventing success.

#### Scenario: Stop a server with connected displays
- **WHEN** the server shuts down with active timers and WebSocket clients
- **THEN** connections and owned resources close within documented bounds and the last committed session remains recoverable

### Requirement: GN-09 Bounded LAN join address observation
The server SHALL provide a host-capability-protected LAN origin observation for contestant link creation/explicit refresh, separate from game commands. On macOS automatic detection SHALL run `ipconfig getifaddr en0` with fixed arguments, no shell, bounded time/output and validated usable IPv4 output. It SHALL not run in startup requirements, snapshot polling, countdown, judgment or image processing. Unsupported platforms and command/interface failures SHALL produce actionable unavailable status rather than hangs, fabricated addresses or silent interface substitution. Tests SHALL inject detection rather than depend on the developer's network.

The derived device origin SHALL replace only a loopback UI hostname, retaining the UI protocol/port; an already configured non-loopback IPv4 UI origin may be retained. An explicit manual exact HTTP(S) LAN origin SHALL support alternate interfaces/ports. All inputs SHALL be runtime validated and the effective device origin SHALL belong to the existing configured exact-origin allowlist. Discovery/override SHALL not silently change listener binding, environment configuration or origin permissions. Production SHALL distinguish loopback-only listeners from deliberate LAN binding; Vite development SHALL preserve its actual frontend port/proxy. Configuration success SHALL not be represented as proof of firewall/Wi-Fi reachability or Road certification.

#### Scenario: Successful local address discovery
- **WHEN** a host requests a device link from an allowed loopback UI origin and detection returns a usable en0 IPv4 address
- **THEN** observation proposes that address with the same UI protocol/port and reports whether the server/frontend LAN configuration permits it
- **AND** no session, viewer registration, timer, score, primary selection or current game phase changes

#### Scenario: Detect on demand with bounded failure
- **WHEN** detection is missing, nonzero, empty, malformed, timed out or cancelled, or en0/platform support is absent
- **THEN** observation terminates within its documented bound and returns an actionable error/manual-origin path
- **AND** normal localhost startup, gameplay, polling and shutdown remain available without repeated detector execution

#### Scenario: Preserve configured origin permissions
- **WHEN** discovery or manual override yields an origin outside NAME_THAT_MATCH_UI_ORIGINS, or the production listener is loopback-only
- **THEN** the host receives explicit configuration instructions and no device-ready QR is advertised
- **AND** unrelated/malformed origins remain rejected without wildcard CORS, automatic allowlist additions or trust in Host/Forwarded headers

#### Scenario: Development and production use their own UI ports
- **WHEN** otherwise valid joining is configured for the Vite frontend or Node-served production UI
- **THEN** each device link retains its actual UI protocol/port, including configured non-default ports
- **AND** development does not substitute the backend proxy port and production does not advertise the Vite port

#### Scenario: Changed IP and manual interface selection
- **WHEN** the host explicitly refreshes after an IP change or supplies a valid configured manual LAN origin for another interface
- **THEN** the current link/QR can be recomposed without re-registering the viewer or changing game authority
- **AND** invalid overrides are rejected, stale observations are ignored, and old scanned addresses are not promised to remain reachable

#### Scenario: Observe address without leaking game authority
- **WHEN** a viewer or unauthorized caller requests host-only address observation
- **THEN** access is refused under existing role/epoch/origin/header rules
- **AND** no controller token, private answer or complete capability-bearing join URL enters observation responses, logs or persistent game state
