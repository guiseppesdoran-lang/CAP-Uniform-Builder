'use strict';
// E7-FLIGHT: the flight duty uniforms and flight jackets (CAPR 39-1 ch. 8, 6.1.7), measured in inches
// on the composed scene: officer grade 1/2 in from the shoulder seam, general officer stars centred
// on the shoulder, the name tag's two badges, the chest layout, the ES patch under the pocket.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const core = require('../js/engine/core.js');
const G = require('../js/engine/grades.js');
const P = require('../js/engine/profiles.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images', 'MANIFEST.json'), 'utf8'));
const store = () => core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));
const EPS = 0.006;
const ST = store();

function build(uniform, membership, rank, extra){
  const b = Object.assign({
    uniform, gender: 'male', grade: G.gradeInfo(membership, rank, {}),
    opt: { headgear: 'auto' }, name: { first: 'Pat', last: 'Doe', show: true },
    ribbons: [], medals: [], badges: [], command: null, militaryBadges: [], patches: [], cord: null
  }, extra || {});
  if(extra && extra.opt) b.opt = Object.assign({ headgear: 'auto' }, extra.opt);
  return b;
}
const PILOT = { id: 'CAPPilot1_FA9D33EA587D8', title: 'Pilot Badge' };
const GROUND_TEAM = { id: 'ground_team_basic_badge', title: 'Ground Team Badge' };
const GROUP_PIN = { id: 'group_commander_badge', title: 'Group Commander Badge', graduated: false };

// Both figures of a flight build: the suit (figure 1) and the jacket drawn beside it (figure 2).
const FIGURES = [
  { name: 'FDU', uniform: 'flight_suit', garment: 'garment-fdu-flight-suit', jacket: false },
  { name: 'CFDU', uniform: 'corporate_flight_suit', garment: 'garment-cfdu-flight-suit', jacket: false },
  { name: 'green jacket', uniform: 'flight_suit', garment: 'garment-flight-jacket-green', jacket: true },
  { name: 'blue jacket', uniform: 'corporate_flight_suit', garment: 'garment-flight-jacket-blue', jacket: true }
];

// A landmark of the garment as a rect in scene inches.
async function zoneOf(scene, garmentId, name){
  const spec = await ST.load(garmentId);
  const g = scene.layers.find(l => l.id === garmentId);
  assert.ok(g, `${garmentId} is in the scene`);
  const r = core.landmarkBounds(spec, name);
  assert.ok(r, `${garmentId} has ${name}`);
  const s = g.w / spec.w;
  return { x: g.x + r.x * s, y: g.y + r.y * s, w: r.w * s, h: r.h * s };
}
const onFigure = (scene, f, pred) => scene.layers.filter(l => (f.jacket ? l.figure === 2 : l.figure !== 2) && pred(l));

// ---- officer grade and general officer stars on the shoulders ---------------------------------

test('officer grade: outer edge on the half inch line from the shoulder seam, centred in height (8.2.3.2, 8.3.3.2, 6.1.7)', async () => {
  const ranks = ['2d Lt', '1st Lt', 'Capt', 'Maj', 'Lt Col', 'Col'];
  for(const f of FIGURES){
    for(const rank of ranks){
      const scene = await P.composeUniform(build(f.uniform, 'senior', rank), store());
      const grades = onFigure(scene, f, l => l.role === 'grade');
      assert.equal(grades.length, 2, `${f.name} ${rank}: one grade piece on each shoulder`);
      const right = grades.find(l => l.key === 'grade:right'), left = grades.find(l => l.key === 'grade:left');
      const zr = await zoneOf(scene, f.garment, 'grade_zone_right');
      const zl = await zoneOf(scene, f.garment, 'grade_zone_left');
      // The wearer's right shoulder is the left of the picture: its seam side is the zone's left edge.
      assert.ok(Math.abs(right.x - zr.x) < EPS, `${f.name} ${rank}: right grade outer edge ${right.x.toFixed(3)} on ${zr.x.toFixed(3)}`);
      assert.ok(Math.abs((left.x + left.w) - (zl.x + zl.w)) < EPS, `${f.name} ${rank}: left grade outer edge on the zone edge`);
      assert.ok(Math.abs((right.y + right.h / 2) - (zr.y + zr.h / 2)) < EPS, `${f.name} ${rank}: centred in the zone's height`);
      assert.ok(right.x >= zr.x - EPS && right.x + right.w <= zr.x + zr.w + EPS, `${f.name} ${rank}: inside the zone`);
    }
  }
});

