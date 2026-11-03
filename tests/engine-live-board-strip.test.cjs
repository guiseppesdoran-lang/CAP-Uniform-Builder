'use strict';
// LIVE-DRESS B3 (Ethan, live site, Class A cadet officer): 'the diamonds are slightly off' on the edge-on board (rotate the grade with the
// strap axis, centre it on the strip line), 'there should be a cap logo here' and 'the shoulder board crest thing should be flattened on the
// lower copy as well'; then 'the shoulder boards on the uniform are missing the triangle part, and it's looking a little flat'. The lower
// copy is the shoulder board of the view from above foreshortened across the strap to 0.5 in, true length along it, its outer end on the
// strap's outer end and its pointed neck end (the peak, with the button) running on past the strap's neck end, drawn over the collar leaf;
// its upper edge stays on the strap's (the strap is 0.4 in), so the strip grows downward by 0.05 in on the centre line, and two flat bands
// (light above, dark below) give it depth. The crest, the button and the blue band are on the strip and the grade is on the band's centre
// (CAPR 39-1 4.1.5.2.1.3, 4.1.9.3.4, Fig A5-6; R7).

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
const hb = (uniform, gender, rank, membership) => HARNESS.makeBuild({ uniform, gender, membership: membership || 'cadet', rank, name: { first: 'Pat', last: 'Doe', show: true }, opt: { rackColumns: 3, rackArrangement: 'lapel', miniStyle: 'mounting' } });
const rad = d => d * Math.PI / 180;
// The strip is 0.5 in across with its upper edge on the strap's (0.4 in): its centre line lies 0.05 in below the strap axis.
const DROP = { thick: 0.5, drop: 0.05 };
// The coat sheets' strap axis (the wearer's left shoulder: the viewer's right), neck end then arm end, sheet inches: what the sheets state
// (the shoulder cord assets' garment_fit), read from the shipped specs.
const SHEET = require('./helpers/class-a-sheet.cjs');
const STRAP = { male: SHEET.strap('male'), female: SHEET.strap('female') };

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
          // foreshortened across to 0.5 in, true length along, not cut at the strap's neck end (the peak and the button show)
          assert.ok(Math.abs(strip.h - spec.h * DROP.thick / board.h) < 0.002, `${tag}: across ${strip.h}`);
          assert.ok(Math.abs(strip.w - spec.w) < 0.002, `${tag}: along ${strip.w} is the board's true length`);
          assert.ok(!strip.clip, `${tag}: not cut at the strap's neck end`);
          // the strap's axis, outer end to neck end
          const [n, a] = STRAP[sex].axis, W = STRAP[sex].w;
          const neck = side === 'left' ? { x: n[0], y: n[1] } : { x: W - n[0], y: n[1] }, arm = side === 'left' ? { x: a[0], y: a[1] } : { x: W - a[0], y: a[1] };
          const len = Math.hypot(neck.x - arm.x, neck.y - arm.y), u = { x: (neck.x - arm.x) / len, y: (neck.y - arm.y) / len };
          // the board's outer-to-button direction lies on the strap axis
          const outer = core.anchor(spec, 'board_outer_end'), button = core.anchor(spec, 'button_end_center');
          const dir = core.rotatePoint({ x: button.x - outer.x, y: button.y - outer.y }, { x: 0, y: 0 }, strip.rotate);
          const dl = Math.hypot(dir.x, dir.y);
          assert.ok(Math.abs(dir.x / dl * u.y - dir.y / dl * u.x) < 0.0004, `${tag}: the board lies along the strap axis (cross ${(dir.x / dl * u.y - dir.y / dl * u.x).toFixed(5)})`);
          let down = { x: u.y, y: -u.x };
          if(down.y < 0) down = { x: -down.x, y: -down.y };
          const off = p => ({ along: (p.x - arm.x) * u.x + (p.y - arm.y) * u.y, down: (p.x - arm.x) * down.x + (p.y - arm.y) * down.y });
          assert.ok(Math.abs(off(strip.origin).along) < 0.005 && Math.abs(off(strip.origin).down - DROP.drop) < 0.005, `${tag}: its outer end is on the strap's outer end, ${DROP.drop} in down (${JSON.stringify(off(strip.origin))})`);
          // the grade: on the strap's line, turned with it, centred on the band
          const grade = scene.layers.find(l => l.key === 'grade:edge-' + side);
          assert.ok(grade, `${tag}: the grade is on the strip`);
          const c = { x: grade.x + grade.w / 2, y: grade.y + grade.h / 2 };
          assert.ok(Math.abs(off(c).down - DROP.drop) < 0.005, `${tag}: grade centre ${off(c).down.toFixed(4)} in below the strap axis, on the strip's centre line`);
          const slot = core.anchor(spec, 'rank_slot_center');
          const fromEnd = Math.hypot(slot.x - outer.x, slot.y - outer.y);
          assert.ok(Math.abs(off(c).along - fromEnd) < 0.01, `${tag}: the grade is on the band's centre, ${fromEnd.toFixed(3)} in from the outer end`);
          const deg = (180 + Math.atan2(u.y, u.x) * 180 / Math.PI) % 180,   // E123: the cadet officer's row runs along the strap, a quarter turn from the strap's own
             got = ((grade.rotate % 180) + 180) % 180, want = ((deg % 180) + 180) % 180;
          assert.ok(Math.abs(got - want) < 0.02 || Math.abs(Math.abs(got - want) - 180) < 0.02, `${tag}: grade turn ${grade.rotate} follows the strap, a quarter turned (${deg.toFixed(2)})`);
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

