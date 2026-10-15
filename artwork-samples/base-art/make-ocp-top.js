// All-Season OCP coat + two detachable sleeve panels, built from documented construction in real inches.
// No reference art is read. Sources: CAP OCP wear guide (ICL 25-06 / CAPR 39-1 s7.1.1), DA PAM 670-1 4-8.
// ASSUMED values are parameters in DIM and listed in the landmarks file.
const fs=require('fs'),path=require('path');
const DIM={
  neck:2.9,shoulder:{x:9.2,y:2.4},underarm:{x:10.2,y:10.0},waist:{x:9.7,y:18.0},hem:{x:10.2,y:29.0},
  placketTop:3.5,placketHalf:0.95,
  // hanging sleeve (ghost-mannequin pose): outer edge points, inner edge points
  sleeveOuter:{bicep:[12.7,8.0],elbow:[13.9,16.5],cuff:[15.4,25.6]},
  sleeveInner:{elbow:[11.7,16.8],cuff:[11.1,26.0]},
  cuffBand:2.3,
  chestPocket:{cx:5.7,cy:11.3,w:5.8,flapH:2.5,h:6.4,tiltDeg:20},
  sleevePocket:{w:3.3,h:6.0,top:0.5,fieldH:4.7},
  // flat sleeve panel (straight): half-widths at cap / elbow / cuff and length
  panel:{cap:3.4,elbow:2.8,cuff:2.25,len:25.0,elbowY:14.0},
  // patch slots on the sleeve loop field (ASSUMED sizes; positions per CAPR 39-1 7.1.1.4 table)
  slots:{upper:{w:2.7,h:1.8},lower:{w:2.7,h:2.3},gap:0.3},
  tape:{w:4.6,h:1.0,rowY:6.2},
};
const PAL={pale:'#dcd2b8',tan:'#bba684',brown:'#9a7b5e',dark:'#66523f',green:'#8b9471',black:'#463b2f'};
const f=n=>(+n).toFixed(3),STROKE='#2c271c';
// ---------- pattern ----------
let seed=777;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
const TILE=20;
function blob(cx,cy,r,asp,rot){const n=8+Math.floor(rnd()*4),pts=[];
  for(let i=0;i<n;i++){const a=i/n*Math.PI*2,k=0.6+rnd()*0.75,x=Math.cos(a)*r*asp*k,y=Math.sin(a)*r*k,c=Math.cos(rot),s=Math.sin(rot);pts.push([cx+x*c-y*s,cy+x*s+y*c]);}
  const mid=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2];let d='';
  for(let i=0;i<n;i++){const p0=pts[i],p1=pts[(i+1)%n],m0=mid(pts[(i+n-1)%n],p0),m1=mid(p0,p1);d+=(i?'':`M${f(m0[0])},${f(m0[1])}`)+`Q${f(p0[0])},${f(p0[1])} ${f(m1[0])},${f(m1[1])}`;}return d+'Z';}
function layer(color,count,rmin,rmax){let out='';
  for(let i=0;i<count;i++){const cx=rnd()*TILE,cy=rnd()*TILE,r=rmin+rnd()*(rmax-rmin),asp=1.2+rnd()*1.4,rot=rnd()*Math.PI,d=blob(cx,cy,r,asp,rot);
    const m=r*asp*1.5,xs=[0],ys=[0];if(cx<m)xs.push(TILE);if(cx>TILE-m)xs.push(-TILE);if(cy<m)ys.push(TILE);if(cy>TILE-m)ys.push(-TILE);
    for(const ox of xs)for(const oy of ys)out+=`<path d="${d}"${ox||oy?` transform="translate(${ox} ${oy})"`:''} fill="${color}"/>`;}return out;}
