'use strict';
// The measurement overlay can be trimmed and quiet: each distance has a checkbox in a list beside the preview (kept per uniform in the browser), the
// callouts carry the inch value and the caption only until the member asks for the paragraphs, and the Extra step's Regulation tab lists the same
// distances with their CAPR 39-1 paragraphs (and the ICL where the engine cites one). The pure parts are tested here: measure-layout.js's catalogue
// and filterScene, js/measure-panel.js's preferences and markup, and the page's markup and styles.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const core = require('../js/engine/core.js');
const P = require('../js/engine/profiles.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');
require('../js/engine/profiles-polo.js');
const ML = require('../js/engine/measure-layout.js');
const MP = require('../js/measure-panel.js');
const R = require('../scripts/render-builds.cjs');

const manifest = JSON.parse(read('images/MANIFEST.json'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));
const MATRIX = R.matrix().builds;
const compose = name => { const b = MATRIX.find(x => x.name === name); assert.ok(b, name); return P.composeUniform(R.makeBuild(JSON.parse(JSON.stringify(b.build))), store); };

// The overlay's own layout of a scene, as the page lays it out (render-svg.js: the scene as filterScene leaves it).
function laidOut(scene, choice){
  const shown = ML.filterScene(scene, choice || {});
  const B = scene.bounds, vb = [B.x - 0.4, B.y - 0.4, B.w + 0.8, B.h + 0.8], px = ML.previewPx(vb);
  return ML.layout(shown, { px, area: { x: vb[0], y: vb[1], w: vb[2], h: vb[3] }, calloutArea: ML.calloutRoom(vb, px) });
}
// The words on a drawn callout (the pill's caption lines, or the magnified callout's).
const wordsOf = d => ((d.callout ? (d.callout.caption && d.callout.caption.lines) : (d.label && d.label.caption)) || []).join(' ').replace(/\s+/g, ' ');

// The builds of the standard matrix that draw the most kinds of distance: a Class A with a full rack, an ABU, an OCP, a flight suit, a mess dress.
const BUILDS = ['blues_a-male-senior-Capt', 'blues_a-female-senior-SMSgt', 'blues_b-male-cadet-C-SSgt', 'abu-male-senior-Capt', 'ocp-male-senior-Capt', 'flight_suit-male-senior-Capt',
  'mess_dress-male-senior-Col', 'aviator-female-senior-Capt', 'semi_formal-female-senior-Col', 'polo-male-senior-Capt', 'corporate_field-female-senior-Capt'];

test('the callouts carry the paragraph only when the switch is on', async () => {
  for(const name of ['blues_a-male-senior-Capt', 'abu-male-senior-Capt', 'ocp-male-senior-Capt']){
    const scene = await compose(name);
    const off = laidOut(scene, { refs: false }), on = laidOut(scene, { refs: true });
    assert.ok(off.length > 2, name + ' draws callouts');
    for(const d of off) assert.doesNotMatch(wordsOf(d), /CAPR|\d\.\d+\.\d/, `${name}: no paragraph on ${d.key} with the switch off`);
    for(const d of on) assert.match(wordsOf(d), /CAPR 39-1, \d/, `${name}: the paragraph on ${d.key} with the switch on (${wordsOf(d)})`);
    // The value and the caption are on the pill either way.
    for(const d of off) assert.ok(d.callout || (d.label && d.label.text && d.label.caption.length), `${name}: ${d.key} keeps its value and caption`);
  }
});

test('hiding a measurement removes its callout and keeps the others, laid out again', async () => {
  const scene = await compose('blues_a-male-senior-Capt');
  const cat = ML.catalogue(scene);
  assert.ok(cat.entries.length >= 6);
  const all = laidOut(scene).map(d => d.key).sort();
  assert.deepEqual(all, cat.entries.flatMap(e => e.keys).sort(), 'the catalogue names every callout the overlay draws');
  for(const e of cat.entries){
    const left = laidOut(scene, { hidden: [e.id] }).map(d => d.key).sort();
    assert.deepEqual(left, all.filter(k => !e.keys.includes(k)), `hiding ${e.name} ${e.value} removes only its own callout(s)`);
  }
  // Two hidden at once; the rest are laid out over the room: the pills still keep clear of each other.
  const two = cat.entries.slice(1, 3).map(e => e.id);
  const kept = laidOut(scene, { hidden: two });
  assert.equal(kept.length, all.length - cat.entries.slice(1, 3).reduce((n, e) => n + e.keys.length, 0));
  const boxes = kept.filter(d => d.label && d.label.w).map(d => d.label);
  const meet = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  assert.ok(boxes.length >= 3);
  for(let i = 0; i < boxes.length; i++) for(let j = i + 1; j < boxes.length; j++) assert.ok(!meet(boxes[i], boxes[j]), 'two pills overlap');
  assert.equal(ML.filterScene(scene, {}).layers.filter(l => l.type === 'measure').every(l => !l.ref), true, 'no switch: no paragraph on any measure');
  assert.equal(ML.filterScene(scene, { refs: true }), scene, 'nothing hidden and the switch on: the scene as it is');
});

