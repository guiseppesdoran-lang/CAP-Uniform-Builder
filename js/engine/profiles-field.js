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
    for(const lm of ['name_tape', 'patrol_cap_back_name_tape', 'baseball_cap_back_name_tape']){
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
    for(const [name, mode] of zones){
      const z = ctx.rect(name);
      if(!z) continue;
      // The navy tactical cap of the ABU and CFU: 6.2.11.1 (ICL 25-02), the paragraph written for that
      // cap, has NCOs and cadets wear no insignia on its front (only the nametape on the back), and the
      // front must carry no Velcro or other items; the parent paragraph 6.2.11 repeats the ABU cap text
      // and names cadet officers, so the ICL is not consistent with itself: the specific paragraph wins
      // for this cap, and the cadet officer keeps the grade on the ABU patrol cap (5.1.1.6). The OCP's
      // ball cap is covered by 7.1.1.8, which names cadet officers.
      if(name === 'baseball_cap_front_insignia_zone' && g.cadet && b.uniform !== 'ocp'){
        ctx.note('Cadets wear no insignia on the front of the navy blue tactical cap, only the nametape on the back (CAPR 39-1 ICL 25-02, 6.2.11.1)');
        continue;
      }
      // "1/2 inch from the visor": the zone's bottom edge already sits 1/2 in above the visor.
      const at = mode === 'visor' ? { x: z.x + z.w / 2, y: z.y + z.h } : core.rectCenter(z);
      // On the cap seated on the figure the grade lies over the hat (R6).
      const seated = ctx.landmarkShift && ctx.landmarkShift.patrol_cap_front && name === 'patrol_cap_front_insignia_zone';
      await ctx.place(id, { pieceAnchor: mode === 'visor' ? 'bottom_center' : 'center', at, z: seated ? Z.hatDevice : Z.insignia, role: 'grade', key: 'grade:' + name });
      if(mode === 'visor') ctx.measure({ x: at.x, y: at.y + 0.5 }, at);
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
    ocpSquareMeasures(ctx, b);
    await capGrade(ctx, b);
  }

  // The measurement overlay for the chest square: its 2 in size (7.1.1.2.1, 7.1.1.2.2) and where it
  // sits on the placket: from the point where the collar meets the zipper (the garment's collar_apex)
  // down to the square's top. The regulation says only "in the center of the chest", so that distance
  // is the sheet's own and is shown as approximate.
  function ocpSquareMeasures(ctx, b){
    if(b.grade.category === 'cadet-basic') return;
    const sq = ctx.rect('rank_square'), apex = ctx.point('collar_apex');
    if(!sq) return;
    ctx.measure({ x: sq.x, y: sq.y }, { x: sq.x + sq.w, y: sq.y });
    ctx.measure({ x: sq.x + sq.w, y: sq.y }, { x: sq.x + sq.w, y: sq.y + sq.h });
    if(apex){
      ctx.measure(apex, { x: apex.x, y: sq.y }, `about ${Math.round((sq.y - apex.y) * 10) / 10} in`, { offsetOnly: true, side: { x: -1, y: 0 } });
    }
  }

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
  const EDGE_SX = 0.5;

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
  // The sheets give a slot per side and kind: its centre (0.01 in) and the turn, clockwise, for an
  // insignia whose long axis is upright. Cadet NCO chevrons follow Figure A5-5 like the shirts' (parallel
  // to the leaf's leading edge, 1 in from it, H.collarChevrons); cadet officers' row runs along the
  // leaf's front edge, 1 in from it, centred (H.collarOfficerRow); officers' grade sits 1 in from the bottom of the collar, square to its edge.
  // The cloth border around every insignia is 1/8 in on each side (R5).
  const CLOTH_BORDER = 0.125;
  async function collarGrade(ctx, b){
    const g = b.grade;
    const slots = ctx.base && ctx.base.raw && ctx.base.raw.collar_slots;
    for(const side of ['right', 'left']){
      const R = side === 'right';
      const slot = kind => {
        const s = slots && slots[side] && slots[side][kind];
        return s ? { at: { x: s.center[0] / 100, y: s.center[1] / 100 }, deg: s.angle_deg } : null;
      };
      if(g.category === 'cadet-nco'){
        // The shirts' rule, Figure A5-5 (H.collarChevrons, from the sheet's collar leaf polygon); drawn once, for both leaves.
        if(side === 'right') await H.collarChevrons(ctx, g, { z: Z_COLLAR_GRADE });
      }else if(g.category === 'cadet-officer'){
        // 'One inch from the front of the collar and centered' (5.1.1.1.1.3, 5.2.1.1.1.4): the row parallel to the leaf's front edge, its near outline 1 in
        // from it, centred on the leaf (H.collarOfficerRow, from the sheet's collar_left / collar_right polygons); drawn once, for both leaves.
        if(side === 'right') await H.collarOfficerRow(ctx, g, { z: Z_COLLAR_GRADE });
      }else if(g.officer && !g.cadet){
        const s = slot('officer');
        if(!s) continue;
        const id = G.seniorOfficerInsignia(g, 'cloth-bordered', { horizontal: false });
        // Major and Lt Col: stem parallel to the ground, pointing away from the neck. Colonel: beak
        // facing forward on both collars.
        let rotate = s.deg;
        if(g.key === 'major' || g.key === 'lieutenant-colonel') rotate = R ? 90 : -90;
        // "Centered 1 inch from the bottom of the collar" (5.1.1.1.1.1, 5.2.1.1.1.1): from the free
        // edge, straight to the centre. General officers' grade is 'centered, perpendicular to, and begins 1 inch from
        // the bottom of the collar': the bottom of the lowest star's silver (1/8 in inside the cloth) lies 1 in up the
        // perpendicular from the free edge, on the slot's line along the edge, so the stars' own centre is higher
        // than the colonel's by half the cloth's height less the border.
        const edge = slots && slots[side] && slots[side].bottom_edge;
        let at = s.at, from = null, to = null;
        if(edge){
          const a = { x: edge.p1[0] / 100, y: edge.p1[1] / 100 }, d = { x: (edge.p2[0] - edge.p1[0]) / 100, y: (edge.p2[1] - edge.p1[1]) / 100 };
          const len2 = d.x * d.x + d.y * d.y;
          const t = ((s.at.x - a.x) * d.x + (s.at.y - a.y) * d.y) / len2;
          const foot = { x: a.x + t * d.x, y: a.y + t * d.y };
          from = foot; to = s.at;
          if(g.general){
            const len = Math.sqrt(len2);
            let n = { x: -d.y / len, y: d.x / len };
            if((s.at.x - foot.x) * n.x + (s.at.y - foot.y) * n.y < 0) n = { x: -n.x, y: -n.y };
            const gs = await ctx.spec(id);
            const up = 1 + gs.h / 2 - CLOTH_BORDER;
            at = { x: foot.x + n.x * up, y: foot.y + n.y * up };
            to = { x: foot.x + n.x, y: foot.y + n.y };
          }
        }
        await ctx.place(id, { pieceAnchor: 'center', at, rotate, flipX: g.key === 'colonel' && R, z: Z_COLLAR_GRADE, role: 'grade', key: 'grade:' + side });
        if(from) ctx.measure(from, to);
      }
    }
    if(g.category === 'senior-nco'){
      const id = G.seniorChevron(g, { size: b.opt.chevron });
      let drawn = 0;
      for(const side of ['right', 'left']){
        const z = ctx.rect('chevron_zone_' + side);
        if(z){
          const l = await ctx.place(id, { pieceAnchor: 'center', at: core.rectCenter(z), z: Z.insignia, role: 'grade', key: 'grade:sleeve-' + side });
          // 4 in or 3 1/2 in chevron (5.1.1.1.1.2, 5.2.1.1.1.3).
          if(l) ctx.measure({ x: l.x, y: l.y + l.h }, { x: l.x + l.w, y: l.y + l.h });
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
      ctx.measure({ x: T.x, y: T.y }, { x: T.x, y: T.y - 0.5 });
      if(list.length === 2 && b.uniform === 'ocp'){
        // The OCP rule says badge placement is measured from the blue fabric edges (7.1.1.3.1), and the
        // second badge goes 1/2 in above the first (7.1.1.3.1.2); the three and four badge columns of
        // 7.1.1.3.1.3-4 measure the same way, at 1/4 in. Only the single badge is placed to the silver
        // (7.1.1.3.1.1). So the upper badge's blue bottom edge is 1/2 in above the lower one's blue top.
        await ctx.place(list[0].art, Object.assign({ pieceAnchor: 'bottom_center', at: { x: T.x, y: l1.y - 0.5 } }, opts(0)));
        ctx.measure({ x: T.x, y: l1.y }, { x: T.x, y: l1.y - 0.5 });
      }else if(list.length === 2){
        // ABU and CFU: silver to silver (5.1.1.1.2.4; 5.2.1.1.2.6 'insignia-to-insignia, not blue to blue').
        const silverTop = l1.y + artTopOffset(specs[1]);
        await ctx.place(list[0].art, Object.assign({ pieceAnchor: artBottom(specs[0]), at: { x: T.x, y: silverTop - 0.5 } }, opts(0)));
        ctx.measure({ x: T.x, y: silverTop }, { x: T.x, y: silverTop - 0.5 });
      }
      return;
    }
    // Three or four: measured from the blue edges, the bottom row 1/8 in above the tape, 1/2 in
    // between badges side by side, 1/4 in between rows (7.1.1.3.1.3-4).
    const gapX = 0.5, rowGap = 0.25, base = T.y - 0.125;
    ctx.measure({ x: T.x, y: T.y }, { x: T.x, y: base }, '⅛ in');
    if(list.length === 3){
      const w2 = specs[1].w, w3 = specs[2].w, W = w2 + gapX + w3;
      const a = await ctx.place(list[1].art, Object.assign({ pieceAnchor: 'bottom_center', at: { x: T.x - W / 2 + w2 / 2, y: base } }, opts(1)));
      const c = await ctx.place(list[2].art, Object.assign({ pieceAnchor: 'bottom_center', at: { x: T.x + W / 2 - w3 / 2, y: base } }, opts(2)));
      const rowTop = Math.min(a.y, c.y);
      const up = await ctx.place(list[0].art, Object.assign({ pieceAnchor: 'bottom_center', at: { x: T.x, y: rowTop - rowGap } }, opts(0)));
      // 1/2 in between the two side by side, 1/4 in from them to the third (7.1.1.3.1.3).
      ctx.measure({ x: a.x + a.w, y: base - 0.3 }, { x: c.x, y: base - 0.3 });
      if(up) ctx.measure({ x: T.x, y: up.y + up.h }, { x: T.x, y: rowTop });
      return;
    }
    // Four: two columns of two, precedence top row first, viewer's left first.
    const colL = Math.max(specs[0].w, specs[2].w), colR = Math.max(specs[1].w, specs[3].w);
    const W = colL + gapX + colR;
    const xL = T.x - W / 2 + colL / 2, xR = T.x + W / 2 - colR / 2;
    const b3 = await ctx.place(list[2].art, Object.assign({ pieceAnchor: 'bottom_center', at: { x: xL, y: base } }, opts(2)));
    const b4 = await ctx.place(list[3].art, Object.assign({ pieceAnchor: 'bottom_center', at: { x: xR, y: base } }, opts(3)));
    const topY = Math.min(b3.y, b4.y) - rowGap;
    ctx.measure({ x: xL + colL / 2, y: base }, { x: xL + colL / 2 + gapX, y: base });
    ctx.measure({ x: xL, y: Math.min(b3.y, b4.y) }, { x: xL, y: topY });
    await ctx.place(list[0].art, Object.assign({ pieceAnchor: 'bottom_center', at: { x: xL, y: topY } }, opts(0)));
    await ctx.place(list[1].art, Object.assign({ pieceAnchor: 'bottom_center', at: { x: xR, y: topY } }, opts(1)));
    ctx.measure({ x: xR, y: Math.min(b3.y, b4.y) }, { x: xR, y: topY });
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
      if(await ctx.place(pin.art, Object.assign({ pieceAnchor: 'bottom_center', at: { x: tx, y: tape.y - 0.5 } }, o))) ctx.measure({ x: tx, y: tape.y }, { x: tx, y: tape.y - 0.5 });
      return;
    }
    if(b.uniform === 'ocp') await ocpSleevePin(ctx, pin, o);
    else if(b.uniform === 'abu'){
      if(await ctx.place(pin.art, Object.assign({ pieceAnchor: 'top_center', at: { x: tx, y: tape.y + tape.h + 0.5 } }, o))) ctx.measure({ x: tx, y: tape.y + tape.h }, { x: tx, y: tape.y + tape.h + 0.5 });
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
    // Centred on the loop that shows: the same margin above and below the patch.
    if(flat){
      const cx = flat.x + flat.w / 2;
      ctx.measure({ x: cx, y: loop.y }, { x: cx, y: flat.y });
      ctx.measure({ x: cx, y: flat.y + flat.h }, { x: cx, y: loop.y + loop.h });
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

  // Overlay: the patch's width, and the gaps above and below it that centre it under the flag or AUX
  // patch on the Velcro (7.1.1.4.1.2).
  function measureSleevePatch(ctx, layer, velcroName, drawnName){
    const v = ctx.rect(velcroName), d = ctx.rect(drawnName);
    if(!layer) return;
    const cx = layer.x + layer.w / 2;
    // The patch's width is drawn below the Velcro it hangs on, not along the patch's bottom edge across its lettering, and the labels keep off the flag or
    // AUX patch the sheet draws (flat and seen edge-on) as they do off the patch (D26).
    ctx.measure({ x: layer.x, y: layer.y + layer.h }, { x: layer.x + layer.w, y: layer.y + layer.h }, null,
      v ? { side: { x: 0, y: 1 }, offsetOnly: true, minOffsetIn: Math.max(0, v.y + v.h - (layer.y + layer.h)) + 0.15 } : null);
    if(d){
      ctx.keepClear(d, drawnName);
      const f = edgeFrame(ctx, velcroName.endsWith('right') ? 'right' : 'left');
      if(f){
        const e = f.map(d), R = f.tilt * Math.PI / 180, c = Math.abs(Math.cos(R)), s = Math.abs(Math.sin(R));
        const w = e.w * c + e.h * s, h = e.w * s + e.h * c;
        ctx.keepClear({ x: e.center.x - w / 2, y: e.center.y - h / 2, w, h }, drawnName + '-seen-edge-on');
      }
    }
    if(v && d){
      ctx.measure({ x: cx, y: d.y + d.h }, { x: cx, y: layer.y });
      ctx.measure({ x: cx, y: layer.y + layer.h }, { x: cx, y: v.y + v.h });
    }
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
        if(z) measureSleevePatch(ctx, sleevePatch(ctx, unit, z, 'R_SHOULDER', 'right'), 'sleeve_flap_velcro_right', 'patch_flag_right');
      }
      const hhq = take(p => p.slot === 'L_SHOULDER') || take(() => true);
      if(hhq){
        const z = belowOnVelcro(ctx, 'sleeve_flap_velcro_left', 'patch_aux_left');
        if(z) measureSleevePatch(ctx, sleevePatch(ctx, hhq, z, 'L_SHOULDER', 'left'), 'sleeve_flap_velcro_left', 'patch_aux_left');
      }
    }else{
      const widthOf = layer => { if(layer) ctx.measure({ x: layer.x, y: layer.y + layer.h }, { x: layer.x + layer.w, y: layer.y + layer.h }); };
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
        widthOf(layer);
        // And edge-on on the figure's arm.
        const e = layer && armEdgeOf(ctx, side, layer);
        if(e) ctx.raster({ href: patch.href, x: e.at.x - e.w / 2, y: e.at.y - e.h / 2, w: e.w, h: e.h, rotate: e.rotate, origin: e.at, fit: 'stretch', clipSil: ctx.base.id, z: Z.patch, role: 'patch', key: `patch:${patch.id}:${slot}:edge`, title: patch.title, className: 'patch' });
        const seam = ctx.point('seam_top_center_' + side);
        if(layer && seam) ctx.measure({ x: layer.x + layer.w / 2, y: seam.y }, { x: layer.x + layer.w / 2, y: layer.y });
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
        if(p && z){ widthOf(fitPatch(ctx, p, z, want)); used++; }
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
        ctx.measure({ x: tape.x + tape.w / 2, y: above }, { x: tape.x + tape.w / 2, y });
      }
    }
    if(patches.length) ctx.note('Some selected patches have no place left on this uniform and are not shown');
  }

  // ---- headgear: the patrol cap on the figure, the other cap views above it ----
  // The coat sheets draw the caps as views in the top margin (patrol cap front and back, tactical / baseball cap
  // front and back, the CFU's boonie hat): groups of the sheet, each with its own landmarks. R6 wants the hat on top
  // of the figure, so the primary cap, the ABU cap (5.1.1.6, the only authorized headgear with the ABU), the OCP
  // patrol cap (7.1.1.8) and the Blue Field Cap, which is a 'patrol cap design' (6.2.9.1, 5.2.1.2.3), is the sheet's
  // patrol cap front view carried onto the collar: its bottom centre on the collar's back top (the sheet's
  // hat_attach anchor when it has one, else the apex of its collar-back curve, 5.635 in above collar_apex, measured
  // on the three sheets) lowered by HAT_SEAT (the seat the dress caps use, an estimate: the regulation shows no
  // seating). The other views stay as views of the accessory caps, lifted in rows above the seated cap so that none
  // lies over it. The member's grade and last name are placed on the views where they now are (ctx.landmarkShift).
  const HAT_VIEWS = [
    { group: 'hat-patrol-front', rect: 'patrol_cap_front', follow: ['patrol_cap_front_insignia_zone'] },
    { group: 'hat-patrol-back', rect: 'patrol_cap_back', with: ['hat-patrol-back-name-tape'], follow: ['patrol_cap_back_name_tape'] },
    { group: 'hat-ball-front', rect: 'baseball_cap_front', follow: ['baseball_cap_front_insignia_zone'], pad: 0.75 },
    { group: 'hat-ball-back', rect: 'baseball_cap_back', with: ['hat-ball-back-name-tape'], follow: ['baseball_cap_back_name_tape'] },
    { group: 'hat-boonie-front', rect: 'boonie_hat_front', follow: ['boonie_hat_front_insignia_zone'] },
    { group: 'hat-boonie-back', rect: 'boonie_hat_back' }
  ];
  const HAT_SEAT = 0.25, COLLAR_BACK_TOP_ABOVE_APEX = 5.635, VIEW_ROW_GAP = 0.5;
  async function hatViews(ctx, b, garmentId){
    if(b.opt.headgear === 'none') return { hide: [], place(){} };
    const spec = await ctx.spec(garmentId);
    const find = name => { const r = core.landmarkBounds(spec, name); return r; };
    const views = HAT_VIEWS.map(v => Object.assign({ box: find(v.rect) }, v)).filter(v => v.box);
    const hide = views.flatMap(v => [v.group, ...(v.with || [])]);
    return { hide, place(){
      ctx.landmarkShift = ctx.landmarkShift || {};
      const put = (v, dx, dy, z, role) => {
        const layer = Object.assign(core.registerAtOrigin(spec, z, role), { key: `${role}:${v.group}`, x: dx, y: dy, origin: { x: dx, y: dy }, onlyGroups: [v.group, ...(v.with || [])], noBounds: true, className: role });
        // The view's own extent, not the whole sheet's, is what the overlay keeps clear of and what the scene box takes.
        const pad = v.pad || 0.1;
        layer.obstacle = { x: v.box.x + dx - pad, y: v.box.y + dy - pad, w: v.box.w + 2 * pad, h: v.box.h + 2 * pad };
        ctx.layers.push(layer);
        ctx.layers.push({ type: 'rect', x: v.box.x + dx - pad, y: v.box.y + dy - pad, w: v.box.w + 2 * pad, h: v.box.h + 2 * pad, rotate: 0, origin: { x: v.box.x + dx, y: v.box.y + dy }, z: 0, role: 'hat-view-bounds', key: `hat-view-bounds:${v.group}`, fill: 'none' });
        for(const n of [v.rect, ...(v.follow || [])]) ctx.landmarkShift[n] = { dx, dy };
        v.shift = { dx, dy };
      };
      const primary = views.find(v => v.group === 'hat-patrol-front');
      let capTop = null;
      const attach = ctx.point('hat_attach'), apex = ctx.point('collar_apex'), top = ctx.point('top_center');
      if(primary && top && (attach || apex)){
        const seatY = (attach ? attach.y : apex.y - COLLAR_BACK_TOP_ABOVE_APEX) + HAT_SEAT;
        const dx = top.x - (primary.box.x + primary.box.w / 2), dy = seatY - (primary.box.y + primary.box.h);
        put(primary, dx, dy, Z.hat, 'hat');
        capTop = primary.box.y + dy;
      }
      // The other views: rows (views whose heights overlap on the sheet), the lowest first, each lifted just enough
      // for its bottom to clear the ceiling, which starts 1/2 in above the seated cap and rises with every row.
      const rest = views.filter(v => !v.shift).sort((a, b2) => (b2.box.y + b2.box.h) - (a.box.y + a.box.h));
      const rows = [];
      for(const v of rest){
        const row = rows.find(r => v.box.y < r.bottom && v.box.y + v.box.h > r.top);
        if(row){ row.views.push(v); row.top = Math.min(row.top, v.box.y); row.bottom = Math.max(row.bottom, v.box.y + v.box.h); }
        else rows.push({ views: [v], top: v.box.y, bottom: v.box.y + v.box.h });
      }
      let ceiling = capTop == null ? Infinity : capTop - VIEW_ROW_GAP;
      for(const row of rows.sort((a, b2) => b2.bottom - a.bottom)){
        const lift = Math.max(0, row.bottom - ceiling);
        for(const v of row.views) put(v, 0, -lift, Z.garmentLayer, 'hat-view');
        ceiling = row.top - lift - VIEW_ROW_GAP;
      }
    } };
  }

  async function composeFieldUniform(ctx, b){
    // Cadet Airman Basic wears no device and no blue material on the OCP (7.1.1.2.2).
    const bare = b.uniform === 'ocp' && b.grade.category === 'cadet-basic';
    const hats = await hatViews(ctx, b, GARMENT[b.uniform]);
    const hide = [...(bare ? ['rank-square'] : []), ...hats.hide];
    await ctx.garment(GARMENT[b.uniform], hide.length ? { hideGroups: hide } : null);
    hats.place();
    nameTapes(ctx, b);
    if(b.uniform === 'ocp') await ocpGrade(ctx, b);
    else await collarGrade(ctx, b);
    await fieldBadges(ctx, b);
    await fieldCommand(ctx, b);
    await fieldPatches(ctx, b);
    // The collar leaves and lapels over the badges, command pin and patches that reach them (the OCP coat has the same group).
    ctx.foreground(['collar-front'], Z_COLLAR_FRONT);
  }

  P.register('ocp', { title: 'OCP Uniform', compose: composeFieldUniform });
  P.register('abu', { title: 'Airman Battle Uniform', compose: composeFieldUniform });
  P.register('corporate_field', { title: 'Corporate Field Uniform', compose: composeFieldUniform });
});
