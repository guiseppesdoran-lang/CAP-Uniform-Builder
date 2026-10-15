// Corporate Field Uniform coat (dark blue, BDU style) - CAPR 39-1 5.2.1 (Figure 5.4). Solid dark blue, four bellows pockets with flaps,
// straight-cut sleeve tabs, button front. Built from make-abu-top.js (same traced outline, collar and layout), in real inches.
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
const GLY=JSON.parse(fs.readFileSync(path.join(__dirname,'..','assets','tools','glyphs_arialbold_cap.json')));
// outlined lettering (no <text>): centred on (cx,cy), cap height capH in, tracking in em
const lettering=(str,cx,cy,capH,fill,track=0.06,fitW=null)=>{const k=capH/71.58,ch=[...str],adv=ch.map(c=>c===' '?0.28*100:GLY[c].adv);
  const tw=adv.reduce((a,v)=>a+v,0)+track*100*(ch.length-1),kx=fitW?fitW/tw:k;let x=0,d='';
  ch.forEach((c,i)=>{if(c!==' ')d+=`<path transform="translate(${f(x)} 0)" d="${GLY[c].d}"/>`;x+=adv[i]+track*100;});
  return `<g fill="${fill}" transform="translate(${f(cx-tw*kx/2)} ${f(cy+capH/2)}) scale(${kx.toFixed(5)} ${k.toFixed(5)})">${d}</g>`;};
const stitch=d=>'';   // topstitching removed (same as the OCP coat)
const crease=d=>`<path d="${d}" fill="none" stroke="#000" stroke-opacity=".10" stroke-width=".11" stroke-linecap="round"/>`;
const fab=(d,id,sw=0.08)=>`<path ${id?`id="${id}" `:''}d="${d}" fill="url(#ocp)" stroke="${STROKE}" stroke-width="${sw}" stroke-linejoin="round"/>`;
const shade=(d,fill='url(#shadeBox)')=>`<path d="${d}" fill="${fill}" pointer-events="none"/>`;
const rot=(pts,cx,cy,deg)=>{const a=deg*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return pts.map(([x,y])=>[cx+(x-cx)*c-(y-cy)*s,cy+(x-cx)*s+(y-cy)*c]);};
const P=pts=>'M'+pts.map(p=>f(p[0])+','+f(p[1])).join('L')+'Z';

// ---------- garment: silhouette traced from the ABU coat raster (abu_outline.json), OCP cut details added ----------
const OUT=require('./abu_outline.json');
// Widen the hanging sleeves so patches are legible: everything outboard of the armhole seam is pushed outward.
// (the traced ABU upper arm is only ~3.5 in wide; a flag + unit patch needs ~4+ in of Velcro)
const KY=y=>y<=2.8?1:y<7?1+0.1*(y-2.8)/4.2:y<12?1.1:y<18?1.1-0.06*(y-12)/6:1.04-0.04*(y-18)/11.6,SEAM0=[[-8.9,2.8],[-8.45,6],[-7.9,10],[-7.45,14.4],[-7.7,25.4],[-7.75,29.6]];
{const seam=y=>{const a=SEAM0;for(let i=0;i<a.length-1;i++)if(y>=a[i][1]&&y<=a[i+1][1])return a[i][0]+(a[i+1][0]-a[i][0])*(y-a[i][1])/(a[i+1][1]-a[i][1]||1);return a[a.length-1][0];};
 const warp=p=>{const sg=p[0]<0?-1:1,ax=Math.abs(p[0]),sx=-seam(p[1]);return ax>sx?[sg*(sx+(ax-sx)*KY(p[1])),p[1]]:p;};
 const dens=a=>{const o=[];for(let i=0;i<a.length;i++){const p=a[i],q=a[(i+1)%a.length],n=Math.max(1,Math.ceil(Math.hypot(q[0]-p[0],q[1]-p[1])/0.3));for(let k=0;k<n;k++)o.push([p[0]+(q[0]-p[0])*k/n,p[1]+(q[1]-p[1])*k/n]);}return o;};
 // rounded sleeve cap: the traced ABU shoulder drops away as a wedge; a set-in sleeve is broad at the top
 const CAP=[[2.8,8.9],[3.4,10.0],[4.3,11.1],[5.2,11.6],[6.5,11.9],[8,12.1],[9.5,12.3]];
 const capX=y=>{if(y<CAP[0][0]||y>=CAP[CAP.length-1][0])return 0;for(let i=0;i<CAP.length-1;i++)if(y<=CAP[i+1][0])return CAP[i][1]+(CAP[i+1][1]-CAP[i][1])*(y-CAP[i][0])/(CAP[i+1][0]-CAP[i][0]);return 0;};
 const cap=p=>{const ax=Math.abs(p[0]),y=p[1],w=y<7?1:Math.max(0,1-(y-7)/2.5);return(y>2.9&&y<9.5&&ax>-seam(y)+0.2)?[Math.sign(p[0])*(ax+w*(Math.max(ax,capX(y))-ax)),y]:p;};
 OUT.outline=dens(OUT.outline).map(warp);OUT.holes=OUT.holes.map(h=>dens(h).map(warp));}
