#!/usr/bin/env node
'use strict';
// The builds the review of C/Col Doran's critique needs on top of the standard matrix: racks with devices,
// 12 miniatures, unit and HHQ patches, the measurement overlay, flight-suit name tags (one badge each), the
// ES patch styles, the scarf and the general officer flight suits.
//
//   node scripts/critique-builds.cjs > /tmp/critique-builds.json
//   node scripts/render-builds.cjs /tmp/critique-builds.json --out /tmp/critique --ppi 40
//
// Ribbon selections are listed in any order: render-builds.cjs sorts them by precedence as the page does.
// Patches are `patchRefs`: render-builds.cjs resolves them through the page's wholePatchImage rule.

const out = [];
const nm = { first: 'Pat', last: 'Doran', show: true };
const base = { rackColumns: 3, rackArrangement: 'lapel', miniStyle: 'mounting' };
const rib = () => [['meritorious_service_award'], ['commander_commendation_award'], ['cap_achievment_award', 'capub_total_3'], ['search_find_ribbon', 'aircrew'], ['cap_leadership_ribbon'], ['cap_membership_ribbon'], ['red_service_ribbon']];
const cadRib = [['mitchell_award', 'earned_cos_star'], ['armstrong_achievement'], ['rickenbacker_achievement'], ['wright_brothers_award'], ['curry_achievement'], ['cap_achievment_award', 'capub_total_3'], ['search_find_ribbon', 'aircrew']];
const twelve = [['distinguished_service_award'], ['exceptional_service_award'], ['meritorious_service_award'], ['commander_commendation_award'], ['cap_achievment_award', 'capub_total_3'], ['search_find_ribbon', 'aircrew'], ['air_search_and_rescue_ribbon'], ['cap_gill_robb_wilson_ribbon'], ['cap_command_service_ribbon'], ['cap_leadership_ribbon'], ['cap_membership_ribbon'], ['red_service_ribbon']];
const A4 = ['CAPPilot1_FA9D33EA587D8', 'observer_badge'];
const AIRCREW = 'AirCrew1_DB3F0FCC3650F';
const unitFull = { id: 'TN-330_ocp_patch', kind: 'unit', img: 'patches/ocp/TN-330_ocp_patch.webp', label: 'TN-330 Sequoyah Cadet Squadron' };
const unitNoArt = { id: 'TN-185_ocp_patch', kind: 'unit', img: 'patches/ocp/TN-185_ocp_patch.webp', label: 'TN-185' };
const hhq = { id: 'archer_ocp_patch', kind: 'general', img: 'patches/ocp/archer_ocp_patch.webp', slot: 'L_SHOULDER', label: 'ARCHER' };
// A wing patch (echelon wing): the left sleeve of the ABU and the CFU takes it (5.1.1.1.2.2, 5.2.1.1.2.2); ARCHER, a special activity patch, does not.
const wing = { id: 'nywg_patch', kind: 'general', slot: 'L_SHOULDER', label: 'New York Wing' };
const mk = (name, uniform, gender, membership, rank, o) => out.push({ name, build: Object.assign({ uniform, gender, membership, rank, name: nm, opt: Object.assign({}, base) }, o || {}) });

// Class A: badges the regulation limits to cadets, edge-on grades, semi-formal NCO chevrons (items 1-3).
mk('blues_a-male-senior-Capt-full', 'blues_a', 'male', 'senior', 'Capt', { ribbonSel: rib(), badgeIds: ['model_rocketry_badge', ...A4, 'emergency_services_badge', 'communications_technician_badge'] });
mk('blues_a-female-cadet-CMaj-full', 'blues_a', 'female', 'cadet', 'C/Maj', { ribbonSel: cadRib, badgeIds: ['model_rocketry_badge', AIRCREW, 'observer_badge', 'stem_badges', 'emergency_services_badge'], cord: 'wing' });
mk('blues_a-male-senior-SMSgt', 'blues_a', 'male', 'senior', 'SMSgt', { ribbonSel: rib(), badgeIds: A4 });
mk('blues_a-male-senior-MajGen', 'blues_a', 'male', 'senior', 'Maj Gen', { ribbonSel: rib(), badgeIds: A4 });
mk('blues_a-female-senior-Col', 'blues_a', 'female', 'senior', 'Col', { ribbonSel: rib(), badgeIds: A4 });
for(const g of ['male', 'female']){
  mk(`blues_a-${g}-cadet-CSSgt`, 'blues_a', g, 'cadet', 'C/SSgt', { ribbonSel: cadRib, badgeIds: [AIRCREW] });
  mk(`semi_formal_usaf-${g}-cadet-CSSgt`, 'semi_formal_usaf', g, 'cadet', 'C/SSgt', { ribbonSel: cadRib, badgeIds: [AIRCREW] });
  mk(`semi_formal_usaf-${g}-cadet-CMaj`, 'semi_formal_usaf', g, 'cadet', 'C/Maj', { ribbonSel: cadRib, badgeIds: [AIRCREW] });
}

