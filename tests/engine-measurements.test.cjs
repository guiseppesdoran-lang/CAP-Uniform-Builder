'use strict';
// MEAS: the measurement overlay shows every distance the member (or the tailor) sets when pinning, sewing or arranging a piece,
// labelled with the regulation's value, and nothing else (Ethan: "measurements are a HUGE part. only include the relevant ones.
// like the 2x2 square isn't needed (you just buy it from Vanguard) and neither is the 4.9 inches from the collar to the square ...
// make sure all and only relevant measurements exist"; "1/8th inch of blue on the badges!"). For one representative build of each
// uniform family and cut, the exact set of labels the scene draws is stated below with the paragraph each one carries out, so
// adding or losing a measure fails here. Sizes of bought pieces (badges, tapes, patches, chevrons, the OCP 2 x 2 in square) and
// positions fixed by the maker (Velcro fields, pockets) are never measured.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const core = require('../js/engine/core.js');
const C = require('../js/engine/compose.js');
const P = require('../js/engine/profiles.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');
require('../js/engine/profiles-polo.js');
const R = require('../scripts/render-builds.cjs');

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images', 'MANIFEST.json'), 'utf8'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));

// Regulation paragraphs (CAPR 39-1 with ICL 21-01, 25-02, 25-06, 26-04).
const CITE = {
  badgeAboveRibbons: '½ in: first badge above the ribbons / medals, second above the first (4.1.5.2.2.4.1, 4.1.9.4.4.1, 4.1.11.1.1.2.3.1, 4.2.5.1.3.1, 4.1.1.1.2.2)',
  aboveNametag: '½ in: badge or command pin above the nametag (4.1.9.4.4.2, 4.1.12.2.5.2, 4.2.6.2.7.2)',
  welt: '1½ in: pocket badge below the welt top / nametag (4.1.5.2.2.4.2)',
  lapel: 'halfway: lapel insignia halfway up the gorge seam (4.1.5.2.2.1, 4.1.9.4.1)',
  sleeveChevron: 'halfway: NCO chevron between the shoulder seam and the bottom of a short sleeve, on the sleeve laid flat (4.1.11.1.1.1.3, 4.1.12.2.3.3, 4.2.5.1.1.3, 4.2.6.2.3), or on the mess dress sleeve (4.1.1.1.1.4, 4.1.2.1.1.4)',
  sleeveChevronElbow: 'halfway to elbow: NCO chevron between the shoulder seam and the elbow, on the sleeve laid flat beside the figure (4.1.5.2.1.2, 4.1.9.3.3, 4.1.11.1.1.1.3, 4.1.12.2.3.3, 4.2.5.1.1.3, 4.2.6.2.3)',
  braid: '3 in: officer sleeve braid from the end of the sleeve (4.1.5.2, 4.1.9.3, 4.1.1.1)',
  braidMessW: '2½ in: officer sleeve braid from the end of the sleeve, women\'s mess dress (4.1.2.1)',
  flightCap: '1½ in: flight cap device from the front of the cap (6.2.2.2.1-3)',
  abuCollar: '1 in: officer and cadet officer grade from the bottom of the ABU / Corporate Field Uniform collar (5.1.1.1.1.1, 5.1.1.1.1.3, 5.2.1.1.1.1, 5.2.1.1.1.4)',
  abuCollarNco: '1 in: cadet NCO and airman collar chevron from the bottom of the ABU / Corporate Field Uniform collar (5.1.1.1.1.4, 5.2.1.1.1.6)',
  collarChevron: '1 in: cadet NCO collar chevron from the front of the collar (4.1.11.1.1.1.4, 4.1.12.2.3.5)',
  pocketBadge: 'centered: badge on the lower portion of the pocket (4.1.11.1.1.2.3.2)',
  messMidway: 'midway: miniature medals between the top shoulder seam and the top button (4.1.1.1.2.2, 4.1.2.1.2.2)',
  messBelow: '½ in: men\'s mess dress badge below the medals (4.1.1.1.2.3)',
  crest: '½ in: miniature medals above the CAP crest (4.2.1.4, 4.2.2.4 with ICL 25-02)',
  chaplainSemi: '½ in: chaplain insignia above the top row of medals (4.2.1.5, 4.2.2.5)',
  chaplainBlazer: '½ in: chaplain badge above the blazer nametag (4.2.3.1.1.3, 4.2.4.1.1.3)',
  fieldBadge: '½ in: from the top of the CAP tape to the bottom of the first badge\'s embroidery, second above the first (7.1.1.3.1.1-2, 5.1.1.1.2.4, 5.2.1.1.2.6; Ethan)',
  blue: '⅛ in: blue cloth past the embroidery (7.1.1.3.1, 7.1.1.8, 5.1.1.1.1.1, 5.1.1.1.1.3, 5.1.1.1.2.4, 5.2.1.1.1.1, 5.2.1.1.1.4, 5.2.1.1.2.6, 8.3.5.1)',
  capVisor: '½ in: officer grade above the visor (7.1.1.8, ICL 25-02 6.2.11.1)',
  abuChevron: 'halfway to elbow: NCO chevron below the shoulder seam (5.1.1.1.1.2, 5.2.1.1.1.3)',
  command: '½ in: command insignia above the name tape, graduated below it (7.1.1.3.1.6, 5.1.1.1.2.5, 5.2.1.1.2.9)',
  sleevePatch: '½ in: sleeve patch below the shoulder seam (5.1.1.1.2.2, 5.2.1.1.2.2-3)',
  pocketPatch: 'centered: breast pocket patch between the flap and the pocket bottom (5.1.1.1.2.3, 5.2.1.1.2.4-5)',
  esPatch: '½ in: ES patch above the name tape or command insignia (5.2.1.1.2.8)',
  ocpUnit: 'centered: unit patch in the middle of the Velcro under the flag (7.1.1.4.1.2)',
  ocpGradCmd: 'centered: graduated commander patch on the loop (7.1.1.3.1.6)',
  ocpBase: '⅛ in: from the top of the CAP tape to the bottom of the lowest badge\'s embroidery, three or four badges (7.1.1.3.1.3-4; Ethan)',
  ocpPair: '½ in: badges side by side (7.1.1.3.1.3-4)',
  ocpStack: '¼ in: between stacked badges (7.1.1.3.1.3-4)',
  boardSeam: 'on the seam: the Class A cadet officer shoulder board along the shoulder seam (4.1.5.2.1.3, 4.1.9.3.4; 2 November 2026)',
  cordUnder: 'under the board: the shoulder cord starts under the board, on the seam (9.3, 9.3.4; 2 November 2026)',
  ocpSquare: 'centered: the grade square in the center of the chest between the pockets (7.1.1.2.1, 7.1.1.2.2)',
  fduGrade: '½ in: officer grade from the shoulder seam (8.2.3.2, 8.3.3.2)',
  esCentered: 'centered: ES patch centred on the right breast pocket (8.2.4.3, 8.3.4.3; LIVE9-4)',
  fduFlag: '½ in: U.S. flag below the shoulder seam (8.2.4.4, 8.3.4.4)',
  nametagCentred: 'centered: the Class A nametag centred on the wearer\'s right between the sleeve seam and the lapel, along its bottom edge (4.1.5.2.2.2.1-2, 4.1.9.4.2.1-2; LIVE13 E76)',
  nametagEven: 'even with: the men\'s Class A nametag bottom even with the bottom of the ribbons (4.1.5.2.2.2.1-2; LIVE13 E76)',
  nametagParallel: 'parallel with: the women\'s Class A nametag bottom parallel with the bottom of the ribbons (4.1.9.4.2.1-2; LIVE13 E76)',
  semiEven: 'even with: on the cadet semi-formal (no nametag) the badge or badges in the nametag\'s place, bottom even with the bottom of the ribbons (4.1.3.2.2, 4.1.4.2; LIVE13 E80)',
  semiLevel: 'level with: on the men\'s cadet semi-formal the wearer\'s right pocket badge keeps its service dress place, level with the left pocket badge (4.1.3.2.2, 4.1.5.2.2.4.2; LIVE13 E80)',
  poloOverName: '½ in: the one badge or duty title over the name, from the top of the name to the bottom of the badge or title (5.3.2.1.1)',
  // LIVE13 E99 (Ethan, on the Class B with the overlay on: "also these need measurements"): how the nameplate and the ribbon rack sit on their pockets.
  rackWelt: 'centered: ribbons centred, resting on (but not over) the edge of the welt pocket (4.1.5.2.2.3, 4.1.9.4.3; the cadet semi-formal worn as the service dress, 4.1.3.2, 4.1.4; LIVE13 E99)',
  plateRests: 'centered: the Class B nametag centred, resting on, but not over the edge of the pleated pocket on the wearer\'s right (4.1.11.1.1.2.1, 4.1.8.2.1; LIVE13 E99)',
  rackRests: 'centered: the Class B ribbons centred, resting on, but not over the edge of the pleated pocket on the wearer\'s left (4.1.11.1.1.2.2, 4.1.8.2.2; LIVE13 E99)',
  plateButton: '1½ in: the women\'s Class B and overblouse nametag centred, even with to 1 1/2 in higher or lower than the first exposed button, as the sheets set it (4.1.12.2.4.1, 4.2.6.2.6.1.2; LIVE13 E99)',
  rackPlateEven: 'even with: the bottom of the ribbons aligned with the bottom of the nametag (4.1.12.2.4.2 women\'s Class B, 4.2.6.2.6.2.2 overblouse; on the aviator shirt the nametag and the ribbons each rest on their pocket, 4.2.5.1.2.1-2, 4.2.6.2.6.1.1, 4.2.6.2.6.2.1, which the sheets hold as the rack\'s bottom on the nameplate\'s bottom line; LIVE13 E99)',
  plateTopEven: 'even with: the blazer nametag\'s top edge aligned with the top edge of the left breast pocket (4.2.3.1.1.2, 4.2.4.1.1.2; LIVE13 E99)'
};
const L = key => CITE[key].split(':')[0];

