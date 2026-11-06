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
```

- `library.sqlite`: SQLite database file for local metadata initialization.
- `screenshots/`: directory for local screenshot assets and future imports.

The storage layer is intentionally scoped to foundation setup and does not create match or screenshot schema tables yet.

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

## Backup

Always back up the SQLite file and the screenshot folder together to preserve the full local dataset. A consistent backup routine is required before future metadata or import workflows are introduced.

## Notes

- The application data directory must remain writable by the current user.
- Relative screenshot paths should resolve from the configured data root, not from Vite's public directory.
- Existing Chrome extension captures remain untouched because their source directories are outside the app's managed data root.
- `data/` is excluded from Git via the repository ignore rules.
