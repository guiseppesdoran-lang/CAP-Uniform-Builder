// Uniform engine: lays out the measurement overlay.
//
// Each regulation distance is drawn the way a drafter draws one: a dimension line with a bar at each
// end, labelled with its length. Where the straight line from one edge to the other is clear it is
// drawn there; where it would cross the artwork it moves off to the side, with thin extension lines
// back to the edges it measures. A distance to a badge's centre gets a centre mark: an open crosshair
// (a ring with four ticks outside it, empty inside), never a solid cross over the artwork. Each label is set
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
    // The centre mark: an open crosshair, a thin ring with four short ticks outside it and nothing at all inside (the middle of the
    // piece it marks stays visible): ring radius, then the ticks' inner and outer distance from the centre.
    mark: { ring: 4, tickFrom: 6, tickTo: 10 },
    minOffset: 10, step: 4, maxOffset: 170
  };

  // How near a label stays to its own dimension line, in label heights (see labelDistance).
  const LABEL_RADIUS = 1;
  const SLIDE_LINES = 3;

  // Placed pieces the overlay keeps clear of. Garment sheets and their overlays are the cloth itself;
  // `clear` marks drawn-in pieces (a nametag on the sheet) that the profile asks to keep clear.
  const SOLID = new Set(['badge', 'grade', 'hat', 'hat-view', 'hat-device', 'sleeve-flat', 'epaulet-top', 'mini', 'mini-drape', 'mini-medal', 'nametag', 'patch', 'ribbon', 'device', 'text', 'clear']);

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
  // Distance from a point to a box (0 inside it).
  function pointBoxDistance(p, b){
    return Math.hypot(Math.max(b.x - p.x, 0, p.x - b.x - b.w), Math.max(b.y - p.y, 0, p.y - b.y - b.h));
  }
  // Distance from the segment a-b to a box (0 where they meet).
  function segBoxDistance(a, b, box){
    if(contains(box, a) || contains(box, b) || insideLength(a, b, box) > 0) return 0;
    const corners = [{ x: box.x, y: box.y }, { x: box.x + box.w, y: box.y }, { x: box.x + box.w, y: box.y + box.h }, { x: box.x, y: box.y + box.h }];
    const toSeg = p => { const d = sub(b, a), t = Math.max(0, Math.min(1, dot(sub(p, a), d) / (dot(d, d) || 1))); return len(sub(p, add(a, mul(d, t)))); };
    return Math.min(pointBoxDistance(a, box), pointBoxDistance(b, box), ...corners.map(toSeg));
  }
  // How far a label is from its own dimension line (`a` to `b`, as drawn), in the same units as the points. A label rides along a line
  // longer than SLIDE_LINES of its own lengths (so a long line past a chevron keeps it on clear cloth) and is measured from the line itself;
  // on a shorter line it is measured from the line's middle. Both must come to LABEL_RADIUS label heights or less.
  function labelDistance(a, b, box){
    const u = unit(sub(b, a)), extent = Math.abs(u.x) * box.w + Math.abs(u.y) * box.h;
    return len(sub(b, a)) > SLIDE_LINES * extent ? segBoxDistance(a, b, box) : pointBoxDistance(mul(add(a, b), 0.5), box);
  }
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

  // ---- magnified callouts for small distances ----
  //
  // A distance of 1/8 in is a 2 to 5 px tick on the stage: it shows neither what it spans nor that it spans anything.
  // A measure that carries `opts.callout` is drawn as a magnified inset instead: a circle beside the piece that shows
  // the measured corner `mag` times larger, with the band highlighted and a proper dimension line across it, and a
  // leader line from the circle to the corner. The same band is outlined on the piece itself.
  //   opts.callout = { layer: key, border: inches, caption }   a cloth border (the blue backing past the embroidery): the
  //                                                            band between the piece's cut edge and its embroidery edge,
  //                                                            read from the piece's own frame (border inches in from the
  //                                                            top-left corner of the placed layer `key`)
  //   opts.callout = { gap: true, caption }                    a bare gap between two edges (the measure's own two ends)
  // Sizes in preview pixels like the rest of the overlay.
  const CO = { diameter: 84, mag: 4, rim: 2.2, gapOut: 9, over: 4, minLen: 0.5, leaderDot: 1.8, captionFont: 9, edgeLen: 0.5, search: [10, 18, 28, 40, 54, 70, 90, 115, 145, 180] };

  // The frame of a placed layer: its top-left corner in the scene, and the scene directions of its own x (ex) and y (ey) axes
  // (a piece turned or mirrored on the garment keeps its band where the piece's own edge is).
  function pieceFrame(scene, key, near){
    const cands = scene.layers.filter(l => l.type === 'asset' && l.key === key);
    if(!cands.length) return null;
    const centre = l => ({ x: l.x + l.w / 2, y: l.y + l.h / 2 });
    const layer = cands.reduce((a, l) => (len(sub(centre(l), near)) < len(sub(centre(a), near)) ? l : a));
    const o = layer.origin || { x: layer.x, y: layer.y }, deg = layer.rotate || 0, cx = layer.x + layer.w / 2;
    const toScene = (x, y) => core.rotatePoint({ x: layer.flipX ? 2 * cx - x : x, y }, o, deg);
    const p0 = toScene(layer.x, layer.y);
    return { O: p0, ex: unit(sub(toScene(layer.x + 1, layer.y), p0)), ey: unit(sub(toScene(layer.x, layer.y + 1), p0)), w: layer.w, h: layer.h };
  }

  // Separating-axis test for two convex polygons.
  function polysOverlap(A, B){
    for(const poly of [A, B]){
      for(let i = 0; i < poly.length; i++){
        const e = sub(poly[(i + 1) % poly.length], poly[i]);
        const ax = unit({ x: -e.y, y: e.x });
        const pa = A.map(p => dot(p, ax)), pb = B.map(p => dot(p, ax));
        if(Math.max(...pa) <= Math.min(...pb) + 1e-9 || Math.max(...pb) <= Math.min(...pa) + 1e-9) return false;
      }
    }
    return true;
  }
  const rectPoly = r => [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }, { x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h }];

  // How the band is shown inside the circle, relative to the circle's centre and measured in inches of the magnified view:
  // the highlighted band, the dimension line across it with its extension lines and bars, and the label beside it. Tried
  // with the band's corner at several offsets from the centre (the label needs room on the cloth side of the corner) and with
  // the dimension on either of the corner's two edges; the first that keeps everything inside the circle and the label off the
  // piece wins.
  function insetArrangement(frame, b, lw, lh, P){
    const M = CO.mag, r = CO.diameter * P / 2, mb = M * b, ex = frame.ex, ey = frame.ey;
    const off = CO.gapOut * P, over = PX.extOver * P, gap = PX.extGap * P, bar = PX.bar * P;
    const labelExt = v => Math.abs(v.x) * lw + Math.abs(v.y) * lh;
    const inCircle = (p, m) => len(p) <= r - m;
    let best = null;
    for(const [along, across, penalty] of [[ex, ey, 0], [ey, ex, 3]]){
      // `along`: the edge the dimension is offset from (away from the piece); `across`: the direction the band is measured in.
      const out = mul(along, -1);
      for(let gx = -0.45; gx <= 0.451; gx += 0.05) for(let gy = -0.45; gy <= 0.451; gy += 0.05){
        const K = { x: gx * 2 * r, y: gy * 2 * r };
        if(len(K) > 0.62 * 2 * r) continue;
        // The piece's corner is the centre of the arrangement: its two edges run out from K along ex and ey.
        const d0 = add(K, mul(out, off)), d1 = add(d0, mul(across, mb));
        const midD = mul(add(d0, d1), 0.5);
        const lc = add(midD, mul(out, bar / 2 + PX.labelGap * P + labelExt(out) / 2));
        const label = { x: lc.x - lw / 2, y: lc.y - lh / 2, w: lw, h: lh };
        const half = mul(along, bar / 2);
        const ext = [[add(K, mul(out, gap)), add(d0, mul(out, over))], [add(add(K, mul(across, mb)), mul(out, gap)), add(d1, mul(out, over))]];
        const pts = [d0, d1, ...ext.flat(), add(d0, half), sub(d0, half), add(d1, half), sub(d1, half), ...rectPoly(label)];
        if(!pts.every(p => inCircle(p, 1.5 * P))) continue;
        const quad = frame.w != null ? [K, add(K, mul(ex, M * frame.w)), add(add(K, mul(ex, M * frame.w)), mul(ey, M * frame.h)), add(K, mul(ey, M * frame.h))] : null;
        if(quad && polysOverlap(rectPoly(grow(label, P)), quad)) continue;
        const cost = len(K) / P + penalty;
        if(!best || cost < best.cost) best = { cost, K, out, along, across, d0, d1, ext, label, bars: [[sub(d0, half), add(d0, half)], [sub(d1, half), add(d1, half)]] };
      }
    }
    return best;
  }

  // A band's shapes in scene inches: the filled band, and the two outlines (the cut edge and the embroidery edge). `ax`/`ay` are
  // how far the outlines run along the piece's two edges from the corner.
  function bandShapes(frame, b, ax, ay){
    const { O, ex, ey } = frame;
    const at = (s, t) => add(O, add(mul(ex, s), mul(ey, t)));
    if(frame.w == null){
      // A gap between two edges: two lines along ex, `ax` long each way from O.
      const l1 = [at(-ax, 0), at(ax, 0)], l2 = [at(-ax, b), at(ax, b)];
      return { fill: [l1[0], l1[1], l2[1], l2[0]], lines: [l1, l2] };
    }
    return {
      fill: [at(0, 0), at(ax, 0), at(ax, b), at(b, b), at(b, ay), at(0, ay)],
      lines: [[at(ax, 0), at(0, 0), at(0, ay)], [at(ax, b), at(b, b), at(b, ay)]]
    };
  }

  // A centre mark at `p`: the ring (centre, radius) and its four ticks, each a segment that starts outside the ring (so the ring's inside is
  // empty and the piece's own centre shows through), all in scene inches.
  function centreMark(p, P){
    const M = PX.mark, ticks = [];
    for(const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) ticks.push([{ x: p.x + dx * M.tickFrom * P, y: p.y + dy * M.tickFrom * P }, { x: p.x + dx * M.tickTo * P, y: p.y + dy * M.tickTo * P }]);
    return { x: p.x, y: p.y, r: M.ring * P, ticks };
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
    const fontSize = PX.font * P;

      // ---- a magnified callout (opts.callout): the inset beside the piece, laid out first so that every other label keeps clear of it ----
      const placeCallout = (m, ci) => {
        const A = m.from, B = m.to, o = m.opts.callout;
        const lw = textWidth(m.label, fontSize) + 2 * PX.padX * P, lh = fontSize * 1.25 + 2 * PX.padY * P;
        const b = len(sub(B, A));
        let frame = null;
        if(o.layer){
          frame = pieceFrame(scene, o.layer, A);
          if(!frame) return null;
        }else{
          frame = { O: A, ex: { x: -unit(sub(B, A)).y, y: unit(sub(B, A)).x }, ey: unit(sub(B, A)), w: null, h: null };
        }
        const border = o.border != null ? o.border : b;
        const arr = insetArrangement(frame, border, lw, lh, P);
        if(!arr) return null;
        const M = CO.mag, r = CO.diameter * P / 2;
        // The caption under the circle: the words split into lines of at most 15 characters.
        const capSize = CO.captionFont * P;
        const words = String(o.caption || '').split(/\s+/).filter(Boolean), capLines = [];
        for(const w of words){ const last = capLines[capLines.length - 1]; if(last && (last + ' ' + w).length <= 15) capLines[capLines.length - 1] = last + ' ' + w; else capLines.push(w); }
        const capW = capLines.length ? Math.max(...capLines.map(t => textWidth(t, capSize))) + 2 * PX.padX * P : 0;
        const capH = capLines.length ? capLines.length * capSize * 1.2 + 2 * PX.padY * P : 0;
        const capGap = 2 * P;
        const C = frame.O;
        // The own piece's polygon (so the leader and the circle do not run over it).
        const own = frame.w != null ? [C, add(C, mul(frame.ex, frame.w)), add(add(C, mul(frame.ex, frame.w)), mul(frame.ey, frame.h)), add(C, mul(frame.ey, frame.h))] : null;
        const ownBounds = own ? { x: Math.min(...own.map(p => p.x)), y: Math.min(...own.map(p => p.y)), w: Math.max(...own.map(p => p.x)) - Math.min(...own.map(p => p.x)), h: Math.max(...own.map(p => p.y)) - Math.min(...own.map(p => p.y)) } : null;
        // The measured piece is the one solid the circle may touch (the cap view it sits on is not: the circle stays off it). The leader
        // starts on the piece and may cross the cloth it lies on (the cap view's own box) but no other piece.
        const isOwn = s => ownBounds && contains(grow(s, 0.03), C) && s.w * s.h <= 1.5 * ownBounds.w * ownBounds.h;
        // The sheet's sleeve pocket and loop outlines (role 'surface') are not obstacles to labels, only to the circle and its caption.
        const surfaces = scene.layers.filter(l => l.role === 'surface').map(l => ({ x: l.x, y: l.y, w: l.w, h: l.h }));
        const others = solids.filter(s => !isOwn(s)).concat(surfaces);
        // The leader is a hairline: it may cross a tape or patch the garment sheet draws (role 'clear'), which the circle and the captions
        // keep clear of, but not a piece placed on the garment (a badge, a grade, a patch, a label).
        const placedSolids = obstaclesOf({ layers: scene.layers.filter(l => l.role !== 'clear') });
        const leaderSolids = (ownBounds ? placedSolids.filter(s => !contains(grow(s, 0.03), C)) : placedSolids).map(s => grow(s, -1.5 * P)).filter(s => s.w > 0 && s.h > 0);
        const garments = scene.layers.filter(l => l.type !== 'measure' && l.role === 'garment').map(l => core.layerBounds(l));
        let best = null;
        for(const hard of [true, false]){
          for(const d of CO.search){
            for(let k = 0; k < 24; k++){
              const ang = (k / 24) * 2 * Math.PI;
              const dir = { x: Math.cos(ang), y: Math.sin(ang) };
              const c = add(C, mul(dir, (CO.diameter / 2 + d) * P));
              const circ = { x: c.x - r, y: c.y - r, w: 2 * r, h: 2 * r };
              const cap = capLines.length ? { x: c.x - capW / 2, y: c.y + r + capGap, w: capW, h: capH } : null;
              const boxAll = cap ? core.unionBounds([circ, cap]) : circ;
              if(area && overlap(boxAll, area) < boxAll.w * boxAll.h - 1e-9) continue;
              // The leader leaves the circle toward the corner and must come to it from outside the piece.
              const v = sub(C, c);
              if(!(len(v) > r)) continue;
              const vu = unit(v);
              if(frame.w != null && dot(vu, frame.ex) < -1e-9 && dot(vu, frame.ey) < -1e-9) continue;
              const rim = add(c, mul(vu, r));
              let cost = d + k * 0.01;
              const hit = (list, box) => list.some(s => overlap(box, s) > 0);
              if(hard){
                if(hit(others.map(s => grow(s, 0.25 * P)), boxAll)) continue;
                if(ownBounds && overlap(boxAll, ownBounds) > 0) continue;
                if(placedLabels.some(lab => overlap(boxAll, grow(lab, 2 * P)) > 0)) continue;
                if(placedLines.some(([p, q]) => insideLength(p, q, boxAll) > 0)) continue;
                if(leaderSolids.some(s => insideLength(rim, C, s) > 0)) continue;
                if(placedLabels.some(lab => insideLength(rim, C, lab) > 0)) continue;
              }else{
                for(const s of others) cost += 40 * overlap(boxAll, s) / (P * P);
                if(ownBounds) cost += 40 * overlap(boxAll, ownBounds) / (P * P);
                for(const lab of placedLabels) cost += 30 * overlap(boxAll, lab) / (P * P);
                for(const [p, q] of placedLines) cost += 20 * insideLength(p, q, boxAll) / P;
                for(const s of leaderSolids) cost += 60 * insideLength(rim, C, s) / P;
              }
              // A leader across a tape or patch the sheet draws is allowed but not liked.
              for(const l of scene.layers) if(l.role === 'clear') cost += 2 * insideLength(rim, C, { x: l.x, y: l.y, w: l.w, h: l.h }) / P;
              // Outboard of the figure when it can be: the garment sheet's own cloth is the last choice.
              for(const g of garments) cost += 0.004 * overlap(circ, g) / (P * P);
              if(!best || cost < best.cost) best = { cost, c, circ, cap, boxAll, rim, hard };
            }
          }
          if(best) break;
        }
        if(!best) return null;
        const { c, cap, boxAll, rim } = best;
        const W = sub(C, mul(arr.K, 1 / M));      // the scene point at the circle's centre
        const toInset = p => add(c, mul(sub(p, W), M));
        const shift = p => add(c, p);
        // On the piece: the band along its corner, the way the member will see it when pinning.
        const edge = Math.min(CO.edgeLen, 0.5 * (frame.w != null ? Math.min(frame.w, frame.h) : 2));
        const real = bandShapes(frame, border, edge, edge);
        const inset = bandShapes(frame, border, frame.w != null ? frame.w : 3 * r / M, frame.h != null ? frame.h : 0);
        const lab = shift({ x: arr.label.x, y: arr.label.y });
        const drawing = {
          key: m.key,
          label: { text: m.label, x: lab.x, y: lab.y, w: lw, h: lh },
          dim: [shift(arr.d0), shift(arr.d1)],
          bars: arr.bars.map(([p, q]) => [shift(p), shift(q)]),
          ext: arr.ext.map(([p, q]) => [shift(p), shift(q)]),
          ticks: [], centres: [], reference: null,
          callout: {
            center: c, r, mag: M, focus: W,
            window: { x: W.x - r / M, y: W.y - r / M, w: 2 * r / M, h: 2 * r / M },
            box: boxAll,
            leader: [rim, C],
            real: { fill: real.fill, lines: real.lines },
            inset: { fill: inset.fill.map(toInset), lines: inset.lines.map(l => l.map(toInset)) },
            caption: cap ? Object.assign({ lines: capLines, size: capSize }, cap) : null,
            border, kind: o.layer ? 'band' : 'gap', hard: best.hard
          }
        };
        placedLabels.push(boxAll);
        placedLines.push([rim, C]);
        return drawing;
      };

    // The callouts go last: the plain dimensions keep the places they have always had, and each circle, which can sit a long way from its piece, finds room around them.
    const measures = scene.layers.filter(l => l.type === 'measure');
    const isCallout = m => !!(m.opts && m.opts.callout);
    const order = measures.map((m, i) => i).sort((i, j) => (isCallout(measures[i]) ? 1 : 0) - (isCallout(measures[j]) ? 1 : 0));
    const slots = new Array(measures.length).fill(null);

    for(const mi of order){
      const m = measures[mi];
      const A = m.from, B = m.to;
      const L = len(sub(B, A));
      if(L < 1e-6) continue;
      if(isCallout(m)){ const dc = placeCallout(m, mi); if(dc){ slots[mi] = dc; continue; } }
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
      const search = (solidsX, shrunkX, strict, outside, hard, rad) => {
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
            // A width measure that hangs below the Velcro (`minOffsetIn`) keeps its label beside the line, on the open side: centred on the
            // line, the label would cover the gap between the two patches, where the next measures' extension lines must run.
            if(!o.minOffsetIn && L >= extent(u) + 2 * (PX.bar * 0.5 + 4) * P && (t === 0.5 || L * Math.min(t, 1 - t) > extent(u) / 2 + 6 * P)) modes.push({ name: 'centre', at, cost: slide });
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
          // The label belongs to its own dimension: its box lies within one label height of the middle of the line as drawn (the offset
          // line, when the line was moved off the artwork). Where no clear spot exists that near, the line is offset further, not the label.
          for(const md of modes){
            const box = { x: md.at.x - lw / 2, y: md.at.y - lh / 2, w: lw, h: lh };
            if(rad < Infinity && labelDistance(a, b, box) > rad) continue;
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
      // The label stays within LABEL_RADIUS label heights of its dimension (the offset line keeps moving out until it finds a clear spot that
      // near); only if even the farthest offset has none does the old, unconstrained search run, so that no measure is dropped.
      const near = lh * LABEL_RADIUS;
      let best = null;
      for(const rad of [near, Infinity]){
        best = search(solids, shrunk, !!owner, owner, true, rad) || search(solids, shrunk, !!owner, owner, false, rad);
        if(!best && owner){
          const solids2 = solids.filter(b => !(b.x === owner.x && b.y === owner.y && b.w === owner.w && b.h === owner.h));
          best = search(solids2, solids2.map(b => grow(b, -1.5 * P)).filter(b => b.w > 0 && b.h > 0), true, null, false, rad);
        }
        if(best) break;
      }
      if(!best) continue;

      const { a, b, box, exts } = best;
      const half = mul(n, PX.bar * P / 2);
      // A dimension drawn on the line itself that ends at a centre stops at the centre mark's ring and carries no bar there: the ring is its
      // end, and nothing is drawn inside it (the piece's own centre stays visible).
      const atA = o.center === 'both' || o.center === 'from', atB = o.center === 'both' || o.center === 'to';
      const ringIn = PX.mark.ring * P;
      const bars = [];
      let da = a, db = b;
      if(best.c.inline){
        if(atA && L > 2 * ringIn) da = add(a, mul(u, ringIn));
        if(atB && L > 2 * ringIn) db = sub(b, mul(u, ringIn));
      }
      if(!(best.c.inline && atA)) bars.push([sub(a, half), add(a, half)]);
      if(!(best.c.inline && atB)) bars.push([sub(b, half), add(b, half)]);
      const drawing = {
        key: m.key,
        label: Object.assign({ text }, box),
        dim: [da, db],
        bars,
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
      for(const p of o.center === 'both' ? [A, B] : o.center === 'from' ? [A] : o.center === 'to' ? [B] : []) drawing.centres.push(centreMark(p, P));
      placedLabels.push(box);
      placedLines.push([a, b], ...exts);
      slots[mi] = drawing;
    }
    return slots.filter(Boolean);
  }

  // Inches per preview pixel for a viewBox shown on the builder's stage (640 px high, at most
  // 1200 px wide; see sizeStage in js/uniform-view.js).
  function previewPx(vb, stage){
    const s = stage || { h: 640, maxW: 1200 };
    return Math.max(vb[3] / s.h, vb[2] / s.maxW);
  }

  return { layout, previewPx, obstaclesOf, textWidth, centreMark, pointBoxDistance, labelDistance, PX, CALLOUT: CO, LABEL_RADIUS, SLIDE_LINES };
});
