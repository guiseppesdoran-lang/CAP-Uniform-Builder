// Extracted verbatim from index.html: jacket base rendering, ribbon/medal render logic and
// the device tool UI. Loaded between the halves of the inline script so execution order
// is unchanged.

/* ===========================
   JACKET BASE RENDER (ROBUST)
   =========================== */
function clearLayers(cls){
  const sel = cls?`.layer.${cls}`:'.layer';
  uniformCanvas.querySelectorAll(sel).forEach(n=>n.remove());
}

function getBaseCandidates(){
  const u = State.uniform;
  const g = State.gender;
  const list = [];
  if(!u || !g) return list;

  // 1) Cadet Class A combined jacket (rank baked into the base image when available)
  // Female cadet Class A now uses rank-specific files for every cadet grade.
  // Male cadet officer Class A preserves the existing combined officer jacket paths.
  if(usingCombinedCadetClassAJacket()){
    list.push(getCadetCombinedClassAPath(State.rank, State.gender));
    const generic = UNIFORMS[u]?.[g];
    if(generic) list.push(generic);
    return [...new Set(list.filter(Boolean))];
  }

  // 1b) Senior Member Officer Class A combined jacket (jacket+epaulet rank baked in)
  // Same pattern as the cadet officer combined-base selection: use the direct
  // rank/gender base image and return it as the jacket candidate.
  if(usingCombinedSeniorOfficerJacket()){
    list.push(getSeniorOfficerCombinedClassAPath(State.rank, State.gender));
    const generic = UNIFORMS[u]?.[g];
    if(generic) list.push(generic);
    return [...new Set(list.filter(Boolean))];
  }

  // 1c) Cadet Class B combined shirt (cadet grade baked in)
  // This is cadet-only. Senior Member Class B pathing below remains unchanged.
  if(usingCombinedCadetClassBJacket()){
    list.push(getCadetCombinedClassBPath(State.rank, State.gender));
    const generic = UNIFORMS[u]?.[g];
    if(generic) list.push(generic);
    return [...new Set(list.filter(Boolean))];
  }

  // 1d) Senior Member Officer Class B combined shirt (rank baked in)
  if(usingCombinedSeniorOfficerClassBJacket()){
    list.push(getSeniorOfficerCombinedClassBPath(State.rank, State.gender));
    const generic = UNIFORMS[u]?.[g];
    if(generic) list.push(generic);
    return [...new Set(list.filter(Boolean))];
  }

  // 1e) Senior Member Officer OCP blouse (rank baked into the base image)
  // Male and female variants intentionally use the same rank-specific OCP file.
  if(usingSeniorOfficerOcpBase()){
    list.push(getSeniorOfficerOcpBasePath(State.rank));
    const generic = UNIFORMS[u]?.[g];
    if(generic) list.push(generic);
    return [...new Set(list.filter(Boolean))];
  }

  // 2) NCO special (try first)
  if(State.membership==='senior' && State.rank && SENIOR_NCO_RANKS.has(State.rank)){
    const ncoPath = SENIOR_NCO_BASE[u]?.[g]?.[State.rank];
    if(ncoPath) list.push(ncoPath);
  }

  // 3) Default base
  const def = UNIFORMS[u]?.[g];
  if(def) list.push(def);

  return [...new Set(list)];
}

function applyJacket(){
  clearLayers('jacket');

  const candidates = getBaseCandidates();
  if(!candidates.length) return;

  function showJacketError(text){
    const msg = document.createElement('div');
    msg.className = 'layer jacket';
    msg.style.left = '12px';
    msg.style.top = '12px';
    msg.style.padding = '10px 12px';
    msg.style.borderRadius = '10px';
    msg.style.background = 'rgba(220, 38, 38, .10)';
    msg.style.border = '1px solid rgba(220, 38, 38, .35)';
    msg.style.color = '#991b1b';
    msg.style.fontSize = '12px';
    msg.style.maxWidth = '420px';
    msg.textContent = text;
    uniformCanvas.appendChild(msg);
  }

  let idx = 0;

  function tryNext(){
    if(idx >= candidates.length){
      showJacketError(`Jacket image failed to load. Verify filenames in "${State.assetBase}/base/". Check browser console for 404s.`);
      return;
    }

    const path = candidates[idx++];
    const img=document.createElement('img');
    img.className='layer jacket';
    img.dataset.assetPath=path;
    img.src=ASSET(path);
    img.style.top='0px';
    img.style.left='0px';
    img.style.width='100%';
    img.style.height='100%';
    img.style.display='block';
    img.style.objectFit='contain';
    img.style.maxWidth='none';
    img.style.maxHeight='none';

    // CAPUB FIX 2026-06-05:
    // Do not apply user calibrator coordinates to the base uniform image.
    // Base-artwork fitting is controlled below by explicit uniform-specific
    // geometry, preventing unrelated saved "jacket" calibrations from leaking
    // between uniforms.
    img.dataset.calibKey = 'base:jacket';
    const renderSize = getCanvasRenderSize();
    const isAviatorArtwork = ['aviator','aviator_blazer'].includes(State.uniform);
    const aviatorArtworkLayout = isAviatorArtwork && State.gender === 'male'
      // Scale proportionally around the left-pocket/rack anchor so the pocket
      // stays directly beneath the fixed ribbon rack.
      ? { x:55.3, y:38.9, w:353.25, h:471 }
      : isAviatorArtwork && State.gender === 'female'
        // Keep the cleaned female artwork proportional while independently
        // centering its right-side pocket under the award-rack anchor.
        ? { x:73.5, y:51.5, w:326.25, h:435 }
        : { x:0, y:0, w:renderSize.w, h:renderSize.h };
    img.style.left = `${aviatorArtworkLayout.x}px`;
    img.style.top = `${aviatorArtworkLayout.y}px`;
    img.style.width = `${aviatorArtworkLayout.w}px`;
    img.style.height = `${aviatorArtworkLayout.h}px`;
    img.style.transform = 'rotate(0deg)';
    img.style.transformOrigin = 'center center';
    img.style.objectFit = 'contain';

    img.dataset.tooltipTitle = (State.uniform||'').replace(/_/g,' ').toUpperCase();
    img.dataset.tooltipReg   = "Base uniform image";
    img.dataset.tooltipWhy   = `Loaded: ${path}`;

    img.onerror = () => {
      console.warn('[JACKET LOAD FAIL]', img.src);
      img.remove();
      tryNext();
    };
    let jacketReadyHandled=false;
    const finishJacketLoad = () => {
      if(jacketReadyHandled) return;
      jacketReadyHandled=true;
      renderGarmentForegroundOverlays(img,path);
      // Rebuild a Class A lapel-clear rack after the exact base-image fit and
      // active editable mask are available. This replaces the pre-load Figure
      // 11-1 fallback with collision-tested row capacities.
      if(State.uniform==='blues_a' && State.ribbonRackArrangement==='lapel'){
        renderRack();
        renderAllBadges();
        renderMeasurementOverlay();
      }
    };
    img.onload = finishJacketLoad;

    uniformCanvas.appendChild(img);
    if(img.complete && img.naturalWidth) finishJacketLoad();
  }

  tryNext();
}

