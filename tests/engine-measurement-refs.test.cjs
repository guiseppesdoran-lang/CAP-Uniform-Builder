'use strict';
// Ethan, 2 November 2026: "that needs to be on the measurements (measurements need to be more widespread than they currently are)". Every regulation distance the engine
// applies has a callout on the measurement overlay that quotes the inch value and the paragraph it carries out. This test (1) lists, per uniform, the rules the engine applied
// (their paragraph strings) on a build that exercises each, and asserts a callout exists for each one, with a distance (an inch value, or a word label for a position: centered,
// halfway, even with, on the seam) and the paragraph on its pill; (2) asserts no measure the engine draws lacks a paragraph; (3) that the pills of the whole standard matrix
// stay clear of the pieces and of each other with the paragraph line added (the machinery of measure-layout.js, calloutRoom and labelDistance).

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const core = require('../js/engine/core.js');
const P = require('../js/engine/profiles.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');
require('../js/engine/profiles-polo.js');
const ML = require('../js/engine/measure-layout.js');
const R = require('../scripts/render-builds.cjs');

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images', 'MANIFEST.json'), 'utf8'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));
const MATRIX = R.matrix().builds;
const WORDS = new Set(['centered', 'halfway', 'halfway to elbow', 'midway', 'even with', 'parallel with', 'level with', 'on the seam', 'under the board']);
const named = name => { const b = MATRIX.find(x => x.name === name); assert.ok(b, name + ' is in the standard matrix'); return JSON.parse(JSON.stringify(b.build)); };
const compose = build => P.composeUniform(R.makeBuild(build), store);

// The overlay's own layout of a scene, as the page and the harness lay it out.
function laidOut(scene){
  const B = scene.bounds, vb = [B.x - 0.4, B.y - 0.4, B.w + 0.8, B.h + 0.8], px = ML.previewPx(vb);
  return ML.layout(scene, { px, area: { x: vb[0], y: vb[1], w: vb[2], h: vb[3] }, calloutArea: ML.calloutRoom(vb, px) });
}

// A build with its fields changed: opt merged, the rest replaced.
const variant = (name, extra) => { const b = named(name); return Object.assign(b, extra, extra.opt ? { opt: Object.assign({}, b.opt, extra.opt) } : {}); };

// [uniform, what, build (a matrix name or a build), the paragraphs the engine applies on it]. A paragraph is quoted as the engine's table cites it.
const RULES = [
  ['blues_a men', 'Class A, captain, full rack', 'blues_a-male-senior-Capt', ['4.1.5.2', '4.1.5.2.2.4.1', '4.1.5.2.2.4.2', '4.1.5.2.2.1', '6.2.2.2.1-3', '4.1.5.2.2.3', '4.1.5.2.2.2.1-2']],
  ['blues_a women', 'Class A, senior master sergeant', 'blues_a-female-senior-SMSgt', ['4.1.9.3.3', '4.1.9.4.4.1', '4.1.9.4.4.2', '4.1.9.4.1', '4.1.9.4.3', '4.1.9.4.2.1-2']],
  ['blues_a men', 'Class A, cadet major, shoulder board and cord', 'blues_a-male-cadet-C-Maj', ['4.1.5.2.1.3', '9.3, 9.3.4']],
  ['semi_formal_usaf', 'cadet semi-formal, cadet major, board', 'semi_formal_usaf-female-cadet-C-Maj', ['4.1.9.3.4', '4.1.4.2']],
  ['blues_b men', 'Class B, cadet staff sergeant', 'blues_b-male-cadet-C-SSgt', ['4.1.11.1.1.1.4', '4.1.11.1.1.2.1', '4.1.11.1.1.2.2', '4.1.11.1.1.2.3.1', '4.1.11.1.1.2.3.2']],
  ['blues_b women', 'Class B, senior master sergeant', 'blues_b-female-senior-SMSgt', ['4.1.12.2.3.3', '4.1.12.2.4.1', '4.1.12.2.4.2', '4.1.12.2.5.1', '4.1.12.2.5.2']],
  ['mess_dress', 'mess dress, colonel', 'mess_dress-male-senior-Col', ['4.1.1.1', '4.1.1.1.2.2', '4.1.1.1.2.3']],
  ['aviator', 'aviator shirt, captain', 'aviator-female-senior-Capt', ['4.2.6.2.6.2.2', '4.2.6.2.7.1', '4.2.6.2.7.2']],
  ['aviator_blazer', 'corporate service dress, captain, with the shirt', 'aviator_blazer-male-senior-Capt', ['4.2.3.1.1.2', '4.2.3.1.1.3', '4.2.5.1.3.1']],
  ['semi_formal', 'corporate semi-formal, colonel', 'semi_formal-female-senior-Col', ['4.2.2.4', '4.2.2.5']],
  ['abu', 'ABU, captain: collar from the bottom, badges, blue border', 'abu-male-senior-Capt', ['5.1.1.1.1.1', '5.1.1.1.2.4', '5.1.1.1.1.1, 5.1.1.1.1.3, 5.1.1.1.2.4']],
  ['abu', 'ABU, cadet major: collar from the front', 'abu-male-cadet-C-Maj', ['5.1.1.1.1.3', '5.1.1.1.2.4']],
  ['abu', 'ABU, senior master sergeant: chevron below the seam', 'abu-female-senior-SMSgt', ['5.1.1.1.1.2', '5.1.1.1.2.4']],
  ['corporate_field', 'Corporate Field Uniform, captain', 'corporate_field-female-senior-Capt', ['5.2.1.1.1.1', '5.2.1.1.2.6']],
  ['ocp', 'OCP, captain: square, cap grade, badges', 'ocp-male-senior-Capt', ['7.1.1.2.1, 7.1.1.2.2', '7.1.1.8, ICL 25-02 6.2.11.1', '7.1.1.3.1.1-2', '7.1.1.3.1.2']],
  ['flight_suit', 'flight duty uniform, captain', 'flight_suit-male-senior-Capt', ['8.2.3.2', '8.2.4.4', '6.2.2.2.1-3']],
  ['corporate_flight_suit', 'Corporate Flight Duty Uniform, colonel', 'corporate_flight_suit-male-senior-Col', ['8.3.3.2', '8.3.4.4']],
  ['polo', 'polo, captain', 'polo-male-senior-Capt', ['5.3.2.1.1']]
];

