// CAP medal bodies -> real-inch SVG, measured from the McChord 50x176 rasters in images/mini_medals/mcchord
// (images/medals/* are byte-identical copies of the same files; see medals/INVENTORY.md).
// Method: locate the body (below the ribbon V tip), trace its silhouette and k-means colour layers with
// marching squares at 4x, simplify, emit nested flat-colour layers. No free drawing, no text, no raster.
// usage: node build-medals.js [outdir]   (default assets/medals)
const fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto');
const {decode}=require(process.env.HOME+'/.claude/skills/badge-replicator/scripts/pngio.js');
const SRC='/Users/ethan/UniformBuilder/images/mini_medals/mcchord/',FULL='/Users/ethan/UniformBuilder/images/medals/';
const OUT=path.resolve(process.argv[2]||path.join(__dirname,'medals')),TMP=path.join(OUT,'.tmp');
fs.mkdirSync(TMP,{recursive:true});
const png=(f,dir=SRC)=>{const o=path.join(TMP,(dir===SRC?'':'big_')+f.replace('.webp','.png'));if(!fs.existsSync(o))cp.execSync(`sips -s format png "${dir}${f}" --out "${o}" >/dev/null 2>&1`);return decode(o);};
// four awards have a larger (93 x 200) raster in images/medals; use it for the body
const BIG={earhar:'amelia_earhart.webp',spaatz:'carl_a_spaatz.webp',eaker:'ira_c_eaker.webp',cadet_cop:'proficency.webp'};

// stem (file m_<stem>.webp) -> [ribbon asset id, display name]
const BASE={
 usaf_aam01:['air-force-aerial-achievement-medal','Air Force Aerial Achievement Medal'],
 silver:['silver-medal-of-valor','Silver Medal of Valor'],bronze01:['bronze-medal-of-valor','Bronze Medal of Valor'],
 distin01:['distinguished-service-award','Distinguished Service Award'],except01:['exceptional-service-award','Exceptional Service Award'],
 meriti01:['meritorious-service-award','Meritorious Service Award'],cmdrco01:['commander-commendation-award',"Commander's Commendation Award"],
 AA01:['cap-achievment-award','CAP Achievement Award'],lifesa01:['lifesaving-award','Lifesaving Award'],
 'unitci-nat01':['national-commander-unit-citation-award',"National Commander's Unit Citation Award"],unitci01:['unit-citation-award','Unit Citation Award'],
 natcmdrcom:['national-commanders-citation',"National Commander's Citation"],cadet_cop:['cadet-certificate-of-proficiency','Cadet Certificate of Proficiency'],
 falcon:['frank-borman-falcon-award','Frank Borman Falcon Award'],wilson:['cap-gill-robb-wilson-ribbon','Gill Robb Wilson Award'],
 garber:['cap-paul-e-garber-ribbon','Paul E. Garber Award'],loening:['cap-grover-loening-aerospace-ribbon','Grover Loening Aerospace Award'],
 leader:['cap-leadership-ribbon','Leadership Award'],member:['cap-membership-ribbon','Membership Award'],
 cmdser:['cap-command-service-ribbon','Command Service Award'],wartime:['cap-world-war-2-service-ribbon','World War II Service Award'],
 senrec01:['cap-senior-recruiter-ribbon','Senior Recruiter Award'],yeager:['cap-bridgadier-general-charles-yaeger-ribbon','Brig Gen Charles E. Yeager Award'],
 crossf:['cap-a-scott-crossfield-ribbon','A. Scott Crossfield Award'],crisis:['crisis-ribbon','Crisis Service Ribbon'],
 'redser-02yr':['red-service-ribbon','Red Service Ribbon'],find01:['search-find-ribbon','Search and Find Ribbon'],
 sar01:['air-search-and-rescue-ribbon','Air Search and Rescue Ribbon'],disast01:['disaster-relief-ribbon','Disaster Relief Ribbon'],
 iace01:['iace-ribbon','IACE Ribbon'],spaatz:['spaatz-award','Gen Carl A. Spaatz Award'],eaker:['eaker-award','Gen Ira C. Eaker Award'],
 earhar:['earhart-award','Amelia Earhart Award'],mitchel:['mitchell-award','Gen Billy Mitchell Award'],
 ncc:['national-cadet-competition-ribbon','National Cadet Competition Ribbon'],ncgc:['national-color-guard-competition-ribbon','National Color Guard Competition Ribbon'],
 encamp01:['encampment-ribbon','Encampment Ribbon'],airmedal:['air-medal','Air Medal']};
