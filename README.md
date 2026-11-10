# Uniform Builder for CAP members

A static web app that draws Civil Air Patrol uniforms as SVG from the regulation rules (CAPR 39-1 and CAPR 39-3). Pick a membership type, rank and uniform, add ribbons, badges and patches, and see them placed on the garment. It can fill in a setup from a CAP member report. It exports a PNG, a shopping list, and paper and 3D-print placement templates.

It is an unofficial tool. It is not affiliated with or endorsed by Civil Air Patrol or the U.S. Air Force, and it does not replace CAPR 39-1.

## Running it

There is no build step for development. Serve the repository folder with any static file server:

```bash
python3 -m http.server 8811
```

Then open http://localhost:8811/. The page asks for an access code first. "Continue as guest" opens it without one. The gate is a courtesy, not security (`js/access-gate.js`).

The page posts usage counts to `/api/events` and feedback to `/api/feedback` on its own origin. A plain static server has no such paths, so the counts are dropped and a feedback message reports that it was not sent. Everything else works. Set `metrics` and `feedback` to `false` in `config.js` to turn both off.

Add `?dev=1` to the address to show asset ids and slot codes in the badge and ribbon pickers.

## Tests and checks

```bash
npm test                     # node --test tests/*.test.cjs, no dependencies
npm run check:inline-syntax  # parses the inline scripts in index.html and the scripts directly in js/
npm run check:assets         # exits 1 if a ?v= stamp in index.html is stale
npm run stamp:assets         # rewrites the ?v= stamps
```

Every local script and stylesheet tag in `index.html` carries `?v=<hash of the file's content>`, so a changed file gets a new URL. After you edit any of those files, run `npm run stamp:assets`. `npm test` fails (`tests/asset-stamps.test.cjs`) and `npm run build` refuses to run while a stamp is stale. Do not edit the stamps by hand.

Some files are generated and say so in their first lines (`data/asset-index.js`, `data/patch-art.js`, `data/military-medals.js` and others). Their scripts are in `scripts/` (`build-*.cjs` and `sync-*.cjs`). `military/military-data.js` is rewritten by `scripts/sync-military-badges.cjs` and `scripts/sync-military-ribbons.cjs`. After changing anything under `images/`, run `node scripts/build-asset-index.cjs`. It rewrites `data/asset-index.js`, which carries a version hash of the manifest and every artwork file, and `tests/asset-index.test.cjs` fails when the two disagree.

The files named `tests/*-browser.cjs`, `scripts/render-builds.cjs` and `scripts/perf-measure.cjs` drive headless Chrome. They are not part of `npm test`. `scripts/render-builds.md` explains the renderer.

## Layout

| Path | What is there |
| --- | --- |
| `index.html` | Markup only: header, sidebar, preview, dialogs. No inline scripts. |
| `styles/app.css` | The one stylesheet. Colors and sizes are tokens at the top. |
| `js/engine/` | The drawing engine: asset specs, placement, ribbon racks and medals, one profile per uniform, the measurement overlay, the SVG drawing and PNG export. All of it except the drawing step also runs in Node, which is how the tests compose scenes. |
| `js/*.js` | Page code: state, pickers, wiring, import, usage counts, feedback. They are classic scripts that share one global scope and load in the order `index.html` lists. |
| `data/` | Rule and catalog data. `uniform-rules.js` states what each uniform allows, with the paragraph of CAPR 39-1 for each rule. |
| `images/` | The artwork: SVG files and the unit emblem PNGs, most with a `.spec.json` of size, anchors and landmarks, all listed in `MANIFEST.json`. See `images/ASSETS.md`. |
| `military/` | The U.S. military award and badge catalog and its rules. |
| `config.js` | Per-deployment settings. Nothing secret belongs in it. |
| `deploy/` | Web server examples, the container files, and `api/`, the small Node service for usage counts, feedback and the `/admin` page. |
| `google-apps-script/` | An optional endpoint for patch image submissions. |
| `scripts/` | Build, stamp, sync and measuring tools. Not part of the page. |
| `tests/` | The test suite. |
| `vendor/` | pdf.js (for member report PDFs) and the fonts. |
| `docs/` | Notes. `APP_STRUCTURE.md` has the engine, the load order and the data flow. |

## Deploying

`npm run build` writes `dist/`. It holds only the files the page needs, adds a Content-Security-Policy tag to `index.html`, writes the artwork packs, and writes brotli and gzip copies. `npm run serve:dist` serves `dist/` on port 8780, reachable from this machine only, with the real security headers. `deploy/README.md` covers the web server, the API and its data.

Patch image submissions are off unless `config.js` names an endpoint (see `PATCH_SUBMISSION_SETUP.md`). The privacy note in the page does not cover them, so a deployment that turns them on should tell visitors what the form sends.

## What the page stores and sends

The setup is saved in the browser's localStorage as you work and offered back with a Resume prompt on the next visit. A member report is read in the browser and is not sent anywhere.

The page sends two things to its own origin. One is anonymous usage counts (`js/telemetry.js`): which uniform, cut and grade, how many items, which buttons. It never sends a name, CAPID, nameplate text or report contents. With Do Not Track on, only visit and build counts go, without an id. The other is feedback that a member chooses to send (`js/feedback.js`). The Content-Security-Policy of a built site allows requests to the page's own origin, plus the submission endpoint when one is set. The Privacy paragraph in the About dialog in `index.html` says the same.

## Look and feel

The visual system is one token block at the top of `styles/app.css`: the colors and typefaces of the CAP Brand Guide (Symbol Blue, Silver Gray, Scarlet Red and Air Force Yellow; Rajdhani for headings, Ubuntu for body, self-hosted in `vendor/fonts/`). A dark theme follows the system setting. The interface uses none of CAP's logos, seal or wordmark. Change colors and sizes in the tokens, not in individual rules. `docs/style-guide.html` documents the palette, type, components and the rules for changing them. Open it through a local server so it can load the stylesheet.

## License and credits

The code and documentation are under the MIT license (`LICENSE`). That covers what the authors wrote, and nothing else. `NOTICE.md` lists what it does not cover and where the artwork and data come from: CAP and U.S. Air Force names and insignia, the artwork in `images/`, the official unit emblems, compiled and mirrored data, the fonts, and pdf.js (Apache-2.0, in `vendor/pdfjs/`). Confirm that you may redistribute an image before publishing it elsewhere.

`docs/HISTORY.md` is a digest of the commit history up to 2026-10-07.

Developed by C/Col. Guiseppe Doran and C/Lt Col. Ethan Hillard.
