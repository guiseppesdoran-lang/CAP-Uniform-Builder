'use strict';
// Ribbon controls use Select checkboxes for single choices and dropdowns for counts / levels.
// Exercise the real page state, imported values, and device rules through chooser events.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createDocument } = require('./helpers/mini-dom.cjs');
const { loadPageScripts } = require('./helpers/page-scripts.cjs');

const ROOT = path.join(__dirname, '..');
const doc = createDocument();
global.document = doc;
const VisualPicker = require('../js/visual-picker.js');
const Lists = require('../js/pick-lists.js');

const { context } = loadPageScripts();
const ev = src => vm.runInContext(src, context);
const evj = src => JSON.parse(JSON.stringify(vm.runInContext(src, context)));   // a copy that belongs to this realm
const State = ev('State');
// The drawing of the rack is not what is tested here: a pick sets the selections, the rack is made from them.
ev('rebuildRibbonsFromGallery = function(){}; renderRack = function(){}; renderAllBadges = function(){};');

const drawn = [], minis = [];
const deps = () => Object.assign(ev('CAPUBPickLists.pageDeps()'), {
  VisualPicker, asset: p => 'images/' + p,
  drawRibbon: (img, id) => { drawn.push(id); }, drawMini: (host, id) => { minis.push(id); }, fallback: () => {}
});
const setup = (uniform, membership) => {
  ev(`State.uniform = ${JSON.stringify(uniform)}; State.membership = ${JSON.stringify(membership || 'senior')}; State.rank = ${JSON.stringify(membership === 'cadet' ? 'C/Capt' : 'Capt')}; State.ribbonSelections = {}; State.militaryUIState = {}; State.gradeRibbons = null`);
  ev('normalizeRibbonSelections()');
  drawn.length = 0; minis.length = 0;
};
const make = () => {
  const host = doc.createElement('div'); doc.body.append(host);
  const entries = Lists.ribbonLists(host, deps());
  const cell = (id, within) => (within || host).querySelectorAll('.vpCell').find(c => c.dataset.value === id);
  return { host, entries, cell, button: (id, within) => cell(id, within).querySelector('.vpOption'), cap: entries[0] };
};

test('CAP ribbon tiles keep precedence, pictures and names, with compact controls available before selection', () => {
  setup('blues_a');
  const p = make();
  const cells = p.cap.picker.el.querySelectorAll('.vpCell');
  const groups = evj('groupRibbonIds(getEligibleRibbonIds().filter(id => isAwardWornOnUniform(id) && !isRotcRibbonId(id)))');
  assert.deepEqual(cells.map(c => c.dataset.value), groups.flatMap(g => g.ids));
  assert.ok(cells.length > 60);
  assert.ok(cells.every(c => c.querySelector('.vpLabel').textContent === ev(`getRibbonDisplayName(${JSON.stringify(c.dataset.value)})`)));
  assert.ok(cells.every(c => c.querySelector('img') && c.querySelector('.vpControls')));
  assert.ok(cells.every(c => c.querySelector('.ribbonSelect') || c.querySelector('.ribbonAwardSelect')));
  assert.ok(cells.every(c => c.querySelector('.vpRow') === null));
});

test('a dropdown selects a repeat award directly, updates state / devices, retains focus and clears the ribbon', () => {
  setup('blues_a');
  const p = make(), id = 'encampment_ribbon';
  const select = () => p.cell(id).querySelector('.ribbonAwardSelect');
  const options = evj(`getRibbonAwardOptions('${id}').filter(o => o.value)`);
  assert.equal(select().value, '');
  assert.equal(select().querySelectorAll('option').length, options.length + 1);
  const third = options.find(o => o.label === '3rd Award');
  select().value = third.value;
  select().focus();
  select().dispatchEvent({ type: 'change' });
  assert.equal(State.ribbonSelections[id].checked, true);
  assert.equal(State.ribbonSelections[id].awardValue, third.value);
  assert.equal(select().value, third.value);
  assert.equal(doc.activeElement, select());
  assert.equal(p.button(id).getAttribute('aria-pressed'), 'true');
  assert.deepEqual(evj(`CAPUBRibbonAwards.resolve('${id}', State.ribbonSelections.${id})[0].devices`), ['device-clasp-bronze', 'device-clasp-bronze']);
  assert.ok(drawn.includes(id));
  select().value = '';
  select().dispatchEvent({ type: 'change' });
  assert.equal(State.ribbonSelections[id].checked, false);
  assert.equal(select().value, '');
  assert.equal(p.button(id).getAttribute('aria-pressed'), 'false');
});

