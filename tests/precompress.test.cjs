'use strict';
// Brotli and gzip copies for the built site (LIVE13 E65): Caddy serves name.br or name.gz as it is (precompressed br gzip),
// so the page's scripts go at brotli's highest level, a fifth smaller than on-the-fly compression. Each copy must decompress
// to exactly its file, and only the files the page loads as text are copied.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const { precompress, WANTED } = require('../scripts/precompress.cjs');

const ROOT = path.join(__dirname, '..');

test('each copy decompresses to its file; small files, SVGs, specs and images get none', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'precompress-'));
  const put = (rel, body) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), body); };
  const big = fs.readFileSync(path.join(ROOT, 'js', 'catalog.js'));
  put('js/catalog.js', big);
  put('index.html', fs.readFileSync(path.join(ROOT, 'index.html')));
  put('images/packs/blues_a-male.json', JSON.stringify({ specs: { a: 'x'.repeat(4000) } }));
  put('config.js', 'window.x = 1;');
  put('images/garments/a.svg', '<svg>' + ' '.repeat(4000) + '</svg>');
  put('images/garments/a.spec.json', JSON.stringify({ anchors: {}, pad: ' '.repeat(4000) }));
  const r = precompress(dir);
  assert.equal(r.files, 3);
  for(const rel of ['js/catalog.js', 'index.html', 'images/packs/blues_a-male.json']){
    const body = fs.readFileSync(path.join(dir, rel));
    assert.deepEqual(zlib.brotliDecompressSync(fs.readFileSync(path.join(dir, rel + '.br'))), body, rel + '.br');
    assert.deepEqual(zlib.gunzipSync(fs.readFileSync(path.join(dir, rel + '.gz'))), body, rel + '.gz');
  }
  assert.ok(fs.statSync(path.join(dir, 'js/catalog.js.br')).size < zlib.gzipSync(big, { level: 6 }).length * 0.9, 'brotli beats on-the-fly gzip by a tenth or more');
  for(const rel of ['config.js', 'images/garments/a.svg', 'images/garments/a.spec.json']) assert.equal(fs.existsSync(path.join(dir, rel + '.br')), false, rel);
  assert.equal(WANTED('vendor/pdfjs/pdf.worker.min.js'), true);
  assert.equal(WANTED('images/MANIFEST.json'), true);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('the site build precompresses last, and the live Caddyfile serves the copies', () => {
  const build = fs.readFileSync(path.join(ROOT, 'scripts', 'build-site.cjs'), 'utf8');
  const at = build.indexOf("require('./precompress.cjs').precompress(DIST)");
  assert.ok(at > build.indexOf("'stamp-assets.cjs'), `--root=${DIST}`"), 'after the restamp, when every file is final');
  assert.ok(at > build.indexOf('await writePacks()'), 'after the packs are written');
  const caddy = fs.readFileSync(path.join(ROOT, 'deploy', 'Caddyfile.tunnel'), 'utf8');
  assert.match(caddy, /file_server \{[^}]*\n\t\t\tprecompressed br gzip\n\t\t\}/);
  assert.match(caddy, /\n\tencode zstd gzip\n/, 'everything else is still compressed on the fly');
});
