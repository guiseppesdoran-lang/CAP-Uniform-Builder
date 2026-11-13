#!/usr/bin/env node
'use strict';
// Where each picture ends: the reference line of every garment sheet that is cut, read from the sheet's own drawing (its paths), the strip of lower garment the picture shows under it, and
// the line it is cut at, for FRAME_CUT in js/engine/compose.js.
//   node scripts/measure-frame-cut.cjs            prints the FRAME_CUT table and the measurements behind it
//
// The picture shows the top. The lower garment (trousers, skirt, slacks) appears only as a strip under the top's own lowest point:
//   reference line  the lowest point of the top as the sheet draws it: the lower edge of the belt where one is drawn, the lowest point of the top garment's outline (its hem and
//                   its cuffs; where the sheet's outline also holds the lower garment, only the part of it outside the lower garment's own width), whichever is lower;
//   strip           a figure with a belt drawn (the Class B and aviator shirts, the polo's men's cut) shows what the men's picture of the same uniform shows under its line: the
//                   bottom of the men's frame (the cloth footprint the engine frames the sheet by, held to the sheet's box) less the men's line. A figure with NO belt drawn (a coat,
//                   a blazer, an overblouse, the women's polo) shows the strip of the Class A coat, the top worn outside the lower garment, measured the same way on the men's coat. The
//                   mess dress is the one beltless sheet that keeps the men's own strip: the men's mess dress frame is the one the owner has accepted;
//   cut             the line plus the strip, in the sheet's inches from its top.
// A men's picture whose sheet draws a belt, and the men's coat and mess dress, end where their sheets do and have no cut. The men's blazer draws no belt, so it is cut like any other beltless
// figure. tests/engine-frame-cut.test.cjs compares the table in the engine with this output, so an art sync that redraws a sheet fails the test until the table is regenerated.
const fs = require('node:fs');
const path = require('node:path');
const { flatten } = require('./lib-svg-ink.cjs');

const ROOT = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'images', 'MANIFEST.json'), 'utf8'));
const sheetOf = id => manifest.assets.find(a => a.id === id);
const svgOf = id => fs.readFileSync(path.join(ROOT, 'images', sheetOf(id).path), 'utf8');
const r3 = n => Math.round(n * 1000) / 1000;

