// Fit the wreath parameters to the reference: maximise silhouette IoU + stroke-orientation agreement.
const fs=require('fs');
const dec=require('./measure.js');
const L=require('./gt-lib.js');
const {W,H}=L;
const REF=process.argv[2];
const ref=dec(REF);
const refMask=new Uint8Array(W*H);for(let i=0;i<W*H;i++)refMask[i]=ref.alpha[i]>100?1:0;
const refLum=new Float32Array(W*H);for(let i=0;i<W*H;i++){const a=ref.alpha[i]/255;refLum[i]=ref.lum[i]*a+255*(1-a);}

// open windows (transparent gaps between wreath and disc) are small but visually essential: weight them
const WIN=new Float32Array(W*H).fill(1);
for(let y=100;y<170;y++)for(let x=0;x<W;x++){const dx=x-120,dy=y-134;const inside=(dx*dx)/(100*100)+(dy*dy)/(48*48)<1;
  const d2=(x-119)**2+(y-108)**2;if(inside&&d2>57*57&&ref.alpha[y*W+x]<=100)WIN[y*W+x]=8;}
// region where the wreath is (outside the disc / star / triangle)
const region=new Uint8Array(W*H);
for(let y=66;y<200;y++)for(let x=0;x<W;x++){const dx=x-119,dy=y-108;if(dx*dx+dy*dy>60*60&&refMask[y*W+x])region[y*W+x]=1;}

function field(lum){
  const g=(x,y)=>lum[Math.max(0,Math.min(H-1,y))*W+Math.max(0,Math.min(W-1,x))];
  const gx=new Float32Array(W*H),gy=new Float32Array(W*H);
  for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){
    gx[y*W+x]=(g(x+1,y-1)+2*g(x+1,y)+g(x+1,y+1))-(g(x-1,y-1)+2*g(x-1,y)+g(x-1,y+1));
    gy[y*W+x]=(g(x-1,y+1)+2*g(x,y+1)+g(x+1,y+1))-(g(x-1,y-1)+2*g(x,y-1)+g(x+1,y-1));}
  const cells=[];
  for(let y=70;y<198;y+=6)for(let x=2;x<W-2;x+=6){
    let jxx=0,jyy=0,jxy=0,n=0,inr=0;
    for(let yy=y;yy<y+8;yy++)for(let xx=x;xx<x+8;xx++){if(xx>=W||yy>=H)continue;const i=yy*W+xx;n++;if(region[i])inr++;
      jxx+=gx[i]*gx[i];jyy+=gy[i]*gy[i];jxy+=gx[i]*gy[i];}
    cells.push({ok:inr>=0.6*n,jxx,jyy,jxy});}
  return cells;
}
const blur=(src)=>{const o=new Float32Array(W*H);for(let y=0;y<H;y++)for(let x=0;x<W;x++){let s=0,n=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy;if(xx>=0&&yy>=0&&xx<W&&yy<H){s+=src[yy*W+xx];n++;}}o[y*W+x]=s/n;}return o;};
const refField=field(refLum);
const refAng=refField.map(c=>{const th=0.5*Math.atan2(2*c.jxy,c.jxx-c.jyy);const tr=c.jxx+c.jyy;const coh=Math.sqrt((c.jxx-c.jyy)**2+4*c.jxy**2)/(tr+1e-9);return {th,w:c.ok?coh*Math.sqrt(tr):0};});
const wsum=refAng.reduce((a,c)=>a+c.w,0);

function score(P,detail){
  const m=L.silhouette(P);let I=0,U=0;
  for(let i=0;i<W*H;i++){const a=m[i],b=refMask[i],w=WIN[i];if(a&&b)I+=w;if(a||b)U+=w;}
  const iou=I/U;
  const f=field(blur(L.relief(P)));let o=0;
  for(let k=0;k<f.length;k++){const w=refAng[k].w;if(!w)continue;const c=f[k];
    const th=0.5*Math.atan2(2*c.jxy,c.jxx-c.jyy);o+=w*(1-Math.cos(2*(th-refAng[k].th)))/2;}
  const orient=o/wsum;
  const cost=(1-iou)+0.12*orient;
  return detail?{iou,orient,cost}:cost;
}