/* ===========================
   RIBBON / MEDAL RENDER LOGIC
   =========================== */
function sortRibbons(arr){
  return [...arr].sort((a,b)=>{
    const aMilitary = isMilitaryRibbonId(a.id);
    const bMilitary = isMilitaryRibbonId(b.id);
    if(aMilitary && bMilitary){
      const aa = getMilitaryRibbonAward(a.id);
      const ba = getMilitaryRibbonAward(b.id);
      if(aa && ba && window.CAPUBMilitary?.compareAwardsUniversal){
        return window.CAPUBMilitary.compareAwardsUniversal(aa,ba);
      }
    }
    // U.S. military decorations precede CAP awards on the CAP rack.
    if(aMilitary !== bMilitary) return aMilitary ? -1 : 1;
    const ap = precedence(a.id);
    const bp = precedence(b.id);
    if(ap !== bp) return ap - bp;
    // Stable fallback for duplicate / unknown ribbons.
    return String(a.id).localeCompare(String(b.id));
  });
}

// Build CAP ribbon rows from highest precedence to lowest precedence.
// Display order is top-left -> bottom-right. Any partial row belongs on the TOP
// and stays centered; all lower rows use the uniform's authorized column count.
function buildRibbonRowsHighToLow(items, perRow=3){
  const sorted = sortRibbons(items);
  const remainder = sorted.length % perRow;
  const rows = [];
  let cursor = 0;

  if(remainder > 0){
    rows.push(sorted.slice(0, remainder));
    cursor = remainder;
  }

  while(cursor < sorted.length){
    rows.push(sorted.slice(cursor, cursor + perRow));
    cursor += perRow;
  }

  return rows;
}

function pointInPolygon(point, polygon){
  let inside = false;
  for(let i=0,j=polygon.length-1; i<polygon.length; j=i++){
    const a=polygon[i], b=polygon[j];
    const crosses = ((a.y>point.y)!==(b.y>point.y)) &&
      (point.x < (b.x-a.x)*(point.y-a.y)/((b.y-a.y)||Number.EPSILON)+a.x);
    if(crosses) inside=!inside;
  }
  return inside;
}

function segmentsIntersect(a,b,c,d){
  const orient=(p,q,r)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);
  const onSegment=(p,q,r)=>q.x>=Math.min(p.x,r.x)-1e-7 && q.x<=Math.max(p.x,r.x)+1e-7 &&
    q.y>=Math.min(p.y,r.y)-1e-7 && q.y<=Math.max(p.y,r.y)+1e-7;
  const o1=orient(a,b,c), o2=orient(a,b,d), o3=orient(c,d,a), o4=orient(c,d,b);
  if((o1<0)!==(o2<0) && (o3<0)!==(o4<0)) return true;
  if(Math.abs(o1)<1e-7 && onSegment(a,c,b)) return true;
  if(Math.abs(o2)<1e-7 && onSegment(a,d,b)) return true;
  if(Math.abs(o3)<1e-7 && onSegment(c,a,d)) return true;
  if(Math.abs(o4)<1e-7 && onSegment(c,b,d)) return true;
  return false;
}

function rectangleIntersectsPolygon(rect, polygon){
  if(!Array.isArray(polygon) || polygon.length<3) return false;
  const corners=[
    {x:rect.left,y:rect.top},{x:rect.right,y:rect.top},
    {x:rect.right,y:rect.bottom},{x:rect.left,y:rect.bottom}
  ];
  if(corners.some(point=>pointInPolygon(point,polygon))) return true;
  if(polygon.some(point=>point.x>=rect.left && point.x<=rect.right && point.y>=rect.top && point.y<=rect.bottom)) return true;
  const rectEdges=corners.map((point,index)=>[point,corners[(index+1)%corners.length]]);
  for(let i=0;i<polygon.length;i++){
    const edge=[polygon[i],polygon[(i+1)%polygon.length]];
    if(rectEdges.some(([a,b])=>segmentsIntersect(a,b,edge[0],edge[1]))) return true;
  }
  return false;
}

const MAX_RIBBON_LAPEL_OVERLAP_RATIO = .51;

function polygonArea(polygon){
  if(!Array.isArray(polygon) || polygon.length<3) return 0;
  let twiceArea=0;
  for(let index=0; index<polygon.length; index++){
    const point=polygon[index];
    const next=polygon[(index+1)%polygon.length];
    twiceArea += point.x*next.y-next.x*point.y;
  }
  return Math.abs(twiceArea)/2;
}

