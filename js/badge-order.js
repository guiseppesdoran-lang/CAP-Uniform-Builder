// Which of two badges of equal standing is worn higher. Where the regulation leaves the order of badges to the wearer (two CAP occupational badges over
// the left pocket or above the CAP tape, data/badge-catalog.js EQUAL_STANDING), the Badges card shows the stack drawn each way it may be worn, as a row of
// picture tiles (the pair both ways; three or four badges every order, a long list scrolling in the row) and the member picks one. Where the regulation fixes
// the order nothing is offered, and where the other order would not stay on the garment the card says so and offers nothing.
//
// The drawing is the source: the engine reports each such stack (scene.badgeOrders, js/engine/compose.js reportBadgeOrder), the card is made from that
// report only, each tile is the engine's own drawing of the member's uniform with that order (js/option-pictures.js, the recipe badgeOrder), and a pick
// changes State.badgeOrder (data/badge-catalog.js setEqual) and redraws. The choice is saved with the setup (js/wiring.js).
//
//   CAPUBBadgeOrder.model(scene)             what the card shows: [{ group, label, place, ref, title, note, rows: [{ id, title, position }], pair, swap, why }]
//   CAPUBBadgeOrder.orders(ids)              every order the badges may take, each a list of ids, highest first
//   CAPUBBadgeOrder.render(host, scene, onChoose, focus, deps)   draws the card in `host`; onChoose(group, order) is called on a pick
//   CAPUBBadgeOrder.start()                  the page's glue: puts the card in the Badges card and redraws it with every drawing
//
// Loads as a classic script (window.CAPUBBadgeOrder) and as a CommonJS module for the Node tests, which provide the document.
(function(root, factory){
  const api = factory();
  if(typeof module === 'object' && module.exports) module.exports = api;
  else{ root.CAPUBBadgeOrder = api; if(typeof document !== 'undefined') api.start(); }
})(typeof self !== 'undefined' ? self : this, function(){
  'use strict';

  // The page's globals (window in the page, the global object in the tests).
  const page = typeof globalThis !== 'undefined' ? globalThis : {};

  const HOST_ID = 'badgeOrder', STATUS_ID = 'badgeOrderStatus';
  const cap = s => String(s).charAt(0).toUpperCase() + String(s).slice(1);
  const ordinal = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' })[n % 10] || 'th');
  // Where a badge stands in its stack, in words: a pair is the higher and the lower; longer stacks the highest, the lowest and the places between.
  function positionWord(i, n){
    if(n === 2) return i === 0 ? 'Higher' : 'Lower';
    if(i === 0) return 'Highest';
    if(i === n - 1) return 'Lowest';
    return ordinal(i + 1);
  }

  // What the card shows, from the drawing's report. A stack the drawing could not hold in either order has `swap` false and its reason in `why`.
  function model(scene){
    return ((scene && scene.badgeOrders) || []).filter(e => e && Array.isArray(e.badges) && e.badges.length >= 2).map(e => {
      const n = e.badges.length, swap = e.swap !== false;
      return {
        group: e.group, label: e.label, place: e.place, ref: e.ref || '',
        title: cap(`${e.label} ${e.place}`),
        // The rule, with its paragraph (js/citations.js puts the paragraph behind the question mark).
        note: `The regulation sets no order between these badges, so either may be worn higher${e.ref ? ` (CAPR 39-1, ${e.ref})` : ''}.`,
        rows: e.badges.map((b, i) => ({ id: b.id, title: b.title || b.id, position: positionWord(i, n) })),
        pair: n === 2, swap, why: swap ? '' : (e.why || '')
      };
    });
  }

  function make(tag, className, text){
    const node = document.createElement(tag);
    if(className) node.className = className;
    if(text != null) node.textContent = text;
    return node;
  }
  // Every order the badges of a stack may take. The tiles keep one fixed order of their own (the catalog's precedence, then the name), so a tile stays where it is when another is picked.
  // Up to four badges are every arrangement of them; more than that (the page holds fewer) is the order as it stands and each badge moved one place.
  function orders(ids){
    const Catalog = page.CAPUBBadgeCatalog;
    const rank = id => (Catalog && Catalog.occupationalRank ? Number(Catalog.occupationalRank(id)) : 0) || 0;
    const base = [...ids].sort((a, b) => rank(a) - rank(b) || (a < b ? -1 : a > b ? 1 : 0));
    const out = [];
    if(base.length > 4){
      out.push([...ids]);
      for(let i = 0; i < ids.length - 1; i++){ const next = [...ids]; [next[i], next[i + 1]] = [next[i + 1], next[i]]; out.push(next); }
      return out;
    }
    const go = (rest, head) => { if(!rest.length) out.push(head); else rest.forEach((x, i) => go(rest.filter((_, j) => j !== i), [...head, x])); };
    go(base, []);
    return out;
  }

  // The row of tiles for one stack: each order, its badges named top to bottom, the engine's picture of it; the order the drawing has is picked. Pictures are asked for as the page is free
  // to make them; an order the engine does not keep is not offered unless it is the one drawn.
  function choice(section, g, onChoose, deps, token, host, focusGroup){
    const slot = make('div', 'badgeOrderChoice');
    section.append(slot);
    const ids = g.rows.map(r => r.id);
    const here = ids.join(',');
    const all = orders(ids);
    const key = o => o.join(',');
    const titleOf = Object.fromEntries(g.rows.map(r => [r.id, r.title]));
    const row = page.CAPUBPickLists && page.CAPUBPickLists.pictureRow;
    const Picker = (deps && deps.VisualPicker) || page.VisualPicker;
    const made = deps && deps.pictures ? deps.pictures(g.group, all.map(key)) : (page.CAPUBOptionPictures ? page.CAPUBOptionPictures.pictures('badgeOrder:' + g.group, all.map(key)) : null);
    const draw = known => {
      if(host.__badgeOrderToken !== token) return;
      const had = slot.contains && slot.contains(document.activeElement);
      slot.textContent = '';
      if(!row || !Picker) return;
      const offered = all.filter(o => known[key(o)] !== false || key(o) === here);
      slot.append(row({ VisualPicker: Picker }, {
        name: `badgeOrder-${g.group}`, label: `${g.title}: the order the badges are worn in`, value: here, pictureHeight: '84px', tileWidth: '128px',
        options: offered.map(o => ({ value: key(o), label: o.map(id => titleOf[id]).join(' over '), title: `Top to bottom: ${o.map(id => titleOf[id]).join(', ')}`, picture: known[key(o)] || undefined })),
        onChange: v => onChoose && onChoose(g.group, v.split(','))
      }).host);
      if(had || focusGroup === g.group){
        const on = slot.querySelector('[aria-checked="true"]');
        if(on && on.focus) on.focus();
      }
    };
    if(!made) draw({});
    else{
      draw(made.settled || Object.keys(made.now).length ? made.now : {});
      if(!made.settled) made.ready.then(draw);
    }
  }

  // Draws the card in `host` and returns the list of groups drawn. `focus` ({ group }) names the stack whose tile had the focus before this drawing (a pick redraws the card), so the
  // focus stays with the member's place in it. `deps` ({ VisualPicker, pictures }) stand in for the page's own in the tests.
  function render(host, scene, onChoose, focus, deps){
    const groups = model(scene);
    host.replaceChildren();
    host.classList.toggle('hidden', !groups.length);
    const token = host.__badgeOrderToken = {};
    if(!groups.length) return groups;
    for(const g of groups){
      const section = make('section', 'badgeOrderGroup');
      section.dataset.group = g.group;
      section.setAttribute('role', 'group');
      const headId = `badgeOrderHead-${g.group}`;
      section.setAttribute('aria-labelledby', headId);
      const head = make('h4', 'badgeChooserTitle badgeOrderTitle', g.title);
      head.id = headId;
      section.append(head, make('p', 'fieldNote badgeOrderNote', g.note));
      if(g.swap){
        choice(section, g, onChoose, deps, token, host, focus && focus.group);
      }else{
        // The other order would not fit: the stack as it stands, and why.
        const list = make('ol', 'badgeOrderList');
        for(const r of g.rows){
          const li = make('li', 'badgeOrderRow');
          li.dataset.badge = r.id;
          li.append(make('span', 'badgeOrderName', r.title), make('span', 'badgeOrderPosition', r.position));
          list.append(li);
        }
        section.append(list);
      }
      if(g.why) section.append(make('p', 'fieldNote badgeOrderWhy', g.why));
      host.append(section);
    }
    return groups;
  }

  // ---- the page ----
  let lastFocus = null;
  function hostEl(){
    let host = document.getElementById(HOST_ID);
    if(host) return host;
    const after = document.getElementById('badgeSummary') || document.getElementById('badgesPlannedNote');
    if(!after) return null;
    host = make('div', 'badgeOrder hidden');
    host.id = HOST_ID;
    host.setAttribute('role', 'region');
    host.setAttribute('aria-label', 'Badge order');
    after.insertAdjacentElement('afterend', host);
    // What a press did, said for assistive technology. It stays where it is while the card is drawn again, so the change is announced.
    const status = make('p', 'badgeOrderStatus');
    status.id = STATUS_ID;
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.setAttribute('aria-atomic', 'true');
    host.insertAdjacentElement('afterend', status);
    return host;
  }
  // What a pick does: the order picked is the member's order for the group (State.badgeOrder keeps it), the page redraws.
  function choose(group, order){
    const State = page.State, Catalog = page.CAPUBBadgeCatalog;
    if(!State || !Catalog) return;
    State.badgeOrder = Catalog.setEqual(State.badgeOrder, group, order);
    lastFocus = { group, order };
    const view = page.CAPUBUniformView;
    if(view && view.scheduleRender) view.scheduleRender();
  }
  function update(scene){
    const host = hostEl();
    if(!host) return;
    const State = page.State;
    const current = scene && (!State || !State.uniform || scene.uniform === State.uniform) ? scene : null;
    const told = lastFocus;
    lastFocus = null;
    render(host, current, choose, told);
    // After a pick the redraw says in words what the order is now.
    if(told && current){
      const status = document.getElementById(STATUS_ID);
      const g = model(current).find(x => x.group === told.group);
      if(status && g) status.textContent = g.pair
        ? `${g.rows[0].title} is now worn above ${g.rows[1].title}.`
        : `The badges are now worn, top to bottom: ${g.rows.map(r => r.title).join(', ')}.`;
    }
  }
  function start(){
    const go = () => {
      document.addEventListener('capub:rendered', e => update(e && e.detail && e.detail.scene));
      // A setup with no drawing (nothing chosen yet, or reset) leaves no card behind.
      document.addEventListener('capub:history', () => { const v = page.CAPUBUniformView; if(v && !v.scene) update(null); });
    };
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
  }

  return { model, orders, render, update, choose, start, positionWord, HOST_ID, STATUS_ID };
});
