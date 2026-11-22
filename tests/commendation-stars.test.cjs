'use strict';
// The Commander's Commendation Award's two star switches (the owner, 2026-11-19: "why is it blocking me frm selecting the national commanders star after ibe selected region?").
// CAPR 39-3, 9f: a bronze star when the region commander authorized the award, a silver star when the National Commander did, and "only one bronze or silver star (one star of each type)
// will be worn" with several awards: both stars are allowed from the second award on. So neither switch is ever blocked, every count has an option for every star it may carry, the
// second star while the count is one makes the count two, and lowering the count to one while both are on keeps the silver star.

const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { createDocument } = require('./helpers/mini-dom.cjs');
const { loadPageScripts } = require('./helpers/page-scripts.cjs');

const RA = require('../data/ribbon-awards.js');
const { context } = loadPageScripts();
const ev = src => vm.runInContext(src, context);
const evj = src => JSON.parse(JSON.stringify(vm.runInContext(src, context)));
ev('rebuildRibbonsFromGallery = function(){}; renderRack = function(){}; renderAllBadges = function(){};');
ev(`State.membership = 'senior'; State.uniform = 'blues_a'; State.rank = 'Capt'; State.ribbonSelections = {}; State.militaryUIState = {}; State.gradeRibbons = null`);
const ID = 'commander_commendation_award';
const q = JSON.stringify;
const options = () => evj(`getRibbonAwardOptions(${q(ID)}).filter(o => o.value).map(o => ({ value: o.value, label: o.label }))`);
const set = value => ev(`setRibbonSelectionFromDropdown(${q(ID)}, ${q(value)}, { deferRender: true })`);
const controls = () => evj(`getRibbonControls(${q(ID)})`);
const sel = () => evj(`State.ribbonSelections[${q(ID)}]`);
const toggle = (c, key) => c.toggles.find(t => t.key === key);
const flagsOf = o => [/National Cmdr|Region\+Natl/.test(o.label) ? 'national' : '', /Region Cmdr|Region\+Natl/.test(o.label) ? 'region' : ''].filter(Boolean).join('+');
const countOf = o => RA.readCount(ID, o.value, o.label);

test('every count from 1 to 84 has an option for the region star, the National star and, from the second award, both', () => {
  const have = new Map();
  for(const o of options()) have.set(`${countOf(o)}|${flagsOf(o)}`, o.value);
  for(let n = 1; n <= 84; n++){
    for(const flags of ['', 'region', 'national']) assert.ok(have.has(`${n}|${flags}`), `award ${n}, stars "${flags}"`);
    if(n >= 2) assert.ok(have.has(`${n}|national+region`), `award ${n} with both stars`);
  }
  assert.equal(have.has('1|national+region'), false, 'one award has one authority: no option with both at the first award');
});

test('neither switch is ever blocked and no line of the dropdown is greyed, whichever option the selection is on', () => {
  for(const o of options()){
    const c = evj(`CAPUBRibbonAwards.controls(${q(ID)}, getRibbonAwardOptions(${q(ID)}).filter(x => x.value), ${q(o)}, { membership: 'senior', military: false })`);
    assert.deepEqual(c.toggles.map(t => t.key), ['region', 'national']);
    for(const t of c.toggles) assert.ok(t.next, `${o.value}: the ${t.key} switch has an option to go to`);
    for(const l of c.lines) assert.equal(l.enabled, true, `${o.value}: the line ${l.text} is not greyed`);
  }
});

test('the second star while the count is one raises the count to two; the dropdown shows it; the first star stays', () => {
  set('mcchord_13700');                                  // 1st award
  let c = controls();
  set(toggle(c, 'region').next);                         // region star: the 1st award with the bronze star
  c = controls();
  assert.equal(toggle(c, 'region').on, true);
  assert.match(c.lines.find(l => l.value === c.selected).text, /^1st award/);
  const press = toggle(c, 'national').next;              // the National star as well
  assert.equal(press, 'mcchord_46202', 'the 2nd award with both stars');
  set(press);
  c = controls();
  assert.match(c.lines.find(l => l.value === c.selected).text, /^2nd award/, 'the count rose to two');
  assert.equal(toggle(c, 'region').on, true);
  assert.equal(toggle(c, 'national').on, true);
  // The same from a National star first, and well past the 21 awards the older lists stopped at.
  set('mcchord_42001');
  c = controls();
  assert.equal(toggle(c, 'region').next, 'mcchord_46202');
  set('capub_total_30');
  c = controls();
  set(toggle(c, 'region').next);
  c = controls();
  set(toggle(c, 'national').next);
  assert.equal(sel().awardValue, 'capub_total_30_national_region');
  assert.match(sel().awardLabel, /^30th Award \(Region\+Natl\)$/);
  // A star turned off is the same count without it.
  c = controls();
  set(toggle(c, 'region').next);
  assert.equal(sel().awardValue, 'capub_total_30_national');
});