// Service caps (D5, R6; CAPR 39-1 6.2.1.1 to 6.2.1.3, ICL 25-02 (g)): every other Class A build wears the flight cap. Company grade (the officer
// device), field grade (visor clouds), general officer (clouds), a senior NCO (the NCO device) and a cadet officer (the cadet service device),
// both cuts, with the headgear option set to the service cap.
for(const g of ['male', 'female']){
  for(const [m, rank, tag] of [['senior', 'Capt', 'Capt'], ['senior', 'Col', 'Col'], ['senior', 'Maj Gen', 'MajGen'], ['senior', 'SMSgt', 'SMSgt'], ['cadet', 'C/Maj', 'CMaj']]){
    mk(`blues_a-${g}-${m}-${tag}-service-cap`, 'blues_a', g, m, rank, { ribbonSel: m === 'cadet' ? cadRib : rib(), badgeIds: m === 'cadet' ? [AIRCREW] : A4, opt: Object.assign({}, base, { headgear: 'service' }) });
  }
}

// JROTC/ROTC ribbons (tracker Ribbon 6; CAPR 39-1 11.2.1, 11.2.5): three at most, after every CAP ribbon, no miniature medal.
const JROTC = [['rotc_air_force_jrotc_color_guard'], ['rotc_army_jrotc_proficiency'], ['rotc_navy_jrotc_unit_service_ribbon']];
for(const g of ['male', 'female']){
  mk(`blues_a-${g}-cadet-CCapt-jrotc`, 'blues_a', g, 'cadet', 'C/Capt', { ribbonSel: [...cadRib.slice(0, 5), ...JROTC], badgeIds: [AIRCREW] });
  mk(`blues_b-${g}-cadet-CCapt-jrotc`, 'blues_b', g, 'cadet', 'C/Capt', { ribbonSel: [...cadRib.slice(0, 5), ...JROTC], badgeIds: [AIRCREW] });
}
mk('blues_a-male-senior-Capt-jrotc', 'blues_a', 'male', 'senior', 'Capt', { ribbonSel: [...rib().slice(0, 4), ...JROTC], badgeIds: A4 });
// The USAF semi-formal wears ribbons, not miniatures (11.1.2, 11.1.4): no medalSel here, or the harness moves every ribbon to b.medals and the build
// draws none. Miniatures are for the mess dress and the corporate semi-formal; the mess dress build below carries the JROTC ids with medalSel.
mk('semi_formal_usaf-male-cadet-CCapt-jrotc', 'semi_formal_usaf', 'male', 'cadet', 'C/Capt', { ribbonSel: [...cadRib.slice(0, 5), ...JROTC], badgeIds: [AIRCREW] });
mk('mess_dress-male-senior-Capt-jrotc', 'mess_dress', 'male', 'senior', 'Capt', { ribbonSel: [...rib().slice(0, 4), ...JROTC], medalSel: true, badgeIds: [A4[0]] });

