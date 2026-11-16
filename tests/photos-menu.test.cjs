'use strict';
// The Photos menu of the last step (js/photos-menu.js): a tile for the whole uniform and for each part the build has, each a live picture of that part; a tile downloads the
// part as a PNG. The script runs here against the picture picker (js/visual-picker.js, action mode), the small DOM of tests/helpers/mini-dom.cjs and stand-ins for the drawing.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createDocument, keydown } = require('./helpers/mini-dom.cjs');

const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const SOURCE = read('js/photos-menu.js');

global.document = createDocument();
const VisualPicker = require('../js/visual-picker.js');
const ExportNames = require('../export-names.js');

const flush = async () => { for(let i = 0; i < 40; i++) await new Promise(r => setImmediate(r)); };

// A stand-in for an <svg>: its viewBox, the size set on it and what it serialises to.
function fakeSvg(label, viewBox = '0 0 10 5'){
  const svg = { label, attrs: { viewBox }, cloneNode(){ return Object.assign({}, svg, { attrs: Object.assign({}, svg.attrs) }); }, getAttribute(k){ return this.attrs[k]; }, setAttribute(k, v){ this.attrs[k] = String(v); } };
  return svg;
}

const PARTS = [
  { id: 'ribbon-rack', label: 'Ribbon rack', file: 'ribbon-rack', view: { x: 0, y: 0, w: 4, h: 1 } },
  { id: 'left-chest', label: 'Left chest', file: 'left-chest', view: { x: 0, y: 0, w: 4, h: 3 } },
  { id: 'cord', label: 'Cord', file: 'cord', view: { x: 0, y: 0, w: 2, h: 15 } }
];

// The page around the menu: the finish panel, the menu's own block and the download button.
function page(options){
  const o = Object.assign({ parts: PARTS, scene: true }, options);
  const doc = createDocument();
  global.document = doc;
  const panel = doc.createElement('section'); panel.id = 'finishPanel'; panel.getClientRects = () => (o.visible === false ? [] : [{}]);
  const box = doc.createElement('div'); box.id = 'photosMenu'; box.hidden = true;
  const tiles = doc.createElement('div'); tiles.id = 'photosMenuTiles';
  const status = doc.createElement('div'); status.id = 'photosMenuStatus';
  const download = doc.createElement('button'); download.id = 'downloadImage';
  box.append(tiles, status);
  panel.append(box, download);
  doc.body.append(panel);
  const log = { clicks: 0, exported: [], notified: [], tracked: [], downloads: [], revoked: [], made: 0, built: [] };
  download.addEventListener('click', () => { log.clicks++; });
  const realCreate = doc.createElement;
  doc.createElement = tag => { const n = realCreate(tag); if(tag === 'a') log.downloads.push(n); return n; };
  const held = { scene: { layers: [] }, plan: { parts: o.parts } };
  const timers = [];
  const ctx = {
    document: doc, console: { error: () => {}, log: () => {}, warn: () => {} },
    State: { rank: 'C/Capt', uniform: 'blues_a', ceremonial: false },
    CAPUBExportNames: ExportNames, VisualPicker,
    CAPUBEngine: { parts: {}, renderSvg: { embedFonts: async svg => svg } },
    CAPUBUniformView: {
      svg: fakeSvg('whole', '0 0 26 36'),
      parts: async () => (o.scene ? held : null),
      partSvg: async (h, part) => { log.built.push(part.id); return fakeSvg(part.id); },
      exportPart: async (h, part) => {
        log.exported.push(part.id);
        if(o.failExport) throw new Error('the drawing could not be made');
        return { toBlob: cb => cb(o.noBlob ? null : { size: 1 }) };
      }
    },
    CAPUB_TELEMETRY: { track: (name, data) => log.tracked.push([name, data]) },
    capubNotify: msg => log.notified.push(msg),
    URL: { createObjectURL: () => `blob:photo-${++log.made}`, revokeObjectURL: u => log.revoked.push(u) },
    Blob: function(parts, opts){ this.parts = parts; this.type = opts && opts.type; },
    XMLSerializer: function(){ this.serializeToString = svg => `<svg data-label="${svg.label}" width="${svg.attrs.width}" height="${svg.attrs.height}"/>`; },
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; }, clearTimeout: () => {},
    IntersectionObserver: function(cb){ ctx.observed = cb; this.observe = n => { ctx.observedNode = n; }; }
  };
  ctx.window = ctx; ctx.self = ctx;
  vm.runInNewContext(SOURCE, ctx, { filename: 'js/photos-menu.js' });
  return { doc, panel, box, tiles, status, download, log, ctx, timers, held };
}
const options = p => p.tiles.querySelectorAll('.vpOption');
const names = p => options(p).map(b => b.querySelector('.vpLabel').textContent);

