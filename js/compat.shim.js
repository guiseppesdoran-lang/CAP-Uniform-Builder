/* =========================================================
   CAP Uniform Builder — Compatibility Bridge
   Ensures legacy/new modules find expected DOM nodes & hooks.
   Provides safe boot, layer sizing, and common globals.
   ========================================================= */
(function () {
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const log = (...a)=>console.log('[Compat]', ...a);
  const warn = (...a)=>console.warn('[Compat]', ...a);
  const err = (...a)=>console.error('[Compat]', ...a);

  // --- DOM targets (create if missing)
  function ensureEl(id, tag, parent, className){
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement(tag);
      el.id = id;
      if (className) el.className = className;
      (parent || document.body).appendChild(el);
      warn('Created missing #'+id);
    }
    return el;
  }

  const uniformCanvas = ensureEl('uniformCanvas','div', $('#panelShell'),'canvasShell');
  const canvasShell    = ensureEl('canvasShell','div', uniformCanvas,'canvasShell');
  const jacketBase     = ensureEl('jacketBase','img', canvasShell);
  const epaulets       = ensureEl('epauletContainer','div', canvasShell,'epauletContainer');
  const overlay        = ensureEl('overlayLayer','div', canvasShell,'overlayLayer');
  const controls       = ensureEl('controls','aside', $('#layoutShell'),'sidebar');
  const assets         = ensureEl('assets','div', $('#panelShell'),'assetPreload');
  const tooltip        = ensureEl('tooltip','div', document.body,'tooltip');

  // --- Sizing overlays to base once image lays out
  function syncLayerSizes() {
    const rect = jacketBase.getBoundingClientRect();
    const w = Math.round(rect.width), h = Math.round(rect.height);
    if (!w || !h) { requestAnimationFrame(syncLayerSizes); return; }
    Object.assign(overlay.style,  { width: w+'px', height: h+'px', position: 'absolute', top: 0, left: 0, pointerEvents:'none' });
    Object.assign(epaulets.style, { width: w+'px', height: h+'px', position: 'absolute', top: 0, left: 0, pointerEvents:'none' });
    Object.assign(canvasShell.style, { width: w+'px', height: h+'px', position: 'relative' });
    log('Layer sizes synced', w+'×'+h);
  }
  jacketBase.addEventListener('load', syncLayerSizes);

  // --- Asset helper (mirrors common ASSET() behavior)
  function getAssetBase(){
    const i = $('#assetBase');
    return (i && i.value ? i.value : 'images').replace(/\/+$/,'');
  }
  function ASSET(path){
    path = String(path || '').replace(/^\/+/, '');
    return getAssetBase() + '/' + path;
  }
  window.ASSET = window.ASSET || ASSET; // expose if not provided

  // --- Minimal renderer hooks (used by multiple modules)
  function ensureBaseIfEmpty(){
    if (!jacketBase.getAttribute('src')) {
      // Fallback to a safe default Class A base
      const src = ASSET('base/jacket_male.png');
      jacketBase.src = src;
      log('Set default jacket base →', src);
    }
  }

  // Legacy/global hooks many modules call. Provide safe wrappers.
  window.applyJacket = window.applyJacket || function applyJacket() {
    ensureBaseIfEmpty();
    const sel = $('#jacketSelect');
    const val = sel ? sel.value : 'male';
    const map = { male: 'base/jacket_male.png', female: 'base/jacket_female.png' };
    const next = map[val] || map.male;
    const src = ASSET(next);
    if (jacketBase.src.endsWith(next)) return;
    jacketBase.onload = syncLayerSizes;
    jacketBase.onerror = () => err('Failed to load jacket', src);
    jacketBase.src = src;
    log('applyJacket →', val, '→', src);
    // Kick a re-render if renderer exposes one:
    if (typeof window.fullRender === 'function') window.fullRender();
    if (typeof window.renderRack === 'function') window.renderRack();
  };

  window.fullRender = window.fullRender || function fullRender() {
    ensureBaseIfEmpty();
    syncLayerSizes();
    // If modules attach their own render routines, call them defensively
    try { if (typeof window.renderRack === 'function') window.renderRack(); } catch(e){ err('renderRack error', e); }
    try { if (typeof window.renderBadges === 'function') window.renderBadges(); } catch(e){ err('renderBadges error', e); }
    try { if (typeof window.renderPatches === 'function') window.renderPatches(); } catch(e){ err('renderPatches error', e); }
    try { if (typeof window.renderRank === 'function') window.renderRank(); } catch(e){ err('renderRank error', e); }
    try { if (typeof window.renderNameplate === 'function') window.renderNameplate(); } catch(e){ err('renderNameplate error', e); }
  };

  // Often referenced by dev tools / UI buttons
  window.renderRack = window.renderRack || function renderRack() {
    // If a module already defines UI->DOM for ribbons, let it run;
    // this shim just ensures layers are present and sized.
    syncLayerSizes();
  };

  // --- Uniforms list (populate from UNIFORMS if present)
  function hydrateUniformList(){
    const host = $('#uniformList');
    if (!host) return;
    host.innerHTML = '';
    const src = (window.UNIFORMS && typeof UNIFORMS === 'object') ? UNIFORMS : null;
    if (!src) { host.textContent = 'Uniform list unavailable'; return; }
    const keys = Object.keys(src);
    keys.forEach(key=>{
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = key.replace(/_/g,' ').replace(/\b\w/g, c=>c.toUpperCase());
      btn.addEventListener('click', ()=>{
        // Try to resolve base from mapping, else fall back to jacket_male/female
        const u = src[key];
        let p = (u && (u.base || u.image || u.src)) || (key.includes('female') ? 'base/jacket_female.png' : 'base/jacket_male.png');
        const srcPath = ASSET(p);
        jacketBase.onload = ()=>{ syncLayerSizes(); if (typeof window.fullRender==='function') window.fullRender(); };
        jacketBase.onerror = ()=> err('Uniform image missing:', srcPath);
        jacketBase.src = srcPath;
        log('Uniform applied →', key, '→', srcPath);
      });
      host.appendChild(btn);
    });
  }

  // --- Controls wiring
  function wireControls(){
    const apply = $('#applyJacket');
    if (apply && !apply._wired) { apply.addEventListener('click', window.applyJacket); apply._wired = true; }
  }

  // --- DevTools friendliness
  // Ensure these IDs exist so the grid/overlay toggles can attach.
  function nudgeDevTools(){
    if (!$('#canvasShell') || !$('#overlayLayer')) return;
    // No-op: DevTools ui.js will find them now.
  }

  // --- Boot
  function boot() {
    ensureBaseIfEmpty();
    syncLayerSizes();
    wireControls();
    hydrateUniformList();
    nudgeDevTools();
    // Auto-apply current selection to ensure a base shows
    try { window.applyJacket(); } catch(e){ /* ignore */ }
    // Expose some helpful globals
    window.$ = window.$ || $;
    window.$$ = window.$$ || $$;
    log('Compatibility bridge ready.');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
