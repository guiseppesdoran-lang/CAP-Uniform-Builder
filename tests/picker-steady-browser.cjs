#!/usr/bin/env node
'use strict';
// Browser check that a picture list stays steady when a tap opens something under a tile (run by tests/picker-steady.test.cjs; needs Chrome).
//
//   node tests/picker-steady-browser.cjs [--out DIR] [--json] [--measure]
//
// Serves the repo, opens the page in headless Chrome at a desktop and a phone viewport, and taps (real mouse events, not clicks made by script) through the chooser window's lists:
// a cadet's STEM and Cyber badges (a level dropdown opens under each), a level picked in one of them (a change of the dropdown: a native list is not tapped from a script), a ribbon with a row of choices and a patch with places. For each tap it records, from the
// moment of the press to 600 ms after the drawing: how far the tapped tile moved in the window (it must not move), how far the tiles above it moved, how far the window's scroller and the
// page scrolled, how many tiles of the list were made again (the list must not be built whole), and the time to the first stable frame. Also checks that no tile that is on has a dimmed picture
// (opacity under 1) and that a badge chosen but left off by the drawing carries the not-worn mark in the tick's place. Prints PASS when every check holds.
// (the owner, 2026-11-18: "the badge selection (in terms of the stem and cyber badge when its expanded) is really laggy, and janky (throws around the entire ui)"; "any selection menu when
// something pops out and you select, it throws around your UI to be higher or lower than when you had it".)
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { launchChrome } = require('../scripts/lib-chrome.cjs');

const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const opt = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const OUT = opt('--out');
const CPU = Number(opt('--cpu')) || 1;   // CPU slowdown, a phone or a slow laptop
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

// Runs in the page: watches one tap. `sel` is the tile to press; `host` the element whose tiles are counted.
const PROBE = `(() => {
  window.__probe = null;
  const scrollable = el => { for(let n = el.parentElement; n; n = n.parentElement){ const o = getComputedStyle(n).overflowY; if((o === 'auto' || o === 'scroll') && n.scrollHeight > n.clientHeight) return n; } return null; };
  window.__watch = function(sel, scope){
    const tile = document.querySelector(sel);
    const scroller = scrollable(tile);
    const all = () => [...document.querySelectorAll('.vpOption')].filter(o => o.offsetParent);
    const aboveIds = all().filter(o => o !== tile && (o.compareDocumentPosition(tile) & Node.DOCUMENT_POSITION_FOLLOWING)).slice(-6).map(o => o.id);
    const byId = id => document.getElementById(id);
    const top = el => el.getBoundingClientRect().top, left = el => el.getBoundingClientRect().left;
    const p = { madeTiles: 0, madeNodes: 0, maxMove: 0, maxMoveX: 0, maxAbove: 0, maxScroll: 0, maxPage: 0, base: { t: top(tile), l: left(tile), a: aboveIds.map(id => top(byId(id))), s: scroller ? scroller.scrollTop : 0, w: window.scrollY }, t0: 0, lastMut: 0, rendered: 0, renders: 0, long: 0 };
    const id = tile.id;
    // The tiles of the lists as they stand before the tap: a list made again whole leaves none of these on the page.
    p.cells0 = [...(scope ? document.querySelector(scope) : document).querySelectorAll('.vp[data-mode="toggle"] .vpCell, .vp:not([data-mode="toggle"]) .vpOption')].filter(c => !c.closest('.vpControls') && !c.closest('.vpRow'));
    p.madePage = 0; p.what = {};
    const mo = new MutationObserver(list => { p.lastMut = performance.now(); for(const m of list) for(const n of m.addedNodes){ if(n.nodeType !== 1) continue; p.madeNodes++; const k = (m.target.id || m.target.className || m.target.tagName) + ''; p.what[k] = (p.what[k] || 0) + 1; const count = (n.classList.contains('vpOption') ? 1 : 0) + (n.querySelectorAll ? n.querySelectorAll('.vpOption').length : 0); if(m.target.closest && m.target.closest('#galleryModalHost')) p.madeTiles += count; else p.madePage += count; } });
    mo.observe(document.body, { childList: true, subtree: true });
    const lt = typeof PerformanceObserver === 'function' ? new PerformanceObserver(l => l.getEntries().forEach(e => { p.long += e.duration; })) : null;
    try{ lt && lt.observe({ entryTypes: ['longtask'] }); }catch(e){}
    document.addEventListener('click', () => { p.t0 = performance.now(); }, { capture: true, once: true });
    const onRendered = () => { if(!p.rendered) p.rendered = performance.now(); p.renders++; };
    document.addEventListener('capub:rendered', onRendered);
    const tick = () => {
      const t = performance.now();
      if(p.t0 && t - p.t0 > 900){ document.removeEventListener('capub:rendered', onRendered); mo.disconnect(); lt && lt.disconnect(); return; }
      if(p.t0){
        const now = byId(id);
        if(now){ p.maxMove = Math.max(p.maxMove, Math.abs(top(now) - p.base.t)); p.maxMoveX = Math.max(p.maxMoveX, Math.abs(left(now) - p.base.l)); }
        aboveIds.forEach((x, i) => { const c = byId(x); if(c) p.maxAbove = Math.max(p.maxAbove, Math.abs(top(c) - p.base.a[i])); });
        if(scroller) p.maxScroll = Math.max(p.maxScroll, Math.abs(scroller.scrollTop - p.base.s));
        p.maxPage = Math.max(p.maxPage, Math.abs(window.scrollY - p.base.w));
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    window.__probe = p;
  };
  window.__result = function(){
    const p = window.__probe;
    return { rebuilt: p.cells0.filter(c => !c.isConnected).length, listed: p.cells0.length, what: p.what, madePage: p.madePage, madeTiles: p.madeTiles, madeNodes: p.madeNodes, maxMove: +p.maxMove.toFixed(1), maxMoveX: +p.maxMoveX.toFixed(1), maxAbove: +p.maxAbove.toFixed(1), maxScroll: +p.maxScroll.toFixed(1), maxPage: +p.maxPage.toFixed(1), renders: p.renders, toRendered: p.rendered ? +(p.rendered - p.t0).toFixed(0) : null, toSettled: +(Math.max(p.lastMut, p.rendered) - p.t0).toFixed(0), longTaskMs: +p.long.toFixed(0), tilesNow: document.querySelectorAll('.vpOption').length };
  };
  return true;
})()`;

