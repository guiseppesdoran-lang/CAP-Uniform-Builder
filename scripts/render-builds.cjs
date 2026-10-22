#!/usr/bin/env node
'use strict';
// Headless render harness for the SVG uniform engine (js/engine).
//
//   node scripts/render-builds.cjs --all --out /tmp/x [--ppi 40]
//   node scripts/render-builds.cjs builds.json --out /tmp/x
//
// For every build it writes <out>/<name>.png (rendered by headless Chrome), <out>/<name>.scene.json
// (the scene composeUniform makes in node: layers in inches, notes), plus <out>/index.html (contact
// sheet) and <out>/summary.json. See scripts/render-builds.md. No npm dependencies.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const req = p => require(path.join(ROOT, p));

const core = req('js/engine/core.js');
const G = req('js/engine/grades.js');
const P = req('js/engine/profiles.js');
req('js/engine/profiles-field.js');
req('js/engine/profiles-dress.js');
const RULES = req('data/uniform-rules.js');
const RA = req('data/ribbon-awards.js');
const BADGES = req('data/badge-catalog.js');

const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'images/MANIFEST.json'), 'utf8'));
const manifestIds = new Set(manifest.assets.map(a => a.id));
const nodeStore = () => core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(ROOT, 'images', p), 'utf8'))));

// ---- arguments ---------------------------------------------------------------------------------

function parseArgs(argv){
  const a = { all: false, out: null, ppi: 40, pad: 0.4, only: null, jobs: 4, file: null };
  for(let i = 0; i < argv.length; i++){
    const t = argv[i];
    if(t === '--all') a.all = true;
    else if(t === '--out') a.out = argv[++i];
    else if(t === '--ppi') a.ppi = Number(argv[++i]);
    else if(t === '--pad') a.pad = Number(argv[++i]);
    else if(t === '--only') a.only = new RegExp(argv[++i]);
    else if(t === '--jobs') a.jobs = Math.max(1, Number(argv[++i]));
    else if(t === '-h' || t === '--help') a.help = true;
    else if(t.startsWith('--')) throw new Error(`Unknown option ${t}`);
    else a.file = t;
  }
  return a;
}
const USAGE = `Usage:
  node scripts/render-builds.cjs --all --out DIR [--ppi 40] [--pad 0.4] [--only REGEX] [--jobs 4]
  node scripts/render-builds.cjs builds.json --out DIR [same options]`;

// ---- turning a build spec into the engine's build ---------------------------------------------

const GARMENT_DEFAULTS = { sleeve: 'short', femaleTop: 'shirt', underlayer: 'shirt', skirt: 'a-line', headgear: 'auto', chevron: '', scarf: false, jacket: true, esPatch: 'none', noGradeTrack: 'officer', plateGrade: true };

const dbg = (...a) => { if(process.env.RB_DEBUG) console.error('[render-builds]', ...a); };
const ribbonAsset = id => 'ribbon-' + String(id).replace(/_/g, '-');

// ribbonSel entries: [id, awardValue?, awardLabel?]. Same resolution the page makes (uniform-view.js).
function ribbonsFrom(sel, membership){
  const out = [];
  for(const entry of sel || []){
    const [id, awardValue, awardLabel] = Array.isArray(entry) ? entry : [entry];
    RA.resolve(id, { awardValue, awardLabel, membership }).forEach((p, i) => out.push({
      key: i ? `ribbon:${id}#${i}` : `ribbon:${id}`, id,
      title: id + (i ? ' (additional ribbon)' : ''), asset: ribbonAsset(id), devices: p.devices, centered: p.centered
    }));
  }
  return out;
}
// One miniature medal per award; devices of the extra ribbons stay on the one medal (uniform-view.js).
function medalsFrom(ribbons){
  const list = [];
  for(const r of ribbons){
    const prev = list.find(x => x.id === r.id);
    if(prev){ prev.devices = [...prev.devices, ...(r.devices || [])]; continue; }
    list.push(Object.assign({}, r, { devices: [...(r.devices || [])] }));
  }
  return list.map(r => ({ key: r.key.replace(/^ribbon:/, 'mini:'), title: r.title, ribbonAsset: r.asset, medal: `medal-${r.asset.replace(/^ribbon-/, '')}-miniature`, devices: r.devices, centered: r.centered }));
}

