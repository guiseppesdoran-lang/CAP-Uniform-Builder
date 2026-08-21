/* CAP Uniform Builder — shared admin generation history
   Mirrors generated-uniform configurations to the configured Apps Script
   service while retaining this browser's 24-hour local fallback.
*/
(function(){
  'use strict';

  const HISTORY_KEY='CAPUB_ADMIN_HISTORY_V1';
  const CLOUD_MIGRATION_KEY='CAPUB_ADMIN_HISTORY_CLOUD_MIGRATED_V1';
  const ADMIN_SESSION_KEY='CAPUB_ADMIN_AUTH_V1';
  const RETENTION_MS=24*60*60*1000;
  const CLOUD_TIMEOUT_MS=20000;
  const ADMIN_SHA256='9b5360d36c9f81953ef2c605aba3c2b85563f74f8ee8986b6555f8f482cb89df';
  let adminOpen=false;
  let adminPassword='';
  let cloudRecords=[];
  let cloudState='idle';
  let cloudError='';

  const by=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  const fmt=d=>{ try{return new Date(d).toLocaleString();}catch(_){return String(d||'');} };
  const clone=o=>JSON.parse(JSON.stringify(o));
  const endpoint=()=>String(window.CAPUB_PATCH_SUBMISSION_ENDPOINT||'').trim();

  function readHistory(){
    try{
      const parsed=JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]');
      return Array.isArray(parsed)?parsed:[];
    }catch(_){ return []; }
  }

  function writeHistory(records){
    try{
      localStorage.setItem(HISTORY_KEY,JSON.stringify(records));
      return true;
    }catch(err){
      console.warn('CAPUB history storage failed',err);
      alert('Uniform history storage is full in this browser. Export or delete older history entries.');
      return false;
    }
  }

  function cleanupHistory(){
    const now=Date.now();
    const before=readHistory();
    const after=before.filter(r=>r?.saved || !r?.expiresAt || new Date(r.expiresAt).getTime()>now);
    if(after.length!==before.length) writeHistory(after);
    return after;
  }

  function mergedHistory(){
    const records=new Map();
    cleanupHistory().forEach(record=>records.set(record.id,{...record,_local:true}));
    cloudRecords.forEach(record=>records.set(record.id,{...(records.get(record.id)||{}),...record,_cloud:true}));
    return [...records.values()].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,500);
  }

  function makeId(){
    return globalThis.crypto?.randomUUID?.() || `capub-${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
  }

  function collectHistoryProfile(){
    let profile=null;
    try{ if(typeof collectProfile==='function') profile=collectProfile(); }catch(_){ }
    if(!profile && globalThis.State){
      try{ profile=clone(globalThis.State); }catch(_){ profile=null; }
    }
    if(!profile) return null;
    profile=clone(profile);
    delete profile.calib;
    delete profile.coordinatesByUniform;
    delete profile.calibration;
    return profile;
  }

  function summarize(profile){
    return {
      membership:profile?.membership||'', gender:profile?.gender||'', uniform:profile?.uniform||'', rank:profile?.rank||'',
      ribbons:Array.isArray(profile?.ribbons)?profile.ribbons.length:0,
      badges:Array.isArray(profile?.badges)?profile.badges.length:0,
      patches:Array.isArray(profile?.patches)?profile.patches.length:0,
      shoulderCord:profile?.shoulderCord||''
    };
  }

  function cloudRequest(action,payload={},requiresAdmin=false){
    return new Promise((resolve,reject)=>{
      const url=endpoint();
      if(!url || /PASTE_|YOUR_|EXAMPLE/i.test(url)){
        reject(new Error('The shared history endpoint is not configured.'));
        return;
      }
      if(requiresAdmin && !adminPassword){ reject(new Error('Admin authentication is required.')); return; }

      const requestId=globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const data={action,requestId,...payload};
      if(requiresAdmin) data.adminPassword=adminPassword;
      const frame=document.createElement('iframe');
      const frameName=`capub_history_${requestId.replace(/[^a-z0-9]/gi,'')}`;
      frame.name=frameName; frame.title='Shared uniform history response'; frame.hidden=true;
      const form=document.createElement('form');
      form.method='POST'; form.action=url; form.target=frameName; form.hidden=true;
      const input=document.createElement('input');
      input.type='hidden'; input.name='payload'; input.value=JSON.stringify(data); form.appendChild(input);
      let settled=false;
      let timer;
      let responseTimer;
      let frameLoads=0;
      const cleanup=()=>{
        clearTimeout(timer);
        clearTimeout(responseTimer);
        window.removeEventListener('message',onMessage);
        setTimeout(()=>{form.remove();frame.remove();},100);
      };
      const finish=(callback,value)=>{if(settled)return;settled=true;cleanup();callback(value);};
      const onMessage=event=>{
        const response=event.data;
        if(!response || response.requestId!==requestId) return;
        if(response.source==='CAPUB_PATCH_SUBMISSION'){
          finish(reject,new Error('The Apps Script deployment must be updated to enable shared history.'));
          return;
        }
        if(response.source!=='CAPUB_ADMIN_HISTORY') return;
        if(response.ok) finish(resolve,response.data||{});
        else finish(reject,new Error(response.error||'The shared history service rejected the request.'));
      };
      window.addEventListener('message',onMessage);
      frame.addEventListener('load',()=>{
        frameLoads+=1;
        if(frameLoads<2||settled)return;
        responseTimer=setTimeout(()=>finish(resolve,{transportAcknowledged:true}),1500);
      });
      frame.addEventListener('error',()=>finish(reject,new Error('The shared history service could not be reached.')),{once:true});
      document.body.append(frame,form);
      timer=setTimeout(()=>finish(reject,new Error('The shared history service did not respond.')),CLOUD_TIMEOUT_MS);
      form.submit();
    });
  }

  async function createAdminProof(action,requestId){
    if(!adminPassword||!globalThis.crypto?.subtle) throw new Error('Secure admin authentication is unavailable in this browser.');
    const passwordHash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(adminPassword));
    const key=await crypto.subtle.importKey('raw',passwordHash,{name:'HMAC',hash:'SHA-256'},false,['sign']);
    const timestamp=String(Date.now());
    const nonce=globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const message=`${action}:${requestId}:${timestamp}:${nonce}`;
    const signature=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(message));
    const signatureHex=[...new Uint8Array(signature)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
    return {timestamp,nonce,signature:signatureHex};
  }

  async function cloudListRequest(){
    const url=endpoint();
    if(!url||/PASTE_|YOUR_|EXAMPLE/i.test(url)) throw new Error('The shared history endpoint is not configured.');
    const requestId=globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const callbackName=`capubHistoryCallback_${requestId.replace(/[^a-z0-9]/gi,'')}`;
    const proof=await createAdminProof('history_list',requestId);
    return new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      let settled=false;
      const cleanup=()=>{
        clearTimeout(timer);
        try{delete window[callbackName];}catch(_){window[callbackName]=undefined;}
        script.remove();
      };
      const finish=(callback,value)=>{if(settled)return;settled=true;cleanup();callback(value);};
      window[callbackName]=response=>{
        if(!response||response.requestId!==requestId)return;
        if(response.ok)finish(resolve,response.data||{});
        else finish(reject,new Error(response.error||'The shared history service rejected the request.'));
      };
      const query=new URLSearchParams({mode:'history_list',requestId,callback:callbackName,...proof});
      script.src=`${url}${url.includes('?')?'&':'?'}${query}`;
      script.async=true;
      script.onerror=()=>finish(reject,new Error('The shared history service could not be reached.'));
      const timer=setTimeout(()=>finish(reject,new Error('The shared history service did not respond.')),CLOUD_TIMEOUT_MS);
      document.head.appendChild(script);
    });
  }

  async function refreshCloudHistory(){
    cloudState='loading'; cloudError='';
    if(adminOpen) renderAdmin();
    try{
      const localRecords=cleanupHistory();
      const needsMigration=localRecords.length&&localStorage.getItem(CLOUD_MIGRATION_KEY)!=='1';
      if(needsMigration){
        await cloudRequest('history_import',{records:localRecords},true);
      }
      const result=await cloudListRequest();
      cloudRecords=Array.isArray(result.records)?result.records:[];
      if(needsMigration&&localRecords.every(local=>cloudRecords.some(shared=>shared.id===local.id))){
        localStorage.setItem(CLOUD_MIGRATION_KEY,'1');
      }
      cloudState='ready';
    }catch(err){
      cloudState='error'; cloudError=err?.message||String(err);
      console.warn('CAPUB shared history unavailable',err);
    }
    if(adminOpen) renderAdmin();
  }

  function recordGeneration(){
    const profile=collectHistoryProfile();
    if(!profile) return;
    const now=new Date();
    const record={
      id:makeId(), createdAt:now.toISOString(),
      expiresAt:new Date(now.getTime()+RETENTION_MS).toISOString(),
      saved:false, summary:summarize(profile), profile
    };
    const records=cleanupHistory();
    records.unshift(record);
    writeHistory(records.slice(0,500));
    cloudRequest('history_record',{record}).then(()=>{
      if(adminOpen) refreshCloudHistory();
    }).catch(err=>console.warn('Uniform saved locally; shared history upload failed',err));
    if(adminOpen) renderAdmin();
  }

  async function sha256(text){
    if(globalThis.crypto?.subtle){
      const bytes=new TextEncoder().encode(String(text));
      const digest=await crypto.subtle.digest('SHA-256',bytes);
      return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
    }
    return '';
  }

  async function authenticate(){
    if(adminPassword && sessionStorage.getItem(ADMIN_SESSION_KEY)==='1') return true;
    const password=prompt('Admin password');
    if(password===null) return false;
    const hash=await sha256(password);
    if(hash!==ADMIN_SHA256){ alert('Incorrect admin password.'); return false; }
    adminPassword=password;
    sessionStorage.setItem(ADMIN_SESSION_KEY,'1');
    return true;
  }

  function injectStyles(){
    if(by('capubAdminHistoryStyles')) return;
    const s=document.createElement('style');
    s.id='capubAdminHistoryStyles';
    s.textContent=`
      #capubAdminHistoryButton{position:fixed;right:12px;bottom:34px;z-index:9000;width:auto;min-width:64px;padding:6px 10px;font-size:11px;opacity:.62;background:#172033;color:#fff;border:1px solid #44506a;border-radius:8px}#capubAdminHistoryButton:hover{opacity:1}
      .capub-admin-overlay{position:fixed;inset:0;z-index:120000;background:rgba(0,0,0,.68);display:none;align-items:center;justify-content:center;padding:20px}.capub-admin-overlay.open{display:flex}
      .capub-admin-modal{width:min(1180px,97vw);max-height:94vh;display:flex;flex-direction:column;background:#fff;color:#172033;border-radius:14px;overflow:hidden;box-shadow:0 28px 90px rgba(0,0,0,.45)}
      .capub-admin-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;padding:16px 18px;border-bottom:1px solid #d9dee8;background:#f7f9fc}.capub-admin-head h2{margin:0 0 3px;font-size:20px}.capub-admin-sub{font-size:11px;color:#667085;line-height:1.35}.capub-admin-head button{width:auto;margin:0;padding:7px 10px}
      .capub-admin-toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:12px 18px;border-bottom:1px solid #e4e7ec;background:#fff}.capub-admin-toolbar input{width:min(360px,100%);margin:0}.capub-admin-toolbar button{width:auto;margin:0;padding:7px 10px}
      .capub-admin-body{overflow:auto;padding:14px 18px 20px}.capub-admin-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(310px,1fr));gap:12px}.capub-admin-card{border:1px solid #d8dee8;border-radius:10px;padding:12px;background:#fff;box-shadow:0 5px 16px rgba(0,0,0,.05)}.capub-admin-card.saved{border-color:#91b89f;background:#fbfffc}
      .capub-admin-title{font-weight:800;font-size:13px}.capub-admin-meta{font-size:11px;color:#5f6b7d;line-height:1.45;margin-top:5px}.capub-admin-stats{font-size:10px;color:#667085;margin:7px 0}.capub-admin-source{font-size:9px;font-weight:700;color:#41658a;margin-top:4px;text-transform:uppercase;letter-spacing:.04em}
      .capub-admin-actions{display:flex;gap:6px;flex-wrap:wrap}.capub-admin-actions button{width:auto;margin:0;padding:6px 8px;font-size:10px}.capub-admin-actions .danger{background:#8b1e1e;border-color:#8b1e1e}.capub-admin-actions .save{background:#1e6b42;border-color:#1e6b42}.capub-admin-empty{text-align:center;padding:40px;color:#667085}.capub-admin-note{font-size:10px;color:#667085;margin-bottom:10px;padding:8px 10px;background:#f8fafc;border:1px solid #e1e5eb;border-radius:8px}.capub-admin-note.error{background:#fff3f2;color:#8f1d1d;border-color:#f1b8b2}
    `;
    document.head.appendChild(s);
  }

  function ensureAdminUI(){
    injectStyles();
    if(!by('capubAdminHistoryButton')){
      const button=document.createElement('button');
      button.id='capubAdminHistoryButton'; button.type='button'; button.textContent='Admin'; button.title='Admin uniform generation history';
      document.body.appendChild(button);
      button.addEventListener('click',async()=>{if(await authenticate())openAdmin();});
    }
    if(by('capubAdminHistoryOverlay')) return;
    const overlay=document.createElement('div');
    overlay.id='capubAdminHistoryOverlay'; overlay.className='capub-admin-overlay';
    overlay.innerHTML=`<div class="capub-admin-modal" role="dialog" aria-modal="true">
      <div class="capub-admin-head"><div><h2>Uniform Generation History</h2><div class="capub-admin-sub">Shared across computers. Unsaved records expire after 24 hours; saved records remain until deleted or unsaved.</div></div><button id="capubAdminClose" type="button">Close</button></div>
      <div class="capub-admin-toolbar"><input id="capubAdminSearch" type="search" placeholder="Search uniform, rank, membership, gender…"/><button id="capubAdminRefresh" type="button">Refresh Shared</button><button id="capubAdminExport" type="button">Export History JSON</button><button id="capubAdminImport" type="button">Import History JSON</button><button id="capubAdminCleanup" type="button">Delete Expired</button><button id="capubAdminLogout" type="button">Lock Admin</button><input id="capubAdminImportFile" type="file" accept="application/json,.json" style="display:none"/></div>
      <div class="capub-admin-body" id="capubAdminBody"></div></div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click',event=>{if(event.target===overlay)closeAdmin();});
    by('capubAdminClose').onclick=closeAdmin;
    by('capubAdminSearch').addEventListener('input',renderAdmin);
    by('capubAdminRefresh').onclick=refreshCloudHistory;
    by('capubAdminExport').onclick=exportHistory;
    by('capubAdminImport').onclick=()=>by('capubAdminImportFile').click();
    by('capubAdminImportFile').addEventListener('change',importHistoryFile);
    by('capubAdminCleanup').onclick=async()=>{cleanupHistory();try{await cloudRequest('history_cleanup',{},true);await refreshCloudHistory();}catch(err){cloudState='error';cloudError=err.message;renderAdmin();}};
    by('capubAdminLogout').onclick=()=>{adminPassword='';sessionStorage.removeItem(ADMIN_SESSION_KEY);closeAdmin();};
  }

  function timeRemaining(record){
    if(record.saved) return 'Saved permanently';
    const ms=new Date(record.expiresAt).getTime()-Date.now();
    if(ms<=0) return 'Expired';
    const h=Math.floor(ms/3600000),m=Math.floor((ms%3600000)/60000);
    return `${h}h ${m}m remaining`;
  }

  function recordMatches(record,query){
    if(!query) return true;
    const summary=record.summary||{};
    return [summary.membership,summary.gender,summary.uniform,summary.rank,summary.shoulderCord,record.createdAt].join(' ').toLowerCase().includes(query.toLowerCase());
  }

  function cloudNote(){
    if(cloudState==='loading') return '<div class="capub-admin-note">Loading shared history from the server…</div>';
    if(cloudState==='error') return `<div class="capub-admin-note error">Shared history is unavailable: ${esc(cloudError)} Local records from this browser are still shown.</div>`;
    if(cloudState==='ready') return `<div class="capub-admin-note">Showing shared history from all computers plus this browser's local fallback (${cloudRecords.length} shared record${cloudRecords.length===1?'':'s'}).</div>`;
    return '<div class="capub-admin-note">Shared history has not been loaded yet.</div>';
  }

  function renderAdmin(){
    const body=by('capubAdminBody'); if(!body)return;
    const query=by('capubAdminSearch')?.value?.trim()||'';
    const records=mergedHistory().filter(record=>recordMatches(record,query));
    const note=cloudNote();
    if(!records.length){body.innerHTML=note+'<div class="capub-admin-empty">No matching uniform generation history.</div>';return;}
    body.innerHTML=note+`<div class="capub-admin-grid">${records.map(record=>{
      const summary=record.summary||{};
      const title=[summary.rank,summary.uniform].filter(Boolean).join(' — ')||'Uniform setup';
      const source=record._cloud?(record._local?'Shared + local':'Shared from another browser'):'Local fallback';
      return `<div class="capub-admin-card ${record.saved?'saved':''}" data-id="${esc(record.id)}"><div class="capub-admin-title">${esc(title)}</div><div class="capub-admin-meta">${esc(summary.membership||'')} · ${esc(summary.gender||'')}<br>Generated: ${esc(fmt(record.createdAt))}<br>${esc(timeRemaining(record))}</div><div class="capub-admin-source">${esc(source)}</div><div class="capub-admin-stats">Ribbons/medals: ${Number(summary.ribbons)||0} · Badges: ${Number(summary.badges)||0} · Patches: ${Number(summary.patches)||0}${summary.shoulderCord?` · Cord: ${esc(summary.shoulderCord)}`:''}</div><div class="capub-admin-actions"><button type="button" data-act="load">Load in Builder</button><button type="button" data-act="download">Download Setup JSON</button><button type="button" data-act="save" class="${record.saved?'':'save'}">${record.saved?'Unsave':'Save Permanently'}</button><button type="button" data-act="delete" class="danger">Delete</button></div></div>`;
    }).join('')}</div>`;
    body.querySelectorAll('.capub-admin-card').forEach(card=>card.querySelectorAll('button[data-act]').forEach(button=>button.onclick=()=>handleAction(card.dataset.id,button.dataset.act)));
  }

  async function handleAction(id,action){
    const record=mergedHistory().find(item=>item.id===id); if(!record)return;
    if(action==='load'){
      try{if(typeof applyProfile==='function')applyProfile(clone(record.profile));else alert('The builder import function is not available on this page.');closeAdmin();}catch(err){console.error(err);alert('Could not load this setup into the builder.');}
      return;
    }
    if(action==='download'){downloadJson(`cap_uniform_${(record.summary?.uniform||'setup').replace(/[^a-z0-9_-]+/gi,'_')}_${record.id.slice(0,8)}.json`,record.profile);return;}
    if(action==='delete'&&!confirm('Delete this uniform history entry from shared and local history?'))return;

    const local=cleanupHistory();
    const localIndex=local.findIndex(item=>item.id===id);
    if(action==='save'){
      const saved=!record.saved;
      if(localIndex>=0){local[localIndex].saved=saved;local[localIndex].expiresAt=saved?null:new Date(Date.now()+RETENTION_MS).toISOString();writeHistory(local);}
      try{await cloudRequest('history_save',{id,saved},true);await refreshCloudHistory();}catch(err){cloudState='error';cloudError=err.message;renderAdmin();}
    }
    if(action==='delete'){
      if(localIndex>=0){local.splice(localIndex,1);writeHistory(local);}
      try{await cloudRequest('history_delete',{id},true);await refreshCloudHistory();}catch(err){cloudState='error';cloudError=err.message;renderAdmin();}
    }
  }

  function downloadJson(filename,obj){
    const blob=new Blob([JSON.stringify(obj,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const anchor=document.createElement('a');
    anchor.href=url;anchor.download=filename;document.body.appendChild(anchor);anchor.click();setTimeout(()=>{URL.revokeObjectURL(url);anchor.remove();},0);
  }

  function exportHistory(){
    const records=mergedHistory().map(({_cloud,_local,...record})=>record);
    downloadJson(`cap_uniform_history_${new Date().toISOString().slice(0,10)}.json`,{app:'CAP Uniform Builder',type:'admin-generation-history',version:2,exportedAt:new Date().toISOString(),records});
  }

  async function importHistoryFile(event){
    const file=event.target.files?.[0];event.target.value='';if(!file)return;
    try{
      const data=JSON.parse(await file.text());let incoming=[];
      if(Array.isArray(data?.records))incoming=data.records;
      else if(data&&typeof data==='object'){const now=new Date();incoming=[{id:makeId(),createdAt:now.toISOString(),expiresAt:null,saved:true,summary:summarize(data),profile:data}];}
      const local=cleanupHistory();const map=new Map(local.map(record=>[record.id,record]));
      incoming.forEach(raw=>{if(!raw?.profile)return;const record={...raw,id:raw.id||makeId(),createdAt:raw.createdAt||new Date().toISOString(),saved:!!raw.saved,summary:raw.summary||summarize(raw.profile)};record.expiresAt=record.saved?null:(raw.expiresAt||new Date(Date.now()+RETENTION_MS).toISOString());map.set(record.id,record);});
      const normalized=[...map.values()].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,500);writeHistory(normalized);
      await cloudRequest('history_import',{records:incoming},true);await refreshCloudHistory();
    }catch(err){console.error(err);alert(`History import failed: ${err?.message||err}`);}
  }

  async function openAdmin(){ensureAdminUI();adminOpen=true;cleanupHistory();by('capubAdminHistoryOverlay').classList.add('open');renderAdmin();await refreshCloudHistory();}
  function closeAdmin(){adminOpen=false;by('capubAdminHistoryOverlay')?.classList.remove('open');}

  function wireGenerationCapture(){
    const button=by('downloadImage');
    if(button&&!button.dataset.adminHistoryWired){button.dataset.adminHistoryWired='1';button.addEventListener('click',recordGeneration,{capture:true});}
  }

  function init(){
    cleanupHistory();ensureAdminUI();wireGenerationCapture();
    let tries=0;const timer=setInterval(()=>{wireGenerationCapture();if(++tries>20)clearInterval(timer);},750);
    setInterval(cleanupHistory,10*60*1000);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
  window.CAPUB_ADMIN_HISTORY={open:async()=>{if(await authenticate())openAdmin();},record:recordGeneration,export:exportHistory,cleanup:cleanupHistory,refresh:refreshCloudHistory};
})();
