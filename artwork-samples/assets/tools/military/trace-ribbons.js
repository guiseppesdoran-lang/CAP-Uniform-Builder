// Simplified vector trace of ribbons whose design is not plain stripes (emblems, borders, diagonals):
// posterise the 220x60 grid (1 cell = 1/160 in) with k-means, then contour each colour region and simplify (RDP).
//   node trace-ribbons.js grid.json ../../ribbons/military/_unresolved.json traces.json
const fs=require('fs');
const [,,GRID,UNRES,OUT]=process.argv;
const G=JSON.parse(fs.readFileSync(GRID)),UN=JSON.parse(fs.readFileSync(UNRES));
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
function trimRows(g,gw,gh){const white=y=>{let m=[0,0,0];for(let x=0;x<gw;x++){const k=(y*gw+x)*3;m[0]+=g[k];m[1]+=g[k+1];m[2]+=g[k+2];}m=m.map(v=>v/gw);
  let v=0;for(let x=0;x<gw;x++){const k=(y*gw+x)*3;v+=Math.abs(g[k]-m[0])+Math.abs(g[k+1]-m[1])+Math.abs(g[k+2]-m[2]);}return Math.min(...m)>236&&v/gw<18;};
  let t=0,b=gh-1;while(t<gh-4&&white(t))t++;while(b>t+4&&white(b))b--;return {t,b};}
function resample(g,gw,gh,outH){ // nearest-row resample so the ribbon fills 60 rows again
  const o=new Float32Array(gw*outH*3);for(let y=0;y<outH;y++){const sy=Math.min(gh-1,Math.floor((y+0.5)*gh/outH));for(let x=0;x<gw;x++)for(let c=0;c<3;c++)o[(y*gw+x)*3+c]=g[(sy*gw+x)*3+c];}return o;}
function median3(g,gw,gh){const o=new Float32Array(g.length);
  for(let y=0;y<gh;y++)for(let x=0;x<gw;x++)for(let c=0;c<3;c++){const v=[];
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=Math.min(gw-1,Math.max(0,x+dx)),yy=Math.min(gh-1,Math.max(0,y+dy));v.push(g[(yy*gw+xx)*3+c]);}
    v.sort((a,b)=>a-b);o[(y*gw+x)*3+c]=v[4];}return o;}
function kmeans(px,k){ // deterministic farthest-point init
  const n=px.length;let cs=[px[0].slice()];
  while(cs.length<k){let best=-1,bd=-1;for(let i=0;i<n;i+=3){const d=Math.min(...cs.map(c=>dist(c,px[i])));if(d>bd){bd=d;best=i;}}cs.push(px[best].slice());}
  const lab=new Int32Array(n);
  for(let it=0;it<14;it++){
    for(let i=0;i<n;i++){let b=0,bd=1e9;for(let c=0;c<cs.length;c++){const d=dist(cs[c],px[i]);if(d<bd){bd=d;b=c;}}lab[i]=b;}
    const sum=cs.map(()=>[0,0,0,0]);for(let i=0;i<n;i++){const s=sum[lab[i]];s[0]+=px[i][0];s[1]+=px[i][1];s[2]+=px[i][2];s[3]++;}
    cs=cs.map((c,j)=>sum[j][3]?[sum[j][0]/sum[j][3],sum[j][1]/sum[j][3],sum[j][2]/sum[j][3]]:c);}
  return {cs,lab};}
function mergeClusters(cs,lab,minDist,minCells){
  let changed=true;
  while(changed){changed=false;
    const cnt=cs.map((_,j)=>0);lab.forEach(l=>cnt[l]++);
    for(let a=0;a<cs.length&&!changed;a++)for(let b=a+1;b<cs.length;b++){
      if(cnt[a]===0||cnt[b]===0)continue;
      if(dist(cs[a],cs[b])<minDist||cnt[a]<minCells||cnt[b]<minCells){
        const [keep,drop]=cnt[a]>=cnt[b]?[a,b]:[b,a];
        if(dist(cs[a],cs[b])>=minDist&&Math.min(cnt[a],cnt[b])>=minCells)continue;
        for(let i=0;i<lab.length;i++)if(lab[i]===drop)lab[i]=keep;cnt[drop]=0;changed=true;break;}}}
  const map=new Map();let next=0;const out=[];
  lab.forEach((l,i)=>{if(!map.has(l)){map.set(l,next++);out.push(cs[l]);}});
  return {cs:out,lab:Int32Array.from(lab,l=>map.get(l))};}
function majority(lab,gw,gh,K){const o=Int32Array.from(lab);
  for(let y=1;y<gh-1;y++)for(let x=1;x<gw-1;x++){const c=new Array(K).fill(0);
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)c[lab[(y+dy)*gw+x+dx]]++;
    let b=lab[y*gw+x];for(let k=0;k<K;k++)if(c[k]>c[b]+1)b=k;o[y*gw+x]=b;}return o;}