function makeBuild(spec){
  const membership = spec.membership || 'senior';
  const rank = spec.rank || 'Capt';
  const b = {
    uniform: spec.uniform || 'flight_suit',
    gender: spec.gender === 'female' ? 'female' : 'male',
    membership,
    grade: G.gradeInfo(membership, rank, { firstSergeant: !!spec.firstSergeant, track: spec.track || (spec.opt && spec.opt.noGradeTrack), commandChief: !!spec.commandChief }),
    opt: Object.assign({}, GARMENT_DEFAULTS, spec.opt || {}),
    name: Object.assign({ first: 'Pat', last: 'Doe', show: true }, spec.name || {}),
    ribbons: spec.ribbons || ribbonsFrom(spec.ribbonSel, membership),
    medals: spec.medals || [],
    badges: spec.badges || (spec.badgeIds || []).map(id => ({ id, title: (BADGES.get && BADGES.get(id) && BADGES.get(id).name) || id, level: null })),
    command: spec.command || null,
    militaryBadges: spec.militaryBadges || [],
    patches: spec.patches || [],
    cord: spec.cord || null
  };
  if(spec.medalSel){ b.medals = medalsFrom(b.ribbons); b.ribbons = []; }
  return b;
}

// ---- the standard matrix (--all) --------------------------------------------------------------

const MEMBERS = [
  { tag: 'cadet-C-SSgt', membership: 'cadet', rank: 'C/SSgt',
    ribbons: [['wright_brothers_award'], ['hap_arnold_achievement'], ['curry_achievement'], ['cap_achievment_award', 'capub_total_7'], ['community_service_ribbon'], ['cadet_special_activity_ribbon'], ['encampment_ribbon']] },
  { tag: 'cadet-C-Maj', membership: 'cadet', rank: 'C/Maj',
    ribbons: [['mitchell_award', 'earned_cos_star'], ['armstrong_achievement'], ['rickenbacker_achievement'], ['wright_brothers_award'], ['curry_achievement'], ['cap_achievment_award', 'capub_total_7'], ['encampment_ribbon']] },
  { tag: 'senior-SMSgt', membership: 'senior', rank: 'SMSgt',
    ribbons: [['unit_citation_award'], ['cap_achievment_award', 'capub_total_7'], ['cap_membership_ribbon'], ['cap_leadership_ribbon'], ['red_service_ribbon'], ['search_find_ribbon'], ['encampment_ribbon']] },
  { tag: 'senior-Capt', membership: 'senior', rank: 'Capt',
    ribbons: [['meritorious_service_award'], ['commander_commendation_award'], ['cap_achievment_award', 'capub_total_7'], ['cap_leadership_ribbon'], ['cap_membership_ribbon'], ['red_service_ribbon'], ['search_find_ribbon']] },
  { tag: 'senior-Col', membership: 'senior', rank: 'Col',
    ribbons: [['distinguished_service_award'], ['exceptional_service_award'], ['meritorious_service_award'], ['cap_achievment_award', 'capub_total_7'], ['cap_gill_robb_wilson_ribbon'], ['cap_command_service_ribbon'], ['cap_membership_ribbon']] }
];
const AVIATION_BADGE = { cadet: 'AirCrew1_DB3F0FCC3650F', senior: 'CAPPilot1_FA9D33EA587D8' };
const SPECIALTY_BADGE = 'emergency_services_badge';
const CHAPLAIN_BADGE = 'christian_chaplin';
const SHOULDER_CORD = 'wing';

// Ribbon ids in CAPR 39-3 precedence order (the ribbonList in js/catalog.js), highest first.
function precedenceIndex(){
  const src = fs.readFileSync(path.join(ROOT, 'js/catalog.js'), 'utf8');
  const m = /const ribbonList = (\[[\s\S]*?\n\]);/.exec(src);
  if(!m) return new Map();
  const list = Function(`return ${m[1]}`)();
  return new Map(list.map((id, i) => [id, i]));
}

