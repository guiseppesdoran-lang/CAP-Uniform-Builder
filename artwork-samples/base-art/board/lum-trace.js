// Sub-pixel, smooth vector trace of a small flat-colour figure (replaces flat.js for low-res sources).
// Each colour class -> binary mask -> small Gaussian blur -> iso-0.5 contour with linear interpolation (marching squares on grid edges).
// Antialiased edges in the source therefore give smooth, unbiased contours (no k-means/majority-filter wobble).
// usage: node lum-trace.js src.png x0 y0 w h '[[r,g,b],...]' out.json [sigma=0.8] [scale=4] [minArea=0.6]
// output: same shape as flat.js (layers[k].loops, sil), coordinates multiplied by `scale` so downstream px thresholds stay comparable.
const fs=require('fs'),dec=require('./dec.js');
const [,,SRC,X0s,Y0s,Ws,Hs,SEEDJ,OUTF,SIGs,SCs,MINs]=process.argv;
const X0=+X0s,Y0=+Y0s,W=+Ws,H=+Hs,SEEDS=JSON.parse(SEEDJ),SIG=+(SIGs||0.8),SC=+(SCs||4),MINA=+(MINs||0.6);
const d=dec(SRC);
const lum=(x,y)=>{const p=d.px(X0+x,Y0+y);return 0.3*p[0]+0.59*p[1]+0.11*p[2];};
const redp=(x,y)=>{const p=d.px(X0+x,Y0+y);return process.env.VAN?(p[0]>150&&p[0]-p[1]>55&&p[0]-p[2]>45):(p[0]>140&&p[1]<90&&p[2]<90);};
const bg=new Uint8Array(W*H);
{const q=[],near=(x,y)=>{const p=d.px(X0+x,Y0+y);return Math.min(p[0],p[1],p[2])>238;};
 const push=(x,y)=>{if(x<0||y<0||x>=W||y>=H)return;const i=y*W+x;if(bg[i]||!near(x,y))return;bg[i]=1;q.push(i);};
 for(let x=0;x<W;x++){push(x,0);push(x,H-1);}for(let y=0;y<H;y++){push(0,y);push(W-1,y);}
 while(q.length){const i=q.pop(),x=i%W,y=(i/W)|0;push(x+1,y);push(x-1,y);push(x,y+1);push(x,y-1);}}
let rx0=1e9,rx1=-1e9,ry0=1e9,ry1=-1e9;
for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(!bg[y*W+x]&&redp(x,y)){rx0=Math.min(rx0,x);rx1=Math.max(rx1,x);ry0=Math.min(ry0,y);ry1=Math.max(ry1,y);}
const rh=ry1-ry0,rw=rx1-rx0,SH={x0:rx0-0.09*rw,x1:rx1+0.09*rw,y0:ry0-0.66*rh,y1:ry1+0.26*rh};
function blur(m){ // separable gaussian
  const r=Math.max(1,Math.ceil(SIG*3)),k=[];let ks=0;for(let i=-r;i<=r;i++){const v=Math.exp(-i*i/(2*SIG*SIG));k.push(v);ks+=v;}
  const t=new Float32Array(W*H),o=new Float32Array(W*H);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){let s=0;for(let i=-r;i<=r;i++){const xx=Math.min(W-1,Math.max(0,x+i));s+=k[i+r]*m[y*W+xx];}t[y*W+x]=s/ks;}
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){let s=0;for(let i=-r;i<=r;i++){const yy=Math.min(H-1,Math.max(0,y+i));s+=k[i+r]*t[yy*W+x];}o[y*W+x]=s/ks;}
  return o;}
