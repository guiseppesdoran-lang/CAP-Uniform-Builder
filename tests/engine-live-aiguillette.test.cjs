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

// Every garment that carries the aide-de-camp overlay (the aiguillette_pendant box is the whole drape since the art sync of LIVE9-ART 2, about 2.4 to 3.6 x 5.9 to 6.2 in, reaching the chest / lapel edge):
// [uniform, gender, opt, sheet id]
const SHEETS = [
  ['blues_a', 'male', {}, 'garment-blues-class-a-coat'],
  ['blues_a', 'female', {}, 'garment-blues-class-a-coat-female'],
  ['blues_b', 'male', { sleeve: 'short' }, 'garment-blues-class-b-shirt-male'],
  ['blues_b', 'male', { sleeve: 'long' }, 'garment-blues-class-b-shirt-male-long'],
  ['blues_b', 'female', { sleeve: 'short' }, 'garment-blues-class-b-blouse-female'],
  ['blues_b', 'female', { sleeve: 'long' }, 'garment-blues-class-b-blouse-female-long']
];

for(const [uniform, gender, opt, sheetId] of SHEETS){
  test(`${uniform} ${gender} ${opt.sleeve || ''}, aide cord: the aiguillette pendant box is kept clear and no measurement label lies on it`, async () => {
    const b = build(uniform, gender, 'Capt', {
      cord: 'aide_de_camp', ribbons: ribbons(['mitchell_award', 'wright_brothers_award', 'encampment_ribbon', 'red_service_ribbon']),
      badges: [{ id: 'emergency_services_badge' }, { id: 'CAPPilot1_FA9D33EA587D8' }],
      opt: Object.assign({ headgear: 'auto' }, opt)
    });
    const scene = await P.composeUniform(b, store());
    const sheet = read(`garments/${sheetId}-cord-aide-de-camp.spec.json`);
    const lm = sheet.landmarks.aiguillette_pendant;
    assert.ok(lm && lm.w_in > 0, 'the sheet states the pendant box');
    const want = { x: lm.x / 100, y: lm.y / 100, w: lm.w_in, h: lm.h_in };
    assert.ok(want.h > 5.5 && want.w > 2.3, `the box is the whole drape (${want.w} x ${want.h} in)`);
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
}

// LIVE9-5: the aiguillette is worn over the coat, so its drape lies over the lapel where the two meet (under the epaulet only), and the lapel-foreground group (drawn above the badges, Z.badge + 0.5)
// would cover it if they overlapped. They do not: rendered with the lapel foreground moved below the cord, the six aide-cord builds (Class A coat and Class B shirt, both sexes) are
// byte-identical PNGs, and the free ends' tips and heads (the drape's part nearest the lapel; `aiguillette_tip.tips`) lie outside the lapel face polygon with at least 0.4 in to spare.
// The cord keeps its place under the epaulet layer (Z.cord + 0.5 = 7.5 < Z.epauletLayer) and the test pins the clearance, so an art change that brought the drape onto a lapel fails here and the cord has
// to be lifted above the lapel foreground (layering call).
test('aide cord: the drape\'s tips and heads stay at least 0.4 in outside the coat\'s lapel faces, so the lapel foreground covers none of the drape (LIVE9-5, CAPR 39-1 9.3.4)', () => {
  for(const sheetId of ['garment-blues-class-a-coat', 'garment-blues-class-a-coat-female', 'garment-semiformal-class-a-coat-male', 'garment-semiformal-class-a-coat-female']){
    const svg = fs.readFileSync(path.join(root, 'images', 'garments', sheetId + '.svg'), 'utf8');
    const t = /__art" transform="translate\(([-\d.]+) ([-\d.]+)\) scale\(([\d.]+)\)/.exec(svg);
    assert.ok(t, sheetId);
    const ov = read(`garments/${sheetId}-cord-aide-de-camp.spec.json`);
    const tips = ov.landmarks.aiguillette_tip.tips;
    assert.equal(tips.length, 2, sheetId);
    for(const side of ['left', 'right']){
      const m = new RegExp(`id="${sheetId}__lapel-face-${side}" d="([^"]+)"`).exec(svg);
      assert.ok(m, `${sheetId}: lapel face ${side}`);
      const poly = [...m[1].matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map(a => ({ x: Number(t[1]) / 100 + Number(a[1]) * Number(t[3]) / 100, y: Number(t[2]) / 100 + Number(a[2]) * Number(t[3]) / 100 }));
      for(const tip of tips) for(const [x, y] of [[tip.x, tip.y], [tip.head_x, tip.head_y]]){
        const pt = { x: x / 100, y: y / 100 };
        let inside = false;
        for(let i = 0, j = poly.length - 1; i < poly.length; j = i++) if((poly[i].y > pt.y) !== (poly[j].y > pt.y) && pt.x < (poly[j].x - poly[i].x) * (pt.y - poly[i].y) / (poly[j].y - poly[i].y) + poly[i].x) inside = !inside;
        assert.ok(!inside, `${sheetId}: a tip point (${pt.x.toFixed(2)}, ${pt.y.toFixed(2)}) lies on the ${side} lapel face`);
        let d = Infinity;
        for(let i = 0; i < poly.length; i++){
          const a = poly[i], b = poly[(i + 1) % poly.length], dx = b.x - a.x, dy = b.y - a.y;
          if(!dx && !dy) continue;
          const u = Math.max(0, Math.min(1, ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / (dx * dx + dy * dy)));
          d = Math.min(d, Math.hypot(pt.x - a.x - u * dx, pt.y - a.y - u * dy));
        }
        assert.ok(d >= 0.4, `${sheetId}: a tip point is ${d.toFixed(2)} in from the ${side} lapel face`);
      }
    }
  }
});

test('no aide cord, no keep-clear box; another cord leaves none either', async () => {
  for(const cord of [null, 'group']){
    const scene = await P.composeUniform(build('blues_a', 'male', 'Capt', { cord }), store());
    assert.ok(!scene.layers.some(l => l.key === 'clear:aiguillette_pendant'), String(cord));
  }
});
