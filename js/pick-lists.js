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
    /* global State, ASSET, getBadgeAssetPath, getBadgeDisplayName, getBadgeTileMetaHtml, isCommandInsigniaBadge, CAPUBBadgeCatalog, canSelectCommandInsigniaForCurrentRank,
       chooseOnlyCommandInsignia, rebuildBadgesFromGallery, isCommandInsigniaGradeEligible, fullRender, getAvailableMilitaryBadgeVariants, militaryServiceLabel, PATCH_META,
       patchTileWords, setPatchPlacement, normalizePatchSelections, rebuildPatchesFromGallery */
    return {
      State: typeof State !== 'undefined' ? State : null,
      VisualPicker: typeof VisualPicker !== 'undefined' ? VisualPicker : null,
      asset: p => ASSET(p),
      artPath: id => getBadgeAssetPath(id),
      name: id => getBadgeDisplayName(id),
      // The line under a badge: where it is worn, from the page's own words (an HTML line, read as text).
      caption: id => { const n = document.createElement('div'); n.innerHTML = getBadgeTileMetaHtml(id); return n.textContent.trim(); },
      isCommand: id => isCommandInsigniaBadge(id),
      levels: id => typeof CAPUBBadgeCatalog !== 'undefined' ? CAPUBBadgeCatalog.levels(id) : null,
      level: (id, level) => CAPUBBadgeCatalog.level(id, level)[0],
      canCommand: () => canSelectCommandInsigniaForCurrentRank(true),
      chooseOnlyCommand: id => chooseOnlyCommandInsignia(id),
      rebuild: () => rebuildBadgesFromGallery(),
      fullRender: () => fullRender(),
      variants: badge => getAvailableMilitaryBadgeVariants(badge),
      serviceLabel: service => militaryServiceLabel(service),
      // patches
      patchIds: () => window.capubVisiblePatchIdsForGallery(),
      patchMeta: id => PATCH_META[id] || {},
      patchWords: id => patchTileWords(id),
      setPlace: (id, slot) => setPatchPlacement(id, slot),
      keepOneTab: id => window.capubKeepOneRangerTab(id),
      normalizePatches: () => normalizePatchSelections(),
      rebuildPatches: () => rebuildPatchesFromGallery()
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

  // One picker for the badges of a list of categories: `groups` is [{ key, ids }], the key a heading above its tiles.
  function badgeList(container, groups, deps){
    const d = withDeps(deps);
    const ids = groups.flatMap(g => g.ids);
    const grads = [];
    const ref = { picker: null };
    const controls = id => {
      const box = el('div', 'vpControlStack');
      const levels = d.levels(id);
      if(levels){
        const label = el('label', 'ribbonAwardLabel');
        label.append('Level ');
        const select = el('select', 'bdLevel');
        select.setAttribute('aria-label', `Level of the ${d.name(id)}`);
        for(const [k, text] of levels){ const o = el('option'); o.value = k; o.textContent = text; select.append(o); }
        select.value = d.level(id, sel(d, id).level);
        select.addEventListener('change', () => { setBadgeLevel(id, select.value, deps); entry.setOptions(); });
        label.append(select);
        box.append(label);
      }
      if(d.isCommand(id)){
        const button = el('button', 'ghost vpSwitch', 'Graduated commander');
        button.setAttribute('type', 'button');
        button.setAttribute('aria-pressed', 'false');
        button.addEventListener('click', () => { setGraduated(id, !(d.State.commandInsignia && d.State.commandInsignia.graduatedCommander), deps); entry.refresh(); });
        grads.push({ id, button });
        box.append(button);
      }
      return box.childNodes.length ? box : null;
    };
    const options = () => groups.flatMap(g => g.ids.map(id => ({ value: id, label: d.name(id), picture: d.asset(d.artPath(id)), caption: d.caption(id), group: g.key, search: g.key, controls: () => controls(id) })));
    const host = el('div');
    container.append(host);
    const picker = d.VisualPicker.render(host, {
      name: 'badges', mode: 'toggle', size: 'large', options: options(), values: selectedIn(d, ids),
      onToggle: (id, on) => { selectBadge(id, on, deps); entry.refresh(); }
    });
    const entry = {
      picker, ids,
      // Every tile as the state says (a pin turned on turns the other off; a badge the rules took off is off).
      refresh(){
        picker.setValues(selectedIn(d, ids));
        for(const g of grads) g.button.setAttribute('aria-pressed', String(!!(d.State.badgeSelections[g.id] && d.State.badgeSelections[g.id].checked) && !!(d.State.commandInsignia && d.State.commandInsignia.graduatedCommander)));
      },
      // The pictures again (a badge at another level is another drawing).
      setOptions(){ picker.setOptions(options()); entry.refresh(); }
    };
    ref.picker = picker;
    entry.refresh();
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
    const captionOf = badge => [(badge.family && badge.family !== 'OTHER') ? String(badge.family).charAt(0) + String(badge.family).slice(1).toLowerCase() : '', (badge.authorizedServices || []).map(s => d.serviceLabel(s)).join(' / ')].filter(Boolean).join(' • ');
    const options = () => records.map(badge => ({
      value: badge.id, label: badge.officialName || badge.id, picture: pictureOf(badge), caption: captionOf(badge), search: `${branch} ${badge.family || ''}`,
      controls: () => {
        const { variants, active } = variantOf(badge);
        if(variants.length < 2) return null;
        const label = el('label', 'ribbonAwardLabel');
        label.append('Level ');
        const select = el('select', 'militaryBadgeVariant');
        select.setAttribute('title', 'Badge level or variant');
        for(const v of variants){ const o = el('option'); o.value = v.id; o.textContent = v.id.replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase()); select.append(o); }
        select.value = active;
        select.addEventListener('change', () => {
          if(!d.State.militaryBadges) d.State.militaryBadges = {};
          d.State.militaryBadges[badge.id] = { selected: true, variant: select.value };
          d.fullRender();
          picker.setOptions(options());
          picker.setValues(chosen());
        });
        label.append(select);
        return label;
      }
    }));
    const host = el('div');
    container.append(host);
    const picker = d.VisualPicker.render(host, {
      name: `militaryBadges-${branch}`, mode: 'toggle', size: 'large', options: options(), values: chosen(),
      onToggle: (id, on) => {
        if(!d.State.militaryBadges) d.State.militaryBadges = {};
        if(on) d.State.militaryBadges[id] = { selected: true, variant: variantOf(byId.get(id)).active };
        else delete d.State.militaryBadges[id];
        d.fullRender();
      }
    });
    return { picker, ids: [...byId.keys()], refresh(){ picker.setValues(chosen()); } };
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
  // group of its own; a patch with more than one place on the uniform has the choice of its places under its tile while it is on. A patch the uniform does not take is not listed.
  function patchList(container, ids, deps){
    const d = withDeps(deps);
    d.normalizePatches();
    const listed = () => (ids || d.patchIds()).filter(id => d.patchWords(id).authorized);
    const options = () => listed().map(id => {
      const meta = d.patchMeta(id), words = d.patchWords(id);
      return {
        value: id, label: words.title, picture: meta.img ? d.asset(meta.img) : undefined, caption: words.where,
        group: meta.group || undefined, groupNote: meta.group ? meta.note : undefined, search: meta.group || '',
        controls: () => placeChoice(id)
      };
    });
    // The places of a patch (one only on most uniforms: no choice then): a choice of buttons, each a place in words, under the tile while it is on.
    const placeChoice = id => {
      const words = d.patchWords(id);
      if(words.places.length < 2) return null;
      const box = el('div', 'vpPlaceChoice');
      d.VisualPicker.render(box, {
        name: `patchPlace-${id}`, legend: 'Worn', value: words.slot,
        options: words.places.map(place => ({ value: place.slot, label: place.label })),
        onChange: slot => {
          d.setPlace(id, slot);
          d.rebuildPatches();
          const cell = picker.el.querySelectorAll('.vpCell').find(c => c.dataset.value === id);
          const caption = cell && cell.querySelector('.vpCaption');
          if(caption) caption.textContent = d.patchWords(id).where;
        }
      });
      return box;
    };
    const host = el('div');
    container.append(host);
    const picker = d.VisualPicker.render(host, {
      name: 'patches', mode: 'toggle', size: 'large', options: options(), values: listed().filter(id => patchOn(d, id)),
      onToggle: (id, on) => { selectPatch(id, on, deps); entry.refresh(); }
    });
    const entry = {
      picker, ids: listed(),
      // Every tile as the state says (a Ranger tab picked turns the other tabs off).
      refresh(){ picker.setValues(listed().filter(id => patchOn(d, id))); },
      setOptions(){ picker.setOptions(options()); entry.refresh(); }
    };
    return entry;
  }

  return { badgeList, militaryBadgeList, selectBadge, setBadgeLevel, setGraduated, patchList, selectPatch };
});
