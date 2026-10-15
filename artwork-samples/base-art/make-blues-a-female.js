// Class A (women's service dress coat, new style, CAPR 39-1 4.1.9) built from the traced base image images/base/jacket_female.webp (612x753 px).
// Silhouette traced (trace-silhouette.js -> jacket_female_outline.json, 0.047 in/px: coat width matched to the men's coat per Figures 4.6/4.7a);
// interior parts are parametric in inches. Raster -> inch: x=(px-301)*S, y=(py-46)*S (the trace's own cx, y0).
const fs=require('fs'),path=require('path');
const f=n=>(+n).toFixed(3),STROKE='#00102f';
const OUT=JSON.parse(fs.readFileSync(path.join(__dirname,'jacket_female_outline.json'),'utf8'));
// COAT_K: the traced women's coat (0.047 in/px) came out ~12% oversized against the men's coat and the women's Class B / mess dress
// (27.3 x 32.95 in vs 23.3 x 29.5 in). The whole garment group is built in the traced frame and scaled by K at output (conv());
// real hardware (buttons, nametags, board size, CAP letters) is counter-scaled by 1/K so it keeps its true size.
const K=+(process.env.COAT_K||0.88);
const S=OUT.scale,X=px=>(px-OUT.cx)*S,Y=py=>(py-OUT.y0)*S,P=(px,py)=>[X(px),Y(py)];
const HEM=OUT.heightIn,NAVY='#001c52',SHIRT='#c6cde8';
const poly=a=>'M'+a.map(p=>f(p[0])+','+f(p[1])).join('L')+'Z';
const SIL=poly(OUT.outline)+OUT.holes.map(poly).join('');
const mir=p=>[-p[0],p[1]];
const here=__dirname,OUTDIR=path.join(here,'..','assets','garments'),U=100;
fs.mkdirSync(OUTDIR,{recursive:true});
const DEFS2=`<defs>
<linearGradient id="coatShade" gradientUnits="userSpaceOnUse" x1="-12" y1="0" x2="12" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".30"/><stop offset=".12" stop-color="#000" stop-opacity=".08"/><stop offset=".3" stop-color="#000" stop-opacity="0"/><stop offset=".7" stop-color="#000" stop-opacity="0"/><stop offset=".88" stop-color="#000" stop-opacity=".08"/><stop offset="1" stop-color="#000" stop-opacity=".30"/></linearGradient>
<linearGradient id="collarIn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7e8bb8"/><stop offset="1" stop-color="#b3bcdc"/></linearGradient>
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
const scaleK=v=>Array.isArray(v)?v.map(scaleK):(v&&typeof v==='object')?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,scaleK(x)])):typeof v==='number'?+(v*K).toFixed(2):v;
function conv({id,name,vb,body,source,meta}){
  const W=vb.w*K,H=vb.h*K,Wu=+(W*U).toFixed(2),Hu=+(H*U).toFixed(2);
  meta={...meta,anchors:scaleK(meta.anchors),landmarks:scaleK(meta.landmarks)};
  const art=`<g id="art" transform="translate(${f(-vb.x*U*K)} ${f(-vb.y*U*K)}) scale(${f(U*K)})">${body}</g>`;
  const m={asset_id:id,name,size_in:{w:+W.toFixed(4),h:+H.toFixed(4)},units:'1 user unit = 0.01 in',viewBox:[0,0,Wu,Hu],...meta};
  let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W.toFixed(4)}in" height="${H.toFixed(4)}in" viewBox="0 0 ${Wu} ${Hu}" data-asset-id="${id}" data-source="${source}" data-units="0.01in"><title>${esc(name)}</title><metadata>${esc(JSON.stringify(m))}</metadata>${DEFS2}${art}</svg>`;
  svg=nsIds(svg,id);
  fs.writeFileSync(path.join(OUTDIR,id+'.svg'),svg);fs.writeFileSync(path.join(OUTDIR,id+'.spec.json'),JSON.stringify(m,null,1));return svg;}
const std=(W,H)=>({top_center:[W/2,0],bottom_center:[W/2,H],center:[W/2,H/2],left_edge:[0,H/2],right_edge:[W,H/2]});
const r2=a=>a.map(v=>+(+v).toFixed(2));

// ---- hap Arnold / capCrest / lettering / etc. are the same as the men's coat generator; see make-blues-a.js
// ---- geometry (raster px read off jacket_female.webp)
const CXPX=300,CLX=px=>(px-CXPX)*S;
const LAP={neck:P(242.5,45),coll:P(208.75,81),n1:P(191,122),n2:P(191,138),n3:P(222.5,152.5),n4:P(252,143),gorge:P(255,147),
  l1:P(225,158),peak:P(192.5,166),l2:P(200,190),l3:P(232.5,237.5),l4:P(265,290),close:P(300,317.5)};
