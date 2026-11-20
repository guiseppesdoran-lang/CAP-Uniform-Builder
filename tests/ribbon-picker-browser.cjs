#!/usr/bin/env node
'use strict';
// Browser check for the ribbons picker (not part of `npm test`: needs Chrome).
//
//   node tests/ribbon-picker-browser.cjs [--out DIR] [--tag before|after]
//
// Serves the repo, opens the page in headless Chrome and opens the ribbon picker: the ribbons are picture tiles in rows (two at a phone's width, more on a desktop), with
// no checkbox or radio button; a tap turns one on with its count under the tile, the counting rule kept in the picked line's title and the row of counts', a ribbon with devices is
// drawn with them in its tile, and the tiles of the other ribbons keep their size. Writes screenshots when --out is given.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { launchChrome } = require('../scripts/lib-chrome.cjs');

const ROOT = path.join(__dirname, '..');
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
  const chrome = await launchChrome({ prefix: 'ribbon-picker' });
  return { cdp: new Cdp(chrome.ws), ws: chrome.ws, chrome };
}

(async () => {
  const srv = await serve();
  const { chrome, cdp, ws } = await launch();
  let code = 0;
  try {
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    const S = (m, p) => cdp.send(m, p, sessionId);
    const ev = async expr => { const r = await S('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if(r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    await S('Emulation.setDeviceMetricsOverride', { width: Number(opt('--width')) || 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    // The access gate remembers a member in localStorage; do the same for this local test page.
    await S('Page.enable');
    await S('Page.addScriptToEvaluateOnNewDocument', { source: "try{localStorage.setItem('cap_uniform_builder_access_v1','1')}catch(e){}" });
    await S('Page.navigate', { url: `http://127.0.0.1:${srv.address().port}/index.html` });
    for(let i = 0; i < 400; i++){ if(await ev('!!document.querySelector("#ribbonGallery") && typeof buildRibbonGallery==="function"').catch(() => false)) break; await sleep(50); }
    await sleep(800);
    const shot = async name => { if(!OUT) return; fs.mkdirSync(OUT, { recursive: true }); const r = await S('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUT, `${TAG}-${name}.png`), Buffer.from(r.data, 'base64')); };

    // Open the picker window the way the page does (the sidebar grid is hidden by CSS).
    const opened = await ev(`(() => { const b = document.getElementById('expandRibbons'); if(!b) return 'no-button'; b.click(); return 'expandRibbons'; })()`);
    await sleep(2500);
    const root = `#galleryModalHost`;
    const bad = [];
    const tiles = await ev(`(() => { const h = document.querySelector('${root}'); return { cells: h.querySelectorAll('.vpCell').length, pressed: h.querySelectorAll('.vpCell > .vpOption[aria-pressed]').length, boxes: h.querySelectorAll('input[type=checkbox],input[type=radio]').length, controls: h.querySelectorAll('.vpControls').length, ruleButtons: h.querySelectorAll('.ribbonRuleBtn, .ribbonRulePop').length }; })()`);
    console.log('picker', opened, JSON.stringify(tiles));
    if(tiles.cells < 40 || tiles.pressed !== tiles.cells) bad.push(`the ribbons should be picture tiles with aria-pressed: ${JSON.stringify(tiles)}`);
    if(tiles.boxes) bad.push(`${tiles.boxes} checkboxes or radio buttons in the picker`);
    if(tiles.controls) bad.push(`${tiles.controls} controls under tiles before a pick: they show only while a ribbon is on`);
    if(tiles.ruleButtons) bad.push(`${tiles.ruleButtons} rule buttons or popovers in the picker`);
    // The rows: two to a row at a phone's width, more on a desktop.
    const width = Number(opt('--width')) || 1280;
    const columns = await ev(`(() => { const rows = {}; for(const c of document.querySelectorAll('${root} .vpCell')){ const r = c.getBoundingClientRect(); if(r.height > 0){ const k = Math.round(r.top); rows[k] = (rows[k] || 0) + 1; } } return Math.max(...Object.values(rows)); })()`);
    console.log('tiles in the fullest row at', width, 'px:', columns);
    if(width <= 420 && columns < 2) bad.push(`two tiles to a row at ${width} px, found ${columns}`);
    if(width >= 1200 && columns < 4) bad.push(`more tiles to a row on a desktop, found ${columns}`);
    const sizeBefore = await ev(`(() => { const c = [...document.querySelectorAll('${root} .vpCell')].find(c => c.dataset.value === 'cap_leadership_ribbon'); const r = c.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; })()`);
    await shot('0-start');

    // A ribbon with a counting rule: nothing under the tile before the tap; after it the dropdown of counts (the rule in its title), no row of tiles, no "- Select -".
    const id = 'cadet_recruiter_ribbon';
    const cellOf = rid => `[...document.querySelectorAll('${root} .vpCell')].find(c => c.dataset.value === '${rid}')`;
    const tapTop = async rid => { const r = await ev(`(() => { const c = ${cellOf(rid)}; c.scrollIntoView({ block: 'center' }); const b = c.querySelector('.vpOption').getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })()`);
      for(const type of ['mousePressed', 'mouseReleased']) await S('Input.dispatchMouseEvent', { type, x: r[0], y: r[1], button: 'left', clickCount: 1 }); };
    const topOf = rid => ev(`Math.round(${cellOf(rid)}.querySelector('.vpOption').getBoundingClientRect().top)`);
    await ev(`${cellOf(id)}.scrollIntoView({ block: 'center' })`);
    await sleep(300);
    const top0 = await topOf(id);
    await tapTop(id);
    await sleep(1200);
    const picked = await ev(`(() => { const c = ${cellOf(id)}; const sel = c.querySelector('select.ribbonCountSelect'); return { on: c.querySelector('.vpOption').getAttribute('aria-pressed'), state: State.ribbonSelections['${id}'].checked, rows: c.querySelectorAll('.vpRow').length, selects: c.querySelectorAll('select').length, options: sel ? [...sel.options].map(o => o.value) : [], text: sel ? sel.options[sel.selectedIndex].textContent : null, title: sel ? sel.getAttribute('title') : null, label: sel ? sel.getAttribute('aria-label') : null, overflow: sel ? sel.getBoundingClientRect().right > c.getBoundingClientRect().right + 1 : null }; })()`);
    console.log('recruiter after the tap:', JSON.stringify({ ...picked, options: picked.options.length }));
    if(picked.on !== 'true' || !picked.state) bad.push('the tap should turn the ribbon on');
    if(picked.rows) bad.push('a row of tiles is left under the ribbon: ' + picked.rows);
    if(picked.selects !== 1) bad.push('one dropdown under the ribbon: ' + picked.selects);
    if(!/Two recruits earn the ribbon/.test(picked.title || '')) bad.push('the rule is not in the dropdown\'s title');
    if(picked.options.length < 3 || picked.options.includes('')) bad.push('the dropdown lists the counts and no "- Select -": ' + JSON.stringify(picked.options));
    if(picked.overflow) bad.push('the dropdown runs past its tile');
    const top1 = await topOf(id);
    if(top1 !== top0) bad.push(`the tapped tile moved when its dropdown opened: ${top0} -> ${top1}`);
    await shot('1-recruiter-on');

    // The closed dropdown is never cut: the short form of every line of every ribbon fits the box that shows it, at this width (16 px on a touch screen, as Safari on a phone has it).
    const fit = await ev(`(() => {
      const c = ${cellOf(id)}; const sh = c.querySelector('.ribbonSelectShown'); const cs = getComputedStyle(sh);
      const avail = sh.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight); const cv = document.createElement('canvas').getContext('2d');
      cv.font = cs.fontWeight + ' ' + (window.innerWidth < 700 ? 16 : parseFloat(cs.fontSize)) + 'px ' + cs.fontFamily;
      const keep = JSON.stringify(State.ribbonSelections); let worst = { w: 0 };
      for(const rid of [...getEligibleRibbonIds(), ...getMilitaryRibbonIds()]){
        if(isRotcRibbonId(rid)) continue;
        setRibbonSelectionFromDropdown(rid, capubFirstRibbonOptionValue(rid), { deferRender: true });
        for(const l of getRibbonControls(rid).lines){ const w = cv.measureText(l.short).width; if(w > worst.w) worst = { w, rid, t: l.short }; }
      }
      State.ribbonSelections = JSON.parse(keep); normalizeRibbonSelections();
      return { avail, worst };
    })()`);
    console.log('widest closed dropdown text:', JSON.stringify(fit));
    if(fit.worst.w > fit.avail) bad.push(`a closed dropdown would be cut at ${width} px: "${fit.worst.t}" of ${fit.worst.rid} needs ${Math.round(fit.worst.w)} px of ${Math.round(fit.avail)}`);

    // The highest count, chosen by the dropdown: the award changes, the tile stays where it is, the focus stays on the dropdown, the ribbon is drawn with its devices in its tile.
    await ev(`(() => { const sel = ${cellOf(id)}.querySelector('select.ribbonCountSelect'); sel.focus(); sel.value = sel.options[sel.options.length - 1].value; sel.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await sleep(1500);
    const high = await ev(`(() => { const c = ${cellOf(id)}; const s = State.ribbonSelections['${id}']; const sel = c.querySelector('select.ribbonCountSelect'); return { value: s.awardValue, devices: Object.keys(s.devices || {}).length, drawn: !!c.querySelector('.vpOption svg'), inRack: State.ribbons.some(r => r.id === '${id}'), focus: document.activeElement === sel, shown: sel && sel.value, text: sel && sel.options[sel.selectedIndex].textContent }; })()`);
    console.log('the highest count:', JSON.stringify(high));
    if(!high.drawn) bad.push('the ribbon that is on should be drawn with its devices in its tile');
    if(!high.inRack) bad.push('the ribbon should be in the rack');
    if(!high.focus) bad.push('the focus should stay on the dropdown');
    if(high.shown !== high.value) bad.push('the dropdown should show the award that was chosen');
    if(!/42 members recruited: .*clasp/.test(high.text || '')) bad.push('the open list has the full line, the count and the devices in words: ' + high.text);
    const shownText = await ev(`${cellOf(id)}.querySelector('.ribbonSelectShown').textContent`);
    if(shownText !== '42') bad.push('the closed dropdown shows the short form: ' + shownText);
    if(await ev(`${cellOf(id)}.querySelectorAll('.ribbonDeviceWords').length`)) bad.push('no line under the dropdown');
    const top2 = await topOf(id);
    if(top2 !== top0) bad.push(`the tapped tile moved when a count was chosen: ${top0} -> ${top2}`);
    // The tiles of the other ribbons keep their size.
    const sizeAfter = await ev(`(() => { const c = [...document.querySelectorAll('${root} .vpCell')].find(c => c.dataset.value === 'cap_leadership_ribbon'); const r = c.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; })()`);
    if(sizeBefore[0] !== sizeAfter[0] || Math.abs(sizeBefore[1] - sizeAfter[1]) > 1) bad.push(`another ribbon's tile changed size: ${sizeBefore} -> ${sizeAfter}`);
    await shot('2-highest');
    // A tap in the box beside the picture (the padding at the bottom of the tile, and the name) turns the ribbon off as a tap on the picture does; the tile does not move.
    const boxTap = await ev(`(() => { const c = ${cellOf(id)}; const r = c.getBoundingClientRect(); const lab = c.querySelector('.vpLabel').getBoundingClientRect(); return { pad: [r.left + r.width / 2, r.bottom - 2], name: [lab.left + lab.width / 2, lab.top + lab.height / 2] }; })()`);
    for(const [what, at] of [['the spare space at the bottom of the box', boxTap.pad]]){
      for(const type of ['mousePressed', 'mouseReleased']) await S('Input.dispatchMouseEvent', { type, x: at[0], y: at[1], button: 'left', clickCount: 1 });
      await sleep(900);
      const st = await ev(`State.ribbonSelections['${id}'].checked`);
      if(st) bad.push('a tap on ' + what + ' should drop the ribbon');
      const topNow = await topOf(id);
      if(topNow !== top0) bad.push(`the tile moved when ${what} was tapped: ${top0} -> ${topNow}`);
    }
    // A tap on the dropdown of a ribbon that is off again does nothing but is not there; turn it on by the name instead.
    {
      const nm = await ev(`(() => { const c = ${cellOf(id)}; const lab = c.querySelector('.vpLabel').getBoundingClientRect(); return [lab.left + lab.width / 2, lab.top + lab.height / 2]; })()`);
      for(const type of ['mousePressed', 'mouseReleased']) await S('Input.dispatchMouseEvent', { type, x: nm[0], y: nm[1], button: 'left', clickCount: 1 });
      await sleep(900);
      if(!(await ev(`State.ribbonSelections['${id}'].checked`))) bad.push('a tap on the ribbon\'s name should choose it');
      // a tap on the dropdown's box chooses nothing and drops nothing
      const sw = await ev(`(() => { const c = ${cellOf(id)}; const b = c.querySelector('.ribbonSelectWrap').getBoundingClientRect(); return [b.left + 4, b.top + b.height / 2]; })()`);
      for(const type of ['mousePressed', 'mouseReleased']) await S('Input.dispatchMouseEvent', { type, x: sw[0], y: sw[1], button: 'left', clickCount: 1 });
      await sleep(500);
      if(!(await ev(`State.ribbonSelections['${id}'].checked`))) bad.push('a tap on the dropdown must not drop the ribbon');
    }
    // And off again: the controls are gone.
    await tapTop(id);
    await sleep(800);
    const off = await ev(`(() => { const c = ${cellOf(id)}; return { on: c.querySelector('.vpOption').getAttribute('aria-pressed'), controls: !!c.querySelector('.vpControls'), state: State.ribbonSelections['${id}'].checked }; })()`);
    if(off.on !== 'false' || off.controls || off.state) bad.push('a second tap should turn the ribbon off and take its controls away: ' + JSON.stringify(off));
    // No empty space inside a tile: the controls sit directly under the name, and a dropdown and a switch have only the small gap between them (a ribbon with both).
    for(const rid of ['search_find_ribbon', 'lifesaving_award', 'disaster_relief_ribbon', 'commander_commendation_award']){
      if(!(await ev(`!!(${cellOf(rid)})`))) continue;
      await tapTop(rid);
      await sleep(900);
      const sp = await ev(`(() => { const c = ${cellOf(rid)}; const w = c.querySelector('.ribbonSelectWrap'), t = c.querySelector('.ribbonToggle'), name = c.querySelector('.vpLabel'), ctl = c.querySelector('.vpControls'); if(!w || !t) return null; const r = e => e.getBoundingClientRect(); return { gap: Math.round(r(t).top - r(w).bottom), under: Math.round(r(ctl).top - r(name).bottom), band: Math.round(r(ctl).bottom - Math.max(r(w).bottom, r(t).bottom)), words: c.querySelectorAll('.ribbonDeviceWords').length }; })()`);
      if(!sp) continue;
      console.log('space in', rid, JSON.stringify(sp));
      if(sp.gap > 10 || sp.gap < 0) bad.push(`${rid}: ${sp.gap} px between the dropdown and its switch`);
      if(sp.under > 10) bad.push(`${rid}: ${sp.under} px between the name and the controls`);
      if(sp.band > 10) bad.push(`${rid}: a band of ${sp.band} px under the controls`);
      if(sp.words) bad.push(`${rid}: a line is left under the dropdown`);
      await tapTop(rid);
      await sleep(600);
      break;
    }
    console.log(bad.length ? `FAIL (${bad.length}):\n  ${bad.slice(0, 12).join('\n  ')}` : 'PASS');
    if(bad.length) code = 1;
  } catch (e) { console.error(e); code = 2; }
  finally { try { ws.close(); } catch {} await chrome.close(); srv.close(); process.exit(code); }
})();
