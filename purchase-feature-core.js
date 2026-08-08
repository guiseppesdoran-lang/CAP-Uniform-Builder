/* CAP Uniform Builder — Purchase List & Cost feature
   Reads the current builder State and CAPUB_PURCHASE_CATALOG.
*/
(function(){
  'use strict';

  const C = window.CAPUB_PURCHASE_CATALOG;
  if(!C){
    console.warn('CAPUB Purchase feature: purchase catalog not loaded.');
    return;
  }

  const OWNED_KEY = 'CAPUB_PURCHASE_OWNED_V1';
  const INCLUDED_KEY = 'CAPUB_PURCHASE_INCLUDED_V1';
  const U4U = C.vendors.uniforms4u.home;

  const readStore = (key) => {
    try { return JSON.parse(localStorage.getItem(key) || '{}') || {}; }
    catch(_) { return {}; }
  };
  const writeStore = (key, obj) => {
    try { localStorage.setItem(key, JSON.stringify(obj)); } catch(_) {}
  };
  let ownedState = readStore(OWNED_KEY);
  let includedState = readStore(INCLUDED_KEY);
  let currentItems = [];

  const money = n => Number.isFinite(Number(n)) ? `$${Number(n).toFixed(2)}` : 'Check price';
  const esc = value => String(value ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  const titleCase = value => String(value || '')
    .replace(/[_-]+/g,' ')
    .replace(/\b\w/g, c => c.toUpperCase());
  const uniq = arr => [...new Set((arr || []).filter(Boolean))];
  const isCadetOfficer = () => State.membership === 'cadet' && /^C\/(2d Lt|1st Lt|Capt|Maj|Lt Col|Col)$/.test(State.rank || '');
  const isSeniorOfficer = () => State.membership === 'senior' && ['2d Lt','1st Lt','Capt','Maj','Lt Col','Col','Brig Gen','Maj Gen'].includes(State.rank);
  const isSeniorNco = () => State.membership === 'senior' && ['SSgt','TSgt','MSgt','SMSgt','CMSgt'].includes(State.rank);
  const usesMiniMedals = () => ['mess_dress','semi_formal'].includes(State.uniform) || !!State.forceMini;

  const uniformNames = {
    blues_a:'Class A Service Dress', blues_b:'Class B Service Blues', mess_dress:'Mess Dress',
    semi_formal:'Semi-Formal', aviator:'Corporate Aviator', aviator_blazer:'Corporate Aviator + Blazer',
    corporate_field:'Corporate Field', abu:'ABU', ocp:'OCP', flight_suit:'Flight Suit', polo:'Corporate Polo'
  };

  function cloneCatalogItem(id){
    const src = C.items[id];
    if(!src) return null;
    return {
      ...src,
      key:`catalog:${id}`,
      catalogId:id,
      links:(src.links || []).map(x=>({...x})),
      quantity:src.quantity || 1,
      defaultIncluded:src.conditional ? false : true
    };
  }

  function addCatalog(list, id, overrides={}){
    const item = cloneCatalogItem(id);
    if(!item) return;
    Object.assign(item, overrides);
    list.push(item);
  }

  function dynamicItem(key, data){
    const item={
      key, category:'Other', sourceRule:'VERIFY', price:null, priceStatus:'estimated', links:[],
      quantity:1, defaultIncluded:true, ...data
    };
    return guaranteePurchasableItem(item);
  }

  function addBaseRecipe(list){
    const gender = State.gender === 'female' ? 'female' : 'male';
    const recipe = C.recipes?.[State.uniform]?.[gender] || [];
    recipe.forEach(id => {
      let defaultIncluded = true;
      if((id === 'blue_tie_male' || id === 'blue_tie_tab_female') && State.uniform === 'blues_b') defaultIncluded = false;
      addCatalog(list,id,{defaultIncluded});
    });

    if(State.uniform === 'blues_a'){
      const style = isSeniorOfficer() ? 'officer' : 'enlisted';
      addCatalog(list, `service_coat_${style}_${gender}`);
    }

    if(['blues_a','blues_b'].includes(State.uniform)){
      const style = isSeniorOfficer() ? 'officer' : 'enlisted';
      addCatalog(list, `flight_cap_${style}_${gender}`);
    }
  }

  function addNameplate(list){
    if(!['blues_a','blues_b','aviator','aviator_blazer','semi_formal'].includes(State.uniform)) return;
    if(State.membership === 'cadet') addCatalog(list,'cap_nameplate_cadet');
    else if(State.membership === 'senior') addCatalog(list,'cap_nameplate_senior');
  }

  function productToItem(p, fallbackName='Item'){
    if(!p) return null;
    return {
      name:p.name || fallbackName,
      price:Number(p.price), priceStatus:p.priceStatus || 'estimated',
      links:p.url ? [{vendor:'vanguard',label:(p.priceStatus==='verified'?'Vanguard product':'Vanguard item link'),price:Number(p.price),url:p.url}] : [],
      note:p.note || ''
    };
  }

  function guaranteePurchasableItem(item){
    if(!Number.isFinite(Number(item.price))){
      item.price=Number(C.fallbackPrices?.[item.category] ?? C.fallbackPrices?.Other ?? 10);
      item.priceStatus='estimated';
      item.note=[item.note,'Price is a database budgeting estimate; verify before checkout.'].filter(Boolean).join(' ');
    }
    if(!Array.isArray(item.links) || !item.links.some(l=>l?.url)){
      item.links=[{vendor:'vanguard',label:'Vanguard exact-item search',url:C.helpers.vgSearch(item.name)}];
    }
    return item;
  }

  function awardProduct(id, mini, display){
    let p = mini ? C.miniMedalProducts?.[id] : C.ribbonProducts?.[id];
    if(p) return p;
    const isMilitary=['air_force_aerial_achievement_medal','Air_Force_Organizational_Excellence_Award','air_medal'].includes(id);
    if(mini){
      return {price:11.35,priceStatus:'estimated',url:C.helpers.vgSearch(`${display} miniature medal`),name:`${display} miniature medal`,note:isMilitary?'Military award — use the exact U.S. military miniature medal, not a CAP substitute.':'CAP miniature-medal budgeting price; verify that Vanguard produces a miniature medal for this award.'};
    }
    return {price:1.60,priceStatus:'estimated',url:C.helpers.vgSearch(`${isMilitary?'':'Civil Air Patrol '}${display} ribbon`),name:`${display} ribbon`,note:isMilitary?'Military award — use the exact U.S. military ribbon, not a CAP substitute.':'CAP ribbon budgeting price.'};
  }

  function getSpecialAwardOption(r,id){
    if(!r || typeof r!=='object') return null;
    let pools=[];
    try{ if(typeof RIBBON_SPECIAL_IMAGE_OPTIONS!=='undefined' && Array.isArray(RIBBON_SPECIAL_IMAGE_OPTIONS?.[id])) pools.push(...RIBBON_SPECIAL_IMAGE_OPTIONS[id]); }catch(_){}
    try{ if(Array.isArray(globalThis.MCCHORD_RIBBON_VARIANTS?.[id])) pools.push(...globalThis.MCCHORD_RIBBON_VARIANTS[id]); }catch(_){}
    const value=String(r.awardValue||'').replace(/_duplicate_\d+$/,'');
    const image=String(r.imageOverride||'');
    return pools.find(o=>value && o?.value===value) || pools.find(o=>image && o?.image===image) || null;
  }

  const COMMUNITY_DEVICE_MAP={
    'commun01.png':{},'commun02.png':{bronze_clasp:1},'commun03.png':{bronze_clasp:2},'commun04.png':{bronze_clasp:3},'commun05.png':{bronze_clasp:4},
    'commun06.png':{silver_clasp:1},'commun07.png':{silver_clasp:1,bronze_clasp:1},'commun08.png':{silver_clasp:1,bronze_clasp:2},'commun09.png':{silver_clasp:1,bronze_clasp:3},
    'commun11.png':{silver_clasp:2},'commun12.png':{silver_clasp:2,bronze_clasp:1},'commun13.png':{silver_clasp:2,bronze_clasp:2},'commun16.png':{silver_clasp:3},'commun17.png':{silver_clasp:3,bronze_clasp:1},'commun21.png':{silver_clasp:4}
  };

  function parseDeviceText(text){
    const s=String(text||'');
    const out={bronze_clasp:0,silver_clasp:0,bronze_star:0,silver_star:0,gold_star:0,bronze_propeller:0,silver_v:0,longevity:0};
    const grab=(re,key)=>{ const m=s.match(re); if(m) out[key]=Math.max(out[key],Number(m[1]||1)); };
    grab(/(\d+)\s+Bronze\s+Clasps?/i,'bronze_clasp');
    if(/(?:^|[^\d])Bronze\s+Clasp/i.test(s) && !out.bronze_clasp) out.bronze_clasp=1;
    grab(/(\d+)\s+Silver\s+Clasps?/i,'silver_clasp');
    if(/(?:^|[^\d])Silver\s+Clasp/i.test(s) && !out.silver_clasp) out.silver_clasp=1;
    grab(/(\d+)\s+Bronze\s+Stars?/i,'bronze_star');
    if(/Bronze\s+Star/i.test(s) && !out.bronze_star) out.bronze_star=1;
    grab(/(\d+)\s+Silver\s+Stars?/i,'silver_star');
    if(/Silver\s+Star/i.test(s) && !out.silver_star) out.silver_star=1;
    grab(/(\d+)\s+Gold\s+Stars?/i,'gold_star');
    if(/Gold\s+Star/i.test(s) && !out.gold_star) out.gold_star=1;
    if(/Bronze\s+Propeller/i.test(s)) out.bronze_propeller=1;
    if(/Silver\s+V/i.test(s)) out.silver_v=1;
    if(/Longevity\s+Device/i.test(s)) out.longevity=1;
    if(/Honor\s+Credit/i.test(s)) out.silver_star += 1;
    if(/Model\s+Rocketry/i.test(s) && !/Honor\s+Credit\s+and\s+Model\s+Rocketry/i.test(s)) out.silver_star += 1;
    if(/Honor\s+Credit\s+and\s+Model\s+Rocketry/i.test(s)) out.silver_star = Math.max(out.silver_star,2);
    if(/COS(?:\s+Graduate)?\s+Star/i.test(s)) out.silver_star = Math.max(out.silver_star,1);
    return out;
  }

  function inferAwardDevices(r,id){
    const empty={bronze_clasp:0,silver_clasp:0,bronze_star:0,silver_star:0,gold_star:0,bronze_propeller:0,silver_v:0,longevity:0};
    if(!r || typeof r!=='object') return empty;
    const image=String(r.imageOverride||'').split('/').pop();
    if(id==='community_service_ribbon' && COMMUNITY_DEVICE_MAP[image]) return {...empty,...COMMUNITY_DEVICE_MAP[image]};
    const opt=getSpecialAwardOption(r,id);
    const specialText=[r.awardLabel,opt?.label,r.awardValue].filter(Boolean).join(' | ');
    const parsed=parseDeviceText(specialText);
    if(Object.values(parsed).some(Number)) return parsed;
    const d=r.devices||{};
    parsed.bronze_star=Number(d['1_Bronze_Star_Device']||0);
    parsed.silver_star=Number(d['1_Silver_Star_Device']||0);
    return parsed;
  }

  function addDevicePurchase(list,id,index,type,count,mini){
    count=Math.max(0,Number(count)||0); if(!count) return;
    let p,label,qty=1,note='';
    if(type==='bronze_clasp'||type==='silver_clasp'){
      p=C.deviceProducts?.[type]?.[Math.min(4,count)] || C.deviceProducts?.[type]?.[1];
      label=`${count} 3/16-inch ${type==='bronze_clasp'?'bronze':'silver'} triangle clasp${count===1?'':'s'}`;
      if(count>4){ qty=Math.ceil(count/4); note=`Requires ${count} clasps; budgeting ${qty} four-clasp clusters.`; }
    } else if(['bronze_star','silver_star','gold_star'].includes(type)){
      p=C.deviceProducts?.[`${type}_ribbon`];
      qty=Math.ceil(count/2); label=`${count} 3/16-inch ${type.replace('_',' ')}${count===1?'':'s'}`;
      note=`Requires ${count} star${count===1?'':'s'}; Vanguard package contains two, so ${qty} package${qty===1?'':'s'} budgeted.`;
    } else {
      p=C.deviceProducts?.[type]; label=type==='bronze_propeller' ? `${count} 3/16-inch bronze propeller clasp${count===1?'':'s'}` : type.replace(/_/g,' '); qty=count;
    }
    p=p || {price:2.20,priceStatus:'estimated',url:C.helpers.vgSearch(`Civil Air Patrol ${label} device`),name:label};
    const militaryAwardIds=new Set(['air_force_aerial_achievement_medal','Air_Force_Organizational_Excellence_Award','air_medal']);
    const deviceRule=militaryAwardIds.has(id)?'MILSPEC_OK':'CAP_ONLY';
    list.push(dynamicItem(`award-device:${id}:${index}:${type}`,{
      name:`Award device: ${label}`,category:'Award devices',sourceRule:deviceRule,quantity:qty,
      price:p.price,priceStatus:p.priceStatus,links:[{vendor:'vanguard',label:p.priceStatus==='verified'?'Vanguard product':'Vanguard item link',price:p.price,url:p.url}],
      note:[p.note,note, militaryAwardIds.has(id)?'Device is being purchased for a U.S. military award; use the correct military-size/device configuration.':'Device is being purchased for a CAP award; use the CAP-authorized device configuration.'].filter(Boolean).join(' ')
    }));
  }

  function addRankItems(list){
    const gender=State.gender==='female'?'female':'male'; const rank=State.rank||''; if(!rank) return;
    if(State.membership==='cadet'){
      if(['blues_a','blues_b'].includes(State.uniform) && !isCadetOfficer()){
        list.push(dynamicItem('cap-device:cadet-enlisted-flight-cap',{name:'CAP cadet enlisted flight-cap device',category:'CAP insignia',sourceRule:'CAP_ONLY',price:8.60,priceStatus:'verified',links:[{vendor:'vanguard',label:'Vanguard product',price:8.60,url:C.helpers.vgSearch('Civil Air Patrol Cap Device Cadet Enlisted Flight')}],note:'CAP-specific cap device; not a USAF enlisted cap device.'}));
      }
      if(isCadetOfficer()){
        if(State.uniform==='blues_a') addCatalog(list,`cap_cadet_officer_boards_${gender}`);
        const p=C.cadetOfficerRank?.[rank];
        list.push(dynamicItem(`rank:cadet:${rank}`,{...productToItem(p,`CAP cadet officer grade insignia — ${rank}`),name:`CAP cadet officer grade insignia — ${rank}`,category:'CAP rank',sourceRule:'CAP_ONLY',note:[p?.note,'CAP cadet grade item. Do not substitute a military officer item solely because its shape looks similar.'].filter(Boolean).join(' ')}));
      } else if(rank!=='C/AB'){
        const p=C.cadetEnlistedRank?.[rank] || {price:10.40,priceStatus:'estimated',url:C.helpers.vgSearch(`Civil Air Patrol cadet ${rank} chevron grade insignia`)};
        list.push(dynamicItem(`rank:cadet:${rank}`,{...productToItem(p),name:`CAP cadet grade insignia — ${rank}`,category:'CAP rank',sourceRule:'CAP_ONLY',note:'Use the CAP cadet chevron product; do not substitute USAF enlisted rank.'}));
      }
      return;
    }
    if(State.membership==='senior'){
      if(isSeniorNco()){
        const p=C.seniorNcoRank?.[rank];
        list.push(dynamicItem(`rank:senior-nco:${rank}`,{...productToItem(p),name:`CAP senior-member NCO grade insignia — ${rank}`,category:'CAP rank',sourceRule:'CAP_ONLY',note:'Use the CAP senior-member NCO version.'}));
      } else if(isSeniorOfficer()){
        if(State.uniform==='blues_b'||State.uniform==='semi_formal'||State.uniform==='aviator'){
          const p=C.seniorEpaulet?.[rank];
          list.push(dynamicItem(`rank:senior-epaulet:${rank}:${gender}`,{...productToItem(p),name:`CAP senior-member gray shoulder marks / epaulets — ${rank}`,category:'CAP rank',sourceRule:'CAP_ONLY',note:'CAP gray shoulder marks are CAP-specific; do not substitute Air Force blue shoulder marks.'}));
        }
        if(State.uniform==='blues_a'){
          const p=C.seniorServiceCoatRank?.[rank];
          list.push(dynamicItem(`rank:senior-coat:${rank}`,{...productToItem(p),name:`Senior-member service-coat grade insignia — ${rank}`,category:'CAP rank',sourceRule:'VERIFY',note:'Price/link point to the CAP-specific search. Verify the exact authorized service-coat version before ordering.'}));
        }
        if(State.uniform==='mess_dress'){
          const p=C.seniorMessBoard?.[rank];
          list.push(dynamicItem(`rank:senior-mess:${rank}:${gender}`,{...productToItem(p),name:`CAP senior-member mess-dress shoulder boards — ${rank}, ${gender}`,category:'CAP rank',sourceRule:'CAP_ONLY',note:'CAP mess-dress shoulder boards are CAP-specific; do not substitute USAF mess-dress boards.'}));
        }
      }
    }
  }

  function addSelectedRibbons(list){
    const ribbons=Array.isArray(State.ribbons)?State.ribbons:[]; const mini=usesMiniMedals();
    ribbons.forEach((r,i)=>{
      const id=typeof r==='string'?r:r?.id; if(!id) return;
      let display; try{display=typeof getRibbonDisplayName==='function'?getRibbonDisplayName(id):titleCase(id);}catch(_){display=titleCase(id);}
      const p=awardProduct(id,mini,display); const military=['air_force_aerial_achievement_medal','Air_Force_Organizational_Excellence_Award','air_medal'].includes(id);
      list.push(dynamicItem(`award:${mini?'mini':'ribbon'}:${id}:${i}`,{
        name:`${mini?'Miniature medal':'Ribbon'}: ${display}`,category:mini?'Miniature medals':'Ribbons',sourceRule:military?'MILSPEC_OK':'CAP_ONLY',
        price:p.price,priceStatus:p.priceStatus,links:[{vendor:'vanguard',label:p.priceStatus==='verified'?'Vanguard product':'Vanguard item link',price:p.price,url:p.url}],note:p.note||(military?'Use the exact U.S. military award item.':'Use the CAP-specific award item.')
      }));
      const devices=inferAwardDevices(r,id);
      Object.entries(devices).forEach(([type,count])=>addDevicePurchase(list,id,i,type,count,mini));
    });
  }

  function addSelectedBadges(list){
    uniq(State.badges||[]).forEach(id=>{
      const p=C.badgeProducts?.[id] || C.badgeFallback?.(id) || {price:11.00,priceStatus:'estimated',url:C.helpers.vgSearch(`Civil Air Patrol ${titleCase(id)} badge`)};
      list.push(dynamicItem(`badge:${id}`,{...productToItem(p),name:`CAP badge: ${titleCase(id.replace(/_badge$/,''))}`,category:'Badges',sourceRule:'CAP_ONLY',note:[p.note,'Purchase the exact CAP-authorized badge/rating shown by the builder.'].filter(Boolean).join(' ')}));
    });
  }

  function addSelectedPatches(list){
    const ids=uniq(State.patches||[]);
    try{ const unitId=typeof getSelectedUnitPatchId==='function'?getSelectedUnitPatchId():null; if(unitId && !ids.includes(unitId)) ids.push(unitId); }catch(_){}
    ids.forEach(id=>{
      const p=C.patchProducts?.[id] || C.patchFallback?.(id) || {price:4.65,priceStatus:'estimated',url:C.helpers.vgSearch(`Civil Air Patrol ${titleCase(id)} patch`)};
      list.push(dynamicItem(`patch:${id}`,{...productToItem(p),name:`CAP patch: ${titleCase(id.replace(/_patch$/,''))}`,category:'Patches',sourceRule:'CAP_ONLY',note:[p.note,'Use the exact CAP-authorized patch; military/look-alike patches are not interchangeable.'].filter(Boolean).join(' ')}));
    });
  }

  function addShoulderCord(list){
    if(!State.shoulderCord) return;
    const key=String(State.shoulderCord).replace(/^cac:/,''); const p=C.cordProducts?.[key] || {price:35.00,priceStatus:'estimated',url:C.helpers.vgSearch(`Civil Air Patrol ${titleCase(key)} shoulder cord`)};
    list.push(dynamicItem(`cord:${State.shoulderCord}`,{...productToItem(p),name:`CAP shoulder cord: ${titleCase(key)}`,category:'Accessories',sourceRule:'CAP_ONLY'}));
  }

  function addFieldUniformInsignia(list){
    if(!['abu','ocp','corporate_field','flight_suit'].includes(State.uniform)) return;
    const membership=State.membership==='cadet'?'cadet':'senior member';
    if(State.rank){
      let price=5.70;
      if(State.membership==='cadet' && C.cadetEnlistedRank?.[State.rank]) price=C.cadetEnlistedRank[State.rank].price;
      if(State.membership==='senior' && C.seniorNcoRank?.[State.rank]) price=C.seniorNcoRank[State.rank].price;
      list.push(dynamicItem(`field-rank:${State.uniform}:${State.rank}`,{name:`CAP ${membership} ${State.uniform.toUpperCase()} grade/rank insignia — ${State.rank}`,category:'CAP rank',sourceRule:'CAP_ONLY',price,priceStatus:'estimated',links:[{vendor:'vanguard',label:'Vanguard exact-item search',price,url:C.helpers.vgSearch(`Civil Air Patrol ${State.uniform} ${State.rank} rank insignia`)}],note:'Field-uniform insignia is priced separately because its format differs from service-uniform insignia.'}));
    }
    if(State.uniform==='ocp'){
      for(const [suffix,p] of [['name',C.fieldInsignia.ocp_name],['cap',C.fieldInsignia.ocp_cap]]) list.push(dynamicItem(`field-${suffix}:ocp`,{...productToItem(p),name:p.name,category:'CAP insignia',sourceRule:'CAP_ONLY'}));
    }
    if(State.uniform==='abu'){
      for(const [suffix,p] of [['name',C.fieldInsignia.abu_name],['cap',C.fieldInsignia.abu_cap]]) list.push(dynamicItem(`field-${suffix}:abu`,{...productToItem(p),name:p.name,category:'CAP insignia',sourceRule:'CAP_ONLY'}));
    }
  }

  function buildPurchaseItems(){
    const list=[]; addBaseRecipe(list); addNameplate(list); addRankItems(list); addFieldUniformInsignia(list); addSelectedRibbons(list); addSelectedBadges(list); addSelectedPatches(list); addShoulderCord(list);
    const seen=new Set();
    return list.filter(item=>{
      guaranteePurchasableItem(item);
      if(item.key.startsWith('award:')||item.key.startsWith('award-device:')) return true;
      if(seen.has(item.key)) return false; seen.add(item.key); return true;
    });
  }

  function itemIncluded(item){
    if(Object.prototype.hasOwnProperty.call(includedState,item.key)) return !!includedState[item.key];
    return item.defaultIncluded !== false;
  }
  function itemOwned(item){ return !!ownedState[item.key]; }

  function sourceRuleLabel(rule){
    return ({CAP_ONLY:'CAP-only',MILSPEC_OK:'Milspec OK',GENERIC_SPEC:'Spec match',VERIFY:'Verify item'})[rule] || 'Verify';
  }
  function statusLabel(status){
    return ({verified:'Verified price',estimated:'Estimated price'})[status] || 'Estimated price';
  }

  function injectStyles(){
    if(document.getElementById('capubPurchaseStyles')) return;
    const style=document.createElement('style');
    style.id='capubPurchaseStyles';
    style.textContent=`
      #purchaseListButton{width:100%;font-weight:700}
      .capub-purchase-overlay{position:fixed;inset:0;background:rgba(0,0,0,.62);z-index:100000;display:none;align-items:center;justify-content:center;padding:24px}
      .capub-purchase-overlay.open{display:flex}
      .capub-purchase-modal{width:min(1120px,96vw);max-height:92vh;overflow:hidden;background:#fff;color:#172033;border-radius:14px;box-shadow:0 24px 80px rgba(0,0,0,.35);display:flex;flex-direction:column}
      .capub-purchase-head{display:flex;gap:16px;justify-content:space-between;align-items:flex-start;padding:18px 20px;border-bottom:1px solid #d9dee8;background:#f7f9fc}
      .capub-purchase-head h2{font-size:20px;margin:0 0 4px}.capub-purchase-sub{font-size:12px;color:#5b6578}
      .capub-purchase-close{border:0;background:#e8ecf3;border-radius:8px;padding:7px 11px;cursor:pointer;font-size:18px;line-height:1}
      .capub-purchase-body{padding:16px 20px 20px;overflow:auto}
      .capub-purchase-rule{border:1px solid #d8b671;background:#fff9e9;border-radius:10px;padding:10px 12px;margin-bottom:12px;font-size:12px;line-height:1.45}
      .capub-purchase-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:10px 0 14px}
      .capub-purchase-card{border:1px solid #dce1ea;border-radius:9px;padding:10px;background:#fafbfd}.capub-purchase-card b{display:block;font-size:16px;margin-top:2px}.capub-purchase-card span{font-size:10px;color:#657086;text-transform:uppercase;letter-spacing:.04em}
      .capub-purchase-table{width:100%;border-collapse:collapse;font-size:12px}.capub-purchase-table th{position:sticky;top:0;background:#eef2f7;text-align:left;padding:8px;border-bottom:1px solid #ccd3df;z-index:1}.capub-purchase-table td{padding:9px 8px;border-bottom:1px solid #e2e6ed;vertical-align:top}
      .capub-purchase-item-name{font-weight:700;margin-bottom:3px}.capub-purchase-note{font-size:10px;line-height:1.35;color:#667085;max-width:440px;margin-top:4px}
      .capub-purchase-chip{display:inline-block;font-size:9px;font-weight:700;padding:2px 6px;border-radius:999px;background:#e9edf3;margin:2px 4px 0 0}.capub-purchase-chip.cap{background:#fee9e7}.capub-purchase-chip.ok{background:#e7f3ed}.capub-purchase-chip.est{background:#fff2d7}
      .capub-purchase-links{display:flex;flex-wrap:wrap;gap:5px}.capub-purchase-links a{display:inline-block;padding:4px 7px;border:1px solid #c7d0de;border-radius:6px;text-decoration:none;color:#184f9c;background:#fff;font-size:10px}.capub-purchase-links a:hover{background:#eef5ff}
      .capub-purchase-price{font-weight:700;white-space:nowrap}.capub-purchase-price small{display:block;font-size:9px;font-weight:500;color:#6a7486;margin-top:2px}
      .capub-purchase-actions{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:14px}.capub-purchase-actions button{padding:8px 12px;border-radius:7px;border:1px solid #bcc5d3;background:#fff;cursor:pointer}.capub-purchase-actions .primary{background:#173f73;color:#fff;border-color:#173f73}
      .capub-purchase-empty{padding:25px;text-align:center;color:#667085}
      @media(max-width:760px){.capub-purchase-summary{grid-template-columns:1fr 1fr}.capub-purchase-modal{width:98vw}.capub-purchase-table{font-size:11px}.capub-purchase-table th:nth-child(3),.capub-purchase-table td:nth-child(3){display:none}}
    `;
    document.head.appendChild(style);
  }

  function ensureButton(){
    if(document.getElementById('purchaseListButton')) return;
    const download=document.getElementById('downloadImage');
    if(!download) return;
    const btn=document.createElement('button');
    btn.id='purchaseListButton'; btn.type='button'; btn.textContent='Purchase List & Cost';
    btn.title='Build a vendor-linked shopping list and estimated uniform cost from the current configuration.';
    download.parentElement?.appendChild(btn);
    btn.addEventListener('click',openModal);
  }

  function ensureModal(){
    if(document.getElementById('capubPurchaseOverlay')) return;
    const overlay=document.createElement('div');
    overlay.id='capubPurchaseOverlay'; overlay.className='capub-purchase-overlay';
    overlay.innerHTML=`<div class="capub-purchase-modal" role="dialog" aria-modal="true" aria-labelledby="capubPurchaseTitle">
      <div class="capub-purchase-head"><div><h2 id="capubPurchaseTitle">Purchase List & Cost</h2><div class="capub-purchase-sub" id="capubPurchaseSubtitle"></div></div><button class="capub-purchase-close" id="capubPurchaseClose" aria-label="Close">×</button></div>
      <div class="capub-purchase-body" id="capubPurchaseBody"></div>
    </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click',e=>{ if(e.target===overlay) closeModal(); });
    overlay.querySelector('#capubPurchaseClose').addEventListener('click',closeModal);
    document.addEventListener('keydown',e=>{ if(e.key==='Escape' && overlay.classList.contains('open')) closeModal(); });
  }

  function calcTotals(){
    let complete=0,remaining=0,verified=0,estimated=0,selected=0;
    currentItems.forEach(item=>{ if(!itemIncluded(item)) return; selected++; const p=Number(item.price); if(item.priceStatus==='verified') verified++; else estimated++; complete+=p*(item.quantity||1); if(!itemOwned(item)) remaining+=p*(item.quantity||1); });
    return {complete,remaining,verified,estimated,selected};
  }

  function renderTotals(){
    const t=calcTotals(); const complete=document.getElementById('capubTotalComplete'); const remaining=document.getElementById('capubTotalRemaining'); const missing=document.getElementById('capubTotalMissing'); const selected=document.getElementById('capubTotalSelected');
    if(complete) complete.textContent=money(t.complete); if(remaining) remaining.textContent=money(t.remaining); if(missing) missing.textContent=String(t.estimated); if(selected) selected.textContent=String(t.selected);
  }

  function renderBody(){
    currentItems=buildPurchaseItems();
    const body=document.getElementById('capubPurchaseBody');
    const subtitle=document.getElementById('capubPurchaseSubtitle');
    if(!body) return;
    if(subtitle) subtitle.textContent=`${uniformNames[State.uniform] || titleCase(State.uniform)} · ${titleCase(State.membership)} · ${titleCase(State.gender)}${State.rank ? ` · ${State.rank}` : ''} · prices checked ${C.priceChecked}`;

    const rows=currentItems.map(item=>{
      const included=itemIncluded(item); const owned=itemOwned(item);
      const ruleClass=item.sourceRule==='CAP_ONLY'?'cap':(item.sourceRule==='MILSPEC_OK'?'ok':'');
      const priceClass=item.priceStatus==='estimated'?'est':'';
      const links=(item.links||[]).map(l=>`<a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.label || C.vendors[l.vendor]?.name || 'Vendor')}${Number.isFinite(Number(l.price))?` · ${money(l.price)}`:''}</a>`).join('');
      return `<tr data-key="${esc(item.key)}">
        <td><input type="checkbox" class="capub-include" ${included?'checked':''} aria-label="Include ${esc(item.name)}"></td>
        <td><input type="checkbox" class="capub-owned" ${owned?'checked':''} aria-label="Already own ${esc(item.name)}"></td>
        <td><div class="capub-purchase-item-name">${esc(item.name)}</div><span class="capub-purchase-chip ${ruleClass}">${esc(sourceRuleLabel(item.sourceRule))}</span><span class="capub-purchase-chip ${priceClass}">${esc(statusLabel(item.priceStatus))}</span>${item.note?`<div class="capub-purchase-note">${esc(item.note)}</div>`:''}</td>
        <td class="capub-purchase-qty">${Number(item.quantity)||1}</td>
        <td>${links?`<div class="capub-purchase-links">${links}</div>`:'—'}</td>
        <td class="capub-purchase-price">${money((Number(item.price)||0)*(Number(item.quantity)||1))}<small>${Number(item.quantity)>1?`${money(item.price)} each/package · `:''}${item.priceStatus==='verified'?'last observed':item.priceStatus==='estimated'?'budget estimate':'not priced'}</small></td>
      </tr>`;
    }).join('');

    body.innerHTML=`
      <div class="capub-purchase-rule"><b>Sourcing rule:</b> CAP-specific rank/grade insignia, ribbons, miniature medals, badges, patches, nameplates and other CAP-only items are intentionally separated from ordinary military components. A visually similar USAF or other military item is not treated as a substitute. Standard garments/components are shown as military-spec alternatives only where the catalog marks them <b>Milspec OK</b>. Always verify the current CAPR 39-1 requirement before ordering.</div>
      <div class="capub-purchase-summary">
        <div class="capub-purchase-card"><span>Complete selected cost</span><b id="capubTotalComplete">$0.00</b></div>
        <div class="capub-purchase-card"><span>Still need to buy</span><b id="capubTotalRemaining">$0.00</b></div>
        <div class="capub-purchase-card"><span>Selected items</span><b id="capubTotalSelected">0</b></div>
        <div class="capub-purchase-card"><span>Estimated-price items</span><b id="capubTotalMissing">0</b></div>
      </div>
      ${rows ? `<table class="capub-purchase-table"><thead><tr><th>Use</th><th>Own</th><th>Item</th><th>Qty</th><th>Vendor links</th><th>Budget price</th></tr></thead><tbody>${rows}</tbody></table>` : '<div class="capub-purchase-empty">Choose a membership, gender, uniform, and rank to build a purchase list.</div>'}
      <div class="capub-purchase-note" style="margin-top:10px;max-width:none">Every generated item now has a numeric price and at least one vendor/item link. Verified prices were observed on vendor pages; estimated prices are clearly marked and should be rechecked before checkout. Shipping, tax, alterations and vendor changes are not included.</div>
      <div class="capub-purchase-actions"><button id="capubPurchaseReset">Reset owned/include choices</button><button id="capubPurchaseCopy">Copy shopping list</button><button class="primary" id="capubPurchaseDone">Done</button></div>`;

    body.querySelectorAll('tr[data-key]').forEach(tr=>{
      const key=tr.dataset.key;
      const include=tr.querySelector('.capub-include');
      const own=tr.querySelector('.capub-owned');
      include?.addEventListener('change',()=>{
        includedState[key]=include.checked; writeStore(INCLUDED_KEY,includedState); renderTotals();
      });
      own?.addEventListener('change',()=>{
        ownedState[key]=own.checked; writeStore(OWNED_KEY,ownedState); renderTotals();
      });
    });
    body.querySelector('#capubPurchaseDone')?.addEventListener('click',closeModal);
    body.querySelector('#capubPurchaseReset')?.addEventListener('click',()=>{
      if(!confirm('Reset all saved “already own” and include/exclude choices for the purchase list?')) return;
      ownedState={}; includedState={}; writeStore(OWNED_KEY,ownedState); writeStore(INCLUDED_KEY,includedState); renderBody();
    });
    body.querySelector('#capubPurchaseCopy')?.addEventListener('click',copyList);
    renderTotals();
  }

  function copyList(){
    const t=calcTotals();
    const lines=[
      `CAP Uniform Builder Purchase List`,
      `${uniformNames[State.uniform] || titleCase(State.uniform)} | ${titleCase(State.membership)} | ${titleCase(State.gender)} | ${State.rank || 'No rank selected'}`,
      `Prices checked: ${C.priceChecked}`,
      '',
      'CAP-specific insignia must use the CAP-authorized version; military look-alikes are not assumed interchangeable.',
      ''
    ];
    currentItems.forEach(item=>{
      if(!itemIncluded(item)) return;
      const q=Number(item.quantity)||1;
      lines.push(`${itemOwned(item)?'[OWN]':'[BUY]'} ${item.name}${q>1?` × ${q}`:''} — ${money((Number(item.price)||0)*q)}${q>1?` (${money(item.price)} each/package)`:''}${item.priceStatus==='estimated'?' (estimate)':''}`);
      (item.links||[]).forEach(l=>lines.push(`  ${l.label || C.vendors[l.vendor]?.name || 'Vendor'}: ${l.url}`));
    });
    lines.push('',`Complete selected known/estimated cost: ${money(t.complete)}`,`Remaining known/estimated cost: ${money(t.remaining)}`,`Estimated-price items: ${t.estimated}`,'Shipping/tax/alterations not included.');
    const text=lines.join('\n');
    const btn=document.getElementById('capubPurchaseCopy');
    const done=()=>{ if(btn){const old=btn.textContent;btn.textContent='Copied';setTimeout(()=>btn.textContent=old,1200);} };
    if(navigator.clipboard?.writeText){ navigator.clipboard.writeText(text).then(done).catch(()=>fallbackCopy(text,done)); }
    else fallbackCopy(text,done);
  }

  function fallbackCopy(text,done){
    const ta=document.createElement('textarea'); ta.value=text; ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta); ta.select();
    try{ document.execCommand('copy'); done(); }catch(_){} finally{ ta.remove(); }
  }

  function openModal(){
    ensureModal(); renderBody(); document.getElementById('capubPurchaseOverlay')?.classList.add('open');
  }
  function closeModal(){ document.getElementById('capubPurchaseOverlay')?.classList.remove('open'); }

  function init(){ injectStyles(); ensureButton(); ensureModal(); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true}); else init();

  window.CAPUB_PURCHASE_FEATURE={open:openModal,buildItems:buildPurchaseItems,catalog:C};
  console.info(`CAPUB Purchase List & Cost loaded (catalog ${C.version}).`);
})();