// Slip-on epaulet sleeves ("shoulder marks") for the Class B blue shirt and the Corporate aviator shirt (CAPR 39-1 Fig A5-1, A5-6).
//   gray sleeve  : officers (embroidered grade) and adults without grade (CAP only)             -> rank-epaulet-sleeve-gray-*
//   blue sleeve  : cadet officers (miniature metal grade pinned on)                              -> rank-epaulet-sleeve-blue-cadet-*
// Geometry, CAP lettering and stripe positions are measured on Fig A5-1 (3x render of the embedded raster); the lettering is cleaned
// from the traced glyphs (base-art/rank-traces/cap_letters.json, snapped to a regular squared face). The figure gives no inch size, so
// the sleeve is scaled so the 1 in oak leaf on the Major sleeve is 1 in (178 px/in): estimated.
// Grade pieces are the existing insignia assets, inlined 1:1. Cadet NCOs / Airmen and NCOs wear no sleeve (metal collar insignia / sleeve chevron).
const fs=require('fs'),path=require('path');
const HERE=__dirname,OUT=path.join(HERE,'insignia');
const U=100,f2=n=>(+n).toFixed(2),esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
const C={gray:'#5f5c5c',blue:'#142347',cap:'#dddcdb',stripe:'#b3b3b3'};
// ---- sleeve geometry (user units, 1 = 0.01 in). Figure tile: bottom 350 px, top 306 px, 684 px tall at 178 px/in
const PXIN=178,W=+(350/PXIN*U).toFixed(1),WT=+(306/PXIN*U).toFixed(1),H=+(684/PXIN*U).toFixed(1);   // 196.6 x 171.9 x 384.3
const edgeX=y=>{const t=(W-WT)/2*(1-y/H);return [t,W-t];};          // left / right edge of the trapezoid at height y (top is the narrow end)
// ---- CAP lettering: clean squared-face glyphs, px of the 3x Fig A5-1 render (C 40.6-91, A 102.3-155, P 167.7-218; cap height 26-86.5)
const GLYPH=[
 {id:'C',loops:[[[51.1,26],[82.5,26],[91,35.5],[91,43.5],[88.7,45.3],[77.5,45.3],[73.5,40.3],[54.2,40.3],[54.2,72.2],[73.5,72.2],[77.5,67.2],[88.7,67.2],[91,69],[91,77],[82.5,86.5],[51.1,86.5],[40.6,79.5],[40.6,33]]]},
 {id:'A',loops:[[[115.9,26.3],[141.3,26.3],[155,86.5],[143.5,86.5],[136.7,72.1],[120.5,72.1],[113.7,86.5],[102.3,86.5]],[[126.1,35.5],[131.1,35.5],[136,60.8],[121.2,60.8]]]},
 {id:'P',loops:[[[167.7,26],[204.5,26],[218,37],[218,50],[204.5,64.1],[182.1,64.1],[182.1,86.5],[167.7,86.5]],[[182.1,39.5],[200.5,39.5],[203.7,45],[200.5,49],[182.1,49]]]}];
