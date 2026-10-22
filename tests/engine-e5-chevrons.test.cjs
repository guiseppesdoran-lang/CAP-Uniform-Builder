'use strict';
// E5-CHEVRONS: sleeve chevrons are drawn at the regulation size with the art's own proportions, centred
// halfway between the shoulder seam and the elbow where the sheet states those points; the cadet NCO
// chevrons on the collars lie parallel to the front of the collar, by one rule for every garment.
//   CAPR 39-1 4.1.5.2.1.2 (men's Class A: 4 in), 4.1.9.3.3 (women's Class A: 3 1/2 or 4), 4.1.11.1.1.1.3
//   (men's Class B: 3 1/2 in), 4.1.12.2.3.3 (women's Class B: 3 1/2 or 4), 4.1.1.1.1.4 / 4.1.2.1.1.4 (mess
//   dress: 4 in white / 3 1/2 or 4), 4.2.5.1.1.3 and 4.2.6.2.3 (aviator shirt: 3 1/2 in), 5.1.1.1.1.2 and
//   5.2.1.1.1.3 (ABU, CFU: 3 1/2 or 4); 4.1.11.1.1.1.4, 4.1.12.2.3.5, 4.2.5.1.1.5, 4.2.6.2.5, 5.1.1.1.1.4,
//   5.2.1.1.1 and Figure A5-5 (cadet chevrons "1 inch from and parallel to the front of the collar").

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

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images', 'MANIFEST.json'), 'utf8'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));

function build(uniform, gender, membership, rank, opt){
  return {
    uniform, gender, grade: G.gradeInfo(membership, rank, {}), opt: Object.assign({ headgear: 'auto' }, opt || {}), name: { first: 'Pat', last: 'Doe', show: true },
    ribbons: [], medals: [], badges: [], command: null, militaryBadges: [], patches: [], cord: null
  };
}
const gradeLayer = (scene, side) => scene.layers.find(l => l.role === 'grade' && l.key === side);

// ---- sleeve chevrons: size, proportion, place ----------------------------------------------------------

// [uniform, gender, opt, regulation width in inches, paragraph]
const SLEEVE_CASES = [
  ['blues_a', 'male', {}, 4, '4.1.5.2.1.2'],
  ['blues_a', 'male', { chevron: '3.5' }, 4, '4.1.5.2.1.2 (men: 4 in only)'],
  ['blues_a', 'female', {}, 4, '4.1.9.3.3'],
  ['blues_a', 'female', { chevron: '3.5' }, 3.5, '4.1.9.3.3'],
  ['blues_b', 'male', { sleeve: 'long' }, 3.5, '4.1.11.1.1.1.3'],
  ['blues_b', 'male', { sleeve: 'short', chevron: '4' }, 3.5, '4.1.11.1.1.1.3 (men: 3 1/2 in only)'],
  ['blues_b', 'female', { sleeve: 'long' }, 3.5, '4.1.12.2.3.3'],
  ['blues_b', 'female', { sleeve: 'long', chevron: '4' }, 4, '4.1.12.2.3.3'],
  ['blues_b', 'female', { sleeve: 'short' }, 3.5, '4.1.12.2.3.3'],
  ['mess_dress', 'male', {}, 4, '4.1.1.1.1.4'],
  ['mess_dress', 'female', {}, 4, '4.1.2.1.1.4'],
  ['mess_dress', 'female', { chevron: '3.5' }, 3.5, '4.1.2.1.1.4'],
  ['aviator', 'male', { sleeve: 'long' }, 3.5, '4.2.5.1.1.3'],
  ['aviator', 'male', { sleeve: 'short' }, 3.5, '4.2.5.1.1.3'],
  ['aviator', 'female', { sleeve: 'long' }, 3.5, '4.2.6.2.3'],
  ['aviator', 'female', { sleeve: 'short', femaleTop: 'overblouse' }, 3.5, '4.2.6.2.3'],
  ['abu', 'male', {}, 4, '5.1.1.1.1.2'],
  ['abu', 'female', { chevron: '3.5' }, 3.5, '5.1.1.1.1.2'],
  ['corporate_field', 'male', {}, 4, '5.2.1.1.1.3'],
  ['corporate_field', 'female', { chevron: '3.5' }, 3.5, '5.2.1.1.1.3']
];

