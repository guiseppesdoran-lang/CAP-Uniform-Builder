'use strict';
// The cord choice by picture (js/patches.js, drawn with js/visual-picker.js; owner, 2026-11-10: "this logic (visual rather than words) should be broadly applied", and 2026-11-11 for the
// supplements' cords): the cords of the regulation first, then one group for each supplement the member's unit brings in, earned ones first and marked, each shown as a short piece of the cord
// drawn by CordBraid; the selected cord's rule as its note; for a cord whose colour the unit commander picks a second choice, of the colour by swatch; hidden for anyone who cannot wear a cord on
// this uniform; drawn again when the supplements change. The page's picker is replaced here by one that records what it is given.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadPageScripts } = require('./helpers/page-scripts.cjs');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const { context } = loadPageScripts();
const ev = code => vm.runInContext(code, context);
const evj = code => JSON.parse(vm.runInContext(`JSON.stringify(${code})`, context));   // arrays and objects of the page's realm, as plain ones

// A stand-in for the page: the hosts the control finds by id, a picker that keeps its options and value, and a count of the drawings asked for.
ev(`
  globalThis.__hosts = {}; globalThis.__pickers = {}; globalThis.__renders = 0; globalThis.__listeners = {};
  const stub = id => (__hosts[id] = __hosts[id] || { id, hidden: false, textContent: '', classList: { toggled: null, toggle(c, on){ this.toggled = [c, on]; } } });
  document = { getElementById: id => ['shoulderCordPicker', 'shoulderCordColour', 'shoulderCordNote', 'shoulderCordPanel'].includes(id) ? stub(id) : null, addEventListener: (type, fn) => { (__listeners[type] = __listeners[type] || []).push(fn); } };
  VisualPicker = {
    emptyMark: () => '<svg id="empty"/>',
    render(host, cfg){ const p = { cfg, options: cfg.options, value: cfg.value, setOptions(o){ p.options = o; }, setValue(v){ p.value = v; } }; __pickers[cfg.name] = p; return p; }
  };
  fullRender = () => { __renders++; };
  shoulderCordPicker = null; shoulderCordColourPicker = null; shoulderCordKey = '';
  wireShoulderCordControl.wired = false; wireShoulderCordControl();   // the control listens on this document
`);
const setup = state => ev(`(function(){ shoulderCordPicker = null; shoulderCordColourPicker = null; shoulderCordKey = ''; State.membership = 'cadet'; State.gender = 'male'; State.rank = 'C/Capt'; State.uniform = 'blues_a'; State.shoulderCord = null; State.shoulderCordColour = null; State.unitPatchCharter = ''; delete window.Supplements; ${state || ''}; })()`);
const options = () => JSON.parse(ev('JSON.stringify(capubShoulderCordOptions())'));
const OFFER = `window.Supplements = { cords: state => [
  { id: 'ner-rcls', supplement: 'ner', group: 'Northeast Region', label: 'Region Cadet Leadership School', note: 'Blue and white cord (CAPR 39-1 Northeast Region Supplement 1, 9.4.1).', earned: false },
  { id: 'ner-ncols', supplement: 'ner', group: 'Northeast Region', label: 'Noncommissioned Officer Leadership School', note: 'Red and white cord.', earned: true },
  { id: 'de-unit-award', supplement: 'de', group: 'Delaware Wing', label: 'Cadet of the Month or Quarter', note: 'The squadron commander chooses the colour.', earned: false }
] };`;

test('the page has the picker\'s hosts where the select was, and the picker script is loaded before the control', () => {
  assert.doesNotMatch(html, /shoulderCordSelect/, 'no select');
  for(const id of ['shoulderCordPanel', 'shoulderCordPicker', 'shoulderCordColour', 'shoulderCordNote']) assert.match(html, new RegExp(`id="${id}"`), id);
  assert.ok(html.indexOf('js/visual-picker.js') < html.indexOf('js/patches.js'), 'the picker loads first');
  assert.ok(html.indexOf('js/engine/cords.js') < html.indexOf('js/patches.js'));
});

test('a cadet on Class A is offered no cord and the seven of the regulation first, each with a picture and the rule as its note', () => {
  setup();
  const o = options();
  assert.deepEqual(o.map(x => x.value), ['', 'group', 'wing', 'region', 'national', 'color_guard', 'honor_guard', 'aide_de_camp']);
  assert.ok(o.every(x => x.group === 'Regulation cords'), 'one group');
  assert.equal(o[0].label, 'No cord');
  assert.match(o[0].picture, /id="empty"/, 'the plain empty mark for no cord');
  for(const x of o.slice(1)){
    assert.match(x.picture, /^<svg [^>]*viewBox="0 0 [\d.]+ [\d.]+"/, `${x.value}: a picture`);
    assert.ok(x.picture.length > 1500, `${x.value}: the braid itself`);
    assert.ok(x.note && /\(CAPR 39-1, 9\.3[\d.]*\)/.test(x.note), `${x.value}: the rule with its paragraph: ${x.note}`);
    assert.doesNotMatch(x.label, /CAC|shoulder cord/i, `${x.value}: a tile label, not the long name`);
  }
  assert.match(o.find(x => x.value === 'wing').picture, new RegExp(ev('CAP_CORDS.palette.red.main')), 'the wing cord is drawn red');
});

