'use strict';
// Where the miniature rack is centred across (Doran: "The medals need to move left").
//   semi_formal: centred above the pocket (4.2.2.4 as rewritten by ICL 25-02; 4.2.1.4): the crest's x, never slid toward the arm.
//   mess_dress:  centred between the lapel and the arm seam (4.1.1.1.2.2), at the rack's height.
// awards.miniRackCenterX() states both; the dress profile (profiles-dress.js) takes its centre from it (hookup recorded in
// .scratch/FOLLOWUPS.md). The numbers are read from the sheets, in inches.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const A = require('../js/engine/awards.js');

const GAR = path.join(__dirname, '..', 'images', 'garments');
const spec = id => JSON.parse(fs.readFileSync(path.join(GAR, id + '.spec.json'), 'utf8'));
// The mess-dress sheet states the lapel (shawl_left) and the shoulder seam; the armpit, where the sleeve leaves the body,
// is the silhouette vertex nearest the centre line below the chest (the sheet states no arm-seam line).
function messGeometry(gender){
  const id = 'garment-mess-dress-' + gender, sp = spec(id);
  const svg = fs.readFileSync(path.join(GAR, id + '.svg'), 'utf8');
  const d = new RegExp(`id="${id}__silhouette" d="([^"]+)"`).exec(svg)[1];
  const cx = sp.anchors.top_center[0];
  const pts = [...d.matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)].map(m => [cx + 100 * Number(m[1]), 100 * Number(m[2])]);
  const shoulder = sp.anchors.shoulder_seam_left;
  const armpit = pts.filter(p => p[0] > cx && p[1] > 1100 && p[1] < 1900).sort((p, q) => p[0] - q[0])[0];
  const y = sp.anchors.miniature_medals_center[1];
  const lapelEdgeX = A.xAtY(sp.landmarks.shawl_left, y, 'max');
  const armSeamX = A.xAtY([shoulder, armpit], y, 'max');
  return { sp, y, lapelEdgeX: lapelEdgeX / 100, armSeamX: armSeamX / 100, anchorX: sp.anchors.miniature_medals_center[0] / 100 };
}

test('semi-formal: the rack is centred on the pocket and the crest, not slid toward the arm (4.2.2.4, ICL 25-02)', () => {
  for(const gender of ['male', 'female']){
    const sp = spec('garment-corporate-service-dress-blazer-' + gender);
    const slot = sp.landmarks.medal_slot;
    const pocketCenterX = (slot.x + slot.w / 2) / 100;
    const crestX = sp.anchors.crest_center[0] / 100;
    assert.ok(Math.abs(pocketCenterX - crestX) < 0.02, `${gender}: the slot and the crest share an x`);
    assert.equal(A.miniRackCenterX('semi_formal', { pocketCenterX, lapelEdgeX: 15, armSeamX: 25 }), pocketCenterX, 'the lapel and the arm do not move it');
  }
  assert.ok(Math.abs(spec('garment-corporate-service-dress-blazer-male').anchors.crest_center[0] / 100 - 18.2475) < 0.001, 'men: 18.25 in; the engine drew a 12-medal rack at 19.55 in (a 1.3 in slide) before the hookup');
});

test('mess dress: the centre is the midpoint of the lapel edge and the arm seam at the rack height, close to the sheet anchor (4.1.1.1.2.2)', () => {
  for(const [gender, mid, tol] of [['male', 21.44, 0.03], ['female', 18.89, 0.03]]){
    const g = messGeometry(gender);
    const x = A.miniRackCenterX('mess_dress', g);
    assert.ok(Math.abs(x - mid) < tol, `${gender}: midpoint ${x.toFixed(3)} in expected ${mid}`);
    assert.ok(g.lapelEdgeX < x && x < g.armSeamX, `${gender}: between the lapel and the arm seam`);
    assert.ok(Math.abs(x - g.anchorX) < 0.3, `${gender}: the sheet's miniature_medals_center (${g.anchorX.toFixed(3)}) is within 0.3 in of the midpoint`);
  }
});

test('other uniforms have no rule here, and missing numbers give null', () => {
  assert.equal(A.miniRackCenterX('blues_a', { pocketCenterX: 1 }), null);
  assert.equal(A.miniRackCenterX('semi_formal', {}), null);
  assert.equal(A.miniRackCenterX('mess_dress', { lapelEdgeX: 1 }), null);
  assert.equal(A.xAtY([[0, 0], [10, 10]], 5, 'max'), 5);
  assert.equal(A.xAtY([[0, 0], [10, 10]], 50, 'max'), null);
});
