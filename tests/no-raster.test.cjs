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
