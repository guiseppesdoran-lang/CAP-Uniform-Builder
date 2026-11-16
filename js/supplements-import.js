// The member report import and the supplements (js/supplements.js, data/supplements.js).
//
// The report's unit (the Unit column of the General Information row, which js/patches.js already reads into the unit patch) is the unit whose supplements load. The
// report's own rows can then show that a cord was earned: a school or activity row for the graduate cords (a Region Cadet Leadership School, a Noncommissioned Officer
// Leadership School, a wing's academy) and a current duty row, "Cadet Commander", for the cadet commander cords of Maryland, Maine and North Carolina. A cord whose condition
// no row of a report shows (a cadet of the month, a grade point average, a competition) is simply offered, never marked. A cord found is marked "earned" and listed first in
// the cord picker; the import chooses one itself only when exactly one is earned, the Cadet Advisory Council cord has not been chosen, and the cord is not one worn only at
// an activity. The notes the import leaves say what it did. A report is read on the member's device and nothing of it is kept but these marks.
//
// This wraps parseCapMemberReport and applyCapMemberReportImport the way js/patches.js wraps them for the council cord, so it loads after js/patches.js.
(function capubSupplementsImport(){
  'use strict';
  if(typeof parseCapMemberReport !== 'function' || typeof applyCapMemberReportImport !== 'function' || typeof window === 'undefined' || !window.Supplements) return;

  const DATE = '\\d{1,2}\\s+[A-Za-z]{3,9}\\s+\\d{4}';
  const AFTER_TRAINING = ['Encampments', 'Orientation\\s+Flights', 'Cadet\\s+Achievements', 'Awards', 'Promotions', 'Decorations', 'Activity\\s*/\\s*Service\\s+Ribbon', 'Local\\s+Activities'];

  // The rows of the report's school and activity tables (Professional Development, Cadet Training, Local Activities): each ends with its date, the text before it is its name.
  // They are read from the report as it was given, with its lines: the cleaned text (normalizeMemberReportText) is one line.
  function activityRows(text){
    const sections = [
      getReportSectionUntilAny(text, 'Professional\\s+Development', ['Specialty\\s+Tracks', 'Cadet\\s+Training', ...AFTER_TRAINING]),
      getReportSectionUntilAny(text, 'Cadet\\s+Training', AFTER_TRAINING),
      getReportSectionUntilAny(text, 'Local\\s+Activities', [])
    ];
    const rows = [];
    for(const section of sections){
      // One line a row where the text has its lines; where a PDF ran them together, a row ends at its date. A line with no date is no completed row.
      for(const line of String(section || '').split(/\r?\n/)){
        const flat = line.replace(/\s+/g, ' ').trim();
        if(!flat) continue;
        for(const row of flat.split(new RegExp(`(?<=\\b${DATE})\\s+`))) if(new RegExp(DATE).test(row)) rows.push(row);
      }
    }
    return rows;
  }
  const matchesAny = (row, group) => group.some(source => new RegExp(source, 'i').test(row));

  // The current duty rows of the member, each as { title, unit, assistant, start, end }, for one exact title. The title is a cell of its own: "Encampment Cadet Commander" and
  // "Acting Cadet Commander" are other positions, and a row whose Asst column says Yes is an assistant's. A row with an end date that has passed is a past assignment.
  function currentDutyRows(text, title){
    const words = title.trim().split(/\s+/).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+');
    const rowRe = new RegExp(`\\b(${words})\\s+([A-Za-z]{2,4}-[A-Za-z0-9-]+|[A-Za-z0-9-]+)\\s+(UNIT|GROUP|WING|REGION|NATIONAL)\\s+(Yes|No)\\s+(${DATE})(?:\\s+(${DATE}))?`, 'gi');
    const rows = [], today = new Date();
    for(const section of [capubCurrentCadetDutySection(text), capubCurrentDutySection(text)]){
      const source = String(section || '').replace(/\s+/g, ' ').trim();
      let m;
      while(source && (m = rowRe.exec(source))){
        if(!/(?:\b\d{4}|End\s+Date|Duty\s+(?:Positions|Assignments))\s*$/i.test(source.slice(0, m.index))) continue;
        if(/^yes$/i.test(m[4])) continue;
        const row = { title: m[1], unit: m[2], assistant: m[4], start: parseCapReportDate(m[5]), end: parseCapReportDate(m[6]) };
        if(row.end && row.end <= today) continue;
        rows.push(row);
      }
    }
    return rows;
  }

  // The supplement cord ids a report shows were earned, for a cadet of this unit.
  function earnedCords(textRaw, unitCode, membership){
    if(membership !== 'cadet') return [];
    const text = normalizeMemberReportText(textRaw);
    const found = [], rows = activityRows(textRaw), unit = Supplements.parseUnit(unitCode);
    for(const entry of Supplements.entries(unitCode)){
      for(const item of entry.items){
        if(item.kind !== 'cord' || !item.earned) continue;
        const how = item.earned;
        if(how.source === 'activity'){
          const ok = how.rowAllOf ? rows.some(row => how.rowAllOf.every(group => matchesAny(row, group)))
            : how.rowsAllOf ? how.rowsAllOf.every(group => rows.some(row => matchesAny(row, group))) : false;
          if(ok) found.push(item.id);
        }else if(how.source === 'duty'){
          // The row is a unit of the cord's own wing (a Maryland cord for a Maryland unit), where the row names a unit that can be read.
          const ok = currentDutyRows(text, how.title).some(row => {
            const rowUnit = Supplements.parseUnit(row.unit);
            return !rowUnit || !entry.code || entry.kind !== 'wing' || rowUnit.wing === entry.code;
          });
          if(ok && unit) found.push(item.id);
        }
      }
    }
    return [...new Set(found)];
  }

  const nameList = names => names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : (names[0] || '');
  const spokenUnit = code => (typeof getUnitPatchSpokenName === 'function' ? getUnitPatchSpokenName(code) : code);

  const previousParse = parseCapMemberReport;
  parseCapMemberReport = function capubParseCapMemberReportSupplements(textRaw){
    const result = previousParse(textRaw);
    result.notes = result.notes || [];
    result.supplementCordsEarned = [];
    const unit = result.unitPatchCharter || '';
    const entries = unit ? Supplements.entries(unit) : [];
    if(!entries.length) return result;
    result.notes.push(`Supplements: ${spokenUnit(unit)} brings in ${nameList(entries.map(e => e.name))}.`);
    if(result.membership !== 'cadet') return result;
    const earned = earnedCords(textRaw, unit, result.membership);
    result.supplementCordsEarned = earned;
    const offered = Supplements.cords({ membership: 'cadet', unitPatchCharter: unit });
    if(earned.length) result.notes.push(`Shoulder cords: the report shows ${nameList(earned.map(id => { const c = offered.find(x => x.id === id); return c ? `${c.label} (${c.group})` : id; }))}. Marked as found in your report in the cord list.`);
    if(offered.some(c => !earned.includes(c.id) && entries.some(e => e.items.some(i => i.id === c.id && i.earned && i.earned.source === 'none')))){
      result.notes.push('Shoulder cords: the other cords of these supplements depend on awards, offices or grades that a report does not list, so they are offered without a mark.');
    }
    return result;
  };

  const previousApply = applyCapMemberReportImport;
  applyCapMemberReportImport = function capubApplyCapMemberReportImportSupplements(parsed){
    const out = previousApply(parsed);
    try{
      const earned = Array.isArray(parsed && parsed.supplementCordsEarned) ? parsed.supplementCordsEarned.slice() : [];
      State.supplementCordsEarned = earned;
      parsed.notes = parsed.notes || [];
      if(earned.length && State.membership === 'cadet'){
        const offered = Supplements.cords(State), only = earned.length === 1 ? offered.find(c => c.id === earned[0]) : null;
        if(earned.length > 1) parsed.notes.push('Shoulder cords: more than one supplement cord is shown, so none is chosen for you. Choose one under Shoulder cord.');
        else if(only && State.shoulderCord) parsed.notes.push(`Shoulder cords: the Cadet Advisory Council cord from the report is chosen, so the ${only.label} cord is marked and not chosen.`);
        else if(only && only.limitedToActivity) parsed.notes.push(`Shoulder cords: the ${only.label} cord is worn only at its activity, so it is marked and not chosen.`);
        else if(only){
          State.shoulderCord = only.id;
          parsed.notes.push(`Shoulder cords: the ${only.label} cord (${only.group}) is chosen, the only supplement cord the report shows.`);
        }
      }
      // The import replaced the member's patches: the wing's patch a supplement requires on this uniform is taken again.
      const before = (State.patches || []).length;
      if(Supplements.selectWingPatch() && (State.patches || []).length > before){
        const plan = Supplements.wingPatch(State);
        if(plan) parsed.notes.push(`The ${plan.label} patch, which a supplement requires on this uniform, is chosen. You can take it off under Supplements.`);
      }
      if(typeof syncShoulderCordControl === 'function') syncShoulderCordControl();
      Supplements.refresh();
      if(typeof fullRender === 'function') fullRender();
    }catch(err){
      console.warn('Supplements import failed', err);
    }
    return out;
  };

  window.CAPUBSupplementsImport = { earnedCords, activityRows, currentDutyRows };
})();
