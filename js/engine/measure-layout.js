// Uniform engine: lays out the measurement overlay.
//
// Each regulation distance is drawn the way a drafter draws one: a dimension line with a bar at each
// end, labelled with its length. Where the straight line from one edge to the other is clear it is
// drawn there; where it would cross the artwork it moves off to the side, with thin extension lines
// back to the edges it measures. A distance to a badge's centre gets a centre mark. Each label is set
// where it covers no artwork and no other label.
//
// Positions are in scene inches. Sizes are in preview pixels (`px` inches each), so the overlay reads
// the same on a coat and on a wide field sheet. Pure geometry: the renderer draws the result.
(function(root, factory){
  const node = typeof module === 'object' && module.exports;
  const core = node ? require('./core.js') : root.CAPUBEngine.core;
  const api = factory(core);
  if(node) module.exports = api;
  else { root.CAPUBEngine = root.CAPUBEngine || {}; root.CAPUBEngine.measureLayout = api; }
})(typeof self !== 'undefined' ? self : this, function(core){
  'use strict';

  // Preview pixels.
  const PX = {
    font: 11, padX: 4, padY: 2.5, labelGap: 3,
    bar: 8, centre: 5, extGap: 2, extOver: 4,
    minOffset: 10, step: 4, maxOffset: 170
  };

  // Placed pieces the overlay keeps clear of. Garment sheets and their overlays are the cloth itself;
  // `clear` marks drawn-in pieces (a nametag on the sheet) that the profile asks to keep clear.
  const SOLID = new Set(['badge', 'grade', 'hat', 'hat-device', 'epaulet-top', 'mini', 'mini-drape', 'mini-medal', 'nametag', 'patch', 'ribbon', 'device', 'text', 'clear']);

  function obstaclesOf(scene){
    return scene.layers
      .filter(l => l.type !== 'measure' && SOLID.has(l.role))
      .map(l => l.type === 'clear' ? { x: l.x, y: l.y, w: l.w, h: l.h } : core.layerBounds(l))
      .filter(b => b && b.w > 0 && b.h > 0);
  }

  // ---- geometry ----
  const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
  const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
  const mul = (a, k) => ({ x: a.x * k, y: a.y * k });
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  const len = a => Math.hypot(a.x, a.y);
  const unit = a => { const l = len(a) || 1; return { x: a.x / l, y: a.y / l }; };

  function grow(b, e){ return { x: b.x - e, y: b.y - e, w: b.w + 2 * e, h: b.h + 2 * e }; }
  function contains(b, p){ return p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h; }
  function overlap(a, b){
    const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    return w > 0 && h > 0 ? w * h : 0;
  }
  // Length of the segment a-b inside box `r` (Liang-Barsky clipping).
  function insideLength(a, b, r){
    const d = sub(b, a);
    let t0 = 0, t1 = 1;
    const edges = [[-d.x, a.x - r.x], [d.x, r.x + r.w - a.x], [-d.y, a.y - r.y], [d.y, r.y + r.h - a.y]];
    for(const [p, q] of edges){
      if(p === 0){ if(q < 0) return 0; continue; }
      const t = q / p;
      if(p < 0){ if(t > t1) return 0; if(t > t0) t0 = t; }
      else { if(t < t0) return 0; if(t < t1) t1 = t; }
    }
    return t1 > t0 ? (t1 - t0) * len(d) : 0;
  }
  // How far from `p` along `v` until it leaves every piece it starts on (and any piece that piece
  // runs into), so an extension line starts at the edge of the artwork, not across it.
  function clearance(p, v, boxes, eps){
    let t = 0;
    for(let guard = 0; guard < 24; guard++){
      const q = add(p, mul(v, t));
      const hit = boxes.find(b => contains(grow(b, eps), q));
      if(!hit) return t;
      const g = grow(hit, eps);
      const tx = v.x > 1e-9 ? (g.x + g.w - p.x) / v.x : v.x < -1e-9 ? (g.x - p.x) / v.x : Infinity;
      const ty = v.y > 1e-9 ? (g.y + g.h - p.y) / v.y : v.y < -1e-9 ? (g.y - p.y) / v.y : Infinity;
      t = Math.max(t, Math.min(tx, ty)) + eps * 0.01;
    }
    return t;
  }

  // Label width in ems for Arial Bold (close enough to size the pill around the text).
  const EM = { ' ': 0.278, i: 0.278, l: 0.278, j: 0.278, f: 0.333, t: 0.333, r: 0.389, m: 0.889, w: 0.778 };
  function textWidth(text, size){
    let w = 0;
    for(const ch of String(text)){
      if(/[0-9]/.test(ch)) w += 0.556;
      else if(/[¼-¾⅛-⅞]/.test(ch)) w += 0.834;
      else w += EM[ch] != null ? EM[ch] : 0.6;
    }
    return w * size;
  }

  // Lay out every measure layer of a scene. `view` = { px, area }: inches per preview pixel and the
  // drawing's visible box. Returns one drawing per measure, in the scene's order.
  function layout(scene, view){
    const P = view.px;
    const area = view.area;
    const solids = obstaclesOf(scene);
    const shrunk = solids.map(b => grow(b, -1.5 * P)).filter(b => b.w > 0 && b.h > 0);
    const placedLabels = [];
    const placedLines = [];
    const out = [];
    const fontSize = PX.font * P;

    for(const m of scene.layers.filter(l => l.type === 'measure')){
      const A = m.from, B = m.to;
      const L = len(sub(B, A));
      if(L < 1e-6) continue;
      const u = unit(sub(B, A));
      const n = { x: -u.y, y: u.x };
      const o = m.opts || {};
      const text = m.label;
      const lw = textWidth(text, fontSize) + 2 * PX.padX * P;
      const lh = fontSize * 1.25 + 2 * PX.padY * P;
      // How much of the label lies along a direction.
      const extent = v => Math.abs(v.x) * lw + Math.abs(v.y) * lh;

      let sides = [n, mul(n, -1)];
      if(o.side){
        const s = dot(o.side, n) >= 0 ? n : mul(n, -1);
        sides = [s];
      }
      const candidates = [];
      if(!o.offsetOnly) candidates.push({ side: sides[0], d: 0, inline: true });
      for(const s of sides){
        // Each extension line starts at the edge of its own piece.
        const startA = clearance(A, s, solids, 1.5 * P), startB = clearance(B, s, solids, 1.5 * P);
        const first = Math.max(Math.max(startA, startB) + PX.minOffset * P, o.minOffset || 0);
        for(let d = first; d <= first + PX.maxOffset * P; d += PX.step * P) candidates.push({ side: s, d, startA, startB });
      }

      let best = null;
      for(const c of candidates){
        const a = add(A, mul(c.side, c.d)), b = add(B, mul(c.side, c.d));
        const modes = [];
        // The label goes at the middle of the line when it can, else slides along it (a long line
        // past a chevron keeps its label on clear cloth).
        const along = L > 3 * extent(u) ? [0.5, 0.35, 0.65, 0.2, 0.8] : [0.5];
        for(const t of along){
          const at = add(a, mul(sub(b, a), t));
          const slide = Math.abs(t - 0.5) * 60;
          // Centred on the line when it is long enough to show both bars beside the label.
          if(L >= extent(u) + 2 * (PX.bar * 0.5 + 4) * P && (t === 0.5 || L * Math.min(t, 1 - t) > extent(u) / 2 + 6 * P)) modes.push({ name: 'centre', at, cost: slide });
          const outward = c.inline ? [c.side, mul(c.side, -1)] : [c.side];
          outward.forEach((v, i) => modes.push({ name: 'beside', at: add(at, mul(v, extent(v) / 2 + PX.labelGap * P)), cost: slide + (i ? 6 : 0) }));
          if(!c.inline) modes.push({ name: 'beside-in', at: add(at, mul(c.side, -(extent(c.side) / 2 + PX.labelGap * P))), cost: slide + 25 });
        }

        // Line costs, shared by every label mode.
        let lineCost = 0;
        for(const r of shrunk) lineCost += 60 * insideLength(a, b, r) / P;
        const exts = [];
        if(!c.inline){
          const sA = add(A, mul(c.side, c.startA + PX.extGap * P)), sB = add(B, mul(c.side, c.startB + PX.extGap * P));
          const e = mul(c.side, PX.extOver * P);
          exts.push([sA, add(a, e)], [sB, add(b, e)]);
          for(const [p, q] of exts) for(const r of shrunk) lineCost += 4 * insideLength(p, q, r) / P;
        }
        for(const lab of placedLabels) lineCost += 40 * insideLength(a, b, lab) / P;
        lineCost += c.d / P;

        // The halfway tick stays in view.
        const tickAt = o.mid ? add(a, mul(u, dot(sub(o.mid, A), u))) : null;
        for(const md of modes){
          const box = { x: md.at.x - lw / 2, y: md.at.y - lh / 2, w: lw, h: lh };
          let cost = lineCost + md.cost;
          if(tickAt && contains(grow(box, 3 * P), tickAt)) cost += 300;
          for(const r of solids) cost += 6 * overlap(box, r) / (P * P);
          for(const r of placedLabels) cost += 30 * overlap(box, grow(r, 2 * P)) / (P * P);
          for(const [p, q] of placedLines) cost += 20 * insideLength(p, q, box) / P;
          if(area){
            const inside = overlap(box, area);
            cost += 30 * (lw * lh - inside) / (P * P);
          }
          if(!best || cost < best.cost) best = { cost, c, a, b, box, exts, mode: md.name };
        }
      }
      if(!best) continue;

      const { a, b, box, exts } = best;
      const half = mul(n, PX.bar * P / 2);
      const drawing = {
        key: m.key,
        label: Object.assign({ text }, box),
        dim: [a, b],
        bars: [[sub(a, half), add(a, half)], [sub(b, half), add(b, half)]],
        ext: exts,
        ticks: [],
        centres: []
      };
      if(o.mid){
        const t = dot(sub(o.mid, A), u);
        const p = add(a, mul(u, t));
        const tk = mul(n, PX.bar * P * 0.4);
        drawing.ticks.push([sub(p, tk), add(p, tk)]);
      }
      const c = PX.centre * P;
      for(const p of o.center === 'both' ? [A, B] : o.center === 'from' ? [A] : o.center === 'to' ? [B] : []){
        drawing.centres.push([{ x: p.x - c, y: p.y }, { x: p.x + c, y: p.y }], [{ x: p.x, y: p.y - c }, { x: p.x, y: p.y + c }]);
      }
      placedLabels.push(box);
      placedLines.push([a, b], ...exts);
      out.push(drawing);
    }
    return out;
  }

  // Inches per preview pixel for a viewBox shown on the builder's stage (640 px high, at most
  // 1200 px wide; see sizeStage in js/uniform-view.js).
  function previewPx(vb, stage){
    const s = stage || { h: 640, maxW: 1200 };
    return Math.max(vb[3] / s.h, vb[2] / s.maxW);
  }

  return { layout, previewPx, obstaclesOf, textWidth, PX };
});