const BUT=[[CLX(288),Y(360)],[CLX(288),Y(442)],[CLX(287)  ,Y(526)]],BR=0.4375;
const FRONT_X=CLX(306);
const WELT={x:CLX(352),y:Y(291),w:4.2,h:0.6};
const PLATE={w:3.375,h:0.75,cx:CLX(200),cy:WELT.y-0.375/K};   // bottom of the tag even with the top of the ribbons (they rest on the welt top), CAPR 39-1 4.1.9.4.2
const BD=JSON.parse(fs.readFileSync(path.join(__dirname,'board','board.json'),'utf8')),BE=JSON.parse(fs.readFileSync(path.join(__dirname,'board','emblem.json'),'utf8'));
const BN=BE.button,EM_L=BE.loops;
const EPAU={w:4.55,h:252*4.55/622,cx:6.9,top:-0.105};
const ARML=[[100,105],[120,190],[137,215],[132,290],[131,352]],ARMR=[[510,110],[470,190],[462,240],[470,290],[475,352]];
const WHITE='#f3f4f8';
function garment(V){
  V=V||{};const SH=V.shirt||SHIRT;
  let g=`<defs><clipPath id="clipSil"><path d="${SIL}" clip-rule="evenodd"/></clipPath></defs>`;
  g+=`<g id="coat-body"><path id="silhouette" d="${SIL}" fill="${NAVY}" fill-rule="evenodd" stroke="${STROKE}" stroke-opacity=".6" stroke-width=".06" stroke-linejoin="round"/>`
    +`<g clip-path="url(#clipSil)">`;
  // blouse: collar showing above the coat collar, V opening, inverted-V tie tab (navy, CAPR 39-1 4.1.9.5)
  const tipL=P(243.5,48.5),tipR=P(356.5,49),cV=P(299,142);
  const shirtPath=`M${f(tipL[0])},${f(tipL[1])} Q${f(cV[0])},${f(cV[1])} ${f(tipR[0])},${f(tipR[1])} L${f(X(347.5))},${f(Y(150))} L${f(X(340))},${f(Y(170))} L${f(X(300))},${f(Y(315))} L${f(X(258.75))},${f(Y(170))} L${f(X(252.5))},${f(Y(150))} Z`;
  g+=`<path id="shirt" d="${shirtPath}" fill="${SH}"/>`;
  const tab=[[299.25,100],[346,149],[340,170],[300,124],[258.75,170],[253.75,148]].map(p=>P(p[0],p[1]));
  g+=`<path id="tie-tab" d="M${tab.map(p=>f(p[0])+','+f(p[1])).join('L')}Z" fill="#0b2263" stroke="#06143f" stroke-width=".03"/>`;
  // shirt collar: back-of-neck interior (darker) and two turn-down collar leaves over the blouse front
  g+=`</g>`;
  {const sh=SH===WHITE?'#d5d9e4':'#a9b3d6',
     nb=OUT.outline.filter(p=>p[1]>=0.75&&p[1]<=2.4&&Math.abs(p[0])<=2.35),
     open='M'+[[-2.6,0.28],[-1.4,0.12],[0,0.08],[1.4,0.12],[2.6,0.28]].concat(nb.slice().sort((p,q)=>p[0]-q[0]).reverse()).map(p=>f(p[0])+','+f(p[1])).join('L')+'Z';
   g+=`<path id="collar-back" d="${open}" fill="url(#collarIn)"/>`;
   for(const s of [-1,1]){
     const top=[s*2.34,0.8],tip=[s*1.75,2.95],inn=[s*0.0,2.34],bw=nb.filter(p=>p[0]*s>0.2).sort((p,q)=>s*(p[0]-q[0]));
     const edge=bw.map(p=>f(p[0])+','+f(p[1])).join('L');
     g+=`<path d="M${f(top[0])},${f(top[1])} L${f(tip[0])},${f(tip[1])} L${f(inn[0])},${f(inn[1])} Z" fill="#000a24" fill-opacity=".2" transform="translate(0 0.07)"/>`
       +`<path id="collar-leaf-${s<0?'right':'left'}" d="M${f(top[0])},${f(top[1])} L${f(tip[0])},${f(tip[1])} L${f(inn[0])},${f(inn[1])} L${edge}Z" fill="${SH}" stroke="${sh}" stroke-width=".05" stroke-linejoin="round"/>`
       +`<path d="M${f(top[0]-s*0.1)},${f(top[1]+0.15)} L${f(tip[0]-s*0.1)},${f(tip[1]-0.12)}" stroke="#fff" stroke-opacity=".35" stroke-width=".05" stroke-linecap="round"/>`;}}
  g+=`<g clip-path="url(#clipSil)">`;
  // lapels + collar piece (notch lapel)
  // coat collar + lapel face live in their own opaque group `lapel-foreground` (builder draws it above badges and above the blouse collar)
  let lf='';
  for(const s of [-1,1]){const tag=s<0?'right':'left',m=p=>[s*Math.abs(p[0]),p[1]];
    const c=[LAP.neck,LAP.coll,LAP.n1,LAP.n2,LAP.n3,LAP.n4].map(m),l=[LAP.gorge,LAP.l1,LAP.peak,LAP.l2,LAP.l3,LAP.l4,LAP.close].map(m);
    const vE=[[X(258.75),Y(170)],[X(252.5),Y(150)],tipL].map(p=>[s*Math.abs(p[0]),p[1]]);
    lf+=`<path id="lapel-face-${tag}" d="M${[...c,...l,...vE].map(p=>f(p[0])+','+f(p[1])).join('L')}Z" fill="${NAVY}"/>`;
    lf+=`<path id="collar-${tag}" d="M${c.map(p=>f(p[0])+','+f(p[1])).join('L')}" fill="none" stroke="${STROKE}" stroke-opacity=".5" stroke-width=".045" stroke-linejoin="round"/>`;
    lf+=`<path id="lapel-${tag}" d="M${l.map(p=>f(p[0])+','+f(p[1])).join('L')}" fill="none" stroke="${STROKE}" stroke-opacity=".5" stroke-width=".045" stroke-linejoin="round"/>`;}
  g+=`<g id="lapel-foreground"><title>Coat collar and lapel faces (draw above badges and devices so they tuck under)</title>${lf}</g>`;
  // front closure: wearer's right panel laps over the left (women's coats), buttons on the lapping panel
  {const c0=P(300,317.5),ex=FRONT_X,D=`M${f(c0[0])},${f(c0[1])} C${f(c0[0]+0.05)},${f(c0[1]+0.3)} ${f(ex)},${f(Y(345))} ${f(ex)},${f(Y(380))} L${f(ex)},${f(HEM+0.2)}`;
   g+=`<path id="front-edge-shadow" d="${D}" fill="none" stroke="#000d30" stroke-opacity=".3" stroke-width=".18" stroke-linecap="butt" transform="translate(0.1 0)"/>`
     +`<path id="front-edge" d="${D}" fill="none" stroke="#000b28" stroke-opacity=".85" stroke-width=".05" stroke-linecap="round"/>`;}
  for(const [i,b] of BUT.entries())g+=`<g id="button-${i+1}"><title>Hap Arnold button, 36 ligne (7/8 in)</title><g transform="translate(${f(b[0])} ${f(b[1])}) scale(${f(BR/K)})">${hapArnold()}</g></g>`;
  g+=`<g id="welt-pocket"><rect x="${f(WELT.x)}" y="${f(WELT.y)}" width="${WELT.w}" height="${WELT.h}" fill="none" stroke="${STROKE}" stroke-opacity=".45" stroke-width=".05"/></g>`;
  // two lower pocket flaps (DAFI 36-2903 4.5.1.1; CAPR 39-1 4.1.5.2 / 4.1.9.2), placed from the regulation photographs (Fig 4.1 / 4.7)
  for(const s of [-1,1]){const P4=(()=>{const c=BUT[2][0],y3=BUT[2][1],sp=BUT[2][1]-BUT[1][1],xi=c+s*2.9,xo=c+s*6.3;return [[xi,y3+0.05],[xo,y3-0.5],[xo,y3+1.45],[xi,y3+2.0]];})();
    const d='M'+P4.map(p=>f(p[0])+','+f(p[1])).join('L')+'Z';
    g+=`<g id="pocket-flap-${s<0?'right':'left'}"><path d="${d}" transform="translate(0 0.07)" fill="#000a24" fill-opacity=".35"/><path d="${d}" fill="#00205f" fill-opacity=".55" stroke="${STROKE}" stroke-opacity=".7" stroke-width=".05" stroke-linejoin="round"/>`
      +`<path d="M${f(P4[0][0])},${f(P4[0][1]+0.22)} L${f(P4[1][0])},${f(P4[1][1]+0.22)}" stroke="${STROKE}" stroke-opacity=".4" stroke-width=".04"/></g>`;}
  // armhole seams
  for(const A of [ARML,ARMR])g+=seam('M'+A.map(p=>f(X(p[0]))+','+f(Y(p[1]))).join(' L'),.05);
  g+=`</g></g>`;
  if(!V.noPlate){const pl=PLATE;
    g+=`<g id="nameplate"><rect x="${f(pl.cx-pl.w/K/2)}" y="${f(pl.cy-pl.h/K/2)}" width="${f(pl.w/K)}" height="${f(pl.h/K)}" fill="none"><title>Nametag position (blank: cadet tags are blue, senior member tags silver), CAPR 39-1 4.1.9.4.2.2</title></rect></g>`;}
  return g;}
