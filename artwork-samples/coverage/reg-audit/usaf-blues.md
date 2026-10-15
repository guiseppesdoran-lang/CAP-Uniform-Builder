# USAF-style blues regulation audit (CAPR 39-1, 3 March 2020 + ICLs) — mess dress, semi-formal, Class A (new), Class B, senior layers

Audited 2026-10-13. Source text: `coverage/reg-audit/CAPR-39-1-with-ICLs.txt` (4.1.1-4.1.4 pp. 52-61, 4.1.5-4.1.6 pp. 61-65, 4.1.9 pp. 68-70, 4.1.11 pp. 76-79, 4.1.12 pp. 80-82).
Generators: `base-art/make-mess-dress.js`, `make-mess-skirt.js`, `make-blues-a.js`, `make-blues-a-female.js`, `make-blues-b.js`, `make-long-outlines.js`, `make-senior-layer.js`, `nametag-art.js`.
Status: PASS = asset matches; FIXED = failed and corrected in this round (generator level); NOT-DRAWN = rule is about something the base image does not show (by design / not visible from the front); OPEN = not built, with reason.
Dimensions in inches; user units are 0.01 in.

## Mess dress, men's (4.1.1)

| Para | Rule | Asset has | Status | Fix |
|---|---|---|---|---|
| 4.1.1.1 | Non-fastening single-breasted jacket, 3 wing-and-star / CAP arms / USAF arms buttons each side | 3 + 3 buttons (`button_right_1-3`, `button_left_1-3`), 0.8 in dia, zig-zag as in Fig 4.1 and the base photo | PASS | - |
| 4.1.1.1 | Two buttons with a silver chain close the front | `closure-button-right/left` + `closure-chain` | PASS | - |
| 4.1.1.1 | Satin shawl collar and lapels | `shawl-right/left`, satin gradient | PASS | - |
| 4.1.1.1 | Straight back, centre back 3 1/2 to 4 in below natural waist | back not visible in front view | NOT-DRAWN | - |
| 4.1.1.1 | Semi-fitted sleeves end 1/4 to 1/2 in below the wrist | cuff end drawn; wrist not drawn | NOT-DRAWN | - |
| 4.1.1.1 | Sleeve braid 1/2 in (general officers 1 1/2 in) | overlays `...-officer-sleeve-braid` (0.5) / `...-general-officer-sleeve-braid` (1.5) | PASS | - |
| 4.1.1.1 | Braid 3 in from the end of the sleeve | was centred 3.4-3.5 in from the sleeve end, horizontal | FIXED | braid edge nearest the sleeve end is 3.0 in from the end, cut parallel to the cuff; polygons exposed as `sleeve_braid_right/left` |
| 4.1.1.1.1.1 | Shoulder boards, 1/2 in dark blue (1095) braid each side, button at peak, as close to the seam as possible | `...-officer-shoulder-boards`: 0.5 in braid both sides, button at peak, `shoulder_board_*` + `rank_slot_*` landmarks at the shoulder mark | PASS | braid colour is a sample, shade 1095 has no published RGB (assumed) |
| 4.1.1.1.1.4 | NCOs 4 in white chevron centred halfway shoulder seam to elbow | chevron assets belong to the chevron chat | OPEN | other chat |
| 4.1.1.1.2.1 | No nametag | no nametag slot or layer | PASS | - |
| 4.1.1.1.2.2 | Miniature medals centred on wearer's left between lapel and arm seam, midway between top shoulder seam and top button | no slot existed | FIXED | landmark `miniature_medal_slot` (3.0 x 1.25 in, size estimated) + anchor `miniature_medals_center` |
| 4.1.1.1.2.3 | CAP seal over the middle button on the right side | `cap_seal` slot 2.5 in (Fig A6-4) centred on `button_right_2` (offset < 0.01 in) | PASS | - |
| 4.1.1.2 | White pleated dress shirt, studs mandatory | pleated bib, 4 studs | PASS | - |
| 4.1.1.2.1 | Cuff links mandatory (French cuffs) | cuffs hidden by jacket sleeves | NOT-DRAWN | - |
| 4.1.1.2.3 | Blue satin bow tie | `bow-tie` satin | PASS | - |
| 4.1.1.3 | Trousers, 7/8 in blue stripe | trouser front shown as a plain panel with crease | NOT-DRAWN | stripe sits on the legs (not in the box) |
| 4.1.1.3.2 | Plain blue satin cummerbund, halfway between shirt and trousers, pleats open edge up | plain satin band, pleat lines, curved top tucked under the bib | PASS | redone in the mess dress rework |