function matrix(){
  const prec = precedenceIndex();
  const ok = [], skipped = [], warnings = [];
  const aliasOf = id => id.toLowerCase() === 'air_force_organizational_excellence_award' ? 'Air_Force_Organizational_Excellence_Award' : id;
  for(const uniform of Object.keys(RULES.RULES)){
    const rule = RULES.RULES[uniform];
    for(const gender of ['male', 'female']){
      for(const m of MEMBERS){
        const name = `${uniform}-${gender}-${m.tag}`;
        if(!RULES.isUniformAllowedFor(uniform, m.membership, { rank: m.rank })){
          skipped.push({ name, reason: `${uniform} is not offered to ${m.membership} ${m.rank}` });
          continue;
        }
        const spec = { uniform, gender, membership: m.membership, rank: m.rank, name: { first: 'Pat', last: 'Doe', show: true } };
        spec.opt = { rackColumns: 3, rackArrangement: 'lapel', miniStyle: 'mounting' };
        const mini = RULES.allowsMiniMedals(uniform);
        if(RULES.allowsRibbons(uniform) || mini){
          const sel = m.ribbons.map(r => [aliasOf(r[0]), r[1]]).filter(([id]) => {
            const good = manifestIds.has(ribbonAsset(id)) && RA.resolve(id, {}).length;
            if(!good) warnings.push(`${name}: ribbon ${id} has no artwork or no resolver; left out`);
            return good;
          }).sort((a, b) => (prec.has(a[0]) ? prec.get(a[0]) : 1e9) - (prec.has(b[0]) ? prec.get(b[0]) : 1e9));
          spec.ribbonSel = sel;
          if(mini) spec.medalSel = true;
        }
        if(rule.chaplainBadgeOnly){
          if(m.membership === 'senior') spec.badgeIds = [CHAPLAIN_BADGE];
        } else {
          const cap = rule.badgeCap == null ? 2 : rule.badgeCap;
          spec.badgeIds = [AVIATION_BADGE[m.membership], SPECIALTY_BADGE].slice(0, Math.max(cap, 0));
        }
        if(RULES.allowsShoulderCord(uniform, m.membership)) spec.cord = SHOULDER_CORD;
        ok.push({ name, build: spec });
      }
    }
  }
  return { builds: ok, skipped, warnings };
}

// ---- static server ----------------------------------------------------------------------------

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf' };

const HARNESS = `<!doctype html><meta charset="utf-8"><title>render</title>
<style>html,body{margin:0;padding:0;background:#fff}svg{display:block}</style>
<div id="out"></div>
${['core', 'awards', 'grades', 'compose'].map(f => `<script src="/js/engine/${f}.js"></script>`).join('\n')}
<script src="/data/ribbon-awards.js"></script><script src="/data/badge-catalog.js"></script>
${['profiles', 'profiles-field', 'profiles-dress', 'measure-layout', 'render-svg'].map(f => `<script src="/js/engine/${f}.js"></script>`).join('\n')}
<script>
window.__warnings = [];
['warn', 'error'].forEach(k => { const o = console[k].bind(console); console[k] = (...a) => { window.__warnings.push(a.map(String).join(' ')); o(...a); }; });
window.addEventListener('error', e => window.__warnings.push('error: ' + e.message));
window.__ready = (async () => {
  const E = CAPUBEngine; E.assetUrl = p => '/images/' + p;
  const manifest = await fetch('/images/MANIFEST.json').then(r => r.json());
  window.__store = E.core.createSpecStore(manifest, p => fetch('/images/' + p).then(r => r.json()));
  return true;
})();
window.renderBuild = async function(build, ppi, pad){
  const E = CAPUBEngine, store = window.__store;
  window.__warnings.length = 0;
  const scene = await E.profiles.composeUniform(build, store);
  const b = scene.bounds;
  const widthPx = Math.ceil((b.w + 2 * pad) * ppi);
  const svg = await E.renderSvg.buildSvg(scene, id => store.entry(id).path, { pad, widthPx });
  const heightPx = Math.ceil((b.h + 2 * pad) * ppi);
  svg.setAttribute('width', widthPx); svg.setAttribute('height', heightPx);
  const o = document.getElementById('out'); o.innerHTML = ''; o.append(svg);
  const imgs = [...svg.querySelectorAll('image')];
  await Promise.all(imgs.map(im => im.decode ? im.decode().catch(() => {}) : null));
  await (document.fonts && document.fonts.ready);
  await new Promise(r => setTimeout(r, 30)); // not rAF: it never fires in a background tab
  return { w: widthPx, h: heightPx, layers: scene.layers.length, notes: scene.notes, warnings: window.__warnings.slice() };
};
</script>`;

