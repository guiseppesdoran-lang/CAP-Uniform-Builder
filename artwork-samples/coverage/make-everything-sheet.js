#!/usr/bin/env node
// One image with every asset in MANIFEST.json, to scale within each section (ppi per section is printed on its header).
// Run: node artwork-samples/coverage/build-manifest.js && node artwork-samples/coverage/make-everything-sheet.js [out.png]
// Needs Google Chrome (headless) to rasterize; output default: artwork-samples/assets/ALL_ASSETS_EVERYTHING.png
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const ASSETS = path.join(__dirname, '..', 'assets');
const OUT = path.resolve(process.argv[2] || path.join(ASSETS, 'ALL_ASSETS_EVERYTHING.png'));
const man = JSON.parse(fs.readFileSync(path.join(ASSETS, 'MANIFEST.json'), 'utf8'));
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const W = 5600, PAD = 24, GAP = 14, LBL = 12;

// [title, ppi, label?, predicate]
const SECTIONS = [
  ['Garments; layers (nametags, boards, braid, sleeves) are drawn over their base garment', 13, true, (a) => a.category === 'garments'],
  ['Headgear, ties, nameplates, cords', 38, true, (a) => ['accessories', 'nameplates', 'cords'].includes(a.category)],
  ['Rank insignia: cadet, senior, epaulet sleeves, chevrons', 42, false, (a) => a.category === 'insignia'],
  ['Ribbons (CAP and military) and devices', 90, false, (a) => ['ribbons', 'devices'].includes(a.category)],
  ['CAP badges: cloth, field, mini, enamel, silver, ground team', 58, false, (a) => ['cloth', 'field', 'mini', 'enamel', 'silver', 'badges'].includes(a.category)],
  ['Patches (command and ES patches only)', 46, false, (a) => a.category === 'patches'],
  ['CAP medals (full size and miniature)', 40, false, (a) => a.category === 'medals'],
  ['Military badges and medals (final sets)', 56, false, (a) => a.category === 'military'],
];

const byId = Object.fromEntries(man.assets.map((a) => [a.id, a]));
const garmentIds = man.assets.filter((a) => a.category === 'garments').map((a) => a.id);
const items = [];
let y = PAD;
const parts = [];
const used = new Set();
for (const [title, ppi, label, pred] of SECTIONS) {
  const list = man.assets.filter(pred).filter((a) => a.w_in && a.h_in);
  list.forEach((a) => used.add(a.id));
  parts.push(`<div style="position:absolute;left:${PAD}px;top:${y}px;font:600 22px -apple-system,Helvetica,sans-serif;color:#fff">${title} — ${list.length} assets, ${ppi} px per inch</div>`);
  y += 40;
  let x = PAD, rowH = 0;
  for (const a of list) {
    const w = Math.max(6, a.w_in * ppi), h = Math.max(6, a.h_in * ppi);
    if (x + w > W - PAD && x > PAD) { x = PAD; y += rowH + GAP; rowH = 0; }
    // layers registered to a base garment (same box, id extends the base id) are drawn over their base
    const base = a.category === 'garments' ? garmentIds.filter((b) => b !== a.id && a.id.startsWith(b + '-')).sort((p, q) => q.length - p.length)[0] : null;
    const baseImg = base ? `<img src="file://${path.join(ASSETS, byId[base].path)}" style="position:absolute;left:0;top:0;width:${w}px;height:${h}px">` : '';
    parts.push(`<div style="position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;background:#8a8f98">${baseImg}<img src="file://${path.join(ASSETS, a.path)}" style="position:absolute;left:0;top:0;width:${w}px;height:${h}px;display:block"></div>`);
    let lh = 0;
    if (label) { parts.push(`<div style="position:absolute;left:${x}px;top:${y + h + 1}px;width:${Math.max(w, 60)}px;font:9px Helvetica,sans-serif;color:#cfd3da;line-height:10px;overflow:hidden;height:20px">${a.id.replace(/^(garment|rank|hat|tie|cord|nameplate)-/, '')}</div>`); lh = 22; }
    x += Math.max(w, label ? 60 : 0) + GAP;
    rowH = Math.max(rowH, h + lh);
  }
  y += rowH + 44;
}
const H = Math.ceil(y + PAD);
const missed = man.assets.filter((a) => !used.has(a.id) && a.w_in);
const html = `<html><body style="margin:0;width:${W}px;height:${H}px;background:#2a2e36;position:relative">
<div style="position:absolute;left:${PAD}px;top:${H - 60}px;font:14px Helvetica,sans-serif;color:#9aa1ad">${man.count} assets from MANIFEST.json (${man.by_size_source.regulation || 0} regulation-sized, ${man.by_size_source.measured || 0} measured, ${man.by_size_source.estimated || 0} estimated). Each section is drawn to scale within itself.</div>
${parts.join('\n')}</body></html>`;
const tmp = path.join(require('os').tmpdir(), 'everything-sheet.html');
fs.writeFileSync(tmp, html);
execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--allow-file-access-from-files', '--hide-scrollbars', `--window-size=${W},${H}`, `--screenshot=${OUT}`, 'file://' + tmp], { stdio: 'ignore', timeout: 300000 });
console.log(`wrote ${OUT} (${W}x${H}); ${used.size} assets drawn; not placed: ${missed.length}`);
