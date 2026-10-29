// The Uniform Builder admin dashboard (LIVE13 E69, E70). Served at /admin/app.js to a signed-in admin only. Reads
// /api/admin/*, draws the tiles, the builds-per-day chart (inline SVG, no library), the tables, the feedback inbox and the
// live log. Every text that came from a member (feedback, contact, error messages) goes in with textContent, never as HTML.
(function(){
  'use strict';
  const $ = id => document.getElementById(id);
  const SVGNS = 'http://www.w3.org/2000/svg';
  function el(tag, attrs, ...kids){
    const n = document.createElement(tag);
    for(const [k, v] of Object.entries(attrs || {})){
      if(v == null || v === false) continue;
      if(k === 'class') n.className = v; else if(k === 'text') n.textContent = v; else n.setAttribute(k, v === true ? '' : v);
    }
    for(const k of kids.flat()) if(k != null && k !== false) n.append(k instanceof Node ? k : document.createTextNode(String(k)));
    return n;
  }
  function svg(tag, attrs){
    const n = document.createElementNS(SVGNS, tag);
    for(const [k, v] of Object.entries(attrs || {})) n.setAttribute(k, v);
    return n;
  }
  const fmt = n => Number(n || 0).toLocaleString('en-US');
  const pct = x => (x * 100).toFixed(x > 0 && x < 0.1 ? 1 : 0) + '%';
  const avg = x => Number(x || 0).toFixed(1);
  const when = iso => { const d = new Date(iso); return isNaN(d) ? String(iso || '') : d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); };

  // The page's own names for things.
  const UNIFORMS = {
    blues_a: 'Blues: Class A', blues_b: 'Blues: Class B', mess_dress: 'Mess Dress', semi_formal: 'Corporate Semi-formal', semi_formal_usaf: 'Cadet Semi-formal',
    aviator: 'Aviator Shirt', aviator_blazer: 'Aviator + Blazer', polo: 'Corporate Working (Polo)', corporate_field: 'Corporate Field Uniform', abu: 'ABU',
    ocp: 'OCP', flight_suit: 'Flight Suit', corporate_flight_suit: 'Corporate Flight Suit'
  };
  const uniformName = k => UNIFORMS[k] || k;
  const EVENT_NAMES = {
    visit: 'Visit', build: 'Build', png_download: 'PNG download', import: 'Member report import', quick_strip: 'Quick strip', templates: 'Placement template',
    shopping_open: 'Shopping list', feedback_sent: 'Feedback sent', uniform_switch: 'Uniform switch', setup_file: 'Setup file', error: 'Error'
  };

  // ---- data ----
  let range = 'all';
  try{ range = sessionStorage.getItem('capubAdminRange') || '30d'; }catch(e){ range = '30d'; }
  let status = 'all';
  async function get(url){
    const r = await fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
    if(r.status === 401){ location.reload(); throw new Error('signed out'); }
    if(!r.ok) throw new Error(`${url}: ${r.status}`);
    return r.json();
  }
  async function post(url, body){
    const r = await fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
    if(r.status === 401){ location.reload(); throw new Error('signed out'); }
    if(!r.ok) throw new Error(`${url}: ${r.status}`);
    return r.json();
  }
  function toast(msg){
    const t = $('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toast.timer); toast.timer = setTimeout(() => t.classList.remove('show'), 2600);
  }

  // ---- tiles ----
  function tiles(s){
    const host = $('tiles');
    host.textContent = '';
    const T = s.tiles;
    const rowsFor = key => el('dl', { class: 'tileRows' },
      el('dt', { text: 'Last 7 days' }), el('dd', { text: fmt(T['7d'][key]) }),
      el('dt', { text: 'Last 30 days' }), el('dd', { text: fmt(T['30d'][key]) }),
      el('dt', { text: 'All time' }), el('dd', { text: fmt(T.all[key]) }));
    const tile = (label, value, unit, rows, cls) => el('div', { class: 'tile' + (cls ? ' ' + cls : '') },
      el('div', { class: 'tileLabel', text: label }),
      el('div', { class: 'tileMain' }, el('span', { class: 'tileValue', text: fmt(value) }), el('span', { class: 'tileUnit', text: unit })),
      rows);
    host.append(
      tile('Visits', T.today.visits, 'today', rowsFor('visits')),
      tile('Distinct visitors', T.today.visitors, 'today', rowsFor('visitors')),
      tile('Builds', T.today.builds, 'today', rowsFor('builds')),
      tile('Feedback unread', s.unread, `of ${fmt(s.feedbackTotal)}`, el('dl', { class: 'tileRows' },
        el('dt', { text: 'Received today' }), el('dd', { text: fmt(T.today.feedback) }),
        el('dt', { text: 'Last 7 days' }), el('dd', { text: fmt(T['7d'].feedback) }),
        el('dt', { text: 'Last 30 days' }), el('dd', { text: fmt(T['30d'].feedback) })), s.unread ? 'alert' : '')
    );
  }

  // ---- builds per day ----
  function niceMax(v){
    if(v <= 4) return 4;
    const p = Math.pow(10, Math.floor(Math.log10(v))), m = v / p;
    return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
  }
  function chart(s){
    const host = $('chart');
    host.textContent = '';
    const days = s.perDay;
    // Drawn at the card's own width, so the axis text stays legible on a phone; redrawn when the window resizes.
    const W = Math.max(300, Math.round(host.clientWidth || 960)), H = W < 600 ? 200 : 260, L = 40, R = 12, T = 12, B = 28;
    const every = W < 600 ? 14 : 7;
    const iw = W - L - R, ih = H - T - B;
    const max = niceMax(Math.max(1, ...days.map(d => Math.max(d.builds, d.visits))));
    const step = iw / days.length, bw = Math.max(2, step - 2);
    const y = v => T + ih - (v / max) * ih;
    const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `Builds per day for the last ${days.length} days, with visits as a line` });
    for(let i = 0; i <= 4; i++){
      const v = (max / 4) * i, yy = y(v);
      root.append(svg('line', { class: 'gridline', x1: L, x2: W - R, y1: yy, y2: yy }));
      const t = svg('text', { class: 'axis', x: L - 6, y: yy + 4, 'text-anchor': 'end' }); t.textContent = fmt(v); root.append(t);
    }
    const bars = days.map((d, i) => {
      const x = L + i * step + (step - bw) / 2, h = Math.max(0, y(0) - y(d.builds));
      // Rounded at the data end (top), square on the baseline.
      const r = Math.min(4, bw / 2, h);
      const p = h <= 0 ? '' : `M${x},${y(0)}V${y(d.builds) + r}Q${x},${y(d.builds)} ${x + r},${y(d.builds)}H${x + bw - r}Q${x + bw},${y(d.builds)} ${x + bw},${y(d.builds) + r}V${y(0)}Z`;
      const b = svg('path', { class: 'barMark', d: p });
      root.append(b);
      return b;
    });
    const pts = days.map((d, i) => `${(L + i * step + step / 2).toFixed(1)},${y(d.visits).toFixed(1)}`).join(' ');
    root.append(svg('polyline', { class: 'visitLine', points: pts }));
    days.forEach((d, i) => {
      if(i % every !== (days.length - 1) % every) return;
      const t = svg('text', { class: 'axis', x: L + i * step + step / 2, y: H - 8, 'text-anchor': 'middle' }); t.textContent = d.day.slice(5); root.append(t);
    });
    const cross = svg('line', { class: 'crosshair', y1: T, y2: T + ih, x1: -10, x2: -10, visibility: 'hidden' });
    root.append(cross);
    const tip = el('div', { class: 'tip', hidden: true });
    days.forEach((d, i) => {
      const hit = svg('rect', { class: 'hit', x: L + i * step, y: T, width: step, height: ih });
      hit.addEventListener('pointerenter', () => {
        const cx = L + i * step + step / 2;
        cross.setAttribute('x1', cx); cross.setAttribute('x2', cx); cross.setAttribute('visibility', 'visible');
        bars.forEach((b, j) => b.classList.toggle('hover', j === i));
        tip.textContent = '';
        tip.append(el('div', { class: 'tipDay', text: d.day }),
          el('div', { class: 'tipRow' }, el('span', { class: 'tipKey', style: 'background:var(--s-builds)' }), el('b', { text: fmt(d.builds) }), ' builds'),
          el('div', { class: 'tipRow' }, el('span', { class: 'tipKey', style: 'background:var(--s-visits)' }), el('b', { text: fmt(d.visits) }), ' visits'),
          el('div', { class: 'tipRow' }, el('span', { class: 'tipKey' }), el('b', { text: fmt(d.visitors) }), ' visitors'));
        const box = root.getBoundingClientRect();
        // Kept inside the card: the box is centred on the day unless that would cross an edge.
        tip.hidden = false;
        const half = tip.offsetWidth / 2;
        tip.style.left = `${Math.min(box.width - half, Math.max(half, (cx / W) * box.width))}px`;
        // Above the taller mark, but never above the top of the card (the card clips what spills over).
        const legendH = box.top - host.getBoundingClientRect().top;
        tip.style.top = `${Math.max(tip.offsetHeight + 2, legendH + (Math.min(y(d.builds), y(d.visits)) / H) * box.height - 6)}px`;
      });
      root.append(hit);
    });
    root.addEventListener('pointerleave', () => { tip.hidden = true; cross.setAttribute('visibility', 'hidden'); bars.forEach(b => b.classList.remove('hover')); });
    const legend = el('div', { class: 'legend' },
      el('span', {}, el('i', { class: 'key', style: 'background:var(--s-builds)' }), 'Builds'),
      el('span', {}, el('i', { class: 'key line', style: 'background:var(--s-visits)' }), 'Visits'));
    const table = el('details', { class: 'tableView' }, el('summary', { text: 'Show as a table' }),
      el('div', { class: 'scroll' }, el('table', {},
        el('thead', {}, el('tr', {}, el('th', { text: 'Day' }), el('th', { class: 'num', text: 'Builds' }), el('th', { class: 'num', text: 'Visits' }), el('th', { class: 'num', text: 'Visitors' }))),
        el('tbody', {}, days.slice().reverse().map(d => el('tr', {}, el('td', { text: d.day }), el('td', { class: 'num', text: fmt(d.builds) }), el('td', { class: 'num', text: fmt(d.visits) }), el('td', { class: 'num', text: fmt(d.visitors) })))))));
    host.append(legend, root, tip, table);
    lastSummary = s;
  }
  let lastSummary = null, resizeTimer = null, lastWidth = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { const w = $('chart').clientWidth; if(lastSummary && w !== lastWidth){ lastWidth = w; chart(lastSummary); } }, 150);
  });

  // ---- tables ----
  function shareTable(rows, label, nameOf){
    if(!rows || !rows.length) return el('p', { class: 'empty', text: 'Nothing yet in this range.' });
    const top = Math.max(...rows.map(r => r.share));
    return el('table', {},
      el('thead', {}, el('tr', {}, el('th', { text: label }), el('th', { class: 'num', text: 'Count' }), el('th', { class: 'num', text: 'Share' }), el('th', { class: 'shareCell' }))),
      el('tbody', {}, rows.map(r => el('tr', {},
        el('td', { text: nameOf ? nameOf(r.key) : r.key }), el('td', { class: 'num', text: fmt(r.count) }), el('td', { class: 'num', text: pct(r.share) }),
        el('td', { class: 'shareCell' }, el('div', { class: 'shareBar', style: `width:${top ? (r.share / top) * 100 : 0}%` }))))));
  }
  function countTable(pairs){
    return el('table', {}, el('tbody', {}, pairs.map(([k, v]) => el('tr', {}, el('td', { text: k }), el('td', { class: 'num', text: v })))));
  }
  const RANGE_WORDS = { today: 'today', '7d': 'in the last 7 days', '30d': 'in the last 30 days', all: 'in all' };
  function tables(s){
    const words = RANGE_WORDS[s.range];
    $('uniforms').replaceChildren(el('p', { class: 'hint', text: `${fmt(s.builds.counted)} uniforms built ${words} (${fmt(s.builds.events)} build events)` }), shareTable(s.uniforms, 'Uniform', uniformName));
    const cap = k => k === '(none)' ? 'not set' : k.charAt(0).toUpperCase() + k.slice(1);
    $('who').replaceChildren(shareTable(s.membership, 'Membership', cap), el('div', { class: 'gap' }), shareTable(s.gender, 'Cut', cap));
    $('grades').replaceChildren(shareTable(s.grades, 'Grade'));
    const f = s.features, tp = f.templates || {};
    $('features').replaceChildren(countTable([
      ['PNG downloads', fmt(f.png_download)], ['PNG downloads that failed', fmt(f.png_failed)],
      ['Member report imports', fmt(f.import_ok)], ['Member report imports that failed', fmt(f.import_failed)],
      ['Quick strip', fmt(f.quick_strip)], ['Quick strip restored', fmt(f.quick_restore)],
      ['Placement templates: paper (PDF)', fmt(tp.pdf)], ['Placement templates: paper (SVG)', fmt(tp.svg)], ['Placement templates: 3D jig (STL)', fmt(tp.stl)],
      ['Shopping list opened', fmt(f.shopping_open)], ['Uniform switches', fmt(f.uniform_switch)],
      ['Setup saved to a file', fmt(f.setup_saved)], ['Setup opened from a file', fmt(f.setup_opened)], ['Feedback sent', fmt(f.feedback_sent)]
    ]));
    const a = s.builds.avg, n = s.builds.counted;
    $('items').replaceChildren(countTable([
      ['Ribbons', avg(a.ribbons)], ['Ribbon devices drawn', avg(a.devices)], ['Miniature medals drawn', avg(a.minis)], ['Badges', avg(a.badges)],
      ['Military badges', avg(a.militaryBadges)], ['Patches', avg(a.patches)], ['Shoulder cords', avg(a.cords)],
      ['Built from a member report import', n ? pct(s.builds.fromImport / n) : '0%'], ['With a name shown', n ? pct(s.builds.nameShown / n) : '0%']
    ]));
    const v = s.visits;
    const word = k => ({ code: 'Access code', guest: 'Guest', phone: 'Phone', tablet: 'Tablet', desktop: 'Desktop', light: 'Light', dark: 'Dark', '(none)': 'not known' }[k] || k);
    $('visits').replaceChildren(el('p', { class: 'hint', text: `${fmt(v.count)} visits ${words}` }),
      shareTable(v.access, 'Entered with', word), el('div', { class: 'gap' }),
      shareTable(v.viewport, 'Screen', word), el('div', { class: 'gap' }),
      shareTable(v.theme, 'Theme', word), el('div', { class: 'gap' }),
      shareTable(v.returning, 'New or returning'));
    $('options').replaceChildren(shareTable(s.options, 'Option'));
    $('errors').replaceChildren(s.errors.length ? el('table', {},
      el('thead', {}, el('tr', {}, el('th', { text: 'Message' }), el('th', { class: 'num', text: 'Count' }), el('th', { class: 'num', text: 'Last' }))),
      el('tbody', {}, s.errors.map(e => el('tr', {}, el('td', { class: 'mono', text: e.message }), el('td', { class: 'num', text: fmt(e.count) }), el('td', { class: 'num', text: when(e.last) })))))
      : el('p', { class: 'empty', text: 'No errors reported in this range.' }));
    $('updated').textContent = `Updated ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} · times in ${s.timezone}`;
  }

  async function loadSummary(){
    try{ const s = await get(`/api/admin/summary?range=${encodeURIComponent(range)}`); tiles(s); chart(s); tables(s); }
    catch(e){ if(e.message !== 'signed out') toast('Could not load the numbers: ' + e.message); }
  }

  // ---- feedback ----
  const SETUP_WORDS = { uniform: 'Uniform', gender: 'Cut', membership: 'Membership', grade: 'Grade' };
  function setupList(setup){
    const dl = el('dl');
    for(const [k, v] of Object.entries(setup)){
      if(v && typeof v === 'object'){
        const parts = Object.entries(v).map(([a, b]) => `${a} ${b}`).join(', ');
        if(parts) dl.append(el('dt', { text: k }), el('dd', { class: 'mono', text: parts }));
      }else dl.append(el('dt', { text: SETUP_WORDS[k] || k }), el('dd', { text: k === 'uniform' ? uniformName(v) : String(v) }));
    }
    return dl;
  }
  function feedbackItem(f){
    const unread = !f.read && !f.archived;
    const actions = el('div', { class: 'fbActions' });
    const flag = (path, value, label) => {
      const b = el('button', { type: 'button', text: label });
      b.addEventListener('click', async () => {
        b.disabled = true;
        try{ await post(`/api/admin/feedback/${encodeURIComponent(f.id)}/${path}`, { value }); await Promise.all([loadFeedback(), loadSummary()]); }
        catch(e){ b.disabled = false; toast('Could not update it: ' + e.message); }
      });
      return b;
    };
    if(!f.archived) actions.append(f.read ? flag('read', false, 'Mark unread') : flag('read', true, 'Mark read'));
    actions.append(f.archived ? flag('archive', false, 'Move to inbox') : flag('archive', true, 'Archive'));
    return el('article', { class: 'fb' + (unread ? ' unread' : '') },
      el('div', { class: 'fbHead' },
        el('div', { class: 'fbMeta' }, unread ? el('span', { class: 'fbNew', text: 'NEW' }) : null, el('b', { text: when(f.ts) }),
          f.contact ? [' · contact: ', el('b', { text: f.contact })] : ' · no contact given', f.page ? ` · ${f.page}` : ''),
        actions),
      el('p', { class: 'fbMsg', text: f.message }),
      f.setup ? el('details', { class: 'fbSetup' }, el('summary', { text: `Setup: ${uniformName(f.setup.uniform || '')} ${f.setup.grade || ''}`.trim() }), setupList(f.setup)) : el('div', { class: 'fbSetup', text: 'No setup attached.' }));
  }
  async function loadFeedback(){
    try{
      const r = await get(`/api/admin/feedback?status=${status}`);
      const host = $('inbox');
      const list = r.feedback.slice().sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));
      host.replaceChildren(...(list.length ? list.map(feedbackItem) : [el('p', { class: 'empty', text: status === 'unread' ? 'No unread feedback.' : status === 'archived' ? 'Nothing archived.' : 'No feedback yet.' })]));
    }catch(e){ if(e.message !== 'signed out') toast('Could not load the feedback: ' + e.message); }
  }
  document.querySelectorAll('.seg button').forEach(b => b.addEventListener('click', () => {
    status = b.dataset.status;
    document.querySelectorAll('.seg button').forEach(x => x.setAttribute('aria-checked', x === b ? 'true' : 'false'));
    loadFeedback();
  }));

  // ---- live log ----
  function describe(e){
    const d = e.data || {};
    if(e.name === 'build'){
      const c = d.counts || {};
      return `${uniformName(d.uniform)} · ${d.membership || '?'} ${d.gender || ''} ${d.grade || ''} · ribbons ${c.ribbons || 0}, badges ${c.badges || 0}, patches ${c.patches || 0}${d.fromImport ? ' · from import' : ''}`;
    }
    if(e.name === 'uniform_switch') return `${uniformName(d.from)} → ${uniformName(d.to)}`;
    if(e.name === 'error') return `${d.message || ''}${d.file ? ` (${d.file}:${d.line || ''})` : ''}`;
    return Object.entries(d).filter(([, v]) => typeof v !== 'object').map(([k, v]) => `${k} ${k === 'uniform' ? uniformName(v) : v}`).join(' · ');
  }
  async function loadLog(){
    try{
      const r = await get('/api/admin/events?limit=200');
      const host = $('log');
      if(!r.events.length){ host.replaceChildren(el('p', { class: 'empty', text: 'No events yet.' })); return; }
      host.replaceChildren(el('table', {},
        el('thead', {}, el('tr', {}, el('th', { text: 'When' }), el('th', { text: 'Event' }), el('th', { text: 'Visitor' }), el('th', { text: 'Detail' }))),
        el('tbody', {}, r.events.map(e => el('tr', {},
          el('td', { class: 'when', text: when(e.ts) }), el('td', { class: 'ev', text: EVENT_NAMES[e.name] || e.name }),
          el('td', { class: 'who mono', text: e.vid ? e.vid.slice(0, 6) : 'DNT' }), el('td', { class: 'data', text: describe(e) }))))));
    }catch(e){ if(e.message !== 'signed out') toast('Could not load the log: ' + e.message); }
  }

  // ---- start ----
  const sel = $('range');
  sel.value = range;
  if(sel.value !== range){ range = '30d'; sel.value = range; }
  sel.addEventListener('change', () => { range = sel.value; try{ sessionStorage.setItem('capubAdminRange', range); }catch(e){ /* per tab */ } loadSummary(); });
  loadSummary(); loadFeedback(); loadLog();
  setInterval(() => { if(document.visibilityState === 'visible') loadLog(); }, 15000);
  setInterval(() => { if(document.visibilityState === 'visible'){ loadSummary(); loadFeedback(); } }, 60000);
})();
