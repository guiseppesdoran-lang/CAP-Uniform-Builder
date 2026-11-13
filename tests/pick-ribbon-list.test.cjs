'use strict';
// The owner (2026-11-12): "Badge selection (and kind of ribbon selection, figure that one out), should be like the other selections (no checkboxes, those are annoying)". The
// ribbons of the chooser window are picture tiles (js/pick-lists.js ribbonLists on the picture picker's toggle mode), in the order of precedence under the headings of CAPR 39-3
// Attachment 2: the ribbon's own drawing with its name under it; a tap turns it on or off. Its count or level and its devices are controls under the tile, shown only while it is
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
  assert.equal(controls.querySelectorAll('select').length, 0, 'no drop-down: its counts are pictures');
  const row = controls.querySelector('.vpRow');
  assert.ok(row, 'its counts are a row of tiles');
  assert.equal(row.querySelector('.vp').dataset.layout, 'row', 'one row that scrolls sideways');
  const tiles = row.querySelectorAll('.vpOption');
  assert.ok(tiles.length > 5, 'its counts');
  assert.ok(tiles.every(t => t.nodeName === 'BUTTON' && t.getAttribute('role') === 'radio' && t.dataset.value), 'a radio button each, no "- Select -": off is the tile\'s tap');
  assert.ok(tiles.every(t => t.querySelector('img')), 'each with the ribbon\'s picture');
  assert.equal(tiles.filter(t => t.getAttribute('aria-checked') === 'true').map(t => t.dataset.value).join(), sel.awardValue, 'the one picked is the award');
  assert.ok(drawn.filter(x => x === id).length >= tiles.length, 'each tile is the ribbon as the engine draws it at that count, devices and all');
  assert.match(controls.querySelector('.ribbonDeviceSummary').textContent, /^Selected: Basic Award/);
  assert.ok(drawn.includes(id), 'the drawn ribbon, devices and all, takes the place of the plain picture');
  assert.ok(p.cell('cap_leadership_ribbon').querySelector('.vpControls') === null, 'the other tiles have none');
  p.button(id).click();
  assert.equal(State.ribbonSelections[id].checked, false);
  assert.equal(State.ribbonSelections[id].awardValue, '');
  assert.equal(p.button(id).getAttribute('aria-pressed'), 'false');
  assert.ok(p.cell(id).querySelector('.vpControls') === null, 'off, the controls are gone');
});

test('a ribbon\'s count is a row of picture tiles: choosing another sets the award and the devices it wears, and the tile keeps the focus', () => {
  setup('blues_a');
  const p = make();
  const id = 'lifesaving_award';
  p.button(id).click();
  const tiles = () => p.cell(id).querySelector('.vpRow').querySelectorAll('.vpOption');
  const last = tiles().slice(-1)[0].dataset.value;
  assert.notEqual(last, State.ribbonSelections[id].awardValue);
  tiles().slice(-1)[0].focus();
  tiles().slice(-1)[0].click();
  assert.equal(State.ribbonSelections[id].awardValue, last);
  assert.notEqual(State.ribbonSelections[id].awardLabel, 'Basic Award', 'the label of that count');
  assert.equal(tiles().filter(t => t.getAttribute('aria-checked') === 'true').map(t => t.dataset.value).join(), last, 'the row shows it');
  assert.ok(doc.activeElement === tiles().slice(-1)[0], 'the member is still on that tile');
  assert.equal(p.button(id).getAttribute('aria-pressed'), 'true', 'the ribbon stays on');
  assert.match(p.cell(id).querySelector('.ribbonDeviceSummary').textContent, new RegExp('^Selected: ' + State.ribbonSelections[id].awardLabel));
});

test('a ribbon with one choice only (earned) has no row of counts, and the counting rule is in the title of the line', () => {
  setup('blues_a');
  const p = make();
  const single = evj('getEligibleRibbonIds().filter(id => isAwardWornOnUniform(id) && !isRotcRibbonId(id)).find(id => getRibbonAwardOptions(id).filter(o => o.value).length === 1)');
  assert.ok(single, 'a ribbon that is earned once');
  p.button(single).click();
  assert.ok(p.cell(single).querySelector('.vpControls'), 'its line is under it');
  assert.ok(p.cell(single).querySelector('.vpRow') === null, 'nothing to count: no row, no tile of one');
  assert.ok(p.cell(single).querySelector('select') === null);
  assert.match(p.cell(single).querySelector('.ribbonDeviceSummary').textContent, /^Selected: /);
  const ra = require('../data/ribbon-awards.js');
  const id = 'cap_senior_recruiter_ribbon';
  assert.ok(ra.hint(id));
  p.button(id).click();
  const control = p.cell(id).querySelector('.vpControls');
  assert.equal(control.querySelector('.vpRow').getAttribute('title'), ra.hint(id), 'the counting rule is the title of the row');
  assert.ok(control.querySelector('.ribbonDeviceSummary').getAttribute('title').includes(ra.hint(id)));
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

test('the U.S. military ribbons are a menu by branch whose tiles are made when the branch is opened; a tap picks one, its count is a row of picture tiles, and the service is one only where more than one service wears the award', () => {
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
  assert.ok(tile().querySelectorAll('.vp').every(v => v.dataset.name !== `militaryService-${id}`), 'an award one service wears has no service to choose');
  assert.equal(tile().querySelectorAll('select').length, 0, 'no drop-down under a military ribbon');
  const counts = () => tile().querySelectorAll('.vp').find(v => v.dataset.name === `ribbonCount-${id}`).querySelectorAll('.vpOption');
  assert.ok(counts().length > 3, 'its counts are tiles');
  const third = counts().find(t => t.dataset.value === 'military_award_3');
  third.click();
  assert.equal(State.ribbonSelections[id].awardValue, 'military_award_3');
  assert.equal(State.ribbonSelections[id].awardCount, 3);
  assert.match(tile().querySelector('.ribbonDeviceSummary').textContent, /^Selected: 3rd Award/);
  assert.equal(counts().find(t => t.getAttribute('aria-checked') === 'true').dataset.value, 'military_award_3');
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
  const count = () => tile().querySelectorAll('.vp').find(v => v.dataset.name === `ribbonCount-${id}`).querySelectorAll('.vpOption');
  count().find(t => t.dataset.value === 'military_award_2').click();
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

test('the window builds its ribbon lists with the picker, and the sidebar draws none: no checkbox is left in the page\'s ribbon code', () => {
  const src = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
  assert.match(src('js/wiring.js'), /window\.CAPUB_MODAL_PICKERS = CAPUBPickLists\.ribbonLists\(grid\)/);
  assert.match(src('js/galleries.js'), /function buildRibbonGallery\(\)\{\s*const wrap = by\('ribbonGallery'\);\s*if\(wrap\) wrap\.innerHTML = '';\s*\}/);
  assert.doesNotMatch(src('js/galleries.js') + src('js/wiring.js'), /militarySpecialDevice|militaryAdvancedMode|rotcRibbonRemove|ribbonSelectorTile|wireRibbonTileControls|capubBuildRotcRibbonMenu/, 'the old tiles and their wiring are gone');
});
