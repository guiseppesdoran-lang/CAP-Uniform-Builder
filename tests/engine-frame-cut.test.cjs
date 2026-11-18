'use strict';
// Where each picture ends (the owner, 2026-11-12: "you only have to show the top, not the skirt. thats why the female mess dress (and others) look like a ... witch robe. it should cut
// off where the rest of the uniforms cut off. the only reaosn class b includes some of the pants is because includes the belt"). A picture ends a short strip under the top's own lowest
// point: the sheet's reference line (the lower edge of the belt, else the lowest point of the top, hem and cuffs, whichever is lower) plus a strip that follows one rule: a figure with a belt
// drawn shows the men's strip of the same uniform, a figure with no belt drawn shows the Class A coat's (compose.js FRAME_CUT; the mess dress keeps the men's own). The lines and the
// strips are read here from the sheets' own drawing (scripts/measure-frame-cut.cjs), not from the engine's table; the drawing, its bounds and every placement above the cut are as they were.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const core = require('../js/engine/core.js');
const C = require('../js/engine/compose.js');
const ML = require('../js/engine/measure-layout.js');
const P = require('../js/engine/profiles.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');
require('../js/engine/profiles-polo.js');
const HARNESS = require('../scripts/render-builds.cjs');
const MEASURE = require('../scripts/measure-frame-cut.cjs');
const RULES = require('../data/uniform-rules.js');

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images', 'MANIFEST.json'), 'utf8'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));
const svgOf = id => fs.readFileSync(path.join(root, 'images', manifest.assets.find(a => a.id === id).path), 'utf8');
const bottom = scene => scene.bounds.y + scene.bounds.h;
const TOL = 0.02;

// What the drawing was before the cut: the same engine with no sheet cut.
async function uncut(fn){
  const saved = Object.assign({}, C.FRAME_CUT);
  for(const k of Object.keys(saved)) delete C.FRAME_CUT[k];
  try{ return await fn(); }finally{ Object.assign(C.FRAME_CUT, saved); }
}
const compose = spec => P.composeUniform(HARNESS.makeBuild(spec), store);
const member = uniform => (uniform === 'semi_formal_usaf' ? { membership: 'cadet', rank: 'C/Capt' } : { membership: 'senior', rank: 'Capt' });

// Every cut picture of every uniform the page offers a sleeve or a top choice for: the uniform, its options, and the sheet the cut belongs to.
const CUTS = [
  { uniform: 'blues_a', sheet: 'garment-blues-class-a-coat-female' },
  { uniform: 'semi_formal_usaf', sheet: 'garment-semiformal-class-a-coat-female' },
  { uniform: 'mess_dress', sheet: 'garment-mess-dress-female' },
  { uniform: 'semi_formal', sheet: 'garment-corporate-service-dress-blazer-female' },
  { uniform: 'aviator_blazer', opt: { underlayer: 'shell' }, sheet: 'garment-corporate-service-dress-blazer-female', label: 'aviator_blazer, white shell' },
  { uniform: 'blues_b', opt: { sleeve: 'short' }, sheet: 'garment-blues-class-b-blouse-female' },
  { uniform: 'blues_b', opt: { sleeve: 'long' }, sheet: 'garment-blues-class-b-blouse-female-long' },
  { uniform: 'aviator', opt: { sleeve: 'short', femaleTop: 'shirt' }, sheet: 'garment-aviator-shirt-female' },
  { uniform: 'aviator', opt: { sleeve: 'long', femaleTop: 'shirt' }, sheet: 'garment-aviator-shirt-female-long' },
  { uniform: 'aviator', opt: { sleeve: 'short', femaleTop: 'overblouse' }, sheet: 'garment-overblouse-female' },
  { uniform: 'aviator', opt: { sleeve: 'long', femaleTop: 'overblouse' }, sheet: 'garment-overblouse-female-long' },
  { uniform: 'polo', opt: { sleeve: 'short' }, sheet: 'garment-polo-female' },
  { uniform: 'polo', opt: { sleeve: 'long' }, sheet: 'garment-polo-female-long' },
  // the men's blazer draws no belt: it is cut like the women's
  { uniform: 'semi_formal', gender: 'male', sheet: 'garment-corporate-service-dress-blazer-male' },
  { uniform: 'aviator_blazer', gender: 'male', opt: { underlayer: 'turtleneck' }, sheet: 'garment-corporate-service-dress-blazer-male', label: 'aviator_blazer, turtleneck' }
];
const nameOf = w => (w.gender === 'male' ? "men's " : '') + (w.label || `${w.uniform} ${Object.values(w.opt || {}).join(' ')}`.trim());
const rows = MEASURE.compute().rows;
const rowOf = sheet => rows.find(r => r.sheet === sheet);
const specOf = w => Object.assign({ uniform: w.uniform, gender: w.gender || 'female', opt: w.opt || {} }, member(w.uniform));
const menSpec = w => Object.assign({ uniform: w.uniform, gender: 'male', opt: Object.assign({}, w.opt, { femaleTop: undefined }) }, member(w.uniform));
const WOMEN = CUTS.filter(w => !w.gender);   // the women's pictures; the men's blazer's two builds carry gender 'male'