// family prefix (longest match wins) for grouping every file under its base medal
const FAM={AA:'AA01',bronze:'bronze01',cmdrco:'cmdrco01',disastV:'disast01',disast:'disast01',distin:'distin01',encamp:'encamp01',except:'except01',
 findP:'find01',find:'find01',lifesa:'lifesa01',meriti:'meriti01',sarP:'sar01',sar:'sar01',senrec:'senrec01','unitci-nat':'unitci-nat01',unitci:'unitci01',
 usaf_aam:'usaf_aam01',redser:'redser-02yr',leader:'leader',ncc:'ncc',ncgc:'ncgc',wilson:'wilson',garber:'garber',cmdser:'cmdser',eaker:'eaker',spaatz:'spaatz',
 earhar:'earhar',mitchel:'mitchel',silver:'silver',airmedal:'airmedal',cadet_cop:'cadet_cop',crisis:'crisis',crossf:'crossf',falcon:'falcon',iace:'iace01',
 loening:'loening',member:'member',natcmdrcom:'natcmdrcom',wartime:'wartime',yeager:'yeager'};
const famOf=stem=>{let best=null;for(const k of Object.keys(FAM))if(stem.startsWith(k)&&(!best||k.length>best.length))best=k;return best?FAM[best]:null;};

// ---- geometry helpers
function rowExt(im,y){let a=1e9,b=-1;for(let x=0;x<im.W;x++)if(im.rgba[(y*im.W+x)*4+3]>128){a=Math.min(a,x);b=Math.max(b,x);}return b<0?null:[a,b+1];}
function bodyTop(im,RW,loopFrac=0.32){ // first row below the ribbon V where the opaque width has collapsed to the suspension loop
  const w=y=>{const e=rowExt(im,y);return e?e[1]-e[0]:0;};
  let y=60;while(y<im.H&&w(y)<RW*0.8)y++;       // inside the ribbon (full width)
  while(y<im.H&&w(y)>RW*loopFrac)y++;               // V narrows (by horizontal extent) to the loop
  return y;
}
function kmeans(px,k){
  const lum=p=>0.3*p[0]+0.59*p[1]+0.11*p[2],s=[...px].sort((a,b)=>lum(a)-lum(b));
  let c=Array.from({length:k},(_,i)=>s[Math.floor((i+0.5)/k*s.length)].slice(0,3)),lab=new Array(px.length).fill(0);
  for(let it=0;it<14;it++){
    px.forEach((p,i)=>{let b=0,bd=1e9;c.forEach((q,j)=>{const d=(p[0]-q[0])**2+(p[1]-q[1])**2+(p[2]-q[2])**2;if(d<bd){bd=d;b=j;}});lab[i]=b;});
    const sum=c.map(()=>[0,0,0,0]);px.forEach((p,i)=>{const t=sum[lab[i]];t[0]+=p[0];t[1]+=p[1];t[2]+=p[2];t[3]++;});
    c=c.map((q,j)=>sum[j][3]?[sum[j][0]/sum[j][3],sum[j][1]/sum[j][3],sum[j][2]/sum[j][3]]:q);}
  const order=c.map((q,j)=>j).sort((a,b)=>lum(c[a])-lum(c[b])),rank=[];order.forEach((j,r)=>rank[j]=r);
  return {centers:order.map(j=>c[j]),rank:lab.map(l=>rank[l])};
}
// marching squares on f (W x H node grid) at 0.5 -> closed loops [[x,y]...]  (node coords)
function contour(f,W,H){
  const segs=[],E=(x0,y0,x1,y1)=>{const a=f[y0*W+x0],b=f[y1*W+x1],t=(0.5-a)/(b-a);return [x0+(x1-x0)*t,y0+(y1-y0)*t,`${x0},${y0}-${x1},${y1}`];};
  for(let y=0;y<H-1;y++)for(let x=0;x<W-1;x++){
    const tl=f[y*W+x]>=0.5,tr=f[y*W+x+1]>=0.5,br=f[(y+1)*W+x+1]>=0.5,bl=f[(y+1)*W+x]>=0.5,i=tl*8+tr*4+br*2+bl;
    if(i===0||i===15)continue;
    const T=()=>E(x,y,x+1,y),R=()=>E(x+1,y,x+1,y+1),B=()=>E(x,y+1,x+1,y+1),L=()=>E(x,y,x,y+1);
    const m={1:[L,B],2:[B,R],3:[L,R],4:[T,R],5:[T,L,B,R],6:[T,B],7:[T,L],8:[T,L],9:[T,B],10:[T,R,L,B],11:[T,R],12:[L,R],13:[B,R],14:[L,B]}[i];
    for(let k=0;k<m.length;k+=2)segs.push([m[k](),m[k+1]()]);}
  const by=new Map();segs.forEach((s,i)=>{for(const e of s){const k=e[2];if(!by.has(k))by.set(k,[]);by.get(k).push(i);}});
  const used=new Array(segs.length).fill(false),loops=[];
  for(let i=0;i<segs.length;i++){if(used[i])continue;used[i]=true;
    let [a,b]=segs[i];const pts=[[a[0],a[1]],[b[0],b[1]]];let end=b[2];
    for(;;){const nx=(by.get(end)||[]).find(j=>!used[j]);if(nx===undefined)break;used[nx]=true;
      const [p,q]=segs[nx],n=p[2]===end?q:p;pts.push([n[0],n[1]]);end=n[2];}
    if(pts.length>=4)loops.push(pts);}
  return loops;
}
function dp(p,eps){if(p.length<3)return p;const a=p[0],b=p[p.length-1];let md=0,mi=0;
  const dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy)||1e-9;
  for(let i=1;i<p.length-1;i++){const d=Math.abs(dy*p[i][0]-dx*p[i][1]+b[0]*a[1]-b[1]*a[0])/L;if(d>md){md=d;mi=i;}}
  if(md<=eps)return [a,b];return dp(p.slice(0,mi+1),eps).slice(0,-1).concat(dp(p.slice(mi),eps));}
