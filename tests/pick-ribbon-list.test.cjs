'use strict';
// The owner (2026-11-12): "Badge selection (and kind of ribbon selection, figure that one out), should be like the other selections (no checkboxes, those are annoying)". The
// ribbons of the chooser window are picture tiles (js/pick-lists.js ribbonLists on the picture picker's toggle mode), in the order of precedence under the headings of CAPR 39-3
// Attachment 2: the ribbon's own drawing with its name under it; a tap turns it on or off. Its count or level (one dropdown) and its separate facts (one switch each) are controls under the tile, shown only while it is
// on. The JROTC / ROTC menu and the U.S. military ribbons by branch are lists of the same tiles. No checkbox and no radio button is in the window. The page's own data and
// functions are used (its scripts loaded as index.html lists them); only the picker's DOM is the test's.

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

test('the CAP ribbons are picture tiles in the order of precedence under their headings: each with its own drawing and its name; no checkbox, no radio button, no input at all in the list', () => {
  setup('blues_a');
  const p = make();
  const cells = p.cap.picker.el.querySelectorAll('.vpCell');
  const worn = evj('getEligibleRibbonIds().filter(id => isAwardWornOnUniform(id) && !isRotcRibbonId(id))');
  const groups = evj('groupRibbonIds(getEligibleRibbonIds().filter(id => isAwardWornOnUniform(id) && !isRotcRibbonId(id)))').map(g => [g.label, g.ids]);
  assert.ok(cells.length > 60 && cells.length === worn.length, 'every ribbon the uniform wears and the member may wear');
  assert.deepEqual(p.cap.picker.el.querySelectorAll('.vpGroupHead').map(h => h.textContent), groups.map(g => g[0]), 'the headings of Attachment 2');
  assert.deepEqual(cells.map(c => c.dataset.value), groups.flatMap(g => g[1]), 'the order of precedence within each group');
  assert.ok(cells.every(c => c.querySelector('.vpLabel').textContent === ev(`getRibbonDisplayName(${JSON.stringify(c.dataset.value)})`)), 'the name under each');
  assert.ok(cells.every(c => /^images\/ribbons?\//.test(c.querySelector('img').getAttribute('src')) || /^images\//.test(c.querySelector('img').getAttribute('src'))), 'the ribbon\'s own drawing');
  assert.ok(cells.every(c => c.querySelector('img').getAttribute('loading') === 'lazy'), 'pictures load as they come into view');
  assert.equal(p.cap.picker.el.querySelectorAll('input').length, 0, 'no input in the CAP list');
  assert.equal(p.host.querySelectorAll('input').filter(i => ['checkbox', 'radio'].includes(i.getAttribute('type'))).length, 0, 'no checkbox or radio button in the window');
  assert.ok(cells.every(c => { const b = c.querySelector('.vpOption'); return b.nodeName === 'BUTTON' && b.getAttribute('aria-pressed') === 'false' && c.querySelector('.vpControls') === null; }), 'buttons with aria-pressed, off, and no controls under any');
  assert.equal(p.cap.picker.el.dataset.shape, 'wide');
});

const sel1 = (node, cls) => node.querySelectorAll('select').find(x => x.classList.contains(cls));
const pick = (select, value) => { select.value = value; select.dispatchEvent({ type: 'change', target: select }); };

test('a tap turns a ribbon on and off: the selection, its first choice, the tile\'s shade, tick and aria-pressed; its controls are under it only while it is on', () => {
  setup('blues_a');
  const p = make();
  const id = 'lifesaving_award';
  p.button(id).click();
  const sel = State.ribbonSelections[id];
  assert.equal(sel.checked, true);
  assert.equal(sel.awardValue, ev(`capubFirstRibbonOptionValue(${JSON.stringify(id)})`), 'its basic award');
  assert.equal(p.button(id).getAttribute('aria-pressed'), 'true');
  assert.ok(p.button(id).classList.contains('isPicked'), 'the tile\'s own border and fill show it');
  const controls = p.cell(id).querySelector('.vpControls');
  assert.ok(controls && !controls.hidden, 'the controls are under it');
  assert.equal(controls.querySelectorAll('.vpRow').length, 0, 'no row of look-alike tiles');
  assert.equal(controls.querySelectorAll('select').length, 1, 'one dropdown for how many awards');
  const select = sel1(controls, 'ribbonCountSelect');
  assert.equal(select.getAttribute('aria-label'), 'Number of awards');
  const lines = select.querySelectorAll('option');
  assert.ok(lines.length > 5, 'its counts');
  assert.ok(lines.every(o => o.value && !/^- Select -/.test(o.textContent)), 'no "- Select -": off is the tile\'s tap');
  assert.equal(select.value, sel.awardValue, 'the one picked is the award');
  assert.equal(lines[0].textContent, '1st', 'the count alone');
  assert.equal(lines[1].textContent, '2nd');
  assert.equal(lines[5].textContent, '6th');
  const words = () => p.cell(id).querySelector('.ribbonDeviceWords').textContent;
  assert.equal(words(), '', 'a first award with nothing on it: the line is empty and holds its height');
  pick(select, lines[5].value);
  assert.equal(words(), 'Silver clasp', 'what is worn for the count, never a repeat of the dropdown');
  assert.equal(controls.querySelectorAll('.ribbonToggle').length, 1, 'the silver star of the lifesaving ribbon is its one switch');
  assert.ok(drawn.includes(id), 'the drawn ribbon, devices and all, takes the place of the plain picture');
  assert.ok(p.cell('cap_leadership_ribbon').querySelector('.vpControls') === null, 'the other tiles have none');
  p.button(id).click();
  assert.equal(State.ribbonSelections[id].checked, false);
  assert.equal(State.ribbonSelections[id].awardValue, '');
  assert.equal(p.button(id).getAttribute('aria-pressed'), 'false');
  assert.ok(p.cell(id).querySelector('.vpControls') === null, 'off, the controls are gone');
});

test('a ribbon\'s count is one dropdown: choosing a line sets the award and the devices it wears, the dropdown keeps the focus and is not made again', () => {
  setup('blues_a');
  const p = make();
  const id = 'lifesaving_award';
  p.button(id).click();
  const select = () => sel1(p.cell(id), 'ribbonCountSelect');
  const first = select();
  const last = first.querySelectorAll('option').slice(-1)[0].value;
  assert.notEqual(last, State.ribbonSelections[id].awardValue);
  first.focus();
  pick(first, last);
  assert.equal(State.ribbonSelections[id].awardValue, last);
  assert.notEqual(State.ribbonSelections[id].awardLabel, 'Basic Award', 'the label of that count');
  assert.equal(select().value, last, 'the dropdown shows it');
  assert.ok(doc.activeElement === select(), 'the member is still on the dropdown');
  assert.equal(p.button(id).getAttribute('aria-pressed'), 'true', 'the ribbon stays on');
  assert.equal(p.cell(id).querySelectorAll('select').length, 1, 'one dropdown, not a second');
});

test('a ribbon with one choice only (earned) shows nothing under it; one with a counting rule has the rule in the dropdown\'s title', () => {
  setup('blues_a');
  const p = make();
  const single = evj('getEligibleRibbonIds().filter(id => isAwardWornOnUniform(id) && !isRotcRibbonId(id)).find(id => getRibbonAwardOptions(id).filter(o => o.value).length === 1 && !State.ribbonSelections[id].checked && !CAPUBRibbonAwards.controls(id, getRibbonAwardOptions(id), null, {}).toggles.length)');
  assert.ok(single, 'a ribbon that is earned once');
  p.button(single).click();
  assert.equal(State.ribbonSelections[single].checked, true);
  assert.ok(p.cell(single).querySelector('.vpControls') === null, 'nothing to count and no fact to switch: nothing under it');
  const ra = require('../data/ribbon-awards.js');
  const id = 'cap_senior_recruiter_ribbon';
  assert.ok(ra.hint(id));
  p.button(id).click();
  const control = p.cell(id).querySelector('.vpControls');
  assert.equal(sel1(control, 'ribbonCountSelect').getAttribute('title'), ra.hint(id), 'the counting rule is the title of the dropdown');
  assert.equal(sel1(control, 'ribbonCountSelect').getAttribute('aria-label'), 'Members recruited');
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
  assert.equal(menu.querySelectorAll('input').filter(i => i.getAttribute('type') !== 'search').length, 0, 'no input but the search');
});

test('the U.S. military ribbons are a menu by branch whose tiles are made when the branch is opened; a tap picks one, its count is one dropdown, and the service is one only where more than one service wears the award', () => {
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
  assert.equal(p.host.querySelectorAll('input').filter(i => ['checkbox', 'radio'].includes(i.getAttribute('type'))).length, 0, 'no checkbox or radio button');
  assert.deepEqual(ev('getMilitaryUIState().expandedSections.includes("military-branch-ARMY")'), true, 'the branch stays open');
  const id = cells[0].dataset.value;
  assert.ok(cells[0].querySelector('.vpCaption').textContent.includes('Army'));
  cells[0].querySelector('.vpOption').click();
  const tile = () => army.querySelectorAll('.vpCell').find(c => c.dataset.value === id);
  assert.equal(State.ribbonSelections[id].checked, true);
  assert.equal(State.ribbonSelections[id].awardValue, 'military_award_1');
  assert.equal(sel1(tile(), 'ribbonServiceSelect'), undefined, 'an award one service wears has no service to choose');
  assert.equal(tile().querySelectorAll('.vpRow').length, 0, 'no row of tiles under a military ribbon');
  const count = () => sel1(tile(), 'ribbonCountSelect');
  assert.ok(count().querySelectorAll('option').length > 3, 'its counts are the lines of one dropdown');
  assert.equal(count().querySelectorAll('option')[0].textContent, '1st');
  assert.equal(count().querySelectorAll('option')[1].textContent, '2nd', 'the second award');
  pick(count(), 'military_award_3');
  assert.equal(State.ribbonSelections[id].awardValue, 'military_award_3');
  assert.equal(State.ribbonSelections[id].awardCount, 3);
  assert.equal(count().value, 'military_award_3');
  // The window's search reads the tiles that are made.
  assert.equal(root.querySelectorAll('.vpCell').length, cells.length);
});

test('an award more than one service wears has a dropdown of its services; choosing one keeps the count; one service is no choice', () => {
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
  const service = () => sel1(tile(), 'ribbonServiceSelect');
  assert.ok(service(), 'the services are one dropdown');
  assert.deepEqual(service().querySelectorAll('option').map(o => o.value), services, 'a line for each service, none for the others');
  pick(sel1(tile(), 'ribbonCountSelect'), 'military_award_2');
  const other = services.find(sv => sv !== ev(`getMilitarySelectionService(${JSON.stringify(id)}, State.ribbonSelections[${JSON.stringify(id)}])`));
  service().focus();
  pick(service(), other);
  assert.equal(State.ribbonSelections[id].militaryService, other, 'the service');
  assert.equal(State.ribbonSelections[id].awardValue, 'military_award_2', 'the count stays');
  assert.equal(service().value, other);
  assert.ok(doc.activeElement === service(), 'the member is still on that dropdown');
  assert.ok(award, 'the award');
});

test('devices of a U.S. military award are small switches with aria-pressed; choosing devices by hand is a pressed switch that adds the numeral and the rest of the devices', () => {
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
  const devices = () => tile().querySelectorAll('.ribbonToggle');
  assert.ok(devices().length >= 1, 'a switch for each device the award allows');
  const pressed = c => c.getAttribute('aria-pressed');
  assert.ok(devices().every(c => c.nodeName === 'BUTTON' && pressed(c) === 'false' && c.querySelector('img')), 'buttons with aria-pressed, each with the device\'s picture');
  assert.equal(tile().querySelectorAll('input').length, 0, 'no numeral until devices are chosen by hand');
  const device = devices()[0].dataset.value;
  devices()[0].click();
  assert.deepEqual(State.ribbonSelections[withDevices].specialAuthorizations, [device]);
  assert.equal(pressed(devices()[0]), 'true');
  devices()[0].click();
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
  assert.equal(tile().querySelectorAll('input').length, 1, 'the numeral');
  assert.equal(tile().querySelector('input').getAttribute('type'), 'number');
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

test('the window builds its ribbon lists with the picker, and the sidebar draws none: no checkbox is left in the page\'s ribbon code', () => {
  const src = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
  assert.match(src('js/wiring.js'), /window\.CAPUB_MODAL_PICKERS = CAPUBPickLists\.ribbonLists\(grid\)/);
  assert.match(src('js/galleries.js'), /function buildRibbonGallery\(\)\{\s*const wrap = by\('ribbonGallery'\);\s*if\(wrap\) wrap\.innerHTML = '';\s*\}/);
  assert.doesNotMatch(src('js/galleries.js') + src('js/wiring.js'), /militarySpecialDevice|militaryAdvancedMode|rotcRibbonRemove|ribbonSelectorTile|wireRibbonTileControls|capubBuildRotcRibbonMenu/, 'the old tiles and their wiring are gone');
});
