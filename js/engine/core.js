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
      const specPath = e.path.replace(/\.(svg|png)$/, '.spec.json');
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
    // `place`: where a badge is worn, in words (scene.layers[].place), for the page's list of what is on the uniform.
    if(opts.place) layer.place = opts.place;
    if(opts.className) layer.className = opts.className;
    if(opts.hideGroups) layer.hideGroups = opts.hideGroups;
    // `showGroups`: groups a sheet carries hidden by default (display="none" in the file, e.g. the Class B sheets' collar-honor-guard) that this layer draws.
    if(opts.showGroups) layer.showGroups = opts.showGroups;
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
  const CORD_WIDTH = 0.625;
  // LIVE13 (Ethan, 2026-11-12, "for cords overall, make them a little bit thicker"): 0.5 in to 0.625 in, a quarter more again. Every size of the cord's wrap below is a share of it.
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
  // overlay's own `cord` landmark; `outline`: the garment's upper outline (an open polyline, inches) or null; `armpit`: [x, y] or null.
  // `opts.exact`: the run is a drawn seam and is followed as drawn, its first segment extended to the outline and its last point kept; without it (a
  // landmark polyline) the top end is put on the outline and the bottom end on the armpit, the vertices between moved by their share of the two end
  // shifts (only the straight run is stretched).
  // Returns { points, pieces, d, top, bottom, end (the braid's last point: the armpit end of the run), stretch, width, exact }.
  function fitCord(points, outline, armpit, opts){
    const o = opts || {};
    const orig = points.map(p => [p[0], p[1]]);
    const n = orig.length;
    const lens = [0];
    for(let i = 1; i < n; i++) lens.push(lens[i - 1] + Math.hypot(orig[i][0] - orig[i - 1][0], orig[i][1] - orig[i - 1][1]));
    const total0 = lens[n - 1] || 1;
    let top = orig[0];
    if(o.topAt) top = [o.topAt[0], o.topAt[1]];
    else if(outline){
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
    const len = pts => pts.reduce((s, p, i) => s + (i ? Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0);
    // The braid is a closed loop round the sleeve head along the armhole seam; the front shows one arc of it, from under the shoulder board down the
    // drawn seam, and at the armpit the loop passes behind the arm, where the sleeve and the body hide it. Ethan, LIVE13 E122: "they go along the seam.
    // they shouldnt conflict with the ribbons ever ... im not sure why you have them fading out. they go around the seam in a circle, but we cant
    // see that because we are only looking at the front." So the braid ENDS where the seam meets the armpit, squarely (the sheet's strokes have
    // butt caps): no opacity fade, no run along the body's side under the arm, nothing on the chest, so it cannot touch the ribbon rack.
    const drawn = fitted;
    const r = roundPolyline(drawn, CORD_ROUND);
    return { points: fitted, pieces: r.pieces, d: r.d, top, bottom, end: drawn[drawn.length - 1], width: CORD_WIDTH, exact: !!o.exact, stretch: { from: len(orig), to: len(fitted), dTop: [top[0] - orig[0][0], top[1] - orig[0][1]], dBottom: [bottom[0] - orig[n - 1][0], bottom[1] - orig[n - 1][1]] } };
  }

  // The centre line of a fitted cord path as points: its pieces ({ type: 'L', a, b } and { type: 'Q', a, c, b }, as fitCord and roundPolyline make them) walked
  // from the first piece's start, a curve in steps of about `step` inches (at least 4 and at most 48 to a curve), a point where two pieces meet once. This is
  // what CordBraid.draw lays the braid along.
  function samplePath(pieces, step){
    const h = step > 0 ? step : 0.02, out = [];
    const put = p => { const q = out[out.length - 1]; if(!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-9) out.push([p[0], p[1]]); };
    for(const pc of pieces || []){
      put(pc.a);
      if(pc.type === 'Q'){
        const chord = Math.hypot(pc.c[0] - pc.a[0], pc.c[1] - pc.a[1]) + Math.hypot(pc.b[0] - pc.c[0], pc.b[1] - pc.c[1]);
        const n = Math.max(4, Math.min(48, Math.ceil(chord / h)));
        for(let i = 1; i < n; i++){
          const t = i / n, u = 1 - t;
          put([u * u * pc.a[0] + 2 * u * t * pc.c[0] + t * t * pc.b[0], u * u * pc.a[1] + 2 * u * t * pc.c[1] + t * t * pc.b[1]]);
        }
      }
      put(pc.b);
    }
    return out;
  }

  // ---- the shoulder cord's path: out from under the epaulet, down to the armpit ----
  //
  // LIVE13 (Ethan, 2026-11-12, on the cord that "somehow deletes itself" at the sleeve and at the top: "thats not how they work"; "the cord, goes all the way around the inner part of the sleve, under
  // the wearers armpid"; "it should go under the eppaulet flush with the outside edge"; then, on the cord turning in toward the chest at the armpit: "you have them kind of going to the left, which
  // is not realistic"). A cord is a loop round the arm: seen from the front it comes out from under the epaulet, comes straight down to the armpit and is gone. Neither end is a cap lying on cloth.
  //   Top: the cord's sleeve-side edge passes through `edge`, the outer lower corner of the epaulet (the line of the epaulet's outside end edge), and the run goes on up under the epaulet, CORD_UP
  //     further, to be cut by the garment's outline or hidden by the epaulet.
  //   Armpit: the centre line runs to the apex itself (`apex`, the top of the gap between arm and body, or the inner end of a short sleeve's hem), the seam's shape with a sideways offset that goes
  //     linearly with the run's length from the top's to nothing at the apex. Over the last cord width before it the two edges close in on the apex (cordTipCut), so the cord ends in the point of the
  //     armpit and nothing of it is below: the path goes on straight CORD_BEYOND past the apex only so that the braid is whole where the edges close in, and that stretch, with the braid's end cap,
  //     is cut away.
  const CORD_UP = 2;           // how far the run is carried up past where it comes out from under the epaulet (in)
  const CORD_BEYOND = 0.4;     // how far the path goes straight on past the apex, all of it cut away (in): the braid's end cap lies in it
  const CORD_STEP = 0.05;      // distance between the points the path is laid at (in)
  const CORD_TOP_SPAN = 0.8;   // the length of the seam's top whose direction the run takes above it (in)

  // The polyline `pts` as points an equal arc length `step` apart, its ends included.
  function resample(pts, step){
    const out = [[pts[0][0], pts[0][1]]];
    let carry = 0;
    for(let i = 1; i < pts.length; i++){
      const a = pts[i - 1], b = pts[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if(!(l > 1e-12)) continue;
      let t = step - carry;
      while(t <= l + 1e-12){ out.push([a[0] + (b[0] - a[0]) * t / l, a[1] + (b[1] - a[1]) * t / l]); t += step; }
      carry = l - (t - step);
    }
    const last = pts[pts.length - 1], q = out[out.length - 1];
    if(Math.hypot(last[0] - q[0], last[1] - q[1]) > 1e-9) out.push([last[0], last[1]]);
    return out;
  }

  // `seam`: the run the cord follows, top first (sheet inches); opts: { width, edge: [x, y] or null, apex: [x, y], up, beyond }.
  // Returns { points, pieces, d, start, top, bottom, end, offsets, topIndex, bottomIndex, width, apex, edge }: `points` the path's centre line (top first), `top` the point on it at the epaulet's lower
  // corner (the cord's centre line there is half a width inboard of `edge`), `bottom` the apex, where the path's run to the armpit ends (`points[bottomIndex]`), `end` the path's last point, CORD_BEYOND
  // past it, straight on.
  function wrapCord(seam, opts){
    const o = opts || {}, w = o.width > 0 ? o.width : CORD_WIDTH, up = o.up != null ? o.up : CORD_UP, beyond = o.beyond != null ? o.beyond : CORD_BEYOND;
    const A = o.apex, unit = (a, b) => { const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; };
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
    // the seam as a smooth line, carried straight up past the shoulder
    const raw = seam.map(p => [p[0], p[1]]);
    // (up in the direction the seam has over its first CORD_TOP_SPAN, not that of its first segment, which a seam sampled finely or a landmark can leave pointing any way)
    let kk = 1, run0 = 0;
    while(kk < raw.length - 1 && (run0 += Math.hypot(raw[kk][0] - raw[kk - 1][0], raw[kk][1] - raw[kk - 1][1])) < CORD_TOP_SPAN) kk++;
    const up0 = unit(raw[kk], raw[0]);
    raw.unshift([raw[0][0] + up0[0] * up, raw[0][1] + up0[1] * up]);
    const S = resample(samplePath(roundPolyline(raw, CORD_ROUND).pieces, CORD_STEP), CORD_STEP);
    const tangent = i => unit(S[Math.max(0, i - 2)], S[Math.min(S.length - 1, i + 2)]);
    // ended at the level of the apex across the run: trimmed back to it, or carried straight on to it
    const tE = tangent(S.length - 1), along = P => dot([P[0] - A[0], P[1] - A[1]], tE);
    if(along(S[S.length - 1]) < 0){
      const last = S[S.length - 1], d = -along(last);
      for(let t = CORD_STEP; t < d - 1e-9; t += CORD_STEP) S.push([last[0] + tE[0] * t, last[1] + tE[1] * t]);
      S.push([last[0] + tE[0] * d, last[1] + tE[1] * d]);
    }else{
      let m = 1;
      while(m < S.length - 1 && along(S[m]) < 0) m++;
      const a = S[m - 1], b = S[m], da = along(a), db = along(b), k = db === da ? 1 : Math.max(0, Math.min(1, -da / (db - da)));
      S.length = m;
      S.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]);
    }
    const n = S.length, T = S.map((p, i) => tangent(i)), N = T.map(t => [t[1], -t[0]]);     // N: toward the sleeve (the sheet's right, for a cord running down)
    const arc = [0];
    for(let i = 1; i < n; i++) arc.push(arc[i - 1] + Math.hypot(S[i][0] - S[i - 1][0], S[i][1] - S[i - 1][1]));
    // the top: the centre line passes half a width to the body side of the epaulet's outer lower corner, so the braid's sleeve-side edge is on the corner (the seam point whose normal runs through
    // the corner, found by taking the local normal at each guess)
    let jTop = 0, oTop = 0, sTopAlong = 0;
    if(o.edge){
      const nearest = q => { let best = 0, bd = Infinity; for(let i = 0; i < n; i++){ const d = Math.hypot(S[i][0] - q[0], S[i][1] - q[1]); if(d < bd){ bd = d; best = i; } } return best; };
      let j = nearest(o.edge);
      for(let it = 0; it < 4; it++) j = nearest([o.edge[0] - N[j][0] * w / 2, o.edge[1] - N[j][1] * w / 2]);
      jTop = j;
      oTop = dot([o.edge[0] - S[j][0], o.edge[1] - S[j][1]], N[j]) - w / 2;
      sTopAlong = dot([o.edge[0] - S[j][0], o.edge[1] - S[j][1]], T[j]);   // the corner's place along the run from that sample, so the top lies exactly level with it
    }
    // the centre line ends on the apex: the offset goes from the top's to the one that puts the last point there
    const oEnd = dot([A[0] - S[n - 1][0], A[1] - S[n - 1][1]], N[n - 1]);
    const C = S.map((p, i) => {
      const k = i <= jTop || arc[n - 1] === arc[jTop] ? 0 : (arc[i] - arc[jTop]) / (arc[n - 1] - arc[jTop]), off = oTop + (oEnd - oTop) * k;
      return [p[0] + N[i][0] * off, p[1] + N[i][1] * off];
    });
    // straight on past the apex, in the direction the path has there (all of it cut away)
    const tau = unit(C[Math.max(0, n - 3)], C[n - 1]), path = C.map(p => [p[0], p[1]]), from = C[n - 1];
    for(let t = CORD_STEP; t < beyond - 1e-9; t += CORD_STEP) path.push([from[0] + tau[0] * t, from[1] + tau[1] * t]);
    if(beyond > 0) path.push([from[0] + tau[0] * beyond, from[1] + tau[1] * beyond]);
    const pieces = [];
    for(let i = 1; i < path.length; i++) if(Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]) > 1e-9) pieces.push({ type: 'L', a: path[i - 1], b: path[i] });
    const f = v => String(Math.round(v * 10000) / 10000);
    let d = `M${f(pieces[0].a[0])},${f(pieces[0].a[1])}`;
    for(const p of pieces) d += `L${f(p.b[0])},${f(p.b[1])}`;
    const cT = unit(C[Math.max(0, jTop - 1)], C[Math.min(n - 1, jTop + 1)]), top = [C[jTop][0] + cT[0] * sTopAlong, C[jTop][1] + cT[1] * sTopAlong];
    return { points: path, pieces, d, start: path[0], top, bottom: C[n - 1], end: path[path.length - 1], width: w, heading: tau,
      bottomIndex: n - 1, topIndex: jTop, offsets: { top: oTop, bottom: oEnd }, apex: [A[0], A[1]], edge: o.edge ? [o.edge[0], o.edge[1]] : null };
  }

  // The part of the cord that is cut away at the armpit, as one polygon in the cord's own frame placed on the path: everything from one cord width before the apex on, outside the triangle whose base is
  // the cord's width across at that place and whose point is the apex; so the cord's two edges close in on the apex and nothing of it lies beyond.
  // `at`: the apex [x, y]; `heading`: the unit direction the path has there; scene inches, as points { x, y }.
  function cordTipCut(at, heading, width){
    const t = heading, n = [t[1], -t[0]], h = width / 2, B = 10;
    const conv = (s, u) => ({ x: at[0] + t[0] * s + n[0] * u, y: at[1] + t[1] * s + n[1] * u });
    return [conv(-width, -B), conv(-width, -h), conv(0, 0), conv(-width, h), conv(-width, B), conv(B, B), conv(B, -B)];
  }

  return {
    UNITS_PER_INCH,
    CORD_WIDTH,
    CORD_UP, CORD_BEYOND,
    wrapCord,
    cordTipCut,
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
    samplePath,
    round
  };
});
