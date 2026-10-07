'use strict';
const fs = require('node:fs');
const {chromium} = require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CAPUB_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 if(!process.env.CAPUB_URL) await require('./local-preview-route.cjs')(page);
 const errors=[]; page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(process.env.CAPUB_URL || 'http://127.0.0.1:8765/',{waitUntil:'networkidle'});
 const cases=await page.evaluate(()=>['senior','cadet'].flatMap(membership=>['male','female'].flatMap(gender=>Object.keys(UNIFORMS).filter(u=>isUniformAllowedFor(u,membership)).flatMap(uniform=>RANKS[membership].map(rank=>({membership,gender,uniform,rank}))))));
 const results=[];
 fs.mkdirSync('reports/uniform-render',{recursive:true});
 for(const c of cases){
  await page.evaluate(c=>{Object.assign(State,c,{organization:'CAP',ribbons:[],badges:[],patches:[],militaryAwards:{},militaryBadges:{}});refreshUI();fullRender();},c);
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await page.waitForFunction(()=>{
   const jacket=document.querySelector('#uniformCanvas img.jacket');
   return jacket?.complete && jacket.naturalWidth>0 && [...document.querySelectorAll('#uniformCanvas img')].every(i=>i.complete && i.naturalWidth>0);
  },null,{timeout:10000}).catch(()=>{});
  results.push(await page.evaluate(c=>({ ...c, candidates:getBaseCandidates(),images:[...document.querySelectorAll('#uniformCanvas img')].map(i=>({src:i.src.startsWith('data:')?'[composed PNG]':i.getAttribute('src'),ok:i.naturalWidth>0,width:i.width,height:i.height,class:i.className})),text:document.querySelector('#uniformCanvas').innerText}),c));
  if(c.rank==='Capt' || c.rank==='C/Col') await page.locator('#uniformCanvas').screenshot({path:`reports/uniform-render/${c.membership}-${c.gender}-${c.uniform}.png`});
 }
 const optionResults=[];
 for(const c of cases.filter(c=>c.rank==='Capt' || c.rank==='C/Col')){
  const options=await page.evaluate(c=>{
   Object.assign(State,c,{organization:'CAP'});
   return [...getEligibleBadgeIdsForMembership().map(id=>({kind:'badge',id})),...patchList.filter(id=>isPatchAuthorizedForUniform(id,c.uniform,c.membership)).map(id=>({kind:'patch',id})),{kind:'ribbons',id:'basic'},{kind:'ribbons',id:'maximum'}];
  },c);
  for(const option of options){
   await page.evaluate(({c,option})=>{
    Object.assign(State,c,{ribbons:[],badges:[],patches:[],ribbonSelections:{},badgeSelections:{},patchSelections:{}});
    if(option.kind==='badge') State.badges=[option.id];
    if(option.kind==='patch') State.patches=[option.id];
    if(option.kind==='ribbons') selectAllCapUniformAwards({maximum:option.id==='maximum'});
    fullRender();
   },{c,option});
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   await page.waitForFunction(()=>[...document.querySelectorAll('#uniformCanvas img')].every(i=>i.complete && (i.naturalWidth>0 || i.dataset.missing==='true')),null,{timeout:5000}).catch(()=>{});
   optionResults.push(await page.evaluate(({c,option})=>({ ...c,...option,broken:[...document.querySelectorAll('#uniformCanvas img')].filter(i=>!i.naturalWidth).map(i=>i.getAttribute('src')),layers:document.querySelectorAll('#uniformCanvas .layer').length}),{c,option}));
  }
  console.log(`Checked options for ${c.membership}/${c.gender}/${c.uniform}: ${optionResults.length}`);
 }
 const report={cases:results.length,optionCases:optionResults.length,errors,broken:results.filter(r=>r.images.some(i=>!i.ok)),optionFailures:optionResults.filter(r=>r.broken.length),results,optionResults};
 fs.writeFileSync('reports/uniform-render-audit.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({cases:report.cases,optionCases:report.optionCases,errors,broken:report.broken,optionFailures:report.optionFailures},null,2));
 if(errors.length || report.broken.length || report.optionFailures.length) process.exitCode=1;
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