const GX0=40.6,GY0=26,GW=218-40.6,GH=60.5,K=U/PXIN;          // px -> user units
const CAPW=GW*K,CAPH=GH*K;
const capPath=(x,y)=>GLYPH.map(g=>`<path d="${g.loops.map(l=>'M'+l.map(q=>f2(x+(q[0]-GX0)*K)+','+f2(y+(q[1]-GY0)*K)).join('L')+'Z').join('')}" fill="${C.cap}" fill-rule="evenodd"/>`).join('');
// ---- insignia inlining (ids made unique per use)
const dir=OUT;
function inline(id,tag,tx,ty,rot){
  const s=fs.readFileSync(path.join(dir,id+'.svg'),'utf8'),w=parseFloat(s.match(/width="([\d.]+)in"/)[1]),h=parseFloat(s.match(/height="([\d.]+)in"/)[1]);
  let inner=s.replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'').replace(/<metadata>[\s\S]*?<\/metadata>/,'').replace(/<title>[\s\S]*?<\/title>/,'');
  const ids=[...inner.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  for(const i of ids){inner=inner.split(`id="${i}"`).join(`id="${tag}__${i}"`).split(`#${i})`).join(`#${tag}__${i})`).split(`"#${i}"`).join(`"#${tag}__${i}"`);}
  // rot: lay the piece across the sleeve (bars run parallel to the end of the sleeve, Fig A5-1); effective size is then h x w
  if(rot)return {w:h,h:w,svg:`<g transform="translate(${f2(tx)} ${f2(ty)}) rotate(90) translate(${f2(-w*U/2)} ${f2(-h*U/2)})">${inner}</g>`};
  return {w,h,svg:`<g transform="translate(${f2(tx-w*U/2)} ${f2(ty-h*U/2)})">${inner}</g>`};
}
const INS_BOTTOM=0.625*U;                                   // bottom of the grade 5/8 in from the end of the sleeve (DAFI 36-2903 7.1.5.1; figure 0.63-0.71)
const stripe=(y0,y1,id)=>{const [l0,r0]=edgeX(y0),[l1,r1]=edgeX(y1),o=3,l=Math.min(l0,l1)-o,r=Math.max(r0,r1)+o;
  return `<rect id="${id}" x="${f2(l)}" y="${f2(y0)}" width="${f2(r-l)}" height="${f2(y1-y0)}" rx="2" fill="${C.stripe}"/>`;};
const v=n=>+(n*H).toFixed(2);
// grade table: gray sleeves. cap = v of the top of the CAP lettering; stripes; pieces
const GRAY=[
 {key:'major-general',name:'Major General',abbr:'Maj Gen',capV:.135,stripes:[[.034,.063],[.886,.944]],stars:[.4115,.691]},
 {key:'brigadier-general',name:'Brigadier General',abbr:'Brig Gen',capV:.135,stripes:[[.035,.064],[.887,.946]],stars:[.536]},
 {key:'colonel',name:'Colonel',abbr:'Col',capV:.222,stripes:[[.918,.947]],piece:'rank-senior-colonel-thread'},
 {key:'lieutenant-colonel',name:'Lieutenant Colonel',abbr:'Lt Col',capV:.222,stripes:[[.920,.949]],piece:'rank-senior-lieutenant-colonel-thread'},
 {key:'major',name:'Major',abbr:'Maj',capV:.222,stripes:[[.918,.947]],piece:'rank-senior-major-thread'},
 {key:'captain',name:'Captain',abbr:'Capt',capV:.222,piece:'rank-senior-captain-thread',rot:true},
 {key:'first-lieutenant',name:'First Lieutenant',abbr:'1st Lt',capV:.222,piece:'rank-senior-first-lieutenant-thread',rot:true},
 {key:'second-lieutenant',name:'Second Lieutenant',abbr:'2d Lt',capV:.222,piece:'rank-senior-second-lieutenant-thread',rot:true},
 {key:'senior-flight-officer',name:'Senior Flight Officer',abbr:'SFO',capV:.185,stripes:[[.642,.700],[.757,.815],[.869,.927]]},
 {key:'technical-flight-officer',name:'Technical Flight Officer',abbr:'TFO',capV:.185,stripes:[[.755,.813],[.867,.927]]},
 {key:'flight-officer',name:'Flight Officer',abbr:'FO',capV:.185,stripes:[[.869,.927]]},
 {key:'blank',name:'Adult member without grade / pursuing officer grade',abbr:'-',capV:.185,blank:true}];
const BLUE=[['colonel','Cadet Colonel','C/Col'],['lieutenant-colonel','Cadet Lieutenant Colonel','C/Lt Col'],['major','Cadet Major','C/Maj'],['captain','Cadet Captain','C/Capt'],
  ['first-lieutenant','Cadet First Lieutenant','C/1st Lt'],['second-lieutenant','Cadet Second Lieutenant','C/2d Lt']];
