'use strict';
// Doran circled the column of three badges above the CAP tape on the OCP: CAPR 39-1 7.1.1.3.1.3-4 allow a column (three) or two
// columns of two (four), or two badges side by side on the tape with the rest centred above them. Commit 4a0ec6ba made the column
// the default; the garment panel now offers the other form ('Chest badge layout'), shown only when three or four badges are drawn,
// kept with the setup, and the page hands it to the engine as opt.badgeLayout.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadPageScripts } = require('./helpers/page-scripts.cjs');

const root = path.join(__dirname, '..');
const core = require('../js/engine/core.js');
const G = require('../js/engine/grades.js');
const P = require('../js/engine/profiles.js');
const CAT = require('../data/badge-catalog.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images', 'MANIFEST.json'), 'utf8'));
const store = () => core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));

const PILOT = 'CAPPilot1_FA9D33EA587D8', GT = 'ground_team_basic_badge', EMT = 'emt_basic_badge', MED = 'medical_officer';

function panel(uniform, badges, garment){
  const State = { uniform, gender: 'male', membership: 'senior', rank: 'Capt', garment: garment || {}, badges };
  const sandbox = { State, CAPUBEngine: { grades: G }, document: { addEventListener(){}, getElementById(){ return null; } }, window: {}, console };
  sandbox.window = sandbox;
  vm.runInNewContext(fs.readFileSync(path.join(root, 'js', 'garment-options.js'), 'utf8'), sandbox);
  return { O: sandbox.CAPUBGarmentOptions };
}

// The panel's own context() is private; read its answer through OPTIONS[].when by letting render() fill a host.
function shown(uniform, badges){
  const rows = [];
  const State = { uniform, gender: 'male', membership: 'senior', rank: 'Capt', garment: {}, badges };
  const host = { textContent: '', append(row){ rows.push(row); } };
  const panelEl = { hidden: true };
  const make = () => { const el = { children: [], className: '', append(...a){ this.children.push(...a); }, set textContent(v){}, set htmlFor(v){} }; return el; };
  const doc = { addEventListener(){}, getElementById: id => id === 'garmentOptions' ? host : id === 'garmentOptionsPanel' ? panelEl : null,
    createElement(tag){ const el = make(); el.tag = tag; el.options = []; Object.defineProperty(el, 'value', { get(){ return this._v; }, set(v){ this._v = v; } }); el.append = function(...a){ this.children.push(...a); }; el.addEventListener = () => {}; return el; } };
  const sandbox = { State, CAPUBEngine: { grades: G }, document: doc, window: {}, console };
  sandbox.window = sandbox;
  vm.runInNewContext(fs.readFileSync(path.join(root, 'js', 'garment-options.js'), 'utf8'), sandbox);
  sandbox.CAPUBGarmentOptions.render(true);
  const selects = [];
  const walk = el => { if(el && el.tag === 'select' && el.id === 'garmentOpt-badgeLayout') selects.push(el); (el && el.children || []).forEach(walk); };
  rows.forEach(walk);
  return selects.length ? selects[0] : null;
}

test('the Chest badge layout select appears only on a field uniform that draws three or four chest badges', () => {
  assert.equal(shown('ocp', []), null);
  assert.equal(shown('ocp', [PILOT]), null);
  assert.equal(shown('ocp', [PILOT, GT]), null);
  assert.ok(shown('ocp', [PILOT, GT, EMT]), 'three badges');
  assert.ok(shown('ocp', [PILOT, GT, EMT, MED]), 'four badges');
  // The ABU and the Corporate Field Uniform draw two badges at most, so they never reach three.
  assert.equal(shown('abu', [PILOT, GT, EMT, MED]), null);
  assert.equal(shown('corporate_field', [PILOT, GT, EMT, MED]), null);
  assert.equal(shown('blues_a', [PILOT, GT, EMT, MED]), null);
});

