# application-foundation Specification

## Purpose

Defines the minimal offline-first application shell, local server boundary, portable SQLite and screenshot storage, and verification conventions used before feature-specific library and gameplay changes.

## Requirements

### Requirement: Minimal local-first application shell
The system SHALL provide a single-repository React + Vite + TypeScript application shell that remains intentionally minimal and does not implement gameplay or Match Library features.

#### Scenario: foundational shell loads in development mode
- Given the app is started in development mode
- When the runtime boots the foundation
- Then the user sees a minimal shell and local bootstrap only, without gameplay screens or Match Library workflows

#### Scenario: scope remains intentionally limited
- Given the project review checks feature scope
- When the shell is inspected
- Then it remains limited to layout, branding, and baseline runtime structure instead of gameplay logic

### Requirement: Minimal server and client runtime boundary
The system SHALL include a minimal Node.js server capable of hosting the local app and providing a stable local bootstrap boundary without implementing gameplay behavior.

#### Scenario: local server boots without internet
- Given the machine has no internet access
- When the app starts locally
- Then the server still boots from local files and runtime resources without cloud dependencies

#### Scenario: basic local communication is available
- Given a client connects to the local runtime
- When the server responds to startup or health checks
- Then it returns minimal status information without game-specific data

### Requirement: Minimal shared contracts
The system SHALL define only the small set of shared TypeScript contracts required to support client/server bootstrapping and local data configuration.

#### Scenario: foundation contracts stay narrow
- Given the project needs to support bootstrapping and local configuration
- When the shared contracts are designed
- Then they include only the minimum startup, configuration, and health details needed by the foundation

#### Scenario: future features defer detailed contracts
- Given a future gameplay or library feature requires richer contracts
- When that requirement is proposed
- Then the contract should be added in the relevant future specification instead of expanded in this foundation change

### Requirement: Local persistence and backup strategy
The system SHALL define a local persistence scheme using SQLite for metadata initialization and the filesystem for image assets, with explicit backup and portability guidance.

#### Scenario: SQLite initializes locally
- Given the application starts for the first time
- When the persistence layer initializes
- Then it creates or validates a local SQLite store without creating premature Match Library tables

#### Scenario: backup and restore remain portable
- Given a local data directory exists
- When a backup is created or restored
- Then the project can recover the local runtime data without rebuilding the source tree or app code

#### Scenario: consistent stopped-writer backup and restore
- **WHEN** an operator follows the documented backup procedure for a WAL-mode dataset
- **THEN** all application and external writers are stopped and all database connections are closed before copying begins
- **AND** the complete data root, including screenshots and any remaining SQLite sidecars, is preserved together while it remains unchanged
- **AND** restoration uses a separate data root and verifies database integrity and screenshot completeness before use
- **AND** the guidance prohibits treating a live main-database-file copy as a complete backup or manually deleting WAL files

### Requirement: Configurable local data directory
The system SHALL use a predictable, configurable local data directory for both development and production startup.

#### Scenario: default data directory is used
- Given no override is provided
- When the app resolves local storage
- Then it uses the default project-local runtime data directory

#### Scenario: override data directory is honored
- Given a data directory override is configured
- When the app starts
- Then it uses the override rather than a hard-coded runtime path

### Requirement: Styling and shell presentation
The system SHALL define a consistent design system using CSS Modules, standard CSS, and CSS custom properties informed by the approved design references.

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
The system SHALL define automated quality gates for TypeScript, unit tests, component tests, and integration checks relevant to the application foundation.

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

#### Scenario: tests isolate local resources
- **WHEN** foundation server and storage tests run, including setup or assertion failures
- **THEN** database creation and filesystem writes occur only within uniquely owned temporary roots, not the default or operator-configured data directory
- **AND** servers use OS-assigned ports on loopback and discover their actual bound address
- **AND** all owned servers and SQLite connections are closed before temporary roots are removed, even after partial setup failure
- **AND** changed environment values and mocks are restored to their previous state

#### Scenario: lifecycle regression coverage
- **WHEN** automated foundation verification runs
- **THEN** it covers successful startup and shutdown, listen-error rejection, synchronous startup errors, resource cleanup, and isolated SQLite initialization
- **AND** it preserves valid responses at both health endpoints and production HTML and JavaScript serving from the same origin
- **AND** failure assertions are bounded so a pending start cannot hang verification indefinitely

### Requirement: Development and production startup
The system SHALL define local development and production startup flows suitable for a private, offline-first game app.

#### Scenario: development startup uses local data directory
- Given the project is started in development mode
- When the runtime config is resolved
- Then it uses the local data directory consistently and predictably

#### Scenario: production startup remains stable
- Given the production path is used for filming or local presentation
- When the app starts
- Then it uses the same local-first configuration rules without cloud dependency

#### Scenario: startup rejects a listen failure
- **WHEN** a configured local address cannot be bound, including an address already in use
- **THEN** the startup operation rejects with the underlying error rather than remaining pending
- **AND** resources allocated by the failed attempt are released without disturbing another server

#### Scenario: executable reports a failed start
- **WHEN** executable startup fails during storage initialization or listening
- **THEN** it reports the failure, exits unsuccessfully, and does not wait indefinitely or leave an unhandled rejected promise

#### Scenario: successful startup and normal closure
- **WHEN** startup succeeds and the caller later closes the server
- **THEN** startup resolves only after listening and normal closure releases its SQLite connection and listening socket
- **AND** default host, port, storage configuration, and existing HTTP behavior remain unchanged


### Requirement: Generated output and local data stay outside source control
The repository SHALL exclude generated build output and runtime SQLite files from source control while preserving source files and local user data.

#### Scenario: generated output is removed from tracking
- **WHEN** previously tracked compiler output is removed from version control
- **THEN** only generated entries are removed from the index, their working files remain available, and builds remain reproducible from source
- **AND** no application data is removed or modified

#### Scenario: builds and databases remain untracked
- **WHEN** the production build and foundation tests have completed
- **THEN** no generated build output or local SQLite database, WAL, shared-memory, or rollback-journal files are tracked
- **AND** ignore rules cover generated output and runtime databases, including databases beneath an in-repository data override

### Requirement: Current foundation documentation is accurate
Current foundation documentation and specifications SHALL describe the implemented foundation accurately, distinguish current guidance from archived history, and provide executable validation instructions.

#### Scenario: capability documentation validates strictly
- **WHEN** current foundation specification maintenance is completed
- **THEN** its Purpose describes the foundation without placeholder text and its normative requirements validate without warnings under strict validation

#### Scenario: current documentation reconciles archived guidance
- **WHEN** a maintainer reads current setup and design-reference documentation
- **THEN** it identifies the actual default data root and all eight design comps accurately, distinguishing administrative and contestant references
- **AND** it explains the differences from archived directory recommendations, broad contract proposals, and verification claims without rewriting archived files
- **AND** validation instructions distinguish the archived capability specification from an active change
