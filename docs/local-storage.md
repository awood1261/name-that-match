# Local storage conventions

The app stores local runtime data outside the repository source tree and build output. The default location is:

- `./data`

The runtime resolves the data root in this order:

1. `NAME_THAT_MATCH_DATA_DIR`
2. `./data`

This keeps the storage directory predictable for both development and production startup while leaving the repository clean.

## Structure

```text
data/
  library.sqlite
  screenshots/
  staging/
```

- `library.sqlite`: SQLite metadata, including match, screenshot, durable import and game session/history/score/receipt tables.
- `screenshots/`: committed local screenshot assets with generated relative filenames.
- `staging/`: owned incomplete uploads/imports and retained recovery evidence.

Match Library Milestones 1–4 add transactional schema migration, a durable import engine, import endpoints/dialog, match management and screenshot assignment. See [import engine limits, recovery and staging maintenance](import-engine.md) and [match management](match-management.md). The approved classification continuation upgrades schema 1 to 2 transactionally; see [classification migration](classification.md#migration). Game Experience Milestone 1 adds schema 3 game tables without rewriting schema-2 library classifications or metadata; see [game foundation and recovery](game-foundation.md). No image files are moved or rewritten. Back up the complete stopped dataset before starting the upgraded app.

## Development and production behavior

- Development mode uses the configured data directory for the local app server.
- Production mode also resolves the same data root so restarts do not wipe existing storage.
- The SQLite database file is retained across restarts unless the directory is intentionally replaced.
- The screenshot directory is preserved as long as the configured data root remains unchanged.

## Networking and security notes

The default host is `127.0.0.1`, which keeps the app local-only by default. To expose it to a Wi‑Fi network intentionally, set:

```bash
NAME_THAT_MATCH_HOST=0.0.0.0 npm run prod
```

This should only be used in a trusted local network. Exposing the local server to a Wi‑Fi network increases the attack surface and should not be treated as a remote management endpoint.

## Backup and restore

The database uses SQLite WAL mode. Committed data can still reside in `library.sqlite-wal` rather than the main file. Copying a live `library.sqlite` alone can lose data or produce an inconsistent backup. Database transactions also do not make screenshot-file copies atomic.

This manual procedure requires downtime; there is no automated or live backup utility.

1. Identify the actual configured data root. Stop all app instances, development watchers that might restart the server, external SQLite tools, and any screenshot writers. Confirm that all database connections are closed and no process can change the dataset until copying and verification finish. If you cannot establish that condition, do not use a raw filesystem copy.
2. Copy the **entire unchanged data root** to a new destination outside the source root, preserving relative paths and filenames. Include `library.sqlite`, `screenshots/`, and any remaining `library.sqlite-wal`, `library.sqlite-shm`, or journal files. A clean last connection close normally checkpoints WAL, but never manually delete remaining sidecars or separate them from their matching database.
3. Treat an interrupted copy as incomplete. Keep the original and the previous known-good backup. Compare the file inventory and file checksums between the still-unchanged source and destination before marking the backup complete. Keep writers stopped until verification finishes.
4. To restore, keep writers stopped and copy the complete backup to a **separate, empty, writable data root**. Do not overwrite an active dataset or merge with stale destination sidecars. Keep the original and backup unchanged. Open the restored database with a SQLite tool so it can recover preserved WAL content, and run `PRAGMA integrity_check;`; the expected result is `ok`. Check screenshot inventory/checksums against the backup and confirm relative paths still resolve.
5. Start the application using `NAME_THAT_MATCH_DATA_DIR` pointed at the restored root. Verify startup and the expected local dataset before adopting it. Verification can create sidecars in the restored root; do not run it against the backup itself. If verification fails, retain the original and investigate rather than replacing it with the failed restore.

SQLite integrity checks do not prove screenshot completeness. Future live backups require a SQLite-supported snapshot method plus coordination of asset writes, separately specified and approved.

Technical references: [SQLite backup safety](https://sqlite.org/howtocorrupt.html#backup_or_restore_while_a_transaction_is_active) and [SQLite WAL files](https://sqlite.org/wal.html#the_wal_file).

## Notes

- The application data directory must remain writable by the current user.
- Relative screenshot paths should resolve from the configured data root, not from Vite's public directory.
- Existing Chrome extension captures remain untouched because their source directories are outside the app's managed data root.
- `data/` is excluded from Git via the repository ignore rules.