const DEFS=`<defs><pattern id="ocp" patternUnits="userSpaceOnUse" width="${TILE}" height="${TILE}"><rect width="${TILE}" height="${TILE}" fill="${PAL.tan}"/>`
 +layer(PAL.pale,150,0.2,0.7)+layer(PAL.green,150,0.2,0.7)+layer(PAL.brown,140,0.2,0.65)+layer(PAL.dark,60,0.15,0.45)+layer(PAL.black,14,0.12,0.28)+`</pattern>
<linearGradient id="shadeX" gradientUnits="userSpaceOnUse" x1="-10.4" y1="0" x2="10.4" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".34"/><stop offset=".1" stop-color="#000" stop-opacity=".12"/><stop offset=".28" stop-color="#000" stop-opacity="0"/><stop offset=".72" stop-color="#000" stop-opacity="0"/><stop offset=".9" stop-color="#000" stop-opacity=".12"/><stop offset="1" stop-color="#000" stop-opacity=".34"/></linearGradient>
<linearGradient id="shadeBox" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".32"/><stop offset=".22" stop-color="#000" stop-opacity=".06"/><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset=".78" stop-color="#000" stop-opacity=".06"/><stop offset="1" stop-color="#000" stop-opacity=".32"/></linearGradient>
<linearGradient id="shoulderLight" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
</defs>`;
// ---------- helpers ----------
const D=DIM,mx=s=>(x,y)=>`${f(s*x)},${f(y)}`;
const loop=(d,id)=>`<path ${id?`id="${id}" `:''}d="${d}" fill="#b29c76" stroke="${STROKE}" stroke-width=".06"/>`;
const stitch=d=>`<path d="${d}" fill="none" stroke="#231f15" stroke-opacity=".5" stroke-width=".035" stroke-dasharray=".12 .08"/>`;
const crease=d=>`<path d="${d}" fill="none" stroke="#000" stroke-opacity=".10" stroke-width=".11" stroke-linecap="round"/>`;
const fab=(d,id,sw=0.08)=>`<path ${id?`id="${id}" `:''}d="${d}" fill="url(#ocp)" stroke="${STROKE}" stroke-width="${sw}" stroke-linejoin="round"/>`;
const shade=(d,fill='url(#shadeBox)')=>`<path d="${d}" fill="${fill}" pointer-events="none"/>`;
const rot=(pts,cx,cy,deg)=>{const a=deg*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return pts.map(([x,y])=>[cx+(x-cx)*c-(y-cy)*s,cy+(x-cx)*s+(y-cy)*c]);};
const P=pts=>'M'+pts.map(p=>f(p[0])+','+f(p[1])).join('L')+'Z';
// ---------- garment geometry (right side = +x, mirrored for the other) ----------
function bodyPath(){
  const s=D.shoulder,u=D.underarm,w=D.waist,h=D.hem,n=D.neck;
  const right=`L${f(n)},0 C${f(5.6)},0.15 ${f(7.7)},0.95 ${f(s.x)},${f(s.y)} C${f(s.x+0.9)},4.4 ${f(u.x+0.1)},7.2 ${f(u.x)},${f(u.y)} C${f(u.x-0.2)},13 ${f(w.x)},15.4 ${f(w.x)},${f(w.y)} C${f(w.x)},22 ${f(h.x-0.1)},26 ${f(h.x)},${f(h.y)}`;
  const left=`C${f(-h.x+0.1)},26 ${f(-w.x)},22 ${f(-w.x)},${f(w.y)} C${f(-w.x)},15.4 ${f(-u.x+0.2)},13 ${f(-u.x)},${f(u.y)} C${f(-u.x-0.1)},7.2 ${f(-s.x-0.9)},4.4 ${f(-s.x)},${f(s.y)} C${f(-7.7)},0.95 ${f(-5.6)},0.15 ${f(-n)},0`;
  return `M${f(-n)},0 ${right} Q0,${f(h.y+0.35)} ${f(-h.x)},${f(h.y)} ${left} Z`;}
