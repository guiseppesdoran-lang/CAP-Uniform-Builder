// Geometry for the ground-team wreath: one source of truth for the SVG writer, the pixel rasteriser and the fitter.
const rad=d=>d*Math.PI/180;
const CX=120;

const DEFAULT={
  stem:{a:93,lowA:1.0,cy:122,up:58,low:60},
  sweepEnd:-30,pull:0.3,bandW:6,rimW:6,round:0.6,taper:0.25,
  nodes:{n:7,phi0:4,phi1:108},
  // leaves grow from the stem ("phantom centre line"): th = angle off the stem direction, outward / inward row
  leaf:{adv:22,d:12,wid:20},            // identical size inside and out: tip lands adv degrees up the arc, d px off the stem
};

// left-side coordinates; right side is the mirror image
function leftWreath(P){
  const E=P.stem,a0=90,a1=P.sweepEnd,span=a0-a1;
  const pt=ang=>{const s=Math.sin(rad(ang)),c=Math.cos(rad(ang)),b=s>=0?E.low:E.up,A=E.a*(1+(E.lowA-1)*Math.max(0,s));return [CX-A*c,E.cy+b*s];};
  const pull=t=>1-P.pull*Math.pow(Math.max(0,(t-0.55)/0.45),1.4);
  const stem=(ang)=>{const t=(a0-ang)/span,[x,y]=pt(ang);return [CX+(x-CX)*pull(t),y];};
  const band=[],aEnd=Math.max(a1,90-P.nodes.phi1);for(let i=0;i<=60;i++)band.push(stem(a0+(aEnd-a0)*i/60));
  const leaves=[],rim=[];
  const {n,phi0,phi1}=P.nodes,LF=P.leaf;
  for(let q=0;q<=40;q++){const phi=phi0+(phi1-phi0)*q/40,ang=90-phi,t=Math.max(0,Math.min(1,phi/span)),kk=1-P.taper*t;
    const ta=ang-LF.adv*kk,[x0,y0]=stem(ta),[x1,y1]=stem(ta-0.5),tt=Math.atan2(y1-y0,x1-x0)*180/Math.PI,nr=tt-90;
    rim.push([x0+Math.cos(rad(nr))*LF.d*kk,y0+Math.sin(rad(nr))*LF.d*kk]);}
  for(const row of ['i','o'])for(let k=0;k<n;k++){
    const phi=n===1?phi0:phi0+(phi1-phi0)*k/(n-1);
    const ang=90-phi,t=Math.max(0,Math.min(1,phi/span));
    const kk=1-P.taper*t,wid=LF.wid*kk;
    const [x,y]=stem(ang);                                   // base on the phantom centre line
    const ta=ang-LF.adv*kk,[tx0,ty0]=stem(ta),[tx1,ty1]=stem(ta-0.5);
    const tt=Math.atan2(ty1-ty0,tx1-tx0)*180/Math.PI,nr=tt-90;  // outward normal at the tip
    const sgn=row==='o'?1:-1;
    const tx=tx0+Math.cos(rad(nr))*LF.d*kk*sgn,ty=ty0+Math.sin(rad(nr))*LF.d*kk*sgn;  // tips ride smooth offset curves
    const dx=tx-x,dy=ty-y,len=Math.hypot(dx,dy),ux=dx/len,uy=dy/len,vx=-uy,vy=ux;
    const N=14,up=[],dn=[];
    for(let q=0;q<=N;q++){const u=q/N,w=wid/2*Math.pow(Math.sin(Math.PI*Math.pow(u,0.72)),P.round);
      const px=x+ux*len*u,py=y+uy*len*u;up.push([px+vx*w,py+vy*w]);dn.push([px-vx*w,py-vy*w]);}
    leaves.push({row,poly:[...up,...dn.reverse()],spine:[[x,y],[tx,ty]]});
  }
  return {band,leaves,rim};
}
const mirror=pts=>pts.map(([x,y])=>[2*CX-x,y]);
function wreath(P){
  const L=leftWreath(P);
  return {
    bands:[L.band,mirror(L.band)],
    rims:[L.rim,mirror(L.rim)],
    leaves:[...L.leaves,...L.leaves.map(l=>({row:l.row,poly:mirror(l.poly),spine:mirror(l.spine)}))],
  };
}

// ---------- fixed parts (measured earlier) ----------
const FIXED={
  star:{cx:119.5,cy:32.4,R:28.4,ratio:0.5},
  disc:{cx:119,cy:108,R:55,rim:50},
  ribbon:{y0:146,y1:196,half:17,w:9},
};
DEFAULT.fixed=JSON.parse(JSON.stringify(FIXED));
function starPts(S){const p=[];for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?S.R*S.ratio:S.R;p.push([S.cx+r*Math.cos(a),S.cy+r*Math.sin(a)]);}return p;}

