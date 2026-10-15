// Class B (USAF-style light blue short-sleeve shirt + trousers/skirt, CAPR 39-1 4.1.11 men / 4.1.12 women), built from the
// traced base images images/base/blues_class_b_{male,female}.webp. Silhouette traced (trace-silhouette.js, 0.0474 in/px, same scale
// assumption as the Class A coat); interior parts are parametric in inches. Raster -> inch: x=(px-cx)*S, y=(py-y0)*S.
const fs=require('fs'),path=require('path');
const f=n=>(+n).toFixed(3),STROKE='#00102f',NAVY='#001c52',SHIRT='#c6cde8',LINE='#4a5688';
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

const poly=a=>'M'+a.map(p=>f(p[0])+','+f(p[1])).join('L')+'Z';
const ln=(d,w=.04,op=.55)=>`<path d="${d}" fill="none" stroke="${LINE}" stroke-opacity="${op}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const btn=(x,y,id)=>`<g id="${id}"><circle cx="${f(x)}" cy="${f(y)}" r=".23" fill="#a3abd0" stroke="#8b94bd" stroke-width=".03"/><circle cx="${f(x)}" cy="${f(y)}" r=".15" fill="none" stroke="#8f98c2" stroke-width=".022"/>${[[-1,-1],[1,-1],[-1,1],[1,1]].map(([i,j])=>`<circle cx="${f(x+i*.065)}" cy="${f(y+j*.065)}" r=".032" fill="#6f79a6"/>`).join('')}</g>`;

function build(CFG){
  const OUT=JSON.parse(fs.readFileSync(path.join(here,CFG.outline),'utf8')),S=OUT.scale,cx=OUT.cx,y0=OUT.y0;
  const X=px=>(px-cx)*S,Y=py=>(py-y0)*S,DX=d=>d*S;      // DX: pixel offset from the centreline -> inches
  if(CFG.smoothTorso){   // replace the traced, kinked waist/hip edge with one smooth curve (|x| by y), mirrored
    const T=CFG.smoothTorso,m=T.map((p,i)=>{const a=T[Math.max(0,i-1)],c=T[Math.min(T.length-1,i+1)];return (c[1]-a[1])/(c[0]-a[0]);}),
      lerp=y=>{for(let i=0;i<T.length-1;i++)if(y>=T[i][0]&&y<=T[i+1][0]){const h=T[i+1][0]-T[i][0],t=(y-T[i][0])/h,t2=t*t,t3=t2*t;
        return (2*t3-3*t2+1)*T[i][1]+(t3-2*t2+t)*h*m[i]+(-2*t3+3*t2)*T[i+1][1]+(t3-t2)*h*m[i+1];}return T[T.length-1][1];};
    const lo=T[0][0],hi=T[T.length-1][0],inRun=p=>p[1]>lo+0.01&&p[1]<hi-0.01&&Math.abs(p[0])<T[0][1]+0.4;
    const out=[];let i=0;const P=OUT.outline;
    while(i<P.length){if(!inRun(P[i])){out.push(P[i]);i++;continue;}
      let j=i;while(j<P.length&&inRun(P[j]))j++;
      const run=P.slice(i,j),sx=Math.sign(run[0][0]),up=run[0][1]>run[run.length-1][1],n=Math.max(8,Math.round((hi-lo)/0.3));
      const ys=Array.from({length:n+1},(_,k)=>lo+(hi-lo)*k/n);if(up)ys.reverse();
      ys.filter(y=>y>lo+0.01&&y<hi-0.01).forEach(y=>out.push([sx*lerp(y),y]));i=j;}
    OUT.outline=out;}
  const o=OUT.outline,HEM=OUT.heightIn,maxX=Math.max(...o.map(p=>Math.abs(p[0])));
  const SIL=poly(o)+(OUT.holes||[]).map(poly).join('');
  const topY=x=>{let b=1e9;for(let i=0;i<o.length;i++){const a=o[i],c=o[(i+1)%o.length];if(a[0]*c[0]<0&&0)continue;const ax=a[0],cxx=c[0];if((ax-x)*(cxx-x)<=0&&ax!==cxx){const y=a[1]+(c[1]-a[1])*(x-ax)/(cxx-ax);if(y<8&&y<b)b=y;}}return b;};
  const wl0=Y(CFG.waist.edge)+0.02,BG=maxX+2;
  let g=`<defs><clipPath id="clipSil"><path d="${SIL}" clip-rule="evenodd"/></clipPath><clipPath id="clipTop"><rect x="${f(-BG)}" y="-2" width="${f(2*BG)}" height="${f(wl0+2)}"/></clipPath><clipPath id="clipBot"><rect x="${f(-BG)}" y="${f(wl0)}" width="${f(2*BG)}" height="${f(HEM+3)}"/></clipPath>`
    +`<radialGradient id="buckleG" cx=".42" cy=".4" r=".75"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#dcdee3"/><stop offset="1" stop-color="#b3b7c0"/></radialGradient>`
    +`<linearGradient id="tipG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9eaee"/><stop offset="1" stop-color="#bfc2ca"/></linearGradient></defs>`;
  g+=`<g id="garment-body"><path id="silhouette" d="${SIL}" fill="${SHIRT}" fill-rule="evenodd"/><g clip-path="url(#clipSil)">`;
  // bottoms (trousers / skirt) below the waist line
  const wl=Y(CFG.waist.edge),wc=Y(CFG.waist.mid),BIG=maxX+1,BLT=OUT.bottoms?OUT.bottoms.filter(p=>p[1]>wl+0.1)[0][0]+0.06:BIG;
  if(OUT.bottoms){const pr=OUT.bottoms.filter(p=>p[1]>wl+0.1).map(p=>[p[0]+0.06,p[1]]),h0=pr[0][0],R=pr.map(p=>f(p[0])+','+f(p[1])),Lf=pr.slice().reverse().map(p=>f(-p[0])+','+f(p[1]));
    g+=`<path id="${CFG.bottomId}" d="M${f(-h0)},${f(wl)} Q0,${f(2*wc-wl)} ${f(h0)},${f(wl)} L${R.join(' L')} L${f(pr[pr.length-1][0])},${f(HEM+1)} L${f(-pr[pr.length-1][0])},${f(HEM+1)} L${Lf.join(' L')} Z" fill="${NAVY}"/>`;}
  else g+=`<path id="${CFG.bottomId}" d="M${f(-BIG)},${f(wl)} Q0,${f(2*wc-wl)} ${f(BIG)},${f(wl)} L${f(BIG)},${f(HEM+1)} L${f(-BIG)},${f(HEM+1)} Z" fill="${NAVY}"/>`;
  // seams read off the base image
  for(const s of [-1,1])g+=ln('M'+CFG.arm.map(p=>f(s*DX(p[0]))+','+f(Y(p[1]))).join(' L'),.04,.5);
  if(CFG.yoke)for(const s of [-1,1])g+=ln('M'+CFG.yoke.map(p=>f(s*DX(p[0]))+','+f(Y(p[1]))).join(' L'),.035,.4);
  // epaulet straps (shirt colour) on the shoulders, drawn BEFORE the collar so the leaf lies over their inner end (CAPR 39-1 Fig 4.10); cadet officer blue epaulet sleeves + miniature grade insignia go here
  const ep={};
  for(const [s,tag] of [[1,'right'],[-1,'left']]){const xo=s*DX(CFG.ep.outer),xi=s*DX(CFG.ep.inner),e=x=>topY(x),wid=CFG.ep.w;
    const A=[xo,e(Math.abs(xo))+0.02],B=[xi,e(Math.abs(xi))+0.02],tx=B[0]-A[0],ty=B[1]-A[1],L=Math.hypot(tx,ty),ux=tx/L,uy=ty/L;
    // normal pointing into the body (downwards on screen)
    let n=[-uy,ux];if(n[1]<0)n=[uy,-ux];
    const A2=[A[0]+n[0]*wid,A[1]+n[1]*wid],B2=[B[0]+n[0]*wid,B[1]+n[1]*wid];
    // shirt-fabric epaulet: squared at the armhole seam, pointed at the neck end with a button + topstitching (CAPR 39-1 4.1.11.1.1 / 4.1.12.2: blouse/shirt "will have epaulets")
    const T=[(B[0]+B2[0])/2+ux*0.5,(B[1]+B2[1])/2+uy*0.5],pts=[A,B,T,B2,A2],ins=0.1,mid=(p,q)=>[(p[0]+q[0])/2,(p[1]+q[1])/2];
    const Bi=[B[0]+n[0]*ins,B[1]+n[1]*ins],B2i=[B2[0]-n[0]*ins,B2[1]-n[1]*ins],Ai=[A[0]+ux*ins+n[0]*ins,A[1]+uy*ins+n[1]*ins],A2i=[A2[0]+ux*ins-n[0]*ins,A2[1]+uy*ins-n[1]*ins],Ti=[T[0]-ux*ins*1.6,T[1]-uy*ins*1.6];
    const bt=mid(B,B2),bp=[bt[0]+ux*0.12,bt[1]+uy*0.12];
    g+=`<g id="epaulet-${tag}"><title>Epaulet strap landmark (shoulder loop position, not drawn: epaulet sleeves are separate overlays and the base image carries no rank items)</title>`
      +`<path id="epaulet-${tag}-strap" d="M${pts.map(p=>f(p[0])+','+f(p[1])).join('L')}Z" fill="none" stroke="none"/></g>`;}
  // collar leaves + roll
  const leaf=s=>{const L=CFG.leaf,P=(p)=>[s*DX(-p[0]),Y(p[1])];return {tip:P(L.tip),out:P(L.out),bot:P(L.bot),roll:L.roll.map(P)};};
  const leaves={};let cf='';
  for(const [s,tag] of [[1,'right'],[-1,'left']]){const lf=leaf(s);leaves[tag]=lf;  // pixel offsets are listed on the image-left (wearer's right, -x) side
    const pr=[lf.tip,lf.out,lf.bot,...lf.roll],pd=p=>f(p[0])+','+f(p[1]);
    cf+=`<path id="collar-${tag}" d="M${pr.map(pd).join('L')}Z" fill="${SHIRT}"/>`
      +ln(`M${pd(lf.tip)} L${pd(lf.out)} L${pd(lf.bot)} L${lf.roll.map(pd).join(' L')}`,.04,.6)
      +ln(`M${pd(lf.tip)} L${pd(lf.bot)}`,.035,.5);}
  g+=`<g id="collar-foreground"><title>Shirt collar leaves (draw above the body; collar insignia sit on them)</title>${cf}</g>`;
  // placket line, buttons
  g+=ln(`M${f(DX(CFG.placketX))},${f(Y(CFG.placketTop))} L${f(DX(CFG.placketX))},${f(Y(CFG.waist.mid)-0.05)}`,.04,.55);
  CFG.btnY.forEach((by,i)=>g+=btn(0,Y(by),`button-${i+1}`));
  // pockets (male)
  if(CFG.pocket){const P=CFG.pocket;
    for(const [s,tag] of [[-1,'right'],[1,'left']]){const x0=s*DX(P.in),x1=s*DX(P.out),xa=Math.min(x0,x1),xb=Math.max(x0,x1),w=xb-xa,t=Y(P.top),fb=Y(P.flapBot),bt=Y(P.bot),c=DX(P.chamfer);
      g+=`<g id="pocket-${tag}"><rect id="pocket-${tag}-box" x="${f(xa)}" y="${f(t)}" width="${f(w)}" height="${f(bt-t)}" fill="none" stroke="none"/>`
        +ln(`M${f(xa)},${f(t)} L${f(xb)},${f(t)} L${f(xb)},${f(bt-c)} L${f(xb-c)},${f(bt)} L${f(xa+c)},${f(bt)} L${f(xa)},${f(bt-c)} Z`,.045,.6)
        +ln(`M${f(xa)},${f(fb-0.12)} Q${f(xa)},${f(fb)} ${f(xa+0.14)},${f(fb)} L${f(xb-0.14)},${f(fb)} Q${f(xb)},${f(fb)} ${f(xb)},${f(fb-0.12)}`,.045,.6)
        +ln(`M${f(s*DX(P.pleat[0]))},${f(fb)} L${f(s*DX(P.pleat[0]))},${f(bt-0.04)} L${f(s*DX(P.pleat[1]))},${f(bt-0.04)} L${f(s*DX(P.pleat[1]))},${f(fb)}`,.04,.5)
        +btn(s*DX(P.btnX),Y(P.btnY),`pocket-${tag}-button`)+`</g>`;}}
  // belt: blue band (two faint edge lines) + plain silver buckle with ridged tip (CAPR 39-1 Figs 4.8-4.10; tip faces the wearer's ${CFG.tipSide>0?'left':'right'})
  const bk=CFG.buckle,bx0=DX(bk.x0),bx1=DX(bk.x1),bsp=DX(bk.split),by0=Y(bk.y0),by1=Y(bk.y1),bh=by1-by0,tipL=CFG.tipSide>0?bsp:bx0,tipR=CFG.tipSide>0?bx1:bsp,bodyL=CFG.tipSide>0?bx0:bsp,bodyR=CFG.tipSide>0?bsp:bx1;
  g+=`<path d="M${f(-BLT)},${f(by0-0.04)} L${f(BLT)},${f(by0-0.04)} M${f(-BLT)},${f(by1+0.04)} L${f(BLT)},${f(by1+0.04)}" stroke="#000a24" stroke-opacity=".55" stroke-width=".04" fill="none"/>`;
  g+=`<g id="belt-buckle"><rect id="belt-buckle-box" x="${f(bx0)}" y="${f(by0)}" width="${f(bx1-bx0)}" height="${f(bh)}" fill="none"/>`
    +`<rect x="${f(tipL)}" y="${f(by0+0.06)}" width="${f(tipR-tipL)}" height="${f(bh-0.12)}" fill="url(#tipG)" stroke="#8d93a1" stroke-width=".03"/>`
    +[0.33,0.66].map(t=>`<path d="M${f(tipL+(tipR-tipL)*t)},${f(by0+0.1)} L${f(tipL+(tipR-tipL)*t)},${f(by1-0.1)}" stroke="#9aa0ad" stroke-width=".025"/>`).join('')
    +`<rect x="${f(bodyL)}" y="${f(by0)}" width="${f(bodyR-bodyL)}" height="${f(bh)}" rx=".2" fill="url(#buckleG)" stroke="#8d93a1" stroke-width=".035"/>`
    +`<path d="M${f((bodyL+bodyR)/2)},${f(by0-0.03)} L${f((bodyL+bodyR)/2)},${f(by0+0.04)} M${f((bodyL+bodyR)/2)},${f(by1-0.04)} L${f((bodyL+bodyR)/2)},${f(by1+0.03)}" stroke="#8d93a1" stroke-width=".05" stroke-linecap="round"/></g>`;
  if(CFG.long){const L=CFG.long;
    // cuffs: band line + button near the outer edge (convertible cuffs, men / rounded cuffs with buttonhole closure, women)
    for(const s of [-1,1]){const y=L.cuffTop-((OUT.long_sleeve&&OUT.long_sleeve.cuff_shift_in)||0),xo=L.cuffOuter,xi=L.cuffInner;
      g+=ln(`M${f(s*xi)},${f(y)} L${f(s*xo)},${f(y)}`,.045,.6)+`<circle cx="${f(s*(xo-0.5))}" cy="${f(y+0.55)}" r=".16" fill="#a3abd0" stroke="#8b94bd" stroke-width=".025"/>`;}
    if(L.tie){const T=L.tie,R=T.map(p=>f(p[0])+','+f(p[1])),Lf=T.slice().reverse().map(p=>f(-p[0])+','+f(p[1]));
      g+=`<g id="tie"><title>Blue tie (CAPR 39-1 4.1.11, worn with the long-sleeve shirt; the tip covers part of the belt buckle, 4.1.8.3)</title><path id="tie-body" d="M${R.join(' L')} L${Lf.join(' L')} Z" fill="#0a2461" stroke="#04123a" stroke-width=".04" stroke-linejoin="round"/><path d="M0,${f(T[0][1]+0.4)} L0,${f(T[T.length-1][1]-0.4)}" stroke="#2a4690" stroke-width=".05" stroke-opacity=".5"/></g>`;}
    if(L.tab){g+=`<g id="tie-tab"><title>Blue satin tie tab, mandatory with the long-sleeve blouse</title><path id="tie-tab-body" d="M${L.tab.map(p=>f(p[0])+','+f(p[1])).join(' L')}" fill="none" stroke="#12296d" stroke-width=".62" stroke-linejoin="miter" stroke-linecap="butt"/></g>`;}
  }
  g+=`</g>`;
  g+=`<path d="${SIL}" fill="none" clip-path="url(#clipTop)" stroke="${STROKE}" stroke-opacity=".5" stroke-width=".05" stroke-linejoin="round"/><path d="${SIL}" fill="none" clip-path="url(#clipBot)" stroke="#000a24" stroke-opacity=".6" stroke-width=".04" stroke-linejoin="round"/></g>`;
  // nametag slot only: nametags differ by member (cadet blue, senior member silver), so no plate is drawn on the base
  const PW=3.375,PH=0.75,pl={cx:DX(CFG.plate.cx),cy:Y(CFG.plate.cy)};
  g+=`<g id="nameplate"><rect x="${f(pl.cx-PW/2)}" y="${f(pl.cy-PH/2)}" width="${PW}" height="${PH}" fill="none"><title>Nametag position (blank: cadet tags are blue, senior member tags silver) (CAPR 39-1 ${CFG.reg}.4)</title></rect></g>`;
  const vb={x:-(maxX+0.2),y:-0.1,w:2*(maxX+0.2),h:HEM+0.2};
  return {g,vb,X,Y,DX,leaves,HEM,maxX,OUT};
}

