'use strict';
// The page's side of the usage counts and the feedback (LIVE13 E69, E70): js/telemetry.js run in a small fake window, and
// the page's privacy wording. tests/telemetry-browser.cjs drives the real page in Chrome against a stub API.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const SRC = read('js/telemetry.js');

// A window with just what telemetry.js touches. Returns the window, the requests it made and the event listeners.
function load({ dnt = false, metrics = true, access = 'ok', stored = null, state } = {}){
  const sent = [], listeners = {}, docListeners = {}, timers = [];
  const storage = new Map(stored ? [['capub_visitor_v1', stored]] : []);
  const attrs = { 'data-access': access };
  const win = {
    CAPUB_CONFIG: { metrics },
    location: { protocol: 'https:', pathname: '/' },
    navigator: { doNotTrack: dnt ? '1' : null, sendBeacon: (url, blob) => { sent.push({ url, beacon: true, blob }); return true; } },
    innerWidth: 390,
    crypto: { getRandomValues: a => { for(let i = 0; i < a.length; i++) a[i] = (i * 37 + 11) % 256; return a; } },
    localStorage: { getItem: k => storage.has(k) ? storage.get(k) : null, setItem: (k, v) => storage.set(k, String(v)) },
    matchMedia: () => ({ matches: false }),
    addEventListener: (n, f) => { (listeners[n] = listeners[n] || []).push(f); },
    fetch: (url, init) => { sent.push({ url, init, body: JSON.parse(init.body) }); return Promise.resolve({ ok: true }); },
    setInterval: (f, ms) => { timers.push({ f, ms, every: true }); return timers.length; },
    setTimeout: (f, ms) => { timers.push({ f, ms }); return timers.length; },
    clearTimeout: id => { if(timers[id - 1]) timers[id - 1].f = () => {}; },
    State: state || null,
    CAPUBUniformView: { GARMENT_DEFAULTS: { sleeve: 'short', dutyTitle: '' }, scene: { layers: [{ role: 'ribbon' }, { role: 'ribbon' }, { role: 'device' }, { role: 'badge' }], notes: ['a'] } },
    Blob: class { constructor(parts){ this.text = parts.join(''); } },
    MutationObserver: class { constructor(f){ this.f = f; } observe(){} disconnect(){} },
    JSON, Date, Math, Object, Array, Set, Uint8Array, String, Number, isFinite, RegExp
  };
  win.window = win;
  win.document = {
    documentElement: { getAttribute: n => attrs[n] || null, dataset: {} },
    addEventListener: (n, f) => { (docListeners[n] = docListeners[n] || []).push(f); },
    visibilityState: 'visible'
  };
  vm.runInNewContext(SRC, win);
  const runTimers = () => { for(const t of timers.splice(0)) if(!t.every) t.f(); };
  return { win, sent, listeners, docListeners, storage, runTimers };
}

const STATE = () => ({
  uniform: 'blues_b', gender: 'male', membership: 'cadet', rank: 'C/Capt', cadetFirstSergeant: false, adultCadet: false,
  ribbons: [{ id: 'encampment_ribbon' }, { id: 'red_service_ribbon' }, { id: 'red_service_ribbon' }], badges: ['emergency_services_badge'],
  militaryBadges: { x: { selected: true }, y: { selected: false } }, patches: [], unitPatchCharter: 'TN-330', shoulderCord: 'honor_guard',
  garment: { sleeve: 'long', dutyTitle: 'Squadron Commander Jane Doe', headgear: 'auto' },
  text: { firstName: 'Jane', lastName: 'Doe', plateLine: 'Tennessee', show: true },
  reportAuthorizedBadgeIds: ['emergency_services_badge']
});

test('the build summary carries counts and settings, and no name, nameplate, duty title or charter', () => {
  const { win } = load({ state: STATE() });
  const s = win.CAPUB_TELEMETRY.summary();
  assert.equal(s.uniform, 'blues_b');
  assert.equal(s.grade, 'C/Capt');
  assert.deepEqual(JSON.parse(JSON.stringify(s.counts)), { ribbons: 2, militaryRibbons: 0, devices: 1, minis: 0, badges: 1, militaryBadges: 1, patches: 0, unitPatch: 1, cords: 1 });
  assert.deepEqual(JSON.parse(JSON.stringify(s.drawn)), { ribbons: 2, badges: 1, patches: 0, notes: 1 });
  assert.deepEqual(JSON.parse(JSON.stringify(s.options)), { sleeve: 'long', dutyTitle: 'set', headgear: 'auto' });
  assert.equal(s.nameShown, true);
  assert.equal(s.fromImport, true);
  const text = JSON.stringify(s);
  for(const word of ['Jane', 'Doe', 'Tennessee', 'TN-330', 'Commander']) assert.ok(!text.includes(word), `${word} is not sent`);
});

