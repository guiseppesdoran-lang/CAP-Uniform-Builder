'use strict';
// The card that offers the order of badges of equal standing (js/badge-order.js), in the Badges card of the page. It is made from the drawing's own
// report (scene.badgeOrders) and from nothing else: a stack the report lists gets a row of picture tiles, one for each order the badges may take, each the engine's drawing of the
// uniform with that order; a stack it does not list gets nothing. The DOM is the small stand-in of tests/helpers/mini-dom.cjs.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createDocument, Node } = require('./helpers/mini-dom.cjs');

const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

const doc = createDocument();
global.document = doc;
Node.prototype.insertAdjacentElement = function(where, el){
  assert.equal(where, 'afterend');
  const siblings = this.parentNode.childNodes;
  if(el.parentNode) el.parentNode.removeChild(el);
  el.parentNode = this.parentNode;
  siblings.splice(siblings.indexOf(this) + 1, 0, el);
  return el;
};
const VisualPicker = require('../js/visual-picker.js');
const Lists = require('../js/pick-lists.js');
global.VisualPicker = VisualPicker;
global.CAPUBPickLists = Lists;
const BadgeOrder = require('../js/badge-order.js');
const Catalog = require('../data/badge-catalog.js');

const GT = 'ground_team_basic_badge', NURSE = 'nurse_officer', EMT = 'emt_basic_badge', LEGAL = 'legal_officer';
const TITLE = { [GT]: 'Ground Team Badge', [NURSE]: 'Nurse Officer Badge', [EMT]: 'EMT Badge', [LEGAL]: 'Legal Officer Badge' };
const entry = (ids, extra) => Object.assign({ group: 'occupational', label: 'Occupational badges', place: 'over the left pocket', ref: '4.1.9.4.4.1', badges: ids.map(id => ({ id, title: TITLE[id] })), swap: true, why: '' }, extra || {});
const scene = (...entries) => ({ uniform: 'blues_a', badgeOrders: entries });

function host(){
  const h = doc.createElement('div');
  doc.body.append(h);
  return h;
}
// The pictures the engine would give: one for each order asked for (a map order -> picture, false for one it does not keep), as a test says it.
const pictured = (known) => ({ pictures: (group, values) => { const now = {}; for(const v of values) now[v] = known && v in known ? known[v] : 'blob:' + v.split(',').map(x => x.slice(0, 3)).join('-'); return { now, ready: Promise.resolve(now), settled: true }; } });
const tiles = h => h.querySelectorAll('.vpOption');
const labels = h => tiles(h).map(t => t.querySelector('.vpLabel').textContent);
const checked = h => tiles(h).filter(t => t.getAttribute('aria-checked') === 'true').map(t => t.dataset.value);
const render = (h, sc, onChoose, focus, deps) => BadgeOrder.render(h, sc, onChoose || (() => {}), focus, Object.assign({ VisualPicker }, pictured(), deps || {}));

test('a pair the drawing reports is a row of two tiles, each the uniform with that order; the order drawn is picked; a pick says which order', () => {
  const h = host(), calls = [];
  const groups = render(h, scene(entry([GT, NURSE])), (...a) => calls.push(a));
  assert.equal(groups.length, 1);
  assert.equal(h.classList.contains('hidden'), false, 'the card is shown');
  assert.equal(h.querySelectorAll('button').filter(b => !b.classList.contains('vpOption')).length, 0, 'no Swap button: the tiles are the choice');
  assert.equal(h.querySelectorAll('select').length + h.querySelectorAll('input').length, 0);
  assert.deepEqual(labels(h), ['Ground Team Badge over Nurse Officer Badge', 'Nurse Officer Badge over Ground Team Badge'], 'each order named top to bottom');
  assert.ok(tiles(h).every(t => t.nodeName === 'BUTTON' && t.getAttribute('role') === 'radio' && t.querySelector('img')), 'radio buttons, each with the engine\'s picture');
  assert.deepEqual(tiles(h).map(t => t.getAttribute('title')), ['Top to bottom: Ground Team Badge, Nurse Officer Badge', 'Top to bottom: Nurse Officer Badge, Ground Team Badge']);
  assert.deepEqual(checked(h), [`${GT},${NURSE}`], 'the order the drawing has');
  assert.equal(h.querySelector('.vp').dataset.layout, 'row', 'a row of tiles');
  tiles(h)[1].click();
  assert.deepEqual(calls, [['occupational', [NURSE, GT]]], 'the other order');
});

