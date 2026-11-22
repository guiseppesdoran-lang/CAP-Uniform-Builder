'use strict';
// The owner (2026-11-12): "Badge selection ... should be like the other selections (no checkboxes, those are annoying)". The badges of the chooser window are picture tiles (js/pick-lists.js
// on the picture picker's toggle mode): the badge's own drawing and its name, nothing under the name; a tap turns it on or off, the tile shows it, and the window's status line says where the
// drawing wore it or why it left it off; the level of a badge (one dropdown, the way a ribbon's count is) and the way a command pin is worn (one switch, Graduated commander) are under the
// tile while it is on, and the tile's own picture is the badge at the level chosen (2026-11-19: a badge with levels stays one tile). No checkbox is in the list.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createDocument, keydown } = require('./helpers/mini-dom.cjs');
const { loadPageScripts } = require('./helpers/page-scripts.cjs');

const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const doc = createDocument();
global.document = doc;
const VisualPicker = require('../js/visual-picker.js');
const Lists = require('../js/pick-lists.js');

const PILOT = 'CAPPilot1_FA9D33EA587D8', OBSERVER = 'observer_badge', STEM = 'cadet_stem_badge', SQUADRON = 'squadron_commander_badge', GROUP = 'group_commander_badge', ES = 'emergency_services_badge';
const NAMES = { [PILOT]: 'Pilot Badge', [OBSERVER]: 'Observer Badge', [STEM]: 'Cadet STEM Badge', [SQUADRON]: 'Squadron Commander Badge', [GROUP]: 'Group Commander Badge', [ES]: 'Emergency Services Badge' };

// The page's own functions, standing in: the selections, the rules that run after a tap (one command pin), the grade that may wear a pin, the levels of a badge.
const SAID = [];   // what the window's status line was told, in order
let ROWS = [];   // what the drawing did with each badge chosen (js/badge-rules.js capubBadgeSummary), as a test says it
function deps(extra){
  const State = { badgeSelections: {}, badges: [], commandInsignia: { graduatedCommander: false }, rank: 'Capt' };
  const d = {
    State, VisualPicker, asset: p => 'images/' + p, artPath: id => `badges/${id}${(State.badgeSelections[id] || {}).level ? '-' + State.badgeSelections[id].level : ''}.svg`, name: id => NAMES[id] || id,
    isCommand: id => id === SQUADRON || id === GROUP,
    levels: id => id === STEM ? [['basic', 'Basic'], ['senior', 'Senior'], ['master', 'Master']] : null, level: (id, level) => level || 'basic',
    levelArt: (id, level) => `badges/${id}-${level}.svg`,
    canCommand: () => !extra || extra.canCommand !== false, chooseOnlyCommand: id => { for(const x of [SQUADRON, GROUP]) if(x !== id && State.badgeSelections[x]) State.badgeSelections[x].checked = false; },
    rebuild: () => { State.badges = Object.keys(State.badgeSelections).filter(id => State.badgeSelections[id].checked); },
    badgeRows: () => ROWS,
    say: text => { SAID.push(text); }
  };
  // The pin as the engine draws it worn each way, as a test says it: { current, graduated } (false where the uniform does not draw it); `late` makes them arrive after the list is built.
  if(extra && extra.pictures){
    const made = extra.pictures;
    d.commandPictures = () => extra.late ? { now: {}, ready: extra.late.then(() => made), settled: false } : { now: made, ready: Promise.resolve(made), settled: true };
  }
  return d;
}
const GROUPS = [{ key: 'Aviation / Aircrew', ids: [PILOT, OBSERVER] }, { key: 'Cadet Specialty Track Badges', ids: [STEM] }, { key: 'Command', ids: [SQUADRON, GROUP] }];
const make = (extra, groups) => {
  const d = deps(extra);
  const host = doc.createElement('div'); doc.body.append(host);
  const entry = Lists.badgeList(host, groups || GROUPS, d);
  return { d, host, entry, tile: id => host.querySelectorAll('.vpCell').find(c => c.dataset.value === id), button: id => host.querySelectorAll('.vpCell').find(c => c.dataset.value === id).querySelector('.vpOption') };
};