const simp=(l,eps)=>{ // closed loop
  let p=l.slice();if(p[0][0]===p[p.length-1][0]&&p[0][1]===p[p.length-1][1])p=p.slice(0,-1);
  const h=Math.floor(p.length/2),A=dp(p.slice(0,h+1),eps),B=dp(p.slice(h).concat([p[0]]),eps);return A.slice(0,-1).concat(B.slice(0,-1));};
const area=p=>{let s=0;for(let i=0;i<p.length;i++){const q=p[(i+1)%p.length];s+=p[i][0]*q[1]-q[0]*p[i][1];}return s/2;};
function inside(loops,x,y){let c=false;for(const p of loops)for(let i=0,j=p.length-1;i<p.length;j=i++)
  if((p[i][1]>y)!==(p[j][1]>y)&&x<(p[j][0]-p[i][0])*(y-p[i][1])/(p[j][1]-p[i][1])+p[i][0])c=!c;return c;}

const UP=4;
function trace(mask,W,H,eps,pre=0){
  if(pre){const bb=boxBlur(mask,W,H,pre);mask=bb;} // boolean/0-1 mask (W x H) -> loops in source-pixel coords (pixel centre = +0.5)
  const PW=W+4,PH=H+4,UW=PW*UP,UH=PH*UP,f=new Float32Array(UW*UH);
  const at=(x,y)=>{x-=2;y-=2;return x<0||y<0||x>=W||y>=H?0:mask[y*W+x];};
  for(let y=0;y<UH;y++)for(let x=0;x<UW;x++){const gx=(x+0.5)/UP-0.5,gy=(y+0.5)/UP-0.5,x0=Math.floor(gx),y0=Math.floor(gy),tx=gx-x0,ty=gy-y0;
    f[y*UW+x]=at(x0,y0)*(1-tx)*(1-ty)+at(x0+1,y0)*tx*(1-ty)+at(x0,y0+1)*(1-tx)*ty+at(x0+1,y0+1)*tx*ty;}
  const g=new Float32Array(f.length);
  for(let y=1;y<UH-1;y++)for(let x=1;x<UW-1;x++){let s=0;for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)s+=f[(y+a)*UW+x+b];g[y*UW+x]=s/9;}
  return contour(g,UW,UH).map(l=>simp(l,eps)).map(l=>l.map(([x,y])=>[(x+0.5)/UP-2,(y+0.5)/UP-2])).filter(l=>l.length>=3&&Math.abs(area(l))>0.25);
}
const hex=c=>'#'+c.map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('');

// ---- smoothing helpers (v2: curve-fit treatment)
const turn=(a,b,c)=>{const u=[b[0]-a[0],b[1]-a[1]],v=[c[0]-b[0],c[1]-b[1]];return Math.abs(Math.atan2(u[0]*v[1]-u[1]*v[0],u[0]*v[0]+u[1]*v[1]))*180/Math.PI;};
function chaikin(p,iters,cornerDeg){ // closed polygon; vertices turning more than cornerDeg stay sharp
  let pts=p.map(q=>({x:q[0],y:q[1],c:false}));
  pts.forEach((q,i)=>{const r=pts[(i+pts.length-1)%pts.length],n=pts[(i+1)%pts.length];q.c=turn([r.x,r.y],[q.x,q.y],[n.x,n.y])>cornerDeg;});
  for(let it=0;it<iters;it++){const out=[],n=pts.length;
    for(let i=0;i<n;i++){const P=pts[i],N=pts[(i+1)%n];
      out.push(P.c?{x:P.x,y:P.y,c:true}:{x:0.75*P.x+0.25*N.x,y:0.75*P.y+0.25*N.y,c:false});
      out.push(N.c?{x:N.x,y:N.y,c:true}:{x:0.25*P.x+0.75*N.x,y:0.25*P.y+0.75*N.y,c:false});}
    pts=out.filter((q,i)=>{const r=out[(i+out.length-1)%out.length];return !(q.c&&r.c&&Math.abs(q.x-r.x)<1e-6&&Math.abs(q.y-r.y)<1e-6);});}
  return pts.map(q=>[q.x,q.y]);}
