# Foundation review and current guidance

The archived `2026-11-06-application-foundation` records describe the original planning and completion claims. They remain unchanged. Current behavior is defined by the current capability specification and approved subsequent changes.

## Reconciled guidance

- The implemented default data root is `./data`, resolved from the working directory, with `NAME_THAT_MATCH_DATA_DIR` as the environment override. The archived design's suggested `./data/local` was not adopted; no migration is needed. Programmatic storage options can also supply an explicit directory.
- The archived proposal requested detailed game, match, screenshot, and WebSocket contracts. Its design/tasks and the current capability intentionally defer these contracts; only a health contract exists today.
- The archived design's image descriptions include misidentifications and omit the administrative library reference. The inventory below supersedes those descriptions for current work, without changing historical records.
- Archived checked tasks claim explicit offline and production-startup coverage. Original tests used local HTTP requests and fixture HTML; they did not simulate internet disconnection or launch the compiled executable. These claims must not be taken as proof of browser or disconnected-network testing.
- Six generated JavaScript/source-map files were first tracked in commit `bc18ea5`. The compiler emits them under `build/`, which was missing from ignore rules. Source control now excludes them; run `npm run build` before `npm run prod`. Local output is retained when removing index entries. Runtime datasets must never be committed.

## Visual reference inventory

| File in `design-comps/` | Actual reference |
|---|---|
| `00CE997D-1254-403F-A4DB-7604960EFC0C.PNG` | Shuffling and challenge-selection progress |
| `122CF989-63D3-4943-9D0E-CA6C78ACA68F.PNG` | Incorrect answer and correct-answer reveal |
| `575F3CFE-1CE3-4B4A-A16A-6019994EBF0C.PNG` | Challenge screenshot, 10-second timer, centered 1080 × 960 reel-safe guidance |
| `5D88B9D9-C4CF-4DC2-9E45-83B1E9FE6000.PNG` | Correct answer and match details |
| `989C475C-D7F3-4085-A2AA-5F04BF4C8974.PNG` | Screenshot difficulty selection and 1/2/3-point scoring |
| `9BD6879B-FE7A-44E5-A0EF-17B21F59F03A.PNG` | Scoreboard and scoring legend |
| `CA849EE2-D22F-4608-9D00-31E5B7C452B7.PNG` | Random-match placeholder and shuffle action |
| `Neon Wrestling Match Library.png` | Administrative import, filters, match metadata, screenshot difficulty, review and approval |

The first seven illustrate contestant/game presentation: strong branding, large timers, prominent feedback, and filming composition. The library reference emphasizes efficient administration and readable editing controls. Comps are visual references, not approved workflows. Example counts, fields, ranking order, and actions do not establish game rules or feature scope. Difficulty belongs to screenshots; match obscurity remains separate.

## Verification boundaries

Foundation hardening adds bounded startup-failure checks, normal startup/shutdown checks, isolated SQLite tests, explicit cleanup checks, and health/HTML/JavaScript regression coverage. Tests use owned temporary data roots and loopback ports assigned by the OS. Executable failure tests launch the TypeScript entry point through the existing `tsx` dependency. The production static test still uses fixture files; a separate compiled-production smoke check is required after building.

Run the npm and OpenSpec checks in README. Record actual outcomes for each implementation; passing local tests alone is not manual browser or disconnected-network verification. There are no Match Library, gameplay, or WebSocket features yet.
