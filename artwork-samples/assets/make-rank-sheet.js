// Contact sheet of insignia assets at true relative scale (one px-per-inch for the whole sheet).
// usage: node make-rank-sheet.js out.png "<regex on id>" [pxPerIn=170] [cols=6]
const fs=require('fs'),path=require('path'),{execSync}=require('child_process');
const [,,OUTF,PAT,PPI='170',COLS='6']=process.argv;
const dir=path.join(__dirname,'insignia'),re=new RegExp(PAT||'.');
const ids=fs.readdirSync(dir).filter(f=>f.endsWith('.svg')&&re.test(f)).map(f=>f.replace('.svg','')).sort();
const ppi=+PPI,cols=+COLS,pad=26,lab=34;
const items=ids.map(id=>{const s=fs.readFileSync(path.join(dir,id+'.svg'),'utf8');
  const w=parseFloat(s.match(/width="([\d.]+)in"/)[1]),h=parseFloat(s.match(/height="([\d.]+)in"/)[1]);
  const inner=s.replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'').replace(/<metadata>[\s\S]*?<\/metadata>/,'').replace(/<title>[\s\S]*?<\/title>/,'');
  const inl=inner.replace(/href="([^"]+\.png)"/g,(m,f)=>'href="data:image/png;base64,'+fs.readFileSync(path.join(dir,f)).toString('base64')+'"');
  return {id,w,h,inner:inl};});
// cell size = max item in its column row; simple uniform grid
const cw=Math.max(...items.map(i=>i.w*ppi),115)+pad,ch=Math.max(...items.map(i=>i.h*ppi))+lab+pad;
const rows=Math.ceil(items.length/cols),W=cols*cw+pad,H=rows*ch+pad,S=Math.max(W,H);
let g='';
items.forEach((it,i)=>{const x=pad+(i%cols)*cw,y=pad+Math.floor(i/cols)*ch;
  const sc=ppi/100; // viewBox units are 0.01 in
  g+=`<g transform="translate(${x} ${y}) scale(${sc})">${it.inner}</g><rect x="${x}" y="${y}" width="${it.w*ppi}" height="${it.h*ppi}" fill="none" stroke="#ffffff" stroke-opacity=".18" stroke-dasharray="3 3"/>`
    +`<text x="${x}" y="${y+it.h*ppi+18}" font-family="Arial" font-size="12" fill="#e6e9ee">${it.id.replace('rank-','').replace('cadet-officer-','co-').replace('lieutenant','lt').replace('sergeant','sgt').replace('cloth-bordered','bordered')}</text>`;});
const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}"><rect width="${S}" height="${S}" fill="#2a2e36"/>${g}</svg>`;
const tmp=OUTF.replace(/\.png$/,'.svg');fs.writeFileSync(tmp,svg);
execSync(`qlmanage -t -s ${S} -o "${path.dirname(path.resolve(OUTF))}" "${tmp}" >/dev/null 2>&1`);
fs.renameSync(tmp+'.png',OUTF);
// crop square canvas to content (sips -c centres, so content is centred first)
console.log({W,H,S,items:items.length});
