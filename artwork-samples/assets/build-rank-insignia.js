// Rank insignia family, dimensionally exact (same convention as build-assets.js):
//   root width/height in inches, 1 user unit = 0.01 in, <metadata> JSON, ids namespaced, no <text>/<filter>/data: URIs.
// One geometry table (SIZES) drives every form, so metal / embroidered / on-cloth variants can never disagree.
//
// Sources (CAPR 39-1, 3 March 2020):
//   Fig A5-6 dimension drawing  -> cadet officer regular + miniature metal sizes (inches, read off the drawing)
//   7.1.1.2.1 / 7.1.1.2.2       -> OCP: 2 in x 2 in dark blue square; cadet officers stack grade vertically, field-grade
//                                  diamonds with the long points horizontal; Airman Basic wears no device, no blue material
//   5.1.1.1.1.1 / .3, 7.1.1.8   -> ABU collar and OCP/ABU/tactical cap: 1/8 in of blue showing past the widest and tallest part
//   7.1.1.3.1, 5.1.1.1.2.4      -> same 1/8 in rule for badges (so cloth() below works on any asset's bbox)
// run: node build-rank-insignia.js
const fs=require('fs'),path=require('path');
const HERE=__dirname,U=100;
const OUT=path.join(HERE,'insignia');fs.mkdirSync(OUT,{recursive:true});
const f2=n=>(+n).toFixed(2),esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
const r2=a=>a.map(v=>+(+v).toFixed(2));

// ---------------------------------------------------------------- geometry table (inches)
const SIZES={
  regular:{diamond:{w:0.75,h:1.25},circle:{d:0.75},rim:0.045,
    groups:{colonel:{n:3,W:2.25,k:'diamond'},lieutenant_colonel:{n:2,W:1.5,k:'diamond'},major:{n:1,W:0.75,k:'diamond'},
            captain:{n:3,W:2.25,k:'circle'},first_lieutenant:{n:2,W:1.5,k:'circle'},second_lieutenant:{n:1,W:0.75,k:'circle'}}},
  miniature:{diamond:{w:0.375,h:0.5},circle:{d:0.375},rim:0.03,
    groups:{colonel:{n:3,W:1.0,k:'diamond'},lieutenant_colonel:{n:2,W:0.75,k:'diamond'},major:{n:1,W:0.375,k:'diamond'},
            captain:{n:3,W:1.25,k:'circle'},first_lieutenant:{n:2,W:0.75,k:'circle'},second_lieutenant:{n:1,W:0.375,k:'circle'}}},
};
const GRADES=[['colonel','Cadet Colonel','C/Col'],['lieutenant_colonel','Cadet Lieutenant Colonel','C/Lt Col'],['major','Cadet Major','C/Maj'],
              ['captain','Cadet Captain','C/Capt'],['first_lieutenant','Cadet First Lieutenant','C/1st Lt'],['second_lieutenant','Cadet Second Lieutenant','C/2d Lt']];
const BORDER_IN=0.125;               // blue showing past the widest/tallest point (CAPR 39-1 5.1.1.1.1.1, 7.1.1.8)
const OCP_SQUARE_IN=2.0;             // CAPR 39-1 7.1.1.2.1
const COLORS={cloth:'#142347',thread:'#eef1f4',metalRim:'#d9dde2',metalField:'#c9ced4',metalMesh:'#7f868e',edge:'#4b5057'};
const CITE_A56='CAPR 39-1 (3 March 2020) Figure A5-6, dimension drawing (inches read from the figure)';

// ---------------------------------------------------------------- element layout
// returns elements [{k,cx,cy,w,h,rot}] centred on the group origin (0,0), plus overall bbox, all in inches
function layout(size,grade,arrangement){
  const S=SIZES[size],g=S.groups[grade];
  const sh=S[g.k],w=g.k==='diamond'?sh.w:sh.d,h=g.k==='diamond'?sh.h:sh.d;
  const pitch=g.n>1?(g.W-w)/(g.n-1):0;
  const els=[];
  for(let i=0;i<g.n;i++){
    const off=(i-(g.n-1)/2)*pitch;
    if(arrangement==='row')els.push({k:g.k,cx:off,cy:0,w,h,rot:0});
    else{ // OCP stack: vertical, diamonds turned so the long points are horizontal
      const along=g.k==='diamond'?w:h;
      const p=g.n>1?(g.W-w)/(g.n-1):0;   // same centre spacing as the row
      els.push({k:g.k,cx:0,cy:(i-(g.n-1)/2)*p,w:g.k==='diamond'?h:w,h:g.k==='diamond'?w:h,rot:g.k==='diamond'?90:0});
    }
  }
  let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  for(const e of els){x0=Math.min(x0,e.cx-e.w/2);x1=Math.max(x1,e.cx+e.w/2);y0=Math.min(y0,e.cy-e.h/2);y1=Math.max(y1,e.cy+e.h/2);}
  return {els,bbox:[x0,y0,x1,y1],pitch,rim:S.rim,shape:g.k};
}

// ---------------------------------------------------------------- drawing
// shape centred at (cx,cy) in user units. turned = long axis horizontal.
function diamondPts(cx,cy,hw,hh,turned){return turned?[[cx-hh,cy],[cx,cy-hw],[cx+hh,cy],[cx,cy+hw]]:[[cx,cy-hh],[cx+hw,cy],[cx,cy+hh],[cx-hw,cy]];}
const poly=pts=>pts.map(p=>f2(p[0])+','+f2(p[1])).join(' ');
function metalShape(e,rim,id,ox,oy){
  const cx=ox+e.cx*U,cy=oy+e.cy*U,t=rim*U;
  if(e.k==='circle'){const r=e.w*U/2;
    return `<circle cx="${f2(cx)}" cy="${f2(cy)}" r="${f2(r)}" fill="${COLORS.metalRim}" stroke="${COLORS.edge}" stroke-width="0.9"/>`
          +`<circle cx="${f2(cx)}" cy="${f2(cy)}" r="${f2(r-t)}" fill="url(#${id}__mesh)" stroke="${COLORS.edge}" stroke-width="0.6"/>`;}
  // rhombus inset by t along the edge normals
  const turned=e.rot===90,a=(turned?e.h:e.w)*U/2,b=(turned?e.w:e.h)*U/2; // a: half-diagonal across the short axis, b: along the long axis
  const L=Math.hypot(a,b),ai=a-t*L/b,bi=b-t*L/a;
  return `<polygon points="${poly(diamondPts(cx,cy,a,b,turned))}" fill="${COLORS.metalRim}" stroke="${COLORS.edge}" stroke-width="0.9" stroke-linejoin="miter"/>`
        +`<polygon points="${poly(diamondPts(cx,cy,ai,bi,turned))}" fill="url(#${id}__mesh)" stroke="${COLORS.edge}" stroke-width="0.6" stroke-linejoin="miter"/>`;
}
function threadShape(e,ox,oy){
  const cx=ox+e.cx*U,cy=oy+e.cy*U;
  if(e.k==='circle')return `<circle cx="${f2(cx)}" cy="${f2(cy)}" r="${f2(e.w*U/2)}" fill="${COLORS.thread}"/>`;
  const turned=e.rot===90,a=(turned?e.h:e.w)*U/2,b=(turned?e.w:e.h)*U/2;
  return `<polygon points="${poly(diamondPts(cx,cy,a,b,turned))}" fill="${COLORS.thread}"/>`;
}
// the small bar that joins touching shapes in a row (visible in Fig A5-6)
function links(lo,id,ox,oy,metal){
  if(lo.els.length<2||lo.pitch<=0)return '';
  const e0=lo.els[0],gap=lo.pitch-e0.w; // negative = overlapping (miniature diamonds)
  if(gap<0)return '';
  const len=Math.max(gap,0.05)+0.03,hgt=0.035;let s='';
  for(let i=0;i<lo.els.length-1;i++){
    const mx=(lo.els[i].cx+lo.els[i+1].cx)/2;
    s+=`<rect x="${f2(ox+(mx-len/2)*U)}" y="${f2(oy+(lo.els[i].cy-hgt/2)*U)}" width="${f2(len*U)}" height="${f2(hgt*U)}" fill="${metal?COLORS.metalRim:COLORS.thread}" ${metal?`stroke="${COLORS.edge}" stroke-width="0.6"`:''}/>`;
  }
  return s;
}

// ---------------------------------------------------------------- asset plumbing
function root({id,name,wIn,hIn,source,meta,defs='',body}){
  const vbW=+(wIn*U).toFixed(2),vbH=+(hIn*U).toFixed(2);
  const m={asset_id:id,name,size_in:{w:+wIn.toFixed(4),h:+hIn.toFixed(4)},units:'1 user unit = 0.01 in',viewBox:[0,0,vbW,vbH],...meta};
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${wIn.toFixed(4)}in" height="${hIn.toFixed(4)}in" viewBox="0 0 ${vbW} ${vbH}" data-asset-id="${id}" data-source="${source}" data-units="0.01in"><title>${esc(name)}</title><metadata>${esc(JSON.stringify(m))}</metadata>${defs?`<defs>${defs}</defs>`:''}${body}</svg>`;
  return {svg,spec:m};
}
const meshDef=id=>`<pattern id="${id}__mesh" width="3" height="3" patternUnits="userSpaceOnUse"><rect width="3" height="3" fill="${COLORS.metalField}"/><path d="M0 0H3M0 0V3" stroke="${COLORS.metalMesh}" stroke-width="0.35"/></pattern>`;
const stdAnchors=(W,H)=>({top_center:[W/2,0],bottom_center:[W/2,H],center:[W/2,H/2],left_edge:[0,H/2],right_edge:[W,H/2]});
const written=[];
function write(id,r){fs.writeFileSync(path.join(OUT,id+'.svg'),r.svg);fs.writeFileSync(path.join(OUT,id+'.spec.json'),JSON.stringify(r.spec,null,1));written.push(id);}
const slug=s=>s.replace(/_/g,'-');

