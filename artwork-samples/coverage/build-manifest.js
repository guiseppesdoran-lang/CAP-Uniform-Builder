#!/usr/bin/env node
// Builds artwork-samples/assets/MANIFEST.json: one normalized record per asset, for the builder import.
// Read-only on assets. Run: node artwork-samples/coverage/build-manifest.js
// Fields: id, path (relative to assets/), category, w_in, h_in (from the SVG root, authoritative),
//         size_source, basis, anchors (name -> [x,y] in 0.01 in), landmarks (names), has_spec, issues[].

const fs = require('fs'), path = require('path');
const ASSETS = path.join(__dirname, '..', 'assets');
const SKIP_DIR = /^(v2|v2sbs|out|out-v\d|out-flat|out-flat-v1|g\d[a-z]?|ref|refs|tools|specs|node_modules|patches-traced)$/;
// military/** keeps only the promoted final/<id>/ sets and the field/<id>/ blue-backed ABU/OCP versions; patches-traced is the alternate (embroidery-look) set and is not imported.

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!SKIP_DIR.test(e.name)) walk(p, out); }
    else if (e.name.endsWith('.svg') && path.dirname(p) !== ASSETS) {
      const r = path.relative(ASSETS, p);
      if (r.startsWith('military' + path.sep) && !/[\\/](final|field)[\\/]/.test(r)) continue;
      // Ethan: optional unit/school/event patches (e.g. the Hawk Mountain patches) are out of scope. Uniform-defined patches stay.
      if (r.startsWith('patches' + path.sep) && !/patch-(cap-command-patch|es-style-\d)/.test(r)) continue;
      out.push(p);
    }
  }
  return out;
}
const num = (s) => { const m = /^([\d.]+)\s*(in)?$/.exec(String(s || '').trim()); return m ? +m[1] : null; };

const rows = [];
for (const f of walk(ASSETS).sort()) {
  const rel = path.relative(ASSETS, f);
  const id = path.basename(f, '.svg');
  const svg = fs.readFileSync(f, 'utf8');
  const root = /<svg\b[^>]*>/.exec(svg);
  const attr = (n) => { const m = new RegExp('\\b' + n + '="([^"]*)"').exec(root ? root[0] : ''); return m ? m[1] : null; };
  const issues = [];
  let w = num(attr('width')), h = num(attr('height'));
  if (w == null || h == null || !/in\s*$/.test(attr('width') || '')) issues.push('root width/height not in inches');
  const specPath = f.replace(/\.svg$/, '.spec.json');
  let spec = null;
  if (fs.existsSync(specPath)) { try { spec = JSON.parse(fs.readFileSync(specPath, 'utf8')); } catch { issues.push('spec.json unreadable'); } }
  else issues.push('no spec.json');
  const meta = (() => { const m = /<metadata>([\s\S]*?)<\/metadata>/.exec(svg); try { return m ? JSON.parse(m[1]) : null; } catch { return null; } })();
  const src = spec || meta || {};
  const anchors = src.anchors || (meta && meta.anchors) || {};
  const lm = src.landmarks || (meta && meta.landmarks) || {};
  const size_source = src.size_source || (meta && meta.size_source) || null;
  if (!size_source) issues.push('no size_source');
  if (!Object.keys(anchors).length) issues.push('no anchors');
  rows.push({
    id, path: rel, category: rel.split(path.sep)[0],
    w_in: w, h_in: h, size_source,
    basis: src.size_basis || src.citation || src.regulation || null,
    anchors, landmarks: Object.keys(lm),
    has_spec: !!spec, issues,
  });
}

const byCat = {}, bySrc = {};
for (const r of rows) { byCat[r.category] = (byCat[r.category] || 0) + 1; bySrc[r.size_source || 'none'] = (bySrc[r.size_source || 'none'] || 0) + 1; }
const dup = rows.map((r) => r.id).filter((x, i, a) => a.indexOf(x) !== i);
const conventions = {
  units: 'SVG root width/height are inches; viewBox is 0.01 in per user unit; anchors/landmarks are in user units, origin top-left of the artwork box.',
  layers: 'A layer (nametag, board, braid, epaulet sleeve) shares its base garment box and registers at 0,0; draw order is base garment, then layers, then insignia at the layer slots.',
  hats: 'A hat or cap asset is placed by aligning its garment_attach_center with the garment top_center (cap sits on the top edge of the artwork box).',
  cords: 'A shoulder cord is placed by its shoulder_seam_attach on the garment epaulet strap axis (centred, 0.125 in toward the neck), under the epaulet sleeve.',
  epaulet_sleeves: 'Use the garment-*-epaulet-sleeve-* layers for sleeve shape on the shirts and put grade insignia at rank_slot; rank-epaulet-sleeve-* are standalone graded sleeves (1.97 x 3.84 in) and are wider than the drawn strap.',
  size_source: 'regulation = dimension from a regulation or purchase description; measured = measured from a reference at a stated scale; estimated = assumed (see basis).',
};
const out = { generated: new Date().toISOString(), conventions, count: rows.length, by_category: byCat, by_size_source: bySrc, duplicate_ids: [...new Set(dup)], assets: rows };
fs.writeFileSync(path.join(ASSETS, 'MANIFEST.json'), JSON.stringify(out, null, 1));
console.log('MANIFEST.json:', rows.length, 'assets');
console.log('by category:', JSON.stringify(byCat));
console.log('by size_source:', JSON.stringify(bySrc));
console.log('duplicate ids:', out.duplicate_ids.length ? out.duplicate_ids.join(', ') : 'none');
const bad = rows.filter((r) => r.issues.length);
console.log('assets with issues:', bad.length);
const byIssue = {}; for (const r of bad) for (const i of r.issues) byIssue[i] = (byIssue[i] || 0) + 1;
console.log(JSON.stringify(byIssue));
