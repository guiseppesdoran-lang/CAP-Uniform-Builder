// Aviator shirt (CAPR 39-1 4.2.5 men / 4.2.6 women): white short-sleeve aviator shirt, two flap pockets, epaulet straps, black belt, gray trousers.
// Silhouettes traced from images/base/aviator_shirt_{male,female}.webp (alpha) at 0.0376 in/px (shirt sleeve-to-sleeve ~20.8 in, same width as the
// Class B shirt). Female line-art is the smooth trace of the clean (1130x1392) re-render of the same drawing; male interior is parametric from
// coordinates read off the base image. Nametag / ribbons / insignia are NOT part of the base (slots only).
const fs=require('fs'),path=require('path');
const f=n=>(+n).toFixed(3),STROKE='#00102f';
const here=__dirname,OUTDIR=path.join(here,'..','assets','garments'),U=100;
fs.mkdirSync(OUTDIR,{recursive:true});
const DEFS2=`<defs>
<linearGradient id="coatShade" gradientUnits="userSpaceOnUse" x1="-12" y1="0" x2="12" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".30"/><stop offset=".12" stop-color="#000" stop-opacity=".08"/><stop offset=".3" stop-color="#000" stop-opacity="0"/><stop offset=".7" stop-color="#000" stop-opacity="0"/><stop offset=".88" stop-color="#000" stop-opacity=".08"/><stop offset="1" stop-color="#000" stop-opacity=".30"/></linearGradient>
<linearGradient id="topLight" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".10"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<radialGradient id="btn" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="#cfd3da"/><stop offset="1" stop-color="#8d939e"/></radialGradient>
<linearGradient id="collarIn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7e8bb8"/><stop offset="1" stop-color="#b3bcdc"/></linearGradient>
<linearGradient id="plate" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e4e6ea"/><stop offset="1" stop-color="#a9aeb8"/></linearGradient>
</defs>`;
const GLY=JSON.parse(fs.readFileSync(path.join(__dirname,'..','assets','tools','glyphs_arialbold_cap.json')));
const GLYB=JSON.parse(fs.readFileSync(path.join(__dirname,'..','assets','tools','glyphs_arialblack_cap.json')));
const lettering=(str,cx,cy,capH,fill,track=0.06,fitW=null,T=GLY)=>{const k=capH/71.58,ch=[...str],adv=ch.map(c=>c===' '?0.28*100:T[c].adv);
  const tw=adv.reduce((a,v)=>a+v,0)+track*100*(ch.length-1),kx=fitW?fitW/tw:k;let x=0,d='';
  ch.forEach((c,i)=>{if(c!==' ')d+=`<path transform="translate(${f(x)} 0)" d="${T[c].d}"/>`;x+=adv[i]+track*100;});
  return `<g fill="${fill}" transform="translate(${f(cx-tw*kx/2)} ${f(cy+capH/2)}) scale(${kx.toFixed(5)} ${k.toFixed(5)})">${d}</g>`;};
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

const WHITE='#f7f7f4',LINEC='#3a3a3a',GRAYT='#736f6c',BELT='#121212',S0=0.0376;
const poly=a=>'M'+a.map(p=>f(p[0])+','+f(p[1])).join('L')+'Z';
const r2=a=>a.map(v=>+(+v).toFixed(2));
const PW=3.375,PH=0.75;   // nametag slot (CAP plate size)
const wbutton=(x,y,r=0.22,id)=>{const holes=[[-1,-1],[1,-1],[-1,1],[1,1]].map(([a,b])=>{const hx=x+a*r*0.3,hy=y+b*r*0.3;return `<circle cx="${f(hx)}" cy="${f(hy)}" r="${f(r*0.12)}" fill="#2a2a2c"/>`;}).join('');
  const th=`<path d="M${f(x-r*0.3)},${f(y-r*0.3)} L${f(x+r*0.3)},${f(y+r*0.3)} M${f(x+r*0.3)},${f(y-r*0.3)} L${f(x-r*0.3)},${f(y+r*0.3)}" stroke="#d9d9d4" stroke-width="${f(r*0.07)}" stroke-linecap="round"/>`;
  return `<g${id?` id="${id}"`:''}><circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="url(#btnw)" stroke="#a9a9a4" stroke-width="${f(r*0.12)}"/><circle cx="${f(x)}" cy="${f(y)}" r="${f(r*0.66)}" fill="none" stroke="#bdbdb8" stroke-width="${f(r*0.08)}"/>${holes}${th}</g>`;};
// plain chrome slide buckle with the belt passing through (CAPR 39-1 4.2.5.1.6: plain silver buckle)
const BK={w:1.8,h:1.4};   // one buckle size for both shirts (reg: plain buckle, not to exceed 2 in, 4.2.3.5 / 4.2.5.1.6)
const buckleSvg=(cx,cy,w,h)=>{const x=cx-w/2,y=cy-h/2,t=Math.min(w,h)*0.17;
  return `<g id="belt-buckle"><rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx=".12" fill="url(#silver)" stroke="#6f7480" stroke-width=".025"/>`
   +`<rect x="${f(x+t)}" y="${f(y+t)}" width="${f(w-2*t)}" height="${f(h-2*t)}" rx=".05" fill="#0f0f10" stroke="#5d626d" stroke-width=".02"/>`
   +`<rect x="${f(cx-t*0.45)}" y="${f(y+t*0.6)}" width="${f(t*0.9)}" height="${f(h-1.2*t)}" rx=".04" fill="url(#silver)" stroke="#6f7480" stroke-width=".015"/>`
   +`<path d="M${f(x+0.08)},${f(y+0.07)} L${f(x+w-0.12)},${f(y+0.07)}" stroke="#fff" stroke-opacity=".75" stroke-width=".03" stroke-linecap="round"/></g>`;};
