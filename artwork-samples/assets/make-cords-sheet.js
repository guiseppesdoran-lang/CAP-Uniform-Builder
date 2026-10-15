// node make-cords-sheet.js out.png [ppi=70] : all cords side by side on a mid-gray ground (true relative scale)
const fs=require('fs'),path=require('path'),{execSync}=require('child_process');
const OUT=process.argv[2]||'cords-sheet.png',PPI=+(process.argv[3]||70),dir=path.join(__dirname,'cords');
const ids=fs.readdirSync(dir).filter(f=>f.endsWith('.svg')).map(f=>f.replace('.svg','')).sort();
let g='',x=30,H=0;
for(const id of ids){const s=fs.readFileSync(path.join(dir,id+'.svg'),'utf8');
  const w=parseFloat(s.match(/width="([\d.]+)in"/)[1]),h=parseFloat(s.match(/height="([\d.]+)in"/)[1]);
  const inner=s.replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'').replace(/<metadata>[\s\S]*?<\/metadata>/,'').replace(/<title>[\s\S]*?<\/title>/,'');
  g+=`<g transform="translate(${x} 30) scale(${PPI/100})">${inner}</g>`;x+=w*PPI+40;H=Math.max(H,h*PPI);}
const W=x,Hh=H+60,S=Math.max(W,Hh);
fs.writeFileSync('/tmp/_c.svg',`<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}"><rect width="${S}" height="${S}" fill="#6b7078"/>${g}</svg>`);
execSync(`qlmanage -t -s ${Math.ceil(S)} -o /tmp /tmp/_c.svg >/dev/null 2>&1`);fs.renameSync('/tmp/_c.svg.png',path.resolve(OUT));console.log({W,H:Hh,S});