test('events are queued, sent with the random visitor and visit ids, and flushed by a beacon when the page is hidden', () => {
  const t = load({ state: STATE() });
  const T = t.win.CAPUB_TELEMETRY;
  assert.equal(T.enabled, true);
  T.track('png_download', { uniform: 'blues_b', ok: true });
  T.flush();
  const visitor = t.storage.get('capub_visitor_v1');
  assert.match(visitor, /^[a-z0-9]{20}$/, 'a random visitor id kept in localStorage');
  const req = t.sent.find(r => r.url === '/api/events' && r.body);
  assert.ok(req, 'sent to the site\'s own /api/events');
  assert.equal(req.init.credentials, 'omit');
  assert.equal(req.init.keepalive, true);
  assert.equal(req.body.vid, visitor);
  assert.match(req.body.sid, /^[a-z0-9]{16}$/);
  assert.deepEqual(req.body.events.map(e => e.name), ['visit', 'png_download'], 'the visit is first once the gate is passed');
  assert.deepEqual(JSON.parse(JSON.stringify(req.body.events[0].data)), { access: 'code', viewport: 'phone', theme: 'light', ux: 'standard', returning: false });
  T.track('shopping_open', { uniform: 'blues_b' });
  for(const f of t.listeners.pagehide) f();
  const beacon = t.sent.find(r => r.beacon);
  assert.ok(beacon && /shopping_open/.test(beacon.blob.text), 'pagehide sends what is left by sendBeacon');
});

test('a settled drawing sends one build; the same setup again sends nothing; a change waits out the 30 s', () => {
  const state = STATE();
  const t = load({ state, stored: 'abcdefghij0123456789' });
  const T = t.win.CAPUB_TELEMETRY;
  const render = () => { for(const f of t.docListeners['capub:rendered']) f(); };
  render(); t.runTimers();
  render(); t.runTimers();
  T.flush();
  let builds = t.sent.flatMap(r => r.body ? r.body.events : []).filter(e => e.name === 'build');
  assert.equal(builds.length, 1);
  assert.equal(builds[0].data.seq, 1);
  assert.equal(t.sent[0].body.events[0].data.returning, true, 'a kept visitor id is a returning visitor');
  state.badges = [];
  render(); t.runTimers();   // settles, but within 30 s of the last build: rescheduled, not sent
  T.flush();
  assert.equal(t.sent.flatMap(r => r.body ? r.body.events : []).filter(e => e.name === 'build').length, 1);
  for(const f of t.listeners.pagehide) f();   // leaving sends the last unsent setup
  const beacon = t.sent.filter(r => r.beacon).map(r => JSON.parse(r.blob.text)).flatMap(b => b.events).filter(e => e.name === 'build');
  assert.equal(beacon.length, 1);
  assert.equal(beacon[0].data.counts.badges, 0);
  // An incomplete setup sends no build.
  const u = load({ state: Object.assign(STATE(), { rank: null }) });
  for(const f of u.docListeners['capub:rendered']) f();
  u.runTimers(); u.win.CAPUB_TELEMETRY.flush();
  assert.ok(!u.sent.flatMap(r => r.body ? r.body.events : []).some(e => e.name === 'build'));
});

test('with Do Not Track only visit and build counts go, with no ids, and nothing is kept in localStorage', () => {
  const t = load({ dnt: true, state: STATE() });
  const T = t.win.CAPUB_TELEMETRY;
  assert.equal(T.countsOnly, true);
  T.track('png_download', {});
  T.track('feedback_sent', {});
  for(const f of t.docListeners['capub:rendered']) f();
  t.runTimers();
  T.flush();
  const body = t.sent[0].body;
  assert.deepEqual(body.events.map(e => e.name), ['visit', 'build']);
  assert.equal(body.vid, undefined);
  assert.equal(body.sid, undefined);
  assert.equal(body.events[0].data.returning, undefined);
  assert.equal(t.storage.size, 0);
});

