'use strict';
// scripts/sync-patches.cjs also writes data/unit-patch-art.js: one row per patch spec of the art tree that carries a charter, so a new unit emblem needs
// no code. The art tree is a fixture here (ARTWORK_SRC), never the real one.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'sync-patches.cjs');
const sync = require(SCRIPT);
const committed = require('../data/unit-patch-art.js');

function fixture(specs){
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'unit-patch-art-'));
  for(const [asset, spec] of Object.entries(specs)){
    const dir = path.join(root, 'patches', asset);
    fs.mkdirSync(dir, { recursive: true });
    // Official artwork is a PNG named by the spec's `file`; the others are the SVG.
    if(spec && /\.png$/.test(spec.file || '')) fs.writeFileSync(path.join(dir, spec.file), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 1, 2, 3, 255]));
    else fs.writeFileSync(path.join(dir, asset + '.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300"/>');
    if(spec) fs.writeFileSync(path.join(dir, asset + '.spec.json'), JSON.stringify(spec));
  }
  return root;
}
const withArt = (root, fn) => { const was = process.env.ARTWORK_SRC; process.env.ARTWORK_SRC = root; try{ return fn(); }finally{ if(was === undefined) delete process.env.ARTWORK_SRC; else process.env.ARTWORK_SRC = was; } };
const size = { width_in: 3, height_in: 3.2 };

const SPECS = {
  'patch-mar-dc-026': Object.assign({ charter: 'mar-dc-026', label: 'Arlington Composite Squadron', echelon: 'squadron' }, size),
  'patch-california-wing': Object.assign({ charter: 'PCR-CA-001', unit_label: 'California Wing', echelon: 'wing' }, size),
  'patch-pacific-region': Object.assign({ charter: 'PCR-PCR-001' }, size),
  'patch-swr-tx-030-group': { charter: 'SWR-TX-030', label: 'Group III', echelon: 'group', size_in: { w: 3.25, h: 3.5 } },
  'patch-ncsa-mots': Object.assign({ label: 'No charter: an activity patch' }, size),
  'patch-bad-size': { charter: 'MAR-VA-044', width_in: 0, height_in: 3 },
  'patch-no-spec': null
};

test('a row for every spec that carries a charter, sorted by charter, and none for a spec without one or without a size', () => {
  const { rows, warnings } = withArt(fixture(SPECS), () => sync.unitRows());
  assert.deepEqual(rows.map(r => r.charter), ['MAR-DC-026', 'PCR-CA-001', 'PCR-PCR-001', 'SWR-TX-030']);
  assert.deepEqual(warnings, []);
  const byCharter = Object.fromEntries(rows.map(r => [r.charter, r]));
  assert.deepEqual(byCharter['MAR-DC-026'], { charter: 'MAR-DC-026', patchId: 'unit_mar_dc_026', label: 'Arlington Composite Squadron', echelon: 'squadron', kind: 'unit', w: 3, h: 3.2, asset: 'patch-mar-dc-026', img: 'patches/patch-mar-dc-026/patch-mar-dc-026.svg' });
  assert.equal(byCharter['PCR-CA-001'].label, 'California Wing', 'unit_label is read');
  assert.equal(byCharter['PCR-CA-001'].echelon, 'wing');
  assert.equal(byCharter['PCR-PCR-001'].echelon, 'region', 'no echelon in the spec: read from the charter number');
  assert.equal(byCharter['PCR-PCR-001'].label, 'Pacific Region', 'no label in the spec: the asset name');
  assert.deepEqual([byCharter['SWR-TX-030'].w, byCharter['SWR-TX-030'].h, byCharter['SWR-TX-030'].echelon], [3.25, 3.5, 'group'], 'the size_in dialect is read');
});

test('the level of a charter number: headquarters are -000 and -001, National Headquarters is NHQ', () => {
  for(const [code, level] of [['NER-NER-001', 'region'], ['GLR-GLR-000', 'region'], ['NER-NY-001', 'wing'], ['SER-TN-000', 'wing'], ['NHQ-NHQ-000', 'national'], ['NHQ-NHQ-OPS', 'national'], ['SER-TN-185', 'squadron'], ['NHQ-NHQ-103', 'squadron']]) assert.equal(sync.echelonOfCharter(code), level, code);
});

