'use strict';
// The Measurements panel as the page runs it (js/measure-panel.js with js/profile-pickers.js and the picture picker): each distance is an on/off switch (a button, never a checkbox or
// a link), a tap on a row's text opens its paragraph or, where it has none, turns it on or off; the choice of whether the callouts quote their paragraph is a pair of pictures of
// the engine's own callout; and the Regulation tab's choice of where the references are shown is a pair of pictures over the box that stays its source. The small DOM keeps
// markup set with innerHTML as a string, so the rows and the host of the pictures are built here as the page's markup builds them (tests/measure-panel.test.cjs checks that markup).

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createDocument, Node } = require('./helpers/mini-dom.cjs');

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
const compose = name => P.composeUniform(R.makeBuild(JSON.parse(JSON.stringify(MATRIX.find(x => x.name === name).build))), store);

if(!Node.prototype.insertBefore) Node.prototype.insertBefore = function(node, ref){
  if(node.parentNode) node.parentNode.removeChild(node);
  node.parentNode = this;
  const at = ref ? this.childNodes.indexOf(ref) : -1;
  if(at < 0) this.childNodes.push(node); else this.childNodes.splice(at, 0, node);
  return node;
};
const settle = () => new Promise(r => setImmediate(r));
const radios = host => host.querySelectorAll('[role="radio"]');
const picked = host => radios(host).filter(r => r.getAttribute('aria-checked') === 'true').map(r => r.dataset.value);
const srcOf = tile => { const b = tile.querySelector('.vpPicture'); const i = b && b.children.find(n => n.nodeName === 'IMG'); return i ? i.getAttribute('src') : null; };

// The page: the preview toolbar with the Measurements button and its caret, the Regulation tab, the pieces the scripts ask the page for, and the pictures as stand-ins.
async function page(options){
  const o = options || {};
  const scene = await compose(o.build || 'abu-male-senior-Capt');
  const doc = createDocument();
  doc.querySelectorAll = sel => doc.body.querySelectorAll(sel);
  const el = (tag, id, parent, cls) => { const n = doc.createElement(tag); if(id) n.id = id; if(cls) n.className = cls; (parent || doc.body).append(n); return n; };
  const shell = el('main', 'layoutShell');
  const toolbar = el('div', 'previewToolbar'), measureBtn = el('button', 'measureBtn', toolbar), caret = el('button', 'measureListBtn', toolbar);
  const box = el('input', 'citesShown'), citesHost = el('div', 'citesShownPicker'), body = el('div', 'regulationBody');
  const store0 = new Map(), storage = { getItem: k => (store0.has(k) ? store0.get(k) : null), setItem: (k, v) => store0.set(k, String(v)) };
  let renders = 0;
  const changes = [];
  box.addEventListener('change', () => changes.push(box.checked));
  const asked = { callouts: 0 };
  const sandbox = {
    document: doc, console, setTimeout: () => 0, localStorage: storage, sessionStorage: { getItem: () => '1', setItem(){} },
    Event: function(type, init){ this.type = type; Object.assign(this, init || {}); },
    State: { uniform: o.uniform || 'abu', membership: 'senior', rank: 'Capt', gender: 'male' },
    CAPUBEngine: { measureLayout: ML, core: { createSpecStore: () => ({}) }, profiles: {}, renderSvg: {} },
    CAPUBUniformView: { scene, scheduleRender: () => { renders++; }, buildFromState: () => ({}) },
    CAPUBAssetIndex: {}, ASSET: p => 'images/' + p, CAPUBUniformRules: {},
    CAPUBAssetPacks: { createLoader: () => ({ manifest: () => Promise.resolve({}), prepare: () => Promise.resolve(), spec: () => Promise.resolve({}) }) },
    fetch: () => Promise.reject(new Error('offline')), URL, Blob: function(){}, XMLSerializer: function(){}
  };
  sandbox.window = sandbox; sandbox.self = sandbox;
  vm.runInNewContext(read('js/visual-picker.js'), sandbox);
  const real = (() => { const m = {}; vm.runInNewContext(read('js/profile-pictures.js'), Object.assign(m, { window: m, self: m })); return m.CAPUBProfilePictures; })();
  const none = { now: {}, ready: Promise.resolve({}), settled: true };
  sandbox.CAPUBProfilePictures = Object.assign({}, real, { create: () => ({ uniforms: () => none, cuts: () => none, grades: () => none, memberships: () => none, adults: () => none, names: () => none,
    callouts: () => { asked.callouts++; return (o.callouts || (() => ({ now: { off: 'pic-off', on: 'pic-on' }, ready: Promise.resolve({}), settled: true })))(); } }) });
  vm.runInNewContext(read('js/profile-pickers.js'), sandbox);
  vm.runInNewContext(read('js/measure-panel.js'), sandbox);
  const api = sandbox.CAPUBMeasure;
  api.sync();
  const panel = doc.getElementById('measurePanel');
  const cat = ML.catalogue(scene);
  // The panel as the page's markup builds it, the rows and the host of the pictures as elements.
  function fill(){
    caret.click();                    // opens the panel and fills it (its markup is kept as a string by the small DOM)
    const rows = [];
    const refsHost = el('div', null, panel, 'mpRefs');
    const count = el('span', null, panel, 'mpCount'); count.textContent = `${cat.entries.length} of ${cat.entries.length}`;
    for(const e of cat.entries){
      const row = el('div', null, panel, 'mpRow');
      const sw = el('button', null, row, 'mpToggle'); sw.setAttribute('type', 'button'); sw.setAttribute('role', 'switch'); sw.setAttribute('aria-checked', 'true'); sw.setAttribute('data-id', e.id);
      const text = el('span', null, row, 'mpText'); if(e.ref) text.setAttribute('data-cite-measure', e.id);
      rows.push({ row, sw, text, entry: e });
    }
    api.sync();
    return { rows, refsHost, count };
  }
  return { sandbox, doc, panel, cat, caret, box, citesHost, changes, asked, storage, store0, renders: () => renders, fill, api, timers: [] };
}

