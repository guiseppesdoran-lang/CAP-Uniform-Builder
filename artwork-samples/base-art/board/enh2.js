const dec=require('./dec.js'),fs=require('fs'),zlib=require('zlib');
const [,,src,x0,y0,w,h,Z,out]=process.argv;const d=dec(src);const X0=+x0,Y0=+y0,W=+w,H=+h,z=+Z,OW=W*z,OH=H*z,raw=Buffer.alloc(OH*(OW*3+1));
for(let y=0;y<OH;y++)for(let x=0;x<OW;x++){const sx=X0+(x/z|0),sy=Y0+(y/z|0);const p=d.px(sx,sy),bg=p[3]<128,ax=X0+x/z,ay=Y0+y/z;
 const gx=Math.floor(ax)%50===0&&Math.floor(ax-1/z)!==Math.floor(ax),gy=Math.floor(ay)%50===0&&Math.floor(ay-1/z)!==Math.floor(ay);
 for(let k=0;k<3;k++){let v=bg?255:Math.min(255,p[k]*(p[k]<100?4:1));if(gx||gy)v=k?70:255;raw[y*(OW*3+1)+1+x*3+k]=v;}}
const crc=(()=>{const t=[];for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0;}return b=>{let c=~0;for(const v of b)c=t[(c^v)&255]^(c>>>8);return (~c)>>>0;};})();
const ch=(t,b)=>{const l=Buffer.alloc(4);l.writeUInt32BE(b.length);const tb=Buffer.concat([Buffer.from(t),b]);const c=Buffer.alloc(4);c.writeUInt32BE(crc(tb));return Buffer.concat([l,tb,c]);};
const ih=Buffer.alloc(13);ih.writeUInt32BE(OW,0);ih.writeUInt32BE(OH,4);ih[8]=8;ih[9]=2;
fs.writeFileSync(out,Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),ch('IHDR',ih),ch('IDAT',zlib.deflateSync(raw)),ch('IEND',Buffer.alloc(0))]));
