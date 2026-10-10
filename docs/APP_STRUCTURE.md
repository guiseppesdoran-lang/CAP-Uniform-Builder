# App structure

The builder is a static site: no bundler and no server-side code. Open `index.html` over any
static server to run it from the repository. To publish it, `npm run build` produces `dist/`,
the only directory that should be web-served (see `deploy/README.md`).

## What lives where

| Path | Role |
| --- | --- |
| `index.html` | Markup only (~640 lines): header, sidebar panels grouped by step, preview, modals. No inline scripts. |
| `styles/app.css` | The one stylesheet. Layers run base -> polish overrides -> utilities; later rules win. |
| `js/*.js` | The application script, split along the section banners it always had. |
| `config.js` | Per-deployment settings, loaded first. Only `submissionEndpoint` (empty = submissions off). Never put secrets here. |
| `data/*.js` | Calibration corrections, the CAP unit list and `uniform-rules.js`, loaded before the app scripts. |
| `data/uniform-rules.js` | One table of what each uniform allows (who may wear it, ribbons required/optional/none, miniature medals, rack columns, badge limit, U.S. military awards), each rule with its CAPR 39-1 paragraph. The sidebar, the renderer and the validator read from it; `tests/uniform-rules.test.cjs` pins it to the regulation and to the buttons in `index.html`. |
| `military/*.js` | U.S. military award and badge catalog (`military-data.js`, generated, 189 awards and 127 badges), its rules (`military-core.js`) and device layout. CAP members who earned U.S. military awards can add them in the ribbon and badge galleries. There is no separate service builder. A ribbon award with no artwork is not offered (the Coast Guard Cross today; it appears on its own once `images.ribbon` exists for it). Military badges show on dress uniforms only, until there is artwork for field uniforms. |
| `images/military-*`, `images/devices/military/` | Artwork for those awards and badges. |
| `vendor/pdfjs/` | pdf.js 3.11.174 (Apache-2.0), loaded on first member-report PDF import. |
| `purchase-feature*.js`, `calibration-submission.js`, `patch-submission.js`, `ocp-patch-variants.js` | Feature scripts loaded after the app. The two submission scripts do nothing unless `config.js` sets an endpoint. |
| `google-apps-script/Code.gs` | Optional submission endpoint (patch images, calibration updates), deployed separately; see `PATCH_SUBMISSION_SETUP.md`. |
| `deploy/` | nginx and Caddy examples with the security headers, and a short deployment guide. |
| `scripts/` | Build, asset-stamping, image and test tooling (Node and Python). Not part of the page. |
| `tests/` | `npm test` (Node's built-in runner). |

## Developer mode

The calibrator (the CAL tab) is a development tool. It is hidden unless the page is opened
with `?dev=1`; there is no password in the page. Calibration data itself (`js/calibration.js`)
is part of normal rendering and is not affected. If a deployment sets a submission endpoint,
dev mode also shows "Submit Calibration Update", which asks for an admin key that the server
checks.

## Privacy and data

The page keeps everything in the browser. The setup is autosaved to localStorage a moment after
every change (`cap_uniform_builder_autosave_v1`, in `js/workspace-ui.js`) and offered back with a
Resume prompt on the next visit; it is never loaded silently. Named saves live in localStorage
too (Save to Browser), and nothing is uploaded when a PNG is downloaded. The only outbound traffic is the optional
submission endpoint, and only when someone sends a patch image or an administrator submits a
calibration. Saved or imported setups are validated by `sanitizeProfile()` in `js/wiring.js`
before they touch the page state; values that go into HTML pass through `escapeHtml()`.

## Building and serving

```bash
npm run build        # dist/ = runtime files only, with a Content-Security-Policy <meta> fallback
npm run serve:dist   # preview dist/ at http://127.0.0.1:8780 with the real security headers
```

The policy lives in `scripts/csp.cjs` and is the single source for the build, the preview
server, the deploy examples and `tests/security.test.cjs`.

## Load order (it matters)

All `js/` files are classic scripts that share one global scope, exactly as the
old single inline script did. They must stay in this order:

1. `config.js` (root) - deployment settings; the `military/*.js` catalog scripts; `data/uniform-rules.js` - the uniform rule table; then `js/state.js` - global state, the ?dev switch, rank data, placement constants
2. `js/calibration.js` - default and master calibration data
3. `js/dom-assets.js` - DOM shortcuts, asset path helpers
4. `js/catalog.js` - uniforms, ribbons, devices, badges, patches
5. `js/setup.js` - selects, sidebar toggle, setup flow, authorization
6. `js/render-core.js` - jacket and ribbon/medal rendering
7. `js/galleries.js` - ribbon, badge and patch galleries
8. `js/placement.js` - badge/patch placement and the render pipeline
9. `js/wiring.js` - event wiring, calibrator UI, modal gallery, PNG export
10. `js/workspace-ui.js` - step guide, preview toolbar/zoom, empty state, command bar
10a. `js/guided-flow.js` - the one-step-at-a-time sidebar, only when the page is opened with `?ux=2`
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
structural manifest of every CAP ribbon family and award level (which image,
where, how large, in what order). `scripts/baseline.tsv` is that manifest for
the current code (244 families, 5,408 entries: the 1,712 CAP entries plus the
U.S. military awards, regenerated 2026-10-09 when the military menus came back).

To check a change, serve the repo, open `scripts/visual-harness.html` and run
`compareToBaseline()` in the console. `clean: true` means every rack entry is
structurally identical. If a layout change is intentional, review the reported
differences, then regenerate the baseline: run `runHarness()`, serialise it with
`toRows()` in the same TSV shape as the existing file, and replace
`scripts/baseline.tsv`.

For a before/after comparison of two commits, serve both checkouts under one
origin (for example `/old/` and `/new/`), capture each, keep the rows in
`localStorage`, and diff the two maps. On 2026-10-08 this showed the stylesheet,
script split and UI work left all 5,408 entries (CAP and military) unchanged, and
that removing the military builder left all 1,712 CAP entries unchanged.

The default structural pass needs no visible pane; the optional pixel pass does.

## Placement regression harness

`scripts/placement-harness.html` does the same for badges, patches, shoulder cords and base
jackets: 7,548 scenarios across every uniform, cut and membership type, compared with
`scripts/placement-baseline.tsv` by `comparePlacement()`. See `docs/CALIBRATION.md` for how
placement is decided and how to read a difference.