// ---------------------------------------------------------------- builders
// metal: shapes alone, tight to their own bbox (no margin): this IS the physical metal piece
function buildMetal(size,grade,name){
  const lo=layout(size,grade,'row'),[x0,y0,x1,y1]=lo.bbox,W=(x1-x0)*U,H=(y1-y0)*U;
  const id=`rank-cadet-officer-${slug(grade)}-metal-${size}`,ox=-x0*U,oy=-y0*U;
  let body=`<g id="${id}__metal">`;
  lo.els.forEach((e,i)=>{body+=`<g id="${id}__element-${i}">${metalShape(e,lo.rim,id,ox,oy)}</g>`;});
  body+=links(lo,id,ox,oy,true)+'</g>';
  const an={...stdAnchors(W,H)};
  lo.els.forEach((e,i)=>{an['element_'+i+'_center']=[ox+e.cx*U,oy+e.cy*U];});
  const R=root({id,name:`${name} insignia, ${size} metal`,wIn:W/U,hIn:H/U,source:'regulation',defs:meshDef(id),body,
    meta:{size_source:'regulation',size_citation:CITE_A56,anchors:Object.fromEntries(Object.entries(an).map(([k,v])=>[k,r2(v)])),
      dimensions:{form:'metal',size,count:lo.els.length,shape:lo.shape,element_w_in:lo.els[0].w,element_h_in:lo.els[0].h,
        centre_pitch_in:+lo.pitch.toFixed(4),rim_width_in:lo.rim,overall_w_in:+(W/U).toFixed(4),overall_h_in:+(H/U).toFixed(4)},
      worn_on:size==='regular'?['Class A / mess dress shoulder boards (cadet officers)']:['service-coat epaulets','blue-shirt epaulets','outer-garment epaulets (either size, A5-6)'],
      rank:{grade:name,abbrev:GRADES.find(g=>g[0]===grade)[2],membership:'cadet'},grade:'rank-insignia'}});
  R.spec.fit={method:'n/a (geometry from regulation dimensions)',score:null};
  write(id,R);return {id,W,H};
}
// embroidered thread, no cloth
function buildThread(size,grade,name,arrangement){
  const lo=layout(size,grade,arrangement),[x0,y0,x1,y1]=lo.bbox,W=(x1-x0)*U,H=(y1-y0)*U,ox=-x0*U,oy=-y0*U;
  const id=`rank-cadet-officer-${slug(grade)}-thread-${size}-${arrangement}`;
  let body=`<g id="${id}__thread">`;
  lo.els.forEach((e,i)=>{body+=`<g id="${id}__element-${i}">${threadShape(e,ox,oy)}</g>`;});
  body+=links(lo,id,ox,oy,false)+'</g>';
  const an={...stdAnchors(W,H)};lo.els.forEach((e,i)=>{an['element_'+i+'_center']=[ox+e.cx*U,oy+e.cy*U];});
  const R=root({id,name:`${name} insignia, embroidered ${size}, ${arrangement}`,wIn:W/U,hIn:H/U,source:'regulation',body,
    meta:{size_source:'regulation',size_citation:CITE_A56+' (same shapes as the metal piece; thread version is plain light silver)',
      anchors:Object.fromEntries(Object.entries(an).map(([k,v])=>[k,r2(v)])),
      dimensions:{form:'embroidered thread',size,arrangement,count:lo.els.length,shape:lo.shape,overall_w_in:+(W/U).toFixed(4),overall_h_in:+(H/U).toFixed(4)},
      rank:{grade:name,abbrev:GRADES.find(g=>g[0]===grade)[2],membership:'cadet'},grade:'rank-insignia'}});
  R.spec.fit={method:'n/a',score:null};
  write(id,R);return {id,W,H,lo};
}
// thread on dark blue cloth with 1/8 in of blue past the widest and tallest point (ABU collar, ABU/OCP/tactical caps)
function buildBordered(size,grade,name){
  const lo=layout(size,grade,'row'),[x0,y0,x1,y1]=lo.bbox,iw=(x1-x0),ih=(y1-y0);
  const Wi=iw+2*BORDER_IN,Hi=ih+2*BORDER_IN,W=Wi*U,H=Hi*U,ox=BORDER_IN*U-x0*U,oy=BORDER_IN*U-y0*U;
  const id=`rank-cadet-officer-${slug(grade)}-cloth-bordered-${size}`;
  let body=`<g id="${id}__cloth"><rect id="${id}__backing" width="${f2(W)}" height="${f2(H)}" fill="${COLORS.cloth}"/></g><g id="${id}__thread">`;
  lo.els.forEach((e,i)=>{body+=`<g id="${id}__element-${i}">${threadShape(e,ox,oy)}</g>`;});
  body+=links(lo,id,ox,oy,false)+'</g>';
  const an={...stdAnchors(W,H),insignia_center:[W/2,H/2],insignia_left:[BORDER_IN*U,H/2],insignia_right:[W-BORDER_IN*U,H/2]};
  const R=root({id,name:`${name} insignia on cloth (1/8 in border), ${size}`,wIn:Wi,hIn:Hi,source:'regulation',body,
    meta:{size_source:'regulation',size_citation:`${CITE_A56}; border: CAPR 39-1 5.1.1.1.1.1 / 5.1.1.1.1.3 (ABU) and 7.1.1.8 (OCP/tactical cap), 1/8 in showing past the widest and tallest point`,
      anchors:Object.fromEntries(Object.entries(an).map(([k,v])=>[k,r2(v)])),
      dimensions:{form:'embroidered on cloth',size,border_each_side_in:BORDER_IN,insignia_w_in:+iw.toFixed(4),insignia_h_in:+ih.toFixed(4),cloth_w_in:+Wi.toFixed(4),cloth_h_in:+Hi.toFixed(4)},
      mounts:[{uniform:'ABU / BDU / blue field coat collar',rule:'regular size (Colonels and Captains may wear miniature), centered 1 in from the FRONT of the collar, 1/8 in of blue showing past the widest and tallest point (5.1.1.1.1.3, 5.1.2.2.4, 5.2.1.1.1.4). Orientation as drawn: field-grade long points vertical, company-grade circles in a horizontal row (6.2.9.2 / 6.1.10.2.2)'},
              {uniform:'OCP / ABU / BDU / blue field / navy tactical cap',rule:'cadet officers only (cadet NCOs and Airmen wear none, 7.1.1.8): centered on the front, 1/2 in from the visor, 1/8 in of blue showing (7.1.1.8, 5.1.2.2.5, 5.2.1.1.1.5, 6.2.11)'},
              {uniform:'green / black fleece (front)',rule:'dark blue material, centered horizontally, long points of field grade vertical, company-grade circles added horizontally (6.1.10.2.2, 6.1.14.4.2)'}],
      cloth_color:{hex:COLORS.cloth,basis:'sampled from CAPR 39-1 p.136 cloth figure; regulation calls it dark blue'},
      rank:{grade:name,abbrev:GRADES.find(g=>g[0]===grade)[2],membership:'cadet'},grade:'rank-insignia'}});
  R.spec.fit={method:'n/a',score:null};
  write(id,R);return {id,W,H};
}
// OCP chest: 2 in x 2 in blue square, grade centred, stacked (7.1.1.2.2).
// One common scale for every grade: the largest scale at which the biggest stack (Cadet Colonel / Captain, 3 elements) still keeps
// 1/8 in of blue inside the square. Regular-size geometry scaled by that factor, so no grade floats in a field of blue.
const OCP_FILL_IN=OCP_SQUARE_IN-2*BORDER_IN;
const OCP_SCALE=(()=>{let m=0;for(const [g] of GRADES){const [x0,y0,x1,y1]=layout('regular',g,'stack').bbox;m=Math.max(m,x1-x0,y1-y0);}return OCP_FILL_IN/m;})();
function buildOcpSquare(grade,name){
  const lo=layout('regular',grade,'stack');
  lo.els.forEach(e=>{e.cx*=OCP_SCALE;e.cy*=OCP_SCALE;e.w*=OCP_SCALE;e.h*=OCP_SCALE;});
  const xs=lo.els.flatMap(e=>[e.cx-e.w/2,e.cx+e.w/2]),ys=lo.els.flatMap(e=>[e.cy-e.h/2,e.cy+e.h/2]);
  const x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys),W=OCP_SQUARE_IN*U,H=OCP_SQUARE_IN*U;
  const ox=W/2-((x0+x1)/2)*U,oy=H/2-((y0+y1)/2)*U;
  const id=`rank-cadet-officer-${slug(grade)}-ocp-square`;
  let body=`<g id="${id}__thread">`;   // no cloth: the device sits on the blank rank square (rank-ocp-square-blank), which is the blue
  lo.els.forEach((e,i)=>{body+=`<g id="${id}__element-${i}">${threadShape(e,ox,oy)}</g>`;});
  body+='</g>';
  const an={...stdAnchors(W,H),insignia_center:[W/2,H/2]};
  const R=root({id,name:`${name} insignia on the 2 in OCP square`,wIn:OCP_SQUARE_IN,hIn:OCP_SQUARE_IN,source:'regulation',body,
    meta:{size_source:'estimated',size_basis:'Square is 2 in x 2 in (CAPR 39-1 7.1.1.2.1, regulation). Insignia is the Fig A5-6 regular-size geometry scaled by '+OCP_SCALE.toFixed(4)+' so the largest cadet officer stack leaves 1/8 in of blue; the regulation gives no insignia size for the square.',
      anchors:Object.fromEntries(Object.entries(an).map(([k,v])=>[k,r2(v)])),
      dimensions:{form:'embroidered on 2x2 square',square_in:OCP_SQUARE_IN,scale_vs_regular:+OCP_SCALE.toFixed(4),insignia_w_in:+(x1-x0).toFixed(4),insignia_h_in:+(y1-y0).toFixed(4),
        clear_blue_each_side_in:{x:+((OCP_SQUARE_IN-(x1-x0))/2).toFixed(4),y:+((OCP_SQUARE_IN-(y1-y0))/2).toFixed(4)}},
      layout:'centered vertically; field-grade diamonds with the long points horizontal; company-grade circles added vertically (7.1.1.2.2)',
      mounts:[{uniform:'OCP coat',rule:'center of chest (7.1.1.2.1); garment landmark rank_square'},{uniform:'coyote brown fleece',rule:'2 in squared Velcro cloth rank, flush and centered above the nametape (7.1.1.11.2); same orientation as the OCP (long points horizontal, circles stacked vertically, 7.1.1.2.2)'}],
      rank:{grade:name,abbrev:GRADES.find(g=>g[0]===grade)[2],membership:'cadet'},grade:'rank-insignia'}});
  R.spec.fit={method:'n/a',score:null};
  write(id,R);return {id};
}
function buildBlankSquare(){
  const id='rank-ocp-square-blank',W=OCP_SQUARE_IN*U,H=OCP_SQUARE_IN*U;
  const R=root({id,name:'Blank 2 in OCP dark blue square (no grade)',wIn:OCP_SQUARE_IN,hIn:OCP_SQUARE_IN,source:'regulation',
    body:`<g id="${id}__cloth"><rect id="${id}__backing" width="${W}" height="${H}" fill="${COLORS.cloth}"/></g>`,
    meta:{size_source:'regulation',size_citation:'CAPR 39-1 (3 March 2020) 7.1.1.2.1: "Senior members without grade wear a blank 2 in x 2 in dark blue square on the front of the OCP"',
      anchors:Object.fromEntries(Object.entries({...stdAnchors(W,H),insignia_center:[W/2,H/2]}).map(([k,v])=>[k,r2(v)])),
      dimensions:{square_in:OCP_SQUARE_IN},
      backing_for:['cadet NCO and Airman metal device (7.1.1.2.2)','officer / NCO embroidered grade (7.1.1.2.1)'],
      cloth_color:{hex:COLORS.cloth,basis:'sampled from CAPR 39-1 p.136 cloth figure'},grade:'rank-insignia'}});
  R.spec.fit={method:'n/a',score:null};write(id,R);return {id};
}

