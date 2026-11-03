'use strict';
// LIVE7-5, rewritten for LIVE13 E128 (CAPR 39-1 9.3.4). Ethan: "it falls with gravity... its only one thing, not 2. it should go straight down. not following the
// seam like the cord, but straight down." Doran: "It's putting the cord behind the ribbons". The Aide de Camp cord is ONE braid hung straight down from under the board
// at the top of the armhole seam, ending in its chrome tip: the sheet's measured braid width (dimensions.braid_thickness_in), drop (pendant_drop_in) and tip
// (aiguillette_tip). Its box is a piece the measurement labels keep clear of, and it never meets the ribbon rack (the attachment moves outboard, never the rack).
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
  test(`${uniform} ${gender} ${opt.sleeve || ''}, aide cord: one braid straight down from the top of the seam, the sheet's drop and tip, its box kept clear and no measurement label on it`, async () => {
    const b = build(uniform, gender, 'Capt', {
      cord: 'aide_de_camp', ribbons: ribbons(['mitchell_award', 'wright_brothers_award', 'encampment_ribbon', 'red_service_ribbon']),
      badges: [{ id: 'emergency_services_badge' }, { id: 'CAPPilot1_FA9D33EA587D8' }],
      opt: Object.assign({ headgear: 'auto' }, opt)
    });
    const scene = await P.composeUniform(b, store());
    const sheet = read(`garments/${sheetId}-cord-aide-de-camp.spec.json`);
    const dims = sheet.dimensions, tipLm = sheet.landmarks.aiguillette_tip;
    const cords = scene.layers.filter(l => /cord-aide-de-camp/.test(l.id || ''));
    const braid = cords.find(l => l.cordPath), tip = cords.find(l => /:tip$/.test(l.key));
    assert.equal(cords.length, 2, 'one braid and its tip, nothing else');
    assert.ok(braid && tip, 'the aide cord is drawn as a braid and a tip');
    assert.ok(braid.z < 10 && tip.z < 10, 'the cord stays under the epaulet strip');
    // One vertical braid of the sheet's thickness, drop and tip.
    const cp = braid.cordPath, [A, E] = [cp.top, cp.end];
    assert.equal(cp.pieces.length, 1, 'one straight piece');
    assert.ok(Math.abs(A[0] - E[0]) < 1e-9 && E[1] > A[1], 'straight down with gravity');
    assert.ok(Math.abs(cp.width - (dims.braid_thickness_in + 0.04)) < 1e-9, `the braid is the sheet's ${dims.braid_thickness_in} in with its outline`);
    assert.ok(Math.abs((E[1] - A[1]) + tipLm.len_in - dims.pendant_drop_in) < 1e-9, `the braid and the tip make the sheet's ${dims.pendant_drop_in} in drop`);
    assert.deepEqual(braid.hideGroups, ['aiguillette-loop', 'aiguillette-hang'], 'no loop or second strand');
    assert.deepEqual(tip.onlyGroups, ['aiguillette-tip-long'], 'only the chrome tip of the sheet');
    // The tip's head is at the braid's end and the tip hangs plumb (the sheet's tip is turned from its own hang to the vertical).
    const t = tipLm.tips[1], head = [t.head_x / 100, t.head_y / 100];
    assert.ok(Math.hypot(tip.origin.x - E[0], tip.origin.y - E[1]) < 1e-9 && Math.abs(tip.x - (E[0] - head[0])) < 1e-9, 'the tip head is on the braid end');
    const dir = core.rotatePoint({ x: t.x / 100 + tip.x, y: t.y / 100 + tip.y }, tip.origin, tip.rotate);
    assert.ok(Math.abs(dir.x - E[0]) < 0.001 && dir.y > E[1], `the tip hangs plumb (its point ${dir.x.toFixed(3)} against ${E[0].toFixed(3)})`);
    // The box is kept clear once, and no ribbon or measurement label is on it.
    const clear = scene.layers.filter(l => l.key === 'clear:aiguillette_pendant');
    assert.equal(clear.length, 1, 'the pendant box is in the keep-clear set, once');
    const want = clear[0];
    assert.ok(Math.abs(want.h - dims.pendant_drop_in) < 1e-9 && Math.abs(want.w - (dims.braid_thickness_in + 0.04 + 0.2)) < 1e-9, `box ${want.w} x ${want.h}`);
    assert.equal(want.role, 'clear');
    for(const r of scene.layers.filter(l => l.role === 'ribbon')) assert.equal(overlap(core.layerBounds(r), want), 0, `ribbon ${r.key} is clear of the hanging braid`);
    const B = scene.bounds;
    const vb = [B.x - 0.4, B.y - 0.4, B.w + 0.8, B.h + 0.8];
    const px = ML.previewPx(vb);
    const drawings = ML.layout(scene, { px, area: { x: vb[0], y: vb[1], w: vb[2], h: vb[3] } });
    assert.ok(drawings.length > 0);
    const tol = (2 * px) ** 2;
    for(const d of drawings) assert.ok(overlap(d.label, want) <= 4 * tol, `${d.label.text} label clear of the braid`);
  });
}