test('flight officers (FO, TFO, SFO) wear the same shoulder grade placement', async () => {
  for(const rank of ['FO', 'TFO', 'SFO']){
    const scene = await P.composeUniform(build('flight_suit', 'senior', rank), store());
    const grades = onFigure(scene, FIGURES[0], l => l.role === 'grade');
    assert.equal(grades.length, 2, rank);
    const zr = await zoneOf(scene, FIGURES[0].garment, 'grade_zone_right');
    assert.ok(Math.abs(grades.find(l => l.key === 'grade:right').x - zr.x) < EPS, rank);
  }
});

test('general officers: 1 in stars centred on the shoulder, points toward the neck (8.2.3.1, 8.3.3.1)', async () => {
  for(const f of FIGURES){
    for(const rank of ['Brig Gen', 'Maj Gen']){
      const scene = await P.composeUniform(build(f.uniform, 'senior', rank), store());
      const grades = onFigure(scene, f, l => l.role === 'grade');
      assert.equal(grades.length, 2, `${f.name} ${rank}`);
      for(const side of ['right', 'left']){
        const l = grades.find(x => x.key === 'grade:' + side);
        const z = await zoneOf(scene, f.garment, 'grade_zone_go_' + side);
        // Centre of the (possibly quarter-turned) piece is the centre of the zone: halfway between the
        // neck and the shoulder seam, which is how the zone is drawn.
        assert.ok(Math.abs((l.x + l.w / 2) - (z.x + z.w / 2)) < EPS && Math.abs((l.y + l.h / 2) - (z.y + z.h / 2)) < EPS, `${f.name} ${rank} ${side}: centred in the GO zone`);
        const turned = Math.abs(l.rotate || 0) === 90;
        const w = turned ? l.h : l.w, h = turned ? l.w : l.h;
        assert.ok(w <= z.w + 0.2 && h <= z.h + 0.2, `${f.name} ${rank} ${side}: fits the zone (cloth border included)`);
      }
      // Rank is never the officer grade zone placement: general stars sit further in than the 1/2 in line.
      const zr = await zoneOf(scene, f.garment, 'grade_zone_right');
      const gr = grades.find(x => x.key === 'grade:right');
      assert.ok(gr.x + gr.w / 2 > zr.x + 0.1, `${f.name} ${rank}: not on the officer line`);
      // Stacked pair quarter-turned: points toward the neck.
      if(rank === 'Maj Gen'){
        assert.equal(grades.find(x => x.key === 'grade:right').rotate, 90);
        assert.equal(grades.find(x => x.key === 'grade:left').rotate, -90);
      }
    }
  }
});

test('NCOs and cadets wear no shoulder grade on the flight suit (8.2.3.3, 8.3.3.3)', async () => {
  for(const [m, r] of [['senior', 'SMSgt'], ['cadet', 'C/SSgt'], ['cadet', 'C/Capt']]){
    const scene = await P.composeUniform(build('flight_suit', m, r), store());
    assert.equal(scene.layers.filter(l => l.role === 'grade').length, 0, r);
  }
});

// ---- the name tag: wings plus one other badge or the command pin -------------------------------

const badgeLayers = (scene, f) => onFigure(scene, f, l => l.role === 'badge');

