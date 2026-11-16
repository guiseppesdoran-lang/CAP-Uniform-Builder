#!/usr/bin/env node
'use strict';
// Load-time measurement for the page (LIVE13 E65; not part of `npm test`: needs Chrome and takes minutes).
//
//   node scripts/perf-measure.cjs [--root DIR] [--profile fast|slow|none] [--runs N] [--cache disabled|cold|warm]
//                                 [--headers before|policy] [--trace] [--json OUT]
//
// Serves DIR (default: the repository) over HTTP/2 with TLS, gzip for text and ETag/Last-Modified validation, as
// Caddy does behind Cloudflare in production (deploy/Caddyfile.tunnel). --headers before sends no Cache-Control except
// no-cache on the page (the Caddyfile before E65); --headers policy sends scripts/cache-policy.cjs's headers.
// Opens the page in headless Chrome under Network.emulateNetworkConditions and 4x CPU throttling:
//   fast = 10 Mbit/s down, 5 Mbit/s up, 40 ms RTT;  slow = 1.6 Mbit/s down, 750 kbit/s up, 150 ms RTT.
// --cache disabled turns Chrome's cache off (Network.setCacheDisabled); cold is an empty cache in a new browser
// context; warm loads the page once in the context and measures the second visit.
//
// Each run: first paint, DOMContentLoaded, load; when the access gate's buttons answer (their listeners are attached
// and the gate is painted); when the app is ready (DOMContentLoaded handlers done); then the setup is chosen through
// the controls (Senior member, Capt, male cut, Blues Class A, as a member would click them) and the time until the
// uniform is drawn. The setup is chosen twice in separate runs: "at once" (as soon as the controls answer) and
// "settled" (after the page has been quiet on the network for 1.5 s, as a member who reads the page first).
// Also: bytes and requests by type, long tasks, long animation frames with their scripts and, with --trace, each
// script's compile and evaluate time from a DevTools trace.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http2 = require('node:http2');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const ROOT = path.resolve(opt('--root', path.join(__dirname, '..')));
const PROFILE = opt('--profile', 'slow');
const RUNS = Number(opt('--runs', 3));
const CACHE = opt('--cache', 'disabled');
const HEADERS = opt('--headers', 'before');
const TRACE = args.includes('--trace');
const JSON_OUT = opt('--json', null);
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const PROFILES = {
  none: null,
  fast: { latency: 40, downloadThroughput: 10e6 / 8, uploadThroughput: 5e6 / 8 },
  slow: { latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 750e3 / 8 }
};
const CPU_RATE = PROFILE === 'none' ? 1 : 4;

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.mjs': 'text/javascript; charset=utf-8', '.md': 'text/markdown', '.txt': 'text/plain' };
// What Caddy's encode compresses by default (text, JSON, JavaScript, SVG); images and small bodies go as they are.
const COMPRESSIBLE = /^(text\/|application\/json|image\/svg\+xml|application\/javascript)/;
const policy = HEADERS === 'policy' ? require('./cache-policy.cjs') : null;

function cert(){
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'perf-cert-'));
  const key = path.join(dir, 'key.pem'), crt = path.join(dir, 'crt.pem');
  const r = spawnSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', crt, '-days', '1', '-subj', '/CN=127.0.0.1', '-addext', 'subjectAltName=IP:127.0.0.1'], { encoding: 'utf8' });
  if(r.status !== 0) throw new Error('openssl failed: ' + r.stderr);
  // Chrome is told to trust this key (--ignore-certificate-errors-spki-list) rather than to ignore certificate errors:
  // it does not keep responses that came with a certificate error in its HTTP cache, which would spoil a warm visit.
  const der = spawnSync('openssl', ['x509', '-in', crt, '-pubkey', '-noout'], { encoding: 'utf8' }).stdout;
  const spki = crypto.createHash('sha256').update(crypto.createPublicKey(der).export({ type: 'spki', format: 'der' })).digest('base64');
  return { key: fs.readFileSync(key), cert: fs.readFileSync(crt), spki };
}
const CERT = cert();

