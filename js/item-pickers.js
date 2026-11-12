// The choices of the Items step that change what is drawn (the ribbon rack's columns and upper rows, how miniature medals are mounted, the command insignia pin) are chosen by
// picture, the way the options of the Uniform options panel are (js/garment-options.js, js/visual-picker.js): a small picture of each choice with its name beneath, made from the
// engine's own rack and numbers (js/option-pictures.js). The control each one replaces stays on the page, hidden, as the source of truth: the page's own code (js/wiring.js,
// js/placement.js, js/workspace-ui.js) reads it, writes it and listens to its change event as it always did, so what is saved, shared and undone does not change. A picture is
// pressed or keyed to set the control and fire the change; the control being set by the page (a saved setup loaded, undo) is read back after the next drawing.
//
// A choice that does not apply to this member is not offered (not greyed): the rack's choices when no ribbon is worn or every choice lays the same rack; the host is hidden.
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
    select: {
      values: el => [...el.querySelectorAll('option')].map(o => o.value),
      read: el => el.value,
      write(el, v){ el.value = v; fire(el); }
    }
  };

  // One entry per control: the control's id, the host that takes the picker (a div beside it), the group's name and legend, the words of each choice, the picture recipe
  // (js/option-pictures.js RECIPES), the State fields the pictures depend on (so the pictures are asked for again only when one changed), and what keeps the picker out of
  // sight: `mirror` returns an element of the page whose `hidden` class hides the control (the page shows and hides the controls, the picker follows).
  const PICKERS = [
    { id: 'ribbonRackColumns', kind: 'select', recipe: 'rackColumns', legend: 'Ribbon rack layout', size: 'large',
      labels: { '3': '3 across, centered', '4-left': '4 across, left edge on the pocket', '4-center': '4 across, centered on the pocket' },
      deps: ['uniform', 'gender', 'ribbons', 'ribbonRackArrangement', 'ribbonRowOverrideEnabled', 'ribbonRowOverride', 'hideRibbons', 'cadetHighestOnly'] },
    { id: 'ribbonRackArrangement', kind: 'select', recipe: 'rackArrangement', legend: 'Upper-row arrangement', size: 'large',
      labels: { standard: 'Standard, centered top row', lapel: 'Automatic, clear of the lapel' },
      deps: ['uniform', 'gender', 'ribbons', 'ribbonRackLayout', 'ribbonRowOverrideEnabled', 'ribbonRowOverride', 'hideRibbons', 'cadetHighestOnly'] }
  ];

  const picked = new Map();   // id -> { picker, signature }
  const hideHost = (host, hidden) => { if(host.hidden !== hidden) host.hidden = hidden; };

  function sync(def){
    const el = by(def.id), host = by(def.id + 'Picker');
    if(!el || !host || typeof VisualPicker === 'undefined' || typeof CAPUBOptionPictures === 'undefined') return;
    const kind = KINDS[def.kind];
    const values = kind.values(el);
    const value = kind.read(el);
    const mirror = def.mirror ? def.mirror(el) : null;
    if(mirror && mirror.classList.contains('hidden')){ hideHost(host, true); return; }
    // The pictures are asked for again only when something they are made from has changed.
    const state = typeof State !== 'undefined' ? State : {};
    const signature = JSON.stringify([def.deps.map(k => state[k]), values, el.disabled]);
    const own = picked.get(def.id) || { picker: null, signature: null };
    if(own.signature !== signature){
      own.signature = signature;
      picked.set(def.id, own);
      const made = CAPUBOptionPictures.pictures(def.recipe, values);
      const paint = known => {
        // A choice the engine's own drawing does not tell from the others (or one that cannot apply) is not offered; with none left the host is hidden.
        const options = values.filter(v => known[v] !== false && !el.disabled).map(v => ({ value: v, label: def.labels[v] || v, picture: known[v] == null ? undefined : known[v] }));
        if(options.length < 2){ hideHost(host, true); return; }
        if(!own.picker) own.picker = VisualPicker.render(host, { name: 'itemOpt-' + def.id, legend: def.legend, options, value: kind.read(el), size: def.size, shape: def.shape, onChange: v => kind.write(el, v) });
        else{ own.picker.setOptions(options); own.picker.setValue(kind.read(el)); }
        hideHost(host, false);
      };
      if(made.settled || Object.keys(made.now).length) paint(made.now);
      else hideHost(host, true);
      if(!made.settled) made.ready.then(done => { if(own.signature === signature) paint(done); });
    }else if(own.picker){
      own.picker.setValue(value);
    }
  }

  function syncAll(){ PICKERS.forEach(sync); }

  document.addEventListener('capub:rendered', syncAll);
  document.addEventListener('capub:history', syncAll);
  document.addEventListener('capub:supplements-changed', syncAll);
  syncAll();
  window.CAPUBItemPickers = { PICKERS, sync: syncAll };
})();
