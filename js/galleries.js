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

// Families whose levels are a plain "Nth Award" progression. Each keeps ONE
// piece of artwork - its own basic-award image - and every higher level is that
// image plus composited devices. The base image is deliberately the McChord
// basic-award file rather than the generic ribbons/<id>.png, because the two
// are different renderings of the same ribbon and swapping them would restyle
// every level.
const CAPUB_COMPOSITED_AWARD_FAMILIES = {
  'air_force_aerial_achievement_medal': 'usaf_aam01.png',
  'cadet_special_activity_ribbon':      'ncsa01.png',
  'cap_achievment_award':               'AA01.png',
  'distinguished_service_award':        'distin01.png',
  'encampment_ribbon':                  'encamp01.png',
  'exceptional_service_award':          'except01.png',
  'meritorious_service_award':          'meriti01.png',
  'national_commander_unit_citation_award': 'unitci-nat01.png',
  'unit_citation_award':                'unitci01.png'
};

/*
  Rebuild an award-count family's options so the artwork is one base image plus
  computed devices. Labels and option values are taken from the existing option
  list unchanged, so saved profiles and the dropdown text are unaffected.
*/
function capubCompositeAwardOptions(id, options){
  const base = CAPUB_COMPOSITED_AWARD_FAMILIES[id];
  if(!base) return options;
  return options.map((opt, index) => {
    const total = index + 1;
    const [first, ...overflow] = capubSplitAwardsAcrossRibbons(total);
    return {
      ...opt,
      image: base,
      // Miniature medals still use McChord's per-level artwork: devices on a
      // mini medal are rotated vertically (CAPR 39-1 11.4.2) and are not the
      // horizontal run composited onto the ribbon. getMiniMedalImagePath()
      // derives its filename from this rather than from the ribbon image, so
      // mess dress keeps the exact medal it rendered before.
      medalImage: opt.image,
      devices: capubDevicesForAwardTotal(first),
      duplicates: overflow.map(count => ({
        image: base,
        awardLabel: `${opt.label} - additional ribbon`,
        devices: capubDevicesForAwardTotal(count)
      }))
    };
  });
}

/*
  Star-combo families. Their level labels spell the device set out directly -
  "Basic Award", "Bronze Star", "S-S-B Stars" - so the devices are parsed from
  the label rather than derived from an award count. Each keeps one image.

  Order within a run comes from deviceMeta weight (gold > silver > bronze),
  which reproduces the label order the artwork uses.
*/
const CAPUB_STAR_COMBO_FAMILIES = {
  'cadet_advisory_council_ribbon':           'cac.png',
  'cap_gill_robb_wilson_ribbon':             'wilson.png',
  'cap_paul_e_garber_ribbon':                'garber.png',
  'cap_leadership_ribbon':                   'leader.png',
  'national_cadet_competition_ribbon':       'ncc.png',
  'national_color_guard_competition_ribbon': 'ncgc01.png'
};

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
  return null; // unrecognised - caller keeps the baked artwork
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
  const base = CAPUB_STAR_COMBO_FAMILIES[id];
  if(!base) return options;
  return options.map(opt => {
    const devices = capubDevicesFromStarLabel(opt.label) ?? capubDevicesFromStarValue(opt.value);
    if(devices === null || devices === undefined) return opt;
    return { ...opt, image: base, medalImage: opt.image, devices };
  });
}

