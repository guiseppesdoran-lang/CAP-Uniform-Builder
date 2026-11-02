'use strict';
// The site's small API (LIVE13 E69 metrics + admin, E70 feedback). Ethan: "i would like an admin page (literally only
// accessible if you do /admin after the url (uniform.ebhq.dev/admin) and put in a password) containing a log of all uniforms
// built and such, any and all applicable metrics. additionally, I would like a feedback button where a member can submit
// feedback and it would put a message in the admin dashboard."
//
// Node built-ins only. Caddy (deploy/Caddyfile.tunnel) sends /api/* and /admin* here; everything is same-origin.
//
//   POST /api/events                       a batch of anonymous usage events from js/telemetry.js (16 KB, 50 events at most)
//   POST /api/feedback                     a message from js/feedback.js (4000 characters, contact 200, optional setup and page)
//   GET  /api/health                       {"ok":true,...} for the container's health check
//   GET  /admin                            the password form, or the dashboard once signed in
//   POST /admin                            sign in: a signed HttpOnly SameSite=Strict cookie for 12 h
//   POST /admin/logout                     sign out
//   GET  /admin/app.js, /admin/app.css     the dashboard's own script and style (CSP script-src 'self')
//   GET  /admin/theme.js                   the light/dark switch (no cookie needed: the sign-in form uses it too)
//   GET  /api/admin/summary?range=         the dashboard's numbers (metrics.js); range today, 7d, 30d or all
//   GET  /api/admin/events?from&to&limit   the event log, newest first
//   GET  /api/admin/feedback?status=       the inbox, newest first; status unread, all (default, not archived) or archived
//   POST /api/admin/feedback/:id/read      body {"value":false} to undo; same for /archive
//   GET  /api/admin/export.csv?what=       events or feedback, as CSV
//
// Privacy: no IP address is stored. The client address is only hashed in memory (with a key made at start) for the login
// lockout and the rate limits, and those tables are dropped as they expire.
const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { createStore } = require('./store.js');
const { summarize } = require('./metrics.js');
const pages = require('./pages.js');

const LIMITS = {
  eventsBody: 16 * 1024, eventsCount: 50,
  feedbackBody: 24 * 1024, message: 4000, contact: 200, page: 200,
  loginBody: 4 * 1024, flagBody: 1024
};
const EVENT_NAMES = new Set(['visit', 'build', 'png_download', 'import', 'remove_ribbons', 'templates', 'shopping_open', 'feedback_sent', 'uniform_switch', 'setup_file', 'error']);
const SESSION_MS = 12 * 3600 * 1000;
const COOKIE = 'capub_admin';
const LOCKOUT = { failures: 5, ms: 60 * 1000 };
// Per client, per window: enough for a member (a batch every 10 s) and little for a script.
const RATE = { events: { n: 120, ms: 10 * 60 * 1000 }, feedback: { n: 8, ms: 60 * 60 * 1000 } };
// Per day for the whole site, so a flood cannot fill the disk.
const DAILY_CAP = { events: 100000, feedback: 500 };

// The site's Content-Security-Policy (scripts/csp.cjs buildCsp({ forHeader: true }); tests/api.test.cjs checks they match).
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";
const BASE_HEADERS = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'Content-Security-Policy': CSP,
  'Cross-Origin-Opener-Policy': 'same-origin',
  'X-Frame-Options': 'DENY'
};

const PUBLIC_DIR = path.join(__dirname, 'public');

// ---- input cleaning -------------------------------------------------------------------------------------------------
const KEY_RE = /^[A-Za-z][A-Za-z0-9_]{0,31}$/;
const TOKEN_RE = /^[A-Za-z0-9 _.:/+()=-]{0,64}$/;   // uniform keys, grades ("C/2d Lt"), option values
const ID_RE = /^[a-z0-9]{8,40}$/;
const stripControls = (s, keepNewlines) => String(s).replace(keepNewlines ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g : /[\u0000-\u001f\u007f]/g, '');