// neck of the silhouette: replace the traced collar tips / V with the regulation-figure notch collar (collar-notch.js)
{const NC=require('./collar-notch.js').silhouetteChain(),o=OUT.outline,n=o.length,near=p=>{let b=0,bd=1e9;o.forEach((q,i)=>{const d=Math.hypot(q[0]-p[0],q[1]-p[1]);if(d<bd){bd=d;b=i;}});return b;};
 const iL=near([-4.03,1.67]),iR=near([4.03,1.67]),iA=near([0,4.91]);
 const between=(a,b,x)=>{for(let i=a;;i=(i+1)%n){if(i===x)return true;if(i===b)return false;}};
 const fwd=between(iL,iR,iA);   // neck run goes iL -> iR (forward) when the apex lies on it
 const rest=[];if(fwd){for(let i=(iR+1)%n;i!==iL;i=(i+1)%n)rest.push(o[i]);OUT.outline=rest.concat(NC);}
 else{for(let i=(iL+1)%n;i!==iR;i=(i+1)%n)rest.push(o[i]);OUT.outline=rest.concat(NC.slice().reverse());}}
const poly=a=>'M'+a.map(p=>f(p[0])+','+f(p[1])).join('L')+'Z';
const SIL=poly(OUT.outline)+OUT.holes.map(poly).join('');
const lerpAt=(arr,y)=>{for(let i=0;i<arr.length-1;i++){const[a,b]=[arr[i],arr[i+1]];if(y>=a[1]&&y<=b[1])return a[0]+(b[0]-a[0])*(y-a[1])/((b[1]-a[1])||1);}return arr[arr.length-1][0];};
// left (-x) outer edge as a function of y, from the traced outline
const leftEdge=(()=>{const pts=OUT.outline.filter(p=>p[0]<-8.5||p[1]>2.5).filter(p=>p[0]<-4).sort((a,b)=>a[1]-b[1]);return pts;})();
const outerX=y=>{let best=0;const o=OUT.outline;for(let i=0;i<o.length;i++){const a=o[i],b=o[(i+1)%o.length];if(a[0]>-6&&b[0]>-6)continue;if((a[1]-y)*(b[1]-y)<=0&&a[1]!==b[1]){const x=a[0]+(b[0]-a[0])*(y-a[1])/(b[1]-a[1]);if(x<best)best=x;}}return best;};
const SEAM=[[-8.9,2.8],[-8.45,6],[-7.9,10],[-7.45,14.4],[-7.7,25.4],[-7.75,29.6]];  // armhole / sleeve-body seam (left), read from the ABU raster
const seamX=y=>lerpAt(SEAM,y);
const sleeveC=y=>(outerX(y)+seamX(y))/2, sleeveW=y=>seamX(y)-outerX(y);
const HEM=OUT.heightIn, APEX=4.9, NECK=[-3.8,1.28], TIP=[-2.56,-0.43];
const PTOP=APEX;
const CPd={cx:4.35,cy:10.0,pcx:4.45,w:4.4,h:4.4,tiltDeg:10,flapW:0.95};  // tilted square: top edge rises toward the zipper
const TAPE={w:4.5,h:0.9};
// rank square: halfway up the pockets (their vertical midpoint)
CPd.rankY=CPd.cy;
{const hw=CPd.w/2,hh=CPd.h/2,r=-CPd.tiltDeg,c=rot([[-hw,-hh],[hw,-hh],[hw,hh],[-hw,hh]].map(([x,y])=>[-CPd.pcx+x,CPd.cy+y]),-CPd.pcx,CPd.cy,r);
 TAPE.y=+(Math.min(...c.map(p=>p[1]))-TAPE.h-0.1).toFixed(3);}  // sits directly on the highest point of the pocket

