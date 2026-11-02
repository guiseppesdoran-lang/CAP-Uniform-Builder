// Extracted verbatim from index.html: the ribbon, badge and patch gallery logic. Loaded
// between the halves of the inline script so execution order is unchanged.

/* ===========================
   RIBBONS: GALLERY LOGIC
   =========================== */
function ribbonSelectOnlyOptions(){
  return [
    { label:'- Select -', value:'', devices:{} },
    { label:'Earned', value:'earned', devices:{} }
  ];
}

function ribbonAwardCountOptions(maxAwards=21){
  const options = [{ label:'- Select -', value:'', devices:{} }];

  for(let award=1; award<=maxAwards; award++){
    const additional = Math.max(0, award-1);
    const silver = Math.floor(additional / 5);
    const bronze = additional % 5;
    const devices = {};
    if(silver) devices['1_Silver_Star_Device'] = silver;
    if(bronze) devices['1_Bronze_Star_Device'] = bronze;

    options.push({
      label: award === 1 ? 'Basic Award' : `${ordinalLabel(award)} Award`,
      value: `award_${award}`,
      devices
    });
  }

  return options;
}

function ribbonHourOptions(maxHours=1260, increment=60){
  const options = [{ label:'- Select -', value:'', devices:{} }];
  for(let hours=increment; hours<=maxHours; hours+=increment){
    options.push({
      label:`${hours} Hours`,
      value:`hours_${hours}`,
      devices: ribbonDevicesFromAdditionalAwards(Math.floor(hours / increment) - 1)
    });
  }
  return options;
}

function ribbonSortieOptions(maxSorties=320, increment=10){
  const options = [{ label:'- Select -', value:'', devices:{} }];
  for(let sorties=increment; sorties<=maxSorties; sorties+=increment){
    options.push({
      label:`${sorties} Sorties`,
      value:`sorties_${sorties}`,
      devices: ribbonDevicesFromAdditionalAwards(Math.floor(sorties / increment) - 1)
    });
  }
  return options;
}

function ribbonFindOptions(maxFinds=32){
  const options = [{ label:'- Select -', value:'', devices:{} }];
  for(let finds=1; finds<=maxFinds; finds++){
    options.push({
      label: finds === 1 ? 'Basic Find' : `${ordinalLabel(finds)} Find`,
      value:`find_${finds}`,
      devices: ribbonDevicesFromAdditionalAwards(finds - 1)
    });
  }
  return options;
}

function ribbonYearOptions(years){
  return [
    { label:'- Select -', value:'', devices:{} },
    ...years.map(year => ({
      label:`${year} Years`,
      value:`years_${year}`,
      devices:{}
    }))
  ];
}

/*
  Award-count compositing.

  Devices follow CAPR 39-3 (a bronze star per additional award, a silver star
  replacing five) and CAPR 39-1 11.4.2 caps one ribbon at four devices, so only
  the totals 1-9, 11, 12, 13, 16, 17 and 21 fit on a single ribbon. Those are
  exactly the fifteen images McChord baked per family; the gaps at 10, 14, 15,
  18, 19 and 20 are the totals that need a second ribbon.

  IMPORTANT: the artwork counts EACH ribbon's base as one award. A 10th award is
  a ribbon worth 9 (one silver + three bronze) plus a plain ribbon worth 1 - not
  a ribbon carrying leftover devices. ribbonDevicesFromAdditionalAwards() below
  uses the other convention and must not be used for the overflow split.
  scripts/verify-device-rule.js checks this reproduces the baked mapping on
  189/189 award levels.
*/
const RIBBON_MAX_DEVICES = 4;

function capubDevicesForAwardTotal(total){
  const additional = Math.max(0, (total|0) - 1);
  const devices = {};
  const silver = Math.floor(additional / 5);
  const bronze = additional % 5;
  if(silver) devices['1_Silver_Star_Device'] = silver;
  if(bronze) devices['1_Bronze_Star_Device'] = bronze;
  return devices;
}

const CAPUB_SINGLE_RIBBON_AWARD_TOTALS = (() => {
  const totals = [];
  for(let n = 1; n <= 21; n++){
    const d = capubDevicesForAwardTotal(n);
    const used = (d['1_Silver_Star_Device'] || 0) + (d['1_Bronze_Star_Device'] || 0);
    if(used <= RIBBON_MAX_DEVICES) totals.push(n);
  }
  return totals;
})();

function capubSplitAwardsAcrossRibbons(total){
  const ribbons = [];
  let remaining = Math.max(1, total|0);
  while(remaining > 0){
    let pick = 0;
    for(const candidate of CAPUB_SINGLE_RIBBON_AWARD_TOTALS){
      if(candidate <= remaining) pick = candidate;
    }
    if(!pick){ ribbons.push(remaining); break; }
    ribbons.push(pick);
    remaining -= pick;
  }
  return ribbons;
}

// Families whose levels are a plain "Nth Award" progression: one ribbon, and every higher level is that ribbon plus devices.
const CAPUB_COMPOSITED_AWARD_FAMILIES = new Set([
  'air_force_aerial_achievement_medal','cadet_special_activity_ribbon','cap_achievment_award','distinguished_service_award','encampment_ribbon',
  'exceptional_service_award','meritorious_service_award','national_commander_unit_citation_award','unit_citation_award'
]);

/*
  Rebuild an award-count family's options as one ribbon plus computed devices. Labels and option values are taken from the existing
  option list unchanged, so saved profiles and the dropdown text are unaffected.
*/
function capubCompositeAwardOptions(id, options){
  if(!CAPUB_COMPOSITED_AWARD_FAMILIES.has(id)) return options;
  return options.map((opt, index) => {
    const total = index + 1;
    const [first, ...overflow] = capubSplitAwardsAcrossRibbons(total);
    return {
      ...opt,
      devices: capubDevicesForAwardTotal(first),
      duplicates: overflow.map(count => ({
        awardLabel: `${opt.label} - additional ribbon`,
        devices: capubDevicesForAwardTotal(count)
      }))
    };
  });
}

/*
  Star-combo families. Their level labels spell the device set out directly - "Basic Award", "Bronze Star", "S-S-B Stars" - so the
  devices are parsed from the label rather than derived from an award count.

  Order within a run comes from deviceMeta weight (gold > silver > bronze), which reproduces the label order.
*/
const CAPUB_STAR_COMBO_FAMILIES = new Set(['cadet_advisory_council_ribbon','cap_gill_robb_wilson_ribbon','cap_paul_e_garber_ribbon','cap_leadership_ribbon','national_cadet_competition_ribbon','national_color_guard_competition_ribbon']);

function capubDevicesFromStarLabel(label){
  const text = String(label || '').trim();
  if(/^Basic Award$/i.test(text)) return {};

  const single = /^(Bronze|Silver|Gold)\s+Star$/i.exec(text);
  if(single){
    const key = { bronze:'1_Bronze_Star_Device', silver:'1_Silver_Star_Device', gold:'1_Gold_Star_Device' }[single[1].toLowerCase()];
    return { [key]: 1 };
  }

  // "S-S-B Stars" and friends.
  const combo = /^([BSG](?:-[BSG])*)\s+Stars?$/i.exec(text);
  if(combo){
    const devices = {};
    const keyFor = { b:'1_Bronze_Star_Device', s:'1_Silver_Star_Device', g:'1_Gold_Star_Device' };
    combo[1].toLowerCase().split('-').forEach(letter => {
      const key = keyFor[letter];
      if(key) devices[key] = (devices[key] || 0) + 1;
    });
    return devices;
  }
  return null; // unrecognised - the caller keeps the option as it is
}

/*
  RIBBON_SPECIAL_IMAGE_OPTIONS labels these same levels descriptively
  ("Region Winner / Bronze Star", "2 Silver Stars + Bronze Star"), so the label
  parser above does not match. Their values are self-describing though, e.g.
  two_silver_stars_bronze_star, so read the devices from the value. Leading
  context words (wing_, region_, national_, sos_, acsc_, awc_, senior_,
  master_) are not counts and are skipped by requiring a number word.
*/
function capubDevicesFromStarValue(value){
  const text = String(value || '').toLowerCase();
  if(!text || text === 'earned' || text === 'group') return {};
  const counts = { one:1, two:2, three:3, four:4 };
  const keyFor = { bronze:'1_Bronze_Star_Device', silver:'1_Silver_Star_Device', gold:'1_Gold_Star_Device' };
  const devices = {};
  let found = false;
  const re = /(?:^|_)(?:(one|two|three|four)_)?(bronze|silver|gold)_stars?(?=_|$)/g;
  let m;
  while((m = re.exec(text)) !== null){
    const key = keyFor[m[2]];
    devices[key] = (devices[key] || 0) + (counts[m[1]] || 1);
    found = true;
  }
  return found ? devices : null;
}

function capubCompositeStarComboOptions(id, options){
  if(!CAPUB_STAR_COMBO_FAMILIES.has(id)) return options;
  return options.map(opt => {
    const devices = capubDevicesFromStarLabel(opt.label) ?? capubDevicesFromStarValue(opt.value);
    if(devices === null || devices === undefined) return opt;
    return { ...opt, devices };
  });
}

/*
  RIBBON_SPECIAL_IMAGE_OPTIONS carries a second, semantically-keyed option list
  for these same families (bronze_clasp_1, silver_clasp_2, ...). The member
  report importer resolves to those values, so it has to composite too.
  Labels and values are untouched; only the devices change.
*/
for(const familyId of CAPUB_COMPOSITED_AWARD_FAMILIES){
  const special = RIBBON_SPECIAL_IMAGE_OPTIONS[familyId];
  if(Array.isArray(special) && special.length){
    RIBBON_SPECIAL_IMAGE_OPTIONS[familyId] = capubCompositeAwardOptions(familyId, special);
  }
}
for(const familyId of CAPUB_STAR_COMBO_FAMILIES){
  const special = RIBBON_SPECIAL_IMAGE_OPTIONS[familyId];
  if(Array.isArray(special) && special.length){
    RIBBON_SPECIAL_IMAGE_OPTIONS[familyId] = capubCompositeStarComboOptions(familyId, special);
  }
}

function ribbonDevicesFromAdditionalAwards(additional){
  const safe = Math.max(0, parseInt(additional || 0, 10));
  const devices = {};
  const silver = Math.floor(safe / 5);
  const bronze = safe % 5;
  if(silver) devices['1_Silver_Star_Device'] = silver;
  if(bronze) devices['1_Bronze_Star_Device'] = bronze;
  return devices;
}

