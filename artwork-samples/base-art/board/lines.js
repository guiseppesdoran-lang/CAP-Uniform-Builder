// Seam / edge line-art measured from the base blazer image: dark thin-line pixels inside the garment -> marching-squares loops -> simplified polygons.
// usage: node lines.js male_semi_formal.png blazer_lines.json
const fs=require('fs'),dec=require('./dec.js');
const [,,SRC,OUTF]=process.argv;const d=dec(SRC),W=d.W,H=d.H;
const lum=(x,y)=>{const p=d.px(x,y);return p[3]<128?255:0.3*p[0]+0.59*p[1]+0.11*p[2];};
// erode the opaque region so the silhouette edge itself is not read as a line
const op=new Uint8Array(W*H);for(let y=0;y<H;y++)for(let x=0;x<W;x++)op[y*W+x]=d.px(x,y)[3]>=128?1:0;
const inner=new Uint8Array(W*H);
for(let y=3;y<H-3;y++)for(let x=3;x<W-3;x++){let ok=1;for(let dy=-3;dy<=3&&ok;dy++)for(let dx=-3;dx<=3;dx++)if(!op[(y+dy)*W+x+dx]){ok=0;break;}inner[y*W+x]=ok;}
const excl=(x,y)=>(x>=232&&x<=364&&y>=58&&y<=108)             // bow tie
  ||(x>=284&&x<=316&&y>=140&&y<=300)                           // shirt placket buttons
  ||(x>=368&&x<=448&&y>=292&&y<=400)                           // crest
  ||(Math.hypot(x-313,y-379)<17)||(Math.hypot(x-311,y-491)<17)  // buttons
  ||(y<=24);                                                    // neck cap
const TH=+(process.argv[4]||22);
const LUM=new Float32Array(W*H);for(let y=0;y<H;y++)for(let x=0;x<W;x++)LUM[y*W+x]=lum(x,y);
const loc=(x,y)=>{let s=0,n=0;for(let dy=-5;dy<=5;dy++)for(let dx=-5;dx<=5;dx++){const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=W||yy>=H||!op[yy*W+xx])continue;s+=LUM[yy*W+xx];n++;}return s/n;};
const MASK=new Uint8Array(W*H);for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(inner[y*W+x]&&!excl(x,y)&&LUM[y*W+x]<TH&&LUM[y*W+x]<loc(x,y)-2.2)MASK[y*W+x]=1;
const mk0=(x,y)=>(x>=0&&y>=0&&x<W&&y<H)?MASK[y*W+x]:0;
const mk=(x,y)=>mk0(x,y);
function loops(eps,minA){
  const segs=[];
  for(let y=-1;y<H;y++)for(let x=-1;x<W;x++){const a=mk(x,y),b=mk(x+1,y),c=mk(x+1,y+1),dd=mk(x,y+1),idx=a*8+b*4+c*2+dd;if(idx===0||idx===15)continue;
    const T=[x+0.5,y],Rg=[x+1,y+0.5],Bt=[x+0.5,y+1],Lf=[x,y+0.5],add=(p,q)=>segs.push([p,q]);
    switch(idx){case 1:add(Lf,Bt);break;case 2:add(Bt,Rg);break;case 3:add(Lf,Rg);break;case 4:add(T,Rg);break;case 5:add(T,Lf);add(Bt,Rg);break;case 6:add(T,Bt);break;case 7:add(T,Lf);break;case 8:add(T,Lf);break;case 9:add(T,Bt);break;case 10:add(T,Rg);add(Lf,Bt);break;case 11:add(T,Rg);break;case 12:add(Lf,Rg);break;case 13:add(Bt,Rg);break;case 14:add(Lf,Bt);break;}}
  const kk=p=>p[0]+','+p[1],m=new Map();segs.forEach((s,i)=>{for(const p of s){const k=kk(p);if(!m.has(k))m.set(k,[]);m.get(k).push(i);}});
  const used=new Uint8Array(segs.length),out=[];
  const area=p=>{let a=0;for(let i=0;i<p.length;i++){const q=p[(i+1)%p.length];a+=p[i][0]*q[1]-q[0]*p[i][1];}return a/2;};
  const rdp=(pts,e)=>{if(pts.length<3)return pts;let dm=0,ix=0;const a=pts[0],b=pts[pts.length-1];for(let i=1;i<pts.length-1;i++){const p=pts[i],num=Math.abs((b[0]-a[0])*(a[1]-p[1])-(a[0]-p[0])*(b[1]-a[1])),den=Math.hypot(b[0]-a[0],b[1]-a[1])||1,v=num/den;if(v>dm){dm=v;ix=i;}}
    if(dm>e)return rdp(pts.slice(0,ix+1),e).slice(0,-1).concat(rdp(pts.slice(ix),e));return [a,b];};
  for(let i=0;i<segs.length;i++){if(used[i])continue;used[i]=1;const loop=[segs[i][0],segs[i][1]];
    for(;;){const last=loop[loop.length-1],nx=(m.get(kk(last))||[]).find(j=>!used[j]);if(nx===undefined)break;used[nx]=1;const s=segs[nx];loop.push(kk(s[0])===kk(last)?s[1]:s[0]);}
    const A=Math.abs(area(loop));if(A<minA)continue;const s=rdp(loop.length>3?loop.slice(0,-1):loop,eps);if(s.length>=3)out.push(s.map(p=>[+p[0].toFixed(1),+p[1].toFixed(1)]));}
  return out;}
const L=loops(0.45,8);
fs.writeFileSync(OUTF,JSON.stringify({W,H,loops:L}));
console.log('line loops',L.length,'pts',L.reduce((a,l)=>a+l.length,0));
