'use strict';
// Class A shoulder boards on the shoulder seam (Ethan, 2 November 2026, "looking at the spaatz image, the shoulder boards on class a's should always match the
// shoulder seam. basically cord should be under the shoulder board (if applicable) which should match with the seam"). The seam is the run of the coat sheet's
// outline from the collar seam to the shoulder point (tests/helpers/class-a-sheet.cjs, measured from the shipped sheets). Every board's long axis lies on it with its
// outer end on the shoulder point, following its angle, and the shoulder cord's top end and the aide cord's attachment lie under the board, drawn below it.
//
// Before: the strap the boards followed was the cord assets' strap axis, 0.18 to 0.21 in below the seam on the men's coat and 0.14 to 0.19 in on the women's, at
// 0.2 and 0.7 degrees from its angle, the board's outer end 0.19 in (men) and 0.63 in (women) short of the shoulder point, the cord's top at the shoulder outline
// 0.45 in inboard (men) of the shoulder point and not under the strip on the women's coat.

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
const SHEET = require('./helpers/class-a-sheet.cjs');

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images', 'MANIFEST.json'), 'utf8'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));
const hb = (uniform, gender, membership, rank, cord, opt) => HARNESS.makeBuild({ uniform, gender, membership, rank, cord, name: { first: 'Pat', last: 'Doe', show: true }, opt: Object.assign({ rackColumns: 3, rackArrangement: 'lapel', miniStyle: 'mounting' }, opt || {}) });
const COATS = { blues_a: { male: 'garment-blues-class-a-coat', female: 'garment-blues-class-a-coat-female' }, semi_formal_usaf: { male: 'garment-semiformal-class-a-coat-male', female: 'garment-semiformal-class-a-coat-female' } };
const TOL = 0.01;   // inches

// Signed distance of p from the line a to b.
const across = (p, a, b) => { const L = Math.hypot(b.x - a.x, b.y - a.y); return ((p.x - a.x) * (b.y - a.y) - (p.y - a.y) * (b.x - a.x)) / L; };
const quadOf = l => [[l.x, l.y], [l.x + l.w, l.y], [l.x + l.w, l.y + l.h], [l.x, l.y + l.h]].map(([x, y]) => core.rotatePoint({ x, y }, l.origin || { x: l.x, y: l.y }, l.rotate || 0));
const inside = (p, q) => { let c = false; for(let i = 0, j = q.length - 1; i < q.length; j = i++) if((q[i].y > p.y) !== (q[j].y > p.y) && p.x < (q[j].x - q[i].x) * (p.y - q[i].y) / (q[j].y - q[i].y) + q[i].x) c = !c; return c; };

test('the engine reads the shoulder seam off the sheet\'s outline: the same collar seam and shoulder point as the measured sheets, every coat and side', () => {
  const H = P.helpers;
  for(const coats of Object.values(COATS)) for(const id of Object.values(coats)) for(const side of ['left', 'right']){
    const want = SHEET.seam(id, side), got = H.shoulderSeamOf(id, side);
    assert.ok(got, `${id} ${side}: a seam`);
    assert.ok(Math.hypot(got.neck.x - want.neck.x, got.neck.y - want.neck.y) < 0.002 && Math.hypot(got.outer.x - want.outer.x, got.outer.y - want.outer.y) < 0.002, `${id} ${side}: ${JSON.stringify(got)} against ${JSON.stringify(want)}`);
  }
});

test('cadet officer boards, every cut and both coats: the strip\'s axis lies on the seam (0.01 in), its outer end on the shoulder point and its direction on the seam\'s angle', async () => {
  for(const uniform of ['blues_a', 'semi_formal_usaf']) for(const sex of ['male', 'female']) for(const rank of ['C/2d Lt', 'C/Maj', 'C/Col']){
    const scene = await P.composeUniform(hb(uniform, sex, 'cadet', rank), store);
    for(const side of ['right', 'left']){
      const tag = `${uniform} ${sex} ${rank} ${side}`;
      const sm = SHEET.seam(COATS[uniform][sex], side), strip = scene.layers.find(l => l.key === 'epaulet:' + side);
      const spec = await store.load(strip.id), outer = core.anchor(spec, 'board_outer_end'), button = core.anchor(spec, 'button_end_center');
      assert.ok(Math.hypot(strip.origin.x - sm.outer.x, strip.origin.y - sm.outer.y) <= TOL, `${tag}: the outer end is on the shoulder point`);
      // The board's axis (outer end to the button end) as drawn: the unrotated strip is level, so the axis runs along the strip's turn.
      const dir = core.rotatePoint({ x: button.x - outer.x, y: button.y - outer.y }, { x: 0, y: 0 }, strip.rotate);
      const L = Math.hypot(dir.x, dir.y), tip = { x: strip.origin.x + dir.x / L * 4.55, y: strip.origin.y + dir.y / L * 4.55 };
      assert.ok(Math.abs(across(tip, sm.outer, sm.neck)) <= TOL, `${tag}: the board's far end lies ${across(tip, sm.outer, sm.neck).toFixed(4)} in off the seam`);
      const want = Math.atan2(sm.neck.y - sm.outer.y, sm.neck.x - sm.outer.x), got = Math.atan2(dir.y, dir.x);
      assert.ok(Math.abs(want - got) * 180 / Math.PI < 0.05, `${tag}: the board's angle is the seam's`);
    }
  }
});

