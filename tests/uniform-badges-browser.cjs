#!/usr/bin/env node
'use strict';
// Browser check for the badges a uniform offers (run by tests/uniform-badges.test.cjs; needs Chrome). LIVE13 E67, Ethan: "when someone
// is selecting on a uniform, it should only show the badges applicable. like for ABU's, the ES specialty track badges shouldn't apply".
//
//   node tests/uniform-badges-browser.cjs [--out DIR]
//
// Serves the repo, opens index.html in headless Chrome, builds a senior Capt on the Class B through the setup's controls, and in the
// Badges picker adds the Emergency Services badge and the Pilot badge by their tiles. Both are drawn. Switches to the ABU: the ES badge
// stays selected in State but has no tile in the picker and no piece in the drawing, the Pilot badge is still offered and drawn, and
// the Badges panel says "1 selected badge is not worn on this uniform" with the paragraph. Back on the Class B the ES badge is drawn
// and offered (checked) again and the line is gone. --out writes a screenshot of the panel and the picker on the ABU.
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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uniform-badges-chrome-'));
  const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--mute-audio', '--remote-debugging-port=0', `--user-data-dir=${dir}`, 'about:blank'], { stdio: 'ignore' });
  const portFile = path.join(dir, 'DevToolsActivePort');
  for(let i = 0; !fs.existsSync(portFile); i++){ if(i > 800) throw new Error('Chrome did not start'); await new Promise(r => setTimeout(r, 25)); }
  await new Promise(r => setTimeout(r, 50));
  const [port, wsPath] = fs.readFileSync(portFile, 'utf8').trim().split('\n');
  const ws = new WebSocket(`ws://127.0.0.1:${port}${wsPath}`);
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
  return { proc, cdp: new Cdp(ws), ws };
}


const ES = 'emergency_services_badge', PILOT = 'CAPPilot1_FA9D33EA587D8';

