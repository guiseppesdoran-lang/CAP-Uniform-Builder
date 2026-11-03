'use strict';
// LIVE13 E82 (Ethan: "for both of the OCP caps (unfortunately cause it looks stupid as fuck) add the option for the 2x2 velcro insignia").
// CAPR 39-1 7.1.1.8 (Tactical and Patrol OCP Caps): "Officers and Cadet Officers will wear sewn or Velcro® rank insignia centered, 1/2 inch from
// the visor, on the front of caps. Members' sewing rank on the cap will only have 1/8th inch of blue fabric showing past the widest and tallest part
// of the insignia." The sewn grade with its 1/8 in border stays the default; opt.capGrade 'square' draws the grade on the 2 x 2 in hook-and-loop
// square of the chest (7.1.1.2.1-2), its bottom 1/2 in from the visor, centred where the sewn grade is. Offered on the OCP only, to officers and
// cadet officers, with a cap worn.

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

// The options panel, run with a stub document: the keys of the options it offers.
function offered(uniform, membership, rank, garment){
  const rows = [];
  const State = { uniform, gender: 'male', membership, rank, garment: garment || {}, badges: [] };
  const host = { textContent: '', append(row){ rows.push(row); } };
  const make = tag => { const el = { tag, children: [], className: '', append(...a){ this.children.push(...a); }, addEventListener(){}, set textContent(v){}, set htmlFor(v){} }; Object.defineProperty(el, 'value', { get(){ return this._v; }, set(v){ this._v = v; } }); return el; };
  const doc = { addEventListener(){}, getElementById: id => id === 'garmentOptions' ? host : id === 'garmentOptionsPanel' ? { hidden: true } : null, createElement: make };
  const sandbox = { State, CAPUBEngine: { grades: G }, document: doc, window: {}, console };
  sandbox.window = sandbox;
  vm.runInNewContext(fs.readFileSync(path.join(root, 'js', 'garment-options.js'), 'utf8'), sandbox);
  sandbox.CAPUBGarmentOptions.render(true);
  const ids = [];
  const walk = el => { if(el && el.tag === 'select' && el.id) ids.push(el.id.replace('garmentOpt-', '')); (el && el.children || []).forEach(walk); };
  rows.forEach(walk);
  return { ids, O: sandbox.CAPUBGarmentOptions };
}

test('the cap grade option is offered on the OCP only, to officers and cadet officers wearing a cap; its values are sanitized', () => {
  assert.ok(offered('ocp', 'senior', 'Maj').ids.includes('capGrade'), 'OCP Maj');
  assert.ok(offered('ocp', 'cadet', 'C/Col').ids.includes('capGrade'), 'OCP C/Col');
  assert.ok(offered('ocp', 'senior', 'Maj', { headgear: 'tactical' }).ids.includes('capGrade'), 'OCP tactical cap');
  assert.ok(!offered('ocp', 'senior', 'Maj', { headgear: 'none' }).ids.includes('capGrade'), 'no cap');
  assert.ok(!offered('ocp', 'senior', 'SMSgt').ids.includes('capGrade'), 'NCOs wear no cap grade (7.1.1.8)');
  assert.ok(!offered('ocp', 'cadet', 'C/MSgt').ids.includes('capGrade'), 'cadet NCOs wear no cap grade');
  for(const u of ['abu', 'corporate_field', 'blues_a', 'blues_b', 'flight_suit']) assert.ok(!offered(u, 'senior', 'Maj').ids.includes('capGrade'), u);
  const { O } = offered('ocp', 'senior', 'Maj');
  assert.deepEqual(JSON.parse(JSON.stringify(O.sanitize({ capGrade: 'square' }))), { capGrade: 'square' });
  assert.deepEqual(JSON.parse(JSON.stringify(O.sanitize({ capGrade: '2x2' }))), {});
});

const base = R.matrix().builds.find(x => x.name === 'ocp-male-senior-Capt').build;
const build = (membership, rank, headgear, capGrade) => R.makeBuild(Object.assign(JSON.parse(JSON.stringify(base)), { membership, rank, opt: Object.assign({}, base.opt, { headgear }, capGrade ? { capGrade } : {}) }));
const ZONE = { auto: 'patrol_cap_front_insignia_zone', tactical: 'baseball_cap_front_insignia_zone' };

