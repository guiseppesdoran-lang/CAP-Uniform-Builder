// node make-sheet2.js "<set1>,<set2>" out.png [cols] : reference (left) | mine (right) pairs from <set>/out-flat, same crop & scale per pair.
const fs=require('fs'),cp=require('child_process'),io=require(process.env.HOME+'/.claude/skills/badge-replicator/scripts/pngio.js');
const sets=process.argv[2].split(','),OUT=process.argv[3],COLS=+(process.argv[4]||4),CW=620,CH=250,PAD=8,TS=1600,tmp='/private/tmp/mil_sheet';fs.mkdirSync(tmp,{recursive:true});
const items=[];for(const s of sets)for(const f of fs.readdirSync(`${s}/out-flat`).filter(f=>f.endsWith('.svg')).sort())items.push({s,n:f.slice(0,-4)});
const W=COLS*CW,H=Math.ceil(items.length/COLS)*CH,buf=Buffer.alloc(W*H*3,255);
const flat=im=>{const b=Buffer.alloc(im.W*im.H*3);for(let i=0;i<im.W*im.H;i++){const a=im.rgba[i*4+3]/255;for(let k=0;k<3;k++)b[i*3+k]=Math.round(im.rgba[i*4+k]*a+255*(1-a));}return b;};
function blit(rgb,iw,ih,x0,y0,w,h,s,ox,oy){const tw=Math.round(w*s),th=Math.round(h*s);
  for(let y=0;y<th;y++)for(let x=0;x<tw;x++){const sx0=x0+x/s,sx1=x0+(x+1)/s,sy0=y0+y/s,sy1=y0+(y+1)/s;let r=0,g=0,b=0,c=0;
    for(let yy=Math.floor(sy0);yy<Math.max(Math.floor(sy0)+1,Math.ceil(sy1));yy++)for(let xx=Math.floor(sx0);xx<Math.max(Math.floor(sx0)+1,Math.ceil(sx1));xx++){
      const X=Math.min(iw-1,Math.max(0,xx)),Y=Math.min(ih-1,Math.max(0,yy)),o=(Y*iw+X)*3;r+=rgb[o];g+=rgb[o+1];b+=rgb[o+2];c++;}
    const d=((oy+y)*W+ox+x)*3;if(d>=0&&d<buf.length-2){buf[d]=r/c;buf[d+1]=g/c;buf[d+2]=b/c;}}}
const CAL={};
function calib(vb){const key=vb.join(' ');if(CAL[key])return CAL[key];
  fs.writeFileSync(`${tmp}/cal.svg`,`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${key}" width="${vb[2]}" height="${vb[3]}"><rect x="${vb[0]}" y="${vb[1]}" width="${vb[2]}" height="${vb[3]}" fill="#000"/></svg>`);
  cp.spawnSync('qlmanage',['-t','-s',String(TS),'-o',tmp,`${tmp}/cal.svg`],{stdio:'ignore'});const c=io.decode(`${tmp}/cal.svg.png`);
  let x0=1e9,y0=1e9,x1=-1,y1=-1;for(let y=0;y<c.H;y++)for(let x=0;x<c.W;x++){const o=(y*c.W+x)*4;if(c.rgba[o+3]>40&&c.rgba[o]<60){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}}
  return CAL[key]={k:(x1-x0+1)/vb[2],offx:x0-vb[0]*0,offy:y0};}
items.forEach((it,i)=>{
  const svg=`${it.s}/out-flat/${it.n}.svg`,vb=fs.readFileSync(svg,'utf8').match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
  cp.spawnSync('qlmanage',['-t','-s',String(TS),'-o',tmp,svg],{stdio:'ignore'});const m=io.decode(`${tmp}/${it.n}.svg.png`);
  const cal=calib(vb),k=cal.k,offx=cal.offx,offy=cal.offy;
  let x0=1e9,y0=1e9,x1=-1,y1=-1;for(let y=0;y<m.H;y++)for(let x=0;x<m.W;x++){const o=(y*m.W+x)*4;if(m.rgba[o+3]>40&&(m.rgba[o]<235||m.rgba[o+1]<235||m.rgba[o+2]<235)){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}}
  if(x1<0)return;
  const gx0=(x0-offx)/k-4,gy0=(y0-offy)/k-4,gw=(x1-x0)/k+9,gh=(y1-y0)/k+9;      // crop box in reference-grid units
  const ref=io.decode(`${it.s}/ref/${it.n}.png`),rk=ref.W/vb[2],cell=CW/2-2*PAD,s=Math.min(cell/gw,(CH-2*PAD)/gh),ox=(i%COLS)*CW,oy=Math.floor(i/COLS)*CH;
  blit(flat(ref),ref.W,ref.H,gx0*rk,gy0*rk,gw*rk,gh*rk,s/rk,ox+PAD,oy+Math.round((CH-gh*s)/2));
  blit(flat(m),m.W,m.H,gx0*k+offx,gy0*k+offy,gw*k,gh*k,s/k,ox+CW/2+PAD,oy+Math.round((CH-gh*s)/2));
});
const rgba=Buffer.alloc(W*H*4,255);for(let i=0;i<W*H;i++){rgba[i*4]=buf[i*3];rgba[i*4+1]=buf[i*3+1];rgba[i*4+2]=buf[i*3+2];}
fs.writeFileSync(OUT,io.encode(W,H,rgba));console.log(OUT,W+'x'+H,items.length,'badges');