// ================================================================ senior members: officers and NCOs
const TR=path.join(HERE,'..','base-art','rank-traces');           // flat-colour traces of the regulation figures (see trace-rank-figures.sh)
const loadTrace=n=>JSON.parse(fs.readFileSync(path.join(TR,n+'.json')));
const THREAD={silver:'#eef1f4',gold:'#f2d40a',silverShade:'#aab3bc',goldShade:'#b8960a'};
const CITE_DAFI='DAFI 36-2903 (29 Feb 2024) 7.1.5.1: officer metal rank insignia are "1-inch"; interpreted here as the largest dimension. Stars 1 in (4.5.1.1.2, 6.x), 3/4 in optional.';
const polyPath=ps=>ps.map(p=>'M'+p.map(q=>f2(q[0])+','+f2(q[1])).join('L')+'Z').join('');
function starPoints(cx,cy,R){const p=[];for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?R*0.382:R;p.push([cx+r*Math.cos(a),cy+r*Math.sin(a)]);}return p;}
// generic wrapper: given inner drawing in inches around (0,0), emit thread-only, bordered cloth and 2x2 square versions
function emitThreeForms({key,name,abbrev,membership,els,bbox,drawThread,cite,sizeSource,sizeBasis,extraDims,mountNote,estimated,square='fit'}){
  const [x0,y0,x1,y1]=bbox,iw=x1-x0,ih=y1-y0;
  const forms=[
    {suffix:'thread',W:iw,H:ih,bg:false,ox:-x0,oy:-y0,desc:'embroidered thread'},
    {suffix:'cloth-bordered',W:iw+2*BORDER_IN,H:ih+2*BORDER_IN,bg:true,ox:BORDER_IN-x0,oy:BORDER_IN-y0,desc:'on cloth with 1/8 in border'},
    {suffix:'ocp-square',W:OCP_SQUARE_IN,H:OCP_SQUARE_IN,bg:true,ox:OCP_SQUARE_IN/2-(x0+x1)/2,oy:OCP_SQUARE_IN/2-(y0+y1)/2,desc:'on the 2 in OCP square'},
  ];
  const out=[];
  for(const F of forms){
    const id=`rank-${membership}-${slug(key)}-${F.suffix}`,W=F.W*U,H=F.H*U;
    let body='';
    if(F.bg&&F.suffix!=='ocp-square')body+=`<g id="${id}__cloth"><rect id="${id}__backing" width="${f2(W)}" height="${f2(H)}" fill="${COLORS.cloth}"/></g>`;
    body+=`<g id="${id}__thread">${drawThread(F.ox*U,F.oy*U,id)}</g>`;
    const an={...stdAnchors(W,H),insignia_center:[F.ox*U+(x0+x1)/2*U,F.oy*U+(y0+y1)/2*U]};
    const fitsSquare=F.suffix!=='ocp-square'||(iw<=OCP_SQUARE_IN&&ih<=OCP_SQUARE_IN);
    const R=root({id,name:`${name} insignia, ${F.desc}`,wIn:F.W,hIn:F.H,source:sizeSource==='regulation'?'regulation':'reference-art-measured',body,
      meta:{size_source:sizeSource,...(sizeSource==='regulation'?{size_citation:cite}:{size_basis:sizeBasis}),
        anchors:Object.fromEntries(Object.entries(an).map(([k,v])=>[k,r2(v)])),
        dimensions:{form:F.desc,insignia_w_in:+iw.toFixed(4),insignia_h_in:+ih.toFixed(4),
          ...(F.suffix==='cloth-bordered'?{border_each_side_in:BORDER_IN,cloth_w_in:+F.W.toFixed(4),cloth_h_in:+F.H.toFixed(4)}:{}),
          ...(F.suffix==='ocp-square'?{square_in:OCP_SQUARE_IN,fits_inside_square:fitsSquare}:{}),...extraDims},
        ...(estimated?{estimated}:{}),
        ...(mountNote?{mounts:mountNote}:{}),
        cloth_color:F.bg?{hex:COLORS.cloth,basis:'sampled from CAPR 39-1 p.136 cloth figure'}:undefined,
        rank:{grade:name,abbrev,membership},grade:'rank-insignia'}});
    R.spec.fit={method:'n/a',score:null};write(id,R);out.push(id);
  }
  return out;
}
// bars: officer bar, 1 in long (DAFI "1-inch"), width and gap read off CAPR 39-1 Fig A5-2 at that length
const BAR={len:1.0,w:0.32,gap:0.24,link_h:0.07};
function barGeometry(n){const W=n*BAR.w+(n-1)*BAR.gap;return {W,H:BAR.len,bbox:[-W/2,-BAR.len/2,W/2,BAR.len/2]};}
function drawBars(n,fill,stripes){return (ox,oy,id)=>{
  const g=barGeometry(n);let s='';
  for(let i=0;i<n;i++){const x=-g.W/2+i*(BAR.w+BAR.gap);
    if(stripes){ // flight officer: dark bar, silver outline, thin silver stripes
      s+=`<rect x="${f2(ox+x*U)}" y="${f2(oy-BAR.len/2*U)}" width="${f2(BAR.w*U)}" height="${f2(BAR.len*U)}" rx="2.5" fill="#0d2a4a" stroke="${THREAD.silver}" stroke-width="2"/>`;
      const sw=0.022*U,pitch=BAR.w*U/(stripes+1);
      for(let k=1;k<=stripes;k++)s+=`<rect x="${f2(ox+x*U+pitch*k-sw/2)}" y="${f2(oy-BAR.len/2*U+4)}" width="${f2(sw)}" height="${f2(BAR.len*U-8)}" fill="${THREAD.silver}"/>`;
    } else s+=`<rect x="${f2(ox+x*U)}" y="${f2(oy-BAR.len/2*U)}" width="${f2(BAR.w*U)}" height="${f2(BAR.len*U)}" rx="2.5" fill="${fill}"/>`;
  }
  if(n>1&&!stripes){ // Captain bars are joined by two short links (Fig A5-2)
    for(const fy of [-0.28,0.28])s+=`<rect x="${f2(ox+(-g.W/2+BAR.w)*U-1)}" y="${f2(oy+(fy-BAR.link_h/2)*U)}" width="${f2(BAR.gap*U+2)}" height="${f2(BAR.link_h*U)}" fill="${fill}"/>`;}
  return s;};}
function drawStars(n,R,vertical){return (ox,oy)=>{let s='';
  const h=R*(1+Math.cos(Math.PI/5)),pitch=vertical?h*1.0:2*R*Math.sin(2*Math.PI/5)*1.0;
  for(let i=0;i<n;i++){const off=(i-(n-1)/2)*pitch,cx=ox+(vertical?0:off*U),cy=oy+(vertical?off*U:0)+(h/2-R)*U;
    s+=`<polygon points="${poly(starPoints(cx,cy,R*U))}" fill="${THREAD.silver}"/>`;}
  return s;};}
function starGeometry(n,R,vertical){const h=R*(1+Math.cos(Math.PI/5)),w=2*R*Math.sin(2*Math.PI/5);
  const pitch=vertical?h:w;const tot=(n-1)*pitch;
  return vertical?{bbox:[-w/2,-(h+tot)/2,w/2,(h+tot)/2]}:{bbox:[-(w+tot)/2,-h/2,(w+tot)/2,h/2]};}
// traced shapes (oak leaf, eagle): scale so the largest dimension = 1 in
function tracedShape(name,use,minArea){
  const t=loadTrace(name),area=p=>{let a=0;for(let i=0;i<p.length;i++){const q=p[(i+1)%p.length];a+=p[i][0]*q[1]-q[0]*p[i][1];}return Math.abs(a/2);};
  // the cloth patch's pale edge highlight comes out as a thin ring spanning the whole crop: drop loops that span >80% of both
  // crop dimensions but fill <30% of their own bbox
  const nearEdge=p=>{let a=1e9,b=1e9,c=-1e9,d=-1e9;for(const q of p){a=Math.min(a,q[0]);c=Math.max(c,q[0]);b=Math.min(b,q[1]);d=Math.max(d,q[1]);}
    const ring=(c-a)>0.8*t.w&&(d-b)>0.8*t.h&&area(p)<0.3*(c-a)*(d-b);
    const m=0.1,nearB=a<m*t.w||c>(1-m)*t.w||b<m*t.h||d>(1-m)*t.h,thin=Math.min(c-a,d-b)<0.06*Math.min(t.w,t.h);
    return ring||(nearB&&thin);};
  const pick=(ks,shade)=>t.layers.filter(l=>ks.includes(l.k)&&l.loops.length).map(l=>({k:l.k,shade,loops:l.loops.filter(p=>area(p)>minArea&&!nearEdge(p))}));
  const keep=[...pick(use.thread,false),...pick(use.shade||[],true)];
  let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  for(const l of keep.filter(l=>!l.shade))for(const p of l.loops)for(const q of p){x0=Math.min(x0,q[0]);x1=Math.max(x1,q[0]);y0=Math.min(y0,q[1]);y1=Math.max(y1,q[1]);}
  const k=1.0/Math.max(x1-x0,y1-y0);        // inches per trace px: largest dimension = 1 in
  return {keep,k,cx:(x0+x1)/2,cy:(y0+y1)/2,w:(x1-x0)*k,h:(y1-y0)*k,bbox:[-(x1-x0)*k/2,-(y1-y0)*k/2,(x1-x0)*k/2,(y1-y0)*k/2]};
}
function drawTraced(shape,thread,shade){return (ox,oy)=>{
  const tr=q=>[ox+(q[0]-shape.cx)*shape.k*U,oy+(q[1]-shape.cy)*shape.k*U];
  let s='';
  for(const l of shape.keep){
    s+=`<path d="${l.loops.map(p=>'M'+p.map(q=>{const r=tr(q);return f2(r[0])+','+f2(r[1]);}).join('L')+'Z').join('')}" fill="${l.shade?shade:thread}" fill-rule="evenodd"/>`;}
  return s;};}
