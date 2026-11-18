'use strict';
// The unit and a report (the owner, 2026-11-13: "a member search report should fill in the unit, and if it already does that, when someone clicks resume, it should fill
// that back in"). The import sets the unit from the report's unit line when the builder's list has it, so its emblem shows and its supplements load; a report with none
// leaves the unit as it was and says so. A setup brought back by Resume, and the automatic save it comes from, carry the unit and what the report showed about it.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadPageScripts } = require('./helpers/page-scripts.cjs');
const { createDocument } = require('./helpers/mini-dom.cjs');

const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const fixture = name => read(`tests/fixtures/${name}`);
const PERSONNEL = fixture('eservices-member-details-cadet-personnel.txt');   // "... General Info Organization GLR-IL-049 Gender ..."
const OLDER = fixture('eservices-member-details-cadet.txt');                 // the General Information row, ending GLR-IL-049

const STUBS = `for(const n of ['buildRibbonGallery','rebuildRibbonsFromGallery','buildBadgeGallery','rebuildBadgesFromGallery','fullRender','refreshUI',
  'populateRankSetup','updateSetupGates','highlightActiveUniformButton','applyMemberTypeToUniformOptions','syncCadetFirstSergeantControl',
  'renderCACShoulderCord','syncShoulderCordControl','clearUnauthorizedPatchesForCurrentUniform','buildPatchGallery','rebuildPatchesFromGallery','renderPatches']) globalThis[n] = function(){};`;

// The page's scripts with a unit search box and a unit list that keep what is written to them, and the panel's other elements as the small stand-ins.
function page(){
  const { context, referenceErrors } = loadPageScripts();
  assert.deepEqual(referenceErrors, []);
  vm.runInContext(STUBS, context);
  const real = context.document;
  const search = { id: 'unitPatchSearch', value: '' };
  const select = { id: 'unitPatchSelect', options: [], value: '', appendChild(o){ this.options.push(o); }, set innerHTML(v){ this.options = []; }, get innerHTML(){ return ''; } };
  context.document = new Proxy({}, { get: (_t, key) => key === 'getElementById' ? id => id === 'unitPatchSearch' ? search : id === 'unitPatchSelect' ? select : real.getElementById(id)
    : key === 'createElement' ? tag => tag === 'option' ? { value: '', textContent: '' } : real.createElement(tag) : real[key] });
  const run = code => vm.runInContext(code, context);
  return { context, run, search, select };
}
const fileLike = (name, text) => ({ name, type: 'text/plain', size: text.length, text: async () => text, arrayBuffer: async () => new TextEncoder().encode(text).buffer });
async function importText(text, before = ''){
  const p = page();
  if(before) p.run(before);
  const result = await p.run('(file) => importMemberReportFile(file)')(fileLike('report.txt', text));
  return Object.assign(p, { result, unit: () => p.run('State.unitPatchCharter'), lines: result.lines });
}
const unreadOf = lines => { const i = lines.findIndex(l => l && l.heading === 'Not understood'); const out = []; if(i >= 0) for(let j = i + 1; j < lines.length && lines[j] && typeof lines[j] === 'object' && 'item' in lines[j]; j++) out.push(lines[j].item); return out; };

test('the import sets the unit from the report\'s unit line: the print of today (the Organization column) and the older print (the General Information row)', async () => {
  for(const [what, text] of [['the member search print', PERSONNEL], ['the older print', OLDER], ['the print as one line, as a PDF is read', PERSONNEL.replace(/\n/g, ' ')]]){
    const p = await importText(text);
    assert.equal(p.result.ok, true, what);
    assert.equal(p.unit(), 'GLR-IL-049', what);
    assert.equal(p.search.value, 'GLR-IL-049', `${what}: the code is in the unit search, as the member would have typed it`);
    assert.equal(p.select.value, 'GLR-IL-049', `${what}: and the list shows the unit`);
    assert.ok(p.select.options.some(o => o.value === 'GLR-IL-049'), what);
    assert.deepEqual(unreadOf(p.lines).filter(l => /unit/i.test(l)), [], `${what}: a unit read is not told as not understood`);
  }
});

test('a unit with an emblem is chosen with its emblem, a unit of a supplement with its supplement; both follow the unit the import chose', async () => {
  const withArt = await importText(PERSONNEL.replace(/GLR-IL-049/g, 'GLR-IL-189'));
  assert.equal(withArt.unit(), 'GLR-IL-189');
  assert.ok(withArt.run('getSelectedUnitPatchId()'), 'the unit\'s patch picture is known');
  assert.equal(withArt.run('unitCharterHasArtwork(State.unitPatchCharter)'), true);
  const ner = await importText(PERSONNEL.replace(/GLR-IL-049/g, 'NER-NY-109'));
  assert.equal(ner.unit(), 'NER-NY-109');
  assert.deepEqual(JSON.parse(ner.run('JSON.stringify(Supplements.forUnit(State.unitPatchCharter).map(s => s.key))')), ['NER']);
});

