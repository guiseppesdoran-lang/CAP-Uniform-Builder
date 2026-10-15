// USAF-style Mess Dress (CAPR 39-1 4.1.1 men / 4.1.2 women; Figures 4.1, 4.2) built from the traced base images
// images/base/mess_dress_{male,female}.webp (581x719). Silhouettes traced (trace-silhouette.js, 0.0474 in/px, same canvas/scale as the
// men's Class A coat); interior parts are parametric in inches. Raster -> inch: x=(px-cx)*S, y=(py-y0)*S with the trace's own cx, y0.
// Mess dress is for officers and NCOs only. Grade (shoulder boards / chevrons), medals, nametag (none on this uniform), and
// badges are accoutrements and are not drawn. The CAP seal (4.1.1.1.2.3) is part of the base: drawn over the middle button, landmark cap_seal.
const fs=require('fs'),path=require('path');
const f=n=>(+n).toFixed(3),STROKE='#00102f';
const NAVY='#001c52';
const poly=a=>'M'+a.map(p=>f(p[0])+','+f(p[1])).join('L')+'Z';
const mir=p=>[-p[0],p[1]];
const here=__dirname,OUTDIR=path.join(here,'..','assets','garments'),U=100;
fs.mkdirSync(OUTDIR,{recursive:true});
const DEFS2=`<defs>
<linearGradient id="coatShade" gradientUnits="userSpaceOnUse" x1="-12" y1="0" x2="12" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".30"/><stop offset=".12" stop-color="#000" stop-opacity=".08"/><stop offset=".3" stop-color="#000" stop-opacity="0"/><stop offset=".7" stop-color="#000" stop-opacity="0"/><stop offset=".88" stop-color="#000" stop-opacity=".08"/><stop offset="1" stop-color="#000" stop-opacity=".30"/></linearGradient>
<linearGradient id="topLight" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".10"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<radialGradient id="btn" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="#cfd3da"/><stop offset="1" stop-color="#8d939e"/></radialGradient>
<linearGradient id="plate" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e4e6ea"/><stop offset="1" stop-color="#a9aeb8"/></linearGradient>
</defs>`;
const GLY=JSON.parse(fs.readFileSync(path.join(__dirname,'..','assets','tools','glyphs_arialbold_cap.json')));
const GLYB=JSON.parse(fs.readFileSync(path.join(__dirname,'..','assets','tools','glyphs_arialblack_cap.json')));
const lettering=(str,cx,cy,capH,fill,track=0.06,fitW=null,T=GLY)=>{const k=capH/71.58,ch=[...str],adv=ch.map(c=>c===' '?0.28*100:T[c].adv);
  const tw=adv.reduce((a,v)=>a+v,0)+track*100*(ch.length-1),kx=fitW?fitW/tw:k;let x=0,d='';
  ch.forEach((c,i)=>{if(c!==' ')d+=`<path transform="translate(${f(x)} 0)" d="${T[c].d}"/>`;x+=adv[i]+track*100;});
  return `<g fill="${fill}" transform="translate(${f(cx-tw*kx/2)} ${f(cy+capH/2)}) scale(${kx.toFixed(5)} ${k.toFixed(5)})">${d}</g>`;};

// ---- button art, proportions measured from Vanguard product photos (rendered, not embedded):
// hapArnold: SKU 2900705 "Hap Arnold 36 ligne for service coat" (approx 7/8 in dia), star + two wings on pebbled field.
// capCrest: CAP0807 CAP crest button (ring of 13 stars, eagle over shield with triangle + prop) - the type on the board photo.
const star5=(cx,cy,R,rot=-90)=>Array.from({length:10},(_,i)=>{const a=(rot+i*36)*Math.PI/180,r=i%2?R*0.382:R;return f(cx+r*Math.cos(a))+','+f(cy+r*Math.sin(a));}).join(' ');
const SEAL=require('./seal-art.js')(GLY,require('./crest-art.js')(GLY));
const hapArnold=(FIELD='#50535b',RAISE='#b4b8c0',RIM='#c9ccd2',EDGE='#2e3036')=>{
  const root=[-0.27,0.11],tips=[[-0.60,-0.64],[-0.69,-0.46],[-0.75,-0.26],[-0.74,-0.06],[-0.64,0.10]];
  const feather=(t,wd)=>{const mx=(root[0]+t[0])/2,my=(root[1]+t[1])/2,dx=t[0]-root[0],dy=t[1]-root[1],L=Math.hypot(dx,dy),nx=-dy/L,ny=dx/L;
    return `M${root[0]},${root[1]} Q${f(mx+nx*wd)},${f(my+ny*wd)} ${t[0]},${t[1]} Q${f(mx-nx*wd*0.6)},${f(my-ny*wd*0.6)} ${root[0]},${root[1]} Z`;};
  const w=tips.map((t,i)=>`<path d="${feather(t,0.17)}" fill="${RAISE}" stroke="${EDGE}" stroke-width=".018"/>`).join('')
    +`<path d="M-0.30,0.14 L-0.12,0.12 L-0.16,-0.04 L-0.34,-0.02 Z" fill="${RAISE}" stroke="${EDGE}" stroke-width=".018"/>`;
  return `<circle r="1" fill="${RIM}"/><circle r=".93" fill="${FIELD}"/>`
    +`<g>${w}</g><g transform="scale(-1 1)">${w}</g>`
    +`<polygon points="${star5(0,0.31,0.526)}" fill="${RAISE}" stroke="${EDGE}" stroke-width=".02" stroke-linejoin="round"/><circle cx="0" cy="0.33" r=".17" fill="${FIELD}" stroke="${EDGE}" stroke-width=".02"/>`
    +`<circle r=".93" fill="none" stroke="${EDGE}" stroke-width=".025"/>`;};
