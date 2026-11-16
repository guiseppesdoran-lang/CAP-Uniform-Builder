'use strict';
// Devices on a miniature medal's ribbon (CAPR 39-1 11.4.2): the ribbon-bar rule of CAPR 39-3 6b "except the devices will be rotated clockwise to be
// worn vertically rather than horizontally. ... Precedence will be to the top of the miniature medal ribbon (rather than to the right), and devices
// worn centered horizontally will be centered vertically." So on a drape a single device is centred, several lie in a column turned 90 degrees with
// the highest precedence on top, a centred device keeps the middle with its clasps beside it, and the ribbon bar keeps its horizontal row.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const core = require('../js/engine/core.js');
const C = require('../js/engine/compose.js');
const A = require('../js/engine/awards.js');
const P = require('../js/engine/profiles.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');
const HARNESS = require('../scripts/render-builds.cjs');

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images', 'MANIFEST.json'), 'utf8'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));
const D = A.DEVICE, OLC = 'mil-device-olc-bronze';
const BASE = HARNESS.ribbonsFrom([['meritorious_service_award']], 'senior')[0];

// One miniature medal on the women's or men's corporate semi-formal, carrying exactly `devices`.
const medal = (devices, centered, key = 'mini:meritorious_service_award') => ({ key, title: 'Meritorious Service Award', ribbonAsset: BASE.asset, medal: `medal-${BASE.asset.replace(/^ribbon-/, '')}-miniature`, devices, centered: !!centered });
const compose = (medals, sex = 'male') => P.composeUniform(HARNESS.makeBuild({ uniform: 'semi_formal', gender: sex, membership: 'senior', rank: 'Col', medals, opt: { rackColumns: 4, rackArrangement: 'lapel', miniStyle: 'mounting' } }), store);
const drapeOf = (scene, key = 'mini:meritorious_service_award') => scene.layers.find(l => l.role === 'mini-drape' && l.key === key);
const devicesOf = (scene, key = 'mini:meritorious_service_award') => scene.layers.filter(l => l.role === 'device' && l.key.startsWith(key + ':device:'));
const centre = l => ({ x: l.x + l.w / 2, y: l.y + l.h / 2 });
const D2 = C.MINI_DRAPE;

for(const sex of ['male', 'female']){
  test(`${sex}: one device on a miniature drape is centred on the ribbon and turned a quarter (11.4.2)`, async () => {
    const scene = await compose([medal([D.clasp_bronze])], sex);
    const drape = drapeOf(scene), devs = devicesOf(scene);
    assert.equal(devs.length, 1);
    const c = centre(devs[0]);
    assert.equal(devs[0].rotate, 90, 'rotated clockwise');
    assert.ok(Math.abs(c.x - (drape.x + D2.w / 2)) < 1e-6, 'centred across the drape');
    assert.ok(Math.abs(c.y - (drape.y + (D2.h - D2.point) / 2)) < 1e-6, `centred along the straight part of the drape (${(c.y - drape.y).toFixed(3)} in from its top)`);
  });

  test(`${sex}: three oak leaf clusters on a miniature drape stack vertically, turned, touching, centred (11.4.2)`, async () => {
    const scene = await compose([medal([OLC, OLC, OLC])], sex);
    const drape = drapeOf(scene), devs = devicesOf(scene);
    assert.equal(devs.length, 3);
    assert.ok(devs.every(d => d.rotate === 90), 'every cluster turned 90 degrees');
    const cs = devs.map(centre);
    assert.ok(cs.every(c => Math.abs(c.x - cs[0].x) < 1e-6), 'one column, not a row across the drape');
    assert.ok(Math.abs(cs[0].x - (drape.x + D2.w / 2)) < 1e-6, 'the column is centred on the drape');
    for(let i = 1; i < 3; i++){
      const pitch = cs[i].y - cs[i - 1].y;
      const len = devs[i].w;                        // the length the cluster runs down the drape (it is turned)
      assert.ok(pitch >= len - 1e-6 && pitch <= len + 0.02 * 0.5 + 1e-6, `clusters touch, a gap of at most the miniature's (${pitch.toFixed(3)} in pitch, ${len.toFixed(3)} in long)`);
    }
    const top = cs[0].y - devs[0].w / 2, bottom = cs[2].y + devs[2].w / 2;
    assert.ok(Math.abs((top + bottom) / 2 - (drape.y + (D2.h - D2.point) / 2)) < 1e-6, 'the stack is centred along the drape');
    // the same size as a half-size ribbon-bar device (11.3, ICL 25-02 4.2.2.4)
    const bar = await P.composeUniform(HARNESS.makeBuild({ uniform: 'blues_a', gender: sex, membership: 'senior', rank: 'Col', ribbons: [{ key: 'ribbon:x', title: 'x', asset: BASE.asset, devices: [OLC] }], opt: { rackColumns: 3, rackArrangement: 'lapel' } }), store);
    const twin = bar.layers.find(l => l.role === 'device');
    assert.ok(Math.abs(devs[0].w - twin.w * 0.5) < 1e-6 && Math.abs(devs[0].h - twin.h * 0.5) < 1e-6);
  });
}

