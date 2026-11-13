'use strict';
// LIVE-DRESS B3 (Ethan, live site, Class A cadet officer): 'the diamonds are slightly off' on the edge-on board (rotate the grade with the
// strap axis, centre it on the strip line), 'there should be a cap logo here' and 'the shoulder board crest thing should be flattened on the
// lower copy as well'; then 'the shoulder boards on the uniform are missing the triangle part, and it's looking a little flat'. The lower
// copy is the shoulder board of the view from above foreshortened across the strap (to THICK below), true length along it, its outer end on the
// strap's outer end and its pointed neck end (the peak, with the button) running on past the strap's neck end, drawn over the collar leaf;
// its upper edge on the sheet's shoulder seam (B5, 2026-11-10; from 2 November its centre line was on it), its outer end on the shoulder point, and two flat bands
// (light above, dark below) give it depth. 2026-11-12 (the owner: "why does it curve up at the end? it should be rounded like it is in real life. having it flat is killing me"): it shows as thick as the
// figures that draw it worn draw it (1.05 in, not 0.5), its corners are rounded as the real board's are, and its point narrows to the middle of the strip instead of being sheared up onto the upper edge. The crest, the button and the blue band are on the strip and the grade is on the band's centre
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
// The strip is THICK across and its UPPER edge is the coat's own upper outline, the outer edge of its stroke (Ethan, 2 November 2026: "the shoulder boards on class a's should always match the shoulder
// seam" put its centre line on the seam; 2026-11-10, B5: "she class a blue shouldet boards are slightly levetating", the upper half stood over the page above the shoulder; then "theres some coat blue above
// the board"): the seam moved out by the half stroke (0.03 in) on the men's coats, whose shoulder line is one straight run, and by what clears the bend of the shoulder line on the women's coats. The centre
// line lies half a strip less that below the seam, so the whole board is on the coat and the stroke is covered. The board's point narrows to the middle of the strip, from both edges.
const THICK = P.helpers.BOARD_STRIP_THICK;
// The coat sheets' shoulder seam on each side, neck end then shoulder point, sheet inches, measured from the sheets' own silhouettes.
const SHEET = require('./helpers/class-a-sheet.cjs');
const COATS = { blues_a: { male: 'garment-blues-class-a-coat', female: 'garment-blues-class-a-coat-female' }, semi_formal_usaf: { male: 'garment-semiformal-class-a-coat-male', female: 'garment-semiformal-class-a-coat-female' } };
const seamOf = (uniform, sex, side) => SHEET.seam(COATS[uniform][sex], side);
// How far the board's upper edge stands out from the seam on this coat and side (the engine's fit to the sheet's outline), and so how far its centre line lies below it.
const shiftOf = (uniform, sex, side) => P.helpers.boardEdgeShift(COATS[uniform][sex], side).shift;
const dropOf = (uniform, sex, side) => THICK / 2 - shiftOf(uniform, sex, side);

