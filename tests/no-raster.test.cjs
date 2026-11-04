'use strict';
// Nothing drawn on the uniform or shown in a chooser is a photo (LIVE13 E118, Ethan: "ribbons needs to have new artwork too, i dont want the photos.
// nothing should be photos"). Member uploads are the one exception. tests/no-raster-allowlist.json holds what is still waiting on art, each entry
// with its reason; it empties as the art lands. tests/security.test.cjs makes the same check on the built dist/.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { ROOT, allowlist, strayRasters, strayNames, rasterNames } = require('./helpers/no-raster.cjs');

const published = () => {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'build-site.cjs'), '--list'], { encoding: 'utf8', maxBuffer: 1 << 26 });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim().split('\n');
};

test('a build publishes no png, jpg, webp or gif under images/ outside the allowlist', () => {
  assert.deepEqual(strayRasters(published()), []);
});

test('the raster directories the page stopped reading are gone from the tree; the one kept for the medal art worker is not published', () => {
  for(const dir of ['images/military-ribbons', 'images/military-ribbon-variants', 'images/military-full-size-medals', 'images/mini_medals', 'images/military-badges/embroidered', 'images/patches/ocp']){
    assert.equal(fs.existsSync(path.join(ROOT, dir)), false, `${dir} was deleted (LIVE13 E118); nothing reads it`);
  }
  const files = published();
  assert.deepEqual(files.filter(f => f.startsWith('images/military-mini-medals/')), [], 'images/military-mini-medals/ (reference for the medal art, not shipped)');
  assert.deepEqual(files.filter(f => /^images\/military-badges\/.*\.(png|webp)$/.test(f)), [], 'no military badge raster');
});

test('no page script names a raster outside the allowlist', () => {
  assert.deepEqual(strayNames(), []);
});

test('the gate reads names the way it says: a bare file name counts, a web address and a lone extension do not', () => {
  assert.deepEqual(rasterNames(`x:'curryH.png', y:"badges/a b.webp", z:'https://example.com/a.png', e:'.png'`).sort(), ['b.webp', 'curryH.png']);
});

test('every allowlist entry has a one-line reason and still names something', () => {
  for(const [entry, reason] of Object.entries(allowlist())){
    assert.ok(typeof reason === 'string' && reason.trim() && !reason.includes('\n'), `${entry}: a one-line reason`);
    assert.ok(fs.existsSync(path.join(ROOT, entry)), `${entry} is gone: take it off the list`);
  }
});

// Official digital artwork taken as given (unit and activity patch emblems): the PNG beside a spec whose data_source says so, read from the spec.
test('every patch PNG the build publishes is official artwork as given: its spec says so, and the allowlist names none of it', () => {
  const { isOfficialRaster, PROVENANCE } = require('../scripts/lib-official-art.cjs');
  const list = Object.keys(allowlist());
  const pngs = published().filter(f => /^images\/patches\/.*\.png$/.test(f));
  assert.ok(pngs.length >= 30, `${pngs.length} patch PNGs`);
  for(const rel of pngs){
    const m = /^images\/patches\/([^/]+)\/\1\.png$/.exec(rel);
    assert.ok(m, `${rel}: a patch PNG is <id>/<id>.png`);
    const spec = JSON.parse(fs.readFileSync(path.join(ROOT, 'images', 'patches', m[1], m[1] + '.spec.json'), 'utf8'));
    assert.equal(spec.data_source, PROVENANCE, rel);
    assert.equal(spec.file, m[1] + '.png', rel);
    assert.ok(isOfficialRaster(ROOT, rel));
    assert.ok(!list.some(e => rel.startsWith(e) || e === rel), `${rel} is allowed by its spec, not the list`);
  }
});

test('a patch PNG whose spec does not say official artwork as given, or has no spec, is stray', () => {
  const { isOfficialRaster } = require('../scripts/lib-official-art.cjs');
  const root = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'official-art-'));
  const put = (id, spec) => {
    const dir = path.join(root, 'images', 'patches', id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, id + '.png'), 'x');
    if(spec) fs.writeFileSync(path.join(dir, id + '.spec.json'), JSON.stringify(spec));
  };
  put('patch-a', { data_source: 'official-digital-artwork-as-given' });
  put('patch-b', { data_source: 'reference-art-measured' });
  put('patch-c', null);
  assert.equal(isOfficialRaster(root, 'images/patches/patch-a/patch-a.png'), true);
  assert.equal(isOfficialRaster(root, 'images/patches/patch-b/patch-b.png'), false);
  assert.equal(isOfficialRaster(root, 'images/patches/patch-c/patch-c.png'), false);
  assert.equal(isOfficialRaster(root, 'images/patches/patch-a/other.png'), false, 'only <id>/<id>.png');
  assert.equal(isOfficialRaster(root, 'images/badges/patch-a/patch-a.png'), false, 'only under images/patches');
});
