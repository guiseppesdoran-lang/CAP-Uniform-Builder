// Uniform engine, part 5: one profile per uniform.
//
// A profile says which garment and layers the member wears and where each kind of item goes, in
// terms of the garment's own anchors and the regulation's distances. The member's selections come
// in as a `build` (see js/uniform-view.js, which makes it from the page state):
//   { uniform, gender, grade (grades.gradeInfo), opt {...garment options}, name {first,last,capTape,show},
//     ribbons [...], medals [...], badges [{id,family,title}], command {id,graduated}|null,
//     militaryBadges [...], patches [{id,href,aspect,slot,title}], cord }
// Paragraph numbers are CAPR 39-1 (with the ICLs through 26-04; where an ICL changed a rule, the ICL
// is followed).
(function(root, factory){
  const node = typeof module === 'object' && module.exports;
  const deps = node
    ? { core: require('./core.js'), compose: require('./compose.js'), grades: require('./grades.js'), badges: require('../../data/badge-catalog.js') }
    : { core: root.CAPUBEngine.core, compose: root.CAPUBEngine.compose, grades: root.CAPUBEngine.grades, badges: root.CAPUBBadgeCatalog };
  const api = factory(deps.core, deps.compose, deps.grades, deps.badges);
  if(node) module.exports = api;
  else { root.CAPUBEngine = root.CAPUBEngine || {}; root.CAPUBEngine.profiles = api; }
})(typeof self !== 'undefined' ? self : this, function(core, C, G, B){
  'use strict';
  const Z = C.Z;
  const SILVER_TEXT = '#c9ced6';

  // ---- helpers shared by the profiles -------------------------------------------------------

  // A landmark of a placed piece, in scene inches (for zones on a nametag, a hat's device slot...).
  function pieceRect(layer, spec, name){
    const r = core.landmarkBounds(spec, name);
    if(!r) return null;
    const s = layer.w / spec.w;
    return { x: layer.x + r.x * s, y: layer.y + r.y * s, w: r.w * s, h: r.h * s };
  }
  function piecePoint(layer, spec, name){
    const a = core.anchor(spec, name);
    if(!a) return null;
    const s = layer.w / spec.w;
    return { x: layer.x + a.x * s, y: layer.y + a.y * s };
  }

  // Fit a piece in a rect (never larger than true size) and centre it there.
  async function fitCenter(ctx, id, rect, opts){
    return C.fitIn(ctx, id, rect, opts);
  }

  // Scale a piece so it fits maxW x maxH (never up), centred on a point.
  async function placeFitted(ctx, id, at, maxW, maxH, opts){
    const s = await ctx.spec(id);
    const scale = Math.min(1, maxW / s.w, maxH / s.h);
    return ctx.place(id, Object.assign({ pieceAnchor: 'center', at, scale }, opts));
  }

  // The badges a member wears on a uniform, split by Attachment 4 family, each with the art for the
  // uniform's form ('dress' | 'field' | 'cloth' | 'mini'); badges without art in that form are noted.
  function badgeSet(ctx, b, form){
    const out = { chaplain: [], aviation: [], occupational: [], specialty: [], service: [], nationalStaff: [], rocketry: [], marksmanship: [], cadetSpecialty: [], all: [] };
    for(const sel of b.badges || []){
      const fam = B.family(sel.id);
      if(!fam || fam === 'command') continue;
      const art = B.art(sel.id, form, sel.level) || (form === 'mini' ? B.art(sel.id, 'dress', sel.level) : null);
      if(!art){ ctx.note(`${sel.title || sel.id} has no ${form} artwork, so it is not shown on this uniform`); continue; }
      const item = { id: sel.id, art, family: fam, title: sel.title || sel.id };
      const key = { 'national-staff': 'nationalStaff', 'cadet-specialty': 'cadetSpecialty' }[fam] || fam;
      (out[key] || out.specialty).push(item);
      out.all.push(item);
    }
    // Only one CAP aviation badge is worn (4.1.5.2.2.4.1); keep the first the member listed.
    if(out.aviation.length > 1){
      ctx.note('Only one CAP aviation badge is worn; the others are not shown (CAPR 39-1, 4.1.5.2.2.4.1)');
      out.aviation = out.aviation.slice(0, 1);
    }
    return out;
  }

  function commandPin(ctx, b, form){
    if(!b.command) return null;
    const art = B.art(b.command.id, form);
    if(!art){ ctx.note(`${b.command.title || b.command.id} has no ${form} artwork`); return null; }
    return { id: b.command.id, art, graduated: !!b.command.graduated, title: b.command.title || b.command.id };
  }

  // Grade label for nametags (flight tags, blazer plate).
  function gradeAbbrev(g){ return String(g.rank || '').replace(/^C\//, ''); }

  // Hats sit on the uniform: the hat's garment_attach_center goes on the garment's top_center; the
  // device's mount_center goes on the hat's device_slot_center (MANIFEST conventions).
  async function hat(ctx, hatId, device){
    // Flight caps are drawn per cut: the men's caps from the men's figure, the plain ids are the
    // women's (Figure A5-9).
    const men = hatId && hatId.replace(/^hat-flight-cap-/, 'hat-flight-cap-men-');
    if(ctx.build.gender !== 'female' && men !== hatId && ctx.has(men)) hatId = men;
    if(!hatId || !ctx.has(hatId)) return null;
    const top = ctx.point('top_center');
    const hs = await ctx.spec(hatId);
    const layer = await ctx.place(hatId, { pieceAnchor: 'garment_attach_center', at: top, z: Z.hat, role: 'hat', key: 'hat:' + hatId, className: 'hat' });
    if(device && ctx.has(device)){
      const at = piecePoint(layer, hs, 'device_slot_center');
      const ds = await ctx.spec(device);
      const anchorName = core.anchor(ds, 'mount_center') ? 'mount_center' : 'center';
      await ctx.place(device, { pieceAnchor: anchorName, at, z: Z.hatDevice, role: 'hat-device', key: 'hat-device:' + device });
    }
    return layer;
  }

  // ---- Flight Duty Uniforms (chapter 8) and flight jackets ---------------------------------------

  // Officer grade on the shoulders (8.2.3, 8.3.3): cloth-bordered, centred in each grade zone; general
  // officers' stars centred on the shoulder with a point toward the neck.
  async function flightGrade(ctx, g){
    if(!g.officer || g.cadet) return;
    if(g.general){
      const id = G.seniorOfficerInsignia(g, 'cloth-bordered', { horizontal: false });
      for(const side of ['right', 'left']){
        const zone = ctx.rect('grade_zone_go_' + side);
        if(!zone) continue;
        // The stacked form turned a quarter turn lies along the shoulder, points toward the neck.
        await ctx.place(id, { pieceAnchor: 'center', at: core.rectCenter(zone), rotate: side === 'right' ? 90 : -90, z: Z.insignia, role: 'grade', key: 'grade:' + side });
      }
      return;
    }
    const id = G.seniorOfficerInsignia(g, 'cloth-bordered');
    for(const side of ['right', 'left']){
      const zone = ctx.rect('grade_zone_' + side);
      if(zone) await fitCenter(ctx, id, zone, { z: Z.insignia, role: 'grade', key: 'grade:' + side });
    }
  }

  // The 2 x 4 in embroidered name tag over the left breast pocket (8.2.4.1, 8.3.4.1, Fig A6-3).
  async function flightNametag(ctx, b){
    const g = b.grade;
    const id = 'nametag-flight-embroidered-blank';
    const at = ctx.point('name_tape_center');
    if(!at) return;
    const spec = await ctx.spec(id);
    const tag = await ctx.place(id, { pieceAnchor: 'center', at, z: Z.tape, role: 'nametag', key: 'nametag' });
    if(b.name.show){
      const full = [b.name.first, b.name.last].filter(Boolean).join(' ');
      C.nameText(ctx, full, pieceRect(tag, spec, 'name_zone'), { color: SILVER_TEXT, maxH: 0.36, key: 'text:name' });
      // Officers show no grade or "CAP"; NCOs show grade and CAP; cadets "Cadet" and CAP.
      const officerLike = g.officer && !g.cadet || (g.category === 'senior-none' && g.track === 'officer');
      if(!officerLike){
        const gradeText = g.cadet ? 'Cadet' : (g.category === 'senior-nco' ? gradeAbbrev(g) : '');
        if(gradeText) C.nameText(ctx, gradeText, pieceRect(tag, spec, 'grade_zone'), { color: SILVER_TEXT, maxH: 0.22, upper: false, key: 'text:grade' });
        C.nameText(ctx, 'CAP', pieceRect(tag, spec, 'cap_zone'), { color: SILVER_TEXT, maxH: 0.22, key: 'text:cap' });
      }
    }
    // Badges embossed above the name: a CAP aviation badge, then an occupational badge or the current
    // command insignia, in silver (8.2.4.1, 8.3.4.1). Up to two, wings on the wearer's right.
    const set = badgeSet(ctx, b, 'dress');
    const pin = commandPin(ctx, b, 'dress');
    const chosen = [...set.chaplain, ...set.aviation, ...set.occupational].slice(0, 2);
    if(pin && !pin.graduated && chosen.length < 2) chosen.push({ id: pin.id, art: pin.art, title: pin.title, command: true });
    const zone = pieceRect(tag, spec, 'badge_zone');
    if(chosen.length === 1){
      await placeFitted(ctx, chosen[0].art, core.rectCenter(zone), 2.2, zone.h, { z: Z.badge, role: 'badge', key: 'badge:' + chosen[0].id, title: chosen[0].title });
    }else if(chosen.length === 2){
      const s = tag.w / spec.w;
      await placeFitted(ctx, chosen[0].art, { x: tag.x + 1.475 * s, y: zone.y + zone.h / 2 }, 1.4, zone.h, { z: Z.badge, role: 'badge', key: 'badge:' + chosen[0].id, title: chosen[0].title });
      await placeFitted(ctx, chosen[1].art, { x: tag.x + 2.875 * s, y: zone.y + zone.h / 2 }, 0.7, zone.h, { z: Z.badge, role: 'badge', key: 'badge:' + chosen[1].id, title: chosen[1].title });
    }
    const dropped = set.all.length - chosen.filter(c => !c.command).length;
    if(dropped > 0) ctx.note('Flight suit name tags carry at most two badges (CAPR 39-1, 8.2.4.1); the rest are not shown');
  }

  async function flightPatches(ctx, b){
    // Optional ES patch below and centred on the right breast pocket (8.2.4.3, 8.3.4.3).
    if(b.opt.esPatch && b.opt.esPatch !== 'none'){
      const zone = ctx.rect('es_patch_zone');
      const id = b.opt.esPatch === 'style-2' ? 'patch-es-style-2' : 'patch-es-style-1';
      if(zone) await fitCenter(ctx, id, zone, { z: Z.patch, role: 'patch', key: 'patch:' + id, title: 'Emergency Services patch' });
    }
    // One authorized patch on the right sleeve, inside the 3 1/2 in loop tape (8.2.4.5, 8.2.5.5).
    const slot = ctx.rect('patch_loop_square_right');
    const patch = (b.patches || []).find(p => p.slot !== 'CHEST_LEFT' && p.slot !== 'CHEST_RIGHT') || (b.patches || [])[0];
    if(slot && patch){
      C.fitRaster(ctx, patch.href, slot, patch.aspect || 1, { z: Z.patch, role: 'patch', key: 'patch:' + patch.id + ':RS:0', title: patch.title });
      if((b.patches || []).length > 1) ctx.note('Only one patch is worn on the flight suit sleeve (CAPR 39-1, 8.2.4.5)');
    }
  }

  function flightHat(b){
    const g = b.grade;
    if(b.opt.headgear === 'none' || b.uniform !== 'flight_suit') return null;  // no flight cap with the CFDU (8.3.8)
    if(g.general) return { hat: 'hat-flight-cap-general', device: 'cap-device-officer-flight' };
    if((g.officer && !g.cadet) || (g.category === 'senior-none' && g.track === 'officer')) return { hat: 'hat-flight-cap-officer', device: g.category === 'senior-none' ? null : 'cap-device-officer-flight' };
    if(g.category === 'cadet-officer') return { hat: 'hat-flight-cap-cadet', device: G.cadetOfficerInsignia(g, 'metal-regular') };
    if(g.category === 'cadet-nco' || g.category === 'cadet-basic') return { hat: 'hat-flight-cap-cadet', device: 'cap-device-nco-flight' };
    if(g.category === 'senior-nco') return { hat: 'hat-flight-cap-cadet', device: 'cap-device-nco-flight' }; // ICL 25-02: NCO device
    return { hat: 'hat-flight-cap-cadet', device: null };
  }

  async function composeFlight(ctx, b){
    const corporate = b.uniform === 'corporate_flight_suit';
    const jacket = !!b.opt.asJacket;
    const garment = jacket
      ? (corporate ? 'garment-flight-jacket-blue' : 'garment-flight-jacket-green')
      : (corporate ? 'garment-cfdu-flight-suit' : 'garment-fdu-flight-suit');
    await ctx.garment(garment);
    await flightGrade(ctx, b.grade);
    await flightNametag(ctx, b);
    await flightPatches(ctx, b);
    if(b.opt.scarf && !jacket){
      // The scarf's suit_apex meets the suit's collar_apex (8.2.6, 8.3.6).
      await ctx.place('garment-cap-command-scarf', { pieceAnchor: 'suit_apex', at: ctx.point('collar_apex'), z: Z.garmentLayer, role: 'scarf', key: 'scarf' });
    }
    const h = flightHat(b);
    if(h) await hat(ctx, h.hat, h.device);
  }

  // The flight jacket is drawn beside the suit (8.2.7, 8.3.7) unless the member hides it.
  function flightJacket(b){
    if(b.opt.jacket === false) return null;
    return Object.assign({}, b, { opt: Object.assign({}, b.opt, { asJacket: true, scarf: false, headgear: 'none' }) });
  }

  const PROFILES = {
    flight_suit: { title: 'Flight Duty Uniform', compose: composeFlight, companion: flightJacket },
    corporate_flight_suit: { title: 'Corporate Flight Duty Uniform', compose: composeFlight, companion: flightJacket }
  };

  function register(id, profile){ PROFILES[id] = profile; }

  // Move a layer by (dx, dy) inches.
  function shiftLayer(l, dx, dy){
    l.x += dx; l.y += dy;
    if(l.origin) l.origin = { x: l.origin.x + dx, y: l.origin.y + dy };
    if(l.clip) l.clip = l.clip.map(p => ({ x: p.x + dx, y: p.y + dy }));
    if(l.from) l.from = { x: l.from.x + dx, y: l.from.y + dy };
    if(l.to) l.to = { x: l.to.x + dx, y: l.to.y + dy };
    return l;
  }

  // A uniform, plus the second figure its profile names (the flight jacket beside the suit, the
  // shirt worn under the blazer), drawn to its right with the garment tops level.
  async function composeUniform(build, store){
    const ctx = C.createContext(build, store);
    const p = PROFILES[build.uniform];
    if(!p) throw new Error('No profile for uniform ' + build.uniform);
    await p.compose(ctx, build);
    const scene = C.finish(ctx, p.title);
    const second = p.companion ? p.companion(build) : null;
    if(!second) return scene;
    const q = PROFILES[second.uniform];
    const ctx2 = C.createContext(second, store);
    await q.compose(ctx2, second);
    const other = C.finish(ctx2, q.title);
    if(!other.layers.length) return scene;
    const gap = 2;
    const dx = scene.bounds.x + scene.bounds.w + gap - other.bounds.x;
    other.layers.forEach(l => { shiftLayer(l, dx, 0); l.figure = 2; });
    scene.layers.push(...other.layers);
    other.notes.forEach(n => { if(!scene.notes.includes(n)) scene.notes.push(n); });
    scene.bounds = core.unionBounds([scene.bounds, { x: other.bounds.x + dx, y: other.bounds.y, w: other.bounds.w, h: other.bounds.h }]);
    return scene;
  }

  return { PROFILES, register, composeUniform, helpers: { pieceRect, piecePoint, fitCenter, placeFitted, badgeSet, commandPin, gradeAbbrev, hat, SILVER_TEXT } };
});