/*
  RIBBON_SPECIAL_IMAGE_OPTIONS carries a second, semantically-keyed option list
  for these same families (bronze_clasp_1, silver_clasp_2, ...). The member
  report importer resolves to those values, so it has to composite too -
  otherwise an imported award count would still ask for the deleted per-level
  artwork. Labels and values are untouched; only image/devices change.
*/
for(const familyId of Object.keys(CAPUB_COMPOSITED_AWARD_FAMILIES)){
  const special = RIBBON_SPECIAL_IMAGE_OPTIONS[familyId];
  if(Array.isArray(special) && special.length){
    RIBBON_SPECIAL_IMAGE_OPTIONS[familyId] = capubCompositeAwardOptions(familyId, special);
  }
}
for(const familyId of Object.keys(CAPUB_STAR_COMBO_FAMILIES)){
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
  distinguished_service_award:{ prefix:'distin', unit:'award', multiplier:1 },
  exceptional_service_award:{ prefix:'except', unit:'award', multiplier:1 },
  meritorious_service_award:{ prefix:'meriti', unit:'award', multiplier:1 },
  cap_achievment_award:{ prefix:'AA', unit:'award', multiplier:1 },
  national_commander_unit_citation_award:{ prefix:'unitci-nat', unit:'award', multiplier:1 },
  unit_citation_award:{ prefix:'unitci', unit:'award', multiplier:1 },
  cap_counterdrug_ribbon:{ prefix:'coudru', unit:'sorties', multiplier:10 },
  disaster_relief_ribbon:{ prefix:'disast', unit:'award', multiplier:1 },
  homeland_security_ribbon:{ prefix:'homeland', unit:'sorties', multiplier:10 },
  cap_cadet_orientation_pilot_ribbon:{ prefix:'cadpil', unit:'flights', multiplier:50 },
  community_service_ribbon:{ prefix:'commun', unit:'hours', multiplier:60 },
  cadet_special_activity_ribbon:{ prefix:'ncsa', unit:'activities', multiplier:1 },
  encampment_ribbon:{ prefix:'encamp', unit:'encampments', multiplier:1 }
};

function mcchordContinuationLabel(config, level){
  if(config.unit === 'award') return `${ordinalLabel(level)} Award`;
  const amount = level * config.multiplier;
  return `${amount} ${config.unit.replace(/^./, c => c.toUpperCase())}`;
}

function mcchordContinuationOptions(id){
  const config = MCCHORD_21_LEVEL_RIBBONS[id];
  if(!config) return [];
  const p = config.prefix;
  const baseDuplicate = { image:null, awardLabel:'Additional Ribbon' };
  const imageDuplicate = suffix => ({ image:`${p}${suffix}.png`, awardLabel:'Additional Ribbon' });
  const layout = {
    10:{ image:`${p}09.png`, duplicates:[baseDuplicate] },
    11:{ image:`${p}11.png` },
    12:{ image:`${p}12.png` },
    13:{ image:`${p}13.png` },
    14:{ image:`${p}13.png`, duplicates:[baseDuplicate] },
    15:{ image:`${p}13.png`, duplicates:[imageDuplicate('02')] },
    16:{ image:`${p}16.png` },
    17:{ image:`${p}17.png` },
    18:{ image:`${p}17.png`, duplicates:[baseDuplicate] },
    19:{ image:`${p}17.png`, duplicates:[imageDuplicate('02')] },
    20:{ image:`${p}17.png`, duplicates:[imageDuplicate('03')] },
    21:{ image:`${p}21.png` }
  };
  if(id === 'disaster_relief_ribbon'){
    Object.assign(layout, {
      5:{ image:'disast05.png' },
      6:{ image:'disast06.png' },
      7:{ image:'disast07.png' },
      8:{ image:'disast08.png' },
      9:{ image:'disast09.png' }
    });
  }
  return Object.entries(layout).map(([level, option]) => ({
    label:mcchordContinuationLabel(config, Number(level)),
    value:`mcchord_level_${level}`,
    devices:{},
    ...option
  }));
}

const CAPUB_SINGLE_AWARD_RIBBON_IDS = new Set([
  'Air_Force_Organizational_Excellence_Award',
  'crisis_ribbon',
  'iace_ribbon',
  'afa_award',
  'afsa_award',
  'vfw_officer_award',
  'vfw_nco_award'
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
  const first = chunks[0];
  const duplicates = [];
  chunks.forEach((chunk, chunkIndex) => {
    if(chunkIndex > 0){
      duplicates.push({ image:chunk.image || null, awardLabel:`${label} - ribbon ${chunkIndex + 1}` });
    }
    (chunk.duplicates || []).forEach(duplicate => duplicates.push({ ...duplicate }));
  });
  return { image:first.image || null, duplicates };
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
      image:rendered.image,
      devices:{},
      duplicates:rendered.duplicates
    });
  }
  return extended;
}