test('the menu is drawn when the step comes on screen: the whole uniform first, then each part, each tile a button with a picture and its name', async () => {
  const p = page();
  assert.equal(p.box.hidden, true, 'hidden until there is a drawing');
  assert.equal(typeof p.ctx.IntersectionObserver, 'function');
  assert.equal(p.ctx.observedNode, p.panel, 'it waits for the step\'s panel to come on screen');
  p.ctx.observed([{ isIntersecting: true }]);
  await flush();
  assert.equal(p.box.hidden, false);
  assert.deepEqual(names(p), ['Whole uniform', 'Ribbon rack', 'Left chest', 'Cord']);
  assert.ok(options(p).every(b => b.nodeName === 'BUTTON' && b.getAttribute('type') === 'button'));
  assert.ok(options(p).every(b => /^blob:photo-\d+$/.test(b.querySelector('img').getAttribute('src'))), 'each tile is a picture of its own');
  assert.deepEqual(p.log.built, ['ribbon-rack', 'left-chest', 'cord'], 'the pictures are of the parts');
  assert.equal(p.tiles.querySelector('.vp').dataset.mode, 'action');
});

test('nothing stays pressed or checked: the tiles are plain buttons in a group, with no radio, pressed or checked state', async () => {
  const p = page();
  p.ctx.observed([{ isIntersecting: true }]);
  await flush();
  const group = p.tiles.querySelector('[role="group"]');
  assert.ok(group, 'a group of buttons');
  assert.equal(p.tiles.querySelectorAll('[role="radio"]').length + p.tiles.querySelectorAll('[aria-pressed]').length + p.tiles.querySelectorAll('[aria-checked]').length, 0);
  assert.equal(group.getAttribute('aria-labelledby'), 'photosMenuLabel', 'named by the menu\'s own heading');
  options(p)[1].click();
  await flush();
  assert.ok(!options(p).some(b => b.classList.contains('isPicked')), 'no tile is marked picked after a press');
  assert.equal(options(p).filter(b => b.getAttribute('aria-busy')).length, 0, 'and none is left busy');
});

test('the whole-uniform tile is the page\'s own download: it presses the Download picture button and makes nothing of its own', async () => {
  const p = page();
  p.ctx.observed([{ isIntersecting: true }]);
  await flush();
  options(p)[0].click();
  await flush();
  assert.equal(p.log.clicks, 1);
  assert.deepEqual(p.log.exported, [], 'no part was made');
  assert.equal(p.log.downloads.length, 0, 'it saves no file itself');
});

test('a part\'s tile downloads that part as a PNG named for it, and says so', async () => {
  const p = page();
  p.ctx.observed([{ isIntersecting: true }]);
  await flush();
  options(p)[1].click();
  await flush();
  assert.deepEqual(p.log.exported, ['ribbon-rack']);
  assert.equal(p.log.downloads.length, 1);
  const link = p.log.downloads[0];
  assert.match(link.download, /^CAP-Uniform_C-Capt_Blues-A_ribbon-rack_\d{4}-\d{2}-\d{2}\.png$/);
  assert.match(link.href, /^blob:photo-/);
  assert.equal(p.status.textContent, `Downloaded ${link.download}.`);
  assert.deepEqual(JSON.parse(JSON.stringify(p.log.tracked)), [['png_download', { uniform: 'blues_a', ok: true, part: 'ribbon-rack' }]]);
  assert.equal(p.log.clicks, 0, 'the whole-uniform button is not pressed');
  // The Honor Guard Uniform names its files for itself.
  p.ctx.State.ceremonial = true;
  options(p)[3].click();
  await flush();
  assert.match(p.log.downloads[1].download, /^CAP-Uniform_C-Capt_Honor-Guard_cord_/);
});

