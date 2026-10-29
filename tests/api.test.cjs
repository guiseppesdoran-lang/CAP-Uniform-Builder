'use strict';
// The site's API (deploy/api, LIVE13 E69 metrics + admin, E70 feedback). Ethan: "i would like an admin page (literally only
// accessible if you do /admin after the url (uniform.ebhq.dev/admin) and put in a password) containing a log of all uniforms
// built and such, any and all applicable metrics. additionally, I would like a feedback button where a member can submit
// feedback and it would put a message in the admin dashboard."
//
// Each test starts the service on an ephemeral port with a fresh data directory under os.tmpdir() (never deploy/var: the
// deploy rsync would copy a local one over the server's data) and a test password, and talks to it over HTTP.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { createService, CSP, cleanData } = require('../deploy/api/service.js');
const { summarize, finalBuilds } = require('../deploy/api/metrics.js');
const { buildCsp } = require('../scripts/csp.cjs');

const ROOT = path.join(__dirname, '..');
const PASSWORD = 'test-admin-password-not-real';
const NOW = Date.parse('2026-10-29T15:00:00Z');

function tmpDir(){ return fs.mkdtempSync(path.join(os.tmpdir(), 'uniform-api-test-')); }

async function start(opts = {}){
  const dataDir = opts.dataDir || tmpDir();
  const clock = { t: opts.now || NOW };
  const logs = [];
  const svc = createService(Object.assign({ dataDir, adminPassword: PASSWORD, cookieSecure: false, now: () => clock.t, log: m => logs.push(m) }, opts, { now: () => clock.t }));
  await new Promise(r => svc.server.listen(0, '127.0.0.1', r));
  const port = svc.server.address().port;
  function req(method, p, { headers = {}, body } = {}){
    return new Promise((resolve, reject) => {
      const data = body === undefined ? null : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
      const h = Object.assign({ Host: `127.0.0.1:${port}` }, headers);
      if(data) h['Content-Length'] = data.length;
      const r = http.request({ host: '127.0.0.1', port, method, path: p, headers: h }, res => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let json = null;
          try{ json = JSON.parse(text); }catch(e){ json = null; }
          resolve({ status: res.statusCode, headers: res.headers, text, json });
        });
      });
      r.on('error', reject);
      if(data) r.write(data);
      r.end();
    });
  }
  async function login(password = PASSWORD, headers = {}){
    const r = await req('POST', '/admin', { headers: Object.assign({ 'Content-Type': 'application/x-www-form-urlencoded' }, headers), body: 'password=' + encodeURIComponent(password) });
    const set = r.headers['set-cookie'] && r.headers['set-cookie'][0];
    return { r, cookie: set ? set.split(';')[0] : null, set };
  }
  return { svc, dataDir, clock, logs, req, login, close: async () => { await svc.close(); fs.rmSync(dataDir, { recursive: true, force: true }); } };
}

const batch = (events, extra) => Object.assign({ v: 1, sent: NOW, vid: 'visitor0000000000001', sid: 'session000000001', events }, extra || {});

test('the API answers its health check and every response is no-store with the site\'s security headers', async () => {
  const t = await start();
  try{
    const r = await t.req('GET', '/api/health');
    assert.equal(r.status, 200);
    assert.deepEqual(r.json, { ok: true, admin: true });
    assert.equal(r.headers['cache-control'], 'no-store');
    assert.equal(r.headers['x-content-type-options'], 'nosniff');
    assert.equal(r.headers['content-security-policy'], CSP);
    assert.equal(CSP, buildCsp({ forHeader: true }), 'the API sends the same policy as scripts/csp.cjs');
    assert.equal((await t.req('GET', '/api/nothing')).status, 404);
    assert.equal((await t.req('GET', '/somewhere')).status, 404);
  }finally{ await t.close(); }
});

