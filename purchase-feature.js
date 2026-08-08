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
  const isBlues = () => ['blues_a','blues_b','semi_formal'].includes(State.uniform);
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
    return {
      key,
      category:'Other',
      sourceRule:'VERIFY',
      price:null,
      priceStatus:'check',
      links:[],
      quantity:1,
      defaultIncluded:true,
      ...data
    };
  }

  function addBaseRecipe(list){
    const gender = State.gender === 'female' ? 'female' : 'male';
    const recipe = C.recipes?.[State.uniform]?.[gender] || [];
    recipe.forEach(id => {
      let defaultIncluded = true;
      if((id === 'blue_tie_male' || id === 'blue_tie_tab_female') && State.uniform === 'blues_b') defaultIncluded = false;
      addCatalog(list,id,{defaultIncluded});
    });

    // Class A adds a service coat. CAP cadets and senior NCOs use an enlisted-style
    // budgeting coat; senior officers use the officer coat. Insignia is handled separately.
    if(State.uniform === 'blues_a'){
      const style = isSeniorOfficer() ? 'officer' : 'enlisted';
      addCatalog(list, `service_coat_${style}_${gender}`);
    }

    // Service-blue headgear is useful in a complete build cost, even though the preview
    // itself focuses on the torso.
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

  function addRankItems(list){
    const gender = State.gender === 'female' ? 'female' : 'male';
    const rank = State.rank || '';
    if(!rank) return;

    if(State.membership === 'cadet'){
      if(['blues_a','blues_b'].includes(State.uniform) && !isCadetOfficer()){
        list.push(dynamicItem('cap-device:cadet-enlisted-flight-cap',{
          name:'CAP cadet enlisted flight-cap device', category:'CAP insignia', sourceRule:'CAP_ONLY',
          price:8.60, priceStatus:'verified',
          links:[{vendor:'vanguard',label:'Vanguard CAP cadet insignia',url:C.helpers.vgSearch('Civil Air Patrol Cap Device Cadet Enlisted Flight')}],
          note:'CAP-specific cap device; not a USAF enlisted cap device.'
        }));
      }
      if(isCadetOfficer()){
        if(State.uniform === 'blues_a'){
          addCatalog(list, `cap_cadet_officer_boards_${gender}`);
        }
        const r = C.cadetOfficerRank?.[rank];
        list.push(dynamicItem(`rank:cadet:${rank}`,{
          name:`CAP cadet officer grade insignia — ${rank}`,
          category:'CAP rank', sourceRule:'CAP_ONLY',
          price:r?.price ?? null,
          priceStatus:r?.price ? 'verified' : 'check',
          links:[{
            vendor:'vanguard', label:'Vanguard CAP cadet insignia',
            url:r?.url || C.helpers.vgSearch(`Civil Air Patrol cadet ${rank} grade insignia`)
          }],
          note:'CAP cadet grade item. Do not substitute a military officer item solely because the insignia shape looks similar.'
        }));
      } else {
        list.push(dynamicItem(`rank:cadet:${rank}`,{
          name:`CAP cadet grade insignia — ${rank}`,
          category:'CAP rank', sourceRule:'CAP_ONLY',
          links:[{vendor:'vanguard',label:'Vanguard CAP cadet insignia',url:C.helpers.vgSearch(`Civil Air Patrol cadet ${rank} chevron grade insignia`)}],
          note:'Use the CAP cadet grade product appropriate to this uniform; do not substitute USAF enlisted rank.'
        }));
      }
      return;
    }

    if(State.membership === 'senior'){
      if(isSeniorNco()){
        list.push(dynamicItem(`rank:senior-nco:${rank}`,{
          name:`CAP senior-member NCO grade insignia — ${rank}`,
          category:'CAP rank', sourceRule:'CAP_ONLY',
          links:[{vendor:'vanguard',label:'Vanguard CAP senior insignia',url:C.helpers.vgSearch(`Civil Air Patrol senior NCO ${rank} grade insignia`)}],
          note:'Select the CAP-authorized senior-member NCO version, not a USAF enlisted-rank substitute unless CAP specifically calls for the same item.'
        }));
      } else if(isSeniorOfficer()){
        if(State.uniform === 'blues_b' || State.uniform === 'semi_formal'){
          list.push(dynamicItem(`rank:senior-epaulet:${rank}:${gender}`,{
            name:`CAP senior-member shoulder marks / epaulets — ${rank}`,
            category:'CAP rank', sourceRule:'CAP_ONLY',
            links:[{vendor:'vanguard',label:'Vanguard CAP senior insignia',url:C.helpers.vgSearch(`Civil Air Patrol ${rank} gray epaulet shoulder mark ${gender}`)}],
            note:'CAP senior-member shoulder marks are CAP-specific. Do not replace them with standard Air Force blue shoulder marks.'
          }));
        }
        if(State.uniform === 'blues_a'){
          list.push(dynamicItem(`rank:senior-coat:${rank}`,{
            name:`Authorized senior-member service-coat grade insignia — ${rank}`,
            category:'CAP rank', sourceRule:'VERIFY',
            links:[{vendor:'vanguard',label:'Vanguard CAP senior insignia',url:C.helpers.vgSearch(`Civil Air Patrol ${rank} service coat grade insignia`)}],
            note:'Verify the exact CAP-authorized coat grade insignia for the selected grade. Do not infer interchangeability from a military product photo.'
          }));
        }
        if(State.uniform === 'mess_dress'){
          list.push(dynamicItem(`rank:senior-mess:${rank}:${gender}`,{
            name:`CAP senior-member mess-dress shoulder boards — ${rank}, ${gender}`,
            category:'CAP rank', sourceRule:'CAP_ONLY',
            links:[{vendor:'vanguard',label:'Vanguard CAP shoulder boards',url:C.helpers.vgSearch(`Civil Air Patrol ${rank} mess dress shoulder board ${gender}`)}]
          }));
        }
      }
    }
  }

  function addSelectedRibbons(list){
    const ribbons = Array.isArray(State.ribbons) ? State.ribbons : [];
    const mini = usesMiniMedals();
    const meta = mini ? C.dynamic.capMiniMedal : C.dynamic.capRibbon;
    ribbons.forEach((r, i) => {
      const id = typeof r === 'string' ? r : r?.id;
      if(!id) return;
      let display;
      try { display = typeof getRibbonDisplayName === 'function' ? getRibbonDisplayName(id) : titleCase(id); }
      catch(_) { display = titleCase(id); }
      const kind = mini ? 'Miniature medal' : 'Ribbon';
      list.push(dynamicItem(`award:${mini?'mini':'ribbon'}:${id}:${i}`,{
        name:`${kind}: ${display}`,
        category:mini ? 'Miniature medals' : 'Ribbons',
        sourceRule:'CAP_ONLY',
        price:meta.price,
        priceStatus:meta.priceStatus,
        links:[{
          vendor:'vanguard', label:'Vanguard',
          url:C.helpers.vgSearch(`Civil Air Patrol ${display} ${mini ? 'miniature medal' : 'ribbon'}`)
        }],
        note:meta.note || 'CAP award item; use the CAP version.'
      }));

      // Award attachments/devices are separate purchase items. Keep them unpriced
      // unless the catalog has an exact current product price; the builder still
      // generates a direct Vanguard search link and the quantity needed.
      if(r && typeof r === 'object' && r.devices){
        Object.entries(r.devices).forEach(([devId,count])=>{
          const qty=Math.max(0,Number(count)||0);
          if(!qty) return;
          let label=titleCase(devId);
          try { if(typeof deviceMeta !== 'undefined' && deviceMeta?.[devId]?.label) label=deviceMeta[devId].label; } catch(_) {}
          list.push(dynamicItem(`award-device:${id}:${i}:${devId}`,{
            name:`Award device: ${label}`,
            category:'Award devices', sourceRule:'CAP_ONLY', quantity:qty,
            links:[{vendor:'vanguard',label:'Vanguard device search',url:C.helpers.vgSearch(`Civil Air Patrol ${label} ribbon medal device`)}],
            note:`Quantity generated from this award: ${qty}. Verify the correct device size for ribbons versus miniature medals.`
          }));
        });
      }
    });
  }

  function addSelectedBadges(list){
    uniq(State.badges || []).forEach(id => {
      list.push(dynamicItem(`badge:${id}`,{
        name:`CAP badge: ${titleCase(id.replace(/_badge$/,''))}`,
        category:'Badges', sourceRule:'CAP_ONLY',
        links:[{vendor:'vanguard',label:'Vanguard CAP badge search',url:C.helpers.vgSearch(`Civil Air Patrol ${titleCase(id)} badge`)}],
        note:'Purchase the exact CAP-authorized badge/rating shown by the builder.'
      }));
    });
  }

  function addSelectedPatches(list){
    uniq(State.patches || []).forEach(id => {
      list.push(dynamicItem(`patch:${id}`,{
        name:`CAP patch: ${titleCase(id.replace(/_patch$/,''))}`,
        category:'Patches', sourceRule:'CAP_ONLY',
        links:[{vendor:'vanguard',label:'Vanguard CAP patch search',url:C.helpers.vgSearch(`Civil Air Patrol ${titleCase(id)} patch`)}],
        note:'Use the exact CAP-authorized patch; military or look-alike patches are not interchangeable.'
      }));
    });
  }

  function addShoulderCord(list){
    if(!State.shoulderCord) return;
    list.push(dynamicItem(`cord:${State.shoulderCord}`,{
      name:`CAP shoulder cord: ${titleCase(State.shoulderCord)}`,
      category:'Accessories', sourceRule:'CAP_ONLY',
      links:[{vendor:'vanguard',label:'Vanguard CAP cord search',url:C.helpers.vgSearch(`Civil Air Patrol ${titleCase(State.shoulderCord)} shoulder cord`)}]
    }));
  }

  function addFieldUniformInsignia(list){
    if(!['abu','ocp','corporate_field','flight_suit'].includes(State.uniform)) return;
    const membership = State.membership === 'cadet' ? 'cadet' : 'senior member';
    if(State.rank){
      list.push(dynamicItem(`field-rank:${State.uniform}:${State.rank}`,{
        name:`CAP ${membership} ${State.uniform.toUpperCase()} grade/rank insignia — ${State.rank}`,
        category:'CAP rank', sourceRule:'CAP_ONLY',
        links:[{vendor:'vanguard',label:'Vanguard CAP insignia search',url:C.helpers.vgSearch(`Civil Air Patrol ${State.uniform} ${State.rank} rank insignia`)}]
      }));
    }
    if(['abu','ocp'].includes(State.uniform)){
      list.push(dynamicItem(`field-name:${State.uniform}`,{
        name:`CAP-authorized ${State.uniform.toUpperCase()} name tape / branch tape set`,
        category:'CAP insignia', sourceRule:'CAP_ONLY',
        links:[{vendor:'vanguard',label:'Vanguard CAP name tape search',url:C.helpers.vgSearch(`Civil Air Patrol ${State.uniform} name tape`)}]
      }));
    }
  }

  function buildPurchaseItems(){
    const list=[];
    addBaseRecipe(list);
    addNameplate(list);
    addRankItems(list);
    addFieldUniformInsignia(list);
    addSelectedRibbons(list);
    addSelectedBadges(list);
    addSelectedPatches(list);
    addShoulderCord(list);

    // Keep first occurrence of a static/catalog key while retaining individual ribbons.
    const seen = new Set();
    return list.filter(item => {
      if(item.key.startsWith('award:')) return true;
      if(seen.has(item.key)) return false;
      seen.add(item.key); return true;
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
    return ({verified:'Verified price',estimated:'Estimate',check:'Check price'})[status] || 'Check price';
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
    let complete=0, remaining=0, known=0, unknown=0, selected=0;
    currentItems.forEach(item=>{
      if(!itemIncluded(item)) return;
      selected++;
      const p=Number(item.price);
      if(Number.isFinite(p)){
        known++; complete += p * (item.quantity || 1);
        if(!itemOwned(item)) remaining += p * (item.quantity || 1);
      } else unknown++;
    });
    return {complete,remaining,known,unknown,selected};
  }

  function renderTotals(){
    const t=calcTotals();
    const complete=document.getElementById('capubTotalComplete');
    const remaining=document.getElementById('capubTotalRemaining');
    const missing=document.getElementById('capubTotalMissing');
    const selected=document.getElementById('capubTotalSelected');
    if(complete) complete.textContent=money(t.complete);
    if(remaining) remaining.textContent=money(t.remaining);
    if(missing) missing.textContent=String(t.unknown);
    if(selected) selected.textContent=String(t.selected);
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
        <td>${links?`<div class="capub-purchase-links">${links}</div>`:'—'}</td>
        <td class="capub-purchase-price">${money(item.price)}<small>${item.priceStatus==='verified'?'last observed':item.priceStatus==='estimated'?'budget estimate':'not priced'}</small></td>
      </tr>`;
    }).join('');

    body.innerHTML=`
      <div class="capub-purchase-rule"><b>Sourcing rule:</b> CAP-specific rank/grade insignia, ribbons, miniature medals, badges, patches, nameplates and other CAP-only items are intentionally separated from ordinary military components. A visually similar USAF or other military item is not treated as a substitute. Standard garments/components are shown as military-spec alternatives only where the catalog marks them <b>Milspec OK</b>. Always verify the current CAPR 39-1 requirement before ordering.</div>
      <div class="capub-purchase-summary">
        <div class="capub-purchase-card"><span>Complete selected cost</span><b id="capubTotalComplete">$0.00</b></div>
        <div class="capub-purchase-card"><span>Still need to buy</span><b id="capubTotalRemaining">$0.00</b></div>
        <div class="capub-purchase-card"><span>Selected items</span><b id="capubTotalSelected">0</b></div>
        <div class="capub-purchase-card"><span>Items needing live price</span><b id="capubTotalMissing">0</b></div>
      </div>
      ${rows ? `<table class="capub-purchase-table"><thead><tr><th>Use</th><th>Own</th><th>Item</th><th>Vendor links</th><th>Budget price</th></tr></thead><tbody>${rows}</tbody></table>` : '<div class="capub-purchase-empty">Choose a membership, gender, uniform, and rank to build a purchase list.</div>'}
      <div class="capub-purchase-note" style="margin-top:10px;max-width:none">Prices are budgeting figures, not checkout quotes. Shipping, tax, sizing alterations, optional items, out-of-stock substitutions, and vendor price changes are not included. “Check price” items are intentionally left unpriced rather than guessed.</div>
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
      lines.push(`${itemOwned(item)?'[OWN]':'[BUY]'} ${item.name} — ${money(item.price)}${item.priceStatus==='estimated'?' (estimate)':item.priceStatus==='check'?' (check current price)':''}`);
      (item.links||[]).forEach(l=>lines.push(`  ${l.label || C.vendors[l.vendor]?.name || 'Vendor'}: ${l.url}`));
    });
    lines.push('',`Complete selected known/estimated cost: ${money(t.complete)}`,`Remaining known/estimated cost: ${money(t.remaining)}`,`Items requiring live price check: ${t.unknown}`,'Shipping/tax/alterations not included.');
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
