// Anonymous usage counts (LIVE13 E69). Ethan: "an admin page ... containing a log of all uniforms built and such, any and
// all applicable metrics." The page tells the site's own API (/api/events, deploy/api) what was done, never who did it:
//
//   visit           once the access gate is passed: guest or code, phone/tablet/desktop, light or dark, new or returning
//   build           the setup is complete and the drawing has settled (2.5 s after the last redraw); then at most one every
//                   30 s while the member keeps changing it, and the last unsent setup when the page is closed. Carries
//                   the uniform, cut, membership, grade, counts of ribbons, devices, badges, military badges, patches and
//                   cords, the uniform options changed from their defaults, and whether a member report import fed it
//   png_download, import (ok or failed, item counts), quick_strip, templates (side, svg/pdf/stl), shopping_open,
//   feedback_sent, uniform_switch, setup_file (save/open), error (a script error's message and file, no stack)
//
// Never sent: a name, CAPID, nameplate or duty-title text, a unit charter, member report contents or file names, the
// address of the page or anything from another site. The visitor id is a random string kept in this browser's
// localStorage; with Do Not Track (or Global Privacy Control) on, nothing is read or kept there and only the visit and
// build counts go, without any id. CAPUB_CONFIG.metrics = false turns it all off. Sending is quiet: a failed request is
// dropped, and after three failures in a row (no API behind this copy of the site) nothing more is tried.
//
// Other scripts report through window.CAPUB_TELEMETRY.track(name, data), guarded so the page works without this file.
(function(){
  'use strict';
  const cfg = window.CAPUB_CONFIG || {};
  const ENDPOINT = '/api/events';
  const FLUSH_MS = 10000, MAX_BATCH = 50, MAX_BYTES = 15000, SETTLE_MS = 2500, BUILD_GAP_MS = 30000, MAX_ERRORS = 5, MAX_FAILS = 3;
  const KEY = 'capub_visitor_v1';
  const on = cfg.metrics !== false && /^https?:$/.test(location.protocol) && typeof JSON !== 'undefined';
  const nav = window.navigator || {};
  const dnt = nav.doNotTrack === '1' || window.doNotTrack === '1' || nav.msDoNotTrack === '1' || nav.globalPrivacyControl === true;
  const COUNTS_ONLY = new Set(['visit', 'build']);

  function rid(n){
    const a = new Uint8Array(n);
    (window.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach((_, i) => { a[i] = Math.floor(Math.random() * 256); });
    return Array.from(a, b => (b % 36).toString(36)).join('');
  }
  let vid = null, returning = null;
  if(on && !dnt){
    try{
      const kept = localStorage.getItem(KEY);
      if(kept && /^[a-z0-9]{20}$/.test(kept)){ vid = kept; returning = true; }
      else { vid = rid(20); localStorage.setItem(KEY, vid); returning = false; }
    }catch(e){ vid = null; returning = null; }
  }
  const sid = dnt ? null : rid(16);

  // ---- queue and sending ----
  const queue = [];
  let fails = 0;
  function envelope(events){
    const o = { v: 1, sent: Date.now(), events };
    if(vid) o.vid = vid;
    if(sid) o.sid = sid;
    return o;
  }
  function flush(leaving){
    if(!on || !queue.length) return;
    if(fails >= MAX_FAILS){ queue.length = 0; return; }
    while(queue.length){
      const batch = [];
      let size = 120;
      while(queue.length && batch.length < MAX_BATCH){
        const s = JSON.stringify(queue[0]).length + 1;
        if(batch.length && size + s > MAX_BYTES) break;
        size += s;
        batch.push(queue.shift());
      }
      const body = JSON.stringify(envelope(batch));
      if(body.length > MAX_BYTES + 1000) continue;   // one oversized event: dropped
      if(leaving && nav.sendBeacon){
        try{ if(nav.sendBeacon(ENDPOINT, new Blob([body], { type: 'text/plain;charset=UTF-8' }))) continue; }catch(e){ /* fall back to fetch */ }
      }
      try{
        fetch(ENDPOINT, { method: 'POST', body, keepalive: true, credentials: 'omit', headers: { 'Content-Type': 'text/plain;charset=UTF-8' } })
          .then(r => { fails = r.ok ? 0 : fails + 1; }, () => { fails++; });
      }catch(e){ fails++; }
    }
  }
  function track(name, data){
    if(!on || typeof name !== 'string') return;
    if(dnt && !COUNTS_ONLY.has(name)) return;
    queue.push({ name, at: Date.now(), data: data && typeof data === 'object' ? data : {} });
    if(queue.length >= MAX_BATCH) flush(false);
  }

  // ---- the setup, as counts and settings only ----
  // Garment options that are free text: only whether one is set goes, never the words.
  const TEXT_OPTIONS = new Set(['dutyTitle']);
  const TOKEN = /^[A-Za-z0-9_.-]{1,24}$/;
  function summary(){
    const S = window.State;
    if(!S) return null;
    const view = window.CAPUBUniformView || {};
    const scene = view.scene || null;
    const roles = {};
    if(scene && Array.isArray(scene.layers)) for(const l of scene.layers) roles[l.role] = (roles[l.role] || 0) + 1;
    const defaults = view.GARMENT_DEFAULTS || {};
    const options = {};
    for(const [k, v] of Object.entries(S.garment || {})){
      if(!/^[A-Za-z][A-Za-z0-9_]{0,31}$/.test(k) || v === defaults[k] || v === '' || v == null) continue;
      if(typeof v === 'boolean' || (typeof v === 'number' && isFinite(v))) options[k] = v;
      else if(typeof v === 'string') options[k] = TEXT_OPTIONS.has(k) || !TOKEN.test(v) ? 'set' : v;
    }
    if(S.uniform === 'blues_a' || S.uniform === 'semi_formal_usaf'){
      options.rackLayout = String(S.ribbonRackLayout || '3');
      if(S.ribbonRackArrangement) options.rackArrangement = String(S.ribbonRackArrangement);
      if(S.ribbonRowOverrideEnabled) options.rackCustomRows = true;
    }
    if(S.uniform === 'mess_dress' || S.uniform === 'semi_formal') options.miniMount = S.miniMountStyle === 'holding' ? 'holding' : 'mounting';
    if(S.cadetHighestOnly) options.cadetHighestOnly = true;
    if(S.quickStrip) options.quickStrip = true;
    const ribbons = new Set((S.ribbons || []).map(r => r && r.id).filter(Boolean));
    const military = typeof window.isMilitaryRibbonId === 'function' ? [...ribbons].filter(id => window.isMilitaryRibbonId(id)).length : 0;
    const text = S.text || {};
    return {
      uniform: String(S.uniform || ''),
      gender: String(S.gender || ''),
      membership: String(S.membership || ''),
      grade: String(S.rank || ''),
      firstSergeant: !!S.cadetFirstSergeant,
      adultCadet: !!S.adultCadet,
      counts: {
        ribbons: ribbons.size,
        militaryRibbons: military,
        devices: roles.device || 0,
        minis: roles['mini-medal'] || 0,
        badges: (S.badges || []).length,
        militaryBadges: Object.values(S.militaryBadges || {}).filter(x => x && x.selected).length,
        patches: (S.patches || []).length,
        unitPatch: S.unitPatchCharter ? 1 : 0,
        cords: S.shoulderCord ? 1 : 0
      },
      drawn: { ribbons: roles.ribbon || 0, badges: roles.badge || 0, patches: roles.patch || 0, notes: scene && Array.isArray(scene.notes) ? scene.notes.length : 0 },
      options,
      nameShown: !!(text.show !== false && (text.firstName || text.lastName)),
      fromImport: Array.isArray(S.reportAuthorizedBadgeIds)
    };
  }
  const complete = s => !!(s && s.uniform && s.gender && s.membership && s.grade);

  // ---- visit ----
  let visitSent = false;
  function viewport(){ const w = window.innerWidth || 0; return w < 600 ? 'phone' : w < 1024 ? 'tablet' : 'desktop'; }
  function theme(){
    const set = document.documentElement.getAttribute('data-theme');
    if(set === 'light' || set === 'dark') return set;
    try{ const saved = localStorage.getItem('capubTheme'); if(saved === 'light' || saved === 'dark') return saved; }catch(e){ /* no storage */ }
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  function sendVisit(){
    if(visitSent) return;
    const access = document.documentElement.getAttribute('data-access');
    if(!access) return;
    visitSent = true;
    const d = { access: access === 'guest' ? 'guest' : 'code', viewport: viewport(), theme: theme(), ux: document.documentElement.dataset.ux === '2' ? 'guided' : 'standard' };
    if(returning !== null) d.returning = returning;
    track('visit', d);
  }

  // ---- build ----
  let settle = null, lastSig = null, lastSentAt = 0, seq = 0;
  function considerBuild(force){
    settle = null;
    const s = summary();
    if(!complete(s)) return;
    const sig = JSON.stringify(s);
    if(sig === lastSig) return;
    const wait = lastSentAt + BUILD_GAP_MS - Date.now();
    if(wait > 0 && !force){ settle = setTimeout(considerBuild, wait); return; }
    lastSig = sig; lastSentAt = Date.now();
    track('build', Object.assign({ seq: ++seq }, s));
  }

  // ---- errors ----
  let errors = 0;
  function scrub(msg){
    let m = String(msg || '').slice(0, 300);
    const t = (window.State && window.State.text) || {};
    for(const w of [t.firstName, t.lastName, t.plateLine]) if(w && String(w).trim().length > 1) m = m.split(String(w).trim()).join('[name]');
    return m.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+/g, '[email]').replace(/\d{5,}/g, '#').slice(0, 200);
  }
  const fileOf = f => String(f || '').split('?')[0].split('#')[0].split('/').pop().slice(0, 60);
  function reportError(message, file, line, col){
    if(++errors > MAX_ERRORS) return;
    track('error', { message: scrub(message), file: fileOf(file), line: Number(line) || 0, col: Number(col) || 0 });
  }

  if(on){
    window.addEventListener('error', e => { if(e && e.message) reportError(e.message, e.filename, e.lineno, e.colno); });
    window.addEventListener('unhandledrejection', e => { const r = e && e.reason; reportError(r && r.message ? r.message : String(r), '', 0, 0); });
    document.addEventListener('capub:rendered', () => { clearTimeout(settle); settle = setTimeout(considerBuild, SETTLE_MS); });
    if(document.documentElement.getAttribute('data-access')) sendVisit();
    else if(window.MutationObserver){
      const mo = new MutationObserver(() => { sendVisit(); if(visitSent) mo.disconnect(); });
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-access'] });
    }
    setInterval(() => flush(false), FLUSH_MS);
    const leave = () => { if(settle){ clearTimeout(settle); considerBuild(true); } flush(true); };
    window.addEventListener('pagehide', leave);
    document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'hidden') leave(); });
  }

  window.CAPUB_TELEMETRY = Object.freeze({
    track,
    summary,
    flush: () => flush(false),
    get enabled(){ return on; },
    get countsOnly(){ return dnt; }
  });
})();
