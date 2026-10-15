// CAP Command Patch (CAPR 39-1 Fig A6-4, the regulation's own illustration) -> clean vector layers.
// Input is the flat-colour extraction written by flat.js (gold, navy, white, red classes, crop px).
// Raster staircase noise is removed by Ramer-Douglas-Peucker plus a total-least-squares line fit on every straight run,
// with adjacent fitted lines intersected for crisp corners. Specks below MINA px^2 are dropped. No raster is embedded.
// usage: node cmdpatch.js flat.json out.json
const fs=require('fs');
const [,,SRC,OUTF]=process.argv;const J=JSON.parse(fs.readFileSync(SRC));
const area=p=>{let a=0;for(let i=0;i<p.length;i++){const q=p[(i+1)%p.length];a+=p[i][0]*q[1]-q[0]*p[i][1];}return a/2;};
function rdpOpen(pts,e){if(pts.length<3)return pts.slice();let dm=0,ix=0;const a=pts[0],b=pts[pts.length-1];
  for(let i=1;i<pts.length-1;i++){const p=pts[i],num=Math.abs((b[0]-a[0])*(a[1]-p[1])-(a[0]-p[0])*(b[1]-a[1])),den=Math.hypot(b[0]-a[0],b[1]-a[1])||1,v=num/den;if(v>dm){dm=v;ix=i;}}
  if(dm>e)return rdpOpen(pts.slice(0,ix+1),e).slice(0,-1).concat(rdpOpen(pts.slice(ix),e));return [a,b];}
// closed-loop RDP: split at the two points furthest apart so no corner is lost
function rdpClosed(loop,e){let ia=0,ib=0,best=-1;
  const a0=loop[0];loop.forEach((p,i)=>{const d=Math.hypot(p[0]-a0[0],p[1]-a0[1]);if(d>best){best=d;ib=i;}});
  best=-1;const b0=loop[ib];loop.forEach((p,i)=>{const d=Math.hypot(p[0]-b0[0],p[1]-b0[1]);if(d>best){best=d;ia=i;}});
  const lo=Math.min(ia,ib),hi=Math.max(ia,ib);
  const s1=loop.slice(lo,hi+1),s2=loop.slice(hi).concat(loop.slice(0,lo+1));
  return rdpOpen(s1,e).slice(0,-1).concat(rdpOpen(s2,e).slice(0,-1));}
// original-point index of each RDP vertex, so runs between vertices can be line-fitted
function fitLoop(loop,e,fit){
  const v=rdpClosed(loop,e);if(!fit||v.length<3)return v;
  const idx=v.map(p=>loop.findIndex(q=>q[0]===p[0]&&q[1]===p[1]));
  const n=loop.length,L=[];
  for(let k=0;k<v.length;k++){const i0=idx[k],i1=idx[(k+1)%v.length];const run=[];
    for(let i=i0;;i=(i+1)%n){run.push(loop[i]);if(i===i1)break;if(run.length>n)break;}
    // total least squares line through the run (interior 80% to avoid corner rounding)
    const cut=Math.floor(run.length*0.1),r=run.length>12?run.slice(cut,run.length-cut):run;
    const mx=r.reduce((s,p)=>s+p[0],0)/r.length,my=r.reduce((s,p)=>s+p[1],0)/r.length;
    let sxx=0,syy=0,sxy=0;r.forEach(p=>{sxx+=(p[0]-mx)**2;syy+=(p[1]-my)**2;sxy+=(p[0]-mx)*(p[1]-my);});
    const th=0.5*Math.atan2(2*sxy,sxx-syy);L.push({p:[mx,my],d:[Math.cos(th),Math.sin(th)],len:Math.hypot(v[(k+1)%v.length][0]-v[k][0],v[(k+1)%v.length][1]-v[k][1])});}
  const out=[];
  for(let k=0;k<v.length;k++){const A=L[(k-1+v.length)%v.length],B=L[k];
    const den=A.d[0]*B.d[1]-A.d[1]*B.d[0];
    if(Math.abs(den)<0.15||A.len<6||B.len<6){out.push(v[k]);continue;}
    const t=((B.p[0]-A.p[0])*B.d[1]-(B.p[1]-A.p[1])*B.d[0])/den;
    const x=A.p[0]+A.d[0]*t,y=A.p[1]+A.d[1]*t;
    out.push(Math.hypot(x-v[k][0],y-v[k][1])>8?v[k]:[x,y]);}
  return out;}
// big loops (shield, triangle, scroll): RDP + line fit for crisp straight edges; small loops (letters, prop, curls): finer RDP + one Chaikin pass
const chaikin=P=>{const N=[];for(let i=0;i<P.length;i++){const a=P[i],b=P[(i+1)%P.length];N.push([0.75*a[0]+0.25*b[0],0.75*a[1]+0.25*b[1]],[0.25*a[0]+0.75*b[0],0.25*a[1]+0.75*b[1]]);}return N;};
const names=['gold','navy','white','red'];
const BIG=4000,MINA=40;
const pip=(pt,poly)=>{let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>pt[1])!==(b[1]>pt[1])&&pt[0]<(b[0]-a[0])*(pt[1]-a[1])/(b[1]-a[1])+a[0])c=!c;}return c;};
const clean=(l,k)=>names[k]==='red'?chaikin(chaikin(fitLoop(l,0.45,false))):Math.abs(area(l))>=BIG?fitLoop(l,1.3,true):chaikin(fitLoop(l,0.7,false));
const out={source:'CAPR 39-1 Fig A6-4 CAP Command Patch',w:J.w,h:J.h,layers:{}};
J.layers.forEach((L,k)=>{out.layers[names[k]]=L.loops.filter(l=>Math.abs(area(l))>=MINA);});
// the white class also picks up the anti-aliased halo outside the patch: drop white loops with a point outside the gold outer outline
const goldOuter=out.layers.gold.slice().sort((a,b)=>Math.abs(area(b))-Math.abs(area(a)))[0];
out.layers.white=out.layers.white.filter(l=>l.every(p=>pip(p,goldOuter)));
for(const n of names)out.layers[n]=out.layers[n].map(l=>clean(l,names.indexOf(n)).map(p=>[+p[0].toFixed(2),+p[1].toFixed(2)]));
// bounding box of everything that is ink
let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;Object.values(out.layers).flat(2).forEach(()=>{});
Object.values(out.layers).forEach(ls=>ls.forEach(l=>l.forEach(p=>{x0=Math.min(x0,p[0]);x1=Math.max(x1,p[0]);y0=Math.min(y0,p[1]);y1=Math.max(y1,p[1]);})));
out.bbox=[x0,y0,x1,y1].map(v=>+v.toFixed(2));
fs.writeFileSync(OUTF,JSON.stringify(out));
console.log('bbox',out.bbox,'aspect w/h',((x1-x0)/(y1-y0)).toFixed(3));
for(const n of names)console.log(n,out.layers[n].length,'loops',out.layers[n].reduce((s,l)=>s+l.length,0),'pts');