test('the badges are picture tiles: each with its own drawing and its name and nothing under the name, under a heading for its category; no checkbox or radio button is in the list', () => {
  const p = make();
  assert.equal(p.host.querySelectorAll('input').length, 0, 'no input at all');
  assert.deepEqual(p.host.querySelectorAll('.vpGroupHead').map(h => h.textContent), ['Aviation / Aircrew', 'Cadet Specialty Track Badges', 'Command']);
  const cells = p.host.querySelectorAll('.vpCell');
  assert.deepEqual(cells.map(c => c.querySelector('.vpLabel').textContent), [NAMES[PILOT], NAMES[OBSERVER], NAMES[STEM], NAMES[SQUADRON], NAMES[GROUP]]);
  assert.deepEqual(cells.map(c => c.querySelector('img').getAttribute('src')), [PILOT, OBSERVER, STEM, SQUADRON, GROUP].map(id => `images/badges/${id}.svg`), 'the badge\'s own drawing');
  assert.ok(cells.every(c => c.querySelector('.vpCaption') === null), 'no line under the name');
  assert.ok(cells.every(c => c.querySelector('img').getAttribute('loading') === 'lazy'), 'the pictures load as they come into view');
  assert.ok(p.host.querySelectorAll('.vpOption').filter(b => !b.closest('.vpControls')).every(b => b.nodeName === 'BUTTON' && b.getAttribute('aria-pressed') === 'false'), 'buttons with aria-pressed, off to begin with');
  assert.equal(p.host.querySelector('[role="group"]').nodeName, 'DIV');
});

test('a tap turns a badge on and off, the page\'s rules run after it, and the tile shows it with its own shade, tick and aria-pressed', () => {
  const p = make();
  p.button(OBSERVER).click();
  assert.equal(p.d.State.badgeSelections[OBSERVER].checked, true, 'the selection the build is made from');
  assert.deepEqual(p.d.State.badges, [OBSERVER]);
  assert.equal(p.button(OBSERVER).getAttribute('aria-pressed'), 'true');
  assert.ok(p.button(OBSERVER).classList.contains('isPicked'));
  assert.ok(p.button(OBSERVER).querySelector('.vpTick'));
  p.button(PILOT).click();
  assert.deepEqual(p.d.State.badges, [OBSERVER, PILOT], 'any number on at once');
  p.button(OBSERVER).click();
  assert.equal(p.d.State.badgeSelections[OBSERVER].checked, false);
  assert.deepEqual(p.d.State.badges, [PILOT]);
  assert.equal(p.button(OBSERVER).getAttribute('aria-pressed'), 'false');
  // The keyboard: the arrow keys move, Enter and the space bar turn a tile.
  p.button(PILOT).focus();
  p.button(PILOT).dispatchEvent(keydown('ArrowRight'));
  doc.activeElement.dispatchEvent(keydown('Enter'));
  assert.equal(p.d.State.badgeSelections[OBSERVER].checked, true);
  doc.activeElement.dispatchEvent(keydown(' '));
  assert.equal(p.d.State.badgeSelections[OBSERVER].checked, false);
});

test('a badge the rules took off after a tap is off on its tile: one command pin, so turning on the group pin turns the squadron pin off', () => {
  const p = make();
  p.button(SQUADRON).click();
  assert.equal(p.button(SQUADRON).getAttribute('aria-pressed'), 'true');
  p.button(GROUP).click();
  assert.equal(p.button(GROUP).getAttribute('aria-pressed'), 'true');
  assert.equal(p.button(SQUADRON).getAttribute('aria-pressed'), 'false', 'the other pin is off on its tile too');
  assert.deepEqual(p.d.State.badges, [GROUP]);
});

test('a command pin above the grade that wears one turns back and is not selected (CAPR 39-1, 10.2.5)', () => {
  const p = make({ canCommand: false });
  p.button(SQUADRON).click();
  assert.notEqual(p.d.State.badgeSelections[SQUADRON] && p.d.State.badgeSelections[SQUADRON].checked, true);
  assert.equal(p.button(SQUADRON).getAttribute('aria-pressed'), 'false');
  assert.deepEqual(p.d.State.badges, []);
});

