#!/usr/bin/env node
'use strict';
// Browser check that nothing pinned to the coat is drawn inside its opening (run by tests/rack-opening.test.cjs; needs Chrome). The owner (2026-11-12): on the women's Class A coat with four
// across flush, a sliver of ribbon showed to the left of the lapel, inside the coat's opening over the shirt.
//
//   node tests/rack-opening-browser.cjs [--out DIR]
//
// Serves the repo, opens the page in headless Chrome and sets up a woman in the Service Dress with fourteen ribbons laid four across, the left edge on the pocket, in the standard arrangement. The
// shirt landmark of the coat sheet is the opening; every point of a ribbon that lies in it is read off the screenshot and compared with the pixel at the same place on the same coat with no
// ribbons: they must be the same (the shirt), and a point of a ribbon outside the opening and outside the lapel must differ (the ribbons are drawn).
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
  const chrome = await launchChrome({ prefix: 'rack-opening' });
  return { cdp: new Cdp(chrome.ws), ws: chrome.ws, chrome };
}


const IDS = ['air_force_aerial_achievement_medal', 'silver_medal_of_valor', 'bronze_medal_of_valor', 'distinguished_service_award', 'exceptional_service_award', 'meritorious_service_award',
  'commander_commendation_award', 'cap_achievment_award', 'lifesaving_award', 'unit_citation_award', 'cap_gill_robb_wilson_ribbon', 'cap_paul_e_garber_ribbon', 'cap_leadership_ribbon', 'cap_membership_ribbon'];

