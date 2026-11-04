#!/usr/bin/env node
'use strict';
// Browser check for the Items step's lists and the command insignia row (not part of `npm test`: needs Chrome).
//
//   node tests/items-summary-browser.cjs [--out DIR] [--tag name] [--width 1280]
//
// Serves the repo, opens the page in headless Chrome, chooses badges on the Class A and checks that the Badges card lists each by name with the
// place the drawing put it, names the badge left off with the reason and the paragraph, and that the command insignia pin can be set to
// current or graduated commander from the Items step without opening the chooser (CAPR 39-1, 10.2.5) and the drawing follows. Then the same
// for patches on the ABU. Screenshots of the two cards go to --out.
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
  const fails = [];
  try {
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    const S = (m, p) => cdp.send(m, p, sessionId);
    const ev = async expr => { const r = await S('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if(r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const width = Number(opt('--width')) || 1280;
    await S('Emulation.setDeviceMetricsOverride', { width, height: width < 700 ? 2600 : 2300, deviceScaleFactor: 2, mobile: width < 700 });
    await S('Page.enable');
    await S('Page.addScriptToEvaluateOnNewDocument', { source: "try{localStorage.setItem('cap_uniform_builder_access_v1','1')}catch(e){}" });
    await S('Page.navigate', { url: `http://127.0.0.1:${srv.address().port}/index.html` });
    for(let i = 0; i < 400; i++){ if(await ev('typeof CAPUBUniformView !== "undefined" && !!document.querySelector("#groupBadges")').catch(() => false)) break; await sleep(50); }
    await sleep(800);
    const shot = async (sel, name) => {
      if(!OUT) return;
      fs.mkdirSync(OUT, { recursive: true });
      const r0 = await ev(`(() => { const h = document.querySelector(${JSON.stringify(sel)}); h.scrollIntoView({ block: 'start' }); const r = h.getBoundingClientRect(); return { x: Math.max(0, r.x - 8), y: r.y + window.scrollY - 8, width: r.width + 16, height: r.height + 16 }; })()`);
      await sleep(250);
      const r = await S('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: Object.assign({ scale: 1 }, r0) });
      fs.writeFileSync(path.join(OUT, `${TAG}-${name}-${width}.png`), Buffer.from(r.data, 'base64'));
    };
    const rows = id => ev(`[...document.querySelectorAll('#${id} .itemSummaryRow')].map(li => ({ name: li.querySelector('.itemSummaryName').textContent, place: li.querySelector('.itemSummaryPlace').textContent, why: (li.querySelector('.itemSummaryWhy') || {}).textContent || '', notShown: li.classList.contains('notShown') }))`);
    const set = async code => { await ev(`(async () => { ${code}; await CAPUBUniformView.render(); })()`); await sleep(700); };

    const ids = ['CAPPilot1_FA9D33EA587D8', 'ground_team_basic_badge', 'communications_technician_badge', 'emergency_services_badge', 'information_technology_technician_badge'];
    await set(`State.membership = 'senior'; State.gender = 'male'; State.rank = 'Capt'; State.uniform = 'blues_a'; State.badges = ${JSON.stringify(ids)}; State.badgeChoices = {}; State.commandInsignia = { graduatedCommander: false }; for(const id of ${JSON.stringify(ids)}){ State.badgeSelections[id] = State.badgeSelections[id] || { checked: false }; State.badgeSelections[id].checked = true; } if(typeof refreshUI === 'function') refreshUI()`);
    await ev(`CAPUB_V3.showStep('items')`); await sleep(400);
    let list = await rows('badgeSummary');
    console.log(JSON.stringify(list, null, 1));
    const by = n => list.find(r => r.name === n);
    if(list.length !== 5) fails.push(`the Badges card should list the 5 chosen badges, it lists ${list.length}`);
    if(!by('Pilot Badge') || !/^Above the Ground Team Badge$/.test(by('Pilot Badge').place)) fails.push('the pilot badge should be above the Ground Team badge');
    if(!by('Ground Team Badge') || !/^Above the (ribbons|left pocket)$/.test(by('Ground Team Badge').place)) fails.push('the Ground Team badge should be above the ribbons or the pocket');
    if(!by('Communications Technician Badge') || !/pocket|left/i.test(by('Communications Technician Badge').place)) fails.push('the communications badge should name its place');
    const gone = list.filter(r => r.notShown);
    if(gone.length !== 1 || gone[0].name !== 'Information Technology Technician Badge' || !/CAPR 39-1, 4\.1\.5\.2\.2\.4/.test(gone[0].why)) fails.push('the badge with no place left should be named with the paragraph');
    await shot('#groupBadges', 'badges');
    // The command pin row: visible on the Items step, no chooser needed.
    const rowVisible = await ev(`(() => { const r = document.getElementById('commandInsigniaRow'); const b = r.getBoundingClientRect(); return !r.classList.contains('hidden') && b.height > 0 && r.closest('#stepGroup-items') && !document.getElementById('stepGroup-items').hidden; })()`);
    if(!rowVisible) fails.push('the command insignia row is not visible on the Items step');
    const state = () => ev(`({ chosen: State.badges.includes('squadron_commander_badge'), grad: !!State.commandInsignia.graduatedCommander, text: document.getElementById('commandInsigniaState').textContent, radio: (document.querySelector('input[name=commandInsignia]:checked') || {}).value })`);
    const pickCmd = async v => { await ev(`document.querySelector('input[name=commandInsignia][value=${v}]').click()`); await sleep(1200); };
    let st = await state();
    if(st.chosen || st.radio !== 'none') fails.push('the row should start at Not worn: ' + JSON.stringify(st));
    await pickCmd('current');
    st = await state(); console.log('current:', JSON.stringify(st));
    if(!st.chosen || st.grad || st.radio !== 'current' || !/Current commander: above the name tag/.test(st.text)) fails.push('Current commander should choose the pin over the name tag: ' + JSON.stringify(st));
    list = await rows('badgeSummary');
    if(!list.some(r => /Squadron Commander/.test(r.name) && r.place === 'Above the name tag')) fails.push('the list should show the pin above the name tag');
    const drawnOn = await ev(`CAPUBUniformView.scene.layers.some(l => /squadron_commander_badge:ON/.test(l.key || ''))`);
    if(!drawnOn) fails.push('the drawing should carry the current commander pin');
    await shot('#groupBadges', 'badges-commander-current');
    await pickCmd('graduated');
    st = await state(); console.log('graduated:', JSON.stringify(st));
    if(!st.chosen || !st.grad || st.radio !== 'graduated' || !/Graduated commander: below the name tag/.test(st.text)) fails.push('Graduated commander should choose the pin under the name tag: ' + JSON.stringify(st));
    if(!await ev(`CAPUBUniformView.scene.layers.some(l => /squadron_commander_badge:UN/.test(l.key || ''))`)) fails.push('the drawing should carry the graduated commander pin');
    await shot('#groupBadges', 'badges-commander-graduated');
    // The chooser's own control still works and agrees.
    await ev(`document.getElementById('expandBadges').click()`); await sleep(600);
    const tick = await ev(`(() => { const t = document.querySelector('#galleryModalHost .cmdGradChk'); return t ? t.checked : null; })()`);
    if(tick !== true) fails.push('the chooser\'s Graduated commander box should agree with the row: ' + tick);
    await ev(`(() => { const t = document.querySelector('#galleryModalHost .cmdGradChk'); t.click(); })()`); await sleep(900);
    st = await state();
    if(st.grad || st.radio !== 'current') fails.push('unticking the chooser box should make the row Current commander: ' + JSON.stringify(st));
    await ev(`document.querySelector('#galleryModalOverlay .modalClose, #galleryModalDone, #galleryModalOverlay button')?.click()`); await sleep(300);
    await ev(`State.badges = State.badges.filter(id => id !== 'squadron_commander_badge'); document.getElementById('galleryModalOverlay')?.classList.remove('open')`);
    await pickCmd('none');
    st = await state();
    if(st.chosen || st.radio !== 'none') fails.push('Not worn should clear the pin: ' + JSON.stringify(st));
    // A colonel cannot wear it: the choices are off.
    await set(`State.rank = 'Col'; if(typeof refreshUI === 'function') refreshUI()`);
    const disabled = await ev(`[...document.querySelectorAll('input[name=commandInsignia]')].map(i => i.disabled)`);
    if(JSON.stringify(disabled) !== '[false,true,true]') fails.push('for a colonel only Not worn is open: ' + JSON.stringify(disabled));
    // A cadet has no pin to set.
    await set(`State.membership = 'cadet'; State.rank = 'C/Capt'; if(typeof refreshUI === 'function') refreshUI()`);
    if(!await ev(`document.getElementById('commandInsigniaRow').classList.contains('hidden')`)) fails.push('a cadet should not be offered the command pin');

    // Patches on the ABU: the unit patch and a school patch fight for the one pocket.
    await set(`State.membership = 'senior'; State.rank = 'Capt'; State.uniform = 'abu'; State.badges = []; State.patches = ['ner_patch', 'comms_patch', 'check_pilot_patch']; updateAvailabilityUI(null); if(typeof refreshUI === 'function') refreshUI()`);
    list = await rows('patchSummary');
    console.log(JSON.stringify(list, null, 1));
    if(list.length < 2 || list.some(r => !r.notShown && !r.place)) fails.push('every patch the drawing wears should name its place');
    if(!list.some(r => r.notShown && /CAPR 39-1/.test(r.why))) fails.push('a patch left off should say why with the paragraph');
    await shot('#groupPatches', 'patches');
  }catch(e){ console.error(e); code = 1; }
  finally { try{ ws.close(); }catch(e){} proc.kill(); srv.close(); }
  if(fails.length){ console.error('FAIL:\n - ' + fails.join('\n - ')); code = 1; } else if(!code) console.log('OK');
  process.exit(code);
})();