const written=[];
const anchors=(extra={})=>({top_center:[W/2,0],bottom_center:[W/2,H],center:[W/2,H/2],left_edge:[0,H/2],right_edge:[W,H/2],...extra});
function emit(id,name,body,extra,meta){
  const vb=[0,0,+W.toFixed(1),+H.toFixed(1)];
  const m={asset_id:id,name,size_in:{w:+(W/U).toFixed(3),h:+(H/U).toFixed(3)},units:'1 user unit = 0.01 in',viewBox:vb,
    size_source:'estimated',
    size_basis:'CAPR 39-1 Fig A5-1 / A5-6 give no inch size. Scale 178 px per inch from the 1 in oak leaf on the Major sleeve in Fig A5-1; trapezoid (350 px bottom, 306 px top, 684 px tall at that scale) and all feature positions measured on the figure. Officer sleeves come in two sizes (standard / smaller); the figure shows no measurable difference, so one size is built.',
    provenance:'measured from CAPR 39-1 Fig A5-1 (gray) and A5-6 (blue); CAP lettering cleaned from traced glyphs; grade pieces are this family\'s own assets',
    colours:C,anchors:anchors(meta.anchors||{}),dimensions:meta.dimensions,mounts:MOUNTS,rank:meta.rank,grade:'rank-insignia',...extra};
  fs.writeFileSync(path.join(OUT,id+'.svg'),`<svg xmlns="http://www.w3.org/2000/svg" width="${(W/U).toFixed(3)}in" height="${(H/U).toFixed(3)}in" viewBox="${vb.join(' ')}" data-asset-id="${id}" data-source="reference-art-measured" data-units="0.01in"><title>${esc(name)}</title><metadata>${esc(JSON.stringify(m))}</metadata>${body}</svg>`);
  fs.writeFileSync(path.join(OUT,id+'.spec.json'),JSON.stringify({...m,fit:{method:'n/a',score:null}},null,1));written.push(id);}
const MOUNTS=[
 {uniform:'Class B blue shirt (long/short sleeve, men and women)',rule:'slipped over the shirt epaulet; officers gray with embroidered grade, cadet officers blue with miniature metal grade (CAPR 39-1 4.1.6.1.1, 4.1.6.1.4). NCOs wear the 3 1/2 / 4 in chevron on the sleeve instead; cadet NCOs and Airmen wear metal collar chevrons (no sleeve).'},
 {uniform:'Corporate aviator shirt (white), worn alone or under the blazer',rule:'same gray / blue sleeve (4.2.5.1.1.1, 4.2.5.1.1.4). Individuals without grade wear gray sleeves with no insignia (1.2.x, 4.2.5).'},
 {uniform:'Corporate blazer',rule:'no epaulet sleeves; grade insignia is optional on the black blazer nameplate (officers and NCOs), not allowed for cadets (4.2.3.1.1.2, 4.2.4.1.1.2).'}];
const dimsBase={form:'slip-on epaulet sleeve',length_in:+(H/U).toFixed(3),end_width_in:+(W/U).toFixed(3),button_end_width_in:+(WT/U).toFixed(3),
  cap_word_w_in:+(CAPW/U).toFixed(3),cap_word_h_in:+(CAPH/U).toFixed(3),grade_bottom_from_end_in:0.625,grade_bottom_note:'DAFI 36-2903 7.1.5.1: 5/8 in from the end of the epaulet; figure shows 0.63-0.71 in'};