function boards(mode='strip',only=null){
  let g='';
  for(const [tag,cx] of [['right',gorge(-1).mid[0]],['left',gorge(1).mid[0]]])
    if(mode==='strip'||mode==='lapel')g+=`<g id="lapel-cap-${tag}"><title>CAP lapel insignia, ${tag} lapel (cadet officers, CAPR 39-1 4.1.9.4.1.2)</title><rect x="${f(cx-0.7/K)}" y="${f(gorge(tag==='right'?-1:1).mid[1]-0.5/K)}" width="${f(1.4/K)}" height="${f(0.5/K)}" fill="none"/><g transform="translate(${f(cx)} ${f(gorge(tag==='right'?-1:1).mid[1]-0.25/K)}) scale(${f(1/K)}) translate(${f(-cx)} ${f(-(gorge(tag==='right'?-1:1).mid[1]-0.25/K))})">${lettering('CAP',cx,gorge(tag==='right'?-1:1).mid[1]-0.25/K,0.5,'#f1f3f7',0.02,1.4,GLYB)}</g></g>`;
  const BLK='#15171c',RED='#c8453f',WHT='#f2f2f2',BLU='#2b4aa0';
  for(const s of [-1,1]){const tag=s<0?'right':'left';if(only&&tag!==only)continue;
    const topY=x=>{let b=1e9;const o=OUT.outline;for(let i=0;i<o.length;i++){const a=o[i],c=o[(i+1)%o.length],ax=Math.abs(a[0]),cx=Math.abs(c[0]);if(a[0]*c[0]<0)continue;if((ax-x)*(cx-x)<=0&&ax!==cx){const y=a[1]+(c[1]-a[1])*(x-ax)/(cx-ax);if(y<4&&y<b)b=y;}}return b;};
    const T=[s*9.0,topY(9.0)],I=[s*5.0,topY(5.0)],dx=I[0]-T[0],dy=I[1]-T[1],L=Math.hypot(dx,dy),u=[dx/L,dy/L],n=[-u[1],u[0]][1]>0?[-u[1],u[0]]:[u[1],-u[0]],th=0.32;
    const at=(t,o)=>[T[0]+u[0]*t+n[0]*o,T[1]+u[1]*t+n[1]*o],quad=(t0,t1,fill)=>`<path d="M${at(t0,0).map(f)} L${at(t1,0).map(f)} L${at(t1,th).map(f)} L${at(t0,th).map(f)} Z" fill="${fill}"/>`;
    const sbx=[at(0,0),at(L,0),at(L,th),at(0,th)],sx=sbx.map(p=>p[0]),sy=sbx.map(p=>p[1]);
    if(mode==='strip')g+=`<g id="shoulder-strip-${tag}"><rect id="epaulet-${tag}-box" x="${f(Math.min(...sx))}" y="${f(Math.min(...sy))}" width="${f(Math.max(...sx)-Math.min(...sx))}" height="${f(Math.max(...sy)-Math.min(...sy))}" fill="none"/>${quad(0,L,BLK)}${quad(0.0,0.1,RED)}${quad(0.1,0.18,WHT)}${quad(0.18,0.28,RED)}${quad(0.28,1.0,BLU)}${quad(1.0,1.08,RED)}${quad(1.08,1.16,WHT)}${quad(1.16,1.26,RED)}</g>`;
    const o=s*(EPAU.cx+EPAU.w/2),tip=s*(EPAU.cx-EPAU.w/2),dirOut=o>tip?1:-1,k=EPAU.w/(BD.bot-BD.top+1),clip=`board-clip-${tag}`;
    const xc=148,sil=`M${xc-6},27 L${xc+6},27 L${xc+123.5},139 L${xc+126},600 Q${xc+126},649 ${xc+100},649 L${xc-100},649 Q${xc-126},649 ${xc-126},600 L${xc-123.5},139 Z`;
    const lp=ls=>'M'+ls.map(l=>l.pts.map(q=>q.join(',')).join('L')).join('ZM')+'Z';
    const art=`<defs><clipPath id="${clip}"><path d="${sil}"/></clipPath></defs><path id="epaulet-${tag}-body" d="${sil}" fill="${BD.body}" stroke="#05060a" stroke-width="1.2"/>`
      +`<g clip-path="url(#${clip})">`+BD.bands.map(bd=>`<rect x="0" y="${bd.y0-1}" width="288" height="${bd.y1-bd.y0+3}" fill="${bd.color}"/>`).join('')+`</g>`
      +`<path d="${lp(EM_L)}" fill="#bfc3cb" fill-rule="evenodd"/>`
      +`<g transform="translate(${BN.cx} ${BN.cy}) scale(${BN.r})">${capCrest()}</g>`;
    const bcx=s*EPAU.cx,bcy=EPAU.top+EPAU.h/2;
    if(mode==='board')g+=`<g id="epaulet-${tag}"><title>Cadet officer shoulder board, ${tag} shoulder (blank: rank diamonds are sold separately and omitted here)</title>`
      +`<rect id="epaulet-${tag}-box" x="${f(bcx-EPAU.w/K/2)}" y="${f(bcy-EPAU.h/K/2)}" width="${f(EPAU.w/K)}" height="${f(EPAU.h/K)}" fill="none"/>`
      +`<g transform="translate(${f(bcx)} ${f(bcy)}) scale(${f(1/K)}) translate(${f(-bcx)} ${f(-bcy)})"><g transform="matrix(0 ${f(k)} ${f(dirOut*k)} 0 ${f(tip-dirOut*27*k)} ${f(EPAU.top-22*k)})">${art}</g></g></g>`;}
  return g;}

