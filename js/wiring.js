// Extracted verbatim from index.html: uniform button click, event wiring, the calibrator UI
// and the modal gallery. Loaded between the halves of the inline script so execution order
// is unchanged.

/* ===========================
   UNIFORM BUTTON CLICK
   =========================== */
uniformListEl.addEventListener('click', e=>{
  const btn=e.target.closest('.uniformOption');
  if(!btn) return;
  if(btn.classList.contains('locked')) return;

  const newUniform=btn.dataset.uniformId;
  const prevU=State.uniform;
  State.uniform=newUniform;

  fullRender(prevU);
  refreshUI();
});

/* ===========================
   EVENT WIRING
   =========================== */
const applyJacketBtn = by('applyJacket');
if(applyJacketBtn){
  applyJacketBtn.addEventListener('click', ()=>{
    State.assetBase=(assetBaseInput?.value||'images').trim()||'images';
    fullRender();
    buildRibbonGallery();
    buildBadgeGallery();
    buildPatchGallery();
  });
}
if(assetBaseInput){
  assetBaseInput.addEventListener('change', ()=>{
    State.assetBase=(assetBaseInput.value||'images').trim()||'images';
    fullRender();
    buildRibbonGallery();
    buildBadgeGallery();
    buildPatchGallery();
  });
}

by('toggleMini').addEventListener('change', e=>{
  State.forceMini = e.target.checked;
  renderRack();
  renderAllBadges();
});

const miniMountStyleSelect = by('miniMountStyle');
if(miniMountStyleSelect){
  miniMountStyleSelect.value = State.miniMountStyle;
  miniMountStyleSelect.addEventListener('change', e=>{
    State.miniMountStyle = e.target.value === 'holding' ? 'holding' : 'mounting';
    renderRack();
    renderMeasurementOverlay();
  });
}

const measurementOverlayToggle = by('toggleMeasurementOverlay');
if(measurementOverlayToggle){
  measurementOverlayToggle.dataset.measurementToggleWired = '1';
  measurementOverlayToggle.addEventListener('change', e=>{
    State.showMeasurementOverlay = !!e.target.checked;
    if(State.showMeasurementOverlay){
      renderMeasurementOverlay();
    }else{
      clearMeasurementOverlay();
    }
  });
}

buildDevicePicker();
wireDeviceUI();

/* Ribbon gallery buttons */
by('clearRibbons').addEventListener('click', ()=>{
  State.ribbons=[];
  State.ribbonSelections={};
  buildRibbonGallery();
  renderRack();
  renderAllBadges();
});
by('capSelectAllBasic')?.addEventListener('click',()=>selectAllCapUniformAwards({maximum:false}));
by('capSelectAllMax')?.addEventListener('click',()=>selectAllCapUniformAwards({maximum:true}));

/* Badge gallery buttons */
by('clearBadges').addEventListener('click', ()=>{
  State.badges=[];
  State.badgeSelections={};
  buildBadgeGallery();
  renderAllBadges();
});

/* Patch gallery buttons */
by('clearPatches').addEventListener('click', ()=>{
  State.patches=[];
  State.patchSelections={};
  State.unitPatchCharter='';
  const unitSearch = by('unitPatchSearch');
  if(unitSearch) unitSearch.value='';
  buildPatchGallery();
  if(typeof buildUnitPatchSelector === 'function') buildUnitPatchSelector('');
  renderPatches();
});


const EXPORT_PADDING_X = 180;
const EXPORT_PADDING_Y = 180;

function buildCenteredExportStage(){
  // Use the canvas's untransformed layout size. getBoundingClientRect() includes
  // preview zoom and caused the cloned export canvas to be resized independently
  // from its absolutely-positioned children.
  const computed = getComputedStyle(uniformCanvas);
  const srcW = Math.round(
    uniformCanvas.offsetWidth ||
    parseFloat(computed.width) ||
    (State.uniform && ['ocp','abu','corporate_field','cfu','cfdu','fdu','flight_suit'].includes(State.uniform) ? 969.6 : 450)
  );
  const srcH = Math.round(
    uniformCanvas.offsetHeight ||
    parseFloat(computed.height) ||
    (State.uniform && ['ocp','abu','corporate_field','cfu','cfdu','fdu','flight_suit'].includes(State.uniform) ? 707.52 : 600)
  );
  const exportW = srcW + (EXPORT_PADDING_X * 2);
  const exportH = srcH + (EXPORT_PADDING_Y * 2);

  const stage = document.createElement('div');
  stage.id = 'capubExportStage';
  stage.style.position = 'fixed';
  stage.style.left = '-10000px';
  stage.style.top = '0';
  stage.style.width = `${exportW}px`;
  stage.style.height = `${exportH}px`;
  stage.style.background = '#ffffff';
  stage.style.overflow = 'hidden';
  stage.style.pointerEvents = 'none';
  stage.style.zIndex = '-1';

  const clone = uniformCanvas.cloneNode(true);
  clone.id = 'capubExportUniformCanvas';
  clone.classList.remove('calib-selectable','drag-mode-on');
  clone.style.position = 'absolute';
  clone.style.left = `${Math.round((exportW - srcW) / 2)}px`;
  clone.style.top = `${Math.round((exportH - srcH) / 2)}px`;
  clone.style.width = `${srcW}px`;
  clone.style.height = `${srcH}px`;
  clone.style.background = 'transparent';
  clone.style.borderRadius = '0';
  clone.style.transform = 'none';
  clone.querySelectorAll('.calib-selected').forEach(el => el.classList.remove('calib-selected'));

  stage.appendChild(clone);
  document.body.appendChild(stage);
  return stage;
}

function applyCssPolygonClipToCanvas(ctx, clipPath, width, height){
  const match = /^polygon\((.*)\)$/i.exec(String(clipPath || '').trim());
  if(!match) return false;

  const points = match[1].split(',').map(pair => {
    const values = pair.trim().split(/\s+/);
    if(values.length < 2) return null;
    const resolve = (token, size) => token.endsWith('%')
      ? (parseFloat(token) / 100) * size
      : parseFloat(token);
    const x = resolve(values[0], width);
    const y = resolve(values[1], height);
    return Number.isFinite(x) && Number.isFinite(y) ? [x - width/2, y - height/2] : null;
  }).filter(Boolean);

  if(points.length < 3) return false;
  ctx.beginPath();
  points.forEach(([x,y], index) => index ? ctx.lineTo(x,y) : ctx.moveTo(x,y));
  ctx.closePath();
  ctx.clip();
  return true;
}

function syncRibbonRackColumnsControl(){
  const select = by('ribbonRackColumns');
  const hint = by('ribbonRackColumnsHint');
  const arrangementSelect = by('ribbonRackArrangement');
  const arrangementHint = by('ribbonRackArrangementHint');
  if(!select) return;

  const classA = State.uniform === 'blues_a';
  const preferredLayout = ['3','4-left','4-center'].includes(String(State.ribbonRackLayout))
    ? String(State.ribbonRackLayout)
    : '4-left';
  select.disabled = !classA;
  select.value = classA ? preferredLayout : '3';

  if(hint){
    hint.textContent = classA && preferredLayout === '4-center'
      ? 'Visual realism option: the complete left-aligned four-across rack is shifted as one unit until its rows of four are centered over the pocket. This option is not in accordance with CAPR 39-1.'
      : classA
        ? 'Choose three across, or align a four-across rack with the wearer-left/outboard pocket edge. Rows have no spacing.'
        : 'CAPR 39-1 requires rows of three on Class B and aviator shirts. Four-across is available only on Class A.';
  }

  if(arrangementSelect){
    const preferredArrangement = State.ribbonRackArrangement === 'standard' ? 'standard' : 'lapel';
    arrangementSelect.disabled = !classA;
    arrangementSelect.value = classA ? preferredArrangement : 'standard';
  }
  if(arrangementHint){
    arrangementHint.textContent = classA
      ? 'Automatic mode uses the standard three-ribbon layout while every ribbon has 51% or less lapel coverage. It switches to four across only if a ribbon exceeds 51%; the rack-width selection controls that four-column fallback alignment.'
      : 'Lapel-avoidance ribbon arrangements apply only to the Class A service coat.';
  }
  syncRibbonRowOverrideControl();
}

function getAutomaticRibbonRowCounts(){
  const items=sortRibbons(State.ribbons || []);
  if(!items.length) return [];
  let layout=getRibbonLayout();
  let useFourColumnLapelLayout=false;
  if(State.uniform==='blues_a' && State.ribbonRackArrangement==='lapel'){
    const decision=getAutomaticClassARibbonLayout(items);
    layout=decision.layout;
    useFourColumnLapelLayout=decision.useFourColumns;
  }
  if(useFourColumnLapelLayout && State.ribbonRackLayout==='4-center'){
    // Row selection must match the left-aligned version exactly; centering is a
    // render-only translation and must not change any upper-row composition.
    layout=getRibbonLayout('blues_a','4-left');
  }
  const rows=useFourColumnLapelLayout
    ? buildLapelAvoidanceRowsHighToLow(items,layout.columns,layout)
    : buildRibbonRowsHighToLow(items,layout.columns);
  return rows.map(row=>row.length);
}

