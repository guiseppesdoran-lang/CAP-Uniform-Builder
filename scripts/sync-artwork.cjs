#!/usr/bin/env node
// Copy finished artwork from the artwork worktree into images/ and refresh its MANIFEST.json entry.
//   node scripts/sync-artwork.cjs <asset-id> [<asset-id> ...]
// Sources are looked up by file name under ARTWORK_SRC (default ../UniformBuilder/artwork-samples/assets).
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const images = path.join(root, 'images');
const src = process.env.ARTWORK_SRC || path.join(root, '..', 'UniformBuilder', 'artwork-samples', 'assets');
const manifestPath = path.join(images, 'MANIFEST.json');

function findFile(dir, name){
  for(const entry of fs.readdirSync(dir, { withFileTypes: true })){
    const full = path.join(dir, entry.name);
    if(entry.isDirectory()){ const hit = findFile(full, name); if(hit) return hit; }
    else if(entry.name === name) return full;
  }
  return null;
}

const ids = process.argv.slice(2);
if(!ids.length){ console.error('usage: sync-artwork.cjs <asset-id> ...'); process.exit(1); }
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
let failed = 0;
for(const id of ids){
  const entry = manifest.assets.find(a => a.id === id);
  const svg = findFile(src, id + '.svg');
  const spec = findFile(src, id + '.spec.json');
  if(!svg || !spec){ console.error(`${id}: no source .svg/.spec.json under ${src}`); failed++; continue; }
  const rel = entry ? entry.path : path.relative(src, svg).split(path.sep).join('/');
  const dest = path.join(images, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(svg, dest);
  fs.copyFileSync(spec, dest.replace(/\.svg$/, '.spec.json'));
  const s = JSON.parse(fs.readFileSync(spec, 'utf8'));
  const next = Object.assign(entry || { id, path: rel, category: rel.split('/')[0], has_spec: true, issues: [] }, {
    w_in: s.size_in.w, h_in: s.size_in.h,
    size_source: s.size_source, basis: s.size_basis || (entry && entry.basis),
    anchors: s.anchors || {},
    landmarks: Object.keys(s.landmarks || {})
  });
  if(!entry){ manifest.assets.push(next); manifest.count = manifest.assets.length; }
  console.log(`${id}: ${rel} (${s.size_in.w} x ${s.size_in.h} in)`);
}
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1) + '\n');
process.exit(failed ? 1 : 0);