// THE RULE, in one place, from the sheets' drawing alone: the strip of lower garment a picture shows under its reference line. A figure with a belt drawn shows the men's strip of the same
// uniform (the bottom of the men's frame less the men's line); a figure with no belt drawn shows the Class A coat's strip. The mess dress has no belt and keeps the men's own strip.
const PAIR = { 'garment-mess-dress-female': 'garment-mess-dress-male', 'garment-blues-class-b-blouse-female': 'garment-blues-class-b-shirt-male', 'garment-blues-class-b-blouse-female-long': 'garment-blues-class-b-shirt-male-long',
  'garment-aviator-shirt-female': 'garment-aviator-shirt-male', 'garment-aviator-shirt-female-long': 'garment-aviator-shirt-male-long' };
const menStripOf = id => MEASURE.frameBottom(id) - MEASURE.lineOf(id).line;
const COAT_STRIP = menStripOf('garment-blues-class-a-coat');
const ruleStrip = sheet => (MEASURE.lineOf(sheet).belt != null || sheet === 'garment-mess-dress-female' ? menStripOf(PAIR[sheet]) : COAT_STRIP);

test('FRAME_CUT is what scripts/measure-frame-cut.cjs reads from the sheets (regenerate it after an art sync)', () => {
  const t = MEASURE.compute().table;
  assert.deepEqual(Object.keys(C.FRAME_CUT).sort(), Object.keys(t).sort(), 'the same sheets');
  assert.deepEqual(Object.keys(C.FRAME_CUT).sort(), [...new Set(CUTS.map(w => w.sheet))].sort(), 'every cut sheet is covered here');
  for(const id of Object.keys(t)){
    assert.ok(Math.abs(C.FRAME_CUT[id].line - t[id].line) < 0.0006, `${id}: line ${C.FRAME_CUT[id].line} against ${t[id].line}`);
    assert.ok(Math.abs(C.FRAME_CUT[id].strip - t[id].strip) < 0.0006, `${id}: strip ${C.FRAME_CUT[id].strip} against ${t[id].strip}`);
  }
});

