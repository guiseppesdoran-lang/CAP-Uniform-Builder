// Ribbon precedence and the rack controls' helpers. The rack itself is drawn by js/engine.


/* ===========================
   RIBBON ORDER AND RACK CONTROLS
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


function normalizeRibbonRowOverride(value=State.ribbonRowOverride, perRow=4){
  if(!Array.isArray(value)) return [];
  return value.map(Number).filter(count=>Number.isInteger(count) && count>=1 && count<=perRow);
}


function renderRack(){
  if(typeof syncRibbonRowOverrideControl==='function') syncRibbonRowOverrideControl();
  return CAPUBUniformView.scheduleRender();
}
