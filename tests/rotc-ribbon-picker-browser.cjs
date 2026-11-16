#!/usr/bin/env node
'use strict';
// Browser check for the JROTC/ROTC ribbon menu (run by tests/rotc-ribbon-picker.test.cjs; needs Chrome). LIVE14 E74, Ethan: "make all
// of the jrotc stuff dropdowns like the mil stuff".
//
//   node tests/rotc-ribbon-picker-browser.cjs [--out DIR]
//
// Serves the repo, opens index.html in headless Chrome, sets up a cadet in the men's Class A, opens the ribbon picker the way the page does and its JROTC / ROTC menu: the
// ribbons are picture tiles, the program and the search narrow them. Tapping the Air Force JROTC color guard tile and then, narrowed to the Army program by the search, the Army
// proficiency tile chooses two: both are checked in State and drawn in the rack, and the first stays in sight whatever the narrowing says. A third comes from "All programs"; a
// fourth is refused with the 11.2.5 message, in the toast and in the menu. A second tap takes one off the drawing, and a setup saved with JROTC ribbons in the old shape loads
// into the menu with its tiles on.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { launchChrome } = require('../scripts/lib-chrome.cjs');

const ROOT = path.join(__dirname, '..');
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
  const chrome = await launchChrome({ prefix: 'rotc-ribbons' });
  return { cdp: new Cdp(chrome.ws), ws: chrome.ws, chrome };
}



const AF = 'rotc_air_force_jrotc_color_guard', ARMY = 'rotc_army_jrotc_proficiency', NAVY = 'rotc_navy_jrotc_unit_service_ribbon', USMC = 'rotc_marine_corps_jrotc_color_guard';
const sortJ = a => JSON.stringify([...a].sort());

