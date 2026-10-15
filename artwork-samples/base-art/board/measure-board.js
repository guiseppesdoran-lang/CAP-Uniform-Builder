// Measure the cadet-officer shoulder board photo (images/ranks/C/shoulder_board.png, 288x672 RGBA): silhouette edges,
// stripe bands + colours, button circle, and emblem components -> simplified polygons. Output: board.json (reference pixels).
const fs=require('fs'),dec=require('./dec.js');
const SRC=process.argv[2];const d=dec(SRC),{W,H,ch,st,out}=d;
const A=(x,y)=>out[y*st+x*ch+3],R=(x,y)=>[0,1,2].map(k=>out[y*st+x*ch+k]);
// --- silhouette: left/right edge per row
const L=[],Rr=[];let top=-1,bot=-1;
for(let y=0;y<H;y++){let x0=-1,x1=-1;for(let x=0;x<W;x++)if(A(x,y)>128){if(x0<0)x0=x;x1=x;}
  if(x0>=0){if(top<0)top=y;bot=y;L.push([x0,y]);Rr.push([x1+1,y]);}}
const rdp=(pts,eps)=>{if(pts.length<3)return pts;let dm=0,ix=0;const a=pts[0],b=pts[pts.length-1];
  for(let i=1;i<pts.length-1;i++){const p=pts[i],num=Math.abs((b[0]-a[0])*(a[1]-p[1])-(a[0]-p[0])*(b[1]-a[1])),den=Math.hypot(b[0]-a[0],b[1]-a[1])||1,dd=num/den;if(dd>dm){dm=dd;ix=i;}}
  if(dm>eps)return rdp(pts.slice(0,ix+1),eps).slice(0,-1).concat(rdp(pts.slice(ix),eps));return [a,b];};
const left=rdp(L,0.9),right=rdp(Rr,0.9);
// --- band profile: mean colour over x in [40,250] per row
const prof=[];for(let y=top;y<=bot;y++){let r=0,g=0,b=0,n=0;for(let x=40;x<250;x++){if(A(x,y)<200)continue;const c=R(x,y);r+=c[0];g+=c[1];b+=c[2];n++;}prof.push(n?[r/n,g/n,b/n]:null);}
const cls=c=>{if(!c)return'x';const[r,g,b]=c;if(r>170&&g>170&&b>170)return'W';if(r>80&&g<70&&b<70)return'R';if(b>95&&r<80&&g<90)return'B';if(r<60&&g<60&&b<60)return'K';return'?';};
const segs=[];let cur=null;prof.forEach((c,i)=>{const k=cls(c),y=top+i;if(!cur||cur.k!==k){cur={k,y0:y,y1:y};segs.push(cur);}else cur.y1=y;});
// --- silver mask (engraved emblem): light, low-saturation pixels inside the black field above the stripes
const stripeTop=(segs.find(s=>s.k==='W'&&s.y0>300)||{y0:420}).y0;
const mask=new Uint8Array(W*H);
for(let y=top;y<stripeTop-2;y++)for(let x=0;x<W;x++){if(A(x,y)<200)continue;const[r,g,b]=R(x,y),mx=Math.max(r,g,b),mn=Math.min(r,g,b);if(mx>92&&mx-mn<48)mask[y*W+x]=1;}
// button = brightest big blob in the top 130 rows
const bandDefs=segs.filter(sg=>'WRB'.includes(sg.k)&&sg.y1-sg.y0>=8);
const bands=bandDefs.map(sg=>{let r=0,g=0,b=0,n=0;for(let y=sg.y0+2;y<=sg.y1-2;y++)for(let x=40;x<250;x++){if(A(x,y)<200)continue;const c=R(x,y);r+=c[0];g+=c[1];b+=c[2];n++;}
  const hx=v=>Math.round(v/n).toString(16).padStart(2,'0');return {k:sg.k,y0:sg.y0,y1:sg.y1,color:'#'+hx(r)+hx(g)+hx(b)};});
let kr=0,kg=0,kb=0,kn=0;for(let y=120;y<400;y++)for(let x=30;x<50;x++){const c=R(x,y);kr+=c[0];kg+=c[1];kb+=c[2];kn++;}
const body='#'+[kr,kg,kb].map(v=>Math.round(v/kn).toString(16).padStart(2,'0')).join('');
fs.writeFileSync('board.json',JSON.stringify({W,H,top,bot,left,right,segs,stripeTop,bands,body},null,0));
console.log(JSON.stringify(bands),body);
fs.writeFileSync('mask.bin',Buffer.from(mask));
console.log({W,H,top,bot,leftN:left.length,rightN:right.length,stripeTop});
console.log(segs.filter(s=>s.y1-s.y0>=2).map(s=>s.k+':'+s.y0+'-'+s.y1).join(' '));
console.log('left',JSON.stringify(left));console.log('right',JSON.stringify(right));
