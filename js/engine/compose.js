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
    insignia: 10, ribbon: 12, device: 13, medal: 14, badge: 16, text: 20, hat: 30, hatDevice: 31,
    // Epaulet and shoulder-board views from above lie over the cap's corners where the cap is as wide as
    // the neck opening: the cap is seated on the collar (6.2.2) and must not cover their grade or CAP lettering (R7).
    epauletTop: 32, epauletTopGrade: 32.5
  };

  // Pieces a garment sheet draws itself, which the measurement overlay's callouts, captions and labels keep clear of like any placed
  // piece (ctx.keepClear). A sheet states some of them as landmarks, but not all (the flag and AUX patches, the sleeve pocket and loop
  // outlines, the CFDU crest) and the landmark is a zone, not the drawn group, so these are the bounding boxes of the sheet's own groups
  // `<sheet id>__<name>`, MEASURED FROM THE SHEET'S SVG (headless Chrome getBoundingClientRect, 1 viewBox unit = 1 px, so sheet
  // units: 100 = 1 in): [group, x, y, w, h]. Re-measure after an art sync that moves a sheet (the tapes and name-tape equal the
  // sheet's own landmarks to 0.01 in). LIVE13 E83: the OCP sheet grew 5.218 in at the top for the beret row and every one of its 32 landmarks moved
  // down 521.8 units, so its rows moved by the same 521.8. The cap views' tapes are not listed: they travel with the cap view, whose box is already kept clear.
  const DRAWN_PIECES = {};
  const DRAWN_0 = [
    ['sleeve-pocket-edge-right', 738.78, 1701.16, 444.8, 1073.82],
    ['patch-flag-edge-right', 872.49, 2086.37, 197.57, 211.86],
    ['sleeve-pocket-edge-left', 3046.13, 1701.16, 444.8, 1073.82],
    ['patch-aux-edge-left', 3159.65, 2086.37, 197.57, 211.86],
    ['sleeve-pocket-right', 124.96, 1549.3, 450, 1050],
    ['patch-flag-right', 187.46, 1936.8, 325, 181.25],
    ['sleeve-pocket-left', 3654.75, 1549.3, 450, 1050],
    ['patch-aux-left', 3717.25, 1936.8, 325, 181.25],
    ['name-tape', 1352.35, 2059.6, 525, 100],
    ['cap-tape', 2352.35, 2059.6, 525, 100],
    ['cap-tape-lettering', 2388.65, 2079.63, 453.38, 59.96]
  ];
  DRAWN_PIECES['garment-ocp-coat-abu-cut'] = DRAWN_0;
  const DRAWN_1 = [
    ['name-tape', 1330, 1605, 500, 90],
    ['cap-tape', 2100, 1605, 500, 90],
    ['cap-tape-lettering', 2134.6, 1620.03, 431.88, 59.96]
  ];
  DRAWN_PIECES['garment-abu-coat'] = DRAWN_1;
  const DRAWN_2 = [
    ['name-tape', 1330, 2175, 500, 90],
    ['cap-tape', 2100, 2175, 500, 90],
    ['cap-tape-lettering', 2134.6, 2190.03, 431.88, 59.96]
  ];
  DRAWN_PIECES['garment-cfu-coat'] = DRAWN_2;
  const DRAWN_3 = [
    ['name-tape', 2762.7, 1049.98, 400, 200],
    ['patch-command', 1656.68, 1005.43, 299.96, 289.06],
    ['sleeve-front-loop-right', 971.6, 596.8, 325.57, 394.21],
    ['sleeve-front-flag-left', 3464.92, 584.43, 265.32, 268.98],
    ['sleeve-front-pocket-left', 3596.77, 1247.14, 300.48, 573.59],
    ['patch-flag-left', 4170.62, 316.3, 350, 200],
    ['sleeve-pocket-left', 4225.69, 750.5, 240, 550]
  ];
  DRAWN_PIECES['garment-cfdu-flight-suit'] = DRAWN_3;
  DRAWN_PIECES['garment-fdu-flight-suit'] = DRAWN_3;
  const DRAWN_4 = [
    ['name-tape', 3240, 870, 400, 200],
    ['patch-command', 1990, 825.5, 300, 289],
    ['sleeve-front-loop-right', 1405.04, 496.86, 330.32, 394.27],
    ['sleeve-front-flag-left', 3835.31, 508.29, 259.39, 265.43],
    ['sleeve-front-pocket-left', 4137.86, 1048.38, 535.88, 658.25],
    ['patch-flag-left', 4965, 140, 350, 200],
    ['sleeve-pocket-left', 4977.5, 765, 325, 575]
  ];
  DRAWN_PIECES['garment-flight-jacket-blue'] = DRAWN_4;
  DRAWN_PIECES['garment-flight-jacket-green'] = DRAWN_4;

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
        // The patches and tapes are pieces like any other (labels and callouts keep off them); the sleeve pocket and loop outlines are the
        // surfaces the engine's own patches and measures lie on, so only the callouts' circles and captions keep off those (`surface`).
        for(const [name, x, y, w, h] of DRAWN_PIECES[id] || []) ctx.keepClear({ x: x / 100, y: y / 100, w: w / 100, h: h / 100 }, 'drawn:' + name, /^(sleeve-pocket|sleeve-front)/.test(name));
        return s;
      },
      // Redraw named groups of the base garment above everything placed so far (a lapel that may
      // cover part of the ribbons, 11.1.8; collar leaves over badges).
      // `except`: groups inside those that stay hidden (a closed collar redrawn without its cover).
      foreground(groups, z, except){
        if(!ctx.base) return;
        ctx.layers.push(Object.assign(core.registerAtOrigin(ctx.base, z == null ? Z.badge + 1 : z, 'garment-foreground'), { key: 'layer:foreground', onlyGroups: groups }, except && except.length ? { hideGroups: except } : {}));
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
        const sh = ctx.landmarkShift && ctx.landmarkShift[name];
        for(const s of specs){ const a = s && core.anchor(s, name); if(a) return sh ? { x: a.x * (sh.k || 1) + sh.dx, y: a.y * (sh.k || 1) + sh.dy } : { x: a.x, y: a.y }; }
        return null;
      },
      // `landmarkShift` {name: {dx, dy, k}}: a landmark of a view the profile has moved on the scene (the cap views
      // seated on the figure or set beside it at a reduced size k, profiles-field.js) is read where the view now is.
      rect(name){
        const specs = [ctx.base, ...(ctx.overlays || [])];
        const sh = ctx.landmarkShift && ctx.landmarkShift[name];
        for(const s of specs){ const r = s && core.landmarkBounds(s, name); if(r) return sh ? { x: r.x * (sh.k || 1) + sh.dx, y: r.y * (sh.k || 1) + sh.dy, w: r.w * (sh.k || 1), h: r.h * (sh.k || 1) } : r; }
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
        // The patches/ocp images are crops of the old sleeve drawing (a small patch and a sliver of the next),
        // not patches: nothing draws them, whoever asks. The page hands the engine the patch's full artwork.
        if(/(^|\/)patches\/ocp\//.test(String(opts.href || ''))){
          ctx.note(`${opts.title || 'A patch'} is only a crop of the old sleeve drawing, so it is not drawn; it needs full patch artwork`);
          return null;
        }
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
      note(message){ if(!ctx.notes.includes(message)) ctx.notes.push(message); },
      // More badges are selected for a position than it takes (the one CAP aviation badge, the two over the left pocket, the one service badge,
      // the pocket badges): the scene says which compete and which are shown, so the page can ask the member (scene.conflicts, see
      // reportBadgeConflict).
      conflicts: [],
      // A regulation distance shown on the measurement overlay, from `from` to `to` (points on the
      // edges it measures, in scene inches), labelled with its length or with `label`. `opts`:
      //   center: 'to' | 'from' | 'both'   that end is a centre (drawn with a centre mark)
      //   mid: point                       a tick where the halfway point falls ("halfway" labels)
      //   side: {x, y}                     the side the line moves to when it cannot stay put
      //   offsetOnly: true                 always move it to that side (the edge is drawn art)
      //   offsetPx: n                      how far it moves at least, in preview pixels
      //   reference: true                  also draw the measured edge, dashed (an undrawn seam)
      //   caption: text                    what is measured, under the length on the pill ("badge to ribbons"); without one the pill names the
      //                                    pieces at the two ends (measure-layout captionFor), or carries the length alone
      // js/engine/measure-layout.js decides where the line and its label go.
      measure(from, to, label, opts){
        if(!from || !to) return null;
        const len = Math.hypot(to.x - from.x, to.y - from.y);
        if(len < 0.05) return null;
        const layer = { type: 'measure', from: { x: from.x, y: from.y }, to: { x: to.x, y: to.y }, label: label || inchesLabel(len),
          x: Math.min(from.x, to.x), y: Math.min(from.y, to.y), w: Math.abs(to.x - from.x), h: Math.abs(to.y - from.y),
          origin: { x: from.x, y: from.y }, rotate: 0, z: 100, role: 'measure', key: 'measure:' + ctx.layers.length, noBounds: true };
        if(opts) layer.opts = opts;
        ctx.layers.push(layer);
        return layer;
      },
      // A piece the garment sheet draws itself (a nametag, a tape) that the measurement labels keep
      // clear of, like the pieces placed on top. Not drawn.
      keepClear(rect, key, surface){
        if(!rect) return;
        ctx.layers.push({ type: 'clear', x: rect.x, y: rect.y, w: rect.w, h: rect.h, rotate: 0, origin: { x: rect.x, y: rect.y }, z: 0, role: surface ? 'surface' : 'clear', key: 'clear:' + (key || ctx.layers.length), noBounds: true });
      }
    };
    return ctx;
  }

  // 0.5 -> "½ in", 1.5 -> "1½ in"; eighths as fractions, anything else to two decimals.
  const EIGHTHS = ['', '⅛', '¼', '⅜', '½', '⅝', '¾', '⅞'];
  function inchesLabel(len){
    const eighths = Math.round(len * 8);
    if(Math.abs(eighths / 8 - len) < 0.01){
      const whole = Math.floor(eighths / 8), part = EIGHTHS[eighths % 8];
      return `${whole || !part ? whole : ''}${part} in`;
    }
    return `${len.toFixed(2)} in`;
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
    const size = o.size || Math.min(o.maxH || zone.h * 0.8, zone.h * 0.9);
    // Approximate advance of bold sans capitals: 0.68 em, times any horizontal condensing (the
    // tape lettering is condensed); shrink to fit.
    const natural = value.length * size * (o.advance || 0.68) * (o.condense || 1);
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
      fitWidth: fitWidth && o.condense ? fitWidth / o.condense : fitWidth,
      condense: o.condense || null,
      key: o.key || 'text:name',
      role: 'text',
      className: 'nameText'
    });
  }

  // Engraved lettering on a nameplate (D30). The lettering is Arial Bold capitals, the face the CAP
  // tape and plate sheets are drawn in, and it is sized from real metrics rather than a guessed
  // em: advance widths per glyph and the cap height, both measured in Chrome at 1000 px
  // (canvas measureText, 700 weight Arial: capital H advance 722, cap height 716 of the 1000 em).
  const GLYPH_ADV = {
    A: 722, B: 722, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, I: 278, J: 556, K: 722, L: 611, M: 833,
    N: 722, O: 778, P: 667, Q: 778, R: 722, S: 667, T: 611, U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611,
    0: 556, 1: 556, 2: 556, 3: 556, 4: 556, 5: 556, 6: 556, 7: 556, 8: 556, 9: 556,
    ' ': 278, '-': 333, "'": 238, '.': 278, ',': 278
  };
  const CAP_HEIGHT = 0.716;       // capital letters, in em
  const CENTRAL_BASELINE = 0.3465; // 'dominant-baseline: central' sits (ascent 0.905 - descent 0.212) / 2 above the baseline
  const GLYPH_FALLBACK = 722;      // accented and other capitals

  function textAdvance(text){
    let sum = 0;
    for(const ch of String(text)) sum += GLYPH_ADV[ch] != null ? GLYPH_ADV[ch] : GLYPH_FALLBACK;
    return sum / 1000;
  }

  // Size the name for a plate. `zone` is the plate spec's name landmark in scene inches. The capitals
  // fill `fill` (default 0.9) of the zone's height; a name too wide for the zone is first squeezed
  // horizontally (the condensed lettering of the field name tapes, down to `minCondense`, default
  // 0.6) and, if that is still too wide, made smaller in proportion. Returns the sizing and the layer.
  function plateName(ctx, text, zone, opts){
    const o = opts || {};
    const str = String(text || '').trim();
    if(!str || !zone) return null;
    const value = o.upper === false ? str : str.toUpperCase();
    const adv = textAdvance(value);
    const fill = o.fill || 0.9;
    const minCondense = o.minCondense || 0.6;
    let size = zone.h * fill / CAP_HEIGHT;
    let condense = 1;
    if(adv * size > zone.w){
      condense = Math.max(minCondense, zone.w / (adv * size));
      if(adv * size * condense > zone.w) size = zone.w / (adv * condense);
    }
    const width = adv * size;               // before condensing
    const capH = size * CAP_HEIGHT;
    const layer = ctx.text({
      text: value,
      x: zone.x + zone.w / 2,
      // The capitals' middle on the zone's middle (the baseline 'central' is the em box's middle).
      y: zone.y + zone.h / 2 + (CAP_HEIGHT / 2 - CENTRAL_BASELINE) * size,
      size,
      w: width * condense,
      h: capH,
      color: o.color || '#d8dbe0',
      weight: 700,
      font: o.font || 'Arial, Helvetica, sans-serif',
      fitWidth: width,
      condense: condense < 1 ? condense : null,
      key: o.key || 'text:name',
      role: 'text',
      className: 'nameText'
    });
    return { layer, size, capH, condense, width: width * condense };
  }

  // ---- Ribbons --------------------------------------------------------------------------------

  // The size each ribbon device is drawn at, by asset id: its spec size, except that a star is drawn as tall as
  // the CAP tri-blade propeller on the same ribbon (Ethan: "the stars are a little small. should be the same size
  // of the triblade"), keeping its own aspect. The star's own 3/16 in point-to-point (0.173 in tall, spec
  // device-star-*) is an estimate; the bronze propeller is 0.262 in tall, so a star is drawn at 1.51 times its
  // spec size. The art and the manifest keep their sizes; this is the one place the factor is applied.
  async function deviceSizes(ctx, ids){
    const sizes = {};
    const propId = awards.DEVICE.propeller_bronze;
    const prop = ctx.has(propId) ? await ctx.spec(propId) : null;
    for(const d of [...new Set(ids)]){
      if(!ctx.has(d)) continue;
      const s = await ctx.spec(d);
      const k = prop && /^device-star-/.test(d) && s.h > 0 ? prop.h / s.h : 1;
      sizes[d] = { w: s.w * k, h: s.h * k };
    }
    return sizes;
  }

  // Draw a rack. `ribbons` are resolved ribbons in precedence order, each
  // { key, title, asset, devices:[ids], centered }. `slot` gives centerX, bottomY and the wearer's-left (outboard) edge.
  // A ribbon with `devicePlan` ([{ id, x, y, scale }], centres in inches from the ribbon's top-left) has its devices where the plan
  // puts them instead (a military ribbon's chooser tile, military/military-device-layout.js ribbonDevicePlan). Returns the rack's bounding box.
  async function drawRack(ctx, ribbons, slot, opts){
    if(!ribbons.length) return null;
    const o = opts || {};
    const sizes = await deviceSizes(ctx, ribbons.flatMap(r => r.devices || []));
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
      }else{
        ctx.note(`No ribbon artwork for ${r.title || r.key}`);
        continue;
      }
      if(r.devicePlan){
        for(const [i, d] of r.devicePlan.entries()){
          if(!ctx.has(d.id)) continue;
          const s = await ctx.spec(d.id), k = d.scale || 1;
          const sz = { w: s.w * k, h: s.h * k };
          ctx.layers.push({ type: 'asset', id: d.id, x: p.x + d.x - sz.w / 2, y: p.y + d.y - sz.h / 2, w: sz.w, h: sz.h, rotate: 0, origin: { x: p.x + d.x, y: p.y + d.y }, z: Z.device, role: 'device', key: `${r.key}:device:${i}`, className: 'ribbonDevice' });
        }
        continue;
      }
      const devs = (r.devices || []).filter(d => sizes[d]);
      const placed = awards.layoutDevices(r.centered ? devs : awards.sortRun(devs), sizes, { centered: r.centered, ribbonW: p.w, ribbonH: p.h });
      // Devices that cannot all fit at full size are drawn smaller by one factor (awards.layoutDevices: the gap closes first).
      const k = placed.scale || 1;
      if(k < 1) ctx.note(`${r.title || r.key}: ${placed.length} devices do not fit the ribbon at full size; drawn at ${k.toFixed(2)} of their size, ${awards.DEVICE_END_MARGIN} in inside each end (CAPR 39-3 6b)`);
      placed.forEach((d, i) => {
        const sz = { w: sizes[d.id].w * k, h: sizes[d.id].h * k };
        ctx.layers.push({ type: 'asset', id: d.id, x: p.x + d.x - sz.w / 2, y: p.y + d.y - sz.h / 2, w: sz.w, h: sz.h, rotate: 0, origin: { x: p.x + d.x, y: p.y + d.y }, z: Z.device, role: 'device', key: `${r.key}:device:${i}`, className: 'ribbonDevice' });
      });
    }
    const box = core.unionBounds(rack.placements.map(p => ({ x: p.x, y: p.y, w: p.w, h: p.h })));
    return Object.assign(box, { mode: rack.mode, rows: rack.rows.map(r => r.length) });
  }

  // Miniature medals: medal body under a vertical ribbon drape (devices turned vertical with
  // precedence at the top, CAPR 39-1 11.4.2).
  // Miniature suspension ribbon: 11/16 in wide (11.3), straight sides of about 1.39 in, then a V
  // point of about 0.15 in into the medal's ring (measured on the McChord miniatures).
  const MINI_DRAPE = { w: 0.6875, h: 1.54, point: 0.15 };
  // CAPR 39-1 11.2.8: 'Upper rows will be placed to cover approximately 50% of the ribbon portion of the medals in the row below.'
  // On the worn jacket (Doran's photo L1837: four rows of four, each medal hanging almost directly under the one above, the lower
  // ribbons showing only as short bands between the medals and at their edges) the rows are one medal body apart plus a short band
  // of ribbon, so the upper pendants hang over the whole ribbon below but its lowest part; Ethan: the rows were 'spaced way too far
  // apart' (1.65 in, the old 50% of the drape). The pitch is the tallest body that hangs below a drape plus a band of the lower
  // ribbon left in view: MINI_ROW_BAND (0.05 in) where no lower row carries a device, else enough for the half-size device and its
  // gaps above the drape's V point (a device on a lower row stays in view, 11.4.2), never under MINI_ROW_MIN.
  const MINI_ROW_MIN = 0.5, MINI_ROW_BAND = 0.05, MINI_DEVICE_BAND = 0.5;
  // 11.3: 'Miniature medals are approximately 1/2 the size of regular medals': the attachments on a miniature medal's ribbon
  // (11.4.2, 'either full size or miniature attachments') are drawn at that half size, on the 11/16 in drape.
  const MINI_DEVICE_SCALE = 0.5;
  // True when the rectangle and the polygon (points {x, y}, or [x, y] pairs) share any area or edge.
  function rectHitsPolygon(r, poly){
    const pts = poly.map(q => Array.isArray(q) ? { x: q[0], y: q[1] } : q);
    const inRect = q => q.x >= r.x && q.x <= r.x + r.w && q.y >= r.y && q.y <= r.y + r.h;
    const inPoly = q => { let c = false; for(let i = 0, j = pts.length - 1; i < pts.length; j = i++){ const a = pts[i], b = pts[j]; if(((a.y > q.y) !== (b.y > q.y)) && (q.x < (b.x - a.x) * (q.y - a.y) / (b.y - a.y) + a.x)) c = !c; } return c; };
    if(pts.some(inRect)) return true;
    const corners = [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }, { x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h }];
    if(corners.some(inPoly)) return true;
    const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    const seg = (a, b, c, d) => (cross(a, b, c) > 0) !== (cross(a, b, d) > 0) && (cross(c, d, a) > 0) !== (cross(c, d, b) > 0);
    for(let i = 0; i < pts.length; i++){
      const a = pts[i], b = pts[(i + 1) % pts.length];
      for(let k = 0; k < 4; k++) if(seg(a, b, corners[k], corners[(k + 1) % 4])) return true;
    }
    return false;
  }
  async function drawMiniMedals(ctx, medals, slot, opts){
    // Only medals are worn as miniatures (11.2.8, Table 11-1): an award with no medal is a ribbon-only
    // award, so it gets no suspension drape; say so rather than hang a ribbon with nothing on it. A U.S. military
    // medal whose body has no art yet (`pendingMedal`) is a medal: its drape hangs in its place, the room for the body kept,
    // with no body and a note, so nothing moves when the art lands.
    medals = (medals || []).filter(m => {
      if(m.pendingMedal || !m.ribbonAsset || (m.medal && ctx.has(m.medal))) return true;
      ctx.note(`${m.title}: ribbon-only award, not worn as a miniature medal (CAPR 39-1 11.2.8)`);
      return false;
    });
    if(!medals.length) return null;
    const pending = medals.filter(m => m.pendingMedal).map(m => m.title);
    if(pending.length) ctx.note(`Medal art pending for ${pending.join(', ')}: only the ribbon is shown`);
    const o = opts || {};
    let maxBodyH = 0;
    for(const m of medals){ if(m.medal && ctx.has(m.medal)){ const s = await ctx.spec(m.medal); maxBodyH = Math.max(maxBodyH, s.h); } }
    const totalH = MINI_DRAPE.h + (maxBodyH || 0.9);
    // Row spacing uses the tallest body in the set; the group is then placed from the medals actually
    // drawn. How far each medal's body hangs below its drape comes from its own spec: the body's
    // height less the ribbon_attach anchor's depth.
    const hang = new Map(), reach = new Map();
    for(const m of medals){
      let below = 0, left = 0, right = MINI_DRAPE.w;
      if(m.pendingMedal) below = totalH - MINI_DRAPE.h;
      else if(m.medal && ctx.has(m.medal)){
        const s = await ctx.spec(m.medal);
        const attach = core.anchor(s, 'ribbon_attach') || { x: s.w / 2, y: 0 };
        below = s.h - attach.y;
        left = Math.min(0, MINI_DRAPE.w / 2 - attach.x); right = Math.max(MINI_DRAPE.w, MINI_DRAPE.w / 2 - attach.x + s.w);
      }
      hang.set(m, below); reach.set(m, { left, right });
    }
    // The rows lie one medal body and a band of ribbon apart (MINI_ROW_BAND, MINI_DEVICE_BAND): the upper row's pendants hang over the ribbons of the row below, as on
    // the worn jacket (Doran's photo, thread L1837: row to row about 0.65 in against the ribbons' 11/16 in width; 11.2.8, 11.3).
    const rows = awards.miniMedalRows(medals, o.style || 'mounting', o.perRow);
    const lowerDevices = rows.slice(1).some(row => row.some(m => (m.devices || []).length));
    const rowPitch = Math.max(MINI_ROW_MIN, Math.max(...[...hang.values()]) + (lowerDevices ? MINI_DEVICE_BAND : MINI_ROW_BAND));
    const out = awards.layoutMiniMedals(medals, {
      rowPitch,
      style: o.style, perRow: o.perRow, medalW: MINI_DRAPE.w, medalH: totalH, drapeH: MINI_DRAPE.h,
      slotW: slot.w, centerX: slot.centerX, bottomY: 0
    });
    // The lowest row's medal bodies end exactly on the line the slot names (1/2 in above the service
    // badge or crest, CAPR 39-1 4.2.1.4 and 4.2.2.4 with ICL 25-02), or the group is centred on the
    // slot's point (the mess dress, 4.1.1.1.2.2): measured from the lowest drawn body, not the
    // tallest body of the whole set, so a taller medal in an upper row cannot leave a gap.
    const lowRow = out.rows.length - 1;
    const drawnBottom = Math.max(...out.placements.filter(p => p.row === lowRow).map(p => p.y + MINI_DRAPE.h + (hang.get(p.item) || 0)));
    const drawnTop = Math.min(...out.placements.map(p => p.y));
    const shift = slot.centerY != null ? slot.centerY - (drawnTop + drawnBottom) / 2 : slot.bottomY - drawnBottom;
    for(const p of out.placements) p.y += shift;
    // The rack never lies under a part of the garment that would cover it (the blazer's lapel, 11.2.8: the medal
    // nearest the lapel is fully exposed): when `avoid` polygons are given, the whole rack slides toward
    // `avoidDir` (+1 toward larger x) in 0.02 in steps until no drape or body touches one, at most `maxShift`
    // (rows keep their alignment, the lowest row keeps its line).
    // `report` (an object the caller passes) gets `blocked` (a drape or body still touches an `avoid` polygon after
    // the slide), `slide`, and `boxes` (each medal's drape and body box, x0/x1/y0/y1, as drawn), so the caller can
    // try a narrower rack and measure how far the rack lies from the rest of the garment.
    let slide = 0;
    const gap = o.avoidGap != null ? o.avoidGap : 0.03;
    const boxOf = p => { const r = reach.get(p.item) || { left: 0, right: MINI_DRAPE.w }; return { x0: p.x + r.left, x1: p.x + r.right, y0: p.y, y1: p.y + MINI_DRAPE.h + (hang.get(p.item) || 0) }; };
    if(o.report) o.report.blocked = false;
    if(o.avoid && o.avoid.length){
      const dir = o.avoidDir < 0 ? -1 : 1, maxShift = o.maxShift != null ? o.maxShift : 2.5;
      const boxes = out.placements.map(boxOf);
      const hits = d => boxes.some(b => o.avoid.some(poly => rectHitsPolygon({ x: b.x0 - gap + d, y: b.y0, w: b.x1 - b.x0 + 2 * gap, h: b.y1 - b.y0 }, poly)));
      while(slide < maxShift && hits(dir * slide)) slide += 0.02;
      if(o.report) o.report.blocked = hits(dir * slide);
      else if(hits(dir * slide)) ctx.note('The miniature medals reach the lapel: there is no room to move them clear of it');
      slide *= dir;
      for(const p of out.placements) p.x += slide;
    }
    if(o.report){ o.report.slide = slide; o.report.boxes = out.placements.map(boxOf); }
    const sizes = await deviceSizes(ctx, medals.flatMap(m => m.devices || []));
    for(const d of Object.keys(sizes)) sizes[d] = { w: sizes[d].w * MINI_DEVICE_SCALE, h: sizes[d].h * MINI_DEVICE_SCALE };
    // Where each medal's drape and body lie, so the devices of a lower row go in the part of the drape the
    // rows above leave exposed: the upper rows' bodies hang over the drapes below them (11.2.8).
    const covers = new Map();
    for(const p of out.placements){
      const m = p.item;
      let x0 = p.x, x1 = p.x + MINI_DRAPE.w;
      if(m.medal && ctx.has(m.medal)){
        const s = await ctx.spec(m.medal);
        const attach = core.anchor(s, 'ribbon_attach') || { x: s.w / 2, y: 0 };
        x0 = Math.min(x0, p.x + MINI_DRAPE.w / 2 - attach.x); x1 = Math.max(x1, p.x + MINI_DRAPE.w / 2 - attach.x + s.w);
      }
      covers.set(p, { x0, x1, bottom: p.y + MINI_DRAPE.h + (hang.get(m) || 0) });
    }
    const DEVICE_GAP = 0.04;
    for(const p of out.placements){
      const m = p.item;
      // Upper rows hang over the drapes of the rows below them, so they draw later.
      const zBase = Z.medal + (out.rows.length - 1 - p.row) * 0.1 + p.z * 0.001;
      // Ribbon drape: the ribbon artwork as a vertical strip, cut to its V point.
      if(m.ribbonAsset && ctx.has(m.ribbonAsset)){
        const D = MINI_DRAPE;
        const clip = [{ x: p.x, y: p.y }, { x: p.x + D.w, y: p.y }, { x: p.x + D.w, y: p.y + D.h - D.point }, { x: p.x + D.w / 2, y: p.y + D.h }, { x: p.x, y: p.y + D.h - D.point }];
        ctx.layers.push({ type: 'asset', id: m.ribbonAsset, x: p.x, y: p.y, w: D.w, h: D.h, rotate: 0, origin: { x: p.x, y: p.y }, z: zBase, role: 'mini-drape', key: m.key, title: m.title, className: 'ribbonMini', clip });
      }
      if(m.medal && ctx.has(m.medal)){
        const s = await ctx.spec(m.medal);
        const attach = core.anchor(s, 'ribbon_attach') || { x: s.w / 2, y: 0 };
        const at = { x: p.x + MINI_DRAPE.w / 2, y: p.y + MINI_DRAPE.h };
        ctx.layers.push(Object.assign(core.placeAsset(s, { pieceAnchor: attach, at, z: zBase + 0.0005, role: 'mini-medal', key: m.key + ':medal', title: m.title }), { className: 'ribbonMini' }));
      }
      // Devices on the drape, vertical, precedence at the top (11.4.2). A device worn centred on
      // the ribbon (propeller, longevity numeral) is centred vertically, the others above and below.
      const own = (m.devices || []).filter(d => sizes[d]);
      const devs = m.centered ? own : awards.sortRun(own);
      // The devices go in the exposed part of the drape: from just below the lowest body of an upper
      // row that overlaps their column (plus a small gap) down to the drape's V point. With nothing
      // above, that is the whole drape.
      const colHalf = Math.max(0, ...devs.map(d => sizes[d].h)) / 2, colX = p.x + MINI_DRAPE.w / 2;
      let exposedTop = p.y;
      for(const q of out.placements){
        if(q.row >= p.row) continue;
        const c = covers.get(q);
        if(c.x1 > colX - colHalf && c.x0 < colX + colHalf) exposedTop = Math.max(exposedTop, c.bottom + DEVICE_GAP);
      }
      const exposedBottom = p.y + MINI_DRAPE.h - MINI_DRAPE.point;
      const midY = (Math.min(exposedTop, exposedBottom) + exposedBottom) / 2;
      // The stack's height is the first device's length plus a step for each further one; where less than
      // that is exposed, the step shrinks (devices nest, they never leave the exposed part).
      const lead = devs.length ? Math.max(...devs.map(d => sizes[d].w)) : 0;
      let step = 0.24 * MINI_DEVICE_SCALE;
      if(!m.centered && devs.length > 1) step = Math.max(0.05, Math.min(step, (exposedBottom - exposedTop - lead) / (devs.length - 1)));
      const y0 = midY - (devs.length - 1) * step / 2;
      devs.forEach((d, i) => {
        const sz = sizes[d];
        const cx = p.x + MINI_DRAPE.w / 2;
        const cy = m.centered ? midY + (i === 0 ? 0 : (i % 2 ? -1 : 1) * Math.ceil(i / 2) * step) : y0 + i * step;
        ctx.layers.push({ type: 'asset', id: d, x: cx - sz.w / 2, y: cy - sz.h / 2, w: sz.w, h: sz.h, rotate: 90, origin: { x: cx, y: cy }, z: zBase + 0.0007, role: 'device', key: `${m.key}:device:${i}` });
      });
    }
    return core.unionBounds(out.placements.map(p => ({ x: p.x, y: p.y, w: MINI_DRAPE.w, h: p.row === lowRow ? drawnBottom + shift - p.y : MINI_DRAPE.h + (hang.get(p.item) || 0) })));
  }

  // ---- The scene ---------------------------------------------------------------------------------

  // The scene frame is what is shown (LIVE9-3; Ethan: "the corporate field is significantly smaller than the abus for some reason. should be the same size"). A garment
  // sheet's box is larger than its cloth: the field coats stack the cap views in a top margin (the CFU's boonie hats above its ball and patrol caps, 12.7 in, the ABU's
  // 7.0 in) which the engine hides and re-places on the figure, so the whole box made the CFU frame 5.7 in taller than the ABU's for the same coat, and the page fits
  // the frame to its stage. The sheet, and every overlay drawn to its box, count as the cloth the sheet draws (measure-layout's GARMENT_FOOTPRINT: the figure, the flat
  // sleeves, the tapes) within the box; the cap views the build wears are layers of their own (hat-view-bounds), the sleeve views and every other piece count as before.
  function measureLayoutModule(){
    if(typeof module === 'object' && module.exports) return require('./measure-layout.js');
    const g = typeof self !== 'undefined' ? self : globalThis;
    return g.CAPUBEngine && g.CAPUBEngine.measureLayout;
  }
  function shownBounds(ctx){
    const ML = measureLayoutModule(), base = ctx.base;
    let cloth = null;
    if(ML && ML.clothBoxes && base){
      const g = ctx.layers.find(l => l.type === 'asset' && l.role === 'garment' && l.id === base.id);
      const boxes = g ? ML.clothBoxes({ layers: [g] }) : [];
      if(boxes.length){
        const u = core.unionBounds(boxes);
        const x0 = Math.max(g.x, u.x), y0 = Math.max(g.y, u.y), x1 = Math.min(g.x + g.w, u.x + u.w), y1 = Math.min(g.y + g.h, u.y + u.h);
        cloth = { sheet: g, box: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } };
      }
    }
    const sameBox = l => cloth && l.type === 'asset' && (l.role === 'garment' || l.role === 'garment-layer' || l.role === 'garment-foreground') && !(l.rotate || 0)
      && Math.abs(l.x - cloth.sheet.x) < 1e-6 && Math.abs(l.y - cloth.sheet.y) < 1e-6 && Math.abs(l.w - cloth.sheet.w) < 1e-6 && Math.abs(l.h - cloth.sheet.h) < 1e-6;
    return core.unionBounds(ctx.layers.filter(l => !l.noBounds).map(l => (sameBox(l) ? cloth.box : core.layerBounds(l))));
  }

  function finish(ctx, title){
    settleConflicts(ctx);
    const bounds = shownBounds(ctx);
    return { title, layers: ctx.layers, bounds, notes: ctx.notes, conflicts: ctx.conflicts || [], garment: ctx.base && ctx.base.id };
  }

  // ---- Badge conflicts and the member's choice ------------------------------------------------------------------------------------

  // A position with more than one place holds the member's badges slot by slot: build.badgeChoices[position] is { [slotKey]: badgeId }, one
  // entry per place ("left-pocket", "right-pocket", "over-nametag", "left", "right"...). The older form, a single badge id, reads as the first slot.
  // `list` is the candidates in the order the engine shows them by default, `slots` the places [{ key, label }] in the order the layout fills them
  // (one slot for a position that takes one badge). The slot's own pick goes there, a badge in no slot twice (a later slot that names a badge
  // already placed is ignored); the slots nobody picked take the unplaced candidates in the default order. Returns the badge for each slot, in
  // slot order, and reports the position to the page: { position, label, limit, candidates: [{ id, title, family }], shown: [ids], choice: id | null
  // (the first slot's pick), slots: [{ key, label, choice, badge, shown }], note }. finish() later sets `shown` from the badges actually drawn.
  function chooseBadges(ctx, position, label, list, slots, opts){
    const raw = ctx.build && ctx.build.badgeChoices && ctx.build.badgeChoices[position];
    const picks = typeof raw === 'string' ? (slots[0] ? { [slots[0].key]: raw } : {}) : (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {});
    const used = new Set(), picked = {};
    for(const sl of slots){
      const item = typeof picks[sl.key] === 'string' ? list.find(x => x.id === picks[sl.key]) : null;
      if(item && !used.has(item.id)){ picked[sl.key] = item; used.add(item.id); }
    }
    const spare = list.filter(x => !used.has(x.id));
    const ordered = slots.map(sl => picked[sl.key] || spare.shift() || null);
    const first = picked[slots[0] && slots[0].key];
    const c = {
      position, label, limit: slots.length,
      candidates: list.map(x => ({ id: x.id, title: x.title || x.id, family: x.family || null })),
      shown: ordered.filter(Boolean).map(x => x.id),
      choice: first ? first.id : null,
      slots: slots.map((sl, i) => ({ key: sl.key, label: sl.label, choice: picked[sl.key] ? picked[sl.key].id : null, badge: ordered[i] ? ordered[i].id : null, shown: !!ordered[i] })),
      note: (opts && opts.note) || ''
    };
    const key = JSON.stringify([c.position, c.candidates.map(x => x.id)]);
    ctx.conflicts = ctx.conflicts || [];
    if(!ctx.conflicts.some(x => JSON.stringify([x.position, x.candidates.map(y => y.id)]) === key)) ctx.conflicts.push(c);
    return ordered.filter(Boolean);
  }

  // The one-place form the profiles used before the slots (a position that takes one badge): `preferred` moves the member's pick to the front of
  // the list, `reportBadgeConflict` reports the position with its one place. Both read build.badgeChoices[position] as a badge id or as { only: id }.
  function preferred(list, id){
    const i = id ? list.findIndex(x => x.id === id) : -1;
    return i > 0 ? [list[i], ...list.slice(0, i), ...list.slice(i + 1)] : list;
  }
  function reportBadgeConflict(ctx, position, label, list, ordered, limit){
    const slots = Array.from({ length: limit || 1 }, (_, i) => ({ key: limit > 1 ? 'slot' + (i + 1) : 'only', label }));
    chooseBadges(ctx, position, label, list, slots);
  }

  // What the drawing shows of each reported position: a badge counts as shown when a badge layer for it was drawn (a badge the layout had no
  // place for, or whose art is missing, is not shown). Left as planned when the scene drew no badge at all.
  function settleConflicts(ctx){
    const drawn = new Set();
    for(const l of ctx.layers) if(l.role === 'badge' && /^badge:/.test(l.key || '')) drawn.add(l.key.split(':')[1]);
    if(!drawn.size) return;
    for(const c of ctx.conflicts || []){
      for(const sl of c.slots || []) sl.shown = !!sl.badge && drawn.has(sl.badge);
      c.shown = (c.slots || []).filter(sl => sl.shown).map(sl => sl.badge);
    }
  }

  return { Z, createContext, inchesLabel, stackUp, centerOn, fitIn, fitRaster, nameText, plateName, textAdvance, CAP_HEIGHT, drawRack, drawMiniMedals, rectHitsPolygon, finish, MINI_DRAPE, chooseBadges, preferred, reportBadgeConflict };
});
