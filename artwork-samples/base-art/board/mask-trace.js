// Trace a light-on-dark (or dark-on-light) shape from a raster crop: threshold luminance, blur, iso-0.5 contour (marching squares), RDP.
// usage: node mask-trace.js src.png x0 y0 w h light|dark thr out.json [sigma=1.0] [rdp=0.5]
// output: {w,h,loops:[[ [x,y],... ]]} in source pixels relative to the crop origin.
const fs=require('fs'),dec=require('./dec.js');
const [,,SRC,X0s,Y0s,Ws,Hs,MODE,THRs,OUTF,SIGs,RDPs]=process.argv;
const X0=+X0s,Y0=+Y0s,W=+Ws,H=+Hs,THR=+THRs,SIG=+(SIGs||1.0),EPS=+(RDPs||0.5);
const d=dec(SRC),m=new Float32Array(W*H);
for(let y=0;y<H;y++)for(let x=0;x<W;x++){const p=d.px(X0+x,Y0+y),l=0.3*p[0]+0.59*p[1]+0.11*p[2];m[y*W+x]=(MODE==='light'?l>THR:l<THR)?1:0;}
function blur(a){const r=Math.max(1,Math.ceil(SIG*3)),k=[];let ks=0;for(let i=-r;i<=r;i++){const v=Math.exp(-i*i/(2*SIG*SIG));k.push(v);ks+=v;}
  const t=new Float32Array(W*H),o=new Float32Array(W*H);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){let s=0;for(let i=-r;i<=r;i++)s+=k[i+r]*a[y*W+Math.min(W-1,Math.max(0,x+i))];t[y*W+x]=s/ks;}
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){let s=0;for(let i=-r;i<=r;i++)s+=k[i+r]*t[Math.min(H-1,Math.max(0,y+i))*W+x];o[y*W+x]=s/ks;}
  return o;}
function contours(f){
  const PW=W+2,PH=H+2,F=new Float32Array(PW*PH);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++)F[(y+1)*PW+x+1]=f[y*W+x];
  const segs=[],ek=(t,x,y)=>t+':'+x+':'+y,val=(x,y)=>F[y*PW+x];
  const pt=(x0,y0,x1,y1)=>{const a=val(x0,y0),b=val(x1,y1),t=(0.5-a)/(b-a);return [x0+(x1-x0)*t-1+0.5,y0+(y1-y0)*t-1+0.5];};
  for(let y=0;y<PH-1;y++)for(let x=0;x<PW-1;x++){
    const a=val(x,y)>=0.5,b=val(x+1,y)>=0.5,c=val(x+1,y+1)>=0.5,dd=val(x,y+1)>=0.5,idx=a*8+b*4+c*2+dd;if(idx===0||idx===15)continue;
    const T={k:ek('h',x,y),p:()=>pt(x,y,x+1,y)},R={k:ek('v',x+1,y),p:()=>pt(x+1,y,x+1,y+1)},B={k:ek('h',x,y+1),p:()=>pt(x,y+1,x+1,y+1)},L={k:ek('v',x,y),p:()=>pt(x,y,x,y+1)};
    const add=(p,q)=>segs.push([p,q]);
    switch(idx){case 1:add(L,B);break;case 2:add(B,R);break;case 3:add(L,R);break;case 4:add(T,R);break;case 5:add(T,L);add(B,R);break;case 6:add(T,B);break;case 7:add(T,L);break;
      case 8:add(T,L);break;case 9:add(T,B);break;case 10:add(T,R);add(L,B);break;case 11:add(T,R);break;case 12:add(L,R);break;case 13:add(B,R);break;case 14:add(L,B);break;}}
  const mp=new Map();segs.forEach((s,i)=>{for(const e of s){if(!mp.has(e.k))mp.set(e.k,[]);mp.get(e.k).push(i);}});
  const used=new Uint8Array(segs.length),loops=[];
  for(let i=0;i<segs.length;i++){if(used[i])continue;used[i]=1;const loop=[segs[i][0].p(),segs[i][1].p()];let last=segs[i][1].k;
    for(;;){const nx=(mp.get(last)||[]).find(j=>!used[j]);if(nx===undefined)break;used[nx]=1;const s=segs[nx],e=s[0].k===last?s[1]:s[0];loop.push(e.p());last=e.k;}
    loops.push(loop);}
  return loops;}
const area=p=>{let a=0;for(let i=0;i<p.length;i++){const q=p[(i+1)%p.length];a+=p[i][0]*q[1]-q[0]*p[i][1];}return a/2;};
const rdp=(P,e)=>{if(P.length<3)return P;let dm=0,ix=0;const a=P[0],b=P[P.length-1];for(let i=1;i<P.length-1;i++){const p=P[i],num=Math.abs((b[0]-a[0])*(a[1]-p[1])-(a[0]-p[0])*(b[1]-a[1])),den=Math.hypot(b[0]-a[0],b[1]-a[1])||1;if(num/den>dm){dm=num/den;ix=i;}}
  if(dm>e)return rdp(P.slice(0,ix+1),e).slice(0,-1).concat(rdp(P.slice(ix),e));return [a,b];};
const rdpClosed=(pts,e)=>{let bi=0,bj=0,bd=-1;const st=Math.max(1,Math.floor(pts.length/120));
  for(let i=0;i<pts.length;i+=st)for(let j=i+1;j<pts.length;j+=st){const q=(pts[i][0]-pts[j][0])**2+(pts[i][1]-pts[j][1])**2;if(q>bd){bd=q;bi=i;bj=j;}}
  const A=pts.slice(bi,bj+1),B=pts.slice(bj).concat(pts.slice(0,bi+1));return rdp(A,e).slice(0,-1).concat(rdp(B,e).slice(0,-1));};
const loops=contours(blur(m)).filter(l=>Math.abs(area(l))>6).map(l=>rdpClosed(l,EPS).map(q=>[+q[0].toFixed(2),+q[1].toFixed(2)]));
fs.writeFileSync(OUTF,JSON.stringify({w:W,h:H,loops}));
console.log('loops',loops.length,loops.map(l=>l.length+'pts a='+Math.abs(area(l)).toFixed(0)).join(' '));