for(const [membership, rank] of [['cadet', 'C/Col'], ['senior', 'Maj']]){
  for(const headgear of ['auto', 'tactical']){
    test(`OCP ${rank}, ${headgear === 'auto' ? 'patrol' : 'tactical'} cap: the 2 x 2 in square sits 1/2 in from the visor, centred on the grade's place; the sewn default is unchanged`, async () => {
      const sewn = await P.composeUniform(build(membership, rank, headgear), store);
      const sq = await P.composeUniform(build(membership, rank, headgear, 'square'), store);
      const key = 'grade:' + ZONE[headgear];
      // E124: a cadet officer's grade is turned a quarter (7.1.1.2.2), so its box is the turned one (layerBounds).
      const r0 = sewn.layers.find(l => l.key === key), r1 = sq.layers.find(l => l.key === key);
      const s0 = Object.assign({ id: r0.id }, core.layerBounds(r0)), s1 = Object.assign({ id: r1.id }, core.layerBounds(r1));
      // Sewn (default): the cloth-bordered piece with its 1/8 in border measured.
      assert.match(s0.id, /cloth-bordered/);
      assert.ok(sewn.layers.some(l => l.type === 'measure' && l.label === '⅛ in' && l.from.y >= s0.y - 1e-6 && l.from.y <= s0.y + s0.h + 1e-6), 'the 1/8 in border on the sewn grade');
      assert.ok(!sewn.layers.some(l => l.key === 'grade-field:' + ZONE[headgear]), 'no square on the sewn default');
      // Square: the ocp-square device and the sheet's 2 x 2 in field, both 2 x 2 in at the cap's scale (1), bottom on the sewn grade's bottom
      // (1/2 in from the visor), centred on its centre line.
      assert.match(s1.id, /-ocp-square$/);
      near(s1.w, 2, 1e-6, 'square width'); near(s1.h, 2, 1e-6, 'square height');   // the 2 x 2 box is the same turned or not
      near(s1.x + s1.w / 2, s0.x + s0.w / 2, 1e-6, 'centred where the sewn grade is');
      near(s1.y + s1.h, s0.y + s0.h, 1e-6, 'bottom where the sewn grade\'s bottom is');
      const field = sq.layers.find(l => l.key === 'grade-field:' + ZONE[headgear]);
      assert.ok(field && field.onlyGroups.includes('rank-square'), 'the blue field is the sheet\'s rank square');
      near(field.obstacle.x, s1.x, 1e-6, 'field x'); near(field.obstacle.y, s1.y, 1e-6, 'field y'); near(field.obstacle.w, 2, 1e-6, 'field w'); near(field.obstacle.h, 2, 1e-6, 'field h');
      // 1/2 in from the visor, measured; no 1/8 in border on the square.
      const half = sq.layers.find(l => l.type === 'measure' && l.label === '½ in' && Math.abs(l.to.y - (s1.y + s1.h)) < 1e-6);
      assert.ok(half, 'the 1/2 in from the visor');
      assert.ok(!sq.layers.some(l => l.type === 'measure' && l.label === '⅛ in' && l.from.y >= s1.y - 1e-6 && l.from.y <= s1.y + s1.h + 1e-6), 'no 1/8 in border on the square');
    });
  }
}

test('the square option is ignored off the OCP: the ABU officer keeps the cloth-bordered grade', async () => {
  const abu = R.matrix().builds.find(x => x.name === 'abu-male-senior-Capt').build;
  const scene = await P.composeUniform(R.makeBuild(Object.assign(JSON.parse(JSON.stringify(abu)), { opt: Object.assign({}, abu.opt, { capGrade: 'square' }) })), store);
  assert.ok(!scene.layers.some(l => /^grade-field:/.test(l.key || '')));
  assert.ok(!scene.layers.some(l => /-ocp-square$/.test(l.id || '') && /cap/.test(l.key || '')));
});
