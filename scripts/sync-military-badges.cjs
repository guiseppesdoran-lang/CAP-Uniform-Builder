#!/usr/bin/env node
// Brings the traced U.S. military badge SVGs of the artwork tree into this tree (LIVE13 E104, Ethan: "military badges need to
// be the custom artwork. same rigorous process as the cap badges").
//
//   node scripts/sync-military-badges.cjs              sync, then rewrite data/military-badge-sizes.js and data/asset-index.js
//   node scripts/sync-military-badges.cjs --dry-run    report what a sync would do; write nothing
//   node scripts/sync-military-badges.cjs --all        also take assets whose spec says the fidelity gates failed (see below)
//   node scripts/sync-military-badges.cjs --check      exit 1 when a sync would change a file (the tree is behind the art tree)
//
// Source: <ARTWORK_SRC>/military/v3/out/<art id>/<art id>.svg + .spec.json (ARTWORK_SRC defaults to ../UniformBuilder/
// artwork-samples/assets, as scripts/sync-artwork.cjs). Only v3/out is read: the older shells in assets/military/<service>/final/
// have the same ids and geometry but rejected art, and are never copied. A badge/variant with no v3 asset keeps its PNG.
//
// Matching a v3 asset to a page badge: the spec's `reference` names the builder raster it was traced from as
// images/military-badges/<service>/<design>__<variant>; the page's PNG (military/military-data.js representations.metal) is
// images/military-badges/<service>/<badge dir>/<variant>.png. The two agree once the service prefix and the _badge / _insignia /
// _identification suffixes are stripped from the design (scripts/build-military-badge-sizes.cjs normDesign), the Air Force pilot
// variants (pilot, senior_pilot, command_pilot) being the art's basic, senior and command levels and the Army basic parachutist the
// art's basic (variantCandidates). The same matcher the size table uses, so the SVG an entry draws is the asset its size came from.
//
// Gate: the art tree writes every trace to v3/out with its fidelity block (gate-badge.js: silhouette IoU, aspect, interior-edge
// recall, light-tone face count, tone RMS; a cloth-photo source fails by definition). An asset whose spec says `fidelity.pass`
// is false, or has no fidelity block, is not finished art and is left out unless --all is given; the report lists each with the
// spec's note. The PNG stays in place for it.
//
// What a sync writes, for each matched, passing asset:
//   * images/military-badges/<service>/<badge dir>/<variant>.svg      the SVG, byte for byte (the .spec.json is not copied: the
//                                                                      manifest row carries what the engine reads)
//   * images/MANIFEST.json                                             a row under the art id, category military-badges, with the
//                                                                      spec's size, anchors, size_source, basis and provenance
//                                                                      (reference raster, generator, fidelity scores); count updated
//   * data/military-badge-sizes.js                                     scripts/build-military-badge-sizes.cjs (each synced entry gains svg)
//   * data/asset-index.js                                              scripts/build-asset-index.cjs (id -> path, artwork version)
// Idempotent: an SVG already identical is left alone, a row already equal is left alone; running twice changes nothing.
// The master stamps index.html afterwards (npm run stamp:assets); this script never touches index.html.
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const sizes = require('./build-military-badge-sizes.cjs');

const root = path.join(__dirname, '..');
const images = path.join(root, 'images');
const manifestPath = path.join(images, 'MANIFEST.json');
const ART = sizes.ART;
const V3 = path.join(ART, 'military', 'v3', 'out');
const CATEGORY = 'military-badges';
// The asset rules the v3 art keeps (v3/README.md): no text, image, filter, opacity or gradient; a copy that breaks one is refused.
const FORBIDDEN = /<(text|image|filter|linearGradient|radialGradient|foreignObject|script)\b|\s(opacity|fill-opacity|stroke-opacity|filter)=/;

// ---- the v3 assets -------------------------------------------------------------------------------

