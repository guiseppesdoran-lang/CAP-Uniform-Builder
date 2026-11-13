// Uniform engine, part 5: the parts of a drawn uniform that can be taken as a picture on their own.
//
// A scene (js/engine/compose.js) is the garment and the things placed on it. The member may want one part of it: the ribbon rack, one side of the chest, the shoulders, the cap, a
// sleeve that carries a patch, the cord. This module sorts the scene's layers into those parts and says, for a part, which layers belong to it and what box holds them. It draws nothing.
//
//   parts.plan(scene, measure, frame) -> { parts: [{ id, kind, label, file, figure, layers, box, view }], groupOf }
//   parts.sceneFor(scene, plan, part) -> a scene of the garment and of the part's own items, framed on the part
//   parts.resolution(view)      -> { ppi, widthPx, heightPx } for the picture of that frame
//
// What belongs where is read from what the engine drew, never from set numbers:
//   - a layer is an item by its role (a ribbon, a badge, a grade, a hat, a patch...) or, for a sheet laid over the whole garment, by the id of its sheet (the lapel insignia, the
//     name plate, a cord);
//   - the side of a chest item is its box against the garment's own centre line (the wearer's left is the right of the picture);
//   - the box of a part is the union of the boxes of its items. A layer that is a whole sheet (the lapel insignia lie on a sheet the size of the coat) has no box of its own in the
//     scene, so `measure(layer)` is asked for the box of what it draws (the page measures the drawing); without it such a layer adds nothing to the box.
//   - a part shows the items of its own and none of the other parts', on the garment: everything the scene draws that is no part's item (the garment, its collar and lapel
//     foreground, the tie, the belt) stays behind it, so the picture shows where the items sit.
//   - `frame` is the frame of the whole picture, as the drawing was made (the scene's bounds and their pad): a part is held to it, so no part's picture shows what the whole picture
//     does not, whatever the engine puts in the scene's bounds.
//   - a view the engine draws a second time of the same item (a patch seen edge-on beside its flat view) is part of the part but does not widen its box: the box is the view
//     that shows the item.
//
// Loads as a classic script (window.CAPUBEngine.parts) and as a CommonJS module for the Node tests.
(function(root, factory){
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./core.js') : root.CAPUBEngine.core);
  if(node) module.exports = api;
  else { root.CAPUBEngine = root.CAPUBEngine || {}; root.CAPUBEngine.parts = api; }
})(typeof self !== 'undefined' ? self : this, function(core){
  'use strict';

  // The margin round the items of a part, in inches.
  const MARGIN = 0.25;
  // The picture's size: at least 150 pixels to the inch so a small part is sharp, its longer side between 1200 and 3000 pixels. Beyond 20 inches the 3000 pixel limit wins.
  const MIN_PPI = 150, MIN_SIDE = 1200, MAX_SIDE = 3000;

  // The order the parts are offered in, and what each is called. A part with a `kind` of 'patch' is one per place on the garment.
  const KINDS = [
    { kind: 'rack', label: 'Ribbon rack', file: 'ribbon-rack' },
    { kind: 'chest-left', label: 'Left chest', file: 'left-chest' },
    { kind: 'chest-right', label: 'Right chest', file: 'right-chest' },
    { kind: 'shoulders', label: 'Collar and shoulders', file: 'collar-and-shoulders' },
    { kind: 'head', label: 'Headgear', file: 'headgear' },
    { kind: 'patch', label: 'Patch', file: 'patch' },
    { kind: 'cord', label: 'Cord', file: 'cord' }
  ];

  // The place a patch is worn, from the slot in its key (js/catalog.js PATCH_PLACES; the flight suit's sleeve is 'RS').
  const PATCH_PLACES = {
    L_SHOULDER: { label: 'Left sleeve', file: 'left-sleeve', order: 0 },
    R_SHOULDER: { label: 'Right sleeve', file: 'right-sleeve', order: 1 },
    RS: { label: 'Right sleeve', file: 'right-sleeve', order: 1 },
    CHEST_LEFT: { label: 'Left pocket', file: 'left-pocket', order: 2 },
    CHEST_RIGHT: { label: 'Right pocket', file: 'right-pocket', order: 3 }
  };

  // What a garment is called when a scene holds two of them (a blazer beside its shirt, a flight suit beside its jacket): the word its sheet's id carries.
  const GARMENT_WORDS = [[/blazer/, 'blazer'], [/jacket/, 'jacket'], [/flight-suit/, 'flight suit'], [/shirt|blouse/, 'shirt'], [/coat/, 'coat'], [/dress/, 'dress'], [/polo/, 'polo']];
  function garmentWord(id){
    const hit = GARMENT_WORDS.find(([re]) => re.test(String(id || '')));
    return hit ? hit[1] : 'garment';
  }

  // Sheets laid over the whole garment that are items: the lapel and collar insignia, the plain epaulets, the name plates and the cords. (The coat's officer overlay is the coat's
  // own cuff and strip work, not an item: it stays behind the parts.)
  const SHOULDER_SHEET = /-(lapel-(cap|us|us-nco)|senior-nco-lapel|cadet-officer-insignia|epaulet-plain)$/;
  const PLATE_SHEET = /-nametag-[a-z-]+$/;
  const CORD_SHEET = /-cord-[a-z-]+$/;
  // Lettering and grade that are on the cap, not on the garment.
  const CAP_TEXT = /cap_back|patrol_cap|hat/;

  const figureOf = l => l.figure || 1;
  const isDrawn = l => l.type !== 'measure' && l.type !== 'clear';

  // The part a layer belongs to: { kind, edge } or null for a layer that is the garment or its own decoration. A chest item's side is settled later, from where it is.
  function itemOf(l){
    const role = l.role || '', key = String(l.key || ''), id = String(l.id || '');
    // The name plate, the name tape and the tape the cap's lettering is on are places the engine sets aside on the chest (`clear` layers, drawn by nothing): the part that holds what
    // is on one shows the whole of it, not only the lettering. A place with nothing drawn on it is not a part.
    if(l.type === 'clear') return /^clear:(nametag|name_tape|cap_tape)$/.test(key) ? { kind: 'chest', frame: true } : null;
    if(!isDrawn(l)) return null;
    if(l.cordPath || l.cordLook || role === 'cord' || (/^garment/.test(role) && (CORD_SHEET.test(id) || /^layer:.*-cord-/.test(key)))) return { kind: 'cord' };
    if(role === 'ribbon' || role === 'mini-medal' || role === 'mini-drape' || role === 'device') return { kind: 'rack' };
    if(role === 'badge' || role === 'nametag') return { kind: 'chest' };
    if(role === 'text') return CAP_TEXT.test(key) ? { kind: 'head' } : { kind: 'chest' };
    if(role === 'garment-layer' && PLATE_SHEET.test(id)) return { kind: 'chest' };
    // The grade the field caps carry on their front is the cap's; the grade a name plate carries is the plate's; every other grade is worn on the collar, the shoulders, the sleeves or the chest.
    if(role === 'grade') return CAP_TEXT.test(key) ? { kind: 'head' } : /^grade:plate/.test(key) ? { kind: 'chest' } : { kind: 'shoulders' };
    if(/^epaulet/.test(role)) return { kind: 'shoulders' };
    if(role === 'garment-layer' && SHOULDER_SHEET.test(id)) return { kind: 'shoulders' };
    if(role === 'hat' || role === 'hat-device' || role === 'hat-view' || role === 'hat-view-bounds') return { kind: 'head' };
    if(role === 'patch'){
      const m = /^patch:[^:]+(?::([A-Z_]+))?(?::(0|edge))?$/.exec(key);
      if(!m) return null;   // the patch on the honor guard's ascot is the ascot's own
      return { kind: 'patch', slot: m[1] || null, edge: m[2] === 'edge' };
    }
    return null;
  }

  function intersect(a, b){
    const x0 = Math.max(a.x, b.x), y0 = Math.max(a.y, b.y), x1 = Math.min(a.x + a.w, b.x + b.w), y1 = Math.min(a.y + a.h, b.y + b.h);
    return x1 > x0 && y1 > y0 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
  }

  // The box of a layer: what `measure` says it draws; else, for a cord, the path the engine fitted for it and its width; else its own box. None for a layer whose own box is the
  // whole sheet. A layer the engine cut to a polygon (`clip`: a whole sheet of which one board shows) is held to that polygon's box.
  function boxOf(l, measure, whole){
    let box = null;
    const m = measure ? measure(l) : null;
    const cp = l.cordPath;
    if(m && Number.isFinite(m.x) && Number.isFinite(m.w) && m.w > 0 && m.h > 0) box = m;
    else if(cp && Array.isArray(cp.points) && cp.points.length){
      const b = core.polygonBounds(cp.points.map(p => Array.isArray(p) ? { x: p[0], y: p[1] } : p)), half = (cp.width || 0) / 2;
      box = { x: b.x - half, y: b.y - half, w: b.w + 2 * half, h: b.h + 2 * half };
    }else if(l.type === 'clear' || !(l.noBounds || whole(l))){
      const b = core.layerBounds(l);
      box = b && b.w > 0 && b.h > 0 ? b : null;
    }
    if(Array.isArray(l.clip) && l.clip.length > 2 && l.clip.every(p => p && Number.isFinite(p.x) && Number.isFinite(p.y))){
      const c = core.polygonBounds(l.clip);
      box = box ? intersect(box, c) : c;
    }
    return box;
  }

  function plan(scene, measure, frame){
    const layers = (scene && scene.layers) || [];
    const garments = layers.filter(l => l.type === 'asset' && l.role === 'garment');
    const garmentOf = n => garments.find(g => figureOf(g) === n) || garments[0] || null;
    // A layer is a whole sheet when it lies on a garment's own box, as a lapel overlay or a cord does.
    const whole = l => {
      const g = garmentOf(figureOf(l));
      return !!g && l.type === 'asset' && l.role !== 'garment' && l.w >= g.w * 0.6 && l.h >= g.h * 0.6;
    };
    const groups = new Map();   // layer -> { kind, figure, side, slot, edge }
    for(const l of layers){
      const it = itemOf(l);
      if(!it) continue;
      const box = boxOf(l, measure, whole);
      const g = garmentOf(figureOf(l));
      let kind = it.kind, side = null;
      // The side of an item is where its box lies against the garment's centre line: the wearer's left is the right of the picture. An item that has no box (a name plate
      // sheet nobody measured) cannot be placed, so it stays with the garment.
      if((kind === 'chest' || (kind === 'patch' && !it.slot)) && !(box && g)) continue;
      if(kind === 'chest' || (kind === 'patch' && !it.slot)){
        side = box.x + box.w / 2 >= g.x + g.w / 2 ? 'left' : 'right';
        if(kind === 'chest') kind = 'chest-' + side;
      }
      groups.set(l, { kind, figure: figureOf(l), slot: it.slot || null, side, edge: !!it.edge, frame: !!it.frame, box });
    }
    const figures = [...new Set([...groups.values()].map(x => x.figure))].sort((a, b) => a - b);
    const many = new Set(garments.map(figureOf)).size > 1;
    const named = n => many ? garmentWord((garmentOf(n) || {}).id) : null;
    const out = [];
    const make = (def, figure, members, extra) => {
      if(!members.some(([, x]) => !x.frame)) return;   // nothing drawn on it
      const boxes = members.filter(([, x]) => !x.edge || !members.some(([, y]) => !y.edge)).map(([, x]) => x.box).filter(Boolean);
      if(!boxes.length) return;
      let box = core.unionBounds(boxes);
      if(frame){
        box = intersect(box, frame);
        if(!box) return;   // wholly outside the picture
      }
      const view = { x: box.x - MARGIN, y: box.y - MARGIN, w: box.w + 2 * MARGIN, h: box.h + 2 * MARGIN };
      const suffix = named(figure);
      const label = (extra && extra.label || def.label) + (suffix ? ` (${suffix})` : '');
      const file = (extra && extra.file || def.file) + (suffix ? '-' + suffix.replace(/\s+/g, '-') : '');
      out.push({
        id: file, kind: def.kind, label, file, figure, order: extra && extra.order || 0,
        layers: members.map(([l]) => l), box,
        view: (frame && intersect(view, frame)) || view
      });
    };
    for(const def of KINDS){
      for(const figure of figures){
        const mine = [...groups].filter(([, x]) => x.figure === figure);
        const ofKind = k => mine.filter(([, x]) => x.kind === k);
        if(def.kind === 'rack'){
          const rack = ofKind('rack');
          const worn = rack.some(([l]) => l.role === 'mini-medal' || l.role === 'mini-drape');
          make(def, figure, rack, worn ? { label: 'Miniature medals', file: 'miniature-medals' } : null);
        }else if(def.kind === 'chest-left'){
          // The left side holds the ribbons and the badges round them; it is shown only when it holds more than the rack does, which has its own picture.
          const left = ofKind('chest-left');
          if(left.length) make(def, figure, [...ofKind('rack'), ...left]);
        }else if(def.kind === 'patch'){
          const places = new Map();
          for(const m of ofKind('patch')){
            const place = m[1].slot ? PATCH_PLACES[m[1].slot] || null : null;
            const side = m[1].side || (m[1].slot && /^(L_|CHEST_LEFT)/.test(m[1].slot) ? 'left' : 'right');
            const spec = place || { label: side === 'left' ? 'Patch on the left' : 'Patch on the right', file: side === 'left' ? 'left-patch' : 'right-patch', order: side === 'left' ? 4 : 5 };
            if(!places.has(spec.file)) places.set(spec.file, { spec, members: [] });
            places.get(spec.file).members.push(m);
          }
          [...places.values()].sort((a, b) => a.spec.order - b.spec.order).forEach(p => make(def, figure, p.members, p.spec));
        }else if(def.kind === 'shoulders'){
          // A rank worn on the chest alone (the OCP's) is not on the collar or the shoulders.
          const worn = ofKind('shoulders');
          make(def, figure, worn, worn.length && worn.every(([l]) => /^grade:chest/.test(String(l.key))) ? { label: 'Rank insignia', file: 'rank-insignia' } : null);
        }else{
          make(def, figure, ofKind(def.kind));
        }
      }
    }
    // By kind, then by place, then by figure, as the list above reads.
    const rank = p => KINDS.findIndex(k => k.kind === p.kind);
    out.sort((a, b) => rank(a) - rank(b) || a.order - b.order || a.figure - b.figure);
    return { parts: out, groupOf: groups };
  }

  // The scene of one part: the garment and what is no part's item, with the part's own items on it, framed on the part. The items of every other part are left out.
  function sceneFor(scene, planned, part){
    const mine = new Set(part.layers);
    const layers = scene.layers.filter(l => l.type !== 'measure' && (!planned.groupOf.has(l) || mine.has(l)));
    return Object.assign({}, scene, {
      title: `${scene.title || 'Uniform'}: ${part.label}`,
      layers, notes: [], conflicts: [], badgeOrders: [],
      bounds: { x: part.view.x, y: part.view.y, w: part.view.w, h: part.view.h }
    });
  }

  // The size of the picture of a frame (inches): 150 pixels to the inch, the longer side held to between 1200 and 3000 pixels.
  function resolution(view){
    const longer = Math.max(view.w, view.h);
    const side = Math.min(MAX_SIDE, Math.max(MIN_SIDE, longer * MIN_PPI));
    const ppi = side / longer;
    return { ppi, widthPx: Math.round(view.w * ppi), heightPx: Math.round(view.h * ppi) };
  }

  return { MARGIN, MIN_PPI, MIN_SIDE, MAX_SIDE, KINDS, PATCH_PLACES, plan, sceneFor, resolution, itemOf, garmentWord };
});
