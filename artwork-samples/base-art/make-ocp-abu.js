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
// ---------- pattern ----------
// Procedural Scorpion-W2-like print. Palette and area shares were measured from CAP's OCP illustration (CAPR 39-1 fig 7.1.1.4.1):
// tan 28%, khaki-olive 28.5%, dark olive 24.5%, brown 13%, cream 4.7%, black 1%. Blobs are large and lobed; brown also appears as branching strands.
const PAL={tan:'#b7a686',khaki:'#96885d',olive:'#6b6040',brown:'#513d2d',cream:'#d0cbb9',black:'#23211d'};
const f=n=>(+n).toFixed(3),STROKE='#2c271c';
let seed=20251;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
const TILE=26;
const smoothPath=pts=>{const n=pts.length,mid=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2];let d='';
  for(let i=0;i<n;i++){const p0=pts[i],m0=mid(pts[(i+n-1)%n],p0),m1=mid(p0,pts[(i+1)%n]);d+=(i?'':`M${f(m0[0])},${f(m0[1])}`)+`Q${f(p0[0])},${f(p0[1])} ${f(m1[0])},${f(m1[1])}`;}return d+'Z';};
function lobed(R,asp,rough){const n=22,ph=[0,0,1,2,3,4,5].map(()=>rnd()*6.283),am=[0,0,.30,.24,.17,.11,.07].map(v=>v*rough),rot=rnd()*Math.PI,c=Math.cos(rot),s=Math.sin(rot),pts=[];
  for(let i=0;i<n;i++){const t=i/n*6.283;let r=1;for(let k=2;k<7;k++)r+=am[k]*Math.sin(k*t+ph[k]);r*=R;const x=Math.cos(t)*r*asp,y=Math.sin(t)*r;pts.push([x*c-y*s,x*s+y*c]);}return pts;}
const wrapCopies=(d,cx,cy,m)=>{let o='';const xs=[0],ys=[0];if(cx<m)xs.push(TILE);if(cx>TILE-m)xs.push(-TILE);if(cy<m)ys.push(TILE);if(cy>TILE-m)ys.push(-TILE);
  for(const ox of xs)for(const oy of ys)o+=d(ox,oy);return o;};
function blobLayer(color,count,rmin,rmax,aspMin,aspMax,rough){let out='';
  for(let i=0;i<count;i++){const cx=rnd()*TILE,cy=rnd()*TILE,R=rmin+rnd()*(rmax-rmin),asp=aspMin+rnd()*(aspMax-aspMin),pts=lobed(R,asp,rough).map(p=>[p[0]+cx,p[1]+cy]),d=smoothPath(pts);
    out+=wrapCopies((ox,oy)=>`<path d="${d}"${ox||oy?` transform="translate(${ox} ${oy})"`:''} fill="${color}"/>`,cx,cy,R*asp*1.8);}return out;}
function strandLayer(color,count,lmin,lmax,wmin,wmax){let out='';
  for(let i=0;i<count;i++){let x=rnd()*TILE,y=rnd()*TILE,th=rnd()*6.283;const n=lmin+Math.floor(rnd()*(lmax-lmin)),step=0.2,w=wmin+rnd()*(wmax-wmin),pts=[[x,y]];
    for(let k=0;k<n;k++){th+=(rnd()-0.5)*0.7;x+=Math.cos(th)*step;y+=Math.sin(th)*step;pts.push([x,y]);}
    const d='M'+pts.map(p=>f(p[0])+','+f(p[1])).join('L');
    out+=wrapCopies((ox,oy)=>`<path d="${d}"${ox||oy?` transform="translate(${ox} ${oy})"`:''} fill="none" stroke="${color}" stroke-width="${f(w)}" stroke-linecap="round" stroke-linejoin="round"/>`,x,y,n*step);}return out;}
const DEFS=`<defs><pattern id="ocp" patternUnits="userSpaceOnUse" width="${TILE}" height="${TILE}"><rect width="${TILE}" height="${TILE}" fill="${PAL.tan}"/>`
 +blobLayer(PAL.khaki,70,0.75,1.65,1.1,2.0,1.0)
 +blobLayer(PAL.olive,90,0.42,1.0,1.1,2.2,1.1)
 +strandLayer(PAL.olive,16,4,9,0.18,0.34)
 +blobLayer(PAL.brown,80,0.24,0.62,1.2,2.4,1.2)
 +strandLayer(PAL.brown,30,4,10,0.16,0.32)
 +blobLayer(PAL.cream,46,0.16,0.4,1.3,2.8,1.0)
 +blobLayer(PAL.black,26,0.08,0.2,1.2,2.2,0.9)
 +`</pattern>
<linearGradient id="shadeX" gradientUnits="userSpaceOnUse" x1="-10.4" y1="0" x2="10.4" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".34"/><stop offset=".1" stop-color="#000" stop-opacity=".12"/><stop offset=".28" stop-color="#000" stop-opacity="0"/><stop offset=".72" stop-color="#000" stop-opacity="0"/><stop offset=".9" stop-color="#000" stop-opacity=".12"/><stop offset="1" stop-color="#000" stop-opacity=".34"/></linearGradient>
<linearGradient id="shadeBox" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".32"/><stop offset=".22" stop-color="#000" stop-opacity=".06"/><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset=".78" stop-color="#000" stop-opacity=".06"/><stop offset="1" stop-color="#000" stop-opacity=".32"/></linearGradient>
<linearGradient id="shoulderLight" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
</defs>`;
// ---------- helpers ----------
const D=DIM,mx=s=>(x,y)=>`${f(s*x)},${f(y)}`;
const loop=(d,id)=>`<path ${id?`id="${id}" `:''}d="${d}" fill="#b29c76" stroke="${STROKE}" stroke-width=".06"/>`;
const stitch=d=>'';   // topstitching removed on request
const crease=d=>`<path d="${d}" fill="none" stroke="#000" stroke-opacity=".10" stroke-width=".11" stroke-linecap="round"/>`;
const GLY=JSON.parse(fs.readFileSync(path.join(__dirname,'..','assets','tools','glyphs_arialbold_cap.json')));
// outlined lettering (no <text>): centred on (cx,cy), cap height capH in, tracking in em
const lettering=(str,cx,cy,capH,fill,track=0.06,fitW=null)=>{const k=capH/71.58,ch=[...str],adv=ch.map(c=>c===' '?0.28*100:GLY[c].adv);
  const tw=adv.reduce((a,v)=>a+v,0)+track*100*(ch.length-1),kx=fitW?fitW/tw:k;let x=0,d='';
  ch.forEach((c,i)=>{if(c!==' ')d+=`<path transform="translate(${f(x)} 0)" d="${GLY[c].d}"/>`;x+=adv[i]+track*100;});
  return `<g fill="${fill}" transform="translate(${f(cx-tw*kx/2)} ${f(cy+capH/2)}) scale(${kx.toFixed(5)} ${k.toFixed(5)})">${d}</g>`;};
