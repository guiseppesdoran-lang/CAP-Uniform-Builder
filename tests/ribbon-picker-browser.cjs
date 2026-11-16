#!/usr/bin/env node
'use strict';
// Browser check for the ribbons picker (not part of `npm test`: needs Chrome).
//
//   node tests/ribbon-picker-browser.cjs [--out DIR] [--tag before|after]
//
// Serves the repo, opens the page in headless Chrome and opens the ribbon picker: the ribbons are picture tiles in rows (two at a phone's width, more on a desktop), with
// no checkbox or radio button; a tap turns one on with its count under the tile, the counting rule kept in the picked line's title and the row of counts', a ribbon with devices is
// drawn with them in its tile, and the tiles of the other ribbons keep their size. Writes screenshots when --out is given.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { launchChrome } = require('../scripts/lib-chrome.cjs');

const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const opt = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const OUT = opt('--out');
const TAG = opt('--tag') || 'run';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };

function serve(){
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
      if(!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()){ rsp.writeHead(404); return rsp.end(); }
      rsp.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
      fs.createReadStream(p).pipe(rsp);
    }).listen(0, '127.0.0.1', () => res(srv));
  });
}

class Cdp {
  constructor(ws){ this.ws = ws; this.id = 0; this.pending = new Map(); ws.addEventListener('message', m => { const d = JSON.parse(m.data); const p = this.pending.get(d.id); if(p){ this.pending.delete(d.id); d.error ? p.rej(new Error(d.error.message)) : p.res(d.result); } }); }
  send(method, params, sessionId){ const id = ++this.id; return new Promise((res, rej) => { this.pending.set(id, { res, rej }); this.ws.send(JSON.stringify({ id, method, params: params || {}, ...(sessionId ? { sessionId } : {}) })); }); }
}

async function launch(){
  const chrome = await launchChrome({ prefix: 'ribbon-picker' });
  return { cdp: new Cdp(chrome.ws), ws: chrome.ws, chrome };
}