function clipPolygonToRibbonRect(polygon,rect){
  if(!Array.isArray(polygon) || polygon.length<3) return [];
  const boundaries=[
    {inside:point=>point.x>=rect.left, intersect:(a,b)=>{
      const t=(rect.left-a.x)/((b.x-a.x)||Number.EPSILON);
      return {x:rect.left,y:a.y+t*(b.y-a.y)};
    }},
    {inside:point=>point.x<=rect.right, intersect:(a,b)=>{
      const t=(rect.right-a.x)/((b.x-a.x)||Number.EPSILON);
      return {x:rect.right,y:a.y+t*(b.y-a.y)};
    }},
    {inside:point=>point.y>=rect.top, intersect:(a,b)=>{
      const t=(rect.top-a.y)/((b.y-a.y)||Number.EPSILON);
      return {x:a.x+t*(b.x-a.x),y:rect.top};
    }},
    {inside:point=>point.y<=rect.bottom, intersect:(a,b)=>{
      const t=(rect.bottom-a.y)/((b.y-a.y)||Number.EPSILON);
      return {x:a.x+t*(b.x-a.x),y:rect.bottom};
    }}
  ];
  let output=polygon.map(point=>({x:point.x,y:point.y}));
  for(const boundary of boundaries){
    const input=output;
    output=[];
    if(!input.length) break;
    let previous=input[input.length-1];
    let previousInside=boundary.inside(previous);
    for(const current of input){
      const currentInside=boundary.inside(current);
      if(currentInside!==previousInside) output.push(boundary.intersect(previous,current));
      if(currentInside) output.push(current);
      previous=current;
      previousInside=currentInside;
    }
  }
  return output;
}

function getRibbonLapelOverlapRatio(rect,polygon){
  const ribbonArea=Math.max(0,rect.right-rect.left)*Math.max(0,rect.bottom-rect.top);
  if(!ribbonArea || !rectangleIntersectsPolygon(rect,polygon)) return 0;
  return Math.min(1,polygonArea(clipPolygonToRibbonRect(polygon,rect))/ribbonArea);
}

function getActiveAwardSideLapelPolygon(){
  if(State.uniform!=='blues_a') return [];
  const baseImg=getGarmentEditorBaseImage();
  if(!baseImg?.naturalWidth || !baseImg?.naturalHeight) return [];
  const loadedPath=baseImg.dataset.assetPath || '';
  const points=getGarmentMaskPoints(State.uniform,loadedPath,1);
  const bounds=getGarmentEditorDrawBounds(baseImg);
  if(points.length<3 || !bounds.w || !bounds.h) return [];
  return points.map(point=>({
    x:bounds.x + point.x*bounds.w/100,
    y:bounds.y + point.y*bounds.h/100
  }));
}

function getLapelSafeRibbonCapacity(rowFromBottom, perRow, layout, polygon){
  const rowTop=layout.bottomY-rowFromBottom*(layout.h+layout.gapY);
  for(let count=perRow; count>=1; count--){
    const rowWidth=count*layout.w+(count-1)*layout.gapX;
    const rowLeft=count===perRow
      ? layout.baseX
      : layout.wearerLeftPocketEdgeX-rowWidth;
    if(isRibbonRowClear(count,rowTop,rowLeft,layout,polygon)) return count;
  }
  return 0;
}

function isRibbonRowClear(count,rowTop,rowLeft,layout,polygon){
  for(let column=0; column<count; column++){
    const left=rowLeft+column*(layout.w+layout.gapX);
    const rect={
      left,
      top:rowTop,
      right:left+layout.w,
      bottom:rowTop+layout.h
    };
    if(getRibbonLapelOverlapRatio(rect,polygon)>MAX_RIBBON_LAPEL_OVERLAP_RATIO+1e-9) return false;
  }
  return true;
}

function isStandardThreeRibbonLayoutWithinLapelLimit(items,layout,polygon){
  const rows=buildRibbonRowsHighToLow(items,3);
  const totalRows=rows.length;
  return rows.every((row,topIndex)=>{
    const rowWidth=row.length*layout.w+(row.length-1)*layout.gapX;
    const rowLeft=layout.centerX-rowWidth/2;
    const rowFromBottom=totalRows-1-topIndex;
    const rowTop=layout.bottomY-rowFromBottom*(layout.h+layout.gapY);
    return isRibbonRowClear(row.length,rowTop,rowLeft,layout,polygon);
  });
}

function getAutomaticClassARibbonLayout(items){
  const standardLayout=getRibbonLayout('blues_a','3');
  const polygon=getActiveAwardSideLapelPolygon();
  if(!polygon.length || isStandardThreeRibbonLayoutWithinLapelLimit(items,standardLayout,polygon)){
    return {layout:standardLayout,useFourColumns:false};
  }
  const fourColumnPreference=State.ribbonRackLayout==='4-center' ? '4-center' : '4-left';
  return {
    layout:getRibbonLayout('blues_a',fourColumnPreference),
    useFourColumns:true
  };
}

function rowsFromBottomCounts(sorted,countsBottomFirst){
  const rows=[];
  let cursor=0;
  for(const count of [...countsBottomFirst].reverse()){
    rows.push(sorted.slice(cursor,cursor+count));
    cursor+=count;
  }
  return rows;
}