test('Class A and cadet semi-formal: the edge-on board is the top board flattened, on the shoulder seam, with the grade on its blue band (4.1.5.2.1.3)', async () => {
  for(const uniform of ['blues_a', 'semi_formal_usaf']){
    for(const sex of ['male', 'female']){
      for(const rank of ['C/2d Lt', 'C/Maj', 'C/Col']){
        const scene = await P.composeUniform(hb(uniform, sex, rank), store);
        const overlay = scene.layers.find(l => /cadet-officer-insignia/.test(l.id || '') && l.role === 'garment-layer');
        assert.ok(overlay && overlay.hideGroups.includes('shoulder-strip-left') && overlay.hideGroups.includes('shoulder-strip-right'), `${uniform} ${sex} ${rank}: the overlay's own strip drawing is hidden`);
        for(const side of ['right', 'left']){
          const id = `garment-blues-shoulder-board-top-${sex}-${side}`;
          const tag = `${uniform} ${sex} ${rank} ${side}`, drop = dropOf(uniform, sex, side);
          const strip = scene.layers.find(l => l.key === 'epaulet:' + side);
          assert.ok(strip, `${tag}: the flattened board is drawn`);
          assert.equal(strip.id, id);
          const spec = await store.load(id);
          const board = core.landmarkBounds(spec, 'board');
          // foreshortened across to THICK, true length along, not cut at the strap's neck end (the peak and the button show)
          assert.ok(Math.abs(strip.h - spec.h * THICK / board.h) < 0.002, `${tag}: across ${strip.h}`);
          assert.ok(Math.abs(strip.w - spec.w) < 0.002, `${tag}: along ${strip.w} is the board's true length`);
          // not cut at the strap's neck end: one piece, cut to the board's own outline (the point and the rounded corners), not sheared
          assert.ok(strip.clip && !strip.shear && !scene.layers.some(l => l.key === 'epaulet-tip:' + side), `${tag}: the board is one piece cut to its outline`);
          // the shoulder seam, outer end (the shoulder point) to neck end (the collar seam)
          const sm = seamOf(uniform, sex, side), neck = sm.neck, arm = sm.outer;
          const len = Math.hypot(neck.x - arm.x, neck.y - arm.y), u = { x: (neck.x - arm.x) / len, y: (neck.y - arm.y) / len };
          // the board's outer-to-button direction lies on the strap axis
          const outer = core.anchor(spec, 'board_outer_end'), button = core.anchor(spec, 'button_end_center');
          const dir = core.rotatePoint({ x: button.x - outer.x, y: button.y - outer.y }, { x: 0, y: 0 }, strip.rotate);
          const dl = Math.hypot(dir.x, dir.y);
          assert.ok(Math.abs(dir.x / dl * u.y - dir.y / dl * u.x) < 0.0004, `${tag}: the board lies along the strap axis (cross ${(dir.x / dl * u.y - dir.y / dl * u.x).toFixed(5)})`);
          let down = { x: u.y, y: -u.x };
          if(down.y < 0) down = { x: -down.x, y: -down.y };
          const off = p => ({ along: (p.x - arm.x) * u.x + (p.y - arm.y) * u.y, down: (p.x - arm.x) * down.x + (p.y - arm.y) * down.y });
          assert.ok(Math.abs(off(strip.origin).along) < 0.005 && Math.abs(off(strip.origin).down - drop) < 0.005, `${tag}: its outer end is on the shoulder point, its axis on the seam (${JSON.stringify(off(strip.origin))})`);
          // the grade: on the strap's line, turned with it, centred on the band
          const grade = scene.layers.find(l => l.key === 'grade:edge-' + side);
          assert.ok(grade, `${tag}: the grade is on the strip`);
          const c = { x: grade.x + grade.w / 2, y: grade.y + grade.h / 2 };
          // the grade's row has its centre line BOARD_GRADE_ROW of the strip's thickness below the strip's upper edge (the guidance figures), not on the strip's centre line
          const rowDown = drop - (0.5 - P.helpers.BOARD_GRADE_ROW) * THICK;
          assert.ok(Math.abs(off(c).down - rowDown) < 0.005, `${tag}: grade centre ${off(c).down.toFixed(4)} in below the seam, on the row's line (${rowDown.toFixed(4)})`);
          const slot = core.anchor(spec, 'rank_slot_center');
          const fromEnd = Math.hypot(slot.x - outer.x, slot.y - outer.y);
          assert.ok(Math.abs(off(c).along - fromEnd) < 0.01, `${tag}: the grade is on the band's centre, ${fromEnd.toFixed(3)} in from the outer end`);
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

// ---- the whole board, with its peak and its button, and the depth bands (Ethan: 'missing the triangle part ... a little flat') ----------


test('the edge-on board keeps its whole outline: as long as the top view, the peak and the button on the strip, its outer end on the shoulder point and its true length along the seam (4.55 in), and its button lies within the strip', async () => {
  for(const uniform of ['blues_a', 'semi_formal_usaf']) for(const sex of ['male', 'female']) for(const rank of ['C/2d Lt', 'C/Maj', 'C/Col']){
    const scene = await P.composeUniform(hb(uniform, sex, rank), store);
    for(const side of ['right', 'left']){
      const tag = `${uniform} ${sex} ${rank} ${side}`;
      const strip = scene.layers.find(l => l.key === 'epaulet:' + side), top = scene.layers.find(l => l.key === 'epaulet-top:' + side);
      assert.ok(Math.abs(strip.w - top.w) <= 0.05, `${tag}: strip ${strip.w} in long against the top view's ${top.w}`);
      const spec = await store.load(strip.id), outer = core.anchor(spec, 'board_outer_end'), button = core.anchor(spec, 'button_end_center'), board = core.landmarkBounds(spec, 'board');
      // The art's x runs along the strap, y across it, squeezed by strip.h / spec.h about the outer end.
      const sy = strip.h / spec.h;
      const loc = p => ({ x: strip.origin.x + (p.x - outer.x), y: strip.origin.y + (p.y - outer.y) * sy });
      const toScene = p => core.rotatePoint(loc(p), strip.origin, strip.rotate);
      const drop = dropOf(uniform, sex, side);
      const bl = Math.hypot(button.x - outer.x, button.y - outer.y), tip = toScene({ x: outer.x + (button.x - outer.x) / bl * board.w, y: outer.y });
      const sm = seamOf(uniform, sex, side), arm = sm.outer, neck = sm.neck;
      const useam = { x: (neck.x - arm.x) / Math.hypot(neck.x - arm.x, neck.y - arm.y), y: (neck.y - arm.y) / Math.hypot(neck.x - arm.x, neck.y - arm.y) };
      let dn = { x: useam.y, y: -useam.x }; if(dn.y < 0) dn = { x: -dn.x, y: -dn.y };
      assert.ok(Math.hypot(strip.origin.x - (arm.x + dn.x * drop), strip.origin.y - (arm.y + dn.y * drop)) < 0.005, `${tag}: the board's outer end is on the shoulder point, its upper edge on the coat's outline`);
      // The tip is the board's true length from the outer end along the seam, and (the point narrowing from both edges) on the strip's centre line, half a strip below the upper edge line: the seam moved
      // out by the shift.
      const len = Math.hypot(neck.x - arm.x, neck.y - arm.y), u = { x: (neck.x - arm.x) / len, y: (neck.y - arm.y) / len };
      const tipAlong = (tip.x - arm.x) * u.x + (tip.y - arm.y) * u.y, tipDown = (tip.x - arm.x) * dn.x + (tip.y - arm.y) * dn.y;
      assert.ok(Math.abs(tipAlong - board.w) < 0.02, `${tag}: the peak's tip is ${tipAlong.toFixed(3)} in from the outer end along the seam (the board is ${board.w})`);
      assert.ok(Math.abs(tipDown - (THICK / 2 - shiftOf(uniform, sex, side))) < 0.01, `${tag}: the peak's tip is ${tipDown.toFixed(3)} in below the seam, on the strip's centre line (${(THICK / 2 - shiftOf(uniform, sex, side)).toFixed(3)})`);
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
      if(membership === 'cadet') assert.ok(light.clip && light.clip.length > 8, `${tag}: cut to the board's pointed, rounded outline${sex === 'male' ? '' : ' and the coat\'s outline'}`);
    }
  }
  // Nothing is drawn on a coat with no strip: cadet NCOs, senior NCOs, and the semi-formal's officers' strips (the semi-formal wears boards only).
  for(const [uniform, sex, membership, rank] of [['blues_a', 'male', 'cadet', 'C/SSgt'], ['blues_a', 'male', 'senior', 'SMSgt']]){
    const scene = await P.composeUniform(hb(uniform, sex, rank, membership), store);
    assert.ok(!scene.layers.some(l => l.role === 'epaulet-shade'), `${rank}: no strip, no shading`);
  }
});

// B5 (Ethan, 2026-11-10: "she class a blue shouldet boards are slightly levetating"; a strip of background between the board and the coat): the edge-on board lies on the coat. Its upper
// edge is the shoulder seam, so the strip's outer end, its lower edge and its peak are inside the coat's silhouette and no part of it is over the page below the shoulder line. With its axis on the seam
// (2 November) its upper half stood 0.25 in above the shoulder and its outer end hung over the corner of the sleeve.
test('Class A and cadet semi-formal: no part of the edge-on board is outside the coat below the shoulder line: the outer end, the lower edge and the peak lie on the coat, both cuts, both sides, every cadet officer grade (B5)', async () => {
  const src = fs.readFileSync(path.join(root, 'js', 'engine', 'profiles-dress.js'), 'utf8');
  const TOP = new Function(/\/\/ GARMENT_TOP begin\n([\s\S]*?)\/\/ GARMENT_TOP end/.exec(src)[1] + '; return GARMENT_TOP;')();
  const inside = (poly, p) => { let c = false; for(let i = 0, j = poly.length - 1; i < poly.length; j = i++){ const a = poly[i], b = poly[j]; if((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) c = !c; } return c; };
  const edgeDist = (poly, p) => Math.min(...poly.map((a, i) => { const b = poly[(i + 1) % poly.length], dx = b.x - a.x, dy = b.y - a.y, t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy); }));
  let n = 0;
  for(const uniform of ['blues_a', 'semi_formal_usaf']) for(const sex of ['male', 'female']) for(const rank of ['C/2d Lt', 'C/Maj', 'C/Col']){
    const scene = await P.composeUniform(hb(uniform, sex, rank), store);
    const sheet = scene.layers.find(l => l.role === 'garment'), poly = TOP[sheet.id].map(([x, y]) => ({ x, y }));
    for(const side of ['right', 'left']){
      const strip = scene.layers.find(l => l.key === 'epaulet:' + side), tag = `${uniform} ${sex} ${rank} ${side}`;
      // The strip's outline in the art's frame (the layer squeezes the board across to THICK about its outer end, as the tests above place it): sample the board's outer end, the edge that is the lower one on the
      // sheet from there to 80% of the board's length, and the peak's tip.
      const spec = await store.load(strip.id), outer = core.anchor(spec, 'board_outer_end'), button = core.anchor(spec, 'button_end_center'), board = core.landmarkBounds(spec, 'board');
      const bl = Math.hypot(button.x - outer.x, button.y - outer.y), d = { x: (button.x - outer.x) / bl, y: (button.y - outer.y) / bl }, sy = strip.h / spec.h;
      const toScene = (s_, v) => core.rotatePoint({ x: strip.origin.x + d.x * s_, y: strip.origin.y + v * sy }, strip.origin, strip.rotate);
      const hb2 = board.h / 2, pts = [], lowA = [], lowB = [];
      for(let i = 0; i <= 12; i++){ lowA.push(toScene(board.w * 0.8 * i / 12, hb2)); lowB.push(toScene(board.w * 0.8 * i / 12, -hb2)); }
      pts.push(...(lowA.reduce((t, q) => t + q.y, 0) > lowB.reduce((t, q) => t + q.y, 0) ? lowA : lowB));
      for(let j = 0; j <= 6; j++) pts.push(toScene(0, hb2 * (2 * j / 6 - 1)));
      const tipPoint = toScene(board.w, 0);
      // Where the board is cut to the coat's drawn outline (the women's coats, whose shoulder line bends under the board's upper edge) only what the cut leaves is drawn.
      const drawn = (q, l) => !l.clip || inside(l.clip, q);
      // the upper edge covers the outline's stroke: the drawn coat is the outline and its half stroke (0.03 in) more, and the board's upper edge lies on that
      for(const [q, l] of [...pts.map(q => [q, strip]), [tipPoint, strip]]) if(drawn(q, l)) assert.ok(inside(poly, q) || edgeDist(poly, q) < 0.035, `${tag}: the point (${q.x.toFixed(2)}, ${q.y.toFixed(2)}) of the board is over the page, ${edgeDist(poly, q).toFixed(3)} in off the coat`);
      n++;
    }
  }
  assert.equal(n, 24);
});
