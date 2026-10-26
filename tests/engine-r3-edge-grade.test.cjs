'use strict';
// FIX-R-OTHER-r1 review round 3: edge-on epaulet grades keep their length along the strap.

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
const NAME = { first: 'Pat', last: 'Doran', show: true };
const hb = (uniform, gender, membership, rank, o) => HARNESS.makeBuild(Object.assign({ uniform, gender, membership, rank, name: NAME, opt: { rackColumns: 3, rackArrangement: 'lapel', miniStyle: 'mounting' } }, o || {}));
const byKey = (scene, key) => scene.layers.find(l => l.key === key);
const rad = d => d * Math.PI / 180;
// The centre line of the figure a layer belongs to (the second figure of a scene, the aviator shirt beside the blazer, is shifted).
const centreLine = (scene, l) => { const g = scene.layers.find(x => x.role === 'garment' && (x.figure || 1) === (l.figure || 1)); return g.x + g.w / 2; };

// ---- 5. Edge-on epaulet grade: foreshortened across the strap, true length along it ----------------------------------

test('LIVE9-1: the grade on the shirts\' sleeve is the top view\'s piece face-on, never larger and never squeezed; the colonel\'s eagle is not a speck (R7; CAPR 39-1 4.2.5.1.1.1, 4.2.6.2.1; DAFI 36-2903 4.5.1.1.1)', async () => {
  const along = (l, u) => {
    const R = rad(l.rotate || 0), c = Math.cos(R), s = Math.sin(R);
    return Math.abs(l.w * (c * u.x + s * u.y)) + Math.abs(l.h * (-s * u.x + c * u.y));
  };
  let compared = 0;
  const cases = [];
  for(const gender of ['male', 'female']){
    for(const u of ['aviator', 'aviator_blazer', 'blues_b']) for(const rank of ['Capt', 'Maj', 'Lt Col', 'Col', 'Maj Gen']) cases.push([u, gender, 'senior', rank]);
    cases.push(['blues_b', gender, 'cadet', 'C/Maj'], ['blues_b', gender, 'cadet', 'C/Col']);
  }
  for(const [u, gender, membership, rank] of cases){
    const scene = await compose(hb(u, gender, membership, rank));
    for(const side of ['right', 'left']){
      const face = byKey(scene, `grade:sleeve-${side}`), top = byKey(scene, `grade:top-${side}`), view = byKey(scene, `epaulet-top:${side}`);
      if(!face || !view) continue;
      const label = `${u} ${gender} ${rank} ${side}`;
      const spec = await store.load(scene.garment);
      if(!spec.landmarks[`epaulet_${side}`]) continue; // the blazer's companion shirt sheet is not the scene's garment
      const fr = P.helpers.frameFromPolygon({ base: { w: spec.w } }, side, spec.landmarks[`epaulet_${side}`].points);
      const r = rad(fr.deg);
      const axis = { x: -Math.sin(r), y: Math.cos(r) }, cross = { x: Math.cos(r), y: Math.sin(r) };
      const art = await store.load(face.id);
      assert.ok(Math.abs(face.w / art.w - face.h / art.h) < 0.001 && face.w <= art.w + 0.001, `${label}: scaled uniformly, never enlarged`);
      // The grade fits across the strap with the margin (the sleeve is the strap, 0.9 to 1.0 in wide).
      assert.ok(along(face, cross) <= fr.width - 0.2 + 0.005 || along(face, axis) >= along(face, cross) && along(face, cross) <= fr.width, `${label}: the grade fits the strap (${along(face, cross).toFixed(3)} across ${fr.width.toFixed(2)})`);
      if(top){
        assert.ok(along(face, axis) <= along(top, { x: 1, y: 0 }) + 0.01, `${label}: face-on length ${along(face, axis).toFixed(3)} is at most the top view's ${along(top, { x: 1, y: 0 }).toFixed(3)}`);
        compared++;
      }
      if(rank === 'Col' && membership === 'senior') assert.ok(Math.max(along(face, axis), along(face, cross)) > 0.6, `${label}: the eagle is ${Math.max(along(face, axis), along(face, cross)).toFixed(3)} in wide on the sleeve, not a speck`);
    }
  }
  assert.ok(compared >= 4, `${compared} face/top pairs compared`);
});

// ---- 5b. LIVE8-4: the grade on an edge-on strip is sized from that strip's thickness, on every uniform that draws one ----------------------------------

