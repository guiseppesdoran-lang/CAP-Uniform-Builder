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
    round
  };
});
