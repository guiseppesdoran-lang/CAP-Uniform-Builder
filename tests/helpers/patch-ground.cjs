'use strict';
// The facts of a patch picture (images/patches/<id>/<id>.png, 8-bit PNG) that tell a ground around the emblem from the emblem alone: how much of the picture's
// edge ring is not clear, how many separate runs of non-clear pixels each edge holds, and how much of the picture is partly clear. Read row by row from the
// inflated data (node's zlib only), so the 5694 x 5999 px emblem does not need a whole-image buffer. "Clear" is alpha under 10, "partly clear" 10 to 244.
const fs = require('node:fs');
const zlib = require('node:zlib');

const CLEAR = 10, SOLID = 245;

function chunks(buf){
  const out = []; let pos = 8;
  while(pos < buf.length){ const len = buf.readUInt32BE(pos); out.push({ type: buf.toString('latin1', pos + 4, pos + 8), data: buf.subarray(pos + 8, pos + 8 + len) }); pos += 12 + len; }
  return out;
}

function pngFacts(file){            // a path, or the bytes of a PNG
  const buf = Buffer.isBuffer(file) ? file : fs.readFileSync(file), cs = chunks(buf), ihdr = cs.find(c => c.type === 'IHDR').data;
  const w = ihdr.readUInt32BE(0), h = ihdr.readUInt32BE(4), depth = ihdr[8], ct = ihdr[9];
  if(depth !== 8 || ihdr[12] !== 0) throw new Error(`${Buffer.isBuffer(file) ? 'png' : file}: only 8-bit, non-interlaced PNGs are read`);
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ct];
  if(!ch) throw new Error(`${Buffer.isBuffer(file) ? 'png' : file}: colour type ${ct}`);
  const trns = (cs.find(c => c.type === 'tRNS') || {}).data;
  const raw = zlib.inflateSync(Buffer.concat(cs.filter(c => c.type === 'IDAT').map(c => c.data))), stride = w * ch;
  const alphaOf = (row, x) => ct === 6 ? row[x * 4 + 3] : ct === 4 ? row[x * 2 + 1] : ct === 3 ? (trns && row[x] < trns.length ? trns[row[x]] : 255) : 255;
  let prev = Buffer.alloc(stride), row = Buffer.alloc(stride);
  const counts = { clear: 0, partial: 0, opaque: 0, light: 0 };
  const edge = { n: 0, nonClear: 0, runs: { top: 0, bottom: 0, left: 0, right: 0 } };
  let leftRun = false, rightRun = false;
  const addEdge = a => { edge.n++; if(a >= CLEAR) edge.nonClear++; };
  for(let y = 0; y < h; y++){
    const f = raw[y * (stride + 1)], src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for(let x = 0; x < stride; x++){
      const a = x >= ch ? row[x - ch] : 0, b = prev[x], c = x >= ch ? prev[x - ch] : 0; let v = src[x];
      if(f === 1) v += a; else if(f === 2) v += b; else if(f === 3) v += (a + b) >> 1;
      else if(f === 4){ const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      row[x] = v & 255;
    }
    for(let x = 0; x < w; x++){
      const a = alphaOf(row, x);
      if(a < CLEAR) counts.clear++; else if(a < SOLID) counts.partial++; else { counts.opaque++; if((ct === 6 || ct === 2) && Math.min(row[x * ch], row[x * ch + 1], row[x * ch + 2]) >= 235) counts.light++; }
    }
    if(y === 0 || y === h - 1){
      let run = false;
      for(let x = 0; x < w; x++){ const nc = alphaOf(row, x) >= CLEAR; addEdge(alphaOf(row, x)); if(nc && !run) edge.runs[y === 0 ? 'top' : 'bottom']++; run = nc; }
    } else {
      const l = alphaOf(row, 0), r = alphaOf(row, w - 1);
      addEdge(l); addEdge(r);
      if(l >= CLEAR && !leftRun) edge.runs.left++; leftRun = l >= CLEAR;
      if(r >= CLEAR && !rightRun) edge.runs.right++; rightRun = r >= CLEAR;
    }
    [prev, row] = [row, prev];
  }
  const total = w * h;
  return { w, h, colourType: ct, edgeShare: edge.nonClear / edge.n, edgeRuns: Math.max(...Object.values(edge.runs)), partialShare: counts.partial / total, nonClearShare: (counts.partial + counts.opaque) / total, lightOpaqueShare: counts.light / total };
}

// What the picture is, by measurement: 'fills' (it fills its box: a flat ground touches the edge, a translucent ground covers it, or the picture is itself a
// rectangle), 'marks' (separate marks at the edge: many runs of non-clear pixels on one edge) or 'emblem' (clear around the emblem alone, whose own rim may
// touch the box). Only a spec that says `artwork.fills_box` may be a 'fills'.
const LIMITS = { edgeShare: 0.30, edgeRuns: 12, partialShare: 0.10, boxShare: 0.98 };
function verdict(f){
  if(f.edgeShare > LIMITS.edgeShare || f.partialShare > LIMITS.partialShare || f.nonClearShare >= LIMITS.boxShare) return 'fills';
  if(f.edgeRuns > LIMITS.edgeRuns) return 'marks';
  return 'emblem';
}

module.exports = { pngFacts, verdict, LIMITS };
