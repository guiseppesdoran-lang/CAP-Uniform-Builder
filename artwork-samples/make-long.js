// one tall image: every badge, reference LEFT / redraw RIGHT, 2 pairs per row, labelled (raster compose; no big SVG renders)
const fs=require('fs'),path=require('path'),cp=require('child_process');
const SK=path.join(process.env.HOME,'.claude/skills/badge-replicator/scripts');
const io=require(SK+'/pngio.js');
const items=[];
for(const n of fs.readdirSync('silver/ALL').filter(n=>n!=='ref'&&fs.existsSync(`silver/ALL/${n}/${n}.svg`)).sort())items.push({n,svg:`silver/ALL/${n}/${n}.svg`,ref:`silver/ALL/ref/${n}.png`});
for(const f of fs.readdirSync('enamel/out').filter(x=>x.endsWith('.svg')).sort()){const n=f.replace('.svg','');items.push({n,svg:`enamel/out/${f}`,ref:`batch/ref/${n}.png`});}
const tmp='/private/tmp/long_tmp2';fs.mkdirSync(tmp,{recursive:true});
const C=300,LAB=40,GAP=16,PW=C*2+GAP,W=PW*2+GAP*3,RH=C+LAB+GAP;
const rows=Math.ceil(items.length/2),H=rows*RH+GAP,canvas=Buffer.alloc(W*H*4,255);
function fit(p,key){ // -> decoded png scaled to fit CxC
  const o=`${tmp}/${key}.png`;fs.copyFileSync(p,o);cp.execSync(`sips -Z ${C} "${o}" >/dev/null 2>&1`);return io.decode(o);}
function paste(im,cx,cy){const x0=Math.round(cx-im.W/2),y0=Math.round(cy-im.H/2);
  for(let y=0;y<im.H;y++)for(let x=0;x<im.W;x++){const s=(y*im.W+x)*4,d=((y0+y)*W+x0+x)*4,a=im.rgba[s+3]/255;
    for(let k=0;k<3;k++)canvas[d+k]=Math.round(im.rgba[s+k]*a+canvas[d+k]*(1-a));}}
items.forEach((it,i)=>{
  const key=it.n.replace(/\W/g,'_'),col=i%2,row=Math.floor(i/2),x=GAP+col*(PW+GAP),y=GAP+row*RH;
  const mine=`${tmp}/${key}_mine.png`;cp.execFileSync('node',[SK+'/render.js',it.svg,mine,'--height','600'],{stdio:'ignore'});
  if(fs.existsSync(it.ref)){
    // crop reference to content so both sit at the same scale convention
    const R=io.decode(it.ref),b=io.contentBBox(R,254)||{x0:0,y0:0,w:R.W,h:R.H};
    const c=Buffer.alloc(b.w*b.h*4);for(let yy=0;yy<b.h;yy++)R.rgba.copy(c,yy*b.w*4,((b.y0+yy)*R.W+b.x0)*4,((b.y0+yy)*R.W+b.x0+b.w)*4);
    fs.writeFileSync(`${tmp}/${key}_ref0.png`,io.encode(b.w,b.h,c));paste(fit(`${tmp}/${key}_ref0.png`,key+'_ref'),x+C/2,y+C/2);}
  paste(fit(mine,key+'_m'),x+C+GAP+C/2,y+C/2);
  const lab=`${tmp}/${key}.svg`;fs.writeFileSync(lab,`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PW} 40" width="${PW}" height="40"><text x="${PW/2}" y="28" text-anchor="middle" font-family="Arial" font-size="20" fill="#222">${it.n.replace(/&/g,'&amp;')}</text></svg>`);
  const lp=`${tmp}/${key}_lab.png`;cp.execFileSync('node',[SK+'/render.js',lab,lp,'--height','22'],{stdio:'ignore'});
  const L=io.decode(lp);paste(L,x+PW/2,y+C+LAB/2+4);
});
fs.writeFileSync('ALL_BADGES_LONG.png',io.encode(W,H,canvas));console.log(items.length,'badges',W+'x'+H);
