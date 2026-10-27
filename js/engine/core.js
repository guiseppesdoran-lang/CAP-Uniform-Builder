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
  const CORD_HALF = 0.25;      // half the width of the braid under the arm (the braid is 0.4 in with its outline)
  const CORD_FADE = 0.8;       // the braid fades out (opacity 1 to 0, no taper) over the last stretch of its run under the arm (LIVE10-4 second version)
  const CORD_INSET = CORD_HALF; // how far inside the body's side edge the braid's centre line runs under the arm: half the braid's width, so the whole braid is on cloth
  const CORD_TURN_FROM = -0.5, CORD_TURN_TO = 1.4;  // the braid turns from the seam's direction to the edge's between these distances (in) from the armpit, along the braid
  const CORD_LEAD = 3.0;       // the braid's own line is followed this far above the armpit before the turn's drift starts
  const CORD_DRIFT = 5.0;      // and the sideways drift the turn needs is taken up over this much more of the run above that, so it cannot be seen
  const CORD_ROUND = 1.0;      // longest stretch of a segment a corner's curve may take (in)
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

  // `points`: the sheet's cord landmark in inches ([x, y] pairs, top first); `outline`: the garment's upper outline (an open polyline, inches) or
  // null; `armpit`: [x, y] or null; `under`: inches of the body's side edge the braid follows at full width under the arm (0 for none; a fade of CORD_FADE follows); `side`: the silhouette's edge on the body's side of the gap, [x, y] vertices from the armpit down, or null.
  // Returns { points, pieces, d, top, bottom, under (the run's last point), visible (polygon or null), tail, stretch }.
  function fitCord(points, outline, armpit, under, side){
    const orig = points.map(p => [p[0], p[1]]);
    const n = orig.length;
    const lens = [0];
    for(let i = 1; i < n; i++) lens.push(lens[i - 1] + Math.hypot(orig[i][0] - orig[i - 1][0], orig[i][1] - orig[i - 1][1]));
    const total = lens[n - 1] || 1;
    let top = orig[0];
    if(outline){
      const d0 = [orig[0][0] - orig[1][0], orig[0][1] - orig[1][1]], l0 = Math.hypot(d0[0], d0[1]) || 1;
      const hit = lineMeetsRing(orig[0], [d0[0] / l0, d0[1] / l0], outline);
      if(hit) top = hit.p;
    }
    const bottom = armpit ? [armpit[0], armpit[1]] : orig[n - 1];
    const dTop = [top[0] - orig[0][0], top[1] - orig[0][1]], dBot = [bottom[0] - orig[n - 1][0], bottom[1] - orig[n - 1][1]];
    const fitted = orig.map((p, i) => {
      const u = lens[i] / total;
      return [p[0] + dTop[0] * (1 - u) + dBot[0] * u, p[1] + dTop[1] * (1 - u) + dBot[1] * u];
    });
    fitted[0] = top; fitted[n - 1] = bottom;
    const len = pts => pts.reduce((s, p, i) => s + (i ? Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0);
    // Under the arm. LIVE10-4 (Ethan: "now the cord is cut off lmao. its supposed to be continuous"): the braid is never cut. Second version (the first curled onto the
    // chest and narrowed to a point): the braid keeps the armhole seam's line down to the armpit and goes on past it at full width for `under` inches, along the body's
    // side edge (`side`, the silhouette's edge on the body's side of the gap, its vertices from the armpit down), inside the cloth, the centre line CORD_INSET (half the braid's
    // width) from the edge once it has settled; it turns from the seam's direction to the edge's gradually, CORD_TURN_FROM to CORD_TURN_TO from the armpit, so its direction at the
    // armpit is a few degrees off the seam's, and the sideways drift the turn needs is taken up over the CORD_DRIFT of the run above CORD_LEAD, where it cannot be seen. Past
    // `under` the braid fades out over CORD_FADE (`fade`: the segment its opacity falls along, 1 at `from` and 0 at `to`; the renderer masks the layer with it) as if passing
    // behind the arm: no taper, no clip edge, no separate shape. Without `side` (a sheet with no body edge) the run goes straight on.
    let drawn = fitted, tail = null, fade = null;
    if(under > 0){
      const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
      const add2 = (a, d, k) => [a[0] + d[0] * k, a[1] + d[1] * k];
      const norm2 = v => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
      const sm = x => { x = Math.max(0, Math.min(1, x)); return x * x * x * (x * (x * 6 - 15) + 10); };
      // arc positions along a polyline
      const cumOf = poly => { const c = [0]; for(let i = 1; i < poly.length; i++) c.push(c[i - 1] + dist(poly[i], poly[i - 1])); return c; };
      const atArc = (poly, cum, sd) => {
        let i = 1;
        while(i < poly.length - 1 && cum[i] < sd) i++;
        const seg = [poly[i][0] - poly[i - 1][0], poly[i][1] - poly[i - 1][1]], len = Math.hypot(seg[0], seg[1]) || 1, d = [seg[0] / len, seg[1] / len];
        return { p: add2(poly[i - 1], d, sd - cum[i - 1]), d };
      };
      const rev = fitted.slice().reverse(), revCum = cumOf(rev);       // the run from the armpit up
      const runLen = revCum[revCum.length - 1];
      const lead = Math.min(CORD_LEAD, 0.45 * runLen), drift = Math.min(CORD_DRIFT, Math.max(0, runLen - lead - 0.3));
      const seamP = atArc(rev, revCum, Math.min(1, runLen)).p, u1 = norm2([bottom[0] - seamP[0], bottom[1] - seamP[1]]);
      const total = under + CORD_FADE;
      let tp = null;     // the braid's centre line from `lead` above the armpit to its end, plus what replaces the run above it
      let head = [];     // the run's own points above lead + drift that are kept, top first
      const turn0 = Math.atan2(u1[0], u1[1]);
      if(side && side.length >= 2){
        const S = side.map(p => [p[0], p[1]]);
        S[0] = [bottom[0], bottom[1]];
        const sCum = cumOf(S);
        const lastSeg = S.length - 1;
        const edgeAt = sd => {
          const q = atArc(S, sCum, Math.min(sd, sCum[lastSeg] + 100));   // past the last vertex the last segment goes on straight
          let nrm = [-q.d[1], q.d[0]];
          if(nrm[0] > 0) nrm = [-nrm[0], -nrm[1]];                      // toward the body's centre line: smaller x
          return { p: q.p, d: q.d, n: nrm };
        };
        const e1 = edgeAt(1), turn1 = Math.atan2(norm2([e1.p[0] - bottom[0], e1.p[1] - bottom[1]])[0], norm2([e1.p[0] - bottom[0], e1.p[1] - bottom[1]])[1]);
        const theta = sd => turn0 + (turn1 - turn0) * sm((sd - CORD_TURN_FROM) / (CORD_TURN_TO - CORD_TURN_FROM));
        // The braid's end of the turn lies on the line CORD_INSET inside the edge; the line is walked back from there along the turning direction to `lead` above the armpit.
        const eQ = edgeAt(CORD_TURN_TO), Q = add2(eQ.p, eQ.n, CORD_INSET);
        const STEP = 0.05;
        const back = [{ s: CORD_TURN_TO, p: Q }];
        let cur = Q;
        for(let sd = CORD_TURN_TO; sd > -lead + 1e-9; sd -= STEP){ const d = [Math.sin(theta(sd)), Math.cos(theta(sd))]; cur = add2(cur, d, -STEP); back.push({ s: sd - STEP, p: cur }); }
        back.reverse();
        // The sideways offset of the turn's start from the seam's line, taken up over the run above (invisible drift).
        const seamStart = add2(bottom, u1, -lead), nSeam = [-u1[1], u1[0]];
        const nS = nSeam[0] > 0 ? [-nSeam[0], -nSeam[1]] : nSeam;       // toward the body (smaller x)
        const off = (back[0].p[0] - seamStart[0]) * nS[0] + (back[0].p[1] - seamStart[1]) * nS[1];
        const up = [];
        for(let a = lead + drift; a > lead + 1e-9; a -= 0.25){
          const q = atArc(rev, revCum, a).p, w = 1 - sm((a - lead) / (drift || 1));
          up.push(add2(q, nS, off * w));
        }
        const keepFrom = lead + drift;
        for(let i = fitted.length - 1; i >= 0; i--) if(revCum[fitted.length - 1 - i] > keepFrom + 1e-9) head.unshift(fitted[i]);
        tp = up.concat(back.filter((q, i) => i % 2 === 0 || i === back.length - 1).map(q => q.p));
        // Past the turn the braid follows the line CORD_INSET inside the edge. Every 0.1 in to `total` beyond the armpit.
        for(let sd = CORD_TURN_TO + 0.1; sd < total + 0.2; sd += 0.1){ const e = edgeAt(sd); tp.push(add2(e.p, e.n, CORD_INSET)); }
      }else{
        head = fitted.slice(0, -1);
        tp = [bottom];
        for(let sd = 0.2; sd < total + 0.2; sd += 0.2) tp.push(add2(bottom, u1, sd));
      }
      // The path from the top to `total` beyond the armpit (the point of the path nearest the armpit marks 0), cut there.
      const full = head.concat(tp);
      const fc = cumOf(full);
      let near = 0, nd = Infinity;
      full.forEach((q, i) => { const d = dist(q, bottom); if(d < nd){ nd = d; near = i; } });
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
      tail = { points: cut.slice(near), end: total, fadeFrom: under, inset: CORD_INSET, notchDistance: nd, seam: u1 };
    }
    const r = roundPolyline(drawn, CORD_ROUND);
    return { points: fitted, pieces: r.pieces, d: r.d, top, bottom, under: drawn[drawn.length - 1], visible: null, fade, tail, stretch: { from: len(orig), to: len(fitted), dTop, dBottom: dBot } };
  }

  return {
    UNITS_PER_INCH,
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