function boxBlur(m,W,H,passes){let a=Float32Array.from(m);for(let k=0;k<passes;k++){const b=new Float32Array(a.length);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){let s=0,c=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const X=x+dx,Y=y+dy;if(X<0||Y<0||X>=W||Y>=H)continue;s+=a[Y*W+X];c++;}b[y*W+x]=s/9;}a=b;}return a;}
function smoothMask(m,W,H,passes){const b=boxBlur(m,W,H,passes),o=new Uint8Array(m.length);for(let i=0;i<m.length;i++)o[i]=b[i]>=0.5?1:0;return o;}
function dropSmall(m,W,H,minArea,fillHoles){ // remove 4-connected components (and optionally holes) below minArea px
  const seen=new Uint8Array(m.length);
  const run=(val)=>{for(let s=0;s<m.length;s++){if(seen[s]||m[s]!==val)continue;const st=[s],cc=[];seen[s]=1;
    while(st.length){const p=st.pop();cc.push(p);const x=p%W,y=(p/W)|0;
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const X=x+dx,Y=y+dy;if(X<0||Y<0||X>=W||Y>=H)continue;const q=Y*W+X;if(!seen[q]&&m[q]===val){seen[q]=1;st.push(q);}}}
    if(cc.length<minArea)for(const p of cc)m[p]=1-val;}};
  run(1);seen.fill(0);if(fillHoles)run(0);return m;}
function fitEllipse(pts,xl,xr,yb){ // axis-aligned ellipse/circle with bottom at yb and width xl..xr: scan the vertical semi-axis b
  const cx=(xl+xr)/2,a=(xr-xl)/2;let best=null;
  for(let b=a*0.75;b<=a*1.25;b+=a*0.005){const cy=yb-b;let e=0,n=0;
    for(const [x,y] of pts){if(y<cy-b*0.55)continue;const r=Math.sqrt(((x-cx)/a)**2+((y-cy)/b)**2);e+=Math.abs(r-1);n++;}
    e/=n;if(!best||e<best.e)best={e,cx,cy,rx:a,ry:b};}
  return best;}
const hull=pts=>{const p=pts.slice().sort((a,b)=>a[0]-b[0]||a[1]-b[1]),cr=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]),lo=[],up=[];
  for(const q of p){while(lo.length>=2&&cr(lo[lo.length-2],lo[lo.length-1],q)<=0)lo.pop();lo.push(q);}
  for(const q of p.slice().reverse()){while(up.length>=2&&cr(up[up.length-2],up[up.length-1],q)<=0)up.pop();up.push(q);}
  return lo.slice(0,-1).concat(up.slice(0,-1));};

