// Women's Corporate Service Dress (CAPR 39-1 4.2.4, Fig 4.15): navy blazer, white shirt with inverted-V tie tab, gray skirt/slacks. Silhouette traced from the
// regulation figure (page render at 3x, flood-filled alpha, board/sil.js -> wblazer_sil.json); interior parametric from coordinates read off the figure.
const fs=require('fs'),path=require('path');
const f=n=>(+n).toFixed(3),STROKE='#00102f';
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

// Women's Corporate Service Dress blazer, traced from Vanguard's product photo of the CAP women's blue blazer (CAP4200E): navy single-breasted,
// notched lapels, two gold buttons, flap pockets, breast welt pocket on the wearer's left. The photo hangs a little lopsided, so the wearer-right
// half (image left) is smoothed and mirrored about x=298. Interior lines are read off a contrast-stretched copy of the photo.
const RAW=JSON.parse(fs.readFileSync(path.join(here,'bz_sil.json'),'utf8')).outline,CXP=298;
const SIL0=(()=>{const n=RAW.length,inL=i=>RAW[(i+n)%n][0]<CXP;let best=[0,0];
  for(let i=0;i<n;i++){if(inL(i)&&!inL(i-1)){let j=i;while(inL(j+1))j++;if(j-i>best[1]-best[0])best=[i,j];}}
  let L=[];for(let i=best[0];i<=best[1];i++)L.push(RAW[i%n].slice());
  if(L[0][1]<L[L.length-1][1]===false)L.reverse();                       // V bottom -> ... -> hem centre
  const rs=[L[0]];let acc=0;for(let i=1;i<L.length;i++){const a=L[i-1],b=L[i],d=Math.hypot(b[0]-a[0],b[1]-a[1]);let t=0;
    while(acc+d-t>=1.5){t+=1.5-acc;acc=0;rs.push([a[0]+(b[0]-a[0])*t/d,a[1]+(b[1]-a[1])*t/d]);}acc+=d-t;}
  rs.push(L[L.length-1]);
  const m=rs.length,W=7,ang=i=>{const a=rs[Math.max(0,i-W)],b=rs[i],c=rs[Math.min(m-1,i+W)];
    const u=[b[0]-a[0],b[1]-a[1]],v=[c[0]-b[0],c[1]-b[1]];return Math.abs(Math.atan2(u[0]*v[1]-u[1]*v[0],u[0]*v[0]+u[1]*v[1]));};
  const A=rs.map((_,i)=>ang(i)),anchor=rs.map((_,i)=>i===0||i===m-1||(A[i]>0.8&&A[i]>=Math.max(...A.slice(Math.max(0,i-W),i+W+1))));
  let P=rs.map(p=>p.slice());
  for(let it=0;it<40;it++){const Q=P.map(p=>p.slice());for(let i=1;i<m-1;i++)if(!anchor[i]){Q[i][0]=(P[i-1][0]+2*P[i][0]+P[i+1][0])/4;Q[i][1]=(P[i-1][1]+2*P[i][1]+P[i+1][1])/4;}P=Q;}
  P[0][0]=CXP;P[m-1][0]=CXP;
  const R=P.map(p=>[2*CXP-p[0],p[1]]).reverse();
  return [...P,...R.slice(1,R.length-1)];})();
