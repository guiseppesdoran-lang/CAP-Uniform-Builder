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
const EDGE = require('../scripts/measure-sleeve-edge.cjs').compute();
const EDGE_SX = P.helpers.EDGE_SX;
const FIELD = ['abu', 'corporate_field'];
const distToPolyline = (p, poly) => Math.min(...poly.slice(1).map((b, i) => {
  const a = poly[i], dx = b[0] - a[0], dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p.x - a[0]) * dx + (p.y - a[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p.x - (a[0] + t * dx), p.y - (a[1] + t * dy));
}));
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
    test(`${uniform} ${gender} ${JSON.stringify(opt)} ${rank}: sleeve chevron is the ${size} in art at its own height, shown edge-on on the dress sleeves (SLEEVE1) (${para})`, async () => {
      const scene = await P.composeUniform(build(uniform, gender, 'senior', rank, opt), store);
      const g = G.gradeInfo('senior', rank, {});
      // The flat sleeve views; the ABU and CFU figure's arms carry a narrowed edge-on copy (':edge', FIX-R-OTHER-r2 #7).
      const ids = scene.layers.filter(l => l.role === 'grade' && /^grade:sleeve-/.test(l.key) && !/:edge$/.test(l.key));
      assert.ok(ids.length >= 1, 'at least one sleeve chevron');
      for(const l of ids){
        const spec = await store.load(l.id);
        const white = uniform === 'mess_dress' ? 'white-' : '';
        assert.equal(l.id, `rank-senior-${g.key}-chevron-${white}${size === 3.5 ? '3p5in' : '4in'}`, 'the art for the size');
        // SLEEVE1 (Ethan: "hanging off the side like they do in the utilities"): the dress sleeves show the chevron edge-on on the outer arm, narrowed to EDGE_SX of its regulation width like the ABU and CFU
        // figure's arm; the field sheets' flat sleeve view is the true width. The art is always the regulation size.
        const shown = FIELD.includes(uniform) ? size : size * EDGE_SX;
        assert.ok(Math.abs(l.w - shown) < 0.001, `${l.key}: ${l.w} in wide, regulation ${size} shown at ${shown}`);
        // the art is drawn at its stated width: its own width is the regulation size and the height keeps the art's
        assert.ok(Math.abs(spec.w - size) < 0.001, `${l.id} art width ${spec.w}`);
        assert.ok(Math.abs(l.h - spec.h) < 1e-6, `${l.key}: ${l.h} in tall is the art's ${spec.h}, never shortened`);
        assert.ok(!l.scale || l.scale === 1, 'not scaled');
      }
    });
  }
}

