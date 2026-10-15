// Trace the ABU coat silhouette from a raster into a symmetric vector outline.
// usage: node trace-silhouette.js in.png out.json [inchesPerPx]
const fs=require('fs'),zlib=require('zlib');
function decode(buf){
  let p=8,W,H,ct,idat=[];
  while(p<buf.length){const l=buf.readUInt32BE(p),t=buf.toString('latin1',p+4,p+8),d=buf.subarray(p+8,p+8+l);
    if(t==='IHDR'){W=d.readUInt32BE(0);H=d.readUInt32BE(4);ct=d[9];}
    if(t==='IDAT')idat.push(d);p+=12+l;}
  const ch={2:3,6:4,0:1,4:2}[ct],raw=zlib.inflateSync(Buffer.concat(idat)),st=W*ch,out=Buffer.alloc(H*st);
  for(let y=0;y<H;y++){const f=raw[y*(st+1)];
    for(let i=0;i<st;i++){const x=raw[y*(st+1)+1+i],a=i>=ch?out[y*st+i-ch]:0,b=y?out[(y-1)*st+i]:0,c=(i>=ch&&y)?out[(y-1)*st+i-ch]:0;
      let v=x;if(f===1)v=x+a;else if(f===2)v=x+b;else if(f===3)v=x+((a+b)>>1);else if(f===4){const pp=a+b-c,pa=Math.abs(pp-a),pb=Math.abs(pp-b),pc=Math.abs(pp-c);v=x+(pa<=pb&&pa<=pc?a:pb<=pc?b:c);}
      out[y*st+i]=v&255;}}
  return {W,H,ch,data:out};
}
const [,,inp,outp,sc]=process.argv, S=+(sc||0.0474);
const im=decode(fs.readFileSync(inp)),{W,H,ch,data}=im;
const fg=new Uint8Array(W*H);
for(let i=0;i<W*H;i++){const r=data[i*ch],g=data[i*ch+1],b=data[i*ch+2],a=ch===4?data[i*ch+3]:255;
  fg[i]=(a>40&&(process.env.ALPHA||(255-Math.min(r,g,b))>14))?1:0;}
// background = flood from border over non-fg; everything else becomes fg (fills holes)
const bg=new Uint8Array(W*H),q=[];
const push=(x,y)=>{if(x<0||y<0||x>=W||y>=H)return;const i=y*W+x;if(bg[i]||fg[i])return;bg[i]=1;q.push(i);};
for(let x=0;x<W;x++){push(x,0);push(x,H-1);}for(let y=0;y<H;y++){push(0,y);push(W-1,y);}
while(q.length){const i=q.pop(),x=i%W,y=(i/W)|0;push(x+1,y);push(x-1,y);push(x,y+1);push(x,y-1);}
let m=new Uint8Array(W*H);for(let i=0;i<W*H;i++)m[i]=bg[i]?0:1;
{ // enclosed non-fg regions: big ones are real gaps (sleeve/body at the waist), small ones are noise
  const seen=new Uint8Array(W*H);
  for(let s0=0;s0<W*H;s0++){if(fg[s0]||bg[s0]||seen[s0])continue;const comp=[s0];seen[s0]=1;
    for(let k=0;k<comp.length;k++){const i=comp[k],x=i%W,y=(i/W)|0;
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=W||ny>=H)continue;const j=ny*W+nx;if(!fg[j]&&!bg[j]&&!seen[j]){seen[j]=1;comp.push(j);}}}
    if(comp.length>=150)for(const i of comp)m[i]=0; }
}
// keep largest component
const lab=new Int32Array(W*H);let best=0,bestN=0,n=0;
for(let s=0;s<W*H;s++){if(!m[s]||lab[s])continue;n++;let c=0;const st=[s];lab[s]=n;
  while(st.length){const i=st.pop();c++;const x=i%W,y=(i/W)|0;
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=W||ny>=H)continue;const j=ny*W+nx;if(m[j]&&!lab[j]){lab[j]=n;st.push(j);}}}
  if(c>bestN){bestN=c;best=n;}}
