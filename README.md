# CAP Uniform Builder

A static web app for planning how rank, ribbons, badges and patches go on each Civil Air Patrol uniform. Pick a membership type, rank and cut, add items, and see them placed on the uniform. It can read a CAP member report to fill in a setup, and it exports a PNG and a purchase list.

It is an unofficial tool. It is not affiliated with or endorsed by Civil Air Patrol or the U.S. Air Force, and it does not replace CAPR 39-1.

## Running it

There is no build step for development. Serve the repository folder with any static file server:

```bash
python3 -m http.server 8811
```

Then open http://localhost:8811/.

## Tests and checks

```bash
npm test                    # unit tests, Node's built-in runner, no dependencies
npm run check:assets        # asset URLs carry current content hashes
npm run check:inline-syntax # the scripts parse
```

After editing a script or stylesheet, run `npm run stamp:assets` so the `?v=` hashes in `index.html` are current. A test fails if they are not.

Two browser harnesses record where things are drawn and compare the result with a baseline kept in `scripts/`: `visual-harness.html` for ribbon racks and `placement-harness.html` for badges, patches, shoulder cords and jackets. `docs/CALIBRATION.md` explains how to run them.

## Deploying

`npm run build` writes `dist/`, which holds only the files the page needs, and adds a Content-Security-Policy tag to `index.html`. `deploy/` has nginx and Caddy examples with the security headers, plus notes for a home server. `npm run serve:dist` serves `dist/` locally with the same headers.

Patch and calibration submissions are off unless `config.js` names an endpoint (see `PATCH_SUBMISSION_SETUP.md`). A deployment that turns them on should tell visitors what the form sends. The privacy note in the page says nothing is uploaded, which is true only while submissions are off.

## Calibrating

Open the page with `?dev=1` to get the CAL tab. `docs/CALIBRATION.md` covers how placement is decided, the Save to repo folder button, and how to add new base art (`npm run check:base-art` needs Pillow and numpy).

## Layout

`index.html` holds markup only. Styles are in `styles/app.css`. The application is a set of classic scripts in `js/` that share one global scope and load in a fixed order. Calibration boxes are in `data/calibration-defaults.js`, the U.S. military award catalog is in `military/`, artwork is in `images/`, and pdf.js is vendored in `vendor/pdfjs/`. `docs/APP_STRUCTURE.md` has the details and the load order.

Other notes in `docs/`: `HISTORY.md` (where the code came from), `MISSING_BASE_ART.md` (rank images that do not exist yet) and `MCCHORD_ASSET_STANDARD.md`.

## Licence and credits

No licence has been chosen yet, so all rights are reserved by the authors by default. Please do not reuse the code or artwork until one is added.

pdf.js (Apache-2.0, in `vendor/pdfjs/`) is the only third-party code. The artwork depicts insignia and designs owned by others, and the military award images record their sources in `military/military-data.js`. Confirm that you may redistribute an image before publishing it elsewhere.

Created by C/Col. Guiseppe Doran. Maintained with Ethan Hillard.