test('events are accepted, cleaned and appended to the month\'s JSON Lines file', async () => {
  const t = await start();
  try{
    const r = await t.req('POST', '/api/events', { headers: { 'Content-Type': 'text/plain;charset=UTF-8', Origin: `http://127.0.0.1:${t.svc.server.address().port}` }, body: batch([
      { name: 'visit', at: NOW - 4000, data: { access: 'guest', viewport: 'phone', theme: 'dark', returning: false } },
      { name: 'build', at: NOW, data: { uniform: 'blues_b', gender: 'male', membership: 'cadet', grade: 'C/2d Lt', counts: { ribbons: 7, badges: 2 }, options: { sleeve: 'long' }, note: '<script>alert(1)</script>', name: 'x'.repeat(80) } },
      { name: 'not_an_event', data: {} },
      { name: 'error', at: NOW, data: { message: 'TypeError: x is undefined\u0000', file: 'wiring.js', line: 12 } }
    ]) });
    assert.equal(r.status, 202);
    assert.equal(r.json.stored, 3, 'the unknown event name is dropped');
    const file = path.join(t.dataDir, 'events-2026-10.jsonl');
    const lines = fs.readFileSync(file, 'utf8').trim().split('\n').map(l => JSON.parse(l));
    assert.equal(lines.length, 3);
    assert.deepEqual(lines.map(l => l.name), ['visit', 'build', 'error']);
    assert.equal(lines[0].ts, new Date(NOW - 4000).toISOString(), 'the time is the server\'s, less the wait in the page\'s queue');
    assert.equal(lines[0].vid, 'visitor0000000000001');
    assert.equal(lines[0].sid, 'session000000001');
    assert.deepEqual(lines[1].data, { uniform: 'blues_b', gender: 'male', membership: 'cadet', grade: 'C/2d Lt', counts: { ribbons: 7, badges: 2 }, options: { sleeve: 'long' } }, 'markup and long strings are dropped');
    assert.equal(lines[2].data.message, 'TypeError: x is undefined', 'control characters stripped');
    assert.ok(!fs.readFileSync(file, 'utf8').includes('127.0.0.1'), 'no address is stored');
    // Kept in memory too, so the dashboard sees it at once.
    assert.equal(t.svc.store.events.length, 3);
  }finally{ await t.close(); }
});

test('an events batch over 16 KB or 50 events is refused, as is bad JSON or another site\'s origin', async () => {
  const t = await start();
  try{
    const big = batch([{ name: 'visit', data: { access: 'x'.repeat(10) } }], { pad: 'y'.repeat(17 * 1024) });
    assert.equal((await t.req('POST', '/api/events', { body: big })).status, 413);
    const many = batch(Array.from({ length: 51 }, () => ({ name: 'visit', data: {} })));
    assert.equal((await t.req('POST', '/api/events', { body: many })).status, 413);
    const fifty = batch(Array.from({ length: 50 }, () => ({ name: 'visit', data: {} })));
    assert.equal((await t.req('POST', '/api/events', { body: fifty })).status, 202);
    assert.equal((await t.req('POST', '/api/events', { body: '{nope' })).status, 400);
    assert.equal((await t.req('POST', '/api/events', { body: { events: 'no' } })).status, 400);
    assert.equal((await t.req('POST', '/api/events', { headers: { Origin: 'https://elsewhere.example' }, body: batch([{ name: 'visit' }]) })).status, 403);
    assert.equal((await t.req('GET', '/api/events')).status, 404);
    // A visitor id that is not the page's random form is not stored.
    await t.req('POST', '/api/events', { body: batch([{ name: 'visit' }], { vid: 'John Smith', sid: 'x' }) });
    const last = t.svc.store.events[t.svc.store.events.length - 1];
    assert.equal(last.vid, undefined);
    assert.equal(last.sid, undefined);
  }finally{ await t.close(); }
});

test('a same-origin post from the page passes with Origin: null (Referrer-Policy no-referrer); a cross-site one does not', async () => {
  const t = await start();
  try{
    // What Chrome sends for the page's own sendBeacon, fetch and form posts under Referrer-Policy: no-referrer.
    assert.equal((await t.req('POST', '/api/events', { headers: { Origin: 'null', 'Sec-Fetch-Site': 'same-origin' }, body: batch([{ name: 'visit' }]) })).status, 202);
    assert.equal((await t.req('POST', '/api/feedback', { headers: { Origin: 'null', 'Sec-Fetch-Site': 'same-origin' }, body: { message: 'hi' } })).status, 201);
    assert.equal((await t.login(PASSWORD, { Origin: 'null', 'Sec-Fetch-Site': 'same-origin' })).r.status, 303, 'the sign-in form posts with Origin: null');
    for(const site of ['cross-site', 'same-site', 'none']){
      assert.equal((await t.req('POST', '/api/feedback', { headers: { Origin: 'null', 'Sec-Fetch-Site': site }, body: { message: 'x' } })).status, 403, site);
      assert.equal((await t.login(PASSWORD, { Origin: 'null', 'Sec-Fetch-Site': site })).r.status, 403, site);
    }
    // Behind Caddy the Host may be rewritten; X-Forwarded-Host is the visitor's.
    assert.equal((await t.req('POST', '/api/events', { headers: { Host: 'uniform-api:8080', 'X-Forwarded-Host': 'uniform.example.test', Origin: 'https://uniform.example.test' }, body: batch([{ name: 'visit' }]) })).status, 202);
  }finally{ await t.close(); }
});

