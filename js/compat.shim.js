/* =========================================================
   CAP Uniform Builder — Compatibility & Asset Resolver Bridge
   Makes images render even when paths/filenames differ.
   - Auto retries path variants + folders + extension swaps
   - Global <img> error interception & cached resolutions
   - Assets Report overlay (Alt+A) + user file upload fallback
   - Preserves earlier compat features (IDs, hooks, sizing)
   ========================================================= */
(function () {
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const log = (...a)=>console.log('[Compat]', ...a);
  const warn = (...a)=>console.warn('[Compat]', ...a);
  const err = (...a)=>console.error('[Compat]', ...a);

  /* ---------- DOM guarantees ---------- */
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
  const panelShell     = $('#panelShell') || ensureEl('panelShell', 'div', $('#main') || document.body);
  const uniformCanvas  = $('#uniformCanvas') || ensureEl('uniformCanvas','div', panelShell,'canvasShell');
  const canvasShell    = $('#canvasShell') || ensureEl('canvasShell','div', uniformCanvas,'canvasShell');
  const jacketBase     = $('#jacketBase') || ensureEl('jacketBase','img', canvasShell);
  const epaulets       = $('#epauletContainer') || ensureEl('epauletContainer','div', canvasShell,'epauletContainer');
  const overlay        = $('#overlayLayer') || ensureEl('overlayLayer','div', canvasShell,'overlayLayer');
  const controls       = $('#controls') || ensureEl('controls','aside', $('#layoutShell'),'sidebar');
  const assetsDiv      = $('#assets') || ensureEl('assets','div', panelShell,'assetPreload');
  const tooltip        = $('#tooltip') || ensureEl('tooltip','div', document.body,'tooltip');

  /* ---------- Size overlays to base once image lays out ---------- */
  function syncLayerSizes() {
    const rect = jacketBase.getBoundingClientRect();
    const w = Math.round(rect.width), h = Math.round(rect.height);
    if (!w || !h) { requestAnimationFrame(syncLayerSizes); return; }
    Object.assign(overlay.style,  { width: w+'px', height: h+'px', position: 'absolute', top: 0, left: 0, pointerEvents:'none', zIndex: 2 });
    Object.assign(epaulets.style, { width: w+'px', height: h+'px', position: 'absolute', top: 0, left: 0, pointerEvents:'none', zIndex: 2 });
    Object.assign(canvasShell.style, { width: w+'px', height: h+'px', position: 'relative' });
    jacketBase.style.position = 'relative'; jacketBase.style.zIndex = 1;
    log('Layer sizes synced', w+'×'+h);
  }
  jacketBase.addEventListener('load', syncLayerSizes);

  /* ---------- Asset Resolver ---------- */
  const Assets = {
    cache: new Map(),     // logical -> resolved URL
    misses: new Map(),    // logical -> array of tried candidates
    uploaded: new Map(),  // basename -> blob url (user overrides)

    getBase() {
      const i = $('#assetBase');
      return (i && i.value ? i.value : 'images').replace(/\/+$/,'');
    },

    // Build a list of candidate URLs to try for a requested path.
    candidates(logical) {
      const base = this.getBase();
      const p = String(logical || '').replace(/^\/+/, '');
      const parts = p.split('/');
      const file = parts.pop() || '';
      const name = file.replace(/\.[^.]+$/, '');
      const ext  = (file.split('.').pop() || '').toLowerCase();

      const folders = [
        '',                // as-is under base
        'ribbons',
        'badges',
        'devices',
        'patches',
        'base'
      ];

      const exts = ext ? [ext] : ['png','jpg','jpeg','webp'];
      const nameVariants = Array.from(new Set([
        name,
        name.toLowerCase(),
        name.toUpperCase(),
        name.replace(/_/g,'-'),
        name.replace(/-/g,'_'),
        name.replace(/\s+/g,'_'),
        name.replace(/\s+/g,'-')
      ]));

      // If user uploaded a file with this basename, prefer that
      const uploadedUrl = this.uploaded.get(file) || this.uploaded.get(name) || null;
      const list = [];
      if (uploadedUrl) list.push(uploadedUrl);

      // original request first
      list.push(`${base}/${p}`);

      // try folder variants + ext/name permutations
      for (const folder of folders) {
        for (const nv of nameVariants) {
          for (const e of exts) {
            const candidate = `${base}/${folder ? folder+'/' : ''}${nv}.${e}`;
            if (!list.includes(candidate)) list.push(candidate);
          }
        }
      }
      // Also try purely lowercased full request
      list.push(`${base}/${p.toLowerCase()}`);
      return list;
    },

    // Resolve to first loadable URL; cache success.
    async resolve(logical) {
      if (this.cache.has(logical)) return this.cache.get(logical);
      const tried = [];
      for (const url of this.candidates(logical)) {
        try {
          await this.probe(url);
          this.cache.set(logical, url);
          return url;
        } catch {
          tried.push(url);
        }
      }
      this.misses.set(logical, tried);
      throw new Error('No candidate succeeded for '+logical);
    },

    // Attempt to load an image quickly (no DOM attach)
    probe(url) {
      return new Promise((res, rej)=>{
        const img = new Image();
        img.onload = ()=>res(url);
        img.onerror = ()=>rej(new Error('img error'));
        img.src = url;
      });
    },

    // UI: Report overlay
    showReport() {
      let panel = $('#assetsReportPanel');
      if (!panel) {
        panel = document.createElement('div');
        panel.id = 'assetsReportPanel';
        panel.style.cssText = `
          position: fixed; right: 18px; top: 18px; width: 420px; max-height: 70vh;
          background: #0b1220; color: #e6edf6; border: 1px solid #2a3550; border-radius: 10px;
          box-shadow: 0 10px 30px rgba(0,0,0,.35); z-index: 99999; display: none; overflow: hidden; font: 13px/1.4 system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;`;
        panel.innerHTML = `
          <div style="display:flex;gap:8px;align-items:center;padding:8px 10px;background:#0e1a35;border-bottom:1px solid #223055">
            <strong style="font-size:12px;letter-spacing:.3px">Assets Report</strong>
            <span style="margin-left:auto;opacity:.7">Alt+A</span>
            <button id="assetsReportClose" style="background:#1a2446;border:1px solid #2e3d6c;color:#e6edf6;padding:2px 8px;border-radius:6px;cursor:pointer">✕</button>
          </div>
          <div style="padding:10px;display:grid;gap:10px;">
            <div>
              <div style="opacity:.9;margin-bottom:6px">Upload missing images (drag or select):</div>
              <input id="assetsUpload" type="file" multiple accept="image/*" style="width:100%;background:#0e1a35;border:1px solid #2a3550;border-radius:8px;padding:8px;color:#e6edf6"/>
            </div>
            <details open>
              <summary style="cursor:pointer">Resolved (cached)</summary>
              <div id="assetsResolved" style="margin-top:6px;max-height:180px;overflow:auto;border:1px solid #2a3550;border-radius:6px;padding:6px"></div>
            </details>
            <details open>
              <summary style="cursor:pointer">Missing (tried candidates)</summary>
              <div id="assetsMissing" style="margin-top:6px;max-height:180px;overflow:auto;border:1px solid #2a3550;border-radius:6px;padding:6px"></div>
            </details>
          </div>`;
        document.body.appendChild(panel);
        $('#assetsReportClose', panel).addEventListener('click', ()=>toggleReport(false));
        const up = $('#assetsUpload', panel);
        up.addEventListener('change', (e)=>{
          for (const file of e.target.files) {
            const url = URL.createObjectURL(file);
            const base = file.name;
            this.uploaded.set(base, url);
            this.uploaded.set(base.replace(/\.[^.]+$/,''), url);
            log('Uploaded override:', base);
          }
          renderLists();
        });
      }
      function renderLists(){
        const res = $('#assetsResolved');
        const mis = $('#assetsMissing');
        const cacheItems = Array.from(Assets.cache.entries()).map(([k,v])=>`<div style="display:flex;justify-content:space-between;gap:6px"><span>${escapeHtml(k)}</span><code style="opacity:.8">${escapeHtml(v)}</code></div>`).join('') || '<em style="opacity:.7">None</em>';
        const missItems = Array.from(Assets.misses.entries()).map(([k,list])=>{
          const tried = list.map(u=>`<div style="opacity:.8"><code>${escapeHtml(u)}</code></div>`).join('');
          return `<div style="margin-bottom:8px"><strong>${escapeHtml(k)}</strong>${tried?'<div style="margin-top:4px">'+tried+'</div>':''}</div>`;
        }).join('') || '<em style="opacity:.7">None</em>';
        res.innerHTML = cacheItems;
        mis.innerHTML = missItems;
      }
      function toggleReport(force){
        panel.style.display = (typeof force==='boolean' ? force : (panel.style.display==='none'||panel.style.display==='')) ? 'block' : 'none';
        if (panel.style.display === 'block') renderLists();
      }
      window.toggleAssetsReport = toggleReport;
      toggleReport(true);
    }
  };
  window.Assets = Assets;

  function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }

  /* ---------- Global <img> error interception with retries ---------- */
  const PLACEHOLDER = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="220" height="60">
      <defs><pattern id="g" width="10" height="10" patternUnits="userSpaceOnUse">
        <rect width="10" height="10" fill="#f1f5f9"/><path d="M0 0L10 10M10 0L0 10" stroke="#cbd5e1" stroke-width="1"/>
      </pattern></defs>
      <rect width="100%" height="100%" fill="url(#g)"/>
      <text x="10" y="38" font-family="system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial" font-size="14" fill="#334155">Missing image</text>
    </svg>`);

  const triedMap = new WeakMap(); // img -> { logical, candidates, i }
  function nextCandidate(img){
    const info = triedMap.get(img);
    if (!info) return null;
    const { candidates, i } = info;
    const j = i + 1;
    if (j < candidates.length) { info.i = j; return candidates[j]; }
    return null;
  }

  function beginResolve(img, logicalPath){
    const cands = Assets.candidates(logicalPath);
    triedMap.set(img, { logical: logicalPath, candidates: cands, i: -1 });
    const first = nextCandidate(img);
    if (first) img.src = first;
  }

  // Intercept errors and walk through candidates; cache on success
  document.addEventListener('error', function(e){
    const t = e.target;
    if (!(t instanceof HTMLImageElement)) return;

    // If original request came from ASSET(), keep logical; else derive logical from current src
    let logical = t.getAttribute('data-logical') || t.getAttribute('data-src-logical');

    if (!logical) {
      // Try to reconstruct a logical hint from a src like "images/.."
      const m = /(?:^|\/)(images\/.+)$/i.exec(t.getAttribute('src') || '');
      logical = m ? m[1].replace(/^images\//, '') : (t.getAttribute('src') || 'unknown.png');
    }

    const next = nextCandidate(t);
    if (next) {
      t.src = next;
      return;
    }

    // Exhausted: record a miss & show placeholder
    if (!Assets.misses.has(logical)) {
      const tried = (triedMap.get(t)?.candidates) || [];
      Assets.misses.set(logical, tried);
    }
    if (t.src !== PLACEHOLDER) t.src = PLACEHOLDER;
  }, true);

  // When an <img> eventually loads, cache the working mapping for future
  document.addEventListener('load', function(e){
    const t = e.target;
    if (!(t instanceof HTMLImageElement)) return;
    const info = triedMap.get(t);
    if (info && info.logical) {
      Assets.cache.set(info.logical, t.src);
    }
  }, true);

  /* ---------- ASSET helper & jacket boot ---------- */
  function getAssetBase(){
    const i = $('#assetBase');
    return (i && i.value ? i.value : 'images').replace(/\/+$/,'');
  }
  function ASSET(path){
    const logical = String(path || '').replace(/^\/+/, '');
    // If we previously resolved this logical, return cached URL
    if (Assets.cache.has(logical)) return Assets.cache.get(logical);
    // Otherwise, return best guess (base + logical) and let error handler walk candidates if needed
    return getAssetBase() + '/' + logical;
  }
  window.ASSET = window.ASSET || ASSET;

  function ensureBaseIfEmpty(){
    if (!jacketBase.getAttribute('src')) {
      const logical = 'base/jacket_male.png';
      jacketBase.setAttribute('data-logical', logical);
      jacketBase.src = ASSET(logical);
      log('Set default jacket base →', jacketBase.src);
    }
  }

  window.applyJacket = window.applyJacket || function applyJacket() {
    ensureBaseIfEmpty();
    const sel = $('#jacketSelect');
    const val = sel ? sel.value : 'male';
    const map = { male: 'base/jacket_male.png', female: 'base/jacket_female.png' };
    const logical = map[val] || map.male;
    jacketBase.onload = syncLayerSizes;
    jacketBase.onerror = ()=> err('Failed to load jacket', jacketBase.src);
    jacketBase.setAttribute('data-logical', logical);
    jacketBase.src = ASSET(logical);
    log('applyJacket →', val, '→', jacketBase.src);
    if (typeof window.fullRender === 'function') window.fullRender();
    if (typeof window.renderRack === 'function') window.renderRack();
  };

  window.fullRender = window.fullRender || function fullRender() {
    ensureBaseIfEmpty();
    syncLayerSizes();
    try { if (typeof window.renderRack === 'function') window.renderRack(); } catch(e){ err('renderRack error', e); }
    try { if (typeof window.renderBadges === 'function') window.renderBadges(); } catch(e){ err('renderBadges error', e); }
    try { if (typeof window.renderPatches === 'function') window.renderPatches(); } catch(e){ err('renderPatches error', e); }
    try { if (typeof window.renderRank === 'function') window.renderRank(); } catch(e){ err('renderRank error', e); }
    try { if (typeof window.renderNameplate === 'function') window.renderNameplate(); } catch(e){ err('renderNameplate error', e); }
  };

  window.renderRack = window.renderRack || function renderRack() { syncLayerSizes(); };

  /* ---------- Uniforms list hydration ---------- */
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
        const u = src[key];
        let logical = (u && (u.base || u.image || u.src)) || (key.includes('female') ? 'base/jacket_female.png' : 'base/jacket_male.png');
        jacketBase.onload = ()=>{ syncLayerSizes(); if (typeof window.fullRender==='function') window.fullRender(); };
        jacketBase.onerror = ()=> err('Uniform image missing:', jacketBase.src);
        jacketBase.setAttribute('data-logical', logical);
        jacketBase.src = ASSET(logical);
        log('Uniform applied →', key, '→', jacketBase.src);
      });
      host.appendChild(btn);
    });
  }

  /* ---------- Controls wiring ---------- */
  function wireControls(){
    const apply = $('#applyJacket');
    if (apply && !apply._wired) { apply.addEventListener('click', window.applyJacket); apply._wired = true; }
  }

  /* ---------- Assets Report (Alt+A) ---------- */
  function toggleAssetsReport(force){
    const p = $('#assetsReportPanel');
    if (!p) return Assets.showReport();
    p.style.display = (typeof force==='boolean' ? force : (p.style.display==='none'||p.style.display==='')) ? 'block' : 'none';
  }
  function handleKey(e){
    if (e.altKey && (e.key==='a' || e.key==='A')) { e.preventDefault(); toggleAssetsReport(); }
  }
  document.addEventListener('keydown', handleKey);

  /* ---------- Boot ---------- */
  function boot() {
    ensureBaseIfEmpty();
    syncLayerSizes();
    wireControls();
    hydrateUniformList();
    // Expose helpers
    window.$ = window.$ || $;
    window.$$ = window.$$ || $$;
    log('Compatibility + Asset Resolver ready. Press Alt+A for Assets Report.');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

})();