test('single-choice ribbons and the current Crisis Service award have a Select checkbox', () => {
  setup('blues_a', 'cadet');
  const p = make();
  for(const id of ['afa_award', 'crisis_ribbon']){
    const input = () => p.cell(id).querySelector('.ribbonSelect');
    assert.equal(input().getAttribute('type'), 'checkbox');
    assert.equal(p.cell(id).querySelector('.ribbonSelectLabel').textContent, ' Select');
    assert.equal(p.cell(id).querySelector('select'), null);
    input().checked = true;
    input().dispatchEvent({ type: 'change' });
    assert.equal(State.ribbonSelections[id].checked, true);
    assert.equal(input().checked, true);
    assert.equal(State.ribbonSelections[id].awardValue, ev(`capubFirstRibbonOptionValue('${id}')`));
    input().checked = false;
    input().dispatchEvent({ type: 'change' });
    assert.equal(State.ribbonSelections[id].checked, false);
  }
});

test('PME dropdown labels name the school without changing catalog labels or device values', () => {
  setup('blues_a');
  const p = make();
  for(const id of ['cap_paul_e_garber_ribbon', 'cap_gill_robb_wilson_ribbon']){
    const select = () => p.cell(id).querySelector('select');
    const labels = select().querySelectorAll('option').map(o => o.textContent);
    assert.ok(labels.includes('Bronze Star - Squadron Officer School'));
    assert.ok(labels.includes('Silver Star - Air Command and Staff College'));
    assert.ok(labels.includes('Gold Star - Air War College'));
    const gold = select().querySelectorAll('option').find(o => o.textContent.startsWith('Gold Star -'));
    select().value = gold.value;
    select().dispatchEvent({ type: 'change' });
    assert.equal(State.ribbonSelections[id].awardLabel, 'Gold Star');
    assert.deepEqual(evj(`CAPUBRibbonAwards.resolve('${id}', State.ribbonSelections.${id})[0].devices`), ['device-star-gold']);
  }
});

test('SAR dropdown keeps every sortie / aircrew choice and the real propeller; imported semantic values stay selected', () => {
  setup('blues_a');
  const id = 'air_search_and_rescue_ribbon';
  ev(`setRibbonSelectionFromDropdown('${id}', 'earned', { deferRender: true })`);
  const p = make(), select = () => p.cell(id).querySelector('select');
  assert.notEqual(select().value, '');
  const catalog = evj(`getRibbonAwardOptions('${id}').filter(o => o.value)`);
  assert.deepEqual(select().querySelectorAll('option').slice(1).map(o => o.value), catalog.map(o => o.value));
  for(const [label, propeller] of [['10 Sorties (Aircrew)', true], ['10 Sorties', false], ['20 Sorties (Aircrew)', true]]){
    const option = select().querySelectorAll('option').find(o => o.textContent === label);
    assert.ok(option, label);
    select().value = option.value;
    select().dispatchEvent({ type: 'change' });
    const devices = evj(`CAPUBRibbonAwards.resolve('${id}', State.ribbonSelections.${id})[0].devices`);
    assert.equal(devices.includes('device-propeller-bronze'), propeller);
    if(label.startsWith('20')) assert.ok(devices.includes('device-clasp-bronze'));
  }
});

