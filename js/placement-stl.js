// Placement aligner geometry and a binary STL writer (LIVE13 E64), with no library.
//
// An aligner is a thin flat plate (2 mm) drawn as a 2D outline and stood up: the plate from z = 0 (the face on the garment) to
// z = thickness, with the label letters raised on its top face by 0.6 mm. It has no holes for pins and no lips: it is made of bars
// (legs, shelves, posts) that touch a garment edge with their straight ends and hold the items in open cradles, so nothing on it has
// to fit a printed hole. Every planar face is a polygon with holes, triangulated by ear clipping after joining each hole to the outer
// ring with a bridge (no extra points), so each face's boundary is exactly the loop its walls use and the mesh is closed: every edge
// belongs to two triangles, once in each direction.
//
// The outline is the union of rectangles, minus the cuts (the garment edge it is clipped on, the centre notches): boolean2d does that
// exactly by cutting every edge at every crossing and keeping the pieces that have the shape on one side only. The letters are a stroke
// font of the same kind (a stroke is a rectangle), so the letters, too, are loops that boolean2d returns.
//
// Units are millimetres, x right, y up, z out of the garment. Loads as a classic script (window.CAPUBPlacementSTL) and as a CommonJS
// module for the node tests.
(function(root, factory){
  const api = factory();
  if(typeof module === 'object' && module.exports) module.exports = api;
  else root.CAPUBPlacementSTL = api;
})(typeof self !== 'undefined' ? self : this, function(){
  'use strict';

  const EPS = 1e-9;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const same = (a, b) => Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;

  function signedArea(ring){
    let a = 0;
    for(let i = 0; i < ring.length; i++){ const p = ring[i], q = ring[(i + 1) % ring.length]; a += p[0] * q[1] - q[0] * p[1]; }
    return a / 2;
  }
  const ccw = ring => signedArea(ring) > 0 ? ring.slice() : ring.slice().reverse();
  const cw = ring => signedArea(ring) < 0 ? ring.slice() : ring.slice().reverse();

  // Proper or touching intersection of segments ab and cd, ignoring contact at shared endpoints.
  function segmentsHit(a, b, c, d){
    const d1 = cross(c, d, a), d2 = cross(c, d, b), d3 = cross(a, b, c), d4 = cross(a, b, d);
    if(((d1 > EPS && d2 < -EPS) || (d1 < -EPS && d2 > EPS)) && ((d3 > EPS && d4 < -EPS) || (d3 < -EPS && d4 > EPS))) return true;
    const on = (p, q, r) => Math.min(p[0], q[0]) - EPS <= r[0] && r[0] <= Math.max(p[0], q[0]) + EPS && Math.min(p[1], q[1]) - EPS <= r[1] && r[1] <= Math.max(p[1], q[1]) + EPS;
    if(Math.abs(d1) <= EPS && on(c, d, a) && !same(a, c) && !same(a, d)) return true;
    if(Math.abs(d2) <= EPS && on(c, d, b) && !same(b, c) && !same(b, d)) return true;
    if(Math.abs(d3) <= EPS && on(a, b, c) && !same(c, a) && !same(c, b)) return true;
    if(Math.abs(d4) <= EPS && on(a, b, d) && !same(d, a) && !same(d, b)) return true;
    return false;
  }

  function pointInRing(p, ring){
    let inside = false;
    for(let i = 0, j = ring.length - 1; i < ring.length; j = i++){
      const a = ring[i], b = ring[j];
      if((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
  }

  // Is the direction from ring[i] to m inside the polygon's corner at ring[i]? (ring counter-clockwise)
  function locallyInside(ring, i, m){
    const n = ring.length, a = ring[(i - 1 + n) % n], v = ring[i], b = ring[(i + 1) % n];
    if(cross(a, v, b) >= 0) return cross(a, v, m) > EPS && cross(v, b, m) > EPS;
    return cross(a, v, m) > EPS || cross(v, b, m) > EPS;
  }

  // Join the holes (clockwise) to the outer ring (counter-clockwise) with bridges, rightmost hole first.
  function bridgeHoles(outer, holes){
    let ring = ccw(outer);
    const rest = holes.map(cw).sort((h1, h2) => Math.max(...h2.map(p => p[0])) - Math.max(...h1.map(p => p[0])));
    while(rest.length){
      const hole = rest.shift();
      let mi = 0;
      hole.forEach((p, i) => { if(p[0] > hole[mi][0] + EPS || (Math.abs(p[0] - hole[mi][0]) <= EPS && p[1] < hole[mi][1])) mi = i; });
      const m = hole[mi];
      const order = ring.map((p, i) => i).sort((i, j) => Math.hypot(ring[i][0] - m[0], ring[i][1] - m[1]) - Math.hypot(ring[j][0] - m[0], ring[j][1] - m[1]));
      let pick = -1;
      for(const i of order){
        const v = ring[i];
        if(!locallyInside(ring, i, m)) continue;
        let blocked = false;
        const rings = [ring, hole, ...rest];
        for(const r of rings){
          for(let k = 0; k < r.length && !blocked; k++){
            const a = r[k], b = r[(k + 1) % r.length];
            if(same(a, v) || same(b, v) || same(a, m) || same(b, m)) continue;
            if(segmentsHit(m, v, a, b)) blocked = true;
          }
          if(blocked) break;
        }
        if(blocked) continue;
        // The bridge must leave m into the material, not into the hole.
        const t = [m[0] + (v[0] - m[0]) * 1e-4, m[1] + (v[1] - m[1]) * 1e-4];
        if(pointInRing(t, hole)) continue;
        pick = i; break;
      }
      if(pick < 0) throw new Error('triangulate: no bridge found for a hole');
      const loop = [];
      for(let k = 0; k <= hole.length; k++) loop.push(hole[(mi + k) % hole.length]);
      ring = [...ring.slice(0, pick + 1), ...loop, ring[pick], ...ring.slice(pick + 1)];
    }
    return ring;
  }

  function strictlyInside(p, a, b, c){
    return cross(a, b, p) > EPS && cross(b, c, p) > EPS && cross(c, a, p) > EPS;
  }
  function onOpenSegment(p, a, b){
    if(Math.abs(cross(a, b, p)) > 1e-7) return false;
    const t = ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / ((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2);
    return t > 1e-9 && t < 1 - 1e-9;
  }

  // Ear clipping of a (bridged) counter-clockwise ring on a linked list, walking on from each clipped ear. Returns triangles as
  // point triples, counter-clockwise.
  function earClip(ring){
    const n = ring.length;
    if(n < 3) return [];
    const prev = new Array(n), next = new Array(n);
    for(let i = 0; i < n; i++){ prev[i] = (i + n - 1) % n; next[i] = (i + 1) % n; }
    const tris = [];
    const isEar = (ia, ib, ic) => {
      const a = ring[ia], b = ring[ib], c = ring[ic];
      if(cross(a, b, c) <= EPS) return false;
      const x0 = Math.min(a[0], b[0], c[0]) - 1e-7, x1 = Math.max(a[0], b[0], c[0]) + 1e-7;
      const y0 = Math.min(a[1], b[1], c[1]) - 1e-7, y1 = Math.max(a[1], b[1], c[1]) + 1e-7;
      for(let j = next[ic]; j !== ia; j = next[j]){
        const p = ring[j];
        if(p[0] < x0 || p[0] > x1 || p[1] < y0 || p[1] > y1) continue;
        if(same(p, a) || same(p, b) || same(p, c)) continue;
        if(strictlyInside(p, a, b, c) || onOpenSegment(p, a, c)) return false;
      }
      return true;
    };
    let left = n, cur = 0, stuck = 0, guard = 0;
    while(left > 3){
      if(++guard > 60 * n + 1000) throw new Error('triangulate: did not converge');
      const ia = prev[cur], ic = next[cur];
      if(isEar(ia, cur, ic)){
        tris.push([ring[ia], ring[cur], ring[ic]]);
        next[ia] = ic; prev[ic] = ia; left--; cur = ia; stuck = 0;
        continue;
      }
      cur = next[cur];
      if(++stuck > left){
        // A bridge seam can leave a spike (a vertex whose neighbours are one point): drop it; anything else is a bug in the input.
        let k = cur, found = -1;
        for(let s = 0; s < left; s++, k = next[k]) if(same(ring[prev[k]], ring[next[k]])){ found = k; break; }
        if(found < 0) throw new Error('triangulate: no ear found');
        const pa = prev[found], pc = next[found];
        next[pa] = pc; prev[pc] = pa; left--; cur = pa; stuck = 0;
      }
    }
    if(left === 3 && cross(ring[cur], ring[next[cur]], ring[next[next[cur]]]) > EPS) tris.push([ring[cur], ring[next[cur]], ring[next[next[cur]]]]);
    return tris;
  }

  function triangulate(outer, holes){ return earClip(bridgeHoles(outer, holes || [])); }

  const bbox = ring => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for(const p of ring){ if(p[0] < x0) x0 = p[0]; if(p[0] > x1) x1 = p[0]; if(p[1] < y0) y0 = p[1]; if(p[1] > y1) y1 = p[1]; } return { x0, y0, x1, y1 }; };

  // Drop points that lie on the straight line between their neighbours (they would leave T-junctions) and repeated points.
  function simplify(ring, tol){
    const t = tol === undefined ? 1e-9 : tol;
    let r = ring.filter((p, i) => !same(p, ring[(i + 1) % ring.length]));
    let changed = true;
    while(changed && r.length > 3){
      changed = false;
      for(let i = 0; i < r.length; i++){
        const a = r[(i - 1 + r.length) % r.length], b = r[i], c = r[(i + 1) % r.length];
        const len = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1;
        const between = (b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1]) > 0;
        if(Math.abs(cross(a, b, c)) / len <= t && between){ r.splice(i, 1); changed = true; break; }
      }
    }
    return r;
  }

  // ---- 2D boolean: (union of adds) minus (union of cuts) ------------------------------------------------
  //
  // Every polygon edge is cut where it meets any other edge (a crossing, a corner on it, or a stretch it shares), the pieces are
  // kept when exactly one side of them is inside the result, directed so the result is on their left, and chained into loops: outer
  // loops counter-clockwise, holes clockwise. Coordinates are snapped to 0.1 micron and points within 1.5 micron are one point.

  const SNAP = 1e4, MERGE = 1.5e-3, PROBE = 5e-3;

  function boolean2d(adds, cuts){
    const cells = new Map();
    const reg = p => {
      const x = Math.round(p[0] * SNAP) / SNAP, y = Math.round(p[1] * SNAP) / SNAP;
      const cx = Math.round(x / 3e-3), cy = Math.round(y / 3e-3);
      for(let i = -1; i <= 1; i++) for(let j = -1; j <= 1; j++){
        const list = cells.get((cx + i) + ',' + (cy + j));
        if(list) for(const q of list) if(Math.abs(q[0] - x) <= MERGE && Math.abs(q[1] - y) <= MERGE) return q;
      }
      const q = [x, y], k = cx + ',' + cy;
      if(!cells.has(k)) cells.set(k, []);
      cells.get(k).push(q);
      return q;
    };
    const polys = [];
    const prep = (ring, add) => {
      let r = ring.map(reg).filter((p, i, a) => p !== a[(i + 1) % a.length]);
      if(r.length < 3 || Math.abs(signedArea(r)) < 1e-9) return;
      r = ccw(r);
      polys.push({ ring: r, add, box: bbox(r) });
    };
    adds.forEach(r => prep(r, true));
    cuts.forEach(r => prep(r, false));
    const edges = [];
    for(const P of polys) P.ring.forEach((a, i) => edges.push({ a, b: P.ring[(i + 1) % P.ring.length], pts: [] }));
    const give = (e, p) => { if(p !== e.a && p !== e.b && !e.pts.includes(p)) e.pts.push(p); };
    for(let i = 0; i < edges.length; i++){
      const e = edges[i];
      const ex0 = Math.min(e.a[0], e.b[0]), ex1 = Math.max(e.a[0], e.b[0]), ey0 = Math.min(e.a[1], e.b[1]), ey1 = Math.max(e.a[1], e.b[1]);
      const rx = e.b[0] - e.a[0], ry = e.b[1] - e.a[1], le = Math.hypot(rx, ry);
      for(let j = i + 1; j < edges.length; j++){
        const f = edges[j];
        if(ex1 < Math.min(f.a[0], f.b[0]) - 2e-3 || ex0 > Math.max(f.a[0], f.b[0]) + 2e-3 || ey1 < Math.min(f.a[1], f.b[1]) - 2e-3 || ey0 > Math.max(f.a[1], f.b[1]) + 2e-3) continue;
        const sx = f.b[0] - f.a[0], sy = f.b[1] - f.a[1], lf = Math.hypot(sx, sy);
        const den = rx * sy - ry * sx, qx = f.a[0] - e.a[0], qy = f.a[1] - e.a[1];
        if(Math.abs(den) > 1e-9 * le * lf){
          const t = (qx * sy - qy * sx) / den, u = (qx * ry - qy * rx) / den, te = 2e-3 / le, tf = 2e-3 / lf;
          if(t >= -te && t <= 1 + te && u >= -tf && u <= 1 + tf){
            const p = reg([e.a[0] + t * rx, e.a[1] + t * ry]);
            give(e, p); give(f, p);
          }
        } else if(Math.abs(qx * ry - qy * rx) / le < 1e-3){
          const within = (g, p) => { const L = Math.hypot(g.b[0] - g.a[0], g.b[1] - g.a[1]); const t = ((p[0] - g.a[0]) * (g.b[0] - g.a[0]) + (p[1] - g.a[1]) * (g.b[1] - g.a[1])) / (L * L); return t > 0 && t < 1; };
          for(const p of [f.a, f.b]) if(within(e, p)) give(e, p);
          for(const p of [e.a, e.b]) if(within(f, p)) give(f, p);
        }
      }
    }
    const inPoly = (p, P) => p[0] >= P.box.x0 && p[0] <= P.box.x1 && p[1] >= P.box.y0 && p[1] <= P.box.y1 && pointInRing(p, P.ring);
    const addPolys = polys.filter(P => P.add), cutPolys = polys.filter(P => !P.add);
    const inResult = p => addPolys.some(P => inPoly(p, P)) && !cutPolys.some(P => inPoly(p, P));
    const ids = new Map(), pts = [];
    const id = p => { if(!ids.has(p)){ ids.set(p, pts.length); pts.push(p); } return ids.get(p); };
    const kept = new Map();
    for(const e of edges){
      const chain = [e.a, ...e.pts.sort((p, q) => ((p[0] - e.a[0]) ** 2 + (p[1] - e.a[1]) ** 2) - ((q[0] - e.a[0]) ** 2 + (q[1] - e.a[1]) ** 2)), e.b];
      for(let k = 0; k + 1 < chain.length; k++){
        const p = chain[k], q = chain[k + 1];
        if(p === q) continue;
        const L = Math.hypot(q[0] - p[0], q[1] - p[1]), nx = -(q[1] - p[1]) / L, ny = (q[0] - p[0]) / L;
        const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
        const left = inResult([mx + nx * PROBE, my + ny * PROBE]), right = inResult([mx - nx * PROBE, my - ny * PROBE]);
        if(left === right) continue;
        const [s, t] = left ? [p, q] : [q, p];
        kept.set(id(s) + '>' + id(t), [id(s), id(t)]);
      }
    }
    const out = new Map();
    for(const [k, [s, t]] of kept){ if(!out.has(s)) out.set(s, []); out.get(s).push({ k, t }); }
    const used = new Set(), loops = [];
    for(const [k0, [s0]] of kept){
      if(used.has(k0)) continue;
      const loop = [];
      let k = k0, s = s0, guard = 0;
      while(!used.has(k)){
        if(++guard > kept.size + 5) throw new Error('boolean2d: loop did not close');
        used.add(k);
        loop.push(pts[s]);
        const nexts = out.get(kept.get(k)[1]);
        if(!nexts) throw new Error('boolean2d: open boundary');
        const free = nexts.filter(x => !used.has(x.k));
        if(nexts.length > 1 && free.length > 1) throw new Error('boolean2d: two loops touch at a point');
        const nx = free[0] || nexts.find(x => x.k === k0);
        if(!nx) break;
        s = kept.get(k)[1]; k = nx.k;
        if(k === k0) break;
      }
      if(loop.length >= 3) loops.push(loop);
    }
    const result = loops.map(l => simplify(l, 2e-3)).filter(l => l.length >= 3);
    // A shape that touches itself (a corner on another edge) cannot be a closed solid: say so here, not as an open mesh later.
    const segs = result.flatMap(l => l.map((a, i) => [a, l[(i + 1) % l.length]]));
    for(const l of result) for(const v of l) for(const [a, b] of segs){
      if(v === a || v === b || same(v, a) || same(v, b)) continue;
      if(distToSegment(v, a, b) < 5e-3) throw new Error('boolean2d: the outline touches itself');
    }
    return result;
  }
  function distToSegment(p, a, b){
    const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
    return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
  }

  // The loops of a region as { outer, holes }: each clockwise loop belongs to the smallest counter-clockwise loop that contains it.
  function regionsOf(loops){
    const outers = loops.filter(l => signedArea(l) > 0).map(l => ({ outer: l, holes: [], area: signedArea(l) }));
    for(const h of loops.filter(l => signedArea(l) < 0)){
      const owner = outers.filter(o => pointInRing(h[0], o.outer)).sort((a, b) => a.area - b.area)[0];
      if(!owner) throw new Error('regionsOf: a hole outside every outline');
      owner.holes.push(h);
    }
    return outers.map(({ outer, holes }) => ({ outer, holes }));
  }

  // A rectangle as a ring.
  const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

  // ---- the letters: a stroke font ------------------------------------------------------------------------
  //
  // Capitals and digits five strokes tall: a glyph is polylines on a grid of cell units (x 0..w, y 0..4, y up) and each polyline is
  // drawn one unit thick, so with a 1.2 mm unit the letters are 6 mm tall with 1.2 mm strokes and 1.2 mm between letters.

  const FONT = (() => {
    const g = (w, ...strokes) => ({ w, strokes });
    const O = [[1, 4], [0, 3], [0, 1], [1, 0], [2, 1], [2, 3], [1, 4]];
    return {
      A: g(2, [[0, 0], [0, 3], [1, 4], [2, 3], [2, 0]], [[0, 2], [2, 2]]),
      B: g(2, [[0, 0], [0, 4], [1, 4], [2, 3], [1, 2], [2, 1], [1, 0], [0, 0]], [[0, 2], [1, 2]]),
      C: g(2, [[2, 3], [1, 4], [0, 3], [0, 1], [1, 0], [2, 1]]),
      D: g(2, [[0, 0], [0, 4], [1, 4], [2, 3], [2, 1], [1, 0], [0, 0]]),
      E: g(2, [[2, 4], [0, 4], [0, 0], [2, 0]], [[0, 2], [2, 2]]),
      F: g(2, [[2, 4], [0, 4], [0, 0]], [[0, 2], [2, 2]]),
      G: g(2, [[2, 3], [1, 4], [0, 3], [0, 1], [1, 0], [2, 1], [2, 2], [1.5, 2]]),
      H: g(2, [[0, 0], [0, 4]], [[2, 0], [2, 4]], [[0, 2], [2, 2]]),
      I: g(2, [[0, 4], [2, 4]], [[1, 4], [1, 0]], [[0, 0], [2, 0]]),
      J: g(2, [[2, 4], [2, 1], [1, 0], [0, 1]]),
      K: g(2, [[0, 0], [0, 4]], [[2, 4], [0, 2], [2, 0]]),
      L: g(2, [[0, 4], [0, 0], [2, 0]]),
      M: g(4, [[0, 0], [0, 4], [2, 2], [4, 4], [4, 0]]),
      N: g(2, [[0, 0], [0, 4], [2, 0], [2, 4]]),
      O: g(2, O),
      P: g(2, [[0, 0], [0, 4], [1, 4], [2, 3], [1, 2], [0, 2]]),
      Q: g(2, O, [[1, 1], [2, 0]]),
      R: g(2, [[0, 0], [0, 4], [1, 4], [2, 3], [1, 2], [0, 2]], [[1, 2], [2, 0]]),
      S: g(2, [[2, 3], [1, 4], [0, 3], [1, 2], [2, 1], [1, 0], [0, 1]]),
      T: g(2, [[0, 4], [2, 4]], [[1, 4], [1, 0]]),
      U: g(2, [[0, 4], [0, 1], [1, 0], [2, 1], [2, 4]]),
      V: g(2, [[0, 4], [1, 0], [2, 4]]),
      W: g(4, [[0, 4], [1, 0], [2, 2], [3, 0], [4, 4]]),
      X: g(2, [[0, 4], [2, 0]], [[0, 0], [2, 4]]),
      Y: g(2, [[0, 4], [1, 2], [2, 4]], [[1, 2], [1, 0]]),
      Z: g(2, [[0, 4], [2, 4], [0, 0], [2, 0]]),
      '0': g(2, O),
      '1': g(2, [[0, 3], [1, 4], [1, 0]], [[0, 0], [2, 0]]),
      '2': g(2, [[0, 3], [1, 4], [2, 3], [0, 0], [2, 0]]),
      '3': g(2, [[0, 4], [2, 4], [1, 2], [2, 1], [1, 0], [0, 1]]),
      '4': g(2, [[2, 0], [2, 4], [0, 1], [2, 1]]),
      '5': g(2, [[2, 4], [0, 4], [0, 2], [1, 2], [2, 1], [1, 0], [0, 1]]),
      '6': g(2, [[1, 4], [0, 3], [0, 1], [1, 0], [2, 1], [1, 2], [0, 2]]),
      '7': g(2, [[0, 4], [2, 4], [0.5, 0]]),
      '8': g(2, [[1, 2], [0, 3], [1, 4], [2, 3], [1, 2], [0, 1], [1, 0], [2, 1], [1, 2]]),
      '9': g(2, [[1, 0], [2, 1], [2, 3], [1, 4], [0, 3], [1, 2], [2, 2]]),
      '.': g(0, [[0, 0], [0, 0]]),
      '/': g(2, [[0, 0], [2, 4]]),
      '-': g(2, [[0, 2], [2, 2]]),
      ' ': g(0)
    };
  })();

  // A stroke of thickness t along p to q (ends squared and pushed out by t/2 so joints overlap), as a ring.
  function strokeRing(p, q, t){
    const dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy);
    const ux = L ? dx / L : 1, uy = L ? dy / L : 0, h = t / 2;
    const a = [p[0] - ux * h, p[1] - uy * h], b = [q[0] + ux * h, q[1] + uy * h], nx = -uy * h, ny = ux * h;
    return [[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]];
  }

  // The width of a line of text in millimetres, and its height (five units).
  function textSize(text, cell){
    let w = 0;
    for(const ch of String(text).toUpperCase()){
      const gl = FONT[ch];
      if(!gl) throw new Error(`no letter drawn for "${ch}"`);
      w += gl.w + 2;
    }
    return { w: Math.max(0, w - 1) * cell, h: 5 * cell };
  }

  // A line of text as regions ({ outer, holes }), its lower-left corner at (0, 0), x to the right.
  function textRegions(text, cell){
    const rings = [];
    let x = 0.5;
    for(const ch of String(text).toUpperCase()){
      const gl = FONT[ch];
      if(!gl) throw new Error(`no letter drawn for "${ch}"`);
      for(const s of gl.strokes) for(let i = 0; i + 1 < s.length; i++) rings.push(strokeRing([(x + s[i][0]) * cell, (s[i][1] + 0.5) * cell], [(x + s[i + 1][0]) * cell, (s[i + 1][1] + 0.5) * cell], cell));
      x += gl.w + 2;
    }
    if(!rings.length) return [];
    return regionsOf(boolean2d(rings, []));
  }

  // ---- the plate -----------------------------------------------------------------------------------------

  const DEFAULTS = { thickness: 2, textHeight: 0.6 };

  // Builds the solid. input: { regions: [{ outer, holes }] (the plate, mm), raised: [{ outer, holes }] (letters on its top face) }.
  // Returns { triangles, options }.
  function buildPlate(input, options){
    const o = Object.assign({}, DEFAULTS, options || {});
    const T = o.thickness, H = T + o.textHeight;
    const regions = (input.regions || []).map(r => ({ outer: simplify(ccw(r.outer)), holes: (r.holes || []).map(h => simplify(cw(h))) }));
    const raised = (input.raised || []).map(r => ({ outer: simplify(ccw(r.outer)), holes: (r.holes || []).map(h => simplify(cw(h))) }));
    const tris = [];
    const up = (ring2d, holes2d, z) => { for(const [a, b, c] of triangulate(ring2d, holes2d)) tris.push([[a[0], a[1], z], [b[0], b[1], z], [c[0], c[1], z]]); };
    const down = (ring2d, holes2d, z) => { for(const [a, b, c] of triangulate(ring2d, holes2d)) tris.push([[a[0], a[1], z], [c[0], c[1], z], [b[0], b[1], z]]); };
    // A wall along a loop; `out` true when the solid is inside the loop (normals point out of it).
    const wall = (loop, z0, z1, out) => {
      const r = ccw(loop);
      for(let i = 0; i < r.length; i++){
        const p = r[i], q = r[(i + 1) % r.length];
        const a0 = [p[0], p[1], z0], b0 = [q[0], q[1], z0], a1 = [p[0], p[1], z1], b1 = [q[0], q[1], z1];
        if(out){ tris.push([a0, b0, b1]); tris.push([a0, b1, a1]); }
        else { tris.push([b0, a0, a1]); tris.push([b0, a1, b1]); }
      }
    };
    const own = new Map();
    for(const r of raised){
      const at = regions.findIndex(g => pointInRing(r.outer[0], g.outer) && !g.holes.some(h => pointInRing(r.outer[0], h)));
      if(at < 0) throw new Error('a letter lies off the plate');
      if(!own.has(at)) own.set(at, []);
      own.get(at).push(r);
    }
    regions.forEach((g, i) => {
      const letters = own.get(i) || [];
      up(g.outer, [...g.holes, ...letters.map(l => l.outer)], T);
      down(g.outer, g.holes, 0);
      wall(g.outer, 0, T, true);
      for(const h of g.holes) wall(h, 0, T, false);
    });
    for(const r of raised){
      up(r.outer, r.holes, H);
      wall(r.outer, T, H, true);
      for(const h of r.holes){ up(h, [], T); wall(h, T, H, false); }
    }
    return { triangles: tris, options: o };
  }

  // ---- STL -----------------------------------------------------------------------------------------

  function normal(t){
    const ux = t[1][0] - t[0][0], uy = t[1][1] - t[0][1], uz = t[1][2] - t[0][2];
    const vx = t[2][0] - t[0][0], vy = t[2][1] - t[0][1], vz = t[2][2] - t[0][2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz) || 1;
    return [nx / l, ny / l, nz / l];
  }

  // Binary STL: an 80-byte header, the triangle count, then per triangle its normal, three corners and a zero.
  function toBinaryStl(triangles, header){
    const buf = new ArrayBuffer(84 + 50 * triangles.length);
    const dv = new DataView(buf);
    const head = String(header || '').replace(/[^\x20-\x7e]/g, '').slice(0, 80);
    for(let i = 0; i < 80; i++) dv.setUint8(i, i < head.length ? head.charCodeAt(i) : 0x20);
    dv.setUint32(80, triangles.length, true);
    let off = 84;
    for(const t of triangles){
      for(const v of [normal(t), t[0], t[1], t[2]]) for(const c of v){ dv.setFloat32(off, c, true); off += 4; }
      dv.setUint16(off, 0, true); off += 2;
    }
    return new Uint8Array(buf);
  }

  function parseBinaryStl(bytes){
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const n = dv.getUint32(80, true);
    if(bytes.byteLength !== 84 + 50 * n) throw new Error(`STL size ${bytes.byteLength} does not match ${n} triangles`);
    const tris = [];
    let off = 84;
    for(let i = 0; i < n; i++){
      const f = [];
      for(let k = 0; k < 12; k++){ f.push(dv.getFloat32(off, true)); off += 4; }
      off += 2;
      tris.push({ normal: f.slice(0, 3), v: [f.slice(3, 6), f.slice(6, 9), f.slice(9, 12)] });
    }
    return { header: String.fromCharCode(...bytes.slice(0, 80)).trim(), triangles: tris };
  }

  // Closed-mesh check: every undirected edge used by exactly two triangles, in opposite directions; plus the
  // enclosed volume (positive when the normals point out).
  function meshStats(triangles){
    const key = v => v.map(c => Math.fround(c)).join(',');
    const directed = new Map();
    let volume = 0;
    for(const t of triangles){
      const v = t.v || t;
      const k = v.map(key);
      for(let i = 0; i < 3; i++){ const e = k[i] + '>' + k[(i + 1) % 3]; directed.set(e, (directed.get(e) || 0) + 1); }
      volume += (v[0][0] * (v[1][1] * v[2][2] - v[1][2] * v[2][1]) - v[0][1] * (v[1][0] * v[2][2] - v[1][2] * v[2][0]) + v[0][2] * (v[1][0] * v[2][1] - v[1][1] * v[2][0])) / 6;
    }
    let open = 0, doubled = 0, edges = 0;
    const seen = new Set();
    for(const [e, n] of directed){
      const [a, b] = e.split('>');
      const und = a < b ? a + '|' + b : b + '|' + a;
      if(seen.has(und)) continue;
      seen.add(und);
      edges++;
      const back = directed.get(b + '>' + a) || 0;
      if(n !== 1 || back !== 1){ if(n + back === 2) doubled++; else open++; }
    }
    return { edges, open, misoriented: doubled, watertight: open === 0 && doubled === 0, volume };
  }

  return { boolean2d, regionsOf, rect, strokeRing, textRegions, textSize, buildPlate, triangulate, toBinaryStl, parseBinaryStl, meshStats, signedArea, pointInRing, simplify, FONT, DEFAULTS };
});
