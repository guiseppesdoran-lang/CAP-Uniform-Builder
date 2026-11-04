#!/usr/bin/env node
// Brings the vector patches of the artwork tree into this tree and says which picture each patch of the page draws (LIVE13 E118, Ethan: "nothing
// should be photos").
//
//   node scripts/sync-patches.cjs              copy the art (scripts/sync-artwork.cjs), rewrite data/patch-art.js and data/unit-patch-art.js
//   node scripts/sync-patches.cjs --dry-run    report what a sync would do; write nothing
//   node scripts/sync-patches.cjs --check      exit 1 when data/patch-art.js or data/unit-patch-art.js is behind the art tree
//
// Source: <ARTWORK_SRC>/patches/<asset id>/<asset id>.svg + .spec.json. Art still being written (no spec, or no SVG) waits. A patch has its
// asset by name (ner_patch would be patch-ner) unless ASSET_FOR says otherwise.
//
// data/patch-art.js: patch id -> { asset, img, w, h } (the manifest id, the SVG under images/, the size in inches from the spec), or, while a
// patch has no vector, { img } with its picture from WAITING. js/catalog.js puts these on PATCH_META, so the art of a patch lands by running this
// script: its row turns into the SVG and its raster goes off the list in tests/no-raster-allowlist.json.
//
// data/unit-patch-art.js: one row per unit emblem, {charter, patchId, label, echelon, w, h, asset, img}, for every patch spec of the art tree that
// carries a `charter` (the unit's charter number, e.g. "MAR-DC-026"; a wing's or region's emblem carries the code of its headquarters,
// "PCR-CA-001" or "PCR-PCR-001"). The spec's other keys: `label` (or `unit_label`, `unit_name`) names the unit, `echelon` is one of national, region,
// wing, group, squadron (otherwise read from the charter number: -000 and -001 are a headquarters). js/catalog.js builds the unit patch table
// (charter -> patch), the patch catalog entries and each unit's higher headquarters patch from these rows, so a new unit emblem needs no code:
// its spec carries the charter and this script is run. patchId is `unit_` and the charter in lower case with underscores.
// A few emblems made before the specs carried a charter have theirs in UNIT_SPEC_DEFAULTS below; a spec's own value wins.
// Idempotent. The master stamps index.html afterwards; this script never touches it.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'patch-art.js');
const UNIT_OUT = path.join(ROOT, 'data', 'unit-patch-art.js');
const artRoot = () => process.env.ARTWORK_SRC || path.join(ROOT, '..', 'UniformBuilder', 'artwork-samples', 'assets');

// The patches whose asset is not patch-<id less _patch>.
const ASSET_FOR = {
  dog_patch: 'patch-es-style-2',
  plane_patch: 'patch-es-style-1',
  af_space_command_patch: 'patch-af-space-command-fc', comms_patch: 'patch-communications', communications_patch: 'patch-communications',
  cos_patch: 'patch-cadet-officer-school', nbb_patch: 'patch-national-blue-beret', nfa_patch: 'patch-national-flight-academy',
  orientation_pilot_patch: 'patch-cadet-orientation-pilot', pjoc_patch: 'patch-pararescue-orientation', pjoc_ocp_patch: 'patch-pararescue-orientation',
  undergrad_pilot_training_patch: 'patch-supt-familiarization', ner_patch: 'patch-northeast-region', nywg_patch: 'patch-new-york-wing',
  cla_patch: 'patch-civic-leadership-academy', tn330_ocp_patch: 'patch-sequoyah-cadet-squadron', national_staff_ocp_patch: 'patch-national-staff',
  tn185_ocp_patch: 'patch-music-city-composite-squadron'
};
// Unit emblems whose spec was written before specs carried a charter (asset id -> charter and unit label). TN-185 and TN-330 are mapped by hand in
// js/catalog.js and js/patches.js and stay out of this list.
const UNIT_SPEC_DEFAULTS = {
  'patch-new-york-wing': { charter: 'NER-NY-001', label: 'New York Wing' },
  'patch-northeast-region': { charter: 'NER-NER-001', label: 'Northeast Region' },
  'patch-cap-command-patch': { charter: 'NHQ-NHQ-000', label: 'Civil Air Patrol National Headquarters' }
};
const ECHELONS = ['national', 'region', 'wing', 'group', 'squadron'];
// The picture of a patch with no vector yet. A patch in neither list has no picture at all until its art lands (the OCP crop of TN-185 was never
// a whole patch; the two legacy ids named files that are not there).
const WAITING = {};
// In the page's patch list but outside the PATCH_META literal (js/patches.js adds it).
const EXTRA_IDS = ['tn330_ocp_patch'];