test('feedback round trip: posted by a member, listed in the admin inbox, marked read, archived and back', async () => {
  const t = await start();
  try{
    const sent = await t.req('POST', '/api/feedback', { body: { message: '  The Class B ribbons sit too high.\nThanks!  ', contact: 'cadet_doe on Discord', page: '/', setup: { uniform: 'blues_b', grade: 'C/Capt', counts: { ribbons: 9 }, name: 'Doe <b>' } } });
    assert.equal(sent.status, 201);
    assert.match(sent.json.id, /^fb_[0-9a-f]{12}$/);
    assert.equal((await t.req('POST', '/api/feedback', { body: { message: '   ' } })).status, 400);
    assert.equal((await t.req('POST', '/api/feedback', { body: { message: 'x'.repeat(4001) } })).status, 413);
    assert.equal((await t.req('POST', '/api/feedback', { body: { message: 'ok', contact: 'c'.repeat(201) } })).status, 413);
    assert.equal((await t.req('POST', '/api/feedback', { headers: { Origin: 'https://elsewhere.example' }, body: { message: 'spam' } })).status, 403);
    const stored = JSON.parse(fs.readFileSync(path.join(t.dataDir, 'feedback.jsonl'), 'utf8').trim());
    assert.equal(stored.message, 'The Class B ribbons sit too high.\nThanks!');
    assert.equal(stored.contact, 'cadet_doe on Discord');
    assert.deepEqual(stored.setup, { uniform: 'blues_b', grade: 'C/Capt', counts: { ribbons: 9 } }, 'the setup keeps only short tokens');

    const { cookie } = await t.login();
    const H = { Cookie: cookie };
    let inbox = await t.req('GET', '/api/admin/feedback', { headers: H });
    assert.equal(inbox.json.unread, 1);
    assert.equal(inbox.json.feedback[0].id, sent.json.id);
    assert.equal(inbox.json.feedback[0].read, null);
    const id = sent.json.id;
    const read = await t.req('POST', `/api/admin/feedback/${id}/read`, { headers: H, body: {} });
    assert.equal(read.status, 200);
    assert.ok(read.json.read);
    assert.equal((await t.req('GET', '/api/admin/feedback?status=unread', { headers: H })).json.feedback.length, 0);
    assert.equal((await t.req('GET', '/api/admin/summary', { headers: H })).json.unread, 0);
    await t.req('POST', `/api/admin/feedback/${id}/read`, { headers: H, body: { value: false } });
    assert.equal((await t.req('GET', '/api/admin/feedback?status=unread', { headers: H })).json.feedback.length, 1, 'marked unread again');
    await t.req('POST', `/api/admin/feedback/${id}/archive`, { headers: H });
    assert.equal((await t.req('GET', '/api/admin/feedback', { headers: H })).json.feedback.length, 0, 'archived leaves the inbox');
    assert.equal((await t.req('GET', '/api/admin/feedback?status=archived', { headers: H })).json.feedback.length, 1);
    const state = JSON.parse(fs.readFileSync(path.join(t.dataDir, 'feedback-state.json'), 'utf8'));
    assert.ok(state[id].archived);
    await t.req('POST', `/api/admin/feedback/${id}/archive`, { headers: H, body: { value: false } });
    assert.equal((await t.req('GET', '/api/admin/feedback', { headers: H })).json.feedback.length, 1, 'back in the inbox');
    assert.equal((await t.req('POST', '/api/admin/feedback/fb_000000000000/read', { headers: H })).status, 404);
    assert.equal((await t.req('POST', `/api/admin/feedback/${id}/read`, { headers: Object.assign({ Origin: 'https://elsewhere.example' }, H) })).status, 403);
    // The flags survive a restart.
    const again = createService({ dataDir: t.dataDir, adminPassword: PASSWORD, log: () => {} });
    assert.equal(again.store.feedback.length, 1);
    assert.equal((again.store.flags[id] || {}).archived, undefined);
    await again.close();
  }finally{ await t.close(); }
});

test('feedback is limited to 8 messages an hour from one address', async () => {
  const t = await start();
  try{
    for(let i = 0; i < 8; i++) assert.equal((await t.req('POST', '/api/feedback', { body: { message: 'm' + i } })).status, 201);
    const r = await t.req('POST', '/api/feedback', { body: { message: 'one too many' } });
    assert.equal(r.status, 429);
    assert.match(r.json.error, /try again later/);
    assert.equal((await t.req('POST', '/api/feedback', { headers: { 'CF-Connecting-IP': '203.0.113.9' }, body: { message: 'another member' } })).status, 201, 'another address is not limited');
    t.clock.t += 61 * 60 * 1000;
    assert.equal((await t.req('POST', '/api/feedback', { body: { message: 'an hour later' } })).status, 201);
  }finally{ await t.close(); }
});

