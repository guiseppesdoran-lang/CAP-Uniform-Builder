'use strict';
// The owner (2026-11-12), on the women's Class A coat with four across flush: a sliver of ribbon showed to the left of the lapel, inside the coat's opening over the shirt. Nothing pinned to
// a coat is drawn inside its opening (over the shirt, the tie, the tab or the ascot): a rack wide enough to pass under the lapel is covered by it and ends there. The engine does it once
// (js/engine/compose.js cutOpening), from the sheet's own outline of the opening (its `shirt` landmark), so the figure, the layout tiles and the Photos menu's parts, which share the layers,
// agree. tests/rack-opening-browser.cjs checks the pixels.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const core = require('../js/engine/core.js');
const G = require('../js/engine/grades.js');
const P = require('../js/engine/profiles.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');
require('../js/engine/profiles-polo.js');
const parts = require('../js/engine/parts.js');
const manifest = JSON.parse(read('images/MANIFEST.json'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(read('images/' + p))));

const CLASP = 'device-clasp-silver';
const ribbons = n => Array.from({ length: n }, (_, i) => ({ key: 'ribbon:r' + i, id: 'r' + i, title: 'r' + i, asset: 'ribbon-armstrong-achievement', devices: i % 3 === 0 ? [CLASP] : [], centered: false }));
const medals = n => Array.from({ length: n }, (_, i) => ({ key: 'mini:m' + i, title: 'm' + i, ribbonAsset: 'ribbon-armstrong-achievement', medal: 'medal-cap-achievment-award-miniature', devices: i % 3 === 0 ? [CLASP] : [], centered: false }));
const buildOf = (uniform, membership, rank, gender, n, opt, extra) => Object.assign({
  uniform, gender, membership, grade: G.gradeInfo(membership, rank, {}), opt: Object.assign({ headgear: 'none', miniStyle: 'mounting' }, opt), name: { first: '', last: '', show: false },
  ribbons: ribbons(n), medals: medals(n), badges: [], command: null, militaryBadges: [], patches: [], cord: null
}, extra || {});