// NCO chevron patches from CAPR 39-1 Fig A5-4: navy field + light silver stripes + CAP + 3-blade prop

// Senior NCO chevron mounts by size (regulation audit 2026-10-13): Class A coat 4 in only (4.1.5.2.1.2); corporate shirts 3 1/2 in only (4.2.5.1.1.3,
// 4.2.6.2.3); mess dress white chevrons, male 4 in (4.1.1.1.1.4), female 3 1/2 or 4 in (4.1.2.1.1.4) -- built by build-mess-dress-grade.js.
function chevronMounts(w){
  const sleeve='centered on the outer arm halfway between the shoulder seam and the elbow bent at 90 degrees';
  const m=[];
  if(w===4) m.push({uniform:'Class A service dress coat (men\'s and women\'s, old and new style)',rule:'4 in chevron, '+sleeve+' (4.1.5.2.1.2); NCOs wear the coat without epaulets'});
  m.push({uniform:'Class B blue shirt / blouse, lightweight blue jacket, topcoat, service coat of 4.1.9',rule:'3 1/2 or 4 in chevron, '+sleeve+'; short-sleeved shirt: centered on the bottom edge of the sleeve; shoulder mark insignia not authorized (4.1.6.1.3, 4.1.9.3.3, 4.1.9.5.4, 6.1.3.3, 6.1.11.3.1)'});
  if(w===3.5) m.push({uniform:'Corporate service / aviator shirt',rule:'3 1/2 in chevron only, '+sleeve+' (long sleeve) or bottom edge of the sleeve (short sleeve) (4.2.5.1.1.3, 4.2.6.2.3)'});
  m.push({uniform:'ABU / BDU / blue field uniform coat',rule:'4 or 3 1/2 in, full color silver on dark blue, '+sleeve+'; need not be fully visible if sleeves are rolled (5.1.1.1.1.2, 5.1.2.2.3, 5.2.1.1.1.3)'});
  m.push({uniform:'Mess dress',rule:'white chevron, use rank-senior-<grade>-chevron-white-'+String(w).replace('.','p')+'in ('+(w===4?'men 4 in, women 3 1/2 or 4 in':'women only, 3 1/2 or 4 in')+'; 4.1.1.1.1.4, 4.1.2.1.1.4); this navy chevron is not worn on the mess dress'});
  m.push({uniform:'OCP coat / fleeces',rule:'grade device in metal on dark blue material (6.1.10.2.1, 6.1.14.4.1); use the ocp-square form where a 2 in square is required (7.1.1.2.1)'});
  return m;}
function buildChevron(key,name,abbrev,traceName,widthIn){
  const t=loadTrace(traceName);
  // silhouette bbox from the trace
  let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;for(const p of t.sil)for(const q of p){x0=Math.min(x0,q[0]);x1=Math.max(x1,q[0]);y0=Math.min(y0,q[1]);y1=Math.max(y1,q[1]);}
  const k=widthIn/(x1-x0),Wi=widthIn,Hi=(y1-y0)*k,W=Wi*U,H=Hi*U;
  const id=`rank-senior-${slug(key)}-chevron-${String(widthIn).replace('.','p')}in`;
  const tr=q=>[(q[0]-x0)*k*U,(q[1]-y0)*k*U];
  const d=ps=>ps.map(p=>'M'+p.map(q=>{const r=tr(q);return f2(r[0])+','+f2(r[1]);}).join('L')+'Z').join('');
  const stripes=t.layers.find(l=>l.k===1),navy=t.layers.find(l=>l.k===2);
  const bigStripes=stripes.loops.filter(p=>{let a=0,per=0;for(let i=0;i<p.length;i++){const q=p[(i+1)%p.length];a+=p[i][0]*q[1]-q[0]*p[i][1];per+=Math.hypot(q[0]-p[i][0],q[1]-p[i][1]);}
    return Math.abs(a/2)>150&&2*Math.abs(a/2)/per>10;});   // anti-alias slivers along the edge are thin (2A/P < 10 px at 4x)
  // CAP Command Chief (interim change letter, Fig A5-4 addition): the Chief Master Sergeant chevron with a star in the field where "CAP" sits
  const cmd=key==='command-chief';
  const inLetters=p=>{const xs=p.map(q=>(q[0]-x0)/(x1-x0)),ys=p.map(q=>(q[1]-y0)/(y1-y0));return Math.min(...xs)>0.35&&Math.max(...xs)<0.67&&Math.min(...ys)>0.41&&Math.max(...ys)<0.50;};
  const stripeLoops=cmd?bigStripes.filter(p=>!inLetters(p)):bigStripes;
  let star='';
  if(cmd){const cx=(x0+x1)/2,cy=y0+0.452*(y1-y0),R=0.072*(x1-x0),r=R*0.382,pts=[];   // measured on the interim-change figure: star ~0.14 of chevron width, centred at ~0.45 of height
    for(let i=0;i<10;i++){const ang=-Math.PI/2+i*Math.PI/5,rr=i%2?r:R;pts.push([cx+rr*Math.cos(ang),cy+rr*Math.sin(ang)]);}
    star=`<g id="${id}__star"><path d="${d([pts])}" fill="#dadadc"/></g>`;}
  const body=`<g id="${id}__field"><path d="${d(t.sil)}" fill="${t.navy||'#292540'}" fill-rule="evenodd"/></g><g id="${id}__stripes"><path d="${d(stripeLoops)}" fill="#dadadc" fill-rule="evenodd"/></g>${star}`;
  const an={...stdAnchors(W,H),visual_center:[W/2,H/2]};
  const R=root({id,name:`${name} chevron, ${widthIn} in`,wIn:Wi,hIn:Hi,source:'regulation',body,
    meta:{size_source:'regulation',size_citation:'CAPR 39-1 (3 March 2020) Figure A5-4: "Chevrons are available in 3 1/2 and 4 inch sizes"; width = nominal chevron size, height from the figure proportion',
      anchors:Object.fromEntries(Object.entries(an).map(([kk,v])=>[kk,r2(v)])),
      dimensions:{form:'embroidered chevron patch',nominal_width_in:widthIn,height_in:+Hi.toFixed(4),aspect_h_over_w:+(Hi/Wi).toFixed(4),
        navy_hex:t.navy||'#292540',stripe_hex:'#dadadc',letters:cmd?'none (star in place of CAP)':'CAP',emblem:'3-blade propeller'},
      mounts:chevronMounts(widthIn),
      traced_from:{figure:'CAPR 39-1 Fig A5-4 (embedded raster 1123 x 1638)',method:'4x bicubic upsample, 3-class k-means, marching squares, RDP+Chaikin',px_per_in:+(1/k).toFixed(2)},
      rank:{grade:name,abbrev,membership:'senior'},grade:'rank-insignia'}});
  R.spec.fit={method:'trace of the regulation figure',score:null};write(id,R);return id;
}

// ---------------------------------------------------------------- run
const made={metal:[],thread:[],bordered:[],ocp:[]};
for(const [g,name] of GRADES.map(x=>[x[0],x[1]])){
  for(const size of ['regular','miniature']){
    made.metal.push(buildMetal(size,g,name));
    made.thread.push(buildThread(size,g,name,'row'));
    made.bordered.push(buildBordered(size,g,name));
  }
  made.ocp.push(buildOcpSquare(g,name));
}
buildBlankSquare();

// ---- senior NCO chevrons (Fig A5-4): 3 1/2 and 4 in
const NCO=[['chief-master-sergeant','Chief Master Sergeant','CMSgt','nco_cmsgt'],['senior-master-sergeant','Senior Master Sergeant','SMSgt','nco_smsgt'],
  ['master-sergeant','Master Sergeant','MSgt','nco_msgt'],['technical-sergeant','Technical Sergeant','TSgt','nco_tsgt'],['staff-sergeant','Staff Sergeant','SSgt','nco_ssgt'],
  ['command-chief','CAP Command Chief Master Sergeant','CCM','nco_cmsgt']];
for(const [key,name,abbr,tr] of NCO)for(const w of [3.5,4])buildChevron(key,name,abbr,tr,w);

