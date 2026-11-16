'use strict';
// The owner (2026-11-12), on the Historian Technician Badge tile: "this is not the right shape". The badge is a shield 1.25 by 1.43 in; the tile's picture frame is 3 by 2, so the
// shield fitted whole fills the frame's height and its outline meets the frame's edge at the top and at the bottom: it reads as cut. The frame keeps a margin all round (a badge is fitted
// whole, never cropped), for every badge the chooser offers, on every kind of uniform; and the badge's box (its sheet) is the shape the drawn uniform draws, whole, on each uniform.
// The art itself is another worker's: the test reads the sheets, it changes none.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const core = require('../js/engine/core.js');
const G = require('../js/engine/grades.js');
const P = require('../js/engine/profiles.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');
require('../js/engine/profiles-polo.js');
const BC = require('../data/badge-catalog.js');
const manifest = JSON.parse(read('images/MANIFEST.json'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(read('images/' + p))));

const ART = Object.entries(BC.BADGES).flatMap(([id, b]) => ['dress', 'field', 'cloth'].filter(k => b[k]).map(k => ({ badge: id, form: k, asset: b[k] })));

test('every badge sheet is one whole box: its drawing area is the size its spec states (the shape of the badge), so a frame that fits the box fits the whole badge', async () => {
  assert.ok(ART.length > 150, 'the catalog\'s sheets');
  const bad = [];
  for(const a of ART){
    let spec;
    try{ spec = await store.load(a.asset); }catch(e){ continue; }   // a sheet the manifest does not have is the catalog test's
    const svg = read('images/' + spec.path.replace(/^images\//, ''));
    const root = /<svg\b[^>]*>/.exec(svg)[0];
    const vb = /viewBox="([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)"/.exec(root);
    if(!vb){ bad.push(`${a.asset}: no viewBox`); continue; }
    const aspect = +vb[3] / +vb[4], want = spec.w / spec.h;
    if(Math.abs(aspect / want - 1) > 0.01) bad.push(`${a.asset}: viewBox ${vb[3]}x${vb[4]} is not the spec's ${spec.w}x${spec.h}`);
    if(/preserveAspectRatio="none"/.test(root)) bad.push(`${a.asset}: preserveAspectRatio none (it would stretch)`);
  }
  assert.deepEqual(bad, [], bad.join('\n'));
});

test('on every kind of uniform the drawn badge is its sheet\'s whole box at its own shape: not stretched, not cut', async () => {
  const kinds = [['blues_a', 'male'], ['blues_a', 'female'], ['blues_b', 'male'], ['abu', 'male'], ['ocp', 'male'], ['mess_dress', 'male'], ['aviator', 'male']];
  let drawn = 0;
  const bad = [];
  for(const [uniform, gender] of kinds){
    for(const [id, b] of Object.entries(BC.BADGES)){
      const build = { uniform, gender, membership: 'senior', grade: G.gradeInfo('senior', 'Capt', {}), opt: { headgear: 'none' }, name: { first: '', last: '', show: false }, ribbons: [], medals: [],
        badges: [{ id, title: b.name, art: b.dress || b.field || b.cloth }], command: null, militaryBadges: [], patches: [], cord: null };
      const scene = await P.composeUniform(build, store).catch(() => null);
      if(!scene) continue;
      for(const l of scene.layers.filter(x => x.role === 'badge' && x.type === 'asset' && x.key === 'badge:' + id)){
        const spec = await store.load(l.id);
        drawn++;
        if(l.clip || l.cutBelow != null) bad.push(`${uniform} ${gender} ${id}: cut (${l.clip ? 'clip' : 'cutBelow'})`);
        if(Math.abs((l.w / l.h) / (spec.w / spec.h) - 1) > 0.01) bad.push(`${uniform} ${gender} ${id}: drawn ${l.w.toFixed(3)}x${l.h.toFixed(3)}, its sheet is ${spec.w}x${spec.h}`);
      }
    }
  }
  assert.ok(drawn > 300, `badges drawn across the uniforms: ${drawn}`);
  assert.deepEqual(bad, [], bad.slice(0, 10).join('\n'));
});

test('the frame of a tile keeps a margin round the picture (6 px of padding, 4 px on a ribbon\'s), so a badge fitted whole never meets the frame\'s edge', () => {
  const css = read('styles/app.css');
  assert.match(css, /\.vp\[data-boxed\] \.vpPicture\{padding:6px\}/);
  assert.match(css, /\.vp\[data-shape="wide"\] \.vpPicture,\.vp\[data-size="large"\]\[data-shape="wide"\] \.vpPicture\{aspect-ratio:3 \/ 1;padding:4px\}/);
  assert.ok(css.indexOf('.vp[data-boxed] .vpPicture{padding:6px}') < css.indexOf('.vp[data-shape="wide"] .vpPicture'), 'the ribbon\'s own margin comes after and wins');
});

test('in a real browser, every badge the chooser offers on each kind of uniform is fitted whole in its frame with a margin on every side (needs Chrome)', { timeout: 280000 }, t => {
  const chrome = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if(!fs.existsSync(chrome)) return t.skip('Chrome not installed');
  const r = require('node:child_process').spawnSync(process.execPath, [path.join(__dirname, 'badge-tile-frame-browser.cjs')], { encoding: 'utf8', timeout: 260000 });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /^PASS$/m);
});