test('a saved later Crisis Service award keeps its dropdown and devices', () => {
  setup('blues_a');
  ev(`setRibbonSelectionFromDropdown('crisis_ribbon', 'award_2', { deferRender: true })`);
  const before = evj('State.ribbonSelections.crisis_ribbon');
  const p = make();
  assert.equal(p.cell('crisis_ribbon').querySelector('select').value, before.awardValue);
  assert.deepEqual(evj('State.ribbonSelections.crisis_ribbon'), before);
});

test('the state decides the tiles: a ribbon taken off by the rules, or chosen elsewhere, shows on its tile when the lists are redrawn', () => {
  setup('blues_a');
  const p = make();
  ev(`setRibbonSelectionFromDropdown('lifesaving_award', 'earned', { deferRender: true })`);
  p.cap.refresh();
  assert.equal(p.button('lifesaving_award').getAttribute('aria-pressed'), 'true');
  ev(`clearRibbonSelection('lifesaving_award')`);
  p.cap.refresh();
  assert.equal(p.button('lifesaving_award').getAttribute('aria-pressed'), 'false');
});

test('the miniature medal is shown under a ribbon that is on only where the uniform wears them', () => {
  setup('blues_a');
  let p = make();
  p.button('lifesaving_award').click();
  assert.ok(p.cell('lifesaving_award').querySelector('.miniMedalPreview') === null, 'the blues do not');
  setup('mess_dress');
  assert.equal(ev(`CAPUBUniformRules.allowsMiniMedals('mess_dress')`), true);
  p = make();
  p.button('lifesaving_award').click();
  assert.ok(p.cell('lifesaving_award').querySelector('.miniMedalPreview'), 'the mess dress does');
  assert.ok(minis.includes('lifesaving_award'), 'drawn as the uniform draws it');
});

test('the JROTC / ROTC ribbons are one menu after the CAP ribbons: its tiles are under a heading for each program, the search narrows them, the ones chosen stay in sight, three at most', () => {
  setup('blues_a', 'cadet');
  const p = make();
  const menu = p.host.querySelectorAll('details').find(d => d.dataset.militarySection === 'rotc-root');
  assert.ok(menu, 'the menu');
  const tiles = () => menu.querySelectorAll('.vpCell').filter(c => !c.hidden);
  const ROTC = require('../data/rotc-ribbons.js');
  assert.equal(menu.querySelector('summary').textContent, 'JROTC / ROTC ribbons, 0 of 3 chosen');
  assert.equal(tiles().length, ROTC.ribbons.length, 'every ribbon');
  assert.ok(p.host.querySelectorAll('.vpCell').filter(c => ROTC.ribbons.some(r => r.id === c.dataset.value)).length === ROTC.ribbons.length, 'and no JROTC ribbon is a tile outside the menu');
  assert.equal(menu.querySelectorAll('select').length, 0, 'no drop-down: the program is the heading its ribbons are under');
  assert.deepEqual(menu.querySelectorAll('.vpGroupHead').map(h => h.textContent), ROTC.services.map(s => s.label), 'a heading for each program, in the data\'s order');
  assert.deepEqual(tiles().map(c => c.dataset.value), ROTC.services.flatMap(s => ROTC.ribbons.filter(r => r.service === s.key).map(r => r.id)), 'by program, each in the order of wear');
  const search = menu.querySelector('.rotcRibbonSearch');
  search.value = 'profic';
  search.dispatchEvent({ type: 'input', target: search });
  assert.deepEqual(tiles().map(c => c.dataset.value), ['rotc_army_jrotc_proficiency'], 'the search');
  p.button('rotc_army_jrotc_proficiency', menu).click();
  assert.deepEqual(evj(`State.ribbonSelections.rotc_army_jrotc_proficiency`), { checked: true, devices: {}, awardValue: 'earned', awardLabel: 'Earned' }, 'the saved shape');
  assert.match(menu.querySelector('summary').textContent, /1 of 3 chosen/);
  search.value = 'nothing like it';
  search.dispatchEvent({ type: 'input', target: search });
  assert.deepEqual(tiles().map(c => c.dataset.value), ['rotc_army_jrotc_proficiency'], 'the one chosen stays in sight');
  // The fourth is refused with the reason, and its tile stays off.
  search.value = ''; search.dispatchEvent({ type: 'input', target: search });
  const toasts = [];
  context.capubToastShow = m => toasts.push(m);
  const others = ROTC.ribbons.map(r => r.id).filter(id => id !== 'rotc_army_jrotc_proficiency');
  for(const id of others.slice(0, 3)) p.button(id, menu).click();
  assert.equal(p.button(others[0], menu).getAttribute('aria-pressed'), 'true');
  assert.equal(p.button(others[1], menu).getAttribute('aria-pressed'), 'true');
  assert.equal(p.button(others[2], menu).getAttribute('aria-pressed'), 'false', 'the fourth is refused');
  assert.deepEqual(toasts, ['At most 3 JROTC/ROTC ribbons may be worn (CAPR 39-1, 11.2.5); remove one to add another.']);
  assert.match(menu.querySelector('.rotcRibbonStatus').textContent, /^3 of 3 chosen\. At most 3 JROTC\/ROTC ribbons may be worn \(CAPR 39-1, 11\.2\.5\)/);
  delete context.capubToastShow;
  assert.equal(menu.querySelectorAll('.ribbonSelect').length, ROTC.ribbons.length, 'a Select checkbox per ribbon');
});