test('the strip follows one rule: a belt drawn gives the men\'s strip of the uniform, no belt drawn gives the Class A coat\'s (the mess dress keeps the men\'s own)', () => {
  assert.ok(Math.abs(COAT_STRIP - 0.288) < 0.001, `the coat's strip is ${COAT_STRIP.toFixed(3)} in`);
  for(const r of rows){
    assert.ok(Math.abs(r.strip - ruleStrip(r.sheet)) < 1e-9, `${r.sheet}: the table's strip ${r.strip.toFixed(3)} against the rule's ${ruleStrip(r.sheet).toFixed(3)}`);
    assert.ok(Math.abs(C.FRAME_CUT[r.sheet].strip - ruleStrip(r.sheet)) < 0.0006, `${r.sheet}: the engine's strip`);
  }
  // which figures draw a belt, from the sheets: the Class B and aviator shirts (both cuts) and the polo's men's cut; no coat, blazer, overblouse or women's polo
  const belted = id => MEASURE.lineOf(id).belt != null;
  for(const id of ['garment-blues-class-b-shirt-male', 'garment-blues-class-b-shirt-male-long', 'garment-blues-class-b-blouse-female', 'garment-blues-class-b-blouse-female-long', 'garment-aviator-shirt-male',
    'garment-aviator-shirt-male-long', 'garment-aviator-shirt-female', 'garment-aviator-shirt-female-long', 'garment-polo-male', 'garment-polo-male-long']) assert.ok(belted(id), `${id} draws a belt`);
  for(const id of ['garment-blues-class-a-coat', 'garment-blues-class-a-coat-female', 'garment-semiformal-class-a-coat-male', 'garment-semiformal-class-a-coat-female', 'garment-mess-dress-male', 'garment-mess-dress-female',
    'garment-corporate-service-dress-blazer-male', 'garment-corporate-service-dress-blazer-female', 'garment-overblouse-female', 'garment-overblouse-female-long', 'garment-polo-female', 'garment-polo-female-long']) assert.ok(!belted(id), `${id} draws no belt`);
  // the men's sheets that are cut: only the beltless ones that are not the coat or the mess dress
  assert.deepEqual(rows.filter(r => r.figure === 'men').map(r => r.sheet), ['garment-corporate-service-dress-blazer-male']);
});

test('every cut has a measurement, and every cut is below its reference line', () => {
  for(const w of CUTS){
    const r = rowOf(w.sheet);
    assert.ok(r, `${w.sheet}: measured`);
    assert.ok(Number.isFinite(r.line) && Number.isFinite(r.strip), `${w.sheet}: a reference line and a strip`);
    assert.ok(r.strip >= 0, `${w.sheet}: the strip is not negative (${r.strip.toFixed(3)})`);
    assert.ok(r.cut > r.line, `${w.sheet}: the cut lies below the reference line`);
  }
});

test('the reference line is the lower of the belt and the top\'s own lowest point, and a long sleeve\'s cuff is below the belt', () => {
  for(const r of rows){
    assert.ok(Math.abs(r.line - Math.max(r.beltEdge == null ? -Infinity : r.beltEdge, r.outlineEdge == null ? -Infinity : r.outlineEdge)) < 1e-9, r.sheet);
  }
  // the belt on the women's blouse and the men's shirt, read from the strap's own rectangle
  const [blouse, shirt] = [MEASURE.lineOf('garment-blues-class-b-blouse-female'), MEASURE.lineOf('garment-blues-class-b-shirt-male')];
  assert.ok(Math.abs(blouse.belt - 23.172) < TOL && Math.abs(shirt.belt - 25.063) < TOL);
  const long = MEASURE.lineOf('garment-aviator-shirt-female-long');
  assert.ok(long.line > long.belt + 5, 'the long sleeve hangs below the belt: its cuff is the line');
});

for(const w of CUTS){
  test(`${nameOf(w)}: the picture ends at the reference line plus its strip; top, left and right stay where they were`, async () => {
    const r = rowOf(w.sheet);
    const before = await uncut(() => compose(specOf(w)));
    const after = await compose(specOf(w));
    assert.equal(after.garment, w.sheet, 'the sheet');
    assert.ok(after.frameCut != null && Math.abs(after.frameCut - r.cut) < 0.002, `the scene states its cut (${after.frameCut}, the table ${r.cut.toFixed(3)})`);
    for(const k of ['x', 'y', 'w']) assert.equal(after.bounds[k], before.bounds[k], `the frame's ${k} is as it was`);
    // The frame is cut where the sheet reaches below the cut; a sheet that draws no more than that is as it was.
    const expected = Math.min(bottom(before), r.cut);
    assert.ok(Math.abs(bottom(after) - expected) < TOL, `bottom ${bottom(after).toFixed(3)} in, expected ${expected.toFixed(3)} (the line ${r.line.toFixed(3)} and the strip ${r.strip.toFixed(3)})`);
    assert.ok(bottom(after) <= bottom(before) + 1e-9, 'the frame never grows');
    if(r.cut < bottom(before) - TOL) assert.ok(Math.abs(bottom(after) - r.line - ruleStrip(w.sheet)) < TOL, `the strip under the line ${(bottom(after) - r.line).toFixed(3)} in against the rule's ${ruleStrip(w.sheet).toFixed(3)}`);
    else assert.ok(bottom(after) - r.line <= r.strip + TOL, 'a sheet that draws less under its line than the strip is not stretched');
  });
}

