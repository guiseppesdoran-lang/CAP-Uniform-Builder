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
//
// field is set only for a badge with GENUINE field artwork: the original silver-on-dark-blue set in
// artwork-samples/assets/field (the wings and the aviation badges, ground team, incident commander,
// medical, nurse, legal officer, EMT and chaplain badges: Attachment 7's own sizes, the document's
// utility badge list, and the squadron and group commander pins). Ethan's ruling (LIVE-FIELD B6):
// dress enamel art never appears on a field uniform. The 56 specialty track badges (communications,
// IT, historian, administration, aerospace education, finance, cadet programs, logistics, operations,
// personnel, professional development, public affairs, recruiting, safety, inspector general,
// stan/eval, CDI, drug demand reduction) and the three Emergency Services badges have only an
// ESTIMATED-size recolour of the enamel dress art (assets/field/<dress>-field, 'finished badge art
// recoloured ... Derived from <dress>'), which is not field artwork: their field is null, so a field
// uniform does not offer or draw them, and they stay on the dress uniforms.
// embroidered is the art for a badge worked into the cloth itself (the polo, 5.3.2.1.1: one CAP aviation, occupational or specialty
// track badge over the name): the field twin where the badge has one, so a specialty track badge carries that recolour here and
// only here (art(id, 'embroidered') is embroidered, else field); the field uniforms keep reading field alone.
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
    "emergency_services_badge": { family: "specialty", name: "Emergency Services Badge", dress: "enamel-emergency-services", field: null, embroidered: "enamel-emergency-services-field", cloth: null, mini: null },
    "senior_emergency_services_badge": { family: "specialty", name: "Senior Emergency Services Badge", dress: "enamel-senior-es", field: null, embroidered: "enamel-senior-es-field", cloth: null, mini: null },
    "master_emergency_services_badge": { family: "specialty", name: "Master Emergency Services Badge", dress: "enamel-master-es", field: null, embroidered: "enamel-master-es-field", cloth: null, mini: null },
    "ground_team_basic_badge": { family: "occupational", name: "Ground Team Badge", dress: "ground-team-basic", field: "ground-team-basic-field", cloth: "cloth-ground-team-basic", mini: "ground-team-basic-mini" },
    "senior_ground_team_badge": { family: "occupational", name: "Senior Ground Team Badge", dress: "senior-ground-team", field: "senior-ground-team-field", cloth: "cloth-ground-team-senior", mini: "senior-ground-team-mini" },
    "master_ground_team_badge": { family: "occupational", name: "Master Ground Team Badge", dress: "master-ground-team", field: "master-ground-team-field", cloth: "cloth-ground-team-master", mini: "master-ground-team-mini" },
    "basic_incident_commander_badge": { family: "occupational", name: "Basic Incident Commander Badge", dress: "basic-incident-commander", field: "basic-incident-commander-field", cloth: "cloth-incident-commander-basic", mini: "basic-incident-commander-mini" },
    "incident_commander_2_badge": { family: "occupational", name: "Senior Incident Commander Badge", dress: "incident-commander-2", field: "incident-commander-2-field", cloth: "cloth-incident-commander-senior", mini: "incident-commander-2-mini" },
    "incident_commander_1_badge": { family: "occupational", name: "Master Incident Commander Badge", dress: "incident-commander-1", field: "incident-commander-1-field", cloth: "cloth-incident-commander-master", mini: "incident-commander-1-mini" },
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
    "communications_technician_badge": { family: "specialty", name: "Communications Technician Badge", dress: "enamel-comms-tech", field: null, embroidered: "enamel-comms-tech-field", cloth: null, mini: null },
    "communications_senior_badge": { family: "specialty", name: "Communications Senior Badge", dress: "enamel-comms-senior", field: null, embroidered: "enamel-comms-senior-field", cloth: null, mini: null },
    "communications_master_badge": { family: "specialty", name: "Communications Master Badge", dress: "enamel-comms-master", field: null, embroidered: "enamel-comms-master-field", cloth: null, mini: null },
    "information_technology_technician_badge": { family: "specialty", name: "Information Technology Technician Badge", dress: "enamel-it-tech", field: null, embroidered: "enamel-it-tech-field", cloth: null, mini: null },
    "information_technology_senior_badge": { family: "specialty", name: "Information Technology Senior Badge", dress: "enamel-it-senior", field: null, embroidered: "enamel-it-senior-field", cloth: null, mini: null },
    "information_technology_master_badge": { family: "specialty", name: "Information Technology Master Badge", dress: "enamel-it-master", field: null, embroidered: "enamel-it-master-field", cloth: null, mini: null },
    "historian_technicianIbadge": { family: "specialty", name: "Historian Technician Badge", dress: "enamel-historian-tech", field: null, embroidered: "enamel-historian-tech-field", cloth: null, mini: null },
    "historian_senior_badge": { family: "specialty", name: "Historian Senior Badge", dress: "enamel-historian-senior", field: null, embroidered: "enamel-historian-senior-field", cloth: null, mini: null },
    "historian_master_badge": { family: "specialty", name: "Historian Master Badge", dress: "enamel-historian-master", field: null, embroidered: "enamel-historian-master-field", cloth: null, mini: null },
    "administration_technician_badge": { family: "specialty", name: "Administration Technician Badge", dress: "enamel-admin-tech", field: null, embroidered: "enamel-admin-tech-field", cloth: null, mini: null },
    "administration_senior_badge": { family: "specialty", name: "Administration Senior Badge", dress: "enamel-admin-senior", field: null, embroidered: "enamel-admin-senior-field", cloth: null, mini: null },
    "administration_master_badge": { family: "specialty", name: "Administration Master Badge", dress: "enamel-admin-master", field: null, embroidered: "enamel-admin-master-field", cloth: null, mini: null },
    "aerospace_education_technician_badge": { family: "specialty", name: "Aerospace Education Technician Badge", dress: "enamel-aerospace-education-technician", field: null, embroidered: "enamel-aerospace-education-technician-field", cloth: null, mini: null },
    "aerospace_education_senior_badge": { family: "specialty", name: "Aerospace Education Senior Badge", dress: "enamel-aerospace-senior", field: null, embroidered: "enamel-aerospace-senior-field", cloth: null, mini: null },
    "aerospace_education_master_badge": { family: "specialty", name: "Aerospace Education Master Badge", dress: "enamel-aerospace-education-master", field: null, embroidered: "enamel-aerospace-education-master-field", cloth: null, mini: null },
    "finance_technician_badge": { family: "specialty", name: "Finance Technician Badge", dress: "enamel-finance-technician", field: null, embroidered: "enamel-finance-technician-field", cloth: null, mini: null },
    "finance_senior_badge": { family: "specialty", name: "Finance Senior Badge", dress: "enamel-finance-senior", field: null, embroidered: "enamel-finance-senior-field", cloth: null, mini: null },
    "finance_master_badge": { family: "specialty", name: "Finance Master Badge", dress: "enamel-finance-master", field: null, embroidered: "enamel-finance-master-field", cloth: null, mini: null },
    "volunteer_university_instructor_badge": { family: "service", name: "Volunteer University Instructor Badge", dress: "enamel-vol-u", field: null, cloth: "cloth-volunteer-university-instructor", mini: "enamel-vol-u-mini" },
    "cadet_programs_technician_badge": { family: "specialty", name: "Cadet Programs Technician Badge", dress: "enamel-cadet-programs-technician-badge-v2", field: null, embroidered: "enamel-cadet-programs-technician-badge-v2-field", cloth: null, mini: null },
    "cadet_programs_senior_badge": { family: "specialty", name: "Cadet Programs Senior Badge", dress: "enamel-cadet-programs-senior-badge-v2", field: null, embroidered: "enamel-cadet-programs-senior-badge-v2-field", cloth: null, mini: null },
    "cadet_programs_master_badge": { family: "specialty", name: "Cadet Programs Master Badge", dress: "enamel-cadet-programs-master-badge-v2", field: null, embroidered: "enamel-cadet-programs-master-badge-v2-field", cloth: null, mini: null },
    "cadet_programs_badge": { family: "specialty", name: "Cadet Programs Badge", dress: "enamel-cadet-programs", field: null, embroidered: "enamel-cadet-programs-field", cloth: null, mini: null },
    "logistics_technician_badge": { family: "specialty", name: "Logistics Technician Badge", dress: "enamel-logistics-tech", field: null, embroidered: "enamel-logistics-tech-field", cloth: null, mini: null },
    "logistics_senior_badge": { family: "specialty", name: "Logistics Senior Badge", dress: "enamel-logistics-senior", field: null, embroidered: "enamel-logistics-senior-field", cloth: null, mini: null },
    "logistics_master_badge": { family: "specialty", name: "Logistics Master Badge", dress: "enamel-logistics-master", field: null, embroidered: "enamel-logistics-master-field", cloth: null, mini: null },
    "operations_technician_badge": { family: "specialty", name: "Operations Technician Badge", dress: "enamel-ops-tech", field: null, embroidered: "enamel-ops-tech-field", cloth: null, mini: null },
    "operations_senior_badge": { family: "specialty", name: "Operations Senior Badge", dress: "enamel-ops-senior", field: null, embroidered: "enamel-ops-senior-field", cloth: null, mini: null },
    "operations_master_badge": { family: "specialty", name: "Operations Master Badge", dress: "enamel-ops-master", field: null, embroidered: "enamel-ops-master-field", cloth: null, mini: null },
    "personnel_technician_badge": { family: "specialty", name: "Personnel Technician Badge", dress: "enamel-personnel-tech", field: null, embroidered: "enamel-personnel-tech-field", cloth: null, mini: null },
    "personnel_senior_badge": { family: "specialty", name: "Personnel Senior Badge", dress: "enamel-personnel-senior", field: null, embroidered: "enamel-personnel-senior-field", cloth: null, mini: null },
    "personnel_master_badge": { family: "specialty", name: "Personnel Master Badge", dress: "enamel-personnel-master", field: null, embroidered: "enamel-personnel-master-field", cloth: null, mini: null },
    "professional_development_technician_badge": { family: "specialty", name: "Professional Development Technician Badge", dress: "enamel-professional-development-tech", field: null, embroidered: "enamel-professional-development-tech-field", cloth: null, mini: null },
    "professional_development_senior_badge": { family: "specialty", name: "Professional Development Senior Badge", dress: "enamel-professional-development-senior", field: null, embroidered: "enamel-professional-development-senior-field", cloth: null, mini: null },
    "professional_development_master_badge": { family: "specialty", name: "Professional Development Master Badge", dress: "enamel-professional-development-master", field: null, embroidered: "enamel-professional-development-master-field", cloth: null, mini: null },
    "public_affairs_technician_badge": { family: "specialty", name: "Public Affairs Technician Badge", dress: "enamel-public-affairs-tech", field: null, embroidered: "enamel-public-affairs-tech-field", cloth: null, mini: null },
    "public_affairs_senior_badge": { family: "specialty", name: "Public Affairs Senior Badge", dress: "enamel-public-affairs-senior", field: null, embroidered: "enamel-public-affairs-senior-field", cloth: null, mini: null },
    "public_affairs_master_badge": { family: "specialty", name: "Public Affairs Master Badge", dress: "enamel-public-affairs-master", field: null, embroidered: "enamel-public-affairs-master-field", cloth: null, mini: null },
    "recruiting_retention_technician_badge": { family: "specialty", name: "Recruiting and Retention Technician Badge", dress: "enamel-recruiter-tech", field: null, embroidered: "enamel-recruiter-tech-field", cloth: null, mini: null },
    "recruiting_retention_senior_badge": { family: "specialty", name: "Recruiting and Retention Senior Badge", dress: "enamel-recruiter-senior", field: null, embroidered: "enamel-recruiter-senior-field", cloth: null, mini: null },
    "recruiting_retention_master_badge": { family: "specialty", name: "Recruiting and Retention Master Badge", dress: "enamel-recruiter-master", field: null, embroidered: "enamel-recruiter-master-field", cloth: null, mini: null },
    "safety_technician_badge": { family: "specialty", name: "Safety Technician Badge", dress: "enamel-safety-tech", field: null, embroidered: "enamel-safety-tech-field", cloth: null, mini: null },
    "safety_senior_badge": { family: "specialty", name: "Safety Senior Badge", dress: "enamel-safety-senior", field: null, embroidered: "enamel-safety-senior-field", cloth: null, mini: null },
    "safety_master_badge": { family: "specialty", name: "Safety Master Badge", dress: "enamel-safety-master", field: null, embroidered: "enamel-safety-master-field", cloth: null, mini: null },
    "inspector_general_technician_badge": { family: "specialty", name: "Inspector General Technician Badge", dress: "enamel-ig-tech", field: null, embroidered: "enamel-ig-tech-field", cloth: null, mini: null },
    // 10.5.1: the Inspector General badge may carry a gold star while the member serves as a National
    // Complaints Resolution Officer or a National Compliance Inspection Officer; one device only.
    "inspector_general_senior_badge": { family: "specialty", name: "Inspector General Senior Badge", dress: "enamel-ig-senior", field: null, embroidered: "enamel-ig-senior-field", cloth: null, mini: null,
      levels: [["standard", "No device", "enamel-ig-senior"], ["gold-star", "Gold star (National Complaints Resolution or Compliance Inspection Officer)", "enamel-ig-senior-gold"]] },
    "inspector_general_master_badge": { family: "specialty", name: "Inspector General Master Badge", dress: "enamel-ig-master", field: null, embroidered: "enamel-ig-master-field", cloth: null, mini: null,
      levels: [["standard", "No device", "enamel-ig-master"], ["gold-star", "Gold star (National Complaints Resolution or Compliance Inspection Officer)", "enamel-ig-master-gold"]] },
    "stan_eval_tech_badge": { family: "specialty", name: "Standardization/Evaluation Technician Badge", dress: "enamel-stan-eval-tech", field: null, embroidered: "enamel-stan-eval-tech-field", cloth: null, mini: null },
    "stan_eval_senior_badge": { family: "specialty", name: "Standardization/Evaluation Senior Badge", dress: "enamel-stan-eval-senior", field: null, embroidered: "enamel-stan-eval-senior-field", cloth: null, mini: null },
    "stan_eval_master_badge": { family: "specialty", name: "Standardization/Evaluation Master Badge", dress: "enamel-stan-eval-master", field: null, embroidered: "enamel-stan-eval-master-field", cloth: null, mini: null },
    "cdi_technician_badge": { family: "specialty", name: "Character Development Instructor Technician Badge", dress: "enamel-cdi-tech", field: null, embroidered: "enamel-cdi-tech-field", cloth: null, mini: null },
    "cdi_senior_badge": { family: "specialty", name: "Character Development Instructor Senior Badge", dress: "enamel-cdi-senior", field: null, embroidered: "enamel-cdi-senior-field", cloth: null, mini: null },
    "cdi_master_badge": { family: "specialty", name: "Character Development Instructor Master Badge", dress: "enamel-cdi-master", field: null, embroidered: "enamel-cdi-master-field", cloth: null, mini: null },
    "drug_demand_reduction_basic_badge": { family: "specialty", name: "Drug Demand Reduction Basic Badge", dress: "enamel-drug-demand-reduction-basic", field: null, embroidered: "enamel-drug-demand-reduction-basic-field", cloth: null, mini: null },
    "drug_demand_reduction_technician_badge": { family: "specialty", name: "Drug Demand Reduction Technician Badge", dress: "enamel-drug-demand-reduction-technician", field: null, embroidered: "enamel-drug-demand-reduction-technician-field", cloth: null, mini: null },
    "drug_demand_reduction_senior_badge": { family: "specialty", name: "Drug Demand Reduction Senior Badge", dress: "enamel-drug-demand-reduction-senior", field: null, embroidered: "enamel-drug-demand-reduction-senior-field", cloth: null, mini: null },
    "drug_demand_reduction_master_badge": { family: "specialty", name: "Drug Demand Reduction Master Badge", dress: "enamel-drug-demand-reduction-master", field: null, embroidered: "enamel-drug-demand-reduction-master-field", cloth: null, mini: null },
    "stem_badges": { family: "cadet-specialty", name: "Cadet STEM Badge", dress: "enamel-stem-basic", field: null, cloth: null, mini: null,
      levels: [["basic", "Basic", "enamel-stem-basic"], ["advanced", "Advanced", "enamel-stem-advanced"], ["master", "Master", "enamel-stem-master"]] },
    "cyber_badges": { family: "cadet-specialty", name: "Cadet Cyber Badge", dress: "enamel-cyber-basic", field: null, cloth: null, mini: null,
      levels: [["basic", "Basic", "enamel-cyber-basic"], ["advanced", "Advanced", "enamel-cyber-advanced"], ["master", "Master", "enamel-cyber-master"]] },
    "model_rocketry_badge": { family: "rocketry", name: "Model Rocketry Badge", dress: "model-rocketry", field: null, cloth: null, mini: null },
    "nra_marksman_badge": { family: "marksmanship", name: "NRA Marksmanship Badge", dress: "enamel-nra-pro-marksman", field: null, cloth: null, mini: null,
      levels: [["pro-marksman", "Pro-Marksman", "enamel-nra-pro-marksman"], ["marksman", "Marksman", "enamel-nra-marksman"],
        ["marksman-first-class", "Marksman First Class", "enamel-nra-marksman-first-class"], ["sharpshooter", "Sharpshooter", "enamel-nra-sharpshooter"],
        ["expert", "Expert", "enamel-nra-expert"], ["distinguished-expert", "Distinguished Expert", "enamel-nra-distinguished-expert-nobar"]],
      // The groups a Distinguished Expert was earned in: one bar for each, hung from the top in this order; the badge is one drawing for each combination (suffix letters in this order).
      bars: { level: "distinguished-expert", base: "enamel-nra-distinguished-expert", list: [["rifle", "Rifle", "r"], ["pistol", "Pistol", "p"], ["shotgun", "Shotgun", "s"]] } }
  };
  // Precedence of the families on the wearer's left (4.1.5.2.2.4.1): chaplain highest, then CAP
  // aviation, then occupational.
  const LEFT_STACK_ORDER = ['chaplain', 'aviation', 'occupational'];
  // Which of two occupational badges is the higher one on the wearer's left. CAPR 39-1 (4.1.5.2.2.4.1, 4.1.9.4.4.1, 4.1.11.1.1.2.3.1,
  // 4.1.12.2.5.1, 4.2.5.1.3.1, 4.2.6.2.7.1) says only that the chaplain badge is worn in the highest position and that two occupational badges
  // are the same size; it states no order between them, and 7.1.1.3.1.5.2 puts all CAP occupational badges in one group. The order below is a
  // project decision, highest first: Incident Commander, Ground Team, then the emergency medical and medical badges, then the others as listed.
  const OCCUPATIONAL_PRECEDENCE = [
    ['incident_commander_1_badge', 'incident_commander_2_badge', 'basic_incident_commander_badge'],
    ['master_ground_team_badge', 'senior_ground_team_badge', 'ground_team_basic_badge'],
    ['emt_paramedic', 'emt_intermediate', 'emt_basic_badge', 'medical_officer', 'nurse_officer']
  ];
  // 0 for the highest tier; a badge in none of them (and any badge of another family) ranks after every tier, so a stable sort keeps those as listed.
  function occupationalRank(id){
    const i = OCCUPATIONAL_PRECEDENCE.findIndex(tier => tier.includes(id));
    return i < 0 ? OCCUPATIONAL_PRECEDENCE.length : i;
  }
  // ---- badges of equal standing -----------------------------------------------------------------------------------------------------
  // Where the regulation leaves the order of two badges to the wearer, the member may wear either one higher. That is true of CAP occupational
  // badges only: the stack paragraphs (4.1.5.2.2.4.1 and its twins for each uniform and cut, 5.1.1.1.2.4, 5.2.1.1.2.6, 7.1.1.3.1.5.2) fix the chaplain
  // badge highest, the CAP aviation badge above the occupational ones and a military aviation badge below the CAP aviation badge, and state no order
  // between two occupational badges; OCCUPATIONAL_PRECEDENCE above is the order the drawing starts from, not the regulation's. The pocket and nametag
  // places have no stack: the member already picks the badge for each of those (State.badgeChoices).
  // The group a badge is of equal standing in, or null when its place in a stack is fixed.
  const EQUAL_STANDING = { occupational: 'Occupational badges' };
  function equalGroup(id){
    const f = family(id);
    return f && Object.prototype.hasOwnProperty.call(EQUAL_STANDING, f) ? f : null;
  }
  const idOf = x => (x && typeof x === 'object') ? x.id : x;
  // The member's order of equal badges is { [group]: [badge id, highest first] }; a group not named has no choice.
  function savedOf(saved, group){
    const list = saved && typeof saved === 'object' && !Array.isArray(saved) && Array.isArray(saved[group]) ? saved[group] : null;
    return list ? list.filter((id, i) => typeof id === 'string' && list.indexOf(id) === i) : [];
  }
  // `items` (badge ids or objects with an `id`), highest first as the drawing would have them: the badges of each group of equal standing take the
  // member's order in the places the group already holds in the list, and every other item stays where it is. A badge the member has no order
  // for keeps its place; with nothing saved the list comes back as it was, so the order of a build with no choice is the drawing's own.
  function arrangeEqual(items, saved){
    const list = Array.isArray(items) ? [...items] : [];
    if(!saved) return list;
    for(const group of Object.keys(EQUAL_STANDING)){
      const mine = savedOf(saved, group);
      if(mine.length < 2) continue;
      const at = [];
      list.forEach((x, i) => { if(equalGroup(idOf(x)) === group && mine.includes(idOf(x))) at.push(i); });
      if(at.length < 2) continue;
      const held = at.map(i => list[i]);
      held.sort((a, b) => mine.indexOf(idOf(a)) - mine.indexOf(idOf(b)));
      at.forEach((i, k) => { list[i] = held[k]; });
    }
    return list;
  }
  // The groups of equal standing with two or more badges in `ids` (highest first as drawn): [{ group, label, ids }], so the page knows where a
  // swap can be offered.
  function equalStacks(ids){
    const out = [];
    for(const group of Object.keys(EQUAL_STANDING)){
      const held = (ids || []).map(idOf).filter(id => equalGroup(id) === group);
      if(held.length >= 2) out.push({ group, label: EQUAL_STANDING[group], ids: held });
    }
    return out;
  }
  // The member's order after `id` moves one place up (dir -1) or down (dir +1) among `shown`, the badges of its group as drawn, highest first. The
  // saved list for the group becomes that order; the saved list of another group is untouched. Nothing moves past an end.
  function moveEqual(saved, group, shown, id, dir){
    const own = (shown || []).filter(x => equalGroup(x) === group);
    const from = own.indexOf(id), to = from + (dir < 0 ? -1 : 1);
    const out = {};
    for(const g of Object.keys(EQUAL_STANDING)){ const list = savedOf(saved, g); if(list.length) out[g] = list; }
    if(from < 0 || to < 0 || to >= own.length || equalGroup(id) !== group) return out;
    const next = [...own];
    next.splice(from, 1);
    next.splice(to, 0, id);
    out[group] = next;
    return out;
  }
  // The member's order after they pick a whole order for a group: `order` (badge ids, highest first) becomes the saved list for the group, kept only for badges of that group, each once; the
  // saved list of another group is untouched. An order of fewer than two badges of the group leaves what was saved for the group as it was.
  function setEqual(saved, group, order){
    const out = {};
    for(const g of Object.keys(EQUAL_STANDING)){ const list = savedOf(saved, g); if(list.length) out[g] = list; }
    if(!Object.prototype.hasOwnProperty.call(EQUAL_STANDING, group)) return out;
    const next = (Array.isArray(order) ? order : []).filter((id, i, all) => typeof id === 'string' && equalGroup(id) === group && all.indexOf(id) === i);
    if(next.length >= 2) out[group] = next;
    return out;
  }
  // What `saved` keeps once only the badges in `selected` are held: the ids still held, in the member's order; a group left with fewer than two
  // badges has no order to keep and is dropped, so a badge taken off never leaves a choice behind for a later build. Anything that is not a group
  // of equal standing, a list of badge ids of that group, is dropped as well. Returns a new object ({} for none).
  function pruneEqual(saved, selected){
    const held = new Set(selected || []);
    const out = {};
    for(const group of Object.keys(EQUAL_STANDING)){
      const list = savedOf(saved, group).filter(id => held.has(id) && equalGroup(id) === group);
      if(list.length >= 2) out[group] = list;
    }
    return out;
  }
  function get(id){ return BADGES[id] || null; }
  function family(id){ const b = BADGES[id]; return b ? b.family : null; }
  // A badge earned in levels (STEM, Cyber, NRA): [key, label, dress art], lowest first.
  function levels(id){ const b = BADGES[id]; return (b && b.levels) || null; }
  function level(id, key){
    const list = levels(id);
    if(!list) return null;
    return list.find(l => l[0] === key) || list[0];
  }
  // The bars a badge can carry at a level ([key, label, letter], in the order they hang), or null when that level has none.
  function bars(id, levelKey){
    const b = BADGES[id];
    if(!b || !b.bars) return null;
    const lv = level(id, levelKey);
    return lv && lv[0] === b.bars.level ? b.bars.list : null;
  }
  // The keys of the bars that are on, in the order they hang and each once; anything that is not a bar of the badge is dropped.
  function barsOn(id, keys){
    const b = BADGES[id];
    if(!b || !b.bars || !Array.isArray(keys)) return [];
    return b.bars.list.map(x => x[0]).filter(k => keys.includes(k));
  }
  // The drawing of the badge with those bars (one drawing for each combination), or null for a badge with no bars.
  function barArt(id, keys){
    const b = BADGES[id];
    if(!b || !b.bars) return null;
    const on = barsOn(id, keys);
    const letters = b.bars.list.filter(x => on.includes(x[0])).map(x => x[2]).join('');
    return `${b.bars.base}-${letters || 'nobar'}`;
  }
  // The artwork for a badge on a kind of uniform; null when none exists in that form. A level picks
  // its own dress art.
  function art(id, form, levelKey, barKeys){
    const b = BADGES[id];
    if(!b) return null;
    const lv = level(id, levelKey);
    if(lv && form === 'dress' && b.bars && lv[0] === b.bars.level) return barArt(id, barKeys) || lv[2];
    if(lv && (form === 'dress' || (form === 'mini' && !b.mini))) return form === 'dress' ? lv[2] : null;
    if(form === 'embroidered') return b.embroidered || b.field || null;
    return b[form] || null;
  }
  // The badges that have genuine field artwork, i.e. the only ones offered and drawn on the OCP, ABU
  // and Corporate Field Uniform (7.1.1.3.1, 5.1.1.1.2.4, 5.2.1.1.2.6).
  function hasField(id){ const b = BADGES[id]; return !!(b && b.field); }
  // The badges the polo can embroider: field art, or an embroidered twin.
  function hasEmbroidered(id){ const b = BADGES[id]; return !!(b && (b.embroidered || b.field)); }
  function fieldIds(){ return Object.keys(BADGES).filter(hasField); }
  // Who wears what (CAPR 39-1 4.1.5.2.2.4.2, 4.1.9.4.4.2, Attachment 4). The STEM, Cyber, Model Rocketry
  // and NRA Marksmanship badges are worn by cadets only; a cadet wears only the badges the chart
  // authorizes for cadets (CAP service badges only by officers and NCOs). The page's picker and the
  // engine's drawing both read these two lists. The sUAS technician badges are aviation badges worn "in the same manner as other
  // aviation badges" (ICL 21-01 to CAPR 39-1, Figure A7-1), awarded to cadets too (CAPR 35-6), so cadets see them as they see the
  // sUAS pilot badges (LIVE13 E124, Ethan: "troup said he didnt see the tech badge").
  const CADET_ONLY = ["model_rocketry_badge", "cyber_badges", "stem_badges", "nra_marksman_badge"];
  const CADET_AUTHORIZED = ["model_rocketry_badge", "cyber_badges", "stem_badges", "nra_marksman_badge", "pre_solo_badge", "solo_badge", "CAPPilot1_FA9D33EA587D8", "observer_badge", "SeniorObserver1_0E35802A29801", "AirCrew1_DB3F0FCC3650F", "SeniorAirCrew1_B289BAE6E515C", "MasterAirCrew1_72AC4CAE7A310", "uas_pilot_basic_badge", "uas_pilot_senior_badge", "uas_pilot_master_badge", "uas_technician_basic_badge", "uas_technician_senior_badge", "uas_technician_master_badge", "ground_team_basic_badge", "senior_ground_team_badge", "master_ground_team_badge", "emt_basic_badge", "emt_intermediate", "emt_paramedic", "emergency_services_badge", "information_technology_technician_badge", "historian_technicianIbadge", "communications_technician_badge", "communications_senior_badge", "communications_master_badge"];
  const cadetOnlySet = new Set(CADET_ONLY), cadetAuthorizedSet = new Set(CADET_AUTHORIZED);
  // 'cadet' | 'senior' (anything else is not checked).
  function eligibleFor(id, membership){
    if(membership === 'cadet') return cadetAuthorizedSet.has(id);
    if(membership === 'senior') return !cadetOnlySet.has(id);
    return true;
  }
  return { BADGES, bars, barsOn, barArt, LEFT_STACK_ORDER, OCCUPATIONAL_PRECEDENCE, occupationalRank, EQUAL_STANDING, equalGroup, arrangeEqual, equalStacks, moveEqual, setEqual, pruneEqual, CADET_ONLY, CADET_AUTHORIZED, get, family, art, levels, level, eligibleFor, hasField, hasEmbroidered, fieldIds };
});
