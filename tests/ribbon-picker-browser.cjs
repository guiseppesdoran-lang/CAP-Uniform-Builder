#!/usr/bin/env node
'use strict';
// Browser check for the ribbons picker (not part of `npm test`: needs Chrome).
//
//   node tests/ribbon-picker-browser.cjs [--out DIR] [--tag before|after]
//
// Serves the repo, opens the page in headless Chrome, opens the ribbon picker, then selects three ribbons that
// carry devices one after another. After each pick it measures every tile's height and the top of a later tile
// in the same list. Exits 1 if any tile changed height or any later tile moved (Ethan: "the ui keeps shifting
// down because tiles increase size"). Writes screenshots when --out is given.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ribbon-picker-chrome-'));
  const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--mute-audio', '--remote-debugging-port=0', `--user-data-dir=${dir}`, 'about:blank'], { stdio: 'ignore' });
  const portFile = path.join(dir, 'DevToolsActivePort');
  for(let i = 0; !fs.existsSync(portFile); i++){ if(i > 800) throw new Error('Chrome did not start'); await new Promise(r => setTimeout(r, 25)); }
  await new Promise(r => setTimeout(r, 50));
  const [port, wsPath] = fs.readFileSync(portFile, 'utf8').trim().split('\n');
  const ws = new WebSocket(`ws://127.0.0.1:${port}${wsPath}`);
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
  return { proc, cdp: new Cdp(ws), ws };
}

(async () => {
  const srv = await serve();
  const { proc, cdp, ws } = await launch();
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
    const where = await ev(`(() => { const g = document.querySelector('#galleryModalHost .galleryGrid') ; return g ? 'modal:' + g.querySelectorAll('.ribbonSelectorTile').length : 'nomodal:' + document.querySelectorAll('#ribbonGallery .ribbonSelectorTile').length; })()`);
    console.log('picker', opened, where);
    console.log('rule buttons:', await ev(`[...document.querySelectorAll('#galleryModalHost .ribbonRuleBtn')].map(b => b.closest('.ribbonSelectorTile').dataset.ribbonId).join(', ')`));

    // Ribbons that carry devices.
    // Three ribbons in a row that carry devices and a counting rule (cadet recruiter bronze/silver clasps, search finds, air search and rescue).
    const picks = await ev(`(() => { const want = ['cadet_recruiter_ribbon', 'search_find_ribbon', 'air_search_and_rescue_ribbon', 'cap_senior_recruiter_ribbon']; const root = document.querySelector('#galleryModalHost .galleryGrid'); return want.filter(id => root.querySelector('.ribbonSelectorTile[data-ribbon-id="' + id + '"]')).slice(0, 3); })()`);
    console.log('ribbons with devices:', picks.join(', '));
    const measure = `(() => { const root = document.querySelector('#galleryModalHost .galleryGrid') || document.querySelector('#ribbonGallery'); const tiles = [...root.querySelectorAll('.ribbonSelectorTile:not(.militaryRibbonSelectorTile)')]; const scroller = root.closest('.modalBody,.modalContent,#galleryModalHost') || root; const last = tiles[tiles.length - 1]; return { heights: tiles.map(t => Math.round(t.getBoundingClientRect().height * 100) / 100), tops: tiles.map(t => Math.round((t.getBoundingClientRect().top - root.getBoundingClientRect().top) * 100) / 100), n: tiles.length }; })()`;
    const base = await ev(measure);
    await shot('0-start');
    const log = [];
    for(let k = 0; k < picks.length; k++){
      // Choose the highest award level on that ribbon (the one with the most devices).
      await ev(`(() => { const root = document.querySelector('#galleryModalHost .galleryGrid') || document.querySelector('#ribbonGallery'); const t = root.querySelector('.ribbonSelectorTile[data-ribbon-id="${picks[k]}"]'); const s = t.querySelector('select.rbAwardSelect'); const vals = [...s.options].map(o => o.value).filter(Boolean); s.value = vals[Math.min(vals.length - 1, 6)]; s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
      await sleep(1200);
      const m = await ev(measure);
      log.push(m);
      await shot(`${k + 1}-picked`);
    }
    await ev(`document.querySelector('#galleryModalHost .ribbonSelectorTile[data-ribbon-id="cadet_recruiter_ribbon"]').scrollIntoView({ block: 'center' })`);
    await sleep(300);
    await shot('3b-recruiter-tile');
    // Opening a counting rule must not move anything either, and the popover has to be visible.
    const popen = await ev(`(() => { const root = document.querySelector('#galleryModalHost .galleryGrid'); const b = root.querySelector('.ribbonSelectorTile[data-ribbon-id="cadet_recruiter_ribbon"] .ribbonRuleBtn'); if(!b) return null; b.click(); const pop = b.nextElementSibling; return { open: b.getAttribute('aria-expanded'), visible: getComputedStyle(pop).visibility, text: pop.textContent }; })()`);
    await sleep(300);
    if(popen === null){ console.log('no rule button (old layout)'); } else if(popen.visible !== 'visible') throw new Error('the rule popover did not open');
    console.log('rule popover:', JSON.stringify(popen));
    await shot('4-rule-open');
    log.push(await ev(measure));
    // Compare by tile index (same tiles, same order).
    let bad = [];
    log.forEach((m, k) => {
      if(m.n !== base.n) bad.push(`pick ${k + 1}: tile count ${base.n} -> ${m.n}`);
      for(let i = 0; i < base.n && i < m.n; i++){
        if(Math.abs(m.heights[i] - base.heights[i]) > 0.5) bad.push(`pick ${k + 1}: tile ${i} height ${base.heights[i]} -> ${m.heights[i]}`);
        if(Math.abs(m.tops[i] - base.tops[i]) > 0.5) bad.push(`pick ${k + 1}: tile ${i} top ${base.tops[i]} -> ${m.tops[i]}`);
      }
    });
    console.log(bad.length ? `FAIL (${bad.length}):\n  ${bad.slice(0, 12).join('\n  ')}` : `PASS: ${base.n} tiles kept their height and position through ${picks.length} picks`);
    if(bad.length) code = 1;
  } catch (e) { console.error(e); code = 2; }
  finally { try { ws.close(); } catch {} proc.kill(); srv.close(); process.exit(code); }
})();
