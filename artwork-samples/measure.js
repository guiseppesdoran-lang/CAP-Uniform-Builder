const fs=require('fs'),zlib=require('zlib');
function decode(file){
  const b=fs.readFileSync(file);let p=8,W,H,ct,idat=[];
  while(p<b.length){const l=b.readUInt32BE(p),t=b.toString('latin1',p+4,p+8),d=b.subarray(p+8,p+8+l);
    if(t==='IHDR'){W=d.readUInt32BE(0);H=d.readUInt32BE(4);ct=d[9];}else if(t==='IDAT')idat.push(d);p+=12+l;}
  const ch={0:1,2:3,4:2,6:4}[ct],raw=zlib.inflateSync(Buffer.concat(idat)),st=W*ch,out=Buffer.alloc(H*st);
  for(let y=0;y<H;y++){const f=raw[y*(st+1)];for(let x=0;x<st;x++){
    const v=raw[y*(st+1)+1+x],a=x>=ch?out[y*st+x-ch]:0,u=y?out[(y-1)*st+x]:0,c=(x>=ch&&y)?out[(y-1)*st+x-ch]:0;
    let r=v;if(f===1)r=v+a;else if(f===2)r=v+u;else if(f===3)r=v+((a+u)>>1);else if(f===4){const pp=a+u-c,pa=Math.abs(pp-a),pb=Math.abs(pp-u),pc=Math.abs(pp-c);r=v+(pa<=pb&&pa<=pc?a:pb<=pc?u:c);}
    out[y*st+x]=r&255;}}
  const lum=new Float32Array(W*H),alpha=new Uint8Array(W*H).fill(255);
  for(let i=0;i<W*H;i++){const o=i*ch;lum[i]=ch>=3?0.3*out[o]+0.59*out[o+1]+0.11*out[o+2]:out[o];if(ch===4)alpha[i]=out[o+3];if(ch===2)alpha[i]=out[o+1];}
  return {W,H,lum,alpha};
}
module.exports=decode;
if(require.main===module){
  const {W,H,lum,alpha}=decode(process.argv[2]);
  console.log('size',W,H);
  const T=225;let minx=W,maxx=0,miny=H,maxy=0;
  const rows=[];
  for(let y=0;y<H;y++){let a=-1,b=-1;for(let x=0;x<W;x++)if(alpha[y*W+x]>100){if(a<0)a=x;b=x;}
    rows.push([a,b]);if(a>=0){minx=Math.min(minx,a);maxx=Math.max(maxx,b);miny=Math.min(miny,y);maxy=y;}}
  console.log('bbox',minx,miny,maxx,maxy);
  for(let y=0;y<H;y+=4)console.log(String(y).padStart(3),rows[y].join('..'),' w=',rows[y][1]-rows[y][0]);
}