## Mess dress, women's (4.1.2)

| Para | Rule | Asset has | Status | Fix |
|---|---|---|---|---|
| 4.1.2.1 | 3 buttons each side; no front chain closure | 3 + 3, no closure elements | PASS | - |
| 4.1.2.1 | Front opening gaps about 2 to 3 in at the bottom | panel edges 265 px / 322 px at 0.0474 in/px = 2.7 in | PASS | - |
| 4.1.2.1 | Centre back 2 1/2 to 3 in below natural waist | back not visible | NOT-DRAWN | - |
| 4.1.2.1 | Sleeve braid 1/2 in (GO 1 1/2 in), 2 1/2 in from the sleeve end | was 3.1-3.25 in (centred) | FIXED | edge nearest the end 2.5 in from the end, parallel to cuff (same builder as men's, `d` = 2.5) |
| 4.1.2.1.1.1 | Boards with 1/2 in dark blue braid, no button | `...-officer-shoulder-boards` has no button | PASS | - |
| 4.1.2.1.1.4 | NCO chevron 3 1/2 or 4 in white | chevron chat | OPEN | other chat |
| 4.1.2.1.2.1 | No nametag | none | PASS | - |
| 4.1.2.1.2.2 | Miniature medals as men's | no slot existed | FIXED | `miniature_medal_slot` / `miniature_medals_center` (shoulder mark to seam line from the armhole, estimated 3.0 x 1.25 in) |
| 4.1.2.1.2.3 | CAP seal over middle button, right side | seal centre = `button_right_2` | PASS | - |
| 4.1.2.2 | White blouse, 1/4 in or 1/8 in pin-tuck pleats | pleated blouse, white | PASS | - |
| 4.1.2.2.1 | Blue satin inverted-V tie tab | inverted-V tab | PASS | redrawn clean V in the mess dress rework |
| 4.1.2.2.4 | Cummerbund plain satin, without design | plain satin, no pleat lines | PASS | - |
| 4.1.2.3 | Two skirt types: primary A-line, optional straight with side split to top of knee; both ankle length | `garment-mess-dress-skirt-female-a-line`, `...-straight-split` (36 in waist-to-hem, split top 20 in below waist; lengths estimated) | FIXED | built today; half-width = jacket hem at the hem line |
| 4.1.2.3 / 4.1.2.3.1 | Women may wear the men's mess trousers or female slacks (7/8 in stripe) | no trousers asset (trousers excluded by Ethan) | OPEN | excluded: "we dont need trousers" |

## Semi-formal (4.1.3 men's new style, 4.1.4 women's)

| Para | Rule | Asset has | Status | Fix |
|---|---|---|---|---|
| 4.1.3.2.1 / 4.1.4.1 | Nametag not worn | semi-formal coats carry no `nameplate` landmark | PASS | - |
| 4.1.3.2.2 / 4.1.4.2 | Badge that would be above the nametag goes with its bottom even with the bottom of the ribbons | `ribbon_row_bottom_center` anchor (welt top) | PASS | - |
| 4.1.3.2.3 | White long-sleeve shirt, no pleated front, short/medium point collar | white shirt, plain front | PASS | - |
| 4.1.3.2.4 | Blue tie, tip covers part of the belt buckle | tie under the coat (same as Class A) | PASS | - |
| 4.1.4.3 / 4.1.4.4 | Semi-form-fitting white blouse, small pointed collar; inverted-V tie tab mandatory | white blouse, tie tab | PASS | - |
| 4.1.3.1 | Old-style semi-formal | not built (old style phased out) | OPEN | excluded by Ethan: "we dont need old style" |

## Class A service dress, new style (4.1.5 men's, 4.1.9 women's)

| Para | Rule | Asset has | Status | Fix |
|---|---|---|---|---|
| 4.1.5.2 / 4.1.9.2 | 3 buttons, 1 welt pocket upper left, 2 lower pocket flaps | 3 buttons 7/8 in; welt on wearer's left (image right); 2 flaps | PASS | - |
| 4.1.5.2 / 4.1.9.2 | Officers epaulets, NCOs none | base coat has none; senior officer layer adds epaulets, NCO layer does not | PASS | - |
| 4.1.5.2 / 4.1.9.2 | Braid 1/2 in (GO 1 1/2 in) 3 in from the end of the sleeve | senior layer: nearest edge 3.0 in from cuff, widths 0.5 / 1.5 true size on the women's (scaled) coat too | PASS | - |
| 4.1.5.2 | Bottom of coat 3-3.5 in below top of thigh; sleeves 1/4-1/2 in below wrist | no thigh/wrist in box | NOT-DRAWN | - |
| 4.1.5.2.1.1 / 4.1.9.3.1 | Embroidered grade on gray epaulet sleeve | `...-senior-officer` gray epaulet sleeves, `rank_slot_*` 5/8 in from the outer end | PASS | - |
| 4.1.5.2.1.3 / 4.1.9.3.4 | Cadet officer boards, regular size grade, on the epaulet / epaulet area | `...-cadet-officer-insignia`: board 4.55 x 1.84 in | PASS | men's board landmarks were NaN, now exposed (`epaulet_*` rects) |
| 4.1.5.2.1.4 / 4.1.9.3.5 | Cadet NCO/airman chevrons on both lapels, halfway up the seam, parallel with the ground | chevron chat | OPEN | other chat |
| 4.1.5.2.2.1.1 / 4.1.9.4.1.1 | US lapel insignia halfway up the seam, "US" parallel with ground, circle for NCOs only | senior layer: US on the collar/lapel seam, circle only in the NCO layer; coat anchor `lapel_insignia_*` pointed at the lapel-edge midpoint 4.1 in lower | FIXED | coat anchors now equal the senior layer centres (men's (-2.78, 4.08)/(3.05, 4.08), women's (-3.71, 3.38)/(3.62, 3.38) in) |
| 4.1.5.2.2.1.2 / 4.1.9.4.1.2 | CAP lapel insignia for cadet officers, same place | `lapel_cap_*` at the same point | PASS | men's `lapel_cap` rect was garbage, now exposed |
| 4.1.5.2.2.2 / 4.1.9.4.2 | Nametag on wearer's right, centred between sleeve seam and lapel | plate centre 764 uu (men's), 806 uu (women's) vs midpoint of seam/lapel within 0.2 in | PASS | - |
| 4.1.5.2.2.2 / 4.1.9.4.2 | Bottom of nametag even with the bottom of ribbons (ribbons rest on welt) | plate bottom 0.09 in (men's) / 0.05 in (women's) below the welt top | FIXED | plate bottom = welt top exactly (also with the 0.88 scale) |
| 4.1.5.2.2.2.1 | Officer/NCO tag silver, blue engraving; cadets blue three-line white | `...-nametag-officer-nco` silver, `...-nametag-cadet` blue | PASS | - |
| (cross-chat) | Nameplate plate 3.375 x 0.75 in | silver tag was 3.0 x 0.7 in, no plate cited | FIXED | silver plate now 3.375 x 0.75 in (cadet/gray already) |
| 4.1.5.2.2.3 / 4.1.9.4.3 | Ribbons centred, resting on the welt edge | anchor `ribbon_row_bottom_center` only | FIXED | landmark `ribbon_slot` 4.125 x 1.5 in, bottom on the welt top, centred on the welt (true size on the 0.88-scaled coat) |
| 4.1.5.2.2.4 / 4.1.9.4.4 | Max four badges; positions 1/2 in above ribbons / nametag | badge slots belong to the badge chat | OPEN | other chat; anchors `ribbon_slot` and `nameplate` give the references |
| 4.1.6 | Shirt collar visible 1/4 to 1/2 in above the coat collar | blue shirt/blouse collar drawn above the coat collar as in Fig 4.6 (offset not measured) | PASS | - |

## Class B (4.1.11 men's, 4.1.12 women's)

| Para | Rule | Asset has | Status | Fix |
|---|---|---|---|---|
| 4.1.11.1.1 | Light blue shirt, two pleated pockets, convertible cuffs (long) | pockets with flap and pleat, cuff band + button on long | PASS | - |
| 4.1.11.1.1 / 4.1.12.2 | Epaulets on shirt/blouse | shoulder loops are not drawn on the base (Ethan: rank items later); invisible strap landmarks `epaulet_*` kept | NOT-DRAWN | by instruction 2026-10-13 |
| 4.1.11.1.1.1.4 / 4.1.12.2.3.5 | Cadet NCO/airman collar chevrons 1 in from and parallel to the front of the collar, centred | `collar_insignia_*` was the bbox centre of the leaf | FIXED | anchor = 1 in inside the leading edge (apex to collar point), centred; edge angle exposed as `collar_insignia_angle_deg` (assumes the leading edge = apex-to-point edge) |
| 4.1.11.1.1.2.1 | Nametag centred, resting on (not over) the right pocket edge | plate bottom = pocket top (780.2 uu), centred on pocket | PASS | - |
| 4.1.11.1.1.2.2 | Ribbons centred on the left pocket edge | `ribbon_row_bottom_center` | FIXED | landmark `ribbon_slot` 4.125 x 1.5 in on the left pocket top |
| 4.1.11.1.1.3 | Tie with long sleeve, optional short; tip covers part of the buckle, not below | long tie bottom y 20.30 in inside buckle 19.13-20.48 in; short has no tie | PASS | - |
| 4.1.11.1.1.5 | Belt silver tip extends beyond buckle toward wearer's left, no blue between | tip on image right (wearer's left), adjacent | PASS | - |
| 4.1.11.1.1.5 / 4.1.12.7 | General officers: Wing and Star on the buckle | no GO buckle layer | FIXED | `...-general-officer-buckle` overlays for the four Class B garments (men's short/long, women's short/long), registered to the garment box; the belt is hidden under the Class A coat so no coat-box layer exists |
| 4.1.12.2 | Long blouse rounded cuffs with buttonhole closure | cuff band + button circle | PASS | - |
| 4.1.12.2.1 / 4.1.12.2.2 | Two blouse styles (tuck-in tapered, semi-form princess line) | one blouse drawn per sleeve length | NOT-DRAWN | not needed (coordination chat 2026-10-13) |
| 4.1.12.2.4.1 | Nametag centred, within 1 1/2 in higher/lower of the first exposed button, wearer's right | centre was 1.875 in below button 1 | FIXED | centre 1.5 in below button 1 (also long sleeve + overlays) |
| 4.1.12.2.4.2 | Ribbons centred on wearer's left, bottom aligned with bottom of nametag | `ribbon_row_bottom_center` was on the SAME (right) side as the nametag | FIXED | mirrored to wearer's left at the nametag bottom; `ribbon_slot` added |
| 4.1.12.4 | Inverted-V tie tab with long sleeve, optional short | long blouse has the tab, short does not | PASS | - |
| 4.1.12.7 | Belt tip extends toward wearer's right | tip on image left | PASS | - |
| 4.1.12.6 | Skirt no shorter than top of kneecap, no longer than bottom | cropped by the base image | NOT-DRAWN | - |
| 4.1.11.1.1 / 4.1.12.2 | Long sleeves end 1/4-1/2 in below the wrist | cuff drawn, women's arm shortened 5.9 in so shoulder-to-cuff is 1.5 in less than men's (earlier today) | PASS | - |