function getRibbonAwardOptions(id){
  if(CAPUB_SINGLE_AWARD_RIBBON_IDS.has(id)) return ribbonSelectOnlyOptions();
  const mcchordOptions = globalThis.MCCHORD_RIBBON_VARIANTS?.[id];
  if(Array.isArray(mcchordOptions) && mcchordOptions.length){
    const expanded = capubExtendMcchordOptionsTo84(id, mcchordOptions);
    return [
      { label:'- Select -', value:'', image:null, devices:{} },
      ...capubCompositeStarComboOptions(id, capubCompositeAwardOptions(id, expanded))
    ];
  }
  const specialImageOptions = ribbonImageOptionList(id);
  if(specialImageOptions){
    const continuation = mcchordContinuationOptions(id);
    return continuation.length ? [...specialImageOptions, ...continuation] : specialImageOptions;
  }

  if(id === 'Air_Force_Organizational_Excellence_Award'){
    return ribbonAwardCountOptions(10);
  }

  if(id === 'air_medal') return ribbonAwardCountOptions(2);

  if(new Set([
    'national_commanders_citation','cadet_certificate_of_proficiency',
    'historic_cadet_blue_achievement','historic_cadet_white_achievement',
    'historic_cadet_red_achievement','frank_borman_falcon_award',
    'cap_world_war_2_service_ribbon','anti_submarine_coastal_patrol_ribbon',
    'southern_liaison_patrol_ribbon','tow_target_tracking_ribbon','courier_ribbon',
    'forest_patrol_ribbon','missing_aircraft_ribbon'
  ]).has(id)) return ribbonSelectOnlyOptions();

  if(id === 'silver_medal_of_valor'){
    return [
      { label:'- Select -', value:'', devices:{} },
      { label:'1 Silver Medal of Valor', value:'silver_valor_1', devices:{} },
      { label:'2 Silver Medals of Valor', value:'silver_valor_2', devices:{} },
      { label:'3 Silver Medals of Valor', value:'silver_valor_3', devices:{} }
    ];
  }

  if(CADET_ACHIEVEMENT_RIBBONS.has(id)){
    if(id === 'mitchell_award'){
      return [
        { label:'- Select -', value:'', devices:{} },
        { label:'Earned', value:'earned', devices:{} },
        { label:'Earned + COS Star', value:'earned_cos_star', devices:{'1_Bronze_Star_Device':1} }
      ];
    }

    if(id === 'goddard_achievement'){
      return [
        { label:'- Select -', value:'', devices:{} },
        { label:'Earned', value:'earned', devices:{} },
        { label:'Earned + Rocketry/Honor Device', value:'earned_device', devices:{'1_Bronze_Star_Device':1} },
        { label:'Earned + Both Devices', value:'earned_both_devices', devices:{'1_Bronze_Star_Device':2} }
      ];
    }

    return ribbonSelectOnlyOptions();
  }

  if(id === 'red_service_ribbon'){
    return ribbonYearOptions([2,5,10,15,20,25,30,35,40,45,50,55,60,65]);
  }

  if(id === 'search_find_ribbon') return ribbonFindOptions(32);
  if(id === 'air_search_and_rescue_ribbon') return ribbonSortieOptions(320,10);
  if(id === 'community_service_ribbon') return ribbonHourOptions(1260,60);

  if(id === 'cadet_advisory_council_ribbon'){
    return [
      { label:'- Select -', value:'', devices:{} },
      { label:'Group CAC', value:'group', devices:{} },
      { label:'Wing CAC / Bronze Star', value:'wing_bronze', devices:{'1_Bronze_Star_Device':1} },
      { label:'Region CAC / Silver Star', value:'region_silver', devices:{'1_Silver_Star_Device':1} },
      { label:'National CAC / Gold-Level Placeholder', value:'national_gold', devices:{'1_Silver_Star_Device':1,'1_Bronze_Star_Device':1} }
    ];
  }

  if(id === 'disaster_relief_ribbon'){
    return [
      ...ribbonAwardCountOptions(10),
      { label:'Basic Award + V Device Placeholder', value:'basic_v', devices:{'1_Bronze_Star_Device':1} }
    ];
  }

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
  State.ribbonSelections[id].imageOverride = option?.image || getRibbonImageOverride(id, option?.value || value || '');
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
  goddard.imageOverride = option.image || getRibbonImageOverride('goddard_achievement', desiredValue);
  State.ribbonSelections.goddard_achievement = goddard;
  return true;
}

