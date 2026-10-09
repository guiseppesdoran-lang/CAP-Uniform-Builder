// Extracted verbatim from index.html: the dated CAPUB patches (commander duty import, CAC
// ribbon and shoulder cord logic, utility/field uniform patch, variant hotfixes, community
// service ribbon). Several of these deliberately re-wrap functions defined earlier, so the
// order inside this file and its position after js/bootstrap.js must not change.

/* ==========================================================
   CAPUB PATCH 2026-05-14 — STRICT COMMANDER DUTY IMPORT
   Purpose:
   - Prevent "Deputy Commander" from importing as Command Insignia.
   - Prevent generic uses of Commander, such as Commander's Commendation,
     Incident Commander, Cadet Commander, or Command Council, from importing
     the senior member Command Insignia Pin.
   - Reuse the same strict row parser for the Command Service Ribbon.
   ========================================================== */
const CAPUB_STRICT_COMMAND_DUTY_TITLES = new Set([
  'COMMANDER',
  'SQUADRON COMMANDER',
  'GROUP COMMANDER',
  'WING COMMANDER',
  'REGION COMMANDER',
  'NATIONAL COMMANDER'
]);

function capubNormalizeDutyTitle(title){
  return String(title || '')
    .replace(/[“”]/g, '"')
    .replace(/[’']/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function capubIsExactCommanderDutyTitle(title){
  return CAPUB_STRICT_COMMAND_DUTY_TITLES.has(capubNormalizeDutyTitle(title));
}

function capubHasDisqualifyingCommanderPrefix(source, index){
  const before = String(source || '').slice(Math.max(0, index - 45), index).replace(/\s+/g, ' ').trim();
  // Reject rows where the regex started at the word "Commander" inside a longer
  // non-authorizing title, especially "Deputy Commander CA-473 ...".
  return /(?:^|\s)(Deputy|Assistant|Asst\.?|Vice|Cadet|Incident|Mission|Deputy\s+Commander|Assistant\s+Deputy)\s*$/i.test(before);
}

function capubIsCommanderDutyTitleSegment(segment){
  const s = String(segment || '').replace(/\s+/g, ' ').trim();
  if(!/\bCommander\b/i.test(s)) return false;
  if(/\b(?:Deputy|Vice|Assistant|Asst\.?|Cadet|Incident|Mission)\s+Commander\b/i.test(s)) return false;
  if(/\bCommander(?:'s|s)?\s+Commendation\b/i.test(s)) return false;
  if(/\bCommand\s+Council\b/i.test(s)) return false;
  return capubIsExactCommanderDutyTitle(s);
}

function capubExtractCommanderDutyWindows(section){
  const source = String(section || '').replace(/\s+/g, ' ').trim();
  const rows = [];
  if(!source) return rows;

  const datePart = '(\\d{1,2}\\s+[A-Za-z]{3,9}\\s+\\d{4})';
  // Require a full CAP duty-position row. This prevents a loose match on the
  // word Commander when the actual duty title is Deputy Commander.
  const rowRe = new RegExp(
    '\\b((?:(?:Squadron|Group|Wing|Region|National)\\s+)?Commander)\\s+' +
    '([A-Z]{2,4}-[A-Z0-9-]+|[A-Z0-9-]+)\\s+' +
    '(UNIT|GROUP|WING|REGION|NATIONAL)\\s+' +
    '(Yes|No)\\s+' + datePart +
    '(?:\\s+' + datePart + ')?',
    'gi'
  );

  let m;
  while((m = rowRe.exec(source))){
    const title = m[1] || '';
    if(!capubIsExactCommanderDutyTitle(title)) continue;
    if(capubHasDisqualifyingCommanderPrefix(source, m.index)) continue;

    rows.push({
      title,
      unit: m[2] || '',
      echelon: String(m[3] || '').toUpperCase(),
      assistant: m[4] || '',
      start: parseCapReportDate(m[5]),
      end: parseCapReportDate(m[6]),
      raw: m[0]
    });
  }

  return rows;
}

function hasCurrentCommanderDutyPosition(text){
  const current = getReportSection(text, 'Current Duty Positions', 'Past Duty Positions');
  if(!current) return false;
  return capubExtractCommanderDutyWindows(current).some(row => capubIsExactCommanderDutyTitle(row.title));
}

function hasGraduatedCommanderDutyPosition(text){
  const past = getReportSectionUntilAny(text, 'Past Duty Positions', [
    'Current Committees', 'Transfer History', 'Level', 'Professional Development',
    'Specialty Tracks', 'Cadet Training', 'Encampments', 'Awards', 'Promotions'
  ]);
  if(!past) return false;

  return capubExtractCommanderDutyWindows(past).some(row => {
    if(!capubIsExactCommanderDutyTitle(row.title)) return false;
    if(!row.start || !row.end) return false;
    const days = (row.end - row.start) / (1000 * 60 * 60 * 24);
    return days >= 365;
  });
}

function extractCommandServiceCommanderAssignments(text){
  const sections = [
    {
      current:true,
      text:getReportSection(text, 'Current Duty Positions', 'Past Duty Positions')
    },
    {
      current:false,
      text:getReportSectionUntilAny(text, 'Past Duty Positions', [
        'Current Committees', 'Transfer History', 'Level', 'Professional Development',
        'Specialty Tracks', 'Cadet Training', 'Encampments', 'Awards', 'Promotions'
      ])
    }
  ];

  const rows = [];
  for(const section of sections){
    for(const row of capubExtractCommanderDutyWindows(section.text)){
      if(!row.start) continue;
      const end = row.end || (section.current ? new Date() : null);
      if(!end) continue;
      const days = Math.floor((end - row.start) / (1000 * 60 * 60 * 24));
      rows.push({
        echelon: row.echelon || 'UNIT',
        start: row.start,
        end,
        days,
        current:section.current,
        title:row.title,
        unit:row.unit
      });
    }
  }
  return rows;
}

/* ==========================================================
   CAPUB PATCH 2026-05-15 — CAC RIBBON + CURRENT SHOULDER CORD LOGIC
   User rule implemented:
   - CAC ribbon is earned from PAST duty assignments only, because the cadet
     must have served in the CAC position/term before wearing the ribbon.
   - Current CAC duty assignments render the shoulder cord only when the member is the primary representative.
   - If a cadet has completed a lower-level CAC term and is currently serving
     at a higher level, the lower-level ribbon remains until the higher term
     appears in Past Duty Positions.
   - Shoulder cord asset paths:
       images/cords/group
       images/cords/wing
       images/cords/region
       images/cords/national
     The renderer tries .png, .webp, .jpg, then the extensionless path.
   - Assistant/alternate CAC reps, recorders, members, chairs, and vice chairs do not auto-render the cord.
   ========================================================== */
State.shoulderCord = State.shoulderCord || null;

function syncShoulderCordControl(){
  const sel = by('shoulderCordSelect');
  if(!sel) return;
  sel.value = State.shoulderCord || '';
  const usable = State.membership === 'cadet' && ['blues_a','blues_b'].includes(State.uniform);
  sel.disabled = false;
  const panel = by('shoulderCordPanel');
  if(panel) panel.classList.toggle('disabledBlock', !usable);
}

function wireShoulderCordControl(){
  const sel = by('shoulderCordSelect');
  if(!sel || sel.dataset.wired === 'true') return;
  sel.dataset.wired = 'true';
  sel.addEventListener('change', () => {
    State.shoulderCord = sel.value || null;
    renderCACShoulderCord();
    if(typeof updateStatusPanel === 'function') updateStatusPanel();
  });
}

const CAC_LEVEL_PRIORITY = { group:1, wing:2, region:3, national:4 };
const CAC_RIBBON_VALUE_BY_LEVEL = {
  group: 'group',
  wing: 'wing_bronze_star',
  region: 'region_silver_star',
  national: 'national_gold_star'
};
const CAC_CORD_LABEL_BY_LEVEL = {
  group: 'Group CAC shoulder cord - green',
  wing: 'Wing CAC shoulder cord - red',
  region: 'Region CAC shoulder cord - blue',
  national: 'National CAC shoulder cord - gold'
};
const SHOULDER_CORD_META = {
  group:       { label:'Group CAC shoulder cord - green',    srcBase:'cords/group',       imported:true  },
  wing:        { label:'Wing CAC shoulder cord - red',       srcBase:'cords/wing',        imported:true  },
  region:      { label:'Region CAC shoulder cord - blue',    srcBase:'cords/region',      imported:true  },
  national:    { label:'National CAC shoulder cord - gold',  srcBase:'cords/national',    imported:true  },
  color_guard: { label:'Color Guard shoulder cord',          srcBase:'cords/color_guard', imported:false },
  honor_guard: { label:'Honor Guard shoulder cord',          srcBase:'cords/honor_guard', imported:false }
};
const SHOULDER_CORD_IDS = Object.keys(SHOULDER_CORD_META);

function capubNormalizeCACSource(text){
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function capubLooksLikeCACDutySegment(segment){
  const s = capubNormalizeCACSource(segment);
  if(!s) return false;
  if(/Cadet\s+Advisory\s+Council/i.test(s)) return true;
  if(/\b[GNWR]CAC\b|\bNCAC\b/i.test(s)) return true;
  if(/\bCAC\b/i.test(s) && /\b(?:Representative|Rep|Primary|Assistant|Alternate|Chair|Vice\s+Chair|Recorder|Member)\b/i.test(s)) return true;
  return false;
}



function capubCACLevelFromText(segment, rowEchelon=''){
  const s = capubNormalizeCACSource(segment);
  const echelon = String(rowEchelon || '').toUpperCase();

  if(/\bNCAC\b|National\s+Cadet\s+Advisory\s+Council|National\s+CAC/i.test(s) || echelon === 'NATIONAL') return 'national';
  if(/\bRCAC\b|Region\s+Cadet\s+Advisory\s+Council|Region\s+CAC/i.test(s) || echelon === 'REGION') return 'region';
  if(/\bWCAC\b|Wing\s+Cadet\s+Advisory\s+Council|Wing\s+CAC/i.test(s) || echelon === 'WING') return 'wing';
  if(/\bGCAC\b|Group\s+Cadet\s+Advisory\s+Council|Group\s+CAC/i.test(s) || echelon === 'GROUP') return 'group';

  // Squadron-level representatives normally serve on group CAC when a group CAC exists;
  // without clearer text, treat generic past CAC duty as group/basic ribbon.
  if(echelon === 'UNIT') return 'group';
  return null;
}

function capubExtractCACDutyAssignmentsFromSection(section, isCurrent=false){
  const source = capubNormalizeCACSource(section);
  const rows = [];
  if(!source) return rows;

  // First pass: full duty-position rows, for reports that include title, unit, echelon, assistant flag, and dates.
  const datePart = '(\\d{1,2}\\s+[A-Za-z]{3,9}\\s+\\d{4})';
  const rowRe = new RegExp(
    '((?:Cadet\\s+)?(?:National\\s+|Region\\s+|Wing\\s+|Group\\s+)?(?:Cadet\\s+Advisory\\s+Council|[GNWR]CAC|NCAC|CAC)(?:\\s+(?:Primary\\s+)?(?:Representative|Rep|Assistant|Alternate|Chair|Vice\\s+Chair|Recorder|Member))?|(?:Cadet\\s+)?(?:[GNWR]CAC|NCAC|CAC)\\s+(?:Representative|Rep|Assistant|Alternate|Chair|Vice\\s+Chair|Recorder|Member))\\s+' +
    '([A-Z]{2,4}-[A-Z0-9-]+|[A-Z0-9-]+)?\\s*' +
    '(UNIT|GROUP|WING|REGION|NATIONAL)?\\s*' +
    '(?:Yes|No)?\\s*' + datePart +
    '(?:\\s+' + datePart + ')?',
    'gi'
  );

  let m;
  while((m = rowRe.exec(source))){
    const title = m[1] || '';
    const echelon = m[3] || '';
    const raw = m[0] || title;
    if(!capubLooksLikeCACDutySegment(raw)) continue;
    const level = capubCACLevelFromText(raw, echelon);
    if(!level) continue;
    rows.push({
      level,
      current:isCurrent,
      primaryRep: capubIsPrimaryCACRepresentativeSegment(raw),
      title,
      unit:m[2] || '',
      echelon:String(echelon || '').toUpperCase(),
      start: parseCapReportDate(m[4]),
      end: parseCapReportDate(m[5]) || (isCurrent ? new Date() : null),
      raw
    });
  }

  // Second pass: tolerate simple/legacy duty lines that contain CAC text but do not match the full row regex.
  // We search in small windows around each CAC token and infer level from the token/echelon words.
  const tokenRe = /\b(?:NCAC|RCAC|WCAC|GCAC|CAC|Cadet\s+Advisory\s+Council)\b/gi;
  while((m = tokenRe.exec(source))){
    const ctx = source.slice(Math.max(0, m.index - 90), Math.min(source.length, m.index + 180));
    if(!capubLooksLikeCACDutySegment(ctx)) continue;
    const echelonMatch = ctx.match(/\b(UNIT|GROUP|WING|REGION|NATIONAL)\b/i);
    const level = capubCACLevelFromText(ctx, echelonMatch ? echelonMatch[1] : '');
    if(!level) continue;
    const duplicate = rows.some(r => r.level === level && ctx.includes(r.title));
    if(!duplicate){
      rows.push({ level, current:isCurrent, primaryRep: capubIsPrimaryCACRepresentativeSegment(ctx), title:'CAC duty assignment', unit:'', echelon:echelonMatch ? echelonMatch[1].toUpperCase() : '', start:null, end:isCurrent ? new Date() : null, raw:ctx });
    }
  }

  return rows;
}

function capubGetCurrentCACDutyAssignments(text){
  const sections = [
    getReportSection(text, 'Cadet Duty Positions', 'Professional Development'),
    getReportSection(text, 'Current Duty Positions', 'Past Duty Positions'),
    getReportSection(text, 'Current Duty Positions', 'Professional Development')
  ].filter(Boolean);

  const rows = [];
  for(const section of sections){
    rows.push(...capubExtractCACDutyAssignmentsFromSection(section, true));
  }

  // Dedupe by level/raw so Cadet Duty Positions + Current Duty Positions do not double count.
  const seen = new Set();
  return rows.filter(row => {
    const key = `${row.level}|${row.raw}`;
    if(seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function capubGetPastCACDutyAssignments(text){
  const past = getReportSectionUntilAny(text, 'Past Duty Positions', [
    'Current Committees', 'Transfer History', 'Level', 'Professional Development',
    'Specialty Tracks', 'Cadet Training', 'Encampments', 'Awards', 'Promotions'
  ]);
  return capubExtractCACDutyAssignmentsFromSection(past, false);
}

function capubChooseHighestCACLevel(rows){
  if(!Array.isArray(rows) || !rows.length) return null;
  const valid = rows.filter(r => r && r.level && CAC_LEVEL_PRIORITY[r.level]);
  if(!valid.length) return null;
  valid.sort((a,b) => CAC_LEVEL_PRIORITY[b.level] - CAC_LEVEL_PRIORITY[a.level]);
  return valid[0].level;
}

// Treat a completed CAC term as a complete annual term.
// This prevents short/partial past-duty entries, such as a May-to-September partial
// WCAC assignment, from importing the CAC ribbon before a full term is complete. Adjust here if your wing defines
// CAC terms differently.
const CAC_MIN_COMPLETED_TERM_DAYS = 365;

function capubDaysBetweenDates(start, end){
  if(!(start instanceof Date) || isNaN(start)) return 0;
  if(!(end instanceof Date) || isNaN(end)) return 0;
  return Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
}

function capubIsCompletedCACRibbonTerm(row){
  if(!row || row.current) return false;
  if(!row.start || !row.end) return false;
  return capubDaysBetweenDates(row.start, row.end) >= CAC_MIN_COMPLETED_TERM_DAYS;
}



function capubShoulderCordAssetCandidates(cordId){
  const meta = SHOULDER_CORD_META[cordId] || null;
  const base = meta?.srcBase || `cords/${cordId}`;
  return [`${base}.png`, `${base}.webp`, `${base}.jpg`, `${base}.jpeg`, base];
}

// Backward-compatible helper name used by older CAC-specific code.
function capubCACCordAssetCandidates(level){
  return capubShoulderCordAssetCandidates(level);
}

function capubSetImageWithFallback(img, candidates){
  const list = (candidates || []).filter(Boolean);
  let idx = 0;
  function tryNext(){
    if(idx >= list.length){ img.remove(); return; }
    img.src = ASSET(list[idx++]);
  }
  img.onerror = tryNext;
  tryNext();
}

function getShoulderCordCalibrationKey(cordId){
  return `shoulderCord:${cordId}`;
}

function getShoulderCordDefaultPlacement(
  uniform = State.uniform,
  gender = State.gender,
  cordId = State.shoulderCord
){
  const bucket = `${uniform}_${gender || 'male'}`;
  const cordDefaults = SHOULDER_CORD_DEFAULTS[bucket] || {};
  return {
    ...(cordDefaults[cordId] || { x:96, y:86, w:52, h:160, r:0 })
  };
}

function renderCACShoulderCord(){
  wireShoulderCordControl();
  syncShoulderCordControl();
  [...uniformCanvas.querySelectorAll('.layer.cacShoulderCord,.layer.shoulderCord')].forEach(n => n.remove());

  const cordId = State.shoulderCord;
  const cordMeta = SHOULDER_CORD_META[cordId] || null;
  if(!cordId || !cordMeta) return;
  if(!['blues_a','blues_b'].includes(State.uniform)) return;
  if(State.membership !== 'cadet') return;

  const img = document.createElement('img');
  img.className = 'layer shoulderCord cacShoulderCord';
  img.dataset.calibKey = getShoulderCordCalibrationKey(cordId);
  img.alt = cordMeta.label || `${cordId} shoulder cord`;
  img.style.display = 'block';

  // Each cord ID has its own key inside each uniform/gender calibration bucket:
  //   blues_a_male.shoulderCord:group
  //   blues_a_female.shoulderCord:color_guard
  //   blues_b_male.shoulderCord:honor_guard
  //   blues_b_female.shoulderCord:wing
  // Use the calibrator to fine tune each one independently.
  const base = getShoulderCordDefaultPlacement(State.uniform, State.gender, cordId);
  applyCalibToElement(img, img.dataset.calibKey, base);

  img.dataset.tooltipTitle = cordMeta.label || `${cordId.toUpperCase()} shoulder cord`;
  img.dataset.tooltipReg = cordMeta.imported ? 'CAPR 60-1 CAC shoulder cord' : 'Manual shoulder cord selection';
  img.dataset.tooltipWhy = cordMeta.imported
    ? 'Rendered only from a current CAC primary representative duty assignment. The CAC ribbon is imported only from past CAC duty assignments.'
    : 'Manual cord selection. Coordinates are stored separately for each cadet Class A/Class B male/female uniform bucket.';

  capubSetImageWithFallback(img, capubShoulderCordAssetCandidates(cordId));
  uniformCanvas.appendChild(img);
}

// Wrap member report parsing so old broad CAC text matching cannot auto-award the CAC ribbon.
// It is replaced by a stricter Past Duty Positions based rule.
const capubOriginalParseCapMemberReport_CACPatch = parseCapMemberReport;
parseCapMemberReport = function capubParseCapMemberReportCACPatch(textRaw){
  const normalized = normalizeMemberReportText(textRaw);
  const result = capubOriginalParseCapMemberReport_CACPatch(textRaw);

  // Remove earlier broad CAC ribbon detections, then re-add only if Past Duty Positions supports it.
  result.ribbons = (result.ribbons || []).filter(r => r?.id !== 'cadet_advisory_council_ribbon');

  const cacRibbon = capubGetCACRibbonFromPastDutyAssignments(normalized);
  const currentCord = capubGetCACShoulderCordFromCurrentDutyAssignments(normalized);

  if(cacRibbon){
    result.ribbons.push(cacRibbon);
    result.notes.push(`CAC ribbon imported from Past Duty Positions as ${cacRibbon.value}.`);
  }else if(/Cadet\s+Advisory\s+Council|\bCAC\b|\b[GNWR]CAC\b|\bNCAC\b/i.test(normalized)){
    result.notes.push(`CAC text found, but CAC ribbon was not imported because no completed CAC term of at least ${CAC_MIN_COMPLETED_TERM_DAYS} days was found in Past Duty Positions. Current CAC primary representative duty only controls the shoulder cord.`);
  }

  result.shoulderCord = currentCord;
  if(currentCord){
    result.notes.push(`${CAC_CORD_LABEL_BY_LEVEL[currentCord]} imported from Current Duty Positions as a current primary representative.`);
  }

  return result;
};

// Wrap import application so parsed.current CAC duty renders the cord and stale cords clear on new imports.
const capubOriginalApplyCapMemberReportImport_CACPatch = applyCapMemberReportImport;
applyCapMemberReportImport = function capubApplyCapMemberReportImportCACPatch(parsed){
  State.shoulderCord = parsed?.shoulderCord || null;
  capubOriginalApplyCapMemberReportImport_CACPatch(parsed);
  State.shoulderCord = parsed?.shoulderCord || null;
  syncShoulderCordControl();
  renderCACShoulderCord();
};

// Keep the visible shoulder-cord selector synced when membership, rank, gender, or uniform changes.
if(typeof refreshUI === 'function'){
  const capubOriginalRefreshUI_CACPatch = refreshUI;
  refreshUI = function capubRefreshUICACPatch(){
    const out = capubOriginalRefreshUI_CACPatch.apply(this, arguments);
    syncShoulderCordControl();
    return out;
  };
}

// Render shoulder cord after every full render. This is intentionally after badges/ribbons so the cord
// can be calibrated and layered independently from the base jacket.
const capubOriginalFullRender_CACPatch = fullRender;
fullRender = function capubFullRenderCACPatch(){
  const out = capubOriginalFullRender_CACPatch.apply(this, arguments);
  renderCACShoulderCord();
  return out;
};

// Add the CAC cord images to the downloadable asset-needed list when that helper is available.
if(window.CAPUB_V2 && typeof window.CAPUB_V2.buildExpectedAssetList === 'function'){
  const capubOriginalExpectedAssets_CACPatch = window.CAPUB_V2.buildExpectedAssetList;
  window.CAPUB_V2.buildExpectedAssetList = function capubExpectedAssetsCACPatch(){
    const expected = capubOriginalExpectedAssets_CACPatch();
    ['group','wing','region','national'].forEach(level => {
      expected.push({
        category:'CAC shoulder cord',
        item:CAC_CORD_LABEL_BY_LEVEL[level],
        id:`cac_cord_${level}`,
        path:`images/cords/${level}.png`,
        status:'required when current CAC duty imports shoulder cord'
      });
    });
    return expected;
  };
}

// Refresh once after installing the patch so a saved/current state can show its cord.
try{ wireShoulderCordControl(); syncShoulderCordControl(); fullRender(); }catch(err){ console.warn('CAC shoulder cord patch refresh failed', err); }


/* ==========================================================
   CAPUB PATCH 2026-05-16 — CAC LEVEL IMPORT CORRECTION
   Purpose:
   - Current CAC Chair, Vice Chair, and Representative/Primary Rep duty
     assignments now import the matching CAC shoulder cord.
   - CAC ribbon level now imports from the highest qualifying CAC service found
     in Current or Past Duty Positions, so current RCAC Chair imports Region
     CAC ribbon/cord and current WCAC Vice Chair imports Wing CAC ribbon/cord.
   - Assistant, Alternate, Recorder, and Member are still not treated as cord/ribbon
     level-authorizing roles unless you manually select the item.
   ========================================================== */

function capubIsEligibleCACLevelDutySegment(segment){
  const s = capubNormalizeCACSource(segment);
  if(!s) return false;

  // Explicitly excluded helper/non-voting or staff roles.
  if(/\b(?:Assistant|Alternate)\s+(?:Representative|Rep)\b/i.test(s)) return false;
  if(/\b(?:Assistant|Alternate|Recorder|Member)\b/i.test(s)) return false;

  // Eligible CAC duty roles for auto-importing level items.
  if(/\bPrimary\s+(?:Representative|Rep)\b/i.test(s)) return true;
  if(/\b(?:Representative|Rep|Chair|Vice\s+Chair)\b/i.test(s)) return true;
  return false;
}

// Preserve the old helper name used elsewhere, but update its meaning to include
// current CAC Chair/Vice Chair as level-authorizing CAC leadership positions.
function capubIsPrimaryCACRepresentativeSegment(segment){
  return capubIsEligibleCACLevelDutySegment(segment);
}

function capubGetQualifyingCACRibbonRows(text){
  const currentRows = capubGetCurrentCACDutyAssignments(text)
    .filter(row => row && capubIsEligibleCACLevelDutySegment(row.raw || row.title || ''))
    .map(row => ({ ...row, source:'current CAC duty' }));

  const pastRows = capubGetPastCACDutyAssignments(text)
    .filter(row => row && capubIsEligibleCACLevelDutySegment(row.raw || row.title || ''))
    .filter(capubIsCompletedCACRibbonTerm)
    .map(row => ({ ...row, source:'completed past CAC duty' }));

  return [...currentRows, ...pastRows];
}

function capubGetCACRibbonFromDutyAssignments(text){
  const rows = capubGetQualifyingCACRibbonRows(text);
  const level = capubChooseHighestCACLevel(rows);
  if(!level) return null;

  const chosen = rows
    .filter(r => r.level === level)
    .sort((a,b) => {
      // Prefer current duty when current and past are at the same level.
      if(a.current !== b.current) return a.current ? -1 : 1;
      return 0;
    })[0];

  const days = chosen && chosen.start && chosen.end ? capubDaysBetweenDates(chosen.start, chosen.end) : 0;
  const reason = chosen?.current
    ? `Current ${level.toUpperCase()} CAC qualifying duty: ${chosen.title || 'CAC duty assignment'}`
    : `Completed past ${level.toUpperCase()} CAC term (${days} days)`;

  return {
    id:'cadet_advisory_council_ribbon',
    value:CAC_RIBBON_VALUE_BY_LEVEL[level],
    reason
  };
}

// Keep the old function name because the installed parser wrapper calls it.
function capubGetCACRibbonFromPastDutyAssignments(text){
  return capubGetCACRibbonFromDutyAssignments(text);
}

function capubGetCACShoulderCordFromCurrentDutyAssignments(text){
  const rows = capubGetCurrentCACDutyAssignments(text)
    .filter(row => row && capubIsEligibleCACLevelDutySegment(row.raw || row.title || ''));
  return capubChooseHighestCACLevel(rows) || null;
}

// Final parser wrapper so the import notes match the corrected logic instead of
// the older “past duty only” wording.
const capubOriginalParseCapMemberReport_CACLevelCorrection = parseCapMemberReport;
parseCapMemberReport = function capubParseCapMemberReportCACLevelCorrection(textRaw){
  const normalized = normalizeMemberReportText(textRaw);
  const result = capubOriginalParseCapMemberReport_CACLevelCorrection(textRaw);

  result.ribbons = (result.ribbons || []).filter(r => r?.id !== 'cadet_advisory_council_ribbon');

  const cacRibbon = capubGetCACRibbonFromDutyAssignments(normalized);
  const currentCord = capubGetCACShoulderCordFromCurrentDutyAssignments(normalized);

  if(cacRibbon){
    result.ribbons.push(cacRibbon);
    result.notes.push(`CAC ribbon imported as ${cacRibbon.value}: ${cacRibbon.reason}.`);
  }else if(/Cadet\s+Advisory\s+Council|\bCAC\b|\b[GNWR]CAC\b|\bNCAC\b/i.test(normalized)){
    result.notes.push('CAC text found, but no qualifying CAC Chair, Vice Chair, Representative, or Primary Rep duty assignment was found for automatic CAC ribbon level import.');
  }

  result.shoulderCord = currentCord;
  if(currentCord){
    result.notes.push(`${CAC_CORD_LABEL_BY_LEVEL[currentCord]} imported from Current Duty Positions.`);
  }

  return result;
};

try{ wireShoulderCordControl(); syncShoulderCordControl(); fullRender(); }catch(err){ console.warn('CAC level correction refresh failed', err); }

/* ==========================================================
   CAPUB PATCH 2026-05-16B — CAC REGION OVERRIDE FINAL FIX
   Problem fixed:
   - Some PDF text extraction orders past WCAC rows close to the current RCAC row,
     causing the importer to keep the Wing CAC cord/ribbon even when a current
     Region CAC qualifying duty exists.
   Fix:
   - Scan the actual Current Duty Positions/Cadet Duty Positions section for
     explicit eligible CAC role titles by level and choose the highest level.
   - Current RCAC/Region CAC Chair, Vice Chair, Representative, or Primary Rep
     overrides lower Wing/Group CAC findings for both the cord and the CAC ribbon.
   ========================================================== */

function capubCACWindowLooksEligibleFinal(windowText){
  const s = capubNormalizeCACSource(windowText);
  if(!s) return false;
  if(/\b(?:Assistant|Alternate|Recorder|Member)\b/i.test(s)) return false;
  return /\b(?:Primary\s+(?:Representative|Rep)|Representative|Rep|Chair|Vice\s+Chair)\b/i.test(s);
}

function capubFindExplicitEligibleCACLevelsInSectionFinal(section){
  const s = capubNormalizeCACSource(section);
  const found = [];
  if(!s) return found;
  const levelPatterns = [
    { level:'national', re:/\b(?:NCAC|National\s+(?:Cadet\s+Advisory\s+Council|CAC))\b/ig },
    { level:'region',   re:/\b(?:RCAC|Region\s+(?:Cadet\s+Advisory\s+Council|CAC))\b/ig },
    { level:'wing',     re:/\b(?:WCAC|Wing\s+(?:Cadet\s+Advisory\s+Council|CAC))\b/ig },
    { level:'group',    re:/\b(?:GCAC|Group\s+(?:Cadet\s+Advisory\s+Council|CAC))\b/ig }
  ];
  for(const spec of levelPatterns){
    let m;
    while((m = spec.re.exec(s))){
      const ctx = s.slice(Math.max(0, m.index - 45), Math.min(s.length, m.index + 95));
      if(capubCACWindowLooksEligibleFinal(ctx)) found.push({ level:spec.level, raw:ctx });
    }
  }
  const genericRe = /\bCAC\b/ig;
  let gm;
  while((gm = genericRe.exec(s))){
    const ctx = s.slice(Math.max(0, gm.index - 45), Math.min(s.length, gm.index + 130));
    if(!capubCACWindowLooksEligibleFinal(ctx)) continue;
    const level = capubCACLevelFromText(ctx, (ctx.match(/\b(NATIONAL|REGION|WING|GROUP|UNIT)\b/i)||[])[1] || '');
    if(level) found.push({ level, raw:ctx });
  }
  return found;
}

function capubGetCurrentCACSectionFinal(text){
  return [
    getReportSection(text, 'Cadet Duty Positions', 'Cadet Past Duty Positions'),
    getReportSection(text, 'Cadet Duty Positions', 'Professional Development'),
    getReportSection(text, 'Current Duty Positions', 'Past Duty Positions'),
    getReportSection(text, 'Current Duty Positions', 'Professional Development')
  ].filter(Boolean).join(' ');
}

function capubGetBestExplicitCurrentCACLevelFinal(text){
  const section = capubGetCurrentCACSectionFinal(text);
  const levels = capubFindExplicitEligibleCACLevelsInSectionFinal(section);
  return capubChooseHighestCACLevel(levels) || null;
}

function capubGetBestExplicitAnyCACLevelFinal(text){
  const sections = [
    capubGetCurrentCACSectionFinal(text),
    getReportSectionUntilAny(text, 'Cadet Past Duty Positions', ['Transfer History','Professional Development','Specialty Tracks','Cadet Training','Encampments','Promotions','Decorations','Ribbons']),
    getReportSectionUntilAny(text, 'Past Duty Positions', ['Transfer History','Professional Development','Specialty Tracks','Cadet Training','Encampments','Promotions','Decorations','Ribbons'])
  ].filter(Boolean).join(' ');
  const levels = capubFindExplicitEligibleCACLevelsInSectionFinal(sections);
  return capubChooseHighestCACLevel(levels) || null;
}

const capubPreviousGetCACShoulderCordFromCurrentDutyAssignments_FinalFix = capubGetCACShoulderCordFromCurrentDutyAssignments;
capubGetCACShoulderCordFromCurrentDutyAssignments = function capubGetCACShoulderCordFinalFixed(text){
  const explicitCurrent = capubGetBestExplicitCurrentCACLevelFinal(text);
  if(explicitCurrent) return explicitCurrent;
  return capubPreviousGetCACShoulderCordFromCurrentDutyAssignments_FinalFix(text);
};

const capubPreviousGetCACRibbonFromDutyAssignments_FinalFix = capubGetCACRibbonFromDutyAssignments;
capubGetCACRibbonFromDutyAssignments = function capubGetCACRibbonFinalFixed(text){
  const explicitAny = capubGetBestExplicitAnyCACLevelFinal(text);
  const old = capubPreviousGetCACRibbonFromDutyAssignments_FinalFix(text);
  const oldLevel = old ? Object.entries(CAC_RIBBON_VALUE_BY_LEVEL).find(([,v]) => v === old.value)?.[0] : null;
  const winningLevel = capubChooseHighestCACLevel([
    explicitAny ? { level:explicitAny } : null,
    oldLevel ? { level:oldLevel } : null
  ].filter(Boolean));
  if(!winningLevel) return old || null;
  return { id:'cadet_advisory_council_ribbon', value:CAC_RIBBON_VALUE_BY_LEVEL[winningLevel], reason:`Highest qualifying CAC level found in duty assignments: ${winningLevel.toUpperCase()}` };
};

const capubPreviousParseCapMemberReport_CACFinalFix = parseCapMemberReport;
parseCapMemberReport = function capubParseCapMemberReportCACFinalFix(textRaw){
  const normalized = normalizeMemberReportText(textRaw);
  const result = capubPreviousParseCapMemberReport_CACFinalFix(textRaw);
  result.ribbons = (result.ribbons || []).filter(r => r?.id !== 'cadet_advisory_council_ribbon');
  const finalCord = capubGetCACShoulderCordFromCurrentDutyAssignments(normalized);
  const finalRibbon = capubGetCACRibbonFromDutyAssignments(normalized);
  result.shoulderCord = finalCord || null;
  if(finalRibbon) result.ribbons.push(finalRibbon);
  if(finalCord) result.notes.push(`CAC final check: ${CAC_CORD_LABEL_BY_LEVEL[finalCord]} selected from current CAC duty.`);
  if(finalRibbon) result.notes.push(`CAC final check: CAC ribbon set to ${finalRibbon.value}.`);
  result.ribbons = dedupeImportedRibbons(result.ribbons);
  return result;
};

try{ wireShoulderCordControl(); syncShoulderCordControl(); fullRender(); }catch(err){ console.warn('CAC final region override refresh failed', err); }


/* ==========================================================
   CAPUB PATCH 2026-05-19 — UTILITY BADGES, OCP PATCH FILTER,
   UNIT PATCH IMPORT, NCSA PATCH IMPORT, FIELD CALIBRATION
   ========================================================== */
(function capubUtilityFieldUniformPatch(){
  try{
    const FIELD_BADGE_UNIFORMS = new Set(['ocp','abu','corporate_field','cfu','cfdu','flight_suit','fdu']);
    const FIELD_CALIBRATION_BUCKETS = ['ocp','abu','corporate_field','cfdu','flight_suit'];

    function capubFieldUniformKey(uniformId = State.uniform){
      if(typeof normalizeFieldUniformRenderKey === 'function') return normalizeFieldUniformRenderKey(uniformId);
      const u = String(uniformId || '').toLowerCase();
      if(u === 'cfu') return 'corporate_field';
      if(u === 'fdu') return 'flight_suit';
      return u;
    }

    function capubIsUtilityUniform(uniformId = State.uniform){
      return FIELD_BADGE_UNIFORMS.has(capubFieldUniformKey(uniformId));
    }

    const CAPUB_DOCUMENT_UTILITY_BADGE_IDS = [
      'MasterAirCrew1_72AC4CAE7A310','SeniorAirCrew1_B289BAE6E515C','AirCrew1_DB3F0FCC3650F',
      'MasterObserver1_1B88D5071FD5C','SeniorObserver1_0E35802A29801','observer_badge',
      'jewish_chaplin','christian_chaplin','buddist_chaplin','muslim_chaplin',
      'medical_officer','nurse_officer','legal_officer',
      'emt_paramedic','emt_intermediate','emt_basic_badge',
      'incident_commander_1_badge','incident_commander_2_badge','basic_incident_commander_badge',
      'master_ground_team_badge','senior_ground_team_badge','ground_team_basic_badge',
      'group_commander_badge','squadron_commander_badge'
    ];
    const CAPUB_DOCUMENT_UTILITY_BADGE_ID_SET = new Set(CAPUB_DOCUMENT_UTILITY_BADGE_IDS);
    const CAPUB_UTILITY_ONLY_BADGE_IDS = new Set([]);
    CAPUB_UTILITY_ONLY_BADGE_IDS.forEach(id => {
      if(!badgeList.includes(id)) badgeList.push(id);
    });
    const CAPUB_UTILITY_BADGE_LABELS = {
      basic_incident_commander_badge: 'Basic Incident Commander Badge (IC3)',
      incident_commander_1_badge: 'Master Incident Commander Badge (IC1)',
      incident_commander_2_badge: 'Senior Incident Commander Badge (IC2)'
    };
    const CAPUB_INCIDENT_COMMANDER_BADGE_IDS = new Set([
      'basic_incident_commander_badge','incident_commander_1_badge','incident_commander_2_badge'
    ]);
    const CAPUB_UTILITY_BADGE_PREVIEW_REVISION = 'capr-fabric-20260826-v6';

    function capubUtilityBadgePreviewUrl(id){
      return `${ASSET(`badges/utility/${id}.png`)}?v=${CAPUB_UTILITY_BADGE_PREVIEW_REVISION}`;
    }

    function capubPatchIsUnitPatchId(patchId){
      const id = String(patchId || '');
      if(id === 'unit_patch' || id === 'wing_patch' || id === 'command_patch') return true;
      if(id === 'tn185_ocp_patch') return true;
      if(typeof UNIT_PATCH_IMAGE_BY_CHARTER === 'object'){
        return Object.values(UNIT_PATCH_IMAGE_BY_CHARTER || {}).includes(id);
      }
      return /^unitPatch:/i.test(id);
    }

    function capubPatchHasOcpAsset(patchId){
      const id = String(patchId || '').toLowerCase();
      const meta = PATCH_META?.[patchId] || {};
      const img = String(meta.img || '').toLowerCase();
      return id.includes('ocp') || img.includes('/ocp/') || img.includes('ocp');
    }

    function capubGeneralPatchVisibleForCurrentUniform(patchId, uniformId = State.uniform){
      const key = capubFieldUniformKey(uniformId);
      if(key === 'ocp'){
        // User rule: on OCP, only general patches with OCP in the name/path are shown.
        // Unit patches remain handled by the separate Unit Patch dropdown.
        return capubPatchHasOcpAsset(patchId);
      }
      return true;
    }

    // Utility uniforms select cloth insignia from Patches. Metal badge controls
    // remain a dress-uniform feature; known counterparts (for example National
    // Staff) are converted through ALTERNATES when the uniform changes.

    // Treat these two OCP patch assets as calibrated tall sleeve patches until final
    // natural dimensions are supplied. Each rendered layer remains editable in CAL.
    if(PATCH_META?.pjoc_ocp_patch){
      PATCH_META.pjoc_ocp_patch.img = 'patches/ocp/pjoc_ocp_patch.webp';
      PATCH_META.pjoc_ocp_patch.w = Number(PATCH_META.pjoc_ocp_patch.w) || 100;
      PATCH_META.pjoc_ocp_patch.h = Number(PATCH_META.pjoc_ocp_patch.h) || 200;
      PATCH_META.pjoc_ocp_patch.authorizedUniforms = ['ocp'];
    }
    if(PATCH_META?.tn185_ocp_patch){
      PATCH_META.tn185_ocp_patch.img = 'patches/ocp/TN-185_ocp_patch.webp';
      PATCH_META.tn185_ocp_patch.w = Number(PATCH_META.tn185_ocp_patch.w) || 100;
      PATCH_META.tn185_ocp_patch.h = Number(PATCH_META.tn185_ocp_patch.h) || 200;
      PATCH_META.tn185_ocp_patch.authorizedUniforms = ['abu','ocp','corporate_field','cfdu','flight_suit'];
      PATCH_META.tn185_ocp_patch.slotHint = PATCH_META.tn185_ocp_patch.slotHint || 'R_SHOULDER';
    }

    // Keep SER-TN-185 as the logical unit identity and let the renderer resolve the file.
    if(typeof UNIT_PATCH_IMAGE_BY_CHARTER === 'object'){
      UNIT_PATCH_IMAGE_BY_CHARTER['SER-TN-185'] = 'tn185_ocp_patch';
      UNIT_PATCH_IMAGE_BY_CHARTER['TN-185'] = 'tn185_ocp_patch';
    }

    const capubPreviousGetBadgeAssetPath = getBadgeAssetPath;
    getBadgeAssetPath = function capubGetBadgeAssetPathUtilityAware(id){
      if(capubIsUtilityUniform()) return `badges/${id}.webp`;
      return capubPreviousGetBadgeAssetPath(id);
    };

    const capubPreviousGetBadgeAssetCandidates = getBadgeAssetCandidates;
    getBadgeAssetCandidates = function capubGetBadgeAssetCandidatesUtilityAware(id){
      if(capubIsUtilityUniform()){
        // Never fall back to metal/non-fabric artwork on a utility uniform.
        if(!CAPUB_DOCUMENT_UTILITY_BADGE_ID_SET.has(id)) return [];
        return [`badges/utility/${id}.png`];
      }
      const current = [];
      (capubPreviousGetBadgeAssetCandidates(id) || []).forEach(path => addAssetCandidate(current, path));
      return current;
    };

    const capubPreviousIsPatchAuthorizedForUniform = isPatchAuthorizedForUniform;
    isPatchAuthorizedForUniform = function capubIsPatchAuthorizedForUniformOcpFiltered(patchId, uniformId = State.uniform, membership = State.membership){
      if(!capubPreviousIsPatchAuthorizedForUniform(patchId, uniformId, membership)) return false;
      const uniformKey = capubFieldUniformKey(uniformId);
      if(uniformKey === 'ocp' && !capubPatchIsUnitPatchId(patchId)){
        return capubPatchHasOcpAsset(patchId);
      }
      return true;
    };

    const capubPreviousGetPatchAuthorizationReason = getPatchAuthorizationReason;
    getPatchAuthorizationReason = function capubGetPatchAuthorizationReasonOcpFiltered(patchId, uniformId = State.uniform, membership = State.membership){
      const uniformKey = capubFieldUniformKey(uniformId);
      if(uniformKey === 'ocp' && !capubPatchIsUnitPatchId(patchId) && !capubPatchHasOcpAsset(patchId)){
        return 'OCP patch picker only displays/renders general patches with OCP in the file name/path. Unit patches use the separate Unit Patch selector.';
      }
      return capubPreviousGetPatchAuthorizationReason(patchId, uniformId, membership);
    };

    function capubVisiblePatchIdsForGallery(){
      return (patchList || []).filter(id => {
        if(!PATCH_META[id]) return false;
        if(FIELD_BASE_BUILT_IN_PATCH_IDS.has(id)) return false;
        if(capubPatchIsUnitPatchId(id)) return false; // unit patches stay in the Unit Patch dropdown
        if(!capubGeneralPatchVisibleForCurrentUniform(id)) return false;
        return true;
      });
    }

    buildPatchGallery = function capubBuildPatchGalleryOcpAware(){
      const wrap = by('patchGallery');
      if(!wrap) return;

      normalizePatchSelections();
      wrap.innerHTML = '';

      const visibleIds = capubVisiblePatchIdsForGallery();
      const showCount = State.patchGalleryExpanded ? visibleIds.length : Math.min(10, visibleIds.length);

      if(!visibleIds.length){
        const tile = document.createElement('div');
        tile.className = 'galleryTile';
        tile.innerHTML = `<div style="flex:1;min-width:0;"><div class="title">No general patches available</div><div class="sub">For OCP, only general patch files with OCP in the name/path are shown. Unit patches are selected below in the Unit Patch dropdown.</div></div>`;
        wrap.appendChild(tile);
        return;
      }

      for(let idx=0; idx<showCount; idx++){
        const id = visibleIds[idx];
        const meta = PATCH_META[id];
        const sel = State.patchSelections[id] || (State.patchSelections[id] = { checked:false });
        const authorized = isPatchAuthorizedForUniform(id);
        const title = meta.label || id.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());

        const tile = document.createElement('div');
        tile.className = 'galleryTile';
        tile.innerHTML = `
          <img loading="lazy" decoding="async" src="${ASSET(meta.img)}" alt="${escapeHtml(title)}">
          <div style="flex:1;min-width:0;">
            <div class="title">${escapeHtml(title)}</div>
            <div class="sub">(${escapeHtml(id)})</div>
            <div class="miniRow"><label><input type="checkbox" class="ptChk"> Add</label></div>
            <div class="sub">Slot hint: <b>${escapeHtml(meta.slotHint)}</b> • Size: ${meta.w}×${meta.h} px • Path: images/${meta.img}</div>
          </div>`;

        const chk = tile.querySelector('.ptChk');
        chk.checked = !!sel.checked && authorized;
        chk.disabled = !authorized;
        if(!authorized){
          tile.classList.add('disabledBlock');
          const sub = tile.querySelector('.sub:last-child');
          const reason = getPatchAuthorizationReason(id);
          if(sub) sub.innerHTML += ` • <b>${escapeHtml(reason || 'Not authorized on current uniform')}</b>`;
        }
        chk.onchange = () => {
          if(!authorized){ chk.checked = false; sel.checked = false; return; }
          sel.checked = chk.checked;
          State.patchSelections[id] = sel;
          rebuildPatchesFromGallery();
        };
        wrap.appendChild(tile);
      }
    };

    const capubPreviousClearUnauthorizedPatchesForCurrentUniform = clearUnauthorizedPatchesForCurrentUniform;
    clearUnauthorizedPatchesForCurrentUniform = function capubClearUnauthorizedPatchesUtilityAware(){
      const changed = capubPreviousClearUnauthorizedPatchesForCurrentUniform();
      // Hide/de-select general non-OCP patches when OCP is selected, but do not touch unit patch selector.
      if(capubFieldUniformKey() === 'ocp'){
        let localChanged = false;
        for(const id of Object.keys(State.patchSelections || {})){
          if(State.patchSelections[id]?.checked && !capubPatchIsUnitPatchId(id) && !capubPatchHasOcpAsset(id)){
            State.patchSelections[id].checked = false;
            localChanged = true;
          }
        }
        const before = (State.patches || []).length;
        State.patches = (State.patches || []).filter(id => capubPatchIsUnitPatchId(id) || capubPatchHasOcpAsset(id));
        return changed || localChanged || before !== State.patches.length;
      }
      return changed;
    };

    function capubGetUtilityBadgeIds(){
      // Utility uniforms show only the cloth occupational/qualification badges
      // pictured in CAPR 39-1 Attachment 7, Figure A7-3.
      return CAPUB_DOCUMENT_UTILITY_BADGE_IDS
        .filter(id => isBadgeEligibleForMembership(id, State.membership));
    }

    buildBadgeGallery = function capubBuildBadgeGalleryUtilityAware(){
      const wrap = by('badgeGallery');
      if(!wrap) return;

      normalizeBadgeSelections();
      wrap.innerHTML = '';

      const utilityMode = capubIsUtilityUniform();
      const eligible = utilityMode
        ? capubGetUtilityBadgeIds()
        : getEligibleBadgeIdsForMembership(State.membership).filter(id => !CAPUB_UTILITY_ONLY_BADGE_IDS.has(id));
      // The document-defined utility set is intentionally small; show the
      // complete reviewed fabric-insignia catalog without an expansion step.
      const showCount = utilityMode ? eligible.length : (State.badgeGalleryExpanded ? eligible.length : Math.min(12, eligible.length));

      for(let idx=0; idx<showCount; idx++){
        const id = eligible[idx];
        const sel = State.badgeSelections[id] || (State.badgeSelections[id] = { checked:false });
        const title = CAPUB_UTILITY_BADGE_LABELS[id]
          || id.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
        const rareCadetTag = (!utilityMode && State.membership === 'cadet' && rareCadetBadges.has(id)) ? ' <span class="validationBadge">Rare Cadet Eligibility</span>' : '';
        const utilityCandidates = utilityMode ? getBadgeAssetCandidates(id) : [];
        const previewPath = utilityMode ? (utilityCandidates[0] || `badges/utility/${id}.png`) : getBadgeAssetPath(id);
        const fallbackPath = utilityMode ? '' : `badges/${id}.webp`;

        const tile = document.createElement('div');
        tile.className = 'galleryTile';
        tile.innerHTML = `
          <img loading="lazy" decoding="async" src="${utilityMode ? capubUtilityBadgePreviewUrl(id) : ASSET(previewPath)}" alt="${escapeHtml(title)}"${utilityMode ? ' class="utilityBadgePreview"' : ''}>
          <div style="flex:1;min-width:0;">
            <div class="title">${escapeHtml(title)}${rareCadetTag}</div>
            <div class="sub">(${escapeHtml(id)})${utilityMode ? ' • Silver-on-blue utility badge' : ''}</div>
            <div class="miniRow"><label><input type="checkbox" class="bdChk"> Add</label></div>
            ${id==='squadron_commander_badge' && !utilityMode ? `<div class="miniRow"><label><input type="checkbox" class="cmdGradChk"> Graduated commander</label></div>` : ``}
            <div class="sub">Slot: <b>${utilityMode ? 'Utility uniform calibrated field slot' : getBadgeSlotLabel(id)}</b> • Regulation scale: ${Math.round(getBadgeRenderSize(id).width)}×${Math.round(getBadgeRenderSize(id).height)} px</div>
          </div>`;

        const chk = tile.querySelector('.bdChk');
        const gradChk = tile.querySelector('.cmdGradChk');
        const previewImg = tile.querySelector('img');
        if(previewImg){
          const previewCandidates = utilityMode
            ? utilityCandidates.slice(1).map(path => `${ASSET(path)}?v=${CAPUB_UTILITY_BADGE_PREVIEW_REVISION}`)
            : [fallbackPath];
          let previewCandidateIndex = 0;
          previewImg.onerror = () => {
            if(previewCandidateIndex >= previewCandidates.length){
              previewImg.onerror = null;
              return;
            }
            previewImg.src = utilityMode
              ? previewCandidates[previewCandidateIndex++]
              : ASSET(previewCandidates[previewCandidateIndex++]);
          };
        }
        chk.checked = !!sel.checked;
        if(gradChk) gradChk.checked = !!State.commandInsignia?.graduatedCommander;

        chk.onchange = () => {
          if(isCommandInsigniaBadge(id) && chk.checked && !canSelectCommandInsigniaForCurrentRank(true)){
            chk.checked = false;
            sel.checked = false;
            State.badgeSelections[id] = sel;
            rebuildBadgesFromGallery();
            return;
          }
          if(chk.checked && CAPUB_INCIDENT_COMMANDER_BADGE_IDS.has(id)){
            CAPUB_INCIDENT_COMMANDER_BADGE_IDS.forEach(otherId => {
              if(otherId === id) return;
              if(State.badgeSelections[otherId]) State.badgeSelections[otherId].checked = false;
              State.badges = (State.badges || []).filter(selectedId => selectedId !== otherId);
            });
          }
          if(chk.checked && GOVERNANCE_SERVICE_BADGE_IDS.has(id)){
            GOVERNANCE_SERVICE_BADGE_IDS.forEach(otherId => {
              if(otherId === id) return;
              if(State.badgeSelections[otherId]) State.badgeSelections[otherId].checked = false;
              State.badges = (State.badges || []).filter(selectedId => selectedId !== otherId);
            });
          }
          sel.checked = chk.checked;
          State.badgeSelections[id] = sel;
          rebuildBadgesFromGallery();
        };
        if(gradChk){
          gradChk.onchange = () => {
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
            if(gradChk.checked){ sel.checked = true; chk.checked = true; State.badgeSelections[id] = sel; }
            rebuildBadgesFromGallery();
          };
        }
        wrap.appendChild(tile);
      }
    };

    const capubPreviousGetRenderableCountedBadgeIds = getRenderableCountedBadgeIds;
    getRenderableCountedBadgeIds = function capubGetRenderableCountedBadgeIdsUtilityAware(){
      if(!capubIsUtilityUniform()) return capubPreviousGetRenderableCountedBadgeIds();
      return capubUtilityBadgeIds().filter(id => !isCommandInsigniaBadge(id));
    };

    const capubPreviousGetRenderableCommandBadgeIds = getRenderableCommandBadgeIds;
    getRenderableCommandBadgeIds = function capubGetRenderableCommandBadgeIdsUtilityAware(){
      if(!capubIsUtilityUniform()) return capubPreviousGetRenderableCommandBadgeIds();
      return capubUtilityBadgeIds().filter(id => isCommandInsigniaBadge(id));
    };

    /*
      CAPR 39-1, OCP occupational/qualification badge layout.

      The utility-uniform artwork is rendered at roughly 44 px per inch (the
      five-inch CAP tape is about 220 px wide), so six pixels represents the
      required 1/8-inch exposed dark-blue fabric margin.  Badge artwork keeps
      its natural aspect ratio; only its longest dimension is normalized.
    */
    // The OCP artwork's five-inch CAP tape is about 110 canvas pixels wide.
    // That makes the actual garment scale approximately 22 px/in, not 44.
    const CAPUB_UTILITY_PX_PER_INCH = 22;
    const CAPUB_UTILITY_BLUE_MARGIN = Math.round(CAPUB_UTILITY_PX_PER_INCH / 8);
    const CAPUB_UTILITY_CAP_TAPE = {
      ocp: { centerX:580, topY:180 },
      abu: { centerX:360, topY:180 },
      corporate_field: { centerX:360, topY:180 },
      cfdu: { centerX:360, topY:180 },
      flight_suit: { centerX:360, topY:180 }
    };
    const CAPUB_UTILITY_NAME_TAPE = {
      ocp: { centerX:380, topY:180 },
      abu: { centerX:360, topY:180 },
      corporate_field: { centerX:360, topY:180 },
      cfdu: { centerX:360, topY:180 },
      flight_suit: { centerX:360, topY:180 }
    };
    // Imported from the user's OCP positioning example. Placement is keyed by
    // badge identity, not click order, so precedence cannot move these badges.
    const CAPUB_UTILITY_THREE_BADGE_TEMPLATE = {
      // Imported from CAPUB setup (14): aviation wings centered on the upper
      // row, with the two occupational badges aligned beneath them.
      ocp: [
        { centerX:580, topY:99 },
        { centerX:562, topY:128 },
        { centerX:596, topY:131 }
      ]
    };

    const CAPUB_UTILITY_BADGE_PRECEDENCE = [
      'MasterObserver1_1B88D5071FD5C','SeniorObserver1_0E35802A29801','observer_badge',
      'MasterAirCrew1_72AC4CAE7A310','SeniorAirCrew1_B289BAE6E515C','AirCrew1_DB3F0FCC3650F',
      'incident_commander_1_badge','incident_commander_2_badge','basic_incident_commander_badge',
      'master_ground_team_badge','senior_ground_team_badge','ground_team_basic_badge',
      'emt_paramedic','emt_intermediate','emt_basic_badge',
      'medical_officer','nurse_officer','legal_officer',
      'jewish_chaplin','christian_chaplin','buddist_chaplin','muslim_chaplin',
      'group_commander_badge','squadron_commander_badge'
    ];
    const CAPUB_UTILITY_BADGE_PRECEDENCE_INDEX = new Map(
      CAPUB_UTILITY_BADGE_PRECEDENCE.map((id, index) => [id, index])
    );

    function capubUtilityBadgePriority(id){
      // Aeronautical/aviation wings always occupy the highest utility-uniform
      // position. The detailed list controls precedence within each category.
      const category = AIRCREW_BADGE_IDS?.has?.(id) ? 0 : 1;
      return category * 1000 + (CAPUB_UTILITY_BADGE_PRECEDENCE_INDEX.get(id) ?? 999);
    }

    function capubUtilityBadgeIds(){
      const selected = [...new Set(State.badges || [])]
        .filter(id => isBadgeEligibleForMembership(id, State.membership))
        .filter(id => CAPUB_DOCUMENT_UTILITY_BADGE_ID_SET.has(id))
        .filter(id => !isCommandInsigniaBadge(id) || isCommandInsigniaGradeEligible(State.rank))
        .sort((a, b) => capubUtilityBadgePriority(a) - capubUtilityBadgePriority(b));
      // Qualification badges form the one-to-four-badge arrangement over the
      // CIVIL AIR PATROL tape. A single cloth command insignia is a separate
      // item centered over the wearer's name tape and must not consume a slot
      // or participate in the qualification grid.
      // OCP supports three selected embroidered aviation/occupational badges.
      // The renderer already provides the required one-over-two arrangement.
      const qualifications = selected.filter(id => !isCommandInsigniaBadge(id)).slice(0, 3);
      const command = selected.filter(id => isCommandInsigniaBadge(id)).slice(0, 1);
      return [...qualifications, ...command];
    }

    function capubUtilityBadgeSize(img){
      const naturalW = Number(img.naturalWidth) || 1;
      const naturalH = Number(img.naturalHeight) || 1;
      const id = img.dataset.badgeId;
      let targetW;
      let targetH;
      if(isCommandInsigniaBadge(id)){
        targetH = CAPUB_UTILITY_PX_PER_INCH * (id === 'squadron_commander_badge' ? 0.875 : 1.125);
      }else if(AIRCREW_BADGE_IDS?.has?.(id)){
        // Figure A7-1: regular aviation insignia is three inches wide.
        targetW = CAPUB_UTILITY_PX_PER_INCH * 3;
      }else if(CAPUB_INCIDENT_COMMANDER_BADGE_IDS.has(id)){
        // Figure A7-3: regular Incident Commander insignia is 1 5/8 inches wide.
        targetW = CAPUB_UTILITY_PX_PER_INCH * 1.625;
      }else if(GROUND_EMT_BADGE_IDS?.has?.(id)){
        // Figures A7-3/A7-4: regular Ground Team and EMT insignia is 1 1/8 inches wide.
        targetW = CAPUB_UTILITY_PX_PER_INCH * 1.125;
      }else if(id === 'national_staff_badge'){
        // IMG_1098 shows the embroidered emblem about 14% wider than the
        // corresponding full-size metal badge (34 px versus 30 px here).
        targetW = 34;
      }else{
        targetW = CAPUB_UTILITY_PX_PER_INCH * 1.125;
      }
      const scale = targetW
        ? targetW / naturalW
        : targetH / naturalH;
      return {
        w: Math.max(1, Math.round(naturalW * scale)),
        h: Math.max(1, Math.round(naturalH * scale))
      };
    }

    function capubLayoutUtilityBadges(){
      const allBadges = [...uniformCanvas.querySelectorAll('.capubUtilityBadge')];
      if(!allBadges.length) return;

      const fieldKey = capubFieldUniformKey();
      const tape = CAPUB_UTILITY_CAP_TAPE[fieldKey] || CAPUB_UTILITY_CAP_TAPE.ocp;
      const nameTape = CAPUB_UTILITY_NAME_TAPE[fieldKey] || CAPUB_UTILITY_NAME_TAPE.ocp;
      const halfInch = Math.round(CAPUB_UTILITY_PX_PER_INCH / 2);
      const quarterInch = Math.round(CAPUB_UTILITY_PX_PER_INCH / 4);
      const eighthInch = CAPUB_UTILITY_BLUE_MARGIN;
      const commandBadges = allBadges.filter(img => isCommandInsigniaBadge(img.dataset.badgeId));
      const badges = allBadges.filter(img => !isCommandInsigniaBadge(img.dataset.badgeId));

      // Cloth command insignia is centered above the wearer's name tape. It is
      // intentionally outside the occupational/qualification badge array.
      commandBadges.forEach(img => {
        const size = capubUtilityBadgeSize(img);
        const saved = typeof getCalib === 'function' ? getCalib(img.dataset.calibKey) : null;
        const x = Number.isFinite(Number(saved?.x)) ? Number(saved.x) : nameTape.centerX - size.w / 2;
        const y = Number.isFinite(Number(saved?.y)) ? Number(saved.y) : nameTape.topY - halfInch - size.h;
        const w = Math.min(Number(saved?.w) || size.w, size.w);
        const h = Math.min(Number(saved?.h) || size.h, size.h);
        img.style.left = `${x}px`;
        img.style.top = `${y}px`;
        img.style.width = `${w}px`;
        img.style.height = `${h}px`;
        img.style.transform = `rotate(${Number(saved?.r || 0)}deg)`;
      });

      if(!badges.length) return;
      const sizes = badges.map(img => capubUtilityBadgeSize(img));
      const threeBadgeTemplate = CAPUB_UTILITY_THREE_BADGE_TEMPLATE[fieldKey];

      // One/two badges use the 1/2-inch tape clearance. Three/four use 1/8 inch.
      const lowerBottom = tape.topY - (badges.length <= 2 ? halfInch : eighthInch);
      const positions = [];

      if(badges.length === 1){
        const size = sizes[0];
        positions.push({ x:tape.centerX - size.w/2, y:lowerBottom - size.h });
      }else if(badges.length === 2){
        // The array is in wear precedence. Put the first (aviation wings when
        // present) in the upper position and the second nearest the CAP tape.
        const upper = sizes[0];
        const lower = sizes[1];
        positions.push({
          x:tape.centerX - upper.w/2,
          y:lowerBottom - lower.h - halfInch - upper.h
        });
        positions.push({ x:tape.centerX - lower.w/2, y:lowerBottom - lower.h });
      }else if(badges.length === 3 && threeBadgeTemplate){
        threeBadgeTemplate.forEach((template, index) => {
          positions.push({
            x:template.centerX - sizes[index].w / 2,
            y:template.topY
          });
        });
      }else if(badges.length === 3){
        // Highest-precedence badge is centered on the upper row. The next two
        // are placed left-to-right on the lower row, matching the supplied OCP example.
        const lowerGap = Math.max(3, eighthInch / 2);
        const lowerWidth = sizes[1].w + lowerGap + sizes[2].w;
        const lowerLeft = tape.centerX - lowerWidth / 2;
        positions.push({ x:tape.centerX - sizes[0].w/2, y:lowerBottom - Math.max(sizes[1].h, sizes[2].h) - quarterInch - sizes[0].h });
        positions.push({ x:lowerLeft, y:lowerBottom - sizes[1].h });
        positions.push({ x:lowerLeft + sizes[1].w + lowerGap, y:lowerBottom - sizes[2].h });
      }else{
        // Four-badge approved option: two side-by-side vertical stacks of two.
        const horizontalGap = halfInch;
        const leftColumnW = Math.max(sizes[0].w, sizes[2].w);
        const rightColumnW = Math.max(sizes[1].w, sizes[3].w);
        const totalW = leftColumnW + horizontalGap + rightColumnW;
        const leftCenter = tape.centerX - totalW/2 + leftColumnW/2;
        const rightCenter = tape.centerX + totalW/2 - rightColumnW/2;
        const centers = [leftCenter, rightCenter, leftCenter, rightCenter];
        for(let i=0; i<4; i++){
          const size = sizes[i];
          const rowBottom = i < 2
            ? lowerBottom
            : lowerBottom - Math.max(sizes[0].h, sizes[1].h) - quarterInch;
          positions.push({ x:centers[i] - size.w/2, y:rowBottom - size.h });
        }
      }

      badges.forEach((img, i) => {
        const size = sizes[i];
        const saved = typeof getCalib === 'function' ? getCalib(img.dataset.calibKey) : null;
        const placement = saved;
        img.style.left = `${Number(placement?.x ?? positions[i].x)}px`;
        img.style.top = `${Number(placement?.y ?? positions[i].y)}px`;
        // Preserve calibrated position, but cap stale saved dimensions at the
        // current regulation-scaled size so old 44-px/in data cannot double badges.
        img.style.width = `${Math.min(Number(placement?.w) || size.w, size.w)}px`;
        img.style.height = `${Math.min(Number(placement?.h) || size.h, size.h)}px`;
        img.style.transform = `rotate(${Number(placement?.r || 0)}deg)`;
      });
    }

    function capubRenderUtilityBadges(){
      capubUtilityBadgeIds().forEach((id, index) => {
        const img = new Image();
        img.className = 'layer badge capubUtilityBadge';
        img.dataset.badgeId = id;
        // New key prevents legacy 44-px/in and mixed command-grid coordinates
        // from overriding the regulation-based automatic layout.
        img.dataset.calibKey = `utilityBadgeRegV5:${id}:${index}`;
        img.dataset.tooltipTitle = (CAPUB_UTILITY_BADGE_LABELS[id] || id.replace(/_/g,' ')).toUpperCase();
        img.dataset.tooltipReg = 'CAPR 39-1, paragraph 5.1.2.3.6';
        img.dataset.tooltipWhy = 'One of no more than three embroidered aviation/occupational badges centered above the CAP tape.';
        img.style.display = 'block';
        img.style.objectFit = 'contain';
        // CAPR cloth insignia is worn on a dark-blue rectangular background
        // with 1/8 inch of blue showing around the embroidered device. Keep
        // that field explicit and uniform instead of depending on the varying
        // transparent/blue margins baked into the source PNG files.
        img.style.backgroundColor = '#132140';
        img.style.border = `${CAPUB_UTILITY_BLUE_MARGIN}px solid #132140`;
        img.style.boxSizing = 'content-box';
        img.style.zIndex = '28';
        img.onload = capubLayoutUtilityBadges;
        applyBadgeAssetWithFallback(img, id);
        uniformCanvas.appendChild(img);
      });
      capubLayoutUtilityBadges();
    }

    const capubPreviousRenderAllBadges = renderAllBadges;
    renderAllBadges = function capubRenderAllBadgesUtilityAware(){
      if(!capubIsUtilityUniform()) return capubPreviousRenderAllBadges();
      clearMeasurementOverlay();
      [...uniformCanvas.querySelectorAll('.layer.badge')].forEach(node => node.remove());
      resetBadgeSlots();
      if(UI_AUTHZ[State.uniform]?.showBadges) capubRenderUtilityBadges();
      renderMeasurementOverlay();
    };

    const capubPreviousGetBadgeSlotSpec = getBadgeSlotSpec;
    getBadgeSlotSpec = function capubGetBadgeSlotSpecUtilityAware(id){
      if(capubIsUtilityUniform()){
        if(AIRCREW_BADGE_IDS?.has?.(id)) return 'OLP';
        if(OLPU_OCCUPATIONAL_BADGE_IDS?.has?.(id)) return 'OLPU';
        if(isCommandInsigniaBadge(id)) return 'ON';
        if(isSelectableSpecialtyPocketBadge(id)) return 'RP';
        return 'UN';
      }
      return capubPreviousGetBadgeSlotSpec(id);
    };

    // Fills in one default patch box per field uniform from the slot tables. Field-uniform badges
    // need no stored boxes: capubLayoutUtilityBadges() places them by rule.
    function capubEnsureFieldCalibrationDefaults(){
      if(!State.calib.byUniform) State.calib.byUniform = {};
      const patchIds = Object.keys(PATCH_META || {}).filter(id => !FIELD_BASE_BUILT_IN_PATCH_IDS.has(id));

      FIELD_CALIBRATION_BUCKETS.forEach(bucketId => {
        if(!DEFAULT_CALIBRATION_BY_UNIFORM[bucketId]) DEFAULT_CALIBRATION_BY_UNIFORM[bucketId] = {};
        if(!State.calib.byUniform[bucketId]) State.calib.byUniform[bucketId] = {};

        const patchLayout = FIELD_UNIFORM_PATCH_LAYOUTS?.[bucketId] || FIELD_UNIFORM_PATCH_LAYOUTS?.ocp || {};
        patchIds.forEach(patchId => {
          const meta = PATCH_META[patchId];
          const slot = meta?.slotHint || 'L_SHOULDER';
          const anchor = patchLayout[slot] || patchLayout.L_SHOULDER || {x:120,y:210,dy:76};
          const w = Number(meta?.w) || 70;
          const h = Number(meta?.h) || 70;
          const key = `patch:${patchId}:${slot}:0`;
          if(!DEFAULT_CALIBRATION_BY_UNIFORM[bucketId][key]){
            DEFAULT_CALIBRATION_BY_UNIFORM[bucketId][key] = {
              x: Math.round(Number(anchor.x || 0) - w/2),
              y: Math.round(Number(anchor.y || 0) - h/2),
              w, h,
              r: Number(anchor.r) || 0
            };
          }
        });
      });
      if(typeof mergeCalibDefaults === 'function') mergeCalibDefaults();
    }

    const NCSA_PATCH_MATCHERS = [
      { id:'pjoc_ocp_patch', fallbackId:'pjoc_patch', terms:[/\bPJOC\b/i,/Pararescue\s+Orientation\s+Course/i] },
      { id:'nesa_patch', terms:[/\bNESA\b/i,/National\s+Emergency\s+Services\s+Academy/i] },
      { id:'civil_engineering_academy_patch', terms:[/Civil\s+Engineering\s+Academy/i,/Air\s+Force\s+Civil\s+Engineering\s+Academy/i] },
      { id:'cos_patch', terms:[/\bCOS\b/i,/Cadet\s+Officer\s+School/i] },
      { id:'honor_guard_academy_patch', terms:[/Honor\s+Guard\s+Academy/i] },
      { id:'nfa_patch', terms:[/\bNFA\b/i,/National\s+Flight\s+Academy/i] },
      { id:'cla_patch', terms:[/\bCLA\b/i,/Civic\s+Leadership\s+Academy/i] },
      { id:'nbb_patch', terms:[/\bNBB\b/i,/National\s+Blue\s+Beret/i] },
      { id:'undergrad_pilot_training_patch', terms:[/Undergraduate\s+Pilot\s+Training/i] },
      { id:'model_rocketry_patch', terms:[/Model\s+Rocketry/i] },
      { id:'orientation_pilot_patch', terms:[/Orientation\s+Pilot/i,/Cadet\s+Orientation\s+Pilot/i] }
    ];

    function capubPatchIdForUniform(matcher, uniformId = State.uniform){
      const key = capubFieldUniformKey(uniformId);
      if(key === 'ocp') return matcher.id;
      return matcher.fallbackId || matcher.id;
    }

    function capubDetectNCSAPatchesFromReport(text){
      const found = [];
      const t = String(text || '');
      NCSA_PATCH_MATCHERS.forEach(matcher => {
        if(matcher.terms.some(re => re.test(t))){
          const id = capubPatchIdForUniform(matcher);
          if(PATCH_META[id] && !found.includes(id)) found.push(id);
        }
      });
      return found;
    }

    function capubDetectUnitCharterFromReport(text){
      const t = String(text || '').replace(/\s+/g, ' ');
      const explicit = t.match(/\b([A-Z]{2,3}-[A-Z]{2}-\d{3})\b/);
      if(explicit && CAP_UNIT_OPTIONS?.some?.(u => u.code === explicit[1])) return explicit[1];

      const short = t.match(/\b([A-Z]{2}-\d{3})\b/);
      if(short){
        const hit = CAP_UNIT_OPTIONS?.find?.(u => String(u.code || '').endsWith(`-${short[1]}`));
        if(hit) return hit.code;
        if(short[1] === 'TN-185') return 'SER-TN-185';
      }

      // Slower but very reliable fallback: scan known charters that appear in the report.
      const hit = CAP_UNIT_OPTIONS?.find?.(u => new RegExp(`\\b${String(u.code).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b`).test(t));
      return hit?.code || null;
    }

    const capubPreviousParseCapMemberReport = parseCapMemberReport;
    parseCapMemberReport = function capubParseCapMemberReportUtilityPatchAware(textRaw){
      const normalized = normalizeMemberReportText(textRaw);
      const result = capubPreviousParseCapMemberReport(textRaw);
      result.notes = result.notes || [];

      const charter = capubDetectUnitCharterFromReport(normalized);
      if(charter){
        result.unitPatchCharter = charter;
        const unitPatchId = getUnitPatchIdForCharter(charter);
        if(unitPatchId){
          result.notes.push(`Unit patch auto-selected from member report charter ${charter}.`);
        }else{
          result.notes.push(`Member report charter ${charter} found, but no unit patch image is mapped yet.`);
        }
      }

      const ncsaPatches = capubDetectNCSAPatchesFromReport(normalized);
      if(ncsaPatches.length){
        result.patches = [...new Set([...(result.patches || []), ...ncsaPatches])];
        result.notes.push(`NCSA/activity patch match(es): ${ncsaPatches.join(', ')}.`);
      }
      return result;
    };

    const capubPreviousApplyCapMemberReportImport = applyCapMemberReportImport;
    applyCapMemberReportImport = function capubApplyCapMemberReportImportUtilityPatchAware(parsed){
      const charter = parsed?.unitPatchCharter || '';
      const result = capubPreviousApplyCapMemberReportImport(parsed);

      State.unitPatchCharter = charter;
      const unitSearch = by('unitPatchSearch');
      if(unitSearch && charter) unitSearch.value = charter;
      if(typeof buildUnitPatchSelector === 'function') buildUnitPatchSelector(unitSearch?.value || '');
      if(typeof renderUnitPatchStatus === 'function') renderUnitPatchStatus();

      // Reapply imported NCSA patches after the selected uniform and unit patch are known.
      normalizePatchSelections();
      for(const id of parsed?.patches || []){
        if(!PATCH_META[id]) continue;
        State.patchSelections[id] = State.patchSelections[id] || { checked:false };
        if(isPatchAuthorizedForUniform(id)){
          State.patchSelections[id].checked = true;
          if(!State.patches.includes(id)) State.patches.push(id);
        }
      }
      clearUnauthorizedPatchesForCurrentUniform();
      if(typeof buildPatchGallery === 'function') buildPatchGallery();
      if(typeof rebuildPatchesFromGallery === 'function') rebuildPatchesFromGallery();
      if(typeof fullRender === 'function') fullRender();
      return result;
    };

    // The base uniform click handler does not rebuild an already-opened badge
    // gallery. Refresh it after every uniform switch so OCP/ABU/CFU never show
    // the previously viewed blues/metal badge list on first open.
    uniformListEl?.addEventListener('click', event => {
      if(!event.target.closest('.uniformOption')) return;
      queueMicrotask(() => {
        if(typeof buildBadgeGallery === 'function') buildBadgeGallery();
        if(typeof renderAllBadges === 'function') renderAllBadges();
      });
    });

    capubEnsureFieldCalibrationDefaults();
    if(typeof buildBadgeGallery === 'function') buildBadgeGallery();
    if(typeof buildPatchGallery === 'function') buildPatchGallery();
    if(typeof fullRender === 'function') fullRender();
    console.info('CAPUB 2026-05-19 utility field-uniform patch loaded.');
  }catch(err){
    console.error('CAPUB 2026-05-19 utility field-uniform patch failed to load', err);
  }
})();


/* ==========================================================
   CAPUB HOTFIX 2026-05-19 — PJOC OCP/ABU variant handling,
   TN-330 unit patch path, and comms auto-alternate cleanup
   ========================================================== */
(function capubPatchVariantAndUnitHotfix(){
  try{
    function capubHotfixUniformKey(uniformId = State.uniform){
      if(typeof normalizeFieldUniformRenderKey === 'function') return normalizeFieldUniformRenderKey(uniformId);
      const u = String(uniformId || '').toLowerCase();
      if(u === 'cfu') return 'corporate_field';
      if(u === 'fdu') return 'flight_suit';
      if(u.includes('ocp')) return 'ocp';
      if(u.includes('abu')) return 'abu';
      if(u.includes('flight')) return 'flight_suit';
      if(u.includes('corporate') || u.includes('field')) return 'corporate_field';
      return u;
    }

    function capubHotfixAddPatchListId(id){
      if(Array.isArray(patchList) && !patchList.includes(id)) patchList.push(id);
    }

    // Unit patch asset for Sequoyah Cadet Squadron.
    // File convention matches TN-185:
    //   images/patches/ocp/TN-330_ocp_patch.webp
    PATCH_META.tn330_ocp_patch = {
      label:'SER-TN-330 Sequoyah Cadet Squadron Unit Patch',
      slotHint:'R_SHOULDER',
      w:200,
      h:100,
      img:'patches/ocp/TN-330_ocp_patch.webp',
      authorizedUniforms:['abu','ocp','corporate_field','cfdu','flight_suit']
    };

    // Imported from CAPUB_coordinates_1786941245605.json. This positions the
    // complete/adjusted OCP sprite on the male right-sleeve reference view.
    DEFAULT_CALIBRATION_BY_UNIFORM.ocp_male ||= {};
    DEFAULT_CALIBRATION_BY_UNIFORM.ocp_male['patch:tn330_ocp_patch:R_SHOULDER:0'] = {
      x:170, y:229, w:120, h:60, r:-16
    };

    // Keep the TN-185 metadata normalized and available for the same resolver.
    if(PATCH_META.tn185_ocp_patch){
      PATCH_META.tn185_ocp_patch.img = 'patches/ocp/TN-185_ocp_patch.webp';
      PATCH_META.tn185_ocp_patch.slotHint = 'R_SHOULDER';
      PATCH_META.tn185_ocp_patch.authorizedUniforms = ['abu','ocp','corporate_field','cfdu','flight_suit'];
      PATCH_META.tn185_ocp_patch.w = Number(PATCH_META.tn185_ocp_patch.w) || 100;
      PATCH_META.tn185_ocp_patch.h = Number(PATCH_META.tn185_ocp_patch.h) || 200;
    }

    // Keep OCP PJOC normalized.
    if(PATCH_META.pjoc_ocp_patch){
      PATCH_META.pjoc_ocp_patch.img = 'patches/ocp/pjoc_ocp_patch.webp';
      PATCH_META.pjoc_ocp_patch.slotHint = 'L_SHOULDER';
      PATCH_META.pjoc_ocp_patch.authorizedUniforms = ['ocp'];
      PATCH_META.pjoc_ocp_patch.w = Number(PATCH_META.pjoc_ocp_patch.w) || 100;
      PATCH_META.pjoc_ocp_patch.h = Number(PATCH_META.pjoc_ocp_patch.h) || 200;
    }

    // Make the new unit patch known to the unit-patch dropdown while keeping
    // generic unit patches out of the general patch picker.
    if(typeof UNIT_PATCH_IMAGE_BY_CHARTER === 'object'){
      UNIT_PATCH_IMAGE_BY_CHARTER['SER-TN-185'] = 'tn185_ocp_patch';
      UNIT_PATCH_IMAGE_BY_CHARTER['TN-185'] = 'tn185_ocp_patch';
      UNIT_PATCH_IMAGE_BY_CHARTER['SER-TN-330'] = 'tn330_ocp_patch';
      UNIT_PATCH_IMAGE_BY_CHARTER['TN-330'] = 'tn330_ocp_patch';
    }

    // Rebuild the selector because this mapping is installed after its initial
    // page setup. Preserve any search text the user has already entered.
    if(typeof buildUnitPatchSelector === 'function'){
      buildUnitPatchSelector(by('unitPatchSearch')?.value || '');
    }

    // Add the ID only so saved/imported setups can resolve it. The unit-patch
    // selector remains the preferred UI path for TN-330.
    capubHotfixAddPatchListId('tn330_ocp_patch');

    const CAPUB_PATCH_VARIANTS = {
      ocp: {
        pjoc_patch:'pjoc_ocp_patch'
      },
      abu: {
        pjoc_ocp_patch:'pjoc_patch'
      },
      corporate_field: {
        pjoc_ocp_patch:'pjoc_patch'
      },
      flight_suit: {
        pjoc_ocp_patch:'pjoc_patch'
      },
      cfdu: {
        pjoc_ocp_patch:'pjoc_patch'
      }
    };

    window.capubResolvePatchIdForUniform = function capubResolvePatchIdForUniform(patchId, uniformId = State.uniform){
      const key = capubHotfixUniformKey(uniformId);
      return CAPUB_PATCH_VARIANTS[key]?.[patchId] || patchId;
    };

    function capubSyncPatchVariantSelectionsForUniform(){
      if(!State.patchSelections) State.patchSelections = {};
      if(!Array.isArray(State.patches)) State.patches = [];

      const nextIds = [];
      for(const originalId of State.patches){
        const resolvedId = window.capubResolvePatchIdForUniform(originalId);
        if(resolvedId && !nextIds.includes(resolvedId)) nextIds.push(resolvedId);

        if(resolvedId !== originalId){
          const originalSel = State.patchSelections[originalId] || {};
          State.patchSelections[resolvedId] = { ...originalSel, checked:true };
          if(State.patchSelections[originalId]) State.patchSelections[originalId].checked = false;
        }
      }
      State.patches = nextIds;
    }

    // Stop the builder from adding the comms patch merely because a comms badge
    // was selected on blues. Report import can still queue comms_patch when the
    // Communications specialty rating is actually present, and the user can still
    // manually select it for ABU/CFU/flight suit.
    if(typeof ALTERNATES === 'object' && ALTERNATES.badgeToPatch){
      delete ALTERNATES.badgeToPatch.communications_technician_badge;
      delete ALTERNATES.badgeToPatch.communications_senior_badge;
      delete ALTERNATES.badgeToPatch.communications_master_badge;
    }

    const capubPrevClearUnauthorizedPatches = clearUnauthorizedPatchesForCurrentUniform;
    clearUnauthorizedPatchesForCurrentUniform = function capubClearUnauthorizedPatchesVariantAware(){
      capubSyncPatchVariantSelectionsForUniform();
      normalizePatchSelections();

      let changed = false;

      for(const id of Object.keys(State.patchSelections || {})){
        const resolvedId = window.capubResolvePatchIdForUniform(id);
        if(resolvedId !== id && State.patchSelections[id]?.checked){
          State.patchSelections[id].checked = false;
          State.patchSelections[resolvedId] = { ...(State.patchSelections[resolvedId] || {}), checked:true };
          changed = true;
        }
        if(State.patchSelections[resolvedId]?.checked && !isPatchAuthorizedForUniform(resolvedId)){
          State.patchSelections[resolvedId].checked = false;
          changed = true;
        }
      }

      const before = State.patches.length;
      State.patches = (State.patches || [])
        .map(id => window.capubResolvePatchIdForUniform(id))
        .filter((id, idx, arr) => id && arr.indexOf(id) === idx)
        .filter(id => isPatchAuthorizedForUniform(id));
      if(before !== State.patches.length) changed = true;

      return changed;
    };

    // Variant-aware render planning. This is the piece that prevents a selected
    // generic PJOC patch from being dropped on OCP; it resolves to pjoc_ocp_patch
    // before authorization/filtering.
    planPatches = function capubPlanPatchesVariantAware(ids){
      resetPatchSlots();
      const capsPerUniform = {
        blues_a:{L_SHOULDER:1,R_SHOULDER:1,CHEST_LEFT:1,CHEST_RIGHT:1},
        blues_b:{L_SHOULDER:1,R_SHOULDER:1,CHEST_LEFT:1,CHEST_RIGHT:1},
        aviator:{L_SHOULDER:1,R_SHOULDER:1,CHEST_LEFT:1,CHEST_RIGHT:1},
        aviator_blazer:{L_SHOULDER:1,R_SHOULDER:1,CHEST_LEFT:0,CHEST_RIGHT:0},
        corporate_field:{L_SHOULDER:2,R_SHOULDER:2,CHEST_LEFT:1,CHEST_RIGHT:1},
        abu:{L_SHOULDER:2,R_SHOULDER:2,CHEST_LEFT:1,CHEST_RIGHT:1},
        ocp:{L_SHOULDER:2,R_SHOULDER:2,CHEST_LEFT:1,CHEST_RIGHT:1},
        flight_suit:{L_SHOULDER:2,R_SHOULDER:2,CHEST_LEFT:2,CHEST_RIGHT:2},
        semi_formal:{L_SHOULDER:0,R_SHOULDER:0,CHEST_LEFT:0,CHEST_RIGHT:0},
        mess_dress:{L_SHOULDER:0,R_SHOULDER:0,CHEST_LEFT:0,CHEST_RIGHT:0},
        polo:{L_SHOULDER:0,R_SHOULDER:0,CHEST_LEFT:0,CHEST_RIGHT:0}
      }[State.uniform] || {L_SHOULDER:1,R_SHOULDER:1,CHEST_LEFT:1,CHEST_RIGHT:1};

      const plannedIds = [];
      const selectedUnitPatchId = (typeof getSelectedUnitPatchId === 'function') ? getSelectedUnitPatchId() : null;
      if(selectedUnitPatchId && isPatchAuthorizedForUniform(selectedUnitPatchId)){
        plannedIds.push(selectedUnitPatchId);
      }

      (ids || []).forEach(rawId => {
        const id = window.capubResolvePatchIdForUniform(rawId);
        if(id && id !== selectedUnitPatchId && !plannedIds.includes(id)) plannedIds.push(id);
      });

      for(const id of plannedIds){
        if(FIELD_BASE_BUILT_IN_PATCH_IDS.has(id)) continue;
        const meta = PATCH_META[id];
        if(!meta) continue;
        if(!isPatchAuthorizedForUniform(id)) continue;

        const hint = meta.slotHint || 'L_SHOULDER';
        const cap = capsPerUniform[hint] ?? 0;
        if(cap === 0) continue;
        if(patchSlots[hint].length >= cap) continue;
        patchSlots[hint].push(id);
      }
    };

    // Rebuild UI/render once the hotfix is loaded.
    capubSyncPatchVariantSelectionsForUniform();
    if(typeof buildUnitPatchSelector === 'function') buildUnitPatchSelector(by('unitPatchSearch')?.value || '');
    if(typeof buildPatchGallery === 'function') buildPatchGallery();
    if(typeof fullRender === 'function') fullRender();

    console.info('CAPUB hotfix loaded: PJOC variant resolver, TN-330 unit patch, comms alternate cleanup.');
  }catch(err){
    console.error('CAPUB hotfix failed', err);
  }
})();



/* ==========================================================
   CAPUB PATCH — Community Service Ribbon through 4,800 hours
   Requires these files in images/ribbons/:
   commun01.png, commun02.png, commun03.png, commun04.png,
   commun05.png, commun06.png, commun07.png, commun08.png,
   commun09.png, commun11.png, commun12.png, commun13.png,
   commun16.png, commun17.png, commun21.png
   ========================================================== */
(function capubCommunityService4800Patch(){
  try{
    const COMMUNITY_RIBBON_ID = 'community_service_ribbon';
    const HOURS_PER_AWARD = 60;
    const MAX_COMMUNITY_HOURS = 4800;

    // Each number is the TOTAL number of 60-hour awards represented by one
    // physical ribbon. The image already contains the correct clasps.
    const COMMUNITY_IMAGE_BY_AWARDS = Object.freeze({
      1:  'commun01.png', // Basic ribbon
      2:  'commun02.png', // 1 bronze
      3:  'commun03.png', // 2 bronze
      4:  'commun04.png', // 3 bronze
      5:  'commun05.png', // 4 bronze
      6:  'commun06.png', // 1 silver
      7:  'commun07.png', // 1 silver + 1 bronze
      8:  'commun08.png', // 1 silver + 2 bronze
      9:  'commun09.png', // 1 silver + 3 bronze
      11: 'commun11.png', // 2 silver
      12: 'commun12.png', // 2 silver + 1 bronze
      13: 'commun13.png', // 2 silver + 2 bronze
      16: 'commun16.png', // 3 silver
      17: 'commun17.png', // 3 silver + 1 bronze
      21: 'commun21.png'  // 4 silver — full ribbon
    });

    // Highest-device ribbon first. A ribbon with fewer devices follows it at
    // lower precedence. Greedy decomposition also produces the fewest ribbons
    // for every supported total under these device rules.
    const COMMUNITY_VALID_AWARD_COUNTS = Object.freeze(
      Object.keys(COMMUNITY_IMAGE_BY_AWARDS)
        .map(Number)
        .sort((a,b) => b-a)
    );

    function splitCommunityAwards(totalAwards){
      let remaining = Math.max(1, Math.floor(Number(totalAwards) || 1));
      const ribbons = [];

      while(remaining > 0){
        const awardCount = COMMUNITY_VALID_AWARD_COUNTS.find(value => value <= remaining);
        if(!awardCount){
          throw new Error(`Unable to represent ${totalAwards} Community Service awards.`);
        }
        ribbons.push(awardCount);
        remaining -= awardCount;
      }

      return ribbons;
    }

    function makeCommunityOption(hours){
      const totalAwards = Math.floor(hours / HOURS_PER_AWARD);
      const ribbonAwardCounts = splitCommunityAwards(totalAwards);
      const [primaryAwards, ...lowerPrecedenceAwards] = ribbonAwardCounts;
      const ribbonCountText = ribbonAwardCounts.length > 1
        ? ` / ${ribbonAwardCounts.length} Ribbons`
        : '';

      return {
        label: `${hours.toLocaleString()} Hours${ribbonCountText}`,
        value: `hours_${hours}`,
        image: COMMUNITY_IMAGE_BY_AWARDS[primaryAwards],
        devices: {},
        duplicates: lowerPrecedenceAwards.map((awardCount, index) => ({
          image: COMMUNITY_IMAGE_BY_AWARDS[awardCount],
          awardLabel: `Additional Community Service Ribbon ${index + 2}`
        }))
      };
    }

    const communityOptions = [];
    for(let hours = HOURS_PER_AWARD; hours <= MAX_COMMUNITY_HOURS; hours += HOURS_PER_AWARD){
      communityOptions.push(makeCommunityOption(hours));
    }

    // Replace the old limited option set. ribbonImageOptionList() will add the
    // "- Select -" entry automatically.
    RIBBON_SPECIAL_IMAGE_OPTIONS[COMMUNITY_RIBBON_ID] = communityOptions;

    // Preserve selections created by the previous Community Service menu.
    const legacyValueToHours = {
      earned: 60,
      hours_60: 60,
      bronze_clasp_1: 120,
      bronze_clasp_2: 180,
      bronze_clasp_3: 240,
      bronze_clasp_4: 300,
      silver_clasp_1: 360,
      silver_clasp_1_bronze_clasp_1: 420,
      silver_clasp_1_bronze_clasp_2: 480,
      silver_clasp_1_bronze_clasp_3: 540,
      silver_clasp_2: 660,
      silver_clasp_2_bronze_clasp_1: 720,
      silver_clasp_2_bronze_clasp_2: 780,
      silver_clasp_3: 960,
      silver_clasp_3_bronze_clasp_1: 1020,
      silver_clasp_4: 1260
    };

    const existingSelection = State.ribbonSelections?.[COMMUNITY_RIBBON_ID];
    if(existingSelection?.checked){
      const oldValue = String(existingSelection.awardValue || '');
      const directHoursMatch = oldValue.match(/^hours_(\d+)$/);
      const migratedHours = directHoursMatch
        ? Number(directHoursMatch[1])
        : legacyValueToHours[oldValue];

      if(migratedHours){
        const safeHours = Math.max(
          HOURS_PER_AWARD,
          Math.min(MAX_COMMUNITY_HOURS, Math.floor(migratedHours / HOURS_PER_AWARD) * HOURS_PER_AWARD)
        );
        applyRibbonSelectionValue(COMMUNITY_RIBBON_ID, `hours_${safeHours}`);
      }
    }

    // Member-report import counts each Community Service Ribbon record as one
    // 60-hour award. Return the new hour-based value used by this patch.
    chooseCommunityServiceValue = function capubChooseCommunityServiceValue(count){
      const awards = Math.max(1, Math.min(
        MAX_COMMUNITY_HOURS / HOURS_PER_AWARD,
        Math.floor(Number(count) || 1)
      ));
      return `hours_${awards * HOURS_PER_AWARD}`;
    };

    // Rebuild the selector and rack so the patch takes effect immediately even
    // when pasted at the bottom of the existing script.
    if(typeof buildRibbonGallery === 'function') buildRibbonGallery();
    if(typeof rebuildRibbonsFromGallery === 'function') rebuildRibbonsFromGallery();
    else if(typeof fullRender === 'function') fullRender();

    // Optional console helpers for testing.
    window.CAPUB_COMMUNITY_SERVICE_PATCH = {
      maxHours: MAX_COMMUNITY_HOURS,
      splitAwards: splitCommunityAwards,
      optionForHours(hours){
        const normalized = Math.max(
          HOURS_PER_AWARD,
          Math.min(MAX_COMMUNITY_HOURS, Math.floor(Number(hours) / HOURS_PER_AWARD) * HOURS_PER_AWARD)
        );
        return makeCommunityOption(normalized);
      }
    };

    console.info('CAPUB Community Service Ribbon patch loaded: 60–4,800 hours.');
  }catch(err){
    console.error('CAPUB Community Service Ribbon patch failed to load', err);
  }
})();