// ---- officers: bars
const EST_BAR='1 in long per DAFI 36-2903 7.1.5.1 ("1-inch metal rank insignia"); width/gap read off CAPR 39-1 Fig A5-2 at that length (not dimensioned in either document)';
const EST_NOTE='Sizes other than the star diameter are not stated in inches by CAPR 39-1 or DAFI 36-2903; proportions come from CAPR 39-1 Fig A5-2.';
const MOUNT_OFF=[
  {uniform:'OCP coat',rule:'2 in x 2 in dark blue square, center of chest. Generals: stars 1 in (3/4 in if unable), stacked vertically, one point up each; Colonel eagle centered horizontally, beak toward the wearer\'s right shoulder (viewer\'s left); Major / Lt Col stem toward the ground; Flight Officer / Lt / Capt bars with the long end vertical (7.1.1.2.1). Asset baseline = this orientation, rotation 0.',placement:{rotate_deg:0}},
  {uniform:'green / black fleece (front)',rule:'dark blue material on the front: generals positioned HORIZONTALLY with one point of each star up (use the -horizontal form); Colonel centered horizontally, beak toward the wearer\'s right shoulder; Major / Lt Col stem toward the ground; bars long end vertical (6.1.10.2.1, 6.1.14.4.1)',placement:{rotate_deg:0}},
  {uniform:'ABU / BDU / blue field coat collar',rule:'light silver on dark blue cloth (2d Lt and Major gold), 1/8 in of blue showing past the widest and tallest point, centered 1 in from the bottom of the collar. Generals: stars centered, perpendicular to the collar (use the -horizontal form); Colonel centered, perpendicular to the collar, eagle facing forward; Lt Col / Major: stem parallel to the ground pointing AWAY from the wearer\'s neck = rotate the asset 90 degrees (+90 cw on the wearer\'s right collar so the stem points to the viewer\'s left, -90 on the left collar); Flight Officer / Lt / Capt: long end centered (5.1.1.1.1.1, 5.1.2.2.1, 5.2.1.1.1.1)',placement:{rotate_deg_by_grade:{major:90,'lieutenant-colonel':90},note:'+90 = clockwise on the wearer\'s right collar; mirror the rotation (-90) on the left collar; other grades 0'}},
  {uniform:'OCP / ABU / BDU / blue field / navy tactical cap (front)',rule:'officers only (NCOs wear none, 7.1.1.8, 6.2.11.1): rank sewn or Velcro, centered 1/2 in from the visor (patrol/tactical OCP 7.1.1.8; ABU 5.1.1.2; blue field cap 5.2.1.1.1.2), only 1/8 in of blue showing past the widest and tallest point; silver on dark blue, 2d Lt and Major gold (6.2.11.1)',placement:{rotate_deg:0}},
  {uniform:'USAF-style flight duty uniform (FDU) / green flight jacket',rule:'cloth-bordered form: dark blue cloth with silver or gold embroidery replaces the plastic-encased grade. Officers: centered on top of each shoulder, bottom edge of the insignia 1/2 in from the shoulder seam (8.2.3.2). Generals: 1 in stars (3/4 in optional) centered on the shoulder halfway between neck and shoulder seam (8.2.3.1). NCOs and cadets wear none (8.2.3.3).',placement:{rotate_deg:0}},
  {uniform:'Corporate flight duty uniform (CFDU)',rule:'plastic-encased or full-color grade embroidered on dark blue background, same placement as the FDU (8.3.3.2); NCOs and cadets: none (8.3.3.3)',placement:{rotate_deg:0}},
  {uniform:'Class A service coat (with epaulets), Class B blue shirt / blouse, corporate aviator shirt, jackets',rule:'officers: embroidered grade on the slip-on gray epaulet sleeve, see rank-epaulet-sleeve-gray-*; Colonel eagle beak facing forward; Lt Col / Major stem points away from the collar; bars lie across the sleeve (4.1.5.2.1.1, 4.1.6.1.1-2, 4.1.1.1.1.3, 4.2.5.1.1.1-2)',placement:{via:'rank-epaulet-sleeve-gray-*',anchor:{single_forms:'garment anchor rank_rule_point_left/right (Class B, mess) or rank_rule_point_left_center/right_center (Class A coat): 5/8 in from the outer end of the epaulet (DAFI 4.5.1.1.1); the slot container is 2.3 in along the strap and its centre sits about 0.6 in inboard of that point',multi_star_generals:'garment rank_slot_*_center (Brig Gen single star at the rule point; Maj Gen pair stacked along the strap at the slot centre)'},when_placing_a_loose_piece_in_a_garment_rank_slot:'rotate so the Major / Lt Col stem points along the strap toward the arm end: rotate_deg = strap_angle_deg - 90 (strap angle measured from +x toward +y, about 14 deg on the Class A coat, 21 deg on the Class B shirt); bars lie across the strap: rotate_deg = strap_angle_deg; Colonel: regulation says only "beak facing forward" (4.1.6.1.2); the asset is drawn beak toward the viewer\'s left, keep it unrotated'}},
  {uniform:'Mess dress shoulder boards',rule:'bullion grade on the board with 1/2 in dark blue braid down each side, as close to the shoulder seam as possible; Colonel beak forward; Lt Col / Major stem away from the collar (4.1.1.1.1.1-3, 4.1.2.1.1.1-3). Use rank-senior-<grade>-bullion (build-mess-dress-grade.js).',placement:{rotate_deg:0,via:'rank-senior-<grade>-bullion'}},
  {uniform:'Corporate blazer',rule:'no epaulet sleeve; optional grade on the blazer nameplate for officers and NCOs, not for cadets (4.2.3.1.1.2, 4.2.4.1.1.2)'}]
const barOpts=(key,name,abbrev,n,fill,stripes)=>emitThreeForms({key,name,abbrev,membership:'senior',bbox:barGeometry(n).bbox,drawThread:drawBars(n,fill,stripes),
  sizeSource:'estimated',sizeBasis:EST_BAR,estimated:EST_NOTE,mountNote:MOUNT_OFF,
  extraDims:{bar_count:n,bar_length_in:BAR.len,bar_width_in:BAR.w,gap_in:n>1?BAR.gap:0,long_end:'vertical (OCP)',thread:stripes?'navy with silver stripes':(fill===THREAD.gold?'gold':'light silver')}});
barOpts('second-lieutenant','Second Lieutenant','2d Lt',1,THREAD.gold);
barOpts('first-lieutenant','First Lieutenant','1st Lt',1,THREAD.silver);
barOpts('captain','Captain','Capt',2,THREAD.silver);
barOpts('flight-officer','Flight Officer','FO',1,null,1);
barOpts('technical-flight-officer','Technical Flight Officer','TFO',1,null,2);
barOpts('senior-flight-officer','Senior Flight Officer','SFO',1,null,3);

// ---- generals: stars (1 in, or 3/4 in if unable to wear 1 in; CAPR 39-1 7.1.1.2.1)
for(const [R,tag] of [[0.5,'1in'],[0.375,'3-4in']]){
  const diam=R*2;
  const base={membership:'senior',sizeSource:'regulation',cite:'CAPR 39-1 (3 March 2020) 7.1.1.2.1 and 5.1.1.1.1.1: General Officers wear 1-inch stars; those unable wear 3/4-inch stars (point-to-point diameter)',
    mountNote:MOUNT_OFF,extraDims:{star_diameter_in:diam,points:5,thread:'light silver'}};
  emitThreeForms({...base,key:`brigadier-general-${tag}`,name:'Brigadier General',abbrev:'Brig Gen',bbox:starGeometry(1,R,true).bbox,drawThread:drawStars(1,R,true)});
  emitThreeForms({...base,key:`major-general-${tag}-vertical`,name:'Major General (stars stacked, one point up each)',abbrev:'Maj Gen',bbox:starGeometry(2,R,true).bbox,drawThread:drawStars(2,R,true),
    extraDims:{...base.extraDims,count:2,arrangement:'vertical (OCP chest, shoulder)'}});
  emitThreeForms({...base,key:`major-general-${tag}-horizontal`,name:'Major General (stars side by side)',abbrev:'Maj Gen',bbox:starGeometry(2,R,false).bbox,drawThread:drawStars(2,R,false),
    extraDims:{...base.extraDims,count:2,arrangement:'horizontal (collar)'}});
}

// ---- oak leaves and eagle: traced from CAPR 39-1 Fig A5-2 (about 70 px per insignia in the source: LOW FIDELITY, flagged)
const LOWRES='Traced from the embedded raster of CAPR 39-1 Fig A5-2 (about 70-100 px across); outline is smooth but small features are approximate. Replace with a higher-resolution source when one is available.';
// Oak leaf (Major gold, Lt Col silver). Parametric, measured on the Fig A5-2 Major and Lt Col leaves (read at 3x from the embedded raster):
// a 7-pointed leaf, nearly mirror-symmetric: tall top lobe, upper / mid / lower lobe pair, stem pointing down, veins radiating from a hub
// just above centre. Coordinates below are in the 900 px measuring view (leaf height 72..865 = 793 units = 1 in), centre line x=460.
const OAK=(()=>{
  const cx=460,T=72,B=865,H=793;
  // [half-width from centre line, y] for each right-hand vertex, clockwise from the top tip; left side mirrors
  const R=[[0,72],[125,212],[307,240],[288,425],[357,548],[235,622],[226,780],[35,748],[35,865]];
  const left=R.slice().reverse().slice(0,-1).map(([w,y])=>[-w,y]).filter((q,n,a)=>n<a.length);
  const right=R.slice(1);
  const pts=[R[0],...R.slice(1).map(([w,y])=>[w,y])];
  // clockwise polygon: top, right vertices, stem bottom right, stem bottom left, then mirrored left vertices up to the top
  const poly=[[0,72],...R.slice(1).map(([w,y])=>[w,y]),...R.slice(1).reverse().map(([w,y])=>[-w,y])];
  const hub=[12,488];
  const veins=[[0,112],[-275,262],[275,262],[-325,545],[325,545],[-200,740],[200,740],[10,820],   // tips + stem
    [-110,235],[110,235],[-255,430],[255,430],[-215,612],[215,612]];                                              // lobe-separating veins toward the notches
  // inward offset of the outline (the satin border line seen on the figure): move every edge d units toward the inside
  const inset=(P,d)=>P.map((q,n)=>{const a=P[(n+P.length-1)%P.length],b=P[(n+1)%P.length];
    const nrm=(u,v)=>{const dx=v[0]-u[0],dy=v[1]-u[1],l=Math.hypot(dx,dy);return [dy/l,-dx/l];};   // inward for clockwise (y down)
    const n1=nrm(a,q),n2=nrm(q,b),mx=n1[0]+n2[0],my=n1[1]+n2[1],k=2/(mx*mx+my*my)*d/ (1) ;
    const s=d/ (1+(n1[0]*n2[0]+n1[1]*n2[1]))*1;
    const ox=(n1[0]+n2[0])*s,oy=(n1[1]+n2[1])*s,m=Math.hypot(ox,oy),cap=2*Math.abs(d);   // clamp the miter on sharp corners
    return m>cap?[q[0]+ox/m*cap,q[1]+oy/m*cap]:[q[0]+ox,q[1]+oy];});
  return {cx,T,B,H,poly,hub,veins,inner:inset(poly.filter(q=>!(q[1]>760&&Math.abs(q[0])<=35)),-15),w:714,bbox:[-357/H,-H/2/H,357/H,H/2/H]};
})();
function drawOak(fill,line){return (ox,oy)=>{          // ox,oy = centre of the leaf bounding box in user units
  const k=U/OAK.H,midY=(OAK.T+OAK.B)/2;
  const t=q=>[ox+q[0]*k,oy+(q[1]-midY)*k], pt=P=>P.map(q=>{const r=t(q);return f2(r[0])+','+f2(r[1]);}).join('L');
  const sw=f2(0.9*k*10);                                 // vein stroke ~0.011 in
  let s=`<path d="M${pt(OAK.poly)}Z" fill="${fill}" stroke="${fill}" stroke-width="${f2(0.5)}" stroke-linejoin="round"/>`;
  s+=`<path d="M${pt(OAK.inner)}Z" fill="none" stroke="${line}" stroke-width="${f2(0.8)}" stroke-linejoin="miter"/>`;
  s+=`<path d="${OAK.veins.map(v=>'M'+pt([OAK.hub])+'L'+pt([v])).join('')}" fill="none" stroke="${line}" stroke-width="${f2(0.8)}" stroke-linecap="round"/>`;
  return s;};}
{ const bb=[-OAK.w/2/OAK.H,-0.5,OAK.w/2/OAK.H,0.5];
  const common={membership:'senior',bbox:bb,sizeSource:'estimated',
    sizeBasis:'Largest dimension 1 in (DAFI 36-2903 7.1.5.1 "1-inch metal rank insignia"); outline measured on CAPR 39-1 Fig A5-2 (leaf is 0.90 in wide at 1 in tall)',
    estimated:'Outline vertices and vein hub read from the figure (about 90 px across in the source); mirror-symmetrised. Veins are simplified to hub-to-tip lines.',mountNote:MOUNT_OFF};
  emitThreeForms({...common,key:'lieutenant-colonel',name:'Lieutenant Colonel',abbrev:'Lt Col',drawThread:drawOak(THREAD.silver,THREAD.silverShade),
    extraDims:{shape:'oak leaf',stem:'toward the ground (OCP, 7.1.1.2.1); away from the collar on shoulder marks',thread:'light silver'}});
  emitThreeForms({...common,key:'major',name:'Major',abbrev:'Maj',drawThread:drawOak(THREAD.gold,THREAD.goldShade),
    extraDims:{shape:'oak leaf',stem:'toward the ground (OCP, 7.1.1.2.1)',thread:'gold'}}); }