// =====================================================================================================
// Corporate Field Uniform coat (CAPR 39-1 5.2.1): solid dark blue, four bellows pockets with flaps,
// two lower pockets, button front + button cuffs, left-sleeve pen pocket, no Velcro. Same traced outline and sleeve cap as the OCP coat.
// =====================================================================================================
const SP={fTop:4.3};
const TL=16;
const SHX='<linearGradient id="shadeX12" gradientUnits="userSpaceOnUse" x1="-14.6" y1="0" x2="14.6" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".30"/><stop offset=".07" stop-color="#000" stop-opacity=".12"/><stop offset=".2" stop-color="#000" stop-opacity="0"/><stop offset=".8" stop-color="#000" stop-opacity="0"/><stop offset=".93" stop-color="#000" stop-opacity=".12"/><stop offset="1" stop-color="#000" stop-opacity=".30"/></linearGradient>';
const DEFS_ABU=`<defs><linearGradient id="shadeBox" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".32"/><stop offset=".22" stop-color="#000" stop-opacity=".06"/><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset=".78" stop-color="#000" stop-opacity=".06"/><stop offset="1" stop-color="#000" stop-opacity=".32"/></linearGradient>`
  +`<linearGradient id="shoulderLight" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>${SHX}</defs>`;
const AB='#26385e',DK='#0f1a3a';   // CFU fabric 'dark blue' (colour estimated); tapes are dark blue with silver lettering
// ---- geometry (inches; centreline x=0; y down from the collar tips)
const PK={cx:3.85,w:5.0,top:8.5,h:6.4,flapH:2.3};                     // upper chest pockets (measured off the ABU raster)
const LP={cx:3.95,w:4.4,top:21.2,h:6.4,flapH:2.0};                    // lower pockets
const TAPEA={w:PK.w,h:0.9,y:PK.top-0.9-0.05};                          // CAPR 39-1 5.1.1.1.2.1: immediately above the upper pockets, cut/folded to pocket width
const BUTTONS=[6.2,11.3,16.4,21.5,26.4];
const btn=(x,y,r=0.17)=>`<circle cx="${f(x)}" cy="${f(y)}" r="${r}" fill="#1d2d52" stroke="${STROKE}" stroke-width=".04"/><circle cx="${f(x)}" cy="${f(y)}" r="${r*0.45}" fill="none" stroke="#0c1530" stroke-width=".025"/>`;
const SEAMY=y=>seamX(y);
const COLLAR=require('./collar-notch.js').collar({fill:AB,stroke:STROKE});
function abuGarment(){
  let g=`<defs><clipPath id="clipSil"><path d="${SIL}" clip-rule="evenodd"/></clipPath></defs>`;
  // inside of the back of the coat seen through the neck: the back collar stand (lighter band, flat lower edge) over the darker inside back
  const IN=`M${f(TIP[0])},${f(TIP[1])} Q0,0.25 ${f(-TIP[0])},${f(TIP[1])} L0,${f(APEX)} Z`;
  g+=`<g id="collar-interior"><path d="${IN}" fill="${AB}"/><path d="${IN}" fill="#000" opacity=".5"/>`
    +`<path d="M${f(TIP[0])},${f(TIP[1])} Q0,0.25 ${f(-TIP[0])},${f(TIP[1])}" fill="none" stroke="#000" stroke-opacity=".3" stroke-width=".08"/></g>`;
  const BAND=`M${f(NECK[0])},${f(NECK[1])} Q0,-2.75 ${f(-NECK[0])},${f(NECK[1])} L${f(-TIP[0])},${f(TIP[1])} Q0,0.25 ${f(TIP[0])},${f(TIP[1])} Z`;
  g+=`<g id="collar-back"><path d="${BAND}" fill="${AB}" stroke="${STROKE}" stroke-width=".06"/><path d="${BAND}" fill="#000" opacity=".14"/></g>`;
  g+=`<g id="garment-body"><path id="silhouette" d="${SIL}" fill="${AB}" fill-rule="evenodd" stroke="${STROKE}" stroke-width=".09" stroke-linejoin="round"/><g clip-path="url(#clipSil)">`
    +`<rect x="-15" y="-1" width="30" height="32" fill="url(#shadeX12)"/>`;
  for(const s of [-1,1]){const sp='M'+SEAM0.map(p=>f(-s*p[0])+','+f(p[1])).join('L'),side=s<0?'right':'left';  // wearer's right = -x
    g+=`<path d="${sp}" fill="none" stroke="#000" stroke-opacity=".16" stroke-width=".55" stroke-linecap="round" transform="translate(${f(s*0.18)} 0)"/>`
      +`<path id="seam-${side}" d="${sp}" fill="none" stroke="#1d1a12" stroke-opacity=".75" stroke-width=".07"/>`;
    const ew=sleeveW(16.5)/2,ec=s*Math.abs(sleeveC(16.5));
    g+=crease(`M${f(ec-ew+0.35)},16.2 Q${f(ec)},17.2 ${f(ec+ew-0.35)},16.1`);}
  // cuffs: band with one button
  for(const s of [-1,1]){const side=s<0?'right':'left',y0=HEM-2.4,cx=s*Math.abs(sleeveC(y0+1)),w=sleeveW(y0+1);
    g+=`<path id="cuff-${side}" d="M${f(cx-w/2-.3)},${f(y0)} L${f(cx+w/2+.3)},${f(y0)} L${f(cx+w/2+.3)},${f(HEM+.3)} L${f(cx-w/2-.3)},${f(HEM+.3)} Z" fill="${AB}" stroke="${STROKE}" stroke-width=".07"/>`
      +btn(cx+(s<0?-1:1)*0.0,y0+1.2,0.2);}
  // placket + buttons
  g+=`<path id="placket" d="M-0.95,${APEX} L0.95,${APEX} L0.95,${HEM} L-0.95,${HEM} Z" fill="${AB}" stroke="${STROKE}" stroke-width=".07"/>`
    +stitch(`M-0.72,${APEX+0.3} V${HEM-0.15} M0.72,${APEX+0.3} V${HEM-0.15}`)+stitch(`M${f(-7.6)},${f(HEM-0.9)} H${f(7.6)}`);
  // front and pocket-flap buttons are hidden (fly front; flap buttons sit under the flaps), so none are drawn
  // pockets (upper pair and lower pair): body + flap + button; wearer's right = -x
  const pocket=(id,cx,top,w,h,fh,sign)=>{const x0=cx-w/2;
    return `<g id="${id}"><rect id="${id}-body" x="${f(x0)}" y="${f(top)}" width="${w}" height="${h}" fill="${AB}" stroke="${STROKE}" stroke-width=".08"/>`
      +`<path d="M${f(x0+.4)},${f(top+fh)} V${f(top+h)} M${f(x0+w-.4)},${f(top+fh)} V${f(top+h)}" stroke="#000" stroke-opacity=".38" stroke-width=".07" fill="none"/>`   // bellows folds
      +`<rect x="${f(x0)}" y="${f(top+fh)}" width=".4" height="${f(h-fh)}" fill="#000" opacity=".12"/><rect x="${f(x0+w-.4)}" y="${f(top+fh)}" width=".4" height="${f(h-fh)}" fill="#000" opacity=".12"/>`
      +`<rect x="${f(x0-.03)}" y="${f(top+.1)}" width="${f(w+.06)}" height="${fh}" fill="#000" opacity=".2"/>`
      +`<rect id="${id}-flap" x="${f(x0-.03)}" y="${f(top)}" width="${f(w+.06)}" height="${fh}" fill="${AB}" stroke="${STROKE}" stroke-width=".08"/>`
      +`</g>`;};
  for(const s of [-1,1]){const side=s<0?'right':'left';
    g+=pocket('chest-pocket-'+side,s*PK.cx,PK.top,PK.w,PK.h,PK.flapH)+pocket('lower-pocket-'+side,s*LP.cx,LP.top,LP.w,LP.h,LP.flapH);}
  // collar leaves + grade-insignia slots (own group `collar-front`; see collar.js)
  g+=COLLAR.svg;
  g+=`</g></g>`;
  // tapes: dark blue, light silver lettering is added by the builder; blank here
  const tape=(x,id,label)=>`<g id="${id}"><rect x="${f(x-TAPEA.w/2)}" y="${f(TAPEA.y)}" width="${TAPEA.w}" height="${TAPEA.h}" fill="${DK}"/><title>${label}</title></g>`;
  g+=tape(-PK.cx,'name-tape','Last-name tape (blank): above the wearer\'s right upper pocket')+tape(PK.cx,'cap-tape','Civil Air Patrol tape: above the wearer\'s left upper pocket');
  g+=`<g id="cap-tape-lettering">${lettering('CIVIL AIR PATROL',PK.cx,TAPEA.y+TAPEA.h/2,0.58,'#d8dbe0',0.06,TAPEA.w*0.87)}</g>`;
  return g;}
