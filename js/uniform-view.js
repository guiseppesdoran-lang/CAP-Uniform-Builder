// The uniform preview: turns the page state into a build for the uniform engine (js/engine/*),
// draws the composed scene as one <svg> inside #uniformCanvas, and exports it as a PNG.
//
// Everything placed on the uniform comes from the engine's regulation rules and the artwork's own
// anchors; there is no per-uniform pixel calibration.
(function(){
  'use strict';
  const E = window.CAPUBEngine;
  let store = null;
  let manifestPromise = null;
  let renderSeq = 0;
  let lastScene = null;
  let lastSvg = null;

  // The manifest and specs come from js/asset-packs.js: in the source tree MANIFEST.json and one file per spec, revalidated
  // because artwork is updated in place (a 304 when unchanged); in the built site, a slim manifest and a pack per uniform and cut.
  const assets = window.CAPUBAssetPacks.createLoader((path, cache) => fetch(ASSET(path), cache ? { cache } : undefined).then(r => r.ok ? r.json() : null));
  function getStore(){
    if(store) return Promise.resolve(store);
    if(!manifestPromise){
      manifestPromise = assets.manifest()
        .then(manifest => {
          store = E.core.createSpecStore(manifest, path => assets.spec(path));
          return store;
        });
    }
    return manifestPromise;
  }

  // ---- state -> build ---------------------------------------------------------------------

  // Options for the garment itself (sleeve length, skirt, headgear...). Defaults per uniform.
  const GARMENT_DEFAULTS = {
    sleeve: 'short', femaleTop: 'shirt', underlayer: 'shirt', skirt: 'a-line', buttons: 'wing-star', headgear: 'auto',
    chevron: '', scarf: false, jacket: false, esPatch: 'none', noGradeTrack: 'officer', plateGrade: true, badgeLayout: 'column',
    poloShirt: 'embroidered', poloCut: '', poloName: true, poloMark: 'badge', dutyTitle: ''
  };
  function garmentOptions(){
    const g = Object.assign({}, GARMENT_DEFAULTS, State.garment || {});
    return g;
  }

  const militaryDeviceAsset = id => window.CAPUBMilitaryDeviceLayout?.ribbonDeviceArt(id)?.asset || null;

  function ribbonAssetId(id){
    // A JROTC/ROTC ribbon is the sheet of the same name, not a 'ribbon-' sheet (data/rotc-ribbons.js).
    if(isRotcRibbonId(id)) return ROTC_RIBBONS.get(id).asset;
    return 'ribbon-' + String(id).replace(/_/g, '-');
  }

  // The ribbons to wear, in precedence order, each split into the ribbons its devices need. A senior member wears one cadet award
  // ribbon, the highest earned (CAPR 39-3 Attachment 2, 14j-14m), with the Cadet Officer School star moved onto it from the Mitchell
  // (14j); `allMilestones` keeps every cadet milestone award earned, for the miniature medals, which a senior may wear in full
  // on the mess dress and the corporate semi-formal (CAPR 39-1 11.1.4), each medal as chosen.
  function buildRibbons(opts){
    const allMilestones = !!(opts && opts.allMilestones);
    const out = [];
    const seen = new Set();
    // Remove ribbons (LIVE13): on a shirt where ribbons are optional the member may leave the rack off; the selections stay.
    const removed = !!State.hideRibbons && CAPUBUniformRules.ribbonPolicy(State.uniform) === 'optional';
    const ordered = removed ? [] : (typeof sortRibbons === 'function' ? sortRibbons(State.ribbons || []) : (State.ribbons || []));
    const milestones = State.membership === 'senior' && !allMilestones ? ordered.filter(r => CADET_MILESTONES.has(r.id)) : [];
    const topMilestone = milestones[0] ? milestones[0].id : null;
    const mitchellStar = milestones.some(r => r.id === 'mitchell_award' && r.awardValue === 'earned_cos_star');
    for(const inst0 of ordered){
      const id = inst0.id;
      if(milestones.length && CADET_MILESTONES.has(id) && id !== topMilestone) continue;
      let inst = inst0;
      if(mitchellStar && id === topMilestone && id !== 'mitchell_award' && (getRibbonAwardOptions(id) || []).some(o => o?.value === 'earned_cos_star')){
        inst = Object.assign({}, inst0, { awardValue: 'earned_cos_star', awardLabel: 'Earned + COS star moved from the Mitchell' });
      }
      if(isMilitaryRibbonId(id)){
        const devices = (inst.militaryDevices || []).map(militaryDeviceAsset).filter(Boolean);
        out.push({ key: `ribbon:${id}#${out.length}`, title: getRibbonDisplayName(id), asset: getMilitaryRibbonAward(id)?.images?.ribbonAsset || null, devices, centered: false, military: true });
        continue;
      }
      if(seen.has(id)) continue; // the engine makes the extra ribbons itself
      seen.add(id);
      const sel = Object.assign({}, State.ribbonSelections?.[id] || {}, { awardValue: inst.awardValue, awardLabel: inst.awardLabel, membership: State.membership });
      if(sel.awardValue && /_duplicate_/.test(sel.awardValue)) continue;
      const parts = CAPUBRibbonAwards.resolve(id, sel);
      parts.forEach((p, i) => out.push({
        key: i ? `ribbon:${id}#${i}` : `ribbon:${id}`,
        id,
        title: getRibbonDisplayName(id) + (i ? ' (additional ribbon)' : ''),
        asset: ribbonAssetId(id),
        devices: p.devices,
        centered: p.centered,
        rotc: isRotcRibbonId(id) || undefined
      }));
    }
    return out;
  }

  // The body of a U.S. military miniature medal, from data/military-medals.js (scripts/sync-military-medals.cjs): its manifest id, or null.
  function militaryMedalArt(award){
    const table = window.CAPUBMilitaryMedals || {};
    for(const id of [award?.id, ...(award?.sourceIds || [])]) if(table[id]) return table[id].artId;
    return null;
  }

  // One miniature medal per award, ribbon SVG plus medal body SVG: the devices a second ribbon would carry stay on the one medal, since more
  // than four devices is allowed when it avoids a second medal (11.4.2). A military award that is a medal but has no body art yet hangs its
  // drape alone (`pendingMedal`, the engine says so); a ribbon-only award has no medal, and the engine says so.
  function buildMedals(allRibbons){
    const ribbons = [];
    const awardOf = r => r.key.replace(/^ribbon:|#\d+$/g, '');
    // JROTC/ROTC ribbons have no miniature medal, so none is drawn for them (ribbonNotes says so).
    for(const r of allRibbons.filter(r => !r.rotc)){
      const prev = ribbons.find(x => awardOf(x) === awardOf(r));
      if(prev){ prev.devices = [...prev.devices, ...(r.devices || [])]; continue; }
      ribbons.push(Object.assign({}, r, { devices: [...(r.devices || [])] }));
    }
    return ribbons.map(r => {
      const medal = { key: r.key.replace(/^ribbon:/, 'mini:'), title: r.title, ribbonAsset: r.asset, devices: r.devices, centered: r.centered };
      if(r.military){
        const award = getMilitaryRibbonAward(awardOf(r));
        medal.medal = militaryMedalArt(award);
        medal.pendingMedal = !medal.medal && window.CAPUBMilitary?.getAwardRepresentation?.(award, 'MINIATURE_MEDAL')?.status !== 'NOT_APPLICABLE';
        return medal;
      }
      medal.medal = `medal-${r.asset.replace(/^ribbon-/, '')}-miniature`;
      return medal;
    });
  }

  function buildBadges(){
    const ids = State.badges || [];
    const badges = [];
    let command = null;
    for(const id of ids){
      const title = typeof getBadgeWornName === 'function' ? getBadgeWornName(id) : id;
      if(typeof isCommandInsigniaBadge === 'function' ? isCommandInsigniaBadge(id) : /commander_badge$/.test(id)){
        if(!command) command = { id, title, graduated: !!State.commandInsignia?.graduatedCommander };
        continue;
      }
      badges.push({ id, title, level: State.badgeSelections?.[id]?.level || null });
    }
    return { badges, command };
  }

  function buildMilitaryBadges(){
    const out = [];
    if(!CAPUBUniformRules.isAwardAllowedOnUniform('', State.uniform, { isMilitary: true })) return out;
    for(const [id, sel] of Object.entries(State.militaryBadges || {})){
      if(!sel?.selected) continue;
      const badge = (window.CAPUBMilitaryData?.badges || []).find(b => b.id === id);
      if(!badge) continue;
      const rep = getMilitaryBadgeRepresentation(badge);
      if(!rep?.asset) continue;
      out.push({ id, variant: sel.variant || rep.variant || '', title: badge.officialName || id, href: ASSET(rep.asset), family: String(badge.family || '').toUpperCase() });
    }
    return out;
  }

  function patchAspect(meta){
    const w = Number(meta?.w) || 1, h = Number(meta?.h) || 1;
    return w / h;
  }

  let patchNotes = [];
  function buildPatches(){
    const out = [];
    patchNotes = [];
    const add = (id, kind) => {
      const resolved = typeof window.capubResolvePatchIdForUniform === 'function' ? window.capubResolvePatchIdForUniform(id, State.uniform) : id;
      const meta = PATCH_META[resolved] || PATCH_META[id];
      if(!meta) return;
      if(typeof isPatchAuthorizedForUniform === 'function' && !isPatchAuthorizedForUniform(resolved)) return;
      // The higher headquarters patch is a second copy of a patch only when it is the unit's own (National Headquarters' command patch on both sleeves).
      if(out.some(p => p.id === resolved && (p.kind === 'hhq') === (kind === 'hhq'))) return;
      if(!meta.img){ patchNotes.push(`${meta.label || resolved} has no full patch artwork yet, so it is not shown`); return; }
      // `asset`: the patch's SVG, drawn at its spec's size. A patch still waiting for its vector hands its picture (`href`, the whole patch: square).
      // `slot`: the place the patch is worn on this uniform (js/catalog.js getPatchSlot: the member's pick among the regulation's places for
      // it, else the primary one); the engine draws it there (profiles-field.js fieldPatches, profiles.js flightPatches).
      const chosen = typeof getPatchSlot === 'function' ? getPatchSlot(resolved, State.uniform) : null;
      const slot = kind === 'hhq' ? 'L_SHOULDER' : (chosen || (kind === 'unit' ? 'R_SHOULDER' : (meta.slotHint || 'L_SHOULDER')));
      out.push({ id: resolved, title: meta.label || resolved.replace(/_/g, ' '), asset: meta.asset || null, href: meta.asset ? null : ASSET(meta.img), aspect: meta.ocpVariant ? 1 : patchAspect(meta), slot, kind, echelon: meta.echelon || null });
    };
    const unit = typeof getSelectedUnitPatchId === 'function' ? getSelectedUnitPatchId() : null;
    if(unit) add(unit, 'unit');
    // The OCP's left sleeve: the unit's higher headquarters patch under AUX, placed for the member unless one was picked in lieu of it (7.1.1.4.2.1, 7.1.1.4.2.2).
    const hhq = unit && typeof getUnitHhqPlan === 'function' ? getUnitHhqPlan() : null;
    if(hhq && hhq.worn) add(hhq.patchId, 'hhq');
    (State.patches || []).forEach(id => add(id, 'general'));
    // The ABU breast pocket takes one patch in all (5.1.1.1.2.3): the unit patch when it is worn, so another pocket patch is not drawn; the
    // page says so, since the engine passes over it without a note.
    if(State.uniform === 'abu'){
      const pocket = out.filter(p => p.slot === 'CHEST_RIGHT' || p.slot === 'CHEST_LEFT');
      if(pocket.length > 1){
        const shown = pocket.find(p => p.kind === 'unit') || pocket[0];
        for(const p of pocket) if(p !== shown) patchNotes.push(`${p.title} is not shown: the ABU breast pocket takes one patch, and the ${shown.title} is on it (CAPR 39-1, 5.1.1.1.2.3)`);
      }
    }
    return out;
  }

  // Class A rack options (11.2.7): automatic (rows of three, upper rows kept clear of the lapel
  // as Figure 11-1 allows), or a fixed width: three across, four aligned with the wearer's left
  // edge, or four centred; or the member's own row counts.
  function rackOptions(){
    // Four across only where 11.2.7 allows it; every other uniform keeps rows of three.
    const layout = CAPUBUniformRules.allowsRackColumns(State.uniform, 4) ? String(State.ribbonRackLayout || '3') : '3';
    const automatic = State.ribbonRackArrangement !== 'standard';
    const custom = State.uniform === 'blues_a' && State.ribbonRowOverrideEnabled && Array.isArray(State.ribbonRowOverride) && State.ribbonRowOverride.length;
    if(custom) return { rackColumns: 4, rackArrangement: 'standard', rackCounts: [...State.ribbonRowOverride].reverse() };
    // Automatic still honours the chosen width; it only shortens rows the lapel would cover.
    if(automatic) return { rackColumns: layout === '3' ? 3 : 4, rackAlign: layout === '4-left' ? 'outboard' : undefined, rackArrangement: 'lapel', rackCounts: null };
    return {
      rackColumns: layout === '3' ? 3 : 4,
      rackAlign: layout === '4-left' ? 'outboard' : undefined,
      rackArrangement: 'standard',
      rackCounts: null
    };
  }

  // Ribbons per row in the last drawing, top row first (for the custom row controls).
  function rackRowCounts(){
    if(!lastScene) return [];
    const rows = new Map();
    for(const l of lastScene.layers){
      if(l.role !== 'ribbon') continue;
      const y = l.y.toFixed(3);
      rows.set(y, (rows.get(y) || 0) + 1);
    }
    return [...rows.keys()].sort((a, b) => a - b).map(y => rows.get(y));
  }

  // Notes the page adds to a drawing about the ribbons it was asked for (the engine knows only what it is given).
  let ribbonNotes = [];
  function rotcNotes(wearsMinis){
    const notes = [];
    const chosen = Object.keys(State.ribbonSelections || {}).filter(id => isRotcRibbonId(id) && State.ribbonSelections[id].checked && isAwardWornOnUniform(id));
    if(chosen.length > ROTC_RIBBONS.limit) notes.push(`Only ${ROTC_RIBBONS.limit} JROTC/ROTC ribbons may be worn, so the first ${ROTC_RIBBONS.limit} in order are shown (CAPR 39-1, ${ROTC_RIBBONS.ref})`);
    if(wearsMinis && chosen.length) notes.push('The JROTC/ROTC ribbons have no miniature medal, so none is shown for them');
    return notes;
  }

  function buildFromState(){
    const opt = garmentOptions();
    const g = E.grades.gradeInfo(State.membership, State.rank, { firstSergeant: !!State.cadetFirstSergeant, track: opt.noGradeTrack, commandChief: !!opt.commandChief });
    const ribbons = CAPUBUniformRules.allowsRibbons(State.uniform) ? buildRibbons() : [];
    const mini = CAPUBUniformRules.allowsMiniMedals(State.uniform);
    const allRibbons = mini ? buildRibbons({ allMilestones: true }) : ribbons;
    ribbonNotes = CAPUBUniformRules.allowsRibbons(State.uniform) || mini ? rotcNotes(mini) : [];
    const { badges, command } = buildBadges();
    const text = State.text || {};
    return {
      uniform: State.uniform,
      gender: State.gender === 'female' ? 'female' : 'male',
      membership: State.membership,
      grade: g,
      opt: Object.assign(opt, rackOptions(), {
        miniStyle: State.miniMountStyle === 'holding' ? 'holding' : 'mounting'
      }),
      name: { first: text.firstName || '', last: text.lastName || '', state: text.plateLine || '', show: text.show !== false },
      ribbons: mini ? [] : ribbons,
      medals: mini ? buildMedals(allRibbons) : [],
      badges,
      // Which badge the member wants shown where more are selected than a position takes (the Badges panel; engine: scene.conflicts).
      badgeChoices: Object.assign({}, (State.badgeChoices || {})[State.uniform] || {}),
      command,
      militaryBadges: buildMilitaryBadges(),
      patches: buildPatches(),
      cord: CAPUBUniformRules.allowsCord(State.uniform, State.membership, State.shoulderCord) ? State.shoulderCord : null
    };
  }

  // ---- render ---------------------------------------------------------------------------------

  function canvasEl(){ return document.getElementById('uniformCanvas'); }

  async function render(){
    const seq = ++renderSeq;
    const host = canvasEl();
    if(!host) return null;
    if(!State.membership || !State.gender || !State.rank || !CAPUBEngine.profiles.PROFILES[State.uniform]){
      host.querySelectorAll('svg.uniformSvg').forEach(n => n.remove());
      lastScene = null; lastSvg = null;
      updateBadgeChooser(null);
      return null;
    }
    try{
      const [s] = await Promise.all([getStore(), assets.prepare(State.uniform, State.gender)]);
      const build = buildFromState();
      const scene = await E.profiles.composeUniform(build, s);
      patchNotes.forEach(n => { if(!scene.notes.includes(n)) scene.notes.push(n); });
      ribbonNotes.forEach(n => { if(!scene.notes.includes(n)) scene.notes.push(n); });
      if(seq !== renderSeq) return null; // a newer render started
      const svg = await E.renderSvg.buildSvg(scene, id => s.entry(id).path, Object.assign({ pad: 0.4, measure: !!State.showMeasurements }, window.CAPUBMeasure ? window.CAPUBMeasure.renderOptions(State.uniform) : null));
      if(seq !== renderSeq) return null;
      host.querySelectorAll('svg.uniformSvg, .layer').forEach(n => n.remove());
      sizeStage(svg);
      host.appendChild(svg);
      lastScene = scene; lastSvg = svg;
      host.dataset.rendered = String(seq);
      updateBadgeChooser(scene);
      document.dispatchEvent(new CustomEvent('capub:rendered', { detail: { scene } }));
      return scene;
    }catch(err){
      console.error('[uniform] render failed', err);
      if(typeof capubNotify === 'function' && seq === renderSeq) capubNotify('The uniform could not be drawn. Try another selection or reload the page.');
      return null;
    }
  }

  // The preview stage takes the drawing's proportions at a fixed height, so a wide field uniform
  // sheet and a tall coat both fill it; the zoom control then fits the stage to the window.
  const STAGE_HEIGHT = 640;
  function sizeStage(svg){
    const vb = svg.getAttribute('viewBox').split(/\s+/).map(Number);
    const w = Math.round(Math.min(1200, Math.max(360, STAGE_HEIGHT * vb[2] / vb[3])));
    for(const node of [document.getElementById('previewArea'), canvasEl()]){
      if(!node) continue;
      node.style.width = w + 'px';
      node.style.height = STAGE_HEIGHT + 'px';
      node.dataset.renderWidth = String(w);
      node.dataset.renderHeight = String(STAGE_HEIGHT);
    }
  }

  // Coalesce bursts of changes into one render per frame. The timer is the fallback for hidden
  // tabs, where the browser pauses animation frames.
  let pending = null;
  function scheduleRender(){
    if(pending) return pending;
    pending = new Promise(resolve => {
      let ran = false;
      const run = () => { if(ran) return; ran = true; pending = null; resolve(render()); };
      requestAnimationFrame(run);
      setTimeout(run, 100);
    });
    return pending;
  }

  // PNG export: the same SVG rasterized at `ppi` pixels per inch (default 60, a ~1500 px wide coat).
  async function exportCanvas(ppi){
    if(!lastSvg) await render();
    if(!lastSvg) return null;
    const vb = lastSvg.getAttribute('viewBox').split(/\s+/).map(Number);
    return E.renderSvg.svgToCanvas(lastSvg, vb[2] * (ppi || 60));
  }

  // ---- Badge chooser: which badge goes where --------------------------------------------------------------------------------------

  // The engine reports each position that has more than one badge to place (scene.conflicts: { position, label, limit, candidates: [{ id,
  // title }], shown, choice, slots: [{ key, label, choice, badge, shown }], note }). A position with one place asks for one badge (a radio per
  // competing badge); a position with several places (the pocket and nametag pair, the two places over the nametag, the two over the left
  // pocket) lists its places, each named as the regulation names it, and asks for the badge in each with the same radio rows, one radio group
  // per place (LIVE13 E75, Ethan: "make the badge UIs match (id like them to be all the radio buttons)"; the places were selects before). The
  // picks are kept in State.badgeChoices[uniform][position], a single badge id for one place and { [slotKey]: badgeId } for several, saved with
  // the setup; the engine puts exactly the picked badge in each place and fills a place nobody picked from the rest, in the rule's order.
  const CHOOSER_ID = 'badgeChooser';
  let chooserSignature = '';

  // What the panel draws: one group per position, a heading row (title, how many are worn) and one radio group per place.
  function chooserModel(conflicts){
    return (conflicts || []).map(c => {
      const slots = c.slots && c.slots.length ? c.slots : [{ key: 'only', label: c.label, choice: c.choice, badge: (c.shown || [])[0] || null, shown: true }];
      const many = slots.length > 1;
      return {
        position: c.position,
        title: c.label,
        count: many ? `${slots.length} are worn` : 'one is worn',
        note: c.note || '',
        options: c.candidates.map(x => ({ id: x.id, title: x.title })),
        slots: slots.map(sl => ({ key: sl.key, label: sl.label, value: sl.badge || sl.choice || '', shown: sl.shown !== false }))
      };
    });
  }

  // The full set of picks for a position after `id` is chosen for `key`: a badge sits in one place only, so the place that held `id` takes the
  // badge the picked place had (the two swap).
  function nextBadgePicks(group, key, id){
    const now = {};
    for(const sl of group.slots) now[sl.key] = sl.value;
    const prior = now[key];
    for(const k of Object.keys(now)) if(k !== key && now[k] === id) now[k] = prior;
    now[key] = id;
    return now;
  }

  function setBadgeChoice(position, pick, id){
    // setBadgeChoice(position, id): one place; setBadgeChoice(position, { key: id, ... }): several places.
    State.badgeChoices = State.badgeChoices || {};
    const value = pick && typeof pick === 'object' ? Object.assign({}, pick) : (id !== undefined ? id : pick);
    State.badgeChoices[State.uniform] = Object.assign({}, State.badgeChoices[State.uniform], { [position]: value });
    scheduleRender();
  }

  function chooserHost(){
    let host = document.getElementById(CHOOSER_ID);
    if(host) return host;
    const group = document.getElementById('groupBadges');
    if(!group) return null;
    host = document.createElement('div');
    host.id = CHOOSER_ID;
    host.className = 'badgeChooser hidden';
    host.setAttribute('role', 'region');
    host.setAttribute('aria-label', 'Badge choices');
    const note = document.getElementById('badgesPlannedNote');
    (note || group.querySelector('.hintText') || group.firstElementChild).insertAdjacentElement('afterend', host);
    return host;
  }

  function el(tag, className, text){
    const node = document.createElement(tag);
    if(className) node.className = className;
    if(text != null) node.textContent = text;
    return node;
  }

  function buildChooserGroup(group){
    const root = el('section', 'badgeChooserGroup');
    root.dataset.position = group.position;
    const headId = `badgeChooserHead-${group.position}`;
    const head = el('div', 'badgeChooserHead');
    const title = el('h4', 'badgeChooserTitle', group.title);
    title.id = headId;
    head.append(title, el('span', 'badgeChooserCount', group.count));
    root.append(head);
    if(group.note) root.append(el('p', 'fieldNote badgeChooserNote', group.note));
    if(group.slots.length === 1){
      // One place: the radio rows sit under the heading row.
      root.append(buildChooserOptions(group, group.slots[0], headId));
      return root;
    }
    // Several places: each place has a heading row of its own (its name, whether a badge is shown there) and the same radio rows under it.
    const list = el('div', 'badgeChooserList');
    list.setAttribute('role', 'group');
    list.setAttribute('aria-labelledby', headId);
    for(const sl of group.slots){
      const row = el('div', 'badgeChooserSlot');
      row.dataset.slot = sl.key;
      const nameId = `badgeChooserSlot-${group.position}-${sl.key}`;
      const slotHead = el('div', 'badgeChooserSlotHead');
      const name = el('h5', 'badgeChooserSlotName', sl.label);
      name.id = nameId;
      slotHead.append(name, el('span', 'badgeChooserTag'));
      row.append(slotHead, buildChooserOptions(group, sl, nameId));
      list.append(row);
    }
    root.append(list);
    return root;
  }

  // The radio rows of one place: a radio per competing badge, the badge's name, and a tag saying whether that badge is shown. One radio
  // group (one input name) per place, so the arrow keys move within the place. A position with one place writes the badge id; a position with
  // several writes the picks of all its places (the badge picked here swaps with the one the place held, nextBadgePicks).
  function buildChooserOptions(group, slot, labelledBy){
    const list = el('div', 'badgeChooserList');
    list.setAttribute('role', 'radiogroup');
    list.setAttribute('aria-labelledby', labelledBy);
    const single = group.slots.length === 1;
    for(const cand of group.options){
      const label = el('label', 'badgeChooserOption');
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = single ? `badgeChoice:${group.position}` : `badgeSlot:${group.position}:${slot.key}`;
      input.value = cand.id;
      input.addEventListener('change', () => {
        if(!input.checked) return;
        if(single){ setBadgeChoice(group.position, cand.id); return; }
        const live = (lastScene && lastScene.conflicts || []).find(c => c.position === group.position);
        const current = live ? chooserModel([live])[0] : group;
        setBadgeChoice(group.position, nextBadgePicks(current, slot.key, cand.id));
      });
      label.append(input, el('span', 'badgeChooserName', cand.title), el('span', 'badgeChooserTag'));
      list.append(label);
    }
    return list;
  }

  function updateBadgeChooser(scene){
    const host = chooserHost();
    if(!host) return;
    const conflicts = (scene && scene.conflicts) || [];
    if(!conflicts.length){ host.classList.add('hidden'); host.replaceChildren(); chooserSignature = ''; return; }
    host.classList.remove('hidden');
    const model = chooserModel(conflicts);
    const signature = JSON.stringify(model.map(g => [g.position, g.slots.map(sl => sl.key + '|' + sl.label), g.options.map(x => x.id + '|' + x.title)]));
    if(signature !== chooserSignature){
      // Rebuilt only when the competing badges or the places change, so a pick never loses keyboard focus.
      chooserSignature = signature;
      const focused = document.activeElement && host.contains(document.activeElement) ? document.activeElement : null;
      const keep = focused ? { id: focused.id, name: focused.name, value: focused.value } : null;
      host.replaceChildren();
      host.append(el('p', 'hintText badgeChooserLead', 'Where a uniform has more than one place for badges, pick the badge for each place.'));
      for(const g of model) host.append(buildChooserGroup(g));
      if(keep){
        const again = [...host.querySelectorAll('input')].find(n => n.name === keep.name && n.value === keep.value);
        if(again) again.focus();
      }
    }
    // The picked and the shown badges, read off the latest scene: in each place the radio of the badge the place holds is checked, and a
    // row's tag reads "shown" when that badge is drawn in that place and "not shown" when it is drawn nowhere in the position; a badge drawn
    // in another place of the same position carries no tag (that place's own heading row says it is shown there).
    for(const g of model){
      const root = host.querySelector(`[data-position="${CSS.escape(g.position)}"]`);
      if(!root) continue;
      const shown = new Set(conflicts.find(c => c.position === g.position).shown || []);
      for(const sl of g.slots){
        const row = g.slots.length === 1 ? root : root.querySelector(`.badgeChooserSlot[data-slot="${CSS.escape(sl.key)}"]`);
        if(!row) continue;
        const slotTag = row.querySelector('.badgeChooserSlotHead .badgeChooserTag');
        if(slotTag) slotTag.textContent = sl.shown ? 'shown' : 'not shown';
        for(const label of row.querySelectorAll('label.badgeChooserOption')){
          const input = label.querySelector('input');
          input.checked = input.value === sl.value;
          const here = input.checked && sl.shown;
          label.querySelector('.badgeChooserTag').textContent = here ? 'shown' : (shown.has(input.value) ? '' : 'not shown');
        }
      }
    }
  }

  // ---- Ribbon picker: what a selection puts on the ribbon -------------------------------------

  // "device-clasp-bronze" -> "bronze clasp"; "device-years-25" -> "25-year numeral".
  function deviceWords(id){
    let m;
    if((m = /^device-years-(\d+)$/.exec(id))) return `${m[1]}-year numeral`;
    if((m = /^device-(clasp|star|propeller)-(bronze|silver|gold)$/.exec(id))) return m[1] === 'propeller' ? 'propeller' : `${m[2]} ${m[1]}`;
    if(id === 'device-v') return 'silver V';
    if((m = /^mil-device-(.+)$/.exec(id))) return m[1].replace(/-/g, ' ');
    return id.replace(/^device-/, '').replace(/-/g, ' ');
  }
  function countWords(ids){
    const counts = new Map();
    ids.forEach(id => counts.set(deviceWords(id), (counts.get(deviceWords(id)) || 0) + 1));
    return [...counts].map(([w, n]) => n > 1 ? `${n} ${w.replace(/([^s])$/, '$1s')}` : `1 ${w}`).join(', ');
  }
  // One line for the ribbon picker, from the same rule the uniform uses (data/ribbon-awards.js).
  function describeRibbon(id, sel){
    const parts = CAPUBRibbonAwards.resolve(id, Object.assign({ membership: State.membership }, sel));
    const say = p => p.devices.length ? countWords(p.devices) : 'no devices';
    if(parts.length === 1) return parts[0].devices.length ? `Devices: ${say(parts[0])}` : 'Basic ribbon, no devices';
    return parts.map((p, i) => `Ribbon ${i + 1}: ${say(p)}`).join('; ');
  }
  // The ribbon (and any extra ribbons the devices need) drawn by the engine with its devices. A military ribbon is its one SVG with the
  // devices the award count gives, at the catalog's own slots (military/military-device-layout.js), as its precomposed picture had them.
  function previewItems(id, sel){
    if(isMilitaryRibbonId(id)){
      const sequence = militaryDeviceSequence({ id, devices: sel.devices || {} });
      const devicePlan = window.CAPUBMilitaryDeviceLayout?.ribbonDevicePlan(sequence) || [];
      return [{ key: `ribbon:${id}#0`, title: id, asset: getMilitaryRibbonAward(id)?.images?.ribbonAsset || null, devicePlan, devices: sequence.map(militaryDeviceAsset).filter(Boolean), centered: false, military: true }];
    }
    const parts = CAPUBRibbonAwards.resolve(id, Object.assign({ membership: State.membership }, sel));
    return parts.map((p, i) => ({ key: `ribbon:${id}#${i}`, title: id, asset: ribbonAssetId(id), devices: p.devices, centered: p.centered }));
  }
  async function ribbonPreview(id, sel){
    const s = await getStore();
    const items = previewItems(id, sel);
    const ctx = E.compose.createContext({}, s);
    await E.compose.drawRack(ctx, items, { centerX: 0, bottomY: 0 }, { perRow: Math.min(3, items.length) });
    const scene = E.compose.finish(ctx, id);
    if(!scene.layers.length) return null;
    const svg = await E.renderSvg.buildSvg(scene, aid => s.entry(aid).path, { pad: isMilitaryRibbonId(id) ? 0 : 0.02 });
    svg.removeAttribute('width'); svg.removeAttribute('height');
    svg.classList.add('ribbonPreviewSvg');
    return svg;
  }
  // Swap a picker tile's <img> for the drawn ribbon; the plain image stays if anything fails.
  function fillRibbonPreview(img, id, sel){
    if(!img) return;
    ribbonPreview(id, sel).then(svg => {
      if(!svg || !img.isConnected) return;
      svg.setAttribute('role', 'img');
      svg.setAttribute('aria-label', img.getAttribute('alt') || id);
      img.replaceWith(svg);
    }).catch(() => {});
  }

  // A ribbon's miniature medal as the uniform draws it: the drape, the medal body and the devices. Null when the award has none.
  async function miniMedalPreview(id, sel){
    const s = await getStore();
    const ctx = E.compose.createContext({}, s);
    await E.compose.drawMiniMedals(ctx, buildMedals(previewItems(id, sel)), { w: 1, centerX: 0, bottomY: 0 }, { perRow: 1 });
    const scene = E.compose.finish(ctx, id);
    if(!scene.layers.length) return null;
    const svg = await E.renderSvg.buildSvg(scene, aid => s.entry(aid).path, { pad: 0.02 });
    svg.removeAttribute('width'); svg.removeAttribute('height');
    return svg;
  }
  // Put the drawn miniature in a picker tile's place for it.
  function fillMiniMedalPreview(host, id, sel){
    if(!host) return;
    miniMedalPreview(id, sel).then(svg => { if(svg && host.isConnected) host.replaceChildren(svg); }).catch(() => {});
  }

  window.CAPUBUniformView = {
    // Fetches the manifest ahead of the first drawing (js/bootstrap.js calls it once the page is idle).
    warm: () => getStore().then(() => true, () => false),
    render, scheduleRender, exportCanvas, updateBadgeChooser, setBadgeChoice, chooserModel, nextBadgePicks, buildFromState, rackRowCounts, describeRibbon, ribbonPreview, fillRibbonPreview, miniMedalPreview, fillMiniMedalPreview,
    get ribbonNotes(){ return ribbonNotes; },
    get scene(){ return lastScene; },
    get svg(){ return lastSvg; },
    GARMENT_DEFAULTS
  };
})();
