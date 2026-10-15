// one image of all military ABU/OCP versions, true scale 150 ppi, grouped by service
const fs=require('fs'),path=require('path'),cp=require('child_process');
const SK=path.join(process.env.HOME,'.claude/skills/badge-replicator/scripts'),io=require(SK+'/pngio.js');
const PPI=150,SW=7900,G=14,HEAD=40,tmp='/private/tmp/milfield';fs.mkdirSync(tmp,{recursive:true});
const groups=[['US Air Force',/^af-/],['US Army',/^army-/],['US Navy',/^navy-/],['US Marine Corps',/^usmc-/],['US Coast Guard',/^uscg-/]];
const all=fs.readdirSync('field').filter(d=>fs.existsSync(`field/${d}/${d}.spec.json`)).sort();
const items=[];
for(const [t,re] of groups){items.push({head:t});for(const d of all.filter(d=>re.test(d))){const s=JSON.parse(fs.readFileSync(`field/${d}/${d}.spec.json`));items.push({d,w:Math.round(s.width_in*PPI),h:Math.round(s.height_in*PPI),gold:s.field_uniform.thread==='gold'});}}
let x=G,y=G,rowH=0;const pl=[];
for(const it of items){if(it.head){if(x>G){y+=rowH+G;x=G;rowH=0;}pl.push({...it,x:G,y});y+=HEAD;rowH=0;x=G;continue;}
  if(x+it.w+G>SW){y+=rowH+G;x=G;rowH=0;}pl.push({...it,x,y});x+=it.w+G;rowH=Math.max(rowH,it.h);}
const H=y+rowH+G,cv=Buffer.alloc(SW*H*4,255);console.log(SW,H,items.filter(i=>!i.head).length);
for(const p of pl){if(p.hd||p.head)continue;const o=`${tmp}/${p.d}.png`;cp.execFileSync('node',[SK+'/render.js',`field/${p.d}/${p.d}.svg`,o,'--height',String(p.h)],{stdio:'ignore'});
  const im=io.decode(o);for(let yy=0;yy<im.H;yy++)for(let xx=0;xx<im.W;xx++){if(p.x+xx>=SW||p.y+yy>=H)continue;const s=(yy*im.W+xx)*4,d=((p.y+yy)*SW+p.x+xx)*4,a=im.rgba[s+3]/255;for(let k=0;k<3;k++)cv[d+k]=Math.round(im.rgba[s+k]*a+cv[d+k]*(1-a));}}
fs.writeFileSync('ALL_MIL_FIELD.png',io.encode(SW,H,cv));
