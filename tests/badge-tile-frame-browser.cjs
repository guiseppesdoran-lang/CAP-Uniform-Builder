#!/usr/bin/env node
'use strict';
// Browser check that every badge tile of the chooser window holds its picture whole with a margin (run by tests/badge-tile-frame.test.cjs; needs Chrome). The owner (2026-11-12), on the
// Historian Technician Badge tile: "this is not the right shape".
//
//   node tests/badge-tile-frame-browser.cjs [--out DIR]
//
// Serves the repo, opens the page in headless Chrome and, for each kind of uniform, opens the badge chooser and measures every tile: the badge's picture as it is fitted whole into its
// frame (the frame's width and height against the sheet's own shape) must lie inside the frame with at least 4 px between it and the frame's edge on every side, so no outline meets the
// edge and reads as cut. A tile with no picture, or one that has not loaded, fails.
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



const UNIFORMS = ['blues_a', 'blues_b', 'mess_dress', 'semi_formal', 'aviator', 'aviator_blazer', 'abu', 'ocp', 'flight_suit', 'corporate_field', 'polo'];

(async () => {
  const srv = await serve();
  const { proc, cdp, ws } = await launch();
  let code = 0;
  const fails = [];
  try {
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    const S = (m, p) => cdp.send(m, p, sessionId);
    const ev = async expr => { const r = await S('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if(r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    await S('Emulation.setDeviceMetricsOverride', { width: Number(opt('--width')) || 1280, height: 1200, deviceScaleFactor: 1, mobile: false });
    await S('Page.enable');
    await S('Page.addScriptToEvaluateOnNewDocument', { source: "try{localStorage.setItem('cap_uniform_builder_access_v1','1')}catch(e){}" });
    await S('Page.navigate', { url: `http://127.0.0.1:${srv.address().port}/index.html` });
    for(let i = 0; i < 400; i++){ if(await ev('typeof CAPUBUniformView !== "undefined" && typeof CAPUBPickLists === "object"').catch(() => false)) break; await sleep(50); }
    await sleep(800);
    let tiles = 0;
    const seen = {};
    for(const uniform of UNIFORMS){
      await ev(`(async () => { State.membership = 'senior'; State.gender = 'male'; State.rank = 'Capt'; State.uniform = ${JSON.stringify(uniform)}; State.badges = []; State.badgeSelections = {}; await CAPUBUniformView.render(); document.getElementById('expandBadges').click(); await new Promise(r => setTimeout(r, 1500)); })()`);
      // The pictures load as they come into view: load them all, then measure.
      await ev(`(async () => { for(const i of document.querySelectorAll('#galleryModalHost .vp[data-name="badges"] img')){ i.loading = 'eager'; } await Promise.all([...document.querySelectorAll('#galleryModalHost .vp[data-name="badges"] img')].map(i => i.decode().catch(() => 0))); })()`);
      const m = await ev(`(() => [...document.querySelectorAll('#galleryModalHost .vp[data-name="badges"] .vpCell')].map(c => {
        const frame = c.querySelector('.vpPicture'), img = frame && frame.querySelector('img');
        if(!img || !img.naturalWidth) return { name: c.querySelector('.vpLabel').textContent, none: true };
        const f = frame.getBoundingClientRect(), i = img.getBoundingClientRect();
        const k = Math.min(i.width / img.naturalWidth, i.height / img.naturalHeight), w = img.naturalWidth * k, h = img.naturalHeight * k;
        const x = i.x + (i.width - w) / 2, y = i.y + (i.height - h) / 2;
        return { name: c.querySelector('.vpLabel').textContent, frame: [Math.round(f.width * 10) / 10, Math.round(f.height * 10) / 10], gap: Math.round(Math.min(x - f.left, f.right - (x + w), y - f.top, f.bottom - (y + h)) * 10) / 10, nat: [img.naturalWidth, img.naturalHeight] };
      }))()`);
      await ev(`document.getElementById('galleryModalCloseBtn').click()`);
      await sleep(300);
      seen[uniform] = m.length;
      tiles += m.length;
      for(const t of m){
        if(t.none) fails.push(`${uniform}: ${t.name} has no picture`);
        else if(t.gap < 4) fails.push(`${uniform}: ${t.name} meets the frame's edge (gap ${t.gap} px, frame ${t.frame}, picture ${t.nat})`);
      }
    }
    console.log('tiles measured:', tiles, JSON.stringify(seen));
    if(tiles < 300) fails.push(`the chooser should offer badges on each uniform: ${tiles} tiles in all`);
    console.log(fails.length ? `FAIL (${fails.length}):\n  ${fails.slice(0, 15).join('\n  ')}` : 'PASS');
    if(fails.length) code = 1;
  } catch (e) { console.error(e); code = 2; }
  finally { try { ws.close(); } catch {} proc.kill(); srv.close(); process.exit(code); }
})();
