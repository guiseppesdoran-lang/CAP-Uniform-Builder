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

// Every file of this name under dir, in name order, so which one is taken never depends on the file system's listing order.
function findFiles(dir, name, hits = []){
  for(const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)){
    const full = path.join(dir, entry.name);
    if(entry.isDirectory()) findFiles(full, name, hits);
    else if(entry.name === name) hits.push(full);
  }
  return hits;
}

// The art beside a spec: the file the spec names, else <id>.svg, else <id>.png.
function artBeside(spec, id){
  const dir = path.dirname(spec);
  let named = null;
  try{ named = JSON.parse(fs.readFileSync(spec, 'utf8')).file; }catch(e){}
  for(const name of [named, id + '.svg', id + '.png']) if(typeof name === 'string' && /\.(svg|png)$/.test(name) && !name.includes('/') && fs.existsSync(path.join(dir, name))) return path.join(dir, name);
  return null;
}

// The spec of an id and the art beside it. The art tree keeps the layout the manifest records, so the folder the manifest already gives the id comes first
// (an older traced SVG of the same id in another folder never counts); an id the manifest does not know is looked up by name, the first in name order.
function locate(id, entry){
  const known = entry ? [path.join(src, path.dirname(entry.path), id + '.spec.json')] : [];
  for(const spec of known.concat(findFiles(src, id + '.spec.json'))){
    const art = fs.existsSync(spec) && artBeside(spec, id);
    if(art) return { spec, art };
  }
  return null;
}

const ids = process.argv.slice(2);
if(!ids.length){ console.error('usage: sync-artwork.cjs <asset-id> ...'); process.exit(1); }
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
let failed = 0;
for(const id of ids){
  const entry = manifest.assets.find(a => a.id === id);
  // Vector art is <id>.svg; official digital artwork taken as given, and a digital picture made from a photograph, is <id>.png, copied byte for byte.
  const found = locate(id, entry);
  if(!found){ console.error(`${id}: no source .svg/.png and .spec.json under ${src}`); failed++; continue; }
  const { spec, art: svg } = found;
  let rel = entry ? entry.path : path.relative(src, svg).split(path.sep).join('/');
  // An id that had an SVG and now has the official PNG (or the reverse) takes the path of the file it has.
  if(entry && path.extname(rel) !== path.extname(svg)) rel = rel.replace(/\.[a-z]+$/, path.extname(svg));
  const dest = path.join(images, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(svg, dest);
  // The SVG an id used to have goes when it now has a PNG.
  if(path.extname(dest) === '.png' && fs.existsSync(dest.replace(/\.png$/, '.svg'))) fs.rmSync(dest.replace(/\.png$/, '.svg'));
  fs.copyFileSync(spec, dest.replace(/\.(svg|png)$/, '.spec.json'));
  const s = JSON.parse(fs.readFileSync(spec, 'utf8'));
  // Two spec dialects exist: size_in {w,h} (garments, badges) and width_in/height_in (enamel, traced patches).
  if(!s.size_in) s.size_in = { w: s.width_in, h: s.height_in };
  if(entry) entry.path = rel;
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
require('node:child_process').execFileSync(process.execPath, [path.join(__dirname, 'build-asset-index.cjs')], { stdio: 'inherit' });
process.exit(failed ? 1 : 0);
