'use strict';
// Precompressed copies for the site build (LIVE13 E65). Caddy's `encode zstd gzip` compresses each response on the fly at a
// fast level; the page's 50 scripts and stylesheet came to 572 KB that way. Brotli at its highest level makes them 458 KB,
// a fifth less, but is too slow to run per request, so the build writes name.br and name.gz beside each text file the page
// loads at startup or when it draws (scripts, stylesheet, page, artwork packs and manifest, vendored PDF.js), and
// deploy/Caddyfile.tunnel serves them with `file_server { precompressed br gzip }`. A client that takes neither still gets
// the file through `encode`. SVGs and the per-file specs (dist/ has thousands, a few KB each) are left to `encode`.
//
//   node scripts/precompress.cjs DIR      write the copies under DIR
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const WANTED = rel => /\.(js|css|html|mjs)$/.test(rel) || /^images\/(packs\/[^/]+|MANIFEST)\.json$/.test(rel);
const MIN_BYTES = 512; // Caddy's encode leaves smaller bodies alone too

function walk(dir, root = dir, out = []){
  for(const e of fs.readdirSync(dir, { withFileTypes: true })){
    const full = path.join(dir, e.name);
    if(e.isDirectory()) walk(full, root, out);
    else out.push(path.relative(root, full).split(path.sep).join('/'));
  }
  return out;
}

function precompress(dir){
  let files = 0, raw = 0, br = 0, gz = 0;
  for(const rel of walk(dir)){
    if(!WANTED(rel)) continue;
    const file = path.join(dir, rel);
    const body = fs.readFileSync(file);
    if(body.length < MIN_BYTES) continue;
    const b = zlib.brotliCompressSync(body, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: body.length } });
    const g = zlib.gzipSync(body, { level: 9 });
    fs.writeFileSync(file + '.br', b);
    fs.writeFileSync(file + '.gz', g);
    files++; raw += body.length; br += b.length; gz += g.length;
  }
  return { files, raw, br, gz };
}

if(require.main === module){
  const dir = process.argv[2];
  if(!dir){ console.error('usage: node scripts/precompress.cjs DIR'); process.exit(1); }
  console.log(precompress(path.resolve(dir)));
}
module.exports = { precompress, WANTED };