test('admin sign-in: the form, a wrong password, five wrong then a 60 s lockout, and the right one', async () => {
  const t = await start();
  try{
    const form = await t.req('GET', '/admin');
    assert.equal(form.status, 200);
    assert.match(form.text, /<form method="post" action="\/admin"/);
    assert.match(form.text, /type="password"/);
    assert.doesNotMatch(form.text, /<script/, 'no script on the sign-in page');
    assert.equal((await t.req('GET', '/admin/')).headers.location, '/admin');

    const wrong = await t.login('nope');
    assert.equal(wrong.r.status, 401);
    assert.equal(wrong.cookie, null);
    assert.match(wrong.r.text, /That password is not right/);
    for(let i = 0; i < 3; i++) assert.equal((await t.login('nope' + i)).r.status, 401);
    const fifth = await t.login('nope5');
    assert.equal(fifth.r.status, 429, 'the fifth wrong password locks');
    assert.match(fifth.r.text, /Wait 60 s/);
    const locked = await t.login(PASSWORD);
    assert.equal(locked.r.status, 429, 'even the right password waits out the lock');
    assert.equal(locked.cookie, null);
    assert.ok(Number(locked.r.headers['retry-after']) > 0);
    assert.equal((await t.login(PASSWORD, { 'CF-Connecting-IP': '198.51.100.7' })).r.status, 303, 'another address is not locked');
    t.clock.t += 61 * 1000;
    const ok = await t.login(PASSWORD);
    assert.equal(ok.r.status, 303);
    assert.equal(ok.r.headers.location, '/admin');
    assert.match(ok.set, /^capub_admin=[^;]+; Path=\/; HttpOnly; SameSite=Strict; Max-Age=43200$/);
    assert.ok(t.logs.some(l => /locked for 60 s/.test(l)));
    // A cross-site form post is refused.
    assert.equal((await t.login(PASSWORD, { Origin: 'https://elsewhere.example' })).r.status, 403);
  }finally{ await t.close(); }
});

test('the cookie is Secure by default (the live site is HTTPS at Cloudflare)', async () => {
  const t = await start({ cookieSecure: true });
  try{
    const { set } = await t.login();
    assert.match(set, /; Secure$/);
  }finally{ await t.close(); }
});

test('everything under /admin and /api/admin but the form needs the cookie; it lasts 12 h and sign-out ends it', async () => {
  const t = await start();
  try{
    const gated = ['/api/admin/summary', '/api/admin/events', '/api/admin/feedback', '/api/admin/export.csv?what=events', '/admin/app.js', '/admin/app.css'];
    for(const p of gated) assert.equal((await t.req('GET', p)).status, 401, p);
    assert.equal((await t.req('POST', '/api/admin/feedback/fb_x/read')).status, 401);
    const { cookie } = await t.login();
    const H = { Cookie: cookie };
    for(const p of gated) assert.equal((await t.req('GET', p, { headers: H })).status, 200, p);
    const dash = await t.req('GET', '/admin', { headers: H });
    assert.match(dash.text, /<script src="\/admin\/app\.js" defer><\/script>/);
    assert.doesNotMatch(dash.text, /<script>|<script(?![^>]*\bsrc=)[^>]*>/, 'no inline script');
    assert.match((await t.req('GET', '/admin/app.js', { headers: H })).headers['content-type'], /^text\/javascript/);
    // A forged or altered cookie is refused.
    const [name, value] = cookie.split('=');
    const parts = value.split('.');
    assert.equal((await t.req('GET', '/api/admin/summary', { headers: { Cookie: `${name}=${Number(parts[0]) + 999999}.${parts[1]}.${parts[2]}` } })).status, 401);
    assert.equal((await t.req('GET', '/api/admin/summary', { headers: { Cookie: `${name}=${parts[0]}.${parts[1]}.AAAA` } })).status, 401);
    // Twelve hours on, it has run out.
    t.clock.t += 12 * 3600 * 1000 + 1000;
    assert.equal((await t.req('GET', '/api/admin/summary', { headers: H })).status, 401);
    t.clock.t = NOW;
    const out = await t.req('POST', '/admin/logout', { headers: H });
    assert.equal(out.status, 303);
    assert.match(out.headers['set-cookie'][0], /^capub_admin=; .*Max-Age=0/);
    assert.equal((await t.req('GET', '/api/admin/summary', { headers: H })).status, 401, 'the old cookie is revoked');
    // Changing the password signs every session out.
    const fresh = await t.login();
    const other = createService({ dataDir: t.dataDir, adminPassword: 'a-different-password', cookieSecure: false, now: () => t.clock.t, log: () => {} });
    await new Promise(r => other.server.listen(0, '127.0.0.1', r));
    const status = await new Promise(resolve => http.get({ host: '127.0.0.1', port: other.server.address().port, path: '/api/admin/summary', headers: { Cookie: fresh.cookie } }, res => { res.resume(); resolve(res.statusCode); }));
    assert.equal(status, 401);
    await other.close();
  }finally{ await t.close(); }
});

