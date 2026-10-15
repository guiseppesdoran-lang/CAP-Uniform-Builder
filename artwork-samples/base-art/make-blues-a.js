// Class A (men's service dress coat, CAPR 39-1 4.1.5) built from the traced base image images/base/jacket_male.webp.
// Silhouette traced (trace-silhouette.js -> jacket_male_outline.json, 0.0474 in/px, same canvas/scale as the ABU coat); all
// interior parts are parametric in inches. Raster -> inch: x=(px-281.5)*S, y=(py-32)*S.
const fs=require('fs'),path=require('path');
const f=n=>(+n).toFixed(3),STROKE='#00102f';
const OUT=JSON.parse(fs.readFileSync(path.join(__dirname,'jacket_male_outline.json'),'utf8'));
const S=OUT.scale,X=px=>(px-281.5)*S,Y=py=>(py-32)*S,P=(px,py)=>[X(px),Y(py)];
const HEM=OUT.heightIn,NAVY='#001c52',SHIRT='#c6cde8';
OUT.outline=OUT.outline.filter(p=>!(p[1]<0.7&&Math.abs(p[0])<2.3));   // drop the traced back-collar band tips (render as horns)
const poly=a=>'M'+a.map(p=>f(p[0])+','+f(p[1])).join('L')+'Z';
const SIL=poly(OUT.outline)+OUT.holes.map(poly).join('');
const mir=p=>[-p[0],p[1]];
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
function conv({id,name,vb,body,source,meta}){
  const W=vb.w,H=vb.h,Wu=+(W*U).toFixed(2),Hu=+(H*U).toFixed(2);
  const art=`<g id="art" transform="translate(${f(-vb.x*U)} ${f(-vb.y*U)}) scale(${U})">${body}</g>`;
  const m={asset_id:id,name,size_in:{w:+W.toFixed(4),h:+H.toFixed(4)},units:'1 user unit = 0.01 in',viewBox:[0,0,Wu,Hu],...meta};
  let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W.toFixed(4)}in" height="${H.toFixed(4)}in" viewBox="0 0 ${Wu} ${Hu}" data-asset-id="${id}" data-source="${source}" data-units="0.01in"><title>${esc(name)}</title><metadata>${esc(JSON.stringify(m))}</metadata>${DEFS2}${art}</svg>`;
  svg=nsIds(svg,id);
  fs.writeFileSync(path.join(OUTDIR,id+'.svg'),svg);fs.writeFileSync(path.join(OUTDIR,id+'.spec.json'),JSON.stringify(m,null,1));return svg;}
const std=(W,H)=>({top_center:[W/2,0],bottom_center:[W/2,H],center:[W/2,H/2],left_edge:[0,H/2],right_edge:[W,H/2]});
const r2=a=>a.map(v=>+(+v).toFixed(2));


