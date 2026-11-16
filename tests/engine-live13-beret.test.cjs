'use strict';
// LIVE13 E83 (Ethan: "for the OCPs add the national blue beret as headgear"). CAPR 39-1 9.2.3 as changed by ICL 25-02: "Graduates of this program may
// wear the blue beret granted per the activity's procedures with the USAF style ABU/OCP and the CAP corporate field uniform at the unit level. Berets
// will not be worn at wing, region, or national activities other than NBB." 6.2.3: the headband one inch above the eyebrows, the top draped over the
// right ear, the Blue Beret device in place of the cap device. The OCP sheet draws the beret's front (hat-beret-nbb-front); it is hidden with the
// other cap views and, when chosen, seated with its headband on the head line the patrol cap's band sits on. The ABU and CFU take the OCP sheet's
// beret. No back view, no grade, nothing measured (the figure has no eyebrow line for 6.2.3's one inch).

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const core = require('../js/engine/core.js');
const G = require('../js/engine/grades.js');
const P = require('../js/engine/profiles.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');
const R = require('../scripts/render-builds.cjs');

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images', 'MANIFEST.json'), 'utf8'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a.toFixed(4)} vs ${b.toFixed(4)}`);
const SHEET = { ocp: 'garment-ocp-coat-abu-cut', abu: 'garment-abu-coat', corporate_field: 'garment-cfu-coat' };
const OCP = SHEET.ocp;

function headgearChoices(uniform){
  const State = { uniform, gender: 'male', membership: 'cadet', rank: 'C/Col', garment: {}, badges: [] };
  const sandbox = { State, CAPUBEngine: { grades: G }, document: { addEventListener(){}, getElementById(){ return null; } }, window: {}, console };
  sandbox.window = sandbox;
  vm.runInNewContext(fs.readFileSync(path.join(root, 'js', 'garment-options.js'), 'utf8'), sandbox);
  const O = sandbox.CAPUBGarmentOptions;
  const opt = O.OPTIONS.find(o => o.key === 'headgear');
  const c = { u: uniform, female: false, g: G.gradeInfo('cadet', 'C/Col', {}), chestBadges: 0, o: {} };
  return { list: opt.when(c) ? (typeof opt.choices === 'function' ? opt.choices(c) : opt.choices).map(([v]) => v) : [], O };
}

test('the National Blue Beret is a headgear choice on the OCP, the ABU and the CFU only, and survives sanitizing', () => {
  for(const u of ['ocp', 'abu', 'corporate_field']) assert.ok(headgearChoices(u).list.includes('beret'), u);
  for(const u of ['blues_a', 'blues_b', 'flight_suit']) assert.ok(!headgearChoices(u).list.includes('beret'), u);
  assert.deepEqual(JSON.parse(JSON.stringify(headgearChoices('ocp').O.sanitize({ headgear: 'beret' }))), { headgear: 'beret' });
});

const base = name => R.matrix().builds.find(x => x.name === name).build;
const compose = (name, extra) => { const b = JSON.parse(JSON.stringify(base(name))); Object.assign(b, extra || {}); b.opt = Object.assign({}, b.opt, (extra && extra.opt) || {}); return P.composeUniform(R.makeBuild(b), store); };

test('the OCP sheet\'s beret row is hidden with the other cap views when the beret is not worn', async () => {
  const scene = await compose('ocp-male-cadet-C-Maj');
  const jacket = scene.layers.find(l => l.key === 'base:jacket');
  assert.ok(jacket.hideGroups.includes('hat-beret-nbb-front'));
  assert.ok(!scene.layers.some(l => (l.onlyGroups || []).includes('hat-beret-nbb-front')));
});

for(const [uniform, name] of [['ocp', 'ocp-male-cadet-C-Maj'], ['abu', 'abu-male-cadet-C-Maj'], ['corporate_field', 'corporate_field-male-senior-Capt']]){
  test(`${uniform}: the beret's headband sits on the patrol cap's head line, centred on the figure; front only, no grade, nothing measured, the 9.2.3 note`, async () => {
    const scene = await compose(name, { opt: { headgear: 'beret' } });
    const patrol = await compose(name);
    const hats = scene.layers.filter(l => l.role === 'hat'), views = scene.layers.filter(l => l.role === 'hat-view');
    assert.equal(hats.length, 1); assert.equal(views.length, 0, 'no back view');
    const hat = hats[0];
    assert.deepEqual(hat.onlyGroups, ['hat-beret-nbb-front']);
    assert.equal(hat.id, OCP, 'drawn from the OCP sheet');
    const src = await store.load(OCP), sheet = await store.load(SHEET[uniform]);
    const band = core.landmarkBounds(src, 'beret_nbb_front_headband');
    const bandBottom = hat.y + (band.y + band.h), bandCx = hat.x + band.x + band.w / 2;
    // The patrol cap's band: its front box is seated with the bill; the bill is the front box less the back (the crown alone).
    const pHat = patrol.layers.find(l => l.role === 'hat');
    const pf = core.landmarkBounds(sheet, 'patrol_cap_front'), pb = core.landmarkBounds(sheet, 'patrol_cap_back');
    near(bandBottom, pHat.y + pf.y + pf.h - (pf.h - pb.h), 0.02, 'headband bottom on the patrol cap\'s band line');
    near(bandCx, pHat.x + pf.x + pf.w / 2, 0.02, 'headband centred where the cap is');
    assert.ok(!scene.layers.some(l => /^grade:(patrol|baseball|boonie|beret)/.test(l.key || '')), 'no grade on the beret (6.2.3)');
    const box = hat.obstacle;
    assert.ok(!scene.layers.some(l => l.type === 'measure' && [l.from, l.to].some(p => p.x >= box.x && p.x <= box.x + box.w && p.y >= box.y && p.y <= box.y + box.h)), 'no measure on the beret');
    assert.ok(scene.notes.some(n => /National Blue Beret.*9\.2\.3/.test(n)), scene.notes.join(' | '));
  });
}
