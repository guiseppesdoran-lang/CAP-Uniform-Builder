// Men's Corporate Service Dress (CAPR 39-1 4.2.3, Fig 4.14): navy blazer, white shirt + tie, gray trousers. Built from the traced
// base image images/base/male_semi_formal.webp (blazer with bow tie; alpha silhouette traced at 0.0474 in/px, same canvas/scale assumption
// as the other garments). Interior parts are parametric in inches; geometry read off the base image (px -> in: x=(px-cx)*S, y=(py-y0)*S).
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

const OUT=JSON.parse(fs.readFileSync(path.join(here,'blazer_male_outline.json'),'utf8')),S=OUT.scale,cx=OUT.cx,y0=OUT.y0;
const X=px=>(px-cx)*S,Y=py=>(py-y0)*S,mx=px=>2*cx-px;          // mx: mirror a pixel x about the centreline
const BTX=X(286)+0.8;   // button line: 0.8 in in from the lapping panel's front edge (x = 286 px)
const BLAZER='#1e2540',LINE='#4c5878',SHIRT='#f4f5f8',TIE='#0d2a66',GOLD='#d9b13b',GRAY='#8a8d95';
const poly=a=>'M'+a.map(p=>f(p[0])+','+f(p[1])).join('L')+'Z';
const pl=a=>'M'+a.map(p=>f(X(p[0]))+','+f(Y(p[1]))).join('L');
const ln=(d,w=.045,op=.8,col=LINE)=>`<path d="${d}" fill="none" stroke="${col}" stroke-opacity="${op}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const HEM=OUT.heightIn,TR_H=4.6,TOTAL=HEM+TR_H,o=OUT.outline,maxX=Math.max(...o.map(p=>Math.abs(p[0])));
// CAP crest (simplified, parametric): eagle over shield with triangle + 3-blade prop, scroll below; unit box w .62 x h 1, top-centre origin
const crest=()=>`<g>
<path d="M-0.05,0.10 Q-0.16,0.0 -0.31,0.03 Q-0.27,0.10 -0.24,0.12 Q-0.22,0.17 -0.17,0.18 Q-0.12,0.21 -0.05,0.19 Z" fill="#e0b43a" stroke="#8a6a14" stroke-width=".012"/>
<path d="M0.05,0.10 Q0.16,0.0 0.31,0.03 Q0.27,0.10 0.24,0.12 Q0.22,0.17 0.17,0.18 Q0.12,0.21 0.05,0.19 Z" fill="#e0b43a" stroke="#8a6a14" stroke-width=".012"/>
<ellipse cx="0" cy="0.17" rx=".085" ry=".1" fill="#caa02c" stroke="#8a6a14" stroke-width=".012"/><circle cx="0" cy="0.07" r=".06" fill="#f4f1e6" stroke="#8a6a14" stroke-width=".01"/><path d="M0.03,0.08 L0.085,0.095 L0.03,0.11Z" fill="#e0b43a"/>
<path d="M-0.205,0.27 L0.205,0.27 L0.205,0.5 Q0.205,0.66 0,0.745 Q-0.205,0.66 -0.205,0.5 Z" fill="#232f78" stroke="#d9b13b" stroke-width=".018"/>
<path d="M0,0.31 L-0.125,0.56 L0.125,0.56 Z" fill="#f4f5f8"/><g stroke="#c8202f" stroke-width=".05" stroke-linecap="round"><path d="M0,0.47 L0,0.37"/><path d="M0,0.47 L-0.075,0.52"/><path d="M0,0.47 L0.075,0.52"/></g>
<path d="M-0.30,0.57 Q-0.28,0.83 0,0.97 Q0.28,0.83 0.30,0.57 L0.235,0.60 Q0.22,0.77 0,0.87 Q-0.22,0.77 -0.235,0.60 Z" fill="#e8c85a" stroke="#8a6a14" stroke-width=".012"/></g>`;
const crestArt=require('./crest-art.js')(GLY);
const crestG=(hIn)=>`<g transform="scale(${(hIn/705).toFixed(6)}) translate(0 -20)">${crestArt.svg}</g>`;
const button=(x,y,id)=>{const r=0.4;   // 0.8 in gold-tone dome shank button
  return `<g id="${id}"><title>Blazer button, gold tone dome (CAPR 39-1 4.2.3.1)</title>`
  +`<circle cx="${f(x)}" cy="${f(y)}" r="${r}" fill="url(#gold)" stroke="#6e4f0f" stroke-width=".035"/>`
  +`<circle cx="${f(x)}" cy="${f(y)}" r="${r*0.74}" fill="none" stroke="#7a5a12" stroke-opacity=".75" stroke-width=".03"/>`
  +`<circle cx="${f(x)}" cy="${f(y)}" r="${r*0.62}" fill="none" stroke="#fff3b8" stroke-opacity=".5" stroke-width=".022"/>`
  +`<path d="M${f(x)},${f(y-r*0.38)} L${f(x-r*0.34)},${f(y+r*0.22)} L${f(x+r*0.34)},${f(y+r*0.22)} Z" fill="none" stroke="#7a5a12" stroke-opacity=".8" stroke-width=".03" stroke-linejoin="round"/>`
  +`<path d="M${f(x)},${f(y+r*0.05)} L${f(x)},${f(y-r*0.22)} M${f(x)},${f(y+r*0.05)} L${f(x-r*0.18)},${f(y+r*0.16)} M${f(x)},${f(y+r*0.05)} L${f(x+r*0.18)},${f(y+r*0.16)}" stroke="#7a5a12" stroke-opacity=".8" stroke-width=".035" stroke-linecap="round"/>`
  +`<ellipse cx="${f(x-r*0.32)}" cy="${f(y-r*0.4)}" rx="${r*0.28}" ry="${r*0.16}" fill="#fff" fill-opacity=".55" transform="rotate(-30 ${f(x-r*0.32)} ${f(y-r*0.4)})"/></g>`;};

function garment(){
  const SIL=poly(o);
  let g=`<defs><clipPath id="clipSil"><path d="${SIL}"/></clipPath><radialGradient id="gold" cx=".38" cy=".32" r=".75"><stop offset="0" stop-color="#fff0a8"/><stop offset=".35" stop-color="#e9c24f"/><stop offset=".8" stop-color="#b98a22"/><stop offset="1" stop-color="#8a6414"/></radialGradient></defs>`;
  // trousers (not in the base image; added below the blazer hem, medium gray)
  const tw=172*S,tb=158*S;
  g+=`<g id="trousers"><path d="M${f(-tw)},${f(HEM-0.2)} L${f(tw)},${f(HEM-0.2)} L${f(tb)},${f(TOTAL)} L${f(-tb)},${f(TOTAL)} Z" fill="${GRAY}" stroke="${STROKE}" stroke-opacity=".5" stroke-width=".05"/>`
    +ln(`M0,${f(HEM)} L0,${f(TOTAL)}`,.04,.5,'#4a4d55')+`</g>`;
  g+=`<g id="coat-body"><path id="silhouette" d="${SIL}" fill="${BLAZER}" stroke="${STROKE}" stroke-opacity=".7" stroke-width=".06" stroke-linejoin="round"/><g clip-path="url(#clipSil)">`;
  // shirt V + collar, tie
  const sh=[[242,25],[350,25],[296,322]].map(p=>p).concat([]);
  const nl=[X(242),Y(25)],nr=[-X(242),Y(25)];
  g+=`<path id="shirt" d="M${f(nl[0])},${f(Y(10))} Q0,${f(Y(1))} ${f(nr[0])},${f(Y(10))} L${f(nr[0])},${f(nr[1])} L${f(-X(296))},${f(Y(322))} L${f(X(296))},${f(Y(322))} L${f(nl[0])},${f(nl[1])} Z" fill="${SHIRT}" stroke="${LINE}" stroke-opacity=".5" stroke-width=".04"/>`;
  // necktie (blue four-in-hand): knot + blade as one shape, clipped to the shirt V so the lapels cover its edges; collar leaves lie over the knot
  const half=[[9,62],[14,71],[16,81],[12,94],[11,102],[15,140],[21,200],[27,262],[31,330]];
  const tk=half.map(p=>[X(295.5+p[0]),Y(p[1])]).concat(half.slice().reverse().map(p=>[X(295.5-p[0]),Y(p[1])]));
  g+=`<defs><clipPath id="clipV"><path d="M${f(nl[0])},${f(Y(10))} L${f(nr[0])},${f(Y(10))} L${f(nr[0])},${f(nr[1])} L${f(-X(296))},${f(Y(322))} L${f(X(296))},${f(Y(322))} L${f(nl[0])},${f(nl[1])} Z"/></clipPath></defs>`;
  g+=`<g clip-path="url(#clipV)"><path id="tie" d="${poly(tk)}" fill="${TIE}" stroke="#061a44" stroke-width=".03" stroke-linejoin="round"/>`
    +`<path d="M${f(X(295.5-12))},${f(Y(88))} Q${f(X(295.5))},${f(Y(96))} ${f(X(295.5+12))},${f(Y(88))}" fill="none" stroke="#061a44" stroke-width=".05"/></g>`;
  g+=`<g id="shirt-collar" clip-path="url(#clipV)">`;
  for(const s2 of [-1,1])g+=`<path d="M${f(s2*Math.abs(X(242)))},${f(Y(25))} L${f(s2*Math.abs(X(250)))},${f(Y(118))} L${f(s2*17*S)},${f(Y(94))} L${f(s2*9*S)},${f(Y(62))} Z" fill="${SHIRT}" stroke="${LINE}" stroke-opacity=".6" stroke-width=".04" stroke-linejoin="round"/>`;
  g+=`</g>`;

  // seam / edge line-art: thin-strip centrelines measured from the base image (board/lines.js -> board/centre.js; armholes, sleeve seams),
  // plus lapels / front edge / flap pockets from coordinates read off the image. Drawn as clean, smoothed strokes.
  const SM=JSON.parse(fs.readFileSync(path.join(__dirname,'blazer_seams.json'),'utf8')).paths.filter(p=>{const xs=p.map(q=>q[0]),ys=p.map(q=>q[1]),w=Math.max(...xs)-Math.min(...xs),h=Math.max(...ys)-Math.min(...ys);
    return h>50&&w<45&&(Math.max(...xs)<190||Math.min(...xs)>405)&&Math.max(...xs)<495;});   // armhole / sleeve seams only
  const lap=[[227.5,27.5],[199,125],[222.5,126.5]],lapEdge=[[199,125],[165,139],[290,365]],mir2=p=>[mx(p[0]),p[1]];
  const SML=SM.filter(p=>Math.max(...p.map(q=>q[0]))<190);   // armhole + sleeve seams measured on the image-left; the right side is its mirror (the base image is symmetric)
  const smooth=SML.concat(SML.map(p=>p.map(mir2))).concat([lapEdge,lapEdge.map(mir2),[[290,365],[288,395],[286,430],[286,719]]]);
  const sharp=[lap,lap.map(mir2)];
  const pk=(p)=>{const [a,b,c,d2]=p;const q=[(c[0]+d2[0])/2,(c[1]+d2[1])/2+4];return `M${f(X(a[0]))},${f(Y(a[1]))} L${f(X(b[0]))},${f(Y(b[1]))} L${f(X(c[0]))},${f(Y(c[1]))} Q${f(X(q[0]))},${f(Y(q[1]))} ${f(X(d2[0]))},${f(Y(d2[1]))} Z`;};
  const FLP=[[132.5,465],[219,472.5],[212.5,566.5],[117.5,549]];
  const chk=(P0)=>{let Q=P0;for(let it=0;it<2;it++){const N=[Q[0]];for(let i=0;i<Q.length-1;i++){const a=Q[i],b=Q[i+1];N.push([0.75*a[0]+0.25*b[0],0.75*a[1]+0.25*b[1]],[0.25*a[0]+0.75*b[0],0.25*a[1]+0.75*b[1]]);}N.push(Q[Q.length-1]);Q=N;}return Q;};
  const pl2=P0=>'M'+P0.map(q=>f(X(q[0]))+','+f(Y(q[1]))).join('L');
  const sd=smooth.map(p=>pl2(chk(p))).concat(sharp.map(p=>pl2(p))).join(' ')+' '+pk(FLP)+' '+pk(FLP.map(mir2));
  // lapel + collar in their own group, drawn above the shirt, tie and anything tucked under them (builder: draw this group last among the underlayers)
  {const E=chk(lapEdge),L=[[227.5,27.5],[242,25],[296,322],...E.slice().reverse()],P=a=>'M'+a.map(p=>f(X(p[0]))+','+f(Y(p[1]))).join('L')+'Z',M=a=>a.map(p=>[mx(p[0]),p[1]]);
   g+=`<g id="lapel-foreground"><title>Notched lapels and collar (draw above the shirt, tie and underlayers)</title><path id="lapel-right" d="${P(L)}" fill="${BLAZER}" stroke="none"/><path id="lapel-left" d="${P(M(L))}" fill="${BLAZER}" stroke="none"/></g>`;}
  g+=`<g id="seams"><path d="${sd}" fill="none" stroke="#05070f" stroke-opacity=".95" stroke-width=".06" stroke-linecap="round" stroke-linejoin="round"/></g>`;
  g+=button(BTX,Y(379),'button-1')+button(BTX,Y(491),'button-2');
  // sleeve cuffs: three small gold buttons up the outer seam of each sleeve end, cuff seam line, and a hem stitch line across the body
  {const sl=o.filter(p=>p[0]<-(maxX-1.6)&&p[1]>HEM-3.2),lo=sl.reduce((a,p)=>p[1]>a[1]?p:a,sl[0]);
   if(lo)for(const sg of [-1,1]){const ox=sg*(Math.abs(lo[0])-0.55);
     g+=`<path d="M${f(sg*Math.abs(lo[0]))},${f(lo[1]-2.2)} L${f(sg*(Math.abs(lo[0])-2.1))},${f(lo[1]-2.4)}" fill="none" stroke="#05070f" stroke-opacity=".6" stroke-width=".04"/>`;
     for(let k=0;k<3;k++)g+=`<circle cx="${f(ox)}" cy="${f(lo[1]-0.55-k*0.55)}" r=".13" fill="url(#gold)" stroke="#6e4f0f" stroke-width=".02"/>`;}}
  g+=`<path d="M${f(-maxX+3.7)},${f(HEM-0.95)} L${f(maxX-3.7)},${f(HEM-0.95)}" fill="none" stroke="#000a22" stroke-opacity=".5" stroke-width=".03" stroke-dasharray=".12 .08"/>`;
  // left breast welt pocket + crest (centred on the pocket) (4.2.3.1.1.1)
  const W={x:X(357.5),y:Y(266),w:107.5*S,h:21.5*S};
  g+=`<g id="breast-pocket"><rect x="${f(W.x)}" y="${f(W.y)}" width="${f(W.w)}" height="${f(W.h)}" fill="none" stroke="#05070f" stroke-opacity=".85" stroke-width=".05"/></g>`;
  const CR={cx:W.x+W.w/2,h:2.8};CR.top=W.y+0.9+0.08;   // Fig 4.14: nametag top at the pocket top, the crest centred directly below it (crest 2.8 in: measured against the 3 3/8 in plate)
  g+=`<g id="cap-crest"><title>CAP Crest (CAPR 39-1 4.2.3.1.1.1), simplified redraw</title><g transform="translate(${f(CR.cx)} ${f(CR.top)})">${crestG(CR.h)}</g></g>`;
  g+=`</g></g>`;
  // The nametag is NOT part of the base (name, state and grade differ by member): only its slot is kept, as a landmark.
  // Rule: top edge aligned with the top edge of the left breast pocket, centred on it (CAPR 39-1 4.2.3.1.1.2). Plate: assets/nameplates/.
  const NT={w:3.375,h:0.9};NT.x=W.x+W.w/2-NT.w/2;NT.y=W.y;
  g+=`<rect id="nameplate-slot" x="${f(NT.x)}" y="${f(NT.y)}" width="${NT.w}" height="${NT.h}" fill="none" stroke="none"/>`;
  // one lapel pin of choice on either lapel (4.2.3.1.1.4); miniature medals centred above the pocket, bottom edge 1/2 in above the crest (4.2.1.4)
  for(const [tag,px] of [['right',222],['left',mx(222)]])g+=`<rect id="lapel-pin-slot-${tag}" x="${f(X(px)-0.25)}" y="${f(Y(180)-0.25)}" width="0.5" height="0.5" fill="none" stroke="none"/>`;
  const MD={w:3.4,h:1.0};MD.x=W.x+W.w/2-MD.w/2;MD.y=CR.top-0.5-MD.h;
  g+=`<rect id="medal-slot" x="${f(MD.x)}" y="${f(MD.y)}" width="${MD.w}" height="${MD.h}" fill="none" stroke="none"/>`;
  return g;}

const vb={x:-(maxX+0.2),y:-0.1,w:2*(maxX+0.2),h:TOTAL+0.2};
const body=garment(),id='garment-corporate-service-dress-blazer-male';
const ux=x=>+((x-vb.x)*U).toFixed(2),uy=y=>+((y-vb.y)*U).toFixed(2);
const LM={};
{const R=(k,i)=>{const r=lmRect(body,i,vb);if(r)LM[k]=r;};
 R('nameplate_slot','nameplate-slot');R('breast_pocket','breast-pocket');R('lapel_pin_slot_right','lapel-pin-slot-right');R('lapel_pin_slot_left','lapel-pin-slot-left');R('medal_slot','medal-slot');
 const p=lmPoly(body,'tie',vb);if(p)LM.tie=p;const s=lmPoly(body,'shirt',vb);}
const A=std(vb.w*U,vb.h*U);
const crestC=[+(((X(357.5)+107.5*S/2)-vb.x)*U).toFixed(2),+((Y(266)+0.9+0.08+1.4-vb.y)*U).toFixed(2)];
const anchors={...A,hem_center:[A.top_center[0],uy(HEM)],nameplate_slot_center:lmCen(LM.nameplate_slot),nameplate_slot_top_left:[LM.nameplate_slot.x,LM.nameplate_slot.y],pocket_top_center:[LM.breast_pocket.x+LM.breast_pocket.w/2,LM.breast_pocket.y],
  crest_center:crestC,crest_top_center:[crestC[0],+(crestC[1]-140).toFixed(2)],button_1_center:[ux(BTX),uy(Y(379))],button_2_center:[ux(BTX),uy(Y(491))],chaplain_badge_above_nametag:[LM.nameplate_slot.x+LM.nameplate_slot.w/2,LM.nameplate_slot.y-50],
  lapel_pin_right_center:lmCen(LM.lapel_pin_slot_right),lapel_pin_left_center:lmCen(LM.lapel_pin_slot_left),medal_slot_center:lmCen(LM.medal_slot),chaplain_badge_semiformal:[LM.medal_slot.x+LM.medal_slot.w/2,LM.medal_slot.y-50]};
conv({id,name:"Men's Corporate Service Dress: navy blazer, white shirt and tie, gray trousers (blank nametag)",vb,body,source:'reference-art-measured',
  meta:{size_source:'estimated',size_basis:`Silhouette traced from images/base/male_semi_formal.webp (581x719 px) at ${S} in/px (same canvas/scale assumption as the other garments). Trousers are added below the base image's cropped hem. No real garment was measured.`,
    anchors:Object.fromEntries(Object.entries(anchors).map(([k,v])=>[k,r2(v)])),landmarks:LM,
    landmarks_note:'rects are {x,y,w,h}; polygons are [[x,y]...]; all in user units (0.01 in), origin top-left of the artwork box',
    dimensions:{blazer_length_in:+HEM.toFixed(2),total_length_in:+TOTAL.toFixed(2),max_width_in:+(2*maxX).toFixed(2),nametag_slot_in:[3.375,0.9],buttons:2},
    documented:['navy single-breasted blazer, two or three buttons, notched lapels, two front flap pockets and a left breast pocket (CAPR 39-1 4.2.3.1)','CAP Crest sewn to the centre of the left breast pocket or in the same relative position (4.2.3.1.1.1)','nametag slot: top edge aligned with top edge of the left breast pocket (4.2.3.1.1.2); the plate itself is a separate asset (assets/nameplates)','chaplain badge mandatory, 1/2 inch above the nametag (4.2.3.1.1.3)','white shirt; tie mandatory with this combination (4.2.3.2, 4.2.3.4)','medium gray trousers (4.2.3.3)'],
    assumed:['px-to-inch scale','nametag slot size 3.375 x 0.9 in (width from the CAP cadet plate; 3.75:1 proportion read from CAPR 39-1 Fig A6-3; the blazer plate is not dimensioned)','button diameter','CAP Crest art is a simplified parametric redraw','collar/tie/shirt geometry read off the base image','trousers added below the cropped blazer hem','colours sampled from the base image / figure'],
    fit:{method:'traced from the raster',score:null},grade:'garment'}});

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