function syncRibbonRowOverrideControl(){
  const checkbox=by('ribbonRowOverrideEnabled');
  const controls=by('ribbonRowOverrideControls');
  const grid=by('ribbonRowOverrideGrid');
  const status=by('ribbonRowOverrideStatus');
  if(!checkbox || !controls || !grid || !status) return;

  const classA=State.uniform==='blues_a';
  checkbox.disabled=!classA;
  checkbox.checked=classA && !!State.ribbonRowOverrideEnabled;
  controls.classList.toggle('hidden',!checkbox.checked);
  if(!checkbox.checked){ grid.innerHTML=''; return; }

  const columns=getRibbonLayout().columns;
  const selectedCount=(State.ribbons || []).length;
  let counts=Array.isArray(State.ribbonRowOverride)
    ? State.ribbonRowOverride.map(Number).filter(Number.isInteger)
    : [];
  if(!counts.length || counts.some(count=>count<1 || count>columns)){
    counts=getAutomaticRibbonRowCounts();
    State.ribbonRowOverride=[...counts];
  }

  grid.innerHTML='';
  counts.forEach((count,rowIndex)=>{
    const row=document.createElement('div');
    row.className='ribbonOverrideRow';
    const label=document.createElement('span');
    label.className='ribbonOverrideRowLabel';
    label.textContent=rowIndex===0 ? 'Top row' : `Row ${rowIndex+1}`;
    row.appendChild(label);

    for(let choice=1; choice<=4; choice++){
      const button=document.createElement('button');
      button.type='button';
      button.className='ribbonOverrideCount';
      button.textContent=String(choice);
      button.disabled=choice>columns;
      button.classList.toggle('active',choice===count);
      button.setAttribute('aria-label',`${label.textContent}: ${choice} ribbon${choice===1?'':'s'}`);
      button.addEventListener('click',()=>{
        State.ribbonRowOverride[rowIndex]=choice;
        renderRack();
        renderAllBadges();
        renderMeasurementOverlay();
      });
      row.appendChild(button);
    }
    grid.appendChild(row);
  });

  const total=counts.reduce((sum,count)=>sum+count,0);
  const valid=selectedCount>0 && total===selectedCount;
  status.dataset.valid=String(valid);
  status.textContent=!selectedCount
    ? 'Select ribbons before building a custom row grid.'
    : valid
      ? `${total} ribbons assigned. Custom override is active.`
      : `${total} assigned; ${selectedCount} selected. Adjust the row counts to activate the override.`;

  const addButton=by('addRibbonOverrideRow');
  const removeButton=by('removeRibbonOverrideRow');
  if(addButton) addButton.disabled=!selectedCount || counts.length>=selectedCount;
  if(removeButton) removeButton.disabled=!selectedCount || counts.length<=1;
}

const ribbonRackColumnsSelect = by('ribbonRackColumns');
if(ribbonRackColumnsSelect){
  ribbonRackColumnsSelect.addEventListener('change', e=>{
    State.ribbonRackLayout = ['3','4-left','4-center'].includes(e.target.value)
      ? e.target.value
      : '4-left';
    if(State.ribbonRackLayout === '4-center'){
      alert('The 4 across — centered above welt/pocket option is more realistic for the preview, but it is not in accordance with CAPR 39-1.');
    }
    syncRibbonRackColumnsControl();
    renderRack();
    renderAllBadges();
    renderMeasurementOverlay();
  });
}

const ribbonRackArrangementSelect = by('ribbonRackArrangement');
if(ribbonRackArrangementSelect){
  ribbonRackArrangementSelect.addEventListener('change', e=>{
    State.ribbonRackArrangement = e.target.value === 'standard' ? 'standard' : 'lapel';
    syncRibbonRackColumnsControl();
    renderRack();
    renderAllBadges();
    renderMeasurementOverlay();
  });
}

const ribbonRowOverrideEnabled=by('ribbonRowOverrideEnabled');
if(ribbonRowOverrideEnabled){
  ribbonRowOverrideEnabled.addEventListener('change',e=>{
    State.ribbonRowOverrideEnabled=State.uniform==='blues_a' && !!e.target.checked;
    if(State.ribbonRowOverrideEnabled){
      State.ribbonRowOverride=getAutomaticRibbonRowCounts();
    }
    syncRibbonRowOverrideControl();
    renderRack();
    renderAllBadges();
    renderMeasurementOverlay();
  });
}

const addRibbonOverrideRow=by('addRibbonOverrideRow');
if(addRibbonOverrideRow){
  addRibbonOverrideRow.addEventListener('click',()=>{
    State.ribbonRowOverride=[1,...normalizeRibbonRowOverride(State.ribbonRowOverride,getRibbonLayout().columns)];
    renderRack();
    renderAllBadges();
    renderMeasurementOverlay();
  });
}

const removeRibbonOverrideRow=by('removeRibbonOverrideRow');
if(removeRibbonOverrideRow){
  removeRibbonOverrideRow.addEventListener('click',()=>{
    const counts=normalizeRibbonRowOverride(State.ribbonRowOverride,getRibbonLayout().columns);
    if(counts.length>1) counts.shift();
    State.ribbonRowOverride=counts;
    renderRack();
    renderAllBadges();
    renderMeasurementOverlay();
  });
}

