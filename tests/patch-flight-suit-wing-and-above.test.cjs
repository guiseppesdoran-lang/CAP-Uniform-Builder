'use strict';
// Ethan, 2 November 2026, after talking with Doran: "for FDUs you can only wear wing and higher patches." CAPR 39-1 8.2.4.5 (flight duty uniform) and 8.3.4.5
// (Corporate Flight Duty Uniform): "An authorized patch contained as outlined in Attachment 4 may be worn, except organizational patches for groups, squadrons
// or flights are not approved for wear." b8db6c62 limited the Unit patch list; this audits every other way a patch reaches the two flight suits (the patch
// catalog the Patches chooser and the placement picker read, the unit patches filed by charter number, the saved unit choice) and proves nothing organizational
// below a wing is offered, while the activity, course and qualification patches of Attachment 4 stay allowed.

const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { loadPageScripts } = require('./helpers/page-scripts.cjs');

const { context } = loadPageScripts();
const ev = src => { const v = vm.runInContext(src, context); return v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v; };
const FLIGHT = ['flight_suit', 'corporate_flight_suit'];
const j = JSON.stringify;

test('every patch the catalog authorizes on a flight suit is a wing, region, national or activity patch: no unit patch of a group, squadron or flight, for either membership', () => {
  const charterOf = ev('Object.fromEntries(Object.keys(PATCH_META).map(id => [id, getUnitPatchCharters(id)]))');
  for(const u of FLIGHT) for(const m of ['senior', 'cadet']){
    const offered = ev(`Object.keys(PATCH_META).filter(id => isPatchAuthorizedForUniform(id, ${j(u)}, ${j(m)}))`);
    assert.ok(offered.length > 20, `${u} ${m}: the activity patches stay (${offered.length})`);
    for(const id of offered){
      // A unit patch (one filed under charter numbers) is offered only when every charter it stands for is a wing, a region or National Headquarters.
      for(const code of charterOf[id]) assert.ok(['wing', 'region', 'national'].includes(ev(`getUnitEchelon(${j(code)})`)), `${u} ${m}: ${id} is the patch of ${code}, below a wing`);
      const meta = ev(`PATCH_META[${j(id)}]`);
      assert.ok(!/\b(squadron|group)\b/i.test(meta.label || ''), `${u} ${m}: ${id} (${meta.label}) names a squadron or group (National Flight Academy is a course, not a flight)`);
      assert.ok(!meta.echelon || ['wing', 'region', 'national'].includes(meta.echelon), `${u} ${m}: ${id} is filed at the ${meta.echelon} level`);
    }
  }
});

test('the two squadron patches the catalog holds (SER-TN-185, SER-TN-330) are refused on both flight suits with the paragraph, in the Patches chooser tile and for a saved unit choice', () => {
  for(const [u, para] of [['flight_suit', '8.2.4.5'], ['corporate_flight_suit', '8.3.4.5']]){
    for(const [id, code] of [['tn185_ocp_patch', 'SER-TN-185'], ['tn330_ocp_patch', 'SER-TN-330']]){
      assert.equal(ev(`isPatchAuthorizedForUniform(${j(id)}, ${j(u)}, 'senior')`), false, `${u} ${id}`);
      assert.equal(ev(`isPatchAuthorizedForUniform(${j(id)}, ${j(u)}, 'cadet')`), false, `${u} ${id} cadet`);
      const tile = ev(`patchTileHtml(${j(id)}, { uniformId: ${j(u)}, membership: 'senior' })`);
      assert.match(tile, new RegExp(`not a group or squadron patch \\(CAPR 39-1, ${para.replace(/\./g, '\\.')}\\)`), `${u} ${id}: the tile says why`);
      assert.doesNotMatch(tile, /<select/, `${u} ${id}: no placement picker for a patch that is not worn`);
      // The placement picker offers no place for it, and a saved unit choice is not drawn.
      ev(`State.uniform = ${j(u)}; State.membership = 'senior'; State.unitPatchCharter = ${j(code)}`);
      assert.equal(ev('isUnitPatchAuthorizedForCurrentUniform()'), false, `${u} ${code}: the saved unit choice is not worn`);
      assert.equal(ev(`isUnitCharterWornOnUniform(${j(code)}, ${j(u)})`), false);
    }
  }
  ev(`State.unitPatchCharter = ''`);
});

test('the wing and region patches and the National Staff patch stay offered on both flight suits; so do the course, qualification and activity patches of Attachment 4 (NESA, PJOC, check pilot, orientation pilot, the academies, ARCHER, CISM)', () => {
  for(const u of FLIGHT){
    for(const id of ['nywg_patch', 'ner_patch', 'national_staff_ocp_patch', 'nesa_patch', 'pjoc_patch', 'check_pilot_patch', 'proficient_pilot_patch', 'orientation_pilot_patch', 'cos_patch', 'nfa_patch', 'cla_patch', 'engineering_academy_patch', 'civil_engineering_academy_patch', 'honor_guard_academy_patch', 'nbb_patch', 'archer_patch', 'cism_patch'])
      assert.equal(ev(`isPatchAuthorizedForUniform(${j(id)}, ${j(u)}, 'senior')`), true, `${u} ${id}`);
  }
});

test('the Unit patch chooser lists wing, region and national units only on both flight suits; every unit it lists is worn there, and none of the 1,300 group, squadron and flight charters is', () => {
  const total = ev('CAP_UNIT_OPTIONS.length');
  for(const u of FLIGHT){
    const shown = ev(`CAP_UNIT_OPTIONS.filter(x => isUnitCharterWornOnUniform(x.code, ${j(u)}))`);
    assert.ok(shown.length > 100 && shown.length < total / 4, `${u}: ${shown.length} of ${total}`);
    for(const x of shown) assert.ok(['wing', 'region', 'national'].includes(ev(`getUnitEchelon(${j(x.code)})`)), `${u}: ${x.code} ${x.name}`);
    const hidden = ev(`CAP_UNIT_OPTIONS.filter(x => !isUnitCharterWornOnUniform(x.code, ${j(u)})).map(x => getUnitEchelon(x.code))`);
    assert.equal(hidden.length + shown.length, total);
    assert.ok(hidden.every(l => l === 'group' || l === 'squadron'), `${u}: what is left out is group or squadron level`);
    assert.ok(hidden.length > 1200, `${u}: ${hidden.length} left out`);
  }
});
