// Choices about the garment itself: sleeve length, the women's aviator top, what is worn under the
// blazer, the mess dress skirt and buttons, headgear and the OCP cap grade's form, chevron size, the flight jacket and scarf, the ES patch, the polo's shirt.
// Each option is offered only on the uniforms (and for the members) it applies to, and is kept in
// State.garment. The uniform engine reads them through js/uniform-view.js.
(function(){
  'use strict';

  function gradeOf(){
    return CAPUBEngine.grades.gradeInfo(State.membership, State.rank, {});
  }
  const FLIGHT = ['flight_suit', 'corporate_flight_suit'];
  const FIELD = ['ocp', 'abu', 'corporate_field'];
  // The most badges each field uniform draws above the CAP tape (js/engine/profiles-field.js MAX_BADGES): the OCP four, the ABU and
  // CFU two (aviation and occupational badges only, 5.1.1.1.2.4, 5.2.1.1.2.6).
  const FIELD_CHEST_MAX = { ocp: 4, abu: 2, corporate_field: 2 };
  // ICL 26-14 (7.1.1.2.1, 7.1.1.8): on the OCP a chaplain wears the chaplain badge on the 2 x 2 in chest square and on the cap front, in place of the grade, and
  // it is not one of the four above the CAP tape. The ABU and CFU rules are unchanged.
  function hasChaplainBadge(){
    return typeof CAPUBBadgeCatalog !== 'undefined' && (State.badges || []).some(id => CAPUBBadgeCatalog.family(id) === 'chaplain');
  }
  function chestBadgeCount(){
    const max = FIELD_CHEST_MAX[State.uniform];
    const own = State.uniform === 'ocp' && hasChaplainBadge() ? (State.badges || []).filter(id => CAPUBBadgeCatalog.family(id) !== 'chaplain') : (State.badges || []);
    return max ? Math.min(own.length, max) : 0;
  }

  // The polo (Corporate Working Uniform, 5.3). The screen-printed shirt has no accoutrements (5.3.2.1.2): its name and badge options
  // stay in the list, switched off, with the paragraph.
  const POLO_PRINT = 'No accoutrements are worn with the screen-printed seal (CAPR 39-1, 5.3.2.1.2).';
  const isPolo = c => c.u === 'polo';
  const poloPrint = c => isPolo(c) && c.o.poloShirt === 'print';
  const TEXT_MAX = { dutyTitle: 30 };

  // The tie rule for the uniform on the page (data/uniform-rules.js): { offered, defaultOn, para }.
  function tieOf(c){
    if(!['blues_b', 'aviator'].includes(c.u) || typeof CAPUBUniformRules === 'undefined') return { offered: false, defaultOn: false, para: null };
    return CAPUBUniformRules.tieRule(c.u, { gender: c.female ? 'female' : 'male', sleeve: (c.o && c.o.sleeve) || 'short', overblouse: c.u === 'aviator' && c.female && (c.o && c.o.femaleTop) === 'overblouse' });
  }

  // { key, label, type: 'select' | 'check' | 'text', choices: [[value, label]] | fn, when(ctx), off(ctx) -> note | '' (shown, switched off) }
  const OPTIONS = [
    { key: 'poloShirt', label: 'Shirt', type: 'select',
      choices: [['embroidered', 'Knit polo, seal embroidered (5.3.1.1)'], ['print', 'Knit polo, seal screen-printed (5.3.1.2)'], ['tactical', 'Tactical polo, pen pocket on the left sleeve (5.3.1.3)']],
      when: isPolo },
    { key: 'poloCut', label: 'Cut', type: 'select',
      choices: [['', "Women's polo, no pocket"], ['male', "Men's polo, left chest pocket"]],
      when: c => isPolo(c) && c.female },
    { key: 'poloName', label: 'Name embroidered in white thread', type: 'check', defaultValue: true,
      when: isPolo, off: c => poloPrint(c) ? POLO_PRINT : '' },
    { key: 'poloMark', label: 'Over the name', type: 'select',
      choices: [['badge', 'One badge (chosen under Badges)'], ['title', 'A duty title']],
      when: isPolo, off: c => poloPrint(c) ? POLO_PRINT : '' },
    { key: 'dutyTitle', label: 'Duty title', type: 'text',
      when: c => isPolo(c) && c.o.poloMark === 'title', off: c => poloPrint(c) ? POLO_PRINT : '' },
    { key: 'commandChief', label: 'Appointed Command Chief (ICL 25-02)', type: 'check',
      when: c => !c.g.cadet && State.rank === 'CMSgt' },
    { key: 'noGradeTrack', label: 'Working toward', type: 'select',
      choices: [['officer', 'Officer grade (1.4.1)'], ['nco', 'NCO grade (1.4.2)']],
      when: c => c.g.category === 'senior-none' },
    { key: 'sleeve', label: 'Sleeves', type: 'select',
      choices: [['short', 'Short sleeves'], ['long', 'Long sleeves']],
      when: c => ['blues_b', 'aviator', 'polo'].includes(c.u) },
    { key: 'femaleTop', label: 'Top', type: 'select',
      choices: [['shirt', 'Aviator shirt'], ['overblouse', 'White overblouse']],
      when: c => c.u === 'aviator' && c.female },
    { key: 'underlayer', label: 'Under the blazer', type: 'select',
      choices: c => {
        const list = [['shirt', c.female ? 'Shirt or blouse with tie tab' : 'Shirt and tie']];
        if(c.u === 'aviator_blazer') list.push(['turtleneck', 'Turtleneck']);
        if(c.female) list.push(['shell', 'White shell']);
        return list;
      },
      when: c => ['aviator_blazer', 'semi_formal'].includes(c.u) },
    { key: 'skirt', label: 'Skirt', type: 'select',
      choices: [['a-line', 'A-line skirt'], ['straight-split', 'Straight skirt with split']],
      when: c => c.u === 'mess_dress' && c.female },
    // The mess dress buttons (Ducky: "I use cap crest buttons, why no option for cap crest buttons"): 4.1.1.1 and 4.1.2.1 allow 'wing and star', CAP coat of arms or USAF coat of arms buttons;
    // the men's chain closure and shoulder-board buttons match the coat's (4.1.1.1, 4.1.1.1.1.1). The USAF coat of arms button is not drawn yet, so two designs are offered.
    { key: 'buttons', label: 'Buttons', type: 'select',
      choices: [['wing-star', 'Wing and star'], ['cap-crest', 'CAP coat of arms']],
      note: c => c.female ? 'Three on each side of the coat (CAPR 39-1, 4.1.2.1).' : 'The coat, the chain closure and the shoulder boards carry the same design (CAPR 39-1, 4.1.1.1, 4.1.1.1.1.1).',
      when: c => c.u === 'mess_dress' },
    { key: 'headgear', label: 'Headgear', type: 'select',
      choices: c => {
        if(FLIGHT.includes(c.u)) return [['auto', 'Flight cap'], ['none', 'No headgear']];
        // The field uniforms draw the cap worn, front and back: the patrol cap (the ABU cap, the OCP patrol cap, the Blue
        // Field Cap), the tactical cap (the navy tactical cap of the ABU and CFU, ICL 25-02 6.2.11; the OCP ball cap), and
        // the CFU's boonie hat.
        if(FIELD.includes(c.u)){
          const list = [['auto', 'Patrol cap'], ['tactical', 'Tactical cap']];
          if(c.u === 'corporate_field') list.push(['boonie', 'Boonie hat']);
          // The National Blue Beret (ICL 25-02 9.2.3: NBB graduates, with the ABU/OCP and the corporate field uniform at the unit level; LIVE13 E83).
          list.push(['beret', 'National Blue Beret (graduates, 9.2.3)']);
          list.push(['none', 'No headgear']);
          return list;
        }
        const list = [['auto', 'Flight cap']];
        const cadetEnlisted = c.g.cadet && c.g.category !== 'cadet-officer';
        if(!cadetEnlisted && c.g.category !== 'senior-none') list.push(['service', 'Service cap']);
        list.push(['none', 'No headgear']);
        return list;
      },
      when: c => ['blues_a', 'blues_b', 'flight_suit', ...FIELD].includes(c.u) },
    // The OCP patrol and tactical caps: officers' and cadet officers' grade "sewn or Velcro" centred 1/2 in from the visor (CAPR 39-1, 7.1.1.8). Sewn, with
    // 1/8 in of blue past the insignia, is the default; the hook-and-loop form is drawn as the 2 x 2 in square of the chest (LIVE13 E82).
    { key: 'capGrade', label: 'Cap grade', type: 'select',
      choices: [['sewn', 'Sewn, 1/8 in of blue showing (7.1.1.8)'], ['square', '2 x 2 in hook-and-loop square (7.1.1.8)']],
      when: c => c.u === 'ocp' && !!c.g.officer && !c.chaplain && !['none', 'beret'].includes(c.o.headgear || 'auto') },
    // The meme (Ethan: "i know it says that its 2 foot by 2 foot, but its wrong. its 2 inches. however just for the meme, we should add it"): ICL 26-14 7.1.1.2.1
    // reads "2' x 2'". Off by default; on draws the chest square 24 in across with the badge scaled to it. Not a regulation placement.
    { key: 'chaplainAsWritten', label: 'As written in ICL 26-14 (2 ft x 2 ft chaplain patch)', type: 'check', defaultValue: false,
      note: () => 'For the joke only: the letter says 2 feet, the regulation means 2 inches.',
      when: c => c.u === 'ocp' && !!c.chaplain },
    // The tie (men) or tie tab (women): worn with long sleeves, optional with short ones (data/uniform-rules.js tieRule, CAPR 39-1 4.1.11.1.1.3,
    // 4.1.12.4, 4.2.5.1.4, 4.2.6.3). The box starts at what the regulation requires for the sleeve length the member picked.
    { key: 'tie', label: c => c.female ? 'Tie tab' : 'Tie', type: 'check', defaultValue: c => tieOf(c).defaultOn,
      note: c => { const r = tieOf(c); return `Worn with long sleeves and optional with short sleeves (CAPR 39-1, ${r.para}).`; },
      when: c => tieOf(c).offered },
    // The tie clasp (CAPR 39-1 4.1.3.2.4, 4.1.11.1.1.3, 4.2.5.1.4): "may be worn with the tie", centred between the bottom of the knot and the tie's tip. Men's tie only
    // (the women's tab takes none), on the shirts when the member wears the tie; the Class A coat's closed front hides the tie below the lapels, so it has none.
    { key: 'tieClasp', label: 'Tie clasp', type: 'check', defaultValue: true,
      note: () => 'A tie tack or clasp may be worn with the tie, centered between the bottom of the knot and the tie\'s tip (CAPR 39-1 4.1.11.1.1.3).',
      when: c => !c.female && ['blues_b', 'aviator'].includes(c.u) && (typeof c.o.tie === 'boolean' ? c.o.tie : tieOf(c).defaultOn) },
    { key: 'chevron', label: 'Chevron size', type: 'select',
      choices: c => {
        // The default each uniform's paragraph names comes first.
        const four = ['4', '4 inch'], three = ['3.5', '3 1/2 inch'];
        return ['blues_b'].includes(c.u) ? [['', '3 1/2 inch'], four] : [['', '4 inch'], three];
      },
      // Men's Class B: 3 1/2 in only (4.1.11.1.1.1.3). Women's Class B, Class A and mess dress:
      // 3 1/2 or 4 in (4.1.12.2.3.3, 4.1.9.3.3).
      when: c => c.g.category === 'senior-nco' && (
        (c.female && ['blues_a', 'blues_b', 'mess_dress'].includes(c.u)) ||
        ['abu', 'corporate_field'].includes(c.u)) },
    // 7.1.1.3.1.3-4: with three or four badges the regulation allows a column (three) or two columns of two (four), or a pair on
    // the tape with the rest centred above it. The first form is the default (opt.badgeLayout 'pair' is the second).
    { key: 'badgeLayout', label: 'Chest badge layout', type: 'select',
      choices: c => [['column', c.chestBadges >= 4 ? 'Two columns of two' : 'Column'], ['pair', 'Two side by side']],
      when: c => FIELD.includes(c.u) && c.chestBadges >= 3 },
    // An optional add-on like the Class A headgear: off until the member adds the jacket (8.2.7, 8.3.7); opt.jacket reaches the build.
    { key: 'jacket', label: 'Flight jacket', type: 'check', defaultValue: false, when: c => FLIGHT.includes(c.u) },
    { key: 'scarf', label: 'Command scarf', type: 'check', when: c => FLIGHT.includes(c.u) },
    { key: 'esPatch', label: 'Emergency Services patch', type: 'select',
      choices: [['none', 'None'], ['style-1', 'ES patch'], ['style-2', 'ES patch (second style)']],
      when: c => FLIGHT.includes(c.u) || c.u === 'corporate_field' },
    { key: 'plateGrade', label: 'Grade on the nameplate', type: 'check', defaultValue: true,
      when: c => c.u === 'aviator_blazer' && !c.g.cadet && !!c.g.key }
  ];

  const KEYS = new Set(OPTIONS.map(o => o.key));
  const ALLOWED = {
    noGradeTrack: ['officer', 'nco'], sleeve: ['short', 'long'], femaleTop: ['shirt', 'overblouse'],
    underlayer: ['shirt', 'turtleneck', 'shell'], skirt: ['a-line', 'straight-split'], buttons: ['wing-star', 'cap-crest'],
    headgear: ['auto', 'service', 'tactical', 'boonie', 'beret', 'none'], chevron: ['', '3.5', '4'], badgeLayout: ['column', 'pair'], esPatch: ['none', 'style-1', 'style-2'],
    poloShirt: ['embroidered', 'print', 'tactical'], poloCut: ['', 'male'], poloMark: ['badge', 'title'], capGrade: ['sewn', 'square']
  };

  // Keep only values this panel could have produced (a saved setup is untrusted input).
  function sanitize(raw){
    const out = {};
    if(!raw || typeof raw !== 'object') return out;
    for(const k of Object.keys(raw)){
      if(!KEYS.has(k)) continue;
      const v = raw[k];
      if(ALLOWED[k]){ if(ALLOWED[k].includes(v)) out[k] = v; }
      else if(TEXT_MAX[k]){ if(typeof v === 'string') out[k] = v.replace(/[^A-Za-z0-9 .,'&\/()-]/g, '').slice(0, TEXT_MAX[k]); }
      else if(typeof v === 'boolean') out[k] = v;
    }
    return out;
  }

  function context(){
    return { u: State.uniform, female: State.gender === 'female', g: gradeOf(), chestBadges: chestBadgeCount(), chaplain: hasChaplainBadge(), o: State.garment || {} };
  }

  // The name block (Profile step) asks for every part up front, for every member: first name, last name and wing (the state or region line). This rule decides only
  // what the engraving shows. LIVE13 E131 (Doran: "it's not allowing first names... the corporate dress nameplate has first names. The polo lets me enter it"): CAPR 39-1 puts the first name on the
  // polo's embroidered name (5.3.2.1.1) and on the flight duty uniform tags (8.2.4.1, 8.3.4.1: "name (first and last)"); every other nametag, nameplate and tape reads the
  // last name only: the aviator shirt's nametag "the last name engraved" (4.2.5.1.2.1, 4.2.6.2.6.1), the Class A and B tags and the field uniforms' tapes the last name too.
  // 2 November 2026 (Ethan, on the corporate nameplate): the Corporate Service Dress nameplate (4.2.3.1.1.2, 4.2.4.1.1.2) takes the first name too, when one is entered, ahead of the last name; its
  // state, region or national line (the wing) is unchanged. Ethan, 3 November 2026: "in the beginning, ask for all parts (first last and wing)", so no field is hidden; the line under the fields says which
  // uniforms show the first name and what the chosen uniform shows.
  const FULL_NAME = ['polo', ...FLIGHT, 'aviator_blazer'];
  const FULL_NAME_PARA = { polo: '5.3.2.1.1', flight_suit: '8.2.4.1', corporate_flight_suit: '8.3.4.1', aviator_blazer: '4.2.3.1.1.2, 4.2.4.1.1.2' };
  const NAME_PARA = { semi_formal: 'no nametag, 4.2.1, 4.2.2', aviator: '4.2.5.1.2.1, 4.2.6.2.6.1', blues_a: '4.1.5.2.2.2, 4.1.9.4.2', blues_b: '4.1.11.1.1.2.1, 4.1.12.2.4', ocp: '7.1.1.2.3', abu: '5.1.1.1.2.1', corporate_field: '5.2.1.1.2.1', mess_dress: 'no nametag, 4.1.1.1.2.1' };
  function nameHint(u){
    const all = 'The first name is shown on the polo (5.3.2.1.1), the flight duty uniforms (8.2.4.1, 8.3.4.1) and the Corporate Service Dress nameplate (4.2.3.1.1.2, 4.2.4.1.1.2); every other uniform shows the last name only.';
    if(!u) return all;
    if(FULL_NAME.includes(u)) return `This uniform shows the first and last name (CAPR 39-1 ${FULL_NAME_PARA[u]}). ${all}`;
    return `This uniform shows the last name only${NAME_PARA[u] ? ' (CAPR 39-1 ' + NAME_PARA[u] + ')' : ''}. ${all}`;
  }
  // The three fields are always there; only the line under them follows the uniform.
  function syncNameFields(){
    const u = State.uniform;
    const first = document.getElementById('firstNameRow');
    const plate = document.getElementById('plateLineRow');
    if(first) first.hidden = false;
    if(plate) plate.hidden = false;
    const hint = document.getElementById('nameHint');
    if(hint) hint.textContent = nameHint(u);
  }

  let lastSignature = null;
  function render(force){
    syncNameFields();
    const host = document.getElementById('garmentOptions');
    const panel = document.getElementById('garmentOptionsPanel');
    if(!host || !panel || typeof CAPUBEngine === 'undefined') return;
    const c = context();
    const active = OPTIONS.filter(o => o.when(c));
    const g = State.garment || {};
    // The text in a text field is not part of the signature: typing must not rebuild the field being typed in.
    const signature = JSON.stringify([c.u, c.female, c.g.category, c.chestBadges, c.chaplain, active.map(o => o.key), g, ], (k, v) => TEXT_MAX[k] ? undefined : v);
    if(!force && signature === lastSignature) return;
    lastSignature = signature;
    host.textContent = '';
    panel.hidden = !active.length;
    for(const o of active){
      const id = 'garmentOpt-' + o.key;
      const row = document.createElement('div');
      row.className = 'garmentOption';
      const offNote = o.off ? o.off(c) : '';
      if(o.type === 'text'){
        const label = document.createElement('label');
        label.className = 'fieldLabel';
        label.htmlFor = id;
        label.textContent = labelOf(o, c);
        const input = document.createElement('input');
        input.id = id;
        input.type = 'text';
        input.maxLength = TEXT_MAX[o.key];
        input.autocomplete = 'off';
        input.value = g[o.key] || '';
        input.addEventListener('input', () => set(o.key, input.value, true));
        row.append(label, input);
        if(offNote) input.disabled = true;
      }else if(o.type === 'check'){
        const label = document.createElement('label');
        label.className = 'fieldNote';
        const box = document.createElement('input');
        box.type = 'checkbox';
        box.id = id;
        box.checked = g[o.key] == null ? !!(typeof o.defaultValue === 'function' ? o.defaultValue(c) : o.defaultValue) : !!g[o.key];
        box.addEventListener('change', () => set(o.key, box.checked));
        if(offNote) box.disabled = true;
        label.append(box, ' ' + labelOf(o, c));
        row.append(label);
      }else{
        const label = document.createElement('label');
        label.className = 'fieldLabel';
        label.htmlFor = id;
        label.textContent = labelOf(o, c);
        const sel = document.createElement('select');
        sel.id = id;
        const choices = typeof o.choices === 'function' ? o.choices(c) : o.choices;
        for(const [value, text] of choices){
          const opt = document.createElement('option');
          opt.value = value;
          opt.textContent = text;
          sel.append(opt);
        }
        const current = g[o.key];
        sel.value = choices.some(([v]) => v === current) ? current : choices[0][0];
        sel.addEventListener('change', () => set(o.key, sel.value));
        if(offNote) sel.disabled = true;
        row.append(label, sel);
      }
      if(o.note){
        const hint = document.createElement('div');
        hint.className = 'fieldNote';
        hint.textContent = o.note(c);
        row.append(hint);
      }
      if(offNote){
        const note = document.createElement('div');
        note.className = 'fieldNote';
        note.textContent = offNote;
        row.append(note);
      }
      host.append(row);
    }
  }

  const labelOf = (o, c) => typeof o.label === 'function' ? o.label(c) : o.label;

  function set(key, value, typing){
    State.garment = Object.assign({}, State.garment || {}, { [key]: value });
    if(typeof fullRender === 'function') fullRender();
    if(!typing) render();
  }

  document.addEventListener('capub:rendered', () => render());
  window.CAPUBGarmentOptions = { OPTIONS, sanitize, render, nameHint, FULL_NAME };
})();
