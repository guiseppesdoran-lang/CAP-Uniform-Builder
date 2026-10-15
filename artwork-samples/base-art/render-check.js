// Render each flight asset at >= 20 px/in and verify the ink stays inside the artwork box (no clipping at the edges).
const fs=require('fs'),path=require('path'),cp=require('child_process');
const dec=require('./board/dec.js');
const D=path.join(__dirname,'..','assets','garments'),OUT=path.join(__dirname,'flight_renders');fs.mkdirSync(OUT,{recursive:true});
const ids=['garment-fdu-flight-suit','garment-cfdu-flight-suit','garment-flight-jacket-green','garment-flight-jacket-blue','garment-cap-command-scarf'];
let bad=0;
for(const id of ids){const sp=JSON.parse(fs.readFileSync(path.join(D,id+'.spec.json')));const w=sp.size_in.w,h=sp.size_in.h;
  const px=Math.max(Math.ceil(Math.max(w,h)*20),600);const src=fs.readFileSync(path.join(D,id+'.svg'),'utf8');
  const m0=src.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/),vw=+m0[1],vh=+m0[2],S=Math.max(w,h);
  const inner=src.replace(/^<svg[^>]*>/,'').replace(/<\/svg>\s*$/,'');
  const sq=`<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 ${S} ${S}"><rect width="${S}" height="${S}" fill="#fff"/><svg x="${(S-w)/2}" y="${(S-h)/2}" width="${w}" height="${h}" viewBox="0 0 ${vw} ${vh}">${inner}</svg></svg>`;
  const tmp=path.join(OUT,id+'.sq.svg');fs.writeFileSync(tmp,sq);
  cp.execSync(`qlmanage -t -s ${px} -o "${OUT}" "${tmp}" >/dev/null 2>&1`);
  const png=tmp+'.png',fin=path.join(OUT,id+'.png');fs.renameSync(png,fin);fs.unlinkSync(tmp);
  const d=dec(fin);const W=d.w||d.W,H=d.h||d.H;
  // fitted rect inside the square thumbnail
  const sc=px/Math.max(w,h),fw=w*sc,fh=h*sc,ox=(px-fw)/2,oy=(px-fh)/2;
  let x0=1e9,y0=1e9,x1=-1,y1=-1;
  for(let y=0;y<px;y+=1)for(let x=0;x<px;x+=1){const p=d.px(x,y);if(Math.min(p[0],p[1],p[2])<245){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}}
  const m=[x0-ox,y0-oy,ox+fw-1-x1,oy+fh-1-y1].map(v=>+(v/sc).toFixed(2));
  const ok=m.every(v=>v>=0.05);if(!ok)bad++;
  console.log(id.padEnd(34),`${w.toFixed(1)} x ${h.toFixed(1)} in @${px}px (${sc.toFixed(1)} px/in)`,'margins in (L,T,R,B):',m.join(', '),ok?'ok':'CLIPPED');}
process.exit(bad?1:0);