test('CAPUB_CONFIG.metrics = false sends nothing; three failed requests stop the sending', async () => {
  const off = load({ metrics: false, state: STATE() });
  off.win.CAPUB_TELEMETRY.track('png_download', {});
  off.win.CAPUB_TELEMETRY.flush();
  assert.equal(off.sent.length, 0);
  assert.equal(off.win.CAPUB_TELEMETRY.enabled, false);
  const t = load({ state: STATE() });
  let calls = 0;
  t.win.fetch = () => { calls++; return Promise.resolve({ ok: false }); };
  for(let i = 0; i < 5; i++){ t.win.CAPUB_TELEMETRY.track('png_download', {}); t.win.CAPUB_TELEMETRY.flush(); await new Promise(r => setImmediate(r)); }
  assert.equal(calls, 3, 'no API behind this copy of the site: it stops asking');
});

test('script errors are reported without the member\'s name, long numbers or emails, five at most', () => {
  const t = load({ state: STATE() });
  for(let i = 0; i < 7; i++) for(const f of t.listeners.error) f({ message: `Cannot read DOE of Jane: 1234567 ${i} jane@example.test`, filename: 'https://uniform.example.test/js/wiring.js?v=abc', lineno: 9, colno: 3 });
  t.win.CAPUB_TELEMETRY.flush();
  const errors = t.sent[0].body.events.filter(e => e.name === 'error');
  assert.equal(errors.length, 5);
  assert.deepEqual(JSON.parse(JSON.stringify(errors[0].data)), { message: 'Cannot read DOE of [name]: # 0 [email]', file: 'wiring.js', line: 9, col: 3 });
});

test('the page loads telemetry as a feature script, and says honestly what goes to the site', () => {
  const html = read('index.html');
  const feature = html.slice(html.indexOf('<!-- Feature scripts'), html.indexOf('<!-- End of feature scripts. -->'));
  assert.match(feature, /<script src="js\/telemetry\.js\?v=[0-9a-f]{10}" defer><\/script>/);
  assert.doesNotMatch(html, /Everything stays in your browser|Nothing you build is uploaded|never leaves this device/);
  assert.match(html, /<meta name="description" content="[^"]*Your setup stays in your browser; the site gets only anonymous usage counts and any feedback you send\.">/);
  const about = html.slice(html.indexOf('<dialog id="aboutDialog"'), html.indexOf('</dialog>'));
  assert.match(about, /counts anonymous usage/);
  assert.match(about, /No name, CAPID, nameplate text or report contents ever leave your browser/);
  assert.match(about, /Do Not Track/);
  assert.match(read('config.js'), /metrics: true,[\s\S]*feedback: true/);
  // Each hook is one guarded call, so the page works without js/telemetry.js.
  const hooks = { 'js/bootstrap.js': ['png_download'], 'js/wiring.js': ['uniform_switch', 'quick_strip', 'setup_file'], 'js/member-report-import.js': ['import'], 'purchase-feature-core.js': ['shopping_open'] };
  for(const [file, names] of Object.entries(hooks)){
    const src = read(file);
    for(const n of names) assert.match(src, new RegExp(`CAPUB_TELEMETRY\\?\\.track\\('${n}'`), `${file} ${n}`);
  }
  assert.match(read('js/placement-templates.js'), /const T = root\(\)\.CAPUB_TELEMETRY; if\(T\) T\.track\('templates', \{ side: side\.key, what: b\.dataset\.what, paper: ui\.paper \}\)/);
  // The import hook sends counts, not what the report said.
  const imp = read('js/member-report-import.js');
  const call = imp.slice(imp.indexOf("track('import', { ok: true"), imp.indexOf('\n', imp.indexOf("track('import', { ok: true")));
  assert.doesNotMatch(call, /firstName|lastName|parsed\.(text|name)/);
  assert.equal(call.replace(/\.test\(file\.(name|type)\)/g, '').match(/file\./g), null, 'the file is only tested for its type, never sent');
  for(const k of ['membership', 'rank', 'gender']) assert.match(call, new RegExp(`${k}: !!parsed\\.${k}`), `${k} only as yes or no`);
});
