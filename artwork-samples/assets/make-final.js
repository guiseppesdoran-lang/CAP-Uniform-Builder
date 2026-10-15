// every final badge in ONE png, all at the same true scale (PPI px per inch), grouped: blues (silver/metal, enamel), dress miniatures, ABU/OCP
const fs=require('fs'),path=require('path'),cp=require('child_process');
const SK=path.join(process.env.HOME,'.claude/skills/badge-replicator/scripts'),io=require(SK+'/pngio.js');
const PPI=+(process.env.PPI||150),SW=7900,G=14,LAB=20,HEAD=54;const tmp='/private/tmp/finalsheet';fs.mkdirSync(tmp,{recursive:true});
const SECTIONS=[['BLUES  -  metal badges (silver family: wings, ground team, incident commander, legal, medical, nurse, commanders, solo, rocketry, national staff)','silver'],
 ['BLUES  -  enamel specialty badges, shields, cadet/EMT/chaplain/NRA etc.','enamel'],
 ['DRESS  -  miniatures','mini'],['ABU / OCP  -  light silver embroidery on dark blue, 1/8 in blue showing','field'],
 ['MILITARY  -  US Air Force aviation and space (estimated sizes, flat redraws)','military/af/final'],
 ['MILITARY  -  US Air Force occupational / medical / specialty','military/af2/final'],
 ['MILITARY  -  US Army','military/army/final'],
 ['MILITARY  -  US Navy','military/navy/final'],
 ['MILITARY  -  US Marine Corps','military/usmc/final'],
 ['MILITARY  -  US Coast Guard','military/uscg/final'],
 ['MILITARY ABU / OCP  -  all military badges on dark blue (gold thread where the badge is gold)','military/field']];
const items=[];
for(const [title,dir] of SECTIONS){
  const ds=fs.readdirSync(dir).filter(d=>fs.existsSync(`${dir}/${d}/${d}.spec.json`)).sort();
  items.push({head:title,dir});
  const a=ds.map(d=>{const s=JSON.parse(fs.readFileSync(`${dir}/${d}/${d}.spec.json`));return {d,dir,w:Math.max(8,Math.round(s.width_in*PPI)),h:Math.max(8,Math.round(s.height_in*PPI))};}).sort((p,q)=>q.h-p.h||q.w-p.w);
  items.push(...a);
}
// shelf layout
let y=G,x=G,rowH=0;const placed=[];
for(const it of items){
  if(it.head){if(x>G){y+=rowH+LAB+G;x=G;rowH=0;}placed.push({...it,x:G,y,hd:true});y+=HEAD;x=G;rowH=0;continue;}
  const bw=Math.max(it.w,110);
  if(x+bw+G>SW){y+=rowH+LAB+G;x=G;rowH=0;}
  placed.push({...it,x,y});x+=bw+G;rowH=Math.max(rowH,it.h);
}
const H=y+rowH+LAB+G;console.log('canvas',SW,H);
const cv=Buffer.alloc(SW*H*4,255);
const blit=(im,ox,oy)=>{for(let yy=0;yy<im.H;yy++){if(oy+yy<0||oy+yy>=H)continue;for(let xx=0;xx<im.W;xx++){if(ox+xx>=SW)break;const s=(yy*im.W+xx)*4,d=((oy+yy)*SW+ox+xx)*4,a=im.rgba[s+3]/255;for(let k=0;k<3;k++)cv[d+k]=Math.round(im.rgba[s+k]*a+cv[d+k]*(1-a));}}};
const textPng=(txt,size,key,width)=>{const f=`${tmp}/${key}.svg`;fs.writeFileSync(f,`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${size+8}" width="${width}" height="${size+8}"><text x="0" y="${size}" font-family="Arial" font-weight="bold" font-size="${size}" fill="#1b2547">${txt.replace(/&/g,'&amp;')}</text></svg>`);
  const o=`${tmp}/${key}.png`;cp.execFileSync('node',[SK+'/render.js',f,o,'--height',String(size)],{stdio:'ignore'});return io.decode(o);};
let n=0;
for(const p of placed){
  if(p.hd){blit(textPng(p.head,26,'head'+(n++),Math.min(4200,p.head.length*20)),p.x,p.y+8);
    for(let xx=0;xx<SW-2*G;xx++){const d=((p.y+HEAD-6)*SW+G+xx)*4;cv[d]=27;cv[d+1]=37;cv[d+2]=71;cv[d+3]=255;}continue;}
  const out=`${tmp}/${p.dir.replace(/\W/g,'_')}_${p.d}.png`;
  cp.execFileSync('node',[SK+'/render.js',`${p.dir}/${p.d}/${p.d}.svg`,out,'--height',String(p.h)],{stdio:'ignore'});
  blit(io.decode(out),p.x,p.y);
  blit(textPng(p.d.replace(/^enamel-/,'').replace(/-field$|-mini$/,m=>m),9,'l_'+p.dir.replace(/\W/g,'_')+'_'+p.d,Math.max(p.w,110)),p.x,p.y+p.h+4);
}
fs.writeFileSync(process.env.OUT||'ALL_FINAL_BADGES.png',io.encode(SW,H,cv));console.log('done',SW+'x'+H,items.filter(i=>!i.head).length,'badges');