// ---- build one medal body (v2): smoothed silhouette (+ snapped circle/ellipse), 3 sampled tones + rim
function body(stem){
  const im=BIG[stem]?png(BIG[stem],FULL):png(`m_${stem}.webp`),e60=rowExt(im,60),RW=e60[1]-e60[0],RC=(e60[0]+e60[1])/2,top=bodyTop(im,RW,BIG[stem]?0.2:0.32),H=im.H-top,W=im.W;
  const A=new Uint8Array(W*H),px=[],idx=[];
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=((y+top)*W+x)*4;if(im.rgba[i+3]>128){A[y*W+x]=1;px.push([im.rgba[i],im.rgba[i+1],im.rgba[i+2]]);idx.push(y*W+x);}}
  const area0=idx.length,minA=Math.max(3,Math.round(area0*0.03));
  const L=p=>0.3*p[0]+0.59*p[1]+0.11*p[2],ord=px.map((p,i)=>i).sort((a,b)=>L(px[a])-L(px[b])),avg=(a,b)=>{const t=[0,0,0];let n=0;for(let i=Math.floor(a*ord.length);i<Math.max(Math.floor(a*ord.length)+1,Math.floor(b*ord.length));i++){const p=px[ord[i]];t[0]+=p[0];t[1]+=p[1];t[2]+=p[2];n++;}return t.map(v=>v/n);};
  const cen=[avg(0,0.25),avg(0.45,0.75),avg(0.85,1)],km={centers:cen,rank:px.map(p=>{const l=L(p);return l<L(cen[1])-(L(cen[1])-L(cen[0]))*0.5?0:l>L(cen[1])+(L(cen[2])-L(cen[1]))*0.5?2:1;})},rk=new Uint8Array(W*H).fill(255);idx.forEach((p,i)=>rk[p]=km.rank[i]);
  // silhouette
  const sil=trace(A,W,H,0.12,1).map(l=>chaikin(simp(l,0.18),2,38)).filter(l=>Math.abs(area(l))>2);
  let x0=W,x1=-1,y0=H,y1=-1;for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(A[y*W+x]){x0=Math.min(x0,x);x1=Math.max(x1,x+1);y0=Math.min(y0,y);y1=Math.max(y1,y+1);}
  // snap the disc to a true circle / ellipse when the outline is one (excludes stars and hexagons)
  const main=sil.slice().sort((a,b)=>Math.abs(area(b))-Math.abs(area(a)))[0],bnd=[];
  main.forEach((p,i)=>{const q=main[(i+1)%main.length];for(let t=0;t<1;t+=0.25)bnd.push([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t]);});
  // widest-row extent of the lower body
  let wx0=W,wx1=0;for(let y=Math.floor(H*0.6);y<H;y++)for(let x=0;x<W;x++)if(A[y*W+x]){wx0=Math.min(wx0,x);wx1=Math.max(wx1,x+1);}
  const el=fitEllipse(bnd,wx0,wx1,y1),snapped=el&&el.e<0.035;
  const shapes=[];
  if(snapped){shapes.push({t:'ellipse',cx:el.cx,cy:el.cy,rx:el.rx,ry:el.ry});
    const lp=bnd.filter(p=>p[1]<el.cy-el.ry*0.97);
    if(lp.length>=3){const lx0=Math.min(...lp.map(p=>p[0])),lx1=Math.max(...lp.map(p=>p[0])),yy=el.cy-el.ry*0.8;shapes.push({t:'poly',pts:hull(lp.concat([[lx0,yy],[lx1,yy]]))});}}
  else sil.forEach(l=>shapes.push({t:'poly',pts:l}));
  const inShape=(x,y)=>shapes.some(s=>s.t==='ellipse'?((x-s.cx)/s.rx)**2+((y-s.cy)/s.ry)**2<=1:inside([s.pts],x,y));
  // tonal layers: rank 0 = dark, 2 = light (mid tone is the silhouette fill)
  const tones=[];
  let field=null;{const rr=el&&snapped&&Math.abs(el.rx-el.ry)/el.rx<0.06;if(rr){const R=(el.rx+el.ry)/2;field={cx:el.cx,cy:el.cy,r:R*0.78};}}
  for(const j of [0,2]){let m=new Uint8Array(W*H);for(let p=0;p<m.length;p++)m[p]=rk[p]===j?1:0;
    m=smoothMask(m,W,H,3);for(let p=0;p<m.length;p++){if(!A[p])m[p]=0;else if(field&&Math.hypot((p%W)+0.5-field.cx,((p/W)|0)+0.5-field.cy)>field.r)m[p]=0;}m=dropSmall(m,W,H,Math.round(area0*0.06),true);
    const Rb=el?(el.rx+el.ry)/2:Math.min(x1-x0,y1-y0)/2,cX=el?el.cx:(x0+x1)/2,cY=el?el.cy:(y0+y1)/2,big=!!BIG[stem];
    const cen=l=>{let a=0,mx=0,my=0;for(let i=0;i<l.length;i++){const p=l[i],q=l[(i+1)%l.length],c=p[0]*q[1]-q[0]*p[1];a+=c;mx+=(p[0]+q[0])*c;my+=(p[1]+q[1])*c;}return [mx/(3*a),my/(3*a)];};
    const loops=trace(m,W,H,0.12,1).map(l=>chaikin(simp(l,0.35),3,38)).filter(l=>{const a=Math.abs(area(l));if(a<area0*(big?0.04:0.06))return false;
      const sol=a/Math.max(1e-6,Math.abs(area(hull(l)))),c=cen(l);if(process.env.DBG&&big)console.error(stem,j,'area%',(100*a/area0).toFixed(1),'sol',sol.toFixed(2),'off',(Math.hypot(c[0]-cX,c[1]-cY)/Rb).toFixed(2));return sol>(big?0.45:0.8)&&Math.hypot(c[0]-cX,c[1]-cY)<=0.2*Rb;});  // compact, >=6 % of the body, centred; no patches
    // layer-level compactness: net area (holes subtracted) over the hull of the outer outline
    let keep=loops;
    if(loops.length){const A0=loops.map(l=>Math.abs(area(l))),mi=A0.indexOf(Math.max(...A0)),net=A0.reduce((t,v,i)=>t+(i===mi?v:-v),0);
      if(net/Math.abs(area(hull(loops[mi])))<(BIG[stem]?0.45:0.8)||net>area0*0.35)keep=[];}  // also drop a mass that fills most of the disc: that is the field, not an emblem
    tones.push({col:km.centers[j],loops:keep,role:j===0?'dark':'light'});}
  let ring=null;
  if(snapped&&Math.abs(el.rx-el.ry)/el.rx<0.06){const R=(el.rx+el.ry)/2,bins=Math.floor(R/0.5),sum=new Float32Array(bins),cnt=new Float32Array(bins);
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){if(!A[y*W+x])continue;const r=Math.hypot(x+0.5-el.cx,y+0.5-el.cy),k=Math.floor(r/0.5);if(k<bins){const i=((y+top)*W+x)*4;sum[k]+=0.3*im.rgba[i]+0.59*im.rgba[i+1]+0.11*im.rgba[i+2];cnt[k]++;}}
    const pr=Array.from(sum,(v,i)=>cnt[i]>3?v/cnt[i]:null);let bk=-1,bg=0;
    for(let k=Math.floor(bins*0.62);k<Math.floor(bins*0.9);k++){if(pr[k-1]==null||pr[k+1]==null)continue;const g=Math.abs(pr[k+1]-pr[k-1]);if(g>bg){bg=g;bk=k;}}
    if(bk>0&&bg>25)ring={r:(bk+0.5)*0.5,cx:el.cx,cy:el.cy,contrast:bg};}
  // larger sources: one central emblem mass = the brighter half of the field, heavily smoothed, largest compact component only
  if(process.env.MEDAL_EMBLEM&&BIG[stem]&&field){const lum=p=>{const i=((((p/W)|0)+top)*W+(p%W))*4;return 0.3*im.rgba[i]+0.59*im.rgba[i+1]+0.11*im.rgba[i+2];};
    const inF=[];for(let p=0;p<W*H;p++)if(A[p]&&Math.hypot((p%W)+0.5-field.cx,((p/W)|0)+0.5-field.cy)<=field.r)inF.push(lum(p));
    inF.sort((a,b)=>a-b);const thr=inF[Math.floor(inF.length*0.55)];
    let m=new Uint8Array(W*H);for(let p=0;p<m.length;p++)m[p]=(A[p]&&Math.hypot((p%W)+0.5-field.cx,((p/W)|0)+0.5-field.cy)<=field.r*0.97&&lum(p)>=thr)?1:0;
    m=smoothMask(m,W,H,4);m=dropSmall(m,W,H,Math.round(area0*0.06),true);
    const R0=(el.rx+el.ry)/2;
    const loops=trace(m,W,H,0.12,1).map(l=>chaikin(simp(l,0.35),3,38)).filter(l=>{const a=Math.abs(area(l));if(a<area0*0.06)return false;
      let ax=0,mx=0,my=0;for(let i=0;i<l.length;i++){const p=l[i],q=l[(i+1)%l.length],c=p[0]*q[1]-q[0]*p[1];ax+=c;mx+=(p[0]+q[0])*c;my+=(p[1]+q[1])*c;}
      return a/Math.abs(area(hull(l)))>0.45&&Math.hypot(mx/(3*ax)-el.cx,my/(3*ax)-el.cy)<=0.2*R0;});
    if(loops.length)tones.push({col:km.centers[2],loops,role:'emblem'});}
  // gate at source resolution
  let inter=0,uni=0,mae=0,n=0;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const mine=inShape(x+0.5,y+0.5),src=A[y*W+x]===1;if(mine&&src)inter++;if(mine||src)uni++;
    if(src){let c=km.centers[1];for(const t of tones)if(inside(t.loops,x+0.5,y+0.5))c=t.col;
      const i=((y+top)*W+x)*4;mae+=(Math.abs(c[0]-im.rgba[i])+Math.abs(c[1]-im.rgba[i+1])+Math.abs(c[2]-im.rgba[i+2]))/3;n++;}}
  return {im,top,W,H,RW:BIG[stem]?(wx1-wx0):RW,RC,big:!!BIG[stem],shapes,tones,mid:km.centers[1],snapped:snapped?(Math.abs(el.rx-el.ry)/el.rx<0.04?'circle':'ellipse'):'polygon',snapErr:el&&el.e,
    ring,bbox:[x0,y0,x1,y1],iou:inter/uni,mae:mae/n,A,rk,layers:[{col:km.centers[1]}].concat(tones)};
}