const starPts=(cx,cy,r)=>Array.from({length:10},(_,i)=>{const a=-Math.PI/2+i*Math.PI/5,rr=i%2?r*0.382:r;return f(cx+rr*Math.cos(a))+','+f(cy+rr*Math.sin(a));}).join(' ');
// full-colour reversed US flag patch (canton at the right), top-left at (x,y), size w x h in
const flagPatch=(id,X,Y,W,H)=>{const bd=0.1,x=X+bd,y=Y+bd,w=W-2*bd,h=H-2*bd,sh=h/13,cw=0.4*w,ch=sh*7;
  let g=`<g id="${id}"><rect x="${f(X)}" y="${f(Y)}" width="${W}" height="${H}" fill="#c9a227"/>`   // gold merrowed border, inside the overall patch size
    +`<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="#ffffff"/>`;
  for(let i=0;i<13;i+=2)g+=`<rect x="${f(x)}" y="${f(y+i*sh)}" width="${f(w)}" height="${f(sh)}" fill="#b22234"/>`;
  g+=`<rect x="${f(x+w-cw)}" y="${f(y)}" width="${f(cw)}" height="${f(ch)}" fill="#3c3b6e"/>`;
  const px=cw/12,py=ch/10,r=Math.min(px,py)*0.42;
  for(let row=0;row<9;row++)for(let c=0;c<(row%2?5:6);c++){const sx=x+w-cw+px*(row%2?2+2*c:1+2*c),sy=y+py*(row+1);g+=`<polygon points="${starPts(sx,sy,r)}" fill="#fff"/>`;}
  return g+`<rect x="${f(X)}" y="${f(Y)}" width="${W}" height="${H}" fill="none" stroke="#1a1a1a" stroke-opacity=".6" stroke-width=".05"/></g>`;};
// AUX duty-identifier patch: OCP-pattern field, spice-brown letters and border (DAFI 5.1.6.2.3 colour scheme)
const auxPatch=(id,x,y,w,h)=>`<g id="${id}"><rect x="${f(x)}" y="${f(y)}" width="${w}" height="${h}" rx=".06" fill="#142347"/>`
  +lettering('AUX',x+w/2,y+h/2,h*0.62,'#e4e6ea',0.14,w*0.62)
  +`<rect x="${f(x)}" y="${f(y)}" width="${w}" height="${h}" rx=".06" fill="none" stroke="#1a1a1a" stroke-opacity=".6" stroke-width=".05"/></g>`;
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
// Torso widened so the Army-spec chest pocket (6-3/4 in wide) sits between the placket and the sleeve seam: points inboard of the
// armhole seam are scaled by TK about the centreline, sleeve points shift outward by the same amount. TK is an estimate (see spec).
// shoulders sloped down toward the sleeve cap (less flat): points outboard of the neck drop by up to SHD in, fading out by y=6.5
const SHD=1.4,shy=(ax,y)=>{const w=Math.min(1,Math.max(0,(ax-4.0)/(8.9-4.0))),sm=w*w*(3-2*w),fy=Math.min(1,Math.max(0,(6.5-y)/(6.5-2.9)));return y+SHD*sm*fy;};
const TK=1.2;
{const seamS=y=>{const a=SEAM0;for(let i=0;i<a.length-1;i++)if(y>=a[i][1]&&y<=a[i+1][1])return a[i][0]+(a[i+1][0]-a[i][0])*(y-a[i][1])/(a[i+1][1]-a[i][1]||1);return a[a.length-1][0];};
 const X0=4.2,tw=p=>{const ax=Math.abs(p[0]),sx=-seamS(p[1]);return [Math.sign(p[0]||1)*(ax<=X0?ax:ax<=sx?X0+(ax-X0)*(sx*TK-X0)/(sx-X0):ax+(TK-1)*sx),shy(ax,p[1])];};   // neck/collar area (|x|<4.2) is not stretched
 OUT.outline=OUT.outline.map(tw);OUT.holes=OUT.holes.map(h=>h.map(tw));}
