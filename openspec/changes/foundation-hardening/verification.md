# Foundation hardening verification

Verified on November 6, 2026 with Node.js 20.19.6 and npm 10.8.2.

## Automated checks

| Check | Result |
|---|---|
| `npm test` | 21 tests passed across 8 files |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed with zero warnings |
| `npm run build` | Passed; client bundle and server compilation produced local output |
| `openspec validate foundation-hardening --type change --strict` | Passed |
| `openspec validate application-foundation --type spec --strict` | Passed without warnings |
| `openspec validate --all --strict` | 2 passed, 0 failed |
| `git diff --check` | Passed |

The sandbox initially prevented loopback binding (`EPERM`). Localhost checks were rerun with permission outside the sandbox. An initial lifecycle assertion counted Node's internal HTTP listener; it was corrected to check removal of the startup listener. Final results above include strengthened operator-data and both-session cleanup assertions.

Lifecycle tests cover held-port `EADDRINUSE`, synchronous listen exceptions, invalid storage, post-open pragma failure, allocated-port startup/logging, listener removal, normal close, unstarted-server cleanup, and controlled assertion-failure cleanup. Child-process tests confirm the executable reports occupied-port and invalid-storage failures, exits with code 1 within a deadline, and has no unhandled rejection. Tests use temporary roots, loopback OS-assigned ports, restored environment values, and closed SQLite handles. Existing health payloads and production HTML/JavaScript responses are verified.

## Backup rehearsal

A one-off script outside the repository created a disposable WAL-mode database with a committed row referencing a PNG fixture. After closing SQLite, it copied the complete data root to a backup and then to a separate restore root. File inventories/checksums matched, the restored row matched, `PRAGMA integrity_check` returned `ok`, and the restored screenshot matched its original bytes. The source and backup checksums remained unchanged. Only the owned temporary rehearsal tree was removed. No backup utility or feature table was added to the application.

## Compiled production smoke check

After building, a one-off script launched `node build/server/src/index.js --production` on a verified available loopback port with a temporary data-directory override. It fetched the built HTML, both emitted JS/CSS assets, `/health`, and `/api/health`; all returned 200 with expected content/status. SQLite appeared only in the temporary root. The child was stopped and the owned root cleaned up. No installed application dataset was used.

## Repository and scope audit

- All six generated JavaScript/map files were removed only from the Git index. All six remain on disk after rebuilding; TypeScript sources remain tracked.
- `git ls-files` contains no `build/`, `dist/`, `data/`, or SQLite main/WAL/SHM/journal files.
- `git check-ignore --no-index` confirmed build/default-data exclusions and all three database extensions with their sidecar patterns under an override directory.
- Archived OpenSpec files are unchanged. All 19 previous capability scenario names remain in the current capability. All eight comp filenames appear in the current inventory.
- No client code, styling, dependencies, Match Library, gameplay, or WebSocket implementation changed. The pre-existing untracked `AGENTS.md` was preserved.

## Limits and review

No specification deviations. Manual browser, actual TV/tablet, and physically disconnected-network testing were not performed. The backup procedure intentionally requires stopped writers; it does not provide live snapshots. This change remains active and unarchived.

For optional manual UI review, build and start production with a disposable data-directory override, open the local URL, and confirm the status shell connects and keyboard focus remains visible. Stop the process afterward and remove only the disposable directory. No UI change is expected.
