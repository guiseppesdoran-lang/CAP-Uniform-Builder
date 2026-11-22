// The lists the chooser window offers (badges, ribbons, patches) as picture tiles of the picture picker (js/visual-picker.js, toggle mode): the item's own drawing, its name under
// it, a tap turns it on or off and the tile shows it. No checkbox and no radio button is in them. What an item needs besides on and off (the level of a badge, its Graduated commander
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
       getRibbonDisplayName, getRibbonImagePath, getRibbonAwardOptions, getRibbonControls, setGoddardFact, capubFirstRibbonOptionValue, setRibbonSelectionFromDropdown, normalizeRibbonSelections, CAPUBRibbonAwards,
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
      // The bars a badge carries at a level ([key, label, letter]) and the drawing of the badge with only that bar (the picture of its switch).
      hasBars: id => typeof CAPUBBadgeCatalog !== 'undefined' && !!(CAPUBBadgeCatalog.BADGES[id] && CAPUBBadgeCatalog.BADGES[id].bars),
      bars: (id, level) => typeof CAPUBBadgeCatalog !== 'undefined' && CAPUBBadgeCatalog.bars ? CAPUBBadgeCatalog.bars(id, level) : null,
      barArt: (id, key) => { const art = CAPUBBadgeCatalog.barArt(id, [key]); return (art && window.CAPUBAssetIndex && CAPUBAssetIndex[art]) || ''; },
      // The drawing of a badge at a level (the path the page loads it from), for the tile of that level.
      levelArt: (id, level) => { const art = CAPUBBadgeCatalog.art(id, 'dress', level, State.badgeSelections && State.badgeSelections[id] && State.badgeSelections[id].bars); return (art && window.CAPUBAssetIndex && CAPUBAssetIndex[art]) || ''; },
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
      ribbonControls: id => getRibbonControls(id),
      setGoddard: (key, on) => setGoddardFact(key, on),
      deviceSrc: deviceId => (deviceMeta[deviceId] && deviceMeta[deviceId].src) || '',
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

  // The picture on a switch (a device, a bar): a box with the drawing as its background, fitted whole inside the box's padding and centred, so nothing of it can fall outside the
  // device or touch the box's edge whatever a browser does with a drawing whose size is in inches (an <img> fitted with object-fit can show a hairline beside the star).
  const deviceArt = src => {
    const art = el('span', 'ribbonToggleArt');
    art.setAttribute('aria-hidden', 'true');
    art.dataset.src = src;
    art.style.backgroundImage = `url("${String(src).replace(/["\\\n\r]/g, encodeURIComponent)}")`;
    return art;
  };

  // One native dropdown laid, invisible, over a box that shows the short form of the line chosen ("5 years", "6th", "Advanced"): the open list has the full lines, the closed control is
  // never cut. The dropdown itself takes the tap, so a phone shows its own list; it is 16 px on a touch screen so that Safari does not zoom. cfg: { className (of the select), label (its
  // aria-label), lines: [{ value, text, short, enabled }], selected, title, onChange(value) }. A line that is not `enabled` is greyed unless it is the one chosen.
  function dropdown(cfg){
    const wrap = el('div', 'ribbonSelectWrap');
    const shown = el('span', 'ribbonSelectShown');
    shown.setAttribute('aria-hidden', 'true');
    const select = el('select', cfg.className);
    select.setAttribute('aria-label', cfg.label);
    for(const line of cfg.lines){
      const o = el('option', null, line.text);
      o.value = line.value;
      if(line.enabled === false && line.value !== cfg.selected) o.setAttribute('disabled', '');
      select.append(o);
    }
    select.value = cfg.selected;
    if(cfg.title) select.setAttribute('title', cfg.title);
    const show = value => { const line = cfg.lines.find(l => l.value === value); shown.textContent = line ? (line.short != null ? line.short : line.text) : ''; };
    show(cfg.selected);
    select.addEventListener('change', () => { show(select.value); cfg.onChange(select.value); });
    wrap.append(shown, select);
    return wrap;
  }

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
  // A badge or patch that is chosen and that the drawing leaves off: its tile carries the not-worn mark in the tick's place (the picture is never dimmed).
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
  // The groups a Distinguished Expert was earned in: a bar for each one on (kept in the member's selection whatever the level, so they are there when the level comes back).
  function setBadgeBar(id, key, on, deps){
    const d = withDeps(deps);
    const s = sel(d, id);
    const keys = new Set(s.bars || []);
    if(on) keys.add(key); else keys.delete(key);
    s.bars = [...keys];
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

  // The command pin worn each way: one switch, Graduated commander (the pin under the name tag), off for a current commander (over it). It is offered only where the engine draws the
  // uniform both ways (the flight suit has no graduated pin): the pictures are made as the page is free to, and a way the uniform does not draw is the answer, not a picture shown.
  function commandRow(d, id, deps, again){
    const host = el('div', 'vpCommandWorn');
    host.hidden = true;
    const made = d.commandPictures ? d.commandPictures(['current', 'graduated']) : null;
    const paint = known => {
      host.textContent = '';
      if(['current', 'graduated'].some(v => known[v] === false)){ host.hidden = true; return; }
      const row = el('div', 'ribbonControlRow');
      const b = el('button', 'ribbonToggle');
      b.setAttribute('type', 'button');
      b.setAttribute('aria-pressed', graduatedNow(d) ? 'true' : 'false');
      b.dataset.value = 'graduated';
      b.append(el('span', null, 'Graduated commander'));
      b.addEventListener('click', () => { setGraduated(id, !graduatedNow(d), deps); again(); });
      row.append(b);
      host.append(row);
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
      // The level of a badge earned in levels: one dropdown, a line for each level (the closed control shows the name alone, the open list has the paragraph in brackets too). The tile's
      // own picture is the badge at the level chosen.
      if(levels){
        const row = el('div', 'ribbonControlRow');
        row.append(dropdown({
          className: 'badgeLevelSelect', label: `Level of the ${d.name(id)}`, selected: d.level(id, sel(d, id).level),
          lines: levels.map(([key, text]) => ({ value: key, text, short: shortLevel(text) })),
          onChange: key => { setBadgeLevel(id, key, deps); entry.setOptions(); }
        }));
        box.append(row);
      }
      // The bars of a Distinguished Expert: one small switch for each group it was earned in, none on at first, under the level row only at that level.
      const own = d.State.badgeSelections[id] || {};
      const barList = d.bars ? d.bars(id, own.level) : null;
      if(barList){
        const row = el('div', 'ribbonControlRow vpBarRow');
        row.setAttribute('role', 'group');
        row.setAttribute('aria-label', `Groups the ${d.name(id)} was earned in`);
        for(const [key, label] of barList){
          const on = (own.bars || []).includes(key);
          const b = el('button', 'ribbonToggle');
          b.setAttribute('type', 'button');
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
          b.dataset.value = key;
          const src = d.barArt ? d.barArt(id, key) : '';
          if(src) b.append(deviceArt(d.asset(src)));
          b.append(el('span', null, label));
          b.addEventListener('click', () => { setBadgeBar(id, key, !on, deps); entry.setOptions(); });
          row.append(b);
        }
        box.append(row);
      }
      if(d.isCommand(id)) box.append(commandRow(d, id, deps, () => entry.setOptions()));
      return box.childNodes.length ? box : null;
    };
    // The controls of a badge that has levels are made for every tile and shown while it is on; a command pin's are made only while it is on (the pin as drawn depends on which pin is held),
    // so the list is made again when the pin held changes.
    const pinsOn = () => ids.filter(id => d.isCommand(id) && d.State.badgeSelections[id] && d.State.badgeSelections[id].checked).join();
    // What a tile's controls were made from: a badge's level (and the bars at the level that has them), so the dropdown shows the level the state has; a command pin's switch depends on the pin held and on how it is worn.
    const controlsKeyOf = id => d.isCommand(id) ? `pin:${pinsOn()}:${graduatedNow(d)}` : `levels:${(d.State.badgeSelections[id] || {}).level || ''}:${((d.State.badgeSelections[id] || {}).bars || []).join()}`;
    let built = '';
    const options = () => { built = pinsOn(); const rows = d.badgeRows(), on = new Set(selectedIn(d, ids)); return groups.flatMap(g => g.ids.map(id => ({ value: id, label: d.name(id), picture: d.asset(d.artPath(id)), notWorn: leftOff(rows, id, d.name(id), on.has(id)), group: g.key, search: g.key, controls: isOn => !d.isCommand(id) || isOn ? controls(id) : null, controlsKey: controlsKeyOf(id) }))); };
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
      value: badge.id, label: nameOf(badge), picture: pictureOf(badge), notWorn: leftOff(rows, badge.id, nameOf(badge), on.has(badge.id)), search: `${branch} ${badge.family || ''}`, controlsKey: `variants:${variantOf(badge).variants.map(v => v.id).join()}:${variantOf(badge).active}`,
      controls: () => {
        const { variants, active } = variantOf(badge);
        if(variants.length < 2) return null;
        // The level or variant of the badge: one dropdown, a line for each; the tile's own picture is the badge at the one chosen.
        const row = el('div', 'ribbonControlRow');
        row.append(dropdown({
          className: 'badgeLevelSelect', label: `Level of the ${badge.officialName || badge.id}`, selected: active,
          lines: variants.map(v => ({ value: v.id, text: v.id.replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase()) })),
          onChange: variant => {
            if(!d.State.militaryBadges) d.State.militaryBadges = {};
            d.State.militaryBadges[badge.id] = { selected: true, variant };
            d.fullRender();
            again();
          }
        }));
        return row;
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
    // A patch chosen that the drawing leaves off carries the not-worn mark; a tap on a tile says in the window's status line where the patch is worn, or why it is left off.
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
          value: id, label: words.title, picture: meta.img ? d.asset(meta.img) : undefined, notWorn: leftOffPatch(id), controlsKey: `places:${words.places.map(place => place.slot).join()}`,
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
      // The drawing has been made again: a patch it left off carries the not-worn mark, and the last tap says where the patch is worn or why it is not.
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
    const all = (node, sel) => Array.from(node.querySelectorAll(sel)); // a NodeList has no find
    const again = all(root, '.vpCell').find(c => c.dataset.value === keep.value);
    const rowAgain = again && keep.row ? all(again, '.vp').find(v => v.dataset.name === keep.row) : null;
    const target = rowAgain
      ? all(rowAgain, '.vpOption').find(n => n.dataset.value === keep.option)
      : again && all(again, '.' + keep.className).find(n => n !== again.querySelector('.vpOption') && (!keep.option || (n.dataset && n.dataset.value === keep.option)));
    if(target && target.focus) target.focus();
  }

  // ---- ribbons ------------------------------------------------------------------------------------------------------------------------------

  const chosenRibbon = (d, id) => !!(d.State.ribbonSelections[id] && d.State.ribbonSelections[id].checked);

  // What a tap does: the ribbon on at its first choice (its basic award, or "earned") or off, the page's rules after it (the shared slot, the exclusions, the three JROTC / ROTC
  // ribbons at most, which refuses a fourth with the reason). Returns whether the ribbon is on afterwards.
  function selectRibbon(id, on, deps){
    const d = withDeps(deps);
    d.normalizeRibbons();
    d.setRibbon(id, on ? (d.isRotc(id) ? 'earned' : d.firstOption(id)) : '');
    return chosenRibbon(d, id);
  }

  // The controls under the tile of a ribbon that is on, in one row that wraps: for a U.S. military ribbon the service (one dropdown), for a ribbon that can be earned more than once one
  // dropdown for how many awards (the device in words, from the rule that draws it), then one small switch for each separate fact (the honor credit, the Cadet Officer School star, the
  // devices a military award allows), the numeral where devices are chosen by hand, and the miniature medal where the uniform wears them. A ribbon with nothing to choose has no
  // controls. `after()` redraws the lists once something changed.
  function ribbonControls(d, id, military, after){
    const sel = d.State.ribbonSelections[id] || {};
    const model = d.ribbonControls(id);
    const hint = military ? '' : d.ribbonHint(id);
    const ui = military ? d.ui() : null;
    const award = military ? d.militaryAward(id) : null;
    const redo = () => { d.setRibbon(id, sel.awardValue || `military_award_${sel.awardCount || 1}`); };
    const row = el('div', 'ribbonControlRow');
    const services = military && award ? (award.authorizedServices || []) : [];
    // The service that wears the award: one dropdown where more than one does (one service is no choice and is not offered).
    if(services.length > 1){
      const now = d.militaryService(id, sel);
      const select = el('select', 'ribbonServiceSelect');
      select.setAttribute('aria-label', 'Awarding or wearer service');
      for(const service of services){
        const o = el('option', null, d.branchLabels()[service] || String(service).replaceAll('_', ' '));
        o.value = service;
        select.append(o);
      }
      select.value = now;
      select.addEventListener('change', () => {
        const current = d.State.ribbonSelections[id] || { checked: false, devices: {} };
        current.militaryService = select.value;
        d.State.ribbonSelections[id] = current;
        if(current.checked) d.setRibbon(id, current.awardValue || `military_award_${current.awardCount || 1}`);
        after();
      });
      row.append(select);
    }
    // How many awards (or which level): one dropdown, a line for each count. Where a line has no option with the facts that are on, it is greyed and the fact is turned off first.
    if(model.lines.length > 1){
      row.append(dropdown({
        className: 'ribbonCountSelect', label: model.label, title: hint, selected: model.selected,
        lines: model.lines.map(line => ({ value: line.value, text: line.text, short: line.short, enabled: line.enabled })),
        onChange: value => { d.setRibbon(id, value); after(); }
      }));
    }
    // One switch for each separate fact: a small picture of the device and its name, pressed or not.
    const toggle = (key, label, src, on, enabled, title, press) => {
      const b = el('button', 'ribbonToggle');
      b.setAttribute('type', 'button');
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.dataset.value = key;
      if(title) b.setAttribute('title', title);
      if(!enabled) b.setAttribute('disabled', '');
      if(src) b.append(deviceArt(src));
      b.append(el('span', null, label));
      b.addEventListener('click', press);
      row.append(b);
    };
    for(const t of model.toggles){
      toggle(t.key, t.label, d.asset(`devices/${t.device}.svg`), t.on, !!t.next, t.title, () => { if(id === 'goddard_achievement'){ d.setGoddard(t.key, !t.on); after(); } else if(t.next){ d.setRibbon(id, t.next); after(); } });
    }
    if(military){
      const rules = d.militaryRules(award, d.militaryService(id, sel), ui.advancedMode);
      const advanced = !!ui.advancedMode;
      const specials = advanced
        ? [...new Set([...((rules && rules.allowedSpecialDevices) || []), 'V_DEVICE', 'C_DEVICE', 'R_DEVICE', 'ARROWHEAD_DEVICE', 'M_DEVICE', 'BRONZE_HOURGLASS', 'SILVER_HOURGLASS', 'GOLD_HOURGLASS'])]
        : ((rules && rules.allowedSpecialDevices) || []);
      // The devices the award allows, any number on (select only those on the award orders).
      for(const deviceId of specials){
        const on = (sel.specialAuthorizations || []).includes(deviceId);
        toggle(deviceId, d.deviceLabel(deviceId) || deviceId.replaceAll('_', ' '), d.asset(d.deviceSrc(deviceId)), on, true, 'Select only devices authorized on your award orders.', () => {
          const current = d.State.ribbonSelections[id] || { checked: false, devices: {} };
          const set = new Set(current.specialAuthorizations || []);
          if(on) set.delete(deviceId); else set.add(deviceId);
          current.specialAuthorizations = [...set];
          d.State.ribbonSelections[id] = current;
          if(current.checked) d.setRibbon(id, current.awardValue || `military_award_${current.awardCount || 1}`);
          after();
        });
      }
      if(advanced){
        const label = el('label', 'ribbonNumeral', 'Numeral ');
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
        row.append(label);
      }
    }
    const box = el('div', 'vpControlStack');
    if(row.children && row.children.length) box.append(row);
    if(sel.deviceWarnings && sel.deviceWarnings.length) box.append(el('div', 'sub ribbonDeviceSummary', sel.deviceWarnings.join(' ')));
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
    return box.children && box.children.length ? box : null;
  }

  // What the controls of a ribbon were made from: they are made again only when one of these changes, so a dropdown that is open keeps its place and the list stays as it is.
  function ribbonControlsKey(d, id, military){
    const sel = d.State.ribbonSelections[id] || {};
    if(!chosenRibbon(d, id)) return 'off';
    return [sel.awardValue, sel.militaryService, (sel.specialAuthorizations || []).join(','), sel.manualNumeral, military && d.ui().advancedMode ? 'adv' : '', (sel.deviceWarnings || []).join(' '),
      d.State.membership, d.State.uniform, d.miniMedal(id)].join('|');
  }

  // One list of ribbon tiles. spec: { name, ids(): the ribbons shown, in order of precedence; groups(): [{ key, note, ids }] where they are under headings; military: the tiles are
  // U.S. military ribbons; caption(id): the line under the name; search(id): more words the search reads }. Every change redraws all the lists of the window (`after`).
  function ribbonPicker(container, spec, d, after){
    const military = !!spec.military;
    const shown = () => spec.ids();
    const on = () => shown().filter(id => chosenRibbon(d, id));
    // The record of a ribbon is made for all of them (a window holds 170) at every change, and the picker reads only some fields of most of them (the name, the words the search
    // reads and what the controls were made from are read when its tile is made, when a search is typed or when the list is refreshed): those are worked out on first read.
    const lazy = (o, key, make) => Object.defineProperty(o, key, {
      enumerable: true, configurable: true,
      get(){ const v = make(); Object.defineProperty(o, key, { value: v, enumerable: true, writable: true, configurable: true }); return v; },
      set(v){ Object.defineProperty(o, key, { value: v, enumerable: true, writable: true, configurable: true }); }
    });
    const option = (id, group, note) => {
      const o = {
        value: id, picture: d.ribbonArt(id) ? d.asset(d.ribbonArt(id)) : undefined,
        caption: spec.caption ? spec.caption(id) : undefined, group, groupNote: note,
        controls: isOn => isOn ? ribbonControls(d, id, military, after) : null
      };
      lazy(o, 'label', () => d.ribbonName(id));
      lazy(o, 'search', () => (spec.search ? spec.search(id) : (group || '')));
      lazy(o, 'controlsKey', () => ribbonControlsKey(d, id, military));
      return o;
    };
    const options = () => spec.groups
      ? spec.groups().flatMap(g => g.ids.map(id => option(id, g.key, g.note)))
      : shown().map(id => option(id));
    const host = el('div');
    container.append(host);
    const picker = d.VisualPicker.render(host, {
      name: spec.name, ariaLabel: spec.ariaLabel, mode: 'toggle', size: 'large', shape: 'wide', options: options(), values: on(),
      onToggle: (id, wantOn) => { selectRibbon(id, wantOn, d); after(); },
      // The tiles made after the first screenful (a long list is made in pieces) get their drawn ribbon too.
      onBuilt: () => draw()
    });
    // The drawn ribbon, devices and all, in place of the plain picture of a ribbon that is on, drawn again whenever its choice changes (the picture is always the ribbon as it is worn);
    // a ribbon that is off has its plain picture back; a picture that fails to load falls back to the ribbon's plain one. The tile's own picture only: the pictures of the switches
    // under it (a device) are not touched.
    const drawnKey = id => {
      const sel = d.State.ribbonSelections[id] || {};
      return [sel.awardValue, sel.honorCredit ? 1 : 0, JSON.stringify(sel.devices || {}), sel.militaryService, (sel.specialAuthorizations || []).join(','), sel.manualNumeral, d.State.membership].join('|');
    };
    const draw = () => {
      for(const cell of picker.el.querySelectorAll('.vpCell')){
        if(cell.closest('.vpControls')) continue;   // a tile of a row under a ribbon is not a ribbon's tile
        const id = cell.dataset.value;
        const tile = cell.querySelector('.vpOption');
        const box = tile && tile.querySelector('.vpPicture');
        if(!box) continue;
        const on = chosenRibbon(d, id);
        const key = on ? drawnKey(id) : '';
        const svg = box.querySelector('svg');
        if(box.__drawnKey === key && (on ? true : !svg)) continue;
        box.__drawnKey = key;
        if(on){
          const pic = svg || box.querySelector('img');
          if(pic) d.drawRibbon(pic, id, d.State.ribbonSelections[id]);
        }else{
          let img = box.querySelector('img');
          if(!img && svg){
            img = document.createElement('img');
            img.setAttribute('alt', '');
            img.setAttribute('loading', 'lazy');
            img.setAttribute('decoding', 'async');
            img.setAttribute('draggable', 'false');
            svg.replaceWith(img);
          }
          if(img) d.fallback(img, id);
        }
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
      const noService = ui.galleryServiceFilter === 'ALL', noType = ui.galleryAwardTypeFilter === 'ALL';
      // With no filter and no search every award is listed: what a filter or the search reads is worked out only when one is set.
      if(noService && noType && !q) return all.slice();
      return all.filter(id => {
        const award = d.militaryAward(id);
        const services = ((award && award.authorizedServices) || []).map(service => String(service).toUpperCase());
        const branch = d.militaryBranchOf(award);
        const serviceMatch = noService || branch === ui.galleryServiceFilter || services.includes(ui.galleryServiceFilter);
        const typeMatch = noType || d.militaryType(award) === ui.galleryAwardTypeFilter;
        if(!serviceMatch || !typeMatch) return false;
        if(!q) return true;
        const haystack = [award && award.name, award && award.officialName, ...((award && award.aliases) || []), award && award.id, ...services, d.militaryType(award)].join(' ').toLowerCase();
        return haystack.includes(q);
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

  return { badgeList, militaryBadgeList, badgeNote, selectBadge, setBadgeLevel, setBadgeBar, setGraduated, patchList, selectPatch, selectRibbon, ribbonLists, ribbonPicker, pictureRow, pageDeps };
});
