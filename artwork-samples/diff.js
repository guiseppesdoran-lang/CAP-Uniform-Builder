const fs=require('fs'),zlib=require('zlib'),{execSync}=require('child_process');
function dec(file){const b=fs.readFileSync(file);let p=8,W,H,ct,id=[];while(p<b.length){const l=b.readUInt32BE(p),t=b.toString('latin1',p+4,p+8),d=b.subarray(p+8,p+8+l);if(t==='IHDR'){W=d.readUInt32BE(0);H=d.readUInt32BE(4);ct=d[9];}else if(t==='IDAT')id.push(d);p+=12+l;}
 const ch={2:3,6:4}[ct],raw=zlib.inflateSync(Buffer.concat(id)),st=W*ch,o=Buffer.alloc(H*st);
 for(let y=0;y<H;y++){const f=raw[y*(st+1)];for(let x=0;x<st;x++){const v=raw[y*(st+1)+1+x],a=x>=ch?o[y*st+x-ch]:0,u=y?o[(y-1)*st+x]:0,c=(x>=ch&&y)?o[(y-1)*st+x-ch]:0;let r=v;if(f===1)r=v+a;else if(f===2)r=v+u;else if(f===3)r=v+((a+u)>>1);else if(f===4){const pp=a+u-c,pa=Math.abs(pp-a),pb=Math.abs(pp-u),pc=Math.abs(pp-c);r=v+(pa<=pb&&pa<=pc?a:pb<=pc?u:c);}o[y*st+x]=r&255;}}
 return {W,H,ch,o};}
const REF=process.env.REF;
execSync('mkdir -p /tmp/gtm; qlmanage -t -s 240 -o /tmp/gtm gt-measure.svg >/dev/null 2>&1');
const m=dec('/tmp/gtm/gt-measure.svg.png'),r=dec(REF);
const mine=(x,y)=>{const yy=y+18,i=(yy*m.W+x)*m.ch;const A=m.o[i+3];if(A<128)return false;const R=m.o[i],G=m.o[i+1],B=m.o[i+2];if(R>230&&G<40&&B>230)return false;return !(R>=254&&G>=254&&B>=254);};
const ref=(x,y)=>r.o[(y*r.W+x)*r.ch+3]>100;

const bb=(f,W,H)=>{let x0=1e9,y0=1e9,x1=-1,y1=-1;for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(f(x,y)){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=y;}return {x0,y0,x1,y1,w:x1-x0+1,h:y1-y0+1};};
const mm=(x,y)=>mine(x,y-18>=0?x:x)&&false;
const mine2=(x,y)=>{if(y<0||y>=m.H||x<0||x>=m.W)return false;const i=(y*m.W+x)*m.ch;if(m.o[i+3]<128)return false;const R=m.o[i],G=m.o[i+1],B=m.o[i+2];if(R>230&&G<40&&B>230)return false;return !(R>=254&&G>=254&&B>=254);};
const bR=bb(ref,r.W,r.H),bM=bb(mine2,m.W,m.H);
console.log('ref bbox',JSON.stringify(bR),'aspect',(bR.w/bR.h).toFixed(3));
console.log('mine bbox',JSON.stringify(bM),'aspect',(bM.w/bM.h).toFixed(3),'scale',(bM.w/bR.w).toFixed(3));
const ext=(f,b,t)=>{const y=Math.round(b.y0+t*(b.h-1));let a=-1,c=-1;for(let x=b.x0;x<=b.x1;x++)if(f(x,y)){if(a<0)a=x;c=x;}return a<0?null:[(a-b.x0)/b.w,(c+1-b.x0)/b.w];};
let err=0,n=0;
for(let k=0;k<=24;k++){const t=k/24,A=ext(ref,bR,t),B=ext(mine2,bM,t);
  console.log((t*100).toFixed(0).padStart(3)+'%  ref '+(A?A.map(v=>v.toFixed(3)).join('..'):'-')+'   mine '+(B?B.map(v=>v.toFixed(3)).join('..'):'-')+'   dW='+(A&&B?((B[1]-B[0])-(A[1]-A[0])).toFixed(3):'-'));
  if(A&&B){err+=Math.abs(B[0]-A[0])+Math.abs(B[1]-A[1]);n+=2;}}
console.log('mean edge error (fraction of width):',(err/n).toFixed(4));