test('the edge-on grade is squeezed to its strip\'s thickness less 0.08 in on the Class A boards (0.5 in; the shirts draw the sleeve face-on since LIVE9-1, tests/engine-live-shirt-strips) and the Class A officers\' strap strip (the thickness its sheet states, about 0.46 in), not to a fixed 0.32 in (DAFI 36-2903 4.5.1.1.1; CAPR 39-1 4.1.5.2.1, 4.1.11.1.1, 4.2.5.1.1.1)', async () => {
  // the Class A cadet boards: the strip the engine draws is 0.5 in thick
  for(const [u, gender, m, rank] of [['blues_a', 'male', 'cadet', 'C/Col'], ['blues_a', 'female', 'cadet', 'C/Col']]){
    const scene = await compose(hb(u, gender, m, rank));
    for(const side of ['right', 'left']){
      const edge = byKey(scene, `grade:edge-${side}`);
      assert.ok(edge, `${u} ${gender} ${rank} ${side}: edge-on grade`);
      assert.ok(Math.abs(edge.w - (0.5 - 0.08)) < 0.005, `${u} ${gender} ${rank} ${side}: grade ${edge.w.toFixed(3)} in across the 0.5 in strip`);
    }
  }
  // the Class A coat's officers (senior and general): the strip is the sheet's own overlay, whose thickness follows from its epaulet_sleeve box and the strap's angle
  for(const [gender, key] of [['male', 'class_a_coat'], ['female', 'class_a_coat_female']]){
    const cord = JSON.parse(fs.readFileSync(path.join(root, 'images', 'cords', 'cord-wing.spec.json'), 'utf8')).garment_fit[key].strap_axis;
    const th = Math.atan2(Math.abs(cord[1][1] - cord[0][1]), Math.abs(cord[1][0] - cord[0][0])), cs = Math.cos(th), sn = Math.sin(th);
    for(const [rank, overlay] of [['Col', 'senior-officer'], ['Maj', 'senior-officer'], ['Brig Gen', 'general-officer']]){
      const sheet = `garment-blues-class-a-coat${gender === 'female' ? '-female' : ''}`;
      const box = JSON.parse(fs.readFileSync(path.join(root, 'images', 'garments', `${sheet}-${overlay}.spec.json`), 'utf8')).landmarks.epaulet_sleeve_right;
      const want = ((box.h / 100) * cs - (box.w / 100) * sn) / (cs * cs - sn * sn) - 0.08;
      const scene = await compose(hb('blues_a', gender, 'senior', rank));
      for(const side of ['right', 'left']){
        const edge = byKey(scene, `grade:edge-${side}`);
        assert.ok(edge, `Class A ${gender} ${rank} ${side}: edge-on grade`);
        assert.ok(Math.abs(edge.w - want) < 0.005 && want > 0.33, `Class A ${gender} ${rank} ${side}: grade ${edge.w.toFixed(3)} in across, the strip's thickness less 0.08 is ${want.toFixed(3)}`);
      }
    }
  }
});

// ---- 6. The mess dress boards: the same rule (FIX-R-OTHER-r4 item 3) --------------------------------------------------

test('mess dress boards: the edge-on grade keeps its true length along the strap and is squeezed only across the 0.4 in strip, as on the top view; 5/8 in from the outer end (R7; CAPR 39-1 4.1.1.1.1.1, 4.1.2.1.1.1; DAFI 36-2903 4.5.1.1.1)', async () => {
  const along = (l, u) => {
    const R = rad(l.rotate || 0), c = Math.cos(R), s = Math.sin(R);
    return Math.abs(l.w * (c * u.x + s * u.y)) + Math.abs(l.h * (-s * u.x + c * u.y));
  };
  const ranks = [['Capt', 0.8], ['Col', 0.6], ['Maj Gen', 1.5]];
  for(const gender of ['male', 'female']){
    for(const [rank, minAlong] of ranks){
      const scene = await compose(hb('mess_dress', gender, 'senior', rank));
      for(const side of ['right', 'left']){
        const label = `mess_dress ${gender} ${rank} ${side}`;
        const strip = byKey(scene, `epaulet-edge:${side}`), edge = byKey(scene, `grade:edge-${side}`), top = byKey(scene, `grade:top-${side}`);
        assert.ok(strip && edge && top, `${label}: strip, edge-on grade and top-view grade are drawn`);
        // The strap axis is the strip's long side; the cross axis is the strip's thickness.
        const r = rad(strip.rotate || 0), axis = { x: Math.cos(r), y: Math.sin(r) }, cross = { x: -Math.sin(r), y: Math.cos(r) };
        assert.ok(along(edge, cross) <= 0.32 + 0.005, `${label}: squeezed into the strip (${along(edge, cross).toFixed(3)} across)`);
        // The top view is level (DORAN5-ENG-3): its board's long side is horizontal.
        assert.ok(Math.abs(along(edge, axis) - along(top, { x: 1, y: 0 })) < 0.01, `${label}: edge-on length ${along(edge, axis).toFixed(3)} equals the top view's ${along(top, { x: 1, y: 0 }).toFixed(3)}`);
        assert.ok(along(edge, axis) >= minAlong, `${label}: ${along(edge, axis).toFixed(3)} in along the strap is not a speck`);
        // The grade's outer edge lies 5/8 in from the strip's outer end: half the strip's length, less the grade's
        // distance from the strip's centre along the strap and half its own length.
        const ctr = { x: strip.x + strip.w / 2, y: strip.y + strip.h / 2 }, ec = { x: edge.x + edge.w / 2, y: edge.y + edge.h / 2 };
        const off = Math.abs((ec.x - ctr.x) * axis.x + (ec.y - ctr.y) * axis.y);
        const fromEnd = strip.w / 2 - off - along(edge, axis) / 2;
        assert.ok(Math.abs(fromEnd - 0.625) < 0.01, `${label}: the grade is ${fromEnd.toFixed(3)} in from the outer end, not 5/8 in`);
      }
    }
  }
});
