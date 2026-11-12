'use strict';
// The page's side of the supplements: the member's unit is asked for once, in the Profile step, whatever uniform is chosen (the Patches card is not shown on Blues,
// the aviator shirt, the polo and the dress uniforms, where the unit patch control used to be); a saved build, the report import and the unit patch keep working; the
// section of supplements follows the unit; the wing's patch a supplement requires is selected and may be taken off again; the cord picker is told when the cords change.
// The owner: "when members select units within a wing/region that is a supplement, the supplement should load".

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadPageScripts } = require('./helpers/page-scripts.cjs');

const read = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const html = read('index.html');
const aside = html.slice(html.indexOf('<aside id="controls"'), html.indexOf('</aside>'));
const stepOf = id => {
  const at = aside.indexOf(`id="${id}"`);
  if(at < 0) return null;
  const groups = [...aside.matchAll(/id="stepGroup-([a-z]+)"/g)].filter(m => m.index < at);
  return groups.length ? groups[groups.length - 1][1] : null;
};
const { context, referenceErrors } = loadPageScripts();
const ev = src => { const v = vm.runInContext(src, context); return v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v; };
const j = JSON.stringify;
const UNIFORMS = ['blues_a', 'blues_b', 'mess_dress', 'semi_formal', 'semi_formal_usaf', 'aviator', 'aviator_blazer', 'polo', 'corporate_field', 'abu', 'ocp', 'flight_suit', 'corporate_flight_suit'];
// The page's scripts the builder runs once the elements exist: rebuilding the galleries needs a real page, so they are stood in for.
ev(`for(const n of ['buildPatchGallery','renderPatches','syncShoulderCordControl','fullRender']) globalThis[n] = function(){}; globalThis.rebuildPatchesFromGallery = function(){
  State.patches = []; normalizePatchSelections();
  for(const id of patchList) if(State.patchSelections[id]?.checked && isPatchAuthorizedForUniform(id)) State.patches.push(id);
}`);
const reset = () => ev(`State.membership = 'cadet'; State.rank = 'C/Capt'; State.gender = 'male'; State.uniform = 'blues_a'; State.unitPatchCharter = ''; State.patches = []; State.patchSelections = {}; State.shoulderCord = null; State.supplementCordsEarned = null; State.reportAuthorizedBadgeIds = null`);

test('the page loads the supplements: the data, then the logic after the catalog and before the first render', () => {
  assert.deepEqual(referenceErrors, []);
  const tags = [...html.matchAll(/<script src="([^"?]+)[^"]*" defer><\/script>/g)].map(m => m[1]);
  const at = src => tags.indexOf(src);
  assert.ok(at('data/supplements.js') > 0 && at('data/supplements.js') < at('js/supplements.js'));
  assert.ok(at('js/supplements.js') > at('js/catalog.js') && at('js/supplements.js') < at('js/bootstrap.js'));
  assert.equal(ev("typeof Supplements.cords + typeof Supplements.forUnit + typeof Supplements.items"), 'functionfunctionfunction');
});

test('the unit is asked for once, in the Profile step, where every uniform reaches it; the Patches card keeps only the patch\'s status', () => {
  for(const id of ['unitPatchSearch', 'unitPatchSelect']){
    assert.equal([...html.matchAll(new RegExp(`(?<![-\\w])id="${id}"`, 'g'))].length, 1, `${id} is on the page once`);
    assert.equal(stepOf(id), 'profile', `${id} is in the Profile step`);
  }
  const profile = aside.slice(aside.indexOf('id="stepGroup-profile"'), aside.indexOf('id="stepGroup-uniform"'));
  assert.ok(profile.indexOf('id="rankSetupSelect"') < profile.indexOf('id="genderBlock"') && profile.indexOf('id="genderBlock"') < profile.indexOf('id="unitPanel"') && profile.indexOf('id="unitPanel"') < profile.indexOf('id="optionalName"'), 'rank, the cut, the unit, the name');
  assert.match(profile, /<label class="fieldLabel" for="unitPatchSelect">Your unit<\/label>/);
  // No part of the Profile step is a card a uniform hides (js/placement.js hides #groupPatches on the uniforms that wear no patches).
  assert.doesNotMatch(profile, /id="groupPatches"/);
  const patches = aside.slice(aside.indexOf('data-card="patches"'), aside.indexOf('id="stepGroup-export"'));
  assert.doesNotMatch(patches, /id="unitPatchSearch"|id="unitPatchSelect"/, 'the control is not asked twice');
  assert.match(patches, /id="unitPatchStatus"/);
  assert.match(patches, /follows the unit you choose in the Profile step/);
  // The supplements section is in the Profile step, under the unit, and starts hidden.
  assert.equal(stepOf('supplementsSection'), 'profile');
  assert.ok(profile.indexOf('id="unitPanel"') < profile.indexOf('id="supplementsSection"'));
  assert.match(profile, /<section id="supplementsSection"[^>]*\bhidden>/);
});