const inPolygon = (q, poly) => { let c = false; for(let i = 0, j = poly.length - 1; i < poly.length; j = i++){ const a = poly[i], b = poly[j]; if(((a.y > q.y) !== (b.y > q.y)) && (q.x < (b.x - a.x) * (q.y - a.y) / (b.y - a.y) + a.x)) c = !c; } return c; };
const PINNED = ['ribbon', 'device', 'mini-medal', 'mini-drape', 'badge'];
// The sheet's own outline of the opening, in scene inches: its `shirt` landmark; the corporate blazers' sheets carry the shirt as a group only, so their outline is the V of its `shirt-body` path.
async function openingOf(coat){
  const spec = await store.load(coat.id);
  const lm = spec.landmarks.shirt;
  if(lm && lm.points) return { points: lm.points, from: 'landmark' };
  const svg = read('images/' + spec.path.replace(/^images\//, ''));
  const art = new RegExp(`id="${coat.id}__art"[^>]*transform="translate\\(([-\\d.]+) ([-\\d.]+)\\) scale\\(([-\\d.]+)\\)"`).exec(svg);
  const d = new RegExp(`id="${coat.id}__shirt-body" d="([^"]+)"`).exec(svg);
  if(!art || !d) return null;
  return { points: [...d[1].matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map(m => ({ x: (+art[1] + +art[3] * +m[1]) / 100, y: (+art[2] + +art[3] * +m[2]) / 100 })), from: 'path' };
}
// The points of a layer the renderer draws: its box less the polygons it is cut by (clipOut), kept to its clip polygon where it has one.
function drawnPoints(l, nx = 36, ny = 14){
  const b = core.layerBounds(l), out = [];
  for(let i = 0; i < nx; i++) for(let j = 0; j < ny; j++){
    const q = { x: b.x + (i + 0.5) * b.w / nx, y: b.y + (j + 0.5) * b.h / ny };
    if((l.clipOut || []).some(poly => inPolygon(q, poly))) continue;
    if(Array.isArray(l.clip) && l.clip.length > 2 && !inPolygon(q, l.clip)) continue;
    out.push(q);
  }
  return out;
}
const drawnInOpening = (scene, opening) => scene.layers.filter(l => PINNED.includes(l.role) && l.type === 'asset')
  .flatMap(l => drawnPoints(l).filter(q => inPolygon(q, opening)).map(() => l.key));

const WIDE = { '4-left': { rackColumns: 4, rackAlign: 'outboard' }, '4-center': { rackColumns: 4 } };
const COATS = [['blues_a', 'senior', 'Capt', 'male'], ['blues_a', 'senior', 'Capt', 'female'], ['blues_a', 'cadet', 'C/Capt', 'male'], ['blues_a', 'cadet', 'C/Capt', 'female'],
  ['semi_formal_usaf', 'cadet', 'C/Capt', 'male'], ['semi_formal_usaf', 'cadet', 'C/Capt', 'female']];

test('with a tall rack chosen four across, flush or centered, no ribbon or device is drawn inside the opening of any coat that has a rack; the part past the lapel is cut', async () => {
  let cut = 0;
  for(const [uniform, membership, rank, gender] of COATS){
    for(const [name, opt] of Object.entries(WIDE)){
      for(const arrangement of ['standard', 'lapel']){
        const scene = await P.composeUniform(buildOf(uniform, membership, rank, gender, 30, Object.assign({ rackArrangement: arrangement }, opt)), store);
        const label = `${uniform} ${membership} ${gender} ${name} ${arrangement}`;
        const coat = scene.layers.find(l => l.role === 'garment');
        const opening = await openingOf(coat);
        assert.ok(opening && opening.from === 'landmark', `${label}: the sheet outlines its opening (shirt landmark)`);
        assert.ok(scene.layers.filter(l => l.role === 'ribbon').length === 30 && scene.layers.some(l => l.role === 'device'), `${label}: thirty ribbons with devices`);
        assert.deepEqual(drawnInOpening(scene, opening.points), [], `${label}: nothing drawn inside the opening`);
        cut += scene.layers.filter(l => (l.clipOut || []).length && PINNED.includes(l.role)).length;
      }
    }
  }
  assert.ok(cut >= 4, 'the women\'s four across flush reaches the opening: its ribbons carry the cut');
});

test('the women\'s Class A coat with four across flush: the ribbons that reach the opening are cut, the others (and a man\'s whole rack) are left whole', async () => {
  const woman = await P.composeUniform(buildOf('blues_a', 'senior', 'Capt', 'female', 14, Object.assign({ rackArrangement: 'standard' }, WIDE['4-left'])), store);
  const cutKeys = woman.layers.filter(l => l.role === 'ribbon' && (l.clipOut || []).length).map(l => l.key);
  assert.ok(cutKeys.length >= 1 && cutKeys.length < 14, `some of the ribbons: ${cutKeys.length}`);
  const centered = await P.composeUniform(buildOf('blues_a', 'senior', 'Capt', 'female', 14, Object.assign({ rackArrangement: 'standard' }, WIDE['4-center'])), store);
  assert.equal(centered.layers.filter(l => (l.clipOut || []).length).length, 0, 'centered, the rack is clear of the opening');
  const man = await P.composeUniform(buildOf('blues_a', 'senior', 'Capt', 'male', 30, Object.assign({ rackArrangement: 'standard' }, WIDE['4-left'])), store);
  assert.equal(man.layers.filter(l => (l.clipOut || []).length).length, 0, 'a man\'s rack stays clear of the opening, so nothing is cut');
  // The automatic arrangement lays the same rows it laid: the cut changes what is seen, not where a ribbon is.
  const auto = await P.composeUniform(buildOf('blues_a', 'senior', 'Capt', 'female', 14, Object.assign({ rackArrangement: 'lapel' }, WIDE['4-left'])), store);
  const plain = await P.composeUniform(buildOf('blues_a', 'senior', 'Capt', 'female', 14, Object.assign({ rackArrangement: 'standard' }, WIDE['4-left'])), store);
  const at = scene => scene.layers.filter(l => l.role === 'ribbon').map(l => [l.key, l.x, l.y].join());
  assert.deepEqual(at(auto), at(plain), 'a woman\'s four across: the automatic rack is the regular one (CAPR 39-1 11.1.8), cut the same');
});

test('the Honor Guard Uniform, which is the cadet coat, and the cadet semi-formal coat: the same rule', async () => {
  for(const gender of ['male', 'female']){
    const scene = await P.composeUniform(buildOf('blues_a', 'cadet', 'C/Capt', gender, 30, Object.assign({ rackArrangement: 'standard' }, WIDE['4-left']), { ceremonial: { role: 'guard', chinstrap: 'up' } }), store);
    const coat = scene.layers.find(l => l.role === 'garment');
    assert.deepEqual(drawnInOpening(scene, (await openingOf(coat)).points), [], `Honor Guard ${gender}`);
  }
});

test('miniature medals and ribbons on the other lapel garments: the mess dress, the corporate blazers (the Corporate Service Dress rack, the semi-formal medals); where a sheet has no landmark its shirt path is the outline', async () => {
  const checked = [];
  for(const [uniform, gender] of [['mess_dress', 'male'], ['mess_dress', 'female'], ['aviator_blazer', 'male'], ['aviator_blazer', 'female'], ['semi_formal', 'male'], ['semi_formal', 'female']]){
    for(const miniStyle of ['mounting', 'holding']){
      const scene = await P.composeUniform(buildOf(uniform, 'senior', 'Capt', gender, 28, { miniStyle, rackColumns: 3, rackArrangement: 'standard' }), store);
      const coat = scene.layers.find(l => l.role === 'garment');
      const opening = await openingOf(coat);
      assert.ok(opening, `${uniform} ${gender}: an outline of the opening (${coat.id})`);
      assert.ok(scene.layers.some(l => ['ribbon', 'mini-medal'].includes(l.role)), `${uniform} ${gender}: a rack or medals`);
      assert.deepEqual(drawnInOpening(scene, opening.points), [], `${uniform} ${gender} ${miniStyle}: nothing drawn inside the opening (${opening.from})`);
      checked.push(`${uniform}/${gender}/${opening.from}`);
    }
  }
  // The blazers' sheets carry no shirt landmark; nothing of a tall rack or of the medals reaches their opening, so no cut is needed there.
  assert.ok(checked.some(c => /aviator_blazer\/male\/path/.test(c)) && checked.some(c => /semi_formal\/female\/path/.test(c)));
});

test('the layers are shared: the layout tile and the Photos menu\'s parts of the women\'s rack carry the cut', async () => {
  const scene = await P.composeUniform(buildOf('blues_a', 'senior', 'Capt', 'female', 14, Object.assign({ rackArrangement: 'standard' }, WIDE['4-left'])), store);
  const planned = parts.plan(scene, null, null);
  for(const part of planned.parts.filter(p => p.kind === 'rack' || p.kind === 'chest-left')){
    const picture = parts.sceneFor(scene, planned, part);
    assert.ok(picture.layers.filter(l => l.role === 'ribbon' && (l.clipOut || []).length).length >= 1, `${part.kind}: the ribbons that reach the opening are cut`);
  }
  const op = read('js/option-pictures.js');
  assert.match(op, /const layers = scene\.layers\.filter\(l => \(!l\.figure \|\| l\.figure === 1\)/, 'the tile keeps the scene\'s layers as they are, the cut with them');
});

test('in a real browser, no pixel inside the opening of the women\'s coat is a ribbon: every point of a ribbon in it is the shirt (needs Chrome)', { timeout: 200000 }, t => {
  const chrome = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if(!fs.existsSync(chrome)) return t.skip('Chrome not installed');
  const r = require('node:child_process').spawnSync(process.execPath, [path.join(__dirname, 'rack-opening-browser.cjs')], { encoding: 'utf8', timeout: 180000 });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /^PASS$/m);
});