// Figure 11-1 permits upper Class A rows to contain fewer ribbons and align
// with the wearer-left welt/pocket edge only when needed to avoid the lapel.
// Use the active editable lapel polygon and fill each row to the maximum
// authorized width while no individual ribbon is more than 51% overlapped.
function buildLapelAvoidanceRowsHighToLow(items, perRow=3, layout=null){
  const sorted = sortRibbons(items);
  if(!sorted.length) return [];

  const polygon=layout ? getActiveAwardSideLapelPolygon() : [];
  if(polygon.length){
    const capacitiesBottomFirst=[];
    for(let rowFromBottom=0; rowFromBottom<64; rowFromBottom++){
      capacitiesBottomFirst.push(getLapelSafeRibbonCapacity(rowFromBottom,perRow,layout,polygon));
      const rowCount=rowFromBottom+1;
      if(sorted.length<rowCount) continue;

      if(rowCount===1){
        if(sorted.length>perRow) continue;
        const width=sorted.length*layout.w+(sorted.length-1)*layout.gapX;
        const left=layout.centerX-width/2;
        if(isRibbonRowClear(sorted.length,layout.bottomY,left,layout,polygon)){
          return [sorted];
        }
        continue;
      }

      const rowCapacities=capacitiesBottomFirst.slice(0,rowCount);
      const bestCounts=window.CAPUBRibbonLayout?.findMonotonicRibbonRowCounts?.(
        rowCapacities,
        sorted.length,
        {validator:candidate=>{
          const belowCount=candidate[rowCount-2];
          const topCount=candidate[rowCount-1];
          const belowWidth=belowCount*layout.w+(belowCount-1)*layout.gapX;
          const belowLeft=belowCount===perRow
            ? layout.baseX
            : layout.wearerLeftPocketEdgeX-belowWidth;
          const belowCenter=belowLeft+belowWidth/2;
          const topWidth=topCount*layout.w+(topCount-1)*layout.gapX;
          const topLeft=belowCenter-topWidth/2;
          const topY=layout.bottomY-(rowCount-1)*(layout.h+layout.gapY);
          return isRibbonRowClear(topCount,topY,topLeft,layout,polygon);
        }}
      ) || null;
      if(bestCounts) return rowsFromBottomCounts(sorted,bestCounts);
    }
  }

  // When the base image has not loaded yet, use the exact capacity progression
  // illustrated by Figure 11-1. The image load handler reruns this planner with
  // the active polygon before the preview is considered final.
  const capacitiesBottomFirst = [];
  let capacityTotal = 0;
  while(capacityTotal < sorted.length && capacitiesBottomFirst.length<64){
    const rowFromBottom = capacitiesBottomFirst.length;
    const figureFallback = rowFromBottom < 2
      ? perRow
      : Math.max(2,perRow-(rowFromBottom-1));
    const capacity = figureFallback;
    capacitiesBottomFirst.push(capacity);
    capacityTotal += capacity;
  }

  let remaining = sorted.length;
  const countsBottomFirst = capacitiesBottomFirst.map(capacity => {
    const count = Math.min(capacity, remaining);
    remaining -= count;
    return count;
  }).filter(Boolean);
  return rowsFromBottomCounts(sorted,countsBottomFirst);
}

function normalizeRibbonRowOverride(value=State.ribbonRowOverride, perRow=getRibbonLayout().columns){
  if(!Array.isArray(value)) return [];
  return value.map(Number).filter(count=>Number.isInteger(count) && count>=1 && count<=perRow);
}

function getCustomRibbonRowsHighToLow(items, perRow){
  if(State.uniform!=='blues_a' || !State.ribbonRowOverrideEnabled) return null;
  const counts=normalizeRibbonRowOverride(State.ribbonRowOverride,perRow);
  if(!counts.length || counts.reduce((sum,count)=>sum+count,0)!==items.length) return null;
  const sorted=sortRibbons(items);
  const rows=[];
  let cursor=0;
  for(const count of counts){
    rows.push(sorted.slice(cursor,cursor+count));
    cursor+=count;
  }
  return rows;
}
function buildMiniMedalRowsHighToLow(items, style='mounting'){
  const sorted = sortRibbons(items);
  const maxMedals = style === 'holding' ? 28 : 24;
  const limited = sorted.slice(0, maxMedals);

  if(style !== 'holding') return buildRibbonRowsHighToLow(limited, 4);

  // CAPR 39-1 Table 11-1 holding-bar rows balance medals from the bottom up:
  // 1–7 use one row, 8–14 use two, 15–21 use three, and 22–28 use four.
  const rowCount = Math.max(1, Math.ceil(limited.length / 7));
  const baseCount = Math.floor(limited.length / rowCount);
  const extra = limited.length % rowCount;
  const countsBottomFirst = Array.from({length:rowCount}, (_,index) =>
    baseCount + (index < extra ? 1 : 0)
  );
  const countsTopFirst = countsBottomFirst.reverse();
  const rows = [];
  let cursor = 0;
  for(const count of countsTopFirst){
    rows.push(limited.slice(cursor, cursor + count));
    cursor += count;
  }
  return rows;
}
function getTopRibbonY(){
  const layers=[...uniformCanvas.querySelectorAll('.layer.ribbonTile,.layer.ribbonMini')];
  if(!layers.length) return rackBaseY;
  return Math.min(...layers.map(l=>parseFloat(l.style.top)||0));
}
function ensureRibbonObj(id){
  let r=State.ribbons.find(x=>x.id===id);
  if(!r){
    r={id,devices:{}};
    State.ribbons.push(r);
  }
  if(!r.devices) r.devices={};
  return r;
}

/*
  Device geometry, measured from McChord's baked ribbon artwork rather than
  guessed. Diffing each device variant against its no-device base (e.g.
  AA02..AA05 against AA01) gives a consistent result across every family:

    - each device occupies a 20 x 20 box on a 100 x 30 ribbon
      => 20% of ribbon width, ~67% of ribbon height
    - devices sit CONTIGUOUSLY, with no gap between them
    - the run is centred both horizontally and vertically

  The previous constants (10 x 10 with a 3px gap) were absolute pixels against
  a ribbon that renders 23 x 7, so four devices spanned 49px on a 23px ribbon
  and overflowed onto the neighbouring ribbons in the rack. Deriving the size
  from the ribbon keeps the run inside its own ribbon at any rack scale:
  four devices span 4 x 4.6 = 18.4px of the 23px width.
*/
/*
  Two profiles, because the baked sets differ slightly. Measured by diffing each
  variant against its no-device base:

    compact - award-count families (AA, distin, encamp, ...): a 20x20 device on
              a 100x30 ribbon, laid contiguously. Bands run 20/40/60/80.
    wide    - star-combo families (ncc, leader, cac, ...): a 20x23 device with
              about 2px of air between them. Bands run 20/42/66/86.
*/
const DEVICE_GEOMETRY = {
  compact: { widthRatio: 20/100, heightRatio: 20/30, gapRatio: 0/100 },
  wide:    { widthRatio: 20/100, heightRatio: 23/30, gapRatio: 2/100 }
};
const DEFAULT_DEVICE_GEOMETRY = 'compact';