(async () => {
  const srv = await serve();
  const { chrome, cdp, ws } = await launch();
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
    for(let i = 0; i < 400; i++){ if(await ev('typeof CAPUBUniformView !== "undefined" && typeof CAPUBPickLists === "object"').catch(() => false)) break; await sleep(50); }
    await sleep(800);
    await ev(`window.__settle = async () => { await new Promise(r => setTimeout(r, 150)); for(let i = 0; i < 4; i++){ await CAPUBUniformView.scheduleRender(); await new Promise(r => setTimeout(r, 60)); } }`);
    await ev(`window.__pick = async (id, value) => { const el = document.getElementById(id); el.value = value; el.dispatchEvent(new Event('change', { bubbles: true })); await __settle(); await new Promise(r => setTimeout(r, 500)); }`);
    // A control of the picker window's JROTC / ROTC menu, changed the way a member changes it.
    await ev(`window.__menu = () => document.querySelector('#galleryModalHost details.rotcRibbonMenu')`);
    await ev(`window.__set = async (selector, value) => { const el = __menu().querySelector(selector); el.value = value; el.dispatchEvent(new Event(el.tagName === 'INPUT' ? 'input' : 'change', { bubbles: true })); await __settle(); await new Promise(r => setTimeout(r, 300)); }`);
    await ev(`window.__tap = async id => { const c = [...__menu().querySelectorAll('.vpCell')].find(c => c.dataset.value === id); c.querySelector('.vpOption').click(); await __settle(); await new Promise(r => setTimeout(r, 500)); }`);
    await ev(`window.__state = () => {
      const m = __menu();
      const cells = m ? [...m.querySelectorAll('.vpCell')].filter(c => !c.hidden) : [];
      return {
        checked: Object.keys(State.ribbonSelections).filter(id => isRotcRibbonId(id) && State.ribbonSelections[id].checked),
        drawn: [...new Set([...document.querySelectorAll('#uniformCanvas svg.uniformSvg g.layer[data-role="ribbon"]')].map(g => String(g.getAttribute('data-calib-key')).replace(/^ribbon:/, '').replace(/#\\d+$/, '')))].filter(id => /^rotc_/.test(id)),
        shown: cells.map(c => c.dataset.value),
        pressed: cells.filter(c => c.querySelector('.vpOption').getAttribute('aria-pressed') === 'true').map(c => c.dataset.value),
        stray: [...document.querySelectorAll('#galleryModalHost .vpCell')].filter(c => !(m && m.contains(c)) && /^rotc_/.test(c.dataset.value)).length,
        boxes: document.querySelectorAll('#galleryModalHost input[type=checkbox],#galleryModalHost input[type=radio]').length,
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
    const total = Object.values(ids).flat().length;
    const s0 = await ev('__state()');
    console.log('menu:', s0.summary, '|', s0.shown.length, 'tiles');
    expect(s0.open && s0.pressed.length === 0, 'the menu opens with no ribbon chosen');
    expect(s0.stray === 0, 'no JROTC/ROTC ribbon is a tile of its own outside the menu');
    expect(s0.shown.length === total, `All programs shows every JROTC ribbon: ${s0.shown.length}`);
    expect(s0.boxes === 0, `no checkbox or radio button in the picker: ${s0.boxes}`);
    expect(await ev(`[...__menu().querySelectorAll('.vpGroupHead')].map(h => h.textContent).join('|')`) === 'Air Force JROTC|Army JROTC|Marine Corps JROTC|Navy JROTC', 'the programs are headings, in the data order');
    expect(await ev(`__menu().querySelectorAll('select').length`) === 0, 'no drop-down in the menu');

    // ---- 1. Each program's ribbons are under its own heading; a tap on a tile. ----
    const underHeadings = await ev(`Object.fromEntries([...__menu().querySelectorAll('.vpGroupHead')].map(h => [h.textContent, [...h.parentNode.querySelectorAll('.vpCell')].map(c => c.dataset.value)]))`);
    const labels = { 'air-force-jrotc': 'Air Force JROTC', 'army-jrotc': 'Army JROTC', 'marine-corps-jrotc': 'Marine Corps JROTC', 'navy-jrotc': 'Navy JROTC' };
    for(const [key, list] of Object.entries(ids)) expect(JSON.stringify(underHeadings[labels[key]]) === JSON.stringify(list), `the ${labels[key]} heading has its ${list.length} ribbons in the order of wear`);
    const s1 = await ev('__state()');
    expect(s1.shown.length === total, `every ribbon is a tile: ${s1.shown.length}`);
    await ev(`__tap('${AF}')`);
    const s2 = await ev('__state()');
    console.log('after the first:', JSON.stringify({ ...s2, shown: s2.shown.length }));
    expect(sortJ(s2.checked) === sortJ([AF]) && sortJ(s2.pressed) === sortJ([AF]), `the first is chosen and its tile is on: ${s2.checked} / ${s2.pressed}`);
    expect(/1 of 3 chosen/.test(s2.summary), `the summary counts it: ${s2.summary}`);

    // ---- 2. The search narrows the tiles; the first stays in sight. ----
    await ev(`__set('.rotcRibbonSearch', 'profic')`);
    const s3 = await ev('__state()');
    const proficient = await ev(`CAPUBRotcRibbons.ribbons.filter(r => r.name.toLowerCase().includes('profic')).map(r => r.id)`);
    expect(sortJ(s3.shown) === sortJ([...new Set([...proficient, AF])]), `the search leaves the matching ribbons and the one chosen: ${s3.shown.join(', ')}`);
    await ev(`__tap('${ARMY}')`);
    const s4 = await ev('__state()');
    console.log('after the second:', JSON.stringify({ ...s4, shown: s4.shown.length }));
    expect(sortJ(s4.checked) === sortJ([AF, ARMY]) && sortJ(s4.pressed) === sortJ([AF, ARMY]), `two chosen and on: ${s4.checked} / ${s4.pressed}`);
    expect(sortJ(s4.drawn) === sortJ([AF, ARMY]), `both are drawn in the rack: ${s4.drawn.join(', ')}`);
    expect(JSON.stringify(s4.shown) === JSON.stringify(Object.values(ids).flat().filter(id => s3.shown.includes(id))), 'the tiles follow the programs, each in the order of wear in the data');
    await ev(`__menu().scrollIntoView({ block: 'start' })`);
    await sleep(200);
    await shot('1-two');

    // ---- 3. A third from all programs, then a fourth is refused. ----
    await ev(`__set('.rotcRibbonSearch', '')`);
    await ev(`__tap('${NAVY}')`);
    const s5 = await ev('__state()');
    expect(sortJ(s5.checked) === sortJ([AF, ARMY, NAVY]), `three chosen: ${s5.checked.join(', ')}`);
    expect(/At most 3 JROTC\/ROTC ribbons may be worn \(CAPR 39-1, 11\.2\.5\)/.test(s5.status), `the menu says the limit is reached: ${s5.status}`);
    await ev(`__tap('${USMC}')`);
    const s6 = await ev('__state()');
    console.log('after the fourth:', JSON.stringify({ ...s6, shown: s6.shown.length }));
    expect(sortJ(s6.checked) === sortJ([AF, ARMY, NAVY]) && sortJ(s6.pressed) === sortJ([AF, ARMY, NAVY]), `the fourth is refused and its tile stays off: ${s6.checked.join(', ')}`);
    expect(/At most 3 JROTC\/ROTC ribbons may be worn \(CAPR 39-1, 11\.2\.5\); remove one to add another\./.test(s6.toast), `the toast gives the limit: ${s6.toast}`);
    expect(sortJ(s6.drawn) === sortJ([AF, ARMY, NAVY]), `three drawn: ${s6.drawn.join(', ')}`);
    await ev(`__menu().scrollIntoView({ block: 'start' })`);
    await sleep(200);
    await shot('2-limit');

    // ---- 4. A second tap takes one off. ----
    await ev(`__tap('${ARMY}')`);
    const s7 = await ev('__state()');
    expect(sortJ(s7.checked) === sortJ([AF, NAVY]) && sortJ(s7.pressed) === sortJ([AF, NAVY]) && sortJ(s7.drawn) === sortJ([AF, NAVY]), `a second tap takes it off: ${JSON.stringify({ ...s7, shown: s7.shown.length })}`);

    // ---- 5. A setup saved with the old tiles (the same State shape) loads into the menu. ----
    const saved = await ev(`(() => { const p = CAPUB_V2.collectProfile(); p.ribbonSelections = Object.assign({}, p.ribbonSelections, { '${USMC}': { checked: true, devices: {}, awardValue: 'earned', awardLabel: 'Earned' }, '${NAVY}': { checked: false, devices: {}, awardValue: '', awardLabel: '' } }); return JSON.stringify(p); })()`);
    await ev(`document.getElementById('galleryModalCloseBtn').click()`);
    await ev(`(async () => { CAPUB_V2.applyProfile(JSON.parse(${JSON.stringify(saved)})); await __settle(); document.getElementById('expandRibbons').click(); await new Promise(r => setTimeout(r, 1500)); })()`);
    const s8 = await ev('__state()');
    console.log('after load:', JSON.stringify({ ...s8, shown: s8.shown.length }));
    expect(sortJ(s8.checked) === sortJ([AF, USMC]) && sortJ(s8.pressed) === sortJ([AF, USMC]) && sortJ(s8.drawn) === sortJ([AF, USMC]), `the saved setup loads: ${JSON.stringify({ ...s8, shown: s8.shown.length })}`);

    console.log(fails.length ? `FAIL:\n  ${fails.join('\n  ')}` : 'PASS');
    if(fails.length) code = 1;
  } catch (e) { console.error(e); code = 2; }
  finally { try { ws.close(); } catch {} await chrome.close(); srv.close(); process.exit(code); }
})();