// A flat-ish object of short tokens, numbers and booleans (two levels), as the page sends. Anything else is dropped.
function cleanData(v, depth, free){
  if(typeof v === 'boolean') return v;
  if(typeof v === 'number') return Number.isFinite(v) ? Math.max(-1e6, Math.min(1e6, Math.round(v * 1000) / 1000)) : undefined;
  if(typeof v === 'string') return TOKEN_RE.test(v) ? v : undefined;
  if(v && typeof v === 'object' && !Array.isArray(v) && depth < 2){
    const out = {};
    let n = 0;
    for(const [k, x] of Object.entries(v)){
      if(!KEY_RE.test(k) || ++n > 40) continue;
      const c = free && free.has(k) && typeof x === 'string' ? stripControls(x).slice(0, 300) : cleanData(x, depth + 1);
      if(c !== undefined) out[k] = c;
    }
    return out;
  }
  return undefined;
}
const ERROR_FREE = new Set(['message', 'file']);

// ---- small helpers --------------------------------------------------------------------------------------------------
function send(res, status, body, type, extra){
  const headers = Object.assign({}, BASE_HEADERS, { 'Content-Type': type || 'application/json; charset=utf-8' }, extra || {});
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
  headers['Content-Length'] = buf.length;
  res.writeHead(status, headers);
  res.end(res.req && res.req.method === 'HEAD' ? undefined : buf);
}
const json = (res, status, obj, extra) => send(res, status, obj, 'application/json; charset=utf-8', extra);
const html = (res, status, text, extra) => send(res, status, text, 'text/html; charset=utf-8', extra);

class HttpError extends Error{ constructor(status, message){ super(message); this.status = status; } }

function readBody(req, limit){
  return new Promise((resolve, reject) => {
    const len = Number(req.headers['content-length']);
    if(Number.isFinite(len) && len > limit){ reject(new HttpError(413, 'too large')); req.resume(); return; }
    const chunks = [];
    let size = 0, done = false;
    req.on('data', c => {
      if(done) return;
      size += c.length;
      if(size > limit){ done = true; reject(new HttpError(413, 'too large')); req.resume(); return; }
      chunks.push(c);
    });
    req.on('end', () => { if(!done){ done = true; resolve(Buffer.concat(chunks)); } });
    req.on('error', err => { if(!done){ done = true; reject(err); } });
  });
}
function parseJson(buf){
  try{ return JSON.parse(buf.toString('utf8') || 'null'); }catch(e){ throw new HttpError(400, 'not JSON'); }
}

// A POST from another site is refused. Browsers say where a request comes from in Sec-Fetch-Site; with it, only
// same-origin passes. Without it (older browsers, curl) a mismatched Origin is refused. Origin alone is not enough:
// the site's Referrer-Policy is no-referrer, under which a browser sends "Origin: null" on its own form posts and
// fetches. The admin cookie is SameSite=Strict besides, so another site's request never carries it.
// The Host Caddy passes on is the site's own (cloudflared keeps the visitor's Host); X-Forwarded-Host is taken too.
function sameOrigin(req){
  const site = req.headers['sec-fetch-site'];
  if(site) return site === 'same-origin';
  const o = req.headers.origin;
  if(!o || o === 'null') return true;
  let host;
  try{ host = new URL(o).host; }catch(e){ return false; }
  return host === req.headers.host || host === req.headers['x-forwarded-host'];
}

function clientAddress(req){
  // cloudflared -> Caddy -> here: Cloudflare puts the visitor's address in CF-Connecting-IP; Caddy passes it through.
  const cf = req.headers['cf-connecting-ip'];
  if(cf) return String(cf).trim();
  const xff = req.headers['x-forwarded-for'];
  if(xff) return String(xff).split(',')[0].trim();
  return req.socket.remoteAddress || '';
}

