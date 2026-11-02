'use strict';
// The ink of an asset SVG as polygons, for measuring where a drawn piece really ends (the engine rests insignia on a
// seam by their ink, not their bounding box; see INK_REST in js/engine/profiles-dress.js and scripts/measure-ink-rest.cjs).
// Reads the paths (M L H V Q C Z) and circles the in-house assets use, under nested translate/scale transforms; strokes
// are not added (the largest, 0.04 in on the NCO circle's rim, is under the 0.02 in the tests allow).
const fs=require('fs');
function parseTransform(t){let m=[1,0,0,1,0,0];const mul=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
 for(const mm of (t||'').matchAll(/(translate|scale)\(([^)]*)\)/g)){const v=mm[2].split(/[ ,]+/).filter(Boolean).map(Number);
  if(mm[1]==='translate') m=mul(m,[1,0,0,1,v[0],v[1]||0]); else m=mul(m,[v[0],0,0,v.length>1?v[1]:v[0],0,0]);}
 return m;}
function polys(svg){
  // tokenise tags with a stack for transforms
  const out=[];const stack=[[1,0,0,1,0,0]];
  const mul=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
  const re=/<(\/?)(\w+)([^>]*?)(\/?)>/g;let m;
  while((m=re.exec(svg))){
    const [,close,tag,attrs,self]=m;
    if(tag==='metadata'||tag==='title'){ if(!close&&!self){ const e=svg.indexOf('</'+tag+'>',re.lastIndex); re.lastIndex=e+tag.length+3;} continue; }
    if(close){ if(tag==='g') stack.pop(); continue; }
    const tr=/ transform="([^"]*)"/.exec(attrs); const cur=stack[stack.length-1]; const M=tr?mul(cur,parseTransform(tr[1])):cur;
    if(tag==='g'){ if(!self) stack.push(M); continue; }
    if(tag==='path'){ const d=/ d="([^"]*)"/.exec(attrs)[1]; if(/fill="none"/.test(attrs)&&!/stroke=/.test(attrs)) continue; out.push(...flatten(d,M)); }
    else if(tag==='circle'){ const g=k=>+((new RegExp(' '+k+'="([^"]*)"')).exec(attrs)||[0,0])[1]; const cx=g('cx'),cy=g('cy'),r=g('r'); const pts=[];for(let i=0;i<72;i++){const a=i*Math.PI/36;pts.push([cx+r*Math.cos(a),cy+r*Math.sin(a)]);} out.push(pts.map(p=>[M[0]*p[0]+M[2]*p[1]+M[4],M[1]*p[0]+M[3]*p[1]+M[5]])); }
  }
  return out;
}
function flatten(d,M){
  // Every SVG 1.1 path command, absolute and relative (the official CAP seal uses relative cubics and
  // smooth curves); relative coordinates are made absolute against the current point before sampling.
  const toks=d.match(/[MLHVQCSTZAmlhvqcstza]|-?\d*\.?\d+(?:e-?\d+)?/g);let i=0,cmd,x=0,y=0,sx=0,sy=0;const res=[];let cur=null;
  let px2=null,py2=null; // last control point, for S and T
  const T=(ax,ay)=>[M[0]*ax+M[2]*ay+M[4],M[1]*ax+M[3]*ay+M[5]];
  const num=()=>+toks[i++];
  const cubic=(a,b,c,e,ex,ey)=>{for(let k=1;k<=8;k++){const t=k/8,u=1-t;cur.push(T(u**3*x+3*u*u*t*a+3*u*t*t*c+t**3*ex,u**3*y+3*u*u*t*b+3*u*t*t*e+t**3*ey));}px2=c;py2=e;x=ex;y=ey;};
  const quad=(cx,cy,ex,ey)=>{for(let k=1;k<=8;k++){const t=k/8;cur.push(T((1-t)**2*x+2*(1-t)*t*cx+t*t*ex,(1-t)**2*y+2*(1-t)*t*cy+t*t*ey));}px2=cx;py2=cy;x=ex;y=ey;};
  while(i<toks.length){
    if(/[A-Za-z]/.test(toks[i])) cmd=toks[i++];
    const rel=cmd===cmd.toLowerCase()&&cmd!=='z'; const C=cmd.toUpperCase();
    const rx0=rel?x:0, ry0=rel?y:0;
    if(C==='M'){x=num()+rx0;y=num()+ry0;sx=x;sy=y;cur=[T(x,y)];res.push(cur);cmd=rel?'l':'L';px2=py2=null;}
    else if(C==='L'){x=num()+rx0;y=num()+ry0;cur.push(T(x,y));px2=py2=null;}
    else if(C==='H'){x=num()+rx0;cur.push(T(x,y));px2=py2=null;}
    else if(C==='V'){y=num()+ry0;cur.push(T(x,y));px2=py2=null;}
    else if(C==='Q'){const cx=num()+rx0,cy=num()+ry0,ex=num()+rx0,ey=num()+ry0;quad(cx,cy,ex,ey);}
    else if(C==='T'){const cx=px2==null?x:2*x-px2,cy=py2==null?y:2*y-py2,ex=num()+rx0,ey=num()+ry0;quad(cx,cy,ex,ey);}
    else if(C==='C'){const a=num()+rx0,b=num()+ry0,c=num()+rx0,e=num()+ry0,ex=num()+rx0,ey=num()+ry0;cubic(a,b,c,e,ex,ey);}
    else if(C==='S'){const a=px2==null?x:2*x-px2,b=py2==null?y:2*y-py2,c=num()+rx0,e=num()+ry0,ex=num()+rx0,ey=num()+ry0;cubic(a,b,c,e,ex,ey);}
    else if(C==='A'){
      // Elliptical arc, endpoint form (SVG 1.1 F.6.5): the men's service cap's crown is two half-ellipse arcs.
      let rx=Math.abs(num()),ry=Math.abs(num());const phi=num()*Math.PI/180,fa=num(),fs=num(),ex=num()+rx0,ey=num()+ry0;
      const c=Math.cos(phi),s=Math.sin(phi),dx=(x-ex)/2,dy=(y-ey)/2,x1=c*dx+s*dy,y1=-s*dx+c*dy;
      const lam=x1*x1/(rx*rx)+y1*y1/(ry*ry);if(lam>1){rx*=Math.sqrt(lam);ry*=Math.sqrt(lam);}
      const num2=rx*rx*ry*ry-rx*rx*y1*y1-ry*ry*x1*x1,den=rx*rx*y1*y1+ry*ry*x1*x1,k=(fa===fs?-1:1)*Math.sqrt(Math.max(0,num2/den));
      const cxp=k*rx*y1/ry,cyp=-k*ry*x1/rx,cx=c*cxp-s*cyp+(x+ex)/2,cy=s*cxp+c*cyp+(y+ey)/2;
      const ang=(ux,uy,vx,vy)=>{const a=Math.atan2(ux*vy-uy*vx,ux*vx+uy*vy);return a;};
      const th1=ang(1,0,(x1-cxp)/rx,(y1-cyp)/ry);let dth=ang((x1-cxp)/rx,(y1-cyp)/ry,(-x1-cxp)/rx,(-y1-cyp)/ry);
      if(!fs&&dth>0)dth-=2*Math.PI;else if(fs&&dth<0)dth+=2*Math.PI;
      for(let k2=1;k2<=24;k2++){const t=th1+dth*k2/24;cur.push(T(c*rx*Math.cos(t)-s*ry*Math.sin(t)+cx,s*rx*Math.cos(t)+c*ry*Math.sin(t)+cy));}
      x=ex;y=ey;px2=py2=null;}
    else if(C==='Z'){x=sx;y=sy;px2=py2=null;}
    else throw new Error('cmd '+cmd);
  }
  return res;
}