function build(G){
  const OUT=JSON.parse(fs.readFileSync(path.join(here,G.outline),'utf8')),cx=OUT.cx,y0=OUT.y0,HEM0=OUT.heightIn;let o=OUT.outline,HEM=HEM0;
  if(G.long){o=o.map(p=>p[1]>=HEM0-0.06?[p[0],G.long.hem]:p);HEM=G.long.hem;}
  const maxX=Math.max(...o.map(p=>Math.abs(p[0])));
  const S=G.S||0.0376,X=px=>(px-cx)*S,Y=py=>(py-y0)*S,mx=px=>2*cx-px;
  const topY=x=>{let b=1e9;for(let i=0;i<o.length;i++){const a=o[i],c=o[(i+1)%o.length];if((a[0]-x)*(c[0]-x)<=0&&a[0]!==c[0]){const y=a[1]+(c[1]-a[1])*(x-a[0])/(c[0]-a[0]);if(y<8&&y<b)b=y;}}return b;};
  const SIL=poly(o),ln=(d,w=.035,col=LINEC,op=.9)=>`<path d="${d}" fill="none" stroke="${col}" stroke-opacity="${op}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const pl=P=>'M'+P.map(p=>f(X(p[0]))+','+f(Y(p[1]))).join('L');
  let g=`<defs><clipPath id="clipSil"><path d="${SIL}"/></clipPath><linearGradient id="silver" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbfbfd"/><stop offset=".45" stop-color="#c9cdd6"/><stop offset=".55" stop-color="#9ea4b0"/><stop offset="1" stop-color="#d7dae1"/></linearGradient><radialGradient id="btnw" cx=".38" cy=".32" r=".8"><stop offset="0" stop-color="#ffffff"/><stop offset=".7" stop-color="#ececE8"/><stop offset="1" stop-color="#cfcfca"/></radialGradient><linearGradient id="shadeH" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6b7080" stop-opacity=".22"/><stop offset=".1" stop-color="#6b7080" stop-opacity=".05"/><stop offset=".3" stop-color="#6b7080" stop-opacity="0"/><stop offset=".7" stop-color="#6b7080" stop-opacity="0"/><stop offset=".9" stop-color="#6b7080" stop-opacity=".05"/><stop offset="1" stop-color="#6b7080" stop-opacity=".22"/></linearGradient><linearGradient id="shadeV" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6b7080" stop-opacity=".10"/><stop offset=".3" stop-color="#6b7080" stop-opacity="0"/><stop offset="1" stop-color="#6b7080" stop-opacity=".12"/></linearGradient><linearGradient id="dropS" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a4f5e" stop-opacity=".26"/><stop offset="1" stop-color="#4a4f5e" stop-opacity="0"/></linearGradient></defs>`;
  const covers=[];let extTop='';
  // long sleeves: extend the short-sleeve cuffs down to the wrist (silhouette corners are read off the outline itself)
  if(G.long){const endY=G.long.end,sleeveW=G.long.w||2.1,drop=1.1,upE=G.long.up||0;
    for(const sg of [-1,1]){const pts=o.filter(p=>sg*p[0]>5.5&&Math.abs(p[1]-G.long.cuffY)<0.55);
      const low=pts,outer=low.reduce((a,p)=>sg*p[0]>sg*a[0]?p:a),inner=low.reduce((a,p)=>sg*p[0]<sg*a[0]?p:a);
      const oe=outer[0]-sg*drop,ie=oe-sg*sleeveW,my=outer[1]+0.38*(endY-outer[1]);
      const edgeX=(y)=>{const t=(y-outer[1])/(endY-outer[1]);return {o:outer[0]+(oe-outer[0])*Math.min(1,Math.max(0,t)),i:inner[0]+(ie-inner[0])*Math.min(1,Math.max(0,t))};};
      g+=`<path d="${poly([[outer[0],outer[1]-1.0],outer,[outer[0]-sg*0.12,my],[oe,endY],[ie,endY],[inner[0]+(ie-inner[0])*0.3,my],inner,[inner[0],inner[1]-1.0]])}" fill="${WHITE}"/>`;
      extTop+=ln(`M${f(outer[0])},${f(outer[1]-upE)} L${f(outer[0])},${f(outer[1])} L${f(outer[0]-sg*0.12)},${f(my)} L${f(oe)},${f(endY)} L${f(ie)},${f(endY)} L${f(inner[0]+(ie-inner[0])*0.3)},${f(my)} L${f(inner[0])},${f(inner[1])} L${f(inner[0])},${f(inner[1]-(G.noStroke?upE+0.9:upE))}`,.04,LINEC,.95);
      if(!G.noStroke){const ed=low.slice().sort((a,b)=>sg*b[0]-sg*a[0]);covers.push('M'+ed.map(p=>f(p[0])+','+f(p[1]-0.005)).join('L'));covers.push(`M${f(outer[0]-sg*0.02)},${f(outer[1]-0.005)} L${f(inner[0]+sg*0.02)},${f(inner[1]-0.005)}`);}
      const cy=endY-2.2,e=edgeX(cy);
      g+=ln(`M${f(e.o)},${f(cy)} L${f(e.i)},${f(cy)}`,.035)+wbutton((e.o+e.i)/2+sg*0.0,cy+0.7,0.12);}}
  g+=`<g id="garment-body"><path id="silhouette" d="${SIL}" fill="${WHITE}"${G.noStroke?'':' stroke="'+LINEC+'" stroke-width=".04" stroke-linejoin="round"'}/><g clip-path="url(#clipSil)">`;
  const BIG=maxX+1;
  g+=`<path id="trousers" d="M${f(-BIG)},${f(Y(G.waist))} L${f(BIG)},${f(Y(G.waist))} L${f(BIG)},${f(HEM+1)} L${f(-BIG)},${f(HEM+1)} Z" fill="${GRAYT}"/>`;
  // epaulet straps (shirt colour), drawn before the collar so the collar leaf lies over the inner end: a strap along the shoulder seam,
  // square at the armhole, pointed toward the neck with a button (CAPR 39-1 4.2.5.1: two epaulet straps)
  if(G.ep)for(const [s,tag] of [[1,'right'],[-1,'left']]){const xo=s*G.ep.outer*S,xi=s*G.ep.inner*S,A=[xo,topY(Math.abs(xo))],B=[xi,topY(Math.abs(xi))],tx=B[0]-A[0],ty=B[1]-A[1],L=Math.hypot(tx,ty),ux=tx/L,uy=ty/L;
    let n=[-uy,ux];if(n[1]<0)n=[uy,-ux];const w=G.ep.w,sd=G.ep.seam?[s*G.ep.seam[0],G.ep.seam[1]]:n,A2=G.ep.seam?[A[0]+sd[0]*w/sd[1],A[1]+w]:[A[0]+n[0]*w,A[1]+n[1]*w],B2=[B[0]+n[0]*w,B[1]+n[1]*w],T=[(B[0]+B2[0])/2+ux*0.32,(B[1]+B2[1])/2+uy*0.32];
    g+=`<path id="epaulet-${tag}" d="${poly([A,B,T,B2,A2])}" fill="${WHITE}" stroke="${LINEC}" stroke-width=".035" stroke-linejoin="round"/>`
      +wbutton((B[0]+B2[0])/2+ux*0.1,(B[1]+B2[1])/2+uy*0.1,0.12);}
  g+=G.lines(X,Y,mx,pl,ln,G);
  g+=`</g>`+covers.map(d=>`<path d="${d}" stroke="${WHITE}" stroke-width=".09" fill="none"/>`).join('')+extTop+`</g>`;
  const vb={x:-(maxX+0.2),y:-0.1,w:2*(maxX+0.2),h:HEM+0.2};
  return {g,vb,X,Y,HEM,maxX,mx,o};}
