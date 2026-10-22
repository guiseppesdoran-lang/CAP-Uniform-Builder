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
// Figure A5-5 (CAPR 39-1 page 134, 'shirt without necktie'): the chevron lies parallel to the leading edge
// of the collar leaf, apex (the convex, striped side) toward the collar point, its near outline 1 in from
// that edge and centred on the leaf. On the open collars the sheets draw, the leading edge is the leaf's
// BOTTOM edge, from the collar point (the leaf's outer tip) to where it meets the lapel roll line. The
// checks below read the polygons from the sheets and name the edge by vertex, never through the engine's
// own edge helpers.

// Collar polygons of a sheet in inches, one per collar: from the sheet's own collar_<side> landmarks, else
// read from the leaf paths of its SVG with the group transforms applied (the aviator and overblouse sheets
// name them id="<sheet>__collar-right|left", the ABU and CFU coats draw the leaf as an unnamed five-point
// path in collar-front, starting M+-2.560,-0.430).
function collarPolygonsOf(garment, spec){
  const own = ['left', 'right'].map(n => core.landmark(spec, 'collar_' + n)).filter(l => l && l.points);
  if(own.length === 2) return own.map(l => l.points);
  const svg = fs.readFileSync(path.join(root, 'images', 'garments', garment + '.svg'), 'utf8');
  const art = new RegExp(`id="${garment}__art" transform="translate\\(([\\d.]+) ([\\d.]+)\\) scale\\(100\\)"`).exec(svg);
  const tx = Number(art[1]), ty = Number(art[2]);
  const out = [];
  const coat = /^garment-(abu|cfu)-coat$/.test(garment);
  for(const side of ['right', 'left']){
    const at = coat
      ? svg.indexOf(side === 'left' ? 'd="M2.560,-0.430 L3.800,1.280' : 'd="M-2.560,-0.430 L-3.800,1.280')
      : svg.indexOf(`id="${garment}__collar-${side}"`);
    assert.ok(at > 0, `${garment}: ${side} collar path`);
    const d = /\sd="([^"]*)"/.exec(svg.slice(at - (coat ? 1 : 0)))[1];
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
function inPolygon(pt, poly){
  let c = false;
  for(let i = 0, j = poly.length - 1; i < poly.length; j = i++){
    const a = poly[i], b = poly[j];
    if((a.y > pt.y) !== (b.y > pt.y) && pt.x < (b.x - a.x) * (pt.y - a.y) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}

function distToPolygon(pt, poly){
  let best = Infinity;
  for(let i = 0; i < poly.length; i++){
    const a = poly[i], b = poly[(i + 1) % poly.length], dx = b.x - a.x, dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / (dx * dx + dy * dy)));
    best = Math.min(best, Math.hypot(pt.x - a.x - t * dx, pt.y - a.y - t * dy));
  }
  return best;
}

// [uniform, gender, options, sheet, vertex of the collar point, vertex of the roll-line end, roll line] for
// the leaf on the LEFT of the picture (the wearer's right); the right leaf mirrors it by its own polygon
// (same vertex order: the figure's bottom edge runs between these two vertices of each leaf). `roll` is
// true on the sheets that draw the roll line from the polygon's top vertex (vertex 0) down to the roll
// end (Class B and aviator shirt, checked in the SVG): the polygon then also takes in the band between
// the roll line and the neck opening, and the collar leaf proper is the triangle vertex 0, collar point,
// roll end. The overblouse kite and the ABU/CFU five-point leaf draw no such line: the leaf is the whole
// polygon.
const COLLAR_CASES = [
  ['blues_b', 'male', { sleeve: 'short' }, 'garment-blues-class-b-shirt-male', 1, 2, true],
  ['blues_b', 'male', { sleeve: 'long' }, 'garment-blues-class-b-shirt-male-long', 1, 2, true],
  ['blues_b', 'female', { sleeve: 'short' }, 'garment-blues-class-b-blouse-female', 1, 2, true],
  ['blues_b', 'female', { sleeve: 'long' }, 'garment-blues-class-b-blouse-female-long', 1, 2, true],
  ['aviator', 'male', { sleeve: 'short' }, 'garment-aviator-shirt-male', 1, 2, true],
  ['aviator', 'male', { sleeve: 'long' }, 'garment-aviator-shirt-male-long', 1, 2, true],
  ['aviator', 'female', { sleeve: 'short' }, 'garment-aviator-shirt-female', 1, 2, true],
  ['aviator', 'female', { sleeve: 'long' }, 'garment-aviator-shirt-female-long', 1, 2, true],
  ['aviator', 'female', { sleeve: 'short', femaleTop: 'overblouse' }, 'garment-overblouse-female', 4, 3, false],
  ['aviator', 'female', { sleeve: 'long', femaleTop: 'overblouse' }, 'garment-overblouse-female-long', 4, 3, false],
  ['abu', 'male', {}, 'garment-abu-coat', 2, 3, false],
  ['abu', 'female', {}, 'garment-abu-coat', 2, 3, false],
  ['corporate_field', 'male', {}, 'garment-cfu-coat', 2, 3, false],
  ['corporate_field', 'female', {}, 'garment-cfu-coat', 2, 3, false]
];
// the ranks whose chevron fits the leaf proper on the Class B and aviator sheets, and those that are longer
// along the edge than the leaf is wide at the chevron's centre line (1.5 to 1.75 in against a 1.3 to 1.5 in
// chord; the regulation size is kept, Figure A5-5 'centered on the collar')
const FITTING = ['C/Amn', 'C/SSgt', 'C/TSgt'];
const OVERHANGING = ['C/MSgt', 'C/SMSgt', 'C/CMSgt'];

