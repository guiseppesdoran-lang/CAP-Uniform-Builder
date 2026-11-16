#!/usr/bin/env node
// Brings the measured military ribbon SVGs of the artwork tree into this tree and points the catalog at them (LIVE13 E118, Ethan:
// "ribbons needs to have new artwork too, i dont want the photos. nothing should be photos").
//
//   node scripts/sync-military-ribbons.cjs              copy the art (scripts/sync-artwork.cjs), rewrite military/military-data.js
//   node scripts/sync-military-ribbons.cjs --dry-run    report what a sync would do; write nothing
//
// Source: <ARTWORK_SRC>/ribbons/military/ (ARTWORK_SRC as scripts/sync-artwork.cjs): mil-ribbon-*.svg + .spec.json, _index.json
// (catalog award id -> ribbon asset), _variant-base-index.json (the Air Force awards whose precomposed PNGs gave a clean flat
// base, the bases military-variants.json builds on), _unresolved.json (awards with no art).
//
// Which asset an award draws (canonical award: every catalog record military-core.js canonicalizeAwards folds into one):
//   1. a CAP ribbon sheet the catalog already names (images/ribbons/ribbon-*.svg) stays: the same ribbon is drawn today;
//   2. else the award's _index asset when that asset is the exact vendor SVG (assets/ASSET_NOTES.md, source preference (a));
//   3. else the award's variant base when it has one: the art's own preference (b), the clean flat base over a vendor photo, and
//      the base the 344 recipes of military-variants.json name;
//   4. else the award's _index asset.
//
// What a sync writes:
//   * images/ribbons/military/<asset>.svg + .spec.json and a MANIFEST row each, through scripts/sync-artwork.cjs (category ribbons)
//   * data/asset-index.js, through scripts/build-asset-index.cjs (sync-artwork.cjs runs it)
//   * military/military-data.js: images.ribbon and representations.ribbon.asset name the SVG, images.ribbonAsset its manifest id; the
//     ribbon PNG/JPG paths and the precomposed device PNGs (deviceVariants.ribbonAssets) are gone from the catalog, and so are the
//     photo paths nothing draws any more (dropPhotoRecords): the miniature medals (their body SVGs come by scripts/sync-military-medals.cjs,
//     which matches on the artReference kept in the record), the full-size medals (drawn on no uniform) and the embroidered badges (no
//     U.S. military badge is worn on a utility uniform).
// Idempotent. The master stamps index.html afterwards; this script never touches it.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const core = require('../military/military-core.js');

const ROOT = path.join(__dirname, '..');
const ART = process.env.ARTWORK_SRC || path.join(ROOT, '..', 'UniformBuilder', 'artwork-samples', 'assets');
const SRC = path.join(ART, 'ribbons', 'military');
const MIL_FILE = path.join(ROOT, 'military', 'military-data.js');
const MIL_PRE = '(function(root){ root.CAPUBMilitaryData = Object.freeze(';
const MIL_POST = "); })(typeof globalThis !== 'undefined' ? globalThis : window);\n";

function readCatalog(){
  const text = fs.readFileSync(MIL_FILE, 'utf8');
  if(!text.startsWith(MIL_PRE) || !text.endsWith(MIL_POST)) throw new Error('military-data.js wrapper changed; update this script');
  return JSON.parse(text.slice(MIL_PRE.length, text.length - MIL_POST.length));
}
function writeCatalog(data){ fs.writeFileSync(MIL_FILE, MIL_PRE + JSON.stringify(data) + MIL_POST); }

const readJson = file => JSON.parse(fs.readFileSync(path.join(SRC, file), 'utf8'));
const colorSource = id => (readJson(id + '.spec.json').quality || {}).color_source || '';

// { canonical award id -> { asset, records, why } } for every ribbon the catalog names.
function plan(data){
  const index = readJson('_index.json'), bases = readJson('_variant-base-index.json');
  const ribbons = data.awards.filter(a => String(a.type || 'RIBBON').toUpperCase() === 'RIBBON' && !core.isCapAward(a));
  const groups = new Map();
  for(const award of ribbons) if(core.isWearableAwardRecord ? core.isWearableAwardRecord(award) : true){
    const key = core.canonicalAwardKey(award);
    if(!groups.has(key)) groups.set(key, []);
    groups.get(key).push(award);
  }
  const out = new Map(), unresolved = [];
  for(const [key, records] of groups){
    const ids = [key, ...records.flatMap(r => [r.id, ...(r.legacyCanonicalIds || [])])];
    const fromIndex = ids.map(id => index[id]).find(Boolean) || null;
    const fromBase = ids.map(id => bases[id]).find(Boolean) || null;
    const cap = records.map(r => /^images\/ribbons\/(ribbon-[^/]+)\.svg$/.exec(r.images && r.images.ribbon || '')).find(Boolean);
    let asset = null, why = '';
    if(cap){ asset = cap[1]; why = 'the CAP ribbon sheet the catalog already draws'; }
    else if(fromIndex && /vendor SVG \(exact\)/.test(colorSource(fromIndex))){ asset = fromIndex; why = 'exact vendor SVG'; }
    else if(fromBase){ asset = fromBase; why = 'variant base (clean flat art, the recipes\' base)'; }
    else if(fromIndex){ asset = fromIndex; why = '_index'; }
    if(!asset){ unresolved.push(key); continue; }
    out.set(key, { asset, records, why });
  }
  return { awards: out, unresolved };
}

