'use strict';
// Patch names are the regulation's (audit 4 November 2026): CAPR 39-1 10.9 names each patch and Attachment 8 prints the figure captions. The
// "DOG", "Plane" and "OCP sleeve" wording is gone, the two Fig A8-2 special activity patches the list had left out of the NCSA group (so the
// Corporate Field Uniform's right sleeve never took them) are in it, and the Legacy Communications Patch (the Communications Patch, 10.9.18, twice over) and the
// Aerospace Education Patch (no paragraph, no picture) are no longer offered.

const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { loadPageScripts } = require('./helpers/page-scripts.cjs');

const { context } = loadPageScripts();
const ev = src => { const v = vm.runInContext(src, context); return v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v; };

test('each patch is named as the regulation names it', () => {
  const want = {
    check_pilot_patch: 'National Check Pilot Patch',            // 10.9.10
    proficient_pilot_patch: 'Pilot Proficiency Patch',          // 10.9.11
    orientation_pilot_patch: 'Cadet Orientation Pilot Patch',   // 10.9.15
    plane_patch: 'Emergency Services Patch (style 1)',          // 10.9.21 "style 1 & 2"
    dog_patch: 'Emergency Services Patch (style 2)',
    cism_patch: 'Critical Incident Stress Management (CISM) Patch', // 10.9.24
    archer_patch: 'ARCHER Patch',                               // 10.9.23 prints it so
    comms_patch: 'Communications Patch',                        // 10.9.18
    undergrad_pilot_training_patch: 'Specialized Undergraduate Pilot Training Familiarization Course Patch', // Fig A8-2
    af_space_command_patch: 'Air Force Space Command Familiarization Course Patch',
    civil_engineering_academy_patch: 'Air Force Civil Engineering Academy Patch',
    nesa_patch: 'National Emergency Services Academy Patch',
    pjoc_patch: 'Pararescue Orientation Course Patch'
  };
  for(const [id, label] of Object.entries(want)) assert.equal(ev(`PATCH_META[${JSON.stringify(id)}].label`), label, id);
});

test('the OCP forms of the patches carry the patch\'s name, with no "OCP sleeve" suffix', () => {
  const labels = ev(`Object.entries(PATCH_META).filter(([id, m]) => m.ocpVariant).map(([id, m]) => [id, m.label, PATCH_META[m.basePatchId].label])`);
  assert.ok(labels.length > 10);
  for(const [id, label, base] of labels) assert.equal(label, base, id);
  const all = ev(`patchList.map(id => PATCH_META[id] && PATCH_META[id].label).filter(Boolean)`);
  assert.ok(all.every(l => !/OCP sleeve|^DOG |^Plane |^Legacy |^Proficient |^Orientation Pilot/.test(l)), all.filter(l => /OCP sleeve|^DOG |^Plane |^Legacy/.test(l)).join(', '));
});

test('the Space Command and Specialized Undergraduate Pilot Training patches are NCSA patches (Fig A8-2) and take the places NESA takes', () => {
  for(const id of ['af_space_command_patch', 'undergrad_pilot_training_patch']){
    assert.equal(ev(`NCSA_PATCH_IDS.has(${JSON.stringify(id)})`), true, id);
    ev(`State.uniform = 'corporate_field'; State.membership = 'senior'`);
    const places = ev(`getPatchPlaces(${JSON.stringify(id)}).map(p => p.slot)`);
    const nesa = ev(`getPatchPlaces('nesa_patch').map(p => p.slot)`);
    assert.deepEqual(places, nesa, `${id} has NESA's places on the CFU`);
    assert.ok(places.includes('R_SHOULDER'), `${id} may be worn on the CFU's right sleeve (5.2.1.1.2.3)`);
  }
});

test('the Legacy Communications Patch and the Aerospace Education Patch are no longer offered; a saved setup keeps its meaning', () => {
  const list = ev('patchList.slice()');
  assert.ok(!list.includes('communications_patch') && !list.includes('aerospace_education_patch'));
  assert.equal(ev(`PATCH_ALIASES.communications_patch`), 'comms_patch');
  assert.ok(list.includes('comms_patch'));
});
