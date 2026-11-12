'use strict';
// The two Emergency Services patches are flat pictures (PNG files shipped as given), and the engine places them by id, as a piece of art. The renderer reads an
// asset as an SVG sheet and refused them ("Not an SVG"), so a member who picked a style saw no patch. A piece whose file is not an SVG is drawn as the picture
// it is, through the loader every other picture uses, at the size and place the profile worked out.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const core = require('../js/engine/core.js');
const P = require('../js/engine/profiles.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');
const HARNESS = require('../scripts/render-builds.cjs');
const { createDocument, Node } = require('./helpers/mini-dom.cjs');

global.self = global.self || global;
require('../js/engine/render-svg.js');
const RS = global.self.CAPUBEngine.renderSvg;

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images', 'MANIFEST.json'), 'utf8'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));
const compose = b => P.composeUniform(b, store);
const manifestPath = id => store.entry(id).path;
const isSvg = p => /\.svg$/i.test(p);

const STYLES = [['style-1', 'patch-es-style-1'], ['style-2', 'patch-es-style-2']];
const ES_UNIFORMS = ['flight_suit', 'corporate_flight_suit', 'corporate_field'];
const esBuild = (uniform, style, o) => HARNESS.makeBuild(Object.assign({ uniform, gender: 'male', membership: 'senior', rank: 'Capt', opt: { esPatch: style } }, o || {}));

