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
// The edge-on mess board is the board art squeezed (layer.squeeze); `strip` is the rectangle it fills.
const edgeStrip = l => l && l.strip ? Object.assign({}, l, l.strip) : l;
const rad = d => d * Math.PI / 180;
// The centre line of the figure a layer belongs to (the second figure of a scene, the aviator shirt beside the blazer, is shifted).
const centreLine = (scene, l) => { const g = scene.layers.find(x => x.role === 'garment' && (x.figure || 1) === (l.figure || 1)); return g.x + g.w / 2; };

// ---- 5. Edge-on epaulet grade: foreshortened across the strap, true length along it ----------------------------------

test('edge-on epaulet grades keep their true length along the strap and are squeezed only across it (the strip keeps its length and is squeezed across); the colonel\'s eagle is as long on the strip as on the top view (R7; CAPR 39-1 4.2.5.1.1.1, 4.2.6.2.1; DAFI 36-2903 4.5.1.1.1)', async () => {
  const along = (l, u) => {
    const R = rad(l.rotate || 0), c = Math.cos(R), s = Math.sin(R);
    return Math.abs(l.w * (c * u.x + s * u.y)) + Math.abs(l.h * (-s * u.x + c * u.y));
  };
  let compared = 0, edgeOnly = 0;
  const cases = [];
  for(const gender of ['male', 'female']){
    for(const u of ['aviator', 'aviator_blazer', 'blues_b']) for(const rank of ['Capt', 'Maj', 'Lt Col', 'Col', 'Maj Gen']) cases.push([u, gender, 'senior', rank]);
    cases.push(['blues_b', gender, 'cadet', 'C/Maj'], ['blues_b', gender, 'cadet', 'C/Col']);
  }
  for(const [u, gender, membership, rank] of cases){
    const scene = await compose(hb(u, gender, membership, rank));
    for(const side of ['right', 'left']){
      const edge = byKey(scene, `grade:edge-${side}`), top = byKey(scene, `grade:top-${side}`), view = byKey(scene, `epaulet-top:${side}`);
      if(!edge || !view) continue;
      const label = `${u} ${gender} ${rank} ${side}`;
      // The strap axis: the sheet's epaulet landmark frame (the top view is drawn level since DORAN5-ENG-3, so its own long side is
      // horizontal, not along the strap).
      const spec = await store.load(scene.garment);
      if(!spec.landmarks[`epaulet_${side}`]) continue; // the blazer's companion shirt sheet is not the scene's garment
      const fr = P.helpers.frameFromPolygon({ base: { w: spec.w } }, side, spec.landmarks[`epaulet_${side}`].points);
      const r = rad(fr.deg);
      const axis = { x: -Math.sin(r), y: Math.cos(r) }, cross = { x: Math.cos(r), y: Math.sin(r) };
      const lvl = { x: 1, y: 0 };
      // The shirts' strip is 0.5 in thick since LIVE7-2 (the Class A boards' strip), the grade squeezed to 0.08 in less.
      assert.ok(along(edge, cross) <= 0.42 + 0.005 || along(edge, axis) >= along(edge, cross), `${label}: edge-on grade fits the 0.5 in strip (${along(edge, cross).toFixed(3)} across)`);
      assert.ok(along(edge, cross) <= 0.42 + 0.005, `${label}: squeezed to the strip (${along(edge, cross).toFixed(3)} across)`);
      if(top){
        assert.ok(Math.abs(along(edge, axis) - along(top, lvl)) < 0.01, `${label}: edge-on length ${along(edge, axis).toFixed(3)} equals the top view's ${along(top, lvl).toFixed(3)}`);
        compared++;
      }else edgeOnly++;
      if(rank === 'Col' && membership === 'senior') assert.ok(along(edge, axis) > 0.6, `${label}: the eagle is ${along(edge, axis).toFixed(3)} in long on the strip, not a speck`);
    }
  }
  assert.ok(compared >= 4, `${compared} edge/top pairs compared (${edgeOnly} grades with the edge view only)`);
});

// ---- 5b. LIVE8-4: the grade on an edge-on strip is sized from that strip's thickness, on every uniform that draws one ----------------------------------

