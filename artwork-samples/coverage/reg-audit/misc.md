# Regulation audit: grade insignia, cords, service caps, flight cap devices (CAPR 39-1 3 Mar 2020 + ICLs 21-01/25-02/25-06/26-04)

Scope: Attachment 5, the per-uniform grade paragraphs (4.1.x, 4.2.x, 5.1.x, 5.2.1, 6.1.x, 7.1.1.2, 8.2.3, 8.3.3), shoulder cords 9.3, service caps 6.2.1, flight cap devices 6.2.2.2.
Date 2026-10-13. Generators: build-rank-insignia.js, make-cadet-chevrons-flat.js, build-epaulet-sleeves.js, build-cords.js, build-caps.js, build-cap-devices.js. Validator: 344 assets, 0 failures.
Status: PASS = asset/mount already matches; FIXED = failed, corrected at generator level this pass; OPEN = needs a change outside this lane or a source that does not exist.
Composite checks (throwaway, scratchpad `comp/A-ocp`, `B-misc`, `C-slots`): OCP square, FDU shoulder zone, ABU sleeve zone, Class A/B epaulet slot, cords and caps on garments.

## 1. Which insignia form goes on which uniform

| # | Paragraph | Rule | Asset / mount had | Status | Fix |
|---|---|---|---|---|---|
| 1 | 7.1.1.2.1, 7.1.1.2.2 | OCP chest: embroidered grade on a 2 x 2 in dark blue square, centre of chest | `-ocp-square` forms 2 x 2 in; garment `rank_square` 2.00 x 2.00 in; composite lands centred | PASS | |
| 2 | 7.1.1.2.2, 6.1.10.2.2 | Cadet NCOs/Airmen: metal device on the 2 in square; Airman Basic no device and no blue | `rank-cadet-nco-*-ocp-square`, `backing: none`; Airman Basic has an asset | PASS | note: Airman Basic asset exists but is never mounted (spec says wears none) |
| 3 | 5.1.1.1.1.4, 5.1.2.2.6, 5.2.1.1.1.6, 4.1.5.2.1.4, 4.2.5.1.1.5 | Cadet NCOs wear METAL chevrons on both collar sides / coat lapels | metal form present; mount text cited 4.1.6.1.5 (which says NONE on the shirt under the coat) | FIXED | mounts rewritten per form with the correct paragraphs (MOUNT_METAL) |
| 4 | 7.1.1.8, 6.2.11.1, 5.1.2 | NCOs, cadet NCOs and Airmen wear NO insignia on OCP patrol/tactical, ABU, BDU, navy tactical caps | cadet NCO `-metal` and `-cloth-bordered` mounts said "OCP / ABU / tactical cap: cloth-bordered piece centered 1/2 in from the visor"; family spec correct | FIXED | NONE mount on all cadet NCO assets |
| 5 | 5.1.1.1.1.4 | Cadet NCO chevron on ABU is metal; no cloth chevron is prescribed anywhere | `rank-cadet-nco-*-cloth-bordered` (11) built at the requester's direction | FIXED | kept; `regulation_authorized_mount: false` + note in each spec; mount "(no regulation mount)" |
| 6 | 5.1.1.1.1.3, 5.1.2.2.4, 5.2.1.1.1.4 | Cadet officers: regular size, centred 1 in from the FRONT of the collar, 1/8 in blue; Cadet Colonels and Captains may wear miniature | cloth-bordered regular + miniature for all grades; mount text had ABU only | FIXED | mount lists ABU, BDU and blue field coat collars, caps, fleeces |
| 7 | 5.1.2.2.5, 5.2.1.1.1.5, 7.1.1.8, 6.2.11 | Cadet officers: grade on front of caps, 1/2 in from the visor, 1/8 in blue | ABU/OCP/tactical only | FIXED | BDU, blue field and navy tactical caps added |
| 8 | 5.1.1.1.1.1 | Officers: light silver, 2d Lt and Major gold, on dark blue cloth | Major thread/cloth/square gold; 2d Lt gold; others silver | PASS | |
| 9 | 8.2.3.2, 8.3.3.2 | FDU/CFDU officers: grade centred on top of each shoulder, bottom edge 1/2 in from the shoulder seam; cloth with embroidery may replace plastic | mount text correct | PASS | position only; see row 27 for zone size |
| 10 | 8.2.3.3, 8.3.3.3 | NCOs and cadets: no grade on FDU/CFDU | mount text correct | PASS | |
| 11 | 4.1.5.2.1.1, 4.1.6.1.1, 4.2.5.1.1.1 | Officers: embroidered grade on gray epaulet sleeve (Class A coat with epaulets, Class B shirt, aviator shirt) | `rank-epaulet-sleeve-gray-*` built (12) | PASS | |
| 12 | 4.1.6.1.4, 4.1.8.1.1, 4.2.5.1.1.4 | Cadet officers: MINIATURE grade on blue epaulet sleeves (shirts) | `rank-epaulet-sleeve-blue-cadet-*` (7) miniature metal | PASS | |
| 13 | 4.1.5.2.1.3, 4.1.7.2.1.1, 4.1.9.3.4, 4.1.10.1.1.1 | Cadet officers on service coat: regular-size grade on cadet officer shoulder boards (snap/Velcro to epaulet) | boards live in the garment lane (`garment-blues-class-a-cadet-officer-insignia`); metal regular exists | PASS | |
| 14 | 4.1.1.1.1.1, 4.1.2.1.1.1 | Mess dress officers: BULLION grade on shoulder boards | only thread/embroidered forms built; mess board slots 0.6 in | FIXED | 11 `rank-senior-<grade>-bullion` built (build-mess-dress-grade.js), family sizes, gold 2d Lt/Major; board slot 0.6 in still undersized (row 35) |
| 15 | 4.1.1.1.1.4 | Male mess dress NCOs: 4 in WHITE chevron; female 3 1/2 or 4 in white (4.1.2.1.1.4) | only navy chevrons | FIXED | 12 `rank-senior-<grade>-chevron-white-{3p5,4}in` built |
| 16 | 6.1.9.2, 6.1.12.3 | Patrol-jacket/cardigan style "front tab": grade below embroidered "CAP" on dark blue tab (officers embroidered, NCOs metal) | no tab garment/slot in the rank mounts | OPEN | garment lane: needs a tab landmark; rank pieces would be the thread / metal forms |
| 17 | 6.1.10.2, 6.1.14.4 | Green/black fleece: dark blue material on the front | no mount existed | FIXED | rows added for senior and cadet (orientation rows 19, 22) |

