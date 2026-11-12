'use strict';
// The cord list (data/cords.js) as the page and the engine name it (js/engine/cords.js), and who may wear which cord (data/uniform-rules.js allowsCord). The state keeps the
// seven cords of the regulation under the keys a saved build or a shared link made before the supplement cords holds (group, color_guard, ...); a supplement cord is its own
// id; a cord whose colour the unit commander picks takes the member's colour from the list's own colours.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cords = require('../js/engine/cords.js');
const list = require('../data/cords.js');
const rules = require('../data/uniform-rules.js');

const STATE_KEYS = ['group', 'wing', 'region', 'national', 'color_guard', 'honor_guard', 'aide_de_camp'];

test('the seven cords of the regulation keep their state keys, and the list names them with hyphens', () => {
  assert.deepEqual(cords.REGULATION, STATE_KEYS);
  assert.deepEqual(list.regulation.map(c => c.id), STATE_KEYS.map(k => k.replace(/_/g, '-')));
  for(const k of STATE_KEYS){
    assert.equal(cords.listId(k), k.replace(/_/g, '-'));
    assert.equal(cords.entry(k).id, k.replace(/_/g, '-'), `${k} finds its entry`);
    assert.ok(cords.isKnown(k) && cords.isRegulation(k), k);
    assert.equal(cords.carrierOf(k), k.replace(/_/g, '-'), `${k} is its own carrier`);
  }
  assert.equal(cords.listId('cord-color-guard'), 'color-guard', 'a script may name a cord by its sheet\'s id');
  assert.equal(cords.entry('cord-group').id, 'group');
});

test('every supplement cord of the list is a known state value, rides the honor guard cord\'s sheet, and nothing else is known', () => {
  assert.equal(cords.supplementIds().length, 58);
  for(const c of list.supplement){
    assert.ok(cords.isKnown(c.id) && cords.isSupplement(c.id) && !cords.isRegulation(c.id), c.id);
    assert.equal(cords.entry(c.id), c);
    assert.equal(cords.carrierOf(c.id), 'honor-guard', `${c.id} has no sheet of its own`);
  }
  for(const junk of [null, undefined, '', 'banana', 'color-guard', 'honor-guard', 'cord-group', 'ner-rcls ', 'GROUP', 5, {}, [], 'constructor', '__proto__']){
    assert.equal(cords.isKnown(junk), false, `${JSON.stringify(junk)} is not a cord`);
  }
});