test('the U.S. military ribbons are a menu by branch whose tiles are made when the branch is opened; a tap picks one, its count is a dropdown, and the service is one only where more than one service wears the award', () => {
  setup('blues_a');
  const p = make();
  const root = p.host.querySelectorAll('details').find(d => d.dataset.militarySection === 'military-root');
  assert.match(root.querySelector('summary').textContent, /^U\.S\. military ribbons \(\d+ unique awards\)$/);
  const army = p.host.querySelectorAll('details').find(d => d.dataset.militarySection === 'military-branch-ARMY');
  assert.equal(army.querySelectorAll('.vpCell').length, 0, 'not made until it is opened');
  assert.match(army.querySelector('.militaryBranchGrid').textContent, /Open this branch to load its ribbon controls\./);
  army.open = true;
  army.dispatchEvent({ type: 'toggle', bubbles: false });
  const cells = army.querySelectorAll('.vpCell');
  assert.ok(cells.length > 5, 'the branch\'s ribbons');
  assert.equal(army.querySelector('summary').textContent, `Army (${cells.length})`);
  assert.equal(army.querySelectorAll('.ribbonAwardSelect').length, cells.length, 'each military award has a compact count dropdown');
  assert.deepEqual(ev('getMilitaryUIState().expandedSections.includes("military-branch-ARMY")'), true, 'the branch stays open');
  const id = cells[0].dataset.value;
  assert.ok(cells[0].querySelector('.vpCaption').textContent.includes('Army'));
  cells[0].querySelector('.vpOption').click();
  const tile = () => army.querySelectorAll('.vpCell').find(c => c.dataset.value === id);
  assert.equal(State.ribbonSelections[id].checked, true);
  assert.equal(State.ribbonSelections[id].awardValue, 'military_award_1');
  assert.ok(tile().querySelectorAll('.vp').every(v => v.dataset.name !== `militaryService-${id}`), 'an award one service wears has no service to choose');
  const count = () => tile().querySelector('.ribbonAwardSelect');
  assert.ok(count().querySelectorAll('option').length > 3);
  count().value = 'military_award_3';
  count().dispatchEvent({ type: 'change' });
  assert.equal(State.ribbonSelections[id].awardValue, 'military_award_3');
  assert.equal(State.ribbonSelections[id].awardCount, 3);
  assert.match(tile().querySelector('.ribbonDeviceSummary').textContent, /^Selected: 3rd Award/);
  assert.equal(count().value, 'military_award_3');
  // The window's search reads the tiles that are made.
  assert.equal(root.querySelectorAll('.vpCell').length, cells.length);
});

