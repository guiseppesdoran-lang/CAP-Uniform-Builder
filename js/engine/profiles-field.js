// Field uniforms: OCP (chapter 7, ICL 25-06), ABU (5.1.1) and Corporate Field Uniform (5.2.1).
// The garment sheets already draw the tapes (CAP tape lettered), the OCP flag and AUX, the rank
// square and the caps; this adds the member's grade, last name, badges, command insignia and patches.
(function(root, factory){
  const node = typeof module === 'object' && module.exports;
  const deps = node
    ? { core: require('./core.js'), C: require('./compose.js'), G: require('./grades.js'), P: require('./profiles.js') }
    : { core: root.CAPUBEngine.core, C: root.CAPUBEngine.compose, G: root.CAPUBEngine.grades, P: root.CAPUBEngine.profiles };
  factory(deps.core, deps.C, deps.G, deps.P);
})(typeof self !== 'undefined' ? self : this, function(core, C, G, P){
  'use strict';
  const Z = C.Z;
  const H = P.helpers;
  const TAPE_TEXT = '#d8dbe0';
  const GARMENT = { ocp: 'garment-ocp-coat-abu-cut', abu: 'garment-abu-coat', corporate_field: 'garment-cfu-coat' };
  // Most chest badges above the CAP tape: OCP 4 (7.1.1.3.1), ABU 2 (5.1.1.1.2.4), CFU 2 (5.2.1.1.2.6).
  const MAX_BADGES = { ocp: 4, abu: 2, corporate_field: 2 };
  // The collar lies over whatever is pinned or sewn where the two meet, as a real collar lies over a badge or a patch placed near it:
  // the coat's own 'collar-front' group (the lapel quads and the leaves) is drawn again above the badges and the patches, and the collar's
  // grade above that, so the ES patch 1/2 in over the command insignia (5.2.1.1.2.8), the pocket patches and the chest badges (5.2.1.1.2.6)
  // are placed where the regulation puts them and the collar covers the part of them that lies under it, while the officer grade, the cadet
  // officer row and the cadet NCO chevrons (5.2.1.1.1, 5.1.1.1.1) stay whole on the leaf.
  const Z_COLLAR_FRONT = Z.badge + 0.5;
  const Z_COLLAR_GRADE = Z.badge + 0.6;

  // Last name on the coat's name tape and on any cap back tape the sheet draws: light silver block
  // capitals in the same lettering as the drawn CAP tape (7.1.1.2.3, 5.1.1.1.2.1, 5.2.1.1.2.1,
  // 7.1.1.8). The coat sheets draw 'CIVIL AIR PATROL' as Arial Bold outlines at a fixed em, 0.81 in (capitals 0.58 in
  // tall) on every sheet whatever the tape's height, condensed by the sheet's own x/y scale, so the name on the coat's
  // name tape takes that em and condense (Ethan: 'dynamic name in CAP-tape font'): the two tapes of a set have the
  // same capital height and stroke. COAT_CAP_LETTERING is read from the sheets' cap-tape-lettering transforms
  // (scale y x 100 glyph units = em; scale x / scale y = condense) and a test re-reads them; a sheet not in the
  // table, and the caps' back tapes, which have no CAP lettering beside them, keep the em of 0.915 of the tape.
  const COAT_CAP_LETTERING = {
    'garment-ocp-coat-abu-cut': { em: 0.81, condense: 0.5728 },
    'garment-abu-coat': { em: 0.81, condense: 0.5457 },
    'garment-cfu-coat': { em: 0.81, condense: 0.5457 }
  };
  function nameTapes(ctx, b){
    // The CAP tape's lettering is drawn on the sheet; the measurement labels stay off it.
    ctx.keepClear(ctx.rect('cap_tape'), 'cap_tape');
    if(!b.name.show || !b.name.last) return;
    // The coat's name tape, and the back tape of the cap that is worn (ctx.headgear, set by composeFieldUniform).
    for(const lm of ['name_tape', ctx.headgear && ctx.headgear.tape].filter(Boolean)){
      const r = ctx.rect(lm);
      if(!r) continue;
      ctx.keepClear(r, lm);
      const inset = 0.25 * r.h;
      const cap = lm === 'name_tape' ? COAT_CAP_LETTERING[ctx.base.id] : null;
      C.nameText(ctx, b.name.last, { x: r.x + inset, y: r.y, w: r.w - 2 * inset, h: r.h }, { color: TAPE_TEXT, size: cap ? cap.em : 0.915 * r.h, condense: cap ? cap.condense : 0.546, advance: 0.72, font: 'Arial, Helvetica, sans-serif', key: 'text:' + lm });
    }
  }

  // ---- grade ----
  function ocpSquareId(g){
    if(g.category === 'cadet-nco') return G.cadetNcoChevron(g, 'ocp-square');
    if(g.category === 'cadet-officer') return G.cadetOfficerInsignia(g, 'ocp-square');
    if(g.officer && !g.cadet) return G.seniorOfficerInsignia(g, 'ocp-square', { horizontal: false });
    return null;
  }

  // Officers' grade on the front of the caps the sheet draws (7.1.1.8, 5.1.1.6, 6.2.9-6.2.11).
  async function capGrade(ctx, b){
    const g = b.grade;
    if(!g.officer) return;
    const id = g.cadet ? G.cadetOfficerInsignia(g, 'cloth-bordered-regular') : G.seniorOfficerInsignia(g, 'cloth-bordered', { horizontal: true });
    const zones = [['patrol_cap_front_insignia_zone', b.uniform === 'ocp' ? 'visor' : 'center'], ['baseball_cap_front_insignia_zone', 'visor'], ['boonie_hat_front_insignia_zone', 'center']];
    // Only the cap that is worn has a front to carry it.
    for(const [name, mode] of zones.filter(([n]) => ctx.headgear && ctx.headgear.zone === n)){
      const z = ctx.rect(name);
      if(!z) continue;
      // The navy tactical cap of the ABU and CFU: ICL 25-02 contradicts itself. 6.2.11 says 'Cadet Officers will wear
      // embroidered grade insignia on dark blue cloth centered on the front of the cap' (the ABU cap text repeated,
      // and 5.1.1.6 says the same for the patrol cap); 6.2.11.1 says NCOs and cadets wear no insignia and the front
      // carries no Velcro or other items. The ruling (Ethan, LIVE-ENGINE 4, over the earlier reading that 6.2.11.1
      // wins): cadet OFFICERS wear their grade on this cap, the ABU collar's cloth-bordered piece, centred 1/2 in above
      // the visor like the officers' (6.2.11.1 for officers); cadet NCOs and airmen wear none (6.2.11.1), which the
      // `g.officer` test above already skips. The OCP's ball cap is covered by 7.1.1.8, which names cadet officers.
      if(name === 'baseball_cap_front_insignia_zone' && g.cadet && b.uniform !== 'ocp'){
        ctx.note('ICL 25-02 contradicts itself on the navy blue tactical cap: 6.2.11 has cadet officers wear grade on dark blue cloth centered on the front, 6.2.11.1 has NCOs and cadets wear no insignia; the grade is shown for cadet officers only');
      }
      // "1/2 inch from the visor": the zone's bottom edge already sits 1/2 in above the visor.
      const at = mode === 'visor' ? { x: z.x + z.w / 2, y: z.y + z.h } : core.rectCenter(z);
      // The OCP caps' grade may be "sewn or Velcro" (7.1.1.8). Ethan (LIVE13 E82): "for both of the OCP caps ... add the option for the 2x2 velcro
      // insignia". opt.capGrade 'square': the grade on the 2 x 2 in hook-and-loop square, the chest's own square art (ocpSquareId, 7.1.1.2.1-2) at
      // its own size and the cap's scale, its bottom 1/2 in from the visor and centred where the sewn grade is; the 1/8 in border is the sewn
      // grade's rule ("Members' sewing rank on the cap will only have 1/8th inch of blue fabric showing"), so it is not measured on the square.
      // The default stays the sewn grade with its 1/8 in border (Ethan's standing ruling).
      let piece = id, square = false;
      if(b.uniform === 'ocp' && b.opt.capGrade === 'square'){
        const sq = ocpSquareId(g);
        if(sq && ctx.has(sq)){ piece = sq; square = true; }
        else ctx.note('No 2 x 2 in square artwork for this grade, so the cap shows the sewn grade');
      }
      const k = (ctx.landmarkShift && ctx.landmarkShift[name] && ctx.landmarkShift[name].k) || 1;
      if(square){
        // The square's dark blue field is the chest's own 2 x 2 in square as the OCP sheet draws it (its rank-square rect, landmark rank_square): the
        // sheet drawn again showing only that rect, moved onto the cap (the ocp-square insignia art is the device alone, as on the chest).
        const field = core.landmarkBounds(ctx.base, 'rank_square');
        if(field){
          const box = { x: at.x - field.w * k / 2, y: (mode === 'visor' ? at.y - field.h * k : at.y - field.h * k / 2), w: field.w * k, h: field.h * k };
          const layer = Object.assign(core.registerAtOrigin(ctx.base, Z.hatDevice - 0.05, 'grade'), { key: 'grade-field:' + name, x: box.x - field.x * k, y: box.y - field.y * k, w: ctx.base.w * k, h: ctx.base.h * k, onlyGroups: ['rank-square'], noBounds: true, title: '2 x 2 in hook-and-loop square' });
          layer.origin = { x: layer.x, y: layer.y };
          layer.obstacle = box;
          ctx.layers.push(layer);
        }
      }
      // On the cap seated on the figure the grade lies over the hat (R6).
      const cg = await ctx.place(piece, Object.assign({ pieceAnchor: mode === 'visor' ? 'bottom_center' : 'center', at, z: Z.hatDevice, role: 'grade', key: 'grade:' + name }, square ? { scale: k, title: 'Grade on a 2 x 2 in hook-and-loop square' } : {}));
      if(mode === 'visor') ctx.measure({ x: at.x, y: at.y + 0.5 }, at, null, { caption: 'visor to grade' });
      // OCP caps: 'only 1/8th inch of blue fabric showing past the widest and tallest part of the insignia' (7.1.1.8).
      if(b.uniform === 'ocp' && !square) await H.blueBorder(ctx, cg);
    }
  }

  async function ocpGrade(ctx, b){
    const g = b.grade;
    const at = ctx.point('rank_square_center');
    const nco = g.category === 'senior-nco' ? `rank-senior-${g.key}-ocp-square` : null;
    if(nco && ctx.has(nco)){
      await ctx.place(nco, { pieceAnchor: 'center', at, z: Z.insignia, role: 'grade', key: 'grade:chest' });
    }else if(g.category === 'senior-nco'){
      // No square artwork for this grade: the sleeve chevron, scaled into 1 3/4 in on the square.
      const id = G.seniorChevron(g, { size: '3.5' });
      await H.placeFitted(ctx, id, at, 1.75, 1.75, { z: Z.insignia, role: 'grade', key: 'grade:chest' });
    }else{
      const id = ocpSquareId(g);
      if(id) await ctx.place(id, { pieceAnchor: 'center', at, z: Z.insignia, role: 'grade', key: 'grade:chest' });
    }
    await capGrade(ctx, b);
  }

  // The chest square has no measure on the overlay: the 2 x 2 in square is bought (7.1.1.2.1, 7.1.1.2.2) and goes on the
  // Velcro sewn to the coat at the factory, so neither its size nor its distance from the collar is something the member
  // sets (Ethan: "the 2x2 square isn't needed ... and neither is the 4.9 inches from the collar to the square").

  // ---- the arms of the ABU and CFU front figure -------------------------------------------------------
  // The coat sheets draw the sleeves twice: flat, at the sides (where the chevrons and sleeve patches are placed, from
  // the zones), and as the figure's own arms hanging at its sides, which show only the camouflage. A chevron or patch on
  // the outer arm (5.1.1.1.1.2, 5.2.1.1.1.3: halfway between the shoulder seam and the elbow; 5.1.1.1.2.2,
  // 5.2.1.1.2.2-3: 1/2 in below the seam) is seen edge-on from the front, like the OCP's shoulder pockets (D22, D42): the
  // flat piece narrowed (EDGE_SX, an estimate: the OCP sheet's own edge view is 0.5), centred on the arm's outer edge at the
  // same distance down the sleeve, turned to follow the edge, and cut to the coat silhouette so that only the part on the
  // arm shows. The outer edge is the sheet's silhouette: the table below is its outline at each inch of height, from the
  // shoulder seam to the cuff (generated by scripts/measure-arm-edge.cjs and checked against the SVGs by a test), until the
  // sheets state a frame of their own (dimensions.edge_view, as the OCP's does; FOLLOWUPS: art).
  // ARM_EDGE begin
  const ARM_EDGE = {
    'garment-abu-coat': {
      right: [[10.73,11.558],[10.33,12.558],[9.92,13.558],[9.48,14.558],[9.1,15.558],[8.75,16.558],[8.47,17.558],[8.2,18.558],[7.93,19.558],[7.71,20.558],[7.59,21.558],[7.48,22.558],[7.39,23.558],[7.38,24.558],[7.39,25.558],[7.43,26.558],[7.45,27.558],[7.46,28.558],[7.54,29.558],[7.64,30.558],[7.67,31.558],[7.84,32.558],[7.88,33.558],[7.92,34.558],[8.03,35.558],[8.15,36.558],[8.26,37.558]],
      left: [[28.6,11.558],[28.99,12.558],[29.39,13.558],[29.82,14.558],[30.2,15.558],[30.54,16.558],[30.85,17.558],[31.13,18.558],[31.41,19.558],[31.6,20.558],[31.73,21.558],[31.81,22.558],[31.87,23.558],[31.94,24.558],[31.91,25.558],[31.87,26.558],[31.85,27.558],[31.84,28.558],[31.76,29.558],[31.66,30.558],[31.63,31.558],[31.46,32.558],[31.42,33.558],[31.38,34.558],[31.27,35.558],[31.15,36.558],[31.04,37.558]]
    },
    'garment-cfu-coat': {
      right: [[10.73,17.258],[10.33,18.258],[9.92,19.258],[9.48,20.258],[9.1,21.258],[8.75,22.258],[8.47,23.258],[8.2,24.258],[7.93,25.258],[7.71,26.258],[7.59,27.258],[7.48,28.258],[7.39,29.258],[7.38,30.258],[7.39,31.258],[7.43,32.258],[7.45,33.258],[7.46,34.258],[7.54,35.258],[7.64,36.258],[7.67,37.258],[7.84,38.258],[7.88,39.258],[7.92,40.258],[8.03,41.258],[8.15,42.258],[8.26,43.258]],
      left: [[28.6,17.258],[28.99,18.258],[29.39,19.258],[29.82,20.258],[30.2,21.258],[30.54,22.258],[30.85,23.258],[31.13,24.258],[31.41,25.258],[31.6,26.258],[31.73,27.258],[31.81,28.258],[31.87,29.258],[31.94,30.258],[31.91,31.258],[31.87,32.258],[31.85,33.258],[31.84,34.258],[31.76,35.258],[31.66,36.258],[31.63,37.258],[31.46,38.258],[31.42,39.258],[31.38,40.258],[31.27,41.258],[31.15,42.258],[31.04,43.258]]
    }
  };
  // ARM_EDGE end
  const SLEEVE_LENGTH = 27.66;   // the flat sleeve view, seam to cuff (both sheets); the arm's own length is the table's arc
  const EDGE_SX = H.EDGE_SX;

  // Where on the figure's arm a piece lies that is `down` inches below the seam on the flat sleeve, and the turn of the
  // arm's edge there. Null on a sheet with no table.
  function armEdgeAt(ctx, side, down){
    const poly = ctx.base && ARM_EDGE[ctx.base.id] && ARM_EDGE[ctx.base.id][side];
    if(!poly) return null;
    const cum = [0];
    for(let i = 1; i < poly.length; i++) cum.push(cum[i - 1] + Math.hypot(poly[i][0] - poly[i - 1][0], poly[i][1] - poly[i - 1][1]));
    const s = Math.max(0, Math.min(cum[cum.length - 1], down / SLEEVE_LENGTH * cum[cum.length - 1]));
    let i = 1;
    while(i < poly.length - 1 && cum[i] < s) i++;
    const a = poly[i - 1], b = poly[i], t = (s - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1);
    // The turn follows the edge a little either side of the point, not one 1 in segment.
    const lo = poly[Math.max(0, i - 2)], hi = poly[Math.min(poly.length - 1, i + 1)];
    const dx = hi[0] - lo[0], dy = hi[1] - lo[1];
    return { at: { x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t }, rotate: Math.atan2(-dx, dy) * 180 / Math.PI };
  }

  // The edge-on copy of a chevron or patch box placed on the flat sleeve, as the arguments of ctx.place / ctx.raster.
  function armEdgeOf(ctx, side, box){
    const seam = ctx.point('seam_top_center_' + side);
    if(!seam) return null;
    const e = armEdgeAt(ctx, side, box.y + box.h / 2 - seam.y);
    return e && Object.assign(e, { w: box.w * EDGE_SX, h: box.h });
  }

  // ABU and CFU: grade on both collars (5.1.1.1.1, 5.2.1.1.1); NCO chevrons on the sleeves.
  // COLLAR6 (Ethan, on the cadet Lt Col cloth drawn as a level rectangle pushed toward the leaf's outer side: "flip it 90 degrees, and center it, and apply that logic for everything else"): every collar
  // grade piece is CENTRED on its leaf, its centre the centroid of the leaf polygon (collar_left / collar_right) on both axes, and stands in the frame of the leaf's lower seam (collar_slots[side].bottom_edge,
  // horizontal on the sheets; its angle is read from the sheet so it holds for any seam). The cadet officers' cloth and the senior officers' bars are turned a quarter turn from that frame so the cloth's long
  // side stands vertical (diamonds and discs stacked one above the other, each diamond's long axis along the seam; bars lying along the seam, stacked); the cadet NCO metal chevron stays upright, apex up; the
  // Major's and Lieutenant Colonel's stem lies parallel to the ground pointing away from the neck, the Colonel's beak faces forward, the generals' stars are stacked perpendicular to the seam. This replaces
  // the COLLAR5 placement (1 in from the front edge for the cadets, 1 in above the seam for the officers, 5.1.1.1.1.1, 5.1.1.1.1.3-4, 5.2.1.1.1): Ethan's ruling.
  // The cloth border around every insignia is 1/8 in on each side (R5).

  function leafSide(ctx, poly){
    const c = poly.points.reduce((s, q) => ({ x: s.x + q.x / poly.points.length, y: s.y + q.y / poly.points.length }), { x: 0, y: 0 });
    return c.x < ctx.base.w / 2 ? 'right' : 'left';
  }
  // The angle of a leaf's lower seam, degrees in (-90, 90] (SVG rotate: the turn that lays a piece's x axis along it): the sheet's own collar_slots[side].bottom_edge (two points, 0.01 in, as
  // {points}, {p1, p2} or a bare pair) when it states one, else the leaf polygon's own bottom edge (the edge whose outward normal points most nearly down, H.collarLeadingEdge). 0 when neither is found.
  function seamEdge(ctx, poly){
    const side = leafSide(ctx, poly), slots = ctx.base && ctx.base.raw && ctx.base.raw.collar_slots, be = slots && slots[side] && slots[side].bottom_edge;
    const pair = be && (be.points || (be.p1 && be.p2 ? [be.p1, be.p2] : be));
    if(pair && pair[0] && pair[1]){
      const pt = q => ({ x: (q.x != null ? q.x : q[0]) / 100, y: (q.y != null ? q.y : q[1]) / 100 });
      return { a: pt(pair[0]), b: pt(pair[1]) };
    }
    const e = H.collarLeadingEdge(poly.points, ctx.base.w / 2);
    return e && { a: e.collarPoint, b: e.rollEnd };
  }
  function seamAngle(ctx, poly){
    const e = seamEdge(ctx, poly);
    if(!e) return 0;
    let d = Math.atan2(e.b.y - e.a.y, e.b.x - e.a.x) * 180 / Math.PI;
    if(d > 90) d -= 180; if(d <= -90) d += 180;
    return Math.abs(d) < 1e-9 ? 0 : d;
  }
  // The long dimension (in) the C/CMSgt metal chevron takes on the collar leaf: the same as the regular officer rows on this leaf (2.5 in). Ethan's ruling and an estimate (COLLAR8).
  const COLLAR_CHEVRON_TALL = 2.5;
  // A leaf's front (leading) edge as { top, bottom } in sheet inches, the tip end first: the sheet's collar_slots[side].leading_edge (two points, 0.01 in) when it states one, else the leaf polygon's
  // longest edge (the front edge of the leaf on both sheets, H.collarLeadingEdge). Null when neither is found.
  // An edge from the leaf's centroid, one inch long, pointing along the seam toward the placket V (COLLAR10): on the wearer's right leaf (the viewer's left) the seam's direction, on the wearer's left
  // leaf the reverse, so H.collarChevrons lays the chevron's apex (the art's top) along it and the two apexes face each other across the V: the turn is the seam's angle + 90 on the wearer's right
  // leaf and - 90 on the wearer's left.
  function seamInwardEdge(ctx, poly){
    const c = H.polygonCentroid(poly.points), a = seamAngle(ctx, poly) * Math.PI / 180, k = leafSide(ctx, poly) === 'right' ? 1 : -1;
    return { bottom: { x: c.x, y: c.y }, top: { x: c.x + k * Math.cos(a), y: c.y + k * Math.sin(a) } };
  }
  function leadingEdgeOf(ctx, poly){
    const side = leafSide(ctx, poly), slots = ctx.base && ctx.base.raw && ctx.base.raw.collar_slots, le = slots && slots[side] && slots[side].leading_edge;
    const pair = le && (le.points || (le.p1 && le.p2 ? [le.p1, le.p2] : le));
    let a, b;
    if(pair && pair[0] && pair[1]){
      const pt = q => ({ x: (q.x != null ? q.x : q[0]) / 100, y: (q.y != null ? q.y : q[1]) / 100 });
      a = pt(pair[0]); b = pt(pair[1]);
    }else{
      const e = H.collarLeadingEdge(poly.points, ctx.base.w / 2);
      if(!e) return { top: { x: 0, y: 0 }, bottom: { x: 0, y: 1 } };
      a = e.collarPoint; b = e.rollEnd;
    }
    return a.y <= b.y ? { top: a, bottom: b } : { top: b, bottom: a };
  }
  async function collarGrade(ctx, b){
    const g = b.grade;
    if(g.category === 'cadet-nco'){
      // Centred on the leaf (COLLAR6; 5.1.1.1.1.4, 5.2.1.1.1.6), upright, bottom edge parallel to the leaf's lower seam (unturned when the seam is level); drawn once, for both leaves.
      // COLLAR8 (Ethan, on the C/CMSgt chevrons standing small and upright on each leaf: "the long edge needs to be parallel to the collar, and the chief specifically needs to be bigger. for all enlisted
      // things."): the chevron's long edge lies along the leaf's FRONT (leading) edge, 'one inch from and parallel to the front of the collar' (5.1.1.1.1.4, 5.2.1.1.1), apex toward the tip, centred on the
      // leaf, and every enlisted collar chevron is scaled by one common factor so the C/CMSgt one stands 2.5 in tall (H.collarChevrons: an estimate, no collar size is published).
      // COLLAR9 (Ethan, on the tilted chevrons: "parallel to the bottom seam, same as the officer insignia"): the chevron's bottom edge was parallel to the leaf's lower seam, centred, keeping the COLLAR8 size.
      // COLLAR10 (Ethan: "flip it 90 so the points are basically pointing at each other"): the chevron is turned a quarter turn from that frame so its apex points inward toward the placket V (seam
      // angle + 90 on the wearer's right leaf, - 90 on the left), the two apexes facing each other; still centred on the leaf centroid at the COLLAR8 common scale, which shrinks (0.1 in clear) if the
      // turned chevron would cross the leaf outline.
      await H.collarChevrons(ctx, g, { z: Z_COLLAR_GRADE, edgeOf: poly => seamInwardEdge(ctx, poly), tallIn: COLLAR_CHEVRON_TALL, clearIn: 0.1 });
    }else if(g.category === 'cadet-officer'){
      // Centred on the leaf (5.1.1.1.1.3, 5.2.1.1.1.4), turned a quarter turn from the seam's frame so the cloth's long side stands vertical (COLLAR6), drawn once for both leaves (H.collarOfficerRow, from
      // the sheet's collar_left / collar_right polygons). Every cadet officer wears the regular-size cloth; the miniature form
      // (which 5.1.1.1.1.3 / 5.2.1.1.1.4 allow Cadet Colonels and Cadet Captains) is used only when the regular cloth, stood
      // vertical and centred, would cross the leaf's outline (Ethan: the Spaatz and C/Capt rows read too small as miniatures).
      await H.collarOfficerRow(ctx, g, { z: Z_COLLAR_GRADE, turnOf: poly => seamAngle(ctx, poly) + 90 });
    }else if(g.officer && !g.cadet){
      const id = G.seniorOfficerInsignia(g, 'cloth-bordered', { horizontal: false });
      for(const poly of H.collarPolygons(ctx)){
        const side = leafSide(ctx, poly), R = side === 'right', seam = seamAngle(ctx, poly);
        // Centred on the leaf, the centroid of the leaf polygon (COLLAR6). Turned in the seam's frame: the bars (2d Lt, 1st Lt, Capt) a quarter turn from it so they lie along the seam and stack
        // vertically; the Major's and Lieutenant Colonel's stem parallel to the ground pointing away from the neck (a quarter turn the other way on each leaf); the Colonel's beak forward
        // (mirrored on the right leaf); the generals' stars stacked perpendicular to the seam (5.1.1.1.1.1, 5.2.1.1.1.1).
        let rotate = seam;
        if(['second-lieutenant', 'first-lieutenant', 'captain'].includes(g.key)) rotate = seam + 90;
        if(g.key === 'major' || g.key === 'lieutenant-colonel') rotate = seam + (R ? 90 : -90);
        await ctx.place(id, { pieceAnchor: 'center', at: H.polygonCentroid(poly.points), rotate, flipX: g.key === 'colonel' && R, z: Z_COLLAR_GRADE, role: 'grade', key: 'grade:' + side });
      }
    }
    // The cloth grade on the collar shows 1/8 in of blue past the embroidery (5.1.1.1.1.1, 5.1.1.1.1.3, 5.2.1.1.1.1, 5.2.1.1.1.4):
    // measured once, on the wearer's right leaf.
    if(g.category === 'cadet-officer' || (g.officer && !g.cadet)) await H.blueBorder(ctx, ctx.layers.filter(l => l.key === 'grade:right').pop());
    if(g.category === 'senior-nco'){
      const id = G.seniorChevron(g, { size: b.opt.chevron });
      let drawn = 0;
      for(const side of ['right', 'left']){
        const z = ctx.rect('chevron_zone_' + side);
        if(z){
          const l = await ctx.place(id, { pieceAnchor: 'center', at: core.rectCenter(z), z: Z.insignia, role: 'grade', key: 'grade:sleeve-' + side });
          // 'centered on the outer arm halfway between the elbow and shoulder seam' (5.1.1.1.1.2, 5.2.1.1.1.3): the sheet states the
          // seam (seam_top_center) but no elbow, so the line runs from the seam to the chevron's centre and says so; shown once, on
          // the wearer's right sleeve, beside the chevron (FOLLOWUPS: art to state the elbow on the flat sleeves).
          const seam = ctx.point('seam_top_center_' + side);
          if(l && seam && side === 'right'){
            const c = core.rectCenter(z);
            ctx.measure({ x: c.x, y: seam.y }, c, 'halfway to elbow', { center: 'to', side: { x: 1, y: 0 }, offsetOnly: true, caption: "sleeve seam to the chevron's centre" });
          }
          // The same chevron edge-on on the figure's arm.
          const e = l && armEdgeOf(ctx, side, l);
          if(e) await ctx.place(id, { pieceAnchor: 'center', at: e.at, scaleX: EDGE_SX, rotate: e.rotate, clipSil: ctx.base.id, z: Z.insignia, role: 'grade', key: `grade:sleeve-${side}:edge` });
          drawn++;
        }
      }
      if(drawn === 1) ctx.note('The ABU sheet shows only the left sleeve; the chevron is worn on both sleeves');
    }
    await capGrade(ctx, b);
  }

  // ---- badges above the CAP tape ----
  function artBottom(spec){ return core.anchor(spec, 'art_bottom_center') ? 'art_bottom_center' : 'bottom_center'; }
  // The inset for the distance from the top of the CAP tape to the bottom of the lowest badge's embroidery (FIELD7-1): the tape's edge, the badge's
  // blue backing and the embroidery's edge, the dimension across them.
  // `marks` is the badge's blue backing edge, `backing` inches nearer the tape than the embroidery's (0 when the backing lies on the tape).
  const tapeToEmbroidery = (spec, dist) => {
    const a = core.anchor(spec, 'art_bottom_center'), backing = a ? Math.max(0, spec.h - a.y) : 0;
    return { gap: true, span: true, caption: 'from the tape to the embroidery', marks: [dist - backing] };
  };
  function artTopOffset(spec){ const a = core.anchor(spec, 'art_top_center'); return a ? a.y : 0; }

  async function fieldBadges(ctx, b){
    const form = 'field';
    const set = H.badgeSet(ctx, b, form);
    // ABU and CFU: aviation and occupational badges only (5.1.1.1.2.4, 5.2.1.1.2.6).
    const ordered = b.uniform === 'ocp'
      ? [...set.chaplain, ...set.aviation, ...set.occupational, ...set.specialty, ...set.service, ...set.nationalStaff]
      : [...set.chaplain, ...set.aviation, ...set.occupational];
    const skipped = set.all.length - ordered.length;
    if(skipped > 0) ctx.note('Only aviation and occupational badges are worn above the CAP tape on this uniform; the others are not shown');
    const max = MAX_BADGES[b.uniform];
    const list = ordered.slice(0, max);
    if(ordered.length > max) ctx.note(`At most ${max} badges are worn above the CAP tape on this uniform; the rest are not shown`);
    if(!list.length) return;
    const T = ctx.point('cap_tape_top_center');
    const specs = [];
    for(const it of list) specs.push(await ctx.spec(it.art));
    const opts = i => ({ z: Z.badge, role: 'badge', key: 'badge:' + list[i].id, title: list[i].title, className: 'badge' });

    if(list.length <= 2){
      // One: 1/2 in from the tape to the silver. Two: the second sits above the first, 1/2 in apart,
      // blue edge to blue edge on the OCP (7.1.1.3.1.2), silver to silver on the ABU and CFU
      // (5.1.1.1.2.4, 5.2.1.1.2.6). The highest badge is on top.
      const lower = list.length === 2 ? 1 : 0;
      const l1 = await ctx.place(list[lower].art, Object.assign({ pieceAnchor: artBottom(specs[lower]), at: { x: T.x, y: T.y - 0.5 } }, opts(lower)));
      // FIELD7-1 (Ethan: "the first badge needs to be from the top of the blue on the civil air patrol to the white of the first badge ... add a
      // magnifying glass to show that level of detail"): the 1/2 in runs from the top edge of the tape's fabric to the bottom edge of the badge's
      // EMBROIDERY (the silver thread), not to its blue backing, which lies 1/8 in lower; the inset shows the tape's edge, the backing and the
      // embroidery's edge with the dimension across them (7.1.1.3.1.1 'measure from the top of the CAP tape to the silver of the badge'; the
      // ABU and CFU badges are silver on dark blue the same way, 5.1.1.1.2.4, 5.2.1.1.2.6).
      ctx.measure({ x: T.x, y: T.y }, { x: T.x, y: T.y - 0.5 }, '½ in', { callout: tapeToEmbroidery(specs[lower], 0.5) });
      if(list.length === 2 && b.uniform === 'ocp'){
        // The OCP rule says badge placement is measured from the blue fabric edges (7.1.1.3.1), and the
        // second badge goes 1/2 in above the first (7.1.1.3.1.2); the three and four badge columns of
        // 7.1.1.3.1.3-4 measure the same way, at 1/4 in. Only the single badge is placed to the silver
        // (7.1.1.3.1.1). So the upper badge's blue bottom edge is 1/2 in above the lower one's blue top.
        await ctx.place(list[0].art, Object.assign({ pieceAnchor: 'bottom_center', at: { x: T.x, y: l1.y - 0.5 } }, opts(0)));
        ctx.measure({ x: T.x, y: l1.y }, { x: T.x, y: l1.y - 0.5 }, null, { caption: 'lower badge to upper badge' });
      }else if(list.length === 2){
        // ABU and CFU: silver to silver (5.1.1.1.2.4; 5.2.1.1.2.6 'insignia-to-insignia, not blue to blue').
        const silverTop = l1.y + artTopOffset(specs[1]);
        await ctx.place(list[0].art, Object.assign({ pieceAnchor: artBottom(specs[0]), at: { x: T.x, y: silverTop - 0.5 } }, opts(0)));
        ctx.measure({ x: T.x, y: silverTop }, { x: T.x, y: silverTop - 0.5 }, null, { caption: 'lower badge to upper badge, silver to silver' });
      }
      return;
    }
    // Three or four (OCP only; the ABU and CFU wear two): the lowest row 1/8 in above the CAP tape (7.1.1.3.1.3, 7.1.1.3.1.4), measured
    // from the top edge of the tape to the bottom of the badge's EMBROIDERY, as the single badge and the pair are (FIELD7-1, Ethan: "from the top
    // of the blue on the civil air patrol to the white of the first badge"; the blue backing then lies on the tape, its 1/8 in border below the
    // silver). The gaps between badges stay as 7.1.1.3.1 states them, 'measured from the blue fabric edges' (Ethan ruled on the tape distance
    // only): badges stacked on one another centred on each other, the smaller on the larger, and the vertical spacing set by the larger badges. The regulation allows two layouts for each count; the defaults are the first:
    //   three: a single column, 1/4 in between badges, highest on top            | opt.badgeLayout 'pair': two side by side 1/2 in
    //          apart on the tape, the third centred 1/4 in above them
    //   four:  two stacks of two, 1/4 in between badges vertically and 1/2 in    | opt.badgeLayout 'pair': two side by side 1/2 in
    //          horizontally; highest badges on top, viewer's left first               apart, the other two stacked on the centre line 1/4 in above, 1/4 in apart
    const gapX = 0.5, rowGap = 0.25, base = T.y - 0.125;
    const pair = !!(b.opt && b.opt.badgeLayout === 'pair');
    ctx.measure({ x: T.x, y: T.y }, { x: T.x, y: base }, '⅛ in', { callout: tapeToEmbroidery(specs[2], 0.125) });
    // Two badges side by side on the base line, 1/2 in apart, centred on the tape; returns their boxes.
    const sideBySide = async (i, j) => {
      const wi = specs[i].w, wj = specs[j].w, W = wi + gapX + wj;
      const l = await ctx.place(list[i].art, Object.assign({ pieceAnchor: artBottom(specs[i]), at: { x: T.x - W / 2 + wi / 2, y: base } }, opts(i)));
      const r = await ctx.place(list[j].art, Object.assign({ pieceAnchor: artBottom(specs[j]), at: { x: T.x + W / 2 - wj / 2, y: base } }, opts(j)));
      ctx.measure({ x: l.x + l.w, y: base - 0.3 }, { x: r.x, y: base - 0.3 }, null, { caption: 'between the badges' });
      return [l, r];
    };
    if(list.length === 3 && !pair){
      // 7.1.1.3.1.3, a single vertical column with 1/4 in between badges: the third (lowest precedence) at the bottom.
      let bottom = base, anchor = artBottom(specs[2]);
      const boxes = [];
      for(const i of [2, 1, 0]){
        const box = await ctx.place(list[i].art, Object.assign({ pieceAnchor: anchor, at: { x: T.x, y: bottom } }, opts(i)));
        anchor = 'bottom_center';
        boxes[i] = box;
        if(box) bottom = box.y - rowGap;
      }
      for(const i of [2, 1]) if(boxes[i] && boxes[i - 1]) ctx.measure({ x: T.x, y: boxes[i - 1].y + boxes[i - 1].h }, { x: T.x, y: boxes[i].y }, null, { caption: 'badge to badge' });
      return;
    }
    if(list.length === 3){
      // 7.1.1.3.1.3, second form: two side by side, the third centred on the tape 1/4 in above the lower two.
      const [a, c] = await sideBySide(1, 2);
      const rowTop = Math.min(a.y, c.y);
      const up = await ctx.place(list[0].art, Object.assign({ pieceAnchor: 'bottom_center', at: { x: T.x, y: rowTop - rowGap } }, opts(0)));
      if(up) ctx.measure({ x: T.x, y: up.y + up.h }, { x: T.x, y: rowTop }, null, { caption: 'badge row to badge' });
      return;
    }
    if(!pair){
      // 7.1.1.3.1.4, first form: two columns of two; the top row is the two highest badges, the viewer's left first. A stack is centred on its
      // wider badge; the rows keep 1/4 in measured from the taller of the lower badges.
      const colL = Math.max(specs[0].w, specs[2].w), colR = Math.max(specs[1].w, specs[3].w);
      const W = colL + gapX + colR;
      const xL = T.x - W / 2 + colL / 2, xR = T.x + W / 2 - colR / 2;
      const b3 = await ctx.place(list[2].art, Object.assign({ pieceAnchor: artBottom(specs[2]), at: { x: xL, y: base } }, opts(2)));
      const b4 = await ctx.place(list[3].art, Object.assign({ pieceAnchor: artBottom(specs[3]), at: { x: xR, y: base } }, opts(3)));
      const topY = Math.min(b3.y, b4.y) - rowGap;
      ctx.measure({ x: xL + colL / 2, y: b3.y + b3.h }, { x: xL + colL / 2 + gapX, y: b3.y + b3.h }, null, { caption: 'between the columns' });
      ctx.measure({ x: xL, y: Math.min(b3.y, b4.y) }, { x: xL, y: topY }, null, { caption: 'badge row to badge row' });
      await ctx.place(list[0].art, Object.assign({ pieceAnchor: 'bottom_center', at: { x: xL, y: topY } }, opts(0)));
      await ctx.place(list[1].art, Object.assign({ pieceAnchor: 'bottom_center', at: { x: xR, y: topY } }, opts(1)));
      ctx.measure({ x: xR, y: Math.min(b3.y, b4.y) }, { x: xR, y: topY }, null, { caption: 'badge row to badge row' });
      return;
    }
    // 7.1.1.3.1.4, second form: two side by side on the tape, the other two stacked on the centre line 1/4 in above them, 1/4 in apart.
    const [l, r] = await sideBySide(2, 3);
    const rowTop = Math.min(l.y, r.y);
    const lower = await ctx.place(list[1].art, Object.assign({ pieceAnchor: 'bottom_center', at: { x: T.x, y: rowTop - rowGap } }, opts(1)));
    ctx.measure({ x: T.x, y: lower.y + lower.h }, { x: T.x, y: rowTop }, null, { caption: 'badge row to badge' });
    const top = await ctx.place(list[0].art, Object.assign({ pieceAnchor: 'bottom_center', at: { x: T.x, y: lower.y - rowGap } }, opts(0)));
    if(top) ctx.measure({ x: T.x, y: top.y + top.h }, { x: T.x, y: lower.y }, null, { caption: 'badge to badge' });
  }

  // Command insignia: current commanders 1/2 in above the name tape; graduated commanders on the
  // OCP left sleeve tab, the ABU flap 1/2 in below the tape, or the CFU right pocket flap
  // (7.1.1.3.1.7, 5.1.1.1.2.5, 5.2.1.1.2.9). It never counts toward the badge limit.
  async function fieldCommand(ctx, b){
    const pin = H.commandPin(ctx, b, 'field');
    if(!pin) return;
    const tape = ctx.rect('name_tape');
    const o = { z: Z.badge, role: 'badge', key: `badge:${pin.id}:${pin.graduated ? 'UN' : 'ON'}:0`, title: pin.title, className: 'badge' };
    const tx = tape.x + tape.w / 2;
    if(!pin.graduated){
      if(await ctx.place(pin.art, Object.assign({ pieceAnchor: 'bottom_center', at: { x: tx, y: tape.y - 0.5 } }, o))) ctx.measure({ x: tx, y: tape.y }, { x: tx, y: tape.y - 0.5 }, null, { caption: 'name tape to command pin' });
      return;
    }
    if(b.uniform === 'ocp') await ocpSleevePin(ctx, pin, o);
    else if(b.uniform === 'abu'){
      if(await ctx.place(pin.art, Object.assign({ pieceAnchor: 'top_center', at: { x: tx, y: tape.y + tape.h + 0.5 } }, o))) ctx.measure({ x: tx, y: tape.y + tape.h }, { x: tx, y: tape.y + tape.h + 0.5 }, null, { caption: 'name tape to command pin' });
    }else{
      const flap = ctx.rect('chest_flap_right');
      if(flap) await ctx.place(pin.art, Object.assign({ pieceAnchor: 'center', at: core.rectCenter(flap) }, o));
    }
  }

  // Graduated commanders: the 1 in x 1 in insignia patch on the small Velcro piece on top of the
  // left sleeve, centred above the shoulder patches (7.1.1.3.1.7). The sheet's piece is the IFF loop,
  // 1 x 3 1/4 in, whose upper 1 7/8 in is covered by the camouflage flap; the patch goes on the loop
  // that shows, centred in it, never across the flap's edge. Drawn in the flat sleeve view and in the
  // edge view of the sleeve.
  async function ocpSleevePin(ctx, pin, o){
    const tab = ctx.rect('glint_tab_left');
    if(!tab) return;
    const dims = ctx.base && ctx.base.raw && ctx.base.raw.dimensions;
    const cover = Math.min(tab.h, (dims && dims.sleeve_pocket && dims.sleeve_pocket.iff_cover_in && dims.sleeve_pocket.iff_cover_in[1]) || 1.875);
    const loop = { x: tab.x, y: tab.y + cover, w: tab.w, h: tab.h - cover };
    const flat = await ctx.place(pin.art, Object.assign({ pieceAnchor: 'center', at: core.rectCenter(loop) }, o));
    const f = edgeFrame(ctx, 'left');
    // The patch is on the loop in the edge view too, clipped to the loop (7.1.1.4) and the coat.
    const clip = flat && f && f.shows(tab);
    if(clip){
      const e = f.map({ x: flat.x, y: flat.y, w: flat.w, h: flat.h });
      await ctx.place(pin.art, Object.assign({}, o, { pieceAnchor: 'center', at: e.center, scaleX: f.sx, rotate: f.tilt, key: o.key + ':edge', clip }));
    }
    // Centred on the loop that shows ('centered horizontally and vertically', 7.1.1.3.1.7): one 'centered' line over the
    // loop, its tick at the patch's centre, beside the sleeve view.
    if(flat){
      const cx = flat.x + flat.w / 2;
      ctx.measure({ x: cx, y: loop.y }, { x: cx, y: loop.y + loop.h }, 'centered', { mid: { x: cx, y: flat.y + flat.h / 2 }, side: { x: 1, y: 0 }, offsetOnly: true, caption: 'command pin on the loop' });
    }
  }

  // ---- patches ----
  // Patches have no regulation size; each is fitted inside its Velcro or zone (7.1.1.4) and capped at
  // 3 1/2 in, the size of the common CAP shoulder patches.
  function fitPatch(ctx, patch, rect, slot){
    const cap = { x: rect.x, y: rect.y, w: Math.min(rect.w, 3.5), h: Math.min(rect.h, 3.5) };
    cap.x = rect.x + (rect.w - cap.w) / 2;
    cap.y = rect.y + (rect.h - cap.h) / 2;
    return C.fitRaster(ctx, patch.href, cap, patch.aspect || 1, { z: Z.patch, role: 'patch', key: `patch:${patch.id}:${slot}:0`, title: patch.title, className: 'patch' });
  }

  // The OCP sheet draws each shoulder pocket twice: flat (the sleeve views at the sides) and seen
  // from the front where the sleeve meets the coat, narrowed to half its width and turned a little
  // (the `sleeve-pocket-edge-*` groups of the sheet). A patch worn on the Velcro shows in both. The
  // edge view is the flat one narrowed about the pocket's centre line (EDGE.sx), moved down EDGE.dy
  // and turned EDGE.tilt about the pocket's centre, which sits EDGE.pivotDX from the coat's centre
  // line (the sheet's own constants; the sheet publishes no landmark for it yet, see FOLLOWUPS).
  //
  // The sheet draws those groups inside its coat silhouette (`clipSil`), so the outer part of the
  // edge pocket is cut off where the sleeve's edge passes through it. A patch on the Velcro may not
  // go past the Velcro (7.1.1.4: patches will not extend past the boundary of the Velcro), and what
  // shows of the pocket is only what is on the coat, so every edge-view piece is clipped to its
  // Velcro rect (the flap, or the IFF loop) mapped through the edge frame and to the silhouette.
  // EDGE.visible is the sheet's silhouette near the pocket: points [v, u] of the sleeve's outer edge in
  // the pocket's own frame (v down from the pivot, u toward the coat's centre line), a convex curve
  // kept 0.03 to 0.05 in inside the sheet's clipSil (a test reads clipSil and checks it).
  const EDGE = { 'garment-ocp-coat-abu-cut': { sx: 0.5, dy: 1.6, tilt: 12.375, pivotDX: 12.726,
    visible: [[-5.25, 0.46], [-4.25, 0.08], [-3.75, -0.08], [-3.25, -0.14], [-2.25, -0.23], [-1.75, -0.26], [0.25, -0.31], [1.25, -0.33], [1.75, -0.32], [2.25, -0.27], [3.75, -0.08]] } };

  // Sutherland-Hodgman: a polygon cut to a convex one (either winding).
  function clipConvex(subject, clip){
    let area = 0;
    for(let i = 0; i < clip.length; i++){ const a = clip[i], b = clip[(i + 1) % clip.length]; area += a.x * b.y - b.x * a.y; }
    const sign = area >= 0 ? 1 : -1;
    let out = subject;
    for(let i = 0; i < clip.length && out.length; i++){
      const a = clip[i], b = clip[(i + 1) % clip.length];
      const side = p => sign * ((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x));
      const input = out;
      out = [];
      for(let j = 0; j < input.length; j++){
        const p = input[j], q = input[(j + 1) % input.length], sp = side(p), sq = side(q);
        if(sp >= 0) out.push(p);
        if((sp >= 0) !== (sq >= 0)){ const t = sp / (sp - sq); out.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t }); }
      }
    }
    return out;
  }

  function edgeFrame(ctx, side){
    // The sheet states the frame itself (dimensions.edge_view: scale, tilt, the pivot of each pocket in sheet inches and the silhouette near it); the table below is only for a sheet that does not.
    const ev = ctx.base && ctx.base.raw && ctx.base.raw.dimensions && ctx.base.raw.dimensions.edge_view;
    const velcro = ctx.rect('sleeve_flap_velcro_' + side), top = ctx.point('top_center');
    const right = side === 'right';
    let e = ctx.base && EDGE[ctx.base.id], pivot;
    if(ev && velcro){
      const pv = right ? ev.pivot_right_in : ev.pivot_left_in;
      pivot = { x: pv[0], y: pv[1] };
      e = { sx: ev.scale, tilt: ev.tilt_deg, dy: pv[1] - core.rectCenter(velcro).y, visible: right ? ev.visible_right : ev.visible_left };
    }
    if(!e || !velcro || !top) return null;
    const c = core.rectCenter(velcro);
    if(!pivot) pivot = { x: top.x + (right ? -e.pivotDX : e.pivotDX), y: c.y + e.dy };
    const tilt = right ? e.tilt : -e.tilt;
    const dir = right ? 1 : -1;
    // Where the sheet's coat silhouette lets the pocket show, in the pocket's own (unturned) frame.
    const first = e.visible[0], last = e.visible[e.visible.length - 1];
    const visible = [...e.visible.map(([v, u]) => ({ x: dir * u, y: v })), { x: dir * 4, y: last[0] }, { x: dir * 4, y: first[0] }];
    const toScene = (dx, v) => core.rotatePoint({ x: pivot.x + dx, y: pivot.y + v }, pivot, tilt);
    return {
      sx: e.sx, tilt, pivot,
      // A flat rect on the sleeve -> its width and height in the edge view and its centre there.
      map(r){
        const m = core.rectCenter(r);
        return { w: r.w * e.sx, h: r.h, center: core.rotatePoint({ x: pivot.x + (m.x - c.x) * e.sx, y: m.y + e.dy }, pivot, tilt) };
      },
      // What shows in the edge view of a flat rect on the sleeve (the Velcro, the IFF loop): the rect
      // mapped through the frame and cut to the coat silhouette, as a polygon in scene inches (the
      // clip of every piece drawn there). Empty when none of it shows.
      shows(r){
        const local = [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]].map(([x, y]) => ({ x: (x - c.x) * e.sx, y: y - c.y }));
        const cut = clipConvex(local, visible);
        return cut.length >= 3 ? cut.map(p => toScene(p.x, p.y)) : null;
      }
    };
  }

  // A patch on a sleeve's Velcro: in the flat view and again, narrowed, in the edge view, where it is
  // clipped to the Velcro and the coat (7.1.1.4).
  function sleevePatch(ctx, patch, zone, slot, side){
    const flat = fitPatch(ctx, patch, zone, slot);
    if(!flat) return null; // a crop of the old sleeve drawing is not drawn (ctx.raster)
    const f = edgeFrame(ctx, side);
    const velcro = ctx.rect('sleeve_flap_velcro_' + side);
    const clip = f && velcro && f.shows(velcro);
    if(f && clip){
      const e = f.map(flat);
      ctx.raster({ href: patch.href, x: e.center.x - e.w / 2, y: e.center.y - e.h / 2, w: e.w, h: e.h, rotate: f.tilt, origin: e.center, fit: 'stretch', clip,
        z: Z.patch, role: 'patch', key: `patch:${patch.id}:${slot}:edge`, title: patch.title, className: 'patch' });
    }
    return flat;
  }

  // Overlay: where the patch sits on the Velcro. The unit patch is 'centered in the middle of the Velcro area under the
  // U.S. Flag' (7.1.1.4.1.2): one 'centered' line from the flag's bottom edge to the Velcro's, its tick at the patch's
  // centre, drawn beside the sleeve (the patch covers the straight line). The patch's own width is not shown: it is the
  // size the patch is bought in. The HHQ patch under AUX has no stated position (7.1.1.4.2.1), so nothing is measured for
  // it. The labels keep off the flag or AUX patch the sheet draws, flat and seen edge-on (D26).
  function measureSleevePatch(ctx, layer, velcroName, drawnName, centred){
    const v = ctx.rect(velcroName), d = ctx.rect(drawnName);
    if(!layer) return;
    const cx = layer.x + layer.w / 2;
    if(d){
      ctx.keepClear(d, drawnName);
      const f = edgeFrame(ctx, velcroName.endsWith('right') ? 'right' : 'left');
      if(f){
        const e = f.map(d), R = f.tilt * Math.PI / 180, c = Math.abs(Math.cos(R)), s = Math.abs(Math.sin(R));
        const w = e.w * c + e.h * s, h = e.w * s + e.h * c;
        ctx.keepClear({ x: e.center.x - w / 2, y: e.center.y - h / 2, w, h }, drawnName + '-seen-edge-on');
      }
    }
    if(centred && v && d){
      // The flat sleeve views lie at the sides of the sheet: the line goes beside the patch on the side toward the coat.
      const inward = velcroName.endsWith('right') ? 1 : -1;
      ctx.measure({ x: cx, y: d.y + d.h }, { x: cx, y: v.y + v.h }, 'centered', { mid: { x: cx, y: layer.y + layer.h / 2 }, side: { x: inward, y: 0 }, offsetOnly: true, caption: 'patch on the sleeve pocket' });
    }
  }

  // ---- the CAP Ranger tab ----
  // LIVE13 E84, as corrected by Ethan's ruling (2026-10-29, over the regulation's text): "the ranger tabs arent authorized on ABUs!!! only on OCPs
  // unfortunately in lieu of an hhq patch"; "they are only authorized unfortunately on the OCPs". (CAPR 39-1 5.1.2.3.7 and 5.2.1.1.2.7 put the tab on
  // the BDU and CFU above the CAP tape; 9.2.4 lets HMRS graduates wear one tab.) So on the OCP the tab is worn in the left sleeve's HHQ place under the
  // AUX identifier (7.1.1.4.2.1), counting as one of its two patches as the HHQ patch does, the way the 7.1.1.4.2.2 patches are worn in lieu of the
  // HHQ patch; the HHQ patch is then not drawn; the chest badges keep measuring from the CAP tape. The page hands the tab as a patch whose id is its
  // sheet (patch-ranger-tab-<grade>, Figure A8-2), drawn at the sheet's size (2.7 x 0.44 in since art aa950a56, measured on the HMRS 2021 uniform
  // poster; it was 5.0 x 0.815, the CAP tape's width) by its centre on the place's centre (the sheet's hhq_patch_left_center, else the middle of the
  // Velcro below AUX), flat on the sleeve view and seen edge-on on the coat like the other sleeve patches. One tab only.
  // The HHQ place has no stated position, so nothing is measured for it (measureSleevePatch).
  const isRangerTab = p => !!p && /^patch-ranger-tab-[a-z0-9-]+$/.test(String(p.id || ''));
  async function rangerTabInHhqSlot(ctx, tabs, replaced){
    if(tabs.length > 1) ctx.note('Only one CAP Ranger tab is worn; the first selected is shown');
    const t = tabs[0];
    if(!ctx.has(t.id)){ ctx.note(`No artwork for ${t.id}`); return null; }
    const zone = belowOnVelcro(ctx, 'sleeve_flap_velcro_left', 'patch_aux_left');
    if(!zone) return null;
    const flat = await ctx.place(t.id, { pieceAnchor: 'center', at: ctx.point('hhq_patch_left_center') || core.rectCenter(zone), z: Z.patch, role: 'patch', key: `patch:${t.id}:L_SHOULDER:0`, title: t.title || t.id, className: 'patch' });
    if(!flat) return null;
    // Seen edge-on where the sleeve meets the coat, cut only to what of the sleeve shows there.
    const f = edgeFrame(ctx, 'left'), clip = f && f.shows(flat);
    if(f && clip){
      const e = f.map(flat);
      ctx.layers.push({ type: 'asset', id: t.id, x: e.center.x - e.w / 2, y: e.center.y - e.h / 2, w: e.w, h: e.h, rotate: f.tilt, origin: e.center, clip,
        z: Z.patch, role: 'patch', key: `patch:${t.id}:L_SHOULDER:edge`, title: t.title || t.id, className: 'patch' });
    }
    measureSleevePatch(ctx, flat, 'sleeve_flap_velcro_left', 'patch_aux_left', false);
    ctx.note(`The CAP Ranger tab is worn by Hawk Mountain Ranger School graduates on the OCP only, in lieu of the HHQ patch, in its place under the AUX identifier (Ethan's ruling, 2026-10-29; CAPR 39-1, 7.1.1.4.2, 7.1.1.4.2.1)${replaced ? `; ${replaced.title || 'the HHQ patch'} is not shown while the tab is worn` : ''}`);
    return flat;
  }

  function belowOnVelcro(ctx, velcroName, drawnName){
    const v = ctx.rect(velcroName), d = ctx.rect(drawnName);
    if(!v || !d) return null;
    const top = d.y + d.h;
    return { x: v.x, y: top, w: v.w, h: v.y + v.h - top };
  }

  function pocketZone(ctx, side){
    const pocket = ctx.rect('chest_pocket_' + side), flap = ctx.rect('chest_flap_' + side);
    if(!pocket || !flap) return null;
    const top = flap.y + flap.h;
    const inset = 0.25;
    return { x: pocket.x + inset, y: top + inset, w: pocket.w - 2 * inset, h: pocket.y + pocket.h - top - 2 * inset };
  }

  async function fieldPatches(ctx, b){
    const patches = [...(b.patches || [])];   // a copy: patches are taken out of it as they are placed
    const take = pred => { const i = patches.findIndex(pred); return i < 0 ? null : patches.splice(i, 1)[0]; };
    if(b.uniform === 'ocp'){
      // Right sleeve: unit patch centred under the drawn flag (7.1.1.4.1.2). Left: HHQ patch under AUX.
      const unit = take(p => p.kind === 'unit' || p.slot === 'R_SHOULDER');
      if(unit){
        const z = belowOnVelcro(ctx, 'sleeve_flap_velcro_right', 'patch_flag_right');
        if(z) measureSleevePatch(ctx, sleevePatch(ctx, unit, z, 'R_SHOULDER', 'right'), 'sleeve_flap_velcro_right', 'patch_flag_right', true);
      }
      // A CAP Ranger tab takes the HHQ patch's place under AUX and the HHQ patch is not worn (rangerTabInHhqSlot).
      const tabs = [];
      for(let t = take(isRangerTab); t; t = take(isRangerTab)) tabs.push(t);
      if(tabs.length){
        const replaced = take(p => p.slot === 'L_SHOULDER' && !!p.echelon) || take(p => p.slot === 'L_SHOULDER');
        await rangerTabInHhqSlot(ctx, tabs, replaced);
      }else{
        const hhq = take(p => p.slot === 'L_SHOULDER') || take(() => true);
        if(hhq){
          const z = belowOnVelcro(ctx, 'sleeve_flap_velcro_left', 'patch_aux_left');
          if(z) measureSleevePatch(ctx, sleevePatch(ctx, hhq, z, 'L_SHOULDER', 'left'), 'sleeve_flap_velcro_left', 'patch_aux_left', false);
        }
      }
    }else{
      // The Ranger tab is not worn on the ABU or the CFU (Ethan's ruling, 2026-10-29; see rangerTabInHhqSlot).
      if(patches.some(isRangerTab)){
        while(take(isRangerTab));
        ctx.note('The CAP Ranger tab is worn on the OCP only, in lieu of the HHQ patch (Ethan\'s ruling, 2026-10-29), so it is not shown on this uniform');
      }
      // The unit (organizational) patch is worn on the right breast pocket of the ABU and the CFU, not on
      // a sleeve (Attachment 4: Organizational Patch RP; 5.1.1.1.2.3, 5.2.1.1.2.5); the CFU's right
      // sleeve is for a special activity patch (5.2.1.1.2.3).
      const unit = take(p => p.kind === 'unit');
      // The left sleeve of both uniforms takes one wing, region or national patch and nothing else (5.1.1.1.2.2 ABU,
      // 5.2.1.1.2.2 CFU): only a patch the page marks with its echelon goes there, whatever slot it was filed under.
      // A special activity patch is the CFU's right sleeve (5.2.1.1.2.3); the ABU has no sleeve place for it.
      const isHq = p => !!p.echelon;
      const left = take(p => p.slot === 'L_SHOULDER' && isHq(p));
      // The ABU and CFU sleeve patches are sewn 1/2 in below the shoulder seam (5.1.1.1.2.2; 5.2.1.1.2.2-3): the zone's top is that line (the sheet puts it 0.5 in under the seam_top_center
      // anchor), so the patch hangs from the zone's top and the overlay draws the 1/2 in from the seam to its top edge.
      // A patch is drawn at its own size, the 3.5 in the OCP Velcro and the pockets allow, whatever the sleeve zone (the zone fixes the
      // position, not the size: the same patch is one size on every uniform, R1, D2); the edge-on copy is cut to the coat's silhouette.
      const hang = (patch, zone, slot, side) => {
        const box = { x: zone.x + (zone.w - 3.5) / 2, w: 3.5 };
        let w = box.w, h = w / (patch.aspect || 1);
        if(h > 3.5){ h = 3.5; w = h * (patch.aspect || 1); }
        const layer = C.fitRaster(ctx, patch.href, { x: box.x, y: zone.y, w: box.w, h }, patch.aspect || 1, { z: Z.patch, role: 'patch', key: `patch:${patch.id}:${slot}:0`, title: patch.title, className: 'patch' });
        // And edge-on on the figure's arm.
        const e = layer && armEdgeOf(ctx, side, layer);
        if(e) ctx.raster({ href: patch.href, x: e.at.x - e.w / 2, y: e.at.y - e.h / 2, w: e.w, h: e.h, rotate: e.rotate, origin: e.at, fit: 'stretch', clipSil: ctx.base.id, z: Z.patch, role: 'patch', key: `patch:${patch.id}:${slot}:edge`, title: patch.title, className: 'patch' });
        const seam = ctx.point('seam_top_center_' + side);
        if(layer && seam) ctx.measure({ x: layer.x + layer.w / 2, y: seam.y }, { x: layer.x + layer.w / 2, y: layer.y }, null, { caption: 'shoulder seam to patch' });
        return layer;
      };
      const zl = ctx.rect('wing_patch_zone_left');
      if(left && zl) hang(left, zl, 'L_SHOULDER', 'left');
      if(b.uniform === 'corporate_field'){
        // The right sleeve: the special activity patch (5.2.1.1.2.3); a general patch the page filed under the left shoulder is one.
        const right = take(p => p.slot === 'R_SHOULDER' || p.kind === 'unit') || take(p => p.slot === 'L_SHOULDER' && !isHq(p));
        const zr = ctx.rect('activity_patch_zone_right');
        if(right && zr) hang(right, zr, 'R_SHOULDER', 'right');
      }else{
        for(let stray = take(p => p.slot === 'L_SHOULDER' && !isHq(p)); stray; stray = take(p => p.slot === 'L_SHOULDER' && !isHq(p))){
          ctx.note(`${stray.title} is not worn on the ABU sleeve: the left sleeve takes one wing, region or national patch only (CAPR 39-1, 5.1.1.1.2.2)`);
        }
      }
      // Breast pocket patches: one in all on the ABU (5.1.1.1.2.3), one per pocket on the CFU.
      const pockets = b.uniform === 'abu' ? 1 : 2;
      let used = 0;
      for(const side of ['right', 'left']){
        if(used >= pockets) break;
        const want = side === 'right' ? 'CHEST_RIGHT' : 'CHEST_LEFT';
        const p = (side === 'right' && unit) || take(x => x.slot === want) || take(x => x.slot === 'CHEST_LEFT' || x.slot === 'CHEST_RIGHT');
        const z = pocketZone(ctx, side);
        if(p && z){
          const layer = fitPatch(ctx, p, z, want);
          used++;
          // 'centered on the lower portion of the breast pocket ... between left and right edges and bottom of flap and pocket'
          // (5.1.1.1.2.3, 5.2.1.1.2.4, 5.2.1.1.2.5): from the flap's bottom to the pocket's, the tick at the patch's centre, drawn
          // beside the pocket on its outer side.
          const pocket = ctx.rect('chest_pocket_' + side), flap = ctx.rect('chest_flap_' + side);
          if(layer && pocket && flap){
            const cx = layer.x + layer.w / 2;
            ctx.measure({ x: cx, y: flap.y + flap.h }, { x: cx, y: pocket.y + pocket.h }, 'centered', { mid: { x: cx, y: layer.y + layer.h / 2 }, side: { x: side === 'right' ? -1 : 1, y: 0 }, offsetOnly: true, caption: 'patch on the lower pocket' });
          }
        }
      }
      if(b.uniform === 'corporate_field' && b.opt.esPatch && b.opt.esPatch !== 'none'){
        // ES patch 1/2 in above the name tape (above the command insignia if worn), 5.2.1.1.2.8.
        const tape = ctx.rect('name_tape');
        const id = b.opt.esPatch === 'style-2' ? 'patch-es-style-2' : 'patch-es-style-1';
        // The pin is the piece placed over the tape: its real top edge, not a guessed height.
        const pin = ctx.layers.find(l => l.role === 'badge' && /^badge:[^:]+:ON:0$/.test(l.key));
        const above = pin ? pin.y : tape.y;
        const y = above - 0.5;
        const s = await ctx.spec(id);
        const scale = Math.min(1, 3 / s.w, 3 / s.h);
        await ctx.place(id, { pieceAnchor: 'bottom_center', at: { x: tape.x + tape.w / 2, y }, scale, z: Z.patch, role: 'patch', key: 'patch:' + id, title: 'Emergency Services patch' });
        ctx.measure({ x: tape.x + tape.w / 2, y: above }, { x: tape.x + tape.w / 2, y }, null, { caption: (pin ? 'command pin' : 'name tape') + ' to ES patch' });
      }
    }
    if(patches.length) ctx.note('Some selected patches have no place left on this uniform and are not shown');
  }

  // ---- headgear: the cap worn, its front on the collar and its back beside it ----
  // The coat sheets draw every cap as views in the top margin (patrol cap front and back, tactical / baseball cap front
  // and back, the CFU's boonie hat): groups of the sheet, each with its own landmarks. Drawing all of them was clunky
  // (Ethan, live site), so only the cap the member chose (opt.headgear: the patrol cap by default, 'tactical', the
  // CFU's 'boonie', or 'none') is drawn, and the sheet's own cap views are all hidden. R6 wants the hat on top of the
  // figure: the cap's front view is carried onto the collar, its bottom centre on the collar's back top (the sheet's
  // hat_attach anchor when it has one, else the apex of its collar-back curve, 5.635 in above collar_apex, measured
  // on the three sheets) lowered by HAT_SEAT (the seat the dress caps use, an estimate: the regulation shows no
  // seating). Its back view, with the name tape, stands beside it at the same size as the front (BACK_VIEW_SCALE 1; Ethan:
  // 'why is the back of the hats so small'), 1/2 in clear of it (BACK_VIEW_GAP), its crown level with the front's (see place), so the name tape
  // (7.1.1.8, 6.2.11.1) reads at the size the sheet draws it. Only the OCP patrol cap and the tactical cap carry a name tape
  // (7.1.1.8: 'only a nametape on the back of the cap is authorized'; 6.2.11.1); 5.1.1.6 (the ABU cap) and 6.2.10 (the
  // boonie hat) name none and the sheets draw none on those backs, so their backs show no tape. The ABU cap (5.1.1.6), the OCP patrol
  // cap (7.1.1.8) and the Blue Field Cap, a 'patrol cap design' (6.2.9.1, 5.2.1.2.3), are the patrol cap; the navy
  // tactical cap (ICL 25-02 6.2.11) and the OCP ball cap are the tactical one. The member's grade and last name are
  // placed on the views where they now are (ctx.landmarkShift).
  const HAT_VIEWS = [
    { group: 'hat-patrol-front', rect: 'patrol_cap_front', follow: ['patrol_cap_front_insignia_zone'] },
    { group: 'hat-patrol-back', rect: 'patrol_cap_back', with: ['hat-patrol-back-name-tape'], follow: ['patrol_cap_back_name_tape'] },
    { group: 'hat-ball-front', rect: 'baseball_cap_front', follow: ['baseball_cap_front_insignia_zone'], pad: 0.75 },
    { group: 'hat-ball-back', rect: 'baseball_cap_back', with: ['hat-ball-back-name-tape'], follow: ['baseball_cap_back_name_tape'] },
    { group: 'hat-boonie-front', rect: 'boonie_hat_front', follow: ['boonie_hat_front_insignia_zone'] },
    { group: 'hat-boonie-back', rect: 'boonie_hat_back' },
    { group: 'hat-beret-nbb-front', rect: 'beret_nbb_front', follow: ['beret_nbb_front_device', 'beret_nbb_front_headband'] }
  ];
  // The caps a member can wear: the views that make one, the grade zone on its front and its back name tape landmark.
  const HEADGEAR = {
    patrol: { front: 'hat-patrol-front', back: 'hat-patrol-back', zone: 'patrol_cap_front_insignia_zone', tape: 'patrol_cap_back_name_tape' },
    tactical: { front: 'hat-ball-front', back: 'hat-ball-back', zone: 'baseball_cap_front_insignia_zone', tape: 'baseball_cap_back_name_tape' },
    boonie: { front: 'hat-boonie-front', back: 'hat-boonie-back', zone: 'boonie_hat_front_insignia_zone', tape: null },
    // LIVE13 E83 (Ethan: "for the OCPs add the national blue beret as headgear"). CAPR 39-1 ICL 25-02 9.2.3: "Graduates of this program may wear the
    // blue beret granted per the activity's procedures with the USAF style ABU/OCP and the CAP corporate field uniform at the unit level. Berets will
    // not be worn at wing, region, or national activities other than NBB." 6.2.3: the headband "straight across the forehead, one inch above the
    // eyebrows", the top draped over the right ear, the Blue Beret device in place of the cap device (no grade). One view, the front, drawn on the
    // OCP sheet (hat-beret-nbb-front, measured on the 2024 NBB group photo); the ABU and CFU sheets draw no beret, so they take the OCP sheet's
    // (`source`): the beret is the same navy beret on every one of the three.
    beret: { front: 'hat-beret-nbb-front', back: null, zone: null, tape: null, source: 'garment-ocp-coat-abu-cut', headband: 'beret_nbb_front_headband' }
  };
  const HAT_SEAT = 0.25, COLLAR_BACK_TOP_ABOVE_APEX = 5.635, BACK_VIEW_SCALE = 1, BACK_VIEW_GAP = 0.5;
  // The cap a build wears: 'tactical' and (CFU only, 5.2.1.2) 'boonie' by choice, else the patrol cap; null with 'none'.
  function headgearChoice(b){
    const v = b.opt.headgear;
    if(v === 'none') return null;
    if(v === 'tactical') return 'tactical';
    if(v === 'boonie' && b.uniform === 'corporate_field') return 'boonie';
    if(v === 'beret') return 'beret';
    return 'patrol';
  }
  async function hatViews(ctx, b, garmentId){
    const spec = await ctx.spec(garmentId);
    const views = HAT_VIEWS.map(v => Object.assign({ box: core.landmarkBounds(spec, v.rect) }, v)).filter(v => v.box);
    // Every cap view the sheet draws is hidden; the one worn is drawn again where it is worn.
    const hide = views.flatMap(v => [v.group, ...(v.with || [])]);
    const worn = headgearChoice(b);
    const caps = worn && HEADGEAR[worn];
    // A cap another sheet draws (the beret on the ABU and CFU): its view comes from that sheet.
    const source = caps && caps.source && caps.source !== garmentId && !views.some(v => v.group === caps.front) && ctx.has(caps.source) ? await ctx.spec(caps.source) : null;
    if(source) views.push(...HAT_VIEWS.filter(v => v.group === caps.front).map(v => Object.assign({ box: core.landmarkBounds(source, v.rect), spec: source }, v)).filter(v => v.box));
    const front = caps && views.find(v => v.group === caps.front);
    // The back view is drawn only when the cap carries something there: its name tape, where the regulation puts one (OCP patrol and tactical
    // caps 7.1.1.8; the navy blue tactical cap with the ABU and CFU, ICL 25-02 6.2.11.1) and the sheet draws it, and the member shows a name
    // (LIVE13 E81, Ethan: "no need to show the back when no name is required"). The ABU cap (5.1.1.6), the Blue Field Cap (6.2.9) and the
    // boonie hat (5.2.1.2.3) name nothing on the back, so they are drawn front only.
    const tape = caps && caps.tape && core.landmarkBounds(spec, caps.tape) && b.name && b.name.show && b.name.last ? caps.tape : null;
    const back = tape ? views.find(v => v.group === caps.back) : null;
    return { hide, choice: front ? Object.assign({}, caps, { tape: back ? tape : null }) : null, place(){
      if(!front) return;
      ctx.landmarkShift = ctx.landmarkShift || {};
      const put = (v, dx, dy, z, role, k) => {
        const sp = v.spec || spec;
        const layer = Object.assign(core.registerAtOrigin(sp, z, role), { key: `${role}:${v.group}`, x: dx, y: dy, w: sp.w * k, h: sp.h * k, origin: { x: dx, y: dy }, onlyGroups: [v.group, ...(v.with || [])], noBounds: true, className: role });
        // The view's own extent, not the whole sheet's, is what the overlay keeps clear of and what the scene box takes.
        const pad = v.pad || 0.1, box = { x: v.box.x * k + dx, y: v.box.y * k + dy, w: v.box.w * k, h: v.box.h * k };
        layer.obstacle = { x: box.x - pad, y: box.y - pad, w: box.w + 2 * pad, h: box.h + 2 * pad };
        ctx.layers.push(layer);
        ctx.layers.push({ type: 'rect', x: box.x - pad, y: box.y - pad, w: box.w + 2 * pad, h: box.h + 2 * pad, rotate: 0, origin: { x: box.x, y: box.y }, z: 0, role: 'hat-view-bounds', key: `hat-view-bounds:${v.group}`, fill: 'none' });
        for(const n of [v.rect, ...(v.follow || [])]) ctx.landmarkShift[n] = { dx, dy, k };
        v.shift = { dx, dy, k, box };
      };
      const attach = ctx.point('hat_attach'), apex = ctx.point('collar_apex'), top = ctx.point('top_center');
      if(!top || !(attach || apex)) return;
      const seatY = (attach ? attach.y : apex.y - COLLAR_BACK_TOP_ABOVE_APEX) + HAT_SEAT;
      if(caps.headband){
        // The beret's headband on the head line the patrol cap's band sits on: the patrol cap front's box is seated at seatY with its bill,
        // so its band (the crown's bottom, the line around the head, 7.1.1.8) is the bill's height above that, the front box less the back's
        // (the back is the crown alone, see below). The headband is centred on the figure; the drape hangs below it over the right ear.
        const pf = core.landmarkBounds(spec, 'patrol_cap_front'), pb = core.landmarkBounds(spec, 'patrol_cap_back');
        const headLine = seatY - (pf && pb ? pf.h - pb.h : 0);
        const band = core.landmarkBounds(front.spec || spec, caps.headband);
        if(band){ put(front, top.x - (band.x + band.w / 2), headLine - (band.y + band.h), Z.hat, 'hat', 1); return; }
      }
      put(front, top.x - (front.box.x + front.box.w / 2), seatY - (front.box.y + front.box.h), Z.hat, 'hat', 1);
      // The back view: beside the front, on the picture's right of it, at the front's size. The sheets draw each back as the front's crown
      // without its bill (the same outline path, at the top of each view's box: patrol cap crown 3.9 in, tactical 4.7 in, the bill below that
      // on the front only), so the two boxes' tops are set level and the crowns then match top and bottom (LIVE13 E81, Ethan: "for all
      // utilities its really irking me that the hats arent aligned"). Setting the boxes' bottoms level, as before, put the back's bottom on
      // the front's bill, 1.1 in (patrol) to 1.9 in (tactical) below the front's crown.
      if(back){
        const f = front.shift.box, k = BACK_VIEW_SCALE;
        put(back, f.x + f.w + BACK_VIEW_GAP - back.box.x * k, f.y - back.box.y * k, Z.garmentLayer, 'hat-view', k);
      }
    } };
  }

  async function composeFieldUniform(ctx, b){
    // Cadet Airman Basic wears no device and no blue material on the OCP (7.1.1.2.2).
    const bare = b.uniform === 'ocp' && b.grade.category === 'cadet-basic';
    const hats = await hatViews(ctx, b, GARMENT[b.uniform]);
    const hide = [...(bare ? ['rank-square'] : []), ...hats.hide];
    await ctx.garment(GARMENT[b.uniform], hide.length ? { hideGroups: hide } : null);
    ctx.headgear = hats.choice;
    hats.place();
    if(headgearChoice(b) === 'beret') ctx.note('The National Blue Beret is worn by its graduates at the unit level, not at wing, region or national activities other than NBB (CAPR 39-1, 9.2.3 as changed by ICL 25-02); it carries the Blue Beret device and no grade (6.2.3)');
    nameTapes(ctx, b);
    if(b.uniform === 'ocp') await ocpGrade(ctx, b);
    else await collarGrade(ctx, b);
    const beforeBadges = ctx.layers.length;
    await fieldBadges(ctx, b);
    // The 1/8 in of blue left past the embroidery, shown once, on the highest chest badge (7.1.1.3.1, 5.1.1.1.2.4, 5.2.1.1.2.6).
    const chest = ctx.layers.slice(beforeBadges).filter(l => l.role === 'badge' && l.type === 'asset');
    if(chest.length) await H.blueBorder(ctx, chest.reduce((a, l) => (l.y < a.y ? l : a)));
    await fieldCommand(ctx, b);
    await fieldPatches(ctx, b);
    // The collar leaves and lapels over the badges, command pin and patches that reach them (the OCP coat has the same group).
    ctx.foreground(['collar-front'], Z_COLLAR_FRONT);
  }

  P.register('ocp', { title: 'OCP Uniform', compose: composeFieldUniform });
  P.register('abu', { title: 'Airman Battle Uniform', compose: composeFieldUniform });
  P.register('corporate_field', { title: 'Corporate Field Uniform', compose: composeFieldUniform });
});
