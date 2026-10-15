# Corporate blues regulation audit (CAPR 39-1 4.2.1-4.2.6, ICL 25-02), 2026-10-13

Status key: PASS = asset already matches; FIXED = failed, fixed at generator level this pass; OPEN = cannot be settled from the regulation text / sources; N/D = not drawn (no landmark or art needed or possible).

| # | paragraph | rule | what the asset has | status | fix / note |
|---|---|---|---|---|---|
| 1 | 4.2.3.1 / 4.2.4.1 | single-breasted navy blazer, 2 or 3 buttons | men's 2, women's 2 gold dome buttons | PASS | |
| 2 | 4.2.3.1 | metal gold/silver/CAP buttons; cuff buttons match | gold dome on front; 3 gold cuff buttons per sleeve (both blazers) | FIXED | cuff buttons added (men's, women's) |
| 3 | 4.2.3.1 | center vent, fully lined, padded shoulders | not visible from the front | N/D | back-view features; nothing to draw in a front view |
| 4 | 4.2.3.1 / 4.2.4.1 | notched lapels | both blazers have notched lapels | PASS | |
| 5 | 4.2.3.1 | two front flap pockets and a left breast pocket | men's: two flap pockets + welt breast pocket; women's: two flap pockets + welt breast pocket | PASS | |
| 6 | 4.2.4.1 | no patch pockets | women's blazer drew U-shaped pocket-body outlines that read as patch pockets | FIXED | outlines removed; flaps only |
| 7 | 4.2.3.1.1.1 | CAP Crest on the centre of the left breast pocket (4.2.4: on the pocket or the same relative position) | men's: crest centred on the welt pocket (was below it); women's: crest at the pocket | FIXED | men's crest moved onto the pocket; `crest_center` follows |
| 8 | (size) | crest size | not in the regulation text or the Vanguard crest listings (only the nameplate crest is given: 5/8 in tall). Blazer crest and standalone crest were 4.2 / 2.9 in | OPEN (estimated) | all three pocket crests are now 2.9 in tall (estimate); nameplate crest set to 0.625 in per Vanguard CAP blazer-plate crest listing (5/8 in) |
| 9 | 4.2.3.1.1.1 / 4.2.4.1.1.1 | CSAG / Command Council / National Board / NEC badge in place of the crest | `crest_center` anchor on both blazers; the badges are separate enamel assets | PASS | |
| 10 | 4.2.3.1.1.2 | nametag top edge aligned with top edge of the left breast pocket | men's `nameplate_slot` top = welt pocket top | PASS | |
| 11 | 4.2.4.1.1.2 | slanted pocket: nametag aligned straight across from the pocket's inside edge | women's welt is slanted; slot top was at the pocket's upper end | FIXED | slot top moved to the inside (lower) end of the welt |
| 12 | 4.2.3.1.1.2 | black nametag with CAP Crest, grade (adult only), last name, state/region | `nameplate-blazer-adult` / `-cadet`: black, crest, name + state slots, grade slot adult only, 3.375 x 0.9 in | PASS | |
| 13 | (Vanguard) | crest on the blazer plate | plate crest was 0.72 in | FIXED | 0.625 in (5/8 in tall, Vanguard blazer-plate crest) |
| 14 | 4.2.3.1.1.3 | chaplain badge 1/2 in above the nametag | `chaplain_badge_above_nametag` anchor, 0.5 in above the slot top | PASS | |
| 15 | 4.2.3.1.1.4 | one lapel pin on either lapel | no slot | FIXED | `lapel_pin_slot_left/right` landmarks (0.5 x 0.5 in) and `lapel_pin_*_center` anchors on both blazers |
| 16 | 4.2.1.4 / 4.2.2.4 (ICL 25-02) | miniature medals centred above the pocket, bottom 1/2 in above the crest | no slot | FIXED | `medal_slot` landmark (3.4 x 1.0 in, estimate) with its bottom 0.5 in above the crest |
| 17 | 4.2.1.5 / 4.2.2.5 | chaplain insignia 1/2 in above the top row of medals | n/a | FIXED | `chaplain_badge_semiformal` anchor 0.5 in above `medal_slot` |
| 18 | 4.2.1.1 / 4.2.2.1 | nametag not worn (semi-formal) | the slot is a landmark only; builder omits it | PASS | |
| 19 | 4.2.1.3 | black satin bow tie 5 to 5 1/2 in, <= 2 1/2 in wide, square ends | `tie-bow-black` 5.25 x 2.0 in, square ends, black | PASS | |
| 20 | 4.2.3.2.1 | aviator-style shirt: two flap pockets, straight collar, two epaulet straps, no eyelets | aviator shirts: two flap pockets, straight collar, two epaulets, no eyelets | PASS | |
| 21 | 4.2.5.1 | pocket flap straight or curved bottom; scalloped not authorized | base images have a V-shaped (pointed) flap bottom | OPEN | a single point is neither "straight" nor a scallop; Ethan accepted the base images, so left; needs a ruling if the V is not acceptable |
| 22 | 4.2.3.2.2 / 4.2.4.2.2 | turtleneck, shell, white dress shirt options; tie tab not with turtleneck/shell | `garment-underlayer-turtleneck-{male,female}`, `-shell-female` inserts; tab is a separate element | PASS | (flat original art, estimated size) |
| 23 | 4.2.4.3 / 4.2.6.3 | blue USAF-style inverted-V tie tab, self-fastening tails | `tie-tab-inverted-v` blue; tails not drawn | PASS (tails N/D) | |
| 24 | 4.2.3.4 | CAP regimental or AF blue tie | `tie-cap-regimental` existed; no AF blue tie | FIXED | `tie-af-blue` added |
| 25 | 4.2.5.1.4 | aviator uniform: CAP regimental tie NOT authorized | regimental tie is a separate extra; AF blue tie exists for it | PASS | builder must pick `tie-af-blue` |
| 26 | 4.2.3.4 / 4.2.5.1.4 | tie tack/clasp centred between the knot bottom and the tip, with CAP arms / Wing and Star / AF symbol / grade | tack assets for crest + Wing and Star; no anchor on the ties | FIXED | `tie_tack_center` anchor on both ties; AF-symbol tack OPEN (trademarked emblem, no clean source) |
| 27 | 4.2.5.1.4 | tip covers part of the buckle, not below it | ties are extras cropped at the visible tip; aviator buckle is at belt | N/D | needs the builder to place the tip; no landmark conflict |
| 28 | 4.2.3.5 / 4.2.5.1.6 / 4.2.6.6 | plain black belt, gold or silver buckle, <= 2 in | aviator belt black, silver buckle 1.8 x 1.4 in | PASS | |
| 29 | 4.2.3.3 / 4.2.4.4-5 | medium-gray trousers; skirt straight or A-line, slight flare | gray trousers (men), skirt with slight flare (women, overblouse) | PASS | skirt length (kneecap) not drawn: cropped by the box |
| 30 | 4.2.5.1.2.1 / 4.2.6.2.6.1.1 | aviator nametag gray (adult)/blue (cadet), 3-line, centred, resting on the right pocket edge | `nameplate-3line-adult/-cadet` 3.375 x 0.75 in; slot centred on the right pocket, bottom edge on its top edge | PASS | |
| 31 | 4.2.5.1.2.2 / 4.2.6.2.6.2.1 | ribbons optional, centred, resting on the left pocket edge | `ribbon_slot` 4.125 x 1.5 in centred on the left pocket, bottom edge on the pocket top; pocket 4.4 / 4.6 in wide | PASS | |
| 32 | 4.2.5.1.3.1 | first aviation/occupational badge centred 1/2 in above the top ribbon row (or the pocket), second 1/2 in above that | no anchor | FIXED | `badge_above_ribbons_center` (0.5 in above the ribbon slot) |
| 33 | 4.2.5.1.3.2 | first service/specialty badge centred on the lower part of the left pocket (between flap bottom and pocket bottom); second on the right pocket | no anchor | FIXED | `badge_left_pocket_center`, `badge_right_pocket_center` |
| 34 | 4.2.5.1.3.2 / 4.2.5.1.3.3 | third badge / command pin centred 1/2 in above the nametag; graduated commanders 1/2 in below | no anchors | FIXED | `command_pin_above_nametag_center`, `command_pin_below_nametag_center` |
| 35 | 4.2.5.1.1.1 / .4 | officers gray / cadet officers blue epaulet sleeves | epaulet landmarks on all shirts; sleeves from the rank-insignia family | PASS | |
| 36 | 4.2.5.1.1.3 | NCO 3 1/2 in chevron centred on the outer arm: halfway between shoulder seam and elbow (long) / bottom edge of sleeve (short) | no anchor | FIXED | `nco_chevron_{right,left}_center` (long: elbow at 55% of the arm, estimate) |
| 37 | 4.2.5.1.1.5 | cadet NCO/Airman metal chevrons on both collar leaves, 1 in from and parallel to the front edge, centred | no anchor | FIXED | `collar_insignia_{right,left}_center` at the collar-leaf centroid (the true 1 in setback is not exact: estimate) |
| 38 | 4.2.6.1.2 | overblouse: semi-fitted princess line, two epaulets, short or long | princess seams, two epaulets, short + long versions | PASS | |
| 39 | 4.2.6.1.2 | long sleeves: rounded cuffs with a buttonhole closure | rounded cuff corners, cuff band line, button | PASS | length "1/4 to 1/2 in below the wrist" cannot be verified (no wrist landmark): estimate |
| 40 | 4.2.6.2.6.1.2 | overblouse nametag centred on the right, even with or up to 1 1/2 in above/below the first exposed button | slot centre was 2.2 in below button 1 | FIXED | slot centre now 1.5 in below button 1 and 0.6 in below button 2 (satisfies either reading) |
| 41 | 4.2.6.2.6.2.2 | overblouse ribbons on the left between buttons and arm seam, bottom row even with the nameplate bottom | `ribbon_slot` 4.125 x 1.5 in, bottom = nameplate bottom, between placket and armhole seam | PASS | |
| 42 | 4.2.6.2.7.2 | women's badges: first centred 1/2 in above the nametag, second 1/2 in above, 1/2 in to the right; command pin above/below | no anchors | FIXED | `badge_above_nametag_center`, `command_pin_*`, `badge_left_above_ribbons_center` on the overblouse |
| 43 | 4.2.6.2.3 / .5 | NCO chevron / cadet collar chevrons (women) | no anchors on the overblouse | FIXED | `nco_chevron_*_center`, `collar_insignia_*_center` (estimates) |
| 44 | 4.2.4.1 | blazer buttoned or unbuttoned by design; lowest button normally open | drawn buttoned | N/D | |

Counts: 44 rules audited: PASS 21, FIXED 18, OPEN 2 (row 8 crest size, row 21 V-shaped flap; plus the AF-symbol tie tack inside row 26), N/D 3.