for(const [uniform, gender, opt, garment, iPoint, iRoll, roll] of COLLAR_CASES){
  for(const rank of FITTING.concat(OVERHANGING)){
    test(`${uniform} ${gender} ${opt.sleeve || ''} ${opt.femaleTop || ''} ${rank} (${garment}): each collar chevron lies along the leaf's bottom edge, apex to the collar point, 1 in from it, centred on the leaf (Figure A5-5)`, async () => {
      const spec = await store.load(garment);
      const scene = await P.composeUniform(build(uniform, gender, 'cadet', rank, opt), store);
      const polys = collarPolygonsOf(garment, spec).sort((a, b) => meanX(a) - meanX(b));   // picture left first
      assert.equal(polys.length, 2);
      const w = (await store.load(G.cadetNcoChevron(G.gradeInfo('cadet', rank, {}), 'metal'))).w;
      for(const [side, poly] of [['right', polys[0]], ['left', polys[1]]]){   // the wearer's right is the collar on the left of the picture
        const l = gradeLayer(scene, 'grade:' + side);
        assert.ok(l, `${side} chevron`);
        // the figure's leading edge, from the polygon's own vertices
        const cp = poly[iPoint], re = poly[iRoll];
        // the collar leaf proper: the triangle top vertex / collar point / roll end where the sheet draws the roll line
        const leaf = roll ? [poly[0], cp, re] : poly;
        const ev = { x: cp.x - re.x, y: cp.y - re.y }, len = Math.hypot(ev.x, ev.y), e = { x: ev.x / len, y: ev.y / len };
        // (a) the chevron's axis (apex-up piece turned by `rotate`, clockwise) lies within 1 deg of the edge
        const r = l.rotate * Math.PI / 180, axis = { x: Math.sin(r), y: -Math.cos(r) };
        const off = Math.acos(Math.min(1, Math.abs(axis.x * e.x + axis.y * e.y))) * 180 / Math.PI;
        assert.ok(off < 1, `${side}: axis ${off.toFixed(2)} deg off the bottom edge`);
        // (b) the apex points toward the collar point
        assert.ok(axis.x * e.x + axis.y * e.y > 0, `${side}: apex toward the collar point`);
        // (c) the rotated box of the chevron (its width across the edge, its height along it)
        const cx = l.x + l.w / 2, cy = l.y + l.h / 2;
        assert.ok(Math.abs(l.w - w) < 1e-6, 'width is the art\'s');
        // the leaf lies above its bottom edge: take the edge's unit normal that points up the picture
        let n = { x: -e.y, y: e.x };
        const sgn = n.y < 0 ? 1 : -1;
        const perp = (cx - cp.x) * n.x * sgn + (cy - cp.y) * n.y * sgn;     // centre's distance from the edge line, on the leaf's side
        // the outline nearest the edge sits 1 in from it: the box is `w` wide across the edge
        assert.ok(Math.abs(perp - w / 2 - 1) < 0.05, `${side}: nearest outline ${(perp - w / 2).toFixed(3)} in from the edge`);
        // centred on the leaf: the centre's place along the edge is the middle of the leaf's chord on the line the centre runs along
        const hits = [];
        for(let i = 0; i < leaf.length; i++){
          const p = leaf[i], q = leaf[(i + 1) % leaf.length];
          const dp = (p.x - cp.x) * n.x * sgn + (p.y - cp.y) * n.y * sgn, dq = (q.x - cp.x) * n.x * sgn + (q.y - cp.y) * n.y * sgn;
          if((dp - perp) * (dq - perp) > 0 || dp === dq) continue;
          const t = (perp - dp) / (dq - dp);
          hits.push((p.x + t * (q.x - p.x) - cp.x) * e.x + (p.y + t * (q.y - p.y) - cp.y) * e.y);
        }
        assert.ok(hits.length >= 2, `${side}: the chevron's line crosses the leaf`);
        const lo = Math.min(...hits), hi = Math.max(...hits), mid = (lo + hi) / 2;
        const along = (cx - cp.x) * e.x + (cy - cp.y) * e.y;
        assert.ok(Math.abs(along - mid) < 0.05, `${side}: centred on the leaf, ${along.toFixed(2)} vs ${mid.toFixed(2)}`);
        const corners = [[1, -1], [1, 1], [-1, -1], [-1, 1]].map(([a, c]) => ({ x: cx + axis.x * a * l.h / 2 + (-axis.y) * c * l.w / 2, y: cy + axis.y * a * l.h / 2 + axis.x * c * l.w / 2 }));
        if(roll && FITTING.includes(rank)){
          // the chevron fits on the leaf proper: the apex tip and the two wing ends (the base corners of its box) lie
          // inside the triangle within 0.02 in
          const [apexA, apexB, wingA, wingB] = corners;
          for(const [what, pt] of [['apex tip', { x: (apexA.x + apexB.x) / 2, y: (apexA.y + apexB.y) / 2 }], ['wing end', wingA], ['wing end', wingB]]) assert.ok(inPolygon(pt, leaf) || distToPolygon(pt, leaf) < 0.02, `${side}: ${what} ${pt.x.toFixed(2)},${pt.y.toFixed(2)} off the leaf (${distToPolygon(pt, leaf).toFixed(3)} in)`);
          // The box corner beside the apex, on the side of the leaf's top vertex, is the one that can pass the outer
          // edge: centred on the chord at the chevron's centre line, the chord is shorter one chevron width further
          // up the leaf (the outer edge leans in). Men's Class B: within 0.02 in. Women's Class B and both aviator
          // sheets: up to 0.21 in for C/TSgt (recorded in DECISIONS; the leaf is narrower than the chevron needs).
          const reach = Math.max(...corners.map(pt => inPolygon(pt, leaf) ? 0 : distToPolygon(pt, leaf)));
          assert.ok(reach < (garment.includes('class-b-shirt-male') ? 0.02 : 0.25), `${side}: a box corner is ${reach.toFixed(3)} in off the leaf`);
        }else if(roll){
          // longer than the leaf is wide here: the same overhang past the outer edge and past the roll line
          const half = l.h / 2, past = ((cx - cp.x) * e.x + (cy - cp.y) * e.y);
          const outer = (lo - (past - half)), rollSide = ((past + half) - hi);
          assert.ok(half * 2 > hi - lo, `${rank} (${(2 * half).toFixed(2)} in) is longer than the leaf chord (${(hi - lo).toFixed(2)} in)`);
          assert.ok(Math.abs(outer - rollSide) < 0.05, `${side}: overhang ${outer.toFixed(3)} in at the outer edge vs ${rollSide.toFixed(3)} in at the roll line`);
        }else{
          // the chevron lies on the collar leaf: its apex tip and the two wing ends (the base corners of its box;
          // the box corners beside the apex are empty, the apex being the arch)
          for(const [along2, across] of [[1, 0], [-1, -1], [-1, 1]]){
            const pt = { x: cx + axis.x * along2 * l.h / 2 + (-axis.y) * across * l.w / 2, y: cy + axis.y * along2 * l.h / 2 + axis.x * across * l.w / 2 };
            // within 0.1 in: the Chief's 1.75 in chevron reaches the leaf's neck edge on the overblouse (by 0.02 in)
            assert.ok(inPolygon(pt, poly) || distToPolygon(pt, poly) < 0.1, `${side}: chevron point ${pt.x.toFixed(2)},${pt.y.toFixed(2)} off the leaf`);
          }
        }
      }
    });
  }
}

test('the collar chevron turn has one sign convention on every sheet: the wearer\'s right collar (left of the picture) apex turns out to the left, the left collar to the right', async () => {
  const seen = new Set();
  for(const [uniform, gender, opt, garment] of COLLAR_CASES){
    const scene = await P.composeUniform(build(uniform, gender, 'cadet', 'C/SSgt', opt), store);
    const r = gradeLayer(scene, 'grade:right'), l = gradeLayer(scene, 'grade:left');
    assert.ok(r.x < l.x, `${garment}: wearer's right chevron is on the left of the picture`);
    // the apex points toward the shoulder side of each picture half: left half turns left (sin < 0), right half turns right
    assert.ok(Math.sin(r.rotate * Math.PI / 180) < -0.5 && Math.sin(l.rotate * Math.PI / 180) > 0.5, `${garment}: ${r.rotate} / ${l.rotate}`);
    seen.add(garment);
  }
  assert.equal(seen.size, new Set(COLLAR_CASES.map(c => c[3])).size);
});