// ---- emit
const RIBBON_W_IN={full:1.375,miniature:0.625};   // 1 3/8 in and 5/8 in (coordination chat citing DoDM 1348.33; not verified locally)
const ID_OVERRIDE={'usaf_aam01-full':'medal-cap-catalog-air-force-aerial-achievement-medal-full'}; // coordination chat: avoids a collision with the Badge Mil set
function emit(stem,b,kind,dirs){
  const [rid,name]=BASE[stem],id=ID_OVERRIDE[stem+'-'+kind]||`medal-${rid}-${kind}`,s=RIBBON_W_IN[kind]*100/b.RW;
  const [x0,y0,x1,y1]=b.bbox,wu=(x1-x0)*s,hu=(y1-y0)*s,fx=x=>((x-x0)*s).toFixed(2),fy=y=>((y-y0)*s).toFixed(2);
  const d=loops=>loops.map(l=>'M'+l.map(([x,y])=>fx(x)+','+fy(y)).join('L')+'Z').join('');
  const shapeSvg=(extra)=>b.shapes.map(sh=>sh.t==='ellipse'
    ?`<ellipse cx="${fx(sh.cx)}" cy="${fy(sh.cy)}" rx="${(sh.rx*s).toFixed(2)}" ry="${(sh.ry*s).toFixed(2)}"${extra}/>`
    :`<path d="${d([sh.pts])}"${extra}/>`).join('');
  const anchors={top_center:[wu/2,0],bottom_center:[wu/2,hu],center:[wu/2,hu/2],left_edge:[0,hu/2],right_edge:[wu,hu/2],ribbon_attach:[(b.RC-x0)*s,0]};
  for(const k of Object.keys(anchors))anchors[k]=anchors[k].map(v=>+(+v).toFixed(2));
  const meta={asset_id:id,name:`${name} (${kind==='full'?'full-size':'miniature'} medal body)`,
    size_in:{w:+(wu/100).toFixed(4),h:+(hu/100).toFixed(4)},units:'1 user unit = 0.01 in',viewBox:[0,0,+wu.toFixed(2),+hu.toFixed(2)],
    size_source:'estimated',
    size_basis:`Raster proportion: the ribbon in ${b.big?'images/medals/'+BIG[stem]:'images/mini_medals/mcchord/m_'+stem+'.webp'} is ${RIBBON_W_IN[kind]} in wide (ribbon measured ${b.RW} px in the source raster) `+
      `(${kind==='full'?'full size 1 3/8 in':'miniature 5/8 in'}; coordination chat citing DoDM 1348.33; CAPR 39-3 gives no medal dimensions); `+
      `the medal body is measured at ${(x1-x0)} x ${(y1-y0)} source px = ${(wu/100).toFixed(3)} x ${(hu/100).toFixed(3)} in at that scale. Absolute size is an estimate.`,
    anchors,
    ribbon_ref:{asset_id:'ribbon-'+rid,spec:`../ribbons/ribbon-${rid}.spec.json`,attach_anchor:'ribbon_attach',
      note:'medal body only; the ribbon asset supplies the stripes and devices. ribbon_attach is where the ribbon meets the suspension loop.'},
    source:{raster:b.big?`images/medals/${BIG[stem]}`:`images/mini_medals/mcchord/m_${stem}.webp`,body_top_row:b.top,px_to_in:+(RIBBON_W_IN[kind]/b.RW).toFixed(6),bbox_px:b.bbox},
    fidelity:'silhouette_and_tone',
    fit:{metric:'silhouette IoU vs source alpha at source resolution',score:+b.iou.toFixed(4),threshold:0.9,colour_mae_0_255:+b.mae.toFixed(1),
      outline:b.snapped,inner_ring_radius_px:b.ring?+b.ring.r.toFixed(1):null,note:'Source medal is ~35-50 px across; engraving and lettering are not resolved. Vector = smoothed silhouette (true circle/ellipse where the outline is one) + mid tone + at most dark and light tone layers (sampled k-means colours) + rim.'},
    palette:{mid:hex(b.mid),dark:hex(b.tones[0].col),light:hex(b.tones[1].col),emblem:b.tones[2]?hex(b.tones[2].col):null},grade:'medal',variants_share_body:dirs.variants};
  const rim=hex(b.tones[0].col.map(v=>v*0.7));
  const g=`<clipPath id="${id}__clip">${shapeSvg('')}</clipPath>`+
    `<g id="${id}__rim" fill="${rim}" stroke="${rim}" stroke-width="${(1.6*s).toFixed(2)}" stroke-linejoin="round">${shapeSvg('')}</g>`+
    `<g id="${id}__mid" fill="${hex(b.mid)}">${shapeSvg('')}</g>`+
    b.tones.map((t,i)=>`<path id="${id}__${t.role}" clip-path="url(#${id}__clip)" fill="${hex(t.col)}" fill-rule="evenodd" d="${d(t.loops)}"/>`).join('')+
    (b.ring?`<ellipse id="${id}__ring" clip-path="url(#${id}__clip)" cx="${fx(b.ring.cx)}" cy="${fy(b.ring.cy)}" rx="${(b.ring.r*s).toFixed(2)}" ry="${(b.ring.r*s).toFixed(2)}" fill="none" stroke="${rim}" stroke-width="${(0.9*s).toFixed(2)}"/>`:'');
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${(wu/100).toFixed(4)}in" height="${(hu/100).toFixed(4)}in" viewBox="0 0 ${wu.toFixed(2)} ${hu.toFixed(2)}" data-asset-id="${id}" data-source="reference-art-traced" data-units="0.01in"><title>${meta.name}</title><metadata>${JSON.stringify(meta)}</metadata><g id="${id}__body">${g}</g></svg>\n`;
  fs.writeFileSync(path.join(OUT,id+'.svg'),svg);fs.writeFileSync(path.join(OUT,id+'.spec.json'),JSON.stringify(meta,null,1));
  return meta;
}