// Where the sheet states the shoulder seam, elbow and the halfway point, the chevron's height is that point's (4.1.5.2.1.2 and the paragraphs above); SLEEVE1: it hangs on the sleeve's outer edge there,
// centred on the edge at that height (the sheet's silhouette, scripts/measure-sleeve-edge.cjs), turned along the edge, narrowed by EDGE_SX and cut to the silhouette.
for(const [uniform, gender, opt, garment] of [
  ['blues_a', 'male', {}, 'garment-blues-class-a-coat'],
  ['blues_a', 'female', {}, 'garment-blues-class-a-coat-female'],
  ['blues_b', 'male', { sleeve: 'long' }, 'garment-blues-class-b-shirt-male-long'],
  ['blues_b', 'male', { sleeve: 'short' }, 'garment-blues-class-b-shirt-male'],
  ['blues_b', 'female', { sleeve: 'long' }, 'garment-blues-class-b-blouse-female-long'],
  ['blues_b', 'female', { sleeve: 'short' }, 'garment-blues-class-b-blouse-female'],
  ['aviator', 'male', { sleeve: 'short' }, 'garment-aviator-shirt-male'],
  ['aviator', 'male', { sleeve: 'long' }, 'garment-aviator-shirt-male-long'],
  ['aviator', 'female', { sleeve: 'short' }, 'garment-aviator-shirt-female'],
  ['aviator', 'female', { sleeve: 'long' }, 'garment-aviator-shirt-female-long'],
  ['aviator', 'female', { sleeve: 'short', femaleTop: 'overblouse' }, 'garment-overblouse-female'],
  ['aviator', 'female', { sleeve: 'long', femaleTop: 'overblouse' }, 'garment-overblouse-female-long'],
  ['mess_dress', 'male', {}, 'garment-mess-dress-male'],
  ['mess_dress', 'female', {}, 'garment-mess-dress-female']
]){
  test(`${uniform} ${gender} ${JSON.stringify(opt)}: sleeve chevron at the chevron_halfway height, centred on the sleeve's outer edge, turned along it, narrowed, cut to the silhouette (SLEEVE1)`, async () => {
    const spec = await store.load(garment);
    for(const rank of ['SSgt', 'TSgt', 'MSgt', 'SMSgt', 'CMSgt']){
      const scene = await P.composeUniform(build(uniform, gender, 'senior', rank, opt), store);
      for(const side of ['right', 'left']){
        const c = core.anchor(spec, 'chevron_halfway_' + side), s = core.anchor(spec, 'shoulder_seam_' + side), e = core.anchor(spec, 'elbow_' + side) || core.anchor(spec, 'sleeve_bottom_' + side);
        const l = gradeLayer(scene, 'grade:sleeve-' + side), edge = EDGE[garment][side];
        assert.ok(l && c && s && e, `${rank} ${side}`);
        assert.equal(l.clipSil, garment, `${rank} ${side}: cut to the garment's own silhouette, so no ink lies past it`);
        const centre = { x: l.x + l.w / 2, y: l.y + l.h / 2 };
        // the height is the sheet's chevron_halfway
        assert.ok(Math.abs(centre.y - c.y) < 0.01, `${rank} ${side}: centre height ${centre.y} vs chevron_halfway ${c.y}`);
        assert.ok(Math.abs(c.y - (s.y + e.y) / 2) < 0.1 || /overblouse/.test(garment), `${side}: anchor ${c.y} in, middle of seam and elbow ${(s.y + e.y) / 2} in`);
        // the centre lies on the sleeve's outer edge (the utilities' test allows 0.05 in); the visual centre of the narrowed art is its box centre
        assert.ok(distToPolyline(centre, edge) < 0.05, `${rank} ${side}: centre ${centre.x.toFixed(2)},${centre.y.toFixed(2)} is ${distToPolyline(centre, edge).toFixed(3)} in from the outer edge`);
        // turned with the edge: clockwise on the wearer's right arm (the picture's left, the edge runs down and out to the left), the other way on the left
        const turn = Math.atan2(-(edge[2][0] - edge[0][0]), edge[2][1] - edge[0][1]) * 180 / Math.PI;
        assert.ok(Math.abs(l.rotate - turn) < 0.01, `${rank} ${side}: turned ${l.rotate} vs the edge's ${turn}`);
        assert.ok(side === 'right' ? l.rotate >= 0 : l.rotate <= 0, `${rank} ${side}: turn ${l.rotate} leans with the sleeve`);
        assert.ok(Math.abs(l.w - (/-4in|4in$/.test(l.id) ? 4 : 3.5) * EDGE_SX) < 0.001, `${rank} ${side}: narrowed to ${EDGE_SX}`);
      }
    }
  });
}

// SLEEVE1: the narrowed chevron hangs on the sleeve's outer edge and the part past the edge is cut by the silhouette clip, so nothing hangs off the shirt into the background (it used to pass the outline by
// 0.27 in on the men's short sleeve and 0.62 in beside the blazer); the centre stays on the garment's own box and the layer carries the clip.
for(const [gender, sleeve] of [['male', 'short'], ['male', 'long'], ['female', 'short'], ['female', 'long']]){
  test(`aviator ${gender} ${sleeve}: the sleeve chevron is clipped to the shirt and its centre lies on the shirt's box`, async () => {
    const scene = await P.composeUniform(build('aviator', gender, 'senior', 'SMSgt', { sleeve }), store);
    const sh = scene.layers.find(l => l.role === 'garment' || /^base:/.test(l.key));
    for(const side of ['right', 'left']){
      const l = gradeLayer(scene, 'grade:sleeve-' + side), cx = l.x + l.w / 2;
      assert.equal(l.clipSil, sh.id, `${side}: clipped to the shirt's silhouette`);
      assert.ok(cx >= sh.x && cx <= sh.x + sh.w, `${side}: centre ${cx.toFixed(2)} in, shirt box ${sh.x}..${sh.x + sh.w}`);
    }
  });
}