const gzCache = new Map();
function serve(){
  return new Promise(res => {
    const srv = http2.createSecureServer({ allowHTTP1: true, key: CERT.key, cert: CERT.cert }, (req, rsp) => {
      const urlPath = decodeURIComponent(req.url.split('?')[0]);
      const rel = urlPath.replace(/\/$/, '/index.html').replace(/^\//, '');
      const file = path.join(ROOT, rel);
      if(!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()){ rsp.writeHead(404); return rsp.end(); }
      const st = fs.statSync(file);
      const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
      const etag = `"${st.mtimeMs.toString(36)}${st.size.toString(36)}"`;
      const headers = { 'content-type': type, etag, 'last-modified': st.mtime.toUTCString(), vary: 'Accept-Encoding' };
      if(policy) Object.assign(headers, policy.headersFor('/' + rel, req.url));
      else if(rel === 'index.html') headers['cache-control'] = 'no-cache';
      if(req.headers['if-none-match'] === etag){ rsp.writeHead(304, headers); return rsp.end(); }
      const accepts = String(req.headers['accept-encoding'] || '');
      let body = fs.readFileSync(file);
      if(COMPRESSIBLE.test(type) && body.length >= 512 && /\bgzip\b/.test(accepts)){
        // A precompressed sibling is served as it is, brotli first (Caddy file_server precompressed br gzip); otherwise
        // gzip on the fly (Caddy encode).
        const key = file + ':' + st.mtimeMs;
        if(/\bbr\b/.test(accepts) && fs.existsSync(file + '.br')){ body = fs.readFileSync(file + '.br'); headers['content-encoding'] = 'br'; }
        else if(fs.existsSync(file + '.gz')){ body = fs.readFileSync(file + '.gz'); headers['content-encoding'] = 'gzip'; }
        else { if(!gzCache.has(key)) gzCache.set(key, zlib.gzipSync(body, { level: 5 })); body = gzCache.get(key); headers['content-encoding'] = 'gzip'; }
      }
      headers['content-length'] = body.length;
      rsp.writeHead(200, headers);
      rsp.end(req.method === 'HEAD' ? undefined : body);
    }).listen(0, '127.0.0.1', () => res(srv));
  });
}

class Cdp {
  constructor(ws){
    this.ws = ws; this.id = 0; this.pending = new Map(); this.handlers = [];
    ws.addEventListener('message', m => {
      const d = JSON.parse(m.data);
      if(d.id){ const p = this.pending.get(d.id); if(p){ this.pending.delete(d.id); d.error ? p.rej(new Error(d.error.message)) : p.res(d.result); } return; }
      for(const h of this.handlers) h(d);
    });
  }
  send(method, params, sessionId){
    const id = ++this.id;
    return new Promise((res, rej) => {
      // A command Chrome never answers (seen with Tracing.end on a long throttled load) fails the run instead of hanging it.
      const timer = setTimeout(() => { this.pending.delete(id); rej(new Error(`${method} timed out`)); }, 120000);
      this.pending.set(id, { res: v => { clearTimeout(timer); res(v); }, rej: e => { clearTimeout(timer); rej(e); } });
      this.ws.send(JSON.stringify({ id, method, params: params || {}, ...(sessionId ? { sessionId } : {}) }));
    });
  }
  on(fn){ this.handlers.push(fn); return () => { this.handlers = this.handlers.filter(h => h !== fn); }; }
}

async function launch(){
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'perf-chrome-'));
  const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--mute-audio', `--ignore-certificate-errors-spki-list=${CERT.spki}`, '--disable-background-networking', '--disable-extensions', '--remote-debugging-port=0', `--user-data-dir=${dir}`, 'about:blank'], { stdio: 'ignore' });
  const portFile = path.join(dir, 'DevToolsActivePort');
  for(let i = 0; !fs.existsSync(portFile); i++){ if(i > 800) throw new Error('Chrome did not start'); await sleep(25); }
  await sleep(50);
  const [port, wsPath] = fs.readFileSync(portFile, 'utf8').trim().split('\n');
  const ws = new WebSocket(`ws://127.0.0.1:${port}${wsPath}`);
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
  return { proc, cdp: new Cdp(ws), ws };
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Runs in the page before any of its scripts.
const PROBE = `(() => {
  const P = window.__perf = { marks: {}, longtasks: [], loafs: [], renders: [] };
  const now = () => performance.now();
  try { new PerformanceObserver(l => l.getEntries().forEach(e => P.longtasks.push({ start: e.startTime, dur: e.duration }))).observe({ type: 'longtask', buffered: true }); } catch (e) {}
  try { new PerformanceObserver(l => l.getEntries().forEach(e => P.loafs.push({ start: e.startTime, dur: e.duration, blocking: e.blockingDuration,
    scripts: (e.scripts || []).map(s => ({ src: s.sourceURL, fn: s.sourceFunctionName, invoker: s.invoker, dur: s.duration, compile: s.forcedStyleAndLayoutDuration })) })))
    .observe({ type: 'long-animation-frame', buffered: true }); } catch (e) {}
  const add = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function(type, fn, o){
    if(this && this.id === 'accessGateGuest' && type === 'click' && P.marks.gateWired == null) P.marks.gateWired = now();
    return add.call(this, type, fn, o);
  };
  document.addEventListener('DOMContentLoaded', () => { P.marks.dclStart = now(); setTimeout(() => { P.marks.appReady = now(); }, 0); });
  document.addEventListener('capub:rendered', () => P.renders.push(now()));
})();`;