function patchIds(){
  const src = fs.readFileSync(path.join(ROOT, 'js', 'catalog.js'), 'utf8');
  const start = src.indexOf('const PATCH_META = ') + 'const PATCH_META = '.length;
  let depth = 0, i = start;
  for(; i < src.length; i++){ if(src[i] === '{') depth++; else if(src[i] === '}' && !--depth) break; }
  return [...Object.keys(Function(`return ${src.slice(start, i + 1)}`)()), ...EXTRA_IDS];
}

const assetFor = id => ASSET_FOR[id] || 'patch-' + id.replace(/_patch$/, '').replace(/_/g, '-');

function readArt(asset){
  const dir = path.join(artRoot(), 'patches', asset);
  const specFile = path.join(dir, asset + '.spec.json'), svgFile = path.join(dir, asset + '.svg');
  if(!fs.existsSync(specFile) || !fs.existsSync(svgFile)) return null;
  try{
    const s = JSON.parse(fs.readFileSync(specFile, 'utf8'));
    const w = s.size_in ? s.size_in.w : s.width_in, h = s.size_in ? s.size_in.h : s.height_in;
    return w > 0 && h > 0 ? { w, h } : null;
  }catch(e){ return null; }
}

// The level of a unit from its charter number, as js/catalog.js getUnitEchelon reads it (a group is told by name there; a spec says so).
function echelonOfCharter(code){
  const parts = String(code || '').toUpperCase().split('-');
  if(parts.length < 3) return 'squadron';
  const last = parts[2], first = parts[0], mid = parts[1];
  if(first === 'NHQ' && mid === 'NHQ') return (last === '000' || last === '001' || /^[A-Z]{3}$/.test(last)) ? 'national' : 'squadron';
  if(last === '000' || last === '001') return mid === first ? 'region' : 'wing';
  return 'squadron';
}

const unitPatchId = charter => 'unit_' + charter.toLowerCase().replace(/[^a-z0-9]+/g, '_');
const humanize = asset => asset.replace(/^patch-/, '').split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

// Rows for every spec of the art tree that has a charter, sorted by charter. Warnings name a charter two specs claim (the first by name wins).
function unitRows(){
  const base = path.join(artRoot(), 'patches'), rows = [], warnings = [];
  if(!fs.existsSync(base)) return { rows, warnings };
  for(const asset of fs.readdirSync(base).sort()){
    const specFile = path.join(base, asset, asset + '.spec.json');
    if(!fs.existsSync(specFile) || !fs.existsSync(path.join(base, asset, asset + '.svg'))) continue;
    let s;
    try{ s = JSON.parse(fs.readFileSync(specFile, 'utf8')); }catch(e){ continue; }
    const dflt = UNIT_SPEC_DEFAULTS[asset] || {};
    const charter = String(s.charter || dflt.charter || '').trim().toUpperCase();
    if(!/^[A-Z0-9]{2,4}(-[A-Z0-9]{2,4}){1,2}$/.test(charter)) continue;
    const w = s.size_in ? s.size_in.w : s.width_in, h = s.size_in ? s.size_in.h : s.height_in;
    if(!(w > 0 && h > 0)) continue;
    let echelon = String(s.echelon || '').trim().toLowerCase();
    if(echelon === 'flight') echelon = 'squadron';
    if(!ECHELONS.includes(echelon)) echelon = echelonOfCharter(charter);
    const label = String(s.label || s.unit_label || s.unit_name || dflt.label || humanize(asset)).trim();
    if(rows.some(r => r.charter === charter)){ warnings.push(`${charter}: ${asset} repeats a charter already taken, left out`); continue; }
    rows.push({ charter, patchId: unitPatchId(charter), label, echelon, w, h, asset, img: `patches/${asset}/${asset}.svg` });
  }
  rows.sort((a, b) => a.charter < b.charter ? -1 : a.charter > b.charter ? 1 : 0);
  return { rows, warnings };
}

