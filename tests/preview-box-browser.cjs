#!/usr/bin/env node
'use strict';
// Browser check for the picker tiles' preview boxes (not part of `npm test`: needs Chrome, like tests/badge-chooser-browser.cjs).
//
//   node tests/preview-box-browser.cjs [--out DIR]
//
// LIVE10-8. Ethan, on the Christian Chaplain Badge tile: "why is this rounded?". The badge's art is a rectangle (the cross on its navy field) and the tile's image box
// had a border radius, which cuts the art's corners. Opens the Badges and the Ribbons windows on the real page and checks, for every tile's preview box, that
//   - the badge / patch image box has square corners (computed border-radius 0) and the art sits inside it with padding (the content box is smaller than the box),
//   - the ribbon preview slot (96 x 56) has square corners and does not clip what lies outside its viewBox (overflow visible),
// and shoots the chaplain tile and a ribbon tile with devices when --out is given.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const zlib = require('node:zlib');
const { spawn } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const args = process.argv.slice(2);
const OUT = args.indexOf('--out') >= 0 ? args[args.indexOf('--out') + 1] : null;
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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bullion-chrome-'));
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
    await S('Emulation.setDeviceMetricsOverride', { width: 1400, height: 1000, deviceScaleFactor: 2, mobile: false });
    await S('Page.enable');
    await S('Page.addScriptToEvaluateOnNewDocument', { source: "try{localStorage.setItem('cap_uniform_builder_access_v1','1')}catch(e){}" });
    await S('Page.navigate', { url: `http://127.0.0.1:${srv.address().port}/index.html` });
    for(let i = 0; i < 400; i++){ if(await ev('typeof CAPUBUniformView !== "undefined" && !!document.querySelector("#groupBadges")').catch(() => false)) break; await sleep(50); }
    await sleep(800);
    await ev(`(async () => { State.membership = 'senior'; State.gender = 'male'; State.rank = 'Capt'; State.uniform = 'blues_a'; await CAPUBUniformView.render(); })()`);
    const fails = [];
    const shot = async (sel, name) => {
      if(!OUT) return;
      const r = await ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if(!e) return null; e.scrollIntoView({ block: 'center' }); const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height }; })()`);
      if(!r) return;
      await sleep(200);
      fs.mkdirSync(OUT, { recursive: true });
      fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from((await S('Page.captureScreenshot', { format: 'png', clip: Object.assign({ scale: 2 }, r) })).data, 'base64'));
    };

    // The Badges window.
    await ev(`document.getElementById('expandBadges').click()`);
    await sleep(2500);
    const badges = await ev(`(() => [...document.querySelectorAll('#galleryModalHost .galleryTile > img')].map(i => { const c = getComputedStyle(i); const r = i.getBoundingClientRect(); return { alt: i.alt, radius: ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomRightRadius', 'borderBottomLeftRadius'].map(k => c[k]), pad: parseFloat(c.paddingLeft) + parseFloat(c.paddingRight), box: c.boxSizing, fit: c.objectFit, w: r.width }; }))()`);
    console.log('badge tiles:', badges.length);
    if(badges.length < 10) fails.push('the Badges window shows too few tiles to check (' + badges.length + ')');
    for(const b of badges){
      if(b.radius.some(v => parseFloat(v) !== 0)) fails.push(`badge tile "${b.alt}": preview box has rounded corners (${b.radius.join(' ')})`);
      if(!(b.pad > 0) || b.box !== 'border-box') fails.push(`badge tile "${b.alt}": the art is not inset in its box (padding ${b.pad}, ${b.box})`);
      if(b.fit !== 'contain') fails.push(`badge tile "${b.alt}": object-fit ${b.fit}, not contain`);
    }
    await ev(`(() => { const i = [...document.querySelectorAll('#galleryModalHost .galleryTile > img')].find(i => /chaplin|chaplain/i.test(i.alt) || /chaplin|chaplain/i.test(i.src)); if(i) i.closest('.galleryTile').setAttribute('data-shot', '1'); })()`);
    await shot('#galleryModalHost .galleryTile[data-shot="1"]', 'chaplain-tile');
    await ev(`(() => { const c = document.querySelector('#galleryModalHost [data-close], #galleryModalHost .closeBtn, #galleryModal button.closeBtn'); if(c) c.click(); })()`);
    await sleep(500);

    // The Ribbons window.
    await ev(`(() => { document.querySelectorAll('#galleryModalHost').forEach(h => { h.innerHTML = ''; }); document.getElementById('expandRibbons').click(); })()`);
    await sleep(3000);
    const ribbons = await ev(`(() => [...document.querySelectorAll('#galleryModalHost .ribbonSelectorTile:not(.militaryRibbonSelectorTile) > svg.ribbonPreviewSvg, #galleryModalHost .ribbonSelectorTile:not(.militaryRibbonSelectorTile) > img')].map(e => { const c = getComputedStyle(e); const r = e.getBoundingClientRect(); return { tag: e.tagName, id: e.closest('.ribbonSelectorTile').dataset.ribbonId, radius: parseFloat(c.borderTopLeftRadius) + parseFloat(c.borderBottomRightRadius), overflow: c.overflow, w: Math.round(r.width), h: Math.round(r.height) }; }))()`);
    console.log('ribbon preview slots:', ribbons.length);
    if(ribbons.length < 10) fails.push('the Ribbons window shows too few tiles to check (' + ribbons.length + ')');
    for(const r of ribbons){
      if(r.radius !== 0) fails.push(`ribbon tile ${r.id}: the 96 x 56 slot has rounded corners`);
      if(r.tag === 'svg' && r.overflow !== 'visible') fails.push(`ribbon tile ${r.id}: the preview svg clips what lies outside its viewBox (overflow ${r.overflow})`);
      if(r.w !== 96 || r.h !== 56) fails.push(`ribbon tile ${r.id}: the slot is ${r.w} x ${r.h}, not 96 x 56`);
    }
    await shot('#galleryModalHost .ribbonSelectorTile[data-ribbon-id="cap_senior_recruiter_ribbon"], #galleryModalHost .ribbonSelectorTile:not(.militaryRibbonSelectorTile)', 'ribbon-tile');
    console.log(fails.length ? `FAIL (${fails.length}):\n  ${fails.slice(0, 12).join('\n  ')}` : 'PASS');
    if(fails.length) code = 1;
  } catch (e) { console.error(e); code = 2; }
  finally { try { ws.close(); } catch {} proc.kill(); srv.close(); process.exit(code); }
})();
