'use strict';
// The card that offers the swap of two badges of equal standing (js/badge-order.js), in the Badges card of the page. It is made from the drawing's own
// report (scene.badgeOrders) and from nothing else: a stack the report lists gets a plain button, a stack it does not list gets nothing. The DOM is the
// small stand-in of tests/helpers/mini-dom.cjs.
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
const BadgeOrder = require('../js/badge-order.js');
const Catalog = require('../data/badge-catalog.js');

const GT = 'ground_team_basic_badge', NURSE = 'nurse_officer', EMT = 'emt_basic_badge';
const TITLE = { [GT]: 'Ground Team Badge', [NURSE]: 'Nurse Officer Badge', [EMT]: 'EMT Badge' };
const entry = (ids, extra) => Object.assign({ group: 'occupational', label: 'Occupational badges', place: 'over the left pocket', ref: '4.1.9.4.4.1', badges: ids.map(id => ({ id, title: TITLE[id] })), swap: true, why: '' }, extra || {});
const scene = (...entries) => ({ uniform: 'blues_a', badgeOrders: entries });

function host(){
  const h = doc.createElement('div');
  doc.body.append(h);
  return h;
}
const buttons = h => h.querySelectorAll('button');
const names = h => buttons(h).map(b => b.getAttribute('aria-label'));

test('a pair the drawing reports gets one Swap button whose name says which two badges trade places', () => {
  const h = host(), calls = [];
  const groups = BadgeOrder.render(h, scene(entry([GT, NURSE])), (...a) => calls.push(a));
  assert.equal(groups.length, 1);
  assert.equal(h.classList.contains('hidden'), false, 'the card is shown');
  assert.deepEqual(names(h), ['Swap the Ground Team Badge and the Nurse Officer Badge']);
  const [swap] = buttons(h);
  assert.equal(swap.nodeName, 'BUTTON', 'a real button, so the keyboard reaches it');
  assert.equal(swap.getAttribute('type'), 'button');
  assert.equal(swap.textContent, 'Swap');
  assert.ok(swap.getAttribute('aria-label').startsWith(swap.textContent), 'the name begins with the words on the button');
  assert.deepEqual(h.querySelectorAll('.badgeOrderRow').map(r => r.querySelector('.badgeOrderName').textContent), ['Ground Team Badge', 'Nurse Officer Badge']);
  assert.deepEqual(h.querySelectorAll('.badgeOrderPosition').map(r => r.textContent), ['Higher', 'Lower']);
  swap.click();
  assert.deepEqual(calls, [['occupational', [GT, NURSE], GT, 1, 'swap']], 'the upper badge moves down: the pair trades places');
});

test('the group is named by its heading, and the rule is stated with its paragraph (the page puts the paragraph behind the question mark)', () => {
  const h = host();
  BadgeOrder.render(h, scene(entry([GT, NURSE])), () => {});
  const section = h.querySelector('section');
  assert.equal(section.getAttribute('role'), 'group');
  const head = h.querySelector('.badgeOrderTitle');
  assert.equal(head.textContent, 'Occupational badges over the left pocket');
  assert.equal(section.getAttribute('aria-labelledby'), head.id);
  assert.equal(h.querySelector('.badgeOrderNote').textContent, 'The regulation sets no order between these badges, so either may be worn higher (CAPR 39-1, 4.1.9.4.4.1).');
  const bare = host();
  BadgeOrder.render(bare, scene(entry([GT, NURSE], { ref: '' })), () => {});
  assert.equal(bare.querySelector('.badgeOrderNote').textContent, 'The regulation sets no order between these badges, so either may be worn higher.');
});

test('three or more get "Move up" and "Move down" for each badge, none past an end, each named for its badge', () => {
  const h = host(), calls = [];
  BadgeOrder.render(h, scene(entry([GT, NURSE, EMT])), (...a) => calls.push(a));
  assert.deepEqual(h.querySelectorAll('.badgeOrderPosition').map(r => r.textContent), ['Highest', '2nd', 'Lowest']);
  assert.deepEqual(names(h), [
    'Move down the Ground Team Badge',
    'Move up the Nurse Officer Badge', 'Move down the Nurse Officer Badge',
    'Move up the EMT Badge'
  ]);
  assert.ok(!names(h).some(n => /^Swap/.test(n)), 'no Swap for more than two');
  for(const b of buttons(h)) assert.ok(b.getAttribute('aria-label').toLowerCase().includes(b.textContent.toLowerCase()), `${b.getAttribute('aria-label')}: the name holds the words on the button`);
  const byName = n => buttons(h).find(b => b.getAttribute('aria-label') === n);
  byName('Move up the Nurse Officer Badge').click();
  byName('Move up the EMT Badge').click();
  assert.deepEqual(calls, [['occupational', [GT, NURSE, EMT], NURSE, -1, 'up'], ['occupational', [GT, NURSE, EMT], EMT, -1, 'up']]);
  // What a press does to the saved choice, through the catalog's own function.
  assert.deepEqual(Catalog.moveEqual({}, 'occupational', calls[0][1], calls[0][2], calls[0][3]), { occupational: [NURSE, GT, EMT] });
});

test('where the swap would not fit the garment there is no button, and the card says why', () => {
  const h = host();
  const why = 'Swapped, the two badges would reach the shoulder board, so they stay in this order (CAPR 39-1, 4.1.9.4.4.1)';
  BadgeOrder.render(h, scene(entry([GT, NURSE], { swap: false, why })), () => { throw new Error('no press is possible'); });
  assert.equal(buttons(h).length, 0);
  assert.equal(h.querySelector('.badgeOrderWhy').textContent, why);
  assert.equal(h.classList.contains('hidden'), false, 'the stack is still shown, in the order it has');
  assert.deepEqual(h.querySelectorAll('.badgeOrderName').map(n => n.textContent), ['Ground Team Badge', 'Nurse Officer Badge']);
  const trio = host();
  BadgeOrder.render(trio, scene(entry([GT, NURSE, EMT], { swap: false, why })), () => {});
  assert.equal(buttons(trio).length, 0, 'nor any Move button');
});