test('the charter of a spec wins over the default for an emblem made before specs carried one; the first spec of a charter wins and the repeat is reported', () => {
  const root = fixture({
    'patch-new-york-wing': Object.assign({ charter: 'NER-NY-001', label: 'The New York Wing' }, size),
    'patch-northeast-region': Object.assign({ charter: 'NER-NER-001' }, size),
    'patch-zz-copy': Object.assign({ charter: 'NER-NY-001' }, size)
  });
  const { rows, warnings } = withArt(root, () => sync.unitRows());
  assert.equal(rows.length, 2);
  assert.equal(rows.find(r => r.charter === 'NER-NY-001').label, 'The New York Wing');
  assert.equal(rows.find(r => r.charter === 'NER-NY-001').asset, 'patch-new-york-wing');
  assert.match(warnings.join('\n'), /NER-NY-001: patch-zz-copy repeats a charter/);
  const dflt = withArt(fixture({ 'patch-new-york-wing': size }), () => sync.unitRows().rows);
  assert.deepEqual(dflt.map(r => [r.charter, r.label]), [['NER-NY-001', 'New York Wing']], 'the emblem made before specs carried a charter keeps its charter');
});

test('official artwork: a spec whose file is a PNG gives a row on the PNG; a spec\'s own charter beats the default list whichever name sorts first', () => {
  const root = fixture({
    'patch-new-york-wing': Object.assign({}, size),   // the older geometric patch: NER-NY-001 only by the default list
    'patch-new-york-wing-brand-tools': Object.assign({ charter: 'NER-NY-001', label: 'New York Wing', kind: 'unit', echelon: 'wing', file: 'patch-new-york-wing-brand-tools.png', data_source: 'official-digital-artwork-as-given' }, size)
  });
  const { rows, warnings } = withArt(root, () => sync.unitRows());
  assert.equal(rows.length, 1);
  assert.deepEqual([rows[0].asset, rows[0].img, rows[0].kind], ['patch-new-york-wing-brand-tools', 'patches/patch-new-york-wing-brand-tools/patch-new-york-wing-brand-tools.png', 'unit']);
  assert.deepEqual(warnings, [], 'no warning: the default was not a claim');
});

test('activity patches (kind activity, no charter) get rows with charter null, after the charter rows; a catalog patch is not one, and a spec on the skip list is left out', () => {
  const root = fixture({
    'patch-ncsa-mots': Object.assign({ label: 'Medical Orientation & Training School', kind: 'activity', echelon: 'activity', file: 'patch-ncsa-mots.png' }, size),
    'patch-ncsa-geo': Object.assign({ label: 'Geospatial Academy', kind: 'activity', echelon: 'activity', file: 'patch-ncsa-geo.png' }, size),
    'patch-nesa': Object.assign({ label: 'NESA', kind: 'activity', file: 'patch-nesa.png' }, size),
    'patch-mar-dc-026': Object.assign({ charter: 'MAR-DC-026', file: 'patch-mar-dc-026.png' }, size),
    'patch-pcr-ca-110': Object.assign({ charter: 'PCR-CA-110', echelon: 'squadron' }, size)
  });
  const p = withArt(root, () => sync.plan());
  assert.deepEqual(p.units.map(r => r.patchId), ['unit_mar_dc_026', 'ncsa_geo_patch', 'ncsa_mots_patch']);
  const mots = p.units.find(r => r.patchId === 'ncsa_mots_patch');
  assert.deepEqual(mots, { charter: null, patchId: 'ncsa_mots_patch', label: 'Medical Orientation & Training School', echelon: 'activity', kind: 'activity', w: 3, h: 3.2, asset: 'patch-ncsa-mots', img: 'patches/patch-ncsa-mots/patch-ncsa-mots.png' });
  assert.match(p.warnings.join('\n'), /patch-pcr-ca-110: left out/);
  assert.ok(p.copy.includes('patch-ncsa-mots') && !p.copy.includes('patch-pcr-ca-110'));
  const m = { exports: {} };
  new Function('module', 'self', sync.unitText(p.units))(m, undefined);
  assert.deepEqual(m.exports, p.units);
});

