'use strict';
// LIVE12 E50 (Ducky: "I use cap crest buttons, why no option for cap crest buttons"; Ethan: "I'll add that"). CAPR 39-1 4.1.1.1 and 4.1.2.1: three "wing and star", CAP coat of arms or USAF
// coat of arms buttons on each side of the mess dress coat; 4.1.1.1: the men's chain closure is "Two buttons with the same design as the coat buttons"; 4.1.1.1.1.1: "Buttons on shoulder boards
// must match design of the buttons on the jacket" (4.1.2.1.1.1: the women's boards have no button). The art (dde58c6e, LIVE12-ART 2) draws every button position of the two coat sheets, the men's
// closure and the men's two board sheets as a group holding one group per design, `<position>-wing-star` (the default, drawn last) and `<position>-cap-crest`, listed in the landmark
// button_designs with button_design_default. The page offers a Buttons select on the mess dress (opt.buttons); the engine hides every group of the design not chosen on the coat and on the
// boards drawn with it. The USAF coat of arms button is not drawn (no reference), so two designs are offered.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const core = require('../js/engine/core.js');
const P = require('../js/engine/profiles.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');
const HARNESS = require('../scripts/render-builds.cjs');
const { loadPageScripts } = require('./helpers/page-scripts.cjs');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'images/MANIFEST.json'), 'utf8'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(ROOT, 'images', p), 'utf8'))));
const svgOf = id => fs.readFileSync(path.join(ROOT, 'images', manifest.assets.find(a => a.id === id).path), 'utf8');

const COATS = { male: 'garment-mess-dress-male', female: 'garment-mess-dress-female' };
const BOARDS = ['garment-mess-dress-male-officer-shoulder-boards', 'garment-mess-dress-male-general-officer-shoulder-boards'];
const DESIGNS = ['wing-star', 'cap-crest'];
const build = (gender, rank, buttons) => HARNESS.makeBuild({ uniform: 'mess_dress', gender, membership: 'senior', rank, opt: buttons === undefined ? {} : { buttons } });
const designsOf = async id => (await store.load(id)).landmarks.button_designs;

test('the coat and men\'s board sheets state both designs, wing and star the default, and every listed id is a group nested in its button position beside the other design', async () => {
  for(const id of [...Object.values(COATS), ...BOARDS]){
    const spec = await store.load(id), svg = svgOf(id), designs = spec.landmarks.button_designs;
    assert.deepEqual(Object.keys(designs).sort(), [...DESIGNS].sort(), `${id}: two designs`);
    assert.equal(spec.landmarks.button_design_default, 'wing-star', `${id}: default`);
    assert.equal(designs['wing-star'].length, designs['cap-crest'].length, `${id}: one of each design per position`);
    assert.equal(designs['wing-star'].length, { 'garment-mess-dress-male': 8, 'garment-mess-dress-female': 6 }[id] || 2, `${id}: positions`);
    for(const [i, ws] of designs['wing-star'].entries()){
      const pos = ws.replace(/-wing-star$/, '');
      assert.equal(designs['cap-crest'][i], pos + '-cap-crest', `${id}: ${pos} has both designs`);
      for(const g of [ws, pos + '-cap-crest']) assert.match(svg, new RegExp(`<g id="${id}__${g}"`), `${id}: group ${g}`);
      // the default is drawn last, on top, so a viewer that hides nothing shows it
      assert.ok(svg.indexOf(`id="${id}__${ws}"`) > svg.indexOf(`id="${id}__${pos}-cap-crest"`), `${id}: ${ws} after ${pos}-cap-crest`);
    }
  }
  for(const id of ['garment-mess-dress-female-officer-shoulder-boards', 'garment-mess-dress-female-general-officer-shoulder-boards']){
    assert.equal((await store.load(id)).landmarks.button_designs, undefined, `${id}: the women's boards have no button (4.1.2.1.1.1)`);
  }
});