test('a cord whose colour the unit commander picks takes a colour of the list\'s own, never the colour of a regulation cord', () => {
  const picked = list.supplement.filter(c => c.style === 'chosen').map(c => c.id);
  assert.deepEqual(picked, ['de-unit-award', 'nc-unit-award']);
  for(const id of cords.supplementIds()) assert.equal(cords.needsColour(id), picked.includes(id), id);
  for(const k of STATE_KEYS) assert.equal(cords.needsColour(k), false, k);
  const colours = cords.chosenColours();
  assert.ok(colours.length >= 6, 'a real choice');
  const regHex = new Set(list.regulation.flatMap(c => c.colours).map(n => list.palette[n].main));
  for(const c of colours){
    assert.match(c.main, /^#[0-9a-f]{6}$/i);
    assert.ok(!regHex.has(c.main), `${c.name} is not a colour of a regulation cord`);
    assert.ok(cords.isChosenColour(c.name), c.name);
  }
  for(const bad of ['green', 'red', 'blue', 'gold', 'white', 'silver', 'teal', '', null, undefined, 'constructor']) assert.equal(cords.isChosenColour(bad), false, String(bad));
});

test('allowsCord accepts every cord of the list: cadets on Class A and Class B, nobody else; the Aide de Camp cord is also worn by senior members', () => {
  const ids = STATE_KEYS.concat(cords.supplementIds());
  assert.equal(ids.length, 65);
  for(const uniform of Object.keys(rules.RULES)){
    const dress = uniform === 'blues_a' || uniform === 'blues_b';
    for(const membership of ['cadet', 'senior']){
      for(const id of ids){
        const want = id === 'aide_de_camp' ? dress : dress && membership === 'cadet';
        assert.equal(rules.allowsCord(uniform, membership, id), want, `${uniform} ${membership} ${id}`);
      }
    }
  }
});

test('resolve gives the list\'s entry with colour names turned into hex pairs, and null for a cord it cannot draw', { skip: !fs.existsSync(path.join(__dirname, '..', 'js', 'engine', 'cord-braid.js')) && 'the drawing function is not in the tree yet' }, () => {
  const rcls = cords.resolve('ner-rcls');
  assert.equal(rcls.style, 'interwoven');
  assert.deepEqual(rcls.colours.map(c => c.main), [list.palette.blue.main, list.palette.white.main]);
  assert.equal(cords.resolve('banana'), null);
  assert.equal(cords.resolve('de-unit-award'), null, 'a chosen cord with no colour');
  assert.equal(cords.resolve('de-unit-award', 'green'), null, 'a regulation colour is not a choice');
  assert.deepEqual(cords.resolve('de-unit-award', 'orange').colours.map(c => c.main), [list.palette.orange.main]);
  assert.equal(cords.resolve('color_guard').colours[0].main, list.palette.white.main);
});

// The cords as the vendor makes them (the art tree's check against Vanguard's listings, committed there as 2f580562).
test('the group cord\'s green is the vendor\'s kelly green (#1f8951, outline #0d4a29), and the other green cords take it', () => {
  assert.deepEqual(list.palette.green, { main: '#1f8951', dark: '#0d4a29' });
  assert.deepEqual(list.regulation.find(c => c.id === 'group').colours, ['green']);
  for(const id of ['mar-competition-team', 'mn-drill-down-cadet-of-the-month']){
    assert.ok([].concat(list.supplement.find(c => c.id === id).colours || [], list.supplement.find(c => c.id === id).centre || []).includes('green'), `${id} is a green cord`);
  }
});

test('a single strand has its wrapped knot where the list says: the honor society cords\' strands that are knotted, the others plain; the two knotted strands of Georgia\'s cord are the cord\'s own', () => {
  const knotted = list.supplement.filter(c => c.strand && c.strand.knot).map(c => c.id);
  assert.deepEqual(knotted, ['me-honor-society-distinction', 'wv-honor-society-twice']);
  assert.ok(list.supplement.filter(c => c.strand && !c.strand.knot).length >= 3, 'the other single strands are plain');
  assert.equal(list.supplement.find(c => c.id === 'ga-cadet-of-the-year').knot, true, 'two knotted strands: a knot of the cord, not of a strand');
});

test('resolve gives the knot of a single strand on to the drawing, and an interwoven cord is drawn first colour on both outside edges and second down the inside, whole length', { skip: !fs.existsSync(path.join(__dirname, '..', 'js', 'engine', 'cord-braid.js')) && 'the drawing function is not in the tree yet' }, () => {
  const braid = require('../js/engine/cord-braid.js');
  assert.equal(cords.resolve('me-honor-society-distinction').strand.knot, true);
  assert.equal(cords.resolve('wv-honor-society-after-mitchell').strand.knot, false);
  const along = [[0, 0], [0.4, 3], [1.1, 6]];
  const draw = (cord, o) => braid.draw(along, cord, Object.assign({ unit: 1, width: 0.5, idPrefix: 't-', cap: true }, o));
  const knotted = draw(cords.resolve('me-honor-society-distinction')), plain = draw(cords.resolve('wv-honor-society-after-mitchell'));
  assert.ok(/<rect /.test(knotted.extras) && !/<rect /.test(plain.extras), 'the single strand is wrapped with a knot where the list says');
  for(const id of cords.supplementIds().filter(i => cords.entry(i).style === 'interwoven')){
    const e = cords.resolve(id), twin = Object.assign({}, e, { style: 'edge-centre', edge: e.colours[0], centre: e.colours[1] });
    assert.equal(draw(e).run, draw(twin).run, `${id}: colours[0] on both edges, colours[1] in the strip, the whole length: the drawing of the same cord as edge and centre`);
  }
});