test('the group is named by its heading, and the rule is stated with its paragraph (the page puts the paragraph behind the question mark)', () => {
  const h = host();
  render(h, scene(entry([GT, NURSE])));
  const section = h.querySelector('section');
  assert.equal(section.getAttribute('role'), 'group');
  const head = h.querySelector('.badgeOrderTitle');
  assert.equal(head.textContent, 'Occupational badges over the left pocket');
  assert.equal(section.getAttribute('aria-labelledby'), head.id);
  assert.equal(h.querySelector('.badgeOrderNote').textContent, 'The regulation sets no order between these badges, so either may be worn higher (CAPR 39-1, 4.1.9.4.4.1).');
  const bare = host();
  render(bare, scene(entry([GT, NURSE], { ref: '' })));
  assert.equal(bare.querySelector('.badgeOrderNote').textContent, 'The regulation sets no order between these badges, so either may be worn higher.');
});

test('three or four badges are every order they may take, in a fixed order of tiles, each named top to bottom; a pick of one says the whole order', () => {
  const h = host(), calls = [];
  render(h, scene(entry([GT, NURSE, EMT])), (...a) => calls.push(a));
  assert.equal(tiles(h).length, 6, 'three badges, six orders');
  assert.equal(new Set(tiles(h).map(t => t.dataset.value)).size, 6, 'all different');
  assert.deepEqual(checked(h), [`${GT},${NURSE},${EMT}`]);
  assert.ok(tiles(h).every(t => t.dataset.value.split(',').sort().join() === [GT, NURSE, EMT].sort().join()), 'each is the three badges');
  const pick = tiles(h).find(t => t.dataset.value === `${EMT},${GT},${NURSE}`);
  pick.click();
  assert.deepEqual(calls, [['occupational', [EMT, GT, NURSE]]]);
  // What a pick does to the saved choice, through the catalog's own function: the whole order for the group, another group untouched.
  assert.deepEqual(Catalog.setEqual({}, 'occupational', calls[0][1]), { occupational: [EMT, GT, NURSE] });
  const four = host();
  render(four, scene(entry([GT, NURSE, EMT, LEGAL])));
  assert.equal(tiles(four).length, 24, 'four badges, twenty-four orders: a row that scrolls');
  // The tiles keep their places when another order is picked: the same list of orders whatever order the drawing has.
  const again = host();
  render(again, scene(entry([EMT, GT, NURSE])));
  assert.deepEqual(tiles(again).map(t => t.dataset.value), tiles(h).map(t => t.dataset.value), 'the tiles do not move');
  assert.deepEqual(checked(again), [`${EMT},${GT},${NURSE}`]);
  // The orders are all the arrangements and nothing more.
  assert.deepEqual(BadgeOrder.orders([GT, NURSE]).map(o => o.join()).sort(), [`${GT},${NURSE}`, `${NURSE},${GT}`].sort());
  assert.equal(BadgeOrder.orders(['a', 'b', 'c', 'd', 'e']).length, 5, 'past four: the order as it stands and each badge moved one place');
});