test('a belted figure shows what the men\'s picture shows: the bottom of the men\'s cloth, as the engine frames it, less its line; the men\'s blazer shows the coat strip', async () => {
  for(const w of WOMEN.filter(x => MEASURE.lineOf(x.sheet).belt != null || x.uniform === 'mess_dress')){
    const r = rowOf(w.sheet), scene = await compose(menSpec(w));
    assert.equal(scene.garment, r.men, `${nameOf(w)}: the men's sheet`);
    const g = scene.layers.find(l => l.role === 'garment');
    const boxes = ML.clothBoxes({ layers: [g] });
    const cloth = boxes.length ? Math.min(Math.max(...boxes.map(b => b.y + b.h)), g.y + g.h) : g.y + g.h;
    assert.ok(Math.abs(cloth - r.menLine - r.strip) < TOL, `${nameOf(w)}: the men's picture shows ${(cloth - r.menLine).toFixed(3)} in under its line, the table says ${r.strip.toFixed(3)}`);
  }
  for(const w of CUTS.filter(x => x.gender === 'male')){
    const r = rowOf(w.sheet), scene = await compose(specOf(w));
    assert.ok(Math.abs(bottom(scene) - r.line - COAT_STRIP) < TOL, `${nameOf(w)}: ${(bottom(scene) - r.line).toFixed(3)} in under the hem, the coat's ${COAT_STRIP.toFixed(3)}`);
  }
});

test('the men\'s coat, mess dress and belted shirts, the field uniforms and the flight suits are as they were: no cut, the same frame', async () => {
  const cutSheets = new Set(CUTS.map(w => w.sheet));
  const list = [];
  for(const u of Object.keys(RULES.RULES)) for(const gender of ['male', 'female']){
    if(gender === 'female' && ['blues_a', 'semi_formal_usaf', 'mess_dress', 'semi_formal', 'aviator_blazer', 'blues_b', 'aviator', 'polo'].includes(u)) continue;
    if(gender === 'male' && ['semi_formal', 'aviator_blazer'].includes(u)) continue;
    for(const sleeve of (['blues_b', 'aviator', 'polo'].includes(u) ? ['short', 'long'] : [null])) list.push({ uniform: u, gender, opt: sleeve ? { sleeve } : {} });
  }
  assert.ok(list.length >= 15);
  for(const spec of list){
    const s = Object.assign({}, spec, member(spec.uniform));
    const before = await uncut(() => compose(s)), after = await compose(s);
    assert.deepEqual(after.bounds, before.bounds, `${spec.uniform} ${spec.gender} ${JSON.stringify(spec.opt)}: the frame`);
    assert.ok(!after.layers.some(l => l.cutBelow != null), `${spec.uniform} ${spec.gender}: no layer is cut`);
    assert.ok(!cutSheets.has(after.garment), 'a sheet that is not cut');
  }
});

// A scene without the cut's own mark, as text, so two drawings can be compared.
const plain = l => { const c = Object.assign({}, l); delete c.cutBelow; return JSON.stringify(c); };
const SHEET_ROLES = /^(garment|garment-layer|garment-foreground|underlayer|honor-guard-belt|honor-guard-sling|honor-guard-sling-over|honor-guard-ascot|epaulet-edge|epaulet-top)$/;

