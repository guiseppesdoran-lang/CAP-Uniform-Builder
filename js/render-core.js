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
// Where those two stand among the military-catalog ribbons: the place the catalog gives the same award (military/military-data.js: 'air_medal' and 'aerial_achievement',
// each carrying its place in the services' charts, the Aerial Achievement Medal one after the Air Medal and before every commendation medal). The catalog's own order
// (CAPUBMilitary.compareAwardsUniversal) reads a category from an award's name, which files the Aerial Achievement Medal with the achievement medals, after the
// commendation medals; it stands with the Air Medal here, as in every chart.
const CAPUB_FEDERAL_CATALOG_AWARD = { air_medal:{ id:'air_medal' }, air_force_aerial_achievement_medal:{ id:'aerial_achievement', category:'AIR_MEDAL' } };
// The catalog award a federal ribbon holds its place by: a military-catalog ribbon's own, or the award behind one of the two in the CAP list; null for any other.
function federalCatalogAward(id){
  if(isMilitaryRibbonId(id)) return getMilitaryRibbonAward(id);
  const as = CAPUB_FEDERAL_CATALOG_AWARD[id];
  const award = as ? getMilitaryRibbonAward(as.id) : null;
  return award && as.category ? { ...award, category:as.category } : award;
}
function ribbonPrecedenceGroup(id){
  if(isRotcRibbonId(id)) return 2; // JROTC/ROTC awards follow the CAP awards and precede foreign ones (39-1 11.2.1)
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
    if(aMilitary !== bMilitary){
      // A military-catalog ribbon against Air Medal or the Aerial Achievement Medal of the CAP list: by their places in the military order, the military ribbon first only when the two stand level.
      const aa = federalCatalogAward(a.id), ba = federalCatalogAward(b.id);
      const byPlace = aa && ba && window.CAPUBMilitary?.compareAwardsUniversal ? window.CAPUBMilitary.compareAwardsUniversal(aa,ba) : 0;
      return byPlace || (aMilitary ? -1 : 1);
    }
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