// ---- the whole board, with its peak and its button, and the depth bands (Ethan: 'missing the triangle part ... a little flat') ----------


test('the edge-on board keeps its whole outline: as long as the top view, so the peak runs past the strap\'s neck end, and its button lies within the strip', async () => {
  for(const uniform of ['blues_a', 'semi_formal_usaf']) for(const sex of ['male', 'female']) for(const rank of ['C/2d Lt', 'C/Maj', 'C/Col']){
    const scene = await P.composeUniform(hb(uniform, sex, rank), store);
    const [n, a] = STRAP[sex].axis, strapLen = Math.hypot(a[0] - n[0], a[1] - n[1]);
    for(const side of ['right', 'left']){
      const tag = `${uniform} ${sex} ${rank} ${side}`;
      const strip = scene.layers.find(l => l.key === 'epaulet:' + side), top = scene.layers.find(l => l.key === 'epaulet-top:' + side);
      assert.ok(Math.abs(strip.w - top.w) <= 0.05, `${tag}: strip ${strip.w} in long against the top view's ${top.w}`);
      const spec = await store.load(strip.id), outer = core.anchor(spec, 'board_outer_end'), button = core.anchor(spec, 'button_end_center'), board = core.landmarkBounds(spec, 'board');
      // The art's x runs along the strap, y across it, squeezed by strip.h / spec.h about the outer end.
      const sy = strip.h / spec.h;
      const loc = p => ({ x: strip.origin.x + (p.x - outer.x), y: strip.origin.y + (p.y - outer.y) * sy });
      const toScene = p => core.rotatePoint(loc(p), strip.origin, strip.rotate);
      const bl = Math.hypot(button.x - outer.x, button.y - outer.y), tip = toScene({ x: outer.x + (button.x - outer.x) / bl * board.w, y: outer.y });
      const W = STRAP[sex].w, [nn, aa] = STRAP[sex].axis;
      const arm = side === 'left' ? { x: aa[0], y: aa[1] } : { x: W - aa[0], y: aa[1] };
      assert.ok(Math.hypot(tip.x - arm.x, tip.y - arm.y) >= board.w - 0.05, `${tag}: the peak's tip is ${Math.hypot(tip.x - arm.x, tip.y - arm.y).toFixed(3)} in from the outer end (the board is ${board.w})`);
      // The board is 4.55 in (true size, Fig A5-6); the strap is what the sheet states: 3.82 in on the men's coat before it was drawn at true scale
      // (art e1b1ab14, x1.0882: 4.16 in), 3.6 in on the women's. The peak (BOARD_PEAK, 0.74 in) overhangs the neck end by what is left, 0.39 in on the men's coat.
      assert.ok(board.w > strapLen + 0.3, `${tag}: the board is longer than the strap, so its peak lies past the strap's neck end (${(board.w - strapLen).toFixed(2)} in)`);
      // The button is inside the strip's box.
      const b = toScene(button);
      const rotBack = core.rotatePoint(b, strip.origin, -(strip.rotate || 0));
      assert.ok(rotBack.x >= strip.x && rotBack.x <= strip.x + strip.w && rotBack.y >= strip.y && rotBack.y <= strip.y + strip.h, `${tag}: the button lies within the strip`);
      // Drawn over the collar leaf (the lapel foreground, Z badge + 0.5) and under no hat; the cord is under it.
      const fg = scene.layers.find(l => /lapel-foreground/.test(l.id || ''));
      if(fg) assert.ok(strip.z > fg.z, `${tag}: the board is over the collar leaf (z ${strip.z} against ${fg.z})`);
    }
  }
});