test('without ADMIN_PASSWORD the admin routes answer 503 and the service says why; events and feedback still work', async () => {
  const t = await start({ adminPassword: '' });
  try{
    assert.ok(t.logs.some(l => /ADMIN_PASSWORD is not set/.test(l)));
    assert.equal((await t.req('GET', '/admin')).status, 503);
    assert.match((await t.req('GET', '/admin')).text, /ADMIN_PASSWORD is not set/);
    assert.equal((await t.req('GET', '/api/admin/summary')).status, 503);
    assert.equal((await t.req('POST', '/admin', { body: 'password=' })).status, 503, 'an empty password never signs in');
    assert.deepEqual((await t.req('GET', '/api/health')).json, { ok: true, admin: false });
    assert.equal((await t.req('POST', '/api/events', { body: batch([{ name: 'visit' }]) })).status, 202);
    assert.equal((await t.req('POST', '/api/feedback', { body: { message: 'hi' } })).status, 201);
  }finally{ await t.close(); }
});

test('the container entry point logs why the dashboard is off and keeps a session secret in the data directory', async () => {
  const dataDir = tmpDir();
  const env = Object.assign({}, process.env, { DATA_DIR: dataDir, PORT: '0', HOST: '127.0.0.1', ADMIN_PASSWORD: '' });
  const child = spawn(process.execPath, [path.join(ROOT, 'deploy', 'api', 'server.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  child.stdout.on('data', d => { out += d; });
  child.stderr.on('data', d => { out += d; });
  for(let i = 0; i < 100 && !/listening/.test(out); i++) await new Promise(r => setTimeout(r, 30));
  child.kill('SIGTERM');
  await new Promise(r => child.on('exit', r));
  assert.match(out, /ADMIN_PASSWORD is not set: \/admin and \/api\/admin answer 503/);
  assert.match(out, /listening on 127\.0\.0\.1:\d+/);
  assert.ok(fs.statSync(path.join(dataDir, 'session-secret')).size >= 32);
  fs.rmSync(dataDir, { recursive: true, force: true });
});

// ---- the numbers ----------------------------------------------------------------------------------------------------
const H1 = 3600 * 1000, D1 = 24 * H1;
const at = ms => new Date(NOW - ms).toISOString();
function knownEvents(){
  const ev = [];
  const visit = (ms, vid, sid, d) => ev.push({ ts: at(ms), name: 'visit', vid, sid, data: d });
  const build = (ms, vid, sid, d) => ev.push({ ts: at(ms), name: 'build', vid, sid, data: d });
  // Today: two visitors; A builds the Class B three times (one counted) and then the OCP; B builds the Class A.
  visit(2 * H1, 'aaaaaaaaaaaaaaaaaaaa', 'sa1', { access: 'code', viewport: 'desktop', theme: 'light', returning: true });
  build(2 * H1 - 1000, 'aaaaaaaaaaaaaaaaaaaa', 'sa1', { uniform: 'blues_b', gender: 'male', membership: 'cadet', grade: 'C/Capt', counts: { ribbons: 3, badges: 1 } });
  build(2 * H1 - 2000, 'aaaaaaaaaaaaaaaaaaaa', 'sa1', { uniform: 'blues_b', gender: 'male', membership: 'cadet', grade: 'C/Capt', counts: { ribbons: 5, badges: 1 } });
  build(2 * H1 - 3000, 'aaaaaaaaaaaaaaaaaaaa', 'sa1', { uniform: 'blues_b', gender: 'male', membership: 'cadet', grade: 'C/Capt', counts: { ribbons: 6, badges: 2 }, fromImport: true, options: { sleeve: 'long' } });
  build(2 * H1 - 4000, 'aaaaaaaaaaaaaaaaaaaa', 'sa1', { uniform: 'ocp', gender: 'male', membership: 'cadet', grade: 'C/Capt', counts: { ribbons: 6, badges: 2, patches: 2 } });
  visit(H1, 'bbbbbbbbbbbbbbbbbbbb', 'sb1', { access: 'guest', viewport: 'phone', theme: 'dark', returning: false });
  build(H1 - 1000, 'bbbbbbbbbbbbbbbbbbbb', 'sb1', { uniform: 'blues_a', gender: 'female', membership: 'senior', grade: 'Capt', counts: { ribbons: 10 } });
  ev.push({ ts: at(H1 - 2000), name: 'png_download', vid: 'bbbbbbbbbbbbbbbbbbbb', sid: 'sb1', data: { uniform: 'blues_a', ok: true } });
  ev.push({ ts: at(H1 - 3000), name: 'templates', vid: 'bbbbbbbbbbbbbbbbbbbb', sid: 'sb1', data: { side: 'left-chest', what: 'pdf', paper: 'letter' } });
  ev.push({ ts: at(H1 - 4000), name: 'templates', vid: 'bbbbbbbbbbbbbbbbbbbb', sid: 'sb1', data: { side: 'left-chest', what: 'stl', paper: 'letter' } });
  ev.push({ ts: at(H1 - 5000), name: 'import', vid: 'bbbbbbbbbbbbbbbbbbbb', sid: 'sb1', data: { ok: false, kind: 'pdf' } });
  ev.push({ ts: at(H1 - 6000), name: 'error', vid: 'bbbbbbbbbbbbbbbbbbbb', sid: 'sb1', data: { message: 'TypeError: boom', file: 'wiring.js', line: 9 } });
  ev.push({ ts: at(H1 - 7000), name: 'error', vid: 'bbbbbbbbbbbbbbbbbbbb', sid: 'sb1', data: { message: 'TypeError: boom', file: 'wiring.js', line: 9 } });
  // Three days ago: a Do Not Track visit and build (no ids).
  visit(3 * D1, undefined, undefined, { access: 'code', viewport: 'tablet', theme: 'light' });
  build(3 * D1 - 1000, undefined, undefined, { uniform: 'blues_b', gender: 'female', membership: 'senior', grade: 'Maj', counts: { ribbons: 12 } });
  // Twenty days ago: visitor A again.
  visit(20 * D1, 'aaaaaaaaaaaaaaaaaaaa', 'sa0', { access: 'code', viewport: 'desktop', theme: 'light', returning: true });
  build(20 * D1 - 1000, 'aaaaaaaaaaaaaaaaaaaa', 'sa0', { uniform: 'mess_dress', gender: 'male', membership: 'senior', grade: 'Col', counts: {} });
  // Ninety days ago: visitor C, outside 30 days and the chart.
  visit(90 * D1, 'cccccccccccccccccccc', 'sc0', { access: 'guest', viewport: 'desktop', theme: 'light', returning: false });
  for(const e of ev){ if(!e.vid) delete e.vid; if(!e.sid) delete e.sid; }
  return ev.sort((a, b) => (a.ts < b.ts ? -1 : 1));
}

test('the summary\'s numbers from known events: tiles, builds per day, uniforms, splits, features and errors', () => {
  const store = { events: knownEvents(), feedback: [{ id: 'fb_1', ts: at(H1), message: 'a' }, { id: 'fb_2', ts: at(10 * D1), message: 'b' }, { id: 'fb_3', ts: at(40 * D1), message: 'c' }], flags: { fb_2: { read: at(D1) }, fb_3: { archived: at(D1) } } };
  const s = summarize(store, { now: NOW, timezone: 'UTC', range: '30d' });
  assert.deepEqual(s.tiles.today, { visits: 2, visitors: 2, builds: 5, feedback: 1 });
  assert.deepEqual(s.tiles['7d'], { visits: 3, visitors: 2, builds: 6, feedback: 1 });
  assert.deepEqual(s.tiles['30d'], { visits: 4, visitors: 2, builds: 7, feedback: 2 });
  assert.deepEqual(s.tiles.all, { visits: 5, visitors: 3, builds: 7, feedback: 3 });
  assert.equal(s.unread, 1, 'fb_1 only: fb_2 is read, fb_3 archived');
  assert.equal(s.perDay.length, 60);
  assert.equal(s.perDay[59].day, '2026-10-29');
  assert.deepEqual(s.perDay[59], { day: '2026-10-29', builds: 5, visits: 2, visitors: 2 });
  assert.deepEqual(s.perDay[56], { day: '2026-10-26', builds: 1, visits: 1, visitors: 0 }, 'the Do Not Track visit counts, its visitor does not');
  assert.equal(s.perDay.reduce((a, d) => a + d.builds, 0), 7);
  // Uniforms built: one per visit and uniform, so the three Class B builds of visit sa1 are one.
  assert.equal(s.builds.events, 7);
  assert.equal(s.builds.counted, 5);
  assert.deepEqual(s.uniforms.map(u => [u.key, u.count]), [['blues_b', 2], ['blues_a', 1], ['mess_dress', 1], ['ocp', 1]]);
  assert.equal(s.uniforms[0].share, 0.4);
  assert.deepEqual(s.membership.map(u => [u.key, u.count]), [['senior', 3], ['cadet', 2]]);
  assert.deepEqual(s.gender.map(u => [u.key, u.count]), [['male', 3], ['female', 2]]);
  assert.equal(s.grades.find(g => g.key === 'C/Capt').count, 2);
  assert.equal(s.builds.fromImport, 1, 'the last Class B build of sa1 came from an import');
  assert.equal(s.builds.avg.ribbons, (6 + 6 + 10 + 12 + 0) / 5);
  assert.deepEqual(s.options, [{ key: 'sleeve = long', count: 1, share: 0.2 }]);
  assert.equal(s.features.png_download, 1);
  assert.equal(s.features.import_failed, 1);
  assert.deepEqual(s.features.templates, { pdf: 1, stl: 1 });
  assert.deepEqual(s.errors.map(e => [e.message, e.count]), [['TypeError: boom (wiring.js:9)', 2]]);
  assert.deepEqual(s.visits.access.map(r => [r.key, r.count]), [['code', 3], ['guest', 1]]);
  assert.deepEqual(s.visits.returning.map(r => [r.key, r.count]), [['returning', 2], ['new', 1], ['not tracked (Do Not Track)', 1]]);
  // All time takes in visitor C; today only the two today.
  assert.equal(summarize(store, { now: NOW, timezone: 'UTC', range: 'all' }).visits.count, 5);
  assert.equal(summarize(store, { now: NOW, timezone: 'UTC', range: 'today' }).builds.counted, 3);
  assert.equal(finalBuilds([{ data: { uniform: 'a' } }, { data: { uniform: 'a' } }]).length, 2, 'builds without a visit id each count');
});

test('"today" follows the dashboard\'s time zone', () => {
  // 03:00 UTC on the 29th is still the 28th in New York.
  const now = Date.parse('2026-10-29T03:00:00Z');
  const store = { events: [{ ts: '2026-10-29T01:00:00Z', name: 'visit' }, { ts: '2026-10-28T05:00:00Z', name: 'visit' }], feedback: [], flags: {} };
  assert.equal(summarize(store, { now, timezone: 'UTC' }).tiles.today.visits, 1);
  const ny = summarize(store, { now, timezone: 'America/New_York' });
  assert.equal(ny.tiles.today.visits, 2);
  assert.equal(ny.perDay[59].day, '2026-10-28');
  assert.equal(summarize(store, { now, timezone: 'Not/AZone' }).timezone, 'UTC', 'an unknown zone falls back to UTC');
});

test('the summary, events and CSV endpoints serve the stored data; a cell that looks like a formula is quoted', async () => {
  const dataDir = tmpDir();
  const events = knownEvents();
  fs.writeFileSync(path.join(dataDir, 'events-2026-10.jsonl'), events.filter(e => e.ts >= '2026-10').map(e => JSON.stringify(e) + '\n').join(''));
  fs.writeFileSync(path.join(dataDir, 'events-2026-07.jsonl'), events.filter(e => e.ts < '2026-08').map(e => JSON.stringify(e) + '\n').join('') + '{"torn line');
  fs.writeFileSync(path.join(dataDir, 'events-2026-10-03.jsonl.bak'), 'ignored');
  const t = await start({ dataDir });
  try{
    assert.equal(t.svc.store.events.length, events.length - events.filter(e => e.ts >= '2026-08' && e.ts < '2026-10').length, 'the months are loaded; a torn last line is skipped');
    await t.req('POST', '/api/feedback', { body: { message: '=HYPERLINK("http://evil.example","x")', contact: '+1 555', setup: { uniform: 'ocp' } } });
    const { cookie } = await t.login();
    const H = { Cookie: cookie };
    const s = (await t.req('GET', '/api/admin/summary?range=7d', { headers: H })).json;
    assert.equal(s.range, '7d');
    assert.equal(s.tiles.today.builds, 5);
    const log = (await t.req('GET', '/api/admin/events?limit=3', { headers: H })).json;
    assert.equal(log.events.length, 3);
    assert.ok(log.events[0].ts >= log.events[1].ts, 'newest first');
    const day = (await t.req('GET', '/api/admin/events?from=2026-10-26&to=2026-10-26', { headers: H })).json;
    assert.deepEqual(day.events.map(e => e.name), ['build', 'visit']);
    assert.deepEqual((await t.req('GET', '/api/admin/events?name=error', { headers: H })).json.events.length, 2);
    const ev = await t.req('GET', '/api/admin/export.csv?what=events', { headers: H });
    assert.match(ev.headers['content-type'], /^text\/csv/);
    assert.match(ev.headers['content-disposition'], /attachment; filename="uniform-builder-events-2026-10-29\.csv"/);
    const rows = ev.text.trim().split('\r\n');
    assert.equal(rows[0], 'time,event,visitor,visit,data');
    assert.equal(rows.length, t.svc.store.events.length + 1);
    const fb = await t.req('GET', '/api/admin/export.csv?what=feedback', { headers: H });
    const fbRows = fb.text.trim().split('\r\n');
    assert.equal(fbRows[0], 'id,time,read,archived,contact,page,message,setup');
    assert.ok(fbRows[1].includes(`"'=HYPERLINK(""http://evil.example"",""x"")"`), 'the formula is quoted and starts with a quote mark');
    assert.ok(fbRows[1].includes(",'+1 555,"), 'a contact starting with + is not a formula either');
    assert.equal((await t.req('GET', '/api/admin/export.csv?what=other', { headers: H })).status, 400);
  }finally{ await t.close(); }
});

test('cleanData keeps short tokens, numbers and booleans two levels deep and nothing else', () => {
  assert.deepEqual(cleanData({ a: 'blues_a', b: 3.14159, c: true, d: ['x'], e: { f: 'C/2d Lt', g: { h: 1 } }, 'bad key': 1, i: 'a@b' }, 0), { a: 'blues_a', b: 3.142, c: true, e: { f: 'C/2d Lt' } });
  assert.equal(cleanData('x'.repeat(65), 0), undefined);
  assert.equal(cleanData(Infinity, 0), undefined);
});

test('deploy/var and deploy/.env stay out of the repository and the images; the site build does not publish the API', () => {
  const ignore = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8');
  assert.match(ignore, /^deploy\/var\/$/m);
  assert.match(ignore, /^deploy\/\.env$/m);
  const dockerIgnore = fs.readFileSync(path.join(ROOT, '.dockerignore'), 'utf8');
  for(const p of ['deploy/var', 'deploy/.env', '.git']) assert.match(dockerIgnore, new RegExp('^' + p.replace(/\./g, '\\.') + '$', 'm'), p);
  const compose = fs.readFileSync(path.join(ROOT, 'deploy', 'docker-compose.yml'), 'utf8');
  assert.match(compose, /\n {2}uniform-api:\n/);
  assert.match(compose, /- \.\/var:\/data/);
  assert.match(compose, /path: \.env\n {8}required: false/);
  const apiService = compose.split('\n  uniform-api:\n')[1].split('\nnetworks:')[0];
  assert.doesNotMatch(apiService, /\n {4}ports:/, 'no host port');
  assert.match(apiService, /read_only: true/);
  assert.match(apiService, /user: "1000:1000"/);
  const docker = fs.readFileSync(path.join(ROOT, 'deploy', 'api', 'Dockerfile'), 'utf8');
  assert.match(docker, /^FROM node:22-alpine$/m);
  assert.match(docker, /^USER node$/m);
  assert.doesNotMatch(docker.replace(/^#.*$/gm, ''), /npm (install|ci)/, 'no dependencies');
  // The service uses Node's built-ins only.
  for(const f of ['service.js', 'store.js', 'metrics.js', 'pages.js', 'server.js']){
    const src = fs.readFileSync(path.join(ROOT, 'deploy', 'api', f), 'utf8');
    for(const m of src.matchAll(/require\('([^']+)'\)/g)) assert.match(m[1], /^(node:|\.\/)/, `${f} requires ${m[1]}`);
  }
});

test('the Caddyfile sends /api/* and /admin* to uniform-api before the static rules, which keep GET/HEAD only', () => {
  const caddy = fs.readFileSync(path.join(ROOT, 'deploy', 'Caddyfile.tunnel'), 'utf8');
  const api = caddy.indexOf('handle @app {'), site = caddy.indexOf('\n\thandle {\n');
  assert.match(caddy, /@app path \/api\/\* \/admin \/admin\/\*/);
  assert.ok(api > 0 && site > api, 'the API handle comes first');
  assert.match(caddy.slice(api, site), /reverse_proxy uniform-api:8080/);
  assert.match(caddy.slice(api, site), /max_size 64KB/);
  assert.doesNotMatch(caddy.slice(api, site), /badmethod|Cache-Control/);
  const staticBlock = caddy.slice(site);
  assert.match(staticBlock, /@badmethod not method GET HEAD\n\t\trespond @badmethod 405/);
  assert.match(staticBlock, /@dotfiles path \*\/\.\*\n\t\trespond @dotfiles 404/);
  // The headers stay at the site level, so the API and the dashboard get them too.
  assert.ok(caddy.indexOf('Content-Security-Policy') < api);
  assert.ok(caddy.includes(buildCsp({ forHeader: true })));
});