function ordinalLabel(n){
  const s = ['th','st','nd','rd'];
  const v = n % 100;
  return `${n}${s[(v-20)%10] || s[v] || s[0]}`;
}

const MCCHORD_21_LEVEL_RIBBONS = {
  distinguished_service_award:{ unit:'award', multiplier:1 },
  exceptional_service_award:{ unit:'award', multiplier:1 },
  meritorious_service_award:{ unit:'award', multiplier:1 },
  cap_achievment_award:{ unit:'award', multiplier:1 },
  national_commander_unit_citation_award:{ unit:'award', multiplier:1 },
  unit_citation_award:{ unit:'award', multiplier:1 },
  cap_counterdrug_ribbon:{ unit:'sorties', multiplier:10 },
  disaster_relief_ribbon:{ unit:'award', multiplier:1 },
  homeland_security_ribbon:{ unit:'sorties', multiplier:10 },
  cap_cadet_orientation_pilot_ribbon:{ unit:'flights', multiplier:50 },
  community_service_ribbon:{ unit:'hours', multiplier:60 },
  cadet_special_activity_ribbon:{ unit:'activities', multiplier:1 },
  encampment_ribbon:{ unit:'encampments', multiplier:1 }
};

function mcchordContinuationLabel(config, level){
  if(config.unit === 'award') return `${ordinalLabel(level)} Award`;
  const amount = level * config.multiplier;
  return `${amount} ${config.unit.replace(/^./, c => c.toUpperCase())}`;
}

function mcchordContinuationOptions(id){
  const config = MCCHORD_21_LEVEL_RIBBONS[id];
  if(!config) return [];
  const second = [{ awardLabel:'Additional Ribbon' }];
  const layout = { 10:{ duplicates:second }, 11:{}, 12:{}, 13:{}, 14:{ duplicates:second }, 15:{ duplicates:second }, 16:{}, 17:{}, 18:{ duplicates:second }, 19:{ duplicates:second }, 20:{ duplicates:second }, 21:{} };
  if(id === 'disaster_relief_ribbon') Object.assign(layout, { 5:{}, 6:{}, 7:{}, 8:{}, 9:{} });
  return Object.entries(layout).map(([level, option]) => ({
    label:mcchordContinuationLabel(config, Number(level)),
    value:`mcchord_level_${level}`,
    devices:{},
    ...option
  }));
}

// Earned once: the AFOEA was awarded for one period only (ICL 18-02). The other single-looking ribbons
// follow 39-3 6b, a bronze clasp for each later award.
const CAPUB_SINGLE_AWARD_RIBBON_IDS = new Set([
  'Air_Force_Organizational_Excellence_Award',
  // A JROTC/ROTC ribbon is shown once, with no devices (39-1 11.2.5).
  ...ROTC_RIBBONS.ribbons.map(r => r.id)
]);

