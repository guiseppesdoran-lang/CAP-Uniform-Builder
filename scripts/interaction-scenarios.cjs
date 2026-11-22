'use strict';
// The interactions timed by scripts/interaction-perf.cjs, and the members they are timed for. A scenario is
//   { name, config, open?: js run once after the member is set, prep?: js run before every run (puts the page back as it was before the tap),
//     sel: js expression giving the element to tap, pred: js expression true when that control shows its new state, act?: 'tap' | 'type:abc' | 'change:value' }
// Every `prep` and `open` puts the page in the state the tap needs; none of it is timed.

// The members. `cadet`: a C/Col on the Class A with the Cadet Program ribbons, four badges and two patches. `senior-mess`: a Capt on the Mess Dress with twenty ribbons, eight of
// them military, with devices, and four badges. `senior-ocp`: the same member on the OCP.
const RIBBONS_CAP = ['cap_achievment_award', 'unit_citation_award', 'cap_leadership_ribbon', 'cap_membership_ribbon', 'meritorious_service_award', 'commander_commendation_award', 'exceptional_service_award', 'distinguished_service_award', 'national_commanders_citation', 'cap_gill_robb_wilson_ribbon', 'cap_paul_e_garber_ribbon', 'cap_grover_loening_aerospace_ribbon'];
const RIBBONS_MIL = ['military:medal_of_honor', 'military:silver_star', 'military:legion_of_merit', 'military:distinguished_flying_cross', 'military:navy_and_marine_corps_medal', 'military:airman_s_medal', 'military:soldier_s_medal', 'military:defense_superior_service'];
const CONFIGS = {
  cadet: { membership: 'cadet', rank: 'C/Col', uniform: 'blues_a', ribbons: RIBBONS_CAP.slice(0, 8).concat(['cadet_achievement_ribbon']), mil: [], badges: ['solo_badge', 'stem_badges', 'cyber_badges', 'emergency_services_badge'], patches: ['ner_patch', 'nywg_patch'] },
  'senior-mess': { membership: 'senior', rank: 'Capt', uniform: 'mess_dress', ribbons: RIBBONS_CAP, mil: RIBBONS_MIL, badges: ['CAPPilot1_FA9D33EA587D8', 'ground_team_basic_badge', 'emt_basic_badge', 'communications_technician_badge'], patches: [] },
  'senior-ocp': { membership: 'senior', rank: 'Capt', uniform: 'ocp', ribbons: RIBBONS_CAP, mil: RIBBONS_MIL, badges: ['CAPPilot1_FA9D33EA587D8', 'ground_team_basic_badge', 'emt_basic_badge', 'communications_technician_badge'], patches: ['ner_patch', 'nywg_patch'] }
};

// Sets the member up as the page's own state, as the tests do, and draws it.
function setupJs(name){
  const c = CONFIGS[name];
  return `(async () => {
    const c = ${JSON.stringify(c)};
    if(window.CAPUB_V3) CAPUB_V3.showStep('items');
    // The profile as a member sets it, through the controls (the grade and uniform pictures are made from them).
    const fire = (el, v) => { el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); };
    fire(document.getElementById('membershipType'), c.membership);
    fire(document.getElementById('rankSetupSelect'), c.rank);
    fire(document.getElementById('jacketSelect'), 'male');
    await new Promise(r => setTimeout(r, 300));
    const card = document.querySelector('.uniformOption[data-uniform-id="' + c.uniform + '"]'); if(card) card.click();
    State.membership = c.membership; State.gender = 'male'; State.rank = c.rank; State.uniform = c.uniform;
    State.ribbonSelections = {}; State.badgeSelections = {}; State.badges = []; State.badgeChoices = {}; State.patches = [];
    const opts = ribbonAwardCountOptions(); const seven = opts[7];
    for(const id of c.ribbons) State.ribbonSelections[id] = { checked: true, devices: {}, awardValue: '', awardLabel: '' };
    for(const id of c.mil) State.ribbonSelections[id] = { checked: true, devices: Object.assign({}, seven.devices), awardValue: seven.value, awardLabel: seven.label };
    for(const id of c.badges) State.badgeSelections[id] = { checked: true };
    State.badges = c.badges.slice();
    State.patches = c.patches.slice();
    try { rebuildRibbonsFromGallery(); } catch(e) { console.error(e); }
    try { refreshUI(); } catch(e) { console.error(e); }
    fullRender();
    await CAPUBUniformView.render();
    await new Promise(r => setTimeout(r, 400));
    return JSON.stringify({ ribbons: State.ribbons.length, badges: State.badges.length, layers: CAPUBUniformView.scene ? CAPUBUniformView.scene.layers.length : null });
  })()`;
}