const poly=a=>'M'+a.map(p=>f(p[0])+','+f(p[1])).join('L')+'Z';
const SIL=poly(OUT.outline)+OUT.holes.map(poly).join('');
const lerpAt=(arr,y)=>{for(let i=0;i<arr.length-1;i++){const[a,b]=[arr[i],arr[i+1]];if(y>=a[1]&&y<=b[1])return a[0]+(b[0]-a[0])*(y-a[1])/((b[1]-a[1])||1);}return arr[arr.length-1][0];};
// left (-x) outer edge as a function of y, from the traced outline
const leftEdge=(()=>{const pts=OUT.outline.filter(p=>p[0]<-8.5||p[1]>2.5).filter(p=>p[0]<-4).sort((a,b)=>a[1]-b[1]);return pts;})();
const outerX=y=>{let best=0;const o=OUT.outline;for(let i=0;i<o.length;i++){const a=o[i],b=o[(i+1)%o.length];if(a[0]>-6&&b[0]>-6)continue;if((a[1]-y)*(b[1]-y)<=0&&a[1]!==b[1]){const x=a[0]+(b[0]-a[0])*(y-a[1])/(b[1]-a[1]);if(x<best)best=x;}}return best;};
const SEAM=[[-8.9,2.8],[-8.45,6],[-7.9,10],[-7.45,14.4],[-7.7,25.4],[-7.75,29.6]].map(([x,y])=>[x*TK,shy(Math.abs(x),y)]);  // armhole / sleeve-body seam (left), read from the ABU raster
const seamX=y=>lerpAt(SEAM,y);
const sleeveC=y=>(outerX(y)+seamX(y))/2, sleeveW=y=>seamX(y)-outerX(y);
const HEM=OUT.heightIn, APEX=4.9, NECK=[-4.0,1.65], TIP=[-2.75,0.22];
const PTOP=APEX;
const CPd={cx:4.9,cy:11.5,pcx:5.0,w:6.75,h:5.25,tiltDeg:17,flapW:1.5};  // GL/PD 14-04A 3.7: pocket 6-3/4 W x 5-1/4 D (M/L/XL), flap 1-1/2 W; angled down toward the placket  // tilted square: top edge rises toward the zipper
const TAPE={w:5.25,h:1.0};   // GL/PD 14-04A: name / U.S. Army tape loop 1 x 5-1/4 in; CAPR 39-1 7.1.1.2.3: CAP tapes match the hook panel removed
// rank square: halfway up the pockets (their vertical midpoint)
CPd.rankY=CPd.cy-0.7;
{const hw=CPd.w/2,hh=CPd.h/2,r=-CPd.tiltDeg,c=rot([[-hw,-hh],[hw,-hh],[hw,hh],[-hw,hh]].map(([x,y])=>[-CPd.pcx+x,CPd.cy+y]),-CPd.pcx,CPd.cy,r);
 TAPE.y=+(Math.min(...c.map(p=>p[1]))-TAPE.h-0.125).toFixed(3);}   // 1/8 in above the top corner of the flap (GL/PD 14-04A)  // sits directly on the highest point of the pocket
