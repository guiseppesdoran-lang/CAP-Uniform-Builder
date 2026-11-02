'use strict';
// The shopping list (LIVE13 E63; Ethan: "the shopping list thing. make it better, and more expansive ... dynamic search to show low prices,
// and include everything for only the SELECTED uniform"). The list is derived from the composed scene: these tests compose uniforms with the
// engine in Node and check every drawn piece has a line, nothing from another uniform is listed, and the prices, totals and exports add up.
// tests/shopping-list-browser.cjs checks the dialog itself in Chrome (search, sort, subtotal, switching uniform).

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.join(__dirname,'..');
const core=fs.readFileSync(path.join(ROOT,'purchase-feature-core.js'),'utf8');
const css=fs.readFileSync(path.join(ROOT,'styles','app.css'),'utf8');
const SHOP=require('../purchase-feature-core.js');
const CAT=require('../purchase-catalog.js');
const E=require('../js/engine/core.js');
const G=require('../js/engine/grades.js');
const P=require('../js/engine/profiles.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');
require('../js/engine/profiles-polo.js');
const RA=require('../data/ribbon-awards.js');
const BADGES=require('../data/badge-catalog.js');

const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,'images','MANIFEST.json'),'utf8'));
const store=E.createSpecStore(manifest,p=>Promise.resolve(JSON.parse(fs.readFileSync(path.join(ROOT,'images',p),'utf8'))));

// ---- the dialog's markup ----------------------------------------------------------------------------------------

test('every cell of the item table is labelled so it can stand alone on a phone',()=>{
  for(const label of ['Own it','Item','Quantity','Where to buy','Price']){
    assert.ok(core.includes(`data-label="${label}"`),`${label} cell is labelled`);
  }
});

test('the phone layout is one card per item and never hides the item name',()=>{
  const block=css.slice(css.indexOf('@media (max-width:760px){\n  .capub-purchase-summary'));
  assert.doesNotMatch(block,/nth-child\(3\)\)?[^}]*display:none/);
  assert.match(block,/\.capub-purchase-table td\[data-label="Item"\]\{order:-1/);
  assert.match(block,/\.capub-purchase-table,\.capub-purchase-table tbody,\.capub-purchase-table tr,\.capub-purchase-table td\{display:block;width:100%\}/);
});

test('the long sourcing note is folded, and its words are unchanged',()=>{
  assert.match(core,/<details class="capub-purchase-rule"><summary><b>How items are sourced<\/b><\/summary>/);
  assert.match(core,/A visually similar USAF or other military item is not treated as a substitute\./);
});

test('the own-it checkbox is a 44px row on a phone',()=>{
  assert.match(css,/td\[data-label="Include"\],\.capub-purchase-table td\[data-label="Own it"\]\{display:flex;align-items:center;min-height:44px\}/);
});