// Colonel eagle: silhouette traced from the Colonel epaulet sleeve in Fig A5-1 (3x render of a ~100 px raster; mask-trace + 2 Chaikin passes).
// Silhouette from the ~93 px raster plus structure lines read from its stitch-valley map (two chest-band gaps, shield stripes, two wing row separators, feather notch separations). Arrows and branch stay merged blobs. Flagged low fidelity.
// Size: 178 px/in (the 1 in oak leaf on the Major sleeve in the same figure) -> 1.34 x 0.68 in. Head turned to the wearer's right (beak forward, 7.1.3.1.1).
const EAGLE=(()=>{const t=JSON.parse(fs.readFileSync(path.join(TR,'eagle_col.json')));   // built by base-art/board/eagle-detail.js
  const all=[...t.loops[0],...t.fills.flat(),...t.leaves.flat()],xs=all.map(q=>q[0]),ys=all.map(q=>q[1]),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys),k=1/178;
  return {loops:t.loops,fills:t.fills,leaves:t.leaves,veins:t.veins,lines:t.lines,cx:(x0+x1)/2,cy:(y0+y1)/2,k,w:(x1-x0)*k,h:(y1-y0)*k,bbox:[-(x1-x0)*k/2,-(y1-y0)*k/2,(x1-x0)*k/2,(y1-y0)*k/2]};})();
const drawEagle=(fill,line)=>(ox,oy)=>{const tr=q=>{const r=[ox-(q[0]-EAGLE.cx)*EAGLE.k*U,oy+(q[1]-EAGLE.cy)*EAGLE.k*U];return f2(r[0])+','+f2(r[1]);};   // x MIRRORED: the figure trace has the beak toward the viewer's right, the regulation text (6.1.14.4.1) puts it toward the wearer's right = viewer's left; decision 2026-10-13
  const P=a=>a.map(p=>'M'+p.map(tr).join('L')+'Z').join('');
  return `<path d="${P(EAGLE.loops)}" fill="${fill}" fill-rule="evenodd"/><path d="${P(EAGLE.fills)}" fill="${fill}"/><path d="${P(EAGLE.leaves)}" fill="${fill}" stroke="${line}" stroke-width="0.9" stroke-linejoin="round"/>`
    +`<path d="${[...EAGLE.lines,...EAGLE.veins].map(l=>'M'+l.map(tr).join('L')).join('')}" fill="none" stroke="${line}" stroke-width="0.7" stroke-linecap="round" stroke-linejoin="round"/>`;};
emitThreeForms({key:'colonel',name:'Colonel',abbrev:'Col',membership:'senior',bbox:EAGLE.bbox,drawThread:drawEagle(THREAD.silver,THREAD.silverShade),
  sizeSource:'estimated',sizeBasis:'Eagle width 1.34 in: scaled with the 1 in oak leaf on the Major sleeve in CAPR 39-1 Fig A5-1 (178 px/in); shape traced from the Colonel sleeve in the same figure',
  estimated:'Silhouette + structure lines from a ~93 px source raster (wings, head, shield); the three arrows and the 15-leaf olive branch are rebuilt as individual shapes at the figure positions because the raster merges them. Replace with a higher-resolution eagle when one is available.',mountNote:MOUNT_OFF,
  extraDims:{shape:'eagle, wings spread, head to the wearer\'s right (beak forward)',thread:'light silver',orientation:'beak points toward the wearer\'s right shoulder = the viewer\'s LEFT on a front view (regulation text: CAPR 39-1 6.1.14.4.1 and the OCP/ABU grade rules, DAFI 36-2903 7.1.3.1.1, 4.5.1.1.3). The figures (A5-1/A5-2) draw the beak toward the viewer\'s right; the traced art is MIRRORED to follow the text (Ethan, 2026-10-13)'}});


// ---- cadet NCO / Airman metal chevrons (Fig A5-5). Traced from the embedded figure at 4x: low-res (176 px per chevron) but the
// chevron bands trace cleanly; the shield is simplified to its colour blobs. Physical size is NOT in the regulation.
// Size anchor (from Ethan, 2026-10-12): the Cadet Chief Master Sergeant chevron nearly fills the 2 in OCP square, with ~1/16 to 1/8 in of
// blue top and bottom. Using 1/8 in: CMSgt height = 2 - 2*(1/8) = 1.75 in. All grades share one width (the figures were normalised in
// height; widths agree at the common scale), so width = 1.75 / (CMSgt height-over-width).
const CN_CM=(()=>{const t=JSON.parse(fs.readFileSync(path.join(TR,'vt_CMSgt.json')));let a=1e9,b=-1e9,c=1e9,d=-1e9;
  for(const p of t.sil)for(const q of p){a=Math.min(a,q[0]);b=Math.max(b,q[0]);c=Math.min(c,q[1]);d=Math.max(d,q[1]);}return (d-c)/(b-a);})();
const CN_H_CMSGT_IN=OCP_SQUARE_IN-2*BORDER_IN;
const CN_W_IN=+(CN_H_CMSGT_IN/CN_CM).toFixed(4);
const CN_EST='Chevron width '+CN_W_IN+' in derived from the requester\'s statement that the Cadet CMSgt chevron fills the 2 in OCP square leaving about 1/8 in top and bottom (CMSgt height 1.75 in); CAPR 39-1 Fig A5-5 gives no inch size. Shape traced from the figure.';

// --- clean-up for traced loops: mirror-average about the figure's vertical axis (chevrons are symmetric), then RDP to straight segments.
function rdpClosed(pts,e){
  const rdp=(P,e)=>{if(P.length<3)return P;let dm=0,ix=0;const a=P[0],b=P[P.length-1];
    for(let i=1;i<P.length-1;i++){const p=P[i],num=Math.abs((b[0]-a[0])*(a[1]-p[1])-(a[0]-p[0])*(b[1]-a[1])),den=Math.hypot(b[0]-a[0],b[1]-a[1])||1,v=num/den;if(v>dm){dm=v;ix=i;}}
    if(dm>e)return rdp(P.slice(0,ix+1),e).slice(0,-1).concat(rdp(P.slice(ix),e));return [a,b];};
  // split closed loop at its two farthest points so both halves are open curves
  let bi=0,bj=0,bd=-1;for(let i=0;i<pts.length;i+=Math.max(1,pts.length>200?3:1))for(let j=i+1;j<pts.length;j+=Math.max(1,pts.length>200?3:1)){const d=(pts[i][0]-pts[j][0])**2+(pts[i][1]-pts[j][1])**2;if(d>bd){bd=d;bi=i;bj=j;}}
  const A=pts.slice(bi,bj+1),B=pts.slice(bj).concat(pts.slice(0,bi+1));
  return rdp(A,e).slice(0,-1).concat(rdp(B,e).slice(0,-1));
}
function mirrorAverage(loops,axis){
  // pair each loop with the loop whose mirror image overlaps it best; average nearest points; self-paired loops are averaged with their own mirror
  const bb=p=>{let a=1e9,b=-1e9,c=1e9,d=-1e9;for(const q of p){a=Math.min(a,q[0]);b=Math.max(b,q[0]);c=Math.min(c,q[1]);d=Math.max(d,q[1]);}return [a,b,c,d];};
  const mir=p=>p.map(q=>[2*axis-q[0],q[1]]);
  return loops.map(L=>{
    const mb=bb(mir(L));let best=null,bs=1e9;
    for(const O of loops){const ob=bb(O),sc=Math.abs(ob[0]-mb[0])+Math.abs(ob[1]-mb[1])+Math.abs(ob[2]-mb[2])+Math.abs(ob[3]-mb[3]);if(sc<bs){bs=sc;best=O;}}
    if(!best||bs>40)return L;                       // no mirror partner: leave alone
    const M=mir(best);                              // partner mirrored onto this loop
    return L.map(q=>{let d=1e9,m=q;for(const r of M){const dd=(r[0]-q[0])**2+(r[1]-q[1])**2;if(dd<d){d=dd;m=r;}}return d<64?[(q[0]+m[0])/2,(q[1]+m[1])/2]:q;});});
}