(async () => {
  const srv = await serve();
  const chrome = await launchChrome({ prefix: 'picker-steady' });
  const cdp = new Cdp(chrome.ws);
  const fails = [];
  const report = {};
  let code = 0;
  try {
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    const S = (m, p) => cdp.send(m, p, sessionId);
    const ev = async expr => { const r = await S('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if(r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    await S('Page.enable');
    if(CPU > 1) await S('Emulation.setCPUThrottlingRate', { rate: CPU });
    // Safari does not anchor the scroll to what is in view as Chrome does: measure without it, so a tile that is moved is seen as moved.
    await S('Page.addScriptToEvaluateOnNewDocument', { source: "document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent='*{overflow-anchor:none!important}';document.head.append(s)})" });
    await S('Page.addScriptToEvaluateOnNewDocument', { source: "try{localStorage.setItem('cap_uniform_builder_access_v1','1')}catch(e){}" });
    // A real tap: the pointer moves, presses and releases at the middle of the tile.
    const tap = async sel => {
      const r = await ev(`(() => { const t = document.querySelector(${JSON.stringify(sel)}); if(!t) return null; const r = t.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, inView: r.top >= 0 && r.bottom <= innerHeight }; })()`);
      if(!r) throw new Error('no tile ' + sel);
      await S('Input.dispatchMouseEvent', { type: 'mouseMoved', x: r.x, y: r.y });
      await S('Input.dispatchMouseEvent', { type: 'mousePressed', x: r.x, y: r.y, button: 'left', clickCount: 1 });
      await S('Input.dispatchMouseEvent', { type: 'mouseReleased', x: r.x, y: r.y, button: 'left', clickCount: 1 });
    };
    const bring = sel => ev(`(() => { const t = document.querySelector(${JSON.stringify(sel)}); const s = document.querySelector('#galleryModal .modalBody'); const r = t.getBoundingClientRect(), b = s.getBoundingClientRect(); s.scrollTop += (r.top - b.top) - b.height * 0.35; return true; })()`);
    const shot = async name => {
      if(!OUT) return;
      fs.mkdirSync(OUT, { recursive: true });
      const r = await S('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(r.data, 'base64'));
    };
    const watched = async (label, sel, wait) => {
      await bring(sel);
      await sleep(250);
      await ev(`(${PROBE}, window.__watch(${JSON.stringify(sel)}, '#galleryModalHost'), true)`);
      await tap(sel);
      await sleep(wait || 1500);
      const r = await ev('window.__result()');
      return r;
    };
    const openWindow = async (setup, button) => {
      await ev(`(async () => { ${setup}; fullRender(); await CAPUBUniformView.render(); document.getElementById(${JSON.stringify(button)}).click(); })()`);
      await sleep(1800);
    };
    const tileSel = (value, extra) => `#galleryModalHost .vpCell[data-value="${value}"]${extra || ''} > .vpOption`;
    // A level picked in the dropdown under a badge: the dropdown is set and told it changed (a native list does not open for a script), with the probe watching the badge's tile.
    const levelChange = async (label, id, level, wait) => {
      const sel = tileSel(id);
      await bring(sel);
      await sleep(250);
      await ev(`(${PROBE}, window.__watch(${JSON.stringify(sel)}, '#galleryModalHost'), true)`);
      const set = await ev(`(() => { const s = document.querySelector('#galleryModalHost .vpCell[data-value="${id}"] select.badgeLevelSelect'); if(!s) return false; document.dispatchEvent(new MouseEvent('click')); s.focus(); s.value = ${JSON.stringify(level)}; s.dispatchEvent(new Event('change', { bubbles: true })); return s.value === ${JSON.stringify(level)}; })()`);
      if(!set) fails.push(`${label}: no dropdown with the level ${level}`);
      await sleep(wait || 1500);
      const r = await ev('window.__result()');
      return Object.assign({ what: label }, r);
    };
    const dimmed = () => ev(`(() => [...document.querySelectorAll('#galleryModalHost .vpOption[aria-pressed="true"]')].filter(b => { const p = b.querySelector('.vpPicture'); if(!p) return false; for(let n = p; n && n !== document.body; n = n.parentElement){ if(Number(getComputedStyle(n).opacity) < 1) return true; } return false; }).map(b => b.dataset.value))()`);
    const check = (label, r, opts) => {
      const o = Object.assign({ cells: 0 }, opts || {});
      const { what, ...rest } = r;
      console.log(label.padEnd(34), JSON.stringify(rest));
      if(r.maxMove > 0.5 || r.maxMoveX > 0.5) fails.push(`${label}: the tapped tile moved ${r.maxMove} px up or down and ${r.maxMoveX} px sideways`);
      if(r.maxAbove > 0.5) fails.push(`${label}: tiles above the tapped one moved (${r.maxAbove})`);
      if(r.maxScroll > 0.5) fails.push(`${label}: the window scrolled by itself (${r.maxScroll} px)`);
      if(r.maxPage > 0.5) fails.push(`${label}: the page scrolled by itself (${r.maxPage} px)`);
      if(r.rebuilt > o.cells) fails.push(`${label}: ${r.rebuilt} of ${r.listed} tiles of the lists were made again (at most ${o.cells})`);
    };

    for(const view of [{ name: 'desktop', w: 1280, h: 900, mobile: false }, { name: 'phone', w: 390, h: 844, mobile: true }]){
      await S('Emulation.setDeviceMetricsOverride', { width: view.w, height: view.h, deviceScaleFactor: 1, mobile: view.mobile });
      await S('Page.navigate', { url: `http://127.0.0.1:${srv.address().port}/index.html` });
      for(let i = 0; i < 400; i++){ if(await ev('typeof CAPUBUniformView !== "undefined" && !!document.getElementById("expandBadges")').catch(() => false)) break; await sleep(50); }
      await sleep(800);
      const R = report[view.name] = {};
      console.log('--', view.name);
      await openWindow(`State.membership = 'cadet'; State.gender = 'male'; State.rank = 'C/Capt'; State.uniform = 'blues_a'; State.badgeSelections = {}; State.badges = []`, 'expandBadges');
      await shot(`${view.name}-0-badges`);
      R.stemOn = await watched('stem on', tileSel('stem_badges'));
      check(`${view.name} STEM on`, R.stemOn);
      await shot(`${view.name}-1-stem-open`);
      R.stemLevel = await levelChange('stem level', 'stem_badges', 'advanced');
      check(`${view.name} STEM level`, R.stemLevel);
      R.cyberOn = await watched('cyber on', tileSel('cyber_badges'));
      check(`${view.name} Cyber on`, R.cyberOn);
      R.cyberLevel = await levelChange('cyber level', 'cyber_badges', 'master');
      check(`${view.name} Cyber level`, R.cyberLevel);
      R.cyberOff = await watched('cyber off', tileSel('cyber_badges'));
      check(`${view.name} Cyber off`, R.cyberOff);
      R.stemOff = await watched('stem off', tileSel('stem_badges'));
      check(`${view.name} STEM off`, R.stemOff);
      // The veil: a badge chosen that the drawing leaves off (a second aviation badge for the one aviation place) is never dim, and shows the not-worn mark.
      await watched('solo on', tileSel('solo_badge'), 1800);
      await watched('pilot on', tileSel('CAPPilot1_FA9D33EA587D8'), 1800);
      const dim = await dimmed();
      if(dim.length) fails.push(`${view.name}: chosen tiles with a dimmed picture: ${dim.join(', ')}`);
      const marks = await ev(`(() => [...document.querySelectorAll('#galleryModalHost .vpOption[aria-pressed="true"]')].map(b => ({ v: b.dataset.value, off: b.classList.contains('isNotWorn') })))()`);
      const drawn = await ev(`capubBadgeSummary().map(r => ({ id: r.id, shown: !!r.shown }))`);
      for(const row of drawn){ const m = marks.find(x => x.v === row.id); if(m && m.off === row.shown) fails.push(`${view.name}: ${row.id} is ${row.shown ? 'worn' : 'left off'} but its mark says ${m.off ? 'not worn' : 'worn'}`); }
      R.marks = marks;
      await shot(`${view.name}-2-marks`);
    }
    // The other lists of the chooser window: a ribbon, a patch.
    await S('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await S('Page.navigate', { url: `http://127.0.0.1:${srv.address().port}/index.html` });
    for(let i = 0; i < 400; i++){ if(await ev('typeof CAPUBUniformView !== "undefined" && !!document.getElementById("expandRibbons")').catch(() => false)) break; await sleep(50); }
    await sleep(800);
    await openWindow(`State.membership = 'senior'; State.gender = 'male'; State.rank = 'Capt'; State.uniform = 'blues_a'; State.ribbonSelections = {}`, 'expandRibbons');
    const ribbonId = await ev(`(() => { const c = [...document.querySelectorAll('#galleryModalHost .vp[data-name="ribbons"] .vpCell')].find(c => c.dataset.value === 'cap_achievement_award') || document.querySelector('#galleryModalHost .vp[data-name="ribbons"] .vpCell'); return c.dataset.value; })()`);
    R_ribbon: {
      const r = await watched('ribbon on', tileSel(ribbonId, ''), 1800);
      report.ribbon = r;
      check('ribbon on (' + ribbonId + ')', r);
    }
    // The Items step: every list of the sidebar that offers a choice by picture (headgear, cords, grades, places...) taps one tile that is not picked.
    for(const view of [{ name: 'desktop', w: 1280, h: 900, mobile: false }, { name: 'phone', w: 390, h: 844, mobile: true }]){
      await S('Emulation.setDeviceMetricsOverride', { width: view.w, height: view.h, deviceScaleFactor: 1, mobile: view.mobile });
      await S('Page.navigate', { url: `http://127.0.0.1:${srv.address().port}/index.html` });
      for(let i = 0; i < 400; i++){ if(await ev('typeof CAPUBUniformView !== "undefined" && !!document.getElementById("expandBadges")').catch(() => false)) break; await sleep(50); }
      await sleep(800);
      await ev(`(async () => { State.membership = 'cadet'; State.gender = 'male'; State.rank = 'C/Capt'; State.uniform = 'blues_a'; State.badgeSelections = {}; State.badges = []; fullRender(); await CAPUBUniformView.render(); CAPUB_V3.showStep('items'); })()`);
      await sleep(1800);
      const targets = await ev(`(() => [...document.querySelectorAll('.vp')].filter(v => v.offsetParent && !v.closest('#galleryModalOverlay') && v.dataset.mode !== 'toggle' && v.dataset.mode !== 'action' && v.dataset.layout !== 'row').map(v => ({ name: v.dataset.name, id: ([...v.querySelectorAll('.vpOption')].find(o => o.getAttribute('aria-checked') !== 'true' && !o.disabled) || {}).id })).filter(t => t.id))()`);
      console.log('--', view.name, 'Items step lists:', targets.map(t => t.name).join(', '));
      report['items-' + view.name] = {};
      for(const t of targets){
        const sel = '#' + t.id;
        const here = await ev(`!!document.querySelector(${JSON.stringify(sel)})`);
        if(!here) continue;
        await ev(`document.querySelector(${JSON.stringify(sel)}).scrollIntoView({ block: 'center' })`);
        await sleep(200);
        await ev(`(${PROBE}, window.__watch(${JSON.stringify(sel)}), true)`);
        await tap(sel);
        await sleep(1300);
        const r = await ev('window.__result()');
        report['items-' + view.name][t.name] = r;
        check(`${view.name} items ${t.name}`, r, { cells: Infinity });
      }
    }
    console.log(JSON.stringify(report.desktop.marks));
    console.log(fails.length ? fails.map(f => 'FAIL ' + f).join('\n') : 'PASS');
    if(fails.length) code = 1;
    if(args.includes('--json')) fs.writeFileSync(opt('--json') || path.join(OUT || '.', 'picker-steady.json'), JSON.stringify(report, null, 1));
  } catch (e) { console.error(e); code = 2; }
  finally { await chrome.close(); srv.close(); process.exit(code); }
})();
