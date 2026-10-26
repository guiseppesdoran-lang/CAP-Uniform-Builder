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

test('silver is darker than a white ribbon, bronze darker than before, gold darker than pale yellow', () => {
  for(const [f, metal] of [['device-star-silver.svg', 'silver'], ['device-star-bronze.svg', 'bronze'], ['device-star-gold.svg', 'gold']]){
    const d = load(f);
    assert.equal(A.deviceMetal(d.inner), metal);
    const out = A.deviceInner(d.inner, 100);
    const lights = [...out.matchAll(/fill="(#[0-9a-f]{6})" opacity="0\.9"/g)].map(m => lum(m[1]));
    assert.ok(lights.length >= 5, f);
    const orig = [...d.inner.matchAll(/fill="(#[0-9a-f]{6})" opacity="0\.9"/g)].map(m => lum(m[1]));
    assert.ok(lights[0] < orig[0] * 0.95, `${f}: lightest facet darkened (${lights[0].toFixed(2)} from ${orig[0].toFixed(2)})`);
  }
  const silver = A.deviceInner(load('device-star-silver.svg').inner, 100);
  const lightest = Math.max(...[...silver.matchAll(/fill="(#[0-9a-f]{6})" opacity="0\.9"/g)].map(m => lum(m[1])));
  assert.ok(lightest < 0.92 && lightest > 0.8, `the silver star's lightest facet (${lightest.toFixed(2)}) is a light silver (0.88 tone), still darker than a white ribbon`);
});

test('the renderer draws every device layer from the edged copy', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'engine', 'render-svg.js'), 'utf8');
  assert.match(src, /deviceInner\(/);
  assert.match(src, /layer\.role === 'device' && deviceSyms\.has\(layer\.id\)/);
});
