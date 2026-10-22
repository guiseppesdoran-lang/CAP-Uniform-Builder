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
  // inches (a = the leaf on the left of the picture, b = the right): the leaf path of each sheet's SVG
  // with the group transforms applied (the overblouse collar-right/-left paths; the aviator shirt and the ABU and CFU
  // sheets state collar_left / collar_right themselves).
  // A test reads them again from the SVG. Remove an entry when its sheet states the polygon.
  const COLLAR_POLYGONS = (() => {
    const pts = a => a.map(([x, y]) => ({ x, y }));
    const over = { a: pts([[8.814, 0.100], [9.526, 1.167], [9.988, 1.986], [10.700, 2.448], [8.459, 4.013], [7.961, 1.594]]), b: pts([[12.586, 0.100], [11.874, 1.167], [11.412, 1.986], [10.700, 2.448], [12.941, 4.013], [13.439, 1.594]]) };
    return {
      'garment-overblouse-female': over, 'garment-overblouse-female-long': over
    };
  })();

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

  // Cadet officers on both collars of the ABU and CFU (5.1.1.1.1.3, 5.2.1.1.1.4): the grade's row (its width) runs parallel to the front edge, its near outline 1 in from it,
  // centred on the leaf along it (chord of the leaf on that line), like the cadet NCO chevron's 1 in rule; a 1 in measure from the edge to the near outline.
  async function collarOfficerRow(ctx, g){
    const id = G.cadetOfficerInsignia(g, 'cloth-bordered-regular');
    const polys = collarPolygons(ctx);
    if(!id || polys.length < 2) return;
    if(!ctx.has(id)){ ctx.note(`No artwork for ${id}`); return; }
    const s = await ctx.spec(id);
    const centerX = ctx.base.w / 2;
    for(const poly of polys){
      const edge = collarFrontEdge(poly.points, centerX);
      if(!edge) continue;
      const side = edge.collarPoint.x < centerX ? 'right' : 'left';
      const pl = chevronOnLeadingEdge(edge, s.h, 1, poly.points);   // the row's height is across the edge
      const dx = edge.rollEnd.x - edge.collarPoint.x, dy = edge.rollEnd.y - edge.collarPoint.y;
      let rotate = Math.atan2(dy, dx) * 180 / Math.PI;                 // the row (the art's width) turned onto the edge
      if(rotate > 90) rotate -= 180; if(rotate <= -90) rotate += 180;
      await ctx.place(id, { pieceAnchor: 'center', at: pl.at, rotate, z: Z.insignia, role: 'grade', key: 'grade:' + side });
      ctx.measure(pl.foot, pl.near);
    }
  }

  // Cadet NCO and Airman chevrons on both collars, by the rule of Figure A5-5 ('shirt without necktie',
  // CAPR 39-1 page 134) for every garment (Class B, aviator shirt, overblouse, ABU, CFU): the chevron's
  // axis parallel to the leading edge of the collar leaf (its bottom edge, collar point to roll line),
  // top of the insignia (peak / shield canton) toward the roll-line end, rockers toward the collar point, the near outline 1 in from the edge, centred on the leaf (4.1.11.1.1.1.4,
  // 4.1.12.2.3.5, 4.2.5.1.1.5, 4.2.6.2.5, 5.1.1.1.1.4, 5.2.1.1.1). The wearer's right is the collar on
  // the left of the picture whatever the sheet calls its sides.
  async function collarChevrons(ctx, g){
    const id = G.cadetNcoChevron(g, 'metal');
    const polys = collarPolygons(ctx);
    if(!id || polys.length < 2) return;
    if(!ctx.has(id)){ ctx.note(`No artwork for ${id}`); return; }
    const s = await ctx.spec(id);
    const centerX = ctx.base.w / 2;
    for(const poly of polys){
      const edge = collarLeadingEdge(poly.points, centerX);
      if(!edge) continue;
      const side = edge.collarPoint.x < centerX ? 'right' : 'left';
      const pl = chevronOnLeadingEdge(edge, s.w, 1, collarLeaf(poly.points, edge));
      await ctx.place(id, { pieceAnchor: 'center', at: pl.at, rotate: pl.rotate, z: Z.insignia, role: 'grade', key: 'grade:' + side });
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
      out.aviation = out.aviation.slice(0, 1);
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
    // The shirt drawn beside a blazer is a companion figure: the blazer's rule applies to its notes.
    const e = b.companionOf && ONE_AVIATION_BADGE[b.companionOf] === false ? false : ONE_AVIATION_BADGE[b.uniform];
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
    if(device && ctx.has(device)){
      const slot = piecePoint(layer, hs, 'device_slot_center');
      const ds = await ctx.spec(device);
      const anchorName = core.anchor(ds, 'mount_center') ? 'mount_center' : 'center';
      const dl = await ctx.place(device, { pieceAnchor: anchorName, at: slot, z: Z.hatDevice, role: 'hat-device', key: 'hat-device:' + device });
      if(dl) clearViewsOfDevice(ctx, dl);
    }
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
  // The shoulder views from above (epaulet sleeves, shoulder boards) lie over the cap's lower corners, and
  // the cap device is mounted there on the flight cap (6.2.2.2.1): a view that would hide part of the device
  // (R6, R7) slides outward along its strap, away from the neck, until it clears the device by CLEAR_DEVICE in (only a view that overlaps the device moves).
  // It stays on the shoulder: the slide is capped at MAX_VIEW_SLIDE (the grade slides with it); a device box the view cannot clear within that is left alone.
  const CLEAR_DEVICE = 0.05, MAX_VIEW_SLIDE = 0.8;
  function clearViewsOfDevice(ctx, dev){
    const rect = (g) => [{ x: dev.x - g, y: dev.y - g }, { x: dev.x + dev.w + g, y: dev.y - g }, { x: dev.x + dev.w + g, y: dev.y + dev.h + g }, { x: dev.x - g, y: dev.y + dev.h + g }];
    const exact = rect(0), box = rect(CLEAR_DEVICE);
    for(const l of ctx.layers){
      if(l.role !== 'epaulet-top' || l.type !== 'asset' || !polygonsOverlap(layerCorners(l), exact)) continue;
      // Outward along the strap: the box's long axis turned by the layer's rotation, away from the centre line.
      const r = (l.rotate || 0) * Math.PI / 180;
      let u = { x: -Math.sin(r), y: Math.cos(r) };
      const mid = ctx.base ? ctx.base.w / 2 : 0;
      if((l.x + l.w / 2 - mid) * u.x < 0) u = { x: -u.x, y: -u.y };
      let t = 0;
      const moved = () => layerCorners(Object.assign({}, l, { x: l.x + u.x * t, y: l.y + u.y * t, origin: { x: l.origin.x + u.x * t, y: l.origin.y + u.y * t } }));
      while(t < MAX_VIEW_SLIDE && polygonsOverlap(moved(), box)) t += 0.01;
      // A box this wide (the cadet colonel's three diamonds) only overlaps the view in its padding: the view stays.
      if(polygonsOverlap(moved(), box)) continue;
      const side = (l.key || '').split(':')[1];
      for(const m of ctx.layers){
        if(m !== l && !(m.key === 'grade:top-' + side)) continue;
        m.x += u.x * t; m.y += u.y * t;
        if(m.origin) m.origin = { x: m.origin.x + u.x * t, y: m.origin.y + u.y * t };
      }
      l.slid = Math.round(t * 100) / 100;
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
    // Officers (not generals): the cloth grade sits on top of the shoulder with its outer edge a half
    // inch from the shoulder seam (8.2.3.2, 8.3.3.2, 6.1.7). The grade zone is sized for the widest
    // form and its seam-side edge is that half inch line, so every form is set against that edge,
    // not centred in the zone (a captain's bars would otherwise sit 0.7 in from the seam).
    const id = G.seniorOfficerInsignia(g, 'cloth-bordered');
    const spec = await ctx.spec(id);
    for(const side of ['right', 'left']){
      const zone = ctx.rect('grade_zone_' + side);
      if(!zone) continue;
      const scale = Math.min(1, zone.w / spec.w, zone.h / spec.h);
      const w = spec.w * scale;
      // The wearer's right shoulder is the left of the picture: its seam is the zone's left edge.
      const cx = side === 'right' ? zone.x + w / 2 : zone.x + zone.w - w / 2;
      await ctx.place(id, { pieceAnchor: 'center', at: { x: cx, y: zone.y + zone.h / 2 }, scale, z: Z.insignia, role: 'grade', key: 'grade:' + side });
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
    // Badges embossed in silver above the name (8.2.4.1, 8.3.4.1). The leather tag and the NCO and cadet
    // cloth tags carry two: the CAP aeronautical rating (wings) and either an occupational badge or, for a
    // current group or unit commander, the Command Insignia Pin "rather than" the occupational badge.
    // The text puts the wings "to the right or above an occupational badge", and CAPR 39-1 reads left and
    // right from the wearer's side throughout, so there the wings are on the wearer's right (the viewer's
    // left) and the occupational badge on the wearer's left. The command pin is stated outright: it goes
    // on the wearer's right, the wings to its left. The cloth tag for officers "will include name (first
    // and last) and may include one badge as described above" (8.2.4.1, 8.3.4.1), so an officer tag
    // carries one badge: the aeronautical rating if there is one, else the current command pin, else the
    // occupational badge.
    const set = badgeSet(ctx, b, 'dress');
    const pin = commandPin(ctx, b, 'dress');
    const wings = [...set.chaplain, ...set.aviation][0] || null;
    const pinItem = (pin && !pin.graduated) ? { id: pin.id, art: pin.art, title: pin.title, command: true } : null;
    const other = pinItem || set.occupational[0] || null;
    const chosen = officerLike ? [wings || other].filter(Boolean) : [wings, other].filter(Boolean);
    const zone = pieceRect(tag, spec, 'badge_zone');
    const opts = it => ({ z: Z.badge, role: 'badge', key: 'badge:' + it.id, title: it.title });
    // Both slots are fractions of the tag's badge_zone landmark, the viewer's left to right. The narrow
    // badge (pin or occupational) takes 0.3 of the zone and the wings the other 0.7. Each badge is centred
    // in its slot, inset 0.04 of the zone on each side so the two never touch. A lone badge is centred in
    // the zone and may use the wings' 0.7 width.
    const NARROW_SLOT = 0.3, SLOT_INSET = 0.04;
    const slot = (from, to) => ({ x: zone.x + zone.w * (from + to) / 2, w: zone.w * (to - from - 2 * SLOT_INSET) });
    if(chosen.length === 1){
      await placeFitted(ctx, chosen[0].art, core.rectCenter(zone), zone.w * (1 - NARROW_SLOT), zone.h, opts(chosen[0]));
    }else if(chosen.length === 2){
      const cy = zone.y + zone.h / 2;
      // Command pin: narrow slot on the viewer's left (wearer's right), wings to its left as worn.
      // Occupational badge: wings on the viewer's left (wearer's right), the badge in the narrow slot.
      const narrowFirst = !!other.command;
      const narrow = narrowFirst ? slot(0, NARROW_SLOT) : slot(1 - NARROW_SLOT, 1);
      const wide = narrowFirst ? slot(NARROW_SLOT, 1) : slot(0, 1 - NARROW_SLOT);
      await placeFitted(ctx, other.art, { x: narrow.x, y: cy }, narrow.w, zone.h, opts(other));
      await placeFitted(ctx, wings.art, { x: wide.x, y: cy }, wide.w, zone.h, opts(wings));
    }
    // Something worn on the member's record is not on the tag: the command pin counts as one candidate
    // when it is current (a graduated pin is never worn).
    // The tag takes a CAP aeronautical rating, an occupational badge (or a mission-qualification description)
    // or the command pin; a specialty track, service or National Staff badge is another kind of badge and
    // is not on the tag, which is a different reason from the tag being full.
    const para = b.uniform === 'corporate_flight_suit' ? '8.3.4.1' : '8.2.4.1';
    const eligible = set.chaplain.length + set.aviation.length + set.occupational.length + (pinItem ? 1 : 0);
    const other_kinds = set.all.length - set.chaplain.length - set.aviation.length - set.occupational.length;
    if(other_kinds > 0) ctx.note(`Specialty track and service badges are not worn on the flight suit name tag (CAPR 39-1, ${para})`);
    if(eligible > chosen.length) ctx.note(officerLike
      ? `The officer cloth name tag carries one badge (CAPR 39-1, ${para}); the rest are not shown`
      : `Flight suit name tags carry at most two badges (CAPR 39-1, ${para}); the rest are not shown`);
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
    second.companionOf = build.uniform;
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
    scene.bounds = core.unionBounds([scene.bounds, { x: other.bounds.x + dx, y: other.bounds.y, w: other.bounds.w, h: other.bounds.h }]);
    return scene;
  }

  return { PROFILES, register, composeUniform, helpers: { pieceRect, piecePoint, polygonTopY, epauletFrame, frameFromPolygon, collarLeadingEdge, collarLeaf, chevronOnLeadingEdge, collarChevrons, collarOfficerRow, collarPolygons, clearViewsOfDevice, fitCenter, placeFitted, badgeSet, commandPin, gradeAbbrev, hat, chooseHat, SILVER_TEXT } };
});
