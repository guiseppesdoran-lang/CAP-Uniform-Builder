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
    // The Commander's Commendation's stars (CAPR 39-3, 9f) go with every count, so the two star switches are never without an option: the region star, the National star, and
    // both (one of each type). The list's own options for the first 21 awards already have all three; the values and labels here are read by data/ribbon-awards.js.
    if(id === 'commander_commendation_award'){
      for(const [suffix, tag] of [['region', 'Region Cmdr'], ['national', 'National Cmdr'], ['national_region', 'Region+Natl']]){
        extended.push({ label:`${label} (${tag})`, value:`capub_total_${count}_${suffix}`, devices:{}, duplicates:rendered.duplicates });
      }
    }
  }
  return extended;
}

// The ribbons with one device switch (the lifesaving star, the Presidential V, the aircrew propeller): every count has an option with the device and one without, so the switch is never
// greyed for want of an option. The regulation forbids the device at no count: 9h (lifesaving) a silver star and at most two clasps on a ribbon, a second ribbon beyond three devices;
// 21g (Disaster Relief) one V with the clasps beside it; 21c (Air Search and Rescue) and 21d (Search "Find") a propeller centred with at most two clasps, a second ribbon beyond three
// devices; 6b the general limit of four devices. data/ribbon-awards.js `resolve` places them within those limits. The values and labels added here are read by `controls` there.
const CAPUB_ONE_DEVICE_RIBBONS = {
  lifesaving_award:{ max:84, suffix:'star', device:n => `${ordinalLabel(n)} with Star`, plain:n => `${ordinalLabel(n)} Award`, has:/with Star/i },
  disaster_relief_ribbon:{ max:84, suffix:'v', device:n => `${ordinalLabel(n)} with V-Device`, plain:n => `${ordinalLabel(n)} Award`, has:/V-Device/i },
  search_find_ribbon:{ suffix:'prop', device:n => `${ordinalLabel(n)} w/Prop`, plain:n => `${ordinalLabel(n)} Award`, has:/w\/Prop/i },
  air_search_and_rescue_ribbon:{ suffix:'prop', device:n => `${(n * 10).toLocaleString()} Sorties (Aircrew)`, plain:n => `${(n * 10).toLocaleString()} Sorties`, has:/\(Aircrew\)/i }
};
function capubCompleteDeviceOptions(id, options){
  const config = CAPUB_ONE_DEVICE_RIBBONS[id], RA = globalThis.CAPUBRibbonAwards;
  if(!config || !RA?.readCount) return options;
  const real = options.filter(o => o && o.value);
  // The count each option stands for, read once for each (it is read by a pattern match or several, and was read again for every count up to the limit).
  const counts = real.map(o => RA.readCount(id, o.value, String(o.label || '')));
  if(counts.some(c => c == null)) return options;
  const wears = real.map(o => (config.has.test(o.label) ? 1 : 0));
  const have = new Set(real.map((o, i) => `${counts[i]}|${wears[i]}`));
  const top = config.max || Math.max(...counts);
  const added = [];
  for(let n = 1; n <= top; n++){
    if(!have.has(`${n}|0`)) added.push({ label:config.plain(n), value:`capub_total_${n}`, devices:{}, duplicates:[] });
    if(!have.has(`${n}|1`)){
      const at = real.findIndex((o, i) => counts[i] === n && !wears[i]);
      added.push({ label:config.device(n), value:`capub_total_${n}_${config.suffix}`, devices:{}, duplicates:(at >= 0 && real[at].duplicates) || [] });
    }
  }
  if(!added.length) return options;
  const merged = [...real, ...added];
  const order = new Map(merged.map((o, i) => [o, i]));
  const countOf = new Map(real.map((o, i) => [o, counts[i]]));
  added.forEach(o => countOf.set(o, RA.readCount(id, o.value, String(o.label || ''))));
  merged.sort((a, b) => countOf.get(a) - countOf.get(b) || order.get(a) - order.get(b));
  return [...options.filter(o => !(o && o.value)), ...merged];
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
    // An award given a single time (the Cadet of the Year awards): no clasps, no repeat counts, only the basic award.
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
      ...capubCompleteDeviceOptions(id, capubCompositeStarComboOptions(id, capubCompositeAwardOptions(id, expanded)))
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

  // The Silver Medal of Valor has one choice, the plain ribbon: a count from a saved setup, a report or the old separate-ribbon values ("silver_valor_2") is that ribbon.
  if(id === 'silver_medal_of_valor' && value) return usable[0] || options[0];

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

function applyRibbonSelectionValue(id, value){
  const option = getRibbonSelectionOption(id, value || 'earned');
  State.ribbonSelections[id] = State.ribbonSelections[id] || { checked:false, devices:{}, awardValue:'', awardLabel:'' };
  State.ribbonSelections[id].checked = !!(option?.value || value);
  State.ribbonSelections[id].awardValue = option?.value || value || '';
  State.ribbonSelections[id].awardLabel = option?.label || '';
  State.ribbonSelections[id].devices = { ...(option?.devices || {}) };
}

// The command insignia pin and the Command Service Ribbon are separate: the pin is worn by current and graduated commanders in the grade
// of lieutenant colonel and below (CAPR 39-1, 10.2.5), the ribbon is awarded after a year of continuous command with the star of the one
// level it shows (CAPR 39-3, 21a). A commander in the first year wears the pin without the ribbon, so neither choice sets the other; the
// member report adds the ribbon from the length of the tour. What is kept here is the grade rule and the one pin.
function syncCommandBadgeAndRibbonSelections(){
  normalizeRibbonSelections();
  normalizeBadgeSelections();
  const commandIds = [...COMMAND_INSIGNIA_BADGE_IDS];
  if(!isCommandInsigniaGradeEligible(State.rank)){
    commandIds.forEach(id => { if(State.badgeSelections[id]) State.badgeSelections[id].checked = false; });
    State.badges = (State.badges || []).filter(id => !isCommandInsigniaBadge(id));
    return;
  }
  // Only one command pin is worn: the one already on the uniform stays, else the first chosen.
  const chosen = commandIds.filter(id => State.badgeSelections[id]?.checked);
  if(chosen.length > 1){
    const keep = (State.badges || []).find(id => chosen.includes(id)) || chosen[0];
    chosen.filter(id => id !== keep).forEach(id => { State.badgeSelections[id].checked = false; });
    State.badges = (State.badges || []).filter(id => !isCommandInsigniaBadge(id) || id === keep);
  }
}

// The Goddard's silver star for the Model Rocketry Badge (CAPR 39-3, 14h) is a fact about the member: a cadet who has earned the Mitchell and completed the badge's requirements may
// attach it, whether or not the badge is drawn on today's uniform. The fact is the Goddard selection's own `rocketryCredit`, as `honorCredit` is for the honor credit: the member's switch
// sets it, choosing the Model Rocketry Badge turns it on once at that moment, a value that names the star (a setup saved before the switch, the member report) is it, and taking the badge
// off does not turn it off. The star is worn (the value says so) only while the Mitchell is earned; without the Mitchell the fact is kept and comes back with it.
function syncGoddardRocketryStar(){
  normalizeRibbonSelections();
  normalizeBadgeSelections();

  const rocketrySelected = !!State.badgeSelections.model_rocketry_badge?.checked ||
    (State.badges || []).includes('model_rocketry_badge');
  const mitchellEarned = !!State.ribbonSelections.mitchell_award?.checked ||
    (State.ribbons || []).some(r => r?.id === 'mitchell_award');
  // The badge chosen now where it was not chosen at the last look: the first look (a page just made, a setup just loaded) turns nothing on.
  const was = State.rocketryBadgeWas;
  State.rocketryBadgeWas = rocketrySelected;

  const goddard = State.ribbonSelections.goddard_achievement;
  if(!goddard) return false;
  const currentValue = goddard.awardValue || 'earned';
  if(goddard.honorCredit === undefined){
    goddard.honorCredit = ['honor_credit','honor_credit_and_rocketry','earned_both_devices'].includes(currentValue);
  }
  if(/rocketry|earned_both_devices?$/.test(currentValue)) goddard.rocketryCredit = true;
  else if(goddard.rocketryCredit === undefined) goddard.rocketryCredit = false;
  if(was === false && rocketrySelected) goddard.rocketryCredit = true;
  if(!goddard.checked) return false;

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

// The member's own switch for one of the Goddard's two stars ('honor' or 'rocketry'): the fact is set and the value follows.
function setGoddardFact(key, on){
  normalizeRibbonSelections();
  const goddard = State.ribbonSelections.goddard_achievement;
  if(!goddard) return;
  syncGoddardRocketryStar();
  if(key === 'honor') goddard.honorCredit = !!on;
  else if(key === 'rocketry') goddard.rocketryCredit = !!on;
  // The value is recomputed from the facts: leave the old one where it names a star that is now off.
  goddard.awardValue = goddard.honorCredit ? 'honor_credit' : 'earned';
  syncGoddardRocketryStar();
  if(typeof rebuildRibbonsFromGallery === 'function') rebuildRibbonsFromGallery();
}

// The first real choice of a ribbon's award select (its basic award, a count of one), as the select lists it.
function capubFirstRibbonOptionValue(id){
  return (getRibbonAwardOptions(id).find(opt => opt?.value) || {}).value || '';
}

// The controls under a chosen ribbon (data/ribbon-awards.js controls): the count as lines of one dropdown and each separate fact as a switch, from the ribbon's option list and the
// option its selection is on. Every line and switch carries the option value a pick stores, so what is saved is what it always was.
function getRibbonControls(id){
  const sel = State.ribbonSelections?.[id] || {};
  const options = getRibbonAwardOptions(id);
  const found = sel.awardValue ? (options.find(o => o.value === sel.awardValue) || getRibbonSelectionOption(id, sel.awardValue)) : null;
  const model = CAPUBRibbonAwards.controls(id, options, found && found.value ? found : null, { membership: State.membership, military: isMilitaryRibbonId(id) });
  if(id === 'goddard_achievement'){
    // The rocketry switch is shown while the Mitchell is earned, and is on while the member's fact is (the value only says so while the Mitchell is earned).
    const mitchell = !!State.ribbonSelections?.mitchell_award?.checked;
    model.toggles = model.toggles.filter(t => t.key !== 'rocketry' || mitchell);
    for(const t of model.toggles) t.on = t.key === 'rocketry' ? !!sel.rocketryCredit : !!sel.honorCredit || (t.on && sel.honorCredit === undefined);
  }
  return model;
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

  sel.awardValue = id === 'silver_medal_of_valor' && value ? option.value : (value || '');
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
    if(['rocketry_star','honor_credit_and_rocketry'].includes(value)) sel.rocketryCredit = true;   // a value that names the star is the fact; any other leaves the fact as it was
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

// A senior member wears one cadet program award ribbon (CAPR 39-3 Attachment 2, 14j-14m speak of ribbons), but may choose some or all of
// the medals he or she earned for the mess dress and the corporate semi-formal (CAPR 39-1 11.1.4), so the cadet milestone awards
// (Wright Brothers, Mitchell, Earhart, Eaker, Spaatz) may be picked together: the rack shows the highest, the miniature medals every one that
// has a medal. Any other cadet award still excludes the rest, and a milestone excludes the awards that are not milestones.
function enforceSeniorSingleCadetAwardRibbon(selectedId){
  const selected = State.ribbonSelections?.[selectedId];
  if(State.membership !== 'senior' || !selected?.checked || !SENIOR_HIGHEST_CADET_AWARD_RIBBONS.has(selectedId)) return;
  const keepsMilestones = CADET_MILESTONES.has(selectedId);
  for(const otherId of Object.keys(State.ribbonSelections)){
    if(otherId === selectedId || !SENIOR_HIGHEST_CADET_AWARD_RIBBONS.has(otherId)) continue;
    if(keepsMilestones && CADET_MILESTONES.has(otherId)) continue;
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
      // The Silver Medal of Valor is worn plain: a setup saved with a count (or with the old separate-ribbon value) becomes the plain ribbon.
      if(id === 'silver_medal_of_valor' && State.ribbonSelections[id].checked && State.ribbonSelections[id].awardValue !== 'award_1'){
        State.ribbonSelections[id].awardValue = 'award_1';
        State.ribbonSelections[id].awardLabel = 'Basic Award';
        State.ribbonSelections[id].devices = {};
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
  syncGoddardRocketryStar();
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
    let militaryInstances=null;
    let stacks = 1;
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

// The ribbons are chosen in the chooser window (js/wiring.js openGalleryModal), from picture tiles (js/pick-lists.js ribbonLists); the sidebar keeps no list of its own.
function buildRibbonGallery(){
  const wrap = by('ribbonGallery');
  if(wrap) wrap.innerHTML = '';
}

/* JROTC / ROTC ribbons (LIVE14 E74): picked in a menu of the chooser window (js/pick-lists.js rotcMenu) with the program and a search to narrow its tiles, in the data's
   order, which is the order of wear among them (js/catalog.js ribbonList). Three at most (CAPR 39-1 11.2.5): a fourth is refused with the message
   enforceRotcRibbonLimit gives. A selection is still State.ribbonSelections[id] = { checked, awardValue:'earned', ... }, so setups saved with the old tiles load as they were. */
function capubRotcLimitMessage(){
  return `At most ${ROTC_RIBBONS.limit} JROTC/ROTC ribbons may be worn (CAPR 39-1, ${ROTC_RIBBONS.ref}); remove one to add another.`;
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

  // The ribbon pass draws the rack and then the badges again.
  rebuildRibbonsFromGallery();
  if(typeof capubSyncBadgesNotWornNote === 'function') capubSyncBadgesNotWornNote();
  syncCommandInsigniaTiles();
}

// One command pin is worn, so a change to one command tile (or to the row on the Items step) shows on the other tile of an open chooser: the chooser's tiles are put as the state says.
function syncCommandInsigniaTiles(){
  if(typeof window !== 'undefined' && typeof window.capubSyncBadgeTiles === 'function') window.capubSyncBadgeTiles();
}

// The badges are chosen in the chooser window (js/wiring.js openGalleryModal), from picture tiles; the sidebar keeps no list of its own.
function buildBadgeGallery(){
  const wrap = by('badgeGallery');
  if(wrap) wrap.innerHTML = '';
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

// The patches are chosen in the chooser window (js/wiring.js openGalleryModal), from picture tiles (js/pick-lists.js patchList); the sidebar keeps no list of its own.
function buildPatchGallery(){
  const wrap = by('patchGallery');
  if(wrap) wrap.innerHTML = '';
}