const PATCH={flag:{w:3.25,h:1.8125},aux:{w:3.25,h:1.8125}};  // Reaper Patches lists the AUX patch at 3.3 x 1.8 in, matching the flag size;   // DAFI 36-2903 (29 Feb 2024) 5.1.6.2.3: U.S. tactical flag patch 3-1/4 in W x 1-13/16 in H; duty-identifier height may not exceed it; AUX drawn at flag size
const SVX=Math.max(...OUT.outline.map(p=>Math.abs(p[0])))+0.9+2.95;   // sleeve views sit beside the coat
const SP={fTop:7.0,fH:6.5,pocketW:4.5,pocketH:7.25,padT:0.375,fieldW:4.0,iffW:1.0,iffH:3.25,coverH:1.875,edgeFore:0.5,panelTop:1.2},SPW=SP.fieldW;   // GL/PD 14-04B (rev B, Mar 2023): upper sleeve pocket 4-1/2 (+/-3/16) x 7-1/4 (rev A said 5), loop tape 4 x 6-1/2 inside, IFF loop 1 x 3-1/4, nylon cover 1 x 1-7/8   // regular OCP shoulder pocket per CAPR 39-1 figs 7.1.1.4.1 / 7.1.1.3.1.7: tall Velcro flap carries the patches, camo pocket body below, covered glint tab above
const COLLAR=require('./collar.js').collar({fill:'url(#ocp)',stroke:STROKE,apex:APEX});
function garment(){
  let g=`<defs><linearGradient id="innerBack" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#7d805f"/><stop offset="1" stop-color="#4f523c"/></linearGradient><linearGradient id="innerBand" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#a1a37c"/><stop offset="1" stop-color="#868966"/></linearGradient><linearGradient id="wrapR" x1="0" x2="1" y1="0" y2="0"><stop offset=".35" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".42"/></linearGradient><linearGradient id="wrapL" x1="1" x2="0" y1="0" y2="0"><stop offset=".35" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".42"/></linearGradient><clipPath id="clipSil"><path d="${SIL}" clip-rule="evenodd"/></clipPath></defs>`;
  // neck opening: tee inside a short flat collar; the ABU V below it is filled with the coat front
  // tee (crew neck) inside the V, coat front below the tee neckline, back collar band behind
  const vx=y=>TIP[0]*(1-(y-TIP[1])/(APEX-TIP[1])),NY=2.3;
  // inside of the back of the coat seen through the neck opening: the inner face of the back collar stand (lighter band) over the shadowed inside back
  g+=`<g id="collar-interior"><path d="M${f(TIP[0])},${f(TIP[1])} Q0,0.25 ${f(-TIP[0])},${f(TIP[1])} L0,${f(APEX)} Z" fill="url(#innerBack)"/>`
    +`<path d="M${f(TIP[0])},${f(TIP[1])} Q0,0.25 ${f(-TIP[0])},${f(TIP[1])}" fill="none" stroke="#000" stroke-opacity=".3" stroke-width=".08"/></g>`;
  g+=`<g id="collar-back"><path d="M${f(NECK[0])},${f(NECK[1])} Q0,-2.75 ${f(-NECK[0])},${f(NECK[1])} L${f(-TIP[0])},${f(TIP[1])} Q0,0.25 ${f(TIP[0])},${f(TIP[1])} Z" fill="url(#innerBand)" stroke="${STROKE}" stroke-width=".06"/></g>`;
  // silhouette = ABU outline, OCP pattern clipped to it
  g+=`<g id="garment-body"><path id="silhouette" d="${SIL}" fill="url(#ocp)" fill-rule="evenodd" stroke="${STROKE}" stroke-width=".09" stroke-linejoin="round"/>`
    +`<g clip-path="url(#clipSil)">`
    +`<rect x="-15" y="-1" width="30" height="32" fill="url(#shadeX12)"/>`
    +`<path d="${SIL}" fill="url(#shoulderLight)" fill-rule="evenodd"/>`;
  // sleeve / body seams + a soft shadow on the sleeve side of each seam
  for(const s of [-1,1]){
    const sp='M'+SEAM.map(p=>f(s*p[0])+','+f(p[1])).join('L');
    g+=`<path d="${sp}" fill="none" stroke="#000" stroke-opacity=".16" stroke-width=".55" stroke-linecap="round" transform="translate(${f(s*-0.18)} 0)"/>`
      +`<path id="seam-${s<0?'left':'right'}" d="${sp}" fill="none" stroke="#1d1a12" stroke-opacity=".75" stroke-width=".07"/>`;
    // elbow crease + side-seam fold lines
    const ex=s*sleeveC(16.5),ew=sleeveW(16.5)/2;
    g+=crease(`M${f(ex-ew+0.35)},16.2 Q${f(ex)},17.2 ${f(ex+ew-0.35)},16.1`);
    g+=crease(`M${f(s*3.6)},18 Q${f(s*3.2)},23 ${f(s*3.5)},28.6`);}
  // cuffs (hook-and-loop adjustable): band + seam + tab
  for(const s of [-1,1]){const y0=HEM-2.35,yc=HEM,cx=s*sleeveC(y0+1),w=sleeveW(y0+1);
    g+=`<path id="cuff-${s<0?'left':'right'}" d="M${f(cx-w/2-.3)},${f(y0)} L${f(cx+w/2+.3)},${f(y0)} L${f(cx+w/2+.3)},${f(yc+.3)} L${f(cx-w/2-.3)},${f(yc+.3)} Z" fill="url(#ocp)" stroke="${STROKE}" stroke-width=".07"/>`;}
  // shoulder pocket as seen from the front: the pocket sits on the outer face of the upper arm, so only a foreshortened strip
  // hugging the sleeve's outer edge shows. The full-size flap is drawn as a floating panel above each shoulder (see shoulderPanel).
  const LOOP='#b29c76';
  for(const s of [-1,1]){const tag=s<0?'right':'left',fTop=SP.fTop,fH=SP.fH,pbTop=fTop-SP.padT,pbH=SP.pocketH,pTop=pbTop+pbH,EF=SP.edgeFore,pw=SP.pocketW*EF,fw=SP.fieldW*EF,tw=SP.iffW*EF,ty=pbTop-SP.iffH;
    const ox=Math.abs(outerX(pbTop+pbH/2)),th=Math.atan((Math.abs(outerX(pTop))-Math.abs(outerX(pbTop)))/pbH)*180/Math.PI,
      cx=s*(ox-0.35),x0=cx-fw/2;
    g+=`<g id="sleeve-pocket-edge-${tag}" transform="rotate(${f(-s*th)} ${f(cx)} ${f(pbTop+pbH/2)})">`
      +`<rect x="${f(cx-tw/2)}" y="${f(ty)}" width="${f(tw)}" height="${SP.iffH}" fill="${LOOP}" stroke="${STROKE}" stroke-width=".06"/>`
      +`<rect x="${f(cx-tw/2)}" y="${f(ty)}" width="${f(tw)}" height="${SP.coverH}" fill="url(#ocp)" stroke="${STROKE}" stroke-width=".06"/>`
      +`<rect x="${f(cx-pw/2)}" y="${f(pbTop)}" width="${f(pw)}" height="${pbH}" fill="url(#ocp)" stroke="${STROKE}" stroke-width=".07"/>`
      +`<rect x="${f(x0)}" y="${f(fTop+0.12)}" width="${f(fw)}" height="${fH}" fill="#000" opacity=".22"/>`
      +`<rect id="sleeve-flap-edge-${tag}" x="${f(x0)}" y="${f(fTop)}" width="${f(fw)}" height="${fH}" fill="${LOOP}" stroke="${STROKE}" stroke-width=".07"/>`
      +(tag==='right'?flagPatch('patch-flag-edge-'+tag,cx-PATCH.flag.w*EF/2,fTop+0.25,PATCH.flag.w*EF,PATCH.flag.h):auxPatch('patch-aux-edge-'+tag,cx-PATCH.aux.w*EF/2,fTop+0.25,PATCH.aux.w*EF,PATCH.aux.h))
      +`<rect x="${f(cx-pw/2)}" y="${f(pbTop)}" width="${f(pw)}" height="${pbH}" fill="url(#wrap${s<0?'L':'R'})"/></g>`;}
  // front: placket with covered zipper, loop strips + tapes, tilted chest pockets, collar leaves
  // covered zipper: a plain placket flap hides the zipper completely (no teeth, slider or pull visible); edge stitching and a soft shadow on the flap edge
  g+=`<path id="placket" d="M-1,${PTOP} L1,${PTOP} L1,${HEM} L-1,${HEM} Z" fill="url(#ocp)" stroke="${STROKE}" stroke-width=".07"/>`
    +`<path d="M1,${PTOP} V${HEM}" stroke="#000" stroke-opacity=".14" stroke-width=".16" transform="translate(0.08 0)"/>`
    +stitch(`M-0.6,${PTOP+0.3} V${HEM-0.15} M0.6,${PTOP+0.3} V${HEM-0.15}`)
    +stitch(`M${f(-7.6)},${f(HEM-1.0)} H${f(7.6)}`);
  g+=`<rect id="rank-square" x="-1" y="${f(CPd.rankY-1)}" width="2" height="2" fill="#142347"><title>Grade insignia field: 2 x 2 in dark blue, blank (CAPR 39-1 7.1.1.2)</title></rect>`;
  for(const sign of [-1,1]){const tag=sign<0?'right':'left',cx=sign*CPd.pcx,cy=CPd.cy,r=sign<0?-CPd.tiltDeg:CPd.tiltDeg,hw=CPd.w/2,hh=CPd.h/2,inn=-sign;  // inn: local x toward the centre
    const loc=(pts)=>rot(pts.map(([x,y])=>[cx+x,cy+y]),cx,cy,r);
    const body=loc([[-hw,-hh],[hw,-hh],[hw,hh],[-hw,hh]]);
    const e=-inn*0;  // flap hugs the inner long edge
    const ix=sign<0?hw:-hw,fw=CPd.flapW,ox=sign<0?ix-fw:ix+fw,mid=(ix+ox)/2;
    const flap=loc([[ox,-hh],[ix,-hh],[ix,hh],[ox,hh]]);
    g+=`<path id="chest-pocket-${tag}" d="${P(body)}" fill="url(#ocp)" stroke="${STROKE}" stroke-width=".08" stroke-linejoin="round"/>`
      +`<path d="${P(flap)}" fill="#000" opacity=".2" transform="translate(${f(-sign*0.1)} .1)"/>`
      +`<path id="chest-flap-${tag}" d="${P(flap)}" fill="url(#ocp)" stroke="${STROKE}" stroke-width=".08" stroke-linejoin="round"/>`
      +`<path d="${P(loc([[mid-.08,-hh+0.5],[mid+.08,-hh+0.5],[mid+.08,-hh+1.4],[mid-.08,-hh+1.4]]))}" fill="#b29c76"/>`;}
  // collar leaves + grade-insignia slots (own group `collar-front`; see collar.js)
  g+=COLLAR.svg;
  g+=`</g></g>`;
  // sleeve views beside the coat (layout suggested by Doran): flat full-size sleeves with the Velcro pocket, patch and small Velcro patch
  for(const s of [-1,1]){const tag=s<0?'right':'left',pw=SPW,bw=pw-0.2,top=SP.panelTop,fT=top+(SP.fTop-2.8),pT=fT+SP.fH,cx=s*SVX,x0=cx-pw/2;
    const T=[[2.8,5.8],[12,6.3],[16.5,5.7],[HEM-2.4,4.7],[HEM,4.5]],pwid=y=>{for(let i=0;i<T.length-1;i++)if(y<=T[i+1][0])return T[i][1]+(T[i+1][1]-T[i][1])*(y-T[i][0])/(T[i+1][0]-T[i][0]);return T[T.length-1][1];};
    const ys=[];for(let y=2.8;y<HEM;y+=0.5)ys.push(y);ys.push(HEM);
    const Rt=ys.map(y=>[cx+pwid(y)/2,top+y-2.8]),Lt=ys.map(y=>[cx-pwid(y)/2,top+y-2.8]).reverse();
    const sd=`M${f(Lt[Lt.length-1][0])},${f(top)} Q${f(cx)},${f(top-1.0)} ${f(Rt[0][0])},${f(top)} `+Rt.map(q=>'L'+f(q[0])+','+f(q[1])).join(' ')+' '+Lt.map(q=>'L'+f(q[0])+','+f(q[1])).join(' ')+' Z';
    g+=`<g id="sleeve-view-${tag}"><clipPath id="clip-sv-${tag}"><path d="${sd}"/></clipPath><path id="sleeve-view-body-${tag}" d="${sd}" fill="url(#ocp)" stroke="${STROKE}" stroke-width=".09" stroke-linejoin="round"/>`
      +`<g clip-path="url(#clip-sv-${tag})"><path d="${sd}" fill="url(#shadeBox)"/><rect x="${f(cx-pwid(HEM)/2-.3)}" y="${f(top+HEM-2.8-2.35)}" width="${f(pwid(HEM)+.6)}" height="2.35" fill="url(#ocp)" stroke="${STROKE}" stroke-width=".07"/></g></g>`;
    const pbTop2=fT-SP.padT,tyF=pbTop2-SP.iffH;
    g+=`<g id="sleeve-pocket-${tag}"><title>Upper sleeve pocket, full size 4-1/2 x 7-1/4 in with 4 x 6-1/2 in loop tape (GL/PD 14-04B 3.7), ${tag} sleeve</title>`
      +`<rect id="sleeve-pocket-body-${tag}" x="${f(cx-SP.pocketW/2)}" y="${f(pbTop2)}" width="${SP.pocketW}" height="${SP.pocketH}" fill="url(#ocp)" stroke="${STROKE}" stroke-width=".07"/>`
      +`<rect id="glint-tab-${tag}" x="${f(cx-SP.iffW/2)}" y="${f(tyF)}" width="${SP.iffW}" height="${SP.iffH}" fill="${LOOP}" stroke="${STROKE}" stroke-width=".06"><title>IFF loop patch 1 x 3-1/4 in above the sleeve pocket (graduated commander's insignia); the top 1-7/8 in is the nylon cover over the glint square</title></rect>`
      +`<rect x="${f(cx-SP.iffW/2)}" y="${f(tyF)}" width="${SP.iffW}" height="${SP.coverH}" fill="url(#ocp)" stroke="${STROKE}" stroke-width=".06"/>`
      +`<rect x="${f(x0)}" y="${f(fT+0.12)}" width="${f(pw)}" height="${SP.fH}" fill="#000" opacity=".22"/>`
      +`<rect id="sleeve-flap-${tag}" x="${f(x0)}" y="${f(fT)}" width="${f(pw)}" height="${SP.fH}" fill="${LOOP}" stroke="${STROKE}" stroke-width=".07"/>`;
    // patch slots every OCP wearer has (sizes ESTIMATED; CAPR 39-1 7.1.1.4 gives positions): wearer's right = US flag; wearer's left = AUX duty identifier over the Civil Air Patrol patch
    const vt=fT+0.25;
    g+=(tag==='right'?flagPatch('patch-flag-'+tag,cx-PATCH.flag.w/2,vt,PATCH.flag.w,PATCH.flag.h)
      :auxPatch('patch-aux-'+tag,cx-PATCH.aux.w/2,vt,PATCH.aux.w,PATCH.aux.h))+`</g>`;}
  // blank tapes (light silver on dark blue)
  const tape=(x,id,label)=>`<g id="${id}"><rect x="${f(x-TAPE.w/2)}" y="${TAPE.y}" width="${TAPE.w}" height="${TAPE.h}" fill="#142347"/><title>${label}</title></g>`;
  g+=tape(-CPd.pcx,'name-tape','Name tape (blank): light silver on dark blue')+tape(CPd.pcx,'cap-tape','CAP tape: light silver on dark blue');
  g+=`<g id="cap-tape-lettering">${lettering('CIVIL AIR PATROL',CPd.pcx,TAPE.y+TAPE.h/2,0.58,'#d8dbe0',0.06,TAPE.w*0.87)}</g>`;
  return g;}

