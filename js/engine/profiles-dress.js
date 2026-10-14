// Dress and service uniforms: the USAF-style blues (Class A, Class B, cadet semi-formal, mess dress,
// CAPR 39-1 4.1) and the corporate dress uniforms (aviator shirt, Corporate Service Dress blazer,
// Corporate Semi-Formal, 4.2). They share the badge and ribbon rules of chapters 10 and 11, so one
// badge layout serves all of them; each profile only says where its slots are.
(function(root, factory){
  const node = typeof module === 'object' && module.exports;
  const deps = node
    ? { core: require('./core.js'), C: require('./compose.js'), G: require('./grades.js'), P: require('./profiles.js'), B: require('../../data/badge-catalog.js') }
    : { core: root.CAPUBEngine.core, C: root.CAPUBEngine.compose, G: root.CAPUBEngine.grades, P: root.CAPUBEngine.profiles, B: root.CAPUBBadgeCatalog };
  factory(deps.core, deps.C, deps.G, deps.P, deps.B);
})(typeof self !== 'undefined' ? self : this, function(core, C, G, P, B){
  'use strict';
  const Z = C.Z;
  const H = P.helpers;
  const PLATE_WHITE = '#f4f6f8';
  const ENGRAVED_BLUE = '#1f2f5c';
  const LAPEL_Z = Z.badge + 0.6;
  const SERVICE_IDS = new Set(['senior_advisory_group_badge', 'national_executive_committee_badge', 'command_council_badge', 'cap_national_command_board_badge']);

  // ---- who wears what ---------------------------------------------------------------------

  function isOfficerLike(g){ return (g.officer && !g.cadet) || (g.category === 'senior-none' && g.track === 'officer'); }

  // ---- badges -------------------------------------------------------------------------------

  // Sort the member's badges into the Attachment 4 positions. `slots` says which positions the
  // uniform has: olp (stack), lp, rp, on (one, or a pair for women), un. Returns the plan.
  function planBadges(ctx, b, opts){
    const set = H.badgeSet(ctx, b, 'dress');
    const o = opts || {};
    // Over the left pocket, bottom first: occupational under aviation, chaplain always on top.
    const olpAll = [...set.occupational, ...set.aviation, ...set.chaplain];
    const military = (b.militaryBadges || []).map(m => ({ id: m.id, raster: m.href, title: m.title, family: 'military' }));
    let olp = olpAll;
    if(military.length){
      // Military aviation badges are worn below the CAP aviation badge (10.10.1.2, ICL 25-02).
      const cap = set.aviation.length ? olpAll.indexOf(set.aviation[0]) : olpAll.length - set.chaplain.length;
      olp = [...olpAll.slice(0, cap), ...military, ...olpAll.slice(cap)];
    }
    if(olp.length > 2){
      ctx.note('At most two aviation and occupational badges are worn over the left pocket; the rest are not shown');
      // Keep the chaplain badge and the aviation badge first.
      const keep = [...set.chaplain, ...set.aviation, ...military, ...set.occupational].slice(0, 2);
      olp = olp.filter(x => keep.includes(x));
    }
    // Everything else goes on the pockets or over the nametag. National Staff is always on the
    // wearer's right; the CSAG / Command Council / NB / NEC badges always on the wearer's left.
    const nationalStaff = set.nationalStaff.slice(0, 1);
    const service = set.service.slice(0, 1);
    if(set.service.length > 1) ctx.note('Only one service badge is worn; the others are not shown');
    const others = [...service, ...set.cadetSpecialty, ...set.specialty, ...set.rocketry, ...set.marksmanship];
    const total = olp.length + nationalStaff.length + others.length;
    const max = o.max || 4;
    let rest = others;
    if(total > max){
      ctx.note(`At most ${max} badges are worn on this uniform; the rest are not shown`);
      rest = others.slice(0, Math.max(0, max - olp.length - nationalStaff.length));
    }
    return { olp, nationalStaff, rest, pin: H.commandPin(ctx, b, 'dress') };
  }

  // Place a dress badge (or a military raster) with a given anchor at a point.
  async function putBadge(ctx, item, at, anchor, key){
    if(item.raster){
      const w = 2.75, h = 0.75;
      const x = at.x - w / 2;
      const y = anchor === 'bottom_center' ? at.y - h : anchor === 'top_center' ? at.y : at.y - h / 2;
      const l = ctx.raster({ href: item.raster, x, y, w, h, z: Z.badge, role: 'badge', key: key || 'badge:' + item.id, title: item.title, className: 'badge' });
      return { x, y, w, h, layer: l };
    }
    const s = await ctx.spec(item.art);
    const l = await ctx.place(item.art, { pieceAnchor: anchor, at, z: Z.badge, role: 'badge', key: key || 'badge:' + item.id, title: item.title, className: 'badge' });
    return l ? { x: l.x, y: l.y, w: l.w, h: l.h, spec: s } : null;
  }

  // Stack badges upward, each `gap` above the one below. The first item is the lowest.
  async function stackBadges(ctx, items, x, bottomY, gap){
    let y = bottomY;
    let top = bottomY;
    for(const it of items){
      const p = await putBadge(ctx, it, { x, y: y - gap }, 'bottom_center');
      if(p){ ctx.measure({ x, y }, { x, y: y - gap }); y = p.y; top = p.y; }
    }
    return top;
  }

  // Badges side by side, `gap` apart, the pair centred on x, bottoms on `bottomY`. `order` is
  // viewer's left first.
  async function rowOfBadges(ctx, items, cx, bottomY, gap, anchor){
    const widths = [];
    for(const it of items) widths.push(it.raster ? 2.75 : (await ctx.spec(it.art)).w);
    const total = widths.reduce((a, w) => a + w, 0) + gap * (items.length - 1);
    let x = cx - total / 2;
    let top = bottomY;
    for(let i = 0; i < items.length; i++){
      const p = await putBadge(ctx, items[i], { x: x + widths[i] / 2, y: bottomY }, anchor || 'bottom_center');
      if(p) top = Math.min(top, p.y);
      if(i && gap) ctx.measure({ x: x - gap, y: bottomY - 0.2 }, { x, y: bottomY - 0.2 });
      x += widths[i] + gap;
    }
    return top;
  }

  // The full badge layout. `geo`:
  //   olp: { x, baseY, gap }       first badge's bottom `gap` above baseY (the rack top or rest line)
  //   olpCenter: {x,y}             optional: with nothing below, centre the first badge here
  //   lp, rp: { x, y, anchor }     pocket positions (null where the uniform has none)
  //   nametag: rect                the nametag (for ON and UN), or a stand-in rect
  //   onStyle: 'men' | 'women' | 'women-a'   who stacks over the pin
  //   onBottom: y                  override for the ON line (semi-formal: even with the ribbons)
  //   un: { x, y, anchor }         graduated commander position
  async function dressBadges(ctx, b, geo){
    const plan = planBadges(ctx, b, { max: geo.max });
    // Over the left pocket.
    if(plan.olp.length){
      if(geo.olpCenter){
        const first = await putBadge(ctx, plan.olp[0], geo.olpCenter, 'center');
        if(plan.olp[1] && first) await stackBadges(ctx, [plan.olp[1]], geo.olp.x, first.y, 0.5);
      }else{
        await stackBadges(ctx, plan.olp, geo.olp.x, geo.olp.baseY, geo.olp.gap == null ? 0.5 : geo.olp.gap);
      }
    }
    const tag = geo.nametag;
    const onX = tag ? tag.x + tag.w / 2 : null;
    const onBottom = geo.onBottom != null ? geo.onBottom : (tag ? tag.y - 0.5 : null);
    const pinCurrent = plan.pin && !plan.pin.graduated ? plan.pin : null;
    const pinGrad = plan.pin && plan.pin.graduated ? plan.pin : null;
    if(pinGrad){
      if(geo.un){
        await putBadge(ctx, { id: pinGrad.id, art: pinGrad.art, title: pinGrad.title }, geo.un, geo.un.anchor || 'center', `badge:${pinGrad.id}:UN:0`);
        if(tag && geo.un.anchor === 'top_center') ctx.measure({ x: geo.un.x, y: tag.y + tag.h }, { x: geo.un.x, y: geo.un.y });
      }else ctx.note('The graduated commander insignia has no place on this uniform');
    }
    // Pocket badges measured from their reference line (welt or nametag) to their centre.
    const pocketMeasure = spot => { if(spot && spot.from != null) ctx.measure({ x: spot.x, y: spot.from }, { x: spot.x, y: spot.y }, C.inchesLabel(spot.y - spot.from) + ' to centre'); };
    // The over-nametag line, 1/2 in above the nametag.
    const onMeasure = () => { if(tag && geo.onBottom == null && tag.h) ctx.measure({ x: onX, y: tag.y }, { x: onX, y: onBottom }); };
    const pinItem = pinCurrent ? { id: pinCurrent.id, art: pinCurrent.art, title: pinCurrent.title } : null;
    const pinKey = pinCurrent ? `badge:${pinCurrent.id}:ON:0` : null;

    // Model rocketry and NRA marksmanship (cadets) have places of their own (4.1.5.2.2.4.2,
    // 4.1.9.4.4.2, 4.1.10.1.2.4.2, 4.1.11.1.1.2.4, 4.2.6.2.7.2).
    const isSpecial = x => x.family === 'rocketry' || x.family === 'marksmanship';
    const rocketry = plan.rest.find(x => x.family === 'rocketry') || null;
    const marks = plan.rest.find(x => x.family === 'marksmanship') || null;
    const regular = plan.rest.filter(x => !isSpecial(x));

    if(geo.onStyle === 'men'){
      // Men: first badge on the left pocket, second on the right pocket, third over the nametag;
      // with a current command pin over the nametag the third badge sits 1/2 in above the pin.
      // Model rocketry is worn only on the left pocket; marksmanship on the welt or pocket flap.
      const queue = [...regular];
      if(marks){
        if(geo.marks) await putBadge(ctx, marks, geo.marks, geo.marks.anchor || 'top_center');
        else queue.push(marks);
      }
      const lpItem = geo.lp ? (rocketry || queue.shift()) : null;
      if(rocketry && !geo.lp) ctx.note('The model rocketry badge is worn only on the left pocket, which this uniform does not have');
      let rpItem = plan.nationalStaff[0] || null;
      if(!rpItem && geo.rp) rpItem = queue.shift() || null;
      if(lpItem){ await putBadge(ctx, lpItem, geo.lp, geo.lp.anchor || 'center'); pocketMeasure(geo.lp); }
      if(rpItem && geo.rp){ await putBadge(ctx, rpItem, geo.rp, geo.rp.anchor || 'center'); pocketMeasure(geo.rp); }
      else if(rpItem) queue.unshift(rpItem);
      let y = onBottom;
      if(pinItem && onX != null){
        const p = await putBadge(ctx, pinItem, { x: onX, y }, 'bottom_center', pinKey);
        if(p){ onMeasure(); y = p.y; } // the next badge stacks 1/2 in above the pin
      }
      if(queue.length && onX != null){
        await putBadge(ctx, queue.shift(), { x: onX, y: pinItem ? y - 0.5 : y }, 'bottom_center');
        if(pinItem) ctx.measure({ x: onX, y }, { x: onX, y: y - 0.5 });
        else onMeasure();
      }
      if(queue.length) ctx.note('Some badges have no place left on this uniform and are not shown');
      return;
    }

    // Women (and the mess dress): the badges sit over the nametag side by side. Model rocketry and
    // marksmanship go there only when nothing else does; otherwise to their own places.
    const ordinary = [...plan.nationalStaff, ...regular];
    const specials = [rocketry, marks].filter(Boolean);
    const queue = ordinary.length ? ordinary : specials;
    // CAP service badge closest to the lapel (viewer's right of the pair), National Staff to the
    // wearer's right (viewer's left) of a second badge.
    const pair = queue.slice(0, 2);
    const left = ordinary.length ? queue.slice(2) : [];
    const moved = ordinary.length ? specials : specials.slice(2);
    if(pair.length === 2 && SERVICE_IDS.has(pair[0].id)) pair.reverse();
    if(onX == null){
      if(pair.length) ctx.note('Some badges have no place left on this uniform and are not shown');
      return;
    }
    if(pinItem || pair.length) onMeasure();
    if(geo.onStyle === 'women-a' && pinItem && pair.length){
      // Women's Class A: the pin sits 1/2 in above the badge(s) (4.1.9.4.4.3).
      const top = await rowOfBadges(ctx, pair, onX, onBottom, 0.5);
      await putBadge(ctx, pinItem, { x: onX, y: top - 0.5 }, 'bottom_center', pinKey);
      ctx.measure({ x: onX, y: top }, { x: onX, y: top - 0.5 });
    }else if(pinItem && pair.length === 1){
      // One badge: the badge 1/2 in above the pin.
      const p = await putBadge(ctx, pinItem, { x: onX, y: onBottom }, 'bottom_center', pinKey);
      await rowOfBadges(ctx, pair, onX, (p ? p.y : onBottom) - 0.5, 0.5);
    }else if(pinItem && pair.length === 2){
      const p = await putBadge(ctx, pinItem, { x: onX, y: onBottom }, 'bottom_center', pinKey);
      await rowOfBadges(ctx, pair, onX, (p ? p.y : onBottom) - 0.5, 0.5);
    }else if(pinItem){
      await putBadge(ctx, pinItem, { x: onX, y: onBottom }, 'bottom_center', pinKey);
    }else if(pair.length){
      await rowOfBadges(ctx, pair, onX, onBottom, 0.5);
    }
    // Rocketry and marksmanship moved off the nametag: women's aviator shirt to the left pocket and
    // flap; the Class A and B to the wearer's left, 1 1/2 in below the ribbons (one badge there).
    let belowUsed = false;
    for(const it of moved){
      const spot = it.family === 'rocketry' ? (geo.rocketAlt || geo.belowRibbons) : (geo.marksAlt || geo.belowRibbons);
      if(!spot || (spot === geo.belowRibbons && belowUsed)){ left.push(it); continue; }
      if(spot === geo.belowRibbons){ belowUsed = true; ctx.measure({ x: spot.x, y: spot.y - 1.5 }, { x: spot.x, y: spot.y }); }
      await putBadge(ctx, it, spot, spot.anchor || 'top_center');
    }
    if(left.length) ctx.note('Some badges have no place left on this uniform and are not shown');
  }

  // ---- shared pieces ------------------------------------------------------------------------

  // The 3-line plate: lines 1 and 2 are drawn on the plate; line 3 is the last name in white.
  function threeLineName(ctx, b, plateRect){
    if(!b.name.show || !b.name.last || !plateRect) return;
    const s = plateRect.w / 3.375;
    const zone = { x: plateRect.x + 0.25 * s, y: plateRect.y + 0.43 * s, w: plateRect.w - 0.5 * s, h: 0.2 * s };
    C.nameText(ctx, b.name.last, zone, { color: PLATE_WHITE, maxH: 0.17 * s, key: 'text:name' });
  }

  // Grade insignia on both epaulets (gray or blue sleeves drawn by a layer): the grade's centre on
  // the rule point, turned with the strap (theta = frame angle + 90, the rule of R-EPG).
  async function epauletGrade(ctx, id, opts){
    const o = opts || {};
    for(const side of ['right', 'left']){
      const at = ctx.point((o.point || 'rank_rule_point_') + side) || ctx.point('rank_slot_' + side + '_center');
      if(!at) continue;
      let theta = o.theta ? o.theta[side] : null;
      if(theta == null){
        const f = ctx.landmark('rank_slot_' + side + '_frame');
        theta = f && typeof f.deg === 'number' ? f.deg + 90 : 0;
        if(side === 'left' && theta < -180) theta += 360;
      }
      // The colonel's eagle is mirrored on the wearer's right so the beak faces forward (4.1.6.1.2).
      await ctx.place(id, { pieceAnchor: 'center', at, rotate: theta, flipX: side === 'right' && /colonel-(bullion|thread)$/.test(id) && !/lieutenant/.test(id), z: Z.insignia, role: 'grade', key: 'grade:' + side });
    }
  }

  // Chevrons keep their true size and shape, even where the front view shows less sleeve.
  async function sleeveChevrons(ctx, id, pts){
    for(const side of ['right', 'left']){
      const p = pts[side];
      if(!p) continue;
      await ctx.place(id, { pieceAnchor: 'visual_center', at: { x: p[0], y: p[1] }, rotate: p[2] || 0, z: Z.insignia, role: 'grade', key: 'grade:sleeve-' + side });
    }
  }

  // Sleeve chevron points from the sheet: centred halfway between the shoulder seam and the elbow,
  // turned to the line from the seam to the elbow. Null when the sheet has no such anchors.
  function chevronAnchors(ctx){
    const out = {};
    for(const side of ['right', 'left']){
      const c = ctx.point('chevron_halfway_' + side), s = ctx.point('shoulder_seam_' + side), e = ctx.point('elbow_' + side);
      if(!c || !s || !e) return null;
      out[side] = [c.x, c.y, Math.atan2(s.x - e.x, e.y - s.y) * 180 / Math.PI];
    }
    return out;
  }

  // The lapels drawn again over the badges and ribbons they cover (the collar lies on top of them),
  // with the lapel insignia above that.
  async function lapelForeground(ctx, A, g){
    const fg = `${A.layer}-lapel-foreground`;
    if(!ctx.has(fg)) return;
    await ctx.overlay(fg, Z.badge + 0.5);
    const ins = g.category === 'cadet-officer' ? 'lapel-cap' : g.category === 'senior-nco' ? 'lapel-us-nco' : isOfficerLike(g) ? 'lapel-us' : null;
    if(ins) await ctx.overlay(`${A.layer}-${ins}`, LAPEL_Z);
  }

  // The epaulet sleeves seen from above, drawn above the uniform at its outer corners (the front
  // view shows them edge-on). The sleeves are traced from Figure A5-1 with their grade, braid bands
  // and "CAP" in place, upright with the button (neck) end at the top; each is turned flat with its
  // arm end toward its own side.
  async function epauletTopViews(ctx, g, opts){
    const o = opts || {};
    const sleeveId = epauletSleeveId(g);
    if(!sleeveId || !ctx.has(sleeveId)) return;
    const s = await ctx.spec(sleeveId);
    // The eagle faces the art's left; turned flat on the wearer's right shoulder it would face
    // backward, so there it is redrawn mirrored (beak forward on both shoulders).
    const eagle = g.key === 'colonel' && !g.cadet ? G.seniorOfficerInsignia(g, 'thread') : null;
    const ins = core.anchor(s, 'insignia_center');
    for(const side of ['right', 'left']){
      const cx = side === 'right' ? 0.25 + s.h / 2 : ctx.base.w - 0.25 - s.h / 2;
      const cy = -(o.gap == null ? 0.75 : o.gap) - s.w / 2;
      const mirror = side === 'right' && eagle && ins && ctx.has(eagle);
      await ctx.place(sleeveId, Object.assign({ pieceAnchor: 'center', at: { x: cx, y: cy }, rotate: side === 'right' ? 90 : -90, z: Z.hat - 1, role: 'epaulet-top', key: `epaulet-top:${side}`, title: `${side === 'right' ? 'Right' : 'Left'} ${o.label || 'epaulet'}, seen from above` }, mirror ? { hideGroups: ['grade'] } : {}));
      // Turned +90, the sleeve's downward offset to the insignia points to the viewer's left.
      if(mirror) await ctx.place(eagle, { pieceAnchor: 'center', at: { x: cx - (ins.y - s.h / 2), y: cy }, rotate: 90, flipX: true, z: Z.hat - 0.5, role: 'grade', key: 'grade:top-right' });
    }
  }

  // The epaulet sleeve a member wears on the aviator shirt, the Class A coat or the Class B (gray
  // for officers and officer-track members without grade, blue for cadet officers).
  function epauletSleeveId(g){
    if(g.category === 'cadet-officer') return g.key ? `rank-epaulet-sleeve-blue-cadet-${g.key}` : 'rank-epaulet-sleeve-blue-cadet-blank';
    if((g.officer && !g.cadet) || (g.category === 'senior-none' && g.track === 'officer')) return g.key ? `rank-epaulet-sleeve-gray-${g.key}` : 'rank-epaulet-sleeve-gray-blank';
    return null;
  }

  // Shoulder cord on the wearer's left shoulder (9.3): the cord's neck end on the strap axis, the
  // cord turned to follow it and moved 1/8 in toward the neck.
  async function shoulderCord(ctx, b, axis){
    if(!b.cord || !axis) return;
    const id = String(b.cord).startsWith('cord-') ? b.cord : 'cord-' + String(b.cord).replace(/_/g, '-');
    if(!ctx.has(id)){ ctx.note('No artwork for the selected shoulder cord'); return; }
    const [n, a] = axis;
    const dx = a[0] - n[0], dy = a[1] - n[1];
    const len = Math.hypot(dx, dy);
    const at = { x: n[0] - dx / len * 0.125, y: n[1] - dy / len * 0.125 };
    const rotate = Math.atan2(-dx, dy) * 180 / Math.PI;
    await ctx.place(id, { pieceAnchor: 'shoulder_seam_attach_neck_end', at, rotate, z: Z.cord, role: 'cord', key: 'cord:' + id, title: 'Shoulder cord' });
  }

  // Ribbons resting on a line, with an optional lapel that may cover part of them (11.1.8).
  async function ribbonRack(ctx, b, rest, opts){
    const o = opts || {};
    if(!b.ribbons || !b.ribbons.length) return null;
    const perRow = o.perRow || 3;
    const lapel = o.lapel ? ctx.landmark(o.lapel) : null;
    let counts = o.customRows ? b.opt.rackCounts : null;
    if(counts && counts.reduce((a, n) => a + n, 0) !== b.ribbons.length){
      ctx.note('The custom ribbon rows do not add up to the ribbons worn, so the regular rows are shown');
      counts = null;
    }
    // Rows aligned to the wearer's left are aligned with the left edge of the welt or pocket (11.2.7).
    const box = await C.drawRack(ctx, b.ribbons, { centerX: rest.x, bottomY: rest.y, outboardX: o.outboardX != null ? o.outboardX : rest.x + perRow * 1.375 / 2, outboardSign: 1 }, {
      perRow,
      align: o.align,
      lapel: lapel && lapel.points ? lapel.points : null,
      arrangement: b.opt.rackArrangement,
      countsBottomFirst: counts
    });
    if(box && lapel && lapel.points && o.lapelGroup){
      // Redraw the lapel over the ribbons, only where it meets the rack.
      const lb = core.polygonBounds(lapel.points);
      const y0 = Math.max(box.y - 0.1, lb.y), y1 = box.y + box.h;
      if(lb.x + lb.w > box.x && lb.x < box.x + box.w && y1 > y0){
        ctx.foreground([o.lapelGroup], Z.device + 0.5);
        const fg = ctx.layers[ctx.layers.length - 1];
        fg.clip = [{ x: lb.x - 0.2, y: y0 }, { x: lb.x + lb.w + 0.2, y: y0 }, { x: lb.x + lb.w + 0.2, y: y1 }, { x: lb.x - 0.2, y: y1 }];
      }
    }
    return box;
  }

  function hatChoice(b){
    const g = b.grade;
    const pref = b.opt.headgear;
    if(pref === 'none') return null;
    const female = b.gender === 'female';
    const service = pref === 'service';
    if(g.cadet){
      if(g.category === 'cadet-officer'){
        if(service) return { hat: female ? 'hat-service-cap-women-cadet-officer' : 'hat-service-cap-men-cadet-officer', device: 'cap-device-cadet-officer-service' };
        return { hat: 'hat-flight-cap-cadet', device: G.cadetOfficerInsignia(g, 'metal-regular') };
      }
      return { hat: 'hat-flight-cap-cadet', device: 'cap-device-nco-flight' };
    }
    const sex = female ? 'women' : 'men';
    if(g.general) return service ? { hat: `hat-service-cap-${sex}-general`, device: 'cap-device-officer-service' } : { hat: 'hat-flight-cap-general', device: 'cap-device-officer-flight' };
    if(g.category === 'senior-officer' || g.category === 'flight-officer'){
      const field = ['major', 'lieutenant-colonel', 'colonel'].includes(g.key);
      if(service) return { hat: `hat-service-cap-${sex}-${field ? 'field-grade' : 'officer-nco'}`, device: 'cap-device-officer-service' };
      return { hat: 'hat-flight-cap-officer', device: 'cap-device-officer-flight' };
    }
    if(g.category === 'senior-nco'){
      // ICL 25-02: senior NCOs wear the NCO device on the flight cap and the service cap.
      if(service) return { hat: `hat-service-cap-${sex}-officer-nco`, device: 'cap-device-nco-flight' };
      return { hat: 'hat-flight-cap-cadet', device: 'cap-device-nco-flight' };
    }
    // Adults without grade (1.4.1.1, 1.4.2.1): officer-track flight cap, or the plain blue one.
    if(g.track === 'officer') return { hat: 'hat-flight-cap-officer', device: 'cap-device-officer-flight' };
    return { hat: 'hat-flight-cap-cadet', device: null };
  }

  async function blueHat(ctx, b){
    const h = hatChoice(b);
    if(h) await H.hat(ctx, h.hat, h.device);
  }

  // ---- USAF-style Class A service dress (4.1.5, 4.1.9) and cadet semi-formal (4.1.3.2, 4.1.4) --------

  // The shoulder strap on each side of a coat, from the wearer's left strap axis (neck end, arm
  // end) mirrored about the coat's centre: its midpoint and its angle.
  function strapPair(width, neck, arm){
    const mid = { x: (neck[0] + arm[0]) / 2, y: (neck[1] + arm[1]) / 2 };
    const deg = Math.atan2(arm[1] - neck[1], arm[0] - neck[0]) * 180 / Math.PI;
    return { left: { mid, deg }, right: { mid: { x: width - mid.x, y: mid.y }, deg: -deg } };
  }

  // Cadet officer shoulder boards (4.1.5.2.1.3): edge-on on the coat sheet, and seen from above at
  // the outer corners with the regular-size grade on each board's rank slot.
  async function cadetBoards(ctx, A, g, sex){
    await ctx.overlay(A.cadetOfficer, Z.epauletLayer);
    const grade = G.cadetOfficerInsignia(g, 'metal-regular');
    for(const side of ['right', 'left']){
      const id = `garment-blues-shoulder-board-top-${sex}-${side}`;
      if(!ctx.has(id)) continue;
      const s = await ctx.spec(id);
      const x = side === 'right' ? 0.25 + s.w / 2 : ctx.base.w - 0.25 - s.w / 2;
      const view = await ctx.place(id, { pieceAnchor: 'bottom_center', at: { x, y: -0.75 }, z: Z.hat - 1, role: 'epaulet-top', key: `epaulet-top:${side}`, title: `${side === 'right' ? 'Right' : 'Left'} shoulder board, seen from above` });
      const at = view && H.piecePoint(view, s, 'rank_slot_center');
      if(!at || !grade || !ctx.has(grade)) continue;
      // The grade's discs or diamonds sit side by side across the board (Figure A5-6). The figure's
      // board is wider than this one: a grade wider than the band (the Colonel's three diamonds) is
      // drawn just small enough to sit on it.
      const gs = await ctx.spec(grade), band = core.landmarkBounds(s, 'rank_slot');
      const scale = band ? Math.min(1, (band.h - 0.12) / gs.w, (band.w - 0.12) / gs.h) : 1;
      await ctx.place(grade, { pieceAnchor: 'center', at, rotate: 90, scale, z: Z.hat - 0.5, role: 'grade', key: 'grade:top-' + side });
    }
  }

  const CLASS_A = {
    male: {
      coat: 'garment-blues-class-a-coat', semi: 'garment-semiformal-class-a-coat-male', layer: 'garment-blues-class-a-coat',
      cadetOfficer: 'garment-blues-class-a-cadet-officer-insignia', nametagX: 7.6445, nametag: { x: 5.957, y: 10.04, w: 3.375, h: 0.75 },
      ncoChevron: { right: [3.19, 9.86, 1.4], left: [20.54, 9.86, -1.4] }, theta: { right: 75.3, left: -75.3 },
      cord: [[16.52, 2.44], [20.22, 3.41]], strap: strapPair(23.726, [16.52, 2.44], [20.22, 3.41])
    },
    female: {
      coat: 'garment-blues-class-a-coat-female', semi: 'garment-semiformal-class-a-coat-female', layer: 'garment-blues-class-a-coat-female',
      cadetOfficer: 'garment-blues-class-a-cadet-officer-insignia-female', nametagX: 8.06, nametag: { x: 6.37, y: 9.60, w: 3.375, h: 0.75 },
      ncoChevron: { right: [3.29, 9.88, 2.3], left: [21.10, 9.88, -2.3] }, theta: { right: 78.1, left: -78.1 },
      cord: [[16.57, 1.91], [20.09, 2.65]], strap: strapPair(24.3883, [16.57, 1.91], [20.09, 2.65])
    }
  };

  async function composeClassA(ctx, b){
    const semi = b.uniform === 'semi_formal_usaf';
    const g = b.grade;
    const sex = b.gender === 'female' ? 'female' : 'male';
    const A = CLASS_A[sex];
    await ctx.garment(semi ? A.semi : A.coat);
    if(semi && !g.cadet) ctx.note('The USAF-style semi-formal uniform is worn by cadets only (CAPR 39-1, 4.1.3 and 4.1.4)');

    // Layers: boards, epaulets and lapel insignia drawn to the coat (4.1.5.2.1, 4.1.5.2.2.1).
    if(g.category === 'cadet-officer') await cadetBoards(ctx, A, g, sex);
    else if(!semi && g.general) await ctx.overlay(`${A.layer}-general-officer`);
    else if(!semi && isOfficerLike(g)) await ctx.overlay(`${A.layer}-senior-officer`);
    else if(!semi && g.category === 'senior-nco') await ctx.overlay(`${A.layer}-senior-nco-lapel`);

    // Nametag (not worn on the semi-formal).
    let tagRect = A.nametag;
    if(!semi){
      const tagLayer = g.cadet ? `${A.layer}-nametag-cadet` : `${A.layer}-nametag-officer-nco`;
      await ctx.overlay(tagLayer, Z.tape);
      tagRect = ctx.rect('nametag') || ctx.rect('nameplate') || A.nametag;
      if(b.name.show && b.name.last){
        if(g.cadet) threeLineName(ctx, b, tagRect);
        else C.nameText(ctx, b.name.last, { x: tagRect.x + 0.2, y: tagRect.y + 0.12, w: tagRect.w - 0.4, h: tagRect.h - 0.24 }, { color: ENGRAVED_BLUE, maxH: 0.36, key: 'text:name' });
      }
    }

    // Grade.
    if(g.category === 'cadet-nco'){
      for(const side of ['right', 'left']){
        const at = ctx.point('lapel_insignia_' + side);
        if(at) await ctx.place(G.cadetNcoChevron(g, 'metal'), { pieceAnchor: 'center', at, z: semi ? Z.insignia : LAPEL_Z, role: 'grade', key: 'grade:' + side });
      }
    }else if(!semi && g.category === 'senior-nco'){
      const size = sex === 'male' ? '4' : (b.opt.chevron === '3.5' ? '3.5' : '4');
      await sleeveChevrons(ctx, G.seniorChevron(g, { size }), chevronAnchors(ctx) || A.ncoChevron);
    }else if(!semi && isOfficerLike(g)){
      // The coat's epaulets are edge-on in the front view; the grade shows on the top views.
      await epauletTopViews(ctx, g);
    }else if(!semi && g.category === 'senior-none' && g.track === 'nco'){
      // Adults without grade on the NCO track wear CAP collar insignia (1.4.2.1).
      for(const side of ['right', 'left']){
        const at = ctx.point('lapel_insignia_' + side);
        if(at) await ctx.place('collar-insignia-cap-metal', { pieceAnchor: 'center', at, z: LAPEL_Z, role: 'grade', key: 'collar:' + side });
      }
    }

    // Ribbons resting on the welt pocket; rows of 3 or 4 (11.2.7). Mandatory (11.1.2).
    const rest = ctx.point('welt_top_center');
    const perRow = Number(b.opt.rackColumns) === 4 ? 4 : 3;
    const welt = ctx.rect('welt_pocket');
    const rack = await ribbonRack(ctx, b, rest, { perRow, align: b.opt.rackAlign, outboardX: welt ? welt.x + welt.w : null, lapel: 'lapel_left', lapelGroup: 'lapel-left', customRows: !semi && !!b.opt.rackCounts });
    if(!rack) ctx.note('Ribbons are required with this uniform (CAPR 39-1, 11.1.2)');

    const geo = {
      olp: { x: rest.x, baseY: rack ? rack.y : rest.y },
      nametag: tagRect,
      lp: sex === 'male' ? { x: rest.x, y: rest.y + 1.5, from: rest.y } : null,
      rp: sex === 'male' ? { x: tagRect.x + tagRect.w / 2, y: tagRect.y + tagRect.h + 1.5, from: tagRect.y + tagRect.h } : null,
      onStyle: sex === 'male' ? 'men' : 'women-a',
      un: { x: tagRect.x + tagRect.w / 2, y: tagRect.y + tagRect.h + 0.5, anchor: 'top_center' }
    };
    if(semi){
      // Only the badge that would go over the nametag moves: it sits even with the bottom of the
      // ribbons. The others keep their service dress places (4.1.3.2.2), so the wearer's right
      // pocket badge stays level with the left one, where the nametag's bottom would be.
      geo.onBottom = rest.y;
      geo.nametag = { x: A.nametagX - 1.6875, y: rest.y, w: 3.375, h: 0 };
      geo.rp = sex === 'male' ? { x: A.nametagX, y: rest.y + 1.5, from: rest.y } : null;
      geo.un = null;
      if(sex === 'male') geo.onStyle = 'men';
    }
    // Men's marksmanship badge: centred on the welt pocket (4.1.5.2.2.4.2). Women's moved rocketry
    // or marksmanship badge: wearer's left, 1 1/2 in below the ribbons (4.1.9.4.4.2).
    if(sex === 'male') geo.marks = { x: rest.x, y: rest.y, anchor: 'top_center' };
    else geo.belowRibbons = { x: rest.x, y: (rack ? rack.y + rack.h : rest.y) + 1.5, anchor: 'top_center' };
    await dressBadges(ctx, b, geo);

    if(!semi){
      await lapelForeground(ctx, A, g);
      if(g.cadet) await shoulderCord(ctx, b, A.cord);
      await blueHat(ctx, b);
    }
  }

  // ---- USAF-style Class B (4.1.11 men, 4.1.12 women) -----------------------------------------------

  const CLASS_B = {
    'male-short': { garment: 'garment-blues-class-b-shirt-male', chev: { right: [2.58, 8.40, 6.0], left: [18.11, 8.40, -6.0] }, cord: [[13.682, 1.933], [17.754, 3.45]], sleeveW: 3.0 },
    'male-long': { garment: 'garment-blues-class-b-shirt-male-long', chev: { right: [3.12, 9.75, 2.4], left: [18.20, 9.75, -2.4] }, cord: [[13.88, 2.20], [17.95, 3.64]] },
    'female-short': { garment: 'garment-blues-class-b-blouse-female', chev: { right: [2.77, 8.48, 3.4], left: [18.00, 8.48, -3.4] }, cord: [[13.326, 2.038], [17.779, 3.059]], sleeveW: 3.0 },
    'female-long': { garment: 'garment-blues-class-b-blouse-female-long', chev: { right: [2.31, 8.94, 1.2], left: [17.20, 8.94, -1.2] }, cord: [[12.63, 2.31], [17.08, 3.26]] }
  };

  async function composeClassB(ctx, b){
    const g = b.grade;
    const female = b.gender === 'female';
    const long = b.opt.sleeve === 'long';
    const V = CLASS_B[(female ? 'female' : 'male') + (long ? '-long' : '-short')];
    const base = V.garment;
    await ctx.garment(base);

    if(g.category === 'cadet-officer') await ctx.overlay(`${base}-epaulet-sleeve-cadet-officer`, Z.epauletLayer);
    else if(isOfficerLike(g)) await ctx.overlay(`${base}-epaulet-sleeve-officer`, Z.epauletLayer);
    if(g.general) await ctx.overlay(`${base}-general-officer-buckle`);

    await ctx.overlay(g.cadet ? `${base}-nametag-cadet` : `${base}-nametag-adult`, Z.tape);
    const tag = ctx.rect('nametag') || ctx.rect('nameplate');
    threeLineName(ctx, b, tag);

    if(g.category === 'cadet-nco'){
      // The collar anchors of the Class B sheets are named by the viewer's side (spec defect D1).
      const rot = female ? 32.4 : 27.9;
      const id = G.cadetNcoChevron(g, 'metal');
      const wr = ctx.point('collar_insignia_left'), wl = ctx.point('collar_insignia_right');
      if(wr) await ctx.place(id, { pieceAnchor: 'center', at: wr, rotate: rot, z: Z.insignia, role: 'grade', key: 'grade:right' });
      if(wl) await ctx.place(id, { pieceAnchor: 'center', at: wl, rotate: -rot, z: Z.insignia, role: 'grade', key: 'grade:left' });
    }else if(g.category === 'senior-nco'){
      // Men: 3 1/2 in (4.1.11.1.1.1.3). Women: 3 1/2 or 4 in on either sleeve (4.1.12.2.3.3).
      const size = female && b.opt.chevron === '4' ? '4' : '3.5';
      const id = G.seniorChevron(g, { size });
      await sleeveChevrons(ctx, id, chevronAnchors(ctx) || V.chev);
    }
    // The epaulet sleeves are edge-on in the front view; their grade shows on the top views.
    await epauletTopViews(ctx, g);

    // Ribbons (optional): men on the left pocket top, women with the bottom even with the nametag.
    const rest = ctx.point('ribbon_row_bottom_center');
    const rack = await ribbonRack(ctx, b, rest, { perRow: 3 });
    const geo = { nametag: tag, olp: { x: rest.x, baseY: rack ? rack.y : rest.y } };
    if(!female){
      const pocketL = ctx.rect('pocket_left'), pocketR = ctx.rect('pocket_right');
      const flapY = pocketL.y + 2.02;
      const midY = (flapY + pocketL.y + pocketL.h) / 2;
      geo.lp = { x: pocketL.x + pocketL.w / 2, y: midY };
      geo.rp = { x: pocketR.x + pocketR.w / 2, y: midY };
      geo.onStyle = 'men';
      geo.un = { x: tag.x + tag.w / 2, y: tag.y + tag.h + 0.63 };
      geo.marks = { x: pocketL.x + pocketL.w / 2, y: pocketL.y, anchor: 'top_center' }; // top edge of the flap
    }else{
      if(!rack) geo.olpCenter = { x: rest.x, y: tag.y + tag.h / 2 };
      geo.onStyle = 'women';
      geo.belowRibbons = { x: rest.x, y: (rack ? rack.y + rack.h : rest.y) + 1.5, anchor: 'top_center' };
      geo.un = { x: tag.x + tag.w / 2, y: tag.y + tag.h + 0.5, anchor: 'top_center' };
    }
    await dressBadges(ctx, b, geo);
    if(g.cadet) await shoulderCord(ctx, b, V.cord);
    await blueHat(ctx, b);
  }

  // ---- Mess dress (4.1.1 men, 4.1.2 women) ------------------------------------------------------------

  const MESS = {
    male: { garment: 'garment-mess-dress-male', chev: { right: [2.61, 11.84, 0.2], left: [23.91, 11.84, -0.2] } },
    female: { garment: 'garment-mess-dress-female', chev: { right: [2.57, 11.27, 1.2], left: [22.95, 11.27, -1.2] } }
  };

  async function composeMess(ctx, b){
    const g = b.grade;
    const female = b.gender === 'female';
    const M = MESS[female ? 'female' : 'male'];
    if(female){
      const skirt = b.opt.skirt === 'straight-split' ? 'garment-mess-dress-skirt-female-straight-split' : 'garment-mess-dress-skirt-female-a-line';
      const s = await ctx.spec(skirt);
      ctx.layers.push(Object.assign(core.registerAtOrigin(s, Z.under, 'garment-layer'), { key: 'layer:' + skirt }));
    }
    await ctx.garment(M.garment);
    const officer = g.officer && !g.cadet;
    if(!officer && g.category !== 'senior-nco') ctx.note('The mess dress is worn by officers and NCOs only (CAPR 39-1, 4.1.1 and 4.1.2)');

    if(officer){
      // Generals' boards are covered in silver lace, the others' in Air Force blue (Figure A5-3).
      await ctx.overlay(g.general && ctx.has(`${M.garment}-general-officer-shoulder-boards`) ? `${M.garment}-general-officer-shoulder-boards` : `${M.garment}-officer-shoulder-boards`);
      await ctx.overlay(g.general ? `${M.garment}-general-officer-sleeve-braid` : `${M.garment}-officer-sleeve-braid`);
      if(g.key) await epauletGrade(ctx, G.seniorOfficerInsignia(g, 'bullion'), { point: 'rank_slot_' });
    }else if(g.category === 'senior-nco'){
      const size = female && b.opt.chevron === '3.5' ? '3.5' : '4';
      await sleeveChevrons(ctx, G.seniorChevron(g, { white: true, size }), chevronAnchors(ctx) || M.chev);
    }

    // Miniature medals centred between the lapel and the arm seam (4.1.1.1.2.2, 11.2.8).
    const slot = ctx.rect('miniature_medal_slot');
    const center = ctx.point('miniature_medals_center');
    const box = await C.drawMiniMedals(ctx, b.medals || [], { w: slot.w, centerX: center.x, bottomY: slot.y + slot.h }, { style: b.opt.miniStyle });
    const wrX = ctx.base.w - center.x;
    const plan = planBadges(ctx, b, {});
    // Aviation / occupational: 1/2 in above the medals; none worn: centred on the medal spot.
    if(plan.olp.length){
      if(box) await stackBadges(ctx, plan.olp, center.x, box.y, 0.5);
      else{
        const first = await putBadge(ctx, plan.olp[0], center, 'center');
        if(plan.olp[1] && first) await stackBadges(ctx, [plan.olp[1]], center.x, first.y, 0.5);
      }
    }
    const medTop = box ? box.y : center.y - 0.5;
    const medBottom = box ? box.y + box.h : center.y + 0.5;
    const others = [...plan.nationalStaff, ...plan.rest];
    if(!female){
      // Men: first service/specialty badge on the wearer's left 1/2 in below the medals, the second
      // in the same spot on the wearer's right; National Staff always on the right.
      const lpItem = others.find(x => x.family !== 'national-staff');
      const rpItem = others.find(x => x !== lpItem);
      if(lpItem) await putBadge(ctx, lpItem, { x: center.x, y: medBottom + 0.5 }, 'top_center');
      if(rpItem) await putBadge(ctx, rpItem, { x: wrX, y: medBottom + 0.5 }, 'top_center');
      if(plan.pin){
        const y = plan.pin.graduated ? medBottom : medTop;
        await putBadge(ctx, { id: plan.pin.id, art: plan.pin.art, title: plan.pin.title }, { x: wrX, y }, plan.pin.graduated ? 'bottom_center' : 'top_center', `badge:${plan.pin.id}:${plan.pin.graduated ? 'UN' : 'ON'}:0`);
      }
      if(others.length > 2) ctx.note('Some badges have no place left on this uniform and are not shown');
    }else{
      // Women: badges on the wearer's right, tops even with the top of the medals; the current pin
      // 1/2 in above them and the graduated pin 1/2 in below them.
      const pair = others.slice(0, 2);
      if(pair.length === 2 && SERVICE_IDS.has(pair[0].id)) pair.reverse();
      let top = medTop, bottom = medTop;
      if(pair.length){
        const widths = [];
        for(const it of pair) widths.push((await ctx.spec(it.art)).w);
        const total = widths.reduce((a, w) => a + w, 0) + 0.5 * (pair.length - 1);
        let x = wrX - total / 2;
        for(let i = 0; i < pair.length; i++){
          const p = await putBadge(ctx, pair[i], { x: x + widths[i] / 2, y: medTop }, 'top_center');
          if(p) bottom = Math.max(bottom, p.y + p.h);
          x += widths[i] + 0.5;
        }
      }
      if(plan.pin){
        const pin = { id: plan.pin.id, art: plan.pin.art, title: plan.pin.title };
        const key = `badge:${plan.pin.id}:${plan.pin.graduated ? 'UN' : 'ON'}:0`;
        if(plan.pin.graduated) await putBadge(ctx, pin, { x: wrX, y: (pair.length ? bottom : medBottom) + (pair.length ? 0.5 : 0) }, pair.length ? 'top_center' : 'bottom_center', key);
        else await putBadge(ctx, pin, { x: wrX, y: pair.length ? top - 0.5 : top }, pair.length ? 'bottom_center' : 'top_center', key);
      }
      if(others.length > 2) ctx.note('Some badges have no place left on this uniform and are not shown');
    }
  }

  // ---- Corporate: aviator shirt (4.2.5 men, 4.2.6 women) -----------------------------------------------

  // Per garment: epaulet angle (wearer's right; the left is the mirror), the width of the drawn
  // strap, the sleeve chevron points (the short-sleeve sheet anchors sit on the hem, so these are
  // halfway between the shoulder seam and the hem), the visible sleeve width and collar angle.
  const AVIATOR = {
    'garment-aviator-shirt-male': { ep: [68.6, -68.6], strapW: 1.35, chev: { right: [2.02, 8.23, 11.6], left: [19.136, 8.23, -11.6] }, sleeveW: 2.93, collar: 24.6 },
    'garment-aviator-shirt-male-long': { ep: [68.6, -68.6], strapW: 1.35, chevAnchors: 11.6, sleeveW: 3.2, collar: 24.6 },
    'garment-aviator-shirt-female': { ep: [74.8, -75.3], strapW: 1.3, chev: { right: [1.918, 8.97, 10.1], left: [19.13, 8.97, -10.1] }, sleeveW: 2.56, collar: 23.6 },
    'garment-aviator-shirt-female-long': { ep: [74.8, -75.3], strapW: 1.3, chevAnchors: 10, sleeveW: 2.9, collar: 23.6 },
    'garment-overblouse-female': { ep: [67.2, -67.2], strapW: 1.3, chev: { right: [3.83, 8.88, 31], left: [17.57, 8.88, -31] }, sleeveW: 2.6, collar: 25, overblouse: true },
    'garment-overblouse-female-long': { ep: [67.2, -67.2], strapW: 1.3, chevAnchors: 31, sleeveW: 2.9, collar: 25, overblouse: true }
  };

  function aviatorEpaulet(g){
    if(g.category === 'cadet-officer') return `rank-epaulet-sleeve-blue-cadet-${g.key}`;
    if(g.category === 'senior-officer' || g.category === 'general' || g.category === 'flight-officer') return `rank-epaulet-sleeve-gray-${g.key}`;
    if(g.category === 'senior-none' && g.track === 'officer') return 'rank-epaulet-sleeve-gray-blank';
    return null;
  }

  async function composeAviator(ctx, b){
    const g = b.grade;
    const female = b.gender === 'female';
    const long = b.opt.sleeve === 'long';
    const top = female ? (b.opt.femaleTop === 'overblouse' ? 'garment-overblouse-female' : 'garment-aviator-shirt-female') : 'garment-aviator-shirt-male';
    const garment = top + (long ? '-long' : '');
    const V = AVIATOR[garment];
    await ctx.garment(garment);
    if(g.cadet) ctx.note('Cadets wear corporate uniforms only when 18 or older and not eligible for the USAF-style uniform (CAPR 39-1, 1.2.5.2)');

    // Grade. The shirts draw the epaulet sleeve edge-on; its top view (with the grade) goes above.
    const epCat = g.category === 'cadet-officer' ? 'cadet-officer' : (isOfficerLike(g) ? 'officer' : null);
    const ep = aviatorEpaulet(g);
    if(epCat && !V.overblouse && ctx.has(`${garment}-epaulet-sleeve-${epCat}`)){
      await ctx.overlay(`${garment}-epaulet-sleeve-${epCat}`, Z.epauletLayer);
      await epauletTopViews(ctx, g);
    }else if(ep){
      const s = await ctx.spec(ep);
      const scaleX = Math.min(1, V.strapW / s.w);
      for(const [i, side] of [[0, 'right'], [1, 'left']]){
        const at = ctx.point(`epaulet_${side}_center`);
        if(at) await ctx.place(ep, { pieceAnchor: 'center', at, rotate: V.ep[i], scaleX, z: Z.epauletLayer, role: 'grade', key: 'grade:' + side });
      }
    }else if(g.category === 'cadet-nco'){
      const id = G.cadetNcoChevron(g, 'metal');
      for(const side of ['right', 'left']){
        const at = ctx.point(`collar_insignia_${side}_center`);
        if(at) await ctx.place(id, { pieceAnchor: 'center', at, rotate: side === 'right' ? -V.collar : V.collar, z: Z.insignia, role: 'grade', key: 'grade:' + side });
      }
    }else if(g.category === 'senior-nco'){
      // 3 1/2 in chevrons only (4.2.5.1.1.3, 4.2.6.2.3).
      const id = G.seniorChevron(g, { size: '3.5' });
      let pts = V.chev;
      if(!pts){
        const r = ctx.point('nco_chevron_right_center'), l = ctx.point('nco_chevron_left_center');
        pts = { right: [r.x, r.y, V.chevAnchors], left: [l.x, l.y, -V.chevAnchors] };
      }
      await sleeveChevrons(ctx, id, pts);
    }

    // Nametag over the right pocket (4.2.5.1.2.1, 4.2.6.2.6.1).
    const slot = ctx.rect('nameplate_slot');
    const plateId = g.cadet ? 'nameplate-3line-cadet' : 'nameplate-3line-adult';
    const plate = await ctx.place(plateId, { pieceAnchor: 'center', at: core.rectCenter(slot), z: Z.tape, role: 'nametag', key: 'nametag' });
    const tag = { x: plate.x, y: plate.y, w: plate.w, h: plate.h };
    threeLineName(ctx, b, tag);

    // Ribbons: CAP and military (ICL 25-02), rows of 3 resting on the left pocket top.
    const rest = { x: ctx.point('ribbon_slot_center').x, y: slot.y + slot.h };
    const rack = await ribbonRack(ctx, b, rest, { perRow: 3 });

    const geo = { nametag: tag, olp: { x: rest.x, baseY: rack ? rack.y : rest.y } };
    if(V.overblouse && !rack) geo.olp.gap = 0; // parallel with the nameplate
    if(!V.overblouse){
      const lp = ctx.point('badge_left_pocket_center'), rp = ctx.point('badge_right_pocket_center');
      geo.lp = lp ? { x: lp.x, y: lp.y } : null;
      geo.rp = rp ? { x: rp.x, y: rp.y } : null;
    }
    // Marksmanship: centred on the top edge of the left pocket flap, where the ribbons rest.
    const flapTop = { x: rest.x, y: rest.y, anchor: 'top_center' };
    if(!female){
      geo.onStyle = 'men';
      geo.un = { x: tag.x + tag.w / 2, y: tag.y + tag.h + 0.715 };
      geo.marks = flapTop;
    }else{
      const lpc = ctx.point('badge_left_pocket_center');
      geo.rocketAlt = lpc ? { x: lpc.x, y: lpc.y, anchor: 'center' } : null;
      geo.marksAlt = flapTop;
      // Women: the command pin goes 1/2 in above a badge worn over the nametag (4.2.6.2.7.3).
      geo.onStyle = 'women-a';
      if(!V.overblouse) geo.rp = null;
      geo.un = { x: tag.x + tag.w / 2, y: tag.y + tag.h + 0.5, anchor: 'top_center' };
    }
    // On the aviator shirt the command insignia is worn only by officers (4.2.5.1.3.3, 4.2.6.2.7.3).
    if(b.command && !(g.officer && !g.cadet)){
      ctx.note('On the aviator shirt the command insignia is worn only by officers (CAPR 39-1, 4.2.5.1.3.3)');
      b = Object.assign({}, b, { command: null });
    }
    await dressBadges(ctx, b, geo);
    // The long-sleeve shirt is worn with a tie, or a tie tab for women (4.2.5.1.4, 4.2.6.3).
    if(long && !V.overblouse){
      const tie = `${garment}-${female ? 'tie-tab' : 'tie'}`;
      if(ctx.has(tie)) await ctx.overlay(tie, Z.garmentLayer + 0.5);
    }
  }

  // ---- Corporate Service Dress (blazer, 4.2.3 / 4.2.4) and Corporate Semi-Formal (4.2.1 / 4.2.2) ---------

  // Nametag top even with the top of the left breast pocket, the crest centred on the pocket below
  // it (4.2.3.1.1.1-2, Figures 4.14 and 4.15); the sheets carry both slots.
  const BLAZER = {
    male: { garment: 'garment-corporate-service-dress-blazer-male', bowTie: { x: 12.761, y: 3.655 }, underlayer: { turtleneck: 'garment-underlayer-turtleneck-male' }, cover: ['shirt', 'tie'] },
    female: { garment: 'garment-corporate-service-dress-blazer-female', plate: null, underlayer: { turtleneck: 'garment-underlayer-turtleneck-female', shell: 'garment-underlayer-shell-female' }, cover: ['shirt', 'tie-tab'] }
  };

  async function composeBlazer(ctx, b){
    const semi = b.uniform === 'semi_formal';
    const g = b.grade;
    const female = b.gender === 'female';
    const V = BLAZER[female ? 'female' : 'male'];
    const set = H.badgeSet(ctx, b, 'dress');
    // Only the CSAG, Command Council, National Board or NEC badge takes the crest's place (4.2.3.1.1.1).
    const crestBadge = set.service.find(x => SERVICE_IDS.has(x.id)) || null;
    const hide = [];
    let under = V.underlayer[b.opt.underlayer] || null;
    if(semi && b.opt.underlayer === 'turtleneck'){ under = null; ctx.note('A turtleneck is not worn with the semi-formal uniform (CAPR 39-1, 4.2.1.1, 4.2.2.1)'); }
    if(under) hide.push(...V.cover);
    if(semi && !female && !under) hide.push('tie');
    if(crestBadge) hide.push('cap-crest');
    const base = await ctx.spec(V.garment);
    if(under){
      // The underlayers are drawn to the blazer's own box.
      const us = await ctx.spec(under);
      ctx.layers.push(Object.assign(core.registerAtOrigin(us, Z.under, 'underlayer'), { key: 'layer:' + under }));
    }
    await ctx.garment(V.garment, hide.length ? { hideGroups: [...new Set(hide)] } : null);
    if(g.cadet) ctx.note('Cadets wear corporate uniforms only when 18 or older and not eligible for the USAF-style uniform (CAPR 39-1, 1.2.5.2)');

    if(semi && !female && !under) await ctx.place('tie-bow-black', { pieceAnchor: 'knot_center', at: V.bowTie, z: Z.garmentLayer, role: 'tie', key: 'tie:bow' });

    // The CSAG, Command Council, National Board or NEC badge is worn in place of the crest.
    const crestLayer = crestBadge ? await ctx.place(crestBadge.art, { pieceAnchor: 'center', at: ctx.point('crest_center'), z: Z.badge, role: 'badge', key: 'badge:' + crestBadge.id, title: crestBadge.title, className: 'badge' }) : null;
    const chaplain = set.chaplain[0] || null;
    const dropped = set.all.filter(x => x !== crestBadge && x !== chaplain);
    if(dropped.length) ctx.note('Only the chaplain badge and the CSAG, Command Council, National Board or NEC badge are worn on this uniform; the other badges are not shown');
    if(b.command) ctx.note('Command insignia is not worn on this uniform');

    if(!semi){
      // Nameplate: name and state lines, with optional grade for adults (4.2.3.1.1.2).
      const plateId = g.cadet ? 'nameplate-blazer-cadet' : 'nameplate-blazer-adult';
      const ps = await ctx.spec(plateId);
      // Men: on the wearer's right, straight across from the left breast pocket with its top even
      // with the pocket top (the sheet's slot, mirrored). Women's blazer has no pocket: the nametag
      // sits 1/2 in above the crest or the service badge in its place (4.2.3.1.1.2, 4.2.4.1.1.2).
      const slotAt = ctx.point('nameplate_slot_center');
      let plateAt = slotAt && { x: ctx.base.w - slotAt.x, y: slotAt.y };
      const crestTopPt = ctx.point('crest_top_center');
      if(female && crestTopPt){
        const top = crestLayer ? crestLayer.y : crestTopPt.y;
        plateAt = { x: crestTopPt.x, y: top - 0.5 - ps.h / 2 };
      }
      const plate = await ctx.place(plateId, { pieceAnchor: 'center', at: plateAt, z: Z.tape, role: 'nametag', key: 'nametag' });
      if(female && crestTopPt) ctx.measure({ x: plate.x + plate.w + 0.3, y: plate.y + plate.h }, { x: plate.x + plate.w + 0.3, y: plate.y + plate.h + 0.5 });
      if(b.name.show){
        // Last name and state (4.2.3.1.1.2).
        const nameZone = H.pieceRect(plate, ps, 'name');
        if(nameZone && b.name.last) C.nameText(ctx, b.name.last, nameZone, { color: PLATE_WHITE, maxH: 0.2, key: 'text:name' });
        const stateZone = H.pieceRect(plate, ps, 'state');
        if(stateZone && b.name.state) C.nameText(ctx, b.name.state, stateZone, { color: PLATE_WHITE, maxH: 0.13, key: 'text:state' });
      }
      const gz = H.pieceRect(plate, ps, 'grade_insignia');
      if(gz && !g.cadet && b.opt.plateGrade !== false){
        let gid = null;
        if(g.category === 'senior-nco') gid = G.seniorChevron(g, { size: '3.5' });
        else if(g.general) gid = g.key === 'major-general' ? 'rank-senior-major-general-3-4in-horizontal-thread' : 'rank-senior-brigadier-general-3-4in-thread';
        else if(g.officer) gid = G.seniorOfficerInsignia(g, 'thread');
        if(gid) await C.fitIn(ctx, gid, gz, { z: Z.insignia + 5, role: 'grade', key: 'grade:plate' });
      }
      if(chaplain){
        await ctx.place(chaplain.art, { pieceAnchor: 'bottom_center', at: { x: plate.x + plate.w / 2, y: plate.y - 0.5 }, z: Z.badge, role: 'badge', key: 'badge:' + chaplain.id, title: chaplain.title, className: 'badge' });
        ctx.measure({ x: plate.x + plate.w / 2, y: plate.y }, { x: plate.x + plate.w / 2, y: plate.y - 0.5 });
      }
      ctx.foreground(['lapel-foreground'], Z.text + 1);
      return;
    }

    // Semi-formal: miniature medals on the wearer's left, lowest row 1/2 in above the crest
    // (4.2.1.4, 4.2.2.4 with ICL 25-02: CAP and military miniatures).
    // The lowest row's medals end 1/2 in above the crest, or the service badge worn in its place.
    const ms = ctx.rect('medal_slot');
    const crestTop = crestLayer ? crestLayer.y : (ctx.point('crest_top_center') || { y: ms.y + ms.h + 0.5 }).y;
    const medalX = ms.x + ms.w / 2;
    const box = await C.drawMiniMedals(ctx, b.medals || [], { w: ms.w, centerX: medalX, bottomY: crestTop - 0.5 }, { style: b.opt.miniStyle });
    if(box) ctx.measure({ x: medalX + 1.6, y: crestTop }, { x: medalX + 1.6, y: crestTop - 0.5 });
    if(chaplain){
      const y = (box ? box.y : ms.y + ms.h) - 0.5;
      await ctx.place(chaplain.art, { pieceAnchor: 'bottom_center', at: { x: ms.x + ms.w / 2, y }, z: Z.badge, role: 'badge', key: 'badge:' + chaplain.id, title: chaplain.title, className: 'badge' });
    }
    ctx.foreground(['lapel-foreground'], Z.text + 1);
  }

  P.register('blues_a', { title: 'Service Dress (Class A)', compose: composeClassA });
  P.register('semi_formal_usaf', { title: 'Cadet Semi-Formal', compose: composeClassA });
  P.register('blues_b', { title: 'Blue Service (Class B)', compose: composeClassB });
  P.register('mess_dress', { title: 'Mess Dress', compose: composeMess });
  P.register('aviator', { title: 'Aviator Shirt Uniform', compose: composeAviator });
  // The blazer is worn over the long-sleeve aviator shirt and tie (4.2.3.1, 4.2.4.1); the shirt is
  // drawn beside it.
  P.register('aviator_blazer', { title: 'Corporate Service Dress', compose: composeBlazer,
    companion: b => b.opt.underlayer === 'turtleneck' || b.opt.underlayer === 'shell' ? null
      : Object.assign({}, b, { uniform: 'aviator', opt: Object.assign({}, b.opt, { sleeve: 'long', femaleTop: 'shirt', headgear: 'none' }) }) });
  P.register('semi_formal', { title: 'Corporate Semi-Formal', compose: composeBlazer });
});
