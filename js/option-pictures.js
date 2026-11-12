// The pictures of the garment options (js/garment-options.js), made from what the engine draws, so a picture is the art the figure wears and the rule the
// engine follows, never a second drawing of them.
//
//   const p = CAPUBOptionPictures.pictures('headgear', ['auto', 'tactical', 'none']);
//   p.now    { value: picture | null | false | undefined }   what is known already: a picture (an image address or SVG markup, what js/visual-picker.js takes), null
//            for a choice that has no art to show (it is shown by its name alone), false for a choice that does not apply to this member (it is not offered, as the
//            chest badge layout is not offered without three badges: the engine's own drawing is the same for every choice), undefined while it is still being made;
//            while the pictures for a changed member (another grade, another cut) are being made, the last ones made for these choices
//   p.ready  a promise of the pictures for the member as they are now, complete
//   p.settled  true when `now` is already those pictures
//
// A picture is made by composing the uniform for the member as they are with one option changed, the way the page composes it (js/uniform-view.js
// buildFromState, E.profiles.composeUniform), and keeping the layers that make the picture: the cap and what is on it; the blank squares the badges
// stand on the CAP tape. The drawing is the page's own (E.renderSvg.buildSvg), shown as an image. Nothing else is composed with them (no ribbons, badges,
// patches or name), so the picture shows the choice and nothing the member has picked elsewhere.
//
// Loads as a classic script (window.CAPUBOptionPictures) and as a CommonJS module for the Node tests, which give `create` an environment of their own.
(function(root, factory){
  const api = factory();
  if(typeof module === 'object' && module.exports) module.exports = api;
  else root.CAPUBOptionPictures = api;
})(typeof self !== 'undefined' ? self : this, function(){
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';

  // ---- parts every recipe uses ----------------------------------------------------------------------------------------------------

  // The member as they are, without what is chosen elsewhere: only the garment, its grade and the cap, so a picture does not change when a ribbon is picked.
  function bare(build, change){
    const over = change || {};
    return Object.assign({}, build, {
      ribbons: [], medals: [], patches: [], militaryBadges: [], command: null, cord: null, cordColour: null,
      name: { first: '', last: '', state: '', show: false }
    }, over.keep ? {} : { badges: [] }, { opt: Object.assign({}, build.opt, over.opt) });
  }
  const centre = b => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
  const inside = (p, box) => p.x >= box.x && p.x <= box.x + box.w && p.y >= box.y && p.y <= box.y + box.h;
  const fmt = n => String(Math.round(n * 1000) / 1000);

  // A scene of only the layers kept, framed on `box` (inches, scene coordinates): what E.renderSvg.buildSvg draws.
  const sceneOf = (layers, box, title) => ({ title, layers, bounds: { x: box.x, y: box.y, w: box.w, h: box.h }, notes: [], conflicts: [] });

  // ---- headgear: the cap the figure wears, and the device or grade on it -----------------------------------------------------------

  // The engine seats the cap it is told to wear (opt.headgear) on the figure: a view of the coat sheet on the field uniforms (role 'hat', with a
  // 'hat-view-bounds' rectangle for the view), a cap sheet of its own on the others (role 'hat'), each with the device or grade on it (roles 'hat-device'
  // and 'grade'). A picture is those layers framed on the cap.
  async function capPicture(env, build, change, top){
    const scene = await env.compose(Object.assign(bare(build, { opt: change }), top || {}));
    const hat = scene.layers.find(l => l.role === 'hat');
    if(!hat) return null;
    const view = scene.layers.find(l => l.role === 'hat-view-bounds' && l.key === 'hat-view-bounds:' + String(hat.key).replace(/^hat:/, ''));
    const box = view ? { x: view.x, y: view.y, w: view.w, h: view.h } : null;
    // What is on the cap: its device (a cap sheet's own) or, on the field uniforms, the grade the engine puts on the cap's view.
    const marks = scene.layers.filter(l => l.type === 'asset' && (l.role === 'hat-device' || (box && l.role === 'grade' && inside(centre(env.core.layerBounds(l)), box))));
    const frame = box || env.core.unionBounds([hat, ...marks.filter(l => l.role === 'hat-device')].map(l => env.core.layerBounds(l)));
    return { scene: sceneOf([hat, ...marks], frame, 'Headgear'), pad: 0.15 };
  }
  async function headgear(env, build, values){
    const out = {};
    await Promise.all(values.map(async value => { out[value] = value === 'none' ? { markup: env.empty() } : await capPicture(env, build, { headgear: value }); }));
    return out;
  }
  const headgearKey = build => [build.uniform, build.gender, build.grade && (build.grade.key || build.grade.rank), build.grade && build.grade.category, !!(build.grade && build.grade.cadet),
    (build.badges || []).some(b => /chaplain/i.test(b.id)), build.opt && build.opt.capGrade, !!build.ceremonial];
  // The OCP cap's grade, sewn or on the hook-and-loop square, as it is on the cap the member wears.
  async function capGrade(env, build, values){
    const out = {};
    await Promise.all(values.map(async value => { out[value] = await capPicture(env, build, { capGrade: value }); }));
    return out;
  }
  const capGradeKey = build => [build.uniform, build.gender, build.grade && (build.grade.key || build.grade.rank), build.opt && build.opt.headgear];

  // ---- the Honor Guard Uniform (Ceremonials): the chinstrap, the role and what it is worn on -----------------------------------------------------------------

  // The cap with its rear chinstrap up or down, as the engine seats it for the Honor Guard Uniform.
  async function chinstrap(env, build, values){
    const out = {};
    const ceremonial = Object.assign({ role: 'guard' }, build.ceremonial);
    await Promise.all(values.map(async value => { out[value] = await capPicture(env, build, { headgear: 'auto' }, { ceremonial: Object.assign({}, ceremonial, { chinstrap: value }) }); }));
    return out;
  }
  const chinstrapKey = build => [build.gender, !!build.ceremonial];

  // The figure as the engine draws the Honor Guard Uniform for a choice and nothing else: `change(value)` is what the choice changes, { uniform, opt, ceremonial }. No cap, ribbons or name.
  function ceremonialFigure(change, crop){
    return async function(env, build, values){
      const out = {};
      await Promise.all(values.map(async value => {
        const c = change(value, build);
        const scene = await env.compose(Object.assign(bare(build, { opt: Object.assign({ headgear: 'none' }, c.opt) }), c.top));
        const layers = scene.layers.filter(l => (!l.figure || l.figure === 1) && l.type !== 'clear' && l.type !== 'measure');
        const frame = figureBox(env.core, scene);
        out[value] = { scene: sceneOf(layers, crop ? crop(frame) : frame, 'Ceremonials'), pad: 0.1 };
      }));
      return out;
    };
  }
  // What it is worn on: the coat's Class A, or the shirt's Class B with short or with long sleeves, each with the member's role.
  const wornOn = ceremonialFigure((value, build) => ({
    opt: value === 'coat' ? {} : { sleeve: value },
    top: { uniform: value === 'coat' ? 'blues_a' : 'blues_b', ceremonial: build.ceremonial }
  }), f => ({ x: f.x, y: f.y, w: f.w, h: f.h * 0.8 }));
  // The role: the belt or the flag sling, on the garment the member wears it on.
  const role = ceremonialFigure((value, build) => ({ opt: {}, top: { ceremonial: Object.assign({}, build.ceremonial, { role: value }) } }), f => ({ x: f.x, y: f.y, w: f.w, h: f.h * 0.8 }));
  const ceremonialKey = build => [build.uniform, build.gender, build.grade && (build.grade.key || build.grade.rank), build.opt && build.opt.sleeve, build.ceremonial && build.ceremonial.role];

  // ---- chest badge layout: blank squares where the badges stand, by the engine's own rule -----------------------------------------

  const ABOVE_TAPE = 'above the CAP tape';
  // The badges the engine draws above the CAP tape in a scene, as boxes (inches).
  const chestBoxes = (core, scene) => scene.layers.filter(l => l.type === 'asset' && l.role === 'badge' && l.place === ABOVE_TAPE).map(l => core.layerBounds(l));

  // The diagram: the CAP tape as a bar and a blank square for every badge, at the place the engine puts it, all layouts of the uniform in one frame (so the
  // layouts can be compared at a glance). `tape` and the boxes are in inches.
  function layoutMarkup(tape, boxes, frame){
    const f = frame;
    const rects = boxes.map(b => `<rect x="${fmt(b.x)}" y="${fmt(b.y)}" width="${fmt(b.w)}" height="${fmt(b.h)}" rx="0.12" fill="#E6E9F3" stroke="#001871" stroke-width="0.07"/>`).join('');
    return `<svg xmlns="${SVG_NS}" viewBox="${fmt(f.x)} ${fmt(f.y)} ${fmt(f.w)} ${fmt(f.h)}" focusable="false" aria-hidden="true">`
      + `<rect x="${fmt(tape.x)}" y="${fmt(tape.y)}" width="${fmt(tape.w)}" height="${fmt(tape.h)}" rx="0.12" fill="#001871"/>${rects}</svg>`;
  }
  async function badgeLayout(env, build, values){
    const scenes = await Promise.all(values.map(v => env.compose(bare(build, { keep: true, opt: { badgeLayout: v } }))));
    const first = scenes[0];
    const sheet = first && first.garment ? await env.spec(first.garment) : null;
    const tape = sheet && env.core.landmarkBounds(sheet, 'cap_tape');
    const out = {};
    const sets = scenes.map(sc => chestBoxes(env.core, sc));
    // The layouts are for three or four badges: with fewer worn there is nothing to lay out.
    if(!tape || sets.some(s => s.length < 3)){ values.forEach(v => { out[v] = null; }); return out; }
    const all = [tape, ...sets.flat()];
    const frame = env.core.unionBounds(all);
    const m = 0.3;
    const framed = { x: frame.x - m, y: frame.y - m, w: frame.w + 2 * m, h: frame.h + 2 * m };
    values.forEach((v, i) => { out[v] = { markup: layoutMarkup(tape, sets[i], framed) }; });
    return out;
  }
  const badgeLayoutKey = build => [build.uniform, build.gender, (build.badges || []).map(b => b.id)];

  // ---- the ribbon rack: the member's own ribbons as blank rectangles, in the rows the engine lays for each choice -------------------------------

  // The build the page would hand the engine if the member's state held `over` (a map of State fields: { ribbonRackLayout: '4-left' }). The page's own path from state to build, so
  // a picture of a choice is the build of that choice and never a second copy of what a choice means. Without it (a test that gives none) every choice is the member's own.
  const buildWith = (env, build, over) => typeof env.buildWith === 'function' ? env.buildWith(over) : build;

  // The member's ribbons and miniature medals on the coat, and nothing else: no cap, badges, name or patches, so a picture changes with the rack and not with what is chosen elsewhere.
  function rackOnly(build){
    return Object.assign({}, build, {
      badges: [], patches: [], militaryBadges: [], command: null, cord: null, cordColour: null,
      name: { first: '', last: '', state: '', show: false }, opt: Object.assign({}, build.opt, { headgear: 'none' })
    });
  }
  // The rack the engine laid in a scene, where the garment sheet is registered at the origin (its landmarks are scene inches): the ribbons' boxes (top row first, as the layers are),
  // the welt pocket they rest on and the lapel that may cover them. null when no ribbon is worn.
  async function rackOf(env, build){
    const scene = await env.compose(rackOnly(build));
    const ribbons = scene.layers.filter(l => l.type === 'asset' && l.role === 'ribbon');
    if(!ribbons.length) return null;
    const coat = scene.layers.find(l => l.role === 'garment');
    const spec = coat && await env.spec(coat.id);
    const origin = !!spec && coat.x === 0 && coat.y === 0 && Math.abs(coat.w - spec.w) < 1e-6;
    const lapel = origin && spec.landmarks.lapel_left && spec.landmarks.lapel_left.points;
    return { layers: ribbons, ribbons: ribbons.map(l => env.core.layerBounds(l)), welt: origin ? env.core.landmarkBounds(spec, 'welt_pocket') : null, lapel: lapel || null };
  }
  const rackSignature = r => r && JSON.stringify(r.ribbons.map(b => [b.x, b.y, b.w, b.h].map(n => Math.round(n * 1000))));
  // The frame every choice of one rack shares (so the choices can be compared at a glance): the ribbons and the welt of all of them.
  function rackFrame(racks, env){
    const all = racks.flatMap(r => [...r.ribbons, ...(r.welt ? [r.welt] : [])]);
    const f = env.core.unionBounds(all), m = 0.3;
    return { x: f.x - m, y: f.y - m, w: f.w + 2 * m, h: f.h + 2 * m };
  }
  function rackMarkup(r, f){
    const lapel = r.lapel ? `<polygon points="${r.lapel.map(p => fmt(p.x) + ',' + fmt(p.y)).join(' ')}" fill="#001871" fill-opacity="0.14" stroke="#001871" stroke-width="0.05" stroke-linejoin="round"/>` : '';
    const welt = r.welt ? `<rect x="${fmt(r.welt.x)}" y="${fmt(r.welt.y)}" width="${fmt(r.welt.w)}" height="${fmt(r.welt.h)}" rx="0.06" fill="#001871" fill-opacity="0.55"/>` : '';
    const rects = r.ribbons.map(b => `<rect x="${fmt(b.x)}" y="${fmt(b.y)}" width="${fmt(b.w)}" height="${fmt(b.h)}" rx="0.04" fill="#FFFFFF" stroke="#001871" stroke-width="0.04"/>`).join('');
    return `<svg xmlns="${SVG_NS}" viewBox="${fmt(f.x)} ${fmt(f.y)} ${fmt(f.w)} ${fmt(f.h)}" focusable="false" aria-hidden="true">${lapel}${welt}${rects}</svg>`;
  }
  // The pictures of one choice among `values`, each the member's rack with `overFor(value)` in their state. The choice does not apply (false for every value) when the member wears
  // no ribbon, when their own rows are in force (the rack is theirs, not the engine's), or when every choice lays the same rack: nothing to pick between.
  async function rackChoices(env, build, values, overFor){
    const out = {};
    const none = () => { values.forEach(v => { out[v] = false; }); return out; };
    if(build.opt && build.opt.rackCounts) return none();
    const racks = await Promise.all(values.map(v => rackOf(env, buildWith(env, build, overFor(v)))));
    if(racks.some(r => !r) || new Set(racks.map(rackSignature)).size < 2) return none();
    const frame = rackFrame(racks, env);
    values.forEach((v, i) => { out[v] = { markup: rackMarkup(racks[i], frame) }; });
    return out;
  }
  // Ribbons are laid the way the choice says; what else the member has chosen about the rack (the other of the two) is theirs.
  const rackColumns = (env, build, values) => rackChoices(env, build, values, v => ({ ribbonRackLayout: v }));
  const rackArrangement = (env, build, values) => rackChoices(env, build, values, v => ({ ribbonRackArrangement: v }));
  // What the pictures are made from: the cut, the ribbons, the member's rows if they set their own, and the one of the two choices the picture is not of.
  const rackKey = (...fields) => build => [build.uniform, build.gender, (build.ribbons || []).map(r => r.key), build.opt && [build.opt.rackCounts, ...fields.map(f => build.opt[f])]];

  // ---- miniature medals: the member's own medals as blank medals, mounted as the engine mounts them for each style ---------------------------------

  // The medals the engine hung in a scene (the drape of each, cut to its V point, and the body under it), in the order they are drawn so one that hangs over another does.
  async function miniOf(env, build){
    const scene = await env.compose(rackOnly(build));
    const layers = scene.layers.filter(l => l.type === 'asset' && (l.role === 'mini-drape' || l.role === 'mini-medal')).sort((a, b) => a.z - b.z);
    if(!layers.length) return null;
    return { parts: layers.map(l => ({ drape: l.role === 'mini-drape', box: env.core.layerBounds(l), clip: l.clip || null })) };
  }
  const miniSignature = m => m && JSON.stringify(m.parts.map(p => [p.drape, p.box.x, p.box.y, p.box.w, p.box.h].map(n => typeof n === 'number' ? Math.round(n * 1000) : n)));
  function miniMarkup(m, f){
    const body = m.parts.map(p => {
      if(p.drape){
        const pts = p.clip ? p.clip.map(q => fmt(q.x) + ',' + fmt(q.y)).join(' ') : [[p.box.x, p.box.y], [p.box.x + p.box.w, p.box.y], [p.box.x + p.box.w, p.box.y + p.box.h], [p.box.x, p.box.y + p.box.h]].map(q => q.map(fmt).join(',')).join(' ');
        return `<polygon points="${pts}" fill="#FFFFFF" stroke="#001871" stroke-width="0.04" stroke-linejoin="round"/>`;
      }
      return `<ellipse cx="${fmt(p.box.x + p.box.w / 2)}" cy="${fmt(p.box.y + p.box.h / 2)}" rx="${fmt(p.box.w / 2)}" ry="${fmt(p.box.h / 2)}" fill="#E6E9F3" stroke="#001871" stroke-width="0.04"/>`;
    }).join('');
    return `<svg xmlns="${SVG_NS}" viewBox="${fmt(f.x)} ${fmt(f.y)} ${fmt(f.w)} ${fmt(f.h)}" focusable="false" aria-hidden="true">${body}</svg>`;
  }
  // The two ways to mount, each the member's medals as the engine hangs them: rows of four on mounting bars, or rows of up to seven overlapped on holding bars. Not offered where
  // the member wears no medal, or where the two hang alike (four or fewer, or eight, which both put in two rows of four).
  async function miniMount(env, build, values) {
    const out = {};
    const none = () => { values.forEach(v => { out[v] = false; }); return out; };
    const minis = await Promise.all(values.map(v => miniOf(env, buildWith(env, build, { miniMountStyle: v }))));
    if(minis.some(m => !m) || new Set(minis.map(miniSignature)).size < 2) return none();
    const frame = env.core.unionBounds(minis.flatMap(m => m.parts.map(p => p.box))), m = 0.25;
    const framed = { x: frame.x - m, y: frame.y - m, w: frame.w + 2 * m, h: frame.h + 2 * m };
    values.forEach((v, i) => { out[v] = { markup: miniMarkup(minis[i], framed) }; });
    return out;
  }
  const miniKey = build => [build.uniform, build.gender, (build.medals || []).map(m => m.key)];

  // ---- the command insignia pin: where it is worn, and the insignia of each level ----------------------------------------------------------------------

  // The member as they are with a command pin of their own making (the badge, and current or graduated), nothing else: no cap, ribbons, badges or name. The miniature medals stay
  // where the uniform wears them, for the mess dress puts the pin level with the top of the medals or below them.
  const pinBase = (build, command) => Object.assign(rackOnly(Object.assign({}, build, { ribbons: [] })), { command });
  // The pin the engine drew in a scene: its layers (a graduated pin on the field uniforms' sleeve is two), the key says whose they are.
  const pinLayers = (scene, id) => scene.layers.filter(l => l.type === 'asset' && l.role === 'badge' && String(l.key).startsWith('badge:' + id));
  const COMMAND_LEVEL_PIN = level => `${level}_commander_badge`;

  // Current commander (over the name tag, or where the uniform puts it) and graduated commander (under it): the uniform as the engine draws it for each, in a window centred on the
  // pin, so the pin and what it sits above or below show at a size to read. Not worn is the empty mark. A way the uniform does not draw is not offered (the flight suit has no
  // graduated pin).
  async function commandWorn(env, build, values){
    const out = {};
    const id = (build.command && build.command.id) || COMMAND_LEVEL_PIN('squadron');
    await Promise.all(values.map(async v => {
      if(v === 'none'){ out[v] = { markup: env.empty() }; return; }
      const scene = await env.compose(pinBase(build, { id, title: id, graduated: v === 'graduated' }));
      const pin = pinLayers(scene, id);
      if(!pin.length){ out[v] = false; return; }
      // The window is centred on the pin itself (a graduated pin on the field uniforms' sleeve is drawn in two pieces, the whole one and the edge, which lie apart).
      const at = env.core.layerBounds([...pin].sort((x, y) => y.w * y.h - x.w * x.h)[0]);
      const w = Math.max(3, at.w * 5.6), h = w * 0.75;
      const layers = scene.layers.filter(l => l.type !== 'clear' && l.type !== 'measure');
      out[v] = { scene: sceneOf(layers, { x: at.x + at.w / 2 - w / 2, y: at.y + at.h / 2 - h / 2, w, h }, 'Command insignia'), pad: 0 };
    }));
    return out;
  }
  const commandWornKey = build => [build.uniform, build.gender, build.command && build.command.id, build.grade && (build.grade.key || build.grade.rank), (build.medals || []).map(m => m.key)];

  // The insignia of each level (squadron and group commander), as the engine draws each on this uniform, at its own size in one frame.
  async function commandLevel(env, build, values){
    const out = {};
    const pins = await Promise.all(values.map(async v => {
      const id = COMMAND_LEVEL_PIN(v);
      const scene = await env.compose(pinBase(build, { id, title: id, graduated: false }));
      return pinLayers(scene, id).sort((a, b) => b.w - a.w)[0] || null;
    }));
    if(pins.some(l => !l)){ values.forEach(v => { out[v] = null; }); return out; }
    const w = Math.max(...pins.map(l => l.w)), h = Math.max(...pins.map(l => l.h)), m = 0.2;
    const frame = { x: -w / 2 - m, y: -h / 2 - m, w: w + 2 * m, h: h + 2 * m };
    values.forEach((v, i) => {
      const l = pins[i];
      const pin = Object.assign({}, l, { x: -l.w / 2, y: -l.h / 2, rotate: 0, origin: { x: 0, y: 0 }, z: 2 });
      out[v] = { scene: sceneOf([pin], frame, 'Command insignia'), pad: 0 };
    });
    return out;
  }
  const commandLevelKey = build => [build.uniform, build.gender];

  // ---- the pieces a choice changes: sleeves, the women's top, the polo, what is under the blazer --------------------------------

  // The uniform as the engine draws it for the choice and nothing else (no cap, ribbons or name), framed on the figure; `crop(frame, figure)` narrows the frame.
  const figureBox = (core, scene) => {
    const first = scene.layers.filter(l => !l.figure || l.figure === 1);
    const garment = first.find(l => l.role === 'garment');
    if(first.length === scene.layers.length || !garment) return Object.assign({}, scene.bounds);
    // A second figure drawn beside the first (the shirt beside the blazer) is left out of the picture.
    return { x: scene.bounds.x, y: scene.bounds.y, w: garment.x + garment.w - scene.bounds.x, h: scene.bounds.h };
  };
  function figure(key, crop){
    return async function(env, build, values){
      const out = {};
      await Promise.all(values.map(async value => {
        const scene = await env.compose(bare(build, { opt: { headgear: 'none', [key]: value } }));
        const layers = scene.layers.filter(l => (!l.figure || l.figure === 1) && l.type !== 'clear' && l.type !== 'measure');
        const frame = figureBox(env.core, scene);
        out[value] = { scene: sceneOf(layers, crop ? crop(frame) : frame, key), pad: 0.1 };
      }));
      return out;
    };
  }
  const figureKey = keys => build => [build.uniform, build.gender, build.grade && (build.grade.key || build.grade.rank), ...keys.map(k => build.opt && build.opt[k])];
  // The neck and chest, where the blazer opens on what is under it.
  const upperChest = f => ({ x: f.x + f.w * 0.12, y: f.y, w: f.w * 0.76, h: f.h * 0.42 });
  // The shirt down to the waist: the seal, the pocket and the sleeve show, and the figure fills a box wider than tall.
  const upperBody = f => ({ x: f.x, y: f.y, w: f.w, h: f.h * 0.62 });

  // The women's mess dress skirt: the skirt sheet the engine puts under the coat.
  async function skirt(env, build, values){
    const out = {};
    await Promise.all(values.map(async value => {
      const scene = await env.compose(bare(build, { opt: { skirt: value } }));
      const piece = scene.layers.find(l => l.role === 'garment-layer' && /^layer:garment-mess-dress-skirt-/.test(l.key));
      if(!piece){ out[value] = null; return; }
      // From the waist, where the skirt's drawing begins, to its bottom (the sheet is the whole height of the figure, empty above the waist).
      const spec = await env.spec(piece.id), waist = env.core.anchor(spec, 'waist_center'), box = env.core.layerBounds(piece);
      const top = waist ? piece.y + waist.y - 0.3 : box.y;
      out[value] = { scene: sceneOf([piece], { x: box.x, y: top, w: box.w, h: box.y + box.h - top }, 'Skirt'), pad: 0.1 };
    }));
    return out;
  }

  // A button of the mess dress coat, in each design the sheet draws (landmark button_designs): the first button's group of the design, framed on the button.
  async function buttons(env, build, values){
    const out = {};
    const scene = await env.compose(bare(build, {}));
    const coat = scene.layers.find(l => l.role === 'garment');
    const spec = coat && await env.spec(coat.id);
    const designs = spec && spec.landmarks.button_designs;
    const box = spec && env.core.landmarkBounds(spec, 'button_right_1');
    for(const value of values){
      const group = designs && Array.isArray(designs[value]) ? designs[value][0] : null;
      if(!group || !box){ out[value] = null; continue; }
      const layer = Object.assign({}, coat, { onlyGroups: [group] });
      delete layer.hideGroups;
      const k = coat.w / spec.w, m = 0.2;
      out[value] = { scene: sceneOf([layer], { x: coat.x + box.x * k - m, y: coat.y + box.y * k - m, w: box.w * k + 2 * m, h: box.h * k + 2 * m }, 'Button'), pad: 0 };
    }
    return out;
  }
  const buttonsKey = build => [build.uniform, build.gender];

  // The senior NCO chevron at the size each choice gives, as the engine draws it on the sleeve, all in one frame so the two sizes can be compared.
  async function chevron(env, build, values){
    const scenes = await Promise.all(values.map(v => env.compose(bare(build, { opt: { chevron: v } }))));
    const picked = scenes.map(sc => sc.layers.filter(l => l.type === 'asset' && l.role === 'grade' && /-chevron-/.test(l.id)).sort((a, b) => b.w - a.w)[0] || null);
    const out = {};
    if(picked.some(l => !l)){ values.forEach(v => { out[v] = null; }); return out; }
    const w = Math.max(...picked.map(l => l.w)), h = Math.max(...picked.map(l => l.h)), m = 0.35;
    const frame = { x: -w / 2 - m, y: -h / 2 - m, w: w + 2 * m, h: h + 2 * m };
    values.forEach((v, i) => {
      const l = picked[i];
      const chevron = Object.assign({}, l, { x: -l.w / 2, y: -l.h / 2, rotate: 0, origin: { x: 0, y: 0 }, z: 2 });
      // The mess dress chevron is white (4.1.1.1.1.4, 4.1.2.1.1.4): on a plain dark swatch, or it is white on the picture's white.
      const ground = /-chevron-white-/.test(l.id) ? [{ type: 'rect', x: frame.x, y: frame.y, w: frame.w, h: frame.h, rx: 0.2, fill: '#001871', rotate: 0, origin: { x: 0, y: 0 }, z: 1, role: 'swatch', key: 'swatch' }] : [];
      out[v] = { scene: sceneOf([...ground, chevron], frame, 'Chevron'), pad: 0 };
    });
    return out;
  }
  const chevronKey = build => [build.uniform, build.gender, build.grade && (build.grade.key || build.grade.rank)];

  // The Emergency Services patch, in each style the engine puts on the uniform, at its own size, in one frame.
  async function esPatch(env, build, values){
    const out = {};
    const shown = values.filter(v => v !== 'none');
    const scenes = await Promise.all(shown.map(v => env.compose(bare(build, { opt: { esPatch: v } }))));
    const items = [];
    for(let i = 0; i < shown.length; i++){
      const layer = scenes[i].layers.find(l => l.role === 'patch' && /^patch:patch-es-style-/.test(l.key));
      const spec = layer && await env.spec(layer.id);
      items.push(spec ? { v: shown[i], id: layer.id, w: spec.w, h: spec.h } : null);
    }
    const ok = items.filter(Boolean);
    const w = Math.max(0, ...ok.map(x => x.w)), h = Math.max(0, ...ok.map(x => x.h)), m = 0.25;
    const frame = { x: -w / 2 - m, y: -h / 2 - m, w: w + 2 * m, h: h + 2 * m };
    for(const v of values){
      if(v === 'none'){ out[v] = { markup: env.empty() }; continue; }
      const it = items.find(x => x && x.v === v);
      if(!it){ out[v] = null; continue; }
      // A patch that is a vector is drawn as the engine draws a sheet; any other (a flat digital picture) is drawn as an image, at its own size.
      const path = env.entry(it.id).path;
      const box = { x: -it.w / 2, y: -it.h / 2, w: it.w, h: it.h, rotate: 0, origin: { x: 0, y: 0 }, z: 1, role: 'patch', key: 'patch:' + it.id };
      const layer = /\.svg$/i.test(path) ? Object.assign({ type: 'asset', id: it.id }, box) : Object.assign({ type: 'raster', href: env.url(path) }, box);
      out[v] = { scene: sceneOf([layer], frame, 'Emergency Services patch'), pad: 0 };
    }
    return out;
  }
  const esPatchKey = build => [build.uniform];

  const RECIPES = {
    headgear: { make: headgear, key: headgearKey },
    capGrade: { make: capGrade, key: capGradeKey },
    badgeLayout: { make: badgeLayout, key: badgeLayoutKey },
    rackColumns: { make: rackColumns, key: rackKey('rackArrangement') },
    rackArrangement: { make: rackArrangement, key: rackKey('rackColumns', 'rackAlign') },
    miniMount: { make: miniMount, key: miniKey },
    commandWorn: { make: commandWorn, key: commandWornKey },
    commandLevel: { make: commandLevel, key: commandLevelKey },
    chevron: { make: chevron, key: chevronKey },
    esPatch: { make: esPatch, key: esPatchKey },
    skirt: { make: skirt, key: figureKey([]) },
    buttons: { make: buttons, key: buttonsKey },
    chinstrap: { make: chinstrap, key: chinstrapKey },
    wornOn: { make: wornOn, key: ceremonialKey },
    cerRole: { make: role, key: ceremonialKey },
    sleeve: { make: figure('sleeve'), key: figureKey(['poloShirt', 'poloCut', 'femaleTop', 'tie']) },
    femaleTop: { make: figure('femaleTop'), key: figureKey(['sleeve', 'tie']) },
    poloShirt: { make: figure('poloShirt', upperBody), key: figureKey(['sleeve', 'poloCut']) },
    poloCut: { make: figure('poloCut'), key: figureKey(['sleeve', 'poloShirt']) },
    underlayer: { make: figure('underlayer', upperChest), key: figureKey([]) }
  };

  // ---- the page's side: what composing and drawing need, and the cache of what was made ------------------------------------------

  // What a picture needs from its surroundings (`env`): the engine's pieces (core), the build the page would draw (build), composing and drawing, the spec
  // store (spec, entry, url), the empty mark and, optionally, warn and release (called with a picture address that is dropped from the cache).
  const KEEP = 30;   // member-and-choice sets kept: the newest; a member who changes grade or cut a few times has the earlier ones back at once
  function create(env){
    const cache = new Map();    // key -> { value, promise }; the newest last
    const latest = new Map();   // option and choices -> the last pictures made for them, shown while the pictures for a changed member are being made
    function drop(){
      while(cache.size > KEEP){
        const [key, old] = cache.entries().next().value;
        cache.delete(key);
        if(env.release && old.value) Object.values(old.value).forEach(p => { if(typeof p === 'string' && /^blob:/.test(p)) env.release(p); });
      }
    }
    function pictures(optionKey, values){
      const recipe = RECIPES[optionKey];
      const list = Array.isArray(values) ? values : [];
      const none = Object.fromEntries(list.map(v => [v, null]));
      // A choice no recipe makes a picture of, or no member to compose for, has no art to show.
      if(!recipe || !list.length) return { now: none, ready: Promise.resolve(none), settled: true };
      let build;
      try{ build = env.build(); }catch(e){ return { now: none, ready: Promise.resolve(none), settled: true }; }
      const key = JSON.stringify([optionKey, recipe.key(build), list]);
      const kind = JSON.stringify([optionKey, list]);
      let hit = cache.get(key);
      if(hit){ cache.delete(key); cache.set(key, hit); }
      else{
        hit = { value: null };
        hit.promise = Promise.resolve()
          .then(() => recipe.make(env, build, list))
          .then(async specs => {
            const done = {};
            for(const v of list){
              const s = specs[v];
              done[v] = s === false ? false : !s ? null : s.markup != null ? s.markup : await env.draw(s.scene, s.pad);
            }
            return done;
          })
          .catch(error => {
            if(env.warn) env.warn(`The pictures of ${optionKey} could not be made`, error);
            return none;
          })
          .then(done => { hit.value = done; latest.set(kind, done); return done; });
        cache.set(key, hit);
        drop();
      }
      return { now: hit.value || latest.get(kind) || {}, ready: hit.promise, settled: !!hit.value };
    }
    return { pictures };
  }

  // ---- the page ----

  function pageEnv(){
    const E = window.CAPUBEngine;
    const assets = window.CAPUBAssetPacks.createLoader((path, cache) => fetch(ASSET(path), cache ? { cache } : undefined).then(r => r.ok ? r.json() : null));
    let storeP = null;
    let storeNow = null;
    const getStore = () => storeP || (storeP = assets.manifest().then(m => (storeNow = E.core.createSpecStore(m, path => assets.spec(path)))));
    const storeSync = () => storeNow;   // set once a picture has been asked for: every recipe composes first
    return {
      core: E.core,
      build: () => window.CAPUBUniformView.buildFromState(),
      // The build for the page's state with some of its fields changed (the choice a picture shows), the state put back as it was.
      buildWith(over){
        const saved = Object.keys(over).map(k => [k, State[k]]);
        try{ Object.assign(State, over); return window.CAPUBUniformView.buildFromState(); }
        finally{ saved.forEach(([k, v]) => { State[k] = v; }); }
      },
      async compose(build){
        const [store] = await Promise.all([getStore(), assets.prepare(build.uniform, build.gender)]);
        return E.profiles.composeUniform(build, store);
      },
      async spec(id){ return (await getStore()).load(id); },
      entry: id => storeSync().entry(id),
      url: path => ASSET(path),
      async draw(scene, pad){
        const store = await getStore();
        const svg = await E.renderSvg.buildSvg(scene, id => store.entry(id).path, { pad: pad == null ? 0.1 : pad });
        return URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml;charset=utf-8' }));
      },
      empty: () => window.VisualPicker.emptyMark(),
      release: url => URL.revokeObjectURL(url),
      warn: (...a) => console.warn('[option pictures]', ...a)
    };
  }

  let page = null;   // made on first use, when the engine and the page's scripts are all loaded
  function pictures(optionKey, values){
    if(!page) page = create(pageEnv());
    return page.pictures(optionKey, values);
  }

  return { create, pictures, bare, RECIPES, layoutMarkup };
});