test('the level of a badge earned in levels is one dropdown under its tile, there only while the tile is on; picking a line changes the selection and the drawing the tile shows, and the focus stays', () => {
  const p = make();
  assert.equal(p.tile(STEM).querySelector('.vpControls').hidden, true, 'not shown while the badge is off');
  assert.ok(p.tile(PILOT).querySelector('.vpControls') === null, 'a badge with no levels has no control');
  p.button(STEM).click();
  assert.equal(p.tile(STEM).querySelector('.vpControls').hidden, false);
  assert.equal(p.tile(STEM).querySelectorAll('.vpRow').length, 0, 'no row of tiles');
  assert.equal(p.tile(STEM).querySelectorAll('select').length, 1, 'one dropdown');
  const select = () => p.tile(STEM).querySelector('select.badgeLevelSelect');
  assert.equal(select().getAttribute('aria-label'), `Level of the ${NAMES[STEM]}`);
  assert.deepEqual(select().querySelectorAll('option').map(o => o.value), ['basic', 'senior', 'master']);
  assert.deepEqual(select().querySelectorAll('option').map(o => o.textContent), ['Basic', 'Senior', 'Master']);
  assert.equal(select().value, 'basic', 'the level a badge starts at');
  const shown = () => p.tile(STEM).querySelector('.ribbonSelectShown').textContent;
  assert.equal(shown(), 'Basic');
  assert.equal(p.tile(STEM).querySelectorAll('.vpOption').length, 1, 'the tile is the only picture: no level tiles');
  assert.equal(p.tile(STEM).querySelector('img').getAttribute('src'), `images/badges/${STEM}.svg`);
  select().focus();
  select().value = 'senior';
  select().dispatchEvent({ type: 'change', target: select() });
  assert.equal(p.d.State.badgeSelections[STEM].level, 'senior');
  assert.equal(p.tile(STEM).querySelector('img').getAttribute('src'), `images/badges/${STEM}-senior.svg`, 'the drawing of the level');
  assert.equal(select().value, 'senior');
  assert.equal(shown(), 'Senior');
  assert.ok(doc.activeElement === select(), 'the member is still on the dropdown');
  assert.equal(p.button(STEM).getAttribute('aria-pressed'), 'true', 'still on');
  p.button(STEM).click();
  assert.equal(p.tile(STEM).querySelector('.vpControls').hidden, true, 'off, the dropdown is hidden');
  assert.equal(p.tile(STEM).querySelector('img').getAttribute('src'), `images/badges/${STEM}-senior.svg`, 'the tile keeps the level it was at');
  assert.equal(p.host.querySelectorAll('input').length, 0);
});

test('a level\'s long name (the paragraph in brackets) is in the open list, and the closed dropdown shows the name alone', () => {
  const d = deps();
  d.levels = id => id === STEM ? [['standard', 'No device'], ['gold-star', 'Gold star (National Complaints Resolution or Compliance Inspection Officer)']] : null;
  d.level = (id, level) => level || 'standard';
  const host = doc.createElement('div'); doc.body.append(host);
  Lists.badgeList(host, GROUPS, d);
  const cell = host.querySelectorAll('.vpCell').find(c => c.dataset.value === STEM);
  cell.querySelector('.vpOption').click();
  assert.deepEqual(cell.querySelectorAll('option').map(o => o.textContent), ['No device', 'Gold star (National Complaints Resolution or Compliance Inspection Officer)']);
  assert.equal(cell.querySelector('.ribbonSelectShown').textContent, 'No device');
  const select = cell.querySelector('select');
  select.value = 'gold-star';
  select.dispatchEvent({ type: 'change', target: select });
  assert.equal(cell.querySelector('.ribbonSelectShown').textContent, 'Gold star');
});

