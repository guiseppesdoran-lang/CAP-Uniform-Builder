(function memberReportRulesModule(root, factory){
  const api=factory();
  if(typeof module === 'object' && module.exports) module.exports=api;
  if(root) root.CAPUBMemberReportRules=Object.assign(root.CAPUBMemberReportRules || {},api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function(){
  'use strict';

  const DATE_RE=/\b(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{4})\b/gi;
  const MONTHS={jan:0,january:0,feb:1,february:1,mar:2,march:2,apr:3,april:3,may:4,jun:5,june:5,jul:6,july:6,aug:7,august:7,sep:8,sept:8,september:8,oct:9,october:9,nov:10,november:10,dec:11,december:11};
  const END_HEADINGS=[
    'Current Committees','Past National Staff Appointments','Transfer History',
    'Current Duty Positions','Past Duty Positions','Professional Development',
    'Awards','Local Activities'
  ];

  function normalize(value){ return String(value || '').replace(/\s+/g,' ').trim(); }

  function parseDate(value){
    const match=String(value || '').match(new RegExp(DATE_RE.source,'i'));
    if(!match) return null;
    const month=MONTHS[match[2].toLowerCase()];
    const date=new Date(Date.UTC(Number(match[3]),month,Number(match[1])));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function hasFullCalendarYear(start,end){
    if(!(start instanceof Date) || !(end instanceof Date)) return false;
    const anniversary=new Date(start.getTime());
    anniversary.setUTCFullYear(anniversary.getUTCFullYear()+1);
    return end.getTime() >= anniversary.getTime();
  }

  function sectionAfterHeading(text,heading,{rejectPrefix=''}={}){
    const source=normalize(text);
    const re=new RegExp(heading,'ig');
    let match;
    while((match=re.exec(source))){
      const prefix=source.slice(Math.max(0,match.index-rejectPrefix.length-1),match.index).trimEnd();
      if(rejectPrefix && prefix.toLowerCase().endsWith(rejectPrefix.toLowerCase())) continue;
      const start=match.index+match[0].length;
      let end=source.length;
      for(const label of END_HEADINGS){
        const index=source.slice(start).search(new RegExp(`\\b${label}\\b`,'i'));
        if(index >= 0) end=Math.min(end,start+index);
      }
      return source.slice(start,end).trim();
    }
    return '';
  }

  function datesIn(value){
    return [...String(value || '').matchAll(new RegExp(DATE_RE.source,'gi'))]
      .map(match=>parseDate(match[0])).filter(Boolean);
  }

  function evaluateNationalStaffEligibility(text){
    const source=normalize(text);
    if(/\bNational\s+Staff\s+Badge\b/i.test(source)){
      return {eligible:true,reason:'EXPLICIT_BADGE',currentAppointments:0,qualifyingPastAppointments:0};
    }

    const current=sectionAfterHeading(source,'National Staff Appointments',{rejectPrefix:'Past'});
    const currentDates=datesIn(current);
    if(currentDates.length){
      return {eligible:true,reason:'CURRENT_APPOINTMENT',currentAppointments:currentDates.length,qualifyingPastAppointments:0};
    }

    const past=sectionAfterHeading(source,'Past National Staff Appointments');
    const dates=datesIn(past);
    let qualifyingPastAppointments=0;
    for(let index=0;index+1<dates.length;index+=2){
      if(hasFullCalendarYear(dates[index],dates[index+1])) qualifyingPastAppointments++;
    }
    return {
      eligible:qualifyingPastAppointments>0,
      reason:qualifyingPastAppointments ? 'PAST_APPOINTMENT_ONE_CALENDAR_YEAR' : (dates.length ? 'PAST_APPOINTMENT_TOO_SHORT' : 'NOT_LISTED'),
      currentAppointments:0,
      qualifyingPastAppointments
    };
  }

  return {parseDate,hasFullCalendarYear,evaluateNationalStaffEligibility};
});
