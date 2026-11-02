#!/usr/bin/env node
// Writes data/military-badge-sizes.js: for every U.S. military badge the page offers on the dress uniforms, the traced SVG it is
// drawn from and that SVG's real size, so the engine lays each badge out at its published width (js/engine/profiles-dress.js
// putBadge) instead of in one fixed box.
//
//   node scripts/build-military-badge-sizes.cjs            rewrite data/military-badge-sizes.js, print the report
//   node scripts/build-military-badge-sizes.cjs --check    exit 1 when the file is not what this script writes
//
// Sources, both in this tree:
//   * the badges and their assets: military/military-data.js (window.CAPUBMilitaryData.badges, representations.metal; each
//     variant's `asset` is the path of its traced SVG, images/military-badges/<service>/<badge dir>/<variant>.svg, written there by
//     scripts/sync-military-badges.cjs);
//   * the sizes: that SVG's row in images/MANIFEST.json (category military-badges; w_in x h_in is the viewBox at 0.01 in per unit,
//     size_source measured = Vanguard's regulation-size listing, estimated = from the badge's aspect; neither DAFI 36-2903 nor
//     CAPR 39-1 prints a badge size). The row's id is the art id the engine places.
//
// A badge/variant whose asset has no manifest row, or still names a raster, gets no entry: the engine draws nothing for it and the
// scene says so (there is no raster fallback; LIVE13 E118, "nothing should be photos"). The report lists them; the sync fixes them.
//
// Matching a page badge to its traced art (used by the sync, exported from here so both use one matcher): the art spec's `reference`
// names the raster it was traced from as images/military-badges/<service>/<design>__<variant>; the page's asset is
// images/military-badges/<service>/<badge dir>/<variant>.svg. The two agree once the service prefix and the _badge / _insignia /
// _identification suffixes are stripped from the design. The Air Force pilot variants (pilot, senior_pilot, command_pilot) are the
// art's basic, senior and command levels; the Army basic parachutist is the art's basic.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const OUT = path.join(root, 'data', 'military-badge-sizes.js');

// ---- the page's military badges ------------------------------------------------------------------

function pageBadges(){
  const sandbox = { window: null };
  sandbox.window = sandbox;
  vm.runInNewContext(fs.readFileSync(path.join(root, 'military', 'military-data.js'), 'utf8'), sandbox);
  return sandbox.CAPUBMilitaryData.badges;
}

// Every (badge id, variant, asset path) with a metal asset.
function metalAssets(badges){
  const out = [];
  for(const b of badges){
    const m = b.representations && b.representations.metal;
    if(!m) continue;
    const variants = m.variants && Object.keys(m.variants).length ? m.variants : { [m.defaultVariant || 'default']: m };
    for(const [variant, rec] of Object.entries(variants)){
      if(rec && rec.asset) out.push({ badge: b.id, variant, asset: rec.asset });
    }
  }
  return out;
}

// ---- matching an art spec to a page badge --------------------------------------------------------

const normDesign = x => String(x).replace(/^(air_force|army|navy|coast_guard|marine_corps)_/, '').replace(/_(identification_badge|insignia|badge|identification)$/, '');

function variantCandidates(v){
  const c = [v];
  c.push(v.replace(/_?(pilot|parachutist)$/, '') || 'basic'); // senior_pilot -> senior, pilot -> basic, basic_parachutist -> basic
  return [...new Set(c)];
}

// specs: [{ id, service, design, variant, ... }] from the art specs' references. Returns (asset, variant) -> the spec, or null.
function match(specs){
  const by = new Map();
  for(const s of specs){
    const k = s.service + '|' + normDesign(s.design);
    if(!by.has(k)) by.set(k, new Map());
    by.get(k).set(s.variant, s);
  }
  return (asset, variant) => {
    const p = asset.split('/'); // images/military-badges/<service>/<badge dir>/<variant>.svg
    const g = by.get(p[2] + '|' + normDesign(p[3]));
    if(!g) return null;
    for(const c of variantCandidates(variant)) if(g.has(c)) return g.get(c);
    return null;
  };
}

