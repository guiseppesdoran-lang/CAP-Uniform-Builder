#!/usr/bin/env node
'use strict';
// Browser timing of a badge toggle (not part of `npm test`: needs Chrome). LIVE13 E85 (Ethan: "theres a crazy lag to switch the badges on OCPs where it
// should be 0").
//
//   node tests/badge-toggle-perf-browser.cjs [--runs 6] [--uniforms ocp,blues_b] [--profile DIR]
//
// Serves the repo, opens the page in headless Chrome, sets a senior Capt, male, on each uniform with two badges selected, and toggles a third badge
// on and off through its gallery tile's checkbox (the "Add" box), timing from the click to the drawing on screen (capub:rendered, then a frame).
// The page's composeUniform and buildSvg are wrapped to split the time; --profile writes a CPU profile of the OCP toggles for DevTools.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const args = process.argv.slice(2);
const opt = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const RUNS = Number(opt('--runs')) || 6;
const UNIFORMS = (opt('--uniforms') || 'ocp,blues_b').split(',');
const PROFILE = opt('--profile');
const FRESH = args.includes('--fresh');   // a different badge each toggle (its artwork not loaded yet), instead of one badge on and off
const FRESH_IDS = {
  ocp: ['emt_basic_badge', 'senior_ground_team_badge', 'basic_incident_commander_badge', 'emt_intermediate', 'master_ground_team_badge', 'medical_officer'],
  blues_b: ['communications_technician_badge', 'historian_senior_badge', 'finance_senior_badge', 'safety_senior_badge', 'administration_senior_badge', 'logistics_senior_badge']
};
const CPU = Number(opt('--cpu')) || 1;   // CPU slowdown (Emulation.setCPUThrottlingRate), a phone or a slow laptop
const LATENCY = Number(opt('--latency')) || 0;   // ms of round trip added to every request (Network.emulateNetworkConditions), the live site's distance
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
async function launch(){
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'badge-perf-chrome-'));
  const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--mute-audio', '--remote-debugging-port=0', `--user-data-dir=${dir}`, 'about:blank'], { stdio: 'ignore' });
  const portFile = path.join(dir, 'DevToolsActivePort');
  for(let i = 0; !fs.existsSync(portFile); i++){ if(i > 800) throw new Error('Chrome did not start'); await new Promise(r => setTimeout(r, 25)); }
  await new Promise(r => setTimeout(r, 50));
  const [port, wsPath] = fs.readFileSync(portFile, 'utf8').trim().split('\n');
  const ws = new WebSocket(`ws://127.0.0.1:${port}${wsPath}`);
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
  return { proc, cdp: new Cdp(ws), ws };
}
const median = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };

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
    await S('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });
    await S('Page.enable');
    await S('Network.enable');
    let requests = [];
    cdp.ws.addEventListener('message', m => { const d = JSON.parse(m.data); if(d.method === 'Network.requestWillBeSent' && d.sessionId === sessionId) requests.push(d.params.request.url); });
    if(CPU > 1) await S('Emulation.setCPUThrottlingRate', { rate: CPU });
    if(LATENCY) await S('Network.emulateNetworkConditions', { offline: false, latency: LATENCY, downloadThroughput: -1, uploadThroughput: -1 });
    await S('Page.addScriptToEvaluateOnNewDocument', { source: "try{localStorage.setItem('cap_uniform_builder_access_v1','1')}catch(e){}" });
    await S('Page.navigate', { url: `http://127.0.0.1:${srv.address().port}/index.html` });
    for(let i = 0; i < 400; i++){ if(await ev('typeof CAPUBUniformView !== "undefined" && typeof buildBadgeGallery === "function" && !!document.getElementById("badgeGallery")').catch(() => false)) break; await sleep(50); }
    await sleep(800);
    // Split timers around the engine's two steps.
    await ev(`(() => {
      const E = CAPUBEngine; window.__t = { compose: 0, svg: 0 };
      const c = E.profiles.composeUniform; E.profiles.composeUniform = async function(){ const t = performance.now(); try { return await c.apply(this, arguments); } finally { __t.compose += performance.now() - t; } };
      const s = E.renderSvg.buildSvg; E.renderSvg.buildSvg = async function(){ const t = performance.now(); try { return await s.apply(this, arguments); } finally { __t.svg += performance.now() - t; } };
      return true;
    })()`);
    const results = {};
    for(const uniform of UNIFORMS){
      const setup = { ocp: ['CAPPilot1_FA9D33EA587D8', 'ground_team_basic_badge', 'emt_basic_badge'], blues_b: ['CAPPilot1_FA9D33EA587D8', 'emergency_services_badge', 'communications_technician_badge'] }[uniform];
      await ev(`(async () => {
        State.membership = 'senior'; State.gender = 'male'; State.rank = 'Capt'; State.uniform = ${JSON.stringify(uniform)};
        State.badgeSelections = {}; for(const id of ${JSON.stringify(setup.slice(0, 2))}) State.badgeSelections[id] = { checked: true };
        State.badges = ${JSON.stringify(setup.slice(0, 2))}; State.badgeGalleryExpanded = true;
        fullRender(); buildBadgeGallery(); await CAPUBUniformView.render(); return true;
      })()`);
      await sleep(1500);
      if(PROFILE && uniform === 'ocp'){ await S('Profiler.enable'); await S('Profiler.setSamplingInterval', { interval: 200 }); await S('Profiler.start'); }
      const runs = [];
      for(let i = 0; i < RUNS; i++){
        requests = [];
        const r = await ev(`(async () => {
          const id = ${JSON.stringify(FRESH ? (FRESH_IDS[uniform][i] || setup[2]) : setup[2])};
          const name = getBadgeDisplayName(id);
          const tile = [...document.querySelectorAll('#badgeGallery .galleryTile')].find(t => t.querySelector('.title')?.textContent === name);
          if(!tile) return { error: 'no tile for ' + id };
          const chk = tile.querySelector('.bdChk');
          __t.compose = 0; __t.svg = 0;
          const rendered = new Promise(res => document.addEventListener('capub:rendered', res, { once: true }));
          const t0 = performance.now();
          chk.click();
          const tSync = performance.now() - t0;
          await rendered;
          const tRendered = performance.now() - t0;
          await new Promise(res => requestAnimationFrame(() => setTimeout(res, 0)));
          const tFrame = performance.now() - t0;
          return { on: chk.checked, sync: tSync, rendered: tRendered, frame: tFrame, compose: __t.compose, svg: __t.svg };
        })()`);
        if(r.error) throw new Error(r.error);
        r.requests = requests.length; r.urls = requests.slice();
        runs.push(r);
        await sleep(300);
      }
      if(PROFILE && uniform === 'ocp'){
        const { profile } = await S('Profiler.stop');
        fs.mkdirSync(PROFILE, { recursive: true });
        fs.writeFileSync(path.join(PROFILE, 'ocp-toggle.cpuprofile'), JSON.stringify(profile));
        // Self time per function, top 25.
        const self = new Map(), byId = new Map(profile.nodes.map(n => [n.id, n]));
        const dt = profile.timeDeltas; let total = 0;
        profile.samples.forEach((id, i) => { const n = byId.get(id); const k = `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').slice(-2).join('/')}:${n.callFrame.lineNumber + 1}`; self.set(k, (self.get(k) || 0) + (dt[i] || 0)); total += dt[i] || 0; });
        console.log('top self time (ms) during the OCP toggles:');
        [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25).forEach(([k, v]) => console.log(`  ${(v / 1000).toFixed(1).padStart(8)}  ${k}`));
      }
      results[uniform] = runs;
      const m = k => median(runs.map(r => r[k])).toFixed(1);
      console.log(`${uniform}: ${runs.length} toggles, median ms: click handler ${m('sync')}, to capub:rendered ${m('rendered')}, to next frame ${m('frame')} (compose ${m('compose')}, buildSvg ${m('svg')}); requests per toggle ${m('requests')}`);
      if(args.includes('--urls')) console.log('  ' + runs[runs.length - 1].urls.map(u => u.replace(/^https?:\/\/[^/]+/, '')).join('\n  '));
    }
  } catch (e) { console.error(e); code = 2; }
  finally { try { ws.close(); } catch {} proc.kill(); srv.close(); process.exit(code); }
})();
