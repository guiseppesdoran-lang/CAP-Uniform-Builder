#!/usr/bin/env node
'use strict';
// Browser check for the shopping list (not part of `npm test`: needs Chrome).
//
//   node tests/shopping-list-browser.cjs [--out DIR] [--tag name] [--width 1280]
//
// Serves the repo, opens the page in headless Chrome, builds a Class B cadet officer (C/Capt) with ribbons that carry clasps, a star and a
// propeller, two badges and the Honor Guard cord, opens the shopping list from the Finish slot and checks it (LIVE13 E63, Ethan: "the shopping
// list thing. make it better, and more expansive ... dynamic search to show low prices, and include everything for only the SELECTED uniform"):
// every piece the scene draws has a line, no line belongs to another uniform, every line has a lowest price or "no price" with a vendor link,
// the search filters as you type (item, vendor, SKU), the subtotal is the sum of the lowest prices, the sort works, the text and CSV exports
// carry every line, and switching the uniform changes the list. Writes screenshots of the dialog when --out is given.
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
  const check = (ok, msg) => { if(!ok) fails.push(msg); };
  try {
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    const S = (m, p) => cdp.send(m, p, sessionId);
    const ev = async expr => { const r = await S('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if(r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    await S('Emulation.setDeviceMetricsOverride', { width: Number(opt('--width')) || 1280, height: 1000, deviceScaleFactor: 2, mobile: false });
    await S('Page.enable');
    await S('Page.addScriptToEvaluateOnNewDocument', { source: "try{localStorage.setItem('cap_uniform_builder_access_v1','1');localStorage.removeItem('CAPUB_PURCHASE_OWNED_V2')}catch(e){}" });
    await S('Page.navigate', { url: `http://127.0.0.1:${srv.address().port}/index.html` });
    for(let i = 0; i < 400; i++){ if(await ev('typeof CAPUBUniformView !== "undefined" && !!window.CAPUB_PURCHASE_FEATURE && !!document.querySelector("#purchaseListSlot #purchaseListButton")').catch(() => false)) break; await sleep(50); }
    await sleep(800);
    const shot = async name => {
      if(!OUT) return;
      fs.mkdirSync(OUT, { recursive: true });
      const rect = await ev(`(() => { const r = document.querySelector('#capubPurchaseOverlay .capub-purchase-modal').getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })()`);
      const r = await S('Page.captureScreenshot', { format: 'png', clip: Object.assign({ scale: 1 }, rect) });
      fs.writeFileSync(path.join(OUT, `${TAG}-${name}.png`), Buffer.from(r.data, 'base64'));
    };

    // The member: a cadet captain in the Class B, four ribbons with devices, two badges, the Honor Guard cord.
    const RIBBONS = { encampment_ribbon: 3, search_find_ribbon: 3, mitchell_award: 3, community_service_ribbon: 3, red_service_ribbon: 2 };
    const BADGES = ['CAPPilot1_FA9D33EA587D8', 'emergency_services_badge'];
    await ev(`(async () => {
      State.membership = 'cadet'; State.gender = 'male'; State.rank = 'C/Capt'; State.uniform = 'blues_b'; State.garment = {};
      State.text = { firstName: 'Pat', lastName: 'Doe', show: true };
      State.ribbonSelections = {}; State.ribbons = []; normalizeRibbonSelections();
      for(const [id, n] of Object.entries(${JSON.stringify(RIBBONS)})){ const o = getRibbonAwardOptions(id).filter(o => o.value); setRibbonSelectionFromDropdown(id, o[Math.min(n, o.length - 1)].value, { deferRender: true }); }
      rebuildRibbonsFromGallery();
      State.badges = ${JSON.stringify(BADGES)}; State.badgeChoices = {}; State.shoulderCord = 'honor_guard'; State.patches = [];
      await CAPUBUniformView.render();
    })()`);
    await sleep(800);
    await ev(`document.getElementById('purchaseListButton').click()`);
    await sleep(400);

    const model = () => ev(`(() => {
      const F = CAPUB_PURCHASE_FEATURE, sc = CAPUBUniformView.scene;
      const drawn = sc.layers.filter(F.drawnLayer).map(l => ({ key: (l.figure === 2 ? 'fig2:' : '') + l.key, role: l.role, id: l.id || '' }));
      const res = F.deriveList(sc, CAPUBUniformView.buildFromState(), {});
      return { title: sc.title, drawn, coverage: res.coverage, uncovered: res.uncovered,
        lines: F.list.map(l => ({ key: l.key, itemId: l.itemId || '', group: l.group, name: l.name, detail: l.detail, qty: l.qty, total: l.total, lowest: l.lowest, offers: l.offers.length, links: l.offers.map(o => o.url), unknown: !!l.unknown })) };
    })()`);
    const rows = () => ev(`[...document.querySelectorAll('#capubShopRows tr[data-key]')].filter(tr => !tr.hidden).map(tr => ({ key: tr.dataset.key, name: tr.querySelector('.capub-purchase-item-name').textContent, price: tr.querySelector('.capub-purchase-price').textContent, link: tr.querySelector('.capub-purchase-links a')?.href || '', text: tr.textContent }))`);
    const card = id => ev(`document.getElementById('${id}').textContent`);
    const dollars = s => Number(String(s).replace(/[^0-9.]/g, '')) || 0;
    const firstPrice = s => { const m = /\$(\d+\.\d\d)/.exec(s); return m ? Number(m[1]) : null; };

    // 1. Every drawn piece has a line, and every line has a link and a price or "no price".
    let m = await model();
    console.log(`${m.title}: ${m.drawn.length} drawn layers, ${m.lines.length} lines`);
    check(m.title === 'Blue Service (Class B)', 'the scene is the Class B');
    check(m.uncovered.length === 0, 'drawn layers without a line: ' + m.uncovered.join(', '));
    for(const d of m.drawn) check(!!m.coverage[d.key], `${d.key} (${d.role} ${d.id}) has no line`);
    check(!m.lines.some(l => l.unknown), 'a drawn piece fell through to an unknown line: ' + m.lines.filter(l => l.unknown).map(l => l.name).join(', '));
    for(const l of m.lines) check(l.links.length >= 1 && l.links.every(u => /^https:\/\/www\.(vanguardmil|uniforms-4u|iragreen)\.com\//.test(u)), `${l.name} has a vendor link for every offer`);
    const has = (pred, msg) => check(m.lines.some(pred), msg);
    for(const id of Object.keys(RIBBONS)) has(l => l.group === 'Ribbons' && l.key === 'ribbon:' + id, `a ribbon line for ${id}`);
    has(l => /^Devices for .*Encampment.*clasp/.test(l.name), 'the Encampment Ribbon clasps');
    has(l => /^Devices for .*Mitchell.*star/i.test(l.name), 'the Mitchell star');
    has(l => /^Devices for .*Find.*propeller/i.test(l.name), 'the Search Find propeller');
    has(l => l.itemId === 'ribbon_mount', 'the ribbon mounting bar');
    has(l => l.key === 'badge:CAPPilot1_FA9D33EA587D8' && /Regular size/.test(l.detail), 'the pilot badge, regular size');
    has(l => l.key === 'badge:emergency_services_badge', 'the ES badge');
    has(l => l.key === 'cord:honor-guard', 'the Honor Guard cord');
    has(l => l.itemId === 'nametag_blue_cadet' && /"DOE"/.test(l.detail), 'the blue cadet nametag with the name');
    has(l => l.itemId === 'cadet_epaulet_sleeves_blank', 'the blue epaulet sleeves');
    has(l => l.group === 'Grade' && /C\/Capt/.test(l.name) && /miniature/i.test(l.detail), 'the miniature metal C/Capt grade for the epaulets');
    has(l => l.group === 'Headgear' && /flight cap/i.test(l.name), 'the flight cap the figure wears');
    for(const id of ['shirt_blue_short_male', 'trousers_blue_male', 'blue_belt', 'low_quarters', 'socks_black', 'undershirt_white']) has(l => l.itemId === id, `the Class B piece ${id}`);

    // 2. Nothing from another uniform.
    const ALLOWED_ITEMS = /^(shirt_blue_short_male|blue_tie|trousers_blue_male|blue_belt|low_quarters|socks_black|undershirt_white|flight_cap_.*_male|cap_device_.*|nametag_blue_cadet|cadet_epaulet_sleeves_blank|ribbon_mount)$/;
    for(const l of m.lines){
      const ok = l.itemId ? ALLOWED_ITEMS.test(l.itemId) : /^(ribbon:|device:|badge:|cord:|grade:)/.test(l.key);
      check(ok, `a line that is not the Class B's: ${l.key} ${l.name}`);
    }
    check(!m.lines.some(l => /coat|mess|OCP|ABU|polo|aviator|blazer|gray|miniature medal|flight suit|service cap|shoulder board/i.test(l.name)), 'a line names another uniform\'s piece');

    // 3. The subtotal is the sum of the lowest prices, the estimated ones counted.
    let r = await rows();
    check(r.length === m.lines.length, `one row per line (${r.length} rows, ${m.lines.length} lines)`);
    const sum = +m.lines.reduce((s, l) => s + (l.total || 0), 0).toFixed(2);
    const shownSum = +r.reduce((s, x) => s + (firstPrice(x.price) || 0), 0).toFixed(2);
    const subtotal = dollars(await card('capubTotalComplete'));
    console.log(`subtotal ${subtotal}, sum of lines ${sum}, sum of rows ${shownSum}`);
    check(Math.abs(subtotal - sum) < 0.005, `the subtotal ${subtotal} is the sum of the lowest prices ${sum}`);
    check(Math.abs(subtotal - shownSum) < 0.005, `the subtotal ${subtotal} is the sum of the prices shown ${shownSum}`);
    const est = m.lines.filter(l => l.lowest && l.lowest.status === 'estimated').length, none = m.lines.filter(l => !l.lowest).length;
    check((await card('capubTotalMissing')) === `${est} / ${none}`, 'the estimated and unpriced counts');
    check(r.filter(x => /\*/.test(x.price)).length === est, 'every estimated price is starred');
    check(r.filter(x => /no price/.test(x.price)).length === none, 'every unpriced line says "no price"');
    await shot('0-class-b');

    // 4. The search filters as you type: by item, vendor and SKU.
    const search = async q => { await ev(`(() => { const s = document.getElementById('capubShopSearch'); s.value = ${JSON.stringify(q)}; s.dispatchEvent(new Event('input', { bubbles: true })); })()`); await sleep(100); return rows(); };
    r = await search('clasp');
    check(r.length >= 2 && r.every(x => /clasp/i.test(x.text)), `"clasp" shows only clasp lines (${r.length})`);
    const claspSum = +m.lines.filter(l => /clasp/i.test(l.name)).reduce((s, l) => s + (l.total || 0), 0).toFixed(2);
    check((await ev(`document.getElementById('capubShopShown').textContent`)).includes(`$${claspSum.toFixed(2)}`), 'the filtered subtotal is shown');
    r = await search('uniforms-4u');
    check(r.length >= 5 && r.every(x => /Uniforms-4U/.test(x.text)), `"uniforms-4u" shows the lines Uniforms-4U carries (${r.length})`);
    r = await search('3924');
    check(r.length === 1 && /blue web belt/i.test(r[0].name), 'the SKU 3924 finds the belt');
    r = await search('pilot badge');
    check(r.length === 1 && r[0].key === 'badge:CAPPilot1_FA9D33EA587D8', 'two words find the pilot badge');
    r = await search('zzzz');
    check(r.length === 0, 'a search with no match shows no rows');
    await search('ribbon');
    await shot('1-search-ribbon');
    await search('');

    // 5. Sort by price.
    await ev(`(() => { const s = document.getElementById('capubShopSort'); s.value = 'low'; s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await sleep(100);
    r = await rows();
    const priced = r.filter(x => !/no price/.test(x.price)).map(x => firstPrice(x.price));
    check(priced.every((p, i) => !i || priced[i - 1] <= p), 'low to high sorts the prices ascending');
    check(r.slice(-none).every(x => /no price/.test(x.price)), 'the lines without a price come last');
    await ev(`(() => { const s = document.getElementById('capubShopSort'); s.value = 'section'; s.dispatchEvent(new Event('change', { bubbles: true })); })()`);

    // 6. Exports carry every line.
    const text = await ev('CAPUB_PURCHASE_FEATURE.text()');
    const csv = await ev('CAPUB_PURCHASE_FEATURE.csv()');
    for(const l of m.lines) check(text.includes(l.name), `the text export lists ${l.name}`);
    const csvRows = csv.trim().split(/\r\n/);
    check(csvRows.length === m.lines.length + 1 && /^Section,Item,Detail,Quantity,Lowest unit price/.test(csvRows[0]), 'the CSV has a header and one row per line');
    check(text.includes(`Subtotal of the lowest prices: $${sum.toFixed(2)}`), 'the text export has the subtotal');

    // 7. Switching the uniform changes the list: the Class A, then the OCP.
    await ev(`(async () => { State.uniform = 'blues_a'; await CAPUBUniformView.render(); })()`);
    await sleep(900);
    const a = await model();
    check(a.title === 'Service Dress (Class A)', 'now the Class A');
    check(a.uncovered.length === 0, 'Class A: drawn layers without a line: ' + a.uncovered.join(', '));
    check(a.lines.some(l => l.itemId === 'service_coat_enlisted_male') && a.lines.some(l => l.itemId === 'cadet_officer_boards_male') && a.lines.some(l => l.itemId === 'cap_lapel_insignia'), 'Class A: the coat, the cadet officer boards and the CAP lapel insignia');
    check(!a.lines.some(l => l.itemId === 'cadet_epaulet_sleeves_blank' || l.itemId === 'shirt_blue_short_male'), 'Class A: no Class B epaulet sleeves or short-sleeve shirt');
    check(a.lines.some(l => l.itemId === 'shirt_blue_long_male' && /under the coat/.test(l.detail)), 'Class A: the long-sleeve shirt under the coat');
    check((await rows()).length === a.lines.length, 'the open dialog follows the new drawing');
    await shot('2-class-a');
    await ev(`(async () => { State.uniform = 'ocp'; await CAPUBUniformView.render(); })()`);
    await sleep(900);
    const o = await model();
    check(o.title === 'OCP Uniform', 'now the OCP');
    check(o.uncovered.length === 0, 'OCP: drawn layers without a line: ' + o.uncovered.join(', '));
    check(!o.lines.some(l => /^(Ribbons|Miniature medals|Cords)$/.test(l.group)), 'OCP: no ribbons or cords');
    check(o.lines.some(l => l.itemId === 'ocp_coat') && o.lines.some(l => l.itemId === 'ocp_name_tape' && /"DOE"/.test(l.detail)) && o.lines.some(l => l.itemId === 'boots_coyote'), 'OCP: the coat, the name tape and the boots');
    check(o.lines.some(l => l.key === 'badge:CAPPilot1_FA9D33EA587D8' && /Subdued/.test(l.detail)), 'OCP: the pilot badge in its subdued cloth form');
    check(!o.lines.some(l => /blue (service trousers|web belt)|low quarter/i.test(l.name)), 'OCP: nothing from the blues');
    await shot('3-ocp');

    console.log(fails.length ? `FAIL:\n  ${fails.join('\n  ')}` : 'PASS');
    if(fails.length) code = 1;
  } catch (e) { console.error(e); code = 2; }
  finally { try { ws.close(); } catch {} proc.kill(); srv.close(); process.exit(code); }
})();
