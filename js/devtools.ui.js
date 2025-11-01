/* =========================================================================
   CAP Uniform Builder — DevTools UI
   Author: C/Capt. Guiseppe Doran
   Toggle panel: Alt + D
   Toggle grid:  Alt + G
   ========================================================================= */
(function () {
  const NS = 'CAPDevTools';
  if (window[NS]) return;
  window[NS] = {};

  const $ = (s, r=document)=>r.querySelector(s);
  const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));
  const on = (el, ev, fn, o)=> el && el.addEventListener(ev, fn, o);
  const copyText = async (t)=>{ try{ await navigator.clipboard.writeText(t); return true; }catch{ return false; } };

  const roots = { jacketBase:null, canvasShell:null, overlayLayer:null, epauletContainer:null, panelShell:null };
  function refreshRoots(){
    roots.jacketBase = $('#jacketBase');
    roots.canvasShell = $('#canvasShell');
    roots.overlayLayer = $('#overlayLayer');
    roots.epauletContainer = $('#epauletContainer');
    roots.panelShell = $('#panelShell');
  }
  refreshRoots();

  function createPanel(){
    const panel=document.createElement('div');
    panel.id='capDevPanel';
    panel.setAttribute('role','dialog'); panel.setAttribute('aria-label','Dev Tools');
    panel.style.cssText='position:fixed;right:16px;bottom:16px;width:320px;max-height:70vh;background:#0b1220;color:#e6edf6;border:1px solid #2a3550;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.35);z-index:9999;display:none;overflow:hidden;font:13px/1.4 system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;';
    panel.innerHTML=`
      <div id="capDevHeader" style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:#0e1a35;border-bottom:1px solid #223055;cursor:move;">
        <strong style="font-size:12px;letter-spacing:.3px">CAP DevTools</strong>
        <span style="margin-left:auto;opacity:.7">drag</span>
        <button id="capDevClose" title="Close" aria-label="Close" style="background:#1a2446;border:1px solid #2e3d6c;color:#e6edf6;padding:2px 8px;border-radius:6px;cursor:pointer">✕</button>
      </div>
      <div style="padding:8px 10px;display:grid;gap:8px;grid-auto-rows:min-content">
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button data-act="toggle-grid" class="capDevBtn">Grid (Alt+G)</button>
          <button data-act="toggle-outlines" class="capDevBtn">Highlight Overlays</button>
          <button data-act="log-rack" class="capDevBtn">Log Rack Coords</button>
        </div>
        <fieldset style="border:1px solid #2a3550;border-radius:8px;padding:8px">
          <legend style="padding:0 6px;opacity:.9">Quick Dumps</legend>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <button data-act="dump-overlays" class="capDevBtn">Dump Overlays JSON</button>
            <button data-act="dump-ribbons" class="capDevBtn">Dump Ribbons JSON</button>
            <button data-act="dump-badges" class="capDevBtn">Dump Badges JSON</button>
          </div>
        </fieldset>
        <fieldset style="border:1px solid #2a3550;border-radius:8px;padding:8px">
          <legend style="padding:0 6px;opacity:.9">Mouse / Canvas</legend>
          <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px">
            <div><div style="opacity:.7;font-size:12px">Mouse (page)</div><div id="capDevMousePage">—</div></div>
            <div><div style="opacity:.7;font-size:12px">Mouse (canvas)</div><div id="capDevMouseCanvas">—</div></div>
          </div>
        </fieldset>
        <details>
          <summary style="cursor:pointer">Overlay Nodes</summary>
          <div id="capDevOverlayList" style="margin-top:6px;max-height:180px;overflow:auto;border:1px solid #2a3550;border-radius:6px;padding:6px"></div>
        </details>
      </div>
      <style>
        .capDevBtn{background:#1a2446;border:1px solid #2e3d6c;color:#e6edf6;padding:6px 10px;border-radius:8px;cursor:pointer}
        .capDevBtn:hover{background:#253162}
        .capDevOutline{outline:2px dashed #00d8ff99;outline-offset:-2px!important}
        #capDevGridCanvas{position:absolute;inset:0;pointer-events:none;opacity:.5}
      </style>`;
    document.body.appendChild(panel);

    const header=$('#capDevHeader',panel);
    let sx=0,sy=0,ox=0,oy=0,drag=false;
    on(header,'mousedown',e=>{
      drag=true;sx=e.clientX;sy=e.clientY;
      const r=panel.getBoundingClientRect();ox=r.left;oy=r.top;
      const mm=e=>{ if(!drag) return; const dx=e.clientX-sx, dy=e.clientY-sy;
        panel.style.left=Math.max(8,ox+dx)+'px'; panel.style.top=Math.max(8,oy+dy)+'px';
        panel.style.right='auto'; panel.style.bottom='auto';
      };
      const mu=()=>{ drag=false; document.removeEventListener('mousemove',mm); document.removeEventListener('mouseup',mu); };
      document.addEventListener('mousemove',mm); document.addEventListener('mouseup',mu);
    });

    panel.addEventListener('click',e=>{
      const btn=e.target.closest('button[data-act]'); if(!btn) return;
      const act=btn.getAttribute('data-act'); actions[act] && actions[act]();
    });
    on($('#capDevClose',panel),'click',()=>togglePanel(false));
    return panel;
  }

  let gridEnabled=false, gridCanvas=null;
  function drawGrid(){
    if(!roots.canvasShell) return;
    if(!gridCanvas){ gridCanvas=document.createElement('canvas'); gridCanvas.id='capDevGridCanvas'; roots.canvasShell.appendChild(gridCanvas); }
    const rect=roots.canvasShell.getBoundingClientRect();
    gridCanvas.width=rect.width; gridCanvas.height=rect.height;
    const ctx=gridCanvas.getContext('2d'); ctx.clearRect(0,0,gridCanvas.width,gridCanvas.height);
    const minor=10, major=50;
    for(let x=0;x<=gridCanvas.width;x+=minor){
      ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,gridCanvas.height);
      ctx.strokeStyle=(x%major===0)?'#00d8ff66':'#00d8ff22'; ctx.lineWidth=(x%major===0)?1:.5; ctx.stroke();
    }
    for(let y=0;y<=gridCanvas.height;y+=minor){
      ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(gridCanvas.width,y);
      ctx.strokeStyle=(y%major===0)?'#00d8ff66':'#00d8ff22'; ctx.lineWidth=(y%major===0)?1:.5; ctx.stroke();
    }
    const base=roots.jacketBase;
    if(base){
      const r=base.getBoundingClientRect(), s=roots.canvasShell.getBoundingClientRect();
      const bx=r.left-s.left, by=r.top-s.top;
      ctx.strokeStyle='#22ff8866'; ctx.lineWidth=2; ctx.strokeRect(bx,by,r.width,r.height);
    }
  }
  function toggleGrid(force){
    gridEnabled=typeof force==='boolean'?force:!gridEnabled;
    if(!roots.canvasShell) refreshRoots(); if(!roots.canvasShell) return;
    if(gridEnabled){ drawGrid(); window.addEventListener('resize',drawGrid); }
    else { if(gridCanvas&&gridCanvas.parentNode) gridCanvas.parentNode.removeChild(gridCanvas); gridCanvas=null; window.removeEventListener('resize',drawGrid); }
  }

  let outlinesEnabled=false;
  function toggleOutlines(force){
    outlinesEnabled=typeof force==='boolean'?force:!outlinesEnabled;
    const nodes=[]; if(roots.overlayLayer) nodes.push(...roots.overlayLayer.children); if(roots.epauletContainer) nodes.push(...roots.epauletContainer.children);
    nodes.forEach(n=> outlinesEnabled ? n.classList.add('capDevOutline') : n.classList.remove('capDevOutline'));
  }

  function getOverlaySnapshot(){
    const nodes=[];
    const add=el=>{
      const r=el.getBoundingClientRect(), s=roots.canvasShell?.getBoundingClientRect();
      const x=s? r.left-s.left : r.left, y=s? r.top-s.top : r.top;
      nodes.push({ tag:el.tagName.toLowerCase(), id:el.id||null, class:el.className||null, dataset:{...el.dataset},
        x:Math.round(x), y:Math.round(y), w:Math.round(r.width), h:Math.round(r.height),
        src:el.getAttribute('src')||null, text:el.textContent?.trim()||null });
    };
    if(roots.overlayLayer) $$('#overlayLayer > *').forEach(add);
    if(roots.epauletContainer) $$('#epauletContainer > *').forEach(add);
    return nodes;
  }

  async function dumpOverlays(){ const json=JSON.stringify(getOverlaySnapshot(),null,2); console.log('[DevTools] Overlay snapshot:',json); const ok=await copyText(json); toast(ok?'Overlays JSON copied':'Copy failed (console)'); }
  async function dumpRibbons(){
    const byState=window.AppState?.ribbons || window.RIBBONS || null;
    if(byState){ const json=JSON.stringify(byState,null,2); console.log('[DevTools] Ribbons (state):',json); const ok=await copyText(json); return toast(ok?'Ribbons JSON copied':'Copy failed'); }
    const ribbons=$$('#overlayLayer img[data-type="ribbon"], #overlayLayer .ribbon');
    const s=roots.canvasShell?.getBoundingClientRect();
    const list=ribbons.map(el=>{ const r=el.getBoundingClientRect(); return { id:el.id||null, dataset:{...el.dataset}, x:Math.round(r.left-s.left), y:Math.round(r.top-s.top), w:Math.round(r.width), h:Math.round(r.height) };});
    const json=JSON.stringify(list,null,2); console.log('[DevTools] Ribbons (scraped):',json); const ok=await copyText(json); toast(ok?'Ribbons JSON copied':'Copy failed');
  }
  async function dumpBadges(){
    const byState=window.AppState?.badges || window.BADGES || null;
    if(byState){ const json=JSON.stringify(byState,null,2); console.log('[DevTools] Badges (state):',json); const ok=await copyText(json); return toast(ok?'Badges JSON copied':'Copy failed'); }
    const badges=$$('#overlayLayer img[data-type="badge"], #overlayLayer .badge, #overlayLayer [data-badge]');
    const s=roots.canvasShell?.getBoundingClientRect();
    const list=badges.map(el=>{ const r=el.getBoundingClientRect(); return { id:el.id||null, dataset:{...el.dataset}, x:Math.round(r.left-s.left), y:Math.round(r.top-s.top), w:Math.round(r.width), h:Math.round(r.height) };});
    const json=JSON.stringify(list,null,2); console.log('[DevTools] Badges (scraped):',json); const ok=await copyText(json); toast(ok?'Badges JSON copied':'Copy failed');
  }
  function logRackCoords(){
    refreshRoots();
    const s=roots.canvasShell?.getBoundingClientRect(); if(!s) return console.warn('[DevTools] No canvasShell found.');
    const ribbons=$$('#overlayLayer img[data-type="ribbon"], #overlayLayer .ribbon');
    const coords=ribbons.map(el=>{ const r=el.getBoundingClientRect(); return { id:el.id||null, x:Math.round(r.left-s.left), y:Math.round(r.top-s.top), w:Math.round(r.width), h:Math.round(r.height), row:el.dataset.row||null, col:el.dataset.col||null, precedence:el.dataset.precedence||null };});
    console.table(coords); toast(`Logged ${coords.length} ribbon nodes`);
  }

  function renderOverlayList(){
    const host=$('#capDevOverlayList'); if(!host) return;
    const items=getOverlaySnapshot();
    host.innerHTML=items.map((n,i)=>`<div style="display:flex;justify-content:space-between;gap:8px;border-bottom:1px dashed #2a3550;padding:4px 0">
      <span style="opacity:.85">${n.id || n.dataset?.type || n.tag || `#${i}`}</span>
      <code style="opacity:.8">${n.x},${n.y} · ${n.w}×${n.h}</code>
    </div>`).join('') || '<em style="opacity:.7">No overlay nodes found.</em>';
  }

  let tracking=false;
  function attachMouseTracking(){
    const mPage=$('#capDevMousePage'), mCanvas=$('#capDevMouseCanvas');
    if(!roots.canvasShell || !mPage || !mCanvas) return;
    const shellRect=()=> roots.canvasShell.getBoundingClientRect();
    const handler=(e)=>{ const rect=shellRect(); const cx=Math.round(e.clientX-rect.left), cy=Math.round(e.clientY-rect.top);
      mPage.textContent=`${e.pageX}, ${e.pageY}`; mCanvas.textContent=`${cx}, ${cy}`; if(gridEnabled && gridCanvas) drawGrid(); };
    if(!tracking){ document.addEventListener('mousemove',handler); tracking=true; }
  }

  let toastTimer=null;
  function toast(msg){
    let t=$('#capDevToast');
    if(!t){ t=document.createElement('div'); t.id='capDevToast';
      t.style.cssText='position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#0b1220;color:#e6edf6;border:1px solid #2a3550;padding:8px 12px;border-radius:8px;z-index:10000;opacity:0;transition:opacity .15s;';
      document.body.appendChild(t);
    }
    t.textContent=msg; t.style.opacity='1'; clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.style.opacity='0',1400);
  }

  const actions={
    'toggle-grid': ()=>{ toggleGrid(); toast(gridEnabled?'Grid: ON':'Grid: OFF'); },
    'toggle-outlines': ()=>{ toggleOutlines(); toast(outlinesEnabled?'Highlight: ON':'Highlight: OFF'); },
    'log-rack': logRackCoords,
    'dump-overlays': dumpOverlays,
    'dump-ribbons': dumpRibbons,
    'dump-badges': dumpBadges
  };

  let panel;
  function togglePanel(force){
    if(!panel) panel=createPanel();
    const show= typeof force==='boolean' ? force : (panel.style.display==='none'||panel.style.display==='');
    panel.style.display= show ? 'block' : 'none';
    if(show){ refreshRoots(); renderOverlayList(); attachMouseTracking();
      if(!panel.style.left && !panel.style.top){ panel.style.right='16px'; panel.style.bottom='16px'; }
    }
  }

  const mo=new MutationObserver(()=>{ if(!panel || panel.style.display==='none') return; renderOverlayList(); if(gridEnabled) drawGrid(); });
  function watch(){ if(roots.overlayLayer) mo.observe(roots.overlayLayer,{childList:true,subtree:true,attributes:true}); if(roots.epauletContainer) mo.observe(roots.epauletContainer,{childList:true,subtree:true,attributes:true}); }

  function onKey(e){
    if(e.altKey && (e.key==='d'||e.key==='D')){ e.preventDefault(); togglePanel(); }
    if(e.altKey && (e.key==='g'||e.key==='G')){ e.preventDefault(); actions['toggle-grid'](); }
  }

  function boot(){
    refreshRoots(); watch(); document.addEventListener('keydown',onKey);
    if(location.hostname==='localhost' || location.hostname==='127.0.0.1'){ togglePanel(true); }
    console.info('[CAP DevTools] Ready. Alt+D to toggle panel, Alt+G for grid.');
  }
  if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded',boot); } else { boot(); }
})();
