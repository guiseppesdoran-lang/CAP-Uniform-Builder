// Flat-colour vector extraction from a clean rendered figure: k-means classes -> majority filter -> marching squares -> RDP + Chaikin.
// usage: node flat.js src.png x0 y0 w h '[[r,g,b],...]' out.json [bgWhite=1] [majR=1] [eps=0.6]
const fs=require('fs'),dec=require('./dec.js');
const [,,SRC,X0s,Y0s,Ws,Hs,SEEDJ,OUTF,BGs,MAJs,EPSs]=process.argv;
const X0=+X0s,Y0=+Y0s,W=+Ws,H=+Hs,d=dec(SRC),SEEDS=JSON.parse(SEEDJ),BGW=+(BGs??1),MAJ=+(MAJs??1),EPS=+(EPSs??0.6);
const rgb=new Uint8Array(W*H*3);
for(let y=0;y<H;y++)for(let x=0;x<W;x++){const p=d.px(X0+x,Y0+y);for(let k=0;k<3;k++)rgb[(y*W+x)*3+k]=p[k];}
const bg=new Uint8Array(W*H),q=[];
if(BGW){const near=i=>Math.min(rgb[i*3],rgb[i*3+1],rgb[i*3+2])>232;
  const push=(x,y)=>{if(x<0||y<0||x>=W||y>=H)return;const i=y*W+x;if(bg[i]||!near(i))return;bg[i]=1;q.push(i);};
  for(let x=0;x<W;x++){push(x,0);push(x,H-1);}for(let y=0;y<H;y++){push(0,y);push(W-1,y);}
  while(q.length){const i=q.pop(),x=i%W,y=(i/W)|0;push(x+1,y);push(x-1,y);push(x,y+1);push(x,y-1);}}
const C=SEEDS.map(s=>s.slice());let L=new Int8Array(W*H).fill(-1);
for(let it=0;it<10;it++){const sum=C.map(()=>[0,0,0,0]);
  for(let i=0;i<W*H;i++){if(bg[i])continue;const r=rgb[i*3],g=rgb[i*3+1],b=rgb[i*3+2];let bk=0,bd=1e9;C.forEach((c,k)=>{const dd=(r-c[0])**2+(g-c[1])**2+(b-c[2])**2;if(dd<bd){bd=dd;bk=k;}});L[i]=bk;const s=sum[bk];s[0]+=r;s[1]+=g;s[2]+=b;s[3]++;}
  C.forEach((c,k)=>{const s=sum[k];if(s[3])for(let j=0;j<3;j++)c[j]=s[j]/s[3];});}
for(let pass=0;pass<2;pass++){const N=L.slice();
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=y*W+x;if(bg[i])continue;const cnt={};let bk=L[i],bc=0;
    for(let dy=-MAJ;dy<=MAJ;dy++)for(let dx=-MAJ;dx<=MAJ;dx++){const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=W||yy>=H||bg[yy*W+xx])continue;const v=L[yy*W+xx];cnt[v]=(cnt[v]||0)+1;if(cnt[v]>bc){bc=cnt[v];bk=v;}}N[i]=bk;}
  L=N;}
function loopsFor(mk,minA){const segs=[];
  for(let y=-1;y<H;y++)for(let x=-1;x<W;x++){const a=mk(x,y),b=mk(x+1,y),c=mk(x+1,y+1),dd=mk(x,y+1),idx=a*8+b*4+c*2+dd;if(idx===0||idx===15)continue;
    const T=[x+0.5,y],Rg=[x+1,y+0.5],Bt=[x+0.5,y+1],Lf=[x,y+0.5],add=(p,q2)=>segs.push([p,q2]);
    switch(idx){case 1:add(Lf,Bt);break;case 2:add(Bt,Rg);break;case 3:add(Lf,Rg);break;case 4:add(T,Rg);break;case 5:add(T,Lf);add(Bt,Rg);break;case 6:add(T,Bt);break;case 7:add(T,Lf);break;case 8:add(T,Lf);break;case 9:add(T,Bt);break;case 10:add(T,Rg);add(Lf,Bt);break;case 11:add(T,Rg);break;case 12:add(Lf,Rg);break;case 13:add(Bt,Rg);break;case 14:add(Lf,Bt);break;}}
  const kk=p=>p[0]+','+p[1],m=new Map();segs.forEach((s,i)=>{for(const p of s){const k=kk(p);if(!m.has(k))m.set(k,[]);m.get(k).push(i);}});
  const used=new Uint8Array(segs.length),out=[];
  const area=p=>{let a=0;for(let i=0;i<p.length;i++){const q2=p[(i+1)%p.length];a+=p[i][0]*q2[1]-q2[0]*p[i][1];}return a/2;};
  const rdp=(pts,e)=>{if(pts.length<3)return pts;let dm=0,ix=0;const a=pts[0],b=pts[pts.length-1];for(let i=1;i<pts.length-1;i++){const p=pts[i],num=Math.abs((b[0]-a[0])*(a[1]-p[1])-(a[0]-p[0])*(b[1]-a[1])),den=Math.hypot(b[0]-a[0],b[1]-a[1])||1,v=num/den;if(v>dm){dm=v;ix=i;}}
    if(dm>e)return rdp(pts.slice(0,ix+1),e).slice(0,-1).concat(rdp(pts.slice(ix),e));return [a,b];};
  const chaikin=P=>{let Q=P;for(let it=0;it<2;it++){const N=[];for(let i=0;i<Q.length;i++){const a=Q[i],b=Q[(i+1)%Q.length];N.push([0.75*a[0]+0.25*b[0],0.75*a[1]+0.25*b[1]],[0.25*a[0]+0.75*b[0],0.25*a[1]+0.75*b[1]]);}Q=N;}return Q;};
  for(let i=0;i<segs.length;i++){if(used[i])continue;used[i]=1;const loop=[segs[i][0],segs[i][1]];
    for(;;){const last=loop[loop.length-1],nx=(m.get(kk(last))||[]).find(j=>!used[j]);if(nx===undefined)break;used[nx]=1;const s=segs[nx];loop.push(kk(s[0])===kk(last)?s[1]:s[0]);}
    const A=Math.abs(area(loop));if(A<minA)continue;const s=rdp(loop.length>3?loop.slice(0,-1):loop,EPS);if(s.length>=3)out.push(chaikin(s).map(p=>[+p[0].toFixed(1),+p[1].toFixed(1)]));}
  return out;}
const hex=c=>'#'+c.map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');
const layers=C.map((c,k)=>({k,color:hex(c),loops:loopsFor((x,y)=>(x>=0&&y>=0&&x<W&&y<H&&!bg[y*W+x]&&L[y*W+x]===k)?1:0,12)}));
const nonbg=loopsFor((x,y)=>(x>=0&&y>=0&&x<W&&y<H&&!bg[y*W+x])?1:0,60);
fs.writeFileSync(OUTF,JSON.stringify({w:W,h:H,sil:nonbg,layers}));
layers.forEach(l=>console.log(l.k,l.color,'loops',l.loops.length,'pts',l.loops.reduce((a,p)=>a+p.length,0)));