test('lowering the count to one while both stars are on keeps the silver star (the higher) and turns the bronze one off', () => {
  set('mcchord_46203');                                  // 3rd award, both stars
  let c = controls();
  const first = c.lines.find(l => /^1st award/.test(l.text));
  assert.equal(first.enabled, true);
  assert.equal(first.value, 'mcchord_42001', 'the 1st award with the National star');
  set(first.value);
  c = controls();
  assert.equal(toggle(c, 'national').on, true);
  assert.equal(toggle(c, 'region').on, false);
  // Count two keeps both.
  const second = c.lines.find(l => /^2nd award/.test(l.text));
  assert.equal(second.value, 'mcchord_42002', 'from the National star alone it is that star at two');
  set('mcchord_46203');
  assert.equal(controls().lines.find(l => /^2nd award/.test(l.text)).value, 'mcchord_46202');
});

test('the two behaviours of the second star are one function: raise (the count becomes two) or swap (the first star goes off)', () => {
  const press = (mode, count, have, key) => { const r = RA.pressStar(count, have, key, mode); return { count: r.count, flags: [...r.flags].sort() }; };
  assert.deepEqual(press('raise', 1, ['region'], 'national'), { count: 2, flags: ['national', 'region'] });
  assert.deepEqual(press('swap', 1, ['region'], 'national'), { count: 1, flags: ['national'] });
  for(const mode of ['raise', 'swap']){
    assert.deepEqual(press(mode, 2, ['region'], 'national'), { count: 2, flags: ['national', 'region'] }, `${mode}: from the second award both stars are allowed`);
    assert.deepEqual(press(mode, 1, [], 'region'), { count: 1, flags: ['region'] }, `${mode}: the first star changes no count`);
    assert.deepEqual(press(mode, 5, ['national', 'region'], 'region'), { count: 5, flags: ['national'] }, `${mode}: a star turned off`);
  }
  assert.equal(RA.pressStar(1, ['region'], 'national').count, 2, 'the default is to raise the count');
  assert.deepEqual([...RA.starsAtCount(1, ['national', 'region'])], ['national']);
  assert.deepEqual([...RA.starsAtCount(2, ['national', 'region'])].sort(), ['national', 'region']);
});

test('the devices drawn for every count and star combination follow 9f and 6b: one star of each type to the wearer\'s right of the clasps, at most four devices on a ribbon, a second ribbon that counts as one award', () => {
  const D = RA.DEVICES;
  for(const o of options()){
    const flags = flagsOf(o), n = countOf(o);
    const parts = RA.resolve(ID, { awardValue: o.value, awardLabel: o.label, membership: 'senior' });
    const all = parts.flatMap(p => p.devices);
    assert.equal(all.filter(d => d === D.starB).length, /region/.test(flags) ? 1 : 0, `${o.value}: the bronze star, one at most`);
    assert.equal(all.filter(d => d === D.starS).length, /national/.test(flags) ? 1 : 0, `${o.value}: the silver star, one at most`);
    for(const p of parts) assert.ok(p.devices.length <= 4, `${o.value}: ${p.devices.length} devices on a ribbon`);
    // The stars lead the first ribbon (the wearer's right first) and no clasp is before them; the other ribbons have clasps only.
    const stars = parts[0].devices.filter(d => d === D.starB || d === D.starS).length;
    assert.ok(parts[0].devices.slice(0, stars).every(d => d === D.starB || d === D.starS), `${o.value}: the stars are to the right of the clasps`);
    for(const p of parts.slice(1)) assert.ok(p.devices.every(d => d === D.claspB || d === D.claspS), `${o.value}: a second ribbon has clasps only`);
    // The awards add up: a ribbon is one award, a bronze clasp one more, a silver clasp five; the stars are not awards.
    const awards = parts.reduce((a, p) => a + 1 + p.devices.reduce((b, d) => b + (d === D.claspB ? 1 : d === D.claspS ? 5 : 0), 0), 0);
    assert.equal(awards, n, `${o.value}: ${n} awards`);
  }
});

test('the options of the older lists and a setup saved before still load: the same value is the same option', () => {
  const known = { earned: 'mcchord_13700', region_bronze_star: 'mcchord_46101', national_silver_star: 'mcchord_42001', region_bronze_star_bronze_clasp_1: 'mcchord_46102',
    national_silver_star_bronze_clasp_1: 'mcchord_42002', national_silver_star_bronze_clasp_2: 'mcchord_42003', mcchord_46203: 'mcchord_46203', capub_total_30: 'capub_total_30', capub_total_84: 'capub_total_84' };
  for(const [value, want] of Object.entries(known)) assert.equal(evj(`getRibbonSelectionOption(${q(ID)}, ${q(value)}).value`), want, value);
  const first21 = options().filter(o => /^mcchord_/.test(o.value)).map(o => o.value);
  assert.equal(first21.length, 21 * 3 + 20, 'the first 21 awards are the list\'s own: plain, region, National, and both from the second');
  assert.equal(new Set(options().map(o => o.value)).size, options().length, 'no value twice');
});