var SEAM_Y=3.2;   // shoulder-seam height at the sleeve centreline (read off the cap profile)

// ---------- sleeve views beside the coat (Doran layout, same as the OCP coat): flat full-size sleeves ----------
// The CFU has no Velcro and no default patches; the zones below are invisible landmarks so the builder knows where sew-on items go.
const SVX=Math.max(...OUT.outline.map(p=>Math.abs(p[0])))+0.9+2.95,SVTOP=1.2;
function sleeveFlat(s){
  const tag=s<0?'right':'left',cx=s*SVX,top=SVTOP;
  const T=[[2.8,5.8],[12,6.3],[16.5,5.7],[HEM-2.4,4.7],[HEM,4.5]],pwid=y=>{for(let i=0;i<T.length-1;i++)if(y<=T[i+1][0])return T[i][1]+(T[i+1][1]-T[i][1])*(y-T[i][0])/(T[i+1][0]-T[i][0]);return T[T.length-1][1];};
  const ys=[];for(let y=2.8;y<HEM;y+=0.5)ys.push(y);ys.push(HEM);
  const Rt=ys.map(y=>[cx+pwid(y)/2,top+y-2.8]),Lt=ys.map(y=>[cx-pwid(y)/2,top+y-2.8]).reverse();
  const sd=`M${f(Lt[Lt.length-1][0])},${f(top)} Q${f(cx)},${f(top-1.0)} ${f(Rt[0][0])},${f(top)} `+Rt.map(q=>'L'+f(q[0])+','+f(q[1])).join(' ')+' '+Lt.map(q=>'L'+f(q[0])+','+f(q[1])).join(' ')+' Z';
  const cuffTop=top+HEM-2.8-2.4,zone=(id,x,y,w,h,t)=>`<rect id="${id}" x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="#000" fill-opacity="0"><title>${t}</title></rect>`;
  let g=`<g id="sleeve-view-${tag}"><clipPath id="clip-sv-${tag}"><path d="${sd}"/></clipPath><path id="sleeve-view-body-${tag}" d="${sd}" fill="${AB}" stroke="${STROKE}" stroke-width=".09" stroke-linejoin="round"/>`
    +`<g clip-path="url(#clip-sv-${tag})"><path d="${sd}" fill="url(#shadeBox)"/>`
    +crease(`M${f(cx-pwid(16.5)/2+0.4)},${f(top+16.2-2.8)} Q${f(cx)},${f(top+17.2-2.8)} ${f(cx+pwid(16.5)/2-0.4)},${f(top+16.1-2.8)}`)
    +`<rect id="cuff-flat-${tag}" x="${f(cx-pwid(HEM)/2-.3)}" y="${f(cuffTop)}" width="${f(pwid(HEM)+.6)}" height="2.4" fill="${AB}" stroke="${STROKE}" stroke-width=".07"/>`+btn(cx,cuffTop+1.2,0.2)+`<rect id="cuff-tab-${tag}" x="${f(s>0?cx+pwid(HEM)/2-0.9:cx-pwid(HEM)/2)}" y="${f(cuffTop)}" width="0.9" height="2.4" fill="${AB}" stroke="${STROKE}" stroke-width=".07"/>`+btn(s>0?cx+pwid(HEM)/2-0.45:cx-pwid(HEM)/2+0.45,cuffTop+1.2,0.15)+`</g>`;
  if(tag==='left'){const wp=3.0;g+=zone('wing-patch-zone',cx-wp/2,top+0.5,wp,2.95,'Wing / region / national patch, sewn 1/2 in below the shoulder seam (5.2.1.1.2.2); blank placement zone');}
  if(tag==='right'){const wp=3.0;g+=zone('activity-patch-zone',cx-wp/2,top+0.5,wp,3.0,'Special activity patch, sewn 1/2 in below the shoulder seam (5.2.1.1.2.3); blank placement zone');}
  const wc=4.0;g+=zone('chevron-zone-'+tag,cx-wc/2,top+(16.5-2.8)/2-3.385,wc,6.77,'NCO grade chevrons centred halfway between shoulder seam and elbow (5.2.1.1.1.3); blank placement zone');
  return g+'</g>';}

