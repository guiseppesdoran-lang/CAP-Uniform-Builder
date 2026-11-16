'use strict';
// E156: the corporate semi-formal's miniature medals text is printed as CAPR 39-1 4.1.2.4 for the men (a misnumbered copy inside 4.2.1) and 4.2.2.4 for the women;
// ICL 25-02 corrects 4.1.2.4 to 4.2.2.4 and rewrites 4.2.2.4. "4.2.1.4" is not a printed paragraph, so nothing in the engine cites it.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const core = require('../js/engine/core.js');
const P = require('../js/engine/profiles.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');
const HARNESS = require('../scripts/render-builds.cjs');
const ML = require('../js/engine/measure-layout.js');

const root = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images', 'MANIFEST.json'), 'utf8'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));

test('no engine file cites the unprinted paragraph 4.2.1.4', () => {
  const dir = path.join(root, 'js', 'engine');
  const hits = [];
  for(const f of fs.readdirSync(dir).filter(n => /\.js$/.test(n))) fs.readFileSync(path.join(dir, f), 'utf8').split('\n').forEach((l, i) => { if(/\b4\.2\.1\.4\b/.test(l)) hits.push(`${f}:${i + 1}`); });
  assert.deepEqual(hits, []);
});

test('the "crest to medals" measure and the semi-formal notes cite 4.2.2.4 for men and women', async () => {
  for(const gender of ['male', 'female']){
    const b = HARNESS.makeBuild({ uniform: 'semi_formal', gender, membership: 'senior', rank: 'Col', name: { first: 'Pat', last: 'Doran', show: true }, ribbonSel: [['distinguished_service_award'], ['exceptional_service_award'], ['meritorious_service_award'], ['commander_commendation_award']], medalSel: true });
    const scene = await P.composeUniform(b, store);
    const m = scene.layers.filter(l => l.type === 'measure' && /crest to medals/.test((l.opts && l.opts.caption) || ''));
    if(gender === 'female') assert.ok(m.length, 'the women\'s rack draws the crest-to-medals measure');
    for(const l of m) assert.equal(ML.refFor(scene, l), '4.2.2.4', `${gender}: the crest-to-medals measure cites 4.2.2.4`);
    assert.ok(!scene.notes.some(n => /4\.2\.1\.4/.test(n)), `${gender}: no note cites 4.2.1.4: ${scene.notes.join(' | ')}`);
  }
});
