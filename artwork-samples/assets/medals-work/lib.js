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


module.exports={kmeans,contour,dp,simp,area,inside,trace,hex,turn,chaikin,boxBlur,smoothMask,dropSmall,fitEllipse,hull};
