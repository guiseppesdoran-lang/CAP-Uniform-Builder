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

  // The collar leaf proper of a collar polygon, as a point list. Figure A5-5 centres the chevron on the
  // leaf ('centered on the collar'), not on the band between the roll line and the neck opening, which the
  // Class B and aviator sheets include in the collar polygon. Those sheets draw the roll line from the
  // polygon's top vertex down to the roll end of the leading edge, and the outline turns back (a reflex
  // corner) at the roll end where it passes onto the band: the leaf is then the triangle top vertex,
  // collar point, roll end. A polygon that is convex at the roll end (the ABU/CFU five-point leaf, the
  // overblouse kite) has no roll line inside it: the leaf is the whole polygon. One rule, no vertex
  // indices. `edge` is collarLeadingEdge(points, centerX).
  function collarLeaf(points, edge){
    if(!edge) return points;
    const n = points.length, at = points.indexOf(edge.rollEnd);
    if(at < 0) return points;
    let area = 0;
    for(let i = 0; i < n; i++){ const p = points[i], q = points[(i + 1) % n]; area += p.x * q.y - q.x * p.y; }
    const prev = points[(at + n - 1) % n], next = points[(at + 1) % n], re = edge.rollEnd;
    // reflex at the roll end: the turn there runs against the polygon's own winding
    const turn = (re.x - prev.x) * (next.y - re.y) - (re.y - prev.y) * (next.x - re.x);
    if(turn * area >= 0) return points;
    let top = points[0];
    for(const p of points) if(p.y < top.y) top = p;
    if(top === edge.collarPoint || top === edge.rollEnd) return points;
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
    const own = ['left', 'right'].map(n => ctx.landmark('collar_' + n)).filter(l => l && l.points);
    if(own.length === 2) return own;
    const t = COLLAR_POLYGONS[ctx.base && ctx.base.id];
    return t ? [{ points: t.a }, { points: t.b }] : [];
  }

  // The front edge of a collar leaf polygon, the one a cadet officer's grade is 1 in from (5.1.1.1.1.3, 5.2.1.1.1.4: 'one inch from the front of the collar and centered'): the edge from the
  // leaf's top vertex (the collar tip) to its other neighbour nearer the sheet's centre line, along the neck opening. { collarPoint, rollEnd, inward } like collarLeadingEdge, or null.
  function collarFrontEdge(points, centerX){
    if(!points || points.length < 3) return null;
    let top = 0;
    points.forEach((p, i) => { if(p.y < points[top].y) top = i; });
    const n = points.length, a = points[(top + n - 1) % n], b = points[(top + 1) % n];
    const other = Math.abs(a.x - centerX) <= Math.abs(b.x - centerX) ? a : b, tip = points[top];
    const len = Math.hypot(other.x - tip.x, other.y - tip.y);
    if(len < 1) return null;
    let area = 0, cx = 0, cy = 0;
    for(let i = 0; i < n; i++){ const p = points[i], q = points[(i + 1) % n], cr = p.x * q.y - q.x * p.y; area += cr; cx += (p.x + q.x) * cr; cy += (p.y + q.y) * cr; }
    const inside = area ? { x: cx / (3 * area), y: cy / (3 * area) } : tip;
    let nrm = { x: (other.y - tip.y) / len, y: -(other.x - tip.x) / len };
    if(nrm.x * (inside.x - tip.x) + nrm.y * (inside.y - tip.y) < 0) nrm = { x: -nrm.x, y: -nrm.y };
    return { collarPoint: tip, rollEnd: other, inward: nrm };
  }

  // `opts.edgeOf(poly, centerX)`, when given (the ABU and CFU, profiles-field.js), supplies the front (leading) edge in place of the polygon search.
  // Cadet officers on both collars of the ABU and CFU (5.1.1.1.1.3, 5.2.1.1.1.4: 'one inch from the front of the collar and centered'). The text states no orientation;
  // Ethan's reading (COLLAR4, 'the short edge needs to be parallel to the bottom of the collar. diamonds should always be the same sides'): the cloth's SHORT side
  // lies on the OUTER edge of the leaf (collarOuterEdge, the long diagonal from the collar point to the shoulder end, from the leaf polygon, the same code for both
  // leaves), so every field-grade diamond (Major, Lieutenant Colonel, Colonel) has its long point-to-point axis parallel to that edge, all alike, and the row
  // (the Lieutenant Colonel's two, the Colonel's three, the company grades' two and three discs) stacks away from the edge, across the leaf. The art is drawn
  // with its diamonds' long axis vertical (y) and its row horizontal (x), so the turn is the edge's angle plus a quarter turn for every grade. Near outline 1 in
  // from the front edge, centred on the leaf along the row, a 1 in measure from the front edge to the near outline (the row is turned, so the 1 in is taken to the
  // corner of the box that reaches toward the front edge).
  async function collarOfficerRow(ctx, g, opts){
    // `opts.miniatureKeys` (the ABU and CFU, 5.1.1.1.1.3, 5.2.1.1.1.4: 'Cadet Colonels and Cadet Captains may wear miniature, embroidered insignia') names the
    // grades drawn in the miniature cloth-bordered form, which is what fits the leaf; the others wear regular size.
    const mini = opts && opts.miniatureKeys && opts.miniatureKeys.includes(g.key);
    const id = G.cadetOfficerInsignia(g, mini ? 'cloth-bordered-miniature' : 'cloth-bordered-regular');
    const polys = collarPolygons(ctx);
    if(!id || polys.length < 2) return;
    if(!ctx.has(id)){ ctx.note(`No artwork for ${id}`); return; }
    const s = await ctx.spec(id);
    const centerX = ctx.base.w / 2;
    for(const poly of polys){
      const edge = opts && opts.edgeOf ? opts.edgeOf(poly, centerX) : collarFrontEdge(poly.points, centerX);
      if(!edge) continue;
      const side = edge.collarPoint.x < centerX ? 'right' : 'left';
      // The art's y axis (the diamonds' long axis) onto the outer edge: the edge's angle plus a quarter turn, in (-90, 90], mirrored on the other leaf.
      let rotate = collarOuterAngle(poly.points, centerX) + 90;
      if(rotate > 90) rotate -= 180;
      const r = rotate * Math.PI / 180, b = { x: Math.cos(r), y: Math.sin(r) }, n = { x: -b.y, y: b.x };
      // The perpendicular of the front edge on the leaf's side; the row's half-extent toward the edge is its corner reach.
      const dx = edge.rollEnd.x - edge.collarPoint.x, dy = edge.rollEnd.y - edge.collarPoint.y, len = Math.hypot(dx, dy);
      let u = { x: -dy / len, y: dx / len };
      if(u.x * edge.inward.x + u.y * edge.inward.y < 0) u = { x: -u.x, y: -u.y };
      const reach = Math.abs(b.x * u.x + b.y * u.y) * s.w / 2 + Math.abs(n.x * u.x + n.y * u.y) * s.h / 2;
      const pl = chevronOnLeadingEdge(edge, 2 * reach, 1, poly.points);
      await ctx.place(id, { pieceAnchor: 'center', at: pl.at, rotate, z: opts && opts.z != null ? opts.z : Z.insignia, role: 'grade', key: 'grade:' + side });
      ctx.measure(pl.foot, pl.near);
    }
  }

  // The OUTER edge of a collar leaf polygon: the long diagonal edge from the leaf's collar point (its top vertex, where the front edge starts) outward to the
  // shoulder end (the polygon neighbour of that vertex farther from the sheet's centre line). Ethan's 'bottom line' of the ABU and CFU leaf (the third read:
  // the first took the front edge, the second the edge between the two lowest vertices, 2.8 degrees off horizontal, 'blatantly wrong'). The leaf is a
  // five-point polygon, so the lowest vertex and the vertex farthest out are one and the same and cannot name the edge; the top vertex and its outer
  // neighbour do. Found by extremes alone, no vertex indices, the same code for both leaves (the mirror image gives the mirrored edge).
  // Returns { collarPoint, rollEnd, inward } ({ collarPoint: the top vertex, rollEnd: the shoulder end, inward: the side the leaf lies on }) or null.
  function collarOuterEdge(points, centerX){
    if(!points || points.length < 3) return null;
    const n = points.length;
    let top = 0;
    points.forEach((p, i) => {
      const t = points[top];
      if(p.y < t.y - 0.005 || (Math.abs(p.y - t.y) <= 0.005 && Math.abs(p.x - centerX) > Math.abs(t.x - centerX))) top = i;
    });
    const a = points[(top + n - 1) % n], b = points[(top + 1) % n], tip = points[top];
    const end = Math.abs(a.x - centerX) >= Math.abs(b.x - centerX) ? a : b;
    const len = Math.hypot(end.x - tip.x, end.y - tip.y);
    if(len < 1) return null;
    let area = 0, cx = 0, cy = 0;
    for(let i = 0; i < n; i++){ const p = points[i], q = points[(i + 1) % n], cr = p.x * q.y - q.x * p.y; area += cr; cx += (p.x + q.x) * cr; cy += (p.y + q.y) * cr; }
    const inside = area ? { x: cx / (3 * area), y: cy / (3 * area) } : tip;
    let inward = { x: (end.y - tip.y) / len, y: -(end.x - tip.x) / len };
    if(inward.x * (inside.x - tip.x) + inward.y * (inside.y - tip.y) < 0) inward = { x: -inward.x, y: -inward.y };
    return { collarPoint: tip, rollEnd: end, inward };
  }
  // SVG rotate, degrees in (-90, 90], that lays the x axis of a piece along the outer edge of the leaf: mirrored sign on the mirror-image leaf.
  function collarOuterAngle(points, centerX){
    const e = collarOuterEdge(points, centerX);
    if(!e) return 0;
    let d = Math.atan2(e.rollEnd.y - e.collarPoint.y, e.rollEnd.x - e.collarPoint.x) * 180 / Math.PI;
    if(d > 90) d -= 180; if(d <= -90) d += 180;
    return d;
  }

  // Cadet NCO and Airman chevrons on both collars, by the rule of Figure A5-5 ('shirt without necktie',
  // CAPR 39-1 page 134) for every garment (Class B, aviator shirt, overblouse, ABU, CFU): the chevron's
  // axis parallel to the leading edge of the collar leaf (its bottom edge, collar point to roll line),
  // top of the insignia (peak / shield canton) toward the roll-line end, rockers toward the collar point, the near outline 1 in from the edge, centred on the leaf (4.1.11.1.1.1.4,
  // 4.1.12.2.3.5, 4.2.5.1.1.5, 4.2.6.2.5, 5.1.1.1.1.4, 5.2.1.1.1). The wearer's right is the collar on
  // the left of the picture whatever the sheet calls its sides.
  async function collarChevrons(ctx, g, opts){
    const id = G.cadetNcoChevron(g, 'metal');
    const polys = collarPolygons(ctx);
    if(!id || polys.length < 2) return;
    if(!ctx.has(id)){ ctx.note(`No artwork for ${id}`); return; }
    const s = await ctx.spec(id);
    const centerX = ctx.base.w / 2;
    for(const poly of polys){
      const edge = opts && opts.edgeOf ? opts.edgeOf(poly, centerX) : collarLeadingEdge(poly.points, centerX);
      if(!edge) continue;
      const side = edge.collarPoint.x < centerX ? 'right' : 'left';
      const pl = chevronOnLeadingEdge(edge, s.w, 1, collarLeaf(poly.points, edge));
      await ctx.place(id, { pieceAnchor: 'center', at: pl.at, rotate: pl.rotate, z: opts && opts.z != null ? opts.z : Z.insignia, role: 'grade', key: 'grade:' + side });
      ctx.measure(pl.foot, pl.near);
    }
  }

  // Fit a piece in a rect (never larger than true size) and centre it there.
  async function fitCenter(ctx, id, rect, opts){
    return C.fitIn(ctx, id, rect, opts);
  }

  // Scale a piece so it fits maxW x maxH (never up), centred on a point.
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
      const ordered = C.preferred(out.aviation, (b.badgeChoices || {}).aviation);
      if(para !== false) C.reportBadgeConflict(ctx, 'aviation', 'CAP aviation badge', out.aviation, ordered, 1);
      out.aviation = ordered.slice(0, 1);
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
      // ICL 25-02 (g): senior NCOs wear the NCO device on the flight cap and the service cap.
      if(service) return { hat: `hat-service-cap-${sex}-officer-nco`, device: 'cap-device-nco-flight' };
      return { hat: 'hat-flight-cap-cadet', device: 'cap-device-nco-flight' };
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
  async function flightGrade(ctx, g){
    if(!g.officer || g.cadet) return;
    if(g.general){
      const id = G.seniorOfficerInsignia(g, 'cloth-bordered', { horizontal: false });
      for(const side of ['right', 'left']){
        const zone = ctx.rect('grade_zone_go_' + side);
        if(!zone) continue;
        // The stacked form turned a quarter turn lies along the shoulder, points toward the neck.
        await ctx.place(id, { pieceAnchor: 'center', at: core.rectCenter(zone), rotate: side === 'right' ? 90 : -90, z: Z.insignia, role: 'grade', key: 'grade:' + side });
      }
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
    }
  }

  // The 2 x 4 in embroidered name tag over the left breast pocket (8.2.4.1, 8.3.4.1, Fig A6-3).
  async function flightNametag(ctx, b){
    const g = b.grade;
    const id = 'nametag-flight-embroidered-blank';
    const at = ctx.point('name_tape_center');
    if(!at) return;
    const spec = await ctx.spec(id);
    const tag = await ctx.place(id, { pieceAnchor: 'center', at, z: Z.tape, role: 'nametag', key: 'nametag' });
    // Officers: the cloth tag carries the name only and one badge (8.2.4.1, 8.3.4.1).
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
    // Badges embossed in silver above the name (8.2.4.1, 8.3.4.1). The regulation allows 'up to two badges' on the leather tag and the NCO and
    // cadet cloth tags (the CAP aeronautical rating and an occupational badge or, for a current group or unit commander, the Command Insignia
    // Pin rather than the occupational badge); ETHAN'S RULING (LIVE-FIELD B8, over 'up to two'): the tag carries ONE badge on every flight
    // suit tag, officer, NCO or cadet, leather or cloth: the aviation badge if one is held (the chaplain badge, highest, if that is held),
    // else the current command pin (it takes the occupational badge's place, 8.2.4.1), else the first occupational badge listed (the page
    // lists them in precedence order). The note names what was left off. The cloth tag for officers 'may include one badge' anyway.
    const set = badgeSet(ctx, b, 'dress');
    const pin = commandPin(ctx, b, 'dress');
    const wings = [...set.chaplain, ...set.aviation][0] || null;
    const pinItem = (pin && !pin.graduated) ? { id: pin.id, art: pin.art, title: pin.title, command: true } : null;
    const other = pinItem || set.occupational[0] || null;
    const chosen = [wings || other].filter(Boolean);
    const zone = pieceRect(tag, spec, 'badge_zone');
    const opts = it => ({ z: Z.badge, role: 'badge', key: 'badge:' + it.id, title: it.title });
    // The lone badge is centred in the tag's badge_zone landmark and may use 0.7 of its width (the width the wings had beside a narrow badge).
    if(chosen.length === 1) await placeFitted(ctx, chosen[0].art, core.rectCenter(zone), zone.w * 0.7, zone.h, opts(chosen[0]));
    // Something worn on the member's record is not on the tag: the command pin counts as one candidate
    // when it is current (a graduated pin is never worn).
    // The tag takes a CAP aeronautical rating, an occupational badge (or a mission-qualification description)
    // or the command pin; a specialty track, service or National Staff badge is another kind of badge and
    // is not on the tag, which is a different reason from the tag being full.
    const para = b.uniform === 'corporate_flight_suit' ? '8.3.4.1' : '8.2.4.1';
    const candidates = [...set.chaplain, ...set.aviation, ...set.occupational, ...(pinItem ? [pinItem] : [])];
    const other_kinds = set.all.length - set.chaplain.length - set.aviation.length - set.occupational.length;
    if(other_kinds > 0) ctx.note(`Specialty track and service badges are not worn on the flight suit name tag (CAPR 39-1, ${para})`);
    const left = candidates.filter(it => !chosen.includes(it));
    if(left.length) ctx.note(`The flight suit name tag carries one badge here (a ruling over 'up to two' in CAPR 39-1, ${para}): the ${chosen[0].title} is shown; ${left.map(it => it.title).join(' and ')} ${left.length > 1 ? 'are' : 'is'} not shown`);
  }

  async function flightPatches(ctx, b){
    // Optional ES patch below and centred on the right breast pocket (8.2.4.3, 8.3.4.3).
    if(b.opt.esPatch && b.opt.esPatch !== 'none'){
      const zone = ctx.rect('es_patch_zone');
      const id = b.opt.esPatch === 'style-2' ? 'patch-es-style-2' : 'patch-es-style-1';
      if(zone){
        // Directly below the pocket (the zone's top edge is the line under the pocket), centred on it.
        const spec = await ctx.spec(id);
        const scale = Math.min(1, zone.w / spec.w, zone.h / spec.h);
        await ctx.place(id, { pieceAnchor: 'top_center', at: { x: zone.x + zone.w / 2, y: zone.y }, scale, z: Z.patch, role: 'patch', key: 'patch:' + id, title: 'Emergency Services patch' });
      }
    }
    // One authorized patch on the right sleeve, inside the 3 1/2 in loop tape (8.2.4.5, 8.2.5.5).
    const slot = ctx.rect('patch_loop_square_right');
    const patch = (b.patches || []).find(p => p.slot !== 'CHEST_LEFT' && p.slot !== 'CHEST_RIGHT') || (b.patches || [])[0];
    if(slot && patch){
      C.fitRaster(ctx, patch.href, slot, patch.aspect || 1, { z: Z.patch, role: 'patch', key: 'patch:' + patch.id + ':RS:0', title: patch.title });
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
    await flightGrade(ctx, b.grade);
    await flightNametag(ctx, b);
    await flightPatches(ctx, b);
    if(b.opt.scarf && !jacket){
      // The scarf's suit_apex meets the suit's collar_apex (8.2.6, 8.3.6).
      await ctx.place('garment-cap-command-scarf', { pieceAnchor: 'suit_apex', at: ctx.point('collar_apex'), z: Z.garmentLayer, role: 'scarf', key: 'scarf' });
    }
    const h = flightHat(b);
    if(h) await hat(ctx, h.hat, h.device);
  }

  // The flight jacket is drawn beside the suit (8.2.7, 8.3.7) unless the member hides it.
  function flightJacket(b){
    if(b.opt.jacket === false) return null;
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
  async function composeUniform(build, store){
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
    other.layers.forEach(l => { shiftLayer(l, dx, 0); l.figure = 2; });
    scene.layers.push(...other.layers);
    other.notes.forEach(n => { if(!scene.notes.includes(n)) scene.notes.push(n); });
    (other.conflicts || []).forEach(c => { if(!(scene.conflicts || []).some(x => x.position === c.position && JSON.stringify(x.candidates) === JSON.stringify(c.candidates))) scene.conflicts.push(c); });
    scene.bounds = core.unionBounds([scene.bounds, { x: other.bounds.x + dx, y: other.bounds.y, w: other.bounds.w, h: other.bounds.h }]);
    return scene;
  }

  return { PROFILES, register, composeUniform, helpers: { pieceRect, piecePoint, polygonTopY, epauletFrame, frameFromPolygon, collarLeadingEdge, collarOuterEdge, collarOuterAngle, collarLeaf, chevronOnLeadingEdge, collarChevrons, collarOfficerRow, collarPolygons, clearViewsOfHat, fitCenter, placeFitted, badgeSet, commandPin, gradeAbbrev, hat, chooseHat, SILVER_TEXT } };
});
