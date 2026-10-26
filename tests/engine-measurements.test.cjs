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
  collarChevron: '1 in: cadet NCO collar chevron from the front of the collar (4.1.11.1.1.1.4, 4.1.12.2.3.5)',
  pocketBadge: 'centered: badge on the lower portion of the pocket (4.1.11.1.1.2.3.2)',
  messMidway: 'midway: miniature medals between the top shoulder seam and the top button (4.1.1.1.2.2, 4.1.2.1.2.2)',
  messBelow: '½ in: men\'s mess dress badge below the medals (4.1.1.1.2.3)',
  crest: '½ in: miniature medals above the CAP crest (4.2.1.4, 4.2.2.4 with ICL 25-02)',
  chaplainSemi: '½ in: chaplain insignia above the top row of medals (4.2.1.5, 4.2.2.5)',
  chaplainBlazer: '½ in: chaplain badge above the blazer nametag (4.2.3.1.1.3, 4.2.4.1.1.3)',
  fieldBadge: '½ in: badge above the CAP tape, second above the first (7.1.1.3.1.1-2, 5.1.1.1.2.4, 5.2.1.1.2.6)',
  blue: '⅛ in: blue cloth past the embroidery (7.1.1.3.1, 7.1.1.8, 5.1.1.1.1.1, 5.1.1.1.1.3, 5.1.1.1.2.4, 5.2.1.1.1.1, 5.2.1.1.1.4, 5.2.1.1.2.6, 8.3.5.1)',
  capVisor: '½ in: officer grade above the visor (7.1.1.8, ICL 25-02 6.2.11.1)',
  abuChevron: 'halfway to elbow: NCO chevron below the shoulder seam (5.1.1.1.1.2, 5.2.1.1.1.3)',
  command: '½ in: command insignia above the name tape, graduated below it (7.1.1.3.1.7, 5.1.1.1.2.5, 5.2.1.1.2.9)',
  sleevePatch: '½ in: sleeve patch below the shoulder seam (5.1.1.1.2.2, 5.2.1.1.2.2-3)',
  pocketPatch: 'centered: breast pocket patch between the flap and the pocket bottom (5.1.1.1.2.3, 5.2.1.1.2.4-5)',
  esPatch: '½ in: ES patch above the name tape or command insignia (5.2.1.1.2.8)',
  ocpUnit: 'centered: unit patch in the middle of the Velcro under the flag (7.1.1.4.1.2)',
  ocpGradCmd: 'centered: graduated commander patch on the loop (7.1.1.3.1.7)',
  ocpBase: '⅛ in: three or four badges above the CAP tape (7.1.1.3.1.3-4)',
  ocpPair: '½ in: badges side by side (7.1.1.3.1.3-4)',
  ocpStack: '¼ in: between stacked badges (7.1.1.3.1.3-4)',
  fduGrade: '½ in: officer grade from the shoulder seam (8.2.3.2, 8.3.3.2)',
  esCentered: 'centered: ES patch on the right breast pocket\'s centre line (8.2.4.3, 8.3.4.3)',
  esGap: '⅛ in: ES patch below the right breast pocket, an estimate (8.2.4.3, 8.3.4.3)',
  fduFlag: '½ in: U.S. flag below the shoulder seam (8.2.4.4, 8.3.4.4)',
  poloOverName: '½ in: the one badge or duty title over the name, from the top of the name to the bottom of the badge or title (5.3.2.1.1)'
};
const L = key => CITE[key].split(':')[0];

