// Extracted verbatim from index.html: the CAP Member Search report importer.
// Loaded as a classic script between the two halves of the inline app script,
// so it shares the same global scope and runs in the same order as before.

/* ===========================
   CAP MEMBER SEARCH REPORT IMPORTER
   =========================== */
const MEMBER_REPORT_IMPORT_BADGE_PRIORITY = [
  // Aviation / aeronautical
  // Highest-value aviation family order: Pilot > Observer > Aircrew.
  'CAPMasterPilot1_621A0E2ED15DA','CAPSeniorPilot1_D9725AE959752','CAPPilot1_FA9D33EA587D8',
  'GliderPilot1_7BFB287379918','BalloonPilot1_442D89C94185B','solo_badge','pre_solo_badge',
  'MasterObserver1_1B88D5071FD5C','SeniorObserver1_0E35802A29801','observer_badge',
  'MasterAirCrew1_72AC4CAE7A310','SeniorAirCrew1_B289BAE6E515C','AirCrew1_DB3F0FCC3650F',
  'uas_pilot_master_badge','uas_pilot_senior_badge','uas_pilot_basic_badge',

  // Occupational / over-ribbon
  // Incident Commander is intentionally higher value than Ground Team because
  // Master Ground Team is required for the Basic Incident Commander Badge.
  'basic_incident_commander_badge',
  'master_ground_team_badge','senior_ground_team_badge','ground_team_basic_badge',
  'emt_paramedic','emt_intermediate','emt_basic_badge',

  // Pocket/flexible specialty
  'model_rocketry_badge',
  'master_emergency_services_badge','senior_emergency_services_badge','emergency_services_badge',
  'communications_master_badge','communications_senior_badge','communications_technician_badge','information_technology_technician_badge','historian_technicianIbadge',
  'cyber_badges','stem_badges','volunteer_university_instructor_badge','cadet_programs_badge',
  'administration_technician_badge','administration_senior_badge','administration_master_badge','aerospace_education_technician_badge','aerospace_education_senior_badge','aerospace_education_master_badge','finance_technician_badge','finance_senior_badge','finance_master_badge',
  'administration_technician_badge','administration_senior_badge','administration_master_badge','aerospace_education_technician_badge','aerospace_education_senior_badge','aerospace_education_master_badge','finance_technician_badge','finance_senior_badge','finance_master_badge',
  'nra_marksman_badge'
];

function setMemberReportImportStatus(lines, type='info'){
  const el = by('memberReportImportStatus');
  if(!el) return;
  const arr = Array.isArray(lines) ? lines : [lines];
  const color = type === 'error' ? 'var(--danger)' : type === 'ok' ? 'var(--ok)' : 'var(--muted)';
  el.style.color = color;
  el.innerHTML = arr.map(line => `<div>${String(line).replace(/[<>&]/g, ch => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[ch]))}</div>`).join('');
}

// PDF.js is only needed when a member imports a PDF report, so it is fetched on
// first use instead of blocking every page load.
// Vendored (pdfjs-dist 3.11.174, Apache-2.0; see vendor/pdfjs/LICENSE) so no third-party code loads at runtime.
const PDFJS_URL = 'vendor/pdfjs/pdf.min.js';
let pdfJsLoading = null;
function loadPdfJs(){
  if(window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if(!pdfJsLoading){
    pdfJsLoading = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = PDFJS_URL;
      script.onload = () => window.pdfjsLib ? resolve(window.pdfjsLib) : reject(new Error('PDF.js loaded but is unavailable.'));
      script.onerror = () => { pdfJsLoading = null; script.remove(); reject(new Error('PDF.js did not load. Check your internet connection or upload a .txt export instead.')); };
      document.head.appendChild(script);
    });
  }
  return pdfJsLoading;
}

async function extractMemberReportText(file){
  const name = (file?.name || '').toLowerCase();

  if(name.endsWith('.txt') || file.type === 'text/plain'){
    return await file.text();
  }

  await loadPdfJs();

  pdfjsLib.GlobalWorkerOptions.workerSrc =
    pdfjsLib.GlobalWorkerOptions.workerSrc ||
    'vendor/pdfjs/pdf.worker.min.js';

  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const pages = [];

  for(let p=1; p<=pdf.numPages; p++){
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const strings = content.items.map(item => item.str || '').filter(Boolean);
    pages.push(strings.join(' '));
  }

  return pages.join('\n');
}

function normalizeMemberReportText(text){
  return String(text || '')
    .replace(/\uFFFE|\uFFFD|\uF0BE/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}


function removeLocalActivitiesFromMemberReport(text){
  const source = String(text || '');
  const start = source.search(/Local\s+Activities/i);
  if(start < 0) return source;

  // Local Activities is the final member-report section. Do not try to locate
  // a later heading by label: activity descriptions themselves commonly contain
  // words such as "Professional Development", "Awards", and "Promotions".
  // Treating those cells as headings ended the exclusion early and allowed an
  // activity such as "Spaatz Award Presentation" to award a ribbon.
  return source.slice(0, start).trim();
}

function normalizeImportedRank(raw){
  const r = String(raw || '').trim();
  const fixes = {
    'C/1stLt':'C/1st Lt',
    'C/2dLt':'C/2d Lt',
    'C/LtCol':'C/Lt Col',
    'C/Maj':'C/Maj',
    'C/Capt':'C/Capt',
    'C/Col':'C/Col',
    'C/CMSgt':'C/CMSgt',
    'C/SMSgt':'C/SMSgt',
    'C/MSgt':'C/MSgt',
    'C/TSgt':'C/TSgt',
    'C/SSgt':'C/SSgt',
    'C/SrA':'C/SrA',
    'C/A1C':'C/A1C',
    'C/Amn':'C/Amn',
    'C/AB':'C/AB'
  };
  return fixes[r] || r.replace('1stLt','1st Lt').replace('2dLt','2d Lt').replace('LtCol','Lt Col');
}

function getHighestImportedRank(text){
  const ranks = [...RANKS.cadet, ...RANKS.senior];
  const rankHits = [];
  for(const rank of ranks){
    const escaped = rank.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace('\\ ', '\\s*');
    const re = new RegExp(`\\b${escaped}\\b`, 'i');
    if(re.test(text)) rankHits.push(rank);
  }

  // Prefer explicit general information line first.
  const gen = text.match(/\b(MALE|FEMALE)\s+(CADET|SENIOR(?:\s+MEMBER)?)\s+(SM|[A-Z]\/[A-Za-z0-9]+|C\/1st\s*Lt|C\/2d\s*Lt|C\/Lt\s*Col|SSgt|TSgt|MSgt|SMSgt|CMSgt|2d\s*Lt|1st\s*Lt|Capt|Maj|Lt\s*Col|Col|Brig\s*Gen|Maj\s*Gen)\b/i);
  if(gen) return normalizeImportedRank(gen[3]);

  if(rankHits.includes('C/Maj')) return 'C/Maj';
  return rankHits[0] || null;
}

function countOccurrences(text, pattern){
  const m = text.match(pattern);
  return m ? m.length : 0;
}

// The award count a semantic import value stands for: "find_3", "hours_120", or the clasps/stars it names
// beyond the first award ("bronze_clasp_3" is the 4th award, "silver_star_1_bronze_star_2" the 8th).
// Level stars (the Commander's Commendation region/National star) carry no digit and so add nothing.
function importedAwardCountFromValue(value){
  const v = String(value || '');
  let m;
  if((m = /^find_(\d+)$/i.exec(v))) return Number(m[1]);
  if((m = /^hours_(\d+)$/i.exec(v))) return Math.max(1, Math.round(Number(m[1]) / 60));
  if((m = /^capub_total_(\d+)$/i.exec(v))) return Number(m[1]);
  let additional = 0;
  const re = /(silver|bronze)_(?:clasp|star)_(\d+)/gi;
  while((m = re.exec(v))) additional += (m[1].toLowerCase() === 'silver' ? 5 : 1) * Number(m[2]);
  return 1 + additional;
}

// The clasps (or stars) that mark `count` awards, as a value suffix: '' for one award, "bronze_clasp_3"
// for four, "silver_clasp_1_bronze_clasp_1" for seven (CAPR 39-3 6b: five bronze become one silver).
function importedAdditionalAwardValue(count, kind='clasp'){
  const additional = Math.max(0, Math.floor(Number(count) || 1) - 1);
  const silver = Math.floor(additional / 5), bronze = additional % 5;
  return [silver ? `silver_${kind}_${silver}` : '', bronze ? `bronze_${kind}_${bronze}` : ''].filter(Boolean).join('_');
}

// Import values whose ribbon option is named by level rather than by count.
const IMPORTED_RIBBON_VALUE_ALIASES = {
  // The CAC level values (js/patches.js CAC_RIBBON_VALUE_BY_LEVEL) predate the 39-3 21j options, which
  // are cac_group / cac_wing / cac_region / cac_national; without this every level fell back to Group.
  cadet_advisory_council_ribbon: {
    group:'cac_group', earned:'cac_group', wing_bronze_star:'cac_wing', region_silver_star:'cac_region', national_gold_star:'cac_national'
  },
  cap_command_service_ribbon: {
    earned:/^Squadron\/CC$/i, group_bronze_star:/^Group\/CC$/i, wing_silver_star:/^Wing\/CC$/i,
    region_gold_star:/^Region\/CC$/i, national_two_gold_stars:/^National\/CC$/i
  }
};

// The modifiers an option label shows besides the count: the Presidential "V", the aircrew propeller,
// the lifesaving star and the Commander's Commendation level stars.
function importedOptionModifiers(id, text){
  const t = String(text || '');
  const out = [];
  if(id === 'disaster_relief_ribbon' && /silver[_ ]v\b|silver_v|v[-_ ]device|w\/v\b/i.test(t)) out.push('v');
  if(['search_find_ribbon','air_search_and_rescue_ribbon'].includes(id) && /prop|aircrew/i.test(t)) out.push('prop');
  if(id === 'lifesaving_award' && /star/i.test(t)) out.push('star');
  if(id === 'commander_commendation_award'){
    if(/national|natl/i.test(t)) out.push('national');
    if(/region/i.test(t)) out.push('region');
  }
  return out.sort().join('+');
}

// The real picker option an import value lands on. The picker's options are the McChord catalog
// (mcchord_* values labelled "4th Award", "2nd with V-Device", "3rd Award (Region Cmdr)", "120 Hours"),
// so a semantic value is matched by the award count and modifiers it stands for. An import value that
// matched no option used to fall back to the basic ribbon, silently dropping its devices.
function findImportedRibbonOption(id, value){
  const options = typeof getRibbonAwardOptions === 'function' ? (getRibbonAwardOptions(id) || []) : [];
  const usable = options.filter(o => o && o.value);
  const exact = usable.find(o => o.value === value);
  if(exact) return exact;
  const alias = IMPORTED_RIBBON_VALUE_ALIASES[id]?.[value];
  if(alias){
    const found = usable.find(o => alias instanceof RegExp ? alias.test(String(o.label || '')) : o.value === alias);
    if(found) return found;
  }
  const RA = globalThis.CAPUBRibbonAwards;
  const semantic = String(value || '');
  if(RA?.readCount && RA.FAMILIES?.[id] && !/^years_/.test(semantic)){
    const count = importedAwardCountFromValue(semantic);
    const wanted = importedOptionModifiers(id, semantic);
    const found = usable.find(o => RA.readCount(id, o.value, String(o.label || '')) === count &&
      importedOptionModifiers(id, String(o.label || '')) === wanted &&
      !/additional ribbon/i.test(String(o.label || '')));
    if(found) return found;
  }
  return typeof getRibbonSelectionOption === 'function' ? getRibbonSelectionOption(id, value) : null;
}

function selectImportedRibbon(id, value='earned'){
  if(!id) return;
  if(!State.ribbonSelections[id]) State.ribbonSelections[id] = { checked:false, devices:{}, awardValue:'', awardLabel:'' };
  const option = findImportedRibbonOption(id, value);
  State.ribbonSelections[id].checked = true;
  State.ribbonSelections[id].awardValue = option?.value || value || 'earned';
  State.ribbonSelections[id].awardLabel = option?.label || 'Earned';
  State.ribbonSelections[id].devices = { ...(option?.devices || {}) };
  State.ribbonSelections[id].imageOverride = option?.image || getRibbonImageOverride(id, option?.value || value || 'earned');
  enforceRibbonExclusions(id);
}

// A plain clasp ribbon: one bronze clasp per award after the first, five bronze becoming one silver
// (CAPR 39-3 6b). The value names the clasps, so it resolves to the picker's "Nth Award" option for any count.
function chooseSpecialRibbonValueByAwardCount(id, count){
  if(count <= 1) return 'earned';
  return importedAdditionalAwardValue(count, 'clasp');
}

function chooseCommunityServiceValue(count){
  if(count <= 1) return 'hours_60';
  if(count === 2) return 'bronze_clasp_1';
  if(count === 3) return 'bronze_clasp_2';
  if(count === 4) return 'bronze_clasp_3';
  if(count === 5) return 'bronze_clasp_4';
  if(count === 6) return 'silver_clasp_1';
  if(count === 7) return 'silver_clasp_1_bronze_clasp_1';
  return 'silver_clasp_1_bronze_clasp_2';
}


// CAPR 39-3 21g (data/ribbon-awards.js: the V marks a Presidentially declared disaster): one silver V on
// the ribbon, the bronze clasps for the later awards beside it. `hasV` is true when any report row says V.
function chooseDisasterReliefValue(count, hasV=false){
  const clasps = importedAdditionalAwardValue(count, 'clasp');
  if(hasV === true) return clasps ? `silver_v_${clasps}` : 'silver_v';
  return clasps || 'earned';
}

// One Disaster Relief Ribbon row per award. A row says V in whatever words the record uses: "with V",
// "w/V", "V Device", "V-Device", "(V)", "Silver V", or names the Presidential declaration the V stands for.
// The row is read up to its date, so a V or "Presidential" elsewhere in the report does not count.
function extractDisasterReliefFromReport(text){
  const source = String(text || '');
  const rowRe = /Disaster\s+Relief\s+Ribbon([\s\S]{0,60}?)(?=\b\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}\b|Disaster\s+Relief\s+Ribbon|$)/gi;
  const vRe = /(?:^|[\s(\/\-,])V(?:[\s\-]*Device)?(?=$|[\s),\-])|Silver\s+V\b|Presidential/i;
  let count = 0, hasV = false, m;
  while((m = rowRe.exec(source))){
    count++;
    const before = source.slice(Math.max(0, m.index - 14), m.index);
    if(vRe.test(m[1]) || /(?:Silver\s+V|Presidential)\s*$/i.test(before)) hasV = true;
    if(m[0].length === 0) rowRe.lastIndex++;
  }
  return count ? { count, hasV, value:chooseDisasterReliefValue(count, hasV) } : null;
}