// ---- male: parametric interior (px read off the base image, cx = 288.5)
const MALE={outline:'aviator_male_outline.json',waist:550,ep:{outer:-216,inner:-128,w:1.2,seam:[0.208,0.978]},
 lines:(X,Y,mx,pl,ln,GG)=>{let s='';const B=(x,y,id)=>{const r=0.26;return `<g id="${id}"><circle cx="${f(X(x))}" cy="${f(Y(y))}" r="${r}" fill="#f1f1ee" stroke="#8e8e8e" stroke-width=".03"/><circle cx="${f(X(x))}" cy="${f(Y(y))}" r="${r*0.62}" fill="none" stroke="#2a2a2a" stroke-width=".02"/>`
    +[[-1,-1],[1,-1],[-1,1],[1,1]].map(([a,b])=>`<circle cx="${f(X(x)+a*0.055)}" cy="${f(Y(y)+b*0.055)}" r=".032" fill="#1c1c1c"/>`).join('')+`</g>`;};
  const m=p=>[mx(p[0]),p[1]];
  // armholes, cuffs
  s+=ln(pl([[72,135],[107,300],[117,390]]))+ln(pl([[mx(72),135],[mx(107),300],[mx(117),390]]));
  if(!(GG&&GG.long))s+=ln(pl([[117,365],[12,371]]),.03)+ln(pl([[mx(117),365],[mx(12),371]]),.03);
  // pockets: flap with V bottom, chamfered lower corners
  for(const [sg,tag] of [[0,'right'],[1,'left']]){const q=p=>sg?[mx(p[0]),p[1]]:p;
    const P=[[127,259],[243,259],[243,382],[221,400],[149,400],[127,382]].map(q);   // 150 px (5.6 in) tall: shorter than the base image's 166 px
    s+=`<g id="pocket-${tag}"><path d="${pl(P)}Z" fill="none" stroke="${LINEC}" stroke-width=".04" stroke-linejoin="round"/>`+ln(pl([[127,299],[185,314],[243,299]].map(q)),.035)+wbutton(X(q([185,297])[0]),Y(297),0.2,`pocket-${tag}-button`)+`</g>`;}
  s+=ln(pl([[277,205],[277,550]]),.03,'#8a8a8a');
  [[203],[302],[401],[498]].forEach(([y],i)=>s+=wbutton(X(290),Y(y),0.22,`button-${i+1}`));
  // collar leaves + roll (over the epaulets)
  for(const [sg,tag] of [[0,'right'],[1,'left']]){const q=p=>sg?[mx(p[0]),p[1]]:p;
    s+=`<path id="collar-${tag}" d="${pl([[223,52],[165,160],[229,155],[287,192]].map(q))}${sg?'':''}" fill="${WHITE}" stroke="${LINEC}" stroke-width=".04" stroke-linejoin="round"/>`;}
  // belt, loops, buckle, fly seams
  s+=`<path id="belt" d="M${f(X(132))},${f(Y(556))} Q${f(X(288))},${f(Y(567))} ${f(X(441))},${f(Y(556))} L${f(X(443))},${f(Y(590))} Q${f(X(288))},${f(Y(607))} ${f(X(133))},${f(Y(590))} Z" fill="#0f0f0f"/>`;
  for(const [a,b,t] of [[181,196,0],[375,391,0]])s+=`<rect x="${f(X(a))}" y="${f(Y(556))}" width="${f((b-a)*S0)}" height="${f(46*S0)}" fill="#6b6865" stroke="#2b2b2b" stroke-width=".02"/>`;
  s+=buckleSvg(X(298),Y(582),BK.w,BK.h);
  s+=ln(pl([[276.5,604],[276.5,673]]),.03,'#3a3936')+ln(pl([[315,604],[315,673]]),.03,'#3a3936');
  return s;},
 pocketTop:259,flapBottom:314,pocketBottom:400,pocketCx:{right:185,left:mx=>mx(185)},collarLeaf:[[223,52],[165,160],[229,155],[287,192]]};