for(const [gender, rank, boards] of [['male', 'Capt', BOARDS[0]], ['male', 'Maj Gen', BOARDS[1]], ['female', 'Capt', null], ['male', 'SMSgt', null]]){
  test(`mess dress ${gender} ${rank}: the coat${boards ? ' and both views of each shoulder board' : ''} hide every group of the design not chosen and none of the chosen one; wing and star by default`, async () => {
    const coatDesigns = await designsOf(COATS[gender]), boardDesigns = boards ? await designsOf(boards) : null;
    for(const [choice, shown] of [[undefined, 'wing-star'], ['wing-star', 'wing-star'], ['cap-crest', 'cap-crest'], ['usaf-crest', 'wing-star']]){
      const hidden = DESIGNS.find(d => d !== shown);
      const scene = await P.composeUniform(build(gender, rank, choice), store);
      const coat = scene.layers.find(l => l.role === 'garment');
      assert.equal(coat.id, COATS[gender]);
      assert.deepEqual([...coat.hideGroups].sort(), [...coatDesigns[hidden]].sort(), `${choice}: the coat hides the ${hidden} groups`);
      assert.ok(!coat.hideGroups.some(g => coatDesigns[shown].includes(g)), `${choice}: the coat keeps the ${shown} groups`);
      const boardLayers = scene.layers.filter(l => l.role === 'epaulet-top' || l.role === 'epaulet-edge');
      if(!boards){
        assert.ok(boardLayers.every(l => !l.hideGroups), 'no board button to hide');
        continue;
      }
      assert.equal(boardLayers.length, 4, 'two boards, seen from above and edge-on');
      for(const l of boardLayers){
        assert.equal(l.id, boards);
        assert.deepEqual([...l.hideGroups].sort(), [...boardDesigns[hidden]].sort(), `${choice} ${l.key}: the board hides the ${hidden} button`);
        assert.ok(!l.hideGroups.some(g => boardDesigns[shown].includes(g)), `${choice} ${l.key}: the board keeps the ${shown} button, matching the jacket (4.1.1.1.1.1)`);
      }
    }
  });
}

test('the women\'s boards carry no button: drawn with nothing hidden whatever the choice (4.1.2.1.1.1)', async () => {
  for(const choice of ['wing-star', 'cap-crest']){
    const scene = await P.composeUniform(build('female', 'Maj Gen', choice), store);
    const boards = scene.layers.filter(l => l.role === 'epaulet-top' || l.role === 'epaulet-edge');
    assert.equal(boards.length, 4);
    for(const l of boards) assert.equal(l.hideGroups, undefined, `${choice} ${l.key}`);
  }
});

// ---- the page's Buttons select ------------------------------------------------------------------

const { context } = loadPageScripts();
const run = code => JSON.parse(vm.runInContext(`JSON.stringify((function(){ ${code} })())`, context));

test('the Buttons select is offered on the mess dress only, both genders, with wing and star first (the default) and the CAP coat of arms', () => {
  const rows = run(`
    const out = {};
    for(const u of ['blues_a', 'blues_b', 'aviator', 'aviator_blazer', 'semi_formal', 'mess_dress', 'ocp', 'abu', 'corporate_field', 'polo', 'flight_suit', 'corporate_flight_suit']){
      for(const female of [false, true]){
        const c = { u, female, g: CAPUBEngine.grades.gradeInfo('senior', 'Capt', {}), chestBadges: 0, o: {} };
        const o = CAPUBGarmentOptions.OPTIONS.find(x => x.key === 'buttons');
        out[u + (female ? ' female' : ' male')] = { offered: o.when(c), type: o.type, label: o.label, choices: o.choices, note: o.note(c) };
      }
    }
    return out;`);
  for(const [k, r] of Object.entries(rows)){
    assert.equal(r.offered, k.startsWith('mess_dress '), k);
    assert.equal(r.type, 'select');
    assert.equal(r.label, 'Buttons');
    assert.deepEqual(r.choices, [['wing-star', 'Wing and star'], ['cap-crest', 'CAP coat of arms']]);
  }
  assert.match(rows['mess_dress male'].note, /4\.1\.1\.1\.1\.1/, 'the men\'s note names the board rule');
  assert.match(rows['mess_dress female'].note, /4\.1\.2\.1/);
});

test('a saved setup keeps only a drawn design', () => {
  const r = run(`return { ok: CAPUBGarmentOptions.sanitize({ buttons: 'cap-crest' }), ws: CAPUBGarmentOptions.sanitize({ buttons: 'wing-star' }), usaf: CAPUBGarmentOptions.sanitize({ buttons: 'usaf-crest' }), bad: CAPUBGarmentOptions.sanitize({ buttons: true }) };`);
  assert.deepEqual(r.ok, { buttons: 'cap-crest' });
  assert.deepEqual(r.ws, { buttons: 'wing-star' });
  assert.deepEqual(r.usaf, {});
  assert.deepEqual(r.bad, {});
});

test('the choice reaches the build as opt.buttons: wing and star until the member chooses', () => {
  for(const gender of ['male', 'female']){
    const get = garment => run(`State.uniform = 'mess_dress'; State.gender = '${gender}'; State.membership = 'senior'; State.rank = 'Capt'; State.badges = [];
      State.garment = ${JSON.stringify(garment)}; return { v: CAPUBUniformView.buildFromState().opt.buttons };`).v;
    assert.equal(get({}), 'wing-star', gender + ' default');
    assert.equal(get({ buttons: 'cap-crest' }), 'cap-crest', gender + ' chosen');
  }
});