// Chooses the setup through the controls, as clicks would, and resolves when the uniform is drawn.
const SETUP = `(async () => {
  const t0 = performance.now();
  const set = (id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); };
  const seen = window.__perf.renders.length;
  set('membershipType', 'senior');
  set('rankSetupSelect', 'Capt');
  set('jacketSelect', 'male');
  document.querySelector('#uniformList .uniformOption[data-uniform-id="blues_a"]').click();
  for(let i = 0; i < 1200; i++){
    const host = document.getElementById('uniformCanvas');
    if(window.__perf.renders.length > seen && host && host.querySelector('svg.uniformSvg')) break;
    await new Promise(r => setTimeout(r, 10));
  }
  const t1 = performance.now();
  return { t0, t1, ok: !!document.querySelector('#uniformCanvas svg.uniformSvg') };
})()`;

const COLLECT = `(() => {
  const nav = performance.getEntriesByType('navigation')[0];
  const paint = Object.fromEntries(performance.getEntriesByType('paint').map(p => [p.name, p.startTime]));
  const gate = document.getElementById('accessGate');
  return {
    fp: paint['first-paint'], fcp: paint['first-contentful-paint'],
    dcl: nav.domContentLoadedEventEnd, load: nav.loadEventEnd,
    marks: window.__perf.marks, longtasks: window.__perf.longtasks, loafs: window.__perf.loafs,
    dom: document.getElementsByTagName('*').length, imgs: document.images.length,
    galleries: Object.fromEntries(['ribbonGallery', 'badgeGallery', 'patchGallery', 'militaryRibbonGallery', 'galleryModalHost'].map(id => [id, document.getElementById(id) ? document.getElementById(id).getElementsByTagName('*').length : null])),
    access: document.documentElement.dataset.access || '', gateShown: !!gate && getComputedStyle(gate).display !== 'none'
  };
})()`;

function typeOf(r){
  const t = r.type || 'Other';
  return t;
}

