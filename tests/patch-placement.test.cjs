'use strict';
// Patch placement per uniform (Osprey, Discord: "flesh out the options for patch placement ... a drop down for the authorised patch
// placements on those uniforms"). js/catalog.js PATCH_PLACES names each field uniform's places in CAPR 39-1's words: ABU left sleeve
// (wing, region or national patch, 5.1.1.1.2.2) and right breast pocket (5.1.1.1.2.3); CFU left sleeve (5.2.1.1.2.2), right sleeve (special
// activity patch, 5.2.1.1.2.3), left and right breast pockets (5.2.1.1.2.4-5, the unit patch on the right); OCP right sleeve under the flag
// (the unit patch, 7.1.1.4.1.2) and left sleeve under AUX (7.1.1.4.2.1-2); flight suits' right sleeve (8.2.4.5, 8.3.4.5). A patch with
// more than one place gets a picker on its tile (patchTileHtml, class ptPlace); the pick is kept per uniform (State.patchPlacements,
// setPatchPlacement); the page hands the engine the picked slot (js/uniform-view.js buildPatches) and the engine draws the patch there
// (js/engine/profiles-field.js fieldPatches: a picked pocket is filled first, so a lone left-pocket pick is not pulled to the right).
// Attachment 4 (the table of badges, devices and patches) gives the places patch by patch; the paragraphs name the sleeves and pockets.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadPageScripts } = require('./helpers/page-scripts.cjs');

const ROOT = path.join(__dirname, '..');
const core = require('../js/engine/core.js');
const P = require('../js/engine/profiles.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');
const HARNESS = require('../scripts/render-builds.cjs');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'images', 'MANIFEST.json'), 'utf8'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(ROOT, 'images', p), 'utf8'))));
const compose = b => P.composeUniform(b, store);
const hb = (uniform, refs) => HARNESS.makeBuild({ uniform, gender: 'male', membership: 'senior', rank: 'Capt', name: { first: 'Pat', last: 'Doe', show: true }, patchRefs: refs });
const flat = (scene, id) => scene.layers.find(l => l.role === 'patch' && l.key.startsWith(`patch:${id}:`) && !/:edge$/.test(l.key));
const WING = { id: 'nywg_patch', kind: 'general', slot: 'L_SHOULDER' };
const UNIT = { id: 'tn330_ocp_patch', kind: 'unit' };
const NESA = slot => ({ id: 'nesa_patch', kind: 'general', slot });
const COMMS = slot => ({ id: 'comms_patch', kind: 'general', slot });

const { context } = loadPageScripts();
const ev = src => { const v = vm.runInContext(src, context); return v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v; };
const places = (id, u) => ev(`getPatchPlaces(${JSON.stringify(id)}, ${JSON.stringify(u)}).map(p => p.slot)`);

