## Purpose

Provide a comp-faithful, offline wrestling game-show presentation for contestant tier choice, concealed selection and screenshot/countdown without changing authoritative game behavior.

## ADDED Requirements

### Requirement: CV-01 Comp fidelity and local illustrations
The three screens SHALL follow the corresponding approved files in `design-comps/screen-updates`: B2BED88D for Choose, 0B139A38 for Selecting and 6B6C3FBD for screenshot/countdown, with full filenames inventoried in design.md. They SHALL use the existing local logo, black background, condensed-looking bold italic typography, white text, purple accents and comp-specific colored borders. Tier illustrations SHALL faithfully recreate the victorious wrestler, grappling wrestlers and barbed-wire skull as reviewed local assets, not emoji. Each difficulty card SHALL render its illustration as an independent local SVG image element alongside semantic dynamic heading/point text, never as a card background or flattened card image. Interfaces SHALL be independently rendered and dynamic; whole-screen flattened comps SHALL NOT be used as application backgrounds. No runtime internet or new dependency SHALL be required.

#### Scenario: Standalone assets are reviewed
- **WHEN** the illustrations are prepared for implementation
- **THEN** the owner reviews all three against the Choose comp before integration, and any replacement or material fidelity limitation is explicit
- **AND** approved Barlow Condensed faces are self-hosted with offline fallback stacks and their required license, without runtime external stylesheet/font requests

### Requirement: CV-02 Choose Your Match
A synchronized public `setup` or `between_rounds` state SHALL show the centered logo, CHOOSE YOUR MATCH heading and three informational cards: Squash Match / 1 POINT / green, Competitive Match / 2 POINTS / yellow, Deathmatch / 3 POINTS / red. Cards SHALL NOT submit commands, act as buttons or enter the tab order. This screen SHALL have no empty clue placeholder or persistent scoreboard in the main area. Selecting a host tier alone SHALL NOT advance it. The existing host SHALL remain the source of truth for tier availability; contestant cards SHALL NOT claim a tier is available or unavailable without authoritative public information.

#### Scenario: Verbal choice and explicit preparation
- **WHEN** the host changes the selected tier while waiting between rounds
- **THEN** Choose Your Match remains visible with informational 1/2/3-point cards
- **AND** only an accepted preparation transition moves the display to Selecting Match

#### Scenario: Empty or exhausted tier
- **WHEN** the existing host eligibility rules refuse preparation
- **THEN** the host retains its existing explanation and the contestant stays on the appropriate safe state without a fabricated availability badge or alternate selection

### Requirement: CV-03 Selecting Match and host pacing
Public `preparing` and `ready` SHALL show SELECTING MATCH... with a horizontal decorative card composition, yellow highlighted center, purple surrounding frames and a lower scanning panel/checklist. The theatrical steps SHALL be IDENTIFYING WRESTLERS, ANALYZING EVENT, DETERMINING DIFFICULTY and SELECTING MATCH.... This SHALL be described accessibly as a presentation sequence, not actual recognition, metadata analysis or readiness progress. The intro SHALL settle into continuous restrained waiting activity (slow center emphasis), with a static reduced-motion equivalent; finishing it SHALL NOT Reveal, score, change selection or delay an accepted host Reveal. Repeated snapshots SHALL NOT restart the intro.

#### Scenario: Ready arrives before animation completes
- **WHEN** preparation becomes Ready during the visual intro
- **THEN** Selecting Match continues until the host reveals, and the existing image-decode/clock gate remains independent
- **AND** host Reveal can interrupt the decorative sequence immediately without a minimum waiting period

#### Scenario: Cancellation, failure or restored readiness
- **WHEN** preparation is canceled or fails and the authoritative state returns between rounds
- **THEN** Choose Your Match replaces selection and all obsolete decorative work stops
- **WHEN** a viewer refreshes or reconnects into Preparing/Ready
- **THEN** it restores the stable selection waiting composition without implying a new preparation or restarting a mandatory intro