test('a tile is busy while its picture is made, and a second press is ignored until it is done', async () => {
  const p = page();
  p.ctx.observed([{ isIntersecting: true }]);
  await flush();
  let release;
  p.ctx.CAPUBUniformView.exportPart = (h, part) => new Promise(res => { p.log.exported.push(part.id); release = () => res({ toBlob: cb => cb({ size: 1 }) }); });
  const tile = options(p)[2];
  tile.click();
  await flush();
  assert.equal(tile.getAttribute('aria-busy'), 'true');
  assert.ok(tile.classList.contains('isBusy'));
  tile.click(); options(p)[1].click();
  await flush();
  assert.deepEqual(p.log.exported, ['left-chest'], 'no second picture is started');
  release();
  await flush();
  assert.equal(tile.getAttribute('aria-busy'), null);
  assert.equal(p.log.downloads.length, 1);
});

test('a picture that cannot be made is said so, counted as a failed download, and leaves the tile ready again', async () => {
  const p = page({ failExport: true });
  p.ctx.observed([{ isIntersecting: true }]);
  await flush();
  const tile = options(p)[1];
  tile.click();
  await flush();
  assert.equal(p.log.downloads.length, 0);
  assert.match(p.log.notified[0], /^The picture could not be made: the drawing could not be made$/);
  assert.deepEqual(JSON.parse(JSON.stringify(p.log.tracked)), [['png_download', { uniform: 'blues_a', ok: false, part: 'ribbon-rack' }]]);
  assert.equal(tile.getAttribute('aria-busy'), null);
  const blocked = page({ noBlob: true });
  blocked.ctx.observed([{ isIntersecting: true }]);
  await flush();
  options(blocked)[1].click();
  await flush();
  assert.match(blocked.log.notified[0], /could not be saved/);
});

test('the arrow keys move between the tiles, Home and End go to the ends, and Enter presses the focused one', async () => {
  const p = page();
  p.ctx.observed([{ isIntersecting: true }]);
  await flush();
  const tiles = options(p);
  assert.deepEqual(tiles.map(b => b.tabIndex), [0, -1, -1, -1], 'one stop of the Tab key');
  tiles[0].dispatchEvent(keydown('ArrowRight'));
  assert.equal(document.activeElement, tiles[1]);
  assert.deepEqual(tiles.map(b => b.tabIndex), [-1, 0, -1, -1]);
  tiles[1].dispatchEvent(keydown('End'));
  assert.equal(document.activeElement, tiles[3]);
  tiles[3].dispatchEvent(keydown('ArrowRight'));
  assert.equal(document.activeElement, tiles[0], 'it wraps');
  tiles[0].dispatchEvent(keydown('ArrowLeft'));
  assert.equal(document.activeElement, tiles[3]);
  tiles[3].dispatchEvent(keydown('Home'));
  assert.equal(document.activeElement, tiles[0]);
  // Enter and the space bar press a real button themselves (the browser clicks it), so the script leaves those keys alone.
  const enter = keydown('Enter');
  tiles[0].dispatchEvent(enter);
  assert.equal(enter.defaultPrevented, undefined, 'the key is not taken');
});

test('with no drawing the menu stays hidden; a part the build loses is no longer offered, and the pictures of the old tiles are let go', async () => {
  const none = page({ scene: false });
  none.ctx.observed([{ isIntersecting: true }]);
  await flush();
  assert.equal(none.box.hidden, true);
  assert.equal(options(none).length, 0);
  const p = page();
  p.ctx.observed([{ isIntersecting: true }]);
  await flush();
  const first = options(p).map(b => b.querySelector('img').getAttribute('src'));
  assert.equal(first.length, 4);
  p.held.plan = { parts: PARTS.slice(0, 1) };
  p.ctx.window.CAPUBPhotos.refresh();
  await flush();
  assert.deepEqual(names(p), ['Whole uniform', 'Ribbon rack']);
  assert.deepEqual([...p.log.revoked].sort(), [...first].sort(), 'every picture of the first set was let go');
  p.held.plan = { parts: [] };
  p.ctx.window.CAPUBPhotos.refresh();
  await flush();
  assert.deepEqual(names(p), ['Whole uniform']);
});

