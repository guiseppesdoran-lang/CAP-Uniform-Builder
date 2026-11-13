'use strict';
// The owner (2026-11-12): "Badge selection ... should be like the other selections (no checkboxes, those are annoying)". The badges of the chooser window are picture tiles (js/pick-lists.js
// on the picture picker's toggle mode): the badge's own drawing, its name and where it is worn under it; a tap turns it on or off, the tile shows it; the level of a badge and the
// Graduated commander switch of a command pin are under the tile while it is on. No checkbox and no radio button is in the list.

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
let ROWS = [];   // what the drawing did with each badge chosen (js/badge-rules.js capubBadgeSummary), as a test says it
function deps(extra){
  const State = { badgeSelections: {}, badges: [], commandInsignia: { graduatedCommander: false }, rank: 'Capt' };
  const d = {
    State, VisualPicker, asset: p => 'images/' + p, artPath: id => `badges/${id}${(State.badgeSelections[id] || {}).level ? '-' + State.badgeSelections[id].level : ''}.svg`, name: id => NAMES[id] || id,
    caption: id => 'Worn: above the left pocket', isCommand: id => id === SQUADRON || id === GROUP,
    levels: id => id === STEM ? [['basic', 'Basic'], ['senior', 'Senior'], ['master', 'Master']] : null, level: (id, level) => level || 'basic',
    canCommand: () => !extra || extra.canCommand !== false, chooseOnlyCommand: id => { for(const x of [SQUADRON, GROUP]) if(x !== id && State.badgeSelections[x]) State.badgeSelections[x].checked = false; },
    rebuild: () => { State.badges = Object.keys(State.badgeSelections).filter(id => State.badgeSelections[id].checked); },
    badgeRows: () => ROWS
  };
  return d;
}
const GROUPS = [{ key: 'Aviation / Aircrew', ids: [PILOT, OBSERVER] }, { key: 'Cadet Specialty Track Badges', ids: [STEM] }, { key: 'Command', ids: [SQUADRON, GROUP] }];
const make = (extra, groups) => {
  const d = deps(extra);
  const host = doc.createElement('div'); doc.body.append(host);
  const entry = Lists.badgeList(host, groups || GROUPS, d);
  return { d, host, entry, tile: id => host.querySelectorAll('.vpCell').find(c => c.dataset.value === id), button: id => host.querySelectorAll('.vpCell').find(c => c.dataset.value === id).querySelector('.vpOption') };
};

