'use strict';
const fs=require('node:fs');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CAPUB_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 await require('./local-preview-route.cjs')(page);
 await page.goto('http://127.0.0.1:8765/',{waitUntil:'networkidle'});
 fs.mkdirSync('reports/uniform-render',{recursive:true});
 for(const gender of ['male','female'])for(const uniform of ['blues_a','blues_b','ocp']){
  await page.evaluate(({gender,uniform})=>{
   Object.assign(State,{organization:'CAP',membership:'senior',rank:'Capt',gender,uniform,ribbonSelections:{},militaryBadges:{},ribbons:['cap_achievment_award','commander_commendation_award','meritorious_service_award','lifesaving_award','unit_citation_award','national_commander_unit_citation_award'].map(id=>({id,devices:{}})),badges:['pilot_badge','senior_ground_team_badge','communications_technician_badge'],patches:uniform==='ocp'?['nywg_patch']:[]});
   refreshUI();fullRender();
  },{gender,uniform});
  await page.waitForFunction(()=>[...document.querySelectorAll('#uniformCanvas img')].every(i=>i.complete && (i.naturalWidth>0 || i.dataset.missing==='true')));
  await page.locator('#uniformCanvas').screenshot({path:`reports/uniform-render/sample-${gender}-${uniform}.png`});
 }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
