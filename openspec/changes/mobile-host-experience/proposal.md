## Why

The host normally operates a phone held in portrait while the laptop shows the contestant screen. Today's host page stacks desktop panels above live controls, forcing substantial scrolling and separating disabled actions from the connection or pending-command explanation needed to recover.

## What Changes

- Introduce a portrait-first, phase-aware host console: round owner, tier/points, authoritative timing, concise private answer and valid primary actions precede supporting panels.
- Keep recovery explanations and existing explicit receipt/reconnect controls adjacent to blocked round actions.
- Use compact score summaries with expandable history; put display links/QR/LAN setup and session options in clearly named supporting sections.
- Make the active Play shell compact on phones and provide reachable round actions with safe-area spacing, accessible focus and responsive fallbacks.
- Preserve setup, contestant switching, preparation/cancellation, judgment, late credit, pause/resume, result reveal, advancement and confirmed End/New game behavior.
- Review representative mobile layouts before implementation; verify physical phone operation separately from viewport tests.

## Capabilities

### New Capabilities

- `mobile-host-controls`: Portrait host information hierarchy, phase actions, adjacent recovery, supporting panels and accessible responsive behavior.

### Modified Capabilities

None. This adds presentation requirements on top of the active `game-experience-mvp` contracts (especially GD-01/05/06 and GN recovery); it does not replace their rules. Those capabilities are not yet synchronized into main specifications. The contestant visual change remains separate.

## Impact

Primarily `client/src/game/HostPage.tsx`, its presentation components/CSS Modules, and a Play-scoped adjustment to `App.tsx`/`App.module.css`; focused client tests and host operation documentation. Reuse `useGameHost`, `HostDisplayPanel`, `HostRoundControls`, scoreboard projections and the existing shared HTTP/WebSocket adapter. No new dependency, database migration, endpoint, timer authority, transport owner or gameplay rule.

Out of scope: contestant scene redesign, library administration, host authentication/handoff redesign, automatic reconnect command replay, classification/scoring changes, global app redesign and certification of unavailable hardware. Standard guessing remains 30 seconds under the approved gameplay refinement; stable tier identifiers and Easy/Medium/Hard labels remain unchanged. No Tailwind or styling framework.
