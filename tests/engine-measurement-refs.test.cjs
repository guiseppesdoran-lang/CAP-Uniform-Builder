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
const named = name => { if(typeof name === 'object') return JSON.parse(JSON.stringify(name)); const b = MATRIX.find(x => x.name === name); assert.ok(b, name + ' is in the standard matrix'); return JSON.parse(JSON.stringify(b.build)); };
const compose = build => P.composeUniform(R.makeBuild(build), store);

// The overlay's own layout of a scene, as the page and the harness lay it out.
function laidOut(scene){
  const B = scene.bounds, vb = [B.x - 0.4, B.y - 0.4, B.w + 0.8, B.h + 0.8], px = ML.previewPx(vb);
  return ML.layout(scene, { px, area: { x: vb[0], y: vb[1], w: vb[2], h: vb[3] }, calloutArea: ML.calloutRoom(vb, px) });
}

// A build with its fields changed: opt merged, the rest replaced.
const variant = (name, extra) => { const b = named(name); return Object.assign(b, extra, extra.opt ? { opt: Object.assign({}, b.opt, extra.opt) } : {}); };

const WING = { id: 'nywg_patch', kind: 'general', slot: 'L_SHOULDER', label: 'New York Wing' };
const UNIT = { id: 'TN-330_ocp_patch', kind: 'unit', label: 'TN-330 Sequoyah Cadet Squadron' };
const ARCHER = { id: 'archer_ocp_patch', kind: 'general', slot: 'R_SHOULDER', label: 'ARCHER' };

