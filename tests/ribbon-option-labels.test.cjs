'use strict';
// LIVE14 E72 (Ethan, on the Cadet Advisory Council select: "remove the star things, make them all like region level").
// An award select's option names the level or the count; the device it brings is said by the line under the select
// (data/ribbon-awards.js describe), not by a parenthetical in the option.
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { loadPageScripts } = require('./helpers/page-scripts.cjs');

const { context } = loadPageScripts();
const ev = src => { const v = vm.runInContext(src, context); return v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v; };
const options = (id, membership) => ev(`(() => { State.membership = ${JSON.stringify(membership)}; return getRibbonAwardOptions(${JSON.stringify(id)}).filter(o => o.value).map(o => ({ value: o.value, label: o.label })); })()`);
const describe = (id, value, label) => ev(`CAPUBRibbonAwards.describe(${JSON.stringify(id)}, { awardValue: ${JSON.stringify(value)}, awardLabel: ${JSON.stringify(label)}, membership: 'cadet' })`);

test('the Cadet Advisory Council select reads Group, Wing, Region and National level, and each still wears its star (39-3 21j)', () => {
  assert.deepEqual(options('cadet_advisory_council_ribbon', 'cadet'), [
    { value: 'cac_group', label: 'Group level' }, { value: 'cac_wing', label: 'Wing level' },
    { value: 'cac_region', label: 'Region level' }, { value: 'cac_national', label: 'National level' }]);
  const said = options('cadet_advisory_council_ribbon', 'cadet').map(o => describe('cadet_advisory_council_ribbon', o.value, o.label));
  assert.deepEqual(said, ['Basic ribbon, no devices', 'Devices: bronze star (wing level)', 'Devices: silver star (region level)', 'Devices: gold star (national level)']);
  const drawn = options('cadet_advisory_council_ribbon', 'cadet').map(o => ev(`CAPUBRibbonAwards.resolve('cadet_advisory_council_ribbon', { awardValue: ${JSON.stringify(o.value)}, awardLabel: ${JSON.stringify(o.label)} })[0].devices`));
  assert.deepEqual(drawn, [[], ['device-star-bronze'], ['device-star-silver'], ['device-star-gold']]);
});

test('the Goddard options name the credit, not the stars, and still wear them (39-3 14h)', () => {
  const opts = options('goddard_achievement', 'cadet');
  assert.deepEqual(opts.map(o => o.label), ['Earned', 'Earned with Honor Credit', 'Earned + Model Rocketry Badge (Mitchell required)', 'Earned + Honor Credit and Model Rocketry Badge']);
  assert.deepEqual(opts.map(o => describe('goddard_achievement', o.value, o.label)), ['Basic ribbon, no devices', 'Devices: silver star (honor credit)',
    'Devices: silver star (Model Rocketry Badge)', 'Devices: silver star (honor credit), silver star (Model Rocketry Badge)']);
});

test('no option of any ribbon, cadet or senior, carries a parenthetical naming a device', () => {
  const device = /\([^)]*\b(?:no device|stars?|clasps?|propellers?|oak leaf|olc|v[- ]device)\b[^)]*\)/i;
  const found = [];
  for(const membership of ['cadet', 'senior']){
    for(const id of ev('ribbonList')){
      for(const o of options(id, membership)) if(device.test(o.label)) found.push(`${membership} ${id}: ${o.label}`);
    }
  }
  assert.deepEqual([...new Set(found)], []);
});

test('a setup saved with the old label shows the new one and keeps its star', () => {
  ev(`State.membership = 'cadet'; State.ribbonSelections = {
    cadet_advisory_council_ribbon: { checked: true, devices: {}, awardValue: 'cac_wing', awardLabel: 'Wing level (bronze star)' },
    goddard_achievement: { checked: true, devices: {}, awardValue: 'rocketry_star', awardLabel: 'Earned + Model Rocketry Badge (silver star, Mitchell required)' } };
    normalizeRibbonSelections();`);
  const cac = ev('State.ribbonSelections.cadet_advisory_council_ribbon');
  assert.equal(cac.awardLabel, 'Wing level');
  assert.equal(describe('cadet_advisory_council_ribbon', cac.awardValue, cac.awardLabel), 'Devices: bronze star (wing level)');
  assert.equal(ev('State.ribbonSelections.goddard_achievement.awardLabel'), 'Earned + Model Rocketry Badge (Mitchell required)');
});