(async () => {
  const srv = await serve();
  const { chrome, cdp, ws } = await launch();
  let code = 0;
  try {
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    const S = (m, p) => cdp.send(m, p, sessionId);
    const ev = async expr => { const r = await S('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if(r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    await S('Emulation.setDeviceMetricsOverride', { width: Number(opt('--width')) || 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    // The access gate remembers a member in localStorage; do the same for this local test page.
    await S('Page.enable');
    await S('Page.addScriptToEvaluateOnNewDocument', { source: "try{localStorage.setItem('cap_uniform_builder_access_v1','1')}catch(e){}" });
    await S('Page.navigate', { url: `http://127.0.0.1:${srv.address().port}/index.html` });
    for(let i = 0; i < 400; i++){ if(await ev('!!document.querySelector("#ribbonGallery") && typeof buildRibbonGallery==="function"').catch(() => false)) break; await sleep(50); }
    await sleep(800);
    const shot = async name => { if(!OUT) return; fs.mkdirSync(OUT, { recursive: true }); const r = await S('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUT, `${TAG}-${name}.png`), Buffer.from(r.data, 'base64')); };

    // Open the picker window the way the page does (the sidebar grid is hidden by CSS).
    const opened = await ev(`(() => { const b = document.getElementById('expandRibbons'); if(!b) return 'no-button'; b.click(); return 'expandRibbons'; })()`);
    await sleep(2500);
    const root = `#galleryModalHost`;
    const bad = [];
    const tiles = await ev(`(() => { const h = document.querySelector('${root}'); return { cells: h.querySelectorAll('.vpCell').length, pressed: h.querySelectorAll('.vpCell > .vpOption[aria-pressed]').length, boxes: h.querySelectorAll('input[type=checkbox],input[type=radio]').length, controls: h.querySelectorAll('.vpControls').length, ruleButtons: h.querySelectorAll('.ribbonRuleBtn, .ribbonRulePop').length }; })()`);
    console.log('picker', opened, JSON.stringify(tiles));
    if(tiles.cells < 40 || tiles.pressed !== tiles.cells) bad.push(`the ribbons should be picture tiles with aria-pressed: ${JSON.stringify(tiles)}`);
    if(tiles.boxes) bad.push(`${tiles.boxes} checkboxes or radio buttons in the picker`);
    if(tiles.controls) bad.push(`${tiles.controls} controls under tiles before a pick: they show only while a ribbon is on`);
    if(tiles.ruleButtons) bad.push(`${tiles.ruleButtons} rule buttons or popovers in the picker`);
    // The rows: two to a row at a phone's width, more on a desktop.
    const width = Number(opt('--width')) || 1280;
    const columns = await ev(`(() => { const rows = {}; for(const c of document.querySelectorAll('${root} .vpCell')){ const r = c.getBoundingClientRect(); if(r.height > 0){ const k = Math.round(r.top); rows[k] = (rows[k] || 0) + 1; } } return Math.max(...Object.values(rows)); })()`);
    console.log('tiles in the fullest row at', width, 'px:', columns);
    if(width <= 420 && columns < 2) bad.push(`two tiles to a row at ${width} px, found ${columns}`);
    if(width >= 1200 && columns < 4) bad.push(`more tiles to a row on a desktop, found ${columns}`);
    const sizeBefore = await ev(`(() => { const c = [...document.querySelectorAll('${root} .vpCell')].find(c => c.dataset.value === 'cap_leadership_ribbon'); const r = c.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; })()`);
    await shot('0-start');

    // A ribbon with a counting rule: nothing under the tile before the tap; after it the row of counts, the picked line, the rule in both titles.
    const id = 'cadet_recruiter_ribbon';
    await ev(`(() => { const c = [...document.querySelectorAll('${root} .vpCell')].find(c => c.dataset.value === '${id}'); c.scrollIntoView({ block: 'center' }); c.querySelector('.vpOption').click(); })()`);
    await sleep(1200);
    const picked = await ev(`(() => { const c = [...document.querySelectorAll('${root} .vpCell')].find(c => c.dataset.value === '${id}'); const line = c.querySelector('.ribbonDeviceSummary'); const row = c.querySelector('.vpRow'); const tiles = row ? [...row.querySelectorAll('.vpOption')] : []; return { on: c.querySelector('.vpOption').getAttribute('aria-pressed'), state: State.ribbonSelections['${id}'].checked, text: line && line.textContent, title: line && line.getAttribute('title'), select: row && row.getAttribute('title'), options: tiles.map(o => o.dataset.value), emptyOption: tiles.some(o => !o.dataset.value), drawn: !!c.querySelector('.vpPicture > svg'), drop: c.querySelectorAll('select').length, pictures: tiles.filter(o => o.querySelector('.vpPicture img, .vpPicture svg')).length }; })()`);
    console.log('recruiter after the tap:', JSON.stringify({ ...picked, options: picked.options.length }));
    if(picked.on !== 'true' || !picked.state) bad.push('the tap should turn the ribbon on');
    if(!/^Selected: /.test(picked.text || '')) bad.push(`the picked line: "${picked.text}"`);
    if(!/Two recruits earn the ribbon/.test(picked.title || '') || !/Two recruits earn the ribbon/.test(picked.select || '')) bad.push('the rule is not in the picked line\'s title or the row\'s');
    if(picked.emptyOption !== false || picked.options.length < 3) bad.push('the row lists the counts as tiles and no "- Select -": ' + JSON.stringify(picked.options));
    if(picked.drop) bad.push('a drop-down is left under the ribbon: ' + picked.drop);
    if(picked.pictures !== picked.options.length) bad.push(`every count is a picture: ${picked.pictures} of ${picked.options.length}`);
    await shot('1-recruiter-on');

    // The highest count: the award changes and the ribbon is drawn with its devices in its tile.
    await ev(`(() => { const c = [...document.querySelectorAll('${root} .vpCell')].find(c => c.dataset.value === '${id}'); const t = [...c.querySelectorAll('.vpRow .vpOption')]; t[t.length - 1].click(); })()`);
    await sleep(1500);
    const high = await ev(`(() => { const c = [...document.querySelectorAll('${root} .vpCell')].find(c => c.dataset.value === '${id}'); const s = State.ribbonSelections['${id}']; return { value: s.awardValue, devices: Object.keys(s.devices || {}).length, drawn: !!c.querySelector('.vpPicture > svg'), line: c.querySelector('.ribbonDeviceSummary').textContent, inRack: State.ribbons.some(r => (r.id || r) === '${id}') }; })()`);
    console.log('the highest count:', JSON.stringify(high));
    if(!high.drawn) bad.push('the ribbon that is on should be drawn with its devices in its tile');
    if(!high.inRack) bad.push('the ribbon should be in the rack');
    if(!/^Selected: /.test(high.line)) bad.push('the picked line after the count: ' + high.line);
    // The tiles of the other ribbons keep their size.
    const sizeAfter = await ev(`(() => { const c = [...document.querySelectorAll('${root} .vpCell')].find(c => c.dataset.value === 'cap_leadership_ribbon'); const r = c.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; })()`);
    if(sizeBefore[0] !== sizeAfter[0] || Math.abs(sizeBefore[1] - sizeAfter[1]) > 1) bad.push(`another ribbon's tile changed size: ${sizeBefore} -> ${sizeAfter}`);
    await shot('2-highest');
    // And off again: the controls are gone.
    await ev(`(() => { const c = [...document.querySelectorAll('${root} .vpCell')].find(c => c.dataset.value === '${id}'); c.querySelector('.vpOption').click(); })()`);
    await sleep(800);
    const off = await ev(`(() => { const c = [...document.querySelectorAll('${root} .vpCell')].find(c => c.dataset.value === '${id}'); return { on: c.querySelector('.vpOption').getAttribute('aria-pressed'), controls: !!c.querySelector('.vpControls'), state: State.ribbonSelections['${id}'].checked }; })()`);
    if(off.on !== 'false' || off.controls || off.state) bad.push('a second tap should turn the ribbon off and take its controls away: ' + JSON.stringify(off));
    console.log(bad.length ? `FAIL (${bad.length}):\n  ${bad.slice(0, 12).join('\n  ')}` : 'PASS');
    if(bad.length) code = 1;
  } catch (e) { console.error(e); code = 2; }
  finally { try { ws.close(); } catch {} await chrome.close(); srv.close(); process.exit(code); }
})();
