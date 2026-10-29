/* CAP Uniform Builder: Shopping list & cost.
   The list is derived from the uniform as drawn: every piece of the composed scene (CAPUBUniformView.scene, keyed as
   js/engine/compose.js keys its layers) becomes a line, together with the garment pieces each base sheet stands for
   (trousers, belt, footwear, undershirt...) by CAPR 39-1. Prices and links come from purchase-catalog.js. A piece the
   catalog does not know still gets a line, with vendor searches and "no price", so a new piece appears without a hand list.
   In Node, require() returns the derivation (deriveList, toText, toCSV) for the tests; in the page it also draws the dialog.
*/
(function(root, factory){
  const node = typeof module === 'object' && module.exports;
  const C = node ? require('./purchase-catalog.js') : root && root.CAPUB_PURCHASE_CATALOG;
  if(!C){ if(root && root.console) root.console.warn('CAPUB Purchase feature: purchase catalog not loaded.'); return; }
  const api = factory(C, root, !node);
  if(node) module.exports = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function(C, root, inPage){
  'use strict';

  // ---- helpers ------------------------------------------------------------------------------------------------
  const money = n => Number.isFinite(Number(n)) ? `$${Number(n).toFixed(2)}` : 'no price';
  const titleCase = s => String(s || '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/\b\w/g, c => c.toUpperCase());
  const sentence = s => { s = String(s || ''); return s ? s[0].toUpperCase() + s.slice(1) : s; };
  const vendorName = v => (C.vendors[v] && C.vendors[v].name) || titleCase(v);
  const GROUP_ORDER = ['Garments', 'Headgear', 'Footwear', 'Accessories', 'Name', 'Grade', 'Insignia', 'Ribbons', 'Miniature medals', 'Badges', 'Cords', 'Patches', 'Other'];
  const SKIP_ROLES = new Set(['measure', 'clear', 'surface', 'hat-view-bounds', 'epaulet-shade']);

  // A layer the member would buy something for: drawn art or text (not the overlay's measures, keep-clear boxes and shading).
  function drawnLayer(l){
    return !!l && !SKIP_ROLES.has(l.role) && (l.type === 'asset' || l.type === 'raster' || l.type === 'text');
  }

  // The grade name from an artwork id: rank-cadet-officer-captain-metal-miniature -> C/Capt.
  function gradeFromAsset(id){
    const s = String(id || '');
    const cadet = /^rank-cadet-|-cadet-/.test(s);
    const keys = Object.keys(C.GRADE_NAMES).sort((a, b) => b.length - a.length);
    const k = keys.find(key => new RegExp(`(^|-)${key}(-|$)`).test(s.replace(/^rank-(cadet-(nco|officer)-|senior-|epaulet-sleeve-(gray|blue-cadet)-)/, '')));
    if(!k) return '';
    const fs = /first-sergeant/.test(s) ? ' (First Sergeant)' : '';
    return (cadet ? 'C/' : '') + C.GRADE_NAMES[k] + fs;
  }
  function gradeForm(id){
    const s = String(id || '');
    if(/-ocp-square/.test(s)) return 'OCP hook-and-loop';
    if(/-cloth-bordered-miniature/.test(s)) return 'cloth, miniature';
    if(/-cloth-bordered/.test(s)) return 'cloth';
    if(/-metal-miniature/.test(s)) return 'metal, miniature';
    if(/-metal-regular|-metal$/.test(s)) return 'metal, regular size';
    if(/-chevron-white-(\d)p5in/.test(s)) return `white chevrons, ${s.match(/(\d)p5in/)[1]} 1/2 in`;
    if(/-chevron-white-(\d)in/.test(s)) return `white chevrons, ${s.match(/(\d)in$/)[1]} in`;
    if(/-chevron-(\d)p5in/.test(s)) return `chevrons, ${s.match(/(\d)p5in/)[1]} 1/2 in`;
    if(/-chevron-(\d)in/.test(s)) return `chevrons, ${s.match(/(\d)in$/)[1]} in`;
    if(/-thread/.test(s)) return 'embroidered';
    if(/-bullion/.test(s)) return 'bullion';
    return '';
  }
  // The physical piece a grade layer is: the edge-on and top views of one epaulet are one piece, the flat sleeve the same chevron.
  function piecePosition(key){
    return String(key || '').replace(/^(grade|collar|hat-device):/, '').replace(/^(edge-|top-|flat-)/, '').replace(/:edge$/, '');
  }

  // ---- the garments each base sheet stands for ------------------------------------------------------------------
  // [catalog item, extra] in the order the member dresses; `when(ctx)` limits a piece (the tie when the sheet shows it).
  function hides(layer, group){ return (layer.hideGroups || []).includes(group); }
  function sheetRecipe(id, build, layer, scene){
    const female = /-female/.test(id);
    const uniform = build.uniform;
    const officerCoat = scene.layers.some(l => /-(senior|general)-officer$/.test(l.id || ''));
    const out = [];
    const add = (itemId, extra) => out.push([itemId, extra || {}]);
    const tieShown = !hides(layer, 'tie') && !hides(layer, 'tie-tab');
    if(/^garment-blues-class-a-coat(-female)?$/.test(id)){
      add(`service_coat_${officerCoat ? 'officer' : 'enlisted'}_${female ? 'female' : 'male'}`, { detail: officerCoat ? 'Officer style, with epaulets' : 'Without epaulets' });
      add(female ? 'blouse_blue_long_female' : 'shirt_blue_long_male', { detail: 'Worn under the coat' });
      if(female){ add('blue_tie_tab'); add('slacks_blue_female'); }
      else { add('blue_tie'); add('trousers_blue_male'); add('undershirt_white', { ref: '4.1.6' }); }
      add('blue_belt');
      add('low_quarters', { ref: female ? '4.1.9.11' : '4.1.6.6' });
      add(female ? 'socks_or_hosiery' : 'socks_black', { ref: female ? '4.1.9.11' : '4.1.6.6' });
    }else if(/^garment-semiformal-class-a-coat-(male|female)$/.test(id)){
      add(`service_coat_enlisted_${female ? 'female' : 'male'}`, { detail: 'Worn without the nametag (4.1.3.2.1)' });
      if(female){ add('white_blouse_semiformal_female'); add('blue_satin_tie_tab', { ref: '4.1.4.4' }); add('slacks_blue_female'); add('socks_or_hosiery'); }
      else { add('white_shirt_semiformal_male'); add('blue_tie', { ref: '4.1.3.2.4' }); add('undershirt_white', { ref: '4.1.3.2.3' }); add('trousers_blue_male'); add('socks_black', { ref: '4.1.3.2.5' }); }
      add('blue_belt');
      add('low_quarters', { ref: female ? '4.1.9.11' : '4.1.3.2.5' });
    }else if(/^garment-blues-class-b-(shirt-male|blouse-female)(-long)?$/.test(id)){
      const long = /-long$/.test(id);
      add(female ? `blouse_blue_${long ? 'long' : 'short'}_female` : `shirt_blue_${long ? 'long' : 'short'}_male`);
      if(tieShown) add(female ? 'blue_tie_tab' : 'blue_tie', { ref: female ? '4.1.12.4' : '4.1.11.1.1.3' });
      if(!female) add('undershirt_white', { ref: '4.1.11.1.1' });
      add(female ? 'slacks_blue_female' : 'trousers_blue_male');
      add('blue_belt', { ref: female ? '4.1.12.7' : '4.1.11.1.1.5' });
      add('low_quarters', { ref: female ? '4.1.12.8' : '4.1.11.1.1.6' });
      add(female ? 'socks_or_hosiery' : 'socks_black', { ref: female ? '4.1.12.8' : '4.1.11.1.1.6' });
    }else if(/^garment-mess-dress-(male|female)$/.test(id)){
      const buttons = (build.opt && build.opt.buttons) === 'cap-crest' ? 'mess_buttons_cap_crest' : 'mess_buttons_wing_star';
      if(female){
        add('mess_coat_female'); add(buttons, { ref: '4.1.2.1' }); add('mess_blouse_female'); add('blue_satin_tie_tab', { ref: '4.1.2.2.1' }); add('mess_cummerbund', { ref: '4.1.2.2.4' });
        add('pumps_black', { ref: '4.1.2.4' }); add('hosiery', { ref: '4.1.2.4' });
      }else{
        add('mess_coat_male'); add(buttons, { ref: '4.1.1.1' }); add('mess_shirt_male'); add('undershirt_white', { ref: '4.1.1.2' }); add('mess_cuff_links'); add('mess_studs');
        add('mess_bow_tie'); add('mess_trousers_male'); add('mess_suspenders'); add('mess_cummerbund');
        add('low_quarters', { ref: '4.1.1.4' }); add('socks_black', { ref: '4.1.1.4' });
      }
    }else if(/^garment-corporate-service-dress-blazer-(male|female)$/.test(id)){
      const semi = uniform === 'semi_formal';
      const under = build.opt && build.opt.underlayer;
      add(female ? 'corporate_blazer_female' : 'corporate_blazer_male', { ref: female ? '4.2.4.1' : '4.2.3.1' });
      const shirtBeside = scene.layers.some(l => l.role === 'garment' && /^garment-aviator-shirt-/.test(l.id || ''));
      // The CAP Crest on the left breast pocket is part of the sheet (group cap-crest) unless a badge takes its place (4.2.3.1.1.1).
      if(!hides(layer, 'cap-crest')) add('cap_crest', { detail: 'Left breast pocket', ref: female ? '4.2.4.1.1.1' : '4.2.3.1.1.1' });
      if(under !== 'turtleneck' && under !== 'shell' && !shirtBeside) add('white_dress_shirt', { ref: semi ? (female ? '4.2.2.2' : '4.2.1.2') : (female ? '4.2.4.2' : '4.2.3.2') });
      if(!semi && !female && tieShown) add('blue_tie', { ref: '4.2.3.4', note: 'The CAP regimental tie is also authorized with this uniform (4.2.3.4).', alt: 'cap_regimental_tie' });
      if(female && tieShown && under !== 'shell') add('blue_tie_tab', { ref: semi ? '4.2.2.3' : '4.2.4.3' });
      add(female ? 'gray_slacks_female' : 'gray_trousers', { ref: female ? '4.2.4.4' : '4.2.3.3' });
      add('black_belt', { ref: female ? '4.2.4.6' : '4.2.3.5' });
      add(female && semi ? 'pumps_black' : 'black_plain_shoes', { ref: semi ? (female ? '4.2.2.6' : '4.2.1.6') : (female ? '4.2.4.7' : '4.2.3.6') });
      add(female ? 'socks_or_hosiery' : 'socks_black', { ref: semi ? (female ? '4.2.2.6' : '4.2.1.6') : (female ? '4.2.4.7' : '4.2.3.6') });
    }else if(/^garment-aviator-shirt-(male|female)(-long)?$/.test(id)){
      const long = /-long$/.test(id);
      add(`aviator_shirt_${long ? 'long' : 'short'}_${female ? 'female' : 'male'}`, { ref: female ? '4.2.6.1' : '4.2.5.1' });
      if(tieShown) add(female ? 'blue_tie_tab' : 'blue_tie', { ref: female ? '4.2.6.3' : '4.2.5.1.4' });
      if(!female) add('undershirt_white', { ref: '4.2.5.1.9' });
      add(female ? 'gray_slacks_female' : 'gray_trousers', { ref: female ? '4.2.6.4' : '4.2.5.1.5' });
      add('black_belt', { ref: female ? '4.2.6.6' : '4.2.5.1.6' });
      add('black_plain_shoes', { ref: female ? '4.2.6.7' : '4.2.5.1.7' });
      add(female ? 'socks_or_hosiery' : 'socks_black', { ref: female ? '4.2.6.7' : '4.2.5.1.9' });
    }else if(/^garment-overblouse-female(-long)?$/.test(id)){
      add('overblouse_female', { detail: /-long$/.test(id) ? 'Long sleeve' : 'Short sleeve', ref: '4.2.6.1' });
      add('gray_slacks_female', { ref: '4.2.6.4' }); add('black_plain_shoes', { ref: '4.2.6.7' }); add('socks_or_hosiery', { ref: '4.2.6.7' });
    }else if(/^garment-polo-(male|female)(-long)?$/.test(id)){
      const shirt = (build.opt && build.opt.poloShirt) || 'embroidered';
      add(shirt === 'print' ? 'polo_knit_print' : shirt === 'tactical' ? 'polo_tactical' : 'polo_knit_embroidered', { detail: /-long$/.test(id) ? 'Long sleeve' : 'Short sleeve' });
      add(female ? 'gray_slacks_female' : 'gray_trousers', { ref: '5.3.3' }); add('black_belt', { ref: '5.3.5' }); add('black_plain_shoes', { ref: '5.3.6' }); add('socks_black', { ref: '5.3.6' });
    }else if(id === 'garment-ocp-coat-abu-cut'){
      add('ocp_coat'); add('ocp_trousers'); add('tshirt_coyote'); add('tan_rigger_belt'); add('boots_coyote'); add('socks_coyote');
      add('ocp_name_tape', { name: true }); add('ocp_cap_tape'); add('us_flag_patch_ocp'); add('aux_patch_ocp');
    }else if(id === 'garment-abu-coat'){
      add('abu_coat'); add('abu_trousers'); add('tshirt_desert_tan'); add('desert_tan_belt'); add('combat_boots_black', { ref: '5.1.1.5' }); add('socks_black', { ref: '5.1.1.5' });
      add('abu_name_tape', { name: true }); add('abu_cap_tape');
    }else if(id === 'garment-cfu-coat'){
      add('cfu_shirt'); add('cfu_trousers'); add('tshirt_black_or_tan', { ref: female ? '5.2.1.3.2' : '5.2.1.3.1' }); add('blue_black_web_belt');
      add('combat_boots_black', { ref: '5.2.1.2.2', note: 'Black shoes are also authorized (5.2.1.2.2).' }); add('socks_black', { ref: '5.2.1.2.2' });
      add('cfu_name_tape', { name: true }); add('cfu_cap_tape');
    }else if(id === 'garment-fdu-flight-suit'){
      add('fdu_flight_suit'); add('tshirt_desert_tan', { ref: '8.2.9' }); add('combat_boots_black', { ref: '8.2.11' }); add('socks_fdu');
      add('command_patch'); add('us_flag_patch_flight');
    }else if(id === 'garment-cfdu-flight-suit'){
      add('cfdu_flight_suit'); add('tshirt_black_or_tan', { ref: '8.3.9' }); add('black_plain_shoes', { ref: '8.3.11' }); add('socks_black', { ref: '8.3.10' });
      add('command_patch', { ref: '8.3.4.2' }); add('us_flag_patch_flight', { ref: '8.3.4.4' });
    }else if(id === 'garment-flight-jacket-green') add('flight_jacket_green');
    else if(id === 'garment-flight-jacket-blue') add('flight_jacket_blue');
    return out;
  }

  // The cap a field sheet draws as one of its own groups, by the group the profile shows.
  function fieldCap(uniform, group){
    if(/^hat-patrol/.test(group)) return { ocp: 'ocp_patrol_cap', abu: 'abu_patrol_cap', corporate_field: 'blue_field_cap' }[uniform] || 'blue_field_cap';
    if(/^hat-ball/.test(group)) return uniform === 'ocp' ? 'ocp_tactical_cap' : 'navy_tactical_cap';
    if(/^hat-boonie/.test(group)) return 'boonie_hat_blue';
    return null;
  }
  function hatItem(id){
    const m = /^hat-(flight|service)-cap-(?:(men|women)-)?(.+)$/.exec(id);
    if(m){
      const female = m[2] === 'women' || (!m[2] && m[1] === 'flight');
      if(m[1] === 'flight'){
        if(m[3] === 'general') return ['flight_cap_general', {}];
        return [`flight_cap_${m[3] === 'officer' ? 'officer' : 'enlisted'}_${female ? 'female' : 'male'}`, {}];
      }
      return [female ? 'service_cap_female' : 'service_cap_male', { detail: { 'cadet-officer': 'Cadet officer visor', 'field-grade': 'Field grade visor (clouds and darts)', general: 'General officer visor', 'officer-nco': 'Plain visor' }[m[3]] || '' }];
    }
    if(/^hat-baseball-cap/.test(id)) return ['baseball_cap_blue', {}];
    return null;
  }
  const CAP_DEVICES = { 'cap-device-nco-flight': 'cap_device_nco_flight', 'cap-device-nco-senior': 'cap_device_nco_senior', 'cap-device-officer-flight': 'cap_device_officer_flight', 'cap-device-officer-service': 'cap_device_officer_service', 'cap-device-cadet-officer-service': 'cap_device_cadet_officer_service' };

  // ---- the list ---------------------------------------------------------------------------------------------------
  // scene: the composed scene; build: CAPUBUniformView.buildFromState(); env: { badges: CAPUBBadgeCatalog }.
  // Returns { lines, coverage: {layerKey -> lineKey}, uncovered: [layerKey], title }.
  function deriveList(scene, build, env){
    env = env || {};
    const B = env.badges || (root && root.CAPUBBadgeCatalog) || null;
    const lines = new Map();
    const coverage = {};
    build = build || {};
    if(!scene || !Array.isArray(scene.layers)) return { lines: [], coverage, uncovered: [], title: '' };
    const layers = scene.layers;
    const figPrefix = l => l.figure === 2 ? 'fig2:' : '';
    // The second figure is a separate garment the member also buys pieces for (the flight jacket, the shirt under the blazer).
    const fig2Base = layers.find(l => l.role === 'garment' && l.figure === 2);
    const fig2Label = fig2Base ? (/flight-jacket/.test(fig2Base.id) ? 'flight jacket' : /aviator-shirt/.test(fig2Base.id) ? 'shirt worn under the blazer' : 'second figure') : 'second figure';
    const figName = l => l.figure === 2 ? ` (for the ${fig2Label})` : '';
    const lkey = l => figPrefix(l) + (l.key || '');

    function makeLine(key, base){
      if(lines.has(key)) return lines.get(key);
      const line = Object.assign({ key, group: 'Other', name: '', detail: '', qty: 1, rule: 'VERIFY', ref: '', note: '', offers: [], layers: [] }, base);
      lines.set(key, line);
      return line;
    }
    function fromItem(itemId, extra, key){
      const it = C.items[itemId];
      if(!it) return makeLine(key || 'item:' + itemId, Object.assign({ group: 'Other', name: titleCase(itemId), offers: C.searchOnly() }, extra));
      const line = makeLine(key || 'item:' + itemId, { group: it.group, name: it.name, rule: it.rule, ref: it.ref || '', note: it.note || '', q: it.q, offers: it.offers.map(o => Object.assign({}, o)), itemId });
      if(it.notSold){ line.notSold = true; line.offers = []; }
      if(extra){
        for(const k of ['detail', 'ref', 'note']) if(extra[k] && !line[k + 'Set']){ line[k] = extra[k]; line[k + 'Set'] = true; }
        if(extra.alt && C.items[extra.alt]) line.alt = extra.alt;
      }
      return line;
    }
    const cover = (layer, line) => { if(!line) return; coverage[lkey(layer)] = line.key; if(!line.layers.includes(lkey(layer))) line.layers.push(lkey(layer)); };
    const firstLine = pred => [...lines.values()].find(pred);

    // Base sheets first: the garments and the pieces they draw themselves (tapes, sheet patches).
    const baseLine = new Map();
    for(const l of layers){
      if(l.role !== 'garment' || !l.id) continue;
      const recipe = sheetRecipe(l.id, build, l, scene);
      let main = null;
      recipe.forEach(([itemId, extra], i) => {
        const line = fromItem(itemId, extra);
        if(extra.name) line.nameCarrier = true;
        if(i === 0) main = line;
      });
      if(!main) main = makeLine('sheet:' + l.id, { group: 'Garments', name: titleCase(l.id.replace(/^garment-/, '')), offers: C.searchOnly(), q: titleCase(l.id.replace(/^garment-/, '')) });
      baseLine.set(l.figure === 2 ? 2 : 1, main);
      cover(l, main);
    }
    const baseOf = l => baseLine.get(l.figure === 2 ? 2 : 1) || baseLine.get(1);

    const grades = new Map();   // asset -> Set(positions)
    const devices = new Map();  // owner line key -> Map(asset -> count)
    const racks = new Map();    // figure -> { ribbons, rows }
    let miniCount = 0;

    for(const l of layers){
      if(!drawnLayer(l) || coverage[lkey(l)]) continue;
      const id = l.id || '';
      const key = l.key || '';
      const role = l.role;

      // The base sheet drawn again (collar or lapel over the badges), its flat sleeves and its own polo overlays.
      if(role === 'garment-foreground' || role === 'sleeve-flat' || /-lapel-foreground$/.test(id) || /-epaulet-plain$/.test(id) || /^garment-polo-.*-(tactical|seal-print)$/.test(id) || role === 'seal'){
        cover(l, baseOf(l)); continue;
      }
      if(role === 'underlayer'){ cover(l, fromItem(/turtleneck/.test(id) ? 'turtleneck_white' : 'shell_white_female')); continue; }
      if(/^garment-mess-dress-skirt-female-(a-line|straight-split)$/.test(id)){ cover(l, fromItem(/straight/.test(id) ? 'mess_skirt_straight_split' : 'mess_skirt_a_line')); continue; }

      // Name: the plate or tag, and the text engraved or embroidered on it.
      if(role === 'nametag' || /-nametag-(cadet|adult|officer-nco)$/.test(id)){
        let itemId = 'nametag_gray_adult';
        if(/nametag-cadet$|nameplate-3line-cadet/.test(id)) itemId = 'nametag_blue_cadet';
        else if(/nameplate-blazer/.test(id)) itemId = 'nametag_black_blazer';
        else if(/nametag-flight-embroidered/.test(id)) itemId = 'nametag_flight_embroidered';
        else if(/leather/.test(id)) itemId = 'nametag_flight_leather';
        const line = fromItem(itemId, null, figPrefix(l) + 'item:' + itemId);
        if(l.figure === 2) line.detail = `For the ${fig2Label}`;
        line.nameCarrier = true;
        cover(l, line); continue;
      }
      if(l.type === 'text'){
        let line = null;
        const fig = l.figure === 2;
        const sameFig = x => (x.key.startsWith('fig2:')) === fig;
        if(key === 'text:polo-name') line = fromItem('polo_name_embroidery');
        else if(key === 'text:polo-title') line = fromItem('polo_title_embroidery');
        else if(/cap_back_name_tape|cap.*name_tape/.test(key)) line = fromItem('cap_name_tape');
        else line = firstLine(x => x.nameCarrier && sameFig(x)) || firstLine(x => x.nameCarrier);
        if(!line) line = makeLine('name:text', { group: 'Name', name: 'Name lettering', offers: C.searchOnly(), q: 'Civil Air Patrol nametag', rule: 'CAP_ONLY' });
        const text = String(l.text || '').trim();
        if(text){
          line.texts = line.texts || [];
          if(!line.texts.includes(text)) line.texts.push(text);
        }
        cover(l, line); continue;
      }

      // Headgear and what is worn on it.
      if(role === 'hat' || role === 'hat-view'){
        let itemId = null, extra = {};
        if(/^hat-/.test(id)) [itemId, extra] = hatItem(id) || [null, {}];
        else itemId = fieldCap(build.uniform, key.replace(/^hat(-view)?:/, ''));
        const line = itemId ? fromItem(itemId, extra) : makeLine('hat:' + id, { group: 'Headgear', name: l.title || titleCase(id), offers: C.searchOnly() });
        cover(l, line);
        if((l.onlyGroups || []).some(g => /name-tape/.test(g))) fromItem('cap_name_tape');
        continue;
      }
      if(role === 'hat-device' && CAP_DEVICES[id]){ cover(l, fromItem(CAP_DEVICES[id])); continue; }

      // Epaulet sleeves, shoulder boards and their carriers' grade.
      if(['epaulet', 'epaulet-top', 'epaulet-edge'].includes(role) || /-epaulet-sleeve-(cadet-officer|officer)$/.test(id)){
        let line;
        if(/^garment-blues-shoulder-board-top-(male|female)/.test(id) || /^garment-blues-class-a-cadet-officer-board/.test(id)) line = fromItem(/female/.test(id) ? 'cadet_officer_boards_female' : 'cadet_officer_boards_male');
        else if(/^garment-mess-dress-(male|female)-(general-)?officer-shoulder-boards$/.test(id)){
          const bullion = layers.find(x => x.role === 'grade' && /-bullion$/.test(x.id || ''));
          const grade = bullion ? gradeFromAsset(bullion.id) : '';
          line = makeLine('mess-boards', { group: 'Grade', name: `CAP mess dress shoulder boards${grade ? ', ' + grade : ''}`, detail: 'Grade in bullion; buttons to match the coat (4.1.1.1.1.1)', rule: 'CAP_ONLY', ref: '4.1.1.1.1.1', offers: C.gradeOffers('mess-board', grade, 'mess dress shoulder board') });
        }else if(/^rank-epaulet-sleeve-blue-cadet/.test(id) || /-epaulet-sleeve-cadet-officer$/.test(id)) line = fromItem('cadet_epaulet_sleeves_blank', { detail: 'Worn with the miniature metal grade below' });
        else if(/^rank-epaulet-sleeve-gray-/.test(id) || /-epaulet-sleeve-officer$/.test(id)){
          const g = gradeFromAsset(id) || '';
          line = makeLine('epaulets-gray', { group: 'Grade', name: `CAP gray epaulet sleeves${g && !/blank/.test(id) ? ', ' + g : ''}`, detail: 'Grade embroidered (4.1.11.1.1.1.1)', rule: 'CAP_ONLY', ref: '4.1.5.2.1.1', offers: C.gradeOffers('epaulet', g, 'gray epaulet shoulder mark'), q: `Civil Air Patrol ${g} gray epaulet` });
        }else line = makeLine('epaulet:' + id, { group: 'Grade', name: l.title ? l.title.replace(/^(Right|Left) /, '') : titleCase(id), offers: C.searchOnly(), q: titleCase(id) });
        line.carrier = true;
        cover(l, line); continue;
      }

      // Grade pieces. Embroidered and bullion grade on an epaulet, board or plate is part of that carrier.
      if(role === 'grade' || (role === 'hat-device' && /^rank-/.test(id))){
        if(/^collar-insignia-cap-(metal|cloth)$/.test(id)){ cover(l, fromItem(/cloth/.test(id) ? 'cap_collar_cloth' : 'cap_collar_metal')); continue; }
        if(/-(thread|bullion)(-|$)/.test(id) && /^grade:(edge-|top-|plate)/.test(key)){
          const carrier = key === 'grade:plate' ? firstLine(x => x.itemId === 'nametag_black_blazer') : (firstLine(x => x.carrier && x.key === 'mess-boards') || firstLine(x => x.carrier));
          if(carrier){ if(key === 'grade:plate') carrier.detail = `With grade insignia (${gradeFromAsset(id)})`; cover(l, carrier); continue; }
        }
        const gkey = figPrefix(l) + 'grade:' + id;
        if(!grades.has(gkey)) grades.set(gkey, { id, layer: l, positions: new Set() });
        grades.get(gkey).positions.add(role === 'hat-device' ? 'cap' : piecePosition(key));
        const g = gradeFromAsset(id), form = gradeForm(id);
        const kind = /^rank-cadet-nco/.test(id) ? 'cadet-nco' : /^rank-cadet-officer/.test(id) ? 'cadet-officer' : /chevron/.test(id) ? 'senior-nco' : 'senior';
        const line = makeLine(gkey, { group: 'Grade', name: `${kind === 'senior-nco' || kind === 'cadet-nco' ? 'Grade chevrons' : 'Grade insignia'}: ${g || titleCase(id)}${figName(l)}`, detail: form ? sentence(form) : '', rule: 'CAP_ONLY', ref: '', offers: C.gradeOffers(kind, g, form) });
        cover(l, line); continue;
      }

      // Lapel and collar insignia, braid and the coat's officer overlay.
      if(/-lapel-us$/.test(id)){ cover(l, fromItem('us_insignia_officer')); continue; }
      if(/-lapel-us-nco$|-senior-nco-lapel$/.test(id)){ cover(l, fromItem('us_insignia_nco')); continue; }
      if(/-lapel-cap$|-cadet-officer-insignia(-female)?$/.test(id)){ cover(l, fromItem('cap_lapel_insignia', { ref: '4.1.5.2.2.1.2' })); continue; }
      if(/^garment-blues-class-a-coat(-female)?-(senior|general)-officer$/.test(id)){ cover(l, baseOf(l)); continue; }
      if(/-sleeve-braid$/.test(id)){ cover(l, fromItem('mess_sleeve_braid', { detail: /general/.test(id) ? 'General officer' : 'Officer' })); continue; }
      if(/-general-officer-buckle$/.test(id)){ cover(l, fromItem('general_officer_buckle')); continue; }

      // Neckwear placed on its own (the semi-formal's bow tie) and the flight scarf.
      if(role === 'tie'){ cover(l, fromItem(/bow/.test(id) ? 'black_bow_tie' : /tab/.test(id) ? 'blue_tie_tab' : /tack|clasp/.test(id) ? 'tie_tack' : 'blue_tie')); continue; }
      if(role === 'scarf'){ cover(l, fromItem('command_scarf')); continue; }

      // Cords.
      const cordMatch = /(?:^|-)cord-([a-z-]+)$/.exec(id);
      if(role === 'cord' || cordMatch){
        const ck = (cordMatch && cordMatch[1]) || String(id).replace(/^cord-/, '');
        const info = C.cordInfo(ck);
        cover(l, makeLine('cord:' + ck, { group: 'Cords', name: info.name, rule: ck === 'aide-de-camp' ? 'MILSPEC_OK' : 'CAP_ONLY', ref: '9.3', offers: info.offers }));
        continue;
      }

      // Ribbons, their devices and the rack.
      if(role === 'ribbon'){
        const military = l.type === 'raster' || /^ribbon:military/.test(key);
        const rid = key.replace(/^ribbon:/, '').replace(/#\d+$/, '');
        const extra = /#\d+$/.test(key) && !military;
        const name = String(l.title || titleCase(rid)).replace(/ \(additional ribbon\)$/, '');
        cover(l, makeLine(figPrefix(l) + key, { group: 'Ribbons', name: `Ribbon: ${name}${extra ? ' (additional ribbon for its devices)' : ''}`, rule: military || C.MILITARY_IN_CAP_LIST.includes(rid) ? 'MILSPEC_OK' : 'CAP_ONLY', ref: '11.2', offers: C.ribbonOffers(rid, name, military), rid }));
        const fig = l.figure === 2 ? 2 : 1;
        if(!racks.has(fig)) racks.set(fig, { ribbons: 0, rows: new Set() });
        racks.get(fig).ribbons++; racks.get(fig).rows.add((l.y || 0).toFixed(2));
        continue;
      }
      if(role === 'mini-drape' || role === 'mini-medal' || role === 'mini'){
        const mkey = key.replace(/:medal$/, '');
        const rid = mkey.replace(/^mini:/, '').replace(/#\d+$/, '');
        const name = String(l.title || titleCase(rid));
        const fresh = !lines.has(figPrefix(l) + mkey);
        cover(l, makeLine(figPrefix(l) + mkey, { group: 'Miniature medals', name: `Miniature medal: ${name}`, rule: C.MILITARY_IN_CAP_LIST.includes(rid) || l.type === 'raster' ? 'MILSPEC_OK' : 'CAP_ONLY', ref: '11.4', offers: C.miniOffers(rid, name), rid }));
        if(fresh) miniCount++;
        continue;
      }
      if(role === 'device'){
        const owner = key.replace(/:device:\d+$/, '');
        const ownerKey = figPrefix(l) + owner;
        if(!devices.has(ownerKey)) devices.set(ownerKey, new Map());
        const m = devices.get(ownerKey);
        m.set(id, (m.get(id) || 0) + 1);
        coverage[lkey(l)] = 'device:' + ownerKey + ':' + id;
        continue;
      }

      // Badges, CAP and military.
      if(role === 'badge'){
        const bid = key.replace(/^badge:/, '').split(':')[0];
        const meta = B && B.get ? B.get(bid) : null;
        let form = 'dress';
        if(l.type === 'raster') form = 'military';
        else if(build.uniform === 'polo') form = 'polo';
        else if(meta && meta.mini === id) form = 'mini';
        else if(meta && meta.cloth === id) form = 'cloth';
        else if(meta && meta.field === id) form = 'field';
        else if(/-mini$/.test(id)) form = 'mini';
        else if(/^cloth-/.test(id)) form = 'cloth';
        else if(/-field$/.test(id)) form = 'field';
        const name = l.title || (meta && meta.name) || titleCase(bid);
        const words = C.BADGE_FORM_WORDS[form];
        cover(l, makeLine(figPrefix(l) + 'badge:' + bid, { group: 'Badges', name: `${name}${figName(l)}`, detail: form === 'polo' ? 'Embroidered on the polo, 1/2 in over the name (5.3.2.1.1)' : words ? sentence(words) : '', rule: form === 'military' ? 'MILSPEC_OK' : 'CAP_ONLY', offers: C.badgeOffers(bid, name.replace(/ Badge$/, ''), form) }));
        continue;
      }

      // Patches: the unit and other patches the page hands the engine, and the ES patch.
      if(role === 'patch'){
        if(/^patch-es-style/.test(id)){ cover(l, fromItem('es_patch', { detail: /2$/.test(id) ? 'Second style' : '' }, figPrefix(l) + 'item:es_patch')); continue; }
        if(id === 'patch-cap-command-patch'){ cover(l, fromItem('command_patch')); continue; }
        const pid = key.replace(/^patch:/, '').split(':')[0];
        const name = l.title || titleCase(pid);
        cover(l, makeLine(figPrefix(l) + 'patch:' + pid, { group: 'Patches', name: `Patch: ${name}${figName(l)}`, rule: 'CAP_ONLY', offers: C.patchOffers(name) }));
        continue;
      }

      // Anything else the scene draws still gets a line.
      cover(l, makeLine('drawn:' + (id || key), { group: 'Other', name: `Drawn piece: ${l.title || titleCase(String(id || key).replace(/^garment-/, ''))}`, offers: C.searchOnly(), q: l.title || titleCase(id || key), unknown: true }));
    }

    // Grade quantities: a pair when the piece is worn on both sides.
    for(const [gkey, g] of grades){
      const line = lines.get(gkey);
      const sides = [...g.positions];
      const pair = sides.some(p => /right/.test(p)) && sides.some(p => /left/.test(p));
      const singles = sides.filter(p => !/right|left/.test(p));
      line.qty = (pair ? 1 : sides.filter(p => /right|left/.test(p)).length) + singles.length;
      const where = [];
      if(pair) where.push('one pair');
      if(singles.includes('cap') || singles.some(p => /cap/.test(p))) where.push('one for the cap');
      if(singles.includes('chest')) where.push('one for the chest');
      line.where = where.join(', ');
    }
    // Devices: clasps come as clusters of up to four, stars two to a package.
    for(const [ownerKey, m] of devices){
      const owner = lines.get(ownerKey);
      const ownerName = owner ? owner.name.replace(/^(Ribbon|Miniature medal): /, '') : ownerKey;
      const mini = /(^|:)mini:/.test(ownerKey);
      for(const [asset, n] of m){
        const info = C.deviceInfo(asset) || { name: titleCase(asset), unit: 'device', q: titleCase(asset), offer: () => ({ vendor: 'vanguard', price: null }) };
        let qty = n, note = '';
        if(info.cluster){ qty = Math.ceil(n / info.cluster); note = n > 1 ? `${n} clasps: ${qty > 1 ? qty + ' clusters' : `a ${Math.min(n, info.cluster)}-clasp cluster`}.` : ''; }
        else if(info.pack){ qty = Math.ceil(n / info.pack); note = `${n} ${info.unit}${n === 1 ? '' : 's'}; sold ${info.pack} to a package.`; }
        const first = Object.assign({}, info.offer(Math.min(n, info.cluster || n)), { q: info.q });
        const lineKey = 'device:' + ownerKey + ':' + asset;
        const line = makeLine(lineKey, { group: mini ? 'Miniature medals' : 'Ribbons', name: `Devices for ${ownerName}: ${n} ${info.name}${n > 1 ? 's' : ''}${info.size ? ` (${info.size})` : ''}`, detail: mini ? 'For the miniature medal' : '', rule: info.military ? 'MILSPEC_OK' : 'CAP_ONLY', ref: '11.2', note, qty, offers: [first, { vendor: 'uniforms4u', price: null, q: info.q }, { vendor: 'iragreen', price: null, q: info.q }] });
        line.layers = Object.keys(coverage).filter(k => coverage[k] === lineKey);
      }
    }
    // The mounting bars: one for the ribbon rack, one for the miniature medals.
    for(const [fig, r] of racks){
      const rows = r.rows.size;
      fromItem('ribbon_mount', { detail: `For ${r.ribbons} ribbon${r.ribbons === 1 ? '' : 's'} in ${rows} row${rows === 1 ? '' : 's'}${fig === 2 ? `, ${fig2Label}` : ''}` }, (fig === 2 ? 'fig2:' : '') + 'item:ribbon_mount');
    }
    if(miniCount){
      const holding = build.opt && build.opt.miniStyle === 'holding';
      fromItem('mini_mount', { detail: `For ${miniCount} miniature medal${miniCount === 1 ? '' : 's'}${holding ? ', holding bar' : ''}` });
    }

    // Offers: fill each search link, pick the lowest price.
    const out = [...lines.values()].map(line => {
      // A piece not sold at retail has no search links either.
      if(line.notSold) line.offers = [];
      line.offers = (line.offers || []).map(o => {
        const q = o.q || line.q || line.name;
        const url = o.url || C.search(o.vendor, q);
        return { vendor: o.vendor, vendorName: vendorName(o.vendor), price: Number.isFinite(o.price) ? o.price : null, status: Number.isFinite(o.price) ? (o.status || 'estimated') : null, checked: o.checked || null, url, kind: o.url ? 'product' : 'search', sku: o.sku || '' };
      });
      // One offer per vendor, the priced one first.
      const byVendor = new Map();
      for(const o of line.offers){ const prev = byVendor.get(o.vendor); if(!prev || (prev.price == null && o.price != null)) byVendor.set(o.vendor, o); }
      line.offers = [...byVendor.values()].sort((a, b) => (a.price == null) - (b.price == null) || (a.price || 0) - (b.price || 0));
      line.lowest = line.offers.find(o => o.price != null) || null;
      line.unitPrice = line.lowest ? line.lowest.price : null;
      line.total = line.lowest ? +(line.lowest.price * (line.qty || 1)).toFixed(2) : null;
      if(line.texts && line.texts.length) line.detail = [line.detail, line.texts.map(t => `"${t}"`).join(' / ')].filter(Boolean).join(' · ');
      if(line.where) line.detail = [line.detail, line.where].filter(Boolean).join(' · ');
      if(line.alt) line.note = [line.note, `Or: ${C.items[line.alt].name}.`].filter(Boolean).join(' ');
      line.search = [line.name, line.detail, line.group, line.note, ...line.offers.map(o => o.vendorName + ' ' + (o.sku || ''))].join(' ').toLowerCase();
      delete line.detailSet; delete line.refSet; delete line.noteSet;
      return line;
    });
    out.sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group));
    const uncovered = layers.filter(l => drawnLayer(l) && !coverage[lkey(l)]).map(lkey);
    return { lines: out, coverage, uncovered, title: scene.title || '' };
  }

  function totals(lines, owned){
    let subtotal = 0, remaining = 0, estimated = 0, unpriced = 0, verified = 0, notSold = 0;
    for(const l of lines){
      if(l.notSold){ notSold++; continue; }
      if(l.total == null){ unpriced++; continue; }
      subtotal += l.total;
      if(!(owned && owned[l.key])) remaining += l.total;
      if(l.lowest.status === 'verified') verified++; else estimated++;
    }
    return { subtotal: +subtotal.toFixed(2), remaining: +remaining.toFixed(2), estimated, unpriced, verified, notSold, count: lines.length };
  }

  // ---- exports ----------------------------------------------------------------------------------------------------
  function header(meta){
    return [meta.title || 'Uniform', meta.who].filter(Boolean).join(' | ');
  }
  function toText(list, meta, owned){
    meta = meta || {};
    const t = totals(list, owned);
    const out = ['CAP Uniform Builder shopping list', header(meta), `Catalog ${C.version}; prices seen ${C.priceChecked}, estimates made ${C.estimatesMade}. Verify each price before checkout.`, ''];
    let group = null;
    for(const l of list){
      if(l.group !== group){ group = l.group; out.push(`== ${group} ==`); }
      const price = l.notSold ? 'not sold at retail' : l.lowest ? `${money(l.total)}${l.qty > 1 ? ` (${l.qty} x ${money(l.unitPrice)})` : ''} at ${l.lowest.vendorName}, ${l.lowest.status}${l.lowest.checked ? ' ' + l.lowest.checked : ''}${l.lowest.status === 'estimated' ? ' *' : ''}` : 'no price';
      out.push(`${owned && owned[l.key] ? '[OWN]' : '[BUY]'} ${l.name}${l.detail ? ' - ' + l.detail : ''}${l.qty > 1 ? ` x ${l.qty}` : ''}: ${price}`);
      const link = l.lowest || l.offers[0];
      if(link) out.push(`    ${link.vendorName} ${link.kind === 'product' ? 'product' : 'search'}: ${link.url}`);
    }
    out.push('', `Subtotal of the lowest prices: ${money(t.subtotal)} (${t.estimated} estimated *, ${t.unpriced} without a price${t.notSold ? `, ${t.notSold} not sold at retail` : ''})`, `Still to buy: ${money(t.remaining)}`, 'Shipping, tax and alterations are not included.');
    return out.join('\n');
  }
  const csvCell = v => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  function toCSV(list, meta, owned){
    const rows = [['Section', 'Item', 'Detail', 'Quantity', 'Lowest unit price', 'Line total', 'Vendor', 'Price status', 'Price checked', 'SKU', 'Link', 'Other vendors', 'Own it', 'Sourcing', 'CAPR 39-1']];
    for(const l of list){
      const lo = l.lowest, link = lo || l.offers[0];
      rows.push([l.group, l.name, l.detail, l.qty, lo ? lo.price.toFixed(2) : '', l.total != null ? l.total.toFixed(2) : '', lo ? lo.vendorName : '', lo ? lo.status : l.notSold ? 'not sold at retail' : 'no price', lo ? lo.checked || '' : '', lo ? lo.sku : '', link ? link.url : '',
        l.offers.filter(o => o !== lo).map(o => `${o.vendorName}: ${o.price != null ? money(o.price) : 'search'} ${o.url}`).join(' | '), owned && owned[l.key] ? 'yes' : '', l.rule, l.ref]);
    }
    return rows.map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
  }

  const api = { deriveList, totals, toText, toCSV, catalog: C, drawnLayer, gradeFromAsset, money };
  if(!inPage || typeof document === 'undefined') return api;

  // ---- the dialog ---------------------------------------------------------------------------------------------------
  const OWNED_KEY = 'CAPUB_PURCHASE_OWNED_V2';
  const readStore = key => { try { return JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch(_) { return {}; } };
  const writeStore = (key, obj) => { try { localStorage.setItem(key, JSON.stringify(obj)); } catch(_) {} };
  let owned = readStore(OWNED_KEY);
  let current = { lines: [], meta: {} };
  let query = '';
  let sortBy = 'section';
  const esc = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const RULE_LABEL = { CAP_ONLY: 'CAP-only', MILSPEC_OK: 'Milspec OK', GENERIC_SPEC: 'Spec match', VERIFY: 'Verify item' };

  // The dialog's own styles, beside styles/app.css's .capub-purchase-* rules (CSP allows inline styles).
  const CSS = `
.capub-shop-tools{display:flex;flex-wrap:wrap;gap:var(--s2);align-items:end;margin:var(--s3) 0}
.capub-shop-tools label{display:flex;flex-direction:column;gap:2px;font-size:var(--t-xs);font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}
.capub-shop-tools input[type=search]{min-width:240px;min-height:40px;padding:0 var(--s3);border:1px solid var(--line-strong);border-radius:var(--r);background:var(--panel);color:var(--ink);font:inherit;font-size:var(--t-md);text-transform:none;letter-spacing:0}
.capub-shop-tools select{min-height:40px;width:auto;margin:0}
.capub-shop-tools .capub-shop-grow{flex:1 1 260px}
.capub-shop-tools .capub-shop-grow input{width:100%}
.capub-shop-exports{display:flex;gap:var(--s2);flex-wrap:wrap}
.capub-shop-exports button{width:auto;margin:0;padding:0 var(--s3);min-height:40px;background:transparent;color:var(--ink);border-color:var(--line-strong);font-size:var(--t-sm)}
.capub-shop-exports button:hover{background:var(--panel-2);border-color:var(--ink)}
.capub-shop-shown{margin:0 0 var(--s2);font-size:var(--t-sm);color:var(--muted)}
.capub-shop-group td{padding:var(--s3) var(--s2) var(--s1);background:var(--bg);border-bottom:2px solid var(--line-strong);font-family:var(--font-head);font-size:var(--t-lg);font-weight:700;text-transform:uppercase;letter-spacing:.04em}
.capub-shop-detail{font-size:var(--t-sm);color:var(--ink)}
.capub-shop-low{display:block;font-size:var(--t-xs);font-weight:400;color:var(--muted);margin-top:2px}
.capub-shop-star{color:var(--warn);font-weight:700}
.capub-shop-none{color:var(--muted);font-weight:400}
.capub-shop-more{margin-top:var(--s2);font-size:var(--t-sm)}
.capub-shop-more summary{cursor:pointer;color:var(--muted);font-weight:700}
.capub-shop-more ul{margin:var(--s1) 0 0;padding:0;list-style:none}
.capub-shop-more li{display:flex;justify-content:space-between;gap:var(--s3);padding:2px 0;border-bottom:1px dotted var(--line)}
.capub-shop-more a{color:var(--ink)}
.capub-purchase-table tr.capub-shop-owned td{opacity:.6}
.capub-purchase-table tr[hidden]{display:none}
@media (max-width:760px){
  .capub-shop-tools input[type=search]{min-width:0}
  .capub-purchase-table tr.capub-shop-group{margin:var(--s3) 0 var(--s2);padding:0;border:0}
  .capub-purchase-table tr.capub-shop-group td{display:block;padding:var(--s2) 0}
}`;
  function ensureStyle(){
    if(document.getElementById('capubShopStyle')) return;
    const s = document.createElement('style');
    s.id = 'capubShopStyle';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function ensureButton(){
    if(document.getElementById('purchaseListButton')) return;
    const download = document.getElementById('downloadImage');
    const slot = document.getElementById('purchaseListSlot');
    if(!slot && !download) return;
    const btn = document.createElement('button');
    btn.id = 'purchaseListButton'; btn.type = 'button'; btn.className='ghost'; btn.textContent = 'Shopping list & cost';
    btn.title = 'Everything the uniform as drawn wears, with the lowest known price and where to buy it.';
    // The Finish section reserves a slot for it; older markup falls back to beside Download.
    if(slot) slot.insertBefore(btn, slot.firstChild);
    else download.parentElement?.appendChild(btn);
    btn.addEventListener('click', openModal);
  }

  function ensureModal(){
    if(document.getElementById('capubPurchaseOverlay')) return;
    ensureStyle();
    const overlay = document.createElement('div');
    overlay.id = 'capubPurchaseOverlay'; overlay.className = 'capub-purchase-overlay';
    overlay.innerHTML = `<div class="capub-purchase-modal" role="dialog" aria-modal="true" aria-labelledby="capubPurchaseTitle">
      <div class="capub-purchase-head"><div><h2 id="capubPurchaseTitle">Shopping list & cost</h2><div class="capub-purchase-sub" id="capubPurchaseSubtitle"></div></div><button class="capub-purchase-close" id="capubPurchaseClose" aria-label="Close">×</button></div>
      <div class="capub-purchase-body" id="capubPurchaseBody"></div>
    </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if(e.target === overlay) closeModal(); });
    overlay.querySelector('#capubPurchaseClose').addEventListener('click', closeModal);
    document.addEventListener('keydown', e => { if(e.key === 'Escape' && overlay.classList.contains('open')) closeModal(); });
  }

  function currentMeta(){
    const S = root.State || {};
    const who = [titleCase(S.membership), titleCase(S.gender), S.rank].filter(Boolean).join(' · ');
    return { title: current.title, who };
  }

  function compute(){
    const view = root.CAPUBUniformView;
    const scene = view && view.scene;
    let build = null;
    try { build = view && view.buildFromState ? view.buildFromState() : null; } catch(_) {}
    const res = deriveList(scene, build, { badges: root.CAPUBBadgeCatalog });
    current = { lines: res.lines, title: res.title, uncovered: res.uncovered };
    current.meta = currentMeta();
    return current;
  }

  function sorted(lines){
    const list = [...lines];
    if(sortBy === 'low' || sortBy === 'high'){
      const dir = sortBy === 'low' ? 1 : -1;
      list.sort((a, b) => (a.total == null) - (b.total == null) || dir * ((a.total || 0) - (b.total || 0)));
    }
    return list;
  }
  const matches = (line, q) => !q || q.split(/\s+/).filter(Boolean).every(w => line.search.includes(w));
  function visibleLines(){ return sorted(current.lines).filter(l => matches(l, query)); }

  function offerLabel(o){
    return (o.price != null ? `${money(o.price)} · ${o.status}${o.checked ? ' ' + o.checked : ''}` : 'search, no price') + (o.sku ? ` · SKU ${o.sku}` : '');
  }
  function rowHtml(l){
    const lo = l.lowest;
    const main = lo || l.offers[0];
    const ruleClass = l.rule === 'CAP_ONLY' ? 'cap' : (l.rule === 'MILSPEC_OK' ? 'ok' : '');
    const others = l.offers.filter(o => o !== main);
    const priceCell = l.notSold
      ? '<span class="capub-shop-none">not sold at retail</span><span class="capub-shop-low">Issued through CAP</span>'
      : lo
      ? `${money(l.total)}${lo.status === 'estimated' ? '<span class="capub-shop-star" title="Estimated price"> *</span>' : ''}<span class="capub-shop-low">${l.qty > 1 ? `${l.qty} x ${money(lo.price)} · ` : ''}${esc(lo.vendorName)}${lo.sku ? ' SKU ' + esc(lo.sku) : ''} · ${lo.status === 'verified' ? 'verified' : 'estimated'}${lo.checked ? ' ' + esc(lo.checked) : ''}</span>`
      : '<span class="capub-shop-none">no price</span><span class="capub-shop-low">Search the vendors</span>';
    return `<tr data-key="${esc(l.key)}" class="${owned[l.key] ? 'capub-shop-owned' : ''}">
        <td data-label="Own it"><input type="checkbox" class="capub-owned" ${owned[l.key] ? 'checked' : ''} aria-label="Already own ${esc(l.name)}"></td>
        <td data-label="Item"><div class="capub-purchase-item-name">${esc(l.name)}</div>${l.detail ? `<div class="capub-shop-detail">${esc(l.detail)}</div>` : ''}<span class="capub-purchase-chip ${ruleClass}">${esc(RULE_LABEL[l.rule] || 'Verify')}</span>${l.notSold ? '<span class="capub-purchase-chip">Not sold at retail</span>' : lo ? `<span class="capub-purchase-chip ${lo.status === 'estimated' ? 'est' : ''}">${lo.status === 'verified' ? 'Verified price' : 'Estimated price'}</span>` : '<span class="capub-purchase-chip est">No price</span>'}${l.ref ? `<span class="capub-purchase-chip">CAPR 39-1 ${esc(l.ref)}</span>` : ''}${l.note ? `<div class="capub-purchase-note">${esc(l.note)}</div>` : ''}</td>
        <td class="capub-purchase-qty" data-label="Quantity">${Number(l.qty) || 1}</td>
        <td class="capub-purchase-price" data-label="Price">${priceCell}</td>
        <td data-label="Where to buy"><div class="capub-purchase-links">${main ? `<a href="${esc(main.url)}" target="_blank" rel="noopener noreferrer">${esc(main.vendorName)} ${main.kind === 'product' ? 'product' : 'search'}</a>` : (l.notSold ? '<span class="capub-shop-none">Through CAP, not a vendor</span>' : '')}</div>${others.length ? `<details class="capub-shop-more"><summary>Other vendors (${others.length})</summary><ul>${others.map(o => `<li><a href="${esc(o.url)}" target="_blank" rel="noopener noreferrer">${esc(o.vendorName)} ${o.kind === 'product' ? 'product' : 'search'}</a><span>${esc(offerLabel(o))}</span></li>`).join('')}</ul></details>` : ''}</td>
      </tr>`;
  }

  function renderRows(){
    const tbody = document.getElementById('capubShopRows');
    if(!tbody) return;
    const list = visibleLines();
    let html = '', group = null;
    for(const l of list){
      if(sortBy === 'section' && l.group !== group){ group = l.group; html += `<tr class="capub-shop-group"><td colspan="5">${esc(group)}</td></tr>`; }
      html += rowHtml(l);
    }
    tbody.innerHTML = html || '<tr><td colspan="5" class="capub-purchase-empty">Nothing matches the search.</td></tr>';
    tbody.querySelectorAll('tr[data-key]').forEach(tr => {
      const own = tr.querySelector('.capub-owned');
      own?.addEventListener('change', () => { owned[tr.dataset.key] = own.checked; if(!own.checked) delete owned[tr.dataset.key]; writeStore(OWNED_KEY, owned); tr.classList.toggle('capub-shop-owned', own.checked); renderTotals(); });
    });
    renderTotals();
  }

  function renderTotals(){
    const t = totals(current.lines, owned);
    const shown = visibleLines();
    const ts = totals(shown, owned);
    const set = (id, v) => { const n = document.getElementById(id); if(n) n.textContent = v; };
    set('capubTotalComplete', money(t.subtotal));
    set('capubTotalRemaining', money(t.remaining));
    set('capubTotalSelected', String(t.count));
    set('capubTotalMissing', `${t.estimated} / ${t.unpriced}`);
    const note = document.getElementById('capubShopShown');
    if(note) note.textContent = query ? `Showing ${shown.length} of ${t.count} items · ${money(ts.subtotal)} at the lowest prices shown` : `${t.count} items for this uniform · ${t.verified} verified, ${t.estimated} estimated (*), ${t.unpriced} without a price${t.notSold ? `, ${t.notSold} not sold at retail` : ''}`;
  }

  function renderBody(){
    compute();
    const body = document.getElementById('capubPurchaseBody');
    const subtitle = document.getElementById('capubPurchaseSubtitle');
    if(!body) return;
    if(subtitle) subtitle.textContent = `${current.title || 'No uniform drawn'}${current.meta.who ? ' · ' + current.meta.who : ''} · catalog ${C.version}`;
    if(!current.lines.length){
      body.innerHTML = '<div class="capub-purchase-empty">Choose a membership, gender, rank and uniform. The list is made from the uniform as drawn.</div>';
      return;
    }
    body.innerHTML = `
      <details class="capub-purchase-rule"><summary><b>How items are sourced</b></summary> CAP-specific rank/grade insignia, ribbons, miniature medals, badges, patches, nameplates and other CAP-only items are intentionally separated from ordinary military components. A visually similar USAF or other military item is not treated as a substitute. Standard garments/components are shown as military-spec alternatives only where the catalog marks them <b>Milspec OK</b>. Always verify the current CAPR 39-1 requirement before ordering. Prices are the lowest the catalog knows across Vanguard, Uniforms-4U and Ira Green: verified prices were seen on the vendor's page on the date shown, estimated ones (*) are budgeting figures. The page does not fetch prices live.</details>
      <div class="capub-purchase-summary">
        <div class="capub-purchase-card"><span>Subtotal, lowest prices</span><b id="capubTotalComplete">$0.00</b></div>
        <div class="capub-purchase-card"><span>Still to buy</span><b id="capubTotalRemaining">$0.00</b></div>
        <div class="capub-purchase-card"><span>Items</span><b id="capubTotalSelected">0</b></div>
        <div class="capub-purchase-card"><span>Estimated * / no price</span><b id="capubTotalMissing">0</b></div>
      </div>
      <div class="capub-shop-tools">
        <label class="capub-shop-grow">Search<input type="search" id="capubShopSearch" placeholder="Item, vendor or SKU" autocomplete="off" value="${esc(query)}"></label>
        <label>Sort<select id="capubShopSort"><option value="section">By section</option><option value="low">Price, low to high</option><option value="high">Price, high to low</option></select></label>
        <div class="capub-shop-exports"><button type="button" id="capubPurchaseCopy">Copy as text</button><button type="button" id="capubShopTxt">Download .txt</button><button type="button" id="capubShopCsv">Download .csv</button></div>
      </div>
      <p class="capub-shop-shown" id="capubShopShown" role="status" aria-live="polite"></p>
      <table class="capub-purchase-table"><thead><tr><th>Own</th><th>Item</th><th>Qty</th><th>Lowest price</th><th>Where to buy</th></tr></thead><tbody id="capubShopRows"></tbody></table>
      <div class="capub-purchase-note" style="margin-top:10px;max-width:none">Shipping, tax, alterations and vendor changes are not included. Check each price on the vendor's page before checkout.</div>
      <div class="capub-purchase-actions"><button id="capubPurchaseReset">Clear "own it" marks</button><button class="primary" id="capubPurchaseDone">Done</button></div>`;
    const search = body.querySelector('#capubShopSearch');
    search.addEventListener('input', () => { query = search.value.trim().toLowerCase(); renderRows(); });
    const sort = body.querySelector('#capubShopSort');
    sort.value = sortBy;
    sort.addEventListener('change', () => { sortBy = sort.value; renderRows(); });
    body.querySelector('#capubPurchaseCopy').addEventListener('click', copyList);
    body.querySelector('#capubShopTxt').addEventListener('click', () => download('cap-uniform-shopping-list.txt', toText(current.lines, current.meta, owned), 'text/plain'));
    body.querySelector('#capubShopCsv').addEventListener('click', () => download('cap-uniform-shopping-list.csv', toCSV(current.lines, current.meta, owned), 'text/csv'));
    body.querySelector('#capubPurchaseDone').addEventListener('click', closeModal);
    body.querySelector('#capubPurchaseReset').addEventListener('click', () => {
      if(!confirm('Clear every "already own it" mark on the shopping list?')) return;
      owned = {}; writeStore(OWNED_KEY, owned); renderRows();
    });
    renderRows();
  }

  function download(name, text, type){
    const blob = new Blob([text], { type: type + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.style.display = 'none';
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
  }

  function copyList(){
    const text = toText(current.lines, current.meta, owned);
    const btn = document.getElementById('capubPurchaseCopy');
    const done = () => { if(btn){ const old = btn.textContent; btn.textContent = 'Copied'; setTimeout(() => { btn.textContent = old; }, 1200); } };
    if(navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
    else fallbackCopy(text, done);
  }
  function fallbackCopy(text, done){
    const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch(_) {} finally { ta.remove(); }
  }

  const isOpen = () => !!document.getElementById('capubPurchaseOverlay')?.classList.contains('open');
  function openModal(){ ensureModal(); renderBody(); document.getElementById('capubPurchaseOverlay')?.classList.add('open'); document.getElementById('capubShopSearch')?.focus(); }
  function closeModal(){ document.getElementById('capubPurchaseOverlay')?.classList.remove('open'); }
  // The list follows the drawing: a new render while the dialog is open rebuilds it (search and sort kept).
  document.addEventListener('capub:rendered', () => { if(isOpen()) renderBody(); });

  function init(){ ensureButton(); ensureModal(); }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();

  Object.assign(api, {
    open: openModal, close: closeModal, refresh: renderBody,
    text: () => toText(current.lines, current.meta, owned), csv: () => toCSV(current.lines, current.meta, owned),
    currentTotals: () => totals(current.lines, owned), visible: () => visibleLines()
  });
  // Live views of the list the dialog shows (getters: Object.assign would copy today's value).
  Object.defineProperties(api, {
    list: { get: () => current.lines, enumerable: true },
    uncovered: { get: () => current.uncovered || [], enumerable: true },
    meta: { get: () => current.meta, enumerable: true }
  });
  // Kept for callers of the old feature.
  api.buildItems = () => compute().lines;
  root.CAPUB_PURCHASE_FEATURE = api;
  if(root.console) root.console.info(`CAPUB Shopping list loaded (catalog ${C.version}).`);
  return api;
});
