#!/usr/bin/env node
'use strict';
// Browser check for the quick strip (run by tests/quick-strip.test.cjs; needs Chrome). LIVE12 E48, Ducky: "there should be an
// option to quick strip the shirt down to just mini wings, rank, and name".
//
//   node tests/quick-strip-browser.cjs [--builds FILE] [--out DIR]
//
// Serves the repo, opens index.html in headless Chrome and builds a Capt's Class B shirt with seven ribbons, two competing aviation
// badges, two specialty badges, the squadron commander pin (which brings the Command Service Ribbon) and the Aide de Camp cord.
// Presses "Quick strip" and checks State and the drawn SVG: no ribbon or device pieces, one badge piece (the wings drawn before), grade
// and nametag present, no cord. Presses "Restore" and checks every selection is back exactly and the drawing has the same pieces. Then:
// a strip survives save and load (collectProfile/applyProfile) and restores from the saved copy; a ribbon checked by hand ends the
// strip and keeps the ribbon; moving to the Class A puts everything back; the aviator shirt keeps the wings and drops the chaplain
// badge (optional there), the blue shirt keeps the chaplain badge (mandatory, 4.1.11.1.1.2.3.1); a member with only U.S. military wings
// keeps them on the blue shirt. --builds writes the before/after engine builds for scripts/render-builds.cjs; --out a panel screenshot.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const args = process.argv.slice(2);
const opt = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const BUILDS = opt('--builds');
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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'quick-strip-chrome-'));
  const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--mute-audio', '--remote-debugging-port=0', `--user-data-dir=${dir}`, 'about:blank'], { stdio: 'ignore' });
  const portFile = path.join(dir, 'DevToolsActivePort');
  for(let i = 0; !fs.existsSync(portFile); i++){ if(i > 800) throw new Error('Chrome did not start'); await new Promise(r => setTimeout(r, 25)); }
  await new Promise(r => setTimeout(r, 50));
  const [port, wsPath] = fs.readFileSync(portFile, 'utf8').trim().split('\n');
  const ws = new WebSocket(`ws://127.0.0.1:${port}${wsPath}`);
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
  return { proc, cdp: new Cdp(ws), ws };
}

