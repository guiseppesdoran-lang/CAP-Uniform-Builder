#!/usr/bin/env node
'use strict';
// Browser check for the grade's ribbons (run by tests/grade-ribbons-browser.test.cjs; needs Chrome). LIVE13 E66, Ethan: "if someone
// selects a grade, it goes along with the ribbons required to get it. like for C/Lt Col, if selected, it selects all ach ribbons except
// spaatz and the encampment ribbon".
//
//   node tests/grade-ribbons-browser.cjs [--out DIR]
//
// Serves the repo, opens index.html in headless Chrome, picks Cadet, the male cut and the Class A through the setup's own controls,
// checks a ribbon no grade implies by hand (the Community Service Ribbon), then picks C/Lt Col in the Rank select: every achievement
// ribbon through the Eaker and the Encampment Ribbon are selected as earned, the Spaatz is not, the toast names them, and the drawn
// rack has a ribbon piece for each. Drops to C/SSgt: the ribbons above it are gone from State and from the drawing, the hand-checked
// one stays. --out writes a screenshot of the figure at each step. LIVE14 E73 (Ethan: "when i selected c/lt col the achievement ribbons
// popped up as selected but not encampment"): each implied ribbon is its select's first real choice (the Encampment Ribbon's is the
// McChord Basic Award, mcchord_19700, not 'earned'), and in the ribbon picker every implied tile's select shows that choice.
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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'grade-ribbons-chrome-'));
  const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--mute-audio', '--remote-debugging-port=0', `--user-data-dir=${dir}`, 'about:blank'], { stdio: 'ignore' });
  const portFile = path.join(dir, 'DevToolsActivePort');
  for(let i = 0; !fs.existsSync(portFile); i++){ if(i > 800) throw new Error('Chrome did not start'); await new Promise(r => setTimeout(r, 25)); }
  await new Promise(r => setTimeout(r, 50));
  const [port, wsPath] = fs.readFileSync(portFile, 'utf8').trim().split('\n');
  const ws = new WebSocket(`ws://127.0.0.1:${port}${wsPath}`);
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
  return { proc, cdp: new Cdp(ws), ws };
}


const IMPLIED_LT_COL = ['curry_achievement', 'hap_arnold_achievement', 'mary_feik_achievement', 'wright_brothers_award', 'rickenbacker_achievement',
  'lindbergh_achievement', 'doolittle_achievement', 'goddard_achievement', 'armstrong_achievement', 'mitchell_award', 'encampment_ribbon', 'earhart_award', 'eaker_award'];
