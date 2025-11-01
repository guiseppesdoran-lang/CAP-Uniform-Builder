/* =========================================================
   CAP Uniform Builder — Compat Shim (single render, dev menu)
   - Adopts single base image, prevents duplicates
   - Ensures overlays exist and are sized
   - Provides minimal Dev Menu if originals fail (Alt+D / Alt+G)
   - Keeps ASSET() simple; assets.ui.js handles “every image renderable”
   ========================================================= */
(function () {
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const log = (...a)=>console.log('[Compat]', ...a);
  const warn = (...a)=>console.warn('[Compat]', ...a);
  const err = (...a)=>console.error('[Compat]', ...a);

  // Ensure roots
  const panelShell    = $('#panelShell') || create('div', { id:'panelShell' }, $('#main') || document.body);
  const uniformCanvas = $('#uniformCanvas') || create('div', { id:'uniformCanvas', className:'canvasShell' }, panelShell);

  // Canvas shell
  let canvasShell = $('#canvasShell');
  if (!canvasShell) canvasShell = create('div', { id:'canvasShell', className:'canvasShell' }, uniformCanvas);

  // Adopt/create single base image
  let jacketBase = $('#jacketBase') || $('img', canvasShell);
  if (!jacketBase) {
    jacketBase = create('img', { id:'jacketBase', alt:'Uniform jacket base' }, canvasShell);
    warn('Created #jacketBase');
  } else { jacketBase.id = 'jacketBase'; }
  // Remove extras
  $$('#canvasShell img').forEach(img => { if (img !== jacketBase) { img.remove(); warn('Removed duplicate base image'); } });

  // Overlays
  let overlay = $('#overlayLayer'); if (!overlay) overlay = create('div', { id:'overlayLayer', className:'overlayLayer' }, canvasShell);
  let epaulets = $('#epauletContainer'); if (!epaulets) epaulets = create('div', { id:'epauletContainer', className:'epauletContainer' }, canvasShell);

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

  function getAssetBase() {
    const i = $('#assetBase');
    return (i && i.value ? i.value : 'images').replace(/\/+$/,'');
  }
  window.ASSET = window.ASSET || function ASSET(path) {
    return getAssetBase() + '/' + String(path || '').replace(/^\/+/, '');
  };

  // Safe jacket apply (no duplicates)
  window.applyJacket = window.applyJacket || function applyJacket() {
    const sel = $('#jacketSelect');
    const val = sel ? sel.value : 'male';
    const map = { male:'base/jacket_male.png', female:'base/jacket_female.png' };
    const src = ASSET(map[val] || map.male);
    if (jacketBase.getAttribute('src') === src) return;
    jacketBase.onload = syncLayerSizes;
    jacketBase.onerror = ()=> err('Failed to load jacket', src);
    jacketBase.src = src;
    if (typeof window.fullRender === 'function') window.fullRender();
    if (typeof window.renderRack === 'function') window.renderRack();
  };

  window.fullRender = window.fullRender || function fullRender() {
    syncLayerSizes();
    try { if (typeof window.renderRack === 'function') window.renderRack(); } catch(e){ err('renderRack error', e); }
    try { if (typeof window.renderBadges === 'function') window.renderBadges(); } catch(e){ err('renderBadges error', e); }
    try { if (typeof window.renderPatches === 'function') window.renderPatches(); } catch(e){ err('renderPatches error', e); }
    try { if (typeof window.renderRank === 'function') window.renderRank(); } catch(e){ err('renderRank error', e); }
    try { if (typeof window.renderNameplate === 'function') window.renderNameplate(); } catch(e){ err('renderNameplate error', e); }
  };

  const applyBtn = $('#applyJacket');
  if (applyBtn && !applyBtn._wired) { applyBtn.addEventListener('click', window.applyJacket); applyBtn._wired = true; }

  // Minimal Dev Menu if originals fail
  (function ensureDevMenu(){
    const HAS_BUILTIN = (window.DevTools && typeof window.DevTools.init === 'function') ||
                        (window.devtools && typeof window.devtools.init === 'function');
    if (HAS_BUILTIN) return;

    // Inject tiny dev panel
    const dev = create('div', { id:'__devmenu__' }, document.body);
    dev.style.cssText = "position:fixed;right:16px;bottom:16px;background:#0b1220;color:#e6edf6;border:1px solid #2a3550;border-radius:10px;padding:8px 10px;z-index:99999;display:none;font:12px system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial";
    dev.innerHTML = `
      <div style="display:flex;gap:8px;align-items:center;">
        <strong style="font-size:12px;letter-spacing:.3px">Dev Menu</strong>
        <span style="margin-left:auto;opacity:.7">Alt+D</span>
      </div>
      <div style="margin-top:6px;display:flex;gap:8px;">
        <button id="__gridbtn__" type="button" style="background:#1a2446;border:1px solid #2e3d6c;color:#e6edf6;padding:4px 8px;border-radius:6px;cursor:pointer">Toggle Grid (Alt+G)</button>
      </div>`;
    let gridOn = false;
    const gridBtn = $('#__gridbtn__', dev);
    function toggleGrid(){
      gridOn = !gridOn;
      const g = document.getElementById('__grid__') || create('div', { id:'__grid__' }, canvasShell);
      Object.assign(g.style, {
        position:'absolute', inset:'0', backgroundSize:'20px 20px',
        backgroundImage: gridOn ? 'linear-gradient(#00000022 1px, transparent 1px), linear-gradient(90deg, #00000022 1px, transparent 1px)' : 'none',
        pointerEvents:'none', zIndex:3
      });
    }
    gridBtn.addEventListener('click', toggleGrid);
    function toggleDev(){ dev.style.display = (dev.style.display==='none'||dev.style.display==='') ? 'block' : 'none'; }

    document.addEventListener('keydown', (e)=>{
      if (e.altKey && (e.key==='d' || e.key==='D')) { e.preventDefault(); toggleDev(); }
      if (e.altKey && (e.key==='g' || e.key==='G')) { e.preventDefault(); toggleGrid(); }
    });
  })();

  function create(tag, props={}, parent){
    const el = document.createElement(tag);
    Object.assign(el, props);
    if (parent) parent.appendChild(el);
    return el;
  }
})();
