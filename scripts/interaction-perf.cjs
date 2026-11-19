#!/usr/bin/env node
'use strict';
// Interaction timing of the page on a phone viewport with the CPU slowed (not part of `npm test`: needs Chrome; the budget itself is held by
// tests/interaction-budget-browser.cjs and tests/tap-path.test.cjs).
//
//   node scripts/interaction-perf.cjs [--cpu 4] [--view phone|desktop] [--runs 3] [--only name,name] [--trace] [--profile] [--json OUT] [--md OUT]
//
// Serves the repository over HTTP, opens the page in headless Chrome at 390 x 844 (touch, mobile) or 1280 x 900 with Emulation.setCPUThrottlingRate, sets a
// member up as the scenario says, and then makes real input (Input.dispatchMouseEvent: move, press, release at the middle of the control, as a tap or a click
// is made) while a probe in the page watches:
//   feedback  from the tap to the end of the first frame in which the tapped control shows its new state (its own predicate: pressed, ticked, value, step)
//   result    from the tap to the last drawing (capub:rendered) and the frame after it; `drawings` counts the drawings made
//   long      the main thread's tasks over 50 ms in the window (Long Tasks API), the longest, and the sum
// The time of a tap counts from the input event's own time stamp, so work that was already queued ahead of the tap is part of what the member waits for.
// --trace adds Chrome's timeline for the window: the main thread's time by kind (script, style, layout, paint, other). --profile adds the V8 sampling profile:
// the functions with the most self time. --json and --md write the numbers.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { launchChrome } = require('./lib-chrome.cjs');

const ROOT = process.env.PERF_ROOT || path.join(__dirname, '..');
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
  constructor(ws){
    this.ws = ws; this.id = 0; this.pending = new Map(); this.handlers = [];
    ws.addEventListener('message', m => {
      const d = JSON.parse(m.data);
      if(d.id){ const p = this.pending.get(d.id); if(p){ this.pending.delete(d.id); d.error ? p.rej(new Error(d.error.message)) : p.res(d.result); } return; }
      for(const h of this.handlers) h(d);
    });
  }
  send(method, params, sessionId){ const id = ++this.id; return new Promise((res, rej) => { this.pending.set(id, { res, rej }); this.ws.send(JSON.stringify({ id, method, params: params || {}, ...(sessionId ? { sessionId } : {}) })); }); }
  on(fn){ this.handlers.push(fn); return () => { this.handlers = this.handlers.filter(h => h !== fn); }; }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
const median = a => { const s = a.filter(x => x != null && !Number.isNaN(x)).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };

// Runs in the page, once per load.
const PROBE = `(() => {
  if(window.__ip) return true;
  const ip = window.__ip = { long: [], loaf: [], rendered: [], t0: 0, armed: false, pred: null, feedback: null, frames: 0 };
  try { new PerformanceObserver(l => l.getEntries().forEach(e => { if(ip.armed) ip.long.push({ start: e.startTime, dur: e.duration }); })).observe({ type: 'longtask', buffered: false }); } catch (e) {}
  try { new PerformanceObserver(l => l.getEntries().forEach(e => {
    if(!ip.armed) return;
    const scripts = (e.scripts || []).map(s => ({ src: String(s.sourceURL).split('/').slice(-1)[0], fn: s.sourceFunctionName, invoker: s.invoker, pos: s.sourceCharPosition, dur: Math.round(s.duration), forced: Math.round(s.forcedStyleAndLayoutDuration || 0) }));
    ip.loaf.push({ start: e.startTime, dur: e.duration, blocking: e.blockingDuration, scripts });
  })).observe({ type: 'long-animation-frame', buffered: false }); } catch (e) {}
  document.addEventListener('capub:rendered', () => { if(ip.armed) ip.rendered.push(performance.now()); });
  // The tap: the first click or key event after arming; its own time stamp is the start.
  const start = e => { if(ip.armed && !ip.t0) ip.t0 = e.timeStamp; };
  document.addEventListener('pointerdown', start, true);
  document.addEventListener('click', start, true);
  document.addEventListener('keydown', start, true);
  document.addEventListener('input', start, true);
  // Each frame: has the control got its new state? The check is made in the frame's animation callback, the time taken after the frame's rendering (a timer posted from it).
  const frame = () => {
    if(ip.armed && ip.t0 && ip.feedback == null && ip.pred){
      let ok = false; try { ok = !!ip.pred(); } catch (e) { ok = false; }
      if(ok){ const mc = new MessageChannel(); mc.port1.onmessage = () => { if(ip.feedback == null) ip.feedback = performance.now(); }; mc.port2.postMessage(0); }
    }
    ip.frames++;
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  return true;
})()`;