test('mixed devices on a miniature drape run top to bottom in precedence order (11.4.2: precedence to the top)', async () => {
  const scene = await compose([medal([D.clasp_bronze, D.star_bronze, D.clasp_silver, D.star_silver, D.v_silver])]);
  const devs = devicesOf(scene);
  assert.deepEqual(devs.map(l => l.id), [D.v_silver, D.star_silver, D.star_bronze, D.clasp_silver, D.clasp_bronze]);
  const ys = devs.map(l => centre(l).y);
  assert.ok(ys.every((y, i) => i === 0 || y > ys[i - 1]), 'top to bottom');
});

test('a centred device keeps the middle of the miniature ribbon, its first clasp below it and the second above, halfway to each end (39-3 21c, 21d turned by 11.4.2)', async () => {
  const scene = await compose([medal([D.propeller_bronze, D.clasp_bronze, D.clasp_bronze], true)]);
  const drape = drapeOf(scene), devs = devicesOf(scene);
  assert.equal(devs.length, 3);
  const [prop, first, second] = devs.map(centre);
  const mid = drape.y + (D2.h - D2.point) / 2, end = drape.y + D2.h - D2.point;
  assert.ok(Math.abs(prop.y - mid) < 1e-6 && Math.abs(prop.x - (drape.x + D2.w / 2)) < 1e-6, 'the propeller is centred both ways');
  assert.ok(first.y > prop.y && second.y < prop.y, 'the first clasp lies toward the bottom (the wearer\'s left turned clockwise), the second opposite');
  const half = devs[0].w / 2;
  assert.ok(Math.abs(first.y - (mid + half + end) / 2) < 1e-6, 'halfway between the propeller and the lower end');
  assert.ok(Math.abs(second.y - (drape.y + (mid - half)) / 2) < 1e-6, 'halfway between the propeller and the upper end');
});

test('where the exposed ribbon is shorter than the devices need, they nest at the same size and never leave it (one size on the rack)', () => {
  const lens = { a: 0.15, b: 0.15, c: 0.15, d: 0.15 };
  const fit = A.layoutDevicesAlong(['a', 'b', 'c', 'd'], lens, 1.39, { gap: 0.02 });
  assert.equal(fit.nested, false);
  const tight = A.layoutDevicesAlong(['a', 'b', 'c', 'd'], lens, 0.35, { gap: 0.02 });
  assert.equal(tight.nested, true);
  assert.ok(tight[0].y - 0.075 >= 0.35 / 2 - 0.35 / 2 - 1e-9 && tight[3].y + 0.075 <= 0.35 + 1e-9, 'inside the span');
  assert.ok(tight.every((d, i) => i === 0 || d.y > tight[i - 1].y), 'order kept');
  assert.equal(A.layoutDevicesAlong([], lens, 1).length, 0);
});

test('the ribbon bar keeps its horizontal row, devices unturned and touching (39-3 6b)', async () => {
  const scene = await P.composeUniform(HARNESS.makeBuild({ uniform: 'blues_a', gender: 'male', membership: 'senior', rank: 'Col', ribbons: [{ key: 'ribbon:x', title: 'x', asset: BASE.asset, devices: [D.clasp_bronze, D.clasp_bronze, D.clasp_bronze] }], opt: { rackColumns: 3, rackArrangement: 'lapel' } }), store);
  const devs = scene.layers.filter(l => l.role === 'device');
  assert.equal(devs.length, 3);
  assert.ok(devs.every(d => d.rotate === 0), 'not turned on the ribbon bar');
  const cs = devs.map(centre);
  assert.ok(cs.every(c => Math.abs(c.y - cs[0].y) < 1e-9), 'one row');
  assert.ok(cs.every((c, i) => i === 0 || c.x > cs[i - 1].x), 'left to right');
  assert.ok(Math.abs(cs[1].x - cs[0].x - (devs[0].w + 0.01)) < 1e-6, 'a 0.01 in gap between three');
});
