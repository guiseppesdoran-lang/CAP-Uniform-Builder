#!/usr/bin/env node
'use strict';
// Browser check for the usage counts and the feedback dialog (LIVE13 E69, E70; not part of `npm test`: needs Chrome).
//
//   node tests/telemetry-browser.cjs [--out DIR]
//
// Serves the repository with a stub API that records every body posted to /api/events and /api/feedback, opens the page in
// headless Chrome, builds a men's Class A for a Capt with a name on the nametag ("Zebulon Quixote"), downloads the PNG, sends
// feedback with the setup attached, and then a second feedback while the stub answers 503. Checks the posted bodies carry the
// right event names and fields and that no posted byte holds the name. With --out, screenshots of the dialog: empty, filled,
// thank-you and error.
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
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const NAME = ['Zebulon', 'Quixote'];

const posted = [];
let apiDown = false;
function serve(){
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      const url = req.url.split('?')[0];
      if(url.startsWith('/api/')){
        const chunks = [];
        req.on('data', c => chunks.push(c));
        req.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          posted.push({ path: url, method: req.method, text, contentType: req.headers['content-type'] || '' });
          if(apiDown && url === '/api/feedback'){ rsp.writeHead(503, { 'Content-Type': 'application/json' }); return rsp.end('{"error":"down"}'); }
          const status = url === '/api/feedback' ? 201 : 202;
          rsp.writeHead(status, { 'Content-Type': 'application/json' });
          rsp.end(url === '/api/feedback' ? '{"ok":true,"id":"fb_000000000001"}' : '{"ok":true}');
        });
        return;
      }
      const p = path.join(ROOT, decodeURIComponent(url).replace(/\/$/, '/index.html'));
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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'telemetry-chrome-'));
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
  const downloads = fs.mkdtempSync(path.join(os.tmpdir(), 'telemetry-dl-'));
  const fails = [];
  const check = (ok, msg) => { if(!ok) fails.push(msg); };
  let code = 0;
  try{
    await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    const S = (m, p) => cdp.send(m, p, sessionId);
    const ev = async expr => { const r = await S('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if(r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const shot = async (name, sel) => {
      if(!OUT) return;
      fs.mkdirSync(OUT, { recursive: true });
      const rect = await ev(`(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return { x: Math.max(0, r.x - 16), y: Math.max(0, r.y - 16), width: r.width + 32, height: r.height + 32 }; })()`);
      const r = await S('Page.captureScreenshot', { format: 'png', clip: Object.assign({ scale: 1 }, rect) });
      fs.writeFileSync(path.join(OUT, `feedback-${name}.png`), Buffer.from(r.data, 'base64'));
    };
    await S('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 2, mobile: false });
    await S('Page.enable');
    await S('Page.addScriptToEvaluateOnNewDocument', { source: "try{localStorage.setItem('cap_uniform_builder_access_v1','1');localStorage.removeItem('capub_visitor_v1')}catch(e){}" });
    await S('Page.navigate', { url: `http://127.0.0.1:${srv.address().port}/index.html` });
    for(let i = 0; i < 400; i++){ if(await ev('typeof CAPUBUniformView !== "undefined" && !!window.CAPUB_TELEMETRY && !!document.getElementById("feedbackOpen")').catch(() => false)) break; await sleep(50); }
    await sleep(600);
    check(await ev('CAPUB_TELEMETRY.enabled === true'), 'telemetry is not on');

    // 1. A build with a name on the nametag, left to settle.
    await ev(`(async () => {
      State.membership = 'senior'; State.gender = 'male'; State.rank = 'Capt'; State.uniform = 'blues_a';
      State.text = { firstName: ${JSON.stringify(NAME[0])}, lastName: ${JSON.stringify(NAME[1])}, plateLine: 'Ohio', show: true };
      document.getElementById('capubV2FirstName').value = ${JSON.stringify(NAME[0])};
      document.getElementById('capubV2LastName').value = ${JSON.stringify(NAME[1])};
      State.ribbonSelections = { red_service_ribbon: { checked: true, devices: {}, awardValue: '' } };
      State.badgeSelections = { emergency_services_badge: { checked: true } }; State.badges = ['emergency_services_badge'];
      refreshUI(); rebuildRibbonsFromGallery(); rebuildBadgesFromGallery(); fullRender();
      await CAPUBUniformView.render();
    })()`);
    for(let i = 0; i < 60 && !(await ev('!!CAPUBUniformView.scene')); i++) await sleep(100);
    const drawnName = await ev(`(CAPUBUniformView.scene.layers || []).some(l => l.role === 'text' && String(l.text || '').toUpperCase().includes(${JSON.stringify(NAME[1].toUpperCase())}))`);
    check(drawnName, 'the nametag does not show the test name, so the check below proves nothing');
    await sleep(3200);

    // 2. PNG download.
    await ev(`document.getElementById('downloadImage').click()`);
    await sleep(2500);

    // 3. Feedback with the setup attached.
    await ev(`document.getElementById('feedbackOpen').click()`);
    await sleep(300);
    const dlg = await ev(`(() => { const d = document.getElementById('feedbackDialog'); return { open: d.open, link: document.getElementById('feedbackOpen').previousSibling.textContent, about: document.getElementById('feedbackOpen').previousElementSibling.id, focus: document.activeElement.id }; })()`);
    check(dlg.open && dlg.about === 'aboutOpen' && dlg.focus === 'feedbackMessage', 'the Feedback link beside About does not open the dialog with the message focused: ' + JSON.stringify(dlg));
    await shot('0-empty', '#feedbackDialog');
    await ev(`document.getElementById('feedbackSend').click()`);
    await sleep(150);
    check(await ev(`!document.getElementById('feedbackError').hidden && /Write a message first/.test(document.getElementById('feedbackError').textContent)`), 'an empty message is not stopped');
    check(!posted.some(p => p.path === '/api/feedback'), 'an empty message was posted');
    await ev(`(() => {
      const m = document.getElementById('feedbackMessage'); m.value = 'The ES badge sits a little low on the Class A pocket. Otherwise great!'; m.dispatchEvent(new Event('input', { bubbles: true }));
      document.getElementById('feedbackContact').value = 'zq_flyer (Discord)';
      document.getElementById('feedbackSetup').checked = true;
    })()`);
    await shot('1-filled', '#feedbackDialog');
    await ev(`document.getElementById('feedbackSend').click()`);
    for(let i = 0; i < 40 && await ev(`document.getElementById('feedbackThanks').hidden`); i++) await sleep(50);
    check(!(await ev(`document.getElementById('feedbackThanks').hidden`)), 'no thank-you after sending');
    await shot('2-thanks', '#feedbackDialog');
    await ev(`document.getElementById('feedbackDone').click()`);

    // 4. The API is down: the error state keeps the message.
    apiDown = true;
    await ev(`document.getElementById('feedbackOpen').click()`);
    await ev(`(() => { const m = document.getElementById('feedbackMessage'); m.value = 'Second note'; m.dispatchEvent(new Event('input', { bubbles: true })); document.getElementById('feedbackSend').click(); })()`);
    for(let i = 0; i < 40 && await ev(`document.getElementById('feedbackError').hidden`); i++) await sleep(50);
    const err = await ev(`({ text: document.getElementById('feedbackError').textContent, kept: document.getElementById('feedbackMessage').value, thanks: !document.getElementById('feedbackThanks').hidden })`);
    check(/was not sent/.test(err.text) && err.kept === 'Second note' && !err.thanks, 'the error state is wrong: ' + JSON.stringify(err));
    await shot('3-error', '#feedbackDialog');
    await ev(`document.getElementById('feedbackCancel').click()`);

    // 5. Flush and read what was posted.
    await ev('CAPUB_TELEMETRY.flush()');
    await sleep(800);
    const events = posted.filter(p => p.path === '/api/events').flatMap(p => { const b = JSON.parse(p.text); return b.events.map(e => Object.assign({ vid: b.vid, sid: b.sid }, e)); });
    const names = events.map(e => e.name);
    console.log('events:', names.join(', '));
    for(const n of ['visit', 'build', 'png_download', 'feedback_sent']) check(names.includes(n), `no ${n} event`);
    check(names.filter(n => n === 'build').length === 1, `one settled build, not ${names.filter(n => n === 'build').length}`);
    const build = events.find(e => e.name === 'build');
    check(build && build.data.uniform === 'blues_a' && build.data.grade === 'Capt' && build.data.membership === 'senior' && build.data.gender === 'male', 'the build event lacks the setup: ' + JSON.stringify(build && build.data));
    check(build && build.data.counts.ribbons === 1 && build.data.counts.badges === 1 && build.data.nameShown === true, 'the build counts are wrong: ' + JSON.stringify(build && build.data.counts));
    const png = events.find(e => e.name === 'png_download');
    check(png && png.data.ok === true && png.data.uniform === 'blues_a', 'the png_download event is wrong');
    check(events.every(e => /^[a-z0-9]{20}$/.test(e.vid) && /^[a-z0-9]{16}$/.test(e.sid)), 'events lack the random ids');
    const fb = posted.filter(p => p.path === '/api/feedback').map(p => JSON.parse(p.text));
    check(fb.length === 2, `two feedback posts (one refused), not ${fb.length}`);
    check(fb[0] && fb[0].contact === 'zq_flyer (Discord)' && fb[0].setup && fb[0].setup.uniform === 'blues_a' && fb[0].setup.counts.badges === 1, 'the feedback lacks the contact or the setup');
    check(fb[1] && !fb[1].setup, 'the second feedback (box unticked) carried a setup');
    check(posted.every(p => p.method === 'POST'), 'a request that is not a POST');
    // Not one byte posted holds the name.
    for(const p of posted) for(const w of NAME) check(!p.text.toLowerCase().includes(w.toLowerCase()), `${p.path} carried "${w}"`);
    console.log(`posted: ${posted.length} requests, ${events.length} events, ${fb.length} feedback`);
    console.log(fails.length ? `FAIL:\n  ${fails.join('\n  ')}` : 'PASS telemetry and feedback in the browser');
    if(fails.length) code = 1;
  }catch(e){ console.error(e); code = 2; }
  finally{ try{ ws.close(); }catch{} proc.kill(); srv.close(); fs.rmSync(downloads, { recursive: true, force: true }); process.exit(code); }
})();