test('an order the engine does not keep is not offered, unless it is the one drawn', () => {
  const h = host();
  render(h, scene(entry([GT, NURSE, EMT])), null, null, pictured({ [`${NURSE},${GT},${EMT}`]: false, [`${GT},${NURSE},${EMT}`]: false }));
  assert.equal(tiles(h).length, 5, 'one order dropped; the one drawn stays though the engine would not draw it');
  assert.ok(!tiles(h).some(t => t.dataset.value === `${NURSE},${GT},${EMT}`));
  assert.deepEqual(checked(h), [`${GT},${NURSE},${EMT}`]);
});

test('with no pictures the tiles are still the choice (the words of each order), and pictures that arrive later fill them', async () => {
  const h = host();
  BadgeOrder.render(h, scene(entry([GT, NURSE])), () => {}, null, { VisualPicker, pictures: () => null });
  assert.equal(tiles(h).length, 2);
  assert.ok(tiles(h).every(t => !t.querySelector('img')));
  let release;
  const late = new Promise(res => { release = res; });
  const known = { [`${GT},${NURSE}`]: 'blob:a', [`${NURSE},${GT}`]: 'blob:b' };
  const l = host();
  BadgeOrder.render(l, scene(entry([GT, NURSE])), () => {}, null, { VisualPicker, pictures: () => ({ now: {}, ready: late.then(() => known), settled: false }) });
  assert.ok(tiles(l).every(t => !t.querySelector('img')), 'words until the pictures are made');
  release();
  await late; await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(tiles(l).map(t => t.querySelector('img').getAttribute('src')), ['blob:a', 'blob:b']);
  // A card drawn again meanwhile is not painted over by the pictures of the one before.
  const m = host();
  let release2;
  const late2 = new Promise(res => { release2 = res; });
  BadgeOrder.render(m, scene(entry([GT, NURSE])), () => {}, null, { VisualPicker, pictures: () => ({ now: {}, ready: late2.then(() => known), settled: false }) });
  render(m, scene());
  release2();
  await late2; await Promise.resolve(); await Promise.resolve();
  assert.equal(tiles(m).length, 0, 'the card was drawn empty after; the late pictures do not bring it back');
});

test('where the swap would not fit the garment there is no tile, and the card says why', () => {
  const h = host();
  const why = 'Swapped, the two badges would reach the shoulder board, so they stay in this order (CAPR 39-1, 4.1.9.4.4.1)';
  render(h, scene(entry([GT, NURSE], { swap: false, why })), () => { throw new Error('no pick is possible'); });
  assert.equal(h.querySelectorAll('button').length, 0);
  assert.equal(h.querySelector('.badgeOrderWhy').textContent, why);
  assert.equal(h.classList.contains('hidden'), false, 'the stack is still shown, in the order it has');
  assert.deepEqual(h.querySelectorAll('.badgeOrderName').map(n => n.textContent), ['Ground Team Badge', 'Nurse Officer Badge']);
  const trio = host();
  render(trio, scene(entry([GT, NURSE, EMT], { swap: false, why })));
  assert.equal(trio.querySelectorAll('button').length, 0, 'nor any tile');
});

test('no stack in the report, no card: a fixed order, one badge, no drawing', () => {
  for(const s of [scene(), { uniform: 'blues_a' }, null, undefined, scene(entry([GT])), scene({ group: 'occupational', badges: [] })]){
    const h = host();
    h.append('left over');
    const groups = render(h, s);
    assert.deepEqual(groups, [], JSON.stringify(s));
    assert.equal(h.classList.contains('hidden'), true);
    assert.equal(h.children.length, 0, 'nothing left from a drawing before');
    assert.equal(h.querySelectorAll('button').length, 0);
  }
});

test('the drawing is redrawn after a pick and the focus stays on the tile of the order picked', () => {
  const h = host();
  render(h, scene(entry([GT, NURSE])));
  render(h, scene(entry([NURSE, GT])), () => {}, { group: 'occupational' });
  assert.deepEqual(checked(h), [`${NURSE},${GT}`]);
  assert.equal(doc.activeElement, tiles(h).find(t => t.getAttribute('aria-checked') === 'true'), 'the tile of the order now drawn');
});