function applyToCatalog(data, awards, assetIndex){
  let changed = 0;
  for(const { asset, records } of awards.values()){
    const svg = 'images/' + assetIndex[asset];
    for(const award of records){
      const images = award.images || (award.images = {});
      if(images.ribbon !== svg || images.ribbonAsset !== asset){ images.ribbon = svg; images.ribbonAsset = asset; changed++; }
      delete images.assetStatus;
      const reps = award.representations || (award.representations = {});
      const was = reps.ribbon || {};
      const next = { status: 'AVAILABLE', available: true, asset: svg };
      for(const k of ['verificationStatus', 'sources']) if(was[k] !== undefined) next[k] = was[k];
      if(JSON.stringify(was) !== JSON.stringify(next)){ reps.ribbon = next; changed++; }
    }
  }
  const dv = data.deviceVariants;
  if(dv){
    // The precomposed device PNGs: the engine draws the ribbon SVG and places the devices (military/military-device-layout.js).
    for(const k of ['ribbonAssets', 'airForceCompositeCount', 'airForceCompositeContactSheet']) if(dv[k] !== undefined){ delete dv[k]; changed++; }
    if(typeof dv.notes === 'string') dv.notes = dv.notes.replace(/\s*Air Force ribbonAssets point to[^.]*\./, '');
  }
  return changed;
}

// A medal record keeps what it says about the award (ribbon-only or a medal, its sources) and no longer names a picture.
function dropPhotoRecords(data){
  let changed = 0;
  for(const award of data.awards){
    const reps = award.representations;
    if(!reps) continue;
    const mini = reps.miniatureMedal;
    if(mini && mini.asset){
      mini.artReference = mini.asset.replace(/\.[a-z]+$/i, '');
      Object.assign(mini, { status: 'MISSING_ASSET', available: false, asset: null });
      changed++;
    }
    const full = reps.fullSizeMedal;
    if(full && full.asset){ Object.assign(full, { status: 'MISSING_ASSET', available: false, asset: null }); changed++; }
  }
  for(const badge of data.badges){
    if(badge.representations && badge.representations.embroidered){ delete badge.representations.embroidered; changed++; }
  }
  // The one CAP record that named a photo; nothing reads this list.
  for(const record of (data.capBadgeRepresentations && data.capBadgeRepresentations.records) || []){
    const cloth = record.representations && record.representations.embroidered;
    if(cloth && /\.(png|jpe?g|webp|gif)$/i.test(cloth.asset || '')){ delete record.representations.embroidered; changed++; }
  }
  return changed;
}

function main(){
  const dry = process.argv.includes('--dry-run');
  const data = readCatalog();
  const { awards, unresolved } = plan(data);
  const ids = [...new Set([...awards.values()].map(a => a.asset))].sort();
  const toCopy = ids.filter(id => /^mil-ribbon-/.test(id));
  console.log(`${awards.size} ribbon awards on ${ids.length} assets (${toCopy.length} mil-ribbon, ${ids.length - toCopy.length} CAP sheets); no art: ${unresolved.join(', ') || 'none'}`);
  if(dry){ for(const [key, a] of awards) console.log(`  ${key} -> ${a.asset} (${a.why})`); return; }
  execFileSync(process.execPath, [path.join(__dirname, 'sync-artwork.cjs'), ...toCopy], { stdio: ['ignore', 'ignore', 'inherit'], env: Object.assign({}, process.env, { ARTWORK_SRC: ART }) });
  delete require.cache[require.resolve('../data/asset-index.js')];
  const assetIndex = require('../data/asset-index.js');
  const missing = ids.filter(id => !assetIndex[id]);
  if(missing.length) throw new Error('not in data/asset-index.js after the sync: ' + missing.join(', '));
  const changed = applyToCatalog(data, awards, assetIndex) + dropPhotoRecords(data);
  writeCatalog(data);
  console.log(`military/military-data.js: ${changed} field(s) rewritten.`);
}

if(require.main === module) main();
module.exports = { plan, applyToCatalog, dropPhotoRecords, readCatalog, writeCatalog, SRC };
