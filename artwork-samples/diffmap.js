// Pixel-level silhouette difference: red = mine only, blue = reference only, grey = both.
const fs=require('fs'),zlib=require('zlib');
const dec=require('./measure.js'),L=require('./gt-lib.js');
const P=JSON.parse(fs.readFileSync('gt-params.json'));
const ref=dec(process.argv[2]),m=L.silhouette(P),S=4,W=L.W,H=L.H;
const w=W*S,h=H*S,px=Buffer.alloc(w*h*4);
let both=0,mine=0,theirs=0;
for(let y=0;y<H;y++)for(let x=0;x<W;x++){const a=m[y*W+x],b=ref.alpha[y*W+x]>100;
  let c=[255,255,255];if(a&&b){c=[200,200,205];both++;}else if(a){c=[230,40,40];mine++;}else if(b){c=[40,80,230];theirs++;}
  for(let dy=0;dy<S;dy++)for(let dx=0;dx<S;dx++){const i=((y*S+dy)*w+x*S+dx)*4;px[i]=c[0];px[i+1]=c[1];px[i+2]=c[2];px[i+3]=255;}}
const crcT=new Uint32Array(256).map((_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
const crc=b=>{let c=0xffffffff;for(const v of b)c=crcT[(c^v)&255]^(c>>>8);return (c^0xffffffff)>>>0;};
const chunk=(t,d)=>{const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(t),d]);const c=Buffer.alloc(4);c.writeUInt32BE(crc(td));return Buffer.concat([l,td,c]);};
const raw=Buffer.alloc((w*4+1)*h);for(let y=0;y<h;y++){raw[y*(w*4+1)]=0;px.copy(raw,y*(w*4+1)+1,y*w*4,(y+1)*w*4);}
const ih=Buffer.alloc(13);ih.writeUInt32BE(w,0);ih.writeUInt32BE(h,4);ih[8]=8;ih[9]=6;
fs.writeFileSync('gt-diffmap.png',Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ih),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]));
console.log({both,mineOnly:mine,refOnly:theirs,iou:(both/(both+mine+theirs)).toFixed(4)});
