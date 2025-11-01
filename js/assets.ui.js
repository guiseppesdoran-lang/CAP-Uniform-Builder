/* =========================================================
   CAP Uniform Builder — Assets UI
   - Folder upload (webkitdirectory) to make EVERY image renderable
   - Maps each file to blob: URL under multiple lookup keys:
     * full relative path (minus leading folder)
     * basename (without folders)
     * lowercase variants and -/_/space permutations
   - Exposes Assets.resolve(logical) used by data/renderer if available
   - Provides Assets Report (Alt+A) + Render Gallery
   ========================================================= */
(function(){
  const $ = (s, r=document)=>r.querySelector(s);
  const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));
  const log = (...a)=>console.log('[AssetsUI]', ...a);
  const warn = (...a)=>console.warn('[AssetsUI]', ...a);

  // Central map of logical->blobURL (plus aliases)
  const aliases = new Map();   // key -> blobURL
  const fileset = [];          // [{name, type, size, url, key}]

  // Public API for other modules
  const Assets = window.Assets || (window.Assets = {});
  Assets.resolve = async function(logical){
    // If compat shim provided ASSET, prefer that as first guess
    const key = String(logical||'').replace(/^\/+/, '');
    // Exact
    if (aliases.has(key)) return aliases.get(key);
    // Lowercase and simple variants
    const lc = key.toLowerCase();
    if (aliases.has(lc)) return aliases.get(lc);
    const v = variantKeys(key);
    for (const k of v) if (aliases.has(k)) return aliases.get(k);
    // Fallback to original ASSET (file server)
    if (typeof window.ASSET === 'function') return window.ASSET(key);
    return key;
  };

  // Wire folder input
  const input = $('#assetsFolderInput');
  if (input) {
    input.addEventListener('change', async (e)=>{
      const fileList = Array.from(e.target.files || []);
      if (!fileList.length) return;
      // Clear current maps
      aliases.clear(); fileset.length = 0;

      // Build maps
      for (const f of fileList) {
        if (!f.type.startsWith('image/')) continue;
        const url = URL.createObjectURL(f);
        const rel = (f.webkitRelativePath || f.name).replace(/^[^/]+\/images\//,'').replace(/^images\//,'');
        const base = f.name;
        const nameNoExt = base.replace(/\.[^.]+$/,'');
        const ext = (base.split('.').pop()||'').toLowerCase();

        const keys = new Set([
          rel,
          rel.toLowerCase(),
          base,
          base.toLowerCase(),
          nameNoExt,
          nameNoExt.toLowerCase(),
          ...variantKeys(rel),
          ...variantKeys(base),
          ...variantKeys(nameNoExt),
        ]);
        for (const k of keys) aliases.set(k, url);

        fileset.push({ name: base, type: f.type, size: f.size, url, key: rel });
      }
      log('Mapped images:', fileset.length);
      alert(`Loaded ${fileset.length} images from folder. Now every image can resolve via blob URLs.`);
    });
  }

  function variantKeys(s){
    const name = String(s||'');
    const noLeading = name.replace(/^\/+/,'');
    const arr = [];
    const stems = [
      noLeading,
      noLeading.replace(/_/g,'-'),
      noLeading.replace(/-/g,'_'),
      noLeading.replace(/\s+/g,'_'),
      noLeading.replace(/\s+/g,'-'),
    ];
    stems.forEach(st=>{
      arr.push(st, st.toLowerCase());
      // try removing common subfolders
      arr.push(st.replace(/^ribbons\//,''));
      arr.push(st.replace(/^badges\//,''));
      arr.push(st.replace(/^devices\//,''));
      arr.push(st.replace(/^patches\//,''));
      arr.push(st.replace(/^base\//,''));
    });
    return Array.from(new Set(arr));
  }

  // Assets Report (button + Alt+A)
  const btnReport = $('#showAssetsReport');
  function ensureReport(){
    let panel = $('#assetsReportPanel');
    if (panel) return panel;
    panel = document.createElement('div');
    panel.id = 'assetsReportPanel';
    panel.style.cssText = `
      position: fixed; right: 18px; top: 18px; width: 440px; max-height: 70vh;
      background: #0b1220; color: #e6edf6; border: 1px solid #2a3550; border-radius: 10px;
      box-shadow: 0 10px 30px rgba(0,0,0,.35); z-index: 99999; display: none; overflow: hidden; font: 13px/1.4 system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;`;
    panel.innerHTML = `
      <div style="display:flex;gap:8px;align-items:center;padding:8px 10px;background:#0e1a35;border-bottom:1px solid #223055">
        <strong style="font-size:12px;letter-spacing:.3px">Assets Report</strong>
        <span style="margin-left:auto;opacity:.7">Alt+A</span>
        <button id="assetsReportClose" style="background:#1a2446;border:1px solid #2e3d6c;color:#e6edf6;padding:2px 8px;border-radius:6px;cursor:pointer">✕</button>
      </div>
      <div id="assetsReportBody" style="padding:10px;display:grid;gap:10px;max-height:calc(70vh - 44px);overflow:auto;"></div>`;
    document.body.appendChild(panel);
    $('#assetsReportClose', panel).addEventListener('click', ()=>toggleReport(false));
    return panel;
  }
  function toggleReport(force){
    const p = ensureReport();
    p.style.display = (typeof force==='boolean' ? force : (p.style.display==='none'||p.style.display==='')) ? 'block' : 'none';
    if (p.style.display === 'block') renderReport();
  }
  function renderReport(){
    const body = $('#assetsReportBody');
    body.innerHTML = '';
    if (!fileset.length) { body.innerHTML = '<em style="opacity:.7">No images loaded yet. Use the “Assets” folder input.</em>'; return; }
    fileset.slice(0,500).forEach(f=>{
      const row = document.createElement('div');
      row.style.cssText = 'display:flex; gap:8px; align-items:center;';
      const img = document.createElement('img');
      img.src = f.url; img.alt = f.name; img.style.cssText = 'width:44px;height:30px;object-fit:cover;border:1px solid #2a3550;border-radius:4px';
      const txt = document.createElement('div');
      txt.innerHTML = `<div style="font-weight:600">${escapeHtml(f.name)}</div><div style="opacity:.8">${escapeHtml(f.key)}</div>`;
      row.appendChild(img); row.appendChild(txt);
      body.appendChild(row);
    });
    if (fileset.length > 500) {
      const more = document.createElement('div');
      more.style.cssText = 'opacity:.7;margin-top:6px';
      more.textContent = `Showing first 500 of ${fileset.length} files.`;
      body.appendChild(more);
    }
  }
  if (btnReport) btnReport.addEventListener('click', ()=>toggleReport());
  document.addEventListener('keydown', (e)=>{ if (e.altKey && (e.key==='a'||e.key==='A')) { e.preventDefault(); toggleReport(); }});

  // Render Gallery (quick proof “every image renders”)
  const btnGallery = $('#renderAllGallery');
  if (btnGallery) btnGallery.addEventListener('click', ()=>{
    if (!fileset.length) { alert('Load your /images folder first.'); return; }
    showGallery(fileset);
  });

  function showGallery(items){
    let modal = $('#assetsGallery');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'assetsGallery';
      modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:99998;display:flex;align-items:center;justify-content:center';
      modal.innerHTML = `
        <div style="background:#0b1220;color:#e6edf6;border:1px solid #2a3550;border-radius:12px;max-width:90vw;max-height:85vh;overflow:auto;padding:14px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
            <strong>All Images</strong>
            <button id="assetsGalleryClose" style="margin-left:auto;background:#1a2446;border:1px solid #2e3d6c;color:#e6edf6;padding:4px 8px;border-radius:6px;cursor:pointer">Close</button>
          </div>
          <div id="assetsGalleryGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px"></div>
        </div>`;
      document.body.appendChild(modal);
      $('#assetsGalleryClose', modal).addEventListener('click', ()=> modal.remove());
    }
    const grid = $('#assetsGalleryGrid', modal);
    grid.innerHTML = '';
    items.forEach(f=>{
      const cell = document.createElement('div');
      cell.style.cssText = 'border:1px solid #2a3550;border-radius:8px;padding:8px';
      const img = document.createElement('img');
      img.src = f.url; img.alt = f.name; img.style.cssText = 'width:100%;height:90px;object-fit:cover;border-radius:6px';
      const cap = document.createElement('div');
      cap.style.cssText = 'font-size:11px;margin-top:6px;word-break:break-all';
      cap.textContent = f.key;
      cell.appendChild(img); cell.appendChild(cap);
      grid.appendChild(cell);
    });
  }

  function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
})();