const maxX=Math.max(...OUT.outline.map(p=>Math.abs(p[0])));
const vbC={x:-(maxX+0.25),y:EPAU.top-0.14,w:2*(maxX+0.25),h:HEM-(EPAU.top-0.14)+0.3};
const A=std(vbC.w*U,vbC.h*U),ux=x=>(x-vbC.x)*U,uy=y=>(y-vbC.y)*U;
const common=(id,name,body,extra)=>{
  const LM={};const R=(k,i)=>{const r=lmRect(body,i,vbC);if(r)LM[k]=r;},Pg=(k,i)=>{const p=lmPoly(body,i,vbC);if(p)LM[k]=p;};
  extra.rects&&extra.rects.forEach(([k,i])=>R(k,i));extra.polys&&extra.polys.forEach(([k,i])=>Pg(k,i));
  return LM;};
// US lapel insignia: halfway up the collar/lapel seam, resting on it (CAPR 39-1 4.1.9.4.1.1); same point the senior layer draws it at
// gorge seam = where the collar meets the lapel (notch inner corner to the gorge point); lapel insignia rest on its midpoint, upright (CAPR 39-1 4.1.9.4.1)
const gorge=s=>{const p1=[s*Math.abs(LAP.n2[0]),LAP.n2[1]],p2=[s*Math.abs(LAP.gorge[0]),LAP.gorge[1]];return {p1,p2,mid:[(p1[0]+p2[0])/2,(p1[1]+p2[1])/2]};};
const seamMid=s=>gorge(s).mid;
const gorgeAnch={};for(const [s,t] of [[-1,'right'],[1,'left']]){const g=gorge(s);gorgeAnch['gorge_seam_'+t+'_p1']=g.p1;gorgeAnch['gorge_seam_'+t+'_p2']=g.p2;gorgeAnch['gorge_seam_'+t+'_mid']=g.mid;gorgeAnch['lapel_insignia_rest_'+t]=g.mid;gorgeAnch['lapel_insignia_'+t]=[g.mid[0],g.mid[1]-0.25/K];}
const gorgeU=Object.fromEntries(Object.entries(gorgeAnch).map(([k,v])=>[k,[ux(v[0]),uy(v[1])]]));
function emitCoat(id,name,V,notes){
  const body=garment(V);
  const LM=common(id,name,body,{rects:[...(V.noPlate?[]:[['nameplate','nameplate']]),['welt_pocket','welt-pocket'],['button_1','button-1'],['button_2','button-2'],['button_3','button-3']],
    polys:[['lapel_right','lapel-right'],['lapel_left','lapel-left'],['shirt','shirt'],['tie_tab','tie-tab']]});
  const SAm=require('./sleeve-anchors.js')({outline:OUT.outline,holes:OUT.holes,arm:ARML.map(p=>[X(p[0]),Y(p[1])]),long:true});
  const SAu=Object.fromEntries(Object.entries(SAm).map(([k,v])=>[k,[ux(v[0]),uy(v[1])]]));
  const anchors={...A,...SAu,centerline_top:[A.top_center[0],uy(0)],hem_center:[A.top_center[0],uy(HEM)],
    welt_top_center:[LM.welt_pocket.x+LM.welt_pocket.w/2,LM.welt_pocket.y],ribbon_row_bottom_center:[LM.welt_pocket.x+LM.welt_pocket.w/2,LM.welt_pocket.y],
    ...gorgeU,
    button_1_center:lmCen(LM.button_1),button_2_center:lmCen(LM.button_2),button_3_center:lmCen(LM.button_3)};
  BUT.forEach((b,i)=>{LM['button_'+(i+1)]={x:+((b[0]-BR/K-vbC.x)*U).toFixed(2),y:+((b[1]-BR/K-vbC.y)*U).toFixed(2),w:+(2*BR/K*U).toFixed(2),h:+(2*BR/K*U).toFixed(2)};anchors['button_'+(i+1)+'_center']=lmCen(LM['button_'+(i+1)]);});
  LM.ribbon_slot={x:+(LM.welt_pocket.x+LM.welt_pocket.w/2-206.25/K).toFixed(2),y:+(LM.welt_pocket.y-150/K).toFixed(2),w:+(412.5/K).toFixed(2),h:+(150/K).toFixed(2)};   // 4.125 x 1.5 in true size, resting on the welt top (4.1.9.4.3)
  if(LM.nameplate)anchors.nameplate_center=lmCen(LM.nameplate);
  const svg=conv({id,name,vb:vbC,body,source:'reference-art-measured',
    meta:{size_source:'estimated',size_basis:`Silhouette traced from images/base/jacket_female.webp (612x753 px) at ${OUT.scale} in/px, then scaled by ${K} so the coat is as wide as the men's coat plus the women's cut (CAPR 39-1 Figures 4.6 and 4.7a show the two coats at about the same width); before this factor the box was ${(vbC.w).toFixed(2)} x ${(vbC.h).toFixed(2)} in. No real garment was measured. Coat ${(HEM*K).toFixed(2)} in long. Buttons, nametag and other hardware keep their true size.`,
      anchors:Object.fromEntries(Object.entries(anchors).map(([k,v])=>[k,r2(v)])),
      landmarks:LM,landmarks_note:'rects are {x,y,w,h}; polygons are [[x,y]...]; all in user units (0.01 in), origin top-left of the artwork box',
      dimensions:{coat_length_in:+(HEM*K).toFixed(2),max_width_in:+(2*maxX*K).toFixed(2),welt_in:[+(WELT.w*K).toFixed(2),+(WELT.h*K).toFixed(2)],buttons:3,button_dia_in:BR*2,...(V.noPlate?{}:{nameplate_in:[PLATE.w,PLATE.h]})},
      documented:['single breasted, three buttons (Wing and Star or CAP Crest), one welt pocket upper left, two lower pocket flaps (CAPR 39-1 4.1.9.2)','right panel laps over the left on the women\'s coat (as in the base image)','blouse collar shows above the coat collar; inverted-V tie tab mandatory (4.1.9.5, 4.1.4.4)',...notes.documented],
      assumed:['px-to-inch scale','welt size','button diameter 7/8 in','lapel, blouse and tie-tab geometry read off the base image','lower pocket flaps are not drawn (barely visible in the base image)','colours sampled from the base image',...notes.assumed],
      fit:{method:'traced from the raster',score:null},grade:'garment'}});
  return {svg,body};}