test('the places a patch may take, per uniform: only the authorized ones, the regulation\'s primary place first', () => {
  // A wing patch: the left sleeve of the ABU and the CFU, the HHQ place of the OCP, the flight suit's right sleeve.
  assert.deepEqual(places('nywg_patch', 'abu'), ['L_SHOULDER']);
  assert.deepEqual(places('nywg_patch', 'corporate_field'), ['L_SHOULDER']);
  assert.deepEqual(places('nywg_ocp_patch', 'ocp'), ['L_SHOULDER']);
  assert.deepEqual(places('nywg_patch', 'flight_suit'), ['R_SHOULDER']);
  // A special activity patch: the ABU's one pocket; the CFU's right sleeve, then either pocket; the OCP's HHQ place; the flight suit's sleeve.
  assert.deepEqual(places('nesa_patch', 'abu'), ['CHEST_RIGHT', 'CHEST_LEFT']);
  assert.deepEqual(places('nesa_patch', 'corporate_field'), ['R_SHOULDER', 'CHEST_RIGHT', 'CHEST_LEFT']);
  // Attachment 4: a patch that is not an NCSA patch is L/RP on the CFU, so the right sleeve is not offered; a region patch is LS or RP.
  assert.deepEqual(places('comms_patch', 'corporate_field'), ['CHEST_RIGHT', 'CHEST_LEFT']);
  assert.deepEqual(places('comms_patch', 'abu'), ['CHEST_RIGHT', 'CHEST_LEFT']);
  assert.deepEqual(places('ner_patch', 'abu'), ['L_SHOULDER', 'CHEST_RIGHT']);
  assert.deepEqual(places('ner_patch', 'corporate_field'), ['L_SHOULDER', 'CHEST_RIGHT']);
  assert.deepEqual(places('nesa_ocp_patch', 'ocp'), ['L_SHOULDER']);
  assert.deepEqual(places('nesa_patch', 'corporate_flight_suit'), ['R_SHOULDER']);
  // The unit patch: the right pocket of the ABU and the CFU, the OCP's right sleeve under the flag.
  assert.deepEqual(places('tn330_ocp_patch', 'abu'), ['CHEST_RIGHT']);
  assert.deepEqual(places('tn330_ocp_patch', 'corporate_field'), ['CHEST_RIGHT']);
  assert.deepEqual(places('tn330_ocp_patch', 'ocp'), ['R_SHOULDER']);
  // A dress uniform has no place for a patch.
  assert.deepEqual(places('nesa_patch', 'blues_a'), []);
  assert.equal(ev(`getPatchSlot('nesa_patch', 'blues_a')`), null);
});

test('the default place is the catalog\'s own when the uniform has it, else the primary one; the member\'s pick wins, is kept per uniform and only among the patch\'s places', () => {
  ev(`State.patchPlacements = {}; State.uniform = 'corporate_field'; State.membership = 'senior'`);
  assert.equal(ev(`getPatchSlot('comms_patch', 'corporate_field')`), 'CHEST_RIGHT', 'the Communications patch is filed on the right pocket');
  assert.equal(ev(`getPatchSlot('nesa_patch', 'corporate_field')`), 'R_SHOULDER', 'an NCSA patch filed on the left shoulder takes the CFU right sleeve');
  assert.equal(ev(`getPatchSlot('nesa_patch', 'abu')`), 'CHEST_RIGHT', 'and the ABU pocket');
  assert.equal(ev(`getPatchSlot('check_pilot_patch', 'abu')`), 'CHEST_LEFT', 'a patch filed on the left pocket keeps it where the uniform has it');
  ev(`setPatchPlacement('nesa_patch', 'CHEST_LEFT')`);
  assert.equal(ev(`getPatchSlot('nesa_patch')`), 'CHEST_LEFT');
  assert.deepEqual(ev('State.patchPlacements'), { corporate_field: { nesa_patch: 'CHEST_LEFT' } });
  assert.equal(ev(`getPatchSlot('nesa_patch', 'abu')`), 'CHEST_RIGHT', 'the pick is this uniform\'s');
  assert.equal(ev(`getPatchSlot('nesa_patch', 'flight_suit')`), 'R_SHOULDER');
  ev(`setPatchPlacement('nesa_patch', 'L_SHOULDER')`);
  assert.equal(ev(`getPatchSlot('nesa_patch')`), 'R_SHOULDER', 'a place the patch may not take is refused and the default returns');
  assert.deepEqual(ev('State.patchPlacements'), { corporate_field: {} });
});