// ---- the sheet's shapes: every drawn path, rectangle and circle as a polygon in sheet inches, with the ids of the groups that hold it ----
const mul = (a, b) => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
function transformOf(t){
  let m = [1, 0, 0, 1, 0, 0];
  for(const mm of (t || '').matchAll(/(translate|scale|rotate|matrix)\(([^)]*)\)/g)){
    const v = mm[2].split(/[ ,]+/).filter(Boolean).map(Number);
    if(mm[1] === 'translate') m = mul(m, [1, 0, 0, 1, v[0], v[1] || 0]);
    else if(mm[1] === 'scale') m = mul(m, [v[0], 0, 0, v.length > 1 ? v[1] : v[0], 0, 0]);
    else if(mm[1] === 'matrix') m = mul(m, v);
    else { const a = v[0] * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); m = mul(m, [c, s, -s, c, 0, 0]); }
  }
  return m;
}
function shapesOf(svg, opts){
  const out = [], stack = [{ M: [1, 0, 0, 1, 0, 0], ids: [], hidden: false }];
  const re = /<(\/?)(\w+)([^>]*?)(\/?)>/g;
  let m;
  while((m = re.exec(svg))){
    const [, close, tag, attrs, self] = m;
    if(tag === 'metadata' || tag === 'title' || tag === 'defs' || tag === 'clipPath' || tag === 'mask'){
      if(!close && !self){ const e = svg.indexOf('</' + tag + '>', re.lastIndex); re.lastIndex = e + tag.length + 3; }
      continue;
    }
    if(close){ if(tag === 'g') stack.pop(); continue; }
    const cur = stack[stack.length - 1], tr = / transform="([^"]*)"/.exec(attrs), M = tr ? mul(cur.M, transformOf(tr[1])) : cur.M;
    const id = (/ id="([^"]*)"/.exec(attrs) || [])[1], hidden = cur.hidden || / display="none"/.test(attrs);
    if(tag === 'g'){ if(!self) stack.push({ M, ids: id ? [...cur.ids, id] : cur.ids, hidden }); continue; }
    const ids = id ? [...cur.ids, id] : cur.ids, num = k => +((new RegExp(' ' + k + '="([^"]*)"')).exec(attrs) || [0, 0])[1];
    const T = (x, y) => [M[0] * x + M[2] * y + M[4], M[1] * x + M[3] * y + M[5]];
    let rings = [];
    if(tag === 'path'){ const d = / d="([^"]*)"/.exec(attrs); if(d) rings = flatten(d[1], M); }
    else if(tag === 'rect') rings = [[T(num('x'), num('y')), T(num('x') + num('width'), num('y')), T(num('x') + num('width'), num('y') + num('height')), T(num('x'), num('y') + num('height'))]];
    else if(tag === 'circle' || tag === 'ellipse'){
      const rx = tag === 'circle' ? num('r') : num('rx'), ry = tag === 'circle' ? num('r') : num('ry'), pts = [];
      for(let i = 0; i < 48; i++) pts.push(T(num('cx') + rx * Math.cos(i * Math.PI / 24), num('cy') + ry * Math.sin(i * Math.PI / 24)));
      rings = [pts];
    }
    for(const ring of rings) out.push({ ids, hidden, tag, pts: ring.map(([x, y]) => [x / 100, y / 100]) });
  }
  return (opts && opts.hidden) ? out : out.filter(s => !s.hidden);
}
const isId = (s, name) => (s.ids[s.ids.length - 1] || '').endsWith('__' + name);
const inGroup = (s, name) => s.ids.some(i => i.endsWith('__' + name));
const boxOf = list => {
  const xs = list.flatMap(s => s.pts.map(p => p[0])), ys = list.flatMap(s => s.pts.map(p => p[1]));
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
};
const crossings = (ring, x) => {
  const ys = [];
  for(let i = 0; i < ring.length; i++){ const a = ring[i], b = ring[(i + 1) % ring.length]; if((a[0] <= x && b[0] > x) || (b[0] <= x && a[0] > x)) ys.push(a[1] + (x - a[0]) * (b[1] - a[1]) / (b[0] - a[0])); }
  return ys.sort((p, q) => p - q);
};

// ---- the two lower edges of a sheet's top ----
// The belt's lower edge: the strap's own rectangle or path (`strap`: the id of the shape); the women's aviator shirt draws it as one traced shape that also carries the hem's outline,
// so the strap is read from that shape's crossings between the two belt loops, in the belt's own height.
function beltEdge(shapes, spec){
  if(!spec) return -Infinity;
  if(spec.strap) return Math.max(...shapes.filter(s => isId(s, spec.strap)).flatMap(s => s.pts.map(p => p[1])));
  const belt = shapes.filter(s => isId(s, 'belt')).sort((a, b) => b.pts.length - a.pts.length)[0];
  const loops = shapes.filter(s => s.tag === 'rect' && s.ids.length === 2 && !inGroup(s, 'belt-buckle')).map(s => ({ s, b: boxOf([s]) })).filter(l => l.b.y0 > 22 && l.b.y1 < 26 && l.b.x1 - l.b.x0 < 1.2);
  const left = Math.max(...loops.filter(l => l.b.x0 < boxOf([belt]).x0 + (boxOf([belt]).x1 - boxOf([belt]).x0) / 2).map(l => l.b.x1));
  const right = Math.min(...loops.filter(l => l.b.x0 > boxOf([belt]).x0 + (boxOf([belt]).x1 - boxOf([belt]).x0) / 2).map(l => l.b.x0));
  const loopBottom = Math.max(...loops.map(l => l.b.y1));
  let low = -Infinity;
  for(let x = left + 0.05; x < right; x += 0.05){ const ys = crossings(belt.pts, x).filter(y => y < loopBottom + 0.5); if(ys.length >= 2) low = Math.max(low, ys[ys.length - 1]); }
  return low;
}
// The lowest point of the top garment's outline: the sheet's silhouette (`sil`), only what lies outside the lower garment's width where the outline holds the lower garment as well
// (`outside`: the group of the lower garment), or the drawn sleeve seams (`seams`: the long aviator shirts, whose outline holds the trousers or the skirt to the same width).
function outlineEdge(shapes, spec){
  if(!spec) return -Infinity;
  if(spec.seams) return Math.max(...shapes.filter(s => s.ids.some(i => /__seam-sleeve-(right|left)$/.test(i))).flatMap(s => s.pts.map(p => p[1])));
  const sil = shapes.find(s => isId(s, 'silhouette'));
  let pts = sil.pts;
  if(spec.outside){
    const lo = boxOf(shapes.filter(s => inGroup(s, spec.outside)));
    pts = pts.filter(p => p[0] < lo.x0 - 0.3 || p[0] > lo.x1 + 0.3);
  }
  return pts.length ? Math.max(...pts.map(p => p[1])) : -Infinity;
}