const capCrest=(FIELD='#5d6068',RAISE='#b4b8c0',RIM='#c9ccd2',EDGE='#2e3036')=>{
  const stars=[[-0.25,-0.73],[0.01,-0.78],[0.24,-0.73],[-0.62,-0.44],[-0.73,-0.20],[-0.76,0.07],[-0.69,0.33],[-0.53,0.54],[0.62,-0.45],[0.73,-0.22],[0.77,0.04],[0.71,0.30],[0.56,0.52]];
  const wing=`M-0.01,-0.36 Q-0.20,-0.40 -0.47,-0.66 Q-0.38,-0.52 -0.42,-0.46 Q-0.30,-0.42 -0.34,-0.34 Q-0.20,-0.29 -0.04,-0.26 Z`;
  return `<circle r="1" fill="${RIM}"/><circle r=".94" fill="${FIELD}"/>`
    +stars.map(([x,y])=>`<polygon points="${star5(x,y,0.075)}" fill="${RAISE}"/>`).join('')
    +`<path d="${wing}" fill="${RAISE}" stroke="${EDGE}" stroke-width=".015"/><path d="${wing}" transform="scale(-1 1)" fill="${RAISE}" stroke="${EDGE}" stroke-width=".015"/>`
    +`<ellipse cx="0" cy="-0.35" rx=".085" ry=".14" fill="${RAISE}" stroke="${EDGE}" stroke-width=".015"/><circle cx="0" cy="-0.55" r=".055" fill="${RAISE}"/><rect x="-0.14" y="-0.22" width=".28" height=".06" fill="${RAISE}"/>`
    +`<path d="M-0.40,-0.12 L0.40,-0.12 L0.40,0.30 Q0.40,0.60 0,0.79 Q-0.40,0.60 -0.40,0.30 Z" fill="#6c7079" stroke="${EDGE}" stroke-width=".022"/>`
    +`<path d="M-0.37,0.44 L0.37,0.44 Q0.35,0.62 0,0.76 Q-0.35,0.62 -0.37,0.44 Z" fill="${RAISE}"/>`
    +`<polygon points="0.02,-0.06 -0.22,0.37 0.27,0.37" fill="none" stroke="${RAISE}" stroke-width=".035"/>`
    +[-90,30,150].map(a=>`<path d="M0.02,0.2 L${f(0.02+0.17*Math.cos(a*Math.PI/180))},${f(0.2+0.17*Math.sin(a*Math.PI/180))}" stroke="${RAISE}" stroke-width=".05" stroke-linecap="round"/>`).join('')
    +`<circle r=".94" fill="none" stroke="${EDGE}" stroke-width=".025"/>`;};