test('whatever the uniform, the unit list holds every unit, a squadron included, and a chosen unit is kept; a flight suit takes only the wing\'s patch and says so', () => {
  const total = ev('CAP_UNIT_OPTIONS.length');
  assert.ok(total > 1300);
  for(const u of UNIFORMS){
    ev(`State.uniform = ${j(u)}; State.membership = 'cadet'`);
    assert.equal(ev('getUnitPatchOptions().length'), total, `${u}: every unit is listed`);
    assert.ok(ev("getUnitPatchOptions('mar-md-003').some(o => o.code === 'MAR-MD-003')"), `${u}: a Maryland squadron is found`);
  }
  assert.match(ev("State.uniform = 'flight_suit'; getUnitPatchFloorNote()"), /^The flight suit takes no group or squadron patch \(CAPR 39-1, 8\.2\.4\.5\)\.$/);
  assert.match(ev("State.uniform = 'corporate_flight_suit'; getUnitPatchFloorNote()"), /^The Corporate Flight Duty Uniform takes no group or squadron patch \(CAPR 39-1, 8\.3\.4\.5\)\.$/);
  assert.equal(ev("State.uniform = 'ocp'; getUnitPatchFloorNote()"), '');
  ev("State.uniform = 'blues_a'");
});

test('a saved build, a shared link and the report import keep the unit: it is the same state, the same save key, the same report field', () => {
  reset();
  ev(`State.unitPatchCharter = 'MAR-MD-003'`);
  const saved = ev('CAPUB_V2.collectProfile()');
  assert.equal(saved.unitPatchCharter, 'MAR-MD-003');
  ev(`State.unitPatchCharter = ''`);
  try{ ev(`CAPUB_V2.applyProfile(${j(saved)})`); }catch(_){ /* the page's own refresh needs a real page; State was set before it */ }
  assert.equal(ev('State.unitPatchCharter'), 'MAR-MD-003');
  const report = read('tests/fixtures/eservices-member-details-cadet-live12.txt').replace('GLR-IL-049', 'MAR-MD-003');
  assert.equal(ev(`parseCapMemberReport(${j(report)}).unitPatchCharter`), 'MAR-MD-003');
  reset();
});

test('Clear in the Patches card clears the patches and leaves the unit, which is the member\'s and belongs to the Profile step', () => {
  const clear = read('js/wiring.js').slice(read('js/wiring.js').indexOf("by('clearPatches').addEventListener"));
  const body = clear.slice(0, clear.indexOf('});'));
  assert.match(body, /State\.patches=\[\];/);
  assert.doesNotMatch(body, /unitPatchCharter|unitPatchSearch/);
});

test('on a uniform that takes a unit patch the patch still follows the member\'s choice of unit', () => {
  reset();
  ev(`State.uniform = 'abu'; State.membership = 'senior'; State.unitPatchCharter = 'MAR-DC-026'`);
  assert.equal(ev('getSelectedUnitPatchId()'), 'unit_mar_dc_026');
  assert.ok(ev('CAPUBUniformView.buildFromState().patches.some(p => p.id === "unit_mar_dc_026" && p.kind === "unit")'));
  ev(`State.unitPatchCharter = ''`);
  assert.equal(ev('getSelectedUnitPatchId()'), null);
  reset();
});

