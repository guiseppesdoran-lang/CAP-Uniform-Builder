#!/usr/bin/env node
'use strict';
// Browser check for the JROTC/ROTC ribbon menu (run by tests/rotc-ribbon-picker.test.cjs; needs Chrome). LIVE14 E74, Ethan: "make all
// of the jrotc stuff dropdowns like the mil stuff".
//
//   node tests/rotc-ribbon-picker-browser.cjs [--out DIR]
//
// Serves the repo, opens index.html in headless Chrome, sets up a cadet in the men's Class A, opens the ribbon picker the way the page
// does and its JROTC / ROTC menu. Picks the Air Force JROTC program and a ribbon from its dropdown, then the Army JROTC program, narrows
// it with the search and picks a second; both are listed as tiles, checked in State and drawn in the rack. A third comes from "All
// programs"; a fourth is refused with the 11.2.5 message, in the toast and in the menu. Remove takes one off the list and the drawing,
// and a setup saved with JROTC ribbons in the old shape loads into the menu.
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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rotc-ribbons-chrome-'));
  const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--mute-audio', '--remote-debugging-port=0', `--user-data-dir=${dir}`, 'about:blank'], { stdio: 'ignore' });
  const portFile = path.join(dir, 'DevToolsActivePort');
  for(let i = 0; !fs.existsSync(portFile); i++){ if(i > 800) throw new Error('Chrome did not start'); await new Promise(r => setTimeout(r, 25)); }
  await new Promise(r => setTimeout(r, 50));
  const [port, wsPath] = fs.readFileSync(portFile, 'utf8').trim().split('\n');
  const ws = new WebSocket(`ws://127.0.0.1:${port}${wsPath}`);
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
  return { proc, cdp: new Cdp(ws), ws };
}