// ---- gray
for(const g of GRAY){
  const id=`rank-epaulet-sleeve-gray-${g.key}`,[l0,r0]=edgeX(0);
  let b=`<g id="${id}__cloth"><path id="${id}__body" d="M${f2(l0)},0L${f2(r0)},0L${f2(W)},${f2(H)}L0,${f2(H)}Z" fill="${C.gray}"/></g>`;
  (g.stripes||[]).forEach((s,i)=>{b+=stripe(v(s[0]),v(s[1]),`${id}__stripe${i+1}`);});
  const capY=v(g.capV);b+=`<g id="${id}__cap">${capPath(W/2-CAPW/2,capY)}</g>`;
  let gi={};
  if(g.stars){g.stars.forEach((sv,i)=>{const r=inline('rank-senior-brigadier-general-1in-thread',`${id}__s${i+1}`,W/2,v(sv));b+=`<g id="${id}__star${i+1}">${r.svg}</g>`;});gi={insignia_center:[W/2,v(g.stars[Math.floor(g.stars.length/2)])]};}
  else if(g.piece){const sz=spec(g.piece),eh=g.rot?sz.w:sz.h,cy=H-INS_BOTTOM-eh*U/2,r=inline(g.piece,`${id}__grade`,W/2,cy,g.rot);b+=`<g id="${id}__grade">${r.svg}</g>`;gi={insignia_center:[W/2,cy]};}
  emit(id,`${g.name} gray epaulet sleeve`,b,{...(g.pending?{pending:g.pending}:{}),...(g.key==='colonel'?{orientation_note:'Colonel eagle MIRRORED to follow the regulation text: beak toward the wearer\'s right shoulder = viewer\'s LEFT on a front view (CAPR 39-1 6.1.14.4.1; OCP/ABU grade rules). The figures (A5-1/A5-2) draw it toward the viewer\'s right. Decision 2026-10-13.'}:{})},{anchors:{cap_center:[W/2,capY+CAPH/2],...gi},
    dimensions:{...dimsBase,grade_orientation:g.rot?'bars run across the sleeve (parallel to its end), Fig A5-1':'upright',grade_pieces:g.stars?g.stars.length+' x 1 in star':(g.piece||(g.stripes?g.stripes.length+' silver stripe(s)':'none'))},
    rank:{grade:g.name,abbrev:g.abbr,membership:'senior',sleeve:'gray'}});
}
function spec(id){return JSON.parse(fs.readFileSync(path.join(OUT,id+'.spec.json'),'utf8')).size_in;}
// ---- blue (cadet officers)
for(const [key,name,abbr] of BLUE){
  const id=`rank-epaulet-sleeve-blue-cadet-${key}`,[l0,r0]=edgeX(0),piece=`rank-cadet-officer-${key}-metal-miniature`,sz=spec(piece);
  let b=`<g id="${id}__cloth"><path id="${id}__body" d="M${f2(l0)},0L${f2(r0)},0L${f2(W)},${f2(H)}L0,${f2(H)}Z" fill="${C.blue}"/></g>`;
  const capY=v(.222);b+=`<g id="${id}__cap">${capPath(W/2-CAPW/2,capY)}</g>`;
  const cy=H-INS_BOTTOM-sz.h*U/2,r=inline(piece,`${id}__grade`,W/2,cy);b+=`<g id="${id}__grade">${r.svg}</g>`;
  emit(id,`${name} blue epaulet sleeve`,b,{},{anchors:{cap_center:[W/2,capY+CAPH/2],insignia_center:[W/2,cy]},
    dimensions:{...dimsBase,grade_pieces:piece,grade_size_in:sz,cloth_note:'blue = the family cloth blue (#142347); Fig A5-6 shows a slightly more saturated navy'},
    rank:{grade:name,abbrev:abbr,membership:'cadet',sleeve:'blue'}});
}
// blank blue (cadet without grade insignia, e.g. cadet NCO wearing the blue shirt sleeve is not authorised; kept as the base for compositing)
{const id='rank-epaulet-sleeve-blue-cadet-blank',[l0,r0]=edgeX(0),capY=v(.222);
 emit(id,'Blue epaulet sleeve, CAP only (no grade)',`<g id="${id}__cloth"><path id="${id}__body" d="M${f2(l0)},0L${f2(r0)},0L${f2(W)},${f2(H)}L0,${f2(H)}Z" fill="${C.blue}"/></g><g id="${id}__cap">${capPath(W/2-CAPW/2,capY)}</g>`,
  {},{anchors:{cap_center:[W/2,capY+CAPH/2],insignia_center:[W/2,H-INS_BOTTOM-30]},dimensions:{...dimsBase,grade_pieces:'none'},rank:{grade:'none',membership:'cadet',sleeve:'blue'}});}