function setRibbonSelectionFromDropdown(id, value,{deferRender=false}={}){
  normalizeRibbonSelections();
  const sel = State.ribbonSelections[id] || { checked:false, devices:{} };
  const option = getRibbonSelectionOption(id, value);

  sel.awardValue = value || '';
  sel.awardLabel = option.label || '';
  sel.checked = !!value;
  sel.devices = value ? { ...(option.devices || {}) } : {};
  sel.imageOverride = value ? (option.image || getRibbonImageOverride(id, value)) : null;

  if(id === 'goddard_achievement'){
    sel.honorCredit = ['honor_credit','honor_credit_and_rocketry'].includes(value);
    sel.rocketryCredit = ['rocketry_star','honor_credit_and_rocketry'].includes(value);
  }

  State.ribbonSelections[id] = sel;

  enforceSeniorSingleCadetAwardRibbon(id);

  if(id === 'goddard_achievement' || id === 'mitchell_award'){
    syncGoddardRocketryStar();
  }
  if(!deferRender) rebuildRibbonsFromGallery();
}

function selectAllCapUniformAwards({maximum=false}={}){
  State.ribbonSelections={};
  normalizeRibbonSelections();

  for(const id of getEligibleRibbonIds()){
    const usable=getRibbonAwardOptions(id).filter(option=>option.value);
    const selected=maximum ? usable[usable.length-1] : usable[0];
    if(selected) setRibbonSelectionFromDropdown(id,selected.value,{deferRender:true});
  }

  rebuildRibbonsFromGallery();
  buildRibbonGallery();
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
    State.ribbonSelections[otherId].imageOverride = null;
  }
}

function normalizeRibbonSelections(){
  ribbonList.forEach(id=>{
    if(!State.ribbonSelections[id]){
      State.ribbonSelections[id] = { checked:false, devices:{}, awardValue:'', awardLabel:'' };
    }else{
      if(!State.ribbonSelections[id].devices) State.ribbonSelections[id].devices={};
      if(CAPUB_SINGLE_AWARD_RIBBON_IDS.has(id) && State.ribbonSelections[id].checked){
        State.ribbonSelections[id].awardValue = 'earned';
        State.ribbonSelections[id].awardLabel = 'Earned';
        State.ribbonSelections[id].devices = {};
        State.ribbonSelections[id].imageOverride = null;
      }
      if(State.ribbonSelections[id].awardValue === undefined){
        const hasDevices = Object.values(State.ribbonSelections[id].devices || {}).some(v => Number(v) > 0);
        State.ribbonSelections[id].awardValue = State.ribbonSelections[id].checked ? (hasDevices ? 'custom_devices' : 'earned') : '';
      }
      if(State.ribbonSelections[id].awardLabel === undefined){
        const opt = getRibbonSelectionOption(id, State.ribbonSelections[id].awardValue);
        State.ribbonSelections[id].awardLabel = opt?.label || '';
      }
      if(State.ribbonSelections[id].imageOverride === undefined){
        State.ribbonSelections[id].imageOverride = getRibbonImageOverride(id, State.ribbonSelections[id].awardValue || '');
      }
    }
  });
}

