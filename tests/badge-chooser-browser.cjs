#!/usr/bin/env node
'use strict';
// Browser check for the Badges card's chooser of the badge for each place (run by tests/pick-badge-chooser.test.cjs; needs Chrome).
//
//   node tests/badge-chooser-browser.cjs [--out DIR] [--tag name] [--width 420]
//
// Serves the repo, opens the page in headless Chrome, selects five badges on the Class A (two aviation badges compete for the one aviation place, three specialty badges for the
// left pocket, the right pocket and the place over the nametag), and checks the chooser: a plain heading row per position, one picture tile group per place with a tile for each
// competing badge (its own drawing and its name), no input, no select, no fieldset. Picks a badge for a place through its tile and checks the
// engine moved it there and the badge it displaced took its old place; moves the pick with the arrow key and checks it stays within the place. Writes a screenshot of the chooser when
// --out is given (LIVE7-1, Ethan: "pick the badges on the left and right manually"; 2026-11-12: the choices are pictures, the way the other selections are).
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
  const chrome = await launchChrome({ prefix: 'badge-chooser' });
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
    await S('Emulation.setDeviceMetricsOverride', { width: Number(opt('--width')) || 1280, height: 1000, deviceScaleFactor: 2, mobile: false });
    await S('Page.enable');
    await S('Emulation.setFocusEmulationEnabled', { enabled: true }); // headless pages have no focus otherwise, and a focused radio is needed for the arrow-key check
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
      CAPUB_V3.showStep('items');
    })()`);
    await sleep(1200);
    const inspect = () => ev(`(() => {
      const host = document.getElementById('badgeChooser');
      const tilesOf = list => [...list.querySelectorAll('[role=radio]')].map(t => ({ value: t.dataset.value, checked: t.getAttribute('aria-checked') === 'true', hasPicture: !!t.closest('.vpCell').querySelector('img'), line: (t.closest('.vpCell').querySelector('.vpCaption') || {}).textContent || '' }));
      const radiogroup = list => { const g = list.querySelector('[role=radiogroup]'); return { role: g ? g.getAttribute('role') : null, labelled: !!g && !!document.getElementById(g.getAttribute('aria-labelledby') || ''), options: tilesOf(list) }; };
      const groups = [...host.querySelectorAll('.badgeChooserGroup')].map(g => ({
        position: g.dataset.position, tag: g.tagName, heading: g.querySelector('.badgeChooserTitle') && g.querySelector('.badgeChooserTitle').textContent,
        slots: [...g.querySelectorAll('.badgeChooserSlot')].map(row => Object.assign({ slot: row.dataset.slot, label: row.querySelector('.badgeChooserSlotName').textContent }, radiogroup(row.querySelector('.badgeChooserList')))),
        own: g.querySelector(':scope > .badgeChooserList') ? radiogroup(g.querySelector(':scope > .badgeChooserList')) : null,
        tiles: g.querySelectorAll('[role=radio]').length
      }));
      return { hidden: host.classList.contains('hidden'), fieldsets: host.querySelectorAll('fieldset,legend').length, selects: host.querySelectorAll('select').length, inputs: host.querySelectorAll('input').length, groups };
    })()`);
    const picked = group => Object.fromEntries(group.slots.map(sl => [sl.slot, (sl.options.find(o => o.checked) || {}).value]));
    const a = await inspect();
    console.log(JSON.stringify(a, null, 1));
    const fails = [];
    if(a.hidden) fails.push('the chooser is hidden');
    if(a.fieldsets) fails.push('the chooser still uses a fieldset or legend');
    if(a.selects || a.inputs) fails.push('the chooser should have no select and no input: ' + a.selects + ' selects, ' + a.inputs + ' inputs');
    const pocket = a.groups.find(g => g.position === 'pocket'), aviation = a.groups.find(g => g.position === 'aviation');
    if(!pocket || pocket.slots.length !== 3) fails.push('the pocket group should have one place row per place (3)');
    if(pocket && !pocket.slots.every(sl => sl.role === 'radiogroup' && sl.labelled && sl.options.length === 3 && sl.options.every(o => o.hasPicture))) fails.push('each pocket place should be a labelled radio group of picture tiles, one for each of the three competing badges');
    if(pocket && pocket.slots.some(sl => sl.options.filter(o => o.checked).length !== 1)) fails.push('each place should have exactly one tile picked');
    if(pocket && new Set(Object.values(picked(pocket))).size !== 3) fails.push('the places should start with three different badges');
    if(pocket && !pocket.slots.every(sl => sl.options.every(o => o.line.length === 0))) fails.push('a tile is the picture and the name: no line under the name');
    if(!aviation || aviation.tiles !== 2 || !aviation.own || aviation.own.role !== 'radiogroup') fails.push('the aviation group should be a radio group with a tile per competing badge (2)');
    if(aviation && aviation.own && aviation.own.options.filter(o => o.checked).length !== 1) fails.push('the aviation place should have exactly one tile picked');
    await shot('0-default');
    // Pick the IT badge for the left pocket through its tile; the engine puts it there and the badge the place held takes the tile's old place (a swap).
    await ev(`(() => { const t = document.querySelector('#badgeChooser .badgeChooserSlot[data-slot="left-pocket"] [role=radio][data-value="information_technology_technician_badge"]'); t.click(); })()`);
    await sleep(1200);
    const b = await inspect();
    const after = b.groups.find(g => g.position === 'pocket');
    const got = picked(after);
    console.log('after the pick:', JSON.stringify(got), JSON.stringify(await ev('State.badgeChoices')));
    if(got['left-pocket'] !== 'information_technology_technician_badge') fails.push('the left pocket did not take the picked badge');
    if(new Set(Object.values(got)).size !== 3) fails.push('a badge sits in two places');
    const state = await ev('State.badgeChoices');
    if(!state.blues_a || !state.blues_a.pocket || typeof state.blues_a.pocket !== 'object' || state.blues_a.pocket['left-pocket'] !== 'information_technology_technician_badge') fails.push('State.badgeChoices.blues_a.pocket should hold { place: badgeId } with the left pocket the picked badge');
    const drawn = await ev(`CAPUBUniformView.scene.layers.filter(l => l.role === 'badge').map(l => l.key.replace('badge:', '') + '@' + (l.x + l.w / 2).toFixed(1))`);
    console.log('drawn:', drawn.join(', '));
    if(!drawn.some(d => d.startsWith('information_technology_technician_badge@') && Number(d.split('@')[1]) > 15)) fails.push('the IT badge is not drawn on the left pocket');
    const said = await ev(`(() => { const n = document.querySelector('#badgeChooser .badgeChooserSay'); return n ? { hidden: n.hidden, text: n.textContent } : null; })()`);
    console.log('status line after the pick:', JSON.stringify(said));
    if(!said || said.hidden || !/Information Technology/.test(said.text)) fails.push('the status line under the tiles should say what the pick did with the badge: ' + JSON.stringify(said));
    await shot('1-picked');
    // Keyboard: focus the picked tile of the right pocket and press the down arrow; the pick moves to the next badge in that place only.
    const focused = await ev(`(() => { const t = document.querySelector('#badgeChooser .badgeChooserSlot[data-slot="right-pocket"] [role=radio][aria-checked="true"]'); t.focus(); return document.hasFocus() && document.activeElement === t; })()`);
    if(!focused) fails.push('the right pocket tile did not take focus');
    const before = picked(after);
    await S('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40 });
    await S('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40 });
    await sleep(300);
    // An arrow moves the focus along the place's tiles (the radio group's way); Enter or the space bar picks the tile it is on.
    await S('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await S('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await sleep(1200);
    const c = await inspect();
    const moved = picked(c.groups.find(g => g.position === 'pocket'));
    const focusSlot = await ev(`document.activeElement && document.activeElement.closest('.badgeChooserSlot') ? document.activeElement.closest('.badgeChooserSlot').dataset.slot : null`);
    console.log('after the arrow key:', JSON.stringify(moved), 'focus in', focusSlot, JSON.stringify(await ev('State.badgeChoices')));
    if(moved['right-pocket'] === before['right-pocket']) fails.push('the arrow key and Enter did not move the right pocket pick');
    if(focusSlot !== 'right-pocket') fails.push('the arrow key left the right pocket tiles');
    if(new Set(Object.values(moved)).size !== 3) fails.push('after the arrow key a badge sits in two places');
    if(c.groups.find(g => g.position === 'aviation').own.options.filter(o => o.checked).length !== 1) fails.push('the aviation pick was disturbed');
    await shot('2-arrow');
    // The picker windows keep the focus: with the focus on a tile under a tile (a level of a badge, an award option of a ribbon) a pick makes the list again, which must not throw, and
    // the focus must come back to the same tile; with the focus on a level tile, picking the Model Rocketry Badge writes the window's status line. (Live crash: a NodeList has no find.)
    await ev(`(async () => {
      window.__errs = []; window.addEventListener('error', e => window.__errs.push(String(e.message)));
      State.membership = 'cadet'; State.gender = 'male'; State.rank = 'C/Capt'; State.uniform = 'blues_a';
      State.badges = []; State.badgeChoices = {}; State.badgeSelections = {}; State.ribbonSelections = {};
      await CAPUBUniformView.render();
      CAPUB_V3.showStep('items');
    })()`);
    await sleep(1200);
    const pickCell = id => `document.querySelector('.vpCell[data-value="${id}"]')`;
    const focusClick = sel => ev(`(() => { const t = ${sel}; if(!t) return 'missing'; t.focus(); t.click(); return 'ok'; })()`);
    const focusOn = () => ev(`(() => { const a = document.activeElement; const c = a && a.closest && a.closest('.vpCell'); return a ? { cell: c ? c.dataset.value : null, option: a.dataset ? a.dataset.value : null, cls: a.className } : null; })()`);
    await ev(`openGalleryModal('badges')`);
    await sleep(800);
    if(await ev(`!${pickCell('stem_badges')}`)) fails.push('the Badges window has no Cadet STEM Badge tile');
    else {
      await ev(`${pickCell('stem_badges')}.querySelector('.vpOption').click()`);
      await sleep(300);
      const level = `${pickCell('stem_badges')}.querySelector('.vpRow .vpOption[data-value="advanced"]')`;
      if(await focusClick(level) !== 'ok') fails.push('the STEM badge has no Advanced level tile');
      await sleep(300);
      const f1 = await focusOn();
      console.log('focus after the level pick:', JSON.stringify(f1));
      if(!f1 || f1.cell !== 'stem_badges' || f1.option !== "advanced") fails.push('after picking a level the focus is not on the same level tile: ' + JSON.stringify(f1));
      await ev(`${pickCell('stem_badges')}.querySelector('.vpRow .vpOption[data-value="advanced"]').focus()`);
      await ev(`${pickCell('model_rocketry_badge')}.querySelector('.vpOption').click()`);
      await sleep(300);
      const say = await ev(`(() => { const n = document.getElementById('capubV2ModalSay'); return n ? { hidden: n.hidden, text: n.textContent } : null; })()`);
      console.log('status line after the Model Rocketry Badge:', JSON.stringify(say));
      if(!say || say.hidden || !/Model Rocketry/.test(say.text)) fails.push('the status line was not written for the Model Rocketry Badge: ' + JSON.stringify(say));
    }
    await ev(`typeof closeGalleryModal === 'function' ? closeGalleryModal() : 0`);
    await ev(`openGalleryModal('ribbons')`);
    await sleep(800);
    if(await ev(`!${pickCell('goddard_achievement')}`)) fails.push('the Ribbons window has no Goddard tile');
    else {
      await ev(`${pickCell('goddard_achievement')}.querySelector('.vpOption').click()`);
      await sleep(300);
      const awards = await ev(`[...${pickCell('goddard_achievement')}.querySelectorAll('.vpRow .vpOption')].map(t => t.dataset.value)`);
      console.log('Goddard options:', JSON.stringify(awards));
      if(awards.length < 2) fails.push('the Goddard ribbon has no award options under its tile');
      else {
        const want = awards[awards.length - 1];
        await focusClick(`${pickCell('goddard_achievement')}.querySelector('.vpRow .vpOption[data-value="${want}"]')`);
        await sleep(300);
        const f2 = await focusOn();
        console.log('focus after the award pick:', JSON.stringify(f2));
        if(!f2 || f2.cell !== 'goddard_achievement' || f2.option !== want) fails.push('after picking an award the focus is not on the same option: ' + JSON.stringify(f2));
      }
    }
    const errs = await ev('window.__errs');
    console.log('page errors:', JSON.stringify(errs));
    if(errs.length) fails.push('the page threw: ' + errs.join(' | '));
    console.log(fails.length ? `FAIL:\n  ${fails.join('\n  ')}` : 'PASS');
    if(fails.length) code = 1;
  } catch (e) { console.error(e); code = 2; }
  finally { try { ws.close(); } catch {} await chrome.close(); srv.close(); process.exit(code); }
})();