// CAPR 39-3 20d (data/ribbon-awards.js: stars, one per activity): a bronze star for each activity after the
// first, five bronze becoming one silver. The value names the stars, so it resolves for any count (it used to
// stop at eight, and its seven- and eight-activity values matched no picker option and showed a bare ribbon).
function chooseCadetSpecialActivityValue(count){
  if(count <= 1) return 'earned';
  return importedAdditionalAwardValue(count, 'star');
}

// CAPR 39-3 9f (data/ribbon-awards.js levelStars): a bronze clasp for each award after the first, five
// bronze becoming one silver (6b); a bronze star when an award was authorized by a region commander and
// a silver star when by the National Commander, to the wearer's right of the clasps. `level` is the
// highest level among the awards, or 'national_region' when both stars are earned.
function chooseCommandersCommendationValue(level, count=1){
  const normalizedLevel = String(level || 'wing').toLowerCase();
  const awardCount = Math.max(1, Math.floor(Number(count) || 1));
  const clasps = importedAdditionalAwardValue(awardCount, 'clasp');
  const prefix = normalizedLevel === 'national_region' ? 'national_silver_star_region_bronze_star'
    : normalizedLevel === 'national' ? 'national_silver_star'
    : normalizedLevel === 'region' ? 'region_bronze_star'
    : '';
  if(!prefix) return clasps ? `wing_${clasps}` : 'earned';
  return clasps ? `${prefix}_${clasps}` : prefix;
}

function extractCommandersCommendationFromReport(text){
  const decorations = getReportSectionUntilAny(text, 'Decorations', [
    'Ribbons', 'Local Activities', 'Professional Development', 'Cadet Training'
  ]);
  const scope = decorations || String(text || '');
  // One row per award. The apostrophe is straight in an HTML copy and curly in a PDF export, and may be
  // missing or doubled ("Commanders Commendation", "Commanders' Commendation"); the level may be printed
  // in parentheses, after a dash, with "Level" or "Commander", or not at all (a wing award).
  const rowRe = /\bCommanders?(?:\s*['‘’ʼ`´]\s*s?)?\s+Commendation(?:\s+(?:Award|Ribbon))?(?:\s*[(\-–:,]?\s*(National|Region|Wing)\b(?:\s+(?:Level|Commander|Cmdr|CC))?\s*\)?)?/gi;
  const rows = [];
  let match;
  while((match = rowRe.exec(scope))){
    rows.push({ level:(match[1] || 'wing').toLowerCase() });
  }
  if(!rows.length) return null;
  // Every row is one award of the same ribbon, so all of them count toward the clasps; the level of the
  // highest approving commander sets the star (both stars when region and National awards are on record).
  const hasNational = rows.some(row => row.level === 'national');
  const hasRegion = rows.some(row => row.level === 'region');
  const level = hasNational && hasRegion ? 'national_region' : hasNational ? 'national' : hasRegion ? 'region' : 'wing';
  const count = rows.length;
  return { level, count, value:chooseCommandersCommendationValue(level, count) };
}

// CAPR 39-3 9h: the Certificate of Recognition for Lifesaving carries the Lifesaving Award ribbon (Attachment 2:
// "Lifesaving Award"). A save in a blood or organ transport mission earns the basic ribbon; a save of any other
// kind adds the silver star. Later awards add bronze clasps, five bronze become one silver clasp. The report row
// names neither kind, so the import selects the ribbon and the clasps and leaves the star to the member.
function chooseLifesavingValue(count){
  if(count <= 1) return 'earned';
  return importedAdditionalAwardValue(count, 'clasp');
}

function chooseEncampmentValue(count){
  if(count <= 1) return 'earned';
  return importedAdditionalAwardValue(count, 'clasp');
}

function importedBadgePriority(id){
  const specialtyPriority = getImportedSpecialtyBadgePriority(id);
  if(specialtyPriority !== null){
    // Keep rated specialty-track badges after aviation/qualification badges,
    // but order the specialty badges themselves by rating and duty family.
    return 100 + specialtyPriority;
  }
  const i = MEMBER_REPORT_IMPORT_BADGE_PRIORITY.indexOf(id);
  if(i === -1) return 9999;
  const legacySpecialtyStart = MEMBER_REPORT_IMPORT_BADGE_PRIORITY.indexOf('master_emergency_services_badge');
  return legacySpecialtyStart >= 0 && i >= legacySpecialtyStart ? 5000 + i : i;
}



function parseCapReportDate(dateText){
  const m = String(dateText || '').match(/(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})/);
  if(!m) return null;
  const months = {
    jan:0, january:0, feb:1, february:1, mar:2, march:2, apr:3, april:3,
    may:4, jun:5, june:5, jul:6, july:6, aug:7, august:7, sep:8, sept:8, september:8,
    oct:9, october:9, nov:10, november:10, dec:11, december:11
  };
  const monthKey = m[2].toLowerCase();
  if(!(monthKey in months)) return null;
  const d = new Date(Number(m[3]), months[monthKey], Number(m[1]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function extractJoinDateFromMemberReport(text){
  const t = normalizeMemberReportText(text);

  // Normal report header shape:
  // Gender Type Rank Date of Rank Joined Expires ...
  // MALE CADET C/Maj 18 Dec 2025 24 Sep 2020 30 Sep 2026 ...
  const headerMatch = t.match(/\b(?:MALE|FEMALE)\s+(?:CADET|SENIOR(?:\s+MEMBER)?)\s+[A-Z]\/?[A-Za-z0-9]*(?:\s+[A-Za-z]+)?\s+\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}\s+(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})\s+\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}\b/i);
  if(headerMatch) return parseCapReportDate(headerMatch[1]);

  // Fallbacks for copied or alternate report text.
  const explicitMatch = t.match(/\b(?:Joined|Join Date|Date Joined)\s*:?\s*(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})\b/i);
  if(explicitMatch) return parseCapReportDate(explicitMatch[1]);

  return null;
}

function getFullYearsBetween(startDate, endDate = new Date()){
  if(!(startDate instanceof Date) || Number.isNaN(startDate.getTime())) return 0;
  let years = endDate.getFullYear() - startDate.getFullYear();
  const beforeAnniversary =
    endDate.getMonth() < startDate.getMonth() ||
    (endDate.getMonth() === startDate.getMonth() && endDate.getDate() < startDate.getDate());
  if(beforeAnniversary) years--;
  return Math.max(0, years);
}

function chooseRedServiceValueFromYears(years){
  if(years >= 35) return 'years_35';
  if(years >= 30) return 'years_30';
  if(years >= 25) return 'years_25';
  if(years >= 20) return 'years_20';
  if(years >= 15) return 'years_15';
  if(years >= 10) return 'years_10';
  if(years >= 5) return 'years_5';
  if(years >= 2) return 'years_2';
  return null;
}