// ---- female: smooth trace of the clean line-art
const isBtn=l=>{const xs=l.map(p=>p[0]),ys=l.map(p=>p[1]),w=Math.max(...xs)-Math.min(...xs),h=Math.max(...ys)-Math.min(...ys);return w<36&&h<36;};
const STRAP_L=[[143,185],[318,139.5],[351.7,166],[335,205.5],[173,252]],STRAP_R=[[984,194],[795,143.6],[760.7,169.3],[776.6,208.9],[947,252]];
const FEMALE={outline:'aviator_female_outline.json',S:0.019334,waist:993,noStroke:true,ep:null,
 lines:(X,Y,mx,pl,ln,GG)=>{const LA=JSON.parse(fs.readFileSync(path.join(here,'av_female_lines.json'),'utf8'));
  const OUTF=JSON.parse(fs.readFileSync(path.join(here,'aviator_female_outline.json'),'utf8')),Sc=0.019334,tx=-OUTF.cx*Sc,ty=-OUTF.y0*Sc;   // clean px -> inches
  const lp=ls=>'M'+ls.map(l=>l.map(p=>p.join(',')).join('L')).join('ZM')+'Z';
  const PK=[[255,520],[620,890]],squash=y=>y<=625?y:625+(y-625)*0.66;   // pockets 351 -> ~280 px (5.4 in)
  const inCuff=l=>{const xs=l.map(p=>p[0]),ys=l.map(p=>p[1]);return Math.min(...ys)>=690&&Math.max(...ys)<=830&&((Math.max(...xs)<=250)||(Math.min(...xs)>=880));};
  const inPocket=l=>{const xs=l.map(p=>p[0]),ys=l.map(p=>p[1]);return PK.some(([a,b])=>Math.min(...xs)>=a&&Math.max(...xs)<=b)&&Math.min(...ys)>=470&&Math.max(...ys)<=845;};
  LA.loops=LA.loops.filter(l=>!inPocket(l));
     // pockets are redrawn below as straight-sided, shorter pockets (the traced ones bowed when shortened)
  const quad=(a)=>'M'+a.map(p=>p.map(v=>+v.toFixed(1)).join(',')).join('L')+'Z';
  const strapPts=(P,left)=>{const [A,B,T,B2,A2]=P,lo=Math.min(A[0],B[0]),hi=Math.max(A[0],B[0]);
    const edge=OUTF.outline.map(p=>[p[0]/Sc+OUTF.cx,p[1]/Sc+OUTF.y0]).filter(p=>p[0]>=lo&&p[0]<=hi&&p[1]<Math.max(A[1],B[1])+4&&p[1]>Math.min(A[1],B[1])-40).sort((p,q)=>left?p[0]-q[0]:q[0]-p[0]);
    const mid=edge.length?edge[Math.floor(edge.length/2)]:null;
    return [A].concat(mid?[mid]:[],[B,T,B2,A2]);};
  const strapL=STRAP_L,strapR=STRAP_R;
  const leafL=[[435,40],[326,258],[444,247],[446,282],[560,331],[577,365],[555,318],[500,200]],leafR=[[672,40],[783,264],[662,252],[660,278],[561,331],[555,318],[590,250],[640,150]];
  let s=`<g transform="matrix(${Sc} 0 0 ${Sc} ${tx} ${ty})">`
   +`<path id="epaulet-right" d="${quad(strapPts(strapL,true))}" fill="${WHITE}" stroke="${LINEC}" stroke-width="3" stroke-linejoin="round"/><path id="epaulet-left" d="${quad(strapPts(strapR,false))}" fill="${WHITE}" stroke="${LINEC}" stroke-width="3" stroke-linejoin="round"/>`
   +`<path id="collar-right" d="${quad(leafL)}" fill="${WHITE}"/><path id="collar-left" d="${quad(leafR)}" fill="${WHITE}"/>`
   +`<path d="M578,365 L578,992" stroke="#a9a9a9" stroke-width="3" fill="none"/>`
   +[[336,376],[728,766]].map(([a,b])=>`<rect x="${a}" y="1003" width="${b-a}" height="104" fill="#77736f"/>`).join('')
   +[['M269,483 L505,484 L500,762 L272,762 Z','M270,588 L376,612 L501,588'],['M631,482 L868,481 L878,762 L640,762 Z','M634,586 L762,610 L874,586']].map(([o,fl])=>`<path d="${o}" fill="none" stroke="#3a3a3c" stroke-width="2.4" stroke-linejoin="round"/><path d="${fl}" fill="none" stroke="#3a3a3c" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>`).join('')
   +(GG&&GG.long?'<clipPath id="lineClip"><path clip-rule="evenodd" d="M0,0 H1130 V1360 H0 Z M20,698 H262 V830 H20 Z M860,698 H1112 V830 H860 Z"/></clipPath><g clip-path="url(#lineClip)">':'')
   +`<path id="lineart" d="${lp(LA.loops.filter(l=>!isBtn(l)&&Math.min(...l.map(p=>p[1]))<985))}" fill="#3a3a3c" fill-rule="evenodd"/><path id="belt" d="${lp(LA.loops.filter(l=>Math.min(...l.map(p=>p[1]))>=985))}" fill="#131314" fill-rule="evenodd"/>${GG&&GG.long?'</g>':''}</g>`
   +`<rect x="${f(X(460))}" y="${f(Y(1020))}" width="${f(130*Sc)}" height="${f(82*Sc)}" fill="#131314"/>`+[[STRAP_L],[STRAP_R]].map(([P])=>{const [A,B,T,B2]=P,mxp=(B[0]+B2[0])/2,myp=(B[1]+B2[1])/2,L=Math.hypot(T[0]-mxp,T[1]-myp),ux=(T[0]-mxp)/L,uy=(T[1]-myp)/L;return wbutton(X(mxp+ux*9),Y(myp+uy*9),0.12);}).join('')+buckleSvg(X(524),Y(1058),BK.w,BK.h)
   +[[550,357],[550,538],[550,707],[550,886]].map(([x,y],i)=>wbutton(X(x),Y(y),0.21,`button-${i+1}`)).join('')
   +[[375,583],[762,581]].map(([x,y],i)=>wbutton(X(x),Y(y),0.19,`pocket-${i?'left':'right'}-button`)).join('');
  return s;},
 pocketTop:482,flapBottom:611,pocketBottom:762,collarLeaf:[[435,40],[326,258],[444,247],[446,282],[560,331],[577,365],[555,318],[500,200]],pocketCx:{right:385.5,left:754}};
