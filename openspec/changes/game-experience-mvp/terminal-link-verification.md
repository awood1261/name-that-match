# Terminal contestant-link verification — 2026-11-12

The owner requested printing newly generated display links in the laptop terminal to support phone-host/laptop-viewer operation. GN-10 records the narrow exception to the previous full-link log exclusion. The existing registration handler prints one labeled URL after host/origin/epoch/body/phase validation and successful viewer registration/designation. The URL matches the host local link, uses its validated frontend Origin and carries only viewer credentials in the fragment. No new endpoint, dependency, storage change or gameplay change.

Executed verification:

- `npm test`: 49 test files, 723 tests passed. New HTTP cases cover localhost/LAN frontend origins, primary/secondary links, issued fragment credentials, host-token exclusion, forwarded-host rejection, and silence on rejected registrations, existing-display designation and current/origin observations.
- `npm run typecheck`, `npm run lint`, `npm run build`: passed.
- Strict OpenSpec change and whole-project validation passed (6 items, zero failures).
- `git diff --check` passed. No generated build/database files tracked; no operational data accessed. Changes uncommitted and unarchived.

Manual verification: restart the server; open the configured LAN application origin on the phone, claim host control, and select Create contestant display link for the session. On the laptop, find the labeled URL in the server terminal and Command-click it or copy it into the browser. The contestant route remains read-only; select Enter fullscreen there. A server restart requires a newly created link. LAN refresh/designating an existing viewer do not reprint a link. Physical phone/laptop verification of this addition has not been performed by the agent.