// The lower chain (the side facing +y, the ground) of the convex hull of every polygon point: the vertices a straight
// line resting on the piece from below the seam can touch.
function lowerHull(P){
  const pts=[].concat(...P).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  const cross=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
  const h=[];
  for(const p of pts){while(h.length>=2&&cross(h[h.length-2],h[h.length-1],p)>=0)h.pop();h.push(p);}
  return h;
}

// The garment sheet's silhouette (its clipSil path, M/L/Z only) as polygons in sheet inches, and the x crossings of a
// horizontal line with it, sorted.
function silhouette(svg){
  const art=/<g id="[^"]*__art" transform="translate\(([-\d.]+) ([-\d.]+)\) scale\(([-\d.]+)\)"/.exec(svg);
  const m=/<clipPath id="[^"]*clipSil"[^>]*>\s*<path d="([^"]*)"/.exec(svg);
  if(!art||!m) return null;
  const [ax,ay,sc]=[+art[1],+art[2],+art[3]];
  const subs=[];let cur=null;
  for(const t of m[1].matchAll(/([MLZ])\s*(-?[\d.]+)?[ ,]?(-?[\d.]+)?/g)){
    if(t[1]==='M'){cur=[];subs.push(cur);cur.push([+t[2],+t[3]]);}else if(t[1]==='L'){cur.push([+t[2],+t[3]]);}
  }
  return subs.map(p=>p.map(([x,y])=>[(ax+x*sc)/100,(ay+y*sc)/100]));
}
function scanline(subs,y){
  const xs=[];
  for(const p of subs)for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];if((a[1]<=y&&b[1]>y)||(b[1]<=y&&a[1]>y))xs.push(a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1]));}
  return xs.sort((a,b)=>a-b);
}
module.exports={polys,lowerHull,silhouette,scanline,flatten};
if(false){
 const f=process.argv[2];const svg=fs.readFileSync(f,'utf8');const P=polys(svg);
 let minx=1e9,maxx=-1e9,maxy=-1e9,miny=1e9;for(const p of P)for(const [x,y] of p){minx=Math.min(minx,x);maxx=Math.max(maxx,x);maxy=Math.max(maxy,y);miny=Math.min(miny,y);}
 console.log(f.split('/').pop(),'polys',P.length,'bbox',minx.toFixed(2),maxx.toFixed(2),miny.toFixed(2),maxy.toFixed(2));
}