function getDeviceLayout(ribbonW, ribbonH, count, profile = DEFAULT_DEVICE_GEOMETRY){
  const g = DEVICE_GEOMETRY[profile] || DEVICE_GEOMETRY[DEFAULT_DEVICE_GEOMETRY];
  // Devices are square in the source art, so take whichever axis binds first.
  const size = Math.min(ribbonW * g.widthRatio, ribbonH * g.heightRatio);
  const gap  = ribbonW * g.gapRatio;
  const step = size + gap;
  const totalW = count > 0 ? size * count + gap * (count - 1) : 0;
  return { size, totalW, step };
}

// Families whose baked device art uses the 'wide' profile.
const CAPUB_WIDE_DEVICE_FAMILIES = new Set([
  'cadet_advisory_council_ribbon','cap_gill_robb_wilson_ribbon','cap_paul_e_garber_ribbon',
  'cap_leadership_ribbon','national_cadet_competition_ribbon','national_color_guard_competition_ribbon'
]);
function getDeviceGeometryProfile(ribbonId){
  return CAPUB_WIDE_DEVICE_FAMILIES.has(normalizeRibbonId(ribbonId)) ? 'wide' : DEFAULT_DEVICE_GEOMETRY;
}

function drawDevicesOnRibbon(ribbonObj,leftPx,topPx,w,h){
  // Takes the ribbon INSTANCE, not an id. Overflow awards render the same
  // ribbon id more than once with different device sets, and looking up by id
  // drew the first instance's devices onto every copy.
  const r = (ribbonObj && typeof ribbonObj === 'object')
    ? ribbonObj
    : State.ribbons.find(x=>x.id===ribbonObj && x.devices);
  if(!r || !r.devices) return;
  const rid = r.id;
  const instanceIndex = Math.max(0, State.ribbons.indexOf(r));

  const flat=[];
  for(const [devId,count] of Object.entries(r.devices||{})){
    const meta=deviceMeta[devId];
    if(!meta) continue;
    for(let i=0;i<count;i++){ flat.push({id:devId,...meta}); }
  }
  if(!flat.length) return;

  flat.sort((a,b)=>(b.weight-a.weight)|| (a.label||a.id).localeCompare(b.label||b.id));
  const layout=getDeviceLayout(w, h, flat.length, getDeviceGeometryProfile(rid));
  let x=leftPx+(w-layout.totalW)/2;
  const y=topPx+(h-layout.size)/2;

  flat.forEach((d,i)=>{
    const im=document.createElement(d.text ? 'span' : 'img');
    im.className='layer ribbonDevice';
    im.dataset.parentRid = rid;
    // Include the instance index: overflow awards draw the same ribbon id more
    // than once, and without it both copies would share one calibration key.
    im.dataset.calibKey = instanceIndex > 0
      ? `device:${rid}#${instanceIndex}:${d.id}:${i}`
      : `device:${rid}:${d.id}:${i}`;
    if(d.text){
      im.textContent=d.text;
      im.style.cssText+='display:flex;align-items:center;justify-content:center;color:#d7dce3;font:900 8px/1 Arial;text-shadow:0 1px #374151;';
    }else{
      im.src=ASSET(d.src);
      im.alt=d.label||d.id;
      im.onerror=()=>{ im.remove(); };
    }
    im.style.display='block';

    applyCalibToElement(im, im.dataset.calibKey, { x, y, w:layout.size, h:layout.size, r:0 });

    im.dataset.tooltipTitle = d.label||d.id;
    im.dataset.tooltipReg   = "Device on ribbon";
    im.dataset.tooltipWhy   = "Represents additional awards/credit per CAPR 39-3.";
    uniformCanvas.appendChild(im);
    x+=layout.step;
  });
}

function onRibbonTileClick(rid){
  if(State.ribbonDragMode) return;

  if(State.deviceRemoveMode){
    const r=ensureRibbonObj(rid);
    r.devices={};
    renderRack();
    return;
  }
  if(!State.deviceApplyMode) return;

  const r=ensureRibbonObj(rid);
  for(const [devId,qty] of Object.entries(State.selectedDevices)){
    r.devices[devId]=(r.devices[devId]||0)+qty;
  }
  renderRack();
}

