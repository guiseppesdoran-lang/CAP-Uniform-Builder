'use strict';
// Ribbon devices must read on any ribbon colour (Doran: "it's still making the devices blend in"). The artwork is
// part transparent and near white for silver, so the renderer draws each device from awards.deviceInner(): darker
// metal, an opaque base under the translucent facets, and a 0.01 in dark edge (#1a1a1a at 70 percent).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const A = require('../js/engine/awards.js');

const DIR = path.join(__dirname, '..', 'images', 'devices');
const files = fs.readdirSync(DIR).filter(f => f.endsWith('.svg'));
const load = f => {
  const t = fs.readFileSync(path.join(DIR, f), 'utf8');
  const root = /^<svg[^>]*>/.exec(t)[0];
  return { inner: t.slice(root.length).replace(/<\/svg>\s*$/, ''), wIn: Number(/width="([\d.]+)in"/.exec(root)[1]), vbW: Number(/viewBox="[\d.\s-]*?\s([\d.]+)\s[\d.]+"/.exec(root)[1]) };
};
const lum = hex => { const n = parseInt(hex.slice(1), 16); return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255; };

test('the edge is 0.01 in, #1a1a1a at 70 percent, and lies outside the device', () => {
  assert.equal(A.DEVICE_EDGE_IN, 0.01);
  assert.equal(A.DEVICE_EDGE_COLOR, '#1a1a1a');
  assert.equal(A.DEVICE_EDGE_OPACITY, 0.7);
  const d = load('device-star-silver.svg');
  const upi = d.vbW / d.wIn;                                   // symbol units per inch (100)
  const out = A.deviceInner(d.inner, upi);
  const edge = /<g opacity="0\.7">([\s\S]*?)<\/g><polygon/.exec(out) || /<g opacity="0\.7">([\s\S]*?)<\/g>/.exec(out);
  assert.ok(edge, 'an edge group at 70 percent');
  const k = 0.23438;                                           // the star's own scale
  const widths = [...edge[1].matchAll(/stroke="#1a1a1a" stroke-width="([\d.]+)"/g)].map(m => Number(m[1]) * k);
  assert.ok(widths.length >= 10);
  for(const w of widths) assert.ok(Math.abs(w - 2 * A.DEVICE_EDGE_IN * upi) < 0.01, `stroke ${w} symbol units = twice the 0.01 in edge (half of it shows)`);
});