(async () => {
  const srv = await serve();
  const { chrome, cdp, ws } = await launch();
  let code = 0;
  const fails = [];
  try {
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    const S = (m, p) => cdp.send(m, p, sessionId);
    const ev = async expr => { const r = await S('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if(r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    await S('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1500, deviceScaleFactor: 1, mobile: false });
    await S('Page.enable');
    await S('Page.addScriptToEvaluateOnNewDocument', { source: "try{localStorage.setItem('cap_uniform_builder_access_v1','1')}catch(e){}" });
    await S('Page.navigate', { url: `http://127.0.0.1:${srv.address().port}/index.html` });
    for(let i = 0; i < 400; i++){ if(await ev('typeof CAPUBUniformView !== "undefined" && typeof setRibbonSelectionFromDropdown === "function"').catch(() => false)) break; await sleep(50); }
    await sleep(800);
    const setup = ids => ev(`(async () => {
      State.membership = 'senior'; State.gender = 'female'; State.rank = 'Capt'; State.uniform = 'blues_a'; State.garment = {}; State.hideRibbons = false; State.badges = [];
      document.getElementById('membershipType').value = State.membership; document.getElementById('jacketSelect').value = State.gender;
      try{ updateSetupGates(); }catch(e){}
      State.membership = 'senior'; State.gender = 'female'; State.rank = 'Capt'; State.uniform = 'blues_a';
      document.getElementById('rankSetupSelect').value = State.rank;
      State.ribbonRackLayout = '4-left'; State.ribbonRackArrangement = 'standard'; State.ribbonRowOverrideEnabled = false; State.ribbonRowOverride = [];
      normalizeRibbonSelections(); for(const id of Object.keys(State.ribbonSelections)) clearRibbonSelection(id);
      for(const id of ${JSON.stringify(ids)}) setRibbonSelectionFromDropdown(id, 'earned', { deferRender: true });
      rebuildRibbonsFromGallery(); await fullRender(); refreshUI();
      await new Promise(r => setTimeout(r, 2500));
      document.querySelector('#uniformCanvas svg.uniformSvg').scrollIntoView({ block: 'center' });
      await new Promise(r => setTimeout(r, 400));
      return State.ribbons.length;
    })()`);
    const shot = async () => (await S('Page.captureScreenshot', { format: 'png' })).data;

    // The points: where a ribbon's box meets the sheet's opening (the shirt landmark), and one where it does not (a ribbon in the clear).
    const worn = await setup(IDS);
    if(worn !== 14) fails.push(`fourteen ribbons should be worn: ${worn}`);
    const points = await ev(`(async () => {
      const spec = await (await fetch('images/garments/garment-blues-class-a-coat-female.spec.json')).json();
      const poly = spec.landmarks.shirt.map(p => ({ x: p[0] / 100, y: p[1] / 100 }));
      const lapel = spec.landmarks.lapel_left.map(p => ({ x: p[0] / 100, y: p[1] / 100 }));
      const inside = (q, pl) => { let c = false; for(let i = 0, j = pl.length - 1; i < pl.length; j = i++){ const a = pl[i], b = pl[j]; if(((a.y > q.y) !== (b.y > q.y)) && (q.x < (b.x - a.x) * (q.y - a.y) / (b.y - a.y) + a.x)) c = !c; } return c; };
      const svg = document.querySelector('#uniformCanvas svg.uniformSvg');
      const ctm = svg.getScreenCTM();
      const screen = q => { const p = new DOMPoint(q.x, q.y).matrixTransform(ctm); return { x: Math.round(p.x), y: Math.round(p.y) }; };
      const opening = [], clear = [];
      for(const l of CAPUBUniformView.scene.layers.filter(l => l.role === 'ribbon')){
        for(let i = 0; i < 24; i++) for(let j = 0; j < 8; j++){
          const q = { x: l.x + (i + 0.5) * l.w / 24, y: l.y + (j + 0.5) * l.h / 8 };
          if(inside(q, poly)) opening.push(screen(q));
          else if(!inside(q, lapel) && q.x > poly.reduce((a, p) => Math.max(a, p.x), 0) + 0.5) clear.push(screen(q));
        }
      }
      return { opening, clear: clear.filter((c, i) => i % 7 === 0).slice(0, 20), viewport: [innerWidth, innerHeight] };
    })()`);
    console.log('points in the opening:', points.opening.length, '| in the clear:', points.clear.length);
    if(points.opening.length < 8) fails.push(`the rack should reach the opening (the sliver): ${points.opening.length} points`);
    const withRibbons = await shot();
    await setup([]);
    const without = await shot();
    // The pixels, read in the page from the two screenshots.
    const px = await ev(`(async () => {
      const read = async b64 => { const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode(); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0); return g; };
      const a = await read(${JSON.stringify(withRibbons)}), b = await read(${JSON.stringify(without)});
      const diff = ps => ps.map(p => { const x = a.getImageData(p.x, p.y, 1, 1).data, y = b.getImageData(p.x, p.y, 1, 1).data; return Math.max(Math.abs(x[0] - y[0]), Math.abs(x[1] - y[1]), Math.abs(x[2] - y[2])); });
      return { opening: diff(${JSON.stringify(points.opening)}), clear: diff(${JSON.stringify(points.clear)}) };
    })()`);
    const wrong = px.opening.filter(d => d > 24).length;
    console.log('opening points that differ from the coat without ribbons:', wrong, 'of', px.opening.length, '| clear points that differ:', px.clear.filter(d => d > 60).length, 'of', px.clear.length);
    if(wrong) fails.push(`${wrong} of ${px.opening.length} points inside the opening are not the shirt: a ribbon is drawn there`);
    if(px.clear.filter(d => d > 60).length < 5) fails.push('the ribbons outside the opening should be drawn (the check would prove nothing otherwise)');
    if(OUT){ fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, 'rack-opening.png'), Buffer.from(withRibbons, 'base64')); }
    console.log(fails.length ? `FAIL:\n  ${fails.join('\n  ')}` : 'PASS');
    if(fails.length) code = 1;
  } catch (e) { console.error(e); code = 2; }
  finally { try { ws.close(); } catch {} await chrome.close(); srv.close(); process.exit(code); }
})();