const CFGS=[
 {id:'garment-blues-class-b-shirt-male',name:"Men's Class B blue short-sleeve shirt and trousers (nametag position only)",outline:'class_b_male_outline.json',reg:'4.1.11.1.1.2.1',
  bottomId:'trousers',waist:{edge:489,mid:493},
  arm:[[-167,162.5],[-157,210],[-144.5,265],[-137,315],[-132,367.5]],   // pixel offsets from the centreline (image-left side listed; mirrored)
  leaf:{tip:[-52,98],out:[-96,181],bot:[-47,186.5],roll:[[-1.5,208]]},
  placketX:-7,placketTop:208,btnY:[215,293.5,371,448],
  pocket:{in:34.5,out:125.5,top:257.5,flapBot:300,bot:388,chamfer:12,pleat:[64.5,96],btnX:80,btnY:289},
  ep:{outer:-160,inner:-84,w:1.75},tipSide:1,
  buckle:{x0:-7.5,x1:35.5,y0:498.5,y1:527,split:27.8},
  plate:{cx:-80,cy:257.5-0.375/0.0474}},
 {id:'garment-blues-class-b-blouse-female',name:"Women's Class B blue short-sleeve blouse and skirt (nametag position only)",outline:'class_b_female_outline.json',reg:'4.1.12.2.4.1',
  bottomId:'skirt',waist:{edge:465,mid:471.5},
  arm:[[-199,85],[-172,172],[-157,240],[-155,305],[-153,368]],
  yoke:[[-196,85],[-93.5,60]],
  smoothTorso:[[13.45,5.74],[15.0,5.05],[16.6,4.66],[17.7,4.62],[20.0,5.45],[23.0,6.40]],
  leaf:{tip:[-62.5,17.5],out:[-120.5,109],bot:[-56.5,105],roll:[[-54,121],[-30,136],[0,144]]},
  placketX:14,placketTop:144,btnY:[157.5,253.5,340.5,435],
  pocket:null,
  ep:{outer:-195,inner:-92,w:1.75},tipSide:-1,
  buckle:{x0:-38.5,x1:14,y0:476,y1:509.5,split:-26.9},
  plate:{cx:-3.05/0.0385,cy:157.5+1.5/0.0385}},   // centre 1 1/2 in below the first exposed button: 'even with to 1 1/2 inches higher or lower' (CAPR 39-1 4.1.12.2.4.1)
];