test('the unit is the one the Organization column names, not the first charter a report happens to print', async () => {
  const noise = 'Printer Friendly View - Member Details GLR-IL-001 '.repeat(12);
  const text = PERSONNEL.replace('Personnel Information For:', noise + 'Personnel Information For:');
  assert.ok(text.indexOf('Organization') > 400, 'the column lies beyond the first 400 characters');
  assert.equal((await importText(text)).unit(), 'GLR-IL-049');
  // A duty or transfer row\'s charter is another unit: the transfer row of the fixture names GLR-IL-087 and GLR-IL-049.
  assert.equal((await importText(PERSONNEL.replace('Organization GLR-IL-049', 'Organization glr-il-049'))).unit(), 'GLR-IL-049', 'in lower case');
});

test('a report with no unit the list has leaves no unit chosen, and says so in the short list of what was not understood', async () => {
  const none = PERSONNEL.replace('Organization GLR-IL-049', 'Organization ZZZ-ZZ-999');
  const fresh = await importText(none);
  assert.equal(fresh.unit(), '', 'no unit is chosen');
  assert.ok(unreadOf(fresh.lines).includes('The unit was not found, so none is chosen.'), JSON.stringify(unreadOf(fresh.lines)));
  // The unit of the build before it (another member's, or the member's own pick) does not stay: the report sets the build anew.
  const before = await importText(none, "State.unitPatchCharter = 'GLR-IL-001';");
  assert.equal(before.unit(), '');
  assert.ok(unreadOf(before.lines).includes('The unit was not found, so none is chosen.'));
  // A report that gives its unit says nothing of the kind, and the unit it gives replaces the one the member had.
  const given = await importText(PERSONNEL, "State.unitPatchCharter = 'GLR-IL-001';");
  assert.equal(given.unit(), 'GLR-IL-049');
  assert.ok(!unreadOf(given.lines).some(l => /unit/i.test(l)));
});

// ---- Resume ------------------------------------------------------------------------------------------------------------------------------------
// Resume applies the setup the autosave wrote (js/workspace-ui.js: CAPUB_V2.applyProfile(saved.profile)); the autosave writes CAPUB_V2.collectProfile(). Both ends are here.
const SETUP = `Object.assign(State, { membership: 'cadet', rank: 'C/Lt Col', gender: 'male', uniform: 'blues_a', ceremonial: false, adultCadet: true,
  text: { firstName: 'Alex', lastName: 'Rivera', plateLine: 'New York', show: false }, unitPatchCharter: UNIT, shoulderCord: 'national',
  supplementCordsEarned: ['ner-rcls'], reportAuthorizedBadgeIds: ['observer_badge', 'emergency_services_badge'] });`;
const PROFILE_FIELDS = `JSON.stringify({ membership: State.membership, rank: State.rank, gender: State.gender, uniform: State.uniform, adultCadet: State.adultCadet, text: State.text,
  unit: State.unitPatchCharter, cord: State.shoulderCord, earned: State.supplementCordsEarned, authorized: State.reportAuthorizedBadgeIds })`;
function comeBack(unit){
  const first = page();
  first.run(`globalThis.UNIT = ${JSON.stringify(unit)};` + SETUP);
  const saved = first.run('JSON.stringify(CAPUB_V2.collectProfile())');   // what the autosave writes
  const second = page();
  second.run("State.unitPatchCharter = ''; State.supplementCordsEarned = undefined; State.reportAuthorizedBadgeIds = undefined; State.text = { firstName: '', lastName: '', show: true };");
  try{ second.run(`CAPUB_V2.applyProfile(${saved})`); }catch(_){ /* the DOM-driven refresh throws under the stand-in page: State was set before it */ }
  return { before: JSON.parse(first.run(PROFILE_FIELDS)), after: JSON.parse(second.run(PROFILE_FIELDS)), saved: JSON.parse(saved), second };
}

test('Resume brings back the profile as it was: membership, grade, cut, names, wing, show my name, the weight standard choice, the unit, its cord and what the report showed', () => {
  const unit = 'NER-NY-109';
  const { before, after, saved } = comeBack(unit);
  assert.deepEqual(after, before);
  assert.equal(after.unit, unit);
  assert.deepEqual(after.earned, ['ner-rcls'], 'the supplement cord the report showed earned keeps its mark');
  assert.deepEqual(after.authorized, ['observer_badge', 'emergency_services_badge'], 'and the badge list its group of what the report authorized');
  // The automatic save is the same setup: the keys Resume needs are in it.
  for(const key of ['membership', 'rank', 'gender', 'unitPatchCharter', 'adultCadet', 'text', 'shoulderCord', 'supplementCordsEarned', 'reportAuthorizedBadgeIds']) assert.ok(key in saved, key);
});