// ---- geometry (raster px read off jacket_male.webp, converted to inches)
const NECK_L=P(236.7,50),NECK_R=mir(NECK_L);
const NOTCH_IN=P(198.3,135),PEAK=P(168.3,145),CLOSE=P(276.7,265),COLL=P(206.7,71.7);
const VBOT=P(262.7,180);
const BUT=[[0,Y(287)],[0,Y(360)],[0,Y(432)]],BR=0.4375;
const WELT={x:X(336.7),y:Y(257),w:4.2,h:0.55};
const LOW={w:4.9,h:1.9,top:22.0,x:1.7};
const PLATE={w:3.375,h:0.75,cx:X(192.5),cy:WELT.y-0.375};   // bottom of the tag even with the bottom of the ribbons, which rest on the welt top (CAPR 39-1 4.1.5.2.2.2 / 4.1.5.2.2.3)
const BD=JSON.parse(fs.readFileSync(path.join(__dirname,'board','board.json'),'utf8')),BE=JSON.parse(fs.readFileSync(path.join(__dirname,'board','emblem.json'),'utf8'));
const BN=BE.button,EM_L=BE.loops,BTNS=JSON.parse(fs.readFileSync(path.join(__dirname,'board','buttons.json'),'utf8'));
const lp2=ls=>ls.length?'M'+ls.map(l=>l.map(q=>q.join(',')).join('L')).join('ZM')+'Z':'';
const EPAU={w:4.55,h:252*4.55/622,cx:6.07,top:-0.105};   // board length 4.55 in (builder reference); width from the photo's proportions (252 x 622 px)
const ARM=[[8.5,3.2],[8.3,6.0],[7.7,10.0],[7.0,14.0]];   // armhole seam (wearer's left, +x)
function boards(mode='strip',only=null){
  // cadet officer shoulder boards (rank diamonds omitted): thin strips along the shoulders + floating boards above them
  let g='';
  // CAP lapel letters (cadet officers); positions read from the builder reference
  for(const [tag,cx] of [['right',gorge(-1).mid[0]],['left',gorge(1).mid[0]]])
    if(mode==='strip'||mode==='lapel')g+=`<g id="lapel-cap-${tag}"><title>CAP lapel insignia, ${tag} lapel (cadet officers, CAPR 39-1 4.1.5.2.2.1.2)</title><rect x="${f(cx-0.7)}" y="${f(gorge(tag==='right'?-1:1).mid[1]-0.53)}" width="1.4" height="0.53" fill="none"/>${lettering('CAP',cx,gorge(tag==='right'?-1:1).mid[1]-0.265,0.53,'#f1f3f7',0.02,1.4,GLYB)}</g>`;
  const BLK='#15171c',RED='#c8453f',WHT='#f2f2f2',BLU='#2b4aa0';
  for(const s of [-1,1]){const tag=s<0?'right':'left';if(only&&tag!==only)continue;
    const topY=x=>{let b=1e9;const o=OUT.outline;for(let i=0;i<o.length;i++){const a=o[i],c=o[(i+1)%o.length],ax=Math.abs(a[0]),cx=Math.abs(c[0]);if(a[0]*c[0]<0)continue;if((ax-x)*(cx-x)<=0&&ax!==cx){const y=a[1]+(c[1]-a[1])*(x-ax)/(cx-ax);if(y<4&&y<b)b=y;}}return b;};
    const T=[s*8.4,topY(8.4)],I=[s*4.7,topY(4.7)],dx=I[0]-T[0],dy=I[1]-T[1],L=Math.hypot(dx,dy),u=[dx/L,dy/L],n=[-u[1],u[0]][1]>0?[-u[1],u[0]]:[u[1],-u[0]],th=0.32;
    const at=(t,o)=>[T[0]+u[0]*t+n[0]*o,T[1]+u[1]*t+n[1]*o],quad=(t0,t1,fill)=>`<path d="M${at(t0,0).map(f)} L${at(t1,0).map(f)} L${at(t1,th).map(f)} L${at(t0,th).map(f)} Z" fill="${fill}"/>`;
    const sbx=[at(0,0),at(L,0),at(L,th),at(0,th)],sx=sbx.map(p=>p[0]),sy=sbx.map(p=>p[1]);
    if(mode==='strip')g+=`<g id="shoulder-strip-${tag}"><rect id="epaulet-${tag}-box" x="${f(Math.min(...sx))}" y="${f(Math.min(...sy))}" width="${f(Math.max(...sx)-Math.min(...sx))}" height="${f(Math.max(...sy)-Math.min(...sy))}" fill="none"/>${quad(0,L,BLK)}${quad(0.0,0.1,RED)}${quad(0.1,0.18,WHT)}${quad(0.18,0.28,RED)}${quad(0.28,1.0,BLU)}${quad(1.0,1.08,RED)}${quad(1.08,1.16,WHT)}${quad(1.16,1.26,RED)}</g>`;
    // floating board: geometry MEASURED from the commercial board photo (images/ranks/C/shoulder_board.png, Vanguard CAP0647V):
    // symmetric silhouette, stripe bands + colours, button, emblem loops (see board/measure-board.js, board/emblem.js)
    const o=s*(EPAU.cx+EPAU.w/2),tip=s*(EPAU.cx-EPAU.w/2),dirOut=o>tip?1:-1,k=EPAU.w/(BD.bot-BD.top+1),clip=`board-clip-${tag}`;
    const xc=148,sil=`M${xc-6},27 L${xc+6},27 L${xc+123.5},139 L${xc+126},600 Q${xc+126},649 ${xc+100},649 L${xc-100},649 Q${xc-126},649 ${xc-126},600 L${xc-123.5},139 Z`;
    const lp=ls=>'M'+ls.map(l=>l.pts.map(q=>q.join(',')).join('L')).join('ZM')+'Z';
    const art=`<defs><clipPath id="${clip}"><path d="${sil}"/></clipPath></defs><path id="epaulet-${tag}-body" d="${sil}" fill="${BD.body}" stroke="#05060a" stroke-width="1.2"/>`
      +`<g clip-path="url(#${clip})">`+BD.bands.map(bd=>`<rect x="0" y="${bd.y0-1}" width="288" height="${bd.y1-bd.y0+3}" fill="${bd.color}"/>`).join('')+`</g>`
      +`<path d="${lp(EM_L)}" fill="#bfc3cb" fill-rule="evenodd"/>`
      +`<g transform="translate(${BN.cx} ${BN.cy}) scale(${BN.r})">${capCrest()}</g>`;
    if(mode==='board')g+=`<g id="epaulet-${tag}"><title>Cadet officer shoulder board, ${tag} shoulder (blank: rank diamonds are sold separately and omitted here)</title>`
      +`<rect id="epaulet-${tag}-box" x="${f(s*EPAU.cx-EPAU.w/2)}" y="${f(EPAU.top)}" width="${f(EPAU.w)}" height="${f(EPAU.h)}" fill="none"/>`
      +`<g transform="matrix(0 ${f(k)} ${f(dirOut*k)} 0 ${f(tip-dirOut*27*k)} ${f(EPAU.top-22*k)})">${art}</g></g>`;}
  return g;}