const AF = 'rotc_air_force_jrotc_color_guard', ARMY = 'rotc_army_jrotc_proficiency', NAVY = 'rotc_navy_jrotc_unit_service_ribbon', USMC = 'rotc_marine_corps_jrotc_color_guard';
const sortJ = a => JSON.stringify([...a].sort());

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
    for(let i = 0; i < 400; i++){ if(await ev('typeof CAPUBUniformView !== "undefined" && typeof capubBuildRotcRibbonMenu === "function"').catch(() => false)) break; await sleep(50); }
    await sleep(800);
    await ev(`window.__settle = async () => { await new Promise(r => setTimeout(r, 150)); for(let i = 0; i < 4; i++){ await CAPUBUniformView.scheduleRender(); await new Promise(r => setTimeout(r, 60)); } }`);
    await ev(`window.__pick = async (id, value) => { const el = document.getElementById(id); el.value = value; el.dispatchEvent(new Event('change', { bubbles: true })); await __settle(); await new Promise(r => setTimeout(r, 500)); }`);
    // A control of the picker window's JROTC / ROTC menu, changed the way a member changes it.
    await ev(`window.__menu = () => document.querySelector('#galleryModalHost details.rotcRibbonMenu')`);
    await ev(`window.__set = async (selector, value) => { const el = __menu().querySelector(selector); el.value = value; el.dispatchEvent(new Event(el.tagName === 'INPUT' ? 'input' : 'change', { bubbles: true })); await __settle(); await new Promise(r => setTimeout(r, 300)); }`);
    await ev(`window.__state = () => {
      const m = __menu();
      return {
        checked: Object.keys(State.ribbonSelections).filter(id => isRotcRibbonId(id) && State.ribbonSelections[id].checked),
        drawn: [...new Set([...document.querySelectorAll('#uniformCanvas svg.uniformSvg g.layer[data-role="ribbon"]')].map(g => String(g.getAttribute('data-calib-key')).replace(/^ribbon:/, '').replace(/#\\d+$/, '')))].filter(id => /^rotc_/.test(id)),
        tiles: m ? [...m.querySelectorAll('.rotcChosenGrid .ribbonSelectorTile')].map(t => t.dataset.ribbonId) : null,
        stray: document.querySelectorAll('#galleryModalHost .ribbonSelectorTile[data-ribbon-id^="rotc_"]').length - (m ? m.querySelectorAll('.rotcChosenGrid .ribbonSelectorTile').length : 0),
        options: m ? [...m.querySelectorAll('.rotcRibbonAddSelect option')].map(o => o.value).filter(Boolean) : null,
        summary: m ? m.querySelector('summary').textContent : '',
        status: m ? m.querySelector('.rotcRibbonStatus').textContent : '',
        open: m ? m.open : false,
        toast: document.getElementById('capubToast')?.textContent || ''
      };
    }`);
    const shot = async name => {
      if(!OUT) return;
      fs.mkdirSync(OUT, { recursive: true });
      const r = await S('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(OUT, `rotc-ribbons-${name}.png`), Buffer.from(r.data, 'base64'));
    };
    const ids = await ev(`Object.fromEntries(CAPUBRotcRibbons.services.map(s => [s.key, CAPUBRotcRibbons.ribbons.filter(r => r.service === s.key).map(r => r.id)]))`);

    await ev(`__pick('membershipType', 'cadet')`);
    await ev(`__pick('jacketSelect', 'male')`);
    await ev(`(async () => { document.querySelector('.uniformOption[data-uniform-id="blues_a"]').click(); await __settle(); })()`);
    // A grade, so the figure is drawn; C/AB implies no ribbon.
    await ev(`__pick('rankSetupSelect', 'C/AB')`);
    await ev(`(async () => { document.getElementById('expandRibbons').click(); await new Promise(r => setTimeout(r, 1500)); })()`);
    await ev(`(async () => { __menu().open = true; await new Promise(r => setTimeout(r, 300)); })()`);
    const s0 = await ev('__state()');
    console.log('menu:', s0.summary, '|', s0.options.length, 'ribbons offered');
    expect(s0.open && s0.tiles && s0.tiles.length === 0, 'the menu opens with no ribbon chosen');
    expect(s0.stray === 0, 'no JROTC/ROTC ribbon is a tile of its own outside the menu');
    expect(s0.options.length === Object.values(ids).flat().length, `All programs offers every JROTC ribbon: ${s0.options.length}`);
    expect(await ev(`[...__menu().querySelectorAll('.rotcProgramSelect option')].map(o => o.textContent).join('|')`) === 'All programs|Air Force JROTC|Army JROTC|Marine Corps JROTC|Navy JROTC', 'the program select lists the programs');

    // ---- 1. Air Force JROTC, from its dropdown. ----
    await ev(`__set('.rotcProgramSelect', 'air-force-jrotc')`);
    const s1 = await ev('__state()');
    expect(sortJ(s1.options) === sortJ(ids['air-force-jrotc']), `the Air Force JROTC program offers its ${ids['air-force-jrotc'].length} ribbons: ${s1.options.length}`);
    await ev(`__set('.rotcRibbonAddSelect', '${AF}')`);
    const s2 = await ev('__state()');
    console.log('after the first:', JSON.stringify({ ...s2, options: s2.options.length }));
    expect(sortJ(s2.checked) === sortJ([AF]) && sortJ(s2.tiles) === sortJ([AF]), `the first is chosen and listed: ${s2.checked} / ${s2.tiles}`);
    expect(!s2.options.includes(AF), 'a chosen ribbon is no longer offered');
    expect(/1 of 3 chosen/.test(s2.summary), `the summary counts it: ${s2.summary}`);

    // ---- 2. Army JROTC, narrowed by the search. ----
    await ev(`__set('.rotcProgramSelect', 'army-jrotc')`);
    await ev(`__set('.rotcRibbonSearch', 'profic')`);
    const s3 = await ev('__state()');
    expect(sortJ(s3.options) === sortJ([ARMY]), `program and search leave one ribbon: ${s3.options.join(', ')}`);
    await ev(`__set('.rotcRibbonAddSelect', '${ARMY}')`);
    const s4 = await ev('__state()');
    console.log('after the second:', JSON.stringify({ ...s4, options: s4.options.length }));
    expect(sortJ(s4.checked) === sortJ([AF, ARMY]) && sortJ(s4.tiles) === sortJ([AF, ARMY]), `two chosen and listed: ${s4.checked} / ${s4.tiles}`);
    expect(sortJ(s4.drawn) === sortJ([AF, ARMY]), `both are drawn in the rack: ${s4.drawn.join(', ')}`);
    expect(JSON.stringify(s4.tiles) === JSON.stringify([AF, ARMY]), 'the tiles follow the order of wear in the data');
    await ev(`__menu().scrollIntoView({ block: 'start' })`);
    await sleep(200);
    await shot('1-two');

    // ---- 3. A third from all programs, then a fourth is refused. ----
    await ev(`__set('.rotcRibbonSearch', '')`);
    await ev(`__set('.rotcProgramSelect', 'ALL')`);
    await ev(`__set('.rotcRibbonAddSelect', '${NAVY}')`);
    const s5 = await ev('__state()');
    expect(sortJ(s5.checked) === sortJ([AF, ARMY, NAVY]), `three chosen: ${s5.checked.join(', ')}`);
    expect(/At most 3 JROTC\/ROTC ribbons may be worn \(CAPR 39-1, 11\.2\.5\)/.test(s5.status), `the menu says the limit is reached: ${s5.status}`);
    await ev(`__set('.rotcRibbonAddSelect', '${USMC}')`);
    const s6 = await ev('__state()');
    console.log('after the fourth:', JSON.stringify({ ...s6, options: s6.options.length }));
    expect(sortJ(s6.checked) === sortJ([AF, ARMY, NAVY]) && sortJ(s6.tiles) === sortJ([AF, ARMY, NAVY]), `the fourth is refused: ${s6.checked.join(', ')}`);
    expect(/At most 3 JROTC\/ROTC ribbons may be worn \(CAPR 39-1, 11\.2\.5\); remove one to add another\./.test(s6.toast), `the toast gives the limit: ${s6.toast}`);
    expect(sortJ(s6.drawn) === sortJ([AF, ARMY, NAVY]), `three drawn: ${s6.drawn.join(', ')}`);
    await ev(`__menu().scrollIntoView({ block: 'start' })`);
    await sleep(200);
    await shot('2-limit');

    // ---- 4. Remove. ----
    await ev(`(async () => { __menu().querySelector('.ribbonSelectorTile[data-ribbon-id="${ARMY}"] .rotcRibbonRemove').click(); await __settle(); await new Promise(r => setTimeout(r, 300)); })()`);
    const s7 = await ev('__state()');
    expect(sortJ(s7.checked) === sortJ([AF, NAVY]) && sortJ(s7.tiles) === sortJ([AF, NAVY]) && sortJ(s7.drawn) === sortJ([AF, NAVY]), `Remove takes it off: ${JSON.stringify({ ...s7, options: s7.options.length })}`);
    expect(s7.options.includes(ARMY), 'a removed ribbon is offered again');

    // ---- 5. A setup saved with the old tiles (the same State shape) loads into the menu. ----
    const saved = await ev(`(() => { const p = CAPUB_V2.collectProfile(); p.ribbonSelections = Object.assign({}, p.ribbonSelections, { '${USMC}': { checked: true, devices: {}, awardValue: 'earned', awardLabel: 'Earned' }, '${NAVY}': { checked: false, devices: {}, awardValue: '', awardLabel: '' } }); return JSON.stringify(p); })()`);
    await ev(`document.getElementById('galleryModalCloseBtn').click()`);
    await ev(`(async () => { CAPUB_V2.applyProfile(JSON.parse(${JSON.stringify(saved)})); await __settle(); document.getElementById('expandRibbons').click(); await new Promise(r => setTimeout(r, 1500)); })()`);
    const s8 = await ev('__state()');
    console.log('after load:', JSON.stringify({ ...s8, options: s8.options.length }));
    expect(sortJ(s8.checked) === sortJ([AF, USMC]) && sortJ(s8.tiles) === sortJ([AF, USMC]) && sortJ(s8.drawn) === sortJ([AF, USMC]), `the saved setup loads: ${JSON.stringify({ ...s8, options: s8.options.length })}`);

    console.log(fails.length ? `FAIL:\n  ${fails.join('\n  ')}` : 'PASS');
    if(fails.length) code = 1;
  } catch (e) { console.error(e); code = 2; }
  finally { try { ws.close(); } catch {} proc.kill(); srv.close(); process.exit(code); }
})();