const coat=emitCoat('garment-blues-class-a-coat-female',"Women's Class A service dress coat (new style), cadet NCO/airman base: blank cadet nameplate, no boards, no lapel insignia",{},
  {documented:['nameplate centred on wearer\'s right between sleeve seam and lapel, bottom even with the bottom of the ribbons (4.1.9.4.2)'],assumed:['nameplate size (3.375 x 0.75 in = Vanguard CAP0599M cadet name plate)']});
const semi=emitCoat('garment-semiformal-class-a-coat-female',"Women's cadet semi-formal dress: Class A coat (new style) over the white blouse, no nametag",{shirt:WHITE,noPlate:true},
  {documented:['semi-formal: worn as service dress with a white blouse, nametag not worn (CAPR 39-1 4.1.4, 4.1.4.1, 4.1.4.3)','blue satin inverted-V tie tab (4.1.4.4)'],assumed:['white blouse tone']});
{const NT=require('./nametag-art.js')(lettering);const A=std(vbC.w*U,vbC.h*U),cid='garment-blues-class-a-coat-female';
 for(const [tag,kind,who,reg] of [['cadet','cadet','Cadet','4.1.9.4.2.2: blue, three-line, white lettering'],['officer-nco','silver','Officer/NCO','4.1.9.4.2.1: metal, brushed satin silver, last name engraved in blue']]){
  const pb=NT[kind](PLATE.cx,PLATE.cy),body=`<g transform="translate(${f(PLATE.cx)} ${f(PLATE.cy)}) scale(${f(1/K)}) translate(${f(-PLATE.cx)} ${f(-PLATE.cy)})">${pb}</g>`;
  const r0=lmRect(pb,'nametag-plate',vbC),r={x:+(r0.x-r0.w*(1/K-1)/2).toFixed(2),y:+(r0.y-r0.h*(1/K-1)/2).toFixed(2),w:+(r0.w/K).toFixed(2),h:+(r0.h/K).toFixed(2)},LMn={nametag:r};
  conv({id:cid+'-nametag-'+tag,name:`Women's Class A coat nametag, ${who.toLowerCase()} (overlay, registered to ${cid}; name left blank)`,vb:vbC,body,source:'original',
   meta:{size_source:'estimated',size_basis:kind==='cadet'?'3 3/8 x 3/4 in = Vanguard CAP0599M cadet name plate; the regulation gives no dimension.':'Metal officer/NCO tag drawn at the same 3 3/8 x 3/4 in as the cadet plate (cross-chat standard plate size); the regulation gives no dimension and no vendor plate was cited for 3.0 x 0.7 in.',
    anchors:{...A,nametag_center:lmCen(r)},landmarks:LMn,landmarks_note:'rects are {x,y,w,h} in user units (0.01 in)',overlay_of:cid,
    documented:[`${who} nametag (CAPR 39-1 ${reg})`,'centred on the wearer\'s right between the sleeve seam and lapel, bottom even with the bottom of the ribbons'],
    assumed:['plate size','name line blank'],fit:{method:'original',score:null},grade:'accessory'}});}}