// ---- the traced SVGs the sync has brought into this tree -----------------------------------------

// 'images/<path>' -> manifest row, for every military-badges row whose SVG is in the tree.
function syncedSvgs(){
  const file = path.join(root, 'images', 'MANIFEST.json');
  const byPath = new Map();
  if(!fs.existsSync(file)) return byPath;
  for(const row of JSON.parse(fs.readFileSync(file, 'utf8')).assets || []){
    if(row.category === 'military-badges' && /\.svg$/.test(row.path) && fs.existsSync(path.join(root, 'images', row.path))) byPath.set('images/' + row.path, row);
  }
  return byPath;
}

// ---- build ---------------------------------------------------------------------------------------

const r3 = n => Math.round(n * 1000) / 1000;

function build(){
  const assets = metalAssets(pageBadges());
  const svgs = syncedSvgs();
  const table = {}, missing = [];
  for(const a of assets){
    const key = `${a.badge}/${a.variant}`;
    const row = svgs.get(a.asset);
    if(!row){
      missing.push({ key, asset: a.asset, why: /\.svg$/.test(a.asset) ? 'no manifest row (category military-badges) or the file is missing' : 'the catalog names a raster: run node scripts/sync-military-badges.cjs' });
      continue;
    }
    table[key] = { w: r3(row.w_in), h: r3(row.h_in), source: row.size_source || 'estimated', artId: row.id, asset: a.asset };
  }
  const keys = Object.keys(table).sort();
  const body = keys.map(k => `  ${JSON.stringify(k)}: ${JSON.stringify(table[k])}`).join(',\n');
  const text = `// Generated by scripts/build-military-badge-sizes.cjs from military/military-data.js and images/MANIFEST.json. Do not edit by hand.
// "<badge id>/<variant>": { w, h } is the badge's real size in inches (source: measured = Vanguard's regulation-size listing,
// estimated = from the badge's aspect), artId the traced SVG's manifest id (category military-badges; its viewBox is w x h) and asset
// its path, the path the catalog record names. js/engine/profiles-dress.js putBadge places the SVG at w x h; a badge/variant with no
// entry is not drawn and the scene says so. Nothing here is a raster (LIVE13 E118, "nothing should be photos").
// ${keys.length} of ${assets.length} metal badge/variants draw a traced SVG; ${missing.length} have none.
(function(root){
  const sizes = {
${body}
  };
  if(typeof module === 'object' && module.exports) module.exports = sizes;
  else root.CAPUBMilitaryBadgeSizes = sizes;
})(typeof self !== 'undefined' ? self : this);
`;
  return { text, table, missing, withSvg: keys.length, total: assets.length, assets };
}

if(require.main === module){
  const r = build();
  if(process.argv.includes('--check')){
    if(!fs.existsSync(OUT) || fs.readFileSync(OUT, 'utf8') !== r.text){ console.error('data/military-badge-sizes.js is stale: run node scripts/build-military-badge-sizes.cjs'); process.exit(1); }
    console.log('data/military-badge-sizes.js is current.');
  }else{
    fs.writeFileSync(OUT, r.text);
    console.log(`wrote ${path.relative(root, OUT)}: ${r.withSvg} of ${r.total} metal badge/variants draw a traced SVG, ${r.missing.length} have none`);
    const src = {};
    Object.values(r.table).forEach(e => { src[e.source] = (src[e.source] || 0) + 1; });
    console.log('size sources:', JSON.stringify(src));
    if(r.missing.length) console.log('no traced SVG (not drawn):\n  ' + r.missing.map(m => `${m.key} (${m.asset}): ${m.why}`).join('\n  '));
  }
}
module.exports = { build, OUT, pageBadges, metalAssets, match, normDesign, variantCandidates, syncedSvgs };