test('the badges are picture tiles: each with its own drawing, its name and where it is worn, under a heading for its category; no checkbox or radio button is in the list', () => {
  const p = make();
  assert.equal(p.host.querySelectorAll('input').length, 0, 'no input at all');
  assert.deepEqual(p.host.querySelectorAll('.vpGroupHead').map(h => h.textContent), ['Aviation / Aircrew', 'Cadet Specialty Track Badges', 'Command']);
  const cells = p.host.querySelectorAll('.vpCell');
  assert.deepEqual(cells.map(c => c.querySelector('.vpLabel').textContent), [NAMES[PILOT], NAMES[OBSERVER], NAMES[STEM], NAMES[SQUADRON], NAMES[GROUP]]);
  assert.deepEqual(cells.map(c => c.querySelector('img').getAttribute('src')), [PILOT, OBSERVER, STEM, SQUADRON, GROUP].map(id => `images/badges/${id}.svg`), 'the badge\'s own drawing');
  assert.ok(cells.every(c => c.querySelector('.vpCaption').textContent === 'Worn: above the left pocket'));
  assert.ok(cells.every(c => c.querySelector('img').getAttribute('loading') === 'lazy'), 'the pictures load as they come into view');
  assert.ok(p.host.querySelectorAll('.vpOption').every(b => b.nodeName === 'BUTTON' && b.getAttribute('aria-pressed') === 'false'), 'buttons with aria-pressed, off to begin with');
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

test('the level of a badge earned in levels is a list under its tile, shown while the tile is on; picking a level changes the drawing the tile shows and the selection', () => {
  const p = make();
  const controls = p.tile(STEM).querySelector('.vpControls');
  assert.equal(controls.hidden, true, 'not shown while the badge is off');
  assert.equal(p.tile(PILOT).querySelector('.vpControls'), null, 'a badge with no levels has no control');
  p.button(STEM).click();
  assert.equal(p.tile(STEM).querySelector('.vpControls').hidden, false);
  const select = p.tile(STEM).querySelector('select.bdLevel');
  assert.deepEqual(select.querySelectorAll('option').map(o => o.value), ['basic', 'senior', 'master']);
  select.value = 'senior';
  select.dispatchEvent({ type: 'change', bubbles: true });
  assert.equal(p.d.State.badgeSelections[STEM].level, 'senior');
  assert.equal(p.tile(STEM).querySelector('img').getAttribute('src'), `images/badges/${STEM}-senior.svg`, 'the drawing of the level');
  assert.equal(p.button(STEM).getAttribute('aria-pressed'), 'true', 'still on');
  assert.equal(p.host.querySelectorAll('input').length, 0);
});

test('a command pin has a Graduated commander switch under its tile while it is on, a button with aria-pressed, not a box', () => {
  const p = make();
  const control = id => p.tile(id).querySelector('.vpControls');
  assert.equal(control(SQUADRON).hidden, true);
  p.button(SQUADRON).click();
  assert.equal(control(SQUADRON).hidden, false);
  const sw = control(SQUADRON).querySelector('button.vpSwitch');
  assert.equal(sw.textContent, 'Graduated commander');
  assert.equal(sw.getAttribute('aria-pressed'), 'false');
  sw.click();
  assert.equal(p.d.State.commandInsignia.graduatedCommander, true);
  assert.equal(sw.getAttribute('aria-pressed'), 'true');
  sw.click();
  assert.equal(p.d.State.commandInsignia.graduatedCommander, false);
  assert.equal(sw.getAttribute('aria-pressed'), 'false');
  assert.equal(p.host.querySelectorAll('input').length, 0);
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

test('the military badges of a branch are tiles too: a variant list under the tile while it is on, the choice kept in State.militaryBadges', () => {
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
  assert.deepEqual(host.querySelectorAll('.vpCaption').map(c => c.textContent), ['Aviation • USAF', 'USN / USMC']);
  assert.equal(cell('pin').querySelector('.vpControls'), null);
  cell('wings').querySelector('.vpOption').click();
  assert.deepEqual(JSON.parse(JSON.stringify(d.State.militaryBadges)), { wings: { selected: true, variant: 'basic' } });
  assert.equal(renders, 1, 'the uniform is drawn again');
  assert.equal(cell('wings').querySelector('.vpControls').hidden, false);
  const select = cell('wings').querySelector('select');
  select.value = 'senior';
  select.dispatchEvent({ type: 'change', bubbles: true });
  assert.equal(d.State.militaryBadges.wings.variant, 'senior');
  assert.equal(cell('wings').querySelector('img').getAttribute('src'), 'm/wings-senior.svg');
  assert.equal(cell('wings').querySelector('.vpOption').getAttribute('aria-pressed'), 'true');
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

// The owner (2026-11-12): the list "Where your badges are worn" is folded into the tiles. A badge that is chosen says under its name what the drawing did with it, the one line the list gave:
// the place it takes on this uniform, or why it is left off, with its paragraph; a badge that is not chosen keeps its general line; never two lines, never "shown" or "not shown".
test('the line under a chosen badge\'s name is its place on this uniform or why it is left off; an unchosen badge keeps its general line; one line, no "shown" or "not shown"', () => {
  const p = make();
  ROWS = [];
  const caps = id => p.tile(id).querySelectorAll('.vpCaption').map(c => c.textContent);
  assert.deepEqual(caps(OBSERVER), ['Worn: above the left pocket'], 'not chosen: the general line');
  p.button(OBSERVER).click(); p.button(PILOT).click(); p.button(STEM).click();
  const WHY = 'No place is left for it on this uniform, which wears 4 (CAPR 39-1, 4.1.5.2.2.4)';
  ROWS = [{ id: OBSERVER, shown: true, place: 'above the ribbons', why: '' }, { id: PILOT, shown: false, place: '', why: WHY }, { id: STEM, pending: true }];
  // The drawing has been made again: the open chooser puts each line as the drawing has it.
  p.entry.rendered();
  assert.deepEqual(caps(OBSERVER), ['Above the ribbons'], 'chosen and drawn: its place');
  assert.deepEqual(caps(PILOT), [WHY], 'chosen and left off: why, with the paragraph (the page puts it behind a question mark)');
  assert.deepEqual(caps(STEM), ['Worn: above the left pocket'], 'chosen but not drawn yet: the general line');
  assert.deepEqual(caps(SQUADRON), ['Worn: above the left pocket'], 'not chosen: the general line');
  assert.ok(p.host.querySelectorAll('.vpCell').every(c => c.querySelectorAll('.vpCaption').length === 1), 'one line under a name, never two');
  assert.ok(p.host.querySelectorAll('.vpCaption').every(c => c.parentNode.dataset.value && c.parentNode.querySelector('.vpOption') && !c.parentNode.querySelector('.vpOption').contains(c)), 'outside the button, so a reference in it carries its mark');
  assert.doesNotMatch(p.host.textContent, /\bshown\b/i, 'no "shown" or "not shown"');
  p.button(PILOT).click();
  ROWS = [{ id: OBSERVER, shown: true, place: 'above the ribbons', why: '' }];
  p.entry.rendered();
  assert.deepEqual(caps(PILOT), ['Worn: above the left pocket'], 'turned off: back to its general line');
  // The line is the sentence's own: the first letter capital, a stop where the text has none.
  assert.equal(Lists.badgeLine([{ id: 'x', shown: false, why: 'it cannot be shown on this uniform' }], 'x', 'general'), 'It cannot be shown on this uniform.');
  assert.equal(Lists.badgeLine([{ id: 'x', shown: true, place: 'left pocket' }], 'x', 'general'), 'Left pocket');
  assert.equal(Lists.badgeLine([], 'x', 'general'), 'general');
  ROWS = [];
});
