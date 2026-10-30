#!/usr/bin/env node
// Brings the traced U.S. military miniature medal bodies of the artwork tree into this tree (LIVE13 E118, Ethan: "nothing should be photos").
// The same lane as the badges (scripts/sync-military-badges.cjs). A miniature on the uniform is the award's ribbon SVG as its drape plus this
// body, hung from the body's ribbon_attach anchor, as the CAP miniatures are; until a medal's body is here its drape hangs alone with a note.
//
//   node scripts/sync-military-medals.cjs              sync, then rewrite data/military-medals.js and data/asset-index.js
//   node scripts/sync-military-medals.cjs --dry-run    report what a sync would do; write nothing
//   node scripts/sync-military-medals.cjs --all        also take assets whose spec says the fidelity gates failed
//   node scripts/sync-military-medals.cjs --check      exit 1 when a sync would change a file (the tree is behind the art tree)
//
// Source: <ARTWORK_SRC>/military/v3/out-medals/<asset id>/<asset id>.svg + .spec.json (ARTWORK_SRC as scripts/sync-artwork.cjs), the spec
// fields of the badge lane. Only out-medals is read: the old medals in assets/military/medals/*/final are rejected art.
//
// Matching an asset to an award: the award's catalog record keeps the picture's name without its extension (representations.miniatureMedal
// .artReference, "images/military-mini-medals/<service>/<name>"). The asset's spec `reference` names the same picture, with or without
// an extension; failing that its dimensions.service and dimensions.medal, or the old lane's id, medal-<service>-<name>-mini, say the same.
//
// Gate: as the badges, an asset whose spec says fidelity.pass is false, or has no fidelity block, is left out unless --all is given.
//
// What a sync writes, for each matched, passing asset:
//   * images/medals/military/<asset id>.svg     the SVG, byte for byte (the manifest row carries what the engine reads)
//   * images/MANIFEST.json                      a row under the asset id, category medals, with the size, the anchors (ribbon_attach) and provenance
//   * data/military-medals.js                   catalog award id -> { artId, w, h }, read by js/uniform-view.js buildMedals
//   * data/asset-index.js                       scripts/build-asset-index.cjs
// Idempotent. The master stamps index.html afterwards; this script never touches it.
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const IMAGES = path.join(ROOT, 'images');
const OUT = path.join(ROOT, 'data', 'military-medals.js');
const DEST_DIR = 'medals/military';
const CATEGORY = 'medals';
// The asset rules of the art (military/v3/README.md): no text, image, filter, opacity or gradient; a copy that breaks one is refused.
const FORBIDDEN = /<(text|image|filter|linearGradient|radialGradient|foreignObject|script)\b|\s(opacity|fill-opacity|stroke-opacity|filter)=/;

