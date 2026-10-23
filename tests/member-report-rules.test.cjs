'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {evaluateNationalStaffEligibility,hasFullCalendarYear,parseDate}=require('../member-report-rules.js');

test('current National Staff appointment authorizes the badge',()=>{
  const result=evaluateNationalStaffEligibility('National Staff Appointments Appointment Date Assigned Staff Member, Commander\'s Action Group 01 Apr 2025 Current Committees');
  assert.equal(result.eligible,true);
  assert.equal(result.reason,'CURRENT_APPOINTMENT');
});

test('past National Staff appointment retained after one calendar year',()=>{
  const result=evaluateNationalStaffEligibility('Past National Staff Appointments Appointment Date Assigned End Date National Recruiting Specialist 16 Feb 2022 01 Apr 2024 Current Committees');
  assert.equal(result.eligible,true);
  assert.equal(result.reason,'PAST_APPOINTMENT_ONE_CALENDAR_YEAR');
});

test('past National Staff appointment shorter than one calendar year is rejected',()=>{
  const result=evaluateNationalStaffEligibility('Past National Staff Appointments Appointment Date Assigned End Date Staff Member 01 Apr 2025 31 Mar 2026 Current Committees');
  assert.equal(result.eligible,false);
  assert.equal(result.reason,'PAST_APPOINTMENT_TOO_SHORT');
});

test('calendar-year comparison handles leap years',()=>{
  assert.equal(hasFullCalendarYear(parseDate('29 Feb 2024'),parseDate('01 Mar 2025')),true);
  assert.equal(hasFullCalendarYear(parseDate('01 Mar 2024'),parseDate('28 Feb 2025')),false);
});

test('explicit badge entry still authorizes the badge',()=>{
  assert.equal(evaluateNationalStaffEligibility('Awards National Staff Badge').reason,'EXPLICIT_BADGE');
});

test('local activity wording does not authorize without an appointment section',()=>{
  assert.equal(evaluateNationalStaffEligibility('Local Activities National Staff conference').eligible,false);
});

// The importer is classic-script code that shares one global scope with the rest of the page, so
// the whole import path (js/member-report-import.js calling js/patches.js) is exercised by loading
// the page's scripts, in index.html order, into one vm context behind a permissive DOM stub.
const {loadPageScripts}=require('./helpers/page-scripts.cjs');

const COMMANDER_REPORT=[
  'SMITH, JANE MALE SENIOR MEMBER Capt',
  'Current Duty Positions Duty Position Unit Echelon Asst Start Date End Date',
  'Squadron Commander GLR-IL-049 UNIT No 01 Jan 2023',
  'Past Duty Positions Duty Position Unit Echelon Asst Start Date End Date',
  'Commander GLR-IL-049 UNIT No 01 Jan 2018 31 Dec 2020',
  'Deputy Commander GLR-IL-049 UNIT Yes 01 Jan 2016 31 Dec 2017',
  'Current Committees'
].join(' ');

test('importing a report with a commander duty title runs end to end (capubIsExactCommanderDutyTitle)',()=>{
  const {context,referenceErrors}=loadPageScripts();
  assert.deepEqual(referenceErrors,[]);
  assert.equal(context.capubIsExactCommanderDutyTitle('Squadron Commander'),true);
  assert.equal(context.capubIsExactCommanderDutyTitle("Wing  Commander"),true);
  assert.equal(context.capubIsExactCommanderDutyTitle('Deputy Commander'),false);
  assert.equal(context.capubIsExactCommanderDutyTitle('Cadet Commander'),false);
  assert.equal(context.capubIsExactCommanderDutyTitle('Command Council'),false);

  const parsed=context.parseCapMemberReport(COMMANDER_REPORT);
  assert.equal(parsed.membership,'senior');
  assert.equal(parsed.rank,'Capt');
  assert.ok(parsed.badges.includes('squadron_commander_badge'),'current commander imports the Command Insignia Pin');
  assert.ok(parsed.ribbons.some(r=>r.id==='cap_command_service_ribbon'),'a 365-day commander tour imports the Command Service Ribbon');
  assert.equal(context.hasCurrentCommanderDutyPosition(COMMANDER_REPORT),true);
  assert.equal(context.hasGraduatedCommanderDutyPosition(COMMANDER_REPORT),true);
});

test('a Deputy Commander row is not read as a commander duty',()=>{
  const {context}=loadPageScripts();
  const deputy='Current Duty Positions Duty Position Unit Echelon Asst Start Date End Date Deputy Commander GLR-IL-049 UNIT Yes 01 Jan 2023 Past Duty Positions';
  assert.deepEqual(Array.from(context.capubExtractCommanderDutyWindows('Deputy Commander GLR-IL-049 UNIT Yes 01 Jan 2016 31 Dec 2017')),[]);
  assert.equal(context.hasCurrentCommanderDutyPosition(deputy),false);
  const parsed=context.parseCapMemberReport('SMITH, JANE MALE SENIOR MEMBER Capt '+deputy);
  assert.ok(!parsed.badges.includes('squadron_commander_badge'));
});
