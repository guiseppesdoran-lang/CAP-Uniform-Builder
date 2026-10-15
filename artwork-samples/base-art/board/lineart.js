// Thin dark line-art -> smooth filled polygons: bilinear-upsampled luminance, threshold, marching squares, RDP + Chaikin.
// usage: node lineart.js src.png out.json T [factor=3] [eps=0.5]   (coordinates in source px; transparent pixels count as white)
const fs=require('fs'),dec=require('./dec.js');
const [,,SRC,OUTF,Ts,Fs,Es,Y0s,Y1s]=process.argv;const T=+Ts,F=+(Fs||3),EPS=+(Es||0.5),YA=+(Y0s??-1e9),YB=+(Y1s??1e9);   // optional y-range: rows outside are treated as white
const d=dec(SRC),W=d.W,H=d.H;
const lum=new Float32Array(W*H);
for(let y=0;y<H;y++)for(let x=0;x<W;x++){const p=d.px(x,y);const a=(p[3]===undefined?255:p[3])/255;const l=0.3*p[0]+0.59*p[1]+0.11*p[2];lum[y*W+x]=(y<YA||y>YB)?255:l*a+255*(1-a);}
const GW=W*F,GH=H*F;
const at=(gx,gy)=>{const x=(gx+0.5)/F-0.5,y=(gy+0.5)/F-0.5,x0=Math.max(0,Math.min(W-1,Math.floor(x))),y0=Math.max(0,Math.min(H-1,Math.floor(y))),x1=Math.min(W-1,x0+1),y1=Math.min(H-1,y0+1),tx=Math.max(0,Math.min(1,x-x0)),ty=Math.max(0,Math.min(1,y-y0));
  return (lum[y0*W+x0]*(1-tx)+lum[y0*W+x1]*tx)*(1-ty)+(lum[y1*W+x0]*(1-tx)+lum[y1*W+x1]*tx)*ty;};
const field=new Float32Array(GW*GH);for(let gy=0;gy<GH;gy++)for(let gx=0;gx<GW;gx++)field[gy*GW+gx]=at(gx,gy);
const mk=(x,y)=>(x>=0&&y>=0&&x<GW&&y<GH&&field[y*GW+x]<T)?1:0;
const segs=[];
for(let y=-1;y<GH;y++)for(let x=-1;x<GW;x++){const a=mk(x,y),b=mk(x+1,y),c=mk(x+1,y+1),dd=mk(x,y+1),idx=a*8+b*4+c*2+dd;if(idx===0||idx===15)continue;
  const Tp=[x+0.5,y],Rg=[x+1,y+0.5],Bt=[x+0.5,y+1],Lf=[x,y+0.5],add=(p,q)=>segs.push([p,q]);
  switch(idx){case 1:add(Lf,Bt);break;case 2:add(Bt,Rg);break;case 3:add(Lf,Rg);break;case 4:add(Tp,Rg);break;case 5:add(Tp,Lf);add(Bt,Rg);break;case 6:add(Tp,Bt);break;case 7:add(Tp,Lf);break;case 8:add(Tp,Lf);break;case 9:add(Tp,Bt);break;case 10:add(Tp,Rg);add(Lf,Bt);break;case 11:add(Tp,Rg);break;case 12:add(Lf,Rg);break;case 13:add(Bt,Rg);break;case 14:add(Lf,Bt);break;}}
const kk=p=>p[0]+','+p[1],m=new Map();segs.forEach((s,i)=>{for(const p of s){const k=kk(p);if(!m.has(k))m.set(k,[]);m.get(k).push(i);}});
const used=new Uint8Array(segs.length),loops=[];
const area=p=>{let a=0;for(let i=0;i<p.length;i++){const q=p[(i+1)%p.length];a+=p[i][0]*q[1]-q[0]*p[i][1];}return a/2;};
const rdp=(pts,e)=>{if(pts.length<3)return pts;let dm=0,ix=0;const a=pts[0],b=pts[pts.length-1];for(let i=1;i<pts.length-1;i++){const p=pts[i],num=Math.abs((b[0]-a[0])*(a[1]-p[1])-(a[0]-p[0])*(b[1]-a[1])),den=Math.hypot(b[0]-a[0],b[1]-a[1])||1,v=num/den;if(v>dm){dm=v;ix=i;}}
  if(dm>e)return rdp(pts.slice(0,ix+1),e).slice(0,-1).concat(rdp(pts.slice(ix),e));return [a,b];};
const chaikin=P=>{let Q=P;for(let it=0;it<2;it++){const N=[];for(let i=0;i<Q.length;i++){const a=Q[i],b=Q[(i+1)%Q.length];N.push([0.75*a[0]+0.25*b[0],0.75*a[1]+0.25*b[1]],[0.25*a[0]+0.75*b[0],0.25*a[1]+0.75*b[1]]);}Q=N;}return Q;};
for(let i=0;i<segs.length;i++){if(used[i])continue;used[i]=1;const loop=[segs[i][0],segs[i][1]];
  for(;;){const last=loop[loop.length-1],nx=(m.get(kk(last))||[]).find(j=>!used[j]);if(nx===undefined)break;used[nx]=1;const s=segs[nx];loop.push(kk(s[0])===kk(last)?s[1]:s[0]);}
  const A=Math.abs(area(loop))/(F*F);if(A<1.5)continue;
  const s=rdp(loop.length>3?loop.slice(0,-1):loop,EPS*F);if(s.length<3)continue;
  loops.push(chaikin(s).map(p=>[+(p[0]/F).toFixed(2),+(p[1]/F).toFixed(2)]));}
fs.writeFileSync(OUTF,JSON.stringify({W,H,loops}));
console.log('loops',loops.length,'pts',loops.reduce((a,l)=>a+l.length,0));
