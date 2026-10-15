// Silhouette of an RGBA figure (alpha>128) -> smooth outline polygon (largest loop). usage: node sil.js in.png out.json [factor=1] [eps=0.8]
const fs=require('fs'),dec=require('./dec.js');const [,,SRC,OUTF,Fs,Es]=process.argv;const F=+(Fs||1),EPS=+(Es||0.8);
const d=dec(SRC),W=d.W,H=d.H,A=new Uint8Array(W*H);for(let y=0;y<H;y++)for(let x=0;x<W;x++)A[y*W+x]=d.px(x,y)[3]>128?1:0;
const mk=(x,y)=>(x>=0&&y>=0&&x<W&&y<H&&A[y*W+x])?1:0;const segs=[];
for(let y=-1;y<H;y++)for(let x=-1;x<W;x++){const a=mk(x,y),b=mk(x+1,y),c=mk(x+1,y+1),dd=mk(x,y+1),idx=a*8+b*4+c*2+dd;if(idx===0||idx===15)continue;
  const T=[x+0.5,y],R=[x+1,y+0.5],B=[x+0.5,y+1],L=[x,y+0.5],add=(p,q)=>segs.push([p,q]);
  switch(idx){case 1:add(L,B);break;case 2:add(B,R);break;case 3:add(L,R);break;case 4:add(T,R);break;case 5:add(T,L);add(B,R);break;case 6:add(T,B);break;case 7:add(T,L);break;case 8:add(T,L);break;case 9:add(T,B);break;case 10:add(T,R);add(L,B);break;case 11:add(T,R);break;case 12:add(L,R);break;case 13:add(B,R);break;case 14:add(L,B);break;}}
const kk=p=>p[0]+','+p[1],m=new Map();segs.forEach((s,i)=>{for(const p of s){const k=kk(p);if(!m.has(k))m.set(k,[]);m.get(k).push(i);}});
const used=new Uint8Array(segs.length);let best=null,bestA=0;
const area=p=>{let a=0;for(let i=0;i<p.length;i++){const q=p[(i+1)%p.length];a+=p[i][0]*q[1]-q[0]*p[i][1];}return Math.abs(a/2);};
for(let i=0;i<segs.length;i++){if(used[i])continue;used[i]=1;const loop=[segs[i][0],segs[i][1]];
  for(;;){const last=loop[loop.length-1],nx=(m.get(kk(last))||[]).find(j=>!used[j]);if(nx===undefined)break;used[nx]=1;const s=segs[nx];loop.push(kk(s[0])===kk(last)?s[1]:s[0]);}
  const a=area(loop);if(a>bestA){bestA=a;best=loop;}}
const rdp=(pts,e)=>{if(pts.length<3)return pts;let dm=0,ix=0;const a=pts[0],b=pts[pts.length-1];for(let i=1;i<pts.length-1;i++){const p=pts[i],num=Math.abs((b[0]-a[0])*(a[1]-p[1])-(a[0]-p[0])*(b[1]-a[1])),den=Math.hypot(b[0]-a[0],b[1]-a[1])||1,v=num/den;if(v>dm){dm=v;ix=i;}}
  if(dm>e)return rdp(pts.slice(0,ix+1),e).slice(0,-1).concat(rdp(pts.slice(ix),e));return [a,b];};
let P=rdp(best.slice(0,-1),EPS);for(let it=0;it<(+process.env.CHAIKIN||0);it++){const N=[];for(let i=0;i<P.length;i++){const a=P[i],b=P[(i+1)%P.length];N.push([0.75*a[0]+0.25*b[0],0.75*a[1]+0.25*b[1]],[0.25*a[0]+0.75*b[0],0.25*a[1]+0.75*b[1]]);}P=N;}
fs.writeFileSync(OUTF,JSON.stringify({W,H,outline:P.map(p=>[+p[0].toFixed(1),+p[1].toFixed(1)])}));console.log('sil pts',P.length,'area',Math.round(bestA));