// pad by 1 so contours close at the crop border
function contours(f){
  const PW=W+2,PH=H+2,F=new Float32Array(PW*PH);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++)F[(y+1)*PW+x+1]=f[y*W+x];
  const segs=[];const ek=(t,x,y)=>t+':'+x+':'+y;
  const val=(x,y)=>F[y*PW+x];
  const pt=(x0,y0,x1,y1)=>{const a=val(x0,y0),b=val(x1,y1),t=(0.5-a)/(b-a);return [x0+(x1-x0)*t-1+0.5,y0+(y1-y0)*t-1+0.5];};
  for(let y=0;y<PH-1;y++)for(let x=0;x<PW-1;x++){
    const a=val(x,y)>=0.5,b=val(x+1,y)>=0.5,c=val(x+1,y+1)>=0.5,dd=val(x,y+1)>=0.5,idx=a*8+b*4+c*2+dd;if(idx===0||idx===15)continue;
    const T={k:ek('h',x,y),p:()=>pt(x,y,x+1,y)},R={k:ek('v',x+1,y),p:()=>pt(x+1,y,x+1,y+1)},B={k:ek('h',x,y+1),p:()=>pt(x,y+1,x+1,y+1)},L={k:ek('v',x,y),p:()=>pt(x,y,x,y+1)};
    const add=(p,q)=>segs.push([p,q]);
    switch(idx){case 1:add(L,B);break;case 2:add(B,R);break;case 3:add(L,R);break;case 4:add(T,R);break;case 5:add(T,L);add(B,R);break;case 6:add(T,B);break;case 7:add(T,L);break;
      case 8:add(T,L);break;case 9:add(T,B);break;case 10:add(T,R);add(L,B);break;case 11:add(T,R);break;case 12:add(L,R);break;case 13:add(B,R);break;case 14:add(L,B);break;}}
  const m=new Map();segs.forEach((s,i)=>{for(const e of s){if(!m.has(e.k))m.set(e.k,[]);m.get(e.k).push(i);}});
  const used=new Uint8Array(segs.length),loops=[];
  for(let i=0;i<segs.length;i++){if(used[i])continue;used[i]=1;const loop=[segs[i][0].p(),segs[i][1].p()];let last=segs[i][1].k;
    for(;;){const nx=(m.get(last)||[]).find(j=>!used[j]);if(nx===undefined)break;used[nx]=1;const s=segs[nx],e=s[0].k===last?s[1]:s[0];loop.push(e.p());last=e.k;}
    loops.push(loop);}
  return loops;}
const area=p=>{let a=0;for(let i=0;i<p.length;i++){const q=p[(i+1)%p.length];a+=p[i][0]*q[1]-q[0]*p[i][1];}return a/2;};
// light RDP + 1 Chaikin pass: keeps corners (apex) sharp enough, smooths the contour
const rdp=(P,e)=>{if(P.length<3)return P;let dm=0,ix=0;const a=P[0],b=P[P.length-1];for(let i=1;i<P.length-1;i++){const p=P[i],num=Math.abs((b[0]-a[0])*(a[1]-p[1])-(a[0]-p[0])*(b[1]-a[1])),den=Math.hypot(b[0]-a[0],b[1]-a[1])||1,v=num/den;if(v>dm){dm=v;ix=i;}}
  if(dm>e)return rdp(P.slice(0,ix+1),e).slice(0,-1).concat(rdp(P.slice(ix),e));return [a,b];};
const rdpClosed=(pts,e)=>{ // split at the two farthest points, simplify both open halves
  let bi=0,bj=0,bd=-1;const st=Math.max(1,Math.floor(pts.length/120));
  for(let i=0;i<pts.length;i+=st)for(let j=i+1;j<pts.length;j+=st){const q=(pts[i][0]-pts[j][0])**2+(pts[i][1]-pts[j][1])**2;if(q>bd){bd=q;bi=i;bj=j;}}
  const A=pts.slice(bi,bj+1),B=pts.slice(bj).concat(pts.slice(0,bi+1));
  return rdp(A,e).slice(0,-1).concat(rdp(B,e).slice(0,-1));};
const out=p=>p.map(q=>[+(q[0]*SC).toFixed(1),+(q[1]*SC).toFixed(1)]);

const THR=+(process.argv[13]||128);
const silver=new Float32Array(W*H),sil=new Float32Array(W*H);
for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=y*W+x;
  sil[i]=bg[i]?0:1;
  const inSh=x>=SH.x0&&x<=SH.x1&&y>=SH.y0&&y<=SH.y1;
  silver[i]=(!bg[i]&&!inSh)?Math.max(0,Math.min(1,(lum(x,y)-THR)/60+0.5)):0;}   // soft ramp, iso at 0.5 == luminance THR
const mk=(m,sg)=>{const o=blur(m);return o;};
const bandLoops=contours(blur(silver)).filter(l=>Math.abs(area(l))>MINA).map(l=>out(rdpClosed(l,0.2)));
const silLoops=contours(blur(sil)).filter(l=>Math.abs(area(l))>MINA*10).map(l=>out(rdpClosed(l,0.2)));
fs.writeFileSync(OUTF,JSON.stringify({w:W*SC,h:H*SC,sil:silLoops,bands:bandLoops,shield:{x0:SH.x0*SC,x1:SH.x1*SC,y0:SH.y0*SC,y1:SH.y1*SC},red:{x0:rx0*SC,x1:(rx1+1)*SC,y0:ry0*SC,y1:(ry1+1)*SC}}));
console.log('bands',bandLoops.length,'sil',silLoops.length,'shield',JSON.stringify(SH));