function sleevePath(side){ // hanging sleeve, side=+1 right(+x)
  const s=D.shoulder,u=D.underarm,O=D.sleeveOuter,I=D.sleeveInner,m=mx(side);
  return `M${m(s.x,s.y)} C${m(s.x+2.3,s.y+0.1)} ${m(O.bicep[0]-0.2,O.bicep[1]-3)} ${m(O.bicep[0],O.bicep[1])} `
   +`C${m(O.bicep[0]+0.5,11.5)} ${m(O.elbow[0]+0.1,13.5)} ${m(O.elbow[0],O.elbow[1])} C${m(O.elbow[0]+0.6,19.5)} ${m(O.cuff[0]-0.1,22.5)} ${m(O.cuff[0],O.cuff[1])} `
   +`L${m(I.cuff[0],I.cuff[1])} C${m(I.cuff[0]+0.1,22.5)} ${m(I.elbow[0]+0.4,19.8)} ${m(I.elbow[0],I.elbow[1])} C${m(I.elbow[0]-0.4,14.5)} ${m(u.x+0.1,12.5)} ${m(u.x,u.y)} `
   +`C${m(u.x+0.1,7.2)} ${m(s.x+0.9,4.4)} ${m(s.x,s.y)} Z`;}
// sleeve axis for placing pocket/cuff on the hanging sleeve
const capC=[11.1,4.2],cuffC=[(D.sleeveOuter.cuff[0]+D.sleeveInner.cuff[0])/2,(D.sleeveOuter.cuff[1]+D.sleeveInner.cuff[1])/2];
const axAng=Math.atan2(cuffC[0]-capC[0],cuffC[1]-capC[1])*180/Math.PI,axLen=Math.hypot(cuffC[0]-capC[0],cuffC[1]-capC[1]);
const axisPt=d=>[capC[0]+(cuffC[0]-capC[0])*d/axLen,capC[1]+(cuffC[1]-capC[1])*d/axLen];
function sleeveRect(d0,w,h,side){const c=axisPt(d0+h/2),pts=[[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]].map(([x,y])=>[c[0]+x,c[1]+y]);
  const r=rot(pts,c[0],c[1],-axAng);return side>0?r:r.map(([x,y])=>[-x,y]);}
function collarLeaf(side){const m=mx(side);
  return `M${m(0.3,D.placketTop)} C${m(0.9,1.6)} ${m(2.1,-0.5)} ${m(3.3,-1.1)} L${m(5.0,0.2)} C${m(5.5,1.6)} ${m(5.0,3.0)} ${m(3.9,4.2)} C${m(2.7,4.4)} ${m(1.4,4.0)} ${m(0.3,D.placketTop)} Z`;}
