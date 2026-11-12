// The choices of the Items step that change what is drawn (the ribbon rack's columns and upper rows, how miniature medals are mounted, the command insignia pin) are chosen by
// picture, the way the options of the Uniform options panel are (js/garment-options.js, js/visual-picker.js): a small picture of each choice with its name beneath, made from the
// engine's own rack and numbers (js/option-pictures.js). The control each one replaces stays on the page, hidden, as the source of truth: the page's own code (js/wiring.js,
// js/placement.js, js/workspace-ui.js) reads it, writes it and listens to its change event as it always did, so what is saved, shared and undone does not change. A picture is
// pressed or keyed to set the control and fire the change; the control being set by the page (a saved setup loaded, undo) is read back after the next drawing.
//
// A choice that does not apply to this member is not offered (not greyed): the rack's choices when no ribbon is worn or every choice lays the same rack, the pin's choices the
// control has disabled or the uniform does not draw; the host is hidden when fewer than two are left. The page shows and hides some controls itself (the miniature medals' only on
// the uniforms that wear them): the host follows.
(function(){
  'use strict';

  const by = id => document.getElementById(id);

  // How each kind of control is read and set. The change event is the one the control gives when a member uses it, so the page's handler runs unchanged.
  function fire(el){
    let e;
    if(typeof Event === 'function') e = new Event('change', { bubbles: true });
    else e = { type: 'change', bubbles: true };
    el.dispatchEvent(e);
  }
  const KINDS = {
    // A drop-down list: its options, its value.
    select: {
      values: el => [...el.querySelectorAll('option')].map(o => o.value),
      offered: el => el.disabled ? [] : [...el.querySelectorAll('option')].filter(o => !o.disabled).map(o => o.value),
      read: el => el.value,
      write(el, v){ el.value = v; fire(el); }
    },
    // A group of radio buttons (the element is the one that holds them): one of them is checked; a disabled one is not offered unless it is the one checked.
    radios: {
      inputs: el => [...el.querySelectorAll('input[type="radio"]')],
      values(el){ return this.inputs(el).map(i => i.value); },
      offered(el){ return this.inputs(el).filter(i => !i.disabled || i.checked).map(i => i.value); },
      read(el){ const on = this.inputs(el).find(i => i.checked); return on ? on.value : undefined; },
      write(el, v){ const input = this.inputs(el).find(i => i.value === v); if(input && !input.disabled){ input.checked = true; fire(input); } }
    }
  };

  // One entry per picker: the host (a div beside the control, `<id>Picker`), the control (`source`, else the id), the group's name and legend, the words of each choice, the picture
  // recipe (js/option-pictures.js RECIPES), the State fields the pictures depend on (so they are asked for again only when one changed), `mirror` (the element of the page whose
  // `hidden` class hides the control: the host follows it) and `labelledBy` (the element that names the group for assistive technology when there is no legend).
  const RACK = ['uniform', 'gender', 'ribbons', 'ribbonRowOverrideEnabled', 'ribbonRowOverride', 'hideRibbons', 'cadetHighestOnly'];
  const PICKERS = [
    { id: 'ribbonRackColumns', kind: 'select', recipe: 'rackColumns', legend: 'Ribbon rack layout', size: 'large',
      labels: { '3': '3 across, centered', '4-left': '4 across, left edge on the pocket', '4-center': '4 across, centered on the pocket' },
      deps: [...RACK, 'ribbonRackArrangement'] },
    { id: 'ribbonRackArrangement', kind: 'select', recipe: 'rackArrangement', legend: 'Upper-row arrangement', size: 'large',
      labels: { standard: 'Standard, centered top row', lapel: 'Automatic, clear of the lapel' },
      deps: [...RACK, 'ribbonRackLayout'] },
    { id: 'miniMountStyle', kind: 'select', recipe: 'miniMount', legend: 'Miniature medal mounting method', size: 'large', shape: 'tall',
      labels: { mounting: 'Mounting bars, 4 per row (up to 24)', holding: 'Holding bars, custom overlap (up to 28)' },
      mirror: el => el.closest('label'), deps: ['uniform', 'gender', 'membership', 'ribbons'] },
    { id: 'commandInsigniaChoice', source: 'commandInsigniaRow', kind: 'radios', recipe: 'commandWorn', size: 'large', labelledBy: 'commandInsigniaLabel',
      labels: { none: 'Not worn', current: 'Current commander', graduated: 'Graduated commander' },
      deps: ['uniform', 'gender', 'rank', 'badges', 'membership', 'ribbons'] },
    { id: 'commandInsigniaLevel', kind: 'select', recipe: 'commandLevel', legend: 'Command held',
      labels: { squadron: 'Squadron commander', group: 'Group commander' },
      deps: ['uniform', 'gender', 'rank'] }
  ];

  const picked = new Map();   // id -> { picker, signature }
  const hideHost = (host, hidden) => { if(host.hidden !== hidden) host.hidden = hidden; };

  function sync(def){
    const el = by(def.source || def.id), host = by(def.id + 'Picker');
    if(!el || !host || typeof VisualPicker === 'undefined' || typeof CAPUBOptionPictures === 'undefined') return;
    const kind = KINDS[def.kind];
    const mirror = def.mirror ? def.mirror(el) : null;
    if(mirror && mirror.classList.contains('hidden')){ hideHost(host, true); return; }
    const values = kind.values(el);
    const offered = kind.offered(el);
    const value = kind.read(el);
    // The pictures are asked for again only when something they are made from has changed.
    const state = typeof State !== 'undefined' ? State : {};
    const signature = JSON.stringify([def.deps.map(k => state[k]), values, offered]);
    const own = picked.get(def.id) || { picker: null, signature: null };
    if(own.signature !== signature){
      own.signature = signature;
      picked.set(def.id, own);
      const made = CAPUBOptionPictures.pictures(def.recipe, values);
      const paint = known => {
        // A choice the engine's own drawing does not tell from the others (or one the uniform does not draw) is not offered unless it is the one the control holds; with fewer than
        // two left there is nothing to pick between and the host is hidden.
        const now = kind.read(el);
        const options = values.filter(v => offered.includes(v) && (known[v] !== false || v === now)).map(v => ({ value: v, label: def.labels[v] || v, picture: known[v] == null ? undefined : known[v] }));
        own.shown = options.length >= 2;
        if(!own.shown){ hideHost(host, true); return; }
        if(!own.picker){
          own.picker = VisualPicker.render(host, { name: 'itemOpt-' + def.id, legend: def.legend, options, value: now, size: def.size, shape: def.shape, onChange: v => kind.write(el, v) });
          const group = def.labelledBy && own.picker.el.querySelector('[role="radiogroup"]');
          if(group){ group.removeAttribute('aria-label'); group.setAttribute('aria-labelledby', def.labelledBy); }
        }else{ own.picker.setOptions(options); own.picker.setValue(now); }
        hideHost(host, false);
      };
      if(made.settled || Object.keys(made.now).length) paint(made.now);
      else hideHost(host, true);
      if(!made.settled) made.ready.then(done => { if(own.signature === signature) paint(done); });
    }else if(own.picker){
      own.picker.setValue(value);
      hideHost(host, !own.shown);
    }
  }

  // The Class A coat's custom row grid (State.ribbonRowOverrideEnabled and ribbonRowOverride, the rows top first) is no longer offered: CAPR 39-1 11.2.7 allows rows of three, or of four,
  // all full but the top row, and the width choice above lays exactly those, so a grid of the member's own rows can give no allowed layout that the width does not. What a saved setup
  // carries is settled once the rack is drawn: rows that are such a layout become the width choice that lays them (three across, or four across centered, the standard arrangement);
  // any other rows are dropped and the rack is the member's width and arrangement. Rows that do not add up to the ribbons worn are not in force and are left as they are.
  function settleOverride(){
    if(typeof State === 'undefined' || !State.ribbonRowOverrideEnabled || State.uniform !== 'blues_a') return;
    if(typeof CAPUBEngine === 'undefined' || !CAPUBEngine.awards || typeof CAPUBUniformView === 'undefined') return;
    let worn;
    try{ worn = CAPUBUniformView.buildFromState().ribbons.length; }catch(e){ return; }
    const rows = (Array.isArray(State.ribbonRowOverride) ? State.ribbonRowOverride : []).map(Number);
    if(rows.reduce((a, c) => a + c, 0) !== worn) return;
    const width = CAPUBEngine.awards.plainRowsWidth([...rows].reverse(), worn, 4);
    State.ribbonRowOverrideEnabled = false;
    State.ribbonRowOverride = [];
    if(width){ State.ribbonRackLayout = width === 3 ? '3' : '4-center'; State.ribbonRackArrangement = 'standard'; }
    if(typeof refreshUI === 'function') refreshUI();
    if(typeof fullRender === 'function') fullRender();
  }

  function syncAll(){ settleOverride(); PICKERS.forEach(sync); }
  // After the drawing, and after every other listener of it has set the controls it sets (js/workspace-ui.js writes the command row then): a control is read when all have.
  const later = () => Promise.resolve().then(syncAll);

  document.addEventListener('capub:rendered', later);
  document.addEventListener('capub:history', later);
  document.addEventListener('capub:supplements-changed', later);
  // The page hides a control by a class (the miniature medals' on a uniform that wears none, js/placement.js): the picker follows at once, not at the next drawing.
  if(typeof MutationObserver === 'function'){
    for(const def of PICKERS){
      const el = def.mirror && by(def.source || def.id), mirror = el && def.mirror(el);
      if(mirror) new MutationObserver(() => sync(def)).observe(mirror, { attributes: true, attributeFilter: ['class', 'hidden'] });
    }
  }
  syncAll();
  window.CAPUBItemPickers = { PICKERS, sync: syncAll, KINDS };
})();