function garment(V){V=V||{};
  let g=`<defs><clipPath id="clipSil"><path d="${SIL}" clip-rule="evenodd"/></clipPath></defs>`;
  g+=`<g id="coat-body"><path id="silhouette" d="${SIL}" fill="${NAVY}" fill-rule="evenodd" stroke="${STROKE}" stroke-opacity=".6" stroke-width=".06" stroke-linejoin="round"/>`
    +`<g clip-path="url(#clipSil)">`;
  // shirt V + collar folds, tie
  const sh=(m)=>{const a=m?mir:(p=>p);return a(NECK_L)};
  // front-centre items are symmetric about the garment centreline (x = 0)
  const hw=(px)=>Math.abs(X(px)),SX=hw(236.7),SE=1.68,SV=1.04,vy=Y(177.5);
  const shirtPath=`M${f(-SX)},${f(NECK_L[1])} Q0,${f(Y(112))} ${f(SX)},${f(NECK_R[1])} L${f(SE)},${f(Y(126.7))} L${f(SV)},${f(vy)} L${f(-SV)},${f(vy)} L${f(-SE)},${f(Y(126.7))} Z`;
  g+=`<path id="shirt" d="${shirtPath}" fill="${V.shirt||SHIRT}"/>`;
  // shirt collar: back-of-neck interior (darker) filling the neck opening, and two turn-down collar leaves lying on the shirt front
  g+=`</g>`;
  {const SHc=V.shirt||SHIRT,sh=SHc==='#f3f4f8'?'#d5d9e4':'#a9b3d6',bowl=OUT.outline.slice(3,13).map(p=>[...p]);
   // opening region: coat collar edge up to the back, closed by a shallow arc, down the neckline bowl
   const nb=OUT.outline.filter(p=>p[1]>=0.8&&p[1]<=2.8&&Math.abs(p[0])<=2.05),
     open='M'+[[-2.0,0.8],[-1.3,0.5],[-0.6,0.38],[0.6,0.38],[1.3,0.5],[2.0,0.8]].concat(nb.slice().sort((p,q)=>p[0]-q[0]).reverse()).map(p=>f(p[0])+','+f(p[1])).join('L')+'Z';
   g+=`<path id="collar-back" d="${open}" fill="url(#collarIn)"/>`;
   for(const s of [-1,1]){
     const tip=[s*1.95,3.25],top=[s*2.04,0.86],inn=[s*0.5,2.78],bw=nb.filter(p=>p[0]*s>0.25&&p[1]<2.75).sort((p,q)=>s*(p[0]-q[0]));
     const edge=bw.map(p=>f(p[0])+','+f(p[1])).join('L');
     g+=`<path d="M${f(top[0]+s*0.03)},${f(top[1])} L${f(tip[0]+s*0.03)},${f(tip[1]+0.07)} L${f(inn[0])},${f(inn[1]+0.12)} Z" fill="#000a24" fill-opacity=".22" transform="translate(${f(-s*0.0)} 0.07)"/>`
       +`<path id="collar-${s<0?'right':'left'}" d="M${f(top[0])},${f(top[1])} L${f(tip[0])},${f(tip[1])} L${f(inn[0])},${f(inn[1])} L${edge}Z" fill="${SHc}" stroke="${sh}" stroke-width=".05" stroke-linejoin="round"/>`
       +`<path d="M${f(top[0]-s*0.12)},${f(top[1]+0.15)} L${f(tip[0]-s*0.12)},${f(tip[1]-0.12)}" stroke="#fff" stroke-opacity=".35" stroke-width=".05" stroke-linecap="round"/>`;
   }}
  g+=`<g clip-path="url(#clipSil)">`;
  const ty=Y(94),tw=[[0,ty],[0.83,Y(109.3)],[0.46,Y(121)],[0.52,Y(128)],[1.03,vy+0.02],[1.03,vy+0.9],[-1.03,vy+0.9],[-1.03,vy+0.02],[-0.52,Y(128)],[-0.46,Y(121)],[-0.83,Y(109.3)]];
  g+=`<path id="tie" d="M${tw.map(p=>f(p[0])+','+f(p[1])).join('L')}Z" fill="${NAVY}"/>`;
  // lapels (notch lapel): outline + roll line. Coat collar + lapel face live in their own opaque group `lapel-foreground` so the builder can draw it above badges and above the shirt collar
  let lf='';
  for(const s of [-1,1]){const tag=s<0?'right':'left',m=p=>[s*Math.abs(p[0]),p[1]];
    const nl=m([NECK_L[0],NECK_L[1]]),co=m(COLL),ni=m(NOTCH_IN),pk=m(PEAK),cl=m(CLOSE);
    lf+=`<path id="lapel-face-${tag}" d="M${[nl,co,ni,pk,cl,[s*SV,vy],[s*SE,Y(126.7)],[s*SX,NECK_L[1]]].map(p=>f(p[0])+','+f(p[1])).join('L')}Z" fill="${NAVY}"/>`;
    lf+=`<path id="lapel-${tag}" d="M${f(nl[0])},${f(nl[1])} L${f(co[0])},${f(co[1])} L${f(ni[0])},${f(ni[1])} L${f(pk[0])},${f(pk[1])} L${f(cl[0])},${f(cl[1])}" fill="none" stroke="${STROKE}" stroke-opacity=".5" stroke-width=".045" stroke-linejoin="round"/>`;
    // armhole seam + shoulder seam
    const am=ARM.map(p=>f(s*p[0])+','+f(p[1])).join(' L');
  }
  g+=`<g id="lapel-foreground"><title>Coat collar and lapel faces (draw above badges and devices so they tuck under)</title>${lf}</g>`;
  // front closure, buttons, welt pocket, lower pocket flaps
  // overlap: wearer's left front (+x) laps over the right front; its edge runs from the lapel break down to the hem, buttons sit on the lapping panel
  {const ex=-0.58,c0=[-Math.abs(CLOSE[0]),CLOSE[1]],ey=Y(300),D=`M${f(c0[0])},${f(c0[1])} C${f(c0[0]-0.12)},${f(c0[1]+0.35)} ${f(ex)},${f(ey-0.55)} ${f(ex)},${f(ey)} L${f(ex)},${f(HEM+0.2)}`;
   g+=`<path id="front-edge-shadow" d="${D}" fill="none" stroke="#000d30" stroke-opacity=".3" stroke-width=".18" stroke-linecap="butt" transform="translate(-0.1 0)"/>`
     +`<path id="front-edge" d="${D}" fill="none" stroke="#000b28" stroke-opacity=".85" stroke-width=".05" stroke-linecap="round"/>`;}
  // buttons: Hap Arnold wings-and-star, 36 ligne (approx 7/8 in dia) per Vanguard SKU 2900705
  for(const [i,b] of BUT.entries())g+=`<g id="button-${i+1}"><title>Hap Arnold button, 36 ligne (7/8 in)</title><rect x="${f(b[0]-BR)}" y="${f(b[1]-BR)}" width="${f(2*BR)}" height="${f(2*BR)}" fill="none"/><g transform="translate(${f(b[0])} ${f(b[1])}) scale(${BR})">${hapArnold()}</g></g>`;
  g+=`<g id="welt-pocket"><rect x="${f(WELT.x)}" y="${f(WELT.y)}" width="${WELT.w}" height="${WELT.h}" fill="none" stroke="${STROKE}" stroke-opacity=".45" stroke-width=".05"/></g>`;
  // two lower pocket flaps (DAFI 36-2903 4.5.1.1; CAPR 39-1 4.1.5.2 / 4.1.9.2), placed from the regulation photographs (Fig 4.1 / 4.7)
  for(const s of [-1,1]){const P4=[[s*2.6,19.2],[s*5.8,19.05],[s*5.8,21.2],[s*2.6,21.4]];
    const d='M'+P4.map(p=>f(p[0])+','+f(p[1])).join('L')+'Z';
    g+=`<g id="pocket-flap-${s<0?'right':'left'}"><path d="${d}" transform="translate(0 0.07)" fill="#000a24" fill-opacity=".35"/><path d="${d}" fill="#00205f" fill-opacity=".55" stroke="${STROKE}" stroke-opacity=".7" stroke-width=".05" stroke-linejoin="round"/>`
      +`<path d="M${f(P4[0][0])},${f(P4[0][1]+0.22)} L${f(P4[1][0])},${f(P4[1][1]+0.22)}" stroke="${STROKE}" stroke-opacity=".4" stroke-width=".04"/></g>`;}
  g+=`</g></g>`;
  // nametag slot only: nametags differ by member (cadet blue, senior member silver), so no plate is drawn on the base (CAPR 39-1 4.1.5.2.2.2 / 4.1.5.1)
  if(!V.noPlate){const pl=PLATE;
  g+=`<g id="nameplate"><rect x="${f(pl.cx-pl.w/2)}" y="${f(pl.cy-pl.h/2)}" width="${pl.w}" height="${pl.h}" fill="none"><title>Nametag position (blank: cadet tags are blue, senior member tags silver), centred on the wearer's right, bottom even with the bottom of the ribbons (CAPR 39-1 4.1.5.2.2.2)</title></rect></g>`;}
  return g;}

