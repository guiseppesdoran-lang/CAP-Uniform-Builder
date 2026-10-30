#!/usr/bin/env node
// Writes data/military-badge-sizes.js: the real size of every U.S. military badge the page offers on the dress
// uniforms, so the engine draws each raster at its published width (js/engine/profiles-dress.js putBadge) instead
// of in one fixed 2.75 x 0.75 in box.
//
//   node scripts/build-military-badge-sizes.cjs            rewrite data/military-badge-sizes.js, print the report
//   node scripts/build-military-badge-sizes.cjs --check    exit 1 when the file is not what this script writes
//
// Sources:
//   * the badges and their metal PNGs: military/military-data.js (window.CAPUBMilitaryData.badges, representations.metal);
//   * the sizes: the in-house SVG badge specs of the artwork tree, <ARTWORK_SRC>/military/**/<art-id>.spec.json
//     (ARTWORK_SRC defaults to ../UniformBuilder/artwork-samples/assets, as scripts/sync-artwork.cjs). Two spec dialects
//     exist: size_in {w,h} or width_in / height_in. The non-field specs (the metal dress badges) are used; the *-field
//     specs are the embroidered utility forms and are not drawn on a dress uniform.
//     Sizes come from Vanguard's regulation-size listings where the art tree has one (size_source measured) and are
//     estimated from the badge's aspect otherwise (art commit afe8b075; neither DAFI 36-2903 nor CAPR 39-1 prints a
//     badge size). The size_source and the art id travel with each entry.
//   * the ink: the badge's box inside its PNG, from the art spec's source_bbox_user_units (the pixels of the reference PNG
//     the art was traced from), so the engine can draw the PNG with the badge, not the margin or the cloth around it,
//     filling the real size.
//
// Matching a page badge to an art spec: the art spec's `reference` names the PNG it was traced from as
// images/military-badges/<service>/<design>__<variant>; the page's PNG is images/military-badges/<service>/<badge dir>/
// <variant>.png. The two agree once the service prefix and the _badge / _insignia / _identification suffixes are stripped
// from the design. The Air Force pilot variants (pilot, senior_pilot, command_pilot) are the art's basic, senior and command
// levels; the Army basic parachutist is the art's basic.
//
// A badge/variant with no art spec keeps the old fixed box (the engine's FALLBACK); the report lists them.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const OUT = path.join(root, 'data', 'military-badge-sizes.js');
const ART = process.env.ARTWORK_SRC || path.join(root, '..', 'UniformBuilder', 'artwork-samples', 'assets');
// What putBadge drew every military raster in before this table (CAPR 39-1 4.1.5.2.2 places the badge; no size is printed).
const FALLBACK = { w: 2.75, h: 0.75 };

// ---- the page's military badges ------------------------------------------------------------------

function pageBadges(){
  const sandbox = { window: null };
  sandbox.window = sandbox;
  vm.runInNewContext(fs.readFileSync(path.join(root, 'military', 'military-data.js'), 'utf8'), sandbox);
  return sandbox.CAPUBMilitaryData.badges;
}

// Every (badge id, variant, PNG path) with an available metal asset.
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

// ---- the art tree's badge specs ------------------------------------------------------------------

