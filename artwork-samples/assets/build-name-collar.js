// Blank name tapes / name tags (shape, border, stitching, fastener, text zones; NO lettering) and standalone collar insignia (CAPR 39-1 Fig A6-3, A6-5).
//   nametape-cloth-blank-{ultramarine,dark-blue}   cloth last-name tape for the blue field uniform / fleeces (A6-3 "CAP nametag for BDU, blue field & black fleece")
//   captape-cloth-blank-{ultramarine,dark-blue}    cloth "CIVIL AIR PATROL" tape, same size (lettering is a fixed legend: text_zone only)
//   nametag-flight-leather-blank                   black leather flight suit name tag 2 x 4 in (8.2.4.1 / 8.3.4.1; phasing out 1 Aug 2021)
//   nametag-flight-embroidered-blank               dark blue embroidered flight suit name tag (A6-3), same 2 x 4 in loop-tape footprint
//   nametag-flight-jacket-leather-blank            black leather jacket name tag (A6-3)
//   collar-insignia-cap-metal / -cap-cloth / -us-metal / -us-circle-metal   Fig A6-5 collar / lapel insignia
const fs=require('fs'),path=require('path');
const U=100,f=n=>(+n).toFixed(2),esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
const written=[];
function emit(dir,id,name,W,H,body,meta){
  const vb=[0,0,+(W*U).toFixed(2),+(H*U).toFixed(2)];
  const m={asset_id:id,name,size_in:{w:+W.toFixed(4),h:+H.toFixed(4)},units:'1 user unit = 0.01 in',viewBox:vb,...meta,fit:{method:'n/a',score:null}};
  fs.writeFileSync(path.join(__dirname,dir,id+'.svg'),`<svg xmlns="http://www.w3.org/2000/svg" width="${W.toFixed(4)}in" height="${H.toFixed(4)}in" viewBox="${vb.join(' ')}" data-asset-id="${id}" data-source="reference-art-measured" data-units="0.01in"><title>${esc(name)}</title><metadata>${esc(JSON.stringify(m))}</metadata>${body}</svg>`);
  fs.writeFileSync(path.join(__dirname,dir,id+'.spec.json'),JSON.stringify(m,null,1));written.push(id);}
const A=(W,H)=>({top_center:[W*U/2,0],bottom_center:[W*U/2,H*U],center:[W*U/2,H*U/2],left_edge:[0,H*U/2],right_edge:[W*U,H*U/2]});
// ---------- cloth tapes
const TAPE={w:5.25,h:1.0};
const CLOTH={ultramarine:{hex:'#0b3fa6',edge:'#082c78',stitch:'#5f86d6',note:'ultramarine blue (to be phased out 15 June 2021, 10.9.8-9)'},
             'dark-blue':{hex:'#142347',edge:'#0b1530',stitch:'#4a5f93',note:'dark blue (family cloth blue, as the utility-uniform tapes)'}};