// ---------- write (convention) ----------
const here=__dirname,OUTDIR=path.join(here,'..','assets','garments'),U=100;fs.mkdirSync(OUTDIR,{recursive:true});
const esc=x=>String(x).replace(/&/g,'&amp;').replace(/</g,'&lt;');
const nsIds=(svg,prefix)=>{const ids=new Set([...svg.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]));
  return svg.replace(/(\sid=")([^"]+)(")/g,(m,a,id,c)=>a+prefix+'__'+id+c).replace(/url\(#([^)]+)\)/g,(m,id)=>ids.has(id)?`url(#${prefix}__${id})`:m);};
const attrsOf=t=>Object.fromEntries([...t.matchAll(/([\w:-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));
function el(svg,id){const m=svg.match(new RegExp(`<(rect|path|g|circle)\\s[^>]*\\bid="${id}"[^>]*>`));return m?{tag:m[1],at:attrsOf(m[0]),end:m.index+m[0].length}:null;}
function lmRect(svg,id,vb){const e=el(svg,id);if(!e)return null;let at=e.at;if(e.tag==='g'){const r=svg.slice(e.end).match(/<(rect|circle)\s[^>]*>/);at=attrsOf(r[0]);
    if(r[1]==='circle')return {x:+((+at.cx-at.r-vb.x)*U).toFixed(2),y:+((+at.cy-at.r-vb.y)*U).toFixed(2),w:+(2*at.r*U).toFixed(2),h:+(2*at.r*U).toFixed(2)};}
  return {x:+((+at.x-vb.x)*U).toFixed(2),y:+((+at.y-vb.y)*U).toFixed(2),w:+(at.width*U).toFixed(2),h:+(at.height*U).toFixed(2)};}
function lmPoly(svg,id,vb){const e=el(svg,id);if(!e)return null;const n=e.at.d.match(/-?\d*\.?\d+/g).map(Number),p=[];for(let i=0;i+1<n.length;i+=2)p.push([+((n[i]-vb.x)*U).toFixed(2),+((n[i+1]-vb.y)*U).toFixed(2)]);return p;}
const lmCen=r=>[+(r.x+r.w/2).toFixed(2),+(r.y+r.h/2).toFixed(2)];
const DEFS2=DEFS_ABU;
function conv({id,name,vb,body,source,meta}){const W=vb.w,H=vb.h,Wu=+(W*U).toFixed(2),Hu=+(H*U).toFixed(2);
  const art=`<g id="art" transform="translate(${f(-vb.x*U)} ${f(-vb.y*U)}) scale(${U})">${body}</g>`;
  const m={asset_id:id,name,size_in:{w:+W.toFixed(4),h:+H.toFixed(4)},units:'1 user unit = 0.01 in',viewBox:[0,0,Wu,Hu],...meta};
  let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W.toFixed(4)}in" height="${H.toFixed(4)}in" viewBox="0 0 ${Wu} ${Hu}" data-asset-id="${id}" data-source="${source}" data-units="0.01in"><title>${esc(name)}</title><metadata>${esc(JSON.stringify(m))}</metadata>${DEFS2}${art}</svg>`;
  svg=nsIds(svg,id);fs.writeFileSync(path.join(OUTDIR,id+'.svg'),svg);fs.writeFileSync(path.join(OUTDIR,id+'.spec.json'),JSON.stringify(m,null,1));return svg;}
const std=(W,H)=>({top_center:[W/2,0],bottom_center:[W/2,H],center:[W/2,H/2],left_edge:[0,H/2],right_edge:[W,H/2]});
const r2=o=>Object.fromEntries(Object.entries(o).map(([k,v])=>[k,v.map(n=>+(+n).toFixed(2))]));

const maxX=Math.max(...OUT.outline.map(p=>Math.abs(p[0])));
const HATS=require('./hats.js');
// two hat rows so the image stays close to square: patrol cap + baseball cap, with the Blue Boonie Hat in a row above them
const ROW1=HATS.hatRow({yBottom:-1.5,fill:AB,ballFill:AB,ballTape:{w:TAPEA.w,h:TAPEA.h},only:['patrol-front','patrol-back','ball-front','ball-back']}),
  ROW2=HATS.hatRow({yBottom:ROW1.top-0.5,fill:AB,boonieFill:AB,only:['boonie-front','boonie-back'],gap:1.4}),
  HATROW={svg:ROW1.svg+ROW2.svg,items:{...ROW1.items,...ROW2.items},top:Math.min(ROW1.top,ROW2.top),left:Math.min(ROW1.left,ROW2.left),right:Math.max(ROW1.right,ROW2.right)};
const vbHX=Math.max(SVX+3.2+0.3,HATROW.right+0.4,-HATROW.left+0.4),vbHY=HATROW.top-0.4,vbC={x:-vbHX,y:vbHY,w:2*vbHX,h:HEM+0.4-vbHY};   // image widened when the hat row is wider than the coat + sleeves
const coatBody=HATROW.svg+abuGarment()+sleeveFlat(-1)+sleeveFlat(1),LMc={};
{const R=(k,id)=>{const r=lmRect(coatBody,id,vbC);if(r)LMc[k]=r;},Pg=(k,id)=>{const p=lmPoly(coatBody,id,vbC);if(p)LMc[k]=p;};
 R('name_tape','name-tape');R('cap_tape','cap-tape');
 for(const t of ['right','left']){R('chest_pocket_'+t,'chest-pocket-'+t+'-body');R('chest_flap_'+t,'chest-pocket-'+t+'-flap');R('lower_pocket_'+t,'lower-pocket-'+t+'-body');R('lower_flap_'+t,'lower-pocket-'+t+'-flap');
   Pg('cuff_'+t,'cuff-'+t);}
 Pg('placket','placket');for(const t of ['right','left']){R('collar_officer_zone_'+t,'collar-officer-zone-'+t);R('collar_cadet_officer_zone_'+t,'collar-cadet-officer-zone-'+t);R('collar_cadet_nco_zone_'+t,'collar-cadet-nco-zone-'+t);}R('wing_patch_zone_left','wing-patch-zone');R('activity_patch_zone_right','activity-patch-zone');R('chevron_zone_right','chevron-zone-right');R('chevron_zone_left','chevron-zone-left');}
// ---- headgear row (patrol cap + baseball cap, front and back) above the base image
{const U2=100,r2=v=>+v.toFixed(2),box=(b,vb)=>({x:r2((b.x-vb.x)*U2),y:r2((b.y-vb.y)*U2),w:r2(b.w*U2),h:r2(b.h*U2)});
 const names={'patrol-front':'patrol_cap_front','patrol-back':'patrol_cap_back','ball-front':'baseball_cap_front','ball-back':'baseball_cap_back','boonie-front':'boonie_hat_front','boonie-back':'boonie_hat_back'};
 for(const [k,it] of Object.entries(HATROW.items)){LMc[names[k]]=box(it,vbC);if(it.insignia)LMc[names[k]+'_insignia_zone']=box(it.insignia,vbC);if(it.name_tape)LMc[names[k]+'_name_tape']=box(it.name_tape,vbC);}}
const COLLAR_SLOTS=Object.assign(require('./collar-notch.js').slotsToUnits(COLLAR.slots,vbC),{note:'angle_deg: SVG rotate() convention (clockwise positive) to apply to an insignia whose long axis is vertical. cadet_* slots: cadet officer grade / cadet NCO metal chevron, centred 1 in from the collar FRONT edge, long axis parallel to it (cadet_axis = two points along that axis). officer_*: officer grade, centred 1 in from the collar BOTTOM edge, long axis perpendicular to it. size_in.along is measured along the long axis. bbox is the axis-aligned box of the rotated slot, also exposed as landmarks collar_*_zone_*. Right/left = wearer\'s.'});
const Ac=std(vbC.w*U,vbC.h*U);
Object.assign(Ac,{collar_apex:[-vbC.x*U,(APEX-vbC.y)*U],hem_center:[-vbC.x*U,(HEM-vbC.y)*U],
  name_tape_top_center:[LMc.name_tape.x+LMc.name_tape.w/2,LMc.name_tape.y],cap_tape_top_center:[LMc.cap_tape.x+LMc.cap_tape.w/2,LMc.cap_tape.y],
  chest_pocket_right_center:lmCen(LMc.chest_pocket_right),chest_pocket_left_center:lmCen(LMc.chest_pocket_left),
  chest_flap_left_bottom_center:[LMc.chest_flap_left.x+LMc.chest_flap_left.w/2,LMc.chest_flap_left.y+LMc.chest_flap_left.h],
  chest_flap_right_bottom_center:[LMc.chest_flap_right.x+LMc.chest_flap_right.w/2,LMc.chest_flap_right.y+LMc.chest_flap_right.h]});
const coatId='garment-cfu-coat';
conv({id:coatId,name:'Corporate Field Uniform coat (dark blue, BDU style) with blank name tape',vb:vbC,body:coatBody,source:'reference-art-measured',
  meta:{size_source:'estimated',size_basis:`Outline traced from images/base/ABU_male.webp (581x719 px) at ${OUT.scale} in/px, chosen so the coat is ${OUT.heightIn} in long. No real garment was measured. Body basis only: MIL-DTL-44048H (BDU-style combat coat) gives the same body (Medium Regular half chest 24-1/4 in, back length about 29-3/8 to 29-1/2 in, Large about 30 in), so the 29.96 in length is consistent with a Large Regular; that spec has no pocket sizes in its text, so pocket, tape and button sizes remain estimates. Sleeve cap/width widened by script (same as the OCP coat).`,
    anchors:r2(Ac),collar_slots:COLLAR_SLOTS,landmarks:LMc,landmarks_note:'rects are {x,y,w,h}; polygons are [[x,y]...]; user units (0.01 in), origin top-left of the artwork box. Right/left = wearer\'s.',
    dimensions:{coat_length_in:+HEM.toFixed(2),max_width_in:+(2*maxX).toFixed(2),chest_pocket_in:[PK.w,PK.h],chest_flap_in:[PK.w,PK.flapH],lower_pocket_in:[LP.w,LP.h],tape_in:[TAPEA.w,TAPEA.h]},
    documented:['Blue Field Cap (patrol design), CAP baseball / navy tactical cap and Blue Boonie Hat may be worn (CAPR 39-1 5.2.1.2.3, 6.2.9, 6.2.10); boonie headgear insignia as for the Blue Field Cap','button front, hip length (CAPR 39-1 5.2.1.1: single-breasted, four bellows pockets with flaps, straight-cut sleeve tabs)','last-name tape above wearer\'s right upper pocket, CAP tape above left, folded to pocket width, silver on dark blue (5.2.1.1.2.1)','badges 1/2 in above the CAP tape (5.2.1.1.2.6)'],
    assumed:['boonie hat size (crown ~7.4 in, brim 2 in all round, ~11.2 in overall) and shape','px-to-inch scale','pocket sizes/positions (measured off the ABU raster, then scaled)','button count and spacing','lower pocket size','fabric colour is an estimate (solid dark blue)','all headgear sizes and shapes (patrol cap ~7.8 in wide, baseball cap ~7.6 in wide; head circumference taken as ~22.5 in)'],
    fit:{method:'n/a',score:null},grade:'garment'}});
// preview
const sq=(inner,vb,name,px)=>{const cx=vb.x+vb.w/2,cy=vb.y+vb.h/2,s=Math.max(vb.w,vb.h);
  const x=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${cx-s/2} ${cy-s/2} ${s} ${s}" width="${px}" height="${px}">${DEFS2}${inner}</svg>`;
  const tmp=path.join(here,name+'.sq.svg');fs.writeFileSync(tmp,x);
  require('child_process').execSync(`qlmanage -t -s ${px} -o "${here}" "${tmp}" >/dev/null 2>&1 && mv "${tmp}.png" "${path.join(here,name+'_preview.png')}" && rm "${tmp}"`);};
sq(coatBody,vbC,'cfu_top',1400);
console.log('ok cfu');
