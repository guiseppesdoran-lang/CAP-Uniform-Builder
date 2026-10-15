const fs=require('fs'),zlib=require('zlib');
module.exports=function decode(file){const buf=fs.readFileSync(file);let p=8,W,H,ct,idat=[];
  while(p<buf.length){const l=buf.readUInt32BE(p),t=buf.toString('latin1',p+4,p+8),d=buf.subarray(p+8,p+8+l);if(t==='IHDR'){W=d.readUInt32BE(0);H=d.readUInt32BE(4);ct=d[9];}if(t==='IDAT')idat.push(d);p+=12+l;}
  const ch={2:3,6:4}[ct],raw=zlib.inflateSync(Buffer.concat(idat)),st=W*ch,out=Buffer.alloc(H*st);
  for(let y=0;y<H;y++){const f=raw[y*(st+1)];for(let i=0;i<st;i++){const x=raw[y*(st+1)+1+i],a=i>=ch?out[y*st+i-ch]:0,b=y?out[(y-1)*st+i]:0,c=(i>=ch&&y)?out[(y-1)*st+i-ch]:0;let v=x;if(f===1)v=x+a;else if(f===2)v=x+b;else if(f===3)v=x+((a+b)>>1);else if(f===4){const pp=a+b-c,pa=Math.abs(pp-a),pb=Math.abs(pp-b),pc=Math.abs(pp-c);v=x+(pa<=pb&&pa<=pc?a:pb<=pc?b:c);}out[y*st+i]=v&255;}}
  return {W,H,ch,st,out,px:(x,y)=>[0,1,2,3].map(k=>ch===4||k<3?out[y*st+x*ch+k]:255)};};
