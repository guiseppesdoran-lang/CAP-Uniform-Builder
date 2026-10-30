#!/usr/bin/env node
'use strict';
// Browser check for the placement templates (LIVE13 E64; not part of `npm test`: needs Chrome, like tests/quick-strip-browser.cjs).
//
//   node tests/placement-templates-browser.cjs [--out DIR]
//
// Opens the real page, sets up a men's Class A for a Capt with seven ribbons, the Pilot and the Emergency Services badges, clicks the
// Templates control beside Download PNG, and checks the window lists the sides that carry pins (left and right chest, both lapels), each
// with Paper (PDF) as the main button, 3D jig (STL), and the SVG as an "also as SVG" link; then clicks the left chest's three buttons and reads the files Chrome saves:
//   - the SVG is one US Letter page at 1:1 (width 8.5in, height 11in) with the print note and the pin rule,
//   - the PDF is a one-page PDF,
//   - the STL is binary, closed (every edge used twice) and has one 1.5 mm hole per pin the page's plan lists;
// then switches to the ABU and checks its sides are paper-only sewing guides. Until index.html loads js/placement-stl.js and
// js/placement-templates.js, the test server adds the two script tags before js/workspace-ui.js (the page itself is not changed).
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const STL = require('../js/placement-stl.js');

const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const args = process.argv.slice(2);
const OUT = args.indexOf('--out') >= 0 ? args[args.indexOf('--out') + 1] : null;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const TAGS = '<script src="js/placement-stl.js"></script>\n<script src="js/placement-templates.js"></script>\n';

function serve(){
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
      if(!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()){ rsp.writeHead(404); return rsp.end(); }
      rsp.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
      if(p === path.join(ROOT, 'index.html')){
        let html = fs.readFileSync(p, 'utf8');
        if(!/js\/placement-templates\.js/.test(html)) html = html.replace(/<script src="js\/workspace-ui\.js/, TAGS + '$&');
        return rsp.end(html);
      }
      fs.createReadStream(p).pipe(rsp);
    }).listen(0, '127.0.0.1', () => res(srv));
  });
}

class Cdp {
  constructor(ws){ this.ws = ws; this.id = 0; this.pending = new Map(); ws.addEventListener('message', m => { const d = JSON.parse(m.data); const p = this.pending.get(d.id); if(p){ this.pending.delete(d.id); d.error ? p.rej(new Error(d.error.message)) : p.res(d.result); } }); }
  send(method, params, sessionId){ const id = ++this.id; return new Promise((res, rej) => { this.pending.set(id, { res, rej }); this.ws.send(JSON.stringify({ id, method, params: params || {}, ...(sessionId ? { sessionId } : {}) })); }); }
}

async function launch(){
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'templates-chrome-'));
  const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--mute-audio', '--lang=en-US', '--remote-debugging-port=0', `--user-data-dir=${dir}`, 'about:blank'], { stdio: 'ignore' });
  const portFile = path.join(dir, 'DevToolsActivePort');
  for(let i = 0; !fs.existsSync(portFile); i++){ if(i > 800) throw new Error('Chrome did not start'); await new Promise(r => setTimeout(r, 25)); }
  await new Promise(r => setTimeout(r, 50));
  const [port, wsPath] = fs.readFileSync(portFile, 'utf8').trim().split('\n');
  const ws = new WebSocket(`ws://127.0.0.1:${port}${wsPath}`);
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
  return { proc, cdp: new Cdp(ws), ws, dir };
}

