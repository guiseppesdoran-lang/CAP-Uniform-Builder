// side-by-side: photo body crop (left) | vector render (right); usage: node view.js out.png stem...
const {decode,encode}=require(process.env.HOME+'/.claude/skills/badge-replicator/scripts/pngio.js');
const cp=require('child_process'),fs=require('fs'),path=require('path');
const B=require('./stems.json');
const PH=JSON.parse(fs.readFileSync('photomap.json','utf8'));
const H=+process.env.H||360,tiles=[];
for(const st of process.argv.slice(3)){
  const id=(st==='usaf_aam01'?'medal-cap-catalog-air-force-aerial-achievement-medal-full':`medal-${B[st][0]}-full`);
  const im=decode(`png/${PH[st]}.png`);
  // crop the lower body of the photo using the same logic: take bottom 40 %
  let y1=0;for(let y=im.H-1;y>=0;y--){let f=false;for(let x=0;x<im.W;x+=3){const i=(y*im.W+x)*4;if(Math.min(im.rgba[i],im.rgba[i+1],im.rgba[i+2])<235){f=true;break;}}if(f){y1=y;break;}}
  const y0=Math.max(0,y1-Math.round(im.H*0.3));const sh=y1-y0+1,sc=H/sh,w=Math.round(im.W*sc);
  const t=Buffer.alloc(w*H*4,255);for(let y=0;y<H;y++)for(let x=0;x<w;x++){const i=((y0+Math.min(sh-1,Math.floor(y/sc)))*im.W+Math.min(im.W-1,Math.floor(x/sc)))*4,d=(y*w+x)*4;for(let c=0;c<4;c++)t[d+c]=im.rgba[i+c];}
  // crop photo horizontally to its fg column span
  tiles.push({w,h:H,b:t});
  const o='/tmp/_v_'+id+'.png';cp.execSync(`node ${process.env.HOME}/.claude/skills/badge-replicator/scripts/render.js ${path.resolve('..','medals',id+'.svg')} ${o} --height ${H} >/dev/null 2>&1`);
  const r=decode(o);tiles.push({w:r.W,h:r.H,b:r.rgba});
}
const per=+process.env.PER||6,rows=[];for(let i=0;i<tiles.length;i+=per)rows.push(tiles.slice(i,i+per));
const W=Math.max(...rows.map(r=>r.reduce((s,t)=>s+t.w+8,0))),O=Buffer.alloc(W*(H+8)*rows.length*4,255);
rows.forEach((r,ri)=>{let ox=0;for(const t of r){for(let y=0;y<Math.min(H,t.h);y++)for(let x=0;x<t.w;x++){const i=(y*t.w+x)*4,a=t.b[i+3]/255,d=((ri*(H+8)+y)*W+ox+x)*4;for(let c=0;c<3;c++)O[d+c]=t.b[i+c]*a+255*(1-a);}ox+=t.w+8;}});
fs.writeFileSync(process.argv[2],encode(W,(H+8)*rows.length,O));console.log(W,(H+8)*rows.length);