test('a dressed build: nothing above the cut moves by a hair, and only the sheet layers are cut', async () => {
  const dressed = HARNESS.matrix().builds.filter(b => !['corporate_field', 'abu', 'ocp', 'flight_suit', 'corporate_flight_suit'].includes(b.build.uniform));
  assert.ok(dressed.length >= 10, 'the standard matrix has women\'s dress builds');
  // plus the builds that wear sleeve patches and shoulder boards, whose flat views lie beside the figure
  dressed.push({ name: 'blues_a patches', build: { uniform: 'blues_a', gender: 'female', membership: 'cadet', rank: 'C/Maj', patchRefs: [{ id: 'cap_patch', kind: 'general', slot: 'L_SHOULDER' }] } });
  let cutLayers = 0;
  for(const { name, build } of dressed){
    const before = await uncut(() => P.composeUniform(HARNESS.makeBuild(build), store)), after = await P.composeUniform(HARNESS.makeBuild(build), store);
    assert.equal(after.layers.length, before.layers.length, `${name}: the same layers`);
    after.layers.forEach((l, i) => assert.equal(plain(l), plain(before.layers[i]), `${name}: layer ${l.key} is as it was`));
    for(const k of ['x', 'y', 'w']) assert.equal(after.bounds[k], before.bounds[k], `${name}: the frame's ${k}`);
    if(after.frameCut == null){ assert.ok(!after.layers.some(l => l.cutBelow != null), `${name}: nothing is cut where there is no cut`); continue; }
    for(const l of after.layers){
      if(l.cutBelow != null){ cutLayers++; assert.match(l.role, SHEET_ROLES, `${name}: ${l.key} is a sheet layer`); assert.ok(Math.abs(l.cutBelow - after.frameCut) < 1e-9 || l.role === 'honor-guard-gloves', `${name}: ${l.key} is cut at the line`); }
      else if(l.type !== 'measure' && l.type !== 'clear' && !/^(sleeve-flat|honor-guard-gloves)$/.test(l.role) && !SHEET_ROLES.test(l.role)){
        const b = core.layerBounds(l);
        assert.ok(b.y + b.h <= after.frameCut + 1e-6, `${name}: ${l.role} ${l.key} (bottom ${(b.y + b.h).toFixed(3)}) is not cut through by the line at ${after.frameCut.toFixed(3)}`);
      }
    }
  }
  assert.ok(cutLayers > 20, 'the sheets were cut');
});

test('no pocket, button, nameplate, ribbon place or epaulet of a cut sheet lies across its cut', () => {
  for(const w of CUTS){
    const r = rowOf(w.sheet);
    const shapes = MEASURE.shapesOf(svgOf(w.sheet));
    for(const s of shapes){
      if(!s.ids.some(i => /__(pocket|button|nameplate|ribbon|epaulet|collar|tie|buckle|belt-buckle)/.test(i))) continue;
      const low = Math.max(...s.pts.map(p => p[1]));
      assert.ok(low <= r.cut + 1e-6, `${w.sheet}: ${s.ids[s.ids.length - 1]} reaches ${low.toFixed(3)} in, below the cut at ${r.cut.toFixed(3)}`);
    }
  }
});

test('the pieces of the honor guard uniform that lie on the sheet are above the cut, and the gloves keep their hands whole', async () => {
  const SHEETS = [
    ['blues_a', 'male', null, 'garment-blues-class-a-coat'], ['blues_a', 'female', null, 'garment-blues-class-a-coat-female'],
    ['blues_b', 'male', 'short', 'garment-blues-class-b-shirt-male'], ['blues_b', 'male', 'long', 'garment-blues-class-b-shirt-male-long'],
    ['blues_b', 'female', 'short', 'garment-blues-class-b-blouse-female'], ['blues_b', 'female', 'long', 'garment-blues-class-b-blouse-female-long']
  ];
  for(const [uniform, gender, sleeve, sheet] of SHEETS) for(const role of ['guard', 'flag']){
    const spec = { uniform, gender, membership: 'cadet', rank: 'C/Maj', opt: Object.assign({ headgear: 'auto' }, sleeve ? { sleeve } : {}), ceremonial: { role, chinstrap: 'down' }, cord: 'honor_guard' };
    const name = `${sheet} ${role}`;
    const before = await uncut(() => compose(spec)), after = await compose(spec);
    const gloves = after.layers.find(l => l.role === 'honor-guard-gloves');
    assert.ok(gloves, `${name}: gloves`);
    // the hands as the overlay draws them, groups hidden in the file included (the flag bearer's pair under the sling)
    const ink = Math.max(...MEASURE.shapesOf(svgOf(`${sheet}-honor-guard-gloves`), { hidden: true }).map(s => Math.max(...s.pts.map(p => p[1]))));
    assert.ok(gloves.cutBelow == null || gloves.cutBelow >= ink - 1e-6, `${name}: the gloves are cut at ${gloves.cutBelow} but their lowest ink is ${ink.toFixed(3)}`);
    assert.ok(bottom(after) >= ink - 1e-6, `${name}: the frame (${bottom(after).toFixed(3)}) holds the hands (${ink.toFixed(3)})`);
    const r = rowOf(sheet);
    if(!r){ assert.equal(bottom(after), bottom(before), `${name}: a men's sheet is as it was`); continue; }
    // the frame is the cut, or whatever the hands need below it
    assert.ok(Math.abs(bottom(after) - Math.max(Math.min(bottom(before), r.cut), Math.min(ink + 0.1, bottom(before)))) < TOL, `${name}: ${bottom(after).toFixed(3)} in`);
    // the belt, the sling, the ascot and the folded pair under the belt lie in the strip: nothing but the sheet's own skirt or slacks is cut
    for(const part of ['honor-guard-belt', 'honor-guard-flag-sling', 'honor-guard-ascot']){
      const low = Math.max(...MEASURE.shapesOf(svgOf(`${sheet}-${part}`)).map(s => Math.max(...s.pts.map(p => p[1]))));
      assert.ok(low <= r.cut + 1e-6, `${name}: the ${part} (${low.toFixed(3)}) is above the cut (${r.cut.toFixed(3)})`);
    }
  }
});