function ribbonIds22(){
  const src = fs.readFileSync(path.join(root, 'js', 'catalog.js'), 'utf8');
  const list = Function('return ' + /const ribbonList = (\[[\s\S]*?\n\]);/.exec(src)[1])();
  const have = new Set(manifest.assets.map(a => a.id));
  const ids = list.filter(id => have.has('ribbon-' + String(id).replace(/_/g, '-')) && !/^rotc|military/.test(id)).slice(0, 22);
  assert.equal(ids.length, 22);
  return ids;
}
// Doran's build: the Class A with a full rack. Twenty-two ribbons, the aide cord, both cuts: the braid never touches the rack, and the rack is where it was.
test('aide cord with a 22-ribbon rack on the Class A (men and women): the braid never meets a ribbon and the rack stays put (Doran: "It\'s putting the cord behind the ribbons")', async () => {
  const ids = ribbonIds22();
  for(const gender of ['male', 'female']){
    const withCord = await P.composeUniform(build('blues_a', gender, 'Capt', { cord: 'aide_de_camp', ribbons: ribbons(ids) }), store());
    const without = await P.composeUniform(build('blues_a', gender, 'Capt', { ribbons: ribbons(ids) }), store());
    const rack = scene => scene.layers.filter(l => l.role === 'ribbon').map(l => [l.key, l.x, l.y]);
    assert.deepEqual(rack(withCord), rack(without), `${gender}: the rack does not move for the cord`);
    assert.ok(rack(withCord).length >= 22, `${gender}: ${rack(withCord).length} ribbons`);
    const box = withCord.layers.find(l => l.key === 'clear:aiguillette_pendant');
    for(const r of withCord.layers.filter(l => l.role === 'ribbon')) assert.equal(overlap(core.layerBounds(r), box), 0, `${gender}: ${r.key}`);
    assert.ok(!withCord.notes.some(n => /cannot clear/.test(n)));
  }
});

// The fit guard: where the vertical from the attachment would meet the rack, the attachment moves outboard along the shoulder, never the rack.
test('aide cord fit guard: a braid that would hang over the rack is moved outboard, in 0.05 in steps, and the rack is not moved', async () => {
  const sheet = 'garment-blues-class-a-coat-cord-aide-de-camp.spec.json';
  const moved = core.createSpecStore(manifest, p => { const j = read(p); if(p.endsWith(sheet)) j.landmarks.cord = j.landmarks.cord.map(q => [q[0] - 300, q[1]]); return Promise.resolve(j); });
  const ids = ribbonIds22();
  const plain = await P.composeUniform(build('blues_a', 'male', 'Capt', { cord: 'aide_de_camp', ribbons: ribbons(ids) }), store());
  const scene = await P.composeUniform(build('blues_a', 'male', 'Capt', { cord: 'aide_de_camp', ribbons: ribbons(ids) }), moved);
  const a0 = plain.layers.find(l => l.cordPath).cordPath.top[0], a1 = scene.layers.find(l => l.cordPath).cordPath.top[0];
  const box = scene.layers.find(l => l.key === 'clear:aiguillette_pendant');
  for(const r of scene.layers.filter(l => l.role === 'ribbon')) assert.equal(overlap(core.layerBounds(r), box), 0, 'clear of the rack after the move');
  assert.ok(a1 > a0 - 3 + 0.5, `the attachment moved outboard (${a1.toFixed(2)} from about ${(a0 - 3).toFixed(2)})`);
  assert.deepEqual(scene.layers.filter(l => l.role === 'ribbon').map(l => [l.x, l.y]), plain.layers.filter(l => l.role === 'ribbon').map(l => [l.x, l.y]), 'the rack did not move');
});

// The hanging braid is at the shoulder, far from the lapels: its box lies outside the coat's lapel faces by at least 0.4 in, so the lapel foreground covers none of it.
test('aide cord: the hanging braid\'s box stays at least 0.4 in outside the coat\'s lapel faces (LIVE9-5, CAPR 39-1 9.3.4)', async () => {
  for(const [gender, sheetId] of [['male', 'garment-blues-class-a-coat'], ['female', 'garment-blues-class-a-coat-female']]){
    const scene = await P.composeUniform(build('blues_a', gender, 'Capt', { cord: 'aide_de_camp' }), store());
    const box = scene.layers.find(l => l.key === 'clear:aiguillette_pendant');
    const svg = fs.readFileSync(path.join(root, 'images', 'garments', sheetId + '.svg'), 'utf8');
    const t = /__art" transform="translate\(([-\d.]+) ([-\d.]+)\) scale\(([\d.]+)\)/.exec(svg);
    for(const side of ['left', 'right']){
      const m = new RegExp(`id="${sheetId}__lapel-face-${side}" d="([^"]+)"`).exec(svg);
      assert.ok(m, `${sheetId}: lapel face ${side}`);
      const poly = [...m[1].matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map(a => ({ x: Number(t[1]) / 100 + Number(a[1]) * Number(t[3]) / 100, y: Number(t[2]) / 100 + Number(a[2]) * Number(t[3]) / 100 }));
      const near = (p) => { let d = Infinity; for(let i = 0; i < poly.length; i++){ const a = poly[i], b = poly[(i + 1) % poly.length], dx = b.x - a.x, dy = b.y - a.y; if(!dx && !dy) continue; const u = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy))); d = Math.min(d, Math.hypot(p.x - a.x - u * dx, p.y - a.y - u * dy)); } return d; };
      for(let i = 0; i <= 10; i++) for(const p of [{ x: box.x + box.w * i / 10, y: box.y }, { x: box.x + box.w * i / 10, y: box.y + box.h }, { x: box.x, y: box.y + box.h * i / 10 }, { x: box.x + box.w, y: box.y + box.h * i / 10 }])
        assert.ok(near(p) >= 0.4, `${sheetId}: the box is ${near(p).toFixed(2)} in from the ${side} lapel face`);
    }
  }
});

test('no aide cord, no keep-clear box; another cord leaves none either', async () => {
  for(const cord of [null, 'group']){
    const scene = await P.composeUniform(build('blues_a', 'male', 'Capt', { cord }), store());
    assert.ok(!scene.layers.some(l => l.key === 'clear:aiguillette_pendant'), String(cord));
  }
});
