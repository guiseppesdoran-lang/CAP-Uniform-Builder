# Project history

A digest of the 1,287 commits on `main` as of 2026-10-07 (all by one author,
Guiseppe Doran), so a new contributor can see how the builder got here. Commit
counts per month: 2025-07 226, 2025-08 26, 2025-10 199, 2025-11 10, 2025-12 79,
2026-01 43, 2026-03 9, 2026-04 4, 2026-05 307, 2026-06 8, 2026-07 12, 2026-08 350,
2026-09 10, 2026-10 4. About 455 are "Update index.html" and 162 are "Add files
via upload": edits and artwork made through the GitHub web UI, so raw commit
counts overstate how many separate changes were made.

## Phases

**Jul 2025 - the start.** Initial commit, then a large batch of uploaded uniform
artwork and `.gitkeep` placeholders.

**Oct-Dec 2025 - first app, as separate files.** `render.js`, `uniforms.js`,
`ribbons.ui.js` / `ribbons.data.js`, `badges.*`, `patches.*`, `rank.ui.js`,
`calibration.js`, `compat.shim.js`, `style.css`, plus a devtools panel and an
upload-patch tool. Deployed on Netlify (`netlify.toml`).

**Jan-Jul 2026 - collapse into one page.** The separate files were folded into a
single `index.html` (the long run of "Update index.html" commits). Class A/B and
OCP uniforms, ribbon racks, badges, patches and the calibrator all live there.

**Aug 2026 - the big push (350 commits, PRs #76-#149).**
- #76-#92 (`agent/group-historical-ribbons`): grouped historical ribbons,
  editable garment alpha masks, four-column racks only above an overlap threshold.
- #105-#114: Cadet Programs and National Staff insignia scaling, National Staff
  specialty precedence, calibration fixes, four-center rack fixes.
- #116-#121 (`codex/military-builder-foundation`): the multi-branch military
  builder, Coast Guard badge foundation.
- #122-#149 (`codex/military-catalog-expansion`): branch-aware ribbon selection,
  Air Force/Navy/Marine/Coast Guard medal and badge artwork, master calibration
  sessions, miniature medals, bulk award selection with connected minis.

**Sep-Oct 2026.** Utility badge picker with fabric previews, OCP cloth insignia
as patches, extrapolated badge-family calibrations. On 2026-10-07 the
`military-catalog-expansion` merge was **reverted**, so the military catalog work
is rolled back on `main` (the branch still exists on GitHub).

## Where things came from

Much of the later work was produced on `codex/...` and `agent/...` branches and
committed under the repository owner's name. The dated `CAPUB PATCH ...` blocks
that now live in `js/patches.js` are that history: each was added on top of the
previous one rather than editing it, which is why several functions are wrapped
more than once.

## Scope note

This branch is the CAP uniform builder only. The multi-service builder from the
Aug 2026 military work (PRs #116-#149), meaning the Army, Navy and other
organization picker with its own panels and preview, was removed. The U.S.
military ribbon and badge menus inside the CAP galleries stay, because CAP
members who earned those awards wear them on the CAP uniform. The source JSON,
import tooling and reports that the generated `military/military-data.js` was
built from are not in the working tree; they remain in `main`'s history.

## Since then (this branch)

Image re-encode to WebP (123 MB -> ~54 MB), runtime ribbon-device compositing,
lazy image loading, the inline script split into `js/` files, a stylesheet,
content-hash asset URLs, and a reworked first screen and sidebar. See
`docs/APP_STRUCTURE.md`.