function rebuildRibbonsFromGallery(){
  State.ribbons = [];
  normalizeRibbonSelections();
  normalizeBadgeSelections();
  syncCommandBadgeAndRibbonSelections();

  for(const id of getEligibleRibbonIds()){
    const sel = State.ribbonSelections[id];
    if(!sel || !sel.checked) continue;

    // compute stacks needed due to caps or special rules.
    // Silver Medal of Valor has no device for multiple awards in this builder;
    // it renders as multiple separate ribbons, capped at three.
    let stacks = getRibbonDuplicateCountForSelection(id, sel.awardValue || '');
    for(const [dev,count] of Object.entries(sel.devices||{})){
      const cap = RIBBON_DEVICE_CAP[dev] || 0;
      if(cap > 0) stacks = Math.max(stacks, Math.ceil((count||0)/cap));
    }

    for(let i=0;i<stacks;i++){
      const inst = {
        id,
        devices:{},
        awardValue: sel.awardValue || '',
        awardLabel: sel.awardLabel || '',
        // Prefer the resolved option's image: composited families deliberately
        // return one base image for every level, while getRibbonImageOverride()
        // reads the raw McChord table and would restore the per-level artwork.
        imageOverride: (getRibbonSelectionOption(id, sel.awardValue || '') || {}).image
                       || getRibbonImageOverride(id, sel.awardValue || '')
      };

      for(const [dev,count] of Object.entries(sel.devices||{})){
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
            awardLabel: dup.awardLabel || 'Additional Ribbon',
            imageOverride: dup.image || null
          });
        });
      }
    }
  }

  renderRack();
  renderAllBadges();
}

function buildRibbonGallery(){
  const wrap = by('ribbonGallery');
  if(!wrap) return;
  normalizeRibbonSelections();
  wrap.innerHTML = '';
  const eligible = getEligibleRibbonIds();
  const visible = State.ribbonGalleryExpanded ? eligible : eligible.slice(0, 12);
  const currentRibbons = visible.filter(id => !HISTORICAL_RIBBONS.has(id));
  const historicalRibbons = visible.filter(id => HISTORICAL_RIBBONS.has(id));
  const sections = State.ribbonGalleryExpanded
    ? [
        { title:'Current Ribbons', description:'Currently issued awards and achievements.', ids:currentRibbons },
        { title:'Historical Ribbons', description:'Legacy cadet awards and wartime service ribbons.', ids:historicalRibbons }
      ]
    : [{ title:'', description:'', ids:visible }];

  const buildTile=(id)=>{
    const sel = State.ribbonSelections[id];
    const tile = document.createElement('div');
    tile.className = 'galleryTile ribbonSelectorTile';
    tile.dataset.ribbonId = id;
    const title = getRibbonDisplayName(id);
    const miniPath = getMiniMedalImagePath({id, awardValue:sel.awardValue || ''});
    const miniFallbackPath = miniMedalImages[normalizeRibbonId(id)] || miniMedalImages[id] || '';
    const miniPreview = miniPath
      ? `<div class="miniMedalPreview"><span>Mini medal</span><img loading="lazy" decoding="async" alt="${escapeHtml(title)} mini medal"></div>`
      : `<div class="miniMedalPreview missing"><span>No mini medal asset</span></div>`;
    const options = getRibbonAwardOptions(id).map(opt => {
      const selected = (sel.awardValue || '') === opt.value ? 'selected' : '';
      return `<option value="${escapeHtml(opt.value)}" ${selected}>${escapeHtml(opt.label)}</option>`;
    }).join('');
    const deviceSummary = Object.entries(sel.devices || {})
      .filter(([,qty]) => Number(qty) > 0)
      .map(([devId,qty]) => `${escapeHtml(deviceMeta[devId]?.label || devId)}: ${Number(qty)}`)
      .join(' • ');
    tile.innerHTML = `
      <img loading="lazy" decoding="async" alt="${escapeHtml(title)}">
      <div style="flex:1;min-width:0;">
        <div class="title">${escapeHtml(title)}</div>
        <div class="sub">(${escapeHtml(id)})</div>
        ${miniPreview}
        <label class="ribbonAwardLabel">
          Award count / earned level
          <select class="rbAwardSelect" data-ribbon-id="${escapeHtml(id)}">
            ${options}
          </select>
        </label>
        <div class="sub ribbonDeviceSummary">
          ${sel.checked ? `Selected: <b>${escapeHtml(sel.awardLabel || 'Earned')}</b>${deviceSummary ? ` • ${deviceSummary}` : ''}${sel.deviceWarnings?.length ? ` • ${escapeHtml(sel.deviceWarnings.join(' '))}` : ''}` : 'Not selected'}
        </div>
      </div>
    `;
    const ribbonPreview = tile.querySelector(':scope > img');
    capubInstallImageFallback(ribbonPreview, [
      getRibbonImagePath({id, awardValue: sel.awardValue || ''}),
      `ribbons/${normalizeRibbonId(id)}.png`
    ]);
    const miniMedalPreview = tile.querySelector('.miniMedalPreview img');
    if(miniMedalPreview){
      capubInstallImageFallback(miniMedalPreview, [miniPath, miniFallbackPath]);
    }
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
    section.ids.forEach(id=>wrap.appendChild(buildTile(id)));
  }

}

