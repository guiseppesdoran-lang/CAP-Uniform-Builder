'use strict';
// LIVE7-5 (CAPR 39-1 9.3.4). The Aide de Camp cord overlays carry an aiguillette; the sheet's `aiguillette_pendant` box (loop, whipping, cord and
// tip, hanging from the front of the shoulder down the chest) is a piece the measurement labels keep clear of. Badges, ribbons and nameplates
// keep their regulation places and the cord, drawn above them, lies over any that reach it.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const core = require('../js/engine/core.js');
const G = require('../js/engine/grades.js');
const P = require('../js/engine/profiles.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');
const ML = require('../js/engine/measure-layout.js');
const RA = require('../data/ribbon-awards.js');

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images', 'MANIFEST.json'), 'utf8'));
const read = p => JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'));
const store = () => core.createSpecStore(manifest, p => Promise.resolve(read(p)));
const ribbons = ids => ids.flatMap(id => RA.resolve(id, {}).map((r, i) => ({ key: `ribbon:${id}${i ? '#' + i : ''}`, title: id, asset: 'ribbon-' + id.replace(/_/g, '-'), devices: r.devices, centered: r.centered })));
const build = (uniform, gender, rank, extra) => Object.assign({
  uniform, gender, grade: G.gradeInfo('senior', rank, {}), opt: { headgear: 'auto' }, name: { first: 'Pat', last: 'Doe', show: true },
  ribbons: [], medals: [], badges: [], command: null, militaryBadges: [], patches: [], cord: null
}, extra || {});
const overlap = (a, b) => {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
};

const SHEET = { blues_a: { male: 'garment-blues-class-a-coat', female: 'garment-blues-class-a-coat-female' } };

test('Class A, aide cord: the aiguillette pendant box is kept clear and no measurement label lies on it', async () => {
  const b = build('blues_a', 'male', 'Capt', {
    cord: 'aide_de_camp', ribbons: ribbons(['mitchell_award', 'wright_brothers_award', 'encampment_ribbon', 'red_service_ribbon']),
    badges: [{ id: 'emergency_services_badge' }, { id: 'CAPPilot1_FA9D33EA587D8' }]
  });
  const scene = await P.composeUniform(b, store());
  const sheet = read(`garments/${SHEET.blues_a.male}-cord-aide-de-camp.spec.json`);
  const lm = sheet.landmarks.aiguillette_pendant;
  assert.ok(lm && lm.w_in > 0, 'the sheet states the pendant box');
  const want = { x: lm.x / 100, y: lm.y / 100, w: lm.w_in, h: lm.h_in };
  const clear = scene.layers.filter(l => l.key === 'clear:aiguillette_pendant');
  assert.equal(clear.length, 1, 'the pendant box is in the keep-clear set, once');
  for(const k of ['x', 'y', 'w', 'h']) assert.ok(Math.abs(clear[0][k] - want[k]) < 1e-9, `box ${k}`);
  assert.equal(clear[0].role, 'clear');
  const cord = scene.layers.find(l => /cord-aide-de-camp/.test(l.id || ''));
  assert.ok(cord, 'the aide cord is drawn');
  assert.ok(cord.z < 10, 'the cord stays under the epaulet strip');
  // The measurement labels keep off it.
  const B = scene.bounds;
  const vb = [B.x - 0.4, B.y - 0.4, B.w + 0.8, B.h + 0.8];
  const px = ML.previewPx(vb);
  const drawings = ML.layout(scene, { px, area: { x: vb[0], y: vb[1], w: vb[2], h: vb[3] } });
  assert.ok(drawings.length > 0);
  const tol = (2 * px) ** 2;
  for(const d of drawings) assert.ok(overlap(d.label, want) <= 4 * tol, `${d.label.text} label clear of the aiguillette`);
});

test('no aide cord, no keep-clear box; another cord leaves none either', async () => {
  for(const cord of [null, 'group']){
    const scene = await P.composeUniform(build('blues_a', 'male', 'Capt', { cord }), store());
    assert.ok(!scene.layers.some(l => l.key === 'clear:aiguillette_pendant'), String(cord));
  }
});
