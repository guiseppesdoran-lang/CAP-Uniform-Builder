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
  const toks=d.match(/[MLHVQCZ]|-?\d*\.?\d+(?:e-?\d+)?/gi);let i=0,cmd,x=0,y=0,sx=0,sy=0;const res=[];let cur=null;
  const T=(px,py)=>[M[0]*px+M[2]*py+M[4],M[1]*px+M[3]*py+M[5]];
  const num=()=>+toks[i++];
  while(i<toks.length){
    if(/[A-Za-z]/.test(toks[i])) cmd=toks[i++]; 
    if(cmd==='M'){x=num();y=num();sx=x;sy=y;cur=[T(x,y)];res.push(cur);cmd='L';}
    else if(cmd==='L'){x=num();y=num();cur.push(T(x,y));}
    else if(cmd==='H'){x=num();cur.push(T(x,y));}
    else if(cmd==='V'){y=num();cur.push(T(x,y));}
    else if(cmd==='Q'){const cx=num(),cy=num(),ex=num(),ey=num();for(let k=1;k<=8;k++){const t=k/8;cur.push(T((1-t)**2*x+2*(1-t)*t*cx+t*t*ex,(1-t)**2*y+2*(1-t)*t*cy+t*t*ey));}x=ex;y=ey;}
    else if(cmd==='C'){const a=num(),b=num(),c=num(),e=num(),ex=num(),ey=num();for(let k=1;k<=8;k++){const t=k/8,u=1-t;cur.push(T(u**3*x+3*u*u*t*a+3*u*t*t*c+t**3*ex,u**3*y+3*u*u*t*b+3*u*t*t*e+t**3*ey));}x=ex;y=ey;}
    else if(cmd==='Z'||cmd==='z'){x=sx;y=sy;}
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
module.exports={polys,lowerHull};
if(false){
 const f=process.argv[2];const svg=fs.readFileSync(f,'utf8');const P=polys(svg);
 let minx=1e9,maxx=-1e9,maxy=-1e9,miny=1e9;for(const p of P)for(const [x,y] of p){minx=Math.min(minx,x);maxx=Math.max(maxx,x);maxy=Math.max(maxy,y);miny=Math.min(miny,y);}
 console.log(f.split('/').pop(),'polys',P.length,'bbox',minx.toFixed(2),maxx.toFixed(2),miny.toFixed(2),maxy.toFixed(2));
}