const cell = (host, id) => `document.querySelector('${host} .vpCell[data-value="${id}"]')`;
const tile = (host, id) => `${cell(host, id)}.querySelector('.vpOption')`;
const WIN = '#galleryModalHost';
const open = btn => `(async () => { document.getElementById('${btn}').click(); await new Promise(r => setTimeout(r, 1500)); return true; })()`;
const click = expr => `(() => { const e = ${expr}; if(e) e.click(); return true; })()`;
const settle = ms => `await new Promise(r => setTimeout(r, ${ms}));`;
// Puts a tile off (or on) before a run.
const ensure = (expr, pressed) => `(async () => { const e = ${expr}; if(e && (e.getAttribute('aria-pressed') === 'true') !== ${pressed}) e.click(); ${settle(900)} return true; })()`;
const pressed = (expr, v = true) => `(${expr}).getAttribute('aria-pressed') === '${v}'`;
const closeWindow = `(async () => { if(window.CAPUB_V3) CAPUB_V3.showStep('items'); const b = document.getElementById('galleryModalCloseBtn'); if(b && b.offsetParent) b.click(); ${settle(500)} return true; })()`;

const R_ON = 'lifesaving_award';     // not in any member's rack above
const R_SEL = 'lifesaving_award'; // a ribbon with the award dropdown
const R_HONOR = 'goddard_achievement';

