'use strict';
// The owner (2026-11-12): "make the uniform selection, and the grade selection visual. mostly everything should be visual atp" and "same with the ribbon rack extra selection
// things". The choices of the Items step that change what is drawn are chosen by picture (js/item-pickers.js, the picture picker of js/visual-picker.js), the pictures made from the
// engine's own rack and numbers (js/option-pictures.js). The control each replaces stays on the page, hidden, as the source of truth: the page's own code reads it, writes it and
// listens to its change event, so what is saved, shared and undone does not change.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createDocument, keydown } = require('./helpers/mini-dom.cjs');
const { loadPageScripts } = require('./helpers/page-scripts.cjs');

const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const core = require('../js/engine/core.js');
const P = require('../js/engine/profiles.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');
require('../js/engine/profiles-polo.js');
const OP = require('../js/option-pictures.js');

const html = read('index.html');
const manifest = JSON.parse(read('images/MANIFEST.json'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(read('images/' + p))));

// ---- the page --------------------------------------------------------------------------------------------------------------------------

// The controls this file replaces by pictures, each with the host the picker is drawn in. The control stays, as a hidden source.
const SOURCES = [['ribbonRackColumns', 'label'], ['ribbonRackArrangement', 'label']];

test('each control keeps its element, hidden from sight and from the keyboard and screen readers, with a host for its picker beside it; the script loads after the panel\'s', () => {
  for(const [id] of SOURCES){
    assert.equal([...html.matchAll(new RegExp(`id="${id}"`, 'g'))].length, 1, `${id} once`);
    const host = new RegExp(`<div id="${id}Picker"[^>]*\\bhidden\\b[^>]*></div>\\s*<label class="fieldNote segmentedSource" aria-hidden="true">[^<]*<select id="${id}" tabindex="-1">`).exec(html);
    assert.ok(host, `${id}: a host, then the control as a hidden source`);
  }
  const at = name => html.indexOf(`<script src="js/${name}`);
  assert.ok(at('garment-options.js') < at('item-pickers.js') && at('item-pickers.js') < at('wiring.js'), 'after the pictures and the picker, before the page wiring');
  assert.match(html, /<script src="js\/item-pickers\.js\?v=[0-9a-f]+" defer><\/script>/);
  // The fold's name is not repeated: the legend of the first picker is the label the control had.
  const rack = html.slice(html.indexOf('id="rackLayoutMore"'), html.indexOf('</details>', html.indexOf('id="rackLayoutMore"')));
  assert.equal((rack.match(/Ribbon rack layout/g) || []).length, 1);
});

// ---- the pictures: the member's own rack, as the engine lays it ----------------------------------------------------------------------------

const { context } = loadPageScripts();
const run = code => JSON.parse(vm.runInContext(`JSON.stringify((function(){ ${code} })())`, context));
const CHOICES = ['air_force_aerial_achievement_medal', 'silver_medal_of_valor', 'bronze_medal_of_valor', 'distinguished_service_award', 'exceptional_service_award', 'meritorious_service_award',
  'commander_commendation_award', 'cap_achievment_award', 'lifesaving_award', 'unit_citation_award', 'cap_gill_robb_wilson_ribbon', 'cap_paul_e_garber_ribbon'];
// The member in the page's state: what is chosen is what the page hands the engine.
const member = o => run(`
  State.membership = ${JSON.stringify(o.membership || 'senior')}; State.uniform = ${JSON.stringify(o.uniform || 'blues_a')}; State.gender = ${JSON.stringify(o.gender || 'male')}; State.rank = ${JSON.stringify(o.rank || 'Maj')};
  State.badges = []; State.garment = ${JSON.stringify(o.garment || {})}; State.hideRibbons = false; State.cadetHighestOnly = false;
  State.ribbonRackLayout = ${JSON.stringify(o.layout || '3')}; State.ribbonRackArrangement = ${JSON.stringify(o.arrangement || 'lapel')}; State.ribbonRowOverrideEnabled = false; State.ribbonRowOverride = [];
  normalizeRibbonSelections();
  for(const id of Object.keys(State.ribbonSelections)) clearRibbonSelection(id);
  for(const id of ${JSON.stringify(CHOICES.slice(0, o.ribbons == null ? 9 : o.ribbons))}) setRibbonSelectionFromDropdown(id, 'earned', { deferRender: true });
  rebuildRibbonsFromGallery();
  return State.ribbons.length;`);