// Every dress sleeve chevron (Class A, Class B, aviator shirt, mess dress; men and women) is clipped to the sheet's own
// garment silhouette: the drawn sleeves are narrower than the regulation chevron (the men's Class A coat, 4 in chevron on
// a sleeve about 3.4 in wide at the chevron's upper corners: 14 percent of the box past the outer edge, the critique
// 'fills the upper arm', L1959), so the part past the outer edge wraps round the arm and no ink lands on the white
// beside the coat; the size is never changed (4.1.5.2.1.2, 4.1.9.3.3, 4.1.11.1.1.1.3, 4.1.12.2.3.3, 4.2.5.1.1.3, 4.2.6.2.3).
const CLIPPED = [
  ['blues_a', 'male', {}], ['blues_a', 'female', {}],
  ['blues_b', 'male', { sleeve: 'long' }], ['blues_b', 'male', { sleeve: 'short' }],
  ['blues_b', 'female', { sleeve: 'long' }], ['blues_b', 'female', { sleeve: 'short' }],
  ['aviator', 'male', { sleeve: 'long' }], ['aviator', 'male', { sleeve: 'short' }],
  ['aviator', 'female', { sleeve: 'long' }], ['aviator', 'female', { sleeve: 'short' }],
  ['mess_dress', 'male', {}], ['mess_dress', 'female', {}]
];
for(const [uniform, gender, opt] of CLIPPED){
  test(`${uniform} ${gender} ${JSON.stringify(opt)}: the sleeve chevron carries the sheet's silhouette clip and keeps its size`, async () => {
    for(const rank of ['SMSgt', 'CMSgt']){
      const scene = await P.composeUniform(build(uniform, gender, 'senior', rank, opt), store);
      const garment = scene.layers.find(l => l.role === 'garment');
      for(const side of ['right', 'left']){
        const l = gradeLayer(scene, 'grade:sleeve-' + side);
        assert.equal(l.clipSil, garment.id, `${rank} ${side}: clipped to the garment's own silhouette`);
        assert.ok(l.w === 3.5 * EDGE_SX || l.w === 4 * EDGE_SX, `${rank} ${side}: ${l.w} in is a regulation width narrowed by ${EDGE_SX} (edge-on), never scaled`);
      }
    }
  });
}