// ---------- main garment ----------
function garment(){
  let g=`<defs><clipPath id="clipBody"><path d="${bodyPath()}"/></clipPath><clipPath id="clipSleeveL"><path d="${sleevePath(1)}"/></clipPath><clipPath id="clipSleeveR"><path d="${sleevePath(-1)}"/></clipPath></defs>`;
  // sleeves behind body
  for(const side of [1,-1]){const tag=side>0?'left':'right';
    const d=sleevePath(side);
    g+=`<g id="sleeve-${tag}">${fab(d,`sleeve-panel-${tag}`)}${shade(d)}<g clip-path="url(#clipSleeve${side>0?'L':'R'})">`;
    const SP=D.sleevePocket,pk=sleeveRect(SP.top,SP.w,SP.h,side),fd=sleeveRect(SP.top+0.15,SP.w-0.5,SP.fieldH,side);
    g+=fab(P(pk),`sleeve-pocket-${tag}`,0.07)+loop(P(fd),`sleeve-loop-field-${tag}`);
    // cuff band
    const cb=sleeveRect(axLen-D.cuffBand-0.35,(D.sleeveOuter.cuff[0]-D.sleeveInner.cuff[0])+1.2,D.cuffBand,side);
    g+=`<path d="${P(cb)}" fill="url(#ocp)" stroke="${STROKE}" stroke-width=".07"/>`;
    // elbow crease + inner shading
    const e=D.sleeveOuter.elbow,i=D.sleeveInner.elbow;
    g+=crease(`M${f(side*(i[0]+0.4))},${f(e[1]-0.6)} Q${f(side*((e[0]+i[0])/2))},${f(e[1]+0.4)} ${f(side*(e[0]-0.4))},${f(e[1]-0.5)}`);
    g+=`</g></g>`;}
  // pen slots on wearer's left forearm (assumed)
  g+=`<g clip-path="url(#clipSleeveL)">`;
  {const side=1,w=0.72,gap=0.2,n=3,tot=n*w+(n-1)*gap,c=axisPt(axLen-7.8);
    for(let k=0;k<n;k++){const x0=-tot/2+k*(w+gap);
      const r=rot([[x0,-1.8],[x0+w,-1.8],[x0+w,1.8],[x0,1.8]].map(([x,y])=>[c[0]+x,c[1]+y]),c[0],c[1],-axAng);
      g+=`<path id="pen-slot-${k+1}" d="${P(r)}" fill="url(#ocp)" stroke="${STROKE}" stroke-width=".06"/>`;}}
  g+=`</g>`;
  // body
  const bd=bodyPath();
  g+=`<g id="body">${fab(bd,'body-panel')}${shade(bd,'url(#shadeX)')}`
    +`<path d="${bd}" fill="url(#shoulderLight)"/>`
    +crease(`M-6.2,19 Q-5,24 -5.4,28.4`)+crease(`M6.2,19 Q5,24 5.4,28.4`)+crease(`M-8.4,10.8 Q-9.2,14 -8.6,17`)+crease(`M8.4,10.8 Q9.2,14 8.6,17`)
    +`<path id="placket" d="M${f(-D.placketHalf)},${f(D.placketTop)} L${f(D.placketHalf)},${f(D.placketTop)} L${f(D.placketHalf)},${f(D.hem.y+0.18)} L${f(-D.placketHalf)},${f(D.hem.y+0.18)} Z" fill="url(#ocp)" stroke="${STROKE}" stroke-width=".07"/>`
    +stitch(`M${f(-D.placketHalf+.2)},${f(D.placketTop)} V${f(D.hem.y)} M${f(D.placketHalf-.2)},${f(D.placketTop)} V${f(D.hem.y)}`)
    +stitch(`M${f(-D.hem.x+.15)},${f(D.hem.y-1.15)} Q0,${f(D.hem.y-0.8)} ${f(D.hem.x-.15)},${f(D.hem.y-1.15)}`)+`</g>`;
  // loop (hook-and-loop) fields: one wide strip above each chest pocket (name tape / CAP tape) + centre-chest field on the placket
  {const T=D.tape,LS={w:T.w+0.5,h:T.h+0.5,y:T.rowY-0.25};
   for(const [x,id] of [[-D.chestPocket.cx,'loop-strip-right'],[D.chestPocket.cx,'loop-strip-left']])
     g+=`<rect id="${id}" x="${f(x-LS.w/2)}" y="${f(LS.y)}" width="${LS.w}" height="${f(LS.h)}" rx=".08" fill="#b29c76" stroke="${STROKE}" stroke-width=".06"/>`;
   g+=`<rect id="loop-field-center-chest" x="-1.55" y="${f(D.placketTop+0.95)}" width="3.1" height="2.0" rx=".08" fill="#b29c76" stroke="${STROKE}" stroke-width=".06"/>`;}
  // chest pockets (tilted)
  const CP=D.chestPocket;g+=`<g id="chest-pockets">`;
  for(const sign of [-1,1]){const tag=sign<0?'right':'left',cx=sign*CP.cx,cy=CP.cy,x0=cx-CP.w/2,x1=cx+CP.w/2,top=cy-CP.h/2,r=sign<0?CP.tiltDeg:-CP.tiltDeg;
    const bodyP=rot([[x0,top+0.2],[x1,top+0.2],[x1,top+CP.h],[x0,top+CP.h]],cx,cy,r);
    const flap=rot([[x0-.08,top],[x1+.08,top],[x1+.08,top+CP.flapH-.1],[cx,top+CP.flapH+.35],[x0-.08,top+CP.flapH-.1]],cx,cy,r);
    g+=`<path id="chest-pocket-${tag}" d="${P(bodyP)}" fill="url(#ocp)" stroke="${STROKE}" stroke-width=".08" stroke-linejoin="round"/>`
      +`<path d="${P(flap)}" fill="#000" opacity=".2" transform="translate(0 .13)"/>`
      +`<path id="chest-flap-${tag}" d="${P(flap)}" fill="url(#ocp)" stroke="${STROKE}" stroke-width=".08" stroke-linejoin="round"/>`;
    const c=flap.reduce((a,q)=>[a[0]+q[0]/5,a[1]+q[1]/5],[0,0]);
    g+=`<rect x="${f(c[0]-.5)}" y="${f(c[1]-.12)}" width="1" height=".24" fill="#b29c76" stroke="${STROKE}" stroke-width=".04" transform="rotate(${r} ${f(c[0])} ${f(c[1])})"/>`;}
  g+=`</g>`;
  // collar + T-shirt
  g+=`<g id="collar"><path d="M${f(-D.neck+.1)},-0.9 Q0,${f(-1.9)} ${f(D.neck-.1)},-0.9 L${f(D.neck-.1)},0.1 Q0,${f(-0.7)} ${f(-D.neck+.1)},0.1 Z" fill="url(#ocp)" stroke="${STROKE}" stroke-width=".06"/>`
    +`<path d="M${f(-2.5)},-0.9 L${f(2.5)},-0.9 L0.55,${f(D.placketTop+0.1)} L-0.55,${f(D.placketTop+0.1)} Z" fill="#8f7b57" stroke="${STROKE}" stroke-width=".06"/>`
    +fab(collarLeaf(1),'collar-left')+fab(collarLeaf(-1),'collar-right')
    +`<rect id="zipper-pull" x="-0.17" y="${f(D.placketTop-0.05)}" width=".34" height=".85" rx=".08" fill="#6d6a62" stroke="${STROKE}" stroke-width=".04"/></g>`;
  // tapes (blank, light silver on dark blue)
  const T=D.tape,tape=(x,id,label)=>`<g id="${id}"><rect x="${f(x-T.w/2)}" y="${f(T.rowY)}" width="${T.w}" height="${T.h}" rx=".05" fill="#101b3a" stroke="#070c1c" stroke-width=".05"/>`
    +`<rect x="${f(x-T.w/2+.08)}" y="${f(T.rowY+.08)}" width="${f(T.w-.16)}" height="${f(T.h-.16)}" rx=".03" fill="none" stroke="#c9ced8" stroke-opacity=".35" stroke-width=".03" stroke-dasharray=".1 .07"/><title>${label}</title></g>`;
  g+=tape(-CP.cx,'name-tape','Name tape (blank): light silver on dark blue')+tape(CP.cx,'cap-tape','CAP tape: light silver on dark blue');
  return g;}