// ---- the page's own control: the switches under the tile ----------------------------------------------------------------------------------------------

test('the tile\'s two switches are both pressable at the first award: the second turns the count to two and the dropdown shows it', () => {
  const doc = createDocument();
  global.document = doc;
  const VisualPicker = require('../js/visual-picker.js');
  const Lists = require('../js/pick-lists.js');
  ev(`State.ribbonSelections = {}`);
  ev('normalizeRibbonSelections()');
  const deps = Object.assign(ev('CAPUBPickLists.pageDeps()'), { VisualPicker, asset: p => 'images/' + p, drawRibbon(){}, drawMini(){}, fallback(){} });
  const host = doc.createElement('div'); doc.body.append(host);
  Lists.ribbonLists(host, deps);
  const all = (node, s) => Array.from(node.querySelectorAll(s));
  const cell = () => all(host, '.vpCell').find(c => c.dataset.value === ID);
  cell().querySelector('.vpOption').click();
  const sw = key => all(cell(), '.ribbonToggle').find(b => b.dataset.value === key);
  assert.equal(all(cell(), '.ribbonToggle').length, 2);
  assert.ok(all(cell(), '.ribbonToggle').every(b => b.getAttribute('disabled') === null), 'neither switch is disabled');
  sw('region').click();
  assert.equal(sw('region').getAttribute('aria-pressed'), 'true');
  assert.equal(sw('national').getAttribute('disabled'), null, 'the National star is not blocked after the region star');
  sw('national').click();
  assert.equal(sw('region').getAttribute('aria-pressed'), 'true');
  assert.equal(sw('national').getAttribute('aria-pressed'), 'true');
  assert.equal(cell().querySelector('.ribbonSelectShown').textContent, '2nd', 'the count rose to the second award');
});

// ---- the ribbons with one device switch: the lifesaving star, the Presidential V, the aircrew propeller ------------------------------------------------

test('the lifesaving star, the Presidential V and the aircrew propeller have an option with the device and one without at every count: no switch and no line is ever greyed', () => {
  const D = RA.DEVICES;
  const ones = { lifesaving_award: { key: 'star', device: D.starS, per: 3 }, disaster_relief_ribbon: { key: 'v', device: D.vS, per: 4 }, search_find_ribbon: { key: 'aircrew', device: D.propB, per: 4 }, air_search_and_rescue_ribbon: { key: 'aircrew', device: D.propB, per: 4 } };
  for(const [id, spec] of Object.entries(ones)){
    const opts = evj(`getRibbonAwardOptions(${q(id)}).filter(o => o.value).map(o => ({ value: o.value, label: o.label }))`);
    const counts = opts.map(o => RA.readCount(id, o.value, o.label));
    const top = Math.max(...counts);
    assert.ok(top >= 21, `${id}: counts to ${top}`);
    const key = new Set(opts.map(o => `${RA.readCount(id, o.value, o.label)}|${RA.resolve(id, { awardValue: o.value, awardLabel: o.label, membership: 'senior' })[0].devices.includes(spec.device) ? 1 : 0}`));
    for(let n = 1; n <= top; n++){ assert.ok(key.has(`${n}|0`), `${id}: award ${n} without the device`); assert.ok(key.has(`${n}|1`), `${id}: award ${n} with the device`); }
    assert.deepEqual(counts, [...counts].sort((a, b) => a - b), `${id}: the options are in the order of their counts`);
    for(const o of opts){
      const c = evj(`CAPUBRibbonAwards.controls(${q(id)}, getRibbonAwardOptions(${q(id)}).filter(x => x.value), ${q(o)}, { membership: 'senior', military: false })`);
      for(const t of c.toggles) assert.ok(t.next, `${id} ${o.value}: the ${t.key} switch has an option to go to`);
      for(const l of c.lines) assert.equal(l.enabled, true, `${id} ${o.value}: the line ${l.text} is not greyed`);
      // 9h / 21g / 21c / 21d and 6b: the limit of devices on a ribbon, the device once, a second ribbon only with clasps.
      const parts = RA.resolve(id, { awardValue: o.value, awardLabel: o.label, membership: 'senior' });
      for(const p of parts) assert.ok(p.devices.length <= spec.per, `${id} ${o.value}: ${p.devices.length} devices on a ribbon`);
      assert.ok(parts.flatMap(p => p.devices).filter(d => d === spec.device).length <= 1, `${id} ${o.value}: the device once`);
    }
  }
});
