/* js/ribbons.selector.js
   Ribbons picker + live preview (3-across grid; correct precedence; eligibility filter).
   Uses:
     - window.state.member in {'cadet','senior','senior_nco'}
     - window.state.ribbons = [{ id, devices? }]
     - window.ribbonsMeta   = [{ id, name, img, precedence?, smOnly?, cadetOnly?, eligibleFor? }]
     - window.AssetPath.url(state, path)
     - Optional: window.globalRenderer.fullRender(state)
*/

(function () {
  const elPreview = document.getElementById('ribbonPreview');
  const elGrid    = document.getElementById('ribbonGrid');
  const elOnly    = document.getElementById('rbEligibleOnly');
  const elAll     = document.getElementById('rbSelectAll');
  const elClear   = document.getElementById('rbClearAll');

  if (!elPreview || !elGrid) return;

  const RIB_W = 23, RIB_H = 7.2;

  const appState = () => (window.state || (window.app && window.app.state) || {});
  const metaList = () => (Array.isArray(window.ribbonsMeta) ? window.ribbonsMeta : []);
  const currentMember = () => (appState().member || 'cadet');

  // ---- eligibility logic ----
  function eligibleForMember(meta, member) {
    if (!meta) return false;
    if (Array.isArray(meta.eligibleFor)) {
      if (!meta.eligibleFor.includes(member)) return false;
    }
    if (meta.smOnly === true && member === 'cadet') return false;
    if (meta.cadetOnly === true && member !== 'cadet') return false;
    return true;
  }

  // ---- precedence sort ----
  function sortByPrecedence(list) {
    return [...list].sort((a,b) => {
      const pa = Number.isFinite(a.precedence) ? a.precedence : 1e9;
      const pb = Number.isFinite(b.precedence) ? b.precedence : 1e9;
      if (pa !== pb) return pa - pb;
      const na = (a.name || a.id || '').toLowerCase();
      const nb = (b.name || b.id || '').toLowerCase();
      return na.localeCompare(nb);
    });
  }

  // ---- read / write selected ribbons in state ----
  function getSelectedIds() {
    const s = appState();
    return (s.ribbons || []).map(r => r.id);
  }
  function setSelectedIds(ids) {
    const s = appState();
    // preserve devices if needed in the future (here we reset to {})
    s.ribbons = ids.map(id => ({ id, devices: {} }));
    renderPreview();
    pokeRenderer();
  }

  // ---- build selection grid (3 across) ----
  function buildGrid() {
    const member = currentMember();
    const onlyEligible = !!elOnly?.checked;
    const metas = sortByPrecedence(metaList());
    const selected = new Set(getSelectedIds());

    const visible = onlyEligible ? metas.filter(m => eligibleForMember(m, member)) : metas;

    elGrid.innerHTML = '';
    for (const m of visible) {
      const card = document.createElement('div');
      card.className = 'ribCard';

      const img = new Image();
      img.className = 'ribImg';
      img.width = RIB_W; img.height = RIB_H;
      img.src = AssetPath.url(appState(), m.img);
      img.setAttribute('data-original-src', img.src);
      img.alt = m.name || m.id;

      const name = document.createElement('div');
      name.className = 'ribName';
      name.textContent = m.name || m.id.replace(/_/g,' ');

      const meta = document.createElement('div');
      meta.className = 'ribMeta';
      const bits = [];
      if (Number.isFinite(m.precedence)) bits.push(`#${m.precedence}`);
      if (m.smOnly)    bits.push('SM');
      if (m.cadetOnly) bits.push('Cadet');
      meta.textContent = bits.join(' • ');

      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.className = 'ribChk';
      chk.checked = selected.has(m.id);
      chk.addEventListener('change', () => {
        const next = new Set(getSelectedIds());
        if (chk.checked) next.add(m.id);
        else next.delete(m.id);
        setSelectedIds(Array.from(next));
      });

      card.appendChild(img);
      card.appendChild(name);
      card.appendChild(meta);
      card.appendChild(chk);
      elGrid.appendChild(card);
    }
  }

  // ---- live rack preview (3 across, rows continue downward) ----
  function renderPreview() {
    const s = appState();
    const metas = metaList();
    const metaById = new Map(metas.map(m => [m.id, m]));
    const chosen = getSelectedIds().map(id => metaById.get(id)).filter(Boolean);
    const ordered = sortByPrecedence(chosen);

    // Build rows of 3, TOP-FIRST (highest precedence on top)
    const rows = [];
    for (let i = 0; i < ordered.length; i += 3) rows.push(ordered.slice(i, i + 3));

    elPreview.innerHTML = '';
    rows.forEach(row => {
      let cls = 'rackRow';
      if (row.length === 1) cls += ' center-1';
      if (row.length === 2) cls += ' center-2';

      const rowEl = document.createElement('div');
      rowEl.className = cls;

      row.forEach(m => {
        const rimg = new Image();
        rimg.width = RIB_W; rimg.height = RIB_H;
        rimg.src = AssetPath.url(s, m.img);
        rimg.setAttribute('data-original-src', rimg.src);
        rimg.alt = m.name || m.id;
        rowEl.appendChild(rimg);
      });

      elPreview.appendChild(rowEl);
    });
  }

  // ---- integrate with main renderer ----
  function pokeRenderer() {
    try {
      if (window.globalRenderer && typeof window.globalRenderer.fullRender === 'function') {
        window.globalRenderer.fullRender(appState());
        return;
      }
      const ev = new CustomEvent('ribbons-changed', { detail: { ribbons: appState().ribbons } });
      window.dispatchEvent(ev);
    } catch (e) { /* no-op */ }
  }

  // Controls
  elOnly?.addEventListener('change', () => buildGrid());
  elAll?.addEventListener('click', () => {
    const member = currentMember();
    const onlyEligible = !!elOnly?.checked;
    const metas = sortByPrecedence(metaList());
    const visible = onlyEligible ? metas.filter(m => eligibleForMember(m, member)) : metas;
    setSelectedIds(visible.map(m => m.id));
    buildGrid();
  });
  elClear?.addEventListener('click', () => {
    setSelectedIds([]);
    buildGrid();
  });

  // When member changes elsewhere, rebuild for eligibility
  window.addEventListener('member-changed', () => {
    buildGrid();
    renderPreview();
  });

  // Initial mount
  document.addEventListener('DOMContentLoaded', () => {
    buildGrid();
    renderPreview();
  });
})();
