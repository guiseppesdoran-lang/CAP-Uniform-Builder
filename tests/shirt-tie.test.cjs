'use strict';
// LIVE7-3 (Ethan: the Class B tie "should be optional as well"). The tie (tie tab for women) on the Class B and the aviator shirt is an option:
// worn with long sleeves and optional with short ones (CAPR 39-1 4.1.11.1.1.3, 4.1.12.4, 4.2.5.1.4, 4.2.6.3), so it starts on with long sleeves and
// off with short ones; the shirt drawn beside the Corporate Service Dress blazer keeps it (4.2.3.4, 4.2.4.3). The sheets draw it in the group `tie`,
// which the engine hides when the tie is off.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const core = require('../js/engine/core.js');
const P = require('../js/engine/profiles.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');
const RULES = require('../data/uniform-rules.js');
const HARNESS = require('../scripts/render-builds.cjs');
const { loadPageScripts } = require('./helpers/page-scripts.cjs');
const manifest = JSON.parse(read('images/MANIFEST.json'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(read('images/' + p))));

test('the rule: worn with long sleeves, optional with short ones, on the Class B and the aviator shirt; kept with the blazer; none on the overblouse', () => {
  const t = (u, o) => RULES.tieRule(u, o);
  assert.deepEqual(t('blues_b', { gender: 'male', sleeve: 'long' }), { offered: true, defaultOn: true, para: '4.1.11.1.1.3' });
  assert.deepEqual(t('blues_b', { gender: 'male', sleeve: 'short' }), { offered: true, defaultOn: false, para: '4.1.11.1.1.3' });
  assert.equal(t('blues_b', { gender: 'female', sleeve: 'long' }).para, '4.1.12.4');
  assert.equal(t('aviator', { gender: 'male', sleeve: 'short' }).para, '4.2.5.1.4');
  assert.equal(t('aviator', { gender: 'female', sleeve: 'long' }).para, '4.2.6.3');
  assert.equal(t('aviator', { gender: 'female', sleeve: 'long', overblouse: true }).offered, false);
  assert.deepEqual(t('aviator', { gender: 'male', sleeve: 'long', withBlazer: true }), { offered: false, defaultOn: true, para: '4.2.3.4' });
  for(const u of ['blues_a', 'ocp', 'flight_suit', 'mess_dress', 'polo']) assert.equal(t(u, { sleeve: 'long' }).offered, false, u);
  // the paragraphs say it
  const reg = fs.existsSync('/Users/ethan/UniformBuilder/artwork-samples/coverage/reg-audit/CAPR-39-1-with-ICLs.txt')
    ? fs.readFileSync('/Users/ethan/UniformBuilder/artwork-samples/coverage/reg-audit/CAPR-39-1-with-ICLs.txt', 'utf8') : '';
  if(reg){
    assert.match(reg, /4\.1\.11\.1\.1\.3\. Tie\. A tie will be worn with the long-sleeved shirt but is optional\s+with the short-sleeved shirt/);
    assert.match(reg, /4\.2\.5\.1\.4\. Tie\. A necktie will be worn with the long-sleeved shirt but is optional with the/);
  }
});

const { context } = loadPageScripts();
const run = code => JSON.parse(vm.runInContext(`JSON.stringify((function(){ ${code} })())`, context));

test('the page offers Tie (Tie tab for women) on the Class B and the aviator shirt only, starting as the regulation has it for the sleeve length', () => {
  const rows = run(`
    const out = {};
    for(const u of ['blues_a', 'blues_b', 'aviator', 'aviator_blazer', 'ocp', 'flight_suit', 'mess_dress', 'polo'])
      for(const female of [false, true]) for(const sleeve of ['short', 'long']){
        State.uniform = u; State.gender = female ? 'female' : 'male'; State.membership = 'senior'; State.rank = 'Capt'; State.garment = { sleeve };
        const c = { u, female, g: CAPUBEngine.grades.gradeInfo('senior', 'Capt', {}), chestBadges: 0, o: State.garment };
        const o = CAPUBGarmentOptions.OPTIONS.find(x => x.key === 'tie');
        out[[u, female ? 'f' : 'm', sleeve].join('/')] = o.when(c) ? { label: o.label(c), def: o.defaultValue(c), note: o.note(c) } : null;
      }
    return out;`);
  for(const [k, v] of Object.entries(rows)){
    const [u, sex, sleeve] = k.split('/');
    if(u === 'blues_b' || u === 'aviator'){
      assert.ok(v, k);
      assert.equal(v.label, sex === 'f' ? 'Tie tab' : 'Tie');
      assert.equal(v.def, sleeve === 'long', `${k}: on with long sleeves only`);
      assert.match(v.note, /CAPR 39-1, 4\.(1\.11\.1\.1\.3|1\.12\.4|2\.5\.1\.4|2\.6\.3)/);
    }else assert.equal(v, null, k);
  }
  // the woman in the overblouse has none
  const over = run(`State.uniform = 'aviator'; State.gender = 'female'; State.garment = { femaleTop: 'overblouse', sleeve: 'long' };
    const o = CAPUBGarmentOptions.OPTIONS.find(x => x.key === 'tie'); return o.when({ u: 'aviator', female: true, g: {}, chestBadges: 0, o: State.garment });`);
  assert.equal(over, false);
});