test('a hidden measurement is told by its caption and value, not by the build: the same choice holds on another build that draws it', async () => {
  const a = ML.catalogue(await compose('blues_a-male-senior-Capt')), b = ML.catalogue(await compose('blues_a-female-senior-SMSgt'));
  const shared = a.entries.filter(e => b.entries.some(x => x.id === e.id));
  assert.ok(shared.length >= 1, 'the cap front to the grade, the nameplate...: some distances are on both');
  for(const e of a.entries){ assert.doesNotMatch(e.id, /measure:\d/); assert.ok(e.name && e.value && e.area); }
});

test('every distance falls in an area; the areas keep their order', async () => {
  const seen = new Set();
  for(const name of BUILDS){
    const cat = ML.catalogue(await compose(name));
    const order = cat.groups.map(g => ML.AREAS.indexOf(g.area));
    assert.deepEqual(order, [...order].sort((x, y) => x - y), `${name}: areas in order`);
    for(const e of cat.entries){ seen.add(e.area); assert.notEqual(e.area, 'Other', `${name}: ${e.name} has an area`); }
  }
  for(const a of ['Collar', 'Shoulders', 'Chest', 'Pockets', 'Sleeves', 'Badges', 'Headgear']) assert.ok(seen.has(a), a + ' appears');
});

test('the panel lists every distance with a checkbox, grouped, with the switch and All and None; no ids show', async () => {
  const scene = await compose('abu-male-senior-Capt');
  const cat = ML.catalogue(scene);
  const hidden = [cat.entries[0].id];
  const html = MP.panelHtml(cat, hidden, false);
  assert.equal((html.match(/<input type="checkbox" data-id=/g) || []).length, cat.entries.length);
  assert.equal((html.match(/ checked>/g) || []).length, cat.entries.length - 1, 'the hidden one is unchecked');
  assert.match(html, new RegExp(`${cat.entries.length - 1} of ${cat.entries.length}`));
  assert.match(html, /Show regulation references/);
  assert.doesNotMatch(html, /data-mp="refs" checked/);
  assert.match(MP.panelHtml(cat, [], true), /data-mp="refs" checked/);
  assert.match(html, /data-mp="all">All<\/button><button type="button" class="ghost" data-mp="none">None</);
  for(const g of cat.groups) assert.ok(html.includes(`<legend>${g.area}</legend>`));
  // What a member reads: the text between the tags, never an id.
  const text = html.replace(/<[^>]*>/g, ' ');
  assert.doesNotMatch(text, /measure:|\|/);
  for(const e of cat.entries) assert.ok(text.includes(e.name) && text.includes(e.value));
  assert.match(MP.panelHtml({ entries: [], groups: [] }, [], false), /draws no measurements/);
});

test('the choice is kept per uniform and survives a reload; the switch is off until it is turned on', () => {
  const mem = new Map();
  const storage = { getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)) };
  let prefs = MP.createPrefs(storage);
  assert.equal(prefs.refs(), false, 'references off by default');
  assert.deepEqual(prefs.hidden('blues_a'), []);
  prefs.setHidden('blues_a', ['a|1 in', 'b|½ in', 'a|1 in']);
  prefs.setHidden('abu', ['c|halfway']);
  prefs.setRefs(true);
  prefs = MP.createPrefs(storage);   // a reload
  assert.deepEqual(prefs.hidden('blues_a'), ['a|1 in', 'b|½ in']);
  assert.deepEqual(prefs.hidden('abu'), ['c|halfway']);
  assert.deepEqual(prefs.hidden('ocp'), []);
  assert.equal(prefs.refs(), true);
  assert.deepEqual(MP.renderOptionsFor(prefs, 'abu'), { measureHide: ['c|halfway'], measureRefs: true });
  prefs.setHidden('abu', []);
  assert.equal(JSON.parse(mem.get(MP.KEY_HIDDEN)).abu, undefined, 'All clears the uniform\'s entry');
  // Storage that throws, or holds rubbish, leaves the defaults.
  const broken = MP.createPrefs({ getItem(){ throw new Error('blocked'); }, setItem(){ throw new Error('blocked'); } });
  assert.deepEqual(broken.hidden('abu'), []); assert.equal(broken.refs(), false);
  broken.setHidden('abu', ['x']); broken.setRefs(true);
  assert.deepEqual(MP.createPrefs({ getItem: () => '{not json', setItem(){} }).hidden('abu'), []);
});