| DAFI 4.5.1.1.1 | Grade insignia centred 5/8 in from the end of the epaulet; largest form is the Major General 1 in star pair (2.2 x 1.2 in) (Class B officer / cadet officer epaulet sleeves) | slot 1.25 x 1.55 in | FIXED | slot 2.3 in along (starts 0.1 in in from the outer end) x 1.55 in across inside the sleeve; `rank_slot_*_frame` {deg, along, across}; the 5/8 in rule point is the new anchor `rank_rule_point_*` (slot centre moves ~0.6 in, an inside-the-strap container cannot also be centred on the rule point) |
| DAFI 4.5.1.1.1 | Same, Class A epaulet sleeves (senior/general layers) | slot 1.25 x width less 0.2 in | FIXED | men's 2.3 in along x about 1.6 in across; women's (0.88 scale) 2.3 x about 1.4 in; new anchors `rank_rule_point_*` at 5/8 in |
| 4.1.1.1.1.1 / 4.1.2.1.1.1 | Mess dress board stacked Maj Gen bullion on the silver centre between the 1/2 in braids | slot 1.5 x 1.0 in | FIXED | 2.0 x 1.2 in (the full 1.2 in silver centre; Maj Gen stack 1.81 in) |
| 4.1.5.2.1.3 / 4.1.9.3.4 | Cadet officer boards carry regular-size metal grade (Capt/Col 2.25 in wide, Maj/Lt Col 1.25 in tall) | slot 1.5 x 1.2 in | FIXED | `rank_slot_*` 2.3 x 1.3 in centred on the 4.55 in board (women's true size on the 0.88-scaled coat) |

## Senior layers

| Para | Rule | Asset has | Status | Fix |
|---|---|---|---|---|
| 4.1.5.2 | Officer: epaulets + gray sleeves + US insignia + 1/2 in braid | `...-senior-officer` | PASS | - |
| 4.1.5.2 | General officer: 1 1/2 in braid | `...-general-officer` | PASS | - |
| 4.1.5.2.2.1.1 | NCO: US with circle, no epaulets | `...-senior-nco-lapel` | PASS | - |

## Totals

Counted by status over the table rows above.

PASS 43, FIXED 18, NOT-DRAWN 9, OPEN 6 (total 76 rules).
