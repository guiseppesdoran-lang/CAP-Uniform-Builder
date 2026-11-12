'use strict';
// A patch picture is the emblem alone, clear around it (the owner, 2026-11-12: "make sure all other patches have the background removed"). Some had a flat
// ground: white at half opacity (a grey box on navy and on the OCP), opaque white, or a dashed line of marks down an edge. tests/helpers/patch-ground.cjs
// measures each shipped PNG (how much of its edge ring is not clear, how many separate runs of non-clear pixels an edge holds, how much of it is partly
// clear), and the picture is either the emblem alone or a rectangle whose spec says so: `artwork.fills_box`, set where the art tree measured it
// (`artwork.fills_box_share`, the share of the box that is not clear). The rule is also run on pictures built to each case, so it is known to fail.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { pngFacts, verdict, LIMITS } = require('./helpers/patch-ground.cjs');

const PATCHES = path.join(__dirname, '..', 'images', 'patches');
const ids = fs.readdirSync(PATCHES).filter(d => fs.existsSync(path.join(PATCHES, d, d + '.png'))).sort();
const specOf = id => JSON.parse(fs.readFileSync(path.join(PATCHES, id, id + '.spec.json'), 'utf8'));

// A PNG made of `pixel(x, y) -> [r, g, b, a]`, as 8-bit RGBA (colour type 6) or RGB (2).
const crcTable = new Uint32Array(256).map((_, n) => { let c = n; for(let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = b => { let c = 0xffffffff; for(const v of b) c = crcTable[(c ^ v) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
function makePng(w, h, pixel, colourType = 6){
  const ch = colourType === 6 ? 4 : 3, raw = Buffer.alloc((w * ch + 1) * h);
  for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){ const p = pixel(x, y); for(let k = 0; k < ch; k++) raw[y * (w * ch + 1) + 1 + x * ch + k] = p[k]; }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = colourType;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const judged = (name, w, h, pixel, colourType) => { const facts = pngFacts(makePng(w, h, pixel, colourType)); return { facts, v: verdict(facts) }; };

const N = 200, BLUE = [20, 40, 120, 255], CLEAR = [0, 0, 0, 0];
const disc = (r, cx = N / 2, cy = N / 2) => (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r ? BLUE : null;

test('the rule: an emblem alone, clear around it, is an emblem, even when its rim touches the box on four sides', () => {
  assert.equal(judged('alone', N, N, (x, y) => disc(80)(x, y) || CLEAR).v, 'emblem');
  assert.equal(judged('rim', N, N, (x, y) => disc(N / 2)(x, y) || CLEAR).v, 'emblem', 'a disc as wide as its box touches the edge at four points only');
});

test('the rule: a flat ground of any kind round the emblem is not an emblem alone: opaque white, white at half opacity, a picture with no alpha at all', () => {
  assert.equal(judged('white', N, N, (x, y) => disc(80)(x, y) || [255, 255, 255, 255]).v, 'fills');
  assert.equal(judged('half', N, N, (x, y) => disc(80)(x, y) || [255, 255, 255, 128]).v, 'fills');
  assert.equal(judged('faint', N, N, (x, y) => disc(80)(x, y) || [255, 255, 255, 40]).v, 'fills', 'a faint ground fills the box too');
  assert.equal(judged('rgb', N, N, (x, y) => disc(80)(x, y) || [255, 255, 255, 255], 2).v, 'fills');
  // a ground that covers a corner or a side only, as a stray white disc in a corner does not reach the edge ring's limit but is still partly clear pixels
  const wide = judged('half-wide', N, N, (x, y) => disc(80)(x, y) || (x < N * 0.45 ? [255, 255, 255, 128] : CLEAR));
  assert.ok(wide.facts.partialShare > LIMITS.partialShare && wide.v === 'fills', 'a translucent ground on part of the box is caught by the partly clear share');
});

test('the rule: separate marks at the edge are caught (a dashed line down one side), a rectangle fills its box', () => {
  assert.equal(judged('dashes', N, N, (x, y) => disc(70)(x, y) || (x >= N - 2 && y % 10 < 8 ? [255, 255, 255, 255] : CLEAR)).v, 'marks');
  assert.equal(judged('few', N, N, (x, y) => disc(70)(x, y) || (x >= N - 2 && y % 100 < 15 ? [255, 255, 255, 255] : CLEAR)).v, 'emblem', 'a few runs are the emblem\'s own rim, not marks');
  assert.equal(judged('rect', N, N / 4, (x, y) => (y === 0 || (x < 3 && y < 3) ? CLEAR : [255, 0, 0, 255])).v, 'fills', 'a tab with rounded corners');
});

test('every shipped patch picture is the emblem alone, or a rectangle whose spec says it fills its box', () => {
  assert.ok(ids.length >= 80, `${ids.length} patch PNGs`);
  let rectangles = 0;
  for(const id of ids){
    const spec = specOf(id), claim = !!(spec.artwork && spec.artwork.fills_box === true), facts = pngFacts(path.join(PATCHES, id, id + '.png')), v = verdict(facts);
    const seen = `${id}: edge ${facts.edgeShare.toFixed(3)} not clear, ${facts.edgeRuns} runs on one edge, ${facts.partialShare.toFixed(3)} partly clear`;
    assert.notEqual(v, 'marks', `${seen}: separate marks at its edge`);
    if(v === 'fills'){ rectangles++; assert.ok(claim, `${seen}: the picture fills its box, so there is a ground round the emblem unless the spec says it is a rectangle (artwork.fills_box)`); }
    else assert.ok(!claim, `${id}: the spec says it fills its box but the picture is clear round an emblem`);
    if(claim) assert.ok(Math.abs(spec.artwork.fills_box_share - facts.nonClearShare) < 0.002, `${id}: fills_box_share ${spec.artwork.fills_box_share} is what was measured (${facts.nonClearShare.toFixed(3)})`);
  }
  assert.ok(rectangles >= 1, 'the Hawk Mountain tabs are the rectangles');
});

test('every shipped patch picture has the size its spec states: pixels, bytes and an aspect that is the spec\'s, so the picture is not stretched', () => {
  for(const id of ids){
    const spec = specOf(id), file = path.join(PATCHES, id, id + '.png'), buf = fs.readFileSync(file), w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
    assert.ok(Math.abs(spec.height_in / spec.width_in - h / w) < 0.002, `${id}: spec ${spec.width_in} x ${spec.height_in} in, picture ${w} x ${h} px`);
    if(spec.artwork && spec.artwork.px) assert.deepEqual(spec.artwork.px, [w, h], `${id}: artwork.px`);
    if(spec.artwork && spec.artwork.bytes) assert.equal(spec.artwork.bytes, buf.length, `${id}: artwork.bytes`);
    if(spec.artwork && spec.artwork.ground_removed) assert.equal(spec.artwork.ground, 'transparent', `${id}: a picture whose ground was removed says its ground is transparent`);
  }
});