// coat collar + lapel foreground overlay (same box as the coat)
{const gm=coat.body.match(/<g id="lapel-foreground">[\s\S]*?<\/g>/)[0],body=`<defs><clipPath id="lfClip"><path d="${SIL}" clip-rule="evenodd"/></clipPath></defs><g clip-path="url(#lfClip)">${gm}</g>`,cid='garment-blues-class-a-coat-female';
 const LMf={};for(const t of ['right','left']){const q=lmPoly(body,'lapel-face-'+t,vbC);if(q)LMf['lapel_face_'+t]=q;}
 conv({id:cid+'-lapel-foreground',name:"Women's Class A service dress coat collar and lapels (foreground overlay, registered to "+cid+"; also fits the semi-formal coat)",vb:vbC,body,source:'reference-art-measured',
  meta:{size_source:'estimated',size_basis:'Same artwork box and scale as '+cid+'; collar and lapel faces redrawn opaque so they cover the blouse collar and any badge or device that slides under them.',
   anchors:{...std(vbC.w*U,vbC.h*U)},landmarks:LMf,landmarks_note:'polygons are [[x,y]...] in user units (0.01 in)',overlay_of:cid,documented:['badges and devices worn under the coat collar/lapel tuck beneath it (builder layering)'],assumed:['layer order: above badges'],fit:{method:'original',score:null},grade:'accessory'}});}
