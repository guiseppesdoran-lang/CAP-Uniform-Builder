/* js/devtools.js
   Developer calibration + override panel for CAP Uniform Builder
   Password: 658773
*/

(function(){
  // config
  const DEV_PASSWORD = "658773";
  const STORAGE_KEY_UNLOCKED = "cap_devtools_unlocked_v1";

  // state
  window.DevTools = window.DevTools || {};
  const DT = window.DevTools;
  DT.unlocked = sessionStorage.getItem(STORAGE_KEY_UNLOCKED) === "1";
  DT.orig = {}; // will store original functions for restore if needed
  DT.override = {
    enabled: false,
    allowSMforCadets: false,
    maxBadges: 999,
    bypassUILocks: false
  };

  // helper DOM builder
  function el(tag, props={}, children=[]){
    const n = document.createElement(tag);
    Object.entries(props).forEach(([k,v])=>{
      if(k === "style") Object.assign(n.style, v);
      else if(k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v);
    });
    (Array.isArray(children) ? children : [children]).forEach(c=>{
      if(!c) return;
      if(typeof c === "string") n.appendChild(document.createTextNode(c));
      else n.appendChild(c);
    });
    return n;
  }

  // mount UI
  function mountDevToggle(){
    if(document.getElementById("devToggleBtn")) return;
    // small header button
    const btn = el("button", { id:"devToggleBtn", style:{position:"fixed",left:"12px",bottom:"12px",zIndex:12000,padding:"8px 10px",borderRadius:"8px",background:"#111827",color:"#fff",border:"0",cursor:"pointer"}}, "DEV");
    btn.title = "Developer tools (password protected)";
    document.body.appendChild(btn);
    btn.addEventListener("click", showPasswordPrompt);
  }

  // password prompt
  function showPasswordPrompt(){
    if(DT.unlocked){ openPanel(); return; }

    const promptWrap = el("div", { id:"devpwwrap", style:{position:"fixed",left:"0",top:"0",right:"0",bottom:"0",background:"rgba(0,0,0,.45)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:13000}});
    const box = el("div", { style:{width:"360px",background:"#fff",padding:"18px",borderRadius:"10px",boxShadow:"0 10px 30px rgba(2,6,23,.35)"}});
    const title = el("div", {}, "Developer Panel — password required");
    title.style.fontWeight = "700";
    title.style.marginBottom = "8px";
    const input = el("input", { type:"password", placeholder:"enter password", style:{width:"100%",padding:"8px",fontSize:"14px",marginBottom:"8px"}});
    const remember = el("label", { style:{display:"block",fontSize:"12px",color:"#374151",marginBottom:"8px"}}, [
      el("input", { type:"checkbox", id:"devRemember" }),
      " keep unlocked for this session"
    ]);
    const row = el("div", { style:{display:"flex",gap:"8px",justifyContent:"flex-end"}});
    const ok = el("button", { style:{padding:"8px 10px",cursor:"pointer"}}, "Unlock");
    const cancel = el("button", { style:{padding:"8px 10px",cursor:"pointer",background:"#f3f4f6"}}, "Cancel");
    row.appendChild(cancel); row.appendChild(ok);
    box.appendChild(title); box.appendChild(input); box.appendChild(remember); box.appendChild(row);
    promptWrap.appendChild(box);
    document.body.appendChild(promptWrap);

    function closePrompt(){ promptWrap.remove(); }
    cancel.addEventListener("click", closePrompt);
    ok.addEventListener("click", ()=>{
      if(input.value === DEV_PASSWORD){
        DT.unlocked = true;
        if(document.getElementById("devRemember").checked) sessionStorage.setItem(STORAGE_KEY_UNLOCKED,"1");
        closePrompt();
        openPanel();
      } else {
        input.style.border = "1px solid #ef4444";
        input.value = "";
        input.placeholder = "incorrect — try again";
      }
    });
    input.addEventListener("keydown", e => { if(e.key === "Enter") ok.click(); });
  }

  // build panel
  function openPanel(){
    if(document.getElementById("devPanelWrap")) return highlightPanel();

    const wrap = el("div",{ id:"devPanelWrap", style:{position:"fixed",right:"12px",top:"12px",width:"420px",maxHeight:"84vh",overflow:"auto",background:"#0f172a",color:"#fff",padding:"12px",borderRadius:"10px",zIndex:12001,boxShadow:"0 10px 40px rgba(2,6,23,.6)"}});
    const header = el("div",{}, [
      el("strong",{}, "DEV PANEL"),
      el("button",{ style:{float:"right",background:"#ef4444",border:"0",padding:"6px 8px",cursor:"pointer",borderRadius:"6px"}, onClick: closePanel }, "Close")
    ]);
    header.style.display="flex";
    header.style.justifyContent="space-between";
    header.style.alignItems="center";
    const note = el("div",{ style:{fontSize:"12px",color:"#94a3b8",marginTop:"6px"}}, "Calibration editor + override toggles. Export copy/paste calibration JSON to share.");

    // sections:
    const calibSection = el("div", { style:{marginTop:"12px",background:"#071025",padding:"8px",borderRadius:"8px"}});
    calibSection.appendChild(el("div",{style:{fontWeight:700,marginBottom:"6px"}}, "Calibration Editor"));
    const calibList = el("div",{ id:"devCalibList", style:{maxHeight:"220px",overflowY:"auto",paddingRight:"6px"}});
    calibSection.appendChild(calibList);
    const calibButtons = el("div",{ style:{display:"flex",gap:"8px",marginTop:"8px"}}, [
      el("button",{ onClick: exportCalibrationJSON, style:{flex:"1",padding:"8px",cursor:"pointer"}}, "Export JSON"),
      el("button",{ onClick: importCalibrationJSONPrompt, style:{flex:"1",padding:"8px",cursor:"pointer",background:"#e2e8f0",color:"#0f172a"}}, "Import JSON")
    ]);
    calibSection.appendChild(calibButtons);

    // dev overrides
    const overrideSection = el("div", { style:{marginTop:"12px",background:"#071025",padding:"8px",borderRadius:"8px"}});
    overrideSection.appendChild(el("div",{style:{fontWeight:700,marginBottom:"6px"}}, "Developer Overrides"));
    const allowSMRow = el("label", { style:{display:"flex",alignItems:"center",gap:"8px",marginBottom:"8px"}}, [
      el("input",{ type:"checkbox", id:"dev_allowSM" }),
      "Allow Senior-Member ribbons for Cadets (ignore SM-only)"
    ]);
    const bypassRow = el("label", { style:{display:"flex",alignItems:"center",gap:"8px",marginBottom:"8px"}}, [
      el("input",{ type:"checkbox", id:"dev_bypassUI" }),
      "Bypass UI locks (remove 'locked' styling / enable forbidden uniforms)"
    ]);
    const maxBadgesRow = el("div", { style:{display:"flex",gap:"8px",alignItems:"center"}}, [
      el("label",{ style:{minWidth:"120px"}}, "Max Badges"),
      el("input",{ type:"number", id:"dev_maxBadges", value:999, style:{width:"80px",padding:"6px"}}),
      el("button",{ onClick:applyOverrides, style:{padding:"6px 8px",cursor:"pointer"}}, "Apply")
    ]);
    overrideSection.appendChild(allowSMRow);
    overrideSection.appendChild(bypassRow);
    overrideSection.appendChild(maxBadgesRow);

    // live debug / export calibrations
    const exportArea = el("div",{ style:{marginTop:"12px",background:"#071025",padding:"8px",borderRadius:"8px"}});
    exportArea.appendChild(el("div",{style:{fontWeight:700,marginBottom:"6px"}}, "Live Export / Debug"));
    const calibExport = el("textarea", { id:"dev_calib_export", rows:6, style:{width:"100%",fontFamily:"ui-monospace,monospace",fontSize:"12px"}});
    const copyBtn = el("button",{ onClick: ()=>{ calibExport.select(); document.execCommand('copy'); }, style:{marginTop:"8px",padding:"8px",cursor:"pointer"} }, "Copy to clipboard");
    exportArea.appendChild(calibExport); exportArea.appendChild(copyBtn);

    wrap.appendChild(header); wrap.appendChild(note); wrap.appendChild(calibSection); wrap.appendChild(overrideSection); wrap.appendChild(exportArea);

    document.body.appendChild(wrap);

    // wire events
    document.getElementById("dev_allowSM").addEventListener("change", (e)=>{
      DT.override.allowSMforCadets = !!e.target.checked;
      applyOverrides();
    });
    document.getElementById("dev_bypassUI").addEventListener("change", (e)=>{
      DT.override.bypassUILocks = !!e.target.checked;
      applyOverrides();
    });
    document.getElementById("dev_maxBadges").addEventListener("change", (e)=>{
      DT.override.maxBadges = parseInt(e.target.value,10) || 999;
    });

    // populate calibration entries after a short delay (so calibrationData exists)
    setTimeout(()=>{ rebuildCalibList(); exportCalibrationToTextarea(); }, 250);
  }

  function highlightPanel(){
    const p = document.getElementById("devPanelWrap");
    if(!p) return;
    p.animate([{transform:"scale(1)},{transform:"scale(1.02)"}], {duration:120,iterations:1});
  }
  function closePanel(){
    const p = document.getElementById("devPanelWrap");
    if(p) p.remove();
  }

  // builds the list of calibratables based on global calibrationData object
  function rebuildCalibList(){
    const list = document.getElementById("devCalibList");
    if(!list) return;
    list.innerHTML = "";
    if(typeof calibrationData === "undefined"){
      list.appendChild(el("div", { style:{color:"#ef4444"}}, "No calibrationData global found yet."));
      return;
    }
    Object.keys(calibrationData).forEach(id=>{
      const item = calibrationData[id];
      const card = el("div", { style:{background:"#031024",padding:"8px",borderRadius:"8px",marginBottom:"8px",border:"1px solid rgba(255,255,255,.04)"}});
      card.appendChild(el("div",{ style:{fontWeight:700,marginBottom:"4px"} }, `${item.name} — ${id}`));
      // X
      const xRow = el("div",{ style:{display:"flex",gap:"8px",alignItems:"center",marginBottom:"6px"}});
      const xRange = el("input",{ type:"range", min:-300, max:900, step:1, value:item.x, style:{flex:1} });
      const xNum = el("input",{ type:"number", value:item.x, style:{width:"70px"} });
      xRow.appendChild(el("label",{ style:{minWidth:"24px"} }, "X"));
      xRow.appendChild(xRange); xRow.appendChild(xNum);
      card.appendChild(xRow);

      // Y
      const yRow = el("div",{ style:{display:"flex",gap:"8px",alignItems:"center",marginBottom:"6px"}});
      const yRange = el("input",{ type:"range", min:-50, max:1200, step:1, value:item.y, style:{flex:1} });
      const yNum = el("input",{ type:"number", value:item.y, style:{width:"70px"} });
      yRow.appendChild(el("label",{ style:{minWidth:"24px"} }, "Y"));
      yRow.appendChild(yRange); yRow.appendChild(yNum);
      card.appendChild(yRow);

      // Rotation
      const rRow = el("div",{ style:{display:"flex",gap:"8px",alignItems:"center"}});
      const rRange = el("input",{ type:"range", min:-180, max:180, step:0.5, value:item.rotation||0, style:{flex:1} });
      const rNum = el("input",{ type:"number", value:item.rotation||0, style:{width:"70px"} });
      rRow.appendChild(el("label",{ style:{minWidth:"24px"} }, "ROT"));
      rRow.appendChild(rRange); rRow.appendChild(rNum);
      card.appendChild(rRow);

      // apply/restore
      const actions = el("div",{ style:{display:"flex",gap:"8px",marginTop:"8px"}});
      const apply = el("button",{ style:{padding:"6px 8px",cursor:"pointer"} }, "Apply");
      const restore = el("button",{ style:{padding:"6px 8px",cursor:"pointer",background:"#e2e8f0",color:"#0f172a"} }, "Restore UI");
      actions.appendChild(restore); actions.appendChild(apply);
      card.appendChild(actions);

      list.appendChild(card);

      // wiring: live sync to inputs and calibrationData
      function setItemFromInputs(){
        const x = parseInt(xNum.value,10) || 0;
        const y = parseInt(yNum.value,10) || 0;
        const r = parseFloat(rNum.value) || 0;
        item.x = x; item.y = y; item.rotation = r;
        applyCalibrationToElement(id);
        exportCalibrationToTextarea();
      }
      // ranges update numbers and live apply
      [xRange,xNum].forEach(i=> i.addEventListener("input", ()=>{ xRange.value = xNum.value = i.value; setItemFromInputs(); }));
      [yRange,yNum].forEach(i=> i.addEventListener("input", ()=>{ yRange.value = yNum.value = i.value; setItemFromInputs(); }));
      [rRange,rNum].forEach(i=> i.addEventListener("input", ()=>{ rRange.value = rNum.value = i.value; setItemFromInputs(); }));

      apply.addEventListener("click", ()=>{ setItemFromInputs(); alert("Applied to calibrationData and preview updated."); });
      restore.addEventListener("click", ()=>{ // restore element's recorded x,y,rotation from calibrationData and re-read
        const elDom = document.getElementById(id);
        if(!elDom) { alert("Element not present in DOM to restore."); return; }
        elDom.style.left = item.x + "px";
        elDom.style.top  = item.y + "px";
        elDom.style.transform = "rotate(" + (item.rotation||0) + "deg)";
        rebuildCalibList();
        exportCalibrationToTextarea();
      });
    });
  }

  // export/import helpers
  function exportCalibrationToTextarea(){
    const ta = document.getElementById("dev_calib_export");
    if(!ta) return;
    try {
      const slim = {};
      Object.keys(calibrationData||{}).forEach(id=>{
        const {x,y,rotation} = calibrationData[id];
        slim[id] = { x: Math.round(x), y: Math.round(y), rotation: (rotation||0) };
      });
      ta.value = JSON.stringify(slim, null, 2);
    } catch(err){
      ta.value = "// error exporting calibrationData";
    }
  }
  function exportCalibrationJSON(){
    exportCalibrationToTextarea();
    const ta = document.getElementById("dev_calib_export");
    if(ta){ ta.select(); document.execCommand('copy'); alert("Calibration JSON copied to clipboard."); }
  }
  function importCalibrationJSONPrompt(){
    const json = prompt("Paste calibration JSON here (will replace existing calibrationData values for matching keys).");
    if(!json) return;
    try {
      const obj = JSON.parse(json);
      Object.keys(obj).forEach(k=>{
        if(calibrationData[k]){
          calibrationData[k].x = obj[k].x;
          calibrationData[k].y = obj[k].y;
          calibrationData[k].rotation = obj[k].rotation||0;
          applyCalibrationToElement(k);
        } else {
          // add new entry if needed
          calibrationData[k] = { name: k, x: obj[k].x, y: obj[k].y, rotation: obj[k].rotation||0 };
          registerCalibratable(k, k, obj[k].x, obj[k].y, obj[k].rotation||0);
        }
      });
      rebuildCalibList();
      exportCalibrationToTextarea();
      alert("Imported calibration values and updated preview.");
    } catch(err){
      alert("Invalid JSON: " + (err&&err.message));
    }
  }

  // apply overrides: monkey-patch certain app functions to honor DT.override values
  function applyOverrides(){
    // 1) allow SM ribbons to show for cadets by changing buildRibbonGrid behavior
    if(!DT.orig.buildRibbonGrid) DT.orig.buildRibbonGrid = window.buildRibbonGrid;
    window.buildRibbonGrid = function(){
      // call original but temporarily spoof State.member if allowSMforCadets is true
      const savedMember = State.member;
      if(DT.override.allowSMforCadets) State.member = "senior";
      try {
        return DT.orig.buildRibbonGrid();
      } finally {
        State.member = savedMember;
        // rebuild UI to show new ribbon cards
      }
    };

    // 2) patch renderAllBadges to respect DT.override.maxBadges
    if(!DT.orig.renderAllBadges) DT.orig.renderAllBadges = window.renderAllBadges;
    window.renderAllBadges = function(){
      // monkey patch local maxTotal usage by calling original with temporary override
      // We'll replace State._dev_maxBadges which our wrapper uses
      const origMax = 5; // original code hard-coded 5; we cannot change inside orig, so implement a full replacement:
      // Implement a adapted copy of original logic but consult DT.override.maxBadges
      // We'll mimic the original but with dynamic max
      [...uniformCanvas.querySelectorAll('.layer.badge')].forEach(n=>n.remove());
      resetBadgeSlots();
      if(!UI_AUTHZ[State.uniform]?.showBadges) return;

      const maxTotal = DT.override.enabled ? (DT.override.maxBadges || 999) : (DT.override.maxBadges || 5);
      const applied=[];
      for(const id of State.badges){
        if(State.member==='cadet' && !isCadetAuthorized(id) && !DT.override.allowSMforCadets){ continue; }
        if(applied.length>=maxTotal) break;
        placeBadgeByCategory(id);
        applied.push(id);
      }
    };

    // 3) bypass UI lock styling (remove 'locked' class on uniform buttons)
    if(DT.override.bypassUILocks){
      document.querySelectorAll('.uniformOption.locked').forEach(el=>el.classList.remove('locked'));
    } else {
      // re-run normal applyMemberTypeToUniformOptions to restore locks
      if(window.applyMemberTypeToUniformOptions) applyMemberTypeToUniformOptions();
    }

    // mark override enabled
    DT.override.enabled = DT.override.bypassUILocks || DT.override.allowSMforCadets || (DT.override.maxBadges !== 999);
    // rebuild ribbon grid and badges to take effect
    try { buildRibbonGrid(); renderRack(); renderAllBadges(); } catch(e){}
  }

  // small utility: keep panel in sync with calibrationData changes
  function patchCalibrationRegistration(){
    // override registerCalibratable to call rebuildCalibList when new entries are registered
    if(!window.registerCalibratable) return;
    if(DT.orig.registerCalibratable) return; // already patched
    DT.orig.registerCalibratable = window.registerCalibratable;
    window.registerCalibratable = function(elementId, displayName, initialX, initialY, initialRot=0){
      const ret = DT.orig.registerCalibratable(elementId, displayName, initialX, initialY, initialRot);
      // refresh dev UI list
      setTimeout(()=>{ rebuildCalibList(); exportCalibrationToTextarea(); }, 50);
      return ret;
    };
  }

  // initial mount / auto-patch attempts
  function init(){
    mountDevToggle();
    patchCalibrationRegistration();
    // try to rebuild list when app is ready
    setTimeout(()=>{ if(DT.unlocked) openPanel(); }, 400);
    // periodically refresh export textarea
    setInterval(()=>{ if(document.getElementById("dev_calib_export")) exportCalibrationToTextarea(); }, 2000);
  }

  init();

})();
