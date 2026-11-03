// Uniform engine, part 5: one profile per uniform.
//
// A profile says which garment and layers the member wears and where each kind of item goes, in
// terms of the garment's own anchors and the regulation's distances. The member's selections come
// in as a `build` (see js/uniform-view.js, which makes it from the page state):
//   { uniform, gender, grade (grades.gradeInfo), opt {...garment options}, name {first,last,state,show},
//     ribbons [...], medals [...], badges [{id,family,title}], command {id,graduated}|null,
//     militaryBadges [...], patches [{id,href,aspect,slot,title}], cord }
// Paragraph numbers are CAPR 39-1 (with the ICLs through 26-04; where an ICL changed a rule, the ICL
// is followed).
(function(root, factory){
  const node = typeof module === 'object' && module.exports;
  const deps = node
    ? { core: require('./core.js'), compose: require('./compose.js'), grades: require('./grades.js'), badges: require('../../data/badge-catalog.js') }
    : { core: root.CAPUBEngine.core, compose: root.CAPUBEngine.compose, grades: root.CAPUBEngine.grades, badges: root.CAPUBBadgeCatalog };
  const api = factory(deps.core, deps.compose, deps.grades, deps.badges);
  if(node) module.exports = api;
  else { root.CAPUBEngine = root.CAPUBEngine || {}; root.CAPUBEngine.profiles = api; }
})(typeof self !== 'undefined' ? self : this, function(core, C, G, B){
  'use strict';
  const Z = C.Z;
  const SILVER_TEXT = '#c9ced6';

  // ---- helpers shared by the profiles -------------------------------------------------------

  // A landmark of a placed piece, in scene inches (for zones on a nametag, a hat's device slot...).
  function pieceRect(layer, spec, name){
    const r = core.landmarkBounds(spec, name);
    if(!r) return null;
    const s = layer.w / spec.w;
    return { x: layer.x + r.x * s, y: layer.y + r.y * s, w: r.w * s, h: r.h * s };
  }
  function piecePoint(layer, spec, name){
    const a = core.anchor(spec, name);
    if(!a) return null;
    const s = layer.w / spec.w;
    return { x: layer.x + a.x * s, y: layer.y + a.y * s };
  }

  // ---- epaulets read from the garment's own landmark --------------------------------------------

  // Height (scene y) of the top boundary of a polygon at x, or null when x is outside it.
  function polygonTopY(points, x){
    let best = null;
    for(let i = 0; i < points.length; i++){
      const a = points[i], b = points[(i + 1) % points.length];
      if(a.x === b.x) continue;
      const lo = Math.min(a.x, b.x), hi = Math.max(a.x, b.x);
      if(x < lo || x > hi) continue;
      const y = a.y + (b.y - a.y) * (x - a.x) / (b.x - a.x);
      if(best == null || y < best) best = y;
    }
    return best;
  }

  // The epaulet strap of one shoulder (`side` is the wearer's side), taken from the garment's
  // epaulet_<side> landmark polygon: the smallest rectangle that holds the polygon gives the strap
  // axis, its length and width; the axis points to the neck end. Returns
  //   { poly, center, axis, normal, length, width, deg, neck, outer, topY(x) }
  // axis/normal are unit vectors (normal points up and out, away from the garment); `deg` is the
  // rotation that stands a piece drawn upright with its button end up onto the strap, button end
  // toward the neck. Null when the garment has no such landmark.
  function epauletFrame(ctx, side){
    const lm = ctx.landmark('epaulet_' + side);
    return frameFromPolygon(ctx, side, lm && lm.points);
  }
  // The same frame from any polygon (the strap of a coat sheet that states its strap axis instead of
  // an epaulet landmark).
  function frameFromPolygon(ctx, side, poly){
    if(!poly || poly.length < 3) return null;
    let best = null;
    for(let t = 0; t < 180; t += 0.25){
      const r = t * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
      let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
      for(const p of poly){
        const u = p.x * c + p.y * s, v = -p.x * s + p.y * c;
        if(u < u0) u0 = u; if(u > u1) u1 = u; if(v < v0) v0 = v; if(v > v1) v1 = v;
      }
      const area = (u1 - u0) * (v1 - v0);
      if(!best || area < best.area - 1e-9) best = { area, c, s, u0, u1, v0, v1 };
    }
    // The rectangle's long side is the strap axis.
    const mu = (best.u0 + best.u1) / 2, mv = (best.v0 + best.v1) / 2;
    const center = { x: mu * best.c - mv * best.s, y: mu * best.s + mv * best.c };
    let ax = { x: best.c, y: best.s };
    let len = best.u1 - best.u0, wid = best.v1 - best.v0;
    if(wid > len){ ax = { x: -best.s, y: best.c }; [len, wid] = [wid, len]; }
    // Axis toward the neck: the end nearer the garment's centre line.
    const mid = ctx.base.w / 2;
    if(Math.abs(center.x + ax.x * len / 2 - mid) > Math.abs(center.x - ax.x * len / 2 - mid)) ax = { x: -ax.x, y: -ax.y };
    // Normal away from the garment: up.
    let nrm = { x: ax.y, y: -ax.x };
    if(nrm.y > 0) nrm = { x: -nrm.x, y: -nrm.y };
    const deg = Math.round((90 + Math.atan2(ax.y, ax.x) * 180 / Math.PI) * 100) / 100;
    return {
      side, poly, center, axis: ax, normal: nrm, length: len, width: wid, deg,
      neck: { x: center.x + ax.x * len / 2, y: center.y + ax.y * len / 2 },
      outer: { x: center.x - ax.x * len / 2, y: center.y - ax.y * len / 2 },
      topY: x => polygonTopY(poly, x)
    };
  }

  // ---- collar insignia on the leading edge of the collar ---------------------------------------

  // Figure A5-5 (CAPR 39-1 page 134, 'shirt without necktie'): the cadet NCO chevron lies parallel to
  // the leading edge of the collar leaf, 1 in from it and centred, the top of the insignia (the chevron
  // peak, on C/SSgt the shield's starred canton) toward the roll-line end (the shirt's centre side) and
  // the rockers toward the collar point, as the figure draws both the male and female panels. On the open collars the sheets draw (Class B, aviator shirt, overblouse,
  // ABU/CFU) the leading edge is the leaf's BOTTOM edge, from the collar point (the leaf's outer tip)
  // to where it meets the lapel roll line. Paragraphs: 4.1.11.1.1.1.4, 4.1.12.2.3.5, 4.2.5.1.1.5,
  // 4.2.6.2.5, 5.1.1.1.1.4, 5.2.1.1.1 ('1 inch from and parallel to the front of the collar and centered').

  // The leading edge of a collar leaf polygon (points in sheet inches): of its edges 1 in or longer,
  // the one whose outward normal points most nearly straight down (the free bottom edge of the leaf).
  // Its end farther from the sheet's centre line is the collar point, the other the roll-line end.
  // One rule for every sheet. Returns { collarPoint, rollEnd, inward } or null.
  function collarLeadingEdge(points, centerX){
    if(!points || points.length < 3) return null;
    let area = 0, cx = 0, cy = 0;
    for(let i = 0; i < points.length; i++){
      const p = points[i], q = points[(i + 1) % points.length], cr = p.x * q.y - q.x * p.y;
      area += cr; cx += (p.x + q.x) * cr; cy += (p.y + q.y) * cr;
    }
    const inside = area ? { x: cx / (3 * area), y: cy / (3 * area) } : { x: points.reduce((s, p) => s + p.x, 0) / points.length, y: points.reduce((s, p) => s + p.y, 0) / points.length };
    let best = null;
    for(let i = 0; i < points.length; i++){
      const p = points[i], q = points[(i + 1) % points.length];
      const len = Math.hypot(q.x - p.x, q.y - p.y);
      if(len < 1) continue;
      let n = { x: (q.y - p.y) / len, y: -(q.x - p.x) / len };
      const mid = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
      if(n.x * (inside.x - mid.x) + n.y * (inside.y - mid.y) > 0) n = { x: -n.x, y: -n.y };
      if(!best || n.y > best.down) best = { p, q, down: n.y, inward: { x: -n.x, y: -n.y } };
    }
    if(!best) return null;
    const [collarPoint, rollEnd] = Math.abs(best.p.x - centerX) >= Math.abs(best.q.x - centerX) ? [best.p, best.q] : [best.q, best.p];
    return { collarPoint, rollEnd, inward: best.inward };
  }

  // The collar leaf of a collar polygon, as a point list. Figure A5-5 centres the chevron on the leaf ('centered on the collar'). Most sheets state the leaf alone as their collar polygon:
  // the ABU/CFU five-point leaf, the overblouse kite, the aviator shirts' pointed collar (the long sheets, and the short sheets' closed leaves) and the Class B leaves (LIVE9-ART 1: top end,
  // shoulder vertex, collar point, the junction at the knot, the neck edge back up), every vertex of which lies on the leaf's side of its leading edge: the polygon is the leaf.
  // The short aviator sheets' open collar (art 66518f14, LIVE12-ART 1: an open camp collar, Fig 4.16 / 4.17) states each front as one piece, the collar (top end, collar point P, the
  // collar's inner end N1) and below it the revers (N1, N2, the break B, X on the roll line), with the fold line top end to N1 between them; the revers lies below the collar's leading
  // edge (P to N1). The chevron is worn on the collar, so where vertices lie more than 0.1 in beyond the leading edge (the revers) the leaf is the triangle of the vertex farthest from
  // the edge on the leaf's side (the top end), the collar point and the roll end (N1), and the chevron is centred on its chord, not across the fold line on the revers.
  // `edge` is collarLeadingEdge(points, centerX).
  function collarLeaf(points, edge){
    if(!edge || !edge.inward) return points;
    const a = edge.collarPoint, n = edge.inward, d = p => (p.x - a.x) * n.x + (p.y - a.y) * n.y;
    if(!points.some(p => d(p) < -0.1)) return points;
    const top = points.reduce((m, p) => d(p) > d(m) ? p : m, points[0]);
    return [top, edge.collarPoint, edge.rollEnd];
  }

  // Where and how a collar chevron sits on a leading edge { collarPoint, rollEnd, inward }: its axis
  // along the edge with the top of the insignia (peak / shield canton) toward the roll-line end and the
  // rockers toward the collar point (Figure A5-5; the turn is clockwise from top-up), its width
  // across the edge, the near outline `gap` inches (1) from the edge. `pieceW` is the chevron's width in
  // inches. 'Centered on the collar' (Figure A5-5): along the edge it is centred on the leaf, at the
  // midpoint of the leaf's width on the line the chevron's centre runs along (`points`, the leaf
  // polygon); without a polygon, at the edge's midpoint. Returns { at, rotate, foot, near }: the centre,
  // the turn, and the 1 in segment (foot on the edge, point on the chevron's near outline).
  function chevronOnLeadingEdge(edge, pieceW, gap, points){
    const g = gap == null ? 1 : gap;
    const dx = edge.collarPoint.x - edge.rollEnd.x, dy = edge.collarPoint.y - edge.rollEnd.y, len = Math.hypot(dx, dy);
    const a = { x: dx / len, y: dy / len };
    const mid = { x: (edge.collarPoint.x + edge.rollEnd.x) / 2, y: (edge.collarPoint.y + edge.rollEnd.y) / 2 };
    // the perpendicular to the edge on the side of the leaf (`inward` only says which side)
    let u = { x: -a.y, y: a.x };
    if(u.x * edge.inward.x + u.y * edge.inward.y < 0) u = { x: -u.x, y: -u.y };
    const off = g + pieceW / 2;
    // position along the edge (from `mid`, toward the collar point) of the chord's middle
    let along = 0;
    if(points && points.length > 2){
      let lo = Infinity, hi = -Infinity;
      for(let i = 0; i < points.length; i++){
        const p = points[i], q = points[(i + 1) % points.length];
        const dp = (p.x - mid.x) * u.x + (p.y - mid.y) * u.y, dq = (q.x - mid.x) * u.x + (q.y - mid.y) * u.y;
        if((dp - off) * (dq - off) > 0 || dp === dq) continue;
        const t = (off - dp) / (dq - dp);
        const along_ = (p.x + t * (q.x - p.x) - mid.x) * a.x + (p.y + t * (q.y - p.y) - mid.y) * a.y;
        lo = Math.min(lo, along_); hi = Math.max(hi, along_);
      }
      if(hi > lo) along = (lo + hi) / 2;
    }
    const foot = { x: mid.x + a.x * along, y: mid.y + a.y * along };
    return {
      at: { x: foot.x + u.x * off, y: foot.y + u.y * off },
      rotate: Math.atan2(-a.x, a.y) * 180 / Math.PI,   // (-180, 180]: the art's top turned to the roll-line end
      foot,
      near: { x: foot.x + u.x * g, y: foot.y + u.y * g }
    };
  }

  // Collar leaf polygons of the sheets that carry no collar_<side> landmark of their own, in sheet
  // inches (a = the leaf on the left of the picture, b = the right). Every sheet states collar_left /
  // collar_right now (the aviator shirt, ABU, CFU and, since the leaf was re-measured from Figure 4.18, the
  // overblouse), so the table is empty; a sheet without the landmark gets an entry here.
  const COLLAR_POLYGONS = {};

  // The two collar leaf polygons of the sheet: the landmarks collar_left/collar_right when it states
  // them, else the table above. Each is { points } in sheet inches.
  function collarPolygons(ctx){
    // A shirt sheet that draws an open and a closed collar (landmark collar_states) states the closed leaves as collar_closed_<side>: with the tie on (ctx.collarState 'closed') the leaves are those.
    if(ctx.collarState === 'closed'){
      const closed = ['left', 'right'].map(n => ctx.landmark('collar_closed_' + n)).filter(l => l && l.points);
      if(closed.length === 2) return closed;
    }
    const own = ['left', 'right'].map(n => ctx.landmark('collar_' + n)).filter(l => l && l.points);
    if(own.length === 2) return own;
    const t = COLLAR_POLYGONS[ctx.base && ctx.base.id];
    return t ? [{ points: t.a }, { points: t.b }] : [];
  }

  // A piece placed by its distance from a collar edge, as the ABU and CFU paragraphs word it (5.1.1.1.1.1, 5.1.1.1.1.3, 5.1.1.1.1.4, 5.2.1.1.1.1, 5.2.1.1.1.4, 5.2.1.1.1.6: one inch from the bottom of the
  // collar, centred). `edge` { a, b } is the collar edge (the leaf's lower seam, the sheet's bottom_edge), sheet inches; `box` { w, h, rotate } the piece's art box and its turn (SVG degrees, about its
  // centre); `nearIn` the distance from the edge to the piece's near side (the embroidery's, the cloth's blue border being inside the art box). The piece's centre lies on the perpendicular to the
  // edge's direction that puts its near side `nearIn` from the edge, and is centred between the leaf's two sides there: the midpoint of the chord the line parallel to the edge cuts across the leaf
  // (`points`). Returns { at, foot, near } (the centre, the point on the edge below the piece's middle, the piece's near side straight above it) or null.
  function collarSlot(points, edge, nearIn, box){
    if(!edge || !points || points.length < 3) return null;
    const dx = edge.b.x - edge.a.x, dy = edge.b.y - edge.a.y, len = Math.hypot(dx, dy);
    if(!len) return null;
    const t = { x: dx / len, y: dy / len };
    const cen = polygonCentroid(points);
    let n = { x: -t.y, y: t.x };
    if((cen.x - edge.a.x) * n.x + (cen.y - edge.a.y) * n.y < 0) n = { x: -n.x, y: -n.y };   // into the leaf
    const r = (box.rotate || 0) * Math.PI / 180, ex = { x: Math.cos(r), y: Math.sin(r) }, ey = { x: -Math.sin(r), y: Math.cos(r) };
    const half = box.w / 2 * Math.abs(n.x * ex.x + n.y * ex.y) + box.h / 2 * Math.abs(n.x * ey.x + n.y * ey.y);
    const c = nearIn + half;
    let lo = Infinity, hi = -Infinity;
    for(let i = 0; i < points.length; i++){
      const p = points[i], q = points[(i + 1) % points.length];
      const dp = (p.x - edge.a.x) * n.x + (p.y - edge.a.y) * n.y - c, dq = (q.x - edge.a.x) * n.x + (q.y - edge.a.y) * n.y - c;
      if(dp * dq > 0 || dp === dq) continue;
      const k = dp / (dp - dq), x = p.x + k * (q.x - p.x), y = p.y + k * (q.y - p.y);
      const along = (x - edge.a.x) * t.x + (y - edge.a.y) * t.y;
      lo = Math.min(lo, along); hi = Math.max(hi, along);
    }
    if(!(hi > lo)) return null;
    const m = (lo + hi) / 2, foot = { x: edge.a.x + t.x * m, y: edge.a.y + t.y * m };
    return { at: { x: foot.x + n.x * c, y: foot.y + n.y * c }, foot, near: { x: foot.x + n.x * nearIn, y: foot.y + n.y * nearIn } };
  }

  // The area centroid of a polygon given as points [{x, y}] (inches), the point a piece is 'centred on the leaf' at (COLLAR6). Falls back to the vertex mean for a degenerate polygon.
  function polygonCentroid(points){
    const n = points.length;
    let area = 0, cx = 0, cy = 0;
    for(let i = 0; i < n; i++){ const p = points[i], q = points[(i + 1) % n], cr = p.x * q.y - q.x * p.y; area += cr; cx += (p.x + q.x) * cr; cy += (p.y + q.y) * cr; }
    if(Math.abs(area) < 1e-9) return { x: points.reduce((t, p) => t + p.x, 0) / n, y: points.reduce((t, p) => t + p.y, 0) / n };
    return { x: cx / (3 * area), y: cy / (3 * area) };
  }

  // Whether a w x h box centred on `at` and turned `deg` degrees (SVG rotate, about its centre) lies wholly inside the polygon `points`: its four corners and the middle of each side are inside.
  function boxInPolygon(points, at, w, h, deg){
    const r = (deg || 0) * Math.PI / 180, cs = Math.cos(r), sn = Math.sin(r);
    const q = (i, j) => ({ x: at.x + i * w / 2 * cs - j * h / 2 * sn, y: at.y + i * w / 2 * sn + j * h / 2 * cs });
    const inside = p => { let c = false; for(let i = 0, j = points.length - 1; i < points.length; j = i++){ const a = points[i], b = points[j]; if((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) c = !c; } return c; };
    return [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]].every(([i, j]) => inside(q(i, j)));
  }

  // Cadet officers on both collars of the ABU and CFU (5.1.1.1.1.3, 5.2.1.1.1.4: one inch from the bottom of the collar, centred). COLLAR6 (Ethan, on the cloth drawn as a level rectangle pushed toward the
  // leaf's outer side: "flip it 90 degrees, and center it, and apply that logic for everything else"): the cloth is turned a quarter turn from the seam's frame, so its long side stands vertical (`opts.turnOf(poly)`
  // supplies the turn, the seam's angle + 90: the diamonds of the Lt Col stack one above the other, each with its long axis along the seam), and its centre is `opts.atOf(poly, box)`'s (the ABU and CFU: 1 in from the bottom of the collar, H.collarSlot) or else the centroid of the leaf polygon on both axes.
  // The art is drawn with its diamonds' long axis vertical and its row horizontal. With `opts.atOf` (the ABU and CFU) the regular cloth is never drawn in the miniature while it can be drawn nearly its size: ONE factor serves the whole family of regular cadet officer cloth on the
  // sheet, never above 1, the largest at which every grade's cloth lies inside both leaves at its place; only a leaf so small that the factor would make a cloth no larger than its miniature gets the
  // miniature cloth-bordered form (5.1.1.1.1.3: miniature insignia may be worn). Without `opts.atOf` a regular cloth that would cross the leaf's outline when centred is drawn in the miniature form;
  // `opts.miniatureKeys` names the grades that wear the miniature form always.
  async function collarOfficerRow(ctx, g, opts){
    const mini = opts && opts.miniatureKeys && opts.miniatureKeys.includes(g.key);
    const polys = collarPolygons(ctx);
    if(polys.length < 2) return;
    let id = G.cadetOfficerInsignia(g, mini ? 'cloth-bordered-miniature' : 'cloth-bordered-regular');
    if(!id) return;
    if(!ctx.has(id)){ ctx.note(`No artwork for ${id}`); return; }
    let s = await ctx.spec(id);
    const centerX = ctx.base.w / 2;
    const turns = polys.map(poly => opts && opts.turnOf ? opts.turnOf(poly) : 0);
    // `opts.atOf(poly, box)` (the ABU and CFU: the paragraph's distance from the collar edge, collarSlot) gives the piece's centre; without it the leaf's centroid. `box` carries `scale`, the factor the
    // piece is drawn at, so the caller can keep the embroidery (not the cloth's box) at its distance.
    const centreOf = (poly, spec, turn, scale) => (opts && opts.atOf && opts.atOf(poly, { w: spec.w * scale, h: spec.h * scale, rotate: turn, scale }, id)) || { at: polygonCentroid(poly.points) };
    const fits = (spec, scale) => polys.every((poly, i) => boxInPolygon(poly.points, centreOf(poly, spec, turns[i], scale).at, spec.w * scale, spec.h * scale, turns[i]));
    // One factor for the whole family of regular cloth on this sheet (the chevrons' rule): never above 1, the art's own size, and the largest at which every regular cadet officer cloth lies inside both
    // leaves at its place, so the grades keep their sizes relative to each other. A regular cloth that does not fit at its true size is drawn at that factor; the miniature form is drawn instead only
    // where the factor would make the regular cloth no larger than the miniature itself (a leaf far too small).
    let scale = 1, useMini = false;
    if(!mini && opts && opts.atOf){
      const family = [];
      for(const e of Object.values(G.CADET)){
        if(e.category !== 'cadet-officer') continue;
        const fid = G.cadetOfficerInsignia(e, 'cloth-bordered-regular');
        if(fid && ctx.has(fid)) family.push(await ctx.spec(fid));
      }
      const fitsAll = f => family.every(spec => fits(spec, f));
      if(!fitsAll(1)){
        let lo = 0, hi = 1;
        for(let i = 0; i < 40; i++){ const mid = (lo + hi) / 2; if(fitsAll(mid)) lo = mid; else hi = mid; }
        scale = lo;
        const small = G.cadetOfficerInsignia(g, 'cloth-bordered-miniature');
        if(small && ctx.has(small) && s.w * scale <= (await ctx.spec(small)).w + 1e-9) useMini = true;
      }
    }else if(!mini && !fits(s, 1)) useMini = true;
    if(useMini){
      const small = G.cadetOfficerInsignia(g, 'cloth-bordered-miniature');
      if(small && ctx.has(small)){ id = small; s = await ctx.spec(id); scale = 1; }
    }
    for(let i = 0; i < polys.length; i++){
      const poly = polys[i], at = centreOf(poly, s, turns[i], scale).at;
      const side = at.x < centerX ? 'right' : 'left';
      await ctx.place(id, { pieceAnchor: 'center', at, scale, rotate: turns[i], z: opts && opts.z != null ? opts.z : Z.insignia, role: 'grade', key: 'grade:' + side });
    }
  }

  // Cadet NCO and Airman chevrons on both collars. On the shirts (Class B, aviator shirt, overblouse), the rule of Figure A5-5 ('shirt without necktie', CAPR 39-1 page 134): the chevron's
  // axis parallel to the leading edge of the collar leaf (its bottom edge, collar point to roll line), top of the insignia (peak / shield canton) toward the roll-line end, rockers toward the
  // collar point, the near outline 1 in from the edge, centred on the leaf (4.1.11.1.1.1.4, 4.1.12.2.3.5, 4.2.5.1.1.5, 4.2.6.2.5).
  // `opts.edgeOf(poly)` (the ABU and CFU): an edge { top, bottom } in sheet inches that sets the chevron's turn, apex up along it (the seam inward toward the placket V, COLLAR10: the turn is mirrored on
  // the two leaves). 5.1.1.1.1.4 / 5.2.1.1.1.6: the chevron's near edge is 1 in from the bottom of the collar, centred (`opts.atOf`, H.collarSlot), else its centre is the centroid of the leaf polygon.
  // Every enlisted collar chevron is drawn at ONE common factor of its metal art, never above `opts.maxScale` (the art's true size) and reduced (bisection) until the C/CMSgt chevron, the largest grade,
  // with `opts.clearIn` all round, lies inside both leaves at its place (H.collarChevronScale); each grade keeps its own aspect and the grades keep their sizes relative to each other. The factor does not
  // depend on the grade shown, so a smaller chevron, concentric with the C/CMSgt one and turned the same, always lies inside it.
  async function collarChevrons(ctx, g, opts){
    const id = G.cadetNcoChevron(g, 'metal');
    const polys = collarPolygons(ctx);
    if(!id || polys.length < 2) return;
    if(!ctx.has(id)){ ctx.note(`No artwork for ${id}`); return; }
    const s = await ctx.spec(id);
    const centerX = ctx.base.w / 2;
    const edgeOf = opts && opts.edgeOf, z = opts && opts.z != null ? opts.z : Z.insignia;
    let scale = 1;
    if(edgeOf){
      scale = await collarChevronScale(ctx, polys, opts);
    }
    for(const poly of polys){
      if(edgeOf){
        const turn = edgeTurn(edgeOf(poly)), put = opts.atOf && opts.atOf(poly, { w: s.w * scale, h: s.h * scale, rotate: turn }, id);
        const at = put ? put.at : polygonCentroid(poly.points), side = at.x < centerX ? 'right' : 'left';
        await ctx.place(id, { pieceAnchor: 'center', at, scale, rotate: turn, z, role: 'grade', key: 'grade:' + side });
        continue;
      }
      const edge = collarLeadingEdge(poly.points, centerX);
      if(!edge) continue;
      const side = edge.collarPoint.x < centerX ? 'right' : 'left';
      const pl = chevronOnLeadingEdge(edge, s.w, 1, collarLeaf(poly.points, edge));
      await ctx.place(id, { pieceAnchor: 'center', at: pl.at, rotate: pl.rotate, z, role: 'grade', key: 'grade:' + side });
      ctx.measure(pl.foot, pl.near, null, { caption: 'collar edge to grade' });
    }
  }

  // How much narrower than its flat width a chevron or patch looks when it is worn on the outer arm and seen edge-on from the front, hanging off the arm's side: the OCP sheet's own edge view is 0.5, and
  // the ABU and CFU figure's arms and the dress sleeves use the same value (an estimate, D2; FIX-R-OTHER-r2 #7, SLEEVE1).
  const EDGE_SX = 0.5;

  // The SVG turn (degrees) that lays a piece's upward axis along the edge { top, bottom }, pointing from `bottom` to `top`.
  function edgeTurn(e){
    const dx = e.top.x - e.bottom.x, dy = e.top.y - e.bottom.y;
    return Math.atan2(dx, -dy) * 180 / Math.PI;
  }

  // The common factor of the enlisted collar chevrons on this sheet (COLLAR8, Ethan's ruling and an estimate; see collarChevrons): `opts.maxScale` (the ABU and CFU: 1, the art's true size, never
  // larger, 2 November 2026) or else tallIn / (the C/CMSgt metal chevron's height), reduced until the C/CMSgt chevron (the largest grade, so it sets the factor for all) plus clearIn on every side lies
  // inside both leaves, each turned along its own edge and, with `opts.atOf`, placed where that puts it. Returns the factor (1 = the art's own size).
  async function collarChevronScale(ctx, polys, opts){
    const refId = 'rank-cadet-nco-chief-master-sergeant-metal';
    if(!ctx.has(refId)) return 1;
    const r = await ctx.spec(refId), clear = opts.clearIn == null ? 0.1 : opts.clearIn;
    const fits = f => polys.every(poly => {
      const turn = edgeTurn(opts.edgeOf(poly)), put = opts.atOf && opts.atOf(poly, { w: r.w * f, h: r.h * f, rotate: turn });
      return boxInPolygon(poly.points, put ? put.at : polygonCentroid(poly.points), r.w * f + 2 * clear, r.h * f + 2 * clear, turn);
    });
    const want = opts.maxScale != null ? opts.maxScale : opts.tallIn / r.h;
    if(fits(want)) return want;
    let lo = 0, hi = want;
    for(let i = 0; i < 40; i++){ const mid = (lo + hi) / 2; if(fits(mid)) lo = mid; else hi = mid; }
    return lo;
  }

  // Fit a piece in a rect (never larger than true size) and centre it there.
  async function fitCenter(ctx, id, rect, opts){
    return C.fitIn(ctx, id, rect, opts);
  }

  // Scale a piece so it fits maxW x maxH (never up), centred on a point.
  // The 1/8 in of blue cloth left showing past the embroidery when a cloth badge or grade piece is cut out (Ethan: "1/8th inch
  // of blue on the badges!"): 7.1.1.3.1 and 7.1.1.8 (OCP chest badges, cap grade), 5.1.1.1.1.1, 5.1.1.1.1.3, 5.1.1.1.2.4 (ABU collar
  // grade, chest badges), 5.2.1.1.1.1, 5.2.1.1.1.4, 5.2.1.1.2.6 (CFU), 8.3.5.1 (CFDU cloth grade, "1/8 inch larger than the
  // insignia"). One measure on the piece `layer`, at its top edge in its own frame (turned with it): from the blue edge in to the
  // embroidery, labelled with the regulation's 1/8 in. The border is the art's own: the art_top_center anchor of a field badge or
  // dimensions.border_each_side_in of a cloth-bordered insignia; a piece whose border is not 1/8 in (the 1 x 1 in command patch)
  // gets none. Returns the measure layer or null.
  async function blueBorder(ctx, layer){
    if(!layer || layer.type !== 'asset' || !ctx.has(layer.id)) return null;
    const spec = await ctx.spec(layer.id);
    const top = core.anchor(spec, 'art_top_center');
    const dims = spec.raw && spec.raw.dimensions;
    const border = top && top.y > 0.01 ? top.y : (dims && dims.border_each_side_in) || null;
    if(!border || Math.abs(border - 0.125) > 0.01) return null;
    const k = layer.h / spec.h;
    const o = layer.origin || { x: layer.x, y: layer.y };
    const edge = core.rotatePoint({ x: layer.x + layer.w / 2, y: layer.y }, o, layer.rotate || 0);
    const inner = core.rotatePoint({ x: layer.x + layer.w / 2, y: layer.y + border * k }, o, layer.rotate || 0);
    // A 1/8 in line is a few pixels on the stage, so the overlay magnifies this one (measure-layout.js, opts.callout): the band between
    // the piece's cut edge and the edge of its embroidery, found from the piece's own frame (its top-left corner and its own axes).
    return ctx.measure(edge, inner, '⅛ in', { callout: { layer: layer.key, border: border * k, caption: 'of blue around the embroidery' } });
  }

  async function placeFitted(ctx, id, at, maxW, maxH, opts){
    const s = await ctx.spec(id);
    const scale = Math.min(1, maxW / s.w, maxH / s.h);
    return ctx.place(id, Object.assign({ pieceAnchor: 'center', at, scale }, opts));
  }

  // The badges a member wears on a uniform, split by Attachment 4 family, each with the art for the
  // uniform's form ('dress' | 'field' | 'cloth' | 'mini'); badges without art in that form are noted.
  function badgeSet(ctx, b, form){
    const out = { chaplain: [], aviation: [], occupational: [], specialty: [], service: [], nationalStaff: [], rocketry: [], marksmanship: [], cadetSpecialty: [], all: [] };
    for(const sel of b.badges || []){
      const fam = B.family(sel.id);
      if(!fam || fam === 'command') continue;
      // The same eligibility table as the page's picker: STEM, Cyber, Model Rocketry and NRA badges are
      // cadets' only, and a cadet wears only the badges the chart authorizes for cadets (4.1.5.2.2.4.2,
      // 4.1.9.4.4.2, Attachment 4), whatever way the build was made (imports, saved states, the harness).
      if(B.eligibleFor && b.grade && !B.eligibleFor(sel.id, b.grade.cadet ? 'cadet' : 'senior')){
        const label = sel.title || (B.get(sel.id) || {}).name || sel.id;
        ctx.note(b.grade.cadet
          ? `${label} is not worn by cadets (CAPR 39-1, Attachment 4)`
          : `${label} is worn by cadets only (CAPR 39-1, 4.1.5.2.2.4.2)`);
        continue;
      }
      const art = B.art(sel.id, form, sel.level) || (form === 'mini' ? B.art(sel.id, 'dress', sel.level) : null);
      if(!art){ ctx.note(`${sel.title || sel.id} has no ${form} artwork, so it is not shown on this uniform`); continue; }
      const item = { id: sel.id, art, family: fam, title: sel.title || sel.id };
      const key = { 'national-staff': 'nationalStaff', 'cadet-specialty': 'cadetSpecialty' }[fam] || fam;
      (out[key] || out.specialty).push(item);
      out.all.push(item);
    }
    // Only one CAP aviation badge is worn; keep the first the member listed. The paragraph is the
    // uniform's own (ONE_AVIATION_BADGE); the corporate blazers wear no aviation badge at all, so their
    // own badge note says what is worn and this one is not given.
    if(out.aviation.length > 1){
      const para = oneAviationBadgeParagraph(b);
      if(para !== false) ctx.note('Only one CAP aviation badge is worn; the others are not shown' + (para ? ` (CAPR 39-1, ${para})` : ''));
      // The member's choice for this position (build.badgeChoices.aviation) shows that badge; else the first listed.
      const one = [{ key: 'only', label: 'CAP aviation badge' }];
      out.aviation = para !== false ? C.chooseBadges(ctx, 'aviation', 'CAP aviation badge', out.aviation, one) : out.aviation.slice(0, 1);
    }
    return out;
  }

  // CAPR 39-1: 'When more than one CAP aviation badge is authorized, only one will be worn', by uniform
  // and cut ([men, women]); false = no aviation badge is worn on that uniform.
  const ONE_AVIATION_BADGE = {
    blues_a: ['4.1.5.2.2.4.1', '4.1.9.4.4.1'], semi_formal_usaf: ['4.1.5.2.2.4.1', '4.1.9.4.4.1'],
    blues_b: ['4.1.11.1.1.2.3.1', '4.1.12.2.5.1'], mess_dress: ['4.1.1.1.3.1', '4.1.2.1.2.5'],
    aviator: ['4.2.5.1.3.1', '4.2.6.2.7.1'], corporate_field: ['5.2.1.1.2.6', '5.2.1.1.2.6'],
    abu: ['5.1.1.1.2.4', '5.1.1.1.2.4'], ocp: ['7.1.1.3.1', '7.1.1.3.1'],
    flight_suit: ['8.2.4.1', '8.2.4.1'], corporate_flight_suit: ['8.3.4.1', '8.3.4.1'],
    semi_formal: false, aviator_blazer: false
  };
  function oneAviationBadgeParagraph(b){
    // The shirt drawn beside a blazer is the aviator shirt and wears one aviation badge by the shirt's own
    // paragraph (4.2.5.1.3.1, 4.2.6.2.7.1), so its note is given and the blazer's own note says the rest are not
    // worn on the blazer.
    const e = ONE_AVIATION_BADGE[b.uniform];
    if(e === false) return false;
    return e ? e[b.gender === 'female' ? 1 : 0] : null;
  }

  // 10.2.5: the command insignia pin is not worn by officers who were members of the Command Council,
  // the CAP Senior Advisory Group, the National Board or the National Executive Committee. They wear
  // those badges for good (10.2.1, 10.2.2), so a member who lists one of them wears no pin.
  const NO_PIN_WITH_BADGE = new Set(['senior_advisory_group_badge', 'command_council_badge', 'national_executive_committee_badge', 'cap_national_command_board_badge']);

  function commandPin(ctx, b, form){
    if(!b.command) return null;
    if((b.badges || []).some(x => NO_PIN_WITH_BADGE.has(x.id))){
      ctx.note('The command insignia pin is not worn by members of the Command Council, the CAP Senior Advisory Group, the National Board or the National Executive Committee (CAPR 39-1, 10.2.5)');
      return null;
    }
    const art = B.art(b.command.id, form);
    if(!art){ ctx.note(`${b.command.title || b.command.id} has no ${form} artwork`); return null; }
    return { id: b.command.id, art, graduated: !!b.command.graduated, title: b.command.title || b.command.id };
  }

  // Grade label for nametags (flight tags, blazer plate).
  function gradeAbbrev(g){ return String(g.rank || '').replace(/^C\//, ''); }

  // Which cap a member wears and the device on it (CAPR 39-1 6.2.1, 6.2.2, ICL 25-02 (g)), one rule for
  // every uniform that shows a cap. `pref` is the Headgear option: 'auto' = flight cap, 'service',
  // 'none'. The cut follows the member's gender (men's or women's service cap, Figures A5-8 and A5-9;
  // the men's or women's flight cap is picked in hat()).
  //   service cap: officers and generals wear the officer device, NCOs the NCO device (ICL 25-02 (g)),
  //                cadet officers the cadet service device; cadet NCOs and Airmen have no service cap
  //   flight cap:  officers and generals the officer flight device, cadet NCOs/Airmen and senior NCOs
  //                the NCO flight device (6.2.2.2.3, ICL 25-02 (g)), cadet officers their regular metal
  //                grade (6.2.2.2.2); members without grade follow their track (1.4.1.1, 1.4.2.1)
  function chooseHat(b){
    const g = b.grade;
    const pref = b.opt.headgear;
    if(pref === 'none') return null;
    const female = b.gender === 'female';
    const service = pref === 'service';
    if(g.cadet){
      if(g.category === 'cadet-officer'){
        if(service) return { hat: female ? 'hat-service-cap-women-cadet-officer' : 'hat-service-cap-men-cadet-officer', device: 'cap-device-cadet-officer-service' };
        return { hat: 'hat-flight-cap-cadet', device: G.cadetOfficerInsignia(g, 'metal-regular') };
      }
      return { hat: 'hat-flight-cap-cadet', device: 'cap-device-nco-flight' };
    }
    const sex = female ? 'women' : 'men';
    if(g.general) return service ? { hat: `hat-service-cap-${sex}-general`, device: 'cap-device-officer-service' } : { hat: 'hat-flight-cap-general', device: 'cap-device-officer-flight' };
    if(g.category === 'senior-officer' || g.category === 'flight-officer'){
      const field = ['major', 'lieutenant-colonel', 'colonel'].includes(g.key);
      if(service) return { hat: `hat-service-cap-${sex}-${field ? 'field-grade' : 'officer-nco'}`, device: 'cap-device-officer-service' };
      return { hat: 'hat-flight-cap-officer', device: 'cap-device-officer-flight' };
    }
    if(g.category === 'senior-nco'){
      // ICL 25-02 (g): senior NCOs wear the NCO device on the flight cap and the service cap (6.2.2.2.1 still says
      // they wear none on the flight cap; the ICL wins). The senior member's device is the round silver piece of
      // 6.2.1.1.1 / 6.2.1.2.1, cap-device-nco-senior, not the cadet Airman prop-and-wings disc of Fig A5-8
      // (cap-device-nco-flight), which only cadet NCOs wear.
      if(service) return { hat: `hat-service-cap-${sex}-officer-nco`, device: 'cap-device-nco-senior' };
      return { hat: 'hat-flight-cap-cadet', device: 'cap-device-nco-senior' };
    }
    // Adults without grade (1.4.1.1, 1.4.2.1): officer-track flight cap, or the plain blue one.
    if(g.track === 'officer') return { hat: 'hat-flight-cap-officer', device: 'cap-device-officer-flight' };
    return { hat: 'hat-flight-cap-cadet', device: null };
  }

  // How far below the garment's top_center the cap's garment_attach_center sits when the garment draws
  // no hat_attach landmark of its own: the cap rests on the collar instead of floating above it. The
  // regulation gives no seating (6.2.2 shows a cap without a coat), so the value is an estimate:
  // about the offset of the drawn collar top below the sheet's top_center (0.27 to 0.50 in on the Class A
  // coats). A cap whose own spec states attach_overlap already carries its seating in the attach point.
  const HAT_SEAT_IN = 0.25;

  // Hats sit on the uniform: the hat's garment_attach_center goes on the garment's hat_attach landmark
  // when the sheet has one, else on its top_center lowered by HAT_SEAT_IN; the device's mount_center
  // goes on the hat's device_slot_center (MANIFEST conventions).
  async function hat(ctx, hatId, device){
    // Flight caps are drawn per cut: the men's caps from the men's figure, the plain ids are the
    // women's (Figure A5-9).
    const men = hatId && hatId.replace(/^hat-flight-cap-/, 'hat-flight-cap-men-');
    if(ctx.build.gender !== 'female' && men !== hatId && ctx.has(men)) hatId = men;
    if(!hatId || !ctx.has(hatId)) return null;
    const hs = await ctx.spec(hatId);
    let at = ctx.point('hat_attach');
    if(!at){
      const top = ctx.point('top_center');
      const seated = hs.raw && hs.raw.attach_overlap;
      at = { x: top.x, y: top.y + (seated ? 0 : HAT_SEAT_IN) };
    }
    const layer = await ctx.place(hatId, { pieceAnchor: 'garment_attach_center', at, z: Z.hat, role: 'hat', key: 'hat:' + hatId, className: 'hat' });
    let devLayer = null;
    if(device && ctx.has(device)){
      const slot = piecePoint(layer, hs, 'device_slot_center');
      const ds = await ctx.spec(device);
      const anchorName = core.anchor(ds, 'mount_center') ? 'mount_center' : 'center';
      const dl = await ctx.place(device, { pieceAnchor: anchorName, at: slot, z: Z.hatDevice, role: 'hat-device', key: 'hat-device:' + device });
      if(dl) devLayer = dl;
      // The flight cap's device is 'centered halfway from between the top and bottom of the flap, and 1 1/2 inches from the front
      // of the cap' (6.2.2.2.1-3): the cap sheet's front_edge_center to the device's centre, which the sheet's device_slot_center is.
      const front = /^hat-flight-cap-/.test(hatId) && piecePoint(layer, hs, 'front_edge_center');
      if(dl && front) ctx.measure({ x: front.x, y: slot.y }, slot, '1½ in', { center: 'to', caption: "cap front to the grade's centre" });
    }
    clearViewsOfHat(ctx, layer, hs, devLayer);
    return layer;
  }

  // The four corners of a placed layer's box, turned about its origin (scene inches).
  function layerCorners(l){
    const o = l.origin || { x: l.x, y: l.y };
    return [[l.x, l.y], [l.x + l.w, l.y], [l.x + l.w, l.y + l.h], [l.x, l.y + l.h]].map(([x, y]) => core.rotatePoint({ x, y }, o, l.rotate || 0));
  }
  // Separating-axis test for two convex polygons.
  function polygonsOverlap(a, b){
    for(const poly of [a, b]){
      for(let i = 0; i < poly.length; i++){
        const p = poly[i], q = poly[(i + 1) % poly.length];
        const nx = p.y - q.y, ny = q.x - p.x;
        const proj = pts => { const v = pts.map(r => r.x * nx + r.y * ny); return [Math.min(...v), Math.max(...v)]; };
        const A = proj(a), B = proj(b);
        if(A[1] <= B[0] || B[1] <= A[0]) return false;
      }
    }
    return true;
  }
  // The cap's drawn ink as a convex hull, inches from the cap sheet's top-left, per cap (the sheet's box is not the cap:
  // the sloped crown of the flight cap and the brim of the service cap leave empty corners, Fig A5-9). Generated by
  // scripts/measure-hat-ink.cjs and checked against the SVGs by tests/engine-live-hat-views.test.cjs.
  // HAT_INK begin
  const HAT_INK = {
    'hat-baseball-cap-blue': [[0.1,5.15],[0.464,2.21],[0.653,1.634],[0.959,1.167],[1.375,0.8],[1.894,0.527],[2.509,0.341],[3.983,0.121],[5.491,0.341],[6.106,0.527],[6.625,0.8],[7.041,1.167],[7.347,1.634],[7.536,2.21],[7.9,5.15],[7.621,5.521],[7.225,5.875],[6.651,6.22],[5.913,6.516],[5.024,6.722],[4,6.8],[2.976,6.722],[2.088,6.516],[1.349,6.22],[0.775,5.875],[0.379,5.521]],
    'hat-baseball-cap-blue-back': [[0.653,1.634],[0.959,1.167],[1.375,0.8],[1.894,0.527],[2.509,0.341],[4.017,0.121],[5.491,0.341],[6.106,0.527],[6.625,0.8],[7.041,1.167],[7.347,1.634],[7.536,2.21],[7.6,2.9],[7.6,4.9],[0.4,4.9],[0.4,2.9],[0.464,2.21]],
    'hat-flight-cap-cadet': [[0.196,2.707],[0.349,2.063],[0.521,1.473],[1.037,0.26],[1.095,0.171],[1.954,0.12],[2.795,0.12],[3.636,0.165],[4.228,0.218],[4.916,0.302],[5.757,0.437],[7.228,0.748],[8.298,1.022],[9.521,1.371],[11.509,1.991],[11.566,2.053],[11.776,2.446],[11.833,2.6],[11.891,2.868],[12.044,3.723],[12.101,4.188],[12.101,4.906],[12.044,4.912],[0.177,4.174],[0.12,4.061],[0.12,3.334]],
    'hat-flight-cap-general': [[0.216,2.711],[0.311,2.26],[0.483,1.663],[1.056,0.253],[1.114,0.175],[1.954,0.12],[2.814,0.12],[3.636,0.165],[4.515,0.251],[5.719,0.431],[6.827,0.654],[8.26,1.008],[9.961,1.501],[11.528,1.993],[11.585,2.064],[11.833,2.557],[11.91,2.877],[12.063,3.749],[12.12,4.216],[12.12,4.906],[0.196,4.176],[0.12,3.925],[0.12,3.405]],
    'hat-flight-cap-men-cadet': [[11.763,1.295],[11.628,3.68],[0.12,3.68],[0,1.295],[1.047,0.21],[2.594,0.12],[9.306,0.12],[10.789,0.226]],
    'hat-flight-cap-men-general': [[11.658,1.21],[11.553,3.001],[11.477,3.499],[0.21,3.499],[0.12,3.423],[0,1.21],[0.989,0.21],[2.367,0.12],[9.411,0.12],[10.672,0.21]],
    'hat-flight-cap-men-officer': [[11.597,1.245],[11.477,3.438],[10.542,3.529],[0.965,3.529],[0.12,3.453],[0,1.245],[0.889,0.256],[1.07,0.18],[2.171,0.12],[9.094,0.12],[10.663,0.226]],
    'hat-flight-cap-officer': [[0.216,2.623],[0.368,1.984],[0.407,1.879],[1.056,0.284],[1.114,0.181],[1.152,0.165],[1.821,0.12],[2.967,0.12],[3.865,0.174],[4.668,0.259],[5.298,0.348],[6.292,0.525],[7.649,0.836],[8.814,1.148],[11.318,1.903],[11.47,1.954],[11.566,2.005],[11.853,2.567],[11.891,2.694],[12.139,4.073],[12.139,4.903],[0.196,4.123],[0.12,3.891],[0.12,3.294]],
    'hat-flight-cap-women-cadet': [[0.196,2.707],[0.349,2.063],[0.521,1.473],[1.037,0.26],[1.095,0.171],[1.954,0.12],[2.795,0.12],[3.636,0.165],[4.228,0.218],[4.916,0.302],[5.757,0.437],[7.228,0.748],[8.298,1.022],[9.521,1.371],[11.509,1.991],[11.566,2.053],[11.776,2.446],[11.833,2.6],[11.891,2.868],[12.044,3.723],[12.101,4.188],[12.101,4.906],[12.044,4.912],[0.177,4.174],[0.12,4.061],[0.12,3.334]],
    'hat-flight-cap-women-general': [[0.216,2.711],[0.311,2.26],[0.483,1.663],[1.056,0.253],[1.114,0.175],[1.954,0.12],[2.814,0.12],[3.636,0.165],[4.515,0.251],[5.719,0.431],[6.827,0.654],[8.26,1.008],[9.961,1.501],[11.528,1.993],[11.585,2.064],[11.833,2.557],[11.91,2.877],[12.063,3.749],[12.12,4.216],[12.12,4.906],[0.196,4.176],[0.12,3.925],[0.12,3.405]],
    'hat-flight-cap-women-officer': [[0.216,2.623],[0.368,1.984],[0.407,1.879],[1.056,0.284],[1.114,0.181],[1.152,0.165],[1.821,0.12],[2.967,0.12],[3.865,0.174],[4.668,0.259],[5.298,0.348],[6.292,0.525],[7.649,0.836],[8.814,1.148],[11.318,1.903],[11.47,1.954],[11.566,2.005],[11.853,2.567],[11.891,2.694],[12.139,4.073],[12.139,4.903],[0.196,4.123],[0.12,3.891],[0.12,3.294]],
    'hat-service-cap-men-cadet-officer': [[0.1,1.97],[0.148,1.726],[0.293,1.486],[0.53,1.254],[0.857,1.035],[1.268,0.832],[1.755,0.648],[2.31,0.486],[2.925,0.351],[3.588,0.242],[4.288,0.164],[5.013,0.116],[5.75,0.1],[6.487,0.116],[7.212,0.164],[7.912,0.242],[8.575,0.351],[9.19,0.486],[9.745,0.648],[10.232,0.832],[10.643,1.035],[10.97,1.254],[11.207,1.486],[11.352,1.726],[11.4,1.97],[11.352,2.214],[11.207,2.454],[9.055,5.711],[8.757,6.035],[8.35,6.313],[7.84,6.539],[7.233,6.708],[6.534,6.813],[5.75,6.85],[4.966,6.813],[4.267,6.708],[3.66,6.539],[3.15,6.312],[2.743,6.035],[2.445,5.711],[0.293,2.454],[0.148,2.214]],
    'hat-service-cap-men-field-grade': [[0.1,1.97],[0.148,1.726],[0.293,1.486],[0.53,1.254],[0.857,1.035],[1.268,0.832],[1.755,0.648],[2.31,0.486],[2.925,0.351],[3.588,0.242],[4.288,0.164],[5.013,0.116],[5.75,0.1],[6.487,0.116],[7.212,0.164],[7.912,0.242],[8.575,0.351],[9.19,0.486],[9.745,0.648],[10.232,0.832],[10.643,1.035],[10.97,1.254],[11.207,1.486],[11.352,1.726],[11.4,1.97],[11.352,2.214],[11.207,2.454],[8.771,6.121],[8.543,6.26],[7.84,6.539],[7.373,6.706],[6.534,6.813],[5.75,6.85],[4.966,6.813],[4.127,6.706],[3.66,6.539],[2.957,6.26],[2.729,6.121],[0.293,2.454],[0.148,2.214]],
    'hat-service-cap-men-general': [[0.1,1.97],[0.148,1.726],[0.293,1.486],[0.53,1.254],[0.857,1.035],[1.268,0.832],[1.755,0.648],[2.31,0.486],[2.925,0.351],[3.588,0.242],[4.288,0.164],[5.013,0.116],[5.75,0.1],[6.487,0.116],[7.212,0.164],[7.912,0.242],[8.575,0.351],[9.19,0.486],[9.745,0.648],[10.232,0.832],[10.643,1.035],[10.97,1.254],[11.207,1.486],[11.352,1.726],[11.4,1.97],[11.352,2.214],[11.207,2.454],[8.954,5.981],[8.776,6.09],[8.001,6.483],[7.233,6.708],[6.534,6.813],[5.75,6.85],[4.966,6.813],[4.267,6.708],[3.499,6.483],[2.724,6.09],[2.546,5.981],[0.293,2.454],[0.148,2.214]],
    'hat-service-cap-men-officer-nco': [[0.1,1.97],[0.148,1.726],[0.293,1.486],[0.53,1.254],[0.857,1.035],[1.268,0.832],[1.755,0.648],[2.31,0.486],[2.925,0.351],[3.588,0.242],[4.288,0.164],[5.013,0.116],[5.75,0.1],[6.487,0.116],[7.212,0.164],[7.912,0.242],[8.575,0.351],[9.19,0.486],[9.745,0.648],[10.232,0.832],[10.643,1.035],[10.97,1.254],[11.207,1.486],[11.352,1.726],[11.4,1.97],[11.352,2.214],[11.207,2.454],[9.055,5.711],[8.757,6.035],[8.35,6.313],[7.84,6.539],[7.233,6.708],[6.534,6.813],[5.75,6.85],[4.966,6.813],[4.267,6.708],[3.66,6.539],[3.15,6.312],[2.743,6.035],[2.445,5.711],[0.293,2.454],[0.148,2.214]],
    'hat-service-cap-women-cadet-officer': [[8.195,2.138],[8.178,2.559],[8.114,2.953],[7.984,3.428],[7.903,3.628],[7.774,3.779],[7.644,3.898],[7.191,4.243],[6.834,4.459],[6.235,4.74],[1.96,4.81],[1.846,4.783],[1.263,4.502],[1.117,4.416],[0.648,4.092],[0.389,3.871],[0.243,3.611],[0.113,3.239],[0.049,2.985],[0,2.597],[0,2.289],[0.016,2.165],[0.13,1.906],[1.117,0.416],[1.182,0.383],[1.506,0.297],[2.203,0.151],[2.769,0.065],[3.223,0.022],[3.676,0],[4.292,0],[4.745,0.022],[5.199,0.065],[5.749,0.151],[6.446,0.297],[7.11,0.491],[8.114,1.97]],
    'hat-service-cap-women-field-grade': [[8.189,2.109],[8.189,2.471],[8.124,2.913],[7.995,3.415],[7.898,3.636],[7.801,3.766],[7.267,4.192],[6.846,4.451],[6.263,4.731],[1.991,4.812],[1.877,4.791],[1.537,4.639],[1.036,4.364],[0.728,4.149],[0.388,3.857],[0.243,3.593],[0.129,3.258],[0.049,2.94],[0,2.563],[0.016,2.196],[0.113,1.964],[0.21,1.791],[1.133,0.421],[1.214,0.383],[1.537,0.297],[2.136,0.167],[2.881,0.059],[3.35,0.016],[4.192,0],[4.645,0.016],[5.098,0.059],[6.053,0.21],[7.04,0.464],[7.121,0.507],[8.044,1.872]],
    'hat-service-cap-women-general': [[8.189,2.109],[8.189,2.471],[8.124,2.913],[7.995,3.415],[7.898,3.636],[7.801,3.766],[7.267,4.192],[6.846,4.451],[6.263,4.731],[1.991,4.812],[1.877,4.791],[1.537,4.639],[1.036,4.364],[0.728,4.149],[0.388,3.857],[0.243,3.593],[0.129,3.258],[0.049,2.94],[0,2.563],[0.016,2.196],[0.113,1.964],[0.21,1.791],[1.133,0.421],[1.214,0.383],[1.537,0.297],[2.136,0.167],[2.881,0.059],[3.35,0.016],[4.192,0],[4.645,0.016],[5.098,0.059],[6.053,0.21],[7.04,0.464],[7.121,0.507],[8.044,1.872]],
    'hat-service-cap-women-officer-nco': [[8.189,2.109],[8.189,2.471],[8.124,2.913],[7.995,3.415],[7.898,3.636],[7.801,3.766],[7.267,4.192],[6.846,4.451],[6.263,4.731],[1.991,4.812],[1.877,4.791],[1.537,4.639],[1.036,4.364],[0.728,4.149],[0.388,3.857],[0.243,3.593],[0.129,3.258],[0.049,2.94],[0,2.563],[0.016,2.196],[0.113,1.964],[0.21,1.791],[1.133,0.421],[1.214,0.383],[1.537,0.297],[2.136,0.167],[2.881,0.059],[3.35,0.016],[4.192,0],[4.645,0.016],[5.098,0.059],[6.053,0.21],[7.04,0.464],[7.121,0.507],[8.044,1.872]]
  };
  // HAT_INK end

  // Smallest distance between two convex polygons (scene inches), 0 when they overlap.
  function polygonGap(a, b){
    if(polygonsOverlap(a, b)) return 0;
    let d = Infinity;
    for(const [P, Q] of [[a, b], [b, a]]){
      for(const p of P){
        for(let i = 0; i < Q.length; i++){
          const u = Q[i], v = Q[(i + 1) % Q.length];
          const dx = v.x - u.x, dy = v.y - u.y;
          const t = Math.max(0, Math.min(1, ((p.x - u.x) * dx + (p.y - u.y) * dy) / (dx * dx + dy * dy || 1)));
          d = Math.min(d, Math.hypot(p.x - u.x - t * dx, p.y - u.y - t * dy));
        }
      }
    }
    return d;
  }

  // The shoulder views from above (epaulet sleeves, shoulder boards, R7) must not lie over the cap or its device (R6): a
  // view that would touch the cap's ink, or come within CLEAR_HAT of it, slides outward along its strap, away from the neck,
  // until it clears. The cap sits on the collar and is wider than the neck opening (the flight cap of Fig A5-9 is 11.6 to
  // 12.2 in wide), so its lower corners reach the views from above. The garment and the regulation figures for the
  // epaulets are left/right symmetric (CAPR 39-1 4.1.11.1.1.1.1, Fig 4.9), and each view sits close to its own shoulder
  // (R7), so the other shoulder's view slides by the same distance along its own outward strap axis: the pair stays mirrored
  // about the garment's centre line (the views and their grades both move). The cap is measured by its ink hull (HAT_INK),
  // not its sheet box: clearing the box of the female flight cap (12.2 x 5.0 in) would send each view 2.6 in beyond the
  // shoulder, and the service caps' boxes, which are empty at the corners, 1.2 in further than the cap needs.
  const CLEAR_HAT = 0.1, MAX_VIEW_SLIDE = 3;
  function clearViewsOfHat(ctx, hat, hatSpec, dev){
    const hull = HAT_INK[hat.id];
    const s = hatSpec ? hat.w / hatSpec.w : 1;
    const obstacles = [];
    obstacles.push(hull ? hull.map(([x, y]) => ({ x: hat.x + x * s, y: hat.y + y * s })) : layerCorners(hat));
    if(dev) obstacles.push(layerCorners(dev));
    const mid = ctx.base ? ctx.base.w / 2 : 0;
    const views = ctx.layers.filter(l => l.role === 'epaulet-top' && l.type === 'asset');
    // Outward along the strap: the piece's long axis turned by its rotation, away from the centre line.
    const outward = (l) => {
      const r = (l.rotate || 0) * Math.PI / 180;
      const u = l.w >= l.h ? { x: Math.cos(r), y: Math.sin(r) } : { x: -Math.sin(r), y: Math.cos(r) };
      return (l.x + l.w / 2 - mid) * u.x < 0 ? { x: -u.x, y: -u.y } : u;
    };
    const moved = (l, u, t) => layerCorners(Object.assign({}, l, { x: l.x + u.x * t, y: l.y + u.y * t, origin: { x: (l.origin || l).x + u.x * t, y: (l.origin || l).y + u.y * t } }));
    const clear = poly => obstacles.every(o => polygonGap(poly, o) >= CLEAR_HAT - 1e-9);
    let slide = 0;
    for(const l of views){
      const u = outward(l);
      let t = 0;
      while(t < MAX_VIEW_SLIDE && !clear(moved(l, u, t))) t += 0.01;
      // A cap no slide within the limit clears (none of the standard builds) leaves the view where it is.
      if(!clear(moved(l, u, t))) continue;
      slide = Math.max(slide, t);
    }
    if(!slide) return;
    for(const l of views){
      const u = outward(l);
      const side = (l.key || '').split(':')[1];
      for(const m of ctx.layers){
        if(m !== l && !(m.key === 'grade:top-' + side)) continue;
        m.x += u.x * slide; m.y += u.y * slide;
        if(m.origin) m.origin = { x: m.origin.x + u.x * slide, y: m.origin.y + u.y * slide };
      }
      l.slid = Math.round(slide * 100) / 100;
      l.slideDir = { x: Math.round(u.x * 1e4) / 1e4, y: Math.round(u.y * 1e4) / 1e4 };
    }
  }

  // ---- Flight Duty Uniforms (chapter 8) and flight jackets ---------------------------------------

  // Officer grade on the shoulders (8.2.3, 8.3.3): cloth-bordered, centred in each grade zone; general
  // officers' stars centred on the shoulder with a point toward the neck.
  async function flightGrade(ctx, g, b){
    if(!g.officer || g.cadet) return;
    // The CFDU's embroidered grade is folded 'to create a rectangle that is 1/8 inch larger than the insignia' (8.3.5.1): measured
    // once, on the wearer's right shoulder of the suit (the jacket beside it is configured the same, 8.3.7).
    const border = async () => { if(b && b.uniform === 'corporate_flight_suit' && !b.opt.asJacket) await blueBorder(ctx, ctx.layers.filter(l => l.key === 'grade:right').pop()); };
    if(g.general){
      const id = G.seniorOfficerInsignia(g, 'cloth-bordered', { horizontal: false });
      for(const side of ['right', 'left']){
        const zone = ctx.rect('grade_zone_go_' + side);
        if(!zone) continue;
        // The stacked form turned a quarter turn lies along the shoulder, points toward the neck.
        await ctx.place(id, { pieceAnchor: 'center', at: core.rectCenter(zone), rotate: side === 'right' ? 90 : -90, z: Z.insignia, role: 'grade', key: 'grade:' + side });
      }
      await border();
      return;
    }
    // Officers (not generals): the cloth grade is 'centered on top of each shoulder with bottom edge of insignia
    // placed 1/2 inch from shoulder seam' (8.2.3.2, 8.3.3.2, 6.1.7). The grade zone's seam-side edge is the half inch
    // line (the armhole seam, the zone's outer edge), so the piece's seam-side edge is set on it, centred on the zone's
    // height; it is never scaled (R1). The leaf and the eagle are turned a quarter turn, 90 deg clockwise on the
    // wearer's right and 90 deg counter-clockwise on the left, their tops toward the neck and their bottoms (stem,
    // talons) toward the seam, as the general officers' stars are (8.2.3.1) and as the Class B epaulet seen from above
    // and the mess dress board turn them. The bars (2d Lt, 1st Lt, Captain, flight officer grades) are not turned: the
    // art draws them upright, each bar standing along the seam and the pair side by side toward the neck, which is
    // the Class B epaulet's top view (the bars across the strap, parallel to the seam, FIX-R-OTHER-r4 item 10, R8) and
    // is what the zone, 1.60 x 1.25 in, is sized for (the sheet's reg-audit row 8.2.3.2: 'captain bars / major leaf 1.25
    // high'); turned, they ran from the neck to the sleeve, across the seam. A piece taller than the zone (the colonel's
    // eagle, 1.59 in turned, the zone being 1.25 in high: the art sized the zone for the unturned eagle) hangs from the
    // zone's top and extends down 0.34 in past the zone's bottom, so it does not run over the shoulder outline at the top
    // (FIX-R-OTHER-r2 #9; 8.3.5.1: the cloth piece itself lies on the cloth; centring it would put 0.17 in of it over the
    // outline; the art followup widens the zone to 1.6 in). The colonel's eagle is mirrored on the wearer's right so that
    // its head faces the same way, the wearer's front, on both shoulders (the mess dress boards and the collars do the same).
    const id = G.seniorOfficerInsignia(g, 'cloth-bordered');
    const spec = await ctx.spec(id);
    const bars = /^rank-senior-(second-lieutenant|first-lieutenant|captain|flight-officer|technical-flight-officer|senior-flight-officer)-/.test(id);
    for(const side of ['right', 'left']){
      const zone = ctx.rect('grade_zone_' + side);
      if(!zone) continue;
      // The wearer's right shoulder is the left of the picture: its seam is the zone's left edge. Upright, the piece's width
      // lies along the shoulder; turned, its height does.
      const along = bars ? spec.w : spec.h, high = bars ? spec.h : spec.w;
      const cx = side === 'right' ? zone.x + along / 2 : zone.x + zone.w - along / 2;
      const cy = zone.y + Math.max(zone.h, high) / 2;
      await ctx.place(id, { pieceAnchor: 'center', at: { x: cx, y: cy }, rotate: bars ? 0 : side === 'right' ? 90 : -90, flipX: !bars && side === 'right' && g.key === 'colonel',
        z: Z.insignia, role: 'grade', key: 'grade:' + side });
      // 'bottom edge of insignia placed 1/2 inch from shoulder seam' (8.2.3.2, 8.3.3.2): the sheet draws the zone's seam-side edge
      // 1/2 in from the seam (make-fdu.js), shown once, on the wearer's right shoulder of the suit.
      if(side === 'right' && b && !b.opt.asJacket) ctx.measure({ x: zone.x - 0.5, y: cy }, { x: zone.x, y: cy }, null, { caption: 'shoulder seam to grade' });
    }
    await border();
  }

  // The 2 x 4 in embroidered name tag over the left breast pocket (8.2.4.1, 8.3.4.1, Fig A6-3).
  async function flightNametag(ctx, b){
    const g = b.grade;
    const id = 'nametag-flight-embroidered-blank';
    const at = ctx.point('name_tape_center');
    if(!at) return;
    const spec = await ctx.spec(id);
    const tag = await ctx.place(id, { pieceAnchor: 'center', at, z: Z.tape, role: 'nametag', key: 'nametag' });
    // Officers: the cloth tag carries the name only and 'may include one badge' (8.2.4.1, 8.3.4.1); the officer's tag drawn here is that cloth tag, so it takes one.
    // The NCO's and the cadet's tag takes up to two, one by default (the leather tag's 'up to two badges', 8.2.4.1).
    const officerLike = g.officer && !g.cadet || (g.category === 'senior-none' && g.track === 'officer');
    if(b.name.show){
      const full = [b.name.first, b.name.last].filter(Boolean).join(' ');
      C.nameText(ctx, full, pieceRect(tag, spec, 'name_zone'), { color: SILVER_TEXT, maxH: 0.36, key: 'text:name' });
      // Officers show no grade or "CAP"; NCOs show grade and CAP; cadets "Cadet" and CAP.
      if(!officerLike){
        const gradeText = g.cadet ? 'Cadet' : (g.category === 'senior-nco' ? gradeAbbrev(g) : '');
        if(gradeText) C.nameText(ctx, gradeText, pieceRect(tag, spec, 'grade_zone'), { color: SILVER_TEXT, maxH: 0.22, upper: false, key: 'text:grade' });
        C.nameText(ctx, 'CAP', pieceRect(tag, spec, 'cap_zone'), { color: SILVER_TEXT, maxH: 0.22, key: 'text:cap' });
      }
    }
    // Badges embossed in silver above the name (8.2.4.1, 8.3.4.1). The regulation allows 'up to two badges' on the tag (8.2.4.1) and 'one CAP
    // aeronautical rating and one CAP occupational badge' (8.3.4.1): the rating (chaplain or aviation) and an occupational badge or, for a
    // current group or unit commander, the Command Insignia Pin 'rather than wearing an occupational badge'. Ethan's ruling B8 (58a5f4d3, 22
    // October 2026) cut the tag to ONE badge; on 2 November 2026, after talking with Doran, he put it back as "default of 1 badge for the
    // fdu's with the option for 2": the tag draws what the member picked (one by default, a second if he adds it), never more than two, and a
    // rating is never one of the two occupational badges (a place for each kind). FIELD7-5: with one badge the member may hold several the tag
    // takes, he chooses which (build.badgeChoices.tag, a badge id or { rating, other }; the scene reports the conflict, position 'tag').
    // Military aviation and occupational badges: 8.2.4.1 allows them on the FDU tag, 8.3.4.1 does not on the CFDU tag ('are not
    // authorized'), and the builder draws no military badge on a utility uniform (R9), so none is a candidate.
    const set = badgeSet(ctx, b, 'dress');
    const pin = commandPin(ctx, b, 'dress');
    const pinItem = (pin && !pin.graduated) ? { id: pin.id, art: pin.art, title: pin.title, command: true, family: 'command' } : null;
    // The tag takes a CAP aeronautical rating, an occupational badge (or a mission-qualification description)
    // or the command pin; a specialty track, service or National Staff badge is another kind of badge and
    // is not on the tag, which is a different reason from the tag being full.
    const para = b.uniform === 'corporate_flight_suit' ? '8.3.4.1' : '8.2.4.1';
    const ratings = [...set.chaplain, ...set.aviation];
    const candidates = [...ratings, ...(pinItem ? [pinItem] : []), ...set.occupational];
    const isRating = it => ratings.includes(it);
    const places = officerLike
      ? [{ key: 'only', label: 'Name tag badge' }]
      : [
        { key: 'rating', label: 'Aeronautical rating', accepts: isRating },
        { key: 'other', label: 'Occupational badge or command pin', accepts: it => !isRating(it) }
      ];
    // A place is asked about only where the member holds more badges than the tag has places for, or two of one kind. The officer's cloth tag has
    // the one place (the rating first, else the command pin, else the first occupational badge listed, when the member picks none).
    const competing = officerLike ? candidates.length > 1 : candidates.length > 2 || ratings.length > 1 || candidates.length - ratings.length > 1;
    let chosen;
    if(competing) chosen = C.chooseBadges(ctx, 'tag', officerLike ? 'Flight suit name tag badge' : 'Flight suit name tag badges', candidates, places);
    else chosen = officerLike ? candidates.slice(0, 1) : [ratings[0], candidates.find(it => !isRating(it))].filter(Boolean);
    const zone = pieceRect(tag, spec, 'badge_zone');
    const opts = it => ({ z: Z.badge, role: 'badge', key: 'badge:' + it.id, title: it.title });
    // The two places are fractions of the tag's badge_zone landmark (3.1 x 0.62 in, read from Fig A6-3), the viewer's left to right. The narrow badge
    // (pin or occupational) takes 0.3 of the zone and the wings the other 0.7; each is centred in its slot, inset 0.04 of the zone on each side so
    // the two never touch. 'Wings will be to the right or above an occupational badge', and CAPR 39-1 reads left and right from the wearer's side,
    // so the wings are on the wearer's right (the viewer's left) and the occupational badge on the wearer's left; the pin is stated outright on the
    // wearer's right, the wings to its left. A lone badge is centred in the zone and may use 0.7 of its width.
    const NARROW_SLOT = 0.3, SLOT_INSET = 0.04;
    const slot = (from, to) => ({ x: zone.x + zone.w * (from + to) / 2, w: zone.w * (to - from - 2 * SLOT_INSET) });
    if(chosen.length === 1){
      await placeFitted(ctx, chosen[0].art, core.rectCenter(zone), zone.w * (1 - NARROW_SLOT), zone.h, opts(chosen[0]));
    }else if(chosen.length === 2){
      const cy = zone.y + zone.h / 2;
      const wings = chosen.find(isRating), other = chosen.find(it => !isRating(it));
      const narrowFirst = !!other.command;
      const narrow = narrowFirst ? slot(0, NARROW_SLOT) : slot(1 - NARROW_SLOT, 1);
      const wide = narrowFirst ? slot(NARROW_SLOT, 1) : slot(0, 1 - NARROW_SLOT);
      await placeFitted(ctx, other.art, { x: narrow.x, y: cy }, narrow.w, zone.h, opts(other));
      await placeFitted(ctx, wings.art, { x: wide.x, y: cy }, wide.w, zone.h, opts(wings));
    }
    const other_kinds = set.all.length - set.chaplain.length - set.aviation.length - set.occupational.length;
    if(other_kinds > 0) ctx.note(`Specialty track and service badges are not worn on the flight suit name tag (CAPR 39-1, ${para})`);
    const left = candidates.filter(it => !chosen.includes(it));
    const takes = officerLike ? 'The cloth name tag for officers may include one badge' : 'The name tag takes up to two badges, one aeronautical rating and one occupational badge or the command pin';
    if(left.length && chosen.length) ctx.note(`${takes} (CAPR 39-1, ${para}): ${chosen.map(it => it.title).join(' and ')} ${chosen.length > 1 ? 'are' : 'is'} shown; ${left.map(it => it.title).join(' and ')} ${left.length > 1 ? 'are' : 'is'} not shown`);
  }

  // The Emergency Services patch (8.2.4.3, 8.3.4.3): LIVE9-4 (Ethan, on the render: "is this really where the es patch goes?" then "it says on the breast pocket", and
  // CAPR 39-1's flight suit figure, which draws the oval ON the right breast pocket's body, centred side to side and in the pocket's height below the zipper, the Command
  // Patch above the pocket and the nameplate opposite). 'Below and centered on the right breast pocket' reads: below the Command Patch (8.2.4.2, centred above the pocket)
  // and centred on the pocket itself. The patch is centred on the slanted zip pocket's polygon (the sheet's chest_pocket_right): its centre is as high as the polygon's
  // centroid and midway between the pocket's two sides at that height (the slanted top edge, the zip's, pulls the area centroid 0.5 in toward the low side, so the
  // centroid itself would not be centred side to side), and it is scaled down, uniformly, only until its box lies inside the pocket polygon (the 3.5 in round style does
  // not fit under the zip at full size). This replaces FIELD7-2's patch hung 1/8 in under the pocket (withdrawn, with its estimated gap and the note about it). The overlay
  // says 'centered' (the pocket's width at the patch's height, the tick at the patch's centre). The jacket has no breast pocket (its pockets are the two flap pockets at the
  // hem), so there the patch keeps the sheet's zone under the command patch.
  async function flightPatches(ctx, b){
    // Optional ES patch centred on the right breast pocket (8.2.4.3, 8.3.4.3).
    if(b.opt.esPatch && b.opt.esPatch !== 'none'){
      const zone = ctx.rect('es_patch_zone');
      const id = b.opt.esPatch === 'style-2' ? 'patch-es-style-2' : 'patch-es-style-1';
      const lm = !b.opt.asJacket && ctx.landmark('chest_pocket_right');
      const poly = lm && lm.points && lm.points.length >= 3 ? lm.points : null;
      if(poly){
        const spec = await ctx.spec(id);
        const c = polygonCentroid(poly);
        // The pocket's width at the centroid's height: where the horizontal line meets its sides.
        const xs = [];
        for(let i = 0; i < poly.length; i++){
          const p = poly[i], q = poly[(i + 1) % poly.length];
          if((p.y - c.y) * (q.y - c.y) < 0) xs.push(p.x + (q.x - p.x) * (c.y - p.y) / (q.y - p.y));
        }
        xs.sort((u, v) => u - v);
        const left = xs[0], right = xs[xs.length - 1], at = { x: (left + right) / 2, y: c.y };
        let k = 1;
        while(k > 0.3 && !boxInPolygon(poly, at, spec.w * k, spec.h * k, 0)) k = Math.round((k - 0.01) * 100) / 100;
        const es = await ctx.place(id, { pieceAnchor: 'center', at, scale: k, z: Z.patch, role: 'patch', key: 'patch:' + id, title: 'Emergency Services patch' });
        if(es) ctx.measure({ x: left, y: at.y }, { x: right, y: at.y }, 'centered', { mid: at, side: { x: 0, y: -1 }, offsetOnly: true, offsetPx: 16, caption: 'ES patch on the pocket' });
      }else if(zone){
        const spec = await ctx.spec(id);
        const scale = Math.min(1, zone.w / spec.w, zone.h / spec.h);
        await ctx.place(id, { pieceAnchor: 'top_center', at: { x: zone.x + zone.w / 2, y: zone.y }, scale, z: Z.patch, role: 'patch', key: 'patch:' + id, title: 'Emergency Services patch' });
      }
    }
    // One authorized patch on the right sleeve, inside the 3 1/2 in loop tape (8.2.4.5, 8.2.5.5).
    const slot = ctx.rect('patch_loop_square_right');
    const patch = (b.patches || []).find(p => p.slot !== 'CHEST_LEFT' && p.slot !== 'CHEST_RIGHT') || (b.patches || [])[0];
    if(slot && patch){
      const opts = { z: Z.patch, role: 'patch', key: 'patch:' + patch.id + ':RS:0', title: patch.title };
      if(patch.asset) await C.fitIn(ctx, patch.asset, slot, opts);
      else C.fitRaster(ctx, patch.href, slot, patch.aspect || 1, opts);
      if((b.patches || []).length > 1) ctx.note('Only one patch is worn on the flight suit sleeve (CAPR 39-1, 8.2.4.5)');
    }
  }

  function flightHat(b){
    if(b.uniform !== 'flight_suit') return null;  // no flight cap with the CFDU (8.3.8)
    // Only the flight cap goes with the FDU (8.2.8.1).
    return chooseHat(Object.assign({}, b, { opt: Object.assign({}, b.opt, { headgear: b.opt.headgear === 'none' ? 'none' : 'auto' }) }));
  }

  async function composeFlight(ctx, b){
    const corporate = b.uniform === 'corporate_flight_suit';
    const jacket = !!b.opt.asJacket;
    const garment = jacket
      ? (corporate ? 'garment-flight-jacket-blue' : 'garment-flight-jacket-green')
      : (corporate ? 'garment-cfdu-flight-suit' : 'garment-fdu-flight-suit');
    await ctx.garment(garment);
    await flightGrade(ctx, b.grade, b);
    // The U.S. flag on the left sleeve, '1/2 inch below the shoulder seam' (8.2.4.4, 8.3.4.4): from the flat sleeve's seam at its
    // centre line (the sheet's sheet_alignment.panel_arch_top_y_in) to the top of the flag the sheet draws. On the suit only; the
    // jacket beside it is configured the same (8.2.7.1).
    const flag = ctx.rect('patch_flag_left'), align = ctx.base.raw && ctx.base.raw.dimensions && ctx.base.raw.dimensions.sheet_alignment;
    if(!jacket && flag && align && align.panel_arch_top_y_in != null) ctx.measure({ x: flag.x + flag.w / 2, y: align.panel_arch_top_y_in }, { x: flag.x + flag.w / 2, y: flag.y }, null, { caption: 'shoulder seam to flag' });
    await flightNametag(ctx, b);
    await flightPatches(ctx, b);
    if(b.opt.scarf && !jacket){
      // The scarf's suit_apex meets the suit's collar_apex (8.2.6, 8.3.6).
      await ctx.place('garment-cap-command-scarf', { pieceAnchor: 'suit_apex', at: ctx.point('collar_apex'), z: Z.garmentLayer, role: 'scarf', key: 'scarf' });
    }
    const h = flightHat(b);
    if(h) await hat(ctx, h.hat, h.device);
  }

  // The flight jacket is an optional add-on beside the suit (8.2.7, 8.3.7), drawn only when the member adds it (opt.jacket, off by default; Ethan: "make
  // the jacket an optional addon like the covers on Class A's"), level with the suit (see composeUniform).
  function flightJacket(b){
    if(!b.opt.jacket) return null;
    return Object.assign({}, b, { opt: Object.assign({}, b.opt, { asJacket: true, scarf: false, headgear: 'none' }) });
  }

  const PROFILES = {
    flight_suit: { title: 'Flight Duty Uniform', compose: composeFlight, companion: flightJacket },
    corporate_flight_suit: { title: 'Corporate Flight Duty Uniform', compose: composeFlight, companion: flightJacket }
  };

  function register(id, profile){ PROFILES[id] = profile; }

  // Move a layer by (dx, dy) inches.
  function shiftLayer(l, dx, dy){
    l.x += dx; l.y += dy;
    if(l.origin) l.origin = { x: l.origin.x + dx, y: l.origin.y + dy };
    if(l.clip) l.clip = l.clip.map(p => ({ x: p.x + dx, y: p.y + dy }));
    if(l.strip) l.strip = Object.assign({}, l.strip, { x: l.strip.x + dx, y: l.strip.y + dy, origin: { x: l.strip.origin.x + dx, y: l.strip.origin.y + dy } });
    if(l.squeeze) l.squeeze = Object.assign({}, l.squeeze, { at: { x: l.squeeze.at.x + dx, y: l.squeeze.at.y + dy } });
    if(l.points) l.points = l.points.map(p => ({ x: p.x + dx, y: p.y + dy }));
    // The collar leaves cut out of a badge (clipOut) and the box the overlay keeps clear (obstacle) are scene inches too:
    // the second figure's badges lay over the collar they were cut by because the polygons stayed on the first figure.
    if(l.clipOut) l.clipOut = l.clipOut.map(poly => poly.map(p => ({ x: p.x + dx, y: p.y + dy })));
    if(l.obstacle) l.obstacle = { x: l.obstacle.x + dx, y: l.obstacle.y + dy, w: l.obstacle.w, h: l.obstacle.h };
    if(l.from) l.from = { x: l.from.x + dx, y: l.from.y + dy };
    if(l.to) l.to = { x: l.to.x + dx, y: l.to.y + dy };
    if(l.opts && l.opts.mid) l.opts = Object.assign({}, l.opts, { mid: { x: l.opts.mid.x + dx, y: l.opts.mid.y + dy } });
    return l;
  }

  // A uniform, plus the second figure its profile names (the flight jacket beside the suit, the
  // shirt worn under the blazer), drawn to its right with the garment tops level.
  // The badges a drawing wears, in drawing order: the id of every badge layer (key 'badge:<id>' or 'badge:<id>:<position>:<n>'), each once.
  // The page counts these against the uniform's badge limit instead of the badges selected (LIVE13 E77: a badge selected but not chosen
  // for a position, or not worn on the uniform, is not on it). Command insignia pins are listed too (key 'badge:<id>:ON:0'); the page
  // leaves them out of the count (4.1.5.2.2.4).
  function badgesWorn(scene){
    const ids = [];
    for(const l of scene.layers){
      if(l.role !== 'badge') continue;
      const m = /^badge:(.+?)(?::(?:ON|UN):\d+)?$/.exec(l.key || '');
      if(m && !ids.includes(m[1])) ids.push(m[1]);
    }
    return ids;
  }

  async function composeUniform(build, store){
    const scene = await composeFigures(build, store);
    scene.uniform = build.uniform;
    scene.badgesWorn = badgesWorn(scene);
    return scene;
  }

  async function composeFigures(build, store){
    const ctx = C.createContext(build, store);
    const p = PROFILES[build.uniform];
    if(!p) throw new Error('No profile for uniform ' + build.uniform);
    await p.compose(ctx, build);
    const scene = C.finish(ctx, p.title);
    const second = p.companion ? p.companion(build) : null;
    if(!second) return scene;
    const q = PROFILES[second.uniform];
    const ctx2 = C.createContext(second, store);
    await q.compose(ctx2, second);
    const other = C.finish(ctx2, q.title);
    if(!other.layers.length) return scene;
    const gap = 2;
    const dx = scene.bounds.x + scene.bounds.w + gap - other.bounds.x;
    // FIELD7-3 (Ethan: "i dont like how the jacket is slightly above the flight suit"): the second figure is level with the first at the line the sheets
    // share, the top line each sheet states (dimensions.sheet_alignment.top_line_y_in: the collar tips / top of the sleeve arch, the shoulder seam the
    // flag hangs 1/2 in from, 8.2.4.4): the sheets are drawn at different heights (2.663 in on the suit, 0.9 in on the jacket), so equal sheet tops put the
    // jacket's shoulders 1.76 in too high. Sheets that state no such line (the shirt beside a blazer) stay top to top.
    const topLine = (c, sc) => {
      const a = c.base && c.base.raw && c.base.raw.dimensions && c.base.raw.dimensions.sheet_alignment, g = sc.layers.find(l => l.role === 'garment');
      return a && a.top_line_y_in != null && g ? g.y + a.top_line_y_in : null;
    };
    const t1 = topLine(ctx, scene), t2 = topLine(ctx2, other);
    const dy = t1 != null && t2 != null ? t1 - t2 : 0;
    other.layers.forEach(l => { shiftLayer(l, dx, dy); l.figure = 2; });
    scene.layers.push(...other.layers);
    other.notes.forEach(n => { if(!scene.notes.includes(n)) scene.notes.push(n); });
    (other.conflicts || []).forEach(c => { if(!(scene.conflicts || []).some(x => x.position === c.position && JSON.stringify(x.candidates) === JSON.stringify(c.candidates))) scene.conflicts.push(c); });
    scene.bounds = core.unionBounds([scene.bounds, { x: other.bounds.x + dx, y: other.bounds.y + dy, w: other.bounds.w, h: other.bounds.h }]);
    return scene;
  }

  return { PROFILES, register, composeUniform, badgesWorn, helpers: { blueBorder, pieceRect, piecePoint, polygonTopY, epauletFrame, frameFromPolygon, collarLeadingEdge, collarSlot, polygonCentroid, boxInPolygon, collarLeaf, chevronOnLeadingEdge, collarChevrons, collarChevronScale, EDGE_SX, edgeTurn, collarOfficerRow, collarPolygons, clearViewsOfHat, fitCenter, placeFitted, badgeSet, commandPin, gradeAbbrev, hat, chooseHat, SILVER_TEXT } };
});