// Class B (items 4-6): short-sleeve NCO chevron, the rack in precedence order, general officer.
for(const g of ['male', 'female']){
  mk(`blues_b-${g}-senior-Capt`, 'blues_b', g, 'senior', 'Capt', { ribbonSel: rib(), badgeIds: [A4[0], 'emergency_services_badge', 'communications_technician_badge'] });
  mk(`blues_b-${g}-senior-SMSgt`, 'blues_b', g, 'senior', 'SMSgt', { ribbonSel: rib(), badgeIds: [A4[0]] });
  mk(`blues_b-${g}-senior-MajGen`, 'blues_b', g, 'senior', 'Maj Gen', { ribbonSel: rib(), badgeIds: [A4[0]] });
}
mk('blues_b-male-cadet-CSSgt', 'blues_b', 'male', 'cadet', 'C/SSgt', { ribbonSel: cadRib, badgeIds: [AIRCREW, 'emergency_services_badge'] });

// Corporate and mess dress (items 7-12).
mk('aviator-male-senior-Col', 'aviator', 'male', 'senior', 'Col', { ribbonSel: rib(), badgeIds: A4 });
for(const g of ['male', 'female']){
  mk(`aviator_blazer-${g}-senior-Capt`, 'aviator_blazer', g, 'senior', 'Capt', { ribbonSel: rib(), badgeIds: [...A4, 'christian_chaplin'] });
  mk(`semi_formal-${g}-senior-Col-chaplain`, 'semi_formal', g, 'senior', 'Col', { ribbonSel: rib(), medalSel: true, badgeIds: ['christian_chaplin'] });
  mk(`mess_dress-${g}-senior-Col-12minis`, 'mess_dress', g, 'senior', 'Col', { ribbonSel: twelve, medalSel: true, badgeIds: A4 });
  mk(`semi_formal-${g}-senior-Capt-12minis`, 'semi_formal', g, 'senior', 'Capt', { ribbonSel: twelve, medalSel: true, badgeIds: A4, opt: Object.assign({}, base, { rackColumns: g === 'male' ? 4 : 3 }) });
  mk(`mess_dress-${g}-senior-MajGen`, 'mess_dress', g, 'senior', 'Maj Gen', { ribbonSel: rib(), medalSel: true, badgeIds: A4 });
}

// Utility uniforms (items 13-15): a Ground Team badge on OCP (the ES badge has no field art), unit and HHQ patches resolved to full art, the overlay.
mk('ocp-male-cadet-CSSgt-patches', 'ocp', 'male', 'cadet', 'C/SSgt', { patchRefs: [unitFull, hhq], badgeIds: [AIRCREW, 'ground_team_basic_badge'] });
mk('ocp-male-senior-LtCol-patches-overlay', 'ocp', 'male', 'senior', 'Lt Col', { patchRefs: [unitFull, hhq], badgeIds: [A4[0], 'ground_team_basic_badge'], opt: Object.assign({}, base, { overlay: true }) });
mk('ocp-male-senior-LtCol-no-unit-art', 'ocp', 'male', 'senior', 'Lt Col', { patchRefs: [unitNoArt, hhq], badgeIds: [A4[0]] });
// D23: the graduated commander's insignia (left IFF loop, flat sleeve and edge view) and the current commander's badge (chest).
const SQN_GRAD = { id: 'squadron_commander_badge', title: 'Squadron Commander Badge', graduated: true };
const SQN_CURRENT = { id: 'squadron_commander_badge', title: 'Squadron Commander Badge', graduated: false };
mk('ocp-male-senior-LtCol-graduated-commander', 'ocp', 'male', 'senior', 'Lt Col', { patchRefs: [unitFull, hhq], badgeIds: [A4[0]], command: SQN_GRAD, opt: Object.assign({}, base, { overlay: true }) });
mk('ocp-male-senior-LtCol-current-commander', 'ocp', 'male', 'senior', 'Lt Col', { patchRefs: [unitFull, hhq], badgeIds: [A4[0]], command: SQN_CURRENT });
mk('ocp-female-cadet-CCapt-graduated-commander', 'ocp', 'female', 'cadet', 'C/Capt', { patchRefs: [unitFull, hhq], badgeIds: [AIRCREW], command: SQN_GRAD });
mk('abu-male-senior-SMSgt', 'abu', 'male', 'senior', 'SMSgt', { patchRefs: [unitFull, wing, hhq], badgeIds: [A4[0], 'ground_team_basic_badge'] });
mk('corporate_field-female-senior-Capt', 'corporate_field', 'female', 'senior', 'Capt', { patchRefs: [unitFull, wing, hhq], badgeIds: [A4[0], 'ground_team_basic_badge'] });
// The wing patch is on the left sleeve of both (above); ARCHER, a special activity patch, is the CFU's right sleeve (5.2.1.1.2.3) and is noted, not drawn, on the ABU.
mk('corporate_field-male-senior-Col', 'corporate_field', 'male', 'senior', 'Col', { patchRefs: [unitFull, wing, hhq], badgeIds: [A4[0], 'ground_team_basic_badge'] });