test('the supplements in force come after the regulation cords, one group each in the order given, earned cords marked, every picture the cord\'s own braid', () => {
  setup(OFFER);
  const o = options();
  assert.deepEqual(o.slice(8).map(x => [x.group, x.value, x.mark]), [
    ['Northeast Region', 'ner-rcls', ''], ['Northeast Region', 'ner-ncols', 'In your report'], ['Delaware Wing', 'de-unit-award', '']
  ]);
  const rcls = o.find(x => x.value === 'ner-rcls'), colours = evj('CAP_CORDS.palette');
  assert.ok(rcls.picture.includes(colours.blue.main) && rcls.picture.includes(colours.white.main), 'the Region Cadet Leadership School cord is blue and white');
  assert.equal(rcls.label, 'Region Cadet Leadership School');
  assert.match(rcls.note, /9\.4\.1\)\.?$/, 'the rule ends with its paragraph');
  const ner = o.find(x => x.value === 'ner-ncols');
  assert.ok(ner.picture.includes(colours.red.main) && ner.picture.includes(colours.white.main));
  assert.equal(o.filter(x => x.value === 'de-unit-award').length, 1);
  // none when no unit brings a supplement in
  setup();
  assert.deepEqual(options().map(x => x.group), Array(8).fill('Regulation cords'));
});

test('a cord that carries a strand is drawn whole in a taller picture, and one that hangs an aiguillette beside its braid', () => {
  setup(`window.Supplements = { cords: () => [{ id: 'ga-cadet-of-the-year', supplement: 'ga', group: 'Georgia Wing', label: 'Cadet of the Year', note: 'x', earned: false }, { id: 'fl-leadership-academy-instructor', supplement: 'fl', group: 'Florida Wing', label: 'Instructor', note: 'x', earned: false }] }`);
  const o = Object.fromEntries(options().map(x => [x.value, x.picture]));
  assert.match(o['ga-cadet-of-the-year'], /viewBox="0 0 5\.2 3\.9"/);
  assert.match(o.wing, /viewBox="0 0 3\.6 2\.7"/);
  assert.ok(o['ga-cadet-of-the-year'].includes('strand1'), 'two strands');
  assert.ok(o['fl-leadership-academy-instructor'].includes('pendant-braid'), 'the aiguillette\'s pendant beside the braid');
  assert.ok(o.aide_de_camp.includes('pendant-braid'));
  assert.ok(!o.wing.includes('pendant-braid'));
});

test('the control is hidden for anyone who cannot wear a cord on this uniform, and a senior member is offered only the Aide de Camp cord', () => {
  for(const state of ["State.uniform = 'ocp'", "State.uniform = 'flight_suit'", "State.uniform = 'polo'", "State.uniform = 'semi_formal'"]){
    setup(state);
    assert.deepEqual(options(), [], state);
    ev('syncShoulderCordControl()');
    assert.deepEqual(evj('__hosts.shoulderCordPanel.classList.toggled'), ['hidden', true], `${state}: the panel is hidden`);
  }
  setup(`State.membership = 'senior'; State.rank = 'Capt'; ${OFFER}`);
  assert.deepEqual(options().map(x => x.value), ['', 'aide_de_camp'], 'a senior member: no supplement cord, only the aide cord');
  ev('syncShoulderCordControl()');
  assert.match(ev('__hosts.shoulderCordNote.textContent'), /Senior members wear only the Aide de Camp cord/);
  setup();
  ev('syncShoulderCordControl()');
  assert.deepEqual(evj('__hosts.shoulderCordPanel.classList.toggled'), ['hidden', false]);
  assert.equal(ev('__hosts.shoulderCordNote.textContent'), '');
});

test('the picker shows the cord the member chose when it is on offer, and none when it is not', () => {
  setup(`State.shoulderCord = 'wing'`);
  ev('syncShoulderCordControl()');
  assert.equal(ev('__pickers.shoulderCord.value'), 'wing');
  assert.equal(ev('__pickers.shoulderCord.cfg.size'), 'large');
  assert.equal(ev('__pickers.shoulderCord.cfg.legend'), 'Shoulder cord');
  setup(`State.shoulderCord = 'ner-rcls'`);
  ev('syncShoulderCordControl()');
  assert.equal(ev('__pickers.shoulderCord.value'), '', 'a supplement cord the unit does not offer is not shown as chosen');
  setup(`State.shoulderCord = 'ner-rcls'; ${OFFER}`);
  ev('syncShoulderCordControl()');
  assert.equal(ev('__pickers.shoulderCord.value'), 'ner-rcls');
  assert.equal(ev('__pickers.shoulderCord.options.length'), 11);
});