### Requirement: CV-04 Selection spoiler prevention
Selection imagery SHALL be bundled, generic non-identifying illustration; it SHALL NOT use the prepared image, real library thumbnails, previous exposed clues or identifying metadata. Names, titles, promotion, event, date, source provenance and current hidden judgment SHALL NOT enter pre-reveal decorative DOM, labels, CSS backgrounds or transitions. The existing authenticated preload/decode SHALL remain covered until authoritative guessing; a visual blur or opacity mask SHALL NOT be the privacy boundary.

#### Scenario: Hidden image is decoded
- **WHEN** the prepared image finishes its existing authenticated preload
- **THEN** no selected-image element is mounted in the visible selection scene and its URL is not used in decorative art
- **AND** readiness can still be reported without exposing that clue before host Reveal

### Requirement: CV-05 Screenshot and actual round strip
An available, decoded clue in synchronized `guessing` SHALL show the existing selected image as the dominant element inside a thick yellow frame, preserving its entire source aspect ratio through containment. The top SHALL contain the existing logo. The compact bottom strip SHALL show actual exposed round number, selected game tier and MM:SS countdown. The guessing composition SHALL contain no scoreboard, contestant-name heading, identifying metadata, explanatory prose or game controls. Local fullscreen/guide controls SHALL remain accessible outside the filmed composition.

#### Scenario: Round numbering and multiple source ratios
- **WHEN** the third exposed turn begins after earlier canceled preparations
- **THEN** the strip displays ROUND 03 from authoritative exposed-turn ownership, not attempt count or a client counter
- **AND** both wide and non-wide source images are fully contained without stretching or clipping

### Requirement: CV-06 Countdown presentation and transition safety
The display SHALL format the existing synchronized remaining time as MM:SS using the same ceiling, clamp, pause and monotonic interpolation behavior. Final three seconds SHALL receive steady non-color-only urgency without flashing, layout shift or a new independent clock. Animation SHALL NOT delay, reset or extend the countdown. Revealed screenshots SHALL NOT be retained in an exit animation after guessing ends or synchronization becomes stale.

#### Scenario: Reveal during selection and resume
- **WHEN** authoritative guessing arrives during a decorative intro
- **THEN** the actual clue and current countdown replace it immediately
- **WHEN** a saved paused round resumes
- **THEN** only its preserved authoritative remainder is displayed, not a new ten seconds

#### Scenario: Refresh and expiry
- **WHEN** the viewer reloads into guessing with 2.3 seconds remaining
- **THEN** it displays 00:03, continues from current server observations and clamps at 00:00
- **AND** expiry/judgment transitions cover the clue immediately while preserving the existing explicit result reveal

### Requirement: CV-07 Responsive stage and filming guide
For these three screens the presentation SHALL use a uniformly fitted 16:9 logical landscape stage, retaining an optional centered 1080 × 960 logical safe-area guide with guides off by default. Narrow viewports SHALL adapt the visual layout without horizontal overflow, unexpected vertical scrolling, clipped cards, overlapping text or distorted images. The complete landscape screenshot SHALL be contained on screen; a center recording crop SHALL NOT be represented as preserving its complete contents. Operators SHALL receive crop limitations in operation guidance. Result/final/other legacy states SHALL retain their existing stage geometry and presentation.

This requirement explicitly supersedes Game Experience MVP GD-04's full-safe-stage containment and crop guarantee for Choose, Selecting and guessing only. Other phases retain GD-04. It refines GD-02's waiting/preparation/guessing content without changing game rules or result behavior.

#### Scenario: Landscape display and guide
- **WHEN** a laptop, TV or landscape tablet displays one of the three screens
- **THEN** the stage has uniform geometry, comp-derived hierarchy and an optional centered guide
- **AND** clean mode has no guide, and whole-image visibility does not depend on a center crop