for(let i=0;i<W*H;i++)m[i]=lab[i]===best?1:0;
// bbox + symmetric (average the two halves' row extents is not enough for the V; mirror left half)
let x0=W,x1=0,y0=H,y1=0;for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(m[y*W+x]){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
const cx=(x0+x1+1)/2;
const sym=new Uint8Array(W*H);
for(let y=0;y<H;y++)for(let x=0;x<W;x++){const mx=Math.round(2*cx-1-x);
  const L=m[y*W+x],R=(mx>=0&&mx<W)?m[y*W+mx]:0;
  // use whichever half holds the pixel: left half from itself, right half from mirror of left
  sym[y*W+x]=(x+0.5<cx)?L:R;}
// outside flood on sym, then outer (filled) mask + hole components
const out2=new Uint8Array(W*H),q2=[];
const p2=(x,y)=>{if(x<0||y<0||x>=W||y>=H)return;const i=y*W+x;if(out2[i]||sym[i])return;out2[i]=1;q2.push(i);};
for(let x=0;x<W;x++){p2(x,0);p2(x,H-1);}for(let y=0;y<H;y++){p2(0,y);p2(W-1,y);}
while(q2.length){const i=q2.pop(),x=i%W,y=(i/W)|0;p2(x+1,y);p2(x-1,y);p2(x,y+1);p2(x,y-1);}
const outer=new Uint8Array(W*H);for(let i=0;i<W*H;i++)outer[i]=out2[i]?0:1;
function trace(mask){
  let sx=-1,sy=-1;outer:for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(mask[y*W+x]){sx=x;sy=y;break outer;}
  const dirs=[[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]];
  const at=(x,y)=>x>=0&&y>=0&&x<W&&y<H&&mask[y*W+x];
  const pts=[[sx,sy]];let x=sx,y=sy,d=6,guard=0;
  do{let found=false;for(let k=0;k<8;k++){const nd=(d+6+k)%8,nx=x+dirs[nd][0],ny=y+dirs[nd][1];
      if(at(nx,ny)){x=nx;y=ny;d=nd;pts.push([x,y]);found=true;break;}}
    if(!found)break;}while((x!==sx||y!==sy||pts.length<3)&&++guard<400000);
  return pts.map(([x,y])=>[x+0.5,y+0.5]);}
function smooth(p,w){const n=p.length,o=[];for(let i=0;i<n;i++){let sx=0,sy=0;for(let k=-w;k<=w;k++){const q=p[(i+k+n)%n];sx+=q[0];sy+=q[1];}o.push([sx/(2*w+1),sy/(2*w+1)]);}return o;}
function rdp(p,e){if(p.length<3)return p;const a=p[0],b=p[p.length-1];let md=0,mi=0;
  const dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy)||1;
  for(let i=1;i<p.length-1;i++){const d=Math.abs(dy*p[i][0]-dx*p[i][1]+b[0]*a[1]-b[1]*a[0])/L;if(d>md){md=d;mi=i;}}
  if(md>e)return rdp(p.slice(0,mi+1),e).slice(0,-1).concat(rdp(p.slice(mi),e));return [a,b];}
function simplify(pts,w,e){const sm=smooth(pts,w),h=sm.length>>1;
  return rdp(sm.slice(0,h+1),e).slice(0,-1).concat(rdp(sm.slice(h).concat([sm[0]]),e).slice(0,-1));}
const toIn=p=>p.map(([x,y])=>[+((x-cx)*S).toFixed(3),+((y-y0)*S).toFixed(3)]);
const outline=simplify(trace(outer),3,1.1);
// holes
const holes=[],seenH=new Uint8Array(W*H);
for(let s0=0;s0<W*H;s0++){if(sym[s0]||out2[s0]||seenH[s0])continue;const comp=[s0];seenH[s0]=1;
  for(let k=0;k<comp.length;k++){const i=comp[k],x=i%W,y=(i/W)|0;
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=W||ny>=H)continue;const j=ny*W+nx;if(!sym[j]&&!out2[j]&&!seenH[j]){seenH[j]=1;comp.push(j);}}}
  if(comp.length<60)continue;
  const hm=new Uint8Array(W*H);for(const i of comp)hm[i]=1;
  holes.push(simplify(trace(hm),2,0.8));}
fs.writeFileSync(outp,JSON.stringify({W,H,cx,y0,y1,x0,x1,scale:S,widthIn:+((x1-x0+1)*S).toFixed(2),heightIn:+((y1-y0+1)*S).toFixed(2),outline:toIn(outline),holes:holes.map(toIn)},null,1));
console.log({cx,x0,x1,y0,y1,outlinePts:outline.length,holes:holes.map(h=>h.length)});
