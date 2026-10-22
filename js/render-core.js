// Ribbon precedence and the rack controls' helpers. The rack itself is drawn by js/engine.


/* ===========================
   RIBBON ORDER AND RACK CONTROLS
   =========================== */
// The groups of 39-1 11.2.1: U.S. federal awards, then CAP awards, then foreign awards. The Army
// Air Forces Air Medal and the Air Force Aerial Achievement Medal in the CAP list are federal awards
// (the Air Medal ranks above the Aerial Achievement Medal). The AFOEA is worn below the lowest military
// ribbon and above the CAP ribbons (ICL 18-02, 39-3 ICL 5), so it is a group of its own between them.
const CAPUB_FEDERAL_IN_CAP_LIST = ['air_medal','air_force_aerial_achievement_medal'];
const CAPUB_AFOEA_ID = 'Air_Force_Organizational_Excellence_Award';
function ribbonPrecedenceGroup(id){
  if(isMilitaryRibbonId(id)) return militaryAwardFilterType(getMilitaryRibbonAward(id)) === 'FOREIGN' ? 3 : 0;
  if(id === CAPUB_AFOEA_ID) return 0.5;
  return CAPUB_FEDERAL_IN_CAP_LIST.includes(id) ? 0 : 1;
}
function sortRibbons(arr){
  return [...arr].sort((a,b)=>{
    const ag = ribbonPrecedenceGroup(a.id), bg = ribbonPrecedenceGroup(b.id);
    if(ag !== bg) return ag - bg;
    const aMilitary = isMilitaryRibbonId(a.id);
    const bMilitary = isMilitaryRibbonId(b.id);
    if(aMilitary && bMilitary){
      const aa = getMilitaryRibbonAward(a.id);
      const ba = getMilitaryRibbonAward(b.id);
      if(aa && ba && window.CAPUBMilitary?.compareAwardsUniversal){
        return window.CAPUBMilitary.compareAwardsUniversal(aa,ba);
      }
    }
    if(aMilitary !== bMilitary) return aMilitary ? -1 : 1;
    const af = CAPUB_FEDERAL_IN_CAP_LIST.indexOf(a.id), bf = CAPUB_FEDERAL_IN_CAP_LIST.indexOf(b.id);
    if(af >= 0 && bf >= 0 && af !== bf) return af - bf;
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