function initRibbonDragHandlers(tileEl){
  tileEl.addEventListener('mousedown', e => {
    if(!State.ribbonDragMode) return;
    currentDrag = tileEl;
    currentDrag.classList.add('dragging');
    const startLeft = parseFloat(currentDrag.style.left) || 0;
    const startTop  = parseFloat(currentDrag.style.top)  || 0;
    dragOffsetX = e.clientX - startLeft;
    dragOffsetY = e.clientY - startTop;
    e.preventDefault();
  });
}
function syncDevicesToRibbon(ribbonTileEl){
  const rid = ribbonTileEl.dataset.rid;
  if(!rid) return;

  const baseLeft = parseFloat(ribbonTileEl.style.left) || 0;
  const baseTop  = parseFloat(ribbonTileEl.style.top)  || 0;
  const w = parseFloat(ribbonTileEl.style.width)  || RIBBON_WIDTH;
  const h = parseFloat(ribbonTileEl.style.height) || RIBBON_HEIGHT;

  const r = State.ribbons.find(x => x.id===rid);
  if(!r || !r.devices) return;

  const flat=[];
  for(const [devId,count] of Object.entries(r.devices)){
    const meta=deviceMeta[devId];
    if(!meta) continue;
    for(let i=0;i<count;i++){ flat.push({id:devId,...meta}); }
  }
  flat.sort((a,b)=>(b.weight-a.weight)|| (a.label||a.id).localeCompare(b.label||b.id));

  const layout=getDeviceLayout(w, h, flat.length, getDeviceGeometryProfile(rid));
  let x=baseLeft+(w-layout.totalW)/2;
  const y=baseTop+(h-layout.size)/2;

  const devEls=[...uniformCanvas.querySelectorAll('.ribbonDevice')].filter(el=>el.dataset.parentRid===rid);
  devEls.forEach((el,idx)=>{
    const dv=flat[idx];
    if(!dv) return;

    const key = el.dataset.calibKey;
    const hasOverride = !!getCalib(key);
    if(!hasOverride){
      el.style.left   = x+'px';
      el.style.top    = y+'px';
      el.style.width  = layout.size+'px';
      el.style.height = layout.size+'px';
    }
    x+=layout.step;
  });
}
document.addEventListener('mousemove', e => {
  if(!currentDrag || !State.ribbonDragMode) return;
  let newLeft = e.clientX - dragOffsetX;
  let newTop  = e.clientY - dragOffsetY;

  const box = uniformCanvas.getBoundingClientRect();
  const maxX = box.width  - (parseFloat(currentDrag.style.width)  || RIBBON_WIDTH);
  const maxY = box.height - (parseFloat(currentDrag.style.height) || RIBBON_HEIGHT);
  if(newLeft < 0) newLeft = 0;
  if(newTop  < 0) newTop  = 0;
  if(newLeft > maxX) newLeft = maxX;
  if(newTop  > maxY) newTop  = maxY;

  currentDrag.style.left = newLeft + 'px';
  currentDrag.style.top  = newTop  + 'px';

  syncDevicesToRibbon(currentDrag);
});
document.addEventListener('mouseup', () => {
  if(currentDrag){
    currentDrag.classList.remove('dragging');
    currentDrag = null;
  }
});