const env = {
  core, compose: b => P.composeUniform(b, store), spec: id => store.load(id), entry: id => store.entry(id), url: p => 'images/' + p, empty: () => '<svg id="empty"></svg>',
  build: () => run('return CAPUBUniformView.buildFromState();'),
  buildWith: over => run(`const over = ${JSON.stringify(over)}; const saved = Object.keys(over).map(k => [k, State[k]]);
    try{ Object.assign(State, over); return CAPUBUniformView.buildFromState(); } finally { saved.forEach(([k, v]) => { State[k] = v; }); }`)
};
const rects = markup => [...markup.matchAll(/<rect x="([-\d.]+)" y="([-\d.]+)" width="([-\d.]+)" height="([-\d.]+)"[^>]*fill="([^"]+)"/g)].map(m => ({ x: +m[1], y: +m[2], w: +m[3], h: +m[4], fill: m[5] }));
const viewBox = markup => /viewBox="([^"]+)"/.exec(markup)[1];
const near = (a, b) => Math.abs(a - b) < 0.002;
const picturesOf = async (name, values) => OP.create(env).pictures(name, values).ready;

test('rack layout: a blank rectangle for each ribbon the member wears, at the place the engine puts it for that choice, on the welt pocket and the lapel, all choices in one frame', async () => {
  // A woman's Class A coat, nine ribbons, the standard arrangement: the three widths lay three different racks.
  assert.equal(member({ gender: 'female', arrangement: 'standard' }), 9);
  const pics = await picturesOf('rackColumns', ['3', '4-left', '4-center']);
  const sheet = await store.load('garment-blues-class-a-coat-female');
  const welt = core.landmarkBounds(sheet, 'welt_pocket');
  const seen = new Set();
  for(const layout of ['3', '4-left', '4-center']){
    const markup = pics[layout];
    assert.equal(typeof markup, 'string', layout);
    const all = rects(markup);
    const [pocket, ...ribbons] = all;
    assert.equal(ribbons.length, 9, `${layout}: one rectangle for each ribbon`);
    assert.ok(near(pocket.x, welt.x) && near(pocket.y, welt.y) && near(pocket.w, welt.w) && near(pocket.h, welt.h), `${layout}: the welt pocket is the sheet's own landmark`);
    assert.match(markup, /<polygon points=/, `${layout}: the lapel that may cover the ribbons`);
    // The rectangles are where the engine laid the ribbons for that choice, as the whole drawing has them.
    const full = await P.composeUniform(env.buildWith({ ribbonRackLayout: layout }), store);
    const drawn = full.layers.filter(l => l.role === 'ribbon').map(l => core.layerBounds(l));
    assert.equal(drawn.length, 9);
    for(const d of drawn) assert.ok(ribbons.some(r => near(r.x, d.x) && near(r.y, d.y) && near(r.w, d.w) && near(r.h, d.h)), `${layout}: a rectangle at ${JSON.stringify(d)}`);
    assert.ok(ribbons.every(r => near(r.w, 1.375) && near(r.h, 0.375)), `${layout}: the ribbon's size, 1 3/8 by 3/8 in (CAPR 39-1, 11.3)`);
    seen.add(JSON.stringify(ribbons));
  }
  assert.equal(seen.size, 3, 'three different racks');
  // Automatic, the lapel decides where the shortened rows go: two widths can lay the same rack there, and the picture says so.
  member({ gender: 'female' });
  const auto = await picturesOf('rackColumns', ['3', '4-left', '4-center']);
  assert.ok(new Set(['3', '4-left', '4-center'].map(v => JSON.stringify(rects(auto[v])))).size >= 2, 'the automatic arrangement lays at least two different racks');
  assert.equal(new Set(['3', '4-left', '4-center'].map(v => viewBox(pics[v]))).size, 1, 'one frame, so the choices can be compared');
  // Four across is four ribbons a row, three across three: the rows the engine counts.
  const rowsOf = markup => { const m = new Map(); rects(markup).slice(1).forEach(r => m.set(r.y.toFixed(3), (m.get(r.y.toFixed(3)) || 0) + 1)); return [...m.keys()].sort((a, b) => a - b).map(k => m.get(k)); };
  assert.deepEqual(rowsOf(pics['4-left']).slice(1), [4, 4], 'rows of four under the one ribbon of the top row');
  assert.ok(rowsOf(pics['3']).every(n => n <= 3));
});