// ---- long-sleeve variants: silhouette measured from CAPR 39-1 Figures 4.8 / 4.11 (see make-long-outlines.js)
const LONG_BASIS=(fig,k)=>`Silhouette (long sleeves, collar, torso, trousers/skirt) measured from CAPR 39-1 ${fig} (3 March 2020): the figure was rendered at 2.2x, traced, and scaled with the registration of its short-sleeve twin to the short-sleeve base image, so interior parts line up with garment-blues-class-b-${k}. No real garment was measured.`;
CFGS.push({...CFGS[0],id:'garment-blues-class-b-shirt-male-long',name:"Men's Class B blue long-sleeve shirt, tie and trousers (nametag position only)",outline:'class_b_male_long_outline.json',
  long:{cuffTop:24.04,cuffOuter:9.2,cuffInner:7.15,basis:LONG_BASIS('Figure 4.8','shirt-male'),
    tie:[[0,1.9],[0.4,2.3],[0.68,3.4],[0.58,4.5],[0.52,4.9],[0.86,8.0],[0.99,12.0],[1.08,16.0],[1.14,19.0],[0.0,20.3]],
    documented:['light blue long-sleeve shirt, two pleated pockets, convertible cuffs, epaulets (CAPR 39-1 4.1.11.1.1)','long sleeves end 1/4 to 1/2 in below the wrist (4.1.11.1.1)','tie: the tip covers a portion of the belt buckle but does not extend below it (4.1.8.3, as for the other men\'s blues)','nameplate centred on, resting on (not over) the top edge of the wearer\'s right pocket (4.1.11.1.1.2.1)','cadet NCOs/airmen: metal chevrons on both sides of the collar, 1 in from and parallel to the front of the collar (4.1.11.1.1.1.4)']}});