// What each sheet draws of the top. `belt`: the strap; `outline`: the top garment's outline. A sheet whose short sleeves end well above the belt has no cuff to state.
const SHEETS = {
  'garment-blues-class-a-coat': { outline: {} },
  'garment-blues-class-a-coat-female': { outline: {} },
  'garment-semiformal-class-a-coat-male': { outline: {} },
  'garment-semiformal-class-a-coat-female': { outline: {} },
  'garment-mess-dress-male': { outline: { outside: 'trousers' } },
  'garment-mess-dress-female': { outline: {} },
  'garment-corporate-service-dress-blazer-male': { outline: {} },
  'garment-corporate-service-dress-blazer-female': { outline: {} },
  'garment-blues-class-b-shirt-male': { belt: { strap: 'belt-strap' }, outline: { outside: 'trousers' } },
  'garment-blues-class-b-shirt-male-long': { belt: { strap: 'belt-strap' }, outline: { outside: 'trousers' } },
  'garment-blues-class-b-blouse-female': { belt: { strap: 'belt-strap' }, outline: { outside: 'lower-skirt' } },
  'garment-blues-class-b-blouse-female-long': { belt: { strap: 'belt-strap' }, outline: { outside: 'lower-skirt' } },
  'garment-aviator-shirt-male': { belt: { strap: 'belt' } },
  'garment-aviator-shirt-male-long': { belt: { strap: 'belt' }, outline: { seams: true } },
  'garment-aviator-shirt-female': { belt: { traced: true } },
  'garment-aviator-shirt-female-long': { belt: { traced: true }, outline: { seams: true } },
  'garment-overblouse-female': { outline: {} },
  'garment-overblouse-female-long': { outline: {} },
  'garment-polo-male': { belt: { strap: 'belt-strap' }, outline: {} },
  'garment-polo-male-long': { belt: { strap: 'belt-strap' }, outline: {} },
  'garment-polo-female': { outline: {} },
  'garment-polo-female-long': { outline: {} }
};

// The women's sheet and the men's sheet of the same uniform (null: none, the overblouse), and the men's sheets that are cut as well.
const PAIRS = [
  ['garment-blues-class-a-coat-female', 'garment-blues-class-a-coat'],
  ['garment-semiformal-class-a-coat-female', 'garment-semiformal-class-a-coat-male'],
  ['garment-mess-dress-female', 'garment-mess-dress-male'],
  ['garment-corporate-service-dress-blazer-female', 'garment-corporate-service-dress-blazer-male'],
  ['garment-blues-class-b-blouse-female', 'garment-blues-class-b-shirt-male'],
  ['garment-blues-class-b-blouse-female-long', 'garment-blues-class-b-shirt-male-long'],
  ['garment-aviator-shirt-female', 'garment-aviator-shirt-male'],
  ['garment-aviator-shirt-female-long', 'garment-aviator-shirt-male-long'],
  ['garment-overblouse-female', null],
  ['garment-overblouse-female-long', null],
  ['garment-polo-female', 'garment-polo-male'],
  ['garment-polo-female-long', 'garment-polo-male-long']
];
const COAT = 'garment-blues-class-a-coat';
// The sheets with no belt that keep the men's own strip: the men's frame is the owner's own measure of it (the men's coat and mess dress frames do not change).
const KEEPS_MEN_STRIP = ['garment-mess-dress-female'];
// The men's sheets that are cut: those with no belt drawn that are not the coat or the mess dress.
const MEN_CUT = ['garment-corporate-service-dress-blazer-male'];

