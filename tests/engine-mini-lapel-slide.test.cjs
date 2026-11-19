'use strict';
// The miniature rack on the Corporate Semi-Formal blazer slides toward the arm by the least that leaves no drape, medal body or device under the lapel (CAPR 39-1 11.2.8:
// the medal nearest the lapel is fully exposed; the owner, 2026-11-18), a hairline (half a percent of a drape) not being a hit, never past the sleeve limit and the shoulder line, and with
// the rows, the medals in each row and the overlap within a row as the table of 11.2.8 and the code lay them. NEED is the slide, in inches, the rack as laid needs to clear the lapel
// (measured on the rack before it slid: 0 where nothing was covered); ROWS the rows of each count, top row first.

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
const manifestText = JSON.stringify(manifest);
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));
const NEED = {"male mounting":[0,0,0,0.01,0.01,0.02,0.23,0.57,0.63,0.63,0.87,1.24],"male holding":[0,0,0,0.01,0.34,0.34,0.34,0.57,0.63,0.73,0.73,0.77],"female mounting":[0,0,0,0,0,0,0,0.33,0.37,0.37,0.37,0.6],"female holding":[0,0,0,0,0.3,0.3,0.3,0.33,0.37,0.56,0.56,0.58]};
const ROWS = {"male mounting":["1","2","3","4","1+4","2+4","3+4","4+4","1+4+4","2+4+4","3+4+4","4+4+4"],"male holding":["1","2","3","4","5","6","7","4+4","4+5","5+5","5+6","6+6"],"female mounting":["1","2","3","4","1+4","2+4","3+4","4+4","1+4+4","2+4+4","3+4+4","4+4+4"],"female holding":["1","2","3","4","5","6","7","4+4","4+5","5+5","5+6","6+6"]};
const POOL = [['meritorious_service_award'], ['commander_commendation_award'], ['cap_achievment_award', 'capub_total_7'], ['cap_leadership_ribbon'], ['cap_membership_ribbon'], ['red_service_ribbon'], ['search_find_ribbon'], ['encampment_ribbon'], ['unit_citation_award'], ['distinguished_service_award'], ['crisis_ribbon'], ['exceptional_service_award'], ['disaster_relief_ribbon'], ['national_commanders_citation']];
const medals = n => HARNESS.ribbonsFrom(POOL, 'senior').filter(r => manifestText.includes(`medal-${r.asset.replace(/^ribbon-/, '')}-miniature`)).slice(0, n)
  .map(r => ({ key: r.key.replace(/^ribbon:/, 'mini:'), title: r.title, ribbonAsset: r.asset, medal: `medal-${r.asset.replace(/^ribbon-/, '')}-miniature`, devices: r.devices, centered: r.centered }));
const compose = (sex, n, style) => P.composeUniform(HARNESS.makeBuild({ uniform: 'semi_formal', gender: sex, membership: 'senior', rank: 'Col', medals: medals(n), opt: { rackColumns: 4, rackArrangement: 'lapel', miniStyle: style } }), store);

const lapelOf = sex => {
  const svg = fs.readFileSync(path.join(root, 'images', 'garments', `garment-corporate-service-dress-blazer-${sex}.svg`), 'utf8');
  const f = /__art"[^>]*transform="translate\(([-\d.]+) ([-\d.]+)\) scale\(([-\d.]+)\)"/.exec(svg), d = new RegExp(`${sex}__lapel-left" d="([^"]+)"`).exec(svg);
  return [...d[1].matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map(m => ({ x: (Number(f[1]) + Number(m[1]) * Number(f[3])) / 100, y: (Number(f[2]) + Number(m[2]) * Number(f[3])) / 100 }));
};
const inside = (q, poly) => { let c = false; for(let i = 0, j = poly.length - 1; i < poly.length; j = i++){ const a = poly[i], b = poly[j]; if(((a.y > q.y) !== (b.y > q.y)) && (q.x < (b.x - a.x) * (q.y - a.y) / (b.y - a.y) + a.x)) c = !c; } return c; };
// the share of a polygon under the lapel, by sampling
const share = (shape, lapel) => {
  const xs = shape.map(q => q.x), ys = shape.map(q => q.y), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  let n = 0, hit = 0;
  for(let i = 0; i < 24; i++) for(let j = 0; j < 48; j++){ const q = { x: x0 + (i + 0.5) * (x1 - x0) / 24, y: y0 + (j + 0.5) * (y1 - y0) / 48 }; if(!inside(q, shape)) continue; n++; if(inside(q, lapel)) hit++; }
  return n ? hit / n : 0;
};
const rect = l => [{ x: l.x, y: l.y }, { x: l.x + l.w, y: l.y }, { x: l.x + l.w, y: l.y + l.h }, { x: l.x, y: l.y + l.h }];

