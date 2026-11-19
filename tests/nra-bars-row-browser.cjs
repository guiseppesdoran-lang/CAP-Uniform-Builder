#!/usr/bin/env node
'use strict';
// Browser check that the three Distinguished Expert bar switches (rifle, pistol, shotgun) sit in one row of three equal tiles under the NRA badge's tile, at 320, 390 and 1280 px
// wide: side by side, their names on one line and not cut, each at least 44 px high, and nothing moves when the row appears or a bar is turned on (run by tests/nra-bars-row.test.cjs;
// needs Chrome).   node tests/nra-bars-row-browser.cjs [--out DIR]
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
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


(async () => {
  const srv = await serve();
  const chrome = await launchChrome({ prefix: 'nra-bars-row' });
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
    await S('Page.addScriptToEvaluateOnNewDocument', { source: "document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent='*{overflow-anchor:none!important}';document.head.append(s)})" });
    await S('Page.addScriptToEvaluateOnNewDocument', { source: "try{localStorage.setItem('cap_uniform_builder_access_v1','1')}catch(e){}" });
    const tap = async sel => {
      const r = await ev(`(() => { const t = document.querySelector(${JSON.stringify(sel)}); if(!t) return null; t.scrollIntoView({ block: 'center' }); const r = t.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
      if(!r) throw new Error('no tile ' + sel);
      await sleep(150);
      const q = await ev(`(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
      await S('Input.dispatchMouseEvent', { type: 'mouseMoved', x: q.x, y: q.y });
      await S('Input.dispatchMouseEvent', { type: 'mousePressed', x: q.x, y: q.y, button: 'left', clickCount: 1 });
      await S('Input.dispatchMouseEvent', { type: 'mouseReleased', x: q.x, y: q.y, button: 'left', clickCount: 1 });
      await sleep(900);
    };
    const shot = async name => {
      if(!OUT) return;
      fs.mkdirSync(OUT, { recursive: true });
      const r = await S('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(r.data, 'base64'));
    };
    const NRA = '#galleryModalHost .vpCell[data-value="nra_marksman_badge"]';
    // The tile, the level row and the three bar switches of the NRA cell: their boxes, and whether each name fits on one line.
    const measure = () => ev(`(() => {
      const cell = document.querySelector(${JSON.stringify(NRA)});
      const box = e => { const r = e.getBoundingClientRect(); return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) }; };
      const tile = cell.querySelector(':scope > .vpOption');
      const bars = [...cell.querySelectorAll('.vpBarRow .ribbonToggle')].map(b => { const s = b.querySelector('span'); const lh = parseFloat(getComputedStyle(s).lineHeight) || parseFloat(getComputedStyle(s).fontSize) * 1.2;
        return Object.assign(box(b), { name: s.textContent, lines: Math.round(s.getBoundingClientRect().height / lh), cut: s.scrollWidth > s.clientWidth + 1 || b.scrollWidth > b.clientWidth + 1, pressed: b.getAttribute('aria-pressed') }); });
      const row = cell.querySelector('.vpBarRow');
      return { tile: tile && box(tile), row: row && box(row), bars, scroll: [document.querySelector('#galleryModal .modalBody')].filter(Boolean).map(s => s.scrollTop)[0], page: window.scrollY };
    })()`);
    const results = {};
    for(const view of [{ name: '320', w: 320, h: 700, mobile: true }, { name: '390', w: 390, h: 844, mobile: true }, { name: '1280', w: 1280, h: 900, mobile: false }]){
      await S('Emulation.setDeviceMetricsOverride', { width: view.w, height: view.h, deviceScaleFactor: 1, mobile: view.mobile });
      await S('Page.navigate', { url: `http://127.0.0.1:${srv.address().port}/index.html` });
      for(let i = 0; i < 400; i++){ if(await ev('typeof CAPUBUniformView !== "undefined" && !!document.getElementById("expandBadges")').catch(() => false)) break; await sleep(50); }
      await sleep(800);
      await ev(`(async () => { State.membership = 'cadet'; State.gender = 'male'; State.rank = 'C/Capt'; State.uniform = 'blues_a'; State.badgeSelections = {}; State.badges = []; fullRender(); await CAPUBUniformView.render(); document.getElementById('expandBadges').click(); })()`);
      await sleep(1800);
      await tap(NRA + ' > .vpOption');
      await tap(NRA + ' .vpRow .vpOption[data-value="distinguished-expert"]');
      const before = await measure();
      await shot(`${view.name}-bars-off`);
      await tap(NRA + ' .vpBarRow .ribbonToggle[data-value="pistol"]');
      const one = await measure();
      await tap(NRA + ' .vpBarRow .ribbonToggle[data-value="rifle"]');
      await tap(NRA + ' .vpBarRow .ribbonToggle[data-value="shotgun"]');
      const three = await measure();
      await shot(`${view.name}-bars-on`);
      results[view.name] = { before, one, three };
      const tag = `${view.name} px`;
      const b = before.bars;
      if(b.length !== 3) { fails.push(`${tag}: ${b.length} bar switches, not 3`); continue; }
      if(!(b.every(x => Math.abs(x.y - b[0].y) < 1))) fails.push(`${tag}: the switches are not in one row (y ${b.map(x => x.y).join(', ')})`);
      if(!(b[0].x < b[1].x && b[1].x < b[2].x)) fails.push(`${tag}: the switches are not side by side`);
      if(Math.max(...b.map(x => x.w)) - Math.min(...b.map(x => x.w)) > 1) fails.push(`${tag}: the three are not equal in width (${b.map(x => x.w).join(', ')})`);
      for(const x of b){
        if(x.h < 44) fails.push(`${tag}: ${x.name} is ${x.h} px high, under 44`);
        if(x.lines > 1) fails.push(`${tag}: the name ${x.name} runs onto ${x.lines} lines`);
        if(x.cut) fails.push(`${tag}: the name ${x.name} is cut`);
      }
      const inside = before.row && b.every(x => x.x >= before.row.x - 0.5 && x.x + x.w <= before.row.x + before.row.w + 0.5);
      if(!inside) fails.push(`${tag}: the switches run out of their row`);
      // Steady: the bar switches are where they were after each bar is turned on, and the tile above has not moved.
      for(const [label, after] of [['one bar', one], ['three bars', three]]){
        // Measured from the tile (the window may have scrolled to bring the switch under the pointer): the row is as far under it, as high and as wide as before.
        const dy = r => +(r.row.y - r.tile.y).toFixed(1);
        if(dy(after) !== dy(before) || after.row.h !== before.row.h || after.row.w !== before.row.w || after.tile.w !== before.tile.w || after.tile.h !== before.tile.h) fails.push(`${tag}: the row moved or changed size when ${label} was on (${JSON.stringify(before)} to ${JSON.stringify(after)})`);
      }
    }
    console.log(JSON.stringify(Object.fromEntries(Object.entries(results).map(([k, v]) => [k, { row: v.before.row, bars: v.before.bars.map(x => [x.x, x.y, x.w, x.h, x.lines, x.cut]) }]))));
    if(fails.length){ console.log('FAIL\n' + fails.join('\n')); code = 1; } else console.log('PASS');
  }catch(e){ console.log('ERROR ' + (e.stack || e)); code = 1; }
  finally{ srv.close(); await chrome.close(); }
  process.exit(code);
})();