(async () => {
  const srv = await serve();
  const { proc, cdp, ws } = await launch();
  const fails = [];
  const expect = (ok, msg) => { if(!ok) fails.push(msg); };
  let code = 0;
  try {
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    const S = (m, p) => cdp.send(m, p, sessionId);
    const ev = async expr => { const r = await S('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if(r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    await S('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });
    await S('Page.enable');
    await S('Page.addScriptToEvaluateOnNewDocument', { source: "try{localStorage.setItem('cap_uniform_builder_access_v1','1')}catch(e){}" });
    await S('Page.navigate', { url: `http://127.0.0.1:${srv.address().port}/index.html` });
    for(let i = 0; i < 400; i++){ if(await ev('typeof CAPUBUniformView !== "undefined" && typeof isBadgeWornOnCurrentUniform === "function"').catch(() => false)) break; await sleep(50); }
    await sleep(800);
    await ev(`window.__settle = async () => { await new Promise(r => setTimeout(r, 150)); for(let i = 0; i < 4; i++){ await CAPUBUniformView.scheduleRender(); await new Promise(r => setTimeout(r, 60)); } }`);
    await ev(`window.__pick = async (id, value) => { const el = document.getElementById(id); el.value = value; el.dispatchEvent(new Event('change', { bubbles: true })); await __settle(); }`);
    await ev(`window.__uniform = async u => { document.querySelector('.uniformOption[data-uniform-id="' + u + '"]').click(); await __settle(); }`);
    // The picker's tiles by badge name: { name: checked }.
    await ev(`window.__open = async () => { document.getElementById('expandBadges').click(); await new Promise(r => setTimeout(r, 300)); }`);
    await ev(`window.__close = async () => { document.getElementById('galleryModalCloseBtn').click(); await __settle(); }`);
    await ev(`window.__tiles = () => Object.fromEntries([...document.querySelectorAll('#galleryModalHost .galleryTile')].map(t => [t.querySelector('.title')?.textContent, !!t.querySelector('.bdChk')?.checked]))`);
    await ev(`window.__add = async id => { const name = getBadgeDisplayName(id); const tile = [...document.querySelectorAll('#galleryModalHost .galleryTile')].find(t => t.querySelector('.title')?.textContent === name); if(!tile) throw new Error('no tile for ' + name); const c = tile.querySelector('.bdChk'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); await __settle(); }`);
    await ev(`window.__state = () => {
      const note = document.getElementById('badgesNotWornNote');
      return {
        uniform: State.uniform, badges: [...State.badges],
        drawn: [...document.querySelectorAll('#uniformCanvas svg.uniformSvg g.layer[data-role="badge"]')].map(g => String(g.getAttribute('data-calib-key')).replace(/^badge:/, '')),
        note: note && !note.classList.contains('hidden') ? note.textContent : '',
        modalNote: document.querySelector('#galleryModalHost .badgesNotWornNote')?.textContent || ''
      };
    }`);
    const shot = async name => {
      if(!OUT) return;
      fs.mkdirSync(OUT, { recursive: true });
      const r = await S('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(OUT, `uniform-badges-${name}.png`), Buffer.from(r.data, 'base64'));
    };
    const esName = await ev(`getBadgeDisplayName('${ES}')`), pilotName = await ev(`getBadgeDisplayName('${PILOT}')`);

    await ev(`__pick('membershipType', 'senior')`);
    await ev(`__pick('rankSetupSelect', 'Capt')`);
    await ev(`__pick('jacketSelect', 'male')`);
    await ev(`__uniform('blues_b')`);

    // ---- 1. The Class B: the ES badge is offered; add it and the Pilot badge. ----
    await ev('__open()');
    const t0 = await ev('__tiles()');
    expect(esName in t0, 'the Class B picker offers the ES badge');
    await ev(`__add('${ES}')`);
    await ev(`__add('${PILOT}')`);
    await ev('__close()');
    const a = await ev('__state()');
    console.log('Class B:', JSON.stringify(a));
    expect(a.badges.includes(ES) && a.badges.includes(PILOT), 'both badges are selected');
    expect(a.drawn.includes(ES) && a.drawn.includes(PILOT), `both are drawn on the Class B: ${a.drawn.join(', ')}`);
    expect(!a.note, 'no not-worn line on the Class B');

    // ---- 2. The ABU: the ES badge is hidden and not drawn, still selected. ----
    await ev(`__uniform('abu')`);
    const b = await ev('__state()');
    console.log('ABU:', JSON.stringify(b));
    expect(b.badges.includes(ES), 'the ES badge stays selected on the ABU');
    expect(!b.drawn.includes(ES), 'the ES badge is not drawn on the ABU');
    expect(b.drawn.includes(PILOT), `the Pilot badge is drawn on the ABU: ${b.drawn.join(', ')}`);
    expect(/^1 selected badge is not worn on this uniform \(CAPR 39-1, 5\.1\.1\.1\.2\.4/.test(b.note), `the panel's line: ${b.note}`);
    await ev('__open()');
    const t1 = await ev('__tiles()');
    const b2 = await ev('__state()');
    expect(!(esName in t1), 'the ABU picker has no ES tile');
    // No CAP specialty track, service or National Staff badge (U.S. military badges have a section of their own, not checked here).
    const capHidden = await ev(`Object.keys(CAPUBBadgeCatalog.BADGES).filter(id => ['specialty', 'service', 'national-staff'].includes(CAPUBBadgeCatalog.family(id))).map(getBadgeDisplayName)`);
    const shown = capHidden.filter(n => n in t1);
    expect(!shown.length, `no specialty track or service tile on the ABU: ${shown.join(', ')}`);
    expect(t1[pilotName] === true, 'the Pilot tile is offered and checked on the ABU');
    expect(/^1 selected badge is not worn on this uniform/.test(b2.modalNote), `the picker's line: ${b2.modalNote}`);
    await shot('abu-picker');
    await ev('__close()');

    // ---- 3. Back to the Class B. ----
    await ev(`__uniform('blues_b')`);
    const c = await ev('__state()');
    console.log('Class B again:', JSON.stringify(c));
    expect(c.drawn.includes(ES) && c.drawn.includes(PILOT), 'both are drawn again on the Class B');
    expect(!c.note, 'the line is gone on the Class B');
    await ev('__open()');
    const t2 = await ev('__tiles()');
    expect(t2[esName] === true, 'the ES tile is back and checked');
    await ev('__close()');

    console.log(fails.length ? `FAIL:\n  ${fails.join('\n  ')}` : 'PASS');
    if(fails.length) code = 1;
  } catch (e) { console.error(e); code = 2; }
  finally { try { ws.close(); } catch {} proc.kill(); srv.close(); process.exit(code); }
})();