for(const sex of ['male', 'female']) test(`${sex} blazer: for every count 1 to 12, both mountings, the miniature rack slides by the least that clears the lapel, rows and overlap unchanged, inside the limits`, async () => {
  const lapel = lapelOf(sex);
  const slot = (await store.load(`garment-corporate-service-dress-blazer-${sex}`)).raw.landmarks.medal_slot, crest = (slot.x + slot.w / 2) / 100;   // where the rack is centred before any slide
  let slid = 0;
  for(const style of ['mounting', 'holding']) for(let n = 1; n <= 12; n++){
    const tag = `${sex} ${style} ${n}`;
    const scene = await compose(sex, n, style);
    const drapes = scene.layers.filter(l => l.role === 'mini-drape');
    assert.equal(drapes.length, n, `${tag}: the medals`);
    // nothing of the rack under the lapel beyond the hairline
    for(const d of drapes) assert.ok(share(d.clip, lapel) <= 0.005, `${tag}: ${d.key} is clear of the lapel`);
    for(const l of scene.layers.filter(l => l.role === 'mini-medal' || (l.role === 'device' && /^mini:/.test(l.key)))) assert.ok(share(rect(l), lapel) <= 0.02, `${tag}: ${l.key} is clear of the lapel`);
    assert.ok(!scene.notes.some(t => /lapel lies over part of the miniature medals/.test(t)), `${tag}: nothing left to say about the lapel`);
    assert.ok(!scene.notes.some(t => /past the sleeve limit or the shoulder line/.test(t)), `${tag}: inside the sleeve limit and the shoulder line`);
    // the rows as today, with the overlap each row had
    const ys = [...new Set(drapes.map(d => d.y.toFixed(3)))].sort((a, b) => b - a);
    const rows = ys.map(y => drapes.filter(d => d.y.toFixed(3) === y).sort((a, b) => a.x - b.x));
    assert.equal(rows.map(r => r.length).reverse().join('+'), ROWS[`${sex} ${style}`][n - 1], `${tag}: the rows`);
    for(const r of rows){ const steps = r.slice(1).map((d, i) => d.x - r[i].x); if(r.length <= 4) assert.ok(steps.every(s => s >= 11 / 16 - 1e-6), `${tag}: a row of four or fewer is fully exposed`); else assert.ok(steps.every(s => Math.abs(s - steps[0]) < 1e-6), `${tag}: equal overlap`); }
    // the slide: the lowest row's centre against the slot's centre
    const low = rows[0], centre = (Math.min(...low.map(d => d.x)) + Math.max(...low.map(d => d.x + d.w))) / 2;
    const slide = centre - crest, want = NEED[`${sex} ${style}`][n - 1];
    assert.ok(Math.abs(slide - want) < 0.03, `${tag}: slid ${slide.toFixed(3)} in, the rack needs ${want}`);
    if(want === 0) assert.ok(Math.abs(slide) < 1e-6, `${tag}: nothing covered, no slide`);
    else slid++;
  }
  assert.ok(slid > 10, 'the slide is exercised');
});
