// Silver-emblem geometry measured from the rendered board photo: mask -> marching-squares loops -> simplified polygons (ref px).
const fs=require('fs'),dec=require('./dec.js');
const SRC=process.argv[2],B=JSON.parse(fs.readFileSync('board.json','utf8')),{W,H}=B;
const d=dec(SRC),{st,ch,out}=d;
const px=(x,y)=>[0,1,2].map(k=>out[y*st+x*ch+k]);
const mask=new Uint8Array(W*H);
// brightness field with soft threshold (anti-aliased edges -> sub-pixel contours)
const val=new Float32Array(W*H);
for(let y=0;y<B.stripeTop-2;y++)for(let x=0;x<W;x++){if(out[y*st+x*ch+3]<200)continue;const[r,g,b]=px(x,y),mx=Math.max(r,g,b);val[y*W+x]=mx;}
// button: bright blob in rows 50..110
let bx=0,by=0,bn=0,bx0=1e9,bx1=0,by0=1e9,by1=0;
for(let y=45;y<115;y++)for(let x=90;x<200;x++){if(val[y*W+x]>118){bx+=x;by+=y;bn++;bx0=Math.min(bx0,x);bx1=Math.max(bx1,x);by0=Math.min(by0,y);by1=Math.max(by1,y);}}
const button={cx:bx/bn,cy:by/bn,bbox:[bx0,by0,bx1,by1],n:bn};
// emblem region (below button): rows 118..400
const TH=88;let mk=(x,y)=>(x>=0&&y>=118&&x<W&&y<400&&val[y*W+x]>TH)?1:0;
const BTN={cx:146,cy:93,r:36};
function extract(y0,y1,eps){
const segs=[];const key=(x,y)=>x+','+y;
// marching squares on binary mk (corner-based), edges at integer-half midpoints
for(let y=y0-1;y<y1;y++)for(let x=-1;x<W;x++){
  const a=mk(x,y),b=mk(x+1,y),c=mk(x+1,y+1),dd=mk(x,y+1),idx=a*8+b*4+c*2+dd;
  if(idx===0||idx===15)continue;
  const T=[x+0.5,y],Rg=[x+1,y+0.5],Bt=[x+0.5,y+1],Lf=[x,y+0.5];
  const add=(p,q)=>segs.push([p,q]);
  switch(idx){case 1:add(Lf,Bt);break;case 2:add(Bt,Rg);break;case 3:add(Lf,Rg);break;case 4:add(T,Rg);break;
   case 5:add(T,Lf);add(Bt,Rg);break;case 6:add(T,Bt);break;case 7:add(T,Lf);break;case 8:add(T,Lf);break;case 9:add(T,Bt);break;
   case 10:add(T,Rg);add(Lf,Bt);break;case 11:add(T,Rg);break;case 12:add(Lf,Rg);break;case 13:add(Bt,Rg);break;case 14:add(Lf,Bt);break;}}
// chain
const m=new Map();const kk=p=>p[0]+','+p[1];
segs.forEach((s,i)=>{for(const p of s){const k=kk(p);if(!m.has(k))m.set(k,[]);m.get(k).push(i);}});
const used=new Uint8Array(segs.length),loops=[];
for(let i=0;i<segs.length;i++){if(used[i])continue;used[i]=1;let loop=[segs[i][0],segs[i][1]];
  for(;;){const last=loop[loop.length-1],nx=(m.get(kk(last))||[]).find(j=>!used[j]);if(nx===undefined)break;used[nx]=1;const s=segs[nx];loop.push(kk(s[0])===kk(last)?s[1]:s[0]);}
  loops.push(loop);}
const area=p=>{let a=0;for(let i=0;i<p.length;i++){const q=p[(i+1)%p.length];a+=p[i][0]*q[1]-q[0]*p[i][1];}return a/2;};
const rdp=(pts,eps)=>{if(pts.length<3)return pts;let dm=0,ix=0;const a=pts[0],b=pts[pts.length-1];
  for(let i=1;i<pts.length-1;i++){const p=pts[i],num=Math.abs((b[0]-a[0])*(a[1]-p[1])-(a[0]-p[0])*(b[1]-a[1])),den=Math.hypot(b[0]-a[0],b[1]-a[1])||1,dd=num/den;if(dd>dm){dm=dd;ix=i;}}
  if(dm>eps)return rdp(pts.slice(0,ix+1),eps).slice(0,-1).concat(rdp(pts.slice(ix),eps));return [a,b];};
const res=[];for(const lp of loops){const a=Math.abs(area(lp));if(a<5)continue;const s=rdp(lp.length>3?lp.slice(0,-1):lp,eps);if(s.length>=3)res.push({a:+a.toFixed(1),signed:Math.sign(area(lp)),pts:s.map(p=>[+p[0].toFixed(2),+p[1].toFixed(2)])});}

return res;}
const emb=extract(117,400,0.55).filter(l=>{const xs=l.pts.map(p=>p[0]),ys=l.pts.map(p=>p[1]);return (Math.min(...ys)+Math.max(...ys))/2>140&&Math.max(...xs)>50&&Math.min(...xs)<238;});
mk=(x,y)=>(Math.hypot(x-BTN.cx,y-BTN.cy)<BTN.r-5&&val[y*W+x]>138)?1:0;
const btn=extract(BTN.cy-BTN.r,BTN.cy+BTN.r,0.5);
fs.writeFileSync('emblem.json',JSON.stringify({button:BTN,loops:emb,buttonLoops:btn}));
console.log('emblem loops',emb.length,'pts',emb.reduce((a,l)=>a+l.pts.length,0),'button loops',btn.length);
