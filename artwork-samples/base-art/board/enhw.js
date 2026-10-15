const dec=require('./dec.js'),fs=require('fs'),zlib=require('zlib');
const [,, src,x0,y0,w,h,Z,out]=process.argv;const d=dec(src);
const X0=+x0,Y0=+y0,W=+w,H=+h,z=+Z,OW=W*z,OH=H*z;
const raw=Buffer.alloc(OH*(OW*3+1));
for(let y=0;y<OH;y++){raw[y*(OW*3+1)]=0;for(let x=0;x<OW;x++){const sx=Math.min(d.W-1,X0+Math.floor(x/z)),sy=Math.min(d.H-1,Y0+Math.floor(y/z));const p=d.px(sx,sy);
 for(let k=0;k<3;k++){let v=p[k];v=Math.min(255,Math.max(0,((p[0]+p[1]+p[2])/3-205)*5));raw[y*(OW*3+1)+1+x*3+k]=v;}}}
const crc=(()=>{const t=[];for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0;}return b=>{let c=~0;for(const v of b)c=t[(c^v)&255]^(c>>>8);return (~c)>>>0;};})();
const ch=(t,b)=>{const l=Buffer.alloc(4);l.writeUInt32BE(b.length);const tb=Buffer.concat([Buffer.from(t),b]);const c=Buffer.alloc(4);c.writeUInt32BE(crc(tb));return Buffer.concat([l,tb,c]);};
const ih=Buffer.alloc(13);ih.writeUInt32BE(OW,0);ih.writeUInt32BE(OH,4);ih[8]=8;ih[9]=2;
fs.writeFileSync(out,Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),ch('IHDR',ih),ch('IDAT',zlib.deflateSync(raw)),ch('IEND',Buffer.alloc(0))]));