function renderRack(){
  clearMeasurementOverlay();
  [...uniformCanvas.querySelectorAll('.layer.ribbonTile,.layer.ribbonMini,.layer.ribbonDevice')].forEach(n=>n.remove());
  if(typeof syncRibbonRowOverrideControl==='function') syncRibbonRowOverrideControl();

  const baseCfg = UNIFORMS[State.uniform];
  if(!baseCfg) return;

  const uniformPrefersMini   = baseCfg.mini;
  const uniformAllowsRibbons = baseCfg.ribbons;

  // Field uniforms (ABU, OCP, CFU/CDFU, and flight suit) never wear ribbons or mini medals.
  // This also blocks stale saved profiles where the manual mini-medal override was left on.
  if(isFieldUniform(State.uniform)) return;

  const autoMini   = by('autoMini')?.checked !== false;
  const manualMini = !!State.forceMini;
  const useMini = State.membership === 'senior' && !isFieldUniform(State.uniform) &&
    ((uniformPrefersMini && autoMini) || (uniformPrefersMini && manualMini));

  const items = sortRibbons(State.ribbons);
  if(!items.length) return;

  let rackLayout = getRibbonLayout();
  let rackTranslationX = 0;
  const automaticClassALapel = State.uniform==='blues_a' &&
    State.ribbonRackArrangement==='lapel' && !State.ribbonRowOverrideEnabled;
  let automaticUsesFourColumns=false;
  if(automaticClassALapel){
    const decision=getAutomaticClassARibbonLayout(items);
    rackLayout=decision.layout;
    automaticUsesFourColumns=decision.useFourColumns;
  }

  // Four-centered is a pure translation of the generated four-left rack. Build
  // every row with the same left-aligned geometry and lapel logic, then move all
  // rendered ribbons together until a complete row of four is pocket-centered.
  // This preserves every upper row's position relative to the rack as a whole.
  if(State.uniform==='blues_a' && State.ribbonRackLayout==='4-center' && rackLayout.columns===4){
    const centeredLayout=getRibbonLayout('blues_a','4-center');
    const leftAlignedLayout=getRibbonLayout('blues_a','4-left');
    rackTranslationX=centeredLayout.baseX-leftAlignedLayout.baseX;
    rackLayout=leftAlignedLayout;
  }
  const BOTTOM_ROW_Y   = rackLayout.bottomY;
  const RACK_CENTER_X  = rackLayout.centerX;
  const RW = rackLayout.w;
  const RH = rackLayout.h;
  const RGX = rackLayout.gapX;
  const RGY = rackLayout.gapY;
  const RACK_COLUMNS = rackLayout.columns;

  function getCenteredRowLeftPositions(count, itemW, gapX){
    const totalWidth = count * itemW + (count-1)*gapX;
    const rowLeftBase = RACK_CENTER_X - totalWidth/2;
    const arr=[];
    for(let i=0;i<count;i++) arr.push(rowLeftBase + i*(itemW+gapX));
    return arr;
  }

  function getRowLeftPositions(rowsTopFirst, topIndex, itemW, gapX){
    const row = rowsTopFirst[topIndex];
    const count = row.length;
    const standard = State.uniform !== 'blues_a' ||
      State.ribbonRackArrangement !== 'lapel' ||
      (automaticClassALapel && !automaticUsesFourColumns);
    if(standard) return getCenteredRowLeftPositions(count, itemW, gapX);

    const fullRackWidth = RACK_COLUMNS * itemW + (RACK_COLUMNS-1)*gapX;
    const rackRight = RACK_CENTER_X + fullRackWidth/2;
    const lapelAvoidanceEdge = Number.isFinite(rackLayout.wearerLeftPocketEdgeX)
      ? rackLayout.wearerLeftPocketEdgeX
      : rackRight;
    const rowWidth = count * itemW + (count-1)*gapX;

    // All incomplete intermediate rows align toward the wearer's left/outboard
    // edge (screen right). The final top row is centered over the row directly
    // below, as explicitly required by CAPR 39-1 paragraph 11.2.7.
    let rowCenter = RACK_CENTER_X;
    if(topIndex === 0 && rowsTopFirst.length > 1){
      const belowCount = rowsTopFirst[1].length;
      const belowWidth = belowCount * itemW + (belowCount-1)*gapX;
      rowCenter = belowCount < RACK_COLUMNS
        ? lapelAvoidanceEdge - belowWidth/2
        : RACK_CENTER_X;
    }else if(count < RACK_COLUMNS){
      rowCenter = lapelAvoidanceEdge - rowWidth/2;
    }

    const rowLeftBase = rowCenter - rowWidth/2;
    return Array.from({length:count}, (_,index) => rowLeftBase + index*(itemW+gapX));
  }

  if(!useMini && uniformAllowsRibbons){
    const useLapelAvoidance = State.uniform === 'blues_a' &&
      State.ribbonRackArrangement === 'lapel' &&
      (!automaticClassALapel || automaticUsesFourColumns);
    const customRows=getCustomRibbonRowsHighToLow(items,RACK_COLUMNS);
    const rowsTopFirst = customRows || (useLapelAvoidance
      ? buildLapelAvoidanceRowsHighToLow(items, RACK_COLUMNS, rackLayout)
      : buildRibbonRowsHighToLow(items, RACK_COLUMNS));
    const totalRows = rowsTopFirst.length;

    rowsTopFirst.forEach((row, topIndex)=>{
      const indexFromBottom = (totalRows - 1 - topIndex);
      const rowTopPx = BOTTOM_ROW_Y - indexFromBottom * (RH + RGY);
      const leftPositions = getRowLeftPositions(rowsTopFirst, topIndex, RW, RGX);

      row.forEach((ribbonObj,i)=>{
        const rid = normalizeRibbonId(ribbonObj.id);

        const tile=document.createElement('img');
        tile.className='layer ribbonTile';
        if(isMilitaryRibbonId(ribbonObj.id)) tile.classList.add('militaryRibbonTile');
        tile.style.display='block';
        capubInstallImageFallback(tile, [
          getRibbonImagePath(ribbonObj),
          `ribbons/${rid}.png`
        ]);

        const leftPx = leftPositions[i] + rackTranslationX;
        const topPx  = rowTopPx;

        tile.dataset.rid=ribbonObj.id;
        tile.dataset.calibKey = `ribbon:${ribbonObj.id}`;

        applyCalibToElement(tile, tile.dataset.calibKey, { x:leftPx, y:topPx, w:RW, h:RH, r:0 });

        tile.style.pointerEvents='auto';
        tile.onclick=()=>onRibbonTileClick(ribbonObj.id);

        tile.dataset.tooltipTitle = ribbonObj.id.replace(/_/g,' ').toUpperCase();
        tile.dataset.tooltipReg   = "CAPR 39-3 precedence applies";
        tile.dataset.tooltipWhy   = customRows
          ? `This row follows the active custom Class A row-grid override; the final top row remains centered over the row below.`
          : useLapelAvoidance
          ? `The standard three-across rack exceeded 51% lapel coverage, so automatic mode switched to four-across and keeps each ribbon at or below the overlap limit.`
          : `Highest awards render top-left; ${RACK_COLUMNS}-wide rows and a centered partial top row follow the selected uniform.`;

        initRibbonDragHandlers(tile);
        uniformCanvas.appendChild(tile);
        if(isMilitaryRibbonId(ribbonObj.id)) applyMilitaryRibbonVariant(tile,ribbonObj);

        const renderedLeft = parseFloat(tile.style.left) || leftPx;
        const renderedTop  = parseFloat(tile.style.top) || topPx;
        const renderedW    = parseFloat(tile.style.width) || RW;
        const renderedH    = parseFloat(tile.style.height) || RH;
        if(!isMilitaryRibbonId(ribbonObj.id)) drawDevicesOnRibbon(ribbonObj, renderedLeft, renderedTop, renderedW, renderedH);
      });
    });

    return;
  }

  // Miniature suspension ribbons are 11/16 inch wide. Scale the complete
  // McChord 50x176 artwork from that regulated width and preserve its ratio.
  // Mounting bars use four medals per row; holding bars use the balanced/
  // overlapped rows in CAPR 39-1 Table 11-1.
  const MINI_W = 0.6875 * CAPUB_PIXELS_PER_INCH;
  const MINI_H = MINI_W * (176 / 50);
  const MEDAL_RIBBON_PORTION = MINI_H * (116 / 176);
  const miniLayoutBucket = State.gender ? `${State.uniform}_${State.gender}` : State.uniform;
  const miniLayout = MINI_MEDAL_LAYOUT_BY_UNIFORM[miniLayoutBucket] ||
    MINI_MEDAL_LAYOUT_BY_UNIFORM[State.uniform] || {};
  const MEDAL_STEP_Y = miniLayout.rowStepY ?? (MEDAL_RIBBON_PORTION * 0.5);
  const miniMountStyle = State.miniMountStyle === 'holding' ? 'holding' : 'mounting';

  const medalItems = [];
  for(const r of items){
    const medalPath = getMiniMedalImagePath(r);
    if(medalPath){
      medalItems.push({
        id:r.id,
        path:medalPath,
        awardValue:r.awardValue || '',
        militaryDevices:isMilitaryRibbonId(r.id) ? [...(r.militaryDevices || [])] : []
      });
    }
  }
  if(!medalItems.length) return;

  const medalRowsTopFirst = buildMiniMedalRowsHighToLow(medalItems, miniMountStyle);
  const totalMedalRows = medalRowsTopFirst.length;
  const BOTTOM_ROW_Y_MEDALS = miniLayout.bottomY ?? (BOTTOM_ROW_Y + 20);
  const MINI_RACK_CENTER_X = miniLayout.centerX ?? RACK_CENTER_X;
  const medalRowGeometry = medalRowsTopFirst.map(row=>{
    const entries=row.map(entry=>{
      const key=`mini:${entry.id}`;
      return {entry,key,size:getCalibratedLayerGeometry(key,{x:0,y:0,w:MINI_W,h:MINI_H,r:0})};
    });
    return buildVariableMedalRowGeometry(entries,{
      holding:miniMountStyle === 'holding',
      suspensionRatio:(116/176)
    });
  });

  // Work upward from the calibrated bottom row. Mixed CAP/military rows now
  // derive vertical overlap from their actual calibrated heights rather than
  // assuming every image retained the original McChord dimensions.
  const medalRowTops=Array(totalMedalRows).fill(BOTTOM_ROW_Y_MEDALS);
  for(let index=totalMedalRows-2;index>=0;index--){
    const dynamicStep=Math.max(
      medalRowGeometry[index].suspensionHeight,
      medalRowGeometry[index+1].suspensionHeight
    )*.5;
    const rowStep=miniLayout.rowStepY ?? dynamicStep ?? MEDAL_STEP_Y;
    medalRowTops[index]=medalRowTops[index+1]-rowStep;
  }

  medalRowsTopFirst.forEach((row,topIndex)=>{
    const indexFromBottom = (totalMedalRows - 1 - topIndex);
    const rowTopPx = medalRowTops[topIndex];
    // Holding bars keep a four-medal exposed span. Rows of five through seven
    // overlap equally, never exceeding CAPR 39-1's 50-percent limit.
    const geometry=medalRowGeometry[topIndex];
    const rowLeft = MINI_RACK_CENTER_X - geometry.rowWidth / 2;
    const leftPositions = row.map((_,i) => rowLeft + geometry.offsets[i]);

    row.forEach((entry,i)=>{
      const mimg=document.createElement('img');
      mimg.className='layer ribbonMini';
      mimg.style.display='block';
      mimg.style.objectFit='fill';
      // Upper rows cover the ribbon portion of lower rows, so they render in
      // front. Within a row, the higher-precedence (left) medal stays on top.
      mimg.style.zIndex=String(300 + indexFromBottom * 20 + (row.length - i));

      const leftPx=leftPositions[i];
      const topPx =rowTopPx;

      mimg.dataset.calibKey = geometry.entries[i].key;
      applyMiniRackCalibToElement(mimg, mimg.dataset.calibKey, {
        x:leftPx,y:topPx,w:geometry.entries[i].size.w,h:geometry.entries[i].size.h,r:0
      });

      const fallbackPath = miniMedalImages[normalizeRibbonId(entry.id)] || miniMedalImages[entry.id];
      capubInstallImageFallback(mimg, [entry.path, fallbackPath]);
      mimg.dataset.tooltipTitle = entry.id.replace(/_/g,' ').toUpperCase();
      mimg.dataset.tooltipReg   = "Miniature medal arrangement";
      mimg.dataset.tooltipWhy   = miniMountStyle === 'holding'
        ? "CAPR 39-1 Table 11-1 holding bars: balanced rows, custom horizontal overlap, maximum 28 medals."
        : "CAPR 39-1 Table 11-1 mounting bars: four per row, maximum 24 medals.";

      uniformCanvas.appendChild(mimg);
      if(isMilitaryRibbonId(entry.id)){
        applyMilitaryMedalVariant(mimg,entry.path,entry.militaryDevices,'MINIATURE_MEDAL');
      }
    });
  });
}