function wireRibbonTileControls(root){
  root.querySelectorAll('.rbAwardSelect').forEach(select=>{
    const id=select.dataset.ribbonId;
    if(id) select.onchange=()=>setRibbonSelectionFromDropdown(id,select.value);
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
}

function buildBadgeGallery(){
  const wrap = by('badgeGallery');
  if(!wrap) return;

  normalizeBadgeSelections();
  wrap.innerHTML = '';

  const eligible = getEligibleBadgeIdsForMembership(State.membership);

  const showCount = State.badgeGalleryExpanded ? eligible.length : Math.min(12, eligible.length);

  for(let idx=0; idx<showCount; idx++){
    const id = eligible[idx];
    const sel = State.badgeSelections[id] || {checked:false};

    const tile = document.createElement('div');
    tile.className = 'galleryTile';

    const title = getBadgeDisplayName(id);
    const rareCadetTag = (State.membership === 'cadet' && rareCadetBadges.has(id)) ? ' <span class="validationBadge">Rare Cadet Eligibility</span>' : '';
    tile.innerHTML = `
      <img loading="lazy" decoding="async" src="${ASSET(getBadgeAssetPath(id))}" alt="${escapeHtml(title)}">
      <div style="flex:1;min-width:0;">
        <div class="title">${escapeHtml(title)}${rareCadetTag}</div>
        <div class="sub">(${escapeHtml(id)})</div>
        <div class="miniRow">
          <label><input type="checkbox" class="bdChk"> Add</label>
        </div>
        ${id==='squadron_commander_badge' ? `<div class="miniRow"><label><input type="checkbox" class="cmdGradChk"> Graduated commander</label></div>` : ``}
        <div class="sub">Slot: <b>${getBadgeSlotLabel(id)}</b> • Regulation scale: ${Math.round(getBadgeRenderSize(id).width)}×${Math.round(getBadgeRenderSize(id).height)} px</div>
      </div>
    `;

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

    const tile = document.createElement('div');
    tile.className='galleryTile';

    const title = meta.label || id.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
    tile.innerHTML=`
      <img loading="lazy" decoding="async" src="${ASSET(meta.img)}" alt="${escapeHtml(title)}">
      <div style="flex:1;min-width:0;">
        <div class="title">${escapeHtml(title)}</div>
        <div class="sub">(${escapeHtml(id)})</div>
        <div class="miniRow">
          <label><input type="checkbox" class="ptChk"> Add</label>
        </div>
        <div class="sub">Slot hint: <b>${escapeHtml(meta.slotHint)}</b> • Size: ${meta.w}×${meta.h} px</div>
      </div>
    `;

    const chk = tile.querySelector('.ptChk');
    const authorized = isPatchAuthorizedForUniform(id);
    chk.checked = !!sel.checked && authorized;
    chk.disabled = !authorized;
    if(!authorized){
      tile.classList.add('disabledBlock');
      const sub = tile.querySelector('.sub:last-child');
      const reason = getPatchAuthorizationReason(id);
      if(sub) sub.innerHTML += ` • <b>${escapeHtml(reason || 'Not authorized on current uniform')}</b>`;
    }

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