test('the edge-on board and the officers\' epaulet strips on the Class A coat have depth: a light band above and a dark band below, flat tints cut to the strip', async () => {
  const cases = [['blues_a', 'male', 'cadet', 'C/Maj'], ['semi_formal_usaf', 'female', 'cadet', 'C/Col'], ['blues_a', 'male', 'senior', 'Capt'], ['blues_a', 'female', 'senior', 'Maj'], ['blues_a', 'male', 'senior', 'Maj Gen']];
  for(const [uniform, sex, membership, rank] of cases){
    const scene = await P.composeUniform(hb(uniform, sex, rank, membership), store);
    for(const side of ['right', 'left']){
      const tag = `${uniform} ${sex} ${rank} ${side}`;
      const light = scene.layers.find(l => l.key === `epaulet-shade:light:${side}`), dark = scene.layers.find(l => l.key === `epaulet-shade:dark:${side}`);
      assert.ok(light && dark, `${tag}: both bands are drawn`);
      assert.equal(light.type, 'rect');
      assert.ok(light.fill === '#ffffff' && dark.fill === '#000000' && light.fillOpacity > 0 && light.fillOpacity < 0.3 && dark.fillOpacity > light.fillOpacity && dark.fillOpacity < 0.5, `${tag}: flat white and black tints (R2)`);
      assert.ok(Math.abs(light.h - 0.06) < 1e-9 && Math.abs(dark.h - 0.06) < 1e-9, `${tag}: bands 0.06 in thick`);
      // the light band lies above the dark one across the strip (up is the strap's outward normal, away from the garment)
      const mid = l => core.rotatePoint({ x: l.x + l.w / 2, y: l.y + l.h / 2 }, l.origin, l.rotate);
      assert.ok(mid(light).y < mid(dark).y, `${tag}: light above dark`);
      const edge = scene.layers.find(l => l.key === 'epaulet:' + side) || scene.layers.find(l => l.role === 'garment-layer' && /-(senior|general)-officer$/.test(l.id));
      assert.ok(light.z > edge.z && dark.z > edge.z, `${tag}: the bands are over the strip (${light.z} against ${edge.z})`);
      const grade = scene.layers.find(l => l.key === 'grade:edge-' + side);
      if(grade) assert.ok(grade.z > light.z, `${tag}: the grade is over the bands`);
      if(membership === 'cadet') assert.ok(light.clip && light.clip.length === 5, `${tag}: cut to the board's pointed outline`);
    }
  }
  // Nothing is drawn on a coat with no strip: cadet NCOs, senior NCOs, and the semi-formal's officers' strips (the semi-formal wears boards only).
  for(const [uniform, sex, membership, rank] of [['blues_a', 'male', 'cadet', 'C/SSgt'], ['blues_a', 'male', 'senior', 'SMSgt']]){
    const scene = await P.composeUniform(hb(uniform, sex, rank, membership), store);
    assert.ok(!scene.layers.some(l => l.role === 'epaulet-shade'), `${rank}: no strip, no shading`);
  }
});