for(const [key,c] of Object.entries(CLOTH)) for(const kind of ['nametape','captape']){
  const id=`${kind}-cloth-blank-${key}`,W=TAPE.w,H=TAPE.h,m=0.07;
  const tz={x:0.18*U,y:0.14*U,w:(W-0.36)*U,h:(H-0.28)*U};
  const body=`<g id="${id}__cloth"><rect id="${id}__body" x="0" y="0" width="${W*U}" height="${H*U}" rx="2" fill="${c.hex}" stroke="${c.edge}" stroke-width="2.5"/>`
   +`<rect id="${id}__stitch" x="${m*U}" y="${m*U}" width="${(W-2*m)*U}" height="${(H-2*m)*U}" rx="1.5" fill="none" stroke="${c.stitch}" stroke-width="1.1" stroke-dasharray="5 3.5"/></g>`
   +`<rect id="${id}__text_zone" x="${f(tz.x)}" y="${f(tz.y)}" width="${f(tz.w)}" height="${f(tz.h)}" fill="none"/>`;
  emit('nameplates',id,`Blank cloth ${kind==='nametape'?'last-name tape':'"Civil Air Patrol" tape'}, ${key}`,W,H,body,{
    size_source:'estimated',size_basis:`5 1/4 x 1 in: the tape loops of the OCP/utility uniform (GL/PD 14-04B, as modelled in garment-ocp-coat-abu-cut name_tape / cap_tape landmarks); CAPR 39-1 7.1.1.2.3 says only that the tape matches the hook panel length. Colours: Fig A6-3 (figure shows bright ultramarine and a teal-leaning dark blue).`,
    provenance:'in-house construction; shape, merrowed edge and stitch line only, no lettering',
    colours:{cloth:c.hex,edge:c.edge,stitch:c.stitch},cloth_color:{hex:c.hex,note:c.note},
    anchors:{...A(W,H),text_center:[W*U/2,H*U/2]},
    landmarks:{tape:{x:0,y:0,w:W*U,h:H*U},text_zone:tz},
    landmarks_note:'rects are {x,y,w,h} in user units (0.01 in); text_zone is where the white (ultramarine) or silver (dark blue) lettering goes, centred, letter height up to 0.72 in',
    text:{content:kind==='nametape'?"member's legal last name (diacritics and hyphens allowed, all letters one height)":'CIVIL AIR PATROL (fixed legend)',colour:key==='ultramarine'?'white':'silver',case:'upper',align:'center',max_height_in:0.72},
    fastener:'sew-on or hook-and-loop (Velcro) back; tapes and rank must be all sewn or all Velcro (7.1.1.1)',
    documented:['name tape right chest, CAP tape left chest on the uniforms that take them (7.1.1.2.3, 5.1.x)','white lettering on ultramarine or silver lettering on dark blue (10.9.8-9)'],
    assumed:['5 1/4 x 1 in size','stitch line inset','colours'],grade:'insignia-plate'});
}
// ---------- flight suit name tags
function flightTag(id,name,fill,edge,stitch,size,basis,docs,extra){
  const W=4,H=2,m=0.09,R=0.08;
  const z={name:{x:0.45*U,y:0.82*U,w:3.1*U,h:0.5*U},grade:{x:0.2*U,y:1.45*U,w:1.0*U,h:0.35*U},cap:{x:2.8*U,y:1.45*U,w:1.0*U,h:0.35*U},badge:{x:0.45*U,y:0.15*U,w:3.1*U,h:0.62*U}};
  const body=`<g id="${id}__tag"><rect id="${id}__body" x="0" y="0" width="${W*U}" height="${H*U}" rx="${R*U}" fill="${fill}" stroke="${edge}" stroke-width="3"/>`
   +`<rect id="${id}__stitch" x="${m*U}" y="${m*U}" width="${(W-2*m)*U}" height="${(H-2*m)*U}" rx="${(R-0.02)*U}" fill="none" stroke="${stitch}" stroke-width="1.3" stroke-dasharray="6 4"/></g>`
   +Object.entries(z).map(([k,r])=>`<rect id="${id}__${k}_zone" x="${f(r.x)}" y="${f(r.y)}" width="${f(r.w)}" height="${f(r.h)}" fill="none"/>`).join('');
  emit('nameplates',id,name,W,H,body,{size_source:size,size_basis:basis,...(size==='regulation'?{size_citation:basis}:{}),provenance:'in-house construction from Fig A6-3 (flight suit name tags): shape, border, stitch only, no lettering',
    colours:{body:fill,edge:edge,stitch},anchors:{...A(W,H),name_center:[(z.name.x+z.name.w/2),(z.name.y+z.name.h/2)],grade_left:[z.grade.x,z.grade.y+z.grade.h/2],cap_right:[z.cap.x+z.cap.w,z.cap.y+z.cap.h/2],badge_center:[z.badge.x+z.badge.w/2,z.badge.y+z.badge.h/2]},
    landmarks:{tag:{x:0,y:0,w:W*U,h:H*U},name_zone:z.name,grade_zone:z.grade,cap_zone:z.cap,badge_zone:z.badge},
    landmarks_note:'rects are {x,y,w,h} in user units (0.01 in): name line (first and last name), grade lower left ("Cadet" for all cadets), "CAP" lower right, up to two badges (CAP aeronautical rating / occupational / mission qualification) above the name (8.2.4.1)',
    text:{lines:[{zone:'name_zone',content:'first and last name',align:'center'},{zone:'grade_zone',content:'grade ("Cadet" for cadets; NCO grade for NCOs; none printed on the officer cloth tag)',align:'left'},{zone:'cap_zone',content:'CAP',align:'right'}]},
    documented:docs,assumed:['stitch line inset','corner radius','zone positions read from Fig A6-3'],grade:'insignia-plate',...extra});}