// ---------- sleeve views: flat sleeve with the Velcro pocket + flap and the CAPR 39-1 patch slots ----------
// origin: cap top-centre of the sleeve; y down. Patch slot sizes are ESTIMATED (the regs give positions, not sizes).
const SLOT={flag:{w:3.0,h:2.0},unit:{w:3.0,h:2.8},aux:{w:3.0,h:1.1},hhq:{w:3.0,h:2.8}};
function sleevePanel(tag){
  const left=tag==='left',Y0=2.8,ys=[],CAPW=5.8,pwid=y=>{const T=[[Y0,CAPW],[12,6.3],[16.5,5.7],[HEM-2.4,4.7],[HEM,4.5]];for(let i=0;i<T.length-1;i++)if(y<=T[i+1][0])return T[i][1]+(T[i+1][1]-T[i][1])*(y-T[i][0])/(T[i+1][0]-T[i][0]);return T[T.length-1][1];};for(let y=Y0;y<HEM;y+=0.5)ys.push(y);ys.push(HEM);
  const R=ys.map(y=>[pwid(y)/2,y-Y0]),L=ys.map(y=>[-pwid(y)/2,y-Y0]).reverse();
  const outline=`M${f(L[L.length-1][0])},0 Q0,-0.8 ${f(R[0][0])},0 `+R.map(p=>'L'+f(p[0])+','+f(p[1])).join(' ')+' '+L.map(p=>'L'+f(p[0])+','+f(p[1])).join(' ')+' Z';
  const fT=SP.fTop-Y0,pT=fT+SP.fH,pw=SPW,x0=-pw/2,ins=0.2,LOOP='#b29c76',vt=fT+ins,vb=pT-ins,vh=vb-vt,vw=pw-2*ins;
  let g=`<g id="sleeve-view-${tag}"><clipPath id="clip-panel-${tag}"><path d="${outline}"/></clipPath>`
    +`<path id="panel-${tag}" d="${outline}" fill="url(#ocp)" stroke="${STROKE}" stroke-width=".09" stroke-linejoin="round"/>`
    +`<g clip-path="url(#clip-panel-${tag})"><path d="${outline}" fill="url(#shadeBox)"/>`
    +crease(`M${f(-pwid(16.5)/2+0.4)},${f(16.2-Y0)} Q0,${f(17.2-Y0)} ${f(pwid(16.5)/2-0.4)},${f(16.1-Y0)}`)
    +`<rect x="${f(-pwid(HEM)/2-.3)}" y="${f(HEM-2.35-Y0)}" width="${f(pwid(HEM)+.6)}" height="2.35" fill="url(#ocp)" stroke="${STROKE}" stroke-width=".07"/>`
    +`<rect x="-0.75" y="${f(HEM-2.0-Y0)}" width="1.5" height=".95" fill="${LOOP}" stroke="${STROKE}" stroke-width=".04"/></g>`
    +`<g id="pocket-${tag}"><rect id="glint-tab-${tag}" x="${f(-SP.tab.w/2)}" y="${f(fT-SP.tab.h+0.1)}" width="${SP.tab.w}" height="${SP.tab.h}" fill="url(#ocp)" stroke="${STROKE}" stroke-width=".06"/>`
    +`<rect x="${f(-(pw-0.4)/2)}" y="${f(pT-0.1)}" width="${f(pw-0.4)}" height="${SP.pH}" fill="url(#ocp)" stroke="${STROKE}" stroke-width=".07"/>`
    +`<rect x="${f(x0)}" y="${f(fT+0.12)}" width="${f(pw)}" height="${SP.fH}" fill="#000" opacity=".22"/>`
    +`<rect id="velcro-flap-${tag}" x="${f(x0)}" y="${f(fT)}" width="${f(pw)}" height="${SP.fH}" fill="${LOOP}" stroke="${STROKE}" stroke-width=".07"/></g>`;
  // patch slots, positioned per CAPR 39-1 7.1.1.4: top item centred at the top of the Velcro, second item centred in the middle of the Velcro area
  const slot=(id,w0,h,cy,title)=>{const w=Math.min(w0,vw-0.2);return `<rect id="${id}" x="${f(-w/2)}" y="${f(cy-h/2)}" width="${w}" height="${h}" fill="none" stroke="#101b3a" stroke-width=".07" stroke-dasharray=".25 .15"><title>${title}</title></rect>`;};
  const top=left?SLOT.aux:SLOT.flag,second=left?SLOT.hhq:SLOT.unit,midY=vt+vh/2;
  g+=slot(`slot-top-${tag}`,top.w,top.h,vt+top.h/2,left?'AUX duty identifier (mandatory, top position)':'US flag, reversed, full color (mandatory, top of Velcro)')
    +slot(`slot-second-${tag}`,second.w,second.h,vt+top.h+0.25+(vb-(vt+top.h+0.25))/2,left?'Wing / region / CAP command patch (HHQ)':'Unit of assignment patch (centred in the Velcro area under the flag)');
  if(left){const w=0.62,gap=0.16,tot=3*w+2*gap;for(let k=0;k<3;k++)g+=`<rect id="pen-slot-${k+1}" x="${f(-tot/2+k*(w+gap))}" y="${f(19.6-Y0)}" width="${w}" height="3.4" fill="url(#ocp)" stroke="${STROKE}" stroke-width=".05"/>`;}
  return g+'</g>';}