// [uniform, what, build (a matrix name or a build), the paragraphs the engine applies on it]. A paragraph is quoted as the engine's table cites it.
const RULES = [
  ['blues_a men', 'Class A, captain, full rack', 'blues_a-male-senior-Capt', ['4.1.5.2', '4.1.5.2.2.4.1', '4.1.5.2.2.4.2', '4.1.5.2.2.1', '6.2.2.2.1-3', '4.1.5.2.2.3', '4.1.5.2.2.2.1-2']],
  ['blues_a women', 'Class A, senior master sergeant', 'blues_a-female-senior-SMSgt', ['4.1.9.3.3', '4.1.9.4.4.1', '4.1.9.4.4.2', '4.1.9.4.1', '4.1.9.4.3', '4.1.9.4.2.1-2']],
  ['blues_a men', 'Class A, cadet major, shoulder board and cord', 'blues_a-male-cadet-C-Maj', ['4.1.5.2.1.3', '9.3, 9.3.4']],
  ['semi_formal_usaf men', 'cadet semi-formal, cadet major: worn as for the service dress (4.1.3.2), badges in the service dress places (4.1.3.2.2)', 'semi_formal_usaf-male-cadet-C-Maj', ['4.1.3.2', '4.1.3.2.2']],
  ['semi_formal_usaf women', 'cadet semi-formal, cadet major: worn as for the service dress (4.1.4), badges in the service dress places (4.1.4.2)', 'semi_formal_usaf-female-cadet-C-Maj', ['4.1.4', '4.1.4.2']],
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
  ['polo', 'polo, captain', 'polo-male-senior-Capt', ['5.3.2.1.1']],
  // The flag and AUX the OCP sheet draws, and the patches under them (LIVE13, Ethan 3 November 2026: "aux and flag should have measurements"): the ICL states no inch for them, so the
  // callouts say centered / top of the field and show the drawn distance.
  ['ocp', 'OCP, flag, AUX, unit patch and HHQ patch', variant('ocp-male-senior-Capt', { patchRefs: [UNIT, WING] }), ['7.1.1.4.1.1', '7.1.1.4.2', '7.1.1.4.1.2', '7.1.1.4.2.1']],
  ['abu', 'ABU, wing patch 1/2 in below the shoulder seam', variant('abu-male-senior-Capt', { patchRefs: [WING] }), ['5.1.1.1.2.2']],
  ['corporate_field', 'Corporate Field Uniform, wing patch 1/2 in below the shoulder seam', variant('corporate_field-male-senior-Capt', { patchRefs: [WING] }), ['5.2.1.1.2.2-3']]
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

test('the cadet semi-formal quotes its own paragraphs (4.1.3.2 and 4.1.3.2.2 men, 4.1.4 and 4.1.4.2 women), never the Class A numbers it is worn as', async () => {
  for(const [name, own, badges] of [['semi_formal_usaf-male-cadet-C-Maj', '4.1.3.2', '4.1.3.2.2'], ['semi_formal_usaf-female-cadet-C-Maj', '4.1.4', '4.1.4.2'], ['semi_formal_usaf-male-cadet-C-SSgt', '4.1.3.2', '4.1.3.2.2'], ['semi_formal_usaf-female-cadet-C-SSgt', '4.1.4', '4.1.4.2']]){
    const ms = (await compose(named(name))).layers.filter(l => l.type === 'measure');
    assert.ok(ms.length >= 5, `${name}: the callouts are drawn`);
    for(const m of ms){
      const caption = m.opts.caption;
      const want = /badge/.test(caption) ? badges : own;
      assert.equal(m.ref, want, `${name}: ${caption} cites ${want}`);
      assert.doesNotMatch(m.ref, /^4\.1\.(5|9)\./, `${name}: ${caption} cites no Class A paragraph`);
    }
    assert.ok(ms.some(m => m.ref === own) && ms.some(m => m.ref === badges), `${name}: both the uniform's paragraph and the badge paragraph are quoted`);
  }
});

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

// A distance only the garment's drawing sets, which no paragraph states, carries no paragraph: on the OCP the seam to the top of the flag or of AUX (7.1.1.4.1.1 and 7.1.1.4.2 say
// centered, at the top). Every other callout the engine draws names the paragraph it carries out.
const garmentDrawn = (uniform, caption) => uniform === 'ocp' && /^shoulder seam to the (flag|AUX)$/.test(caption);
test('every callout the engine draws on every build of the standard matrix names its paragraph, except the distances only the garment drawing sets', async () => {
  const bare = [];
  let drawn = 0;
  for(const b of MATRIX){
    const scene = await compose(JSON.parse(JSON.stringify(b.build)));
    for(const m of scene.layers.filter(l => l.type === 'measure')){
      if(m.ref) continue;
      const caption = (m.opts && (m.opts.caption || (m.opts.callout && m.opts.callout.caption))) || '';
      if(garmentDrawn(scene.uniform, caption)) drawn++;
      else bare.push(`${b.name}: ${m.label} ${caption}`);
    }
  }
  assert.deepEqual(bare, [], 'callouts with no paragraph:\n' + bare.join('\n'));
  assert.ok(drawn > 0, 'the OCP builds draw the seam distances');
});

// The pill's text for a callout, as laid out.
const textOf = d => (d.callout ? (d.callout.caption && d.callout.caption.lines || []) : (d.label && d.label.caption || [])).join(' ').replace(/\s+/g, ' ');
// A label like '4.95 in' (an inch value the sheet draws that is not a whole eighth), as a number.
const inches = label => Number(label.replace(/\s*in$/, ''));

test('OCP: the flag and AUX each carry a centered line across the Velcro with the paragraph, and the distance from the shoulder seam to their top without one, whether or not a patch is worn (7.1.1.4.1.1, 7.1.1.4.2)', async () => {
  for(const build of [named('ocp-male-senior-Capt'), variant('ocp-female-senior-Capt', { patchRefs: [UNIT, WING] })]){
    const scene = await compose(build);
    const sheet = await store.load('garment-ocp-coat-abu-cut');
    const ms = scene.layers.filter(l => l.type === 'measure');
    const drawn = laidOut(scene);
    for(const [side, drawnName, what, ref] of [['right', 'patch_flag_right', 'flag', '7.1.1.4.1.1'], ['left', 'patch_aux_left', 'AUX', '7.1.1.4.2']]){
      const d = core.landmarkBounds(sheet, drawnName), v = core.landmarkBounds(sheet, 'sleeve_flap_velcro_' + side);
      const centred = ms.find(m => m.ref === ref && m.label === 'centered');
      assert.ok(centred, `${what}: a centered line`);
      assert.ok(Math.abs(centred.to.x - centred.from.x - v.w) < 1e-6, `${what}: the line spans the Velcro's width`);
      assert.ok(Math.abs(centred.opts.mid.x - (d.x + d.w / 2)) < 1e-6 && Math.abs((centred.from.x + centred.to.x) / 2 - centred.opts.mid.x) < 1e-6, `${what}: centred on the Velcro, its tick at the ${what}'s centre`);
      const seam = ms.find(m => m.opts.caption === `shoulder seam to the ${what}`);
      assert.ok(seam, `${what}: the shoulder seam to its top`);
      assert.equal(seam.ref, '', `${what}: the seam distance is how the garment is drawn, so it quotes no paragraph`);
      assert.ok(Math.abs(seam.to.y - d.y) < 1e-6 && seam.from.y < d.y - 3, `${what}: from the sleeve's top edge (${seam.from.y.toFixed(3)}) to the ${what}'s top (${d.y.toFixed(3)})`);
      assert.ok(Math.abs(inches(seam.label) - (seam.to.y - seam.from.y)) < 0.006, `${what}: the label ${seam.label} is the drawn distance ${(seam.to.y - seam.from.y).toFixed(3)} in`);
      const l = drawn.find(x => x.key === centred.key), ls = drawn.find(x => x.key === seam.key);
      assert.ok(l && /7\.1\.1\.4/.test(textOf(l)) && textOf(l).includes('CAPR 39-1'), `${what}: ${centred.opts.caption} quotes ${ref} (${l && textOf(l)})`);
      assert.ok(ls && !/7\.1\.1|CAPR/.test(textOf(ls)), `${what}: ${seam.opts.caption} quotes no paragraph (${ls && textOf(ls)})`);
    }
  }
});

test('OCP: the gap from the flag to the unit patch and from AUX to the HHQ patch is shown as drawn, with the paragraph (7.1.1.4.1.2, 7.1.1.4.2.1)', async () => {
  const scene = await compose(variant('ocp-male-senior-Capt', { patchRefs: [UNIT, WING] }));
  const sheet = await store.load('garment-ocp-coat-abu-cut');
  const ms = scene.layers.filter(l => l.type === 'measure');
  for(const [key, drawnName, ref, patchId] of [['flag', 'patch_flag_right', '7.1.1.4.1.2', 'TN-330_ocp_patch'], ['AUX', 'patch_aux_left', '7.1.1.4.2.1', 'nywg_patch']]){
    const d = core.landmarkBounds(sheet, drawnName);
    const patch = scene.layers.find(l => l.role === 'patch' && l.key.startsWith(`patch:${patchId}:`) && !/:edge$/.test(l.key));
    const m = ms.find(x => x.ref === ref && x.opts.caption.startsWith(key));
    assert.ok(patch && m, `${key}: the gap measure`);
    assert.ok(Math.abs(m.from.y - (d.y + d.h)) < 1e-6 && Math.abs(m.to.y - patch.y) < 1e-6, `${key}: from the ${key}'s bottom to the patch's top`);
    assert.ok(Math.abs(inches(m.label) - (patch.y - d.y - d.h)) < 0.006, `${key}: ${m.label}`);
  }
  // The unit patch also keeps its centered line (7.1.1.4.1.2).
  assert.ok(ms.some(m => m.ref === '7.1.1.4.1.2' && m.label === 'centered'), 'the unit patch is centered under the flag');
});

test('flight duty uniform and CFDU: the flag is 1/2 in below the shoulder seam as a true inch rule (8.2.4.4, 8.3.4.4); 8.2.4.5 and 8.3.4.5 give the right sleeve patch no distance', async () => {
  for(const [name, ref] of [['flight_suit-male-senior-Capt', '8.2.4.4'], ['corporate_flight_suit-male-senior-Col', '8.3.4.4']]){
    const scene = await compose(variant(name, { patchRefs: [UNIT] }));
    const ms = scene.layers.filter(l => l.type === 'measure' && l.ref === ref);
    assert.equal(ms.length, 1, `${name}: one flag callout`);
    const len = ms[0].to.y - ms[0].from.y;
    assert.ok(Math.abs(len - 0.5) < 1e-6 && ms[0].label === '½ in', `${name}: ${ms[0].label}, ${len} in`);
    assert.ok(!scene.layers.some(l => l.type === 'measure' && /^8\.[23]\.4\.5/.test(l.ref || '')), `${name}: no distance is invented for the right sleeve patch`);
  }
});

test('ABU and CFU: the sleeve patches hang 1/2 in below the shoulder seam (5.1.1.1.2.2, 5.2.1.1.2.2-3), on the CFU right sleeve too', async () => {
  for(const [name, ref, patches] of [['abu-male-senior-Capt', '5.1.1.1.2.2', [WING]], ['corporate_field-male-senior-Capt', '5.2.1.1.2.2-3', [WING, ARCHER]]]){
    const scene = await compose(variant(name, { patchRefs: patches }));
    const ms = scene.layers.filter(l => l.type === 'measure' && l.ref === ref);
    assert.equal(ms.length, patches.length, `${name}: a callout for each sleeve patch`);
    for(const m of ms) assert.ok(Math.abs(m.to.y - m.from.y - 0.5) < 1e-6 && m.label === '½ in', `${name}: ${m.label}`);
  }
});
