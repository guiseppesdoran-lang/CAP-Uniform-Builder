// all OCP assets drawn at the SAME scale (130 px per inch), shelf-packed, labelled
const fs=require('fs'),path=require('path'),cp=require('child_process');
const SK=path.join(process.env.HOME,'.claude/skills/badge-replicator/scripts'),io=require(SK+'/pngio.js');
const PPI=130,SW=1500,G=16,LAB=18;const tmp='/private/tmp/ocpsheet';fs.mkdirSync(tmp,{recursive:true});
const items=fs.readdirSync('field').filter(d=>fs.existsSync(`field/${d}/${d}.spec.json`)).map(d=>{const s=JSON.parse(fs.readFileSync(`field/${d}/${d}.spec.json`));
  return {d,w:Math.round(s.width_in*PPI),h:Math.round(s.height_in*PPI)};}).sort((a,b)=>b.h-a.h||b.w-a.w);
// shelf pack into pages of max height 2400
const pages=[];let cur={rows:[],y:G},row=null;
const newRow=()=>{row={items:[],x:G,h:0};cur.rows.push(row);};newRow();
for(const it of items){
  if(row.x+it.w+G>SW){cur.y+=row.h+LAB+G;newRow();}
  if(cur.y+it.h+LAB+G>2600&&row.items.length===0){}
  if(cur.y+Math.max(row.h,it.h)+LAB+G>2600&&row.items.length>0){pages.push(cur);cur={rows:[],y:G};newRow();}
  row.items.push({...it,x:row.x,y:cur.y});row.x+=it.w+G;row.h=Math.max(row.h,it.h);
}
pages.push(cur);
pages.forEach((pg,pi)=>{
  const H=Math.max(...pg.rows.flatMap(r=>r.items.map(i=>i.y+i.h+LAB+G)),100),cv=Buffer.alloc(SW*H*4,255);
  for(const r of pg.rows)for(const it of r.items){
    const out=`${tmp}/${it.d}.png`;cp.execFileSync('node',[SK+'/render.js',`field/${it.d}/${it.d}.svg`,out,'--height',String(it.h)],{stdio:'ignore'});
    const im=io.decode(out);
    for(let y=0;y<im.H&&y<it.h+4;y++)for(let x=0;x<im.W&&x<it.w+4;x++){const s=(y*im.W+x)*4,d=((it.y+y)*SW+it.x+x)*4,a=im.rgba[s+3]/255;for(let k=0;k<3;k++)cv[d+k]=Math.round(im.rgba[s+k]*a+cv[d+k]*(1-a));}
    const lab=`${tmp}/${it.d}.svg`;fs.writeFileSync(lab,`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Math.max(it.w,160)} 14" width="${Math.max(it.w,160)}" height="14"><text x="0" y="11" font-family="Arial" font-size="11" fill="#222">${it.d.replace(/^enamel-/,'').replace(/-field$/,'')}</text></svg>`);
    const lp=`${tmp}/${it.d}_l.png`;cp.execFileSync('node',[SK+'/render.js',lab,lp,'--height','12'],{stdio:'ignore'});const L=io.decode(lp);
    for(let y=0;y<L.H;y++)for(let x=0;x<L.W&&it.x+x<SW;x++){const s=(y*L.W+x)*4,d=((it.y+it.h+3+y)*SW+it.x+x)*4,a=L.rgba[s+3]/255;for(let k=0;k<3;k++)cv[d+k]=Math.round(L.rgba[s+k]*a+cv[d+k]*(1-a));}
  }
  fs.writeFileSync(`field/FIELD_SHEET_${pi+1}.png`,io.encode(SW,H,cv));
});
console.log(items.length,'assets',pages.length,'pages');