CFGS.push({...CFGS[1],id:'garment-blues-class-b-blouse-female-long',name:"Women's Class B blue long-sleeve blouse, tie tab and skirt (nametag position only)",outline:'class_b_female_long_outline.json',
  long:{cuffTop:27.98,cuffOuter:9.45,cuffInner:7.05,basis:LONG_BASIS('Figure 4.11','blouse-female'),
    tab:[[-1.35,4.35],[0,2.55],[1.35,4.35]],
    documented:['long-sleeve blouse with rounded cuffs and buttonhole closures, epaulets, no military creases (CAPR 39-1 4.1.9.5 / 4.1.12.2)','blue satin tie tab with the long-sleeve blouse (4.1.12)','nameplate centred on the wearer\'s right, even with to 1.5 in above/below the first exposed button (4.1.12.2.4.1)']}});
const sq=(innerBody,vb,name,px)=>{const cx=vb.x+vb.w/2,cy=vb.y+vb.h/2,s=Math.max(vb.w,vb.h);
  const x=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${cx-s/2} ${cy-s/2} ${s} ${s}" width="${px}" height="${px}">${DEFS2}${innerBody}</svg>`;
  const tmp=path.join(here,name+'.sq.svg');fs.writeFileSync(tmp,x);
  require('child_process').execSync(`qlmanage -t -s ${px} -o "${here}" "${tmp}" >/dev/null 2>&1 && mv "${tmp}.png" "${path.join(here,name+'_preview.png')}" && rm "${tmp}"`);};