// boundary loops of a binary mask (cell edges), as closed integer polylines
function loops(mask,gw,gh){
  const edges=new Map(); // "x,y" -> list of [x2,y2]  (directed, interior on the left)
  const add=(x1,y1,x2,y2)=>{const k=x1+','+y1;(edges.get(k)||edges.set(k,[]).get(k)).push([x2,y2]);};
  const at=(x,y)=>x>=0&&y>=0&&x<gw&&y<gh&&mask[y*gw+x];
  for(let y=0;y<gh;y++)for(let x=0;x<gw;x++){if(!at(x,y))continue;
    if(!at(x,y-1))add(x,y,x+1,y);        // top edge, going right
    if(!at(x+1,y))add(x+1,y,x+1,y+1);    // right edge, going down
    if(!at(x,y+1))add(x+1,y+1,x,y+1);    // bottom edge, going left
    if(!at(x-1,y))add(x,y+1,x,y);}       // left edge, going up
  const out=[];
  while(edges.size){
    const [k0,l0]=edges.entries().next().value;let [sx,sy]=k0.split(',').map(Number);
    const pts=[[sx,sy]];let cx=sx,cy=sy,guard=0;
    for(;;){const k=cx+','+cy,l=edges.get(k);if(!l||!l.length)break;
      const nxt=l.pop();if(!l.length)edges.delete(k);
      cx=nxt[0];cy=nxt[1];if(cx===sx&&cy===sy)break;pts.push([cx,cy]);if(++guard>20000)break;}
    out.push(pts);}
  return out;}
function rdp(p,tol){ // closed polyline simplification
  if(p.length<5)return p;
  const dp=(a)=>{if(a.length<3)return a;const [x1,y1]=a[0],[x2,y2]=a[a.length-1];let m=0,mi=0;
    const dx=x2-x1,dy=y2-y1,L=Math.hypot(dx,dy)||1;
    for(let i=1;i<a.length-1;i++){const d=Math.abs((a[i][0]-x1)*dy-(a[i][1]-y1)*dx)/L;if(d>m){m=d;mi=i;}}
    if(m>tol){const l=dp(a.slice(0,mi+1)),r=dp(a.slice(mi));return l.slice(0,-1).concat(r);}return [a[0],a[a.length-1]];};
  // split at the two most distant points to keep it a loop
  let i0=0,j0=0,md=-1;for(let i=0;i<p.length;i+=Math.max(1,p.length>>5))for(let j=i+1;j<p.length;j+=Math.max(1,p.length>>5)){const d=Math.hypot(p[i][0]-p[j][0],p[i][1]-p[j][1]);if(d>md){md=d;i0=i;j0=j;}}
  const A=p.slice(i0,j0+1),B=p.slice(j0).concat(p.slice(0,i0+1));
  return dp(A).slice(0,-1).concat(dp(B).slice(0,-1));}
const hex=c=>c.map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');
const snap=c=>{if(Math.min(...c)>=228)return [255,255,255];if(Math.max(...c)<=30)return [0,0,0];return c;};
const out={};
for(const u of UN){
  const p='/Users/ethan/UniformBuilder/'+u.image,d=G[p];if(!d){out[u.image]={error:'no grid'};continue;}
  const gw=d.gw,{t,b}=trimRows(d.grid,gw,d.gh),gh=b-t+1;
  let g=Float32Array.from(d.grid.slice(t*gw*3,(b+1)*gw*3));
  g=resample(g,gw,gh,60);g=median3(g,gw,60);const GH=60;
  const px=[];for(let i=0;i<gw*GH;i++)px.push([g[i*3],g[i*3+1],g[i*3+2]]);
  let {cs,lab}=kmeans(px,8);
  ({cs,lab}=mergeClusters(cs,lab,34,gw*GH*0.004));
  lab=majority(lab,gw,GH,cs.length);
  // residual of the posterised image against the grid
  let res=0;for(let i=0;i<gw*GH;i++)res+=dist(px[i],cs[lab[i]]);res/=gw*GH;
  const count=cs.map(()=>0);lab.forEach(l=>count[l]++);
  const order=cs.map((_,i)=>i).sort((a,b)=>count[b]-count[a]);
  const layers=order.map(ci=>{
    const mask=new Uint8Array(gw*GH);lab.forEach((l,i)=>{if(l===ci)mask[i]=1;});
    const ls=loops(mask,gw,GH).map(l=>rdp(l,0.7)).filter(l=>l.length>=3);
    return {hex:hex(snap(cs[ci])),cells:count[ci],area_frac:+(count[ci]/(gw*GH)).toFixed(4),
      loops:ls.map(l=>l.map(([x,y])=>[+(x/gw).toFixed(4),+(y/GH).toFixed(4)]))};});
  out[u.image]={awards:u.awards,grid:[gw,GH],trimmed_rows:{top:t,bottom:d.gh-1-b},clusters:cs.length,residual:+res.toFixed(1),layers};
}
fs.writeFileSync(OUT,JSON.stringify(out));
for(const [p,o] of Object.entries(out))console.log(p.split('/').pop().padEnd(52),o.error||`k=${o.clusters} residual=${o.residual} layers=${o.layers.map(l=>l.hex+':'+l.loops.length).join(' ')}`);
