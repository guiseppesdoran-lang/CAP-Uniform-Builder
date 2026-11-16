#!/usr/bin/env node
'use strict';
// The footprint of every base garment sheet: where the sheet draws cloth, as horizontal bands of covered intervals in sheet inches,
// for the GARMENT_FOOTPRINT table in js/engine/measure-layout.js. The measurement overlay's magnified callouts (and their captions)
// are set outside it, above the figure or beside it (Ethan: "all magnifying glasses throughout the board shouldn't overlap with the
// uniform or hat, should be above or to the side"). The sheets draw the figure, the flat sleeves beside it, the tapes and patches; the
// cap views the engine hides and re-places on the figure are not part of it (they are boxes of their own, role hat / hat-view).
//   node scripts/measure-garment-footprint.cjs            prints the table
// tests/measure-layout.test.cjs compares the table in the engine with this output, so an art sync that redraws a sheet fails the test
// until the table is regenerated.
const fs = require('node:fs');
const path = require('node:path');
const { polys } = require('./lib-svg-ink.cjs');

const ROOT = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'images', 'MANIFEST.json'), 'utf8'));
const CELL = 0.1;      // raster cell, inches
const BAND = 5;        // cells per band (0.5 in)
const GROW = 1;        // cells added around every ink cell (0.1 in: the outline's stroke and the rasterising)
const IDS = [
  'garment-abu-coat', 'garment-aviator-shirt-female', 'garment-aviator-shirt-female-long', 'garment-aviator-shirt-male', 'garment-aviator-shirt-male-long',
  'garment-blues-class-a-coat', 'garment-blues-class-a-coat-female', 'garment-blues-class-b-blouse-female', 'garment-blues-class-b-blouse-female-long',
  'garment-blues-class-b-shirt-male', 'garment-blues-class-b-shirt-male-long', 'garment-cfdu-flight-suit', 'garment-cfu-coat',
  'garment-corporate-service-dress-blazer-female', 'garment-corporate-service-dress-blazer-male', 'garment-fdu-flight-suit',
  'garment-flight-jacket-blue', 'garment-flight-jacket-green', 'garment-mess-dress-female', 'garment-mess-dress-male', 'garment-ocp-coat-abu-cut',
  'garment-overblouse-female', 'garment-polo-female', 'garment-polo-female-long', 'garment-polo-male', 'garment-polo-male-long',
  'garment-semiformal-class-a-coat-female', 'garment-semiformal-class-a-coat-male'
];

// The sheet's SVG without the cap views, the defs and the metadata (a clip path is not ink).
function inkSvg(svg){
  let s = svg.replace(/<defs>[\s\S]*?<\/defs>/g, '').replace(/<metadata>[\s\S]*?<\/metadata>/g, '');
  for(;;){
    const m = /<g id="[^"]*__hat-[^"]*"[^>]*>/.exec(s);
    if(!m) break;
    let depth = 1, i = m.index + m[0].length;
    const re = /<(\/?)g\b[^>]*?(\/?)>/g;
    re.lastIndex = i;
    for(let t; depth && (t = re.exec(s));){ if(t[2]) continue; depth += t[1] ? -1 : 1; i = re.lastIndex; }
    s = s.slice(0, m.index) + s.slice(i);
  }
  return s;
}

// Even-odd fill of every polygon (one shape each) onto a grid; a cell is ink when its centre lies inside any shape.
function raster(subs, w, h){
  const nx = Math.ceil(w / CELL), ny = Math.ceil(h / CELL), grid = [];
  for(let j = 0; j < ny; j++) grid.push(new Uint8Array(nx));
  for(const p of subs){
    for(let j = 0; j < ny; j++){
      const y = (j + 0.5) * CELL, xs = [];
      for(let i = 0; i < p.length; i++){
        const a = p[i], b = p[(i + 1) % p.length];
        if((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) xs.push(a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
      }
      xs.sort((u, v) => u - v);
      for(let k = 0; k + 1 < xs.length; k += 2){
        for(let i = Math.max(0, Math.ceil(xs[k] / CELL - 0.5)); i < nx && (i + 0.5) * CELL <= xs[k + 1]; i++) grid[j][i] = 1;
      }
    }
  }
  return { grid, nx, ny };
}

function bands({ grid, nx, ny }){
  const out = [];
  for(let b0 = 0; b0 < ny; b0 += BAND){
    const cols = new Uint8Array(nx);
    for(let j = Math.max(0, b0 - GROW); j < Math.min(ny, b0 + BAND + GROW); j++) for(let i = 0; i < nx; i++) if(grid[j][i]) for(let d = -GROW; d <= GROW; d++) if(i + d >= 0 && i + d < nx) cols[i + d] = 1;
    const spans = [];
    for(let i = 0; i < nx; i++){
      if(!cols[i]) continue;
      let k = i; while(k + 1 < nx && cols[k + 1]) k++;
      spans.push(i, k + 1);
      i = k;
    }
    out.push(spans);
  }
  return out;
}

function compute(){
  const out = {};
  for(const id of IDS){
    const a = manifest.assets.find(x => x.id === id);
    const svg = fs.readFileSync(path.join(ROOT, 'images', a.path), 'utf8');
    const m = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg), w = +m[1] / 100, h = +m[2] / 100;
    const subs = polys(inkSvg(svg)).filter(p => p.length > 2).map(p => p.map(([x, y]) => [x / 1, y / 1]));
    // polys() reads the sheet's own user units (0.01 in) under its transforms: bring them to inches.
    out[id] = bands(raster(subs.map(p => p.map(([x, y]) => [x / 100, y / 100])), w, h));
  }
  return out;
}

module.exports = { compute, IDS, CELL, BAND };

if(require.main === module){
  const t = compute();
  // Each band is a list of [start, end] cell pairs flattened: cell = 0.1 in, band = 5 cells = 0.5 in from the sheet's top.
  console.log('  const GARMENT_FOOTPRINT = {');
  const keys = Object.keys(t);
  keys.forEach((k, i) => console.log(`    '${k}': ${JSON.stringify(t[k])}${i < keys.length - 1 ? ',' : ''}`));
  console.log('  };');
}