const artRoot = () => process.env.ARTWORK_SRC || path.join(ROOT, '..', 'UniformBuilder', 'artwork-samples', 'assets');
const medalsDir = () => path.join(artRoot(), 'military', 'v3', 'out-medals');
const refKey = value => { const m = /military-mini-medals\/([^/]+)\/([^/.?#]+)/.exec(String(value || '')); return m ? `${m[1]}/${m[2]}` : null; };

// Every asset that has a readable spec and SVG. An asset another worker is still writing is reported, not thrown on.
function readAssets(){
  const assets = [], broken = [], dir = medalsDir();
  if(!fs.existsSync(dir)) return { assets, broken };
  for(const id of fs.readdirSync(dir).sort()){
    const sub = path.join(dir, id);
    if(!fs.statSync(sub).isDirectory()) continue;
    const specFile = path.join(sub, id + '.spec.json'), svgFile = path.join(sub, id + '.svg');
    if(!fs.existsSync(specFile) || !fs.existsSync(svgFile)){ broken.push({ id, why: 'spec or svg missing' }); continue; }
    let spec;
    try{ spec = JSON.parse(fs.readFileSync(specFile, 'utf8')); }catch(e){ broken.push({ id, why: 'spec is not JSON (' + e.message + ')' }); continue; }
    if(spec.asset_id && spec.asset_id !== id){ broken.push({ id, why: `spec asset_id is ${spec.asset_id}` }); continue; }
    const w = spec.size_in ? spec.size_in.w : spec.width_in, h = spec.size_in ? spec.size_in.h : spec.height_in;
    if(!(w > 0 && h > 0)){ broken.push({ id, why: 'spec has no size' }); continue; }
    const svg = fs.readFileSync(svgFile, 'utf8');
    const vb = /viewBox="([^"]+)"/.exec(svg);
    const box = vb ? vb[1].trim().split(/[\s,]+/).map(Number) : null;
    if(!box || box.length !== 4 || Math.abs(box[2] - w * 100) > 0.01 || Math.abs(box[3] - h * 100) > 0.01){ broken.push({ id, why: `viewBox ${vb ? vb[1] : 'missing'} is not ${w} x ${h} in at 0.01 in per unit` }); continue; }
    if(FORBIDDEN.test(svg)){ broken.push({ id, why: 'the SVG holds text, a raster, a filter, opacity or a gradient' }); continue; }
    const d = spec.dimensions || {}, oldId = /^medal-(air-force|army|coast-guard|marine-corps|navy|space-force)-(.+)-mini$/.exec(id);
    const key = refKey(spec.reference) || (d.service && d.medal ? `${d.service}/${d.medal}` : null) || (oldId ? `${oldId[1]}/${oldId[2].replace(/-/g, '_')}` : null);
    const fid = spec.fidelity || null;
    assets.push({ id, spec, svg, w, h, key, pass: !!(fid && fid.pass === true), note: fid ? (fid.pass ? '' : fid.note || 'a fidelity gate failed') : 'no fidelity block (not gated)' });
  }
  return { assets, broken };
}

// artReference key -> the award ids (the catalog record's own and its canonical id) a medal body serves. A medal the catalog never had a
// picture for is found by its name, "<any service>/<award id>".
function catalogKeys(){
  const core = require('../military/military-core.js');
  const data = require('./sync-military-ribbons.cjs').readCatalog();
  const keys = new Map(), byName = new Map();
  for(const award of data.awards){
    if(String(award.type || 'RIBBON').toUpperCase() !== 'RIBBON' || core.isCapAward(award)) continue;
    const mini = award.representations && award.representations.miniatureMedal;
    if(mini && mini.status === 'NOT_APPLICABLE') continue;
    const ids = [award.id, core.canonicalAwardKey(award)];
    for(const id of ids) byName.set(id, new Set(ids));
    const key = refKey(mini && mini.artReference);
    if(!key) continue;
    if(!keys.has(key)) keys.set(key, new Set());
    for(const id of ids) keys.get(key).add(id);
  }
  return { keys, byName };
}

function manifestRow(a, rel){
  const s = a.spec, fid = s.fidelity || {};
  return {
    id: a.id, path: rel, category: CATEGORY, w_in: a.w, h_in: a.h, size_source: s.size_source || 'estimated', basis: s.size_basis || '',
    anchors: s.anchors || {}, landmarks: Object.keys(s.landmarks || {}), has_spec: false, issues: [],
    provenance: { data_source: s.data_source || null, generator: s.generator || null, reference: s.reference || null,
      fidelity: { pass: fid.pass === true, note: fid.note || '' }, art_tree: `military/v3/out-medals/${a.id}` }
  };
}

const manifestFile = () => path.join(IMAGES, 'MANIFEST.json');

function plan({ all = false } = {}){
  const { assets, broken } = readAssets();
  const { keys, byName } = catalogKeys();
  const manifest = JSON.parse(fs.readFileSync(manifestFile(), 'utf8'));
  const rows = new Map((manifest.assets || []).map(r => [r.id, r]));
  const sync = [], excluded = [], unmatched = [], table = {};
  for(const a of assets){
    const awards = a.key && (keys.get(a.key) || byName.get(a.key.split('/')[1]));
    if(!awards){ unmatched.push({ id: a.id, reference: a.spec.reference || null }); continue; }
    if(!a.pass && !all){ excluded.push({ id: a.id, why: a.note }); continue; }
    const rel = `${DEST_DIR}/${a.id}.svg`, dest = path.join(IMAGES, rel), row = manifestRow(a, rel);
    const have = fs.existsSync(dest) ? fs.readFileSync(dest, 'utf8') : null, was = rows.get(a.id);
    sync.push({ a, rel, dest, row, svgChange: have === null ? 'new' : have === a.svg ? 'same' : 'updated', rowChange: !was ? 'new' : JSON.stringify(was) === JSON.stringify(row) ? 'same' : 'updated', conflict: was && was.category !== CATEGORY ? `manifest id ${a.id} already belongs to ${was.category}` : null });
    for(const award of awards) table[award] = { artId: a.id, w: a.w, h: a.h };
  }
  const medals = keys.size;
  return { sync, excluded, unmatched, broken, table, manifest, medals, assets: assets.length };
}

function tableText(table){
  const lines = Object.keys(table).sort().map(id => `    ${JSON.stringify(id)}: ${JSON.stringify(table[id])}`);
  return `// Generated by scripts/sync-military-medals.cjs from the artwork tree's military/v3/out-medals. Do not edit by hand.
// Catalog award id -> the medal body drawn under its ribbon: { artId (the manifest id), w, h (inches) }. An award not listed has no body yet.
(function(root){
  const medals = {
${lines.join(',\n')}
  };
  if(typeof module === 'object' && module.exports) module.exports = medals;
  else root.CAPUBMilitaryMedals = medals;
})(typeof self !== 'undefined' ? self : this);
`;
}

function apply(p){
  let changed = 0;
  const manifest = p.manifest;
  for(const s of p.sync){
    if(s.conflict) throw new Error(s.conflict);
    if(s.svgChange !== 'same'){ fs.mkdirSync(path.dirname(s.dest), { recursive: true }); fs.writeFileSync(s.dest, s.a.svg); changed++; }
    if(s.rowChange !== 'same'){
      const i = manifest.assets.findIndex(r => r.id === s.row.id);
      if(i < 0) manifest.assets.push(s.row); else manifest.assets[i] = s.row;
      changed++;
    }
  }
  if(changed){
    manifest.count = manifest.assets.length;
    fs.writeFileSync(manifestFile(), JSON.stringify(manifest, null, 1) + '\n');
  }
  const text = tableText(p.table);
  if(!fs.existsSync(OUT) || fs.readFileSync(OUT, 'utf8') !== text){ fs.writeFileSync(OUT, text); changed++; }
  const idx = require('./build-asset-index.cjs');
  const idxText = idx.build();
  if(!fs.existsSync(idx.OUT) || fs.readFileSync(idx.OUT, 'utf8') !== idxText){ fs.writeFileSync(idx.OUT, idxText); changed++; }
  return changed;
}

function pending(p){
  if(p.sync.some(s => s.svgChange !== 'same' || s.rowChange !== 'same')) return true;
  if(!fs.existsSync(OUT) || fs.readFileSync(OUT, 'utf8') !== tableText(p.table)) return true;
  const idx = require('./build-asset-index.cjs');
  return (fs.existsSync(idx.OUT) ? fs.readFileSync(idx.OUT, 'utf8') : '') !== idx.build();
}

function report(p, out){
  out(`out-medals: ${p.assets} readable (${p.broken.length} unreadable or malformed); catalog medals with a name to match: ${p.medals}`);
  out(`synced: ${p.sync.length}; ${p.excluded.length} left out by the gate; ${p.unmatched.length} match no award; ${p.medals - p.sync.length} medals stay pending (the ribbon's drape alone)`);
  if(p.excluded.length) out('left out (fidelity gate):\n  ' + p.excluded.map(e => `${e.id}: ${e.why}`).join('\n  '));
  if(p.unmatched.length) out('match no award:\n  ' + p.unmatched.map(u => `${u.id} (${u.reference})`).join('\n  '));
  if(p.broken.length) out('unreadable or malformed:\n  ' + p.broken.map(b => `${b.id}: ${b.why}`).join('\n  '));
}

if(require.main === module){
  const args = process.argv.slice(2);
  const p = plan({ all: args.includes('--all') });
  if(args.includes('--check')){
    if(pending(p)){ report(p, console.error); console.error('the tree is behind the art tree: run node scripts/sync-military-medals.cjs'); process.exit(1); }
    console.log(`military medal SVGs are current (${p.sync.length} synced).`);
  }else if(args.includes('--dry-run')) report(p, console.log);
  else{
    const changed = apply(p);
    report(p, console.log);
    console.log(changed ? `${changed} file(s) or row(s) written` : 'nothing to write');
  }
}
module.exports = { plan, apply, pending, readAssets, manifestRow, tableText, medalsDir, OUT, CATEGORY };