/* ===========================
   DEVICE TOOL UI
   =========================== */
function buildDevicePicker(){
  const wrap=by('devicePicker');
  wrap.innerHTML='';
  deviceList.forEach(id=>{
    const row=document.createElement('label');
    row.style.cssText="display:flex;align-items:center;gap:8px;font-size:12px;";
    row.innerHTML=`
      <input type="checkbox" data-device="${id}"/>
      <span>${deviceMeta[id].label}</span>
      <input type="number" min="1" max="10" value="1" data-qty="${id}" style="width:70px;margin-left:auto">
    `;
    wrap.appendChild(row);
  });
}
function readDevicePicker(){
  const wrap=by('devicePicker');
  const bundle={};
  wrap.querySelectorAll('input[type="checkbox"][data-device]').forEach(chk=>{
    const id=chk.getAttribute('data-device');
    if(chk.checked){
      const qty=parseInt(wrap.querySelector(`input[type="number"][data-qty="${id}"]`).value||"1",10);
      if(qty>0) bundle[id]=qty;
    }
  });
  return bundle;
}
function wireDeviceUI(){
  const applyBtn = by('deviceApplyModeBtn');
  const removeBtn= by('deviceRemoveModeBtn');
  const clearBtn = by('deviceClearSelectionBtn');

  applyBtn.addEventListener('click', ()=>{
    State.selectedDevices = readDevicePicker();
    const hasAny = Object.keys(State.selectedDevices).length>0;
    State.deviceApplyMode = hasAny;
    State.deviceRemoveMode = false;
    applyBtn.textContent = State.deviceApplyMode ? 'Apply Mode: ON' : 'Enable Apply Mode';
    applyBtn.classList.toggle('ghost', !State.deviceApplyMode);
    removeBtn.classList.add('ghost');
    removeBtn.textContent='Enable Remove Mode';
  });

  removeBtn.addEventListener('click', ()=>{
    State.deviceRemoveMode = !State.deviceRemoveMode;
    State.deviceApplyMode = false;
    removeBtn.textContent = State.deviceRemoveMode ? 'Remove Mode: ON' : 'Enable Remove Mode';
    removeBtn.classList.toggle('ghost', !State.deviceRemoveMode);
    applyBtn.textContent='Enable Apply Mode';
    applyBtn.classList.add('ghost');
  });

  clearBtn.addEventListener('click', ()=>{
    by('devicePicker').querySelectorAll('input[type="checkbox"]').forEach(c=>c.checked=false);
    by('devicePicker').querySelectorAll('input[type="number"]').forEach(n=>n.value=1);
    State.selectedDevices={};
    State.deviceApplyMode=false;
    State.deviceRemoveMode=false;
    applyBtn.textContent='Enable Apply Mode';
    removeBtn.textContent='Enable Remove Mode';
    applyBtn.classList.add('ghost');
    removeBtn.classList.add('ghost');
  });
}
