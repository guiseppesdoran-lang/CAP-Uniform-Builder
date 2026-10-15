// Composition recipes for the precomposed military ribbon variants: base ribbon asset + device assets + positions (inches).
// No ribbon art is duplicated. Rule: military/military-device-layout.js DEFAULT_CONTEXTS.ribbon (slot fractions of the ribbon width,
// centred on half the ribbon height).  Output: ribbons/military-variants.json
const fs=require('fs'),path=require('path'),vm=require('vm');
const HERE=__dirname,REPO=path.join(HERE,'../..');
const sb={};vm.createContext(sb);sb.globalThis=sb;sb.window=sb;sb.self=sb;
vm.runInContext(fs.readFileSync(path.join(REPO,'military/military-data.js'),'utf8'),sb);
const DATA=sb.CAPUBMilitaryData;
const LAY=require(path.join(REPO,'military/military-device-layout.js'));
const W_IN=1.375,H_IN=0.375,CTX=LAY.DEFAULT_CONTEXTS.ribbon;
const VI=JSON.parse(fs.readFileSync(path.join(HERE,'ribbons/military/_variant-base-index.json')));
const AI=JSON.parse(fs.readFileSync(path.join(HERE,'ribbons/military/_index.json')));
const SIZES=JSON.parse(fs.readFileSync(path.join(HERE,'devices/_military-device-sizes.json')));
const wh=id=>{const f=path.join(HERE,'devices',id+'.spec.json');return fs.existsSync(f)?JSON.parse(fs.readFileSync(f)).size_in:null;};
const DEV={
  BRONZE_OLC:'mil-device-olc-bronze',SILVER_OLC:'mil-device-olc-silver',
  BRONZE_SERVICE_STAR:'device-star-bronze',SILVER_SERVICE_STAR:'device-star-silver',
  GOLD_AWARD_STAR:'device-star-gold',SILVER_AWARD_STAR:'device-star-silver',
  V_DEVICE:'device-v',C_DEVICE:'mil-device-letter-c',R_DEVICE:'mil-device-letter-r',M_DEVICE:'mil-device-letter-m',N_DEVICE:'mil-device-letter-n',
  ARROWHEAD_DEVICE:'mil-device-arrowhead',
  BRONZE_HOURGLASS:'mil-device-hourglass-bronze',SILVER_HOURGLASS:'mil-device-hourglass-silver',GOLD_HOURGLASS:'mil-device-hourglass-gold'};
const deviceAssets={};
for(const [k,id] of Object.entries(DEV)){
  const s=wh(id),m=SIZES[k];
  deviceAssets[k]={asset_id:id,size_in:s,composite_measured_in:m?{w:m.w_in,h:m.h_in,samples:m.samples}:null,
    scale_to_match_raster:(m&&s)?+(m.w_in/s.w).toFixed(3):1,exists:!!s};}
const out=[],problems=[];
const sel=a=>a;
for(const v of DATA.deviceVariants.ribbonAssets){
  const base=VI[v.awardId]||AI[v.awardId]||null;
  const n=v.devices.length;
  const slots=n?(CTX.slots[n]||LAY.normalizedSlots(n,CTX)):[];
  const devs=v.devices.map((d,i)=>{
    const a=deviceAssets[d];
    if(!a||!a.exists)problems.push(`${v.key}: no asset for ${d}`);
    return {catalog_id:d,asset_id:a?a.asset_id:null,center_in:[+(slots[i]*W_IN).toFixed(4),+(CTX.centerY*H_IN).toFixed(4)],
      scale:1,scale_to_match_raster:a?a.scale_to_match_raster:1,z:i};});
  out.push({key:v.key,award_id:v.awardId,service:v.service,base_ribbon_id:base,devices:devs,
    raster:{asset:v.asset,sha256:v.sha256,canvas_px:v.canvas,style:v.style},
    device_slot_rule:n?`${n} device(s): slots ${JSON.stringify(slots)} of ribbon width`:'no devices'});
  if(!base)problems.push(`${v.key}: no base ribbon asset for award ${v.awardId}`);
}
const doc={schema:1,generated:'2026-10-13',units:'inches; origin = top-left of the 1.375 x 0.375 in ribbon; device positions are centres',
  layout_rule:{source:'military/military-device-layout.js DEFAULT_CONTEXTS.ribbon',slots:CTX.slots,center_y_fraction:CTX.centerY,
    note:'x_in = slot_fraction * 1.375, y_in = 0.5 * 0.375. scale = 1 draws each device at its asset size; scale_to_match_raster reproduces the size drawn in the precomposed PNG (measured).'},
  device_assets:deviceAssets,variants:out,problems};
fs.writeFileSync(path.join(HERE,'ribbons/military-variants.json'),JSON.stringify(doc,null,1));
const byBase=new Set(out.map(o=>o.base_ribbon_id));
console.log({variants:out.length,unique_rasters:new Set(out.map(o=>o.raster.asset)).size,base_ribbons_used:byBase.size,device_types:Object.keys(deviceAssets).length,problems:problems.length});
if(problems.length)console.log(problems.slice(0,10));