// ---------- write: dimensionally-exact convention (see assets/ASSET_NOTES.md) ----------
// root width/height in inches, viewBox 1 unit = 0.01 in, <metadata> JSON (size, size_source, anchors, landmarks),
// ids namespaced "<asset-id>__", no <text>/<filter>/data: URIs. Geometry below stays in inches inside one scale(100) group.
const here=__dirname,OUTDIR=path.join(here,'..','assets','garments'),U=100;
fs.mkdirSync(OUTDIR,{recursive:true});
const SH='<linearGradient id="shadeX12" gradientUnits="userSpaceOnUse" x1="-14.6" y1="0" x2="14.6" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".30"/><stop offset=".07" stop-color="#000" stop-opacity=".12"/><stop offset=".2" stop-color="#000" stop-opacity="0"/><stop offset=".8" stop-color="#000" stop-opacity="0"/><stop offset=".93" stop-color="#000" stop-opacity=".12"/><stop offset="1" stop-color="#000" stop-opacity=".30"/></linearGradient>';
const DEFS2=DEFS.replace('</defs>',SH+'</defs>');
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

// ---- the coat
const maxX=Math.max(...OUT.outline.map(p=>Math.abs(p[0])));
const HATS=require('./hats.js'),HATROW=HATS.hatRow({yBottom:-1.5,fill:'url(#ocp)',ballFill:'url(#ocp)',nameTape:{w:TAPE.w,h:TAPE.h},ballTape:{w:TAPE.w,h:TAPE.h}});   // OCP patrol cap + OCP-pattern baseball cap above the coat
const vbHY=HATROW.top-0.4,vbC={x:-(SVX+3.2+0.3),y:vbHY,w:2*(SVX+3.2+0.3),h:HEM+0.4-vbHY};
const coatBody=HATROW.svg+garment();                       // inches, centreline x=0, collar tips y~0
const coatId='garment-ocp-coat-abu-cut';
const LMc={};
{const R=(k,id)=>{const r=lmRect(coatBody,id,vbC);if(r)LMc[k]=r;},Pg=(k,id)=>{const p=lmPoly(coatBody,id,vbC);if(p)LMc[k]=p;};
 R('name_tape','name-tape');R('cap_tape','cap-tape');R('rank_square','rank-square');for(const t of ['right','left']){R('collar_officer_zone_'+t,'collar-officer-zone-'+t);R('collar_cadet_officer_zone_'+t,'collar-cadet-officer-zone-'+t);R('collar_cadet_nco_zone_'+t,'collar-cadet-nco-zone-'+t);}
 for(const t of ['right','left']){Pg('chest_pocket_'+t,'chest-pocket-'+t);Pg('chest_flap_'+t,'chest-flap-'+t);
   R('sleeve_flap_velcro_'+t,'sleeve-flap-'+t);R('sleeve_pocket_'+t,'sleeve-pocket-body-'+t);R('glint_tab_'+t,'glint-tab-'+t);
   Pg('cuff_'+t,'cuff-'+t);}
 R('patch_flag_right','patch-flag-right');R('patch_aux_left','patch-aux-left');Pg('placket','placket');}

