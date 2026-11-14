## 1. Planning and layout approval

Owner approved the reviewed layouts and application implementation on 2026-11-13 ("I approve"). Preserve the completed gameplay tasks and remaining contestant visual/device acceptance gates.

Layout review delivered: [interactive wireframes](../../../design-comps/host-controls-review/review.html) and [review notes/evidence](../../../design-comps/host-controls-review/README.md). Eight sample states include the five required views and desktop fallback. Owner layout approval is recorded above; these isolated preview checks do not satisfy application or physical-device acceptance.

- [x] 1.1 Present portrait wireframes for between-rounds, Ready, Guessing, expiry and disconnected/pending recovery, including support sections and desktop fallback; verify each against MH-01–06 and record owner layout approval before implementation.
- [x] 1.2 Record explicit approval to apply this change and its agreed scope; reconcile requested layout revisions across proposal/design/specs/tasks and pass strict change validation before editing application code.

## 2. Console hierarchy and supporting operations

- [x] 2.1 Reorganize HostPage around one phase console and one mounted useGameHost; verify setup/start, immutable round owner, tier persistence, all phases and no duplicate controls/subscriptions in client tests (MH-01/02/06; D1–2).
- [x] 2.2 Add compact projected score totals and visible concise private answer with expandable optional/filming details; test long/missing metadata, private totals before reveal and unchanged public projection/round ownership (MH-01/02; D1–2).
- [x] 2.3 Move display/LAN/QR controls into a named expandable Display connection section without conditional unmounting; test collapse/reopen during and after link creation, retained URL/QR, designation gates and explicit launch behavior (MH-04; D1/D3).
- [x] 2.4 Add Score details and Game options after the console, with exceptional round options separate from routine judgments; verify full ledger access, Skip/Void reason, End/New confirmations, release and session identity remain available under the existing permissions (MH-04; D2).
- [x] 2.5 Make between-round contestant/tier controls compact and phase-specific; test explicit switching, all three labels/points, screenshot versus match counts, freshness/empty-tier explanations and Prepare/Cancel without automatic selection or exposure (MH-01/02; D2).

## 3. Recovery and phone interaction

- [x] 3.1 Add the presentation-only recovery block beside actions using existing hook callbacks/state; test simultaneous host-loss/pending/primary-readiness blockers, candidate revalidation, busy state, explicit reconnect/check/reviewed retry/dismiss and no automatic command replay (MH-03; D3).
- [x] 3.2 Style the single action group in its colocated CSS Module with touch spacing, safe-area-aware sticky placement and normal-flow short-screen/enlarged-content fallback; verify no duplicate focusable action and record actual layout measurements at the D5 viewport sizes (MH-05; D4).
- [x] 3.3 Add Play-scoped compact phone header/navigation in App and its CSS Module; test navigation access, Stay / Pause-and-leave, acknowledged pause, return paused, and unchanged library/System presentation and host mounting (MH-06; D4).
- [x] 3.4 Implement meaningful focus restoration when a focused phase action disappears, accessible disclosure/error associations and quiet timer announcements; test keyboard/held-key transitions, reduced motion, native confirmations and no focus stealing on heartbeat updates (MH-03/05; D4).

## 4. Integrated verification and review

- [x] 4.1 Run the full unit/integration suite (`npm test`), `npm run typecheck`, `npm run lint` and `npm run build`; record exact results and resolve regressions in host, receipts, navigation, sockets, contestant and library behavior before marking complete.
- [x] 4.2 Run production-browser acceptance with disposable fixtures at 320 × 568, 390 × 844, 430 × 932, 844 × 390 and 1280 × 800, plus 200 percent text/zoom and long content; record controls in the initial 390 × 844 viewport, target sizes, overflow, sticky/focus fallback, setup-to-final workflow and support access. Do not claim physical-device acceptance from this run (MH-01–06; D5).
- [ ] 4.3 Manually verify a real portrait phone host with laptop primary over the configured local network: setup/join, select/prepare/reveal, Correct/Incorrect/late credit/timeout, Pause/Resume, Reveal Result/Advance, contestant switch, End/New, QR/support panels, browser keyboard/safe areas and lost-connection/pending receipt recovery. Record device/browser and actual outcomes; leave this task open if any required physical check is unperformed (MH-01–06; D5).
- [x] 4.4 Update `docs/game-host.md` for the reviewed console, disclosures and adjacent recovery; verify operational steps match implemented names and retain LAN-origin, explicit command/receipt, timing and fullscreen guidance. Record outstanding checks without rewriting historical verification or other changes' deferred acceptance.
- [x] 4.5 Run `npx openspec validate mobile-host-experience --type change --strict`, `npx openspec validate --all --strict` and `git diff --check`; audit Git tracking for generated artifacts/local databases/captures, summarize actual evidence and deviations, and stop for owner review without automatic archive, commit or push.

Tasks 2.1–2.5, 3.1, 3.3 and 3.4: focused host/component regressions passed; see implementation-verification.md for final counts; integrated browser and physical acceptance are tracked separately below.

Implementation evidence: [implementation-verification.md](implementation-verification.md). Final checks: 756 tests / 49 files passed; typecheck/lint/build passed; 55 production-browser layout observations and integrated workflows passed; strict change and whole-project validation passed. Task 4.3 remains open because no physical phone/device acceptance was performed. No archive, commit or push.
