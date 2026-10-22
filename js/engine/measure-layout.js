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
  const SOLID = new Set(['badge', 'grade', 'hat', 'hat-view', 'hat-device', 'epaulet-top', 'mini', 'mini-drape', 'mini-medal', 'nametag', 'patch', 'ribbon', 'device', 'text', 'clear']);

  function obstaclesOf(scene){
    return scene.layers
      .filter(l => l.type !== 'measure' && SOLID.has(l.role))
      .map(l => l.type === 'clear' ? { x: l.x, y: l.y, w: l.w, h: l.h } : (l.obstacle || core.layerBounds(l)))
      .filter(b => b && b.w > 0 && b.h > 0);
  }

  // The cap views: a seated cap (role 'hat') and the accessory views (role 'hat-view'), each one box.
  function viewBoxes(scene){
    return scene.layers
      .filter(l => l.type !== 'measure' && (l.role === 'hat' || l.role === 'hat-view'))
      .map(l => l.obstacle || core.layerBounds(l))
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
  // Length of the segment a-b that lies outside box `r`.
  const outsideLength = (a, b, r) => Math.max(0, len(sub(b, a)) - insideLength(a, b, r));
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
    const views = viewBoxes(scene);
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

      // A measure inside a cap view belongs to that view (the grade 1/2 in from the visor on the baseball cap
      // front): its dimension stays beside that view and never lies over, or runs its extension lines across,
      // another cap view, the drawing the label would then seem to measure (D26: every label sits at the
      // distance it reports). When the views stand so close that no side is free, the dimension is drawn on the
      // view's own cloth, next to the measured points: the view's box is then not an obstacle, the grade and the
      // name tape in it still are.
      const mid = mul(add(A, B), 0.5);
      const owner = views.find(v => contains(v, mid)) || null;
      const others = owner ? views.filter(v => v !== owner) : [];
      const crossesOther = (p, q) => others.some(r => insideLength(p, q, r) > 0.005);

      // `hard`: the label may not lie over any piece, over another label or over a dimension already drawn, and no dimension
      // may cross a label already placed (D26: every measurement readable). The first pass is hard; only where it finds
      // nothing does the cost-only search run, which accepts the least bad place.
      const search = (solidsX, shrunkX, strict, outside, hard) => {
        const candidates = [];
        if(!o.offsetOnly) candidates.push({ side: sides[0], d: 0, inline: true });
        for(const s of sides){
          // Each extension line starts at the edge of its own piece.
          const startA = clearance(A, s, solidsX, 1.5 * P), startB = clearance(B, s, solidsX, 1.5 * P);
          // `minOffsetIn`: the line moves at least this many inches (a width measure that must lie past the Velcro it hangs on).
          const first = Math.max(Math.max(startA, startB) + (o.offsetPx != null ? o.offsetPx : PX.minOffset) * P, o.minOffsetIn || 0);
          for(let d = first; d <= first + PX.maxOffset * P; d += PX.step * P) candidates.push({ side: s, d, startA, startB });
        }
        let found = null;
        for(const c of candidates){
          const a = add(A, mul(c.side, c.d)), b = add(B, mul(c.side, c.d));
          const exts = [];
          if(!c.inline){
            const sA = add(A, mul(c.side, c.startA + PX.extGap * P)), sB = add(B, mul(c.side, c.startB + PX.extGap * P));
            const e = mul(c.side, PX.extOver * P);
            exts.push([sA, add(a, e)], [sB, add(b, e)]);
          }
          // The whole run from the measured points to the dimension, not only the drawn part of the extension line:
          // the extension lines start past any piece they leave, which would hide a view they cross.
          if(strict && (crossesOther(a, b) || (!c.inline && (crossesOther(A, add(a, mul(c.side, PX.extOver * P))) || crossesOther(B, add(b, mul(c.side, PX.extOver * P))))))) continue;
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
            // A dimension whose sides are all artwork (the 1/2 in gap between two patches on a sleeve) carries its label past
            // one end, on the line's own axis, where the cloth is free (hard pass only).
            if(hard && t === 0.5){
              const half = extent(u) / 2 + PX.labelGap * P;
              for(let k = 0; k < 2; k++){
                const more = k * 5 * PX.step * P;     // slid on along the axis until it clears the pieces around the end
                modes.push({ name: 'end-b', at: add(b, mul(u, half + more)), cost: 14 + 4 * k }, { name: 'end-a', at: add(a, mul(u, -(half + more))), cost: 14 + 4 * k });
              }
            }
          }

          // Line costs, shared by every label mode.
          let lineCost = 0;
          for(const r of shrunkX) lineCost += 60 * insideLength(a, b, r) / P;
          // An extension line over a patch hides it; one that runs out of the view is cut off.
          for(const [p, q] of exts) for(const r of shrunkX) lineCost += 24 * insideLength(p, q, r) / P;
          if(area){
            lineCost += 60 * outsideLength(a, b, area) / P;
            for(const [p, q] of exts) lineCost += 60 * outsideLength(p, q, area) / P;
          }
          for(const lab of placedLabels) lineCost += 40 * insideLength(a, b, lab) / P;
          if(hard && (placedLabels.some(lab => insideLength(a, b, lab) > 0 || exts.some(([p, q]) => insideLength(p, q, lab) > 0)) || shrunkX.some(r => insideLength(a, b, r) > 0 || exts.some(([p, q]) => insideLength(p, q, r) > 0)))) continue;
          lineCost += c.d / P;

          // The halfway tick stays in view.
          const tickAt = o.mid ? add(a, mul(u, dot(sub(o.mid, A), u))) : null;
          for(const md of modes){
            const box = { x: md.at.x - lw / 2, y: md.at.y - lh / 2, w: lw, h: lh };
            if(strict && others.some(r => overlap(box, r) > 0)) continue;
            if(outside && overlap(box, outside) > 0) continue;
            if(hard){
              const sink = 0.25 * P;
              if(solidsX.some(r => overlap(box, grow(r, -sink)) > 0)) continue;
              if(placedLabels.some(r => overlap(box, grow(r, 2 * P)) > 0)) continue;
              if(placedLines.some(([p, q]) => insideLength(p, q, box) > 0)) continue;
              if(area && overlap(box, area) < lw * lh - 1e-9) continue;
            }
            let cost = lineCost + md.cost;
            if(tickAt && contains(grow(box, 3 * P), tickAt)) cost += 300;
            for(const r of solidsX) cost += 6 * overlap(box, r) / (P * P);
            for(const r of placedLabels) cost += 30 * overlap(box, grow(r, 2 * P)) / (P * P);
            for(const [p, q] of placedLines) cost += 20 * insideLength(p, q, box) / P;
            if(area){
              const inside = overlap(box, area);
              cost += 30 * (lw * lh - inside) / (P * P);
            }
            if(!found || cost < found.cost) found = { cost, c, a, b, box, exts, mode: md.name };
          }
        }
        return found;
      };

      // First beside the view, label outside it (the seated cap's own measure); then, where no side is free, on its cloth.
      let best = search(solids, shrunk, !!owner, owner, true) || search(solids, shrunk, !!owner, owner, false);
      if(!best && owner){
        const solids2 = solids.filter(b => !(b.x === owner.x && b.y === owner.y && b.w === owner.w && b.h === owner.h));
        best = search(solids2, solids2.map(b => grow(b, -1.5 * P)).filter(b => b.w > 0 && b.h > 0), true, null);
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
        centres: [],
        // The edge being measured, when the artwork does not draw it (a seam): a dashed line.
        reference: o.reference ? [A, B] : null
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
