'use strict';
// The polo on the page: the sidebar button, its catalog entries, the garment options and what they allow (CAPR 39-1 5.3).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const G = require('../js/engine/grades.js');
const rules = require('../data/uniform-rules.js');

const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

function panel(garment, { gender = 'male', rank = 'Capt' } = {}){
  const State = { uniform: 'polo', gender, membership: 'senior', rank, garment: garment || {} };
  const sandbox = { State, CAPUBEngine: { grades: G }, document: { addEventListener(){}, getElementById(){ return null; } }, window: {}, console };
  sandbox.window = sandbox;
  vm.runInNewContext(read('js/garment-options.js'), sandbox);
  const O = sandbox.CAPUBGarmentOptions;
  const c = { u: 'polo', female: gender === 'female', g: G.gradeInfo('senior', rank, {}), o: State.garment };
  return { O, c, active: O.OPTIONS.filter(o => o.when(c)) };
}

test('the sidebar lists the polo for senior members only, beside the aviator uniforms', () => {
  const html = read('index.html');
  assert.match(html, /data-uniform-id="polo" data-allowed-for="senior"/);
  assert.ok(html.indexOf('data-uniform-id="polo"') > html.indexOf('data-uniform-id="aviator_blazer"'));
  assert.match(html, /js\/engine\/profiles-polo\.js\?v=[0-9a-f]{10}/);
  const catalog = read('js/catalog.js');
  assert.match(catalog, /polo:\{male:'garments\/garment-polo-male\.svg'/);
  assert.match(catalog, /polo:\{ showBadges:true, showPatches:false \}/);
  assert.equal(rules.isUniformAllowedFor('polo', 'cadet', { adultCadet: true }), false);
});

test('the polo panel offers shirt, sleeves, name, badge or title and the cap; a woman also chooses her cut (5.3.1)', () => {
  const man = [...panel({}).active.map(o => o.key)];
  assert.deepEqual(man, ['poloShirt', 'poloName', 'poloMark', 'baseballCap', 'sleeve']);
  const woman = panel({}, { gender: 'female' }).active.map(o => o.key);
  assert.ok(woman.includes('poloCut'));
  const sleeve = panel({}).O.OPTIONS.find(o => o.key === 'sleeve');
  assert.deepEqual([...sleeve.choices.map(x => x[0])], ['short', 'long']);
  assert.ok(!panel({}).active.some(o => o.key === 'dutyTitle'), 'the title field appears when a title is chosen');
  assert.ok(panel({ poloMark: 'title' }).active.some(o => o.key === 'dutyTitle'));
});

test('the screen-printed shirt switches the name, badge and title off and cites 5.3.2.1.2', () => {
  const { active, c } = panel({ poloShirt: 'print', poloMark: 'title' });
  for(const k of ['poloName', 'poloMark', 'dutyTitle']){
    const o = active.find(x => x.key === k);
    assert.match(o.off(c), /5\.3\.2\.1\.2/, k);
  }
  const knit = panel({ poloShirt: 'embroidered', poloMark: 'title' });
  for(const k of ['poloName', 'poloMark', 'dutyTitle']) assert.equal(knit.active.find(x => x.key === k).off(knit.c), '', k);
});

test('a saved setup keeps only values the panel can produce, the duty title cleaned and cut to 30 characters', () => {
  const { O } = panel({});
  const out = O.sanitize({ poloShirt: 'print', poloCut: 'male', poloMark: 'title', poloName: false, baseballCap: true,
    dutyTitle: '<b>Squadron Commander</b> of the very long named unit here', poloShirt2: 'x' });
  assert.equal(out.poloShirt, 'print');
  assert.equal(out.poloCut, 'male');
  assert.equal(out.poloName, false);
  assert.equal(out.baseballCap, true);
  assert.ok(!/[<>]/.test(out.dutyTitle) && out.dutyTitle.length <= 30);
  assert.equal(Object.keys(O.sanitize({ poloShirt: 'bogus', poloMark: 'x', dutyTitle: 5 })).length, 0);
});

test('the page builds the polo options with defaults and asks for the first name (5.3.2.1.1); a polo badge choice is saved', () => {
  const view = read('js/uniform-view.js');
  assert.match(view, /poloShirt: 'embroidered', poloCut: '', poloName: true, poloMark: 'badge', dutyTitle: '', baseballCap: false/);
  assert.match(read('js/garment-options.js'), /first\.hidden = !FLIGHT\.includes\(u\) && u !== 'polo'/);
  assert.match(read('js/wiring.js'), /BADGE_POSITIONS = \['aviation', 'over-pocket', 'service', 'pocket', 'polo'\]/);
  assert.match(read('js/badge-rules.js'), /allowsBadgeFamily\(State\.uniform, family\)/);
});