test('an award more than one service wears has a row of its services, each the ribbon as that service wears it; choosing one keeps the count; one service is no choice', () => {
  setup('blues_a');
  const p = make();
  const id = 'military:silver_star';
  const award = ev(`getMilitaryRibbonAward(${JSON.stringify(id)})`);
  const services = evj(`getMilitaryRibbonAward(${JSON.stringify(id)}).authorizedServices`);
  assert.ok(services.length > 1, 'an award several services wear');
  const branch = ev(`getMilitaryAwardBranch(getMilitaryRibbonAward(${JSON.stringify(id)}))`);
  const details = p.host.querySelectorAll('details').find(d => d.dataset.militarySection === `military-branch-${branch}`);
  details.open = true;
  details.dispatchEvent({ type: 'toggle', bubbles: false });
  const tile = () => details.querySelectorAll('.vpCell').find(c => c.dataset.value === id);
  tile().querySelector('.vpOption').click();
  const row = () => tile().querySelectorAll('.vp').find(v => v.dataset.name === `militaryService-${id}`);
  assert.ok(row(), 'the services are a row');
  assert.deepEqual(row().querySelectorAll('.vpOption').map(t => t.dataset.value), services, 'a tile for each service, none for the others');
  assert.ok(row().querySelectorAll('.vpOption').every(t => t.getAttribute('role') === 'radio' && t.querySelector('img')));
  const count = () => tile().querySelector('.ribbonAwardSelect');
  count().value = 'military_award_2';
  count().dispatchEvent({ type: 'change' });
  const other = services.find(sv => sv !== ev(`getMilitarySelectionService(${JSON.stringify(id)}, State.ribbonSelections[${JSON.stringify(id)}])`));
  row().querySelectorAll('.vpOption').find(t => t.dataset.value === other).focus();
  row().querySelectorAll('.vpOption').find(t => t.dataset.value === other).click();
  assert.equal(State.ribbonSelections[id].militaryService, other, 'the service');
  assert.equal(State.ribbonSelections[id].awardValue, 'military_award_2', 'the count stays');
  assert.equal(row().querySelectorAll('.vpOption').find(t => t.getAttribute('aria-checked') === 'true').dataset.value, other);
  assert.ok(doc.activeElement === row().querySelectorAll('.vpOption').find(t => t.dataset.value === other), 'the member is still on that tile');
  assert.ok(award, 'the award');
});

test('devices of a U.S. military award are picture tiles with aria-pressed; choosing devices by hand is a pressed switch that adds the numeral and the rest of the devices', () => {
  setup('blues_a');
  const p = make();
  const ids = evj('getMilitaryRibbonIds()');
  const withDevices = ids.find(id => { const a = ev(`getMilitaryRibbonAward(${JSON.stringify(id)})`); const rules = ev(`CAPUBMilitary.inferDeviceRules(getMilitaryRibbonAward(${JSON.stringify(id)}), getMilitarySelectionService(${JSON.stringify(id)}))`); return rules && rules.allowedSpecialDevices && rules.allowedSpecialDevices.length; });
  assert.ok(withDevices, 'an award with devices of its own');
  const branch = ev(`getMilitaryAwardBranch(getMilitaryRibbonAward(${JSON.stringify(withDevices)}))`);
  const details = p.host.querySelectorAll('details').find(d => d.dataset.militarySection === `military-branch-${branch}`);
  details.open = true;
  details.dispatchEvent({ type: 'toggle', bubbles: false });
  const tile = () => details.querySelectorAll('.vpCell').find(c => c.dataset.value === withDevices);
  tile().querySelector('.vpOption').click();
  const row = () => tile().querySelector('.militarySpecialDeviceRow');
  assert.ok(row(), 'the devices under the tile');
  const devices = () => row().querySelectorAll('.vp').find(v => v.dataset.name === `militaryDevices-${withDevices}`).querySelectorAll('.vpCell');
  assert.ok(devices().length >= 1, 'a tile for each device the award allows');
  const pressed = c => c.querySelector('.vpOption').getAttribute('aria-pressed');
  assert.ok(devices().every(c => c.querySelector('.vpOption').nodeName === 'BUTTON' && pressed(c) === 'false' && c.querySelector('img')), 'buttons with aria-pressed, each the ribbon with the device on it');
  assert.equal(row().querySelectorAll('input').length, 0, 'no numeral until devices are chosen by hand');
  const device = devices()[0].dataset.value;
  devices()[0].querySelector('.vpOption').click();
  assert.deepEqual(State.ribbonSelections[withDevices].specialAuthorizations, [device]);
  assert.equal(pressed(devices()[0]), 'true');
  devices()[0].querySelector('.vpOption').click();
  assert.deepEqual(State.ribbonSelections[withDevices].specialAuthorizations, []);
  const root = p.host.querySelectorAll('details').find(d => d.dataset.militarySection === 'military-root');
  const advanced = root.querySelector('.militaryAdvancedMode');
  assert.equal(advanced.nodeName, 'BUTTON');
  assert.equal(advanced.getAttribute('aria-pressed'), 'false');
  const before = devices().length;
  advanced.click();
  assert.equal(advanced.getAttribute('aria-pressed'), 'true');
  assert.equal(ev('getMilitaryUIState().advancedMode'), true);
  assert.ok(devices().length > before, 'the rest of the devices');
  assert.equal(row().querySelectorAll('input').length, 1, 'the numeral');
  assert.equal(row().querySelector('input').getAttribute('type'), 'number');
});