// ---------- detachable sleeve panel (flat, axis vertical) with patch slots ----------
function sleevePanel(tag){
  const p=D.panel,L=p.len,S=D.slots,left=tag==='left';
  const outline=`M${f(-p.cap)},0.9 C${f(-p.cap)},-0.1 ${f(-p.cap+1)},-0.5 0,-0.5 C${f(p.cap-1)},-0.5 ${f(p.cap)},-0.1 ${f(p.cap)},0.9 `
    +`C${f(p.cap+0.1)},6 ${f(p.elbow+0.2)},${f(p.elbowY-4)} ${f(p.elbow)},${f(p.elbowY)} C${f(p.elbow-0.1)},${f(p.elbowY+5)} ${f(p.cuff+0.05)},${f(L-5)} ${f(p.cuff)},${f(L)} `
    +`L${f(-p.cuff)},${f(L)} C${f(-p.cuff-0.05)},${f(L-5)} ${f(-p.elbow+0.1)},${f(p.elbowY+5)} ${f(-p.elbow)},${f(p.elbowY)} C${f(-p.elbow-0.2)},${f(p.elbowY-4)} ${f(-p.cap-0.1)},6 ${f(-p.cap)},0.9 Z`;
  let g=`<g id="sleeve-panel-${tag}">${fab(outline,`panel-${tag}`)}<path d="${outline}" fill="url(#shadeBox)"/>`;
  const SP=D.sleevePocket,px=-SP.w/2;
  g+=`<g id="pocket-${tag}"><rect x="${f(px)}" y="${f(SP.top)}" width="${SP.w}" height="${SP.h}" fill="url(#ocp)" stroke="${STROKE}" stroke-width=".07"/>`
    +`<rect id="loop-field-${tag}" x="${f(px+0.25)}" y="${f(SP.top+0.15)}" width="${f(SP.w-0.5)}" height="${SP.fieldH}" fill="#b29c76" stroke="${STROKE}" stroke-width=".05"/>`;
  // glint tab (covered) above the field
  g+=`<rect x="${f(-0.35)}" y="${f(SP.top-0.55)}" width=".7" height=".35" fill="url(#ocp)" stroke="${STROKE}" stroke-width=".04"><title>IR glint tab (stays covered)</title></rect>`;
  // patch slots (dashed); upper = mandatory, lower = unit/higher HQ per the CAPR 39-1 table
  const fx=px+0.25,fw=SP.w-0.5,uy=SP.top+0.15+0.2,ux=fx+(fw-S.upper.w)/2;
  const upLabel=left?'AUX duty identifier (mandatory)':'US flag, reversed (mandatory)';
  const loLabel=left?'Wing / region / CAP Command patch':'Squadron / group / wing / region patch';
  g+=`<rect id="slot-upper-${tag}" x="${f(ux)}" y="${f(uy)}" width="${S.upper.w}" height="${S.upper.h}" fill="none" stroke="#101b3a" stroke-width=".07" stroke-dasharray=".25 .15"><title>${upLabel}</title></rect>`
    +`<rect id="slot-lower-${tag}" x="${f(ux)}" y="${f(uy+S.upper.h+S.gap)}" width="${S.lower.w}" height="${S.lower.h}" fill="none" stroke="#101b3a" stroke-width=".07" stroke-dasharray=".25 .15"><title>${loLabel}</title></rect></g>`;
  // cuff band + (left) pen slots
  g+=`<rect x="${f(-p.cuff)}" y="${f(L-D.cuffBand)}" width="${f(p.cuff*2)}" height="${D.cuffBand}" fill="url(#ocp)" stroke="${STROKE}" stroke-width=".07"/>`;
  if(left){const w=0.72,gap=0.2,tot=3*w+2*gap;for(let k=0;k<3;k++)g+=`<rect x="${f(-tot/2+k*(w+gap))}" y="${f(L-D.cuffBand-4.2)}" width="${w}" height="3.6" fill="url(#ocp)" stroke="${STROKE}" stroke-width=".06"/>`;}
  g+=`</g>`;return g;}
