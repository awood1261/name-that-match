# Phase A — proposed illustration and typography review

**Draft artwork, not approved or integrated into application screens.** This folder is a design review artifact; the production build does not publish the HTML/SVG review page. The separate approved fonts under `public/fonts/` are copied by Vite for future screen integration.

- `squash-match.svg`: victorious flexing wrestler with one foot over a prone opponent; white silhouette and green emphasis lines.
- `competitive-match.svg`: two wrestlers in a collar-and-elbow tie-up; mirrored braced bodies and interlocking arms.
- `deathmatch.svg`: white skull with eye/nose/teeth cutouts, encircled by double-strand barbed wire.

These are newly authored vector interpretations of the three illustrations in `../../screen-updates/B2BED88D-F924-4518-8914-21058B532602.png`. They preserve the subject/pose and clean silhouette language rather than claiming pixel-identical traces. Simplified anatomy, facial features, wire details and green rays are visible differences for owner review. They contain no external assets/scripts, libraries, embedded fonts, emoji or match photography. Each uses a 400×300 viewBox and an accessible title; the grappling pair uses only a local fragment reference.

Review [artwork in card context](artwork-preview.png), [typography comparison](typography-preview.png) or individual SVGs. The card context is an isolated static review mockup, not the responsive application implementation. Exact layout/tokens/components follow only after artwork approval. The original comp remains the primary screen reference.

When the existing Vite dev server is running, open `/design-comps/asset-review/contestant-display-visual-experience/review.html` on that origin for a live, local review page. It has no game session, server game API, countdown or socket connection and does not acquire host control. The saved PNG previews can be reviewed without running a server.

The comparison shows Barlow Condensed 900 italic, 800 italic, 900 upright and 700 upright against the previous Arial Black/Segoe UI stack. It is visibly narrower and closer to the reference heading/label treatment. Font binaries/license/provenance and unimported reusable declarations are prepared separately. External-request blocking verified all four local faces loaded in desktop Chrome; actual physical internet disconnection and Android/TV acceptance remain unperformed.

The owner must approve or request revisions to the three illustrations before integration. Approval of the overall proposal or font family is not illustration acceptance.

## Subsequent approval

The owner approved the three illustrations conditional on each being an independent SVG image element within its card component, with headings/point values separate. Approved runtime copies now live in `public/images/contestant/`; this folder remains the original Phase A review record. Application integration and verification are tracked separately in the active visual change.