function parseCookies(header){
  const out = {};
  for(const part of String(header || '').split(';')){
    const i = part.indexOf('=');
    if(i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

const csvCell = v => {
  let s = v == null ? '' : String(v);
  // A cell a spreadsheet would run as a formula starts with a quote mark instead.
  if(/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = rows => rows.map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n';

function isoDay(s, end){
  if(!s) return null;
  if(/^\d{4}-\d\d-\d\d$/.test(s)) return Date.parse(s + (end ? 'T23:59:59.999Z' : 'T00:00:00Z'));
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}

// ---- the service ----------------------------------------------------------------------------------------------------
function createService(opts = {}){
  const log = opts.log || (msg => console.log(`[uniform-api] ${msg}`));
  const now = opts.now || (() => Date.now());
  const store = createStore(opts.dataDir);
  const adminPassword = opts.adminPassword || '';
  // A second password (ADMIN_PASSWORD_2, Ethan: "set up a second password for the admin page for doran") opens the same dashboard;
  // the log says which one signed in. Either may be set; the dashboard is on while at least one is.
  const adminPassword2 = opts.adminPassword2 || '';
  const passwords = [['ADMIN_PASSWORD', adminPassword], ['ADMIN_PASSWORD_2', adminPassword2]].filter(([, pw]) => pw.length > 0);
  const adminOn = passwords.length > 0;
  if(!adminOn) log('ADMIN_PASSWORD is not set: /admin and /api/admin answer 503 until it is set in deploy/.env and the container is restarted. Events and feedback are still taken.');
  for(const [name, pw] of passwords) if(pw.length < 12) log(`${name} is shorter than 12 characters; a longer one is advised.`);
  const cookieSecure = opts.cookieSecure !== false;
  const timezone = opts.timezone || 'UTC';

  // Keys. The cookie key depends on the password too, so changing ADMIN_PASSWORD signs every session out.
  const secret = store.sessionSecret(opts.sessionSecret);
  const pwHashes = passwords.map(([name, pw]) => [name, crypto.createHash('sha256').update(pw).digest()]);
  const pwHash = crypto.createHash('sha256').update(passwords.map(([, pw]) => pw).join('\n')).digest();
  const cookieKey = crypto.createHmac('sha256', secret).update('capub-admin-session\n').update(pwHash).digest();
  const addrKey = crypto.randomBytes(32);   // in memory only: the address hashes mean nothing after a restart
  const addrHash = req => crypto.createHmac('sha256', addrKey).update(clientAddress(req)).digest('base64url').slice(0, 22);

  // ---- rate limits and lockout (memory) ----
  const buckets = new Map();   // `${kind}|${hash}` -> { n, until }
  function limited(kind, req){
    const r = RATE[kind], k = `${kind}|${addrHash(req)}`, t = now();
    let b = buckets.get(k);
    if(!b || b.until <= t){ b = { n: 0, until: t + r.ms }; buckets.set(k, b); }
    return ++b.n > r.n;
  }
  const daily = { day: '', events: 0, feedback: 0 };
  function overDaily(kind, n){
    const d = new Date(now()).toISOString().slice(0, 10);
    if(daily.day !== d){ daily.day = d; daily.events = 0; daily.feedback = 0; }
    if(daily[kind] + n > DAILY_CAP[kind]) return true;
    daily[kind] += n;
    return false;
  }
  const failures = new Map();  // hash -> { n, lockedUntil }
  const revoked = new Map();   // nonce -> expiry
  const sweeper = setInterval(() => {
    const t = now();
    for(const [k, b] of buckets) if(b.until <= t) buckets.delete(k);
    for(const [k, f] of failures) if(f.lockedUntil <= t && f.last + 15 * 60 * 1000 <= t) failures.delete(k);
    for(const [k, exp] of revoked) if(exp <= t) revoked.delete(k);
  }, 60 * 1000);
  sweeper.unref();

  // ---- sessions ----
  const sign = s => crypto.createHmac('sha256', cookieKey).update(s).digest('base64url');
  function makeToken(){
    const exp = now() + SESSION_MS, nonce = crypto.randomBytes(16).toString('base64url');
    return `${exp}.${nonce}.${sign(`${exp}.${nonce}`)}`;
  }
  function session(req){
    if(!adminOn) return null;
    const tok = parseCookies(req.headers.cookie)[COOKIE];
    if(!tok) return null;
    const [exp, nonce, sig] = tok.split('.');
    if(!exp || !nonce || !sig) return null;
    const want = Buffer.from(sign(`${exp}.${nonce}`)), got = Buffer.from(sig);
    if(want.length !== got.length || !crypto.timingSafeEqual(want, got)) return null;
    if(!(Number(exp) > now()) || revoked.has(nonce)) return null;
    return { exp: Number(exp), nonce };
  }
  const cookie = (value, maxAge) => `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${cookieSecure ? '; Secure' : ''}`;
  // The name of the password that matches, or null. Every stored hash is compared, so the time taken does not say which one failed.
  function passwordMatches(given){
    const a = crypto.createHash('sha256').update(String(given)).digest();
    let hit = null;
    for(const [name, h] of pwHashes) if(crypto.timingSafeEqual(a, h)) hit = hit || name;
    return hit;
  }

  // ---- handlers ----
  async function postEvents(req, res){
    if(!sameOrigin(req)) return json(res, 403, { error: 'origin' });
    const body = parseJson(await readBody(req, LIMITS.eventsBody));
    if(!body || typeof body !== 'object' || !Array.isArray(body.events)) throw new HttpError(400, 'events missing');
    if(body.events.length > LIMITS.eventsCount) throw new HttpError(413, `at most ${LIMITS.eventsCount} events`);
    if(limited('events', req)) return json(res, 429, { error: 'slow down' });
    const t = now();
    const sent = Number(body.sent);
    const vid = typeof body.vid === 'string' && ID_RE.test(body.vid) ? body.vid : null;
    const sid = typeof body.sid === 'string' && ID_RE.test(body.sid) ? body.sid : null;
    const out = [];
    for(const e of body.events){
      if(!e || typeof e !== 'object' || !EVENT_NAMES.has(e.name)) continue;
      // The page's own clock gives how long the event waited in its queue (at most an hour); the time stored is the server's.
      const age = Number.isFinite(sent) && Number.isFinite(Number(e.at)) ? Math.max(0, Math.min(3600000, sent - Number(e.at))) : 0;
      const rec = { ts: new Date(t - age).toISOString(), name: e.name };
      if(vid) rec.vid = vid;
      if(sid) rec.sid = sid;
      const data = cleanData(e.data || {}, 0, e.name === 'error' ? ERROR_FREE : null);
      if(data && Object.keys(data).length) rec.data = data;
      out.push(rec);
    }
    if(out.length && overDaily('events', out.length)) return json(res, 429, { error: 'daily limit' });
    store.addEvents(out);
    return json(res, 202, { ok: true, stored: out.length });
  }

  async function postFeedback(req, res){
    if(!sameOrigin(req)) return json(res, 403, { error: 'origin' });
    const body = parseJson(await readBody(req, LIMITS.feedbackBody));
    if(!body || typeof body !== 'object') throw new HttpError(400, 'body missing');
    const message = stripControls(body.message == null ? '' : body.message, true).trim();
    if(!message) throw new HttpError(400, 'message missing');
    if(message.length > LIMITS.message) throw new HttpError(413, `message over ${LIMITS.message} characters`);
    const contact = stripControls(body.contact == null ? '' : body.contact).trim();
    if(contact.length > LIMITS.contact) throw new HttpError(413, `contact over ${LIMITS.contact} characters`);
    const page = stripControls(body.page == null ? '' : body.page).trim().slice(0, LIMITS.page);
    if(limited('feedback', req)) return json(res, 429, { error: 'Too many messages from here in the last hour. Please try again later.' });
    if(overDaily('feedback', 1)) return json(res, 429, { error: 'The feedback box is full for today. Please try again tomorrow.' });
    const entry = { ts: new Date(now()).toISOString(), message };
    if(contact) entry.contact = contact;
    if(page) entry.page = page;
    const setup = body.setup && typeof body.setup === 'object' ? cleanData(body.setup, 0) : null;
    if(setup && Object.keys(setup).length) entry.setup = setup;
    const item = store.addFeedback(entry);
    return json(res, 201, { ok: true, id: item.id });
  }

  async function postLogin(req, res){
    if(!sameOrigin(req)) return html(res, 403, pages.login({ error: 'That request came from another site.' }));
    const key = addrHash(req), t = now();
    let f = failures.get(key);
    if(f && f.lockedUntil > t){
      const wait = Math.ceil((f.lockedUntil - t) / 1000);
      return html(res, 429, pages.login({ error: `Too many wrong passwords. Wait ${wait} s and try again.` }), { 'Retry-After': String(wait) });
    }
    if(!f || f.lockedUntil) f = { n: 0, lockedUntil: 0, last: t };   // a lock that has run out starts the count again
    const form = new URLSearchParams((await readBody(req, LIMITS.loginBody)).toString('utf8'));
    const which = passwordMatches(form.get('password') || '');
    if(which){
      failures.delete(key);
      log(`admin signed in (${which})`);
      return send(res, 303, '', 'text/plain; charset=utf-8', { Location: '/admin', 'Set-Cookie': cookie(makeToken(), SESSION_MS / 1000) });
    }
    f.n++; f.last = t;
    if(f.n >= LOCKOUT.failures){ f.lockedUntil = t + LOCKOUT.ms; log('admin sign-in locked for 60 s after 5 wrong passwords from one address'); }
    failures.set(key, f);
    const locked = f.lockedUntil > t;
    return html(res, locked ? 429 : 401, pages.login({ error: locked ? `Too many wrong passwords. Wait ${LOCKOUT.ms / 1000} s and try again.` : 'That password is not right.' }));
  }

  function adminFile(res, name, type){
    const buf = fs.readFileSync(path.join(PUBLIC_DIR, name));
    return send(res, 200, buf, type);
  }

  function feedbackView(f){
    const fl = store.flags[f.id] || {};
    return Object.assign({}, f, { read: fl.read || null, archived: fl.archived || null });
  }

  async function admin(req, res, url){
    const p = url.pathname;
    if(req.method === 'GET' && p === '/api/admin/summary') return json(res, 200, summarize(store, { now: now(), timezone, range: url.searchParams.get('range') || '30d' }));
    if(req.method === 'GET' && p === '/api/admin/events'){
      const from = isoDay(url.searchParams.get('from'), false), to = isoDay(url.searchParams.get('to'), true);
      const name = url.searchParams.get('name');
      const limit = Math.max(1, Math.min(5000, Number(url.searchParams.get('limit')) || 200));
      const out = [];
      for(let i = store.events.length - 1; i >= 0 && out.length < limit; i--){
        const e = store.events[i], ms = Date.parse(e.ts);
        if(from !== null && ms < from) continue;
        if(to !== null && ms > to) continue;
        if(name && e.name !== name) continue;
        out.push(e);
      }
      return json(res, 200, { events: out, total: store.events.length });
    }
    if(req.method === 'GET' && p === '/api/admin/feedback'){
      const status = url.searchParams.get('status') || 'all';
      const list = store.feedback.map(feedbackView).filter(f => status === 'archived' ? f.archived : !f.archived && (status !== 'unread' || !f.read))
        .sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));
      return json(res, 200, { feedback: list, unread: store.feedback.map(feedbackView).filter(f => !f.read && !f.archived).length });
    }
    const m = /^\/api\/admin\/feedback\/([A-Za-z0-9_]{1,40})\/(read|archive)$/.exec(p);
    if(req.method === 'POST' && m){
      if(!sameOrigin(req)) return json(res, 403, { error: 'origin' });
      const buf = await readBody(req, LIMITS.flagBody);
      const body = buf.length ? parseJson(buf) : {};
      const on = !(body && body.value === false);
      const flags = store.setFlag(m[1], m[2] === 'read' ? 'read' : 'archived', on, new Date(now()).toISOString());
      if(!flags) return json(res, 404, { error: 'no such feedback' });
      return json(res, 200, { ok: true, id: m[1], read: flags.read || null, archived: flags.archived || null });
    }
    if(req.method === 'GET' && p === '/api/admin/export.csv'){
      const what = url.searchParams.get('what');
      const stamp = new Date(now()).toISOString().slice(0, 10);
      if(what === 'events'){
        const rows = [['time', 'event', 'visitor', 'visit', 'data']];
        for(const e of store.events) rows.push([e.ts, e.name, e.vid || '', e.sid || '', e.data ? JSON.stringify(e.data) : '']);
        return send(res, 200, csv(rows), 'text/csv; charset=utf-8', { 'Content-Disposition': `attachment; filename="uniform-builder-events-${stamp}.csv"` });
      }
      if(what === 'feedback'){
        const rows = [['id', 'time', 'read', 'archived', 'contact', 'page', 'message', 'setup']];
        for(const f of store.feedback.map(feedbackView)) rows.push([f.id, f.ts, f.read || '', f.archived || '', f.contact || '', f.page || '', f.message, f.setup ? JSON.stringify(f.setup) : '']);
        return send(res, 200, csv(rows), 'text/csv; charset=utf-8', { 'Content-Disposition': `attachment; filename="uniform-builder-feedback-${stamp}.csv"` });
      }
      return json(res, 400, { error: 'what=events or what=feedback' });
    }
    return json(res, 404, { error: 'not found' });
  }

  async function route(req, res){
    const q = req.url.indexOf('?');
    const url = { pathname: q < 0 ? req.url : req.url.slice(0, q), searchParams: new URLSearchParams(q < 0 ? '' : req.url.slice(q + 1)) };
    const p = url.pathname;
    const get = req.method === 'GET' || req.method === 'HEAD';

    if(p === '/api/health' && get) return json(res, 200, { ok: true, admin: adminOn });
    if(p === '/api/events' && req.method === 'POST') return postEvents(req, res);
    if(p === '/api/feedback' && req.method === 'POST') return postFeedback(req, res);

    if(p === '/admin/') return send(res, 308, '', 'text/plain; charset=utf-8', { Location: '/admin' });
    // The light/dark switch is on the sign-in form too, so its script is the one admin file served without the cookie.
    if(p === '/admin/theme.js' && get) return adminFile(res, 'admin-theme.js', 'text/javascript; charset=utf-8');
    if(p === '/admin' || p.startsWith('/admin/') || p.startsWith('/api/admin/')){
      if(!adminOn){
        return p.startsWith('/api/') ? json(res, 503, { error: 'ADMIN_PASSWORD is not set' }) : html(res, 503, pages.notConfigured());
      }
      const s = session(req);
      if(p === '/admin' && get) return html(res, 200, s ? pages.dashboard() : pages.login({}));
      if(p === '/admin' && req.method === 'POST') return postLogin(req, res);
      if(p === '/admin/logout' && req.method === 'POST'){
        if(!sameOrigin(req)) return html(res, 403, pages.login({ error: 'That request came from another site.' }));
        if(s) revoked.set(s.nonce, s.exp);
        return send(res, 303, '', 'text/plain; charset=utf-8', { Location: '/admin', 'Set-Cookie': cookie('', 0) });
      }
      if(!s) return p.startsWith('/api/') ? json(res, 401, { error: 'sign in at /admin' }) : send(res, 401, 'Sign in at /admin', 'text/plain; charset=utf-8');
      if(p === '/admin/app.js' && get) return adminFile(res, 'admin.js', 'text/javascript; charset=utf-8');
      if(p === '/admin/app.css' && get) return adminFile(res, 'admin.css', 'text/css; charset=utf-8');
      if(p.startsWith('/api/admin/')) return admin(req, res, url);
      return send(res, 404, 'Not found', 'text/plain; charset=utf-8');
    }
    if(p.startsWith('/api/')) return json(res, req.method === 'GET' || req.method === 'POST' ? 404 : 405, { error: 'not found' });
    return send(res, 404, 'Not found', 'text/plain; charset=utf-8');
  }

  const server = http.createServer((req, res) => {
    res.req = req;
    route(req, res).catch(err => {
      if(res.headersSent){ res.destroy(); return; }
      if(err instanceof HttpError) return json(res, err.status, { error: err.message });
      log(`error: ${err && err.stack || err}`);
      return json(res, 500, { error: 'server error' });
    });
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;

  return { server, store, close: () => { clearInterval(sweeper); return new Promise(r => server.close(() => r())); } };
}

module.exports = { createService, cleanData, CSP, LIMITS, EVENT_NAMES, csvCell };