flightTag('nametag-flight-leather-blank','Blank black leather flight suit name tag (FDU / CFDU)','#17171a','#050506','#4a4a52','regulation',
  'CAPR 39-1 8.2.4.1 and 8.3.4.1: black leather nametags will be 2 x 4 inches, worn over the left breast pocket',
  ['black leather name tag 2 x 4 in over the left breast pocket (8.2.4.1, 8.3.4.1)','to be phased out 1 August 2021'],
  {fastener:'hook and loop: sewn 2 x 4 in loop tape on the suit (8.2.4.2)',phase_out:'1 August 2021'});
flightTag('nametag-flight-embroidered-blank','Blank dark blue embroidered flight suit name tag (FDU / CFDU)','#1c2742','#0e1426','#9aa6c4','estimated',
  'Same 2 x 4 in footprint as the leather tag (8.2.4.1: a cloth tag is authorized in place of leather on the same loop tape); silver border from Fig A6-3',
  ['blue cloth embroidered nametag with silver border and lettering authorized in place of the leather tag if cloth grade insignia is worn (8.2.4.1)'],
  {fastener:'hook and loop on 2 x 4 in loop tape'});
flightTag('nametag-flight-jacket-leather-blank','Blank black leather flight jacket name tag','#1a1a1a','#050505','#8a7a3a','estimated',
  'Proportion read from Fig A6-3 (about 2.0 : 1, same as the flight suit tag); size taken as 2 x 4 in. CAPR 39-1 gives no jacket-tag dimension.',
  ['black leather jacket nametag (Fig A6-3)'],{fastener:'sewn or hook and loop on the jacket'});