function getReportSection(text, startLabel, endLabel){
  const source = String(text || '');
  const start = source.search(new RegExp(startLabel, 'i'));
  if(start < 0) return '';
  const rest = source.slice(start);
  const end = rest.search(new RegExp(endLabel, 'i'));
  return end >= 0 ? rest.slice(0, end) : rest;
}

function getReportSectionUntilAny(text, startLabel, endLabels=[]){
  const source = String(text || '');
  const start = source.search(new RegExp(startLabel, 'i'));
  if(start < 0) return '';
  const rest = source.slice(start);
  let bestEnd = -1;
  for(const label of endLabels){
    const idx = rest.search(new RegExp(label, 'i'));
    if(idx > 0 && (bestEnd < 0 || idx < bestEnd)) bestEnd = idx;
  }
  return bestEnd >= 0 ? rest.slice(0, bestEnd) : rest;
}


function extractEncampmentCountFromReport(text){
  const source = String(text || '');

  // Prefer the actual Encampments table only. PDF text extraction can split headings
  // across lines/pages, so the end-marker regex intentionally allows a small amount
  // of any text between words like "Orientation" and "Flights".
  const startMatch = /\bEncampments\b/i.exec(source);
  if(!startMatch) return 0;

  const rest = source.slice(startMatch.index);
  const endRe = /\b(?:In-Person[\s\S]{0,30}Required[\s\S]{0,30}Staff[\s\S]{0,30}Training|Required[\s\S]{0,30}Staff[\s\S]{0,30}Training|Orientation[\s\S]{0,30}Flights|Cadet[\s\S]{0,30}Achievements|Awards|Promotions|Decorations|Ribbons|Local[\s\S]{0,30}Activities|Professional[\s\S]{0,30}Development|Specialty[\s\S]{0,30}Tracks)\b/i;
  const afterHeading = rest.slice('Encampments'.length);
  const endMatch = endRe.exec(afterHeading);
  const section = endMatch
    ? rest.slice(0, 'Encampments'.length + endMatch.index)
    : rest;

  // Count only CAP-style dates in that section: one per encampment. The picker's options run well past
  // nine (the McChord catalog), so the count is not capped.
  const dates = section.match(/\b\d{1,2}\s+(?:Jan|January|Feb|February|Mar|March|Apr|April|May|Jun|June|Jul|July|Aug|August|Sep|Sept|September|Oct|October|Nov|November|Dec|December)\s+\d{4}\b/gi) || [];
  return dates.length;
}

