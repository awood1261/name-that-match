## Purpose

Provide separate host controls and a readable branded contestant experience for filming on external displays and tablets, with accessible, responsive and reel-safe presentation.

## ADDED Requirements

### Requirement: GD-01 Separate host and contestant roles
The host view SHALL provide setup, current contestant/tier, pool availability, private answer context, valid phase commands and connection/readiness feedback. Approved P2 SHALL provide a convenient, keyboard-accessible Switch contestant action between rounds, disabled with a clear explanation during an attempt. Current-round contestant and outcome labels SHALL use the round owner rather than a later active selection. The contestant view SHALL show only its public phase projection, with no library controls, host actions or private answer/provenance before answer reveal. Under the still-proposed P7 verbal-tier-input policy, the host SHALL enter the contestant's verbal tier choice. Contestant displays SHALL remain read-only under approved P2 and SHALL not select contestants or submit host commands.

#### Scenario: A contestant display opens
- **WHEN** the display is opened on a TV window or tablet
- **THEN** it does not expose the administrative application shell, host controls, debug state or hidden answer fields

#### Scenario: Host-only contestant switching
- **WHEN** the host switches the active contestant between rounds using the keyboard-reachable control
- **THEN** the display reflects the server-confirmed selection without offering a selection control of its own
- **AND** earlier round labels and score ownership remain unchanged

### Requirement: GD-02 Phase-specific game presentation
The display SHALL support solo and head-to-head layouts for the approved one or two contestants, waiting/setup, tier choice, abstract shuffle/preparation, hidden-image ready, screenshot/countdown, pause/reconnecting cover, correct/incorrect/timeout feedback, explicit answer reveal, scoreboard and final results. The scoreboard SHALL use real committed outcomes and descending score order, preserve ties and show no fabricated comp example scores or fixed-round limit.

#### Scenario: Countdown and feedback
- **WHEN** a ready round starts and is later adjudicated
- **THEN** the display presents a contained screenshot and readable countdown, then the same exposed screenshot and a frozen countdown while the result stays concealed
- **AND** only the host's subsequent Reveal Result presents the authoritative outcome, earned points and frozen match identity without awarding points locally

#### Scenario: Dramatic correct or incorrect reveal
- **WHEN** a connected contestant display observes the host-controlled transition to answer-revealed
- **THEN** a correct outcome presents prominent CORRECT! text, the committed earned points and a green success treatment with a brief energetic entrance
- **AND** an incorrect outcome presents prominent INCORRECT! text, zero earned points and a distinct red failure entrance
- **AND** participant/team description, promotion/event and available date/year, stipulation and championship fields use only the frozen answer snapshot
- **AND** timeout uses the red failure treatment but retains its TIME UP label, and void retains its distinct zero-point presentation rather than being relabeled incorrect

#### Scenario: Reduced motion and restored presentation
- **WHEN** reduced motion is requested, or a viewer initially loads/reconnects into an already revealed result
- **THEN** the result remains readable and stable without an entrance animation
- **AND** animation completion neither mutates game state nor triggers audio, answer changes, progression or scoring

#### Scenario: Covered preparation
- **WHEN** the display loads and decodes a candidate in Preparing/Ready
- **THEN** the picture stays covered until accepted screenshot Reveal & start and no answer metadata appears before answer Reveal

#### Scenario: Host enters a verbal tier choice
- **WHEN** the host records Squash Match, Competitive Match or Deathmatch under recommended P7
- **THEN** the corresponding server eligible pool is selected without changing any screenshot classification or point value
- **AND** contestant devices have no tier-entry or other mutation control

#### Scenario: Final tie
- **WHEN** final totals tie
- **THEN** all tied leaders are identified rather than arbitrarily selecting the first displayed contestant

### Requirement: GD-03 Studio window behavior
Studio Mode SHALL use a separate contestant window/tab addressed by session identity. Opening SHALL follow an explicit user gesture, handle popup blocking and permit manual placement on an external monitor. Fullscreen SHALL be optional and user-controlled. Closing/reloading the window SHALL not create a new game, reset a timer or reveal private controls.

#### Scenario: External TV setup
- **WHEN** the host opens the display and places it on the external monitor
- **THEN** controls remain on the laptop and both windows observe the same server-owned session
- **AND** a blocked popup provides an ordinary display link instead of failing silently