console.log('epaulet sleeves:',written.length,'assets; sleeve',(W/U).toFixed(2),'x',(H/U).toFixed(2),'in; CAP',(CAPW/U).toFixed(2),'x',(CAPH/U).toFixed(2));

// ---- "CAP" patch worn by adults without grade in place of grade insignia (CAPR 39-1 Fig A5-2, last tile)
// Measured on the figure: patch 385 x 212 px; the Lt Col cloth patch in the same figure is 295 x 319 px = (0.90 in leaf + 2 x 1/8 in) x (1.0 in leaf + 2 x 1/8 in) = 1.15 x 1.25 in,
// so 256 px/in -> patch 1.50 x 0.83 in. Lettering 313 x 100 px = 1.22 x 0.39 in, centred. Cloth blue = family blue (the figure's ultramarine column is #0451b6).
{
  const PW=1.50*U,PH=0.83*U,WW=1.22*U,WH=0.39*U,id='rank-cap-patch-no-grade',x0=(PW-WW)/2,y0=(PH-WH)/2,sx=WW/GW,sy=WH/GH;
  const word=GLYPH.map(g=>`<path d="${g.loops.map(l=>'M'+l.map(q=>f2(x0+(q[0]-GX0)*sx)+','+f2(y0+(q[1]-GY0)*sy)).join('L')+'Z').join('')}" fill="#f4f6f8" fill-rule="evenodd"/>`).join('');
  const body=`<g id="${id}__cloth"><rect id="${id}__backing" width="${f2(PW)}" height="${f2(PH)}" fill="${C.blue}"/></g><g id="${id}__cap">${word}</g>`;
  const vb=[0,0,PW,PH];
  const m={asset_id:id,name:'CAP patch, adult member without grade',size_in:{w:1.5,h:0.83},units:'1 user unit = 0.01 in',viewBox:vb,size_source:'estimated',
    size_basis:'CAPR 39-1 Fig A5-2, tile "Adult member without grade pursuing officer grade": 385 x 212 px against the 1.15 x 1.25 in Lt Col cloth patch in the same figure (295 x 319 px, 1 in leaf + 1/8 in border) = 256 px/in',
    provenance:'measured from CAPR 39-1 Fig A5-2; lettering is the sleeve CAP glyph set stretched to the measured word box',
    colours:{cloth:C.blue,letters:'#f4f6f8'},anchors:{top_center:[PW/2,0],bottom_center:[PW/2,PH],center:[PW/2,PH/2],left_edge:[0,PH/2],right_edge:[PW,PH/2],insignia_center:[PW/2,PH/2]},
    dimensions:{form:'cloth patch',patch_w_in:1.5,patch_h_in:0.83,word_w_in:1.22,word_h_in:0.39},
    mounts:[{uniform:'ABU coat collar / OCP, ABU and tactical caps',rule:'worn where officers wear grade insignia by adults without grade pursuing officer promotion (CAPR 39-1 1.4.1, Fig A5-2)'},
            {uniform:'OCP coat',rule:'senior members without grade wear the blank 2 x 2 in dark blue square instead (7.1.1.2.1): use rank-ocp-square-blank'}],
    rank:{grade:'none',membership:'senior'},grade:'rank-insignia'};
  fs.writeFileSync(path.join(OUT,id+'.svg'),`<svg xmlns="http://www.w3.org/2000/svg" width="1.500in" height="0.830in" viewBox="${vb.join(' ')}" data-asset-id="${id}" data-source="reference-art-measured" data-units="0.01in"><title>${esc(m.name)}</title><metadata>${esc(JSON.stringify(m))}</metadata>${body}</svg>`);
  fs.writeFileSync(path.join(OUT,id+'.spec.json'),JSON.stringify({...m,fit:{method:'n/a',score:null}},null,1));
  console.log('wrote',id);
}