// ---- headgear row (patrol cap + baseball cap, front and back) above the base image
{const U2=100,r2=v=>+v.toFixed(2),box=(b,vb)=>({x:r2((b.x-vb.x)*U2),y:r2((b.y-vb.y)*U2),w:r2(b.w*U2),h:r2(b.h*U2)});
 const names={'patrol-front':'patrol_cap_front','patrol-back':'patrol_cap_back','ball-front':'baseball_cap_front','ball-back':'baseball_cap_back'};
 for(const [k,it] of Object.entries(HATROW.items)){LMc[names[k]]=box(it,vbC);if(it.insignia)LMc[names[k]+'_insignia_zone']=box(it.insignia,vbC);if(it.name_tape)LMc[names[k]+'_name_tape']=box(it.name_tape,vbC);}}
const COLLAR_SLOTS=Object.assign(require('./collar.js').slotsToUnits(COLLAR.slots,vbC),{note:'angle_deg: SVG rotate() convention (clockwise positive) to apply to an insignia whose long axis is vertical. cadet_* slots: cadet officer grade / cadet NCO metal chevron, centred 1 in from the collar FRONT edge, long axis parallel to it (cadet_axis = two points along that axis). officer_*: officer grade, centred 1 in from the collar BOTTOM edge, long axis perpendicular to it. size_in.along is measured along the long axis. bbox is the axis-aligned box of the rotated slot, also exposed as landmarks collar_*_zone_*. Right/left = wearer\'s.'});
const A=std(vbC.w*U,vbC.h*U);
const anchorsC={...A,centerline_top:[vbC.w*U/2,(0-vbC.y)*U],collar_apex:[vbC.w*U/2,(APEX-vbC.y)*U],hem_center:[vbC.w*U/2,(HEM-vbC.y)*U],
  name_tape_top_center:[LMc.name_tape.x+LMc.name_tape.w/2,LMc.name_tape.y],cap_tape_top_center:[LMc.cap_tape.x+LMc.cap_tape.w/2,LMc.cap_tape.y],
  rank_square_center:lmCen(LMc.rank_square)};
{const fR=LMc.sleeve_flap_velcro_right,fL=LMc.sleeve_flap_velcro_left,au=LMc.patch_aux_left;   // 7.1.1.4.1.2: unit patch centred in the middle of the Velcro area under the flag; 7.1.1.4.2.1: HHQ patch under AUX
 anchorsC.unit_patch_right_center=[fR.x+fR.w/2,fR.y+fR.h/2];anchorsC.hhq_patch_left_center=[fL.x+fL.w/2,((au.y+au.h)+(fL.y+fL.h))/2];}
for(const t of ['right','left']){anchorsC['chest_pocket_'+t+'_center']=lmCen(lmBox(LMc['chest_pocket_'+t]));anchorsC['chest_pocket_'+t+'_top']=(()=>{const p=LMc['chest_pocket_'+t],y=Math.min(...p.map(q=>q[1])),q=p.find(z=>z[1]===y);return [q[0],y];})();
  anchorsC['sleeve_velcro_'+t+'_top_center']=[LMc['sleeve_flap_velcro_'+t].x+LMc['sleeve_flap_velcro_'+t].w/2,LMc['sleeve_flap_velcro_'+t].y];}
