'use strict';
// The numbers the admin dashboard shows, worked out from the stored events and feedback (LIVE13 E69). Pure functions, so the
// tests can feed known events and check every figure.
//
// Counting rules:
// - visits: `visit` events (one per page load once the access gate is passed).
// - visitors: distinct anonymous visitor ids among all events in the range. A browser that sends Do Not Track sends no id,
//   so its visits count as visits and not as visitors.
// - builds: `build` events. The page sends one when the setup is complete and the drawing has settled, then at most one
//   every 30 s while the member keeps changing it, and the last setup when the page is closed (js/telemetry.js).
// - uniforms built and the splits (membership, cut, grade, items, options): each page visit's last build of each uniform,
//   so a member who adds ten ribbons one at a time counts once for that uniform. A build without a session id (Do Not Track)
//   counts on its own.
const DAY = 86400000;

function dayFormatter(timeZone){
  let tz = timeZone || 'UTC';
  try{ new Intl.DateTimeFormat('en-CA', { timeZone: tz }); }catch(e){ tz = 'UTC'; }
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
  return { tz, day: ms => f.format(new Date(ms)) };
}

// The start (ms) of the day `ms` falls in, in the dashboard's time zone (the offset is read from the formatter, so DST is right).
function startOfDay(ms, D){
  const key = D.day(ms);
  // Binary search between a moment surely on an earlier day and ms for the first second with the same day key.
  let lo = ms - DAY - 3600000, hi = ms;
  while(hi - lo > 1000){ const mid = Math.floor((lo + hi) / 2); if(D.day(mid) === key) hi = mid; else lo = mid; }
  return hi;
}

const RANGES = ['today', '7d', '30d', 'all'];
function rangeStart(range, now, D){
  if(range === 'today') return startOfDay(now, D);
  if(range === '7d') return now - 7 * DAY;
  if(range === '30d') return now - 30 * DAY;
  return 0;
}

const tally = () => new Map();
const bump = (m, k, n = 1) => { if(k === undefined || k === null || k === '') k = '(none)'; m.set(String(k), (m.get(String(k)) || 0) + n); };
const rows = (m, total) => [...m.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([key, count]) => ({ key, count, share: total ? count / total : 0 }));

// The last build per visit and uniform.
function finalBuilds(builds){
  const last = new Map();
  builds.forEach((e, i) => last.set(e.sid ? `${e.sid}|${(e.data || {}).uniform}` : `#${i}`, e));
  return [...last.values()];
}

