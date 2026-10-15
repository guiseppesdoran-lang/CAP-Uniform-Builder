// Writes the regulation audit table for the flight uniforms (CAPR 39-1 ch. 8, 6.1.7) to coverage/reg-audit/flight-suit.md
const fs=require('fs'),path=require('path');
const R=[
// para, rule, asset value, status, fix/note
['8.1.2.2','Morale patches not authorized','No patch other than Command, ES slot, flag, right-sleeve slot','PASS',''],
['8.1.2.3','Sleeves rolled down to the wrist','Sleeves drawn full length to the cuff','PASS',''],
['8.1.2.4','Centerline zipper closed no lower than the middle of the nametag','Zipper drawn fully closed; anchor zipper_min_closed = nametag centre height','FIXED','anchor added (FDU, CFDU)'],
['8.1.2.5','Pen/pencil pocket cover on the left sleeve may be removed','pen_pocket_left landmark kept, listed in optional_landmarks','PASS','marked optional'],
['8.2.2','FDU is OD green Nomex; desert FDU not authorized','OD green (#6e7a58, estimate of shade)','PASS','shade is an estimate'],
['8.2.3.1 / 8.3.3.1','GO stars centred on the shoulder halfway between neck and shoulder seam; 1 in stars point-to-center (3/4 in allowed)','grade_zone_go_left/right 2.2 x 1.2 in: holds two 1 in stars side by side (largest form: major general 1 in horizontal, cloth-bordered 2.15 x 1.15; the vertical pair 1.2 x 2.06 is the same zone rotated); centre midway between collar edge and armhole seam; inside the outline','FIXED','was 1.0 x 1.0 in; sizes read from assets/insignia rank-senior-* spec size_in'],
['8.2.3.2 / 8.3.3.2','Officer grade centred on top of each shoulder, bottom edge 1/2 in from the shoulder seam','grade_zone_left/right 1.6 x 1.25 in: largest officer form (colonel eagle 1.59 wide, captain bars / major leaf 1.25 high); outer edge 0.5 in (true) from the armhole seam; inside the shoulder outline','FIXED','was 1.4 x 0.9 in'],
['8.2.3.3 / 8.3.3.3','NCOs and cadets: no grade insignia or cutouts','No zone required, nothing drawn','NOT-DRAWN','by rule'],
['8.2.4.1 / 8.3.4.1','Nametag 2 x 4 in over the left breast pocket','name_tape 400 x 200 units (2 x 4 in), wearer\'s left, centred on the chest pocket, above it','FIXED','centred over the pocket (was 0.4 in off); size already exact'],
['8.2.4.1 / 8.3.4.1','Black leather or blue cloth nametag, silver border/lettering','FDU: blue cloth with silver border; CFDU: black leather with silver border; blank','PASS','lettering is not drawn (blank by design)'],
['8.2.4.2 / 8.3.4.2','Command Patch centred above the right breast pocket, directly opposite the nametag','patch centre level with nametag, mirrored about the zip line, centred over the pocket','FIXED','centred over the pocket'],
['8.2.4.2 / Att. 6-4','Command Patch is the current design','Traced from Figure A6-4 (current design)','PASS','width 3.0 in is an ESTIMATE (OPEN, see below)'],
['8.2.4.3 / 8.3.4.3','Optional ES patch below and centred on the right breast pocket','es_patch_zone 3.0 x 3.0 in (estimate), top just under the pocket, centred on it','FIXED','was inside the pocket and 0.3 in off-centre'],
['8.2.4.4 / 8.3.4.4','Left sleeve: cloth US flag, gold border, 2 x 3 1/2 in, 1/2 in below the shoulder seam','patch_flag_left 350 x 200 units; flat view 0.5 in below the seam; main view top 0.5 in below the sleeve-top seam','FIXED','main-view flag/loop strips had been drawn ~2 in below the seam (following the figure); moved to the regulation position'],
['8.2.4.4','Flag orientation (union forward on the left sleeve)','normal flag, canton toward the front; recorded in spec flag.orientation','PASS',''],
['8.2.4.5 / 8.3.4.5','Right sleeve: authorized patch (no group/squadron/flight patches)','Right sleeve is the patch slot only: loop-tape square, no patch drawn','PASS',''],
['8.2.5.2 / 8.3.5.2','Nametag on a 2 x 4 in loop tape (OD green / black), same thread colour','Loop tape lies under the nametag at the same size: not drawn separately (hidden)','NOT-DRAWN','invisible beneath the nametag'],
['8.2.5.3 / 8.2.5.4','Loop tape cut to the shape of the Command / ES patch','Not drawn (same colour as the cloth; hidden under the patch)','NOT-DRAWN','invisible'],
['8.2.5.5 / 8.3.5.5','3 1/2 x 3 1/2 in loop tape (OD green / black) on each sleeve','Right sleeve: patch_loop_square_right 350 x 350 units, drawn; left sleeve: not drawn (Ethan: invisible, carries the flag)','PASS','colour: FDU lighter OD green for visibility (documented convention); CFDU now black'],
['8.2.5.5 / 8.3.5.5','CFDU loop tape is black','CFDU loop square #0c0d10','FIXED','was blue-grey #34384a'],
['8.2.6 / 8.3.6','Yellow and red CAP command scarf, around the neck, tucked in','Separate asset; yellow (#f1cf1c) with red tri-prop motif; apex anchor meets collar apex; scaled with the suit','PASS','motif simplified (no figure dimensions)'],
['8.2.7 / 8.3.7','Outer garment: green flight jacket (FDU); blue flight jacket among those for CFDU','garment-flight-jacket-green and -blue','PASS',''],
['8.2.7.1','Flight jacket zipped at least halfway','Drawn fully closed; anchor zipper_min_closed = mid-zip','FIXED','anchor added'],
['8.2.7.1 / 6.1.7','Command Patch, flag, grade (officers) and nametag mandatory on the jacket; configure like the FDU','All four present (patch, flag, grade zone, nametag), mirrored placement, ES zone','PASS',''],
['6.1.7 / Fig 6.6','Blue flight jacket similar to the MA-1 / CWU-45/P / -36/P in design and construction','Blue jacket uses the MA-1 cut and Medium dimensions; navy sampled from Figure 6.6, orange lining, gold zipper','FIXED','spec now cites 6.1.7 and Figure 6.6 (it had said no figure existed); colour from the figure'],
['6.1.7','Left-breast nametag, right-breast Command Patch; grade 1/2 in from the shoulder seam (GO centred)','as the green jacket','PASS',''],
['8.2.8.1 / 8.2.8.2 / 8.2.8.3','Flight cap, black knit watch cap, CAP baseball cap authorized','Headgear is not part of the garment assets','NOT-DRAWN','headgear lives in the Misc Artwork / hats assets, not this lane'],
['8.3.8','USAF-style flight cap not authorized with the CFDU','n/a (no headgear drawn)','NOT-DRAWN','rule is for the builder'],
['8.2.9 / 8.3.9','Crew-neck t-shirt, black or desert tan (black not after 1 Aug 2021 on the FDU)','FDU: desert tan; CFDU: black; crew neck','PASS',''],
['8.2.10-8.2.12 / 8.3.10-8.3.12','Socks, boots, gloves','Legs, boots and gloves are not drawn (top only)','NOT-DRAWN','nothing is sewn on them; out of the garment scope'],
['8.3.2','CFDU navy blue, similar design to the FDU','Same cut and layout, navy sampled from Figure 8.4 (#17304a)','PASS','shade from a small figure'],
['8.3.5.1','Embroidered grade: dark blue thread, 1/8 in larger than the insignia','Zone only; the 1/8 in border belongs to the grade asset','NOT-DRAWN','grade insignia are another chat'],
['Fig 8.1 / MIL-C-83141A','Suit proportions and zipper lengths','Scaled so the front zipper is 28 in (size 40R); breast zippers 6.5 in; sleeve zipper 4.75 in','PASS','one constraint on a stylised figure, see notes'],
['Fig 8.3 / MIL-J-8279G','Jacket (Medium) body length, chest, bottom, inseam, flap, pocket','22.5 / 26 / 23.5 / 16.375 in; flap 7.5 x 2.375; pocket 5.75 x 3.25','PASS','verified from the page images'],
];
const c={PASS:0,FIXED:0,'NOT-DRAWN':0};R.forEach(r=>c[r[3]]++);
const open=[
 ['Command Patch width (3.0 in)','the regulation gives no dimensions (Attachment 6-4 shows no scale)','one real patch measurement'],
 ['ES patch size (3.0 x 3.0 in) and the jacket ES position','8.2.4.3 gives position only; the jacket has no breast pocket','one real patch measurement; decide placement on the jacket'],
 ['FDU/CFDU width, sleeve girth, chest pocket panel size','MIL-C-83141A has no finished-body table; only zipper lengths','one real size-40R coverall measurement (chest flat width)'],
 ['Jacket collar and knit heights, armhole depth, shoulder width, sleeve girth','not in the MA-1 Table V','one real MA-1 Medium measurement of each'],
 ['Loop tape "on each sleeve" (8.2.5.5) vs. flag on the left','Ethan ruled: the left carries the flag, tape invisible and not drawn','none (ruled)'],
 ['Figure draws a round patch on the right sleeve','the regulation says any authorized patch; the slot is the documented 3.5 in square','none'],
];
let md=`# Flight uniform regulation audit (CAPR 39-1 ch. 8, 6.1.7)\n\nLane: FDU 8.2.x, CFDU 8.3.x, green and blue flight jackets (8.2.7.1, 6.1.7), flight scarf (8.2.6).\nAssets: \`garment-fdu-flight-suit\`, \`garment-cfdu-flight-suit\`, \`garment-flight-jacket-green\`, \`garment-flight-jacket-blue\`, \`garment-cap-command-scarf\`.\nChecked by: \`artwork-samples/base-art/audit-flight.js\` (positions, sizes, symmetry), \`render-check.js\` (renders at 20+ px/in, ink inside the box), validate-assets.js.\n\n| Paragraph | Rule | What the asset has | Status | Fix / note |\n|---|---|---|---|---|\n`;
for(const r of R)md+=`| ${r.join(' | ')} |\n`;
md+=`\n## Counts\nPASS ${c.PASS}, FIXED ${c.FIXED}, NOT-DRAWN ${c['NOT-DRAWN']}, OPEN ${open.length} (rows: ${R.length}).\n\n## OPEN items\n| Item | Why open | What settles it |\n|---|---|---|\n`;
for(const o of open)md+=`| ${o.join(' | ')} |\n`;
md+=`\n## Views shown (decision)\nEach garment image carries the front view plus a flat view of each sleeve, because Figures 8.1 / 8.3 foreshorten the sleeve patches while 8.2.4.4 and 8.2.5.5 fix their sizes and positions on the sleeve: the flat views hold the true-size flag (left), the zip/pen pocket (left) and the loop-tape slot (right). This is a presentation decision (no regulation requires it). The scarf is a separate asset (optional, 8.2.6). Everything is inside the artwork box (render-check margins >= 0.05 in).\n\n## Scale\nSee ASSET_NOTES.md (2026-10-13 blocks): jacket Medium from MIL-J-8279G Table V; suit scaled by the 28 in front-opening zipper (MIL-C-83141A Table II, size 40R). The sleeve patch sizes and positions are regulation figures, independent of that scale.\n`;
fs.writeFileSync(path.join(__dirname,'..','coverage','reg-audit','flight-suit.md'),md);
console.log(c,'open',open.length,'rows',R.length);
