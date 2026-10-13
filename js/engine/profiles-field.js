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
  // Collar edge angles measured from the ABU/CFU leaf paths (the two coats share the collar).
  const COLLAR = { frontRight: -36.9, frontLeft: 35.9, bottomRight: 12.7, bottomLeft: -14.6 };

  // Last name on the coat's name tape and on any cap back tape the sheet draws: light silver block
  // capitals, as tall as the drawn CAP tape lettering (7.1.1.2.3, 5.1.1.1.2.1, 5.2.1.1.2.1, 7.1.1.8).
  function nameTapes(ctx, b){
    if(!b.name.show || !b.name.last) return;
    for(const lm of ['name_tape', 'patrol_cap_back_name_tape', 'baseball_cap_back_name_tape']){
      const r = ctx.rect(lm);
      if(!r) continue;
      const inset = 0.33 * r.h;
      C.nameText(ctx, b.name.last, { x: r.x + inset, y: r.y, w: r.w - 2 * inset, h: r.h }, { color: TAPE_TEXT, maxH: 0.58 * r.h, advance: 0.62, key: 'text:' + lm });
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
      // "1/2 inch from the visor": the zone's bottom edge already sits 1/2 in above the visor.
      const at = mode === 'visor' ? { x: z.x + z.w / 2, y: z.y + z.h } : core.rectCenter(z);
      await ctx.place(id, { pieceAnchor: mode === 'visor' ? 'bottom_center' : 'center', at, z: Z.insignia, role: 'grade', key: 'grade:' + name });
    }
  }

  async function ocpGrade(ctx, b){
    const g = b.grade;
    const at = ctx.point('rank_square_center');
    if(g.category === 'senior-nco'){
      // No senior NCO square artwork exists: the sleeve chevron, scaled into 1 3/4 in on the square.
      const id = G.seniorChevron(g, { size: '3.5' });
      await H.placeFitted(ctx, id, at, 1.75, 1.75, { z: Z.insignia, role: 'grade', key: 'grade:chest' });
      ctx.note('Senior NCO grade on the OCP square is drawn from the sleeve chevron (no square artwork yet)');
    }else{
      const id = ocpSquareId(g);
      if(id) await ctx.place(id, { pieceAnchor: 'center', at, z: Z.insignia, role: 'grade', key: 'grade:chest' });
    }
    await capGrade(ctx, b);
  }

  // ABU and CFU: grade on both collars (5.1.1.1.1, 5.2.1.1.1); NCO chevrons on the sleeves.
  async function collarGrade(ctx, b){
    const g = b.grade;
    for(const side of ['right', 'left']){
      const R = side === 'right';
      if(g.category === 'cadet-nco'){
        const z = ctx.rect('collar_cadet_nco_zone_' + side);
        // 1 in from and parallel to the front of the collar: the chevron's axis follows the front edge.
        if(z) await ctx.place(G.cadetNcoChevron(g, 'metal'), { pieceAnchor: 'center', at: core.rectCenter(z), rotate: R ? COLLAR.frontRight : COLLAR.frontLeft, z: Z.insignia, role: 'grade', key: 'grade:' + side });
      }else if(g.category === 'cadet-officer'){
        const z = ctx.rect('collar_cadet_officer_zone_' + side);
        if(z) await ctx.place(G.cadetOfficerInsignia(g, 'cloth-bordered-regular'), { pieceAnchor: 'center', at: core.rectCenter(z), rotate: R ? COLLAR.frontRight : COLLAR.frontLeft, z: Z.insignia, role: 'grade', key: 'grade:' + side });
      }else if(g.officer && !g.cadet){
        const z = ctx.rect('collar_officer_zone_' + side);
        if(!z) continue;
        const id = G.seniorOfficerInsignia(g, 'cloth-bordered', { horizontal: false });
        // 1 in from the bottom of the collar, square to its edge. Major and Lt Col: stem parallel to
        // the ground, pointing away from the neck. Colonel: beak facing forward on both collars.
        let rotate = R ? COLLAR.bottomRight : COLLAR.bottomLeft;
        if(g.key === 'major' || g.key === 'lieutenant-colonel') rotate = R ? 90 : -90;
        await ctx.place(id, { pieceAnchor: 'center', at: core.rectCenter(z), rotate, flipX: g.key === 'colonel' && R, z: Z.insignia, role: 'grade', key: 'grade:' + side });
      }
    }
    if(g.category === 'senior-nco'){
      const id = G.seniorChevron(g, { size: b.opt.chevron });
      let drawn = 0;
      for(const side of ['right', 'left']){
        const z = ctx.rect('chevron_zone_' + side);
        if(z){ await ctx.place(id, { pieceAnchor: 'center', at: core.rectCenter(z), z: Z.insignia, role: 'grade', key: 'grade:sleeve-' + side }); drawn++; }
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
    const ordered = [...set.chaplain, ...set.aviation, ...set.occupational, ...set.specialty, ...set.service, ...set.nationalStaff];
    const max = MAX_BADGES[b.uniform];
    const list = ordered.slice(0, max);
    if(ordered.length > max) ctx.note(`At most ${max} badges are worn above the CAP tape on this uniform; the rest are not shown`);
    if(!list.length) return;
    const T = ctx.point('cap_tape_top_center');
    const specs = [];
    for(const it of list) specs.push(await ctx.spec(it.art));
    const opts = i => ({ z: Z.badge, role: 'badge', key: 'badge:' + list[i].id, title: list[i].title, className: 'badge' });

    if(list.length <= 2){
      // One: 1/2 in from the tape to the silver. Two: the second sits under the first, silver to
      // silver 1/2 in (7.1.1.3.1.1-2, 5.1.1.1.2.4, 5.2.1.1.2.6). The highest badge is on top.
      const lower = list.length === 2 ? 1 : 0;
      const l1 = await ctx.place(list[lower].art, Object.assign({ pieceAnchor: artBottom(specs[lower]), at: { x: T.x, y: T.y - 0.5 } }, opts(lower)));
      if(list.length === 2){
        const silverTop = l1.y + artTopOffset(specs[1]);
        await ctx.place(list[0].art, Object.assign({ pieceAnchor: artBottom(specs[0]), at: { x: T.x, y: silverTop - 0.5 } }, opts(0)));
      }
      return;
    }
    // Three or four: measured from the blue edges, the bottom row 1/8 in above the tape, 1/2 in
    // between badges side by side, 1/4 in between rows (7.1.1.3.1.3-4).
    const gapX = 0.5, rowGap = 0.25, base = T.y - 0.125;
    if(list.length === 3){
      const w2 = specs[1].w, w3 = specs[2].w, W = w2 + gapX + w3;
      const a = await ctx.place(list[1].art, Object.assign({ pieceAnchor: 'bottom_center', at: { x: T.x - W / 2 + w2 / 2, y: base } }, opts(1)));
      const c = await ctx.place(list[2].art, Object.assign({ pieceAnchor: 'bottom_center', at: { x: T.x + W / 2 - w3 / 2, y: base } }, opts(2)));
      await ctx.place(list[0].art, Object.assign({ pieceAnchor: 'bottom_center', at: { x: T.x, y: Math.min(a.y, c.y) - rowGap } }, opts(0)));
      return;
    }
    // Four: two columns of two, precedence top row first, viewer's left first.
    const colL = Math.max(specs[0].w, specs[2].w), colR = Math.max(specs[1].w, specs[3].w);
    const W = colL + gapX + colR;
    const xL = T.x - W / 2 + colL / 2, xR = T.x + W / 2 - colR / 2;
    const b3 = await ctx.place(list[2].art, Object.assign({ pieceAnchor: 'bottom_center', at: { x: xL, y: base } }, opts(2)));
    const b4 = await ctx.place(list[3].art, Object.assign({ pieceAnchor: 'bottom_center', at: { x: xR, y: base } }, opts(3)));
    const topY = Math.min(b3.y, b4.y) - rowGap;
    await ctx.place(list[0].art, Object.assign({ pieceAnchor: 'bottom_center', at: { x: xL, y: topY } }, opts(0)));
    await ctx.place(list[1].art, Object.assign({ pieceAnchor: 'bottom_center', at: { x: xR, y: topY } }, opts(1)));
  }

  // Command insignia: current commanders 1/2 in above the name tape; graduated commanders on the
  // OCP left sleeve tab, the ABU flap 1/2 in below the tape, or the CFU right pocket flap
  // (7.1.1.3.1.7, 5.1.1.1.2.5, 5.2.1.1.2.9). It never counts toward the badge limit.
  async function fieldCommand(ctx, b){
    const pin = H.commandPin(ctx, b, 'field');
    if(!pin) return;
    const tape = ctx.rect('name_tape');
    const o = { z: Z.badge, role: 'badge', key: `badge:${pin.id}:${pin.graduated ? 'UN' : 'ON'}:0`, title: pin.title, className: 'badge' };
    if(!pin.graduated){
      await ctx.place(pin.art, Object.assign({ pieceAnchor: 'bottom_center', at: { x: tape.x + tape.w / 2, y: tape.y - 0.5 } }, o));
      return;
    }
    if(b.uniform === 'ocp'){
      const tab = ctx.rect('glint_tab_left');
      if(tab) await ctx.place(pin.art, Object.assign({ pieceAnchor: 'center', at: core.rectCenter(tab) }, o));
    }else if(b.uniform === 'abu'){
      await ctx.place(pin.art, Object.assign({ pieceAnchor: 'top_center', at: { x: tape.x + tape.w / 2, y: tape.y + tape.h + 0.5 } }, o));
    }else{
      const flap = ctx.rect('chest_flap_right');
      if(flap) await ctx.place(pin.art, Object.assign({ pieceAnchor: 'center', at: core.rectCenter(flap) }, o));
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
    const patches = b.patches || [];
    const take = pred => { const i = patches.findIndex(pred); return i < 0 ? null : patches.splice(i, 1)[0]; };
    if(b.uniform === 'ocp'){
      // Right sleeve: unit patch centred under the drawn flag (7.1.1.4.1.2). Left: HHQ patch under AUX.
      const unit = take(p => p.kind === 'unit' || p.slot === 'R_SHOULDER');
      if(unit){ const z = belowOnVelcro(ctx, 'sleeve_flap_velcro_right', 'patch_flag_right'); if(z) fitPatch(ctx, unit, z, 'R_SHOULDER'); }
      const hhq = take(p => p.slot === 'L_SHOULDER') || take(() => true);
      if(hhq){ const z = belowOnVelcro(ctx, 'sleeve_flap_velcro_left', 'patch_aux_left'); if(z) fitPatch(ctx, hhq, z, 'L_SHOULDER'); }
    }else{
      const left = take(p => p.slot === 'L_SHOULDER');
      const zl = ctx.rect('wing_patch_zone_left');
      if(left && zl) fitPatch(ctx, left, zl, 'L_SHOULDER');
      if(b.uniform === 'corporate_field'){
        const right = take(p => p.slot === 'R_SHOULDER' || p.kind === 'unit');
        const zr = ctx.rect('activity_patch_zone_right');
        if(right && zr) fitPatch(ctx, right, zr, 'R_SHOULDER');
      }
      // Breast pocket patches: one in all on the ABU (5.1.1.1.2.3), one per pocket on the CFU.
      const pockets = b.uniform === 'abu' ? 1 : 2;
      let used = 0;
      for(const side of ['right', 'left']){
        if(used >= pockets) break;
        const want = side === 'right' ? 'CHEST_RIGHT' : 'CHEST_LEFT';
        const p = take(x => x.slot === want) || take(x => x.slot === 'CHEST_LEFT' || x.slot === 'CHEST_RIGHT');
        const z = pocketZone(ctx, side);
        if(p && z){ fitPatch(ctx, p, z, want); used++; }
      }
      if(b.uniform === 'corporate_field' && b.opt.esPatch && b.opt.esPatch !== 'none'){
        // ES patch 1/2 in above the name tape (above the command insignia if worn), 5.2.1.1.2.8.
        const tape = ctx.rect('name_tape');
        const id = b.opt.esPatch === 'style-2' ? 'patch-es-style-2' : 'patch-es-style-1';
        const pin = b.command && !b.command.graduated;
        const y = tape.y - 0.5 - (pin ? 1.5 : 0);
        const s = await ctx.spec(id);
        const scale = Math.min(1, 3 / s.w, 3 / s.h);
        await ctx.place(id, { pieceAnchor: 'bottom_center', at: { x: tape.x + tape.w / 2, y }, scale, z: Z.patch, role: 'patch', key: 'patch:' + id, title: 'Emergency Services patch' });
      }
    }
    if(patches.length) ctx.note('Some selected patches have no place left on this uniform and are not shown');
  }

  async function composeFieldUniform(ctx, b){
    await ctx.garment(GARMENT[b.uniform]);
    nameTapes(ctx, b);
    if(b.uniform === 'ocp') await ocpGrade(ctx, b);
    else await collarGrade(ctx, b);
    await fieldBadges(ctx, b);
    await fieldCommand(ctx, b);
    await fieldPatches(ctx, b);
  }

  P.register('ocp', { title: 'OCP Uniform', compose: composeFieldUniform });
  P.register('abu', { title: 'Airman Battle Uniform', compose: composeFieldUniform });
  P.register('corporate_field', { title: 'Corporate Field Uniform', compose: composeFieldUniform });
});