const maxX=Math.max(...OUT.outline.map(p=>Math.abs(p[0])));
const vbC={x:-(maxX+0.25),y:EPAU.top-0.02,w:2*(maxX+0.25),h:HEM-(EPAU.top-0.02)+0.3};
const coatBody=garment(),coatId='garment-blues-class-a-coat';
const LMc={};
{const R=(k,id)=>{const r=lmRect(coatBody,id,vbC);if(r)LMc[k]=r;},Pg=(k,id)=>{const p=lmPoly(coatBody,id,vbC);if(p)LMc[k]=p;};
 R('nameplate','nameplate');R('welt_pocket','welt-pocket');
 for(let k=1;k<=3;k++)R('button_'+k,'button-'+k);
 for(const t of ['right','left']){Pg('lapel_'+t,'lapel-'+t);}
 Pg('shirt','shirt');Pg('tie','tie');}
const A=std(vbC.w*U,vbC.h*U),ux=x=>(x-vbC.x)*U,uy=y=>(y-vbC.y)*U;
// US lapel insignia: halfway up the collar/lapel seam, resting on it (CAPR 39-1 4.1.5.2.2.1.1); same point the senior layer draws it at
// gorge seam = where the collar meets the lapel: p1 lower/outer end at the notch, p2 upper/inner end at the throat; lapel insignia rest on its midpoint, upright (CAPR 39-1 4.1.5.2.2.1)
const gorge=s=>{const p1=[s*Math.abs(NOTCH_IN[0]),NOTCH_IN[1]],p2=[s*1.68,Y(126.7)];return {p1,p2,mid:[(p1[0]+p2[0])/2,(p1[1]+p2[1])/2]};};
const seamMid=s=>gorge(s).mid;
const gorgeAnch={};for(const [s,t] of [[-1,'right'],[1,'left']]){const g=gorge(s);gorgeAnch['gorge_seam_'+t+'_p1']=g.p1;gorgeAnch['gorge_seam_'+t+'_p2']=g.p2;gorgeAnch['gorge_seam_'+t+'_mid']=g.mid;gorgeAnch['lapel_insignia_rest_'+t]=g.mid;gorgeAnch['lapel_insignia_'+t]=[g.mid[0],g.mid[1]-0.25];}
const gorgeU=Object.fromEntries(Object.entries(gorgeAnch).map(([k,v])=>[k,[ux(v[0]),uy(v[1])]]));
LMc.ribbon_slot={x:+(LMc.welt_pocket.x+LMc.welt_pocket.w/2-206.25).toFixed(2),y:+(LMc.welt_pocket.y-150).toFixed(2),w:412.5,h:150};   // 4.125 x 1.5 in, resting on the welt top, centred (4.1.5.2.2.3)
const SAm=require('./sleeve-anchors.js')({outline:OUT.outline,holes:OUT.holes,arm:ARM,long:true});
const SAu=Object.fromEntries(Object.entries(SAm).map(([k,v])=>[k,[ux(v[0]),uy(v[1])]]));   // chevron placement: shoulder seam, elbow, halfway, sleeve bottom
const anchorsC={...A,...SAu,centerline_top:[A.top_center[0],uy(0)],hem_center:[A.top_center[0],uy(HEM)],
  nameplate_center:lmCen(LMc.nameplate),welt_top_center:[LMc.welt_pocket.x+LMc.welt_pocket.w/2,LMc.welt_pocket.y],
  ribbon_row_bottom_center:[LMc.welt_pocket.x+LMc.welt_pocket.w/2,LMc.welt_pocket.y],
  ...gorgeU,
  button_1_center:lmCen(LMc.button_1),button_2_center:lmCen(LMc.button_2),button_3_center:lmCen(LMc.button_3)};