// Every v3/out asset that has a readable spec and SVG: { id, dir, svgFile, spec, svg, pass, note, service, design, variant, w, h }.
// An asset another worker is still writing (missing file, unparsable JSON) is reported, not thrown on.
function v3Assets(){
  const out = [], broken = [];
  if(!fs.existsSync(V3)) return { assets: out, broken };
  for(const id of fs.readdirSync(V3).sort()){
    const dir = path.join(V3, id);
    if(!fs.statSync(dir).isDirectory()) continue;
    const specFile = path.join(dir, id + '.spec.json'), svgFile = path.join(dir, id + '.svg');
    if(!fs.existsSync(specFile) || !fs.existsSync(svgFile)){ broken.push({ id, why: 'spec or svg missing' }); continue; }
    let spec;
    try{ spec = JSON.parse(fs.readFileSync(specFile, 'utf8')); }catch(e){ broken.push({ id, why: 'spec is not JSON (' + e.message + ')' }); continue; }
    if(spec.asset_id && spec.asset_id !== id){ broken.push({ id, why: `spec asset_id is ${spec.asset_id}` }); continue; }
    const w = spec.size_in ? spec.size_in.w : spec.width_in, h = spec.size_in ? spec.size_in.h : spec.height_in;
    const m = /military-badges\/([^/]+)\/([^/]+)__(.+)$/.exec(spec.reference || '');
    if(!(w > 0 && h > 0)){ broken.push({ id, why: 'spec has no size' }); continue; }
    if(!m){ broken.push({ id, why: `spec reference "${spec.reference || ''}" does not name a builder raster` }); continue; }
    const svg = fs.readFileSync(svgFile, 'utf8');
    const vb = /viewBox="([^"]+)"/.exec(svg);
    const box = vb ? vb[1].trim().split(/[\s,]+/).map(Number) : null;
    if(!box || box.length !== 4 || Math.abs(box[2] - w * 100) > 0.01 || Math.abs(box[3] - h * 100) > 0.01){ broken.push({ id, why: `viewBox ${vb ? vb[1] : 'missing'} is not ${w} x ${h} in at 0.01 in per unit` }); continue; }
    if(FORBIDDEN.test(svg)){ broken.push({ id, why: 'the SVG holds text, a raster, a filter, opacity or a gradient' }); continue; }
    const fid = spec.fidelity || null;
    out.push({
      id, dir, svgFile, spec, svg, w, h, service: m[1], design: m[2], variant: m[3],
      pass: !!(fid && fid.pass === true), note: fid ? (fid.pass ? '' : (fid.note || failedGates(fid))) : 'no fidelity block (not gated)',
      bbox: spec.source_bbox_user_units
    });
  }
  return { assets: out, broken };
}

// Which of the spec's own gates its scores miss, for a failed asset whose spec carries no note.
function failedGates(fid){
  const g = fid.gates || {};
  const miss = [];
  if(g.iou != null && fid.silhouette_iou < g.iou) miss.push(`silhouette IoU ${fid.silhouette_iou} < ${g.iou}`);
  if(g.aspect_pct != null && fid.bbox_aspect_diff_pct > g.aspect_pct) miss.push(`aspect off ${fid.bbox_aspect_diff_pct}% > ${g.aspect_pct}%`);
  if(g.edge_recall != null && fid.edge_recall_1p5px < g.edge_recall) miss.push(`edge recall ${fid.edge_recall_1p5px} < ${g.edge_recall}`);
  if(Array.isArray(g.face_ratio) && (fid.face_ratio_light_tones < g.face_ratio[0] || fid.face_ratio_light_tones > g.face_ratio[1])) miss.push(`light-tone face ratio ${fid.face_ratio_light_tones} outside ${g.face_ratio.join('..')}`);
  if(g.tone_rms != null && fid.tone_rms_after_linear_fit > g.tone_rms) miss.push(`tone RMS ${fid.tone_rms_after_linear_fit} > ${g.tone_rms}`);
  return miss.length ? 'gate failed: ' + miss.join('; ') : 'a fidelity gate failed (no note, scores within the gates: the art tree marked it failed)';
}

// ---- the manifest row ----------------------------------------------------------------------------

