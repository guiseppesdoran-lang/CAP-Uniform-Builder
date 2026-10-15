// node make-dir-sheet.js <dir> "<regex>" out.png [ppi=40] [cols=4] : true-scale contact sheet of any asset folder
const fs=require('fs'),path=require('path'),{execSync}=require('child_process');
const [,,DIR,PAT,OUTF,PPIs='40',COLSs='4']=process.argv,PPI=+PPIs,COLS=+COLSs,dir=path.join(__dirname,DIR),re=new RegExp(PAT);
const ids=fs.readdirSync(dir).filter(f=>f.endsWith('.svg')&&re.test(f)).map(f=>f.replace('.svg','')).sort();
const items=ids.map(id=>{const s=fs.readFileSync(path.join(dir,id+'.svg'),'utf8');return {id,w:parseFloat(s.match(/width="([\d.]+)in"/)[1]),h:parseFloat(s.match(/height="([\d.]+)in"/)[1]),
  inner:s.replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'').replace(/<metadata>[\s\S]*?<\/metadata>/,'').replace(/<title>[\s\S]*?<\/title>/,'')};});
const cw=Math.max(...items.map(i=>i.w*PPI))+30,ch=Math.max(...items.map(i=>i.h*PPI))+50,rows=Math.ceil(items.length/COLS),W=COLS*cw+30,H=rows*ch+30,S=Math.max(W,H);
let g='';items.forEach((it,i)=>{const x=30+(i%COLS)*cw,y=30+Math.floor(i/COLS)*ch;
  g+=`<rect x="${x}" y="${y}" width="${it.w*PPI}" height="${it.h*PPI}" fill="#8a8f98"/><g transform="translate(${x} ${y}) scale(${PPI/100})">${it.inner}</g><text x="${x}" y="${y+it.h*PPI+16}" font-family="Arial" font-size="12" fill="#e6e9ee">${it.id}</text>`;});
fs.writeFileSync('/tmp/_d.svg',`<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}"><rect width="${S}" height="${S}" fill="#2a2e36"/>${g}</svg>`);
execSync(`qlmanage -t -s ${Math.ceil(S)} -o /tmp /tmp/_d.svg >/dev/null 2>&1`);fs.renameSync('/tmp/_d.svg.png',path.resolve(OUTF));console.log({W,H,S,items:items.length});