test('upper-row arrangement: the standard and the automatic arrangement as the engine lays them against the lapel; not offered where they are the same rack', async () => {
  member({ gender: 'female' });
  const pics = await picturesOf('rackArrangement', ['standard', 'lapel']);
  assert.equal(typeof pics.standard, 'string');
  assert.notEqual(rects(pics.standard).slice(1).map(r => r.x + ',' + r.y).join(';'), rects(pics.lapel).slice(1).map(r => r.x + ',' + r.y).join(';'));
  for(const arrangement of ['standard', 'lapel']){
    const full = await P.composeUniform(env.buildWith({ ribbonRackArrangement: arrangement }), store);
    const drawn = full.layers.filter(l => l.role === 'ribbon').map(l => core.layerBounds(l));
    const ribbons = rects(pics[arrangement]).slice(1);
    for(const d of drawn) assert.ok(ribbons.some(r => near(r.x, d.x) && near(r.y, d.y)), `${arrangement}: a rectangle at ${JSON.stringify(d)}`);
  }
  // A man's nine ribbons clear the lapel either way: the two are one rack, and there is nothing to pick between.
  member({ gender: 'male' });
  assert.deepEqual(await picturesOf('rackArrangement', ['standard', 'lapel']), { standard: false, lapel: false });
});

test('the rack\'s choices are not offered with no ribbon worn, and not while the member\'s own rows are in force; the cadet semi-formal coat has them too', async () => {
  member({ ribbons: 0, gender: 'female' });
  assert.deepEqual(await picturesOf('rackColumns', ['3', '4-left', '4-center']), { '3': false, '4-left': false, '4-center': false });
  // Fewer than four ribbons lay the same single row of three whatever the width.
  member({ ribbons: 3 });
  assert.deepEqual(await picturesOf('rackColumns', ['3', '4-left', '4-center']), { '3': false, '4-left': false, '4-center': false });
  // Rows the member set themselves are theirs: the engine lays none of its own.
  member({ gender: 'female' });
  run('State.ribbonRowOverrideEnabled = true; State.ribbonRowOverride = [1, 2, 3, 3]; return 1;');
  assert.deepEqual(await picturesOf('rackColumns', ['3', '4-left', '4-center']), { '3': false, '4-left': false, '4-center': false });
  run('State.ribbonRowOverrideEnabled = false; State.ribbonRowOverride = []; return 1;');
  const semi = member({ membership: 'cadet', uniform: 'semi_formal_usaf', rank: 'C/Capt', gender: 'female', ribbons: 12 });
  assert.ok(semi >= 5, 'the cadet semi-formal coat with a rack of its own');
  const pics = await picturesOf('rackColumns', ['3', '4-left', '4-center']);
  assert.ok(['3', '4-left', '4-center'].every(v => typeof pics[v] === 'string'), 'a picture of each');
});

