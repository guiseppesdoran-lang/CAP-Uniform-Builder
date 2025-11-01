// devtools.ui.js
// Developer calibration & override panel for CAP Uniform Builder
// WARNING: password is client-side and NOT secure. Use only locally.

(function(){
  const DEV_PASSWORD = "658773"; // provided by user (insecure client-side)

  // Wait until DOM ready (deferred scripts usually safe, but defensive)
  function onReady(fn){
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  onReady(()=>{

    // Create button in page (small floating wrench)
    const btn = document.createElement('button');
    btn.id = 'devToolsBtn';
    btn.title = 'Developer Tools (password required)';
    btn.style.cssText = `
      position:fixed;left:12px;bottom:12px;z-index:10050;
      width:44px;height:44px;border-radius:8px;border:0;
      background:#111827;color:#fff;font-weight:700;cursor:pointer;
      box-shadow:0 8px 24px rgba(2,6,23,.4);
    `;
    btn.textContent = 'DEV';
    document.body.appendChild(btn);

    // Modal container
    const modal = document.createElement('div');
    modal.id = 'devToolsModal';
    modal.style.cssText = `
      position:fixed;left:0;top:0;right:0;bottom:0;z-index:10060;
      display:none;align-items:flex-start;justify-content:center;
      padding:36px;overflow:auto;background:rgba(2,6,23,0.45);
      -webkit-backdrop-filter: blur(4px);backdrop-filter: blur(4px);
    `;
    modal.innerHTML = `
      <div style="width:920px;max-width:calc(100% - 48px);background:#fff;border-radius:12px;padding:18px;box-shadow:0 20px 60px rgba(2,6,23,.5);">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px">
          <div style="font-weight:800;font-size:16px">Developer Calibration & Overrides</div>
          <div style="display:flex;gap:8px;align-items:center">
            <button id="devExportBtn" style="padding:8px 10px">Export JSON</button>
            <button id="devImportBtn" style="padding:8px 10px">Import JSON</button>
            <button id="closeDevBtn" style="padding:8px 10px">Close</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 360px;gap:14px">
          <div style="min-width:0">

            <section class="panelBlock" style="margin-bottom:10px;">
              <div style="font-weight:700;margin-bottom:6px">Password Unlock</div>
              <div style="display:flex;gap:8px;align-items:center">
                <input id="devPassword" type="password" placeholder="Enter developer password" style="flex:1;padding:8px;border:1px solid #e5e7eb;border-radius:8px" />
                <button id="devUnlockBtn" style="padding:8px 10px">Unlock</button>
                <div id="devStatus" style="margin-left:8px;color:#6b7280;font-size:13px">locked</div>
              </div>
              <div style="font-size:12px;color:#6b7280;margin-top:8px">
                WARNING: client-side password only. Keep file local.
              </div>
            </section>

            <section class="panelBlock" id="devGlobals" style="display:none;margin-bottom:10px">
              <div style="font-weight:700;margin-bottom:6px">Global Calibration</div>

              <div style="display:grid;grid-template-columns:120px 1fr 78px;gap:8px;align-items:center;margin-bottom:6px">
                <label>Rack X</label><input id="dev_rackX" type="range" min="-200" max="700" step="1" /><input id="dev_rackX_num" type="number" style="width:70px;padding:6px" />
              </div>
              <div style="display:grid;grid-template-columns:120px 1fr 78px;gap:8px;align-items:center;margin-bottom:6px">
                <label>Rack Y</label><input id="dev_rackY" type="range" min="-50" max="900" step="1" /><input id="dev_rackY_num" type="number" style="width:70px;padding:6px"/>
              </div>

              <div style="display:grid;grid-template-columns:120px 1fr 78px;gap:8px;align-items:center;margin-bottom:6px">
                <label>Ribbon W</label><input id="dev_ribbonW" type="range" min="6" max="80" step="0.1" /><input id="dev_ribbonW_num" type="number" style="width:70px;padding:6px"/>
              </div>
              <div style="display:grid;grid-template-columns:120px 1fr 78px;gap:8px;align-items:center;margin-bottom:6px">
                <label>Ribbon H</label><input id="dev_ribbonH" type="range" min="3" max="80" step="0.1" /><input id="dev_ribbonH_num" type="number" style="width:70px;padding:6px"/>
              </div>

              <div style="display:grid;grid-template-columns:120px 1fr 78px;gap:8px;align-items:center;">
                <label>Ribbon Gap Y</label><input id="dev_gapY" type="range" min="-10" max="40" step="0.1" /><input id="dev_gapY_num" type="number" style="width:70px;padding:6px"/>
              </div>

              <div style="margin-top:10px;font-size:13px;color:#374151">
                <label style="display:inline-flex;align-items:center;gap:8px">
                  <input id="dev_forceMini" type="checkbox" /> Force Mini Medals
                </label>
              </div>
            </section>

            <section class="panelBlock" id="devPerElement" style="display:none;margin-bottom:10px">
              <div style="font-weight:700;margin-bottom:6px">Per-element Calibration</div>
              <div style="font-size:13px;color:#6b7280;margin-bottom:8px">Choose an element to edit (ribbonRack, badges, patches, nameplate, ranks, etc.)</div>
              <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
                <select id="devElementSelect" style="flex:1;padding:6px;border:1px solid #e5e7eb;border-radius:6px"></select>
                <button id="devLoadElement" style="padding:6px 10px">Edit</button>
              </div>
              <div id="devElementEditor" style="display:none">
                <div style="display:grid;grid-template-columns:80px 1fr 80px;gap:8px;align-items:center;margin-bottom:6px">
                  <label>X</label><input id="el_x" type="range" min="-400" max="900" step="1" /><input id="el_x_num" type="number" style="width:70px;padding:6px"/>
                </div>
                <div style="display:grid;grid-template-columns:80px 1fr 80px;gap:8px;align-items:center;margin-bottom:6px">
                  <label>Y</label><input id="el_y" type="range" min="-400" max="1200" step="1" /><input id="el_y_num" type="number" style="width:70px;padding:6px"/>
                </div>
                <div style="display:grid;grid-template-columns:80px 1fr 80px;gap:8px;align-items:center;margin-bottom:6px">
                  <label>ROT</label><input id="el_rot" type="range" min="-180" max="180" step="0.5" /><input id="el_rot_num" type="number" style="width:70px;padding:6px"/>
                </div>
                <div style="display:flex;gap:8px;margin-top:8px">
                  <button id="saveElBtn" style="padding:6px 10px">Save</button>
                  <button id="resetElBtn" style="padding:6px 10px" class="ghost">Reset from DOM</button>
                </div>
              </div>
            </section>

            <section class="panelBlock" id="devOverrides" style="display:none;">
              <div style="font-weight:700;margin-bottom:6px">CAPR Limits & Overrides</div>
              <label style="display:block;margin-bottom:8px"><input id="dev_overrideRules" type="checkbox" /> Allow overrides of CAPR limits (max badges, cadet filter, exclusive pairs)</label>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
                <div>
                  <label>Max total badges</label>
                  <input id="dev_maxBadges" type="number" min="0" max="20" value="5" style="width:100%;padding:6px;border-radius:6px;border:1px solid #e5e7eb"/>
                </div>
                <div>
                  <label>Over-rack vertical offset (px)</label>
                  <input id="dev_overstackOffset" type="number" value="25" style="width:100%;padding:6px;border-radius:6px;border:1px solid #e5e7eb"/>
                </div>
              </div>
            </section>

          </div>

          <div>
            <section class="panelBlock" id="devPreview" style="height:380px;overflow:auto">
              <div style="font-weight:700;margin-bottom:6px">Live Preview & Actions</div>
              <div style="display:flex;flex-direction:column;gap:8px">
                <button id="devApplyBtn" style="padding:8px 10px">Apply All & Re-render</button>
                <button id="devUpdateCalUI" style="padding:8px 10px">Refresh Calibration UI</button>
                <button id="devCopyCalBtn" style="padding:8px 10px">Copy calibration JSON (clipboard)</button>
                <textarea id="devJsonOut" style="width:100%;height:180px;font-family:ui-monospace,monospace;padding:8px"></textarea>
              </div>
            </section>

            <section class="panelBlock" style="margin-top:10px">
              <div style="font-weight:700;margin-bottom:6px">Notes</div>
              <div style="font-size:13px;color:#6b7280">
                1) Use Export to copy a single JSON blob of globals + calibrationData + overrides.<br/>
                2) Paste that JSON in chat so I can help refine positions. I cannot fetch it automatically.<br/>
                3) This unlock will also let you temporarily bypass CAPR checks for testing. Please re-enable before official use.
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
    `;
    document.body.appendChild(modal);

    // Helpers to get globals from the original app.
    function safeGet(name, fallback){
      try{ return window[name]!==undefined ? window[name] : fallback; }catch(e){ return fallback; }
    }

    // Bind UI elements
    const devStatus = modal.querySelector('#devStatus');
    const devUnlockBtn = modal.querySelector('#devUnlockBtn');
    const devPasswordInput = modal.querySelector('#devPassword');
    const closeDevBtn = modal.querySelector('#closeDevBtn');
    const devGlobals = modal.querySelector('#devGlobals');
    const devPerElement = modal.querySelector('#devPerElement');
    const devOverrides = modal.querySelector('#devOverrides');
    const devPreview = modal.querySelector('#devPreview');

    const el = id => modal.querySelector('#' + id);

    // unlocking
    function setUnlocked(unlocked){
      if(unlocked){
        devStatus.textContent = 'unlocked';
        devStatus.style.color='#059669';
        devGlobals.style.display='block';
        devPerElement.style.display='block';
        devOverrides.style.display='block';
        devPreview.style.display='block';
        // populate element select
        populateElementSelect();
        populateGlobalInputs();
        populateOverrideInputs();
      } else {
        devStatus.textContent = 'locked';
        devStatus.style.color='#6b7280';
        devGlobals.style.display='none';
        devPerElement.style.display='none';
        devOverrides.style.display='none';
        devPreview.style.display='none';
      }
    }

    devUnlockBtn.addEventListener('click', ()=>{
      const val = devPasswordInput.value || '';
      if(val === DEV_PASSWORD){
        setUnlocked(true);
      } else {
        setUnlocked(false);
        alert('Incorrect developer password.');
      }
    });

    btn.addEventListener('click', ()=>{
      modal.style.display = 'flex';
    });
    closeDevBtn.addEventListener('click', ()=> modal.style.display='none');

    // Populate element select with calibrationData keys (if present) + some known anchors
    function populateElementSelect(){
      const sel = el('devElementSelect');
      sel.innerHTML = '';
      const known = safeGet('calibrationData', {}) || {};
      const keys = Object.keys(known);
      // add some well-known anchors as options if they don't exist
      const extras = ['ribbonRack','nameplate-el','enlisted-rank','shoulder-left-insignia','shoulder-right-insignia'];
      const all = Array.from(new Set([...keys, ...extras]));
      all.forEach(k=>{
        const o = document.createElement('option');
        o.value = k;
        o.textContent = k;
        sel.appendChild(o);
      });
    }

    // Populate global inputs from existing page variables
    function populateGlobalInputs(){
      const rackX = safeGet('rackBaseX', 259);
      const rackY = safeGet('rackBaseY', 206);
      const RIBW = safeGet('RIBBON_WIDTH', 23);
      const RIBH = safeGet('RIBBON_HEIGHT', 7.2);
      const GAPY = safeGet('RIBBON_GAP_Y', 2);

      el('dev_rackX').value = rackX; el('dev_rackX_num').value = rackX;
      el('dev_rackY').value = rackY; el('dev_rackY_num').value = rackY;
      el('dev_ribbonW').value = RIBW; el('dev_ribbonW_num').value = RIBW;
      el('dev_ribbonH').value = RIBH; el('dev_ribbonH_num').value = RIBH;
      el('dev_gapY').value = GAPY; el('dev_gapY_num').value = GAPY;

      el('dev_forceMini').checked = !!(safeGet('State',{}).forceMini);
    }

    // Populate overrides inputs
    function populateOverrideInputs(){
      const maxBadges = safeGet('maxTotal', 5); // note: app uses internal var; we'll default
      el('dev_maxBadges').value = safeGet('maxTotal', 5) || 5;
      el('dev_overstackOffset').value = 25;
      el('dev_overrideRules').checked = !!(safeGet('State',{}).overrideRules || false);
    }

    // wire ranges <-> numbers for globals
    function wireRangePair(rangeId, numId, onChange){
      const r = el(rangeId), n = el(numId);
      if(!r || !n) return;
      r.addEventListener('input', ()=>{
        n.value = r.value;
        if(onChange) onChange(Number(r.value));
      });
      n.addEventListener('input', ()=>{
        let v = Number(n.value);
        if(isNaN(v)) v = 0;
        r.value = v;
        if(onChange) onChange(v);
      });
    }

    // apply global changes to page variables
    function applyGlobalToPage(){
      // mutate global variables used by app
      window.rackBaseX = Number(el('dev_rackX_num').value);
      window.rackBaseY = Number(el('dev_rackY_num').value);
      window.RIBBON_WIDTH = Number(el('dev_ribbonW_num').value);
      window.RIBBON_HEIGHT= Number(el('dev_ribbonH_num').value);
      window.RIBBON_GAP_Y = Number(el('dev_gapY_num').value);

      // state force mini
      if(window.State) window.State.forceMini = !!el('dev_forceMini').checked;

      // overrides: set a flag on State to be used by app logic (app code must check State.overrideRules where relevant)
      if(window.State){
        window.State.overrideRules = !!el('dev_overrideRules').checked;
        // store max badges on state for render to read
        window.State.dev_maxBadges = Number(el('dev_maxBadges').value);
        window.State.dev_overstackOffset = Number(el('dev_overstackOffset').value);
      }

      // re-render pipeline if available
      triggerRerender();
    }

    // wire UI controls
    wireRangePair('dev_rackX','dev_rackX_num', v=>{});
    wireRangePair('dev_rackY','dev_rackY_num', v=>{});
    wireRangePair('dev_ribbonW','dev_ribbonW_num', v=>{});
    wireRangePair('dev_ribbonH','dev_ribbonH_num', v=>{});
    wireRangePair('dev_gapY','dev_gapY_num', v=>{});

    // Per-element editor wiring
    el('devLoadElement').addEventListener('click', ()=>{
      const sel = el('devElementSelect').value;
      const storage = safeGet('calibrationData', {});
      const entry = storage && storage[sel];
      if(!entry){
        // create empty initial
        const fallback = { x: 0, y: 0, rotation: 0 };
        el('el_x').value = fallback.x; el('el_x_num').value = fallback.x;
        el('el_y').value = fallback.y; el('el_y_num').value = fallback.y;
        el('el_rot').value = fallback.rotation; el('el_rot_num').value = fallback.rotation;
      } else {
        el('el_x').value = entry.x;
        el('el_x_num').value = entry.x;
        el('el_y').value = entry.y;
        el('el_y_num').value = entry.y;
        el('el_rot').value = entry.rotation;
        el('el_rot_num').value = entry.rotation;
      }
      el('devElementEditor').style.display = 'block';
    });

    function wireElRangePair(rangeId, numId){
      const r = el(rangeId), n = el(numId);
      r.addEventListener('input', ()=>{ n.value = r.value; });
      n.addEventListener('input', ()=>{ r.value = n.value; });
    }
    wireElRangePair('el_x','el_x_num');
    wireElRangePair('el_y','el_y_num');
    wireElRangePair('el_rot','el_rot_num');

    // Save element back to calibrationData and apply
    el('saveElBtn').addEventListener('click', ()=>{
      const key = el('devElementSelect').value;
      if(!window.calibrationData) window.calibrationData = {};
      window.calibrationData[key] = {
        name: window.calibrationData && window.calibrationData[key] ? window.calibrationData[key].name || key : key,
        x: Number(el('el_x_num').value)||0,
        y: Number(el('el_y_num').value)||0,
        rotation: Number(el('el_rot_num').value)||0
      };
      // apply to DOM if element exists
      if(typeof applyCalibrationToElement === 'function'){
        applyCalibrationToElement(key);
      }
      // rebuild UI and export text
      if(typeof rebuildCalibrationUI === 'function') rebuildCalibrationUI();
      if(typeof exportCalibrationJSON === 'function') exportCalibrationJSON();
      alert('Saved calibration for '+key);
    });

    // Reset element from DOM (if DOM node present)
    el('resetElBtn').addEventListener('click', ()=>{
      const key = el('devElementSelect').value;
      const dom = document.getElementById(key);
      if(!dom) { alert('No DOM element found for id: '+key); return; }
      const left = parseFloat(dom.style.left)||0;
      const top  = parseFloat(dom.style.top)||0;
      // rotation detect from transform
      let rot = 0;
      try{
        const m = dom.style.transform || '';
        const match = m.match(/rotate\(([-0-9.]+)deg\)/);
        if(match) rot = Number(match[1]);
      }catch(e){}
      el('el_x_num').value = left; el('el_x').value = left;
      el('el_y_num').value = top;  el('el_y').value = top;
      el('el_rot_num').value = rot; el('el_rot').value = rot;
    });

    // Apply all changes button
    el('devApplyBtn').addEventListener('click', ()=>{
      applyGlobalToPage();
      // some UI updates
      if(typeof rebuildCalibrationUI === 'function') rebuildCalibrationUI();
      if(typeof exportCalibrationJSON === 'function') exportCalibrationJSON();
      if(typeof renderRack === 'function') renderRack();
      if(typeof renderAllBadges === 'function') renderAllBadges();
      if(typeof renderPatches === 'function') renderPatches();
      if(typeof renderRank === 'function') renderRank(window.State ? window.State.rank : null);
      alert('Applied dev changes and re-rendered.');
    });

    // Refresh calibration UI
    el('devUpdateCalUI').addEventListener('click', ()=>{
      if(typeof rebuildCalibrationUI === 'function') rebuildCalibrationUI();
      if(typeof exportCalibrationJSON === 'function') exportCalibrationJSON();
      alert('Calibration UI refreshed.');
    });

    // Copy calibration JSON to textarea & clipboard
    el('devCopyCalBtn').addEventListener('click', async ()=>{
      // assemble JSON: calibrationData + globals + overrides
      const json = buildExportJSON();
      const txt = JSON.stringify(json, null, 2);
      el('devJsonOut').value = txt;
      try{
        await navigator.clipboard.writeText(txt);
        alert('Copied to clipboard.');
      }catch(e){
        alert('Could not copy automatically; JSON is in the text box below.');
      }
    });

    // Export button (top)
    modal.querySelector('#devExportBtn').addEventListener('click', ()=>{
      const json = buildExportJSON();
      const txt = JSON.stringify(json, null, 2);
      el('devJsonOut').value = txt;
      try{
        navigator.clipboard.writeText(txt);
        alert('Exported JSON to clipboard. Paste it into chat to share with me.');
      }catch(e){
        alert('Export prepared in the textarea; copy it manually to share.');
      }
    });

    // Import button: prompt paste
    modal.querySelector('#devImportBtn').addEventListener('click', ()=>{
      const pasted = prompt('Paste calibration/override JSON here (will overwrite existing calibrationData and override flags):');
      if(!pasted) return;
      try{
        const obj = JSON.parse(pasted);
        if(obj.calibrationData) window.calibrationData = obj.calibrationData;
        if(obj.globals){
          if(obj.globals.rackBaseX !== undefined) window.rackBaseX = obj.globals.rackBaseX;
          if(obj.globals.rackBaseY !== undefined) window.rackBaseY = obj.globals.rackBaseY;
          if(obj.globals.RIBBON_WIDTH !== undefined) window.RIBBON_WIDTH = obj.globals.RIBBON_WIDTH;
          if(obj.globals.RIBBON_HEIGHT!== undefined) window.RIBBON_HEIGHT = obj.globals.RIBBON_HEIGHT;
          if(obj.globals.RIBBON_GAP_Y !== undefined) window.RIBBON_GAP_Y = obj.globals.RIBBON_GAP_Y;
        }
        if(obj.overrides){
          if(window.State) {
            window.State.overrideRules = !!obj.overrides.overrideRules;
            window.State.dev_maxBadges = Number(obj.overrides.maxBadges) || window.State.dev_maxBadges;
            window.State.dev_overstackOffset = Number(obj.overrides.overstackOffset) || window.State.dev_overstackOffset;
          }
        }
        if(typeof rebuildCalibrationUI === 'function') rebuildCalibrationUI();
        if(typeof exportCalibrationJSON === 'function') exportCalibrationJSON();
        triggerRerender();
        alert('Imported JSON applied.');
      }catch(e){
        alert('Invalid JSON: ' + e.message);
      }
    });

    // Helper to assemble exportable JSON
    function buildExportJSON(){
      return {
        timestamp: (new Date()).toISOString(),
        globals: {
          rackBaseX: window.rackBaseX,
          rackBaseY: window.rackBaseY,
          RIBBON_WIDTH: window.RIBBON_WIDTH,
          RIBBON_HEIGHT: window.RIBBON_HEIGHT,
          RIBBON_GAP_Y: window.RIBBON_GAP_Y
        },
        calibrationData: window.calibrationData || {},
        overrides: {
          overrideRules: !!(window.State && window.State.overrideRules),
          maxBadges: (window.State && window.State.dev_maxBadges) || 5,
          overstackOffset: (window.State && window.State.dev_overstackOffset) || 25
        },
        note: "Exported from devtools.ui.js (client-side only). Paste into assistant chat to share."
      };
    }

    // Top-level copy to clipboard fallback
    modal.querySelector('#devJsonOut').addEventListener('click', function(){ this.select(); });

    // trigger rerender wrapper
    function triggerRerender(){
      try{
        if(typeof renderRack === 'function') renderRack();
        if(typeof renderAllBadges === 'function') renderAllBadges();
        if(typeof renderPatches === 'function') renderPatches();
        if(typeof renderRank === 'function') renderRank(window.State?window.State.rank:null);
        if(typeof renderNameplate === 'function') renderNameplate();
      }catch(e){
        console.warn('Devtools: error re-rendering', e);
      }
    }

    // update DOM when modal opens (populate with up-to-date values)
    modal.addEventListener('transitionend', ()=>{});
    // expose a global quick open
    window.__openDevTools = ()=>{ modal.style.display='flex'; setTimeout(populateElementSelect,50); populateGlobalInputs(); };

    // Boot: locked by default (do not show internals)
    setUnlocked(false);

    // Wire range pairs for per-element when keys change
    // (already wired above)

    // If user closes by clicking overlay, close modal
    modal.addEventListener('click', e =>{
      if(e.target === modal){
        modal.style.display='none';
      }
    });

    // Expose some utilities on window for advanced use
    window.DevTools = {
      buildExportJSON,
      open: () => { modal.style.display='flex'; },
      close: () => { modal.style.display='none'; },
      unlock: (pw) => { if(pw===DEV_PASSWORD) setUnlocked(true); else alert('bad pw'); }
    };

    // Small UX: copy existing calibration JSON into textarea on open
    btn.addEventListener('click', ()=>{
      setTimeout(()=>{ el('devJsonOut').value = JSON.stringify({
        globals: { rackBaseX: window.rackBaseX, rackBaseY: window.rackBaseY, RIBBON_WIDTH: window.RIBBON_WIDTH, RIBBON_HEIGHT: window.RIBBON_HEIGHT, RIBBON_GAP_Y: window.RIBBON_GAP_Y },
        calibrationData: window.calibrationData || {},
        overrides: { overrideRules: !!(window.State && window.State.overrideRules), maxBadges: (window.State && window.State.dev_maxBadges) || 5 }
      }, null, 2); }, 80);
    });

    // Final: if app already has State, ensure dev flags exist
    if(window.State){
      window.State.overrideRules = window.State.overrideRules || false;
      window.State.dev_maxBadges = window.State.dev_maxBadges || 5;
      window.State.dev_overstackOffset = window.State.dev_overstackOffset || 25;
    }
  });
})();
