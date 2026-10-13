// Uniform engine, part 4: draws a composed scene as one inline <svg> and exports it as a PNG.
//
// Each asset is fetched once, turned into a <symbol> (its ids are already namespaced with the asset
// id, so they cannot collide) and drawn with <use>. Raster pieces (military art, patches) are
// <image> elements. The viewBox is in inches, so the drawing is resolution independent and the PNG
// export simply rasterizes the same markup at the chosen pixels per inch.
(function(root){
  'use strict';
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const XLINK_NS = 'http://www.w3.org/1999/xlink';
  const symbolCache = new Map();   // asset id -> Promise<{viewBox, inner}>
  const rasterCache = new Map();   // url -> Promise<dataURL>

  function assetUrl(path){
    const E = root.CAPUBEngine || {};
    if(typeof E.assetUrl === 'function') return E.assetUrl(path);
    return (typeof ASSET === 'function') ? ASSET(path) : `images/${path}`;
  }

  function loadSymbol(id, path){
    if(symbolCache.has(id)) return symbolCache.get(id);
    const p = fetch(assetUrl(path), { cache: 'no-cache' }) // artwork is updated in place
      .then(r => { if(!r.ok) throw new Error(`${r.status} ${path}`); return r.text(); })
      .then(text => {
        const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
        const svg = doc.documentElement;
        if(!svg || svg.nodeName.toLowerCase() !== 'svg') throw new Error('Not an SVG: ' + path);
        return { viewBox: svg.getAttribute('viewBox'), inner: svg.innerHTML };
      });
    symbolCache.set(id, p);
    p.catch(() => symbolCache.delete(id));
    return p;
  }

  // Raster images are inlined as data URLs so the exported SVG has no external references.
  function loadRaster(url){
    if(rasterCache.has(url)) return rasterCache.get(url);
    const p = fetch(url)
      .then(r => { if(!r.ok) throw new Error(`${r.status} ${url}`); return r.blob(); })
      .then(blob => new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result);
        fr.onerror = reject;
        fr.readAsDataURL(blob);
      }));
    rasterCache.set(url, p);
    p.catch(() => rasterCache.delete(url));
    return p;
  }

  function el(name, attrs){
    const node = document.createElementNS(SVG_NS, name);
    if(attrs) for(const k of Object.keys(attrs)) if(attrs[k] !== undefined && attrs[k] !== null) node.setAttribute(k, String(attrs[k]));
    return node;
  }

  function fmt(n){ return Number.isFinite(n) ? String(Math.round(n * 10000) / 10000) : '0'; }

  function transformFor(layer){
    const parts = [];
    if(layer.rotate) parts.push(`rotate(${fmt(layer.rotate)} ${fmt(layer.origin.x)} ${fmt(layer.origin.y)})`);
    if(layer.flipX){
      const cx = layer.x + layer.w / 2;
      parts.push(`translate(${fmt(2 * cx)} 0) scale(-1 1)`);
    }
    return parts.join(' ') || null;
  }

  // Build the <svg> for a scene. `manifestPath(id)` resolves an asset id to its path.
  async function buildSvg(scene, manifestPath, opts){
    const options = opts || {};
    const pad = options.pad != null ? options.pad : 0.4;
    const b = scene.bounds;
    const vb = [b.x - pad, b.y - pad, b.w + 2 * pad, b.h + 2 * pad];
    const svg = el('svg', {
      xmlns: SVG_NS,
      viewBox: vb.map(fmt).join(' '),
      width: options.widthPx ? fmt(options.widthPx) : null,
      height: options.widthPx ? fmt(options.widthPx * vb[3] / vb[2]) : null,
      class: 'uniformSvg',
      role: 'img',
      'aria-label': scene.title || 'Uniform preview'
    });
    svg.setAttribute('xmlns:xlink', XLINK_NS);
    const defs = el('defs');
    svg.appendChild(defs);

    // Variants of a symbol with named groups hidden, or with only named groups shown.
    function variantKey(layer){
      if(layer.hideGroups && layer.hideGroups.length) return layer.id + '--hide-' + layer.hideGroups.join('-').replace(/[^a-z0-9-]/gi, '');
      if(layer.onlyGroups && layer.onlyGroups.length) return layer.id + '--only-' + layer.onlyGroups.join('-').replace(/[^a-z0-9-]/gi, '');
      return layer.id;
    }
    const assetIds = [...new Set(scene.layers.filter(l => l.type === 'asset').map(l => l.id))];
    const symbols = await Promise.all(assetIds.map(id => loadSymbol(id, manifestPath(id)).then(s => [id, s]).catch(err => {
      console.warn('[uniform] could not load', id, err);
      return [id, null];
    })));
    const loaded = new Map();
    const symbolData = new Map();
    symbols.forEach(([id, s]) => {
      if(!s) return;
      symbolData.set(id, s);
      const sym = el('symbol', { id: 'sym-' + id, viewBox: s.viewBox, preserveAspectRatio: 'none' });
      sym.innerHTML = s.inner;
      defs.appendChild(sym);
      loaded.set(id, true);
    });
    // Variant symbols. Their own ids get a suffix so they cannot clash with the original's.
    for(const layer of scene.layers){
      if(layer.type !== 'asset') continue;
      const key = variantKey(layer);
      if(key === layer.id || loaded.get(key) || !symbolData.get(layer.id)) continue;
      const s = symbolData.get(layer.id);
      const suffix = '--v' + loaded.size;
      const sym = el('symbol', { id: 'sym-' + key, viewBox: s.viewBox, preserveAspectRatio: 'none' });
      sym.innerHTML = s.inner.replace(/\bid="([^"]+)"/g, (m, v) => `id="${v}${suffix}"`).replace(/url\(#([^)]+)\)/g, (m, v) => `url(#${v}${suffix})`).replace(/href="#([^"]+)"/g, (m, v) => `href="#${v}${suffix}"`);
      const byId = name => sym.querySelector(`[id="${layer.id}__${name}${suffix}"]`);
      if(layer.hideGroups){
        layer.hideGroups.forEach(g => { const n = byId(g); if(n) n.setAttribute('display', 'none'); });
      }else{
        // Draw nothing but the named groups: hide everything, then show those groups.
        const wrap = el('g', { visibility: 'hidden' });
        [...sym.childNodes].forEach(n => { if(n.nodeName !== 'defs') wrap.appendChild(n); });
        sym.appendChild(wrap);
        layer.onlyGroups.forEach(g => { const n = byId(g); if(n){ n.setAttribute('visibility', 'visible'); } });
      }
      defs.appendChild(sym);
      loaded.set(key, true);
    }

    const rasterUrls = [...new Set(scene.layers.filter(l => l.type === 'raster').map(l => l.href))];
    const rasters = new Map();
    await Promise.all(rasterUrls.map(u => loadRaster(u).then(d => rasters.set(u, d)).catch(err => console.warn('[uniform] could not load', u, err))));

    const layers = [...scene.layers].sort((a, b2) => (a.z || 0) - (b2.z || 0));
    const clipIds = new Map();
    for(const layer of layers){
      let node = null;
      if(layer.type === 'asset'){
        const key = variantKey(layer);
        if(!loaded.get(key)) continue;
        node = el('use', { href: '#sym-' + key, x: fmt(layer.x), y: fmt(layer.y), width: fmt(layer.w), height: fmt(layer.h) });
        node.setAttributeNS(XLINK_NS, 'xlink:href', '#sym-' + key);
      }else if(layer.type === 'raster'){
        const data = rasters.get(layer.href);
        if(!data) continue;
        node = el('image', { x: fmt(layer.x), y: fmt(layer.y), width: fmt(layer.w), height: fmt(layer.h), preserveAspectRatio: layer.fit === 'stretch' ? 'none' : 'xMidYMid meet' });
        node.setAttribute('href', data);
        node.setAttributeNS(XLINK_NS, 'xlink:href', data);
      }else if(layer.type === 'rect'){
        node = el('rect', { x: fmt(layer.x), y: fmt(layer.y), width: fmt(layer.w), height: fmt(layer.h), rx: layer.rx ? fmt(layer.rx) : null, fill: layer.fill || 'none', stroke: layer.stroke || null, 'stroke-width': layer.strokeWidth ? fmt(layer.strokeWidth) : null });
      }else if(layer.type === 'text'){
        node = el('text', {
          x: fmt(layer.x), y: fmt(layer.y),
          'text-anchor': layer.anchor || 'middle',
          'dominant-baseline': 'central',
          'font-family': layer.font || 'Arial, Helvetica, sans-serif',
          'font-weight': layer.weight || 700,
          'font-size': fmt(layer.size),
          fill: layer.color || '#d8dbe0',
          'letter-spacing': layer.letterSpacing ? fmt(layer.letterSpacing) : null,
          textLength: layer.fitWidth ? fmt(layer.fitWidth) : null,
          lengthAdjust: layer.fitWidth ? 'spacingAndGlyphs' : null
        });
        node.textContent = layer.text;
      }
      if(!node) continue;
      let t = transformFor(layer);
      // Condensed lettering (the tapes): squeeze horizontally about the text's centre.
      if(layer.type === 'text' && layer.condense) t = [t, `translate(${fmt(layer.x)} 0) scale(${fmt(layer.condense)} 1) translate(${fmt(-layer.x)} 0)`].filter(Boolean).join(' ');
      if(t) node.setAttribute('transform', t);
      if(layer.clip){
        // A clip polygon in scene inches (used to tuck a cord under an epaulet, etc.).
        const key = layer.clip.map(p => fmt(p.x) + ',' + fmt(p.y)).join(' ');
        let cid = clipIds.get(key);
        if(!cid){
          cid = 'clip-' + clipIds.size;
          const cp = el('clipPath', { id: cid, clipPathUnits: 'userSpaceOnUse' });
          cp.appendChild(el('polygon', { points: key }));
          defs.appendChild(cp);
          clipIds.set(key, cid);
        }
        const g = el('g', { 'clip-path': `url(#${cid})` });
        g.appendChild(node);
        node = g;
      }
      const wrap = el('g', {
        class: 'layer ' + (layer.className || ''),
        'data-calib-key': layer.key || null,
        'data-role': layer.role || null
      });
      if(layer.title){
        const title = el('title');
        title.textContent = layer.title;
        wrap.appendChild(title);
      }
      wrap.appendChild(node);
      svg.appendChild(wrap);
    }
    return svg;
  }

  // Rasterize an <svg> to a canvas. Fonts in <text> are the system sans-serif, which an SVG image
  // can use without loading anything.
  function svgToCanvas(svg, widthPx){
    const vb = svg.getAttribute('viewBox').split(/\s+/).map(Number);
    const w = Math.round(widthPx), h = Math.round(widthPx * vb[3] / vb[2]);
    const clone = svg.cloneNode(true);
    clone.setAttribute('width', w);
    clone.setAttribute('height', h);
    const markup = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([markup], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        resolve(canvas);
      };
      img.onerror = err => { URL.revokeObjectURL(url); reject(err); };
      img.src = url;
    });
  }

  root.CAPUBEngine = root.CAPUBEngine || {};
  root.CAPUBEngine.renderSvg = { buildSvg, svgToCanvas, loadSymbol };
})(typeof self !== 'undefined' ? self : this);
