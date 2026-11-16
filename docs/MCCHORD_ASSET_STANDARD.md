# McChord ribbon option data

`mcchord-ribbon-variants.js` holds the option lists for 30 CAP ribbon families (634 options). Its first line says it is generated from McChord's senior rack builder. It holds labels, values and ribbon counts. It holds no images, and no McChord image is in this repository.

Each option has:

- `label`, the text in the picker, such as "Basic Award" or "2nd Award".
- `value`, which is `mcchord_` and the builder's option code.
- `devices`, an empty object. Devices are drawn by the engine.
- `duplicates`, only on an option that takes more than one ribbon. One entry is one additional ribbon.

## How it is made

`scripts/sync_mcchord_ribbon_variants.py` writes the file whole. It reads the builder's senior ribbon form, collects the dropdown options for each ribbon, and asks the builder for each option's output to count how many ribbon images it produces. It reads the image addresses only and downloads no image. It uses only the Python standard library and needs network access. Do not edit the file by hand.

## How it is used

- `js/galleries.js` reads `MCCHORD_RIBBON_VARIANTS[ribbonId]` to build the picker's options for that ribbon. For the ribbons that repeat, it extends the list to 84 awards.
- Saved setups and the member report importer (`js/member-report-import.js`) refer to the same `mcchord_*` values.
- `scripts/verify-device-rule.js` compares the engine's device rule with McChord's ribbon file names. It reads those names from an earlier commit of this file, because the current file no longer carries them.

## The ribbons that are drawn

A ribbon is an SVG under `images/ribbons/`, with its devices drawn on it by `js/engine/awards.js`. All 351 ribbon sheets in `images/MANIFEST.json` are 1.375 x 0.375 in. The ribbons for U.S. military awards are under `images/ribbons/military/`. `NOTICE.md` says where the artwork and this data come from.