const ys0=SIL0.map(p=>p[1]),y0p=Math.min(...ys0),HEMP=Math.max(...ys0);
const S=27.5/(HEMP-y0p);                 // blazer length (collar to hem) 27.5 in: estimate
const X=px=>(px-CXP)*S,Y=py=>(py-y0p)*S,mxp=px=>2*CXP-px;
const BLAZER='#1e2540',SHIRT='#f4f5f8',TIE='#0d2a66',GRAYS='#807d7b';
const poly=a=>'M'+a.map(p=>f(p[0])+','+f(p[1])).join('L')+'Z';
const pl=a=>'M'+a.map(p=>f(X(p[0]))+','+f(Y(p[1]))).join('L');
const ln=(d,w=.06,op=.95,col='#05070f')=>`<path d="${d}" fill="none" stroke="${col}" stroke-opacity="${op}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const smooth=(P,it=2)=>{let Q=P;for(let k=0;k<it;k++){const N=[Q[0]];for(let i=0;i<Q.length-1;i++){const a=Q[i],b=Q[i+1];N.push([.75*a[0]+.25*b[0],.75*a[1]+.25*b[1]],[.25*a[0]+.75*b[0],.25*a[1]+.75*b[1]]);}N.push(Q[Q.length-1]);Q=N;}return Q;};
const mir=a=>a.map(p=>[mxp(p[0]),p[1]]);
const SKL=smooth([[212,556],[205,640],[188,742]],2),SKP=[...SKL,...mir(SKL).reverse()];
const o=SIL0.map(p=>[X(p[0]),Y(p[1])]),HEM=Y(742),maxX=Math.max(...o.map(p=>Math.abs(p[0])));
const crestArt=require('./crest-art.js')(GLY);
const crestG=(hIn)=>`<g transform="scale(${(hIn/705).toFixed(6)}) translate(0 -20)">${crestArt.svg}</g>`;

const button=(x,y,id)=>{const r=0.36;
  return `<g id="${id}"><title>Blazer button, gold tone dome (CAPR 39-1 4.2.4.1)</title><circle cx="${f(x)}" cy="${f(y)}" r="${r}" fill="url(#gold)" stroke="#6e4f0f" stroke-width=".035"/>`
  +`<circle cx="${f(x)}" cy="${f(y)}" r="${r*0.74}" fill="none" stroke="#7a5a12" stroke-opacity=".75" stroke-width=".03"/><circle cx="${f(x)}" cy="${f(y)}" r="${r*0.62}" fill="none" stroke="#fff3b8" stroke-opacity=".5" stroke-width=".022"/>`
  +`<path d="M${f(x)},${f(y-r*0.38)} L${f(x-r*0.34)},${f(y+r*0.22)} L${f(x+r*0.34)},${f(y+r*0.22)} Z" fill="none" stroke="#7a5a12" stroke-opacity=".8" stroke-width=".03" stroke-linejoin="round"/>`
  +`<ellipse cx="${f(x-r*0.32)}" cy="${f(y-r*0.4)}" rx="${r*0.28}" ry="${r*0.16}" fill="#fff" fill-opacity=".55" transform="rotate(-30 ${f(x-r*0.32)} ${f(y-r*0.4)})"/></g>`;};

const CC=[388,226],CRH=2.8;   // crest 2.8 in: measured in Fig 4.14/4.15 against the 3 3/8 in nametag; sits directly below the nametag
function garment(){
  const SIL=poly(o);
  let g=`<defs><clipPath id="clipSil"><path d="${SIL}"/></clipPath><radialGradient id="gold" cx=".38" cy=".32" r=".75"><stop offset="0" stop-color="#fff0a8"/><stop offset=".35" stop-color="#e9c24f"/><stop offset=".8" stop-color="#b98a22"/><stop offset="1" stop-color="#8a6414"/></radialGradient></defs>`;
  g+=`<path id="skirt" d="${pl(SKP)}Z" fill="${GRAYS}"/>`;
  // white shirt filling the V between the lapels (the coat silhouette's concave neckline), with the inverted-V tie tab
  const vTop=SIL0.findIndex(p=>p[1]<44&&p[0]>230),Vl=SIL0.slice(0,Math.max(vTop,1)+1);
  const shirtPts=[...Vl,[Vl[Vl.length-1][0],y0p+0.5],[mxp(Vl[Vl.length-1][0]),y0p+0.5],...mir(Vl).reverse()];
  g+=`<path id="shirt" d="${pl(shirtPts)}Z" fill="${SHIRT}"/>`;
  g+=`<path id="tie-tab" d="${pl([[288,56],[308,56],[327,92],[317,92],[298,76],[279,92],[269,92]])}Z" fill="${TIE}"/>`;
  g+=`<g id="coat-body"><path id="silhouette" d="${SIL}" fill="${BLAZER}"/><g clip-path="url(#clipSil)">`;
  // lapels: gorge seam to the notch, lapel edge from the notch down to the roll point
  const lap=smooth([[258,40],[231,78],[207,112],[198,148],[231,215],[266,276],[301,326]],1);
  {const LF=[...Vl,...lap],LFm=mir(Vl).concat(mir(lap));
   g+=`<g id="lapel-foreground"><title>Notched lapels and collar (draw above the shirt, tab and underlayers)</title><path id="lapel-right" d="${pl(LF)}Z" fill="${BLAZER}"/><path id="lapel-left" d="${pl(LFm)}Z" fill="${BLAZER}"/></g>`;}
  g+=ln(pl(lap),.06)+ln(pl(mir(lap)),.06);
  // front edge of the right-panel overlap, down to the rounded hem
  g+=ln(`M${f(X(305))},${f(Y(326))} C${f(X(309))},${f(Y(420))} ${f(X(310))},${f(Y(520))} ${f(X(309))},${f(Y(560))} Q${f(X(308))},${f(Y(580))} ${f(X(292))},${f(Y(586))}`,.06);
  // armhole seams and front princess seams
  const arm=smooth([[145,112],[162,150],[178,200],[190,260],[194,330],[192,400]]);
  g+=ln(pl(arm),.05)+ln(pl(mir(arm)),.05);
  const prin=smooth([[205,280],[213,345],[221,410]]);
  g+=ln(pl(prin),.04)+ln(pl(mir(prin)),.04);
  // flap pockets (hip): flaps only, no patch pockets (4.2.4.1)
  for(const m of [p=>p,p=>[mxp(p[0]),p[1]]]){
    g+=`<path d="${pl([[183,406],[244,403],[246,445],[185,452]].map(m))}Z" fill="none" stroke="#05070f" stroke-opacity=".95" stroke-width=".05" stroke-linejoin="round"/>`;}
  // breast welt pocket on the wearer's left (image right)
  g+=ln(pl([[368,231],[406,222]]),.05)+ln(pl([[368,231],[369,238]]),.04)+ln(pl([[406,222],[407,229]]),.04);
  {const sl=SIL0.filter(p=>p[0]<150&&p[1]>440),lo=sl.reduce((a,p)=>p[1]>a[1]?p:a,sl[0]);
   if(lo)for(const m of [p=>p,p=>[mxp(p[0]),p[1]]]){const a=m([lo[0]+11,lo[1]-3]);
     for(let k=0;k<3;k++){const q=m([lo[0]+14,lo[1]-12-k*11]);g+=`<circle cx="${f(X(q[0]))}" cy="${f(Y(q[1]))}" r=".11" fill="url(#gold)" stroke="#6e4f0f" stroke-width=".02"/>`;}
     g+=ln(pl([m([lo[0]+2,lo[1]-46]),m([lo[0]+34,lo[1]-50])]),.04,.7);}}
  [376,445].forEach((by,i)=>g+=button(X(297),Y(by),`button-${i+1}`));
  g+=`<g id="cap-crest"><title>CAP Crest, left breast (CAPR 39-1 4.2.4.1.1.1), simplified redraw</title><g transform="translate(${f(X(CC[0]))} ${f(Y(231)+0.9+0.08)})">${crestG(CRH)}</g></g>`;
  g+=`</g></g>`;
  const NT={w:3.375,h:0.9};NT.x=X(CC[0])-NT.w/2;NT.y=Y(231);   // inside (lower) end of the slanted welt pocket
  g+=`<rect id="nameplate-slot" x="${f(NT.x)}" y="${f(NT.y)}" width="${NT.w}" height="${NT.h}" fill="none" stroke="none"/>`;
  for(const [tag,px] of [['right',232],['left',mxp(232)]])g+=`<rect id="lapel-pin-slot-${tag}" x="${f(X(px)-0.25)}" y="${f(Y(185)-0.25)}" width="0.5" height="0.5" fill="none" stroke="none"/>`;
  const MD={w:3.4,h:1.0};MD.x=X(CC[0])-MD.w/2;MD.y=Y(231)+0.9+0.08-0.5-MD.h;
  g+=`<rect id="medal-slot" x="${f(MD.x)}" y="${f(MD.y)}" width="${MD.w}" height="${MD.h}" fill="none" stroke="none"/>`;
  return {g,CRH,CC};}

const vb={x:-(maxX+0.2),y:-0.1,w:2*(maxX+0.2),h:HEM+0.2};
const HEMY=HEMP;
const G=garment(),body=G.g,id='garment-corporate-service-dress-blazer-female';
const ux=x=>+((x-vb.x)*U).toFixed(2),uy=y=>+((y-vb.y)*U).toFixed(2);
const LM={};for(const [k,i] of [['nameplate_slot','nameplate-slot'],['lapel_pin_slot_right','lapel-pin-slot-right'],['lapel_pin_slot_left','lapel-pin-slot-left'],['medal_slot','medal-slot']]){const r=lmRect(body,i,vb);if(r)LM[k]=r;}
const A=std(vb.w*U,vb.h*U);
const anchors={...A,hem_center:[A.top_center[0],uy(Y(HEMY))],nameplate_slot_center:lmCen(LM.nameplate_slot),nameplate_slot_top_left:[LM.nameplate_slot.x,LM.nameplate_slot.y],
  crest_center:[ux(X(G.CC[0])),uy(Y(231)+0.9+0.08+G.CRH/2)],crest_top_center:[ux(X(G.CC[0])),uy(Y(231)+0.9+0.08)],button_1_center:[ux(X(297)),uy(Y(376))],button_2_center:[ux(X(297)),uy(Y(445))],
  chaplain_badge_above_nametag:[LM.nameplate_slot.x+LM.nameplate_slot.w/2,LM.nameplate_slot.y-50],tie_tab_center:[ux(X(298)),uy(Y(56))],
  lapel_pin_right_center:lmCen(LM.lapel_pin_slot_right),lapel_pin_left_center:lmCen(LM.lapel_pin_slot_left),medal_slot_center:lmCen(LM.medal_slot),chaplain_badge_semiformal:[LM.medal_slot.x+LM.medal_slot.w/2,LM.medal_slot.y-50]};
conv({id,name:"Women's Corporate Service Dress: navy blazer, white shirt with tie tab, gray skirt (blank nametag)",vb,body,source:'reference-art-measured',
  meta:{size_source:'estimated',size_basis:"Silhouette traced from the regulation's Figure 4.15 (CAPR 39-1 p.61) and scaled to 23.0 in sleeve-to-sleeve (estimate: about 9% narrower than the men's blazer; the figures are drawn at the same width). No real garment was measured.",
    anchors:Object.fromEntries(Object.entries(anchors).map(([k,v])=>[k,r2(v)])),landmarks:LM,landmarks_note:'rects are {x,y,w,h}; user units (0.01 in), origin top-left',
    dimensions:{length_in:+HEM.toFixed(2),max_width_in:+(2*maxX).toFixed(2),nametag_slot_in:[3.375,0.9],buttons:2},
    documented:['navy single-breasted blazer, two or three buttons, notched lapels; pockets optional, no patch pockets (CAPR 39-1 4.2.4.1)','CAP Crest on the left breast pocket or in the same relative position (4.2.4.1.1.1)','nametag top edge aligned with the top of the left breast pocket, or 1/2 inch above the CAP Crest if the blazer has no pocket (4.2.4.1.1.2)','white aviator shirt or blouse with collar and blue inverted-V tie tab (4.2.4.2-4.2.4.3)','medium gray slacks or straight/A-line skirt (4.2.4.4-4.2.4.5)'],
    assumed:['px-to-inch scale (23.0 in across)','nametag slot size','button diameter','line positions read off the figure','skirt drawn as in the figure; slacks are a bottoms variant'],
    fit:{method:'traced from the regulation figure',score:null},grade:'garment'}});
// ---- underlayers worn instead of the shirt (CAPR 39-1 4.2.3.2.2 / 4.2.4.2.2): same box and origin as this blazer, clipped to its V; draw them under `lapel-foreground`
function underlayer({kind,id,name,vbox,Vpoly,cx,top,NW,NH,scoop,basis,extra}){
  const WHT='#f4f5f8',KNIT='#cfd3dc',EDGE='#6b6e78',pl=a=>'M'+a.map(p=>f(p[0])+','+f(p[1])).join('L')+'Z';
  let b=`<defs><clipPath id="vclip"><path d="${pl(Vpoly)}"/></clipPath></defs><g id="${kind}" clip-path="url(#vclip)">`;
  if(kind==='turtleneck'){
    const nl=cx-NW/2,nr=cx+NW/2;
    b+=`<rect x="${f(cx-9)}" y="${f(top-1)}" width="18" height="40" fill="${WHT}"/>`
      +`<path d="M${f(nl)},${f(top+0.25)} Q${f(cx)},${f(top-0.15)} ${f(nr)},${f(top+0.25)}" fill="none" stroke="${EDGE}" stroke-width=".04"/>`
      +`<path d="M${f(nl)},${f(top+0.25)} Q${f(cx)},${f(top+0.62)} ${f(nr)},${f(top+0.25)}" fill="none" stroke="${EDGE}" stroke-width=".03"/>`
      +`<path d="M${f(nl)},${f(top+0.25)} L${f(nl-0.08)},${f(top+NH)} M${f(nr)},${f(top+0.25)} L${f(nr+0.08)},${f(top+NH)}" stroke="${EDGE}" stroke-width=".04" stroke-linecap="round"/>`
      +`<path d="M${f(nl-0.08)},${f(top+NH)} Q${f(cx)},${f(top+NH+0.55)} ${f(nr+0.08)},${f(top+NH)}" fill="none" stroke="${KNIT}" stroke-width=".06"/>`
      +[-1.5,-1.0,-0.5,0,0.5,1.0,1.5].map(d=>`<path d="M${f(cx+d)},${f(top+0.6)} L${f(cx+d*1.03)},${f(top+NH-0.1)}" stroke="${KNIT}" stroke-width=".04"/>`).join('');
  }else{ // shell: sleeveless knit top; only the area below the scoop neckline is fabric (skin above is not drawn)
    const sx=cx-scoop.w/2,ex=cx+scoop.w/2;
    b+=`<path d="M${f(cx-9)},${f(top+scoop.d)} L${f(sx)},${f(top+scoop.d)} Q${f(cx)},${f(top+scoop.d+scoop.h*2)} ${f(ex)},${f(top+scoop.d)} L${f(cx+9)},${f(top+scoop.d)} L${f(cx+9)},${f(top+40)} L${f(cx-9)},${f(top+40)} Z" fill="${WHT}"/>`
      +`<path d="M${f(sx)},${f(top+scoop.d)} Q${f(cx)},${f(top+scoop.d+scoop.h*2)} ${f(ex)},${f(top+scoop.d)}" fill="none" stroke="${EDGE}" stroke-width=".04" stroke-linecap="round"/>`;
  }
  b+=`</g>`;
  const anchors={neck_top_center:[ux(cx),uy(top)],neck_base_center:[ux(cx),uy(top+(NH||0))],...extra};
  conv({id,name,vb:vbox,body:b,source:'original',meta:{size_source:'estimated',size_basis:basis,anchors:{...std(vbox.w*U,vbox.h*U),...anchors},landmarks:{},landmarks_note:'registered to the blazer box (same origin and size); clipped to the blazer V',overlay_of:id,
    documented:['regular white cotton-polyester or wool-blend turtleneck sweater or white shell top may be worn instead of the shirt; the blue blazer must be worn; no tie or tie tab with a turtleneck/shell (CAPR 39-1 4.2.3.2.2, 4.2.4.2.2, 4.2.4.3)'],
    assumed:['neck width / height','scoop size','rib spacing','no figure or base image exists for these garments'],fit:{method:'original',score:null},grade:'garment'}});
}


{const Vl2=SIL0.slice(0,Math.max(SIL0.findIndex(p=>p[1]<44&&p[0]>230),1)+1),VP=[...Vl2,[Vl2[Vl2.length-1][0],y0p+0.5],[mxp(Vl2[Vl2.length-1][0]),y0p+0.5],...mir(Vl2).reverse()].map(p=>[X(p[0]),Y(p[1])]);
 underlayer({kind:'turtleneck',id:'garment-underlayer-turtleneck-female',name:"White turtleneck sweater, women's corporate blazer V insert (registered to the blazer)",vbox:vb,Vpoly:VP,cx:0,top:Y(y0p)+0.05,NW:3.6,NH:3.2,
   basis:'Original flat art fitted to the blazer V (same box/origin as the blazer). The regulation names the garment but gives no figure or dimension: 3.6 in neck width and 3.2 in neck height are estimates.',extra:{}});
 underlayer({kind:'shell',id:'garment-underlayer-shell-female',name:"White shell top, women's corporate blazer V insert (registered to the blazer)",vbox:vb,Vpoly:VP,cx:0,top:Y(y0p)+0.05,scoop:{w:3.4,d:3.0,h:0.8},
   basis:'Original flat art fitted to the blazer V (same box/origin as the blazer). The regulation names a white shell top but gives no figure or dimension: scoop 3.4 in wide, 3.0 in below the neck line, are estimates.',extra:{neckline_center:[ux(0),uy(Y(y0p)+0.05+3.0+0.8)]}});}
const sq=(innerBody,v,name,px)=>{const cx2=v.x+v.w/2,cy2=v.y+v.h/2,s=Math.max(v.w,v.h);
  const x=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${cx2-s/2} ${cy2-s/2} ${s} ${s}" width="${px}" height="${px}">${DEFS2}${innerBody}</svg>`;
  const tmp=path.join(here,name+'.sq.svg');fs.writeFileSync(tmp,x);
  require('child_process').execSync(`qlmanage -t -s ${px} -o "${here}" "${tmp}" >/dev/null 2>&1 && mv "${tmp}.png" "${path.join(here,name+'_preview.png')}" && rm "${tmp}"`);};
sq(body,vb,'corporate-service-dress-blazer-female',+(process.env.PX||1000));
console.log('ok',id,'S',S.toFixed(5),'w',(2*maxX).toFixed(2),'h',HEM.toFixed(2));
