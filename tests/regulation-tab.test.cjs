'use strict';
// The Extra step's Regulation tab: for the current build, every rule the engine applied (the caption, the inch value, the CAPR 39-1 paragraph and the ICL where one
// is cited), by area, as a compact table. It lists the same distances the measurement overlay would draw, which this test reads through measure-layout.js's catalogue.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const core = require('../js/engine/core.js');
const P = require('../js/engine/profiles.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');
require('../js/engine/profiles-polo.js');
const ML = require('../js/engine/measure-layout.js');
const MP = require('../js/measure-panel.js');
const R = require('../scripts/render-builds.cjs');

const manifest = JSON.parse(read('images/MANIFEST.json'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));
const MATRIX = R.matrix().builds;
const compose = name => { const b = MATRIX.find(x => x.name === name); assert.ok(b, name); return P.composeUniform(R.makeBuild(JSON.parse(JSON.stringify(b.build))), store); };

// The overlay's own layout of a scene, as the page lays it out (render-svg.js: the scene as filterScene leaves it).
function laidOut(scene, choice){
  const shown = ML.filterScene(scene, choice || {});
  const B = scene.bounds, vb = [B.x - 0.4, B.y - 0.4, B.w + 0.8, B.h + 0.8], px = ML.previewPx(vb);
  return ML.layout(shown, { px, area: { x: vb[0], y: vb[1], w: vb[2], h: vb[3] }, calloutArea: ML.calloutRoom(vb, px) });
}
// The words on a drawn callout (the pill's caption lines, or the magnified callout's).
const wordsOf = d => ((d.callout ? (d.callout.caption && d.callout.caption.lines) : (d.label && d.label.caption)) || []).join(' ').replace(/\s+/g, ' ');

// The builds of the standard matrix that draw the most kinds of distance: a Class A with a full rack, an ABU, an OCP, a flight suit, a mess dress.
const BUILDS = ['blues_a-male-senior-Capt', 'blues_a-female-senior-SMSgt', 'blues_b-male-cadet-C-SSgt', 'abu-male-senior-Capt', 'ocp-male-senior-Capt', 'flight_suit-male-senior-Capt',
  'mess_dress-male-senior-Col', 'aviator-female-senior-Capt', 'semi_formal-female-senior-Col', 'polo-male-senior-Capt', 'corporate_field-female-senior-Capt'];

test('the Regulation tab lists the same set the overlay draws, with each one\'s paragraph', async () => {
  for(const name of BUILDS){
    const scene = await compose(name);
    const cat = ML.catalogue(scene);
    const drawn = laidOut(scene).map(d => d.key).sort();
    assert.deepEqual(cat.entries.flatMap(e => e.keys).sort(), drawn, `${name}: the list is what the overlay draws`);
    const html = MP.regulationHtml(cat);
    for(const e of cat.entries){
      assert.ok(html.includes(MP.esc(e.name)), `${name}: ${e.name} is listed`);
      assert.ok(e.ref, `${name}: ${e.name} has a paragraph`);
      const p = ML.refParts(e.ref);
      assert.ok(html.includes(MP.esc(p.capr)), `${name}: ${e.name} lists ${p.capr}`);
      if(p.icl) assert.ok(html.includes(MP.esc(p.icl)), `${name}: ${e.name} lists ${p.icl}`);
    }
    assert.equal((html.match(/<th scope="row">/g) || []).length, cat.entries.length, `${name}: one row per distance`);
    assert.match(html, /CAPR 39-1 with ICL 26-14/);
  }
});

test('the Regulation tab states the ICL a rule cites as its own line', async () => {
  const cat = ML.catalogue(await compose('ocp-male-senior-Capt'));
  const e = cat.entries.find(x => /ICL/.test(x.ref));
  assert.ok(e, 'the OCP cap grade cites an ICL');
  assert.deepEqual(ML.refParts('7.1.1.8, ICL 25-02 6.2.11.1'), { capr: '7.1.1.8', icl: 'ICL 25-02 6.2.11.1' });
  assert.deepEqual(ML.refParts('4.1.5.2'), { capr: '4.1.5.2', icl: '' });
  assert.match(MP.regulationHtml(cat), /<span class="regIcl">ICL 25-02 6\.2\.11\.1<\/span>/);
});

test('the Extra step has two tabs; the Regulation list sits in the second, out of the way of the first', () => {
  const html = read('index.html'), css = read('styles/app.css');
  const step = html.slice(html.indexOf('id="stepGroup-export"'), html.indexOf('<div class="controlsFooter"'));
  assert.match(step, /<div class="subTabs" id="extraTabs" role="tablist" aria-label="Extra">/);
  assert.match(step, /id="extraTab-main"[^>]*aria-controls="extraPanel-main" aria-selected="true">Check and save</);
  assert.match(step, /id="extraTab-regulation"[^>]*aria-controls="extraPanel-regulation" aria-selected="false" tabindex="-1">Regulation</);
  assert.match(step, /<div id="extraPanel-regulation" role="tabpanel" aria-labelledby="extraTab-regulation" hidden>[\s\S]*id="regulationBody"/);
  for(const id of ['capubV2StatusPanel', 'finishPanel', 'downloadImage', 'capubV2Reset']) assert.ok(step.indexOf(`id="${id}"`) > step.indexOf('id="extraPanel-main"') && step.indexOf(`id="${id}"`) < step.indexOf('id="extraPanel-regulation"'), id + ' stays in the first tab');
  assert.match(css, /\.subTabs\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /\.subTab\[aria-selected="true"\]\{color:var\(--ink\);border-bottom-color:var\(--action\)\}/);
  assert.match(css, /\.regTable\{width:100%;border-collapse:collapse/);
});
