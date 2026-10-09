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
stored box for the same key then replaces that start position. All stored boxes live in one file,
`data/calibration-defaults.js`, one box per line. If no box exists, `buildDerivedBadgeCalib()`
derives one from a reference badge for the same slot: observer wings for OLP, ground team for
OLPU, emergency services for LP, and so on, so about a dozen reference boxes per uniform and cut
carry most of the layout.

**Ribbons.** The rack planner (`ribbon-layout.js` and `js/placement.js`) computes every row.
`applyCalibToElement()` drops the stored x, y, width and height for any `ribbon:` key, so the
`ribbon:` entries in the calibration data do not move anything.

## Order of precedence for a stored box

`applyCalibToElement()` in `js/calibration.js` takes the computed start position and then applies,
in this order: a box saved in this browser (a developer's scratch copy, never shipped), the box
for the uniform and cut from `data/calibration-defaults.js` or the rules that fill gaps (shoulder
cords, field-uniform jackets and patches), the same key under the base uniform name, and finally
the derived box. Fixed-size badges are then re-centred at their regulation size, and a few slots
take their top edge from a reference badge or from the rack.

`js/catalog.js` also pins three badge sizes for the male Class A coat from
`CAPUB_APPROVED_CALIBRATION_OVERRIDES` in `js/calibration.js`, whatever a stored box says.

## Calibrating and saving

Open the builder with `?dev=1`, open the CAL tab on the left, switch Calibrate Mode on and drag or
nudge items. **Save to repo folder** writes the result into `data/calibration-defaults.js`:

- In Chrome or Edge it asks once for the repository folder, checks that it holds `index.html` and
  `data/`, and writes the file there. Later saves reuse the folder.
- In other browsers it downloads `calibration-defaults.js`; put it in `data/` yourself.

It writes only what differs from the rules, one box per line, keys sorted, fields in the order x,
y, w, h, r, so a save is a small diff: a moved badge is one changed line. Reset Selected puts a box
back to the shipped value and the next save leaves it as it was. Then review with `git diff`, run
`comparePlacement()`, and commit. Nothing is sent anywhere, and the old export, paste and push step
is gone. `js/calibration-save.js` is the code and `tests/calibration-save.test.cjs` covers it.

## Adding new base art

Rank-specific jackets in one family are the same garment with different insignia: across every
family in `images/base/`, rank variants line up with their siblings at zero shift (correlation
0.997 to 1.000 over the body below the shoulders). Calibration therefore belongs to the family,
not to each rank image, and a new rank image needs no calibration if it keeps the family's canvas
size and body.

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
| `data/calibration-corrections.js` (now `calibration-defaults.js`) | 487 KB, 6,246 boxes | 24 KB, 295 boxes |
| Default boxes held in memory | 6,643 | 483 |
| "Export All Coords" file | 517 KB | 35 KB |

The placement harness reported no change in any of its 7,548 scenarios.

## One file instead of eleven layers (2026-10-09)

Calibration values used to be written by eleven separate blocks in `js/calibration.js`: three
inline literals, a compact patch, an imported export, a dated update, an approved-issues block,
issue #143 and its family extrapolation, and two female updates. Later blocks silently overrode
earlier ones, so a box written to the data file could lose to a block further down. Three of the
blocks also re-applied themselves once per browser, from `localStorage`, which meant a visitor's
first load differed from every later load for five badges (the female cadet FON badge sat 13 px
away, and four others arrived without width, height and rotation).

The final values are now `data/calibration-defaults.js`, 295 boxes in 24 KB. `js/calibration.js`
went from 2,296 to about 1,030 lines. The map the page builds is byte-for-byte the same as before
(483 boxes), the placement harness reports no change, and a new visitor's first load matches every
later one. `tests/calibration-defaults.test.cjs` pins the approved values.

## What is left to calibrate by hand

The 295 boxes in `data/calibration-defaults.js` belong to the dress and service uniforms and a few
OCP patches, plus the slot anchors and reference-badge rules in code. That is where a
landmark-and-inches model, like the one the field uniforms already use, would replace stored
coordinates.