const coatSvg=conv({id:coatId,name:"Men's Class A service dress coat, no shoulder boards: cadet NCO/airman, or base for the board overlay (nametag position only)",vb:vbC,body:coatBody,source:'reference-art-measured',
  meta:{size_source:'estimated',size_basis:`Silhouette traced from images/base/jacket_male.webp (581x719 px) at ${OUT.scale} in/px (same canvas and scale assumption as the ABU coat; coat ${OUT.heightIn} in long). No real garment was measured.`,
    anchors:Object.fromEntries(Object.entries(anchorsC).map(([k,v])=>[k,r2(v)])),
    landmarks:LMc,landmarks_note:'rects are {x,y,w,h}; polygons are [[x,y]...]; all in user units (0.01 in), origin top-left of the artwork box',
    dimensions:{coat_length_in:+HEM.toFixed(2),max_width_in:+(2*maxX).toFixed(2),nameplate_in:[PLATE.w,PLATE.h],welt_in:[WELT.w,WELT.h],buttons:3,button_dia_in:BR*2},
    documented:['single breasted, three buttons (Wing and Star or CAP Crest) (CAPR 39-1 4.1.5.2)','nameplate centred on wearer\'s right between sleeve seam and lapel, bottom even with the bottom of the ribbons (4.1.5.2.2.2)','ribbons rest on the welt (4.1.5.2.2.3)','lapel insignia halfway up the lapel seam (4.1.5.2.2.1)','officers wear gray epaulet sleeves, NCOs none (4.1.5.2): boards are the separate asset garment-blues-class-a-cadet-officer-insignia'],
    assumed:['px-to-inch scale','nameplate size (3.375 x 0.75 in = Vanguard CAP0599M cadet name plate (blue plastic, 3 3/8 x 3/4 in); no dimension in CAPR 39-1 or DAFI 36-2903; no dimension in CAPR 39-1 or DAFI 36-2903)','welt size','lapel CAP letters approximated from the builder reference','button diameter','lapel and shirt geometry read off the base image','colours sampled from the base image'],
    fit:{method:'traced from the raster',score:null},grade:'garment'}});

{const semiBody=garment({shirt:'#f3f4f8',noPlate:true}),semiId='garment-semiformal-class-a-coat-male';
 const LMs={};{const R=(k,id)=>{const r=lmRect(semiBody,id,vbC);if(r)LMs[k]=r;},Pg=(k,id)=>{const p=lmPoly(semiBody,id,vbC);if(p)LMs[k]=p;};
  R('welt_pocket','welt-pocket');for(let k=1;k<=3;k++)R('button_'+k,'button-'+k);for(const t of ['right','left'])Pg('lapel_'+t,'lapel-'+t);Pg('shirt','shirt');Pg('tie','tie');}
 const an={...anchorsC};delete an.nameplate_center;
 conv({id:semiId,name:"Men's cadet semi-formal dress: Class A coat (new style) over the white long-sleeve shirt, no nametag",vb:vbC,body:semiBody,source:'reference-art-measured',
  meta:{size_source:'estimated',size_basis:`Same coat, scale and artwork box as garment-blues-class-a-coat (traced from images/base/jacket_male.webp at ${OUT.scale} in/px), so overlays register. No real garment was measured.`,
   anchors:Object.fromEntries(Object.entries(an).map(([k,v])=>[k,r2(v)])),landmarks:LMs,landmarks_note:'rects are {x,y,w,h}; polygons are [[x,y]...]; all in user units (0.01 in), origin top-left of the artwork box',
   dimensions:{coat_length_in:+HEM.toFixed(2),max_width_in:+(2*maxX).toFixed(2),welt_in:[WELT.w,WELT.h],buttons:3,button_dia_in:BR*2},
   documented:['worn as for Service Dress (Class A) new style with the adjustments of CAPR 39-1 4.1.3.2: nametag not worn (4.1.3.2.1)','white long-sleeve shirt (4.1.3.2.3)','tie: blue polyester or silk herringbone twill (4.1.3.2.4)'],
   assumed:['px-to-inch scale','white shirt tone','welt size','button diameter','shirt and lapel geometry read off the base image'],fit:{method:'traced from the raster',score:null},grade:'garment'}});}