// [build name, [cite keys, one per measure drawn]]
const TABLE = [
  ['blues_a-male-senior-Capt', ['braid', 'badgeAboveRibbons', 'welt', 'lapel', 'lapel', 'flightCap', 'rackWelt', 'nametagCentred', 'nametagEven']],
  ['blues_a-male-cadet-C-Maj', ['boardSeam', 'cordUnder', 'badgeAboveRibbons', 'welt', 'lapel', 'lapel', 'flightCap', 'rackWelt', 'nametagCentred', 'nametagEven']],
  ['blues_a-female-senior-SMSgt', ['sleeveChevronElbow', 'badgeAboveRibbons', 'aboveNametag', 'lapel', 'lapel', 'flightCap', 'rackWelt', 'nametagCentred', 'nametagParallel']],
  ['blues_a-female-senior-MajGen', ['braid', 'badgeAboveRibbons', 'aboveNametag', 'lapel', 'lapel', 'flightCap', 'rackWelt', 'nametagCentred', 'nametagParallel']],
  ['blues_b-male-cadet-C-SSgt', ['collarChevron', 'collarChevron', 'badgeAboveRibbons', 'pocketBadge', 'flightCap', 'plateRests', 'rackRests']],
  ['blues_b-male-senior-SMSgt', ['sleeveChevron', 'badgeAboveRibbons', 'pocketBadge', 'flightCap', 'plateRests', 'rackRests']],
  ['blues_b-female-senior-SMSgt', ['sleeveChevron', 'badgeAboveRibbons', 'aboveNametag', 'flightCap', 'plateButton', 'rackPlateEven']],
  ['mess_dress-male-senior-Col', ['braid', 'messMidway', 'badgeAboveRibbons', 'messBelow']],
  ['mess_dress-female-senior-Capt', ['braidMessW', 'messMidway', 'badgeAboveRibbons']],
  ['mess_dress-female-senior-SMSgt', ['sleeveChevron', 'messMidway', 'badgeAboveRibbons']],
  ['semi_formal-male-senior-Capt', ['chaplainSemi']],
  ['semi_formal-female-senior-Col', ['crest', 'chaplainSemi']],
  ['semi_formal_usaf-male-cadet-C-SSgt', ['badgeAboveRibbons', 'welt', 'lapel', 'lapel', 'rackWelt']],
  ['semi_formal_usaf-female-cadet-C-Maj', ['boardSeam', 'badgeAboveRibbons', 'lapel', 'lapel', 'rackWelt', 'semiEven']],
  ['aviator-male-senior-SMSgt', ['sleeveChevron', 'badgeAboveRibbons', 'rackPlateEven']],
  ['aviator-female-senior-Capt', ['badgeAboveRibbons', 'aboveNametag', 'rackPlateEven']],
  ['aviator_blazer-male-senior-Capt', ['chaplainBlazer', 'plateTopEven', 'badgeAboveRibbons']],
  ['aviator_blazer-female-senior-Col', ['chaplainBlazer', 'badgeAboveRibbons']],
  ['ocp-male-senior-Capt', ['ocpSquare', 'capVisor', 'blue', 'fieldBadge', 'fieldBadge', 'blue']],
  ['ocp-female-cadet-C-SSgt', ['ocpSquare', 'fieldBadge', 'fieldBadge', 'blue']],
  ['ocp-male-senior-SMSgt', ['ocpSquare', 'fieldBadge', 'fieldBadge', 'blue']],
  ['abu-male-senior-Capt', ['abuCollar', 'blue', 'fieldBadge', 'fieldBadge', 'blue']],
  // the cadet officers' cloth is drawn at the family's factor on these leaves, so it shows no 1/8 in of blue and none is drawn on the collar
  ['abu-male-cadet-C-Maj', ['abuCollar', 'fieldBadge', 'fieldBadge', 'blue']],
  ['abu-male-cadet-C-SSgt', ['abuCollarNco', 'fieldBadge', 'fieldBadge', 'blue']],
  ['abu-female-senior-SMSgt', ['abuChevron', 'fieldBadge', 'fieldBadge', 'blue']],
  ['corporate_field-male-senior-SMSgt', ['abuChevron', 'fieldBadge', 'fieldBadge', 'blue']],
  ['corporate_field-female-senior-Capt', ['abuCollar', 'blue', 'fieldBadge', 'fieldBadge', 'blue']],
  ['flight_suit-male-senior-Capt', ['fduGrade', 'fduFlag', 'flightCap']],
  ['flight_suit-male-senior-MajGen', ['fduFlag', 'flightCap']],
  ['x-flight_suit-male-Capt-es', ['fduGrade', 'fduFlag', 'flightCap', 'esCentered']],
  ['x-corporate_flight_suit-female-SMSgt-es', ['fduFlag', 'esCentered']],
  ['flight_suit-female-cadet-C-SSgt', ['fduFlag', 'flightCap']],
  ['corporate_flight_suit-male-senior-Col', ['fduGrade', 'blue', 'fduFlag']],
  ['corporate_flight_suit-female-senior-SMSgt', ['fduFlag']],
  // Builds with patches, command insignia and more badges than the standard matrix wears.
  ['x-ocp-male-Capt-patches-gradcmd', ['ocpSquare', 'capVisor', 'blue', 'fieldBadge', 'fieldBadge', 'blue', 'ocpGradCmd', 'ocpUnit']],
  ['x-ocp-male-Capt-4badges', ['ocpSquare', 'capVisor', 'blue', 'ocpBase', 'ocpPair', 'ocpStack', 'ocpStack', 'blue']],
  ['x-abu-male-Capt-patches-cmd', ['abuCollar', 'blue', 'fieldBadge', 'fieldBadge', 'blue', 'command', 'sleevePatch', 'pocketPatch']],
  ['x-abu-male-Capt-gradcmd', ['abuCollar', 'blue', 'fieldBadge', 'fieldBadge', 'blue', 'command']],
  ['x-cfu-male-Capt-patches-es', ['abuCollar', 'blue', 'fieldBadge', 'fieldBadge', 'blue', 'command', 'sleevePatch', 'sleevePatch', 'pocketPatch', 'pocketPatch', 'esPatch']],
  ['x-semi-female-Col-chaplain', ['crest', 'chaplainSemi']],
  // The long sleeves and the coats have an elbow; the flat sleeves beside the figure carry the distance (SLEEVE-ENG), one per build.
  ['blues_a-male-senior-SMSgt', ['sleeveChevronElbow', 'badgeAboveRibbons', 'welt', 'lapel', 'lapel', 'flightCap', 'rackWelt', 'nametagCentred', 'nametagEven']],
  ['x-blues_b-male-long-SMSgt', ['sleeveChevronElbow', 'badgeAboveRibbons', 'pocketBadge', 'flightCap', 'plateRests', 'rackRests']],
  ['x-blues_b-female-long-SMSgt', ['sleeveChevronElbow', 'badgeAboveRibbons', 'aboveNametag', 'flightCap', 'plateButton', 'rackPlateEven']],
  ['x-aviator-male-long-SMSgt', ['sleeveChevronElbow', 'badgeAboveRibbons', 'rackPlateEven']],
  ['x-aviator-female-long-SMSgt', ['sleeveChevronElbow', 'badgeAboveRibbons', 'aboveNametag', 'rackPlateEven']],
  ['x-overblouse-short-SMSgt', ['sleeveChevron', 'badgeAboveRibbons', 'aboveNametag', 'plateButton', 'rackPlateEven']],
  ['x-overblouse-long-SMSgt', ['sleeveChevronElbow', 'badgeAboveRibbons', 'aboveNametag', 'plateButton', 'rackPlateEven']],
  // The polo (5.3): the 1/2 in over the name is its only distance, on every cut and both the badge and the title; nothing on the printed shirt (5.3.2.1.2).
  ['polo-male-senior-Capt', ['poloOverName']],
  ['polo-female-senior-SMSgt', ['poloOverName']],
  ['polo-male-senior-Col', ['poloOverName']],
  ['x-polo-female-long-title', ['poloOverName']],
  ['x-polo-male-tactical-badge', ['poloOverName']],
  ['x-polo-male-print', []]
];

