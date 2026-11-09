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
The display SHALL support waiting/setup, tier choice, abstract shuffle/preparation, hidden-image ready, screenshot/countdown, pause/reconnecting cover, correct/incorrect/timeout feedback, explicit answer reveal, scoreboard and final results. The scoreboard SHALL use real committed outcomes and descending score order, preserve ties and show no fabricated comp example scores or fixed-round limit.

#### Scenario: Countdown and feedback
- **WHEN** a ready round starts and is later adjudicated
- **THEN** the display presents a contained screenshot and readable countdown followed by the authoritative outcome without awarding points locally

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