function parseArgs(argv){
  const o = { cpu: 4, view: 'phone', runs: 3, only: null, trace: false, profile: false, json: null, md: null, wait: 1200 };
  for(let i = 0; i < argv.length; i++){
    const a = argv[i];
    if(a === '--cpu') o.cpu = Number(argv[++i]);
    else if(a === '--view') o.view = argv[++i];
    else if(a === '--runs') o.runs = Number(argv[++i]);
    else if(a === '--only') o.only = argv[++i].split(',');
    else if(a === '--trace') o.trace = true;
    else if(a === '--profile') o.profile = true;
    else if(a === '--json') o.json = argv[++i];
    else if(a === '--md') o.md = argv[++i];
    else if(a === '--wait') o.wait = Number(argv[++i]);
  }
  return o;
}

// A browser session: open(), then setup(js), then tap(...).
async function openSession(opts){
  const srv = await serve();
  const chrome = await launchChrome({ prefix: 'interaction-perf' });
  const cdp = new Cdp(chrome.ws);
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  const S = (m, p) => cdp.send(m, p, sessionId);
  const ev = async expr => { const r = await S('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if(r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
  const phone = opts.view === 'phone';
  await S('Page.enable');
  await S('Emulation.setDeviceMetricsOverride', phone ? { width: 390, height: 844, deviceScaleFactor: 3, mobile: true } : { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  if(phone) await S('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await S('Page.addScriptToEvaluateOnNewDocument', { source: "try{localStorage.setItem('cap_uniform_builder_access_v1','1')}catch(e){}" });
  await S('Page.addScriptToEvaluateOnNewDocument', { source: PROBE });
  const url = `http://127.0.0.1:${srv.address().port}/index.html`;
  const load = async () => {
    await S('Page.navigate', { url });
    for(let i = 0; i < 600; i++){ if(await ev('typeof CAPUBUniformView !== "undefined" && typeof buildBadgeGallery === "function" && !!document.getElementById("expandBadges") && !!window.__ip').catch(() => false)) break; await sleep(50); }
    await sleep(1500);
  };
  // The middle of the element, scrolled where nothing (the sticky header, the footer bar) lies over it, as a member would scroll to it.
  const point = async sel => {
    const r = await ev(`(() => { const t = ${sel}; if(!t) return null;
      for(const block of ['center', 'end', 'start', 'nearest']){
        t.scrollIntoView({ block });
        const r = t.getBoundingClientRect();
        const x = r.x + r.width / 2, y = r.y + r.height / 2;
        const hit = document.elementFromPoint(x, y);
        if(hit && (hit === t || t.contains(hit))) return { x, y };
      }
      const r = t.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
    if(!r) throw new Error('no element ' + sel);
    return r;
  };
  // `sel` is a JS expression giving the element; `pred` a JS expression, true when the control shows its new state; `act` 'tap' | 'type:<text>'.
  async function tap({ sel, pred, act = 'tap', wait = opts.wait, trace = false, profile = false }){
    const p = await point(sel);
    await sleep(250);
    const hit = await ev(`(() => { const e = document.elementFromPoint(${p.x}, ${p.y}); const t = ${sel}; return e === t || (t && t.contains(e)) ? 'ok' : 'MISS ' + (e ? e.tagName + '#' + e.id + '.' + e.className : 'none'); })()`);
    await ev(`(() => { const ip = window.__ip; ip.long = []; ip.loaf = []; ip.rendered = []; ip.t0 = 0; ip.feedback = null; ip.pred = () => (${pred || 'true'}); ip.armed = true; return true; })()`);
    const events = [];
    let off = null;
    if(trace){
      off = cdp.on(d => { if(d.method === 'Tracing.dataCollected' && d.sessionId === sessionId) events.push(...d.params.value); });
      await S('Tracing.start', { categories: 'devtools.timeline,disabled-by-default-devtools.timeline', transferMode: 'ReportEvents' });
    }
    if(profile){ await S('Profiler.enable'); await S('Profiler.setSamplingInterval', { interval: 250 }); await S('Profiler.start'); }
    const wall0 = Date.now();
    if(act === 'tap'){
      await S('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x, y: p.y });
      await S('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'left', clickCount: 1 });
      await S('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'left', clickCount: 1 });
    }else if(act.startsWith('change:')){
      await ev(`(() => { const e = ${sel}; window.__ip.t0 = performance.now(); e.value = ${JSON.stringify(act.slice(7))}; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
    }else if(act.startsWith('index:')){
      await ev(`(() => { const e = ${sel}; window.__ip.t0 = performance.now(); e.selectedIndex = ${Number(act.slice(6))}; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
    }else if(act.startsWith('type:')){
      await S('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'left', clickCount: 1 });
      await S('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'left', clickCount: 1 });
      await sleep(150);
      await ev(`(() => { const ip = window.__ip; ip.t0 = 0; ip.feedback = null; return true; })()`);
      for(const ch of act.slice(5)){
        await S('Input.dispatchKeyEvent', { type: 'keyDown', text: ch, key: ch, unmodifiedText: ch });
        await S('Input.dispatchKeyEvent', { type: 'keyUp', key: ch });
        await sleep(60);
      }
    }
    await sleep(wait);
    let profileData = null;
    if(profile){ profileData = (await S('Profiler.stop')).profile; await S('Profiler.disable'); }
    let timeline = null;
    if(trace){
      const done = new Promise(res => { const o2 = cdp.on(d => { if(d.method === 'Tracing.tracingComplete'){ o2(); res(); } }); });
      await S('Tracing.end');
      await done; off();
      timeline = summariseTrace(events);
    }
    const r = await ev(`(() => { const ip = window.__ip; ip.armed = false; return { t0: ip.t0, feedback: ip.feedback, rendered: ip.rendered.slice(), long: ip.long.slice(), loaf: ip.loaf.slice() }; })()`);
    const rel = x => x == null || !r.t0 ? null : Math.round((x - r.t0) * 10) / 10;
    const longs = r.long.filter(l => l.start + l.dur >= r.t0).map(l => Math.round(l.dur));
    const lastRendered = r.rendered.length ? r.rendered[r.rendered.length - 1] : null;
    return {
      feedback: rel(r.feedback),
      result: rel(lastRendered) == null ? null : Math.round(rel(lastRendered) + 8),   // plus a frame
      firstRendered: rel(r.rendered[0]),
      drawings: r.rendered.length,
      longCount: longs.length, longMax: longs.length ? Math.max(...longs) : 0, longSum: longs.reduce((a, b) => a + b, 0),
      loaf: r.loaf.filter(l => l.start + l.dur >= r.t0).map(l => ({ dur: Math.round(l.dur), blocking: Math.round(l.blocking), scripts: l.scripts.sort((a, b) => b.dur - a.dur).slice(0, 6) })),
      timeline, profile: profileData ? summariseProfile(profileData) : null,
      hit, wall: Date.now() - wall0
    };
  }
  async function close(){ try{ cdp.ws.close(); }catch(e){ /* closing */ } await chrome.close(); srv.close(); }
  return { S, ev, cdp, tap, load, close, sessionId, srv, chrome, setCpu: rate => S('Emulation.setCPUThrottlingRate', { rate }), url };
}

// The main thread's time in a trace, by what it was spent on (self time of each event; the outermost script of a task is counted once).
function summariseTrace(events){
  const threads = new Map();
  for(const e of events){ if(e.ph === 'M' && e.name === 'thread_name') threads.set(e.pid + ':' + e.tid, e.args.name); }
  const main = [...threads.entries()].find(([, n]) => n === 'CrRendererMain');
  if(!main) return null;
  const evs = events.filter(e => e.pid + ':' + e.tid === main[0] && e.ph === 'X' && e.dur != null).sort((a, b) => a.ts - b.ts || b.dur - a.dur);
  const self = new Map();
  const stack = [];
  for(const e of evs){
    while(stack.length && stack[stack.length - 1].end <= e.ts) stack.pop();
    const parent = stack[stack.length - 1];
    if(parent) parent.child += e.dur;
    const node = { e, end: e.ts + e.dur, child: 0 };
    stack.push(node);
    node.e._node = node;
  }
  for(const e of evs){ const s = Math.max(0, e.dur - (e._node ? e._node.child : 0)); self.set(e.name, (self.get(e.name) || 0) + s); }
  const kinds = { script: ['FunctionCall', 'EvaluateScript', 'v8.run', 'v8.callFunction', 'RunMicrotasks', 'EventDispatch', 'TimerFire', 'FireAnimationFrame', 'v8.compile', 'v8.parseOnBackground', 'MinorGC', 'MajorGC', 'V8.GC_MC_BACKGROUND_MARKING', 'FireIdleCallback', 'XHRReadyStateChange', 'HTMLParserHandleTokens'],
    style: ['UpdateLayoutTree', 'RecalculateStyles', 'ScheduleStyleRecalculation', 'InvalidateLayout'], layout: ['Layout', 'IntersectionObserverController::computeIntersections'],
    paint: ['Paint', 'PrePaint', 'Layerize', 'UpdateLayer', 'UpdateLayerTree', 'Commit', 'CompositeLayers', 'RasterTask', 'ImageDecodeTask', 'Decode Image', 'Decode LazyPixelRef', 'HitTest', 'ParseHTML'] };
  const out = { script: 0, style: 0, layout: 0, paint: 0, other: 0 };
  const names = {};
  for(const [name, us] of self){
    if(name === 'RunTask' || name === 'ThreadControllerImpl::RunTask' || name === 'ThreadControllerImpl::DoWork' || name === 'TaskQueueManager::ProcessTaskFromWorkQueue') continue;
    const ms = us / 1000;
    const kind = Object.keys(kinds).find(k => kinds[k].includes(name)) || 'other';
    out[kind] += ms;
    names[name] = (names[name] || 0) + ms;
  }
  for(const k of Object.keys(out)) out[k] = Math.round(out[k]);
  // The long single events (style and layout passes with what they covered), in time order.
  out.heavy = evs.filter(e => (e.name === 'UpdateLayoutTree' || e.name === 'Layout' || e.name === 'Paint' || e.name === 'PrePaint') && e.dur > 5000)
    .map(e => `${e.name} ${Math.round(e.dur / 1000)}ms @${Math.round((e.ts - evs[0].ts) / 1000)} ${e.args && e.args.elementCount != null ? 'elements ' + e.args.elementCount : ''}${e.args && e.args.beginData ? ' dirty ' + e.args.beginData.dirtyObjects + '/' + e.args.beginData.totalObjects : ''}`).slice(0, 12);
  out.top = Object.entries(names).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([n, v]) => `${n} ${Math.round(v)}`);
  return out;
}

function summariseProfile(profile){
  const self = new Map(), byId = new Map(profile.nodes.map(n => [n.id, n]));
  const dt = profile.timeDeltas;
  profile.samples.forEach((id, i) => {
    const n = byId.get(id);
    const f = n.callFrame;
    const k = `${f.functionName || '(anon)'} ${String(f.url).split('/').slice(-1)[0]}:${f.lineNumber + 1}`;
    self.set(k, (self.get(k) || 0) + (dt[i] || 0));
  });
  return [...self.entries()].filter(([k]) => !k.startsWith('(idle)')).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => `${(v / 1000).toFixed(1)} ms ${k}`);
}

module.exports = { openSession, parseArgs, sleep, median, PROBE };
