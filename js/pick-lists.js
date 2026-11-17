// The lists the chooser window offers (badges, ribbons, patches) as picture tiles of the picture picker (js/visual-picker.js, toggle mode): the item's own drawing, its name under
// it, a tap turns it on or off and the tile shows it. Ribbons use a Select checkbox for a single choice and a dropdown for award counts / levels. What a badge needs besides on and off (its level, its Graduated commander
// switch) is a control under its tile that shows while the tile is on.
//
// Each builder takes the container, the list and `deps` (the page's own functions and state, by default the page's globals read when it is called; the tests give their own).
// It returns { picker, ids, refresh, setOptions }: refresh() puts every tile as the page's state says, and the window's search reads the pickers listed in
// window.CAPUB_MODAL_PICKERS (js/wiring.js).
(function(root, factory){
  const api = factory();
  if(typeof module === 'object' && module.exports) module.exports = api;
  else root.CAPUBPickLists = api;
})(typeof self !== 'undefined' ? self : this, function(){
  'use strict';

  // The page's own functions, looked up when a list is built (they are the page's globals: the scripts are classic scripts).
  function pageDeps(){
    /* global State, ASSET, getBadgeAssetPath, getBadgeDisplayName, isCommandInsigniaBadge, CAPUBBadgeCatalog, canSelectCommandInsigniaForCurrentRank,
       chooseOnlyCommandInsignia, rebuildBadgesFromGallery, isCommandInsigniaGradeEligible, fullRender, getAvailableMilitaryBadgeVariants, militaryServiceLabel, PATCH_META,
       capubBadgeSummary, patchTileWords, setPatchPlacement, normalizePatchSelections, rebuildPatchesFromGallery, getEligibleRibbonIds, isAwardWornOnUniform, isRotcRibbonId, isMilitaryRibbonId, groupRibbonIds,
       getRibbonDisplayName, getRibbonImagePath, getRibbonAwardOptions, capubFirstRibbonOptionValue, setRibbonSelectionFromDropdown, normalizeRibbonSelections, CAPUBRibbonAwards,
       CAPUBUniformRules, hasMiniMedal, CAPUBUniformView, capubInstallImageFallback, ROTC_RIBBONS, capubRotcLimitMessage, getMilitaryRibbonIds, getMilitaryRibbonAward, getMilitaryAwardBranch,
       militaryAwardFilterType, getMilitarySelectionService, deviceMeta, MILITARY_BRANCH_ORDER, MILITARY_BRANCH_LABELS, isMilitaryAwardWornOnUniform, getMilitaryUIState */
    return {
      State: typeof State !== 'undefined' ? State : null,
      VisualPicker: typeof VisualPicker !== 'undefined' ? VisualPicker : null,
      asset: p => ASSET(p),
      artPath: id => getBadgeAssetPath(id),
      name: id => getBadgeDisplayName(id),
      isCommand: id => isCommandInsigniaBadge(id),
      levels: id => typeof CAPUBBadgeCatalog !== 'undefined' ? CAPUBBadgeCatalog.levels(id) : null,
      level: (id, level) => CAPUBBadgeCatalog.level(id, level)[0],
      // The drawing of a badge at a level (the path the page loads it from), for the tile of that level.
      levelArt: (id, level) => { const art = CAPUBBadgeCatalog.art(id, 'dress', level); return (art && window.CAPUBAssetIndex && CAPUBAssetIndex[art]) || ''; },
      // The command pin as the engine draws it worn each way (`values`: 'current', 'graduated'): { now, ready, settled }, a picture for each or false where the uniform does not draw it.
      commandPictures: values => typeof CAPUBOptionPictures !== 'undefined' ? CAPUBOptionPictures.pictures('commandWorn', values) : null,
      canCommand: () => canSelectCommandInsigniaForCurrentRank(true),
      chooseOnlyCommand: id => chooseOnlyCommandInsignia(id),
      rebuild: () => rebuildBadgesFromGallery(),
      fullRender: () => fullRender(),
      variants: badge => getAvailableMilitaryBadgeVariants(badge),
      serviceLabel: service => militaryServiceLabel(service),
      // what the drawing did with each badge chosen (js/badge-rules.js capubBadgeSummary): { id, shown, place, why, pending }
      badgeRows: () => typeof capubBadgeSummary === 'function' ? capubBadgeSummary() : [],
      // The window's short status line (js/wiring.js): what a tap on a tile says, with its paragraph.
      say: text => { if(typeof window !== 'undefined' && typeof window.capubModalSay === 'function') window.capubModalSay(text); },
      // what the drawing did with each patch chosen (js/badge-rules.js capubPatchSummary): { id, name, shown, place, why }
      patchRows: () => typeof capubPatchSummary === 'function' ? capubPatchSummary() : [],
      // patches
      patchIds: () => window.capubVisiblePatchIdsForGallery(),
      patchMeta: id => PATCH_META[id] || {},
      patchWords: id => patchTileWords(id),
      // Each place of a patch as the engine draws the uniform with the patch there (`slots`): { now, ready, settled }, a picture for each or false where it draws no patch at that place.
      patchPlacePictures: (id, slots) => typeof CAPUBOptionPictures !== 'undefined' ? CAPUBOptionPictures.pictures('patchPlace:' + id, slots) : null,
      setPlace: (id, slot) => setPatchPlacement(id, slot),
      keepOneTab: id => window.capubKeepOneRangerTab(id),
      normalizePatches: () => normalizePatchSelections(),
      rebuildPatches: () => rebuildPatchesFromGallery(),
      // ribbons
      ribbonIds: () => getEligibleRibbonIds().filter(id => isAwardWornOnUniform(id)),
      isRotc: id => isRotcRibbonId(id),
      isMilitary: id => isMilitaryRibbonId(id),
      ribbonGroups: ids => groupRibbonIds(ids),
      ribbonName: id => getRibbonDisplayName(id),
      ribbonArt: id => getRibbonImagePath(id),
      ribbonOptions: id => getRibbonAwardOptions(id),
      ribbonSelectionOption: (id, value) => getRibbonSelectionOption(id, value),
      firstOption: id => capubFirstRibbonOptionValue(id),
      setRibbon: (id, value) => setRibbonSelectionFromDropdown(id, value),
      normalizeRibbons: () => normalizeRibbonSelections(),
      describeRibbon: (id, sel) => window.CAPUBRibbonAwards ? CAPUBRibbonAwards.describe(id, Object.assign({ membership: State.membership }, sel)) : '',
      ribbonHint: id => window.CAPUBRibbonAwards ? CAPUBRibbonAwards.hint(id) : '',
      // '' where the uniform wears no miniature medals (or the ribbon has none to show), 'yes' with its picture, 'missing' without one
      miniMedal: id => !CAPUBUniformRules.allowsMiniMedals(State.uniform) || isRotcRibbonId(id) ? '' : (hasMiniMedal(id) ? 'yes' : 'missing'),
      drawRibbon: (img, id, sel) => { if(window.CAPUBUniformView) CAPUBUniformView.fillRibbonPreview(img, id, sel); },
      drawMini: (host, id, sel) => { if(window.CAPUBUniformView) CAPUBUniformView.fillMiniMedalPreview(host, id, sel); },
      fallback: (img, id) => capubInstallImageFallback(img, [getRibbonImagePath({ id, awardValue: '' })]),
      rotc: () => ROTC_RIBBONS,
      rotcLimitMessage: () => capubRotcLimitMessage(),
      militaryIds: () => getMilitaryRibbonIds(),
      militaryAward: id => getMilitaryRibbonAward(id),
      militaryBranchOf: award => getMilitaryAwardBranch(award),
      militaryType: award => militaryAwardFilterType(award),
      militaryService: (id, sel) => getMilitarySelectionService(id, sel),
      militaryRules: (award, service, advanced) => window.CAPUBMilitary && window.CAPUBMilitary.inferDeviceRules ? window.CAPUBMilitary.inferDeviceRules(award, service, { allowUnverified: !!advanced }) : null,
      deviceLabel: deviceId => (deviceMeta[deviceId] && deviceMeta[deviceId].label) || '',
      // The devices of a U.S. military ribbon as the page works them out (setRibbonSelectionFromDropdown): a map { deviceId: count } for the selection `sel` with `over` ({ service, count,
      // specials }) in place of its own, so a picture of a choice is made from the rule the drawing follows.
      militaryDevices: (id, sel, over) => {
        const o = over || {}, award = getMilitaryRibbonAward(id), s = sel || {};
        const calc = window.CAPUBMilitary && window.CAPUBMilitary.calculateDevices ? window.CAPUBMilitary.calculateDevices({
          award, service: o.service || getMilitarySelectionService(id, s), awardCount: o.count != null ? o.count : Math.max(1, Number(s.awardCount) || 1),
          specialAuthorizations: o.specials || s.specialAuthorizations || [],
          manualDevices: Number(s.manualNumeral) > 1 ? [`NUMERAL_${Math.min(99, Math.max(2, Math.trunc(Number(s.manualNumeral))))}`] : [], allowUnverifiedRules: !!getMilitaryUIState().advancedMode
        }) : null;
        const out = {};
        for(const device of (calc && calc.devices) || []) out[device] = (out[device] || 0) + 1;
        return out;
      },
      branchOrder: () => MILITARY_BRANCH_ORDER,
      branchLabels: () => MILITARY_BRANCH_LABELS,
      militaryWorn: () => isMilitaryAwardWornOnUniform(),
      ui: () => getMilitaryUIState(),
      escapeText: s => String(s == null ? '' : s)
    };
  }
  const withDeps = deps => Object.assign(pageDeps(), deps || {});

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if(className) node.className = className;
    if(text != null) node.textContent = text;
    return node;
  };

  // ---- badges ------------------------------------------------------------------------------------------------------------------------------

  // The badges turned on, as the page's selections have them.
  const selectedIn = (d, ids) => ids.filter(id => d.State.badgeSelections[id] && d.State.badgeSelections[id].checked);
  const sel = (d, id) => d.State.badgeSelections[id] || (d.State.badgeSelections[id] = { checked: false });

  const sentence = t => { const x = String(t || ''); return x.charAt(0).toUpperCase() + x.slice(1); };
  const stopped = t => /[.)]$/.test(t) ? t : t + '.';

  // What a tap on a badge's tile says in the window's status line (not on the tile): where the drawing wore it, or why it is left off, with its paragraph; nothing until the drawing
  // has been made.
  function badgeNote(rows, id, name){
    const row = rows.find(r => r.id === id || (name && r.name === name));
    if(!row || row.pending) return '';
    if(row.shown) return row.place ? `${name}: ${row.place}.` : '';
    return row.why ? `${name} is not shown. ${stopped(sentence(row.why))}` : '';
  }
  // A badge or patch that is chosen and that the drawing leaves off looks unavailable: its picture is dim, its name stays.
  const leftOff = (rows, id, name, on) => { const row = rows.find(r => r.id === id || (name && r.name === name)); return !!on && !!row && !row.pending && !row.shown; };

  // What a tap does: the badge on or off, the page's rules after it (one command pin, the exclusive badges, the order: rebuildBadgesFromGallery). A command pin above the grade that
  // wears one (CAPR 39-1, 10.2.5) turns back, with the reason. Returns whether the badge is on afterwards.
  function selectBadge(id, on, deps){
    const d = withDeps(deps);
    const s = sel(d, id);
    if(on && d.isCommand(id) && !d.canCommand()) return false;
    s.checked = !!on;
    d.State.badgeSelections[id] = s;
    if(on && d.isCommand(id)) d.chooseOnlyCommand(id);
    d.rebuild();
    return !!(d.State.badgeSelections[id] && d.State.badgeSelections[id].checked);
  }
  // A badge earned in levels (STEM, Cyber, NRA): its level, and so its drawing.
  function setBadgeLevel(id, level, deps){
    const d = withDeps(deps);
    sel(d, id).level = level;
    d.rebuild();
  }
  // The command pin as a graduated commander (under the name tag), or as a current one.
  function setGraduated(id, on, deps){
    const d = withDeps(deps);
    if(on && !d.canCommand()) return false;
    if(!d.State.commandInsignia) d.State.commandInsignia = {};
    d.State.commandInsignia.graduatedCommander = !!on;
    if(on){ sel(d, id).checked = true; d.chooseOnlyCommand(id); }
    d.rebuild();
    return true;
  }

  // The words on a level's tile: its name without the paragraph in brackets (which is the tile's title), so a long name does not run over a small tile.
  const shortLevel = text => String(text || '').replace(/\s*\(.*$/, '') || String(text || '');
  const graduatedNow = d => !!(d.State.commandInsignia && d.State.commandInsignia.graduatedCommander);

  // The command pin worn each way, as the engine draws the uniform with it: two tiles (current commander over the name tag, graduated commander under it), the one the member has picked
  // marked. The pictures are made as the page is free to; a way the uniform does not draw (the flight suit has no graduated pin) is not offered, and one way is no choice.
  function commandRow(d, id, deps, again){
    const host = el('div', 'vpCommandWorn');
    host.hidden = true;
    const values = ['current', 'graduated'];
    const words = { current: 'Current commander', graduated: 'Graduated commander' };
    const made = d.commandPictures ? d.commandPictures(values) : null;
    const paint = known => {
      host.textContent = '';
      const offered = values.filter(v => known[v] !== false);
      if(offered.length < 2){ host.hidden = true; return; }
      host.append(pictureRow(d, {
        name: `commandWorn-${id}`, label: 'Where the command pin is worn', value: graduatedNow(d) ? 'graduated' : 'current', pictureHeight: '56px',
        options: offered.map(v => ({ value: v, label: words[v], picture: known[v] || undefined })),
        onChange: v => { setGraduated(id, v === 'graduated', deps); again(); }
      }).host);
      host.hidden = false;
    };
    if(!made) paint({});
    else{
      if(made.settled || Object.keys(made.now).length) paint(made.now);
      if(!made.settled) made.ready.then(done => paint(done));
    }
    return host;
  }

  // One picker for the badges of a list of categories: `groups` is [{ key, ids }], the key a heading above its tiles.
  function badgeList(container, groups, deps){
    const d = withDeps(deps);
    const ids = groups.flatMap(g => g.ids);
    const controls = id => {
      const box = el('div', 'vpControlStack');
      const levels = d.levels(id);
      // The level of a badge earned in levels: a tile for each, the badge's own drawing at that level.
      if(levels){
        box.append(pictureRow(d, {
          name: `badgeLevel-${id}`, label: `Level of the ${d.name(id)}`, value: d.level(id, sel(d, id).level), pictureHeight: '52px',
          options: levels.map(([key, text]) => ({ value: key, label: shortLevel(text), title: shortLevel(text) !== text ? text : undefined, picture: d.levelArt ? d.asset(d.levelArt(id, key)) : undefined })),
          onChange: key => { setBadgeLevel(id, key, deps); entry.setOptions(); }
        }).host);
      }
      if(d.isCommand(id)) box.append(commandRow(d, id, deps, () => entry.setOptions()));
      return box.childNodes.length ? box : null;
    };
    // The controls of a badge that has levels are made for every tile and shown while it is on; a command pin's are made only while it is on (the pin as drawn depends on which pin is held),
    // so the list is made again when the pin held changes.
    const pinsOn = () => ids.filter(id => d.isCommand(id) && d.State.badgeSelections[id] && d.State.badgeSelections[id].checked).join();
    let built = '';
    const options = () => { built = pinsOn(); const rows = d.badgeRows(), on = new Set(selectedIn(d, ids)); return groups.flatMap(g => g.ids.map(id => ({ value: id, label: d.name(id), picture: d.asset(d.artPath(id)), muted: leftOff(rows, id, d.name(id), on.has(id)), group: g.key, search: g.key, controls: isOn => !d.isCommand(id) || isOn ? controls(id) : null }))); };
    // The last badge the member turned on: the window's status line says what the drawing did with it, as soon as the drawing has been made.
    let tapped = null;
    const say = () => { if(tapped) d.say(badgeNote(d.badgeRows(), tapped, d.name(tapped))); };
    const host = el('div');
    container.append(host);
    const picker = d.VisualPicker.render(host, {
      name: 'badges', ariaLabel: 'Badges', mode: 'toggle', size: 'large', options: options(), values: selectedIn(d, ids),
      onToggle: (id, on) => { tapped = on ? id : null; if(!on) d.say(''); selectBadge(id, on, deps); entry.refresh(); say(); }
    });
    const entry = {
      picker, ids,
      // Every tile as the state says (a pin turned on turns the other off; a badge the rules took off is off); the controls again where the pin held has changed.
      refresh(){
        picker.setValues(selectedIn(d, ids));
        if(pinsOn() !== built) keepingFocus(picker.el, () => picker.setOptions(options()));
      },
      // The pictures again (a badge at another level is another drawing); a field the member was in under a tile keeps the focus.
      setOptions(){ keepingFocus(picker.el, () => { picker.setValues(selectedIn(d, ids)); picker.setOptions(options()); }); },
      // The drawing has been made again: what it did with each badge chosen is the line under its name.
      rendered(){ entry.setOptions(); say(); }
    };
    return entry;
  }

  // The U.S. military badges of one branch: each its own drawing at the level (variant) it is at, its name and the service it is for under it; a badge with levels lists them under its tile
  // while it is on. `records` are the catalog's badges.
  function militaryBadgeList(container, branch, records, deps){
    const d = withDeps(deps);
    const byId = new Map(records.map(badge => [badge.id, badge]));
    const chosen = () => Object.keys(d.State.militaryBadges || {}).filter(id => byId.has(id));
    const variantOf = badge => {
      const variants = d.variants(badge);
      const selected = d.State.militaryBadges && d.State.militaryBadges[badge.id];
      const active = (selected && selected.variant) || (badge.representations && badge.representations.metal && badge.representations.metal.defaultVariant) || variants[0].id;
      return { variants, active };
    };
    const pictureOf = badge => { const { variants, active } = variantOf(badge); return (variants.find(v => v.id === active) || variants[0]).record.asset; };
    const nameOf = badge => badge.officialName || badge.id;
    let tapped = null;
    const options = () => { const rows = d.badgeRows(), on = new Set(chosen()); return records.map(badge => ({
      value: badge.id, label: nameOf(badge), picture: pictureOf(badge), muted: leftOff(rows, badge.id, nameOf(badge), on.has(badge.id)), search: `${branch} ${badge.family || ''}`,
      controls: () => {
        const { variants, active } = variantOf(badge);
        if(variants.length < 2) return null;
        // The level or variant of the badge: a tile for each, the badge's own drawing at that level.
        return pictureRow(d, {
          name: `militaryVariant-${badge.id}`, label: `Level of the ${badge.officialName || badge.id}`, value: active, pictureHeight: '52px',
          options: variants.map(v => ({ value: v.id, label: v.id.replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase()), picture: v.record.asset })),
          onChange: variant => {
            if(!d.State.militaryBadges) d.State.militaryBadges = {};
            d.State.militaryBadges[badge.id] = { selected: true, variant };
            d.fullRender();
            again();
          }
        }).host;
      }
    })); };
    const host = el('div');
    container.append(host);
    const picker = d.VisualPicker.render(host, {
      name: `militaryBadges-${branch}`, ariaLabel: `${(typeof MILITARY_BRANCH_LABELS !== 'undefined' && MILITARY_BRANCH_LABELS[branch]) || String(branch).replaceAll('_', ' ').toLowerCase().replace(/^./, c => c.toUpperCase())} badges`, mode: 'toggle', size: 'large', options: options(), values: chosen(),
      onToggle: (id, on) => {
        if(!d.State.militaryBadges) d.State.militaryBadges = {};
        if(on) d.State.militaryBadges[id] = { selected: true, variant: variantOf(byId.get(id)).active };
        else delete d.State.militaryBadges[id];
        tapped = on ? id : null;
        if(!on) d.say('');
        d.fullRender();
        say();
      }
    });
    // The last badge turned on: the window's status line says what the drawing did with it once the drawing has been made.
    const say = () => { if(tapped) d.say(badgeNote(d.badgeRows(), tapped, nameOf(byId.get(tapped)))); };
    // The list made again (the drawing has been made again, or a level was picked): the picture of each badge at its level; a field the member was in under a tile keeps the focus.
    const again = () => keepingFocus(picker.el, () => { picker.setValues(chosen()); picker.setOptions(options()); });
    return { picker, ids: [...byId.keys()], refresh(){ picker.setValues(chosen()); }, rendered(){ again(); say(); } };
  }

  // ---- patches ------------------------------------------------------------------------------------------------------------------------------

  const patchOn = (d, id) => !!(d.State.patchSelections[id] && d.State.patchSelections[id].checked && d.patchWords(id).authorized);

  // What a tap does: the patch on or off (never one the uniform does not take), a one-only group (a Ranger tab) keeping the one picked, then the drawing. Returns whether it is on.
  function selectPatch(id, on, deps){
    const d = withDeps(deps);
    const s = d.State.patchSelections[id] || (d.State.patchSelections[id] = { checked: false });
    s.checked = !!on && d.patchWords(id).authorized;
    d.State.patchSelections[id] = s;
    if(s.checked && d.patchMeta(id).oneOnly) d.keepOneTab(id);
    d.rebuildPatches();
    return patchOn(d, id);
  }

  // The tiles of the patches the uniform takes (`ids`, in the order shown): the patch's own picture, its name and where it is worn under it, a heading (with its note) for a
  // group of its own; a patch with more than one place on the uniform has its places under its tile while it is on, a tile for each, the uniform as the engine draws it with the patch
  // at that place. A patch the uniform does not take is not listed.
  function patchList(container, ids, deps){
    const d = withDeps(deps);
    d.normalizePatches();
    const listed = () => (ids || d.patchIds()).filter(id => d.patchWords(id).authorized);
    // The patches that are on and have places to choose from: their tiles carry the choice, so the list is made again when these change.
    const placed = () => listed().filter(id => patchOn(d, id) && d.patchWords(id).places.length > 1).join();
    let built = '';
    // A patch chosen that the drawing leaves off looks unavailable (its picture is dim); a tap on a tile says in the window's status line where the patch is worn, or why it is left off.
    const rowOf = id => { const title = d.patchWords(id).title; return (d.patchRows() || []).find(r => r.id === id || r.name === title); };
    const leftOffPatch = id => { const row = rowOf(id); return patchOn(d, id) && !!row && !row.shown; };
    let tapped = null;
    const say = () => {
      if(!tapped) return;
      const row = patchOn(d, tapped) ? rowOf(tapped) : null, title = d.patchWords(tapped).title;
      d.say(!row ? '' : row.shown ? (row.place ? `${title}: ${row.place}.` : '') : (row.why ? `${title} is not shown. ${stopped(sentence(row.why))}` : ''));
    };
    const options = () => {
      built = placed();
      return listed().map(id => {
        const meta = d.patchMeta(id), words = d.patchWords(id);
        return {
          value: id, label: words.title, picture: meta.img ? d.asset(meta.img) : undefined, muted: leftOffPatch(id),
          group: meta.group || undefined, groupNote: meta.group ? meta.note : undefined, search: meta.group || '',
          controls: isOn => isOn ? placeChoice(id) : null
        };
      });
    };
    // The places of a patch (one only on most uniforms: no choice then): a tile for each, the uniform with the patch at that place, under the tile while it is on. A place the engine draws
    // no patch at is not offered (unless it is the one drawn), and with fewer than two left there is no choice. The pictures are made as the page is free to.
    const placeChoice = id => {
      const words = d.patchWords(id);
      if(words.places.length < 2) return null;
      const host = el('div', 'vpPlaceChoice');
      const slots = words.places.map(place => place.slot);
      const made = d.patchPlacePictures ? d.patchPlacePictures(id, slots) : null;
      const paint = known => {
        host.textContent = '';
        const now = d.patchWords(id).slot;
        const offered = words.places.filter(place => known[place.slot] !== false || place.slot === now);
        if(offered.length < 2){ host.hidden = true; return; }
        host.append(pictureRow(d, {
          name: `patchPlace-${id}`, label: 'Where the patch is worn', value: now, pictureHeight: '72px', tileWidth: '128px',
          options: offered.map(place => ({ value: place.slot, label: place.label, picture: known[place.slot] || undefined })),
          onChange: slot => {
            d.setPlace(id, slot);
            d.rebuildPatches();
            tapped = id;
            say();
          }
        }).host);
        host.hidden = false;
      };
      if(!made) paint({});
      else{
        if(made.settled || Object.keys(made.now).length) paint(made.now); else host.hidden = true;
        if(!made.settled) made.ready.then(done => paint(done));
      }
      return host;
    };
    const host = el('div');
    container.append(host);
    const picker = d.VisualPicker.render(host, {
      name: 'patches', ariaLabel: 'Patches', mode: 'toggle', size: 'large', options: options(), values: listed().filter(id => patchOn(d, id)),
      onToggle: (id, on) => { tapped = on ? id : null; if(!on) d.say(''); selectPatch(id, on, deps); entry.refresh(); say(); }
    });
    const entry = {
      picker, ids: listed(),
      // Every tile as the state says (a Ranger tab picked turns the other tabs off); the places again where the patches that have them changed.
      refresh(){
        picker.setValues(listed().filter(id => patchOn(d, id)));
        if(placed() !== built) keepingFocus(picker.el, () => picker.setOptions(options()));
      },
      setOptions(){ keepingFocus(picker.el, () => { picker.setValues(listed().filter(id => patchOn(d, id))); picker.setOptions(options()); }); },
      // The drawing has been made again: a patch it left off is dim, and the last tap says where the patch is worn or why it is not.
      rendered(){ entry.setOptions(); say(); }
    };
    return entry;
  }

  // ---- choices made by picture, in a row ----------------------------------------------------------------------------------------------------

  // A choice under a tile (the count of a ribbon, the service of a military award, its devices) as tiles in one row that scrolls sideways where the choices run long: each tile is the
  // item as the engine draws it at that choice (`draw(img)` fills the tile's picture, called as the tile comes into view, so a row of a hundred tiles draws what is seen). `toggle`: any
  // number of the tiles on (the devices); otherwise one of them picked (`value`, `onChange`). Returns the host and the picker.
  function pictureRow(d, cfg){
    const host = el('div', 'vpRow');
    const picker = d.VisualPicker.render(host, Object.assign({
      name: cfg.name, ariaLabel: cfg.label, layout: 'row', size: 'small', shape: cfg.shape || 'wide',
      options: cfg.options.map(o => ({ value: o.value, label: o.label, picture: o.picture, title: o.title }))
    }, cfg.toggle ? { mode: 'toggle', values: cfg.values, onToggle: cfg.onToggle } : { value: cfg.value, onChange: cfg.onChange }));
    if(host.style && host.style.setProperty && cfg.pictureHeight) host.style.setProperty('--vpRowPic', cfg.pictureHeight);
    if(host.style && host.style.setProperty && cfg.tileWidth) host.style.setProperty('--vpRowW', cfg.tileWidth);
    const draws = new Map(cfg.options.filter(o => typeof o.draw === 'function').map(o => [String(o.value), o.draw]));
    if(draws.size){
      const seen = typeof IntersectionObserver === 'function'
        ? new IntersectionObserver(entries => entries.forEach(e => { if(e.isIntersecting){ seen.unobserve(e.target); if(e.target.__draw) e.target.__draw(); } }), { rootMargin: '160px' })
        : null;
      for(const tile of picker.el.querySelectorAll(cfg.toggle ? '.vpCell' : '.vpOption')){
        const draw = draws.get(tile.dataset.value), img = tile.querySelector('img');
        if(!draw || !img) continue;
        tile.__draw = () => draw(img);
        if(seen) seen.observe(tile); else tile.__draw();
      }
    }
    return { host, picker };
  }

  // The list made again (a count, a level or a service was picked): the field the member was in under a tile (a tile of a row, the numeral) keeps the focus, the same tile of the same row
  // of the same item, else the same kind of field.
  function keepingFocus(root, rebuild){
    const active = document.activeElement;
    const inside = active && root.contains && root.contains(active) ? active : null;
    const cell = inside && inside.closest ? inside.closest('.vpCell') : null;
    const row = inside && inside.closest ? inside.closest('.vp') : null;
    const keep = cell && inside !== cell.querySelector('.vpOption')
      ? { value: cell.dataset.value, className: String(inside.className || '').split(' ')[0], option: inside.dataset ? inside.dataset.value : '', row: row && row.dataset ? row.dataset.name : '' } : null;
    rebuild();
    if(!keep) return;
    const again = Array.from(root.querySelectorAll('.vpCell')).find(c => c.dataset.value === keep.value);
    const rowAgain = again && keep.row ? Array.from(again.querySelectorAll('.vp')).find(v => v.dataset.name === keep.row) : null;
    const target = rowAgain
      ? Array.from(rowAgain.querySelectorAll('.vpOption')).find(n => n.dataset.value === keep.option)
      : again && Array.from(again.querySelectorAll('.' + keep.className)).find(n => n !== again.querySelector('.vpOption'));
    if(target && target.focus) target.focus();
  }

  // ---- ribbons ------------------------------------------------------------------------------------------------------------------------------

  const chosenRibbon = (d, id) => !!(d.State.ribbonSelections[id] && d.State.ribbonSelections[id].checked);

  // Display text only: keep the catalog labels and values used by imports and device rules intact.
  function ribbonOptionLabel(id, option){
    if(id === 'cap_gill_robb_wilson_ribbon' || id === 'cap_paul_e_garber_ribbon'){
      const schools = { 'Bronze Star': 'Squadron Officer School', 'Silver Star': 'Air Command and Staff College', 'Gold Star': 'Air War College' };
      if(schools[option.label]) return `${option.label} - ${schools[option.label]}`;
    }
    return option.label;
  }

  function ribbonSelectOnly(d, id, options){
    // Offer the current Crisis Service period as a simple checkbox. A saved later-period award
    // still gets the full dropdown, preserving its value and devices without changing award rules.
    const sel = d.State.ribbonSelections[id] || {};
    const current = sel.checked ? d.ribbonSelectionOption(id, sel.awardValue) : null;
    return options.length === 1 || (id === 'crisis_ribbon' && (!current || current.value === options[0]?.value));
  }

  // What a tap does: the ribbon on at its first choice (its basic award, or "earned") or off, the page's rules after it (the shared slot, the exclusions, the three JROTC / ROTC
  // ribbons at most, which refuses a fourth with the reason). Returns whether the ribbon is on afterwards.
  function selectRibbon(id, on, deps){
    const d = withDeps(deps);
    d.normalizeRibbons();
    d.setRibbon(id, on ? (d.isRotc(id) ? 'earned' : d.firstOption(id)) : '');
    return chosenRibbon(d, id);
  }

  // The line a ribbon that is on prints under its tile: what was selected and the devices it wears; the counting rule is in its title.
  function pickedText(d, id, military){
    const sel = d.State.ribbonSelections[id] || {};
    const devices = military
      ? Object.entries(sel.devices || {}).filter(([, qty]) => Number(qty) > 0).map(([deviceId, qty]) => `${d.deviceLabel(deviceId) || deviceId}: ${Number(qty)}`).join(' • ')
      : d.describeRibbon(id, sel);
    const warnings = sel.deviceWarnings && sel.deviceWarnings.length ? ` • ${sel.deviceWarnings.join(' ')}` : '';
    return { label: sel.awardLabel || 'Earned', rest: `${devices ? ` • ${devices}` : ''}${warnings}` };
  }

  // Compact selection controls are always visible. Under a selected U.S. military ribbon, keep the service and the devices a
  // military award allows (a button each, pressed when worn; the member's own numeral when devices are chosen by hand), then what was selected and the miniature medal where the
  // uniform wears them. `after()` redraws the lists once something changed.
  function ribbonControls(d, id, military, after){
    const sel = d.State.ribbonSelections[id] || {};
    const box = el('div', 'vpControlStack');
    const options = d.ribbonOptions(id).filter(opt => opt && opt.value);
    if(ribbonSelectOnly(d, id, options)){
      const label = el('label', 'ribbonSelectLabel');
      const input = el('input', 'ribbonSelect');
      input.setAttribute('type', 'checkbox');
      input.setAttribute('aria-label', `Select ${d.ribbonName(id)}`);
      input.checked = !!sel.checked;
      input.addEventListener('change', () => { selectRibbon(id, input.checked, d); after(); });
      label.append(input, ' Select');
      box.append(label);
    }else if(options.length > 1){
      const label = el('label', 'ribbonAwardLabel', 'Award / level ');
      const select = el('select', 'ribbonAwardSelect');
      select.setAttribute('aria-label', `${d.ribbonName(id)} award / level`);
      select.setAttribute('title', military ? '' : d.ribbonHint(id));
      const empty = el('option', null, '- Select -');
      empty.value = '';
      select.append(empty);
      for(const option of options){
        const item = el('option', null, ribbonOptionLabel(id, option));
        item.value = option.value;
        select.append(item);
      }
      const current = sel.checked ? d.ribbonSelectionOption(id, sel.awardValue) : null;
      select.value = current?.value || '';
      select.addEventListener('change', () => { d.setRibbon(id, select.value); after(); });
      label.append(select);
      box.append(label);
    }
    if(!sel.checked) return box;
    const hint = military ? '' : d.ribbonHint(id);
    const ui = military ? d.ui() : null;
    const award = military ? d.militaryAward(id) : null;
    const redo = () => { d.setRibbon(id, sel.awardValue || `military_award_${sel.awardCount || 1}`); };
    // Service and special-device pictures keep using the existing military device calculation.
    const art = d.ribbonArt(id) ? d.asset(d.ribbonArt(id)) : undefined;
    const services = military && award ? (award.authorizedServices || []) : [];
    // More than one service wears the award: a tile for each, the ribbon as that service wears it at the count chosen. One service is no choice and is not offered.
    if(services.length > 1){
      const now = d.militaryService(id, sel);
      box.append(pictureRow(d, {
        name: `militaryService-${id}`, label: 'Awarding / wearer service', value: now, pictureHeight: '30px',
        options: services.map(service => ({ value: service, label: d.branchLabels()[service] || String(service).replaceAll('_', ' '), picture: art,
          draw: img => d.drawRibbon(img, id, Object.assign({}, sel, { militaryService: service, devices: d.militaryDevices(id, sel, { service }) })) })),
        onChange: service => {
          const current = d.State.ribbonSelections[id] || { checked: false, devices: {} };
          current.militaryService = service;
          d.State.ribbonSelections[id] = current;
          if(current.checked) d.setRibbon(id, current.awardValue || `military_award_${current.awardCount || 1}`);
          after();
        }
      }).host);
    }
    if(military){
      const rules = d.militaryRules(award, d.militaryService(id, sel), ui.advancedMode);
      const advanced = !!ui.advancedMode;
      const specials = advanced
        ? [...new Set([...((rules && rules.allowedSpecialDevices) || []), 'V_DEVICE', 'C_DEVICE', 'R_DEVICE', 'ARROWHEAD_DEVICE', 'M_DEVICE', 'BRONZE_HOURGLASS', 'SILVER_HOURGLASS', 'GOLD_HOURGLASS'])]
        : ((rules && rules.allowedSpecialDevices) || []);
      if(specials.length || advanced){
        const wrap = el('div', 'militarySpecialDeviceRow');
        wrap.setAttribute('title', 'Select only devices authorized on your award orders.');
        const chosen = specials.filter(deviceId => (sel.specialAuthorizations || []).includes(deviceId));
        // The devices the award allows: a tile for each, the ribbon with that device on it (the devices chosen already stay), any number on.
        if(specials.length){
          wrap.append(pictureRow(d, {
            name: `militaryDevices-${id}`, label: 'Devices', toggle: true, values: chosen, pictureHeight: '30px',
            options: specials.map(deviceId => ({ value: deviceId, label: d.deviceLabel(deviceId) || deviceId.replaceAll('_', ' '), picture: art,
              draw: img => d.drawRibbon(img, id, Object.assign({}, sel, { devices: d.militaryDevices(id, sel, { specials: [...new Set([...(sel.specialAuthorizations || []), deviceId])] }) })) })),
            onToggle: (deviceId, on) => {
              const current = d.State.ribbonSelections[id] || { checked: false, devices: {} };
              const set = new Set(current.specialAuthorizations || []);
              if(on) set.add(deviceId); else set.delete(deviceId);
              current.specialAuthorizations = [...set];
              d.State.ribbonSelections[id] = current;
              if(current.checked) d.setRibbon(id, current.awardValue || `military_award_${current.awardCount || 1}`);
              after();
            }
          }).host);
        }
        if(advanced){
          const label = el('label', null, 'Numeral ');
          const input = el('input', 'militaryNumeralDevice');
          input.setAttribute('type', 'number');
          input.setAttribute('min', '0');
          input.setAttribute('max', '99');
          input.setAttribute('title', '0 means no numeral');
          input.value = String(Number(sel.manualNumeral) || 0);
          input.dataset.ribbonId = id;
          input.addEventListener('change', () => {
            const current = d.State.ribbonSelections[id] || { checked: false, devices: {} };
            current.manualNumeral = Math.min(99, Math.max(0, Math.trunc(Number(input.value) || 0)));
            d.State.ribbonSelections[id] = current;
            if(current.checked) redo();
            after();
          });
          label.append(input);
          wrap.append(label);
        }
        box.append(wrap);
      }
    }
    const picked = pickedText(d, id, military);
    const line = el('div', 'sub ribbonDeviceSummary');
    line.append('Selected: ');
    line.append(el('b', null, picked.label));
    line.append(picked.rest);
    const title = [`Selected: ${picked.label}${picked.rest}`, hint].filter(Boolean).join(' • ');
    line.setAttribute('title', title);
    box.append(line);
    const mini = d.miniMedal(id);
    if(mini === 'yes'){
      const preview = el('div', 'miniMedalPreview');
      preview.append(el('span', null, 'Miniature medal'));
      const art = el('span', 'miniMedalArt');
      art.setAttribute('role', 'img');
      art.setAttribute('aria-label', `${d.ribbonName(id)} miniature medal`);
      preview.append(art);
      box.append(preview);
      d.drawMini(art, id, sel);
    }else if(mini === 'missing'){
      const preview = el('div', 'miniMedalPreview missing');
      preview.append(el('span', null, 'No miniature medal asset'));
      box.append(preview);
    }
    return box;
  }

  // One list of ribbon tiles. spec: { name, ids(): the ribbons shown, in order of precedence; groups(): [{ key, note, ids }] where they are under headings; military: the tiles are
  // U.S. military ribbons; caption(id): the line under the name; search(id): more words the search reads }. Every change redraws all the lists of the window (`after`).
  function ribbonPicker(container, spec, d, after){
    const military = !!spec.military;
    const shown = () => spec.ids();
    const on = () => shown().filter(id => chosenRibbon(d, id));
    const option = (id, group, note) => ({
      value: id, label: d.ribbonName(id), picture: d.ribbonArt(id) ? d.asset(d.ribbonArt(id)) : undefined,
      caption: spec.caption ? spec.caption(id) : undefined, group, groupNote: note, search: spec.search ? spec.search(id) : (group || ''),
      controls: () => ribbonControls(d, id, military, after)
    });
    const options = () => spec.groups
      ? spec.groups().flatMap(g => g.ids.map(id => option(id, g.key, g.note)))
      : shown().map(id => option(id));
    const host = el('div');
    container.append(host);
    const picker = d.VisualPicker.render(host, {
      name: spec.name, ariaLabel: spec.ariaLabel, mode: 'toggle', size: 'large', shape: 'wide', options: options(), values: on(),
      onToggle: (id, wantOn) => { selectRibbon(id, wantOn, d); after(); }
    });
    // The drawn ribbon, devices and all, in place of the plain picture of a ribbon that is on; a picture that fails to load falls back to the ribbon's plain one.
    const draw = () => {
      for(const cell of picker.el.querySelectorAll('.vpCell')){
        if(cell.closest('.vpControls')) continue;   // a tile of a row under a ribbon (its devices) is not a ribbon's tile
        const id = cell.dataset.value;
        const img = cell.querySelector('img');
        if(!img) continue;
        if(chosenRibbon(d, id)) d.drawRibbon(img, id, d.State.ribbonSelections[id]);
        else d.fallback(img, id);
      }
    };
    const entry = {
      picker, spec,
      ids: shown,
      // Every tile as the state says, the controls and the drawn ribbons again; a field the member was in keeps the focus.
      refresh(){
        keepingFocus(picker.el, () => { picker.setValues(on()); picker.setOptions(options()); draw(); });
      }
    };
    draw();
    return entry;
  }

  // The window's lists of ribbons: the CAP ribbons in the order of precedence under their headings, the JROTC / ROTC menu, and the U.S. military ribbons by branch. Returns the
  // entries, each with a `picker` whose filter(text) the window's search reads.
  function ribbonLists(container, deps){
    const d = withDeps(deps);
    d.normalizeRibbons();
    const worn = d.ribbonIds();
    const rotcIds = worn.filter(id => d.isRotc(id));
    const capIds = worn.filter(id => !d.isRotc(id));
    const entries = [];
    const refreshAll = () => entries.forEach(entry => entry.refresh());
    const own = entry => { entries.push(entry); return entry; };

    own(ribbonPicker(container, {
      name: 'ribbons', ariaLabel: 'Ribbons', ids: () => capIds,
      groups: () => d.ribbonGroups(capIds).map(group => ({ key: group.label, note: group.note || '', ids: group.ids }))
    }, d, refreshAll));
    if(rotcIds.length) own(rotcMenu(container, rotcIds, d, refreshAll));
    if(!d.militaryWorn()){
      const note = el('div', 'hintText', 'U.S. military, JROTC and ROTC awards are not worn on Corporate-style uniforms (CAPR 39-1, 11.1.6, 11.2.5).');
      container.append(note);
    }else{
      own(militaryMenu(container, d, refreshAll));
    }
    return entries;
  }

  // Whether the menu named `key` is open (the member's choice, kept in the page's state), and keeping it when the member opens or closes it.
  function rememberOpen(d, details, key){
    const ui = d.ui();
    details.dataset.militarySection = key;
    details.open = (ui.expandedSections || []).includes(key);
    details.addEventListener('toggle', () => {
      const current = new Set(d.ui().expandedSections || []);
      if(details.open) current.add(key); else current.delete(key);
      d.ui().expandedSections = [...current];
    });
  }

  // The JROTC / ROTC ribbons: a menu whose tiles are under a heading for each program (so the program is the picture list, no drop-down), a search to narrow them, the ones chosen kept in
  // sight whatever the search says; three at most.
  function rotcMenu(container, ids, d, refreshAll){
    const ui = d.ui();
    const rotc = d.rotc();
    if(typeof ui.rotcSearch !== 'string') ui.rotcSearch = '';
    const menu = el('details', 'militaryRibbonMenu rotcRibbonMenu');
    rememberOpen(d, menu, 'rotc-root');
    const summary = el('summary');
    menu.append(summary);
    menu.append(el('div', 'sub', `Worn after the CAP ribbons, at most ${rotc.limit} in all, only while enrolled in the program (CAPR 39-1, ${rotc.ref}). Find the ribbon under its program.`));
    const filters = el('div', 'militaryRibbonCatalogFilters rotcRibbonCatalogFilters');
    const search = el('input', 'rotcRibbonSearch');
    search.setAttribute('type', 'search');
    search.setAttribute('placeholder', 'Search JROTC / ROTC ribbons');
    search.setAttribute('aria-label', 'Search JROTC and ROTC ribbons');
    search.value = ui.rotcSearch;
    filters.append(search);
    menu.append(filters);
    const status = el('div', 'sub rotcRibbonStatus');
    status.setAttribute('role', 'status');
    menu.append(status);
    const chosen = () => ids.filter(id => chosenRibbon(d, id));
    const narrowed = () => {
      const q = String(ui.rotcSearch || '').trim().toLowerCase();
      return ids.filter(id => {
        if(chosenRibbon(d, id)) return true;
        const r = rotc.get(id);
        return r && (!q || r.name.toLowerCase().includes(q));
      });
    };
    const words = () => {
      const n = chosen().length;
      summary.textContent = `JROTC / ROTC ribbons, ${n} of ${rotc.limit} chosen`;
      status.textContent = n >= rotc.limit ? `${n} of ${rotc.limit} chosen. ${d.rotcLimitMessage()}`
        : n ? `${n} of ${rotc.limit} chosen.` : 'None chosen.';
    };
    const entry = ribbonPicker(menu, {
      name: 'rotcRibbons', ariaLabel: 'JROTC and ROTC ribbons', ids: narrowed, military: false,
      groups: () => rotc.services.map(service => ({ key: service.label, note: '', ids: narrowed().filter(id => (rotc.get(id) || {}).service === service.key) })).filter(g => g.ids.length)
    }, d, () => { refreshAll(); });
    const refresh = entry.refresh;
    entry.refresh = () => { refresh(); words(); };
    search.addEventListener('input', () => { ui.rotcSearch = search.value; entry.refresh(); });
    words();
    container.append(menu);
    return entry;
  }

  // The U.S. military ribbons: a menu with a search, a service and a type to narrow them, the devices chosen by hand where the member says so, and a menu for each branch whose
  // tiles are made when it is opened.
  function militaryMenu(container, d, refreshAll){
    const ui = d.ui();
    const order = d.branchOrder(), labels = d.branchLabels();
    const all = d.militaryIds();
    const matches = () => {
      const q = String(ui.gallerySearchValue || '').trim().toLowerCase();
      return all.filter(id => {
        const award = d.militaryAward(id);
        const services = ((award && award.authorizedServices) || []).map(service => String(service).toUpperCase());
        const branch = d.militaryBranchOf(award);
        const serviceMatch = ui.galleryServiceFilter === 'ALL' || branch === ui.galleryServiceFilter || services.includes(ui.galleryServiceFilter);
        const typeMatch = ui.galleryAwardTypeFilter === 'ALL' || d.militaryType(award) === ui.galleryAwardTypeFilter;
        const haystack = [award && award.name, award && award.officialName, ...((award && award.aliases) || []), award && award.id, ...services, d.militaryType(award)].join(' ').toLowerCase();
        return serviceMatch && typeMatch && (!q || haystack.includes(q));
      });
    };
    const menu = el('details', 'militaryRibbonMenu');
    rememberOpen(d, menu, 'military-root');
    const summary = el('summary');
    menu.append(summary);
    const intro = el('div', 'sub', 'Shared awards appear once under Joint / multi-service. Each award offers the devices its own rule allows. ');
    const advanced = el('button', 'ghost vpSwitch militaryAdvancedMode', 'Choose devices by hand');
    advanced.setAttribute('type', 'button');
    advanced.setAttribute('aria-pressed', String(!!ui.advancedMode));
    intro.append(advanced);
    menu.append(intro);
    const filters = el('div', 'militaryRibbonCatalogFilters');
    const search = el('input', 'militaryRibbonCatalogSearch');
    search.setAttribute('type', 'search');
    search.setAttribute('placeholder', 'Search military ribbons');
    search.setAttribute('aria-label', 'Search military ribbons');
    search.value = ui.gallerySearchValue || '';
    const service = el('select', 'militaryRibbonCatalogService');
    service.setAttribute('aria-label', 'Filter military ribbons by service');
    const anyService = el('option', null, 'All services'); anyService.value = 'ALL'; service.append(anyService);
    for(const branch of order){ const o = el('option', null, labels[branch]); o.value = branch; service.append(o); }
    service.value = ui.galleryServiceFilter || 'ALL';
    const type = el('select', 'militaryRibbonCatalogType');
    type.setAttribute('aria-label', 'Filter military ribbons by type');
    const anyType = el('option', null, 'All award types'); anyType.value = 'ALL'; type.append(anyType);
    for(const [value, label] of [['DECORATIONS', 'Decorations'], ['UNIT_AWARD', 'Unit awards'], ['CAMPAIGN_EXPEDITIONARY', 'Campaign / expeditionary'], ['SERVICE', 'Service awards'], ['TRAINING', 'Training'], ['FOREIGN', 'Foreign'], ['OTHER', 'Other']]){
      const o = el('option', null, label); o.value = value; type.append(o);
    }
    type.value = ui.galleryAwardTypeFilter || 'ALL';
    filters.append(search, service, type);
    menu.append(filters);
    const result = el('div', 'sub militaryRibbonCatalogSummary');
    menu.append(result);

    const entries = [];   // the branch lists made so far
    const branches = order.map(branch => {
      const details = el('details', 'militaryBranchMenu');
      const key = `military-branch-${branch}`;
      rememberOpen(d, details, key);
      const title = el('summary');
      details.append(title);
      const body = el('div', 'militaryBranchGrid');
      details.append(body);
      return { branch, key, details, title, body, entry: null };
    });
    const idsOf = b => matches().filter(id => d.militaryBranchOf(d.militaryAward(id)) === b.branch);
    const fill = b => {
      const ids = idsOf(b);
      const filtering = !!String(ui.gallerySearchValue || '').trim() || ui.galleryServiceFilter !== 'ALL' || ui.galleryAwardTypeFilter !== 'ALL';
      b.title.textContent = `${labels[b.branch]} (${ids.length})`;
      if(filtering && ids.length) b.details.open = true;
      b.body.replaceChildren();
      b.entry = null;
      if(!b.details.open){
        b.body.append(el('div', 'sub', 'Open this branch to load its ribbon controls.'));
      }else if(!ids.length){
        b.body.append(el('div', 'sub', `No ${labels[b.branch]}-only ribbon is in the catalog; shared awards are listed once under Joint / multi-service.`));
      }else{
        b.entry = ribbonPicker(b.body, {
          name: `militaryRibbons-${b.branch}`, ariaLabel: `${labels[b.branch] || String(b.branch).replaceAll('_', ' ')} ribbons`, military: true, ids: () => idsOf(b),
          caption: id => ((d.militaryAward(id) && d.militaryAward(id).authorizedServices) || []).map(s => labels[s] || String(s).replaceAll('_', ' ')).join(' / ') || 'U.S. military',
          search: id => { const award = d.militaryAward(id); return [award && award.name, award && award.officialName, ...((award && award.aliases) || [])].filter(Boolean).join(' '); }
        }, d, refreshAll);
      }
    };
    const words = () => {
      const ids = matches();
      summary.textContent = `U.S. military ribbons (${ids.length} unique awards)`;
      result.textContent = `${ids.length} of ${all.length} unique military awards shown.`;
    };
    const redraw = () => { words(); branches.forEach(fill); };
    search.addEventListener('input', () => { ui.gallerySearchValue = search.value; redraw(); });
    service.addEventListener('change', () => { ui.galleryServiceFilter = service.value || 'ALL'; redraw(); });
    type.addEventListener('change', () => { ui.galleryAwardTypeFilter = type.value || 'ALL'; redraw(); });
    advanced.addEventListener('click', () => {
      ui.advancedMode = !ui.advancedMode;
      advanced.setAttribute('aria-pressed', String(!!ui.advancedMode));
      refreshAll();
    });
    for(const b of branches){
      b.details.addEventListener('toggle', () => { if(b.details.open && !b.entry) fill(b); });
      menu.append(b.details);
    }
    redraw();
    container.append(menu);
    // The window's search and redraws reach the lists made so far.
    return {
      picker: { filter: text => branches.reduce((n, b) => n + (b.entry ? b.entry.picker.filter(text) : 0), 0) },
      refresh(){ branches.forEach(b => { if(b.entry) b.entry.refresh(); }); words(); },
      branches
    };
  }

  return { badgeList, militaryBadgeList, badgeNote, selectBadge, setBadgeLevel, setGraduated, patchList, selectPatch, selectRibbon, ribbonLists, ribbonPicker, pictureRow, pageDeps };
});
