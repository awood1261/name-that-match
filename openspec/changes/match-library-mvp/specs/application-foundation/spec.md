## MODIFIED Requirements

### Requirement: Minimal local-first application shell
The system SHALL provide a single-repository React + Vite + TypeScript application shell whose foundation remains minimal and which can expose separately approved feature capabilities without implementing unspecified gameplay.

#### Scenario: foundational shell loads in development mode
- Given the app is started in development mode
- When the runtime boots the foundation
- Then the user sees a minimal shell and local bootstrap only, with the existing foundation status available and only separately approved feature workflows exposed

#### Scenario: scope remains intentionally limited
- Given the project review checks feature scope
- When the shell is inspected
- Then the foundation stays limited to layout, branding, status, and runtime structure while approved library behavior is governed by its own capability specifications and gameplay remains excluded

### Requirement: Local persistence and backup strategy
The system SHALL define a local persistence scheme using SQLite for metadata initialization and approved feature migrations, and the filesystem for image assets, with explicit backup and portability guidance.

#### Scenario: SQLite initializes locally
- Given the application starts for the first time
- When the persistence layer initializes
- Then it creates or validates a local SQLite store and applies only approved capability migrations without speculative gameplay tables or destructive recreation

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
