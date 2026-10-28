'use strict';
// Artwork packs for the built site (LIVE13 E65, Ethan: "right now it's kind of slow. I'd like it to load faster"). The engine
// asks for a uniform's specs one after another, ten round trips for a bare Class A; the built site serves them from one pack
// per uniform and cut, and the manifest from a slim copy. Packs only save round trips: every uniform drawn from a pack is the
// drawing the full manifest and the spec files give, and a spec a pack lacks is fetched on its own as before.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const { createLoader } = require('../js/asset-packs.js');
const packsBuild = require('../scripts/build-asset-packs.cjs');
const core = require('../js/engine/core.js');
require('../js/engine/awards.js');
const G = require('../js/engine/grades.js');
const P = require('../js/engine/profiles.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');
require('../js/engine/profiles-polo.js');
const rules = require('../data/uniform-rules.js');

const readJson = p => JSON.parse(fs.readFileSync(path.join(ROOT, 'images', p), 'utf8'));

function fakeFetch(files){
  const calls = [];
  const getJson = (p, cache) => { calls.push([p, cache || 'default']); return Promise.resolve(p in files ? JSON.parse(JSON.stringify(files[p])) : null); };
  return { getJson, calls };
}

test('without packs (the source tree) the manifest and every spec are their own files, revalidated as before', async () => {
  const f = fakeFetch({ 'MANIFEST.json': { assets: [] }, 'garments/a.spec.json': { anchors: {} } });
  const L = createLoader(f.getJson, null);
  assert.equal(L.enabled, false);
  assert.deepEqual(await L.manifest(), { assets: [] });
  assert.equal(await L.prepare('blues_a', 'male'), null);
  assert.deepEqual(await L.spec('garments/a.spec.json'), { anchors: {} });
  assert.deepEqual(f.calls, [['MANIFEST.json', 'no-cache'], ['garments/a.spec.json', 'no-cache']]);
});

test('with packs, a uniform\'s specs come from its pack in one request, and a spec it lacks is fetched on its own', async () => {
  const packs = { manifest: 'packs/manifest.json', uniforms: { 'blues_a-male': 'packs/blues_a-male.json' } };
  const f = fakeFetch({
    'packs/manifest.json': { assets: [{ id: 'a' }] },
    'packs/blues_a-male.json': { specs: { 'garments/a.spec.json': { anchors: { center: [1, 2] } } } },
    'ribbons/r.spec.json': { anchors: {} }
  });
  const L = createLoader(f.getJson, packs);
  assert.equal(L.enabled, true);
  assert.deepEqual(await L.manifest(), { assets: [{ id: 'a' }] });
  const pending = L.prepare('blues_a', 'male');
  // A spec asked for before the pack arrives waits for it rather than fetching its file.
  const a = L.spec('garments/a.spec.json');
  await pending;
  assert.deepEqual(await a, { anchors: { center: [1, 2] } });
  assert.deepEqual(await L.spec('ribbons/r.spec.json'), { anchors: {} });
  L.prepare('blues_a', 'male');
  assert.deepEqual(f.calls, [['packs/manifest.json', 'default'], ['packs/blues_a-male.json', 'default'], ['ribbons/r.spec.json', 'no-cache']]);
  // No pack for a uniform and cut: nothing is fetched for it, and its specs are files.
  assert.equal(await L.prepare('polo', 'female'), null);
});

test('a missing pack or slim manifest falls back to the files', async () => {
  const packs = { manifest: 'packs/manifest.json', uniforms: { 'ocp-male': 'packs/ocp-male.json' } };
  const f = fakeFetch({ 'MANIFEST.json': { assets: [] }, 'field/x.spec.json': { anchors: {} } });
  const L = createLoader(f.getJson, packs);
  assert.deepEqual(await L.manifest(), { assets: [] });
  assert.equal(await L.prepare('ocp', 'male'), null);
  assert.deepEqual(await L.spec('field/x.spec.json'), { anchors: {} });
  assert.deepEqual(f.calls.map(c => c[0]), ['packs/manifest.json', 'MANIFEST.json', 'packs/ocp-male.json', 'field/x.spec.json']);
});

test('the slim manifest keeps every row and, of each row, exactly the fields the engine reads', async () => {
  const { manifest } = await packsBuild.build();
  const full = readJson('MANIFEST.json');
  assert.equal(manifest.assets.length, full.assets.length);
  full.assets.forEach((row, i) => {
    const want = {};
    for(const k of packsBuild.MANIFEST_FIELDS) if(row[k] !== undefined) want[k] = row[k];
    assert.deepEqual(manifest.assets[i], want, row.id);
  });
  // The engine's store reads these fields of a row and nothing else (js/engine/core.js), the page entry(id).path.
  const coreSrc = fs.readFileSync(path.join(ROOT, 'js/engine/core.js'), 'utf8');
  const normalize = coreSrc.slice(coreSrc.indexOf('function normalizeSpec'), coreSrc.indexOf('function createSpecStore'));
  const read = [...new Set([...normalize.matchAll(/\bentry\.(\w+)/g)].map(m => m[1]))].sort();
  assert.deepEqual(read.filter(k => !packsBuild.MANIFEST_FIELDS.includes(k)), []);
});

