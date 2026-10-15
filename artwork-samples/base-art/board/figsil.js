// Figure silhouette: flood-fill the page background (threshold) in a crop of a page render, keep the largest component, write RGBA png + smooth outline.
// usage: node figsil.js page.png x0 y0 w h thr out_alpha.png fillTop
const fs=require('fs'),zlib=require('zlib'),dec=require('./dec.js');
const [,,SRC,x0,y0,w,h,thr,OUT,fillTop]=process.argv;const d=dec(SRC),X0=+x0,Y0=+y0,W=+w,H=+h,T=+thr,FT=+(fillTop||0);
const lum=(x,y)=>{const p=d.px(X0+x,Y0+y);return 0.3*p[0]+0.59*p[1]+0.11*p[2];};
const bg=new Uint8Array(W*H),q=[];
const push=(x,y)=>{if(x<0||y<0||x>=W||y>=H)return;const i=y*W+x;if(bg[i]||lum(x,y)<T)return;bg[i]=1;q.push(i);};
for(let x=0;x<W;x++){push(x,0);push(x,H-1);}for(let y=0;y<H;y++){push(0,y);push(W-1,y);}
while(q.length){const i=q.pop(),x=i%W,y=(i/W)|0;push(x+1,y);push(x-1,y);push(x,y+1);push(x,y-1);}
for(let y=0;y<FT;y++){let a=-1,b=-1;for(let x=0;x<W;x++)if(!bg[y*W+x]){if(a<0)a=x;b=x;}if(a>=0)for(let x=a;x<=b;x++)bg[y*W+x]=0;}
const lab=new Int32Array(W*H);let best=0,bn=0,n=0;
for(let s=0;s<W*H;s++){if(bg[s]||lab[s])continue;n++;let c=0;const st=[s];lab[s]=n;while(st.length){const i=st.pop();c++;const x=i%W,y=(i/W)|0;for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=W||yy>=H)continue;const j=yy*W+xx;if(!bg[j]&&!lab[j]){lab[j]=n;st.push(j);}}}if(c>bn){bn=c;best=n;}}
const raw=Buffer.alloc(H*(W*4+1));
for(let y=0;y<H;y++)for(let x=0;x<W;x++){const p=d.px(X0+x,Y0+y),o=y*(W*4+1)+1+x*4;raw[o]=p[0];raw[o+1]=p[1];raw[o+2]=p[2];raw[o+3]=lab[y*W+x]===best?255:0;}
const crc=(()=>{const t=[];for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0;}return b=>{let c=~0;for(const v of b)c=t[(c^v)&255]^(c>>>8);return (~c)>>>0;};})();
const ch=(t,b)=>{const l=Buffer.alloc(4);l.writeUInt32BE(b.length);const tb=Buffer.concat([Buffer.from(t),b]);const c=Buffer.alloc(4);c.writeUInt32BE(crc(tb));return Buffer.concat([l,tb,c]);};
const ih=Buffer.alloc(13);ih.writeUInt32BE(W,0);ih.writeUInt32BE(H,4);ih[8]=8;ih[9]=6;
fs.writeFileSync(OUT,Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),ch('IHDR',ih),ch('IDAT',zlib.deflateSync(raw)),ch('IEND',Buffer.alloc(0))]));console.log('ok');
