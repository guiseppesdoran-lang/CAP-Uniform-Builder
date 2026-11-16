'use strict';
// scripts/sync-artwork.cjs: the art of an id is the file beside its spec, in the folder the manifest records for the id, whatever other folders of the
// art tree hold the same names (older traced SVGs), and an SVG an id no longer has is dropped when it now has a PNG (a digital picture made from a
// photograph, or official artwork as given, replaces a vector).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

function setup(){
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-artwork-'));
  const site = path.join(tmp, 'site'), art = path.join(tmp, 'art');
  const put = (file, body) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, body); };
  put(path.join(site, 'scripts', 'build-asset-index.cjs'), '');
  fs.copyFileSync(path.join(__dirname, '..', 'scripts', 'sync-artwork.cjs'), path.join(site, 'scripts', 'sync-artwork.cjs'));
  const sync = (...ids) => execFileSync(process.execPath, [path.join(site, 'scripts', 'sync-artwork.cjs'), ...ids], { env: Object.assign({}, process.env, { ARTWORK_SRC: art }), stdio: 'pipe' });
  const manifest = () => JSON.parse(fs.readFileSync(path.join(site, 'images', 'MANIFEST.json'), 'utf8'));
  return { site, art, put, sync, manifest };
}
const spec = (id, ext) => ({ asset_id: id, file: id + ext, width_in: 3, height_in: 3.1, size_source: 'estimated', size_basis: 'x', anchors: {} });

test('the art beside the spec wins over a traced SVG elsewhere in the art tree, the manifest takes the PNG path and the old SVG goes', () => {
  const { site, art, put, sync, manifest } = setup();
  put(path.join(site, 'images', 'patches', 'patch-x', 'patch-x.svg'), '<svg>old redraw</svg>');
  put(path.join(site, 'images', 'MANIFEST.json'), JSON.stringify({ count: 1, assets: [{ id: 'patch-x', path: 'patches/patch-x/patch-x.svg', category: 'patches', has_spec: true, issues: [] }] }));
  put(path.join(art, 'patches', 'patch-x', 'patch-x.png'), 'PNGBYTES');
  put(path.join(art, 'patches', 'patch-x', 'patch-x.spec.json'), JSON.stringify(spec('patch-x', '.png')));
  // a traced copy in a folder that comes before and one that comes after the real one in name order: neither may be taken
  for(const dir of ['aaa-traced', 'zzz-traced']){
    put(path.join(art, dir, 'patch-x', 'patch-x.svg'), '<svg>traced</svg>');
    put(path.join(art, dir, 'patch-x', 'patch-x.spec.json'), JSON.stringify(spec('patch-x', '.svg')));
  }
  sync('patch-x');
  assert.equal(manifest().assets[0].path, 'patches/patch-x/patch-x.png');
  assert.equal(fs.readFileSync(path.join(site, 'images', 'patches', 'patch-x', 'patch-x.png'), 'utf8'), 'PNGBYTES');
  assert.ok(!fs.existsSync(path.join(site, 'images', 'patches', 'patch-x', 'patch-x.svg')), 'the old SVG is gone');
  assert.ok(fs.existsSync(path.join(site, 'images', 'patches', 'patch-x', 'patch-x.spec.json')));
});

test('a patch that is already a PNG stays that PNG, byte for byte, and no traced SVG of it comes back', () => {
  const { site, art, put, sync, manifest } = setup();
  put(path.join(site, 'images', 'patches', 'patch-y', 'patch-y.png'), 'PNGBYTES');
  put(path.join(site, 'images', 'MANIFEST.json'), JSON.stringify({ count: 1, assets: [{ id: 'patch-y', path: 'patches/patch-y/patch-y.png', category: 'patches', has_spec: true, issues: [] }] }));
  put(path.join(art, 'patches', 'patch-y', 'patch-y.png'), 'PNGBYTES');
  put(path.join(art, 'patches', 'patch-y', 'patch-y.spec.json'), JSON.stringify(spec('patch-y', '.png')));
  put(path.join(art, 'aaa-traced', 'patch-y', 'patch-y.svg'), '<svg>traced</svg>');
  put(path.join(art, 'aaa-traced', 'patch-y', 'patch-y.spec.json'), JSON.stringify(spec('patch-y', '.svg')));
  sync('patch-y');
  assert.equal(manifest().assets[0].path, 'patches/patch-y/patch-y.png');
  assert.deepEqual(fs.readdirSync(path.join(site, 'images', 'patches', 'patch-y')).sort(), ['patch-y.png', 'patch-y.spec.json']);
  assert.equal(fs.readFileSync(path.join(site, 'images', 'patches', 'patch-y', 'patch-y.png'), 'utf8'), 'PNGBYTES');
});

test('an id the manifest does not know yet is taken from the first folder in name order that has its spec and its art', () => {
  const { site, art, put, sync, manifest } = setup();
  put(path.join(site, 'images', 'MANIFEST.json'), JSON.stringify({ count: 0, assets: [] }));
  put(path.join(art, 'patches', 'patch-z', 'patch-z.png'), 'PNGBYTES');
  put(path.join(art, 'patches', 'patch-z', 'patch-z.spec.json'), JSON.stringify(spec('patch-z', '.png')));
  put(path.join(art, 'aaa-notes', 'patch-z', 'patch-z.spec.json'), JSON.stringify(spec('patch-z', '.svg')));
  sync('patch-z');
  assert.equal(manifest().assets[0].path, 'patches/patch-z/patch-z.png');
  assert.equal(fs.readFileSync(path.join(site, 'images', 'patches', 'patch-z', 'patch-z.png'), 'utf8'), 'PNGBYTES');
});
