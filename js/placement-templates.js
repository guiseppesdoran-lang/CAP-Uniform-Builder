// Placement templates (LIVE13 E64). Ethan: "paper/3d printed helpers. like if someone prints out a sheet of paper and
// puts it on their blues they just put stuff on top and that will build the holes. same with the 3d printing thing. it
// will give them a custom 3d printed file for the blues to put all of their badges and stuff on. one for each side if
// applicable."
//
// From the scene the engine composed for the current build (every piece's box in scene inches, its rotation, role and
// key) and the garment sheet's landmarks (images/*.spec.json), this makes, for each garment side that carries items:
//   - a 1:1 paper stencil (SVG, and a PDF written here with no library): every item's footprint as a cut line with a scissor
//     mark, so the paper left is the space between the items and its holes show where each sits; the pins as ticks outside
//     each hole, the garment edges to line the paper up on, a 1 in / 25 mm scale bar; one US Letter or A4 page when the side
//     fits one, else split between the holes and tiled with crop marks;
//   - 3D-print aligners (binary STL, js/placement-stl.js): for each side that carries pinned items one or two thin flat plates, 2 mm thick,
//     printed flat without supports, made of bars that stop straight on the garment's edge (the pocket's top edge, the button line, the
//     collar, lapel or shoulder board edge) and hold each item in a cradle open on one side, with the address and what the plate is for
//     raised on it; and a set of spacer gauges, one for each gap the aligners use. No pin holes anywhere.
// Pin spacing is not in the catalog: pins are estimated from each item's width (PIN_RULE); the aligners do not use pins.
//
// Loads as a classic script (window.CAPUBPlacementTemplates, with the "Placement templates" window) and as a CommonJS
// module for the node tests (the builders only).
(function(root, factory){
  const stl = (typeof module === 'object' && module.exports) ? require('./placement-stl.js') : root.CAPUBPlacementSTL;
  const api = factory(stl);
  if(typeof module === 'object' && module.exports) module.exports = api;
  else { root.CAPUBPlacementTemplates = api; if(typeof document !== 'undefined') api.install(); }
})(typeof self !== 'undefined' ? self : this, function(STL){
  'use strict';

  const MM = 25.4;
  const PIN_INSET = 0.25;        // in from each end of an item wider than PIN_WIDE
  const PIN_WIDE = 1;            // wider than this: two pins; else one centre pin
  const MARGIN = 0.5;            // paper/plate margin around a side's items, in
  const OVERHANG = 0.3;          // plate/paper beyond a registration line it was extended to, in
    const BUTTON_R_EST = 0.25;     // button radius when the sheet gives only the centre, in (estimate)
  const PIN_RULE = 'Pin ticks are estimated from each item\'s width: 1/4 in in from each end on its centerline for items wider than 1 in, the center for smaller ones; a ribbon or miniature medal rack: the mounting bar\'s two pins, 1/4 in in from the ends of its widest row. Check them against your own items.';
  const PAPERS = { letter: { w: 8.5, h: 11, label: 'US Letter' }, a4: { w: 210 / MM, h: 297 / MM, label: 'A4' } };
  const FIELD_UNIFORMS = new Set(['abu', 'ocp', 'corporate_field', 'flight_suit', 'corporate_flight_suit', 'polo']);

  // ---- small geometry ------------------------------------------------------------------------------

  const rot = (p, o, deg) => {
    const r = (deg || 0) * Math.PI / 180, dx = p.x - o.x, dy = p.y - o.y;
    return { x: o.x + dx * Math.cos(r) - dy * Math.sin(r), y: o.y + dx * Math.sin(r) + dy * Math.cos(r) };
  };
  const boxOf = pts => { const xs = pts.map(p => p.x), ys = pts.map(p => p.y); const x = Math.min(...xs), y = Math.min(...ys); return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }; };
  const unionBox = boxes => boxOf(boxes.flatMap(b => [{ x: b.x, y: b.y }, { x: b.x + b.w, y: b.y + b.h }]));
  const grow = (b, m) => ({ x: b.x - m, y: b.y - m, w: b.w + 2 * m, h: b.h + 2 * m });
  const r4 = n => Math.round(n * 10000) / 10000;
  // Liang-Barsky: the part of segment pq inside box b, or null.
  function clipSeg(p, q, b){
    let t0 = 0, t1 = 1;
    const dx = q.x - p.x, dy = q.y - p.y;
    for(const [pp, qq] of [[-dx, p.x - b.x], [dx, b.x + b.w - p.x], [-dy, p.y - b.y], [dy, b.y + b.h - p.y]]){
      if(Math.abs(pp) < 1e-12){ if(qq < 0) return null; continue; }
      const t = qq / pp;
      if(pp < 0){ if(t > t1) return null; if(t > t0) t0 = t; } else { if(t < t0) return null; if(t < t1) t1 = t; }
    }
    if(t1 - t0 < 1e-9) return null;
    return [{ x: p.x + dx * t0, y: p.y + dy * t0 }, { x: p.x + dx * t1, y: p.y + dy * t1 }];
  }
  const segLen = s => Math.hypot(s[1].x - s[0].x, s[1].y - s[0].y);

  // A placed layer's corners, centre and local axes (rotation about layer.origin, as js/engine/core.js layerBounds).
  function frameOf(l){
    const o = l.origin || { x: l.x, y: l.y }, deg = l.rotate || 0;
    const corners = [[l.x, l.y], [l.x + l.w, l.y], [l.x + l.w, l.y + l.h], [l.x, l.y + l.h]].map(([x, y]) => rot({ x, y }, o, deg));
    const c = rot({ x: l.x + l.w / 2, y: l.y + l.h / 2 }, o, deg);
    const r = deg * Math.PI / 180;
    return { corners, c, w: l.w, h: l.h, deg, u: { x: Math.cos(r), y: Math.sin(r) } };
  }
  function pinsFor(f){
    if(f.w > PIN_WIDE) return [-1, 1].map(s => ({ x: f.c.x + s * (f.w / 2 - PIN_INSET) * f.u.x, y: f.c.y + s * (f.w / 2 - PIN_INSET) * f.u.y }));
    return [{ x: f.c.x, y: f.c.y }];
  }

  // ---- names ---------------------------------------------------------------------------------------

  const SMALL = new Set(['of', 'the', 'and', 'for', 'a', 'an', 'in', 'on', 'to']);
  function humanize(id){
    return String(id || '').replace(/^(ribbon|medal|rank|badge|enamel)[-:_]/, '').replace(/[-_]+/g, ' ').replace(/\bachievment\b/gi, 'achievement').trim()
      .split(' ').map((w, i) => /^(cap|usaf|af|afa|afsa|vfw|nco|us|es|rotc|jrotc|sar|iace)$/i.test(w) ? w.toUpperCase() : (i && SMALL.has(w.toLowerCase()) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1))).join(' ');
  }
  const gradeName = id => 'Grade insignia (' + String(id).replace(/^rank-/, '').replace(/-(metal|cloth|bordered|regular|miniature|thread|bullion)\b/g, '').replace(/-/g, ' ').trim() + ')';
  function garmentName(spec){
    const n = String((spec && spec.raw && spec.raw.name) || (spec && spec.id) || 'Garment');
    return n.split(/[:,(]/)[0].trim();
  }

  // ---- what is worn, from the scene ----------------------------------------------------------------

  // Every asset id whose spec the plan reads: the garment sheets, the lapel overlays and the cords.
  function specIds(scene){
    const ids = new Set();
    for(const l of scene.layers || []){
      if(l.type !== 'asset') continue;
      if(l.role === 'garment' || l.role === 'cord' || l.role === 'epaulet-top' || (l.role === 'garment-layer' && /-(lapel-(us|cap)|cord-)/.test(l.id))) ids.add(l.id);
    }
    return [...ids];
  }
  async function loadSpecs(scene, loadSpec){
    const map = new Map();
    for(const id of specIds(scene)){ try{ map.set(id, await loadSpec(id)); }catch(e){ /* a missing spec only loses its references */ } }
    return map;
  }

  function attachFor(kind, layer, meta){
    const field = FIELD_UNIFORMS.has(meta.uniform);
    if(kind === 'grade') return /metal/.test(layer.id) ? 'pin' : /cloth/.test(layer.id) ? 'sew' : null;
    if(kind === 'badge') return field || /-field$/.test(layer.id) ? 'sew' : 'pin';
    if(kind === 'nametag') return field ? 'sew' : 'pin';
    if(kind === 'tape') return 'sew';
    return 'pin';
  }

  // Ribbons (or miniature medals) side by side in rows, one mounting bar: rows grouped by their top edge.
  function rackItem(kind, parts, extra, meta){
    const rows = [];
    for(const p of parts.slice().sort((a, b) => a.y - b.y || a.x - b.x)){
      const row = rows.find(r => Math.abs(r.y - p.y) < 0.02);
      if(row) row.parts.push(p); else rows.push({ y: p.y, parts: [p] });
    }
    rows.forEach(r => { r.parts.sort((a, b) => a.x - b.x); r.box = unionBox(r.parts.map(p => ({ x: p.x, y: p.y, w: p.w, h: p.h }))); });
    const all = unionBox([...parts, ...(extra || [])].map(p => ({ x: p.x, y: p.y, w: p.w, h: p.h })));
    const mid = all.y + all.h / 2;
    const widest = Math.max(...rows.map(r => r.box.w));
    const bar = rows.filter(r => r.box.w > widest - 0.01).sort((a, b) => Math.abs(a.box.y + a.box.h / 2 - mid) - Math.abs(b.box.y + b.box.h / 2 - mid))[0];
    const py = bar.box.y + bar.box.h / 2;
    const pins = [{ x: bar.box.x + PIN_INSET, y: py }, { x: bar.box.x + bar.box.w - PIN_INSET, y: py }];
    // Ribbon rows abut, so the rack's outline is the stepped union of its rows; a miniature rack is drawn as its box.
    const abut = kind === 'rack' && rows.every((r, i) => !i || Math.abs(rows[i - 1].box.y + rows[i - 1].box.h - r.box.y) < 0.02);
    const outline = abut ? steppedOutline(rows.map(r => r.box)) : [{ x: all.x, y: all.y }, { x: all.x + all.w, y: all.y }, { x: all.x + all.w, y: all.y + all.h }, { x: all.x, y: all.y + all.h }];
    const names = rows.map((r, i) => `row ${i + 1}: ${r.parts.map(p => p.name).join(', ')}`);
    const count = parts.length;
    return {
      kind, attach: 'pin', name: kind === 'rack' ? `Ribbon rack, ${count} ribbon${count === 1 ? '' : 's'}` : `Miniature medals, ${count}`,
      outline, cut: [{ x: all.x, y: all.y }, { x: all.x + all.w, y: all.y }, { x: all.x + all.w, y: all.y + all.h }, { x: all.x, y: all.y + all.h }],
      parts: [...parts, ...(extra || [])].map(p => p.corners), c: { x: all.x + all.w / 2, y: all.y + all.h / 2 }, box: all, pins,
      legend: (kind === 'rack' ? 'Ribbon rack, top row first: ' : 'Miniature medals, top row first: ') + names.join('; '), meta
    };
  }
  // The outline of boxes stacked top to bottom (each row's top on the row above's bottom), clockwise in scene axes.
  function steppedOutline(rows){
    const right = [], left = [];
    rows.forEach((r, i) => {
      const top = r.y, bot = r.y + r.h;
      right.push({ x: r.x + r.w, y: top }, { x: r.x + r.w, y: bot });
      left.push({ x: r.x, y: top }, { x: r.x, y: bot });
      void i;
    });
    const ring = [...right, ...left.reverse()];
    const out = [];
    for(const p of ring){ const q = out[out.length - 1]; if(!q || Math.abs(q.x - p.x) > 1e-6 || Math.abs(q.y - p.y) > 1e-6) out.push(p); }
    const clean = [];
    for(let i = 0; i < out.length; i++){
      const a = out[(i - 1 + out.length) % out.length], b = out[i], c = out[(i + 1) % out.length];
      if(Math.abs((b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)) > 1e-9) clean.push(b);
    }
    return clean;
  }

  function plainItem(kind, name, layer, meta, extra){
    const f = frameOf(layer);
    const attach = attachFor(kind, layer, meta);
    if(!attach) return null;
    return Object.assign({ kind, name, attach, outline: f.corners, cut: f.corners, parts: [], c: f.c, box: boxOf(f.corners), pins: attach === 'pin' ? pinsFor(f) : [], frame: f }, extra || {});
  }

  // The items of the scene, each with its zone (chest, collar, shoulder), wearer's side and garment.
  function collectItems(scene, specs, meta){
    const garments = (scene.layers || []).filter(l => l.role === 'garment' && l.type === 'asset').map((l, i) => {
      const spec = specs.get(l.id) || null;
      const top = spec && spec.anchors && spec.anchors.top_center;
      return { index: i, layer: l, spec, x: l.x, y: l.y, w: l.w, h: l.h, cx: l.x + (top ? top.x : l.w / 2), name: garmentName(spec) };
    });
    const garmentAt = p => garments.find(g => p.x >= g.x && p.x <= g.x + g.w) || garments[0];
    const items = [], marks = [];
    const sideOf = (p, g) => p.x > g.cx ? 'left' : 'right'; // the scene is drawn facing the wearer
    const push = (it, zone, sideHint) => {
      if(!it) return;
      const g = garmentAt(it.c);
      it.zone = zone; it.side = sideHint || sideOf(it.c, g); it.garment = g ? g.index : 0;
      items.push(it);
    };
    // A layer flagged `meme` (the chaplain patch as ICL 26-14 is written, 2 ft square) is a joke, not a placement: no stencil or aligner item.
    const L = (scene.layers || []).filter(l => !l.meme);
    // Ribbon racks and miniature medals, one per garment side.
    const groupBySide = (ls, fn) => {
      const m = new Map();
      for(const l of ls){ const f = frameOf(l); const g = garmentAt(f.c); const k = (g ? g.index : 0) + ':' + sideOf(f.c, g); if(!m.has(k)) m.set(k, []); m.get(k).push(fn(l, f)); }
      return m;
    };
    const ribbonPart = (l, f) => ({ x: l.x, y: l.y, w: l.w, h: l.h, corners: f.corners, name: humanize(l.title || l.id) });
    for(const parts of groupBySide(L.filter(l => l.role === 'ribbon'), ribbonPart).values()){
      // Racks are split where rows stop touching (two racks on one side).
      const sorted = parts.slice().sort((a, b) => a.y - b.y);
      let cur = [sorted[0]];
      const flush = () => push(rackItem('rack', cur, null, meta), 'chest');
      for(let i = 1; i < sorted.length; i++){
        const prevBottom = Math.max(...cur.map(p => p.y + p.h));
        if(sorted[i].y > prevBottom + 0.05){ flush(); cur = []; }
        cur.push(sorted[i]);
      }
      flush();
    }
    const drapes = groupBySide(L.filter(l => l.role === 'mini-drape' || l.role === 'mini'), ribbonPart);
    const medals = groupBySide(L.filter(l => l.role === 'mini-medal'), ribbonPart);
    for(const [k, parts] of drapes) push(rackItem('minis', parts, medals.get(k) || [], meta), 'chest');
    for(const l of L){
      const key = String(l.key || '');
      if(l.role === 'badge') push(plainItem('badge', l.title || humanize(l.id), l, meta), 'chest');
      else if(l.role === 'nametag') push(plainItem('nametag', FIELD_UNIFORMS.has(meta.uniform) ? 'Name tape' : 'Nameplate', l, meta), 'chest');
      else if(l.role === 'clear' && key === 'clear:nametag') push(plainItem('nametag', 'Nameplate', l, meta), 'chest');
      else if(l.role === 'clear' && key === 'clear:name_tape') push(plainItem('tape', 'Name tape', l, meta), 'chest');
      else if(l.role === 'clear' && key === 'clear:cap_tape') push(plainItem('tape', 'CAP tape', l, meta), 'chest');
      else if(l.role === 'grade' && /^grade:(left|right)$/.test(key)) push(plainItem('grade', gradeName(l.id), l, meta), 'collar', key.slice(6));
      else if(l.role === 'grade' && /^collar:(left|right)$/.test(key)) push(plainItem('collar', 'CAP cutout insignia', l, meta), 'collar', key.slice(7));
      else if(l.role === 'grade' && key === 'grade:chest') push(plainItem('grade', gradeName(l.id), l, meta), 'chest');
      else if(l.role === 'grade' && /^grade:top-(left|right)$/.test(key)){
        const it = plainItem('grade', gradeName(l.id), l, meta);
        if(it && it.attach === 'pin'){
          // The board (epaulet) seen from above, from its sheet's 'board' landmark, else the drawing's box.
          const ep = L.find(e => e.role === 'epaulet-top' && e.key === 'epaulet-top:' + key.slice(10));
          if(ep){
            const es = specs.get(ep.id), lm = es && es.landmarks && es.landmarks.board, k = es ? ep.w / es.w : 1, kh = es ? ep.h / es.h : 1;
            const o = ep.origin || { x: ep.x, y: ep.y };
            const box = lm && 'w' in lm ? { x: ep.x + lm.x * k, y: ep.y + lm.y * kh, w: lm.w * k, h: lm.h * kh } : { x: ep.x, y: ep.y, w: ep.w, h: ep.h };
            it.epaulet = [[box.x, box.y], [box.x + box.w, box.y], [box.x + box.w, box.y + box.h], [box.x, box.y + box.h]].map(([x, y]) => rot({ x, y }, o, ep.rotate || 0));
            const btn = es && es.anchors && es.anchors.button_end_center;
            if(btn) it.epauletButton = rot({ x: ep.x + btn.x * k, y: ep.y + btn.y * kh }, o, ep.rotate || 0);
          }
          push(it, 'shoulder', key.slice(10));
        }
      } else if(l.role === 'garment-layer' && l.onlyGroups && l.onlyGroups.length === 1 && /^lapel-(us|cap)-(left|right)$/.test(l.onlyGroups[0])){
        const spec = specs.get(l.id);
        const lm = spec && spec.landmarks[l.onlyGroups[0].replace(/-/g, '_')];
        if(lm && 'w' in lm){
          const box = { x: lm.x + l.x, y: lm.y + l.y, w: lm.w, h: lm.h };
          const fake = { x: box.x, y: box.y, w: box.w, h: box.h, rotate: 0, origin: { x: box.x, y: box.y }, id: l.id };
          const us = /lapel-us/.test(l.onlyGroups[0]);
          push(plainItem('lapel', us ? '"U.S." lapel insignia' : 'CAP cutout lapel insignia', fake, meta), 'collar', /-left$/.test(l.onlyGroups[0]) ? 'left' : 'right');
        }
      } else if((l.role === 'garment-layer' && /-cord-/.test(l.id)) || l.role === 'cord'){
        const spec = specs.get(l.id);
        if(!spec) continue;
        const at = name => { const a = spec.anchors[name]; return a ? rot({ x: l.x + a.x * (l.w / spec.w), y: l.y + a.y * (l.h / spec.h) }, l.origin || { x: l.x, y: l.y }, l.rotate || 0) : null; };
        const end = at('cord_end'), start = at('cord_start') || at('shoulder_seam_attach_neck_end');
        if(end) marks.push({ kind: 'cord', name: 'Shoulder cord: the end loop fastens here', p: end });
        if(start) marks.push({ kind: 'cord', name: 'Shoulder cord: under the epaulet at the shoulder seam', p: start });
      }
    }
    return { garments, items, marks };
  }

  // ---- garment references (registration edges) -----------------------------------------------------

  const POCKET_RE = /^(welt_pocket|breast_pocket|pocket|pocket_(left|right)|chest_pocket_(left|right)|flap_pocket_(left|right))$/;
  const FLAP_RE = /^chest_flap_(left|right)$/;
  function references(g, scene){
    const s = g.spec;
    if(!s) return [];
    const off = p => ({ x: p.x + g.x, y: p.y + g.y });
    const refs = [];
    const lm = s.landmarks || {};
    const rectLines = r => ({ top: [off({ x: r.x, y: r.y }), off({ x: r.x + r.w, y: r.y })], left: [off({ x: r.x, y: r.y }), off({ x: r.x, y: r.y + r.h })], right: [off({ x: r.x + r.w, y: r.y }), off({ x: r.x + r.w, y: r.y + r.h })] });
    const asBox = v => v && v.points ? boxOf(v.points) : (v && typeof v === 'object' && 'w' in v ? v : null);
    const flaps = Object.keys(lm).filter(k => FLAP_RE.test(k)).map(k => ({ k, b: asBox(lm[k]) })).filter(f => f.b);
    for(const k of Object.keys(lm)){
      const b = asBox(lm[k]);
      if(!b) continue;
      if(POCKET_RE.test(k)){
        const L = rectLines(b);
        const covered = flaps.some(f => f.b.x < b.x + b.w && b.x < f.b.x + f.b.w && b.y >= f.b.y - 0.05 && b.y <= f.b.y + f.b.h);
        if(!covered) refs.push({ zone: 'chest', kind: 'pocket-top', label: k === 'welt_pocket' ? 'welt pocket top edge' : 'pocket top edge', segs: [L.top], lip: true, extend: 'pocket' });
        if(!covered) refs.push({ zone: 'chest', kind: 'pocket-side', label: 'pocket side edge', segs: [L.left, L.right], lip: false });
      } else if(FLAP_RE.test(k)){
        const L = rectLines(b);
        refs.push({ zone: 'chest', kind: 'pocket-top', label: 'pocket flap top edge', segs: [L.top], lip: true, extend: 'pocket' });
        refs.push({ zone: 'chest', kind: 'pocket-side', label: 'pocket flap side edge', segs: [L.left, L.right], lip: false });
      } else if(k === 'placket'){
        const L = rectLines(b);
        refs.push({ zone: 'chest', kind: 'button-line', label: 'placket edge', segs: [L.left, L.right], lip: true, extend: 'button' });
      }
    }
    // Buttons: a line through the centres of each column of buttons, and the buttons themselves.
    const buttons = [];
    for(const k of Object.keys(lm)) if(/^button(_(left|right))?_\d+$/.test(k) && asBox(lm[k])){ const b = asBox(lm[k]); buttons.push({ x: b.x + b.w / 2, y: b.y + b.h / 2, r: b.w / 2 }); }
    if(!buttons.length) for(const k of Object.keys(s.anchors || {})) if(/^button_\d+_center$/.test(k)) buttons.push({ x: s.anchors[k].x, y: s.anchors[k].y, r: null });
    const cols = [];
    for(const b of buttons){ const c = cols.find(c2 => Math.abs(c2.x - b.x) < 0.3); if(c) c.list.push(b); else cols.push({ x: b.x, list: [b] }); }
    for(const c of cols){
      const ys = c.list.map(b => b.y), x = c.list.reduce((a, b) => a + b.x, 0) / c.list.length;
      const r = c.list[0].r;
      refs.push({ zone: 'chest', kind: 'button-line', label: 'button line (center of the buttons)', segs: [[off({ x, y: Math.min(...ys) - 3 }), off({ x, y: Math.max(...ys) + 3 })]], circles: c.list.map(b => Object.assign(off(b), { r: b.r || BUTTON_R_EST, estimated: !b.r })), lip: true, lipOffset: r || BUTTON_R_EST, extend: 'button' });
    }
    const poly = (k, closed) => { const v = lm[k]; if(!v || !v.points) return []; const pts = v.points.map(off); const segs = []; for(let i = 0; i < pts.length - (closed ? 0 : 1); i++) segs.push([pts[i], pts[(i + 1) % pts.length]]); return segs; };
    for(const k of Object.keys(lm)){
      if(/^(lapel|shawl)_(left|right)$/.test(k)) refs.push({ zone: 'both', kind: 'lapel-edge', label: 'lapel edge', segs: poly(k, true), lip: true });
      else if(/^(shoulder|arm_seam|armhole_seam)_(left|right)$/.test(k)) refs.push({ zone: 'chest', kind: 'seam', label: /shoulder/.test(k) ? 'shoulder seam' : 'arm seam', segs: poly(k, false), lip: false });
    }
    // The collar the sheet draws: the closed collar when the scene hides the open one, else the open collar.
    const base = g.layer, hidden = (base.hideGroups || []).join(' ');
    const closed = /collar-open/.test(hidden) && !/collar-closed/.test(hidden);
    for(const k of Object.keys(lm)){
      const isCollar = closed ? /^collar_closed_(left|right)$/.test(k) : /^collar_(left|right)$/.test(k);
      if(isCollar || /^collar_(leading|bottom)_edge_(left|right)$/.test(k) || /^collar_lapel_(left|right)$/.test(k) || k === 'collar') refs.push({ zone: 'collar', kind: 'collar-edge', label: 'collar edge', segs: poly(k, /^collar(_closed)?_(left|right)$|^collar$/.test(k)), lip: true, extend: 'collar' });
    }
    for(const side of ['left', 'right']){
      const a = s.anchors[`gorge_seam_${side}_p1`], b = s.anchors[`gorge_seam_${side}_p2`];
      if(a && b) refs.push({ zone: 'collar', kind: 'gorge-seam', label: 'gorge seam (collar to lapel)', segs: [[off(a), off(b)]], lip: false, extend: 'collar' });
      for(const n of [`shoulder_seam_${side}`, `seam_top_center_${side}`]){
        const p = s.anchors[n];
        if(p) refs.push({ zone: 'chest', kind: 'seam-point', label: 'shoulder seam end', segs: [], points: [off(p)], lip: false });
      }
    }
    void scene;
    return refs;
  }

  // ---- sides -----------------------------------------------------------------------------------------

  const ZONE_LABEL = { chest: 'chest', collar: 'collar', shoulder: 'shoulder (epaulet)' };
  function sideLabel(zone, side, items, garments, gi){
    const lapel = zone === 'collar' && items.some(i => i.kind === 'lapel');
    const z = lapel ? 'lapel' : ZONE_LABEL[zone];
    const pre = garments.length > 1 ? garments[gi].name + ': w' : 'W';
    return `${pre}earer's ${side} ${z}`;
  }

  // The sides of the garment that carry items, each with its items, its registration references (clipped to the
  // side's region) and its region (scene inches). attach: 'pin' when any item is pinned (paper and 3D aligner), else 'sew'
  // (paper only, a sewing guide).
  function sidesFrom(collected, scene){
    const { garments, items, marks } = collected;
    const groups = new Map();
    for(const it of items){
      const k = `${it.garment}:${it.zone}:${it.side}`;
      if(!groups.has(k)) groups.set(k, []);
      groups.get(k).push(it);
    }
    const sides = [];
    const order = { chest: 0, collar: 1, shoulder: 2 };
    for(const [k, list] of [...groups].sort((a, b) => a[0].split(':')[0] - b[0].split(':')[0] || order[a[1][0].zone] - order[b[1][0].zone] || (a[1][0].side === 'left' ? -1 : 1))){
      const [gi, zone, side] = k.split(':');
      const g = garments[+gi];
      const itemsBox = unionBox(list.map(i => i.box));
      let region = grow(itemsBox, zone === 'chest' ? MARGIN : 0.4);
      const refsAll = zone === 'shoulder' ? shoulderRefs(list) : references(g, scene).filter(r => r.zone === zone || r.zone === 'both');
      const centre = { x: itemsBox.x + itemsBox.w / 2, y: itemsBox.y + itemsBox.h / 2 };
      // Pull the region out to the nearest registration lines: the pocket top first; the button line or placket only
      // where there is no pocket; the collar edge for collar pieces. Lines on the other side of the garment are skipped.
      const onSide = (seg, r) => zone === 'shoulder' || ((seg[0].x + seg[1].x) / 2 > g.cx) === (side === 'left') || (r.kind === 'button-line' && Math.abs((seg[0].x + seg[1].x) / 2 - g.cx) < 1.5);
      const extendBy = (want, near) => {
        let hit = false;
        for(const r of refsAll.filter(x => x.extend === want || (x.kind === 'lapel-edge' && want === (zone === 'chest' ? 'lapel' : 'collar')))){
          for(const seg of r.segs){
            if(!onSide(seg, r)) continue;
            // Reach across to a line, not along it: a mostly vertical line is taken only beside the items' height,
            // a mostly horizontal one only over their width.
            const vertical = Math.abs(seg[1].x - seg[0].x) < Math.abs(seg[1].y - seg[0].y);
            const band = vertical ? { x: itemsBox.x - near, y: itemsBox.y - 0.25, w: itemsBox.w + 2 * near, h: itemsBox.h + 0.5 }
              : { x: itemsBox.x - 0.25, y: itemsBox.y - near, w: itemsBox.w + 0.5, h: itemsBox.h + 2 * near };
            const c = clipSeg(seg[0], seg[1], band);
            if(!c || segLen(c) < 0.5) continue;
            const lo = r.kind === 'button-line' && r.lipOffset ? r.lipOffset : 0;
            region = unionBox([region, grow(boxOf(c), OVERHANG + lo)]);
            hit = true;
          }
        }
        return hit;
      };
      if(zone === 'chest'){ if(!extendBy('pocket', 2.0) && !extendBy('lapel', 2.5)) extendBy('button', 3.5); }
      else if(zone === 'collar') extendBy('collar', 1.5);
      else if(zone === 'shoulder') for(const r of refsAll.filter(x => x.extend === 'board')) region = unionBox([region, grow(boxOf(r.segs.map(sg => sg[0])), OVERHANG)]);
      // Cord attachment points near the chest pieces.
      const sideMarks = zone === 'chest' ? marks.filter(m => { const near = grow(itemsBox, 2.0); return m.p.x >= near.x && m.p.x <= near.x + near.w && m.p.y >= near.y && m.p.y <= near.y + near.h; }) : [];
      for(const m of sideMarks) region = unionBox([region, grow({ x: m.p.x, y: m.p.y, w: 0, h: 0 }, 0.4)]);
      const refs = [];
      for(const r of refsAll){
        const segs = r.segs.map(s => clipSeg(s[0], s[1], region)).filter(s => s && segLen(s) > 0.05);
        const circles = (r.circles || []).filter(c => c.x - c.r >= region.x && c.x + c.r <= region.x + region.w && c.y - c.r >= region.y && c.y + c.r <= region.y + region.h);
        const points = (r.points || []).filter(p => p.x >= region.x && p.x <= region.x + region.w && p.y >= region.y && p.y <= region.y + region.h);
        if(segs.length || circles.length || points.length) refs.push(Object.assign({}, r, { segs, circles, points }));
      }
      const attach = list.some(i => i.attach === 'pin') ? 'pin' : 'sew';
      const key = `${garments.length > 1 ? 'g' + gi + '-' : ''}${side}-${zone === 'collar' && list.some(i => i.kind === 'lapel') ? 'lapel' : zone}`;
      sides.push({ key, label: sideLabel(zone, side, list, garments, +gi), zone, side, garment: g.name, attach, items: list, refs, marks: sideMarks, region: { x: r4(region.x), y: r4(region.y), w: r4(region.w), h: r4(region.h) }, centre });
    }
    return sides;
  }
  function shoulderRefs(list){
    const refs = [];
    for(const it of list) if(it.epaulet){
      const e = it.epaulet;
      refs.push({ zone: 'shoulder', kind: 'epaulet-edge', label: 'shoulder board edge (seen from above)', segs: e.map((p, i) => [p, e[(i + 1) % e.length]]), lip: true, extend: 'board' });
      if(it.epauletButton) refs.push({ zone: 'shoulder', kind: 'seam-point', label: 'board button', segs: [], points: [it.epauletButton], lip: false });
    }
    return refs;
  }

  // Everything about the current build the templates need. loadSpec(id) resolves to an engine spec (store.load).
  async function plan(scene, loadSpec, meta){
    const specs = await loadSpecs(scene, loadSpec);
    const collected = collectItems(scene, specs, meta || {});
    const sides = sidesFrom(collected, scene);
    return { meta: meta || {}, sides, garments: collected.garments.map(g => g.name), title: scene.title || '' };
  }

  // ---- paper: one display list, written as SVG and as PDF ---------------------------------------------
  //
  // The sheet is a stencil (Doran, 2026-11-02: "a cutout of the space between the badges or ribbons, not the actual ribbons and
  // badge space themselves"). Every item's footprint (a ribbon rack as one rectangle) is a solid cut line with a scissor mark at
  // its top-left corner; cut out, the paper that remains is the space between the items, and laid on the garment its holes show
  // where each item sits. A pin's position is a red tick on the paper outside its hole, where the pin's line meets the cut (a mark
  // inside the hole is cut away with it); the garment edges to line the sheet up on are blue dashed lines with a one-word label.
  // The sheet is the items with a small margin and the registration lines beside them, on one page whenever it fits the printable
  // area at true scale (the footer gives up space first: more columns, then a smaller size); a sheet taller or wider than a page is
  // split between the holes where it can be and tiled with crop marks.

  const SHEET_MARGIN = 0.25;   // paper beyond the holes, in: room for the labels, the scissor marks and the pin ticks
  const PAGE_MARGIN = 0.3;     // the page's unprinted edge, in
  const GAP = 0.1;             // between the header, the sheet and the footer, in
  const TICK = 0.1;            // a pin tick's length outside the cut, in
  const SHORT = { 'pocket-top': 'pocket', 'pocket-side': 'pocket', 'button-line': 'buttons', 'lapel-edge': 'lapel', seam: 'seam', 'collar-edge': 'collar', 'gorge-seam': 'gorge', 'seam-point': 'seam', 'epaulet-edge': 'board' };
  const shortLabel = r => /placket/.test(r.label) ? 'placket' : (r.kind === 'seam-point' && /button/.test(r.label)) ? 'button' : (SHORT[r.kind] || String(r.label).split(' ')[0]);

  const COLORS = { ink: [0.08, 0.1, 0.14], grey: [0.55, 0.58, 0.62], ref: [0.05, 0.36, 0.75], pin: [0.75, 0.1, 0.1], light: [0.8, 0.82, 0.86], warn: [0.62, 0.09, 0.09] };
  // Helvetica advance widths (per 1000 em), for centring and wrapping; other characters use 556.
  const HW = (() => {
    const t = {}; const set = (chars, w) => { for(const ch of chars) t[ch] = w; };
    set(' !,./:;I[\\]fijlt', 278); set('ijl', 222); set('"', 355); set('#$0123456789?L_aebdghnopqu', 556); set('%', 889); set('&ABEKPSVXY', 667);
    set('\'', 191); set('()-`r{}', 333); set('*', 389); set('+<=>~', 584); set('@', 1015); set('CDHNRUw', 722); set('FTZ', 611); set('GOQ', 778); set('J', 500); set('M', 833); set('W', 944); set('ckmsvxyz', 500); set('m', 833); set('|', 260); set('^', 469);
    return t;
  })();
  const textWidth = (s, size, bold) => [...String(s)].reduce((a, ch) => a + (HW[ch] || 556), 0) / 1000 * size * (bold ? 1.06 : 1);
  const ascii = s => String(s).replace(/[‘’]/g, '\'').replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/½/g, '1/2').replace(/¼/g, '1/4').replace(/[^\x20-\x7e]/g, '');
  function wrap(text, size, width, bold){
    const words = ascii(text).split(/\s+/), lines = [];
    let cur = '';
    for(const w of words){ const t = cur ? cur + ' ' + w : w; if(textWidth(t, size, bold) > width && cur){ lines.push(cur); cur = w; } else cur = t; }
    if(cur) lines.push(cur);
    return lines;
  }

  // The four lines under the title.
  function howTo(side){
    return [
      'Print at 100% (actual size), no scaling: the bars at the top right must measure 1 in and 25 mm.',
      'Cut out each solid outline, starting at its scissor mark; the paper left is the space between the items.',
      'Lay the sheet on the garment and line up the blue dashed lines with the garment edges they name, then tape it down.',
      side.attach === 'sew' ? 'Mark the garment through each hole with tailor\'s chalk, lift the sheet and sew each item inside its mark.'
        : 'Mark the garment through each hole; the red ticks outside a hole are where its pins go. Lift the sheet and pin.'
    ];
  }
  // The small block at the foot: the pin rule, the ribbon list, the estimates.
  function footerNotes(side){
    const notes = [];
    const pinned = side.items.some(i => i.attach === 'pin'), sewn = side.items.some(i => i.attach === 'sew');
    if(side.attach === 'sew') notes.push('Sewing guide: the items on this side are sewn on (or embroidered), not pinned, so there are no pin ticks and no 3D aligner for it.');
    if(pinned) notes.push(PIN_RULE);
    if(pinned && sewn) notes.push('Items marked (sewn) are sewn on: no pin ticks.');
    for(const it of side.items) if(it.legend) notes.push(it.legend + '.');
    if(side.refs.some(r => (r.circles || []).some(c => c.estimated))) notes.push('Button size not in the garment sheet: buttons drawn 1/2 in across (estimate).');
    notes.push('Drawn as you face the garment (the wearer\'s left is on your right), from the builder\'s placement for this build on a typical garment: check the regulation distances on yours.');
    return notes;
  }
  // The notes in ncol columns at one size: { cols: [[line]], colW, gutter, size, pitch, h }.
  function footerLayout(notes, cw, ncol, size){
    const pitch = size * 1.28, gutter = 0.2, colW = (cw - gutter * (ncol - 1)) / ncol;
    const lines = notes.flatMap((n, i) => wrap(n, size, colW, false).concat(i < notes.length - 1 ? [''] : []));
    const per = Math.ceil(lines.length / ncol);
    const cols = []; for(let i = 0; i < ncol; i++) cols.push(lines.slice(i * per, (i + 1) * per));
    return { cols, colW, gutter, size, pitch, h: per * pitch + 0.04 };
  }

  // The paper's box in scene inches: the items with SHEET_MARGIN around them, the registration lines where they pass the items
  // (a level line over the items' width, an upright or sloping one beside their height) and the cord marks, within the side's region.
  function sheetOf(side){
    const R = side.region;
    const items = unionBox(side.items.map(i => i.box));
    let b = grow(items, SHEET_MARGIN);
    const over = { x: items.x - 0.5, y: R.y, w: items.w + 1, h: R.h }, beside = { x: R.x, y: items.y - 0.5, w: R.w, h: items.h + 1 };
    for(const r of side.refs){
      for(const s of r.segs){
        // A line reaches the sheet across itself only: a level line widens the sheet downward or upward, not sideways.
        const level = Math.abs(s[1].y - s[0].y) <= Math.abs(s[1].x - s[0].x) / 3;
        const c = clipSeg(s[0], s[1], level ? over : beside);
        if(!c) continue;
        const sb = grow(boxOf(c), 0.15);
        b = level ? unionBox([b, { x: b.x, y: sb.y, w: b.w, h: sb.h }]) : unionBox([b, { x: sb.x, y: b.y, w: sb.w, h: b.h }]);
      }
      for(const c of r.circles || []) b = unionBox([b, grow({ x: c.x - c.r, y: c.y - c.r, w: 2 * c.r, h: 2 * c.r }, 0.1)]);
      for(const p of r.points || []) b = unionBox([b, grow({ x: p.x, y: p.y, w: 0, h: 0 }, 0.2)]);
    }
    for(const m of side.marks || []) b = unionBox([b, grow({ x: m.p.x, y: m.p.y, w: 0, h: 0 }, 0.4)]);
    const x = Math.max(b.x, R.x), y = Math.max(b.y, R.y);
    return { x: r4(x), y: r4(y), w: r4(Math.min(b.x + b.w, R.x + R.w) - x), h: r4(Math.min(b.y + b.h, R.y + R.h) - y) };
  }

  // Where to split a length into tiles no longer than max: between the items' spans where one lies within reach, else at max.
  function cuts(start, len, max, spans){
    const end = start + len, out = [start];
    const merged = [];
    for(const s of spans.slice().sort((a, b) => a[0] - b[0])){ const m = merged[merged.length - 1]; if(m && s[0] <= m[1] + 1e-9) m[1] = Math.max(m[1], s[1]); else merged.push([s[0], s[1]]); }
    let at = start;
    while(end - at > max + 1e-6){
      const cand = at + max;
      let cut = null;
      for(let i = 1; i < merged.length; i++){
        const lo = merged[i - 1][1], hi = merged[i][0];
        const c = Math.min(cand, hi - 0.1);
        if(c > lo + 0.1 && c > at + 0.5 && (cut === null || c > cut)) cut = c;
      }
      if(cut === null) cut = cand;
      out.push(r4(cut)); at = cut;
    }
    out.push(end);
    return out;
  }

  // Pages for one side: [{ w, h, ops, tile, origin, sheet }] in page inches (origin top-left).
  function paperPages(side, meta, paperKey){
    const paper = PAPERS[paperKey] || PAPERS.letter;
    const M = PAGE_MARGIN, cw = paper.w - 2 * M;
    const title = `Placement template: ${side.label}`;
    const sub = ascii([meta.uniformLabel || side.garment, meta.rank, meta.name].filter(Boolean).join(', ')) + (meta.date ? ` (${meta.date})` : '');
    const steps = howTo(side);
    const notes = footerNotes(side);
    const sheet = sheetOf(side);
    const headerH = n => 0.3 + n * 0.115 + 0.05;  // the title and subtitle (beside the scale bars), then n lines
    // One page when the sheet fits above the footer: the notes in one column first, then more columns, then a smaller size.
    let footer = null;
    if(sheet.w <= cw + 1e-6) for(const [ncol, size] of [[1, 0.065], [2, 0.065], [3, 0.065], [3, 0.058], [4, 0.055]]){
      const f = footerLayout(notes, cw, ncol, size);
      if(sheet.h <= paper.h - 2 * M - headerH(steps.length) - f.h - 2 * GAP + 1e-6){ footer = f; break; }
    }
    const one = !!footer;
    if(!footer) footer = footerLayout(notes, cw, 4, 0.055);
    const hH = headerH(steps.length + (one ? 0 : 1));
    const drawW = cw, drawH = paper.h - 2 * M - hH - footer.h - 2 * GAP;
    const xs = cuts(sheet.x, sheet.w, drawW, side.items.map(i => [i.box.x, i.box.x + i.box.w]));
    const ys = cuts(sheet.y, sheet.h, drawH, side.items.map(i => [i.box.y, i.box.y + i.box.h]));
    const cols = xs.length - 1, rows = ys.length - 1;
    const pages = [];
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const edgeLetter = (r, c, dir) => { // the same letter on both pages of a shared edge
      const n = dir === 'v' ? r * (cols - 1) + c : rows * (cols - 1) + r * cols + c;
      return letters[n % 26] + (n >= 26 ? String(Math.floor(n / 26)) : '');
    };
    for(let r = 0; r < rows; r++) for(let c = 0; c < cols; c++){
      const tile = { x: xs[c], y: ys[r], w: r4(xs[c + 1] - xs[c]), h: r4(ys[r + 1] - ys[r]) };
      const ox = M + (cols === 1 ? (drawW - tile.w) / 2 : 0), oy = M + hH + GAP;
      const ops = [];
      const T = (x, y, s, text, o) => ops.push(Object.assign({ t: 'text', x, y, s, text: ascii(text) }, o || {}));
      T(M, M + 0.15, 0.15, title, { bold: true });
      T(M, M + 0.28, 0.09, sub);
      const many = rows * cols > 1;
      const lines = many ? steps.concat([`Page ${r * cols + c + 1} of ${rows * cols} (row ${r + 1}, column ${c + 1}): trim at the crop marks where pages join and tape them edge to edge, matching the letters.`]) : steps;
      lines.forEach((line, i) => T(M, M + 0.3 + 0.085 + i * 0.115, 0.085, line, i === 0 ? { bold: true, color: COLORS.warn } : {}));
      // Scale bars: 1 in and 25 mm, top right.
      const sx = paper.w - M - 1.6, sy = M + 0.1;
      ops.push({ t: 'line', x1: sx, y1: sy + 0.12, x2: sx + 1, y2: sy + 0.12, w: 0.02, color: COLORS.ink });
      for(let i = 0; i <= 4; i++) ops.push({ t: 'line', x1: sx + i / 4, y1: sy + (i % 4 ? 0.06 : 0.02), x2: sx + i / 4, y2: sy + 0.12, w: 0.01, color: COLORS.ink });
      T(sx + 1.08, sy + 0.12, 0.09, '1 in');
      const my = sy + 0.38, mmIn = 25 / MM;
      ops.push({ t: 'line', x1: sx, y1: my, x2: sx + mmIn, y2: my, w: 0.02, color: COLORS.ink });
      for(let i = 0; i <= 5; i++) ops.push({ t: 'line', x1: sx + i * 5 / MM, y1: my - (i % 5 ? 0.06 : 0.1), x2: sx + i * 5 / MM, y2: my, w: 0.01, color: COLORS.ink });
      T(sx + mmIn + 0.08, my, 0.09, '25 mm');
      // The stencil, clipped to the tile.
      const g = { t: 'group', dx: ox - tile.x, dy: oy - tile.y, clip: tile, ops: [] };
      drawSide(g.ops, side, sheet);
      ops.push(g);
      // The sheet's edge (a trim line) and, when tiled, crop marks and letters.
      const fx = ox, fy = oy, fw = tile.w, fh = tile.h;
      ops.push({ t: 'poly', pts: [[fx, fy], [fx + fw, fy], [fx + fw, fy + fh], [fx, fy + fh]], closed: true, w: 0.006, color: COLORS.light, dash: [0.05, 0.05] });
      if(many){
        for(const [x, y, dx, dy] of [[fx, fy, -1, -1], [fx + fw, fy, 1, -1], [fx + fw, fy + fh, 1, 1], [fx, fy + fh, -1, 1]]){
          ops.push({ t: 'line', x1: x + dx * 0.06, y1: y, x2: x + dx * 0.3, y2: y, w: 0.008, color: COLORS.ink });
          ops.push({ t: 'line', x1: x, y1: y + dy * 0.06, x2: x, y2: y + dy * 0.3, w: 0.008, color: COLORS.ink });
        }
        const mark = (x, y, label) => { ops.push({ t: 'circle', cx: x, cy: y, r: 0.07, w: 0.01, color: COLORS.ink }); ops.push({ t: 'line', x1: x - 0.1, y1: y, x2: x + 0.1, y2: y, w: 0.006, color: COLORS.ink }); ops.push({ t: 'line', x1: x, y1: y - 0.1, x2: x, y2: y + 0.1, w: 0.006, color: COLORS.ink }); T(x + 0.1, y - 0.1, 0.09, label, { bold: true }); };
        if(c > 0) mark(fx, fy + fh / 2, edgeLetter(r, c - 1, 'v'));
        if(c < cols - 1) mark(fx + fw, fy + fh / 2, edgeLetter(r, c, 'v'));
        if(r > 0) mark(fx + fw / 2, fy, edgeLetter(r - 1, c, 'h'));
        if(r < rows - 1) mark(fx + fw / 2, fy + fh, edgeLetter(r, c, 'h'));
      }
      // Footer notes in columns.
      const fy0 = paper.h - M - footer.h + footer.size;
      footer.cols.forEach((col, j) => { let ny = fy0; const x = M + j * (footer.colW + footer.gutter); for(const line of col){ if(line) T(x, ny, footer.size, line); ny += footer.pitch; } });
      pages.push({ w: paper.w, h: paper.h, ops, tile, origin: { x: ox, y: oy }, sheet });
    }
    return pages;
  }

  // The ticks outside a cut at the pins' positions: the foot of the perpendicular from each pin to each edge of the cut it meets.
  function pinTicks(cut, pins){
    const n = cut.length, cx = cut.reduce((a, p) => a + p.x, 0) / n, cy = cut.reduce((a, p) => a + p.y, 0) / n;
    const ticks = [];
    for(const p of pins) for(let i = 0; i < n; i++){
      const a = cut[i], b = cut[(i + 1) % n], dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
      if(l2 < 1e-12) continue;
      const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2;
      if(t < 1e-6 || t > 1 - 1e-6) continue;
      const f = { x: a.x + t * dx, y: a.y + t * dy }, l = Math.sqrt(l2);
      let nx = -dy / l, ny = dx / l;
      if(nx * (f.x - cx) + ny * (f.y - cy) < 0){ nx = -nx; ny = -ny; }
      if(!ticks.some(q => Math.abs(q.x1 - f.x) < 1e-6 && Math.abs(q.y1 - f.y) < 1e-6)) ticks.push({ x1: f.x, y1: f.y, x2: f.x + nx * TICK, y2: f.y + ny * TICK });
    }
    return ticks;
  }
  // The corner of a cut its scissor mark sits on (the top-left one) and the unit direction of the edge the cut starts along.
  function scissorsAt(cut){
    let k = 0;
    cut.forEach((p, i) => { if(p.y < cut[k].y - 1e-6 || (Math.abs(p.y - cut[k].y) <= 1e-6 && p.x < cut[k].x)) k = i; });
    const at = cut[k], n = cut.length;
    const dir = [cut[(k + 1) % n], cut[(k - 1 + n) % n]].map(q => { const dx = q.x - at.x, dy = q.y - at.y, l = Math.hypot(dx, dy) || 1; return { x: dx / l, y: dy / l }; }).sort((a, b) => Math.abs(b.x) - Math.abs(a.x))[0];
    return { at, u: dir.x < 0 ? { x: -dir.x, y: -dir.y } : dir };
  }
  // A scissor mark centred on a corner, its handles on the paper and its blades along the cut.
  function scissors(ops, at, u){
    const P = (s, t) => [at.x + u.x * s - u.y * t, at.y + u.y * s + u.x * t];
    const seg = (s1, t1, s2, t2) => { const a = P(s1, t1), b = P(s2, t2); ops.push({ t: 'line', x1: a[0], y1: a[1], x2: b[0], y2: b[1], w: 0.012, color: COLORS.ink, scissors: true }); };
    seg(-0.1, -0.045, 0.1, 0.03); seg(-0.1, 0.045, 0.1, -0.03);
    for(const t of [-0.065, 0.065]){ const c = P(-0.13, t); ops.push({ t: 'circle', cx: c[0], cy: c[1], r: 0.028, w: 0.012, color: COLORS.ink, scissors: true }); }
  }

  // The side's stencil in scene inches, on the sheet.
  function drawSide(ops, side, sheet){
    const S = sheet || side.region;
    for(const r of side.refs){
      for(const s of r.segs) ops.push({ t: 'line', x1: s[0].x, y1: s[0].y, x2: s[1].x, y2: s[1].y, w: 0.012, color: COLORS.ref, dash: [0.08, 0.05] });
      for(const c of r.circles || []) ops.push({ t: 'circle', cx: c.x, cy: c.y, r: c.r, w: 0.01, color: COLORS.ref, dash: [0.04, 0.03] });
      for(const p of r.points || []){ ops.push({ t: 'line', x1: p.x - 0.12, y1: p.y, x2: p.x + 0.12, y2: p.y, w: 0.012, color: COLORS.ref }); ops.push({ t: 'line', x1: p.x, y1: p.y - 0.12, x2: p.x, y2: p.y + 0.12, w: 0.012, color: COLORS.ref }); }
      // The one-word label beside the longest piece on the sheet, on the side away from the items.
      const segs = r.segs.map(s => clipSeg(s[0], s[1], S)).filter(s => s && segLen(s) > 0.05);
      const longest = segs.slice().sort((a, b) => segLen(b) - segLen(a))[0];
      const at = longest ? { x: (longest[0].x + longest[1].x) / 2, y: (longest[0].y + longest[1].y) / 2 } : (r.points || [])[0] || (r.circles || [])[0];
      if(at){
        const label = shortLabel(r), size = 0.075, w = textWidth(label, size), c = side.centre;
        let nx = 0, ny = -1;
        if(longest){ const l = segLen(longest) || 1; nx = -(longest[1].y - longest[0].y) / l; ny = (longest[1].x - longest[0].x) / l; }
        if(nx * (at.x - c.x) + ny * (at.y - c.y) < 0){ nx = -nx; ny = -ny; }
        const inItem = (px, py) => side.items.some(i => px >= i.box.x - 0.05 && px <= i.box.x + i.box.w + 0.05 && py >= i.box.y - 0.05 && py <= i.box.y + i.box.h + 0.05);
        if(inItem(at.x + nx * 0.15, at.y + ny * 0.15) && !inItem(at.x - nx * 0.15, at.y - ny * 0.15)){ nx = -nx; ny = -ny; }
        let x = at.x + nx * 0.1, y = at.y + ny * 0.1;
        if(nx < -0.5) x -= w; else if(Math.abs(nx) <= 0.5) x -= w / 2;
        if(ny > 0.5) y += size * 0.8; else if(Math.abs(ny) <= 0.5) y += size * 0.35;
        x = Math.max(S.x + 0.05, Math.min(S.x + S.w - w - 0.05, x)); y = Math.max(S.y + 0.12, Math.min(S.y + S.h - 0.15, y));
        ops.push({ t: 'text', x, y, s: size, text: ascii(label), color: COLORS.ref });
      }
    }
    for(const it of side.items){
      const cut = it.cut || it.outline;
      ops.push({ t: 'poly', pts: cut.map(p => [p.x, p.y]), closed: true, w: 0.014, color: COLORS.ink, cut: true });
      const sc = scissorsAt(cut);
      scissors(ops, sc.at, sc.u);
      for(const k of pinTicks(cut, it.pins)) ops.push(Object.assign({ t: 'line', w: 0.014, color: COLORS.pin, tick: true }, k));
      const label = ascii(it.name + (it.attach === 'sew' ? ' (sewn)' : ''));
      const size = 0.085, w = textWidth(label, size), c = it.c;
      let y = it.box.y - 0.13;   // clear of the scissor mark's handles at the corner
      if(y - size < S.y) y = it.box.y + it.box.h + size + 0.12;
      const x = Math.max(S.x + 0.03, Math.min(S.x + S.w - w - 0.03, c.x - w / 2));
      ops.push({ t: 'text', x, y, s: size, text: label, color: COLORS.ink });
    }
    for(const m of side.marks || []){
      ops.push({ t: 'circle', cx: m.p.x, cy: m.p.y, r: 0.08, w: 0.012, color: COLORS.ink, dash: [0.03, 0.02] });
      const w = textWidth(ascii(m.name), 0.075);
      const x = m.p.x + 0.12 + w > S.x + S.w - 0.03 ? m.p.x - 0.12 - w : m.p.x + 0.12;
      ops.push({ t: 'text', x: Math.max(S.x + 0.03, x), y: m.p.y + 0.03, s: 0.075, text: ascii(m.name), color: COLORS.ink });
    }
    ops.push({ t: 'text', x: S.x + 0.05, y: S.y + S.h - 0.06, s: 0.07, text: 'trim line (optional)', color: COLORS.grey });
  }

  const f4 = n => String(Math.round(n * 10000) / 10000);
  const rgb = c => `rgb(${c.map(v => Math.round(v * 255)).join(',')})`;
  const xml = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

  function svgOps(ops, out, clipId){
    for(const o of ops){
      if(o.t === 'group'){
        const id = 'c' + (clipId.n++);
        out.push(`<clipPath id="${id}"><rect x="${f4(o.clip.x)}" y="${f4(o.clip.y)}" width="${f4(o.clip.w)}" height="${f4(o.clip.h)}"/></clipPath><g transform="translate(${f4(o.dx)} ${f4(o.dy)})"><g clip-path="url(#${id})">`);
        svgOps(o.ops, out, clipId);
        out.push('</g></g>');
        continue;
      }
      const stroke = o.color ? ` stroke="${rgb(o.color)}" stroke-width="${f4(o.w || 0.01)}"` : '';
      const dash = o.dash ? ` stroke-dasharray="${o.dash.map(f4).join(' ')}"` : '';
      if(o.t === 'line') out.push(`<line x1="${f4(o.x1)}" y1="${f4(o.y1)}" x2="${f4(o.x2)}" y2="${f4(o.y2)}"${stroke}${dash}/>`);
      else if(o.t === 'poly') out.push(`<${o.closed ? 'polygon' : 'polyline'} points="${o.pts.map(p => f4(p[0]) + ',' + f4(p[1])).join(' ')}" fill="${o.fill ? rgb(o.fill) : 'none'}"${stroke}${dash}/>`);
      else if(o.t === 'circle') out.push(`<circle cx="${f4(o.cx)}" cy="${f4(o.cy)}" r="${f4(o.r)}" fill="${o.fill ? rgb(o.fill) : 'none'}"${o.fill ? '' : stroke}${dash}/>`);
      else if(o.t === 'text') out.push(`<text x="${f4(o.x)}" y="${f4(o.y)}" font-size="${f4(o.s)}"${o.bold ? ' font-weight="700"' : ''} fill="${rgb(o.color || COLORS.ink)}">${xml(o.text)}</text>`);
    }
  }

  // An SVG whose width and height are in inches (one page, or the pages one under another), so a browser prints it 1:1.
  function paperSvg(side, meta, paperKey){
    const pages = paperPages(side, meta, paperKey);
    const W = pages[0].w, H = pages[0].h, total = H * pages.length;
    const unit = paperKey === 'a4' ? ['210mm', `${297 * pages.length}mm`] : [`${f4(W)}in`, `${f4(total)}in`];
    const out = [`<?xml version="1.0" encoding="UTF-8"?>`,
      `<svg xmlns="http://www.w3.org/2000/svg" width="${unit[0]}" height="${unit[1]}" viewBox="0 0 ${f4(W)} ${f4(total)}" font-family="Helvetica, Arial, sans-serif" data-pages="${pages.length}" data-paper="${paperKey}">`,
      `<title>${xml(ascii('Placement template: ' + side.label))}</title>`,
      `<style>@page{size:${unit[0]} ${paperKey === 'a4' ? '297mm' : f4(H) + 'in'};margin:0}</style>`,
      `<rect x="0" y="0" width="${f4(W)}" height="${f4(total)}" fill="#fff"/>`];
    const clip = { n: 0 };
    pages.forEach((p, i) => { out.push(`<g data-page="${i + 1}" transform="translate(0 ${f4(i * H)})">`); svgOps(p.ops, out, clip); out.push('</g>'); });
    out.push('</svg>');
    return out.join('\n');
  }

  // A PDF written by hand: base-14 Helvetica, one content stream per page, user space in inches (y down).
  function paperPdf(side, meta, paperKey){
    const pages = paperPages(side, meta, paperKey);
    const n = v => (Math.round(v * 100000) / 100000).toString();
    const esc = s => ascii(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
    const content = page => {
      const c = [`72 0 0 -72 0 ${n(page.h * 72)} cm`, '1 J 1 j'];
      const emit = ops => {
        for(const o of ops){
          if(o.t === 'group'){
            c.push('q', `1 0 0 1 ${n(o.dx)} ${n(o.dy)} cm`, `${n(o.clip.x)} ${n(o.clip.y)} ${n(o.clip.w)} ${n(o.clip.h)} re W n`);
            emit(o.ops); c.push('Q'); continue;
          }
          const col = o.color || COLORS.ink;
          if(o.t === 'text'){
            c.push(`${col.map(n).join(' ')} rg`, `BT /${o.bold ? 'F2' : 'F1'} ${n(o.s)} Tf 1 0 0 -1 ${n(o.x)} ${n(o.y)} Tm (${esc(o.text)}) Tj ET`);
            continue;
          }
          c.push(`${col.map(n).join(' ')} RG`, `${n(o.w || 0.01)} w`, o.dash ? `[${o.dash.map(n).join(' ')}] 0 d` : '[] 0 d');
          if(o.t === 'line') c.push(`${n(o.x1)} ${n(o.y1)} m ${n(o.x2)} ${n(o.y2)} l S`);
          else if(o.t === 'poly') c.push(o.pts.map((p, i) => `${n(p[0])} ${n(p[1])} ${i ? 'l' : 'm'}`).join(' ') + (o.closed ? ' h' : '') + (o.fill ? ' f' : ' S'));
          else if(o.t === 'circle'){
            const k = 0.5523 * o.r, x = o.cx, y = o.cy, r = o.r;
            if(o.fill) c.push(`${o.fill.map(n).join(' ')} rg`);
            c.push(`${n(x + r)} ${n(y)} m ${n(x + r)} ${n(y + k)} ${n(x + k)} ${n(y + r)} ${n(x)} ${n(y + r)} c ${n(x - k)} ${n(y + r)} ${n(x - r)} ${n(y + k)} ${n(x - r)} ${n(y)} c ${n(x - r)} ${n(y - k)} ${n(x - k)} ${n(y - r)} ${n(x)} ${n(y - r)} c ${n(x + k)} ${n(y - r)} ${n(x + r)} ${n(y - k)} ${n(x + r)} ${n(y)} c ${o.fill ? 'f' : 'S'}`);
          }
        }
      };
      emit(page.ops);
      return c.join('\n');
    };
    const objs = [];
    const kids = pages.map((p, i) => 5 + i * 2);
    objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    objs[2] = `<< /Type /Pages /Kids [${kids.map(k => k + ' 0 R').join(' ')}] /Count ${pages.length} >>`;
    objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
    objs[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
    pages.forEach((p, i) => {
      const body = content(p);
      objs[5 + i * 2] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${n(p.w * 72)} ${n(p.h * 72)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + i * 2} 0 R >>`;
      objs[6 + i * 2] = `<< /Length ${body.length} >>\nstream\n${body}\nendstream`;
    });
    let pdf = '%PDF-1.4\n';
    const offsets = [];
    for(let i = 1; i < objs.length; i++){ offsets[i] = pdf.length; pdf += `${i} 0 obj\n${objs[i]}\nendobj\n`; }
    const xref = pdf.length;
    pdf += `xref\n0 ${objs.length}\n0000000000 65535 f \n` + offsets.slice(1).map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('');
    pdf += `trailer\n<< /Size ${objs.length} /Root 1 0 R /Info << /Title (${esc('Placement template: ' + side.label)}) /Producer (CAP Uniform Builder) >> >>\nstartxref\n${xref}\n%%EOF\n`;
    const bytes = new Uint8Array(pdf.length);
    for(let i = 0; i < pdf.length; i++) bytes[i] = pdf.charCodeAt(i) & 0xff;
    return bytes;
  }

  // ---- 3D aligners -------------------------------------------------------------------------------------
  //
  // Thin flat plates in the manner of the published ribbon-rack aligners (a frame that lies on the garment with a straight edge on the
  // garment's edge, items held in cradles open on one side, a shelf that is the gap), printed flat without supports, 2 mm thick, with
  // no pin holes, no lips and no pockets cut to an item's size. A plate is bars of 5 mm (legs, posts, shelves, arms); where a bar
  // ends on the garment's edge (the pocket's top edge, the button line, a collar, lapel or shoulder board edge) it is cut straight on
  // that edge. Nothing depends on a printed hole fitting a post, so nothing depends on how exact the printer is:
  //   - an item stands 0.5 mm clear of the post beside it (its other side is open) and rests on the shelf below it, which is exactly
  //     the gap between it and the item under it: the shelf is the spacer;
  //   - the first item (or the first item's legs) reach the garment's edge from the side the items are on, so the plate lies on one
  //     side of that edge and an item below the edge gets a plate of its own, hanging from the edge;
  //   - the plate is a tree of bars, with no enclosed window: every cradle is open on its far side, and the plate lifts straight off
  //     once the items are pinned;
  //   - the top bar is the label: the site's address and what the plate is for, 6 mm capitals raised 0.6 mm, with notches on its far
  //     edge at the middle of the pocket (and at the pocket's sides) so the plate can be centred by eye.
  // Everything is drawn in a frame of its own, x across, y away from the garment's edge: for items stacked above a level edge (the
  // pocket) the legs run down to the edge; for a vertical edge (the button line) or a slanted one the shelves run across to the edge;
  // a tilted item (a collar point's grade) has the frame of the item. The frame is mirrored where the edge is above or to the right
  // of the items, and the letters are placed after, upright.

  const BAR = 5, CLEAR = 0.5, TEXT_CELL = 1.2, TEXT_MARGIN = 2.5, TEXT_FAR = 4.5, THICK = 2, RAISE = 0.6, BED = 180, DOMAIN = 'uniform.ebhq.dev';
  const SMALLEST_GAP = 1.7;      // items closer than this (mm) are one block: a shelf that thin cannot be printed
  const SPAN_MIN = 60;           // mm along the edge the plate should reach; shorter and flanges are added along the edge

  // Scene inches to garment millimetres: origin at the side's region corner as you face the garment, x right, y up.
  function toMm(side){ const R = side.region; return p => [(p.x - R.x) * MM, (R.y + R.h - p.y) * MM]; }

  // A frame from the garment's plane (mm, y up) into the one a plate is drawn in: turn by -theta about o, then mirror x and/or y.
  function frameTo(o, theta, fx, fy){
    const c = Math.cos(theta), s = Math.sin(theta);
    return {
      to: p => { const dx = p[0] - o[0], dy = p[1] - o[1]; return [fx * (dx * c + dy * s), fy * (-dx * s + dy * c)]; },
      from: q => { const x = fx * q[0], y = fy * q[1]; return [o[0] + x * c - y * s, o[1] + x * s + y * c]; },
      mirrored: fx * fy < 0, theta, fx, fy
    };
  }
  const pointInRing = (p, ring) => STL.pointInRing(p, ring);
  const nearQuarter = deg => { const r = ((deg % 90) + 90) % 90; return Math.min(r, 90 - r) <= 0.75; };
  const ringBox = pts => { const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]); return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) }; };
  const distToSeg = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy, t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0; return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); };

  // The items of a side, pinned ones only, each as { name, kind, box (mm, axis-aligned) } and, for a tilted one, its own frame.
  function alignerItems(side){
    const mm = toMm(side);
    return side.items.filter(i => i.attach === 'pin').map(it => {
      const b = it.box, p0 = mm({ x: b.x, y: b.y + b.h }), p1 = mm({ x: b.x + b.w, y: b.y });
      const out = { name: it.name, kind: it.kind, box: { x0: p0[0], y0: p0[1], x1: p1[0], y1: p1[1] } };
      if(it.frame && !nearQuarter(it.frame.deg)){
        const c = mm(it.frame.c);
        out.tilt = { c, w: it.frame.w * MM, h: it.frame.h * MM, theta: -it.frame.deg * Math.PI / 180 };
      }
      return out;
    });
  }

  // The garment edge a group of items registers on, in mm: the pocket's top edge when the side has one, else the button line, the
  // shoulder board's edge, else the nearest collar or lapel edge, else the gorge or shoulder seam. The button line is moved to the
  // buttons' own edge.
  const REG_ORDER = { 'pocket-top': 0, 'button-line': 1, 'epaulet-edge': 2 };
  function chooseEdge(side, centre){
    const mm = toMm(side);
    let best = null;
    for(const r of side.refs.filter(x => x.lip || x.kind === 'gorge-seam' || x.kind === 'seam')){
      for(const s of r.segs){
        let a = mm(s[0]), b = mm(s[1]);
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if(len < 8) continue;
        if(r.kind === 'button-line' && r.lipOffset){ // the plate's edge on the buttons' edge, toward the items
          const dir = centre[0] > a[0] ? 1 : -1, off = r.lipOffset * MM;
          a = [a[0] + dir * off, a[1]]; b = [b[0] + dir * off, b[1]];
        }
        const rank = REG_ORDER[r.kind] !== undefined ? REG_ORDER[r.kind] : (r.lip ? 3 : 4), d = distToSeg(centre, a, b);
        if(!best || rank < best.rank || (rank === best.rank && d < best.d)) best = { a, b, kind: r.kind, label: r.label, rank, d };
      }
    }
    return best;
  }
  const pocketMarks = (side) => {
    const mm = toMm(side), xs = [];
    for(const r of side.refs.filter(x => x.kind === 'pocket-side')) for(const s of r.segs) xs.push(mm(s[0])[0]);
    return xs.length >= 2 ? [Math.min(...xs), Math.max(...xs)] : null;
  };

  // The plate for one group of items on one side of an edge. blocks: [{ x0, y0, x1, y1 }] in the frame the group is drawn in
  // (a tilted item: its own, turned upright), edge: { p, t } a point and unit direction of the edge in that frame, n the unit
  // normal toward the items; reach: on a pocket, the x of its two sides, to which the feet run out. Returns { adds, cuts, cap, gaps,
  // edgeGap, mode, blocks } in that frame with the label's room reserved.
  function designBars(blocks, edge, n, text, reach){
    const mode = Math.abs(n[1]) >= Math.abs(n[0]) ? 'H' : 'V';
    const adds = [], gaps = [];
    const bs = blocks.slice().sort((a, b) => a.y0 - b.y0).reduce((out, b) => {
      const prev = out[out.length - 1];
      if(prev && b.y0 - prev.y1 < SMALLEST_GAP){ prev.x0 = Math.min(prev.x0, b.x0); prev.x1 = Math.max(prev.x1, b.x1); prev.y1 = Math.max(prev.y1, b.y1); }
      else out.push(Object.assign({}, b));
      return out;
    }, []).map(b => Object.assign(b, { xc: (b.x0 + b.x1) / 2, pl: b.x0 - CLEAR - BAR, pr: b.x1 + CLEAR + BAR }));
    const N = bs.length, top = bs[N - 1];
    const capW = text.w + 2 * TEXT_MARGIN, capH = text.h + TEXT_MARGIN + TEXT_FAR;      // more room on the far edge, where the notches are
    const R = (x0, y0, x1, y1) => adds.push(STL.rect(x0, y0, x1, y1));
    const sY = x => edge.p[1] + (x - edge.p[0]) * edge.t[1] / edge.t[0];     // the edge's height at x (a level-ish edge)
    const sX = y => edge.p[0] + (y - edge.p[1]) * edge.t[0] / edge.t[1];     // the edge's x at height y (an upright-ish edge)
    const along = q => (q[0] - edge.p[0]) * edge.t[0] + (q[1] - edge.p[1]) * edge.t[1];
    for(let k = 0; k + 1 < N; k++) gaps.push(bs[k + 1].y0 - bs[k].y1);
    let cap, ends, edgeGap, lines;
    if(mode === 'H'){
      // The first item's legs run down to the edge; a shelf over each item is the gap to the next; each later item has a post on its left.
      const f = bs[0], low = Math.min(sY(f.pl), sY(f.pl + BAR), sY(f.x1 + CLEAR), sY(f.pr)) - 3;
      edgeGap = f.y0 - sY(f.xc);
      R(f.pl, low, f.x0 - CLEAR, f.y1 + CLEAR); R(f.x1 + CLEAR, low, f.pr, f.y1 + CLEAR);
      // On a pocket the feet run out along its top edge to the pocket's sides (not more than 45 mm), so the plate is centred by lining the ends up.
      if(reach && Math.abs(edge.t[1]) < 1e-9){
        if(reach[0] < f.pl && f.pl - reach[0] <= 45) R(reach[0], low, f.pl + BAR, edge.p[1] + BAR);
        if(reach[1] > f.pr && reach[1] - f.pr <= 45) R(f.pr - BAR, low, reach[1], edge.p[1] + BAR);
      }
      bs.forEach((b, k) => {
        const nx = bs[k + 1];
        if(k > 0) R(b.pl, b.y0, b.x0 - CLEAR, b.y1 + CLEAR);
        if(nx) R(Math.min(b.pl, nx.pl), b.y1 + CLEAR, Math.max(k ? 0 : b.pr, nx.xc + 8, nx.pl + BAR + 12, b.pl + BAR + 2), nx.y0);
      });
      cap = { x0: top.pl, y0: top.y1 + CLEAR, x1: Math.max(top.pl + capW, top.xc + 8, N === 1 ? top.pr : 0), y1: top.y1 + CLEAR + capH };
      R(cap.x0, cap.y0, cap.x1, cap.y1);
      ends = [along([f.pl, sY(f.pl)]), along([f.pr, sY(f.pr)])];
      lines = [{ q: [f.pl, 0], e: [0, 1] }, { q: [f.pr, 0], e: [0, 1] }];
    } else {
      // The edge is upright-ish: a shelf under the first item and an arm in each gap run across to it; a post beside each item on its side.
      const f = bs[0], yLo = f.y0 - BAR, yHi = top.y1 + CLEAR + BAR;
      const left = Math.min(sX(yLo), sX(yHi + capH)) - 3, sMax = Math.max(sX(yLo), sX(yHi + capH));
      edgeGap = f.x0 - sX(f.y0 + (f.y1 - f.y0) / 2);
      R(left, yLo, f.xc + 8, f.y0);
      bs.forEach((b, k) => {
        const nx = bs[k + 1];
        R(b.pl, b.y0, b.x0 - CLEAR, b.y1 + CLEAR);
        if(nx) R(left, b.y1 + CLEAR, Math.max(nx.xc + 8, nx.pl + BAR + 12, b.pl + BAR + 2), nx.y0);
      });
      const textX0 = Math.max(top.pl, sMax + 2);
      cap = { x0: top.pl, y0: top.y1 + CLEAR, x1: Math.max(textX0 + capW, top.xc + 8), y1: top.y1 + CLEAR + capH, textX0 };
      R(left, cap.y0, cap.x0 + BAR + 2, cap.y0 + BAR);                                                  // the top arm, to the edge
      R(cap.x0, cap.y0, cap.x1, cap.y1);
      ends = [along([sX(yLo), yLo]), along([sX(yHi), yHi])];
      lines = [{ q: [0, yLo], e: [1, 0] }, { q: [0, yHi], e: [1, 0] }];
    }
    // The bars end on the edge a short way apart: where that is under SPAN_MIN a flange runs on along the edge from each end. A flange is
    // the strip beside the edge (5 mm deep) from the bar's outer edge outward, so it meets the bar face to face: no corner pokes out past
    // the bar and no sliver is left between them.
    const lo = Math.min(...ends), hi = Math.max(...ends);
    if(hi - lo < SPAN_MIN){
      const Lf = Math.max(6, Math.min(20, (SPAN_MIN - (hi - lo)) / 2));
      const meet = (p1, d1, p2, d2) => { const den = d1[0] * d2[1] - d1[1] * d2[0], s1 = ((p2[0] - p1[0]) * d2[1] - (p2[1] - p1[1]) * d2[0]) / den; return [p1[0] + d1[0] * s1, p1[1] + d1[1] * s1]; };
      const inner = [edge.p[0] + n[0] * BAR, edge.p[1] + n[1] * BAR];
      const flange = (L, end) => {
        const A = meet(edge.p, edge.t, L.q, L.e), out = end === hi ? 1 : -1;
        const B = [A[0] + edge.t[0] * out * Lf, A[1] + edge.t[1] * out * Lf];
        return [A, B, [B[0] + n[0] * BAR, B[1] + n[1] * BAR], meet(inner, edge.t, L.q, L.e)];
      };
      lines.forEach((L, k) => adds.push(flange(L, ends[k])));
    }
    // The edge itself: everything on its far side is cut away, so each foot is straight on it.
    const B = 4000, P = (u, v) => [edge.p[0] + edge.t[0] * u + n[0] * v, edge.p[1] + edge.t[1] * u + n[1] * v];
    const cuts = [[P(-B, 0), P(B, 0), P(B, -B), P(-B, -B)]];
    return { adds, cuts, cap, gaps, edgeGap, mode, blocks: bs };
  }
  // A notch cut into the cap's far edge: depth d, 2d wide at the edge.
  const notchRing = (x, y, d) => [[x - d - 1, y + 1], [x + d + 1, y + 1], [x, y - d]];

  // Everything about the aligner(s) of one side: [{ label, items, edge, regions, raised, texts, marks, gaps, size, ... }], the outlines in
  // millimetres with the plate's lower-left corner at 0, 0 (origin: where that corner is on the garment). The first plate is for the items on
  // the side of the edge the plate lies on, the next for items on its other side (the pocket's badge below its top edge), or for the next
  // stack of a group too tall for a bed.
  const designCache = new WeakMap();
  function aligners(side){
    if(designCache.has(side)) return designCache.get(side);
    const items = alignerItems(side);
    const out = [];
    const groups = [];
    const flat = items.filter(i => !i.tilt);
    if(flat.length){
      const centre = [flat.reduce((a, i) => a + (i.box.x0 + i.box.x1) / 2, 0) / flat.length, flat.reduce((a, i) => a + (i.box.y0 + i.box.y1) / 2, 0) / flat.length];
      const edge = chooseEdge(side, centre);
      groups.push({ items: flat, edge, tilt: null });
    }
    for(const t of items.filter(i => i.tilt)) groups.push({ items: [t], edge: chooseEdge(side, t.tilt.c), tilt: t.tilt });
    const labelBase = String(side.key).replace(/^g\d+-/, '').replace(/-/g, ' ');
    for(const grp of groups){
      // Split by the edge's two sides: the items on each side get their own plate.
      const sides = [];
      if(!grp.edge){
        sides.push({ items: grp.items, edge: null });
      } else {
        const t = [grp.edge.b[0] - grp.edge.a[0], grp.edge.b[1] - grp.edge.a[1]], tl = Math.hypot(t[0], t[1]);
        const tu = [t[0] / tl, t[1] / tl], nu = [-tu[1], tu[0]];
        const sd = i => { const c = grp.tilt ? grp.tilt.c : [(i.box.x0 + i.box.x1) / 2, (i.box.y0 + i.box.y1) / 2]; return (c[0] - grp.edge.a[0]) * nu[0] + (c[1] - grp.edge.a[1]) * nu[1]; };
        for(const sign of [1, -1]){
          const part = grp.items.filter(i => sd(i) * sign > 0);
          if(part.length) sides.push({ items: part, edge: grp.edge, tu, n: [nu[0] * sign, nu[1] * sign] });
        }
      }
      for(const part of sides){
        const parts = fitParts(side, part, grp.tilt, labelBase);
        parts.forEach((q, k) => out.push(designPiece(side, q, grp.tilt, labelBase, parts.length > 1 ? ` ${k + 1} of ${parts.length}` : '')));
      }
    }
    // Two plates named alike are numbered.
    const count = {};
    out.forEach(p => { count[p.label] = (count[p.label] || 0) + 1; if(count[p.label] > 1) p.label += ' ' + count[p.label]; });
    designCache.set(side, out);
    return out;
  }

  // The groups of items that each get a plate: one when its plate fits the bed; else the items are cut into stacks that do, the one
  // nearest the edge first. The plates are used one after another (each lifted off once its items are pinned), so the next one's feet
  // stand on a level edge at the top of the item pinned last (an upright edge stays the same edge).
  function fitParts(side, part, tilt, labelBase){
    const fits = p => p.size.w <= BED && p.size.h <= BED;
    const whole = designPiece(side, part, tilt, labelBase, '');
    if(tilt || fits(whole) || part.items.length < 2) return [part];
    const nn = part.n || [0, 1];
    const along = i => (i.box.x0 + i.box.x1) / 2 * nn[0] + (i.box.y0 + i.box.y1) / 2 * nn[1];
    const items = part.items.slice().sort((a, b) => along(a) - along(b));
    let m = 1;
    while(m < items.length && fits(designPiece(side, Object.assign({}, part, { items: items.slice(0, m + 1) }), tilt, labelBase, ''))) m++;
    const lower = items.slice(0, m), upper = items.slice(m);
    let rest = Object.assign({}, part, { items: upper });
    if(whole.mode === 'H'){
      const y = nn[1] > 0 ? Math.max(...lower.map(i => i.box.y1)) : Math.min(...lower.map(i => i.box.y0));
      rest = { items: upper, n: nn, edge: { a: [0, y], b: [1, y], kind: 'item-top', label: 'top edge of the item below' } };
    }
    return [Object.assign({}, part, { items: lower }), ...fitParts(side, rest, tilt, labelBase)];
  }

  function designPiece(side, part, tilt, labelBase, suffix){
    const notes = [];
    let label = (labelBase + suffix).toUpperCase();
    // The frame of the group: the garment's plane, or a tilted item's own (turned upright about its centre).
    const o = tilt ? tilt.c : [0, 0], theta = tilt ? tilt.theta : 0, base = frameTo(o, theta, 1, 1);
    const blocks = tilt ? [{ x0: -tilt.w / 2, y0: -tilt.h / 2, x1: tilt.w / 2, y1: tilt.h / 2 }] : part.items.map(i => i.box);
    let edge = part.edge;
    if(!edge){
      // No garment edge is known for the side: a level edge under the first item, and the plate says so.
      const low = Math.min(...blocks.map(b => b.y0));
      edge = { a: base.from([-1000, low]), b: base.from([1000, low]), kind: 'level', label: 'level' };
      notes.push('No garment edge is known on this side: line the straight feet up level with the bottom of the item.');
    }
    // The edge and the items' side of it, in the group's frame; the frame is mirrored so the edge is below (level edge) or left (upright edge).
    const ea = base.to(edge.a), eb = base.to(edge.b), el = Math.hypot(eb[0] - ea[0], eb[1] - ea[1]);
    const et = [(eb[0] - ea[0]) / el, (eb[1] - ea[1]) / el];
    const mid = [(Math.min(...blocks.map(b => b.x0)) + Math.max(...blocks.map(b => b.x1))) / 2, (Math.min(...blocks.map(b => b.y0)) + Math.max(...blocks.map(b => b.y1))) / 2];
    let nb = [-et[1], et[0]];
    if((mid[0] - ea[0]) * nb[0] + (mid[1] - ea[1]) * nb[1] < 0) nb = [-nb[0], -nb[1]];
    const level = Math.abs(nb[1]) >= Math.abs(nb[0]);
    const fy = level && nb[1] < 0 ? -1 : 1;
    // A level-ish edge that is slanted must fall away to the right, where the label bar runs; an upright-ish one is on the left.
    const fx = level ? (fy * et[1] * et[0] > 1e-9 ? -1 : 1) : (nb[0] < 0 ? -1 : 1);
    const F = frameTo(o, theta, fx, fy);
    const fblocks = blocks.map(b => { const p = F.to(base.from([b.x0, b.y0])), q = F.to(base.from([b.x1, b.y1])); return { x0: Math.min(p[0], q[0]), y0: Math.min(p[1], q[1]), x1: Math.max(p[0], q[0]), y1: Math.max(p[1], q[1]) }; });
    const fe = { p: F.to(edge.a), t: [fx * et[0], fy * et[1]] }, fn = [fx * nb[0], fy * nb[1]];
    const onPocket = !tilt && edge.kind === 'pocket-top' && part.n && part.n[1] < 0;
    if(onPocket) label = label.replace(/CHEST$/, 'POCKET');
    const text = { w: Math.max(STL.textSize(DOMAIN, TEXT_CELL).w, STL.textSize(label, TEXT_CELL).w), h: 11 * TEXT_CELL + TEXT_CELL };
    const pm = !tilt && edge.kind === 'pocket-top' ? pocketMarks(side) : null;
    const d = designBars(fblocks, fe, fn, text, pm ? pm.map(x => F.to([x, 0])[0]).sort((a, b) => a - b) : null);
    // The notches on the cap's far edge: the middle of the pocket (and its sides) when the side has one, else the middle of the items.
    const marks = [{ x: pm ? F.to([(pm[0] + pm[1]) / 2, 0])[0] : (Math.min(...fblocks.map(b => b.x0)) + Math.max(...fblocks.map(b => b.x1))) / 2, d: 2.5 }];
    if(pm) for(const px of pm) marks.push({ x: F.to([px, 0])[0], d: 1.5 });
    const cuts = d.cuts.slice(), kept = [];
    for(const m of marks) if(m.x - m.d - 1 > d.cap.x0 + 1 && m.x + m.d + 1 < d.cap.x1 - 1){ cuts.push(notchRing(m.x, d.cap.y1, m.d)); kept.push({ at: F.from([m.x, d.cap.y1 - m.d]), depth: m.d }); }
    const mapRing = r => { const q = r.map(p => F.from(p)); return F.mirrored ? q.reverse() : q; };
    const regions = STL.regionsOf(STL.boolean2d(d.adds, cuts)).map(r => ({ outer: mapRing(r.outer), holes: r.holes.map(mapRing) }));
    // The letters, upright: the label over the address, centred on the cap's free part.
    const textLeft = (d.cap.textX0 === undefined ? d.cap.x0 : d.cap.textX0) + TEXT_MARGIN;
    const capC = F.from([textLeft + text.w / 2, d.cap.y0 + TEXT_MARGIN + text.h / 2]);
    let psi = theta; while(psi > Math.PI / 2 + 1e-9) psi -= Math.PI; while(psi <= -Math.PI / 2 - 1e-9) psi += Math.PI;
    const cs = Math.cos(psi), sn = Math.sin(psi), lineH = 5 * TEXT_CELL, off = (lineH + TEXT_CELL) / 2;
    const raised = [], texts = [];
    [[label, off], [DOMAIN, -off]].forEach(([s, dy]) => {
      const w = STL.textSize(s, TEXT_CELL).w;
      const place = p => { const lx = p[0] - w / 2, ly = p[1] - lineH / 2 + dy; return [capC[0] + lx * cs - ly * sn, capC[1] + lx * sn + ly * cs]; };
      for(const r of STL.textRegions(s, TEXT_CELL)) raised.push({ outer: r.outer.map(place), holes: r.holes.map(h => h.map(place)) });
      texts.push({ text: s.toLowerCase(), width: w, height: lineH, at: place([w / 2, lineH / 2]) });
    });
    // Every letter must stand on the plate, clear of its edge.
    for(const r of raised) for(const v of r.outer){
      const on = regions.find(g => pointInRing(v, g.outer) && !g.holes.some(h => pointInRing(v, h)));
      const near = on && Math.min(...[on.outer, ...on.holes].flatMap(l => l.map((a, i) => distToSeg(v, a, l[(i + 1) % l.length]))));
      if(!on || near < 0.9) throw new Error(`the label does not fit on the plate for ${label.toLowerCase()}`);
    }
    // To the print bed: the plate's lower-left corner at the origin.
    const bb = ringBox(regions.flatMap(r => r.outer));
    const shift = p => [p[0] - bb.x0, p[1] - bb.y0];
    const moved = r => ({ outer: r.outer.map(shift), holes: r.holes.map(h => h.map(shift)) });
    const size = { w: bb.x1 - bb.x0, h: bb.y1 - bb.y0 };
    if(size.w > BED || size.h > BED) notes.push(`The plate is ${size.w.toFixed(0)} x ${size.h.toFixed(0)} mm, larger than a ${BED} mm bed: print it split in the slicer.`);
    return {
      label, onPocket, items: part.items.map(i => i.name), edge: edge.kind, edgeLabel: edge.label, mode: d.mode, tilted: !!tilt, blocks: d.blocks.length,
      regions: regions.map(moved), raised: raised.map(moved), texts: texts.map(t => Object.assign(t, { at: shift(t.at) })), marks: kept.map(m => ({ at: shift(m.at), depth: m.depth })),
      letters: { cell: TEXT_CELL, height: 5 * TEXT_CELL, stroke: TEXT_CELL, raise: RAISE }, thickness: THICK,
      gaps: d.gaps.concat(edge.kind === 'pocket-top' || edge.kind === 'button-line' ? [d.edgeGap] : []).filter(g => g > 0.5), origin: [bb.x0, bb.y0], size, notes
    };
  }

  function alignerModel(piece){
    const m = STL.buildPlate({ regions: piece.regions, raised: piece.raised }, { thickness: THICK, textHeight: RAISE });
    return Object.assign({}, piece, { triangles: m.triangles, options: m.options });
  }
  function alignerStl(side, index){
    const list = aligners(side), piece = list[index || 0];
    if(!piece) return null;
    const m = alignerModel(piece);
    return { bytes: STL.toBinaryStl(m.triangles, ascii(`${DOMAIN} aligner ${piece.label.toLowerCase()}, mm, print flat, x right y up`)), model: m };
  }

  // The spacer gauges: one for each gap the build's aligners use (rounded to 1/16 in, from 1/16 in to 2 in), a flat bar as wide as the
  // gap hanging from a label, laid out for a bed.
  function gaugeSizes(plan){
    const seen = new Map();
    for(const s of plan.sides.filter(x => x.attach === 'pin')) for(const p of aligners(s)) for(const g of p.gaps){
      const sixteenths = Math.round(g / MM * 16);
      if(sixteenths >= 1 && sixteenths <= 32) seen.set(sixteenths, true);
    }
    return [...seen.keys()].sort((a, b) => a - b).map(n => ({ sixteenths: n, mm: n * MM / 16, label: inchLabel(n) }));
  }
  function inchLabel(n){
    const whole = Math.floor(n / 16), f = n % 16;
    if(!f) return `${whole} IN`;
    let a = f, b = 16;
    while(a % 2 === 0){ a /= 2; b /= 2; }
    return `${whole ? whole + ' ' : ''}${a}/${b} IN`;
  }
  function gaugeFiles(sizes){
    const tabLen = 25, w = STL.textSize(DOMAIN, TEXT_CELL).w + 2 * TEXT_MARGIN, hh = 11 * TEXT_CELL + TEXT_CELL + TEXT_MARGIN + TEXT_FAR, cell = hh + tabLen, gap = 6;
    const cols = Math.max(1, Math.floor((BED + gap) / (w + gap))), rows = Math.max(1, Math.floor((BED + gap) / (cell + gap)));
    const files = [];
    for(let i = 0; i < sizes.length; i += cols * rows) files.push(sizes.slice(i, i + cols * rows));
    return files.map(list => {
      const regions = [], raised = [], texts = [], bars = [];
      list.forEach((g, i) => {
        const cx = (i % cols) * (w + gap), cy = Math.floor(i / cols) * (cell + gap);
        const top = cy + cell;
        const loops = STL.boolean2d([STL.rect(cx, top - hh, cx + w, top), STL.rect(cx + TEXT_MARGIN, top - hh - tabLen, cx + TEXT_MARGIN + g.mm, top - hh + 1)], []);
        regions.push(...STL.regionsOf(loops));
        bars.push({ label: g.label, mm: g.mm, x0: cx + TEXT_MARGIN, x1: cx + TEXT_MARGIN + g.mm, y0: top - hh - tabLen });
        [[g.label, 0], [DOMAIN, 1]].forEach(([s, li]) => {
          const tw = STL.textSize(s, TEXT_CELL).w, x0 = cx + (w - tw) / 2, y0 = top - TEXT_FAR - 5 * TEXT_CELL - li * 6 * TEXT_CELL;
          const place = p => [p[0] + x0, p[1] + y0];
          for(const r of STL.textRegions(s, TEXT_CELL)) raised.push({ outer: r.outer.map(place), holes: r.holes.map(h => h.map(place)) });
          texts.push({ text: s.toLowerCase(), line: li });
        });
      });
      const size = (() => { const b = ringBox(regions.flatMap(r => r.outer)); return { w: b.x1 - b.x0, h: b.y1 - b.y0, x0: b.x0, y0: b.y0 }; })();
      const sh = p => [p[0] - size.x0, p[1] - size.y0];
      const mv = r => ({ outer: r.outer.map(sh), holes: r.holes.map(h => h.map(sh)) });
      return { sizes: list, regions: regions.map(mv), raised: raised.map(mv), texts, bars: bars.map(b => Object.assign(b, { x0: b.x0 - size.x0, x1: b.x1 - size.x0, y0: b.y0 - size.y0 })), size: { w: size.w, h: size.h } };
    });
  }
  function gaugeStl(plan, index){
    const files = gaugeFiles(gaugeSizes(plan)), f = files[index || 0];
    if(!f) return null;
    const m = STL.buildPlate({ regions: f.regions, raised: f.raised }, { thickness: THICK, textHeight: RAISE });
    return { bytes: STL.toBinaryStl(m.triangles, ascii(`${DOMAIN} spacer gauges ${f.sizes.map(s => s.label.toLowerCase()).join(', ')}, mm, print flat`)), model: Object.assign({}, f, { triangles: m.triangles }) };
  }

  // ---- the window (browser only) -------------------------------------------------------------------

  const ui = { paper: null, plan: null, busy: false };
  function defaultPaper(){
    try{ return /^(en-US|en-CA|es-MX|fil|en-PH)$/i.test(navigator.language || '') ? 'letter' : (/-(US|CA|MX|PH|CL|CO|VE)$/i.test(navigator.language || '') ? 'letter' : 'a4'); }catch(e){ return 'letter'; }
  }
  let store = null;
  function getStore(){
    if(store) return store;
    const E = root().CAPUBEngine;
    store = fetch('images/MANIFEST.json', { cache: 'no-cache' }).then(r => r.json()).then(m => E.core.createSpecStore(m, p => fetch('images/' + p, { cache: 'no-cache' }).then(r => r.ok ? r.json() : null)));
    return store;
  }
  const root = () => (typeof window !== 'undefined' ? window : {});
  function currentMeta(){
    const S = root().State || {};
    const t = S.text || {};
    const name = [t.firstName, t.lastName].filter(Boolean).join(' ');
    const d = new Date();
    return { uniform: S.uniform, gender: S.gender, membership: S.membership, rank: S.rank, name: t.show === false ? '' : name, date: d.toISOString().slice(0, 10) };
  }
  async function currentPlan(){
    const V = root().CAPUBUniformView;
    if(!V) return null;
    let scene = V.scene;
    if(!scene) scene = await V.render();
    if(!scene) return null;
    const s = await getStore();
    const meta = currentMeta();
    const p = await plan(scene, id => s.load(id), meta);
    const g = scene.layers.find(l => l.role === 'garment');
    if(g){ try{ meta.uniformLabel = garmentName(await s.load(g.id)); }catch(e){ /* label only */ } }
    return p;
  }
  function baseName(){
    const S = root().State || {};
    const N = root().CAPUBExportNames;
    const n = N && N.exportFileName ? N.exportFileName({ rank: S.rank, uniform: S.ceremonial ? 'honor_guard' : S.uniform }, 'x').replace(/\.x$/, '') : 'CAP-Uniform';
    return n.replace(/^CAP-Uniform/, 'CAP-Placement');
  }
  function save(name, bytes, type){
    const blob = new Blob([bytes], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
  }
  function fileNames(side, paperKey){
    const b = baseName() + '_' + side.key;
    return { svg: `${b}_paper-${paperKey}.svg`, pdf: `${b}_paper-${paperKey}.pdf`, stl: `${b}_aligner.stl`, stlN: n => `${b}_aligner-${n}.stl`, gauges: n => `${baseName()}_spacers${n > 1 ? '-' + n : ''}.stl` };
  }
  function download(side, what, piece){
    const meta = ui.plan.meta, paperKey = ui.paper;
    const names = fileNames(side, paperKey);
    if(what === 'svg') save(names.svg, paperSvg(side, meta, paperKey), 'image/svg+xml');
    else if(what === 'pdf') save(names.pdf, paperPdf(side, meta, paperKey), 'application/pdf');
    else if(what === 'stl'){ const { bytes } = alignerStl(side, piece || 0); save(piece ? names.stlN(piece + 1) : names.stl, bytes, 'model/stl'); }
  }

  const STYLE = `
#placementTemplates{width:min(620px,calc(100vw - 32px));max-height:calc(100vh - 48px);padding:var(--s5,20px);border:1px solid var(--line,#ccd);border-radius:var(--r-lg,10px);background:var(--panel,#fff);color:var(--ink,#111)}
#placementTemplates::backdrop{background:var(--scrim,rgba(0,0,0,.4))}
#placementTemplates h2{margin:0 0 8px;font-size:var(--t-xl,20px);line-height:1.15}
#placementTemplates p{margin:0 0 10px;font-size:var(--t-sm,14px);line-height:1.45;color:var(--muted,#555)}
#placementTemplates #placementPaperPicker{margin:0 0 12px}
#placementTemplates #placementPaperPicker[hidden]{display:none}
#placementTemplates .vp[data-name="paper"] .vpGrid{grid-template-columns:repeat(2,minmax(0,150px))}
#placementTemplates ul{list-style:none;margin:0 0 12px;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px}
#placementTemplates li{display:flex;flex-direction:column;gap:8px;min-width:0;padding:8px;border:1px solid var(--line,#ccd);border-radius:var(--r,6px);background:var(--panel,#fff)}
#placementTemplates li.ptEmpty{grid-column:1 / -1;padding:12px 0;border:0}
#placementTemplates li[data-side-key="spacers"]{grid-column:1 / -1;flex-direction:row;flex-wrap:wrap;align-items:center;justify-content:space-between}
#placementTemplates li .ptPicture{display:flex;align-items:center;justify-content:center;aspect-ratio:4 / 3;min-width:0;overflow:hidden;background:var(--paper,#fff);border:1px solid var(--line,#ccd);border-radius:4px}
#placementTemplates li .ptPicture[hidden]{display:none}
#placementTemplates li .ptPicture img{display:block;width:100%;height:100%;object-fit:contain}
#placementTemplates li .ptSide{flex:1 1 auto;min-width:0}
#placementTemplates li[data-side-key="spacers"] .ptSide{flex:1 1 220px}
#placementTemplates li .ptSide b{display:block;font-size:var(--t-md,15px)}
#placementTemplates li .ptSide small{display:block;color:var(--muted,#555);font-size:var(--t-xs,12px);line-height:1.35}
#placementTemplates li .ptActions{display:flex;flex-direction:column;align-items:stretch;gap:6px}
#placementTemplates li[data-side-key="spacers"] .ptActions{flex-direction:row;flex-wrap:wrap}
#placementTemplates li .ptActions button{width:100%;margin:0;padding:0 8px;min-height:36px}
#placementTemplates li[data-side-key="spacers"] .ptActions button{width:auto;padding:0 12px}
#placementTemplates li .ptActions button.ptAlt{min-height:36px;padding:0 4px;border:0;background:none;color:var(--ink,#111);font-weight:400;text-decoration:underline}
#placementTemplates li .ptActions button.ptAlt:hover{background:none;color:var(--ink,#111)}
#placementTemplates .ptFoot{display:flex;justify-content:flex-end}
#placementTemplates .ptFoot button{width:auto;margin:0;padding:0 18px}
#placementTemplates .ptEmpty{padding:12px 0;color:var(--muted,#555)}
`;
  function ensureDialog(){
    let d = document.getElementById('placementTemplates');
    if(d) return d;
    if(!document.getElementById('placementTemplatesStyle')){ const st = document.createElement('style'); st.id = 'placementTemplatesStyle'; st.textContent = STYLE; document.head.appendChild(st); }
    d = document.createElement('dialog');
    d.id = 'placementTemplates';
    d.setAttribute('aria-labelledby', 'placementTemplatesTitle');
    d.innerHTML = `<h2 id="placementTemplatesTitle">Placement templates</h2>
<p>Full-size helpers for putting your items on the garment, from the uniform as drawn. The paper template is a stencil: print it at 100% (actual size), cut out each item's outline, lay the sheet on the garment lined up with the edges it names, and mark through the holes; the ticks outside each hole are its pins. The 3D aligners are thin flat plates: print each one flat, no supports. Lay its straight feet along the garment edge it runs to (the pocket's top, the button line, a collar or shoulder edge), set each item in its cradle, pin through, and lift the plate off. The spacer gauges are bars as wide as the gaps the aligners use, each marked with its size. Pin positions are estimated from each item's width; check them against your own items.</p>
<div id="placementPaperPicker" hidden></div>
<ul id="placementTemplatesList" aria-live="polite"></ul>
<div class="ptFoot"><button type="button" class="ghost" id="placementTemplatesClose">Close</button></div>`;
    document.body.appendChild(d);
    d.querySelector('#placementTemplatesClose').addEventListener('click', () => d.close());
    d.addEventListener('click', ev => {
      const g = ev.target.closest('button[data-gauges]');
      if(g && ui.plan){
        try{ const n = +g.dataset.gauges, { bytes } = gaugeStl(ui.plan, n); save(fileNames({ key: 'x' }, ui.paper).gauges(n + 1), bytes, 'model/stl'); const T = root().CAPUB_TELEMETRY; if(T) T.track('templates', { side: 'spacers', what: 'stl', paper: ui.paper }); }
        catch(e){ console.error('[placement templates]', e); if(typeof root().capubNotify === 'function') root().capubNotify('The template could not be made: ' + (e && e.message || e)); }
        return;
      }
      const b = ev.target.closest('button[data-side]');
      if(!b || !ui.plan) return;
      const side = ui.plan.sides.find(s => s.key === b.dataset.side);
      if(!side) return;
      try{ download(side, b.dataset.what, +b.dataset.piece || 0); const T = root().CAPUB_TELEMETRY; if(T) T.track('templates', { side: side.key, what: b.dataset.what, paper: ui.paper }); }catch(e){ console.error('[placement templates]', e); if(typeof root().capubNotify === 'function') root().capubNotify('The template could not be made: ' + (e && e.message || e)); }
    });
    return d;
  }
  function describe(side){
    const pins = side.items.reduce((a, i) => a + i.pins.length, 0);
    const what = side.items.map(i => i.name + (i.attach === 'sew' ? ' (sewn)' : '')).join(', ');
    if(side.attach === 'sew') return `${what}. Sewn on: paper sewing guide only, no 3D aligner.`;
    return `${what}. ${pins} pin${pins === 1 ? '' : 's'} marked.`;
  }
  function fillList(d){
    const list = d.querySelector('#placementTemplatesList');
    const sides = (ui.plan && ui.plan.sides) || [];
    if(!sides.length){ list.innerHTML = '<li class="ptEmpty">Nothing on this uniform is pinned or sewn on the chest, collar or shoulders yet. Add ribbons, badges or a nameplate first.</li>'; return; }
    const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
    const pieces = s => (s.attach === 'pin' ? aligners(s) : []);
    const stlButtons = s => pieces(s).map((p, i) => `<button type="button" class="ghost" data-side="${esc(s.key)}" data-what="stl"${i ? ` data-piece="${i}"` : ''}>3D aligner${pieces(s).length > 1 ? ': ' + esc(p.label.toLowerCase()) : ''} (STL)</button>`).join('');
    list.innerHTML = sides.map(s => `<li class="ptCard" data-side-key="${esc(s.key)}"><div class="ptPicture" aria-hidden="true"></div><div class="ptSide"><b>${esc(s.label.charAt(0).toUpperCase() + s.label.slice(1))}</b><small>${esc(describe(s))}</small></div><div class="ptActions">
<button type="button" data-side="${esc(s.key)}" data-what="pdf">Paper (PDF)</button>${stlButtons(s)}<button type="button" class="ptAlt" data-side="${esc(s.key)}" data-what="svg">also as SVG</button></div></li>`).join('')
      + gaugeRow(ui.plan);
    paintPictures(list, sides);
  }
  // The picture on each part's card: the member's own uniform, as drawn now, cut to the part's region (what its template covers), made by the engine (js/profile-pictures.js crops) and
  // kept; one still being made holds its place, one that could not be made leaves the card its name and its buttons. Where the pictures' script is not on the page the cards are as before.
  function paintPictures(list, sides){
    const sh = root().CAPUBProfilePickers && root().CAPUBProfilePickers.shared;
    if(!sh || !sides.length) return;
    sh.claim('paper');
    const paint = urls => {
      for(const side of sides){
        const card = [...list.children].find(li => li.dataset && li.dataset.sideKey === side.key), box = card && card.querySelector('.ptPicture');
        if(!box) continue;
        const url = urls[side.key];
        if(url === null){ box.hidden = true; continue; }
        box.hidden = false;
        if(typeof url === 'string' && !box.querySelector('img')){ const img = document.createElement('img'); img.alt = ''; img.decoding = 'async'; img.src = url; box.appendChild(img); }
      }
    };
    const made = sh.maker().crops(sides.map(s => ({ key: s.key, box: s.region })));
    paint(made.now);
    if(!made.settled) made.ready.then(done => { if(list.isConnected) paint(done); });
  }
  // The spacer gauges of the build: one row, a button for each file (a bed holds six or so).
  function gaugeRow(plan){
    const sizes = gaugeSizes(plan);
    if(!sizes.length) return '';
    const files = gaugeFiles(sizes);
    return `<li data-side-key="spacers"><div class="ptSide"><b>Spacer gauges</b><small>${sizes.map(z => z.label.toLowerCase()).join(', ')}: each a bar as wide as a gap the aligners use.</small></div><div class="ptActions">${files.map((f, i) => `<button type="button" class="ghost" data-gauges="${i}">Spacer gauges${files.length > 1 ? ' ' + (i + 1) : ''} (STL)</button>`).join('')}</div></li>`;
  }
  // The paper size is two tiles, a sheet of each paper at its true shape with a stencil laid out on it (the first part's, the engine's own paperSvg), over the choice kept in this
  // browser. Where there is nothing to lay out the choice is not offered.
  const paperUrls = [];
  function paperTile(side, meta, paperKey, sheet){
    const svg = paperSvg(side, meta, paperKey);
    const root0 = /<svg\b[^>]*>/.exec(svg)[0];
    const W = +/viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(root0)[1], H = +/viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(root0)[2];
    const body = svg.slice(svg.indexOf(root0) + root0.length, svg.lastIndexOf('</svg>')).replace(/<style>[\s\S]*?<\/style>/, '');
    const m = Math.max(W, H) * 0.04, tw = W + 2 * m, th = H + 2 * m, k = 300 / Math.max(tw, th);
    return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${(tw * k).toFixed(2)}" height="${(th * k).toFixed(2)}" viewBox="${(-m).toFixed(4)} ${(-m).toFixed(4)} ${tw.toFixed(4)} ${th.toFixed(4)}">`
      + `<rect x="${(-m).toFixed(4)}" y="${(-m).toFixed(4)}" width="${tw.toFixed(4)}" height="${th.toFixed(4)}" fill="${sheet || '#d9dce3'}"/>`
      + `<svg x="0" y="0" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Helvetica, Arial, sans-serif">${body}</svg>`
      + `<rect x="0" y="0" width="${W}" height="${H}" fill="none" stroke="#6b7078" stroke-width="${(Math.max(W, H) * 0.004).toFixed(4)}"/></svg>`;
  }
  let paperPicker = null;
  function fillPaper(d){
    const host = d.querySelector('#placementPaperPicker'), sh = root().CAPUBProfilePickers && root().CAPUBProfilePickers.shared;
    if(!host) return;
    const sides = (ui.plan && ui.plan.sides) || [];
    host.hidden = !sides.length || !root().VisualPicker || !sh;
    if(host.hidden) return;
    paperUrls.splice(0).forEach(u => URL.revokeObjectURL(u));
    // The sheet that holds the stencil on one page where one does.
    const first = sides.find(s => paperPages(s, ui.plan.meta, 'letter').length === 1) || sides[0];
    const options = Object.keys(PAPERS).map(key => {
      const url = URL.createObjectURL(new Blob([paperTile(first, ui.plan.meta, key)], { type: 'image/svg+xml;charset=utf-8' }));
      paperUrls.push(url);
      return { value: key, label: PAPERS[key].label, picture: url };
    });
    sh.claim('paper');
    paperPicker = root().VisualPicker.render(host, { name: 'paper', legend: 'Paper', options, value: ui.paper, size: 'large', shape: 'tall',
      onChange: value => { ui.paper = value; try{ localStorage.setItem('capubTemplatePaper', ui.paper); }catch(e){ /* per-browser convenience */ } } });
  }
  async function open(){
    const d = ensureDialog();
    if(!ui.paper){ try{ ui.paper = localStorage.getItem('capubTemplatePaper'); }catch(e){ ui.paper = null; } if(!PAPERS[ui.paper]) ui.paper = defaultPaper(); }
    d.querySelector('#placementTemplatesList').innerHTML = '<li class="ptEmpty">Reading the uniform...</li>';
    if(!d.open){ if(typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', ''); }
    try{ ui.plan = await currentPlan(); }catch(e){ console.error('[placement templates]', e); ui.plan = null; }
    try{ fillPaper(d); }catch(e){ console.error('[placement templates]', e); }
    fillList(d);
    return ui.plan;
  }
  // A Finish-panel entry beside the PNG download (the page's markup is not changed: the entry is added here).
  function ensureFinishEntry(){
    if(document.getElementById('placementTemplatesOpen')) return;
    const png = document.getElementById('downloadImage');
    const action = png && png.closest('.finishAction');
    if(!action) return;
    const div = document.createElement('div');
    div.className = 'finishAction';
    div.innerHTML = '<button id="placementTemplatesOpen" type="button" class="ghost">Placement templates (print or 3D-print)</button><div class="hintText">Paper stencils and thin 3D-print aligners that sit on a garment edge. Print the aligners flat, no supports.</div>';
    action.after(div);
    div.querySelector('button').addEventListener('click', open);
  }
  function install(){
    const go = () => { try{ ensureFinishEntry(); }catch(e){ console.error('[placement templates]', e); } };
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
    document.addEventListener('capub:rendered', () => { const d = document.getElementById('placementTemplates'); if(d && d.open) open(); });
  }

  return { plan, paperPages, paperSvg, paperTile, paperPdf, sheetOf, aligners, alignerModel, alignerStl, gaugeSizes, gaugeFiles, gaugeStl, collectItems, sidesFrom, specIds, open, install, fileNames, humanize, PIN_RULE, PAPERS, MM };
});