test('the women\'s honor guard slacks are drawn from the belt to the cut, like the men\'s trousers', async () => {
  for(const [sleeve, sheet] of [['short', 'garment-blues-class-b-blouse-female'], ['long', 'garment-blues-class-b-blouse-female-long']]){
    const spec = { uniform: 'blues_b', gender: 'female', membership: 'cadet', rank: 'C/Maj', opt: { sleeve, headgear: 'auto' }, ceremonial: { role: 'guard', chinstrap: 'down' } };
    const s = await compose(spec), r = rowOf(sheet), g = s.layers.find(l => l.role === 'garment');
    assert.ok((g.showGroups || []).some(n => /slacks/.test(n)), `${sleeve}: the slacks state`);
    assert.ok(Math.abs(g.cutBelow - r.cut) < 0.002, `${sleeve}: the sheet is cut at the line`);
    // from the belt's lower edge to the cut is the men's strip: the slacks cloth reaches under the whole strip
    const cloth = MEASURE.shapesOf(svgOf(sheet), { hidden: true }).filter(sh => sh.ids.some(i => /__slacks-cloth$/.test(i)));
    assert.ok(cloth.length && Math.max(...cloth.flatMap(sh => sh.pts.map(p => p[1]))) >= r.cut, `${sleeve}: the slacks reach the cut`);
    assert.ok(Math.min(...cloth.flatMap(sh => sh.pts.map(p => p[1]))) <= MEASURE.lineOf(sheet).belt, `${sleeve}: and start at the belt`);
  }
});

test('the renderer draws nothing of a cut layer below its line, and a second figure\'s cut moves with the figure', () => {
  const src = fs.readFileSync(path.join(root, 'js', 'engine', 'render-svg.js'), 'utf8');
  assert.match(src, /if\(layer\.cutBelow != null\)/, 'the renderer reads the mark');
  assert.match(src, /el\('rect', \{ x: -1000, y: -1000, width: 3000, height: fmt\(1000 \+ layer\.cutBelow\) \}\)/, 'a clip down to the line');
  const prof = fs.readFileSync(path.join(root, 'js', 'engine', 'profiles.js'), 'utf8');
  assert.match(prof, /if\(l\.cutBelow != null\) l\.cutBelow \+= dy;/, 'shiftLayer carries the line');
});

test('scripts/render-builds.cjs matrix: every build composes with the cut, to a frame with a size', async () => {
  const { builds } = HARNESS.matrix();
  assert.ok(builds.length > 100);
  for(const { name, build } of builds){
    const s = await P.composeUniform(HARNESS.makeBuild(build), store);
    assert.ok(Number.isFinite(s.bounds.w) && Number.isFinite(s.bounds.h) && s.bounds.w > 0 && s.bounds.h > 0, `${name}: a frame`);
    assert.ok(s.layers.length > 0, `${name}: layers`);
  }
});