test('no stack in the report, no card: a fixed order, one badge, no drawing', () => {
  for(const s of [scene(), { uniform: 'blues_a' }, null, undefined, scene(entry([GT])), scene({ group: 'occupational', badges: [] })]){
    const h = host();
    h.append('left over');
    const groups = BadgeOrder.render(h, s, () => {});
    assert.deepEqual(groups, [], JSON.stringify(s));
    assert.equal(h.classList.contains('hidden'), true);
    assert.equal(h.children.length, 0, 'nothing left from a drawing before');
    assert.equal(buttons(h).length, 0);
  }
});

test('the drawing is redrawn after a press and the focus stays with the control the member used', () => {
  const h = host();
  BadgeOrder.render(h, scene(entry([GT, NURSE])), () => {});
  BadgeOrder.render(h, scene(entry([NURSE, GT])), () => {}, { group: 'occupational', id: GT, how: 'swap' });
  assert.equal(doc.activeElement, buttons(h)[0], 'the Swap button, the new one');
  assert.equal(buttons(h)[0].getAttribute('aria-label'), 'Swap the Nurse Officer Badge and the Ground Team Badge');
  // A badge moved to the top has no "Move up" any more: the focus goes to its "Move down", the next thing it can do.
  BadgeOrder.render(h, scene(entry([GT, NURSE, EMT])), () => {});
  BadgeOrder.render(h, scene(entry([NURSE, GT, EMT])), () => {}, { group: 'occupational', id: NURSE, how: 'up' });
  assert.equal(doc.activeElement.getAttribute('aria-label'), 'Move down the Nurse Officer Badge');
  BadgeOrder.render(h, scene(entry([NURSE, EMT, GT])), () => {}, { group: 'occupational', id: GT, how: 'down' });
  assert.equal(doc.activeElement.getAttribute('aria-label'), 'Move up the Ground Team Badge');
});

test('the page glue: the card sits under "Where your badges are worn", is made only for the drawing of the uniform on screen, and a press changes the setup and redraws', () => {
  const group = doc.createElement('section');
  const summary = doc.createElement('div');
  summary.id = 'badgeSummary';
  const after = doc.createElement('div');
  after.id = 'badgesPlannedNote';
  group.append(summary, after);
  doc.body.append(group);
  let renders = 0;
  global.State = { uniform: 'blues_a', badgeOrder: {} };
  global.CAPUBBadgeCatalog = Catalog;
  global.CAPUBUniformView = { scheduleRender: () => { renders++; } };
  try{
    BadgeOrder.update(scene(entry([GT, NURSE])));
    const card = doc.getElementById(BadgeOrder.HOST_ID);
    assert.ok(card, 'the card exists');
    assert.equal(card.parentNode, group);
    assert.equal(group.children.indexOf(card), group.children.indexOf(summary) + 1, 'right under the list of where the badges are worn');
    assert.equal(buttons(card).length, 1);
    // What a press did is said in a line that stays when the card is drawn again, so a screen reader announces the change.
    const status = doc.getElementById(BadgeOrder.STATUS_ID);
    assert.equal(status.getAttribute('role'), 'status');
    assert.equal(status.getAttribute('aria-live'), 'polite');
    assert.equal(group.children.indexOf(status), group.children.indexOf(card) + 1, 'beside the card, outside what is redrawn');
    buttons(card)[0].click();
    assert.deepEqual(global.State.badgeOrder, { occupational: [NURSE, GT] }, 'the nurse badge is now the higher');
    assert.equal(renders, 1, 'and the page draws again');
    // A drawing of another uniform than the one on screen shows no card.
    BadgeOrder.update(Object.assign(scene(entry([GT, NURSE])), { uniform: 'ocp' }));
    assert.equal(card.classList.contains('hidden'), true);
    BadgeOrder.update(scene());
    assert.equal(card.classList.contains('hidden'), true, 'a uniform with no stack to swap');
    // After the press the redraw says what moved.
    global.State.uniform = 'blues_a';
    buttons(card).length;
    BadgeOrder.update(scene(entry([GT, NURSE])));
    buttons(card)[0].click();
    BadgeOrder.update(scene(entry([NURSE, GT])));
    assert.equal(doc.getElementById(BadgeOrder.STATUS_ID), status, 'the same line');
    assert.equal(status.textContent, 'Nurse Officer Badge is now worn above Ground Team Badge.');
    // Three badges: a press says where the badge stands now.
    global.State.badgeOrder = {};
    BadgeOrder.update(scene(entry([GT, NURSE, EMT])));
    buttons(card).find(b => b.getAttribute('aria-label') === 'Move up the Nurse Officer Badge').click();
    assert.deepEqual(global.State.badgeOrder, { occupational: [NURSE, GT, EMT] });
    BadgeOrder.update(scene(entry([NURSE, GT, EMT])));
    assert.equal(status.textContent, 'Nurse Officer Badge is now the highest of the 3 badges.');
    assert.equal(doc.activeElement.getAttribute('aria-label'), 'Move down the Nurse Officer Badge', 'the focus moves to what the badge can still do');
  }finally{
    delete global.State; delete global.CAPUBBadgeCatalog; delete global.CAPUBUniformView;
  }
});
