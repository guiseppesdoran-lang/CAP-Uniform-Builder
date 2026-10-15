// Women's White Overblouse (CAPR 39-1 4.2.6.1.2): short-sleeve princess-line overblouse traced from Vanguard's product photo, drawn in the same line style as the aviator shirts; tie tab is an extra.
// Silhouette traced from the regulation figure (3x page render, flood-filled alpha, board/sil.js -> ob_sil.json); interior parametric from coordinates read off the figure.
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
const wbutton=(x,y,r=0.2,id)=>{const holes=[[-1,-1],[1,-1],[-1,1],[1,1]].map(([a,b])=>`<circle cx="${f(x+a*r*0.3)}" cy="${f(y+b*r*0.3)}" r="${f(r*0.12)}" fill="#2a2a2c"/>`).join('');
  return `<g${id?` id="${id}"`:''}><circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="url(#btnw)" stroke="#a9a9a4" stroke-width="${f(r*0.12)}"/><circle cx="${f(x)}" cy="${f(y)}" r="${f(r*0.66)}" fill="none" stroke="#bdbdb8" stroke-width="${f(r*0.08)}"/>${holes}<path d="M${f(x-r*0.3)},${f(y-r*0.3)} L${f(x+r*0.3)},${f(y+r*0.3)} M${f(x+r*0.3)},${f(y-r*0.3)} L${f(x-r*0.3)},${f(y+r*0.3)}" stroke="#d9d9d4" stroke-width="${f(r*0.07)}" stroke-linecap="round"/></g>`;};

// Traced from Vanguard's product photo of the CAP women's white overblouse (cap1025F, 600x600, white on white). The photo is slightly lopsided, so the
// wearer-right half is smoothed (the JPEG edge is ragged) and mirrored about x=300. Interior lines are read off contrast-stretched crops of the photo.
const RAW=JSON.parse(fs.readFileSync(path.join(here,'ob_photo_sil.json'),'utf8')).outline;
const CXP=300;
let SHORTW=0;
const LS={oe:[38,596],ie:[96,596]};     // long sleeve: outer / inner cuff corners (photo px)
const SIL0=(()=>{
  // longest contiguous run of points left of the centre line = the half outline, neck to hem notch
  const n=RAW.length,inL=i=>RAW[(i+n)%n][0]<CXP;let best=[0,0];
  for(let i=0;i<n;i++){if(inL(i)&&!inL(i-1)){let j=i;while(inL(j+1))j++;if(j-i>best[1]-best[0])best=[i,j];}}
  let L=[];for(let i=best[0];i<=best[1];i++)L.push(RAW[i%n].slice());
  // the loop runs counter-clockwise from the hem notch up to the neck or the reverse: make it neck -> hem
  if(L[0][1]>L[L.length-1][1])L.reverse();
  // resample at ~1.5 px
  const rs=[L[0]];let acc=0;for(let i=1;i<L.length;i++){const a=L[i-1],b=L[i],d=Math.hypot(b[0]-a[0],b[1]-a[1]);let t=0;
    while(acc+d-t>=1.5){t+=1.5-acc;acc=0;rs.push([a[0]+(b[0]-a[0])*t/d,a[1]+(b[1]-a[1])*t/d]);}acc+=d-t;}
  rs.push(L[L.length-1]);
  // corners (collar tips, sleeve corners, armpit, hem corners, notch) stay put; everything between is smoothed
  const m=rs.length,W=7,ang=i=>{const a=rs[Math.max(0,i-W)],b=rs[i],c=rs[Math.min(m-1,i+W)];
    const u=[b[0]-a[0],b[1]-a[1]],v=[c[0]-b[0],c[1]-b[1]];return Math.abs(Math.atan2(u[0]*v[1]-u[1]*v[0],u[0]*v[0]+u[1]*v[1]));};
  const A=rs.map((_,i)=>ang(i)),anchor=rs.map((_,i)=>i===0||i===m-1||(A[i]>0.75&&A[i]>=Math.max(...A.slice(Math.max(0,i-W),i+W+1))));
  let P=rs.map(p=>p.slice());
  for(let it=0;it<70;it++){const Q=P.map(p=>p.slice());for(let i=1;i<m-1;i++)if(!anchor[i]){Q[i][0]=(P[i-1][0]+2*P[i][0]+P[i+1][0])/4;Q[i][1]=(P[i-1][1]+2*P[i][1]+P[i+1][1])/4;}P=Q;}
  // neck and collar: follow the collar leaf's own edges so the leaf and the silhouette share one line
  {const k=P.findIndex(p=>p[0]<=198&&p[1]>=50);if(k>0)P.splice(0,k,[CXP,76],[280,63],[267,40],[247,10],[229,41],[213,47]);}
  // hem: flat bottom edge from the side corner, then a straight V up to the notch on the centre line (read off the contrast-stretched photo)
  {const k=P.findIndex(p=>p[1]>570);if(k>0)P.length=k;}
  P.push([152,585],[246,587],[CXP,537]);
  P[0][0]=CXP;P[P.length-1][0]=CXP;
  SHORTW=2*(CXP-Math.min(...P.map(p=>p[0])));
  if(process.env.LONG==='1'){const iS=P.findIndex(p=>p[0]<=124&&p[1]>=80),iC=P.reduce((b,p,i)=>(i>iS&&p[0]<150&&p[1]<400&&p[1]>=P[b][1])?i:b,iS),iA=(()=>{let b=iC;for(let i=iC;i<Math.min(P.length,iC+45);i++)if(P[i][1]<P[b][1])b=i;return b;})();
    if(iS>0&&iA>iS){const SH=P[iS],AP=P[iA];
      P.splice(iS+1,iA-iS-1,[LS.oe[0]+3,LS.oe[1]-7],[LS.oe[0]+9,LS.oe[1]],[LS.ie[0]-9,LS.ie[1]],[LS.ie[0]-3,LS.ie[1]-7]);}}                                             // neck and notch sit on the axis
  const R=P.map(p=>[2*CXP-p[0],p[1]]).reverse();
  return [...P,...R.slice(1,R.length-1)];})();