test('every device gets the edge, an opaque base and darker metal, with ids that cannot clash with the plain symbol', () => {
  assert.ok(files.length >= 100);
  for(const f of files){
    const d = load(f);
    const out = A.deviceInner(d.inner, d.vbW / d.wIn, '--dev');
    assert.match(out, /<g opacity="0\.7">/, f);
    const ids = [...out.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
    assert.equal(new Set(ids).size, ids.length, `${f}: ids unique`);
    for(const id of ids) assert.ok(id.endsWith('--dev'), `${f}: ${id} carries the suffix`);
    for(const ref of out.matchAll(/url\(#([^)]+)\)/g)) assert.ok(ref[1].endsWith('--dev'), `${f}: reference ${ref[1]}`);
    // The base pass is opaque: flat fills with no opacity attribute, in the metal's mid tone.
    const afterEdge = out.slice(out.indexOf('</g>', out.indexOf('<g opacity="0.7">')));
    assert.match(afterEdge, /fill="#[0-9a-f]{6}"\/>/, `${f}: opaque base`);
  }
});

test('silver is darker than a white ribbon, bronze darker than pale yellow, gold darker than pale yellow', () => {
  for(const [f, metal] of [['device-star-silver.svg', 'silver'], ['device-star-bronze.svg', 'bronze'], ['device-star-gold.svg', 'gold']]){
    const d = load(f);
    assert.equal(A.deviceMetal(d.inner), metal);
    const out = A.deviceInner(d.inner, 100);
    const lights = [...out.matchAll(/fill="(#[0-9a-f]{6})" opacity="0\.9"/g)].map(m => lum(m[1]));
    assert.ok(lights.length >= 5, f);
    const orig = [...d.inner.matchAll(/fill="(#[0-9a-f]{6})" opacity="0\.9"/g)].map(m => lum(m[1]));
    assert.ok(lights[0] < orig[0] * 0.95, `${f}: lightest facet darkened (${lights[0].toFixed(2)} from ${orig[0].toFixed(2)})`);
  }
});

// LIVE10-MASTER-5 (Ethan: "make all of the bronze devices more bronze and silver devices more silver (both lighter)"): silver and bronze are drawn from a palette, not a multiplier.
// Silver: highlights #d8dce3 over a #a9afb8 body, a cool tint (blue above red); the lightest facet was 0.88 x #f4f6f8 = #d6d9db (luminance 0.85) and the body 0.88 x #c3c8ce, #acb0b5.
// Bronze: a copper-bronze, highlights #c8894a over a #9a6630 body, warmer and lighter than the old 0.74 x #e0a374 = #a67956 / 0.74 x #b4713f = #85532f. Gold keeps its 0.8 multiplier.
test('silver devices are lighter and cooler, bronze lighter and warmer, gold untouched (LIVE10-MASTER-5)', () => {
  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const facet = (f, tone) => { const out = A.deviceInner(load(f).inner, 100); return [...out.matchAll(/fill="(#[0-9a-f]{6})" opacity="0\.9"/g)].map(m => m[1])[0]; };
  const bodyOf = f => /<polygon[^>]*fill="(#[0-9a-f]{6})"\/>/.exec(A.deviceInner(load(f).inner, 100).replace(/^[\s\S]*?<\/g>/, ''))[1];
  assert.equal(A.DEVICE_PALETTE.silver['#f4f6f8'], '#d8dce3');
  assert.equal(A.DEVICE_PALETTE.silver['#c3c8ce'], '#a9afb8');
  assert.equal(A.DEVICE_PALETTE.bronze['#e0a374'], '#c8894a');
  assert.equal(A.DEVICE_PALETTE.bronze['#b4713f'], '#9a6630');
  const silver = facet('device-star-silver.svg'), s = hex(silver);
  assert.equal(silver, '#d8dce3');
  assert.ok(s[2] > s[0], 'the silver is cool: blue above red');
  assert.ok(lum(silver) > 0.85 * 0.9 && lum(silver) > lum('#d6d9db') - 0.01 && lum(silver) < 0.92, `the silver star's lightest facet (${lum(silver).toFixed(3)}) is a clear bright silver, a little lighter than the 0.88 tone's 0.85 and still under a white ribbon`);
  assert.equal(bodyOf('device-star-silver.svg'), '#a9afb8', 'the silver body under the facets');
  assert.ok(lum(bodyOf('device-star-silver.svg')) > lum('#acb0b5') - 0.02, 'the silver body is not darker than the old one');
  const bronze = facet('device-star-bronze.svg'), b = hex(bronze);
  assert.equal(bronze, '#c8894a');
  assert.ok(b[0] - b[2] >= 100 && b[0] > b[1] && b[1] > b[2], 'the bronze is a warm copper: red over green over blue, 126 apart');
  assert.ok(lum(bronze) > lum('#a67956') + 0.03, `the bronze star's lightest facet (${lum(bronze).toFixed(3)}) is lighter than the old 0.74 tone's ${lum('#a67956').toFixed(3)}`);
  assert.equal(bodyOf('device-star-bronze.svg'), '#9a6630', 'the bronze body under the facets');
  assert.ok(lum(bodyOf('device-star-bronze.svg')) > lum('#85532f') + 0.03, 'the bronze body is lighter than the old one');
  // Gold is untouched: its ramp times 0.8.
  assert.equal(A.DEVICE_TONE.gold, 0.8);
  assert.equal(facet('device-star-gold.svg'), '#cc c2 86'.replace(/ /g, ''), 'gold 0.8 x #fff2a8');
  // Every silver and bronze device is drawn only from its palette: no colour of the old ramp is left in the copy the renderer draws.
  for(const f of files){
    const d = load(f), metal = A.deviceMetal(d.inner);
    if(!A.DEVICE_PALETTE[metal]) continue;
    // (the group tags of the flat edge and base copies keep the art's own stroke and fill, which every shape inside them overrides)
    const out = A.deviceInner(d.inner, d.vbW / d.wIn, '--dev').replace(/<metadata[\s\S]*?<\/metadata>/, '').replace(/<g\b[^>]*>/g, '<g>');
    const pal = new Set(Object.values(A.DEVICE_PALETTE[metal])), edge = A.DEVICE_EDGE_COLOR;
    for(const m of out.matchAll(/#[0-9a-fA-F]{6}\b/g)) assert.ok(pal.has(m[0].toLowerCase()) || m[0].toLowerCase() === edge, `${f}: ${m[0]} is not in the ${metal} palette`);
  }
});

test('the renderer draws every device layer from the edged copy', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'engine', 'render-svg.js'), 'utf8');
  assert.match(src, /deviceInner\(/);
  assert.match(src, /layer\.role === 'device' && deviceSyms\.has\(layer\.id\)/);
});
