// Uniform engine, part 3: composes a uniform from what the member wears.
//
// compose(build, store) returns a scene: { layers, bounds, notes } in inches, with the base garment's
// box as the origin. Every uniform is a short profile (js/engine/profiles.js) that names its garment,
// its layers and its slots; the shared helpers here do the placing, so a rule such as "badges 1/2 in
// above the top row of ribbons" is written once and used by every uniform that has the slot.
(function(root, factory){
  const deps = (typeof module === 'object' && module.exports)
    ? { core: require('./core.js'), awards: require('./awards.js') }
    : { core: root.CAPUBEngine.core, awards: root.CAPUBEngine.awards };
  const api = factory(deps.core, deps.awards);
  if(typeof module === 'object' && module.exports) module.exports = api;
  else { root.CAPUBEngine = root.CAPUBEngine || {}; root.CAPUBEngine.compose = api; }
})(typeof self !== 'undefined' ? self : this, function(core, awards){
  'use strict';

  // Draw order. Later layers cover earlier ones.
  const Z = {
    under: -5, garment: 0, garmentLayer: 2, tape: 4, patch: 6, cord: 7, epauletLayer: 8,
    insignia: 10, ribbon: 12, device: 13, medal: 14, badge: 16, text: 20, hat: 30, hatDevice: 31
  };

  function createContext(build, store){
    const ctx = {
      build, store,
      layers: [],
      notes: [],
      base: null,
      async spec(id){ return store.load(id); },
      has(id){ return !!id && store.has(id); },

      async garment(id, opts){
        const s = await store.load(id);
        ctx.base = s;
        ctx.layers.push(Object.assign(core.registerAtOrigin(s, Z.garment, 'garment'), { key: 'base:jacket', className: 'jacket' }, opts || {}));
        return s;
      },
      // Redraw named groups of the base garment above everything placed so far (a lapel that may
      // cover part of the ribbons, 11.1.8; collar leaves over badges).
      foreground(groups, z){
        if(!ctx.base) return;
        ctx.layers.push(Object.assign(core.registerAtOrigin(ctx.base, z == null ? Z.badge + 1 : z, 'garment-foreground'), { key: 'layer:foreground', onlyGroups: groups }));
      },
      // A layer drawn to share the base garment's box (nametag, epaulet sleeves, braid).
      async overlay(id, z){
        if(!ctx.has(id)){ ctx.note(`No artwork for ${id}`); return null; }
        const s = await store.load(id);
        ctx.layers.push(Object.assign(core.registerAtOrigin(s, z == null ? Z.garmentLayer : z, 'garment-layer'), { key: 'layer:' + id }));
        ctx.overlays = ctx.overlays || [];
        ctx.overlays.push(s);
        return s;
      },
      // A point on the garment: anchor names are looked up on the base, then on the overlays.
      point(name){
        const specs = [ctx.base, ...(ctx.overlays || [])];
        for(const s of specs){ const a = s && core.anchor(s, name); if(a) return { x: a.x, y: a.y }; }
        return null;
      },
      rect(name){
        const specs = [ctx.base, ...(ctx.overlays || [])];
        for(const s of specs){ const r = s && core.landmarkBounds(s, name); if(r) return r; }
        return null;
      },
      landmark(name){
        const specs = [ctx.base, ...(ctx.overlays || [])];
        for(const s of specs){ const l = s && core.landmark(s, name); if(l) return l; }
        return null;
      },
      async place(id, opts){
        if(!ctx.has(id)){ ctx.note(`No artwork for ${id}`); return null; }
        const s = await store.load(id);
        const layer = core.placeAsset(s, Object.assign({ z: Z.insignia }, opts));
        ctx.layers.push(layer);
        return layer;
      },
      raster(opts){
        const layer = Object.assign({ type: 'raster', rotate: 0, origin: { x: opts.x, y: opts.y }, z: Z.patch }, opts);
        ctx.layers.push(layer);
        return layer;
      },
      text(opts){
        const layer = Object.assign({ type: 'text', rotate: 0, z: Z.text, role: 'text' }, opts);
        layer.origin = layer.origin || { x: layer.x, y: layer.y };
        ctx.layers.push(layer);
        return layer;
      },
      note(message){ if(!ctx.notes.includes(message)) ctx.notes.push(message); }
    };
    return ctx;
  }

  // ---- Placement rules shared by every uniform ----------------------------------------------

  // Stack pieces upward from a line: the first piece's bottom edge sits `gap` above `bottomY`,
  // centred on `x`; each next piece sits `gap` above the one before (the "centred 1/2 inch above"
  // rule of 4.1.5.2.2.4.1 and its equivalents). Returns the top of the stack.
  async function stackUp(ctx, ids, x, bottomY, gap, opts){
    let y = bottomY;
    const placed = [];
    for(const id of ids){
      const s = await ctx.spec(id);
      const layer = await ctx.place(id, Object.assign({ pieceAnchor: 'bottom_center', at: { x, y: y - gap } }, opts, { key: (opts && opts.keyFor ? opts.keyFor(id) : 'badge:' + id) }));
      if(layer){ placed.push(layer); y = y - gap - s.h; }
    }
    return { top: y, placed };
  }

  // Centre one piece on a point.
  async function centerOn(ctx, id, at, opts){
    return ctx.place(id, Object.assign({ pieceAnchor: 'center', at }, opts));
  }

  // Fit a piece inside a rectangle (keeping its proportions), centred. For patches with no
  // regulation size: they may not extend past their Velcro or zone (ICL 25-06 7.1.1.4).
  async function fitIn(ctx, id, rect, opts){
    const s = await ctx.spec(id);
    const scale = Math.min(1, rect.w / s.w, rect.h / s.h) * ((opts && opts.fill) || 1);
    return ctx.place(id, Object.assign({ pieceAnchor: 'center', at: core.rectCenter(rect), scale }, opts));
  }

  function fitRaster(ctx, href, rect, aspect, opts){
    // aspect = w / h of the image; fit inside rect, centred.
    let w = rect.w, h = w / aspect;
    if(h > rect.h){ h = rect.h; w = h * aspect; }
    return ctx.raster(Object.assign({ href, x: rect.x + (rect.w - w) / 2, y: rect.y + (rect.h - h) / 2, w, h }, opts));
  }

  // Name text on a tape or plate. `zone` is a rect in scene inches. Upper case block letters, centred,
  // at most `maxH` tall and shrunk to fit the zone's width.
  function nameText(ctx, text, zone, opts){
    const o = opts || {};
    const str = String(text || '').trim();
    if(!str) return null;
    const value = o.upper === false ? str : str.toUpperCase();
    const size = Math.min(o.maxH || zone.h * 0.8, zone.h * 0.9);
    // Approximate advance of bold sans capitals: 0.68 em; shrink to fit.
    const natural = value.length * size * (o.advance || 0.68);
    const fitWidth = natural > zone.w ? zone.w : null;
    return ctx.text({
      text: value,
      x: zone.x + zone.w / 2,
      y: zone.y + zone.h / 2,
      size,
      w: Math.min(natural, zone.w),
      h: size,
      color: o.color || '#d8dbe0',
      weight: o.weight || 700,
      font: o.font,
      fitWidth,
      key: o.key || 'text:name',
      role: 'text',
      className: 'nameText'
    });
  }

  // ---- Ribbons --------------------------------------------------------------------------------

  // Draw a rack. `ribbons` are resolved ribbons in precedence order, each
  // { key, title, asset | raster, devices:[ids], centered }. `slot` gives centerX, bottomY and the
  // wearer's-left (outboard) edge. Returns the rack's bounding box.
  async function drawRack(ctx, ribbons, slot, opts){
    if(!ribbons.length) return null;
    const o = opts || {};
    const sizes = {};
    const deviceIds = [...new Set(ribbons.flatMap(r => r.devices || []))];
    for(const d of deviceIds){ if(ctx.has(d)){ const s = await ctx.spec(d); sizes[d] = { w: s.w, h: s.h }; } }
    const rack = awards.layoutRack(ribbons, {
      perRow: o.perRow || 3,
      centerX: slot.centerX,
      bottomY: slot.bottomY,
      outboardX: slot.outboardX,
      outboardSign: slot.outboardSign,
      align: o.align,
      lapel: o.lapel,
      arrangement: o.arrangement,
      countsBottomFirst: o.countsBottomFirst
    });
    for(const p of rack.placements){
      const r = p.item;
      if(r.asset && ctx.has(r.asset)){
        const s = await ctx.spec(r.asset);
        ctx.layers.push({ type: 'asset', id: r.asset, x: p.x, y: p.y, w: p.w, h: p.h, rotate: 0, origin: { x: p.x, y: p.y }, z: Z.ribbon, role: 'ribbon', key: r.key, title: r.title, className: 'ribbonTile', sw: s.w });
      }else if(r.raster){
        ctx.raster({ href: r.raster, x: p.x, y: p.y, w: p.w, h: p.h, z: Z.ribbon, role: 'ribbon', key: r.key, title: r.title, className: 'ribbonTile', fit: 'stretch' });
      }else{
        ctx.note(`No ribbon artwork for ${r.title || r.key}`);
        continue;
      }
      const devs = (r.devices || []).filter(d => sizes[d]);
      const placed = awards.layoutDevices(r.centered ? devs : awards.sortRun(devs), sizes, { centered: r.centered, ribbonW: p.w, ribbonH: p.h });
      placed.forEach((d, i) => {
        const sz = sizes[d.id];
        ctx.layers.push({ type: 'asset', id: d.id, x: p.x + d.x - sz.w / 2, y: p.y + d.y - sz.h / 2, w: sz.w, h: sz.h, rotate: 0, origin: { x: p.x + d.x, y: p.y + d.y }, z: Z.device, role: 'device', key: `${r.key}:device:${i}`, className: 'ribbonDevice' });
      });
    }
    const box = core.unionBounds(rack.placements.map(p => ({ x: p.x, y: p.y, w: p.w, h: p.h })));
    return Object.assign(box, { mode: rack.mode, rows: rack.rows.map(r => r.length) });
  }

  // Miniature medals: medal body under a vertical ribbon drape (5/8 in wide, devices turned
  // vertical with precedence at the top, CAPR 39-1 11.4.2).
  const MINI_DRAPE = { w: 0.625, h: 1.125 };
  async function drawMiniMedals(ctx, medals, slot, opts){
    if(!medals.length) return null;
    const o = opts || {};
    let maxBodyH = 0;
    for(const m of medals){ if(m.medal && ctx.has(m.medal)){ const s = await ctx.spec(m.medal); maxBodyH = Math.max(maxBodyH, s.h); } }
    const totalH = MINI_DRAPE.h + (maxBodyH || 0.9);
    const out = awards.layoutMiniMedals(medals, {
      style: o.style, medalW: MINI_DRAPE.w, medalH: totalH, drapeH: MINI_DRAPE.h,
      slotW: slot.w, centerX: slot.centerX, bottomY: slot.bottomY
    });
    const sizes = {};
    for(const d of [...new Set(medals.flatMap(m => m.devices || []))]){ if(ctx.has(d)){ const s = await ctx.spec(d); sizes[d] = { w: s.w, h: s.h }; } }
    for(const p of out.placements){
      const m = p.item;
      // Upper rows hang over the drapes of the rows below them, so they draw later.
      const zBase = Z.medal + (out.rows.length - 1 - p.row) * 0.1 + p.z * 0.001;
      // Ribbon drape: the ribbon artwork turned into a vertical 5/8 x 1 1/8 in strip.
      if(m.ribbonAsset && ctx.has(m.ribbonAsset)){
        ctx.layers.push({ type: 'asset', id: m.ribbonAsset, x: p.x, y: p.y, w: MINI_DRAPE.w, h: MINI_DRAPE.h, rotate: 0, origin: { x: p.x, y: p.y }, z: zBase, role: 'mini-drape', key: m.key, title: m.title, className: 'ribbonMini' });
      }else if(m.raster){
        ctx.raster({ href: m.raster, x: p.x, y: p.y, w: MINI_DRAPE.w, h: totalH, z: zBase, role: 'mini', key: m.key, title: m.title, className: 'ribbonMini' });
        continue;
      }
      if(m.medal && ctx.has(m.medal)){
        const s = await ctx.spec(m.medal);
        const attach = core.anchor(s, 'ribbon_attach') || { x: s.w / 2, y: 0 };
        const at = { x: p.x + MINI_DRAPE.w / 2, y: p.y + MINI_DRAPE.h };
        ctx.layers.push(Object.assign(core.placeAsset(s, { pieceAnchor: attach, at, z: zBase + 0.0005, role: 'mini-medal', key: m.key + ':medal', title: m.title }), { className: 'ribbonMini' }));
      }
      // Devices on the drape, vertical, precedence at the top (11.4.2).
      const devs = awards.sortRun((m.devices || []).filter(d => sizes[d]));
      const step = 0.24;
      const y0 = p.y + MINI_DRAPE.h / 2 - (devs.length - 1) * step / 2;
      devs.forEach((d, i) => {
        const sz = sizes[d];
        const cx = p.x + MINI_DRAPE.w / 2, cy = y0 + i * step;
        ctx.layers.push({ type: 'asset', id: d, x: cx - sz.w / 2, y: cy - sz.h / 2, w: sz.w, h: sz.h, rotate: 90, origin: { x: cx, y: cy }, z: zBase + 0.0007, role: 'device', key: `${m.key}:device:${i}` });
      });
    }
    return core.unionBounds(out.placements.map(p => ({ x: p.x, y: p.y, w: MINI_DRAPE.w, h: totalH })));
  }

  // ---- The scene ---------------------------------------------------------------------------------

  function finish(ctx, title){
    const bounds = core.unionBounds(ctx.layers.filter(l => !l.noBounds).map(core.layerBounds));
    return { title, layers: ctx.layers, bounds, notes: ctx.notes, garment: ctx.base && ctx.base.id };
  }

  return { Z, createContext, stackUp, centerOn, fitIn, fitRaster, nameText, drawRack, drawMiniMedals, finish, MINI_DRAPE };
});