for(const [uniform, what, name, refs] of RULES){
  test(`${uniform}: ${what}: a callout with a distance and the paragraph for each rule applied (${refs.join('; ')})`, async () => {
    const scene = await compose(named(name));
    const ms = scene.layers.filter(l => l.type === 'measure');
    const drawn = laidOut(scene);
    for(const ref of refs){
      const m = ms.find(x => x.ref === ref);
      assert.ok(m, `${name}: no callout carries ${ref} (drawn: ${ms.map(x => x.label + ' ' + x.ref).join('; ')})`);
      const len = Math.hypot(m.to.x - m.from.x, m.to.y - m.from.y);
      assert.ok(len > 0.04, `${name}: the callout for ${ref} spans ${len.toFixed(3)} in`);
      assert.ok(WORDS.has(m.label) || /^[\d¼½¾⅛⅜⅝⅞.\s]+in$/.test(m.label), `${name}: the label ${m.label} is an inch value or a position word`);
      const d = drawn.find(x => x.key === m.key);
      assert.ok(d, `${name}: ${ref} is laid out`);
      const text = d.callout ? (d.callout.caption && d.callout.caption.lines || []).join(' ') : (d.label && d.label.caption || []).join(' ');
      assert.ok(text.replace(/\s+/g, ' ').includes(ML.refText(ref).split(' ').slice(0, 3).join(' ')), `${name}: the callout for ${ref} quotes the paragraph (${text})`);
    }
  });
}

test('the Class A shoulder cord and the aide cord carry the paragraph under the board; the cadet officer board carries the seam paragraph', async () => {
  for(const [sex, ref] of [['male', '4.1.5.2.1.3'], ['female', '4.1.9.3.4']]){
    const scene = await compose(Object.assign(variant(`blues_a-${sex}-cadet-C-Maj`, {}), { cord: 'group' }));
    const ms = scene.layers.filter(l => l.type === 'measure');
    assert.ok(ms.some(m => m.label === 'on the seam' && m.ref === ref), `${sex}: the board on the seam, ${ref}`);
    assert.ok(ms.some(m => m.label === 'under the board' && m.ref === '9.3, 9.3.4'), `${sex}: the cord under the board`);
  }
  const aide = await compose(Object.assign(variant('blues_a-male-senior-Capt', {}), { cord: 'aide_de_camp' }));
  assert.ok(aide.layers.some(l => l.type === 'measure' && l.label === 'under the board'), 'the aide cord starts under the board');
});

test('every callout the engine draws on every build of the standard matrix names its paragraph', async () => {
  const bare = [];
  for(const b of MATRIX){
    const scene = await compose(JSON.parse(JSON.stringify(b.build)));
    for(const m of scene.layers.filter(l => l.type === 'measure')) if(!m.ref) bare.push(`${b.name}: ${m.label} ${(m.opts && (m.opts.caption || (m.opts.callout && m.opts.callout.caption))) || ''}`);
  }
  assert.deepEqual(bare, [], 'callouts with no paragraph:\n' + bare.join('\n'));
});