test('every uniform in each cut draws from its pack and the slim manifest exactly as from the full manifest and the spec files', async () => {
  const { manifest, packs } = await packsBuild.build();
  const full = readJson('MANIFEST.json');
  const RANKS = { senior: ['SM', 'CMSgt', 'FO', 'Capt', 'Col', 'Maj Gen'], cadet: ['C/AB', 'C/SSgt', 'C/CMSgt', 'C/2d Lt', 'C/Col'] };
  const defaults = Function(`return (${/const GARMENT_DEFAULTS = (\{[\s\S]*?\});/.exec(fs.readFileSync(path.join(ROOT, 'js/uniform-view.js'), 'utf8'))[1]});`)();
  let compared = 0;
  for(const uniform of Object.keys(rules.RULES)) for(const gender of ['male', 'female']){
    const pack = packs[`${uniform}-${gender}`];
    assert.ok(pack && Object.keys(pack).length, `${uniform} ${gender} has a pack`);
    for(const [p, spec] of Object.entries(pack)) assert.deepEqual(spec, readJson(p), `${p} is its file, unchanged`);
    const missing = [];
    const fromPack = core.createSpecStore(manifest, p => { if(!(p in pack)) missing.push(p); return Promise.resolve(p in pack ? pack[p] : readJson(p)); });
    const fromFiles = core.createSpecStore(full, p => Promise.resolve(readJson(p)));
    for(const membership of ['senior', 'cadet']){
      if(!rules.isUniformAllowedFor(uniform, membership, { adultCadet: true })) continue;
      for(const rank of RANKS[membership]) for(const name of [{ first: '', last: '', state: '', show: true }, { first: 'Pat', last: 'Doe', state: '', show: true }]){
        const build = () => ({
          uniform, gender, membership, grade: G.gradeInfo(membership, rank, { track: defaults.noGradeTrack }),
          opt: Object.assign({}, defaults, { rackColumns: 3, rackArrangement: 'lapel', rackCounts: null, miniStyle: 'mounting' }),
          name,
          ribbons: [], medals: [], badges: [], badgeChoices: {}, command: null, militaryBadges: [], patches: [], cord: null
        });
        let a, b;
        try { a = await P.composeUniform(build(), fromPack); } catch (err) { a = String(err); }
        try { b = await P.composeUniform(build(), fromFiles); } catch (err) { b = String(err); }
        assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)), `${uniform} ${gender} ${rank}`);
        compared++;
      }
    }
    assert.deepEqual(missing, [], `${uniform} ${gender}: the pack holds every spec a bare uniform needs`);
  }
  assert.ok(compared > 200, `compared ${compared} drawings`);
});

test('the site build step writes the packs, names them in js/asset-packs.js and preloads the slim manifest', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'packs-site-'));
  fs.mkdirSync(path.join(dir, 'js'));
  fs.copyFileSync(path.join(ROOT, 'js/asset-packs.js'), path.join(dir, 'js/asset-packs.js'));
  fs.copyFileSync(path.join(ROOT, 'index.html'), path.join(dir, 'index.html'));
  const index = await packsBuild.applyToSite(dir);
  const js = fs.readFileSync(path.join(dir, 'js/asset-packs.js'), 'utf8');
  assert.ok(js.includes(`const PACKS = ${JSON.stringify(index)};`));
  const { PACKS } = (() => { const m = { exports: {} }; Function('module', js)(m); return m.exports; })();
  assert.deepEqual(PACKS, index);
  assert.equal(Object.keys(index.uniforms).length, Object.keys(rules.RULES).length * 2);
  for(const file of [index.manifest, ...Object.values(index.uniforms)]) assert.ok(fs.existsSync(path.join(dir, 'images', file)), file);
  const version = require('../data/asset-index.js').version;
  const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  const head = html.split('</head>')[0];
  assert.ok(head.includes(`<link rel="preload" href="images/packs/manifest.json?v=${version}" as="fetch" crossorigin="anonymous" fetchpriority="low">`));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('the page loads js/asset-packs.js before the uniform preview, which takes the manifest and specs from it', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const at = name => html.indexOf(`<script src="${name}`);
  assert.ok(at('js/asset-packs.js') > 0 && at('js/asset-packs.js') < at('js/uniform-view.js'));
  const view = fs.readFileSync(path.join(ROOT, 'js/uniform-view.js'), 'utf8');
  assert.match(view, /CAPUBAssetPacks\.createLoader\(/);
  assert.match(view, /assets\.prepare\(State\.uniform, State\.gender\)/);
  assert.doesNotMatch(view, /fetch\(ASSET\('MANIFEST\.json'\)/, 'the manifest is fetched through the loader');
});