test('what a setup brings back is checked: cords and badges the lists do not know are dropped, and an older setup with neither loads clean', () => {
  const { second } = comeBack('GLR-IL-189');
  const load = profile => { second.run('State.supplementCordsEarned = undefined; State.reportAuthorizedBadgeIds = undefined;'); try{ second.run(`CAPUB_V2.applyProfile(${JSON.stringify(profile)})`); }catch(_){ /* as above */ } return JSON.parse(second.run('JSON.stringify([State.supplementCordsEarned, State.reportAuthorizedBadgeIds, State.unitPatchCharter])')); };
  assert.deepEqual(load({ membership: 'cadet', rank: 'C/Maj', gender: 'male', unitPatchCharter: 'GLR-IL-189', supplementCordsEarned: ['ner-rcls', '<img src=x>', 'no-such-cord'], reportAuthorizedBadgeIds: ['observer_badge', 'no_such_badge', 5] }),
    [['ner-rcls'], ['observer_badge'], 'GLR-IL-189']);
  assert.deepEqual(load({ membership: 'cadet', rank: 'C/Maj', gender: 'male' }), [[], null, ''], 'a setup saved before has no unit and nothing the report showed');
  assert.deepEqual(load({ membership: 'cadet', rank: 'C/Maj', gender: 'male', unitPatchCharter: 'not a charter!' }), [[], null, ''], 'a charter that is no charter is no unit');
});

test('the unit list shows the unit Resume brings back, whichever place the unit has in the list and whatever the search box says', () => {
  const p = page();
  const codes = JSON.parse(p.run('JSON.stringify(getUnitPatchOptions("").map(u => u.code))'));
  assert.ok(codes.length > 1400, 'the list holds every unit');
  for(const code of [codes[0], codes[349], codes[350], codes[codes.length - 1], 'NER-NY-109']){
    p.run(`State.unitPatchCharter = ${JSON.stringify(code)};`);
    p.run("buildUnitPatchSelector('')");
    assert.equal(p.select.value, code, `${code}: the list holds the unit`);
    assert.ok(p.select.options.some(o => o.value === code), code);
    assert.equal(p.select.options.filter(o => o.value === code).length, 1, `${code}: once`);
  }
  p.run("State.unitPatchCharter = ''; buildUnitPatchSelector('')");
  assert.equal(p.select.value, '', 'no unit: the list says none');
});

test('Resume puts the unit\'s code in the search box, as the import does, and the emblem follows the unit chosen', () => {
  const wiring = read('js/wiring.js');
  const apply = wiring.slice(wiring.indexOf('function applyProfile'), wiring.indexOf('function syncTextControls'));
  assert.match(apply, /State\.supplementCordsEarned = p\.supplementCordsEarned;/);
  assert.match(apply, /State\.reportAuthorizedBadgeIds = p\.reportAuthorizedBadgeIds;/);
  assert.ok(apply.indexOf("unitSearch.value = State.unitPatchCharter") > 0 && apply.indexOf("unitSearch.value = State.unitPatchCharter") < apply.indexOf('buildUnitPatchSelector('), 'the code is in the box before the list is built');
  assert.ok(apply.indexOf('buildBadgeGallery()') > apply.indexOf('State.reportAuthorizedBadgeIds'), 'the badge list is built after what the report authorized is back');
  // The emblem is read from the unit chosen: a unit with art shows it, a unit without hides it.
  const doc = createDocument();
  const img = doc.createElement('img'); img.id = 'unitEmblem'; img.hidden = true; doc.body.append(img);
  let chosen = 'unit_glr_il_189';
  const sandbox = { document: doc, console, setTimeout: () => 0, State: { membership: 'cadet' }, getSelectedUnitPatchId: () => chosen,
    PATCH_META: { unit_glr_il_189: { img: 'patches/patch-glr-il-189/patch-glr-il-189.png' } }, ASSET: x => 'images/' + x };
  sandbox.window = sandbox; sandbox.self = sandbox;
  vm.runInNewContext(read('js/profile-pickers.js'), sandbox);
  sandbox.CAPUBProfilePickers.syncUnitEmblem();
  assert.equal(img.hidden, false);
  assert.equal(img.getAttribute('src'), 'images/patches/patch-glr-il-189/patch-glr-il-189.png');
  chosen = null;
  sandbox.CAPUBProfilePickers.syncUnitEmblem();
  assert.equal(img.hidden, true);
});