// shoulder cord overlays (one per colour), registered to the coat box and to the semi-formal coat; drawn under the epaulet / board layer
{const CA=require('./cord-art.js')(ARMR.map(p=>[X(p[0]),Y(p[1])]),K),A2=std(vbC.w*U,vbC.h*U);
 for(const [gid,gname] of [['garment-blues-class-a-coat-female',"Women's Class A service dress coat"],['garment-semiformal-class-a-coat-female',"Women's cadet semi-formal coat"]])
  for(const c of CA.CORDS){const body=CA.bodies[c],LMk={cord:lmPoly(body,'cord-path',vbC)};
   conv({id:gid+'-cord-'+c,name:`${gname}: ${CA.meta[c].name} (overlay, registered to ${gid})`,vb:vbC,body,source:'original',
    meta:{size_source:'estimated',size_basis:'Same box and scale as '+gid+'; 0.36 in braid (true size) following the wearer\'s left armhole seam; colours from assets/cords/cord-'+c+'.spec.json. The regulation gives no cord dimension.',anchors:{...A2,cord_start:[ux(CA.pts[0][0]),uy(CA.pts[0][1])],cord_end:[ux(CA.pts[CA.pts.length-1][0]),uy(CA.pts[CA.pts.length-1][1])]},landmarks:LMk,landmarks_note:'polygons are [[x,y]...] in user units (0.01 in)',overlay_of:gid,documented:['shoulder cords are worn on the left shoulder aligned along the shoulder seam, underneath the epaulet (CAPR 39-1 9.3)'],assumed:['cord thickness 0.36 in','path along the armhole seam'],fit:{method:'original',score:null},grade:'accessory'}});}}