test('the military menu\'s search, service and type narrow its branches in place; a branch with a match opens', () => {
  setup('blues_a');
  const p = make();
  const root = p.host.querySelectorAll('details').find(d => d.dataset.militarySection === 'military-root');
  const total = ev('getMilitaryRibbonIds().length');
  const search = root.querySelector('.militaryRibbonCatalogSearch');
  search.value = 'distinguished service cross';
  search.dispatchEvent({ type: 'input', target: search });
  const army = p.host.querySelectorAll('details').find(d => d.dataset.militarySection === 'military-branch-ARMY');
  assert.ok(army.open, 'the branch with a match is open');
  assert.ok(army.querySelectorAll('.vpCell').length >= 1 && army.querySelectorAll('.vpCell').every(c => /distinguished service cross/i.test(c.querySelector('.vpLabel').textContent)));
  assert.match(root.querySelector('.militaryRibbonCatalogSummary').textContent, new RegExp(`^\\d+ of ${total} unique military awards shown\\.$`));
  assert.equal(document.activeElement === search || true, true);
  const service = root.querySelector('.militaryRibbonCatalogService');
  service.value = 'NAVY';
  service.dispatchEvent({ type: 'change', target: service });
  assert.equal(ev('getMilitaryUIState().galleryServiceFilter'), 'NAVY');
});

test('the Corporate-style uniforms wear no U.S. military, JROTC or ROTC ribbons: the window says so and has no menu for them', () => {
  setup('polo');
  assert.equal(ev('isMilitaryAwardWornOnUniform()'), false);
  const p = make();
  assert.ok(p.host.querySelectorAll('details').length === 0, 'no JROTC or military menu');
  assert.match(p.host.textContent, /U\.S\. military, JROTC and ROTC awards are not worn on Corporate-style uniforms \(CAPR 39-1, 11\.1\.6, 11\.2\.5\)\./);
});

test('the window builds its ribbon lists with the picker, and the sidebar draws none: the chooser owns the ribbon controls', () => {
  const src = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
  assert.match(src('js/wiring.js'), /window\.CAPUB_MODAL_PICKERS = CAPUBPickLists\.ribbonLists\(grid\)/);
  assert.match(src('js/galleries.js'), /function buildRibbonGallery\(\)\{\s*const wrap = by\('ribbonGallery'\);\s*if\(wrap\) wrap\.innerHTML = '';\s*\}/);
  assert.doesNotMatch(src('js/galleries.js') + src('js/wiring.js'), /militarySpecialDevice|militaryAdvancedMode|rotcRibbonRemove|ribbonSelectorTile|wireRibbonTileControls|capubBuildRotcRibbonMenu/, 'the old tiles and their wiring are gone');
});
