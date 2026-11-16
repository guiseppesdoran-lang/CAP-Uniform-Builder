'use strict';
// FIX-R-OTHER-r1 review round 3: the cadet and adult three-line plates: the name clears line 2.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const core = require('../js/engine/core.js');
const P = require('../js/engine/profiles.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');
const HARNESS = require('../scripts/render-builds.cjs');

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images', 'MANIFEST.json'), 'utf8'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));
const compose = b => P.composeUniform(b, store);
const NAME = { first: 'Pat', last: 'Doran', show: true };
const hb = (uniform, gender, membership, rank, o) => HARNESS.makeBuild(Object.assign({ uniform, gender, membership, rank, name: NAME, opt: { rackColumns: 3, rackArrangement: 'lapel', miniStyle: 'mounting' } }, o || {}));
const byKey = (scene, key) => scene.layers.find(l => l.key === key);
const rad = d => d * Math.PI / 180;
// The centre line of the figure a layer belongs to (the second figure of a scene, the aviator shirt beside the blazer, is shifted).
const centreLine = (scene, l) => { const g = scene.layers.find(x => x.role === 'garment' && (x.figure || 1) === (l.figure || 1)); return g.x + g.w / 2; };

// ---- 1. Cadet and adult three-line plates: the name clears line 2 and the plate's border -----------------------

const NAMETAGS = fs.readdirSync(path.join(root, 'images', 'garments')).filter(f => /nametag-(cadet|adult)\.svg$/.test(f));

test('every three-line nametag layer draws line 2 with its baseline 0.345 in below the plate top (the constant the name placement uses)', () => {
  assert.ok(NAMETAGS.length >= 10, `${NAMETAGS.length} three-line nametag layers`);
  for(const f of NAMETAGS){
    const svg = fs.readFileSync(path.join(root, 'images', 'garments', f), 'utf8');
    const plate = /nametag-plate" x="[-\d.]+" y="([\d.]+)" width="[\d.]+" height="([\d.]+)"[^>]*stroke-width="([\d.]+)"/.exec(svg);
    const lines = [...svg.matchAll(/<g fill="#[0-9a-f]+" transform="translate\(([-\d.]+) ([\d.]+)\) scale\(([\d.]+) ([\d.]+)\)">/g)];
    assert.ok(plate && lines.length === 2, `${f}: plate and two drawn lines`);
    const base2 = parseFloat(lines[1][2]) - parseFloat(plate[1]);
    assert.ok(Math.abs(base2 - 0.345) < 0.002, `${f}: line 2 baseline ${base2.toFixed(3)} in below the plate top`);
    assert.ok(Math.abs(parseFloat(plate[2]) - 0.75) < 1e-6 && Math.abs(parseFloat(plate[3]) - 0.04) < 1e-6, `${f}: 0.75 in plate, 0.04 in outline`);
  }
});

test('three-line plates (Class A and B, cadet and adult, both cuts, short and long sleeves): the name stays 0.05 in under line 2 and 0.05 in over the plate\'s inner border, centred between them (4.1.5.2.2.2.2, 4.1.9.4.2.2; D30)', async () => {
  const cases = [];
  for(const gender of ['male', 'female']){
    for(const rank of ['C/SSgt', 'C/Maj']) for(const [u, sleeve] of [['blues_a', 'short'], ['blues_b', 'short'], ['blues_b', 'long']]) cases.push([u, gender, 'cadet', rank, sleeve]);
    for(const [u, sleeve] of [['blues_b', 'short'], ['blues_b', 'long']]) cases.push([u, gender, 'senior', 'Capt', sleeve]);
  }
  let checked = 0;
  for(const [u, gender, membership, rank, sleeve] of cases){
    for(const last of ['Doe', 'Vanderbilt-Smythe']){
      const scene = await compose(hb(u, gender, membership, rank, { name: { first: 'Pat', last, show: true }, opt: { sleeve } }));
      const tag = scene.layers.find(l => /nametag-(cadet|adult)$/.test(l.id || ''));
      const text = byKey(scene, 'text:name');
      const tagLabel = `${u} ${gender} ${rank} ${sleeve} ${last}`;
      if(u === 'blues_a' && membership === 'senior') continue;
      assert.ok(tag && text, `${tagLabel}: nametag layer and name`);
      const spec = await store.load(tag.id);
      const plate = core.landmarkBounds(spec, 'nametag');
      const b = core.layerBounds(text);
      const line2 = plate.y + 0.345, inner = plate.y + plate.h - 0.02;
      assert.ok(b.y >= line2 + 0.05 - 1e-6, `${tagLabel}: name top ${b.y.toFixed(3)} is ${(b.y - line2).toFixed(3)} in under line 2 (${line2.toFixed(3)})`);
      assert.ok(b.y + b.h <= inner - 0.05 + 1e-6, `${tagLabel}: name bottom ${(b.y + b.h).toFixed(3)} is ${(inner - b.y - b.h).toFixed(3)} in over the inner border (${inner.toFixed(3)})`);
      assert.ok(Math.abs((b.y - line2) - (inner - b.y - b.h)) < 0.01, `${tagLabel}: centred between line 2 and the border`);
      if(last === 'Doe') assert.ok(b.h > 0.2 && b.h < 0.27, `${tagLabel}: capitals ${b.h.toFixed(3)} in tall`);
      checked++;
    }
  }
  assert.ok(checked >= 30, `${checked} plates checked`);
});