for(const [uniform, gender, opt, size, para] of SLEEVE_CASES){
  for(const rank of ['SSgt', 'SMSgt', 'CMSgt']){
    test(`${uniform} ${gender} ${JSON.stringify(opt)} ${rank}: sleeve chevron is ${size} in wide at the art's own proportions, never squeezed (${para})`, async () => {
      const scene = await P.composeUniform(build(uniform, gender, 'senior', rank, opt), store);
      const g = G.gradeInfo('senior', rank, {});
      const ids = scene.layers.filter(l => l.role === 'grade' && /^grade:sleeve-/.test(l.key));
      assert.ok(ids.length >= 1, 'at least one sleeve chevron');
      for(const l of ids){
        const spec = await store.load(l.id);
        const white = uniform === 'mess_dress' ? 'white-' : '';
        assert.equal(l.id, `rank-senior-${g.key}-chevron-${white}${size === 3.5 ? '3p5in' : '4in'}`, 'the art for the size');
        assert.ok(Math.abs(l.w - size) < 0.001, `${l.key}: ${l.w} in wide, regulation ${size}`);
        // the art is drawn at its stated width: its own width is the regulation size and the box keeps its ratio
        assert.ok(Math.abs(spec.w - size) < 0.001, `${l.id} art width ${spec.w}`);
        assert.ok(Math.abs(l.h / l.w - spec.h / spec.w) < 1e-6, `${l.key}: box ${l.w} x ${l.h} keeps the art's ${spec.w} x ${spec.h}`);
        assert.ok(!l.scale || l.scale === 1, 'not scaled');
      }
    });
  }
}

// Where the sheet states the shoulder seam, elbow and the halfway point, the chevron is centred on that
// point and turned to the line from the seam to the elbow (4.1.5.2.1.2 and the paragraphs above).
for(const [uniform, gender, opt, garment] of [
  ['blues_a', 'male', {}, 'garment-blues-class-a-coat'],
  ['blues_a', 'female', {}, 'garment-blues-class-a-coat-female'],
  ['blues_b', 'male', { sleeve: 'long' }, 'garment-blues-class-b-shirt-male-long'],
  ['blues_b', 'female', { sleeve: 'long' }, 'garment-blues-class-b-blouse-female-long']
]){
  test(`${uniform} ${gender}: sleeve chevron centred on the sheet's chevron_halfway point, halfway between the shoulder seam and the elbow`, async () => {
    const spec = await store.load(garment);
    const scene = await P.composeUniform(build(uniform, gender, 'senior', 'SMSgt', opt), store);
    for(const side of ['right', 'left']){
      const c = core.anchor(spec, 'chevron_halfway_' + side), s = core.anchor(spec, 'shoulder_seam_' + side), e = core.anchor(spec, 'elbow_' + side);
      const l = gradeLayer(scene, 'grade:sleeve-' + side);
      assert.ok(l && c && s && e, side);
      assert.ok(Math.hypot(l.x + l.w / 2 - c.x, l.y + l.h / 2 - c.y) < 0.01, `${side}: centre ${l.x + l.w / 2},${l.y + l.h / 2} vs ${c.x},${c.y}`);
      const turn = Math.atan2(s.x - e.x, e.y - s.y) * 180 / Math.PI;
      assert.ok(Math.abs(l.rotate - turn) < 0.01, `${side}: turned ${l.rotate} vs the arm's ${turn}`);
      // halfway down the arm: the anchor's height is the middle of the seam-to-elbow height
      assert.ok(Math.abs(c.y - (s.y + e.y) / 2) < 0.1, `${side}: anchor ${c.y} in, middle of seam and elbow ${(s.y + e.y) / 2} in`);
    }
  });
}

