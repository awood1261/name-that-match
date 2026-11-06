# application-foundation Specification

## Purpose
TBD - created by archiving change application-foundation. Update Purpose after archive.

## Requirements

### Requirement: Minimal local-first application shell
The system shall provide a single-repository React + Vite + TypeScript application shell that remains intentionally minimal and does not implement gameplay or Match Library features.

#### Scenario: foundational shell loads in development mode
- Given the app is started in development mode
- When the runtime boots the foundation
- Then the user sees a minimal shell and local bootstrap only, without gameplay screens or Match Library workflows

#### Scenario: scope remains intentionally limited
- Given the project review checks feature scope
- When the shell is inspected
- Then it remains limited to layout, branding, and baseline runtime structure instead of gameplay logic

### Requirement: Minimal server and client runtime boundary
The system shall include a minimal Node.js server capable of hosting the local app and providing a stable local bootstrap boundary without implementing gameplay behavior.

#### Scenario: local server boots without internet
- Given the machine has no internet access
- When the app starts locally
- Then the server still boots from local files and runtime resources without cloud dependencies

#### Scenario: basic local communication is available
- Given a client connects to the local runtime
- When the server responds to startup or health checks
- Then it returns minimal status information without game-specific data

### Requirement: Minimal shared contracts
The system shall define only the small set of shared TypeScript contracts required to support client/server bootstrapping and local data configuration.

#### Scenario: foundation contracts stay narrow
- Given the project needs to support bootstrapping and local configuration
- When the shared contracts are designed
- Then they include only the minimum startup, configuration, and health details needed by the foundation

#### Scenario: future features defer detailed contracts
- Given a future gameplay or library feature requires richer contracts
- When that requirement is proposed
- Then the contract should be added in the relevant future specification instead of expanded in this foundation change

### Requirement: Local persistence and backup strategy
The system shall define a local persistence scheme using SQLite for metadata initialization and the filesystem for image assets, with explicit backup and portability guidance.

#### Scenario: SQLite initializes locally
- Given the application starts for the first time
- When the persistence layer initializes
- Then it creates or validates a local SQLite store without creating premature Match Library tables

#### Scenario: backup and restore remain portable
- Given a local data directory exists
- When a backup is created or restored
- Then the project can recover the local runtime data without rebuilding the source tree or app code

### Requirement: Configurable local data directory
The system shall use a predictable, configurable local data directory for both development and production startup.

#### Scenario: default data directory is used
- Given no override is provided
- When the app resolves local storage
- Then it uses the default project-local runtime data directory

#### Scenario: override data directory is honored
- Given a data directory override is configured
- When the app starts
- Then it uses the override rather than a hard-coded runtime path

### Requirement: Styling and shell presentation
The system shall define a consistent design system using CSS Modules, standard CSS, and CSS custom properties informed by the approved design references.

#### Scenario: shell reflects the approved design language
- Given the visual references in design-comps are reviewed
- When the shell is implemented
- Then it adopts the dark arena styling, neon accent palette, and shell structure suggested by those references

#### Scenario: accessibility and motion are supported
- Given a user navigates the shell with a keyboard or reduced motion preference
- When the interface is used
- Then focus states, semantic structure, and motion preferences remain accessible and usable

#### Scenario: no Tailwind is introduced
- Given the styling requirements are applied
- When implementation begins
- Then CSS Modules and standard CSS are used, and Tailwind or utility-first styling is not introduced

### Requirement: Testing, linting, and tooling
The system shall define automated quality gates for TypeScript, unit tests, component tests, and integration checks relevant to the application foundation.

#### Scenario: client and server communication is verified
- Given the local client and server exchange a startup or health payload
- When tests run
- Then the communication contract is validated without product gameplay logic

#### Scenario: database initialization is verified
- Given the SQLite layer is initialized
- When the test suite runs
- Then it verifies the local data directory and foundation database setup

#### Scenario: offline startup is verified
- Given internet access is unavailable
- When the app is started in the local environment
- Then startup still succeeds using local files and local runtime resources

#### Scenario: production startup is verified
- Given the production startup path is executed
- When the app resolves configuration and launch behavior
- Then it does so deterministically and without external runtime dependency

### Requirement: Development and production startup
The system shall define local development and production startup flows suitable for a private, offline-first game app.

#### Scenario: development startup uses local data directory
- Given the project is started in development mode
- When the runtime config is resolved
- Then it uses the local data directory consistently and predictably

#### Scenario: production startup remains stable
- Given the production path is used for filming or local presentation
- When the app starts
- Then it uses the same local-first configuration rules without cloud dependency
