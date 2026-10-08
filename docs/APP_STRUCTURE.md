# App structure

The builder is a static site: no bundler and no build step to run the app. Open
`index.html` over any static server. GitHub Pages serves `main` as-is.

## What lives where

| Path | Role |
| --- | --- |
| `index.html` | Markup only (~640 lines): header, sidebar panels grouped by step, preview, modals. No inline scripts. |
| `styles/app.css` | The one stylesheet. Layers run base -> polish overrides -> utilities; later rules win. |
| `js/*.js` | The application script, split along the section banners it always had. |
| `data/*.js` | Calibration corrections and the CAP unit list, loaded before the app scripts. |
| `purchase-feature*.js`, `calibration-submission.js`, `patch-submission.js`, `admin-history.js`, `ocp-patch-variants.js` | Feature scripts loaded after the app. |
| `google-apps-script/Code.gs` | Backend for submissions and admin history (deployed separately). |
| `scripts/` | Import/audit/build tooling (Node and Python). Not part of the page. |
| `tests/` | `npm test` (Node's built-in runner). |

## Load order (it matters)

All `js/` files are classic scripts that share one global scope, exactly as the
old single inline script did. They must stay in this order:

1. `js/state.js` - global state, rank data, placement constants
2. `js/calibration.js` - default and master calibration data
3. `js/dom-assets.js` - DOM shortcuts, asset path helpers
4. `js/catalog.js` - uniforms, ribbons, devices, badges, patches
5. `js/setup.js` - selects, sidebar toggle, setup flow, authorization
6. `js/render-core.js` - jacket and ribbon/medal rendering
7. `js/galleries.js` - ribbon, badge and patch galleries
8. `js/placement.js` - badge/patch placement and the render pipeline
9. `js/wiring.js` - event wiring, calibrator UI, modal gallery, PNG export
10. `js/workspace-ui.js` - step guide, preview toolbar/zoom, empty state, command bar
11. `js/member-report-import.js` - CAP member report parser and importer
12. `js/bootstrap.js` - first render
13. `js/patches.js` - dated patches that deliberately re-wrap earlier functions

`js/patches.js` wraps functions defined earlier (for example `parseCapMemberReport`
is wrapped four times). Do not reorder it, and do not move code out of the
earlier files into it without checking what it wraps.

## Cache-busting

Every local `<script src>` and the stylesheet carry `?v=<content hash>`. After
editing any of them run:

```bash
npm run stamp:assets
```

`npm test` fails (`tests/asset-stamps.test.cjs`) if a stamp is stale, so a changed
file cannot ship under an old URL.

## Images

Artwork is WebP, sized to how large it is actually drawn. Source PNGs are not
kept. `scripts/optimize-images.py` re-encodes new artwork (`--dry-run`, `--apply`,
`--rewrite-code`; needs Pillow). Path literals in code may name `.png`; the
loader probes `.webp` first and falls back, but a literal that names a file which
no longer exists costs a 404 per image, so rewrite it to `.webp`.

## Tests that read source

Several tests assert on source text. They read the page plus every `js/` file
through `tests/helpers/app-source.cjs`, so moving code between files does not
break them.

## Ribbon rack regression harness

`scripts/visual-harness.html` drives the real builder in an iframe and records a
structural manifest of every ribbon family and award level (which image, where,
how large, in what order). `scripts/baseline.tsv` is the manifest from
2026-08-23 and **predates later layout changes on `main`**,
so `compareToBaseline()` reports every row as different. Use it as a before/after
check on the same origin instead:

1. Serve two checkouts (the commit before your change and your change) under one
   static server, e.g. `/old/` and `/new/`.
2. Open `/old/scripts/visual-harness.html`, run `runHarness()`, `toRows()` it and
   keep the rows in `localStorage`.
3. Open `/new/scripts/visual-harness.html`, do the same, and diff the two maps.

On 2026-10-08 this compared 5,408 entries before and after the stylesheet,
script-splitting and UI work: 0 changed, 0 added or removed, 0 broken assets.
The default structural pass needs no visible pane; the optional pixel pass does.