// ---- inventory
const med=fs.readdirSync(FULL).filter(f=>f.endsWith('.webp')).sort(),mini=fs.readdirSync(SRC).filter(f=>f.endsWith('.webp')).sort();
const md5=f=>crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex');
const miniHash=new Map(mini.map(f=>[md5(SRC+f),f]));
const fams=new Map();for(const f of mini){const st=f.slice(2,-5),fam=famOf(st);if(!fams.has(fam))fams.set(fam,[]);fams.get(fam).push(st);}
const results=[],inv=[];
for(const stem of Object.keys(BASE)){
  const b=body(stem);
  // do the family variants share this body? compare the body rows of each variant against the base
  const same=[],diff=[];for(const v of fams.get(stem)||[]){if(v===stem)continue;
    const im=png(`m_${v}.webp`);let dsum=0,c=0;for(let y=Math.max(b.top,im.top||0);y<im.H;y++)for(let x=0;x<im.W;x++){const i=(y*im.W+x)*4,j=((y)*b.im.W+x)*4;
      if(im.rgba[i+3]>128||b.im.rgba[j+3]>128){dsum+=(Math.abs(im.rgba[i]-b.im.rgba[j])+Math.abs(im.rgba[i+1]-b.im.rgba[j+1])+Math.abs(im.rgba[i+2]-b.im.rgba[j+2]))/3;c++;}}
    (dsum/c<8?same:diff).push(v);}
  const variants={same_body:same,different_body:diff};
  const full=emit(stem,b,'full',{variants}),minim=emit(stem,b,'miniature',{variants});
  results.push({stem,id:BASE[stem][0],iou:b.iou,mae:b.mae,full:full.size_in,mini:minim.size_in,same:same.length,diff});
}
// medals/ files -> which mini_medals file they duplicate
const BYNAME={'amelia_earhart.webp':'earhar','carl_a_spaatz.webp':'spaatz','ira_c_eaker.webp':'eaker','proficency.webp':'cadet_cop'}; // not byte-identical: matched by name
const fullMap=med.map(f=>{const m=miniHash.get(md5(FULL+f));return {file:f,duplicates:m?`mini_medals/mcchord/${m}`:null,stem:m?m.slice(2,-5):(BYNAME[f]||null),byName:!m&&!!BYNAME[f]};});
let md=`# CAP medal inventory (generated by build-medals.js)\n\n`+
 `## images/medals (${med.length} files)\nEvery file is a 50 x 176 px ribbon+medal composite, **byte-identical** to a file in mini_medals/mcchord when a duplicate is listed. There is no separate full-size artwork in the repo.\n\n| file | duplicate of | medal asset |\n|---|---|---|\n`;
