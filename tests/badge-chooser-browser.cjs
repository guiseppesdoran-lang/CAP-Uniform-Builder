#!/usr/bin/env node
'use strict';
// Browser check for the Badges panel's chooser (not part of `npm test`: needs Chrome).
//
//   node tests/badge-chooser-browser.cjs [--out DIR] [--tag name] [--width 420]
//
// Serves the repo, opens the page in headless Chrome, selects five badges on the Class A (two aviation badges compete for the one aviation
// place, three specialty badges for the left pocket, the right pocket and the place over the nametag), and checks the chooser: a plain heading
// row per position, one select per place, no fieldset. Picks a badge for a place and checks the engine moved it there. Writes a screenshot of
// the chooser when --out is given (LIVE7-1, Ethan: "the headers for these look bad ... pick the badges on the left and right manually").
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
    await S('Emulation.setDeviceMetricsOverride', { width: Number(opt('--width')) || 1280, height: 1000, deviceScaleFactor: 2, mobile: false });
    await S('Page.enable');
    await S('Page.addScriptToEvaluateOnNewDocument', { source: "try{localStorage.setItem('cap_uniform_builder_access_v1','1')}catch(e){}" });
    await S('Page.navigate', { url: `http://127.0.0.1:${srv.address().port}/index.html` });
    for(let i = 0; i < 400; i++){ if(await ev('typeof CAPUBUniformView !== "undefined" && !!document.querySelector("#groupBadges")').catch(() => false)) break; await sleep(50); }
    await sleep(800);
    const shot = async name => {
      if(!OUT) return;
      fs.mkdirSync(OUT, { recursive: true });
      const rect = await ev(`(() => { const h = document.getElementById('badgeChooser'); h.scrollIntoView({ block: 'start' }); const r = h.getBoundingClientRect(); return { x: Math.max(0, r.x - 12), y: Math.max(0, r.y - 12), width: r.width + 24, height: r.height + 24 }; })()`);
      await sleep(200);
      const r = await S('Page.captureScreenshot', { format: 'png', clip: Object.assign({ scale: 1 }, rect) });
      fs.writeFileSync(path.join(OUT, `${TAG}-${name}.png`), Buffer.from(r.data, 'base64'));
    };
    const ids = ['CAPPilot1_FA9D33EA587D8', 'observer_badge', 'emergency_services_badge', 'communications_technician_badge', 'information_technology_technician_badge'];
    await ev(`(async () => {
      State.membership = 'senior'; State.gender = 'male'; State.rank = 'Capt'; State.uniform = 'blues_a';
      State.badges = ${JSON.stringify(ids)}; State.badgeChoices = {};
      await CAPUBUniformView.render();
    })()`);
    await sleep(600);
    const inspect = () => ev(`(() => {
      const host = document.getElementById('badgeChooser');
      const groups = [...host.querySelectorAll('.badgeChooserGroup')].map(g => ({
        position: g.dataset.position, tag: g.tagName, heading: g.querySelector('.badgeChooserTitle')?.textContent, count: g.querySelector('.badgeChooserCount')?.textContent,
        selects: [...g.querySelectorAll('select')].map(s => ({ slot: s.closest('.badgeChooserSlot').dataset.slot, label: s.closest('.badgeChooserSlot').querySelector('.badgeChooserSlotName').textContent, value: s.value, status: s.closest('.badgeChooserSlot').querySelector('.badgeChooserTag').textContent })),
        radios: g.querySelectorAll('input[type=radio]').length
      }));
      return { hidden: host.classList.contains('hidden'), fieldsets: host.querySelectorAll('fieldset,legend').length, groups };
    })()`);
    const a = await inspect();
    console.log(JSON.stringify(a, null, 1));
    const fails = [];
    if(a.hidden) fails.push('the chooser is hidden');
    if(a.fieldsets) fails.push('the chooser still uses a fieldset or legend');
    const pocket = a.groups.find(g => g.position === 'pocket'), aviation = a.groups.find(g => g.position === 'aviation');
    if(!pocket || pocket.selects.length !== 3) fails.push('the pocket group should have one select per place (3)');
    if(!aviation || aviation.radios !== 2) fails.push('the aviation group should have a radio per competing badge (2)');
    await shot('0-default');
    // Pick the IT badge for the left pocket; the engine puts it there and the ES badge takes its old place (swap).
    await ev(`(() => { const s = document.querySelector('#badgeChooser .badgeChooserSlot[data-slot="left-pocket"] select'); s.value = 'information_technology_technician_badge'; s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await sleep(1200);
    const b = await inspect();
    const after = b.groups.find(g => g.position === 'pocket');
    const got = Object.fromEntries(after.selects.map(s => [s.slot, s.value]));
    console.log('after the pick:', JSON.stringify(got), JSON.stringify(await ev('State.badgeChoices')));
    if(got['left-pocket'] !== 'information_technology_technician_badge') fails.push('the left pocket did not take the picked badge');
    if(new Set(Object.values(got)).size !== 3) fails.push('a badge sits in two places');
    const drawn = await ev(`CAPUBUniformView.scene.layers.filter(l => l.role === 'badge').map(l => l.key.replace('badge:', '') + '@' + (l.x + l.w / 2).toFixed(1))`);
    console.log('drawn:', drawn.join(', '));
    if(!drawn.some(d => d.startsWith('information_technology_technician_badge@') && Number(d.split('@')[1]) > 15)) fails.push('the IT badge is not drawn on the left pocket');
    await shot('1-picked');
    console.log(fails.length ? `FAIL:\n  ${fails.join('\n  ')}` : 'PASS');
    if(fails.length) code = 1;
  } catch (e) { console.error(e); code = 2; }
  finally { try { ws.close(); } catch {} proc.kill(); srv.close(); process.exit(code); }
})();
