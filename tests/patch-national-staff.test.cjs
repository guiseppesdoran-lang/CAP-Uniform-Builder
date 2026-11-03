'use strict';
// The National Staff patch (Wayler: "and where's my national staff patch"; Osprey: "its there but only under ABU and greyed out").
// It was listed only on the ABU, greyed (authorizedUniforms was the OCP alone), and not on the OCP itself: ocp-patch-variants.js, the last
// script loaded, redrew the picker with its own filter that on the OCP listed only the patches that have an OCP form of their own
// (variantIds), and the National Staff patch is the OCP's own patch, not a form of another. Attachment 4 (CAPR 39-1): National Staff
// RP on the ABU and the CFU, RS on the flight suits; 7.1.1.4.2.2: the National Staff badge on the OCP's left sleeve in lieu of the HHQ
// patch; 10.2.3: members appointed to a National Staff position.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadPageScripts } = require('./helpers/page-scripts.cjs');
const core = require('../js/engine/core.js');
const P = require('../js/engine/profiles.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');
const HARNESS = require('../scripts/render-builds.cjs');

const ROOT = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'images', 'MANIFEST.json'), 'utf8'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(ROOT, 'images', p), 'utf8'))));
const { context } = loadPageScripts();
const ev = src => { const v = vm.runInContext(src, context); return v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v; };
const ID = 'national_staff_ocp_patch';
const authorized = (u, m = 'senior') => ev(`isPatchAuthorizedForUniform(${JSON.stringify(ID)}, ${JSON.stringify(u)}, ${JSON.stringify(m)})`);
const places = u => ev(`getPatchPlaces(${JSON.stringify(ID)}, ${JSON.stringify(u)}).map(p => p.slot)`);

test('authorized for a senior member on every uniform the regulation puts it on, not on a cadet, and with the reason in words', () => {
  for(const u of ['abu', 'ocp', 'corporate_field', 'flight_suit', 'corporate_flight_suit']){
    assert.equal(authorized(u), true, `${u}: offered, not greyed`);
    assert.equal(authorized(u, 'cadet'), false, `${u}: a cadet`);
  }
  ev(`State.uniform = 'corporate_field'; State.membership = 'cadet'`);
  assert.match(ev(`patchTileHtml(${JSON.stringify(ID)})`), /Senior members only: worn by members appointed to a National Staff position \(CAPR 39-1, 10\.2\.3\)\./);
  ev(`State.membership = 'senior'`);
  assert.match(ev(`patchTileHtml(${JSON.stringify(ID)})`), /Worn: <b>Right breast pocket<\/b>/);
  assert.match(ev(`patchTileHtml(${JSON.stringify(ID)})`), /National Staff Patch/);
  assert.doesNotMatch(ev(`patchTileHtml(${JSON.stringify(ID)})`), /OCP/, 'the title does not say OCP on a uniform that is not');
});

test('its places: the OCP left sleeve in lieu of the HHQ patch, the ABU and CFU right pocket (not the left sleeve a national patch takes), the flight suits\' right sleeve', () => {
  assert.deepEqual(places('ocp'), ['L_SHOULDER']);
  assert.deepEqual(places('abu'), ['CHEST_RIGHT']);
  assert.deepEqual(places('corporate_field'), ['CHEST_RIGHT']);
  assert.deepEqual(places('flight_suit'), ['R_SHOULDER']);
  assert.deepEqual(places('corporate_flight_suit'), ['R_SHOULDER']);
});

test('the picker lists it on the OCP: ocp-patch-variants.js no longer redraws the gallery with its own filter', () => {
  const src = fs.readFileSync(path.join(ROOT, 'ocp-patch-variants.js'), 'utf8');
  assert.doesNotMatch(src, /buildPatchGallery\s*=/);
  assert.doesNotMatch(src, /variantIds\.has\(id\) : !variantIds/);
  const patches = fs.readFileSync(path.join(ROOT, 'js', 'patches.js'), 'utf8');
  assert.match(patches, /function capubPatchHasOcpAsset[\s\S]*?id\.includes\('ocp'\)/, 'on the OCP a patch with OCP in its id is listed');
});

test('drawn on each uniform in its place', async () => {
  const build = (uniform) => HARNESS.makeBuild({ uniform, gender: 'male', membership: 'senior', rank: 'Capt', name: { first: 'Pat', last: 'Doe', show: true },
    patchRefs: [{ id: ID, kind: 'general', slot: ev(`getPatchSlot(${JSON.stringify(ID)}, ${JSON.stringify(uniform)})`) }] });
  for(const [uniform, slot] of [['ocp', 'L_SHOULDER'], ['abu', 'CHEST_RIGHT'], ['corporate_field', 'CHEST_RIGHT'], ['flight_suit', 'R_SHOULDER'], ['corporate_flight_suit', 'R_SHOULDER']]){
    const scene = await P.composeUniform(build(uniform), store);
    const l = scene.layers.find(x => x.role === 'patch' && x.key.startsWith(`patch:${ID}:`) && !/:edge$/.test(x.key));
    assert.ok(l, `${uniform}: drawn`);
    assert.equal(l.key.split(':')[2], uniform.includes('flight') ? 'RS' : slot, `${uniform}: the ${slot} (the flight suits' engine calls the right sleeve RS)`);
  }
});
