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
        const widthIn = /^([\d.]+)in$/.exec(svg.getAttribute('width') || '');
        return { viewBox: svg.getAttribute('viewBox'), inner: svg.innerHTML, widthIn: widthIn ? Number(widthIn[1]) : null };
      });
    symbolCache.set(id, p);
    p.catch(() => symbolCache.delete(id));
    return p;
  }

  // A symbol's markup without its paint servers (pattern, linearGradient, radialGradient), and their ids: what a variant symbol copies (buildSvg). Worked
  // out once per symbol and kept with it.
  const PAINT = /^(pattern|linearGradient|radialGradient)$/;
  function leanInner(s){
    if(s.lean) return s.lean;
    const doc = new DOMParser().parseFromString(`<svg xmlns="${SVG_NS}" xmlns:xlink="${XLINK_NS}">${s.inner}</svg>`, 'image/svg+xml');
    const shared = new Set();
    const root = doc.documentElement;
    if(!root || root.nodeName.toLowerCase() !== 'svg' || root.getElementsByTagName('parsererror').length){
      s.lean = { inner: s.inner, shared };
      return s.lean;
    }
    const servers = [...root.querySelectorAll('*')].filter(n => PAINT.test(n.localName) && n.getAttribute('id'));
    for(const n of servers){ shared.add(n.getAttribute('id')); n.remove(); }
    s.lean = { inner: shared.size ? root.innerHTML : s.inner, shared };
    return s.lean;
  }

  // A variant that draws only some groups of a sheet (the cap views, the collar over the badges) drops the rest of the sheet instead of carrying
  // it hidden: the groups, the groups that hold them (for their transforms), every definition (clip paths, masks, markers, filters, styles) and
  // whatever a kept element refers to by url(#id) or href="#id" stay; every other element goes. The OCP drawing's three such copies of its sheet were
  // laid out and renamed on every drawing (LIVE13 E85).
  const RESOURCE = /^(defs|clipPath|mask|marker|symbol|style|filter|pattern|linearGradient|radialGradient)$/;
  function pruneToGroups(sym, targets){
    if(!targets.length) return;
    const keep = new Set(), path = new Set();
    const markPath = n => { for(let q = n.parentNode; q && q !== sym; q = q.parentNode) path.add(q); };
    const kept = n => { for(let q = n; q && q !== sym; q = q.parentNode) if(keep.has(q)) return true; return false; };
    const add = n => { if(kept(n)) return false; keep.add(n); markPath(n); return true; };
    targets.forEach(add);
    sym.querySelectorAll('*').forEach(n => { if(RESOURCE.test(n.localName)) add(n); });
    const index = new Map();
    sym.querySelectorAll('[id]').forEach(n => index.set(n.getAttribute('id'), n));
    const ref = /url\(\s*['"]?#([^)'"\s]+)/g;
    const queue = [...keep], seen = new Set();
    while(queue.length){
      const n = queue.pop();
      for(const e of [n, ...n.querySelectorAll('*')]){
        if(seen.has(e)) continue;
        seen.add(e);
        for(const a of Array.from(e.attributes)){
          const ids = [];
          if(a.localName === 'href' && a.value.charAt(0) === '#') ids.push(a.value.slice(1));
          if(a.value.indexOf('url(') >= 0){ let m; ref.lastIndex = 0; while((m = ref.exec(a.value))) ids.push(m[1]); }
          for(const id of ids){ const r = index.get(id); if(r && add(r)) queue.push(r); }
        }
      }
    }
    const sweep = parent => { for(const c of Array.from(parent.children)){ if(keep.has(c)) continue; if(path.has(c)) sweep(c); else c.remove(); } };
    sweep(sym);
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

  // Short stable text for a variant symbol's id.
  function hashText(t){
    let h = 5381;
    for(let i = 0; i < t.length; i++) h = ((h * 33) ^ t.charCodeAt(i)) >>> 0;
    return h.toString(36);
  }

  // A path in sheet inches (M, L and Q with x,y pairs) in the sheet's drawing units: an art group `translate(tx ty) scale(s)` in 0.01 in
  // units draws its own coordinate c at (tx + s * c) / 100 inches.
  function cordPathToArt(d, tx, ty, s){
    return String(d).replace(/(-?[\d.]+),(-?[\d.]+)/g, (m, x, y) => `${fmt((Number(x) * 100 - tx) / s)},${fmt((Number(y) * 100 - ty) / s)}`);
  }

  function transformFor(layer){
    const parts = [];
    // `squeeze` { at, deg, kx, ky }: scaled by kx along the direction deg and ky across it, about `at`, in scene inches, after everything else (the edge-on mess dress board).
    if(layer.squeeze){
      const q = layer.squeeze;
      parts.push(`translate(${fmt(q.at.x)} ${fmt(q.at.y)}) rotate(${fmt(q.deg)}) scale(${fmt(q.kx)} ${fmt(q.ky)}) rotate(${fmt(-q.deg)}) translate(${fmt(-q.at.x)} ${fmt(-q.at.y)})`);
    }
    if(layer.rotate) parts.push(`rotate(${fmt(layer.rotate)} ${fmt(layer.origin.x)} ${fmt(layer.origin.y)})`);
    if(layer.flipX){
      const cx = layer.x + layer.w / 2;
      parts.push(`translate(${fmt(2 * cx)} 0) scale(-1 1)`);
    }
    return parts.join(' ') || null;
  }

  // The measurement overlay, laid out by js/engine/measure-layout.js: gold lines on a soft dark
  // halo (they read on light shirts and dark coats alike), each length with its caption on a dark pill
  // joined to its dimension line by a leader (LIVE13 E97). Widths are in preview pixels (`px` inches
  // each): the dimension line heavier than its witness lines and leader, as on a tailor's drawing.
  const MEASURE = { color: '#ffd24a', caption: '#f6e6b0', halo: '#0b1020', line: 1.7, ext: 1.1, leader: 1.1, haloExtra: 2.2, labelStroke: 0.9, leaderDot: 1.8 };
  // A magnified callout (measure-layout.js, opts.callout): the band outlined on the piece, a leader to the circle, and the circle
  // itself, a copy of every placed layer that reaches the window, drawn `mag` times larger and clipped to the circle, with the band
  // outlined again over it. `copies(window)` returns copies of the scene's layers (in drawing order) that reach the window.
  function calloutNodes(d, px, defs, copies, fontPx){
    const co = d.callout, nodes = [];
    const pts = a => a.map(p => `${fmt(p.x)},${fmt(p.y)}`).join(' ');
    const line = (g, a, stroke, width, extra) => g.appendChild(el('polyline', Object.assign({ points: pts(a), fill: 'none', stroke, 'stroke-width': fmt(width), 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, extra || {})));
    // On the piece: the band, highlighted along one corner, and the leader from the circle to that corner.
    const real = el('g', { class: 'measure-callout-piece' });
    real.appendChild(el('polygon', { points: pts(co.real.fill), fill: MEASURE.color, 'fill-opacity': 0.45, stroke: 'none' }));
    for(const l of co.real.lines){ line(real, l, MEASURE.halo, (MEASURE.ext + MEASURE.haloExtra) * px, { 'stroke-opacity': 0.5 }); line(real, l, MEASURE.color, MEASURE.ext * px); }
    const [rim, tip] = co.leader;
    for(const [stroke, width, extra] of [[MEASURE.halo, (MEASURE.ext + MEASURE.haloExtra) * px, { 'stroke-opacity': 0.5 }], [MEASURE.color, MEASURE.ext * px, {}]]){
      real.appendChild(el('line', Object.assign({ x1: fmt(rim.x), y1: fmt(rim.y), x2: fmt(tip.x), y2: fmt(tip.y), stroke, 'stroke-width': fmt(width), 'stroke-linecap': 'round' }, extra)));
    }
    real.appendChild(el('circle', { cx: fmt(tip.x), cy: fmt(tip.y), r: fmt(1.8 * px), fill: MEASURE.color, stroke: MEASURE.halo, 'stroke-width': fmt(0.8 * px) }));
    nodes.push(real);
    // The circle.
    const clipId = 'callout-clip-' + (calloutNodes.count = (calloutNodes.count || 0) + 1);
    const cp = el('clipPath', { id: clipId, clipPathUnits: 'userSpaceOnUse' });
    cp.appendChild(el('circle', { cx: fmt(co.center.x), cy: fmt(co.center.y), r: fmt(co.r) }));
    defs.appendChild(cp);
    const lens = el('g', { class: 'measure-callout', 'clip-path': `url(#${clipId})` });
    lens.appendChild(el('circle', { cx: fmt(co.center.x), cy: fmt(co.center.y), r: fmt(co.r), fill: '#e9edf3' }));
    const mag = el('g', { transform: `translate(${fmt(co.center.x)} ${fmt(co.center.y)}) scale(${fmt(co.mag)}) translate(${fmt(-co.focus.x)} ${fmt(-co.focus.y)})` });
    copies(co.window).forEach(n => mag.appendChild(n));
    lens.appendChild(mag);
    // A span (CAP tape to the embroidery) is a long band: lighter, so the tape, the backing and the embroidery read through it.
    lens.appendChild(el('polygon', { points: pts(co.inset.fill), fill: MEASURE.color, 'fill-opacity': co.kind === 'span' ? 0.22 : 0.55, stroke: 'none' }));
    for(const l of co.inset.lines) line(lens, l, MEASURE.color, 1.1 * px);
    for(const l of co.inset.marks || []) line(lens, l, MEASURE.color, 0.8 * px, { 'stroke-dasharray': `${fmt(3 * px)} ${fmt(2 * px)}` });
    nodes.push(lens);
    nodes.push(el('circle', { cx: fmt(co.center.x), cy: fmt(co.center.y), r: fmt(co.r), fill: 'none', stroke: MEASURE.halo, 'stroke-width': fmt((MEASURE.line + MEASURE.haloExtra + 1) * px), 'stroke-opacity': 0.6 }));
    nodes.push(el('circle', { cx: fmt(co.center.x), cy: fmt(co.center.y), r: fmt(co.r), fill: 'none', stroke: MEASURE.color, 'stroke-width': fmt(1.6 * px) }));
    if(co.caption){
      const c = co.caption, g = el('g', { class: 'measure-callout-caption' });
      g.appendChild(el('rect', { x: fmt(c.x), y: fmt(c.y), width: fmt(c.w), height: fmt(c.h), rx: fmt(Math.min(c.h / 2, 3 * px)), fill: MEASURE.halo, 'fill-opacity': 0.88, stroke: MEASURE.color, 'stroke-width': fmt(0.7 * px) }));
      c.lines.forEach((t, i) => {
        const text = el('text', { x: fmt(c.x + c.w / 2), y: fmt(c.y + c.h / 2 + (i - (c.lines.length - 1) / 2) * c.size * 1.2), 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-family': 'Arial, Helvetica, sans-serif', 'font-weight': 700, 'font-size': fmt(c.size), fill: MEASURE.color });
        text.textContent = t;
        g.appendChild(text);
      });
      nodes.push(g);
    }
    return nodes;
  }

  function measureNodes(drawings, px, fontPx, defs, copies){
    const out = [];
    const seg = (g, [a, b], stroke, width, extra) => g.appendChild(el('line', Object.assign({ x1: fmt(a.x), y1: fmt(a.y), x2: fmt(b.x), y2: fmt(b.y), stroke, 'stroke-width': fmt(width), 'stroke-linecap': 'round' }, extra || {})));
    for(const d of drawings){
      const g = el('g', { class: 'measure', 'data-calib-key': d.key || null, 'pointer-events': 'none' });
      if(d.callout && copies) calloutNodes(d, px, defs, copies, fontPx).forEach(n => g.appendChild(n));
      const marks = d.centres || [], arrows = d.arrows || [], ext = d.ext || [];
      const main = [d.dim, ...(d.bars || []), ...(d.ticks || []), ...(d.tails || [])];
      // A centre mark is a small thin crosshair at the witness lines' weight, its middle open (LIVE13 E101): quiet over the piece, never a ring.
      const cross = marks.flatMap(m => m.ticks);
      const pts = a => a.map(p => `${fmt(p.x)},${fmt(p.y)}`).join(' ');
      for(const s of main) seg(g, s, MEASURE.halo, (MEASURE.line + MEASURE.haloExtra) * px, { 'stroke-opacity': 0.5 });
      for(const s of [...ext, ...cross]) seg(g, s, MEASURE.halo, (MEASURE.ext + MEASURE.haloExtra) * px, { 'stroke-opacity': 0.5 });
      if(d.leader) seg(g, d.leader, MEASURE.halo, (MEASURE.leader + MEASURE.haloExtra) * px, { 'stroke-opacity': 0.5 });
      for(const a of arrows) g.appendChild(el('polygon', { points: pts(a), fill: MEASURE.halo, stroke: MEASURE.halo, 'stroke-width': fmt(MEASURE.haloExtra * px), 'stroke-linejoin': 'round', 'stroke-opacity': 0.5 }));
      if(d.reference){
        // Only the parts of the edge that cross no piece are drawn (measure-layout referenceSegs).
        for(const r of d.referenceSegs || [d.reference]){
          seg(g, r, MEASURE.halo, (MEASURE.ext + MEASURE.haloExtra) * px, { 'stroke-opacity': 0.5 });
          seg(g, r, MEASURE.color, MEASURE.ext * px, { 'stroke-dasharray': `${fmt(3 * px)} ${fmt(2.5 * px)}`, 'stroke-linecap': 'butt' });
        }
      }
      // Witness lines from the measured edges to the dimension line, then the dimension line itself with its bars, tails and arrowheads.
      for(const s of ext) seg(g, s, MEASURE.color, MEASURE.ext * px);
      for(const s of main) seg(g, s, MEASURE.color, MEASURE.line * px);
      for(const a of arrows) g.appendChild(el('polygon', { class: 'arrow', points: pts(a), fill: MEASURE.color, stroke: MEASURE.color, 'stroke-width': fmt(0.6 * px), 'stroke-linejoin': 'round' }));
      for(const s of cross) seg(g, s, MEASURE.color, MEASURE.ext * px, { class: 'centre-mark' });
      // The leader from the pill's rim to the middle of the dimension line, with a dot on the line.
      if(d.leader){
        seg(g, d.leader, MEASURE.color, MEASURE.leader * px);
        g.appendChild(el('circle', { cx: fmt(d.leader[1].x), cy: fmt(d.leader[1].y), r: fmt(MEASURE.leaderDot * px), fill: MEASURE.color, stroke: MEASURE.halo, 'stroke-width': fmt(0.8 * px) }));
      }
      // The pill: the length, and under it the caption of what is measured.
      const L = d.label, size = L.size || fontPx * px, capSize = L.captionSize || size * 0.8, caption = L.caption || [], padY = (L.h - size * 1.25 - caption.length * capSize * 1.2) / 2;
      g.appendChild(el('rect', { x: fmt(L.x), y: fmt(L.y), width: fmt(L.w), height: fmt(L.h), rx: fmt(Math.min(L.h / 2, 5 * px)), fill: MEASURE.halo, 'fill-opacity': 0.9, stroke: MEASURE.color, 'stroke-width': fmt(MEASURE.labelStroke * px) }));
      const text = el('text', {
        x: fmt(L.x + L.w / 2), y: fmt(L.y + padY + size * 1.25 / 2), 'text-anchor': 'middle', 'dominant-baseline': 'central',
        'font-family': 'Arial, Helvetica, sans-serif', 'font-weight': 700, 'font-size': fmt(size), fill: MEASURE.color
      });
      text.textContent = L.text;
      g.appendChild(text);
      caption.forEach((t, i) => {
        const c = el('text', {
          class: 'caption', x: fmt(L.x + L.w / 2), y: fmt(L.y + padY + size * 1.25 + (i + 0.5) * capSize * 1.2), 'text-anchor': 'middle', 'dominant-baseline': 'central',
          'font-family': 'Arial, Helvetica, sans-serif', 'font-weight': 500, 'font-size': fmt(capSize), fill: MEASURE.caption
        });
        c.textContent = t;
        g.appendChild(c);
      });
      out.push(g);
    }
    return out;
  }

  // Every id in a built drawing (the symbols, the patterns, gradients and clip paths inside them, the clips the engine adds) is renamed with a suffix that
  // belongs to that drawing alone, and every reference to it (href, xlink:href, url(#...) in any attribute, style included) follows. Ids inside an asset are
  // namespaced with the asset's id, so within one drawing they cannot clash, but a document holds more than one drawing (the uniform, the ribbon previews, the
  // exported copy), and a url(#id) is resolved against the whole document: when another drawing earlier in it (a hidden preview, a stale copy) carries the same id,
  // the reference goes there, and a pattern or gradient that lives in a drawing the browser does not paint paints nothing: the mess dress bullion eagle came out as
  // the board's blue with its grey outline (LIVE10-5). Reproduced in Chrome with a hidden decoy pattern of the same id ahead of the uniform; tests/bullion-browser.cjs.
  let drawingCount = 0;
  function scopeIds(svg){
    const suffix = '--d' + (++drawingCount).toString(36);
    const ids = new Set();
    svg.querySelectorAll('[id]').forEach(n => ids.add(n.getAttribute('id')));
    if(!ids.size) return suffix;
    const refUrl = /url\(\s*(['"]?)#([^)'"\s]+)\1\s*\)/g;
    // Only the elements that can carry an id or a reference are visited (the OCP camouflage pattern's thousands of plain shapes carry neither;
    // LIVE13 E85): an id, an href, or one of the attributes that take url(#id).
    const REFS = '[id],[href],[*|href],[fill*="url("],[stroke*="url("],[clip-path],[mask],[filter],[style*="url("],[marker-start],[marker-mid],[marker-end]';
    for(const n of [svg, ...svg.querySelectorAll(REFS)]){
      for(const a of Array.from(n.attributes)){
        const v = a.value;
        if(a.name === 'id'){ if(ids.has(v)) a.value = v + suffix; continue; }
        if((a.localName === 'href') && v.charAt(0) === '#'){ if(ids.has(v.slice(1))) a.value = v + suffix; continue; }
        if(v.indexOf('url(') >= 0){
          const w = v.replace(refUrl, (m, q, id) => ids.has(id) ? `url(${q}#${id}${suffix}${q})` : m);
          if(w !== v) a.value = w;
        }
      }
    }
    return suffix;
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

    // Ribbon and medal devices are drawn from a copy with an opaque metal base, darker metal and a thin dark edge
    // (awards.deviceInner), so they read on any ribbon colour. The copy is a separate symbol; overflow is visible
    // because the edge lies outside the artwork's own box.
    const AW = root.CAPUBEngine && root.CAPUBEngine.awards;
    const deviceSyms = new Set();
    // Variants of a symbol with named groups hidden, or with only named groups shown.
    function variantKey(layer){
      if(layer.cordPath && layer.cordPath.d) return layer.id + '--cord-' + hashText(layer.cordPath.d);
      // Both: the named groups only, less the hidden ones inside them (a collar group redrawn without its cover).
      if(layer.onlyGroups && layer.onlyGroups.length && layer.hideGroups && layer.hideGroups.length) return layer.id + '--only-' + layer.onlyGroups.join('-').replace(/[^a-z0-9-]/gi, '') + '--hide-' + layer.hideGroups.join('-').replace(/[^a-z0-9-]/gi, '');
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
      // Parsed once per symbol and cloned for each drawing (LIVE13 E85: the OCP sheet is 377 KB of markup, parsed again on every drawing).
      if(!s.node){
        s.node = el('symbol', { id: 'sym-' + id, viewBox: s.viewBox, preserveAspectRatio: 'none' });
        s.node.innerHTML = s.inner;
      }
      defs.appendChild(s.node.cloneNode(true));
      loaded.set(id, true);
    });
    if(AW && AW.deviceInner){
      for(const id of new Set(scene.layers.filter(l => l.type === 'asset' && l.role === 'device').map(l => l.id))){
        const s = symbolData.get(id);
        if(!s) continue;
        const vb = s.viewBox.split(/\s+/).map(Number);
        const sym = el('symbol', { id: 'sym-' + id + '--dev', viewBox: s.viewBox, preserveAspectRatio: 'none', overflow: 'visible' });
        sym.innerHTML = AW.deviceInner(s.inner, s.widthIn ? vb[2] / s.widthIn : 100, '--dev');
        defs.appendChild(sym);
        deviceSyms.add(id);
      }
    }
    // Variant symbols. Their own ids get a suffix so they cannot clash with the original's.
    for(const layer of scene.layers){
      if(layer.type !== 'asset') continue;
      const key = variantKey(layer);
      if(key === layer.id || loaded.get(key) || !symbolData.get(layer.id)) continue;
      const s = symbolData.get(layer.id);
      // A variant is made once per symbol and key and cloned for each drawing; its suffix comes from its key, so the copy is the same in
      // every drawing (LIVE13 E85).
      s.variants = s.variants || new Map();
      if(s.variants.has(key)){
        defs.appendChild(s.variants.get(key).cloneNode(true));
        loaded.set(key, true);
        continue;
      }
      const suffix = '--v' + hashText(key);
      const sym = el('symbol', { id: 'sym-' + key, viewBox: s.viewBox, preserveAspectRatio: 'none' });
      // The paint servers (patterns, gradients) are not copied into a variant: it paints with the plain symbol's, which every drawing holds
      // (above), so their references keep the plain ids. The OCP sheet's camouflage pattern alone is 288 KB of its 377 KB, and an OCP drawing
      // makes four variants of the sheet (the figure without its cap views, the cap front, the cap back, the collar over the badges): each copy
      // was parsed, its ids renamed and laid out on every drawing, the lag Ethan saw switching badges on the OCP (LIVE13 E85).
      const lean = leanInner(s);
      sym.innerHTML = lean.inner.replace(/\bid="([^"]+)"/g, (m, v) => `id="${v}${suffix}"`).replace(/url\(#([^)]+)\)/g, (m, v) => lean.shared.has(v) ? m : `url(#${v}${suffix})`).replace(/href="#([^"]+)"/g, (m, v) => lean.shared.has(v) ? m : `href="#${v}${suffix}"`);
      const byId = name => sym.querySelector(`[id="${layer.id}__${name}${suffix}"]`);
      if(layer.cordPath && layer.cordPath.d){
        // The fitted cord path (engine: core.fitCord) replaces the sheet's polyline in every stroke of the braid; the art group's own
        // translate and scale take the path from sheet inches back to the sheet's drawing units.
        const art = byId('art'), cord = byId('cord'), t = art && /translate\(([-\d.]+)[ ,]+([-\d.]+)\)\s*scale\(([-\d.]+)\)/.exec(art.getAttribute('transform') || '');
        if(cord && t){
          const d = cordPathToArt(layer.cordPath.d, Number(t[1]), Number(t[2]), Number(t[3]));
          cord.querySelectorAll('path').forEach(pn => { if(/^M/.test(pn.getAttribute('d') || '')) pn.setAttribute('d', d); });
        }
      }else if(layer.hideGroups && !(layer.onlyGroups && layer.onlyGroups.length)){
        layer.hideGroups.forEach(g => { const n = byId(g); if(n) n.setAttribute('display', 'none'); });
      }else{
        // Draw nothing but the named groups: the rest of the sheet is dropped (pruneToGroups keeps what they need), then what is left
        // is hidden and those groups shown.
        pruneToGroups(sym, layer.onlyGroups.map(byId).filter(Boolean));
        const wrap = el('g', { visibility: 'hidden' });
        [...sym.childNodes].forEach(n => { if(n.nodeName !== 'defs') wrap.appendChild(n); });
        sym.appendChild(wrap);
        // A clip path, mask or pattern inside the hidden wrapper inherits 'hidden' for its own shapes,
        // which makes it empty, so everything it clips would vanish (the blazer's lapel foreground was
        // clipped to the silhouette and drew nothing): they stay visible.
        wrap.querySelectorAll('clipPath, mask, pattern, marker').forEach(n => n.setAttribute('visibility', 'visible'));
        layer.onlyGroups.forEach(g => { const n = byId(g); if(n){ n.setAttribute('visibility', 'visible'); } });
        (layer.hideGroups || []).forEach(g => { const n = byId(g); if(n) n.setAttribute('display', 'none'); });
      }
      s.variants.set(key, sym.cloneNode(true));
      defs.appendChild(sym);
      loaded.set(key, true);
    }

    const rasterUrls = [...new Set(scene.layers.filter(l => l.type === 'raster').map(l => l.href))];
    const rasters = new Map();
    await Promise.all(rasterUrls.map(u => loadRaster(u).then(d => rasters.set(u, d)).catch(err => console.warn('[uniform] could not load', u, err))));

    const layers = [...scene.layers].sort((a, b2) => (a.z || 0) - (b2.z || 0));
    const clipIds = new Map();
    const silIds = new Map();
    function silhouetteClip(garmentId){
      if(silIds.has(garmentId)) return silIds.get(garmentId);
      let cid = null;
      const base = scene.layers.find(l => l.type === 'asset' && l.id === garmentId && l.role === 'garment');
      const data = symbolData.get(garmentId);
      const path = defs.querySelector(`[id="${garmentId}__clipSil"] path`), art = defs.querySelector(`[id="${garmentId}__art"]`);
      if(base && data && path && art){
        const vbox = data.viewBox.split(/\s+/).map(Number);
        const cp = el('clipPath', { id: 'clipsil-' + silIds.size, clipPathUnits: 'userSpaceOnUse' });
        const copy = el('path', { d: path.getAttribute('d'), 'clip-rule': path.getAttribute('clip-rule') || null,
          transform: `translate(${fmt(base.x)} ${fmt(base.y)}) scale(${fmt(base.w / vbox[2])} ${fmt(base.h / vbox[3])}) translate(${fmt(-vbox[0])} ${fmt(-vbox[1])}) ${art.getAttribute('transform') || ''}` });
        cp.appendChild(copy);
        defs.appendChild(cp);
        cid = cp.getAttribute('id');
      }
      silIds.set(garmentId, cid);
      return cid;
    }
    const drawn = [];
    for(const layer of layers){
      let node = null;
      if(layer.type === 'asset'){
        const key = layer.role === 'device' && deviceSyms.has(layer.id) ? layer.id + '--dev' : variantKey(layer);
        if(!loaded.get(layer.role === 'device' ? layer.id : key)) continue;
        node = el('use', { href: '#sym-' + key, x: fmt(layer.x), y: fmt(layer.y), width: fmt(layer.w), height: fmt(layer.h) });
        node.setAttributeNS(XLINK_NS, 'xlink:href', '#sym-' + key);
      }else if(layer.type === 'raster'){
        const data = rasters.get(layer.href);
        if(!data) continue;
        if(Array.isArray(layer.crop) && layer.crop.length === 4){
          // Only the box layer.crop = [x0, y0, x1, y1] (fractions of the image) is drawn, filling the layer's rectangle: a badge
          // PNG with margin or cloth around it, drawn at the badge's own size (a nested svg whose viewBox is that box of a unit image).
          const c = layer.crop;
          node = el('svg', { x: fmt(layer.x), y: fmt(layer.y), width: fmt(layer.w), height: fmt(layer.h), viewBox: `${c[0]} ${c[1]} ${c[2] - c[0]} ${c[3] - c[1]}`, preserveAspectRatio: 'none', overflow: 'hidden' });
          const im = el('image', { x: 0, y: 0, width: 1, height: 1, preserveAspectRatio: 'none' });
          im.setAttribute('href', data);
          im.setAttributeNS(XLINK_NS, 'xlink:href', data);
          node.appendChild(im);
        }else{
          node = el('image', { x: fmt(layer.x), y: fmt(layer.y), width: fmt(layer.w), height: fmt(layer.h), preserveAspectRatio: layer.fit === 'stretch' ? 'none' : 'xMidYMid meet' });
          node.setAttribute('href', data);
          node.setAttributeNS(XLINK_NS, 'xlink:href', data);
        }
      }else if(layer.type === 'rect'){
        node = el('rect', { x: fmt(layer.x), y: fmt(layer.y), width: fmt(layer.w), height: fmt(layer.h), rx: layer.rx ? fmt(layer.rx) : null, fill: layer.fill || 'none', 'fill-opacity': layer.fillOpacity != null ? layer.fillOpacity : null, stroke: layer.stroke || null, 'stroke-width': layer.strokeWidth ? fmt(layer.strokeWidth) : null });
      }else if(layer.type === 'polygon'){
        // A flat-filled polygon in scene inches (the slide-on epaulet sleeve over its strap and its two shading bands).
        node = el('polygon', { points: layer.points.map(p => fmt(p.x) + ',' + fmt(p.y)).join(' '), fill: layer.fill || 'none', 'fill-opacity': layer.fillOpacity != null ? layer.fillOpacity : null, stroke: layer.stroke || null, 'stroke-width': layer.stroke ? fmt(layer.strokeWidth || 0.02) : null, 'stroke-linejoin': 'round' });
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
      if(layer.clipOut && layer.clipOut.length){
        // Everything except the polygons in scene inches (a collar leaf lying over a badge pinned under it):
        // one clip path of a rectangle larger than the scene and the polygons, filled even-odd.
        const d = 'M-1000 -1000H2000V2000H-1000Z ' + layer.clipOut.map(poly => 'M' + poly.map(p => fmt(p.x) + ' ' + fmt(p.y)).join('L') + 'Z').join(' ');
        let cid = clipIds.get('out:' + d);
        if(!cid){
          cid = 'clip-' + clipIds.size;
          const cp = el('clipPath', { id: cid, clipPathUnits: 'userSpaceOnUse' });
          cp.appendChild(el('path', { d, 'clip-rule': 'evenodd' }));
          defs.appendChild(cp);
          clipIds.set('out:' + d, cid);
        }
        const g = el('g', { 'clip-path': `url(#${cid})` });
        g.appendChild(node);
        node = g;
      }
      if(layer.clipSil){
        // Clipped to the garment sheet's own silhouette (its `clipSil` path, in the sheet's art frame): a
        // copy of the path carried into the scene by the same transform the sheet's symbol is drawn with.
        const sil = silhouetteClip(layer.clipSil);
        if(sil){
          const g = el('g', { 'clip-path': `url(#${sil})` });
          g.appendChild(node);
          node = g;
        }
      }
      if(layer.cordPath && layer.cordPath.visible){
        // The run past the armpit narrows to a point: the braid dives under the arm (sheet inches, the sheet's box at the layer's origin).
        const cp = el('clipPath', { id: 'cordtail-' + clipIds.size + '-' + drawn.length, clipPathUnits: 'userSpaceOnUse' });
        cp.appendChild(el('polygon', { points: layer.cordPath.visible.map(p => fmt(layer.x + p[0]) + ',' + fmt(layer.y + p[1])).join(' ') }));
        defs.appendChild(cp);
        const g = el('g', { 'clip-path': `url(#${cp.getAttribute('id')})` });
        g.appendChild(node);
        node = g;
      }
      if(layer.cordPath && layer.cordPath.fade){
        // The braid fades out under the arm (engine: core.fitCord, `fade`): opacity 1 at `from` falling to 0 at `to`, along that segment (sheet inches, the sheet's box at the layer's
        // origin). A luminance mask whose gradient is white before `from` and black after `to`; ids are the engine's own, and scopeIds gives them the drawing's suffix.
        const f = layer.cordPath.fade, n = defs.querySelectorAll('mask').length;
        const gid = 'cordfade-' + n, mid = 'cordfademask-' + n;
        const lg = el('linearGradient', { id: gid, gradientUnits: 'userSpaceOnUse', x1: fmt(layer.x + f.from[0]), y1: fmt(layer.y + f.from[1]), x2: fmt(layer.x + f.to[0]), y2: fmt(layer.y + f.to[1]) });
        lg.appendChild(el('stop', { offset: 0, 'stop-color': '#ffffff' }));
        lg.appendChild(el('stop', { offset: 1, 'stop-color': '#000000' }));
        defs.appendChild(lg);
        const mk = el('mask', { id: mid, maskUnits: 'userSpaceOnUse', x: -1000, y: -1000, width: 3000, height: 3000 });
        mk.appendChild(el('rect', { x: -1000, y: -1000, width: 3000, height: 3000, fill: `url(#${gid})` }));
        defs.appendChild(mk);
        const g = el('g', { mask: `url(#${mid})` });
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
      drawn.push({ layer, wrap });
    }
    // The measurements go over everything, sized for the preview stage unless told otherwise.
    const ML = root.CAPUBEngine && root.CAPUBEngine.measureLayout;
    if(options.measure && ML){
      const px = options.measurePx || ML.previewPx(vb);
      // The lapel insignia are whole-sheet overlays: their sheets state where the pieces lie (landmarks), which the overlay keeps its lines off.
      const CORE0 = root.CAPUBEngine && root.CAPUBEngine.core;
      const lapelIds = [...new Set(scene.layers.filter(l => l.type === 'asset' && /-lapel-(cap|us|us-nco)$|-senior-nco-lapel$/.test(l.id || '')).map(l => l.id))];
      const landmarks = new Map();
      await Promise.all(lapelIds.map(id => fetch(assetUrl(manifestPath(id).replace(/\.svg$/, '.spec.json')), { cache: 'no-cache' })
        .then(r => (r.ok ? r.json() : null)).then(raw => { if(raw && CORE0) landmarks.set(id, CORE0.normalizeSpec({ id }, raw).landmarks); }).catch(() => null)));
      const pieces = ML.lapelPieces(scene, id => landmarks.get(id) || null);
      const drawings = ML.layout(scene, { px, area: { x: vb[0], y: vb[1], w: vb[2], h: vb[3] }, calloutArea: ML.calloutRoom(vb, px), pieces });
      // The magnified insets are set outside the garment, above the figure or beside it: the frame grows to hold the ones that do not fit in it.
      const frame = ML.frameFor(vb, drawings, px);
      if(frame.some((v, i) => Math.abs(v - vb[i]) > 1e-9)){
        svg.setAttribute('viewBox', frame.map(fmt).join(' '));
        if(options.widthPx){ svg.setAttribute('width', fmt(options.widthPx)); svg.setAttribute('height', fmt(options.widthPx * frame[3] / frame[2])); }
      }
      // The magnified insets draw copies of the layers that reach their window, as the page draws them but not as layers of their own.
      const CORE = root.CAPUBEngine && root.CAPUBEngine.core;
      const copies = win => drawn.filter(({ layer }) => layer.role !== 'measure' && layer.role !== 'clear' && (() => {
        const bb = CORE ? CORE.layerBounds(layer) : null;
        return !bb || (bb.x < win.x + win.w && bb.x + bb.w > win.x && bb.y < win.y + win.h && bb.y + bb.h > win.y);
      })()).map(({ wrap }) => {
        const c = wrap.cloneNode(true);
        c.setAttribute('class', 'calloutLayer');
        c.removeAttribute('data-calib-key');
        c.removeAttribute('data-role');
        c.querySelectorAll('title').forEach(t => t.remove());
        return c;
      });
      measureNodes(drawings, px, ML.PX.font, defs, copies).forEach(n => svg.appendChild(n));
    }
    scopeIds(svg);
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
  root.CAPUBEngine.renderSvg = { buildSvg, svgToCanvas, loadSymbol, measureNodes, cordPathToArt, hashText, scopeIds };
})(typeof self !== 'undefined' ? self : this);