// nametag overlays (CAPR 39-1 4.1.5.2.2.2): separate assets registered to the coat, so every wearer can pick the tag that applies
{const NT=require('./nametag-art.js')(lettering),slot={x:PLATE.cx-PLATE.w/2,y:PLATE.cy-PLATE.h/2,w:PLATE.w,h:PLATE.h};
 for(const [tag,kind,who,reg] of [['cadet','cadet','Cadet','4.1.5.2.2.2.2: blue, three-line, white lettering'],['officer-nco','silver','Officer/NCO','4.1.5.2.2.2.1: metal, brushed satin silver, last name engraved in blue']]){
  const body=NT[kind](PLATE.cx,PLATE.cy),LMn={nametag:lmRect(body,'nametag-plate',vbC)};
  conv({id:coatId+'-nametag-'+tag,name:`Men's Class A coat nametag, ${who.toLowerCase()} (overlay, registered to ${coatId}; name left blank)`,vb:vbC,body,source:'original',
   meta:{size_source:kind==='cadet'?'estimated':'estimated',size_basis:kind==='cadet'?'3 3/8 x 3/4 in = Vanguard CAP0599M cadet name plate; the regulation gives no dimension.':'Metal officer/NCO tag drawn at the same 3 3/8 x 3/4 in as the cadet plate (cross-chat standard plate size); the regulation gives no dimension and no vendor plate was cited for 3.0 x 0.7 in.',
    anchors:{...A,nametag_center:lmCen(LMn.nametag)},landmarks:LMn,landmarks_note:'rects are {x,y,w,h} in user units (0.01 in)',overlay_of:coatId,
    documented:[`${who} nametag (CAPR 39-1 ${reg})`,'centred on the wearer\'s right between the sleeve seam and lapel, bottom parallel with the ground and even with the bottom of the ribbons (4.1.5.2.2.2)'],
    assumed:['plate size','name line blank'],fit:{method:'original',score:null},grade:'accessory'}});}}
const boardsBody=boards(),boardsId='garment-blues-class-a-cadet-officer-insignia';
// coat collar + lapel foreground overlay (same box as the coat): draw above badges/devices so they tuck under the collar and lapel
{const gm=coatBody.match(/<g id="lapel-foreground">[\s\S]*?<\/g>/)[0],body=`<defs><clipPath id="lfClip"><path d="${SIL}" clip-rule="evenodd"/></clipPath></defs><g clip-path="url(#lfClip)">${gm}</g>`;
 const LMf={};for(const t of ['right','left']){const q=lmPoly(body,'lapel-face-'+t,vbC);if(q)LMf['lapel_face_'+t]=q;}
 conv({id:coatId+'-lapel-foreground',name:"Men's Class A service dress coat collar and lapels (foreground overlay, registered to "+coatId+"; also fits the semi-formal coat)",vb:vbC,body,source:'reference-art-measured',
  meta:{size_source:'estimated',size_basis:'Same artwork box as '+coatId+'; the collar and lapel faces of the coat redrawn opaque so they cover the shirt collar and any badge or device that slides under them.',
   anchors:{...A},landmarks:LMf,landmarks_note:'polygons are [[x,y]...] in user units (0.01 in)',overlay_of:coatId,documented:['badges and devices worn under the coat collar/lapel tuck beneath it (builder layering)'],assumed:['layer order: above badges, below nothing'],fit:{method:'original',score:null},grade:'accessory'}});}
const LMb={};for(const t of ['right','left']){const r=lmRect(boardsBody,'epaulet-'+t+'-box',vbC);if(r){LMb['epaulet_'+t]=r;LMb['rank_slot_'+t]={...r};}   // compat: the shoulder strip is edge-on, so the slot anchor sits on the strip; the grade goes on the top-down board asset (garment-blues-class-a-cadet-officer-board-*)   // regular-size metal cadet grade forms (Captain/Colonel 2.25 in wide, Major/Lt Col 1.25 in tall): 2.3 x 1.3 in, centred, inside the 4.55 in board
const c=lmRect(boardsBody,'lapel-cap-'+t,vbC);if(c)LMb['lapel_cap_'+t]=c;}
const boardsSvg=conv({id:boardsId,name:"Class A coat cadet officer insignia: shoulder boards + CAP lapel letters (overlay, registered to garment-blues-class-a-coat; blank rank)",vb:vbC,body:boardsBody,source:'reference-art-measured',
  meta:{size_source:'estimated',size_basis:'Same artwork box and px-to-inch scale as garment-blues-class-a-coat so it drops on at 0,0. Board length 4.55 in (builder reference); width from the Vanguard CAP0647V product photo proportions (252 x 622 px).',
    anchors:{...A,epaulet_right_center:lmCen(LMb.epaulet_right),epaulet_left_center:lmCen(LMb.epaulet_left),rank_slot_right_center:lmCen(LMb.rank_slot_right),rank_slot_left_center:lmCen(LMb.rank_slot_left)},
    landmarks:LMb,landmarks_note:'rects are {x,y,w,h} in user units (0.01 in)',overlay_of:coatId,
    dimensions:{strip_thickness_in:0.32},documented:['boards drawn flattened as an edge-on strip on each shoulder; the top-down boards are separate assets','cadet officers wear gray epaulet sleeves with shoulder boards; cadet NCOs/airmen wear none (CAPR 39-1 4.1.5.2)','CAP lapel insignia halfway up the lapel seam, cadet officers only; metal chevrons replace it for NCOs/airmen, none for Airman Basic (4.1.5.2.2.1.2-3)'],
    assumed:['strip thickness 0.32 in','rank diamonds omitted (sold separately)'],fit:{method:'measured from product photo',score:null},grade:'garment'}});
