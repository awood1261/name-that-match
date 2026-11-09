## MODIFIED Requirements

### Requirement: Minimal local-first application shell
The system SHALL provide a single-repository React + Vite + TypeScript shell whose foundation remains minimal and which exposes only separately approved library and gameplay capabilities.

#### Scenario: foundational shell loads in development mode
- Given the app is started in development mode
- When the runtime boots the foundation
- Then the user sees the local application shell, foundation status and separately approved workflows, with host and contestant game views governed by their own specifications

#### Scenario: scope remains intentionally limited
- Given the project review checks feature scope
- When the shell is inspected
- Then foundation responsibilities remain layout, branding, status and runtime structure while separately approved feature specifications own library and gameplay behavior

### Requirement: Minimal server and client runtime boundary
The system SHALL retain a minimal local Node.js runtime boundary capable of hosting the app, foundation health and separately approved feature transports without moving authoritative game rules into browser clients.

#### Scenario: local server boots without internet
- Given the machine has no internet access
- When the app starts locally
- Then the server still boots from local files and runtime resources without cloud dependencies

#### Scenario: basic local communication is available
- Given a client connects to the local runtime
- When the server responds to startup or health checks
- Then it returns the existing minimal health contract, with approved game state exposed only through its separate feature boundary

### Requirement: Minimal shared contracts
The system SHALL keep foundation TypeScript contracts limited to startup, configuration and health while placing separately approved library/game contracts under their feature responsibilities.

#### Scenario: foundation contracts stay narrow
- Given the project needs to support bootstrapping and local configuration
- When the shared contracts are designed
- Then foundation contracts include only their minimum startup, configuration and health details and do not absorb feature-specific game state

#### Scenario: future features defer detailed contracts
- Given a future gameplay or library feature requires richer contracts
- When that requirement is proposed
- Then its detailed contracts belong to the relevant approved feature specification and preserve the foundation health contract