const PINS = { current: 'blob:current', graduated: 'blob:graduated' };
test('a command pin has one switch under it while it is on, Graduated commander, off for a current commander; pressing it sets the way the pin is worn and keeps the pin and the focus', () => {
  const p = make({ pictures: PINS });
  const worn = id => p.tile(id).querySelector('.vpCommandWorn');
  assert.ok(p.tile(SQUADRON).querySelector('.vpControls') === null, 'not there while the pin is off');
  p.button(SQUADRON).click();
  assert.ok(worn(SQUADRON) && !worn(SQUADRON).hidden, 'the switch, under the tile');
  assert.equal(worn(SQUADRON).querySelectorAll('.vpOption').length, 0, 'no tiles for the two ways');
  const sw = () => worn(SQUADRON).querySelector('.ribbonToggle');
  assert.equal(worn(SQUADRON).querySelectorAll('.ribbonToggle').length, 1);
  assert.equal(sw().textContent, 'Graduated commander');
  assert.equal(sw().getAttribute('aria-pressed'), 'false', 'a current commander at first');
  sw().focus();
  sw().click();
  assert.equal(p.d.State.commandInsignia.graduatedCommander, true);
  assert.equal(p.d.State.badgeSelections[SQUADRON].checked, true, 'the pin stays on');
  assert.equal(sw().getAttribute('aria-pressed'), 'true');
  assert.ok(doc.activeElement === sw(), 'the focus stays');
  sw().click();
  assert.equal(p.d.State.commandInsignia.graduatedCommander, false);
  assert.equal(sw().getAttribute('aria-pressed'), 'false');
  // The other pin: the one held turns off and its switch goes.
  p.button(GROUP).click();
  assert.ok(p.tile(SQUADRON).querySelector('.vpControls') === null, 'the pin turned off has no switch');
  assert.ok(worn(GROUP) && !worn(GROUP).hidden);
  assert.equal(p.host.querySelectorAll('input').length, 0);
});

test('a way the uniform does not draw the pin worn is not offered, and one way is no choice; the switch is made when the answer arrives late', async () => {
  const p = make({ pictures: { current: 'blob:current', graduated: false } });
  p.button(SQUADRON).click();
  const row = p.tile(SQUADRON).querySelector('.vpCommandWorn');
  assert.ok(row === null || row.hidden === true, 'no graduated pin on this uniform: no choice, nothing shown');
  assert.equal(p.tile(SQUADRON).querySelectorAll('.ribbonToggle').length, 0, 'no switch');
  let release;
  const late = new Promise(res => { release = res; });
  const q = make({ pictures: PINS, late });
  q.button(SQUADRON).click();
  assert.ok(q.tile(SQUADRON).querySelector('.vpCommandWorn').hidden === true, 'hidden until the pictures are made');
  release();
  await late; await Promise.resolve(); await Promise.resolve();
  const filled = q.tile(SQUADRON).querySelector('.vpCommandWorn');
  assert.equal(filled.hidden, false);
  assert.equal(filled.querySelectorAll('.ribbonToggle').length, 1);
});

test('the search: the tiles whose name, place or category do not contain the words are hidden, and a category with none left; a hidden tile is passed over by the keys', () => {
  const p = make();
  assert.equal(p.entry.picker.filter('pilot'), 1);
  assert.deepEqual(p.host.querySelectorAll('.vpCell').filter(c => !c.hidden).map(c => c.dataset.value), [PILOT]);
  assert.equal(p.host.querySelectorAll('.vpSection').filter(s => s.hidden).length, 2, 'the categories with none left');
  assert.equal(p.entry.picker.filter('command'), 2, 'a category\'s own name finds its tiles');
  assert.equal(p.entry.picker.filter(''), 5);
  assert.ok(p.host.querySelectorAll('.vpCell').every(c => !c.hidden));
});