// shoulder cord overlays (one per colour), registered to the coat box and to the semi-formal coat; drawn under the epaulet / board layer
{const CA=require('./cord-art.js')(ARM,1);
 for(const [gid,gname] of [[coatId,"Men's Class A service dress coat"],['garment-semiformal-class-a-coat-male',"Men's cadet semi-formal coat"]])
  for(const c of CA.CORDS){const body=CA.bodies[c],LMk={cord:lmPoly(body,'cord-path',vbC)};
   conv({id:gid+'-cord-'+c,name:`${gname}: ${CA.meta[c].name} (overlay, registered to ${gid})`,vb:vbC,body,source:'original',
    meta:{size_source:'estimated',size_basis:'Same box as '+gid+'; 0.36 in braid following the wearer\'s left armhole seam; colours from assets/cords/cord-'+c+'.spec.json. The regulation gives no cord dimension.',anchors:{...A,cord_start:[ux(CA.pts[0][0]),uy(CA.pts[0][1])],cord_end:[ux(CA.pts[CA.pts.length-1][0]),uy(CA.pts[CA.pts.length-1][1])]},landmarks:LMk,landmarks_note:'polygons are [[x,y]...] in user units (0.01 in)',overlay_of:gid,documented:['shoulder cords are worn on the left shoulder aligned along the shoulder seam, underneath the epaulet (CAPR 39-1 9.3)'],assumed:['cord thickness 0.36 in','path along the armhole seam'],fit:{method:'original',score:null},grade:'accessory'}});}}
// CAP lapel letters as their own layer (draw above the coat's lapel-foreground)
{const body=boards('lapel'),LMl={};for(const t of ['right','left']){const c=lmRect(body,'lapel-cap-'+t,vbC);if(c)LMl['lapel_cap_'+t]=c;}
 conv({id:coatId+'-lapel-cap',name:"Men's Class A coat CAP lapel insignia, cadet officers (overlay; draw above the lapel foreground)",vb:vbC,body,source:'original',
  meta:{size_source:'estimated',size_basis:'Same box as '+coatId+'; CAP letters 0.53 in tall, 1.4 in wide, centred on each lapel (CAPR 39-1 4.1.5.2.2.1.2).',anchors:{...A,lapel_cap_right_center:lmCen(LMl.lapel_cap_right),lapel_cap_left_center:lmCen(LMl.lapel_cap_left)},
   landmarks:LMl,landmarks_note:'rects are {x,y,w,h} in user units (0.01 in)',overlay_of:coatId,documented:['CAP lapel insignia halfway up the seam, cadet officers only (4.1.5.2.2.1.2)'],assumed:['letter size'],fit:{method:'original',score:null},grade:'accessory'}});}