const UNIT = { id: 'sequoyah_cadet_squadron_patch', title: 'Unit', href: 'images/patches/sequoyah_cadet_squadron_patch.webp', aspect: 1, slot: 'R_SHOULDER', kind: 'unit' };
const WING = { id: 'nywg_patch', title: 'Wing', href: 'images/patches/nywg_patch.webp', aspect: 1, slot: 'L_SHOULDER', kind: 'general', echelon: 'wing' };
const ACT = { id: 'nywg_patch', title: 'Activity', href: 'images/patches/nywg_patch.webp', aspect: 1, slot: 'R_SHOULDER', kind: 'general' };
const POCKET = { id: 'nywg_patch', title: 'Pocket', href: 'images/patches/nywg_patch.webp', aspect: 1, slot: 'CHEST_LEFT', kind: 'general' };
const CMD = { id: 'squadron_commander_badge', title: 'Squadron Commander' };
const GRAD = Object.assign({ graduated: true }, CMD);

const MATRIX = R.matrix().builds;
function spec(name){
  const from = (base, extra) => {
    const b = MATRIX.find(x => x.name === base);
    assert.ok(b, base + ' in the standard matrix');
    const out = JSON.parse(JSON.stringify(b.build));
    return Object.assign(out, extra, extra.opt ? { opt: Object.assign({}, out.opt, extra.opt) } : {});
  };
  switch(name){
    case 'x-ocp-male-Capt-patches-gradcmd': return from('ocp-male-senior-Capt', { patches: [UNIT, WING], command: GRAD });
    case 'x-ocp-male-Capt-4badges': return from('ocp-male-senior-Capt', { badgeIds: ['CAPPilot1_FA9D33EA587D8', 'ground_team_basic_badge', 'senior_ground_team_badge', 'basic_incident_commander_badge'] });
    case 'x-abu-male-Capt-patches-cmd': return from('abu-male-senior-Capt', { patches: [UNIT, WING], command: CMD });
    case 'x-abu-male-Capt-gradcmd': return from('abu-male-senior-Capt', { command: GRAD });
    case 'x-cfu-male-Capt-patches-es': return from('corporate_field-male-senior-Capt', { patches: [UNIT, WING, ACT, POCKET], command: CMD, opt: { esPatch: 'style-1' } });
    case 'x-flight_suit-male-Capt-es': return from('flight_suit-male-senior-Capt', { opt: { esPatch: 'style-1' } });
    case 'x-corporate_flight_suit-female-SMSgt-es': return from('corporate_flight_suit-female-senior-SMSgt', { opt: { esPatch: 'style-2' } });
    case 'x-semi-female-Col-chaplain': return from('semi_formal-female-senior-Col', { badgeIds: ['christian_chaplin'] });
    case 'x-blues_b-male-long-SMSgt': return from('blues_b-male-senior-SMSgt', { opt: { sleeve: 'long' } });
    case 'x-blues_b-female-long-SMSgt': return from('blues_b-female-senior-SMSgt', { opt: { sleeve: 'long' } });
    case 'x-aviator-male-long-SMSgt': return from('aviator-male-senior-SMSgt', { opt: { sleeve: 'long' } });
    case 'x-aviator-female-long-SMSgt': return from('aviator-female-senior-SMSgt', { opt: { sleeve: 'long' } });
    case 'x-polo-female-long-title': return from('polo-female-senior-Capt', { opt: { sleeve: 'long', poloMark: 'title', dutyTitle: 'Squadron Commander' } });
    case 'x-polo-male-tactical-badge': return from('polo-male-senior-Capt', { opt: { poloShirt: 'tactical' } });
    case 'x-polo-male-print': return from('polo-male-senior-Capt', { opt: { poloShirt: 'print' } });
    case 'x-overblouse-short-SMSgt': return from('aviator-female-senior-SMSgt', { opt: { sleeve: 'short', femaleTop: 'overblouse' } });
    case 'x-overblouse-long-SMSgt': return from('aviator-female-senior-SMSgt', { opt: { sleeve: 'long', femaleTop: 'overblouse' } });
    default: return from(name, {});
  }
}
const measuresOf = async name => (await P.composeUniform(R.makeBuild(spec(name)), store)).layers.filter(l => l.type === 'measure');
const sorted = a => [...a].sort();