test('the preview draws with the member\'s choices, and the PNG is that drawing', () => {
  const view = read('js/uniform-view.js'), svg = read('js/engine/render-svg.js'), ui = read('js/workspace-ui.js');
  assert.match(view, /CAPUBMeasure \? window\.CAPUBMeasure\.renderOptions\(State\.uniform\) : null/);
  assert.match(svg, /ML\.filterScene\(scene, \{ hidden: options\.measureHide, refs: !!options\.measureRefs \}\)/);
  assert.match(view, /exportCanvas[\s\S]*svgToCanvas\(lastSvg/, 'the PNG is the preview\'s own drawing');
  assert.match(ui, /CAPUBMeasure&&CAPUBMeasure\.sync\(\)/);
});

test('Measurements is one control: the button and an attached caret that opens the panel; no separate Show or hide button', () => {
  const ui = read('js/workspace-ui.js'), panel = read('js/measure-panel.js'), css = read('styles/app.css');
  // One group in the toolbar holds both buttons.
  const groups = ui.match(/setAttribute\('aria-label','Measurements'\)/g) || [];
  assert.equal(groups.length, 1, 'exactly one Measurements control group is built');
  assert.match(ui, /measure\.classList\.add\('measureGroup'\)/);
  assert.match(ui, /id="measureBtn" aria-pressed="false"[^>]*>Measurements<\/button>'\s*\+'<button type="button" class="ghost measureCaret" id="measureListBtn" aria-label="Measurement options"/);
  assert.match(ui, /id="measureListBtn"[^>]*aria-haspopup="dialog" aria-expanded="false" aria-controls="measurePanel"/);
  assert.doesNotMatch(ui + panel, /Show or hide'|>Show or hide</, 'there is no button called Show or hide');
  assert.doesNotMatch(panel, /createElement\('button'\)[\s\S]{0,200}measureListBtn/, 'the panel script does not add a second button');
  assert.match(css, /\.measureGroup \.measureCaret\{[^}]*margin-left:-1px;/, 'attached to the button');
  // The panel opens by itself once a session, the first time Measurements is turned on; the Esc key and a click outside close it.
  assert.match(ui, /if\(State\.showMeasurements && window\.CAPUBMeasure\) CAPUBMeasure\.firstTimeOn\(\)/);
  assert.match(panel, /function firstTimeOn\(\)\{[\s\S]*sessionStorage[\s\S]*setOpen\(true\)/);
  assert.equal(typeof MP.firstTimeOn, 'function');
  assert.equal(MP.KEY_INTRO, 'capubMeasureIntro');
});

test('the page: the panel button, a sheet on the phone, the script, the Extra step\'s two tabs', () => {
  const html = read('index.html'), css = read('styles/app.css');
  assert.match(html, /<script src="js\/measure-panel\.js[^"]*" defer><\/script>/);
  assert.ok(html.indexOf('<script src="js/engine/measure-layout.js') < html.indexOf('<script src="js/measure-panel.js') && html.indexOf('<script src="js/uniform-view.js') < html.indexOf('<script src="js/measure-panel.js'));
  // The panel is a popover under the toolbar above 700px and a sheet over the bottom of the screen to 700px.
  assert.match(css, /\.previewToolbar \.measurePanel\{\s*position:absolute;\s*top:100%;/);
  const start = css.indexOf('@media (max-width:700px)'); assert.ok(start > 0);
  let depth = 0, i = css.indexOf('{', start); const begin = i;
  for(; i < css.length; i++){ if(css[i] === '{') depth++; if(css[i] === '}'){ depth--; if(depth === 0) break; } }
  const phone = css.slice(begin, i + 1);
  assert.match(phone, /\.previewToolbar \.measurePanel\{position:fixed;left:0;right:0;bottom:0;top:auto;/);
  assert.match(phone, /\.previewToolbar \.measurePanel\{[^}]*max-height:56dvh;/);
  assert.match(phone, /\.mpRow\{min-height:44px\}/);
});