const IMPLIED_SSGT = ['curry_achievement', 'hap_arnold_achievement', 'mary_feik_achievement', 'wright_brothers_award'];
const HAND = 'community_service_ribbon';
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
    for(let i = 0; i < 400; i++){ if(await ev('typeof CAPUBUniformView !== "undefined" && typeof capubApplyGradeRibbons === "function"').catch(() => false)) break; await sleep(50); }
    await sleep(800);
    await ev(`window.__settle = async () => { await new Promise(r => setTimeout(r, 150)); for(let i = 0; i < 4; i++){ await CAPUBUniformView.scheduleRender(); await new Promise(r => setTimeout(r, 60)); } }`);
    await ev(`window.__pick = async (id, value) => { const el = document.getElementById(id); el.value = value; el.dispatchEvent(new Event('change', { bubbles: true })); await __settle(); await new Promise(r => setTimeout(r, 500)); }`);
    // The ribbons checked in State, and the ribbon ids the drawn rack shows (one piece per ribbon, keys 'ribbon:<id>' or 'ribbon:<id>#n').
    await ev(`window.__state = () => ({
      checked: Object.keys(State.ribbonSelections).filter(id => State.ribbonSelections[id].checked),
      values: Object.fromEntries(Object.entries(State.ribbonSelections).filter(([, s]) => s.checked).map(([id, s]) => [id, s.awardValue])),
      record: State.gradeRibbons,
      drawn: [...new Set([...document.querySelectorAll('#uniformCanvas svg.uniformSvg g.layer[data-role="ribbon"]')].map(g => String(g.getAttribute('data-calib-key')).replace(/^ribbon:/, '').replace(/#\\d+$/, '')))],
      toast: document.getElementById('capubToast')?.textContent || ''
    })`);
    const shot = async name => {
      if(!OUT) return;
      fs.mkdirSync(OUT, { recursive: true });
      const r = await S('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(OUT, `grade-ribbons-${name}.png`), Buffer.from(r.data, 'base64'));
    };

    await ev(`__pick('membershipType', 'cadet')`);
    await ev(`__pick('jacketSelect', 'male')`);
    await ev(`(async () => { document.querySelector('.uniformOption[data-uniform-id="blues_a"]').click(); await __settle(); })()`);
    // Checked by hand, through the picker's own handler.
    await ev(`(async () => { setRibbonSelectionFromDropdown('${HAND}', 'hours_60'); await __settle(); })()`);

    // ---- 1. C/Lt Col. ----
    await ev(`__pick('rankSetupSelect', 'C/Lt Col')`);
    const a = await ev('__state()');
    console.log('C/Lt Col:', JSON.stringify(a));
    expect(sortJ(a.checked) === sortJ([...IMPLIED_LT_COL, HAND]), `C/Lt Col selections: ${a.checked.join(', ')}`);
    expect(!a.checked.includes('spaatz_award'), 'the Spaatz is not selected for C/Lt Col');
    const firstChoice = await ev(`Object.fromEntries(${JSON.stringify(IMPLIED_LT_COL)}.map(id => [id, getRibbonAwardOptions(id).find(o => o.value).value]))`);
    expect(firstChoice.encampment_ribbon === 'mcchord_19700', `the Encampment Ribbon's first choice: ${firstChoice.encampment_ribbon}`);
    expect(IMPLIED_LT_COL.every(id => a.values[id] === firstChoice[id]), 'each implied ribbon is its select\'s first real choice');
    // The ribbon picker, opened the way the page opens it: every implied tile's select is on that choice, the Encampment Ribbon's included.
    await ev(`(async () => { document.getElementById('expandRibbons').click(); await new Promise(r => setTimeout(r, 1500)); })()`);
    const tiles = await ev(`Object.fromEntries(${JSON.stringify(IMPLIED_LT_COL)}.map(id => { const t = document.querySelector('#galleryModalHost .ribbonSelectorTile[data-ribbon-id="' + id + '"]'); const s = t && t.querySelector('select.rbAwardSelect'); return [id, t ? { value: s.value, text: s.selectedOptions[0]?.textContent || '', line: t.querySelector('.ribbonDeviceSummary')?.textContent || '' } : null]; }))`);
    console.log('picker tiles:', JSON.stringify(tiles.encampment_ribbon), Object.values(tiles).filter(Boolean).length, 'tiles');
    for(const id of IMPLIED_LT_COL){
      const t = tiles[id];
      expect(t && t.value === firstChoice[id] && t.value !== '', `${id} tile select: ${JSON.stringify(t)}`);
      expect(t && /^Selected: /.test(t.line), `${id} tile line: ${t && t.line}`);
    }
    expect(tiles.encampment_ribbon && tiles.encampment_ribbon.text === 'Basic Award' && tiles.encampment_ribbon.line === 'Selected: Basic Award \u2022 Basic ribbon, no devices', `the Encampment tile: ${JSON.stringify(tiles.encampment_ribbon)}`);
    await shot('1b-picker');
    await ev(`document.getElementById('galleryModalCloseBtn').click()`);
    await sleep(300);
    expect(a.record && a.record.rank === 'C/Lt Col' && sortJ(a.record.ids) === sortJ(IMPLIED_LT_COL), 'the record holds the grade\'s ribbons, not the hand-checked one');
    expect(sortJ(a.drawn) === sortJ([...IMPLIED_LT_COL, HAND]), `the drawn rack: ${a.drawn.join(', ')}`);
    // LIVE13 E106 (Ethan on the thirteen-name toast: "this is dumb lol"): the toast counts the ribbons, it does not name them.
    expect(/^C\/Lt Col: 13 achievement ribbons earned on the way to this grade added \(CAPR 60-1\)\.$/.test(a.toast), `the toast counts what was added: ${a.toast}`);
    await shot('1-lt-col');

    // ---- 2. Down to C/SSgt. ----
    await ev(`__pick('rankSetupSelect', 'C/SSgt')`);
    const b = await ev('__state()');
    console.log('C/SSgt:', JSON.stringify(b));
    expect(sortJ(b.checked) === sortJ([...IMPLIED_SSGT, HAND]), `C/SSgt selections: ${b.checked.join(', ')}`);
    expect(sortJ(b.drawn) === sortJ([...IMPLIED_SSGT, HAND]), `the drawn rack after the drop: ${b.drawn.join(', ')}`);
    expect(b.checked.includes(HAND) && b.values[HAND] === 'hours_60', 'the hand-checked ribbon stays as it was');
    expect(/^9 ribbons the earlier grade had added taken off\.$/.test(b.toast), `the toast counts what was taken off: ${b.toast}`);
    await shot('2-ssgt');

    // ---- 3. Saved and loaded, the record comes back; a senior grade then takes the cadet grade's ribbons off. ----
    const saved = await ev('JSON.stringify(CAPUB_V2.collectProfile())');
    await ev(`(async () => { State.gradeRibbons = null; CAPUB_V2.applyProfile(JSON.parse(${JSON.stringify(saved)})); await __settle(); })()`);
    const c = await ev('__state()');
    expect(c.record && sortJ(c.record.ids) === sortJ(IMPLIED_SSGT), 'the record survives save and load');
    await ev(`__pick('membershipType', 'senior')`);
    await ev(`__pick('rankSetupSelect', 'Capt')`);
    const d = await ev('__state()');
    console.log('senior Capt:', JSON.stringify(d));
    expect(sortJ(d.checked) === sortJ([HAND]), `a senior grade keeps only the hand-checked ribbon: ${d.checked.join(', ')}`);

    console.log(fails.length ? `FAIL:\n  ${fails.join('\n  ')}` : 'PASS');
    if(fails.length) code = 1;
  } catch (e) { console.error(e); code = 2; }
  finally { try { ws.close(); } catch {} proc.kill(); srv.close(); process.exit(code); }
})();