const stitch=d=>`<path d="${d}" fill="none" stroke="#000a22" stroke-opacity=".55" stroke-width=".035" stroke-dasharray=".12 .08"/>`;
const seam=(d,w=.07)=>`<path d="${d}" fill="none" stroke="${STROKE}" stroke-opacity=".32" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const esc=x=>String(x).replace(/&/g,'&amp;').replace(/</g,'&lt;');
const nsIds=(svg,prefix)=>{const ids=new Set([...svg.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]));
  return svg.replace(/(\sid=")([^"]+)(")/g,(m,a,id,c)=>a+prefix+'__'+id+c).replace(/url\(#([^)]+)\)/g,(m,id)=>ids.has(id)?`url(#${prefix}__${id})`:m);};
const attrsOf=t=>Object.fromEntries([...t.matchAll(/([\w:-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));
function el(svg,id){const m=svg.match(new RegExp(`<(rect|path|g|circle)\\s[^>]*\\bid="${id}"[^>]*>`));return m?{tag:m[1],at:attrsOf(m[0]),end:m.index+m[0].length}:null;}
function lmRect(svg,id,vb){const e=el(svg,id);if(!e)return null;let at=e.at;
  if(e.tag==='g'){const r=svg.slice(e.end).match(/<rect\s[^>]*>/);at=attrsOf(r[0]);}
  return {x:+((+at.x-vb.x)*U).toFixed(2),y:+((+at.y-vb.y)*U).toFixed(2),w:+(at.width*U).toFixed(2),h:+(at.height*U).toFixed(2)};}
function lmPoly(svg,id,vb){const e=el(svg,id);if(!e)return null;const n=e.at.d.match(/-?\d*\.?\d+/g).map(Number),p=[];
  for(let i=0;i+1<n.length;i+=2)p.push([+((n[i]-vb.x)*U).toFixed(2),+((n[i+1]-vb.y)*U).toFixed(2)]);return p;}
const lmCen=r=>[+(r.x+r.w/2).toFixed(2),+(r.y+r.h/2).toFixed(2)];
const lmBox=p=>{const xs=p.map(q=>q[0]),ys=p.map(q=>q[1]);return {x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)};};
function conv({id,name,vb,body,source,meta}){
  const W=vb.w,H=vb.h,Wu=+(W*U).toFixed(2),Hu=+(H*U).toFixed(2);
  const art=`<g id="art" transform="translate(${f(-vb.x*U)} ${f(-vb.y*U)}) scale(${U})">${body}</g>`;
  const m={asset_id:id,name,size_in:{w:+W.toFixed(4),h:+H.toFixed(4)},units:'1 user unit = 0.01 in',viewBox:[0,0,Wu,Hu],...meta};
  let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W.toFixed(4)}in" height="${H.toFixed(4)}in" viewBox="0 0 ${Wu} ${Hu}" data-asset-id="${id}" data-source="${source}" data-units="0.01in"><title>${esc(name)}</title><metadata>${esc(JSON.stringify(m))}</metadata>${DEFS2}${art}</svg>`;
  svg=nsIds(svg,id);
  fs.writeFileSync(path.join(OUTDIR,id+'.svg'),svg);fs.writeFileSync(path.join(OUTDIR,id+'.spec.json'),JSON.stringify(m,null,1));return svg;}
const std=(W,H)=>({top_center:[W/2,0],bottom_center:[W/2,H],center:[W/2,H/2],left_edge:[0,H/2],right_edge:[W,H/2]});
const r2=a=>a.map(v=>+(+v).toFixed(2));

const S=0.0474;
const SH_WHITE='#f5f6f9',PLEAT='#b4b8c2',SATING='satin';
const DEFS3=DEFS2.replace('</defs>',`<linearGradient id="satinL" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#0c1a45"/><stop offset=".45" stop-color="#27407f"/><stop offset="1" stop-color="#0a1740"/></linearGradient>
<linearGradient id="satinR" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#0c1a45"/><stop offset=".45" stop-color="#27407f"/><stop offset="1" stop-color="#0a1740"/></linearGradient>
<linearGradient id="coatEdge" gradientUnits="objectBoundingBox" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".32"/><stop offset=".14" stop-color="#000" stop-opacity=".06"/><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset=".86" stop-color="#000" stop-opacity=".06"/><stop offset="1" stop-color="#000" stop-opacity=".32"/></linearGradient>
<linearGradient id="shirtShade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8d94a8" stop-opacity=".55"/><stop offset=".22" stop-color="#8d94a8" stop-opacity="0"/><stop offset=".78" stop-color="#8d94a8" stop-opacity="0"/><stop offset="1" stop-color="#8d94a8" stop-opacity=".55"/></linearGradient>
<linearGradient id="cumGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1c3374"/><stop offset="1" stop-color="#091944"/></linearGradient>
<linearGradient id="satinBow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#24397a"/><stop offset="1" stop-color="#0b1944"/></linearGradient>
</defs>`);
const CONFIGS={
 male:{id:'garment-mess-dress-male',outline:'mess_dress_male_outline.json',name:"Men's USAF-style mess dress (blank: no grade or medals; CAP seal on the right side)",
  lapelOuterL:[[216,16],[184,44],[181,50],[180,100],[185,175],[197.5,225],[210,275],[228,330],[247,385],[262,430]],
  lapelInnerL:[[220,16],[224,50],[227.5,95],[237.5,150],[242.5,200],[252.5,275],[262,367],[262,428]],
  lapelOuterR:[[357.5,19],[391,50],[395,125],[390,200],[380,275],[362,335],[336,390],[314,430]],
  lapelInnerR:[[355,19],[355,47],[346,100],[337.5,175],[332.5,212],[322.5,275],[312,367],[312,428]],
  bib:{yTop:96,yBot:367,studs:[[288,132],[288,193],[288,254],[288,315]],pleatsL:[233.75,240,246,253.75,260,266,273],pleatsR:[304.5,311,318,324,331,338]},
  bow:{wingL:[[224,49],[240,47],[274,59],[274,87],[240,93],[226,96]],knot:[[274,59],[301,59],[301,87],[274,87]],wingR:[[301,59],[326,49],[347.5,50],[347.5,96],[324,92],[301,87]]},
  cummer:{top:[[262,360],[312,360]],bot:[[257,452],[318,452]],pleats:3,bulge:10},
  closure:{l:[255,432],r:[321,432],chain:true},
  buttonsR:[[181,327],[190,407],[192,487]],   // wearer's right (image left); the middle one sits under the CAP seal
  buttonsL:[[387,322],[376,404],[363,485]],
  seal:{cx:190,cy:407,r:33},
  seamsL:[[60,95],[75,150],[105,250],[117,320]],seamsR:[[512,100],[495,165],[475,225],[455,320]],
  cut:{l:[[132,510],[252,550]],r:[[440,520],[320,555]]},crease:{x:288,y0:478},
  braid:{yL:590,xL:[22,102],yR:592,xR:[472,558],d:3.0},   // d: braid edge nearest the sleeve end sits 3 in from the end (CAPR 39-1 4.1.1.1)
  shoulder:{r:[60,95],l:[512,100]}},
 female:{id:'garment-mess-dress-female',outline:'mess_dress_female_outline.json',holes:[3,4],name:"Women's USAF-style mess dress (blank: no grade or medals; CAP seal on the right side)",
  lapelOuterL:[[236,16],[202,54],[206,75],[207.5,150],[212.5,225],[222,290],[240,350],[262,395],[272,402]],
  lapelInnerL:[[239,16],[239,25],[242.5,100],[250,175],[256,275],[264,335],[272,402]],
  lapelOuterR:[[351,16],[382,54],[380,100],[372,175],[365,240],[350,300],[330,360],[320,395],[318,402]],
  lapelInnerR:[[348,16],[347.5,25],[344,100],[335,200],[330,275],[324,335],[318,402]],
  blouse:{yTop:25,yBot:402,buttons:[[300,177],[300,247],[300,318],[300,388]],placket:[290,311]},
  tab:[[252,152],[283,70],[316,70],[347,150],[323,160],[299,104],[276,160]],
  cummer:{top:[[272,402],[316,402]],bot:[[272,487],[316,487]],pleats:0},
  buttonsR:[[209,390],[214,456],[204,529]],buttonsL:[[380,392],[385,462],[386,531]],
  seal:{cx:214,cy:456,r:34},
  cut:{l:[[150,572],[265,572],[265,487]],r:[[322,487],[322,575],[472,577]]},
  braid:{yL:637,xL:[32,120],yR:640,xR:[475,555],d:2.5},   // women: 2 1/2 in from the end of the sleeve (4.1.2.1)
  armhole:{r:[152,330],l:[435,330]},elbow:[[[50,432],[92,438],[138,432]],[[528,432],[488,438],[448,432]]],
  shoulder:{r:[80,75],l:[505,80]}}};
const BR2=0.4;  // coat-of-arms / wing-and-star buttons, about 0.8 in
function build(C,withBraid){
  const OUT=JSON.parse(fs.readFileSync(path.join(__dirname,C.outline),'utf8')),cx=OUT.cx,y0=OUT.y0;
  const X=px=>(px-cx)*S,Y=py=>(py-y0)*S,P=p=>[X(p[0]),Y(p[1])];
  const pts=a=>a.map(p=>{const q=P(p);return f(q[0])+','+f(q[1]);}).join('L');
  const hp=h=>'M'+h.map(p=>f(p[0])+','+f(p[1])).join('L')+'Z';const sil=hp(OUT.outline)+(C.holes||[]).map(i=>hp(OUT.holes[i])).join('');
  let top='',pre='',top2='';
  for(const i of (C.holes||[]))pre+=`<path id="armpit-shadow-${OUT.holes[i][0][0]<0?'right':'left'}" d="${hp(OUT.holes[i])}" fill="#061336"/>`;
  {const cs='#1f3372',wl=a=>'M'+a.map(p=>{const q=[(p[0]-cx)*S,(p[1]-y0)*S];return f(q[0])+','+f(q[1]);}).join('L')+'Z';
   if(C.bib){ // men: shawl back + white shirt collar band behind the bow tie
     pre+=`<path id="shirt-collar" d="${wl([[226,70],[227,16],[256,7],[322,7],[351,16],[352,70]])}" fill="#eef0f5" stroke="#9aa1b4" stroke-width=".05" stroke-linejoin="round"/>`;
   }else{ // women: back-of-neck interior + blouse collar leaves, in inches on the traced neck opening
     const nb=OUT.outline.filter(p=>p[1]>=0.7&&p[1]<=2.8&&Math.abs(p[0])<=2.6),ff=p=>f(p[0])+','+f(p[1]);
     pre+=`<path id="collar-back" d="M${[[-2.62,0.45],[-1.4,0.3],[0,0.25],[1.4,0.3],[2.62,0.45]].concat(nb.slice().sort((p,q)=>p[0]-q[0]).reverse()).map(ff).join('L')}Z" fill="#dde1ea" stroke="#9aa1b4" stroke-width=".04"/>`;
     for(const m of [-1,1]){const top=[m*2.5,0.82],tip=[m*1.95,3.0],inn=[0,2.95],bw=nb.filter(p=>p[0]*m>0.2).sort((p,q)=>m*(p[0]-q[0]));
       top2+=`<path id="blouse-collar-${m<0?'right':'left'}" d="M${ff(top)}L${ff(tip)}L${ff(inn)}L${bw.map(ff).join('L')}Z" fill="#eef0f5" stroke="#9aa1b4" stroke-width=".05" stroke-linejoin="round"/>`;}
   }}
  let g=`<defs><clipPath id="clipSil"><path d="${sil}" clip-rule="evenodd"/></clipPath></defs><g id="coat-body"><path id="silhouette" d="${sil}" fill="${NAVY}" fill-rule="evenodd"/>`;
  g+=`<g clip-path="url(#clipSil)">`;
  // shirt (bib / blouse) between the lapels
  const innerL=C.lapelInnerL,innerR=C.lapelInnerR;
  const yb=C.bib?C.bib.yBot:C.blouse.yBot,yt=C.bib?C.bib.yTop:C.blouse.yTop;
  const clipPts=a=>a.filter(p=>p[1]>=yt&&p[1]<=yb);
  const shirt='M'+pts([[innerL.find(p=>p[1]>=yt)[0],yt],...clipPts(innerL),[innerL[innerL.length-1][0],yb],[innerR[innerR.length-1][0],yb],...clipPts(innerR).reverse(),[innerR.find(p=>p[1]>=yt)[0],yt]])+'Z';
  g+=`<defs><clipPath id="clipShirt"><path d="${shirt}"/></clipPath></defs><path id="shirt" d="${shirt}" fill="${SH_WHITE}"/><path d="${shirt}" fill="url(#shirtShade)"/>`;
  if(C.bib){const B=C.bib;
    g+=`<g id="pleats" clip-path="url(#clipShirt)">`+[...B.pleatsL,...B.pleatsR].map(x=>`<path d="M${f(X(x))},${f(Y(yt))} L${f(X(x))},${f(Y(yb))}" stroke="${PLEAT}" stroke-width=".035" stroke-opacity=".8"/>`).join('')+`</g>`;
    B.studs.forEach((s,i)=>{const q=P(s);g+=`<g id="stud-${i+1}"><circle cx="${f(q[0])}" cy="${f(q[1])}" r=".13" fill="url(#btn)" stroke="#8d939e" stroke-width=".02"/></g>`;});}
  else{const Bk=C.blouse;
    g+=`<g id="blouse-pleats" clip-path="url(#clipShirt)">`+[-34,-27,-20,-13,-7,7,13,20,27,34].map(d=>`<path d="M${f(X(300+d))},${f(Y(yt))} L${f(X(300+d))},${f(Y(yb))}" stroke="${PLEAT}" stroke-width=".035" stroke-opacity=".8"/>`).join('')+`</g>`;
    Bk.buttons.forEach((s,i)=>{const q=P(s);g+=`<g id="blouse-button-${i+1}"><circle cx="${f(q[0])}" cy="${f(q[1])}" r=".1" fill="#ffffff" stroke="#c4c7cf" stroke-width=".025"/></g>`;});}
  // shawl collar (satin facing): band between outer edge and inner edge
  for(const [tag,o,i,grad] of [['right',C.lapelOuterL,C.lapelInnerL,'satinL'],['left',C.lapelOuterR,C.lapelInnerR,'satinR']]){
    const poly2='M'+pts([...o,...i.slice().reverse()])+'Z';
    g+=`<path id="shawl-${tag}" d="${poly2}" fill="url(#${grad})" stroke="#0a1a47" stroke-width=".035" stroke-linejoin="round"/>`;}
  // tie
  if(C.bow){const B=C.bow;
    top+=`<g id="bow-tie"><title>Blue satin bow tie (CAPR 39-1 4.1.1.2.3)</title>`+[['bow-wing-right',B.wingL],['bow-knot',B.knot],['bow-wing-left',B.wingR]].map(([i,w])=>`<path id="${i}" d="M${pts(w)}Z" fill="url(#satinBow)" stroke="#0a1a47" stroke-width=".03" stroke-linejoin="round"/>`).join('')+`</g>`;}
  else top+=top2+`<path id="tie-tab" d="M${pts(C.tab)}Z" fill="#0d2058" stroke="#071238" stroke-width=".03" stroke-linejoin="round"/>`;
  // cummerbund (plain blue satin, open edge of the pleats up)
  {const cm=C.cummer,bl=(cm.bulge||0),q0=P(cm.top[0]),q1=P(cm.top[1]),poly3=`M${f(q0[0])},${f(q0[1])} Q${f((q0[0]+q1[0])/2)},${f((q0[1]+q1[1])/2+bl*S)} ${f(q1[0])},${f(q1[1])} L${pts([cm.bot[1],cm.bot[0]])}Z`;
   g+=`<g id="cummerbund"><path id="cummerbund-body" d="${poly3}" fill="url(#cumGrad)" stroke="#050f33" stroke-width=".04"/>`;
   for(let k=1;k<=cm.pleats;k++){const t=k/(cm.pleats+1),a=[cm.top[0][0]+(cm.bot[0][0]-cm.top[0][0])*t,cm.top[0][1]+(cm.bot[0][1]-cm.top[0][1])*t],b=[cm.top[1][0]+(cm.bot[1][0]-cm.top[1][0])*t,cm.top[1][1]+(cm.bot[1][1]-cm.top[1][1])*t];
     g+=`<path d="M${pts([a,b])}" stroke="#26407e" stroke-width=".035" stroke-opacity=".8"/>`;}
   g+=`</g>`;}
  // coat cut-away edges, seams, trouser crease
  for(const e of [C.cut.l,C.cut.r])g+=`<path d="M${pts(e)}" fill="none" stroke="#000a26" stroke-opacity=".75" stroke-width=".2" stroke-linejoin="round" transform="translate(0 .13)"/>`
    +`<path d="M${pts(e)}" fill="none" stroke="#7da0e6" stroke-opacity=".85" stroke-width=".06" stroke-linejoin="round"/>`;
  if(C.seamsL)for(const e of [C.seamsL,C.seamsR])g+=seam('M'+pts(e),.05);
  if(C.crease){const cl=C.cut.l[C.cut.l.length-1],cr=C.cut.r[C.cut.r.length-1];
    g+=`<path id="trouser-front" d="M${pts([cl,cr,[cr[0]+8,y0+OUT.heightIn/S],[cl[0]-8,y0+OUT.heightIn/S]])}Z" fill="#00133d" fill-opacity=".8"/>`;}
  if(C.crease)g+=seam(`M${f(X(C.crease.x))},${f(Y(C.crease.y0))} L${f(X(C.crease.x))},${f(Y(y0+OUT.heightIn/S))}`,.05);
  g+=`<path d="${sil}" fill="url(#coatEdge)" fill-rule="evenodd"/>`;
  // set-in sleeve seams (armhole) and a soft elbow crease on the sleeves, from the shoulder point to the underarm (hole top or measured point)
  if(C.armhole){for(const [sh,ax,pt] of [[C.shoulder.r,C.armhole.r,0],[C.shoulder.l,C.armhole.l,1]]){
      const a=P(sh),b=P(ax),m=[(a[0]+b[0])/2+(pt?0.35:-0.35),(a[1]+b[1])/2];
      g+=`<path d="M${f(a[0])},${f(a[1])} Q${f(m[0])},${f(m[1])} ${f(b[0])},${f(b[1])}" fill="none" stroke="#000a26" stroke-opacity=".55" stroke-width=".05" stroke-linecap="round"/><path d="M${f(a[0]+0.04)},${f(a[1]+0.04)} Q${f(m[0]+0.04)},${f(m[1]+0.04)} ${f(b[0]+0.04)},${f(b[1]+0.04)}" fill="none" stroke="#5f86d6" stroke-opacity=".35" stroke-width=".03"/>`;}}
  if(C.elbow){for(const e of C.elbow)g+=`<path d="M${pts(e)}" fill="none" stroke="#000a26" stroke-opacity=".35" stroke-width=".05" stroke-linecap="round"/>`;}
  g+=`</g></g>`;
  g=pre+g+top;
  // buttons: 3 per side (CAPR 39-1 4.1.1.1); the one under the CAP seal is drawn (seal is worn over it)
  const btn=(p,id,t)=>{const q=P(p);return `<g id="${id}"><title>${t}</title><g transform="translate(${f(q[0])} ${f(q[1])}) scale(${BR2})">${hapArnold()}</g></g>`;};
  C.buttonsR.forEach((p,i)=>{g+=btn(p,'button-right-'+(i+1),'Wing-and-star button, wearer\'s right side');});
  C.buttonsL.forEach((p,i)=>{g+=btn(p,'button-left-'+(i+1),'Wing-and-star button, wearer\'s left side');});
  if(C.closure){const l=P(C.closure.l),r=P(C.closure.r);
    g+=`<path id="closure-chain" d="M${f(l[0])},${f(l[1])} Q${f((l[0]+r[0])/2)},${f(l[1]+0.5)} ${f(r[0])},${f(r[1])}" fill="none" stroke="#c9ccd2" stroke-width=".05" stroke-dasharray=".07 .035"><title>Silver chain connecting the two closure buttons</title></path>`
      +btn(C.closure.l,'closure-button-right','Closure button (chain)')+btn(C.closure.r,'closure-button-left','Closure button (chain)');}
  // CAP seal position: worn over the middle button on the wearer's right (4.1.1.1.2.3); empty marker
  {const q=P([C.seal.cx,C.seal.cy]),rr=1.25;g+=`<g id="cap-seal-slot"><title>CAP seal, worn over the middle button on the right side of the jacket (CAPR 39-1 4.1.1.1.2.3); 2 1/2 in medallion, blue-background version</title><rect x="${f(q[0]-rr)}" y="${f(q[1]-rr)}" width="${f(2*rr)}" height="${f(2*rr)}" fill="none"/><g id="cap-seal" transform="translate(${f(q[0])} ${f(q[1])})">${SEAL}</g></g>`;}
  // shoulder points for boards / chevron anchors
  {const a=P(C.shoulder.r),b=P(C.shoulder.l);g+=`<g id="shoulder-mark-right"><rect x="${f(a[0]-0.2)}" y="${f(a[1]-0.2)}" width=".4" height=".4" fill="none"/></g><g id="shoulder-mark-left"><rect x="${f(b[0]-0.2)}" y="${f(b[1]-0.2)}" width=".4" height=".4" fill="none"/></g>`;}
  // sleeve braid (officers): 1/2 in, 3 in from the sleeve end; separate overlay asset
  // sleeve end (lowest outline point) at an x in inches; the braid is cut parallel to the cuff: its edge nearest the sleeve end is d in from the end
  const endAt=x=>{let m=-1e9;const Pp=OUT.outline;for(let i=0;i<Pp.length;i++){const a=Pp[i],c=Pp[(i+1)%Pp.length];if((a[0]-x)*(c[0]-x)<=0&&a[0]!==c[0]){const y=a[1]+(c[1]-a[1])*(x-a[0])/(c[0]-a[0]);if(y>m)m=y;}}return m;};
  const mkBraid=w=>{let r='';const b=C.braid;for(const [y,xr,sd] of [[b.yL,b.xL,'right'],[b.yR,b.xR,'left']]){const xa=X(xr[0]),xc=X(xr[1]),p0=X(xr[0]+12),p1=X(xr[1]-12),e0=endAt(p0),e1=endAt(p1),sl=(e1-e0)/(p1-p0),ea=e0+sl*(xa-p0)-b.d,ec=e0+sl*(xc-p0)-b.d;   // cuff line sampled inside the sleeve, extrapolated to the braid ends
    r+=`<path id="sleeve-braid-${sd}-body" d="M${f(xa)},${f(ea-w)} L${f(xc)},${f(ec-w)} L${f(xc)},${f(ec)} L${f(xa)},${f(ea)} Z" fill="#1f4396" stroke="#0a1f5a" stroke-width=".02"/>`;}return r;};
  let br=mkBraid(0.5);const brG=mkBraid(1.5);
  return {g,brG:`<g id="sleeve-braid"><title>1 1/2 in blue sleeve braid, 3 in (men) / 2 1/2 in (women) from the end of each sleeve (general officers)</title>${brG}</g>`,br:`<g id="sleeve-braid"><title>1/2 in blue sleeve braid, 3 in (men) / 2 1/2 in (women) from the end of each sleeve (all officers except general officers, who wear 1 1/2 in)</title>${br}</g>`,OUT,X,Y,P};}

const sq=(inner,vb,name,px)=>{const cx=vb.x+vb.w/2,cy=vb.y+vb.h/2,s=Math.max(vb.w,vb.h);
  const x=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${cx-s/2} ${cy-s/2} ${s} ${s}" width="${px}" height="${px}"><rect x="${cx-s/2}" y="${cy-s/2}" width="${s}" height="${s}" fill="#fff"/>${DEFS3}${inner}</svg>`;
  const tmp=path.join(here,name+'.sq.svg');fs.writeFileSync(tmp,x);
  require('child_process').execSync(`qlmanage -t -s ${px} -o "${here}" "${tmp}" >/dev/null 2>&1 && mv "${tmp}.png" "${path.join(here,name+'_preview.png')}" && rm "${tmp}"`);};
function conv2({id,name,vb,body,source,meta}){const W=vb.w,H=vb.h,Wu=+(W*U).toFixed(2),Hu=+(H*U).toFixed(2);
  const art=`<g id="art" transform="translate(${f(-vb.x*U)} ${f(-vb.y*U)}) scale(${U})">${body}</g>`;
  const m={asset_id:id,name,size_in:{w:+W.toFixed(4),h:+H.toFixed(4)},units:'1 user unit = 0.01 in',viewBox:[0,0,Wu,Hu],...meta};
  let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W.toFixed(4)}in" height="${H.toFixed(4)}in" viewBox="0 0 ${Wu} ${Hu}" data-asset-id="${id}" data-source="${source}" data-units="0.01in"><title>${esc(name)}</title><metadata>${esc(JSON.stringify(m))}</metadata>${DEFS3}${art}</svg>`;
  svg=nsIds(svg,id);fs.writeFileSync(path.join(OUTDIR,id+'.svg'),svg);fs.writeFileSync(path.join(OUTDIR,id+'.spec.json'),JSON.stringify(m,null,1));return svg;}
for(const key of ['male','female']){
  const C=CONFIGS[key],R=build(C),OUT=R.OUT;
  const maxX=Math.max(...OUT.outline.map(p=>Math.abs(p[0])));
  const vb={x:-(maxX+0.25),y:-0.25,w:2*(maxX+0.25),h:OUT.heightIn+0.55};
  const A=std(vb.w*U,vb.h*U),uy=y=>(y-vb.y)*U;
  const LM={};const Rc=(k,i)=>{const r=lmRect(R.g,i,vb);if(r)LM[k]=r;},Pg=(k,i)=>{const p=lmPoly(R.g,i,vb);if(p)LM[k]=p;};
  // miniature medals: centred on the wearer's left between the lapel and the arm seam, midway between the top shoulder seam and the top button (4.1.1.1.2.2 / 4.1.2.1.2.2); slot size estimated
  {const xAt=(poly,y)=>{for(let i=0;i<poly.length-1;i++){const a=poly[i],c=poly[i+1];if((a[1]-y)*(c[1]-y)<=0&&a[1]!==c[1])return a[0]+(c[0]-a[0])*(y-a[1])/(c[1]-a[1]);}return poly[poly.length-1][0];};
   const ym=(C.shoulder.l[1]+C.buttonsL[0][1])/2,seam=C.seamsR||[C.shoulder.l,C.armhole.l],xc=(xAt(C.lapelOuterR,ym)+xAt(seam,ym))/2,q=R.P([xc,ym]),mw=3.0,mh=1.25;
   LM.miniature_medal_slot={x:+((q[0]-mw/2-vb.x)*U).toFixed(2),y:+((q[1]-mh/2-vb.y)*U).toFixed(2),w:mw*U,h:mh*U};}
  Rc('cap_seal','cap-seal-slot');Rc('shoulder_mark_right','shoulder-mark-right');Rc('shoulder_mark_left','shoulder-mark-left');
  Pg('shawl_right','shawl-right');Pg('shawl_left','shawl-left');Pg('shirt','shirt');Pg('cummerbund','cummerbund-body');
  if(C.bow)Pg('bow_tie','bow-knot');else Pg('tie_tab','tie-tab');
  const bl=(k,p)=>{const q=R.P(p);LM[k]={x:+((q[0]-BR2-vb.x)*U).toFixed(2),y:+((q[1]-BR2-vb.y)*U).toFixed(2),w:BR2*2*U,h:BR2*2*U};};
  C.buttonsR.forEach((p,i)=>bl('button_right_'+(i+1),p));C.buttonsL.forEach((p,i)=>bl('button_left_'+(i+1),p));
  const anchors={...A,hem_center:[A.top_center[0],uy(OUT.heightIn)],cap_seal_center:lmCen(LM.cap_seal),miniature_medals_center:lmCen(LM.miniature_medal_slot),shoulder_right_center:lmCen(LM.shoulder_mark_right),shoulder_left_center:lmCen(LM.shoulder_mark_left)};
  const notes={documented:key==='male'?['blue non-fastening single-breasted mess jacket, three wing-and-star / CAP arms / USAF arms buttons each side, satin shawl collar and lapels, two buttons joined by a silver chain close the front (CAPR 39-1 4.1.1.1)','white pleated shirt with studs, blue satin bow tie, plain blue satin cummerbund with the open edge of the pleats up (4.1.1.2, 4.1.1.2.3, 4.1.1.3.2)','no nametag on the mess dress (4.1.1.1.2.1)','CAP seal worn over the middle button on the right side of the jacket (4.1.1.1.2.3)','sleeve braid 1/2 in (1 1/2 in for general officers), 3 in from the sleeve end: separate overlay asset (4.1.1.1)']
    :['women\'s mess dress jacket and skirt with satin shawl collar (CAPR 39-1 4.1.2)','CAP seal worn over the middle button on the right side of the jacket (as on the men\'s, 4.1.1.1.2.3)','sleeve braid 1/2 in (1 1/2 in for general officers), 3 in from the sleeve end: separate overlay asset']};
  const id=C.id,body=R.g;
  const svg=conv2({id,name:C.name,vb,body,source:'reference-art-measured',meta:{size_source:'estimated',
    size_basis:`Silhouette traced from images/base/mess_dress_${key}.webp (581x719 px) at ${S} in/px (same canvas and scale assumption as the Class A coat; ${OUT.heightIn} in tall). No real garment was measured.`,
    anchors:Object.fromEntries(Object.entries(anchors).map(([k,v])=>[k,r2(v)])),landmarks:LM,landmarks_note:'rects are {x,y,w,h}; polygons are [[x,y]...]; all in user units (0.01 in), origin top-left of the artwork box',
    dimensions:{height_in:OUT.heightIn,max_width_in:+(2*maxX).toFixed(2),buttons_per_side:3,button_dia_in:BR2*2},documented:notes.documented,
    assumed:['px-to-inch scale','button diameter (about 0.8 in)','seal drawn at the 2 1/2 in diameter dimensioned in CAPR 39-1 Fig A6-4 (blue-background version); eagle/shield is the measured CAP Crest redraw, ring lettering set in Arial Bold outlines','shawl collar, shirt, cummerbund and cut-away geometry read off the base image','satin sheen colours sampled from the base image','sleeve braid colour'],
    fit:{method:'traced from the raster',score:null},grade:'garment'}});
  // braid overlay
  const bid=id+'-officer-sleeve-braid',BD=C.braid.d,LMbr=(body)=>{const o={};for(const t of ['right','left']){const q=lmPoly(body,'sleeve-braid-'+t+'-body',vb);if(q)o['sleeve_braid_'+t]=q;}return o;};
  conv2({id:bid,name:C.name.replace(/ \(blank.*$/,'')+': officer sleeve braid overlay (1/2 in, 3 in from the sleeve end)',vb,body:R.br,source:'reference-art-measured',meta:{size_source:'estimated',
    size_basis:`Same artwork box and scale as ${id}. Braid 0.5 in wide, its edge nearest the sleeve end ${BD} in from the sleeve end (cut parallel to the cuff) per CAPR 39-1 ${key==='male'?'4.1.1.1':'4.1.2.1'}; general officers wear 1 1/2 in (separate overlay).`,
    anchors:{...A},landmarks:LMbr(R.br),landmarks_note:'polygons are [[x,y]...] in user units (0.01 in)',overlay_of:id,documented:[`1/2 in blue sleeve braid ${BD} in from the end of the sleeve, all officers except generals (${key==='male'?'4.1.1.1':'4.1.2.1'})`],assumed:['braid colour'],fit:{method:'measured',score:null},grade:'garment'}});
  conv2({id:id+'-general-officer-sleeve-braid',name:C.name.replace(/ \(blank.*$/,'')+': general officer sleeve braid overlay (1 1/2 in, 3 in from the sleeve end)',vb,body:R.brG,source:'reference-art-measured',meta:{size_source:'estimated',
    size_basis:`Same artwork box and scale as ${id}. Braid 1.5 in wide per CAPR 39-1 ${key==='male'?'4.1.1.1':'4.1.2.1'} (the sleeve end is ${BD} in below its lower edge).`,
    anchors:{...A},landmarks:LMbr(R.brG),landmarks_note:'polygons are [[x,y]...] in user units (0.01 in)',overlay_of:id,documented:['1 1/2 in blue sleeve braid for general officers (4.1.1.1 / 4.1.2.1)'],assumed:['braid colour','1 1/2 in braid edge nearest the sleeve end set at the same distance as the 1/2 in braid'],fit:{method:'measured',score:null},grade:'accessory'}});
  // officer shoulder boards (CAPR 39-1 4.1.1.1.1.1 / 4.1.2.1.1.1): 1/2 in dark blue braid down each side of the board, button at the peak (men only), as close to the shoulder seam as possible
  for(const VAR of ['officer','general']){const o=OUT.outline,topY=x=>{let b=1e9;for(let i=0;i<o.length;i++){const a=o[i],c=o[(i+1)%o.length],ax=Math.abs(a[0]),cx=Math.abs(c[0]);if(a[0]*c[0]<0)continue;if((ax-x)*(cx-x)<=0&&ax!==cx){const y=a[1]+(c[1]-a[1])*(x-ax)/(cx-ax);if(y<9&&y<b)b=y;}}return b;};
   const sm={right:R.P(C.shoulder.r),left:R.P(C.shoulder.l)},Pj=a=>a.map(p=>f(p[0])+','+f(p[1])).join('L');
   let body2='';const LMb={};
   // Fig A5-3: men's boards 5 1/2 x 2 1/4 in with a button at the top, 1/2 in lace each side; women's 4 1/2 x 2 in, no button, 1/2 in lace each side (paragraph text, per Ethan; the Fig A5-3 caption says 1/4 in); non-generals covered in Air Force blue material, generals in silver lace
   const BL=key==='male'?5.5:4.5,BW=key==='male'?2.25:2.0,LACE=0.5,FILL=VAR==='general'?'#c4c8d0':'#2b4f93';
   for(const [tag,s] of [['right',-1],['left',1]]){const x0=Math.abs(sm[tag][0])-0.35,T=[s*x0,topY(x0)],I=[s*(x0-BL*0.97),topY(x0-BL*0.97)],dx=I[0]-T[0],dy=I[1]-T[1],L=BL,u=[dx/L,dy/L],n0=[-u[1],u[0]],n=n0[1]>0?n0:[u[1],-u[0]];
     const w=BW,at=(t,q)=>[T[0]+u[0]*t+n[0]*q,T[1]+u[1]*t+n[1]*q];
     const outline=[at(0,0),at(L-0.8,0),at(L,w/2),at(L-0.8,w),at(0,w)];
     const strip=(q0,q1)=>[at(0,q0),at(L-0.8+0.8*(q0/(w/2)),q0),at(0,q1)].length&&[at(0,q0),at(L-0.8,q0),at(L-0.8,q1),at(0,q1)];
     body2+=`<g id="shoulder-board-${tag}"><title>Officer shoulder board, ${tag} shoulder (blank: bullion grade insignia on the silver centre)</title><path id="shoulder-board-${tag}-body" d="M${Pj(outline)}Z" fill="${FILL}" stroke="#4d535d" stroke-width=".04" stroke-linejoin="round"/>`
       +`<path d="M${Pj([at(0,0),at(L-0.8,0),at(L-0.8+0.45*LACE/0.5,LACE),at(0,LACE)])}Z" fill="#12296d"/><path d="M${Pj([at(0,w),at(L-0.8,w),at(L-0.8+0.45*LACE/0.5,w-LACE),at(0,w-LACE)])}Z" fill="#12296d"/>`
       +(key==='male'?`<circle cx="${f(at(L-0.5,w/2)[0])}" cy="${f(at(L-0.5,w/2)[1])}" r=".2" fill="#d6d9df" stroke="#7d828b" stroke-width=".03"/>`:'')+`</g>`;
     // rank slot: centred on the silver centre (between the 1/2 in braids, 0.1 in margin each side) at 45% of the board; 2.0 in along the board (stacked Major General bullion is 1.81 in)
     const rc=at(L*0.45,w/2),shw=(w-2*LACE)/2,sc=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>at(L*0.45+1.0*a,w/2+shw*b)),sxs=sc.map(p=>p[0]),sys=sc.map(p=>p[1]);
     body2+=`<g id="rank-slot-${tag}"><rect x="${f(Math.min(...sxs))}" y="${f(Math.min(...sys))}" width="${f(Math.max(...sxs)-Math.min(...sxs))}" height="${f(Math.max(...sys)-Math.min(...sys))}" fill="none"/></g>`;
     const xs=outline.map(p=>p[0]),ys=outline.map(p=>p[1]);
     LMb['shoulder_board_'+tag]={x:+((Math.min(...xs)-vb.x)*U).toFixed(2),y:+((Math.min(...ys)-vb.y)*U).toFixed(2),w:+((Math.max(...xs)-Math.min(...xs))*U).toFixed(2),h:+((Math.max(...ys)-Math.min(...ys))*U).toFixed(2)};
     LMb['rank_slot_'+tag]={x:+((Math.min(...sxs)-vb.x)*U).toFixed(2),y:+((Math.min(...sys)-vb.y)*U).toFixed(2),w:+((Math.max(...sxs)-Math.min(...sxs))*U).toFixed(2),h:+((Math.max(...sys)-Math.min(...sys))*U).toFixed(2)};
     LMb['rank_slot_'+tag+'_frame']={deg:+(Math.atan2(u[1],u[0])*180/Math.PI).toFixed(1),along:2.0,across:+(2*shw).toFixed(3)};}
   conv2({id:id+(VAR==='general'?'-general':'')+'-officer-shoulder-boards',name:C.name.replace(/ \(blank.*$/,'')+(VAR==='general'?': general officer shoulder boards (silver lace, overlay, blank grade)':': officer shoulder boards (Air Force blue, overlay, blank grade)'),vb,body:body2,source:'original',meta:{size_source:'estimated',
    size_basis:`Same artwork box and scale as ${id}. Board ${BL} x ${BW} in per CAPR 39-1 Figure A5-3 (men's 5 1/2 x 2 1/4 in with button; women's 4 1/2 x 2 in); ${VAR==='general'?'general officer boards are covered in silver lace':'other officers boards are covered in Air Force blue material'}, ${LACE} in blue lace each side.`,
    anchors:{...A,rank_slot_right_center:lmCen(LMb.rank_slot_right),rank_slot_left_center:lmCen(LMb.rank_slot_left)},landmarks:LMb,landmarks_note:'rects are {x,y,w,h} in user units (0.01 in)',overlay_of:id,
    documented:[`officers wear shoulder boards with bullion grade insignia and 1/2 in dark blue braid (paragraph text 4.1.2.1.1.1, per Ethan; the Fig A5-3 caption says 1/4 in for women) down each side${key==='male'?', with a button at the peak':'; women\'s boards have no button'} (CAPR 39-1 ${key==='male'?'4.1.1.1.1.1':'4.1.2.1.1.1'})`,'placed as close to the shoulder seam as possible'],
    assumed:['Air Force blue / silver lace colours sampled, not specified as RGB','braid shade 1095 approximated','peak taper 0.8 in','grade insignia not drawn: placed at rank_slot'],fit:{method:'original',score:null},grade:'accessory'}});}
  sq(R.g,vb,'mess_dress_'+key,+(process.env.PX||1000));sq(R.g+R.br,vb,'mess_dress_'+key+'_braid',+(process.env.PX||1000));
  console.log(key,svg.length);
}

// ---- standalone CAP seal (same art as on the mess dress), into assets/insignia
{const id='insignia-cap-seal',vb={x:-1.25,y:-1.25,w:2.5,h:2.5},body=`<g id="seal">${SEAL}</g>`;
 conv({id,name:'CAP seal (2 1/2 in medallion, blue background) as worn over the middle button of the mess dress',vb,body,source:'original',
  meta:{size_source:'regulation',size_citation:'CAPR 39-1 (3 Mar 2020) Figure A6-4, CAP Crest and Seal',size_basis:'CAPR 39-1 Figure A6-4 (CAP Crest and Seal) dimensions the seal at 2 1/2 in diameter.',anchors:Object.fromEntries(Object.entries(std(250,250)).map(([k,v])=>[k,r2(v)])),
   landmarks:{},landmarks_note:'rects are {x,y,w,h}; all in user units (0.01 in), origin top-left',
   documented:['CAP seal worn over the middle button on the right side of the mess dress jacket (CAPR 39-1 4.1.1.1.2.3, 4.1.2.1.2.3)','2 1/2 in diameter (Fig A6-4)'],
   assumed:['blue-background version drawn (the gray-background enamel variant is also authorized)','ring lettering and star count read from the figure'],
   fit:{method:'original',score:null},grade:'accessory'}});
 const dst=path.join(here,'..','assets','insignia');fs.mkdirSync(dst,{recursive:true});
 for(const e of ['.svg','.spec.json'])fs.renameSync(path.join(OUTDIR,id+e),path.join(dst,id+e));}