// ---- cadet NCO chevrons on the collars -----------------------------------------------------------------
// Figure A5-5 (CAPR 39-1 page 134, 'shirt without necktie'): the chevron lies parallel to the leading edge
// of the collar leaf, the top of the insignia (peak; on C/SSgt the shield's starred canton) toward the roll-line
// end (the shirt's centre side), the rockers toward the collar point, its near outline 1 in from that edge and
// centred on the leaf. On the open collars the sheets draw, the leading edge is the leaf's
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
  // The aviator sheets' pointed collar (art bb1b47a0, LIVE8-1): the polygon is the leaf alone, vertices top end 0, collar point 1, the leading edge's other end 2 (the knot's shoulder on the men's, the front of
  // the neck on the women's), then the neck edge as a curve back to the top end. No roll line lies inside it, so the whole polygon is the leaf, on the short sheets and the long.
  ['aviator', 'male', { sleeve: 'short' }, 'garment-aviator-shirt-male', 1, 2, false],
  ['aviator', 'male', { sleeve: 'long' }, 'garment-aviator-shirt-male-long', 1, 2, false],
  ['aviator', 'female', { sleeve: 'short' }, 'garment-aviator-shirt-female', 1, 2, false],
  ['aviator', 'female', { sleeve: 'long' }, 'garment-aviator-shirt-female-long', 1, 2, false],
  ['aviator', 'female', { sleeve: 'short', femaleTop: 'overblouse' }, 'garment-overblouse-female', 4, 3, false],
  ['aviator', 'female', { sleeve: 'long', femaleTop: 'overblouse' }, 'garment-overblouse-female-long', 4, 3, false]
];
// The ABU and CFU coats are not here any more (LIVE-FIELD B7, D8): their chevron lies along the collar's LEADING edge (the front of the
// collar, 5.1.1.1.1.4 'Insignia is 1 inch from and parallel to the front of the collar', 5.2.1.1.1.6), not along the leaf's short bottom
// edge the shirts' search finds; tests/engine-live-field-collar.test.cjs pins it for both coats, both cuts and both leaves.
// the ranks whose chevron fits the leaf proper on the Class B and aviator sheets, and those that are longer
// along the edge than the leaf is wide at the chevron's centre line (1.5 to 1.75 in against a 1.3 to 1.5 in
// chord; the regulation size is kept, Figure A5-5 'centered on the collar')
const FITTING = ['C/Amn', 'C/SSgt', 'C/TSgt'];
const OVERHANGING = ['C/MSgt', 'C/SMSgt', 'C/CMSgt'];

for(const [uniform, gender, opt, garment, iPoint, iRoll, roll] of COLLAR_CASES){
  for(const rank of FITTING.concat(OVERHANGING)){
    test(`${uniform} ${gender} ${opt.sleeve || ''} ${opt.femaleTop || ''} ${rank} (${garment}): each collar chevron lies along the leaf's bottom edge, top of the insignia (peak, canton) toward the roll end, 1 in from it, centred on the leaf (Figure A5-5)`, async () => {
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
        // (b) the apex (the art's top) points toward the roll-line end, the shirt's centre side; the rockers toward the collar point
        assert.ok(axis.x * e.x + axis.y * e.y < 0, `${side}: apex toward the roll end`);
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
        // The leaves are at true size since the shirt sheets were rescaled about 1.2x (Class B 1.2171, aviator 1.2036): the chord at the
        // chevron's line is 1.88 to 1.97 in, so the 1.5 to 1.75 in chevrons of C/MSgt to C/CMSgt now lie on the leaf too (they overhung
        // the old 1.3 to 1.5 in chord). Which branch applies is read from the geometry, not from the rank.
        if(roll && l.h <= hi - lo + 1e-6){
          // the chevron fits on the leaf proper. Its top (the apex tip) points to the roll end, where the leaf is wide:
          // the apex tip lies inside the triangle within 0.02 in on every sheet. The wing ends (the base corners of its
          // box, toward the collar point) lie inside; toward the collar point the leaf narrows, so the wing ends of the
          // widest chevrons pass the outer edge (limits below).
          const [apexA, apexB, wingA, wingB] = corners;
          const apexTip = { x: (apexA.x + apexB.x) / 2, y: (apexA.y + apexB.y) / 2 };
          assert.ok(inPolygon(apexTip, leaf) || distToPolygon(apexTip, leaf) < 0.02, `${side}: apex tip ${apexTip.x.toFixed(2)},${apexTip.y.toFixed(2)} off the leaf (${distToPolygon(apexTip, leaf).toFixed(3)} in)`);
          // Measured on the true-size leaves: C/CMSgt's wing ends pass the narrowing point of the leaf by 0.10 in on the men's Class B shirts,
          // 0.24 on the aviator shirts and 0.27 on the blouses (0.04 to 0.22 for C/SMSgt, 0 to 0.17 for C/MSgt); C/Amn to C/TSgt lie wholly on it.
          const wingLimit = garment.includes('class-b-shirt-male') ? 0.1 : 0.28;
          for(const pt of [wingA, wingB]) assert.ok(inPolygon(pt, leaf) || distToPolygon(pt, leaf) < wingLimit, `${side}: wing end ${pt.x.toFixed(2)},${pt.y.toFixed(2)} off the leaf (${distToPolygon(pt, leaf).toFixed(3)} in)`);
          // any box corner (the two beside the apex included): the same bounds
          const reach = Math.max(...corners.map(pt => inPolygon(pt, leaf) ? 0 : distToPolygon(pt, leaf)));
          assert.ok(reach < wingLimit, `${side}: a box corner is ${reach.toFixed(3)} in off the leaf`);
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
            // The ABU/CFU leaf holds all three points inside (0.02 in). The overblouse leaf is the small one Figure 4.18 draws
            // (re-measured so its points end on the first button's line and clear the badge worn 1/2 in above the ribbons, 4.2.6.2.7.1;
            // its lower edge is 2.07 in, 3.0 in on the Vanguard-photo leaf it replaced): the chevron 1 in from that edge is taller than the leaf is
            // high, so the wing ends pass the outer edge by up to 0.31 in (C/CMSgt) and the apex tip by up to 0.15 in (C/CMSgt; art
            // follow-up: the regulation size is kept, 4.2.6.2.5).
            // The aviator shirts' pointed collar (art bb1b47a0, estimated dimensions: the regulation draws none): the leaf is a wedge 1.1 to 1.4 in wide along the leading edge at the chevron's line, narrower
            // than the 1.5 to 1.75 in chevrons are long and than the old leaf's 1.9 in, so at the regulation size (4.2.5.1.1.5, 4.2.6.2.5) the chevron's ends pass the leaf. Measured on the four sheets, both
            // leaves: apex tip up to 0.28 in (women's C/TSgt) and wing ends up to 0.48 in for C/Amn to C/TSgt; apex 0.59 in and wing ends 0.80 in for C/MSgt to C/CMSgt (women's C/CMSgt); the men's
            // are 0.1 to 0.15 in less. The bounds are those maxima plus 0.02 in (art follow-up: a wider leaf; the engine keeps the rule and the size).
            const pointed = /aviator-shirt-(male|female)(-long)?$/.test(garment);
            const limit = pointed ? (OVERHANGING.includes(rank) ? (along2 < 0 ? 0.82 : 0.62) : (along2 < 0 ? 0.5 : 0.3))
              : !garment.includes('overblouse') ? 0.02 : along2 < 0 ? 0.32 : 0.15;
            if(pointed) assert.ok(inPolygon({ x: cx, y: cy }, poly), `${side}: the chevron's centre lies on the leaf`);
            assert.ok(inPolygon(pt, poly) || distToPolygon(pt, poly) < limit, `${side}: chevron point ${pt.x.toFixed(2)},${pt.y.toFixed(2)} off the leaf`);
          }
        }
      }
    });
  }
}