test('the section of supplements: a name in words, the date, the items; hidden without a unit, for a unit with no supplement, or when nothing in them is for the member', () => {
  const src = read('js/supplements.js');
  assert.match(src, /make\('h4', 'supplementName', entry\.name\), make\('div', 'supplementDate', entry\.date\)/);
  // The section is drawn into the stand-in page (every element answers); what the page would show is read from the unit line and the section's hidden flag.
  const shown = state => { reset(); ev(state); const lines = []; ev(`globalThis.__lines = []`);
    const real = context.document;
    const els = {};
    context.document = new Proxy({}, { get: (_t, key) => key === 'getElementById' ? id => (els[id] = els[id] || (id === 'supplementsSection' || id === 'unitSupplementsLine' || id === 'supplementsBody' ? { hidden: false, textContent: '', classList: { toggle(){} }, append(){}, childNodes: [] } : real.getElementById(id))) : real[key] });
    try{ ev('Supplements.render(true)'); }finally{ context.document = real; }
    return { hidden: els.supplementsSection.hidden, line: els.unitSupplementsLine.textContent }; };
  assert.deepEqual(shown("State.unitPatchCharter = ''"), { hidden: true, line: 'Choose your unit to load the supplements of its wing and region.' });
  assert.deepEqual(shown("State.unitPatchCharter = 'GLR-IL-049'"), { hidden: true, line: 'No wing or region supplement is loaded for this unit.' });
  assert.deepEqual(shown("State.unitPatchCharter = 'NER-ME-021'"), { hidden: false, line: 'Loaded: Northeast Region Supplement 1 and Maine Wing Supplement 1.' });
  // A senior member's Northeast and Maine supplements have cords only, which are for cadets: nothing to show.
  assert.deepEqual(shown("State.unitPatchCharter = 'NER-ME-021'; State.membership = 'senior'"), { hidden: true, line: 'Loaded: Northeast Region Supplement 1 and Maine Wing Supplement 1. Nothing in it is for this membership type.' });
  assert.deepEqual(shown("State.unitPatchCharter = 'NER-ME-021'; State.membership = ''"), { hidden: true, line: 'Loaded: Northeast Region Supplement 1 and Maine Wing Supplement 1. Choose your membership type to see what it allows.' });
  // The Hawaii supplement has a wing patch and a hat, which a senior member keeps.
  assert.equal(shown("State.unitPatchCharter = 'PCR-HI-073'; State.membership = 'senior'; State.uniform = 'abu'").hidden, false);
  reset();
});

test('the wing\'s patch a supplement requires: selected when none is chosen, shown to the member, taken off at the member\'s wish with a warning that never blocks', () => {
  reset();
  ev(`State.uniform = 'abu'; State.membership = 'senior'; State.unitPatchCharter = 'MAR-DC-026'`);
  const plan = ev('Supplements.wingPatch(State)');
  assert.equal(plan.required, true);
  assert.equal(plan.patchId, 'unit_mar_dc_001');
  assert.equal(plan.label, 'National Capital Wing');
  assert.equal(plan.hasArt, true);
  assert.equal(plan.own, false);
  // The patch id is one the page's patch list knows, so a saved setup keeps it; the patch picker does not list it (the Unit patch list has the unit patches).
  assert.ok(ev("patchList.includes('unit_mar_dc_001')"));
  assert.equal(ev("isUnitPatchId('unit_mar_dc_001')"), true);
  assert.match(ev('Supplements.warnings(State)[0].msg'), /^The National Capital Wing patch is required on this uniform and is not chosen\. \(CAPR 39-1 Mid-Atlantic Region Supplement 1, 5\.1\.1\.1\.2\.2\)$/);
  assert.equal(ev('Supplements.selectWingPatch(State)'), true);
  assert.ok(ev('State.patches').includes('unit_mar_dc_001'));
  assert.equal(ev('Supplements.wingPatch(State).own'), true);
  assert.deepEqual(ev('Supplements.warnings(State)'), []);
  // The member takes it off: it stays off (nothing puts it back by itself), and the Check list warns.
  assert.equal(ev('Supplements.chooseWingPatch(false, State)'), true);
  assert.ok(!ev('State.patches').includes('unit_mar_dc_001'));
  ev('Supplements.refresh()');
  assert.ok(!ev('State.patches').includes('unit_mar_dc_001'));
  assert.equal(ev('Supplements.warnings(State).length'), 1);
  // Not chosen again where the member already has a wing, region or national patch; not on a uniform that does not take one.
  ev(`State.patches = ['ner_patch']`);
  assert.equal(ev('Supplements.selectWingPatch(State)'), false);
  ev(`State.patches = []; State.uniform = 'blues_a'`);
  assert.equal(ev('Supplements.wingPatch(State)'), null);
  assert.equal(ev('Supplements.selectWingPatch(State)'), false);
  assert.deepEqual(ev('Supplements.warnings(State)'), []);
  ev(`State.uniform = 'ocp'`);
  assert.equal(ev('Supplements.wingPatch(State)'), null, 'the OCP carries the higher headquarters patch by itself');
  reset();
});