test('the military badges of a branch are tiles too: a dropdown for the levels under the tile while it is on, the tile the badge at that level, the choice kept in State.militaryBadges', () => {
  const d = deps();
  d.State.militaryBadges = {};
  let renders = 0;
  d.fullRender = () => { renders++; };
  d.serviceLabel = s => s;
  d.variants = badge => badge.id === 'wings' ? [{ id: 'basic', record: { asset: 'm/wings-basic.svg' } }, { id: 'senior', record: { asset: 'm/wings-senior.svg' } }] : [{ id: 'only', record: { asset: 'm/pin.svg' } }];
  const records = [{ id: 'wings', officialName: 'Aviator Badge', family: 'AVIATION', authorizedServices: ['USAF'] }, { id: 'pin', officialName: 'Pin', authorizedServices: ['USN', 'USMC'] }];
  const host = doc.createElement('div'); doc.body.append(host);
  const entry = Lists.militaryBadgeList(host, 'USAF', records, d);
  assert.equal(host.querySelectorAll('input').length, 0);
  const cell = id => host.querySelectorAll('.vpCell').find(c => c.dataset.value === id);
  assert.equal(host.querySelectorAll('.vpCaption').length, 0, 'the badge\'s family and services are not under its name');
  assert.ok(cell('pin').querySelector('.vpControls') === null);
  assert.equal(cell('wings').querySelector('.vpControls').hidden, true, 'not shown while the badge is off');
  cell('wings').querySelector('.vpOption').click();
  assert.deepEqual(JSON.parse(JSON.stringify(d.State.militaryBadges)), { wings: { selected: true, variant: 'basic' } });
  assert.equal(renders, 1, 'the uniform is drawn again');
  assert.equal(cell('wings').querySelectorAll('.vpRow').length, 0, 'no row of tiles');
  assert.equal(cell('wings').querySelectorAll('select').length, 1, 'one dropdown');
  const select = () => cell('wings').querySelector('select.badgeLevelSelect');
  assert.deepEqual(select().querySelectorAll('option').map(o => o.value), ['basic', 'senior']);
  assert.equal(select().value, 'basic');
  assert.equal(cell('wings').querySelector('img').getAttribute('src'), 'm/wings-basic.svg', 'the tile is the badge at its level');
  select().focus();
  select().value = 'senior';
  select().dispatchEvent({ type: 'change', target: select() });
  assert.equal(d.State.militaryBadges.wings.variant, 'senior');
  assert.equal(cell('wings').querySelector('img').getAttribute('src'), 'm/wings-senior.svg');
  assert.equal(select().value, 'senior');
  assert.equal(cell('wings').querySelector('.vpOption').getAttribute('aria-pressed'), 'true');
  assert.ok(doc.activeElement === select(), 'the focus stays on the dropdown');
  cell('wings').querySelector('.vpOption').click();
  assert.deepEqual(d.State.militaryBadges, {});
  void entry;
});

// ---- the page: the real functions, the real state, the real build -------------------------------------------------------------------------------------

const { context } = loadPageScripts();
const run = code => JSON.parse(vm.runInContext(`JSON.stringify((function(){ ${code} })())`, context));

test('on the page a tap is the selection the build is made from: the badge goes into State.badges and into the build the engine is handed; a command pin above the grade does not', () => {
  const out = run(`
    State.membership = 'senior'; State.gender = 'male'; State.rank = 'Capt'; State.uniform = 'blues_a'; State.badges = []; State.badgeSelections = {};
    normalizeBadgeSelections();
    const lists = CAPUBPickLists;
    const on = lists.selectBadge('${OBSERVER}', true);
    const afterOn = { on, badges: State.badges, build: CAPUBUniformView.buildFromState().badges.map(b => b.id) };
    lists.selectBadge('${OBSERVER}', false);
    const afterOff = { badges: State.badges, build: CAPUBUniformView.buildFromState().badges.map(b => b.id) };
    State.rank = 'Col';
    const pin = lists.selectBadge('${SQUADRON}', true);
    return { afterOn, afterOff, pin, pinBadges: State.badges };`);
  assert.deepEqual(out.afterOn, { on: true, badges: [OBSERVER], build: [OBSERVER] });
  assert.deepEqual(out.afterOff, { badges: [], build: [] });
  assert.equal(out.pin, false, 'a colonel wears no command pin');
  assert.deepEqual(out.pinBadges, []);
});