function manifestRow(a, rel){
  const s = a.spec;
  const fid = s.fidelity || {};
  return {
    id: a.id,
    path: rel,
    category: CATEGORY,
    w_in: a.w,
    h_in: a.h,
    size_source: s.size_source || 'estimated',
    basis: s.size_basis || '',
    anchors: s.anchors || {},
    landmarks: Object.keys(s.landmarks || {}),
    has_spec: false,
    issues: [],
    provenance: {
      data_source: s.data_source || null,
      generator: s.generator || null,
      reference: s.reference,
      source_raster: s.source_raster || null,
      source_px: s.source_px || null,
      source_bbox_user_units: s.source_bbox_user_units || null,
      fidelity: { pass: fid.pass === true, silhouette_iou: fid.silhouette_iou, edge_recall: fid.edge_recall_1p5px, tone_rms: fid.tone_rms_after_linear_fit, face_ratio: fid.face_ratio_light_tones, note: fid.note || '' },
      art_tree: path.relative(ART, a.dir).split(path.sep).join('/')
    }
  };
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ---- the plan ------------------------------------------------------------------------------------

// What a sync would do, without doing it. `all` takes gate-failed assets too.
function plan({ all = false } = {}){
  const badges = sizes.metalAssets(sizes.pageBadges());
  const { assets, broken } = v3Assets();
  const find = sizes.match(assets.map(a => ({ id: a.id, service: a.service, design: a.design, variant: a.variant, w: a.w, h: a.h, bbox: a.bbox, final: false })));
  const byId = new Map(assets.map(a => [a.id, a]));
  const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : { assets: [] };
  const rows = new Map((manifest.assets || []).map(r => [r.id, r]));
  const used = new Set();
  const sync = [], excluded = [], onPng = [];
  for(const b of badges){
    const key = `${b.badge}/${b.variant}`;
    const hit = find(b.asset, b.variant);
    if(!hit){ onPng.push({ key, why: 'no v3 asset' }); continue; }
    const a = byId.get(hit.id);
    used.add(a.id);
    const rel = b.asset.replace(/^images\//, '').replace(/\.png$/, '.svg');
    const dest = path.join(images, rel);
    const haveSvg = fs.existsSync(dest) ? fs.readFileSync(dest, 'utf8') : null;
    const row = manifestRow(a, rel);
    const have = rows.get(a.id);
    if(!a.pass && !all){
      excluded.push({ key, id: a.id, why: a.note, synced: haveSvg !== null });
      onPng.push({ key, why: `v3 asset ${a.id} failed its gate: ${a.note}` });
      continue;
    }
    sync.push({
      key, id: a.id, asset: b.asset, rel, dest, src: a.svgFile, svg: a.svg, row, w: a.w, h: a.h, pass: a.pass, note: a.note,
      svgChange: haveSvg === null ? 'new' : haveSvg === a.svg ? 'same' : 'updated',
      rowChange: !have ? 'new' : same(have, row) ? 'same' : 'updated',
      rowConflict: have && have.category !== CATEGORY ? `manifest id ${a.id} already belongs to ${have.category}` : null
    });
  }
  const unmatched = assets.filter(a => !used.has(a.id)).map(a => ({ id: a.id, reference: a.spec.reference, why: 'no page badge/variant has this reference' }));
  return { sync, excluded, onPng, unmatched, broken, badges: badges.length, v3: assets.length, manifest };
}

// ---- apply ---------------------------------------------------------------------------------------

function apply(p){
  const manifest = p.manifest;
  let changed = 0;
  for(const s of p.sync){
    if(s.rowConflict) throw new Error(s.rowConflict);
    if(s.svgChange !== 'same'){ fs.mkdirSync(path.dirname(s.dest), { recursive: true }); fs.writeFileSync(s.dest, s.svg); changed++; }
    if(s.rowChange !== 'same'){
      const i = manifest.assets.findIndex(r => r.id === s.id);
      if(i < 0) manifest.assets.push(s.row); else manifest.assets[i] = s.row;
      changed++;
    }
  }
  if(changed){
    manifest.count = manifest.assets.length;
    if(manifest.by_category) manifest.by_category[CATEGORY] = manifest.assets.filter(r => r.category === CATEGORY).length;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1) + '\n');
  }
  // The size table reads the synced SVGs and the manifest; the asset index reads the manifest and every file under images/.
  const before = fs.existsSync(sizes.OUT) ? fs.readFileSync(sizes.OUT, 'utf8') : '';
  const table = sizes.build();
  if(table.text !== before){ fs.writeFileSync(sizes.OUT, table.text); changed++; }
  const idx = require('./build-asset-index.cjs');
  const idxBefore = fs.existsSync(idx.OUT) ? fs.readFileSync(idx.OUT, 'utf8') : '';
  const idxText = idx.build();
  if(idxText !== idxBefore){ fs.writeFileSync(idx.OUT, idxText); changed++; }
  return { changed, table };
}