// Flight suits (items 16-17): the name tag carries ONE badge whatever the member lists (Ethan, LIVE-FIELD B8: the aviation badge, else the command pin, else the
// occupational badge; the note names what is left off; names with 'two-badges' list two badges), the command pin, both ES patch styles, the scarf,
// and the general officers.
const GROUP_PIN = { id: 'group_commander_badge', title: 'Group Commander Badge', graduated: false };
// The flight suit name tag takes wings and an occupational badge (8.2.4.1, 8.3.4.1, 10.4.5); the Emergency Services badge is a specialty
// track badge (10.5) the tag rejects with a note, shown once on the male cadet build.
mk('flight_suit-male-cadet-CSSgt-wings-es-rejected', 'flight_suit', 'male', 'cadet', 'C/SSgt', { badgeIds: [AIRCREW, 'emergency_services_badge'] });
for(const g of ['male', 'female']){
  mk(`flight_suit-${g}-cadet-CSSgt-wings-ground-team`, 'flight_suit', g, 'cadet', 'C/SSgt', { badgeIds: [AIRCREW, 'ground_team_basic_badge'] });
  mk(`corporate_flight_suit-${g}-cadet-CSSgt-wings-ground-team`, 'corporate_flight_suit', g, 'cadet', 'C/SSgt', { badgeIds: [AIRCREW, 'ground_team_basic_badge'] });
  mk(`flight_suit-${g}-senior-SMSgt-wings-pin`, 'flight_suit', g, 'senior', 'SMSgt', { badgeIds: [A4[0]], command: GROUP_PIN });
  mk(`flight_suit-${g}-cadet-CCapt-es-style1`, 'flight_suit', g, 'cadet', 'C/Capt', { badgeIds: [AIRCREW], opt: { esPatch: 'style-1' } });
  mk(`flight_suit-${g}-cadet-CCapt-es-style2`, 'flight_suit', g, 'cadet', 'C/Capt', { badgeIds: [AIRCREW], opt: { esPatch: 'style-2' } });
  mk(`corporate_flight_suit-${g}-cadet-CCapt-es-style1`, 'corporate_flight_suit', g, 'cadet', 'C/Capt', { badgeIds: [AIRCREW], opt: { esPatch: 'style-1' } });
  mk(`corporate_flight_suit-${g}-cadet-CCapt-es-style2`, 'corporate_flight_suit', g, 'cadet', 'C/Capt', { badgeIds: [AIRCREW], opt: { esPatch: 'style-2' } });
}
mk('flight_suit-male-cadet-CSSgt-two-badges-es-style1-scarf', 'flight_suit', 'male', 'cadet', 'C/SSgt', { badgeIds: [AIRCREW, 'ground_team_basic_badge'], opt: { esPatch: 'style-1', scarf: true } });
mk('flight_suit-male-cadet-CCapt-command-pin', 'flight_suit', 'male', 'cadet', 'C/Capt', { badgeIds: [AIRCREW], command: GROUP_PIN, opt: { esPatch: 'style-2' } });
mk('corporate_flight_suit-female-senior-SMSgt-two-badges-es-style2', 'corporate_flight_suit', 'female', 'senior', 'SMSgt', { badgeIds: [A4[0], 'ground_team_basic_badge'], opt: { esPatch: 'style-2' } });
mk('flight_suit-female-senior-MajGen', 'flight_suit', 'female', 'senior', 'Maj Gen', { badgeIds: [A4[0]], opt: { scarf: true } });
mk('flight_suit-male-senior-MajGen', 'flight_suit', 'male', 'senior', 'Maj Gen', { badgeIds: [A4[0]] });
mk('corporate_flight_suit-male-senior-MajGen', 'corporate_flight_suit', 'male', 'senior', 'Maj Gen', { badgeIds: [A4[0]] });
mk('corporate_flight_suit-female-senior-MajGen', 'corporate_flight_suit', 'female', 'senior', 'Maj Gen', { badgeIds: [A4[0]] });
mk('corporate_flight_suit-male-senior-Capt', 'corporate_flight_suit', 'male', 'senior', 'Capt', { badgeIds: [A4[0]] });