test('the collar chevron turn has one sign convention on every sheet: the wearer\'s right collar (left of the picture) turns the art\'s top toward the picture\'s centre, i.e. to the right, the left collar to the left', async () => {
  const seen = new Set();
  for(const [uniform, gender, opt, garment] of COLLAR_CASES){
    const scene = await P.composeUniform(build(uniform, gender, 'cadet', 'C/SSgt', opt), store);
    const r = gradeLayer(scene, 'grade:right'), l = gradeLayer(scene, 'grade:left');
    assert.ok(r.x < l.x, `${garment}: wearer's right chevron is on the left of the picture`);
    // the top of the insignia points toward the roll-line end, the shirt's centre side: the left half of the picture turns right (sin > 0), the right half left
    assert.ok(Math.sin(r.rotate * Math.PI / 180) > 0.5 && Math.sin(l.rotate * Math.PI / 180) < -0.5, `${garment}: ${r.rotate} / ${l.rotate}`);
    assert.ok(r.rotate > -180 && r.rotate <= 180 && l.rotate > -180 && l.rotate <= 180, `${garment}: rotation normalised to (-180, 180]`);
    seen.add(garment);
  }
  assert.equal(seen.size, new Set(COLLAR_CASES.map(c => c[3])).size);
});

// Figure A5-5 ('shirt without necktie', male and female panels): the starred canton of the C/SSgt shield (the
// top of the art) faces the shirt's centre, toward the roll-line end; the round rocker side faces the collar
// point. Pinned from the art's own top_center and the polygon vertices, on every sheet and both collars.
test('the art\'s top_center lands closer to the roll-line end than to the collar point on every collar of every sheet (Figure A5-5)', async () => {
  for(const [uniform, gender, opt, garment, iPoint, iRoll] of COLLAR_CASES){
    const spec = await store.load(garment);
    const scene = await P.composeUniform(build(uniform, gender, 'cadet', 'C/SSgt', opt), store);
    const polys = collarPolygonsOf(garment, spec).sort((a, b) => meanX(a) - meanX(b));
    const art = await store.load(G.cadetNcoChevron(G.gradeInfo('cadet', 'C/SSgt', {}), 'metal'));
    for(const [side, poly] of [['right', polys[0]], ['left', polys[1]]]){
      const l = gradeLayer(scene, 'grade:' + side), r = l.rotate * Math.PI / 180;
      const cx = l.x + l.w / 2, cy = l.y + l.h / 2, up = { x: Math.sin(r), y: -Math.cos(r) };     // the art's top direction after the turn
      const top = { x: cx + up.x * l.h / 2, y: cy + up.y * l.h / 2 };
      const dRoll = Math.hypot(top.x - poly[iRoll].x, top.y - poly[iRoll].y), dPoint = Math.hypot(top.x - poly[iPoint].x, top.y - poly[iPoint].y);
      // the art's top direction runs from the collar point toward the roll end along the leaf's bottom edge; on the small overblouse leaf (Figure 4.18) the centred
      // piece's top is within 0.02 in (0.07 in on the overblouse at its true size, 1.2036) of equally far from both ends, so the turn is pinned by the direction as well as by the distances
      const e = { x: poly[iRoll].x - poly[iPoint].x, y: poly[iRoll].y - poly[iPoint].y }, along = (up.x * e.x + up.y * e.y) / Math.hypot(e.x, e.y);
      assert.ok(along > 0.99, `${garment} ${side}: art top points ${along.toFixed(3)} along the edge toward the roll end`);
      assert.ok(dRoll < dPoint + (garment.includes('overblouse') ? 0.1 : 0), `${garment} ${side}: art top ${dRoll.toFixed(2)} in from the roll end, ${dPoint.toFixed(2)} in from the collar point`);
      assert.ok(art && art.w > 0);
    }
  }
});