function artSpecs(){
  const dir = path.join(ART, 'military');
  const specs = [];
  (function walk(d){
    for(const e of fs.readdirSync(d, { withFileTypes: true })){
      const f = path.join(d, e.name);
      if(e.isDirectory()) walk(f);
      else if(e.name.endsWith('.spec.json')){
        const id = e.name.replace(/\.spec\.json$/, '');
        if(/-field$/.test(id) || /^medals/.test(path.relative(dir, f))) continue;
        const s = JSON.parse(fs.readFileSync(f, 'utf8'));
        const w = s.size_in ? s.size_in.w : s.width_in, h = s.size_in ? s.size_in.h : s.height_in;
        const m = /military-badges\/([^/]+)\/([^/]+)__(.+)$/.exec(s.reference || '');
        if(!(w > 0 && h > 0) || !m) continue;
        if(!Array.isArray(s.source_bbox_user_units) || s.source_bbox_user_units.length !== 4) continue;
        // The same asset id can have a spec in a work-in-progress lane (assets/military/v3/out, a redraw being gated) and in
        // its final/ directory; the final one is the asset the builder draws, so it wins and the other is ignored.
        const spec = { id, w, h, source: s.size_source || 'estimated', basis: s.size_basis || '', service: m[1], design: m[2], variant: m[3], bbox: s.source_bbox_user_units, final: /\/final\//.test(f) };
        const dup = specs.findIndex(x => x.id === id);
        if(dup < 0) specs.push(spec);
        else if(spec.final && !specs[dup].final) specs[dup] = spec;
      }
    }
  })(dir);
  return specs;
}

const normDesign = x => String(x).replace(/^(air_force|army|navy|coast_guard|marine_corps)_/, '').replace(/_(identification_badge|insignia|badge|identification)$/, '');

function variantCandidates(v){
  const c = [v];
  c.push(v.replace(/_?(pilot|parachutist)$/, '') || 'basic'); // senior_pilot -> senior, pilot -> basic, basic_parachutist -> basic
  return [...new Set(c)];
}

function match(specs){
  const by = new Map();
  for(const s of specs){
    const k = s.service + '|' + normDesign(s.design);
    if(!by.has(k)) by.set(k, new Map());
    by.get(k).set(s.variant, s);
  }
  return (asset, variant) => {
    const p = asset.split('/'); // images/military-badges/<service>/<badge dir>/<variant>.png
    const g = by.get(p[2] + '|' + normDesign(p[3]));
    if(!g) return null;
    for(const c of variantCandidates(variant)) if(g.has(c)) return g.get(c);
    return null;
  };
}

// ---- the PNG's pixel size ------------------------------------------------------------------------

// The width and height in the IHDR chunk of a PNG.
function pngSize(file){
  const b = fs.readFileSync(file);
  if(b.toString('ascii', 1, 4) !== 'PNG') throw new Error(`${file}: not a PNG`);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

// ---- build ---------------------------------------------------------------------------------------

const r3 = n => Math.round(n * 1000) / 1000;

function build(){
  const assets = metalAssets(pageBadges());
  const find = match(artSpecs());
  const table = {}, fallback = [], aspectOff = [];
  for(const a of assets){
    const s = find(a.asset, a.variant);
    if(!s){ fallback.push(`${a.badge}/${a.variant}`); continue; }
    const img = pngSize(path.join(root, a.asset));
    // The badge's box in the PNG, in pixels: the art spec's source_bbox_user_units (user units are the reference PNG's pixels;
    // the art size is that box scaled). Not read from the PNG's alpha: the Army and some Navy PNGs are photographs on a
    // camouflage cloth, opaque to the edge.
    const ink = s.bbox.map(n => Math.round(n * 10) / 10);
    const inkW = ink[2] - ink[0], inkH = ink[3] - ink[1];
    if(ink[0] < 0 || ink[1] < 0 || ink[2] > img[0] + 1 || ink[3] > img[1] + 1) aspectOff.push({ key: `${a.badge}/${a.variant}`, why: 'bbox outside the PNG' });
    table[`${a.badge}/${a.variant}`] = { w: r3(s.w), h: r3(s.h), source: s.source, artId: s.id, asset: a.asset, img, ink };
    const aspectPng = inkW / inkH, aspectArt = s.w / s.h;
    if(Math.abs(aspectPng / aspectArt - 1) > 0.03) aspectOff.push({ key: `${a.badge}/${a.variant}`, why: `bbox aspect ${r3(aspectPng)} vs art ${r3(aspectArt)}` });
  }
  const keys = Object.keys(table).sort();
  const body = keys.map(k => `  ${JSON.stringify(k)}: ${JSON.stringify(table[k])}`).join(',\n');
  const text = `// Generated by scripts/build-military-badge-sizes.cjs from military/military-data.js and the artwork tree's military badge
// specs. Do not edit by hand. "<badge id>/<variant>": { w, h } is the badge's real size in inches (source: measured =
// Vanguard's regulation-size listing, estimated = from the badge's aspect; artId = the SVG spec it came from, asset = the page's PNG), img the
// PNG's pixel size and ink the badge's box [x0, y0, x1, y1] in it in pixels, so putBadge draws the ink at w x h.
// ${fallback.length} of ${assets.length} badge/variants have no art spec and keep the old ${FALLBACK.w} x ${FALLBACK.h} in box.
(function(root){
  const sizes = {
${body}
  };
  Object.defineProperty(sizes, 'FALLBACK', { value: ${JSON.stringify(FALLBACK)}, enumerable: false });
  if(typeof module === 'object' && module.exports) module.exports = sizes;
  else root.CAPUBMilitaryBadgeSizes = sizes;
})(typeof self !== 'undefined' ? self : this);
`;
  return { text, table, fallback, aspectOff, total: assets.length, assets };
}

if(require.main === module){
  const r = build();
  if(process.argv.includes('--check')){
    if(!fs.existsSync(OUT) || fs.readFileSync(OUT, 'utf8') !== r.text){ console.error('data/military-badge-sizes.js is stale: run node scripts/build-military-badge-sizes.cjs'); process.exit(1); }
    console.log('data/military-badge-sizes.js is current.');
  }else{
    fs.writeFileSync(OUT, r.text);
    const n = Object.keys(r.table).length;
    console.log(`wrote ${path.relative(root, OUT)}: ${n} of ${r.total} metal badge/variants mapped to an art spec, ${r.fallback.length} on the old ${FALLBACK.w} x ${FALLBACK.h} in box`);
    const src = {};
    Object.values(r.table).forEach(e => { src[e.source] = (src[e.source] || 0) + 1; });
    console.log('size sources:', JSON.stringify(src));
    if(r.fallback.length) console.log('fallback:\n  ' + r.fallback.join('\n  '));
    if(r.aspectOff.length) console.log(`art spec boxes that do not fit their PNG (${r.aspectOff.length}):\n  ` + r.aspectOff.map(a => `${a.key}: ${a.why}`).join('\n  '));
  }
}
module.exports = { build, OUT, ART, FALLBACK };
