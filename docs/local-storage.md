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

## Notes

- The application data directory must remain writable by the current user.
- Relative screenshot paths should resolve from the configured data root, not from Vite's public directory.
- Existing Chrome extension captures remain untouched because their source directories are outside the app's managed data root.
- `data/` is excluded from Git via the repository ignore rules.