test('the tiles follow the drawing only while the step is on screen: a change waits, then draws when the step is shown', async () => {
  const p = page({ visible: false });
  const rendered = p.doc.listeners['capub:rendered'];
  assert.equal(rendered.length, 1, 'it listens for the drawing');
  rendered[0]({});
  p.timers.forEach(t => t.fn());
  await flush();
  assert.equal(options(p).length, 0, 'not on screen: nothing is made');
  p.ctx.observed([{ isIntersecting: false }]);
  await flush();
  assert.equal(options(p).length, 0);
  p.ctx.observed([{ isIntersecting: true }]);
  await flush();
  assert.deepEqual(names(p), ['Whole uniform', 'Ribbon rack', 'Left chest', 'Cord']);
  // On screen, a change draws them again after a moment.
  const before = p.log.built.length;
  p.panel.getClientRects = () => [{}];
  rendered[0]({});
  p.timers.forEach(t => t.fn());
  await flush();
  assert.equal(p.log.built.length, before + 3);
});

test('the page holds the menu: a hidden block in the Downloads panel with its heading, its tiles and a status line, and loads the scripts in order', () => {
  const html = read('index.html');
  const panel = html.slice(html.indexOf('id="finishPanel"'), html.indexOf('id="savedSetupsMore"'));
  assert.match(panel, /<div class="finishAction" id="photosMenu" hidden>\s*<label class="fieldLabel" id="photosMenuLabel">Photos<\/label>/);
  assert.match(panel, /<div id="photosMenuTiles"><\/div>/);
  assert.match(panel, /<div class="hintText" id="photosMenuStatus" role="status" aria-live="polite"><\/div>/);
  assert.ok(panel.indexOf('id="photosMenu"') < panel.indexOf('id="downloadAction"'), 'the menu comes first');
  const at = name => html.indexOf(`<script src="${name}?v=`);
  assert.ok(at('js/engine/render-svg.js') < at('js/engine/parts.js') && at('js/engine/parts.js') < at('js/uniform-view.js'), 'the parts are known to the drawing');
  assert.ok(at('js/visual-picker.js') < at('js/photos-menu.js') && at('js/photos-menu.js') < at('js/bootstrap.js'), 'the menu comes after the picker and with the feature scripts');
  const feature = html.slice(html.indexOf('<!-- Feature scripts'), html.indexOf('<!-- End of feature scripts. -->'));
  assert.match(feature, /<script src="js\/photos-menu\.js\?v=[0-9a-f]{10}" defer><\/script>/);
  // The Download picture button is still the footer's primary action (js/workspace-ui.js moves it there).
  assert.match(html, /<div class="finishAction" id="downloadAction">\s*<button id="downloadImage" type="button">Download picture \(PNG\)<\/button>/);
});

test('what the menu says is plain: no regulation is named, and nothing the member reads is a file name or an id', () => {
  const html = read('index.html');
  const block = html.slice(html.indexOf('id="photosMenu"'), html.indexOf('id="downloadAction"'));
  const text = block.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' ');
  assert.match(text, /Photos/);
  assert.match(text, /Tap a picture to download that part of your uniform\./);
  assert.doesNotMatch(text + SOURCE.match(/label: '[^']+'|`[^`]*Downloaded[^`]*`|'The picture could not[^']*'/g).join(' '), /CAPR|ICL|\d\.\d|paragraph|regulation/i);
});

test('the tile\'s picture is a stand-alone image: its font carried inside, its size set, let go of when the tiles are drawn again', async () => {
  const p = page();
  const embedded = [];
  p.ctx.CAPUBEngine.renderSvg.embedFonts = async svg => { embedded.push(svg.label); return svg; };
  p.ctx.observed([{ isIntersecting: true }]);
  await flush();
  assert.deepEqual(embedded.sort(), ['cord', 'left-chest', 'ribbon-rack', 'whole'].sort());
  assert.ok(embedded.length === 4);
  assert.match(SOURCE, /const TILE_PX = 360;/);
});
