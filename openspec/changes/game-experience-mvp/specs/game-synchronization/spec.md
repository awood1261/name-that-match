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
- **THEN** it resumes the current authoritative phase and remaining time, never a new ten-second window or new score

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