{const Vp=[[-Math.abs(X(242)),Y(10)],[Math.abs(X(242)),Y(10)],[Math.abs(X(242)),Y(25)],[-X(296),Y(322)],[X(296),Y(322)],[-Math.abs(X(242)),Y(25)]];
 underlayer({kind:'turtleneck',id:'garment-underlayer-turtleneck-male',name:"White turtleneck sweater, men's corporate blazer V insert (registered to the blazer)",vbox:vb,Vpoly:Vp,cx:0,top:Y(10)+0.1,NW:4.2,NH:3.4,
   basis:'Original flat art fitted to the blazer V (same box/origin as the blazer). The regulation names the garment but gives no figure or dimension: 4.2 in neck width and 3.4 in neck height are estimates.',extra:{}});}
function NT_W(){return 3.375;}
const sq=(innerBody,v,name,px)=>{const cx2=v.x+v.w/2,cy2=v.y+v.h/2,s=Math.max(v.w,v.h);
  const x=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${cx2-s/2} ${cy2-s/2} ${s} ${s}" width="${px}" height="${px}">${DEFS2}${innerBody}</svg>`;
  const tmp=path.join(here,name+'.sq.svg');fs.writeFileSync(tmp,x);
  require('child_process').execSync(`qlmanage -t -s ${px} -o "${here}" "${tmp}" >/dev/null 2>&1 && mv "${tmp}.png" "${path.join(here,name+'_preview.png')}" && rm "${tmp}"`);};
sq(body,vb,'corporate-service-dress-blazer-male',+(process.env.PX||1000));
if(process.env.ZOOM){const [zx,zy,zw,zh]=process.env.ZOOM.split(',').map(Number);sq(body,{x:zx,y:zy,w:zw,h:zh},'blazer_zoom',900);}
console.log('ok',id);