// ---- cadet NCO chevrons on the collars -----------------------------------------------------------------

// Collar polygons of a sheet in inches, one per collar: from the sheet's own collar_<side> landmarks, else
// read from the paths id="<sheet>__collar-right|left" of its SVG with the group transforms applied.
function collarPolygonsOf(garment, spec){
  const own = ['left', 'right'].map(n => core.landmark(spec, 'collar_' + n)).filter(l => l && l.points);
  if(own.length === 2) return own.map(l => l.points);
  const svg = fs.readFileSync(path.join(root, 'images', 'garments', garment + '.svg'), 'utf8');
  const art = new RegExp(`id="${garment}__art" transform="translate\\(([\\d.]+) ([\\d.]+)\\) scale\\(100\\)"`).exec(svg);
  const tx = Number(art[1]), ty = Number(art[2]);
  const out = [];
  for(const side of ['right', 'left']){
    const at = svg.indexOf(`id="${garment}__collar-${side}"`);
    const d = /\sd="([^"]*)"/.exec(svg.slice(at))[1];
    const pts = [...d.matchAll(/[ML]\s*(-?[\d.]+),(-?[\d.]+)/g)].map(m => [Number(m[1]), Number(m[2])]);
    const open = svg.lastIndexOf('<g transform="matrix(', at), close = svg.lastIndexOf('</g>', at);
    const m = open > close ? /matrix\(([-\d. ]+)\)/.exec(svg.slice(open))[1].split(/\s+/).map(Number) : null;
    out.push(pts.map(([x, y]) => {
      if(m){ x = m[0] * x + m[4]; y = m[3] * y + m[5]; }
      return { x: tx / 100 + x, y: ty / 100 + y };
    }));
  }
  return out;
}
const meanX = poly => poly.reduce((s, p) => s + p.x, 0) / poly.length;

// The front edge by the stated rule, written out separately from the engine's helper.
function frontEdge(poly, centerX){
  const top = poly.reduce((a, p) => p.y < a.y ? p : a, poly[0]);
  let bottom = poly[0];
  for(const p of poly){
    const dp = Math.abs(p.x - centerX), db = Math.abs(bottom.x - centerX);
    if(dp < db - 1e-6 || (Math.abs(dp - db) <= 1e-6 && p.y > bottom.y)) bottom = p;
  }
  return { top, bottom };
}

const COLLAR_CASES = [
  ['blues_b', 'male', { sleeve: 'short' }, 'garment-blues-class-b-shirt-male'],
  ['blues_b', 'male', { sleeve: 'long' }, 'garment-blues-class-b-shirt-male-long'],
  ['blues_b', 'female', { sleeve: 'short' }, 'garment-blues-class-b-blouse-female'],
  ['blues_b', 'female', { sleeve: 'long' }, 'garment-blues-class-b-blouse-female-long'],
  ['aviator', 'male', { sleeve: 'short' }, 'garment-aviator-shirt-male'],
  ['aviator', 'male', { sleeve: 'long' }, 'garment-aviator-shirt-male-long'],
  ['aviator', 'female', { sleeve: 'short' }, 'garment-aviator-shirt-female'],
  ['aviator', 'female', { sleeve: 'long' }, 'garment-aviator-shirt-female-long'],
  ['aviator', 'female', { sleeve: 'short', femaleTop: 'overblouse' }, 'garment-overblouse-female'],
  ['aviator', 'female', { sleeve: 'long', femaleTop: 'overblouse' }, 'garment-overblouse-female-long']
];