// CAP lapel letters as their own layer (draw above the coat's lapel-foreground)
{const body=boards('lapel'),LMl={},cid='garment-blues-class-a-coat-female';for(const t of ['right','left']){const c=lmRect(body,'lapel-cap-'+t,vbC);if(c)LMl['lapel_cap_'+t]=c;}
 conv({id:cid+'-lapel-cap',name:"Women's Class A coat CAP lapel insignia, cadet officers (overlay; draw above the lapel foreground)",vb:vbC,body,source:'original',
  meta:{size_source:'estimated',size_basis:'Same box and scale as '+cid+'; CAP letters 0.5 in tall x 1.4 in wide, true size (CAPR 39-1 4.1.9.4.1.2).',anchors:{...std(vbC.w*U,vbC.h*U),lapel_cap_right_center:lmCen(LMl.lapel_cap_right),lapel_cap_left_center:lmCen(LMl.lapel_cap_left)},
   landmarks:LMl,landmarks_note:'rects are {x,y,w,h} in user units (0.01 in)',overlay_of:cid,documented:['CAP lapel insignia halfway up the seam, cadet officers only (4.1.9.4.1.2)'],assumed:['letter size'],fit:{method:'original',score:null},grade:'accessory'}});}
const boardsBody=boards(),boardsId='garment-blues-class-a-cadet-officer-insignia-female';
const LMb={};for(const t of ['right','left']){const r=lmRect(boardsBody,'epaulet-'+t+'-box',vbC);if(r){LMb['epaulet_'+t]=r;LMb['rank_slot_'+t]={...r};}   // compat: edge-on strip; grade goes on the top-down board asset   // true size 1.5 x 1.2 in (scaled by K with the coat)
const c=lmRect(boardsBody,'lapel-cap-'+t,vbC);if(c)LMb['lapel_cap_'+t]=c;}
conv({id:boardsId,name:"Women's Class A coat cadet officer insignia: shoulder boards + CAP lapel letters (overlay, registered to garment-blues-class-a-coat-female; blank rank)",vb:vbC,body:boardsBody,source:'reference-art-measured',
  meta:{size_source:'estimated',size_basis:'Same artwork box and px-to-inch scale as garment-blues-class-a-coat-female so it drops on at 0,0. Board length 4.55 in (builder reference); width from the Vanguard CAP0647V product photo proportions (252 x 622 px).',
    anchors:{...A,epaulet_right_center:lmCen(LMb.epaulet_right),epaulet_left_center:lmCen(LMb.epaulet_left),rank_slot_right_center:lmCen(LMb.rank_slot_right),rank_slot_left_center:lmCen(LMb.rank_slot_left)},
    landmarks:LMb,landmarks_note:'rects are {x,y,w,h} in user units (0.01 in)',overlay_of:'garment-blues-class-a-coat-female',
    dimensions:{strip_thickness_in:0.32},documented:['cadet officers wear regular-size grade insignia on Cadet Officer shoulder boards (4.1.9.3.4)','CAP lapel insignia halfway up the lapel seam, cadet officers only; grade insignia replaces it for cadet NCOs/airmen, none for Airman Basic (4.1.9.4.1.2-3)'],
    assumed:['strip thickness 0.32 in','rank diamonds omitted (sold separately)'],fit:{method:'measured from product photo',score:null},grade:'garment'}});
const sq=(innerBody,vb,name,px)=>{const cx=vb.x+vb.w/2,cy=vb.y+vb.h/2,s=Math.max(vb.w,vb.h);
  const x=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${cx-s/2} ${cy-s/2} ${s} ${s}" width="${px}" height="${px}">${DEFS2}${innerBody}</svg>`;
  const tmp=path.join(here,name+'.sq.svg');fs.writeFileSync(tmp,x);
  require('child_process').execSync(`qlmanage -t -s ${px} -o "${here}" "${tmp}" >/dev/null 2>&1 && mv "${tmp}.png" "${path.join(here,name+'_preview.png')}" && rm "${tmp}"`);};
const PXN=+(process.env.PX||1000);
sq(coat.body,vbC,'blues_class_a_female',PXN);sq(semi.body,vbC,'semiformal_female',PXN);sq(coat.body+boardsBody,vbC,'blues_class_a_female_boards',PXN);
if(process.env.ALIGN)sq(coat.body,{x:X(306)-612*S/2,y:Y(376.5)-753*S/2,w:612*S,h:753*S},'blues_align_f',753);
console.log('ok',{coat:coat.svg.length,semi:semi.svg.length});
