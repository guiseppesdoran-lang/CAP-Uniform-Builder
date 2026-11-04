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
    fs.writeFileSync(path.join(dir, asset + '.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300"/>');
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
  assert.deepEqual(byCharter['MAR-DC-026'], { charter: 'MAR-DC-026', patchId: 'unit_mar_dc_026', label: 'Arlington Composite Squadron', echelon: 'squadron', w: 3, h: 3.2, asset: 'patch-mar-dc-026', img: 'patches/patch-mar-dc-026/patch-mar-dc-026.svg' });
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
    assert.ok(!seen.has(r.charter) && !seen.has(r.patchId), r.charter);
    seen.add(r.charter); seen.add(r.patchId);
    const row = manifest.assets.find(a => a.id === r.asset);
    assert.ok(row, r.asset);
    assert.equal(row.path, r.img);
    assert.deepEqual([row.w_in, row.h_in], [r.w, r.h], r.charter);
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'images', r.img)), r.img);
    assert.ok(['national', 'region', 'wing', 'group', 'squadron'].includes(r.echelon), r.charter);
  }
});