test('the tile: a picker where the patch has more than one place, each option in words, the pick selected; one line where it has one', () => {
  ev(`State.patchPlacements = {}; State.uniform = 'corporate_field'; State.membership = 'senior'`);
  let html = ev(`patchTileHtml('nesa_patch')`);
  assert.match(html, /<select class="ptPlace"/);
  const options = [...html.matchAll(/<option value="([A-Z_]+)"( selected)?>([^<]+)<\/option>/g)].map(m => [m[1], !!m[2], m[3]]);
  assert.deepEqual(options, [
    ['R_SHOULDER', true, 'Right sleeve, ½ in below the shoulder seam'],
    ['CHEST_RIGHT', false, 'Right breast pocket'],
    ['CHEST_LEFT', false, 'Left breast pocket']
  ]);
  ev(`setPatchPlacement('nesa_patch', 'CHEST_LEFT')`);
  html = ev(`patchTileHtml('nesa_patch')`);
  assert.match(html, /<option value="CHEST_LEFT" selected>/);
  assert.doesNotMatch(html, /<option value="R_SHOULDER" selected>/);
  // One place: no picker, the place in words.
  html = ev(`patchTileHtml('nywg_patch')`);
  assert.doesNotMatch(html, /ptPlace/);
  assert.match(html, /Worn: <b>Left sleeve, ½ in below the shoulder seam<\/b>/);
  ev(`State.uniform = 'abu'`);
  html = ev(`patchTileHtml('nesa_patch')`);
  assert.deepEqual([...html.matchAll(/<option value="([A-Z_]+)"( selected)?>/g)].map(m => [m[1], !!m[2]]), [['CHEST_RIGHT', true], ['CHEST_LEFT', false]], 'the ABU: either breast pocket');
  html = ev(`patchTileHtml('ner_patch')`);
  assert.deepEqual([...html.matchAll(/<option value="([A-Z_]+)"( selected)?>([^<]+)</g)].map(m => [m[1], !!m[2], m[3]]), [['L_SHOULDER', true, 'Left sleeve, ½ in below the shoulder seam'], ['CHEST_RIGHT', false, 'Right breast pocket']], 'a region patch: the left sleeve, or the right pocket');
  html = ev(`patchTileHtml('tn185_ocp_patch')`);
  assert.doesNotMatch(html, /ptPlace/);
  assert.match(html, /Worn: <b>Right breast pocket<\/b>/);
  // The gallery and the popup wire the picker.
  const patches = fs.readFileSync(path.join(ROOT, 'js', 'patches.js'), 'utf8');
  assert.match(patches, /place\.onchange = \(\) => \{ setPatchPlacement\(id, place\.value\); rebuildPatchesFromGallery\(\); \}/);
  assert.match(patches, /const place = event\.target\.closest\('\.ptPlace'\);[\s\S]*?setPatchPlacement\(id, place\.value\)/);
  // The page hands the engine the picked slot.
  const view = fs.readFileSync(path.join(ROOT, 'js', 'uniform-view.js'), 'utf8');
  assert.match(view, /const chosen = typeof getPatchSlot === 'function' \? getPatchSlot\(resolved, State\.uniform\) : null;/);
});

test('CFU: the NESA patch is drawn where it was placed, the right sleeve, the right pocket or the left pocket, with the wing patch on the left sleeve', async () => {
  const coat = await store.load('garment-cfu-coat');
  const zone = name => core.landmarkBounds(coat, name);
  const inside = (l, z, label) => { const cx = l.x + l.w / 2, cy = l.y + l.h / 2; assert.ok(cx > z.x && cx < z.x + z.w && cy > z.y - 0.5 && cy < z.y + z.h + 0.5, `${label}: centre (${cx.toFixed(2)}, ${cy.toFixed(2)}) in ${JSON.stringify(z)}`); };
  const garment = scene => scene.layers.find(l => l.id === 'garment-cfu-coat');
  const toScene = (scene, z) => { const g = garment(scene), s = g.w / coat.w; return { x: g.x + z.x * s, y: g.y + z.y * s, w: z.w * s, h: z.h * s }; };
  for(const [slot, landmark] of [['R_SHOULDER', 'activity_patch_zone_right'], ['CHEST_RIGHT', 'chest_pocket_right'], ['CHEST_LEFT', 'chest_pocket_left']]){
    const scene = await compose(hb('corporate_field', [WING, NESA(slot)]));
    const nesa = flat(scene, 'nesa_patch');
    assert.ok(nesa && nesa.key === `patch:nesa_patch:${slot}:0`, `${slot}: drawn in the picked place (${nesa && nesa.key})`);
    inside(nesa, toScene(scene, zone(landmark)), slot);
    const wing = flat(scene, 'nywg_patch');
    assert.ok(wing && /L_SHOULDER/.test(wing.key), `${slot}: the wing patch stays on the left sleeve`);
    assert.equal(scene.layers.filter(l => l.role === 'patch' && /nesa_patch/.test(l.key) && !/:edge$/.test(l.key)).length, 1, `${slot}: once`);
  }
});