const xs0=SIL0.map(p=>p[0]),ys0=SIL0.map(p=>p[1]),cxp=CXP,y0p=Math.min(...ys0);
const S=21.0/SHORTW;      // 21.0 in across the sleeves (estimate)
const X=px=>(px-cxp)*S,Y=py=>(py-y0p)*S,CX=CXP,mxp=px=>2*CXP-px;
const WHITE='#f7f7f4',LINEC='#3a3a3a',SEAMC='#3a3a3a',NAVYT='#0d2a66',GRAYS='#736f6c';
const poly=a=>'M'+a.map(p=>f(p[0])+','+f(p[1])).join('L')+'Z';
const pl=a=>'M'+a.map(p=>f(X(p[0]))+','+f(Y(p[1]))).join('L');
const ln=(d,w=.035,col=SEAMC,op=.9)=>`<path d="${d}" fill="none" stroke="${col}" stroke-opacity="${op}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const HEMY=587,SKL0=[[168,500],[161,600],[146,700]],SK=null;
const o=SIL0.map(p=>[X(p[0]),Y(p[1])]),HEM=Y(700),maxX=Math.max(SHORTW/2*S,...o.map(p=>Math.abs(p[0])));

const LONG=process.env.LONG==='1';
const mir=a=>a.map(p=>[mxp(p[0]),p[1]]);
const smooth=(P,it=2)=>{let Q=P;for(let k=0;k<it;k++){const N=[Q[0]];for(let i=0;i<Q.length-1;i++){const a=Q[i],b=Q[i+1];N.push([.75*a[0]+.25*b[0],.75*a[1]+.25*b[1]],[.25*a[0]+.75*b[0],.25*a[1]+.75*b[1]]);}N.push(Q[Q.length-1]);Q=N;}return Q;};
function garment(){
  const SIL=poly(o);
  let g=`<defs><clipPath id="clipSil"><path d="${SIL}"/></clipPath><radialGradient id="btnw" cx=".38" cy=".32" r=".8"><stop offset="0" stop-color="#ffffff"/><stop offset=".7" stop-color="#ececE8"/><stop offset="1" stop-color="#cfcfca"/></radialGradient></defs>`;
  g+=`<path id="skirt" d="${pl([...smooth(SKL0,2),...mir(smooth(SKL0,2)).reverse()])}Z" fill="${GRAYS}" stroke="${LINEC}" stroke-width=".04" stroke-linejoin="round"/>`;
  g+=`<g id="garment-body"><path id="silhouette" d="${SIL}" fill="${WHITE}" stroke="${LINEC}" stroke-width=".04" stroke-linejoin="round"/><g clip-path="url(#clipSil)">`;
  // armhole seams (shoulder end to armpit), princess seams (shoulder yoke to hem), sleeve hem lines
  const arm=smooth([[138,106],[146,150],[152,210],[158,265],[160,313]]);
  const prin=smooth([[195,68],[193,150],[192,250],[203,310],[196,400],[188,500],[184,584]]);
  g+=ln(pl(arm))+ln(pl(mir(arm)))+ln(pl(prin))+ln(pl(mir(prin)));
  // epaulet straps: flat strap from the collar to the armhole; top edge follows the shoulder silhouette, button at the collar end
  const strap=smooth([[226,66],[190,76],[160,91],[138,108]]);
  const top=SIL0.filter(p=>p[0]<300&&p[0]>=126&&p[0]<=229&&p[1]<100);            // the shoulder silhouette itself, collar -> armhole
  for(const tag of ['right','left']){const m=p=>tag==='right'?p:[mxp(p[0]),p[1]];
    const P=[...top,...strap.slice().reverse()].map(m);
    g+=`<path id="epaulet-${tag}" d="${pl(P)}Z" fill="${WHITE}" stroke="${LINEC}" stroke-width=".035" stroke-linejoin="round"/>`;
    const c=m([217,58]);g+=wbutton(X(c[0]),Y(c[1]),0.1,`epaulet-button-${tag}`);}
  // sleeve hem line: the sleeve-end edge offset 8 px toward the body
  if(!LONG){const edge=SIL0.filter(p=>p[0]<138&&p[1]>272&&p[1]<365);
   const e=edge.sort((a,b)=>a[0]-b[0]);if(e.length>3){const pts=[];for(let i=0;i<e.length;i+=4)pts.push(e[i]);pts.push(e[e.length-1]);
     const off=pts.map((p,i)=>{const a=pts[Math.max(0,i-1)],b=pts[Math.min(pts.length-1,i+1)],dx=b[0]-a[0],dy=b[1]-a[1],d=Math.hypot(dx,dy)||1;return [p[0]+dy/d*8,p[1]-dx/d*8];});
     const hm=smooth(off.slice(1,-1),1);g+=ln(pl(hm))+ln(pl(mir(hm)));}}
  // placket (both edges) and the inverted-V tie tab (lies under the collar)
  g+=ln(pl([[300,80],[300,560]]),.03,'#a9a9a9',1);
  // collar leaves
  for(const [tag,sg] of [['right',1],['left',-1]]){const m=p=>sg>0?p:[mxp(p[0]),p[1]];
    g+=`<path id="collar-${tag}" d="${pl([[247,10],[267,40],[280,63],[300,76],[237,120],[223,52]].map(m))}Z" fill="${WHITE}" stroke="${LINEC}" stroke-width=".04" stroke-linejoin="round"/>`;}
  [90,152,218,290,370,448].forEach((by,i)=>g+=wbutton(X(299),Y(by),0.195,`button-${i+1}`));
  g+=`</g>`;
  if(LONG){ // long sleeve cuff: band line and button (rounded cuff with a buttonhole closure, 4.2.6.1.2); sleeves end 1/4-1/2 in below the wrist
    const SHx=124,SHy=84,APx=159,APy=314,cuffY=LS.oe[1]-58;
    const ox=SHx+(LS.oe[0]-SHx)*(cuffY-SHy)/(LS.oe[1]-SHy),ix=APx+(LS.ie[0]-APx)*(cuffY-APy)/(LS.ie[1]-APy);
    for(const m of [p=>p,p=>[mxp(p[0]),p[1]]]){const a=m([ox,cuffY]),b=m([ix,cuffY]);
      g+=ln(`M${f(X(a[0])+(X(b[0])-X(a[0]))*0.04)},${f(Y(a[1]))} L${f(X(b[0])-(X(b[0])-X(a[0]))*0.04)},${f(Y(b[1]))}`,.035)+wbutton((X(a[0])+X(b[0]))/2,Y(cuffY+27),0.12,'cuff-button-'+(m([1,0])[0]===1?'right':'left'));}}
  g+=`</g>`;
  const NS={w:3.375,h:0.75};NS.x=X(215)-NS.w/2;NS.y=Y(132)-NS.h/2;   // within 1 1/2 in of the first exposed button, whichever button that is read as (4.2.6.2.6.1.2)
  g+=`<rect id="nameplate-slot" x="${f(NS.x)}" y="${f(NS.y)}" width="${NS.w}" height="${NS.h}" fill="none" stroke="none"/>`;
  const RS={w:4.125,h:1.5};RS.x=X(385)-RS.w/2;RS.y=NS.y+NS.h-RS.h;
  g+=`<rect id="ribbon-slot" x="${f(RS.x)}" y="${f(RS.y)}" width="${RS.w}" height="${RS.h}" fill="none" stroke="none"/>`;
  return g;}
const vb={x:-(maxX+0.2),y:-0.1,w:2*(maxX+0.2),h:HEM+0.2};
const body=garment(),id='garment-overblouse-female'+(LONG?'-long':'');
const ux=x=>+((x-vb.x)*U).toFixed(2),uy=y=>+((y-vb.y)*U).toFixed(2);
const LM={};for(const [k,i] of [['nameplate_slot','nameplate-slot'],['ribbon_slot','ribbon-slot']]){const r=lmRect(body,i,vb);if(r)LM[k]=r;}
for(const t of ['right','left']){const p=lmPoly(body,'epaulet-'+t,vb);if(p)LM['epaulet_'+t]=p;}
const A=std(vb.w*U,vb.h*U);
const nsC=[LM.nameplate_slot.x+LM.nameplate_slot.w/2,LM.nameplate_slot.y],rsC=[LM.ribbon_slot.x+LM.ribbon_slot.w/2,LM.ribbon_slot.y];
const anchors={...A,hem_center:[A.top_center[0],uy(Y(HEMY))],nameplate_slot_center:lmCen(LM.nameplate_slot),ribbon_slot_center:lmCen(LM.ribbon_slot),
  button_1_center:[ux(X(299)),uy(Y(90))],
  badge_above_nametag_center:[nsC[0],nsC[1]-50],command_pin_above_nametag_center:[nsC[0],nsC[1]-50],command_pin_below_nametag_center:[nsC[0],nsC[1]+LM.nameplate_slot.h+50],
  badge_left_above_ribbons_center:[rsC[0],rsC[1]-50],
  nco_chevron_right_center:[ux(X(LONG?108:70)),uy(Y(LONG?225:318))],nco_chevron_left_center:[ux(X(mxp(LONG?108:70))),uy(Y(LONG?225:318))],
  collar_insignia_right_center:[ux(X(259)),uy(Y(60))],collar_insignia_left_center:[ux(X(mxp(259))),uy(Y(60))],epaulet_right_center:lmCen(lmBox(LM.epaulet_right)),epaulet_left_center:lmCen(lmBox(LM.epaulet_left))};
conv({id,name:`Women's White Overblouse: ${LONG?'long':'short'}-sleeve princess-line overblouse, pointed collar, gray skirt (blank slots)`,vb,body,source:'reference-art-measured',
  meta:{size_source:'estimated',size_basis:"Silhouette traced from Vanguard's product photo of the CAP women's white overblouse (smoothed, mirrored) and scaled to 21.0 in sleeve-to-sleeve (estimate); chest width then reads about 10 in flat. No real garment was measured.",
    anchors:Object.fromEntries(Object.entries(anchors).map(([k,v])=>[k,r2(v)])),landmarks:LM,landmarks_note:'rects/polygons in user units (0.01 in), origin top-left',
    dimensions:{length_in:+HEM.toFixed(2),max_width_in:+(2*maxX).toFixed(2),nametag_slot_in:[3.375,0.75]},
    documented:['white semi-form-fitting princess-line overblouse with two epaulets, long or short sleeves; long sleeves end 1/4 to 1/2 in below the wrist, rounded cuffs with buttonhole closures (CAPR 39-1 4.2.6.1.2)','nametag centred on the right side even with or up to 1 1/2 in higher or lower than the first exposed button, parallel to the ground (4.2.6.2.6.1.2)','ribbons centred on the left between the buttons and the arm seam, even with to 1 1/2 in above or below the first exposed button; bottom row even with the bottom of the nameplate (4.2.6.2.6.2.2)','blue inverted-V tie tab (4.2.6.3 / 4.2.4.3)'],
    assumed:['21.0 in scale','nametag / ribbon slot sizes','gray skirt as drawn in the figure (slacks are a bottoms variant)','epaulet strap shape (plain; the figure draws gray officer sleeves)'],
    fit:{method:'traced from a Vanguard product photo',score:null},grade:'garment'}});
const sq=(innerBody,v,name,px)=>{const cx2=v.x+v.w/2,cy2=v.y+v.h/2,s=Math.max(v.w,v.h);
  const x=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${cx2-s/2} ${cy2-s/2} ${s} ${s}" width="${px}" height="${px}">${DEFS2}${innerBody}</svg>`;
  const tmp=path.join(here,name+'.sq.svg');fs.writeFileSync(tmp,x);
  require('child_process').execSync(`qlmanage -t -s ${px} -o "${here}" "${tmp}" >/dev/null 2>&1 && mv "${tmp}.png" "${path.join(here,name+'_preview.png')}" && rm "${tmp}"`);};
sq(body,vb,'overblouse-female'+(LONG?'-long':''),+(process.env.PX||1000));
console.log('ok',id,'S',S.toFixed(5),'w',(2*maxX).toFixed(2),'h',HEM.toFixed(2));
