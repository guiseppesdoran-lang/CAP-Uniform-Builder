# Regulation audit: ABU 5.1.1, OCP 7.1, Corporate Field Uniform 5.2.1 and their hats

Date: 2026-10-13. Lane: `base-art/make-ocp-abu.js`, `make-abu-top.js`, `make-cfu-top.js`, `hats.js`
(assets `garment-ocp-coat-abu-cut`, `garment-abu-coat`, `garment-cfu-coat`).
Source text: `CAPR-39-1-with-ICLs.txt` (paragraph numbers as in that file). Sizes marked GL/PD come from the Army purchase description 14-04B relayed by the coordination chat.
Values are inches in each image's own coordinates, read from the regenerated `.spec.json` landmarks.
Status: PASS = drawn/exposed and matches; FIXED = failed, corrected this pass; OPEN = estimate or not decidable from the text; NOT-DRAWN = optional/variable item left to the builder.

## OCP coat (ICL 25-06, 7.1)

| Paragraph | Rule | What the asset has | Status | Fix / note |
|---|---|---|---|---|
| 7.1.1.1.1 | Glint squares stay covered | IFF loop tab 1 x 3.25 with 1 x 1.875 camo cover on top, both sleeves | PASS | |
| 7.1.1.1.2 | Basic configuration: name + CAP tapes, flag, AUX | all four drawn on the base image | PASS | |
| 7.1.1.1.2 | Only Velcro patches on sleeves | loop tape 4 x 6.5 on a 4.5 x 7.25 pocket; no stitching drawn | PASS | |
| 7.1.1.1.2 | Optional Velcro sleeve pen/pencil holder | not drawn (removed on Ethan's request) | NOT-DRAWN | GL/PD: left sleeve pencil pocket 2-3/8 wide, 2 channels |
| 7.1.1.2.1 | Rank on 2 x 2 in dark blue, front, centre of chest; blank square when no grade | `rank_square` 2.00 x 2.00, centred on the centreline (0.00 off), top 2.05 in below the tapes | PASS | vertical position is an estimate (OPEN, see below) |
| 7.1.1.2.3 | Name and CAP tapes mandatory; CAP tape upper left chest, last name upper right | name tape on wearer's right (image left), CAP tape on wearer's left, level, centred 5.30 in either side | PASS | |
| 7.1.1.2.3 | Tapes the same length as the removed hook panel (longer only if the name is) | 5.25 x 1.00 in (GL/PD: loop 1 x 5-1/4, 1/8 in above flap corner, level); gap drawn 0.13 in | PASS | |
| 7.1.1.2.3 | Light silver block lettering on dark blue | CAP tape lettered #d8dbe0 on #142347, outlined Arial Bold; name tape blank | PASS | |
| 7.1.1.3.1 | Badges centred above the CAP tape (1/2 in, 1/8 in rules) | not drawn | NOT-DRAWN | builder places from `cap_tape_top_center` |
| 7.1.1.3.1.7 | Commander insignia on 1 x 1 in blue patch 1/2 in above the name tape, or small Velcro patch on top of left sleeve | IFF tab exposed (`glint_tab_*`); no 1 x 1 patch | NOT-DRAWN | builder places from `name_tape_top_center` |
| 7.1.1.4 | Patches stay inside the Velcro | flag and AUX 3.25 x 1.8125 inside the 4 x 6.5 loop with 0.38 in side margins | PASS | |
| 7.1.1.4.1.1 | Reversed U.S. flag, full colour, centred at the top of the Velcro, right sleeve | flag on wearer's right sleeve, canton on the right, centred, top inset 0.25 in | PASS | inset is an estimate (OPEN) |
| 7.1.1.4.1.2 | Unit patch centred in the middle of the Velcro area under the flag | not drawn; anchor `unit_patch_right_center` now exposed | FIXED | added anchor from the loop-tape centre |
| 7.1.1.4.2 | Left sleeve: AUX in the top position | AUX on wearer's left sleeve, top of the loop, same size as the flag | PASS | |
| 7.1.1.4.2.1 | HHQ patch second position, left sleeve | not drawn; anchor `hhq_patch_left_center` now exposed (centre of the loop below AUX) | FIXED | added anchor; position within the remaining area is an estimate |
| 7.1.1.8 | Patrol cap: name tape centred on the back, same width as the coat tape | tape 5.25 x 1.0 on the back, centred, flush at the bottom edge | PASS | height position per Ethan; reg gives no vertical |
| 7.1.1.8 | Tactical cap: back name tape only for NCOs; front free of Velcro/items | OCP baseball (tactical) cap: tape 5.25 x 1.0 above the strap; front blank | PASS | |
| 7.1.1.8 | Rank centred, 1/2 in from the visor, on the front of caps; chaplain badge 1/2 in above the visor | invisible `*_insignia_zone` 1.6 x 1.6 on patrol and tactical front, bottom 0.5 in above the visor | PASS | zone size is an estimate |
| 7.1.1.8 | Tactical cap: solid OCP or OCP with coyote mesh back | solid OCP | PASS | |
| 7.1.1.12.2 | Unit baseball caps may be authorized | OCP-pattern baseball cap per Ethan; also treated as the tactical cap | OPEN | which of the two the builder should show is Ethan's call |
| GL/PD 3.7 | Chest pocket 6-3/4 x 5-1/4, flap 1-1/2, angled down toward the placket | 6.75 x 5.25, flap 1.5, 20 deg, inner corner 1.23 in from the centreline | PASS | tilt angle is an estimate |
| GL/PD 3.7 | Upper sleeve pocket 4-1/2 (rev B) x 7-1/4, loop tape 4 x 6-1/2 | 4.5 x 7.25 and 4.0 x 6.5 | PASS | |
| GL/PD 3.7 | Rank loop 2 x 2 on the placket | 2 x 2 | PASS | |

## ABU coat (5.1.1)

| Paragraph | Rule | What the asset has | Status | Fix / note |
|---|---|---|---|---|
| 5.1.1.1 | Button front, digitized tiger stripe, coat rests at the hips | 5 buttons, procedural tiger stripe | PASS | print is procedural (OPEN) |
| 5.1.1.1 | Pockets secured, no stowed items visible | buttons on flaps drawn; no contents | PASS | |
| 5.1.1.1 | Pen pocket on the sleeve (pens only) | not drawn (removed on Ethan's request) | NOT-DRAWN | |
| 5.1.1.1.2.1 | Light silver block lettering on dark blue | blank name tape; CAP tape lettered #d8dbe0 on #142347 | PASS | |
| 5.1.1.1.2.1 | Tapes immediately above the upper pockets, cut or folded to pocket width | tape width 5.00 = pocket width, 0.05 in above the pocket tops | PASS | |
| 5.1.1.1.2.1 | CAP tape above the wearer's left pocket, last name above the right | CAP tape on wearer's left (image right) | PASS | |
| 5.1.1.1.2.1 | Tape height | 0.9 in | OPEN | reg gives none; one measured tape settles it |
| 5.1.1.1.2.2 | Left sleeve: one wing/region/national patch, 1/2 in below the shoulder seam | `wing_patch_zone_left` 3.0 x 3.0 starting 0.5 in below the top of the sleeve | PASS | patch size not in the reg (OPEN) |
| 5.1.1.1.1.2 | NCO chevrons 4 or 3-1/2 in, centred on the outer arm halfway between elbow and shoulder seam | `chevron_zone_left` 4.0 x 6.77 in (largest authorized form: CMSgt/Command Chief 4 in chevron, `assets/insignia` 4 x 6.766), centred at the midpoint of seam-to-elbow (8.05 in below the sleeve top); reg gives chevron width only | FIXED | was 4.0 x 3.0 centred 0.2 in low; now holds every 3.5 and 4 in form |
| 5.1.1.1.1.1 | Officer grade centred, 1 in from the bottom of the collar (GO stars, colonel, ltcol/major, bars) | invisible `collar_officer_zone_{right,left}` 1.6 x 1.3 centred 1 in above the collar free edge (largest form: colonel 1.59 x 0.93, ltcol 1.15 x 1.25) | FIXED | new landmark; bounding box lies inside the leaf |
| 5.1.1.1.1.3-4 | Cadet officer grade (regular size) and cadet NCO metal chevrons on the collar, 1 in from the front, centred | invisible `collar_cadet_officer_zone_*` 2.5 x 1.5 and `collar_cadet_nco_zone_*` 1.1 x 1.75 centred 1 in from the front edge (largest forms: colonel 2.5 x 1.5, chief 1.09 x 1.75) | FIXED | new landmark; the 2.5 in cadet box overhangs the leaf's inner edge by ~0.5 in at its upper-inner corner (the real patch sits rotated on the leaf) |
| 5.1.1.1.2.3 | Optional breast pocket patch, centred low on the pocket | not drawn | NOT-DRAWN | |
| 5.1.1.1.2.4 | Badges 1/2 in above the CAP tape | not drawn | NOT-DRAWN | builder places from `cap_tape_top_center` |
| 5.1.1.1.2.5 | Command insignia 1/2 in above the name tape (current) | not drawn | NOT-DRAWN | |
| 5.1.1.6 | ABU cap with grade centred on the front | ABU-print patrol cap; invisible `patrol_cap_front_insignia_zone` | PASS | zone size is an estimate |
| ICL 25-02 (6.2.11.1) | Navy tactical cap: silver on navy tape centred on the back, rank 1/2 in from the visor | tape 5.0 x 0.9 on the back, zone on the front | PASS | tape width equals the coat tape (pocket width) |

## Corporate Field Uniform (5.2.1)

| Paragraph | Rule | What the asset has | Status | Fix / note |
|---|---|---|---|---|
| 5.2.1.1 | Single-breasted, four bellows pockets with flaps | 4 pockets with flaps, bellows folds drawn | PASS | |
| 5.2.1.1 | Straight-cut sleeve tabs; side body panels with or without take-up tabs | cuff tab drawn; side panels not drawn | NOT-DRAWN | optional |
| 5.2.1.1.2.1 | Name tapes silver on dark blue, immediately above the upper pockets, folded to pocket width | width 5.00 = pocket width, 0.05 in above the pocket tops, level | PASS | height 0.9 in is an estimate (OPEN) |
| 5.2.1.1.2.1 | CAP tape above the wearer's left pocket, last name above the right | CAP tape on wearer's left | PASS | |
| 5.2.1.1.2.2 | Left sleeve wing/region/national patch 1/2 in below the shoulder seam | `wing_patch_zone_left` | PASS | size not in the reg |
| 5.2.1.1.2.3 | Right sleeve special activity patch 1/2 in below the shoulder seam | `activity_patch_zone_right` (new this session) | PASS | |
| 5.2.1.1.1.3 | NCO chevrons 4 or 3-1/2 in on the sleeves, halfway between elbow and shoulder seam | `chevron_zone_left` and `_right` 4.0 x 6.77 in, centred at the seam-to-elbow midpoint | FIXED | was 4.0 x 3.0; holds the largest authorized form |
| 5.2.1.1.1.1 | Officer grade centred, 1 in from the bottom of the collar | `collar_officer_zone_*` 1.6 x 1.3 | FIXED | new landmark |
| 5.2.1.1.1.4, .6 | Cadet officer insignia 1 in from the front of the collar, centred; cadet NCO/airman metal chevrons both collar sides, 1 in from and parallel to the front | `collar_cadet_officer_zone_*` 2.5 x 1.5, `collar_cadet_nco_zone_*` 1.1 x 1.75 | FIXED | new landmark; same overhang note as the ABU |
| 5.2.1.1.2.4-5 | Optional patch on the lower part of each breast pocket | not drawn | NOT-DRAWN | |
| 5.2.1.1.2.9 | Command pin 1/2 in above the name tape / on the right pocket flap | not drawn | NOT-DRAWN | |
| 5.2.1.1.1.4-6 | Insignia itself on the collar | zones exposed (rows above); the insignia is placed by the builder | NOT-DRAWN | collar leaves are blank |
| 5.2.1.2.3 | Blue Field Cap, CAP baseball cap or navy tactical cap | all three headgear drawn as: Blue Field Cap (patrol design), tactical (baseball) cap, boonie | OPEN | baseball cap drawn is the tactical type (has the back tape); a plain CAP baseball cap (6.2.8) would have no tape and no rank |
| 6.2.9 | Blue Field Cap: dark blue cloth patrol design; officers' grade centred on the front | patrol cap in the shirt blue with the insignia zone | PASS | |
| 6.2.9.3 | NCOs and cadet airmen: no insignia on the cap | no insignia drawn | PASS | |
| 6.2.10 | Blue boonie: dark blue; grade and chaplain insignia as for the Blue Field Cap | boonie front with insignia zone, back plain | PASS | size and shape are estimates |

## Cross-asset standardization

| Item | Standard | OCP | ABU | CFU | Status |
|---|---|---|---|---|---|
| Rank square | 2 x 2 in | 2 x 2 | n/a | n/a | PASS |
| Flag and AUX | 3.25 x 1.8125 in | 3.25 x 1.8125 both | n/a | n/a | PASS |
| Name and CAP tape width | OCP 5.25 (hook panel); ABU/CFU = pocket width | 5.25 | 5.00 = pocket 5.00 | 5.00 = pocket 5.00 | PASS |
| Tape height | OCP 1.0 (GL/PD loop); ABU/CFU not in the reg | 1.0 | 0.9 | 0.9 | OPEN |
| Cap back tape width | = coat tape width | 5.25 | 5.00 | 5.00 | PASS |

## Counts

Counted from the table rows above: PASS 37, FIXED 8 (OCP anchors `unit_patch_right_center`, `hhq_patch_left_center`; ABU/CFU chevron zones enlarged to 4.0 x 6.77 in; ABU/CFU collar grade zones added), OPEN 4 table rows, NOT-DRAWN 11, FAIL 0.
The OPEN list below also includes estimates that sit inside PASS rows, so it has 8 entries.

OPEN items and the single measurement that settles each:
1. Rank square vertical position: distance from the tape bottom to the rank square top on a worn coat.
2. Flag top inset inside the Velcro: reg only says "centred at the top".
3. ABU/CFU tape height: one real tape.
4. Wing/HHQ/activity patch sizes: the unit's patch (CAPR 110-3 / Att. 8 give none in the text read).
5. Baseball cap type: Ethan's choice between the CAP baseball cap (no tape or rank) and the tactical cap.
6. Procedural camo prints: a photo or swatch of the fabric.
7. Insignia zone sizes on caps: the width of the Velcro on a real cap.
8. Back-tape vertical position on baseball-type caps: raised above the strap vs flush.