for(const CFG of CFGS){
  const B=build(CFG),vb=B.vb,body=B.g;
  const ux=x=>+((x-vb.x)*U).toFixed(2),uy=y=>+((y-vb.y)*U).toFixed(2);
  const LM={};
  const R=(k,id)=>{const r=lmRect(body,id,vb);if(r)LM[k]=r;},Pg=(k,id)=>{const p=lmPoly(body,id,vb);if(p)LM[k]=p;};
  R('nameplate_box','belt-buckle-box');delete LM.nameplate_box;
  const npm=body.match(/<g id="nameplate"><rect x="([\d.-]+)" y="([\d.-]+)" width="([\d.]+)" height="([\d.]+)"/);
  LM.nameplate={x:ux(+npm[1]),y:uy(+npm[2]),w:+(npm[3]*U).toFixed(2),h:+(npm[4]*U).toFixed(2)};
  R('belt_buckle','belt-buckle-box');
  if(CFG.pocket){R('pocket_right','pocket-right-box');R('pocket_left','pocket-left-box');}
  for(const t of ['right','left']){Pg('epaulet_'+t,'epaulet-'+t+'-strap');Pg('collar_'+t,'collar-'+t);}
  const A=std(vb.w*U,vb.h*U);
  const SAm=require('./sleeve-anchors.js')({outline:B.OUT.outline,holes:B.OUT.holes,arm:CFG.arm.map(p=>[B.DX(p[0]),B.Y(p[1])]),long:!!CFG.long});
  const SAu=Object.fromEntries(Object.entries(SAm).map(([k,v])=>[k,[ux(v[0]),uy(v[1])]]));
  const anchors={...A,...SAu,hem_center:[A.top_center[0],uy(B.HEM)],
    nameplate_center:lmCen(LM.nameplate),epaulet_right_center:lmCen(lmBox(LM.epaulet_right)),epaulet_left_center:lmCen(lmBox(LM.epaulet_left)),
    belt_buckle_center:lmCen(LM.belt_buckle)};
  // cadet NCO/airman collar chevrons: 1 in from and parallel to the front (leading) edge of the collar, centred along it (4.1.11.1.1.1.4 / 4.1.12.2.3.5, Fig A5-5)
  const collarSpot=poly=>{const [a,b,c]=poly,m=[(a[0]+b[0])/2,(a[1]+b[1])/2],e=[b[0]-a[0],b[1]-a[1]],L=Math.hypot(e[0],e[1]);let n=[-e[1]/L,e[0]/L];
    if(n[0]*(c[0]-m[0])+n[1]*(c[1]-m[1])<0)n=[-n[0],-n[1]];return {c:[+(m[0]+n[0]*100).toFixed(2),+(m[1]+n[1]*100).toFixed(2)],deg:+(Math.atan2(e[1],e[0])*180/Math.PI).toFixed(1)};};
  {const r=collarSpot(LM.collar_right),l=collarSpot(LM.collar_left);anchors.collar_insignia_right=r.c;anchors.collar_insignia_left=l.c;anchors.collar_insignia_right_deg=undefined;delete anchors.collar_insignia_right_deg;LM.collar_insignia_angle_deg={right:r.deg,left:l.deg};}
  CFG.btnY.forEach((by,i)=>anchors['button_'+(i+1)+'_center']=[ux(0),uy(B.Y(by))]);
  if(CFG.pocket){anchors.pocket_right_top_center=[LM.pocket_right.x+LM.pocket_right.w/2,LM.pocket_right.y];anchors.pocket_left_top_center=[LM.pocket_left.x+LM.pocket_left.w/2,LM.pocket_left.y];
    anchors.ribbon_row_bottom_center=anchors.pocket_left_top_center;anchors.nameplate_rest_center=anchors.pocket_right_top_center;
    LM.ribbon_slot={x:+(LM.pocket_left.x+LM.pocket_left.w/2-206.25).toFixed(2),y:+(LM.pocket_left.y-150).toFixed(2),w:412.5,h:150};}   // 4.125 x 1.5 in on the left pocket top edge (4.1.11.1.1.2.2)
  else{anchors.ribbon_row_bottom_center=[+(2*ux(0)-anchors.nameplate_center[0]).toFixed(2),LM.nameplate.y+LM.nameplate.h];   // wearer's LEFT = mirror of the nametag side; bottom of ribbons aligned with the bottom of the nametag (4.1.12.2.4.2)
    LM.ribbon_slot={x:+(anchors.ribbon_row_bottom_center[0]-206.25).toFixed(2),y:+(anchors.ribbon_row_bottom_center[1]-150).toFixed(2),w:412.5,h:150};}
  const male=!!CFG.pocket;
  const svg=conv({id:CFG.id,name:CFG.name,vb,body,source:'reference-art-measured',
    meta:{size_source:'estimated',size_basis:CFG.long?CFG.long.basis:`Silhouette traced from images/base/${male?'blues_class_b_male':'blues_class_b_female'}.webp (581x719 px) at ${male?'0.0474':'0.0385'} in/px. ${male?'Same canvas and scale assumption as the Class A coat.':'Scaled so the blouse is the same sleeve-to-sleeve width as the men\'s shirt (20.7 in), as in CAPR 39-1 Figs 4.9/4.10 where the same nametag is the same fraction of both garments.'} No real garment was measured.`,
      anchors:Object.fromEntries(Object.entries(anchors).map(([k,v])=>[k,r2(v)])),landmarks:LM,
      landmarks_note:'rects are {x,y,w,h}; polygons are [[x,y]...]; all in user units (0.01 in), origin top-left of the artwork box',
      dimensions:{length_in:+B.HEM.toFixed(2),max_width_in:+(2*B.maxX).toFixed(2),nameplate_in:[3.375,0.75],buttons:CFG.btnY.length},
      documented:CFG.long?CFG.long.documented:male?['light blue short-sleeve shirt, two pleated pockets, epaulets (CAPR 39-1 4.1.11.1.1)','nameplate centred on, resting on (not over) the top edge of the wearer\'s right pocket (4.1.11.1.1.2.1)','ribbons centred on, resting on the top edge of the wearer\'s left pocket (4.1.11.1.1.2.2)','cadet officers: miniature grade on blue epaulet sleeves; cadet NCOs/airmen: metal chevrons on both sides of the collar, 1 in from and parallel to the front of the collar (4.1.11.1.1.1.4)','blue belt with plain silver tip and buckle, tip toward the wearer\'s left (4.1.11.1.1.5)','tie optional with short sleeves (4.1.11.1.1.3)']
        :['blouse with epaulets, no military creases (4.1.12.2)','nameplate centred on the wearer\'s right, even with to 1.5 in above/below the first exposed button (4.1.12.2.4.1)','ribbons centred on the wearer\'s left, bottom aligned with the bottom of the nametag (4.1.12.2.4.2)','cadet officers: miniature grade on blue epaulet sleeves; cadet NCOs/airmen: metal chevrons on both sides of the collar (4.1.12.2.3)','blue belt with plain silver tip and buckle, tip toward the wearer\'s right (4.1.12.7)','tie tab optional with short sleeves (4.1.12.4)'],
      assumed:[male?'px-to-inch scale':'px-to-inch scale (women\'s base image drawn larger on its canvas; rescaled to match the men\'s shirt width)','nameplate size (3.375 x 0.75 in = Vanguard CAP0599M cadet name plate (blue plastic, 3 3/8 x 3/4 in); no dimension in CAPR 39-1 or DAFI 36-2903; no dimension in CAPR 39-1 or DAFI 36-2903)','epaulet strap size and shape (not drawn in the base image)','collar leaf, pocket and seam geometry read off the base image','colours sampled from the base image',male?'trousers cut off at the base image\'s crop line':'skirt cut off at the base image\'s crop line'],
      fit:{method:'traced from the raster',score:null},grade:'garment'}});
  {const NT=require('./nametag-art.js')(lettering),pcx=ux(0)/U*0+ (+npm[1]+ +npm[3]/2),pcy=+npm[2]+ +npm[4]/2;
   for(const [tag,kind,who] of [['cadet','cadet','cadet'],['adult','gray','adult member']]){
    const nb=NT[kind](pcx,pcy),r=lmRect(nb,'nametag-plate',vb);
    conv({id:CFG.id+'-nametag-'+tag,name:`${CFG.name.split(',')[0]} nametag, ${who} (overlay, registered to ${CFG.id}; name left blank)`,vb,body:nb,source:'original',
     meta:{size_source:'estimated',size_basis:'3 3/8 x 3/4 in = Vanguard CAP0599M cadet name plate; the regulation gives no dimension. Adult plate assumed the same size.',
      anchors:{...A,nametag_center:lmCen(r)},landmarks:{nametag:r},landmarks_note:'rects are {x,y,w,h} in user units (0.01 in)',overlay_of:CFG.id,
      documented:[`nametag is ${who==='cadet'?'blue':'gray'}, three-line, white lettering (CAPR 39-1 ${CFG.reg.replace(/\.4$/,'')}.1)`],assumed:['plate size','name line blank'],fit:{method:'original',score:null},grade:'accessory'}});}}
  // epaulet sleeves (CAPR 39-1 4.1.11.1.1.1 / 4.1.12.2.3): gray for adult officers, blue for cadet officers; slip over the shirt epaulet, grade insignia centred 5/8 in from the outer end
  {const toIn=p=>[p[0]/U+vb.x,p[1]/U+vb.y],Pj=a=>a.map(p=>f(p[0])+','+f(p[1])).join('L');
   for(const [tag,col,edge,who,regs] of [['officer','#6e6a69','#4a4746','adult officer','gray epaulet sleeves, embroidered grade (4.1.11.1.1.1.1 / 4.1.12.2.3.1)'],['cadet-officer','#072157','#041640','cadet officer','blue epaulet sleeves, miniature grade (4.1.11.1.1.1.4 / 4.1.12.2.3.4)']]){
    let eb='',EL={};const SLOT={},RULE={},TOP={};
    for(const t of ['right','left']){const q=LM['epaulet_'+t].map(toIn),[P0,P1,P2,P3,P4]=q;
      const lerp=(a,b,k)=>[a[0]+(b[0]-a[0])*k,a[1]+(b[1]-a[1])*k],K=0.82,A1=lerp(P0,P1,K),A2=lerp(P4,P3,K);
      // edge-on strip lying on the shoulder strap (the way it looks from the front); the full sleeve is the separate top-down asset
      const nn=[P4[0]-P0[0],P4[1]-P0[1]],nl0=Math.hypot(nn[0],nn[1]),n1=[nn[0]/nl0,nn[1]/nl0],th=0.4,sl=[P0,A1,[A1[0]+n1[0]*th,A1[1]+n1[1]*th],[P0[0]+n1[0]*th,P0[1]+n1[1]*th]];
      TOP[t]={w:nl0,len:Math.hypot(A1[0]-P0[0],A1[1]-P0[1]),deg:Math.atan2(A1[1]-P0[1],A1[0]-P0[0])*180/Math.PI};
      const m0=[(P0[0]+P4[0])/2,(P0[1]+P4[1])/2],m1=[(P1[0]+P3[0])/2,(P1[1]+P3[1])/2],dl=Math.hypot(m1[0]-m0[0],m1[1]-m0[1]),dv=[(m1[0]-m0[0])/dl,(m1[1]-m0[1])/dl],rc=[m0[0]+dv[0]*0.625,m0[1]+dv[1]*0.625];
      eb+=`<g id="epaulet-sleeve-${t}"><title>${who} epaulet sleeve, ${t} shoulder (blank: grade insignia centred 5/8 in from the outer end)</title><path id="epaulet-sleeve-${t}-body" d="M${Pj(sl)}Z" fill="${col}" stroke="${edge}" stroke-width=".05" stroke-linejoin="round"/>`
        +`</g>`+(()=>{const xs=sl.map(p=>p[0]),ys=sl.map(p=>p[1]);RULE[t]=rc;   // compat anchors sit on the edge-on strip; grade goes on the top-down asset
          return `<g id="rank-slot-${t}"><rect x="${f(Math.min(...xs))}" y="${f(Math.min(...ys))}" width="${f(Math.max(...xs)-Math.min(...xs))}" height="${f(Math.max(...ys)-Math.min(...ys))}" fill="none"/></g>`;})();}
    const E={};for(const t of ['right','left']){const m=eb.match(new RegExp(`<path id="epaulet-sleeve-${t}-body" d="([^"]+)"`));const n=m[1].match(/-?\d*\.?\d+/g).map(Number),xs=[],ys=[];for(let i=0;i<n.length;i+=2){xs.push(n[i]);ys.push(n[i+1]);}
      E['epaulet_sleeve_'+t]={x:ux(Math.min(...xs)),y:uy(Math.min(...ys)),w:+((Math.max(...xs)-Math.min(...xs))*U).toFixed(2),h:+((Math.max(...ys)-Math.min(...ys))*U).toFixed(2)};
      const rm=eb.match(new RegExp(`<g id="rank-slot-${t}"><rect x="([-\\d.]+)" y="([-\\d.]+)"`));const rw=eb.match(new RegExp(`<g id="rank-slot-${t}"><rect x="[-\\d.]+" y="[-\\d.]+" width="([-\\d.]+)" height="([-\\d.]+)"`));E['rank_slot_'+t]={x:ux(+rm[1]),y:uy(+rm[2]),w:+(rw[1]*U).toFixed(2),h:+(rw[2]*U).toFixed(2)};}
    conv({id:CFG.id+'-epaulet-sleeve-'+tag,name:`${CFG.name.split(',')[0]} ${who} epaulet sleeves (overlay, registered to ${CFG.id}; blank grade)`,vb,body:eb,source:'original',
     meta:{size_source:'estimated',size_basis:'Edge-on strip (0.4 in) along the outer 82% of the garment epaulet strap landmark, the way the sleeve looks from the front; the full sleeve is the separate top-down asset garment-blues-class-b-epaulet-top-*. Colours sampled from the reference photos (gray #6e6a69, cadet navy #072157); the regulation gives no dimension.',
      anchors:{...A,rank_slot_right_center:lmCen(E.rank_slot_right),rank_slot_left_center:lmCen(E.rank_slot_left),rank_rule_point_right:[ux(RULE.right[0]),uy(RULE.right[1])],rank_rule_point_left:[ux(RULE.left[0]),uy(RULE.left[1])]},landmarks:E,landmarks_note:'rects are {x,y,w,h} in user units (0.01 in)',overlay_of:CFG.id,
      documented:[regs,'grade insignia centred 5/8 in from the outer end of the epaulet (DAFI 36-2903 4.5.1.1.1)'],assumed:['sleeve length (covers the outer 82% of the strap)','grade insignia not drawn: placed by the rank insignia assets at rank_slot'],fit:{method:'original',score:null},grade:'accessory'}});
    // top-down epaulet sleeves (right/left), own assets with grade slot anchors; same for short and long garments of this sex
    if(!CFG.long)for(const t of ['right','left']){
      const T=TOP[t],Lw=+T.len.toFixed(3),Wd=+T.w.toFixed(3),PAD=0.1,mir=t==='left',X=x=>mir?Lw-x:x,tid=`garment-blues-class-b-epaulet-top-${male?'male':'female'}-${tag}-${t}`;
      const al=Math.min(2.3,Lw-0.2),slot={x:X(0.1)<X(0.1+al)?X(0.1):X(0.1+al),y:0.1,w:al,h:Wd-0.2},rule=[X(0.625),Wd/2],lt=[X(Lw*0.68),Wd/2];
      const body=`<g id="epaulet-sleeve-top"><title>${who} epaulet sleeve, ${t} shoulder, top-down view (blank grade)</title><rect id="sleeve-body" x="0" y="0" width="${f(Lw)}" height="${f(Wd)}" rx=".08" fill="${col}" stroke="${edge}" stroke-width=".04"/>`
        +`<g transform="translate(${f(lt[0])} ${f(lt[1])}) rotate(${mir?90:-90}) translate(${f(-lt[0])} ${f(-lt[1])})">${lettering('CAP',lt[0],lt[1],0.34,'#e9ecf2',0.08,0.8)}</g></g>`;
      const box={x:PAD*U,y:PAD*U,w:Lw*U,h:Wd*U},sl2={x:+((slot.x+PAD)*U).toFixed(2),y:+((slot.y+PAD)*U).toFixed(2),w:+(slot.w*U).toFixed(2),h:+(slot.h*U).toFixed(2)};
      const Wb=(Lw+2*PAD),Hb=(Wd+2*PAD);
      conv({id:tid,name:`${CFG.name.split(',')[0]} ${who} epaulet sleeve, ${t} shoulder, top-down (blank grade)`,vb:{x:-PAD,y:-PAD,w:Wb,h:Hb},body,source:'original',
       meta:{size_source:'estimated',size_basis:'Length and width of the garment epaulet strap landmark (sleeve covers its outer 82%); colour and the CAP lettering placement read from the reference photos (images/base/blues_class_b_male_c_2d_lt, lt_col_blues_class_b_male). The regulation gives no dimension.',
        anchors:{...std(Wb*U,Hb*U),rank_slot_center:[+(sl2.x+sl2.w/2).toFixed(2),+(sl2.y+sl2.h/2).toFixed(2)],rank_rule_point:[+((rule[0]+PAD)*U).toFixed(2),+((rule[1]+PAD)*U).toFixed(2)],outer_end_center:[+(((mir?Lw:0)+PAD)*U).toFixed(2),+((Wd/2+PAD)*U).toFixed(2)]},
        landmarks:{sleeve:box,rank_slot:sl2},landmarks_note:'rects are {x,y,w,h} in user units (0.01 in); rank_slot holds the largest regular-size grade form (Major General star pair 2.2 x 1.2 in); rank_rule_point is the 5/8 in from the outer end point for single forms',
        dimensions:{sleeve_in:[Lw,Wd],rank_slot_in:[+slot.w.toFixed(2),+slot.h.toFixed(2)]},documented:[regs,'grade insignia centred 5/8 in from the outer end of the epaulet (DAFI 36-2903 4.5.1.1.1)'],assumed:['sleeve size','CAP lettering size and position','grade not drawn'],fit:{method:'original',score:null},grade:'accessory'}});}
    }}
  // general officer belt buckle (CAPR 39-1 4.1.11.1.1.5 men's / 4.1.12.7 women's): Wing and Star on the buckle. The belt is hidden under the Class A coat, so this layer registers to the Class B garment box.
  {const bl=LM.belt_buckle,fr=(CFG.buckle.split-CFG.buckle.x0)/(CFG.buckle.x1-CFG.buckle.x0),
     bw=CFG.tipSide>0?bl.w*fr:bl.w*(1-fr),bx=CFG.tipSide>0?bl.x:bl.x+bl.w*fr,
     X0=bx/U+vb.x,Y0=bl.y/U+vb.y,W0=bw/U,H0=bl.h/U,cx=X0+W0/2,cy=Y0+H0/2,sc=Math.min(W0,H0)*0.50;
   const star=(R)=>Array.from({length:10},(_,i)=>{const a=(-90+i*36)*Math.PI/180,r=i%2?R*0.382:R;return f(r*Math.cos(a))+','+f(r*Math.sin(a));}).join(' ');
   const root=[-0.27,0.11],tips=[[-0.60,-0.64],[-0.69,-0.46],[-0.75,-0.26],[-0.74,-0.06],[-0.64,0.10]],E2='#555b66',R2='#eef0f4';
   const feather=(t,wd)=>{const mx=(root[0]+t[0])/2,my=(root[1]+t[1])/2,dx=t[0]-root[0],dy=t[1]-root[1],L=Math.hypot(dx,dy),nx=-dy/L,ny=dx/L;
     return `M${root[0]},${root[1]} Q${f(mx+nx*wd)},${f(my+ny*wd)} ${t[0]},${t[1]} Q${f(mx-nx*wd*0.6)},${f(my-ny*wd*0.6)} ${root[0]},${root[1]} Z`;};
   const wing=tips.map(t=>`<path d="${feather(t,0.17)}" fill="${R2}" stroke="${E2}" stroke-width=".02"/>`).join('')+`<path d="M-0.30,0.14 L-0.12,0.12 L-0.16,-0.04 L-0.34,-0.02 Z" fill="${R2}" stroke="${E2}" stroke-width=".02"/>`;
   const gb=`<g id="buckle-wing-and-star"><title>Wing and Star emblem on the belt buckle (general officers)</title><rect id="buckle-plate" x="${f(X0)}" y="${f(Y0)}" width="${f(W0)}" height="${f(H0)}" rx=".2" fill="url(#goBuckle)" stroke="#8d93a1" stroke-width=".035"/>`
     +`<g transform="translate(${f(cx)} ${f(cy-0.10*sc)}) scale(${f(sc)})"><g>${wing}</g><g transform="scale(-1 1)">${wing}</g><polygon points="${star(0.526)}" transform="translate(0 0.31)" fill="${R2}" stroke="${E2}" stroke-width=".022" stroke-linejoin="round"/></g></g>`;
   const gbody=`<defs><radialGradient id="goBuckle" cx=".42" cy=".4" r=".75"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#dcdee3"/><stop offset="1" stop-color="#b3b7c0"/></radialGradient></defs>`+gb;
   const rr={x:+bw.toFixed?bl.x:bl.x};const LMg={buckle_plate:{x:+bx.toFixed(2),y:bl.y,w:+bw.toFixed(2),h:bl.h}};
   conv({id:CFG.id+'-general-officer-buckle',name:`${CFG.name.split(',')[0]} general officer belt buckle: Wing and Star (overlay, registered to ${CFG.id})`,vb,body:gbody,source:'original',
    meta:{size_source:'estimated',size_basis:`Drawn on the buckle body of ${CFG.id} (same box and origin); emblem about 0.75 x the smaller buckle dimension. The regulation gives no emblem dimension.`,
     anchors:{...A,buckle_center:lmCen(LMg.buckle_plate)},landmarks:LMg,landmarks_note:'rects are {x,y,w,h} in user units (0.01 in)',overlay_of:CFG.id,
     documented:[`general officers wear the Wing and Star on the belt buckle (CAPR 39-1 ${male?'4.1.11.1.1.5':'4.1.12.7'}); tip toward the wearer's ${male?'left':'right'}`],assumed:['emblem size','emblem is the wing-and-star of the coat button redrawn flat'],fit:{method:'original',score:null},grade:'accessory'}});}
  // shoulder cord overlays (one per colour), drawn under the epaulet sleeve layer
  {const CA=require('./cord-art.js')(CFG.arm.map(p=>[Math.abs(B.DX(p[0])),B.Y(p[1])]),1);
   for(const c of CA.CORDS){const cb=CA.bodies[c],LMk={cord:lmPoly(cb,'cord-path',vb)};
    conv({id:CFG.id+'-cord-'+c,name:`${CFG.name.split(',')[0]}: ${CA.meta[c].name} (overlay, registered to ${CFG.id})`,vb,body:cb,source:'original',
     meta:{size_source:'estimated',size_basis:'Same box as '+CFG.id+'; 0.36 in braid following the wearer\'s left armhole seam; colours from assets/cords/cord-'+c+'.spec.json. The regulation gives no cord dimension.',anchors:{...A,cord_start:[ux(CA.pts[0][0]),uy(CA.pts[0][1])],cord_end:[ux(CA.pts[CA.pts.length-1][0]),uy(CA.pts[CA.pts.length-1][1])]},landmarks:LMk,landmarks_note:'polygons are [[x,y]...] in user units (0.01 in)',overlay_of:CFG.id,documented:['shoulder cords are worn on the left shoulder aligned along the shoulder seam, underneath the epaulet (CAPR 39-1 9.3)'],assumed:['cord thickness 0.36 in','path along the armhole seam'],fit:{method:'original',score:null},grade:'accessory'}});}}
  sq(body,vb,CFG.id.replace('garment-',''),+(process.env.PX||1000));
  if(process.env.ZOOM){const [zx,zy,zw,zh]=process.env.ZOOM.split(',').map(Number);sq(body,{x:zx,y:zy,w:zw,h:zh},'bzoom_'+(CFG.bottomId),900);}
  console.log('ok',CFG.id,svg.length);
}
function DX0(CFG){return CFG.plate.cx*0.0474;}
