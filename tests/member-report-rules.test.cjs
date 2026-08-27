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
