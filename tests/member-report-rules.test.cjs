'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
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
function loadPageScripts(){
  const ROOT=path.join(__dirname,'..');
  const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
  const sources=[...html.matchAll(/<script src="([^"?]+)(?:\?[^"]*)?"/g)].map(m=>m[1]).filter(src=>!/^https?:/.test(src));
  const element=()=>new Proxy(function(){},{
    get(_t,key){
      if(key==='style'||key==='dataset'||key==='classList') return new Proxy({},{get:()=>()=>{},set:()=>true});
      if(key==='children'||key==='childNodes') return [];
      if(key==='length') return 0;
      if(['value','innerHTML','textContent','id','className'].includes(key)||key===Symbol.toPrimitive) return key===Symbol.toPrimitive?()=>'':'';
      return element();
    },
    set:()=>true,
    apply:()=>element()
  });
  const document=new Proxy({},{get:(_t,key)=>(key==='querySelectorAll'||key==='getElementsByClassName')?()=>[]:element()});
  const noop=()=>{};
  const storage={getItem:()=>null,setItem:noop,removeItem:noop};
  const context={
    document,navigator:{userAgent:''},location:{href:'',search:'',hash:''},localStorage:storage,sessionStorage:storage,
    console:{log:noop,warn:noop,error:noop,info:noop},setTimeout:()=>0,clearTimeout:noop,setInterval:()=>0,addEventListener:noop,
    matchMedia:()=>({matches:false,addEventListener:noop,addListener:noop}),requestAnimationFrame:()=>0,
    fetch:()=>Promise.reject(new Error('offline')),URL,URLSearchParams,Image:function(){},CustomEvent:function(){},Event:function(){},
    MutationObserver:function(){this.observe=noop},ResizeObserver:function(){this.observe=noop}
  };
  context.window=context;context.self=context;context.globalThis=context;
  vm.createContext(context);
  const referenceErrors=[];
  for(const src of sources){
    try{ vm.runInContext(fs.readFileSync(path.join(ROOT,src),'utf8'),context,{filename:src}); }
    catch(error){ if(error?.name==='ReferenceError') referenceErrors.push(src+': '+error.message); }
  }
  return {context,referenceErrors};
}

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