const LONG_M={end:25.8,hem:26.0,w:2.1,cuffY:13.0},LONG_F={end:27.5,hem:27.7,w:2.1,cuffY:14.6,up:1.66};
const CFG=[Object.assign({id:'garment-aviator-shirt-male',name:"Men's Aviator Shirt Uniform: white short-sleeve aviator shirt, gray trousers"},MALE),
           Object.assign({id:'garment-aviator-shirt-female',name:"Women's Aviator Shirt Uniform: white short-sleeve aviator shirt, gray slacks"},FEMALE),
           Object.assign({id:'garment-aviator-shirt-male-long',name:"Men's Aviator Shirt Uniform: white long-sleeve aviator shirt, gray trousers",long:LONG_M},MALE),
           Object.assign({id:'garment-aviator-shirt-female-long',name:"Women's Aviator Shirt Uniform: white long-sleeve aviator shirt, gray slacks",long:LONG_F},FEMALE)];
const sq=(innerBody,v,name,px)=>{const cx2=v.x+v.w/2,cy2=v.y+v.h/2,s=Math.max(v.w,v.h);
  const x=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${cx2-s/2} ${cy2-s/2} ${s} ${s}" width="${px}" height="${px}">${DEFS2}${innerBody}</svg>`;
  const tmp=path.join(here,name+'.sq.svg');fs.writeFileSync(tmp,x);
  require('child_process').execSync(`qlmanage -t -s ${px} -o "${here}" "${tmp}" >/dev/null 2>&1 && mv "${tmp}.png" "${path.join(here,name+'_preview.png')}" && rm "${tmp}"`);};