test('the list is wired in: the chooser window builds it with the picker, the old checkbox tiles are gone from the code, and the sidebar keeps no list of its own', () => {
  const html = read('index.html');
  const at = name => html.indexOf(`<script src="js/${name}`);
  assert.ok(at('visual-picker.js') < at('pick-lists.js') && at('pick-lists.js') < at('wiring.js'), 'the lists are loaded after the picker and before the window that builds them');
  assert.match(html, /<script src="js\/pick-lists\.js\?v=[0-9a-f]+" defer><\/script>/);
  const wiring = read('js/wiring.js');
  const modal = wiring.slice(wiring.indexOf('function buildGroupedBadgeModal'), wiring.indexOf('function wireModalInteractions'));
  assert.match(modal, /CAPUBPickLists\.badgeList\(/);
  assert.match(modal, /CAPUBPickLists\.militaryBadgeList\(/);
  assert.doesNotMatch(modal, /checkbox|bdChk|cmdGradChk|militaryBadgeCatalogCheck|type = 'radio'/, 'no box and no radio button in the badges of the window');
  assert.match(wiring, /const pickers = window\.CAPUB_MODAL_PICKERS \|\| \[\];/, 'the search reads the pickers');
  for(const f of ['js/galleries.js', 'js/patches.js']){
    const src = read(f);
    assert.doesNotMatch(src, /class="bdChk"|class="cmdGradChk"/, `${f}: no badge tile with a box`);
  }
  const lists = read('js/pick-lists.js');
  assert.doesNotMatch(lists.replace(/\/\/.*$/gm, ''), /checkbox|type = 'radio'|createElement\('input'\)/);
});

// The owner (2026-11-13): "remove these lower letters": a badge tile is the picture and the name. What the drawing did with a badge the member turns on (the place it takes, or why it is left off,
// with the paragraph) is said once in the window's status line; a badge that is chosen and left off carries the not-worn mark in the tick's place and its picture is never dimmed; nothing is said for a badge turned off.
test('a tap says in the window\'s status line where the badge is worn or why it is left off, and a chosen badge the drawing leaves off carries the not-worn mark, never a dim picture; the tiles carry no line of their own', () => {
  const p = make();
  ROWS = []; SAID.length = 0;
  const muted = id => p.button(id).classList.contains('isNotWorn');
  const never = () => assert.ok(p.host.querySelectorAll('.vpOption').every(b => !b.classList.contains('isMuted')), 'no tile is ever dimmed');
  never();
  p.button(OBSERVER).click();
  assert.deepEqual(SAID, [''], 'the drawing has not been made yet: nothing to say');
  const WHY = 'Only one CAP aviation badge is worn (CAPR 39-1, 7.1.1.3.1)';
  ROWS = [{ id: OBSERVER, name: NAMES[OBSERVER], shown: true, place: 'above the ribbons', why: '' }];
  SAID.length = 0;
  p.entry.rendered();
  assert.deepEqual(SAID, ['Observer Badge: above the ribbons.'], 'the drawing was made: the place it took');
  p.button(PILOT).click();
  ROWS = [{ id: OBSERVER, name: NAMES[OBSERVER], shown: true, place: 'above the ribbons', why: '' }, { id: PILOT, name: NAMES[PILOT], shown: false, place: '', why: WHY }];
  SAID.length = 0;
  p.entry.rendered();
  assert.deepEqual(SAID, [`Pilot Badge is not shown. ${WHY}`], 'chosen and left off: why, with the paragraph (the page puts it behind a question mark)');
  assert.ok(muted(PILOT), 'chosen and left off: the not-worn mark takes the tick\'s place');
  assert.ok(!muted(OBSERVER), 'a badge the drawing wears keeps its tick');
  assert.equal(p.button(PILOT).querySelector('.vpOffWords').hidden, false, 'said to assistive technology');
  assert.equal(p.button(OBSERVER).querySelector('.vpOffWords').hidden, true);
  never();
  assert.equal(p.tile(PILOT).querySelector('.vpLabel').textContent, 'Pilot Badge', 'its name stays');
  // The tile itself has no line, however it is shaded.
  assert.ok(p.host.querySelectorAll('.vpCell').every(c => c.querySelector('.vpCaption') === null));
  assert.doesNotMatch(p.host.textContent, /Only one CAP|shown|Above the/i, 'no reason, no place on a tile');
  // Turned off: nothing is said, and the tile is not dim.
  p.button(PILOT).click();
  assert.equal(SAID[SAID.length - 1], '', 'the status line is cleared');
  ROWS = [{ id: OBSERVER, name: NAMES[OBSERVER], shown: true, place: 'above the ribbons', why: '' }];
  p.entry.rendered();
  assert.ok(!muted(PILOT), 'a badge turned off has no mark');
  never();
  assert.equal(SAID[SAID.length - 1], '', 'a badge that is off says nothing');
  // The sentence is the drawing's own: the place as it stands, the reason with its first letter capital and a stop where it has none.
  assert.equal(Lists.badgeNote([{ id: 'x', shown: false, why: 'it cannot be shown on this uniform' }], 'x', 'The X'), 'The X is not shown. It cannot be shown on this uniform.');
  assert.equal(Lists.badgeNote([{ id: 'x', shown: true, place: 'left pocket' }], 'x', 'The X'), 'The X: left pocket.');
  assert.equal(Lists.badgeNote([{ id: 'x', pending: true }], 'x', 'The X'), '');
  assert.equal(Lists.badgeNote([], 'x', 'The X'), '');
  ROWS = [];
});