test('one patch per place: the CFU right pocket takes the unit patch, a second right-pocket pick falls to the left pocket; the ABU pocket takes one, the left sleeve only a wing, region or national patch', async () => {
  const two = await compose(hb('corporate_field', [UNIT, NESA('CHEST_RIGHT'), COMMS('CHEST_RIGHT')]));
  assert.ok(flat(two, 'tn330_ocp_patch') && /CHEST_RIGHT/.test(flat(two, 'tn330_ocp_patch').key), 'the unit patch is on the right pocket');
  const others = two.layers.filter(l => l.role === 'patch' && /nesa_patch|comms_patch/.test(l.key));
  assert.equal(others.length, 1, 'one of the two other pocket patches is drawn, on the left pocket');
  assert.match(others[0].key, /CHEST_LEFT/);
  // The ABU: the unit patch on the pocket and the NESA patch placed there too: the unit patch is shown, the NESA patch is not.
  const abu = await compose(hb('abu', [UNIT, WING, NESA('CHEST_RIGHT')]));
  assert.ok(flat(abu, 'tn330_ocp_patch') && /CHEST_RIGHT/.test(flat(abu, 'tn330_ocp_patch').key));
  assert.ok(!abu.layers.some(l => /nesa_patch/.test(l.key)), 'the ABU breast pocket takes one patch (5.1.1.1.2.3)');
  assert.ok(flat(abu, 'nywg_patch') && /L_SHOULDER/.test(flat(abu, 'nywg_patch').key));
  // Without the unit patch the NESA patch takes the ABU pocket.
  const alone = await compose(hb('abu', [WING, NESA('CHEST_RIGHT')]));
  assert.ok(flat(alone, 'nesa_patch') && /CHEST_RIGHT/.test(flat(alone, 'nesa_patch').key), 'the NESA patch on the ABU pocket');
  // A wing patch never leaves the left sleeve, whatever slot it was filed under; an activity patch never lands there (5.1.1.1.2.2).
  const stray = await compose(hb('abu', [{ id: 'nesa_patch', kind: 'general', slot: 'L_SHOULDER' }]));
  assert.ok(!stray.layers.some(l => /nesa_patch/.test(l.key)));
  assert.ok(stray.notes.some(n => /not worn on the ABU sleeve/.test(n)));
});

test('the page notes the ABU pocket patch the unit patch displaces', () => {
  const view = fs.readFileSync(path.join(ROOT, 'js', 'uniform-view.js'), 'utf8');
  assert.match(view, /the ABU breast pocket takes one patch, and the \$\{shown\.title\} is on it \(CAPR 39-1, 5\.1\.1\.1\.2\.3\)/);
});

test('Attachment 4: a region patch is the left sleeve\'s, or on the right pocket; another patch on either pocket (ABU one in all)', async () => {
  const NER = slot => ({ id: 'ner_patch', kind: 'general', slot, echelon: 'region' });
  const onSleeve = await compose(hb('abu', [NER('L_SHOULDER')]));
  assert.match(flat(onSleeve, 'ner_patch').key, /L_SHOULDER/);
  const onPocket = await compose(hb('abu', [NER('CHEST_RIGHT')]));
  assert.match(flat(onPocket, 'ner_patch').key, /CHEST_RIGHT/, 'a region patch on the ABU right pocket');
  const left = await compose(hb('abu', [COMMS('CHEST_LEFT')]));
  assert.match(flat(left, 'comms_patch').key, /CHEST_LEFT/, 'the ABU left pocket');
  const both = await compose(hb('corporate_field', [NER('CHEST_RIGHT'), COMMS('CHEST_LEFT')]));
  assert.match(flat(both, 'ner_patch').key, /CHEST_RIGHT/);
  assert.match(flat(both, 'comms_patch').key, /CHEST_LEFT/);
});
