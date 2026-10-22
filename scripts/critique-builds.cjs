#!/usr/bin/env node
'use strict';
// The builds the review of C/Col Doran's critique needs on top of the standard matrix: racks with devices,
// 12 miniatures, unit and HHQ patches, the measurement overlay, flight-suit name tags with two badges, the
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

// Utility uniforms (items 13-15): ES badge on OCP, unit and HHQ patches resolved to full art, the overlay.
mk('ocp-male-cadet-CSSgt-patches', 'ocp', 'male', 'cadet', 'C/SSgt', { patchRefs: [unitFull, hhq], badgeIds: [AIRCREW, 'emergency_services_badge'] });
mk('ocp-male-senior-LtCol-patches-overlay', 'ocp', 'male', 'senior', 'Lt Col', { patchRefs: [unitFull, hhq], badgeIds: [A4[0], 'emergency_services_badge'], opt: Object.assign({}, base, { overlay: true }) });
mk('ocp-male-senior-LtCol-no-unit-art', 'ocp', 'male', 'senior', 'Lt Col', { patchRefs: [unitNoArt, hhq], badgeIds: [A4[0]] });
mk('abu-male-senior-SMSgt', 'abu', 'male', 'senior', 'SMSgt', { patchRefs: [unitFull, hhq], badgeIds: [A4[0], 'emergency_services_badge'] });
mk('corporate_field-female-senior-Capt', 'corporate_field', 'female', 'senior', 'Capt', { patchRefs: [unitFull, hhq], badgeIds: [A4[0], 'emergency_services_badge'] });

// Flight suits (items 16-17): name tag with two badges, the command pin, both ES patch styles, the scarf,
// and the general officers.
const GROUP_PIN = { id: 'group_commander_badge', title: 'Group Commander Badge', graduated: false };
mk('flight_suit-male-cadet-CSSgt-wings-es', 'flight_suit', 'male', 'cadet', 'C/SSgt', { badgeIds: [AIRCREW, 'emergency_services_badge'] });
mk('flight_suit-male-cadet-CSSgt-two-badges-es-style1-scarf', 'flight_suit', 'male', 'cadet', 'C/SSgt', { badgeIds: [AIRCREW, 'ground_team_basic_badge'], opt: { esPatch: 'style-1', scarf: true } });
mk('flight_suit-male-cadet-CCapt-command-pin', 'flight_suit', 'male', 'cadet', 'C/Capt', { badgeIds: [AIRCREW], command: GROUP_PIN, opt: { esPatch: 'style-2' } });
mk('corporate_flight_suit-female-senior-SMSgt-two-badges-es-style2', 'corporate_flight_suit', 'female', 'senior', 'SMSgt', { badgeIds: [A4[0], 'ground_team_basic_badge'], opt: { esPatch: 'style-2' } });
mk('flight_suit-female-senior-MajGen', 'flight_suit', 'female', 'senior', 'Maj Gen', { badgeIds: [A4[0]], opt: { scarf: true } });
mk('flight_suit-male-senior-MajGen', 'flight_suit', 'male', 'senior', 'Maj Gen', { badgeIds: [A4[0]] });
mk('corporate_flight_suit-male-senior-MajGen', 'corporate_flight_suit', 'male', 'senior', 'Maj Gen', { badgeIds: [A4[0]] });
mk('corporate_flight_suit-female-senior-MajGen', 'corporate_flight_suit', 'female', 'senior', 'Maj Gen', { badgeIds: [A4[0]] });
mk('flight_suit-female-cadet-CCapt', 'flight_suit', 'female', 'cadet', 'C/Capt', { badgeIds: [AIRCREW] });
mk('corporate_flight_suit-male-senior-Capt', 'corporate_flight_suit', 'male', 'senior', 'Capt', { badgeIds: [A4[0]] });

process.stdout.write(JSON.stringify(out, null, 1) + '\n');