// top-down view of each cadet officer shoulder board (4.55 in long), own asset with grade slot anchors; right/left are mirror images; same board for the men's and women's coats
for(const tag of ['right','left']){
  // Board redrawn to the CAPR 39-1 Fig A5-6 proportions: 2.3 in wide (just over the 2 1/4 in three-diamond row), 4.55 in long, peak with the button at the neck end, black field with the cadet emblem,
  // blue stripe band (taller than the 1 1/4 in diamond) between white/red lines at the outer end; the grade row runs ACROSS the board, centred on the band.
  const LB=EPAU.w,WB=2.3,PK=0.74,sgn=tag==='right'?1:-1,Xu=u=>tag==='right'?u:LB-u,id='garment-blues-class-a-cadet-officer-board-'+tag;
  const vbB={x:-0.1,y:-0.1,w:LB+0.2,h:WB+0.2};
  const stripes=[[0.14,0.21,'#7f1b1e'],[0.21,0.28,'#d9d9db'],[0.28,1.63,'#2a348c'],[1.63,1.70,'#d9d9db'],[1.70,1.77,'#7f1b1e']];
  const emb=EM_L.flatMap(l=>l.pts),ex0=Math.min(...emb.map(p=>p[0])),ex1=Math.max(...emb.map(p=>p[0])),ey0=Math.min(...emb.map(p=>p[1])),ey1=Math.max(...emb.map(p=>p[1])),esc=1.35/(ex1-ex0),ecu=(1.77+(LB-PK))/2;
  const lpE=ls=>'M'+ls.map(l=>l.pts.map(q=>q.join(',')).join('L')).join('ZM')+'Z';
  let body=`<g id="epaulet-${tag}"><title>Cadet officer shoulder board, ${tag} shoulder, top-down (blank grade)</title>`
   +`<path id="board-body" d="M${[[0,0],[LB-PK,0],[LB,WB/2],[LB-PK,WB],[0,WB]].map(p=>f(Xu(p[0]))+','+f(p[1])).join('L')}Z" fill="#171717" stroke="#05060a" stroke-width=".03" stroke-linejoin="round"/>`
   +stripes.map(([a0,a1,c])=>`<rect x="${f(Math.min(Xu(a0),Xu(a1)))}" y="0" width="${f(a1-a0)}" height="${f(WB)}" fill="${c}"/>`).join('')
   +`<g transform="translate(${f(Xu(ecu))} ${f(WB/2)}) rotate(${tag==='right'?90:-90}) scale(${f(esc)}) translate(${f(-(ex0+ex1)/2)} ${f(-(ey0+ey1)/2)})"><path d="${lpE(EM_L)}" fill="#bfc3cb" fill-rule="evenodd"/></g>`
   +`<g transform="translate(${f(Xu(LB-0.42))} ${f(WB/2)}) scale(0.2)">${capCrest()}</g>`
   +`<rect id="epaulet-${tag}-box" x="0" y="0" width="${f(LB)}" height="${f(WB)}" fill="none"/></g>`;
  const rb=lmRect(body,'epaulet-'+tag+'-box',vbB),Wb=vbB.w*U,Hb=vbB.h*U,cy=rb.y+rb.h/2,cx=rb.x+rb.w/2;
  // Fig A5-6: the grade is pinned on the blue stripe band at the outer (shoulder seam) end, below the emblem; the forms run ACROSS the board (Colonel: 3 diamonds 2 1/4 x 1 1/4 in)
  const outerX=tag==='right'?rb.x:rb.x+rb.w,gx=outerX+sgn*(0.28+1.35/2)*U;   // blue band centre 0.955 in from the outer end
  const slot={x:+(gx-67.5).toFixed(2),y:+rb.y.toFixed(2),w:135,h:+rb.h.toFixed(2)};
  for(const IDX of [id,'garment-blues-shoulder-board-top-male-'+tag,'garment-blues-shoulder-board-top-female-'+tag])
    conv({id:IDX,name:`Cadet officer shoulder board, ${tag} shoulder, top-down view (blank grade; rank_slot is the grade area)`,vb:vbB,body,source:'reference-art-measured',
   meta:{size_source:'measured',size_basis:'Redrawn to the CAPR 39-1 Fig A5-6 proportions: 2.3 in wide (just over the 2 1/4 in three-diamond row), 4.55 in long (builder reference), 0.74 in peak, emblem and stripe colours from the Vanguard CAP0647V photo measurements; follows the figure over the photo.',
    anchors:{...std(Wb,Hb),board_center:[+cx.toFixed(2),+cy.toFixed(2)],rank_slot_center:[+gx.toFixed(2),+cy.toFixed(2)],board_outer_end:[+outerX.toFixed(2),+cy.toFixed(2)],outer_end_center:[+outerX.toFixed(2),+cy.toFixed(2)],button_end_center:[+(tag==='right'?rb.x+rb.w:rb.x).toFixed(2),+cy.toFixed(2)],board_top_left:[+rb.x.toFixed(2),+rb.y.toFixed(2)]},
    landmarks:{board:rb,rank_slot:slot,rank_slot_frame:{along_in:1.35,across_in:2.3,runs:'across the board (perpendicular to its length)',note:'the row of grade forms (Cadet Colonel: 3 diamonds 2 1/4 x 1 1/4 in) is centred on the blue band, CAPR 39-1 Fig A5-6; the board is 2.3 in wide so every grade fits at true size'}},landmarks_note:'rects are {x,y,w,h} in user units (0.01 in); rank_slot is the stripe band at the outer end, below the emblem',overlay_of:'garment-blues-class-a-cadet-officer-insignia',
    dimensions:{board_in:[EPAU.w,+EPAU.h.toFixed(3)],rank_slot_in:[1.35,2.3],grade_form_max_in:[2.25,1.25]},documented:['cadet officers wear regular-size grade insignia on Cadet Officer shoulder boards (CAPR 39-1 4.1.5.2.1.3 / 4.1.9.3.4)'],assumed:['stripe band centre 0.935 in from the outer end (from the board photo), grade slot 1.25 in along the board'],fit:{method:'measured from product photo',score:null},grade:'accessory'}});
}
const sq=(innerBody,vb,name,px)=>{const cx=vb.x+vb.w/2,cy=vb.y+vb.h/2,s=Math.max(vb.w,vb.h);
  const x=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${cx-s/2} ${cy-s/2} ${s} ${s}" width="${px}" height="${px}">${DEFS2}${innerBody}</svg>`;
  const tmp=path.join(here,name+'.sq.svg');fs.writeFileSync(tmp,x);
  require('child_process').execSync(`qlmanage -t -s ${px} -o "${here}" "${tmp}" >/dev/null 2>&1 && mv "${tmp}.png" "${path.join(here,name+'_preview.png')}" && rm "${tmp}"`);};
console.log('ok',{coat:coatSvg.length,boards:boardsSvg.length});
sq(coatBody,{x:vbC.x,y:vbC.y,w:vbC.w,h:vbC.h},'blues_class_a',+(process.env.PX||1100));
sq(coatBody+boardsBody,{x:vbC.x,y:vbC.y,w:vbC.w,h:vbC.h},'blues_class_a_boards',+(process.env.PX||1100));
console.log('ok',{coat:coatSvg.length});
if(process.env.ALIGN){const S2=S;sq(coatBody,{x:X(290.5)-581*S2/2,y:Y(359.5)-719*S2/2,w:581*S2,h:719*S2},'blues_align',719);}
if(process.env.ZOOM){const [zx,zy,zw,zh]=process.env.ZOOM.split(',').map(Number);sq(coatBody,{x:zx,y:zy,w:zw,h:zh},'blues_zoom',900);}
