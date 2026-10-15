// Seam / edge centrelines measured from the base blazer image: dark thin-line pixels -> Zhang-Suen thinning -> traced polylines (open paths).
// usage: node skel.js male_semi_formal.png blazer_seams.json [thresh]
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
  ||(y<=24)
  ||(x>=345&&x<=480&&y>=255&&y<=300);   // breast welt: redrawn as a clean rectangle                                                    // neck cap
const TH=+(process.argv[4]||22);
const LUM=new Float32Array(W*H);for(let y=0;y<H;y++)for(let x=0;x<W;x++)LUM[y*W+x]=lum(x,y);
const loc=(x,y)=>{let s=0,n=0;for(let dy=-5;dy<=5;dy++)for(let dx=-5;dx<=5;dx++){const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=W||yy>=H||!op[yy*W+xx])continue;s+=LUM[yy*W+xx];n++;}return s/n;};
const MASK=new Uint8Array(W*H);for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(inner[y*W+x]&&!excl(x,y)&&LUM[y*W+x]<TH)MASK[y*W+x]=1;
const mk0=(x,y)=>(x>=0&&y>=0&&x<W&&y<H)?MASK[y*W+x]:0;
const mk=(x,y)=>mk0(x,y);

// close 1px gaps (dilate then thin) so dashed fragments join
let M=MASK.slice();
const D=new Uint8Array(W*H);
for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){let v=0;for(let dy=-1;dy<=1&&!v;dy++)for(let dx=-1;dx<=1;dx++)if(M[(y+dy)*W+x+dx]){v=1;break;}D[y*W+x]=v;}
M=D;
// Zhang-Suen thinning
const P=(x,y)=>M[y*W+x];
let changed=true;
while(changed){changed=false;
  for(let pass=0;pass<2;pass++){const rm=[];
    for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){if(!P(x,y))continue;
      const n=[P(x,y-1),P(x+1,y-1),P(x+1,y),P(x+1,y+1),P(x,y+1),P(x-1,y+1),P(x-1,y),P(x-1,y-1)];
      const B=n.reduce((a,v)=>a+v,0);if(B<2||B>6)continue;let A=0;for(let i=0;i<8;i++)if(!n[i]&&n[(i+1)%8])A++;if(A!==1)continue;
      if(pass===0){if(n[0]*n[2]*n[4]||n[2]*n[4]*n[6])continue;}else{if(n[0]*n[2]*n[6]||n[0]*n[4]*n[6])continue;}
      rm.push(y*W+x);}
    if(rm.length){changed=true;for(const i of rm)M[i]=0;}}}
// trace: nodes = endpoints / junctions; walk segments between them
const nb=(x,y)=>{const r=[];for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const xx=x+dx,yy=y+dy;if(xx>=0&&yy>=0&&xx<W&&yy<H&&M[yy*W+xx])r.push([xx,yy]);}return r;};
const deg=new Int8Array(W*H);for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(M[y*W+x])deg[y*W+x]=nb(x,y).length;
const seen=new Uint8Array(W*H),paths=[];
const walk=(sx,sy,fx,fy)=>{const pts=[[sx,sy]];let x=fx,y=fy,px=sx,py=sy;
  for(;;){pts.push([x,y]);seen[y*W+x]=1;if(deg[y*W+x]!==2)break;
    const nx=nb(x,y).filter(p=>!(p[0]===px&&p[1]===py)&&!seen[p[1]*W+p[0]]);if(!nx.length)break;nx.sort((a,b)=>(Math.abs(a[0]-x)+Math.abs(a[1]-y))-(Math.abs(b[0]-x)+Math.abs(b[1]-y)));px=x;py=y;[x,y]=nx[0];}
  return pts;};
for(let y=0;y<H;y++)for(let x=0;x<W;x++){if(!M[y*W+x]||deg[y*W+x]===2)continue;seen[y*W+x]=1;
  for(const [fx,fy] of nb(x,y)){if(seen[fy*W+fx]&&deg[fy*W+fx]===2)continue;const p=walk(x,y,fx,fy);if(p.length>1)paths.push(p);}}
// leftover closed loops
for(let y=0;y<H;y++)for(let x=0;x<W;x++){if(M[y*W+x]&&!seen[y*W+x]){const n=nb(x,y);if(n.length){seen[y*W+x]=1;const p=walk(x,y,n[0][0],n[0][1]);if(p.length>1)paths.push(p);}}}
const rdp=(pts,e)=>{if(pts.length<3)return pts;let dm=0,ix=0;const a=pts[0],b=pts[pts.length-1];for(let i=1;i<pts.length-1;i++){const p=pts[i],num=Math.abs((b[0]-a[0])*(a[1]-p[1])-(a[0]-p[0])*(b[1]-a[1])),den=Math.hypot(b[0]-a[0],b[1]-a[1])||1,v=num/den;if(v>dm){dm=v;ix=i;}}
  if(dm>e)return rdp(pts.slice(0,ix+1),e).slice(0,-1).concat(rdp(pts.slice(ix),e));return [a,b];};
const len=p=>{let s=0;for(let i=1;i<p.length;i++)s+=Math.hypot(p[i][0]-p[i-1][0],p[i][1]-p[i-1][1]);return s;};
const out=paths.filter(p=>len(p)>=12).map(p=>rdp(p,1.1).map(q=>[q[0],q[1]]));
fs.writeFileSync(OUTF,JSON.stringify({W,H,paths:out}));
console.log('seam paths',out.length,'pts',out.reduce((a,p)=>a+p.length,0));