const SCENARIOS = [
  { name: 'ribbon tile on', config: 'senior-mess', open: open('expandRibbons'), prep: ensure(tile(WIN, R_ON), false), sel: tile(WIN, R_ON), pred: pressed(tile(WIN, R_ON)) },
  { name: 'ribbon tile off', config: 'senior-mess', open: open('expandRibbons'), prep: ensure(tile(WIN, R_ON), true), sel: tile(WIN, R_ON), pred: pressed(tile(WIN, R_ON), false) },
  { name: 'ribbon tile on (cadet)', config: 'cadet', open: open('expandRibbons'), prep: ensure(tile(WIN, R_ON), false), sel: tile(WIN, R_ON), pred: pressed(tile(WIN, R_ON)) },
  { name: 'ribbon award dropdown', config: 'cadet', open: open('expandRibbons'),
    prep: `(async () => { const t = ${tile(WIN, R_SEL)}; if(t.getAttribute('aria-pressed') !== 'true'){ t.click(); ${settle(900)} } const c = ${cell(WIN, R_SEL)}; const s = c.querySelector('select.ribbonCountSelect'); if(s && s.selectedIndex !== 2){ s.selectedIndex = 2; s.dispatchEvent(new Event('change', { bubbles: true })); ${settle(900)} } return true; })()`,
    sel: `${cell(WIN, R_SEL)}.querySelector('select.ribbonCountSelect')`, act: 'index:4', pred: `${cell(WIN, R_SEL)}.querySelector('select.ribbonCountSelect').selectedIndex === 4` },
  { name: 'honor credit switch', config: 'cadet', open: open('expandRibbons'),
    prep: `(async () => { const t = ${tile(WIN, R_HONOR)}; if(t.getAttribute('aria-pressed') !== 'true'){ t.click(); ${settle(900)} } const sw = ${cell(WIN, R_HONOR)}.querySelector('.ribbonToggle'); if(sw.getAttribute('aria-pressed') === 'true'){ sw.click(); ${settle(900)} } return true; })()`,
    sel: `${cell(WIN, R_HONOR)}.querySelector('.ribbonToggle')`, pred: `${cell(WIN, R_HONOR)}.querySelector('.ribbonToggle').getAttribute('aria-pressed') === 'true'` },
  { name: 'badge tile on', config: 'senior-ocp', open: open('expandBadges'), prep: ensure(tile(WIN, 'master_ground_team_badge'), false), sel: tile(WIN, 'master_ground_team_badge'), pred: pressed(tile(WIN, 'master_ground_team_badge')) },
  { name: 'badge tile off', config: 'senior-ocp', open: open('expandBadges'), prep: ensure(tile(WIN, 'master_ground_team_badge'), true), sel: tile(WIN, 'master_ground_team_badge'), pred: pressed(tile(WIN, 'master_ground_team_badge'), false) },
  { name: 'badge tile on (mess)', config: 'senior-mess', open: open('expandBadges'), prep: ensure(tile(WIN, 'safety_senior_badge'), false), sel: tile(WIN, 'safety_senior_badge'), pred: pressed(tile(WIN, 'safety_senior_badge')) },
  { name: 'badge tile on (cadet)', config: 'cadet', open: open('expandBadges'), prep: ensure(tile(WIN, 'ground_team_basic_badge'), false), sel: tile(WIN, 'ground_team_basic_badge'), pred: pressed(tile(WIN, 'ground_team_basic_badge')) },
  // A badge with levels is one tile and a level dropdown under it (js/pick-lists.js badgeList): the level is chosen in the select.
  { name: 'badge level', config: 'cadet', open: open('expandBadges'),
    prep: `(async () => { const t = ${tile(WIN, 'stem_badges')}; if(t.getAttribute('aria-pressed') !== 'true'){ t.click(); ${settle(900)} } const s = ${cell(WIN, 'stem_badges')}.querySelector('select.badgeLevelSelect'); if(s && s.value !== 'basic'){ s.value = 'basic'; s.dispatchEvent(new Event('change', { bubbles: true })); ${settle(900)} } return true; })()`,
    sel: `${cell(WIN, 'stem_badges')}.querySelector('select.badgeLevelSelect')`, act: 'index:1', pred: `${cell(WIN, 'stem_badges')}.querySelector('select.badgeLevelSelect').value === 'advanced'` },
  { name: 'patch tile on', config: 'senior-ocp', open: open('expandPatches'), prep: ensure(tile(WIN, 'check_pilot_ocp_patch'), false), sel: tile(WIN, 'check_pilot_ocp_patch'), pred: pressed(tile(WIN, 'check_pilot_ocp_patch')) },
  { name: 'patch tile off', config: 'senior-ocp', open: open('expandPatches'), prep: ensure(tile(WIN, 'check_pilot_ocp_patch'), true), sel: tile(WIN, 'check_pilot_ocp_patch'), pred: pressed(tile(WIN, 'check_pilot_ocp_patch'), false) },
  { name: 'open ribbons window', config: 'senior-mess', prep: closeWindow, sel: `document.getElementById('expandRibbons')`, pred: `getComputedStyle(document.getElementById('galleryModalOverlay')).display !== 'none'` },
  { name: 'open badges window', config: 'senior-ocp', prep: closeWindow, sel: `document.getElementById('expandBadges')`, pred: `getComputedStyle(document.getElementById('galleryModalOverlay')).display !== 'none'` },
  { name: 'open patches window', config: 'senior-ocp', prep: closeWindow, sel: `document.getElementById('expandPatches')`, pred: `getComputedStyle(document.getElementById('galleryModalOverlay')).display !== 'none'` },
  { name: 'close ribbons window', config: 'senior-mess', prep: `(async () => { if(getComputedStyle(document.getElementById('galleryModalOverlay')).display === 'none'){ CAPUB_V3.showStep('items'); document.getElementById('expandRibbons').click(); ${settle(1500)} } return true; })()`, sel: `document.getElementById('galleryModalDoneBtn')`, pred: `getComputedStyle(document.getElementById('galleryModalOverlay')).display === 'none'` },
  { name: 'ribbon search 3 letters', config: 'senior-mess', open: open('expandRibbons'), prep: `(() => { const i = document.querySelector('#capubV2ModalSearch'); i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`, sel: `document.querySelector('#capubV2ModalSearch')`, act: 'type:med', pred: `document.querySelectorAll('#galleryModalHost .vpCell:not([hidden])').length < 100` },
  { name: 'badge search 3 letters', config: 'senior-ocp', open: open('expandBadges'), prep: `(() => { const i = document.querySelector('#capubV2ModalSearch'); i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`, sel: `document.querySelector('#capubV2ModalSearch')`, act: 'type:med', pred: `document.querySelectorAll('#galleryModalHost .vpCell:not([hidden])').length < 100` },
  { name: 'unit list search 3 letters', config: 'senior-mess', open: `(async () => { CAPUB_V3.showStep('profile'); ${settle(600)} return true; })()`, prep: `(() => { const i = document.getElementById('unitPatchSearch'); i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`, sel: `document.getElementById('unitPatchSearch')`, act: 'type:squ', pred: `document.getElementById('unitPatchSearch').value === 'squ'` },
  { name: 'uniform pick', config: 'senior-mess', open: `(async () => { CAPUB_V3.showStep('uniform'); ${settle(600)} return true; })()`, prep: `(async () => { const b = document.querySelector('.uniformOption[data-uniform-id="mess_dress"]'); if(!b.classList.contains('activeUniform')){ b.click(); ${settle(1200)} } return true; })()`, sel: `document.querySelector('.uniformOption[data-uniform-id="blues_a"]')`, pred: `document.querySelector('.uniformOption[data-uniform-id="blues_a"]').classList.contains('activeUniform')` },
  { name: 'grade pick', config: 'senior-mess', open: `(async () => { CAPUB_V3.showStep('profile'); ${settle(600)} return true; })()`, prep: `(async () => { const s = document.getElementById('rankSetupSelect'); if(s.value !== 'Capt'){ s.value = 'Capt'; s.dispatchEvent(new Event('change', { bubbles: true })); ${settle(1200)} } return true; })()`, sel: `document.querySelector('[data-picker-for="rankSetupSelect"] .vpOption[data-value="Maj"]')`, pred: `document.getElementById('rankSetupSelect').value === 'Maj'` },
  { name: 'step Next', config: 'senior-mess', open: `(async () => { CAPUB_V3.showStep('profile'); ${settle(600)} return true; })()`, prep: `(async () => { CAPUB_V3.showStep('profile'); ${settle(600)} return true; })()`, sel: `document.getElementById('stepNext')`, pred: `document.querySelector('.stepTab[aria-selected="true"], [data-step][aria-selected="true"]')?.dataset.step === 'uniform'` },
  { name: 'Measurements', config: 'senior-mess', prep: `(async () => { if(!document.getElementById('measureBtn').offsetParent){ document.getElementById('previewPeekBtn').click(); ${settle(800)} } if(State.showMeasurements){ document.getElementById('measureBtn').click(); ${settle(1000)} } return true; })()`, sel: `document.getElementById('measureBtn')`, pred: `document.getElementById('measureBtn').getAttribute('aria-pressed') === 'true'` }
];

module.exports = { CONFIGS, SCENARIOS, setupJs };
