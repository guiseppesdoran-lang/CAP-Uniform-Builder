/*
 * CAP Uniform Builder — Badges Data (ES module)
 * Split out from main app for clarity and reuse.
 */

/**
 * Master list of badge asset IDs (file names under images/badges/<id>.png).
 */
export const badgeList = [
  'AirCrew1_DB3F0FCC3650F','BalloonPilot1_442D89C94185B','CAPMasterPilot1_621A0E2ED15DA','CAPPilot1_FA9D33EA587D8','CAPSeniorPilot1_D9725AE959752','GliderPilot1_7BFB287379918','MasterAirCrew1_72AC4CAE7A310','MasterObserver1_1B88D5071FD5C','SeniorAirCrew1_B289BAE6E515C','SeniorObserver1_0E35802A29801',
  'buddist_chaplin','christian_chaplin','communications_technician_badge','cyber_badges','emergency_services_badge','emt_basic_badge','emt_intermediate','emt_paramedic','ground_team_basic_badge','historian_technicianIbadge','information_technology_technician_badge','jewish_chaplin','legal_officer','master_ground_team_badge','medical_officer','model_rocketry_badge','muslim_chaplin','nra_marksman_badge','nurse_officer','observer_badge','pre_solo_badge','senior_ground_team_badge','solo_badge','stem_badges'
];

/**
 * Cadet-eligible badges.
 */
export const allowedCadetBadges = new Set([
  'solo_badge','pre_solo_badge','ground_team_basic_badge','senior_ground_team_badge','master_ground_team_badge','emt_basic_badge','emt_intermediate','emt_paramedic','aerospace','model_rocketry_badge','communications_technician_badge','information_technology_technician_badge','cyber_badges','stem_badges','cadetadvisory','cd','nra_marksman_badge','AirCrew1_DB3F0FCC3650F','BalloonPilot1_442D89C94185B','CAPMasterPilot1_621A0E2ED15DA','CAPPilot1_FA9D33EA587D8','CAPSeniorPilot1_D9725AE959752','GliderPilot1_7BFB287379918','MasterAirCrew1_72AC4CAE7A310','SeniorAirCrew1_B289BAE6E515C','SeniorObserver1_0E35802A29801','MasterObserver1_1B88D5071FD5C','observer_badge','emergency_services_badge','historian_technicianIbadge'
]);

/**
 * Mutually exclusive badges (selecting one removes the other in the same pair).
 */
export const exclusiveBadges = [
  ['emt_basic_badge','ground_team_basic_badge'],
  ['emt_intermediate','senior_ground_team_badge'],
  ['emt_paramedic','master_ground_team_badge']
];

/**
 * Preferred placement slots per CAPR 39-1 mapping.
 * Slots: OLP/OLPU/OLPA/ORP/ON/UN/LP/LRP (and OVERSTACK handled in code).
 */
export const badgeLocations = {
  'AirCrew1_DB3F0FCC3650F':'OLP','BalloonPilot1_442D89C94185B':'OLP','CAPMasterPilot1_621A0E2ED15DA':'OLP','CAPPilot1_FA9D33EA587D8':'OLP','CAPSeniorPilot1_D9725AE959752':'OLP','GliderPilot1_7BFB287379918':'OLP','MasterAirCrew1_72AC4CAE7A310':'OLP',
  'SeniorAirCrew1_B289BAE6E515C':'OLP','pre_solo_badge':'OLP','solo_badge':'OLP',

  'cyber_badges':'LP','stem_badges':'LP','communications_technician_badge':'LP','information_technology_technician_badge':'LP','MasterObserver1_1B88D5071FD5C':'LP','SeniorObserver1_0E35802A29801':'LP','observer_badge':'LP','historian_technicianIbadge':'LP','model_rocketry_badge':'LP',

  'nra_marksman_badge':'LRP',

  'ground_team_basic_badge':'OLPU','senior_ground_team_badge':'OLPU','master_ground_team_badge':'OLPU','emergency_services_badge':'OLPU','emt_basic_badge':'OLPU','emt_intermediate':'OLPU','emt_paramedic':'OLPU',

  'buddist_chaplin':'ORP','christian_chaplin':'ORP','jewish_chaplin':'ORP','legal_officer':'ORP','medical_officer':'ORP','nurse_officer':'ORP','muslim_chaplin':'ORP'
};

/**
 * Custom pixel sizes for specific badges (w×h) as rendered on the canvas.
 */
export const customBadgeSizes = {
  'AirCrew1_DB3F0FCC3650F':{width:60,height:25},'BalloonPilot1_442D89C94185B':{width:60,height:25},'CAPMasterPilot1_621A0E2ED15DA':{width:60,height:25},'CAPPilot1_FA9D33EA587D8':{width:60,height:25},'CAPSeniorPilot1_D9725AE959752':{width:60,height:25},'GliderPilot1_7BFB287379918':{width:60,height:25},'MasterAirCrew1_72AC4CAE7A310':{width:60,height:25},'MasterObserver1_1B88D5071FD5C':{width:60,height:25},'SeniorAirCrew1_B289BAE6E515C':{width:60,height:25},'SeniorObserver1_0E35802A29801':{width:60,height:25},
  'buddist_chaplin':{width:60,height:60},'christian_chaplin':{width:60,height:60},'communications_technician_badge':{width:60,height:60},
  'cyber_badges':{width:60,height:25},'emergency_services_badge':{width:60,height:60},'emt_basic_badge':{width:60,height:60},
  'emt_intermediate':{width:60,height:60},'emt_paramedic':{width:60,height:60},'ground_team_basic_badge':{width:25,height:20},
  'historian_technicianIbadge':{width:60,height:60},'information_technology_technician_badge':{width:60,height:60},
  'jewish_chaplin':{width:60,height:60},'legal_officer':{width:60,height:25},'master_ground_team_badge':{width:25,height:20},
  'medical_officer':{width:60,height:60},'model_rocketry_badge':{width:7,height:28.125},'muslim_chaplin':{width:60,height:60},
  'nra_marksman_badge':{width:40,height:60},'nurse_officer':{width:60,height:60},'observer_badge':{width:60,height:25},
  'pre_solo_badge':{width:60,height:25},'senior_ground_team_badge':{width:25,height:20},'solo_badge':{width:60,height:25},'stem_badges':{width:60,height:25}
};

export default {
  badgeList,
  allowedCadetBadges,
  exclusiveBadges,
  badgeLocations,
  customBadgeSizes
};