// ---- SLEEVE1: the engine's outer-edge table is the sheets' own outline -------------------------------------

test('the engine\'s SLEEVE_EDGE table is the outer edge of the sleeves of the current dress sheets at the chevron height (regenerate with scripts/measure-sleeve-edge.cjs)', () => {
  const src = fs.readFileSync(path.join(root, 'js', 'engine', 'profiles-dress.js'), 'utf8');
  const body = /\/\/ SLEEVE_EDGE begin\n([\s\S]*?)\/\/ SLEEVE_EDGE end/.exec(src);
  assert.ok(body);
  assert.deepEqual(new Function(body[1] + '; return SLEEVE_EDGE;')(), EDGE);
});

test('every dress sheet that carries a senior NCO sleeve chevron has an outer-edge row, on both sides, left of centre for the wearer\'s right (SLEEVE1)', async () => {
  for(const [id, row] of Object.entries(EDGE)){
    const spec = await store.load(id);
    for(const side of ['right', 'left']){
      assert.equal(row[side].length, 3, `${id} ${side}`);
      const c = core.anchor(spec, 'chevron_halfway_' + side);
      assert.ok(Math.abs(row[side][1][1] - c.y) < 0.001, `${id} ${side}: the middle point is at the chevron_halfway height`);
      assert.ok(side === 'right' ? row[side][1][0] < spec.w / 2 && row[side][1][0] < c.x : row[side][1][0] > spec.w / 2 && row[side][1][0] > c.x, `${id} ${side}: the edge lies outside the sleeve's midline anchor`);
    }
  }
});