// The reference line of a sheet and the two edges it is the lower of.
function lineOf(id){
  const shapes = shapesOf(svgOf(id)), spec = SHEETS[id];
  const belt = beltEdge(shapes, spec.belt), outline = outlineEdge(shapes, spec.outline);
  return { belt: Number.isFinite(belt) ? belt : null, outline: Number.isFinite(outline) ? outline : null, line: Math.max(belt, outline) };
}

// The bottom of the frame the engine gives a sheet drawn alone: its cloth footprint (measure-layout's GARMENT_FOOTPRINT, which tests/measure-layout.test.cjs holds to the sheets),
// held to the sheet's box; the whole box for a sheet with no footprint.
function frameBottom(id){
  const ML = require('../js/engine/measure-layout.js'), h = sheetOf(id).h_in;
  const boxes = ML.clothBoxes({ layers: [{ type: 'asset', role: 'garment', id, x: 0, y: 0, w: sheetOf(id).w_in, h }] });
  return boxes.length ? Math.min(Math.max(...boxes.map(b => b.y + b.h)), h) : h;
}

// The strip a figure shows, by the one rule: a belt drawn gives the men's strip of its pair, no belt drawn gives the coat's.
function compute(){
  const frame = id => frameBottom(id), line = {};
  const lineCached = id => line[id] || (line[id] = lineOf(id));
  const menStrip = id => frame(id) - lineCached(id).line;
  const coatStrip = menStrip(COAT);
  const rows = [];
  const row = (sheet, man, figure) => {
    const l = lineCached(sheet), belted = l.belt != null;
    let rule = belted ? 'belt' : (KEEPS_MEN_STRIP.includes(sheet) ? 'men' : 'coat');
    if(rule !== 'coat' && !man) throw new Error(`${sheet}: no men's sheet to take the strip from`);
    if(rule === 'belt' && lineCached(man).belt == null) throw new Error(`${sheet} draws a belt and ${man} does not`);
    const strip = rule === 'coat' ? coatStrip : menStrip(man);
    return { sheet, figure, men: man, belt: belted, rule, line: l.line, beltEdge: l.belt, outlineEdge: l.outline, strip, cut: l.line + strip, frame: frame(sheet), sheetH: sheetOf(sheet).h_in,
      menLine: man ? lineCached(man).line : null, menFrame: man ? frame(man) : null, menStrip: man ? menStrip(man) : null };
  };
  for(const [women, man] of PAIRS) rows.push(row(women, man, 'women'));
  for(const man of MEN_CUT){
    const r = row(man, null, 'men');
    if(r.belt) throw new Error(`${man} draws a belt`);
    rows.push(r);
  }
  const table = {};
  for(const r of rows) table[r.sheet] = { line: r3(r.line), strip: r3(r.strip) };
  return { table, rows, coatStrip };
}

module.exports = { compute, lineOf, frameBottom, shapesOf, SHEETS, PAIRS, COAT, KEEPS_MEN_STRIP, MEN_CUT };

if(require.main === module){
  const { table, rows } = compute();
  const f = v => v == null ? '-' : v.toFixed(3);
  for(const r of rows) console.log(r.sheet.padEnd(46), r.figure.padEnd(6), 'belt', r.belt ? 'yes' : 'no ', 'rule', r.rule.padEnd(4), 'line', f(r.line), '(belt', f(r.beltEdge), 'outline', f(r.outlineEdge) + ')', 'strip', f(r.strip), '| cut', f(r.cut), 'frame now', f(r.frame), 'sheet', f(r.sheetH));
  console.log('\n  const FRAME_CUT = {');
  const keys = Object.keys(table);
  keys.forEach((k, i) => console.log(`    '${k}': { line: ${table[k].line}, strip: ${table[k].strip} }${i < keys.length - 1 ? ',' : ''}`));
  console.log('  };');
}