// ---------- collar insignia (Fig A6-5)
const METAL={fill:'#d3d7dc',edge:'#8f969e'};
// glyphs in a 60.5-unit-high box (the CAP block letters of build-epaulet-sleeves.js GLYPH, shifted to x0=0,y0=0), plus U, S and the period
const SH=(l,dx,dy)=>l.map(p=>[p[0]-dx,p[1]-dy]);
const GC=[[51.1,26],[82.5,26],[91,35.5],[91,43.5],[88.7,45.3],[77.5,45.3],[73.5,40.3],[54.2,40.3],[54.2,72.2],[73.5,72.2],[77.5,67.2],[88.7,67.2],[91,69],[91,77],[82.5,86.5],[51.1,86.5],[40.6,79.5],[40.6,33]];
const GA=[[[115.9,26.3],[141.3,26.3],[155,86.5],[143.5,86.5],[136.7,72.1],[120.5,72.1],[113.7,86.5],[102.3,86.5]],[[126.1,35.5],[131.1,35.5],[136,60.8],[121.2,60.8]]];
const GP=[[[167.7,26],[204.5,26],[218,37],[218,50],[204.5,64.1],[182.1,64.1],[182.1,86.5],[167.7,86.5]],[[182.1,39.5],[200.5,39.5],[203.7,45],[200.5,49],[182.1,49]]];
const CAPG=[{loops:[GC]},{loops:GA},{loops:GP}];
const CAPX0=40.6,CAPY0=26,CAPW=218-40.6,CAPH=60.5;
const capGlyphs=(x,y,sc,fill,stroke)=>CAPG.map((g,i)=>`<path d="${g.loops.map(l=>'M'+l.map(q=>f(x+(q[0]-CAPX0)*sc)+','+f(y+(q[1]-CAPY0)*sc)).join('L')+'Z').join('')}" fill="${fill}" fill-rule="evenodd"${stroke?` stroke="${stroke}" stroke-width="${f(sc*1.2)}" stroke-linejoin="round"`:''}/>`).join('');
const Ug=[[0,0],[12.5,0],[12.5,43],[16,47.5],[28,47.5],[31.5,43],[31.5,0],[44,0],[44,48],[36,60.5],[8,60.5],[0,48]];
const Sd=(sc,x,y)=>`M${f(x+36*sc)},${f(y+5.5*sc)}H${f(x+12*sc)}Q${f(x+5.5*sc)},${f(y+5.5*sc)} ${f(x+5.5*sc)},${f(y+12*sc)}V${f(y+20*sc)}Q${f(x+5.5*sc)},${f(y+27*sc)} ${f(x+12*sc)},${f(y+27*sc)}H${f(x+28*sc)}Q${f(x+34.5*sc)},${f(y+27*sc)} ${f(x+34.5*sc)},${f(y+34*sc)}V${f(y+43*sc)}Q${f(x+34.5*sc)},${f(y+54.5*sc)} ${f(x+28*sc)},${f(y+54.5*sc)}H${f(x+4*sc)}`;
// "U.S." width in glyph units: U 44 + gap 4 + dot 11 + gap 8 + S 40 + gap 4 + dot 11 = 122
const USW=123,USH=60.5;
function usPaths(x,y,sc,fill,stroke){
  const sx=x+(44+4+11+8)*sc; // S start
  const dotY=y+49.5*sc;
  return `<path d="M${Ug.map(q=>f(x+q[0]*sc)+','+f(y+q[1]*sc)).join('L')}Z" fill="${fill}"${stroke?` stroke="${stroke}" stroke-width="${f(sc*1.2)}" stroke-linejoin="round"`:''}/>`
   +`<rect x="${f(x+48*sc)}" y="${f(dotY)}" width="${f(11*sc)}" height="${f(11*sc)}" fill="${fill}"/>`
   +`<path d="${Sd(sc,sx,y)}" fill="none" stroke="${fill}" stroke-width="${f(11*sc)}" stroke-linejoin="miter"/>`
   +`<rect x="${f(x+(44+4+11+8+40+4)*sc)}" y="${f(dotY)}" width="${f(11*sc)}" height="${f(11*sc)}" fill="${fill}"/>`;
}
const CI={cap:{w:1.4,h:0.55}};
const M=0.04,ink=(w,gw)=>w/gw;
{ // CAP metal: letters only, block, 1.30 x 0.46 in
  const lw=1.30,sc=lw*U/CAPW,lh=CAPH*sc/U,W=lw+2*M,H=lh+2*M,id='collar-insignia-cap-metal';
  const body=`<g id="${id}__letters">${capGlyphs(M*U,M*U,sc,METAL.fill,METAL.edge)}</g>`;
  emit('insignia',id,'CAP collar / lapel insignia, metal letters (cadet officers)',W,H,body,{size_source:'estimated',
    size_basis:'The garment overlay garment-blues-class-a-cadet-officer-insignia reserves a 1.4 x 0.53 in zone for the CAP lapel letters (Fig A6-5 gives no dimension): letters 1.30 x 0.46 in plus 0.04 in margin',
    provenance:'letter shapes from the CAP block letters of build-epaulet-sleeves.js (traced from Fig A5-2); finish from Fig A6-5',
    colours:{metal:METAL.fill,edge:METAL.edge},anchors:{...A(W,H),mount_center:[W*U/2,H*U/2]},
    mounts:[{uniform:'Class A / service coat, cadet officers',rule:'on each lapel halfway up the seam, resting on but not over it, letters parallel with the ground (4.1.5.2.2.1.2, 4.1.7.2.2.1, 4.1.9.4.1.2, 4.1.10.1.2.1)'}],
    pair:{count:2,mirrored:false,note:'identical on both lapels'},documented:['CAP lapel insignia, cadet officers; metal chevrons replace it for cadet NCOs and Airmen'],assumed:['size'],grade:'rank-insignia',
    see_also:'rank-collar-cap-officers.* (cadet officer collar / cap grade pieces) is a different set and is not duplicated here'});
}
{ // CAP cloth: white letters on dark blue rectangle
  const W=1.40,H=0.55,id='collar-insignia-cap-cloth',lw=1.12,sc=lw*U/CAPW,lh=CAPH*sc/U;
  const body=`<g id="${id}__cloth"><rect x="0" y="0" width="${W*U}" height="${H*U}" rx="2" fill="#142347"/></g><g id="${id}__letters">${capGlyphs((W-lw)/2*U,(H-lh)/2*U,sc,'#f4f6f8',null)}</g>`;
  emit('insignia',id,'CAP collar / lapel insignia, cloth (white letters on dark blue)',W,H,body,{size_source:'estimated',
    size_basis:'1.4 x 0.55 in cloth, letters 1.12 x 0.40 in: proportions of the cloth tile in Fig A6-5 (about 2.4 : 1) at the 1.4 in lapel zone width of the garment overlay',
    provenance:'letters from the CAP block letters of build-epaulet-sleeves.js; blue = family cloth blue',colours:{cloth:'#142347',letters:'#f4f6f8'},
    anchors:{...A(W,H),mount_center:[W*U/2,H*U/2]},
    mounts:[{uniform:'Class A coat lapels, cadet officers',rule:'halfway up the lapel seam, resting on but not over it (4.1.5.2.2.1.2)'}],pair:{count:2,mirrored:false},
    documented:['cloth CAP collar insignia tile (Fig A6-5)'],assumed:['size'],grade:'rank-insignia'});
}
{ // US metal
  const lw=1.05,sc=lw*U/USW,lh=USH*sc/U,W=lw+2*M,H=lh+2*M+0,id='collar-insignia-us-metal';
  const body=`<g id="${id}__letters">${usPaths(M*U,M*U,sc,METAL.fill,METAL.edge)}</g>`;
  emit('insignia',id,'U.S. collar / lapel insignia, metal (officers; adults without grade who will become officers)',W,H,body,{size_source:'estimated',
    size_basis:'No dimension in CAPR 39-1; DAFI 36-2903 shows the same 5/8-1 in US lapel insignia. Letter height 0.40 in, width 1.05 in, proportioned like the CAP letters of Fig A6-5',
    provenance:'in-house block letters U . S . (CAPR 39-1 Fig A6-5)',colours:{metal:METAL.fill,edge:METAL.edge},anchors:{...A(W,H),mount_center:[W*U/2,H*U/2]},
    mounts:[{uniform:'Class A / service coat, officers and adults without grade who will become officers',rule:'on each lapel halfway up the seam, resting on but not over it; letters parallel with the ground; no circle for officers (4.1.5.2.2.1.1, 4.1.9.4.1.1)'}],
    pair:{count:2,mirrored:false},documented:['US lapel insignia, officers (Fig A6-5)'],assumed:['size','letter shapes'],grade:'rank-insignia'});
}
{ // US in circle
  const D=1.05,id='collar-insignia-us-circle-metal',W=D+2*M,H=W,c=W*U/2,r=D*U/2,rw=0.075*U,lw=0.58,sc=lw*U/USW,lh=USH*sc/U;
  const body=`<g id="${id}__ring"><circle cx="${f(c)}" cy="${f(c)}" r="${f(r-rw/2)}" fill="none" stroke="${METAL.fill}" stroke-width="${f(rw)}"/><circle cx="${f(c)}" cy="${f(c)}" r="${f(r)}" fill="none" stroke="${METAL.edge}" stroke-width="1"/><circle cx="${f(c)}" cy="${f(c)}" r="${f(r-rw)}" fill="none" stroke="${METAL.edge}" stroke-width="1"/></g>`
   +`<g id="${id}__letters">${usPaths(c-lw*U/2,c-lh*U/2,sc,METAL.fill,METAL.edge)}</g>`;
  emit('insignia',id,'U.S. in circle collar / lapel insignia, metal (NCOs)',W,H,body,{size_source:'estimated',
    size_basis:'No dimension in CAPR 39-1; same overall 1.05 in as the plain US insignia, ring 0.075 in, letters 0.58 in wide',
    provenance:'in-house construction from Fig A6-5',colours:{metal:METAL.fill,edge:METAL.edge},anchors:{...A(W,H),mount_center:[W*U/2,H*U/2]},
    mounts:[{uniform:'Class A / service coat, NCOs and adults without grade who will become NCOs',rule:'on each lapel halfway up the seam, resting on but not over it; circles are worn around the US insignia for NCOs only (4.1.5.2.2.1.1, 4.1.9.4.1.1)'}],
    pair:{count:2,mirrored:false},documented:['circled US lapel insignia, NCOs (Fig A6-5)'],assumed:['size'],grade:'rank-insignia'});
}
console.log('name tapes / tags / collar insignia:',written.length,written.join(' '));
