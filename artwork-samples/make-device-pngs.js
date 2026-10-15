// Transparent PNGs for the devices: render each SVG on white and on black (qlmanage always flattens),
// then recover colour + alpha from the two renders.
const fs=require('fs'),zlib=require('zlib'),path=require('path'),{execSync}=require('child_process');
const dir=path.join(__dirname,'cap-devices'),tmp=path.join(dir,'.tmp');fs.mkdirSync(tmp,{recursive:true});
function dec(f){const b=fs.readFileSync(f);let p=8,W,H,ct,id=[];while(p<b.length){const l=b.readUInt32BE(p),t=b.toString('latin1',p+4,p+8),d=b.subarray(p+8,p+8+l);if(t==='IHDR'){W=d.readUInt32BE(0);H=d.readUInt32BE(4);ct=d[9];}else if(t==='IDAT')id.push(d);p+=12+l;}
 const ch=ct===2?3:4,raw=zlib.inflateSync(Buffer.concat(id)),st=W*ch,o=Buffer.alloc(H*st);
 for(let y=0;y<H;y++){const f=raw[y*(st+1)];for(let x=0;x<st;x++){const v=raw[y*(st+1)+1+x],a=x>=ch?o[y*st+x-ch]:0,u=y?o[(y-1)*st+x]:0,c=(x>=ch&&y)?o[(y-1)*st+x-ch]:0;let r=v;if(f===1)r=v+a;else if(f===2)r=v+u;else if(f===3)r=v+((a+u)>>1);else if(f===4){const pp=a+u-c,pa=Math.abs(pp-a),pb=Math.abs(pp-u),pc=Math.abs(pp-c);r=v+(pa<=pb&&pa<=pc?a:pb<=pc?u:c);}o[y*st+x]=r&255;}}
 return {W,H,ch,o};}
const T=new Uint32Array(256).map((_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
const crc=b=>{let c=0xffffffff;for(const v of b)c=T[(c^v)&255]^(c>>>8);return (c^0xffffffff)>>>0;};
const chunk=(t,d)=>{const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(t),d]);const c=Buffer.alloc(4);c.writeUInt32BE(crc(td));return Buffer.concat([l,td,c]);};
const devs=JSON.parse(fs.readFileSync(path.join(dir,'devices.json')));
for(const d of devs){
  const svg=fs.readFileSync(path.join(dir,d.id+'.svg'),'utf8');
  const make=(bg,name)=>{const s=svg.replace(/(<svg[^>]*>)/,`$1<rect width="120" height="120" fill="${bg}"/>`);const f=path.join(tmp,name+'.svg');fs.writeFileSync(f,s);
    execSync(`qlmanage -t -s 360 -o "${tmp}" "${f}" >/dev/null 2>&1`);return dec(f+'.png');};
  const w=make('#ffffff',d.id+'_w'),k=make('#000000',d.id+'_k');
  const W=w.W,H=w.H,px=Buffer.alloc(W*H*4);
  for(let i=0;i<W*H;i++){
    const wr=w.o.subarray(i*w.ch,i*w.ch+3),kr=k.o.subarray(i*k.ch,i*k.ch+3);
    const a=1-((wr[0]-kr[0])+(wr[1]-kr[1])+(wr[2]-kr[2]))/(3*255);
    const al=Math.max(0,Math.min(1,a));
    for(let c=0;c<3;c++)px[i*4+c]=al>0.004?Math.max(0,Math.min(255,Math.round(kr[c]/al))):0;
    px[i*4+3]=Math.round(al*255);
  }
  const raw=Buffer.alloc((W*4+1)*H);for(let y=0;y<H;y++){raw[y*(W*4+1)]=0;px.copy(raw,y*(W*4+1)+1,y*W*4,(y+1)*W*4);}
  const ih=Buffer.alloc(13);ih.writeUInt32BE(W,0);ih.writeUInt32BE(H,4);ih[8]=8;ih[9]=6;
  fs.writeFileSync(path.join(dir,d.id+'.png'),Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ih),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]));
}
fs.rmSync(tmp,{recursive:true,force:true});
console.log('wrote',devs.length,'transparent PNGs');