const RIBBONS = [['meritorious_service_award'], ['commander_commendation_award'], ['cap_achievment_award', 'capub_total_7'], ['cap_leadership_ribbon'], ['cap_membership_ribbon'], ['red_service_ribbon'], ['search_find_ribbon']];
const BADGES = ['CAPPilot1_FA9D33EA587D8', 'observer_badge', 'emergency_services_badge', 'communications_technician_badge', 'squadron_commander_badge'];

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
    for(let i = 0; i < 400; i++){ if(await ev('typeof CAPUBQuickStrip !== "undefined" && typeof CAPUBUniformView !== "undefined"').catch(() => false)) break; await sleep(50); }
    await sleep(800);

    // Wait for the drawing that follows a change (the render is coalesced into the next frame).
    await ev(`window.__settle = async () => { await new Promise(r => setTimeout(r, 150)); for(let i = 0; i < 4; i++){ await CAPUBUniformView.scheduleRender(); await new Promise(r => setTimeout(r, 60)); } }`);
    // The selections the strip changes, as JSON, and the drawn pieces by role (from the SVG on the page).
    await ev(`window.__held = () => JSON.stringify(CAPUBQuickStrip.pick(State))`);
    await ev(`window.__drawn = () => {
      const svg = document.querySelector('#uniformCanvas svg.uniformSvg');
      const roles = {};
      for(const g of svg.querySelectorAll('g.layer[data-role]')) roles[g.dataset.role] = (roles[g.dataset.role] || 0) + 1;
      const badges = [...svg.querySelectorAll('g.layer[data-role="badge"]')].map(g => g.getAttribute('data-calib-key'));
      // The Class B nametag and the cords are overlays of the shirt (garment-layer pieces): their keys say which.
      const overlays = [...svg.querySelectorAll('g.layer[data-role="garment-layer"]')].map(g => g.getAttribute('data-calib-key'));
      const nametag = !!svg.querySelector('g.layer[data-role="nametag"]') || overlays.some(k => /nametag/.test(k));
      const cord = !!svg.querySelector('g.layer[data-role="cord"]') || overlays.some(k => /cord|aiguillette|aide/.test(k));
      return { roles, badges, nametag, cord };
    }`);
    await ev(`window.__panel = () => ({ hidden: document.getElementById('quickStripPanel').classList.contains('hidden'), label: document.getElementById('quickStripBtn').textContent, pressed: document.getElementById('quickStripBtn').getAttribute('aria-pressed'), hint: document.getElementById('quickStripHint').textContent })`);
    const setup = (uniform, badges, extra) => ev(`(async () => {
      State.membership = 'senior'; State.gender = 'male'; State.rank = 'Capt'; State.uniform = ${JSON.stringify(uniform)};
      State.text = { firstName: 'Pat', lastName: 'Doe', plateLine: '', show: true };
      State.quickStrip = null; State.badgeChoices = {}; State.militaryBadges = {};
      State.ribbonSelections = {}; State.badgeSelections = {}; State.badges = [];
      for(const [id, value] of ${JSON.stringify(RIBBONS)}) State.ribbonSelections[id] = { checked: true, devices: {}, awardValue: value || '' };
      for(const id of ${JSON.stringify(badges)}){ State.badgeSelections[id] = { checked: true }; State.badges.push(id); }
      ${extra || ''}
      if(typeof syncShoulderCordControl === 'function') syncShoulderCordControl();
      refreshUI(); rebuildBadgesFromGallery(); fullRender(); CAPUBQuickStrip.adopt();
      await __settle();
    })()`);
    const press = async () => { await ev(`document.getElementById('quickStripBtn').click()`); await ev('__settle()'); };

    // ---- 1. The Class B shirt: strip and restore. ----
    await setup('blues_b', BADGES, `State.shoulderCord = 'aide_de_camp';`);
    const before = await ev('__held()');
    const sigBefore = await ev('CAPUBQuickStrip.signature()');
    const drawnBefore = await ev('__drawn()');
    const panelBefore = await ev('__panel()');
    const buildBefore = await ev('CAPUBUniformView.buildFromState()');
    console.log('before:', JSON.stringify(drawnBefore), JSON.stringify(panelBefore));
    expect(!panelBefore.hidden && panelBefore.label === 'Quick strip', 'the Quick strip button is not offered on the Class B');
    expect((drawnBefore.roles.ribbon || 0) >= 7 && drawnBefore.cord, 'the starting shirt does not show the ribbons and the cord');
    expect(drawnBefore.nametag, 'no nametag drawn before the strip');
    const wingsBefore = drawnBefore.badges.find(k => /CAPPilot1|observer_badge/.test(k));
    expect(!!wingsBefore, 'no wings drawn before the strip');

    await press();
    const stripped = JSON.parse(await ev('__held()'));
    const drawnStripped = await ev('__drawn()');
    const panelStripped = await ev('__panel()');
    const buildAfter = await ev('CAPUBUniformView.buildFromState()');
    console.log('stripped:', JSON.stringify(drawnStripped), JSON.stringify(panelStripped));
    expect(panelStripped.label === 'Restore' && panelStripped.pressed === 'true', 'the button does not read Restore after the strip');
    expect(stripped.ribbons.length === 0 && !Object.values(stripped.ribbonSelections).some(s => s.checked), 'ribbons are still selected after the strip');
    expect(JSON.stringify(stripped.badges) === JSON.stringify([wingsBefore.replace(/^badge:/, '')]), `the strip kept ${JSON.stringify(stripped.badges)}, not the drawn wings ${wingsBefore}`);
    expect(stripped.shoulderCord === null && !Object.keys(stripped.militaryBadges).length && !stripped.patches.length, 'a cord, military badge or patch is left after the strip');
    expect(!drawnStripped.roles.ribbon && !drawnStripped.roles.device && !drawnStripped.cord, 'ribbon, device or cord pieces are still drawn after the strip');
    expect(drawnStripped.badges.length === 1 && drawnStripped.badges[0] === wingsBefore, `the stripped shirt draws ${JSON.stringify(drawnStripped.badges)}, not one wings piece`);
    expect(drawnStripped.roles.grade >= 1 && drawnStripped.nametag && drawnStripped.roles.text >= 1, 'grade or nametag missing after the strip');
    expect(buildAfter.ribbons.length === 0 && buildAfter.badges.length === 1 && !buildAfter.command && !buildAfter.cord, 'the engine build is not stripped');
    if(OUT){
      fs.mkdirSync(OUT, { recursive: true });
      const rect = await ev(`(() => { const h = document.getElementById('quickStripPanel'); h.scrollIntoView({ block: 'center' }); const r = h.getBoundingClientRect(); return { x: Math.max(0, r.x - 8), y: Math.max(0, r.y - 8), width: r.width + 16, height: r.height + 16 }; })()`);
      await sleep(200);
      const shot = await S('Page.captureScreenshot', { format: 'png', clip: Object.assign({ scale: 2 }, rect) });
      fs.writeFileSync(path.join(OUT, 'quick-strip-panel-restore.png'), Buffer.from(shot.data, 'base64'));
    }

    await press();
    const restored = await ev('__held()');
    const drawnRestored = await ev('__drawn()');
    const panelRestored = await ev('__panel()');
    console.log('restored:', JSON.stringify(drawnRestored), JSON.stringify(panelRestored));
    expect(restored === before, 'Restore did not put back exactly the selections from before the strip');
    expect(JSON.stringify(drawnRestored) === JSON.stringify(drawnBefore), 'the restored drawing differs from the one before the strip');
    expect(panelRestored.label === 'Quick strip' && panelRestored.pressed === 'false', 'the button does not read Quick strip after Restore');
    expect(await ev('State.quickStrip === null'), 'the strip is still held after Restore');

    // ---- 2. Saved with the setup: strip, save, load, still stripped, Restore from the saved copy. ----
    await press();
    await ev(`(async () => { const saved = JSON.parse(JSON.stringify(CAPUB_V2.collectProfile())); CAPUB_V2.applyProfile(saved); await __settle(); })()`);
    const loaded = await ev(`({ strip: !!State.quickStrip, label: document.getElementById('quickStripBtn').textContent, drawn: __drawn() })`);
    console.log('loaded stripped:', JSON.stringify(loaded));
    expect(loaded.strip && loaded.label === 'Restore' && !loaded.drawn.roles.ribbon && loaded.drawn.badges.length === 1, 'a saved strip does not load as stripped');
    await press();
    const fromSaved = await ev(`({ ribbons: Object.keys(State.ribbonSelections).filter(id => State.ribbonSelections[id].checked).sort(), badges: State.badges, cord: State.shoulderCord, drawn: __drawn() })`);
    const want = JSON.parse(before);
    expect(JSON.stringify(fromSaved.ribbons) === JSON.stringify(Object.keys(want.ribbonSelections).filter(id => want.ribbonSelections[id].checked).sort())
      && JSON.stringify(fromSaved.badges) === JSON.stringify(want.badges) && fromSaved.cord === want.shoulderCord, 'Restore after a load did not put back the saved selections');
    expect(JSON.stringify(fromSaved.drawn) === JSON.stringify(drawnBefore), 'the drawing restored from a saved strip differs from the original');

    // ---- 3. A ribbon checked by hand ends the strip and keeps the change. ----
    await press();
    await ev(`(async () => { State.ribbonSelections.cap_membership_ribbon.checked = true; rebuildRibbonsFromGallery(); await __settle(); })()`);
    const hand = await ev(`({ strip: State.quickStrip, label: document.getElementById('quickStripBtn').textContent, ribbons: State.ribbons.map(r => r.id), drawn: __drawn() })`);
    console.log('hand change:', JSON.stringify(hand));
    expect(hand.strip === null && hand.label === 'Quick strip', 'a hand change did not end the strip');
    expect(JSON.stringify(hand.ribbons) === '["cap_membership_ribbon"]' && hand.drawn.roles.ribbon === 1, 'the ribbon checked by hand is not kept');
    // Undo steps back to the stripped shirt with its Restore (the toast says so).
    const undone = await ev(`(async () => { await new Promise(r => setTimeout(r, 50)); CAPUB_HISTORY.undo(); await __settle(); return { strip: !!State.quickStrip, label: document.getElementById('quickStripBtn').textContent, ribbons: State.ribbons.length, drawn: __drawn() }; })()`);
    console.log('undo after the hand change:', JSON.stringify(undone));
    expect(undone.strip && undone.label === 'Restore' && undone.ribbons === 0 && !undone.drawn.roles.ribbon, 'Undo after a hand change does not return to the stripped shirt');
    await press();
    // A save, load or Undo passes the held selections through the setup's sanitizer, which writes the galleries' bookkeeping (unchecked
    // entries, flags) in its own form; what is worn and drawn must be the same as before the strip.
    expect(await ev('CAPUBQuickStrip.signature()') === sigBefore, 'Restore after Undo did not put back the worn selections from before the strip');
    expect(JSON.stringify(await ev('__drawn()')) === JSON.stringify(drawnBefore), 'the drawing after Undo and Restore differs from the original');

    // ---- 4. Moving to another uniform puts everything back. ----
    await setup('blues_b', BADGES, `State.shoulderCord = 'aide_de_camp';`);
    const before4 = await ev('__held()');
    await press();
    await ev(`(async () => { document.querySelector('.uniformOption[data-uniform-id="blues_a"]').click(); await __settle(); })()`);
    const classA = await ev(`({ held: __held(), strip: State.quickStrip, panel: __panel(), drawn: __drawn() })`);
    console.log('to Class A:', JSON.stringify({ strip: classA.strip, panel: classA.panel, drawn: classA.drawn }));
    expect(classA.held === before4 && classA.strip === null, 'moving to the Class A did not put the selections back');
    expect(classA.panel.hidden, 'the Quick strip button shows on the Class A coat');
    expect((classA.drawn.roles.ribbon || 0) >= 7, 'the Class A coat does not show the ribbons after leaving the stripped shirt');

    // ---- 5. The aviator shirt keeps the wings and drops the chaplain badge; the blue shirt keeps the chaplain badge. ----
    await setup('aviator', ['CAPPilot1_FA9D33EA587D8', 'christian_chaplin', 'emergency_services_badge']);
    await press();
    const aviator = await ev(`({ badges: State.badges, drawn: __drawn(), hint: __panel().hint })`);
    console.log('aviator stripped:', JSON.stringify(aviator));
    expect(JSON.stringify(aviator.badges) === '["CAPPilot1_FA9D33EA587D8"]' && aviator.drawn.badges.length === 1 && !aviator.drawn.roles.ribbon, 'the aviator shirt is not stripped to the wings');
    await setup('blues_b', ['CAPPilot1_FA9D33EA587D8', 'christian_chaplin', 'emergency_services_badge']);
    await press();
    const chaplain = await ev(`({ badges: State.badges, drawn: __drawn() })`);
    console.log('Class B with chaplain stripped:', JSON.stringify(chaplain));
    expect(chaplain.badges.includes('christian_chaplin') && chaplain.badges.includes('CAPPilot1_FA9D33EA587D8') && chaplain.badges.length === 2 && chaplain.drawn.badges.length === 2, 'the blue shirt did not keep the wings and the mandatory chaplain badge');

    // ---- 6. Only U.S. military wings: kept on the blue shirt. ----
    const mil = await ev(`(() => { const b = (CAPUBMilitaryData.badges || []).find(b => String(b.family).toUpperCase() === 'AVIATION' && getMilitaryBadgeRepresentation(b)?.asset); return b ? b.id : null; })()`);
    if(mil){
      await setup('blues_b', ['emergency_services_badge'], `State.militaryBadges = { ${JSON.stringify(mil)}: { selected: true } };`);
      await press();
      const m = await ev(`({ badges: State.badges, military: Object.keys(State.militaryBadges) })`);
      console.log('military wings only:', JSON.stringify(m));
      expect(m.badges.length === 0 && JSON.stringify(m.military) === JSON.stringify([mil]), 'the military wings were not kept for a member without CAP wings');
    }else fails.push('no U.S. military aviation badge with artwork to test with');

    if(BUILDS){
      // For scripts/render-builds.cjs: the engine builds before and after the strip (the grade comes from membership and rank there).
      const toSpec = (name, b) => ({ name, build: { uniform: b.uniform, gender: b.gender, membership: 'senior', rank: 'Capt', opt: b.opt, name: b.name, ribbons: b.ribbons, medals: b.medals, badges: b.badges, badgeChoices: b.badgeChoices, command: b.command, militaryBadges: b.militaryBadges, patches: b.patches, cord: b.cord } });
      fs.mkdirSync(path.dirname(BUILDS), { recursive: true });
      fs.writeFileSync(BUILDS, JSON.stringify([toSpec('class-b-capt-before-strip', buildBefore), toSpec('class-b-capt-quick-stripped', buildAfter)], null, 1));
    }

    console.log(fails.length ? `FAIL:\n  ${fails.join('\n  ')}` : 'PASS: quick strip leaves grade, nametag and wings, and Restore puts every selection back');
    if(fails.length) code = 1;
  } catch (e) { console.error(e); code = 2; }
  finally { try { ws.close(); } catch {} proc.kill(); srv.close(); process.exit(code); }
})();