// True when a sync would write something (the files, the manifest, the size table or the asset index).
function pending(p){
  if(p.sync.some(s => s.svgChange !== 'same' || s.rowChange !== 'same')) return true;
  const before = fs.existsSync(sizes.OUT) ? fs.readFileSync(sizes.OUT, 'utf8') : '';
  if(sizes.build().text !== before) return true;
  const idx = require('./build-asset-index.cjs');
  return (fs.existsSync(idx.OUT) ? fs.readFileSync(idx.OUT, 'utf8') : '') !== idx.build();
}

function report(p, out){
  const n = k => p.sync.filter(s => s.svgChange === k).length;
  out(`v3 assets: ${p.v3} readable (${p.broken.length} unreadable or malformed); page badge/variants: ${p.badges}`);
  out(`synced: ${p.sync.length} (${n('new')} new, ${n('updated')} updated, ${n('same')} unchanged); ${p.onPng.length} badge/variants stay on their PNG; ${p.excluded.length} v3 assets left out by the gate; ${p.unmatched.length} v3 assets match no page badge`);
  if(p.sync.length) out('synced:\n  ' + p.sync.map(s => `${s.key} <- ${s.id} (${s.w} x ${s.h} in${s.pass ? '' : ', GATE FAILED, taken with --all'}) [svg ${s.svgChange}, row ${s.rowChange}]`).join('\n  '));
  if(p.excluded.length) out('left out (fidelity gate; the PNG stays):\n  ' + p.excluded.map(e => `${e.key} <- ${e.id}: ${e.why}${e.synced ? ' (an earlier sync left its SVG in place)' : ''}`).join('\n  '));
  const noArt = p.onPng.filter(x => x.why === 'no v3 asset');
  if(noArt.length) out(`on the PNG, no v3 asset yet (${noArt.length}):\n  ` + noArt.map(x => x.key).join('\n  '));
  if(p.unmatched.length) out('v3 assets no page badge names:\n  ' + p.unmatched.map(u => `${u.id} (${u.reference})`).join('\n  '));
  if(p.broken.length) out('unreadable or malformed v3 assets:\n  ' + p.broken.map(b => `${b.id}: ${b.why}`).join('\n  '));
}

if(require.main === module){
  const args = process.argv.slice(2);
  const all = args.includes('--all');
  const p = plan({ all });
  if(args.includes('--check')){
    if(pending(p)){ report(p, console.error); console.error('the tree is behind the art tree: run node scripts/sync-military-badges.cjs'); process.exit(1); }
    console.log(`military badge SVGs are current (${p.sync.length} synced, ${p.onPng.length} on the PNG).`);
  }else if(args.includes('--dry-run')){
    report(p, console.log);
  }else{
    const r = apply(p);
    report(p, console.log);
    console.log(`${r.changed ? r.changed + ' file(s) or row(s) written' : 'nothing to write'}; data/military-badge-sizes.js: ${r.table.withSvg} of ${r.table.total} badge/variants draw a traced SVG.`);
    if(r.table.svgOff.length) console.log('size table: synced SVGs that are not the size spec\'s asset:\n  ' + r.table.svgOff.map(a => `${a.key}: ${a.why}`).join('\n  '));
  }
}
module.exports = { plan, apply, pending, v3Assets, manifestRow, V3, ART, CATEGORY };