test('the dialog has a live search, a price sort and text and CSV exports, and asks no vendor site for prices',()=>{
  assert.match(core,/id="capubShopSearch"/);
  assert.match(core,/addEventListener\('input'/);
  assert.match(core,/<option value="low">Price, low to high<\/option>/);
  assert.match(core,/cap-uniform-shopping-list\.txt/);
  assert.match(core,/cap-uniform-shopping-list\.csv/);
  assert.doesNotMatch(core,/\bfetch\(|XMLHttpRequest|https?:\/\//,'the page cannot call vendor sites (CSP connect-src self); the links live in the catalog');
});

// ---- the catalog ------------------------------------------------------------------------------------------------

test('every catalog offer names a known vendor, a price or none, its status and the date it was seen',()=>{
  for(const [id,item] of Object.entries(CAT.items)){
    assert.ok(item.name&&item.group&&item.rule,`${id} has a name, group and sourcing rule`);
    // A piece not sold at retail (the CAP Crest) has no offer at all; every other item has one.
    if(item.notSold){ assert.deepEqual(item.offers,[],`${id}: not sold, no offers`); assert.match(item.note,/through CAP/,`${id}: says where it comes from`); continue; }
    assert.ok(item.offers.length>=1,`${id} has an offer`);
    for(const o of item.offers){
      assert.ok(CAT.vendors[o.vendor],`${id}: ${o.vendor} is a vendor`);
      if(o.price==null) assert.equal(o.status,null,`${id}: no status without a price`);
      else{
        assert.ok(Number.isFinite(o.price)&&o.price>0,`${id}: price`);
        assert.ok(['verified','estimated'].includes(o.status),`${id}: status`);
        assert.match(o.checked,/^\d{4}-\d\d-\d\d$/,`${id}: the date the price was seen`);
      }
      // The Ranger tabs' one offer is Hawk Mountain Ranger School's order form (a Google Form linked from capranger.org).
      if(o.url) assert.match(o.url,o.vendor==='capranger'?/^https:\/\/docs\.google\.com\/forms\/d\/e\/[A-Za-z0-9_-]+\/viewform$/:/^https:\/\/www\.(vanguardmil|uniforms-4u|iragreen)\.com\//,`${id}: product link`);
    }
  }
  assert.equal(CAT.items.blue_belt.offers[0].sku,'3924','the Uniforms-4U item number is the SKU');
  assert.match(CAT.search('iragreen','blue tie'),/^https:\/\/www\.iragreen\.com\/catalogsearch\/result\/\?q=blue%20tie$/);
});

// ---- the list, from composed scenes --------------------------------------------------------------------------------

function ribbonsOf(ids){
  return ids.flatMap(id=>RA.resolve(id,{}).map((r,i)=>({key:i?`ribbon:${id}#${i}`:`ribbon:${id}`,id,title:id.replace(/_/g,' '),asset:'ribbon-'+id.replace(/_/g,'-'),devices:r.devices,centered:r.centered})));
}
function medalsOf(ids){
  return ribbonsOf(ids).filter(r=>!/#/.test(r.key)).map(r=>({key:r.key.replace('ribbon:','mini:'),title:r.title,ribbonAsset:r.asset,medal:'medal-'+r.asset.slice(7)+'-miniature',devices:r.devices}));
}
function build(uniform,gender,membership,rank,extra){
  return Object.assign({
    uniform,gender,membership,grade:G.gradeInfo(membership,rank,{}),opt:{headgear:'auto'},name:{first:'Pat',last:'Doe',state:'Ohio',show:true},
    ribbons:[],medals:[],badges:[],command:null,militaryBadges:[],patches:[],cord:null
  },extra||{});
}
const RIBBON_IDS=['encampment_ribbon','red_service_ribbon','cap_achievment_award'];
const PILOT='CAPPilot1_FA9D33EA587D8';
const CASES=[
  ['blues_b','male','cadet','C/Capt',{ribbons:ribbonsOf(RIBBON_IDS),badges:[{id:PILOT},{id:'emergency_services_badge'}],cord:'honor_guard'}],
  ['blues_b','female','senior','Capt',{opt:{headgear:'auto',sleeve:'long'},ribbons:ribbonsOf(RIBBON_IDS)}],
  ['blues_a','male','senior','TSgt',{ribbons:ribbonsOf(RIBBON_IDS),badges:[{id:PILOT}]}],
  ['blues_a','female','cadet','C/Capt',{ribbons:ribbonsOf(RIBBON_IDS),cord:'honor_guard'}],
  ['semi_formal_usaf','male','cadet','C/Capt',{ribbons:ribbonsOf(RIBBON_IDS)}],
  ['mess_dress','male','senior','Col',{medals:medalsOf(RIBBON_IDS),badges:[{id:PILOT}],opt:{headgear:'auto',buttons:'cap-crest'}}],
  ['mess_dress','female','senior','Capt',{medals:medalsOf(RIBBON_IDS),opt:{headgear:'auto',skirt:'straight-split'}}],
  ['semi_formal','male','senior','Maj',{medals:medalsOf(RIBBON_IDS)}],
  ['aviator','female','senior','Lt Col',{opt:{headgear:'auto',tie:true},ribbons:ribbonsOf(RIBBON_IDS)}],
  ['aviator_blazer','male','senior','Capt',{badges:[{id:PILOT}]}],
  ['ocp','male','cadet','C/SSgt',{badges:[{id:PILOT}]}],
  ['abu','female','senior','Capt',{badges:[{id:PILOT}]}],
  ['corporate_field','male','senior','Maj',{opt:{headgear:'boonie',esPatch:'style-1'}}],
  ['flight_suit','male','senior','Capt',{badges:[{id:PILOT}],opt:{headgear:'auto',jacket:true,scarf:true,esPatch:'style-2'}}],
  ['corporate_flight_suit','female','senior','Capt',{}],
  ['polo','male','senior','Capt',{badges:[{id:PILOT}],opt:{headgear:'auto',poloShirt:'tactical'}}]
];
// Garments that belong to one uniform only: a line for one of them on any other uniform is a line from another uniform.
const ONLY={
  blues_b:/^(shirt_blue_short|blouse_blue_short)/, mess_dress:/^mess_/, ocp:/^ocp_|coyote/, abu:/^abu_/, corporate_field:/^cfu_|boonie/,
  flight_suit:/^fdu_|flight_jacket_green/, corporate_flight_suit:/^cfdu_/, polo:/^polo_/, aviator:/^aviator_shirt_short/, semi_formal_usaf:/semiformal/
};

for(const [uniform,gender,membership,rank,extra] of CASES){
  test(`${uniform} ${gender} ${membership} ${rank}: every drawn piece has a line and no line is another uniform's`,async()=>{
    const b=build(uniform,gender,membership,rank,extra);
    const scene=await P.composeUniform(b,store);
    const res=SHOP.deriveList(scene,b,{badges:BADGES});
    const drawn=scene.layers.filter(SHOP.drawnLayer);
    assert.ok(drawn.length>3,'the scene draws pieces');
    assert.deepEqual(res.uncovered,[],'every drawn layer has a line');
    assert.deepEqual(res.lines.filter(l=>l.unknown).map(l=>l.name),[],'every drawn layer is a known piece');
    for(const l of res.lines){
      if(l.notSold) assert.deepEqual([l.offers.length,l.lowest,l.total],[0,null,null],`${l.name}: not sold, no links or price`);
      else assert.ok(l.offers.length>=1&&l.offers.every(o=>/^https:\/\//.test(o.url)),`${l.name}: a vendor link`);
      if(l.lowest) assert.equal(l.lowest.price,Math.min(...l.offers.filter(o=>o.price!=null).map(o=>o.price)),`${l.name}: the lowest price`);
      for(const [u,re] of Object.entries(ONLY)) if(u!==uniform&&l.itemId) assert.doesNotMatch(l.itemId,re,`${l.name} belongs to ${u}`);
    }
    const ribbonLayers=drawn.filter(l=>l.role==='ribbon');
    assert.equal(res.lines.filter(l=>l.group==='Ribbons'&&/^Ribbon: /.test(l.name)).length,ribbonLayers.length,'a line per ribbon drawn');
    assert.equal(res.lines.some(l=>l.itemId==='ribbon_mount'),ribbonLayers.length>0,'the mounting bar exactly when there is a rack');
    const minis=new Set(drawn.filter(l=>/^mini/.test(l.role)).map(l=>l.key.replace(/:medal$/,'')));
    assert.equal(res.lines.filter(l=>/^Miniature medal: /.test(l.name)).length,minis.size,'a line per miniature medal');
    for(const l of drawn.filter(l=>l.role==='badge')) assert.ok(res.lines.some(x=>x.key===(l.figure===2?'fig2:':'')+'badge:'+l.key.split(':')[1]),`${l.key} has its line`);
    const devices=drawn.filter(l=>l.role==='device').length;
    const deviceLines=res.lines.filter(l=>/^device:/.test(l.key));
    assert.equal(deviceLines.reduce((n,l)=>n+l.layers.length,0),devices,'every device drawn is on a device line');
  });
}

test('the Class B cadet officer list: the right garments, grade forms, devices and quantities',async()=>{
  const b=build('blues_b','male','cadet','C/Capt',CASES[0][4]);
  const res=SHOP.deriveList(await P.composeUniform(b,store),b,{badges:BADGES});
  const ids=res.lines.map(l=>l.itemId).filter(Boolean);
  for(const id of ['shirt_blue_short_male','undershirt_white','trousers_blue_male','blue_belt','low_quarters','socks_black','nametag_blue_cadet','cadet_epaulet_sleeves_blank','ribbon_mount']) assert.ok(ids.includes(id),id);
  assert.ok(!ids.includes('blue_tie'),'the short-sleeve shirt is drawn without the tie, so no tie');
  const mini=res.lines.find(l=>/^Grade insignia/.test(l.name)&&/miniature/i.test(l.detail));
  assert.ok(mini&&/C\/Capt/.test(mini.name)&&mini.qty===1&&/one pair/.test(mini.detail),'one pair of miniature metal grade for the epaulets');
  const cord=res.lines.find(l=>l.key==='cord:honor-guard');
  assert.ok(cord&&cord.lowest.price===19.20,'the Honor Guard cord at its catalog price');
  const pilot=res.lines.find(l=>l.key==='badge:'+PILOT);
  assert.equal(pilot.detail,'Regular size');
  assert.match(res.lines.find(l=>l.itemId==='nametag_blue_cadet').detail,/"DOE"/);
});

test('the metal CAP collar device is Vanguard CAP0820, one pair for both collars; the cloth insignia is unchanged',async()=>{
  // LIVE13 E79: the product Ethan sent, a pair to the package.
  const it=CAT.items.cap_collar_metal;
  assert.equal(it.name,'Civil Air Patrol Collar Device: CAP - mirror finish');
  assert.deepEqual(it.offers[0],{vendor:'vanguard',price:6.10,status:'verified',checked:'2026-10-29',url:'https://www.vanguardmil.com/collections/cadet-insignia/products/civil-air-patrol-mirror-finish-cap-collar-device',sku:'CAP0820'});
  assert.match(it.note,/2 per package/);
  assert.equal(CAT.items.cap_collar_cloth.name,'CAP collar insignia, cloth (pair)');
  assert.ok(CAT.items.cap_collar_cloth.offers.every(o=>o.price==null),'the cloth insignia stays unpriced');
  // A senior member without grade on the NCO track wears the metal device on both collars (1.4.2.1): one line, one package.
  const b=build('blues_a','male','senior','SM',{grade:G.gradeInfo('senior','SM',{track:'nco'})});
  const res=SHOP.deriveList(await P.composeUniform(b,store),b,{badges:BADGES});
  const lines=res.lines.filter(l=>l.itemId==='cap_collar_metal');
  assert.equal(lines.length,1);
  assert.equal(lines[0].layers.length,2,'both collars on the one line');
  assert.equal(lines[0].qty,1);
  assert.equal(lines[0].lowest.price,6.10);
});

test('the CAP Crest on the blazer pocket is listed as not sold at retail: no links, no price, out of the totals',async()=>{
  // LIVE13 E79, Ethan: "the crest cannot be purchased normally".
  for(const [uniform,gender,extra] of [['aviator_blazer','male',{}],['aviator_blazer','female',{}],['semi_formal','male',{medals:medalsOf(RIBBON_IDS)}]]){
    const b=build(uniform,gender,'senior','Capt',extra);
    const res=SHOP.deriveList(await P.composeUniform(b,store),b,{badges:BADGES});
    const crest=res.lines.filter(l=>l.itemId==='cap_crest');
    assert.equal(crest.length,1,`${uniform} ${gender}: the crest is on the list`);
    assert.equal(crest[0].notSold,true);
    assert.deepEqual(crest[0].offers,[]);
    assert.equal(crest[0].total,null);
    assert.match(crest[0].note,/Issued\/obtained through CAP, not a vendor item/);
    const t=SHOP.totals(res.lines,{});
    assert.equal(t.notSold,1);
    assert.equal(t.unpriced,res.lines.filter(l=>!l.notSold&&l.total==null).length,'not counted as unpriced');
    assert.equal(t.subtotal,+res.lines.filter(l=>l.total!=null).reduce((a,l)=>a+l.total,0).toFixed(2));
    assert.match(SHOP.toText(res.lines,{}),/CAP Crest \(blazer pocket\) - Left breast pocket: not sold at retail\n(?!\s+\S+ (product|search):)/);
    assert.match(SHOP.toCSV(res.lines,{}),/CAP Crest \(blazer pocket\),Left breast pocket,1,,,,not sold at retail,/);
  }
  // A badge worn in the crest's place (4.2.3.1.1.1) takes it off the list.
  const b=build('aviator_blazer','male','senior','Col',{badges:[{id:'command_council_badge'}]});
  const res=SHOP.deriveList(await P.composeUniform(b,store),b,{badges:BADGES});
  assert.ok(!res.lines.some(l=>l.itemId==='cap_crest'),'no crest when the Command Council badge replaces it');
  assert.match(core,/not sold at retail<\/span><span class="capub-shop-low">Issued through CAP/);
});

test('a Ranger tab patch resolves to the capranger.org order form: no price, no vendor searches',()=>{
  // LIVE13 E79, Ethan: "the ranger tabs arent on vanguard ... they are on capranger.org with a custom order form". The art draws
  // them as patch-ranger-tab-<grade>; the list picks them up from the drawing like any patch.
  assert.equal(CAT.vendors.capranger.name,'Hawk Mountain Ranger School (capranger.org)');
  assert.equal(CAT.vendors.capranger.info,'https://www.capranger.org/cap-ranger-grades');
  const it=CAT.items.ranger_tab;
  assert.equal(it.byOrderForm,true);
  assert.deepEqual(it.offers.map(o=>[o.vendor,o.price,o.url]),[['capranger',null,'https://docs.google.com/forms/d/e/1FAIpQLSeVDbEhuYSTmkqFqGozQNdMkUjMHjWs3xToeDFYOoFJEz4RCQ/viewform']]);
  assert.deepEqual(CAT.patchItem('patch-ranger-tab-senior-ranger'),{item:'ranger_tab',detail:'Senior Ranger'});
  assert.equal(CAT.patchItem('patch-cap-command-patch'),null);
  const scene={title:'OCP Uniform',layers:[
    {type:'asset',role:'patch',id:'patch-ranger-tab-first-class',key:'patch:ranger_tab_first_class',title:'Ranger First Class tab',x:0,y:0,w:1,h:1},
    {type:'raster',role:'patch',id:'',key:'patch:some_unit_patch',title:'Unit patch',x:0,y:0,w:1,h:1}]};
  const res=SHOP.deriveList(scene,{uniform:'ocp'},{badges:BADGES});
  assert.deepEqual(res.uncovered,[]);
  const tab=res.lines.find(l=>l.itemId==='ranger_tab');
  assert.ok(tab,'the tab has its catalog line');
  assert.equal(tab.detail,'First Class');
  assert.deepEqual(tab.offers.map(o=>[o.vendorName,o.kind,o.price]),[['Hawk Mountain Ranger School (capranger.org)','form',null]]);
  assert.equal(tab.total,null);
  assert.ok(!tab.offers.some(o=>/vanguardmil|uniforms-4u|iragreen/.test(o.url)),'no vendor searches');
  const unit=res.lines.find(l=>/Unit patch/.test(l.name));
  assert.ok(unit&&unit.offers.some(o=>o.vendor==='vanguard'),'an ordinary patch keeps its vendor offers');
  const text=SHOP.toText(res.lines,{});
  assert.match(text,/CAP Ranger tab - First Class: by order form\n    Hawk Mountain Ranger School \(capranger\.org\) order form: https:\/\/docs\.google\.com\/forms\//);
  assert.match(SHOP.toCSV(res.lines,{}),/,by order form,/);
  assert.match(core,/'<span class="capub-shop-none">by order form<\/span>/);
});

test('the field and flight uniforms list the badge in the form drawn, the name tapes and the sheet\'s own patches',async()=>{
  const ocp=build('ocp','male','cadet','C/SSgt',{badges:[{id:PILOT}]});
  const r1=SHOP.deriveList(await P.composeUniform(ocp,store),ocp,{badges:BADGES});
  assert.equal(r1.lines.find(l=>l.key==='badge:'+PILOT).detail,'Subdued cloth');
  for(const id of ['ocp_name_tape','ocp_cap_tape','us_flag_patch_ocp','aux_patch_ocp','ocp_patrol_cap']) assert.ok(r1.lines.some(l=>l.itemId===id),id);
  const fdu=build('flight_suit','male','senior','Capt',{badges:[{id:PILOT}],opt:{headgear:'auto',jacket:true}});
  const r2=SHOP.deriveList(await P.composeUniform(fdu,store),fdu,{badges:BADGES});
  assert.ok(r2.lines.some(l=>l.itemId==='flight_jacket_green'),'the flight jacket');
  assert.ok(r2.lines.some(l=>l.key==='fig2:item:nametag_flight_embroidered'&&/flight jacket/.test(l.detail)),'the jacket\'s own nametag');
  assert.ok(r2.lines.some(l=>l.itemId==='command_patch')&&r2.lines.some(l=>l.itemId==='us_flag_patch_flight'),'the command patch and the flag the suit draws');
});

test('the mess dress takes the button design the member chose, the boards in bullion grade, and its required accessories',async()=>{
  const b=build('mess_dress','male','senior','Col',{opt:{headgear:'auto',buttons:'cap-crest'},medals:medalsOf(['encampment_ribbon'])});
  const res=SHOP.deriveList(await P.composeUniform(b,store),b,{badges:BADGES});
  const ids=res.lines.map(l=>l.itemId);
  assert.ok(ids.includes('mess_buttons_cap_crest')&&!ids.includes('mess_buttons_wing_star'));
  for(const id of ['mess_coat_male','mess_shirt_male','mess_trousers_male','mess_cummerbund','mess_bow_tie','mess_suspenders','mess_cuff_links','mess_studs','mini_mount']) assert.ok(ids.includes(id),id);
  assert.match(res.lines.find(l=>l.key==='mess-boards').name,/, Col$/);
  assert.ok(!res.lines.some(l=>l.group==='Ribbons'&&/^Ribbon: /.test(l.name)),'miniature medals, not ribbons');
});

test('the totals are the sum of the lowest prices; estimated and unpriced lines are counted',()=>{
  const lines=[{key:'a',total:10,lowest:{status:'verified'}},{key:'b',total:2.5,lowest:{status:'estimated'}},{key:'c',total:null,lowest:null},{key:'d',total:null,lowest:null,notSold:true}];
  assert.deepEqual(SHOP.totals(lines,{a:true}),{subtotal:12.5,remaining:2.5,estimated:1,unpriced:1,verified:1,notSold:1,count:4});
});

test('the text and CSV exports carry every line, quoted where a cell needs it',async()=>{
  const b=build('blues_b','male','cadet','C/Capt',CASES[0][4]);
  const res=SHOP.deriveList(await P.composeUniform(b,store),b,{badges:BADGES});
  const text=SHOP.toText(res.lines,{title:'Blue Service (Class B)',who:'Cadet'});
  for(const l of res.lines) assert.ok(text.includes(l.name),l.name);
  assert.match(text,new RegExp(`Subtotal of the lowest prices: \\$${SHOP.totals(res.lines).subtotal.toFixed(2)}`));
  const csv=SHOP.toCSV(res.lines,{});
  const rows=csv.trim().split('\r\n');
  assert.equal(rows.length,res.lines.length+1);
  assert.match(rows[0],/^Section,Item,Detail,Quantity,Lowest unit price,Line total,Vendor,Price status,Price checked,SKU,Link,Other vendors,Own it,Sourcing,CAPR 39-1$/);
  assert.ok(rows.some(r=>/^Name,"CAP cadet nametag, blue, three-line","""DOE""",1,5\.10,5\.10,Vanguard,verified,2026-08-08,/.test(r)),'quoted cells');
});

test('the grade is read from the artwork id',()=>{
  assert.equal(SHOP.gradeFromAsset('rank-cadet-officer-captain-metal-miniature'),'C/Capt');
  assert.equal(SHOP.gradeFromAsset('rank-senior-senior-master-sergeant-chevron-4in'),'SMSgt');
  assert.equal(SHOP.gradeFromAsset('rank-senior-technical-flight-officer-thread'),'TFO');
  assert.equal(SHOP.gradeFromAsset('rank-epaulet-sleeve-gray-lieutenant-colonel'),'Lt Col');
  assert.equal(SHOP.gradeFromAsset('rank-cadet-nco-master-sergeant-first-sergeant-metal'),'C/MSgt (First Sergeant)');
});

test('a U.S. military badge is listed in its military form (a military-spec item may be bought), told by the engine\'s mark on the layer, not by a picture type',async()=>{
  // LIVE13 E118: the badge is a traced SVG asset like a CAP badge; js/engine/profiles-dress.js putBadge marks its layer `military`.
  const mil={id:'air_force_pilot_badge',variant:'command_pilot',href:'images/military-badges/air-force/air_force_pilot_badge/command_pilot.svg?v=t',title:'Command Pilot Badge',family:'AVIATION'};
  const b=build('blues_a','male','senior','Capt',{badges:[{id:PILOT}],militaryBadges:[mil]});
  const scene=await P.composeUniform(b,store);
  const layer=scene.layers.find(l=>l.key==='badge:air_force_pilot_badge');
  assert.ok(layer&&layer.type==='asset'&&layer.military===true,'the engine draws the asset and marks it military');
  assert.ok(!scene.layers.some(l=>l.type==='raster'),'nothing is a raster');
  const res=SHOP.deriveList(scene,b,{badges:BADGES});
  const line=res.lines.find(l=>l.key==='badge:air_force_pilot_badge');
  assert.ok(line,'the badge has its line');
  assert.equal(line.rule,'MILSPEC_OK'); assert.equal(line.detail,'Military'); assert.match(line.name,/Command Pilot Badge/);
  const cap=res.lines.find(l=>l.key==='badge:'+PILOT);
  assert.ok(cap&&cap.rule==='CAP_ONLY'&&cap.detail==='Regular size','the CAP pilot badge beside it stays CAP-only, regular size');
});
