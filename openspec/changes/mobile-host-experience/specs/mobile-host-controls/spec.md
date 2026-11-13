## Purpose

Make the host's phone usable as a portrait game console while a separate read-only device presents the contestant experience, without changing authoritative gameplay or recovery rules.

## ADDED Requirements

### Requirement: MH-01 Round-first portrait hierarchy
The host view SHALL place current phase, assigned contestant, selected game tier/points, available authoritative time and phase actions before expandable supporting sections. Between rounds it SHALL prioritize explicit contestant and tier selection followed by Prepare. Setup and final-result views SHALL prioritize their respective setup and confirmed New game workflows. During a round, compact score totals SHALL remain available without requiring full history to precede controls. Current round identity SHALL use its immutable owner.

#### Scenario: Host operates while the laptop is the display
- **WHEN** an active host opens Play at a 390 × 844 CSS-pixel viewport at default text size
- **THEN** the phase, round owner and primary round actions are visible without scrolling through display setup, score history or game options
- **AND** long names or answer text wrap without horizontal scrolling

#### Scenario: Selecting the next attempt
- **WHEN** a round has been explicitly advanced
- **THEN** contestant selection, Easy/Medium/Hard with points and distinct-match/screenshot counts, and Prepare precede supporting sections
- **AND** selection does not prepare a screenshot or automatically alternate contestants

### Requirement: MH-02 Phase-specific actions preserve gameplay
The host console SHALL expose the existing commands according to server permissions and local busy, connection and pending-request gates. Preparing/Ready SHALL prioritize preparation status, readiness and Cancel, with Reveal & start only in Ready. Guessing SHALL prioritize Correct, Incorrect and Pause; Paused SHALL prioritize Resume; expiry SHALL offer the distinct timely-answer attestation and no-credit confirmation; Interrupted SHALL offer its existing void-only recovery. Adjudicated SHALL prioritize Reveal Result and revealed results SHALL prioritize Advance, preserving the existing void advancement exception. A private answer summary SHALL be visible when provided by the host projection, with optional fields/filming preview expandable. Local layout changes SHALL NOT create a timer, score, permission or command replay authority.

#### Scenario: Judge then reveal
- **WHEN** the host marks a guessing attempt Correct
- **THEN** controls await the saved judgment before offering Reveal Result
- **AND** the contestant's clue/frozen countdown and concealed answer persist until the explicit result reveal, with no new award or automatic Advance

#### Scenario: Late credit remains deliberate
- **WHEN** the server reports awaiting judgment after expiry
- **THEN** the action explicitly requires confirming an answer spoken before the buzzer rather than presenting ordinary Correct
- **AND** reconnecting or resizing does not restore guessing time

### Requirement: MH-03 Adjacent recovery and blocking reasons
The console SHALL show connection loss, uncertain request, preparation/revalidation failure and primary-display readiness blockers beside the affected phase actions, even when supporting sections are collapsed. It SHALL offer the existing applicable reconnect, Check command status, reviewed retry and reviewed dismissal controls there. A blocked primary action SHALL have a text explanation linked to its controls; multiple blockers SHALL remain discoverable together. A ready primary SHALL NOT mask a disconnected host or unresolved receipt. Automatic command retry, dismissal or controller takeover SHALL NOT be introduced.

#### Scenario: Ready display but pending command
- **WHEN** the primary is decoded/synchronized but the host has an unresolved command or lost live connection
- **THEN** Reveal remains blocked with the blocking reason and appropriate recovery control in the round console
- **AND** checking a receipt and reconnecting retain the existing independent gates without replaying a judgment

#### Scenario: Display setup needed
- **WHEN** Ready cannot reveal because the primary is absent or unready
- **THEN** its current readiness reason is visible beside Reveal and a control opens the display-connection details
- **AND** primary designation remains restricted by existing phase permissions

### Requirement: MH-04 Supporting operations remain discoverable
The host SHALL provide named expandable sections for Display connection, Score details and Game options after the console. Display connection SHALL retain link creation/opening, offline QR, LAN settings and primary/secondary status. Game options SHALL retain confirmed End game, release control and session identity; exceptional Skip/Void controls SHALL remain available separately from routine judgment. Expanding/collapsing a section SHALL NOT issue a command, clear a link, restart a request or reset local setup/tier state. Summary labels SHALL expose connection problems even when collapsed. End/New and navigation confirmation behavior SHALL remain unchanged.

#### Scenario: Toggle display details during play
- **WHEN** the host opens and closes Display connection after generating a contestant link
- **THEN** the same link and QR remain available and no new viewer, primary designation or command is created
- **AND** the full score ledger remains available in Score details

#### Scenario: Exceptional and destructive actions
- **WHEN** the host opens game or round options
- **THEN** Skip/Void reasons, allowed End game and release controls remain keyboard/touch reachable
- **AND** End game and New game retain explicit confirmation and cannot bypass unresolved-round or pending-request restrictions

### Requirement: MH-05 Accessible reachable controls
At phone widths the primary action group SHALL remain reachable while scrolling using a non-obscuring sticky region, with bottom safe-area spacing. It SHALL fall back to normal document flow on short viewports or enlarged text where sticking would obscure content. Controls SHALL have at least 44 × 44 CSS-pixel targets, visible keyboard focus and meaningful names; judgment SHALL be distinguished by text as well as color. Focus order SHALL follow visual reading order and hidden panels SHALL contain no reachable controls. Phase transitions SHALL preserve valid focus or move it to the new phase heading if its focused action disappears, without auto-submitting the replacement action. Countdown ticks SHALL NOT flood live announcements.

#### Scenario: Small viewport and large text
- **WHEN** Play is viewed at 320 CSS pixels wide, rotated to a short landscape viewport, or text is enlarged to 200 percent
- **THEN** all controls and explanations remain reachable by normal scrolling with no overlapping actions, clipped focus or horizontal page overflow
- **AND** sticky behavior does not conceal focused fields or browser keyboard interactions

#### Scenario: Keyboard phase transition
- **WHEN** a focused judgment button disappears after an acknowledged action
- **THEN** focus moves to a meaningful phase heading and the host can reach the next valid action without a focus trap
- **AND** holding or repeating input does not activate the next phase's different command

### Requirement: MH-06 Scoped responsive presentation
The active Play shell SHALL use a compact phone header while retaining access to existing navigation and guarded departure. Wider layouts SHALL preserve the round-first hierarchy with supporting content beside or below it. Styling SHALL use existing local branding, centralized design tokens and semantic CSS Modules. The contestant display and library administration SHALL retain their existing layouts and behavior; changing viewport size SHALL NOT remount the host connection or discard an unresolved command.

#### Scenario: Navigate away from guessing
- **WHEN** the host uses compact navigation during an active guess
- **THEN** Stay / Pause-and-leave and return-to-paused semantics remain intact
- **AND** no navigation menu or responsive change silently releases control or resumes play

#### Scenario: Wider display and regressions
- **WHEN** the host resizes from portrait phone to desktop and back
- **THEN** the session, pending request, tier and command gates are retained without duplicate controls/subscriptions
- **AND** contestant fullscreen, safe-area guides and Image Library workflows are unchanged
