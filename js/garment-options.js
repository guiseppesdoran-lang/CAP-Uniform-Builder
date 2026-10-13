// Choices about the garment itself: sleeve length, the women's aviator top, what is worn under the
// blazer, the mess dress skirt, headgear, chevron size, the flight jacket and scarf, the ES patch.
// Each option is offered only on the uniforms (and for the members) it applies to, and is kept in
// State.garment. The uniform engine reads them through js/uniform-view.js.
(function(){
  'use strict';

  function gradeOf(){
    return CAPUBEngine.grades.gradeInfo(State.membership, State.rank, {});
  }
  const FLIGHT = ['flight_suit', 'corporate_flight_suit'];

  // { key, label, type: 'select' | 'check', choices: [[value, label]] | fn, when(ctx) }
  const OPTIONS = [
    { key: 'noGradeTrack', label: 'Working toward', type: 'select',
      choices: [['officer', 'Officer grade (1.4.1)'], ['nco', 'NCO grade (1.4.2)']],
      when: c => c.g.category === 'senior-none' },
    { key: 'sleeve', label: 'Sleeves', type: 'select',
      choices: [['short', 'Short sleeves'], ['long', 'Long sleeves']],
      when: c => ['blues_b', 'aviator'].includes(c.u) },
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
    { key: 'headgear', label: 'Headgear', type: 'select',
      choices: c => {
        if(FLIGHT.includes(c.u)) return [['auto', 'Flight cap'], ['none', 'No headgear']];
        const list = [['auto', 'Flight cap']];
        const cadetEnlisted = c.g.cadet && c.g.category !== 'cadet-officer';
        if(!cadetEnlisted && c.g.category !== 'senior-none') list.push(['service', 'Service cap']);
        list.push(['none', 'No headgear']);
        return list;
      },
      when: c => ['blues_a', 'blues_b', 'flight_suit'].includes(c.u) },
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
    { key: 'jacket', label: 'Show the flight jacket too', type: 'check', defaultValue: true, when: c => FLIGHT.includes(c.u) },
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
    underlayer: ['shirt', 'turtleneck', 'shell'], skirt: ['a-line', 'straight-split'],
    headgear: ['auto', 'service', 'none'], chevron: ['', '3.5', '4'], esPatch: ['none', 'style-1', 'style-2']
  };

  // Keep only values this panel could have produced (a saved setup is untrusted input).
  function sanitize(raw){
    const out = {};
    if(!raw || typeof raw !== 'object') return out;
    for(const k of Object.keys(raw)){
      if(!KEYS.has(k)) continue;
      const v = raw[k];
      if(ALLOWED[k]){ if(ALLOWED[k].includes(v)) out[k] = v; }
      else if(typeof v === 'boolean') out[k] = v;
    }
    return out;
  }

  function context(){
    return { u: State.uniform, female: State.gender === 'female', g: gradeOf() };
  }

  let lastSignature = null;
  function render(force){
    const host = document.getElementById('garmentOptions');
    const panel = document.getElementById('garmentOptionsPanel');
    if(!host || !panel || typeof CAPUBEngine === 'undefined') return;
    const c = context();
    const active = OPTIONS.filter(o => o.when(c));
    const g = State.garment || {};
    const signature = JSON.stringify([c.u, c.female, c.g.category, active.map(o => o.key), g]);
    if(!force && signature === lastSignature) return;
    lastSignature = signature;
    host.textContent = '';
    panel.hidden = !active.length;
    for(const o of active){
      const id = 'garmentOpt-' + o.key;
      const row = document.createElement('div');
      row.className = 'garmentOption';
      if(o.type === 'check'){
        const label = document.createElement('label');
        label.className = 'fieldNote';
        const box = document.createElement('input');
        box.type = 'checkbox';
        box.id = id;
        box.checked = g[o.key] == null ? !!o.defaultValue : !!g[o.key];
        box.addEventListener('change', () => set(o.key, box.checked));
        label.append(box, ' ' + o.label);
        row.append(label);
      }else{
        const label = document.createElement('label');
        label.className = 'fieldLabel';
        label.htmlFor = id;
        label.textContent = o.label;
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
        row.append(label, sel);
      }
      host.append(row);
    }
  }

  function set(key, value){
    State.garment = Object.assign({}, State.garment || {}, { [key]: value });
    if(typeof fullRender === 'function') fullRender();
    render();
  }

  document.addEventListener('capub:rendered', () => render());
  window.CAPUBGarmentOptions = { OPTIONS, sanitize, render };
})();