const dimsC={coat_length_in:+(HEM).toFixed(2),max_width_in:+(2*maxX).toFixed(2),chest_pocket:{size_in:[CPd.w,CPd.h],tilt_deg:CPd.tiltDeg,note:'top edge rises toward the zipper; mirrored'},
  tape:{w_in:TAPE.w,h_in:TAPE.h},rank_square_in:2,sleeve_pocket:{pocket_in:[SP.pocketW,SP.pocketH],loop_tape_in:[SP.fieldW,SP.fH],iff_loop_in:[SP.iffW,SP.iffH],iff_cover_in:[SP.iffW,SP.coverH]}};
const coatSvg=conv({id:coatId,name:'OCP coat (ABU cut) with blank name tape',vb:vbC,body:coatBody,source:'reference-art-measured',
  meta:{size_source:'estimated',size_basis:`Outline traced from images/base/ABU_male.webp (581x719 px) at ${OUT.scale} in/px, chosen so the coat is ${OUT.heightIn} in long. No real garment was measured. Sleeve cap and width were then modified by script for patch room, and the torso was widened x${TK} (estimate) so the purchase-description chest pocket fits. Length 29.96 in is about a Large Regular back length (30 in, GL/PD 14-04B Table VIIA; Medium Regular is 29-1/2); the Air Force wears this same Army OCP coat (DAFI 36-2903, which CAPR 39-1 7.1 points to) - that identity is an inference.`,
    component_sources:{note:'Component sizes below are from the Army purchase description GL/PD 14-04B (rev B, Mar 2023; Detail Spec, Coat, Army Combat Uniform OCP), para 3.7 and Table VIIA, M/L/XL/XXL. Read by the coordination chat and relayed to this chat; rev B differs from rev A only in the upper sleeve pocket width (4-1/2 in, was 5). They are real inches in the coat\'s own coordinates only if the length scale is right.',chest_pocket_in:[CPd.w,CPd.h],chest_pocket_flap_w_in:CPd.flapW,chest_pocket_opening_in:6.375,name_and_army_tape_loop_in:[TAPE.w,TAPE.h],tape_gap_above_flap_corner_in:0.125,rank_loop_in:[2,2],upper_sleeve_pocket_in:[SP.pocketW,SP.pocketH],sleeve_loop_tape_in:[SP.fieldW,SP.fH],iff_loop_in:[SP.iffW,SP.iffH],iff_cover_in:[SP.iffW,SP.coverH],not_drawn:['cuff tab 2-1/8 x 3-1/8 (cuff tab rectangles removed on request)','left sleeve pencil pocket 2-3/8 wide, 2 channels (pen pockets removed on request; CAPR 39-1 7.1.1.1.2 makes it optional)','front hook-and-loop closure pieces 1 x 1-1/2','pocket bar-tacks'],chosen_size:'Large Regular (back length 30 in); finished half chest 24-1/4 in is a flat measurement and is not comparable to the worn-view torso width drawn here'},
    anchors:anchorsC.constructor===Object?Object.fromEntries(Object.entries(anchorsC).map(([k,v])=>[k,r2(v)])):anchorsC,
    collar_slots:COLLAR_SLOTS,landmarks:LMc,landmarks_note:'rects are {x,y,w,h}; polygons are [[x,y]...]; all in user units (0.01 in), origin top-left of the artwork box',
    dimensions:{...dimsC,patch_in:{flag:[PATCH.flag.w,PATCH.flag.h],aux:[PATCH.aux.w,PATCH.aux.h]}},
    documented:['no lower pockets','covered front zipper','slanted chest pockets angled down toward the placket, 6-3/4 x 5-1/4 in with 1-1/2 in flap (GL/PD 14-04B 3.7; matches the CAP OCP illustration)','2 x 2 in dark blue rank field at centre chest (CAPR 39-1 7.1.1.2.1)','name tape right chest, CAP tape left chest, light silver on dark blue (7.1.1.2.3); tape loops 1 x 5-1/4 in, 1/8 in above the flap corner, level (GL/PD 14-04B)','Velcro shoulder pockets (7.1.1.4): pocket 4-1/2 x 7-1/4 in, loop tape 4 x 6-1/2 in, IFF loop 1 x 3-1/4 in with 1 x 1-7/8 in cover (GL/PD 14-04B 3.7)','glint squares stay covered (7.1.1.1.1)','U.S. flag patch 3-1/4 in W x 1-13/16 in H (DAFI 36-2903 5.1.6.2.3)','OCP patrol cap with name tape centred on the back, rank 1/2 in above the visor (7.1.1.8)','OCP-pattern baseball cap, no grade insignia (6.2.8)'],
    assumed:['px-to-inch scale','pocket and tape POSITIONS (sizes now from GL/PD 14-04A; coordinates still traced)','torso widening factor 1.2','AUX width (DAFI caps height at flag size only; drawn at full flag size)','sleeve-edge foreshortening 0.5 (width of the shoulder pocket seen from the front)','OCP palette from photos; pattern is procedural','all headgear sizes and shapes (patrol cap ~7.8 in wide, baseball cap ~7.6 in wide; head circumference taken as ~22.5 in)'],
    fit:{method:'n/a: outline deliberately differs from the ABU raster (sleeve cap and width widened)',score:null},grade:'garment'}});

// ---- previews (PNG, not part of the convention)
const sq=(innerBody,vb,name,px)=>{const cx=vb.x+vb.w/2,cy=vb.y+vb.h/2,s=Math.max(vb.w,vb.h);
  const x=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${cx-s/2} ${cy-s/2} ${s} ${s}" width="${px}" height="${px}">${DEFS2}${innerBody}</svg>`;
  const tmp=path.join(here,name+'.sq.svg');fs.writeFileSync(tmp,x);
  require('child_process').execSync(`qlmanage -t -s ${px} -o "${here}" "${tmp}" >/dev/null 2>&1 && mv "${tmp}.png" "${path.join(here,name+'_preview.png')}" && rm "${tmp}"`);};
sq(coatBody,vbC,'ocp_top_abu_cut',1400);
console.log('ok',{coat:coatSvg.length});