function unitText(rows){
  const lines = rows.map(r => `    ${JSON.stringify(r)}`);
  return `// Generated by scripts/sync-patches.cjs from the artwork tree's patch specs that carry a charter. Do not edit by hand.
// One row per unit emblem: { charter, patchId, label, echelon, w, h, asset, img }. js/catalog.js builds the unit patch table from it.
(function(root){
  const rows = [
${lines.join(',\n')}
  ];
  if(typeof module === 'object' && module.exports) module.exports = rows;
  else root.CAPUBUnitPatchArt = rows;
})(typeof self !== 'undefined' ? self : this);
`;
}

function plan(){
  const rows = {}, copy = new Set(), pending = [], none = [];
  for(const id of patchIds()){
    const asset = assetFor(id), art = readArt(asset);
    if(art){ rows[id] = { asset, img: `patches/${asset}/${asset}.svg`, w: art.w, h: art.h }; copy.add(asset); }
    else if(WAITING[id]){ rows[id] = { img: WAITING[id] }; pending.push(id); }
    else none.push(id);
  }
  const units = unitRows();
  for(const r of units.rows) copy.add(r.asset);
  return { rows, copy: [...copy].sort(), pending, none, units: units.rows, warnings: units.warnings };
}

function text(rows){
  const lines = Object.keys(rows).sort().map(id => `    ${JSON.stringify(id)}: ${JSON.stringify(rows[id])}`);
  return `// Generated by scripts/sync-patches.cjs from the artwork tree's patches. Do not edit by hand.
// Patch id -> its picture: { asset, img, w, h } (manifest id, path under images/, inches), or { img } alone while the patch waits for its vector.
(function(root){
  const art = {
${lines.join(',\n')}
  };
  if(typeof module === 'object' && module.exports) module.exports = art;
  else root.CAPUBPatchArt = art;
})(typeof self !== 'undefined' ? self : this);
`;
}

if(require.main === module){
  const args = process.argv.slice(2);
  const p = plan();
  const say = out => {
    out(`${p.copy.length} assets for ${Object.keys(p.rows).length - p.pending.length} patches; on a raster until the art lands: ${p.pending.join(', ') || 'none'}; no picture: ${p.none.join(', ') || 'none'}`);
    out(`${p.units.length} unit emblems with a charter: ${p.units.map(r => r.charter).join(', ') || 'none'}`);
    for(const w of p.warnings) out(`warning: ${w}`);
  };
  const behind = file => !fs.existsSync(file.path) || fs.readFileSync(file.path, 'utf8') !== file.text;
  if(args.includes('--dry-run')) say(console.log);
  else if(args.includes('--check')){
    const stale = [{ path: OUT, text: text(p.rows) }, { path: UNIT_OUT, text: unitText(p.units) }].filter(behind);
    if(stale.length){ say(console.error); console.error(`${stale.map(f => path.relative(ROOT, f.path)).join(' and ')} ${stale.length > 1 ? 'are' : 'is'} behind the art tree: run node scripts/sync-patches.cjs`); process.exit(1); }
    console.log('data/patch-art.js and data/unit-patch-art.js are current.');
  }else{
    execFileSync(process.execPath, [path.join(__dirname, 'sync-artwork.cjs'), ...p.copy], { stdio: ['ignore', 'ignore', 'inherit'], env: Object.assign({}, process.env, { ARTWORK_SRC: artRoot() }) });
    fs.writeFileSync(OUT, text(p.rows));
    fs.writeFileSync(UNIT_OUT, unitText(p.units));
    say(console.log);
  }
}
module.exports = { plan, text, unitRows, unitText, echelonOfCharter, assetFor, patchIds, OUT, UNIT_OUT, ASSET_FOR, WAITING, UNIT_SPEC_DEFAULTS };