test('the page glue: the card sits in the Badges card, is made only for the drawing of the uniform on screen, and a pick changes the setup and redraws', () => {
  const group = doc.createElement('section');
  const after = doc.createElement('div');
  after.id = 'badgesPlannedNote';
  group.append(after);
  doc.body.append(group);
  let renders = 0;
  global.State = { uniform: 'blues_a', badgeOrder: {} };
  global.CAPUBBadgeCatalog = Catalog;
  global.CAPUBUniformView = { scheduleRender: () => { renders++; } };
  global.CAPUBOptionPictures = { pictures: (name, values) => { const now = Object.fromEntries(values.map(v => [v, 'blob:' + v])); return { now, ready: Promise.resolve(now), settled: true }; } };
  try{
    BadgeOrder.update(scene(entry([GT, NURSE])));
    const card = doc.getElementById(BadgeOrder.HOST_ID);
    assert.ok(card, 'the card exists');
    assert.equal(card.parentNode, group);
    assert.equal(group.children.indexOf(card), group.children.indexOf(after) + 1, 'right under the note of the Badges card');
    assert.equal(tiles(card).length, 2);
    assert.deepEqual(tiles(card).map(t => t.querySelector('img').getAttribute('src')), tiles(card).map(t => 'blob:' + t.dataset.value), 'the engine\'s own drawing of each');
    // What a pick did is said in a line that stays when the card is drawn again, so a screen reader announces the change.
    const status = doc.getElementById(BadgeOrder.STATUS_ID);
    assert.equal(status.getAttribute('role'), 'status');
    assert.equal(status.getAttribute('aria-live'), 'polite');
    assert.equal(group.children.indexOf(status), group.children.indexOf(card) + 1, 'beside the card, outside what is redrawn');
    tiles(card).find(t => t.dataset.value === `${NURSE},${GT}`).click();
    assert.deepEqual(global.State.badgeOrder, { occupational: [NURSE, GT] }, 'the nurse badge is now the higher');
    assert.equal(renders, 1, 'and the page draws again');
    // A drawing of another uniform than the one on screen shows no card.
    BadgeOrder.update(Object.assign(scene(entry([GT, NURSE])), { uniform: 'ocp' }));
    assert.equal(card.classList.contains('hidden'), true);
    BadgeOrder.update(scene());
    assert.equal(card.classList.contains('hidden'), true, 'a uniform with no stack to order');
    // After the pick the redraw says what the order is.
    global.State.uniform = 'blues_a';
    global.State.badgeOrder = {};
    BadgeOrder.update(scene(entry([GT, NURSE])));
    tiles(card).find(t => t.dataset.value === `${NURSE},${GT}`).click();
    BadgeOrder.update(scene(entry([NURSE, GT])));
    assert.equal(doc.getElementById(BadgeOrder.STATUS_ID), status, 'the same line');
    assert.equal(status.textContent, 'Nurse Officer Badge is now worn above Ground Team Badge.');
    assert.equal(doc.activeElement, tiles(card).find(t => t.getAttribute('aria-checked') === 'true'), 'the focus stays on the order picked');
    // Three badges: the whole order is said.
    global.State.badgeOrder = {};
    BadgeOrder.update(scene(entry([GT, NURSE, EMT])));
    tiles(card).find(t => t.dataset.value === `${EMT},${GT},${NURSE}`).click();
    assert.deepEqual(global.State.badgeOrder, { occupational: [EMT, GT, NURSE] });
    BadgeOrder.update(scene(entry([EMT, GT, NURSE])));
    assert.equal(status.textContent, 'The badges are now worn, top to bottom: EMT Badge, Ground Team Badge, Nurse Officer Badge.');
  }finally{
    delete global.State; delete global.CAPUBBadgeCatalog; delete global.CAPUBUniformView; delete global.CAPUBOptionPictures;
  }
});
