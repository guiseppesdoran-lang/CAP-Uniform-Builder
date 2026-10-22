'use strict';
// FIX-R-OTHER-r4 item 8: the name on the coat's name tape is set from the CAP tape's own lettering.

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

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images', 'MANIFEST.json'), 'utf8'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));
const compose = b => P.composeUniform(b, store);
const hb = (uniform, gender, membership, rank) => HARNESS.makeBuild({ uniform, gender, membership, rank, name: { first: 'Pat', last: 'Doran', show: true }, opt: { rackColumns: 3, rackArrangement: 'lapel', miniStyle: 'mounting' } });
const SHEET = { ocp: 'garment-ocp-coat-abu-cut', abu: 'garment-abu-coat', corporate_field: 'garment-cfu-coat' };

// The CAP tape lettering on a sheet: Arial Bold outlines in a 100 unit em under translate(..) scale(sx sy).
function capLettering(sheet){
  const svg = fs.readFileSync(path.join(root, 'images', 'garments', sheet + '.svg'), 'utf8');
  const i = svg.indexOf(`id="${sheet}__cap-tape-lettering"`);
  assert.ok(i > 0, `${sheet}: cap-tape-lettering group`);
  const seg = svg.slice(i, i + 4000);
  const [, sx, sy] = /scale\(([\d.]+) ([\d.]+)\)/.exec(seg).map(Number);
  // The capital I: 71.58 units tall (glyph y runs up as negative).
  const capUnits = Math.max(...[...seg.matchAll(/M6\.84,-0\.00L6\.84,(-[\d.]+)/g)].map(m => -Number(m[1])));
  return { em: sy * 100, condense: sx / sy, capHeight: capUnits * sy };
}

test('the name on the OCP, ABU and CFU name tape has the CAP tape lettering\'s capital height and condense: the two tapes read as a set (7.1.1.2.3, 5.1.1.1.2.1, 5.2.1.1.2.1)', async () => {
  for(const [uniform, sheet] of Object.entries(SHEET)){
    const want = capLettering(sheet);
    for(const gender of ['male', 'female']){
      const scene = await compose(hb(uniform, gender, 'senior', 'Capt'));
      const t = scene.layers.find(l => l.key === 'text:name_tape');
      assert.ok(t, `${uniform} ${gender}: name on the name tape`);
      const label = `${uniform} ${gender}`;
      assert.ok(Math.abs(t.size - want.em) < 0.005, `${label}: em ${t.size} against the CAP lettering's ${want.em.toFixed(3)}`);
      assert.ok(Math.abs(t.condense - want.condense) < 0.002, `${label}: condense ${t.condense} against ${want.condense.toFixed(4)}`);
      // Arial Bold capitals are 0.716 em tall.
      assert.ok(Math.abs(t.size * 0.716 - want.capHeight) < 0.005, `${label}: capital height ${(t.size * 0.716).toFixed(3)} in against the CAP tape's ${want.capHeight.toFixed(3)} in`);
      assert.equal(t.weight || 700, 700, `${label}: bold, as the lettering`);
    }
  }
});