function summarize(store, opts = {}){
  const now = opts.now || Date.now();
  const D = dayFormatter(opts.timezone);
  const range = RANGES.includes(opts.range) ? opts.range : '30d';
  const events = store.events.map(e => Object.assign({ ms: Date.parse(e.ts) }, e)).filter(e => Number.isFinite(e.ms));
  const flags = store.flags || {};
  const fbMs = store.feedback.map(f => ({ f, ms: Date.parse(f.ts) }));

  const tiles = {};
  for(const r of RANGES){
    const from = rangeStart(r, now, D);
    const inRange = events.filter(e => e.ms >= from && e.ms <= now);
    tiles[r] = {
      visits: inRange.filter(e => e.name === 'visit').length,
      visitors: new Set(inRange.filter(e => e.vid).map(e => e.vid)).size,
      builds: inRange.filter(e => e.name === 'build').length,
      feedback: fbMs.filter(x => x.ms >= from && x.ms <= now).length
    };
  }
  const unread = store.feedback.filter(f => !(flags[f.id] || {}).read && !(flags[f.id] || {}).archived).length;

  // Builds and visits per day, the last 60 days in the dashboard's time zone, oldest first.
  const perDay = [];
  const index = new Map();
  for(let i = 59; i >= 0; i--){
    const day = D.day(now - i * DAY);
    if(index.has(day)) continue;
    index.set(day, perDay.length);
    perDay.push({ day, builds: 0, visits: 0, visitors: 0 });
  }
  const dayVisitors = new Map();
  for(const e of events){
    const at = index.get(D.day(e.ms));
    if(at === undefined) continue;
    if(e.name === 'build') perDay[at].builds++;
    if(e.name === 'visit') perDay[at].visits++;
    if(e.vid){ if(!dayVisitors.has(at)) dayVisitors.set(at, new Set()); dayVisitors.get(at).add(e.vid); }
  }
  for(const [at, set] of dayVisitors) perDay[at].visitors = set.size;

  // The tables, for the chosen range.
  const from = rangeStart(range, now, D);
  const sel = events.filter(e => e.ms >= from && e.ms <= now);
  const builds = sel.filter(e => e.name === 'build');
  const finals = finalBuilds(builds);
  const uniforms = tally(), membership = tally(), gender = tally(), grade = tally(), options = tally();
  const items = { ribbons: 0, devices: 0, minis: 0, badges: 0, militaryBadges: 0, patches: 0, cords: 0 };
  let fromImport = 0, named = 0;
  for(const e of finals){
    const d = e.data || {};
    bump(uniforms, d.uniform); bump(membership, d.membership); bump(gender, d.gender); bump(grade, d.grade);
    const c = d.counts || {};
    for(const k of Object.keys(items)) items[k] += Number(c[k]) || 0;
    if(d.fromImport) fromImport++;
    if(d.nameShown) named++;
    for(const [k, v] of Object.entries(d.options || {})) bump(options, `${k} = ${v}`);
  }
  const avg = {};
  for(const [k, v] of Object.entries(items)) avg[k] = finals.length ? v / finals.length : 0;

  const count = (name, pred) => sel.filter(e => e.name === name && (!pred || pred(e.data || {}))).length;
  const templates = tally();
  for(const e of sel.filter(e => e.name === 'templates')) bump(templates, (e.data || {}).what);
  const features = {
    png_download: count('png_download', d => d.ok !== false),
    png_failed: count('png_download', d => d.ok === false),
    import_ok: count('import', d => d.ok === true),
    import_failed: count('import', d => d.ok === false),
    quick_strip: count('quick_strip', d => d.action !== 'restore'),
    quick_restore: count('quick_strip', d => d.action === 'restore'),
    templates: Object.fromEntries(templates),
    shopping_open: count('shopping_open'),
    feedback_sent: count('feedback_sent'),
    uniform_switch: count('uniform_switch'),
    setup_saved: count('setup_file', d => d.action === 'save'),
    setup_opened: count('setup_file', d => d.action === 'open')
  };

  const visits = sel.filter(e => e.name === 'visit');
  const access = tally(), viewport = tally(), theme = tally(), returning = tally();
  for(const e of visits){
    const d = e.data || {};
    bump(access, d.access); bump(viewport, d.viewport); bump(theme, d.theme);
    bump(returning, e.vid ? (d.returning ? 'returning' : 'new') : 'not tracked (Do Not Track)');
  }

  const errors = new Map();
  for(const e of sel.filter(e => e.name === 'error')){
    const d = e.data || {};
    const key = `${d.message || '(no message)'}${d.file ? ` (${d.file}${d.line ? ':' + d.line : ''})` : ''}`;
    const cur = errors.get(key) || { message: key, count: 0, last: e.ts };
    cur.count++; if(e.ts > cur.last) cur.last = e.ts;
    errors.set(key, cur);
  }

  return {
    now: new Date(now).toISOString(), timezone: D.tz, range,
    tiles, unread, feedbackTotal: store.feedback.length, eventsTotal: store.events.length,
    firstEvent: events.length ? events[0].ts : null,
    perDay,
    builds: { events: builds.length, counted: finals.length, fromImport, nameShown: named, avg },
    uniforms: rows(uniforms, finals.length), membership: rows(membership, finals.length), gender: rows(gender, finals.length),
    grades: rows(grade, finals.length), options: rows(options, finals.length).slice(0, 40),
    features,
    visits: { count: visits.length, access: rows(access, visits.length), viewport: rows(viewport, visits.length), theme: rows(theme, visits.length), returning: rows(returning, visits.length) },
    errors: [...errors.values()].sort((a, b) => b.count - a.count || (a.last < b.last ? 1 : -1)).slice(0, 20)
  };
}

module.exports = { summarize, finalBuilds, dayFormatter, startOfDay, RANGES };
