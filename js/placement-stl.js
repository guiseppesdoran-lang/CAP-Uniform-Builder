// Placement jig geometry and a binary STL writer (LIVE13 E64), with no library.
//
// The jig is a 2.5D solid built from flat faces and vertical walls:
//   - the plate, a polygon (here a rectangle) from z = 0 (the face on the garment) to z = thickness,
//   - pockets cut into its top face to pocketDepth (each item's outline, so the item sits in place),
//   - round through-holes at the pin positions (a 24-sided polygon),
//   - lips under the plate (strips from z = -lipHeight to 0) along the garment's registration edges.
// Every planar face is a polygon with holes, triangulated by ear clipping after joining each hole to the
// outer ring with a bridge (no extra points), so each face's boundary is exactly the loop its walls use and
// the mesh is closed: every edge belongs to two triangles, once in each direction.
//
// Units are millimetres, x right, y up, z out of the garment. Loads as a classic script
// (window.CAPUBPlacementSTL) and as a CommonJS module for the node tests.
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

  // Ear clipping of a (bridged) counter-clockwise ring. Returns triangles as point triples, counter-clockwise.
  function earClip(ring){
    const pts = ring.slice();
    const idx = pts.map((p, i) => i);
    const tris = [];
    let guard = 0;
    while(idx.length > 3){
      if(++guard > 100000) throw new Error('triangulate: did not converge');
      let clipped = false;
      for(let k = 0; k < idx.length; k++){
        const ia = idx[(k - 1 + idx.length) % idx.length], ib = idx[k], ic = idx[(k + 1) % idx.length];
        const a = pts[ia], b = pts[ib], c = pts[ic];
        if(cross(a, b, c) <= EPS) continue;
        let ok = true;
        for(const j of idx){
          if(j === ia || j === ib || j === ic) continue;
          const p = pts[j];
          if(same(p, a) || same(p, b) || same(p, c)) continue;
          if(strictlyInside(p, a, b, c) || onOpenSegment(p, a, c)){ ok = false; break; }
        }
        if(!ok) continue;
        tris.push([a, b, c]);
        idx.splice(k, 1);
        clipped = true;
        break;
      }
      if(!clipped){
        // A ring left with only straight or reflex corners: drop a vertex lying on a straight line between
        // its neighbours only if it is a duplicate (bridge seam); otherwise this is a bug in the input.
        const k = idx.findIndex((ib, k2) => { const a = pts[idx[(k2 - 1 + idx.length) % idx.length]], c = pts[idx[(k2 + 1) % idx.length]]; return same(a, c); });
        if(k >= 0){ idx.splice(k, 1); continue; }
        throw new Error('triangulate: no ear found');
      }
    }
    if(idx.length === 3 && cross(pts[idx[0]], pts[idx[1]], pts[idx[2]]) > EPS) tris.push([pts[idx[0]], pts[idx[1]], pts[idx[2]]]);
    return tris;
  }

  function triangulate(outer, holes){ return earClip(bridgeHoles(outer, holes || [])); }

  function circle(cx, cy, r, n){
    const out = [];
    for(let i = 0; i < n; i++){ const t = 2 * Math.PI * i / n; out.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]); }
    return out;
  }

  // Convex polygons a and b overlap (separating axis test), after growing each by `gap`.
  function convexOverlap(a, b, gap){
    for(const poly of [a, b]){
      for(let i = 0; i < poly.length; i++){
        const p = poly[i], q = poly[(i + 1) % poly.length];
        const nx = q[1] - p[1], ny = p[0] - q[0], len = Math.hypot(nx, ny) || 1;
        const proj = r => r.map(v => (v[0] * nx + v[1] * ny) / len);
        const pa = proj(a), pb = proj(b);
        if(Math.max(...pa) + gap < Math.min(...pb) || Math.max(...pb) + gap < Math.min(...pa)) return false;
      }
    }
    return true;
  }
  const bbox = ring => { const xs = ring.map(p => p[0]), ys = ring.map(p => p[1]); return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) }; };
  const boxRing = b => [[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]];
  function distToSegment(p, a, b){
    const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
    return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
  }
  const ringClearance = (p, ring) => Math.min(...ring.map((a, i) => distToSegment(p, a, ring[(i + 1) % ring.length])));
  // Drop points that lie on the straight line between their neighbours (they would leave T-junctions).
  function simplify(ring){
    let r = ring.filter((p, i) => !same(p, ring[(i + 1) % ring.length]));
    let changed = true;
    while(changed && r.length > 3){
      changed = false;
      for(let i = 0; i < r.length; i++){
        const a = r[(i - 1 + r.length) % r.length], b = r[i], c = r[(i + 1) % r.length];
        if(Math.abs(cross(a, b, c)) < 1e-9){ r.splice(i, 1); changed = true; break; }
      }
    }
    return r;
  }

  const DEFAULTS = { thickness: 2.5, pocketDepth: 0.6, holeDiameter: 1.5, lipHeight: 3, lipWidth: 2, holeSides: 24, edgeInset: 1, holeClearance: 0.5, minLip: 3 };

  // Builds the jig. input: { plate: [[x, y], ...] (mm, counter-clockwise or not), pockets: [{ ring, name }],
  // holes: [{ x, y, name }], lips: [{ a: [x, y], b: [x, y], toward: [x, y], name }] } where a lip is a strip of
  // lipWidth on the `toward` side of the line a-b, its face on the line. Returns { triangles, pockets, holes,
  // lips, notes, options }: what was built, and why anything asked for was left out.
  function buildJig(input, options){
    const o = Object.assign({}, DEFAULTS, options || {});
    const notes = [];
    const plate = simplify(ccw(input.plate));
    const T = o.thickness, F = o.thickness - o.pocketDepth, L = -o.lipHeight, R = o.holeDiameter / 2;

    // Pockets: merge any that touch or overlap into their common box.
    let pockets = (input.pockets || []).map(p => ({ ring: simplify(ccw(p.ring)), names: [p.name] }));
    for(let changed = true; changed;){
      changed = false;
      outer: for(let i = 0; i < pockets.length; i++){
        for(let j = i + 1; j < pockets.length; j++){
          const bi = bbox(pockets[i].ring), bj = bbox(pockets[j].ring);
          if(bi.x0 - 1 < bj.x1 && bj.x0 - 1 < bi.x1 && bi.y0 - 1 < bj.y1 && bj.y0 - 1 < bi.y1){
            const box = { x0: Math.min(bi.x0, bj.x0), y0: Math.min(bi.y0, bj.y0), x1: Math.max(bi.x1, bj.x1), y1: Math.max(bi.y1, bj.y1) };
            notes.push(`Pockets for ${pockets[i].names.join(', ')} and ${pockets[j].names.join(', ')} were joined into one, as they touch`);
            pockets[i] = { ring: boxRing(box), names: [...pockets[i].names, ...pockets[j].names] };
            pockets.splice(j, 1);
            changed = true;
            break outer;
          }
        }
      }
    }
    pockets = pockets.filter(p => {
      const fits = p.ring.every(q => pointInRing(q, plate) && ringClearance(q, plate) >= o.edgeInset);
      if(!fits) notes.push(`The pocket for ${p.names.join(', ')} reaches the plate's edge and was left out`);
      return fits;
    });

    // Holes: one per pin, inside one pocket (or the plain plate), clear of every pocket wall and of each other.
    const holes = [];
    for(const h of input.holes || []){
      const c = [h.x, h.y];
      if(holes.some(k => Math.hypot(k.x - h.x, k.y - h.y) < o.holeDiameter + 0.5)){ notes.push(`The pin hole for ${h.name} is shared with a neighbouring pin`); continue; }
      if(!pointInRing(c, plate) || ringClearance(c, plate) < R + o.edgeInset){ notes.push(`The pin hole for ${h.name} is off the plate`); continue; }
      const pocket = pockets.findIndex(p => pointInRing(c, p.ring));
      const near = pockets.some((p, i) => i !== pocket && ringClearance(c, p.ring) < R + 0.2) || (pocket >= 0 && ringClearance(c, pockets[pocket].ring) < R + 0.2);
      if(near){ notes.push(`The pin hole for ${h.name} would cut a pocket wall and was left out`); continue; }
      holes.push({ x: h.x, y: h.y, name: h.name, pocket, ring: circle(h.x, h.y, R, o.holeSides) });
    }

    // Lips: strips on the item side of each registration line, inside the plate, cut around the holes.
    const lips = [];
    const inner = bbox(plate);
    for(const lip of input.lips || []){
      const a = lip.a, b = lip.b;
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if(len < o.minLip) continue;
      const ux = (b[0] - a[0]) / len, uy = (b[1] - a[1]) / len;
      let nx = -uy, ny = ux;
      if((lip.toward[0] - a[0]) * nx + (lip.toward[1] - a[1]) * ny < 0){ nx = -nx; ny = -ny; }
      let spans = [[0, len]];
      for(const h of holes){
        const t = (h.x - a[0]) * ux + (h.y - a[1]) * uy, s = (h.x - a[0]) * nx + (h.y - a[1]) * ny, reach = R + o.holeClearance;
        if(s < -reach || s > o.lipWidth + reach) continue;
        spans = spans.flatMap(([t0, t1]) => [[t0, Math.min(t1, t - reach)], [Math.max(t0, t + reach), t1]]).filter(([t0, t1]) => t1 - t0 >= o.minLip);
      }
      for(const [t0, t1] of spans){
        const p0 = [a[0] + ux * t0, a[1] + uy * t0], p1 = [a[0] + ux * t1, a[1] + uy * t1];
        const ring = ccw([p0, p1, [p1[0] + nx * o.lipWidth, p1[1] + ny * o.lipWidth], [p0[0] + nx * o.lipWidth, p0[1] + ny * o.lipWidth]]);
        if(!ring.every(q => pointInRing(q, plate) && ringClearance(q, plate) >= o.edgeInset)){ notes.push(`Part of the ${lip.name} lip runs off the plate and was left out`); continue; }
        if(lips.some(l => convexOverlap(l.ring, ring, 0.5))){ notes.push(`Part of the ${lip.name} lip crosses another lip and was left out`); continue; }
        lips.push({ ring, name: lip.name, a: p0, b: p1 });
      }
    }
    void inner;

    // Faces and walls.
    const tris = [];
    const up = (ring2d, holes2d, z) => { for(const [a, b, c] of triangulate(ring2d, holes2d)) tris.push([[a[0], a[1], z], [b[0], b[1], z], [c[0], c[1], z]]); };
    const down = (ring2d, holes2d, z) => { for(const [a, b, c] of triangulate(ring2d, holes2d)) tris.push([[a[0], a[1], z], [c[0], c[1], z], [b[0], b[1], z]]); };
    // A wall along a counter-clockwise loop; `out` true when the solid is inside the loop (normals point out of it).
    const wall = (loop, z0, z1, out) => {
      const r = ccw(loop);
      for(let i = 0; i < r.length; i++){
        const p = r[i], q = r[(i + 1) % r.length];
        const a0 = [p[0], p[1], z0], b0 = [q[0], q[1], z0], a1 = [p[0], p[1], z1], b1 = [q[0], q[1], z1];
        if(out){ tris.push([a0, b0, b1]); tris.push([a0, b1, a1]); }
        else { tris.push([b0, a0, a1]); tris.push([b0, a1, b1]); }
      }
    };
    const topHoles = holes.filter(h => h.pocket < 0);
    up(plate, [...pockets.map(p => p.ring), ...topHoles.map(h => h.ring)], T);
    pockets.forEach((p, i) => { up(p.ring, holes.filter(h => h.pocket === i).map(h => h.ring), F); wall(p.ring, F, T, false); });
    down(plate, [...holes.map(h => h.ring), ...lips.map(l => l.ring)], 0);
    wall(plate, 0, T, true);
    for(const h of holes) wall(h.ring, 0, h.pocket < 0 ? T : F, false);
    for(const l of lips){ wall(l.ring, L, 0, true); down(l.ring, [], L); }
    return { triangles: tris, pockets, holes, lips, notes, options: o };
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

  return { buildJig, triangulate, toBinaryStl, parseBinaryStl, meshStats, circle, signedArea, pointInRing, DEFAULTS };
});
