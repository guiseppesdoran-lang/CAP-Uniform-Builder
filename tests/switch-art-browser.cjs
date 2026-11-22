#!/usr/bin/env node
'use strict';
// Browser check that the picture on a switch (a ribbon's device, a badge's bar) is drawn whole with a clear pixel on every side (run by tests/switch-art.test.cjs; needs Chrome).
//
//   node tests/switch-art-browser.cjs [--out DIR]
//
// Puts the page's own switch picture (the class `ribbonToggleArt`, as js/pick-lists.js makes it) with each device's drawing at 20 and 24 px, at device pixel ratios 1, 2 and 3, on a
// transparent ground, takes the screenshot and reads its pixels: the outer css pixel all round the box is clear, so no edge of the drawing, and no stray hairline beside it, can show;
// and the drawing is there (its pixels are inside, away from the ring).
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const zlib = require('node:zlib');
const { launchChrome } = require('../scripts/lib-chrome.cjs');

const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const OUT = args.indexOf('--out') >= 0 ? args[args.indexOf('--out') + 1] : null;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };

function serve(){
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
      if(!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()){ rsp.writeHead(404); return rsp.end(); }
      rsp.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      fs.createReadStream(p).pipe(rsp);
    }).listen(0, '127.0.0.1', () => res(srv));
  });
}
class Cdp {
  constructor(ws){ this.ws = ws; this.id = 0; this.pending = new Map(); ws.addEventListener('message', m => { const d = JSON.parse(m.data); const p = this.pending.get(d.id); if(p){ this.pending.delete(d.id); d.error ? p.rej(new Error(d.error.message)) : p.res(d.result); } }); }
  send(method, params, sessionId){ const id = ++this.id; return new Promise((res, rej) => { this.pending.set(id, { res, rej }); this.ws.send(JSON.stringify({ id, method, params: params || {}, ...(sessionId ? { sessionId } : {}) })); }); }
}

// The pixels (RGBA, 8 bits, no interlace) of a PNG the browser made.
function decodePng(buf){
  let pos = 8, width = 0, height = 0; const data = [];
  while(pos < buf.length){
    const len = buf.readUInt32BE(pos), type = buf.toString('ascii', pos + 4, pos + 8), body = buf.subarray(pos + 8, pos + 8 + len);
    if(type === 'IHDR'){ width = body.readUInt32BE(0); height = body.readUInt32BE(4); if(body[8] !== 8 || body[9] !== 6 || body[12] !== 0) throw new Error('not 8-bit RGBA'); }
    if(type === 'IDAT') data.push(body);
    pos += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(data)), stride = width * 4, out = Buffer.alloc(stride * height);
  for(let y = 0; y < height; y++){
    const f = raw[y * (stride + 1)];
    for(let i = 0; i < stride; i++){
      const x = raw[y * (stride + 1) + 1 + i];
      const a = i >= 4 ? out[y * stride + i - 4] : 0, b = y ? out[(y - 1) * stride + i] : 0, c = i >= 4 && y ? out[(y - 1) * stride + i - 4] : 0;
      let v = x;
      if(f === 1) v = x + a; else if(f === 2) v = x + b; else if(f === 3) v = x + ((a + b) >> 1);
      else if(f === 4){ const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c); }
      out[y * stride + i] = v & 255;
    }
  }
  return { width, height, at: (x, y) => out[(y * width + x) * 4 + 3] };
}

(async () => {
  const srv = await serve();
  const chrome = await launchChrome({ prefix: 'switch-art' });
  const cdp = new Cdp(chrome.ws);
  const fails = [];
  let code = 0;
  try {
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    const S = (m, p) => cdp.send(m, p, sessionId);
    const ev = async expr => { const r = await S('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if(r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    await S('Page.enable');
    await S('Page.addScriptToEvaluateOnNewDocument', { source: "try{localStorage.setItem('cap_uniform_builder_access_v1','1')}catch(e){}" });
    const files = fs.readdirSync(path.join(ROOT, 'images/devices')).filter(f => f.endsWith('.svg') && !/numeral-(?!1$)/.test(f)).map(f => 'images/devices/' + f);
    let checked = 0;
    for(const dpr of [1, 2, 3]){
      await S('Emulation.setDeviceMetricsOverride', { width: 400, height: 300, deviceScaleFactor: dpr, mobile: false });
      await S('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
      await S('Page.navigate', { url: `http://127.0.0.1:${srv.address().port}/index.html` });
      for(let i = 0; i < 400; i++){ if(await ev('typeof CAPUBUniformView !== "undefined"').catch(() => false)) break; await sleep(50); }
      await sleep(500);
      // The page hidden but for the pictures: the page's own style rule for the box, each box at 20 or 24 px, spaced out on a transparent ground.
      await ev(`(() => {
        document.documentElement.style.background = 'transparent'; document.body.style.background = 'transparent';
        for(const c of [...document.body.children]) c.style.display = 'none';
        const host = document.createElement('div'); host.id = 'artTest'; host.style.cssText = 'position:fixed;left:0;top:0;padding:8px;background:transparent';
        document.body.append(host);
      })()`);
      for(const size of [20, 24]){
        for(const file of files){
          await ev(`(() => { const h = document.getElementById('artTest'); h.textContent = ''; const s = document.createElement('span'); s.className = 'ribbonToggleArt'; s.style.width = '${size}px'; s.style.height = '${size}px'; s.style.margin = '4px'; s.style.backgroundImage = 'url("${file}")'; h.append(s); })()`);
          // The picture has to be loaded before the screenshot: wait for the image the style names.
          await ev(`new Promise(r => { const i = new Image(); i.onload = i.onerror = r; i.src = '${file}'; })`);
          await sleep(60);
          const box = await ev(`(() => { const r = document.querySelector('#artTest .ribbonToggleArt').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })()`);
          const m = 2;
          const shot = await S('Page.captureScreenshot', { format: 'png', clip: { x: box.x - m, y: box.y - m, width: box.w + 2 * m, height: box.h + 2 * m, scale: 1 } });
          const png = decodePng(Buffer.from(shot.data, 'base64'));
          const px = png.width / (box.w + 2 * m);
          const lo = Math.round(m * px), hi = Math.round((m + box.w) * px);   // the box in pixels
          const ring = Math.round(px);                                      // one css pixel
          let inRing = 0, inner = 0;
          for(let y = 0; y < png.height; y++) for(let x = 0; x < png.width; x++){
            if(!png.at(x, y)) continue;
            const inBox = x >= lo && x < hi && y >= lo && y < hi;
            const inInner = x >= lo + ring && x < hi - ring && y >= lo + ring && y < hi - ring;
            if(!inBox || !inInner) inRing++; else inner++;
          }
          checked++;
          const tag = `${path.basename(file)} at ${size} px, ratio ${dpr}`;
          if(inRing) fails.push(`${tag}: ${inRing} painted pixels in the outer pixel of the box or outside it`);
          if(!inner) fails.push(`${tag}: nothing drawn`);
          if(OUT && /device-(star-bronze|propeller-bronze)/.test(file) && size === 20 && dpr === 3){ fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, `switch-art-${path.basename(file, '.svg')}-${size}-${dpr}.png`), Buffer.from(shot.data, 'base64')); }
        }
      }
    }
    console.log(`checked ${checked} pictures`);
    if(fails.length){ console.log('FAIL\n' + fails.slice(0, 20).join('\n')); code = 1; } else console.log('PASS');
  }catch(e){ console.log('ERROR ' + (e.stack || e)); code = 1; }
  finally { srv.close(); await chrome.close(); }
  process.exit(code);
})();
