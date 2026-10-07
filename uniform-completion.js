/* Complete garment and grade previews using blank bases and independent layers.
 * CAPR 39-1 figures remain embedded unchanged; local SVG fabric masks remove
 * baked decorations. Selectable insignia is rendered as independent layers.
 */
(function completeUniformPreviews(){
  'use strict';
  const newGarments={corporate_field:'capr39-1/corporate_field.svg',flight_suit:'capr39-1/flight_suit.svg',polo:'capr39-1/polo.svg',aviator_blazer:'capr39-1/aviator_blazer_male.svg'};
  const chaplains=new Set(['jewish_chaplin','christian_chaplin','buddist_chaplin','muslim_chaplin']);
  const corporateDressBadge=id=>chaplains.has(id) || /aircrew|pilot|observer|balloon|glider/i.test(id);
  for(const [id,file] of Object.entries(newGarments)) Object.assign(UNIFORMS[id],{male:`base/${file}`,female:`base/${file}`,ribbons:false,mini:false});
  UNIFORMS.aviator_blazer.female='base/capr39-1/aviator_blazer_female.svg';
  UNIFORMS.semi_formal.male='base/capr39-1/semi_formal_male.svg';
  UNIFORMS.semi_formal.female='base/capr39-1/semi_formal_female.svg';
  UI_AUTHZ.corporate_field.showRibbons=false;
  UI_AUTHZ.aviator_blazer.showRibbons=false;
  UI_AUTHZ.polo.showBadges=true;
  const oldForegroundClips=getGarmentForegroundClips;
  getGarmentForegroundClips=function(uniformId,path){return newGarments[uniformId] || uniformId==='semi_formal'?[]:oldForegroundClips(uniformId,path);};
  const oldRack=renderRack;
  renderRack=function(){
    if(State.organization==='CAP' && newGarments[State.uniform]){
      uniformCanvas.querySelectorAll('.ribbonTile,.ribbonMini,.ribbonDevice').forEach(el=>el.remove());
      return;
    }
    oldRack();
    if(State.organization==='CAP' && State.uniform==='semi_formal'){
      const medals=[...uniformCanvas.querySelectorAll('.ribbonMini')];
      if(!medals.length)return;
      const bounds=medals.map(el=>({x:parseFloat(el.style.left),y:parseFloat(el.style.top),w:parseFloat(el.style.width),h:parseFloat(el.style.height)}));
      const left=Math.min(...bounds.map(b=>b.x)),right=Math.max(...bounds.map(b=>b.x+b.w)),bottom=Math.max(...bounds.map(b=>b.y+b.h));
      const dx=(State.gender==='female'?286:315)-(left+right)/2,dy=(State.gender==='female'?173:229)-bottom;
      uniformCanvas.querySelectorAll('.ribbonMini,.ribbonDevice').forEach(el=>{
        if(getCalib(el.dataset.calibKey))return;
        el.style.left=`${parseFloat(el.style.left)+dx}px`;el.style.top=`${parseFloat(el.style.top)+dy}px`;
      });
    }
  };
  const oldArea=getActiveRenderArea;
  getActiveRenderArea=function(uniformId=State.uniform){return newGarments[uniformId]?DEFAULT_RENDER_AREA:oldArea(uniformId);};
  const oldCandidates=getBaseCandidates;
  getBaseCandidates=function(){
    if(State.organization!=='CAP' || !State.gender) return oldCandidates();
    if(['blues_a','blues_b','aviator','semi_formal'].includes(State.uniform)) return [UNIFORMS[State.uniform][State.gender]];
    // All OCP cuts use this complete sleeve/tape illustration. Its baked
    // captain patch is covered by the independently generated grade patch.
    if(State.uniform==='ocp') return ['base/capt_OCP_Blouse.png'];
    if(newGarments[State.uniform]) return [UNIFORMS[State.uniform][State.gender]];
    return oldCandidates();
  };
  usingSeniorOfficerOcpBase=function(){return State.uniform==='ocp';};
  window.CAPUBGarmentGeometry={
    corporate_field:{capTape:{centerX:320,topY:190},nameTape:{centerX:131,topY:190}},
    flight_suit:{capTape:{centerX:262,topY:150},nameTape:{centerX:170,topY:150}}
  };
  Object.assign(FIELD_UNIFORM_PATCH_LAYOUTS.corporate_field,{
    L_SHOULDER:{x:389,y:142,dy:54},R_SHOULDER:{x:55,y:142,dy:54},
    CHEST_LEFT:{x:320,y:238,dy:54},CHEST_RIGHT:{x:130,y:238,dy:54}
  });
  Object.assign(FIELD_UNIFORM_PATCH_LAYOUTS.flight_suit,{
    L_SHOULDER:{x:347,y:132,dy:44},R_SHOULDER:{x:74,y:132,dy:44},
    CHEST_LEFT:{x:262,y:177,dy:44},CHEST_RIGHT:{x:170,y:221,dy:44}
  });
  // The Aerospace Education "patch" was a menu placeholder, not a reviewed
  // CAP uniform patch. Keep legacy metadata for validation, omit it from menus.
  const placeholder=patchList.indexOf('aerospace_education_patch');
  if(placeholder>=0) patchList.splice(placeholder,1);
  const originalEligibleBadges=getEligibleBadgeIdsForMembership;
  getEligibleBadgeIdsForMembership=function(membership=State.membership){
    const ids=originalEligibleBadges(membership);
    return State.uniform==='aviator_blazer'?ids.filter(id=>chaplains.has(id)):State.uniform==='semi_formal'?ids.filter(corporateDressBadge):ids;
  };

  const escaped=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  const svg=(w,h,body)=>`data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`)}`;
  function layer(src,key,box,kind='capubGrade'){
    const image=new Image();image.className=`layer capubCompletedLayer ${kind}`;
    image.src=src;image.dataset.calibKey=key;image.dataset.tooltipTitle=kind==='capubGrade'?State.rank:'Uniform accoutrement';
    image.style.objectFit='fill';image.style.zIndex='9001';
    applyCalibToElement(image,key,box);uniformCanvas.appendChild(image);return image;
  }
  function label(text,key,box,fill='#25314b',ink='#fff',second=''){
    const size=second?7:8;
    const body=`<rect width="${box.w}" height="${box.h}" rx="1" fill="${fill}"/><text x="50%" y="${second?box.h*.42:box.h*.68}" text-anchor="middle" font-family="Arial,sans-serif" font-size="${size}" font-weight="bold" fill="${ink}" textLength="${Math.min(box.w-8,text.length*size*.55)}" lengthAdjust="spacingAndGlyphs">${escaped(text)}</text>${second?`<text x="50%" y="${box.h*.8}" text-anchor="middle" font-family="Arial,sans-serif" font-size="5.5" fill="${ink}">${escaped(second)}</text>`:''}`;
    return layer(svg(box.w,box.h,body),key,box,'nameplate');
  }
  function gradeAsset(){
    if(State.membership==='cadet'){
      const asset=window.CAPUBRankAssets.cadets[State.rank]?.asset;
      return asset && State.cadetFirstSergeant && isCadetFirstSergeantEligible(State.rank)?asset.replace('.svg','_first_sergeant.svg'):asset;
    }
    return window.CAPUBRankAssets.officers[State.rank]?.asset || window.CAPUBRankAssets.ncos[State.rank]?.asset;
  }
  function mark(box,suffix,field=false){
    if(field) layer(svg(box.w,box.h,'<rect width="100%" height="100%" fill="#132140"/>'),`gradeBackingV1:${State.uniform}:${suffix}`,box);
    const asset=State.membership==='senior' && suffix.endsWith('-1') && window.CAPUBRankAssets.ncos[State.rank]?.rightAsset || gradeAsset();if(!asset)return;
    const inset=field?3:0;
    const image=layer(ASSET(asset),`gradeV1:${State.uniform}:${State.membership}:${State.rank}:${suffix}`,{...box,x:box.x+inset,y:box.y+inset,w:box.w-inset*2,h:box.h-inset*2});
    image.style.objectFit='contain';
  }
  function epaulets(){
    const u=State.uniform;const female=State.gender==='female';
    const coat=u==='blues_a';const aviator=u==='aviator';
    const centers=coat?(female?[[105,79,-14],[345,79,14]]:[[119,86,-15],[331,86,15]]):aviator?[[119,112,-20],[332,112,20]]:female?[[105,87,-20],[345,87,20]]:[[124,137,-20],[326,137,20]];
    if(State.membership==='senior' && SENIOR_NCO_RANKS.has(State.rank)){
      const positions=coat?[[36,176,0],[377,176,0]]:[[67,201,0],[365,201,0]];
      positions.forEach(([x,y,r],i)=>mark({x,y,w:coat?37:24,h:coat?79:49,r},`sleeve-${i}`));return;
    }
    if(State.membership==='cadet' && !OFFICER_RANKS.has(State.rank)){
      if(State.rank==='C/AB')return;
      const positions=coat?[[166,98,-25],[273,98,25]]:[[169,131,-25],[269,131,25]];
      positions.forEach(([x,y,r],i)=>mark({x,y,w:13,h:12,r},`collar-${i}`));return;
    }
    centers.forEach(([cx,cy,r],i)=>{
      const w=coat?67:58,h=coat?22:19;
      const isCadet=State.membership==='cadet';
      const board=svg(w,h,`<rect x="1" y="1" width="${w-2}" height="${h-2}" rx="1" fill="${isCadet?'#222831':'#686b70'}" stroke="#4b5057"/>${isCadet?`<path d="M4 1v${h-2} M8 1v${h-2}" stroke="#e5e7eb" stroke-width="2"/>`:`<text x="${i?12:w-12}" y="${h*.63}" text-anchor="middle" font-family="Arial" font-size="6" fill="#e5e7eb">CAP</text>`}`);
      layer(board,`gradeSleeveV1:${u}:${i}`,{x:cx-w/2,y:cy-h/2,w,h,r});
      const iconW=isCadet?26:20,iconH=isCadet?16:18;
      mark({x:cx+(i?9:-9)-iconW/2,y:cy-iconH/2,w:iconW,h:iconH,r},`epaulet-${i}`);
    });
  }
  function renderCompletedLayers(){
    uniformCanvas.querySelectorAll('.capubCompletedLayer').forEach(el=>el.remove());
    if(State.organization!=='CAP' || !State.gender || !State.membership)return;
    const base=uniformCanvas.querySelector('img.jacket:not(.garmentForegroundOverlay)');
    if(!base?.complete || !base.naturalWidth)return;
    const u=State.uniform;const name=(State.text?.lastName || 'YOUR NAME').trim().toUpperCase();
    if(u==='blues_a'){
      // Neutral male artwork includes US lettering; a plain fabric layer hides
      // it for cadets, whose metal grade/CAP insignia uses this collar zone.
      const female=State.gender==='female';
      if(State.membership==='cadet' && !female){
        [[161,99],[263,99]].forEach(([x,y],i)=>layer(svg(23,17,'<rect width="23" height="17" fill="#001545"/>'),`lapelFabricV1:${i}`,{x,y,w:23,h:17,r:0}));
      }
      const text=State.membership==='cadet'?(OFFICER_RANKS.has(State.rank)?'CAP':''):'US';
      if(text)[[164,99],[270,99]].forEach(([x,y],i)=>layer(svg(22,12,`<text x="11" y="9" text-anchor="middle" font-family="Arial" font-size="8" font-weight="bold" fill="#dce2e9">${text}</text>`),`lapelInsigniaV1:${i}`,{x,y,w:22,h:12,r:0}));
    }
    if(['blues_a','blues_b','aviator'].includes(u))epaulets();
    if(u==='ocp')mark({x:474,y:218,w:33,h:33,r:0},'chest',true);
    if(u==='abu')[[421,105,-25],[514,105,25]].forEach(([x,y,r],i)=>mark({x,y,w:22,h:24,r},`collar-${i}`,true));
    if(u==='corporate_field'){
      if(State.membership==='senior' && SENIOR_NCO_RANKS.has(State.rank)) [[55,164,-12],[372,164,12]].forEach(([x,y,r],i)=>mark({x,y,w:25,h:49,r},`sleeve-${i}`));
      else [[158,76,-25],[276,76,25]].forEach(([x,y,r],i)=>mark({x,y,w:18,h:22,r},`collar-${i}`,State.membership==='senior' || OFFICER_RANKS.has(State.rank)));
    }
    if(u==='flight_suit' && OFFICER_RANKS.has(State.rank)) [[88,88,-8],[317,90,8]].forEach(([x,y,r],i)=>mark({x,y,w:25,h:15,r},`shoulder-${i}`,true));
    if(State.text?.show!==false){
      if(['blues_a','blues_b','aviator'].includes(u)){
        const box=u==='aviator'?{x:139,y:205,w:62,h:14,r:0}:u==='blues_b'?{x:139,y:216,w:62,h:14,r:0}:{x:120,y:207,w:61,h:14,r:0};
        const senior=State.membership==='senior';
        label(name,`textV3:${u}:nameplate`,box,senior&&u==='blues_a'?'#b7bdc8':senior?'#656971':'#132140',senior&&u==='blues_a'?'#152746':'#fff');
      }
      if(u==='ocp')label(name,'textV3:ocp:nameplate',{x:336,y:157,w:123,h:20,r:0},'#20242a');
      if(u==='abu')label(name,'textV3:abu:nameplate',{x:352,y:205,w:112,h:22,r:0},'#132140');
      if(u==='corporate_field'){
        label(name,'textV3:corporate_field:nameplate',{x:87,y:190,w:88,h:12,r:0},'#132140');
      }
      if(u==='flight_suit')label(name,'textV3:flight_suit:nameplate',{x:229,y:132,w:67,h:38,r:0},'#132140','#eee',`${State.membership==='cadet'?'CADET':State.rank}  CAP`);
      if(u==='aviator_blazer')label(name,'textV3:aviator_blazer:nameplate',State.gender==='female'?{x:260,y:143,w:68,h:18,r:0}:{x:280,y:183,w:68,h:18,r:0},'#132140','#fff',`${State.rank}  CAP`);
    }
    if(u==='corporate_field')label('CIVIL AIR PATROL','textV3:corporate_field:capTape',{x:276,y:190,w:88,h:12,r:0},'#132140');
    if(u==='polo'){
      layer(ASSET('base/cap_seal.svg'),'sealV1:polo',{x:112,y:164,w:58,h:58,r:0},'capubSeal');
      if(State.text?.show!==false)label(name,'textV3:polo:nameplate',{x:280,y:192,w:70,h:12,r:0},'#001748');
    }
    if(u==='aviator_blazer')layer(ASSET('base/capr39-1/crest.svg'),'crestV1:aviator_blazer',State.gender==='female'?{x:276,y:180,w:44,h:48,r:0}:{x:290,y:226,w:42,h:46,r:0},'capubSeal');
    if(u==='flight_suit')layer(ASSET('base/capr39-1/command_patch.svg'),'commandPatchV1:flight_suit',{x:144,y:129,w:51,h:41,r:0},'capubSeal');
    if(u==='flight_suit')layer(ASSET('base/capr39-1/flight_flag.svg'),'flagV1:flight_suit',{x:343,y:116,w:29,h:38,r:0},'capubSeal');
    if(u==='semi_formal')layer(ASSET('base/capr39-1/crest.svg'),'crestV1:semi_formal',State.gender==='female'?{x:265,y:190,w:42,h:46,r:0}:{x:293,y:253,w:44,h:48,r:0},'capubSeal');
    renderMeasurementOverlay();
  }
  window.CAPUBCompletion={render:renderCompletedLayers,regulationGarments:newGarments};
  uniformCanvas.addEventListener('capub:base-ready',()=>queueMicrotask(renderCompletedLayers));
  const oldFullRender=fullRender;
  fullRender=function(prev){oldFullRender(prev);renderCompletedLayers();};
  const oldBadges=renderAllBadges;
  renderAllBadges=function(){
    if(State.organization==='CAP' && State.uniform==='aviator_blazer'){
      const selected=State.badges;State.badges=selected.filter(id=>chaplains.has(id));
      try{oldBadges();}finally{State.badges=selected;}
      uniformCanvas.querySelectorAll('.capMilitaryBadge').forEach(el=>el.remove());
      uniformCanvas.querySelectorAll('.layer.badge').forEach(el=>{
        applyCalibToElement(el,`blazerChaplainV1:${el.dataset.calibKey}`,{x:State.gender==='female'?276:285,y:State.gender==='female'?76:98,w:14,h:14,r:0});
      });
    }else if(State.organization==='CAP' && State.uniform==='semi_formal'){
      const selected=State.badges;State.badges=selected.filter(corporateDressBadge).slice(0,1);
      try{oldBadges();}finally{State.badges=selected;}
      uniformCanvas.querySelectorAll('.layer.badge').forEach(el=>{
        applyCalibToElement(el,`corporateSemiBadgeV1:${el.dataset.calibKey}`,{x:State.gender==='female'?265:293,y:State.gender==='female'?178:237,w:44,h:12,r:0});
      });
    }else if(State.organization==='CAP' && State.uniform==='corporate_field'){
      const selected=State.badges;State.badges=selected.slice(0,2);
      try{oldBadges();}finally{State.badges=selected;}
    }else if(State.organization==='CAP' && State.uniform==='polo'){
      const selected=State.badges;State.badges=selected.slice(0,1);
      try{oldBadges();}finally{State.badges=selected;}
      uniformCanvas.querySelectorAll('.layer.badge').forEach(el=>{
        applyCalibToElement(el,`poloBadgeV1:${el.dataset.badgeId || el.dataset.calibKey}`,{x:287,y:170,w:44,h:14,r:0});
      });
    }else if(State.organization==='CAP' && State.uniform==='flight_suit'){
      const selected=State.badges;State.badges=selected.slice(0,1);
      try{oldBadges();}finally{State.badges=selected;}
      uniformCanvas.querySelectorAll('.layer.badge').forEach(el=>{
        applyCalibToElement(el,`flightNameBadgeV1:${el.dataset.badgeId || el.dataset.calibKey}`,{x:239,y:134,w:45,h:11,r:0});
        el.style.border='none';el.style.height='8px';
        el.style.zIndex='9002';
      });
    }else oldBadges();
  };
  fullRender();
})();