// "MITCHELL, GUISEPPE" -> "Mitchell", "Guiseppe": each word, and each part after a hyphen or apostrophe,
// capitalised; "MCDONALD" -> "McDonald". The nameplates and tapes uppercase the name again.
function titleCaseImportedName(raw){
  return String(raw || '').toLowerCase().replace(/\s+/g, ' ').trim()
    .replace(/(^|[\s\-'’])([a-z])/g, (m, sep, ch) => sep + ch.toUpperCase())
    .replace(/\bMc([a-z])/g, (m, ch) => 'Mc' + ch.toUpperCase());
}

// The member's name. The General Information row is authoritative: "CAPID Name Gender ..." then
// "123456 MITCHELL, GUISEPPE MALE CADET ...". The last name is everything before the comma (so "SMITH JR"
// and "VAN DYKE" stay whole); the first name is the first given name (a middle name or initial is not worn on
// the nameplate). Without that row, the report heading "C/Col Guiseppe Mitchell" is read: the grade removed,
// the last word is the last name.
function extractMemberNameFromReport(text){
  const t = normalizeMemberReportText(text);
  const row = t.match(/\b\d{5,7}\s+([A-Z][A-Z'’.\- ]*?)\s*,\s*([A-Z][A-Z'’.\-]*)(?:\s+[A-Z][A-Z'’.\-]*)*?\s+(?:MALE|FEMALE)\b/i);
  if(row){
    const lastName = titleCaseImportedName(row[1]);
    const firstName = titleCaseImportedName(row[2]);
    if(firstName && lastName) return { firstName, lastName };
  }
  const heading = t.match(/Member\s+Details\s+(.+?)\s+General\s+Information/i);
  if(heading){
    let rest = heading[1].trim();
    const ranks = (typeof RANKS === 'object' ? [...(RANKS.cadet || []), ...(RANKS.senior || [])] : [])
      .sort((a, b) => b.length - a.length);
    for(const rank of ranks){
      const re = new RegExp('^' + rank.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*') + '\\s+', 'i');
      if(re.test(rest)){ rest = rest.replace(re, ''); break; }
    }
    const words = rest.split(' ').filter(w => /^[A-Za-z][A-Za-z'’.\-]*$/.test(w));
    if(words.length >= 2) return { firstName:titleCaseImportedName(words[0]), lastName:titleCaseImportedName(words[words.length - 1]) };
  }
  return null;
}

function getCurrentProfileFromMemberReport(text){
  const t = normalizeMemberReportText(text);
  const m = t.match(/\b(MALE|FEMALE)\s+(CADET|SENIOR(?:\s+MEMBER)?)\s+(SM|[A-Z]\/[A-Za-z0-9]+|C\/1st\s*Lt|C\/2d\s*Lt|C\/Lt\s*Col|SSgt|TSgt|MSgt|SMSgt|CMSgt|2d\s*Lt|1st\s*Lt|Capt|Maj|Lt\s*Col|Col|Brig\s*Gen|Maj\s*Gen)\b/i);
  if(!m) return null;
  return {
    gender: m[1].toLowerCase() === 'female' ? 'female' : 'male',
    membership: /^senior/i.test(m[2]) ? 'senior' : 'cadet',
    rank: normalizeImportedRank(m[3])
  };
}

// The Cadet Training table: from its heading to the next section. The end is any of the headings that can
// follow it, so a report without an Encampments section (or one whose PDF text runs the headings together)
// does not read on into the awards.
function getCadetTrainingSection(text){
  return getReportSectionUntilAny(text, 'Cadet\\s+Training', [
    'Encampments', 'Orientation\\s+Flights', 'Cadet\\s+Achievements', 'Decorations', 'Activity\\s*\\/\\s*Service\\s+Ribbon', 'Local\\s+Activities'
  ]);
}

// National Cadet Special Activities a record may list without the "NCSA" word (the NCSA catalogue and CAPR 39-1
// Figure A8-2). IACE is left out: it has its own
// ribbon. Each pattern names one parent activity, so a student row and a staff row of the same year are one credit.
const IMPORTED_NCSA_ACTIVITY_PATTERNS = [
  ['PJOC', /Pararescue|\bPJOC\b/i],
  ['CYBER DEFENSE', /Cyber\s*Defense|\bCDTA\b/i],
  ['NATIONAL FLIGHT ACADEMY', /National\s+Flight\s+Academy|\bNFA\b/i],
  ['NATIONAL BLUE BERET', /Blue\s+Beret|\bNBB\b/i],
  ['NATIONAL EMERGENCY SERVICES ACADEMY', /National\s+Emergency\s+Services\s+Academy|\bNESA\b/i],
  ['ADVANCED TECHNOLOGIES ACADEMY', /Advanced\s+Technolog(?:y|ies)\s+Academy/i],
  ['ENGINEERING TECHNOLOGIES ACADEMY', /Engineering\s+Technolog(?:y|ies)\s+Academy/i],
  ['HONOR GUARD ACADEMY', /Honor\s+Guard\s+Academy|\bNHGA\b/i],
  // CAPR 39-1 Figure A8-2 (NCSA attendance patches) also names these.
  ['SPACE FAMILIARIZATION COURSE', /Space\s+(?:Command|Force)\s+Familiarization/i],
  ['SUPT FAMILIARIZATION COURSE', /Undergraduate\s+Pilot\s+Training|\bSUPT\b/i],
  ['ENGINEERING ACADEMY', /\bEngineering\s+Academy\b/i]
];

function extractCadetSpecialActivityCountFromReport(text){
  const cadetTraining = getCadetTrainingSection(text);
  if(!cadetTraining) return 0;
  const activityRe = /(.{0,120}?)\s+(\d{1,2}\s+(?:Jan|January|Feb|February|Mar|March|Apr|April|May|Jun|June|Jul|July|Aug|August|Sep|Sept|September|Oct|October|Nov|November|Dec|December)\s+(\d{4}))/gi;
  const credits = new Set();
  let match;
  while((match = activityRe.exec(cadetTraining))){
    const title = String(match[1] || '').replace(/\s+/g, ' ').trim();
    const year = match[3];
    let parent = null;
    if(/Hawk Mountain|\bHMRS\b|\bHawk\s+Cadet\s+Cadre\b/i.test(title)) parent = 'HMRS';
    else if(/Civic Leadership Academy|\bCLA\b/i.test(title)) parent = 'CLA';
    else if(/Air Force Civil Engineering Academy|\bAFCEA\b/i.test(title)) parent = 'AFCEA';
    else if(/Cadet Officers? School|\bCOS\b/i.test(title)) parent = 'COS';
    else if(/Military Operations Training School|\bMOTS\b/i.test(title)) parent = 'MOTS';
    else{
      const known = IMPORTED_NCSA_ACTIVITY_PATTERNS.find(([, re]) => re.test(title));
      if(known) parent = known[0];
      else if(/\bNCSA\b|National Cadet Special Activit/i.test(title)){
        // Key on the text from the NCSA word on, so table headings run into the first row do not split one
        // activity into two credits.
        parent = title.slice(title.search(/\bNCSA\b|National Cadet Special Activit/i))
          .replace(/\b(?:Cadet|Student|Staff|Cadre|Air Staff)\b/gi, ' ')
          .replace(/\s+/g, ' ').trim().toUpperCase();
      }
    }
    // RCLS and RST are not standalone NCSA credits. Staff/cadre records for
    // the same parent event and year collapse into one activity credit.
    if(parent && !/\bRCLS\b|Required Staff Training|\bRST\b/i.test(title)){
      credits.add(`${parent}:${year}`);
    }
  }
  return credits.size;
}

// The highest CAC echelon in the duty position tables (current and past): the council named in the title
// ("Cadet WCAC Representative", "Region CAC Chair", "National Cadet Advisory Council ...") or the row's
// Echelon column after a CAC title. CAPR 39-3 21j: wing bronze star, region silver, national gold.
function importedCacLevelFromDutyPositions(text){
  const duty = getReportSectionUntilAny(text, 'Duty\\s+Positions', [
    'Professional Development', 'Specialty Tracks', 'Cadet Training', 'Encampments', 'Cadet Achievements', 'Decorations'
  ]);
  if(!duty) return null;
  const levels = [];
  const named = /\b(?:(N|R|W|G)CAC\b|(National|Region|Wing|Group)\s+(?:CAC\b|Cadet\s+Advisory\s+Council))/gi;
  let m;
  while((m = named.exec(duty))){
    const key = (m[1] || m[2]).charAt(0).toUpperCase();
    levels.push({ N:'national', R:'region', W:'wing', G:'group' }[key]);
  }
  const echelon = /(?:\bCAC\b|Cadet\s+Advisory\s+Council)[^\d]{0,80}?\b(NATIONAL|REGION|WING|GROUP)\b/g;
  while((m = echelon.exec(duty))) levels.push(m[1].toLowerCase());
  const order = ['national', 'region', 'wing', 'group'];
  return order.find(level => levels.includes(level)) || null;
}

function keepOnlyHighestCadetMilestoneForSenior(ribbons, membership){
  if(membership !== 'senior') return ribbons;
  const milestoneOrder = ['wright_brothers_award','mitchell_award','earhart_award','eaker_award','spaatz_award'];
  let highest = null;
  for(const id of milestoneOrder){
    if(ribbons.some(r => r?.id === id)) highest = id;
  }
  if(!highest) return ribbons;
  return ribbons.filter(r => !milestoneOrder.includes(r?.id) || r.id === highest);
}

function hasCosGraduateCreditFromReport(text){
  const cadetTraining = getCadetTrainingSection(text);
  const activityLines = cadetTraining || String(text || '');
  return /\bCOS\b|Cadet\s+Officers?\s+School/i.test(activityLines);
}

function applyCosStarToHighestCadetMilestone(ribbons, text){
  if(!hasCosGraduateCreditFromReport(text)) return ribbons;

  // COS credit belongs on the Mitchell ribbon itself, even when the cadet has
  // subsequently earned a higher milestone award.
  return ribbons.map(r => r?.id === 'mitchell_award'
    ? { ...r, value:'earned_cos_star', reason:`${r.reason || 'Mitchell Award'} + COS graduate star` }
    : r
  );
}

function hasAchievementHonorCreditFromReport(text, achievementNumber){
  const source = normalizeMemberReportText(text);
  const rowRe = new RegExp(
    `Achievement\\s+${achievementNumber}\\b([\\s\\S]{0,240}?)(?=Achievement\\s+\\d+\\b|$)`,
    'i'
  );
  const row = rowRe.exec(source)?.[1] || '';
  return /Honor\s+Credit|With\s+Honou?rs?|Honou?rs?\s+Credit/i.test(row);
}

function hasNonTrainingQualification(text, labelPattern){
  const source = String(text || '');
  const re = new RegExp(labelPattern, 'i');
  const m = re.exec(source);
  if(!m) return false;
  const windowText = source.slice(Math.max(0, m.index - 80), Math.min(source.length, m.index + 220));
  return !/\(\s*TRAINING\s*\)|\bTRAINING\b/i.test(windowText);
}

function extractAwardCountFromAwardsTable(text, awardPattern){
  const awards = getReportSection(text, 'Awards', 'Promotions');
  const decs = getReportSection(text, 'Decorations', 'Local Activities');
  const scope = `${awards} ${decs}`;
  const re = new RegExp(awardPattern, 'gi');
  const m = scope.match(re);
  return m ? m.length : 0;
}




const CAPUB_SPECIALTY_TRACK_TO_BADGE = {
  "ADMINISTRATION": {
    TECHNICIAN: "administration_technician_badge",
    SENIOR: "administration_senior_badge",
    MASTER: "administration_master_badge"
  },
  "AEROSPACE": {
    TECHNICIAN: "aerospace_education_technician_badge",
    SENIOR: "aerospace_education_senior_badge",
    MASTER: "aerospace_education_master_badge"
  },
  "AEROSPACE EDUCATION": {
    TECHNICIAN: "aerospace_education_technician_badge",
    SENIOR: "aerospace_education_senior_badge",
    MASTER: "aerospace_education_master_badge"
  },
  "CADET PROGRAMS": {
    TECHNICIAN: "cadet_programs_technician_badge",
    SENIOR: "cadet_programs_senior_badge",
    MASTER: "cadet_programs_master_badge"
  },
  "COMMUNICATIONS": {
    TECHNICIAN: "communications_technician_badge",
    SENIOR: "communications_senior_badge",
    MASTER: "communications_master_badge"
  },
  "EMERGENCY SERVICES": {
    TECHNICIAN: "emergency_services_badge",
    SENIOR: "senior_emergency_services_badge",
    MASTER: "master_emergency_services_badge"
  },
  "FINANCE": {
    TECHNICIAN: "finance_technician_badge",
    SENIOR: "finance_senior_badge",
    MASTER: "finance_master_badge"
  },
  "HISTORIAN": {
    TECHNICIAN: "historian_technicianIbadge",
    SENIOR: "historian_senior_badge",
    MASTER: "historian_master_badge"
  },
  "INFORMATION TECHNOLOGY": {
    TECHNICIAN: "information_technology_technician_badge",
    SENIOR: "information_technology_senior_badge",
    MASTER: "information_technology_master_badge"
  },
  "IT": {
    TECHNICIAN: "information_technology_technician_badge",
    SENIOR: "information_technology_senior_badge",
    MASTER: "information_technology_master_badge"
  },
  "LOGISTICS": {
    TECHNICIAN: "logistics_technician_badge",
    SENIOR: "logistics_senior_badge",
    MASTER: "logistics_master_badge"
  },
  "OPERATIONS": {
    TECHNICIAN: "operations_technician_badge",
    SENIOR: "operations_senior_badge",
    MASTER: "operations_master_badge"
  },
  "PERSONNEL": {
    TECHNICIAN: "personnel_technician_badge",
    SENIOR: "personnel_senior_badge",
    MASTER: "personnel_master_badge"
  },
  "PROFESSIONAL DEVELOPMENT": {
    TECHNICIAN: "professional_development_technician_badge",
    SENIOR: "professional_development_senior_badge",
    MASTER: "professional_development_master_badge"
  },
  "PUBLIC AFFAIRS": {
    TECHNICIAN: "public_affairs_technician_badge",
    SENIOR: "public_affairs_senior_badge",
    MASTER: "public_affairs_master_badge"
  },
  "RECRUITING AND RETENTION OFFICER": {
    TECHNICIAN: "recruiting_retention_technician_badge",
    SENIOR: "recruiting_retention_senior_badge",
    MASTER: "recruiting_retention_master_badge"
  },
  "RECRUITING AND RETENTION": {
    TECHNICIAN: "recruiting_retention_technician_badge",
    SENIOR: "recruiting_retention_senior_badge",
    MASTER: "recruiting_retention_master_badge"
  },
  "SAFETY": {
    TECHNICIAN: "safety_technician_badge",
    SENIOR: "safety_senior_badge",
    MASTER: "safety_master_badge"
  },
  "INSPECTOR GENERAL": {
    TECHNICIAN: "inspector_general_technician_badge",
    SENIOR: "inspector_general_senior_badge",
    MASTER: "inspector_general_master_badge"
  },
  "DRUG DEMAND REDUCTION": {
    TECHNICIAN: "drug_demand_reduction_technician_badge",
    SENIOR: "drug_demand_reduction_senior_badge",
    MASTER: "drug_demand_reduction_master_badge"
  },
  "DDR": {
    TECHNICIAN: "drug_demand_reduction_technician_badge",
    SENIOR: "drug_demand_reduction_senior_badge",
    MASTER: "drug_demand_reduction_master_badge"
  },
  "STANDARDIZATION AND EVALUATION": {
    TECHNICIAN: "stan_eval_tech_badge",
    SENIOR: "stan_eval_senior_badge",
    MASTER: "stan_eval_master_badge"
  },
  "STANDARDIZATION EVALUATION": {
    TECHNICIAN: "stan_eval_tech_badge",
    SENIOR: "stan_eval_senior_badge",
    MASTER: "stan_eval_master_badge"
  },
  "STAN EVAL": {
    TECHNICIAN: "stan_eval_tech_badge",
    SENIOR: "stan_eval_senior_badge",
    MASTER: "stan_eval_master_badge"
  },
  "CDI": {
    TECHNICIAN: "cdi_technician_badge",
    SENIOR: "cdi_senior_badge",
    MASTER: "cdi_master_badge"
  },
  "CHARACTER DEVELOPMENT INSTRUCTOR": {
    TECHNICIAN: "cdi_technician_badge",
    SENIOR: "cdi_senior_badge",
    MASTER: "cdi_master_badge"
  }
};

// Automatic member-report specialty-badge preference:
//   1. Highest rating first: Master, Senior, Technician.
//   2. At the same rating: operations, CP/AE, then personnel/support.
// The order inside each family makes otherwise equal selections deterministic.
const CAPUB_SPECIALTY_TRACK_FAMILY_ORDER = {
  operations: [
    'OPERATIONS','EMERGENCY SERVICES','COMMUNICATIONS','INFORMATION TECHNOLOGY','IT',
    'LOGISTICS','SAFETY','STANDARDIZATION AND EVALUATION','STANDARDIZATION EVALUATION','STAN EVAL'
  ],
  cadetProgramsAerospace: ['CADET PROGRAMS','AEROSPACE EDUCATION','AEROSPACE'],
  personnel: [
    'PERSONNEL','ADMINISTRATION','FINANCE','RECRUITING AND RETENTION OFFICER',
    'RECRUITING AND RETENTION','PROFESSIONAL DEVELOPMENT','PUBLIC AFFAIRS','HISTORIAN',
    'INSPECTOR GENERAL','DRUG DEMAND REDUCTION','DDR','CDI','CHARACTER DEVELOPMENT INSTRUCTOR'
  ]
};

const CAPUB_SPECIALTY_BADGE_IMPORT_PRIORITY = (() => {
  const result = new Map();
  // Governance/service precedence: Command Council and Senior Advisory Group
  // outrank National Staff; National Staff outranks every rated specialty.
  result.set('command_council_badge', -300);
  result.set('senior_advisory_group_badge', -300);
  result.set('national_staff_badge', -200);
  const ratingOrder = { MASTER:0, SENIOR:1, TECHNICIAN:2 };
  const families = [
    CAPUB_SPECIALTY_TRACK_FAMILY_ORDER.operations,
    CAPUB_SPECIALTY_TRACK_FAMILY_ORDER.cadetProgramsAerospace,
    CAPUB_SPECIALTY_TRACK_FAMILY_ORDER.personnel
  ];

  families.forEach((tracks, familyIndex) => {
    tracks.forEach((track, trackIndex) => {
      const levels = CAPUB_SPECIALTY_TRACK_TO_BADGE[track] || {};
      Object.entries(levels).forEach(([level, badgeId]) => {
        if(!badgeId || ratingOrder[level] === undefined) return;
        const priority = ratingOrder[level] * 100 + familyIndex * 30 + trackIndex;
        const previous = result.get(badgeId);
        if(previous === undefined || priority < previous) result.set(badgeId, priority);
      });
    });
  });
  return result;
})();

function getImportedSpecialtyBadgePriority(id){
  return CAPUB_SPECIALTY_BADGE_IMPORT_PRIORITY.has(id)
    ? CAPUB_SPECIALTY_BADGE_IMPORT_PRIORITY.get(id)
    : null;
}

function getHighestImportedSpecialtyBadgeIds(ids, limit = 2){
  return [...new Set((ids || []).filter(id => getImportedSpecialtyBadgePriority(id) !== null))]
    .sort((a, b) => getImportedSpecialtyBadgePriority(a) - getImportedSpecialtyBadgePriority(b))
    .slice(0, Math.max(0, Number(limit) || 0));
}

function normalizeSpecialtyTrackName(name){
  return String(name || '')
    .toUpperCase()
    .replace(/&/g, ' AND ')
    .replace(/\bR\s*&\s*R\b/g, 'RECRUITING AND RETENTION')
    .replace(/RECRUITING\s+&\s+RETENTION/g, 'RECRUITING AND RETENTION')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeSpecialtyTrackLevel(level){
  return String(level || '').toUpperCase().replace(/\s+/g, ' ').trim();
}

function getMemberReportSpecialtyTracksSection(text){
  return getReportSectionUntilAny(text, 'Specialty Tracks', [
    'Encampments', 'Cadet Training', 'Awards', 'Promotions', 'Decorations',
    'Current Duty Positions', 'Past Duty Positions', 'Professional Development',
    'Local Activities', 'Transfer History', 'Cadet Achievements'
  ]);
}

// The specialty a track row names. The first row of the table is read with the section and column headings
// run into it ("SPECIALTY TRACKS SPECIALTY TRACK RATING DATE CADET PROGRAMS"), which matched no specialty, so
// the member's first rated specialty was dropped and never offered (LIVE12 E47). The row's name is the longest
// known specialty it ends with; a trailing "Officer", "Specialty" or "Track" is ignored.
const CAPUB_SPECIALTY_TRACK_NAMES_LONGEST_FIRST = Object.keys(CAPUB_SPECIALTY_TRACK_TO_BADGE).sort((a, b) => b.length - a.length);
function resolveSpecialtyTrackName(name){
  let n = normalizeSpecialtyTrackName(name);
  while(/\s(?:OFFICER|SPECIALTY|TRACKS?|RATING)$/.test(n)) n = n.replace(/\s(?:OFFICER|SPECIALTY|TRACKS?|RATING)$/, '');
  const known = CAPUB_SPECIALTY_TRACK_NAMES_LONGEST_FIRST.find(key => n === key || n.endsWith(' ' + key));
  return known || n;
}

function parseMemberReportSpecialtyTracks(text){
  const tracksSection = getMemberReportSpecialtyTracksSection(text);
  if(!tracksSection) return [];

  const rows = [];
  const rowRe = /([A-Z][A-Z\s\/,\.\-&]{1,90}?)\s+(TECHNICIAN|SENIOR|MASTER|NONE)(?:\s+RATING)?\s+(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})/gi;
  let m;
  while((m = rowRe.exec(tracksSection))){
    let name = normalizeSpecialtyTrackName(m[1])
      .replace(/\bSPECIALTY TRACK\b|\bLEVEL\b|\bCOMPLETED\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    name = resolveSpecialtyTrackName(name);
    const level = normalizeSpecialtyTrackLevel(m[2]);
    const completed = m[3];
    if(!name) continue;

    // This is the authoritative row, including explicit NONE values.
    rows.push({ name, level, completed, eligible: level !== 'NONE' });
  }
  return rows;
}


function badgeIdForSpecialtyTrack(row, family){
  if(!row || !row.eligible) return null;
  const level = normalizeSpecialtyTrackLevel(row.level);
  if(family === 'communications') return CAPUB_SPECIALTY_TRACK_TO_BADGE.COMMUNICATIONS?.[level] || null;
  if(family === 'emergencyServices') return CAPUB_SPECIALTY_TRACK_TO_BADGE['EMERGENCY SERVICES']?.[level] || null;

  const key = normalizeSpecialtyTrackName(row.name);
  return CAPUB_SPECIALTY_TRACK_TO_BADGE[key]?.[level] || null;
}

function getSpecialtyBadgesFromTracks(text){
  const rows = parseMemberReportSpecialtyTracks(text);
  const out = [];
  const notes = [];

  for(const row of rows){
    const key = normalizeSpecialtyTrackName(row.name);
    if(row.level === 'NONE'){
      notes.push(`${key} Specialty Track is NONE; no specialty badge imported.`);
      continue;
    }

    const badgeId = badgeIdForSpecialtyTrack(row);
    if(!badgeId){
      notes.push(`${key} ${row.level} appears in Specialty Tracks, but no badge mapping/image ID is configured for that specialty.`);
      continue;
    }

    out.push({
      id: badgeId,
      specialty: key,
      level: row.level,
      completed: row.completed
    });
  }

  return { badges: out, notes };
}


function isCommandInsigniaGradeEligible(rank){
  const r = String(rank || '').replace(/\s+/g, ' ').trim().toUpperCase();
  // CAPR 39-1 10.2.5: current/graduated commanders wear the Command Insignia Pin
  // only in the grade of lieutenant colonel and below. Colonels and above do not wear it.
  // Use an explicit allow-list so a missing, malformed, or not-yet-parsed rank
  // can never cause the pin to render during a personnel-report import.
  // ICL 25-06 (7.1.1.3.1.7) names officers and NCOs who are graduated commanders, so flight officers
  // and NCOs are included. The aviator shirt alone limits the pin to officers (4.2.5.1.3.3).
  return ['2D LT','SECOND LIEUTENANT','1ST LT','FIRST LIEUTENANT','CAPT','CAPTAIN','MAJ','MAJOR','LT COL','LIEUTENANT COLONEL',
    'FO','FLIGHT OFFICER','TFO','TECHNICAL FLIGHT OFFICER','SFO','SENIOR FLIGHT OFFICER',
    'SSGT','STAFF SERGEANT','TSGT','TECHNICAL SERGEANT','MSGT','MASTER SERGEANT','SMSGT','SENIOR MASTER SERGEANT','CMSGT','CHIEF MASTER SERGEANT'].includes(r);
}

function getCommandServiceRibbonValueForCommanderEchelon(echelon){
  switch(String(echelon || '').toUpperCase()){
    case 'NATIONAL': return 'national_two_gold_stars';
    case 'REGION': return 'region_gold_star';
    case 'WING': return 'wing_silver_star';
    case 'GROUP': return 'group_bronze_star';
    case 'UNIT':
    default: return 'earned';
  }
}

function showCommandInsigniaRankWarning(){
  alert(
    'Commander pin blocked for this rank.\n\n' +
    'CAPR 39-1 limits the Command Insignia Pin to current and graduated commanders in the grade of Lieutenant Colonel and below.\n\n' +
    'Only colonels who are specifically authorized under the current command-insignia rules and who have not served, and are not currently serving, on Command Council may be eligible. This builder will not render the commander pin for Col and above.'
  );
}

function canSelectCommandInsigniaForCurrentRank(showWarning=false){
  const ok = isCommandInsigniaGradeEligible(State.rank);
  if(!ok && showWarning) showCommandInsigniaRankWarning();
  return ok;
}

function getCommandServiceRibbonLabelForValue(value){
  const option = getRibbonSelectionOption(COMMAND_SERVICE_RIBBON_ID, value || 'earned');
  return option?.label || 'Command Service Ribbon';
}


function getCommandServiceRibbonFromDutyAssignments(text){
  const rows = extractCommandServiceCommanderAssignments(text)
    .filter(row => row.days >= 365);
  if(!rows.length) return null;

  const priority = { UNIT:1, GROUP:2, WING:3, REGION:4, NATIONAL:5 };
  rows.sort((a,b) => (priority[b.echelon] || 0) - (priority[a.echelon] || 0));
  const best = rows[0];
  const value = getCommandServiceRibbonValueForCommanderEchelon(best.echelon);
  return {
    id:COMMAND_SERVICE_RIBBON_ID,
    value,
    reason:`Commander duty of at least 365 days at the ${best.echelon.toLowerCase()} level`
  };
}

function getCommandInsigniaStatusForMember(text, result){
  const currentCommander = hasCurrentCommanderDutyPosition(text);
  const graduatedCommander = hasGraduatedCommanderDutyPosition(text);

  if(!currentCommander && !graduatedCommander) return null;

  if(!isCommandInsigniaGradeEligible(result?.rank)){
    if(Array.isArray(result?.notes)){
      const status = currentCommander ? 'Current Commander duty' : 'Past Commander duty';
      result.notes.push(`${status} found, but Command Insignia Pin was not imported because member is Colonel or above.`);
    }
    return null;
  }

  // Current command takes precedence over graduated/past command for pin placement.
  return currentCommander ? 'current' : 'graduated';
}



function hasCurrentFirstSergeantDutyPosition(text){
  const sections = [
    getReportSection(text, 'Cadet Duty Positions', 'Professional Development'),
    getReportSection(text, 'Current Duty Positions', 'Past Duty Positions'),
    getReportSection(text, 'Current Duty Positions', 'Professional Development')
  ];

  const current = sections
    .filter(Boolean)
    .join('\n')
    .replace(/\s+/g, ' ')
    .trim();

  if(!current) return false;

  // Exact current-duty match only. This intentionally does NOT match
  // "Cadet Flight Sergeant", "Safety NCO", or other cadet NCO duty titles.
  const firstSergeantTitleRe = /\b(?:Cadet\s+)?(?:First|1st)\s+(?:Sergeant|Sgt)\b/i;
  return firstSergeantTitleRe.test(current);
}

function parseCapMemberReport(textRaw){
  const text = normalizeMemberReportText(removeLocalActivitiesFromMemberReport(textRaw));
  const result = {
    membership:null,
    gender:null,
    rank:null,
    cadetFirstSergeant:false,
    ribbons:[],
    badges:[],
    authorizedBadges:[],
    patches:[],
    notes:[]
  };

  const memberName = extractMemberNameFromReport(text);
  if(memberName){
    result.firstName = memberName.firstName;
    result.lastName = memberName.lastName;
  }

  const currentProfile = getCurrentProfileFromMemberReport(text);
  if(currentProfile){
    result.membership = currentProfile.membership;
    result.gender = currentProfile.gender;
    result.rank = currentProfile.rank;
  }else{
    if(/\bSENIOR(?:\s+MEMBER)?\b/i.test(text)) result.membership = 'senior';
    else if(/\bCADET\b/i.test(text)) result.membership = 'cadet';
    if(/\bFEMALE\b/i.test(text)) result.gender = 'female';
    else if(/\bMALE\b/i.test(text)) result.gender = 'male';
    result.rank = getHighestImportedRank(text);
  }

  if(result.membership === 'cadet' && hasCurrentFirstSergeantDutyPosition(text)){
    result.cadetFirstSergeant = true;
    if(CADET_FIRST_SERGEANT_CLASSB_RANKS.has(result.rank)){
      result.notes.push('Current First Sergeant duty assignment found; Cadet First Sergeant diamond auto-selected for Class B.');
    }else{
      result.notes.push('Current First Sergeant duty assignment found, but Cadet First Sergeant diamond was not auto-selected because the imported cadet rank is not C/MSgt, C/SMSgt, or C/CMSgt.');
    }
  }

  // Cadet milestone ribbons must come only from the Cadet Achievements table.
  // A milestone name elsewhere in the report (for example, attendance at a
  // "Spaatz Award Presentation") is not evidence that the member earned it.
  const cadetAchievements = getReportSection(text, 'Cadet\\s+Achievements', 'Awards');
  const achievementNumMatches = [...cadetAchievements.matchAll(/Achievement\s+(\d+)/gi)].map(m => parseInt(m[1],10)).filter(Number.isFinite);
  const maxAchievement = achievementNumMatches.length ? Math.max(...achievementNumMatches) : 0;
  const achievementMap = [
    null,
    'curry_achievement',
    'hap_arnold_achievement',
    'mary_feik_achievement',
    'rickenbacker_achievement',
    'lindbergh_achievement',
    'doolittle_achievement',
    'goddard_achievement',
    'armstrong_achievement'
  ];
  for(let i=1; i<=Math.min(maxAchievement, 8); i++){
    if(!achievementMap[i]) continue;
    const honorCredit = hasAchievementHonorCreditFromReport(cadetAchievements, i);
    let value = honorCredit ? 'honor_credit' : 'earned';

    // Goddard uses the same one-star ribbon for either Honor Credit or Model
    // Rocketry, and the supplied two-star ribbon when both were earned.
    if(i === 7){
      const modelRocketry = /Model\s+Rocketry/i.test(text);
      const hasMitchell = /Billy\s+Mitchell|Mitchell\s+Award/i.test(text);
      const rocketryCredit = modelRocketry && hasMitchell;
      if(honorCredit && rocketryCredit) value = 'honor_credit_and_rocketry';
      else if(honorCredit) value = 'honor_credit';
      else if(rocketryCredit) value = 'rocketry_star';
    }

    result.ribbons.push({
      id:achievementMap[i],
      value,
      reason:`Achievement ${i}${honorCredit ? ' with Honor Credit' : ''}`
    });
  }
  if(/Wright\s+Brothers/i.test(cadetAchievements)) result.ribbons.push({ id:'wright_brothers_award', value:'earned', reason:'Wright Brothers' });
  if(/Billy\s+Mitchell/i.test(cadetAchievements)) result.ribbons.push({ id:'mitchell_award', value:'earned', reason:'Billy Mitchell' });
  if(/Amelia\s+Earhart/i.test(cadetAchievements)) result.ribbons.push({ id:'earhart_award', value:'earned', reason:'Amelia Earhart' });
  if(/\bEaker\b/i.test(cadetAchievements)) result.ribbons.push({ id:'eaker_award', value:'earned', reason:'Eaker' });
  if(/\bSpaatz\b/i.test(cadetAchievements)) result.ribbons.push({ id:'spaatz_award', value:'earned', reason:'Spaatz' });

  // Decorations / service ribbons.
  // Every listed line is one award: a row without a date still counts, so the dated and the bare counts are compared.
  const achievementAwardCount = Math.max(countOccurrences(text, /Achievement Award\s+\d{1,2}\s+[A-Z][a-z]{2}\s+\d{4}/gi),
                                         countOccurrences(text, /Achievement Award/gi));
  if(achievementAwardCount > 0){
    result.ribbons.push({
      id:'cap_achievment_award',
      value:chooseSpecialRibbonValueByAwardCount('cap_achievment_award', achievementAwardCount),
      reason:`${achievementAwardCount} Achievement Award record(s)`
    });
  }

  const commandersCommendation = extractCommandersCommendationFromReport(text);
  if(commandersCommendation){
    result.ribbons.push({
      id:'commander_commendation_award',
      value:commandersCommendation.value,
      reason:`${commandersCommendation.count} Commander's Commendation Award record(s), highest level ${commandersCommendation.level.replace('national_region', 'National and Region')}`
    });
  }

  // The eServices row reads "Certificate of Recognition for Lifesaving"; older records read "Lifesaving Award".
  const lifesavingCount = countOccurrences(text, /Certificate\s+of\s+Recognition\s+for\s+Life[\s-]?saving|\bLife[\s-]?saving\s+Award\b/gi);
  if(lifesavingCount > 0){
    result.ribbons.push({
      id:'lifesaving_award',
      value:chooseLifesavingValue(lifesavingCount),
      reason:`${lifesavingCount} Certificate of Recognition for Lifesaving record(s)`
    });
    result.notes.push(`Certificate of Recognition for Lifesaving imported as the Lifesaving Award ribbon (CAPR 39-3, 9h)${lifesavingCount > 1 ? ` with ${lifesavingCount - 1} subsequent-award clasp(s)` : ''}. The report does not say whether the save was a blood or organ transport, so the silver star for a save of another kind is not added; add it in the ribbon picker if it applies.`);
  }

  if(/Air Force Organizational Excellence Award/i.test(text)){
    result.ribbons.push({ id:'Air_Force_Organizational_Excellence_Award', value:'earned', reason:'Air Force Organizational Excellence Award' });
  }
  const exceptionalServiceCount = extractAwardCountFromAwardsTable(text, 'Exceptional\\s+Service\\s+Award') || countOccurrences(text, /Exceptional Service Award/gi);
  if(exceptionalServiceCount > 0){
    result.ribbons.push({ id:'exceptional_service_award', value:chooseSpecialRibbonValueByAwardCount('exceptional_service_award', exceptionalServiceCount), reason:`${exceptionalServiceCount} Exceptional Service Award record(s)` });
  }
  const meritoriousServiceCount = extractAwardCountFromAwardsTable(text, 'Meritorious\\s+Service\\s+(?:Award|Medal)') || countOccurrences(text, /Meritorious Service (?:Award|Medal)/gi);
  if(meritoriousServiceCount > 0){
    result.ribbons.push({ id:'meritorious_service_award', value:chooseSpecialRibbonValueByAwardCount('meritorious_service_award', meritoriousServiceCount), reason:`${meritoriousServiceCount} Meritorious Service Award record(s)` });
  }

  if(/\bMBRRBN\b|Membership Ribbon/i.test(text)){
    result.ribbons.push({ id:'cap_membership_ribbon', value:'earned', reason:'Membership Ribbon / MBRRBN' });
  }
  if(/\bYEAGER\b|Yeager/i.test(text)){
    result.ribbons.push({ id:'cap_bridgadier_general_charles_yaeger_ribbon', value:'earned', reason:'Yeager Award' });
  }
  if(/\bDAVIS\b|Level\s*2|LV2/i.test(text)){
    result.ribbons.push({ id:'cap_leadership_ribbon', value:'earned', reason:'Davis Award / Level II' });
  }
  if(/\bLOENING\b|Grover\s+Loening/i.test(text)){
    result.ribbons.push({ id:'cap_grover_loening_aerospace_ribbon', value:'earned', reason:'Loening Award / Level III' });
  }
  if(/\bGARBER\b|Paul\s+E\.?\s+Garber/i.test(text)){
    result.ribbons.push({ id:'cap_paul_e_garber_ribbon', value:'earned', reason:'Garber Award / Level IV' });
  }
  if(/\bWILSON\b|Gill\s+Robb\s+Wilson/i.test(text)){
    result.ribbons.push({ id:'cap_gill_robb_wilson_ribbon', value:'earned', reason:'Gill Robb Wilson Award / Level V' });
  }

  // Recruiter ribbons are membership-specific. Senior reports often retain a
  // prior cadet-history entry, so "Cadet Recruiter Ribbon" must never be
  // interpreted as the senior ribbon. The senior ribbon requires its exact
  // report label.
  if(result.membership === 'senior'){
    if(/\b(?:CAP\s+)?Senior\s+Recruiter\s+Ribbon\b/i.test(text)){
      result.ribbons.push({ id:'cap_senior_recruiter_ribbon', value:'earned', reason:'Senior Recruiter Ribbon' });
    }
    if(/\bCadet\s+Recruiter\s+Ribbon\b/i.test(text)){
      result.notes.push('Prior Cadet Recruiter Ribbon record ignored for this senior member; only the Senior Recruiter Ribbon is authorized.');
    }
  }else if(result.membership === 'cadet' && /\bCadet\s+Recruiter\s+Ribbon\b/i.test(text)){
    result.ribbons.push({ id:'cadet_recruiter_ribbon', value:'earned', reason:'Cadet Recruiter Ribbon' });
  }

  // In the CAP Member Search Report this appears as "Crisis Service Award";
  // in the builder it maps to the crisis_ribbon asset/id.
  if(/Crisis Service Award/i.test(text) || /\bCrisis Ribbon\b/i.test(text)){
    result.ribbons.push({ id:'crisis_ribbon', value:'earned', reason:'Crisis Service Award' });
  }

  const joinDate = extractJoinDateFromMemberReport(text);
  if(joinDate){
    const serviceYears = getFullYearsBetween(joinDate, new Date());
    const redServiceValue = chooseRedServiceValueFromYears(serviceYears);
    if(redServiceValue){
      result.ribbons.push({
        id:'red_service_ribbon',
        value:redServiceValue,
        reason:`${serviceYears} full years since join date`
      });
    }
  }

  const communityServiceCount = Math.max(1, countOccurrences(text, /Community Service Ribbon/gi));
  if(/Community Service Ribbon/i.test(text)){
    result.ribbons.push({
      id:'community_service_ribbon',
      value:chooseCommunityServiceValue(communityServiceCount),
      reason:`${communityServiceCount} Community Service Ribbon record(s)`
    });
  }

  const searchFindCount = Math.max(1, countOccurrences(text, /Search\s*[\u201c\u201d\"']?Find[\u201c\u201d\"']?\s+Ribbon/gi));
  if(/Search\s*[\u201c\u201d\"']?Find[\u201c\u201d\"']?\s+Ribbon/i.test(text)){
    result.ribbons.push({
      id:'search_find_ribbon',
      value:`find_${searchFindCount}`,
      reason:`${searchFindCount} Search Find Ribbon record(s)`
    });
  }


  const disasterRelief = extractDisasterReliefFromReport(text);
  if(disasterRelief){
    result.ribbons.push({
      id:'disaster_relief_ribbon',
      value:disasterRelief.value,
      reason:`${disasterRelief.count} Disaster Relief Ribbon record(s)${disasterRelief.hasV ? ' with the V (Presidentially declared disaster)' : ''}`
    });
  }

  // The CAC level comes from the CAC duty rows, never from "Wing" anywhere in the report (an "Illinois Wing
  // Encampment" row is not Wing CAC service). js/patches.js re-derives this ribbon from the duty rows with its
  // term rules and replaces this entry; the level here only has to be right on its own.
  const cacLevel = importedCacLevelFromDutyPositions(text);
  if(/Cadet Advisory Council Ribbon/i.test(text) || cacLevel){
    const cacValue = { national:'national_gold_star', region:'region_silver_star', wing:'wing_bronze_star' }[cacLevel] || 'group';
    result.ribbons.push({ id:'cadet_advisory_council_ribbon', value:cacValue, reason:`Cadet Advisory Council${cacLevel ? ` (${cacLevel} duty)` : ''}` });
  }

  const encampmentCount = extractEncampmentCountFromReport(text) || countOccurrences(text, /Encampment Ribbon/gi);
  if(encampmentCount > 0 || /Encampment Ribbon|Piney Creek Camp/i.test(text)){
    result.ribbons.push({
      id:'encampment_ribbon',
      value:chooseEncampmentValue(Math.max(1, encampmentCount)),
      reason:`${Math.max(1, encampmentCount)} encampment record(s)`
    });
  }

  const cadetSpecialActivityCount = extractCadetSpecialActivityCountFromReport(text);
  if(cadetSpecialActivityCount > 0){
    result.ribbons.push({
      id:'cadet_special_activity_ribbon',
      value:chooseCadetSpecialActivityValue(cadetSpecialActivityCount),
      reason:`${cadetSpecialActivityCount} cadet special activity record(s)`
    });
  }

  // Duty-position badge mapping. Look at both current and past duty positions.
  // Current commanders wear the current command pin. Past commanders only import as
  // graduated commanders if they served at least one year, and only Lt Col and below.
  const commandStatus = getCommandInsigniaStatusForMember(text, result);
  if(commandStatus){
    result.badges.push('squadron_commander_badge');
    if(State?.commandInsignia) State.commandInsignia.graduatedCommander = (commandStatus === 'graduated');
    result.notes.push(commandStatus === 'current'
      ? 'Current commander duty found; Command Insignia Pin imported as current commander.'
      : 'Past commander duty of at least one year found; Command Insignia Pin imported as graduated commander.');
  }

  const commandServiceRibbon = getCommandServiceRibbonFromDutyAssignments(text);
  if(commandServiceRibbon){
    result.ribbons.push(commandServiceRibbon);
    result.notes.push(`Command Service Ribbon imported as ${getCommandServiceRibbonLabelForValue(commandServiceRibbon.value)} based on commander duty assignments of at least 365 days.`);
  }

  // Specialty-track badges: the Specialty Tracks table is the ONLY authority.
  // Left column = specialty area, middle column = level, right column = completion date.
  // Level NONE = ineligible, even if the member holds a duty position or completed a rating exam.
  const importedSpecialtyTracks = getSpecialtyBadgesFromTracks(text);
  for(const item of importedSpecialtyTracks.badges){
    result.badges.push(item.id);
    // A rated specialty the builder does not authorize for this membership is named, not dropped silently.
    result.notes.push(isBadgeEligibleForMembership(item.id, result.membership)
      ? `${item.specialty} ${item.level} specialty badge imported from Specialty Tracks table only.`
      : `${item.specialty} ${item.level} is in the Specialty Tracks table, but the builder does not authorize that badge for ${result.membership || 'this'} members, so it is not offered.`);
  }
  result.notes.push(...importedSpecialtyTracks.notes);

  // Field-uniform patch auto-import:
  // Communications patch renders from the Communications specialty rating only.
  // It is intentionally not authorized on OCP and will be filtered by current uniform.
  if(importedSpecialtyTracks.badges.some(item => /^communications_/.test(item.id)) || memberReportHasCommunicationsTechnicianSpecialty(text)){
    result.patches.push('comms_patch');
    result.notes.push('Communications specialty rating detected; Communications patch queued for ABU, flight suit, or corporate field uniform only.');
  }

  if(/ICUT|Introductory Communications User Training|Rating Exam:\s*Communications|Mission Radio Operator|\bMRO\b/i.test(text) &&
     !importedSpecialtyTracks.badges.some(item => /^communications_/.test(item.id))){
    result.notes.push('Communications-related duty/training/exam found outside Specialty Tracks; Communications badge not imported unless the Specialty Tracks table shows TECHNICIAN, SENIOR, or MASTER.');
  }
  if(/Technician Rating Exam:\s*IT|Information Technology Technician/i.test(text) &&
     !importedSpecialtyTracks.badges.some(item => /^information_technology_/.test(item.id))){
    result.notes.push('IT-related training/exam found outside Specialty Tracks; IT badge not imported unless the Specialty Tracks table shows TECHNICIAN, SENIOR, or MASTER.');
  }
  if(/Technician Rating Exam:\s*Historian|Historian Technician/i.test(text) &&
     !importedSpecialtyTracks.badges.some(item => /^historian_/.test(item.id))){
    result.notes.push('Historian-related training/exam found outside Specialty Tracks; Historian badge not imported unless the Specialty Tracks table shows TECHNICIAN, SENIOR, or MASTER.');
  }

  // New rule: CDI status/duty/training alone does not authorize the CDI badge.
  // Only import a CDI badge if a future report explicitly lists a CDI badge/award item.
  if(/\bCDI\b|Character Development Instructor|Character Development Facilitator/i.test(text)){
    result.notes.push('CDI duty/status/training found; CDI badge not imported because the badge itself is not awarded in this report.');
  }

  // New rule: MRO and MSA are qualifications/roles; no MRO/MSA badge exists.
  if(/Mission Radio Operator|\bMRO\b|Mission Staff Assistant|\bMSA\b/i.test(text)){
    result.notes.push('MRO/MSA qualification or training found; no MRO/MSA badge exists, so no badge was imported.');
  }

  // UDF is a qualification only. There is no UDF badge to render.
  if(/Urban Direction Finding Team|\bUDF\b/i.test(text)){
    result.notes.push('UDF qualification or training found; no UDF badge exists, so no badge was imported.');
  }

  // Badge / qualification mapping.
  // Aviation family priority is resolved later as: Pilot > Observer > Aircrew.
  // Governance/service badges use exact report labels. Their selection order is
  // resolved separately so Command Council / SAG outrank National Staff, while
  // National Staff outranks every other specialty badge.
  if(/\bCommand\s+Council\s+Badge\b/i.test(text)) result.badges.push('command_council_badge');
  if(/\bSenior\s+Advisory\s+Group\s+Badge\b|\bSAG\s+Badge\b/i.test(text)) result.badges.push('senior_advisory_group_badge');
  const nationalStaffEligibility = window.CAPUBMemberReportRules?.evaluateNationalStaffEligibility(text);
  if(nationalStaffEligibility?.eligible){
    result.badges.push('national_staff_badge');
    if(nationalStaffEligibility.reason === 'CURRENT_APPOINTMENT'){
      result.notes.push('Current National Staff appointment found; National Staff Badge authorized.');
    }else if(nationalStaffEligibility.reason === 'PAST_APPOINTMENT_ONE_CALENDAR_YEAR'){
      result.notes.push('Past National Staff appointment of at least one full calendar year found; National Staff Badge retained.');
    }
  }else if(nationalStaffEligibility?.reason === 'PAST_APPOINTMENT_TOO_SHORT'){
    result.notes.push('Past National Staff appointment found, but it was shorter than one full calendar year; National Staff Badge not selected.');
  }
  if(/\bNational\s+Executive\s+Committee\s+Badge\b|\bNEC\s+Badge\b/i.test(text)) result.badges.push('national_executive_committee_badge');
  if(/\b(?:CAP\s+)?National\s+Command\s+Board\s+Badge\b/i.test(text)) result.badges.push('cap_national_command_board_badge');

  // CAPR 39-1 Attachment 7 calls the top pilot rating Command Pilot; older text says Master.
  if(/CAP\s+(?:Master|Command)\s+Pilot\s+Rating|(?:Master|Command)\s+Pilot\s+Badge/i.test(text)) result.badges.push('CAPMasterPilot1_621A0E2ED15DA');
  else if(/CAP\s+Senior\s+Pilot\s+Rating|Senior\s+Pilot\s+Badge/i.test(text)) result.badges.push('CAPSeniorPilot1_D9725AE959752');
  else if(/CAP\s+Pilot\s+Rating|Basic\s+Pilot\s+Badge|Pilot\s+Badge/i.test(text)) result.badges.push('CAPPilot1_FA9D33EA587D8');

  if(/CAP\s+Master\s+Aircrew\s+Rating|Master\s+Aircrew\s+Badge/i.test(text)) result.badges.push('MasterAirCrew1_72AC4CAE7A310');
  else if(/CAP\s+Senior\s+Aircrew\s+Rating|Senior\s+Aircrew\s+Badge/i.test(text)) result.badges.push('SeniorAirCrew1_B289BAE6E515C');
  else if(/CAP Aircrew Rating|Aircrew Badge/i.test(text)) result.badges.push('AirCrew1_DB3F0FCC3650F');

  if(/CAP\s+(?:Command|Master)\s+sUAS\s+Pilot\s+(?:Rating|Badge)|(?:Command|Master)\s+sUAS\s+Pilot\s+Badge/i.test(text)) result.badges.push('uas_pilot_master_badge');
  else if(/CAP\s+Senior\s+sUAS\s+Pilot\s+(?:Rating|Badge)|Senior\s+sUAS\s+Pilot\s+Badge/i.test(text)) result.badges.push('uas_pilot_senior_badge');
  else if(/CAP\s+sUAS\s+Pilot\s+(?:Rating|Badge)|sUAS\s+Pilot\s+Badge/i.test(text)) result.badges.push('uas_pilot_basic_badge');
  if(/CAP\s+Master\s+sUAS\s+Technician\s+(?:Rating|Badge)|Master\s+sUAS\s+Technician\s+Badge/i.test(text)) result.badges.push('uas_technician_master_badge');
  else if(/CAP\s+Senior\s+sUAS\s+Technician\s+(?:Rating|Badge)|Senior\s+sUAS\s+Technician\s+Badge/i.test(text)) result.badges.push('uas_technician_senior_badge');
  else if(/CAP\s+sUAS\s+Technician\s+(?:Rating|Badge)|sUAS\s+Technician\s+Badge/i.test(text)) result.badges.push('uas_technician_basic_badge');
  // Do not use MO/Mission Observer training qualification as badge authorization.
  // Only import Observer when the report explicitly shows an observer rating/badge.
  if(/CAP\s+Master\s+(?:Mission\s+)?Observer\s+(?:Rating|Badge)|Master\s+Observer\s+Badge/i.test(text)){
    result.badges.push('MasterObserver1_1B88D5071FD5C');
  }else if(/CAP\s+Senior\s+(?:Mission\s+)?Observer\s+(?:Rating|Badge)|Senior\s+Observer\s+Badge/i.test(text)){
    result.badges.push('SeniorObserver1_0E35802A29801');
  }else if(/CAP\s+(?:Mission\s+)?Observer\s+(?:Rating|Badge)|Observer\s+Badge/i.test(text)){
    result.badges.push('observer_badge');
  }
  if(/(?:Master Incident Commander Badge|Incident Commander 1 Badge|\bIC1\b)/i.test(text)) result.badges.push('incident_commander_1_badge');
  else if(/(?:Senior Incident Commander Badge|Incident Commander 2 Badge|\bIC2\b)/i.test(text)) result.badges.push('incident_commander_2_badge');
  else if(/(?:Basic Incident Commander Badge|Incident Commander 3 Badge|\bIC3\b)/i.test(text)) result.badges.push('basic_incident_commander_badge');
  if(/CAP Master Ground Team Badge/i.test(text) || hasNonTrainingQualification(text, '\\b(?:GTL|GTM1)\\b')) result.badges.push('master_ground_team_badge');
  else if(/CAP Senior Ground Team Badge/i.test(text) || hasNonTrainingQualification(text, '\\bGTM2\\b')) result.badges.push('senior_ground_team_badge');
  else if(/CAP Basic Ground Team Badge/i.test(text) || hasNonTrainingQualification(text, '\\bGTM3\\b')) result.badges.push('ground_team_basic_badge');
  else if(/\bGTM3\b|Ground Team Member Level 3/i.test(text)) result.notes.push('GTM3 found, but it appears to be training status or not an awarded badge; no Ground Team badge imported.');

  if(/CAP Master Emergency Services Qualification Badge/i.test(text)) result.badges.push('master_emergency_services_badge');
  else if(/CAP Senior Emergency Services Qualification Badge/i.test(text)) result.badges.push('senior_emergency_services_badge');
  else if(/CAP Basic Emergency Services Qualification Badge/i.test(text)) result.badges.push('emergency_services_badge');
  else if(/Technician Rating Exam:\s*Emergency Services/i.test(text)) {
    result.notes.push('Emergency Services rating exam found outside Specialty Tracks; ES specialty badge not imported from the exam alone.');
  }

  if(/Model Rocketry/i.test(text)) result.badges.push('model_rocketry_badge');

  // Preserve every report-authorized badge for the grouped badge picker before
  // reducing the automatically worn set to the highest four selections.
  result.authorizedBadges = [...new Set(result.badges)]
    .filter(id => isBadgeEligibleForMembership(id, result.membership));
  result.badges = selectHighestWearableImportedBadges(result.badges, result.membership);
  result.ribbons = applyCosStarToHighestCadetMilestone(result.ribbons, text);
  result.ribbons = keepOnlyHighestCadetMilestoneForSenior(result.ribbons, result.membership);
  result.ribbons = normalizeRecruiterRibbonsForMembership(result.ribbons, result.membership);
  result.ribbons = dedupeImportedRibbons(result.ribbons);

  return result;
}

function normalizeRecruiterRibbonsForMembership(ribbons, membership){
  return (ribbons || []).filter(ribbon => {
    if(ribbon?.id === 'cadet_recruiter_ribbon') return membership === 'cadet';
    if(ribbon?.id === 'cap_senior_recruiter_ribbon') return membership === 'senior';
    return true;
  });
}

function dedupeImportedRibbons(ribbons){
  const map = new Map();
  for(const r of ribbons){
    if(!r?.id) continue;
    // Later/high-level detections replace earlier basic detections for the same ribbon.
    map.set(r.id, r);
  }
  return [...map.values()];
}

function applyCapMemberReportImport(parsed){
  if(parsed.membership){
    State.membership = parsed.membership;
    if(membershipTypeEl) membershipTypeEl.value = parsed.membership;
    populateRankSetup();
  }

  if(parsed.rank && RANKS[State.membership || 'cadet']?.includes(parsed.rank)){
    State.rank = parsed.rank;
    if(rankSetupSelect) rankSetupSelect.value = parsed.rank;
  }

  if(parsed.gender){
    State.gender = parsed.gender;
    if(jacketSelect) jacketSelect.value = parsed.gender;
  }

  // The name, as the setup's name fields hold it (js/wiring.js State.text, inputs capubV2FirstName and
  // capubV2LastName, "Show my name on the uniform" capubV2ShowText): the nameplates, name tapes and the polo
  // read it from State.text. An import with a name shows it.
  if(parsed.firstName || parsed.lastName){
    State.text = { ...(State.text || {}), firstName:String(parsed.firstName || '').slice(0, 40), lastName:String(parsed.lastName || '').slice(0, 40), show:true };
    const firstNameEl = by('capubV2FirstName'), lastNameEl = by('capubV2LastName'), showNameEl = by('capubV2ShowText');
    if(firstNameEl) firstNameEl.value = State.text.firstName;
    if(lastNameEl) lastNameEl.value = State.text.lastName;
    if(showNameEl) showNameEl.checked = true;
  }

  State.cadetFirstSergeant = !!parsed.cadetFirstSergeant && isCadetFirstSergeantEligible(State.rank);
  syncCadetFirstSergeantControl();

  normalizeRibbonSelections();
  normalizeBadgeSelections();

  // Clear current imported-selectable items so the report can populate a clean rack.
  for(const id of Object.keys(State.ribbonSelections)){
    State.ribbonSelections[id].checked = false;
    State.ribbonSelections[id].awardValue = '';
    State.ribbonSelections[id].awardLabel = '';
    State.ribbonSelections[id].devices = {};
    State.ribbonSelections[id].imageOverride = null;
  }
  for(const id of Object.keys(State.badgeSelections)){
    State.badgeSelections[id].checked = false;
  }

  normalizePatchSelections();
  for(const id of Object.keys(State.patchSelections)){
    State.patchSelections[id].checked = false;
  }
  State.patches = [];

  for(const r of parsed.ribbons || []){
    if(State.membership === 'senior' && r.id === 'cadet_recruiter_ribbon') continue;
    if(State.membership === 'cadet' && r.id === 'cap_senior_recruiter_ribbon') continue;
    if(isRibbonEligibleForMembership(r.id, State.membership)){
      selectImportedRibbon(r.id, r.value || 'earned');
    }
  }

  State.badges = [];
  State.reportAuthorizedBadgeIds = [...new Set(parsed.authorizedBadges || parsed.badges || [])]
    .filter(id => isBadgeEligibleForMembership(id, State.membership));
  // Reset command-insignia state on every member-report import so a previous
  // member's current/graduated commander status cannot carry over.
  if(State.commandInsignia) State.commandInsignia.graduatedCommander = false;
  if(State.badgeSelections?.squadron_commander_badge) State.badgeSelections.squadron_commander_badge.checked = false;
  for(const id of parsed.badges || []){
    if(!isBadgeEligibleForMembership(id, State.membership)) continue;
    if(!State.badges.includes(id)) State.badges.push(id);
    if(State.badgeSelections[id]) State.badgeSelections[id].checked = true;
  }

  // Apply imported field-uniform patches. Unauthorized patches, especially
  // the Communications patch on OCPs, are kept out of State.patches.
  for(const id of parsed.patches || []){
    if(!PATCH_META[id]) continue;
    State.patchSelections[id] = State.patchSelections[id] || { checked:false };
    if(isPatchAuthorizedForUniform(id)){
      State.patchSelections[id].checked = true;
      if(!State.patches.includes(id)) State.patches.push(id);
    }else if(isCommsPatchId(id)){
      State.patchSelections[id].checked = false;
      parsed.notes = parsed.notes || [];
      parsed.notes.push('Communications patch not rendered because it is not authorized on the selected OCP uniform.');
    }
  }
  clearUnauthorizedPatchesForCurrentUniform();

  applyMemberTypeToUniformOptions();
  highlightActiveUniformButton();
  buildRibbonGallery();
  rebuildRibbonsFromGallery();
  buildBadgeGallery();
  rebuildBadgesFromGallery();
  updateSetupGates();
  refreshUI();
  fullRender();
}

function confirmBeforeMemberReportUpload(){
  return window.confirm(
    'This uniform builder may make mistakes when importing a membership report.\n\n' +
    'Results can be affected by record inconsistencies, missing award entries, duplicate entries, old legacy records, or items that do not appear clearly in the report.\n\n' +
    'Some ribbons, badges, devices, or other items may not import correctly or may not appear at all, including items such as Unit Citation ribbons.\n\n' +
    'Please double-check the generated uniform against the member\'s official records and CAPR 39-1 before relying on the result.\n\n' +
    'Do you want to continue?'
  );
}

function wireMemberReportImporter(){
  const btn = by('importMemberReportBtn');
  const input = by('memberReportUpload');
  const clearBtn = by('clearImportedReportBtn');
  if(!btn || !input){ console.warn('Member report importer controls not found.'); return; }

  if(btn.dataset.memberImportWired === '1') return;
  btn.dataset.memberImportWired = '1';
  btn.addEventListener('click', () => {
    if(confirmBeforeMemberReportUpload()) input.click();
  });

  clearBtn?.addEventListener('click', () => {
    State.reportAuthorizedBadgeIds = null;
    input.value = '';
    buildBadgeGallery();
    setMemberReportImportStatus('No report imported yet.');
  });

  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if(!file) return;

    try{
      setMemberReportImportStatus(`Reading ${file.name}...`);
      const text = await extractMemberReportText(file);
      const parsed = parseCapMemberReport(text);
      applyCapMemberReportImport(parsed);

      const lines = [
        `Imported ${file.name}.`,
        `Profile: ${parsed.membership || 'unknown'} • ${parsed.gender || 'unknown'} • ${parsed.rank || 'rank not found'}`,
        `Name: ${parsed.firstName || parsed.lastName ? `${parsed.firstName || ''} ${parsed.lastName || ''}`.trim() : 'not found'}`,
        `Ribbons selected: ${parsed.ribbons.length}`,
        parsed.ribbons.some(r => r.id === 'red_service_ribbon') ? `Red Service: ${parsed.ribbons.find(r => r.id === 'red_service_ribbon').reason}` : '',
        parsed.ribbons.some(r => r.id === 'crisis_ribbon') ? 'Crisis Service Award: selected' : '',
        `Badges selected: ${parsed.badges.length}${parsed.badges.length >= 4 ? ' (highest four wearable badges kept)' : ''}`,
        'Reminder: double-check imported results; Unit Citation ribbons and other record-dependent items may not appear correctly.',
        parsed.notes?.length ? `Notes: ${parsed.notes.join('; ')}` : ''
      ].filter(Boolean);

      setMemberReportImportStatus(lines, 'ok');
    }catch(err){
      console.error(err);
      setMemberReportImportStatus(`Import failed: ${err.message || err}`, 'error');
    }finally{
      input.value = '';
    }
  });
}
