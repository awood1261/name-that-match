## Purpose

Present the authoritative difficulty in the contestant's Selecting Match animation while preserving the host's control over clue exposure and gameplay timing.

## ADDED Requirements

### Requirement: CSA-01 Authoritative target and centered selection
The Selecting Match scene SHALL use the accepted public round's requested tier as the immutable animation target throughout that attempt. A completed shuffle SHALL center exactly one card for that tier, with its label and illustration clearly visible. Easy SHALL use the victorious wrestler illustration with green treatment, Medium the grappling wrestlers with yellow treatment, and Hard the skull and barbed wire with red treatment. Tier labels SHALL read EASY, MEDIUM and HARD. The carousel SHALL use generic bundled artwork and SHALL have no ability to change gameplay selection.

#### Scenario: Each tier settles at center
- **WHEN** an attempt for Easy, Medium or Hard is observed through the end of the animation
- **THEN** the corresponding card remains centered on the carousel axis with its difficulty label, illustration and stable color
- **AND** intermediate positions and the reference image's illustrated tier have no effect on the outcome

#### Scenario: A proposed choice has not been committed
- **WHEN** the host changes a tier selection before an accepted Prepare command or a command is rejected without creating a round
- **THEN** the contestant display follows the existing public state and does not start an animation from that uncommitted selection

### Requirement: CSA-02 Deterministic shuffle and impact
For a new preparation observed during normal play, the animation SHALL progress through rapid horizontal shuffle, gradual deceleration, centered lock, a single color impact, and a settled hold. The visual sequence SHALL target about two seconds and use a deterministic path to the selected tier. On lock, the target SHALL become slightly larger and remain centered. Impact SHALL transition the border to the tier color, pulse the glow once, flash the selected card background briefly, and add a subtle radial spill. The surrounding cards SHALL remain visible during the impact and fade afterward. The sole remaining card SHALL retain a stable colored border and readable icon and label during the hold.

#### Scenario: Hybrid fade after impact
- **WHEN** the selected card locks and enters the impact phase
- **THEN** neighboring cards remain visible during the single pulse and flash
- **AND** neighboring cards fade after the impact while the selected card stays centered through the fade and hold

### Requirement: CSA-03 Host pacing, cancellation and recovery
The animation SHALL be local presentation during public Preparing and Ready. A Ready update or repeated observation of the same round SHALL keep the same target and SHALL NOT restart the sequence. If still preparing or ready when the animation ends, the display SHALL hold its settled card without implying the clue is ready. The animation SHALL NOT expose a clue, start the countdown, change readiness, send gameplay commands, or delay an accepted Reveal. Image decode and synchronization gates SHALL remain authoritative. Cancellation, failed preparation, replacement and loss of the selection scene SHALL release obsolete animation work. Refresh, viewer reconnection and restoration into an existing Preparing or Ready attempt SHALL show its settled tier without replaying the impact. Host reconnect alone SHALL NOT replay the animation.

#### Scenario: Early Ready and early Reveal
- **WHEN** preparation becomes Ready before the animation finishes
- **THEN** the selecting presentation can continue while the clue remains covered
- **AND** an accepted host Reveal immediately replaces the presentation through the existing guessing and synchronization flow, even during shuffle or impact

#### Scenario: Slow preparation or lost acknowledgement
- **WHEN** the animation ends while the public round is still Preparing, or a host command response is delayed or lost
- **THEN** the contestant view follows the latest valid public phase and does not create another selection or reveal a clue

#### Scenario: Cancelled, failed or interrupted preparation
- **WHEN** cancellation or preparation failure returns the public session to choice, or the display enters a recovery cover
- **THEN** the corresponding existing view replaces selection and pending visual work stops
- **AND** a new accepted round can animate its own tier without rendering stale work from the previous round

#### Scenario: Restoration and repeat observations
- **WHEN** Preparing or Ready is restored after refresh or viewer reconnection
- **THEN** the current round's centered tier is shown without the impact
- **AND** repeated observations or reconnecting the host alone do not start another visual sequence for that attempt

### Requirement: CSA-04 Readability, motion and spoiler protection
The Selecting Match scene SHALL use a readable responsive composition within the existing uniformly scaled contestant stage. Its logo, heading, selected tier's text and illustration, and decorative scan panel and checklist SHALL remain legible at desktop, landscape and portrait reference sizes without horizontal page scrolling. The selected card and its tier effects SHALL remain within the carousel's available framing. Compact fullscreen and safe-area controls SHALL remain outside the stage. Reduced-motion viewers SHALL receive the stable selected card immediately, with no shuffle, flash or glow pulse and no added waiting time. The scene SHALL communicate the tier through its text and illustration as well as color. The decorative sequence SHALL avoid strobing, status spam and measured-progress semantics.

#### Scenario: Portrait and reduced motion
- **WHEN** the viewport is narrow or its orientation changes
- **THEN** the centered card, label and icon remain readable with contained effects while the scan panel and checklist reflow
- **AND** when reduced motion is enabled, the view presents the settled tier immediately and skips motion and flash

#### Scenario: Safe presentation while the clue loads
- **WHEN** the screenshot is still hidden, including after an authenticated preload has decoded it
- **THEN** the selection art and accessibility output expose only the allowed public tier and generic selection presentation
- **AND** the actual clue, answer metadata and real readiness or processing progress are absent from the selection scene
