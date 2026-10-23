'use strict';
// LIVE-DRESS B3 (Ethan, live site, Class A cadet officer): 'the diamonds are slightly off' on the edge-on board (rotate the grade with the
// strap axis, centre it on the strip line), 'there should be a cap logo here' and 'the shoulder board crest thing should be flattened on the
// lower copy as well'. The lower copy is the shoulder board of the view from above squeezed across the strap to the strip's 0.32 in, true
// length along it, its outer end on the strap's outer end, so the crest, the button and the blue band are on the strip and the grade is on
// the band's centre, on the strip's own line (CAPR 39-1 4.1.5.2.1.3, 4.1.9.3.4, Fig A5-6; R7).

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
const hb = (uniform, gender, rank) => HARNESS.makeBuild({ uniform, gender, membership: 'cadet', rank, name: { first: 'Pat', last: 'Doe', show: true }, opt: { rackColumns: 3, rackArrangement: 'lapel', miniStyle: 'mounting' } });
const rad = d => d * Math.PI / 180;
// The coat sheets' strap axis (the wearer's left shoulder: the viewer's right), neck end then arm end, sheet inches.
const STRAP = { male: { w: 23.726, axis: [[16.52, 2.44], [20.22, 3.41]] }, female: { w: 24.3883, axis: [[16.57, 1.91], [20.09, 2.65]] } };

test('Class A and cadet semi-formal: the edge-on board is the top board flattened, on the strap axis, with the grade on its blue band (4.1.5.2.1.3)', async () => {
  for(const uniform of ['blues_a', 'semi_formal_usaf']){
    for(const sex of ['male', 'female']){
      for(const rank of ['C/2d Lt', 'C/Maj', 'C/Col']){
        const scene = await P.composeUniform(hb(uniform, sex, rank), store);
        const overlay = scene.layers.find(l => /cadet-officer-insignia/.test(l.id || '') && l.role === 'garment-layer');
        assert.ok(overlay && overlay.hideGroups.includes('shoulder-strip-left') && overlay.hideGroups.includes('shoulder-strip-right'), `${uniform} ${sex} ${rank}: the overlay's own strip drawing is hidden`);
        for(const side of ['right', 'left']){
          const id = `garment-blues-shoulder-board-top-${sex}-${side}`;
          const tag = `${uniform} ${sex} ${rank} ${side}`;
          const strip = scene.layers.find(l => l.key === 'epaulet:' + side);
          assert.ok(strip, `${tag}: the flattened board is drawn`);
          assert.equal(strip.id, id);
          const spec = await store.load(id);
          const board = core.landmarkBounds(spec, 'board');
          // squeezed across to 0.32 in, true length along
          assert.ok(Math.abs(strip.h - spec.h * 0.32 / board.h) < 0.002, `${tag}: across ${strip.h}`);
          assert.ok(Math.abs(strip.w - spec.w) < 0.002, `${tag}: along ${strip.w} is the board's true length`);
          assert.ok(strip.clip && strip.clip.length === 4, `${tag}: cut at the strap's neck end`);
          // the strap's axis, outer end to neck end
          const [n, a] = STRAP[sex].axis, W = STRAP[sex].w;
          const neck = side === 'left' ? { x: n[0], y: n[1] } : { x: W - n[0], y: n[1] }, arm = side === 'left' ? { x: a[0], y: a[1] } : { x: W - a[0], y: a[1] };
          const len = Math.hypot(neck.x - arm.x, neck.y - arm.y), u = { x: (neck.x - arm.x) / len, y: (neck.y - arm.y) / len };
          // the board's outer-to-button direction lies on the strap axis
          const outer = core.anchor(spec, 'board_outer_end'), button = core.anchor(spec, 'button_end_center');
          const dir = core.rotatePoint({ x: button.x - outer.x, y: button.y - outer.y }, { x: 0, y: 0 }, strip.rotate);
          const dl = Math.hypot(dir.x, dir.y);
          assert.ok(Math.abs(dir.x / dl * u.y - dir.y / dl * u.x) < 0.0004, `${tag}: the board lies along the strap axis (cross ${(dir.x / dl * u.y - dir.y / dl * u.x).toFixed(5)})`);
          assert.ok(Math.hypot(strip.origin.x - arm.x, strip.origin.y - arm.y) < 0.005, `${tag}: its outer end is on the strap's outer end`);
          // the grade: on the strap's line, turned with it, centred on the band
          const grade = scene.layers.find(l => l.key === 'grade:edge-' + side);
          assert.ok(grade, `${tag}: the grade is on the strip`);
          const c = { x: grade.x + grade.w / 2, y: grade.y + grade.h / 2 };
          const perp = (c.x - arm.x) * u.y - (c.y - arm.y) * u.x;
          assert.ok(Math.abs(perp) < 0.005, `${tag}: grade centre ${perp.toFixed(4)} in off the strip line`);
          const slot = core.anchor(spec, 'rank_slot_center');
          const fromEnd = Math.hypot(slot.x - outer.x, slot.y - outer.y);
          assert.ok(Math.abs((c.x - arm.x) * u.x + (c.y - arm.y) * u.y - fromEnd) < 0.01, `${tag}: the grade is on the band's centre, ${fromEnd.toFixed(3)} in from the outer end`);
          const deg = (90 + Math.atan2(u.y, u.x) * 180 / Math.PI) % 180, got = ((grade.rotate % 180) + 180) % 180, want = ((deg % 180) + 180) % 180;
          assert.ok(Math.abs(got - want) < 0.02 || Math.abs(Math.abs(got - want) - 180) < 0.02, `${tag}: grade turn ${grade.rotate} follows the strap (${deg.toFixed(2)})`);
          assert.ok(strip.z < grade.z, `${tag}: the grade is above the board`);
        }
      }
    }
  }
});

test('Class A: the edge-on board and the view from above are one board (the same sheet, the same grade piece)', async () => {
  const scene = await P.composeUniform(hb('blues_a', 'male', 'C/Maj'), store);
  for(const side of ['right', 'left']){
    const top = scene.layers.find(l => l.key === 'epaulet-top:' + side), low = scene.layers.find(l => l.key === 'epaulet:' + side);
    assert.equal(top.id, low.id);
    assert.equal(scene.layers.find(l => l.key === 'grade:top-' + side).id, scene.layers.find(l => l.key === 'grade:edge-' + side).id);
  }
});