test('the edge-on grade is squeezed to its strip\'s thickness less 0.08 in on the shirts (the 0.46 in the sheets state, LIVE10-9), the Class A boards (0.5 in) and the Class A officers\' strap strip (the thickness its sheet states, about 0.46 in), not to a fixed 0.32 in (DAFI 36-2903 4.5.1.1.1; CAPR 39-1 4.1.5.2.1, 4.1.11.1.1, 4.2.5.1.1.1)', async () => {
  // the shirts (the strip is as thick as the sheet's band, epaulet_axis.edge_thickness_in, 0.46 in on all ten sheets) and the Class A cadet boards (the strip the engine draws is 0.5 in thick)
  const garmentOf = { 'blues_b male': 'garment-blues-class-b-shirt-male', 'blues_b female': 'garment-blues-class-b-blouse-female', 'aviator male': 'garment-aviator-shirt-male', 'aviator female': 'garment-aviator-shirt-female' };
  for(const [u, gender, m, rank] of [['blues_b', 'male', 'senior', 'Col'], ['blues_b', 'female', 'cadet', 'C/Col'], ['aviator', 'male', 'senior', 'Maj'], ['aviator', 'female', 'senior', 'Col'], ['blues_a', 'male', 'cadet', 'C/Col'], ['blues_a', 'female', 'cadet', 'C/Col']]){
    const scene = await compose(hb(u, gender, m, rank));
    const g = garmentOf[`${u} ${gender}`];
    let thick = 0.5;
    if(g){
      const raw = JSON.parse(fs.readFileSync(path.join(root, 'images', 'garments', `${g}.spec.json`), 'utf8')).landmarks.epaulet_axis;
      thick = raw.right.edge_thickness_in;
      assert.equal(thick, 0.46, `${g}: the sheet states its band's thickness`);
    }
    for(const side of ['right', 'left']){
      const edge = byKey(scene, `grade:edge-${side}`);
      assert.ok(edge, `${u} ${gender} ${rank} ${side}: edge-on grade`);
      assert.ok(Math.abs(edge.w - (thick - 0.08)) < 0.005, `${u} ${gender} ${rank} ${side}: grade ${edge.w.toFixed(3)} in across the ${thick} in strip`);
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

test('mess dress boards: the edge-on grade keeps its true length along the strap and is squeezed only across the 0.4 in strip, as on the top view; at the top view\'s rank slot, shortened with the strip (R7; LIVE11-MASTER-1; CAPR 39-1 4.1.1.1.1.1, 4.1.2.1.1.1; DAFI 36-2903 4.5.1.1.1)', async () => {
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
        const strip = edgeStrip(byKey(scene, `epaulet-edge:${side}`)), edge = byKey(scene, `grade:edge-${side}`), top = byKey(scene, `grade:top-${side}`);
        assert.ok(strip && edge && top, `${label}: strip, edge-on grade and top-view grade are drawn`);
        // The strap axis is the strip's long side; the cross axis is the strip's thickness.
        const r = rad(strip.rotate || 0), axis = { x: Math.cos(r), y: Math.sin(r) }, cross = { x: -Math.sin(r), y: Math.cos(r) };
        assert.ok(along(edge, cross) <= 0.32 + 0.005, `${label}: squeezed into the strip (${along(edge, cross).toFixed(3)} across)`);
        // The top view is level (DORAN5-ENG-3): its board's long side is horizontal.
        assert.ok(Math.abs(along(edge, axis) - along(top, { x: 1, y: 0 })) < 0.01, `${label}: edge-on length ${along(edge, axis).toFixed(3)} equals the top view's ${along(top, { x: 1, y: 0 }).toFixed(3)}`);
        assert.ok(along(edge, axis) >= minAlong, `${label}: ${along(edge, axis).toFixed(3)} in along the strap is not a speck`);
        // The grade's centre lies as far from the strip's outer end as the top view's rank slot is from the board's outer end (2.6 in men, 2.0 in women), shortened
        // with the board to the strip's 82% of its length (LIVE11-MASTER-1: the strip is the top view squeezed, so the grade is where the top view has it), never nearer the end than 5/8 in.
        const ctr = { x: strip.x + strip.w / 2, y: strip.y + strip.h / 2 }, ec = { x: edge.x + edge.w / 2, y: edge.y + edge.h / 2 };
        const off = Math.abs((ec.x - ctr.x) * axis.x + (ec.y - ctr.y) * axis.y);
        const fromEnd = strip.w / 2 - off - along(edge, axis) / 2;
        // The sheets' rank slot lies 2.6 in (men) and 2.0 in (women) from the board's outer end along its length (measured from rank_slot_<side>_center and the board's outer corner).
        const slotAlong = gender === 'male' ? 2.6 : 1.99;
        assert.ok(Math.abs(fromEnd + along(edge, axis) / 2 - slotAlong * 0.82) < 0.02 && fromEnd > 0.625 - 0.01, `${label}: the grade's outer edge is ${fromEnd.toFixed(3)} in from the outer end, its centre ${(fromEnd + along(edge, axis) / 2).toFixed(3)} against the slot's ${(slotAlong * 0.82).toFixed(3)}`);
      }
    }
  }
});

// LIVE11-MASTER-1 (Ethan: "top here does not match bottom. all tops must match everything on the bottom"): the mess dress boards' edge-on strip is the board art of the view from above,
// the whole of it (bands, button, pointed neck end), squeezed along the strap to 82% and across it to 0.4 in about the board's upper outer corner, not a plain rectangle.
test('mess dress boards: the edge-on strip is the view from above\'s board art squeezed onto the 0.4 in x 82% strip, not a plain rectangle (LIVE11-MASTER-1)', async () => {
  for(const gender of ['male', 'female']){
    for(const rank of ['Capt', 'Col', 'Maj Gen']){
      const scene = await compose(hb('mess_dress', gender, 'senior', rank));
      for(const side of ['right', 'left']){
        const top = byKey(scene, `epaulet-top:${side}`), edge = byKey(scene, `epaulet-edge:${side}`);
        assert.equal(edge.type, 'asset', `${gender} ${rank} ${side}: art, not a rectangle`);
        assert.equal(edge.id, top.id, `${gender} ${rank} ${side}: the same board art as the view from above`);
        assert.ok(!edge.hideGroups && !edge.onlyGroups, 'the whole board is drawn');
        const L = gender === 'male' ? 5.5 : 4.5, W = gender === 'male' ? 2.25 : 2.0;
        assert.ok(Math.abs(edge.squeeze.kx - 0.82) < 1e-9 && Math.abs(edge.squeeze.ky - 0.4 / W) < 1e-9, `${gender} ${rank} ${side}: squeezed to 82% along and 0.4 in across`);
        assert.ok(Math.abs(edge.strip.w - L * 0.82) < 1e-9 && Math.abs(edge.strip.h - 0.4) < 1e-9);
        assert.ok(edge.clip && edge.clip.length === 4, 'cut to the squeezed board box');
      }
    }
  }
});