// Coverage the review (FIX-R-OTHER-r4 item 11) found missing: the cadet C/Capt on both suits and both cuts, the officer shoulder bars (the Capt
// and the Col, flight suit and corporate, both cuts), the ES patch under the right pocket in each style on a senior Capt (D14: top of the
// es_patch_zone), the Christian chaplain field badge on the tag (D15), and the cadet C/Capt tag with two badges and the command pin (D17).
for(const g of ['male', 'female']){
  for(const u of ['flight_suit', 'corporate_flight_suit']){
    mk(`${u}-${g}-cadet-CCapt`, u, g, 'cadet', 'C/Capt', { badgeIds: [AIRCREW] });
    mk(`${u}-${g}-cadet-CCapt-two-badges-command-pin`, u, g, 'cadet', 'C/Capt', { badgeIds: [AIRCREW, 'ground_team_basic_badge'], command: GROUP_PIN });
    mk(`${u}-${g}-senior-Capt-es-style1`, u, g, 'senior', 'Capt', { badgeIds: [A4[0]], opt: { esPatch: 'style-1' } });
    mk(`${u}-${g}-senior-Capt-es-style2`, u, g, 'senior', 'Capt', { badgeIds: [A4[0]], opt: { esPatch: 'style-2' } });
    mk(`${u}-${g}-senior-Capt-chaplain`, u, g, 'senior', 'Capt', { badgeIds: ['christian_chaplin'] });
    mk(`${u}-${g}-senior-Col-shoulders`, u, g, 'senior', 'Col', { badgeIds: [A4[0]] });
  }
}

// FIX-R-OTHER-r5: the cadet officer's edge-on and top-down grade on the Class A and the semi-formal coat (item 1), the blazer lapel over the
// semi-formal's miniature medals and chaplain badge on every cut (item 2), two OCP chest badges blue edge to blue edge (item 3), and the
// cadet officer on the ABU and CFU tactical cap (item 4).
for(const g of ['male', 'female']){
  mk(`blues_a-${g}-cadet-CMaj-board-grade`, 'blues_a', g, 'cadet', 'C/Maj', { badgeIds: [AIRCREW] });
  mk(`blues_a-${g}-cadet-CCol-board-grade`, 'blues_a', g, 'cadet', 'C/Col', { badgeIds: [AIRCREW] });
  mk(`semi_formal_usaf-${g}-cadet-CCol-board-grade`, 'semi_formal_usaf', g, 'cadet', 'C/Col', { badgeIds: [AIRCREW] });
  mk(`semi_formal-${g}-senior-SMSgt-lapel-chaplain`, 'semi_formal', g, 'senior', 'SMSgt', { ribbonSel: twelve, medalSel: true, badgeIds: ['christian_chaplin'], opt: Object.assign({}, base, { rackColumns: 4 }) });
  mk(`ocp-${g}-cadet-CMaj-two-badges`, 'ocp', g, 'cadet', 'C/Maj', { badgeIds: [AIRCREW, 'ground_team_basic_badge'] });
  mk(`ocp-${g}-senior-Capt-two-badges`, 'ocp', g, 'senior', 'Capt', { badgeIds: [A4[0], 'ground_team_basic_badge'] });
  mk(`abu-${g}-cadet-CMaj-tactical-cap`, 'abu', g, 'cadet', 'C/Maj', { badgeIds: [AIRCREW] });
  mk(`corporate_field-${g}-cadet-CMaj-tactical-cap`, 'corporate_field', g, 'cadet', 'C/Maj', { badgeIds: [AIRCREW] });
}

