'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});try{
 const p=await browser.newPage();await require('./local-preview-route.cjs')(p);const errors=[];p.on('pageerror',e=>errors.push(String(e)));
 await p.goto('http://127.0.0.1:8765/',{waitUntil:'networkidle'});
 for(const uniform of ['corporate_field','flight_suit','polo','aviator_blazer','semi_formal']){
 await p.evaluate(uniform=>{Object.assign(State,{organization:'CAP',membership:'senior',gender:'male',rank:'Capt',uniform,ribbons:[],badges:[],patches:[],text:{show:true,lastName:'TEST'}});refreshUI();fullRender();},uniform);
 await p.waitForFunction(()=>[...document.querySelectorAll('#uniformCanvas img')].every(i=>i.complete&&i.naturalWidth));
 await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 await p.waitForFunction(()=>[...document.querySelectorAll('#uniformCanvas img')].every(i=>i.complete&&i.naturalWidth));
 const result=await p.evaluate(()=>({uniform:State.uniform,completion:!!window.CAPUBCompletion,source:getBaseCandidates()[0],foreground:uniformCanvas.querySelectorAll('.garmentForegroundOverlay').length,grades:uniformCanvas.querySelectorAll('.capubGrade').length,labels:uniformCanvas.querySelectorAll('.nameplate').length,broken:[...uniformCanvas.querySelectorAll('img')].filter(i=>!i.naturalWidth).length}));
 console.log(JSON.stringify(result));
 assert.equal(result.completion,true);assert.match(result.source,/base\/capr39-1\//);assert.equal(result.foreground,0);assert.equal(result.broken,0);if(uniform!=='semi_formal')assert.ok(result.labels>0);
 if(['corporate_field','flight_suit'].includes(uniform))assert.ok(result.grades>=2);
 const exported=await p.evaluate(async()=>{const canvas=await composeUniformPngCanvas(uniformCanvas,1);return {width:canvas.width,height:canvas.height,png:canvas.toDataURL('image/png').slice(0,22)};});
 assert.ok(exported.width>0&&exported.height>0);assert.equal(exported.png,'data:image/png;base64,');
 await p.evaluate(()=>{State.ribbons=[{id:'cap_achievment_award',devices:{}}];State.forceMini=true;renderRack();});
 if(uniform!=='semi_formal')assert.equal(await p.locator('#uniformCanvas .ribbonTile,#uniformCanvas .ribbonMini').count(),0);
 else assert.ok(await p.locator('#uniformCanvas .ribbonMini').count()>0);
 }
 if(errors.length)throw Error(errors.join('\n'));
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
