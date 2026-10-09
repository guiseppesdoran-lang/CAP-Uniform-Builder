# How placement is decided

Where a badge, patch, cord or ribbon is drawn comes from one of three places, depending on the
uniform. This page says which, what data each one reads, and how to check that a change moved
nothing it should not have.

## The canvas

Dress and service uniforms draw on a 450 x 600 canvas. Field uniforms draw on 969.6 x 707.52.
The base art files in `images/base/` come in four source sizes (581x719, 612x753, 968x707 and
1130x1392), so a pixel coordinate only means something relative to the canvas it was drawn on.

## Three ways things get placed

**Field uniforms** (OCP, ABU, corporate field, CFDU, flight suit). Badges are laid out by rule in
`capubLayoutUtilityBadges()` in `js/patches.js`. The rule works in inches (22 px per inch), is
anchored on the name tape and CAP tape positions in `CAPUB_UTILITY_NAME_TAPE` and
`CAPUB_UTILITY_CAP_TAPE`, and takes each badge's width from the CAPR 39-1 figure for its type.
Patches come from the slot tables in `js/placement.js` (`FIELD_UNIFORM_PATCH_LAYOUTS`); a default box
per patch is generated from those tables at startup. No stored badge boxes are read. The only
stored badge data is a handful of `utilityBadgeRegV5:` overrides in `js/calibration.js`.

**Dress and service uniforms** (blues A and B, aviator, mess dress, semi-formal). Badges start at
the slot anchors in `js/placement.js` (`getBadgeBaseAnchor`, slots such as OLP, LP, ON, UN). A
stored box for the same key then replaces that start position. The stored boxes live in
`data/calibration-corrections.js` and in `DEFAULT_CALIBRATION_BY_UNIFORM`, with dated override
blocks later in `js/calibration.js`. If no box exists, `buildDerivedBadgeCalib()` derives one from
related keys.

**Ribbons.** The rack planner (`ribbon-layout.js` and `js/placement.js`) computes every row.
`applyCalibToElement()` drops the stored x, y, width and height for any `ribbon:` key, so the
`ribbon:` entries in the calibration data do not move anything.

## Order of precedence for a stored box

`applyCalibToElement()` in `js/calibration.js` takes the computed start position and then applies,
in this order: a box saved in this browser, a default or imported box for the uniform and cut, the
same keys under the base uniform name, and finally the derived box. Fixed-size badges are then
re-centred at their regulation size, and a few slots take their top edge from a reference badge or
from the rack.

## Checking a change

Two harnesses record what is drawn and compare it with a baseline stored in the repository.

- `scripts/visual-harness.html` and `baseline.tsv`: the ribbon rack, for every family and award
  level. Run `compareToBaseline()`.
- `scripts/placement-harness.html` and `placement-baseline.tsv`: badges, patches, shoulder cords
  and base jackets, for every uniform, cut and membership type (7,548 scenarios, about 35
  seconds). Run `comparePlacement()`. `clean: true` means nothing moved.

Serve the repository (`python3 -m http.server 8811`), open the harness page and run the function
in the console. A rack run on a freshly loaded page has to fetch and composite every military
ribbon, so the first run is slow in a hidden pane; later runs use the browser cache and take under
a minute. Both ignore calibration saved in the browser, so results do not depend on who runs
them. If a change is meant to move things, read the reported differences first, then regenerate
the baseline: run `runPlacement()`, serialise with `toTsv()` and replace the file.

## What was removed on 2026-10-09

The calibration data held 6,246 boxes. 5,830 were badge boxes for the five field uniforms, 140
were their patch boxes and 7 were their jacket boxes. None of them was read: the field-uniform
badge layout never asks for them, and the patch and jacket boxes equal what the slot tables give.
A startup generator also rebuilt the badge boxes in memory on every page load. Both are gone.

| | Before | After |
| --- | --- | --- |
| `data/calibration-corrections.js` | 487 KB, 6,246 boxes | 21 KB, 269 boxes |
| Default boxes held in memory | 6,643 | 483 |
| "Export All Coords" file | 517 KB | 35 KB |

The placement harness reported no change in any of its 7,548 scenarios.

## What is left to calibrate by hand

The 269 boxes that remain belong to the dress and service uniforms, plus the slot anchors and
derived rules in code. That is where a landmark-and-inches model, like the one the field
uniforms already use, would replace stored coordinates.