test('scripts/sync-artwork.cjs copies a PNG byte for byte, with its spec, and gives it a manifest row and an asset index entry on the PNG', () => {
  const art = fixture({ 'patch-zz-test': Object.assign({ charter: 'ZZZ-ZZ-001', kind: 'unit', file: 'patch-zz-test.png' }, size) });
  // A scratch copy of the two scripts and an empty manifest: the real images/ and data/ are not touched.
  const site = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-artwork-'));
  fs.mkdirSync(path.join(site, 'scripts')); fs.mkdirSync(path.join(site, 'images')); fs.mkdirSync(path.join(site, 'data'));
  for(const f of ['sync-artwork.cjs', 'build-asset-index.cjs']) fs.copyFileSync(path.join(__dirname, '..', 'scripts', f), path.join(site, 'scripts', f));
  fs.writeFileSync(path.join(site, 'images', 'MANIFEST.json'), JSON.stringify({ count: 0, assets: [] }));
  const r = spawnSync(process.execPath, [path.join(site, 'scripts', 'sync-artwork.cjs'), 'patch-zz-test'], { env: Object.assign({}, process.env, { ARTWORK_SRC: art }), encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const dest = path.join(site, 'images', 'patches', 'patch-zz-test');
  assert.ok(fs.readFileSync(path.join(dest, 'patch-zz-test.png')).equals(fs.readFileSync(path.join(art, 'patches', 'patch-zz-test', 'patch-zz-test.png'))), 'byte-identical');
  assert.ok(fs.existsSync(path.join(dest, 'patch-zz-test.spec.json')));
  const row = JSON.parse(fs.readFileSync(path.join(site, 'images', 'MANIFEST.json'), 'utf8')).assets.find(a => a.id === 'patch-zz-test');
  assert.deepEqual([row.path, row.category, row.w_in, row.h_in], ['patches/patch-zz-test/patch-zz-test.png', 'patches', 3, 3.2]);
  assert.match(fs.readFileSync(path.join(site, 'data', 'asset-index.js'), 'utf8'), /"patch-zz-test": "patches\/patch-zz-test\/patch-zz-test\.png"/);
});

test('plan() hands the emblems to the copy list, and the generated text round-trips to the rows', () => {
  const root = fixture(SPECS);
  const p = withArt(root, () => sync.plan());
  for(const r of p.units) assert.ok(p.copy.includes(r.asset), r.asset);
  const m = { exports: {} };
  new Function('module', 'self', sync.unitText(p.units))(m, undefined);
  assert.deepEqual(m.exports, p.units);
  assert.equal(sync.unitText(p.units), sync.unitText(JSON.parse(JSON.stringify(p.units))));
  assert.match(sync.unitText([]), /const rows = \[\n\n?  \];/);
});

test('--dry-run reports the emblems and writes nothing; --check says when data/unit-patch-art.js is behind the art tree', () => {
  const root = fixture(SPECS);
  const before = fs.readFileSync(sync.UNIT_OUT, 'utf8');
  const dry = spawnSync(process.execPath, [SCRIPT, '--dry-run'], { env: Object.assign({}, process.env, { ARTWORK_SRC: root }), encoding: 'utf8' });
  assert.equal(dry.status, 0);
  assert.match(dry.stdout, /4 unit emblems with a charter: MAR-DC-026, PCR-CA-001, PCR-PCR-001, SWR-TX-030/);
  assert.match(dry.stdout, /0 activity patches: none/);
  assert.equal(fs.readFileSync(sync.UNIT_OUT, 'utf8'), before);
  const check = spawnSync(process.execPath, [SCRIPT, '--check'], { env: Object.assign({}, process.env, { ARTWORK_SRC: root }), encoding: 'utf8' });
  assert.equal(check.status, 1);
  assert.match(check.stderr, /data\/unit-patch-art\.js .*behind the art tree: run node scripts\/sync-patches\.cjs/);
});

test('the committed data/unit-patch-art.js is in the form the script writes, and every row names an asset of the manifest with the spec\'s size', () => {
  assert.equal(fs.readFileSync(sync.UNIT_OUT, 'utf8'), sync.unitText(committed));
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'images', 'MANIFEST.json'), 'utf8'));
  const seen = new Set();
  for(const r of committed){
    assert.ok(!seen.has(r.patchId) && !(r.charter && seen.has(r.charter)), r.patchId);
    seen.add(r.charter); seen.add(r.patchId);
    const row = manifest.assets.find(a => a.id === r.asset);
    assert.ok(row, r.asset);
    assert.equal(row.path, r.img);
    assert.deepEqual([row.w_in, row.h_in], [r.w, r.h], r.charter);
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'images', r.img)), r.img);
    assert.ok(['national', 'region', 'wing', 'group', 'squadron', 'activity'].includes(r.echelon), r.charter);
    assert.ok(['unit', 'activity'].includes(r.kind), r.patchId);
    assert.equal(!!r.charter, r.kind === 'unit', r.patchId);
    assert.ok(r.charter || r.kind === 'activity');
    if(/\.png$/.test(r.img)){
      const spec = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'images', 'patches', r.asset, r.asset + '.spec.json'), 'utf8'));
      assert.equal(spec.data_source, 'official-digital-artwork-as-given', r.asset);
    }
  }
});
