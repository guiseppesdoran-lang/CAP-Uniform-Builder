// Every badge the galleries offer, with its CAPR 39-1 Attachment 4 family and its artwork for each
// kind of uniform. Generated from data/asset-map-badges.json (old gallery id -> new asset ids); the
// family decides where the badge is worn:
//   aviation      OLP   over the left pocket (CAP aviation badges; only one is worn, 4.1.5.2.2.4.1)
//   chaplain      OLPA  over the left pocket, above the aviation badge (always highest)
//   occupational  OLPU  over the left pocket, under the aviation badge
//   specialty     LP/RP specialty track badges: first on the left pocket, second on the right
//   service       LP    CAP Senior Advisory Group, Command Council, NEC, National Board, Volunteer
//                       University (10.2.4; always left, only one worn)
//   national-staff RP   National Commander's Staff badge (always right)
//   command       ON/UN command insignia pin: over the nametag (current), under it (graduated)
//   rocketry, marksmanship, cadet-specialty: cadet-only badges (4.1.5.2.2.4.2)
// dress = metal/enamel art (blues and corporate dress), field = subdued OCP/ABU embroidery,
// cloth = blue embroidered (flight suits, CFU, blue field), mini = miniature (mess dress, semi-formal).
(function(root, factory){
  const api = factory();
  if(typeof module === 'object' && module.exports) module.exports = api;
  if(root) root.CAPUBBadgeCatalog = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(){
  'use strict';
  const BADGES = {
    "CAPPilot1_FA9D33EA587D8": { family: "aviation", name: "Pilot Badge", dress: "pilot", field: "pilot-field", cloth: "cloth-pilot-wings", mini: "pilot-mini" },
    "CAPSeniorPilot1_D9725AE959752": { family: "aviation", name: "Senior Pilot Badge", dress: "senior-pilot", field: "senior-pilot-field", cloth: "cloth-pilot-wings-senior", mini: "senior-pilot-mini" },
    "CAPMasterPilot1_621A0E2ED15DA": { family: "aviation", name: "Command Pilot Badge", dress: "master-pilot", field: "master-pilot-field", cloth: "cloth-command-pilot-wings", mini: "master-pilot-mini" },
    "AirCrew1_DB3F0FCC3650F": { family: "aviation", name: "Air Crew Badge", dress: "aircrew", field: "aircrew-field", cloth: "cloth-aircrew-basic", mini: "aircrew-mini" },
    "SeniorAirCrew1_B289BAE6E515C": { family: "aviation", name: "Senior Air Crew Badge", dress: "senior-aircrew", field: "senior-aircrew-field", cloth: "cloth-aircrew-senior", mini: "senior-aircrew-mini" },
    "MasterAirCrew1_72AC4CAE7A310": { family: "aviation", name: "Master Air Crew Badge", dress: "master-aircrew", field: "master-aircrew-field", cloth: "cloth-aircrew-master", mini: "master-aircrew-mini" },
    "observer_badge": { family: "aviation", name: "Observer Badge", dress: "observer", field: "observer-field", cloth: "cloth-observer-wings", mini: "observer-mini" },
    "SeniorObserver1_0E35802A29801": { family: "aviation", name: "Senior Observer Badge", dress: "senior-observer", field: "senior-observer-field", cloth: "cloth-observer-wings-senior", mini: "senior-observer-mini" },
    "MasterObserver1_1B88D5071FD5C": { family: "aviation", name: "Master Observer Badge", dress: "master-observer", field: "master-observer-field", cloth: "cloth-observer-wings-master", mini: "master-observer-mini" },
    "GliderPilot1_7BFB287379918": { family: "aviation", name: "Glider Pilot Badge", dress: "glider-pilot", field: "glider-pilot-field", cloth: "cloth-glider-wings", mini: "glider-pilot-mini" },
    "BalloonPilot1_442D89C94185B": { family: "aviation", name: "Balloon Pilot Badge", dress: "balloon-pilot", field: "balloon-pilot-field", cloth: "cloth-balloon-wings", mini: "balloon-pilot-mini" },
    "solo_badge": { family: "aviation", name: "Solo Badge", dress: "solo", field: "solo-field", cloth: "cloth-solo-wings", mini: null },
    "pre_solo_badge": { family: "aviation", name: "Pre-Solo Badge", dress: "pre-solo", field: "pre-solo-field", cloth: "cloth-pre-solo-wings", mini: null },
    "uas_pilot_basic_badge": { family: "aviation", name: "sUAS Pilot Badge", dress: "cap-suas-pilot", field: "cap-suas-pilot-field", cloth: "cloth-suas-basic-pilot", mini: "cap-suas-pilot-mini" },
    "uas_pilot_senior_badge": { family: "aviation", name: "Senior sUAS Pilot Badge", dress: "uas-pilot-senior", field: "uas-pilot-senior-field", cloth: "cloth-suas-senior-pilot", mini: "uas-pilot-senior-mini" },
    "uas_pilot_master_badge": { family: "aviation", name: "Command sUAS Pilot Badge", dress: "uas-pilot-master", field: "uas-pilot-master-field", cloth: "cloth-suas-command-pilot", mini: "uas-pilot-master-mini" },
    "uas_technician_basic_badge": { family: "aviation", name: "sUAS Technician Badge", dress: "uas-technician-basic", field: "uas-technician-basic-field", cloth: "cloth-suas-basic-technician", mini: "uas-technician-basic-mini" },
    "uas_technician_senior_badge": { family: "aviation", name: "Senior sUAS Technician Badge", dress: "uas-technician-senior", field: "uas-technician-senior-field", cloth: "cloth-suas-senior-technician", mini: "uas-technician-senior-mini" },
    "uas_technician_master_badge": { family: "aviation", name: "Master sUAS Technician Badge", dress: "uas-technician-master", field: "uas-technician-master-field", cloth: "cloth-suas-master-technician", mini: "uas-technician-master-mini" },
    "emergency_services_badge": { family: "specialty", name: "Emergency Services Badge", dress: "enamel-emergency-services", field: null, cloth: null, mini: null },
    "senior_emergency_services_badge": { family: "specialty", name: "Senior Emergency Services Badge", dress: "enamel-senior-es", field: null, cloth: null, mini: null },
    "master_emergency_services_badge": { family: "specialty", name: "Master Emergency Services Badge", dress: "enamel-master-es", field: null, cloth: null, mini: null },
    "ground_team_basic_badge": { family: "occupational", name: "Ground Team Badge", dress: "ground-team-basic", field: "ground-team-basic-field", cloth: "cloth-ground-team-basic", mini: "ground-team-basic-mini" },
    "senior_ground_team_badge": { family: "occupational", name: "Senior Ground Team Badge", dress: "senior-ground-team", field: "senior-ground-team-field", cloth: "cloth-ground-team-senior", mini: "senior-ground-team-mini" },
    "master_ground_team_badge": { family: "occupational", name: "Master Ground Team Badge", dress: "master-ground-team", field: "master-ground-team-field", cloth: "cloth-ground-team-master", mini: "master-ground-team-mini" },
    "basic_incident_commander_badge": { family: "occupational", name: "Basic Incident Commander Badge (IC3)", dress: "basic-incident-commander", field: "basic-incident-commander-field", cloth: "cloth-incident-commander-basic", mini: "basic-incident-commander-mini" },
    "incident_commander_2_badge": { family: "occupational", name: "Senior Incident Commander Badge (IC2)", dress: "incident-commander-2", field: "incident-commander-2-field", cloth: "cloth-incident-commander-senior", mini: "incident-commander-2-mini" },
    "incident_commander_1_badge": { family: "occupational", name: "Master Incident Commander Badge (IC1)", dress: "incident-commander-1", field: "incident-commander-1-field", cloth: "cloth-incident-commander-master", mini: "incident-commander-1-mini" },
    "emt_basic_badge": { family: "occupational", name: "EMT Basic Badge", dress: "enamel-emt-basic", field: "enamel-emt-basic-field", cloth: "cloth-emt-basic", mini: "enamel-emt-basic-mini" },
    "emt_intermediate": { family: "occupational", name: "EMT Intermediate Badge", dress: "enamel-emt-intermediate", field: "enamel-emt-intermediate-field", cloth: null, mini: "enamel-emt-intermediate-mini" },
    "emt_paramedic": { family: "occupational", name: "EMT Paramedic Badge", dress: "enamel-emt-paramedic", field: "enamel-emt-paramedic-field", cloth: null, mini: "enamel-emt-paramedic-mini" },
    "medical_officer": { family: "occupational", name: "Medical Officer Badge", dress: "medical-officer", field: "medical-officer-field", cloth: "cloth-medical-officer", mini: null },
    "nurse_officer": { family: "occupational", name: "Nurse Officer Badge", dress: "nurse", field: "nurse-field", cloth: "cloth-nurse", mini: null },
    "christian_chaplin": { family: "chaplain", name: "Christian Chaplain Badge", dress: "enamel-christian-chaplin", field: "enamel-christian-chaplin-field", cloth: "cloth-christian-chaplain", mini: null },
    "jewish_chaplin": { family: "chaplain", name: "Jewish Chaplain Badge", dress: "enamel-jewish-chaplin", field: "enamel-jewish-chaplin-field", cloth: "cloth-jewish-chaplain", mini: null },
    "muslim_chaplin": { family: "chaplain", name: "Muslim Chaplain Badge", dress: "enamel-muslim-chaplin", field: "enamel-muslim-chaplin-field", cloth: null, mini: null },
    "buddist_chaplin": { family: "chaplain", name: "Buddhist Chaplain Badge", dress: "enamel-buddist-chaplin", field: "enamel-buddist-chaplin-field", cloth: null, mini: null },
    "legal_officer": { family: "occupational", name: "Legal Officer Badge", dress: "legal-officer", field: "legal-officer-field", cloth: "cloth-legal-officer-badge", mini: null },
    "squadron_commander_badge": { family: "command", name: "Squadron Commander Badge", dress: "squadron-commander", field: "squadron-commander-field", cloth: "cloth-squadron-commander", mini: null },
    "group_commander_badge": { family: "command", name: "Group Commander Badge", dress: "group-commander", field: "group-commander-field", cloth: "cloth-group-commander", mini: null },
    "senior_advisory_group_badge": { family: "service", name: "Senior Advisory Group Badge", dress: "enamel-senior-advisory-group", field: null, cloth: null, mini: null },
    "national_executive_committee_badge": { family: "service", name: "National Executive Committee Badge", dress: "enamel-national-executive-committee", field: null, cloth: null, mini: null },
    "command_council_badge": { family: "service", name: "Command Council Badge", dress: "enamel-command-council", field: null, cloth: null, mini: null },
    "cap_national_command_board_badge": { family: "service", name: "CAP National Command Board Badge", dress: "enamel-cap-national-command-board", field: null, cloth: null, mini: null },
    "national_staff_badge": { family: "national-staff", name: "National Staff Badge", dress: "national-staff", field: null, cloth: null, mini: null },
    "communications_technician_badge": { family: "specialty", name: "Communications Technician Badge", dress: "enamel-comms-tech", field: null, cloth: null, mini: null },
    "communications_senior_badge": { family: "specialty", name: "Communications Senior Badge", dress: "enamel-comms-senior", field: null, cloth: null, mini: null },
    "communications_master_badge": { family: "specialty", name: "Communications Master Badge", dress: "enamel-comms-master", field: null, cloth: null, mini: null },
    "information_technology_technician_badge": { family: "specialty", name: "Information Technology Technician Badge", dress: "enamel-it-tech", field: null, cloth: null, mini: null },
    "information_technology_senior_badge": { family: "specialty", name: "Information Technology Senior Badge", dress: "enamel-it-senior", field: null, cloth: null, mini: null },
    "information_technology_master_badge": { family: "specialty", name: "Information Technology Master Badge", dress: "enamel-it-master", field: null, cloth: null, mini: null },
    "historian_technicianIbadge": { family: "specialty", name: "Historian Technician Badge", dress: "enamel-historian-tech", field: null, cloth: null, mini: null },
    "historian_senior_badge": { family: "specialty", name: "Historian Senior Badge", dress: "enamel-historian-senior", field: null, cloth: null, mini: null },
    "historian_master_badge": { family: "specialty", name: "Historian Master Badge", dress: "enamel-historian-master", field: null, cloth: null, mini: null },
    "administration_technician_badge": { family: "specialty", name: "Administration Technician Badge", dress: "enamel-admin-tech", field: null, cloth: null, mini: null },
    "administration_senior_badge": { family: "specialty", name: "Administration Senior Badge", dress: "enamel-admin-senior", field: null, cloth: null, mini: null },
    "administration_master_badge": { family: "specialty", name: "Administration Master Badge", dress: "enamel-admin-master", field: null, cloth: null, mini: null },
    "aerospace_education_technician_badge": { family: "specialty", name: "Aerospace Education Technician Badge", dress: "enamel-aerospace-education-technician", field: null, cloth: null, mini: null },
    "aerospace_education_senior_badge": { family: "specialty", name: "Aerospace Education Senior Badge", dress: "enamel-aerospace-senior", field: null, cloth: null, mini: null },
    "aerospace_education_master_badge": { family: "specialty", name: "Aerospace Education Master Badge", dress: "enamel-aerospace-education-master", field: null, cloth: null, mini: null },
    "finance_technician_badge": { family: "specialty", name: "Finance Technician Badge", dress: "enamel-finance-technician", field: null, cloth: null, mini: null },
    "finance_senior_badge": { family: "specialty", name: "Finance Senior Badge", dress: "enamel-finance-senior", field: null, cloth: null, mini: null },
    "finance_master_badge": { family: "specialty", name: "Finance Master Badge", dress: "enamel-finance-master", field: null, cloth: null, mini: null },
    "volunteer_university_instructor_badge": { family: "service", name: "Volunteer University Instructor Badge", dress: "enamel-vol-u", field: null, cloth: "cloth-volunteer-university-instructor", mini: "enamel-vol-u-mini" },
    "cadet_programs_technician_badge": { family: "specialty", name: "Cadet Programs Technician Badge", dress: "enamel-cadet-programs-technician-badge-v2", field: null, cloth: null, mini: null },
    "cadet_programs_senior_badge": { family: "specialty", name: "Cadet Programs Senior Badge", dress: "enamel-cadet-programs-senior-badge-v2", field: null, cloth: null, mini: null },
    "cadet_programs_master_badge": { family: "specialty", name: "Cadet Programs Master Badge", dress: "enamel-cadet-programs-master-badge-v2", field: null, cloth: null, mini: null },
    "cadet_programs_badge": { family: "specialty", name: "Cadet Programs Badge", dress: "enamel-cadet-programs", field: null, cloth: null, mini: null },
    "logistics_technician_badge": { family: "specialty", name: "Logistics Technician Badge", dress: "enamel-logistics-tech", field: null, cloth: null, mini: null },
    "logistics_senior_badge": { family: "specialty", name: "Logistics Senior Badge", dress: "enamel-logistics-senior", field: null, cloth: null, mini: null },
    "logistics_master_badge": { family: "specialty", name: "Logistics Master Badge", dress: "enamel-logistics-master", field: null, cloth: null, mini: null },
    "operations_technician_badge": { family: "specialty", name: "Operations Technician Badge", dress: "enamel-ops-tech", field: null, cloth: null, mini: null },
    "operations_senior_badge": { family: "specialty", name: "Operations Senior Badge", dress: "enamel-ops-senior", field: null, cloth: null, mini: null },
    "operations_master_badge": { family: "specialty", name: "Operations Master Badge", dress: "enamel-ops-master", field: null, cloth: null, mini: null },
    "personnel_technician_badge": { family: "specialty", name: "Personnel Technician Badge", dress: "enamel-personnel-tech", field: null, cloth: null, mini: null },
    "personnel_senior_badge": { family: "specialty", name: "Personnel Senior Badge", dress: "enamel-personnel-senior", field: null, cloth: null, mini: null },
    "personnel_master_badge": { family: "specialty", name: "Personnel Master Badge", dress: "enamel-personnel-master", field: null, cloth: null, mini: null },
    "professional_development_technician_badge": { family: "specialty", name: "Professional Development Technician Badge", dress: "enamel-professional-development-tech", field: null, cloth: null, mini: null },
    "professional_development_senior_badge": { family: "specialty", name: "Professional Development Senior Badge", dress: "enamel-professional-development-senior", field: null, cloth: null, mini: null },
    "professional_development_master_badge": { family: "specialty", name: "Professional Development Master Badge", dress: "enamel-professional-development-master", field: null, cloth: null, mini: null },
    "public_affairs_technician_badge": { family: "specialty", name: "Public Affairs Technician Badge", dress: "enamel-public-affairs-tech", field: null, cloth: null, mini: null },
    "public_affairs_senior_badge": { family: "specialty", name: "Public Affairs Senior Badge", dress: "enamel-public-affairs-senior", field: null, cloth: null, mini: null },
    "public_affairs_master_badge": { family: "specialty", name: "Public Affairs Master Badge", dress: "enamel-public-affairs-master", field: null, cloth: null, mini: null },
    "recruiting_retention_technician_badge": { family: "specialty", name: "Recruiting and Retention Technician Badge", dress: "enamel-recruiter-tech", field: null, cloth: null, mini: null },
    "recruiting_retention_senior_badge": { family: "specialty", name: "Recruiting and Retention Senior Badge", dress: "enamel-recruiter-senior", field: null, cloth: null, mini: null },
    "recruiting_retention_master_badge": { family: "specialty", name: "Recruiting and Retention Master Badge", dress: "enamel-recruiter-master", field: null, cloth: null, mini: null },
    "safety_technician_badge": { family: "specialty", name: "Safety Technician Badge", dress: "enamel-safety-tech", field: null, cloth: null, mini: null },
    "safety_senior_badge": { family: "specialty", name: "Safety Senior Badge", dress: "enamel-safety-senior", field: null, cloth: null, mini: null },
    "safety_master_badge": { family: "specialty", name: "Safety Master Badge", dress: "enamel-safety-master", field: null, cloth: null, mini: null },
    "inspector_general_technician_badge": { family: "specialty", name: "Inspector General Technician Badge", dress: "enamel-ig-tech", field: null, cloth: null, mini: null },
    "inspector_general_senior_badge": { family: "specialty", name: "Inspector General Senior Badge", dress: "enamel-ig-senior", field: null, cloth: null, mini: null },
    "inspector_general_master_badge": { family: "specialty", name: "Inspector General Master Badge", dress: "enamel-ig-master", field: null, cloth: null, mini: null },
    "stan_eval_tech_badge": { family: "specialty", name: "Standardization/Evaluation Technician Badge", dress: "enamel-stan-eval-tech", field: null, cloth: null, mini: null },
    "stan_eval_senior_badge": { family: "specialty", name: "Standardization/Evaluation Senior Badge", dress: "enamel-stan-eval-senior", field: null, cloth: null, mini: null },
    "stan_eval_master_badge": { family: "specialty", name: "Standardization/Evaluation Master Badge", dress: "enamel-stan-eval-master", field: null, cloth: null, mini: null },
    "cdi_technician_badge": { family: "specialty", name: "Character Development Instructor Technician Badge", dress: "enamel-cdi-tech", field: null, cloth: null, mini: null },
    "cdi_senior_badge": { family: "specialty", name: "Character Development Instructor Senior Badge", dress: "enamel-cdi-senior", field: null, cloth: null, mini: null },
    "cdi_master_badge": { family: "specialty", name: "Character Development Instructor Master Badge", dress: "enamel-cdi-master", field: null, cloth: null, mini: null },
    "drug_demand_reduction_basic_badge": { family: "specialty", name: "Drug Demand Reduction Basic Badge", dress: "enamel-drug-demand-reduction-basic", field: null, cloth: null, mini: null },
    "drug_demand_reduction_technician_badge": { family: "specialty", name: "Drug Demand Reduction Technician Badge", dress: "enamel-drug-demand-reduction-technician", field: null, cloth: null, mini: null },
    "drug_demand_reduction_senior_badge": { family: "specialty", name: "Drug Demand Reduction Senior Badge", dress: "enamel-drug-demand-reduction-senior", field: null, cloth: null, mini: null },
    "drug_demand_reduction_master_badge": { family: "specialty", name: "Drug Demand Reduction Master Badge", dress: "enamel-drug-demand-reduction-master", field: null, cloth: null, mini: null },
    "stem_badges": { family: "cadet-specialty", name: "Cadet STEM Badge", dress: "enamel-stem-basic", field: null, cloth: null, mini: null,
      levels: [["basic", "Basic", "enamel-stem-basic"], ["advanced", "Advanced", "enamel-stem-advanced"], ["master", "Master", "enamel-stem-master"]] },
    "cyber_badges": { family: "cadet-specialty", name: "Cadet Cyber Badge", dress: "enamel-cyber-basic", field: null, cloth: null, mini: null,
      levels: [["basic", "Basic", "enamel-cyber-basic"], ["advanced", "Advanced", "enamel-cyber-advanced"], ["master", "Master", "enamel-cyber-master"]] },
    "model_rocketry_badge": { family: "rocketry", name: "Model Rocketry Badge", dress: "model-rocketry", field: null, cloth: null, mini: null },
    "nra_marksman_badge": { family: "marksmanship", name: "NRA Marksmanship Badge", dress: "enamel-nra-pro-marksman", field: null, cloth: null, mini: null,
      levels: [["pro-marksman", "Pro-Marksman", "enamel-nra-pro-marksman"], ["marksman", "Marksman", "enamel-nra-marksman"],
        ["marksman-first-class", "Marksman First Class", "enamel-nra-marksman-first-class"], ["sharpshooter", "Sharpshooter", "enamel-nra-sharpshooter"],
        ["expert", "Expert", "enamel-nra-expert"], ["distinguished-expert", "Distinguished Expert", "enamel-nra-distinguished-expert"]] }
  };
  // Precedence of the families on the wearer's left (4.1.5.2.2.4.1): chaplain highest, then CAP
  // aviation, then occupational.
  const LEFT_STACK_ORDER = ['chaplain', 'aviation', 'occupational'];
  function get(id){ return BADGES[id] || null; }
  function family(id){ const b = BADGES[id]; return b ? b.family : null; }
  // A badge earned in levels (STEM, Cyber, NRA): [key, label, dress art], lowest first.
  function levels(id){ const b = BADGES[id]; return (b && b.levels) || null; }
  function level(id, key){
    const list = levels(id);
    if(!list) return null;
    return list.find(l => l[0] === key) || list[0];
  }
  // The artwork for a badge on a kind of uniform; null when none exists in that form. A level picks
  // its own dress art.
  function art(id, form, levelKey){
    const b = BADGES[id];
    if(!b) return null;
    const lv = level(id, levelKey);
    if(lv && (form === 'dress' || (form === 'mini' && !b.mini))) return form === 'dress' ? lv[2] : null;
    return b[form] || null;
  }
  return { BADGES, LEFT_STACK_ORDER, get, family, art, levels, level };
});
