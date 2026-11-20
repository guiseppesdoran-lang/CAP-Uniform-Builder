// Choose by picture: one radio group whose options are small pictures with their names beneath, the way the uniform cards of the page are cards
// and not words in a list. The garment options (headgear, chest badge layout, chevron size...), the shoulder cord and the supplements' cords are all
// drawn with it, so they look and behave alike.
//
//   const p = VisualPicker.render(host, { name, legend, options, value, onChange });
//   p.setValue(value); p.setOptions(options); p.el; p.value;
//
//   name      a string, unique on the page: the ids of the group and its options are made from it.
//   legend    the words above the group.
//   options   [{ value, label, picture, note, mark, group }], in the order shown.
//               picture  an SVG as markup (a string that starts with "<") or a URL of an image: shown in a box of fixed shape above the label
//                        and scaled to fit it whole. An option without one shows its label alone.
//               note     a sentence shown under the group while the option is the one picked; it may end with a bracketed paragraph, which
//                        js/citations.js puts behind the question mark.
//               mark     a few words shown as a small tag on the option ("In your report").
//               group    a heading: the options that share one are shown together under it, in the order given, the groups in the order each is
//                        first met; options with no group come as they are met, without a heading.
//   value     the option picked; onChange(value) is called when the member picks another (not by setValue or setOptions).
//   size      'large' for bigger pictures (two to a row at the sidebar's width); the default fits three to a row.
//   shape     'tall' for pictures taller than wide (a whole shirt, a skirt); the default box is wider than tall.
//   labelledBy  the id of a heading of the page's own that names the group, when it has no legend of its own.
//
// A picture that is an image URL is loaded lazily, so a long list loads the pictures that come into view.
//
// Toggle mode (mode: 'toggle'): the options are switches, any number on at once, the way a list of badges, ribbons or patches is chosen: each tile is a button with aria-pressed,
// the ones on carry a tick and the picked shade. A tile is never dimmed: an option that is on and carries `notWorn: true` (a badge chosen that the drawing leaves off) shows a small hollow
// ring with a bar in the tick's place (and says "Chosen, not worn on this uniform" to assistive technology). `values` is the list of the values on; onToggle(value, on) is called when the member turns one (not by setValues or
// setOptions). An option may carry a `caption` (a small line under its name, in the tile's box outside the button, so a reference in it carries its question mark; a choice whose options carry
// one is drawn as boxed tiles too, or says `boxed: true`), a `search` (more words the filter reads) and `controls` (a node or a function(on) that returns one: the
// level, the count or the devices of the item; it is shown under the tile only while the tile is on; `controlsKey`, a string, says what the controls were made from, so that a list set
// again with the same key keeps the controls it has, and one with another key makes them again) and a `groupNote` (a line under the heading of its group). p.setValues(list); p.values; p.filter(text) hides the tiles whose name, caption
// or search words do not contain the text, and the sections left with none, and returns how many tiles are shown. The keys are the same: arrows move, Enter or the space bar turns one.
//
// To assistive technology it is a radio group (role="radiogroup"; each option role="radio" with aria-checked). It is one stop of the Tab key: the
// arrow keys move from option to option (the left and up keys back, the right and down keys on, Home and End to the ends), Enter or the space bar picks
// the option the focus is on, and so does a press. The option picked is marked by a heavier edge, a tick and its own shade, never by colour alone.
// setOptions(list) with the same tiles in the same order and headings (same values, groups, captions and marks) changes the tiles it has: a picture that is another picture, a name, the
// not-worn mark, and the controls of a tile whose `controlsKey` is not the one they were made from (or of a tile that has no key and is on): the tiles, their pictures and the focus stay
// where they are, so a list set again after every drawing does not rebuild, reload or move anything. Any other list is drawn whole.
// render() replaces what is in the host. The look is styles/app.css, "Visual pickers".
//
// Action mode (mode: 'action'): the tiles do something when pressed (download a picture) and are no choice, so none is ever picked: no radio, no tick, nothing stays pressed.
// Each tile is a plain button; onAction(value, option) is called when it is pressed, or on Enter or the space bar. The arrow keys, Home and End move between the tiles as in the
// other modes. p.setOptions(list); p.setBusy(value, on) marks a tile whose action is under way (aria-busy: a press on it does nothing); p.el. An option has a `picture` and a `label`.
//
// Loads as a classic script (window.VisualPicker) and as a CommonJS module for the Node tests, which provide the document.
(function(root, factory){
  const api = factory();
  if(typeof module === 'object' && module.exports) module.exports = api;
  else root.VisualPicker = api;
})(typeof self !== 'undefined' ? self : this, function(){
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';
  // The tick on the option picked, and the plain empty mark ("no headgear", "no cord"): a dashed outline with nothing in it. Both draw in the colour
  // the page's text takes (currentColor), so they read on either theme.
  const TICK = `<svg xmlns="${SVG_NS}" viewBox="0 0 16 16" width="16" height="16" focusable="false" aria-hidden="true"><path d="M3.5 8.5l3 3 6-6.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  // The mark that takes the tick's place on a tile that is on but that the drawing leaves off (a badge chosen that this uniform does not wear): a hollow ring with a bar across it, never a
  // filled disc with a tick, so it differs by shape and by fill, in either theme and for a member who does not see colour.
  const NOT_WORN = `<svg class="vpNotWornMark" xmlns="${SVG_NS}" viewBox="0 0 16 16" width="16" height="16" focusable="false" aria-hidden="true"><path d="M4 8h8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`;
  const NOT_WORN_WORDS = 'Chosen, not worn on this uniform';
  function emptyMark(){
    return `<svg xmlns="${SVG_NS}" viewBox="0 0 48 36" focusable="false" aria-hidden="true"><rect x="9" y="5" width="30" height="26" rx="4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="4 3"/></svg>`;
  }

  const isMarkup = s => typeof s === 'string' && /^\s*</.test(s);
  // The pictures are the page's own drawings, but a string is a string: a script and the handlers on a tag are taken out before it is set.
  function clean(markup){
    return String(markup).replace(/<script[\s\S]*?(?:<\/script>|$)/gi, '').replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  }

  function make(tag, className, text){
    const node = document.createElement(tag);
    if(className) node.className = className;
    if(text != null) node.textContent = text;
    return node;
  }
  const slug = s => String(s).replace(/[^A-Za-z0-9_-]+/g, '-');

  // The options in sections: the groups in the order each is first met, the options with no group each in the section of their place.
  function sections(options){
    const out = [];
    for(const o of options){
      const key = o.group ? String(o.group) : '';
      let s = key ? out.find(x => x.group === key) : out.length && !out[out.length - 1].group ? out[out.length - 1] : null;
      if(!s){ s = { group: key, items: [] }; out.push(s); }
      s.items.push(o);
    }
    return out;
  }

  // The picture of a tile, set the way render() sets it: markup as it is (cleaned), an address as a lazy image.
  function pictureBox(picture){
    const box = make('span', 'vpPicture');
    box.setAttribute('aria-hidden', 'true');
    if(isMarkup(picture)) box.innerHTML = clean(picture);
    else{
      const img = make('img');
      img.setAttribute('src', String(picture));
      img.setAttribute('alt', '');
      img.setAttribute('loading', 'lazy');
      img.setAttribute('decoding', 'async');
      img.setAttribute('draggable', 'false');
      box.append(img);
    }
    return box;
  }

  // Action mode (see the header): the same tiles, none of them a choice.
  function renderActions(host, cfg){
    const name = String(cfg.name || 'actions');
    const id = slug(name);
    let options = [];
    let tiles = [];          // [{ option, button }] in the order shown
    let stop = 0;            // the tile the Tab key lands on: the last one the focus was on, else the first

    const rootEl = make('div', 'vp');
    rootEl.dataset.name = name;
    rootEl.dataset.mode = 'action';
    if(cfg.size) rootEl.dataset.size = String(cfg.size);
    if(cfg.shape) rootEl.dataset.shape = String(cfg.shape);
    const legendId = `vp-${id}-legend`;
    if(cfg.legend){
      const legend = make('div', 'fieldLabel vpLegend', cfg.legend);
      legend.id = legendId;
      rootEl.append(legend);
    }
    const list = make('div', 'vpList');
    list.setAttribute('role', 'group');
    if(cfg.legend) list.setAttribute('aria-labelledby', legendId);
    else if(cfg.labelledBy) list.setAttribute('aria-labelledby', String(cfg.labelledBy));
    else list.setAttribute('aria-label', name);
    rootEl.append(list);

    function paint(){
      if(stop < 0 || stop >= tiles.length) stop = 0;
      tiles.forEach((t, i) => { t.button.tabIndex = i === stop ? 0 : -1; });
    }
    function move(from, step){
      if(!tiles.length) return;
      stop = (from + step + tiles.length) % tiles.length;
      paint();
      tiles[stop].button.focus();
    }
    function press(i){
      const t = tiles[i];
      if(!t || t.button.getAttribute('aria-busy') === 'true') return;
      stop = i;
      paint();
      if(typeof cfg.onAction === 'function') cfg.onAction(t.option.value, t.option);
    }

    function tile(o, i){
      const b = make('button', 'vpOption');
      b.setAttribute('type', 'button');
      b.id = `vp-${id}-${i}`;
      b.dataset.value = String(o.value);
      if(o.picture) b.append(pictureBox(o.picture));
      else b.classList.add('noPicture');
      b.append(make('span', 'vpLabel', o.label != null ? o.label : String(o.value)));
      b.addEventListener('click', () => press(tiles.findIndex(t => t.button === b)));
      b.addEventListener('keydown', e => {
        const at = tiles.findIndex(t => t.button === b);
        const key = e.key;
        if(key === 'ArrowRight' || key === 'ArrowDown') move(at, 1);
        else if(key === 'ArrowLeft' || key === 'ArrowUp') move(at, -1);
        else if(key === 'Home') move(0, 0);
        else if(key === 'End')move(tiles.length - 1, 0);
        else return;   // Enter and the space bar press the button itself
        e.preventDefault();
      });
      return b;
    }

    function draw(){
      const had = tiles.find(t => t.button === document.activeElement);
      const hadValue = had ? had.option.value : undefined;
      const busy = new Set(tiles.filter(t => t.button.getAttribute('aria-busy') === 'true').map(t => t.option.value));
      list.textContent = '';
      tiles = [];
      sections(options).forEach((s, si) => {
        const sec = make('div', 'vpSection');
        if(s.group) sec.append(make('div', 'vpGroupHead', s.group));
        const grid = make('div', 'vpGrid');
        for(const o of s.items){
          const b = tile(o, tiles.length);
          if(busy.has(o.value)){ b.setAttribute('aria-busy', 'true'); b.classList.add('isBusy'); }
          tiles.push({ option: o, button: b });
          grid.append(b);
        }
        sec.append(grid);
        list.append(sec);
      });
      stop = 0;
      const back = tiles.findIndex(t => t.option.value === hadValue);
      if(had && back >= 0) stop = back;
      paint();
      if(had && tiles[stop]) tiles[stop].button.focus();
    }

    const api = {
      el: rootEl,
      setOptions(next){
        options = Array.isArray(next) ? next.filter(o => o && typeof o === 'object') : [];
        draw();
      },
      setBusy(value, on){
        for(const t of tiles){
          if(t.option.value !== value) continue;
          if(on) t.button.setAttribute('aria-busy', 'true'); else t.button.removeAttribute('aria-busy');
          t.button.classList.toggle('isBusy', !!on);
        }
      }
    };
    api.setOptions(cfg.options);
    if(host){
      host.textContent = '';
      host.append(rootEl);
    }
    return api;
  }

  // What a tap sets off (the page's rules, the drawing) runs in the task after the frame that shows the tile pressed, so a phone shows the press at once; taps are kept in order.
  // Only where the page turns it on (js/bootstrap.js: `VisualPicker.deferTaps = true`, the real page with its animation frames); a page that is not on screen (and the Node tests) runs it at once.
  let deferTaps = false;
  function afterFrame(fn){
    if(!deferTaps || typeof document === 'undefined' || document.visibilityState !== 'visible' || typeof requestAnimationFrame !== 'function' || typeof setTimeout !== 'function'){ fn(); return; }
    let ran = false;
    const run = () => { if(ran) return; ran = true; try{ fn(); }catch(e){ console.error(e); } };
    requestAnimationFrame(() => setTimeout(run, 0));
    setTimeout(run, 400);
  }

  function render(host, config){
    if(config && config.mode === 'action') return renderActions(host, config);
    const cfg = config || {};
    const name = String(cfg.name || 'picker');
    const id = slug(name);
    const toggle = cfg.mode === 'toggle';
    let boxed = toggle || !!cfg.boxed;   // the tile is a box of its own (a cell) holding the button, the line under its name and its controls: every switch tile, a choice that says so (`boxed`) and a choice whose options carry a line
    let options = [];
    let value = cfg.value;
    let selected = new Set(Array.isArray(cfg.values) ? cfg.values : []);   // toggle mode: the values on
    let query = '';
    let tiles = [];          // [{ option, button }] in the order shown (sections flattened)
    let stop = 0;            // the index of the option the Tab key lands on: the last one the focus was on, else the one picked, else the first

    const rootEl = make('div', 'vp');
    rootEl.dataset.name = name;
    if(cfg.size) rootEl.dataset.size = String(cfg.size);
    if(cfg.shape) rootEl.dataset.shape = String(cfg.shape);
    if(cfg.layout) rootEl.dataset.layout = String(cfg.layout);   // 'row': one row of tiles that scrolls sideways where the choices run long
    if(toggle) rootEl.dataset.mode = 'toggle';
    const legendId = `vp-${id}-legend`;
    if(cfg.legend){
      const legend = make('div', 'fieldLabel vpLegend', cfg.legend);
      legend.id = legendId;
      rootEl.append(legend);
    }
    const list = make('div', 'vpList');
    list.setAttribute('role', toggle ? 'group' : 'radiogroup');
    if(cfg.legend) list.setAttribute('aria-labelledby', legendId);
    else if(cfg.labelledBy) list.setAttribute('aria-labelledby', String(cfg.labelledBy));   // a heading of the page's own names the group
    else list.setAttribute('aria-label', String(cfg.ariaLabel || name));
    const note = make('div', 'fieldNote vpNote');
    note.setAttribute('aria-live', 'polite');
    note.hidden = true;
    rootEl.append(list, note);
    // A tile that is a box of its own is chosen by a tap anywhere in the box (the picture, the name, the padding, the spare space under them), as by a tap on its button. A tap on a control
    // inside the box (the dropdown, a switch, the reference mark) or in the room its controls take does that control's work only; the button is still the one control for the keyboard
    // and assistive technology, and there is no button in a button.
    list.addEventListener('click', e => {
      const from = e.target;
      if(!from || !from.closest) return;
      const cell = from.closest('.vpCell');
      if(!cell || from.closest('.vpOption') || from.closest('.vpControls') || from.closest('button, a, select, input, label, .citeBtn')) return;
      const at = tiles.findIndex(t => t.cell === cell);
      if(at >= 0) pick(at);
    });

    const indexOfValue = v => tiles.findIndex(t => t.option.value === v);

    // What decides whether a list set again can be patched where it stands: the tiles in the order shown, each with its group, the lines that are not patched (group note, caption, mark), and the
    // kind of picture it has (none, markup or an address).
    let drawn = null;
    const kindOf = p => !p ? 'n' : isMarkup(p) ? 'm' : 'u';
    const signature = list => sections(list).flatMap(s => s.items).map(o => [o.value, o.group || '', o.groupNote || '', o.caption || '', o.mark || '', kindOf(o.picture), o.controls ? 1 : 0].join('\u0001')).join('\u0002');
    // The list set again with the same tiles: each tile takes what changed (its picture, its name, the not-worn mark, its controls when their key changed). Returns false when the list is not the one drawn.
    function patch(){
      if(drawn === null || signature(options) !== drawn) return false;
      const next = sections(options).flatMap(s => s.items);
      next.forEach((o, i) => {
        const t = tiles[i], was = t.option;
        t.option = o;
        const label = o.label != null ? o.label : String(o.value);
        const labelEl = t.button.querySelector('.vpLabel');
        if(labelEl && labelEl.textContent !== label) labelEl.textContent = label;
        if(o.title !== was.title){ if(o.title) t.button.setAttribute('title', String(o.title)); else t.button.removeAttribute('title'); }
        if(o.picture && o.picture !== was.picture){
          const box = t.button.querySelector('.vpPicture');
          if(box){
            const img = box.querySelector('img');
            if(isMarkup(o.picture)) box.innerHTML = clean(o.picture);
            else if(img) img.setAttribute('src', String(o.picture));
          }
        }
        if(!t.cell || !o.controls) return;
        const on = selected.has(o.value);
        const keyed = o.controlsKey !== undefined;
        if(typeof o.controls !== 'function' || (keyed ? o.controlsKey === t.controlsKey && (t.controls || !on) : !on && !t.controls)) return;
        const node = o.controls(on);
        t.controlsKey = o.controlsKey;
        if(!node){
          if(t.controls){ t.controls.parentNode.removeChild(t.controls); t.controls = null; }
          return;
        }
        if(!t.controls){
          t.controls = make('div', 'vpControls');
          t.cell.append(t.controls);
        }else t.controls.textContent = '';
        t.controls.append(node);
        t.controls.hidden = !on;
      });
      return true;
    }

    function paint(){
      const picked = toggle ? -1 : indexOfValue(value);
      if(stop < 0 || stop >= tiles.length) stop = 0;
      const attr = toggle ? 'aria-pressed' : 'aria-checked';
      // A tile is written only where it differs: a write of the value a node already has still marks it for style work, and a list is a hundred tiles and more.
      tiles.forEach((t, i) => {
        const on = toggle ? selected.has(t.option.value) : i === picked;
        const b = t.button;
        const word = on ? 'true' : 'false';
        if(b.getAttribute(attr) !== word) b.setAttribute(attr, word);
        const tab = i === stop ? 0 : -1;
        if(b.tabIndex !== tab) b.tabIndex = tab;
        if(t.on !== on){ t.on = on; b.classList.toggle('isPicked', on); }
        // Toggle mode: chosen and left off by the drawing (option.notWorn) shows the not-worn mark in the tick's place, only while the tile is on.
        const away = toggle && on && !!t.option.notWorn;
        if(t.away !== away){ t.away = away; b.classList.toggle('isNotWorn', away); }
        if(t.words === undefined) t.words = b.querySelector('.vpOffWords');
        if(t.words && t.words.hidden !== !away) t.words.hidden = !away;
        if(t.controls && t.controls.hidden !== !on) t.controls.hidden = !on;
      });
      const text = picked >= 0 && tiles[picked].option.note ? String(tiles[picked].option.note) : '';
      if(note.textContent !== text) note.textContent = text;
      note.hidden = !text;
    }

    function pick(i){
      const t = tiles[i];
      if(!t) return;
      stop = i;
      if(toggle){
        const on = !selected.has(t.option.value);
        if(on) selected.add(t.option.value); else selected.delete(t.option.value);
        paint();
        if(typeof cfg.onToggle === 'function') afterFrame(() => cfg.onToggle(t.option.value, on));
        return;
      }
      if(t.option.value === value){ paint(); return; }
      value = t.option.value;
      paint();
      if(typeof cfg.onChange === 'function'){ const now = value; afterFrame(() => cfg.onChange(now)); }
    }

    function move(from, step){
      if(!tiles.length) return;
      let i = (from + step + tiles.length) % tiles.length;
      // A tile the filter has hidden is passed over.
      for(let n = 0; n < tiles.length && tiles[i].cell && tiles[i].cell.hidden; n++) i = (i + (step || 1) + tiles.length) % tiles.length;
      stop = i;
      paint();
      tiles[i].button.focus();
    }

    function tile(o, i, describedBy){
      const b = make('button', 'vpOption');
      b.setAttribute('type', 'button');
      if(toggle) b.setAttribute('aria-pressed', 'false');
      else{
        b.setAttribute('role', 'radio');
        b.setAttribute('aria-checked', 'false');
      }
      b.id = `vp-${id}-${i}`;
      b.dataset.value = String(o.value);
      if(describedBy) b.setAttribute('aria-describedby', describedBy);
      if(o.title) b.setAttribute('title', String(o.title));
      if(o.picture){
        const box = make('span', 'vpPicture');
        box.setAttribute('aria-hidden', 'true');
        if(isMarkup(o.picture)) box.innerHTML = clean(o.picture);
        else{
          const img = make('img');
          img.setAttribute('src', String(o.picture));
          img.setAttribute('alt', '');
          img.setAttribute('loading', 'lazy');
          img.setAttribute('decoding', 'async');
          img.setAttribute('draggable', 'false');
          box.append(img);
        }
        b.append(box);
      }else b.classList.add('noPicture');
      b.append(make('span', 'vpLabel', o.label != null ? o.label : String(o.value)));
      if(o.caption && !boxed) b.append(make('span', 'vpCaption', o.caption));
      if(o.mark) b.append(make('span', 'vpMark', o.mark));
      const tick = make('span', 'vpTick');
      tick.setAttribute('aria-hidden', 'true');
      tick.innerHTML = TICK + NOT_WORN;
      b.append(tick);
      // Said to assistive technology, not drawn: the tile's picture is never dimmed, so the mark in the tick's place is the whole telling.
      const off = make('span', 'vpOffWords', NOT_WORN_WORDS);
      off.hidden = true;
      b.append(off);
      b.addEventListener('click', () => pick(tiles.findIndex(t => t.button === b)));
      b.addEventListener('keydown', e => {
        const at = tiles.findIndex(t => t.button === b);
        const key = e.key;
        if(key === 'ArrowRight' || key === 'ArrowDown') move(at, 1);
        else if(key === 'ArrowLeft' || key === 'ArrowUp') move(at, -1);
        else if(key === 'Home') move(0, 0);
        else if(key === 'End'){ completeFill(); move(tiles.length - 1, 0); }
        else if(key === 'Enter' || key === ' ' || key === 'Spacebar') pick(at);
        else return;
        e.preventDefault();
      });
      return b;
    }

    // A long list on a page that is on screen is made in pieces: the first screenful at once, the rest in the tasks after the frames that show it (a window of 173 ribbons held a phone
    // for half a second before anything showed). The tiles come in below those already there, so nothing moves; whatever needs every tile (a search, a new set of options, the End key)
    // makes the rest first.
    const FIRST = 30, CHUNK = 40;
    let fillToken = 0, filling = null;
    function completeFill(){ if(filling) filling(); }
    function draw(){
      boxed = toggle || !!cfg.boxed || options.some(o => o && o.caption);
      if(boxed) rootEl.dataset.boxed = '1'; else delete rootEl.dataset.boxed;
      drawn = signature(options);
      const focused = document.activeElement;
      const had = tiles.find(t => t.button === focused);
      const hadValue = had ? had.option.value : undefined;
      const token = ++fillToken;
      filling = null;
      list.textContent = '';
      tiles = [];
      const flat = [];
      sections(options).forEach((s, si) => s.items.forEach(o => flat.push([s, si, o])));
      let at = 0, curSi = -1, sec = null, grid = null, headId = null;
      const build = to => {
        for(; at < to && at < flat.length; at++){
          const [s, si, o] = flat[at];
          if(si !== curSi){
            curSi = si;
            sec = make('div', 'vpSection');
            headId = null;
            if(s.group){
              headId = `vp-${id}-group-${si}`;
              const head = make('div', 'vpGroupHead', s.group);
              head.id = headId;
              sec.append(head);
              // A line under the heading, from the first of its options that has one (toggle mode: the Ranger tabs' note).
              const noted = toggle ? s.items.find(x => x.groupNote) : null;
              if(noted) sec.append(make('div', 'vpGroupNote', String(noted.groupNote)));
            }
            grid = make('div', 'vpGrid');
            sec.append(grid);
            list.append(sec);
          }
          const b = tile(o, tiles.length, headId);
          if(!boxed){
            tiles.push({ option: o, button: b });
            grid.append(b);
            continue;
          }
          // A tile that is a box of its own: a cell holding the button (the picture and the name), the line under the name (outside the button, so a reference in it can carry its
          // mark: a control cannot sit in a control) and, for a switch tile, its controls (a button cannot hold a list or a field), shown while the tile is on.
          const cell = make('div', 'vpCell');
          cell.dataset.value = String(o.value);
          cell.append(b);
          if(o.caption) cell.append(make('div', 'vpCaption', o.caption));
          let controls = null;
          const node = o.controls ? (typeof o.controls === 'function' ? o.controls(selected.has(o.value)) : o.controls) : null;
          if(node){
            controls = make('div', 'vpControls');
            controls.append(node);
            cell.append(controls);
          }
          tiles.push({ option: o, button: b, cell, controls, section: sec, controlsKey: o.controlsKey });
          grid.append(cell);
        }
      };
      const progressive = flat.length > FIRST + 20 && deferTaps && typeof document !== 'undefined' && document.visibilityState === 'visible' && typeof requestAnimationFrame === 'function' && typeof setTimeout === 'function';
      build(progressive ? FIRST : flat.length);
      let refocus = !!had;
      const settle = () => {
        if(refocus && indexOfValue(hadValue) >= 0){ stop = indexOfValue(hadValue); refocus = false; paint(); if(tiles[stop]) tiles[stop].button.focus(); return; }
        paint();
      };
      const picked = indexOfValue(value);
      stop = picked >= 0 ? picked : 0;
      if(had && indexOfValue(hadValue) >= 0){ stop = indexOfValue(hadValue); refocus = false; }
      paint();
      if(had && tiles[stop] && !refocus) tiles[stop].button.focus();
      centerPicked();
      if(!progressive) return;
      const more = () => { settle(); if(query) applyFilter(query); if(typeof cfg.onBuilt === 'function') cfg.onBuilt(); };
      filling = () => { filling = null; build(flat.length); more(); };
      const schedule = () => {
        let ran = false;
        const go = () => {
          if(ran) return;
          ran = true;
          if(token !== fillToken || !filling) return;
          build(at + CHUNK);
          more();
          if(at < flat.length) schedule(); else filling = null;
        };
        requestAnimationFrame(() => setTimeout(go, 0));
        setTimeout(go, 300);
      };
      schedule();
    }
    // A row of tiles that scrolls sideways shows the picked tile in the middle of what is seen (on a draw, and when the value is set).
    function centerPicked(){
      if(cfg.layout !== 'row' || toggle) return;
      const t = tiles[indexOfValue(value)];
      const grid = t && t.button.parentNode;
      if(grid && typeof grid.clientWidth === 'number' && grid.clientWidth) grid.scrollLeft = Math.max(0, t.button.offsetLeft - (grid.clientWidth - t.button.offsetWidth) / 2);
    }

    function applyFilter(text){
      query = String(text || '').trim().toLowerCase();
      let shown = 0;
      for(const t of tiles){
        const o = t.option;
        const hit = !query || [o.label, o.caption, o.search, o.group].filter(Boolean).join(' ').toLowerCase().includes(query);
        if(t.cell) t.cell.hidden = !hit;
        if(hit) shown++;
      }
      list.querySelectorAll('.vpSection').forEach(sec => {
        const mine = tiles.filter(t => t.section === sec);
        sec.hidden = mine.length > 0 && mine.every(t => t.cell && t.cell.hidden);
      });
      return shown;
    }

    const api = {
      el: rootEl,
      get value(){ return value; },
      get values(){ return [...selected]; },
      setValues(list){
        selected = new Set(Array.isArray(list) ? list : []);
        paint();
      },
      // Toggle mode: show the tiles whose name, caption or search words contain `text` (all with none); a section with none left is hidden. Returns how many are shown.
      filter(text){
        // No search and none before: nothing is hidden, and the tiles still to come need no filter, so the list is not made whole for it (the window's search box asks as it opens).
        if(filling && !query && !String(text || '').trim()) return options.length;
        completeFill();
        return applyFilter(text);
      },
      setValue(v){
        value = v;
        const i = indexOfValue(v);
        if(i >= 0) stop = i;
        paint();
        centerPicked();
      },
      setOptions(next){
        completeFill();
        options = Array.isArray(next) ? next.filter(o => o && typeof o === 'object') : [];
        if(patch()) paint(); else draw();
        if(query) applyFilter(query);
      }
    };
    api.setOptions(cfg.options);
    if(host){
      host.textContent = '';
      host.append(rootEl);
    }
    return api;
  }

  return { render, emptyMark, SVG_NS, get deferTaps(){ return deferTaps; }, set deferTaps(v){ deferTaps = !!v; } };
});