// [build name, [cite keys, one per measure drawn]]
const TABLE = [
  ['blues_a-male-senior-Capt', ['braid', 'badgeAboveRibbons', 'welt', 'lapel', 'lapel', 'flightCap']],
  ['blues_a-male-cadet-C-Maj', ['badgeAboveRibbons', 'welt', 'lapel', 'lapel', 'flightCap']],
  ['blues_a-female-senior-SMSgt', ['sleeveChevronElbow', 'badgeAboveRibbons', 'aboveNametag', 'lapel', 'lapel', 'flightCap']],
  ['blues_a-female-senior-MajGen', ['braid', 'badgeAboveRibbons', 'aboveNametag', 'lapel', 'lapel', 'flightCap']],
  ['blues_b-male-cadet-C-SSgt', ['collarChevron', 'collarChevron', 'badgeAboveRibbons', 'pocketBadge', 'flightCap']],
  ['blues_b-male-senior-SMSgt', ['sleeveChevron', 'badgeAboveRibbons', 'pocketBadge', 'flightCap']],
  ['blues_b-female-senior-SMSgt', ['sleeveChevron', 'badgeAboveRibbons', 'aboveNametag', 'flightCap']],
  ['mess_dress-male-senior-Col', ['braid', 'messMidway', 'badgeAboveRibbons', 'messBelow']],
  ['mess_dress-female-senior-Capt', ['braidMessW', 'messMidway', 'badgeAboveRibbons']],
  ['mess_dress-female-senior-SMSgt', ['sleeveChevron', 'messMidway', 'badgeAboveRibbons']],
  ['semi_formal-male-senior-Capt', ['chaplainSemi']],
  ['semi_formal-female-senior-Col', ['crest', 'chaplainSemi']],
  ['semi_formal_usaf-male-cadet-C-SSgt', ['badgeAboveRibbons', 'welt', 'lapel', 'lapel']],
  ['semi_formal_usaf-female-cadet-C-Maj', ['badgeAboveRibbons', 'lapel', 'lapel']],
  ['aviator-male-senior-SMSgt', ['sleeveChevron', 'badgeAboveRibbons']],
  ['aviator-female-senior-Capt', ['badgeAboveRibbons', 'aboveNametag']],
  ['aviator_blazer-male-senior-Capt', ['chaplainBlazer', 'badgeAboveRibbons']],
  ['aviator_blazer-female-senior-Col', ['chaplainBlazer', 'badgeAboveRibbons']],
  ['ocp-male-senior-Capt', ['capVisor', 'blue', 'fieldBadge', 'fieldBadge', 'blue']],
  ['ocp-female-cadet-C-SSgt', ['fieldBadge', 'fieldBadge', 'blue']],
  ['ocp-male-senior-SMSgt', ['fieldBadge', 'fieldBadge', 'blue']],
  ['abu-male-senior-Capt', ['blue', 'fieldBadge', 'fieldBadge', 'blue']],
  ['abu-male-cadet-C-Maj', ['blue', 'fieldBadge', 'fieldBadge', 'blue']],
  ['abu-male-cadet-C-SSgt', ['fieldBadge', 'fieldBadge', 'blue']],
  ['abu-female-senior-SMSgt', ['abuChevron', 'fieldBadge', 'fieldBadge', 'blue']],
  ['corporate_field-male-senior-SMSgt', ['abuChevron', 'fieldBadge', 'fieldBadge', 'blue']],
  ['corporate_field-female-senior-Capt', ['blue', 'fieldBadge', 'fieldBadge', 'blue']],
  ['flight_suit-male-senior-Capt', ['fduGrade', 'fduFlag', 'flightCap']],
  ['flight_suit-male-senior-MajGen', ['fduFlag', 'flightCap']],
  ['x-flight_suit-male-Capt-es', ['fduGrade', 'fduFlag', 'flightCap', 'esCentered', 'esGap']],
  ['x-corporate_flight_suit-female-SMSgt-es', ['fduFlag', 'esCentered', 'esGap']],
  ['flight_suit-female-cadet-C-SSgt', ['fduFlag', 'flightCap']],
  ['corporate_flight_suit-male-senior-Col', ['fduGrade', 'blue', 'fduFlag']],
  ['corporate_flight_suit-female-senior-SMSgt', ['fduFlag']],
  // Builds with patches, command insignia and more badges than the standard matrix wears.
  ['x-ocp-male-Capt-patches-gradcmd', ['capVisor', 'blue', 'fieldBadge', 'fieldBadge', 'blue', 'ocpGradCmd', 'ocpUnit']],
  ['x-ocp-male-Capt-4badges', ['capVisor', 'blue', 'ocpBase', 'ocpPair', 'ocpStack', 'ocpStack', 'blue']],
  ['x-abu-male-Capt-patches-cmd', ['blue', 'fieldBadge', 'fieldBadge', 'blue', 'command', 'sleevePatch', 'pocketPatch']],
  ['x-abu-male-Capt-gradcmd', ['blue', 'fieldBadge', 'fieldBadge', 'blue', 'command']],
  ['x-cfu-male-Capt-patches-es', ['blue', 'fieldBadge', 'fieldBadge', 'blue', 'command', 'sleevePatch', 'sleevePatch', 'pocketPatch', 'pocketPatch', 'esPatch']],
  ['x-semi-female-Col-chaplain', ['crest', 'chaplainSemi']],
  // The long sleeves and the coats have an elbow; the flat sleeves beside the figure carry the distance (SLEEVE-ENG), one per build.
  ['blues_a-male-senior-SMSgt', ['sleeveChevronElbow', 'badgeAboveRibbons', 'welt', 'lapel', 'lapel', 'flightCap']],
  ['x-blues_b-male-long-SMSgt', ['sleeveChevronElbow', 'badgeAboveRibbons', 'pocketBadge', 'flightCap']],
  ['x-blues_b-female-long-SMSgt', ['sleeveChevronElbow', 'badgeAboveRibbons', 'aboveNametag', 'flightCap']],
  ['x-aviator-male-long-SMSgt', ['sleeveChevronElbow', 'badgeAboveRibbons']],
  ['x-aviator-female-long-SMSgt', ['sleeveChevronElbow', 'badgeAboveRibbons', 'aboveNametag']],
  ['x-overblouse-short-SMSgt', ['sleeveChevron', 'badgeAboveRibbons', 'aboveNametag']],
  ['x-overblouse-long-SMSgt', ['sleeveChevronElbow', 'badgeAboveRibbons', 'aboveNametag']],
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
  const WORDS = new Set(['centered', 'halfway', 'halfway to elbow', 'midway']);
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