test('the choices are the column (the default) and two side by side', () => {
  const { O } = panel('ocp', [PILOT, GT, EMT]);
  const opt = O.OPTIONS.find(o => o.key === 'badgeLayout');
  assert.equal(opt.label, 'Chest badge layout');
  const plain = v => JSON.parse(JSON.stringify(v));
  assert.deepEqual(plain(opt.choices({ chestBadges: 3 })), [['column', 'Column'], ['pair', 'Two side by side']]);
  assert.deepEqual(plain(opt.choices({ chestBadges: 4 })), [['column', 'Two columns of two'], ['pair', 'Two side by side']]);
});

test('the choice is saved with the setup: sanitize keeps column and pair, drops anything else', () => {
  const { O } = panel('ocp', [PILOT, GT, EMT]);
  const clean = raw => JSON.parse(JSON.stringify(O.sanitize(raw)));
  assert.deepEqual(clean({ badgeLayout: 'pair' }), { badgeLayout: 'pair' });
  assert.deepEqual(clean({ badgeLayout: 'column', headgear: 'tactical' }), { badgeLayout: 'column', headgear: 'tactical' });
  assert.deepEqual(clean({ badgeLayout: 'triangle' }), {});
  // The saved setup carries State.garment, and loading runs it through sanitize (js/wiring.js).
  const wiring = fs.readFileSync(path.join(root, 'js', 'wiring.js'), 'utf8');
  assert.match(wiring, /garment: State\.garment \|\| \{\}/);
  assert.match(wiring, /CAPUBGarmentOptions\.sanitize\(p\.garment\)/);
});

test('the page hands the choice to the engine as opt.badgeLayout (column by default) and the pair renders side by side', async () => {
  const { context } = loadPageScripts();
  const build = garment => JSON.parse(vm.runInContext(`(function(garment){
    State.uniform = 'ocp'; State.gender = 'male'; State.membership = 'senior'; State.rank = 'Capt';
    State.badges = ${JSON.stringify([PILOT, GT, EMT])}; State.garment = garment;
    const b = CAPUBUniformView.buildFromState();
    return JSON.stringify({ badgeLayout: b.opt.badgeLayout, badges: b.badges.map(x => x.id) });
  })`, context)(garment));
  const column = build({});
  const pair = build({ badgeLayout: 'pair' });
  assert.equal(column.badgeLayout, 'column');
  assert.equal(pair.badgeLayout, 'pair');
  assert.deepEqual(pair.badges, column.badges);

  // Render both through the engine, as the page would.
  const scene = async layout => {
    const b = {
      uniform: 'ocp', gender: 'male', membership: 'senior', grade: G.gradeInfo('senior', 'Capt', {}), opt: { headgear: 'auto', badgeLayout: layout },
      name: { first: 'Pat', last: 'Doe', show: true }, ribbons: [], medals: [], badges: [PILOT, GT, EMT].map(id => ({ id, title: (CAT.get(id) || {}).name || id })),
      command: null, militaryBadges: [], patches: [], cord: null
    };
    const s = await P.composeUniform(b, store());
    return Object.fromEntries(s.layers.filter(l => l.role === 'badge').map(l => [l.key.split(':')[1], l]));
  };
  const col = await scene('column'), side = await scene('pair');
  const cx = l => l.x + l.w / 2;
  // Column: the three on one vertical line. Pair: the lower two on one level, 1/2 in apart, the first centred above them.
  assert.ok(Math.abs(cx(col[PILOT]) - cx(col[GT])) < 1e-6 && Math.abs(cx(col[GT]) - cx(col[EMT])) < 1e-6, 'a single column');
  assert.ok(Math.abs((side[GT].y + side[GT].h) - (side[EMT].y + side[EMT].h)) < 1e-6, 'the pair stands on one line');
  assert.ok(side[GT].x < side[EMT].x, 'side by side');
  assert.ok(Math.abs(side[EMT].x - (side[GT].x + side[GT].w) - 0.5) < 1e-6, '1/2 in apart (7.1.1.3.1.3)');
  assert.ok(side[PILOT].y + side[PILOT].h <= Math.min(side[GT].y, side[EMT].y) + 1e-6, 'the third above the pair');
});