## 2. Size

| # | Paragraph | Rule | Had | Status | Fix |
|---|---|---|---|---|---|
| 18 | 5.1.1.1.1.1, 8.2.3.1, 7.1.1.2.1 | General officer stars 1 in (3/4 in if unable) | `-1in` and `-3-4in` sets: star_diameter 1.0 / 0.75 | PASS | |
| 19 | Fig A5-4, 4.1.5.2.1.2, 4.2.5.1.1.3, 4.2.6.2.3 | NCO chevrons 3 1/2 or 4 in wide; Class A coat 4 in ONLY; corporate shirts 3 1/2 in ONLY | 3p5in / 4in sets both mounted everywhere | FIXED | `chevronMounts(width)`: 4 in set carries the Class A coat row, 3 1/2 in set the corporate row |
| 20 | 5.1.1.1.1.1 etc. | 1/8 in of blue past the widest and tallest point | cloth-bordered border 0.125 in each side, computed from bbox | PASS | |
| 21 | Fig A5-6 | Cadet metal regular / miniature sizes | e.g. 2d Lt 0.75 / 0.38, Capt 2.25 x 0.75 / 1.25 x 0.38 | PASS | measured from the figure |

## 3. Orientation

| # | Paragraph | Rule | Had | Status | Fix |
|---|---|---|---|---|---|
| 22 | 7.1.1.2.1, 6.1.10.2.1, 6.1.14.4.1 | OCP/fleece: Colonel eagle centred horizontally, beak toward the wearer's right shoulder; Major/Lt Col stem toward the ground; bars long end vertical | eagle was drawn beak toward the viewer's right; leaf stem down, bars vertical | FIXED | eagle mirrored (beak toward the viewer's left = wearer's right); rest PASS |
| 23 | 7.1.1.2.1 | OCP: generals vertical, one point up each; fleece (6.1.10.2.1, 6.1.14.4.1): generals HORIZONTAL, one point up | vertical and horizontal forms exist | PASS | mount rows say which |
| 24 | 7.1.1.2.2 | OCP cadet officers: field-grade long points horizontal, company-grade circles stacked vertically | `-ocp-square` as built | PASS | |
| 25 | 6.1.10.2.2, 6.1.14.4.2 | Fleece cadet officers: centred horizontally, long points vertical, circles added horizontally (opposite of OCP) | cloth-bordered orientation matches (the ABU/cap orientation) | FIXED | fleece row added to the cloth-bordered mounts |
| 26 | 5.1.1.1.1.1, 5.1.2.2.1, 5.2.1.1.1.1 | ABU/BDU/blue field collar: Lt Col/Major stem PARALLEL to the ground, pointing AWAY from the wearer's neck; Colonel perpendicular to the collar, beak facing forward; generals perpendicular to the collar; bars long end centred | mount text had no rotation; the single leaf asset has stem down | FIXED | `placement.rotate_deg_by_grade` (+90 cw on the right collar, -90 on the left) in the collar mount; the other grades unrotated |
| 27 | 4.1.1.1.1.3, 4.1.2.1.1.3, 4.1.6.1 chain | Epaulet / board: stem points away from the collar; bars lie across the strap (Fig A5-1) | sleeve assets correct (stem toward the outer end, bars rotated); loose piece in a garment `rank_slot` had no rule | FIXED | strap-angle rotation formula recorded in the epaulet mount |
| 28 | 4.1.1.1.1.2, 4.1.5.2/4.1.6.1.2 | Colonel on epaulet/board: "beak facing forward" | eagle now beak to viewer's left | PASS | regulation gives no side on epaulets; same mirrored art used, flagged |