function startServer(){
  return new Promise((resolve, reject) => {
    const server = http.createServer((rq, rs) => {
      let p = decodeURIComponent(new URL(rq.url, 'http://x').pathname);
      if(p === '/__harness.html'){ rs.writeHead(200, { 'content-type': MIME['.html'], 'cache-control': 'no-store' }); return rs.end(HARNESS); }
      const file = path.normalize(path.join(ROOT, p));
      if(file !== ROOT && !file.startsWith(ROOT + path.sep)){ rs.writeHead(403); return rs.end(); }
      fs.readFile(file, (err, data) => {
        if(err){ rs.writeHead(404); return rs.end('not found'); }
        rs.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' });
        rs.end(data);
      });
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

// ---- one Chrome, driven over the DevTools protocol ---------------------------------------------

class Cdp {
  constructor(ws){
    this.ws = ws; this.id = 0; this.pending = new Map();
    ws.addEventListener('message', ev => {
      const m = JSON.parse(ev.data);
      if(m.id && this.pending.has(m.id)){
        const { res, rej } = this.pending.get(m.id); this.pending.delete(m.id);
        m.error ? rej(new Error(`${m.error.message}`)) : res(m.result);
      }
    });
    ws.addEventListener('close', () => { for(const { rej } of this.pending.values()) rej(new Error('Chrome connection closed')); this.pending.clear(); });
  }
  send(method, params, sessionId){
    const id = ++this.id;
    return new Promise((res, rej) => {
      const timer = setTimeout(() => { this.pending.delete(id); rej(new Error(`Chrome did not answer ${method} within 60 s`)); }, 60000);
      this.pending.set(id, { res: v => { clearTimeout(timer); res(v); }, rej: e => { clearTimeout(timer); rej(e); } });
      this.ws.send(JSON.stringify(Object.assign({ id, method, params: params || {} }, sessionId ? { sessionId } : {})));
    });
  }
}

async function launchChrome(){
  if(!fs.existsSync(CHROME)) throw new Error(`Chrome not found at ${CHROME} (set CHROME=/path/to/chrome)`);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'render-builds-chrome-'));
  const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', '--mute-audio', '--remote-debugging-port=0', `--user-data-dir=${dir}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  proc.stderr.on('data', d => { stderr += d; });
  const portFile = path.join(dir, 'DevToolsActivePort');
  const t0 = Date.now();
  while(!fs.existsSync(portFile)){
    if(proc.exitCode != null) throw new Error(`Chrome exited early: ${stderr.slice(-500)}`);
    if(Date.now() - t0 > 20000) throw new Error('Timed out waiting for Chrome');
    await new Promise(r => setTimeout(r, 25));
  }
  await new Promise(r => setTimeout(r, 25));
  const [port, wsPath] = fs.readFileSync(portFile, 'utf8').trim().split('\n');
  const ws = new WebSocket(`ws://127.0.0.1:${port}${wsPath}`);
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', () => rej(new Error('Could not connect to Chrome DevTools'))); });
  return { proc, dir, cdp: new Cdp(ws), ws };
}

async function openPage(cdp, url){
  const { targetId } = await cdp.send('Target.createTarget', { url });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  const ev = async (expression) => {
    const r = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, timeout: 60000 }, sessionId);
    if(r.exceptionDetails) throw new Error((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text);
    return r.result.value;
  };
  for(let i = 0; i < 400; i++){
    const ready = await ev('typeof window.__ready').catch(() => 'undefined');
    if(ready === 'object') break;
    await new Promise(r => setTimeout(r, 25));
  }
  dbg('page script ready');
  await ev('window.__ready');
  return { targetId, sessionId, ev };
}

// ---- output ------------------------------------------------------------------------------------

const safe = s => String(s).replace(/[^A-Za-z0-9._-]+/g, '-');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function contactSheet(summary){
  const byUniform = new Map();
  for(const b of summary.builds){
    const u = (b.build && b.build.uniform) || 'other';
    if(!byUniform.has(u)) byUniform.set(u, []);
    byUniform.get(u).push(b);
  }
  const card = b => {
    const notes = (b.notes || []).map(n => `<li class="${/^No artwork for/.test(n) ? 'bad' : /artwork/i.test(n) ? 'warn' : ''}">${esc(n)}</li>`).join('');
    const warn = (b.warnings || []).map(n => `<li class="warn">${esc(n)}</li>`).join('');
    const img = b.error ? `<div class="err">${esc(b.error)}</div>` : `<a href="${esc(b.png)}"><img loading="lazy" src="${esc(b.png)}" alt="${esc(b.name)}"></a>`;
    return `<figure class="${b.error || b.missingArtwork.length ? 'flag' : ''}" data-name="${esc(b.name)}"><figcaption><b>${esc(b.name)}</b> <a href="${esc(b.scene)}">scene.json</a> <span>${b.px ? b.px.join('x') + 'px' : ''}</span></figcaption>${img}<ul>${notes}${warn}</ul></figure>`;
  };
  const sections = [...byUniform].map(([u, list]) => `<section><h2>${esc(u)} <small>${list.length}</small></h2><div class="grid">${list.map(card).join('')}</div></section>`).join('\n');
  return `<!doctype html><meta charset="utf-8"><title>Uniform renders</title>
<style>
body{font:13px system-ui,sans-serif;margin:16px;background:#eef0f4;color:#1b2430}
h1{font-size:18px;margin:0 0 4px}h2{font-size:15px;margin:24px 0 8px;border-bottom:1px solid #c5ccd8}h2 small{color:#667}
.meta{color:#556;margin-bottom:8px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px}
figure{margin:0;background:#fff;border:1px solid #d3d9e3;border-radius:6px;padding:8px}figure.flag{border-color:#c0392b}
figcaption{margin-bottom:6px;word-break:break-all}figcaption span{color:#889}
img{width:100%;height:340px;object-fit:contain;background:#fff;display:block}
ul{margin:6px 0 0;padding-left:16px;font-size:11px;color:#445}li.bad{color:#c0392b;font-weight:600}li.warn{color:#a86a00}
.err{color:#c0392b;white-space:pre-wrap}input{padding:4px 8px;width:260px}
</style>
<h1>Uniform renders</h1>
<div class="meta">${summary.count} builds, ${summary.failed} failed, ${summary.withMissingArtwork} with missing artwork, ${summary.ppi} px/in, ${summary.elapsedMs} ms. <input id="f" placeholder="filter by name"></div>
${sections}
<script>document.getElementById('f').addEventListener('input',e=>{const q=e.target.value.toLowerCase();document.querySelectorAll('figure').forEach(f=>{f.style.display=f.dataset.name.toLowerCase().includes(q)?'':'none'})})</script>`;
}

// ---- main --------------------------------------------------------------------------------------

async function main(){
  const args = parseArgs(process.argv.slice(2));
  if(args.help || (!args.all && !args.file) || !args.out){ console.log(USAGE); process.exit(args.help ? 0 : 2); }
  const started = Date.now();
  fs.mkdirSync(args.out, { recursive: true });

  let builds, skipped = [], warnings = [];
  if(args.all){
    ({ builds, skipped, warnings } = matrix());
  } else {
    builds = JSON.parse(fs.readFileSync(args.file, 'utf8'));
    if(!Array.isArray(builds)) throw new Error('The builds file must be a JSON array of {name, build}');
  }
  builds = builds.map((b, i) => ({ name: safe(b.name || `build-${i + 1}`), build: b.build || {} }));
  if(args.only) builds = builds.filter(b => args.only.test(b.name));
  const names = new Set();
  for(const b of builds){ if(names.has(b.name)) throw new Error(`Duplicate build name ${b.name}`); names.add(b.name); }

  const store = nodeStore();
  const server = await startServer();
  const url = `http://127.0.0.1:${server.address().port}/__harness.html`;
  let chrome = null;
  const cleanup = () => {
    try{ if(chrome){ chrome.ws.close(); chrome.proc.kill('SIGKILL'); fs.rmSync(chrome.dir, { recursive: true, force: true }); } }catch(e){ /* best effort */ }
    try{ server.close(); server.closeAllConnections && server.closeAllConnections(); }catch(e){ /* best effort */ }
  };
  process.on('SIGINT', () => { cleanup(); process.exit(130); });

  const results = new Array(builds.length);
  try{
    chrome = await launchChrome();
    dbg('chrome up');
    const pages = [];
    dbg('server', url);
    for(let i = 0; i < Math.min(args.jobs, builds.length || 1); i++) pages.push(await openPage(chrome.cdp, url));
    let next = 0;
    const worker = async page => {
      for(;;){
        const i = next++;
        if(i >= builds.length) return;
        const { name, build: spec } = builds[i];
        const t0 = Date.now();
        const r = { name, build: spec, png: `${name}.png`, scene: `${name}.scene.json`, notes: [], missingArtwork: [], warnings: [], error: null };
        try{
          const build = makeBuild(spec);
          const scene = await P.composeUniform(build, store);
          const b = scene.bounds;
          r.notes = scene.notes.slice();
          r.missingArtwork = r.notes.filter(n => /^No artwork for/.test(n));
          fs.writeFileSync(path.join(args.out, r.scene), JSON.stringify({
            name, build: spec, title: scene.title, unit: 'inches (scene x right, y down, origin at the garment top-left)',
            bounds: b, ppi: args.ppi, pad: args.pad,
            viewBox: [b.x - args.pad, b.y - args.pad, b.w + 2 * args.pad, b.h + 2 * args.pad].map(n => +n.toFixed(4)),
            notes: scene.notes, layers: scene.layers
          }, null, 1));
          const shot = await page.ev(`renderBuild(${JSON.stringify(build)}, ${args.ppi}, ${args.pad})`);
          r.px = [shot.w, shot.h];
          r.warnings = shot.warnings;
          if(shot.layers !== scene.layers.length) r.warnings.push(`browser composed ${shot.layers} layers, node ${scene.layers.length}`);
          await chrome.cdp.send('Emulation.setDeviceMetricsOverride', { width: shot.w, height: shot.h, deviceScaleFactor: 1, mobile: false }, page.sessionId);
          const png = await chrome.cdp.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: shot.w, height: shot.h, scale: 1 }, captureBeyondViewport: false }, page.sessionId);
          fs.writeFileSync(path.join(args.out, r.png), Buffer.from(png.data, 'base64'));
        }catch(e){
          r.error = (e && e.stack || String(e)).split('\n').slice(0, 4).join('\n');
          r.png = null;
        }
        r.ms = Date.now() - t0;
        results[i] = r;
        process.stderr.write(`${r.error ? 'FAIL' : r.missingArtwork.length ? 'GAP ' : 'ok  '} ${name} ${r.ms}ms\n`);
      }
    };
    await Promise.all(pages.map(worker));
  } finally {
    cleanup();
  }

  const elapsedMs = Date.now() - started;
  const summary = {
    generated: new Date().toISOString(), command: process.argv.slice(1).join(' '), ppi: args.ppi, pad: args.pad,
    count: results.length, failed: results.filter(r => r.error).length,
    withMissingArtwork: results.filter(r => r.missingArtwork.length).length,
    elapsedMs, skipped, matrixWarnings: warnings,
    builds: results.map(r => ({ name: r.name, build: r.build, png: r.png, scene: r.scene, px: r.px, notes: r.notes, missingArtwork: r.missingArtwork, artworkNotes: r.notes.filter(n => /artwork/i.test(n) && !/^No artwork for/.test(n)), warnings: r.warnings, error: r.error, ms: r.ms }))
  };
  fs.writeFileSync(path.join(args.out, 'summary.json'), JSON.stringify(summary, null, 1));
  fs.writeFileSync(path.join(args.out, 'index.html'), contactSheet(summary));
  console.log(`${summary.count} builds in ${(elapsedMs / 1000).toFixed(1)}s (${summary.count ? Math.round(elapsedMs / summary.count) : 0} ms/build): ${summary.failed} failed, ${summary.withMissingArtwork} with "No artwork for", ${skipped.length} combinations skipped (uniform not offered).`);
  console.log(`Wrote ${path.join(args.out, 'index.html')} and summary.json`);
  process.exitCode = summary.failed ? 1 : 0;
}

main().catch(e => { console.error(e.stack || e); process.exit(1); });
