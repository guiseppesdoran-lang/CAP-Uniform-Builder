// The wing and region supplements a member's unit brings in (data/supplements.js), what they allow, and the section of the page that says so.
//
// The unit is the charter number the member chose in the Profile step (State.unitPatchCharter, the same choice that gives the unit patch): REGION-WING-NUMBER,
// "NER-NY-135". The wing part selects the wing's supplement and the region part the region's, so a Maryland unit (MAR-MD-014) brings Maryland Wing's supplement and
// the Mid-Atlantic Region's. A wing code and a region code are told apart by where they stand and by which list they are looked up in: NE as a wing is Nebraska, NER as a
// region is the Northeast, and a region's own headquarters (MAR-MAR-001) has a region and no wing.
//
// The plain functions (the first part) are the interface the rest of the page uses:
//   Supplements.forUnit(unitCode)  [{ key, kind: 'region' | 'wing', name, date, group }]  the supplements in force for a unit, the region's first
//   Supplements.cords(state)       [{ id, supplement, group, label, note, earned }]       the cadet cords on offer now, cords the report shows earned first; the shoulder
//                                                                                          cord picker (js/engine, js/garment-options.js) lists them after the regulation's
//   Supplements.items(state)       the other items (wing patch, headgear, accessories, notes) for this member
// and the page's glue is at the end: the section of the Profile step, the wing patch it selects, the event `capub:supplements-changed` on `document` when the unit, the
// membership or the cords a report shows earned change. Loads as a classic script (window.Supplements) and as a CommonJS module for the Node tests.
(function(root, factory){
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? () => require('../data/supplements.js') : () => root.CAPUBSupplementData);
  if(node) module.exports = api;
  else { root.Supplements = api; if(typeof document !== 'undefined') api.start(); }
})(typeof self !== 'undefined' ? self : this, function(getData){
  'use strict';

  // ---- the unit ----
  const UNIT = /^([A-Z]{2,3})-([A-Z]{2,3})-([A-Z0-9]{3})$/;
  // A charter number as its parts, or null. Case and the spaces around it do not matter.
  function parseUnit(code){
    const m = UNIT.exec(String(code == null ? '' : code).trim().toUpperCase());
    return m ? { code: m[0], region: m[1], wing: m[2], number: m[3] } : null;
  }
  // The supplements of a unit as the data holds them: the region's, then the wing's.
  function entriesFor(code){
    const unit = parseUnit(code), data = getData();
    if(!unit || !data) return [];
    const out = [];
    if(Object.prototype.hasOwnProperty.call(data.REGIONS, unit.region)) out.push(data.REGIONS[unit.region]);
    if(Object.prototype.hasOwnProperty.call(data.WINGS, unit.wing)) out.push(data.WINGS[unit.wing]);
    return out;
  }
  function forUnit(unitCode){
    return entriesFor(unitCode).map(e => ({ key: e.key, kind: e.kind, name: e.name, date: e.date, group: e.group }));
  }

  // ---- what an item says, with its paragraph in brackets (js/citations.js hides the bracket behind the question mark) ----
  const cite = (entry, item) => `(CAPR 39-1 ${entry.name}, ${item.paragraph})`;
  const noteOf = (entry, item) => `${item.rule} ${cite(entry, item)}`;
  const forMember = (item, membership) => {
    const who = item.audience || 'all';
    return who === 'all' || (membership === 'cadet' && who === 'cadet') || (membership === 'senior' && who === 'senior');
  };

  // The ids of the cords the member's report shows earned (State.supplementCordsEarned, written by js/supplements-import.js). They last while the report's own list does:
  // Undo of the import and "Clear import notes" put State.reportAuthorizedBadgeIds back to null, and the marks go with it.
  function earnedIds(state){
    const list = state && Array.isArray(state.supplementCordsEarned) ? state.supplementCordsEarned : [];
    if(!list.length) return [];
    if('reportAuthorizedBadgeIds' in state && !Array.isArray(state.reportAuthorizedBadgeIds)) return [];
    return list;
  }

  // The cords a cadet may be offered: none for a senior member, none without a unit, none for a unit with no supplement.
  function cords(state){
    if(!state || state.membership !== 'cadet') return [];
    const earned = new Set(earnedIds(state)), out = [];
    for(const entry of entriesFor(state.unitPatchCharter)){
      for(const item of entry.items){
        if(item.kind !== 'cord') continue;
        out.push({ id: item.id, supplement: entry.key, group: entry.group, label: item.label, note: noteOf(entry, item), earned: earned.has(item.id), limitedToActivity: !!item.limitedToActivity });
      }
    }
    return [...out.filter(c => c.earned), ...out.filter(c => !c.earned)];
  }
  // Every cord id any supplement names (a cord the member chose that is not offered any more is dropped).
  function cordIds(){
    const data = getData();
    return data ? data.SUPPLEMENTS.flatMap(e => e.items.filter(i => i.kind === 'cord').map(i => i.id)) : [];
  }
  const isSupplementCord = id => typeof id === 'string' && cordIds().includes(id);

  // The items that are not cords, for this member: those meant for everyone, and those for the member's own kind.
  function items(state){
    const membership = state && state.membership, out = [];
    for(const entry of entriesFor(state && state.unitPatchCharter)){
      for(const item of entry.items){
        if(item.kind === 'cord' || !forMember(item, membership)) continue;
        out.push(Object.assign({ supplement: entry.key, group: entry.group, name: entry.name, kind: item.kind, rule: item.rule, paragraph: item.paragraph, audience: item.audience || 'all', note: noteOf(entry, item) },
          item.uniforms ? { uniforms: item.uniforms.slice(), required: !!item.required, onThisUniform: item.uniforms.includes(state && state.uniform) } : {},
          item.removes ? { removes: Object.assign({}, item.removes) } : {}));
      }
    }
    return out;
  }

  // The options the builder offers that a supplement of the unit does not allow, by option: { headgear: ['beret'] } (the blue beret in Minnesota Wing).
  function hiddenOptions(state){
    const out = {};
    for(const entry of entriesFor(state && state.unitPatchCharter)){
      for(const item of entry.items){
        if(!item.removes) continue;
        for(const [option, value] of Object.entries(item.removes)) (out[option] = out[option] || []).push(value);
      }
    }
    return out;
  }

  // ---- the wing's patch ----
  // The charter number of the wing headquarters of a unit, whose emblem is the wing's patch. A region's own headquarters and National Headquarters have no wing.
  function wingCharter(code){
    const unit = parseUnit(code);
    return unit && unit.wing !== unit.region && unit.region !== 'NHQ' ? `${unit.region}-${unit.wing}-001` : null;
  }
  const g = name => (typeof globalThis !== 'undefined' ? globalThis[name] : undefined);
  const patchIdOf = charter => (typeof getUnitPatchIdForCharter === 'function' ? getUnitPatchIdForCharter(charter) : null);
  const patchMeta = id => (typeof PATCH_META !== 'undefined' && PATCH_META ? PATCH_META[id] : null) || null;
  const isHeadquartersPatch = id => { const m = patchMeta(id); return !!m && (m.echelon === 'wing' || m.echelon === 'region' || m.echelon === 'national'); };
  // The wing as the member reads it: "Maryland Wing".
  function wingName(unitCode, charter){
    const unit = parseUnit(unitCode), data = getData();
    if(unit && data && data.WINGS[unit.wing]) return data.WINGS[unit.wing].group;
    const m = patchMeta(patchIdOf(charter));
    if(m && m.label) return m.label;
    const spoken = typeof getUnitPatchSpokenName === 'function' ? getUnitPatchSpokenName(charter) : '';
    return spoken && spoken !== charter ? spoken.replace(/\s+HQ$/i, '') : (unit ? `${unit.wing} Wing` : '');
  }

  // Where the supplements say the wing's patch is worn: one entry per such item (the region's applies to the member's own wing, a wing's to that wing).
  function wingPatches(state){
    const out = [], charter = wingCharter(state && state.unitPatchCharter);
    if(!charter) return out;
    for(const entry of entriesFor(state.unitPatchCharter)){
      for(const item of entry.items){
        if(item.kind !== 'wing-patch') continue;
        out.push({ supplement: entry.key, group: entry.group, name: entry.name, paragraph: item.paragraph, rule: item.rule, note: noteOf(entry, item), required: !!item.required,
          uniforms: item.uniforms.slice(), onThisUniform: item.uniforms.includes(state.uniform), wingCharter: charter });
      }
    }
    return out;
  }
  // The wing patch on this uniform: null where no supplement of the unit speaks of one here, else what it asks and what the member has. `own`: the wing's patch is on the build
  // (chosen, or the unit's own patch); `chosen`: some wing, region or national patch is (the left sleeve takes one), or the OCP adds the higher headquarters patch itself.
  function wingPatch(state){
    const here = wingPatches(state).filter(w => w.onThisUniform);
    if(!here.length) return null;
    const charter = here[0].wingCharter, patchId = patchIdOf(charter), meta = patchMeta(patchId);
    const unitPatchId = patchIdOf(state.unitPatchCharter), chosen = state.patches || [];
    const own = !!patchId && (chosen.includes(patchId) || unitPatchId === patchId);
    return {
      required: here.some(w => w.required), items: here, wingCharter: charter, patchId: patchId || null, label: wingName(state.unitPatchCharter, charter),
      hasArt: !!(meta && meta.img), own, chosen: own || chosen.some(isHeadquartersPatch) || isHeadquartersPatch(unitPatchId)
    };
  }
  // What the Check list says: the wing patch is required on this uniform and the build does not have it (the member may leave it off: a warning, not a block).
  function warnings(state){
    const plan = state ? wingPatch(state) : null;
    if(!plan || !plan.required || plan.own || !plan.hasArt) return [];
    const w = plan.items.find(x => x.required) || plan.items[0];
    return [{ id: 'wing-patch', msg: `The ${plan.label} patch is required on this uniform and is not chosen. ${cite({ name: w.name }, w)}`, fix: { id: 'supplementWingPatchBox', label: 'Review' } }];
  }

  // ---- the page ----
  const KINDS = { 'wing-patch': 'Wing patch', headgear: 'Headgear', accessory: 'Color guard' };
  const doc = () => (typeof document !== 'undefined' ? document : null);
  const by = id => (doc() ? doc().getElementById(id) : null);
  const stateNow = () => g('State') || (typeof State !== 'undefined' ? State : null);
  function make(tag, className, text){
    const el = doc().createElement(tag);
    if(className) el.className = className;
    if(text != null) el.textContent = text;
    return el;
  }
  const sentence = s => String(s).charAt(0).toUpperCase() + String(s).slice(1);
  const listOf = names => names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : (names[0] || '');

  let lastDrawn = null, lastOffer = null;
  const signature = state => JSON.stringify([state.unitPatchCharter || '', state.membership || '', state.uniform || '', earnedIds(state), (state.patches || []).slice().sort(), state.unitPatchCharter ? (wingPatch(state) || {}).hasArt : null]);

  // Register the wing patches that supplements speak of as patches the build can hold: a patch id the page's patch list does not know is dropped when a setup is loaded. They are
  // unit patches, so the patch picker does not list them (the Unit patch list does); the section below is where a member takes one on or off.
  function registerWingPatches(){
    if(typeof patchList === 'undefined' || !Array.isArray(patchList) || typeof PATCH_META === 'undefined' || typeof CAP_UNIT_OPTIONS === 'undefined') return;
    const data = getData(), regionOf = {};
    for(const u of CAP_UNIT_OPTIONS){ const p = parseUnit(u.code); if(p && p.wing !== p.region && !regionOf[p.wing]) regionOf[p.wing] = p.region; }
    const charters = new Set();
    for(const entry of data.SUPPLEMENTS){
      if(!entry.items.some(i => i.kind === 'wing-patch')) continue;
      for(const wing of Object.keys(regionOf)) if(entry.kind === 'wing' ? wing === entry.code : regionOf[wing] === entry.code) charters.add(`${regionOf[wing]}-${wing}-001`);
    }
    for(const charter of charters){
      const id = patchIdOf(charter);
      if(id && patchMeta(id) && !patchList.includes(id)) patchList.push(id);
    }
  }

  // Take the wing's patch on or off the build (the Patches list is where the member's other patches are chosen).
  function chooseWingPatch(on, state = stateNow()){
    const plan = state ? wingPatch(state) : null;
    if(!plan || !plan.patchId || typeof patchList === 'undefined') return false;
    if(!patchList.includes(plan.patchId)) patchList.push(plan.patchId);
    state.patchSelections = state.patchSelections || {};
    state.patchSelections[plan.patchId] = state.patchSelections[plan.patchId] || { checked: false };
    state.patchSelections[plan.patchId].checked = !!on;
    if(typeof rebuildPatchesFromGallery === 'function') rebuildPatchesFromGallery();
    return true;
  }
  // A unit or a uniform the member has just chosen: where a supplement requires the wing's patch on the uniform and the build has no wing, region or national patch yet, the
  // wing's is chosen (and the member may take it off again: the section warns, it never blocks). Returns whether it was added.
  function selectWingPatch(state = stateNow()){
    const plan = state ? wingPatch(state) : null;
    if(!plan || !plan.required || !plan.hasArt || plan.chosen) return false;
    return chooseWingPatch(true, state);
  }
  // On the OCP the wing's patch is the higher headquarters patch the page places by itself, so a copy chosen for another uniform is not worn there.
  function dropWingPatchOnOcp(state = stateNow()){
    if(!state || state.uniform !== 'ocp' || !wingCharter(state.unitPatchCharter)) return;
    const id = patchIdOf(wingCharter(state.unitPatchCharter));
    if(id && state.patchSelections && state.patchSelections[id] && state.patchSelections[id].checked && id !== patchIdOf(state.unitPatchCharter)){
      state.patchSelections[id].checked = false;
      if(typeof rebuildPatchesFromGallery === 'function') rebuildPatchesFromGallery();
    }
  }
  // A supplement cord the member chose that the unit does not offer (another unit chosen, no unit, a senior member) is let go.
  function dropStaleCord(state = stateNow()){
    if(!state || !isSupplementCord(state.shoulderCord)) return false;
    if(cords(state).some(c => c.id === state.shoulderCord)) return false;
    state.shoulderCord = null;
    if('shoulderCordColour' in state) state.shoulderCordColour = null;
    return true;
  }

  function fire(state){
    const d = doc();
    if(d && typeof CustomEvent === 'function') d.dispatchEvent(new CustomEvent('capub:supplements-changed', { detail: { unit: state.unitPatchCharter || '', supplements: forUnit(state.unitPatchCharter).map(s => s.key) } }));
  }

  function goToCords(){
    const target = by('shoulderCordPanel') || by('shoulderCordSelect');
    if(!target) return;
    if(typeof window !== 'undefined' && window.CAPUB_V3 && typeof CAPUB_V3.showStepFor === 'function') CAPUB_V3.showStepFor(target);
    setTimeout(() => { if(target.scrollIntoView) target.scrollIntoView({ behavior: 'smooth', block: 'center' }); const f = target.querySelector && target.querySelector('select,[role="radio"],button,input'); if(f && f.focus) f.focus({ preventScroll: true }); }, 60);
  }

  function cordRow(entry, state){
    const mine = entry.items.filter(i => i.kind === 'cord');
    if(!mine.length || state.membership !== 'cadet') return null;
    const li = make('li', 'supplementRow supplementCords');
    li.append(make('span', 'supplementTag', 'Shoulder cords'));
    li.append(make('span', 'supplementText', `Adds ${listOf(mine.map(i => i.label))}.`));
    const earned = new Set(earnedIds(state)), found = mine.filter(i => earned.has(i.id)).map(i => i.label);
    if(found.length) li.append(make('span', 'supplementFound', `Your report shows: ${listOf(found)}.`));
    return li;
  }
  // The one pointer to the cord choice, under all the supplements: the cords are chosen under Shoulder cord (the cord picker lists them), not here.
  function cordPointer(){
    const p = make('div', 'supplementPointer');
    p.append(make('p', 'hintText', 'You choose one cord under Shoulder cord on the Items step. It is worn on the left shoulder of Blues: Class A and Class B.'));
    const go = make('button', 'ghost supplementGo', 'Go to the shoulder cord');
    go.type = 'button';
    go.addEventListener('click', goToCords);
    p.append(go);
    return p;
  }

  let boxPlaced = false;
  function itemRow(entry, item, state, plan){
    const li = make('li', 'supplementRow');
    if(KINDS[item.kind]) li.append(make('span', 'supplementTag', KINDS[item.kind]));
    li.append(make('span', 'supplementText', noteOf(entry, item)));
    if(item.kind === 'wing-patch' && item.uniforms.includes(state.uniform) && plan && !boxPlaced){
      boxPlaced = true;
      if(!plan.hasArt){
        li.append(make('span', 'supplementWarn', `The ${plan.label} patch is not in the builder yet, so it cannot be shown.`));
      }else{
        const label = make('label', 'supplementCheck'), box = make('input');
        box.type = 'checkbox'; box.id = 'supplementWingPatchBox'; box.checked = plan.own;
        box.addEventListener('change', () => { chooseWingPatch(box.checked); });
        label.append(box, make('span', '', ` Wear the ${plan.label} patch on this uniform`));
        li.append(label);
        if(plan.required && !plan.own) li.append(make('span', 'supplementWarn', `The ${plan.label} patch is not chosen. This uniform requires it; you may leave it off.`));
      }
    }
    return li;
  }

  function render(force){
    const d = doc(), state = stateNow(), host = by('supplementsSection'), body = by('supplementsBody');
    if(!d || !state) return;
    const entries = entriesFor(state.unitPatchCharter);
    const line = by('unitSupplementsLine');
    if(line){
      const text = !state.unitPatchCharter ? 'Choose your unit to load the supplements of its wing and region.'
        : entries.length ? `Loaded: ${listOf(entries.map(e => e.name))}.` : 'No wing or region supplement is loaded for this unit.';
      if(line.textContent !== text) line.textContent = text;
    }
    if(!host || !body) return;
    const sig = signature(state);
    if(!force && sig === lastDrawn) return;
    lastDrawn = sig;
    host.hidden = !entries.length;
    host.classList.toggle('hidden', !entries.length);
    body.textContent = '';
    if(!entries.length) return;
    boxPlaced = false;
    const plan = wingPatch(state);
    let words = false, anyCords = false;
    for(const entry of entries){
      const block = make('div', 'supplementBlock');
      block.dataset.supplement = entry.key;
      block.append(make('h4', 'supplementName', entry.name), make('div', 'supplementDate', entry.date));
      const list = make('ul', 'supplementItems');
      const order = { 'wing-patch': 0, headgear: 2, accessory: 3, note: 4 };
      const rows = entry.items.filter(i => i.kind !== 'cord' && forMember(i, state.membership)).sort((a, b) => order[a.kind] - order[b.kind]);
      const cordsRow = cordRow(entry, state);
      for(const item of rows.filter(i => i.kind === 'wing-patch')) list.append(itemRow(entry, item, state, plan));
      if(cordsRow){ list.append(cordsRow); anyCords = true; }
      for(const item of rows.filter(i => i.kind !== 'wing-patch')){ list.append(itemRow(entry, item, state, plan)); if(item.kind === 'headgear' || item.kind === 'accessory') words = true; }
      block.append(list);
      body.append(block);
    }
    if(anyCords) body.append(cordPointer());
    if(words) body.append(make('p', 'hintText', 'Caps and other items listed here are described in words; the builder does not draw them.'));
  }

  // The cords on offer, the unit, the membership or the report's marks changed: let the cord picker know, and let go of a cord that is not offered any more.
  function refresh(){
    const state = stateNow();
    if(!state) return;
    const offer = JSON.stringify([state.unitPatchCharter || '', state.membership || '', earnedIds(state), cords(state).map(c => c.id)]);
    const first = lastOffer === null;
    if(dropStaleCord(state) && typeof CAPUBUniformView !== 'undefined' && CAPUBUniformView.scheduleRender) CAPUBUniformView.scheduleRender();
    render();
    if(first){ lastOffer = offer; return; }
    if(offer !== lastOffer){ lastOffer = offer; fire(state); }
  }

  function start(){
    const d = doc();
    if(!d) return;
    const go = () => {
      registerWingPatches();
      refresh();
      d.addEventListener('capub:rendered', refresh);
      // The member's own choices: a unit from the list, a uniform card. (A restored or undone build is not one, so a wing patch the member took off stays off.)
      d.addEventListener('change', e => {
        if(e.target && e.target.id === 'unitPatchSelect') setTimeout(() => { refresh(); selectWingPatch(); refresh(); }, 0);
      }, true);
      d.addEventListener('click', e => {
        const card = e.target && e.target.closest ? e.target.closest('.uniformOption') : null;
        if(card && !card.classList.contains('locked')) setTimeout(() => { dropWingPatchOnOcp(); selectWingPatch(); refresh(); }, 0);
      }, true);
    };
    if(d.readyState === 'loading') d.addEventListener('DOMContentLoaded', go); else go();
  }

  return { parseUnit, forUnit, entries: entriesFor, cords, items, hiddenOptions, wingPatch, wingPatches, wingCharter, warnings, cite, noteOf, earnedIds, cordIds, isSupplementCord,
    chooseWingPatch, selectWingPatch, dropWingPatchOnOcp, dropStaleCord, render, refresh, registerWingPatches, start };
});
