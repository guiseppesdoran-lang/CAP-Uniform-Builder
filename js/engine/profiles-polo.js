// The CAP Corporate Working Uniform, the polo (CAPR 39-1 5.3, Figure 5.5): a dark blue knit or tactical polo shirt,
// medium gray trousers (men) or skirt (women, 5.3.4) and a black belt (5.3.5), drawn on one garment sheet per cut and
// sleeve length. Three shirts are authorized and the member chooses one:
//   embroidered   5.3.1.1  knit polo, CAP seal embroidered on the RIGHT breast; the member's name in white thread and one
//                          badge or a duty title on the LEFT breast are optional (5.3.2.1.1). Men's has a left chest pocket;
//                          the women's version has none and a woman may wear either (5.3.1.1).
//   print         5.3.1.2  knit polo, CAP seal screen-printed in white on the LEFT breast and nothing else: "No accoutrements"
//                          (5.3.2.1.2), so no name, badge or title.
//   tactical      5.3.1.3  tactical polo, seal embroidered on the right breast, pen pocket on the left sleeve; name and the one
//                          badge or title as on the knit polo (5.3.2.1.1). Women may wear either the men's or the women's cut.
// No grade insignia is authorized (5.3.2), no ribbons or medals (11.1.3, 11.1.6), no cords, nameplate or patches. Headgear is not
// required; the CAP baseball cap may be worn (5.3.7).
//
// Everything is placed from the sheet's own landmarks (sheet hundredths of an inch, read by core): seal_slot, name_slot, badge_slot,
// print_seal_slot, pen_pocket_slot, pocket. The regulation gives one distance, the badge or title "1/2 inch over the name" (5.3.2.1.1).
(function(root, factory){
  const node = typeof module === 'object' && module.exports;
  const deps = node
    ? { core: require('./core.js'), C: require('./compose.js'), P: require('./profiles.js'), R: require('../../data/uniform-rules.js'), B: require('../../data/badge-catalog.js') }
    : { core: root.CAPUBEngine.core, C: root.CAPUBEngine.compose, P: root.CAPUBEngine.profiles, R: root.CAPUBUniformRules, B: root.CAPUBBadgeCatalog };
  const api = factory(deps.core, deps.C, deps.P, deps.R, deps.B);
  if(node) module.exports = api;
})(typeof self !== 'undefined' ? self : this, function(core, C, P, RULES, B){
  'use strict';
  const Z = C.Z;
  const H = P.helpers;

  // White embroidery thread (5.3.2.1.1): the lettering of the name and of a duty title.
  const THREAD_WHITE = '#f4f6f8';
  // The badge or title sits 1/2 in over the name (5.3.2.1.1).
  const OVER_NAME = 0.5;
  const SEAL_ID = 'insignia-cap-seal';
  // The CAP baseball cap (5.3.7), tried in this order: the sheet the art registers for it.
  const CAP_IDS = ['hat-baseball-cap-blue', 'hat-baseball-cap'];
  // The families 5.3.2.1.1 names: a CAP aviation, occupational or specialty track badge (the chaplain badge is an occupational badge).
  const BADGE_ORDER = ['chaplain', 'aviation', 'occupational', 'specialty'];

  function sheetId(b){
    // A woman may wear either cut (5.3.1.1, 5.3.1.3); a man wears the men's.
    const womens = b.gender === 'female' && b.opt.poloCut !== 'male';
    return `garment-polo-${womens ? 'female' : 'male'}${b.opt.sleeve === 'long' ? '-long' : ''}`;
  }
  function shirtOf(b){
    return ['print', 'tactical'].includes(b.opt.poloShirt) ? b.opt.poloShirt : 'embroidered';
  }

  // A rectangle landmark in scene inches. The sheets state a plain rectangle as {x, y, w, h} (top-left, hundredths of an inch), which
  // core reads; a slot stated as {x, y, w_in, h_in} is {x, y} = the CENTRE of the slot in hundredths and the size in inches (the polo
  // sheets' landmarks_note), read here.
  function slotRect(ctx, name){
    const r = ctx.rect(name);
    if(r) return r;
    const raw = ctx.base && ctx.base.raw && ctx.base.raw.landmarks && ctx.base.raw.landmarks[name];
    if(raw && Number.isFinite(raw.x) && Number.isFinite(raw.w_in)) return { x: raw.x / 100 - raw.w_in / 2, y: raw.y / 100 - raw.h_in / 2, w: raw.w_in, h: raw.h_in };
    return null;
  }
  // The centre of a slot (or a point landmark {x, y}, or an anchor of the same name), in scene inches.
  function slotPoint(ctx, name){
    const raw = ctx.base && ctx.base.raw && ctx.base.raw.landmarks && ctx.base.raw.landmarks[name];
    if(raw && Number.isFinite(raw.x) && Number.isFinite(raw.y) && !('w' in raw)) return { x: raw.x / 100, y: raw.y / 100 };
    const r = slotRect(ctx, name);
    return r ? core.rectCenter(r) : (ctx.point(name) || ctx.point(name.replace(/_slot$/, '_center')));
  }

  // The CAP baseball cap (5.3.7): the front view and the back view, each in the box the sheet's hat_view landmark states ({x, y, w, h},
  // top-left, hundredths), the back 0.5 in to the picture's right of the front. A sheet without hat_view seats the front on the figure
  // like the other caps.
  async function baseballCap(ctx){
    const front = CAP_IDS.find(h => ctx.has(h));
    if(!front){ ctx.note('No artwork for the CAP baseball cap'); return; }
    const view = ctx.base.raw && ctx.base.raw.landmarks && ctx.base.raw.landmarks.hat_view;
    if(!view || !view.front) return H.hat(ctx, front, null);
    const put = async (id, box, z, role) => {
      const spec = await ctx.spec(id);
      return ctx.place(id, { pieceAnchor: { x: 0, y: 0 }, at: { x: box.x / 100, y: box.y / 100 }, scale: (box.w / 100) / spec.w, z, role, key: role + ':' + id, className: role });
    };
    await put(front, view.front, Z.hat, 'hat');
    const back = front + '-back';
    if(view.back && ctx.has(back)) await put(back, view.back, Z.hat, 'hat-view');
    else if(view.back) ctx.note('No artwork for the back of the CAP baseball cap');
  }

  async function seal(ctx, slot){
    if(!slot){ ctx.note('This polo sheet states no seal_slot, so the CAP seal is not placed'); return null; }
    const spec = await ctx.spec(SEAL_ID);
    // The seal is 2 1/2 in across (Figure A6-4); the slot states the size the sheet gives it.
    const k = slot.w / spec.w;
    return ctx.place(SEAL_ID, { pieceAnchor: 'center', at: core.rectCenter(slot), scale: k, z: Z.insignia, role: 'seal', key: 'polo:seal', title: 'CAP seal', className: 'seal' });
  }

  // The one badge the left breast takes (5.3.2.1.1), from the families the paragraph names; the others are noted, not drawn.
  function chosenBadge(ctx, b){
    // The family decides first: a badge of another family (service, national staff, rocketry, marksmanship, cadet specialty) is not
    // worn here whatever art it has.
    const wearable = (b.badges || []).filter(sel => {
      const fam = B.family(sel.id);
      if(!fam || fam === 'command') return false;
      if(RULES.allowsBadgeFamily('polo', fam)) return true;
      ctx.note(`${sel.title || (B.get(sel.id) || {}).name || sel.id} is not worn on the polo: only a CAP aviation, occupational or specialty track badge, or a duty title (CAPR 39-1, 5.3.2.1.1)`);
      return false;
    });
    const set = H.badgeSet(ctx, Object.assign({}, b, { badges: wearable }), 'field');
    const allowed = BADGE_ORDER.flatMap(key => set[key] || []);
    if(allowed.length > 1){
      const ordered = C.preferred(allowed, (b.badgeChoices || {}).polo);
      ctx.note('Only one badge or duty title is worn on the polo; the others are not shown (CAPR 39-1, 5.3.2.1.1)');
      C.reportBadgeConflict(ctx, 'polo', 'badge on the polo', allowed, ordered, 1);
      return ordered[0];
    }
    return allowed[0] || null;
  }

  // The embroidered name (5.3.2.1.1): first and last name in white thread on the left breast, block capitals sized to the slot.
  function embroideredName(ctx, b, slot){
    const text = [b.name.first, b.name.last].map(s => String(s || '').trim()).filter(Boolean).join(' ');
    if(!slot) return { text, nameTop: null, layer: null };
    if(!text || !b.name.show || b.opt.poloName === false) return { text: '', nameTop: slot.y + slot.h / 2 - 0.9 * slot.h / 2, layer: null };
    const r = C.plateName(ctx, text, slot, { color: THREAD_WHITE, fill: 0.9, key: 'text:polo-name' });
    return { text, nameTop: slot.y + slot.h / 2 - r.capH / 2, layer: r.layer, capH: r.capH };
  }

  // A duty title (5.3.2.1.1), in the name's lettering, its capitals' bottom 1/2 in over the name; too long for the slot and it is
  // condensed, then made smaller, like the name.
  function dutyTitle(ctx, text, slot, bottom){
    const zone = { x: slot.x, y: 0, w: slot.w, h: slot.h };
    zone.y = bottom - 0.9 * slot.h / 2 - zone.h / 2;
    const r = C.plateName(ctx, text, zone, { color: THREAD_WHITE, fill: 0.9, key: 'text:polo-title' });
    const off = r.layer.y - (zone.y + zone.h / 2);
    r.layer.y = (bottom - r.capH / 2) + off;
    return r;
  }

  async function composePolo(ctx, b){
    const g = b.grade;
    const id = sheetId(b);
    const shirt = shirtOf(b);
    // The printed polo has no pocket or accoutrements (5.3.1.2, 5.3.2.1.2): the men's sheet's pocket is hidden.
    await ctx.garment(id, shirt === 'print' ? { hideGroups: ['pocket'] } : null);

    // Headgear: not required; the CAP baseball cap may be worn (5.3.7).
    if(b.opt.baseballCap) await baseballCap(ctx);

    // The tactical shirt's own cloth (pen pocket on the left sleeve, 5.3.1.3) and the screen-printed shirt's print are overlays of the sheet.
    const pen = slotRect(ctx, 'pen_pocket_slot');
    if(shirt === 'tactical'){
      await ctx.overlay(`${id}-tactical`);
      if(pen) ctx.keepClear(pen, 'pen_pocket_slot', true);
    }
    const pocket = shirt === 'print' ? null : ctx.rect('pocket');
    if(pocket) ctx.keepClear(pocket, 'pocket', true);

    if(g && g.category !== 'senior-none') ctx.note('No grade insignia is worn on the polo (CAPR 39-1, 5.3.2)');
    if(b.ribbons && b.ribbons.length || b.medals && b.medals.length) ctx.note('Ribbons and medals are not worn with the Corporate Working Uniform (CAPR 39-1, 11.1.3)');
    if(b.patches && b.patches.length) ctx.note('No patches are worn on the polo (CAPR 39-1, 5.3.2.1)');
    if(b.command) ctx.note('The command insignia is not worn on the polo (CAPR 39-1, 5.3.2.1.1)');

    const wantsName = !!(b.name.show && (b.name.first || b.name.last)) && b.opt.poloName !== false;
    const wantsMark = (b.badges || []).some(x => x) || (b.opt.poloMark === 'title' && String(b.opt.dutyTitle || '').trim());

    if(shirt === 'print'){
      // 5.3.1.2, 5.3.2.1.2: the seal screen-printed in white on the left breast, no accoutrements.
      await ctx.overlay(`${id}-seal-print`);
      const ps = slotRect(ctx, 'print_seal_slot');
      if(ps) ctx.keepClear(ps, 'print_seal_slot');
      if(wantsName || wantsMark) ctx.note('The polo with the seal screen-printed has no accoutrements, so no name, badge or duty title is shown (CAPR 39-1, 5.3.2.1.2)');
      return;
    }

    // 5.3.1.1, 5.3.1.3: the seal embroidered on the right breast.
    await seal(ctx, slotRect(ctx, 'seal_slot'));

    // 5.3.2.1.1: the name on the left breast, the badge or title 1/2 in over it.
    const nameSlot = slotRect(ctx, 'name_slot');
    const name = embroideredName(ctx, b, nameSlot);
    const badgeAt = slotPoint(ctx, 'badge_slot');
    const x = badgeAt ? badgeAt.x : (nameSlot ? nameSlot.x + nameSlot.w / 2 : null);
    if(!nameSlot || x == null){
      if(wantsName || wantsMark) ctx.note('This polo sheet states no name_slot, so the name and the badge are not placed');
      return;
    }
    const bottom = name.nameTop - OVER_NAME;
    const measureOver = (from, to) => ctx.measure({ x, y: from }, { x, y: to });

    if(b.opt.poloMark === 'title'){
      const text = String(b.opt.dutyTitle || '').trim();
      if((b.badges || []).length) ctx.note('A duty title is worn in place of the badge (CAPR 39-1, 5.3.2.1.1)');
      if(text){
        dutyTitle(ctx, text, nameSlot, bottom);
        measureOver(name.nameTop, bottom);
      }
      return;
    }
    const pick = chosenBadge(ctx, b);
    if(!pick) return;
    const spec = await ctx.spec(pick.art);
    const bottomAnchor = core.anchor(spec, 'art_bottom_center') ? 'art_bottom_center' : 'bottom_center';
    const layer = await ctx.place(pick.art, { pieceAnchor: bottomAnchor, at: { x, y: bottom }, z: Z.badge, role: 'badge', key: 'badge:' + pick.id, title: pick.title, className: 'badge',
      // Embroidered on the shirt itself, not sewn on as a patch: the field badge's dark blue cloth backing is not drawn (its silver art is).
      hideGroups: ['backing'] });
    if(layer) measureOver(name.nameTop, bottom);
  }

  P.register('polo', { title: 'Corporate Working Uniform (Polo)', compose: composePolo });
  return { sheetId, shirtOf, composePolo };
});