#### Scenario: Narrow screen and existing result
- **WHEN** the viewport becomes narrow or rotates
- **THEN** choose cards, selection art and the round/tier/timer strip adapt to remain contained and readable
- **WHEN** an existing result/final state is observed
- **THEN** it uses its previous stage geometry and result/score behavior rather than a redesigned result screen

### Requirement: CV-08 Accessible bounded motion
The presentation SHALL preserve semantic headings, sufficient contrast, keyboard focus and the existing fullscreen/guide/retry controls. Motion SHALL be decorative, bounded and free of rapid flashing. Reduced motion SHALL produce a stable, visually complete selection equivalent without carousel movement, scanning sweep or entrance transforms. The visual checklist SHALL NOT create repeated assistive announcements or expose fake machine progress as a real progress bar; countdown announcements SHALL remain non-live. Screen changes SHALL NOT steal focus.

#### Scenario: Reduced motion and keyboard operation
- **WHEN** reduced motion is enabled and the operator uses keyboard-only local controls
- **THEN** cards/checklist/strip remain readable, focus stays visible and no decorative animation or extra per-frame announcements occur
- **AND** host timing, scoring and reveal readiness are unchanged

### Requirement: CV-09 Recovery and scope preservation
The existing public state/clock/image/connection adapter SHALL remain authoritative for presentation. Missing credentials/session, image failure, stale connection, paused, expiry, interrupted, adjudicated, revealed result, discarded and completed states SHALL remain distinct and covered as required by existing behavior. Recovery SHALL NOT replay game commands, launch a new selection, automatically Resume or reveal hidden information. Correct/incorrect/timeout/void results, totals, navigation protection and host workflows SHALL remain unchanged.

#### Scenario: Disconnection while guessing
- **WHEN** the existing adapter marks the viewer stale
- **THEN** clue rendering stops immediately, decorative transitions are canceled, and existing reconnect/error controls remain available
- **AND** fresh synchronization follows the current server phase with no local game-state reconstruction

### Requirement: CV-10 Verified acceptance and truthful closeout
Acceptance SHALL include automated state/privacy/countdown/recovery/component tests, production browser comparison against all three comps, responsive geometry and reduced-motion checks, regression checks and strict OpenSpec validation. Physical laptop/fullscreen, external TV, Android landscape, phone-host/laptop-display, local Wi-Fi without external internet, vertical filming/cropping and representative image-ratio/multi-round recovery checks SHALL record actual devices and outcomes. Unperformed checks SHALL remain open and SHALL NOT be reported as passed or treated as archival readiness without explicit owner disposition.

#### Scenario: Review evidence for archive
- **WHEN** implementation is presented for final acceptance
- **THEN** automated/browser evidence is separated from actual physical-device/offline/filming evidence, outstanding checks are visible and no archive occurs before required acceptance and explicit authorization

### Requirement: CV-11 Self-hosted contestant typography
The three new presentations SHALL use local Barlow Condensed: 900 italic major headings, 800 italic card/strip labels, 900 upright countdown and 700 upright supporting labels. Only necessary Latin WOFF2 faces SHALL be bundled with their required license and local provenance. Font declarations SHALL specify appropriate swap/fallback behavior and reusable contestant-scoped typography tokens; host/admin and legacy result typography SHALL remain unchanged. No Google Fonts CDN, external font stylesheet or network installation SHALL be needed at runtime. Missing/slow fonts and unsupported characters SHALL use offline fallbacks without hiding essential text or changing authoritative timing.

#### Scenario: Local font loading with external access blocked
- **WHEN** the installed/built application loads each new presentation with external requests unavailable
- **THEN** the four required font faces load from the local application origin and required labels/timer render with the specified weights/styles
- **AND** font licensing remains available locally and host/admin typography is unaffected

#### Scenario: Font delay or failure
- **WHEN** a local font is slow, unavailable or lacks a displayed character
- **THEN** fallback text remains readable, no gameplay transition or countdown waits on the font, and the layout preserves its essential content without clipping or disruptive shifts
