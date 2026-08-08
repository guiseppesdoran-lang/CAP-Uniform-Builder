/* CAP Uniform Builder — local admin generation history
   Stores generated-uniform configurations in this browser for 24 hours unless saved by admin.
*/
(function(){
  'use strict';

  const HISTORY_KEY='CAPUB_ADMIN_HISTORY_V1';
  const ADMIN_SESSION_KEY='CAPUB_ADMIN_AUTH_V1';
  const RETENTION_MS=24*60*60*1000;
  const ADMIN_SHA256='9b5360d36c9f81953ef2c605aba3c2b85563f74f8ee8986b6555f8f482cb89df';
  let adminOpen=false;

  const by=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  const fmt=d=>{ try{return new Date(d).toLocaleString();}catch(_){return String(d||'');} };
  const clone=o=>JSON.parse(JSON.stringify(o));

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

  function makeId(){
    return globalThis.crypto?.randomUUID?.() || `capub-${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
  }

  function collectHistoryProfile(){
    let profile=null;
    try{
      if(typeof collectProfile==='function') profile=collectProfile();
    }catch(_){ }
    if(!profile && globalThis.State){
      try{ profile=clone(globalThis.State); }catch(_){ profile=null; }
    }
    if(!profile) return null;
    profile=clone(profile);
    // Calibration data belongs to the application, not each history record, and can be very large.
    delete profile.calib;
    delete profile.coordinatesByUniform;
    delete profile.calibration;
    return profile;
  }

  function summarize(profile){
    const ribbons=Array.isArray(profile?.ribbons)?profile.ribbons.length:0;
    const badges=Array.isArray(profile?.badges)?profile.badges.length:0;
    const patches=Array.isArray(profile?.patches)?profile.patches.length:0;
    return {
      membership:profile?.membership||'', gender:profile?.gender||'', uniform:profile?.uniform||'', rank:profile?.rank||'',
      ribbons,badges,patches, shoulderCord:profile?.shoulderCord||''
    };
  }

  function recordGeneration(){
    const profile=collectHistoryProfile();
    if(!profile) return;
    const now=new Date();
    const record={
      id:makeId(),
      createdAt:now.toISOString(),
      expiresAt:new Date(now.getTime()+RETENTION_MS).toISOString(),
      saved:false,
      summary:summarize(profile),
      profile
    };
    const records=cleanupHistory();
    records.unshift(record);
    // Keep a safety ceiling so one browser cannot accumulate unlimited saved records accidentally.
    writeHistory(records.slice(0,500));
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
    if(sessionStorage.getItem(ADMIN_SESSION_KEY)==='1') return true;
    const password=prompt('Admin password');
    if(password===null) return false;
    const hash=await sha256(password);
    if(hash!==ADMIN_SHA256){ alert('Incorrect admin password.'); return false; }
    sessionStorage.setItem(ADMIN_SESSION_KEY,'1');
    return true;
  }

  function injectStyles(){
    if(by('capubAdminHistoryStyles')) return;
    const s=document.createElement('style');
    s.id='capubAdminHistoryStyles';
    s.textContent=`
      #capubAdminHistoryButton{position:fixed;right:12px;bottom:34px;z-index:9000;width:auto;min-width:64px;padding:6px 10px;font-size:11px;opacity:.62;background:#172033;color:#fff;border:1px solid #44506a;border-radius:8px}
      #capubAdminHistoryButton:hover{opacity:1}
      .capub-admin-overlay{position:fixed;inset:0;z-index:120000;background:rgba(0,0,0,.68);display:none;align-items:center;justify-content:center;padding:20px}
      .capub-admin-overlay.open{display:flex}
      .capub-admin-modal{width:min(1180px,97vw);max-height:94vh;display:flex;flex-direction:column;background:#fff;color:#172033;border-radius:14px;overflow:hidden;box-shadow:0 28px 90px rgba(0,0,0,.45)}
      .capub-admin-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;padding:16px 18px;border-bottom:1px solid #d9dee8;background:#f7f9fc}
      .capub-admin-head h2{margin:0 0 3px;font-size:20px}.capub-admin-sub{font-size:11px;color:#667085;line-height:1.35}
      .capub-admin-head button{width:auto;margin:0;padding:7px 10px}
      .capub-admin-toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:12px 18px;border-bottom:1px solid #e4e7ec;background:#fff}
      .capub-admin-toolbar input{width:min(360px,100%);margin:0}.capub-admin-toolbar button{width:auto;margin:0;padding:7px 10px}
      .capub-admin-body{overflow:auto;padding:14px 18px 20px}
      .capub-admin-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(310px,1fr));gap:12px}
      .capub-admin-card{border:1px solid #d8dee8;border-radius:10px;padding:12px;background:#fff;box-shadow:0 5px 16px rgba(0,0,0,.05)}
      .capub-admin-card.saved{border-color:#91b89f;background:#fbfffc}.capub-admin-title{font-weight:800;font-size:13px}.capub-admin-meta{font-size:11px;color:#5f6b7d;line-height:1.45;margin-top:5px}.capub-admin-stats{font-size:10px;color:#667085;margin:7px 0}
      .capub-admin-actions{display:flex;gap:6px;flex-wrap:wrap}.capub-admin-actions button{width:auto;margin:0;padding:6px 8px;font-size:10px}.capub-admin-actions .danger{background:#8b1e1e;border-color:#8b1e1e}.capub-admin-actions .save{background:#1e6b42;border-color:#1e6b42}
      .capub-admin-empty{text-align:center;padding:40px;color:#667085}.capub-admin-note{font-size:10px;color:#667085;margin-bottom:10px;padding:8px 10px;background:#f8fafc;border:1px solid #e1e5eb;border-radius:8px}
    `;
    document.head.appendChild(s);
  }

  function ensureAdminUI(){
    injectStyles();
    if(!by('capubAdminHistoryButton')){
      const b=document.createElement('button');
      b.id='capubAdminHistoryButton'; b.type='button'; b.textContent='Admin'; b.title='Admin uniform generation history';
      document.body.appendChild(b);
      b.addEventListener('click',async()=>{ if(await authenticate()) openAdmin(); });
    }
    if(!by('capubAdminHistoryOverlay')){
      const o=document.createElement('div');
      o.id='capubAdminHistoryOverlay'; o.className='capub-admin-overlay';
      o.innerHTML=`<div class="capub-admin-modal" role="dialog" aria-modal="true">
        <div class="capub-admin-head"><div><h2>Uniform Generation History</h2><div class="capub-admin-sub">Unsaved records expire 24 hours after generation. Saved records remain until deleted or unsaved.</div></div><button id="capubAdminClose" type="button">Close</button></div>
        <div class="capub-admin-toolbar">
          <input id="capubAdminSearch" type="search" placeholder="Search uniform, rank, membership, gender…"/>
          <button id="capubAdminExport" type="button">Export History JSON</button>
          <button id="capubAdminImport" type="button">Import History JSON</button>
          <button id="capubAdminCleanup" type="button">Delete Expired</button>
          <button id="capubAdminLogout" type="button">Lock Admin</button>
          <input id="capubAdminImportFile" type="file" accept="application/json,.json" style="display:none"/>
        </div>
        <div class="capub-admin-body" id="capubAdminBody"></div>
      </div>`;
      document.body.appendChild(o);
      o.addEventListener('click',e=>{if(e.target===o) closeAdmin();});
      by('capubAdminClose').onclick=closeAdmin;
      by('capubAdminSearch').addEventListener('input',renderAdmin);
      by('capubAdminExport').onclick=exportHistory;
      by('capubAdminImport').onclick=()=>by('capubAdminImportFile').click();
      by('capubAdminImportFile').addEventListener('change',importHistoryFile);
      by('capubAdminCleanup').onclick=()=>{cleanupHistory();renderAdmin();};
      by('capubAdminLogout').onclick=()=>{sessionStorage.removeItem(ADMIN_SESSION_KEY);closeAdmin();};
    }
  }

  function timeRemaining(record){
    if(record.saved) return 'Saved permanently';
    const ms=new Date(record.expiresAt).getTime()-Date.now();
    if(ms<=0) return 'Expired';
    const h=Math.floor(ms/3600000), m=Math.floor((ms%3600000)/60000);
    return `${h}h ${m}m remaining`;
  }

  function recordMatches(r,q){
    if(!q) return true;
    const s=r.summary||{};
    return [s.membership,s.gender,s.uniform,s.rank,s.shoulderCord,r.createdAt].join(' ').toLowerCase().includes(q.toLowerCase());
  }

  function renderAdmin(){
    const body=by('capubAdminBody'); if(!body) return;
    const q=by('capubAdminSearch')?.value?.trim()||'';
    const records=cleanupHistory().filter(r=>recordMatches(r,q));
    const note=`<div class="capub-admin-note">This history is stored only in this browser. Use <b>Export History JSON</b> to back it up or move it to another browser. Individual <b>Download Setup JSON</b> files can be imported by the builder's existing Import Setup JSON control.</div>`;
    if(!records.length){body.innerHTML=note+'<div class="capub-admin-empty">No matching generation history in this browser.</div>';return;}
    body.innerHTML=note+`<div class="capub-admin-grid">${records.map(r=>{
      const s=r.summary||{};
      const title=[s.rank,s.uniform].filter(Boolean).join(' — ')||'Uniform setup';
      return `<div class="capub-admin-card ${r.saved?'saved':''}" data-id="${esc(r.id)}">
        <div class="capub-admin-title">${esc(title)}</div>
        <div class="capub-admin-meta">${esc(s.membership||'')} · ${esc(s.gender||'')}<br>Generated: ${esc(fmt(r.createdAt))}<br>${esc(timeRemaining(r))}</div>
        <div class="capub-admin-stats">Ribbons/medals: ${Number(s.ribbons)||0} · Badges: ${Number(s.badges)||0} · Patches: ${Number(s.patches)||0}${s.shoulderCord?` · Cord: ${esc(s.shoulderCord)}`:''}</div>
        <div class="capub-admin-actions">
          <button type="button" data-act="load">Load in Builder</button>
          <button type="button" data-act="download">Download Setup JSON</button>
          <button type="button" data-act="save" class="${r.saved?'':'save'}">${r.saved?'Unsave':'Save Permanently'}</button>
          <button type="button" data-act="delete" class="danger">Delete</button>
        </div>
      </div>`;
    }).join('')}</div>`;
    body.querySelectorAll('.capub-admin-card').forEach(card=>{
      const id=card.dataset.id;
      card.querySelectorAll('button[data-act]').forEach(btn=>btn.onclick=()=>handleAction(id,btn.dataset.act));
    });
  }

  function handleAction(id,act){
    let records=cleanupHistory();
    const idx=records.findIndex(r=>r.id===id); if(idx<0) return;
    const r=records[idx];
    if(act==='load'){
      try{
        if(typeof applyProfile==='function') applyProfile(clone(r.profile));
        else alert('The builder import function is not available on this page.');
        closeAdmin();
      }catch(err){console.error(err);alert('Could not load this setup into the builder.');}
      return;
    }
    if(act==='download'){
      downloadJson(`cap_uniform_${(r.summary?.uniform||'setup').replace(/[^a-z0-9_-]+/gi,'_')}_${r.id.slice(0,8)}.json`,r.profile);
      return;
    }
    if(act==='save'){
      r.saved=!r.saved;
      r.expiresAt=r.saved?null:new Date(Date.now()+RETENTION_MS).toISOString();
      records[idx]=r; writeHistory(records); renderAdmin(); return;
    }
    if(act==='delete'){
      if(!confirm('Delete this uniform history entry?')) return;
      records.splice(idx,1); writeHistory(records); renderAdmin();
    }
  }

  function downloadJson(filename,obj){
    const blob=new Blob([JSON.stringify(obj,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob); const a=document.createElement('a');
    a.href=url; a.download=filename; document.body.appendChild(a); a.click();
    setTimeout(()=>{URL.revokeObjectURL(url);a.remove();},0);
  }

  function exportHistory(){
    downloadJson(`cap_uniform_history_${new Date().toISOString().slice(0,10)}.json`,{
      app:'CAP Uniform Builder', type:'admin-generation-history', version:1, exportedAt:new Date().toISOString(), records:cleanupHistory()
    });
  }

  async function importHistoryFile(e){
    const file=e.target.files?.[0]; e.target.value=''; if(!file) return;
    try{
      const data=JSON.parse(await file.text());
      let incoming=[];
      if(Array.isArray(data?.records)) incoming=data.records;
      else if(data && typeof data==='object'){
        // A normal builder setup JSON can also be imported into admin history as a saved entry.
        const now=new Date(); incoming=[{id:makeId(),createdAt:now.toISOString(),expiresAt:null,saved:true,summary:summarize(data),profile:data}];
      }
      const existing=cleanupHistory(); const map=new Map(existing.map(r=>[r.id,r]));
      incoming.forEach(raw=>{
        if(!raw?.profile) return;
        const r={...raw,id:raw.id||makeId(),createdAt:raw.createdAt||new Date().toISOString(),saved:!!raw.saved,summary:raw.summary||summarize(raw.profile)};
        r.expiresAt=r.saved?null:(raw.expiresAt||new Date(Date.now()+RETENTION_MS).toISOString());
        map.set(r.id,r);
      });
      writeHistory([...map.values()].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,500));
      renderAdmin();
    }catch(err){console.error(err);alert('That JSON file could not be imported.');}
  }

  function openAdmin(){ensureAdminUI();adminOpen=true;cleanupHistory();renderAdmin();by('capubAdminHistoryOverlay').classList.add('open');}
  function closeAdmin(){adminOpen=false;by('capubAdminHistoryOverlay')?.classList.remove('open');}

  function wireGenerationCapture(){
    const btn=by('downloadImage');
    if(btn && !btn.dataset.adminHistoryWired){
      btn.dataset.adminHistoryWired='1';
      // Capture before the PNG exporter mutates/clones the preview.
      btn.addEventListener('click',recordGeneration,{capture:true});
    }
  }

  function init(){
    cleanupHistory(); ensureAdminUI(); wireGenerationCapture();
    // The app may rebuild controls dynamically; retry the output-button hook a few times.
    let tries=0; const timer=setInterval(()=>{wireGenerationCapture();if(++tries>20)clearInterval(timer);},750);
    setInterval(cleanupHistory,10*60*1000);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
  window.CAPUB_ADMIN_HISTORY={open:async()=>{if(await authenticate())openAdmin();},record:recordGeneration,export:exportHistory,cleanup:cleanupHistory};
})();