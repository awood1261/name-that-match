# Checkpoint 5.3a — Offline QR and LAN contestant joining

## Scope and authorization

The owner approved implementation of the QR/LAN proposal, then explicitly approved `qrcode` **1.5.4** as a runtime dependency and `@types/qrcode` **1.5.6** / `jsqr` **1.4.0** as development dependencies. Versions are pinned in package.json/lockfile. The earlier planning changes were already present in the working tree and are preserved. Only tasks 5.3a.1–5.3a.4 are completed here; no End/New Game, Studio launcher, WebSocket, gameplay-rule or schema change was added. No change is archived.

## Behavior and files

- `server/src/game/join.ts`: validated exact UI/manual origins, bounded fixed-argument `/usr/sbin/ipconfig getifaddr en0` adapter, explicit refresh and configuration observations. Uses a 1.5-second timeout, 1-KiB output limit, SIGKILL and AbortSignal. No shell interpolation, startup dependency, polling lookup or image/countdown work. Unsupported platforms/missing/invalid/nonzero/timed-out output retain manual/local fallback.
- `server/src/game/http.ts`: host-only POST `/api/game/display-origin`, existing epoch/origin/header/controller checks, matching browser/UI origin, bounded request body, one in-flight lookup and cancellation on disconnect/stop. Observation does not register viewers, designate a primary or issue game commands. Foreign/forwarded origins cannot expand permissions.
- `server/src/index.ts`: passes existing production/bind configuration to join observations, retaining default loopback behavior and startup/shutdown contracts.
- `shared/src/game/join.ts`, `client/src/game/api.ts`: narrow JSON-safe request/result contracts and client observation call.
- `client/src/game/ContestantJoin.tsx` / `.module.css`, `qr.ts`, and `HostDisplayPanel.tsx`: host-only offline SVG QR beside the exact matching copyable URL; preserves session path and display/token/epoch fragment. Retains the actual UI protocol/port, exposes refresh/manual controls, clears stale QR output, cancels/ignores obsolete work, preserves viewer/primary identity on refresh and shows clear local-only/configuration or QR-generation fallback.
- `tests/game/join.test.ts`, `join-http.test.ts`, `tests/client/contestant-join.test.tsx`, `qr.test.ts`: 49 added tests.
- README and `docs/game-host.md`: deliberate LAN bind/exact-origin startup commands for production/development, refresh/manual/failure instructions and honest device limits. Active design authorization, task tracking and this evidence record are updated; archived history and previous task evidence remain intact.

LAN discovery never rewrites configuration or automatically adds origins. Production QR readiness requires an allowed origin and configured LAN listener; development preserves the Vite frontend port and existing proxy. Successful configuration does not claim firewall/Wi-Fi reachability. QR output stays local, carries only a viewer capability, and does not appear on the contestant stage. Server restart still requires a fresh viewer link. No original capture or operational data is changed.

## Automated verification actually executed

- `npm test`: **619 tests passed across 40 files**, including existing game, import, library, persistence, startup and production static-serving regressions.
- `npm run typecheck`: passed.
- `npm run lint`: passed with zero warnings.
- `npm run build`: passed for both client and server; Vite generated the local bundled encoder successfully.
- `openspec validate game-experience-mvp --strict`: passed.
- `openspec validate --all --strict`: **5 items passed, 0 failed**.
- `git diff --check`: passed. Git tracking checks found no generated dist/build/runtime data or SQLite database/WAL/SHM files tracked.

Coverage includes command options/output/error/platform/cancellation guards, origin input bounds, scheme/port preservation, current LAN retention and explicit refreshed IP, manual alternate origin/port, production bindings, exact allowlist rejection without mutation, no implicit replacement of unrelated hostnames, host-role/epoch/header/browser-origin checks, no session/viewer effects, shutdown/disconnect cleanup, refresh races, QR failure/local copy fallback and accessibility. Independent `jsqr` decoding of rasterized generated SVG verifies the exact full displayed URL rather than only QR element presence. A built-browser canvas decode separately verifies actual rendered SVG pixels.

Initial test setup needed a corrected Node child_process mock covering default/named interop; lint identified an effect cleanup/dependency issue, corrected using stable callbacks and cancellable scheduled observation (also avoiding duplicate StrictMode discovery). Final runs passed. Test decode helpers do not implement production QR encoding. No readiness bypass or production test hook was introduced.

## Browser evidence

Headless Chrome exercised both built Node-served production (deliberate all-interface binding) and an actual Vite frontend with its HTTP proxy to a loopback Node server. Both used allocated ports, disposable library/SQLite/browser profiles and the real en0 detector. Each verified:

1. Host opens on loopback, generated device URL uses detected LAN IP and the correct UI port, and a QR rendered by the browser decodes through `jsqr` to the exact same full URL.
2. Opening that decoded URL joins the existing read-only display over the LAN address, removes the join fragment from the address bar and exposes no host controls.
3. Refresh leaves the same viewer capability, primary registration and game revision intact; an unconfigured manual origin suppresses the QR and restores the labeled local-only copy link; a configured manual origin restores the same device QR.
4. The joined primary completes real decode/readiness, Reveal & start, Correct and Reveal Result through existing controls, with exactly one score award.
5. QR stays square and the host page avoids horizontal overflow at 1366×768, 768×1024 and 375×812. The 1440×1000 host screenshot was visually inspected; the administrative page scrolls normally.
6. Application HTTP requests remain on local frontend/LAN origins; no external QR service is contacted. Temporary resources are cleaned.

Evidence outside source control: `/private/tmp/ntm-qr-browser.log`, `/private/tmp/ntm-qr-dev-browser.log`, `/private/tmp/ntm-qr-host.png`, `/private/tmp/ntm-qr-dev-host.png`, `/private/tmp/ntm-qr-all.log`. Harness-only failures were corrected by waiting for saved judgment before Reveal Result and resolving Vite imports relative to the repository. The temporary development harness emitted Vite's CJS API deprecation warning; normal build/lint passed and no app API migration was made.

No physical camera/phone/tablet scan, physical external-internet disconnection, viewing-distance or final Studio/Road acceptance is claimed. Local rendered QR decoding/opening is recorded separately from those deferred hardware checks.

## Dependency audit and limitations

`npm audit --json` reports **13 findings** (10 moderate, 1 high, 2 critical) in existing development-tooling packages. Their package versions are unchanged from the baseline lockfile; the audit lists none of the new QR packages. The existing Vite/Vitest/tooling advisories remain unresolved and were not auto-upgraded in this focused change. Review `/private/tmp/ntm-qr-audit.json` separately before planning a dependency-hardening task.

Address detection is intentionally macOS/en0-specific, with explicit manual origin support elsewhere. Changing IP may require updating exact startup origins/restarting; no redirect or automatic permission/binding change is made. HTTPS origins do not provision TLS. QR/helper dependencies are installed, so subsequent gameplay needs no internet; installation/build are separate setup operations.

## Owner manual verification

Follow `docs/game-host.md#qr-code-and-lan-joining` for exact production/development commands. Verify en0 returns an address, configure the appropriate UI origin/binding, and restart. In Play create a contestant link before preparing; its QR/device URL should appear. Scan on a device on the same local Wi-Fi and confirm the read-only waiting screen. Refresh the host address and confirm no extra display registration; check manual configured/unconfigured origins and local fallback. Prepare and confirm primary readiness, reveal/judge/reveal as usual. Restart needs a fresh viewer link. Do not delete operational data to simulate a new game.

All four checkpoint tasks are complete: **29/46 total**, 17 remaining. Changes remain uncommitted for review. Stop before task 5.4; do not archive the incomplete game change.
