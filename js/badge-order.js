// Which of two badges of equal standing is worn higher. Where the regulation leaves the order of badges to the wearer (two CAP occupational badges over
// the left pocket or above the CAP tape, data/badge-catalog.js EQUAL_STANDING), the Badges card lists the stack as the drawing has it and offers the swap:
// one "Swap" for a pair, "Move up" and "Move down" for each badge of three or more. Where the regulation fixes the order nothing is offered, and where
// the other order would not stay on the garment the card says so and offers nothing.
//
// The drawing is the source: the engine reports each such stack (scene.badgeOrders, js/engine/compose.js reportBadgeOrder), the card is made from that
// report only, and a press changes State.badgeOrder (data/badge-catalog.js moveEqual) and redraws. The choice is saved with the setup (js/wiring.js).
//
//   CAPUBBadgeOrder.model(scene)             what the card shows: [{ group, label, place, ref, title, note, rows: [{ id, title, position, up, down }],
//                                            pair, swap, why }]
//   CAPUBBadgeOrder.render(host, scene, onMove, focus)   draws the card in `host`; onMove(group, shownIds, id, dir, how) is called on a press
//   CAPUBBadgeOrder.start()                  the page's glue: puts the card under "Where your badges are worn" and redraws it with every drawing
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
        rows: e.badges.map((b, i) => ({ id: b.id, title: b.title || b.id, position: positionWord(i, n), up: swap && i > 0, down: swap && i < n - 1 })),
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
  function button(label, name, onPress, data){
    const b = make('button', 'badgeOrderButton ghost', label);
    b.type = 'button';
    b.setAttribute('type', 'button');
    b.setAttribute('aria-label', name);
    Object.assign(b.dataset, data || {});
    b.addEventListener('click', onPress);
    return b;
  }

  // Draws the card in `host` and returns the list of groups drawn. `focus` ({ group, id, how }) names the control that had the focus before this
  // drawing (a press redraws the card), so the focus stays with the member's place in it.
  function render(host, scene, onMove, focus){
    const groups = model(scene);
    host.replaceChildren();
    host.classList.toggle('hidden', !groups.length);
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
      const list = make('ol', 'badgeOrderList');
      const shown = g.rows.map(r => r.id);
      for(const r of g.rows){
        const li = make('li', 'badgeOrderRow');
        li.dataset.badge = r.id;
        li.append(make('span', 'badgeOrderName', r.title), make('span', 'badgeOrderPosition', r.position));
        if(!g.pair && g.swap){
          const press = (dir, how) => () => onMove && onMove(g.group, shown, r.id, dir, how);
          const actions = make('span', 'badgeOrderActions');
          if(r.up) actions.append(button('Move up', `Move up the ${r.title}`, press(-1, 'up'), { badge: r.id, how: 'up' }));
          if(r.down) actions.append(button('Move down', `Move down the ${r.title}`, press(1, 'down'), { badge: r.id, how: 'down' }));
          li.append(actions);
        }
        list.append(li);
      }
      section.append(list);
      if(g.pair && g.swap){
        const [upper, lower] = g.rows;
        section.append(button('Swap', `Swap the ${upper.title} and the ${lower.title}`, () => onMove && onMove(g.group, shown, upper.id, 1, 'swap'), { how: 'swap' }));
      }
      if(g.why) section.append(make('p', 'fieldNote badgeOrderWhy', g.why));
      host.append(section);
    }
    // The member's place in the card: the same control again, or the nearest one that is left (a badge moved to the top has no "Move up").
    if(focus){
      const section = [...host.children].find(n => n.dataset && n.dataset.group === focus.group);
      const buttons = section ? [...section.querySelectorAll('button')] : [];
      const again = buttons.find(b => b.dataset.how === focus.how && (focus.how === 'swap' || b.dataset.badge === focus.id))
        || buttons.find(b => b.dataset.badge === focus.id) || buttons[0];
      if(again && again.focus) again.focus();
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
  // What a press does: the badge moves one place among the badges of its group as drawn (a pair swaps), State.badgeOrder keeps it, the page redraws.
  function move(group, shown, id, dir, how){
    const State = page.State, Catalog = page.CAPUBBadgeCatalog;
    if(!State || !Catalog) return;
    State.badgeOrder = Catalog.moveEqual(State.badgeOrder, group, shown, id, dir);
    lastFocus = { group, id, how };
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
    render(host, current, move, told);
    // After a press the redraw says in words what moved.
    if(told && current){
      const status = document.getElementById(STATUS_ID);
      const g = model(current).find(x => x.group === told.group);
      if(status && g){
        const at = g.rows.findIndex(r => r.id === told.id);
        const row = g.rows[at];
        if(row) status.textContent = told.how === 'swap'
          ? `${g.rows[0].title} is now worn above ${g.rows[1].title}.`
          : `${row.title} is now ${/^(Highest|Lowest)$/.test(row.position) ? 'the ' + row.position.toLowerCase() : row.position} of the ${g.rows.length} badges.`;
      }
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

  return { model, render, update, move, start, positionWord, HOST_ID, STATUS_ID };
});