test('officers\' strips (senior and general), every coat: the strip\'s centre line on the seam, its outer end at the shoulder point; the strap is drawn on the seam and the overlay\'s own is left off', async () => {
  for(const sex of ['male', 'female']) for(const rank of ['Capt', 'Lt Col', 'Maj Gen']){
    const scene = await P.composeUniform(hb('blues_a', sex, 'senior', rank), store);
    for(const side of ['right', 'left']){
      const tag = `${sex} ${rank} ${side}`;
      const sm = SHEET.seam(COATS.blues_a[sex], side), strip = scene.layers.find(l => l.key === 'epaulet:' + side && l.role === 'epaulet');
      assert.ok(strip, `${tag}: the strip is drawn`);
      // The strip is a level art box turned along the seam (axis the box's long side): its midline must lie on the seam.
      const q = quadOf(strip), mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      const long = strip.w >= strip.h;
      const ends = long ? [mid(q[0], q[3]), mid(q[1], q[2])] : [mid(q[0], q[1]), mid(q[3], q[2])];
      for(const e of ends) assert.ok(Math.abs(across(e, sm.outer, sm.neck)) <= TOL, `${tag}: the strip's axis lies ${across(e, sm.outer, sm.neck).toFixed(4)} in off the seam`);
      const nearOuter = Math.min(...ends.map(e => Math.hypot(e.x - sm.outer.x, e.y - sm.outer.y)));
      assert.ok(nearOuter <= TOL, `${tag}: the strip's outer end is ${nearOuter.toFixed(4)} in from the shoulder point`);
      const strap = scene.layers.find(l => l.key === 'epaulet-strap:' + side);
      assert.ok(strap, `${tag}: the coat's strap is drawn`);
      const sq = strap.points.map(p => ({ x: p.x, y: p.y }));
      assert.ok(Math.abs(across({ x: (sq[0].x + sq[3].x) / 2, y: (sq[0].y + sq[3].y) / 2 }, sm.outer, sm.neck)) <= TOL && Math.abs(across({ x: (sq[1].x + sq[2].x) / 2, y: (sq[1].y + sq[2].y) / 2 }, sm.outer, sm.neck)) <= TOL, `${tag}: the strap is on the seam`);
      const overlay = scene.layers.find(l => l.role === 'garment-layer' && /-(general|senior)-officer$/.test(l.id));
      assert.ok(overlay.hideGroups.includes('epaulet-' + side) && overlay.hideGroups.includes('epaulet-sleeve-' + side), `${tag}: the overlay's own strap and band are hidden`);
    }
  }
});

test('shoulder cord and aide cord: the braid starts on the seam under the board (inside the strip, drawn below it), on both coats and with cadet and senior boards', async () => {
  for(const sex of ['male', 'female']) for(const [membership, rank, cord] of [['cadet', 'C/Col', 'group'], ['cadet', 'C/Maj', 'wing'], ['senior', 'Capt', 'aide_de_camp']]){
    const scene = await P.composeUniform(hb('blues_a', sex, membership, rank, cord), store);
    const tag = `${sex} ${rank} ${cord}`;
    const sm = SHEET.seam(COATS.blues_a[sex], 'left'), strip = scene.layers.find(l => l.key === 'epaulet:left' && l.role === 'epaulet');
    const cl = scene.layers.find(l => l.role === 'garment-layer' && /-cord-/.test(l.id));
    assert.ok(cl && cl.cordPath, `${tag}: the cord is drawn`);
    const top = { x: cl.cordPath.top[0], y: cl.cordPath.top[1] };
    assert.ok(Math.abs(across(top, sm.outer, sm.neck)) <= TOL, `${tag}: the cord's top end lies ${across(top, sm.outer, sm.neck).toFixed(4)} in off the seam`);
    assert.ok(inside(top, quadOf(strip)), `${tag}: the cord's top end is under the strip`);
    const along = ((top.x - sm.outer.x) * (sm.neck.x - sm.outer.x) + (top.y - sm.outer.y) * (sm.neck.y - sm.outer.y)) / Math.hypot(sm.neck.x - sm.outer.x, sm.neck.y - sm.outer.y);
    assert.ok(along >= 0 && along <= 0.3, `${tag}: it starts ${along.toFixed(3)} in inboard of the board's outer end`);
    assert.ok(cl.z < strip.z, `${tag}: drawn below the board (z ${cl.z} against ${strip.z})`);
    if(cord === 'aide_de_camp') assert.equal(cl.cordPath.pendant, true, `${tag}: the aide cord hangs straight down from that attachment`);
  }
});
