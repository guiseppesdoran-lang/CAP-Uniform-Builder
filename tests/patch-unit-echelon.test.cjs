'use strict';
// Doran: "only wing and above unit patches can be worn on the flight suit. But it's allowing me to select general units." CAPR 39-1
// 8.2.4.5 (flight duty uniform) and 8.3.4.5 (Corporate Flight Duty Uniform): an authorized patch may be worn on the right sleeve, "except
// organizational patches for groups, squadrons or flights are not approved for wear". The Unit patch list (js/catalog.js
// buildUnitPatchSelector) therefore offers only a wing's, a region's or National Headquarters' units there, one line says so, and a unit
// patch of a squadron or group is not authorized on the flight suits. The other field uniforms list every unit.

const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { loadPageScripts } = require('./helpers/page-scripts.cjs');

const { context } = loadPageScripts();
const ev = src => { const v = vm.runInContext(src, context); return v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v; };
const echelon = code => ev(`getUnitEchelon(${JSON.stringify(code)})`);
const worn = (code, u) => ev(`isUnitCharterWornOnUniform(${JSON.stringify(code)}, ${JSON.stringify(u)})`);

test('the level of a unit from its charter number', () => {
  assert.equal(echelon('NER-NER-001'), 'region');
  assert.equal(echelon('GLR-GLR-000'), 'region');
  assert.equal(echelon('NER-NY-001'), 'wing');
  assert.equal(echelon('SER-TN-000'), 'wing');
  assert.equal(echelon('NHQ-NHQ-000'), 'national');
  assert.equal(echelon('NHQ-NHQ-OPS'), 'national');
  assert.equal(echelon('SER-TN-185'), 'squadron');
  assert.equal(echelon('TN-330'), 'squadron');
  assert.equal(echelon('NHQ-NHQ-103'), 'squadron', 'an overseas cadet squadron');
  assert.equal(echelon('GLR-IL-104'), 'group', 'GROUP 4 HEADQUARTERS');
});

test('the flight suits list only wing, region and national units; the other uniforms list every unit', () => {
  const total = ev('CAP_UNIT_OPTIONS.length');
  assert.ok(total > 1000);
  for(const u of ['flight_suit', 'corporate_flight_suit']){
    const shown = ev(`CAP_UNIT_OPTIONS.filter(x => isUnitCharterWornOnUniform(x.code, ${JSON.stringify(u)})).map(x => getUnitEchelon(x.code))`);
    assert.ok(shown.length > 50 && shown.length < total / 4, `${u}: ${shown.length} of ${total}`);
    assert.ok(shown.every(l => ['wing', 'region', 'national'].includes(l)), `${u}: no group, squadron or flight`);
    assert.equal(worn('SER-TN-185', u), false);
    assert.equal(worn('SER-TN-001', u), true);
    assert.equal(worn('SER-SER-001', u), true);
    assert.equal(worn('NHQ-NHQ-000', u), true);
  }
  for(const u of ['abu', 'ocp', 'corporate_field', 'blues_a']) assert.equal(worn('SER-TN-185', u), true, u);
});

test('a squadron\'s patch is not authorized on the flight suits, with the paragraph in the reason; a wing patch and the National Staff patch still are', () => {
  for(const [u, para] of [['flight_suit', '8.2.4.5'], ['corporate_flight_suit', '8.3.4.5']]){
    for(const id of ['tn185_ocp_patch', 'tn330_ocp_patch']){
      assert.equal(ev(`isPatchAuthorizedForUniform(${JSON.stringify(id)}, ${JSON.stringify(u)}, 'senior')`), false, `${u} ${id}`);
      assert.match(ev(`getPatchAuthorizationReason(${JSON.stringify(id)}, ${JSON.stringify(u)}, 'senior')`), new RegExp(`Only a wing, region or national patch is worn on .*, not a group or squadron patch \\(CAPR 39-1, ${para.replace(/\./g, '\\.')}\\)\\.`));
    }
    for(const id of ['nywg_patch', 'ner_patch', 'national_staff_ocp_patch']) assert.equal(ev(`isPatchAuthorizedForUniform(${JSON.stringify(id)}, ${JSON.stringify(u)}, 'senior')`), true, `${u} ${id}`);
  }
  for(const u of ['abu', 'ocp', 'corporate_field']) assert.equal(ev(`isPatchAuthorizedForUniform('tn185_ocp_patch', ${JSON.stringify(u)}, 'senior')`), true, u);
});

test('the Unit patch status says it in one line on the flight suits only; a saved squadron choice is named as not worn', () => {
  ev(`State.uniform = 'flight_suit'; State.unitPatchCharter = ''`);
  assert.equal(ev('getUnitPatchFloorNote()'), 'Only wing, region and national units are listed: the flight suit takes no group or squadron patch (CAPR 39-1, 8.2.4.5).');
  ev(`State.uniform = 'corporate_flight_suit'`);
  assert.match(ev('getUnitPatchFloorNote()'), /Corporate Flight Duty Uniform takes no group or squadron patch \(CAPR 39-1, 8\.3\.4\.5\)/);
  ev(`State.uniform = 'ocp'`);
  assert.equal(ev('getUnitPatchFloorNote()'), '');
  ev(`State.uniform = 'flight_suit'; State.unitPatchCharter = 'SER-TN-185'`);
  assert.equal(ev('isUnitPatchAuthorizedForCurrentUniform()'), false);
  ev(`State.unitPatchCharter = ''`);
});