// LIVE-FIELD: the OCP chest with one to four genuine field badges (B6, 7.1.1.3.1.1-4: the column of three and the two stacks of four are the defaults, the
// regulation's other forms are opt.badgeLayout 'pair'), the ABU cadet officer with two (5.1.1.1.2.4), and the flight suit tag that carries one badge
// where the member holds wings, a ground team badge and the command pin (B8).
const GT = 'ground_team_basic_badge', EMT = 'emt_basic_badge', CHAP = 'christian_chaplin';
mk('ocp-male-senior-Capt-1-badge', 'ocp', 'male', 'senior', 'Capt', { badgeIds: [A4[0]] });
mk('ocp-male-senior-Capt-2-badges', 'ocp', 'male', 'senior', 'Capt', { badgeIds: [A4[0], GT] });
mk('ocp-male-senior-Capt-3-badges', 'ocp', 'male', 'senior', 'Capt', { badgeIds: [A4[0], GT, EMT] });
mk('ocp-male-senior-Capt-4-badges', 'ocp', 'male', 'senior', 'Capt', { badgeIds: [CHAP, A4[0], GT, EMT] });
mk('abu-male-cadet-CMaj-2-badges', 'abu', 'male', 'cadet', 'C/Maj', { badgeIds: [AIRCREW, GT] });
mk('flight_suit-male-senior-Capt-wings-ground-team-pin', 'flight_suit', 'male', 'senior', 'Capt', { badgeIds: [A4[0], GT], command: GROUP_PIN });

// The polo, the Corporate Working Uniform (CAPR 39-1 5.3, Figure 5.5): the embroidered knit, tactical and screen-printed shirts, short and long, both cuts,
// with and without the name and the badge, the duty title, the badge choice among several, a woman in the men's cut, and the baseball cap (5.3.7).
const POLO_BADGE = A4[0], POLO_OCC = 'ground_team_basic_badge';
for(const g of ['male', 'female']){
  for(const sleeve of ['short', 'long']){
    mk(`polo-${g}-${sleeve}-knit-badge`, 'polo', g, 'senior', 'Capt', { badgeIds: [POLO_BADGE], opt: { sleeve } });
    mk(`polo-${g}-${sleeve}-tactical-badge`, 'polo', g, 'senior', 'Capt', { badgeIds: [POLO_BADGE], opt: { sleeve, poloShirt: 'tactical' } });
    mk(`polo-${g}-${sleeve}-print`, 'polo', g, 'senior', 'Capt', { badgeIds: [POLO_BADGE], opt: { sleeve, poloShirt: 'print' } });
  }
  mk(`polo-${g}-knit-title`, 'polo', g, 'senior', 'Col', { opt: { poloMark: 'title', dutyTitle: 'Wing Director of Operations' } });
  mk(`polo-${g}-knit-no-name-badge`, 'polo', g, 'senior', 'SM', { badgeIds: [POLO_OCC], name: { first: '', last: '', show: false } });
  mk(`polo-${g}-knit-two-badges-one-worn`, 'polo', g, 'senior', 'Capt', { badgeIds: [POLO_BADGE, POLO_OCC], badgeChoices: { polo: POLO_OCC } });
  mk(`polo-${g}-knit-baseball-cap`, 'polo', g, 'senior', 'Capt', { badgeIds: [POLO_BADGE], opt: { baseballCap: true } });
  mk(`polo-${g}-knit-all-the-trimmings-refused`, 'polo', g, 'senior', 'Maj Gen', { ribbonSel: rib(), badgeIds: [POLO_BADGE, 'command_council_badge'], command: GROUP_PIN, cord: 'wing' });
}
mk('polo-female-mens-cut-badge', 'polo', 'female', 'senior', 'Capt', { badgeIds: [POLO_BADGE], opt: { poloCut: 'male' } });

process.stdout.write(JSON.stringify(out, null, 1) + '\n');