for(const r of fullMap){const fam=r.stem?famOf(r.stem):null;md+=`| ${r.file} | ${r.duplicates||(r.byName?'same award, different file (matched by name)':'**none (unique)**')} | ${fam&&BASE[fam]?'medal-'+BASE[fam][0]:'-'} |\n`;}
md+=`\n## images/mini_medals/mcchord (${mini.length} files, McChord rack builder, 50 x 176 px)\n${fams.size} families; the ribbon art differs by device (oak-leaf / clasp / star counts, V, prop) while the medal body is shared. `+
 `Body check below compares the rows below the ribbon for every variant against the family's base file (mean RGB difference < 8 = same body).\n\n| medal asset | base file | files in family | same body | different body |\n|---|---|---|---|---|\n`;
for(const r of results){md+=`| medal-${r.id} | m_${r.stem}.webp | ${(fams.get(r.stem)||[]).length} | ${r.same} | ${r.diff.length?r.diff.join(', '):'-'} |\n`;}
const unmapped=[...fams.entries()].filter(([k])=>!k||!BASE[k]);if(unmapped.length)md+=`\nUnmapped: ${JSON.stringify(unmapped)}\n`;
fs.writeFileSync(path.join(OUT,'INVENTORY.md'),md);
console.log(results.map(r=>`${r.stem.padEnd(14)} IoU ${r.iou.toFixed(3)} MAE ${r.mae.toFixed(0)} full ${r.full.w}x${r.full.h} mini ${r.mini.w}x${r.mini.h} sameVar ${r.same} diff ${r.diff.length}`).join('\n'));
fs.rmSync(TMP,{recursive:true,force:true});