### Requirement: GD-04 Filming composition and screenshot geometry
Critical contestant content SHALL fit within a centered 1080 × 960 logical reel-safe stage scaled uniformly to the available viewport. Logo, screenshot, countdown, active contestant, feedback and essential answer/score information SHALL remain within that safe stage; decorative side regions SHALL carry no essential information. Screenshots SHALL preserve aspect ratio with containment. Guide lines SHALL be an optional preview aid and not appear in the clean filming view by default.

#### Scenario: Landscape TV and portrait recording crop
- **WHEN** a wide TV presentation is cropped to the centered safe stage
- **THEN** essential game information remains visible without stretching or cropping the source screenshot

#### Scenario: Tablet or narrow viewport
- **WHEN** the display is viewed on a tablet or rotated
- **THEN** the same phase hierarchy fits without page overflow; a deliberate fullscreen/landscape suggestion does not bypass browser restrictions

### Requirement: GD-05 Existing branding and accessible controls
Game UI SHALL use the official local horizontal logo/favicon, existing black/yellow/purple/white tokens, semantic CSS Modules and local assets. It SHALL provide keyboard-reachable host controls, visible focus, named buttons, text/icon outcomes, sufficient contrast and reduced-motion behavior. Countdown changes SHALL not flood screen-reader announcements. Motion SHALL be cosmetic and SHALL not control state or timing.

#### Scenario: Keyboard and reduced motion
- **WHEN** the host operates without a pointer or reduced motion is enabled
- **THEN** game actions remain available, abstract shuffle animation can be omitted, and timing/scoring are unchanged

### Requirement: GD-06 Explicit loading and recovery presentation
Both roles SHALL distinguish no session, empty pool, image loading/failure, stale command, disconnected display, recovery-required session and completed results. The host SHALL know which primary display is ready. An uncertain/disconnected contestant display SHALL cover stale gameplay content and await synchronization rather than act as a second authority.

#### Scenario: Image cannot decode
- **WHEN** the designated display cannot load or decode the selected local image
- **THEN** it reports not-ready, the host cannot start the attempt and no unexposed match is consumed

### Requirement: GD-07 Offline QR and copyable contestant joining
Under the owner-approved LAN join refinement, the host connection panel SHALL show a locally generated QR code beside the copyable contestant device URL once a viewer capability and configured usable LAN origin are available. Both representations SHALL contain exactly the same full URL, preserving scheme/port, session route and the display/token/epoch fragment. The QR SHALL grant only the existing read-only viewer access, SHALL not contain a host token/private answer, and SHALL not appear on the contestant filming stage. Generation SHALL require no external service, CDN, camera permission or internet connection. A maintained bundled encoder SHALL require explicit approval before any new dependency is installed.

#### Scenario: Scan the complete contestant link
- **WHEN** a host creates a display link from a loopback UI with successful configured LAN discovery
- **THEN** the copy field and decodable QR contain the same LAN-address URL with the original UI scheme/port, session identity and complete viewer join fragment
- **AND** scanning joins the existing read-only display without creating a game, starting a timer or bypassing primary readiness

#### Scenario: Refresh the address without changing the viewer
- **WHEN** the host explicitly refreshes discovery or applies a valid manual LAN origin to an existing join link
- **THEN** the displayed URL and QR update together while session ID, viewer capability, epoch and primary designation remain unchanged
- **AND** late/failed generation cannot leave an older QR beside a newer URL

#### Scenario: Address or LAN configuration is unavailable
- **WHEN** detection fails, the platform/interface is unsupported, or the detected/overridden origin does not pass the bind and exact-origin configuration checks
- **THEN** the panel explains the problem and offers validated manual configuration and the existing local-tab link
- **AND** it does not advertise a localhost or unconfigured origin QR as usable by another device

#### Scenario: QR generation fails or cannot be used
- **WHEN** a configured device URL exists but QR generation fails or the operator cannot scan it
- **THEN** the matching copyable URL remains available with clear error feedback and keyboard-accessible controls
- **AND** QR rendering uses high contrast, a quiet zone, responsive sizing and an accessible name without transmitting the capability to an external image service

#### Scenario: Join capability lifetime and disclosure
- **WHEN** a device opens the QR URL or a server restart invalidates its capability
- **THEN** existing fragment-removal/tab-storage and fresh-link recovery behavior remains unchanged
- **AND** generating, refreshing or copying the QR does not log or persist its full credential-bearing URL in game history or expose controller credentials