for(const G of CFG){
  const B=build(G),{vb,X,Y,mx}=B;let body=B.g;
  // nametag slot: centred on the wearer's right pocket, bottom edge resting on its top edge (4.2.5.1.2.1 / 4.2.6.2.6.1.1)
  const pcR=typeof G.pocketCx.right==='number'?G.pocketCx.right:0,pcL=typeof G.pocketCx.left==='function'?G.pocketCx.left(mx):G.pocketCx.left;
  const rcx=G.id.includes('female')?G.pocketCx.right:G.pocketCx.right;     // image-left pocket = wearer's right
  const slot={x:X(rcx)-PW/2,y:Y(G.pocketTop)-PH,w:PW,h:PH};
  const lcx=G.id.includes('female')?G.pocketCx.left:mx(G.pocketCx.right);
  const rib={x:X(lcx)-PW/2,y:Y(G.pocketTop)-0.0,w:PW,h:0.2};
  body+=`<rect id="nameplate-slot" x="${f(slot.x)}" y="${f(slot.y)}" width="${PW}" height="${PH}" fill="none" stroke="none"/><rect id="ribbon-slot" x="${f(X(lcx)-4.125/2)}" y="${f(Y(G.pocketTop)-1.5)}" width="4.125" height="1.5" fill="none" stroke="none"/>`;
  const ux=x=>+((x-vb.x)*U).toFixed(2),uy=y=>+((y-vb.y)*U).toFixed(2);
  const LM={};const R=(k,i)=>{const r=lmRect(body,i,vb);if(r)LM[k]=r;};
  R('nameplate_slot','nameplate-slot');R('ribbon_slot','ribbon-slot');
  for(const t of ['right','left']){const p=lmPoly(body,'epaulet-'+t,vb);if(p)LM['epaulet_'+t]=p;}
  if(G.id.includes('female')){const O=JSON.parse(fs.readFileSync(path.join(here,G.outline),'utf8')),Sc=G.S;   // straps are drawn in clean px
    for(const [t,Q] of [['right',STRAP_L],['left',STRAP_R]])LM['epaulet_'+t]=Q.map(p=>[+((((p[0]-O.cx)*Sc)-vb.x)*U).toFixed(2),+((((p[1]-O.y0)*Sc)-vb.y)*U).toFixed(2)]);}
  const A=std(vb.w*U,vb.h*U);
  // positions the regulation fixes (CAPR 39-1 4.2.5.1.3, 4.2.6.2.7, 4.2.5.1.1.3, 4.2.5.1.1.5): badge / pin / grade-insignia mounting points
  const ox=G.o||B.o,pkR=X(rcx),pkL=X(lcx),bY=Y((G.flapBottom+G.pocketBottom)/2);
  const nsc=[LM.nameplate_slot.x+LM.nameplate_slot.w/2,LM.nameplate_slot.y],rbc=[LM.ribbon_slot.x+LM.ribbon_slot.w/2,LM.ribbon_slot.y];
  const sleeve=sg=>{const pts=B.o.filter(p=>sg*p[0]>5.0&&p[1]<B.HEM*0.62);let my=Math.max(...pts.map(p=>p[1]));
    const end=pts.filter(p=>p[1]>my-0.45),ex=end.reduce((a,p)=>a+p[0],0)/end.length;
    const top=Math.min(...pts.map(p=>p[1]));return {endY:my,endX:ex,top};};
  const cl=G.collarLeaf.map(p=>[B.X(p[0]),B.Y(p[1])]),cenL=cl.reduce((a,p)=>[a[0]+p[0]/cl.length,a[1]+p[1]/cl.length],[0,0]);
  const nco={};for(const [tag,sg] of [['right',-1],['left',1]]){const sv=sleeve(sg);
    // short sleeve: centred on the outer arm at the bottom edge of the sleeve; long sleeve: halfway between the shoulder seam and the elbow (estimate: elbow at 55% of the arm)
    const y=G.long?sv.top+0.5*0.55*(G.long.end-sv.top):sv.endY-0.1,xo=G.long?(sg*(Math.abs(sv.endX)+(G.long.drop||0.5))):sv.endX;
    nco['nco_chevron_'+tag+'_center']=[ux(xo),uy(y)];}
  const anchors={...A,hem_center:[A.top_center[0],uy(B.HEM)],nameplate_slot_center:lmCen(LM.nameplate_slot),ribbon_slot_center:lmCen(LM.ribbon_slot),
    epaulet_right_center:lmCen(lmBox(LM.epaulet_right)),epaulet_left_center:lmCen(lmBox(LM.epaulet_left)),
    tie_mount_center:G.id.includes('female')?[ux(0),uy(B.Y(331)-0.45)]:[ux(B.X(290)),uy(B.Y(192)-0.1)],
    badge_right_pocket_center:[ux(pkR),uy(bY)],badge_left_pocket_center:[ux(pkL),uy(bY)],
    badge_above_ribbons_center:[rbc[0],rbc[1]-50],command_pin_above_nametag_center:[nsc[0],nsc[1]-50],
    command_pin_below_nametag_center:[nsc[0],nsc[1]+LM.nameplate_slot.h+50],
    collar_insignia_right_center:[ux(-Math.abs(cenL[0])),uy(cenL[1])],collar_insignia_left_center:[ux(Math.abs(cenL[0])),uy(cenL[1])],...nco};
  conv({id:G.id,name:G.name,vb,body,source:'reference-art-measured',meta:{size_source:'estimated',
    size_basis:`Silhouette traced from images/base/${G.id.includes('female')?'aviator_shirt_female':'aviator_shirt_male'}.webp (581x719 px; the female outline is traced from the clean 1130x1392 re-render of the same drawing) at ${S0} in per 581-px-canvas px, chosen so the shirt is the same sleeve-to-sleeve width as the Class B shirt (20.8 in). No real garment was measured.`,
    anchors:Object.fromEntries(Object.entries(anchors).map(([k,v])=>[k,r2(v)])),landmarks:LM,landmarks_note:'rects are {x,y,w,h}; polygons are [[x,y]...]; user units (0.01 in), origin top-left',
    dimensions:{length_in:+B.HEM.toFixed(2),max_width_in:+(2*B.maxX).toFixed(2),nametag_slot_in:[PW,PH]},
    documented:['white aviator-style shirt, two standard sewn flap pockets, curved flap bottom allowed, straight collar, two epaulet straps (CAPR 39-1 4.2.5.1 / 4.2.6.1.1)','nametag centred on, resting on (not over) the edge of the pocket on the wearer\'s right (4.2.5.1.2.1 / 4.2.6.2.6.1.1)','ribbons centred on, resting on the edge of the wearer\'s left pocket (4.2.5.1.2.2)','cadet NCOs/airmen: metal chevrons on both sides of the collar, 1 in from and parallel to the front of the collar; cadet officers: blue epaulet sleeves','medium gray trousers, plain black belt with silver buckle (4.2.5.1.5-.6)'],
    assumed:['px-to-inch scale','nametag slot size (CAP plate size)','epaulet strap size (not drawn in the base image)','gray shade and belt colours sampled from the base image'],
    fit:{method:'traced from the raster',score:null},grade:'garment'}});
  // epaulet sleeves (CAPR 39-1 4.2.5.1.1.1 / .4, 4.2.6.2.1 / .4): gray for officers (blank = adult members without grade), blue for cadet officers.
  // Edge-on strip on the strap as seen from the front (overlay registered to this shirt) + a separate top-down asset per shoulder with grade slot anchors.
  {const male=!G.id.includes('female'),toIn=p=>[p[0]/U+vb.x,p[1]/U+vb.y],Pj=a=>a.map(p=>f(p[0])+','+f(p[1])).join('L'),side=male?'male':'female';
   for(const [tag,col,edge,who,regs] of [['officer','#6e6a69','#4a4746','adult officer','gray epaulet sleeves, embroidered grade (CAPR 39-1 4.2.5.1.1.1 / 4.2.6.2.1)'],['cadet-officer','#072157','#041640','cadet officer','blue epaulet sleeves, miniature grade (CAPR 39-1 4.2.5.1.1.4 / 4.2.6.2.4)']]){
    let eb='';const E={},RULE={},TOP={};
    for(const t of ['right','left']){const q=LM['epaulet_'+t].map(toIn),[P0,P1,P2,P3,P4]=q;
      const lerp=(a,b,k)=>[a[0]+(b[0]-a[0])*k,a[1]+(b[1]-a[1])*k],K=0.82,A1=lerp(P0,P1,K);
      const nn=[P4[0]-P0[0],P4[1]-P0[1]],nl0=Math.hypot(nn[0],nn[1]),n1=[nn[0]/nl0,nn[1]/nl0],th=0.4,sl=[P0,A1,[A1[0]+n1[0]*th,A1[1]+n1[1]*th],[P0[0]+n1[0]*th,P0[1]+n1[1]*th]];
      TOP[t]={w:nl0,len:Math.hypot(A1[0]-P0[0],A1[1]-P0[1])};
      const m0=[(P0[0]+P4[0])/2,(P0[1]+P4[1])/2],m1=[(P1[0]+P3[0])/2,(P1[1]+P3[1])/2],dl=Math.hypot(m1[0]-m0[0],m1[1]-m0[1]),dv=[(m1[0]-m0[0])/dl,(m1[1]-m0[1])/dl];
      RULE[t]=[m0[0]+dv[0]*0.625,m0[1]+dv[1]*0.625];
      eb+=`<g id="epaulet-sleeve-${t}"><title>${who} epaulet sleeve, ${t} shoulder (blank: grade insignia centred 5/8 in from the outer end)</title><path id="epaulet-sleeve-${t}-body" d="M${Pj(sl)}Z" fill="${col}" stroke="${edge}" stroke-width=".05" stroke-linejoin="round"/></g>`;
      const xs=sl.map(p=>p[0]),ys=sl.map(p=>p[1]),bx={x:ux(Math.min(...xs)),y:uy(Math.min(...ys)),w:+((Math.max(...xs)-Math.min(...xs))*U).toFixed(2),h:+((Math.max(...ys)-Math.min(...ys))*U).toFixed(2)};
      E['epaulet_sleeve_'+t]=bx;E['rank_slot_'+t]=bx;}
    conv({id:G.id+'-epaulet-sleeve-'+tag,name:`${G.name.split(':')[0]} ${who} epaulet sleeves (overlay, registered to ${G.id}; blank grade)`,vb,body:eb,source:'original',
     meta:{size_source:'estimated',size_basis:'Edge-on strip (0.4 in) along the outer 82% of the garment epaulet strap landmark, the way the sleeve looks from the front; the full sleeve is the separate top-down asset garment-aviator-epaulet-top-*. Colours as the Class B sleeves (gray #6e6a69, cadet navy #072157); the regulation gives no shade or dimension.',
      anchors:{...A,rank_slot_right_center:lmCen(E.rank_slot_right),rank_slot_left_center:lmCen(E.rank_slot_left),rank_rule_point_right:[ux(RULE.right[0]),uy(RULE.right[1])],rank_rule_point_left:[ux(RULE.left[0]),uy(RULE.left[1])]},
      landmarks:E,landmarks_note:'rects are {x,y,w,h} in user units (0.01 in)',overlay_of:G.id,documented:[regs,'grade insignia centred 5/8 in from the outer end of the epaulet (DAFI 36-2903 4.5.1.1.1)'],assumed:['sleeve length (covers the outer 82% of the strap)','grade not drawn: placed by the rank insignia assets at rank_slot'],fit:{method:'original',score:null},grade:'accessory'}});
    if(!G.long)for(const t of ['right','left']){
      const T=TOP[t],Lw=+T.len.toFixed(3),Wd=+T.w.toFixed(3),PAD=0.1,mir=t==='left',Xf=x=>mir?Lw-x:x,tid=`garment-aviator-epaulet-top-${side}-${tag}-${t}`;
      const al=Math.min(2.3,Lw-0.2),slot={x:Xf(0.1)<Xf(0.1+al)?Xf(0.1):Xf(0.1+al),y:0.1,w:al,h:Wd-0.2},rule=[Xf(0.625),Wd/2],lt=[Xf(Lw*0.68),Wd/2];
      const tb=`<g id="epaulet-sleeve-top"><title>${who} epaulet sleeve, ${t} shoulder, top-down view (blank grade)</title><rect id="sleeve-body" x="0" y="0" width="${f(Lw)}" height="${f(Wd)}" rx=".08" fill="${col}" stroke="${edge}" stroke-width=".04"/>`
        +`<g transform="translate(${f(lt[0])} ${f(lt[1])}) rotate(${mir?90:-90}) translate(${f(-lt[0])} ${f(-lt[1])})">${lettering('CAP',lt[0],lt[1],0.34,'#e9ecf2',0.08,0.8)}</g></g>`;
      const sl2={x:+((slot.x+PAD)*U).toFixed(2),y:+((slot.y+PAD)*U).toFixed(2),w:+(slot.w*U).toFixed(2),h:+(slot.h*U).toFixed(2)},box={x:PAD*U,y:PAD*U,w:Lw*U,h:Wd*U},Wb=Lw+2*PAD,Hb=Wd+2*PAD;
      conv({id:tid,name:`${G.name.split(':')[0]} ${who} epaulet sleeve, ${t} shoulder, top-down (blank grade)`,vb:{x:-PAD,y:-PAD,w:Wb,h:Hb},body:tb,source:'original',
       meta:{size_source:'estimated',size_basis:'Length and width of the garment epaulet strap landmark (sleeve covers its outer 82%); colour and CAP lettering placement as the Class B top-down sleeves. The regulation gives no dimension.',
        anchors:{...std(Wb*U,Hb*U),rank_slot_center:[+(sl2.x+sl2.w/2).toFixed(2),+(sl2.y+sl2.h/2).toFixed(2)],rank_rule_point:[+((rule[0]+PAD)*U).toFixed(2),+((rule[1]+PAD)*U).toFixed(2)],outer_end_center:[+(((mir?Lw:0)+PAD)*U).toFixed(2),+((Wd/2+PAD)*U).toFixed(2)]},
        landmarks:{sleeve:box,rank_slot:sl2},landmarks_note:'rects are {x,y,w,h} in user units (0.01 in); rank_slot holds the largest regular-size grade form; rank_rule_point is the 5/8 in from the outer end point for single forms',
        dimensions:{sleeve_in:[Lw,Wd],rank_slot_in:[+slot.w.toFixed(2),+slot.h.toFixed(2)]},documented:[regs,'grade insignia centred 5/8 in from the outer end of the epaulet (DAFI 36-2903 4.5.1.1.1)'],assumed:['sleeve size','CAP lettering size and position','grade not drawn'],fit:{method:'original',score:null},grade:'accessory'}});}
   }}
  // tie / tie tab overlay (aviator uniform: AF blue tie, never the regimental one, 4.2.5.1.4; women's USAF-style inverted-V tab, 4.2.6.3 - required with the
  // long-sleeve shirt, optional with the short). Registered to this shirt's box. Men's tie tip covers part of the belt buckle and does not reach below it.
  {const male=!G.id.includes('female'),TIEB='#1b3f8f',TIEE='#0a2260';let tb,tid,nm,LMt={},anch={};
   if(male){const half=[[9,62],[14,71],[16,81],[12,94],[11,102],[15,140],[21,200],[27,262],[31,330]].map(p=>[p[0]*0.0474,(p[1]-62)*0.0474]),H0=(330-62)*0.0474;
     const y0=B.Y(192)-0.1,y1=B.Y(582),k=(y1-y0)/H0,cx=B.X(290);
     const hp=half.slice(0,-1).concat([[half[8][0],H0-0.9/k]]),Lp=hp.map(p=>[cx-p[0],y0+p[1]*k]).concat([[cx,y1+0.15]]),Rp=hp.slice().reverse().map(p=>[cx+p[0],y0+p[1]*k]);
     tb=`<path id="tie" d="${poly(Lp.concat(Rp))}" fill="${TIEB}" stroke="${TIEE}" stroke-width=".03" stroke-linejoin="round"/><path d="M${f(cx-0.5)},${f(y0+0.55)} Q${f(cx)},${f(y0+0.7)} ${f(cx+0.5)},${f(y0+0.55)}" fill="none" stroke="${TIEE}" stroke-width=".05" stroke-opacity=".7"/>`;
     tid=G.id+'-tie';nm=`${G.name.split(':')[0]} AF blue tie (overlay, registered to ${G.id})`;
     anch={tie_knot_top_center:[ux(cx),uy(y0)],tie_tip_center:[ux(cx),uy(y1)],tie_tack_center:[ux(cx),uy((y0+0.7+y1)/2)]};
     LMt={tie:{x:ux(cx-half[8][0]),y:uy(y0),w:+(2*half[8][0]*U).toFixed(2),h:+((y1-y0)*U).toFixed(2)}};}
   else{const cx=0,y0=B.Y(331)-0.45,T=[[-0.5,0],[0.5,0],[1.35,1.6],[0.65,1.6],[0,0.95],[-0.65,1.6],[-1.35,1.6]].map(p=>[cx+p[0],y0+p[1]]);
     tb=`<path id="tie-tab" d="${poly(T)}" fill="#0d2a66" stroke="#061a44" stroke-width=".025" stroke-linejoin="round"/>`;
     tid=G.id+'-tie-tab';nm=`${G.name.split(':')[0]} inverted-V tie tab (overlay, registered to ${G.id})`;
     anch={tie_tab_center:[ux(cx),uy(y0+0.8)],tie_tab_top_center:[ux(cx),uy(y0)]};LMt={tie_tab:{x:ux(-1.35),y:uy(y0),w:270,h:160}};}
   conv({id:tid,name:nm,vb,body:tb,source:'original',meta:{size_source:'estimated',size_basis:male?'Visible blade of the blazer base tie, stretched to run from the collar V to the middle of the belt buckle (the tip covers part of the buckle, 4.2.5.1.4); width profile as the blazer tie. No dimension in the regulation.':'Same inverted-V tab as accessories/tie-tab-inverted-v (2.7 x 1.6 in), hung from the collar V; no dimension in the regulation.',
     anchors:{...A,...anch},landmarks:LMt,landmarks_note:'rects are {x,y,w,h} in user units (0.01 in)',overlay_of:G.id,
     documented:[male?'AF blue tie (blue polyester or silk, herringbone twill); the CAP regimental tie is not authorized with the aviator shirt uniform; tip covers part of the buckle but not below it (CAPR 39-1 4.2.5.1.4)':'USAF-style inverted-V tie tab; worn with the women\'s long-sleeved shirt, optional with short sleeves (4.2.6.3)'],assumed:['blue shade','tie width and length'],fit:{method:'original',score:null},grade:'accessory'}});
   }
  sq(body,vb,G.id.replace('garment-',''),+(process.env.PX||1000));console.log('ok',G.id);}