(async () => {
  const srv = await serve();
  const { proc, cdp, ws, dir } = await launch();
  const downloads = fs.mkdtempSync(path.join(os.tmpdir(), 'templates-dl-'));
  const fails = [];
  const expect = (ok, msg) => { if(!ok) fails.push(msg); };
  let code = 0;
  try {
    await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    const S = (m, p) => cdp.send(m, p, sessionId);
    const ev = async expr => { const r = await S('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if(r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    await S('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });
    await S('Page.enable');
    await S('Page.addScriptToEvaluateOnNewDocument', { source: "try{localStorage.setItem('cap_uniform_builder_access_v1','1');localStorage.removeItem('capubTemplatePaper')}catch(e){}" });
    await S('Page.navigate', { url: `http://127.0.0.1:${srv.address().port}/index.html` });
    for(let i = 0; i < 400; i++){ if(await ev('typeof CAPUBUniformView !== "undefined" && typeof CAPUBPlacementTemplates !== "undefined"').catch(() => false)) break; await sleep(50); }
    await sleep(800);
    await ev(`window.__settle = async () => { await new Promise(r => setTimeout(r, 150)); for(let i = 0; i < 4; i++){ await CAPUBUniformView.scheduleRender(); await new Promise(r => setTimeout(r, 60)); } }`);
    const RIBBONS = [['meritorious_service_award'], ['commander_commendation_award'], ['cap_achievment_award', 'capub_total_7'], ['cap_leadership_ribbon'], ['cap_membership_ribbon'], ['red_service_ribbon'], ['search_find_ribbon']];
    const setup = (uniform, ribbons, badges) => ev(`(async () => {
      State.membership = 'senior'; State.gender = 'male'; State.rank = 'Capt'; State.uniform = ${JSON.stringify(uniform)};
      State.text = { firstName: 'Pat', lastName: 'Doe', plateLine: '', show: true };
      State.badgeChoices = {}; State.militaryBadges = {}; State.ribbonSelections = {}; State.badgeSelections = {}; State.badges = [];
      for(const [id, value] of ${JSON.stringify(ribbons)}) State.ribbonSelections[id] = { checked: true, devices: {}, awardValue: value || '' };
      for(const id of ${JSON.stringify(badges)}){ State.badgeSelections[id] = { checked: true }; State.badges.push(id); }
      refreshUI(); rebuildRibbonsFromGallery(); rebuildBadgesFromGallery(); fullRender();
      await __settle();
    })()`);
    await setup('blues_a', RIBBONS, ['CAPPilot1_FA9D33EA587D8', 'emergency_services_badge']);
    // The entry sits in the Check & finish step's Finish panel, first after the (footer-bound) download block; the step
    // tab opens that step, and the download itself is the footer's primary action there.
    await ev(`CAPUB_V3.showStep('export')`);
    const control = await ev(`(() => { const b = document.getElementById('placementTemplatesOpen'), d = document.getElementById('downloadImage'); const act = b && b.closest('.finishAction'); return { exists: !!b, inFinish: !!(b && b.closest('#finishPanel')), visible: !!(b && b.offsetParent), label: b && b.textContent, afterDownload: !!(act && act.previousElementSibling && act.previousElementSibling.id === 'downloadAction'), downloadInFooter: !!(d && d.closest('#stepFooter') && !d.hidden), noBar: !document.getElementById('capubCommandBar') }; })()`);
    console.log('control:', JSON.stringify(control));
    expect(control.exists && control.inFinish && control.visible && control.afterDownload && /^Placement templates/.test(control.label), 'the Templates entry is not offered in the Finish panel after the download block');
    expect(control.downloadInFooter && control.noBar, 'the download is not the footer primary on the last step, or the command bar is back');

    await ev(`document.getElementById('placementTemplatesOpen').click()`);
    let list = null;
    for(let i = 0; i < 100; i++){
      list = await ev(`(() => { const d = document.getElementById('placementTemplates'); if(!d || !d.open) return null; const li = [...d.querySelectorAll('li[data-side-key]')]; return li.length ? { paper: (d.querySelector('input[name=ptPaper]:checked') || {}).value, sides: li.map(x => ({ key: x.dataset.sideKey, title: x.querySelector('b').textContent, buttons: [...x.querySelectorAll('button')].map(b => b.textContent) })) } : null; })()`);
      if(list) break; await sleep(50);
    }
    console.log('window:', JSON.stringify(list));
    expect(list && list.paper === 'letter', 'US Letter is not the default paper for an en-US browser');
    const keys = list ? list.sides.map(s => s.key).sort().join(',') : '';
    expect(keys === 'left-chest,left-lapel,right-chest,right-lapel', `sides offered: ${keys}`);
    expect(list && list.sides.every(s => s.buttons.join('|') === 'Paper (PDF)|3D jig (STL)|also as SVG'), 'each side offers Paper (PDF) first, then 3D jig (STL), then the SVG as a link');
    if(OUT){ fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, 'templates-window.png'), Buffer.from((await S('Page.captureScreenshot', { format: 'png' })).data, 'base64')); }

    const waitFile = async re => { for(let i = 0; i < 200; i++){ const f = fs.readdirSync(downloads).find(n => re.test(n) && !/\.crdownload$/.test(n)); if(f) return path.join(downloads, f); await sleep(50); } return null; };
    for(const what of ['svg', 'pdf', 'stl']) await ev(`document.querySelector('#placementTemplates button[data-side="left-chest"][data-what="${what}"]').click()`);
    const svgFile = await waitFile(/left-chest_paper-letter\.svg$/), pdfFile = await waitFile(/left-chest_paper-letter\.pdf$/), stlFile = await waitFile(/left-chest_jig\.stl$/);
    console.log('files:', [svgFile, pdfFile, stlFile].map(f => f && `${path.basename(f)} ${fs.statSync(f).size} B`).join(', '));
    expect(svgFile && pdfFile && stlFile, 'not all three files were saved');
    if(svgFile){
      const svg = fs.readFileSync(svgFile, 'utf8');
      expect(/<svg [^>]*width="8\.5in" height="11in"/.test(svg), 'the SVG is not a 1:1 US Letter page');
      expect(/PRINT AT 100% \(ACTUAL SIZE\), NO SCALING/.test(svg) && /Pin holes estimated from item width/.test(svg), 'the SVG lacks the print note or the pin rule');
      if(OUT) fs.copyFileSync(svgFile, path.join(OUT, path.basename(svgFile)));
    }
    if(pdfFile){ const pdf = fs.readFileSync(pdfFile, 'latin1'); expect(pdf.startsWith('%PDF-1.4') && /\/Count 1 /.test(pdf) && /\/MediaBox \[0 0 612 792\]/.test(pdf), 'the PDF is not one US Letter page'); }
    if(stlFile){
      const parsed = STL.parseBinaryStl(new Uint8Array(fs.readFileSync(stlFile)));
      const stats = STL.meshStats(parsed.triangles);
      const pins = await ev(`(async () => { const p = await CAPUBPlacementTemplates.plan(CAPUBUniformView.scene, (() => { const E = CAPUBEngine; let s; return async id => { s = s || E.core.createSpecStore(await fetch('images/MANIFEST.json').then(r => r.json()), q => fetch('images/' + q).then(r => r.json())); return s.load(id); }; })(), { uniform: State.uniform }); const side = p.sides.find(x => x.key === 'left-chest'); return side.items.reduce((a, i) => a + i.pins.length, 0); })()`);
      const holeWalls = parsed.triangles.filter(t => Math.abs(t.normal[2]) < 1e-6 && t.v.some(v => Math.abs(v[2]) < 1e-6)).length;
      console.log('stl:', JSON.stringify(stats), 'pins', pins, 'triangles', parsed.triangles.length);
      expect(stats.watertight && stats.volume > 0, 'the STL is not a closed solid');
      expect(pins === 6, `left chest pins: ${pins}`);
      expect(holeWalls > 0, 'no walls in the STL');
    }

    // The ABU: sewn items, a sewing guide on paper and no jig.
    await ev(`document.getElementById('placementTemplates').close()`);
    await setup('abu', [], ['CAPPilot1_FA9D33EA587D8', 'ground_team_basic_badge']);
    await ev(`document.getElementById('placementTemplatesOpen').click()`);
    let abu = null;
    for(let i = 0; i < 100; i++){ abu = await ev(`(() => { const li = [...document.querySelectorAll('#placementTemplates li[data-side-key]')]; return li.length && /Sewn on/.test(li[0].textContent) ? li.map(x => ({ key: x.dataset.sideKey, text: x.querySelector('small').textContent, buttons: [...x.querySelectorAll('button')].map(b => b.textContent) })) : null; })()`); if(abu) break; await sleep(50); }
    console.log('abu:', JSON.stringify(abu));
    expect(abu && abu.length >= 2 && abu.every(s => s.buttons.join('|') === 'Paper (PDF)|also as SVG' && /paper sewing guide only, no 3D jig/.test(s.text)), 'the ABU sides are not paper-only sewing guides');
    if(OUT) fs.writeFileSync(path.join(OUT, 'templates-window-abu.png'), Buffer.from((await S('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  } catch(e){
    fails.push(e.stack || String(e));
  } finally {
    try{ ws.close(); }catch(e){ /* closing */ }
    proc.kill('SIGKILL');
    srv.close();
    try{ fs.rmSync(dir, { recursive: true, force: true }); fs.rmSync(downloads, { recursive: true, force: true }); }catch(e){ /* temp */ }
  }
  if(fails.length){ console.error('FAIL\n  ' + fails.join('\n  ')); code = 1; } else console.log('PASS placement templates in the browser');
  process.exit(code);
})();
