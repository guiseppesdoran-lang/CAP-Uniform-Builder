/* =========================================================
   CAP Uniform Builder — Compat Shim (adopt, don't duplicate)
   - Never creates a second base image
   - Adopts whatever the app rendered, adds missing IDs
   - Ensures overlays exist and are sized
   - Light hooks for DevTools (Alt+D/Alt+G should work if included)
   ========================================================= */
(function () {
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const log = (...a)=>console.log('[Compat]', ...a);
  const warn = (...a)=>console.warn('[Compat]', ...a);
  const err = (...a)=>console.error('[Compat]', ...a);

  // Ensure root containers, but DON'T add an <img> yet.
  const panelShell    = $('#panelShell') || create('div', { id:'panelShell' }, $('#main') || document.body);
  const uniformCanvas = $('#uniformCanvas') || create('div', { id:'uniformCanvas', className:'canvasShell' }, panelShell);

  // Create or adopt #canvasShell
  let canvasShell = $('#canvasShell');
  if (!canvasShell) {
    canvasShell = create('div', { id:'canvasShell', className:'canvasShell' }, uniformCanvas);
    warn('Created #canvasShell');
  }

  // ADOPT base image if one exists; else create a single one.
  let jacketBase = $('#jacketBase') || $('img', canvasShell);
  if (!jacketBase) {
    jacketBase = create('img', { id:'jacketBase', alt:'Uniform jacket base' }, canvasShell);
    warn('Created #jacketBase');
  } else {
    jacketBase.id = 'jacketBase';
  }

  // If any other <img> snuck in, remove extras to avoid the double-image issue.
  $$('#canvasShell img').forEach((img, i) => {
    if (img !== jacketBase) {
      img.remove();
      warn('Removed duplicate base image');
    }
  });

  // Ensure overlay layers exist (no duplicates)
  let overlay = $('#overlayLayer');
  if (!overlay) overlay = create('div', { id:'overlayLayer', className:'overlayLayer' }, canvasShell);

  let epaulets = $('#epauletContainer');
  if (!epaulets) epaulets = create('div', { id:'epauletContainer', className:'epauletContainer' }, canvasShell);

  // Keep overlays sized to the base image display size
  function syncLayerSizes() {
    const r = jacketBase.getBoundingClientRect();
    const w = Math.round(r.width), h = Math.round(r.height);
    if (!w || !h) { requestAnimationFrame(syncLayerSizes); return; }
    Object.assign(overlay.style,  { width:w+'px', height:h+'px', position:'absolute', top:0, left:0, pointerEvents:'none', zIndex:2 });
    Object.assign(epaulets.style, { width:w+'px', height:h+'px', position:'absolute', top:0, left:0, pointerEvents:'none', zIndex:2 });
    Object.assign(canvasShell.style, { width:w+'px', height:h+'px', position:'relative' });
  }
  jacketBase.addEventListener('load', syncLayerSizes);
  window.addEventListener('resize', () => requestAnimationFrame(syncLayerSizes));
  requestAnimationFrame(syncLayerSizes);

  // Asset base helper
  function getAssetBase() {
    const i = $('#assetBase');
    return (i && i.value ? i.value : 'images').replace(/\/+$/,'');
  }
  window.ASSET = window.ASSET || function ASSET(path) {
    return getAssetBase() + '/' + String(path || '').replace(/^\/+/, '');
  };

  // Safe applyJacket that DOES NOT force a second image or re-add a src if already set by the app.
  window.applyJacket = window.applyJacket || function applyJacket() {
    const sel = $('#jacketSelect');
    const val = sel ? sel.value : 'male';
    const map = { male:'base/jacket_male.png', female:'base/jacket_female.png' };
    const logical = map[val] || map.male;
    const src = ASSET(logical);
    if (jacketBase.getAttribute('src') === src) return;
    jacketBase.onload = syncLayerSizes;
    jacketBase.onerror = ()=> err('Failed to load jacket', src);
    jacketBase.src = src;
    log('applyJacket →', val, '→', src);
    // Allow other modules to proceed
    if (typeof window.fullRender === 'function') window.fullRender();
    if (typeof window.renderRack === 'function') window.renderRack();
  };

  // Lightweight fullRender that doesn’t duplicate anything
  window.fullRender = window.fullRender || function fullRender() {
    syncLayerSizes();
    try { if (typeof window.renderRack === 'function') window.renderRack(); } catch(e){ err('renderRack error', e); }
    try { if (typeof window.renderBadges === 'function') window.renderBadges(); } catch(e){ err('renderBadges error', e); }
    try { if (typeof window.renderPatches === 'function') window.renderPatches(); } catch(e){ err('renderPatches error', e); }
    try { if (typeof window.renderRank === 'function') window.renderRank(); } catch(e){ err('renderRank error', e); }
    try { if (typeof window.renderNameplate === 'function') window.renderNameplate(); } catch(e){ err('renderNameplate error', e); }
  };

  // Wire the Apply button if present
  const applyBtn = $('#applyJacket');
  if (applyBtn && !applyBtn._wired) { applyBtn.addEventListener('click', window.applyJacket); applyBtn._wired = true; }

  // DevTools: if present, give it the targets it expects
  // (Most devtools scripts look for #canvasShell / #overlayLayer and bind Alt+D / Alt+G themselves.)
  // If your devtools require manual init, uncomment:
  // if (window.DevTools && typeof window.DevTools.init === 'function') {
  //   window.DevTools.init({ canvasShell, overlayLayer: overlay, epauletContainer: epaulets });
  // }

  // Helper: create element
  function create(tag, props={}, parent){
    const el = document.createElement(tag);
    Object.assign(el, props);
    if (parent) parent.appendChild(el);
    return el;
  }
})();