const CAPUB_REPEATABLE_RIBBON_84_CONFIG = {
  air_force_aerial_achievement_medal:{ unit:'award', multiplier:1 },
  distinguished_service_award:{ unit:'award', multiplier:1 },
  exceptional_service_award:{ unit:'award', multiplier:1 },
  meritorious_service_award:{ unit:'award', multiplier:1 },
  commander_commendation_award:{ unit:'award', multiplier:1, exclude:/\((?:National|Region)/i },
  cap_achievment_award:{ unit:'award', multiplier:1 },
  lifesaving_award:{ unit:'award', multiplier:1, exclude:/with Star/i },
  national_commander_unit_citation_award:{ unit:'award', multiplier:1 },
  unit_citation_award:{ unit:'award', multiplier:1 },
  cap_counterdrug_ribbon:{ unit:'sorties', multiplier:10 },
  disaster_relief_ribbon:{ unit:'award', multiplier:1, exclude:/V-Device/i },
  homeland_security_ribbon:{ unit:'sorties', multiplier:10 },
  cap_cadet_orientation_pilot_ribbon:{ unit:'flights', multiplier:50 },
  community_service_ribbon:{ unit:'hours', multiplier:60 },
  cadet_special_activity_ribbon:{ unit:'activities', multiplier:1 },
  encampment_ribbon:{ unit:'encampments', multiplier:1 }
};

function capubExtendedRibbonLabel(config, count){
  if(config.unit === 'award') return `${ordinalLabel(count)} Award`;
  return `${(count * config.multiplier).toLocaleString()} ${config.unit.replace(/^./, c => c.toUpperCase())}`;
}

function capubFlattenRibbonChunks(chunks, label){
  const duplicates = [];
  chunks.forEach((chunk, chunkIndex) => {
    if(chunkIndex > 0){
      duplicates.push({ awardLabel:`${label} - ribbon ${chunkIndex + 1}` });
    }
    (chunk.duplicates || []).forEach(duplicate => duplicates.push({ ...duplicate }));
  });
  return { duplicates };
}

function capubExtendMcchordOptionsTo84(id, sourceOptions){
  const config = CAPUB_REPEATABLE_RIBBON_84_CONFIG[id];
  if(!config) return sourceOptions;
  const levelOptions = sourceOptions.filter(option => !config.exclude?.test(option.label || ''));
  if(levelOptions.length < 21) return sourceOptions;

  const extended = [...sourceOptions];
  for(let count=22; count<=84; count++){
    const chunks = [];
    let remaining = count;
    while(remaining > 0){
      const chunkCount = Math.min(21, remaining);
      chunks.push(levelOptions[chunkCount - 1]);
      remaining -= chunkCount;
    }
    const label = capubExtendedRibbonLabel(config, count);
    const rendered = capubFlattenRibbonChunks(chunks, label);
    extended.push({
      label,
      value:`capub_total_${count}`,
      devices:{},
      duplicates:rendered.duplicates
    });
  }
  return extended;
}

// Ribbons whose choices CAPR 39-3 sets directly. These come before the older option lists, which
// carried a COS star on the Eaker for cadets (the regulation allows it on the Mitchell only) and named
// the Cadet Advisory Council choices by star instead of by level.
const CAPUB_COS_STAR_RIBBONS = new Set(['eaker_award','earhart_award','spaatz_award','cadet_certificate_of_proficiency','frank_borman_falcon_award']);
const CAPUB_HONOR_CREDIT_RIBBONS = new Set(['curry_achievement','hap_arnold_achievement','mary_feik_achievement','rickenbacker_achievement','lindbergh_achievement','doolittle_achievement','armstrong_achievement']);
const CAPUB_PLAIN_ACHIEVEMENT_RIBBONS = new Set(['wright_brothers_award']);
// The ribbons whose option labels lost a device parenthetical in LIVE14 E72 (normalizeRibbonSelections relabels saved setups).
const CAPUB_RELABELED_RIBBONS = new Set(['cadet_advisory_council_ribbon','goddard_achievement']);
function capubRibbonOptionOverride(id){
  const pick = { label:'- Select -', value:'', devices:{} };
  if(globalThis.CAPUBRibbonAwards?.FAMILIES?.[id]?.once){
    // An award given a single time (the Crisis Service Ribbon, the Cadet of the Year awards): no clasps,
    // no repeat counts, only the basic award.
    return [pick, { label:'Basic Award', value:'award_1', devices:{} }];
  }
  if(id === 'cadet_recruiter_ribbon'){
    // 21k(1): two recruits earn the ribbon, a bronze clasp for each additional two, a silver clasp for
    // five bronze, another silver clasp for each additional ten.
    return [pick, ...[2,4,6,8,10,12,22,32,42].map(n => ({ label:`${n} members recruited`, value:`recruits_${n}`, devices:{} }))];
  }
  if(id === 'cadet_advisory_council_ribbon'){
    // 39-3 21j: the highest level served, shown by the star. The labels name the level only (LIVE14 E72, Ethan: "remove
    // the star things, make them all like region level"); data/ribbon-awards.js reads the star from the level, and the
    // line under the select says which star it is.
    return [pick,
      { label:'Group level', value:'cac_group', devices:{} },
      { label:'Wing level', value:'cac_wing', devices:{} },
      { label:'Region level', value:'cac_region', devices:{} },
      { label:'National level', value:'cac_national', devices:{} }];
  }
  if(id === 'mitchell_award'){
    return [pick, { label:'Earned', value:'earned', devices:{} },
      { label:'Earned + COS graduate', value:'earned_cos_star', devices:{} }];
  }
  // Honor credit: a silver star on achievements 1-8 (CAPR 39-3 is silent on it; the vendor ribbons and
  // the eServices cadet report carry it). Goddard also takes the rocketry star (14h).
  if(id === 'goddard_achievement'){
    return [pick, { label:'Earned', value:'earned', devices:{} },
      { label:'Earned with Honor Credit', value:'honor_credit', devices:{} },
      { label:'Earned + Model Rocketry Badge (Mitchell required)', value:'rocketry_star', devices:{} },
      { label:'Earned + Honor Credit and Model Rocketry Badge', value:'honor_credit_and_rocketry', devices:{} }];
  }
  if(CAPUB_HONOR_CREDIT_RIBBONS.has(id)){
    return [pick, { label:'Earned', value:'earned', devices:{} },
      { label:'Earned with Honor Credit', value:'honor_credit', devices:{} }];
  }
  if(CAPUB_COS_STAR_RIBBONS.has(id)){
    if(State.membership === 'cadet') return ribbonSelectOnlyOptions();
    return [pick, { label:'Earned', value:'earned', devices:{} },
      { label:'Earned + COS star moved from the Mitchell', value:'earned_cos_star', devices:{} }];
  }
  if(CAPUB_PLAIN_ACHIEVEMENT_RIBBONS.has(id)) return ribbonSelectOnlyOptions();
  return null;
}

function getRibbonAwardOptions(id){
  if(isMilitaryRibbonId(id)){
    const award=getMilitaryRibbonAward(id);
    const service=getMilitarySelectionService(id);
    const options=[{label:'- Select -',value:'',devices:{}}];
    for(let count=1;count<=21;count++){
      const calculated=window.CAPUBMilitary?.calculateDevices?.({award,service,awardCount:count,allowUnverifiedRules:!!getMilitaryUIState().advancedMode}) || {devices:[]};
      const deviceText=calculated.devices?.length
        ? ` - ${calculated.devices.map(deviceId=>deviceMeta[deviceId]?.label || deviceId).join(' + ')}`
        : '';
      options.push({label:count===1 ? '1st Award' : `${ordinalLabel(count)} Award${deviceText}`,value:`military_award_${count}`,devices:{}});
    }
    return options;
  }
  const override = capubRibbonOptionOverride(id);
  if(override) return override;
  if(CAPUB_SINGLE_AWARD_RIBBON_IDS.has(id)) return ribbonSelectOnlyOptions();
  const mcchordOptions = globalThis.MCCHORD_RIBBON_VARIANTS?.[id];
  if(Array.isArray(mcchordOptions) && mcchordOptions.length){
    const expanded = capubExtendMcchordOptionsTo84(id, mcchordOptions);
    return [
      { label:'- Select -', value:'', devices:{} },
      ...capubCompositeStarComboOptions(id, capubCompositeAwardOptions(id, expanded))
    ];
  }
  const specialImageOptions = ribbonImageOptionList(id);
  if(specialImageOptions){
    const continuation = mcchordContinuationOptions(id);
    return continuation.length ? [...specialImageOptions, ...continuation] : specialImageOptions;
  }

  // Awards that are earned once and have no devices.
  if(new Set([
    'national_commanders_citation','cadet_certificate_of_proficiency',
    'historic_cadet_blue_achievement','historic_cadet_white_achievement',
    'historic_cadet_red_achievement','frank_borman_falcon_award',
    'cap_world_war_2_service_ribbon','anti_submarine_coastal_patrol_ribbon',
    'southern_liaison_patrol_ribbon','tow_target_tracking_ribbon','courier_ribbon',
    'forest_patrol_ribbon','missing_aircraft_ribbon'
  ]).has(id)) return ribbonSelectOnlyOptions();

  if([
    'cap_gill_robb_wilson_ribbon',
    'cap_paul_e_garber_ribbon',
    'cap_grover_loening_aerospace_ribbon',
    'cap_leadership_ribbon',
    'cap_membership_ribbon',
    'cap_a_scott_crossfield_ribbon',
    'cap_bridgadier_general_charles_yaeger_ribbon'
  ].includes(id)){
    return ribbonSelectOnlyOptions();
  }

  return ribbonAwardCountOptions(21);
}

function getRibbonSelectionOption(id, value){
  const options = getRibbonAwardOptions(id);
  const exact = options.find(opt => opt.value === value);
  if(exact) return exact;

  // Member-report imports use stable semantic values (for example
  // bronze_clasp_3 or hours_120), while the McChord artwork catalog uses its
  // own mcchord_* identifiers. Resolve the semantic value to the matching
  // labeled artwork so imported ribbon devices are not silently discarded.
  const usable = options.filter(opt => opt?.value);
  const labelMatch = pattern => usable.find(opt => pattern.test(String(opt.label || '')));
  const awardOption = count => count <= 1
    ? labelMatch(/^Basic Award(?:\s|$)/i) || usable[0]
    : labelMatch(new RegExp(`^${ordinalLabel(count)} Award(?:\\s|$)`, 'i'));

  if(value === 'earned') return awardOption(1) || options[0] || {label:'- Select -', value:'', devices:{}};

  const hours = String(value || '').match(/^hours_(\d+)$/i);
  if(hours){
    const found = labelMatch(new RegExp(`^${Number(hours[1]).toLocaleString()} Hours$`, 'i'));
    if(found) return found;
  }

  const finds = String(value || '').match(/^find_(\d+)$/i);
  if(finds){
    const found = awardOption(Number(finds[1]));
    if(found) return found;
  }

  const years = String(value || '').match(/^years_(\d+)$/i);
  if(years){
    const found = labelMatch(new RegExp(`^${Number(years[1])} Years$`, 'i'));
    if(found) return found;
  }

  if(id === 'cadet_advisory_council_ribbon'){
    if(value === 'group') return labelMatch(/^Basic Award$/i) || usable[0];
    if(value === 'wing_bronze_star') return labelMatch(/^Bronze Star$/i) || usable[0];
    if(value === 'region_silver_star') return labelMatch(/^Silver Star$/i) || usable[0];
    if(value === 'national_gold_star') return labelMatch(/^Gold Star$/i) || usable[0];
  }

  if(id === 'commander_commendation_award'){
    if(value === 'region_bronze_star') return labelMatch(/^Basic Award \(Region Cmdr\)$/i) || usable[0];
    if(value === 'national_silver_star') return labelMatch(/^Basic Award \(National Cmdr\)$/i) || usable[0];
    if(value === 'region_bronze_star_bronze_clasp_1') return labelMatch(/^2nd Award \(Region Cmdr\)$/i) || usable[0];
    if(value === 'national_silver_star_bronze_clasp_1') return labelMatch(/^2nd Award \(National Cmdr\)$/i) || usable[0];
    if(value === 'national_silver_star_bronze_clasp_2') return labelMatch(/^3rd Award \(National Cmdr\)$/i) || usable[0];
  }

  // The member-report importer and older saved setups use descriptive values
  // for the two competition ribbons, while the complete McChord catalog uses
  // mcchord_* identifiers. Match by the visible star pattern so every saved
  // level survives reopening the selector instead of falling back to Basic.
  if(id === 'national_cadet_competition_ribbon' || id === 'national_color_guard_competition_ribbon'){
    const competitionPatterns = {
      region_bronze_star: /^Bronze Star$/i,
      national_silver_star: /^Silver Star$/i,
      two_bronze_stars: /^B-B Stars$/i,
      silver_star_bronze_star: /^S-B Stars$/i,
      two_silver_stars: /^S-S Stars$/i,
      three_bronze_stars: /^B-B-B Stars$/i,
      silver_star_two_bronze_stars: /^S-B-B Stars$/i,
      two_silver_stars_bronze_star: /^S-S-B Stars$/i,
      three_silver_stars: /^S-S-S Stars$/i,
      four_bronze_stars: /^B-B-B-B Stars$/i,
      silver_star_three_bronze_stars: /^S-B-B-B Stars$/i,
      two_silver_stars_two_bronze_stars: /^S-S-B-B Stars$/i,
      three_silver_stars_bronze_star: /^S-S-S-B Stars$/i,
      four_silver_stars: /^S-S-S-S Stars$/i
    };
    const found = competitionPatterns[value] ? labelMatch(competitionPatterns[value]) : null;
    if(found) return found;
  }

  const semantic = String(value || '');
  let additional = 0;
  const silver = semantic.match(/silver_(?:clasp|star)_(\d+)/i);
  const bronze = semantic.match(/bronze_(?:clasp|star)_(\d+)/i);
  if(silver) additional += Number(silver[1]) * 5;
  if(bronze) additional += Number(bronze[1]);
  if(additional > 0){
    const found = awardOption(additional + 1);
    if(found) return found;
  }

  return options[0] || {label:'- Select -', value:'', devices:{}};
}

const COMMAND_SERVICE_RIBBON_ID = 'cap_command_service_ribbon';
const COMMAND_SERVICE_RIBBON_VALUES = new Set(['earned','group_bronze_star','wing_silver_star','region_gold_star','national_two_gold_stars']);

function applyRibbonSelectionValue(id, value){
  const option = getRibbonSelectionOption(id, value || 'earned');
  State.ribbonSelections[id] = State.ribbonSelections[id] || { checked:false, devices:{}, awardValue:'', awardLabel:'' };
  State.ribbonSelections[id].checked = !!(option?.value || value);
  State.ribbonSelections[id].awardValue = option?.value || value || '';
  State.ribbonSelections[id].awardLabel = option?.label || '';
  State.ribbonSelections[id].devices = { ...(option?.devices || {}) };
}

function syncCommandBadgeAndRibbonSelections(){
  normalizeRibbonSelections();
  normalizeBadgeSelections();

  State.badgeSelections['squadron_commander_badge'] = State.badgeSelections['squadron_commander_badge'] || { checked:false };
  const badgeSel = State.badgeSelections['squadron_commander_badge'];
  const commanderRankEligible = isCommandInsigniaGradeEligible(State.rank);

  // Never allow the commander pin to render for Col and above.
  // The Command Service Ribbon is handled separately and may still be awarded
  // after one year of qualifying command service at the proper echelon.
  if(!commanderRankEligible){
    badgeSel.checked = false;
    State.badges = (State.badges || []).filter(id => id !== 'squadron_commander_badge');
    State.badgeSelections['squadron_commander_badge'] = badgeSel;
  }

  const hasBadge = commanderRankEligible && (!!badgeSel.checked || (State.badges || []).includes('squadron_commander_badge'));

  const ribbonSel = State.ribbonSelections[COMMAND_SERVICE_RIBBON_ID] || { checked:false, devices:{}, awardValue:'', awardLabel:'' };
  const ribbonValue = ribbonSel.awardValue || '';
  const ribbonImpliesCommand = !!ribbonSel.checked && COMMAND_SERVICE_RIBBON_VALUES.has(ribbonValue);

  if(hasBadge && !ribbonImpliesCommand){
    applyRibbonSelectionValue(COMMAND_SERVICE_RIBBON_ID, 'earned');
  }

  // Reverse-sync the ribbon to the badge only when the selected grade is allowed
  // to wear command insignia. This prevents Cols from receiving a rendered badge
  // simply because the Command Service Ribbon imported or was manually selected.
  if(ribbonImpliesCommand && commanderRankEligible){
    badgeSel.checked = true;
    State.badgeSelections['squadron_commander_badge'] = badgeSel;
  }
}

function syncGoddardRocketryStar(){
  normalizeRibbonSelections();
  normalizeBadgeSelections();

  const goddard = State.ribbonSelections.goddard_achievement;
  if(!goddard?.checked) return false;

  const currentValue = goddard.awardValue || 'earned';
  const rocketrySelected = !!State.badgeSelections.model_rocketry_badge?.checked ||
    (State.badges || []).includes('model_rocketry_badge');
  const mitchellEarned = !!State.ribbonSelections.mitchell_award?.checked ||
    (State.ribbons || []).some(r => r?.id === 'mitchell_award');

  // Persist earned credit separately from current badge wear. Selecting the
  // badge while Mitchell is earned records the rocketry credit; removing the
  // badge later does not remove the Goddard star.
  if(goddard.honorCredit === undefined){
    goddard.honorCredit = ['honor_credit','honor_credit_and_rocketry','earned_both_devices'].includes(currentValue);
  }
  if(goddard.rocketryCredit === undefined){
    goddard.rocketryCredit = ['rocketry_star','honor_credit_and_rocketry'].includes(currentValue);
  }
  if(rocketrySelected && mitchellEarned) goddard.rocketryCredit = true;

  const honorCredit = !!goddard.honorCredit;
  const rocketryCredit = !!goddard.rocketryCredit && mitchellEarned;

  let desiredValue = 'earned';
  if(honorCredit && rocketryCredit) desiredValue = 'honor_credit_and_rocketry';
  else if(honorCredit) desiredValue = 'honor_credit';
  else if(rocketryCredit) desiredValue = 'rocketry_star';

  if(currentValue === desiredValue) return false;
  const option = getRibbonSelectionOption('goddard_achievement', desiredValue);
  goddard.awardValue = desiredValue;
  goddard.awardLabel = option.label || '';
  goddard.devices = { ...(option.devices || {}) };
  State.ribbonSelections.goddard_achievement = goddard;
  return true;
}

// The first real choice of a ribbon's award select (its basic award, a count of one), as the select lists it.
function capubFirstRibbonOptionValue(id){
  return (getRibbonAwardOptions(id).find(opt => opt?.value) || {}).value || '';
}

function setRibbonSelectionFromDropdown(id, value,{deferRender=false,byGrade=false}={}){
  normalizeRibbonSelections();
  // A ribbon the cadet grade adds is its select's first real choice, looked up, whatever the caller passed (LIVE14 E73,
  // Ethan: "when i selected c/lt col the achievement ribbons popped up as selected but not encampment"): the Encampment
  // Ribbon's choices are the McChord counts (mcchord_19700 'Basic Award' ...), so the 'earned' js/setup.js passes matched
  // none of them and the select stayed on '- Select -'.
  if(byGrade) value = capubFirstRibbonOptionValue(id);
  // A ribbon the member sets by hand is his own from now on: a later grade change leaves it (js/setup.js capubApplyGradeRibbons).
  if(!byGrade && State.gradeRibbons && Array.isArray(State.gradeRibbons.ids) && State.gradeRibbons.ids.includes(id)){
    const ids = State.gradeRibbons.ids.filter(x => x !== id);
    State.gradeRibbons = ids.length ? {rank:State.gradeRibbons.rank, ids} : null;
  }
  const sel = State.ribbonSelections[id] || { checked:false, devices:{} };
  const option = getRibbonSelectionOption(id, value);

  sel.awardValue = value || '';
  sel.awardLabel = option.label || '';
  sel.checked = !!value;
  sel.devices = value ? { ...(option.devices || {}) } : {};

  if(isMilitaryRibbonId(id)){
    sel.awardCount=Math.max(1,Number(String(value || '').match(/military_award_(\d+)/)?.[1]) || 1);
    sel.militaryService=getMilitarySelectionService(id,sel);
    const calculated=window.CAPUBMilitary?.calculateDevices?.({
      award:getMilitaryRibbonAward(id),service:sel.militaryService,awardCount:sel.awardCount,
      specialAuthorizations:sel.specialAuthorizations || [],
      manualDevices:Number(sel.manualNumeral)>1 ? [`NUMERAL_${Math.min(99,Math.max(2,Math.trunc(Number(sel.manualNumeral))))}`] : [],
      allowUnverifiedRules:!!getMilitaryUIState().advancedMode
    });
    sel.devices={};
    for(const deviceId of calculated?.devices || []) sel.devices[deviceId]=(sel.devices[deviceId] || 0)+1;
    sel.deviceWarnings=calculated?.warnings || [];
  }

  if(id === 'goddard_achievement'){
    sel.honorCredit = ['honor_credit','honor_credit_and_rocketry'].includes(value);
    sel.rocketryCredit = ['rocketry_star','honor_credit_and_rocketry'].includes(value);
  }

  State.ribbonSelections[id] = sel;

  enforceRibbonExclusions(id);

  if(id === 'goddard_achievement' || id === 'mitchell_award'){
    syncGoddardRocketryStar();
  }
  if(!deferRender) rebuildRibbonsFromGallery();
}

// Ribbons that share one place in the order of precedence: CAPR 39-3 Attachment 2 lists the National
// Commander's Citation (earned before 1 July 1977, Note 2) "OR" the Gill Robb Wilson Award, so only one
// of the two is worn.
const CAPUB_SHARED_RIBBON_SLOTS = [['national_commanders_citation','cap_gill_robb_wilson_ribbon']];

function clearRibbonSelection(id){
  const sel = State.ribbonSelections?.[id];
  if(!sel) return;
  sel.checked = false;
  sel.awardValue = '';
  sel.awardLabel = '';
  sel.devices = {};
}

function enforceSharedRibbonSlot(selectedId){
  if(!State.ribbonSelections?.[selectedId]?.checked) return;
  for(const group of CAPUB_SHARED_RIBBON_SLOTS){
    if(!group.includes(selectedId)) continue;
    group.filter(otherId => otherId !== selectedId).forEach(clearRibbonSelection);
  }
}

// The choices that rule out others: a senior member's single cadet award, the shared slots.
function enforceRibbonExclusions(selectedId){
  enforceSeniorSingleCadetAwardRibbon(selectedId);
  enforceSharedRibbonSlot(selectedId);
  enforceRotcRibbonLimit(selectedId);
}

// Three JROTC/ROTC ribbons may be worn (39-1 11.2.5): choosing a fourth is refused and says why.
function enforceRotcRibbonLimit(selectedId){
  if(!isRotcRibbonId(selectedId) || !State.ribbonSelections?.[selectedId]?.checked) return;
  const chosen = Object.keys(State.ribbonSelections).filter(id => isRotcRibbonId(id) && State.ribbonSelections[id].checked);
  if(chosen.length <= ROTC_RIBBONS.limit) return;
  clearRibbonSelection(selectedId);
  if(typeof window.capubToastShow === 'function') window.capubToastShow(capubRotcLimitMessage());
}

function enforceSeniorSingleCadetAwardRibbon(selectedId){
  const selected = State.ribbonSelections?.[selectedId];
  if(State.membership !== 'senior' || !selected?.checked || !SENIOR_HIGHEST_CADET_AWARD_RIBBONS.has(selectedId)) return;
  for(const otherId of Object.keys(State.ribbonSelections)){
    if(otherId === selectedId || !SENIOR_HIGHEST_CADET_AWARD_RIBBONS.has(otherId)) continue;
    State.ribbonSelections[otherId].checked = false;
    State.ribbonSelections[otherId].awardValue = '';
    State.ribbonSelections[otherId].awardLabel = '';
    State.ribbonSelections[otherId].devices = {};
  }
}

function normalizeRibbonSelections(){
  for(const award of getAllMilitaryRibbonAwards()){
    const canonicalId=`${MILITARY_RIBBON_PREFIX}${award.id}`;
    if(State.ribbonSelections[canonicalId]) continue;
    const legacyId=(award.sourceIds || []).map(sourceId=>`${MILITARY_RIBBON_PREFIX}${sourceId}`).find(id=>State.ribbonSelections[id]);
    if(legacyId) State.ribbonSelections[canonicalId]={...State.ribbonSelections[legacyId]};
  }
  [...ribbonList, ...getMilitaryRibbonIds()].forEach(id=>{
    if(!State.ribbonSelections[id]){
      State.ribbonSelections[id] = { checked:false, devices:{}, awardValue:'', awardLabel:'' };
    }else{
      if(!State.ribbonSelections[id].devices) State.ribbonSelections[id].devices={};
      if(CAPUB_SINGLE_AWARD_RIBBON_IDS.has(id) && State.ribbonSelections[id].checked){
        State.ribbonSelections[id].awardValue = 'earned';
        State.ribbonSelections[id].awardLabel = 'Earned';
        State.ribbonSelections[id].devices = {};
      }
      if(State.ribbonSelections[id].awardValue === undefined){
        const hasDevices = Object.values(State.ribbonSelections[id].devices || {}).some(v => Number(v) > 0);
        State.ribbonSelections[id].awardValue = State.ribbonSelections[id].checked ? (hasDevices ? 'custom_devices' : 'earned') : '';
      }
      // A grade ribbon saved as 'earned' where its select has no such choice (the Encampment Ribbon, from before LIVE14 E73)
      // takes the choice that value stands for, so the select shows it.
      if(State.ribbonSelections[id].checked && State.ribbonSelections[id].awardValue === 'earned' && CADET_GRADE_RIBBON_IDS.includes(id)){
        const opts = getRibbonAwardOptions(id);
        if(!opts.some(o => o.value === 'earned')){
          const opt = getRibbonSelectionOption(id, 'earned');
          if(opt?.value){
            State.ribbonSelections[id].awardValue = opt.value;
            State.ribbonSelections[id].awardLabel = opt.label || '';
          }
        }
      }
      if(State.ribbonSelections[id].awardLabel === undefined){
        const opt = getRibbonSelectionOption(id, State.ribbonSelections[id].awardValue);
        State.ribbonSelections[id].awardLabel = opt?.label || '';
      }
      // A setup saved before LIVE14 E72 keeps the old label ("Wing level (bronze star)"); the option's own label replaces
      // it. The devices come from the value, so they do not change.
      if(CAPUB_RELABELED_RIBBONS.has(id) && State.ribbonSelections[id].checked){
        const opt = getRibbonAwardOptions(id).find(o => o.value && o.value === State.ribbonSelections[id].awardValue);
        if(opt) State.ribbonSelections[id].awardLabel = opt.label;
      }
      if(isMilitaryRibbonId(id)){
        const sel=State.ribbonSelections[id];
        sel.awardCount=Math.max(1,Number(sel.awardCount) || Number(String(sel.awardValue || '').match(/military_award_(\d+)/)?.[1]) || 1);
        sel.militaryService=getMilitarySelectionService(id,sel);
      }
    }
  });
}

function rebuildRibbonsFromGallery(){
  State.ribbons = [];
  normalizeRibbonSelections();
  normalizeBadgeSelections();
  syncCommandBadgeAndRibbonSelections();

  // A cadet may shorten the rack to the highest Cadet Program achievement ribbon (CAPR 39-1
  // 11.1.2.2). The other selections are kept; they come back when the option is turned off.
  const highestCadetAward = (State.membership === 'cadet' && State.cadetHighestOnly)
    ? [...CADET_ACHIEVEMENT_RIBBONS]
        .filter(id => State.ribbonSelections[id]?.checked)
        .sort((a,b) => precedence(a) - precedence(b))[0] || null
    : null;

  let rotcWorn = 0;
  for(const id of [...getEligibleRibbonIds(), ...getMilitaryRibbonIds()]){
    const sel = State.ribbonSelections[id];
    if(!sel || !sel.checked) continue;
    if(!isAwardWornOnUniform(id)) continue;
    // Three JROTC/ROTC ribbons at most (39-1 11.2.5); a saved setup that lists more wears the first three in order.
    if(isRotcRibbonId(id) && ++rotcWorn > ROTC_RIBBONS.limit) continue;
    if(highestCadetAward && CADET_ACHIEVEMENT_RIBBONS.has(id) && id !== highestCadetAward) continue;
    // A saved setup may list both ribbons of a shared slot; the one higher in the order is worn.
    if(CAPUB_SHARED_RIBBON_SLOTS.some(group => group.includes(id) && group.some(other => other !== id && State.ribbonSelections[other]?.checked && precedence(other) < precedence(id)))) continue;

    // compute stacks needed due to caps or special rules.
    // Silver Medal of Valor has no device for multiple awards in this builder;
    // it renders as multiple separate ribbons, capped at three.
    let militaryInstances=null;
    let stacks = getRibbonDuplicateCountForSelection(id, sel.awardValue || '');
    if(isMilitaryRibbonId(id)){
      militaryInstances=window.CAPUBMilitary?.splitRibbonAwardInstances?.({
        award:getMilitaryRibbonAward(id),service:getMilitarySelectionService(id,sel),awardCount:sel.awardCount || 1,
        specialAuthorizations:sel.specialAuthorizations || [],
        manualDevices:Number(sel.manualNumeral)>1 ? [`NUMERAL_${Math.min(99,Math.max(2,Math.trunc(Number(sel.manualNumeral))))}`] : [],
        allowUnverifiedRules:!!getMilitaryUIState().advancedMode,maxDevices:4
      }) || null;
      if(militaryInstances?.length) stacks=militaryInstances.length;
    }
    for(const [dev,count] of Object.entries(sel.devices||{})){
      const cap = RIBBON_DEVICE_CAP[dev] || 0;
      if(cap > 0) stacks = Math.max(stacks, Math.ceil((count||0)/cap));
    }

    for(let i=0;i<stacks;i++){
      const inst = {
        id,
        devices:{},
        awardValue: sel.awardValue || '',
        awardLabel: sel.awardLabel || ''
      };

      if(isMilitaryRibbonId(id)){
        const calculated=militaryInstances?.[i] || {devices:[]};
        inst.militaryDevices=[...(calculated?.devices || [])];
        inst.militaryService=getMilitarySelectionService(id,sel);
        inst.militaryAwardCount=calculated?.awardCount || 1;
        for(const deviceId of calculated?.devices || []) inst.devices[deviceId]=(inst.devices[deviceId] || 0)+1;
      }

      for(const [dev,count] of Object.entries(sel.devices||{})){
        if(isMilitaryRibbonId(id)) continue;
        const cap = RIBBON_DEVICE_CAP[dev] || 0;
        if(cap<=0) continue;
        const remain = (count||0) - i*cap;
        if(remain>0) inst.devices[dev] = Math.min(cap, remain);
      }
      State.ribbons.push(inst);

      const option = getRibbonSelectionOption(id, sel.awardValue || '');
      if(i === 0 && Array.isArray(option.duplicates)){
        option.duplicates.forEach((dup, dupIndex) => {
          State.ribbons.push({
            id,
            // An overflow ribbon carries its own devices under the composited
            // scheme; it is not always a bare ribbon.
            devices: { ...(dup.devices || {}) },
            awardValue: `${sel.awardValue || 'earned'}_duplicate_${dupIndex+1}`,
            awardLabel: dup.awardLabel || 'Additional Ribbon'
          });
        });
      }
    }
  }

  renderRack();
  renderAllBadges();
}

function getMilitaryUIState(){
  if(!State.militaryUIState) State.militaryUIState={};
  const ui=State.militaryUIState;
  if(!Array.isArray(ui.expandedSections)) ui.expandedSections=[];
  if(!ui.serviceFilter) ui.serviceFilter='ALL';
  if(!ui.awardTypeFilter) ui.awardTypeFilter='ALL';
  if(typeof ui.gallerySearchValue!=='string') ui.gallerySearchValue='';
  if(!ui.galleryServiceFilter) ui.galleryServiceFilter='ALL';
  if(!ui.galleryAwardTypeFilter) ui.galleryAwardTypeFilter='ALL';
  return ui;
}

function captureMilitaryGalleryUI(root,scrollHost,scrollKey='sidebarScrollTop'){
  if(!root) return;
  const ui=getMilitaryUIState();
  ui.expandedSections=[...root.querySelectorAll('details[data-military-section][open]')]
    .map(details=>details.dataset.militarySection);
  if(scrollHost) ui[scrollKey]=scrollHost.scrollTop || 0;
  const active=document.activeElement;
  if(active && root.contains(active)){
    ui.focusedControl={
      ribbonId:active.dataset?.ribbonId || active.closest?.('[data-ribbon-id]')?.dataset?.ribbonId || '',
      deviceId:active.dataset?.deviceId || '',
      className:[...active.classList].find(name=>/rbAwardSelect|militaryServiceSelect|militarySpecialDevice|militaryNumeralDevice|militaryRibbonCatalogSearch|militaryRibbonCatalogService|militaryRibbonCatalogType/.test(name)) || '',
      selectionStart:Number.isFinite(active.selectionStart) ? active.selectionStart : null
    };
  }
}

function restoreMilitaryGalleryUI(root,scrollHost,scrollKey='sidebarScrollTop'){
  if(!root) return;
  const ui=getMilitaryUIState();
  const expanded=new Set(ui.expandedSections || []);
  root.querySelectorAll('details[data-military-section]').forEach(details=>{
    details.open=expanded.has(details.dataset.militarySection);
    details.addEventListener('toggle',()=>{
      const current=new Set(getMilitaryUIState().expandedSections || []);
      if(details.open) current.add(details.dataset.militarySection); else current.delete(details.dataset.militarySection);
      getMilitaryUIState().expandedSections=[...current];
      if(details.open && details.querySelector(':scope > [data-military-lazy="true"]') && root===by('ribbonGallery')) buildRibbonGallery();
    });
  });
  if(scrollHost) scrollHost.scrollTop=Number(ui[scrollKey]) || 0;
  const focus=ui.focusedControl;
  if(focus?.className){
    const selector=focus.ribbonId
      ? `[data-ribbon-id="${CSS.escape(focus.ribbonId)}"].${CSS.escape(focus.className)}`
      : `.${CSS.escape(focus.className)}`;
    const target=root.querySelector(selector);
    if(target){
      target.focus({preventScroll:true});
      if(focus.selectionStart !== null && target.setSelectionRange) target.setSelectionRange(focus.selectionStart,focus.selectionStart);
    }
  }
}

// Draw each selected ribbon in a picker with the devices it will wear, and the miniature medal of every tile that shows one as the tile
// scrolls into view (the sidebar and the picker window both hold tiles).
const capubMiniPreviewWatcher = typeof IntersectionObserver === 'function'
  ? new IntersectionObserver(entries => entries.forEach(entry => {
    if(!entry.isIntersecting) return;
    capubMiniPreviewWatcher.unobserve(entry.target);
    capubFillMiniPreview(entry.target);
  }), { rootMargin:'200px' })
  : null;
function capubFillMiniPreview(host){
  const id = host.closest('.ribbonSelectorTile')?.dataset.ribbonId;
  if(id) CAPUBUniformView.fillMiniMedalPreview(host, id, State.ribbonSelections?.[id] || {});
}
function fillRibbonTilePreviews(root){
  if(!root || !window.CAPUBUniformView) return;
  root.querySelectorAll('.ribbonSelectorTile').forEach(tile=>{
    const id = tile.dataset.ribbonId;
    const sel = State.ribbonSelections?.[id];
    if(!id || !sel) return;
    if(sel.checked) CAPUBUniformView.fillRibbonPreview(tile.querySelector('.militaryRibbonArt img, :scope > img'), id, sel);
    const mini = tile.querySelector('.miniMedalArt');
    if(mini && !mini.firstElementChild){
      if(capubMiniPreviewWatcher) capubMiniPreviewWatcher.observe(mini);
      else capubFillMiniPreview(mini);
    }
  });
}

function buildRibbonGallery(options={}){
  const wrap = by('ribbonGallery');
  if(!wrap) return;
  if(options.capture!==false) captureMilitaryGalleryUI(wrap,wrap,'sidebarScrollTop');
  normalizeRibbonSelections();
  wrap.innerHTML = '';
  const wornIds = getEligibleRibbonIds().filter(id => isAwardWornOnUniform(id));
  // The JROTC/ROTC ribbons are picked in their own menu below (capubBuildRotcRibbonMenu), not as a tile each.
  const eligible = wornIds.filter(id => !isRotcRibbonId(id));
  const rotcIds = wornIds.filter(id => isRotcRibbonId(id));
  const visible = State.ribbonGalleryExpanded ? eligible : eligible.slice(0, 12);
  // Grouped the way CAPR 39-3 Attachment 2 lists them, in precedence order within each group.
  const sections = State.ribbonGalleryExpanded
    ? groupRibbonIds(visible).map(group => ({ title:group.label, description:group.note ? ` ${group.note}` : '', ids:group.ids }))
    : [{ title:'', description:'', ids:visible }];

  const buildTile=(id,military=false)=>{
    const sel = State.ribbonSelections[id];
    const tile = document.createElement('div');
    tile.className = 'galleryTile ribbonSelectorTile';
    if(military) tile.classList.add('militaryRibbonSelectorTile');
    tile.dataset.ribbonId = id;
    const title = getRibbonDisplayName(id);
    // A miniature medal only matters on the uniforms that wear them (CAPR 39-1 11.1.4).
    // The JROTC/ROTC ribbons have no miniature medal in the builder, so the tile does not offer one.
    const showMini = CAPUBUniformRules.allowsMiniMedals(State.uniform) && !isRotcRibbonId(id);
    const miniPreview = !showMini ? '' : hasMiniMedal(id)
      ? `<div class="miniMedalPreview"><span>Mini medal</span><span class="miniMedalArt" role="img" aria-label="${escapeHtml(title)} mini medal"></span></div>`
      : `<div class="miniMedalPreview missing"><span>No mini medal asset</span></div>`;
    const options = getRibbonAwardOptions(id).map(opt => {
      const selected = (sel.awardValue || '') === opt.value ? 'selected' : '';
      return `<option value="${escapeHtml(opt.value)}" ${selected}>${escapeHtml(opt.label)}</option>`;
    }).join('');
    // CAP ribbons: the devices come from the same rule that draws the uniform.
    const deviceSummary = military
      ? Object.entries(sel.devices || {})
        .filter(([,qty]) => Number(qty) > 0)
        .map(([devId,qty]) => `${escapeHtml(deviceMeta[devId]?.label || devId)}: ${Number(qty)}`)
        .join(' • ')
      : (window.CAPUBRibbonAwards ? escapeHtml(CAPUBRibbonAwards.describe(id, Object.assign({ membership:State.membership }, sel))) : '');
    const award=military ? getMilitaryRibbonAward(id) : null;
    const service=military ? getMilitarySelectionService(id,sel) : null;
    const militaryRules=military ? window.CAPUBMilitary?.inferDeviceRules?.(award,service,{allowUnverified:!!getMilitaryUIState().advancedMode}) : null;
    const serviceOptions=military ? (award?.authorizedServices || []).map(service=>
      `<option value="${escapeHtml(service)}" ${getMilitarySelectionService(id,sel)===service?'selected':''}>${escapeHtml(MILITARY_BRANCH_LABELS[service] || service.replaceAll('_',' '))}</option>`
    ).join('') : '';
    const advanced=!!getMilitaryUIState().advancedMode;
    const specialIds=advanced
      ? [...new Set([...(militaryRules?.allowedSpecialDevices || []),'V_DEVICE','C_DEVICE','R_DEVICE','ARROWHEAD_DEVICE','M_DEVICE','BRONZE_HOURGLASS','SILVER_HOURGLASS','GOLD_HOURGLASS'])]
      : (militaryRules?.allowedSpecialDevices || []);
    const specialControls=military ? specialIds.map(deviceId=>
      `<label><input type="checkbox" class="militarySpecialDevice" data-ribbon-id="${escapeHtml(id)}" data-device-id="${escapeHtml(deviceId)}" ${(sel.specialAuthorizations || []).includes(deviceId)?'checked':''}>${escapeHtml(deviceMeta[deviceId]?.label || deviceId.replaceAll('_',' '))}</label>`
    ).join('') + (advanced ? `<label>Numeral <input type="number" class="militaryNumeralDevice" data-ribbon-id="${escapeHtml(id)}" min="0" max="99" value="${Number(sel.manualNumeral)||0}" style="width:62px" title="0 means no numeral"></label>` : '') : '';
    // The device area is the same size whether or not the ribbon is picked and whether or not it carries devices
    // (Ethan: "the ui keeps shifting down because tiles increase size"). The picked line is clamped to the
    // reserved height (full text in title and in the page text). The counting rule (data/ribbon-awards.js hint) has
    // no button (LIVE14 E71, Ethan: "you can remove those question mark things by some of the service ribbons"): it
    // is the line under the select until the ribbon is picked, and it stays in that line's title and the select's.
    const ruleHint = !military && window.CAPUBRibbonAwards ? CAPUBRibbonAwards.hint(id) : '';
    const pickedLine = sel.checked
      ? `Selected: <b>${escapeHtml(sel.awardLabel || 'Earned')}</b>${deviceSummary ? ` \u2022 ${deviceSummary}` : ''}${sel.deviceWarnings?.length ? ` \u2022 ${escapeHtml(sel.deviceWarnings.join(' '))}` : ''}`
      : '';
    const pickedText = pickedLine.replace(/<[^>]*>/g, '');
    const areaTitle = [pickedText, ruleHint ? escapeHtml(ruleHint) : ''].filter(Boolean).join(' \u2022 ');
    const deviceArea = `<div class="ribbonDeviceArea">
          <div class="sub ribbonDeviceSummary"${areaTitle ? ` title="${areaTitle}"` : ''}>${pickedLine || (ruleHint ? escapeHtml(ruleHint) : '')}</div>
        </div>`;
    tile.innerHTML = `
      ${military ? `<span class="militaryRibbonArt"><img loading="lazy" decoding="async" alt="${escapeHtml(title)}"></span>` : `<img loading="lazy" decoding="async" alt="${escapeHtml(title)}">`}
      <div style="flex:1;min-width:0;">
        <div class="title">${escapeHtml(title)}</div>
        <div class="sub">${isRotcRibbonId(id) ? 'JROTC / ROTC' : military ? `${(award?.authorizedServices || []).map(service=>escapeHtml(MILITARY_BRANCH_LABELS[service] || service)).join(' / ') || 'U.S. MILITARY'}` : (CAPUB_DEV ? escapeHtml(id) : '')}</div>
        ${miniPreview}
        ${military ? `<label class="ribbonAwardLabel">Awarding / wearer service<select class="militaryServiceSelect" data-ribbon-id="${escapeHtml(id)}">${serviceOptions}</select></label>` : ''}
        <label class="ribbonAwardLabel">
          Award count / earned level
          <select class="rbAwardSelect" data-ribbon-id="${escapeHtml(id)}"${ruleHint ? ` title="${escapeHtml(ruleHint)}"` : ''}>
            ${options}
          </select>
        </label>
        ${military ? `<div class="militarySpecialDeviceRow" title="Select only devices authorized on your award orders.">${specialControls}</div>` : ''}
        ${deviceArea}
      </div>
    `;
    const ribbonPreview = tile.querySelector('.militaryRibbonArt img, :scope > img');
    capubInstallImageFallback(ribbonPreview, [getRibbonImagePath({id, awardValue: sel.awardValue || ''})]);
    wireRibbonTileControls(tile);
    return tile;
  };

  for(const section of sections){
    if(!section.ids.length) continue;
    if(section.title){
      const heading = document.createElement('div');
      heading.className = 'ribbonGallerySectionTitle';
      heading.innerHTML = `${section.title}<span class="sub">${section.description}</span>`;
      wrap.appendChild(heading);
    }
    section.ids.forEach(id=>wrap.appendChild(buildTile(id,false)));
  }

  if(State.ribbonGalleryExpanded && rotcIds.length) wrap.appendChild(capubBuildRotcRibbonMenu(rotcIds, buildTile));

  if(State.ribbonGalleryExpanded && !isMilitaryAwardWornOnUniform()){ // Corporate-style only: USAF-style uniforms allow them
    const note=document.createElement('div');
    note.className='hintText';
    note.textContent='U.S. military, JROTC and ROTC awards are not worn on Corporate-style uniforms (CAPR 39-1, 11.1.6, 11.2.5).';
    wrap.appendChild(note);
  }
  if(State.ribbonGalleryExpanded && isMilitaryAwardWornOnUniform()){
    const ui=getMilitaryUIState();
    const galleryQuery=ui.gallerySearchValue.trim().toLowerCase();
    const allMilitaryIds=getMilitaryRibbonIds();
    const militaryIds=allMilitaryIds.filter(id=>{
      const award=getMilitaryRibbonAward(id);
      const services=(award?.authorizedServices || []).map(service=>String(service).toUpperCase());
      const branch=getMilitaryAwardBranch(award);
      const serviceMatch=ui.galleryServiceFilter==='ALL'
        || branch===ui.galleryServiceFilter
        || services.includes(ui.galleryServiceFilter);
      const typeMatch=ui.galleryAwardTypeFilter==='ALL'
        || militaryAwardFilterType(award)===ui.galleryAwardTypeFilter;
      const haystack=[award?.name,award?.officialName,...(award?.aliases || []),award?.id,...services,militaryAwardFilterType(award)].join(' ').toLowerCase();
      return serviceMatch && typeMatch && (!galleryQuery || haystack.includes(galleryQuery));
    });
    const militaryMenu=document.createElement('details');
    militaryMenu.className='militaryRibbonMenu';
    militaryMenu.dataset.militarySection='military-root';
    const summary=document.createElement('summary');
    summary.textContent=`U.S. Military Ribbons (${militaryIds.length} unique awards)`;
    militaryMenu.appendChild(summary);
    const intro=document.createElement('div');
    intro.className='sub';
    intro.innerHTML=`Shared awards appear once under Joint / Multi-Service. Normal mode only exposes award-specific device rules in the local verified dataset. <label style="display:inline-flex;gap:5px;align-items:center;margin-left:8px"><input class="militaryAdvancedMode" type="checkbox" ${getMilitaryUIState().advancedMode?'checked':''}> Manual / unverified configurations</label>`;
    militaryMenu.appendChild(intro);
    const filters=document.createElement('div');
    filters.className='militaryRibbonCatalogFilters';
    filters.innerHTML=`
      <input class="militaryRibbonCatalogSearch" type="search" placeholder="Search military ribbons…" value="${militaryEscapeHtml(ui.gallerySearchValue)}" aria-label="Search military ribbons">
      <select class="militaryRibbonCatalogService" aria-label="Filter military ribbons by service">
        <option value="ALL">All services</option>
        ${MILITARY_BRANCH_ORDER.map(branch=>`<option value="${branch}" ${ui.galleryServiceFilter===branch?'selected':''}>${MILITARY_BRANCH_LABELS[branch]}</option>`).join('')}
      </select>
      <select class="militaryRibbonCatalogType" aria-label="Filter military ribbons by type">
        <option value="ALL">All award types</option>
        ${[['DECORATIONS','Decorations'],['UNIT_AWARD','Unit awards'],['CAMPAIGN_EXPEDITIONARY','Campaign / Expeditionary'],['SERVICE','Service awards'],['TRAINING','Training'],['FOREIGN','Foreign'],['OTHER','Other']].map(([value,label])=>`<option value="${value}" ${ui.galleryAwardTypeFilter===value?'selected':''}>${label}</option>`).join('')}
      </select>
    `;
    militaryMenu.appendChild(filters);
    const resultSummary=document.createElement('div');
    resultSummary.className='sub militaryRibbonCatalogSummary';
    resultSummary.textContent=`${militaryIds.length} of ${allMilitaryIds.length} unique military awards shown. Branch contents load when opened.`;
    militaryMenu.appendChild(resultSummary);
    const filtersActive=!!galleryQuery || ui.galleryServiceFilter!=='ALL' || ui.galleryAwardTypeFilter!=='ALL';
    const expandedSections=new Set(ui.expandedSections || []);
    for(const branch of MILITARY_BRANCH_ORDER){
      const ids=militaryIds.filter(id=>getMilitaryAwardBranch(getMilitaryRibbonAward(id))===branch);
      const branchMenu=document.createElement('details');
      branchMenu.className='militaryBranchMenu';
      const branchKey=`military-branch-${branch}`;
      branchMenu.dataset.militarySection=branchKey;
      const shouldPopulate=expandedSections.has(branchKey) || (filtersActive && ids.length>0);
      branchMenu.open=shouldPopulate;
      const branchSummary=document.createElement('summary');
      branchSummary.textContent=`${MILITARY_BRANCH_LABELS[branch]} (${ids.length})`;
      branchMenu.appendChild(branchSummary);
      const grid=document.createElement('div');
      grid.className='militaryBranchGrid';
      if(shouldPopulate && ids.length) ids.forEach(id=>grid.appendChild(buildTile(id,true)));
      else if(!shouldPopulate){
        grid.dataset.militaryLazy='true';
        const lazy=document.createElement('div');
        lazy.className='sub'; lazy.textContent='Open this branch to load its ribbon controls.';
        grid.appendChild(lazy);
      }
      else{
        const empty=document.createElement('div');
        empty.className='sub';
        empty.textContent=`No ${MILITARY_BRANCH_LABELS[branch]}-only ribbon is in the catalog; shared awards are listed once under Joint / Multi-Service.`;
        grid.appendChild(empty);
      }
      branchMenu.appendChild(grid);
      militaryMenu.appendChild(branchMenu);
    }
    wireRibbonTileControls(militaryMenu);
    wrap.appendChild(militaryMenu);
  }
  restoreMilitaryGalleryUI(wrap,wrap,'sidebarScrollTop');
  fillRibbonTilePreviews(wrap);
}

/* JROTC / ROTC ribbons (LIVE14 E74, Ethan: "make all of the jrotc stuff dropdowns like the mil stuff"). Picked the way the
   U.S. military ribbons are: a program select (data/rotc-ribbons.js services), a search, and a dropdown of that program's ribbons;
   the ribbons chosen are listed as tiles, each with its award select and a Remove button, in the data's order, which is the
   order of wear among them (js/catalog.js ribbonList). Three at most (CAPR 39-1 11.2.5): a fourth is refused with the same
   message enforceRotcRibbonLimit gives, and the menu says so once three are chosen. A selection is still
   State.ribbonSelections[id] = { checked, awardValue:'earned', ... }, so setups saved with the old tiles load as they were.
   The program and the search are UI only (State.militaryUIState.rotcProgram / rotcSearch) and redraw the dropdown in place,
   so they need no rebuild in the picker window. Adding goes through a select with the rbAwardSelect class and removing through
   the tile's own award select, which the picker window (js/wiring.js wireModalInteractions) re-syncs after a change. */
function capubRotcLimitMessage(){
  return `At most ${ROTC_RIBBONS.limit} JROTC/ROTC ribbons may be worn (CAPR 39-1, ${ROTC_RIBBONS.ref}); remove one to add another.`;
}
function capubChosenRotcIds(ids){
  return ids.filter(id => State.ribbonSelections?.[id]?.checked);
}
function capubRotcAddOptionsHtml(ids, program, query){
  const q = String(query || '').trim().toLowerCase();
  const open = ids.map(id => ROTC_RIBBONS.get(id)).filter(r => r && !State.ribbonSelections?.[r.id]?.checked)
    .filter(r => (!program || program === 'ALL' || r.service === program) && (!q || r.name.toLowerCase().includes(q)));
  const groups = ROTC_RIBBONS.services.map(service => {
    const rs = open.filter(r => r.service === service.key);
    return rs.length ? `<optgroup label="${escapeHtml(service.label)}">${rs.map(r => `<option value="${escapeHtml(r.id)}">${escapeHtml(r.name)}</option>`).join('')}</optgroup>` : '';
  }).join('');
  return `<option value="">${open.length ? '- Add a ribbon -' : '- No ribbon matches -'}</option>${groups}`;
}
function capubRefreshRotcAddSelect(menu){
  const select = menu?.querySelector('.rotcRibbonAddSelect');
  if(!select) return;
  const ui = getMilitaryUIState();
  select.innerHTML = capubRotcAddOptionsHtml(JSON.parse(menu.dataset.rotcIds || '[]'), ui.rotcProgram, ui.rotcSearch);
}
function capubBuildRotcRibbonMenu(ids, buildTile){
  const ui = getMilitaryUIState();
  if(!ui.rotcProgram) ui.rotcProgram = 'ALL';
  if(typeof ui.rotcSearch !== 'string') ui.rotcSearch = '';
  const chosen = capubChosenRotcIds(ids);
  const menu = document.createElement('details');
  menu.className = 'militaryRibbonMenu rotcRibbonMenu';
  menu.dataset.militarySection = 'rotc-root';
  menu.dataset.rotcIds = JSON.stringify(ids);
  const summary = document.createElement('summary');
  summary.textContent = `JROTC / ROTC Ribbons, ${chosen.length} of ${ROTC_RIBBONS.limit} chosen`;
  menu.appendChild(summary);
  const intro = document.createElement('div');
  intro.className = 'sub';
  intro.textContent = `Worn after the CAP ribbons, at most ${ROTC_RIBBONS.limit} in all, only while enrolled in the program (CAPR 39-1, ${ROTC_RIBBONS.ref}). Pick the program, then the ribbon.`;
  menu.appendChild(intro);
  const filters = document.createElement('div');
  filters.className = 'militaryRibbonCatalogFilters rotcRibbonCatalogFilters';
  filters.innerHTML = `
      <select class="rotcProgramSelect" aria-label="JROTC or ROTC program">
        <option value="ALL">All programs</option>
        ${ROTC_RIBBONS.services.map(service => `<option value="${escapeHtml(service.key)}" ${ui.rotcProgram === service.key ? 'selected' : ''}>${escapeHtml(service.label)}</option>`).join('')}
      </select>
      <input class="rotcRibbonSearch" type="search" placeholder="Search JROTC / ROTC ribbons\u2026" value="${escapeHtml(ui.rotcSearch)}" aria-label="Search JROTC and ROTC ribbons">
      <select class="rbAwardSelect rotcRibbonAddSelect" aria-label="Add a JROTC or ROTC ribbon">${capubRotcAddOptionsHtml(ids, ui.rotcProgram, ui.rotcSearch)}</select>
    `;
  menu.appendChild(filters);
  const status = document.createElement('div');
  status.className = 'sub rotcRibbonStatus';
  status.setAttribute('role', 'status');
  status.textContent = chosen.length >= ROTC_RIBBONS.limit
    ? `${chosen.length} of ${ROTC_RIBBONS.limit} chosen. ${capubRotcLimitMessage()}`
    : chosen.length ? `${chosen.length} of ${ROTC_RIBBONS.limit} chosen.` : 'None chosen.';
  menu.appendChild(status);
  const grid = document.createElement('div');
  grid.className = 'militaryBranchGrid rotcChosenGrid';
  for(const id of chosen){
    const tile = buildTile(id, false);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'ghost rotcRibbonRemove';
    remove.dataset.ribbonId = id;
    remove.textContent = 'Remove';
    remove.setAttribute('aria-label', `Remove the ${getRibbonDisplayName(id)}`);
    (tile.querySelector('.ribbonDeviceArea')?.parentElement || tile).appendChild(remove);
    grid.appendChild(tile);
  }
  menu.appendChild(grid);
  wireRibbonTileControls(menu);
  return menu;
}

function wireRibbonTileControls(root){
  root.querySelectorAll('.militaryRibbonCatalogSearch').forEach(input=>{
    input.oninput=()=>{
      const ui=getMilitaryUIState();
      ui.gallerySearchValue=input.value;
      ui.focusedControl={ribbonId:'',deviceId:'',className:'militaryRibbonCatalogSearch',selectionStart:input.selectionStart};
      clearTimeout(wireRibbonTileControls.searchTimer);
      wireRibbonTileControls.searchTimer=setTimeout(()=>buildRibbonGallery(),100);
    };
  });
  root.querySelectorAll('.militaryRibbonCatalogService').forEach(select=>{
    select.onchange=()=>{
      getMilitaryUIState().galleryServiceFilter=select.value || 'ALL';
      buildRibbonGallery();
    };
  });
  root.querySelectorAll('.militaryRibbonCatalogType').forEach(select=>{
    select.onchange=()=>{
      getMilitaryUIState().galleryAwardTypeFilter=select.value || 'ALL';
      buildRibbonGallery();
    };
  });
  root.querySelectorAll('.militaryAdvancedMode').forEach(input=>{
    input.onchange=()=>{
      getMilitaryUIState().advancedMode=!!input.checked;
      buildRibbonGallery();
    };
  });
  root.querySelectorAll('.rbAwardSelect').forEach(select=>{
    const id=select.dataset.ribbonId;
    if(id) select.onchange=()=>setRibbonSelectionFromDropdown(id,select.value);
  });
  // JROTC / ROTC menu (capubBuildRotcRibbonMenu). Outside the picker window the sidebar list is rebuilt here; inside it the
  // window's own wrapper re-syncs after the change.
  const inPicker = el => !!el.closest?.('#galleryModalHost');
  root.querySelectorAll('.rotcProgramSelect').forEach(select=>{
    select.onchange=()=>{
      getMilitaryUIState().rotcProgram=select.value || 'ALL';
      capubRefreshRotcAddSelect(select.closest('.rotcRibbonMenu'));
    };
  });
  root.querySelectorAll('.rotcRibbonSearch').forEach(input=>{
    input.oninput=()=>{
      getMilitaryUIState().rotcSearch=input.value;
      capubRefreshRotcAddSelect(input.closest('.rotcRibbonMenu'));
    };
  });
  root.querySelectorAll('.rotcRibbonAddSelect').forEach(select=>{
    select.onchange=()=>{
      const id=select.value;
      if(!id || !isRotcRibbonId(id)) return;
      getMilitaryUIState().focusedControl=null;
      // A fourth is refused by enforceRotcRibbonLimit, which says why.
      setRibbonSelectionFromDropdown(id,'earned');
      if(!inPicker(select)) buildRibbonGallery();
    };
  });
  root.querySelectorAll('.rotcChosenGrid select.rbAwardSelect[data-ribbon-id]').forEach(select=>{
    const id=select.dataset.ribbonId;
    select.onchange=()=>{
      setRibbonSelectionFromDropdown(id,select.value);
      if(!inPicker(select)) buildRibbonGallery();
    };
  });
  root.querySelectorAll('.rotcRibbonRemove').forEach(button=>{
    button.onclick=()=>{
      const select=button.closest('.ribbonSelectorTile')?.querySelector('select.rbAwardSelect[data-ribbon-id]');
      if(!select) return;
      select.value='';
      select.dispatchEvent(new Event('change'));
    };
  });
  root.querySelectorAll('.militaryServiceSelect').forEach(select=>{
    const id=select.dataset.ribbonId;
    if(!id) return;
    select.onchange=()=>{
      const sel=State.ribbonSelections[id] || {checked:false,devices:{}};
      sel.militaryService=select.value;
      State.ribbonSelections[id]=sel;
      if(sel.checked) setRibbonSelectionFromDropdown(id,sel.awardValue || `military_award_${sel.awardCount || 1}`);
      buildRibbonGallery();
    };
  });
  root.querySelectorAll('.militarySpecialDevice').forEach(input=>{
    input.onchange=()=>{
      const id=input.dataset.ribbonId;
      const sel=State.ribbonSelections[id] || {checked:false,devices:{}};
      const chosen=new Set(sel.specialAuthorizations || []);
      if(input.checked) chosen.add(input.dataset.deviceId); else chosen.delete(input.dataset.deviceId);
      sel.specialAuthorizations=[...chosen];
      State.ribbonSelections[id]=sel;
      if(sel.checked) setRibbonSelectionFromDropdown(id,sel.awardValue || `military_award_${sel.awardCount || 1}`);
    };
  });
  root.querySelectorAll('.militaryNumeralDevice').forEach(input=>{
    input.onchange=()=>{
      const id=input.dataset.ribbonId;
      const sel=State.ribbonSelections[id] || {checked:false,devices:{}};
      sel.manualNumeral=Math.min(99,Math.max(0,Math.trunc(Number(input.value)||0)));
      State.ribbonSelections[id]=sel;
      if(sel.checked) setRibbonSelectionFromDropdown(id,sel.awardValue || `military_award_${sel.awardCount || 1}`);
    };
  });
}


/* ===========================
   BADGES: GALLERY LOGIC
   =========================== */
function isCadetAuthorized(id){ return allowedCadetBadges.has(id); }

function normalizeBadgeSelections(){
  badgeList.forEach(id=>{
    if(!State.badgeSelections[id]){
      State.badgeSelections[id] = { checked:false };
    }
    // Preserve selections when membership changes. Unauthorized items are hidden or warned, not deleted.
  });
}

function enforceExclusive(newId){
  exclusiveBadges.forEach(pair=>{
    if(pair.includes(newId)){
      pair.forEach(conf=>{
        if(conf!==newId){
          State.badges = State.badges.filter(b=>b!==conf);
          if(State.badgeSelections[conf]) State.badgeSelections[conf].checked=false;
        }
      });
    }
  });
}

function rebuildBadgesFromGallery(){
  normalizeBadgeSelections();
  normalizeRibbonSelections();
  syncCommandBadgeAndRibbonSelections();

  // Keep the user's selection order instead of rebuilding in badgeList order.
  // This prevents a newly added badge with the same preferred slot from stealing
  // the pocket/location of a badge that was already selected.
  const eligible = id => isBadgeEligibleForMembership(id, State.membership) && !(isCommandInsigniaBadge(id) && !isCommandInsigniaGradeEligible(State.rank));
  const current = Array.isArray(State.badges) ? State.badges.filter(id => eligible(id) && State.badgeSelections[id]?.checked) : [];

  for(const id of badgeList){
    if(!eligible(id)) continue;
    if(State.badgeSelections[id]?.checked && !current.includes(id)){
      current.push(id);
    }
  }

  // Specialty position ownership follows CAP precedence: Command Council and
  // Senior Advisory Group first, then National Staff, then all other specialty
  // badges. Equal-priority items retain the user's selection order.
  State.badges = applySpecialtySelectionPrecedence(current);

  // Apply true exclusivity rules after order is preserved.
  for(const id of [...State.badges]){
    enforceExclusive(id);
  }

  syncGoddardRocketryStar();

  // Badge changes can automatically add the Command Service Ribbon, so rebuild
  // the ribbon state/rack too. That pass also re-renders badges afterward.
  rebuildRibbonsFromGallery();
  if(typeof capubSyncBadgesNotWornNote === 'function') capubSyncBadgesNotWornNote();
}

// A level picker on the tile of a badge earned in levels (STEM, Cyber, NRA).
function badgeLevelSelectHtml(id){
  const list = window.CAPUBBadgeCatalog?.levels(id);
  if(!list) return '';
  return `<div class="miniRow"><label>Level <select class="bdLevel">${list.map(([k,label])=>`<option value="${escapeHtml(k)}">${escapeHtml(label)}</option>`).join('')}</select></label></div>`;
}
function wireBadgeLevelSelect(tile, id){
  const select = tile.querySelector('.bdLevel');
  if(!select) return;
  const sel = State.badgeSelections[id] || (State.badgeSelections[id] = {checked:false});
  select.value = CAPUBBadgeCatalog.level(id, sel.level)[0];
  select.onchange = ()=>{
    sel.level = select.value;
    State.badgeSelections[id] = sel;
    const img = tile.querySelector('img');
    if(img) img.src = ASSET(getBadgeAssetPath(id));
    if(!sel.checked){
      sel.checked = true;
      const chk = tile.querySelector('.bdChk');
      if(chk) chk.checked = true;
    }
    rebuildBadgesFromGallery();
  };
}

function buildBadgeGallery(){
  const wrap = by('badgeGallery');
  if(!wrap) return;

  normalizeBadgeSelections();
  wrap.innerHTML = '';

  // Only the badges the selected uniform wears (js/badge-rules.js isBadgeWornOnCurrentUniform, LIVE13 E67).
  const eligible = getEligibleBadgeIdsForMembership(State.membership).filter(id => isBadgeWornOnCurrentUniform(id));

  const showCount = State.badgeGalleryExpanded ? eligible.length : Math.min(12, eligible.length);

  for(let idx=0; idx<showCount; idx++){
    const id = eligible[idx];
    const sel = State.badgeSelections[id] || {checked:false};

    const tile = document.createElement('div');
    tile.className = 'galleryTile';

    const title = getBadgeDisplayName(id);
    tile.innerHTML = `
      <img loading="lazy" decoding="async" src="${ASSET(getBadgeAssetPath(id))}" alt="${escapeHtml(title)}">
      <div style="flex:1;min-width:0;">
        <div class="title">${escapeHtml(title)}</div>
        <div class="miniRow">
          <label><input type="checkbox" class="bdChk"> Add</label>
        </div>
        ${badgeLevelSelectHtml(id)}
        ${id==='squadron_commander_badge' ? `<div class="miniRow"><label><input type="checkbox" class="cmdGradChk"> Graduated commander</label></div>` : ``}
        ${getBadgeTileMetaHtml(id)}
      </div>
    `;
    wireBadgeLevelSelect(tile, id);

    const chk = tile.querySelector('.bdChk');
    const gradChk = tile.querySelector('.cmdGradChk');
    chk.checked = !!sel.checked;
    if(gradChk) gradChk.checked = !!State.commandInsignia?.graduatedCommander;

    chk.onchange = ()=>{
      if(id === 'squadron_commander_badge' && chk.checked && !canSelectCommandInsigniaForCurrentRank(true)){
        chk.checked = false;
        sel.checked = false;
        State.badgeSelections[id] = sel;
        rebuildBadgesFromGallery();
        return;
      }
      sel.checked = chk.checked;
      State.badgeSelections[id] = sel;
      if(chk.checked) enforceExclusive(id);
      rebuildBadgesFromGallery();
    };
    if(gradChk){
      gradChk.onchange = ()=>{
        if(gradChk.checked && !canSelectCommandInsigniaForCurrentRank(true)){
          gradChk.checked = false;
          sel.checked = false;
          chk.checked = false;
          State.badgeSelections[id] = sel;
          rebuildBadgesFromGallery();
          return;
        }
        if(!State.commandInsignia) State.commandInsignia = {};
        State.commandInsignia.graduatedCommander = gradChk.checked;
        if(gradChk.checked){
          sel.checked = true;
          chk.checked = true;
          State.badgeSelections[id] = sel;
        }
        rebuildBadgesFromGallery();
      };
    }

    wrap.appendChild(tile);
  }
}

/* ===========================
   PATCHES: GALLERY LOGIC
   =========================== */
function normalizePatchSelections(){
  patchList.forEach(id=>{
    if(!State.patchSelections[id]){
      State.patchSelections[id] = { checked:false };
    }
  });
}

function rebuildPatchesFromGallery(){
  State.patches = [];
  normalizePatchSelections();

  for(const id of patchList){
    if(State.patchSelections[id]?.checked && isPatchAuthorizedForUniform(id)){
      if(!State.patches.includes(id)) State.patches.push(id);
    }else if(State.patchSelections[id]?.checked && !isPatchAuthorizedForUniform(id)){
      State.patchSelections[id].checked = false;
    }
  }
  renderPatches();
}

function buildPatchGallery(){
  const wrap = by('patchGallery');
  if(!wrap) return;

  normalizePatchSelections();
  wrap.innerHTML='';

  const showCount = State.patchGalleryExpanded ? patchList.length : Math.min(10, patchList.length);

  for(let idx=0; idx<showCount; idx++){
    const id = patchList[idx];
    const meta = PATCH_META[id];

    // Safety guard: patchList may contain legacy/menu placeholder IDs
    // that do not have a PATCH_META entry yet. Without this, the builder
    // crashes at meta.label before later hotfixes can replace the gallery.
    if(!meta) continue;

    const sel = State.patchSelections[id];

    // The tile's words are patchTileHtml's (js/catalog.js): the name, Add, and where the patch is worn; never an id or a file name.
    const tile = document.createElement('div');
    tile.className='galleryTile';
    tile.dataset.patchId = id;
    tile.innerHTML = patchTileHtml(id);

    const chk = tile.querySelector('.ptChk');
    const authorized = isPatchAuthorizedForUniform(id);
    chk.checked = !!sel.checked && authorized;
    chk.disabled = !authorized;
    if(!authorized) tile.classList.add('disabledBlock');

    chk.onchange=()=>{
      if(!authorized){
        chk.checked = false;
        sel.checked = false;
        return;
      }
      sel.checked = chk.checked;
      rebuildPatchesFromGallery();
    };

    wrap.appendChild(tile);
  }
}