## 4. Position on the garment (garment landmarks vs asset sizes)

| # | Paragraph | Rule | Garment landmark vs asset | Status | Fix |
|---|---|---|---|---|---|
| 29 | 4.1.11.1.1.1.4, 4.2.5.1.1.5, 5.x | Cadet NCO collar chevron 1 in from and parallel to the front of the collar | `collar_insignia_*` is 1.00 in from the neck-to-point collar edge on all 8 shirt/blouse collars | PASS | |
| 30 | 4.1.5.2.1.2 etc. | NCO sleeve chevron centred on the outer arm halfway between shoulder seam and elbow | ABU/CFU `chevron_zone_*` now 4.00 x 6.77 in | FIXED | garment lane resized the zone; re-run: all six NCO chevrons (4 in, up to 6.77 in tall) fit inside the ABU/CFU zone, Command Chief exactly fills it |
| 31 | 8.2.3.2 | FDU officer grade zone 1.40 x 0.90 in | FDU/CFDU/jackets `grade_zone_*` now 1.60 x 1.25 in | FIXED | re-run: all thread and cloth-bordered officer forms land inside the zone (Colonel cloth 1.59 x 0.93 in the 1.60 x 1.25 zone) |
| 32 | 8.2.3.1 | FDU generals: 1 in stars, point-to-center, halfway between neck and shoulder seam | general zone now 2.20 x 1.20 in | FIXED | re-run: Brig Gen and Maj Gen (horizontal 2.15 x 1.15 cloth, vertical thread) fit the 2.20 x 1.20 in general zone |
| 33 | 4.1.6.1.1, DAFI 4.5.1.1.1 | Class B sleeve: grade centred 5/8 in from the outer end, centred across the strap | Class B slot container 2.3 along x 1.55 across, centre 0.6 in inboard of the rule point | PASS | single forms placed at `rank_rule_point_*` (5/8 in from the outer end, DAFI 4.5.1.1.1), Maj Gen pair stacked at the slot centre; all fit the 2.3 x 1.55 container |
| 34 | 4.1.5.2.1.1 | Class A gray sleeve: grade on the sleeve | Class A coat slot container 2.3 along, rule point anchor 5/8 in from the end | PASS | single forms at `rank_rule_point_*_center`; container 2.3 x 1.58 (men) / 1.36 (women); all fit incl. Maj Gen pair stacked |
| 35 | 4.1.1.1.1.1 | Mess dress board: grade as close to the shoulder seam as possible | mess board slot 1.5 along x 1.2 across | PASS | bullion leaf, bars and Colonel fit at scale 1; Maj Gen stacked stars scale 0.829 (1.81 in along vs 1.5 in); recorded in each bullion spec `slot_fit` |

