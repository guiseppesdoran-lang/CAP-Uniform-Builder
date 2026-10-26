#!/usr/bin/env node
'use strict';
// Browser check for the grade insignia's paint (not part of `npm test`: needs Chrome, like tests/badge-chooser-browser.cjs).
//
//   node tests/bullion-browser.cjs [--out DIR]
//
// LIVE10-5 / 5b. Ethan: "on mess dress the insignia shouldn't be blue lol" (the colonel's bullion eagle came out as the board's blue with its grey outline) and
// "again 2 different colors between the stars" (the general's stars filled on the view from above and hollow on the edge strip). The bullion grades fill with a
// <pattern> that lives inside the asset's <symbol>; a url(#id) is resolved against the whole document, so when another drawing earlier in the page carries a
// pattern of the same id (a hidden preview, a stale copy) the reference goes to that one and paints nothing. This test opens the real page and, ahead of the
// uniform, puts a hidden decoy drawing in the document that holds the same ids with every colour set to red, as the failing case, then draws the mess dress
// colonel, brigadier general and major general and the Class A cadet officer boards and samples the screenshot's pixels:
//   - no red anywhere on a grade (the references stay inside their own drawing);
//   - the grade's fill is lighter than the board under it (the eagle is not the board's blue);
//   - the grade on the view from above and on the edge strip of the same build have the same fill colour, within 30 per channel, and neither is hollow.
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

// A PNG's pixels: 8-bit RGB or RGBA, not interlaced (what Chrome's screenshot writes).
function decodePng(buf){
  let off = 8, w = 0, h = 0, ct = 0; const idat = [];
  while(off < buf.length){
    const len = buf.readUInt32BE(off), type = buf.toString('ascii', off + 4, off + 8), data = buf.subarray(off + 8, off + 8 + len);
    if(type === 'IHDR'){ w = data.readUInt32BE(0); h = data.readUInt32BE(4); ct = data[9]; if(data[8] !== 8 || data[12] !== 0) throw new Error('unsupported PNG'); }
    else if(type === 'IDAT') idat.push(data);
    off += 12 + len;
  }
  const bpp = ct === 6 ? 4 : ct === 2 ? 3 : 0;
  if(!bpp) throw new Error('unsupported PNG colour type ' + ct);
  const raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * bpp, px = Buffer.alloc(h * stride);
  for(let y = 0; y < h; y++){
    const f = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for(let x = 0; x < stride; x++){
      const a = x >= bpp ? px[y * stride + x - bpp] : 0, b = y ? px[(y - 1) * stride + x] : 0, c = x >= bpp && y ? px[(y - 1) * stride + x - bpp] : 0;
      let v = line[x];
      if(f === 1) v += a; else if(f === 2) v += b; else if(f === 3) v += (a + b) >> 1;
      else if(f === 4){ const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      px[y * stride + x] = v & 255;
    }
  }
  return { w, h, at: (x, y) => [px[y * stride + x * bpp], px[y * stride + x * bpp + 1], px[y * stride + x * bpp + 2]] };
}

const lum = c => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
const dist = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);