function buildCadetChevron(key,name,abbrev,traceName,half,diamond){
  const t=loadTrace(traceName);
  const area=p=>{let a=0;for(let i=0;i<p.length;i++){const q=p[(i+1)%p.length];a+=p[i][0]*q[1]-q[0]*p[i][1];}return Math.abs(a/2);};
  const bbox=ps=>{let a=1e9,b=-1e9,c=1e9,d=-1e9;for(const p of ps)for(const q of p){a=Math.min(a,q[0]);b=Math.max(b,q[0]);c=Math.min(c,q[1]);d=Math.max(d,q[1]);}return [a,b,c,d];};
  const big=t.sil.slice().sort((a,b)=>area(b)-area(a))[0];
  const [x0,x1,y0,y1]=bbox([big]);
  const axis=(x0+x1)/2,k=CN_W_IN/(x1-x0),Wi=CN_W_IN,Hi=(y1-y0)*k,W=Wi*U,H=Hi*U;
  const id=`rank-cadet-nco-${slug(key)}${diamond===null?'':(diamond?'-first-sergeant':'-plain')}-metal`;
  const tr=q=>[(q[0]-x0)*k*U,(q[1]-y0)*k*U];
  const d=ps=>ps.map(p=>'M'+p.map(q=>{const r=tr(q);return f2(r[0])+','+f2(r[1]);}).join('L')+'Z').join('');
  const NAVY='#010066',SILVER='url(#'+id+'__chrome)',RED='#d03638',GRAY='#9aa0a6',STAR='#d6dadb';   // colours sampled from the Vanguard cadet chevron photos
  // shield zone: measured in the trace (red stripes + padding); the parametric shield below covers it
  const red=t.red,rx0=red.x0,rx1=red.x1,ry0=red.y0,ry1=red.y1;
  const sw=(rx1-rx0)*1.13,scx=(rx0+rx1)/2,sTop=ry0-(ry1-ry0)*0.60,sBot=ry1+(ry1-ry0)*0.16,sH=sBot-sTop;
  // ---- idealise: every band is a graph over x. Fit its upper and lower edge as y = c0 + c1*u + c2*u^2 (u = |x-axis|): V shapes are
  // linear in u, rockers quadratic. Left pieces are mirrored to the right so the result is exactly symmetric and free of photo noise.
  const envelope=(L,xa,xb,N)=>{const Uu=[],Lw=[];
    for(let i=0;i<=N;i++){const x=xa+(xb-xa)*i/N;let lo=1e9,hi=-1e9;
      for(let j=0;j<L.length;j++){const p1=L[j],p2=L[(j+1)%L.length];if((p1[0]-x)*(p2[0]-x)<=0&&p1[0]!==p2[0]){const u=(x-p1[0])/(p2[0]-p1[0]),y=p1[1]+u*(p2[1]-p1[1]);lo=Math.min(lo,y);hi=Math.max(hi,y);}}
      if(lo<1e8){Uu.push([x,lo]);Lw.push([x,hi]);}}
    return {U:Uu,Lw};};
  const fitQuad=pts=>{const S_=[[0,0,0],[0,0,0],[0,0,0]],B_=[0,0,0];
    for(const [x,y] of pts){const u=Math.abs(x-axis),v=[1,u,u*u];for(let i=0;i<3;i++){B_[i]+=v[i]*y;for(let j=0;j<3;j++)S_[i][j]+=v[i]*v[j];}}
    const m=S_.map((r,i)=>[...r,B_[i]]);
    for(let i=0;i<3;i++){let pv=i;for(let r=i+1;r<3;r++)if(Math.abs(m[r][i])>Math.abs(m[pv][i]))pv=r;[m[i],m[pv]]=[m[pv],m[i]];
      if(Math.abs(m[i][i])<1e-9)return null;for(let r=0;r<3;r++)if(r!==i){const f=m[r][i]/m[i][i];for(let c=i;c<4;c++)m[r][c]-=f*m[i][c];}}
    return [m[0][3]/m[0][0],m[1][3]/m[1][1],m[2][3]/m[2][2]];};
  const evalQ=(c,x)=>{const u=Math.abs(x-axis);return c[0]+c[1]*u+c[2]*u*u;};
  const minX=L=>Math.min(...L.map(q=>q[0])),maxX=L=>Math.max(...L.map(q=>q[0]));
  const idealize=L=>{const xa=minX(L),xb=maxX(L),N=64,{U:Uu,Lw}=envelope(L,xa,xb,N);if(Uu.length<10)return null;
    const cu=fitQuad(Uu),cl=fitQuad(Lw);if(!cu||!cl)return null;
    const xs=[];for(let i=0;i<=N;i++)xs.push(xa+(xb-xa)*i/N);if(xa<axis&&xb>axis)xs.push(axis);xs.sort((p,q)=>p-q);
    return xs.map(x=>[x,evalQ(cu,x)]).concat(xs.map(x=>[x,evalQ(cl,x)]).reverse());};
  const mir=P=>P.map(q=>[2*axis-q[0],q[1]]);
  const W0=x1-x0;
  const pieces=[];
  for(const L of t.bands.filter(p=>area(p)>260)){
    const xa=minX(L),xb=maxX(L),cx=(xa+xb)/2,spans=xa<axis-0.03*W0&&xb>axis+0.03*W0;
    if(spans){const P0=idealize(L);if(P0)pieces.push(P0);}
    else if(cx<axis){const P0=idealize(L);if(P0)pieces.push(P0,mir(P0));}}
  const silIdeal=(()=>{const P0=idealize(big);return P0||big;})();
  const bands=pieces;
  let body=`<defs><linearGradient id="${id}__chrome" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eceeee"/><stop offset=".5" stop-color="#b9bebd"/><stop offset="1" stop-color="#8f9594"/></linearGradient></defs><g id="${id}__field"><path d="${d([silIdeal])}" fill="${NAVY}"/></g><g id="${id}__bands"><path d="${d(bands)}" fill="${SILVER}" fill-rule="evenodd"/></g>`;
  if(diamond){ // first sergeant diamond, centred in the blank field between the upper chevrons and the shield
    let low=y0;for(const P0 of pieces){const mid=P0.filter(q=>Math.abs(q[0]-axis)<1.5);if(mid.length&&minX(P0)<axis&&maxX(P0)>axis&&P0.length>10)low=Math.max(low,...mid.map(q=>q[1]).filter(v=>v<sTop-5));}
    const cy=(low+sTop)/2,dw=0.12*W0,dh=0.068*W0;
    const dp=[[axis,cy-dh],[axis+dw,cy],[axis,cy+dh],[axis-dw,cy]];
    body+=`<g id="${id}__diamond"><path d="${d([dp])}" fill="${SILVER}"/></g>`;
  }
  // ---- parametric shield (local coords in trace px, mapped through tr)
  const sh=(u,v)=>tr([scx+u*sw/2,sTop+v*sH]);        // u in [-1,1], v in [0,1]
  const P=pts=>pts.map(([u,v])=>{const r=sh(u,v);return f2(r[0])+','+f2(r[1]);});
  const shieldPath=(inset)=>{const e=inset;const pts=[[-1+e,0+e*0.6],[1-e,0+e*0.6],[1-e,0.58],[0.8-e,0.80],[0.45,0.94-e*0.3],[0,1-e*0.5],[-0.45,0.94-e*0.3],[-0.8+e,0.80],[-1+e,0.58]];return 'M'+P(pts).join('L')+'Z';};
  body+=`<g id="${id}__shield"><path d="${shieldPath(-0.10)}" fill="${NAVY}"/><path d="${shieldPath(-0.06)}" fill="${SILVER}"/><path d="${shieldPath(0.0)}" fill="${NAVY}"/>`;
  // blue chief with two rows of stars
  const chiefH=0.30,cu=(u)=>u;
  body+=`<path d="M${P([[-1,0],[1,0],[1,chiefH],[-1,chiefH]]).join('L')}Z" fill="${NAVY}"/>`;
  const starPoly=(cu_,cv,r)=>{const pts=[];for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,rr=i%2?r*0.42:r;pts.push([cu_+rr*Math.cos(a),cv+rr*Math.sin(a)*(sw/sH)]);}return 'M'+P(pts).join('L')+'Z';};
  let st='';for(const [n,cv] of [[7,0.085],[6,0.215]])for(let i=0;i<n;i++){const step=1.56/6,u=n===7?-0.78+i*step:-0.78+step/2+i*step;st+=starPoly(u,cv,0.075);}
  body+=`<path d="${st}" fill="${SILVER}"/>`;
  // seven vertical stripes below the chief: red / white alternating, clipped to the shield outline
  const clip=`${id}__shieldclip`;
  body=body.replace(`<g id="${id}__shield">`,`<g id="${id}__shield">`);
  let stripes='';for(let i=0;i<7;i++){const u0=-1+i*(2/7),u1=u0+2/7;stripes+=`<path d="M${P([[u0,chiefH],[u1,chiefH],[u1,1],[u0,1]]).join('L')}Z" fill="${i%2===0?RED:SILVER}"/>`;}
  body+=`<clipPath id="${clip}"><path d="${shieldPath(0.02)}"/></clipPath><g clip-path="url(#${clip})">${stripes}</g>`;
  // three-blade propeller (one up, two down-left / down-right), light gray with darker edge
  {const hc=sh(0,0.50),L=(sH*0.34*k*U),w=L*0.30,ang=[-90,30,150];
   for(const a of ang){const th=a*Math.PI/180,ux=Math.cos(th),uy=Math.sin(th),vx=-uy,vy=ux;
     const pts=[[hc[0]+vx*w*0.25,hc[1]+vy*w*0.25],[hc[0]+ux*L*0.55+vx*w*0.5,hc[1]+uy*L*0.55+vy*w*0.5],[hc[0]+ux*L+vx*w*0.28,hc[1]+uy*L+vy*w*0.28],[hc[0]+ux*L-vx*w*0.28,hc[1]+uy*L-vy*w*0.28],[hc[0]+ux*L*0.55-vx*w*0.5,hc[1]+uy*L*0.55-vy*w*0.5],[hc[0]-vx*w*0.25,hc[1]-vy*w*0.25]];
     body+=`<path d="M${pts.map(q=>f2(q[0])+','+f2(q[1])).join('L')}Z" fill="${GRAY}" stroke="#5f5f7c" stroke-width="0.6" stroke-linejoin="round"/>`;}
   body+=`<circle cx="${f2(hc[0])}" cy="${f2(hc[1])}" r="${f2(w*0.22)}" fill="${GRAY}" stroke="#5f5f7c" stroke-width="0.6"/>`;}
  body+='</g>';
  const an={...stdAnchors(W,H),visual_center:[W/2,H/2]};
  const R=root({id,name:`${name} metal chevron${diamond?' with first sergeant diamond':''}`,wIn:Wi,hIn:Hi,source:'reference-art-measured',body,
    meta:{size_source:'estimated',size_basis:CN_EST,
      anchors:Object.fromEntries(Object.entries(an).map(([kk,v])=>[kk,r2(v)])),
      dimensions:{form:'metal chevron (cadet NCO / Airman)',nominal_width_in:Wi,height_in:+Hi.toFixed(4),first_sergeant_diamond:!!diamond},
      mounts:[{uniform:'Class A coat lapels, Class B / blue shirt collars, ABU coat collar',rule:'both sides, 1 in from and parallel to the front of the collar, centered; on lapels halfway up the seam (4.1.5.2.1.4, 4.1.6.1.5, 5.1.1.1.1.4, A5-5). Mirrored pair; Airman Basic wears none.'},
              {uniform:'OCP coat',rule:'metal device on the 2 in dark blue square (7.1.1.2.2)'}],
      traced_from:{figure:'CAPR 39-1 Fig A5-5',method:'bands: sub-pixel iso-contour of the figure (soft-trace.js); shield, stars and propeller: parametric, placed from the figure',px_per_in:+(1/k/4).toFixed(2)},
      rank:{grade:name,abbrev,membership:'cadet'},grade:'rank-insignia'}});
  R.spec.fit={method:'contour of the regulation figure + parametric shield',score:null};write(id,R);
  {const sid=id.replace(/-metal$/,'-ocp-square'),SW=OCP_SQUARE_IN*U,ox=(SW-W)/2,oy=(SW-H)/2;
   const sb=`<g id="${sid}__cloth"><rect id="${sid}__backing" width="${SW}" height="${SW}" fill="${COLORS.cloth}"/></g><g id="${sid}__device" transform="translate(${f2(ox)} ${f2(oy)})">${body.split(id+'__').join(sid+'__dev-')}</g>`;
   const san={...stdAnchors(SW,SW),insignia_center:[SW/2,SW/2]};
   const SR=root({id:sid,name:`${name} metal chevron on the 2 in OCP square`,wIn:OCP_SQUARE_IN,hIn:OCP_SQUARE_IN,source:'reference-art-measured',body:sb,
     meta:{size_source:'estimated',size_basis:CN_EST,anchors:Object.fromEntries(Object.entries(san).map(([kk,v])=>[kk,r2(v)])),
       dimensions:{form:'metal chevron on 2x2 square',square_in:OCP_SQUARE_IN,chevron_w_in:+Wi.toFixed(4),chevron_h_in:+Hi.toFixed(4),
         clear_blue_top_bottom_in:+((OCP_SQUARE_IN-Hi)/2).toFixed(4),clear_blue_left_right_in:+((OCP_SQUARE_IN-Wi)/2).toFixed(4)},
       rank:{grade:name,abbrev,membership:'cadet'},grade:'rank-insignia'}});
   SR.spec.fit={method:'n/a',score:null};write(sid,SR);}
  return id;
}
// Cadet NCO chevrons are NOT built here any more: the traced / parametric versions were rejected as not sharp. They come from the
// Vanguard product photos instead (see make-cadet-chevrons-vanguard.js, data-source=vendor-photo-raster).