test('the cache keys follow what the pictures are made from: the cut, the ribbons, the rows and the other choice; not the choice the picture is of', () => {
  member({ gender: 'female' });
  const key = (name, over) => OP.RECIPES[name].key(over ? env.buildWith(over) : env.build());
  assert.deepEqual(key('rackColumns'), key('rackColumns', { ribbonRackLayout: '4-left' }), 'the columns picture shows every width, whichever the member has');
  assert.notDeepEqual(key('rackColumns'), key('rackColumns', { ribbonRackArrangement: 'standard' }), 'it is made with the member\'s arrangement');
  assert.deepEqual(key('rackArrangement'), key('rackArrangement', { ribbonRackArrangement: 'standard' }));
  assert.notDeepEqual(key('rackArrangement'), key('rackArrangement', { ribbonRackLayout: '4-center' }));
  const before = key('rackColumns');
  member({ gender: 'female', ribbons: 10 });
  assert.notDeepEqual(key('rackColumns'), before, 'another rack');
  member({ gender: 'male' });
  assert.notDeepEqual(key('rackColumns'), before, 'another cut');
});

// ---- the page's side: the picker beside the control ------------------------------------------------------------------------------------

// The two controls and their hosts in the small DOM, the picker script and a stand-in for the pictures that records what it was asked.
function page(state, pictures){
  const doc = createDocument();
  const mk = (tag, id) => { const e = doc.createElement(tag); if(id) e.id = id; doc.body.append(e); return e; };
  const sources = {};
  for(const [id, values, now] of [['ribbonRackColumns', ['3', '4-left', '4-center'], '3'], ['ribbonRackArrangement', ['standard', 'lapel'], 'lapel']]){
    const host = mk('div', id + 'Picker'); host.hidden = true;
    const select = mk('select', id);
    values.forEach(v => { const o = doc.createElement('option'); o.setAttribute('value', v); o.value = v; select.append(o); });
    select.value = now;
    select.changes = [];
    select.addEventListener('change', () => select.changes.push(select.value));
    sources[id] = { host, select };
  }
  const asked = [];
  const sandbox = {
    State: Object.assign({ uniform: 'blues_a', gender: 'male', ribbons: [], ribbonRackLayout: '3', ribbonRackArrangement: 'lapel' }, state), document: doc, console,
    Event: function(type, init){ this.type = type; Object.assign(this, init); },
    CAPUBOptionPictures: { pictures(name, values){ asked.push(name); const made = pictures(name, values); return made; } }
  };
  sandbox.window = sandbox; sandbox.self = sandbox;
  vm.runInNewContext(read('js/visual-picker.js'), sandbox);
  vm.runInNewContext(read('js/item-pickers.js'), sandbox);
  const rendered = () => (doc.listeners['capub:rendered'] || []).forEach(f => f());
  return { doc, sandbox, sources, asked, rendered, tiles: id => sources[id].host.querySelectorAll('[role="radio"]') };
}
const settled = now => ({ now, ready: Promise.resolve(now), settled: true });
const SQUARE = '<svg viewBox="0 0 4 3"></svg>';
const all = values => Object.fromEntries(values.map(v => [v, SQUARE]));

test('a picker is drawn from the control\'s own choices, in its order, with the words of each, and a press sets the control and gives the change the page listens to', () => {
  const p = page({}, (name, values) => settled(all(values)));
  const cols = p.tiles('ribbonRackColumns');
  assert.deepEqual(cols.map(t => t.querySelector('.vpLabel').textContent), ['3 across, centered', '4 across, left edge on the pocket', '4 across, centered on the pocket']);
  assert.deepEqual(cols.map(t => t.dataset.value), ['3', '4-left', '4-center']);
  assert.deepEqual(cols.map(t => t.getAttribute('aria-checked')), ['true', 'false', 'false'], 'the control\'s value is the one picked');
  assert.equal(p.sources.ribbonRackColumns.host.hidden, false);
  assert.equal(p.sources.ribbonRackColumns.host.querySelector('.vpLegend').textContent, 'Ribbon rack layout');
  assert.deepEqual(p.tiles('ribbonRackArrangement').map(t => t.querySelector('.vpLabel').textContent), ['Standard, centered top row', 'Automatic, clear of the lapel']);
  cols[1].click();
  assert.equal(p.sources.ribbonRackColumns.select.value, '4-left');
  assert.deepEqual(p.sources.ribbonRackColumns.select.changes, ['4-left'], 'one change, as a press on the list would give');
  // The keyboard works through the picker as it does everywhere: the arrow keys move, Enter picks.
  const again = p.tiles('ribbonRackColumns');
  again[1].focus();
  again[1].dispatchEvent(keydown('ArrowRight'));
  p.doc.activeElement.dispatchEvent(keydown('Enter'));
  assert.equal(p.sources.ribbonRackColumns.select.value, '4-center');
});