test('the wing patch of a unit that is the wing headquarters is its own unit patch; a region headquarters has none; a wing whose patch has no picture is not selected', () => {
  reset();
  ev(`State.uniform = 'abu'; State.unitPatchCharter = 'MAR-DC-001'`);
  assert.equal(ev('Supplements.wingPatch(State).own'), true);
  assert.equal(ev('Supplements.selectWingPatch(State)'), false);
  ev(`State.unitPatchCharter = 'MAR-MAR-001'`);
  assert.equal(ev('Supplements.wingPatch(State)'), null);
  // Maryland's patch has no picture in the builder yet: nothing is selected, nothing is warned about, the section says so.
  ev(`State.unitPatchCharter = 'MAR-MD-003'`);
  assert.equal(ev('Supplements.wingPatch(State).hasArt'), false);
  assert.equal(ev('Supplements.selectWingPatch(State)'), false);
  assert.deepEqual(ev('Supplements.warnings(State)'), []);
  // The Hawaii Wing patch is required on the ABU only.
  ev(`State.unitPatchCharter = 'PCR-HI-073'`);
  assert.equal(ev('Supplements.wingPatch(State).patchId'), 'unit_pcr_hi_001');
  ev(`State.uniform = 'corporate_field'`);
  assert.equal(ev('Supplements.wingPatch(State)'), null);
  reset();
});

test('a copy of the wing patch chosen for another uniform is let go on the OCP, whose left sleeve takes the higher headquarters patch by itself', () => {
  reset();
  ev(`State.uniform = 'abu'; State.unitPatchCharter = 'MAR-DC-026'; Supplements.selectWingPatch(State)`);
  assert.ok(ev('State.patches').includes('unit_mar_dc_001'));
  ev(`State.uniform = 'ocp'; Supplements.dropWingPatchOnOcp(State)`);
  assert.ok(!ev('State.patches').includes('unit_mar_dc_001'), 'the OCP would draw it twice, on both sleeves');
  assert.equal(ev('State.patchSelections.unit_mar_dc_001.checked'), false);
  // The glue calls it, and chooses the patch again, when a uniform card is pressed.
  assert.match(read('js/supplements.js'), /dropWingPatchOnOcp\(\); selectWingPatch\(\); refresh\(\);/);
  // Where the unit is the wing's own headquarters, its unit patch is the wing patch and is left alone.
  ev(`State.uniform = 'ocp'; State.unitPatchCharter = 'MAR-DC-001'; State.patchSelections.unit_mar_dc_001 = { checked: true }; Supplements.dropWingPatchOnOcp(State)`);
  assert.equal(ev('State.patchSelections.unit_mar_dc_001.checked'), true);
  reset();
});

test('a supplement cord the unit no longer offers is let go: another unit, no unit, a senior member; the cord picker is told when the cords change', () => {
  reset();
  ev(`State.unitPatchCharter = 'NER-NY-135'; State.shoulderCord = 'ner-rcls'`);
  assert.equal(ev('Supplements.dropStaleCord(State)'), false);
  assert.equal(ev('State.shoulderCord'), 'ner-rcls');
  ev(`State.unitPatchCharter = 'GLR-IL-049'`);
  assert.equal(ev('Supplements.dropStaleCord(State)'), true);
  assert.equal(ev('State.shoulderCord'), null);
  // The seven regulation cords are not supplement cords and are never let go here.
  ev(`State.shoulderCord = 'wing'`);
  assert.equal(ev('Supplements.dropStaleCord(State)'), false);
  assert.equal(ev('State.shoulderCord'), 'wing');
  // The event: fired on `document` when the unit, the membership or the report's marks change, not on a redraw.
  const events = [];
  ev(`globalThis.CustomEvent = class { constructor(type, init){ this.type = type; this.detail = init && init.detail; } };`);
  ev(`State.unitPatchCharter = ''; State.supplementCordsEarned = null; Supplements.refresh()`);
  const realDocument = context.document;
  context.document = new Proxy({}, { get: (_t, key) => key === 'dispatchEvent' ? e => events.push([e.type, e.detail.unit]) : realDocument[key] });
  try{
    ev(`Supplements.refresh()`);
    ev(`State.unitPatchCharter = 'NER-ME-010'; Supplements.refresh()`);
    ev(`Supplements.refresh()`);
    ev(`State.reportAuthorizedBadgeIds = []; State.supplementCordsEarned = ['me-cadet-commander']; Supplements.refresh()`);
    ev(`State.membership = 'senior'; Supplements.refresh()`);
  }finally{ context.document = realDocument; }
  assert.deepEqual(events, [['capub:supplements-changed', 'NER-ME-010'], ['capub:supplements-changed', 'NER-ME-010'], ['capub:supplements-changed', 'NER-ME-010']]);
  reset();
});

test('the Check list carries the warning, and the section styles are in the stylesheet', () => {
  assert.match(read('js/wiring.js'), /Supplements\.warnings\(State\)\) addNotice\('warn',w\.msg,w\.fix\)/);
  const css = read('styles/app.css');
  for(const rule of ['.supplementBlock', '.supplementName', '.supplementRow', '.supplementTag', '.supplementWarn', '.supplementCheck']) assert.ok(css.includes(rule), rule);
});