// ---- family spec: what exists, what each form is for, and what is still open
const SPEC_DIR=path.join(HERE,'specs');fs.mkdirSync(SPEC_DIR,{recursive:true});
fs.writeFileSync(path.join(SPEC_DIR,'rank-insignia-family.json'),JSON.stringify({
  generated_by:'assets/build-rank-insignia.js',
  conventions:{units:'1 user unit = 0.01 in',cloth_hex:COLORS.cloth,border_each_side_in:BORDER_IN,ocp_square_in:OCP_SQUARE_IN,
    border_rule:'light silver on dark blue insignia shows 1/8 in of blue past the widest and tallest point (CAPR 39-1 5.1.1.1.1.1, 5.1.1.1.1.3, 5.1.1.1.2.4, 5.1.1.1.2.5, 7.1.1.3.1, 7.1.1.8). Applies to grade insignia, badges and command insignia alike; derived from the item bbox, never stored per item.',
    exceptions:['OCP chest square is a fixed 2 in x 2 in (7.1.1.2.1)','CAP command insignia on OCP sits on a fixed 1 in x 1 in patch (7.1.1.3.1.7)']},
  forms:{
    'metal-regular':{for:'cadet officers on dress shoulder boards (Class A, mess dress)',size_source:'regulation',cite:'CAPR 39-1 Fig A5-6'},
    'metal-miniature':{for:'cadet officers on service / blue-shirt / outer-garment epaulets',size_source:'regulation',cite:'CAPR 39-1 Fig A5-6'},
    'thread':{for:'embroidered insignia without cloth (any mount)',size_source:'see asset'},
    'cloth-bordered':{for:'ABU collar and OCP / ABU / tactical cap: thread on dark blue cloth with 1/8 in border',size_source:'regulation (border) + asset size'},
    'ocp-square':{for:'OCP chest and coyote fleece: thread centered on a 2 in square (cadet officers at one common scale, see OCP_SCALE)',size_source:'regulation (square), estimated (insignia scale)'},
    'chevron':{for:'senior NCO sleeve chevrons, 3 1/2 and 4 in',size_source:'regulation',cite:'CAPR 39-1 Fig A5-4'}},
  mounts:[
    {uniform:'Class A coat / mess dress',insignia:'cadet officer metal-regular on shoulder board; officers bullion on board (not built)',cite:'4.1.1.1.1.1, 4.1.5.2.1.3, A5-6'},
    {uniform:'Service coat epaulets, blue shirts',insignia:'cadet officer metal-miniature; officers embroidered on gray epaulet sleeve',cite:'4.1.5.2.1.1, 4.1.6.1.4'},
    {uniform:'Class A lapels / shirt collars',insignia:'cadet NCO and Airman metal chevrons, both sides, 1 in from front of collar (pending)',cite:'4.1.5.2.1.4, 5.1.1.1.1.4, A5-5'},
    {uniform:'OCP chest',insignia:'ocp-square forms; blank square for senior members without grade; nothing for Cadet Airman Basic',cite:'7.1.1.2.1, 7.1.1.2.2'},
    {uniform:'ABU collar',insignia:'cloth-bordered, centered 1 in from the front of the collar (cadet officers) / 1 in from bottom (officers)',cite:'5.1.1.1.1.1, 5.1.1.1.1.3'},
    {uniform:'OCP / ABU / tactical cap',insignia:'cloth-bordered (same piece as ABU collar), centered 1/2 in from the visor; NCOs and Airmen wear none',cite:'7.1.1.8, 6.2.11.1'},
    {uniform:'Sleeve (NCO)',insignia:'chevron 3 1/2 or 4 in, centered halfway between shoulder seam and elbow',cite:'4.1.5.2.1.2, 5.1.1.1.1.2, A5-4'}],
  built:written.slice().sort(),
  not_built:[
    {item:'Cadet NCO chevrons',status:'built from Vanguard photos (raster-backed) by make-cadet-chevrons-vanguard.js',why:'Fig A5-5 is only 176 px; vector traces and parametric rebuilds were not sharp enough.'},
    {item:'Colonel eagle',status:'blocked',why:'Only regulation source (Fig A5-2) is ~100 px wide and traces to blobs. Needs a higher-resolution source.'},
    {item:'Brigadier General / Major General metal and plastic-encased forms, officer bullion boards, gray epaulet sleeves',status:'pending',why:'Not requested by the first pass; DAFI 36-2903 Fig 4.12 has them as small photographs.'},
    {item:'Flight Officer / Technical FO / Senior FO in metal',status:'pending',why:'Fig A5-2 shows cloth only.'},
    {item:'CAP Command Chief chevron',status:'blocked',why:'Described in the 2013 change summary but not drawn in the PDF copy held here.'},
    {item:'Parka slides, slip-on rank sleeves',status:'pending',why:'Fig A5-7 (rank slide) is a photograph; not yet traced.'},
    {item:'"CAP" patch for adult members without grade pursuing officer grade',status:'pending',why:'Fig A5-2 last cell; letters via the glyph-path tool.'}],
  open_decisions:[
    'OCP square: every cadet officer grade uses one common scale (about 0.78 x regular) so the Cadet Colonel / Captain stack just keeps 1/8 in of blue; single-element grades (2d Lt, Major) still leave a lot of blue because the square is a fixed 2 in. Say if you want per-grade fill instead.',
    'Officer bar / leaf proportions are read from Fig A5-2 at an assumed 1 in largest dimension (DAFI 36-2903 7.1.5.1); width and gap are estimates.',
    'Cadet NCO / Airman chevron width (about 1.16 in) is derived from Ethan\'s statement that the CMSgt chevron fills the 2 in OCP square with ~1/8 in top and bottom; confirm against a real device.',
    'Cloth color #142347 is the 2 x 2 in rank-square and tape blue used by the utility-uniform garments (base-art/make-ocp-abu.js); the regulation only says dark blue (shade 1095 for board braid).']
},null,1));

console.log('rank insignia written:',written.length,'(cadet officer metal',made.metal.length+', thread',made.thread.length+', bordered',made.bordered.length+', ocp square',made.ocp.length+', blank 1)');
module.exports={SIZES,GRADES,COLORS,BORDER_IN,OCP_SQUARE_IN};
