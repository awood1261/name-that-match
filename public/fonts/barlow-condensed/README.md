# Barlow Condensed — locally bundled font assets

Source: [Google Fonts family](https://fonts.google.com/specimen/Barlow+Condensed), retrieved 2026-11-12. Copyright 2017 The Barlow Project Authors. Redistribution notice: [SIL Open Font License 1.1](OFL.txt). The font binaries are unmodified Google-served Latin WOFF2 files; no re-subsetting or renaming of the internal font family was performed.

Only four faces are bundled: 900 italic (major headings), 800 italic (card/strip labels), 900 upright (countdown) and 700 upright (support). Total font bytes: 91,404. The Latin unicode range is taken from the downloaded manifest; other scripts fall back to installed fonts. Additional weights/subsets are not needed for the approved English interface labels.

`provenance.json` records the acquisition manifest, individual upstream URLs, lengths and SHA-256 checksums. These URLs are build-time provenance only; application font declarations use local `/fonts/barlow-condensed/` URLs and `font-display: swap`. No npm package or external stylesheet is involved.

`client/src/styles/contestant-fonts.css` is now imported by contestant presentation after illustration approval. Only the three approved visual scenes use the new typography tokens; it does not globally replace host/admin/result fonts. Two local-only fallback declarations approximate condensed advance widths when a WOFF2 is slow/missing; they add no font download. The font can be reviewed on the isolated design page under `design-comps/asset-review/contestant-display-visual-experience/`.