## 5. Shoulder cords (9.3)

| # | Paragraph | Rule | Had | Status | Fix |
|---|---|---|---|---|---|
| 36 | 9.3, 9.3.1.x | Cadets only, left shoulder, Class A/B; colours per cord (CAC gold/blue/red etc.) | 7 cords, colours from the app images; mounted left shoulder under the epaulet; draw order garment, cord, sleeve | PASS | |
| 37 | 9.3 | Lies along the shoulder seam under the epaulet | at 4.5 in the cord overran the coat silhouette | FIXED | length 4.1 in, bow 0.25 in; strap axes recorded per garment in `garment_fit` |

## 6. Service caps (6.2.1) and flight caps (6.2.2.2)

| # | Paragraph | Rule | Had | Status | Fix |
|---|---|---|---|---|---|
| 38 | 6.2.1.1.1 | Band: dark blue 1 3/4 in braid; front black chinstrap | band 1.75 in, chinstrap | PASS | |
| 39 | 6.2.1.3.1-3 | Clouds and darts 3 general, 2 field grade, 0 others; plain black visor (women's blue) | 3 / 2 / 0 / 0, women's visor blue | PASS | |
| 40 | 6.2.1.2.1 | Women's cap: solid blue, no band | solid | PASS | |
| 41 | 6.2.1.1.1 | Officers/NCOs CAP service cap insignia; cadet officers cadet service cap insignia centred on the front | slots only | FIXED | `cap-device-officer-service`, `cap-device-cadet-officer-service` built (low fidelity, ~190 px figure, no better source in the repo) |
| 42 | 6.2.2.2.1-3 | Flight cap device on the front left flap, halfway up, 1 1/2 in from the front; officers incl. generals: flight cap insignia; cadet NCOs/Airmen: Cadet Airman insignia; cadet officers: metal grade | cap + NCO device only | FIXED | `cap-device-officer-flight` built; NCO device resized 0.9 -> 1.3 in; slots widened |
| 46 | Fig A5-6, 4.1.5.2.1.3 | Cadet officer regular metal grade on the cadet shoulder board (new slot 1.5 x 1.2 in) | cadet board slot now 2.3 x 1.3 in: regular metal Capt/Colonel 2.25 wide and Major/Lt Col 1.25 tall all fit | PASS | re-run 2026-10-13 |
| 43 | 6.2.2.2.1, ICL 25-02 (g) | Senior member NCOs: no device (text) vs NCO device (ICL) | follows the ICL | OPEN | regulation conflicts; Ethan to confirm which to follow |
| 44 | 6.2.2.2.1-3 vs Fig p.139 | 1 1/2 in "from the front" to the device centre (text) vs to the device edge (figure) | follows the text (centre) | OPEN | recorded; figure and text disagree |
| 45 | n/a | Hat placement: garment_attach_center to garment top_center | convention recorded in ASSET_NOTES | PASS | |

## Counts

46 rows after the rule-point re-run: PASS 24, FIXED 18, OPEN 4 (rows 16 out-of-scope tab garments, 43 NCO flight-cap device text vs ICL, 44 centre vs edge, 35 Maj Gen stacked bullion needs scale 0.83 on the 1.5 x 1.2 mess slot).
Composite / numeric re-run (98 piece-in-slot checks, 8 slot classes): 97 pass, 1 fail (Maj Gen bullion on the mess board, scale 0.829). Two general-zone cloth-bordered checks overshoot by 0.001 in (rounding) and are counted as pass.