async function run(cdp, mode, url){
  const { browserContextId } = await cdp.send('Target.createBrowserContext');
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank', browserContextId });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  const S = (m, p) => cdp.send(m, p, sessionId);
  const ev = async expr => { const r = await S('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if(r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
  await S('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await S('Page.enable');
  await S('Network.enable', { maxTotalBufferSize: 0 });
  if(CACHE === 'disabled') await S('Network.setCacheDisabled', { cacheDisabled: true });
  await S('Page.addScriptToEvaluateOnNewDocument', { source: PROBE });

  const reqs = new Map();
  let phase = 'load';
  let lastNet = Date.now();
  const inflight = new Set();
  const off = cdp.on(d => {
    if(d.sessionId !== sessionId) return;
    const p = d.params || {};
    if(d.method === 'Network.requestWillBeSent'){ inflight.add(p.requestId); lastNet = Date.now(); if(!reqs.has(p.requestId)) reqs.set(p.requestId, { url: p.request.url, type: p.type, phase, bytes: 0, status: 0, fromCache: false, t0: p.timestamp, priority: p.request.initialPriority }); }
    else if(d.method === 'Network.responseReceived'){ const r = reqs.get(p.requestId); if(r){ r.type = p.type || r.type; r.status = p.response.status; r.fromCache = !!(p.response.fromDiskCache || p.response.fromServiceWorker); r.protocol = p.response.protocol; } }
    else if(d.method === 'Network.requestServedFromCache'){ const r = reqs.get(p.requestId); if(r) r.fromCache = true; }
    else if(d.method === 'Network.loadingFinished'){ inflight.delete(p.requestId); lastNet = Date.now(); const r = reqs.get(p.requestId); if(r){ r.bytes = p.encodedDataLength; r.t1 = p.timestamp; } }
    else if(d.method === 'Network.loadingFailed'){ inflight.delete(p.requestId); lastNet = Date.now(); const r = reqs.get(p.requestId); if(r) r.failed = p.errorText; }
  });

  const waitLoad = async () => { for(let i = 0; i < 2400; i++){ if(await ev('document.readyState === "complete"').catch(() => false)) return; await sleep(25); } throw new Error('page did not load'); };
  const waitQuiet = async ms => { for(let i = 0; i < 2400; i++){ if(!inflight.size && Date.now() - lastNet > ms) return; await sleep(50); } };

  if(mode.warm){
    await S('Page.navigate', { url });
    await waitLoad(); await waitQuiet(1000);
    await ev(SETUP); await waitQuiet(1000);
    await ev("try{sessionStorage.clear();localStorage.removeItem('capub_uniform_builder_autosave_v1')}catch(e){}");
    reqs.clear();
  }
  const net = PROFILES[PROFILE];
  if(net) await S('Network.emulateNetworkConditions', Object.assign({ offline: false }, net));
  if(CPU_RATE > 1) await S('Emulation.setCPUThrottlingRate', { rate: CPU_RATE });

  let traceEvents = null;
  if(TRACE && mode.trace){
    traceEvents = [];
    mode.traceDone = new Promise(res => { mode.offTrace = cdp.on(d => {
      if(d.sessionId !== sessionId) return;
      if(d.method === 'Tracing.dataCollected') traceEvents.push(...d.params.value);
      if(d.method === 'Tracing.tracingComplete') res();
    }); });
    await S('Tracing.start', { transferMode: 'ReportEvents', traceConfig: { includedCategories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'v8', 'v8.execute', 'disabled-by-default-v8.compile', 'blink.user_timing', 'loading'] } });
  }

  const wall0 = Date.now();
  await S('Page.navigate', { url });
  let setup = null;
  if(mode.setup === 'once'){
    // As soon as the setup controls answer (DOMContentLoaded handlers done), without waiting for load.
    await sleep(20);
    for(let i = 0; i < 6000; i++){ if(await ev('!!(window.__perf && window.__perf.marks.appReady != null)').catch(() => false)) break; await sleep(5); }
    phase = 'setup';
    await ev("document.getElementById('accessGateGuest') && document.getElementById('accessGateGuest').click()");
    setup = await ev(SETUP);
  }
  await waitLoad();
  await waitQuiet(1500);
  if(mode.setup === 'settled'){
    phase = 'setup';
    await ev("document.getElementById('accessGateGuest') && document.getElementById('accessGateGuest').click()");
    setup = await ev(SETUP);
    await waitQuiet(1000);
  }
  const page = await ev(COLLECT);
  if(traceEvents){
    try { await S('Tracing.end'); await Promise.race([mode.traceDone, sleep(30000)]); }
    catch (e) { process.stderr.write(`trace lost: ${e.message}\n`); traceEvents = null; }
    mode.offTrace();
  }
  off();
  await cdp.send('Target.disposeBrowserContext', { browserContextId });
  page.wallMs = Date.now() - wall0;
  page.setup = setup;
  page.requests = [...reqs.values()];
  page.trace = traceEvents;
  return page;
}

function summarizeRequests(list){
  const by = {};
  for(const r of list){
    const k = `${r.phase}:${typeOf(r)}`;
    const b = by[k] || (by[k] = { phase: r.phase, type: typeOf(r), count: 0, bytes: 0, cached: 0, notModified: 0 });
    b.count++; b.bytes += r.bytes || 0; if(r.fromCache) b.cached++; if(r.status === 304) b.notModified++;
  }
  return Object.values(by).sort((a, b) => (a.phase + a.type).localeCompare(b.phase + b.type));
}

function scriptCosts(events){
  // EvaluateScript (top-level run, includes lazy compile of the top level) and v8.compile per URL.
  const out = {};
  for(const e of events){
    if(e.ph !== 'X') continue;
    const url = e.args?.data?.url || e.args?.fileName || '';
    if(!url || !/^https?:/.test(url)) continue;
    const name = url.replace(/^https?:\/\/[^/]+\//, '').split('?')[0];
    const o = out[name] || (out[name] = { evaluate: 0, compile: 0 });
    if(e.name === 'EvaluateScript') o.evaluate += e.dur / 1000;
    else if(e.name === 'v8.compile' || e.name === 'V8.CompileCode' || e.name === 'v8.compileModule') o.compile += e.dur / 1000;
  }
  return out;
}

const median = xs => { const s = xs.filter(x => x != null).sort((a, b) => a - b); return s.length ? s[Math.floor((s.length - 1) / 2)] : null; };

(async () => {
  const srv = await serve();
  const { proc, cdp, ws } = await launch();
  const url = `https://127.0.0.1:${srv.address().port}/index.html`;
  const results = { profile: PROFILE, cache: CACHE, headers: HEADERS, root: ROOT, runs: [] };
  try {
    for(let i = 0; i < RUNS; i++){
      for(const setupMode of ['once', 'settled']){
        const mode = { setup: setupMode, warm: CACHE === 'warm', trace: TRACE && i === 0 && setupMode === 'once' };
        const r = await run(cdp, mode, url);
        r.setupMode = setupMode;
        if(r.trace){ r.scripts = scriptCosts(r.trace); delete r.trace; }
        results.runs.push(r);
        const s = r.setup;
        process.stderr.write(`${PROFILE}/${CACHE}/${setupMode} #${i + 1}: fcp ${r.fcp?.toFixed(0)} gate ${Math.max(r.fcp || 0, r.marks.gateWired || 0).toFixed(0)} dcl ${r.dcl.toFixed(0)} load ${r.load.toFixed(0)} ready ${r.marks.appReady?.toFixed(0)} render ${s ? (s.t1 - s.t0).toFixed(0) : '-'} (at ${s ? s.t1.toFixed(0) : '-'}) ok=${s && s.ok}\n`);
      }
    }
  } catch (e) { console.error(e); process.exitCode = 2; }
  finally { try { ws.close(); } catch {} proc.kill(); srv.close(); }

  const once = results.runs.filter(r => r.setupMode === 'once');
  const settled = results.runs.filter(r => r.setupMode === 'settled');
  const all = results.runs;
  const summary = {
    fp: median(all.map(r => r.fp)), fcp: median(all.map(r => r.fcp)),
    gateInteractive: median(all.map(r => r.marks.gateWired == null ? null : Math.max(r.fcp || 0, r.marks.gateWired))),
    dcl: median(all.map(r => r.dcl)), load: median(settled.map(r => r.load)), appReady: median(all.map(r => r.marks.appReady)),
    renderAtOnce: median(once.map(r => r.setup && r.setup.t1 - r.setup.t0)), firstUniformAtOnce: median(once.map(r => r.setup && r.setup.t1)),
    renderSettled: median(settled.map(r => r.setup && r.setup.t1 - r.setup.t0)),
    requests: summarizeRequests(settled[0] ? settled[0].requests : []),
    longtasksLoad: (settled[0] ? settled[0].longtasks : []).filter(t => t.start < settled[0].load).sort((a, b) => b.dur - a.dur).slice(0, 8),
    longtasksTotal: settled[0] ? settled[0].longtasks.reduce((a, t) => a + t.dur, 0) : null,
    loafsTop: (settled[0] ? settled[0].loafs : []).sort((a, b) => b.dur - a.dur).slice(0, 6).map(l => ({ start: Math.round(l.start), dur: Math.round(l.dur), scripts: l.scripts.sort((a, b) => b.dur - a.dur).slice(0, 4).map(s => `${String(s.src).replace(/^.*\//, '').split('?')[0]}:${s.fn || s.invoker} ${Math.round(s.dur)}`) })),
    dom: settled[0] && settled[0].dom, imgs: settled[0] && settled[0].imgs, galleries: settled[0] && settled[0].galleries,
    scripts: (all.find(r => r.scripts) || {}).scripts || null
  };
  results.summary = summary;
  for(const r of results.runs){
    const doc = r.requests.find(q => q.type === 'Document');
    const base = doc ? doc.t0 : 0;
    r.requests = r.requests.map(q => ({ url: q.url.replace(/^https?:\/\/[^/]+\//, ''), type: q.type, phase: q.phase, bytes: q.bytes, status: q.status, cached: q.fromCache, priority: q.priority,
      start: q.t0 != null ? Math.round((q.t0 - base) * 1000) : null, end: q.t1 != null ? Math.round((q.t1 - base) * 1000) : null }));
  }
  if(JSON_OUT){ fs.mkdirSync(path.dirname(JSON_OUT), { recursive: true }); fs.writeFileSync(JSON_OUT, JSON.stringify(results, null, 1)); }
  const show = Object.assign({}, summary); delete show.scripts;
  console.log(JSON.stringify(show, null, 1));
  if(summary.scripts) console.log(JSON.stringify(Object.entries(summary.scripts).sort((a, b) => (b[1].evaluate + b[1].compile) - (a[1].evaluate + a[1].compile)).slice(0, 60).map(([k, v]) => `${k} eval ${v.evaluate.toFixed(1)} compile ${v.compile.toFixed(1)}`), null, 1));
})();