test('the panel\'s markup holds no checkbox, link or form control but its buttons, and every button is type="button"', async () => {
  const scene = await compose('blues_a-male-senior-Capt');
  const html = MP.panelHtml(ML.catalogue(scene), []);
  assert.doesNotMatch(html, /<a\b|href=|<form\b|<input\b|<label\b|type="submit"/);
  for(const tag of html.match(/<button\b[^>]*>/g)) assert.match(tag, /\btype="button"/);
});

test('a switch turns its distance off and on in place: the mark, the count, the choice kept for the uniform, the drawing made again; the panel stays open', async () => {
  const p = await page();
  const { rows, count } = p.fill();
  const first = rows.find(r => r.entry.ref);
  const was = p.renders();
  first.sw.click();
  assert.equal(first.sw.getAttribute('aria-checked'), 'false');
  assert.equal(count.textContent, `${p.cat.entries.length - 1} of ${p.cat.entries.length}`);
  assert.deepEqual(JSON.parse(p.store0.get(MP.KEY_HIDDEN)), { abu: [first.entry.id] });
  assert.equal(p.renders(), was + 1);
  assert.equal(p.panel.hidden, false, 'the panel is still open');
  assert.ok(first.row.parentNode === p.panel, 'the row is the same element, not replaced');
  first.sw.click();
  assert.equal(first.sw.getAttribute('aria-checked'), 'true');
  assert.equal(p.store0.has(MP.KEY_HIDDEN) && JSON.parse(p.store0.get(MP.KEY_HIDDEN)).abu, undefined, 'back on: nothing kept for the uniform');
  assert.equal(count.textContent, `${p.cat.entries.length} of ${p.cat.entries.length}`);
});

test('a tap on the text of a row that has no paragraph turns the distance on or off; on one that has a paragraph it is left to the page\'s question-mark handler', async () => {
  const p = await page({ build: 'ocp-male-senior-Capt', uniform: 'ocp' });
  const { rows } = p.fill();
  const plain = rows.find(r => !r.entry.ref), cited = rows.find(r => r.entry.ref);
  assert.ok(plain, 'the OCP has a distance that no paragraph states (the shoulder seam to the flag)');
  plain.text.click();
  assert.equal(plain.sw.getAttribute('aria-checked'), 'false', 'the text turned it off');
  plain.text.click();
  assert.equal(plain.sw.getAttribute('aria-checked'), 'true');
  // The text of a row with a paragraph carries data-cite-measure: js/citations.js takes that press before the panel sees it (a window capture handler), and opens the paragraph.
  assert.equal(cited.text.getAttribute('data-cite-measure'), cited.entry.id);
  cited.text.click();
  assert.equal(cited.sw.getAttribute('aria-checked'), 'true', 'the panel itself never turns a distance off from the text of a row that has a paragraph');
});