for(const [name, keys] of TABLE){
  test(`${name}: the overlay draws exactly the regulation's distances (${[...new Set(keys)].map(k => CITE[k].replace(/^[^(]*\(/, '(')).join(' ')})`, async () => {
    const ms = await measuresOf(name);
    assert.deepEqual(sorted(ms.map(m => m.label)), sorted(keys.map(L)), name);
  });
}

test('every table entry names a cited paragraph', () => {
  for(const [, keys] of TABLE) for(const k of keys) assert.ok(CITE[k] && /\(\d/.test(CITE[k]), k);
});

test('an inch label is the drawn distance (the sleeve braid, measured to the drawn braid, within 0.15 in), a word label marks a position', async () => {
  const WORDS = new Set(['centered', 'halfway', 'halfway to elbow', 'midway', 'even with', 'parallel with', 'on the seam', 'under the board']);
  for(const [name] of TABLE){
    for(const m of await measuresOf(name)){
      if(WORDS.has(m.label)) continue;
      const len = Math.hypot(m.to.x - m.from.x, m.to.y - m.from.y);
      const tol = /^(3|2½) in$/.test(m.label) ? 0.15 : 0.01;
      const want = Number(m.label.replace(' in', '').replace('½', '.5').replace('¼', '.25').replace('⅛', '.125').replace(/^\./, '0.'));
      assert.ok(Math.abs(len - want) <= tol, `${name}: ${m.label} drawn ${len.toFixed(3)} in`);
    }
  }
});

test('no bought size or factory position is measured: no 2 in square, no approximate drop, no patch, chevron or tape width', async () => {
  for(const name of ['ocp-male-senior-Capt', 'ocp-male-senior-SMSgt', 'x-ocp-male-Capt-patches-gradcmd', 'x-cfu-male-Capt-patches-es', 'abu-female-senior-SMSgt', 'corporate_field-male-senior-SMSgt']){
    const labels = (await measuresOf(name)).map(m => m.label);
    for(const bad of ['2 in', '3½ in', '4 in', '3 in']) assert.ok(!labels.includes(bad), `${name}: ${bad}`);
    assert.ok(!labels.some(l => /^about /.test(l)), `${name}: no approximate measure`);
  }
});

test('the 1/8 in border lies on the piece, from its blue edge in to the embroidery, on the highest chest badge', async () => {
  const scene = await P.composeUniform(R.makeBuild(spec('abu-male-senior-Capt')), store);
  const borders = scene.layers.filter(l => l.type === 'measure' && l.label === '⅛ in');
  const top = scene.layers.filter(l => l.role === 'badge').reduce((a, l) => (l.y < a.y ? l : a));
  assert.ok(borders.some(m => Math.abs(m.from.y - top.y) < 1e-4 && Math.abs(m.to.y - top.y - 0.125) < 1e-4 && Math.abs(m.from.x - (top.x + top.w / 2)) < 1e-4), 'top edge of the highest badge');
  const collar = scene.layers.find(l => l.key === 'grade:right');
  const b = core.layerBounds(collar);
  assert.ok(borders.some(m => m.from.x >= b.x - 1e-6 && m.from.x <= b.x + b.w + 1e-6 && m.from.y >= b.y - 1e-6 && m.from.y <= b.y + b.h + 1e-6), 'on the collar grade');
  assert.equal(C.inchesLabel(0.125), '⅛ in');
});

// LIVE13 E76 (Ethan: "for class a's specifically it needs to measure the nametag as well"). CAPR 39-1 4.1.5.2.2.2.1-2 (men) and 4.1.9.4.2.1-2
// (women): "The nametag will be centered on the wearer's right between the sleeve seam and lapel and the bottom of nametag will be parallel
// with the ground and even with bottom of ribbons" (the women's: "parallel with bottom of ribbons"). The 'centered' line runs from the sleeve
// seam to the lapel's edge along the tag's bottom, its tick at the tag's centre; the level line joins the tag's inner bottom corner and the
// rack's outer bottom corner.
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a.toFixed(4)} vs ${b.toFixed(4)}`);
const crossingsAt = (pts, y, closed) => {
  const xs = [];
  for(let i = 0; i < (closed ? pts.length : pts.length - 1); i++){
    const p = pts[i], q = pts[(i + 1) % pts.length];
    if(p.y !== q.y && (p.y - y) * (q.y - y) <= 0) xs.push(p.x + (q.x - p.x) * (y - p.y) / (q.y - p.y));
  }
  return xs;
};
for(const [name, sex, word] of [['blues_a-male-senior-Capt', 'male', 'even with'], ['blues_a-male-cadet-C-Maj', 'male', 'even with'], ['blues_a-female-senior-SMSgt', 'female', 'parallel with'], ['blues_a-female-senior-MajGen', 'female', 'parallel with']]){
  test(`${name}: the nametag measures: centred between the sleeve seam and the lapel at its bottom edge, bottom ${word} the ribbons' bottom (4.1.5.2.2.2, 4.1.9.4.2)`, async () => {
    const scene = await P.composeUniform(R.makeBuild(spec(name)), store);
    const coatId = sex === 'male' ? 'garment-blues-class-a-coat' : 'garment-blues-class-a-coat-female';
    const coat = await store.load(coatId);
    const tagLayer = scene.layers.find(l => l.type === 'asset' && /-nametag-(cadet|officer-nco)$/.test(l.id || ''));
    const sheetTag = core.landmarkBounds(await store.load(tagLayer.id), 'nametag');
    const tag = Object.assign({}, sheetTag, { x: sheetTag.x + tagLayer.x });
    const bottom = tag.y + tag.h, centre = tag.x + tag.w / 2;
    const ms = scene.layers.filter(l => l.type === 'measure');
    // The rack's own 'centered' line on the welt (LIVE13 E99) is another measure: the nametag's is the one captioned with it.
    const c = ms.find(m => m.label === 'centered' && m.opts && /nameplate/.test(m.opts.caption));
    assert.ok(c, 'the centred measure');
    // Along the tag's bottom edge.
    near(c.from.y, bottom, 1e-6, 'seam end at the tag bottom'); near(c.to.y, bottom, 1e-6, 'lapel end at the tag bottom');
    // The lapel end is the wearer's right lapel's outer edge at that height (the sheet's lapel_right, the crossing nearest the arm).
    near(c.to.x, Math.min(...crossingsAt(core.landmark(coat, 'lapel_right').points, bottom, true)), 1e-6, 'lapel edge');
    // The seam end is the armhole seam the cord overlays state (wearer's left), mirrored to the wearer's right and fitted to the armpit: within
    // 0.4 in of the stated line, outboard of the tag.
    const cord = core.landmark(await store.load(coatId + '-cord-group'), 'cord').points;
    const cx = core.anchor(coat, 'top_center').x;
    const stated = crossingsAt(cord.map(p => ({ x: 2 * cx - p.x, y: p.y })), bottom, false)[0];
    assert.ok(Math.abs(c.from.x - stated) < 0.4, `seam ${c.from.x.toFixed(3)} near the stated seam ${stated.toFixed(3)}`);
    assert.ok(c.from.x < tag.x && c.to.x > tag.x + tag.w, 'the tag lies between seam and lapel');
    // Centred: the tag centre is the midpoint, and the tick marks it.
    near(centre, (c.from.x + c.to.x) / 2, 0.02, 'tag centre = midpoint of seam and lapel');
    near(c.opts.mid.x, centre, 1e-6, 'tick at the tag centre');
    // The bottoms level.
    const e = ms.find(m => m.label === word);
    assert.ok(e, word);
    const rack = scene.layers.filter(l => l.role === 'ribbon');
    const rackBottom = Math.max(...rack.map(l => l.y + l.h)), rackLeft = Math.min(...rack.map(l => l.x));
    near(rackBottom, bottom, 0.02, 'tag bottom = rack bottom');
    near(e.from.x, tag.x + tag.w, 1e-6, 'from the tag\'s inner end'); near(e.from.y, bottom, 1e-6, 'at the tag\'s bottom');
    near(e.to.x, rackLeft, 0.02, 'to the rack\'s outer end'); near(e.to.y, rackBottom, 0.02, 'at the rack\'s bottom');
  });
}