async function composeUniformPngCanvas(source, outputScale = 2){
  const width = Math.round(source.offsetWidth || parseFloat(getComputedStyle(source).width) || 450);
  const height = Math.round(source.offsetHeight || parseFloat(getComputedStyle(source).height) || 600);
  const canvas = document.createElement('canvas');
  canvas.width = width * outputScale;
  canvas.height = height * outputScale;
  const ctx = canvas.getContext('2d');
  ctx.scale(outputScale, outputScale);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  const layers = [...source.children]
    .filter(el => el.classList?.contains('layer'))
    .filter(el => !el.classList.contains('measurementOverlay') && !el.classList.contains('measurementArrowLayer'))
    .map((el, order) => {
      const style = getComputedStyle(el);
      const z = Number.parseInt(style.zIndex, 10);
      return { el, style, order, z:Number.isFinite(z) ? z : 0 };
    })
    .sort((a,b) => a.z - b.z || a.order - b.order);

  await Promise.all(layers.map(({el}) => {
    if(!(el instanceof HTMLImageElement)) return Promise.resolve();
    if(el.complete) return el.decode?.().catch(() => undefined) || Promise.resolve();
    return new Promise(resolve => {
      el.addEventListener('load', resolve, {once:true});
      el.addEventListener('error', resolve, {once:true});
    });
  }));

  for(const {el,style} of layers){
    if(style.display === 'none' || style.visibility === 'hidden') continue;
    const x = parseFloat(el.style.left || style.left) || 0;
    const y = parseFloat(el.style.top || style.top) || 0;
    const cssW = parseFloat(el.style.width || style.width) || el.offsetWidth || 0;
    const cssH = parseFloat(el.style.height || style.height) || el.offsetHeight || 0;
    const borderLeft = parseFloat(style.borderLeftWidth) || 0;
    const borderRight = parseFloat(style.borderRightWidth) || 0;
    const borderTop = parseFloat(style.borderTopWidth) || 0;
    const borderBottom = parseFloat(style.borderBottomWidth) || 0;
    const paddingLeft = parseFloat(style.paddingLeft) || 0;
    const paddingRight = parseFloat(style.paddingRight) || 0;
    const paddingTop = parseFloat(style.paddingTop) || 0;
    const paddingBottom = parseFloat(style.paddingBottom) || 0;
    const contentBox = style.boxSizing !== 'border-box';
    const horizontalChrome = borderLeft + borderRight + paddingLeft + paddingRight;
    const verticalChrome = borderTop + borderBottom + paddingTop + paddingBottom;
    const outerW = contentBox ? cssW + horizontalChrome : cssW;
    const outerH = contentBox ? cssH + verticalChrome : cssH;
    const contentW = contentBox ? cssW : Math.max(0, cssW - horizontalChrome);
    const contentH = contentBox ? cssH : Math.max(0, cssH - verticalChrome);
    if(outerW <= 0 || outerH <= 0 || contentW <= 0 || contentH <= 0) continue;

    let rotation = 0;
    if(style.transform && style.transform !== 'none'){
      try{
        const matrix = new DOMMatrixReadOnly(style.transform);
        rotation = Math.atan2(matrix.b, matrix.a);
      }catch(err){
        const match = /rotate\(([-\d.]+)deg\)/i.exec(el.style.transform || '');
        if(match) rotation = Number(match[1]) * Math.PI / 180;
      }
    }

    ctx.save();
    ctx.globalAlpha = Number.parseFloat(style.opacity) || 1;
    // CSS left/top identifies the outer border-box origin. Preserve that box
    // exactly so bordered badges do not shift when the DOM preview is painted
    // into the downloaded PNG.
    ctx.translate(x + outerW/2, y + outerH/2);
    ctx.rotate(rotation);
    applyCssPolygonClipToCanvas(ctx, style.clipPath || style.webkitClipPath, outerW, outerH);

    const outerLeft = -outerW/2;
    const outerTop = -outerH/2;
    const contentLeft = outerLeft + borderLeft + paddingLeft;
    const contentTop = outerTop + borderTop + paddingTop;
    const contentCenterX = contentLeft + contentW/2;
    const contentCenterY = contentTop + contentH/2;

    if(style.backgroundColor && style.backgroundColor !== 'rgba(0, 0, 0, 0)'){
      ctx.fillStyle = style.backgroundColor;
      ctx.fillRect(outerLeft, outerTop, outerW, outerH);
    }

    if(el instanceof HTMLImageElement && el.naturalWidth && el.naturalHeight){
      if(style.objectFit === 'contain'){
        const ratio = Math.min(contentW / el.naturalWidth, contentH / el.naturalHeight);
        const drawW = el.naturalWidth * ratio;
        const drawH = el.naturalHeight * ratio;
        ctx.drawImage(el, contentCenterX - drawW/2, contentCenterY - drawH/2, drawW, drawH);
      }else{
        ctx.drawImage(el, contentLeft, contentTop, contentW, contentH);
      }
    }else{
      const label = String(el.innerText || el.textContent || '').trim();
      if(label){
        ctx.fillStyle = style.color || '#000000';
        ctx.font = `${style.fontWeight || '400'} ${style.fontSize || '12px'} ${style.fontFamily || 'Arial'}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, contentCenterX, contentCenterY, Math.max(1, contentW - 4));
      }
    }

    // Paint each border edge separately. Besides matching asymmetric borders,
    // this keeps the badge artwork centered inside the same content area used
    // by the live browser preview.
    if(borderTop && style.borderTopStyle !== 'none'){
      ctx.fillStyle = style.borderTopColor;
      ctx.fillRect(outerLeft, outerTop, outerW, borderTop);
    }
    if(borderBottom && style.borderBottomStyle !== 'none'){
      ctx.fillStyle = style.borderBottomColor;
      ctx.fillRect(outerLeft, outerTop + outerH - borderBottom, outerW, borderBottom);
    }
    if(borderLeft && style.borderLeftStyle !== 'none'){
      ctx.fillStyle = style.borderLeftColor;
      ctx.fillRect(outerLeft, outerTop, borderLeft, outerH);
    }
    if(borderRight && style.borderRightStyle !== 'none'){
      ctx.fillStyle = style.borderRightColor;
      ctx.fillRect(outerLeft + outerW - borderRight, outerTop, borderRight, outerH);
    }
    ctx.restore();
  }

  return canvas;
}

const toggleRibbonDragBtn = by('toggleRibbonDrag');
const logRibbonCoordsBtn  = by('logRibbonCoords');

toggleRibbonDragBtn.addEventListener('click', ()=>{
  State.ribbonDragMode = !State.ribbonDragMode;
  if(State.ribbonDragMode){
    toggleRibbonDragBtn.textContent = 'Disable Drag Mode';
    toggleRibbonDragBtn.classList.remove('ghost');
    uniformCanvas.classList.add('drag-mode-on');
  }else{
    toggleRibbonDragBtn.textContent = 'Enable Drag Mode';
    toggleRibbonDragBtn.classList.add('ghost');
    uniformCanvas.classList.remove('drag-mode-on');
  }
});

logRibbonCoordsBtn.addEventListener('click', ()=>{
  const data=[];
  uniformCanvas.querySelectorAll('.ribbonTile').forEach(tile=>{
    data.push({
      rid: tile.dataset.rid,
      left: tile.style.left,
      top: tile.style.top,
      width: tile.style.width,
      height: tile.style.height
    });
  });
  console.log('RIBBON_COORD_REPORT', data);
  alert('Ribbon coordinates logged to console.');
});

/* ===========================
   UNIVERSAL CALIBRATOR UI
   =========================== */
function initCalibratorUI(){
  const tab   = by('calibratorTab');
  const arrow = by('calibratorArrow');
  const panel = by('calibratorPanel');

  const btnMode = by('calibToggleMode');
  const pillKey = by('calibKeyPill');

  const calX  = by('calX'),  calXn = by('calXn');
  const calY  = by('calY'),  calYn = by('calYn');
  const calW  = by('calW'),  calWn = by('calWn');
  const calH  = by('calH'),  calHn = by('calHn');
  const calR  = by('calR'),  calRn = by('calRn');

  const btnReset = by('calibReset');
  const btnCopy  = by('calibCopy');
  const btnSaveUniform = by('calibSaveUniform');
  const btnExportAll = by('calibExportAll');
  const btnMasterSession = by('calibMasterSession');
  const btnMasterClear = by('calibMasterClear');

  let open=false;
  // The calibrator is a development tool: it is only reachable when the page is opened with ?dev=1.
  function requireDevMode(){ return CAPUB_DEV; }
  tab.addEventListener('click', ()=>{
    if(!requireDevMode()) return;
    open=!open;
    panel.style.display=open?'block':'none';
    arrow.textContent=open?'‹':'›';
  });

  function updateSelectedVisuals(){
    uniformCanvas.querySelectorAll('.calib-selected').forEach(n=>n.classList.remove('calib-selected'));
    getSelectedCalibKeys().forEach(key=>{
      const el = findLayerByCalibKey(key);
      if(el) el.classList.add('calib-selected');
    });
  }

  function updateSelectionPill(){
    const keys = getSelectedCalibKeys();
    if(!keys.length){
      pillKey.textContent = 'none';
    }else if(keys.length === 1){
      pillKey.textContent = keys[0];
    }else{
      pillKey.textContent = `${keys.length} assets selected`;
      pillKey.title = keys.join('\n');
    }
  }

  function loadControlsFromPrimary(){
    const key = getSelectedCalibKeys()[0];
    if(!key){
      refreshCalibratorReadout();
      return;
    }

    const el = findLayerByCalibKey(key);
    if(!el){
      refreshCalibratorReadout();
      return;
    }

    const st = window.getComputedStyle(el);
    const x = normalizeCalibNumber(st.left,0);
    const y = normalizeCalibNumber(st.top,0);
    const w = normalizeCalibNumber(st.width,0);
    const h = normalizeCalibNumber(st.height,0);

    const o = getCalib(key) || {};
    const r = (o.r !== undefined) ? o.r : 0;

    calX.value=formatCalibNumber(x); calXn.value=formatCalibNumber(x);
    calY.value=formatCalibNumber(y); calYn.value=formatCalibNumber(y);
    calW.value=formatCalibNumber(w); calWn.value=formatCalibNumber(w);
    calH.value=formatCalibNumber(h); calHn.value=formatCalibNumber(h);
    calR.value=formatCalibNumber(r); calRn.value=formatCalibNumber(r);

    refreshCalibratorReadout();
  }

  function setSelected(key, additive=false){
    if(!State.calib.selectedKeys) State.calib.selectedKeys = [];

    if(!key){
      State.calib.selectedKeys = [];
      State.calib.selectedKey = null;
      updateSelectedVisuals();
      updateSelectionPill();
      refreshCalibratorReadout();
      return;
    }

    if(additive){
      const exists = State.calib.selectedKeys.includes(key);
      State.calib.selectedKeys = exists
        ? State.calib.selectedKeys.filter(k=>k!==key)
        : [...State.calib.selectedKeys, key];
    }else{
      State.calib.selectedKeys = [key];
    }

    State.calib.selectedKey = State.calib.selectedKeys[0] || null;
    updateSelectedVisuals();
    updateSelectionPill();
    loadControlsFromPrimary();
  }

  function applyFromControls(){
    const keys = getSelectedCalibKeys();
    if(!keys.length) return;

    const primary = keys[0];
    const primaryEl = findLayerByCalibKey(primary);
    const pst = primaryEl ? window.getComputedStyle(primaryEl) : null;
    const oldPrimary = {
      x: normalizeCalibNumber(pst?.left,0),
      y: normalizeCalibNumber(pst?.top,0),
      w: normalizeCalibNumber(pst?.width,1),
      h: normalizeCalibNumber(pst?.height,1),
      r: (getCalib(primary)?.r !== undefined) ? normalizeCalibNumber(getCalib(primary).r,0) : 0
    };

    const newPrimary = {
      x: normalizeCalibNumber(calXn.value,0),
      y: normalizeCalibNumber(calYn.value,0),
      w: Math.max(.01,normalizeCalibNumber(calWn.value,1)),
      h: Math.max(.01,normalizeCalibNumber(calHn.value,1)),
      r: normalizeCalibNumber(calRn.value,0)
    };

    const dx = newPrimary.x - oldPrimary.x;
    const dy = newPrimary.y - oldPrimary.y;
    const sx = oldPrimary.w ? newPrimary.w / oldPrimary.w : 1;
    const sy = oldPrimary.h ? newPrimary.h / oldPrimary.h : 1;
    const dr = newPrimary.r - oldPrimary.r;

    keys.forEach((key, index) => {
      const el = findLayerByCalibKey(key);
      const st = el ? window.getComputedStyle(el) : null;
      const cur = getCalib(key) || {};
      const current = {
        x: (cur.x !== undefined) ? normalizeCalibNumber(cur.x,0) : normalizeCalibNumber(st?.left,0),
        y: (cur.y !== undefined) ? normalizeCalibNumber(cur.y,0) : normalizeCalibNumber(st?.top,0),
        w: (cur.w !== undefined) ? normalizeCalibNumber(cur.w,1) : normalizeCalibNumber(st?.width,1),
        h: (cur.h !== undefined) ? normalizeCalibNumber(cur.h,1) : normalizeCalibNumber(st?.height,1),
        r: (cur.r !== undefined) ? normalizeCalibNumber(cur.r,0) : 0
      };

      const next = index === 0 ? newPrimary : {
        x: normalizeCalibNumber(current.x + dx,0),
        y: normalizeCalibNumber(current.y + dy,0),
        w: Math.max(.01,normalizeCalibNumber(current.w * sx,1)),
        h: Math.max(.01,normalizeCalibNumber(current.h * sy,1)),
        r: normalizeCalibNumber(current.r + dr,0)
      };

      setCalib(key, next);
      if(el){
        el.style.left = next.x+'px';
        el.style.top  = next.y+'px';
        el.style.width  = next.w+'px';
        el.style.height = next.h+'px';
        el.style.transform = `rotate(${next.r}deg)`;
        el.style.transformOrigin='center center';
      }
    });

    refreshCalibratorReadout();
  }

  function bindPair(rangeEl, numEl){
    rangeEl.addEventListener('input', ()=>{ numEl.value = rangeEl.value; applyFromControls(); });
    numEl.addEventListener('input', ()=>{ rangeEl.value = numEl.value; applyFromControls(); });
  }
  bindPair(calX, calXn);
  bindPair(calY, calYn);
  bindPair(calW, calWn);
  bindPair(calH, calHn);
  bindPair(calR, calRn);

  btnMode.addEventListener('click', ()=>{
    if(!requireDevMode()) return;
    State.calib.enabled = !State.calib.enabled;
    btnMode.textContent = State.calib.enabled ? 'Calibrate Mode: ON' : 'Calibrate Mode: OFF';
    btnMode.classList.toggle('ghost', !State.calib.enabled);

    if(State.calib.enabled){
      uniformCanvas.classList.add('calib-selectable');
    }else{
      uniformCanvas.classList.remove('calib-selectable');
      setSelected(null);
    }
  });

  btnMasterSession?.addEventListener('click',()=>{
    if(!requireDevMode()) return;
    const session=ensureMasterCalibrationSession();
    session.active=!session.active;
    if(session.active && !session.startedAt) session.startedAt=new Date().toISOString();
    updateMasterCalibrationStatus();
  });

  btnMasterClear?.addEventListener('click',()=>{
    if(!requireDevMode()) return;
    const session=ensureMasterCalibrationSession();
    session.changesByUniform={};
    session.contextByUniform={};
    session.startedAt=session.active ? new Date().toISOString() : null;
    updateMasterCalibrationStatus();
  });

  uniformCanvas.addEventListener('click', (e)=>{
    if(!State.calib.enabled) return;
    const layer = e.target.closest('.layer');
    if(!layer) return;
    const key = calibKeyFor(layer);
    if(!key) return;
    setSelected(key, e.ctrlKey || e.metaKey || e.shiftKey);
    e.preventDefault();
    e.stopPropagation();
  });

  document.addEventListener('keydown', (e)=>{
    if(!State.calib.enabled) return;
    if(!State.calib.selectedKey) return;

    const step = e.shiftKey ? 10 : (e.ctrlKey || e.metaKey) ? 1 : e.altKey ? .01 : .1;
    if(e.key==='ArrowLeft'){  nudgeSelected(-step,0); e.preventDefault(); }
    if(e.key==='ArrowRight'){ nudgeSelected(step,0);  e.preventDefault(); }
    if(e.key==='ArrowUp'){    nudgeSelected(0,-step); e.preventDefault(); }
    if(e.key==='ArrowDown'){  nudgeSelected(0,step);  e.preventDefault(); }
  });

  btnReset.addEventListener('click', ()=>{
    const keys = getSelectedCalibKeys();
    if(!keys.length) return;
    keys.forEach(clearCalib);

    const keep = [...keys];
    fullRender();
    setTimeout(()=> {
      State.calib.selectedKeys = keep;
      State.calib.selectedKey = keep[0] || null;
      updateSelectedVisuals();
      updateSelectionPill();
      loadControlsFromPrimary();
    }, 0);
  });

  btnCopy.addEventListener('click', async ()=>{
    if(!requireDevMode()) return;
    const keys = getSelectedCalibKeys();
    if(!keys.length) return;
    const txt = keys.length === 1 ? buildCalibJson(keys[0]) : buildSelectedCalibJson();

    try{
      await navigator.clipboard.writeText(txt);
      btnCopy.textContent = 'Copied!';
      setTimeout(()=>btnCopy.textContent='Copy Selected', 700);
    }catch{
      const ta=document.createElement('textarea');
      ta.value=txt;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      btnCopy.textContent = 'Copied!';
      setTimeout(()=>btnCopy.textContent='Copy Selected', 700);
    }
  });

  if(btnSaveUniform){
    btnSaveUniform.addEventListener('click', ()=>{
      if(!requireDevMode()) return;
      saveCalibrationToBrowser();
      btnSaveUniform.textContent = 'Saved!';
      setTimeout(()=>btnSaveUniform.textContent='Save Uniform Coords', 900);
      alert(`Coordinates saved in this browser for ${State.uniform || 'the current uniform'}.`);
    });
  }

  if(btnExportAll){
    btnExportAll.addEventListener('click', ()=>{
      if(!requireDevMode()) return;
      saveCalibrationToBrowser();
      downloadCalibrationJson();
    });
  }
  updateMasterCalibrationStatus();
}

/* ===========================
   MODAL GALLERY (Ribbons/Badges/Patches)
   =========================== */
const modalOverlay = by('galleryModalOverlay');
const modalEl      = by('galleryModal');
const modalTitle   = by('galleryModalTitle');
const modalHost    = by('galleryModalHost');
const modalClose   = by('galleryModalCloseBtn');
const modalMaxBtn  = by('galleryModalMaxBtn');
const modalRestore = by('galleryModalRestoreBtn');

let modalLast = null;

function openGalleryModal(kind){
  modalHost.innerHTML = '';

  const host = document.createElement('div');

  const header = document.createElement('div');
  header.style.cssText = "display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;margin-bottom:10px;";
  header.innerHTML = `
    <div style="font-size:12px;color:var(--muted);line-height:1.3;">
      Tip: Drag the bottom-right corner to resize this window.
    </div>
    <div style="display:flex;gap:8px;align-items:center;">
      ${kind==='ribbons' ? '<button id="modalSelectAllBasic" class="ghost" type="button" style="width:auto;padding:8px 10px;border-radius:10px;">Select all (basic)</button><button id="modalSelectAllMax" class="ghost" type="button" style="width:auto;padding:8px 10px;border-radius:10px;">Select max devices</button>' : ''}
      <button id="modalShowLess" class="ghost" type="button" style="width:auto;padding:8px 10px;border-radius:10px;">Show Less</button>
      <button id="modalShowAll" class="ghost" type="button" style="width:auto;padding:8px 10px;border-radius:10px;">Show All</button>
    </div>
  `;
  host.appendChild(header);

  const grid = document.createElement('div');
  grid.className = 'galleryGrid';
  host.appendChild(grid);

  modalHost.appendChild(host);

  function syncFromSidebar(){
    if(kind==='ribbons'){
      const hadMilitaryUI=!!grid.querySelector('details[data-military-section]');
      if(hadMilitaryUI) captureMilitaryGalleryUI(grid,modalHost.parentElement,'modalScrollTop');
      const ui=getMilitaryUIState();
      const modalSnapshot=hadMilitaryUI ? {
        expandedSections:[...(ui.expandedSections || [])],
        modalScrollTop:ui.modalScrollTop,
        focusedControl:ui.focusedControl ? {...ui.focusedControl} : null
      } : null;
      State.ribbonGalleryExpanded = true;
      buildRibbonGallery({capture:false});
      if(modalSnapshot){
        ui.expandedSections=modalSnapshot.expandedSections;
        ui.modalScrollTop=modalSnapshot.modalScrollTop;
        ui.focusedControl=modalSnapshot.focusedControl;
      }
      modalTitle.textContent = "Ribbons / Mini Medals";
      const sidebar = by('ribbonGallery');
      grid.innerHTML = sidebar ? sidebar.innerHTML : '';
      wireModalInteractions('ribbons');
      restoreMilitaryGalleryUI(grid,modalHost.parentElement,'modalScrollTop');
      queueMicrotask(()=>window.CAPUB_refreshModalGallerySearch?.('ribbons'));
    }

    if(kind==='badges'){
      State.badgeGalleryExpanded = true;
      modalTitle.textContent = "Badges";
      buildGroupedBadgeModal(grid);
      return;
    }

    if(kind==='patches'){
      State.patchGalleryExpanded = true;
      buildPatchGallery();
      modalTitle.textContent = "Patches";
      const sidebar = by('patchGallery');
      grid.innerHTML = sidebar ? sidebar.innerHTML : '';
      wireModalInteractions('patches');
    }
  }

  function buildGroupedBadgeModal(rootGrid){
    rootGrid.innerHTML = '';
    normalizeBadgeSelections();

    const eligibleSet = new Set(
      getEligibleBadgeIdsForMembership(State.membership)
    );

    // Clear host and rebuild with headings + subgrids (nice grouping)
    modalHost.innerHTML = '';
    modalHost.appendChild(host);

    const buildTile = id => {
        const sel = State.badgeSelections[id] || {checked:false};
        const title = id.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
        const rareCadetTag = (State.membership === 'cadet' && rareCadetBadges.has(id)) ? ' <span class="validationBadge">Rare Cadet Eligibility</span>' : '';

        const tile = document.createElement('div');
        tile.className = 'galleryTile';
        tile.innerHTML = `
          <img loading="lazy" decoding="async" src="${ASSET(getBadgeAssetPath(id))}" alt="${escapeHtml(title)}">
          <div style="flex:1;min-width:0;">
            <div class="title">${escapeHtml(title)}${rareCadetTag || ''}</div>
            <div class="sub">(${escapeHtml(id)})</div>
            <div class="miniRow">
              <label><input type="checkbox" class="bdChk"> Add</label>
            </div>
            ${id==='squadron_commander_badge' ? `<div class="miniRow"><label><input type="checkbox" class="cmdGradChk"> Graduated commander</label></div>` : ``}
            <div class="sub">Slot: <b>${getBadgeSlotLabel(id)}</b> • Regulation scale: ${Math.round(getBadgeRenderSize(id).width)}×${Math.round(getBadgeRenderSize(id).height)} px</div>
          </div>
        `;

        const chk = tile.querySelector('.bdChk');
        const gradChk = tile.querySelector('.cmdGradChk');
        chk.checked = !!sel.checked;
        if(gradChk) gradChk.checked = !!State.commandInsignia?.graduatedCommander;
        chk.onchange = ()=>{
          sel.checked = chk.checked;
          State.badgeSelections[id] = sel;
          rebuildBadgesFromGallery();
        };
        if(gradChk){
          gradChk.onchange = ()=>{
            if(!State.commandInsignia) State.commandInsignia = {};
            State.commandInsignia.graduatedCommander = gradChk.checked;
            if(gradChk.checked){
              sel.checked = true;
              chk.checked = true;
              State.badgeSelections[id] = sel;
            }
            rebuildBadgesFromGallery();
          };
        }

        return tile;
    };

    const appendCategorizedBadges = (container, allowedIds) => {
      const allowedSet = new Set(allowedIds);
      getBadgeCategoriesForCurrentMembership().forEach(cat=>{
        const ids = cat.ids.filter(id => eligibleSet.has(id) && allowedSet.has(id));
        if(!ids.length) return;

        const h = document.createElement('div');
        h.style.cssText = "margin:10px 0 6px;font-weight:800;color:var(--ink);font-size:13px;";
        h.textContent = cat.key;

        const subGrid = document.createElement('div');
        subGrid.className = 'galleryGrid';
        ids.forEach(id => subGrid.appendChild(buildTile(id)));
        container.appendChild(h);
        container.appendChild(subGrid);
      });
    };

    const eligibleIds = [...eligibleSet];
    const importedAuthorized = Array.isArray(State.reportAuthorizedBadgeIds)
      ? State.reportAuthorizedBadgeIds.filter(id => eligibleSet.has(id))
      : null;

    if(importedAuthorized){
      const authorizedSet = new Set(importedAuthorized);
      const sections = [
        {
          label:`Authorized by Member Report (${importedAuthorized.length})`,
          open:true,
          ids:importedAuthorized,
          empty:'No authorized badges were detected in the imported report.'
        },
        {
          label:'Other Possible Badges',
          open:false,
          ids:eligibleIds.filter(id => !authorizedSet.has(id)),
          empty:'No other eligible badges are available.'
        }
      ];

      sections.forEach(section => {
        const details = document.createElement('details');
        details.open = section.open;
        details.style.cssText = 'margin:8px 0 12px;border:1px solid var(--line);border-radius:12px;padding:8px 10px;background:var(--panel);';
        const summary = document.createElement('summary');
        summary.style.cssText = 'cursor:pointer;font-weight:850;color:var(--ink);padding:4px 0;';
        summary.textContent = section.label;
        details.appendChild(summary);
        if(section.ids.length){
          appendCategorizedBadges(details, section.ids);
        }else{
          const empty = document.createElement('div');
          empty.className = 'sub';
          empty.style.margin = '10px 0 4px';
          empty.textContent = section.empty;
          details.appendChild(empty);
        }
        modalHost.appendChild(details);
      });
    }else{
      appendCategorizedBadges(modalHost, eligibleIds);
    }

    const militaryBadges=getAllSelectableMilitaryBadges();
    if(militaryBadges.length){
      const militaryRoot=document.createElement('details');
      militaryRoot.dataset.militaryBadgeCatalog='true';
      militaryRoot.style.cssText='margin:14px 0 12px;border:1px solid var(--line);border-radius:12px;padding:8px 10px;background:var(--panel);';
      const militarySummary=document.createElement('summary');
      militarySummary.style.cssText='cursor:pointer;font-weight:850;color:var(--ink);padding:4px 0;';
      militarySummary.textContent=`U.S. Military Badges (${militaryBadges.length} with reviewed artwork)`;
      militaryRoot.appendChild(militarySummary);
      const note=document.createElement('div');
      note.className='sub'; note.style.margin='6px 0 8px';
      note.textContent='Only badge variants with reviewed local artwork are selectable. Missing artwork is never substituted.';
      militaryRoot.appendChild(note);

      for(const branch of MILITARY_BRANCH_ORDER){
        const records=militaryBadges.filter(badge=>{
          const services=(badge.authorizedServices || []).filter(service=>MILITARY_BRANCH_ORDER.includes(service));
          return (services.length===1 ? services[0] : 'JOINT')===branch;
        });
        if(!records.length) continue;
        const details=document.createElement('details');
        details.className='militaryBadgeBranchMenu';
        const summary=document.createElement('summary');
        summary.textContent=`${MILITARY_BRANCH_LABELS[branch]} (${records.length})`;
        details.appendChild(summary);
        const branchGrid=document.createElement('div');
        branchGrid.className='galleryGrid';
        for(const badge of records){
          const variants=getAvailableMilitaryBadgeVariants(badge);
          const selected=State.militaryBadges?.[badge.id];
          const activeVariant=selected?.variant || badge.representations?.metal?.defaultVariant || variants[0].id;
          const representation=variants.find(item=>item.id===activeVariant)?.record || variants[0].record;
          const tile=document.createElement('div');
          tile.className='galleryTile militaryBadgeGalleryTile';
          tile.dataset.militaryBadgeId=badge.id;
          const preview=document.createElement('img');
          preview.src=representation.asset; preview.alt=badge.officialName || badge.id;
          const body=document.createElement('div'); body.style.cssText='flex:1;min-width:0;';
          const title=document.createElement('div'); title.className='title'; title.textContent=badge.officialName || badge.id;
          const sub=document.createElement('div'); sub.className='sub'; sub.textContent=`${badge.family || 'OTHER'} • ${(badge.authorizedServices || []).map(service=>MILITARY_BRANCH_LABELS[service] || service).join(' / ')}`;
          const controls=document.createElement('div'); controls.className='miniRow';
          const label=document.createElement('label');
          const checkbox=document.createElement('input'); checkbox.type='checkbox'; checkbox.className='militaryBadgeCatalogCheck'; checkbox.checked=!!selected;
          label.append(checkbox,document.createTextNode(' Add'));
          controls.appendChild(label);
          let variantSelect=null;
          if(variants.length>1){
            variantSelect=document.createElement('select'); variantSelect.className='militaryBadgeVariant'; variantSelect.title='Badge level or variant';
            for(const variant of variants){
              const option=document.createElement('option'); option.value=variant.id;
              option.textContent=variant.id.replaceAll('_',' ').replace(/\b\w/g,letter=>letter.toUpperCase());
              variantSelect.appendChild(option);
            }
            variantSelect.value=activeVariant;
            controls.appendChild(variantSelect);
          }
          checkbox.onchange=()=>{
            if(!State.militaryBadges) State.militaryBadges={};
            if(checkbox.checked) State.militaryBadges[badge.id]={selected:true,variant:variantSelect?.value || activeVariant};
            else delete State.militaryBadges[badge.id];
            fullRender();
          };
          if(variantSelect) variantSelect.onchange=()=>{
            if(!State.militaryBadges) State.militaryBadges={};
            checkbox.checked=true;
            State.militaryBadges[badge.id]={selected:true,variant:variantSelect.value};
            preview.src=getMilitaryBadgeRepresentation(badge).asset;
            fullRender();
          };
          body.append(title,sub,controls); tile.append(preview,body); branchGrid.appendChild(tile);
        }
        details.appendChild(branchGrid); militaryRoot.appendChild(details);
      }
      modalHost.appendChild(militaryRoot);
    }
  }

  function wireModalInteractions(k){
    if(k==='ribbons'){
      wireRibbonTileControls(grid);
      grid.querySelectorAll('.militaryRibbonCatalogSearch').forEach(input=>{
        input.oninput=()=>{
          const ui=getMilitaryUIState();
          ui.gallerySearchValue=input.value;
          ui.focusedControl={ribbonId:'',deviceId:'',className:'militaryRibbonCatalogSearch',selectionStart:input.selectionStart};
          clearTimeout(wireModalInteractions.searchTimer);
          wireModalInteractions.searchTimer=setTimeout(()=>syncFromSidebar(),100);
        };
      });
      grid.querySelectorAll('.militaryRibbonCatalogService,.militaryRibbonCatalogType').forEach(select=>{
        select.onchange=()=>{
          const ui=getMilitaryUIState();
          if(select.classList.contains('militaryRibbonCatalogService')) ui.galleryServiceFilter=select.value || 'ALL';
          else ui.galleryAwardTypeFilter=select.value || 'ALL';
          captureMilitaryGalleryUI(grid,modalHost.parentElement,'modalScrollTop');
          syncFromSidebar();
        };
      });
      grid.querySelectorAll('details[data-military-section]').forEach(details=>{
        details.addEventListener('toggle',()=>{
          if(details.open && details.querySelector(':scope > [data-military-lazy="true"]')){
            captureMilitaryGalleryUI(grid,modalHost.parentElement,'modalScrollTop');
            syncFromSidebar();
          }
        });
      });
      grid.querySelectorAll('.rbAwardSelect,.militaryServiceSelect,.militarySpecialDevice,.militaryNumeralDevice,.militaryAdvancedMode').forEach(control=>{
        const original=control.onchange;
        control.onchange=(event)=>{
          captureMilitaryGalleryUI(grid,modalHost.parentElement,'modalScrollTop');
          original?.call(control,event);
          syncFromSidebar();
        };
      });
    }

    if(k==='patches'){
      const showCount = State.patchGalleryExpanded ? patchList.length : Math.min(10, patchList.length);
      const ids = patchList.slice(0, showCount);

      const tiles = [...grid.querySelectorAll('.galleryTile')];
      tiles.forEach((tile, i) => {
        const id = ids[i];
        if(!id) return;
        const sel = State.patchSelections[id] || {checked:false};

        const chk = tile.querySelector('.ptChk');
        if(chk){
          chk.checked = !!sel.checked;
          chk.onchange = () => {
            sel.checked = chk.checked;
            rebuildPatchesFromGallery();
            syncFromSidebar();
          };
        }
      });
    }
  }

  host.querySelector('#modalShowLess').onclick = ()=>{
    if(kind==='ribbons'){ State.ribbonGalleryExpanded=false; buildRibbonGallery(); }
    if(kind==='badges'){ State.badgeGalleryExpanded=false; buildBadgeGallery(); }
    if(kind==='patches'){ State.patchGalleryExpanded=false; buildPatchGallery(); }
    syncFromSidebar();
  };
  host.querySelector('#modalShowAll').onclick = ()=>{
    if(kind==='ribbons'){ State.ribbonGalleryExpanded=true; buildRibbonGallery(); }
    if(kind==='badges'){ State.badgeGalleryExpanded=true; buildBadgeGallery(); }
    if(kind==='patches'){ State.patchGalleryExpanded=true; buildPatchGallery(); }
    syncFromSidebar();
  };
  host.querySelector('#modalSelectAllBasic')?.addEventListener('click',()=>{
    selectAllCapUniformAwards({maximum:false});
    syncFromSidebar();
  });
  host.querySelector('#modalSelectAllMax')?.addEventListener('click',()=>{
    selectAllCapUniformAwards({maximum:true});
    syncFromSidebar();
  });

  syncFromSidebar();

  modalOverlay.classList.add('open');
  modalOverlay.setAttribute('aria-hidden','false');
  document.body.style.overflow = 'hidden';
}

function closeGalleryModal(){
  modalOverlay.classList.remove('open');
  modalOverlay.setAttribute('aria-hidden','true');
  document.body.style.overflow = '';

  buildRibbonGallery();
  buildBadgeGallery();
  buildPatchGallery();
}

modalClose.addEventListener('click', closeGalleryModal);
modalOverlay.addEventListener('click', (e)=>{
  if(e.target === modalOverlay) closeGalleryModal();
});
document.addEventListener('keydown', (e)=>{
  if(e.key === 'Escape' && modalOverlay.classList.contains('open')) closeGalleryModal();
});

modalMaxBtn.addEventListener('click', ()=>{
  modalLast = {
    w: modalEl.style.width,
    h: modalEl.style.height,
    resize: modalEl.style.resize
  };
  modalEl.style.width = '96vw';
  modalEl.style.height = '90vh';
  modalEl.style.resize = 'none';
  modalMaxBtn.classList.add('hidden');
  modalRestore.classList.remove('hidden');
});
modalRestore.addEventListener('click', ()=>{
  if(modalLast){
    modalEl.style.width = modalLast.w || '';
    modalEl.style.height = modalLast.h || '';
    modalEl.style.resize = modalLast.resize || 'both';
  }else{
    modalEl.style.width = '';
    modalEl.style.height = '';
    modalEl.style.resize = 'both';
  }
  modalRestore.classList.add('hidden');
  modalMaxBtn.classList.remove('hidden');
});

/* IMPORTANT: Picker buttons open the popup */
by('expandRibbons').addEventListener('click', ()=> openGalleryModal('ribbons'));
by('expandBadges').addEventListener('click',  ()=> openGalleryModal('badges'));
by('expandPatches').addEventListener('click', ()=> openGalleryModal('patches'));

const unitPatchSearchEl = by('unitPatchSearch');
const unitPatchSelectEl = by('unitPatchSelect');
if(unitPatchSearchEl){
  unitPatchSearchEl.addEventListener('input', () => {
    if(typeof buildUnitPatchSelector === 'function') buildUnitPatchSelector(unitPatchSearchEl.value);
  });
}
if(unitPatchSelectEl){
  unitPatchSelectEl.addEventListener('change', () => {
    State.unitPatchCharter = unitPatchSelectEl.value || '';
    renderUnitPatchStatus();
    renderPatches();
    if(typeof window.capubV2FullRender === 'function') window.capubV2FullRender();
  });
}
if(typeof buildUnitPatchSelector === 'function') buildUnitPatchSelector('');



/* ===========================
   CAPUB V2 FUNCTIONALITY PATCH
   - Adds validation, status, search, save/load, generated text tapes,
     rank fallback rendering, and missing-asset reporting.
   =========================== */
(function capubV2Patch(){
  const V2_VERSION = '2026-05-08-v2';
  State.text = State.text || { lastName:'', capTape:'CIVIL AIR PATROL', show:true };

  const CAPUB_V2 = window.CAPUB_V2 = {
    version: V2_VERSION,
    storageKey: 'cap_uniform_builder_profile_v2',
    missingAssetBaseline: [],
    notices: []
  };

  function pretty(id){ return String(id||'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()); }
  function safeRankFile(rank){ return String(rank||'').replace(/\//g,'_').replace(/\s+/g,'_').replace(/[^a-zA-Z0-9_\-]/g,''); }
  function addNotice(type,msg){ CAPUB_V2.notices.push({type,msg}); }
  function downloadText(filename,text){
    const blob = new Blob([text], {type:'text/plain;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click();
    setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 0);
  }

  function collectProfile(){
    return {
      version: V2_VERSION,
      membership: State.membership,
      gender: State.gender,
      uniform: State.uniform,
      rank: State.rank,
      cadetFirstSergeant: State.cadetFirstSergeant,
      shoulderCord: State.shoulderCord || '',
      unitPatchCharter: State.unitPatchCharter || '',
      assetBase: State.assetBase,
      ribbons: State.ribbons,
      badges: State.badges,
      patches: State.patches,
      ribbonSelections: State.ribbonSelections,
      badgeSelections: State.badgeSelections,
      patchSelections: State.patchSelections,
      forceMini: State.forceMini,
      miniMountStyle: State.miniMountStyle,
      ribbonRackLayout: State.ribbonRackLayout,
      ribbonRackArrangement: State.ribbonRackArrangement,
      ribbonRowOverrideEnabled: State.ribbonRowOverrideEnabled,
      ribbonRowOverride: State.ribbonRowOverride,
      garmentOverlayMode: State.garmentOverlayMode,
      garmentMasks: State.garmentMasks,
      text: State.text,
      commandInsignia: State.commandInsignia,
      calib: State.calib
    };
  }

  /*
    A saved or imported setup is untrusted input: it can come from a file someone else
    sent. sanitizeProfile() keeps only values the builder itself could have produced
    (known uniforms, ranks, ribbon/badge/patch ids, device ids and bounded counts) and
    drops everything else, so nothing outside those lists ever reaches State or the page.
  */
  const SAFE_TOKEN = /^[A-Za-z0-9_.:#-]{0,80}$/;
  const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  function safeToken(value){ return typeof value === 'string' && SAFE_TOKEN.test(value) ? value : ''; }
  function sanitizeProfile(p){
    const out = {};
    out.membership = ['senior','cadet'].includes(p.membership) ? p.membership : '';
    out.gender = ['male','female'].includes(p.gender) ? p.gender : '';
    out.uniform = typeof p.uniform === 'string' && has(UNIFORMS, p.uniform) ? p.uniform : 'blues_a';
    out.rank = out.membership && RANKS[out.membership].includes(p.rank) ? p.rank : null;
    out.cadetFirstSergeant = !!p.cadetFirstSergeant;
    out.shoulderCord = typeof p.shoulderCord === 'string' && has(SHOULDER_CORD_META, p.shoulderCord) ? p.shoulderCord : null;
    out.unitPatchCharter = typeof p.unitPatchCharter === 'string' && /^[A-Za-z0-9-]{0,24}$/.test(p.unitPatchCharter) ? p.unitPatchCharter : '';

    const ribbons = p.ribbonSelections && typeof p.ribbonSelections === 'object' ? p.ribbonSelections : {};
    out.ribbonSelections = {};
    for(const id of [...ribbonList, ...getMilitaryRibbonIds()]){
      const sel = ribbons[id];
      if(!sel || typeof sel !== 'object') continue;
      const devices = {};
      if(sel.devices && typeof sel.devices === 'object'){
        for(const [deviceId, count] of Object.entries(sel.devices)){
          const n = Math.trunc(Number(count));
          if(has(deviceMeta, deviceId) && Number.isFinite(n) && n > 0 && n <= 99) devices[deviceId] = n;
        }
      }
      // awardLabel and imageOverride are left out on purpose: normalizeRibbonSelections()
      // recomputes both from the catalog instead of trusting the file.
      out.ribbonSelections[id] = {
        checked: !!sel.checked,
        devices,
        awardValue: safeToken(sel.awardValue),
        honorCredit: !!sel.honorCredit,
        rocketryCredit: !!sel.rocketryCredit
      };
      if(isMilitaryRibbonId(id)){
        // getMilitarySelectionService() still checks the service against the award's own list.
        out.ribbonSelections[id].militaryService = safeToken(sel.militaryService);
        out.ribbonSelections[id].specialAuthorizations = (Array.isArray(sel.specialAuthorizations) ? sel.specialAuthorizations : [])
          .filter(deviceId => typeof deviceId === 'string' && has(deviceMeta, deviceId)).slice(0, 12);
        const numeral = Math.trunc(Number(sel.manualNumeral));
        out.ribbonSelections[id].manualNumeral = Number.isFinite(numeral) ? Math.min(99, Math.max(0, numeral)) : 0;
      }
    }

    const pick = (list, selections) => {
      const source = selections && typeof selections === 'object' ? selections : {};
      const kept = {};
      for(const id of list) if(source[id] && typeof source[id] === 'object') kept[id] = { checked: !!source[id].checked };
      return kept;
    };
    out.badges = (Array.isArray(p.badges) ? p.badges : []).filter(id => typeof id === 'string' && badgeList.includes(id));
    out.patches = (Array.isArray(p.patches) ? p.patches : []).filter(id => typeof id === 'string' && patchList.includes(id));
    out.badgeSelections = pick(badgeList, p.badgeSelections);
    out.patchSelections = pick(patchList, p.patchSelections);

    out.forceMini = !!p.forceMini;
    out.miniMountStyle = p.miniMountStyle === 'holding' ? 'holding' : 'mounting';
    out.ribbonRackLayout = ['3','4-left','4-center'].includes(String(p.ribbonRackLayout))
      ? String(p.ribbonRackLayout)
      : (Number(p.ribbonRackColumns) === 3 ? '3' : '4-left');
    out.ribbonRackArrangement = p.ribbonRackArrangement === 'standard' ? 'standard' : 'lapel';
    out.ribbonRowOverrideEnabled = !!p.ribbonRowOverrideEnabled;
    out.ribbonRowOverride = Array.isArray(p.ribbonRowOverride)
      ? p.ribbonRowOverride.map(Number).filter(n => Number.isInteger(n) && n >= 0 && n <= 20).slice(0, 12)
      : [];
    out.garmentOverlayMode = ['both','left','right','off'].includes(p.garmentOverlayMode) ? p.garmentOverlayMode : 'both';
    out.garmentMasks = p.garmentMasks && typeof p.garmentMasks === 'object' ? p.garmentMasks : null;
    const text = p.text && typeof p.text === 'object' ? p.text : {};
    out.text = {
      lastName: String(text.lastName || '').slice(0, 40),
      capTape: String(text.capTape || 'CIVIL AIR PATROL').slice(0, 40),
      show: text.show !== false
    };
    out.commandInsignia = { graduatedCommander: !!(p.commandInsignia && p.commandInsignia.graduatedCommander) };
    // Calibration data is a developer tool; ignore it unless the page was opened with ?dev=1.
    out.calib = CAPUB_DEV && p.calib && typeof p.calib === 'object' ? p.calib : null;
    return out;
  }

  function applyProfile(raw){
    if(!raw || typeof raw !== 'object' || Array.isArray(raw)) return;
    const p = sanitizeProfile(raw);
    State.membership = p.membership;
    State.gender = p.gender;
    State.uniform = p.uniform;
    State.rank = p.rank;
    State.cadetFirstSergeant = p.cadetFirstSergeant;
    if(!isCadetFirstSergeantEligible(State.rank)) State.cadetFirstSergeant = false;
    State.shoulderCord = p.shoulderCord;
    State.unitPatchCharter = p.unitPatchCharter;
    State.assetBase = 'images';
    State.ribbons = [];
    State.badges = p.badges;
    State.patches = p.patches;
    State.ribbonSelections = p.ribbonSelections;
    State.badgeSelections = p.badgeSelections;
    State.patchSelections = p.patchSelections;
    State.forceMini = p.forceMini;
    State.miniMountStyle = p.miniMountStyle;
    State.ribbonRackLayout = p.ribbonRackLayout;
    State.ribbonRackArrangement = p.ribbonRackArrangement;
    State.ribbonRowOverrideEnabled = p.ribbonRowOverrideEnabled;
    State.ribbonRowOverride = p.ribbonRowOverride;
    State.garmentOverlayMode = p.garmentOverlayMode;
    State.garmentMasks = p.garmentMasks || State.garmentMasks || {};
    persistGarmentMasks();
    State.text = p.text;
    State.commandInsignia = p.commandInsignia;
    State.calib = p.calib || State.calib || {enabled:false, selectedKey:null, selectedKeys:[], map:{}, byUniform:{}};
    if(!Array.isArray(State.calib.selectedKeys)) State.calib.selectedKeys = State.calib.selectedKey ? [State.calib.selectedKey] : [];
    if(!State.calib.byUniform) State.calib.byUniform = {};
    mergeCalibDefaults();

    populateRankSetup();
    syncCadetFirstSergeantControl();
    if(typeof syncShoulderCordControl === 'function') syncShoulderCordControl();
    refreshUI();
    rebuildRibbonsFromGallery();
    syncTextControls();
    buildRibbonGallery(); buildBadgeGallery(); buildPatchGallery();
    if(typeof buildUnitPatchSelector === 'function') buildUnitPatchSelector(by('unitPatchSearch')?.value || '');
    fullRender();
  }

  function syncTextControls(){
    const ln = by('capubV2LastName');
    const ct = by('capubV2CapTape');
    const sh = by('capubV2ShowText');
    if(ln) ln.value = State.text?.lastName || '';
    if(ct) ct.value = State.text?.capTape || 'CIVIL AIR PATROL';
    if(sh) sh.checked = State.text?.show !== false;
  }

  function textLayer(key, label, x, y, w, h, cls='textTape', fontSize=8){
    if(State.text?.show === false) return null;
    const el = document.createElement('div');
    el.className = 'layer '+cls;
    el.textContent = label || '';
    el.style.fontSize = fontSize+'px';
    el.dataset.calibKey = key;
    el.dataset.tooltipTitle = 'Generated text placeholder';
    el.dataset.tooltipReg = 'Rendered as text because a final image/embroidered asset may not be present.';
    el.dataset.tooltipWhy = 'Use the calibrator to tune placement. Replace with transparent PNG assets later if desired.';
    applyCalibToElement(el,key,{x,y,w,h,r:0});
    uniformCanvas.appendChild(el);
    return el;
  }

  function renderGeneratedTextAccoutrements(){
    // Name tapes, CAP tapes, AUX identifier, and U.S. flag are now part of the base field-uniform images.
    // Do not generate custom text overlays or placeholders.
    [...uniformCanvas.querySelectorAll('.layer.capub-v2-text')].forEach(n=>n.remove());
    return;
  }

  function rankAssetCandidates(rank){
    const f = safeRankFile(rank);
    return [
      `ranks/${f}.png`,
      `ranks/${f}.webp`,
      `ranks/${rank}.png`,
      `ranks/${rank}.webp`
    ];
  }

  function rankPlacement(){
    const renderSize = getCanvasRenderSize();
    const W = renderSize.w;
    const H = renderSize.h;
    if(State.uniform === 'ocp') return {x:W*.465,y:H*.245,w:34,h:34, shape:'square'};
    if(State.uniform === 'abu') return {x:W*.485,y:H*.295,w:32,h:32, shape:'square'};
    if(State.uniform === 'blues_b' || State.uniform === 'aviator') return {x:W*.49,y:H*.18,w:38,h:20, shape:'epaulet'};
    if(State.uniform === 'blues_a') return {x:W*.47,y:H*.165,w:42,h:22, shape:'epaulet'};
    return {x:W*.48,y:H*.24,w:34,h:26, shape:'square'};
  }

  function renderRankOverlay(){
    // Separate rank overlays have been retired.
    // All supported base uniform images are now expected to include the rank already built in.
    [...uniformCanvas.querySelectorAll('.layer.rankOverlay,.layer.rankFallback')].forEach(n=>n.remove());
    return;
  }

  function validateBuild(){
    CAPUB_V2.notices = [];
    if(!State.membership) addNotice('warn','Select membership type first.');
    if(!State.rank) addNotice('warn','Select rank before building the uniform.');
    if(!State.gender) addNotice('warn','Select male/female cut before final placement tuning.');
    if(State.membership && !isUniformAllowedFor(State.uniform, State.membership)) addNotice('err','Selected uniform is not authorized for the selected membership type.');
    if(State.unitPatchCharter && typeof getSelectedUnitPatchId === 'function' && !getSelectedUnitPatchId()) addNotice('warn',`Unit patch selected for ${getUnitPatchSelectionLabel(State.unitPatchCharter)}, but no patch image asset is available yet.`);
    if(State.unitPatchCharter && typeof getSelectedUnitPatchId === 'function' && getSelectedUnitPatchId() && !isUnitPatchAuthorizedForCurrentUniform()) addNotice('warn',`Unit patch ${getUnitPatchSelectionLabel(State.unitPatchCharter)} is not authorized on the current uniform.`);
    if(State.membership === 'cadet'){
      const bad = State.badges.filter(id=>!isCadetAuthorized(id));
      if(bad.length) addNotice('err','Cadet profile includes non-cadet badge(s): '+bad.map(pretty).join(', '));
    }
    if(State.membership === 'senior'){
      const bad = State.badges.filter(id=>!isSeniorAuthorized(id));
      if(bad.length) addNotice('err','Senior profile includes cadet-only badge(s): '+bad.map(pretty).join(', '));
    }
    if(State.uniform === 'ocp'){
      // U.S. flag and AUX duty identifier are mandatory but are now baked into the OCP base image.
      // They are not selectable render layers and should not create validation warnings.
      if(countBadgesForLimit() > 4) addNotice('err','OCP chest badges exceed the maximum of four counted badges. Command insignia does not count against this limit.');
    }
    if(['blues_a','blues_b','aviator','aviator_blazer'].includes(State.uniform)){
      if(countBadgesForLimit() > 4) addNotice('err','Service/aviator uniform badge count exceeds four counted badges. Command insignia does not count against this limit.');
      if(State.gender === 'female' && State.uniform === 'blues_a'){
        const femaleSpecialtyCount = getFemaleClassASpecialtyBadgeIds().length;
        if(femaleSpecialtyCount > 2) addNotice('err','Female Class A specialty-track badges above the nameplate are limited to two. Additional specialty badges will not render in that row.');
        if(State.membership === 'cadet' && femaleClassASpecialtyRowIsFull() && State.badges.includes('model_rocketry_badge')){
          addNotice('ok','Female cadet Class A: with two specialty badges already above the nameplate, Model Rocketry renders in the same left-pocket zone used by the male uniform.');
        }
      }
      if(State.badges.includes('squadron_commander_badge') && State.commandInsignia?.graduatedCommander) addNotice('ok','Squadron Commander badge is marked as Graduated Commander and will render under the nameplate (UN); command insignia remains outside the normal four-badge count.');
      if(State.badges.includes('squadron_commander_badge') && !State.commandInsignia?.graduatedCommander) addNotice('ok','Squadron Commander badge is marked as Current Commander and will render over the nameplate (ON); command insignia remains outside the normal four-badge count.');
      const aviation = State.badges.filter(id => ['OLP','OLPA','OLPU'].some(s => String(badgeLocations[id]||'').includes(s)));
      if(aviation.length > 2) addNotice('warn','More than two aviation/occupational-style badges are selected for the wearer’s left side.');
    }
    if(State.uniform === 'mess_dress' && State.membership === 'cadet') addNotice('err','Mess Dress is not available to cadets in this builder.');
    if(!CAPUB_V2.notices.length) addNotice('ok','No automatic validation issues found. Final approval still requires CAPR 39-1 review and any applicable supplement.');
    return CAPUB_V2.notices;
  }

  function updateStatusPanel(){
    const notices = validateBuild();
    const rc = by('capubV2RibbonCount'), bc = by('capubV2BadgeCount'), pc = by('capubV2PatchCount'), wc = by('capubV2WarningCount');
    if(rc) rc.textContent = State.ribbons.length;
    if(bc) bc.textContent = State.badges.length;
    if(pc) pc.textContent = State.patches.length + ((typeof getSelectedUnitPatchId === 'function' && getSelectedUnitPatchId() && isUnitPatchAuthorizedForCurrentUniform()) ? 1 : 0);
    if(wc) wc.textContent = notices.filter(n=>n.type !== 'ok').length;
    const ul = by('capubV2Notices');
    if(ul){
      ul.innerHTML = '';
      notices.forEach(n=>{ const li=document.createElement('li'); li.className=n.type; li.textContent=n.msg; ul.appendChild(li); });
    }
  }

  function buildExpectedAssetList(){
    const expected = [];
    ribbonList.forEach(id=>expected.push({category:'Ribbon', item:pretty(id), id, path:`images/ribbons/${id}.png`, status:'required'}));
    Object.entries(RIBBON_SPECIAL_IMAGE_OPTIONS || {}).forEach(([id,opts])=>{
      opts.forEach(opt=>{
        if(opt.image) expected.push({category:'Ribbon Variant', item:`${pretty(id)} - ${opt.label}`, id, path:`images/ribbons/${opt.image}`, status:'required'});
      });
    });
    badgeList.forEach(id=>expected.push({category:'Badge', item:pretty(id), id, path:`images/${getBadgeAssetPath(id)}`, status:'required'}));
    Object.entries(PATCH_META).filter(([id])=>!FIELD_BASE_BUILT_IN_PATCH_IDS.has(id)).forEach(([id,m])=>expected.push({category:'Patch', item:pretty(id), id, path:`images/${m.img}`, status:'required'}));
    Object.entries(deviceMeta).forEach(([id,m])=>expected.push({category:'Ribbon device', item:m.label||pretty(id), id, path:`images/${m.src}`, status:'required'}));
    Object.entries(miniMedalImages).forEach(([id,p])=>expected.push({category:'Mini medal', item:pretty(id), id, path:`images/${p}`, status:'required when mini-medals used'}));
    Object.keys(UNIFORMS).forEach(u=>['male','female'].forEach(g=>{ const p=UNIFORMS[u]?.[g]; if(p) expected.push({category:'Base uniform', item:`${u} ${g}`, id:`${u}_${g}`, path:`images/${p}`, status:'required'}); }));
    Object.entries(CADET_COMBINED_CLASSB || {}).forEach(([gender,map])=>{
      Object.entries(map).forEach(([rank,path])=>{
        expected.push({category:'Cadet Class B base uniform', item:`${gender} ${rank}`, id:`cadet_class_b_${gender}_${safeRankFile(rank)}`, path:`images/${path}`, status:'required for cadet Class B rank-specific base'});
      });
    });
    Object.entries(CADET_FIRST_SERGEANT_COMBINED_CLASSB || {}).forEach(([gender,map])=>{
      Object.entries(map).forEach(([rank,path])=>{
        expected.push({category:'Cadet Class B First Sergeant base uniform', item:`${gender} ${rank} First Sergeant`, id:`cadet_class_b_${gender}_${safeRankFile(rank)}_first_sergeant`, path:`images/${path}`, status:'required when Cadet First Sergeant is selected'});
      });
    });
    [...rankListAll].forEach(r=>expected.push({category:'Rank', item:r, id:safeRankFile(r), path:`images/ranks/${safeRankFile(r)}.png`, status:'recommended'}));
    // CAPR 39-1 / ICL additions the current asset set should eventually support.
    [
      ['sUAS badge','Cadet sUAS Badge','cadet_suas_badge','badges/cadet_suas_badge.png']
    ].forEach(([category,item,id,path])=>expected.push({category,item,id,path:`images/${normalizeAssetSubpath(path)}`,status:'not yet in current catalog'}));
    return expected;
  }

  function downloadMissingAssetList(){
    const expected = buildExpectedAssetList();
    const lines = [];
    lines.push('CAP Uniform Builder — Missing/Needed Image Asset List');
    lines.push('Generated: '+new Date().toLocaleString());
    lines.push('');
    lines.push('Recommended rank filename rule: replace / with _, spaces with _, e.g., C/2d Lt -> images/ranks/C_2d_Lt.png');
    lines.push('');
    lines.push('CSV-style list:');
    lines.push('Category,Item,ID,Expected Path,Status');
    expected.forEach(e=>{
      lines.push([e.category,e.item,e.id,e.path,e.status].map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(','));
    });
    downloadText('CAP_Uniform_Builder_missing_assets_needed.txt', lines.join('\n'));
  }

  function injectModalSearch(kind){
    const body = modalHost;
    if(!body) return;
    if(!State.modalGallerySearchValues) State.modalGallerySearchValues={};
    if(body.querySelector('.capubV2Search')){
      window.CAPUB_refreshModalGallerySearch?.(kind);
      return;
    }
    const wrap = document.createElement('div');
    wrap.className = 'capubV2Search';
    wrap.innerHTML = `<input id="capubV2ModalSearch" placeholder="Search ${kind} by name, id, slot, or category..."/><div class="sub"><span id="capubV2ModalCount"></span> visible. Tip: use this popup for fast selection; selected items stay checked.</div>`;
    body.insertBefore(wrap, body.firstChild);
    const input = wrap.querySelector('input');
    const count = wrap.querySelector('#capubV2ModalCount');
    input.value=State.modalGallerySearchValues[kind] || '';
    function filter(){
      const q = input.value.trim().toLowerCase();
      State.modalGallerySearchValues[kind]=input.value;
      let visible = 0;
      body.querySelectorAll('.galleryTile').forEach(tile=>{
        const show = !q || tile.textContent.toLowerCase().includes(q);
        tile.classList.toggle('isFilteredOut', !show);
        if(show) visible++;
      });
      if(count) count.textContent = visible;
    }
    input.addEventListener('input', filter);
    window.CAPUB_refreshModalGallerySearch = requestedKind=>{
      if(requestedKind && requestedKind!==kind) return;
      filter();
    };
    filter();
    setTimeout(()=>input.focus(),50);
  }

  // Override render pipeline to include V2 layers and live validation after original rendering.
  const originalFullRender = fullRender;
  fullRender = function capubV2FullRender(prevUniform){
    originalFullRender(prevUniform);
    renderGeneratedTextAccoutrements();
    renderRankOverlay();
    // The base renderer draws badge/ribbon arrows before V2 generated text layers.
    // Redraw measurement lines here so the nameplate-to-commander and
    // nameplate-to-RP arrows can use the actual rendered nameplate position.
    renderMeasurementOverlay();
    updateStatusPanel();
  };

  const originalOpenGalleryModal = openGalleryModal;
  openGalleryModal = function capubV2OpenGallery(kind){
    if(kind === 'ribbons') State.ribbonGalleryExpanded = true;
    if(kind === 'badges') State.badgeGalleryExpanded = true;
    if(kind === 'patches') State.patchGalleryExpanded = true;
    originalOpenGalleryModal(kind);
    injectModalSearch(kind);
  };

  // Safer clear actions: keep UI selections in sync.
  const clearRibbonsBtn = by('clearRibbons');
  if(clearRibbonsBtn) clearRibbonsBtn.addEventListener('click', ()=>setTimeout(updateStatusPanel,0));
  const clearBadgesBtn = by('clearBadges');
  if(clearBadgesBtn) clearBadgesBtn.addEventListener('click', ()=>setTimeout(updateStatusPanel,0));
  const clearPatchesBtn = by('clearPatches');
  if(clearPatchesBtn) clearPatchesBtn.addEventListener('click', ()=>setTimeout(updateStatusPanel,0));

  function wireV2Controls(){
    syncTextControls();
    const save = by('capubV2SaveLocal'), load = by('capubV2LoadLocal'), exp = by('capubV2ExportJson'), impBtn = by('capubV2ImportBtn'), impFile = by('capubV2ImportFile');
    const missing = by('capubV2MissingBtn'), reset = by('capubV2Reset');
    const ln = by('capubV2LastName'), ct = by('capubV2CapTape'), sh = by('capubV2ShowText');
    if(save) save.onclick = ()=>{ localStorage.setItem(CAPUB_V2.storageKey, JSON.stringify(collectProfile())); updateStatusPanel(); alert('Uniform setup saved in this browser.'); };
    if(load) load.onclick = ()=>{ const raw = localStorage.getItem(CAPUB_V2.storageKey); if(!raw){ alert('No saved setup found in this browser.'); return; } applyProfile(JSON.parse(raw)); };
    if(exp) exp.onclick = ()=>downloadText('cap_uniform_builder_setup.json', JSON.stringify(collectProfile(), null, 2));
    if(impBtn && impFile) impBtn.onclick = ()=>impFile.click();
    if(impFile) impFile.onchange = async ()=>{ const f=impFile.files?.[0]; if(!f) return; applyProfile(JSON.parse(await f.text())); impFile.value=''; };
    if(missing) missing.onclick = downloadMissingAssetList;
    if(reset) reset.onclick = ()=>{ if(!confirm('Reset the entire builder setup?')) return; localStorage.removeItem(CAPUB_V2.storageKey); location.reload(); };
    [ln,ct,sh].forEach(el=>{ if(!el) return; el.addEventListener('input', ()=>{ State.text.lastName = ln?.value || ''; State.text.capTape = ct?.value || 'CIVIL AIR PATROL'; State.text.show = sh?.checked !== false; fullRender(); }); el.addEventListener('change', ()=>{ State.text.lastName = ln?.value || ''; State.text.capTape = ct?.value || 'CIVIL AIR PATROL'; State.text.show = sh?.checked !== false; fullRender(); }); });
  }

  // Make functions available for console debugging.
  CAPUB_V2.collectProfile = collectProfile;
  CAPUB_V2.applyProfile = applyProfile;
  CAPUB_V2.buildExpectedAssetList = buildExpectedAssetList;
  CAPUB_V2.downloadMissingAssetList = downloadMissingAssetList;

  // Wire once after this script block has loaded.
  setTimeout(()=>{ wireV2Controls(); updateStatusPanel(); },0);
})();