test('All and None are plain buttons that set every switch\'s distance and leave the panel open', async () => {
  const p = await page();
  const { rows } = p.fill();
  const bulk = (act) => { const b = p.doc.createElement('button'); b.setAttribute('data-mp', act); b.setAttribute('type', 'button'); p.panel.append(b); return b; };
  bulk('none').click();
  assert.equal(JSON.parse(p.store0.get(MP.KEY_HIDDEN)).abu.length, p.cat.entries.length);
  assert.equal(p.panel.hidden, false);
  bulk('all').click();
  assert.equal(p.store0.has(MP.KEY_HIDDEN) && JSON.parse(p.store0.get(MP.KEY_HIDDEN)).abu, undefined);
  const done = bulk('close'); done.click();
  assert.equal(p.panel.hidden, true, 'Done closes it');
  assert.ok(rows.length);
});

test('whether the callouts quote their paragraph is a pair of pictures of the engine\'s callout, over the choice kept in this browser', async () => {
  const p = await page();
  const { refsHost } = p.fill();
  const group = refsHost.querySelector('.vp');
  assert.ok(group, 'the group is made in the panel\'s host');
  assert.equal(group.querySelector('.vpLegend').textContent, 'On the drawing');
  assert.deepEqual(radios(refsHost).map(r => r.dataset.value), ['off', 'on']);
  assert.deepEqual(radios(refsHost).map(r => r.querySelector('.vpLabel').textContent), ['Distance only', 'With the paragraph']);
  assert.deepEqual(radios(refsHost).map(srcOf), ['pic-off', 'pic-on']);
  assert.deepEqual(picked(refsHost), ['off'], 'off until it is turned on');
  const was = p.renders();
  radios(refsHost)[1].click();
  assert.equal(p.store0.get(MP.KEY_REFS), '1');
  assert.deepEqual(picked(refsHost), ['on']);
  assert.equal(p.renders(), was + 1, 'the drawing is made again');
  radios(refsHost)[0].click();
  assert.equal(p.store0.get(MP.KEY_REFS), '0');
  assert.equal(p.panel.hidden, false);
  // The pictures are asked for from the engine's maker, once for each fill of the panel and each draw of the page.
  assert.ok(p.asked.callouts >= 1);
});

test('a callout picture still being made holds its place, one that could not be made is the name alone, and none is offered where no distance has a paragraph', async () => {
  let release;
  const waiting = await page({ callouts: () => ({ now: { off: undefined, on: null }, settled: false, ready: new Promise(r => { release = () => r({ off: 'pic-late', on: null }); }) }) });
  const { refsHost } = waiting.fill();
  const [off, on] = radios(refsHost);
  assert.ok(off.querySelector('.vpPicture') && srcOf(off) === null, 'a blank box');
  assert.equal(on.classList.contains('noPicture'), true, 'its name alone');
  release(); await settle();
  assert.equal(srcOf(radios(refsHost)[0]), 'pic-late');
  const nothing = await page({ callouts: () => ({ now: { off: false, on: false }, settled: true, ready: Promise.resolve({}) }) });
  const hostless = nothing.fill().refsHost;
  assert.equal(hostless.hidden, true);
  assert.equal(radios(hostless).length, 0);
});

test('an image of the pair that does not decode is taken out by the same guard as the other pictures', async () => {
  const p = await page();
  const { refsHost } = p.fill();
  const tile = radios(refsHost)[0], img = tile.querySelector('.vpPicture').children.find(n => n.nodeName === 'IMG');
  p.doc.listeners.error[0]({ type: 'error', target: img });
  assert.ok(tile.querySelector('.vpPicture') === null && tile.classList.contains('noPicture'), 'the name alone');
});

test('where the references are shown (the Regulation tab) is two pictures of a sample note over the box that stays the source of truth', async () => {
  const p = await page();
  p.sandbox.CAPUBProfilePickers.sync();
  const group = p.citesHost.querySelector('.vp');
  assert.equal(group.querySelector('.vpLegend').textContent, 'References in notes and hints');
  assert.deepEqual(radios(p.citesHost).map(r => r.dataset.value), ['off', 'on']);
  assert.deepEqual(radios(p.citesHost).map(r => r.querySelector('.vpLabel').textContent), ['Behind a question mark', 'Printed in the text']);
  assert.deepEqual(picked(p.citesHost), ['off']);
  for(const tile of radios(p.citesHost)){
    const pic = tile.querySelector('.vpPicture');
    assert.ok(pic && /<svg/.test(pic.html || (pic.children[0] && pic.children[0].html) || ''), 'a drawing in the tile');
  }
  radios(p.citesHost)[1].click();
  assert.equal(p.box.checked, true); assert.deepEqual(p.changes, [true]);
  p.box.checked = false; p.sandbox.CAPUBProfilePickers.sync();
  assert.deepEqual(picked(p.citesHost), ['off'], 'the page sets the box (the saved choice): the pictures follow');
});