test('picking a cord sets the state and draws; a cord whose colour the unit commander picks brings the colour choice, from colours that are not a regulation cord\'s', () => {
  setup(OFFER);
  ev('syncShoulderCordControl()');
  const pick = v => ev(`__pickers.shoulderCord.cfg.onChange(${JSON.stringify(v)})`);
  const renders = () => ev('__renders');
  const before = renders();
  pick('wing');
  assert.deepEqual(evj('[State.shoulderCord, State.shoulderCordColour]'), ['wing', null]);
  assert.equal(renders(), before + 1, 'the drawing follows');
  assert.equal(ev('__hosts.shoulderCordColour.hidden'), true, 'no colour choice for a cord with its own colours');
  pick('de-unit-award');
  assert.equal(ev('State.shoulderCord'), 'de-unit-award');
  assert.equal(ev('State.shoulderCordColour'), ev('CAP_CORDS.chosen_colours[0]'), 'a colour is chosen at once so the cord can be drawn, the first of the list\'s own');
  assert.equal(ev('__hosts.shoulderCordColour.hidden'), false, 'the colour choice is shown');
  const swatches = evj('__pickers.shoulderCordColour.options');
  const chosen = evj('CAP_CORDS.chosen_colours'), regulation = evj('CAP_CORDS.regulation.flatMap(c => c.colours)');
  assert.deepEqual(swatches.map(x => x.value), chosen);
  for(const s of swatches){
    assert.ok(!regulation.includes(s.value), `${s.value} is not a colour of a regulation cord`);
    assert.match(s.picture, /<svg [^>]*>.*fill="#[0-9a-f]{6}"/, `${s.value}: a swatch`);
    assert.equal(s.label, s.value.charAt(0).toUpperCase() + s.value.slice(1));
  }
  assert.equal(ev('__pickers.shoulderCordColour.cfg.legend'), 'Cord colour');
  const r2 = renders();
  ev(`__pickers.shoulderCordColour.cfg.onChange('purple')`);
  assert.equal(ev('State.shoulderCordColour'), 'purple');
  assert.equal(renders(), r2 + 1);
  assert.ok(options().find(x => x.value === 'de-unit-award').picture.includes(ev('CAP_CORDS.palette.purple.main')), 'the cord\'s own tile takes the member\'s colour');
  ev(`__pickers.shoulderCordColour.cfg.onChange('green')`);
  assert.equal(ev('State.shoulderCordColour'), null, 'a regulation cord\'s colour is not a choice');
  pick('');
  assert.deepEqual(evj('[State.shoulderCord, State.shoulderCordColour]'), [null, null]);
  assert.equal(ev('__hosts.shoulderCordColour.hidden'), true);
});

test('the picker is drawn again when the supplements change, and the drawing follows a chosen cord', () => {
  setup(OFFER);
  ev('syncShoulderCordControl()');
  assert.ok(ev('(__listeners["capub:supplements-changed"] || []).length') >= 1, 'listening for the supplements to change');
  ev(`State.shoulderCord = null; window.Supplements = { cords: () => [] }`);
  const r = ev('__renders');
  ev('__listeners["capub:supplements-changed"].forEach(fn => fn())');
  assert.equal(ev('__pickers.shoulderCord.options.length'), 8, 'the supplements\' cords are gone');
  assert.equal(ev('__renders'), r, 'no cord chosen: nothing to draw again');
  ev(`State.shoulderCord = 'wing'`);
  ev('__listeners["capub:supplements-changed"].forEach(fn => fn())');
  assert.equal(ev('__renders'), r + 1, 'a cord is worn: the drawing is asked for again');
});

test('the council cord import keeps working: a current council duty sets the cord, the colour starts empty, and the control follows', () => {
  setup();
  ev(`State.shoulderCordColour = 'orange'`);
  const parsed = JSON.parse(ev(`JSON.stringify((() => { const p = parseCapMemberReport('x'); return { has: 'shoulderCord' in p }; })())`));
  assert.equal(parsed.has, true, 'the parser still reports the council cord');
  const src = fs.readFileSync(path.join(ROOT, 'js', 'patches.js'), 'utf8');
  assert.match(src, /State\.shoulderCord = parsed\?\.shoulderCord \|\| null;\s*State\.shoulderCordColour = null;/, 'a new import clears the old colour with the old cord');
  assert.match(src, /CAC_CORD_LABEL_BY_LEVEL\[currentCord\]\} imported from Current Duty Positions/, 'the import\'s note is as it was');
});

test('what the member reads in the control is the rule only: no publication named in a sentence, every paragraph in brackets', () => {
  setup(OFFER);
  const texts = options().flatMap(x => [x.label, x.note, x.mark, x.group]).filter(Boolean);
  for(const t of texts){
    assert.doesNotMatch(t.replace(/\([^)]*\)/g, ''), /CAPR|Ethan|Doran|ruling|critique|LIVE\d/, `outside its brackets: ${t}`);
  }
});