test('the Class A nametag with no ribbons: the centred measure stays, the level line is omitted and a note says why; the semi-formal (no nametag) has neither', async () => {
  const noRibbons = Object.assign(spec('blues_a-male-senior-Capt'), { ribbonSel: [] });
  const scene = await P.composeUniform(R.makeBuild(noRibbons), store);
  const labels = scene.layers.filter(l => l.type === 'measure').map(m => m.label);
  assert.ok(labels.includes('centered'));
  assert.ok(!labels.includes('even with'));
  assert.ok(scene.notes.some(n => /no ribbon bottom to show the nametag's bottom even with/.test(n)), scene.notes.join(' | '));
  for(const name of ['semi_formal_usaf-male-cadet-C-SSgt', 'semi_formal_usaf-female-cadet-C-Maj']){
    const ms = await measuresOf(name);
    assert.ok(!ms.some(m => m.label === 'parallel with') && !ms.some(m => m.label === 'centered' && /nameplate/.test(m.opts.caption)), name);
  }
});

// LIVE13 E80 (Ethan: "measurement from the semiformals bases a badge off of a nameplate that isnt there lmao"). CAPR 39-1 4.1.3.2.1, 4.1.4.1:
// "Nametag. Not worn." 4.1.3.2.2: "If a specialty track badge would be worn ½ inch above the nametag on the service dress uniform, the bottom of
// that badge will be even with the bottom of ribbons. All other badges are worn in the same places as on the service dress uniform." 4.1.4.2
// (women): "a badge or badges ... the bottom of that badge(s) will be even with the bottom of ribbons." Men's service dress (4.1.5.2.2.4.2): the
// first badge 1 1/2 in below the welt top, the second 1 1/2 in below the nametag (whose bottom is the ribbons' bottom), a third 1/2 in above it.
const semiSpec = (sex, rank, badgeIds) => Object.assign(spec(sex === 'male' ? 'semi_formal_usaf-male-cadet-C-SSgt' : 'semi_formal_usaf-female-cadet-C-Maj'), { rank, badgeIds });
const AIRCREW = 'AirCrew1_DB3F0FCC3650F';
for(const [label, sex, rank, ids, inPlace, rightPocket] of [
  ['men, three badges: the third in the nametag\'s place, the second on the right pocket', 'male', 'C/Col', [AIRCREW, 'stem_badges', 'emergency_services_badge', 'cyber_badges'], 'emergency_services_badge', 'cyber_badges'],
  ['men, two badges: the second on the right pocket, nothing in the nametag\'s place', 'male', 'C/Col', [AIRCREW, 'stem_badges', 'emergency_services_badge'], null, 'emergency_services_badge'],
  ['women, one badge in the nametag\'s place', 'female', 'C/Capt', [AIRCREW, 'stem_badges'], 'stem_badges', null],
  ['women, a pair in the nametag\'s place', 'female', 'C/Capt', [AIRCREW, 'stem_badges', 'cyber_badges'], 'pair', null]
]){
  test(`semi-formal ${label} (4.1.3.2.2, 4.1.4.2): placement, and no measure from the nametag that is not drawn`, async () => {
    const scene = await P.composeUniform(R.makeBuild(semiSpec(sex, rank, ids)), store);
    const rack = scene.layers.filter(l => l.role === 'ribbon');
    const rackBottom = Math.max(...rack.map(l => l.y + l.h)), rackLeft = Math.min(...rack.map(l => l.x));
    const badge = id => scene.layers.find(l => l.key === 'badge:' + id);
    const ms = scene.layers.filter(l => l.type === 'measure');
    // No measure starts or ends where nothing is drawn: every end lies on a badge, the rack, the welt or the lapel seam the overlay already used.
    const pieces = scene.layers.filter(l => l.role === 'badge' || l.role === 'ribbon');
    const onPiece = p => pieces.some(l => p.x >= l.x - 1e-3 && p.x <= l.x + l.w + 1e-3 && p.y >= l.y - 1e-3 && p.y <= l.y + l.h + 1e-3);
    const coat = await store.load(sex === 'male' ? 'garment-semiformal-class-a-coat-male' : 'garment-semiformal-class-a-coat-female');
    const weltY = core.anchor(coat, 'welt_top_center').y;
    for(const m of ms.filter(m => m.label !== 'halfway' && m.label !== 'on the seam')) for(const p of [m.from, m.to]) assert.ok(onPiece(p) || Math.abs(p.y - weltY) < 1e-6, `${m.label} end ${p.x.toFixed(2)},${p.y.toFixed(2)} on a drawn piece`);
    const even = ms.filter(m => m.label === 'even with');
    if(inPlace){
      const box = inPlace === 'pair' ? (() => { const two = ['stem_badges', 'cyber_badges'].map(badge); const x0 = Math.min(...two.map(l => l.x)), x1 = Math.max(...two.map(l => l.x + l.w)); return { x: x0, w: x1 - x0, y: Math.min(...two.map(l => l.y)), h: rackBottom - Math.min(...two.map(l => l.y)) }; })() : badge(inPlace);
      near(box.y + box.h, rackBottom, 0.02, 'bottom even with the bottom of the ribbons');
      assert.equal(even.length, 1, 'one level line');
      near(even[0].from.x, box.x + box.w, 1e-3, 'from the inner corner'); near(even[0].from.y, rackBottom, 0.02, 'at its bottom');
      near(even[0].to.x, rackLeft, 0.02, 'to the rack\'s outer corner'); near(even[0].to.y, rackBottom, 0.02, 'at the rack\'s bottom');
    }else assert.equal(even.length, 0);
    if(rightPocket){
      const rp = badge(rightPocket);
      near(rp.y, rackBottom + 1.5, 0.02, 'right pocket badge 1 1/2 in below where the nametag\'s bottom would be');
      assert.ok(scene.notes.some(n => /keeps its service dress place on the semi-formal/.test(n)), scene.notes.join(' | '));
      if(inPlace) assert.ok(ms.some(m => m.label === '1½ in' && Math.abs(m.from.y - (badge(inPlace).y + badge(inPlace).h)) < 1e-6 && Math.abs(m.to.y - rp.y) < 1e-6), 'measured 1 1/2 in from the badge in the nametag\'s place');
      else assert.ok(ms.some(m => m.label === 'level with' && Math.abs(m.from.y - rp.y) < 1e-6 && Math.abs(m.to.y - rp.y) < 1e-6), 'levelled with the left pocket badge');
    }
  });
}