// What a grade's pixels say. The same box is shot twice, with the grade drawn and with its layer hidden: the pixels that differ are the grade (outline and fill, nothing
// of the board or the coat around it), those under it in the second shot are the board. The fill is the grade's pixels that are not the dark outline.
function readGrade(withGrade, without){
  let n = 0, edge = 0, red = 0; const sum = [0, 0, 0], bg = [0, 0, 0];
  for(let y = 0; y < withGrade.h; y++) for(let x = 0; x < withGrade.w; x++){
    const c = withGrade.at(x, y), d = without.at(x, y);
    if(c[0] > 200 && c[1] < 70 && c[2] < 70) red++;
    if(dist(c, d) < 24) continue;
    if(lum(c) < 90){ edge++; continue; }
    n++; for(let i = 0; i < 3; i++){ sum[i] += c[i]; bg[i] += d[i]; }
  }
  return { n, edge, red, fill: n ? sum.map(v => Math.round(v / n)) : null, bg: n ? bg.map(v => Math.round(v / n)) : null };
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

    const CASES = [
      { name: 'mess dress colonel', uniform: 'mess_dress', membership: 'senior', rank: 'Col' },
      { name: 'mess dress brigadier general', uniform: 'mess_dress', membership: 'senior', rank: 'Brig Gen' },
      { name: 'mess dress major general', uniform: 'mess_dress', membership: 'senior', rank: 'Maj Gen' },
      { name: 'Class A cadet lieutenant colonel boards', uniform: 'blues_a', membership: 'cadet', rank: 'C/Lt Col' },
      { name: 'Class A cadet colonel boards', uniform: 'blues_a', membership: 'cadet', rank: 'C/Col' }
    ];
    const fails = [];
    for(const c of CASES){
      // The grade assets this build draws, read from the engine's scene; then a hidden drawing ahead of the uniform that holds their ids with every colour red.
      await ev(`(async () => { document.querySelectorAll('.bullionDecoy').forEach(n => n.remove()); State.membership = ${JSON.stringify(c.membership)}; State.gender = 'male'; State.rank = ${JSON.stringify(c.rank)}; State.uniform = ${JSON.stringify(c.uniform)}; State.badges = []; await CAPUBUniformView.render(); const e = document.getElementById('previewEmptyState'); if(e) e.hidden = true; })()`);
      const ids = await ev(`[...new Set(CAPUBUniformView.scene.layers.filter(l => l.role === 'grade').map(l => l.id))]`);
      const defsText = await ev(`(async () => {
        const manifest = await fetch('/images/MANIFEST.json').then(r => r.json());
        let out = '';
        for(const id of ${JSON.stringify(ids)}){
          const a = manifest.assets.find(x => x.id === id); if(!a) continue;
          const text = await fetch('/images/' + a.path).then(r => r.text());
          const m = /<defs>([\\s\\S]*?)<\\/defs>/.exec(text); if(m) out += m[1].replace(/#[0-9a-fA-F]{6}\\b|#[0-9a-fA-F]{3}\\b/g, '#ff0000');
        }
        return out;
      })()`);
      await ev(`(() => { const d = document.createElement('div'); d.className = 'bullionDecoy'; d.style.display = 'none'; d.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg"><defs>' + ${JSON.stringify(defsText)} + '</defs></svg>'; document.body.insertBefore(d, document.body.firstChild); })()`);
      await ev(`(async () => { await CAPUBUniformView.render(); const e = document.getElementById('previewEmptyState'); if(e) e.hidden = true; })()`);
      await sleep(500);
      const keys = await ev(`[...document.querySelectorAll('g.layer[data-calib-key^="grade:"]')].filter(g => g.querySelector('use')).map(g => g.getAttribute('data-calib-key'))`);
      const read = {};
      for(const k of keys){
        const q = JSON.stringify(k);
        const box = await ev(`(() => { const g = document.querySelector('g.layer[data-calib-key=' + ${JSON.stringify(q)} + ']'); g.querySelector('use').scrollIntoView({ block: 'center' }); const b = g.getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height }; })()`);
        const clip = { x: box.x - 2, y: box.y - 2, width: box.width + 4, height: box.height + 4, scale: 4 };
        const shoot = async () => Buffer.from((await S('Page.captureScreenshot', { format: 'png', clip })).data, 'base64');
        const a = await shoot();
        await ev(`document.querySelector('g.layer[data-calib-key=' + ${JSON.stringify(q)} + ']').style.visibility = 'hidden'`);
        const b = await shoot();
        await ev(`document.querySelector('g.layer[data-calib-key=' + ${JSON.stringify(q)} + ']').style.visibility = ''`);
        if(OUT){ fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, `${c.name.replace(/\W+/g, '-')}-${k.replace(/:/g, '-')}.png`), a); }
        read[k] = readGrade(decodePng(a), decodePng(b));
      }
      const line = k => `${k}: fill ${read[k].fill && read[k].fill.join(',')} on ${read[k].bg && read[k].bg.join(',')} (${read[k].n} fill px, ${read[k].edge} outline px)`;
      console.log(c.name + '\n  ' + keys.map(line).join('\n  '));
      const side = ['right', 'left'];
      for(const s of side){
        const top = read['grade:top-' + s], edge = read['grade:edge-' + s];
        if(!top || !edge){ fails.push(`${c.name}: no ${!top ? 'top view' : 'edge strip'} grade on the ${s} shoulder`); continue; }
        for(const [view, r] of [['view from above', top], ['edge strip', edge]]){
          if(r.red) fails.push(`${c.name} ${s} ${view}: ${r.red} red pixels, the grade's paint came from another drawing's ids`);
          if(r.n < 30 || r.n < r.edge * 0.5) fails.push(`${c.name} ${s} ${view}: the grade is hollow or missing (${r.n} fill pixels against ${r.edge} of outline)`);
        }
        if(top.fill && edge.fill){
          const d = Math.max(...top.fill.map((v, i) => Math.abs(v - edge.fill[i])));
          if(d > 30) fails.push(`${c.name} ${s}: the grade is ${top.fill.join(',')} on the view from above and ${edge.fill.join(',')} on the edge strip`);
          // Lighter than the board it lies on by a clear margin (the eagle is bullion silver on the officers' blue boards, 168 against 82 in luminance; with the paint lost it
          // was 108), unless the board is itself silver (the general officers' boards): there the stars only have to differ from it, which the pixel read already requires.
          for(const [view, r] of [['view from above', top], ['edge strip', edge]]){
            if(!/general/.test(c.name) && lum(r.fill) < lum(r.bg) + 50) fails.push(`${c.name} ${s} ${view}: the grade (${r.fill.join(',')}) is not clearly lighter than the board (${r.bg.join(',')})`);
          }
        }
      }
    }
    console.log(fails.length ? `FAIL:\n  ${fails.join('\n  ')}` : 'PASS');
    if(fails.length) code = 1;
  } catch (e) { console.error(e); code = 2; }
  finally { try { ws.close(); } catch {} proc.kill(); srv.close(); process.exit(code); }
})();