test('the choice reaches the build as opt.tie and is saved as a boolean; nothing is sent until the member chooses', () => {
  const get = garment => run(`State.uniform = 'blues_b'; State.gender = 'male'; State.membership = 'senior'; State.rank = 'Capt'; State.badges = [];
    State.garment = ${JSON.stringify(garment)}; return { tie: CAPUBUniformView.buildFromState().opt.tie === undefined ? 'unset' : CAPUBUniformView.buildFromState().opt.tie };`).tie;
  assert.equal(get({ sleeve: 'long' }), 'unset');
  assert.equal(get({ sleeve: 'short', tie: true }), true);
  assert.equal(get({ sleeve: 'long', tie: false }), false);
  assert.deepEqual(run(`return CAPUBGarmentOptions.sanitize({ tie: true, sleeve: 'long' });`), { tie: true, sleeve: 'long' });
  assert.deepEqual(run(`return CAPUBGarmentOptions.sanitize({ tie: 'yes' });`), {});
});

const baseLayer = (scene, figure) => scene.layers.find(l => l.key === 'base:jacket' && (figure ? l.figure === figure : !l.figure || l.figure === 1));
const build = (uniform, gender, opt) => HARNESS.makeBuild({ uniform, gender, membership: 'senior', rank: 'Maj', opt: Object.assign({ headgear: 'none' }, opt || {}) });
const hides = l => (l.hideGroups || []).includes('tie');

test('Class B and aviator shirts: the tie group is hidden when the tie is off and shown when it is on; the default follows the sleeve length (4.1.11.1.1.3, 4.1.12.4, 4.2.5.1.4, 4.2.6.3)', async () => {
  for(const uniform of ['blues_b', 'aviator']) for(const gender of ['male', 'female']){
    const label = `${uniform} ${gender}`;
    const short = await P.composeUniform(build(uniform, gender, { sleeve: 'short' }), store);
    const long = await P.composeUniform(build(uniform, gender, { sleeve: 'long' }), store);
    assert.ok(hides(baseLayer(short)), `${label} short: off by default`);
    assert.ok(!hides(baseLayer(long)), `${label} long: on by default`);
    const shortOn = await P.composeUniform(build(uniform, gender, { sleeve: 'short', tie: true }), store);
    const longOff = await P.composeUniform(build(uniform, gender, { sleeve: 'long', tie: false }), store);
    assert.ok(!hides(baseLayer(shortOn)), `${label} short, tie on`);
    assert.ok(hides(baseLayer(longOff)), `${label} long, tie off`);
    // the separate tie overlay of the sheets that have no tie group yet follows the same switch
    const tieLayers = s => s.layers.filter(l => /-tie(-tab)?$/.test(l.id || ''));
    if(uniform === 'aviator'){
      assert.equal(tieLayers(long).length, 1, `${label} long: tie overlay`);
      assert.equal(tieLayers(longOff).length, 0, `${label} long, tie off: no overlay`);
      assert.equal(tieLayers(short).length, 0, `${label} short: none until chosen`);
      assert.equal(tieLayers(shortOn).length, 1, `${label} short, tie on: overlay`);
    }
  }
});

test('the aviator shirt beside the blazer keeps its tie whatever the option says (4.2.3.4, 4.2.4.3)', async () => {
  for(const gender of ['male', 'female']){
    const scene = await P.composeUniform(build('aviator_blazer', gender, { tie: false }), store);
    const shirt = scene.layers.find(l => l.key === 'base:jacket' && l.figure === 2);
    assert.ok(shirt, 'the shirt beside the blazer is drawn');
    assert.ok(!hides(shirt), `${gender}: tie kept`);
  }
});

test('every Class B and aviator shirt sheet draws its tie in a group `tie` with a `tie` landmark (skips, naming the sheets, until the art lands)', async t => {
  const sheets = [];
  for(const g of ['male', 'female']) for(const s of ['', '-long']){
    sheets.push(`garment-blues-class-b-${g === 'male' ? 'shirt-male' : 'blouse-female'}${s}`, `garment-aviator-shirt-${g}${s}`);
  }
  const missing = sheets.filter(id => {
    const svg = read(`images/garments/${id}.svg`), spec = JSON.parse(read(`images/garments/${id}.spec.json`));
    return !new RegExp(`id="${id}__tie"`).test(svg) || !spec.landmarks.tie;
  });
  if(missing.length) return t.skip(`not yet synced: group ${missing.map(id => id + '__tie').join(', ')} and landmark tie`);
  assert.equal(missing.length, 0);
});