function clone(P){return JSON.parse(JSON.stringify(P));}
const BOUNDS={a:[70,125],lowA:[0.85,1.15],cy:[100,140],up:[35,95],low:[35,80],sweepEnd:[-60,0],pull:[0,0.6],round:[0.3,1.2],taper:[0,0.5]};
const LB={phi:[-5,125],rel:[-70,70],len:[22,80],wid:[8,36],off:[-14,14]};
const clamp=(v,[lo,hi])=>Math.max(lo,Math.min(hi,v));

function genes(P){
  const g=[];
  for(const k of ['a','lowA','cy','up','low'])g.push({get:()=>P.stem[k],set:v=>P.stem[k]=clamp(v,BOUNDS[k]),sc:k==='lowA'?0.02:2});
  for(const k of ['sweepEnd','pull','round','taper'])g.push({get:()=>P[k],set:v=>P[k]=clamp(v,BOUNDS[k]),sc:{sweepEnd:3,pull:0.04,round:0.05,taper:0.04}[k]});
  g.push({get:()=>P.nodes.phi0,set:v=>P.nodes.phi0=clamp(v,[-6,30]),sc:3});
  g.push({get:()=>P.nodes.phi1,set:v=>P.nodes.phi1=clamp(v,[70,130]),sc:3});
  g.push({get:()=>P.rimW,set:v=>P.rimW=clamp(v,[1.8,2.6]),sc:1.2});
  g.push({get:()=>P.leaf.adv,set:v=>P.leaf.adv=clamp(v,[6,50]),sc:3});
  g.push({get:()=>P.leaf.d,set:v=>P.leaf.d=clamp(v,[3,30]),sc:2});
  g.push({get:()=>P.leaf.wid,set:v=>P.leaf.wid=clamp(v,[8,40]),sc:2});
  P.fixed=clone(L.DEFAULT.fixed);   // star / disc / ribbon stay at their hand-measured values
  return g;
}
function seeded(n){
  const P=clone(L.DEFAULT);P.nodes.n=n;
  if(fs.existsSync('gt-params.v4.json')){const prev=JSON.parse(fs.readFileSync('gt-params.v4.json'));Object.assign(P.stem,prev.stem);Object.assign(P.leaf,prev.leaf);P.round=prev.round;P.taper=prev.taper;P.pull=prev.pull;P.sweepEnd=prev.sweepEnd;}
  return P;
}
function fit(P,iters,seed=1){
  let s=seed;const rnd=()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};
  const gauss=()=>{let u=0;for(let i=0;i<4;i++)u+=rnd();return (u-2)*1.7;};
  let best=score(P),g=genes(P);
  for(let it=0;it<iters;it++){
    const temp=1-it/iters,k=1+Math.floor(rnd()*3);
    const undo=[];
    for(let j=0;j<k;j++){const ge=g[Math.floor(rnd()*g.length)];const old=ge.get();undo.push([ge,old]);ge.set(old+gauss()*ge.sc*(0.25+0.75*temp));}
    const c=score(P);
    if(c<=best)best=c;else for(const [ge,old] of undo.reverse())ge.set(old);
  }
  return {P,cost:best};
}

const mode=process.argv[3]||'count';
if(mode==='count'){
  const res=[];
  for(const n of [9,10,11,12]){
    const r=fit(seeded(n),2200,41+n);const d=score(r.P,true);
    res.push({n,...d,P:r.P});
    console.log(`pairs per side ${n}  IoU ${d.iou.toFixed(4)}  orient ${d.orient.toFixed(4)}  cost ${d.cost.toFixed(4)}`);
  }
  res.sort((a,b)=>a.cost-b.cost);
  const top=res[0];console.log('best pairs per side:',top.n);
  fs.writeFileSync('gt-fit-counts.json',JSON.stringify(res.map(r=>({n:r.n,iou:r.iou,orient:r.orient,cost:r.cost})),null,1));
  const refined=fit(top.P,9000,99);const d=score(refined.P,true);
  console.log('refined IoU',d.iou.toFixed(4),'orient',d.orient.toFixed(4));
  fs.writeFileSync('gt-params.json',JSON.stringify(refined.P,null,1));
}else{
  const P=JSON.parse(fs.readFileSync('gt-params.json'));const r=fit(P,+process.argv[4]||4000,5);
  const d=score(r.P,true);console.log('IoU',d.iou.toFixed(4),'orient',d.orient.toFixed(4));
  fs.writeFileSync('gt-params.json',JSON.stringify(r.P,null,1));
}
