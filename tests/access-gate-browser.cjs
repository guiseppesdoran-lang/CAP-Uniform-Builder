#!/usr/bin/env node
'use strict';
// Browser check for the access gate's "Continue as guest" button (run by tests/access-gate.test.cjs; needs Chrome).
//
//   node tests/access-gate-browser.cjs [--out DIR]
//
// Serves the repo and opens index.html in headless Chrome with no access key stored. The gate shows; "Continue as guest"
// opens the builder with data-access="guest", stores nothing in localStorage, keeps the guest for the session (a reload
// stays open) and the builder takes input. A fresh browser context (a new session) sees the gate again. The code path
// still sets data-access="ok" and remembers the code in localStorage (LIVE12 E55, Ethan: "also add a continue as guest thing").
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const args = process.argv.slice(2);
const OUT = args.includes('--out') ? args[args.indexOf('--out') + 1] : null;
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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'access-gate-chrome-'));
  const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--mute-audio', '--remote-debugging-port=0', `--user-data-dir=${dir}`, 'about:blank'], { stdio: 'ignore' });
  const portFile = path.join(dir, 'DevToolsActivePort');
  for(let i = 0; !fs.existsSync(portFile); i++){ if(i > 800) throw new Error('Chrome did not start'); await new Promise(r => setTimeout(r, 25)); }
  await new Promise(r => setTimeout(r, 50));
  const [port, wsPath] = fs.readFileSync(portFile, 'utf8').trim().split('\n');
  const ws = new WebSocket(`ws://127.0.0.1:${port}${wsPath}`);
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
  return { proc, cdp: new Cdp(ws), ws };
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const srv = await serve();
  const { proc, cdp, ws } = await launch();
  const url = `http://127.0.0.1:${srv.address().port}/index.html`;
  const fails = [];
  let code = 0;
  // A tab in its own browser context: its own localStorage and sessionStorage, like a new visit.
  async function freshTab(){
    const { browserContextId } = await cdp.send('Target.createBrowserContext');
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank', browserContextId });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    const S = (m, p) => cdp.send(m, p, sessionId);
    const ev = async expr => { const r = await S('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if(r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
    await S('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await S('Page.enable');
    const open = async () => {
      await S('Page.navigate', { url });
      for(let i = 0; i < 400; i++){ if(await ev('document.readyState === "complete" && typeof CAPUBUniformView !== "undefined"').catch(() => false)) break; await sleep(50); }
      await sleep(300);
    };
    return { S, ev, open };
  }
  // What the page looks like to a member: the gate's display, the access mark, the stored keys, and whether a click on the
  // Import Member Report button reaches it (the gate covers the whole page when it is up).
  const look = ev => ev(`(() => {
    const gate = document.getElementById('accessGate');
    const sel = document.getElementById('importMemberReportBtn');
    if(sel) sel.scrollIntoView({ block: 'center' });
    const r = sel ? sel.getBoundingClientRect() : null;
    const hit = r && r.width ? document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) : null;
    let local = null, session = null;
    try { local = localStorage.getItem('cap_uniform_builder_access_v1'); session = sessionStorage.getItem('cap_uniform_builder_guest_v1'); } catch(e){}
    return { access: document.documentElement.getAttribute('data-access'), gateShown: getComputedStyle(gate).display !== 'none',
      guestButton: !!document.getElementById('accessGateGuest'), reachable: !!hit && (hit === sel || sel.contains(hit)), local, session };
  })()`);
  try {
    // 1. A guest.
    const a = await freshTab();
    await a.open();
    const before = await a.ev(`(() => { const g = document.getElementById('accessGate'); return { access: document.documentElement.getAttribute('data-access'), gateShown: getComputedStyle(g).display !== 'none' }; })()`);
    console.log('first visit:', JSON.stringify(before));
    if(!before.gateShown) fails.push('the gate is not shown on a first visit');
    if(before.access) fails.push(`data-access is ${before.access} before anything was entered`);
    await a.ev(`document.getElementById('accessGateGuest').click()`);
    await sleep(200);
    const guest = await look(a.ev);
    console.log('after "Continue as guest":', JSON.stringify(guest));
    if(guest.access !== 'guest') fails.push(`data-access is ${guest.access}, not guest`);
    if(guest.gateShown) fails.push('the gate is still shown for the guest');
    if(!guest.reachable) fails.push('the builder controls cannot be reached after "Continue as guest"');
    if(guest.local !== null) fails.push('guest access was written to localStorage');
    if(guest.session !== '1') fails.push('guest access was not kept for the session');
    // The workspace takes input: membership, rank and cut draw a uniform.
    const drawn = await a.ev(`(async () => {
      const set = (id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); };
      set('membershipType', 'senior');
      await new Promise(r => setTimeout(r, 150));
      set('rankSetupSelect', 'Capt');
      await new Promise(r => setTimeout(r, 150));
      set('jacketSelect', 'male');
      for(let i = 0; i < 100 && !document.querySelector('#uniformCanvas svg.uniformSvg'); i++) await new Promise(r => setTimeout(r, 50));
      return { membership: State.membership, rank: State.rank, svg: !!document.querySelector('#uniformCanvas svg.uniformSvg') };
    })()`);
    console.log('guest builds:', JSON.stringify(drawn));
    if(drawn.membership !== 'senior' || drawn.rank !== 'Capt' || !drawn.svg) fails.push('the guest could not build a uniform');
    await a.open();
    const reload = await look(a.ev);
    console.log('guest reloads:', JSON.stringify(reload));
    if(reload.access !== 'guest' || reload.gateShown) fails.push('a reload in the same session shows the gate to the guest again');

    // 2. The same browser, a new session: the gate is back.
    const b = await freshTab();
    await b.open();
    const again = await look(b.ev);
    console.log('new session:', JSON.stringify(again));
    if(!again.gateShown || again.access) fails.push('a new session did not see the gate again');
    if(!again.guestButton) fails.push('the guest button is missing');
    if(again.reachable) fails.push('the builder can be clicked while the gate is up');
    if(OUT){
      fs.mkdirSync(OUT, { recursive: true });
      const shot = await b.S('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(OUT, 'access-gate.png'), Buffer.from(shot.data, 'base64'));
    }

    // 3. The code path is unchanged.
    await b.ev(`(() => { document.getElementById('accessGateInput').value = '000000'; document.getElementById('accessGateForm').requestSubmit(); })()`);
    await sleep(100);
    const wrong = await b.ev(`({ access: document.documentElement.getAttribute('data-access'), error: document.getElementById('accessGateError').textContent })`);
    console.log('wrong code:', JSON.stringify(wrong));
    if(wrong.access || !wrong.error) fails.push('a wrong code opened the builder or said nothing');
    await b.ev(`(() => { document.getElementById('accessGateInput').value = '656335'; document.getElementById('accessGateForm').requestSubmit(); })()`);
    await sleep(200);
    const member = await look(b.ev);
    console.log('right code:', JSON.stringify(member));
    if(member.access !== 'ok') fails.push(`the code sets data-access ${member.access}, not ok`);
    if(member.gateShown || !member.reachable) fails.push('the gate is still in the way after the code');
    if(member.local !== '1') fails.push('the code is not remembered in localStorage');
    if(member.session !== null) fails.push('the code path wrote the guest key');
    await b.open();
    const back = await look(b.ev);
    console.log('member reloads:', JSON.stringify(back));
    if(back.access !== 'ok' || back.gateShown) fails.push('a member who entered the code is not remembered');

    console.log(fails.length ? `FAIL:\n  ${fails.join('\n  ')}` : 'PASS: guest opens the builder for the session (data-access=guest); the code still sets ok and is remembered');
    if(fails.length) code = 1;
  } catch (e) { console.error(e); code = 2; }
  finally { try { ws.close(); } catch {} proc.kill(); srv.close(); process.exit(code); }
})();