test('name tag: CAP wings and the command pin both render, the pin on the wearer\'s right (8.2.4.1, 8.3.4.1)', async () => {
  for(const f of FIGURES){
    for(const [m, r] of [['senior', 'Col'], ['senior', 'Maj Gen'], ['senior', 'Capt'], ['senior', 'SMSgt']]){
      const scene = await P.composeUniform(build(f.uniform, m, r, { badges: [PILOT], command: GROUP_PIN }), store());
      const tag = onFigure(scene, f, l => l.key === 'nametag')[0];
      const bs = badgeLayers(scene, f);
      assert.equal(bs.length, 2, `${f.name} ${r}: wings and the command pin`);
      const wings = bs.find(l => l.key === 'badge:' + PILOT.id), pin = bs.find(l => l.key === 'badge:' + GROUP_PIN.id);
      assert.ok(wings && pin, `${f.name} ${r}`);
      // Wearer's right is the viewer's left of the tag.
      assert.ok(pin.x + pin.w <= wings.x, `${f.name} ${r}: pin to the wearer's right of the wings`);
      for(const l of [wings, pin]) assert.ok(l.x >= tag.x && l.x + l.w <= tag.x + tag.w && l.y >= tag.y && l.y + l.h <= tag.y + tag.h / 2, `${f.name} ${r}: ${l.key} on the tag, above the name`);
    }
  }
});

test('name tag: wings and an occupational badge when there is no command pin; the wings alone are centred', async () => {
  const both = await P.composeUniform(build('flight_suit', 'senior', 'Col', { badges: [PILOT, GROUND_TEAM] }), store());
  const bs = badgeLayers(both, FIGURES[0]);
  assert.deepEqual(bs.map(l => l.key).sort(), ['badge:CAPPilot1_FA9D33EA587D8', 'badge:ground_team_basic_badge']);
  const one = await P.composeUniform(build('flight_suit', 'senior', 'Col', { badges: [PILOT] }), store());
  const tag = onFigure(one, FIGURES[0], l => l.key === 'nametag')[0];
  const w = badgeLayers(one, FIGURES[0]);
  assert.equal(w.length, 1);
  assert.ok(Math.abs(w[0].x + w[0].w / 2 - (tag.x + tag.w / 2)) < 0.01, 'a lone badge is centred on the tag');
});

test('name tag: the command pin replaces the occupational badge; a graduated commander\'s pin is not on the tag', async () => {
  const s = await P.composeUniform(build('flight_suit', 'senior', 'Col', { badges: [PILOT, GROUND_TEAM], command: GROUP_PIN }), store());
  const keys = badgeLayers(s, FIGURES[0]).map(l => l.key);
  assert.ok(keys.includes('badge:' + GROUP_PIN.id) && !keys.includes('badge:ground_team_basic_badge'), 'pin in place of the occupational badge');
  const g = await P.composeUniform(build('flight_suit', 'senior', 'Col', { badges: [PILOT], command: Object.assign({}, GROUP_PIN, { graduated: true }) }), store());
  assert.deepEqual(badgeLayers(g, FIGURES[0]).map(l => l.key), ['badge:' + PILOT.id]);
});

test('name tag lettering: officers name only; NCOs grade and CAP; cadets "Cadet" and CAP (8.2.4.1)', async () => {
  const lines = async (m, r) => {
    const sc = await P.composeUniform(build('flight_suit', m, r, { badges: [PILOT] }), store());
    return onFigure(sc, FIGURES[0], l => /^text:/.test(l.key)).map(l => l.key).sort();
  };
  assert.deepEqual(await lines('senior', 'Col'), ['text:name']);
  assert.deepEqual(await lines('senior', 'Maj Gen'), ['text:name']);
  assert.deepEqual(await lines('senior', 'SMSgt'), ['text:cap', 'text:grade', 'text:name']);
  assert.deepEqual(await lines('cadet', 'C/Capt'), ['text:cap', 'text:grade', 'text:name']);
  const c = await P.composeUniform(build('flight_suit', 'cadet', 'C/Capt'), store());
  const grade = c.layers.find(l => l.key === 'text:grade');
  assert.equal(grade.text, 'Cadet');
});

test('a third badge is not shown and says so', async () => {
  const sc = await P.composeUniform(build('flight_suit', 'senior', 'Col', { badges: [PILOT, GROUND_TEAM, { id: 'senior_ground_team_badge', title: 'Senior GT' }] }), store());
  assert.equal(badgeLayers(sc, FIGURES[0]).length, 2);
  assert.ok(sc.notes.some(n => /at most two badges/.test(n)));
});