// ---------- rasteriser ----------
const W=240,H=203;
function fillPoly(buf,pts,v){
  let y0=Infinity,y1=-Infinity;for(const p of pts){y0=Math.min(y0,p[1]);y1=Math.max(y1,p[1]);}
  y0=Math.max(0,Math.floor(y0));y1=Math.min(H-1,Math.ceil(y1));
  const n=pts.length;
  for(let y=y0;y<=y1;y++){const yc=y+0.5,xs=[];
    for(let i=0;i<n;i++){const a=pts[i],b=pts[(i+1)%n];
      if((a[1]<=yc&&b[1]>yc)||(b[1]<=yc&&a[1]>yc))xs.push(a[0]+(yc-a[1])/(b[1]-a[1])*(b[0]-a[0]));}
    xs.sort((p,q)=>p-q);
    for(let k=0;k+1<xs.length;k+=2){const xa=Math.max(0,Math.ceil(xs[k]-0.5)),xb=Math.min(W-1,Math.floor(xs[k+1]-0.5));
      for(let x=xa;x<=xb;x++)buf[y*W+x]=v;}}
}
function capsule(buf,a,b,r,v){
  const x0=Math.max(0,Math.floor(Math.min(a[0],b[0])-r)),x1=Math.min(W-1,Math.ceil(Math.max(a[0],b[0])+r));
  const y0=Math.max(0,Math.floor(Math.min(a[1],b[1])-r)),y1=Math.min(H-1,Math.ceil(Math.max(a[1],b[1])+r));
  const dx=b[0]-a[0],dy=b[1]-a[1],L2=dx*dx+dy*dy||1;
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
    let t=((x+0.5-a[0])*dx+(y+0.5-a[1])*dy)/L2;t=Math.max(0,Math.min(1,t));
    const px=a[0]+t*dx-(x+0.5),py=a[1]+t*dy-(y+0.5);
    if(px*px+py*py<=r*r)buf[y*W+x]=v;}
}
function disc(buf,cx,cy,R,v){for(let y=Math.max(0,Math.floor(cy-R));y<=Math.min(H-1,Math.ceil(cy+R));y++)for(let x=Math.max(0,Math.floor(cx-R));x<=Math.min(W-1,Math.ceil(cx+R));x++){const dx=x+0.5-cx,dy=y+0.5-cy;if(dx*dx+dy*dy<=R*R)buf[y*W+x]=v;}}
function line(buf,a,b,v){const n=Math.ceil(Math.max(Math.abs(b[0]-a[0]),Math.abs(b[1]-a[1]))*2)||1;
  for(let i=0;i<=n;i++){const x=Math.floor(a[0]+(b[0]-a[0])*i/n),y=Math.floor(a[1]+(b[1]-a[1])*i/n);if(x>=0&&y>=0&&x<W&&y<H)buf[y*W+x]=v;}}

function silhouette(P){
  const w=wreath(P),m=new Uint8Array(W*H);
  for(const b of w.bands)for(let i=0;i<b.length-1;i++)capsule(m,b[i],b[i+1],P.bandW/2,1);
  for(const l of w.leaves)fillPoly(m,l.poly,1);
  for(const r of w.rims)for(let i=0;i<r.length-1;i++)capsule(m,r[i],r[i+1],(P.rimW||0)/2,1);
  const F=P.fixed||FIXED,R=F.ribbon;
  for(const [a,b] of [[-1,1],[1,-1]]){const A=[CX+a*R.half,R.y0],B=[CX+b*R.half,R.y1];
    const dx=B[0]-A[0],dy=B[1]-A[1],L=Math.hypot(dx,dy),nx=-dy/L*R.w/2,ny=dx/L*R.w/2;
    fillPoly(m,[[A[0]+nx,A[1]+ny],[B[0]+nx,B[1]+ny],[B[0]-nx,B[1]-ny],[A[0]-nx,A[1]-ny]],1);}
  disc(m,F.disc.cx,F.disc.cy,F.disc.R,1);
  fillPoly(m,starPts(F.star),1);
  return m;
}
// luminance-like image with leaf outlines, for the orientation comparison
function relief(P){
  const w=wreath(P),m=new Float32Array(W*H).fill(255),buf=new Uint8Array(W*H);
  const put=(mask,v)=>{for(let i=0;i<W*H;i++)if(mask[i])m[i]=v;};
  const tmp=new Uint8Array(W*H);
  for(const b of w.bands){tmp.fill(0);for(let i=0;i<b.length-1;i++)capsule(tmp,b[i],b[i+1],P.bandW/2,1);put(tmp,170);}
  for(const row of ['i','o'])for(const l of w.leaves){if(l.row!==row)continue;
    tmp.fill(0);fillPoly(tmp,l.poly,1);put(tmp,215);
    const e=new Uint8Array(W*H);for(let i=0;i<l.poly.length;i++)line(e,l.poly[i],l.poly[(i+1)%l.poly.length],1);
    for(let i=0;i<W*H;i++)if(e[i]&&tmp[i]||e[i])m[i]=60;
    line(e,l.spine[0],l.spine[1],1);}
  {const F=P.fixed||FIXED;tmp.fill(0);disc(tmp,F.disc.cx,F.disc.cy,F.disc.R,1);put(tmp,225);}
  return m;
}
module.exports={DEFAULT,FIXED,wreath,silhouette,relief,starPts,W,H,CX,mirror,rad};