test('the picker follows the control when the page sets it (a saved setup, undo): after the next drawing it shows what the control holds', () => {
  const p = page({}, (name, values) => settled(all(values)));
  p.sources.ribbonRackColumns.select.value = '4-center';
  p.rendered();
  assert.deepEqual(p.tiles('ribbonRackColumns').map(t => t.getAttribute('aria-checked')), ['false', 'false', 'true']);
  assert.deepEqual(p.sources.ribbonRackColumns.select.changes, [], 'the page setting it is not a change of the member\'s');
});

test('a choice that does not apply is not offered, and a group with nothing to pick between is hidden, not greyed; it comes back when it applies', () => {
  let apply = false;
  const p = page({}, (name, values) => settled(Object.fromEntries(values.map(v => [v, apply ? SQUARE : false]))));
  assert.equal(p.sources.ribbonRackColumns.host.hidden, true, 'nothing to pick between: hidden');
  assert.equal(p.sources.ribbonRackArrangement.host.hidden, true);
  apply = true;
  p.sandbox.State.ribbons = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
  p.rendered();
  assert.equal(p.sources.ribbonRackColumns.host.hidden, false);
  assert.equal(p.tiles('ribbonRackColumns').length, 3);
  // One of three does not apply: the other two are offered.
  const q = page({}, (name, values) => settled(Object.fromEntries(values.map((v, i) => [v, i === 1 && values.length === 3 ? false : SQUARE]))));
  assert.deepEqual(q.tiles('ribbonRackColumns').map(t => t.dataset.value), ['3', '4-center']);
  // A control the page has disabled (the cut or the uniform has no choice) offers none.
  const r = page({}, (name, values) => settled(all(values)));
  r.sources.ribbonRackColumns.select.disabled = true;
  r.rendered();
  assert.equal(r.sources.ribbonRackColumns.host.hidden, true);
});

test('the pictures are asked for again only when what they are made from has changed; a picture still being made keeps the host out of sight until it is there', async () => {
  let release;
  const slow = new Promise(res => { release = res; });
  let n = 0;
  const p = page({}, (name, values) => { n++; return { now: {}, ready: slow, settled: false }; });
  assert.equal(p.sources.ribbonRackColumns.host.hidden, true, 'nothing to show yet: the host is not drawn as a row of blank boxes');
  release(all(['3', '4-left', '4-center']));
  await slow;
  await Promise.resolve();
  assert.equal(p.sources.ribbonRackColumns.host.hidden, false, 'drawn when the pictures arrive');
  const asked = p.asked.length;
  p.rendered(); p.rendered();
  assert.equal(p.asked.length, asked, 'nothing changed, nothing asked');
  p.sandbox.State.ribbons = [{ id: 'a' }];
  p.rendered();
  assert.ok(p.asked.length > asked, 'the ribbons changed');
  const after = p.asked.length;
  p.sandbox.State.ribbonRackLayout = '4-left';
  p.rendered();
  assert.equal(p.asked.filter(x => x === 'rackColumns').length, p.asked.slice(0, after).filter(x => x === 'rackColumns').length, 'the width is the choice the columns picture is of: not asked again');
  assert.ok(p.asked.length > after, 'but the arrangement picture is made with it');
});