// A PNG file's signature and pixel size, read from its header.
function pngSize(file){
  const b = fs.readFileSync(file);
  assert.equal(b.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${file} is a PNG`);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}
const fileOf = p => path.join(root, 'images', p);
const patchLayers = scene => scene.layers.filter(l => l.role === 'patch' && /^patch:patch-es-style-\d$/.test(l.key));

test('the two styles are PNG files with a spec of the picture\'s own proportions', async () => {
  for(const [, id] of STYLES){
    const e = store.entry(id), spec = await store.load(id);
    assert.match(e.path, /\.png$/, `${id} is a flat picture`);
    const px = pngSize(fileOf(e.path));
    assert.ok(Math.abs(spec.w / spec.h - px.w / px.h) < 0.005 * px.w / px.h, `${id}: ${spec.w} x ${spec.h} in against ${px.w} x ${px.h} px`);
    assert.ok(spec.w > 0 && spec.h > 0 && e.w_in === spec.w && e.h_in === spec.h, 'the size is the manifest row\'s and the spec\'s');
  }
});

for(const uniform of ES_UNIFORMS) for(const [style, id] of STYLES){
  test(`${uniform}, Emergency Services patch ${style}: the drawing gets the picture, at the size and place the profile gave it, and the scene still says what the engine placed`, async () => {
    const scene = await compose(esBuild(uniform, style));
    const layers = patchLayers(scene);
    assert.equal(layers.length, 1, 'one patch');
    const layer = layers[0], spec = await store.load(id);
    assert.equal(layer.id, id);
    assert.equal(layer.type, 'asset', 'the engine\'s layer is untouched');
    const drawn = RS.pictureLayer(layer, manifestPath);
    assert.notEqual(drawn, layer, 'a copy: the scene is not changed');
    assert.equal(layer.type, 'asset');
    assert.equal(drawn.type, 'raster');
    assert.equal(drawn.href, 'images/' + manifestPath(id));
    for(const k of ['x', 'y', 'w', 'h', 'z', 'rotate', 'key', 'role', 'id']) assert.deepEqual(drawn[k], layer[k], k);
    assert.ok(layer.w <= spec.w + 1e-9 && layer.h <= spec.h + 1e-9, 'never larger than the picture\'s true size');
    assert.ok(Math.abs(layer.w / layer.h - spec.w / spec.h) < 1e-3, 'the proportions are the picture\'s');
    const px = pngSize(fileOf(manifestPath(id)));
    assert.ok(Math.abs(drawn.w / drawn.h - px.w / px.h) < 0.005 * px.w / px.h, 'and the file\'s own');
    assert.ok(fs.existsSync(fileOf(manifestPath(id))));
  });
}

test('the flight jacket beside the suit wears the same picture', async () => {
  for(const uniform of ['flight_suit', 'corporate_flight_suit']) for(const [style, id] of STYLES){
    const scene = await compose(esBuild(uniform, style, { opt: { esPatch: style, jacket: true } }));
    const drawn = patchLayers(scene).map(l => RS.pictureLayer(l, manifestPath));
    assert.ok(drawn.length >= 1 && drawn.every(l => l.type === 'raster' && l.id === id), `${uniform} ${style}`);
  }
});

// The drawing itself, with the page's DOM and loader stood in for: the picture is fetched once as an image and drawn as an <image> of the layer's box; the
// loader that reads a sheet as an SVG is never asked for it.
test('buildSvg draws the patch as an image in the layer\'s box and does not hand it to the SVG loader', async () => {
  const doc = createDocument();
  Node.prototype.setAttributeNS = function(ns, k, v){ this.setAttribute(k, v); };
  const fetched = [], seen = new Set();
  const realFetch = global.fetch, realReader = global.FileReader, realDoc = global.document;
  global.document = doc;
  global.fetch = async url => {
    fetched.push(String(url));
    return { ok: true, blob: async () => ({ url }), text: async () => { throw new Error('read as a sheet: ' + url); } };
  };
  global.FileReader = class { readAsDataURL(blob){ this.result = 'data:image/png;base64,' + Buffer.from(String(blob.url)).toString('base64'); setTimeout(() => this.onload(), 0); } };
  try{
    for(const uniform of ES_UNIFORMS) for(const [style, id] of STYLES){
      fetched.length = 0;
      const layer = patchLayers(await compose(esBuild(uniform, style)))[0];
      const scene = { title: 'patch', bounds: { x: layer.x, y: layer.y, w: layer.w, h: layer.h }, layers: [layer] };
      const svg = await RS.buildSvg(scene, manifestPath, { pad: 0 });
      // The loader keeps what it has fetched, so a picture is fetched the first time it is drawn and never as a sheet.
      const url = 'images/' + manifestPath(id);
      assert.deepEqual(fetched, seen.has(url) ? [] : [url], `${uniform} ${style}: the picture, once, as an image`);
      seen.add(url);
      const images = svg.querySelectorAll('image');
      assert.equal(images.length, 1, `${uniform} ${style}: an image is drawn`);
      const im = images[0];
      assert.match(im.getAttribute('href'), /^data:image\/png;base64,/, 'the picture is inlined, so the exported drawing stands alone');
      for(const [attr, v] of [['x', layer.x], ['y', layer.y], ['width', layer.w], ['height', layer.h]]) assert.ok(Math.abs(Number(im.getAttribute(attr)) - v) < 1e-3, `${uniform} ${style}: ${attr}`);
      assert.equal(svg.querySelectorAll('symbol').length, 0, 'no sheet symbol was made for it');
    }
  }finally{
    global.fetch = realFetch; global.FileReader = realReader; global.document = realDoc;
    if(realFetch === undefined) delete global.fetch;
    if(realReader === undefined) delete global.FileReader;
    if(realDoc === undefined) delete global.document;
    delete Node.prototype.setAttributeNS;
  }
});

// ---- the sweep: every file the engine can ask the loader for -----------------------------------------------------------------------------------------

const NON_SVG = manifest.assets.filter(a => !isSvg(a.path));

test('every picture in the manifest is a PNG that exists, with a spec and a size that agree with it', async () => {
  assert.ok(NON_SVG.length >= 84, `${NON_SVG.length} pictures`);
  for(const a of NON_SVG){
    assert.equal(a.category, 'patches', `${a.id}: only patches are pictures`);
    assert.match(a.path, /\.png$/i, a.id);
    const px = pngSize(fileOf(a.path));
    assert.ok(Math.abs(a.w_in / a.h_in - px.w / px.h) < 0.005 * px.w / px.h, `${a.id}: ${a.w_in} x ${a.h_in} in against ${px.w} x ${px.h} px`);
    assert.ok(a.has_spec, `${a.id}: a spec`);
    const spec = JSON.parse(fs.readFileSync(fileOf(a.path.replace(/\.png$/i, '.spec.json')), 'utf8'));
    assert.equal(spec.width_in, a.w_in, `${a.id}: the spec's width is the manifest's`);
    assert.equal(spec.height_in, a.h_in, `${a.id}: the spec's height is the manifest's`);
  }
});

test('the only pictures a profile names by id are the two Emergency Services styles; any other the engine would have to place is drawn through the same route', () => {
  const sources = fs.readdirSync(path.join(root, 'js', 'engine')).filter(f => f.endsWith('.js')).map(f => [f, fs.readFileSync(path.join(root, 'js', 'engine', f), 'utf8')]);
  const named = NON_SVG.filter(a => sources.some(([, text]) => text.includes(`'${a.id}'`) || text.includes(`"${a.id}"`))).map(a => a.id).sort();
  assert.deepEqual(named, STYLES.map(s => s[1]).sort());
});

// Every build the standard matrix, the critique set and the Emergency Services and patch choices make: each asset layer the engine puts in a scene is either
// a sheet the loader accepts (an SVG) or a picture the drawing takes as an image from a PNG that exists. Fails on one the loader would refuse.
function* patchBuilds(){
  const art = require('../data/patch-art.js'), units = require('../data/unit-patch-art.js');
  const refs = [...Object.keys(art).map(id => ({ id, kind: 'general', slot: 'L_SHOULDER', label: id })), ...units.map(r => ({ id: r.patchId, kind: 'unit', label: r.label }))];
  for(const uniform of ['abu', 'ocp', 'flight_suit', 'corporate_flight_suit', 'corporate_field'])
    for(const ref of refs) yield { name: `${uniform}-${ref.id}`, build: HARNESS.makeBuild({ uniform, gender: 'male', membership: 'senior', rank: 'Capt', patchRefs: [ref] }) };
  for(const uniform of ES_UNIFORMS) for(const gender of ['male', 'female']) for(const membership of ['senior', 'cadet'])
    for(const [style] of STYLES) for(const jacket of [false, true])
      yield { name: `${uniform}-${gender}-${membership}-${style}${jacket ? '-jacket' : ''}`, build: HARNESS.makeBuild({ uniform, gender, membership, rank: membership === 'cadet' ? 'C/Capt' : 'Capt', opt: { esPatch: style, jacket } }) };
}

test('sweep: every asset any build can place is a sheet the loader accepts or a picture the drawing takes through the raster route', async () => {
  const critique = JSON.parse(execFileSync(process.execPath, [path.join(root, 'scripts', 'critique-builds.cjs')], { encoding: 'utf8' }));
  const builds = [
    ...HARNESS.matrix().builds.map(b => ({ name: b.name, build: HARNESS.makeBuild(b.build) })),
    ...critique.map(c => ({ name: c.name, build: HARNESS.makeBuild(c.build) })),
    ...patchBuilds()
  ];
  assert.ok(builds.length > 700, `${builds.length} builds`);
  const sheets = new Set(), pictures = new Set(), rasters = new Set(), asked = new Map();
  for(const { name, build } of builds){
    const scene = await compose(build);
    for(const layer of scene.layers){
      if(layer.type === 'raster'){ rasters.add(layer.href); continue; }
      if(layer.type !== 'asset') continue;
      const p = manifestPath(layer.id), drawn = RS.pictureLayer(layer, manifestPath);
      if(isSvg(p)){ assert.equal(drawn, layer, `${name}: ${layer.id} is a sheet and goes to the loader as it is`); sheets.add(layer.id); continue; }
      assert.equal(drawn.type, 'raster', `${name}: ${layer.id} would be refused by the SVG loader`);
      assert.equal(drawn.href, 'images/' + p);
      assert.ok(fs.existsSync(fileOf(p)), `${name}: ${p} exists`);
      assert.ok(Math.abs(drawn.w / drawn.h - layer.w / layer.h) < 1e-9 && drawn.w === layer.w, `${name}: the picture keeps the size placed`);
      pictures.add(layer.id);
      if(!asked.has(layer.id)) asked.set(layer.id, name);
    }
  }
  assert.ok(sheets.size > 100, `${sheets.size} sheets seen`);
  assert.deepEqual([...pictures].sort(), STYLES.map(s => s[1]).sort(), 'the pictures a build places as art are the two styles');
  assert.ok(rasters.size >= 80, `${rasters.size} pictures handed over by href`);
  for(const href of rasters){
    if(/^data:/.test(href)) continue;
    const rel = href.replace(/^\/?images\//, '').replace(/\?.*$/, '');
    assert.ok(fs.existsSync(fileOf(rel)) && !isSvg(rel), `${href} is a picture file that exists`);
  }
});