for(const [uniform, gender, opt, garment] of COLLAR_CASES){
  for(const rank of ['C/SSgt', 'C/CMSgt']){
    test(`${garment} ${rank}: each collar chevron lies parallel to the front of its collar, apex toward the neck end (Figure A5-5)`, async () => {
      const spec = await store.load(garment);
      const scene = await P.composeUniform(build(uniform, gender, 'cadet', rank, opt), store);
      const polys = collarPolygonsOf(garment, spec).sort((a, b) => meanX(a) - meanX(b));   // picture left first
      assert.equal(polys.length, 2);
      const centerX = spec.w / 2;
      // the wearer's right is the collar on the left of the picture
      for(const [side, poly] of [['right', polys[0]], ['left', polys[1]]]){
        const l = gradeLayer(scene, 'grade:' + side);
        assert.ok(l, `${side} chevron`);
        // centred on the sheet's collar point of that side of the picture
        const pts = ['left', 'right'].map(n => core.anchor(spec, 'collar_insignia_' + n)).sort((a, b) => a.x - b.x);
        const at = side === 'right' ? pts[0] : pts[1];
        assert.ok(Math.hypot(l.x + l.w / 2 - at.x, l.y + l.h / 2 - at.y) < 0.01, `${side}: centred on the collar point`);
        // that chevron's axis (its top, apex end, up) against the collar's front edge from its bottom to its top
        const e = frontEdge(poly, centerX);
        const want = Math.atan2(e.top.x - e.bottom.x, e.bottom.y - e.top.y) * 180 / Math.PI;
        assert.ok(Math.abs(l.rotate - want) < 0.01, `${side}: turned ${l.rotate}, front edge ${want}`);
        const r = l.rotate * Math.PI / 180, axis = { x: Math.sin(r), y: -Math.cos(r) };
        const ev = { x: e.top.x - e.bottom.x, y: e.top.y - e.bottom.y }, len = Math.hypot(ev.x, ev.y);
        assert.ok(Math.abs(axis.x * ev.y / len - axis.y * ev.x / len) < 1e-3, `${side}: axis parallel to the edge`);
        assert.ok(axis.x * ev.x + axis.y * ev.y > 0, `${side}: apex toward the neck end`);
        // the top of a collar on the left of the picture leans left, on the right leans right, whatever the sheet calls its sides
        assert.ok(side === 'right' ? l.rotate < 0 : l.rotate > 0, `${side}: ${l.rotate}`);
      }
    });
  }
}

test('ABU and CFU cadet NCO chevrons use the same rule on the sheet\'s measured front edge', async () => {
  for(const [u, garment] of [['abu', 'garment-abu-coat'], ['corporate_field', 'garment-cfu-coat']]){
    const spec = await store.load(garment);
    const scene = await P.composeUniform(build(u, 'male', 'cadet', 'C/SSgt'), store);
    for(const side of ['right', 'left']){
      const fe = spec.raw.collar_slots[side].front_edge;
      const l = gradeLayer(scene, 'grade:' + side);
      const top = { x: fe.p1[0], y: fe.p1[1] }, bottom = { x: fe.p2[0], y: fe.p2[1] };
      const want = Math.atan2(top.x - bottom.x, bottom.y - top.y) * 180 / Math.PI;
      assert.ok(Math.abs(l.rotate - want) < 1e-9, `${u} ${side}: ${l.rotate} vs ${want}`);
      assert.ok(side === 'right' ? l.rotate < 0 : l.rotate > 0, `${u} ${side}`);
    }
  }
});

test('the collar chevron turn has one sign convention on every sheet: the wearer\'s right collar (left of the picture) is turned counter-clockwise', async () => {
  const seen = new Set();
  for(const [uniform, gender, opt, garment] of COLLAR_CASES){
    const scene = await P.composeUniform(build(uniform, gender, 'cadet', 'C/SSgt', opt), store);
    const r = gradeLayer(scene, 'grade:right'), l = gradeLayer(scene, 'grade:left');
    assert.ok(r.x < l.x, `${garment}: wearer's right chevron is on the left of the picture`);
    assert.ok(r.rotate < 0 && l.rotate > 0, `${garment}: ${r.rotate} / ${l.rotate}`);
    seen.add(garment);
  }
  assert.equal(seen.size, COLLAR_CASES.length);
});
