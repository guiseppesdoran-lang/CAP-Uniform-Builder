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
  // A badge that reaches the lapel's drawn area lies on top of it: it is pinned on the coat, and a badge
  // the lapel half hides is not 'worn and visible' (4.1.5.2.2.4.1, 4.1.9.4.4.1). Above the lapel foreground
  // (Z.badge + 0.5), below the lapel insignia (LAPEL_Z).
  const BADGE_OVER_LAPEL_Z = Z.badge + 0.55;
  // The badges that may take the CAP Crest's place on the corporate blazer (4.2.3.1.1.1). Not the
  // whole service family: the Volunteer University badge and the National Staff badge may not.
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
      if(i && gap) ctx.measure({ x: x - gap, y: bottomY }, { x, y: bottomY });
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
    // Women's aviator shirt: the two places over the nametag hold two badges (4.2.6.2.7.2). A third
    // ordinary badge takes the men's option the same paragraph allows ("as worn on the male aviator
    // shirt"): first badge on the left pocket, second on the right, third over the nametag.
    if(geo.onStyle === 'women-a' && geo.menLayout){
      const ordinary = plan.nationalStaff.length + plan.rest.filter(x => x.family !== 'rocketry' && x.family !== 'marksmanship').length;
      if(ordinary > 2) geo = Object.assign({}, geo, geo.menLayout);
    }
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
    // Pocket badges: from their reference line (welt or nametag) to the badge's top edge (or its
    // centre, for a spot anchored at the centre), or centred halfway between the flap and the bottom
    // of the pocket (`span`).
    const pocketMeasure = spot => {
      if(!spot) return;
      if(spot.span) ctx.measure({ x: spot.x, y: spot.span[0] }, { x: spot.x, y: spot.span[1] }, 'halfway', { mid: { x: spot.x, y: spot.y } });
      else if(spot.from != null) ctx.measure({ x: spot.x, y: spot.from }, { x: spot.x, y: spot.y }, null, spot.anchor === 'top_center' ? null : { center: 'to' });
    };
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
    if(pair.length === 2 && pair[0].family === 'service') pair.reverse();
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

  // The name line of a plate, from the plate spec's name landmark (the zone the artwork leaves for
  // the engraving), scaled with the plate as drawn (D30). The lettering fills the zone's height and
  // shrinks for a long name (C.plateName). `single` is the officer and NCO plate, which carries only
  // the name: the same zone, centred up and down on the plate.
  async function plateNameZone(ctx, plateRect, specId, single){
    const spec = await ctx.spec(specId);
    const r = core.landmarkBounds(spec, 'name');
    if(!r) return null;
    const s = plateRect.w / spec.w;
    const h = r.h * s;
    return { x: plateRect.x + r.x * s, y: single ? plateRect.y + (plateRect.h - h) / 2 : plateRect.y + r.y * s, w: r.w * s, h };
  }

  // The 3-line plate: lines 1 and 2 are drawn on the plate; line 3 is the last name in white.
  async function threeLineName(ctx, b, plateRect, cadet){
    if(!b.name.show || !b.name.last || !plateRect) return;
    const zone = await plateNameZone(ctx, plateRect, cadet ? 'nameplate-3line-cadet' : 'nameplate-3line-adult');
    if(zone) C.plateName(ctx, b.name.last, zone, { color: PLATE_WHITE, key: 'text:name' });
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

  // Chevrons keep their true size and shape, even where the front view shows less sleeve. A drawn sleeve is
  // narrower than the regulation 3 1/2 or 4 in chevron (Class A men's: about 14 percent of the box past the outer
  // edge, the critique 'fills the upper arm', 4.1.5.2.1.2), so on every uniform the chevron is clipped to the
  // sheet's own garment silhouette (layer clipSil): the part past the outer edge reads as wrapping round the
  // arm, no ink lands on the white beside the coat, and the size is never changed (R1, R8).
  async function sleeveChevrons(ctx, id, pts, opts){
    const sil = ctx.base && ctx.base.id ? { clipSil: ctx.base.id } : null;
    for(const side of ['right', 'left']){
      const p = pts[side];
      if(!p) continue;
      await ctx.place(id, Object.assign({ pieceAnchor: 'visual_center', at: { x: p[0], y: p[1] }, rotate: p[2] || 0, z: Z.insignia, role: 'grade', key: 'grade:sleeve-' + side }, sil, opts || {}));
    }
    // Halfway between the shoulder seam and the elbow, shown once, on the outside of the sleeve.
    const s = ctx.point('shoulder_seam_right'), e = ctx.point('elbow_right'), c = ctx.point('chevron_halfway_right');
    if(s && e && c) ctx.measure(s, e, 'halfway', { mid: c, side: { x: -1, y: 0 }, offsetOnly: true });
  }

  // Sleeve chevron points from the sheet: centred halfway between the shoulder seam and the elbow,
  // turned to the line from the seam to the elbow. Null when the sheet has no such anchors.
  function chevronAnchors(ctx){
    const out = {};
    for(const side of ['right', 'left']){
      // A short sleeve has no elbow anchor: the line runs from the seam to the sleeve's bottom edge.
      const c = ctx.point('chevron_halfway_' + side), s = ctx.point('shoulder_seam_' + side), e = ctx.point('elbow_' + side) || ctx.point('sleeve_bottom_' + side);
      if(!c || !s || !e) return null;
      out[side] = [c.x, c.y, Math.atan2(s.x - e.x, e.y - s.y) * 180 / Math.PI];
    }
    return out;
  }

  // Where a piece `w` wide rests on the gorge seam: centred on the seam's midpoint, its bottom edge on
  // the seam, parallel with the ground, not over it (4.1.5.2.1.4, 4.1.5.2.2.1). The seam slopes, so a
  // flat bottom edge rests on the seam's highest point under the piece. Null when the sheet has no seam.
  function seamRest(ctx, side, w){
    const p1 = ctx.point(`gorge_seam_${side}_p1`), p2 = ctx.point(`gorge_seam_${side}_p2`), mid = ctx.point(`gorge_seam_${side}_mid`);
    if(!p1 || !p2 || !mid || p1.x === p2.x) return null;
    const yAt = x => p1.y + (p2.y - p1.y) * (x - p1.x) / (p2.x - p1.x);
    const slope = (p2.y - p1.y) / (p2.x - p1.x);
    return { x: mid.x, y: Math.min(yAt(mid.x - w / 2), yAt(mid.x + w / 2)), yAtCenter: yAt(mid.x), cos: 1 / Math.sqrt(1 + slope * slope) };
  }

  // The bottom-centre point for a placed piece (collar insignia, cadet chevron) resting on the seam.
  async function restOnSeam(ctx, id, side){
    if(!ctx.has(id)) return null;
    const spec = await ctx.spec(id);
    const r = seamRest(ctx, side, spec.w);
    return r ? { x: r.x, y: r.y } : null;
  }

  // The overlay sheets draw the lapel insignia at the seam midpoint. Slide the sheet so each insignia
  // rests on the sloping seam: a rectangular insignia on its highest point, the NCO circle tangent to
  // it. The sheet holds both lapels, mirrored, so one shift serves both.
  function restOverlayOnSeam(ctx, spec, circle){
    const layer = ctx.layers[ctx.layers.length - 1];
    let dy = null;
    for(const side of ['right', 'left']){
      const r = core.landmarkBounds(spec, 'lapel_us_' + side) || core.landmarkBounds(spec, 'lapel_cap_' + side);
      const rest = r && seamRest(ctx, side, r.w);
      if(!rest) continue;
      const d = circle
        ? (rest.yAtCenter - r.h / 2 / rest.cos) - (r.y + r.h / 2)
        : rest.y - (r.y + r.h);
      dy = dy == null ? d : Math.min(dy, d);
    }
    if(dy == null || !layer || layer.type !== 'asset') return;
    layer.y += dy;
    layer.origin = { x: layer.origin.x, y: layer.origin.y + dy };
    layer.noBounds = true; // the garment sheet sets the scene box; the shift only moves the insignia
  }

  // Sampled test: does any part of the box lie inside the polygon (inches)?
  function boxTouchesPolygon(r, poly){
    const inside = p => { let c = false; for(let i = 0, j = poly.length - 1; i < poly.length; j = i++){ const a = poly[i], b = poly[j]; if(((a.y > p.y) !== (b.y > p.y)) && (p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x)) c = !c; } return c; };
    if(poly.some(p => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h)) return true;
    for(let i = 0; i <= 24; i++) for(let j = 0; j <= 24; j++) if(inside({ x: r.x + i * r.w / 24, y: r.y + j * r.h / 24 })) return true;
    return false;
  }

  // Badges that reach a lapel are drawn above the lapel foreground (see BADGE_OVER_LAPEL_Z). The lapel
  // polygons are the coat sheet's lapel_left / lapel_right landmarks.
  function badgesOverLapel(ctx){
    const polys = ['lapel_left', 'lapel_right'].map(n => ctx.landmark(n)).filter(l => l && l.points && l.points.length > 2).map(l => l.points);
    if(!polys.length) return;
    for(const l of ctx.layers){
      if(l.role !== 'badge' || l.z >= BADGE_OVER_LAPEL_Z || (l.rotate || 0)) continue;
      if(polys.some(p => boxTouchesPolygon(l, p))) l.z = BADGE_OVER_LAPEL_Z;
    }
  }

  // The polygon grown outward by `d` inches (a mitred offset), so the leaf's own edge stroke, half of which lies
  // outside the polygon, stays uncovered.
  function growPolygon(pts, d){
    const n = pts.length;
    let area = 0;
    for(let i = 0; i < n; i++){ const p = pts[i], q = pts[(i + 1) % n]; area += p.x * q.y - q.x * p.y; }
    const sgn = area > 0 ? 1 : -1;
    const norm = (p, q) => { const dx = q.x - p.x, dy = q.y - p.y, len = Math.hypot(dx, dy) || 1; return { x: sgn * dy / len, y: -sgn * dx / len }; };
    return pts.map((p, i) => {
      const a = norm(pts[(i + n - 1) % n], p), b = norm(p, pts[(i + 1) % n]);
      const k = Math.max(0.35, 1 + a.x * b.x + a.y * b.y);
      return { x: p.x + (a.x + b.x) / k * d, y: p.y + (a.y + b.y) / k * d };
    });
  }

  // The shirts' collar leaves lie over a badge, ribbon or device that reaches them: a badge pinned on the shirt
  // is under the collar there (4.1.11.1.1.2.3.1, 4.1.12.2.5.1: the second badge 1/2 in above the first, 'under the
  // collar'). The layer is drawn without the leaf polygons (clipOut), the leaf edge's stroke width included.
  const COLLAR_EDGE_GROW = 0.025;
  function tuckUnderCollar(ctx){
    const polys = H.collarPolygons(ctx).map(l => growPolygon(l.points, COLLAR_EDGE_GROW));
    if(!polys.length) return;
    for(const l of ctx.layers){
      if(!['badge', 'ribbon', 'device'].includes(l.role) || (l.rotate || 0) || (l.type !== 'asset' && l.type !== 'raster')) continue;
      const hit = polys.filter(p => boxTouchesPolygon(l, p));
      if(hit.length) l.clipOut = hit;
    }
  }

  // The lapels drawn again over the badges and ribbons they cover (the collar lies on top of them),
  // with the lapel insignia above that.
  async function lapelForeground(ctx, A, g){
    const fg = `${A.layer}-lapel-foreground`;
    if(!ctx.has(fg)) return;
    await ctx.overlay(fg, Z.badge + 0.5);
    const ins = g.category === 'cadet-officer' ? 'lapel-cap' : g.category === 'senior-nco' ? 'lapel-us-nco' : isOfficerLike(g) ? 'lapel-us' : null;
    if(ins){
      const s = await ctx.overlay(`${A.layer}-${ins}`, LAPEL_Z);
      if(s) restOverlayOnSeam(ctx, s, ins === 'lapel-us-nco');
    }
    // Lapel insignia and cadet NCO chevrons sit halfway up the seam, resting on it (4.1.5.2.2.1).
    for(const side of ['right', 'left']){
      const p1 = ctx.point(`gorge_seam_${side}_p1`), mid = ctx.point(`gorge_seam_${side}_mid`), p2 = ctx.point(`gorge_seam_${side}_p2`);
      if(!p1 || !mid || !p2) continue;
      // The coat does not draw the seam: the overlay draws it dashed, measured just below it so
      // the insignia resting on it stays in view.
      ctx.measure(p1, p2, 'halfway', { mid, side: { x: 0, y: 1 }, offsetOnly: true, offsetPx: 5, reference: true });
    }
  }

  // ---- epaulets from the garment's landmark (Class B, aviator shirt, overblouse) ---------------------

  // The garment sheets draw the epaulet sleeve edge-on as a 0.4 in strip over the outer 82% of the
  // strap landmark (the overlay specs' size_basis). The grade sits 5/8 in from the outer end of the
  // epaulet (DAFI 36-2903 4.5.1.1.1), the same place the sleeve's own grade is drawn.
  const EDGE_ON_THICK = 0.4;
  const EDGE_ON_COVER = 0.82;
  const GRADE_FROM_END = 0.625;
  // The top view floats this far (vertical inches) above the shoulder line, never touching it.
  const TOP_VIEW_CLEAR = 0.1;
  // Grades the sleeve art draws turned a quarter turn (bars and stripes lie across the strap).
  const ACROSS_GRADES = new Set(['captain', 'first-lieutenant', 'second-lieutenant', 'flight-officer', 'technical-flight-officer', 'senior-flight-officer']);

  // The grade a member wears on an epaulet sleeve as its own asset (miniature metal for cadet
  // officers, embroidered thread for officers), or null.
  function epauletGradeId(g){
    if(!g.key) return null;
    if(g.category === 'cadet-officer') return G.cadetOfficerInsignia(g, 'metal-miniature');
    if(isOfficerLike(g)) return G.seniorOfficerInsignia(g, 'thread');
    return null;
  }

  // The colonel's eagle faces the art's left; on the wearer's right it is mirrored so the beak points
  // forward on both shoulders (4.1.6.1.2).
  const mirrorsEagle = (g, side) => side === 'right' && g.key === 'colonel' && !g.cadet;

  // Put a grade on an epaulet at its 5/8 in rule distance. `end` is the centre of the epaulet's outer
  // end, `axis` the unit vector toward the neck and `deg` the rotation that stands the art with its
  // top toward the neck; the grade is scaled down (never up) to fit `across` inches of the strap.
  async function gradeOnStrap(ctx, g, side, end, axis, deg, across, opts){
    const id = (opts && opts.id) || epauletGradeId(g);
    if(!id || !ctx.has(id)) return null;
    const gs = await ctx.spec(id);
    const quarter = ACROSS_GRADES.has(g.key) && g.category !== 'cadet-officer';
    const acr = quarter ? gs.h : gs.w, alo = quarter ? gs.w : gs.h;
    const scale = Math.min(1, across / acr);
    const d = GRADE_FROM_END + alo * scale / 2;
    const at = { x: end.x + axis.x * d, y: end.y + axis.y * d };
    const o = opts || {};
    return ctx.place(id, { pieceAnchor: 'center', at, rotate: deg + (quarter ? 90 : 0), scale, flipX: mirrorsEagle(g, side), z: o.z || Z.insignia, role: 'grade', key: o.key || `grade:edge-${side}`, title: o.title });
  }

  // The grade on each edge-on epaulet strip the garment overlay draws (Class B shirt and blouse,
  // aviator shirt): centred on the strip's line, 5/8 in from the strap's outer end, turned with it.
  // `frames` (the Class A coats, whose sheets state the strap as an axis, see strapFrames) gives each
  // side's strap frame; the strip's outer end is the frame's outer end.
  async function epauletEdgeGrades(ctx, g, frames){
    for(const side of ['right', 'left']){
      const f = (frames && frames[side]) || H.epauletFrame(ctx, side);
      const mid = frames ? f && f.outer : ctx.point(`rank_slot_${side}_center`);
      if(!f || !mid) continue;
      // Slide from the strip's centre back along the strap axis to the plane of the outer end.
      const back = (f.outer.x - mid.x) * f.axis.x + (f.outer.y - mid.y) * f.axis.y;
      const end = { x: mid.x + f.axis.x * back, y: mid.y + f.axis.y * back };
      await gradeOnStrap(ctx, g, side, end, f.axis, f.deg, EDGE_ON_THICK - 0.08, { title: `${side === 'right' ? 'Right' : 'Left'} epaulet grade, edge-on` });
    }
  }

  // The two end points of a band's edge that lies `off` inches along the strap normal from the point
  // `c` (a point on the band's centre line), `half` inches either way along the axis.
  function bandEdge(f, c, off, half){
    const q = { x: c.x + f.normal.x * off, y: c.y + f.normal.y * off };
    return [{ x: q.x - f.axis.x * half, y: q.y - f.axis.y * half }, { x: q.x + f.axis.x * half, y: q.y + f.axis.y * half }];
  }

  // How far above the shoulder line (the epaulet landmark's top boundary) a straight edge a-b runs,
  // measured straight up, where the two overlap: { min, max, mean } (negative = below the line, inside).
  function shoulderClearance(f, a, b){
    const xs = f.poly.map(p => p.x);
    const lo = Math.max(Math.min(a.x, b.x), Math.min(...xs)), hi = Math.min(Math.max(a.x, b.x), Math.max(...xs));
    let min = Infinity, max = -Infinity, sum = 0, n = 0;
    for(let i = 0; i <= 40; i++){
      const x = lo + (hi - lo) * i / 40, top = f.topY(x);
      if(top == null) continue;
      const t = (x - a.x) / (b.x - a.x || 1);
      const r = top - (a.y + (b.y - a.y) * t);
      min = Math.min(min, r); max = Math.max(max, r); sum += r; n++;
    }
    return { min, max, mean: n ? sum / n : NaN };
  }

  // A garment sheet with no edge-on epaulet art: the sleeve art squeezed to the 0.4 in strip the other
  // sheets draw, over the outer 82% of the strap, its upper edge on the shoulder line, grade on it.
  async function epauletStrips(ctx, g, sleeveId){
    const edges = {};
    if(!ctx.has(sleeveId)) return edges;
    const s = await ctx.spec(sleeveId);
    for(const side of ['right', 'left']){
      const f = H.epauletFrame(ctx, side);
      if(!f) continue;
      const len = f.length * EDGE_ON_COVER;
      const scale = Math.min(1, len / s.h);
      const half = s.h * scale / 2;
      // Strip centre on the strap axis, outer end flush with the strap's outer end; upper edge flush
      // with the strap's outer side, then lowered until it lies along the shoulder line on average (the
      // overblouse's shoulder curves away under a straight strip).
      const along = { x: f.outer.x + f.axis.x * half, y: f.outer.y + f.axis.y * half };
      const c0 = { x: along.x + f.normal.x * (f.width / 2 - EDGE_ON_THICK / 2), y: along.y + f.normal.y * (f.width / 2 - EDGE_ON_THICK / 2) };
      const upper = bandEdge(f, c0, EDGE_ON_THICK / 2, half);
      const clear = shoulderClearance(f, upper[0], upper[1]);
      const dy = Number.isFinite(clear.mean) ? clear.mean : 0;
      const c = { x: c0.x, y: c0.y + dy };
      edges[side] = upper.map(q => ({ x: q.x, y: q.y + dy }));
      await ctx.place(sleeveId, { pieceAnchor: 'center', at: c, rotate: f.deg, scale, scaleX: EDGE_ON_THICK / (s.w * scale), hideGroups: ['grade', 'cap'], z: Z.epauletLayer, role: 'grade', key: 'epaulet:' + side, title: `${side === 'right' ? 'Right' : 'Left'} epaulet, edge-on` });
      const end = { x: c.x - f.axis.x * half, y: c.y - f.axis.y * half };
      await gradeOnStrap(ctx, g, side, end, f.axis, f.deg, EDGE_ON_THICK - 0.08, { title: `${side === 'right' ? 'Right' : 'Left'} epaulet grade, edge-on` });
    }
  }

  // The epaulet sleeves seen from above, each just above its shoulder: turned to lie along the strap,
  // its near edge TOP_VIEW_CLEAR above the garment's shoulder line (the epaulet landmark's top
  // boundary), the grade in place. Class B, aviator shirt and overblouse (R7).
  async function epauletViews(ctx, g, strips, frames){
    const sleeveId = epauletSleeveId(g);
    if(!sleeveId || !ctx.has(sleeveId)) return;
    const s = await ctx.spec(sleeveId);
    const eagle = g.key === 'colonel' && !g.cadet ? G.seniorOfficerInsignia(g, 'thread') : null;
    const ins = core.anchor(s, 'insignia_center');
    for(const side of ['right', 'left']){
      const f = (frames && frames[side]) || H.epauletFrame(ctx, side);
      if(!f) continue;
      // Centre when the lower edge lies on the strap's outer side, then lifted until it clears the
      // shoulder line everywhere it overlaps the strap.
      const half = { a: s.h / 2, n: s.w / 2 };
      const c0 = { x: f.center.x + f.normal.x * (f.width / 2 + half.n), y: f.center.y + f.normal.y * (f.width / 2 + half.n) };
      const lower = bandEdge(f, c0, -half.n, half.a);
      let minClear = shoulderClearance(f, lower[0], lower[1]).min;
      // A strip drawn above the shoulder line (the overblouse's) is cleared too.
      const st = strips && strips[side];
      if(st){
        const lo = Math.max(Math.min(lower[0].x, lower[1].x), Math.min(st[0].x, st[1].x)), hi = Math.min(Math.max(lower[0].x, lower[1].x), Math.max(st[0].x, st[1].x));
        const yAt = (a, b, x) => a.y + (b.y - a.y) * (x - a.x) / (b.x - a.x || 1);
        for(let i = 0; i <= 20 && hi > lo; i++){
          const x = lo + (hi - lo) * i / 20;
          minClear = Math.min(minClear, yAt(st[0], st[1], x) - yAt(lower[0], lower[1], x));
        }
      }
      const c = { x: c0.x, y: c0.y - (Number.isFinite(minClear) ? TOP_VIEW_CLEAR - minClear : 0) };
      const mirror = mirrorsEagle(g, side) && eagle && ins && ctx.has(eagle);
      await ctx.place(sleeveId, Object.assign({ pieceAnchor: 'center', at: c, rotate: f.deg, z: Z.epauletTop, role: 'epaulet-top', key: `epaulet-top:${side}`, title: `${side === 'right' ? 'Right' : 'Left'} epaulet, seen from above` }, mirror ? { hideGroups: ['grade'] } : {}));
      if(mirror){
        // The sleeve's insignia point, turned with the sleeve about its centre.
        const v = core.rotatePoint({ x: c.x + (ins.x - s.w / 2), y: c.y + (ins.y - s.h / 2) }, c, f.deg);
        await ctx.place(eagle, { pieceAnchor: 'center', at: v, rotate: f.deg, flipX: true, z: Z.epauletTopGrade, role: 'grade', key: 'grade:top-right' });
      }
    }
  }

  // The epaulet sleeve a member wears on the aviator shirt, the Class A coat or the Class B (gray
  // for officers and officer-track members without grade, blue for cadet officers).
  function epauletSleeveId(g){
    if(g.category === 'cadet-officer') return g.key ? `rank-epaulet-sleeve-blue-cadet-${g.key}` : 'rank-epaulet-sleeve-blue-cadet-blank';
    if((g.officer && !g.cadet) || (g.category === 'senior-none' && g.track === 'officer')) return g.key ? `rank-epaulet-sleeve-gray-${g.key}` : 'rank-epaulet-sleeve-gray-blank';
    return null;
  }

  // The wearer's-left epaulet strap axis as [neck end, arm end] points, from the garment's landmark.
  function strapAxis(ctx, side){
    const f = H.epauletFrame(ctx, side);
    return f ? [[f.neck.x, f.neck.y], [f.outer.x, f.outer.y]] : null;
  }

  // Shoulder cord on the wearer's left shoulder (9.3): the cord's neck end on the strap axis, the
  // cord turned to follow it and moved 1/8 in toward the neck.
  async function shoulderCord(ctx, b, axis){
    if(!b.cord) return;
    // The cadet cords are for cadets (9.3); the Aide de Camp cord is also worn by senior members (9.3.4).
    if(!b.grade.cadet && b.cord !== 'aide_de_camp') return;
    const id = String(b.cord).startsWith('cord-') ? b.cord : 'cord-' + String(b.cord).replace(/_/g, '-');
    // The garment's own cord, drawn along its left armhole seam and passing under the epaulet.
    const own = ctx.base && `${ctx.base.id}-${id}`;
    if(own && ctx.has(own)){ await ctx.overlay(own, Z.epauletLayer - 0.5); return; }
    if(!axis) return;
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

  // Headgear is mandatory with the Class A and Class B (the paragraph says so for each cut); a member
  // who picks 'No headgear' is shown bare and told why that is not how the uniform is worn.
  const HEADGEAR_MANDATORY = {
    blues_a: { male: '4.1.6.7', female: '4.1.9.12' },
    blues_b: { male: '4.1.11.1.1.7', female: '4.1.12.9' }
  };
  async function blueHat(ctx, b){
    const h = H.chooseHat(b);
    if(h) await H.hat(ctx, h.hat, h.device);
    else if(b.opt.headgear === 'none'){
      const para = HEADGEAR_MANDATORY[b.uniform] && HEADGEAR_MANDATORY[b.uniform][b.gender === 'female' ? 'female' : 'male'];
      if(para) ctx.note(`Headgear is mandatory with this uniform; it is shown without a cap here (CAPR 39-1, ${para})`);
    }
  }

  // ---- USAF-style Class A service dress (4.1.5, 4.1.9) and cadet semi-formal (4.1.3.2, 4.1.4) --------

  // The shoulder strap on each side of a coat, from the wearer's left strap axis (neck end, arm
  // end) mirrored about the coat's centre: its midpoint and its angle.
  function strapPair(width, neck, arm){
    const mid = { x: (neck[0] + arm[0]) / 2, y: (neck[1] + arm[1]) / 2 };
    const deg = Math.atan2(arm[1] - neck[1], arm[0] - neck[0]) * 180 / Math.PI;
    return { left: { mid, deg }, right: { mid: { x: width - mid.x, y: mid.y }, deg: -deg } };
  }

  // The Class A coat sheets state the shoulder strap as an axis (neck end, arm end) rather than as an
  // epaulet landmark; the strap is the same 0.4 in edge-on epaulet the other sheets draw. This makes
  // the strap's frame (H.epauletFrame's shape) of each side from that axis, so the views from above sit
  // just above the shoulder by the same rule as on the Class B and the aviator shirt (R7).
  function strapFrames(ctx, A){
    const W = ctx.base.w, [n, a] = A.cord, frames = {};
    for(const side of ['left', 'right']){
      const neck = side === 'left' ? { x: n[0], y: n[1] } : { x: W - n[0], y: n[1] };
      const arm = side === 'left' ? { x: a[0], y: a[1] } : { x: W - a[0], y: a[1] };
      const len = Math.hypot(arm.x - neck.x, arm.y - neck.y), u = { x: (arm.x - neck.x) / len, y: (arm.y - neck.y) / len };
      const h = EDGE_ON_THICK / 2, v = { x: -u.y * h, y: u.x * h };
      frames[side] = H.frameFromPolygon(ctx, side, [
        { x: neck.x + v.x, y: neck.y + v.y }, { x: arm.x + v.x, y: arm.y + v.y },
        { x: arm.x - v.x, y: arm.y - v.y }, { x: neck.x - v.x, y: neck.y - v.y }]);
    }
    return frames;
  }

  // Cadet officer shoulder boards (4.1.5.2.1.3): edge-on on the coat sheet, and seen from above, each
  // turned to lie along its strap with its near edge just above the shoulder (R7), the regular-size
  // grade on its rank slot.
  async function cadetBoards(ctx, A, g, sex){
    await ctx.overlay(A.cadetOfficer, Z.epauletLayer);
    const grade = G.cadetOfficerInsignia(g, 'metal-regular');
    const frames = strapFrames(ctx, A);
    for(const side of ['right', 'left']){
      const id = `garment-blues-shoulder-board-top-${sex}-${side}`;
      const f = frames[side];
      if(!ctx.has(id) || !f) continue;
      const s = await ctx.spec(id);
      // The board lies along the strap, its button end toward the neck: turn the art's outer-to-button
      // direction onto the strap's outer-to-neck axis, then rest its near edge TOP_VIEW_CLEAR above the
      // shoulder line (the strap polygon's top boundary), the same lift epauletViews applies.
      const board = core.landmarkBounds(s, 'board'), outer = core.anchor(s, 'board_outer_end'), button = core.anchor(s, 'button_end_center');
      const rot = Math.round((Math.atan2(f.axis.y, f.axis.x) - Math.atan2(button.y - outer.y, button.x - outer.x)) * 18000 / Math.PI) / 100;
      const half = { a: board.w / 2, n: board.h / 2 };
      const c0 = { x: f.center.x + f.normal.x * (f.width / 2 + half.n), y: f.center.y + f.normal.y * (f.width / 2 + half.n) };
      const lower = bandEdge(f, c0, -half.n, half.a);
      const minClear = shoulderClearance(f, lower[0], lower[1]).min;
      const c = { x: c0.x, y: c0.y - (Number.isFinite(minClear) ? TOP_VIEW_CLEAR - minClear : 0) };
      const view = await ctx.place(id, { pieceAnchor: 'center', at: c, rotate: rot, z: Z.epauletTop, role: 'epaulet-top', key: `epaulet-top:${side}`, title: `${side === 'right' ? 'Right' : 'Left'} shoulder board, seen from above` });
      const slot = core.anchor(s, 'rank_slot_center');
      const at = view && slot && core.rotatePoint({ x: c.x + (slot.x - s.w / 2), y: c.y + (slot.y - s.h / 2) }, c, rot);
      if(!at || !grade || !ctx.has(grade)) continue;
      // The grade's discs or diamonds sit side by side across the board (Figure A5-6). The figure's
      // board is wider than this one: a grade wider than the band (the Colonel's three diamonds) is
      // drawn just small enough to sit on it.
      const gs = await ctx.spec(grade), band = core.landmarkBounds(s, 'rank_slot');
      const scale = band ? Math.min(1, (band.h - 0.12) / gs.w, (band.w - 0.12) / gs.h) : 1;
      await ctx.place(grade, { pieceAnchor: 'center', at, rotate: rot + 90, scale, z: Z.epauletTopGrade, role: 'grade', key: 'grade:top-' + side });
    }
  }

  const CLASS_A = {
    male: {
      coat: 'garment-blues-class-a-coat', semi: 'garment-semiformal-class-a-coat-male', layer: 'garment-blues-class-a-coat',
      cadetOfficer: 'garment-blues-class-a-cadet-officer-insignia',
      ncoChevron: { right: [3.19, 9.86, 1.4], left: [20.54, 9.86, -1.4] }, theta: { right: 75.3, left: -75.3 },
      cord: [[16.52, 2.44], [20.22, 3.41]], strap: strapPair(23.726, [16.52, 2.44], [20.22, 3.41])
    },
    female: {
      coat: 'garment-blues-class-a-coat-female', semi: 'garment-semiformal-class-a-coat-female', layer: 'garment-blues-class-a-coat-female',
      cadetOfficer: 'garment-blues-class-a-cadet-officer-insignia-female',
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
    if(g.category === 'cadet-officer'){
      await cadetBoards(ctx, A, g, sex);
      // The edge-on board at the shoulder line carries the grade as well as the view from above (R7).
      await epauletEdgeGrades(ctx, g, strapFrames(ctx, A));
    }
    else if(!semi && g.general) await ctx.overlay(`${A.layer}-general-officer`);
    else if(!semi && isOfficerLike(g)) await ctx.overlay(`${A.layer}-senior-officer`);
    else if(!semi && g.category === 'senior-nco'){
      const s = await ctx.overlay(`${A.layer}-senior-nco-lapel`);
      if(s) restOverlayOnSeam(ctx, s, true);
    }

    // Nametag (not worn on the semi-formal).
    // The plate's place is the full coat's nameplate landmark; the semi-formal coat is the same figure
    // without the plate, so the badges keep the places they would have (4.1.3.2.2).
    const plate = ctx.rect('nameplate') || core.landmarkBounds(await ctx.spec(A.coat), 'nameplate');
    let tagRect = plate;
    if(!semi){
      const tagLayer = g.cadet ? `${A.layer}-nametag-cadet` : `${A.layer}-nametag-officer-nco`;
      await ctx.overlay(tagLayer, Z.tape);
      tagRect = ctx.rect('nametag') || plate;
      ctx.keepClear(tagRect, 'nametag');
      if(b.name.show && b.name.last){
        if(g.cadet) await threeLineName(ctx, b, tagRect, true);
        else{
          const zone = await plateNameZone(ctx, tagRect, 'nameplate-3line-adult', true);
          if(zone) C.plateName(ctx, b.name.last, zone, { color: ENGRAVED_BLUE, key: 'text:name' });
        }
      }
    }

    // Grade.
    if(g.category === 'cadet-nco'){
      for(const side of ['right', 'left']){
        const id = G.cadetNcoChevron(g, 'metal');
        const rest = await restOnSeam(ctx, id, side);
        const at = rest || ctx.point('lapel_insignia_' + side);
        if(at) await ctx.place(id, { pieceAnchor: rest ? 'bottom_center' : 'center', at, z: LAPEL_Z, role: 'grade', key: 'grade:' + side });
      }
    }else if(!semi && g.category === 'senior-nco'){
      const size = sex === 'male' ? '4' : (b.opt.chevron === '3.5' ? '3.5' : '4');
      await sleeveChevrons(ctx, G.seniorChevron(g, { size }), chevronAnchors(ctx) || A.ncoChevron);
    }else if(!semi && isOfficerLike(g)){
      // The coat's epaulets are edge-on in the front view and carry the grade there too, 5/8 in from the
      // outer end like the Class B (D6, D42; R7), as well as on the views from above.
      await epauletEdgeGrades(ctx, g, strapFrames(ctx, A));
      await epauletViews(ctx, g, null, strapFrames(ctx, A));
    }else if(!semi && g.category === 'senior-none' && g.track === 'nco'){
      // Adults without grade on the NCO track wear CAP collar insignia (1.4.2.1).
      for(const side of ['right', 'left']){
        const rest = await restOnSeam(ctx, 'collar-insignia-cap-metal', side);
        const at = rest || ctx.point('lapel_insignia_' + side);
        if(at) await ctx.place('collar-insignia-cap-metal', { pieceAnchor: rest ? 'bottom_center' : 'center', at, z: LAPEL_Z, role: 'grade', key: 'collar:' + side });
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
      // Men: 1 1/2 in below the welt top and below the nametag, edge to edge: the top of the badge
      // (4.1.5.2.2.4.2, Figure 4.6), like every other distance between pieces.
      lp: sex === 'male' ? { x: rest.x, y: rest.y + 1.5, from: rest.y, anchor: 'top_center' } : null,
      rp: sex === 'male' ? { x: tagRect.x + tagRect.w / 2, y: tagRect.y + tagRect.h + 1.5, from: tagRect.y + tagRect.h, anchor: 'top_center' } : null,
      onStyle: sex === 'male' ? 'men' : 'women-a',
      un: { x: tagRect.x + tagRect.w / 2, y: tagRect.y + tagRect.h + 0.5, anchor: 'top_center' }
    };
    if(semi){
      // Only the badge that would go over the nametag moves: it sits even with the bottom of the
      // ribbons. The others keep their service dress places (4.1.3.2.2), so the wearer's right
      // pocket badge stays level with the left one, where the nametag's bottom would be.
      geo.onBottom = rest.y;
      geo.nametag = { x: plate.x, y: rest.y, w: plate.w, h: 0 };
      geo.rp = sex === 'male' ? { x: plate.x + plate.w / 2, y: rest.y + 1.5, from: rest.y, anchor: 'top_center' } : null;
      geo.un = null;
      if(sex === 'male') geo.onStyle = 'men';
    }
    // Men's marksmanship badge: centred on the welt pocket (4.1.5.2.2.4.2). Women's moved rocketry
    // or marksmanship badge: wearer's left, 1 1/2 in below the ribbons (4.1.9.4.4.2).
    if(sex === 'male') geo.marks = { x: rest.x, y: rest.y, anchor: 'top_center' };
    else geo.belowRibbons = { x: rest.x, y: (rack ? rack.y + rack.h : rest.y) + 1.5, anchor: 'top_center' };
    await dressBadges(ctx, b, geo);
    badgesOverLapel(ctx);

    if(!semi){
      await lapelForeground(ctx, A, g);
      await shoulderCord(ctx, b, A.cord);
      await blueHat(ctx, b);
    }else{
      // The cadet semi-formal is the Class A coat drawn without its nameplate (same lapels), and the
      // collar lies over the badges there too: the lapels are drawn again over them, with the cadet
      // officer's lapel CAP above that, as on the Class A (4.1.3.2 and 4.1.4: worn as for the Service
      // Dress). Cadets only, so the lapel U.S. never applies.
      await lapelForeground(ctx, A, g);
    }
  }

  // ---- USAF-style Class B (4.1.11 men, 4.1.12 women) -----------------------------------------------

  // The short-sleeve sheets (shirt, blouse) carry no chevron_halfway anchors, so the sleeve chevron is
  // centred on the outer arm from what they do carry (4.1.11.1.1.1.3, 4.1.12.2.3.3: centred on the outer
  // arm, halfway between the shoulder seam and the bottom edge of the short sleeve):
  //   y  = halfway between the shoulder_seam and sleeve_bottom anchors (men's 8.21 in, women's 8.16 in)
  //   x  = the midline of the drawn sleeve at that height, from the sheet's silhouette (its outer edge)
  //        and its armhole seam line: men's 2.02 in (outer edge 0.51 in, seam 3.52 in, 3.00 in apart),
  //        women's 2.42 in (0.59 in and 4.26 in, 3.68 in apart); the left sleeve mirrors it
  //   turn = the tilt of that midline in degrees toward the outer side at the hem: women's 1.1; the
  //        men's measured 0.3 is left at 0 (it is under what the render can show)
  // The drawn sleeves are narrower than the 3 1/2 in chevron (a wedge: the men's is 3.0 in wide at mid-height
  // and narrower at the top), so the chevron is not scaled (R1) and the part past the sleeve's outer edge is
  // clipped to the sheet's garment silhouette (layer clipSil), reading as wrapping round the arm in front view;
  // it is not clipped at the armhole seam, where the shirt front continues. Remove the table and the clip when
  // the sheets are widened and carry chevron_halfway anchors (FOLLOWUPS, FIX-R-OTHER-r1).
  // Where a sheet draws chevron_halfway anchors of its own they win (chevronAnchors).
  const SHORT_SLEEVE_MIDLINE = {
    'male-short': { x: 2.02, turn: 0 },
    'female-short': { x: 2.42, turn: 1.1 }
  };
  function shortSleeveChevron(ctx, mid){
    const out = {};
    for(const side of ['right', 'left']){
      const s = ctx.point('shoulder_seam_' + side), e = ctx.point('sleeve_bottom_' + side);
      if(!s || !e) return null;
      out[side] = [side === 'right' ? mid.x : ctx.base.w - mid.x, (s.y + e.y) / 2, side === 'right' ? mid.turn : -mid.turn];
    }
    return out;
  }

  const CLASS_B = {
    'male-short': { garment: 'garment-blues-class-b-shirt-male' },
    'male-long': { garment: 'garment-blues-class-b-shirt-male-long', chev: { right: [3.12, 9.75, 2.4], left: [18.20, 9.75, -2.4] } },
    'female-short': { garment: 'garment-blues-class-b-blouse-female' },
    'female-long': { garment: 'garment-blues-class-b-blouse-female-long', chev: { right: [2.31, 8.94, 1.2], left: [17.20, 8.94, -1.2] } }
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
    ctx.keepClear(tag, 'nametag');
    await threeLineName(ctx, b, tag, g.cadet);

    if(g.category === 'cadet-nco'){
      await H.collarChevrons(ctx, g);
    }else if(g.category === 'senior-nco'){
      // Men: 3 1/2 in (4.1.11.1.1.1.3). Women: 3 1/2 or 4 in on either sleeve (4.1.12.2.3.3).
      const size = female && b.opt.chevron === '4' ? '4' : '3.5';
      const id = G.seniorChevron(g, { size });
      const key = (female ? 'female' : 'male') + (long ? '-long' : '-short');
      const sheetPts = chevronAnchors(ctx);
      const midline = !sheetPts && SHORT_SLEEVE_MIDLINE[key] ? shortSleeveChevron(ctx, SHORT_SLEEVE_MIDLINE[key]) : null;
      await sleeveChevrons(ctx, id, sheetPts || midline || V.chev);
    }
    // The epaulet sleeves are edge-on in the front view, each with its grade, and seen from above
    // just over the shoulder with the grade in place (R7).
    await epauletEdgeGrades(ctx, g);
    await epauletViews(ctx, g);

    // Ribbons (optional): men on the left pocket top, women with the bottom even with the nametag.
    const rest = ctx.point('ribbon_row_bottom_center');
    const rack = await ribbonRack(ctx, b, rest, { perRow: 3 });
    const geo = { nametag: tag, olp: { x: rest.x, baseY: rack ? rack.y : rest.y } };
    if(!female){
      const pocketL = ctx.rect('pocket_left'), pocketR = ctx.rect('pocket_right');
      const flapY = pocketL.y + 2.02;
      const midY = (flapY + pocketL.y + pocketL.h) / 2;
      const span = [flapY, pocketL.y + pocketL.h];
      geo.lp = { x: pocketL.x + pocketL.w / 2, y: midY, span };
      geo.rp = { x: pocketR.x + pocketR.w / 2, y: midY, span };
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
    tuckUnderCollar(ctx);
    await shoulderCord(ctx, b, strapAxis(ctx, 'left'));
    await blueHat(ctx, b);
  }

  // ---- Mess dress (4.1.1 men, 4.1.2 women) ------------------------------------------------------------

  const MESS = {
    male: { garment: 'garment-mess-dress-male', chev: { right: [2.61, 11.84, 0.2], left: [23.91, 11.84, -0.2] } },
    female: { garment: 'garment-mess-dress-female', chev: { right: [2.57, 11.27, 1.2], left: [22.95, 11.27, -1.2] } }
  };

  // The mess dress sheets draw each shoulder board flat, lying on the shoulder as seen from above
  // (Figure A5-3, 4.1.1.1.1.1, 4.1.2.1.1.1: as close to the shoulder seam as possible). R7 wants it twice: edge-on
  // at the shoulder line and seen from above just over the shoulder, both carrying the grade. The board art
  // is the view from above, lifted along the board's normal until its lower edge clears the shoulder line by
  // 0.1 in (the overlay copy clipped to the board); the edge-on view is a strip 0.4 in thick whose upper
  // edge is the board's upper edge (the shoulder line, where the drawn board touches the coat's outline),
  // over 82% of the board's length from its outer end, in the board's own colour, the bullion grade on it 5/8 in
  // from the outer end (DAFI 36-2903 4.5.1.1.1) like every other edge-on strip. The boards are 5 1/2 x 2 1/4 in
  // (men, with a button) and 4 1/2 x 2 in (women), Figure A5-3 (the sheets' size_basis).
  const MESS_BOARD = { male: { L: 5.5, W: 2.25 }, female: { L: 4.5, W: 2.0 } };
  const MESS_BOARD_COLOR = { officer: '#2b4f93', general: '#c4c8d0', stroke: '#4d535d' };
  // Bars (2d Lt, 1st Lt, Captain, flight officer grades) lie across the board, as the Fig A5-1 sleeve art and
  // every other uniform draw them: the art's long axis (its height) is perpendicular to the strap, so the
  // turn is the strap's own angle. The leaf, stars and eagle are turned a quarter more: leaf stem and stacked
  // stars along the board, eagle wingspan across it (CAPR 39-1 4.1.1.1.1.1, 4.1.2.1.1.1, Figure A5-3).
  function boardGradeTurn(gradeId, frameDeg){
    return /rank-senior-(second-lieutenant|first-lieutenant|captain|flight-officer|technical-flight-officer|senior-flight-officer)-/.test(gradeId) ? frameDeg : frameDeg + 90;
  }
  async function messBoards(ctx, g, M, female){
    const id = g.general && ctx.has(`${M.garment}-general-officer-shoulder-boards`) ? `${M.garment}-general-officer-shoulder-boards` : `${M.garment}-officer-shoulder-boards`;
    if(!ctx.has(id)){ ctx.note(`No artwork for ${id}`); return; }
    const s = await ctx.spec(id);
    ctx.overlays = ctx.overlays || [];
    ctx.overlays.push(s);
    const { L, W } = MESS_BOARD[female ? 'female' : 'male'];
    const gradeId = g.key ? G.seniorOfficerInsignia(g, 'bullion') : null;
    for(const side of ['right', 'left']){
      const box = core.landmarkBounds(s, 'shoulder_board_' + side), frame = ctx.landmark(`rank_slot_${side}_frame`);
      if(!box || !frame || typeof frame.deg !== 'number') continue;
      const th = frame.deg * Math.PI / 180;
      const a = { x: Math.cos(th), y: Math.sin(th) };            // outer end toward the neck
      const d = a.y > 0 ? { x: a.y, y: -a.x } : { x: -a.y, y: a.x }; // across the board, downward
      if(d.y < 0){ d.x = -d.x; d.y = -d.y; }
      // The board's upper outer corner: its x is the box's outer side, its lower corner is the box's bottom.
      const A = { x: side === 'right' ? box.x : box.x + box.w, y: box.y + box.h - W * d.y };
      const lift = { x: -d.x * (W + TOP_VIEW_CLEAR), y: -d.y * (W + TOP_VIEW_CLEAR) };
      // The view from above: the overlay, lifted, clipped to the board's box.
      const pad = 0.15;
      ctx.layers.push({ type: 'asset', id, x: lift.x, y: lift.y, w: s.w, h: s.h, rotate: 0, origin: { x: lift.x, y: lift.y }, z: Z.epauletTop, role: 'epaulet-top', key: `epaulet-top:${side}`,
        title: `${side === 'right' ? 'Right' : 'Left'} shoulder board, seen from above`,
        clip: [{ x: box.x - pad + lift.x, y: box.y - pad + lift.y }, { x: box.x + box.w + pad + lift.x, y: box.y - pad + lift.y }, { x: box.x + box.w + pad + lift.x, y: box.y + box.h + pad + lift.y }, { x: box.x - pad + lift.x, y: box.y + box.h + pad + lift.y }] });
      if(gradeId && ctx.has(gradeId)){
        const slot = ctx.point(`rank_slot_${side}_center`);
        const turn = boardGradeTurn(gradeId, frame.deg);
        if(slot) await ctx.place(gradeId, { pieceAnchor: 'center', at: { x: slot.x + lift.x, y: slot.y + lift.y }, rotate: side === 'left' && turn < -180 ? turn + 360 : turn,
          flipX: side === 'right' && /colonel-(bullion|thread)$/.test(gradeId) && !/lieutenant/.test(gradeId), z: Z.epauletTopGrade, role: 'grade', key: 'grade:top-' + side });
      }
      // The edge-on view.
      const Ls = L * EDGE_ON_COVER, T = EDGE_ON_THICK;
      const c = { x: A.x + a.x * Ls / 2 + d.x * T / 2, y: A.y + a.y * Ls / 2 + d.y * T / 2 };
      ctx.layers.push({ type: 'rect', x: c.x - Ls / 2, y: c.y - T / 2, w: Ls, h: T, rotate: side === 'right' ? frame.deg : frame.deg + 180, origin: { x: c.x, y: c.y },
        fill: g.general ? MESS_BOARD_COLOR.general : MESS_BOARD_COLOR.officer, stroke: MESS_BOARD_COLOR.stroke, strokeWidth: 0.03, z: Z.epauletLayer, role: 'epaulet-edge', key: `epaulet-edge:${side}`,
        title: `${side === 'right' ? 'Right' : 'Left'} shoulder board, edge-on` });
      if(gradeId && ctx.has(gradeId)){
        const end = { x: A.x + d.x * T / 2, y: A.y + d.y * T / 2 };
        // The grade's art is turned as on the board (its width along the strap), scaled to the strip.
        const gs = await ctx.spec(gradeId);
        const turn = boardGradeTurn(gradeId, frame.deg);
        // The art turned by (turn - frame): its extent across the strip decides the scale, so a piece whose
        // width lies across the strip (eagle, stars, leaf) is scaled by its width and a bar (height across)
        // by its height; it never grows (R1).
        const rel = (turn - frame.deg) * Math.PI / 180, sn = Math.abs(Math.sin(rel)), cs = Math.abs(Math.cos(rel));
        const across = gs.w * sn + gs.h * cs, along = gs.w * cs + gs.h * sn;
        const scale = Math.min(1, (T - 0.08) / across);
        const dist = GRADE_FROM_END + along * scale / 2;
        await ctx.place(gradeId, { pieceAnchor: 'center', at: { x: end.x + a.x * dist, y: end.y + a.y * dist }, rotate: side === 'left' && turn < -180 ? turn + 360 : turn, scale,
          flipX: side === 'right' && /colonel-(bullion|thread)$/.test(gradeId) && !/lieutenant/.test(gradeId), z: Z.insignia, role: 'grade', key: `grade:edge-${side}`,
          title: `${side === 'right' ? 'Right' : 'Left'} shoulder board grade, edge-on` });
      }
    }
  }

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
      await messBoards(ctx, g, M, female);
      await ctx.overlay(g.general ? `${M.garment}-general-officer-sleeve-braid` : `${M.garment}-officer-sleeve-braid`);
    }else if(g.category === 'senior-nco'){
      const size = female && b.opt.chevron === '3.5' ? '3.5' : '4';
      await sleeveChevrons(ctx, G.seniorChevron(g, { white: true, size }), chevronAnchors(ctx) || M.chev);
    }

    // Miniature medals centred between the lapel and the arm seam (4.1.1.1.2.2, 11.2.8).
    const slot = ctx.rect('miniature_medal_slot');
    const center = ctx.point('miniature_medals_center');
    // Midway between the top shoulder seam and the top button (4.1.1.1.2.2, 4.1.2.1.2.2): the
    // sheet's miniature_medals_center is that point.
    const box = await C.drawMiniMedals(ctx, b.medals || [], { w: slot.w, centerX: center.x, centerY: center.y }, { style: b.opt.miniStyle });
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
      if(lpItem && await putBadge(ctx, lpItem, { x: center.x, y: medBottom + 0.5 }, 'top_center')) ctx.measure({ x: center.x, y: medBottom }, { x: center.x, y: medBottom + 0.5 });
      if(rpItem && await putBadge(ctx, rpItem, { x: wrX, y: medBottom + 0.5 }, 'top_center')) ctx.measure({ x: wrX, y: medBottom }, { x: wrX, y: medBottom + 0.5 });
      if(plan.pin){
        const y = plan.pin.graduated ? medBottom : medTop;
        await putBadge(ctx, { id: plan.pin.id, art: plan.pin.art, title: plan.pin.title }, { x: wrX, y }, plan.pin.graduated ? 'bottom_center' : 'top_center', `badge:${plan.pin.id}:${plan.pin.graduated ? 'UN' : 'ON'}:0`);
      }
      if(others.length > 2) ctx.note('Some badges have no place left on this uniform and are not shown');
    }else{
      // Women: badges on the wearer's right, tops even with the top of the medals; the current pin
      // 1/2 in above them and the graduated pin 1/2 in below them.
      const pair = others.slice(0, 2);
      if(pair.length === 2 && pair[0].family === 'service') pair.reverse();
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
        if(plan.pin.graduated){
          await putBadge(ctx, pin, { x: wrX, y: (pair.length ? bottom : medBottom) + (pair.length ? 0.5 : 0) }, pair.length ? 'top_center' : 'bottom_center', key);
          if(pair.length) ctx.measure({ x: wrX, y: bottom }, { x: wrX, y: bottom + 0.5 });
        }else{
          await putBadge(ctx, pin, { x: wrX, y: pair.length ? top - 0.5 : top }, pair.length ? 'bottom_center' : 'top_center', key);
          if(pair.length) ctx.measure({ x: wrX, y: top }, { x: wrX, y: top - 0.5 });
        }
      }
      if(others.length > 2) ctx.note('Some badges have no place left on this uniform and are not shown');
    }
  }

  // ---- Corporate: aviator shirt (4.2.5 men, 4.2.6 women) -----------------------------------------------

  // Per garment: the sleeve chevron points of the sheets that state no sleeve anchors (the long sleeves use the
  // sheet's nco_chevron points and a turn, the overblouse literal points), the visible sleeve width and collar angle. The
  // epaulet's angle and width come from the garment's epaulet landmark (H.epauletFrame).
  const AVIATOR = {
    'garment-aviator-shirt-male': { sleeveW: 2.93 },
    'garment-aviator-shirt-male-long': { chevAnchors: 11.6, sleeveW: 3.2 },
    'garment-aviator-shirt-female': { sleeveW: 2.56 },
    'garment-aviator-shirt-female-long': { chevAnchors: 10, sleeveW: 2.9 },
    'garment-overblouse-female': { chev: { right: [3.83, 8.88, 31], left: [17.57, 8.88, -31] }, sleeveW: 2.6, overblouse: true },
    'garment-overblouse-female-long': { chevAnchors: 31, sleeveW: 2.9, overblouse: true }
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
    if(epCat && ctx.has(`${garment}-epaulet-sleeve-${epCat}`)){
      await ctx.overlay(`${garment}-epaulet-sleeve-${epCat}`, Z.epauletLayer);
      await epauletEdgeGrades(ctx, g);
      await epauletViews(ctx, g);
    }else if(ep){
      // The overblouse sheet has no edge-on sleeve art: the sleeve art is drawn as the same 0.4 in
      // strip over the outer 82% of the strap landmark, seated on the shoulder line, with the grade
      // at its true shape on it; the top view floats above the shoulder as on the shirts.
      await epauletViews(ctx, g, await epauletStrips(ctx, g, ep));
    }else if(g.category === 'cadet-nco'){
      await H.collarChevrons(ctx, g);
    }else if(g.category === 'senior-nco'){
      // 3 1/2 in chevrons only (4.2.5.1.1.3, 4.2.6.2.3).
      const id = G.seniorChevron(g, { size: '3.5' });
      // The short-sleeve shirt sheets state shoulder_seam, sleeve_bottom and chevron_halfway anchors on the sleeve as drawn (widened so the true-size chevron lies on it), so
      // they win over the literal points, as on the Class B sheets (chevronAnchors); the long sleeves and the overblouse keep their own points.
      let pts = chevronAnchors(ctx) || V.chev;
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
    await threeLineName(ctx, b, tag, g.cadet);

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
      if(!V.overblouse){
        // With three ordinary badges: the men's layout (pockets and over the nametag), 4.2.6.2.7.2.
        geo.menLayout = { onStyle: 'men', lp: geo.lp, rp: geo.rp, marks: flapTop };
        geo.rp = null;
      }
      geo.un = { x: tag.x + tag.w / 2, y: tag.y + tag.h + 0.5, anchor: 'top_center' };
    }
    // On the aviator shirt the command insignia is worn only by officers (4.2.5.1.3.3, 4.2.6.2.7.3).
    if(b.command && !(g.officer && !g.cadet)){
      ctx.note('On the aviator shirt the command insignia is worn only by officers (CAPR 39-1, 4.2.5.1.3.3)');
      b = Object.assign({}, b, { command: null });
    }
    await dressBadges(ctx, b, geo);
    tuckUnderCollar(ctx);
    // The long-sleeve shirt is worn with a tie, or a tie tab for women (4.2.5.1.4, 4.2.6.3).
    if(long && !V.overblouse){
      const tie = `${garment}-${female ? 'tie-tab' : 'tie'}`;
      if(ctx.has(tie)) await ctx.overlay(tie, Z.garmentLayer + 0.5);
    }
  }

  // ---- Corporate Service Dress (blazer, 4.2.3 / 4.2.4) and Corporate Semi-Formal (4.2.1 / 4.2.2) ---------

  // Nametag top even with the top of the left breast pocket, the crest centred on the pocket below
  // it (4.2.3.1.1.1-2, Figures 4.14 and 4.15); the sheets carry both slots. The crest, and the badge
  // that replaces it, sit at the sheet's crest_center: the centre of the pocket body below the welt
  // opening, traced from the base image. Centring them on the 1 in welt strip put the crest about
  // 0.9 in above the pocket and was rejected (tracker placement item 4).
  const BLAZER = {
    male: { garment: 'garment-corporate-service-dress-blazer-male', bowTie: { x: 12.761, y: 3.655 }, underlayer: { turtleneck: 'garment-underlayer-turtleneck-male' }, cover: ['shirt', 'tie', 'shirt-collar'] },
    female: { garment: 'garment-corporate-service-dress-blazer-female', plate: null, underlayer: { turtleneck: 'garment-underlayer-turtleneck-female', shell: 'garment-underlayer-shell-female' }, cover: ['shirt', 'tie-tab'] }
  };

  // The wearer's left lapel of each blazer sheet (the `lapel-left` path of its lapel-foreground group, in garment
  // inches: the group's art frame translate + the path's points), used to keep the miniature medals clear of it. A
  // sheet that states a `lapel_left` landmark polygon wins. FOLLOWUP (art): state lapel_left / lapel_right on the
  // blazer sheets as the Class A coats do.
  const BLAZER_LAPEL_LEFT = {
    male: [[15.98, 1.07], [15.3, 0.95], [12.74, 15.03], [13.02, 17.07], [13.39, 16.4], [14.13, 15.06], [15.24, 13.05], [16.72, 10.37], [17.73, 8.32], [18.27, 6.9], [18.34, 6.11], [17.94, 5.94], [17.64, 5.82], [17.44, 5.73], [17.34, 5.69]],
    female: [[9.56, 13.79], [9.99, 12.93], [10.23, 12.06], [10.46, 11.2], [10.68, 10.34], [10.89, 9.47], [11.07, 8.59], [11.22, 7.71], [11.35, 6.83], [11.47, 5.94], [11.56, 5.05], [11.65, 4.17], [11.7, 3.27], [11.71, 2.38], [11.64, 1.49], [11.56, 0.9], [11.54, 0.49], [11.88, 0.96], [12.55, 1.9], [13.18, 2.8], [13.78, 3.64], [14.19, 4.51], [14.41, 5.4], [14.11, 6.68], [13.29, 8.34], [12.45, 9.93], [11.58, 11.45], [10.71, 12.82], [9.84, 14.06], [9.41, 14.69]]
  };
  function blazerLapel(ctx, female){
    const l = ctx.landmark('lapel_left');
    return l && l.points && l.points.length > 2 ? l.points : BLAZER_LAPEL_LEFT[female ? 'female' : 'male'];
  }

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
      // The nametag's top edge is even with the top of the left breast pocket, on the wearer's right,
      // straight across from it (4.2.3.1.1.2 men, Figure 4.15; 4.2.4.1.1.2 women: on a slanted pocket
      // the tag is aligned straight across from the pocket's inside edge, which is on the opposite side).
      // The sheet's nameplate_slot is the line and height of that edge, on the pocket's own side, so the
      // tag goes at the slot's top y with x mirrored about the blazer's centre line, as the men's. The
      // chaplain badge follows the tag (4.2.4.1.1.3); the crest, or the badge in its place, stays at the
      // sheet's crest_center with nothing over it. Only a sheet with no pocket and no slot falls back to
      // the nametag 1/2 in above the crest or the service badge in its place (4.2.4.1.1.2).
      const slotAt = ctx.point('nameplate_slot_center');
      const slotRect = ctx.rect('nameplate_slot');
      let plateAt = slotAt && { x: ctx.base.w - slotAt.x, y: slotAt.y };
      const crestTopPt = ctx.point('crest_top_center');
      let abovePlateFallback = false;
      if(female){
        if(slotRect){
          plateAt = { x: ctx.base.w - (slotRect.x + slotRect.w / 2), y: slotRect.y + ps.h / 2 };
        }else if(crestTopPt){
          const top = crestLayer ? crestLayer.y : crestTopPt.y;
          plateAt = { x: crestTopPt.x, y: top - 0.5 - ps.h / 2 };
          abovePlateFallback = true;
        }
      }
      // The tag lies on the coat front, not on the lapel: its inner end (the top right corner, where the lapel
      // edge runs under the slot) clears the wearer's right lapel by 0.1 in. The lapel polygon is the wearer's
      // left lapel mirrored about the blazer's centre line; the tag keeps its top edge and moves outward (4.2.4.1.1.2).
      if(female && plateAt){
        const lapelR = blazerLapel(ctx, true).map(q => Array.isArray(q) ? { x: ctx.base.w - q[0], y: q[1] } : { x: ctx.base.w - q.x, y: q.y });
        const GAP = 0.1;
        let moved = 0;
        const hits = d => C.rectHitsPolygon({ x: plateAt.x - ps.w / 2 - GAP - d, y: plateAt.y - ps.h / 2, w: ps.w + 2 * GAP, h: ps.h }, lapelR);
        while(moved < 1 && hits(moved)) moved += 0.01;
        plateAt = { x: plateAt.x - moved, y: plateAt.y };
      }
      const plate = await ctx.place(plateId, { pieceAnchor: 'center', at: plateAt, z: Z.tape, role: 'nametag', key: 'nametag' });
      if(abovePlateFallback) ctx.measure({ x: plate.x + plate.w / 2, y: plate.y + plate.h }, { x: plate.x + plate.w / 2, y: plate.y + plate.h + 0.5 });
      if(b.name.show){
        // Last name and state (4.2.3.1.1.2).
        const nameZone = H.pieceRect(plate, ps, 'name');
        if(nameZone && b.name.last) C.plateName(ctx, b.name.last, nameZone, { color: PLATE_WHITE, key: 'text:name' });
        const stateZone = H.pieceRect(plate, ps, 'state');
        if(stateZone && b.name.state) C.plateName(ctx, b.name.state, stateZone, { color: PLATE_WHITE, key: 'text:state' });
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
    // The rack sits 1/2 in above the crest (4.2.1.4, 4.2.2.4) and the medal nearest the lapel is fully exposed
    // (11.2.8): the lapel does not cover a miniature medal (11.1.8 lets only the service coat's lapel cover ribbons),
    // so where the drawn lapel reaches the rack it slides toward the arm until its lapel-side column clears the
    // lapel polygon (the lowest row keeps its line 1/2 in over the crest).
    const box = await C.drawMiniMedals(ctx, b.medals || [], { w: ms.w, centerX: medalX, bottomY: crestTop - 0.5 }, { style: b.opt.miniStyle, avoid: [blazerLapel(ctx, female)], avoidDir: 1 });
    if(box) ctx.measure({ x: box.x + box.w / 2, y: crestTop }, { x: box.x + box.w / 2, y: crestTop - 0.5 });
    if(chaplain){
      const y = (box ? box.y : ms.y + ms.h) - 0.5;
      await ctx.place(chaplain.art, { pieceAnchor: 'bottom_center', at: { x: box ? box.x + box.w / 2 : ms.x + ms.w / 2, y }, z: Z.badge, role: 'badge', key: 'badge:' + chaplain.id, title: chaplain.title, className: 'badge' });
    }
    // The lapel (and the collar, over the bow tie) is drawn again above the garment layers but under every
    // miniature medal, device and badge, so nothing worn on the chest is under it.
    ctx.foreground(['lapel-foreground'], Z.garmentLayer + 0.5);
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
