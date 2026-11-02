// Uniform engine, part 1: asset specs and placement primitives.
//
// Every asset is an SVG whose root is sized in inches with a viewBox of 0.01 in per user unit, plus a
// .spec.json with anchors (points) and landmarks (rects or polygons) in those user units. The engine
// works in inches: a layer is an asset placed with its top-left at (x, y) in the scene, which is the
// base garment's own box (origin at the garment's top-left). Placement is always "this anchor of the
// piece goes on that point of the garment", so nothing is calibrated by hand.
//
// Loads as a classic script (window.CAPUBEngine.core) and as a CommonJS module for the Node tests.
(function(root, factory){
  const api = factory();
  if(typeof module === 'object' && module.exports) module.exports = api;
  else { root.CAPUBEngine = root.CAPUBEngine || {}; root.CAPUBEngine.core = api; }
})(typeof self !== 'undefined' ? self : this, function(){
  'use strict';

  const UNITS_PER_INCH = 100;

  // The artwork was built in several rounds and a few anchors carry different names on different
  // garments. The engine asks for the canonical name; these are the spellings it also accepts.
  const ANCHOR_ALIASES = {
    nameplate_center: ['nameplate_center', 'nametag_center', 'nameplate_slot_center'],
    collar_insignia_right: ['collar_insignia_right', 'collar_insignia_right_center'],
    collar_insignia_left: ['collar_insignia_left', 'collar_insignia_left_center'],
    lapel_insignia_right: ['lapel_insignia_right', 'lapel_us_right_center'],
    lapel_insignia_left: ['lapel_insignia_left', 'lapel_us_left_center'],
    rank_rule_point_right: ['rank_rule_point_right', 'rank_rule_point_right_center'],
    rank_rule_point_left: ['rank_rule_point_left', 'rank_rule_point_left_center'],
    ribbon_row_bottom_center: ['ribbon_row_bottom_center', 'welt_top_center']
  };

  function round(n){ return Math.round(n * 10000) / 10000; }

  function toInchesPoint(p){ return { x: p[0] / UNITS_PER_INCH, y: p[1] / UNITS_PER_INCH }; }

  function toInchesLandmark(v){
    if(Array.isArray(v)) return { points: v.map(toInchesPoint) };
    if(v && typeof v === 'object' && 'x' in v && 'w' in v){
      return { x: v.x / UNITS_PER_INCH, y: v.y / UNITS_PER_INCH, w: v.w / UNITS_PER_INCH, h: v.h / UNITS_PER_INCH };
    }
    return v; // frames ({deg, along, across}) and angle tables are passed through unchanged
  }

  // A normalized spec: sizes, anchors and landmarks in inches, plus the raw JSON for anything else.
  function normalizeSpec(entry, rawSpec){
    const raw = rawSpec || {};
    const anchorsRaw = Object.assign({}, entry.anchors || {}, raw.anchors || {});
    const anchors = {};
    Object.keys(anchorsRaw).forEach(name => {
      const p = anchorsRaw[name];
      if(Array.isArray(p) && p.length === 2 && p.every(Number.isFinite)) anchors[name] = toInchesPoint(p);
    });
    const landmarks = {};
    Object.keys(raw.landmarks || {}).forEach(name => { landmarks[name] = toInchesLandmark(raw.landmarks[name]); });
    return {
      id: entry.id,
      path: entry.path,
      category: entry.category,
      w: entry.w_in,
      h: entry.h_in,
      sizeSource: entry.size_source,
      anchors,
      landmarks,
      raw
    };
  }

  // Holds the manifest and the specs fetched so far. `loader(path)` returns a promise of parsed JSON;
  // the browser passes fetch, the tests pass a disk reader.
  function createSpecStore(manifest, loader){
    const byId = new Map();
    (manifest.assets || []).forEach(a => byId.set(a.id, a));
    const specs = new Map();
    const pending = new Map();

    function has(id){ return byId.has(id); }
    function entry(id){ return byId.get(id) || null; }

    function load(id){
      if(specs.has(id)) return Promise.resolve(specs.get(id));
      if(pending.has(id)) return pending.get(id);
      const e = byId.get(id);
      if(!e) return Promise.reject(new Error('Unknown asset ' + id));
      const specPath = e.path.replace(/\.svg$/, '.spec.json');
      const p = Promise.resolve(e.has_spec ? loader(specPath) : null)
        .catch(() => null)
        .then(raw => { const s = normalizeSpec(e, raw); specs.set(id, s); pending.delete(id); return s; });
      pending.set(id, p);
      return p;
    }

    function loadAll(ids){ return Promise.all([...new Set(ids)].filter(has).map(load)); }

    function get(id){
      const s = specs.get(id);
      if(!s) throw new Error('Spec not loaded: ' + id);
      return s;
    }

    return { has, entry, load, loadAll, get, manifest };
  }

  // Anchor lookup with aliases. Returns {x, y} in inches in the asset's own box, or null.
  function anchor(spec, name){
    const names = ANCHOR_ALIASES[name] || [name];
    for(const n of names) if(spec.anchors[n]) return spec.anchors[n];
    return null;
  }

  function requireAnchor(spec, name){
    const a = anchor(spec, name);
    if(!a) throw new Error(`Asset ${spec.id} has no anchor ${name}`);
    return a;
  }

  function landmark(spec, name){ return spec.landmarks[name] || null; }

  function rectCenter(r){ return { x: r.x + r.w / 2, y: r.y + r.h / 2 }; }

  function polygonBounds(points){
    const xs = points.map(p => p.x), ys = points.map(p => p.y);
    const x = Math.min(...xs), y = Math.min(...ys);
    return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
  }

  function landmarkBounds(spec, name){
    const l = landmark(spec, name);
    if(!l) return null;
    if(l.points) return polygonBounds(l.points);
    if('w' in l) return l;
    return null;
  }

  // Where a named point of the piece is, given a point in the scene. `scale` multiplies the piece's
  // regulation size (1 = true size); rotation is about the piece's anchor.
  function placeAsset(spec, opts){
    const scale = opts.scale || 1;
    const sx = scale * (opts.scaleX || 1);
    const a = opts.pieceAnchor ? (typeof opts.pieceAnchor === 'string' ? requireAnchor(spec, opts.pieceAnchor) : opts.pieceAnchor)
      : { x: spec.w / 2, y: spec.h / 2 };
    const at = opts.at;
    const layer = {
      type: 'asset',
      id: spec.id,
      x: round(at.x - a.x * sx),
      y: round(at.y - a.y * scale),
      w: round(spec.w * sx),
      h: round(spec.h * scale),
      rotate: opts.rotate || 0,
      origin: { x: round(at.x), y: round(at.y) },
      z: opts.z || 0,
      role: opts.role || '',
      key: opts.key || spec.id
    };
    if(opts.flipX) layer.flipX = true;
    if(opts.title) layer.title = opts.title;
    if(opts.className) layer.className = opts.className;
    if(opts.hideGroups) layer.hideGroups = opts.hideGroups;
    if(opts.onlyGroups) layer.onlyGroups = opts.onlyGroups;
    if(opts.clip) layer.clip = opts.clip;
    // Draw only what lies inside the silhouette (the `clipSil` clip path) of the named garment sheet.
    if(opts.clipSil) layer.clipSil = opts.clipSil;
    return layer;
  }

  // Layers that share the garment's box (nametag, epaulet sleeves, braid) register at the origin.
  function registerAtOrigin(spec, z, role){
    return { type: 'asset', id: spec.id, x: 0, y: 0, w: spec.w, h: spec.h, rotate: 0, origin: { x: 0, y: 0 }, z: z || 1, role: role || 'garment-layer', key: spec.id };
  }

  // Axis-aligned box of a (possibly rotated) layer, for the scene bounds and for the tests.
  function layerBounds(layer){
    if(layer.type === 'text'){
      return { x: layer.x - layer.w / 2, y: layer.y - layer.h / 2, w: layer.w, h: layer.h };
    }
    const r = (layer.rotate || 0) * Math.PI / 180;
    if(!r) return { x: layer.x, y: layer.y, w: layer.w, h: layer.h };
    const o = layer.origin;
    const corners = [[layer.x, layer.y], [layer.x + layer.w, layer.y], [layer.x, layer.y + layer.h], [layer.x + layer.w, layer.y + layer.h]]
      .map(([px, py]) => {
        const dx = px - o.x, dy = py - o.y;
        return { x: o.x + dx * Math.cos(r) - dy * Math.sin(r), y: o.y + dx * Math.sin(r) + dy * Math.cos(r) };
      });
    return polygonBounds(corners);
  }

  function unionBounds(boxes){
    const valid = boxes.filter(Boolean);
    if(!valid.length) return { x: 0, y: 0, w: 1, h: 1 };
    const x = Math.min(...valid.map(b => b.x)), y = Math.min(...valid.map(b => b.y));
    const x2 = Math.max(...valid.map(b => b.x + b.w)), y2 = Math.max(...valid.map(b => b.y + b.h));
    return { x, y, w: x2 - x, h: y2 - y };
  }

  // Rotate a point about an origin (degrees, screen coordinates: +y is down, so +deg is clockwise).
  function rotatePoint(p, origin, deg){
    const r = deg * Math.PI / 180;
    const dx = p.x - origin.x, dy = p.y - origin.y;
    return { x: origin.x + dx * Math.cos(r) - dy * Math.sin(r), y: origin.y + dx * Math.sin(r) + dy * Math.cos(r) };
  }

  // ---- shoulder cords: fit a garment's cord path to the sheet's landmarks, then round its corners ----
  //
  // A cord overlay draws one braided run as a polyline along the wearer's left armhole seam (its `cord` landmark, sheet inches). The
  // run is fitted to two landmarks of the sheet: its top end goes to where the run's own line meets the shoulder's outline (the top of the
  // shoulder, under the epaulet strap), and its bottom end to the armpit (the highest point between arm and body, or the inner end of a
  // short sleeve's hem). Only the straight run is stretched: the vertices between keep their shape, each moved by the share of the two
  // end shifts its arc length gives it, so the ends land on the landmarks exactly. The corners of the fitted polyline are then rounded
  // with quadratic curves that leave each corner along one segment and arrive along the next, so the cord is one smooth line (the same
  // point and tangent where the straight run meets the curve) instead of a bend.
  // LIVE13 E120 (Ethan, on the women's Class A with the Group cord: "I dont think you understand how cords work. they follow the seam (the line)
  // exactly. They also should be a tad bit thicker."): the braid is 0.5 in across with its outline (the sheets drew 0.40; a shoulder cord's braid
  // is about 3/8 in and "a tad" is a quarter, not double: 0.40 x 1.25 = 0.50, the body 0.36 x 1.25 = 0.45). The renderer scales the sheet's three
  // strokes to it (render-svg: CORD_WIDTH over the sheet's outline stroke) so the width is set here once.
  const CORD_WIDTH = 0.5;
  const CORD_HALF = CORD_WIDTH / 2 + 0.05;  // half the braid plus a margin: how far inside the body's edge the braid's centre line runs under the arm
  const CORD_FADE = 0.8;       // the braid fades out (opacity 1 to 0, no taper) over the last stretch of its run under the arm (LIVE10-4 second version)
  const CORD_INSET = CORD_HALF; // how far inside the body's side edge the braid's centre line runs under the arm, so the whole braid is on cloth
  const CORD_SETTLE = 1.0;     // the braid has settled on that inset line this far (in, along the body's edge) below the armpit
  const CORD_LEAD_IN = 2.0;    // over the last stretch of the run above the armpit the braid's centre drifts toward the body, smoothly, by up to CORD_COVER
  const CORD_COVER = 0.18;     // the most the centre line leaves the seam: the 0.05 in seam line stays wholly under the 0.5 in braid (0.18 + 0.025 < 0.25)
  const CORD_ROUND = 0.25;     // longest stretch of a segment a corner's curve may take (in): a 15 degree bend rounded this far lies 0.03 in off the drawn line
  const CORD_REACH = 3;        // how far along its own line the run is searched for the shoulder outline (in)

  // The point where the line through `p0` along `dir` first meets the open polyline `ring`, within CORD_REACH of p0 either way.
  function lineMeetsRing(p0, dir, ring){
    let best = null;
    for(let i = 0; i < ring.length - 1; i++){
      const a = ring[i], b = ring[i + 1];
      const ex = b[0] - a[0], ey = b[1] - a[1], den = dir[0] * ey - dir[1] * ex;
      if(Math.abs(den) < 1e-9) continue;
      const t = ((a[0] - p0[0]) * ey - (a[1] - p0[1]) * ex) / den, u = ((a[0] - p0[0]) * dir[1] - (a[1] - p0[1]) * dir[0]) / den;
      if(u < 0 || u > 1 || Math.abs(t) > CORD_REACH) continue;
      if(!best || Math.abs(t) < Math.abs(best.t)) best = { t, p: [p0[0] + t * dir[0], p0[1] + t * dir[1]] };
    }
    return best;
  }

  // Rounded polyline: pieces [{ type: 'L', a, b } | { type: 'Q', a, c, b }] and their path data (sheet inches).
  function roundPolyline(pts, reach){
    const n = pts.length, pieces = [];
    let cur = pts[0];
    for(let i = 1; i < n - 1; i++){
      const v = pts[i], a = pts[i - 1], b = pts[i + 1];
      const la = Math.hypot(v[0] - a[0], v[1] - a[1]), lb = Math.hypot(b[0] - v[0], b[1] - v[1]);
      const D = Math.min(reach, 0.45 * la, 0.45 * lb);
      const s = [v[0] + (a[0] - v[0]) * D / la, v[1] + (a[1] - v[1]) * D / la], e = [v[0] + (b[0] - v[0]) * D / lb, v[1] + (b[1] - v[1]) * D / lb];
      if(Math.hypot(s[0] - cur[0], s[1] - cur[1]) > 1e-9) pieces.push({ type: 'L', a: cur, b: s });
      pieces.push({ type: 'Q', a: s, c: v, b: e });
      cur = e;
    }
    pieces.push({ type: 'L', a: cur, b: pts[n - 1] });
    const f = v => String(Math.round(v * 10000) / 10000);
    let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
    for(const p of pieces) d += p.type === 'L' ? `L${f(p.b[0])},${f(p.b[1])}` : `Q${f(p.c[0])},${f(p.c[1])} ${f(p.b[0])},${f(p.b[1])}`;
    return { pieces, d };
  }

  // `points`: the run the braid lies on, in sheet inches ([x, y] pairs, top first): the armhole seam as the sheet draws it (opts.exact) or the cord
  // overlay's own `cord` landmark; `outline`: the garment's upper outline (an open polyline, inches) or null; `armpit`: [x, y] or null; `under`: inches of
  // the body's side edge the braid follows at full width under the arm (0 for none; a fade of CORD_FADE follows); `side`: the silhouette's edge on the
  // body's side of the gap, [x, y] vertices from the armpit down, or null. `opts.exact`: the run is a drawn seam and is followed as drawn, its first
  // segment extended to the outline and its last point kept; without it (a landmark polyline) the top end is put on the outline and the bottom end on
  // the armpit, the vertices between moved by their share of the two end shifts (only the straight run is stretched).
  // Returns { points, pieces, d, top, bottom, under (the run's last point), visible (null), fade, tail, stretch, width }.
  function fitCord(points, outline, armpit, under, side, opts){
    const o = opts || {};
    const orig = points.map(p => [p[0], p[1]]);
    const n = orig.length;
    const lens = [0];
    for(let i = 1; i < n; i++) lens.push(lens[i - 1] + Math.hypot(orig[i][0] - orig[i - 1][0], orig[i][1] - orig[i - 1][1]));
    const total0 = lens[n - 1] || 1;
    let top = orig[0];
    if(outline){
      const d0 = [orig[0][0] - orig[1][0], orig[0][1] - orig[1][1]], l0 = Math.hypot(d0[0], d0[1]) || 1;
      const hit = lineMeetsRing(orig[0], [d0[0] / l0, d0[1] / l0], outline);
      if(hit) top = hit.p;
    }
    let fitted, bottom;
    if(o.exact){
      fitted = orig.map(p => [p[0], p[1]]);
      fitted[0] = top;
      bottom = fitted[n - 1];
    }else{
      bottom = armpit ? [armpit[0], armpit[1]] : orig[n - 1];
      const dTop = [top[0] - orig[0][0], top[1] - orig[0][1]], dBot = [bottom[0] - orig[n - 1][0], bottom[1] - orig[n - 1][1]];
      fitted = orig.map((p, i) => {
        const u = lens[i] / total0;
        return [p[0] + dTop[0] * (1 - u) + dBot[0] * u, p[1] + dTop[1] * (1 - u) + dBot[1] * u];
      });
      fitted[0] = top; fitted[n - 1] = bottom;
    }
    const notch = armpit ? [armpit[0], armpit[1]] : bottom;
    const len = pts => pts.reduce((s, p, i) => s + (i ? Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0);
    // Under the arm. LIVE10-4 (Ethan: "now the cord is cut off lmao. its supposed to be continuous"): the braid is never cut; it goes on past the armpit at
    // full width for `under` inches along the body's side edge (`side`, the silhouette's edge on the body's side of the gap, from the armpit down), inside
    // the cloth with its centre line CORD_INSET from the edge, and then fades out over CORD_FADE (`fade`: the segment its opacity falls along, 1 at `from`
    // and 0 at `to`; the renderer masks the layer with it) as if passing behind the arm: no taper, no clip edge, no separate shape.
    // LIVE13 E120 (Ethan: "they follow the seam (the line) exactly"): the run is the seam. The first version of this turn began half an inch above the
    // armpit and took a half-inch sideways drift out of the eight inches of run above, which is what pulled the braid off the drawn seam. Now the centre
    // line leaves the seam by at most CORD_COVER (0.12 in), over the last CORD_LEAD_IN (2 in) above the seam's end, so the drawn line is under the braid
    // along its whole length (the braid is 0.5 in across); that small lead lets the braid reach the inset line CORD_SETTLE below the armpit with one cubic
    // from the seam's end (leaving along the braid's own direction, arriving along the edge's: the same tangent at both joins, no bend) instead of an
    // elbow at the armpit. The braid's arm-side edge overhangs the gap by at most 0.13 in just below the notch, where the gap is a hairline, the way a
    // cord's far edge slips behind the arm. Without `side` (a sheet with no body edge) the run goes straight on.
    let drawn = fitted, tail = null, fade = null;
    if(under > 0){
      const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
      const add2 = (a, d, k) => [a[0] + d[0] * k, a[1] + d[1] * k];
      const norm2 = v => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
      const cumOf = poly => { const c = [0]; for(let i = 1; i < poly.length; i++) c.push(c[i - 1] + dist(poly[i], poly[i - 1])); return c; };
      const atArc = (poly, cum, sd) => {
        let i = 1;
        while(i < poly.length - 1 && cum[i] < sd) i++;
        const seg = [poly[i][0] - poly[i - 1][0], poly[i][1] - poly[i - 1][1]], l = Math.hypot(seg[0], seg[1]) || 1, d = [seg[0] / l, seg[1] / l];
        return { p: add2(poly[i - 1], d, sd - cum[i - 1]), d };
      };
      const sm = x => { x = Math.max(0, Math.min(1, x)); return x * x * x * (x * (x * 6 - 15) + 10); };
      const seamEnd = fitted[n - 1], u1 = norm2([seamEnd[0] - fitted[n - 2][0], seamEnd[1] - fitted[n - 2][1]]);   // the seam's direction at its end
      const total = under + CORD_FADE;
      let head = fitted, tp;
      if(side && side.length >= 2){
        const S = side.map(p => [p[0], p[1]]);
        S[0] = [notch[0], notch[1]];
        const sCum = cumOf(S), lastSeg = S.length - 1;
        const edgeAt = sd => {
          const q = atArc(S, sCum, Math.min(sd, sCum[lastSeg] + 100));   // past the last vertex the last segment goes on straight
          let nrm = [-q.d[1], q.d[0]];
          if(nrm[0] > 0) nrm = [-nrm[0], -nrm[1]];                      // toward the body's centre line: smaller x
          return { p: q.p, d: q.d, n: nrm };
        };
        // The lead-in: the run's last CORD_LEAD_IN resampled every 0.1 in, each point moved toward the body (the seam's normal with smaller x) by
        // CORD_COVER times a smoothstep of its distance from the end; the vertices above the lead-in are kept as they are.
        const rev = fitted.slice().reverse(), revCum = cumOf(rev), runLen = revCum[revCum.length - 1];
        const lead = Math.min(CORD_LEAD_IN, 0.6 * runLen);
        const kept = [];
        for(let i = 0; i < n; i++) if(revCum[n - 1 - i] > lead + 1e-9) kept.push(fitted[i]);
        const drifted = [];
        for(let a = lead; a > 1e-9; a -= 0.1){
          const q = atArc(rev, revCum, a);
          let nS = [-q.d[1], q.d[0]];                                  // q.d points up the run; the normal toward the body has the smaller x
          if(nS[0] > 0) nS = [-nS[0], -nS[1]];
          drifted.push(add2(q.p, nS, CORD_COVER * sm(1 - a / lead)));
        }
        let nEnd = [-u1[1], u1[0]];
        if(nEnd[0] > 0) nEnd = [-nEnd[0], -nEnd[1]];
        const end0 = add2(seamEnd, nEnd, CORD_COVER);
        head = kept.concat(drifted, [end0]);
        const d0 = norm2([end0[0] - drifted[drifted.length - 1][0], end0[1] - drifted[drifted.length - 1][1]]);
        const eQ = edgeAt(CORD_SETTLE), Q = add2(eQ.p, eQ.n, CORD_INSET);
        const L = dist(end0, Q), k = L / 3, c1 = add2(end0, d0, k), c2 = add2(Q, eQ.d, -k);
        tp = [];
        const steps = Math.max(8, Math.ceil(L / 0.05));
        for(let i = 1; i <= steps; i++){
          const t = i / steps, m = 1 - t;
          tp.push([m * m * m * end0[0] + 3 * m * m * t * c1[0] + 3 * m * t * t * c2[0] + t * t * t * Q[0], m * m * m * end0[1] + 3 * m * m * t * c1[1] + 3 * m * t * t * c2[1] + t * t * t * Q[1]]);
        }
        for(let sd = CORD_SETTLE + 0.1; sd < CORD_SETTLE + total + 0.5; sd += 0.1){ const e = edgeAt(sd); tp.push(add2(e.p, e.n, CORD_INSET)); }
      }else{
        tp = [];
        for(let sd = 0.2; sd < total + 0.7; sd += 0.2) tp.push(add2(seamEnd, u1, sd));
      }
      // The path from the top to `total` beyond the armpit (the point of the path nearest the armpit marks 0), cut there.
      const full = head.concat(tp);
      const fc = cumOf(full);
      let near = 0, nd = Infinity;
      full.forEach((q, i) => { const d = dist(q, notch); if(d < nd){ nd = d; near = i; } });
      const endArc = fc[near] + total;
      const cut = [];
      for(let i = 0; i < full.length; i++){
        if(fc[i] < endArc - 1e-9) cut.push(full[i]);
        else { const f = (endArc - fc[i - 1]) / ((fc[i] - fc[i - 1]) || 1); cut.push([full[i - 1][0] + (full[i][0] - full[i - 1][0]) * f, full[i - 1][1] + (full[i][1] - full[i - 1][1]) * f]); break; }
      }
      drawn = cut;
      const endPt = cut[cut.length - 1];
      const fromArc = endArc - CORD_FADE;
      const fadeFrom = (() => { let i = 1; const cc = cumOf(cut); while(i < cut.length - 1 && cc[i] < fromArc) i++; const f = (fromArc - cc[i - 1]) / ((cc[i] - cc[i - 1]) || 1); return [cut[i - 1][0] + (cut[i][0] - cut[i - 1][0]) * f, cut[i - 1][1] + (cut[i][1] - cut[i - 1][1]) * f]; })();
      fade = { from: fadeFrom, to: endPt, length: CORD_FADE };
      tail = { points: cut.slice(near), end: total, fadeFrom: under, inset: CORD_INSET, settle: CORD_SETTLE, cover: CORD_COVER, leadIn: CORD_LEAD_IN, notchDistance: nd, seam: u1, seamEnd };
    }
    const r = roundPolyline(drawn, CORD_ROUND);
    return { points: fitted, pieces: r.pieces, d: r.d, top, bottom, under: drawn[drawn.length - 1], visible: null, fade, tail, width: CORD_WIDTH, exact: !!o.exact, stretch: { from: len(orig), to: len(fitted), dTop: [top[0] - orig[0][0], top[1] - orig[0][1]], dBottom: [bottom[0] - orig[n - 1][0], bottom[1] - orig[n - 1][1]] } };
  }

  return {
    UNITS_PER_INCH,
    CORD_WIDTH,
    ANCHOR_ALIASES,
    normalizeSpec,
    createSpecStore,
    anchor,
    requireAnchor,
    landmark,
    landmarkBounds,
    rectCenter,
    polygonBounds,
    placeAsset,
    registerAtOrigin,
    layerBounds,
    unionBounds,
    rotatePoint,
    fitCord,
    roundPolyline,
    round
  };
});