// ---------- write ----------
const here=__dirname;
const vbG={x:-17.4,y:-3.6,w:34.8,h:35.4};
const wrap=(vb,body,extra='')=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.x} ${vb.y} ${vb.w} ${vb.h}" width="${vb.w}in" height="${vb.h}in" data-units="in" ${extra}>${DEFS}${body}</svg>`;
fs.writeFileSync(path.join(here,'ocp_top_allseason.svg'),wrap(vbG,`<title>All-Season OCP coat, blank name tape (inches)</title>`+garment(),'data-garment="ocp-top-allseason"'));
const vbS={x:-5.2,y:-1.6,w:10.4,h:28.6};
for(const tag of ['right','left'])fs.writeFileSync(path.join(here,`ocp_sleeve_${tag}.svg`),wrap(vbS,`<title>OCP ${tag} sleeve: patch placement panel (inches)</title>`+sleevePanel(tag),`data-garment="ocp-sleeve-${tag}"`));
// builder layout: garment centered, the two sleeve panels floating to each side
const W=vbG.w,pad=1.5,pw=vbS.w,lay={x:-(W/2)-pw-pad-0.8,y:-3.6,w:W+2*(pw+pad)+1.6,h:vbG.h};
const place=(tag,xc)=>`<g transform="translate(${f(xc)} 0)"><rect x="${f(-pw/2-0.3)}" y="-2.4" width="${f(pw+0.6)}" height="${f(vbS.h+0.8)}" rx=".4" fill="#f4f2ec" stroke="#b9b3a1" stroke-width=".08"/><text x="0" y="-1.0" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="0.9" fill="#444">${tag==='right'?'RIGHT SLEEVE':'LEFT SLEEVE'}</text>${sleevePanel(tag)}</g>`;
const xr=-(W/2)-pad-pw/2,xl=(W/2)+pad+pw/2;
fs.writeFileSync(path.join(here,'ocp_builder_layout.svg'),wrap(lay,`<title>OCP builder layout: coat plus two sleeve placement panels</title>`+garment()+place('right',xr)+place('left',xl),'data-garment="ocp-builder-layout"'));
fs.writeFileSync(path.join(here,'ocp_top_allseason.landmarks.json'),JSON.stringify({
  units:'in',origin:"centerline x=0, collar base y=0, y down; +x = wearer's left",
  provenance:{
    documented:['no lower pockets','covered front zipper with hook-and-loop flap','tilted chest pockets, hook-and-loop closure (DA PAM 670-1 4-8)','upper-sleeve pockets with loop field; right: flag over unit patch, left: AUX over wing/region (CAPR 39-1 7.1.1.4)','hook-and-loop sleeve cuffs','tapes light silver on dark blue, sewn or Velcro (CAPR 39-1 7.1.1.2)','max 4 badges centered above CAP tape, 1/8 in blue margin (7.1.1.3)'],
    assumed:['all dimensions (nominal medium-regular)','chest pocket tilt 20 deg, outer end up','tape size 4.6 x 1.0 in','patch slot sizes','left-forearm pen slots (vendor listings)','OCP palette sampled from a photo; shapes procedural']},
  dim:DIM,
  sleevePanel:{lengthIn:D.panel.len,slots:{upper:D.slots.upper,lower:D.slots.lower},note:'slot positions are inside the loop field; sizes assumed'},
  landmarks:{collarBase:[0,0],placketTop:[0,D.placketTop],hemY:D.hem.y,
    chestPocketRight:{center:[-D.chestPocket.cx,D.chestPocket.cy],tiltDeg:D.chestPocket.tiltDeg},chestPocketLeft:{center:[D.chestPocket.cx,D.chestPocket.cy],tiltDeg:-D.chestPocket.tiltDeg},
    nameTape:{x:-D.chestPocket.cx-D.tape.w/2,y:D.tape.rowY,w:D.tape.w,h:D.tape.h},capTape:{x:D.chestPocket.cx-D.tape.w/2,y:D.tape.rowY,w:D.tape.w,h:D.tape.h}}},null,1));
// previews (square wrappers so qlmanage doesn't clip)
const sq=(svg,vb,name,side)=>{const cx=vb.x+vb.w/2,cy=vb.y+vb.h/2,s=Math.max(vb.w,vb.h);
  fs.writeFileSync(path.join(here,name),svg.replace(/width="[\d.]+in" height="[\d.]+in"/,`width="${side}" height="${side}"`).replace(/viewBox="[^"]+"/,`viewBox="${cx-s/2} ${cy-s/2} ${s} ${s}"`));};
sq(fs.readFileSync(path.join(here,'ocp_top_allseason.svg'),'utf8'),vbG,'_p1.svg',900);
sq(fs.readFileSync(path.join(here,'ocp_builder_layout.svg'),'utf8'),lay,'_p2.svg',1400);
console.log('ok');
